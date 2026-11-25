import { describe, expect, it } from 'vitest';
import { SECTORS_CATALOG } from '../../data/maps';
import type { CombatUnit } from '../../types/game';
import { generateItemInstance, rollBattleItemDrops } from '../equipment';
import {
  DEFAULT_ITEM_LEVELS_CONFIG,
  getTierRequiredLevel,
} from '../itemLevels';
import { createFreshCampaignState, migrateSaveData } from '../migration';
import { generateCategorizedShopStock } from '../shop';

function createRng(seed = 20261124): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TASK C1 — Item level config per kind + shop/drop level windows', () => {
  it('(1) getTierRequiredLevel returns 5/15/25/35 for radar and 10/20/30/40 for module', () => {
    expect([1, 2, 3, 4].map((t) => getTierRequiredLevel('radar', t))).toEqual([
      5, 15, 25, 35,
    ]);
    expect([1, 2, 3, 4].map((t) => getTierRequiredLevel('module', t))).toEqual([
      10, 20, 30, 40,
    ]);
  });

  it('(2) stored T4 radar with requiredLevel 9 loads as 35 and stays equipped', () => {
    const campaign = createFreshCampaignState('Vance', 'striker', createRng(11));
    const oldRadar = {
      ...generateItemInstance(
        { templateId: 'tpl_rd_aegis_eye', tier: 4, rarity: 'rare' },
        createRng(12)
      ),
      requiredLevel: 9,
    };
    const save = {
      ...campaign,
      saveVersion: 13,
      pilot: {
        ...campaign.pilot,
        inventory: [oldRadar, ...campaign.pilot.inventory],
        gears: {
          ...campaign.pilot.gears,
          striker: {
            ...campaign.pilot.gears.striker,
            equipped: {
              ...campaign.pilot.gears.striker.equipped,
              radar: oldRadar.instanceId,
            },
          },
        },
      },
    };

    const migrated = migrateSaveData(save, 13, createRng(13));
    const loadedRadar = migrated.pilot.inventory.find(
      (it) => it.instanceId === oldRadar.instanceId
    );
    expect(loadedRadar?.requiredLevel).toBe(35);
    expect(migrated.pilot.gears.striker.equipped.radar).toBe(
      oldRadar.instanceId
    );
  });

  it('(3) shop at level 1 caps equipment at T2 and radar at T1; shopTierAhead 3 can offer T4 weapon', () => {
    const defaultStock = generateCategorizedShopStock(
      1,
      { minStock: 10, maxStock: 10 },
      createRng(101)
    );
    const nonRadarItems = defaultStock.filter((it) => it.slot !== 'radar');
    const radarItems = defaultStock.filter((it) => it.slot === 'radar');
    expect(nonRadarItems.every((it) => it.tier <= 2)).toBe(true);
    expect(radarItems.every((it) => it.tier <= 1)).toBe(true);

    const aheadStock = Array.from({ length: 4 }, (_, i) =>
      generateCategorizedShopStock(
        1,
        {
          minStock: 10,
          maxStock: 10,
          itemLevels: { ...DEFAULT_ITEM_LEVELS_CONFIG, shopTierAhead: 3 },
        },
        createRng(200 + i)
      )
    ).flat();
    expect(
      aheadStock.some((it) => it.slot === 'main_weapon' && it.tier === 4)
    ).toBe(true);
  });

  it('(4) Standard drops at gear level 30 never exceed 35 and still drop old gear (<= 9) for slots missing 25-35', () => {
    const standardSector = SECTORS_CATALOG.find(
      (s) => s.difficulty === 'Standard'
    )!;
    const deadEnemies = Array.from({ length: 8 }, (_, idx) => ({
      id: `enemy_${idx}`,
      alive: false,
      isBoss: idx === 0,
    })) as unknown as CombatUnit[];

    const allDrops = Array.from({ length: 20 }, (_, i) =>
      rollBattleItemDrops(
        deadEnemies,
        standardSector.id,
        30,
        true,
        createRng(300 + i)
      )
    ).flat();

    expect(allDrops.length).toBeGreaterThan(0);
    expect(allDrops.every((it) => it.requiredLevel <= 35)).toBe(true);
    const armorOrEngineOldDrops = allDrops.filter(
      (it) =>
        (it.slot === 'armor' || it.slot === 'engine') && it.requiredLevel <= 9
    );
    expect(armorOrEngineOldDrops.length).toBeGreaterThan(0);
  });

  it('(5) T3 weapon instance keeps today requiredLevel (7) while equipment is disabled', () => {
    const t3Weapon = generateItemInstance(
      { slot: 'main_weapon', tier: 3, rarity: 'common' },
      createRng(404)
    );
    expect(t3Weapon.tier).toBe(3);
    expect(t3Weapon.requiredLevel).toBe(7);
  });
});
