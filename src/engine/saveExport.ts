import { MECH_CLASS_LIST } from '../data/classes';
import { getMapNodes } from '../data/maps';
import type { MechClassId } from '../types/game';
import {
  CURRENT_SAVE_VERSION,
  migrateSaveData,
  type PersistedCampaignState,
} from './migration';

export const SAVE_EXPORT_APP_ID = 'dream-ace' as const;
export const SAVE_PBKDF2_ITERATIONS = 100_000;
export const SAVE_IMPORT_BACKUP_STORAGE_KEY = 'starfront_mech_rpg_import_backup_v1';

export type SaveExportErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_ENVELOPE'
  | 'WRONG_APP'
  | 'CHECKSUM_MISMATCH'
  | 'INVALID_PIN'
  | 'WRONG_PIN'
  | 'CORRUPT'
  | 'VERSION_TOO_NEW'
  | 'UNSUPPORTED_CRYPTO';

export interface SaveExportError {
  code: SaveExportErrorCode;
  message: string;
  foundVersion?: number;
  supportedVersion?: number;
}

export class SaveExportException extends Error {
  readonly code: SaveExportErrorCode;

  constructor(code: SaveExportErrorCode, message: string) {
    super(message);
    this.name = 'SaveExportException';
    this.code = code;
  }
}

export interface SaveExportEnvelope {
  app: typeof SAVE_EXPORT_APP_ID;
  saveVersion: number;
  exportedAt: string;
  encrypted: boolean;
  checksum: string;
  salt?: string;
  iv?: string;
  kdfIterations?: number;
  cipherChecksum?: string;
  payload: unknown;
}

export type ParseImportEnvelopeResult =
  | { ok: true; envelope: SaveExportEnvelope }
  | { ok: false; error: SaveExportError };

export type DecryptEnvelopeResult =
  | { ok: true; state: unknown }
  | { ok: false; error: SaveExportError };

export interface SavePreviewSummary {
  pilotName: string;
  activeGearId: MechClassId;
  activeGearLevel: number;
  ownedGearsCount: number;
  credits: number;
  warPoints: number;
  totalWins: number;
  capturedSectorsCount: number;
  totalSectorsCount: number;
  campaignMonth: number;
}

export interface BuildExportOptions {
  saveVersion?: number;
  exportedAt?: string;
}

const PIN_REGEX = /^\d{4,8}$/;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

export function isValidSavePin(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

export function formatSaveExportFilename(date: Date = new Date()): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `dream-ace-save-${yyyy}${mm}${dd}-${hh}${min}.json`;
}

/**
 * Deterministic JSON serialization with sorted object keys so SHA-256 checksums
 * remain invariant across whitespace formatting and key ordering.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) =>
      item === undefined || typeof item === 'function' || typeof item === 'symbol'
        ? 'null'
        : canonicalJsonStringify(item)
    );
    return `[${items.join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => {
      const v = obj[k];
      return v !== undefined && typeof v !== 'function' && typeof v !== 'symbol';
    })
    .sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`
  );
  return `{${parts.join(',')}}`;
}

function getWebCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle || typeof c.getRandomValues !== 'function') {
    throw new SaveExportException(
      'UNSUPPORTED_CRYPTO',
      'Web Crypto API (SubtleCrypto) is required for save export/import.'
    );
  }
  return c;
}

function normalizeJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const cryptoApi = getWebCrypto();
  const encoded = new TextEncoder().encode(text);
  const digest = await cryptoApi.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function derivePbkdf2KeyBits(
  pin: string,
  salt: Uint8Array,
  iterations: number = SAVE_PBKDF2_ITERATIONS
): Promise<Uint8Array> {
  const cryptoApi = getWebCrypto();
  const pinBytes = new TextEncoder().encode(pin);
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    pinBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  // Copy salt into a fresh ArrayBuffer-backed Uint8Array for strict TS / cross-realm safety
  const cleanSalt = new Uint8Array(salt);
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: cleanSalt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function deriveAesGcmKey(
  pin: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const cryptoApi = getWebCrypto();
  const keyBits = await derivePbkdf2KeyBits(pin, salt, iterations);
  return cryptoApi.subtle.importKey(
    'raw',
    new Uint8Array(keyBits),
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    usage
  );
}

export function isValidSavePayloadShape(
  rawState: unknown,
  saveVersion: number
): boolean {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return false;
  }
  const obj = rawState as Record<string, unknown>;
  if (saveVersion >= 4) {
    return Boolean(
      obj.pilot &&
        typeof obj.pilot === 'object' &&
        !Array.isArray(obj.pilot)
    );
  }
  return Boolean(
    obj.player &&
      typeof obj.player === 'object' &&
      !Array.isArray(obj.player)
  );
}

/**
 * Builds a portable Dream Ace save envelope.
 * - Without PIN: plain JSON payload + SHA-256 checksum.
 * - With PIN (4-8 digits): AES-GCM ciphertext derived via PBKDF2 (random salt + IV),
 *   plus plaintext SHA-256 checksum and ciphertext integrity hash.
 */
