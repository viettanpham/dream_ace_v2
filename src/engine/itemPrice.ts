import { SHOP_CONFIG } from '../data/items';
import { PRICE_FORMULA } from '../data/itemPricing';
import type {
  EquipmentSlot,
  ItemRarity,
  ItemSpecialTraits,
  ModuleTemplate,
  SupplyTemplate,
} from '../types/game';

export interface ComputeItemPriceInput {
  slot: EquipmentSlot;
  tier: number;
  rarity: ItemRarity;
  rollQuality: number;
  affixCount?: number;
  traitCount?: number;
}

/**
 * Counts special trait keys that have a non-zero / truthy value.
 */
export function countNonZeroTraits(traits?: ItemSpecialTraits | null): number {
  if (!traits) return 0;
  let count = 0;
  for (const val of Object.values(traits)) {
    if (typeof val === 'number') {
      if (Number.isFinite(val) && val !== 0) count += 1;
    } else if (typeof val === 'boolean') {
      if (val) count += 1;
    }
  }
  return count;
}

/**
 * Single unified item price formula for all newly generated items.
 * price = max(minPrice, round(base * tierFactor * rarityFactor * (1 + (q - 50) * slope) * (1 + affixCount * affixPct / 100 + traitCount * traitPct / 100)))
 */
export function computeItemPrice(input: ComputeItemPriceInput): number {
  const {
    slot,
    tier,
    rarity,
    rollQuality,
    affixCount = 0,
    traitCount = 0,
  } = input;
  const base =
    slot === 'module'
      ? PRICE_FORMULA.moduleBase.stat
      : PRICE_FORMULA.baseBySlot[slot];
  const tierIdx = Math.max(
    0,
    Math.min(PRICE_FORMULA.tierFactor.length - 1, Math.round(tier) - 1)
  );
  const tierFactor = PRICE_FORMULA.tierFactor[tierIdx] ?? 1;
  const rarityFactor = PRICE_FORMULA.rarityFactor[rarity] ?? 1;
  const qualityMult =
    1 + (rollQuality - 50) * PRICE_FORMULA.qualitySlopePerPoint;
  const affixAndTraitMult =
    1 +
    (Math.max(0, affixCount) * PRICE_FORMULA.affixPct) / 100 +
    (Math.max(0, traitCount) * PRICE_FORMULA.traitPct) / 100;

  return Math.max(
    PRICE_FORMULA.minPrice,
    Math.round(base * tierFactor * rarityFactor * qualityMult * affixAndTraitMult)
  );
}

/**
 * Single unified price formula for battle supply templates.
 * priceOverride wins if present and positive; otherwise max(minPrice, round(base * tierFactor[tier - 1])).
 */
export function computeSupplyPrice(
  template: Pick<SupplyTemplate, 'family' | 'tier' | 'priceOverride'>
): number {
  if (
    typeof template.priceOverride === 'number' &&
    Number.isFinite(template.priceOverride) &&
    template.priceOverride > 0
  ) {
    return Math.round(template.priceOverride);
  }
  const base = PRICE_FORMULA.consumableBase[template.family];
  const tierIdx = Math.max(
    0,
    Math.min(PRICE_FORMULA.tierFactor.length - 1, Math.round(template.tier) - 1)
  );
  const tierFactor = PRICE_FORMULA.tierFactor[tierIdx] ?? 1;
  return Math.max(PRICE_FORMULA.minPrice, Math.round(base * tierFactor));
}

/**
 * Single unified buy price formula for extender modules:
 * round(moduleBase[family] * tierFactor[tier - 1]).
 */
export function computeModulePrice(
  template: Pick<ModuleTemplate, 'family' | 'tier'>
): number {
  const base = PRICE_FORMULA.moduleBase[template.family];
  const tierIdx = Math.max(
    0,
    Math.min(PRICE_FORMULA.tierFactor.length - 1, Math.round(template.tier) - 1)
  );
  const tierFactor = PRICE_FORMULA.tierFactor[tierIdx] ?? 1;
  return Math.round(base * tierFactor);
}

/**
 * Sell price for an extender module using the unified shop sell ratio.
 */
export function getModuleSellPrice(
  template: Pick<ModuleTemplate, 'family' | 'tier'>
): number {
  return Math.round(computeModulePrice(template) * SHOP_CONFIG.sellPriceRatio);
}
