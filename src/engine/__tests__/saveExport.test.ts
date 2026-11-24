// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_EQUIPPED_SLOT_IDS, EQUIPMENT_SLOTS } from '../../data/items';
import { generateItemInstance } from '../equipment';
import { CURRENT_SAVE_VERSION } from '../migration';
import {
  buildExportEnvelope,
  decryptEnvelope,
  formatSaveExportFilename,
  parseImportEnvelope,
  SAVE_EXPORT_APP_ID,
  SAVE_IMPORT_BACKUP_STORAGE_KEY,
  summarizeSaveStateForPreview,
  validateImportSaveVersion,
} from '../saveExport';
import { createDefaultPilotAccount } from '../stats';
import { useGameStore } from '../../store/useGameStore';

function buildV8Fixture() {
  const pilot = createDefaultPilotAccount('Veteran', 'striker');
  // Equip one custom non-starter weapon in main_weapon; leave the other 5 slots empty!
  const customWeapon = generateItemInstance(
    {
      templateId: 'tpl_mw_railgun',
      slot: 'main_weapon',
      tier: 2,
      rarity: 'epic',
      requiredLevel: 1,
      rollQuality: 88,
    },
    () => 0.5
  );
  customWeapon.instanceId = 'v8_custom_railgun';
  pilot.inventory = [customWeapon];
  pilot.gears.striker.equipped = {
    ...EMPTY_EQUIPPED_SLOT_IDS,
    main_weapon: customWeapon.instanceId,
  };
  pilot.credits = 7777;
  pilot.warPoints = 321;

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

describe('SV1a — Save Export / Import Engine & Store Backup/Undo', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetCampaign();
  });

  it('formats export filename as dream-ace-save-YYYYMMDD-HHmm.json', () => {
    const dt = new Date(2026, 3, 5, 9, 7, 42); // Apr 5, 2026 09:07
    expect(formatSaveExportFilename(dt)).toBe('dream-ace-save-20260405-0907.json');
  });

  it('round-trips unencrypted envelope with SHA-256 checksum', async () => {
    useGameStore.getState().startCampaign('Nova', 'interceptor');
    useGameStore.getState().adminSetCredits(4250);
    const snapshot = useGameStore.getState().exportSaveStateSnapshot();

    const envelope = await buildExportEnvelope(snapshot);
    expect(envelope.app).toBe(SAVE_EXPORT_APP_ID);
    expect(envelope.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(envelope.encrypted).toBe(false);
    expect(envelope.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(typeof envelope.exportedAt).toBe('string');

    const serialized = JSON.stringify(envelope, null, 2);
    const parsed = await parseImportEnvelope(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const decrypted = await decryptEnvelope(parsed.envelope);
    expect(decrypted.ok).toBe(true);
    if (!decrypted.ok) return;

    expect((decrypted.state as typeof snapshot).pilot.name).toBe('Nova');
    expect((decrypted.state as typeof snapshot).pilot.credits).toBe(4250);
  });

  it('round-trips encrypted envelope with PBKDF2 + AES-GCM (4-8 digit PIN) and rejects wrong PIN', async () => {
    useGameStore.getState().startCampaign('Vega', 'siege');
    useGameStore.getState().adminSetCredits(9876);
    const snapshot = useGameStore.getState().exportSaveStateSnapshot();

    const envelope = await buildExportEnvelope(snapshot, '246810');
    expect(envelope.encrypted).toBe(true);
    expect(typeof envelope.payload).toBe('string');
    expect(typeof envelope.salt).toBe('string');
    expect(typeof envelope.iv).toBe('string');
    expect(envelope.checksum).toMatch(/^[a-f0-9]{64}$/);

    const serialized = JSON.stringify(envelope);
    const parsed = await parseImportEnvelope(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const wrongRes = await decryptEnvelope(parsed.envelope, '000000');
    expect(wrongRes.ok).toBe(false);
    if (!wrongRes.ok) {
      expect(wrongRes.error.code).toBe('WRONG_PIN');
    }

    const okRes = await decryptEnvelope(parsed.envelope, '246810');
    expect(okRes.ok).toBe(true);
    if (!okRes.ok) return;
    expect((okRes.state as typeof snapshot).pilot.name).toBe('Vega');
    expect((okRes.state as typeof snapshot).pilot.credits).toBe(9876);

    // Invalid PIN formats fail at export time
    await expect(buildExportEnvelope(snapshot, '123')).rejects.toThrow();
    await expect(buildExportEnvelope(snapshot, 'abcd')).rejects.toThrow();
  });

  it('rejects invalid JSON, wrong app, checksum mismatch, and corrupted encrypted payload', async () => {
    const parsedInvalidJson = await parseImportEnvelope('{broken json');
    expect(parsedInvalidJson.ok).toBe(false);
    if (!parsedInvalidJson.ok) {
      expect(parsedInvalidJson.error.code).toBe('INVALID_JSON');
    }

    useGameStore.getState().startCampaign('Orion', 'support');
    const snapshot = useGameStore.getState().exportSaveStateSnapshot();

    // Wrong app
    const plainEnv = await buildExportEnvelope(snapshot);
    const wrongAppText = JSON.stringify({ ...plainEnv, app: 'other-game' });
    const wrongAppRes = await parseImportEnvelope(wrongAppText);
    expect(wrongAppRes.ok).toBe(false);
    if (!wrongAppRes.ok) {
      expect(wrongAppRes.error.code).toBe('WRONG_APP');
    }

    // Checksum mismatch (tampered credits)
    const tamperedPlain = structuredClone(plainEnv) as typeof plainEnv & {
      payload: typeof snapshot;
    };
    tamperedPlain.payload.pilot.credits = 999999;
    const mismatchRes = await parseImportEnvelope(JSON.stringify(tamperedPlain));
    expect(mismatchRes.ok).toBe(false);
    if (!mismatchRes.ok) {
      expect(mismatchRes.error.code).toBe('CHECKSUM_MISMATCH');
    }

    // Corrupted encrypted payload
    const encEnv = await buildExportEnvelope(snapshot, '1357');
    const badCipher = {
      ...encEnv,
      payload: 'AAAA' + String(encEnv.payload).slice(4),
    };
    const corruptParse = await parseImportEnvelope(JSON.stringify(badCipher));
    expect(corruptParse.ok).toBe(false);
    if (!corruptParse.ok) {
      expect(corruptParse.error.code).toBe('CORRUPT');
    }

    // Even calling decryptEnvelope directly on corrupted envelope returns CORRUPT
    const directCorrupt = await decryptEnvelope(badCipher, '1357');
    expect(directCorrupt.ok).toBe(false);
    if (!directCorrupt.ok) {
      expect(directCorrupt.error.code).toBe('CORRUPT');
    }
  });

  it('migrates version-8 fixture filling only empty starter slots, and refuses version-10 fixture', async () => {
    useGameStore.getState().startCampaign('CurrentPilot', 'striker');
    useGameStore.getState().adminSetCredits(1500);

    // Version 8 fixture
    const v8State = buildV8Fixture();
    const v8Env = await buildExportEnvelope(v8State, undefined, {
      saveVersion: 8,
      exportedAt: '2026-10-01T12:00:00.000Z',
    });
    const parsedV8 = await parseImportEnvelope(JSON.stringify(v8Env));
    expect(parsedV8.ok).toBe(true);
    if (!parsedV8.ok) return;

    const preview = summarizeSaveStateForPreview(
      parsedV8.envelope.payload,
      parsedV8.envelope.saveVersion
    );
    expect(preview.pilotName).toBe('Veteran');
    expect(preview.credits).toBe(7777);

    const importV8 = useGameStore
      .getState()
      .importSaveFromEnvelope(parsedV8.envelope.payload, parsedV8.envelope.saveVersion);
    expect(importV8.ok).toBe(true);

    const afterV8 = useGameStore.getState();
    expect(afterV8.pilot.name).toBe('Veteran');
    expect(afterV8.pilot.credits).toBe(7777);
    // Custom weapon in main_weapon must NOT be overwritten
    expect(afterV8.pilot.gears.striker.equipped.main_weapon).toBe('v8_custom_railgun');
    // The other 5 empty starter-configured slots must be filled with Starter items; radar stays null
    for (const slot of EQUIPMENT_SLOTS) {
      if (slot === 'main_weapon') continue;
      const eqId = afterV8.pilot.gears.striker.equipped[slot];
      if (slot === 'radar') {
        expect(eqId).toBeNull();
        continue;
      }
      expect(eqId).not.toBeNull();
      const item = afterV8.pilot.inventory.find((i) => i.instanceId === eqId);
      expect(item?.isStarter).toBe(true);
    }

    // Version 10 fixture (> CURRENT_SAVE_VERSION = 9) must be refused
    const v10Env = await buildExportEnvelope(v8State, undefined, {
      saveVersion: CURRENT_SAVE_VERSION + 1,
    });
    const parsedV10 = await parseImportEnvelope(JSON.stringify(v10Env));
    expect(parsedV10.ok).toBe(true);
    if (!parsedV10.ok) return;

    const verCheck = validateImportSaveVersion(parsedV10.envelope.saveVersion);
    expect(verCheck.ok).toBe(false);
    if (!verCheck.ok) {
      expect(verCheck.error.code).toBe('VERSION_TOO_NEW');
    }

    const importV10 = useGameStore
      .getState()
      .importSaveFromEnvelope(parsedV10.envelope.payload, CURRENT_SAVE_VERSION + 1);
    expect(importV10.ok).toBe(false);
    if (!importV10.ok) {
      expect(importV10.code).toBe('VERSION_TOO_NEW');
    }
    // Current save untouched
    expect(useGameStore.getState().pilot.name).toBe('Veteran');
    expect(useGameStore.getState().pilot.credits).toBe(7777);
  });

  it('keeps current save untouched on failed import, writes one-time backup under separate localStorage key, restores on undo, and blocks during active battle', async () => {
    useGameStore.getState().startCampaign('OriginalAce', 'striker');
    useGameStore.getState().adminSetCredits(3333);

    // Failed import (missing pilot data -> CORRUPT)
    const badImport = useGameStore.getState().importSaveFromEnvelope({ bad: true }, 9);
    expect(badImport.ok).toBe(false);
    expect(useGameStore.getState().pilot.name).toBe('OriginalAce');
    expect(useGameStore.getState().pilot.credits).toBe(3333);
    expect(localStorage.getItem(SAVE_IMPORT_BACKUP_STORAGE_KEY)).toBeNull();

    // Valid import overwrites save and writes backup
    const incomingPilot = createDefaultPilotAccount('ImportedAce', 'interceptor');
    incomingPilot.credits = 8888;
    const incomingState = {
      ...useGameStore.getState().exportSaveStateSnapshot(),
      pilot: incomingPilot,
    };
    const okImport = useGameStore
      .getState()
      .importSaveFromEnvelope(incomingState, CURRENT_SAVE_VERSION);
    expect(okImport.ok).toBe(true);
    expect(useGameStore.getState().pilot.name).toBe('ImportedAce');
    expect(useGameStore.getState().pilot.credits).toBe(8888);
    expect(useGameStore.getState().hasImportBackup).toBe(true);

    const backupRaw = localStorage.getItem(SAVE_IMPORT_BACKUP_STORAGE_KEY);
    expect(backupRaw).not.toBeNull();
    expect(backupRaw).toContain('OriginalAce');

    // Undo restores OriginalAce and consumes one-time backup
    const undoRes = useGameStore.getState().undoSaveImport();
    expect(undoRes.ok).toBe(true);
    expect(useGameStore.getState().pilot.name).toBe('OriginalAce');
    expect(useGameStore.getState().pilot.credits).toBe(3333);
    expect(useGameStore.getState().hasImportBackup).toBe(false);
    expect(localStorage.getItem(SAVE_IMPORT_BACKUP_STORAGE_KEY)).toBeNull();

    // Second undo returns false
    const secondUndo = useGameStore.getState().undoSaveImport();
    expect(secondUndo.ok).toBe(false);

    // Active battle blocks import
    useGameStore.getState().startBattle('aegis_relay');
    const activeBattleImport = useGameStore
      .getState()
      .importSaveFromEnvelope(incomingState, CURRENT_SAVE_VERSION);
    expect(activeBattleImport.ok).toBe(false);
    if (!activeBattleImport.ok) {
      expect(activeBattleImport.code).toBe('BATTLE_ACTIVE');
    }
    expect(useGameStore.getState().pilot.name).toBe('OriginalAce');
  });
});
