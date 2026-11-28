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
  CrateShopConfig,
  CrateShopListing,
  CrateShopSideConfig,
  ItemLevelsConfig,
  ItemRarity,
  ItemTemplate,
  ModuleDropConfig,
  PaperDollSlot,
  PilotAccount,
  ShopItemListing,
  SupplyFamily,
  SupplyShopListing,
  SupplyShopRefreshState,
  SupplyShopWpListing,
  SupplyTemplate,
  VoucherConfig,
  VoucherDef,
  VoucherShopListing,
  WpMarketOffer,
} from '../types/game';
import {
  getAllVouchers,
  getVoucherMaxStock,
  getVoucherWeights,
  resolveVoucherConfig,
} from '../data/vouchers';
import { generateItemInstance, pickWeightedRarity } from './equipment';
import { computeSupplyPrice } from './itemPrice';
import {
  DEFAULT_ITEM_LEVELS_CONFIG,
  getEffectiveTemplateRequiredLevel,
  getShopEligibleTemplatesForSlot,
  sanitizeItemLevelsConfig,
} from './itemLevels';
import { pickEligibleModuleTemplate, sanitizeModuleDropConfig } from './moduleDrop';
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
  moduleDrop?: ModuleDropConfig;
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

  const moduleCfg = sanitizeModuleDropConfig(options.moduleDrop);
  if (moduleCfg.shopCount > 0) {
    const moduleTemplates = ITEM_TEMPLATES.filter((t) => t.slot === 'module');
    const eligibleModules = getShopEligibleTemplatesForSlot(
      moduleTemplates,
      'module',
      referenceLevel,
      levelCfg
    );
    const usedIds = new Set<string>();
    for (let i = 0; i < moduleCfg.shopCount; i++) {
      const remaining = eligibleModules.filter((t) => !usedIds.has(t.id));
      if (remaining.length === 0) break;
      const modTpl = pickEligibleModuleTemplate(
        remaining,
        moduleCfg.effectWeights,
        rng
      );
      if (!modTpl) break;
      usedIds.add(modTpl.id);
      const item = generateItemInstance(
        {
          templateId: modTpl.id,
          tier: modTpl.tier,
          statPowerLevel: getEffectiveTemplateRequiredLevel(modTpl, levelCfg),
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
      adminConfig.shopRarityWeights.uncommon !==
        DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.uncommon ||
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
    moduleDrop: adminConfig?.moduleDrop,
  };
}

export const LEGACY_SUPPLY_SHOP_MIN_TYPES = 2;
export const LEGACY_SUPPLY_SHOP_MAX_TYPES = 5;
export const LEGACY_SUPPLY_SHOP_MIN_QTY = 3;
export const LEGACY_SUPPLY_SHOP_MAX_QTY = 15;

export const DEFAULT_SUPPLY_SHOP_MIN_TYPES = 3;
export const DEFAULT_SUPPLY_SHOP_MAX_TYPES = 10;
export const MIN_SUPPLY_SHOP_TYPES = 1;
export const MAX_SUPPLY_SHOP_TYPES = 12;

export const DEFAULT_SUPPLY_SHOP_MIN_QTY = 10;
export const DEFAULT_SUPPLY_SHOP_MAX_QTY = 50;
export const MIN_SUPPLY_SHOP_QTY = 1;
export const MAX_SUPPLY_SHOP_QTY = SUPPLY_STACK_CAP;

export const DEFAULT_SUPPLY_SHOP_MAX_REFRESHES = 3;
export const MIN_SUPPLY_SHOP_MAX_REFRESHES = 1;
export const MAX_SUPPLY_SHOP_MAX_REFRESHES = 10;

export const DEFAULT_SUPPLY_SHOP_REFRESH_BASE_COST = 1000;
export const MIN_SUPPLY_SHOP_REFRESH_BASE_COST = 0;
export const MAX_SUPPLY_SHOP_REFRESH_BASE_COST = 100000;

export const DEFAULT_SUPPLY_WP_PRICE_DIVISOR = 5;
export const MIN_SUPPLY_WP_PRICE_DIVISOR = 1;
export const MAX_SUPPLY_WP_PRICE_DIVISOR = 100;

export const DEFAULT_SUPPLY_WP_MIN_TIER = 3;
export const MIN_SUPPLY_WP_MIN_TIER = 1;
export const MAX_SUPPLY_WP_MIN_TIER = 5;

export const DEFAULT_SUPPLY_WP_DUP_WEIGHT = 0.3;
export const MIN_SUPPLY_WP_DUP_WEIGHT = 0.05;
export const MAX_SUPPLY_WP_DUP_WEIGHT = 1;

export const DEFAULT_SUPPLY_WP_MAX_COPIES = 2;
export const MIN_SUPPLY_WP_MAX_COPIES = 1;
export const MAX_SUPPLY_WP_MAX_COPIES = 5;

function clampSupplyInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function clampSupplyFloat(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, raw));
}

