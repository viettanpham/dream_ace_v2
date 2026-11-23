import { describe, expect, it, vi } from 'vitest';
import rawItemsJson from '../items.json';
import rawPricingJson from '../itemPricing.json';
import {
  BUILTIN_ITEM_REGISTRY_TAG,
  EQUIPMENT_SLOTS,
  ITEM_TEMPLATES,
  ITEM_TEMPLATES_BY_ID,
  RARITY_LIST,
  validateItemTemplates,
} from '../items';
import {
  DEFAULT_PRICE_FORMULA,
  PRICE_FORMULA,
  validatePriceFormula,
} from '../itemPricing';
import { generateItemInstance } from '../../engine/equipment';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { generateCategorizedShopStock } from '../../engine/shop';

function createDeterministicRng(seed = 20261123): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('D1-2b — Pre/Post JSON Migration Equality Guard', () => {
  it('matches the pre-move deep JSON snapshot of ITEM_TEMPLATES and ITEM_TEMPLATES_BY_ID byte for byte', () => {
    expect(JSON.stringify(ITEM_TEMPLATES)).toMatchSnapshot();
    expect(JSON.stringify(ITEM_TEMPLATES_BY_ID)).toMatchSnapshot();
  });

  it('matches the pre-move deep JSON snapshot of PRICE_FORMULA byte for byte', () => {
    expect(JSON.stringify(PRICE_FORMULA)).toMatchSnapshot();
  });

  it('produces byte-for-byte identical generateItemInstance and generateCategorizedShopStock outputs for the same seed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
    try {
      const rng = createDeterministicRng(987654);
      const generated = [];
      for (const slot of EQUIPMENT_SLOTS) {
        for (const tier of [1, 2, 3, 4]) {
          for (const rarity of RARITY_LIST) {
            generated.push(
              generateItemInstance(
                { slot, tier, rarity },
                rng
              )
            );
          }
        }
      }

      const shopRng = createDeterministicRng(123456);
      const stockLv3 = generateCategorizedShopStock(3, { priceMultiplier: 1.0 }, shopRng);
      const stockLv10 = generateCategorizedShopStock(10, { priceMultiplier: 1.25 }, shopRng);

      expect(
        JSON.stringify({
          generated,
          stockLv3,
          stockLv10,
        })
      ).toMatchSnapshot();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('D1-2b — JSON Data Schema & Typed Loaders', () => {
  it('items.json has schemaVersion 1 and 36 valid sys templates, and CURRENT_SAVE_VERSION stays 9', () => {
    expect(CURRENT_SAVE_VERSION).toBe(10);
    expect(rawItemsJson.schemaVersion).toBe(1);
    expect(Array.isArray(rawItemsJson.templates)).toBe(true);
    expect(rawItemsJson.templates).toHaveLength(36);
    expect(ITEM_TEMPLATES).toHaveLength(36);
    expect(
      ITEM_TEMPLATES.every((t) => t.registryTag === BUILTIN_ITEM_REGISTRY_TAG)
    ).toBe(true);
    expect(rawPricingJson).toEqual(PRICE_FORMULA);
  });

  it('validateItemTemplates drops broken/duplicate rows with console.warn listing ids without crashing', () => {
    const baseValid = structuredClone(rawItemsJson.templates[0]);
    const validSecond = structuredClone(rawItemsJson.templates[1]);

    const badMissingField = { ...structuredClone(baseValid), id: 'bad_missing_name', nameEn: '' };
    const badSlot = { ...structuredClone(baseValid), id: 'bad_slot', slot: 'wing_cannon' };
    const badTier = { ...structuredClone(baseValid), id: 'bad_tier', tier: 5 };
    const badRange = { ...structuredClone(baseValid), id: 'bad_range', primaryRange: [20, 10] };
    const badAffix = { ...structuredClone(baseValid), id: 'bad_affix', affixPool: ['attack', 'luck'] };
    const dupRow = { ...structuredClone(baseValid) }; // duplicates baseValid.id

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const loaded = validateItemTemplates({
        schemaVersion: 1,
        templates: [
          baseValid,
          badMissingField,
          badSlot,
          badTier,
          badRange,
          badAffix,
          dupRow,
          validSecond,
          null,
        ],
      });

      expect(loaded).toHaveLength(2);
      expect(loaded.map((t) => t.id)).toEqual([baseValid.id, validSecond.id]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warnMsg = String(warnSpy.mock.calls[0][0]);
      expect(warnMsg).toContain('bad_missing_name');
      expect(warnMsg).toContain('bad_slot');
      expect(warnMsg).toContain('bad_tier');
      expect(warnMsg).toContain('bad_range');
      expect(warnMsg).toContain('bad_affix');
      expect(warnMsg).toContain(baseValid.id);
      expect(warnMsg).toContain('#8');

      // Malformed top-level payload also warns safely and returns []
      const emptyResult = validateItemTemplates({ schemaVersion: 1, templates: 'invalid' });
      expect(emptyResult).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('validatePriceFormula falls back per invalid field with console.warn while preserving valid fields', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const partialInvalid = {
        baseBySlot: {
          main_weapon: 210, // valid custom override
          sub_weapon: 173,
          armor: -10, // invalid <= 0
          engine: 189,
          cpu: 'not-a-number', // invalid type
          accessory: 173,
        },
        tierFactor: [1, 1.74, 0, 3.8], // invalid tierFactor[2] <= 0
        rarityFactor: {
          common: 1,
          rare: 1.65,
          epic: 2.75,
          legendary: -4, // invalid <= 0
        },
        qualitySlopePerPoint: 0.005, // valid custom override
        affixPct: 0, // invalid <= 0
        traitPct: 6,
        minPrice: Number.NaN, // invalid non-finite
      };

      const validated = validatePriceFormula(partialInvalid);

      expect(validated.baseBySlot.main_weapon).toBe(210);
      expect(validated.baseBySlot.armor).toBe(DEFAULT_PRICE_FORMULA.baseBySlot.armor);
      expect(validated.baseBySlot.cpu).toBe(DEFAULT_PRICE_FORMULA.baseBySlot.cpu);
      expect(validated.tierFactor).toEqual([1, 1.74, DEFAULT_PRICE_FORMULA.tierFactor[2], 3.8]);
      expect(validated.rarityFactor.epic).toBe(2.75);
      expect(validated.rarityFactor.legendary).toBe(DEFAULT_PRICE_FORMULA.rarityFactor.legendary);
      expect(validated.qualitySlopePerPoint).toBe(0.005);
      expect(validated.affixPct).toBe(DEFAULT_PRICE_FORMULA.affixPct);
      expect(validated.traitPct).toBe(6);
      expect(validated.minPrice).toBe(DEFAULT_PRICE_FORMULA.minPrice);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warnMsg = String(warnSpy.mock.calls[0][0]);
      expect(warnMsg).toContain('baseBySlot.armor');
      expect(warnMsg).toContain('baseBySlot.cpu');
      expect(warnMsg).toContain('tierFactor[2]');
      expect(warnMsg).toContain('rarityFactor.legendary');
      expect(warnMsg).toContain('affixPct');
      expect(warnMsg).toContain('minPrice');

      // Wrong tier array length and null root fallback
      const wrongTierLen = validatePriceFormula({
        ...rawPricingJson,
        tierFactor: [1, 2, 3],
      });
      expect(wrongTierLen.tierFactor).toEqual(DEFAULT_PRICE_FORMULA.tierFactor);
      expect(validatePriceFormula(null)).toEqual(DEFAULT_PRICE_FORMULA);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
