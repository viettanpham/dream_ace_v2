import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_EQUIPPED_SLOT_IDS, EQUIPMENT_SLOTS } from '../../data/items';
import { setFirebaseConfigOverrideForTests } from '../../lib/firebase';
import { generateItemInstance } from '../equipment';
import { CURRENT_SAVE_VERSION } from '../migration';
import {
  CLOUD_CHUNK_THRESHOLD_BYTES,
  CROCKFORD_BASE32_ALPHABET,
  downloadCloudSave,
  formatSaveId,
  generateSaveId,
  isGzipSupported,
  isValidSaveId,
  normalizeSaveId,
  uploadCloudSave,
} from '../cloudSave';
import {
  InMemoryCloudStore,
  isCloudConfigured,
  type CloudStoreAdapter,
} from '../cloudStore';
import { createDefaultPilotAccount } from '../stats';

function buildCampaignSnapshot(
  pilotName = 'Astra',
  credits = 12345,
  warPoints = 456
) {
  const pilot = createDefaultPilotAccount(pilotName, 'striker');
  pilot.credits = credits;
  pilot.warPoints = warPoints;
  return {
    pilot,
    shopStock: [],
    wpMarketOffers: [],
    battlesUntilRestock: 3,
    hasSaveData: true,
    muted: false,
    battleSpeed: 2,
    skipAnimations: false,
    battleViewMode: 'card',
    language: 'vi',
  };
}

function makeIncompressibleString(byteLength: number, seed = 0x13579bdf): string {
  // Deterministic xorshift32 -> printable ASCII (no JSON escaping overhead)
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let state = seed >>> 0;
  const chars = new Array<string>(byteLength);
  for (let i = 0; i < byteLength; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    chars[i] = alphabet[state & 63];
  }
  return chars.join('');
}

afterEach(() => {
  setFirebaseConfigOverrideForTests(undefined);
});