export function sanitizeSupplyShopMaxRefreshes(raw: unknown): number {
  return clampSupplyInt(
    raw,
    MIN_SUPPLY_SHOP_MAX_REFRESHES,
    MAX_SUPPLY_SHOP_MAX_REFRESHES,
    DEFAULT_SUPPLY_SHOP_MAX_REFRESHES
  );
}

export function sanitizeSupplyShopRefreshBaseCost(raw: unknown): number {
  return clampSupplyInt(
    raw,
    MIN_SUPPLY_SHOP_REFRESH_BASE_COST,
    MAX_SUPPLY_SHOP_REFRESH_BASE_COST,
    DEFAULT_SUPPLY_SHOP_REFRESH_BASE_COST
  );
}

export function sanitizeSupplyWpPriceDivisor(raw: unknown): number {
  return clampSupplyInt(
    raw,
    MIN_SUPPLY_WP_PRICE_DIVISOR,
    MAX_SUPPLY_WP_PRICE_DIVISOR,
    DEFAULT_SUPPLY_WP_PRICE_DIVISOR
  );
}

export function sanitizeSupplyWpMinTier(raw: unknown): number {
  return clampSupplyInt(
    raw,
    MIN_SUPPLY_WP_MIN_TIER,
    MAX_SUPPLY_WP_MIN_TIER,
    DEFAULT_SUPPLY_WP_MIN_TIER
  );
}

export function sanitizeSupplyWpDupWeight(raw: unknown): number {
  return clampSupplyFloat(
    raw,
    MIN_SUPPLY_WP_DUP_WEIGHT,
    MAX_SUPPLY_WP_DUP_WEIGHT,
    DEFAULT_SUPPLY_WP_DUP_WEIGHT
  );
}

export function sanitizeSupplyWpMaxCopies(raw: unknown): number {
  return clampSupplyInt(
    raw,
    MIN_SUPPLY_WP_MAX_COPIES,
    MAX_SUPPLY_WP_MAX_COPIES,
    DEFAULT_SUPPLY_WP_MAX_COPIES
  );
}

export function sanitizeSupplyShopExtraConfig(
  cfg?: Pick<
    Partial<AdminConfig>,
    | 'supplyShopMaxRefreshes'
    | 'supplyShopRefreshBaseCost'
    | 'supplyWpPriceDivisor'
    | 'supplyWpMinTier'
    | 'supplyWpDupWeight'
    | 'supplyWpMaxCopies'
  > | null
): {
  supplyShopMaxRefreshes: number;
  supplyShopRefreshBaseCost: number;
  supplyWpPriceDivisor: number;
  supplyWpMinTier: number;
  supplyWpDupWeight: number;
  supplyWpMaxCopies: number;
} {
  return {
    supplyShopMaxRefreshes: sanitizeSupplyShopMaxRefreshes(
      cfg?.supplyShopMaxRefreshes
    ),
    supplyShopRefreshBaseCost: sanitizeSupplyShopRefreshBaseCost(
      cfg?.supplyShopRefreshBaseCost
    ),
    supplyWpPriceDivisor: sanitizeSupplyWpPriceDivisor(
      cfg?.supplyWpPriceDivisor
    ),
    supplyWpMinTier: sanitizeSupplyWpMinTier(cfg?.supplyWpMinTier),
    supplyWpDupWeight: sanitizeSupplyWpDupWeight(cfg?.supplyWpDupWeight),
    supplyWpMaxCopies: sanitizeSupplyWpMaxCopies(cfg?.supplyWpMaxCopies),
  };
}

