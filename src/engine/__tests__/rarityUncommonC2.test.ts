import { describe, expect, it } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { PRICE_FORMULA } from '../../data/itemPricing';
import { RARITY_LIST, RARITY_META } from '../../data/items';
import {
  DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS,
  SHOP_STOCK_CONFIG,
} from '../../data/shopConfig';
import { getRarityLabel } from '../../i18n';
import type { ItemRarity } from '../../types/game';
import { generateItemInstance } from '../equipment';
import { RARITY_RANK } from '../inventory';
import { computeItemPrice } from '../itemPrice';
import { CURRENT_SAVE_VERSION, migrateSaveData } from '../migration';

describe('TASK C2 — 5th rarity "uncommon" + Vietnamese grade names', () => {
  it('1) sanitizer preserves uncommon and old rarity ids on save migration', () => {
    const templateItem = (id: string, rarity: ItemRarity) => ({
      ...generateItemInstance({
        templateId: 'tpl_mw_pulse_cannon',
        tier: 1,
        rarity,
        rollQuality: 50,
      }),
      instanceId: id,
    });

    const migrated = migrateSaveData(
      {
        adminConfig: {
          shopRarityWeights: { common: 45, rare: 35, epic: 15, legendary: 5 },
        },
        pilot: {
          inventory: [
            templateItem('itm_c', 'common'),
            templateItem('itm_u', 'uncommon'),
            templateItem('itm_r', 'rare'),
            templateItem('itm_e', 'epic'),
            templateItem('itm_l', 'legendary'),
          ],
        },
      },
      CURRENT_SAVE_VERSION
    );

    const rarities = migrated.pilot.inventory.map((it) => it.rarity);
    expect(rarities).toEqual([
      'common',
      'uncommon',
      'rare',
      'epic',
      'legendary',
    ]);
    expect(migrated.adminConfig.shopRarityWeights).toEqual(
      DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS
    );
  });

  it('2) uncommon rolled base stats lie strictly between common and rare for a fixed roll', () => {
    const fixedRng = () => 0.5;
    const common = generateItemInstance(
      {
        templateId: 'tpl_mw_pulse_cannon',
        tier: 4,
        rarity: 'common',
        rollQuality: 75,
      },
      fixedRng
    );
    const uncommon = generateItemInstance(
      {
        templateId: 'tpl_mw_pulse_cannon',
        tier: 4,
        rarity: 'uncommon',
        rollQuality: 75,
      },
      fixedRng
    );
    const rare = generateItemInstance(
      {
        templateId: 'tpl_mw_pulse_cannon',
        tier: 4,
        rarity: 'rare',
        rollQuality: 75,
      },
      fixedRng
    );

    const cAtk = common.rolledBaseStats.attack ?? 0;
    const uAtk = uncommon.rolledBaseStats.attack ?? 0;
    const rAtk = rare.rolledBaseStats.attack ?? 0;

    expect(uAtk).toBeGreaterThan(cAtk);
    expect(uAtk).toBeLessThan(rAtk);
    expect(uncommon.affixes.length).toBe(0);
    expect(rare.affixes.length).toBe(1);
  });

  it('3) drop, shop, crate, and admin weight tables include uncommon and keep total sums', () => {
    const sumWeights = (w: Record<ItemRarity, number>) =>
      w.common + w.uncommon + w.rare + w.epic + w.legendary;

    for (const diff of ['Standard', 'Hard', 'Elite'] as const) {
      const w = BALANCE_CONFIG.dropConfig[diff].rarityWeights;
      expect(w.uncommon).toBeGreaterThan(0);
      expect(sumWeights(w)).toBe(100);
    }

    for (const tier of [1, 2, 3, 4] as const) {
      const w = SHOP_STOCK_CONFIG.rarityWeightsByTier[tier];
      expect(w.uncommon).toBeGreaterThan(0);
      expect(sumWeights(w)).toBe(100);
    }

    expect(sumWeights(DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS)).toBe(100);
    expect(DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.uncommon).toBe(16);
    expect(
      sumWeights(SHOP_STOCK_CONFIG.wpOffers.equipmentCrate.rarityWeights)
    ).toBe(100);
    expect(
      SHOP_STOCK_CONFIG.wpOffers.equipmentCrate.baseWpCostByRarity.uncommon
    ).toBe(45);
  });

  it('4) RARITY_RANK, RARITY_LIST, RARITY_META, and Vietnamese/English labels follow exact order', () => {
    expect(RARITY_LIST).toEqual([
      'common',
      'uncommon',
      'rare',
      'epic',
      'legendary',
    ]);
    expect(RARITY_RANK).toEqual({
      common: 0,
      uncommon: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
    });
    expect(RARITY_META.uncommon.textClass).toContain('emerald');
    expect(RARITY_LIST.map((r) => getRarityLabel('vi', r))).toEqual([
      'Thường',
      'Hiếm',
      'Chất lượng',
      'Sử thi',
      'Thần thoại',
    ]);
    expect(RARITY_LIST.map((r) => getRarityLabel('en', r))).toEqual([
      'Common',
      'Uncommon',
      'Rare',
      'Epic',
      'Legendary',
    ]);
  });

  it('5) uncommon item price sits strictly between common and rare', () => {
    expect(PRICE_FORMULA.rarityFactor.uncommon).toBe(1.3);
    expect(BALANCE_CONFIG.rarityPriceMultiplier.uncommon).toBe(1.3);

    const commonPrice = computeItemPrice({
      slot: 'main_weapon',
      tier: 2,
      rarity: 'common',
      rollQuality: 50,
      affixCount: 0,
    });
    const uncommonPrice = computeItemPrice({
      slot: 'main_weapon',
      tier: 2,
      rarity: 'uncommon',
      rollQuality: 50,
      affixCount: 0,
    });
    const rarePrice = computeItemPrice({
      slot: 'main_weapon',
      tier: 2,
      rarity: 'rare',
      rollQuality: 50,
      affixCount: 1,
    });

    expect(uncommonPrice).toBeGreaterThan(commonPrice);
    expect(uncommonPrice).toBeLessThan(rarePrice);
  });
});