describe('SV1b-1 — Cloud Save Core (no network, mock adapter)', () => {
  it('generates 10-char Crockford Base32 Save IDs (XXXXX-XXXXX, no I/L/O/U) and normalizes user input', () => {
    const forbidden = /[ILOU]/;
    const allowedSet = new Set(CROCKFORD_BASE32_ALPHABET.split(''));
    expect(CROCKFORD_BASE32_ALPHABET).toHaveLength(32);
    expect(forbidden.test(CROCKFORD_BASE32_ALPHABET)).toBe(false);

    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const id = generateSaveId();
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
      const raw = id.replace('-', '');
      expect(raw).toHaveLength(10);
      expect(forbidden.test(raw)).toBe(false);
      for (const ch of raw) {
        expect(allowedSet.has(ch)).toBe(true);
      }
      seen.add(id);
    }
    expect(seen.size).toBeGreaterThan(190);

    // Normalization handles lowercase, spaces, dashes
    expect(normalizeSaveId('a1b2c-3d4e5')).toBe('A1B2C3D4E5');
    expect(normalizeSaveId('  a1b2c   3d4e5  ')).toBe('A1B2C3D4E5');
    expect(normalizeSaveId('A1-B2-C3-D4-E5')).toBe('A1B2C3D4E5');
    expect(formatSaveId('a1b2c 3d4e5')).toBe('A1B2C-3D4E5');
    expect(isValidSaveId('a1b2c-3d4e5')).toBe(true);

    // Rejects forbidden letters I, L, O, U and wrong lengths
    expect(normalizeSaveId('A1B2I-3D4E5')).toBeNull();
    expect(normalizeSaveId('A1B2L-3D4E5')).toBeNull();
    expect(normalizeSaveId('A1B2O-3D4E5')).toBeNull();
    expect(normalizeSaveId('A1B2U-3D4E5')).toBeNull();
    expect(normalizeSaveId('A1B2C-3D4E')).toBeNull();
    expect(normalizeSaveId('A1B2C-3D4E56')).toBeNull();
    expect(isValidSaveId('INVALID-ID!')).toBe(false);
  });

  it('encrypts, uploads, downloads, decrypts, and runs SV1a migration round trip', async () => {
    const store = new InMemoryCloudStore({
      now: () => '2026-11-20T10:00:00.000Z',
    });
    const saveId = generateSaveId();
    const rawId = normalizeSaveId(saveId)!;
    const snapshot = buildCampaignSnapshot('Kaelen', 88420, 912);

    const up = await uploadCloudSave({
      saveId: saveId.toLowerCase().replace('-', ' '),
      pin: '135790',
      state: snapshot,
      lastKnownRev: 0,
      adapter: store,
      clientUpdatedAt: '2026-11-20T09:59:59.000Z',
      gameVersion: 'test-1.0.0',
    });

    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.saveId).toBe(saveId);
    expect(up.rawSaveId).toBe(rawId);
    expect(up.rev).toBe(1);
    expect(up.chunkCount).toBe(0);
    expect(store.transactionCount).toBe(1);

    const storedDoc = await store.getSave(rawId);
    expect(storedDoc).not.toBeNull();
    if (!storedDoc) return;
    expect(storedDoc.schemaVersion).toBe(CURRENT_SAVE_VERSION);
    expect(storedDoc.rev).toBe(1);
    expect(storedDoc.updatedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(storedDoc.clientUpdatedAt).toBe('2026-11-20T09:59:59.000Z');
    expect(storedDoc.verifier.length).toBeGreaterThanOrEqual(40);
    expect(storedDoc.salt.length).toBeGreaterThanOrEqual(20);
    expect(storedDoc.iv.length).toBeGreaterThanOrEqual(16);
    expect(storedDoc.payload.length).toBeGreaterThan(0);
    expect(storedDoc.payload).not.toContain('Kaelen');
    expect(storedDoc.compressed).toBe(isGzipSupported());
    expect(storedDoc.sizeBytes).toBeGreaterThan(0);
    expect(storedDoc.gameVersion).toBe('test-1.0.0');
    expect(storedDoc.chunkCount).toBe(0);

    const down = await downloadCloudSave({
      saveId: `  ${saveId.toLowerCase()}  `,
      pin: '135790',
      adapter: store,
    });
    expect(down.ok).toBe(true);
    if (!down.ok) return;
    expect(down.saveId).toBe(saveId);
    expect(down.rev).toBe(1);
    expect(down.schemaVersion).toBe(CURRENT_SAVE_VERSION);
    expect(down.migratedState.pilot.name).toBe('Kaelen');
    expect(down.migratedState.pilot.credits).toBe(88420);
    expect(down.migratedState.pilot.warPoints).toBe(912);
    expect(down.preview.pilotName).toBe('Kaelen');
    expect(down.preview.credits).toBe(88420);

    // Also verify SV1a migration path runs for an older v8 cloud save
    const v8SaveId = generateSaveId();
    const v8RawId = normalizeSaveId(v8SaveId)!;
    const v8State = buildCampaignSnapshot('OldPilot', 5000, 100);
    const customWeapon = generateItemInstance(
      {
        templateId: 'tpl_mw_railgun',
        slot: 'main_weapon',
        tier: 2,
        rarity: 'epic',
        requiredLevel: 1,
        rollQuality: 85,
      },
      () => 0.5
    );
    customWeapon.instanceId = 'cloud_v8_railgun';
    v8State.pilot.inventory = [customWeapon];
    v8State.pilot.gears.striker.equipped = {
      ...EMPTY_EQUIPPED_SLOT_IDS,
      main_weapon: customWeapon.instanceId,
    };

    const upV8 = await uploadCloudSave({
      saveId: v8SaveId,
      pin: '4321',
      state: v8State,
      lastKnownRev: 0,
      adapter: store,
    });
    expect(upV8.ok).toBe(true);
    // Simulate that the stored doc was originally uploaded under schemaVersion 8
    const docV8 = (await store.getSave(v8RawId))!;
    store.seedRawSave(v8RawId, { ...docV8, schemaVersion: 8 });

    const downV8 = await downloadCloudSave({
      saveId: v8SaveId,
      pin: '4321',
      adapter: store,
    });
    expect(downV8.ok).toBe(true);
    if (!downV8.ok) return;
    expect(downV8.schemaVersion).toBe(8);
    expect(downV8.migratedState.pilot.gears.striker.equipped.main_weapon).toBe(
      'cloud_v8_railgun'
    );
    // v8 -> current migration fills missing starter slots on active gear (radar stays null by default)
    for (const slot of EQUIPMENT_SLOTS) {
      if (slot === 'radar') {
        expect(downV8.migratedState.pilot.gears.striker.equipped[slot]).toBeNull();
      } else {
        expect(downV8.migratedState.pilot.gears.striker.equipped[slot]).toBeTruthy();
      }
    }
  });

  it('returns "Sai PIN" on wrong PIN with no partial load and without fetching chunks', async () => {
    const store = new InMemoryCloudStore();
    const getChunksSpy = vi.spyOn(store, 'getChunks');
    const saveId = generateSaveId();
    const snapshot = buildCampaignSnapshot('Lyra', 9999, 50);

    const up = await uploadCloudSave({
      saveId,
      pin: '2468',
      state: snapshot,
      lastKnownRev: 0,
      adapter: store,
    });
    expect(up.ok).toBe(true);

    const wrongDownload = await downloadCloudSave({
      saveId,
      pin: '9999',
      adapter: store,
    });
    expect(wrongDownload.ok).toBe(false);
    if (!wrongDownload.ok) {
      expect(wrongDownload.error.code).toBe('WRONG_PIN');
      expect(wrongDownload.error.message).toBe('Sai PIN');
    }
    expect('migratedState' in wrongDownload).toBe(false);
    expect('rawState' in wrongDownload).toBe(false);
    expect(getChunksSpy).not.toHaveBeenCalled();

    // Wrong PIN on upload update is also rejected cleanly without overwriting
    const wrongUpload = await uploadCloudSave({
      saveId,
      pin: '9999',
      state: buildCampaignSnapshot('Intruder', 0, 0),
      lastKnownRev: 1,
      adapter: store,
    });
    expect(wrongUpload.ok).toBe(false);
    if (!wrongUpload.ok && !wrongUpload.conflict) {
      expect(wrongUpload.error.code).toBe('WRONG_PIN');
      expect(wrongUpload.error.message).toBe('Sai PIN');
    }
    expect(store.transactionCount).toBe(1);
  });

  it('generates a fresh random IV on every upload while keeping verifier and salt stable', async () => {
    const store = new InMemoryCloudStore();
    const saveId = generateSaveId();
    const rawId = normalizeSaveId(saveId)!;
    const state1 = buildCampaignSnapshot('Marek', 1000, 10);
    const state2 = buildCampaignSnapshot('Marek', 2000, 20);

    const up1 = await uploadCloudSave({
      saveId,
      pin: '778899',
      state: state1,
      lastKnownRev: 0,
      adapter: store,
    });
    expect(up1.ok).toBe(true);
    if (!up1.ok) return;
    const doc1 = (await store.getSave(rawId))!;

    const up2 = await uploadCloudSave({
      saveId,
      pin: '778899',
      state: state2,
      lastKnownRev: 1,
      adapter: store,
    });
    expect(up2.ok).toBe(true);
    if (!up2.ok) return;
    const doc2 = (await store.getSave(rawId))!;

    expect(up2.rev).toBe(2);
    expect(doc2.rev).toBe(2);
    expect(doc2.iv).not.toBe(doc1.iv);
    expect(up2.iv).not.toBe(up1.iv);
    expect(doc2.salt).toBe(doc1.salt);
    expect(doc2.verifier).toBe(doc1.verifier);

    const down = await downloadCloudSave({
      saveId,
      pin: '778899',
      adapter: store,
    });
    expect(down.ok).toBe(true);
    if (!down.ok) return;
    expect(down.rev).toBe(2);
    expect(down.migratedState.pilot.credits).toBe(2000);
  });

  it('gzip-compresses and chunks payloads > 900 KB in ONE transaction and round-trips cleanly', async () => {
    expect(isGzipSupported()).toBe(true);

    const store = new InMemoryCloudStore();
    const saveId = generateSaveId();
    const rawId = normalizeSaveId(saveId)!;
    const bigSnapshot = buildCampaignSnapshot('HeavyPilot', 55555, 777);

    // Attach ~1.05 MB of high-entropy incompressible data inside a valid inventory item's instanceId
    // so compressed + encrypted base64 ciphertext exceeds CLOUD_CHUNK_THRESHOLD_BYTES (900 KB).
    const hugeBlob = makeIncompressibleString(1_050_000, 0xdeadbeef);
    const markerItem = generateItemInstance(
      {
        templateId: 'tpl_mw_railgun',
        slot: 'main_weapon',
        tier: 2,
        rarity: 'epic',
        requiredLevel: 1,
        rollQuality: 90,
      },
      () => 0.5
    );
    const markerId = `chunk_marker_${hugeBlob}`;
    markerItem.instanceId = markerId;
    bigSnapshot.pilot.inventory.push(markerItem);

    const up = await uploadCloudSave({
      saveId,
      pin: '56789',
      state: bigSnapshot,
      lastKnownRev: 0,
      adapter: store,
    });

    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.compressed).toBe(true);
    expect(up.sizeBytes).toBeGreaterThan(CLOUD_CHUNK_THRESHOLD_BYTES);
    expect(up.chunkCount).toBeGreaterThanOrEqual(2);
    // Parent + all chunks committed in ONE atomic transaction
    expect(store.transactionCount).toBe(1);

    const storedParent = (await store.getSave(rawId))!;
    expect(storedParent.compressed).toBe(true);
    expect(storedParent.payload).toBe('');
    expect(storedParent.chunkCount).toBe(up.chunkCount);

    const storedChunks = await store.getChunks(rawId, storedParent.chunkCount);
    expect(storedChunks).toHaveLength(up.chunkCount);
    let totalCipherChars = 0;
    for (let i = 0; i < storedChunks.length; i++) {
      expect(storedChunks[i].index).toBe(i);
      expect(storedChunks[i].parentRev).toBe(1);
      totalCipherChars += storedChunks[i].data.length;
    }
    expect(totalCipherChars).toBeGreaterThan(CLOUD_CHUNK_THRESHOLD_BYTES);

    const down = await downloadCloudSave({
      saveId,
      pin: '56789',
      adapter: store,
    });
    expect(down.ok).toBe(true);
    if (!down.ok) return;
    expect(down.compressed).toBe(true);
    expect(down.chunkCount).toBe(up.chunkCount);
    expect(down.migratedState.pilot.name).toBe('HeavyPilot');
    const restoredItem = down.migratedState.pilot.inventory.find((it) =>
      it.instanceId.startsWith('chunk_marker_')
    );
    expect(restoredItem).toBeDefined();
    expect(restoredItem?.instanceId.length).toBe(markerId.length);
    expect(restoredItem?.instanceId === markerId).toBe(true);
  });

  it('returns conflict when remote rev is higher and never silently overwrites', async () => {
    let clockTick = 0;
    const timestamps = [
      '2026-11-20T10:00:00.000Z',
      '2026-11-20T10:05:00.000Z',
    ];
    const store = new InMemoryCloudStore({
      now: () => timestamps[Math.min(clockTick++, timestamps.length - 1)],
    });
    const saveId = generateSaveId();

    const up1 = await uploadCloudSave({
      saveId,
      pin: '1234',
      state: buildCampaignSnapshot('DeviceA', 100, 1),
      lastKnownRev: 0,
      adapter: store,
    });
    expect(up1.ok).toBe(true);

    // Device B advances remote to rev 2
    const up2 = await uploadCloudSave({
      saveId,
      pin: '1234',
      state: buildCampaignSnapshot('DeviceB', 900, 9),
      lastKnownRev: 1,
      adapter: store,
    });
    expect(up2.ok).toBe(true);
    expect(store.transactionCount).toBe(2);

    // Device A tries to upload with stale lastKnownRev = 1 -> conflict!
    const staleUp = await uploadCloudSave({
      saveId,
      pin: '1234',
      state: buildCampaignSnapshot('StaleDeviceA', 150, 2),
      lastKnownRev: 1,
      adapter: store,
    });
    expect(staleUp.ok).toBe(false);
    if (!staleUp.ok) {
      expect(staleUp.conflict).toBe(true);
      if (staleUp.conflict) {
        expect(staleUp.remoteRev).toBe(2);
        expect(staleUp.remoteUpdatedAt).toBe('2026-11-20T10:05:00.000Z');
      }
    }
    // No write occurred
    expect(store.transactionCount).toBe(2);

    // Verify remote data is still DeviceB (not overwritten)
    const down = await downloadCloudSave({
      saveId,
      pin: '1234',
      adapter: store,
    });
    expect(down.ok).toBe(true);
    if (!down.ok) return;
    expect(down.rev).toBe(2);
    expect(down.migratedState.pilot.name).toBe('DeviceB');
    expect(down.migratedState.pilot.credits).toBe(900);
  });

  it('refuses saves with schemaVersion > CURRENT_SAVE_VERSION', async () => {
    const store = new InMemoryCloudStore();
    const saveId = generateSaveId();
    const rawId = normalizeSaveId(saveId)!;

    const up = await uploadCloudSave({
      saveId,
      pin: '1122',
      state: buildCampaignSnapshot('FuturePilot', 3333, 33),
      lastKnownRev: 0,
      adapter: store,
    });
    expect(up.ok).toBe(true);

    const existing = (await store.getSave(rawId))!;
    store.seedRawSave(rawId, {
      ...existing,
      schemaVersion: CURRENT_SAVE_VERSION + 1,
    });

    const down = await downloadCloudSave({
      saveId,
      pin: '1122',
      adapter: store,
    });
    expect(down.ok).toBe(false);
    if (!down.ok) {
      expect(down.error.code).toBe('VERSION_TOO_NEW');
      expect(down.error.foundVersion).toBe(CURRENT_SAVE_VERSION + 1);
      expect(down.error.supportedVersion).toBe(CURRENT_SAVE_VERSION);
    }
  });

  it('returns false from isCloudConfigured() without throwing when config is missing or adapter fails', async () => {
    // 1. Missing Firebase config override
    setFirebaseConfigOverrideForTests(null);
    expect(() => isCloudConfigured()).not.toThrow();
    expect(isCloudConfigured()).toBe(false);

    // 2. Placeholder/incomplete Firebase config override
    setFirebaseConfigOverrideForTests({
      projectId: 'TODO-project-id',
      appId: '',
      apiKey: '',
    });
    expect(() => isCloudConfigured()).not.toThrow();
    expect(isCloudConfigured()).toBe(false);

    // 3. Throwing custom adapter is safely caught
    const brokenAdapter: CloudStoreAdapter = {
      isConfigured() {
        throw new Error('broken config');
      },
      async getSave() {
        return null;
      },
      async commitSave() {
        return {
          ok: false,
          conflict: false,
          code: 'CLOUD_NOT_CONFIGURED',
          message: 'offline',
        };
      },
      async getChunks() {
        return [];
      },
    };
    expect(() => isCloudConfigured(brokenAdapter)).not.toThrow();
    expect(isCloudConfigured(brokenAdapter)).toBe(false);

    // 4. Unconfigured mock adapter returns clean CLOUD_NOT_CONFIGURED results without throwing
    const offlineStore = new InMemoryCloudStore({ configured: false });
    expect(isCloudConfigured(offlineStore)).toBe(false);

    const saveId = generateSaveId();
    const up = await uploadCloudSave({
      saveId,
      pin: '1234',
      state: buildCampaignSnapshot('OfflinePilot', 500, 5),
      lastKnownRev: 0,
      adapter: offlineStore,
    });
    expect(up.ok).toBe(false);
    if (!up.ok && !up.conflict) {
      expect(up.error.code).toBe('CLOUD_NOT_CONFIGURED');
    }

    const down = await downloadCloudSave({
      saveId,
      pin: '1234',
      adapter: offlineStore,
    });
    expect(down.ok).toBe(false);
    if (!down.ok) {
      expect(down.error.code).toBe('CLOUD_NOT_CONFIGURED');
    }
  });
});