export function migrateLegacySupplyShopAdminFields(
  rawAdmin?: Partial<AdminConfig> | null
): Partial<AdminConfig> {
  if (!rawAdmin || typeof rawAdmin !== 'object') return {};
  if (
    rawAdmin.supplyShopMinTypes === LEGACY_SUPPLY_SHOP_MIN_TYPES &&
    rawAdmin.supplyShopMaxTypes === LEGACY_SUPPLY_SHOP_MAX_TYPES &&
    rawAdmin.supplyShopMinQty === LEGACY_SUPPLY_SHOP_MIN_QTY &&
    rawAdmin.supplyShopMaxQty === LEGACY_SUPPLY_SHOP_MAX_QTY
  ) {
    return {
      ...rawAdmin,
      supplyShopMinTypes: DEFAULT_SUPPLY_SHOP_MIN_TYPES,
      supplyShopMaxTypes: DEFAULT_SUPPLY_SHOP_MAX_TYPES,
      supplyShopMinQty: DEFAULT_SUPPLY_SHOP_MIN_QTY,
      supplyShopMaxQty: DEFAULT_SUPPLY_SHOP_MAX_QTY,
    };
  }
  return rawAdmin;
}

export function sanitizeSupplyShopRefresh(
  raw: unknown
): SupplyShopRefreshState {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as { used?: unknown })
      : null;
  const used =
    typeof obj?.used === 'number' && Number.isFinite(obj.used)
      ? Math.max(0, Math.floor(obj.used))
      : 0;
  return { used };
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

  const chosen = pool.slice(0, count);
  if (count >= 3) {
    const distinctFamilies = new Set(chosen.map((t) => t.family));
    if (distinctFamilies.size < 2) {
      const onlyFamily = chosen[0].family;
      const otherFamilyTemplates = pool
        .slice(count)
        .filter((t) => t.family !== onlyFamily);
      if (otherFamilyTemplates.length > 0) {
        const swapPickIdx = Math.min(
          otherFamilyTemplates.length - 1,
          Math.floor(rng() * otherFamilyTemplates.length)
        );
        const replaceIdx = Math.min(
          count - 1,
          Math.floor(rng() * count)
        );
        chosen[replaceIdx] = otherFamilyTemplates[swapPickIdx];
      }
    }
  }

  return chosen.map((tpl) => ({
    templateId: tpl.id,
    remaining: rollIntInclusive(supplyShopMinQty, supplyShopMaxQty, rng),
  }));
}

export function sanitizeSupplyShopStockWp(
  rawStock: unknown
): SupplyShopWpListing[] {
  if (!Array.isArray(rawStock)) return [];
  const seenSlots = new Set<string>();
  const clean: SupplyShopWpListing[] = [];

  for (const entry of rawStock) {
    if (!entry || typeof entry !== 'object') continue;
    const rawSlotId = (entry as { slotId?: unknown }).slotId;
    const slotId = typeof rawSlotId === 'string' ? rawSlotId.trim() : '';
    const rawId = (entry as { templateId?: unknown }).templateId;
    const tplId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!slotId || seenSlots.has(slotId) || !tplId || !getSupplyTemplateById(tplId)) {
      continue;
    }
    seenSlots.add(slotId);
    const rawRem = (entry as { remaining?: unknown }).remaining;
    const remaining =
      typeof rawRem === 'number' && Number.isFinite(rawRem)
        ? Math.max(0, Math.min(SUPPLY_STACK_CAP, Math.round(rawRem)))
        : 0;
    clean.push({
      slotId,
      templateId: tplId,
      remaining,
    });
  }

  return clean;
}

export function getSupplyWpPrice(
  template: Pick<SupplyTemplate, 'family' | 'tier' | 'priceOverride'> &
    Partial<Pick<SupplyTemplate, 'effects'>>,
  cfg?: Pick<AdminConfig, 'supplyWpPriceDivisor' | 'supplyEconomy'> | null
): number {
  const crPrice = computeSupplyPrice(template, cfg);
  const divisor = sanitizeSupplyWpPriceDivisor(cfg?.supplyWpPriceDivisor);
  return Math.max(1, Math.round(crPrice / divisor));
}

