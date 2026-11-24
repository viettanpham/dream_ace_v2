// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_EQUIPPED_SLOT_IDS, ITEM_TEMPLATES } from '../../data/items';
import { useGameStore } from '../../store/useGameStore';
import { generateItemInstance } from '../equipment';
import {
  createDefaultAdminConfig,
  createDefaultWorldClock,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  DEFAULT_WAREHOUSE_CAPACITY,
  MAX_WAREHOUSE_CAPACITY,
  MIN_WAREHOUSE_CAPACITY,
  migrateSaveData,
  sanitizeWarehouseCapacity,
  sanitizeWorldClock,
} from '../migration';
import {
  buildExportEnvelope,
  parseImportEnvelope,
  validateImportSaveVersion,
} from '../saveExport';
import { createDefaultPilotAccount } from '../stats';

function createDeterministicRng(seed = 101): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const TPL_WEAPON_A = ITEM_TEMPLATES.find((t) => t.slot === 'main_weapon')!.id;
const TPL_WEAPON_B =
  ITEM_TEMPLATES.filter((t) => t.slot === 'main_weapon')[1]?.id ?? TPL_WEAPON_A;
const TPL_ARMOR = ITEM_TEMPLATES.find((t) => t.slot === 'armor')!.id;
const TPL_ENGINE = ITEM_TEMPLATES.find((t) => t.slot === 'engine')!.id;

