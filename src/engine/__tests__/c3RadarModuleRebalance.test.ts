// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getItemTemplate, ITEM_TEMPLATES } from '../../data/items';
import { getModuleTemplateById } from '../../data/modules';
import type { ItemInstance } from '../../types/game';
import { CURRENT_SAVE_VERSION, createFreshCampaignState, migrateSaveData } from '../migration';

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TASK C3 — Radar & module rebalance + save re-sync', () => {
  it('1) no radar template has detectStealth or critBonusPct', () => {
    const radars = ITEM_TEMPLATES.filter((t) => t.slot === 'radar');
    expect(radars).toHaveLength(6);
    for (const r of radars) {
      expect(r.specialTraits?.detectStealth).toBeUndefined();
      expect(r.specialTraits?.critBonusPct).toBeUndefined();
      expect(r.specialTraits?.accuracyPct).toBeGreaterThan(0);
    }
  });

  it('2) tpl_rd_aegis_eye has EVA 9-13, ATK 7-10, and accuracyPct 12', () => {
    const aegis = getItemTemplate('tpl_rd_aegis_eye');
    expect(aegis).toBeDefined();
    expect(aegis?.primaryStat).toBe('evasion');
    expect(aegis?.primaryRange).toEqual([9, 13]);
    expect(aegis?.secondaryStat).toBe('attack');
    expect(aegis?.secondaryRange).toEqual([7, 10]);
    expect(aegis?.specialTraits).toEqual({ accuracyPct: 12 });
  });

  it('3) module table values match C3 rebalance (spot check 4 rows)', () => {
    expect(getModuleTemplateById('mod_stat_attack_t4')?.value).toBe(8);
    expect(getModuleTemplateById('mod_stat_defense_t4')?.value).toBe(12);
    expect(getModuleTemplateById('mod_trait_armorPiercePct_t4')?.value).toBe(10);
    expect(getModuleTemplateById('mod_trait_spRegenPerTurn_t4')?.value).toBe(10);
  });

  it('4) a stored old module item loads with the new value', () => {
    const base = createFreshCampaignState('ModReload', 'striker', createRng(1));
    const oldStatMod: ItemInstance = {
      instanceId: 'old_mod_atk_t4',
      templateId: 'mod_stat_attack_t4',
      slot: 'module',
      tier: 4,
      requiredLevel: 9,
      classRestriction: null,
      rarity: 'common',
      rolledBaseStats: { attack: 12 },
      affixes: [],
      suffixId: null,
      rollQuality: 100,
      price: 100,
      enchantLevel: 0,
    };
    const oldTraitMod: ItemInstance = {
      instanceId: 'old_mod_spr_regen_t4',
      templateId: 'mod_trait_spRegenPerTurn_t4',
      slot: 'module',
      tier: 4,
      requiredLevel: 9,
      classRestriction: null,
      rarity: 'common',
      rolledBaseStats: {},
      affixes: [],
      suffixId: null,
      rollQuality: 100,
      price: 100,
      enchantLevel: 0,
      specialTraits: { spRegenPerTurn: 3 },
    };

    const migrated = migrateSaveData(
      {
        ...base,
        pilot: {
          ...base.pilot,
          inventory: [...base.pilot.inventory, oldStatMod, oldTraitMod],
        },
      },
      CURRENT_SAVE_VERSION,
      createRng(11)
    );
    expect(
      migrated.pilot.inventory.find((i) => i.instanceId === 'old_mod_atk_t4')?.rolledBaseStats
    ).toEqual({ attack: 8 });
    expect(
      migrated.pilot.inventory.find((i) => i.instanceId === 'old_mod_spr_regen_t4')?.specialTraits
    ).toEqual({ spRegenPerTurn: 10 });
  });

  it('5) an old stored radar with detectStealth loads without it', () => {
    const base = createFreshCampaignState('RadReload', 'striker', createRng(2));
    const oldRadar: ItemInstance = {
      instanceId: 'old_radar_aegis',
      templateId: 'tpl_rd_aegis_eye',
      slot: 'radar',
      tier: 4,
      requiredLevel: 9,
      classRestriction: null,
      rarity: 'epic',
      rolledBaseStats: { attack: 12, evasion: 9 },
      affixes: [],
      suffixId: null,
      rollQuality: 70,
      price: 670,
      enchantLevel: 0,
      specialTraits: { accuracyPct: 12, critBonusPct: 4, detectStealth: true },
    };

    const migrated = migrateSaveData(
      {
        ...base,
        pilot: {
          ...base.pilot,
          inventory: [...base.pilot.inventory, oldRadar],
        },
      },
      CURRENT_SAVE_VERSION,
      createRng(12)
    );
    const loaded = migrated.pilot.inventory.find((i) => i.instanceId === 'old_radar_aegis');
    expect(loaded?.specialTraits).toEqual({ accuracyPct: 12 });
    expect(loaded?.specialTraits?.detectStealth).toBeUndefined();
    expect(loaded?.specialTraits?.critBonusPct).toBeUndefined();
    expect(loaded?.rolledBaseStats).toEqual({ attack: 12, evasion: 9 });
  });
});
