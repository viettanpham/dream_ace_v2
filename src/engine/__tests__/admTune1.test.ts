import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SKILL_CARD_PRICE_MULT,
  MAX_SKILL_CARD_PRICE_MULT,
  sanitizeSkillCardPriceMult,
} from '../../data/balance';
import { DEFAULT_FORMATION_CONFIG } from '../../data/formationConfig';
import type { MechClassId } from '../../types/game';
import { autoPlaceFormation, sanitizeFormationConfig } from '../formation';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';

describe('TASK ADM-TUNE-1 — skillCardPriceMult (10 / max 999999999) & formation default (5-5-5)', () => {
  it('1) fresh state has skillCardPriceMult = 10 and sanitizer keeps 5000000 while clamping 0 -> 0.1', () => {
    expect(DEFAULT_SKILL_CARD_PRICE_MULT).toBe(10);
    expect(MAX_SKILL_CARD_PRICE_MULT).toBe(999_999_999);
    const freshAdmin = createDefaultAdminConfig();
    expect(freshAdmin.skillCardPriceMult).toBe(10);

    const freshCampaign = createFreshCampaignState('AdmTune', 'striker');
    expect(freshCampaign.adminConfig.skillCardPriceMult).toBe(10);

    expect(sanitizeSkillCardPriceMult(5_000_000)).toBe(5_000_000);
    expect(sanitizeSkillCardPriceMult(0)).toBe(0.1);
    expect(sanitizeSkillCardPriceMult(2_000_000_000)).toBe(999_999_999);
  });

  it('2) stored skillCardPriceMult 3 stays 3 after migration, while missing field migrates to 10', () => {
    const base = createFreshCampaignState('MigrateTune', 'striker');
    const savedWith3 = {
      ...base,
      adminConfig: {
        ...base.adminConfig,
        skillCardPriceMult: 3,
      },
    };
    const migrated3 = migrateSaveData(savedWith3, CURRENT_SAVE_VERSION);
    expect(migrated3.adminConfig.skillCardPriceMult).toBe(3);

    const savedWithout = {
      ...base,
      adminConfig: {
        ...base.adminConfig,
        skillCardPriceMult: undefined,
      },
    };
    const migratedDefault = migrateSaveData(savedWithout, CURRENT_SAVE_VERSION);
    expect(migratedDefault.adminConfig.skillCardPriceMult).toBe(10);
  });

  it('3) DEFAULT_FORMATION_CONFIG & fresh sanitizeFormationConfig return 5/5/5 and auto-arrange still places all 8 units', () => {
    expect(DEFAULT_FORMATION_CONFIG.rowCapacities).toEqual({
      front: 5,
      middle: 5,
      back: 5,
    });
    expect(DEFAULT_FORMATION_CONFIG.maxUnitsPerSide).toBe(8);

    expect(sanitizeFormationConfig(undefined).rowCapacities).toEqual({
      front: 5,
      middle: 5,
      back: 5,
    });

    const eightAttackers: Array<{ id: string; classId: MechClassId }> = [
      { id: 'u1', classId: 'striker' },
      { id: 'u2', classId: 'striker' },
      { id: 'u3', classId: 'striker' },
      { id: 'u4', classId: 'striker' },
      { id: 'u5', classId: 'striker' },
      { id: 'u6', classId: 'striker' },
      { id: 'u7', classId: 'interceptor' },
      { id: 'u8', classId: 'interceptor' },
    ];
    const placed = autoPlaceFormation(eightAttackers, DEFAULT_FORMATION_CONFIG);
    expect(placed).toHaveLength(8);
    expect(placed.filter((u) => u.row === 'middle')).toHaveLength(5);
    expect(placed.filter((u) => u.row === 'front')).toHaveLength(3);
  });
});