const WP_CORE_FAMILIES: readonly SupplyFamily[] = [
  'hp_kit',
  'sp_kit',
  'shield_kit',
];

export function generateSupplyShopStockWp(
  maxGearLevel: number,
  cfg?: Pick<
    Partial<AdminConfig>,
    | 'supplyShopMinQty'
    | 'supplyShopMaxQty'
    | 'supplyWpMinTier'
    | 'supplyWpDupWeight'
    | 'supplyWpMaxCopies'
  > | null,
  creditCount: number = 0,
  templates: readonly SupplyTemplate[] = SUPPLY_TEMPLATES,
  rng: () => number = Math.random
): SupplyShopWpListing[] {
  const { supplyShopMinQty, supplyShopMaxQty } = sanitizeSupplyShopConfig(
    cfg as Partial<AdminConfig>
  );
  const { supplyWpMinTier, supplyWpDupWeight, supplyWpMaxCopies } =
    sanitizeSupplyShopExtraConfig(cfg);

  const levelCap = Number.isFinite(maxGearLevel)
    ? Math.max(1, Math.floor(maxGearLevel))
    : 1;

  const seenIds = new Set<string>();
  const unlockedByFamily = new Map<SupplyFamily, SupplyTemplate[]>();
  for (const tpl of templates) {
    if (tpl.unlockLevel > levelCap || seenIds.has(tpl.id)) continue;
    seenIds.add(tpl.id);
    const list = unlockedByFamily.get(tpl.family);
    if (list) list.push(tpl);
    else unlockedByFamily.set(tpl.family, [tpl]);
  }

  const eligible: SupplyTemplate[] = [];
  for (const familyList of unlockedByFamily.values()) {
    const atMinTier = familyList.filter((t) => t.tier >= supplyWpMinTier);
    if (atMinTier.length > 0) {
      eligible.push(...atMinTier);
    } else {
      const highestTier = Math.max(...familyList.map((t) => t.tier));
      eligible.push(...familyList.filter((t) => t.tier === highestTier));
    }
  }

  if (eligible.length === 0) return [];

  const safeCreditCount = Number.isFinite(creditCount)
    ? Math.max(0, Math.floor(creditCount))
    : 0;
  const maxPossible = eligible.length * supplyWpMaxCopies;
  const targetCount = Math.min(maxPossible, Math.max(3, 2 * safeCreditCount));

  const copiesByTemplate = new Map<string, number>();
  const picked: SupplyTemplate[] = [];

  for (const fam of WP_CORE_FAMILIES) {
    if (picked.length >= targetCount) break;
    const famPool = eligible.filter(
      (t) =>
        t.family === fam &&
        (copiesByTemplate.get(t.id) ?? 0) < supplyWpMaxCopies
    );
    if (famPool.length > 0) {
      const pickIdx = Math.min(
        famPool.length - 1,
        Math.floor(rng() * famPool.length)
      );
      const chosen = famPool[pickIdx];
      picked.push(chosen);
      copiesByTemplate.set(
        chosen.id,
        (copiesByTemplate.get(chosen.id) ?? 0) + 1
      );
    }
  }

  while (picked.length < targetCount) {
    const candidates = eligible.filter(
      (t) => (copiesByTemplate.get(t.id) ?? 0) < supplyWpMaxCopies
    );
    if (candidates.length === 0) break;

    const weights = candidates.map((t) =>
      Math.pow(supplyWpDupWeight, copiesByTemplate.get(t.id) ?? 0)
    );
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let chosen = candidates[candidates.length - 1];
    if (totalWeight > 0) {
      let roll = rng() * totalWeight;
      for (let i = 0; i < candidates.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          chosen = candidates[i];
          break;
        }
      }
    } else {
      const pickIdx = Math.min(
        candidates.length - 1,
        Math.floor(rng() * candidates.length)
      );
      chosen = candidates[pickIdx];
    }

    picked.push(chosen);
    copiesByTemplate.set(
      chosen.id,
      (copiesByTemplate.get(chosen.id) ?? 0) + 1
    );
  }

  return picked.map((tpl, idx) => ({
    slotId: `wp-${idx}-${tpl.id}`,
    templateId: tpl.id,
    remaining: rollIntInclusive(supplyShopMinQty, supplyShopMaxQty, rng),
  }));
}

