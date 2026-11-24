import type { EquipmentSlot, ItemRarity, SupplyFamily } from '../types/game';
import rawPricingData from './itemPricing.json';

export interface PriceFormulaConfig {
  readonly baseBySlot: Record<EquipmentSlot, number>;
  readonly tierFactor: readonly number[];
  readonly rarityFactor: Record<ItemRarity, number>;
  readonly qualitySlopePerPoint: number;
  readonly affixPct: number;
  readonly traitPct: number;
  readonly minPrice: number;
  readonly consumableBase: Record<SupplyFamily, number>;
}

const SLOTS: readonly EquipmentSlot[] = [
  'main_weapon',
  'sub_weapon',
  'armor',
  'engine',
  'cpu',
  'accessory',
];

const RARITIES: readonly ItemRarity[] = ['common', 'rare', 'epic', 'legendary'];
const SUPPLY_FAMILIES: readonly SupplyFamily[] = [
  'hp_kit',
  'shield_kit',
  'sp_kit',
  'buff',
];

export const DEFAULT_PRICE_FORMULA: PriceFormulaConfig = {
  baseBySlot: {
    main_weapon: 184,
    sub_weapon: 173,
    armor: 194,
    engine: 189,
    cpu: 179,
    accessory: 173,
  },
  tierFactor: [1, 1.74, 2.54, 3.8],
  rarityFactor: {
    common: 1,
    rare: 1.65,
    epic: 2.75,
    legendary: 4.6,
  },
  qualitySlopePerPoint: 0.0028,
  affixPct: 4,
  traitPct: 6,
  minPrice: 20,
  consumableBase: {
    hp_kit: 30,
    shield_kit: 30,
    sp_kit: 36,
    buff: 60,
  },
};

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function asPlainObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Validates raw itemPricing JSON data and falls back per invalid field with console.warn.
 */
export function validatePriceFormula(raw: unknown): PriceFormulaConfig {
  const obj = asPlainObject(raw);
  const warnings: string[] = [];

  if (!obj) {
    console.warn('[itemPricing] Invalid itemPricing JSON root; falling back to defaults.');
    return {
      baseBySlot: { ...DEFAULT_PRICE_FORMULA.baseBySlot },
      tierFactor: [...DEFAULT_PRICE_FORMULA.tierFactor],
      rarityFactor: { ...DEFAULT_PRICE_FORMULA.rarityFactor },
      qualitySlopePerPoint: DEFAULT_PRICE_FORMULA.qualitySlopePerPoint,
      affixPct: DEFAULT_PRICE_FORMULA.affixPct,
      traitPct: DEFAULT_PRICE_FORMULA.traitPct,
      minPrice: DEFAULT_PRICE_FORMULA.minPrice,
      consumableBase: { ...DEFAULT_PRICE_FORMULA.consumableBase },
    };
  }

  const rawSlots = asPlainObject(obj.baseBySlot);
  if (!rawSlots) warnings.push('baseBySlot');
  const baseBySlot = {} as Record<EquipmentSlot, number>;
  for (const slot of SLOTS) {
    const val = rawSlots?.[slot];
    if (isPositiveNumber(val)) {
      baseBySlot[slot] = val;
    } else {
      if (rawSlots) warnings.push(`baseBySlot.${slot}`);
      baseBySlot[slot] = DEFAULT_PRICE_FORMULA.baseBySlot[slot];
    }
  }

  const rawTiers = Array.isArray(obj.tierFactor) ? obj.tierFactor : null;
  const tierFactor: number[] = [];
  if (!rawTiers || rawTiers.length !== 4) {
    warnings.push('tierFactor');
    tierFactor.push(...DEFAULT_PRICE_FORMULA.tierFactor);
  } else {
    for (let i = 0; i < 4; i++) {
      if (isPositiveNumber(rawTiers[i])) {
        tierFactor.push(rawTiers[i] as number);
      } else {
        warnings.push(`tierFactor[${i}]`);
        tierFactor.push(DEFAULT_PRICE_FORMULA.tierFactor[i]);
      }
    }
  }

  const rawRarities = asPlainObject(obj.rarityFactor);
  if (!rawRarities) warnings.push('rarityFactor');
  const rarityFactor = {} as Record<ItemRarity, number>;
  for (const rarity of RARITIES) {
    const val = rawRarities?.[rarity];
    if (isPositiveNumber(val)) {
      rarityFactor[rarity] = val;
    } else {
      if (rawRarities) warnings.push(`rarityFactor.${rarity}`);
      rarityFactor[rarity] = DEFAULT_PRICE_FORMULA.rarityFactor[rarity];
    }
  }

  const pickPositive = (
    key: 'qualitySlopePerPoint' | 'affixPct' | 'traitPct' | 'minPrice'
  ): number => {
    const val = obj[key];
    if (isPositiveNumber(val)) return val;
    warnings.push(key);
    return DEFAULT_PRICE_FORMULA[key];
  };

  const rawConsumableBase = asPlainObject(obj.consumableBase);
  if (!rawConsumableBase) warnings.push('consumableBase');
  const consumableBase = {} as Record<SupplyFamily, number>;
  for (const family of SUPPLY_FAMILIES) {
    const val = rawConsumableBase?.[family];
    if (isPositiveNumber(val)) {
      consumableBase[family] = val;
    } else {
      if (rawConsumableBase) warnings.push(`consumableBase.${family}`);
      consumableBase[family] = DEFAULT_PRICE_FORMULA.consumableBase[family];
    }
  }

  const result: PriceFormulaConfig = {
    baseBySlot,
    tierFactor,
    rarityFactor,
    qualitySlopePerPoint: pickPositive('qualitySlopePerPoint'),
    affixPct: pickPositive('affixPct'),
    traitPct: pickPositive('traitPct'),
    minPrice: pickPositive('minPrice'),
    consumableBase,
  };

  if (warnings.length > 0) {
    console.warn(
      `[itemPricing] Invalid field(s) [${warnings.join(', ')}]; using built-in defaults for those fields.`
    );
  }

  return result;
}

/**
 * Single centralized item pricing formula parameters (D1-2a / D1-2b).
 * All newly generated item prices derive strictly from these validated JSON coefficients.
 */
export const PRICE_FORMULA: PriceFormulaConfig = validatePriceFormula(rawPricingData);
