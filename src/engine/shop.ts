import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../data/consumables';
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
  ItemLevelsConfig,
  ItemRarity,
  ItemTemplate,
  PaperDollSlot,
  PilotAccount,
  ShopItemListing,
  SupplyShopListing,
  SupplyTemplate,
  WpMarketOffer,
} from '../types/game';
import { generateItemInstance, pickWeightedRarity } from './equipment';
import {
  DEFAULT_ITEM_LEVELS_CONFIG,
  getEffectiveTemplateRequiredLevel,
  getShopEligibleTemplatesForSlot,
  sanitizeItemLevelsConfig,
} from './itemLevels';
import { SUPPLY_STACK_CAP } from './supplies';

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
  itemLevels?: ItemLevelsConfig;
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
  const levelCfg = options.itemLevels
    ? sanitizeItemLevelsConfig(options.itemLevels)
    : DEFAULT_ITEM_LEVELS_CONFIG;

  const baseMin = Math.max(
    1,
    Math.min(10, Math.floor(options.minStock ?? SHOP_STOCK_CONFIG.minStockPerCategory))
  );
  const baseMax = Math.max(
    baseMin,
    Math.min(10, Math.floor(options.maxStock ?? SHOP_STOCK_CONFIG.maxStockPerCategory))
  );
  const bonusShift = options.shipyardBonus ? SHOP_STOCK_CONFIG.shipyardStockBonus : 0;

  const nonModuleTemplates = ITEM_TEMPLATES.filter((t) => t.slot !== 'module');
  const eligibleBySlot = new Map<PaperDollSlot, ItemTemplate[]>();
  let maxEligibleTier = 1;
  for (const slot of EQUIPMENT_SLOTS) {
    const eligible = getShopEligibleTemplatesForSlot(
      nonModuleTemplates,
      slot,
      referenceLevel,
      levelCfg
    );
    eligibleBySlot.set(slot, eligible);
    for (const tpl of eligible) {
      if (tpl.tier > maxEligibleTier) maxEligibleTier = tpl.tier;
    }
  }
  const weightTier = Math.max(1, Math.min(4, maxEligibleTier));

  const defaultTierWeights =
    SHOP_STOCK_CONFIG.rarityWeightsByTier[weightTier] ??
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
    const eligibleTemplates = eligibleBySlot.get(slot) ?? [];
    const slotTemplates = nonModuleTemplates.filter((t) => t.slot === slot);
    let fallbackPool = slotTemplates;
    if (eligibleTemplates.length === 0 && slotTemplates.length > 0) {
      const minReq = Math.min(
        ...slotTemplates.map((t) => getEffectiveTemplateRequiredLevel(t, levelCfg))
      );
      fallbackPool = slotTemplates.filter(
        (t) => getEffectiveTemplateRequiredLevel(t, levelCfg) === minReq
      );
    }
    const fallbackTemplates =
      eligibleTemplates.length > 0 ? eligibleTemplates : fallbackPool;

    for (let i = 0; i < countForSlot; i++) {
      const pickedTpl =
        fallbackTemplates[Math.floor(rng() * fallbackTemplates.length)] ??
        nonModuleTemplates[0];
      const rarity = pickWeightedRarity(weights, rng);
      const item = generateItemInstance(
        {
          templateId: pickedTpl.id,
          tier: pickedTpl.tier,
          statPowerLevel: getEffectiveTemplateRequiredLevel(pickedTpl, levelCfg),
          rarity,
          itemLevels: levelCfg,
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
    itemLevels: adminConfig?.itemLevels,
  };
}

export const DEFAULT_SUPPLY_SHOP_MIN_TYPES = 2;
export const DEFAULT_SUPPLY_SHOP_MAX_TYPES = 5;
export const MIN_SUPPLY_SHOP_TYPES = 1;
export const MAX_SUPPLY_SHOP_TYPES = 12;

export const DEFAULT_SUPPLY_SHOP_MIN_QTY = 3;
export const DEFAULT_SUPPLY_SHOP_MAX_QTY = 15;
export const MIN_SUPPLY_SHOP_QTY = 1;
export const MAX_SUPPLY_SHOP_QTY = SUPPLY_STACK_CAP;

function clampSupplyInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

export function sanitizeSupplyShopConfig(
  cfg?: Pick<
    Partial<AdminConfig>,
    | 'supplyShopMinTypes'
    | 'supplyShopMaxTypes'
    | 'supplyShopMinQty'
    | 'supplyShopMaxQty'
  > | null
): {
  supplyShopMinTypes: number;
  supplyShopMaxTypes: number;
  supplyShopMinQty: number;
  supplyShopMaxQty: number;
} {
  const minTypes = clampSupplyInt(
    cfg?.supplyShopMinTypes,
    MIN_SUPPLY_SHOP_TYPES,
    MAX_SUPPLY_SHOP_TYPES,
    DEFAULT_SUPPLY_SHOP_MIN_TYPES
  );
  const maxTypes = Math.max(
    minTypes,
    clampSupplyInt(
      cfg?.supplyShopMaxTypes,
      MIN_SUPPLY_SHOP_TYPES,
      MAX_SUPPLY_SHOP_TYPES,
      DEFAULT_SUPPLY_SHOP_MAX_TYPES
    )
  );
  const minQty = clampSupplyInt(
    cfg?.supplyShopMinQty,
    MIN_SUPPLY_SHOP_QTY,
    MAX_SUPPLY_SHOP_QTY,
    DEFAULT_SUPPLY_SHOP_MIN_QTY
  );
  const maxQty = Math.max(
    minQty,
    clampSupplyInt(
      cfg?.supplyShopMaxQty,
      MIN_SUPPLY_SHOP_QTY,
      MAX_SUPPLY_SHOP_QTY,
      DEFAULT_SUPPLY_SHOP_MAX_QTY
    )
  );
  return {
    supplyShopMinTypes: minTypes,
    supplyShopMaxTypes: maxTypes,
    supplyShopMinQty: minQty,
    supplyShopMaxQty: maxQty,
  };
}

export function getMaxGearLevel(
  pilot: Pick<PilotAccount, 'gears'> | null | undefined
): number {
  const gears = pilot?.gears;
  if (!gears || typeof gears !== 'object') return 1;
  let maxLv = 1;
  for (const gear of Object.values(gears)) {
    if (gear && typeof gear.level === 'number' && Number.isFinite(gear.level)) {
      maxLv = Math.max(maxLv, Math.floor(gear.level));
    }
  }
  return maxLv;
}

export function sanitizeSupplyShopStock(rawStock: unknown): SupplyShopListing[] {
  if (!Array.isArray(rawStock)) return [];
  const seen = new Set<string>();
  const clean: SupplyShopListing[] = [];

  for (const entry of rawStock) {
    if (!entry || typeof entry !== 'object') continue;
    const rawId = (entry as { templateId?: unknown }).templateId;
    const tplId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!tplId || !getSupplyTemplateById(tplId) || seen.has(tplId)) {
      continue;
    }
    seen.add(tplId);
    const rawRem = (entry as { remaining?: unknown }).remaining;
    const remaining =
      typeof rawRem === 'number' && Number.isFinite(rawRem)
        ? Math.max(0, Math.min(SUPPLY_STACK_CAP, Math.round(rawRem)))
        : 0;
    clean.push({
      templateId: tplId,
      remaining,
    });
  }

  return clean;
}

