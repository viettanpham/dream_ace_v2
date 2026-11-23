import { beforeEach, describe, expect, it } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { EQUIPMENT_SLOTS, ITEM_TEMPLATES, RARITY_LIST } from '../../data/items';
import { PRICE_FORMULA } from '../../data/itemPricing';
import { useGameStore } from '../../store/useGameStore';
import { generateItemInstance, getSellPrice } from '../equipment';
import { computeItemPrice, countNonZeroTraits } from '../itemPrice';
import { CURRENT_SAVE_VERSION, migrateSaveData } from '../migration';
import { buildExportEnvelope, decryptEnvelope, parseImportEnvelope } from '../saveExport';
import { generateCategorizedShopStock } from '../shop';
import { createDefaultPilotAccount } from '../stats';

function createDeterministicRng(seed = 2026): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('D1-2a — Unified Item Price Formula & Engine Integration', () => {
  beforeEach(() => {
    useGameStore.getState().resetCampaign();
  });

  it('1) computes exact expected prices for 6 sample cells across all 6 slots', () => {
    expect(
      computeItemPrice({
        slot: 'main_weapon',
        tier: 1,
        rarity: 'common',
        rollQuality: 50,
      })
    ).toBe(184);

    expect(
      computeItemPrice({
        slot: 'sub_weapon',
        tier: 2,
        rarity: 'rare',
        rollQuality: 50,
      })
    ).toBe(Math.round(173 * 1.74 * 1.65)); // 497

    expect(
      computeItemPrice({
        slot: 'armor',
        tier: 3,
        rarity: 'epic',
        rollQuality: 50,
      })
    ).toBe(Math.round(194 * 2.54 * 2.75)); // 1355

    expect(
      computeItemPrice({
        slot: 'engine',
        tier: 4,
        rarity: 'common',
        rollQuality: 50,
      })
    ).toBe(Math.round(189 * 3.8 * 1.0)); // 718

    expect(
      computeItemPrice({
        slot: 'cpu',
        tier: 2,
        rarity: 'legendary',
        rollQuality: 50,
      })
    ).toBe(Math.round(179 * 1.74 * 4.6)); // 1433

    expect(
      computeItemPrice({
        slot: 'accessory',
        tier: 4,
        rarity: 'rare',
        rollQuality: 80,
      })
    ).toBe(Math.round(173 * 3.8 * 1.65 * (1 + 30 * 0.0028))); // 1176
  });

  it('2) preserves strict monotonic ordering across tiers and rarities for every slot', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      for (const rarity of RARITY_LIST) {
        const prices = [1, 2, 3, 4].map((tier) =>
          computeItemPrice({ slot, tier, rarity, rollQuality: 50 })
        );
        expect(prices[0]).toBeLessThan(prices[1]);
        expect(prices[1]).toBeLessThan(prices[2]);
        expect(prices[2]).toBeLessThan(prices[3]);
      }

      for (const tier of [1, 2, 3, 4]) {
        const prices = RARITY_LIST.map((rarity) =>
          computeItemPrice({ slot, tier, rarity, rollQuality: 50 })
        );
        expect(prices[0]).toBeLessThan(prices[1]);
        expect(prices[1]).toBeLessThan(prices[2]);
        expect(prices[2]).toBeLessThan(prices[3]);
      }
    }
  });

  it('3) adds exact configured affixPct (4%) and traitPct (6%) and ignores zero/false traits', () => {
    expect(PRICE_FORMULA.affixPct).toBe(4);
    expect(PRICE_FORMULA.traitPct).toBe(6);

    expect(
      countNonZeroTraits({
        critBonusPct: 8,
        armorPiercePct: 0,
        longRange: true,
        evasionMod: -2,
      })
    ).toBe(3);
    expect(countNonZeroTraits(undefined)).toBe(0);

    const base = computeItemPrice({
      slot: 'main_weapon',
      tier: 3,
      rarity: 'common',
      rollQuality: 50,
      affixCount: 0,
      traitCount: 0,
    });
    const with2Affixes = computeItemPrice({
      slot: 'main_weapon',
      tier: 3,
      rarity: 'common',
      rollQuality: 50,
      affixCount: 2,
      traitCount: 0,
    });
    const with2Traits = computeItemPrice({
      slot: 'main_weapon',
      tier: 3,
      rarity: 'common',
      rollQuality: 50,
      affixCount: 0,
      traitCount: 2,
    });
    const withBoth = computeItemPrice({
      slot: 'main_weapon',
      tier: 3,
      rarity: 'common',
      rollQuality: 50,
      affixCount: 3,
      traitCount: 2,
    });

    const rawBase = 184 * 2.54;
    expect(base).toBe(Math.round(rawBase));
    expect(with2Affixes).toBe(Math.round(rawBase * (1 + (2 * 4) / 100)));
    expect(with2Traits).toBe(Math.round(rawBase * (1 + (2 * 6) / 100)));
    expect(withBoth).toBe(Math.round(rawBase * (1 + (3 * 4 + 2 * 6) / 100)));
  });

  it('4) enforces minPrice = 20 floor with no hardcoded 60/40 floors', () => {
    expect(PRICE_FORMULA.minPrice).toBe(20);
    // Extreme negative quality yields < 20 before clamping -> floors at minPrice (20), not 60
    const low = computeItemPrice({
      slot: 'sub_weapon',
      tier: 1,
      rarity: 'common',
      rollQuality: -350,
    });
    expect(low).toBe(20);
  });

  it('5) generateItemInstance matches computeItemPrice exactly across templates, fallback tiers, and rarities', () => {
    const rng = createDeterministicRng(777);
    const cases: Array<{ templateId?: string; slot: typeof EQUIPMENT_SLOTS[number]; tier: number; rarity: typeof RARITY_LIST[number]; rollQuality?: number }> = [
      { templateId: 'tpl_mw_nova_beam', slot: 'main_weapon', tier: 4, rarity: 'legendary', rollQuality: 50 },
      { templateId: 'tpl_ac_overclock', slot: 'accessory', tier: 1, rarity: 'common', rollQuality: 50 },
      { slot: 'armor', tier: 2, rarity: 'rare' },
      { slot: 'armor', tier: 4, rarity: 'epic' },
      { slot: 'engine', tier: 4, rarity: 'common' },
      { slot: 'cpu', tier: 3, rarity: 'legendary' },
    ];

    for (const c of cases) {
      const item = generateItemInstance(c, rng);
      const expected = computeItemPrice({
        slot: item.slot,
        tier: item.tier,
        rarity: item.rarity,
        rollQuality: item.rollQuality,
        affixCount: item.affixes.length,
        traitCount: countNonZeroTraits(item.specialTraits),
      });
      expect(item.price).toBe(expected);
      // Sell ratio 0.4 preserved
      expect(getSellPrice(item)).toBe(Math.floor(item.price * 0.4));
    }
  });

  it('6) shop stock applies round(item.price * priceMult) floored at PRICE_FORMULA.minPrice (20, not 40)', () => {
    const mult = 1.35;
    const stock = generateCategorizedShopStock(
      9,
      { priceMultiplier: mult },
      createDeterministicRng(4242)
    );
    expect(stock.length).toBeGreaterThan(0);

    for (const entry of stock) {
      const formulaPrice = computeItemPrice({
        slot: entry.slot,
        tier: entry.tier,
        rarity: entry.rarity,
        rollQuality: entry.rollQuality,
        affixCount: entry.affixes.length,
        traitCount: countNonZeroTraits(entry.specialTraits),
      });
      expect(entry.price).toBe(
        Math.max(PRICE_FORMULA.minPrice, Math.round(formulaPrice * mult))
      );
    }

    // Extreme discount checks minPrice floor = 20 (below legacy 40 floor)
    const discounted = generateCategorizedShopStock(
      1,
      { priceMultiplier: 0.01 },
      createDeterministicRng(13)
    );
    expect(discounted.some((s) => s.price === 20)).toBe(true);
    expect(discounted.every((s) => s.price >= PRICE_FORMULA.minPrice)).toBe(true);
  });

  it('7) priceOverride still wins over computeItemPrice and minPrice', () => {
    const customLow = generateItemInstance(
      {
        templateId: 'tpl_mw_pulse_cannon',
        tier: 1,
        rarity: 'common',
        rollQuality: 50,
        priceOverride: 15,
      },
      () => 0.5
    );
    expect(customLow.price).toBe(15);

    const customHigh = generateItemInstance(
      {
        slot: 'armor',
        tier: 4,
        rarity: 'legendary',
        priceOverride: 9999,
      },
      () => 0.5
    );
    expect(customHigh.price).toBe(9999);
  });

  it('8) preserves old saved item prices untouched after save load / migration / export round-trip & keeps CURRENT_SAVE_VERSION = 9', async () => {
    expect(CURRENT_SAVE_VERSION).toBe(9);
    expect(Array.isArray(BALANCE_CONFIG.tierPriceScale)).toBe(true);

    // Pre-D1-2a item price (e.g. legacy armor T4 common = 928 or armor T4 legendary = 5067)
    const pilot = createDefaultPilotAccount('LegacyAce', 'striker');
    const legacyT4ArmorTpl = ITEM_TEMPLATES.find((t) => t.slot === 'armor')!;
    const legacyItem = {
      ...generateItemInstance({
        templateId: legacyT4ArmorTpl.id,
        tier: 4,
        rarity: 'legendary',
        rollQuality: 50,
      }),
      instanceId: 'legacy_armor_t4_5067',
      price: 5067,
    };
    const formulaNow = computeItemPrice({
      slot: 'armor',
      tier: 4,
      rarity: 'legendary',
      rollQuality: 50,
      affixCount: legacyItem.affixes.length,
      traitCount: countNonZeroTraits(legacyItem.specialTraits),
    });
    expect(formulaNow).not.toBe(5067);

    pilot.inventory = [legacyItem];

    // Direct migrateSaveData load
    const migrated = migrateSaveData(
      {
        pilot,
        shopStock: [],
        wpMarketOffers: [],
        battlesUntilRestock: 3,
      },
      CURRENT_SAVE_VERSION
    );
    const loadedItem = migrated.pilot.inventory.find(
      (it) => it.instanceId === 'legacy_armor_t4_5067'
    );
    expect(loadedItem?.price).toBe(5067);

    // Envelope export -> import round-trip keeps legacy stored price
    const env = await buildExportEnvelope({
      pilot,
      shopStock: [],
      wpMarketOffers: [],
      battlesUntilRestock: 3,
      hasSaveData: true,
      muted: true,
      battleSpeed: 1,
      skipAnimations: false,
      battleViewMode: 'radar',
      language: 'vi',
    });
    const parsed = await parseImportEnvelope(JSON.stringify(env));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const dec = await decryptEnvelope(parsed.envelope);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    const importedMigrated = migrateSaveData(dec.state, env.saveVersion);
    expect(
      importedMigrated.pilot.inventory.find(
        (it) => it.instanceId === 'legacy_armor_t4_5067'
      )?.price
    ).toBe(5067);
  });
});
