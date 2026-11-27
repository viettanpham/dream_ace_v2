import { describe, expect, it, vi } from 'vitest';
import { createInitialBattleState } from '../../engine/combat';
import { visibleNodeIds } from '../../engine/frontline';
import {
  CURRENT_SAVE_VERSION,
  createFreshCampaignState,
  migrateSaveData,
} from '../../engine/migration';
import { summarizeSaveStateForPreview } from '../../engine/saveExport';
import { createDefaultPilotAccount } from '../../engine/stats';
import {
  MAP_LANES,
  SECTORS_CATALOG,
  createInitialBaseStates,
  getActiveMap,
  getBattleSizeForBaseType,
  getMapLanes,
  getMapNodeById,
  getMapNodes,
  getNextSectorId,
  getSectorById,
  getTokenShapeForBaseType,
  validateMapPack,
} from '../maps';
import rawMapData from '../maps.json';

function createDeterministicRng(seed = 1337): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('TASK MAP-C1 — Map as data (maps.json + validator + no hard-coded ids)', () => {
  it('1) snapshot equality for SECTORS_CATALOG, MAP_LANES, createInitialBaseStates, and helper getters', () => {
    const pack = getActiveMap();
    expect(pack.mapId).toBe('sys_orbital_6');
    expect(pack.schemaVersion).toBe(1);
    expect(pack.bounds).toEqual({ width: 840, height: 310 });
    expect(pack.defaultSelectedNodeId).toBe('border_outpost');

    expect(getMapNodes()).toBe(SECTORS_CATALOG);
    expect(getMapLanes()).toBe(MAP_LANES);
    expect(SECTORS_CATALOG.map((s) => s.id)).toEqual([
      'border_outpost',
      'debris_belt',
      'iron_citadel',
      'aegis_relay',
      'veridian_colony',
      'vanguard_shipyard',
    ]);
    expect(MAP_LANES).toEqual([
      { id: 'lane_aegis_border', from: 'aegis_relay', to: 'border_outpost' },
      { id: 'lane_aegis_veridian', from: 'aegis_relay', to: 'veridian_colony' },
      { id: 'lane_border_caldera', from: 'border_outpost', to: 'debris_belt' },
      { id: 'lane_border_veridian', from: 'border_outpost', to: 'veridian_colony' },
      { id: 'lane_veridian_shipyard', from: 'veridian_colony', to: 'vanguard_shipyard' },
      { id: 'lane_caldera_shipyard', from: 'debris_belt', to: 'vanguard_shipyard' },
      { id: 'lane_caldera_helios', from: 'debris_belt', to: 'iron_citadel' },
      { id: 'lane_shipyard_helios', from: 'vanguard_shipyard', to: 'iron_citadel' },
    ]);

    expect(createInitialBaseStates()).toEqual({
      border_outpost: {
        faction: 'hostile',
        status: 'operational',
        repairMonthsRemaining: 0,
        underAttack: false,
        attackCountdownMonths: 0,
        attackFromSectorId: null,
      },
      debris_belt: {
        faction: 'hostile',
        status: 'operational',
        repairMonthsRemaining: 0,
        underAttack: false,
        attackCountdownMonths: 0,
        attackFromSectorId: null,
      },
      iron_citadel: {
        faction: 'hostile',
        status: 'operational',
        repairMonthsRemaining: 0,
        underAttack: false,
        attackCountdownMonths: 0,
        attackFromSectorId: null,
      },
      aegis_relay: {
        faction: 'allied',
        status: 'operational',
        repairMonthsRemaining: 0,
        underAttack: true,
        attackCountdownMonths: 2,
        attackFromSectorId: 'border_outpost',
      },
      veridian_colony: {
        faction: 'neutral',
        status: 'operational',
        repairMonthsRemaining: 0,
        underAttack: false,
        attackCountdownMonths: 0,
        attackFromSectorId: null,
      },
      vanguard_shipyard: {
        faction: 'hostile',
        status: 'operational',
        repairMonthsRemaining: 0,
        underAttack: false,
        attackCountdownMonths: 0,
        attackFromSectorId: null,
      },
    });

    expect(getMapNodeById('debris_belt')?.squadSize).toBe(6);
    expect(getSectorById('unknown_id').id).toBe('border_outpost');
    expect(getNextSectorId('border_outpost')).toBe('debris_belt');
    expect(getBattleSizeForBaseType('outpost')).toBe(4);
    expect(getBattleSizeForBaseType('fortress')).toBe(6);
    expect(getBattleSizeForBaseType('capital')).toBe(8);
    expect(getTokenShapeForBaseType('colony')).toBe('round');
    expect(getTokenShapeForBaseType('shipyard')).toBe('square');
  });

  it('2) validateMapPack drops duplicate node ids and bad lanes (self/missing/duplicate) with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cloned = structuredClone(rawMapData);
    cloned.nodes.push(structuredClone(cloned.nodes[0]));
    cloned.lanes.push(
      { id: 'lane_self', from: 'border_outpost', to: 'border_outpost' },
      { id: 'lane_missing', from: 'border_outpost', to: 'ghost_sector' },
      { id: 'lane_dup_rev', from: 'border_outpost', to: 'aegis_relay' }
    );

    const validated = validateMapPack(cloned);
    expect(validated).not.toBeNull();
    expect(validated!.nodes).toHaveLength(6);
    expect(validated!.lanes).toHaveLength(8);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('3) validateMapPack returns null on disconnected graph or zero allied nodes', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const disconnected = structuredClone(rawMapData);
    disconnected.lanes = disconnected.lanes.filter(
      (l) => l.from !== 'iron_citadel' && l.to !== 'iron_citadel'
    );
    expect(validateMapPack(disconnected)).toBeNull();

    const noAllied = structuredClone(rawMapData);
    noAllied.nodes = noAllied.nodes.map((n) => ({
      ...n,
      initialFaction: 'hostile',
    }));
    expect(validateMapPack(noAllied)).toBeNull();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('4) old save with an unknown base id loads cleanly, drops unknown baseStates, and restores missing nodes', () => {
    const baseState = createFreshCampaignState('OldAce', 'striker', createDeterministicRng(42));
    const { debris_belt: _omitted, ...partialBaseStates } = baseState.pilot.baseStates;
    const oldSave = {
      ...baseState,
      selectedSectorId: 'legacy_unknown_base',
      pilot: {
        ...baseState.pilot,
        unlockedSectorIds: [...baseState.pilot.unlockedSectorIds, 'legacy_unknown_base'],
        capturedSectorIds: ['aegis_relay', 'legacy_unknown_base'],
        baseStates: {
          ...partialBaseStates,
          legacy_unknown_base: {
            faction: 'allied',
            status: 'operational',
            repairMonthsRemaining: 0,
            underAttack: false,
            attackCountdownMonths: 0,
            attackFromSectorId: null,
          },
        },
      },
    };

    const migrated = migrateSaveData(oldSave, CURRENT_SAVE_VERSION);
    expect(migrated.selectedSectorId).toBe('border_outpost');
    expect(migrated.pilot.baseStates.legacy_unknown_base).toBeUndefined();
    expect(migrated.pilot.baseStates.debris_belt).toBeDefined();
    expect(migrated.pilot.baseStates.debris_belt.faction).toBe('hostile');
    expect(migrated.pilot.unlockedSectorIds).not.toContain('legacy_unknown_base');
    expect(migrated.pilot.capturedSectorIds).toEqual(['aegis_relay']);
  });

  it('5) fresh save visible nodes, preview sector count, and seeded battle initialization remain unchanged', () => {
    const pilot = createDefaultPilotAccount('FreshAce', 'striker');
    expect(pilot.unlockedSectorIds).toEqual([
      'border_outpost',
      'aegis_relay',
      'veridian_colony',
    ]);
    expect(pilot.capturedSectorIds).toEqual(['aegis_relay']);
    expect(visibleNodeIds(pilot)).toEqual([
      'border_outpost',
      'aegis_relay',
      'veridian_colony',
    ]);

    const freshState = createFreshCampaignState('FreshAce', 'striker', createDeterministicRng(7));
    expect(freshState.selectedSectorId).toBe('border_outpost');
    const preview = summarizeSaveStateForPreview(freshState, CURRENT_SAVE_VERSION);
    expect(preview.totalSectorsCount).toBe(6);

    const b1 = createInitialBattleState(pilot, 'border_outpost', createDeterministicRng(99));
    const b2 = createInitialBattleState(pilot, 'border_outpost', createDeterministicRng(99));
    expect(b1.units.map((u) => [u.id, u.classId, u.hp, u.shield, u.row])).toEqual(
      b2.units.map((u) => [u.id, u.classId, u.hp, u.shield, u.row])
    );
  });
});