/**
 * Picks up to typesPerRoll distinct vouchers by weight (weighted without replacement)
 * and rolls stock qty = random 1..maxStock for each picked voucher.
 */
export function rollVoucherShopStockWp(
  cfgOrAdmin?: VoucherConfig | AdminConfig | null,
  rng: () => number = Math.random
): VoucherShopListing[] {
  const cfg = resolveVoucherConfig(cfgOrAdmin);
  if (cfg.typesPerRoll <= 0) return [];

  const allVouchers = getAllVouchers(cfg);
  if (allVouchers.length === 0) return [];

  const weights = getVoucherWeights(cfg);
  const pool: VoucherDef[] = [...allVouchers];
  const targetCount = Math.min(cfg.typesPerRoll, pool.length);
  const picked: VoucherDef[] = [];

  for (let step = 0; step < targetCount && pool.length > 0; step++) {
    let totalWeight = 0;
    for (const item of pool) {
      totalWeight += Math.max(0, weights[item.id] ?? 0);
    }
    if (totalWeight <= 0) break;

    let roll = rng() * totalWeight;
    let chosenIdx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      const w = Math.max(0, weights[pool[i].id] ?? 0);
      if (w <= 0) continue;
      roll -= w;
      if (roll <= 0) {
        chosenIdx = i;
        break;
      }
    }

    const [chosen] = pool.splice(chosenIdx, 1);
    if (chosen) picked.push(chosen);
  }

  return picked.map((def) => {
    const maxStock = Math.max(1, getVoucherMaxStock(def, cfg));
    return {
      voucherId: def.id,
      remaining: rollIntInclusive(1, maxStock, rng),
    };
  });
}

export const CRATE_SHOP_MIN_CHANCE = 0;
export const CRATE_SHOP_MAX_CHANCE = 100;
export const CRATE_SHOP_MIN_SLOTS = 0;
export const CRATE_SHOP_MAX_SLOTS = 6;
export const CRATE_SHOP_MIN_PER_SLOT = 1;
export const CRATE_SHOP_MAX_PER_SLOT = 99;
export const CRATE_SHOP_MIN_PRICE = 1;
export const CRATE_SHOP_WP_MAX_PRICE = 1_000_000;
export const CRATE_SHOP_CREDIT_MAX_PRICE = 100_000_000;

export const DEFAULT_CRATE_SHOP_CONFIG: CrateShopConfig = {
  wp: {
    chancePct: 10,
    maxSlots: 2,
    maxPerSlot: 10,
    price: 100,
  },
  credit: {
    chancePct: 5,
    maxSlots: 3,
    maxPerSlot: 5,
    price: 100_000,
  },
};

export function cloneCrateShopConfig(
  cfg: CrateShopConfig = DEFAULT_CRATE_SHOP_CONFIG
): CrateShopConfig {
  return {
    wp: { ...cfg.wp },
    credit: { ...cfg.credit },
  };
}

function clampCrateShopInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function sanitizeCrateShopSide(
  raw: unknown,
  def: CrateShopSideConfig,
  maxPrice: number
): CrateShopSideConfig {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    chancePct: clampCrateShopInt(
      r.chancePct,
      CRATE_SHOP_MIN_CHANCE,
      CRATE_SHOP_MAX_CHANCE,
      def.chancePct
    ),
    maxSlots: clampCrateShopInt(
      r.maxSlots,
      CRATE_SHOP_MIN_SLOTS,
      CRATE_SHOP_MAX_SLOTS,
      def.maxSlots
    ),
    maxPerSlot: clampCrateShopInt(
      r.maxPerSlot,
      CRATE_SHOP_MIN_PER_SLOT,
      CRATE_SHOP_MAX_PER_SLOT,
      def.maxPerSlot
    ),
    price: clampCrateShopInt(
      r.price,
      CRATE_SHOP_MIN_PRICE,
      maxPrice,
      def.price
    ),
  };
}