export async function buildExportEnvelope(
  state: unknown,
  pin?: string,
  options?: BuildExportOptions
): Promise<SaveExportEnvelope> {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new SaveExportException(
      'CORRUPT',
      'Save state must be a plain JSON object.'
    );
  }

  const trimmedPin = typeof pin === 'string' ? pin.trim() : '';
  const useEncryption = trimmedPin.length > 0;
  if (useEncryption && !isValidSavePin(trimmedPin)) {
    throw new SaveExportException(
      'INVALID_PIN',
      'PIN must be 4 to 8 numeric digits.'
    );
  }

  const normalizedState = normalizeJsonValue(state);
  const canonicalPlaintext = canonicalJsonStringify(normalizedState);
  const checksum = await sha256Hex(canonicalPlaintext);
  const saveVersion =
    typeof options?.saveVersion === 'number' &&
    Number.isInteger(options.saveVersion) &&
    options.saveVersion >= 1
      ? options.saveVersion
      : CURRENT_SAVE_VERSION;
  const exportedAt =
    typeof options?.exportedAt === 'string' && options.exportedAt.length > 0
      ? options.exportedAt
      : new Date().toISOString();

  if (!useEncryption) {
    return {
      app: SAVE_EXPORT_APP_ID,
      saveVersion,
      exportedAt,
      encrypted: false,
      checksum,
      payload: normalizedState,
    };
  }

  const cryptoApi = getWebCrypto();
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  cryptoApi.getRandomValues(salt);
  cryptoApi.getRandomValues(iv);

  const key = await deriveAesGcmKey(
    trimmedPin,
    salt,
    SAVE_PBKDF2_ITERATIONS,
    ['encrypt']
  );
  const plaintextBytes = new TextEncoder().encode(canonicalPlaintext);
  const cipherBuffer = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    plaintextBytes
  );

  const saltB64 = bytesToBase64(salt);
  const ivB64 = bytesToBase64(iv);
  const payloadB64 = bytesToBase64(new Uint8Array(cipherBuffer));
  const cipherChecksum = await sha256Hex(`${saltB64}.${ivB64}.${payloadB64}`);

  return {
    app: SAVE_EXPORT_APP_ID,
    saveVersion,
    exportedAt,
    encrypted: true,
    checksum,
    salt: saltB64,
    iv: ivB64,
    kdfIterations: SAVE_PBKDF2_ITERATIONS,
    cipherChecksum,
    payload: payloadB64,
  };
}

/**
 * Parses and validates an imported save file string.
 * For unencrypted envelopes, also verifies the SHA-256 checksum immediately.
 * For encrypted envelopes, validates header fields and ciphertext integrity before PIN prompt.
 */
