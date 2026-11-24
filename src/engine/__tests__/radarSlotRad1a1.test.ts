// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { validatePriceFormula } from '../../data/itemPricing';
import {
  EMPTY_EQUIPPED_SLOT_IDS,
  EQUIPMENT_SLOT_META,
  EQUIPMENT_SLOTS,
  ITEM_TEMPLATES,
  validateItemTemplates,
} from '../../data/items';
import rawItemsData from '../../data/items.json';
import type { CombatUnit } from '../../types/game';
import {
  generateItemInstance,
  rollBattleItemDrops,
  sumGearSpecialTraits,
} from '../equipment';
import { computeItemPrice, countNonZeroTraits } from '../itemPrice';
import {
  CURRENT_SAVE_VERSION,
  createDefaultAdminConfig,
  createFreshCampaignState,
  migrateSaveData,
} from '../migration';
import { generateCategorizedShopStock } from '../shop';

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TASK RAD1a-1 — Radar 7th equipment slot, items, pricing, and save migration', () => {
  it('1) EQUIPMENT_SLOTS has 7 entries with radar last, and a v11 save without radar loads with radar null', () => {
    expect(EQUIPMENT_SLOTS).toHaveLength(7);
    expect(EQUIPMENT_SLOTS[EQUIPMENT_SLOTS.length - 1]).toBe('radar');
    expect(EQUIPMENT_SLOT_META.radar).toEqual({
      slot: 'radar',
      label: 'Radar',
      shortLabel: 'RADAR',
      classLocked: false,
    });
    expect(EMPTY_EQUIPPED_SLOT_IDS.radar).toBeNull();

    const fresh = createFreshCampaignState('PilotRad', 'striker', createRng(11));
    expect(fresh.pilot.gears.striker.equipped.radar).toBeNull();

    // Simulate legacy v11 save object lacking equipped.radar
    const v11Striker = {
      ...fresh.pilot.gears.striker,
      equipped: {
        main_weapon: fresh.pilot.gears.striker.equipped.main_weapon,
        sub_weapon: fresh.pilot.gears.striker.equipped.sub_weapon,
        armor: fresh.pilot.gears.striker.equipped.armor,
        engine: fresh.pilot.gears.striker.equipped.engine,
        cpu: fresh.pilot.gears.striker.equipped.cpu,
        accessory: fresh.pilot.gears.striker.equipped.accessory,
      },
    };
    const migrated = migrateSaveData(
      {
        pilot: {
          ...fresh.pilot,
          gears: {
            ...fresh.pilot.gears,
            striker: v11Striker,
          },
        },
        adminConfig: createDefaultAdminConfig(),
        hasSaveData: true,
      },
      CURRENT_SAVE_VERSION,
      createRng(12)
    );
    expect(migrated.pilot.gears.striker.equipped.radar).toBeNull();
  });

  it('2) the 6 radar templates load with 0 dropped and generated radar item price follows formula incl. traits', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validated = validateItemTemplates(rawItemsData);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();

    expect(validated).toHaveLength(42);
    const radarTemplates = ITEM_TEMPLATES.filter((t) => t.slot === 'radar');
    expect(radarTemplates.map((t) => t.id)).toEqual([
      'tpl_rd_scout',
      'tpl_rd_fire_control',
      'tpl_rd_wideband',
      'tpl_rd_phased',
      'tpl_rd_hunter',
      'tpl_rd_aegis_eye',
    ]);

    // Validator warns and falls back to 176 if baseBySlot.radar is missing
    const warnFallback = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fallbackPricing = validatePriceFormula({
      baseBySlot: {
        main_weapon: 184,
        sub_weapon: 173,
        armor: 194,
        engine: 189,
        cpu: 179,
        accessory: 173,
      },
    });
    expect(fallbackPricing.baseBySlot.radar).toBe(176);
    expect(warnFallback).toHaveBeenCalled();
    warnFallback.mockRestore();

    const inst = generateItemInstance(
      {
        templateId: 'tpl_rd_aegis_eye',
        tier: 4,
        rarity: 'epic',
        rollQuality: 70,
      },
      createRng(42)
    );
    expect(countNonZeroTraits(inst.specialTraits)).toBe(3);
    expect(inst.price).toBe(
      computeItemPrice({
        slot: 'radar',
        tier: 4,
        rarity: 'epic',
        rollQuality: 70,
        affixCount: inst.affixes.length,
        traitCount: 3,
      })
    );
  });

  it('3) sumGearSpecialTraits sums accuracyPct and ORs detectStealth', () => {
    const fresh = createFreshCampaignState('TraitPilot', 'striker', createRng(7));
    const rdScout = generateItemInstance(
      { templateId: 'tpl_rd_scout', rarity: 'rare', rollQuality: 50 },
      createRng(8)
    );
    const rdHunter = generateItemInstance(
      { templateId: 'tpl_rd_hunter', rarity: 'epic', rollQuality: 60 },
      createRng(9)
    );

    const gearWithScoutOnly = {
      ...fresh.pilot.gears.striker,
      equipped: {
        ...fresh.pilot.gears.striker.equipped,
        radar: rdScout.instanceId,
      },
    };
    const traitsA = sumGearSpecialTraits(gearWithScoutOnly, [
      ...fresh.pilot.inventory,
      rdScout,
    ]);
    expect(traitsA.accuracyPct).toBe(4);
    expect(traitsA.detectStealth).toBe(false);

    // Combine scout radar + hunter (in cpu/radar test inventory override) to confirm sum + OR
    const gearStacked = {
      ...fresh.pilot.gears.striker,
      equipped: {
        ...fresh.pilot.gears.striker.equipped,
        cpu: rdScout.instanceId,
        radar: rdHunter.instanceId,
      },
    };
    const traitsB = sumGearSpecialTraits(gearStacked, [
      ...fresh.pilot.inventory,
      rdScout,
      rdHunter,
    ]);
    expect(traitsB.accuracyPct).toBe(12);
    expect(traitsB.detectStealth).toBe(true);
  });

  it('4) radar items can appear in a seeded drop roll and in shop stock', () => {
    const fakeBoss = { alive: false, isBoss: true } as CombatUnit;
    let foundDropRadar = false;
    for (let seed = 1; seed <= 80; seed += 1) {
      const drops = rollBattleItemDrops([fakeBoss], 'sec_1', 10, true, createRng(seed));
      if (drops.some((d) => d.slot === 'radar')) {
        foundDropRadar = true;
        break;
      }
    }
    expect(foundDropRadar).toBe(true);

    let foundShopRadar = false;
    for (let seed = 1; seed <= 25; seed += 1) {
      const stock = generateCategorizedShopStock(10, {}, createRng(seed));
      if (stock.some((s) => s.slot === 'radar')) {
        foundShopRadar = true;
        break;
      }
    }
    expect(foundShopRadar).toBe(true);
  });
});
