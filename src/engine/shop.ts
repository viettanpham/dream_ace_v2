import { PRICE_FORMULA } from '../data/itemPricing';
import { EQUIPMENT_SLOTS, ITEM_TEMPLATES } from '../data/items';
import { SECTORS_CATALOG } from '../data/maps';
import {
  DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS,
  SHOP_STOCK_CONFIG,
} from '../data/shopConfig';
import type {
  AdminConfig,
  ConsumableKind,
  ItemRarity,
  PilotAccount,
  ShopItemListing,
  WpMarketOffer,
} from '../types/game';
import { generateItemInstance, pickWeightedRarity } from './equipment';

let wpOfferSeq = 1;

/**
 * Checks whether the pilot owns at least one operational allied Shipyard base,
 * which grants extra shop stock slots.
 */
export function hasOperationalShipyard(pilot: Pick<PilotAccount, 'baseStates'> | null | undefined): boolean {
  if (!pilot?.baseStates) return false;
  return SECTORS_CATALOG.some((sec) => {
    if (sec.baseType !== 'shipyard') return false;
    const st = pilot.baseStates[sec.id];
    return st?.faction === 'allied' && st?.status === 'operational';
  });
}

/**
 * Rolls an integer count in [minStock, maxStock] using weights skewed toward the low end.
 * Guaranteed >= 1 and strictly within [minBound, maxBound].
 */
export function rollWeightedStockCount(
  minStock: number = SHOP_STOCK_CONFIG.minStockPerCategory,
  maxStock: number = SHOP_STOCK_CONFIG.maxStockPerCategory,
  weights: Record<number, number> = SHOP_STOCK_CONFIG.stockCountWeights,
  bonusShift = 0,
  rng: () => number = Math.random
): number {
  const safeMin = Math.max(1, Math.min(10, Math.floor(minStock)));
  const safeMax = Math.max(safeMin, Math.min(10, Math.floor(maxStock)));

  const candidates: Array<{ count: number; weight: number }> = [];
  let totalWeight = 0;
  for (let c = safeMin; c <= safeMax; c++) {
    const w = Math.max(1, weights[c] ?? Math.max(1, 12 - c));
    candidates.push({ count: c, weight: w });
    totalWeight += w;
  }

  let roll = rng() * totalWeight;
  let picked = safeMin;
  for (const entry of candidates) {
    if (roll < entry.weight) {
      picked = entry.count;
      break;
    }
    roll -= entry.weight;
  }

  return Math.max(safeMin, Math.min(safeMax, picked + Math.max(0, Math.floor(bonusShift))));
}

export interface CategorizedShopOptions {
  minStock?: number;
  maxStock?: number;
  rarityWeights?: Record<ItemRarity, number> | null;
  priceMultiplier?: number;
  shipyardBonus?: boolean;
}

/**
 * Generates random Credits Shop stock across every EquipmentSlot category.
 * Each category receives between minStock and maxStock (default 3..10, weighted low)
 * items. Never returns an empty list.
 */
export function generateCategorizedShopStock(
  referenceLevel: number,
  options: CategorizedShopOptions = {},
  rng: () => number = Math.random
): ShopItemListing[] {
  const maxTier =
    referenceLevel >= 9 ? 4 : referenceLevel >= 6 ? 3 : referenceLevel >= 3 ? 2 : 1;

  const baseMin = Math.max(
    1,
    Math.min(10, Math.floor(options.minStock ?? SHOP_STOCK_CONFIG.minStockPerCategory))
  );
  const baseMax = Math.max(
    baseMin,
    Math.min(10, Math.floor(options.maxStock ?? SHOP_STOCK_CONFIG.maxStockPerCategory))
  );
  const bonusShift = options.shipyardBonus ? SHOP_STOCK_CONFIG.shipyardStockBonus : 0;

  const defaultTierWeights =
    SHOP_STOCK_CONFIG.rarityWeightsByTier[maxTier] ??
    DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS;
  const weights = options.rarityWeights ?? defaultTierWeights;
  const priceMult =
    typeof options.priceMultiplier === 'number' && options.priceMultiplier > 0
      ? options.priceMultiplier
      : 1.0;

  const stock: ShopItemListing[] = [];

  for (const slot of EQUIPMENT_SLOTS) {
    const countForSlot = rollWeightedStockCount(
      baseMin,
      baseMax,
      SHOP_STOCK_CONFIG.stockCountWeights,
      bonusShift,
      rng
    );
    const eligibleTemplates = ITEM_TEMPLATES.filter(
      (t) => t.slot === slot && t.tier <= maxTier
    );
    const fallbackTemplates =
      eligibleTemplates.length > 0
        ? eligibleTemplates
        : ITEM_TEMPLATES.filter((t) => t.slot === slot);

    for (let i = 0; i < countForSlot; i++) {
      const pickedTpl =
        fallbackTemplates[Math.floor(rng() * fallbackTemplates.length)] ??
        ITEM_TEMPLATES[0];
      const rarity = pickWeightedRarity(weights, rng);
      const tier = Math.min(maxTier, Math.max(1, pickedTpl.tier));
      const item = generateItemInstance(
        {
          templateId: pickedTpl.id,
          tier,
          rarity,
        },
        rng
      );
      stock.push({
        ...item,
        price: Math.max(PRICE_FORMULA.minPrice, Math.round(item.price * priceMult)),
        soldOut: false,
      });
    }
  }

  return stock;
}