export async function parseImportEnvelope(
  text: string
): Promise<ParseImportEnvelopeResult> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Save file is empty or not valid JSON.',
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Save file contains invalid JSON.',
      },
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENVELOPE',
        message: 'Save file root must be an envelope object.',
      },
    };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.app !== SAVE_EXPORT_APP_ID) {
    return {
      ok: false,
      error: {
        code: 'WRONG_APP',
        message: `Unsupported save file app identifier: ${String(obj.app ?? 'missing')}.`,
      },
    };
  }

  if (
    typeof obj.saveVersion !== 'number' ||
    !Number.isInteger(obj.saveVersion) ||
    obj.saveVersion < 1
  ) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENVELOPE',
        message: 'Invalid or missing saveVersion in envelope.',
      },
    };
  }

  if (
    typeof obj.exportedAt !== 'string' ||
    obj.exportedAt.trim().length === 0 ||
    Number.isNaN(Date.parse(obj.exportedAt))
  ) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENVELOPE',
        message: 'Invalid or missing exportedAt timestamp in envelope.',
      },
    };
  }

  if (typeof obj.encrypted !== 'boolean') {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENVELOPE',
        message: 'Invalid or missing encrypted flag in envelope.',
      },
    };
  }

  if (typeof obj.checksum !== 'string' || obj.checksum.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENVELOPE',
        message: 'Missing SHA-256 checksum in save envelope.',
      },
    };
  }

  if (!obj.encrypted) {
    if (
      !obj.payload ||
      typeof obj.payload !== 'object' ||
      Array.isArray(obj.payload)
    ) {
      return {
        ok: false,
        error: {
          code: 'CORRUPT',
          message: 'Unencrypted save payload is corrupted.',
        },
      };
    }

    try {
      const expectedChecksum = await sha256Hex(
        canonicalJsonStringify(obj.payload)
      );
      if (obj.checksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
        return {
          ok: false,
          error: {
            code: 'CHECKSUM_MISMATCH',
            message: 'Save file checksum does not match payload.',
          },
        };
      }
    } catch (err) {
      if (err instanceof SaveExportException) {
        return {
          ok: false,
          error: { code: err.code, message: err.message },
        };
      }
      return {
        ok: false,
        error: { code: 'CORRUPT', message: 'Failed to verify save checksum.' },
      };
    }

    if (
      obj.saveVersion <= CURRENT_SAVE_VERSION &&
      !isValidSavePayloadShape(obj.payload, obj.saveVersion)
    ) {
      return {
        ok: false,
        error: {
          code: 'CORRUPT',
          message: 'Save payload is missing required pilot data.',
        },
      };
    }

    return {
      ok: true,
      envelope: {
        app: SAVE_EXPORT_APP_ID,
        saveVersion: obj.saveVersion,
        exportedAt: obj.exportedAt,
        encrypted: false,
        checksum: obj.checksum,
        payload: obj.payload,
      },
    };
  }

  // Encrypted envelope validation
  if (
    !SHA256_HEX_REGEX.test(obj.checksum) ||
    typeof obj.payload !== 'string' ||
    typeof obj.salt !== 'string' ||
    typeof obj.iv !== 'string'
  ) {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Encrypted save envelope is missing required fields.',
      },
    };
  }

  const saltBytes = base64ToBytes(obj.salt);
  const ivBytes = base64ToBytes(obj.iv);
  const cipherBytes = base64ToBytes(obj.payload);
  if (
    !saltBytes ||
    saltBytes.length < 8 ||
    !ivBytes ||
    ivBytes.length !== 12 ||
    !cipherBytes ||
    cipherBytes.length < 16
  ) {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Encrypted save contains malformed binary parameters.',
      },
    };
  }

  if (typeof obj.cipherChecksum === 'string') {
    try {
      const expectedCipherHash = await sha256Hex(
        `${obj.salt}.${obj.iv}.${obj.payload}`
      );
      if (
        obj.cipherChecksum.toLowerCase() !== expectedCipherHash.toLowerCase()
      ) {
        return {
          ok: false,
          error: {
            code: 'CORRUPT',
            message: 'Encrypted save payload failed integrity check.',
          },
        };
      }
    } catch (err) {
      if (err instanceof SaveExportException) {
        return {
          ok: false,
          error: { code: err.code, message: err.message },
        };
      }
      return {
        ok: false,
        error: { code: 'CORRUPT', message: 'Encrypted save integrity check failed.' },
      };
    }
  }

  const kdfIterations =
    typeof obj.kdfIterations === 'number' &&
    Number.isInteger(obj.kdfIterations) &&
    obj.kdfIterations >= 1000 &&
    obj.kdfIterations <= 5_000_000
      ? obj.kdfIterations
      : SAVE_PBKDF2_ITERATIONS;

  return {
    ok: true,
    envelope: {
      app: SAVE_EXPORT_APP_ID,
      saveVersion: obj.saveVersion,
      exportedAt: obj.exportedAt,
      encrypted: true,
      checksum: obj.checksum,
      salt: obj.salt,
      iv: obj.iv,
      kdfIterations,
      cipherChecksum:
        typeof obj.cipherChecksum === 'string' ? obj.cipherChecksum : undefined,
      payload: obj.payload,
    },
  };
}