function makeItem(instanceId: string, templateId = TPL_WEAPON_A) {
  const item = generateItemInstance(
    {
      templateId,
      tier: 1,
      rarity: 'rare',
      requiredLevel: 1,
      rollQuality: 72,
    },
    createDeterministicRng(instanceId.length * 37 + 11)
  );
  return {
    ...item,
    instanceId,
    isStarter: false,
    locked: false,
    favorited: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

describe('W1a-1 — Save v10 (warehouse, warehouseCapacity, worldClock + migration)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().resetCampaign();
  });

  it('1) bumps CURRENT_SAVE_VERSION to 10 and includes defaults in createDefaultPilotAccount, createFreshCampaignState, and createDefaultAdminConfig', () => {
    expect(CURRENT_SAVE_VERSION).toBe(11);

    const defaultPilot = createDefaultPilotAccount('Ace', 'striker');
    expect(defaultPilot.warehouse).toEqual([]);
    expect(defaultPilot.worldClock).toEqual({
      worldDay: 0,
      lastTickAt: null,
      speedMode: 'normal',
      secondsPerDay: 180,
      paused: false,
    });

    const defaultAdmin = createDefaultAdminConfig();
    expect(defaultAdmin.warehouseCapacity).toBe(500);
    expect(defaultAdmin.warehouseCapacity).toBe(DEFAULT_WAREHOUSE_CAPACITY);

    const fresh = createFreshCampaignState(
      'Ace',
      'striker',
      createDeterministicRng()
    );
    expect(fresh.pilot.warehouse).toEqual([]);
    expect(fresh.pilot.worldClock).toEqual(createDefaultWorldClock());
    expect(fresh.adminConfig.warehouseCapacity).toBe(500);
  });

  it('2) migrates older saves (v9 and v8) to v10 with defaults and keeps v9 pilot.inventory identical', () => {
    const rng = createDeterministicRng(202);
    const invItemA = makeItem('inv_item_a', TPL_WEAPON_A);
    const invItemB = makeItem('inv_item_b', TPL_ARMOR);

    const v9Pilot = {
      ...createDefaultPilotAccount('LegacyV9', 'striker'),
      inventory: [invItemA, invItemB],
    } as Record<string, unknown>;
    delete v9Pilot.warehouse;
    delete v9Pilot.worldClock;
    // Deliberately keep striker slots empty to verify v9 -> v10 does NOT touch pilot.inventory
    (v9Pilot.gears as Record<string, { equipped: typeof EMPTY_EQUIPPED_SLOT_IDS }>).striker.equipped = {
      ...EMPTY_EQUIPPED_SLOT_IDS,
      main_weapon: invItemA.instanceId,
    };

    const v9Admin = { ...createDefaultAdminConfig() } as Record<string, unknown>;
    delete v9Admin.warehouseCapacity;

    const migratedV9 = migrateSaveData(
      {
        pilot: v9Pilot,
        adminConfig: v9Admin,
        hasSaveData: true,
      },
      9,
      rng
    );

    expect(migratedV9.pilot.inventory).toEqual([invItemA, invItemB]);
    expect(migratedV9.pilot.warehouse).toEqual([]);
    expect(migratedV9.pilot.worldClock).toEqual({
      worldDay: 0,
      lastTickAt: null,
      speedMode: 'normal',
      secondsPerDay: 180,
      paused: false,
    });
    expect(migratedV9.adminConfig.warehouseCapacity).toBe(500);

    // Even if an older save version had junk values for v10 fields, older version gets clean defaults
    const migratedV8 = migrateSaveData(
      {
        pilot: {
          ...v9Pilot,
          warehouse: [makeItem('should_not_keep_v8')],
          worldClock: {
            worldDay: 99,
            lastTickAt: 123456,
            speedMode: 'fast',
            secondsPerDay: 30,
            paused: true,
          },
        },
        adminConfig: {
          ...v9Admin,
          starterSet: { enabled: false },
          warehouseCapacity: 999,
        },
        hasSaveData: true,
      },
      8,
      rng
    );
    expect(migratedV8.pilot.inventory).toEqual([invItemA, invItemB]);
    expect(migratedV8.pilot.warehouse).toEqual([]);
    expect(migratedV8.pilot.worldClock).toEqual(createDefaultWorldClock());
    expect(migratedV8.adminConfig.warehouseCapacity).toBe(500);
  });

  it('3) roundtrips v10 saves preserving warehouse items, worldClock (fractional day, custom speed, paused), and warehouseCapacity', () => {
    const rng = createDeterministicRng(303);
    const fresh = createFreshCampaignState('Pilot10', 'striker', rng);
    const wh1 = makeItem('wh_item_1', TPL_WEAPON_B);
    const wh2 = makeItem('wh_item_2', TPL_ENGINE);
    const invNormalized = [makeItem('inv_roundtrip_1', TPL_WEAPON_A)];

    const v10State = {
      ...fresh,
      pilot: {
        ...fresh.pilot,
        inventory: invNormalized,
        warehouse: [wh1, wh2],
        worldClock: {
          worldDay: 42.75,
          lastTickAt: 1712345678901,
          speedMode: 'custom' as const,
          secondsPerDay: 45,
          paused: true,
        },
      },
      adminConfig: {
        ...fresh.adminConfig,
        warehouseCapacity: 750,
      },
    };

    const roundtripped = migrateSaveData(
      JSON.parse(JSON.stringify(v10State)),
      CURRENT_SAVE_VERSION,
      rng
    );

    expect(roundtripped.pilot.inventory).toEqual(invNormalized);
    expect(roundtripped.pilot.warehouse).toEqual([wh1, wh2]);
    expect(roundtripped.pilot.worldClock).toEqual({
      worldDay: 42.75,
      lastTickAt: 1712345678901,
      speedMode: 'custom',
      secondsPerDay: 45,
      paused: true,
    });
    expect(roundtripped.adminConfig.warehouseCapacity).toBe(750);
  });

  it('4) SV1a export/import accepts v10, migrates v9 cleanly with inventory identical, and refuses v11', async () => {
    const whItem = makeItem('sv1a_wh_item', TPL_ARMOR);
    useGameStore.setState((state) => ({
      hasSaveData: true,
      pilot: {
        ...state.pilot,
        name: 'ExportV10',
        warehouse: [whItem],
        worldClock: {
          worldDay: 14.5,
          lastTickAt: 1700001234000,
          speedMode: 'slow',
          secondsPerDay: 600,
          paused: false,
        },
      },
      adminConfig: {
        ...state.adminConfig,
        warehouseCapacity: 640,
      },
    }));

    // Export v10
    const v10Envelope = await buildExportEnvelope(
      useGameStore.getState().exportSaveStateSnapshot()
    );
    expect(v10Envelope.saveVersion).toBe(11);

    // Parse & import v10
    const parsedV10 = await parseImportEnvelope(JSON.stringify(v10Envelope));
    expect(parsedV10.ok).toBe(true);
    if (!parsedV10.ok) return;

    useGameStore.getState().resetCampaign();
    const importV10 = useGameStore
      .getState()
      .importSaveFromEnvelope(
        parsedV10.envelope.payload,
        parsedV10.envelope.saveVersion
      );
    expect(importV10.ok).toBe(true);
    const afterV10 = useGameStore.getState();
    expect(afterV10.pilot.name).toBe('ExportV10');
    expect(afterV10.pilot.warehouse).toEqual([whItem]);
    expect(afterV10.pilot.worldClock).toEqual({
      worldDay: 14.5,
      lastTickAt: 1700001234000,
      speedMode: 'slow',
      secondsPerDay: 600,
      paused: false,
    });
    expect(afterV10.adminConfig.warehouseCapacity).toBe(640);

    // Build & import a v9 envelope (old version)
    const v9Item = makeItem('sv1a_v9_inv_item', TPL_WEAPON_A);
    const v9Pilot = {
      ...createDefaultPilotAccount('OldV9Pilot', 'striker'),
      inventory: [v9Item],
    } as Record<string, unknown>;
    delete v9Pilot.warehouse;
    delete v9Pilot.worldClock;
    const v9Admin = { ...createDefaultAdminConfig() } as Record<string, unknown>;
    delete v9Admin.warehouseCapacity;

    const v9Envelope = await buildExportEnvelope(
      {
        ...createFreshCampaignState('OldV9Pilot', 'striker', createDeterministicRng()),
        pilot: v9Pilot as unknown as ReturnType<typeof createDefaultPilotAccount>,
        adminConfig: v9Admin as unknown as ReturnType<typeof createDefaultAdminConfig>,
        hasSaveData: true,
      },
      undefined,
      { saveVersion: 9 }
    );
    expect(v9Envelope.saveVersion).toBe(9);

    const parsedV9 = await parseImportEnvelope(JSON.stringify(v9Envelope));
    expect(parsedV9.ok).toBe(true);
    if (!parsedV9.ok) return;

    const importV9 = useGameStore
      .getState()
      .importSaveFromEnvelope(
        parsedV9.envelope.payload,
        parsedV9.envelope.saveVersion
      );
    expect(importV9.ok).toBe(true);
    const afterV9 = useGameStore.getState();
    expect(afterV9.pilot.inventory).toEqual([v9Item]);
    expect(afterV9.pilot.warehouse).toEqual([]);
    expect(afterV9.pilot.worldClock).toEqual(createDefaultWorldClock());
    expect(afterV9.adminConfig.warehouseCapacity).toBe(500);

    // Newer-than-current (v12) is refused
    const v11Check = validateImportSaveVersion(12, CURRENT_SAVE_VERSION);
    expect(v11Check.ok).toBe(false);
    if (!v11Check.ok) {
      expect(v11Check.error.code).toBe('VERSION_TOO_NEW');
    }
    const v11Envelope = await buildExportEnvelope(
      useGameStore.getState().exportSaveStateSnapshot(),
      undefined,
      { saveVersion: 12 }
    );
    const parsedV11 = await parseImportEnvelope(JSON.stringify(v11Envelope));
    expect(parsedV11.ok).toBe(true);
    if (!parsedV11.ok) return;

    const importV11 = useGameStore
      .getState()
      .importSaveFromEnvelope(
        parsedV11.envelope.payload,
        parsedV11.envelope.saveVersion
      );
    expect(importV11.ok).toBe(false);
    if (!importV11.ok) {
      expect(importV11.code).toBe('VERSION_TOO_NEW');
    }
  });

  it('5) sanitizes v10 saves: drops duplicate instanceIds, keeps cross-array duplicates only in inventory, runs item sanitizer on warehouse, fixes bad worldClock, and clamps warehouseCapacity', () => {
    const rng = createDeterministicRng(505);
    const fresh = createFreshCampaignState('SanitizeTest', 'striker', rng);

    const invPrimary = makeItem('dup_inv_id', TPL_WEAPON_A);
    const invDuplicate = { ...makeItem('dup_inv_id', TPL_WEAPON_B), price: 9999 };
    const sharedItemInv = makeItem('shared_id', TPL_ARMOR);
    const sharedItemWh = { ...makeItem('shared_id', TPL_ENGINE), price: 8888 };
    const whPrimary = makeItem('wh_dup_id', TPL_ENGINE);
    const whDuplicate = { ...makeItem('wh_dup_id', TPL_WEAPON_A), price: 7777 };
    const whLegacy = { itemId: 'plasma_rifle', instanceId: 'wh_legacy_converted', enchantLevel: 2 };

    const migrated = migrateSaveData(
      {
        ...fresh,
        pilot: {
          ...fresh.pilot,
          inventory: [invPrimary, invDuplicate, sharedItemInv],
          warehouse: [
            sharedItemWh,
            whPrimary,
            whDuplicate,
            { broken: true },
            null,
            whLegacy,
          ],
          worldClock: {
            worldDay: Number.NaN,
            lastTickAt: -50,
            speedMode: 'warp_speed',
            secondsPerDay: -999,
            paused: 'yes',
          },
        },
        adminConfig: {
          ...fresh.adminConfig,
          warehouseCapacity: 99999,
        },
      },
      CURRENT_SAVE_VERSION,
      rng
    );

    // Inventory deduplicated (first kept)
    expect(migrated.pilot.inventory.map((i) => i.instanceId)).toEqual([
      'dup_inv_id',
      'shared_id',
    ]);
    expect(migrated.pilot.inventory[0].templateId).toBe(TPL_WEAPON_A);

    // Warehouse: shared_id dropped (kept only in inventory), wh_dup_id deduplicated, junk dropped, legacy converted
    expect(migrated.pilot.warehouse.map((i) => i.instanceId)).toEqual([
      'wh_dup_id',
      'wh_legacy_converted',
    ]);
    expect(migrated.pilot.warehouse[0].templateId).toBe(TPL_ENGINE);
    expect(migrated.pilot.warehouse[1].enchantLevel).toBe(2);

    // Bad worldClock replaced with defaults
    expect(migrated.pilot.worldClock).toEqual({
      worldDay: 0,
      lastTickAt: null,
      speedMode: 'normal',
      secondsPerDay: 180,
      paused: false,
    });

    // Capacity clamped
    expect(migrated.adminConfig.warehouseCapacity).toBe(MAX_WAREHOUSE_CAPACITY);

    // Unit checks on sanitizeWorldClock & sanitizeWarehouseCapacity edge cases
    expect(sanitizeWarehouseCapacity(10)).toBe(MIN_WAREHOUSE_CAPACITY);
    expect(sanitizeWarehouseCapacity(50)).toBe(50);
    expect(sanitizeWarehouseCapacity(2000)).toBe(2000);
    expect(sanitizeWarehouseCapacity(5000)).toBe(MAX_WAREHOUSE_CAPACITY);
    expect(sanitizeWarehouseCapacity(Number.NaN)).toBe(DEFAULT_WAREHOUSE_CAPACITY);
    expect(sanitizeWarehouseCapacity(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_WAREHOUSE_CAPACITY
    );
    expect(sanitizeWarehouseCapacity('300')).toBe(DEFAULT_WAREHOUSE_CAPACITY);

    // Preset modes force their canonical secondsPerDay
    expect(
      sanitizeWorldClock({
        worldDay: 5.25,
        lastTickAt: 1000,
        speedMode: 'fast',
        secondsPerDay: 9999,
        paused: false,
      })
    ).toEqual({
      worldDay: 5.25,
      lastTickAt: 1000,
      speedMode: 'fast',
      secondsPerDay: 30,
      paused: false,
    });
    expect(
      sanitizeWorldClock({
        worldDay: -3,
        lastTickAt: Number.POSITIVE_INFINITY,
        speedMode: 'slow',
        secondsPerDay: 1,
        paused: true,
      })
    ).toEqual({
      worldDay: 0,
      lastTickAt: null,
      speedMode: 'slow',
      secondsPerDay: 600,
      paused: true,
    });

    // Custom speedMode clamps 10..86400 and falls back to 180 on NaN
    expect(
      sanitizeWorldClock({
        worldDay: 1,
        lastTickAt: 0,
        speedMode: 'custom',
        secondsPerDay: 2,
        paused: false,
      }).secondsPerDay
    ).toBe(10);
    expect(
      sanitizeWorldClock({
        worldDay: 1,
        lastTickAt: 0,
        speedMode: 'custom',
        secondsPerDay: 200000,
        paused: false,
      }).secondsPerDay
    ).toBe(86400);
    expect(
      sanitizeWorldClock({
        worldDay: 1,
        lastTickAt: 0,
        speedMode: 'custom',
        secondsPerDay: Number.NaN,
        paused: false,
      }).secondsPerDay
    ).toBe(180);
  });
});