export function sanitizeCrateShopConfig(raw: unknown): CrateShopConfig {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    wp: sanitizeCrateShopSide(
      r.wp,
      DEFAULT_CRATE_SHOP_CONFIG.wp,
      CRATE_SHOP_WP_MAX_PRICE
    ),
    credit: sanitizeCrateShopSide(
      r.credit,
      DEFAULT_CRATE_SHOP_CONFIG.credit,
      CRATE_SHOP_CREDIT_MAX_PRICE
    ),
  };
}

export function sanitizeCrateShopStock(rawStock: unknown): CrateShopListing[] {
  if (!Array.isArray(rawStock)) return [];
  const seenSlots = new Set<string>();
  const clean: CrateShopListing[] = [];

  for (const entry of rawStock) {
    if (!entry || typeof entry !== 'object') continue;
    const rawSlotId = (entry as { slotId?: unknown }).slotId;
    const slotId = typeof rawSlotId === 'string' ? rawSlotId.trim() : '';
    if (!slotId || seenSlots.has(slotId)) continue;
    seenSlots.add(slotId);
    const rawRem = (entry as { remaining?: unknown }).remaining;
    const remaining =
      typeof rawRem === 'number' && Number.isFinite(rawRem)
        ? Math.max(0, Math.min(SUPPLY_STACK_CAP, Math.round(rawRem)))
        : 0;
    clean.push({ slotId, remaining });
  }

  return clean;
}

function resolveCrateShopConfig(
  cfgOrAdmin?: CrateShopConfig | Pick<AdminConfig, 'crateShop'> | null
): CrateShopConfig {
  if (!cfgOrAdmin) return cloneCrateShopConfig(DEFAULT_CRATE_SHOP_CONFIG);
  if ('wp' in cfgOrAdmin || 'credit' in cfgOrAdmin) {
    return sanitizeCrateShopConfig(cfgOrAdmin);
  }
  return sanitizeCrateShopConfig(cfgOrAdmin.crateShop);
}

export function rollCrateShopStockSide(
  sideCfg: CrateShopSideConfig,
  prefix: string,
  rng: () => number = Math.random
): CrateShopListing[] {
  const maxSlots = clampCrateShopInt(
    sideCfg.maxSlots,
    CRATE_SHOP_MIN_SLOTS,
    CRATE_SHOP_MAX_SLOTS,
    0
  );
  const chancePct = clampCrateShopInt(
    sideCfg.chancePct,
    CRATE_SHOP_MIN_CHANCE,
    CRATE_SHOP_MAX_CHANCE,
    0
  );
  const maxPerSlot = clampCrateShopInt(
    sideCfg.maxPerSlot,
    CRATE_SHOP_MIN_PER_SLOT,
    CRATE_SHOP_MAX_PER_SLOT,
    1
  );
  if (maxSlots <= 0 || chancePct <= 0) return [];

  const result: CrateShopListing[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const hit = chancePct >= 100 || rng() * 100 < chancePct;
    if (!hit) continue;
    result.push({
      slotId: `${prefix}-${i}`,
      remaining: rollIntInclusive(1, maxPerSlot, rng),
    });
  }
  return result;
}

export function rollCrateShopStockWp(
  cfgOrAdmin?: CrateShopConfig | Pick<AdminConfig, 'crateShop'> | null,
  rng: () => number = Math.random
): CrateShopListing[] {
  const cfg = resolveCrateShopConfig(cfgOrAdmin);
  return rollCrateShopStockSide(cfg.wp, 'crate-wp', rng);
}

export function rollCrateShopStockCredit(
  cfgOrAdmin?: CrateShopConfig | Pick<AdminConfig, 'crateShop'> | null,
  rng: () => number = Math.random
): CrateShopListing[] {
  const cfg = resolveCrateShopConfig(cfgOrAdmin);
  return rollCrateShopStockSide(cfg.credit, 'crate-credit', rng);
}
