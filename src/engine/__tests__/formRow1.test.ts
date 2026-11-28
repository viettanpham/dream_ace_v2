import { describe, expect, it } from 'vitest';
import {
  cloneFormationConfig,
  DEFAULT_FORMATION_CONFIG,
} from '../../data/formationConfig';
import {
  autoPlaceFormation,
  createDefaultSquadFormation,
  sanitizeFormationConfig,
} from '../formation';
import {
  createDefaultAdminConfig,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { createDefaultPilotAccount } from '../stats';
import type { MechClassId } from '../../types/game';

describe('FORM-ROW-1 defaults and class preferences', () => {
  it('auto-arranges a mixed 8-unit squad deterministically: siege -> front, striker/interceptor -> middle, support -> back', () => {
    const roster: Array<{ id: string; classId: MechClassId }> = [
      { id: 'st_1', classId: 'striker' },
      { id: 'in_1', classId: 'interceptor' },
      { id: 'sg_1', classId: 'siege' },
      { id: 'sp_1', classId: 'support' },
      { id: 'st_2', classId: 'striker' },
      { id: 'in_2', classId: 'interceptor' },
      { id: 'sg_2', classId: 'siege' },
      { id: 'sp_2', classId: 'support' },
    ];

    const placed = autoPlaceFormation(roster, DEFAULT_FORMATION_CONFIG);
    const byId = new Map(placed.map((u) => [u.id, u.row]));

    expect(byId.get('sg_1')).toBe('front');
    expect(byId.get('sg_2')).toBe('front');
    expect(byId.get('st_1')).toBe('middle');
    expect(byId.get('st_2')).toBe('middle');
    expect(byId.get('in_1')).toBe('middle');
    expect(byId.get('in_2')).toBe('middle');
    expect(byId.get('sp_1')).toBe('back');
    expect(byId.get('sp_2')).toBe('back');

    // Default 8-unit campaign squad uses the exact same placement
    const defaultSquad = createDefaultSquadFormation('Pilot', 'striker');
    expect(defaultSquad.filter((u) => u.classId === 'siege').every((u) => u.row === 'front')).toBe(true);
    expect(defaultSquad.filter((u) => u.classId === 'striker' || u.classId === 'interceptor').every((u) => u.row === 'middle')).toBe(true);
    expect(defaultSquad.filter((u) => u.classId === 'support').every((u) => u.row === 'back')).toBe(true);
  });

  it('overflows to the next preferred row when a row capacity is lowered', () => {
    const tightFront = sanitizeFormationConfig({
      rowCapacities: { front: 2, middle: 8, back: 8 },
      maxUnitsPerSide: 8,
    });
    const threeSiege: Array<{ id: string; classId: MechClassId }> = [
      { id: 'sg_1', classId: 'siege' },
      { id: 'sg_2', classId: 'siege' },
      { id: 'sg_3', classId: 'siege' },
    ];
    const placedSiege = autoPlaceFormation(threeSiege, tightFront);
    expect(placedSiege.filter((u) => u.row === 'front')).toHaveLength(2);
    expect(placedSiege.find((u) => u.id === 'sg_3')?.row).toBe('middle');

    const tightMiddle = sanitizeFormationConfig({
      rowCapacities: { front: 8, middle: 2, back: 8 },
      maxUnitsPerSide: 8,
    });
    const threeAttackers: Array<{ id: string; classId: MechClassId }> = [
      { id: 'st_1', classId: 'striker' },
      { id: 'in_1', classId: 'interceptor' },
      { id: 'st_2', classId: 'striker' },
    ];
    const placedAttackers = autoPlaceFormation(threeAttackers, tightMiddle);
    expect(placedAttackers.filter((u) => u.row === 'middle')).toHaveLength(2);
    expect(placedAttackers.find((u) => u.id === 'st_2')?.row).toBe('front');
  });

  it('defaults fresh config to 5-5-5, restores 5-5-5 on reset, and preserves saved 3/3/2 on load', () => {
    const freshAdmin = createDefaultAdminConfig();
    expect(freshAdmin.formation.rowCapacities).toEqual({
      front: 5,
      middle: 5,
      back: 5,
    });
    expect(freshAdmin.formation.maxUnitsPerSide).toBe(8);

    const resetCfg = cloneFormationConfig(DEFAULT_FORMATION_CONFIG);
    expect(resetCfg.rowCapacities).toEqual({ front: 5, middle: 5, back: 5 });

    const saved332 = {
      pilot: createDefaultPilotAccount('Veteran', 'striker'),
      adminConfig: {
        ...freshAdmin,
        formation: {
          ...freshAdmin.formation,
          rowCapacities: { front: 3, middle: 3, back: 2 },
        },
      },
      hasSaveData: true,
      language: 'vi' as const,
    };
    const migrated = migrateSaveData(saved332, CURRENT_SAVE_VERSION);
    expect(migrated.adminConfig.formation.rowCapacities).toEqual({
      front: 3,
      middle: 3,
      back: 2,
    });
  });
});