/**
 * Decrypts (or verifies if unencrypted) an envelope and returns the validated state payload.
 */
export async function decryptEnvelope(
  envelope: SaveExportEnvelope,
  pin?: string
): Promise<DecryptEnvelopeResult> {
  if (!envelope || envelope.app !== SAVE_EXPORT_APP_ID) {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Invalid envelope passed to decryptEnvelope.',
      },
    };
  }

  if (!envelope.encrypted) {
    if (
      !envelope.payload ||
      typeof envelope.payload !== 'object' ||
      Array.isArray(envelope.payload)
    ) {
      return {
        ok: false,
        error: {
          code: 'CORRUPT',
          message: 'Unencrypted payload is corrupted.',
        },
      };
    }
    try {
      const expectedChecksum = await sha256Hex(
        canonicalJsonStringify(envelope.payload)
      );
      if (envelope.checksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
        return {
          ok: false,
          error: {
            code: 'CHECKSUM_MISMATCH',
            message: 'Save file checksum mismatch.',
          },
        };
      }
    } catch (err) {
      if (err instanceof SaveExportException) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      return {
        ok: false,
        error: { code: 'CORRUPT', message: 'Failed to verify checksum.' },
      };
    }
    if (
      envelope.saveVersion <= CURRENT_SAVE_VERSION &&
      !isValidSavePayloadShape(envelope.payload, envelope.saveVersion)
    ) {
      return {
        ok: false,
        error: {
          code: 'CORRUPT',
          message: 'Save payload is missing required pilot data.',
        },
      };
    }
    return { ok: true, state: normalizeJsonValue(envelope.payload) };
  }

  // Encrypted branch
  if (
    typeof envelope.payload !== 'string' ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.iv !== 'string'
  ) {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Encrypted envelope is missing cryptographic parameters.',
      },
    };
  }

  const saltBytes = base64ToBytes(envelope.salt);
  const ivBytes = base64ToBytes(envelope.iv);
  const cipherBytes = base64ToBytes(envelope.payload);
  if (
    !saltBytes ||
    saltBytes.length < 8 ||
    !ivBytes ||
    ivBytes.length !== 12 ||
    !cipherBytes ||
    cipherBytes.length < 16
  ) {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Encrypted envelope contains malformed cryptographic data.',
      },
    };
  }

  if (typeof envelope.cipherChecksum === 'string') {
    try {
      const expectedCipherHash = await sha256Hex(
        `${envelope.salt}.${envelope.iv}.${envelope.payload}`
      );
      if (
        envelope.cipherChecksum.toLowerCase() !==
        expectedCipherHash.toLowerCase()
      ) {
        return {
          ok: false,
          error: {
            code: 'CORRUPT',
            message: 'Encrypted save file was corrupted or truncated.',
          },
        };
      }
    } catch (err) {
      if (err instanceof SaveExportException) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      return {
        ok: false,
        error: { code: 'CORRUPT', message: 'Failed to verify ciphertext.' },
      };
    }
  }

  const trimmedPin = typeof pin === 'string' ? pin.trim() : '';
  if (!isValidSavePin(trimmedPin)) {
    return {
      ok: false,
      error: {
        code: 'WRONG_PIN',
        message: 'Incorrect PIN.',
      },
    };
  }

  let decryptedText: string;
  try {
    const cryptoApi = getWebCrypto();
    const iterations = envelope.kdfIterations ?? SAVE_PBKDF2_ITERATIONS;
    const key = await deriveAesGcmKey(trimmedPin, saltBytes, iterations, [
      'decrypt',
    ]);
    const plainBuffer = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBytes) },
      key,
      new Uint8Array(cipherBytes)
    );
    decryptedText = new TextDecoder().decode(plainBuffer);
  } catch (err) {
    if (err instanceof SaveExportException) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    return {
      ok: false,
      error: {
        code: 'WRONG_PIN',
        message: 'Incorrect PIN or unreadable save data.',
      },
    };
  }

  let decryptedState: unknown;
  try {
    decryptedState = JSON.parse(decryptedText);
  } catch {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Decrypted save payload is not valid JSON.',
      },
    };
  }

  if (
    !decryptedState ||
    typeof decryptedState !== 'object' ||
    Array.isArray(decryptedState)
  ) {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Decrypted save payload is not a valid object.',
      },
    };
  }

  try {
    const expectedChecksum = await sha256Hex(
      canonicalJsonStringify(decryptedState)
    );
    if (envelope.checksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
      return {
        ok: false,
        error: {
          code: 'CHECKSUM_MISMATCH',
          message: 'Decrypted save checksum mismatch.',
        },
      };
    }
  } catch (err) {
    if (err instanceof SaveExportException) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    return {
      ok: false,
      error: { code: 'CORRUPT', message: 'Failed to verify decrypted checksum.' },
    };
  }

  if (
    envelope.saveVersion <= CURRENT_SAVE_VERSION &&
    !isValidSavePayloadShape(decryptedState, envelope.saveVersion)
  ) {
    return {
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Decrypted save is missing pilot campaign data.',
      },
    };
  }

  return { ok: true, state: decryptedState };
}

