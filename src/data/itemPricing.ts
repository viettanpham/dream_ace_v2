import type { EquipmentSlot, ItemRarity } from '../types/game';

/**
 * Single centralized item pricing formula parameters (D1-2a).
 * All newly generated item prices derive strictly from these coefficients.
 */
export const PRICE_FORMULA = {
  baseBySlot: {
    main_weapon: 184,
    sub_weapon: 173,
    armor: 194,
    engine: 189,
    cpu: 179,
    accessory: 173,
  } as Record<EquipmentSlot, number>,
  tierFactor: [1, 1.74, 2.54, 3.8] as readonly number[],
  rarityFactor: {
    common: 1,
    rare: 1.65,
    epic: 2.75,
    legendary: 4.6,
  } as Record<ItemRarity, number>,
  qualitySlopePerPoint: 0.0028,
  affixPct: 4,
  traitPct: 6,
  minPrice: 20,
} as const;