function rollIntInclusive(
  min: number,
  max: number,
  rng: () => number
): number {
  if (max <= min) return min;
  const span = max - min + 1;
  return Math.min(max, min + Math.floor(rng() * span));
}

/**
 * Generates N distinct battle supply listings with unlockLevel <= maxGearLevel,
 * equal weight per template, and random remaining quantity per template.
 */
export function generateSupplyShopStock(
  maxGearLevel: number,
  cfg?: Pick<
    Partial<AdminConfig>,
    | 'supplyShopMinTypes'
    | 'supplyShopMaxTypes'
    | 'supplyShopMinQty'
    | 'supplyShopMaxQty'
  > | null,
  templates: readonly SupplyTemplate[] = SUPPLY_TEMPLATES,
  rng: () => number = Math.random
): SupplyShopListing[] {
  const {
    supplyShopMinTypes,
    supplyShopMaxTypes,
    supplyShopMinQty,
    supplyShopMaxQty,
  } = sanitizeSupplyShopConfig(cfg);

  const levelCap = Number.isFinite(maxGearLevel)
    ? Math.max(1, Math.floor(maxGearLevel))
    : 1;

  const seenIds = new Set<string>();
  const eligible: SupplyTemplate[] = [];
  for (const tpl of templates) {
    if (tpl.unlockLevel <= levelCap && !seenIds.has(tpl.id)) {
      seenIds.add(tpl.id);
      eligible.push(tpl);
    }
  }

  if (eligible.length === 0) return [];

  const desiredCount = rollIntInclusive(
    supplyShopMinTypes,
    supplyShopMaxTypes,
    rng
  );
  const count = Math.min(eligible.length, desiredCount);

  const pool = [...eligible];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return pool.slice(0, count).map((tpl) => ({
    templateId: tpl.id,
    remaining: rollIntInclusive(supplyShopMinQty, supplyShopMaxQty, rng),
  }));
}