/**
 * Generates 3..10 rotating random War Point Market offers (Equipment Crates,
 * Enchant Stones, Respec Tokens, EXP Boosts). Never empty.
 */
export function generateWpMarketOffers(
  options: {
    minOffers?: number;
    maxOffers?: number;
    shipyardBonus?: boolean;
  } = {},
  rng: () => number = Math.random
): WpMarketOffer[] {
  const count = rollWeightedStockCount(
    options.minOffers ?? SHOP_STOCK_CONFIG.wpMinOffers,
    options.maxOffers ?? SHOP_STOCK_CONFIG.wpMaxOffers,
    SHOP_STOCK_CONFIG.stockCountWeights,
    options.shipyardBonus ? 1 : 0,
    rng
  );

  const kindPool: ConsumableKind[] = [
    'equipment_crate',
    'equipment_crate',
    'enchant_stone',
    'enchant_stone',
    'respec_token',
    'exp_boost',
  ];

  const offers: WpMarketOffer[] = [];
  // Ensure variety: guarantee at least one Equipment Crate and one Enchant Stone if count >= 2
  const guaranteedKinds: ConsumableKind[] = ['equipment_crate', 'enchant_stone'];

  for (let i = 0; i < count; i++) {
    const kind: ConsumableKind =
      i < guaranteedKinds.length
        ? guaranteedKinds[i]
        : kindPool[Math.floor(rng() * kindPool.length)];
    wpOfferSeq += 1;
    const id = `wp_offer_${Date.now().toString(36)}_${wpOfferSeq}_${Math.floor(
      rng() * 1e5
    ).toString(36)}`;

    if (kind === 'equipment_crate') {
      const crateCfg = SHOP_STOCK_CONFIG.wpOffers.equipmentCrate;
      const slot =
        crateCfg.slots[Math.floor(rng() * crateCfg.slots.length)] ?? 'main_weapon';
      const minRarity = pickWeightedRarity(crateCfg.rarityWeights, rng);
      offers.push({
        id,
        kind,
        slot,
        minRarity,
        wpCost: crateCfg.baseWpCostByRarity[minRarity] ?? 55,
        soldOut: false,
      });
    } else if (kind === 'enchant_stone') {
      offers.push({
        id,
        kind,
        bonusPct: SHOP_STOCK_CONFIG.wpOffers.enchantStone.bonusPct,
        wpCost: SHOP_STOCK_CONFIG.wpOffers.enchantStone.wpCost,
        soldOut: false,
      });
    } else if (kind === 'respec_token') {
      offers.push({
        id,
        kind,
        wpCost: SHOP_STOCK_CONFIG.wpOffers.respecToken.wpCost,
        soldOut: false,
      });
    } else {
      offers.push({
        id,
        kind: 'exp_boost',
        battlesCount: SHOP_STOCK_CONFIG.wpOffers.expBoost.battlesCount,
        bonusPct: SHOP_STOCK_CONFIG.wpOffers.expBoost.expBonusPct,
        wpCost: SHOP_STOCK_CONFIG.wpOffers.expBoost.wpCost,
        soldOut: false,
      });
    }
  }

  return offers;
}

/**
 * Helper to derive CategorizedShopOptions from AdminConfig + PilotAccount.
 */
export function buildShopOptionsFromState(
  pilot: Pick<PilotAccount, 'baseStates'> | null | undefined,
  adminConfig?: Partial<AdminConfig> | null
): CategorizedShopOptions {
  const customWeights =
    adminConfig?.shopRarityWeights &&
    (adminConfig.shopRarityWeights.common !==
      DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.common ||
      adminConfig.shopRarityWeights.rare !==
        DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.rare ||
      adminConfig.shopRarityWeights.epic !==
        DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.epic ||
      adminConfig.shopRarityWeights.legendary !==
        DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.legendary)
      ? adminConfig.shopRarityWeights
      : null;

  return {
    minStock: adminConfig?.shopMinStock ?? SHOP_STOCK_CONFIG.minStockPerCategory,
    maxStock: adminConfig?.shopMaxStock ?? SHOP_STOCK_CONFIG.maxStockPerCategory,
    rarityWeights: customWeights,
    priceMultiplier: adminConfig?.shopPriceMultiplier ?? 1.0,
    shipyardBonus: hasOperationalShipyard(pilot),
  };
}