export function validateImportSaveVersion(
  saveVersion: number,
  currentVersion: number = CURRENT_SAVE_VERSION
): { ok: true } | { ok: false; error: SaveExportError } {
  if (saveVersion > currentVersion) {
    return {
      ok: false,
      error: {
        code: 'VERSION_TOO_NEW',
        message: `Save version ${saveVersion} is newer than supported version ${currentVersion}.`,
        foundVersion: saveVersion,
        supportedVersion: currentVersion,
      },
    };
  }
  return { ok: true };
}

/**
 * Summarizes an imported save state for the import confirmation dialog without mutating caller data.
 */
export function summarizeSaveStateForPreview(
  rawState: unknown,
  saveVersion: number
): SavePreviewSummary {
  const migrated: PersistedCampaignState = migrateSaveData(
    rawState,
    saveVersion
  );
  const pilot = migrated.pilot;
  const activeGear = pilot.gears[pilot.activeGearId];
  const ownedGearsCount = MECH_CLASS_LIST.filter(
    (c) => pilot.gears[c.id].owned
  ).length;
  const totalWins = MECH_CLASS_LIST.reduce(
    (sum, c) => sum + (pilot.gears[c.id].battlesWon ?? 0),
    0
  );

  return {
    pilotName: pilot.name || 'Vance',
    activeGearId: pilot.activeGearId,
    activeGearLevel: activeGear.level,
    ownedGearsCount,
    credits: pilot.credits,
    warPoints: pilot.warPoints ?? 0,
    totalWins,
    capturedSectorsCount: pilot.capturedSectorIds.length,
    totalSectorsCount: getMapNodes().length,
    campaignMonth: pilot.campaignMonth ?? 1,
  };
}
