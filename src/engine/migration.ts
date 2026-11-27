import {
  BALANCE_CONFIG,
  cloneFluxTransferConfig,
  cloneSpEconomyConfig,
  cloneStealthConfig,
  DEFAULT_FLUX_TRANSFER_CONFIG,
  DEFAULT_SP_ECONOMY_CONFIG,
  DEFAULT_STEALTH_CONFIG,
  sanitizeFluxTransferConfig,
  sanitizeMaxLevel,
  sanitizeSpEconomyConfig,
  sanitizeStealthConfig,
} from '../data/balance';
import {
  DEFAULT_CARD_POPUP_FLIGHT_MS,
  DEFAULT_CARD_POPUP_MAX_CONCURRENT,
  DEFAULT_CARD_POPUP_STAGGER_MS,
  DEFAULT_CARD_POPUP_ZONE_HEIGHT_PCT,
  DEFAULT_CARD_POPUP_ZONE_WIDTH_PCT,
  sanitizeCardPopupFlightMs,
  sanitizeCardPopupMaxConcurrent,
  sanitizeCardPopupStaggerMs,
  sanitizeCardPopupZoneHeightPct,
  sanitizeCardPopupZoneWidthPct,
} from '../utils/cardPopupQueue';
import {
  cloneTurnPhaseConfig,
  DEFAULT_TURN_PHASE_CONFIG,
  sanitizeTurnPhaseConfig,
} from './turnPhase';
import {
  clonePrestageConfig,
  DEFAULT_PRESTAGE_CONFIG,
  sanitizePrestageConfig,
} from './prestage';
import {
  cloneModuleDropConfig,
  DEFAULT_MODULE_DROP_CONFIG,
  sanitizeModuleDropConfig,
} from './moduleDrop';
import { sanitizeSectorSupply } from './npcSupply';
import { EMPTY_STAT_BLOCK, MECH_CLASS_LIST } from '../data/classes';
import {
  BUILTIN_ITEM_REGISTRY_TAG,
  EMPTY_EQUIPPED_SLOT_IDS,
  EQUIPMENT_SLOTS,
  getItemTemplate,
  ITEM_TEMPLATES,
  LEGACY_ITEM_ID_TO_TEMPLATE,
} from '../data/items';
import { createInitialBaseStates, SECTORS_CATALOG } from '../data/maps';
import {
  CLASS_STARTER_SKILLS,
  getOpeningCardById,
  getSkillById,
  LEGACY_SKILL_ID_MAP,
} from '../data/skills';
import { SUPPLY_TEMPLATES } from '../data/consumables';
import { getModuleTemplateById } from '../data/modules';
import {
  DEFAULT_EXTENDER_LEVELS_PER_SOCKET,
  DEFAULT_EXTENDER_SLOT_COUNT,
  DEFAULT_MAX_SKILL_MODULES_PER_GEAR,
  getUnlockedExtenderCount,
  MAX_EXTENDER_LEVELS_PER_SOCKET,
  MIN_EXTENDER_LEVELS_PER_SOCKET,
  sanitizeExtenderLevelsPerSocket,
  sanitizeGearExtenders,
  sanitizeGearExtendersAcrossPilot,
  sanitizeMaxSkillModulesPerGear,
} from './extenders';
import {
  DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS,
  SHOP_STOCK_CONFIG,
} from '../data/shopConfig';
import type {
  AdminConfig,
  BaseRuntimeState,
  BattleSize,
  BattleSpeed,
  BattleViewMode,
  ConsumableItem,
  GearUnit,
  InventoryFilterState,
  ItemInstance,
  ItemLevelsConfig,
  Language,
  MechClassId,
  PilotAccount,
  QuickSellFilterConfig,
  ShopItemListing,
  StarterSetConfig,
  SupplyShopListing,
  SupplyShopRefreshState,
  SupplyShopWpListing,
  WorldClockSpeedMode,
  WorldClockState,
  WpMarketOffer,
} from '../types/game';
import {
  cloneAutoEquipConfig,
  DEFAULT_AUTO_EQUIP_CONFIG,
  sanitizeAutoEquipConfig,
} from '../data/autoEquipConfig';
import { cloneFormationConfig, DEFAULT_FORMATION_CONFIG } from '../data/formationConfig';
import { mergeVisibleUnlockedSectors } from './frontline';
import {
  cloneItemLevelsConfig,
  DEFAULT_ITEM_LEVELS_CONFIG,
  getItemLevelKind,
  getTierRequiredLevel,
  sanitizeItemLevelsConfig,
} from './itemLevels';
import {
  DEFAULT_SHIELD_CRACKED_MULT,
  DEFAULT_SHIELD_CRACKED_TURNS,
  DEFAULT_SHIELD_REGEN_CONFIG,
  sanitizeShieldCrackedMult,
  sanitizeShieldCrackedTurns,
  sanitizeShieldDamageOverrides,
  sanitizeShieldRegenConfig,
} from './shieldRegen';
import {
  cloneNpcSupplyConfig,
  DEFAULT_NPC_SUPPLY_CONFIG,
  DEFAULT_SUPPLY_MAX_PER_TYPE_PER_BATTLE,
  sanitizeNpcSupplyConfig,
  sanitizeSupplyMaxPerTypePerBattle,
} from './npcSupply';
import {
  clonePiratesConfig,
  DEFAULT_PIRATES_CONFIG,
  ensureIdle,
  sanitizePirateIncidents,
  sanitizePiratesConfig,
} from './pirates';
import {
  cloneEnemyLevelConfig,
  DEFAULT_ENEMY_LEVEL_CONFIG,
  sanitizeEnemyLevelConfig,
} from './enemyLevel';
import {
  cloneStarterSetConfig,
  DEFAULT_STARTER_SET_CONFIG,
  sanitizeStarterSetConfig,
} from '../data/starterConfig';
import { generateItemInstance, getSellPrice } from './equipment';
import {
  createDefaultSquadFormation,
  migrateLegacySquadFormation,
  sanitizeFormationConfig,
} from './formation';
import { getDefaultInventoryFilterState } from './inventory';
import { DEFAULT_QUICK_SELL_CONFIG } from './quickSell';
import {
  buildShopOptionsFromState,
  DEFAULT_SUPPLY_SHOP_MAX_QTY,
  DEFAULT_SUPPLY_SHOP_MAX_REFRESHES,
  DEFAULT_SUPPLY_SHOP_MAX_TYPES,
  DEFAULT_SUPPLY_SHOP_MIN_QTY,
  DEFAULT_SUPPLY_SHOP_MIN_TYPES,
  DEFAULT_SUPPLY_SHOP_REFRESH_BASE_COST,
  DEFAULT_SUPPLY_WP_DUP_WEIGHT,
  DEFAULT_SUPPLY_WP_MAX_COPIES,
  DEFAULT_SUPPLY_WP_MIN_TIER,
  DEFAULT_SUPPLY_WP_PRICE_DIVISOR,
  generateCategorizedShopStock,
  generateSupplyShopStock,
  generateSupplyShopStockWp,
  generateWpMarketOffers,
  getMaxGearLevel,
  hasOperationalShipyard,
  migrateLegacySupplyShopAdminFields,
  sanitizeSupplyShopConfig,
  sanitizeSupplyShopExtraConfig,
  sanitizeSupplyShopRefresh,
  sanitizeSupplyShopStock,
  sanitizeSupplyShopStockWp,
} from './shop';
import { isSkillAllowedForClass, MAX_ACTIVE_SKILL_BAR } from './skills';
import {
  fillEmptyStarterSlotsForPilot,
  grantStarterSetToGear,
} from './starter';
import {
  cloneSupplyEconomyConfig,
  DEFAULT_SUPPLY_ECONOMY_CONFIG,
  DEFAULT_SUPPLY_LOADOUT_SLOTS,
  DEFAULT_SUPPLY_SCAN_COUNT,
  DEFAULT_SUPPLY_USES_PER_TURN,
  sanitizeConsumables,
  sanitizeSupplyEconomyConfig,
  sanitizeSupplyLoadout,
  sanitizeSupplyLoadoutSlots,
  sanitizeSupplyScanCount,
  sanitizeSupplyUsesPerTurn,
} from './supplies';
import {
  createDefaultGearUnit,
  createDefaultPilotAccount,
  createDefaultWorldClock,
} from './stats';
import { createDefaultTacticsForClass, sanitizeGearTactics } from './tactics';
import { ALLOWED_BATTLE_SPEEDS } from '../utils/battleDisplay';
import { sanitizeStatusDisplayDefaults } from '../utils/statusDisplayPrefs';
import {
  DEFAULT_RADAR_POPUP_BIG_MAX_UNITS,
  DEFAULT_RADAR_POPUP_LARGE_SCALE_PCT,
  DEFAULT_RADAR_POPUP_SMALL_SCALE_PCT,
  DEFAULT_RADAR_POPUP_START_SCALE_PCT,
  sanitizeRadarPopupBigMaxUnits,
  sanitizeRadarPopupLargeScalePct,
  sanitizeRadarPopupSmallScalePct,
  sanitizeRadarPopupStartScalePct,
} from '../utils/radarPopup';

export { createDefaultWorldClock };

export const CURRENT_SAVE_VERSION = 13;

export {
  DEFAULT_EXTENDER_LEVELS_PER_SOCKET,
  DEFAULT_EXTENDER_SLOT_COUNT,
  DEFAULT_MAX_SKILL_MODULES_PER_GEAR,
  MAX_EXTENDER_LEVELS_PER_SOCKET,
  MIN_EXTENDER_LEVELS_PER_SOCKET,
  sanitizeExtenderLevelsPerSocket,
  sanitizeGearExtenders,
  sanitizeGearExtendersAcrossPilot,
  sanitizeMaxSkillModulesPerGear,
};

export const DEFAULT_BOX_CAPACITY = 100;
export const MIN_BOX_CAPACITY = 20;
export const MAX_BOX_CAPACITY = 1000;

export const DEFAULT_WAREHOUSE_CAPACITY = 500;
export const MIN_WAREHOUSE_CAPACITY = 50;
export const MAX_WAREHOUSE_CAPACITY = 2000;

export const WORLD_CLOCK_SPEED_PRESETS: Record<
  Exclude<WorldClockSpeedMode, 'custom'>,
  number
> = {
  fast: 30,
  normal: 180,
  slow: 600,
};
export const MIN_WORLD_CLOCK_SECONDS_PER_DAY = 10;
export const MAX_WORLD_CLOCK_SECONDS_PER_DAY = 86400;

export function sanitizeBoxCapacity(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_BOX_CAPACITY;
  }
  return Math.max(
    MIN_BOX_CAPACITY,
    Math.min(MAX_BOX_CAPACITY, Math.round(raw))
  );
}

export function getBoxCapacity(
  adminConfig?: Pick<AdminConfig, 'boxCapacity'> | null
): number {
  return sanitizeBoxCapacity(adminConfig?.boxCapacity);
}

export function sanitizeWarehouseCapacity(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_WAREHOUSE_CAPACITY;
  }
  return Math.max(
    MIN_WAREHOUSE_CAPACITY,
    Math.min(MAX_WAREHOUSE_CAPACITY, Math.round(raw))
  );
}

export function sanitizeWorldClock(raw: unknown): WorldClockState {
  const def = createDefaultWorldClock();
  if (!raw || typeof raw !== 'object') {
    return def;
  }
  const obj = raw as Record<string, unknown>;
  const speedMode: WorldClockSpeedMode =
    obj.speedMode === 'fast' ||
    obj.speedMode === 'normal' ||
    obj.speedMode === 'slow' ||
    obj.speedMode === 'custom'
      ? obj.speedMode
      : 'normal';

  let secondsPerDay: number;
  if (speedMode === 'custom') {
    if (
      typeof obj.secondsPerDay === 'number' &&
      Number.isFinite(obj.secondsPerDay)
    ) {
      secondsPerDay = Math.max(
        MIN_WORLD_CLOCK_SECONDS_PER_DAY,
        Math.min(MAX_WORLD_CLOCK_SECONDS_PER_DAY, obj.secondsPerDay)
      );
    } else {
      secondsPerDay = def.secondsPerDay;
    }
  } else {
    secondsPerDay = WORLD_CLOCK_SPEED_PRESETS[speedMode];
  }

  const worldDay =
    typeof obj.worldDay === 'number' &&
    Number.isFinite(obj.worldDay) &&
    obj.worldDay >= 0
      ? obj.worldDay
      : 0;

  const lastTickAt =
    typeof obj.lastTickAt === 'number' &&
    Number.isFinite(obj.lastTickAt) &&
    obj.lastTickAt >= 0
      ? obj.lastTickAt
      : null;

  const paused = typeof obj.paused === 'boolean' ? obj.paused : false;

  return {
    worldDay,
    lastTickAt,
    speedMode,
    secondsPerDay,
    paused,
  };
}

export interface PersistedCampaignState {
  pilot: PilotAccount;
  shopStock: ShopItemListing[];
  supplyShopStock?: SupplyShopListing[];
  supplyShopStockWp?: SupplyShopWpListing[];
  supplyShopRefresh?: SupplyShopRefreshState;
  wpMarketOffers: WpMarketOffer[];
  battlesUntilRestock: number;
  inventoryFilterState: InventoryFilterState;
  quickSellConfig: QuickSellFilterConfig;
  selectedSectorId: string;
  hasSaveData: boolean;
  muted: boolean;
  battleSpeed: BattleSpeed;
  skipAnimations: boolean;
  battleViewMode: BattleViewMode | null;
  language: Language;
  adminConfig: AdminConfig;
}

const VALID_CLASSES = new Set<MechClassId>([
  'striker',
  'interceptor',
  'siege',
  'support',
]);

const VALID_SPEEDS = new Set<BattleSpeed>(ALLOWED_BATTLE_SPEEDS);
const VALID_BATTLE_SIZES = new Set<BattleSize>([4, 6, 8]);

export const DEFAULT_NOTICE_DURATION_SEC = 10;

export function sanitizeNoticeDurationSec(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_NOTICE_DURATION_SEC;
  }
  return Math.max(0, Math.min(120, Math.round(raw)));
}

export function createDefaultAdminConfig(): AdminConfig {
  return {
    godMode: false,
    oneHitKills: false,
    alwaysWin: false,
    rewardMultiplier: BALANCE_CONFIG.rewardMultDefault,
    battleSizeOverride: null,
    softEnrageEnabled: true,
    enrageStartRound: BALANCE_CONFIG.enrageStartRound,
    enrageStepPct: BALANCE_CONFIG.enrageStepPct,
    forceBoss: false,
    battleLevelOffsetOverride: null,
    maxLevel: BALANCE_CONFIG.maxLevel,
    enemyLevel: cloneEnemyLevelConfig(DEFAULT_ENEMY_LEVEL_CONFIG),
    shopMinStock: SHOP_STOCK_CONFIG.minStockPerCategory,
    shopMaxStock: SHOP_STOCK_CONFIG.maxStockPerCategory,
    shopRarityWeights: { ...DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS },
    shopPriceMultiplier: 1.0,
    formation: cloneFormationConfig(DEFAULT_FORMATION_CONFIG),
    autoEquip: cloneAutoEquipConfig(DEFAULT_AUTO_EQUIP_CONFIG),
    starterSet: cloneStarterSetConfig(DEFAULT_STARTER_SET_CONFIG),
    iconCatalogMods: [],
    cardPopupStaggerMs: DEFAULT_CARD_POPUP_STAGGER_MS,
    cardPopupFlightMs: DEFAULT_CARD_POPUP_FLIGHT_MS,
    cardPopupMaxConcurrent: DEFAULT_CARD_POPUP_MAX_CONCURRENT,
    cardPopupZoneWidthPct: DEFAULT_CARD_POPUP_ZONE_WIDTH_PCT,
    cardPopupZoneHeightPct: DEFAULT_CARD_POPUP_ZONE_HEIGHT_PCT,
    radarPopupStartScalePct: DEFAULT_RADAR_POPUP_START_SCALE_PCT,
    radarPopupSmallScalePct: DEFAULT_RADAR_POPUP_SMALL_SCALE_PCT,
    radarPopupLargeScalePct: DEFAULT_RADAR_POPUP_LARGE_SCALE_PCT,
    radarPopupBigMaxUnits: DEFAULT_RADAR_POPUP_BIG_MAX_UNITS,
    shieldRegen: { ...DEFAULT_SHIELD_REGEN_CONFIG },
    spEconomy: cloneSpEconomyConfig(DEFAULT_SP_ECONOMY_CONFIG),
    fluxTransfer: cloneFluxTransferConfig(DEFAULT_FLUX_TRANSFER_CONFIG),
    supplyEconomy: cloneSupplyEconomyConfig(DEFAULT_SUPPLY_ECONOMY_CONFIG),
    shieldCrackedMult: DEFAULT_SHIELD_CRACKED_MULT,
    shieldCrackedTurns: DEFAULT_SHIELD_CRACKED_TURNS,
    shieldDamageOverrides: {},
    boxCapacity: DEFAULT_BOX_CAPACITY,
    warehouseCapacity: DEFAULT_WAREHOUSE_CAPACITY,
    ignoreFrontline: false,
    noticeDurationSec: DEFAULT_NOTICE_DURATION_SEC,
    supplyLoadoutSlots: DEFAULT_SUPPLY_LOADOUT_SLOTS,
    supplyUsesPerTurn: DEFAULT_SUPPLY_USES_PER_TURN,
    supplyScanCount: DEFAULT_SUPPLY_SCAN_COUNT,
    supplyShopMinTypes: DEFAULT_SUPPLY_SHOP_MIN_TYPES,
    supplyShopMaxTypes: DEFAULT_SUPPLY_SHOP_MAX_TYPES,
    supplyShopMinQty: DEFAULT_SUPPLY_SHOP_MIN_QTY,
    supplyShopMaxQty: DEFAULT_SUPPLY_SHOP_MAX_QTY,
    supplyShopMaxRefreshes: DEFAULT_SUPPLY_SHOP_MAX_REFRESHES,
    supplyShopRefreshBaseCost: DEFAULT_SUPPLY_SHOP_REFRESH_BASE_COST,
    supplyWpPriceDivisor: DEFAULT_SUPPLY_WP_PRICE_DIVISOR,
    supplyWpMinTier: DEFAULT_SUPPLY_WP_MIN_TIER,
    supplyWpDupWeight: DEFAULT_SUPPLY_WP_DUP_WEIGHT,
    supplyWpMaxCopies: DEFAULT_SUPPLY_WP_MAX_COPIES,
    extenderLevelsPerSocket: DEFAULT_EXTENDER_LEVELS_PER_SOCKET,
    maxSkillModulesPerGear: DEFAULT_MAX_SKILL_MODULES_PER_GEAR,
    itemLevels: cloneItemLevelsConfig(DEFAULT_ITEM_LEVELS_CONFIG),
    moduleDrop: cloneModuleDropConfig(DEFAULT_MODULE_DROP_CONFIG),
    pirates: clonePiratesConfig(DEFAULT_PIRATES_CONFIG),
    turnPhase: cloneTurnPhaseConfig(DEFAULT_TURN_PHASE_CONFIG),
    prestage: clonePrestageConfig(DEFAULT_PRESTAGE_CONFIG),
    stealth: cloneStealthConfig(DEFAULT_STEALTH_CONFIG),
    npcSupply: cloneNpcSupplyConfig(DEFAULT_NPC_SUPPLY_CONFIG),
    supplyMaxPerTypePerBattle: DEFAULT_SUPPLY_MAX_PER_TYPE_PER_BATTLE,
    showRawI18nKeys: false,
  };
}

export function createFreshCampaignState(
  name = 'Vance',
  starterClassId: MechClassId = 'striker',
  rng: () => number = Math.random,
  starterConfig?: StarterSetConfig
): PersistedCampaignState {
  const adminConfig = createDefaultAdminConfig();
  if (starterConfig) {
    adminConfig.starterSet = sanitizeStarterSetConfig(starterConfig);
  }
  const basePilot: PilotAccount = {
    ...createDefaultPilotAccount(name, starterClassId, []),
    consumables: [],
    activeExpBoostBattles: 0,
    activeEnchantBonusPct: 0,
  };
  const { pilot } = grantStarterSetToGear(
    basePilot,
    starterClassId,
    adminConfig.starterSet ?? DEFAULT_STARTER_SET_CONFIG,
    rng
  );
  const freshSupplyShopStock = generateSupplyShopStock(
    1,
    adminConfig,
    SUPPLY_TEMPLATES,
    rng
  );
  const freshSupplyShopStockWp = generateSupplyShopStockWp(
    1,
    adminConfig,
    freshSupplyShopStock.length,
    SUPPLY_TEMPLATES,
    rng
  );
  return {
    pilot,
    shopStock: generateCategorizedShopStock(
      1,
      buildShopOptionsFromState(pilot, adminConfig),
      rng
    ),
    supplyShopStock: freshSupplyShopStock,
    supplyShopStockWp: freshSupplyShopStockWp,
    supplyShopRefresh: { used: 0 },
    wpMarketOffers: generateWpMarketOffers(
      { shipyardBonus: hasOperationalShipyard(pilot) },
      rng
    ),
    battlesUntilRestock: SHOP_STOCK_CONFIG.restockEveryNBattles,
    inventoryFilterState: getDefaultInventoryFilterState(),
    quickSellConfig: { ...DEFAULT_QUICK_SELL_CONFIG },
    selectedSectorId: SECTORS_CATALOG[0].id,
    hasSaveData: false,
    muted: true,
    battleSpeed: 1,
    skipAnimations: false,
    battleViewMode: null,
    language: 'vi',
    adminConfig,
  };
}

function sanitizeGearSkills(
  classId: MechClassId,
  rawSkillLevels: unknown,
  rawEquippedBar: unknown
): { skillLevels: Record<string, number>; equippedSkillBar: string[] } {
  const cleanLevels: Record<string, number> = {};

  if (rawSkillLevels && typeof rawSkillLevels === 'object') {
    for (const [rawId, rawLv] of Object.entries(
      rawSkillLevels as Record<string, unknown>
    )) {
      const mappedId = LEGACY_SKILL_ID_MAP[rawId] ?? rawId;
      const skill = getSkillById(mappedId);
      if (!skill) continue;
      // Strictly strip any cross-class skill!
      if (!isSkillAllowedForClass(skill, classId)) continue;
      const lv = Math.max(
        1,
        Math.min(BALANCE_CONFIG.skillMaxLevel, Number(rawLv) || 1)
      );
      cleanLevels[mappedId] = Math.max(cleanLevels[mappedId] ?? 0, lv);
    }
  }

  // Ensure starter skills for this class are always learned at >= Lv 1
  for (const starterId of CLASS_STARTER_SKILLS[classId]) {
    if (!cleanLevels[starterId]) {
      cleanLevels[starterId] = 1;
    }
  }

  const cleanBar: string[] = [];
  if (Array.isArray(rawEquippedBar)) {
    for (const rawId of rawEquippedBar) {
      if (typeof rawId !== 'string') continue;
      const mappedId = LEGACY_SKILL_ID_MAP[rawId] ?? rawId;
      const skill = getSkillById(mappedId);
      if (
        skill &&
        skill.category !== 'passive' &&
        isSkillAllowedForClass(skill, classId) &&
        (cleanLevels[mappedId] ?? 0) >= 1 &&
        !cleanBar.includes(mappedId) &&
        cleanBar.length < MAX_ACTIVE_SKILL_BAR
      ) {
        cleanBar.push(mappedId);
      }
    }
  }

  if (cleanBar.length === 0) {
    for (const starterId of CLASS_STARTER_SKILLS[classId]) {
      const sk = getSkillById(starterId);
      if (sk && sk.category !== 'passive' && cleanBar.length < MAX_ACTIVE_SKILL_BAR) {
        cleanBar.push(starterId);
      }
    }
  }

  return { skillLevels: cleanLevels, equippedSkillBar: cleanBar };
}

function convertLegacyItemInstance(
  raw: unknown,
  rng: () => number,
  itemLevels: ItemLevelsConfig = DEFAULT_ITEM_LEVELS_CONFIG
): ItemInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (
    typeof obj.instanceId === 'string' &&
    typeof obj.templateId === 'string' &&
    getItemTemplate(obj.templateId) &&
    obj.rolledBaseStats &&
    typeof obj.rolledBaseStats === 'object'
  ) {
    const tpl = getItemTemplate(obj.templateId)!;
    const isStarter = Boolean(obj.isStarter);
    const tier = Math.max(1, Math.min(4, Number(obj.tier) || tpl.tier));
    const kind = getItemLevelKind(tpl.slot);
    const syncedRequiredLevel = itemLevels.kinds[kind].enabled
      ? getTierRequiredLevel(kind, tier, itemLevels)
      : Math.max(1, Number(obj.requiredLevel) || tpl.requiredLevel);
    const modTpl = tpl.slot === 'module' ? getModuleTemplateById(tpl.id) : undefined;
    const isStatModule = modTpl
      ? modTpl.family === 'stat'
      : tpl.slot === 'module' && tpl.primaryRange[1] > 0;
    const rolledBaseStats: ItemInstance['rolledBaseStats'] =
      tpl.slot === 'module'
        ? isStatModule
          ? ({ [tpl.primaryStat]: tpl.primaryRange[0] } as ItemInstance['rolledBaseStats'])
          : {}
        : (obj.rolledBaseStats as ItemInstance['rolledBaseStats']);
    return {
      instanceId: obj.instanceId,
      templateId: tpl.id,
      slot: tpl.slot,
      tier,
      requiredLevel: syncedRequiredLevel,
      classRestriction: tpl.classRestriction,
      rarity:
        obj.rarity === 'common' ||
        obj.rarity === 'uncommon' ||
        obj.rarity === 'rare' ||
        obj.rarity === 'epic' ||
        obj.rarity === 'legendary'
          ? obj.rarity
          : 'common',
      rolledBaseStats,
      affixes: Array.isArray(obj.affixes) ? obj.affixes : [],
      suffixId: typeof obj.suffixId === 'string' ? obj.suffixId : null,
      rollQuality: Math.max(1, Math.min(100, Number(obj.rollQuality) || 50)),
      price: isStarter
        ? Math.max(1, Number(obj.price) || 12)
        : Math.max(60, Number(obj.price) || tpl.basePrice),
      enchantLevel: Math.max(
        0,
        Math.min(BALANCE_CONFIG.enchantMaxLevel, Number(obj.enchantLevel) || 0)
      ),
      specialTraits: tpl.specialTraits ? { ...tpl.specialTraits } : undefined,
      isStarter,
      registryTag:
        typeof obj.registryTag === 'string' && obj.registryTag.trim().length > 0
          ? obj.registryTag
          : (tpl.registryTag ?? BUILTIN_ITEM_REGISTRY_TAG),
      locked: Boolean(obj.locked),
      favorited: Boolean(obj.favorited),
      isNew: Boolean(obj.isNew),
      obtainedAt:
        typeof obj.obtainedAt === 'number' && Number.isFinite(obj.obtainedAt)
          ? obj.obtainedAt
          : Date.now(),
    };
  }

  if (typeof obj.itemId === 'string') {
    const mappedTemplateId =
      LEGACY_ITEM_ID_TO_TEMPLATE[obj.itemId] ?? ITEM_TEMPLATES[0].id;
    const generated = generateItemInstance(
      {
        templateId: mappedTemplateId,
        rarity: 'rare',
        enchantLevel: Math.max(
          0,
          Math.min(BALANCE_CONFIG.enchantMaxLevel, Number(obj.enchantLevel) || 0)
        ),
        itemLevels,
      },
      rng
    );
    if (typeof obj.instanceId === 'string' && obj.instanceId.length > 0) {
      generated.instanceId = obj.instanceId;
    }
    return generated;
  }

  return null;
}

/**
 * Pure, crash-proof save migration from v1/v2/v3/v4 into canonical v5 (full Gear Skill System + War Points).
 */
export function migrateSaveData(
  persistedState: unknown,
  version: number,
  rng: () => number = Math.random
): PersistedCampaignState {
  const fallback = createFreshCampaignState('Vance', 'striker', rng);

  if (!persistedState || typeof persistedState !== 'object') {
    return fallback;
  }

  const raw = persistedState as Record<string, unknown>;
  const language: Language =
    raw.language === 'en' || raw.language === 'vi' ? raw.language : 'vi';
  const rawSpeed = Number(raw.battleSpeed) as BattleSpeed;
  const battleSpeed: BattleSpeed = VALID_SPEEDS.has(rawSpeed) ? rawSpeed : 1;
  const skipAnimations = Boolean(raw.skipAnimations);
  const battleViewMode: BattleViewMode | null =
    raw.battleViewMode === 'card' || raw.battleViewMode === 'radar'
      ? raw.battleViewMode
      : null;
  const muted = typeof raw.muted === 'boolean' ? raw.muted : true;
  const hasSaveData = Boolean(raw.hasSaveData);
  const selectedSectorId =
    typeof raw.selectedSectorId === 'string' &&
    SECTORS_CATALOG.some((s) => s.id === raw.selectedSectorId)
      ? raw.selectedSectorId
      : SECTORS_CATALOG[0].id;

  const defAdmin = createDefaultAdminConfig();
  const rawAdmin = (raw.adminConfig ?? {}) as Partial<AdminConfig>;
  const rawSizeOverride = Number(rawAdmin.battleSizeOverride) as BattleSize;
  const safeMinStock = Math.max(
    1,
    Math.min(10, Math.floor(Number(rawAdmin.shopMinStock) || defAdmin.shopMinStock))
  );
  const safeMaxStock = Math.max(
    safeMinStock,
    Math.min(10, Math.floor(Number(rawAdmin.shopMaxStock) || defAdmin.shopMaxStock))
  );
  const rawWeights = rawAdmin.shopRarityWeights;
  const adminConfig: AdminConfig = {
    godMode: Boolean(rawAdmin.godMode),
    oneHitKills: Boolean(rawAdmin.oneHitKills),
    alwaysWin: Boolean(rawAdmin.alwaysWin),
    rewardMultiplier:
      typeof rawAdmin.rewardMultiplier === 'number' &&
      rawAdmin.rewardMultiplier > 0
        ? rawAdmin.rewardMultiplier
        : BALANCE_CONFIG.rewardMultDefault,
    battleSizeOverride: VALID_BATTLE_SIZES.has(rawSizeOverride)
      ? rawSizeOverride
      : null,
    softEnrageEnabled:
      typeof rawAdmin.softEnrageEnabled === 'boolean'
        ? rawAdmin.softEnrageEnabled
        : true,
    enrageStartRound: Math.max(
      1,
      Math.floor(Number(rawAdmin.enrageStartRound) || defAdmin.enrageStartRound)
    ),
    enrageStepPct:
      typeof rawAdmin.enrageStepPct === 'number' && rawAdmin.enrageStepPct >= 0
        ? rawAdmin.enrageStepPct
        : defAdmin.enrageStepPct,
    forceBoss: Boolean(rawAdmin.forceBoss),
    battleLevelOffsetOverride:
      typeof rawAdmin.battleLevelOffsetOverride === 'number' &&
      Number.isFinite(rawAdmin.battleLevelOffsetOverride)
        ? Math.floor(rawAdmin.battleLevelOffsetOverride)
        : null,
    maxLevel: sanitizeMaxLevel(rawAdmin.maxLevel),
    shopMinStock: safeMinStock,
    shopMaxStock: safeMaxStock,
    shopRarityWeights:
      rawWeights && typeof rawWeights === 'object'
        ? rawWeights.uncommon === undefined &&
          Number(rawWeights.common) === 45 &&
          Number(rawWeights.rare) === 35 &&
          Number(rawWeights.epic) === 15 &&
          Number(rawWeights.legendary) === 5
          ? { ...defAdmin.shopRarityWeights }
          : {
              common: Math.max(0, Number(rawWeights.common) || 0),
              uncommon:
                rawWeights.uncommon !== undefined
                  ? Math.max(0, Number(rawWeights.uncommon) || 0)
                  : defAdmin.shopRarityWeights.uncommon,
              rare: Math.max(0, Number(rawWeights.rare) || 0),
              epic: Math.max(0, Number(rawWeights.epic) || 0),
              legendary: Math.max(0, Number(rawWeights.legendary) || 0),
            }
        : { ...defAdmin.shopRarityWeights },
    shopPriceMultiplier:
      typeof rawAdmin.shopPriceMultiplier === 'number' &&
      rawAdmin.shopPriceMultiplier > 0
        ? rawAdmin.shopPriceMultiplier
        : 1.0,
    formation: sanitizeFormationConfig(rawAdmin as Record<string, unknown>),
    autoEquip: sanitizeAutoEquipConfig(rawAdmin.autoEquip),
    starterSet: sanitizeStarterSetConfig(rawAdmin.starterSet),
    iconCatalogMods: Array.isArray(rawAdmin.iconCatalogMods)
      ? rawAdmin.iconCatalogMods
      : [],
    statusDisplayDefaults: sanitizeStatusDisplayDefaults(
      rawAdmin.statusDisplayDefaults
    ),
    cardPopupStaggerMs: sanitizeCardPopupStaggerMs(rawAdmin.cardPopupStaggerMs),
    cardPopupFlightMs: sanitizeCardPopupFlightMs(rawAdmin.cardPopupFlightMs),
    cardPopupMaxConcurrent: sanitizeCardPopupMaxConcurrent(
      rawAdmin.cardPopupMaxConcurrent
    ),
    cardPopupZoneWidthPct: sanitizeCardPopupZoneWidthPct(
      rawAdmin.cardPopupZoneWidthPct
    ),
    cardPopupZoneHeightPct: sanitizeCardPopupZoneHeightPct(
      rawAdmin.cardPopupZoneHeightPct
    ),
    radarPopupStartScalePct: sanitizeRadarPopupStartScalePct(
      rawAdmin.radarPopupStartScalePct
    ),
    radarPopupSmallScalePct: sanitizeRadarPopupSmallScalePct(
      rawAdmin.radarPopupSmallScalePct
    ),
    radarPopupLargeScalePct: sanitizeRadarPopupLargeScalePct(
      rawAdmin.radarPopupLargeScalePct
    ),
    radarPopupBigMaxUnits: sanitizeRadarPopupBigMaxUnits(
      rawAdmin.radarPopupBigMaxUnits
    ),
    shieldRegen: sanitizeShieldRegenConfig(rawAdmin.shieldRegen),
    spEconomy: sanitizeSpEconomyConfig(rawAdmin.spEconomy),
    fluxTransfer: sanitizeFluxTransferConfig(rawAdmin.fluxTransfer),
    supplyEconomy: sanitizeSupplyEconomyConfig(rawAdmin.supplyEconomy),
    enemyLevel: sanitizeEnemyLevelConfig(rawAdmin.enemyLevel),
    shieldCrackedMult: sanitizeShieldCrackedMult(rawAdmin.shieldCrackedMult),
    shieldCrackedTurns: sanitizeShieldCrackedTurns(rawAdmin.shieldCrackedTurns),
    shieldDamageOverrides: sanitizeShieldDamageOverrides(
      rawAdmin.shieldDamageOverrides
    ),
    boxCapacity: sanitizeBoxCapacity(rawAdmin.boxCapacity),
    warehouseCapacity:
      version < 10
        ? DEFAULT_WAREHOUSE_CAPACITY
        : sanitizeWarehouseCapacity(rawAdmin.warehouseCapacity),
    ignoreFrontline:
      typeof rawAdmin.ignoreFrontline === 'boolean'
        ? rawAdmin.ignoreFrontline
        : false,
    noticeDurationSec: sanitizeNoticeDurationSec(rawAdmin.noticeDurationSec),
    supplyLoadoutSlots: sanitizeSupplyLoadoutSlots(rawAdmin.supplyLoadoutSlots),
    supplyUsesPerTurn: sanitizeSupplyUsesPerTurn(rawAdmin.supplyUsesPerTurn),
    supplyScanCount: sanitizeSupplyScanCount(rawAdmin.supplyScanCount),
    ...sanitizeSupplyShopConfig(
      migrateLegacySupplyShopAdminFields(rawAdmin as Partial<AdminConfig>)
    ),
    ...sanitizeSupplyShopExtraConfig(rawAdmin as Partial<AdminConfig>),
    extenderLevelsPerSocket: sanitizeExtenderLevelsPerSocket(
      rawAdmin.extenderLevelsPerSocket
    ),
    maxSkillModulesPerGear: sanitizeMaxSkillModulesPerGear(
      rawAdmin.maxSkillModulesPerGear
    ),
    itemLevels: sanitizeItemLevelsConfig(rawAdmin.itemLevels),
    moduleDrop: sanitizeModuleDropConfig(rawAdmin.moduleDrop),
    pirates: sanitizePiratesConfig(rawAdmin.pirates),
    turnPhase: sanitizeTurnPhaseConfig(rawAdmin.turnPhase),
    prestage: sanitizePrestageConfig(rawAdmin.prestage),
    stealth: sanitizeStealthConfig(rawAdmin.stealth),
    npcSupply: sanitizeNpcSupplyConfig(rawAdmin.npcSupply),
    supplyMaxPerTypePerBattle: sanitizeSupplyMaxPerTypePerBattle(
      rawAdmin.supplyMaxPerTypePerBattle
    ),
    showRawI18nKeys: Boolean(rawAdmin.showRawI18nKeys),
  };

  const rawInvFilter = (raw.inventoryFilterState ?? {}) as Partial<InventoryFilterState>;
  const inventoryFilterState: InventoryFilterState = {
    ...getDefaultInventoryFilterState(),
    ...rawInvFilter,
    rarities: Array.isArray(rawInvFilter.rarities) ? rawInvFilter.rarities : [],
    tiers: Array.isArray(rawInvFilter.tiers) ? rawInvFilter.tiers : [],
  };

  const rawQuickSell = (raw.quickSellConfig ?? {}) as Partial<QuickSellFilterConfig>;
  const quickSellConfig: QuickSellFilterConfig = {
    ...DEFAULT_QUICK_SELL_CONFIG,
    ...rawQuickSell,
  };

  const battlesUntilRestock = Math.max(
    1,
    Math.floor(
      Number(raw.battlesUntilRestock) || SHOP_STOCK_CONFIG.restockEveryNBattles
    )
  );

  // Case A: v4 / v5 (`pilot` object present)
  if (version >= 4 && raw.pilot && typeof raw.pilot === 'object') {
    const rawPilot = raw.pilot as Partial<PilotAccount>;
    const convertedInventory = Array.isArray(rawPilot.inventory)
      ? rawPilot.inventory
          .map((it) => convertLegacyItemInstance(it, rng, adminConfig.itemLevels))
          .filter((it): it is ItemInstance => it !== null)
      : [];

    const invIds = new Set<string>();
    const rawInventory: ItemInstance[] = [];
    for (const it of convertedInventory) {
      if (invIds.has(it.instanceId)) continue;
      invIds.add(it.instanceId);
      rawInventory.push(it);
    }

    const rawWarehouse: ItemInstance[] = [];
    if (version >= 10 && Array.isArray(rawPilot.warehouse)) {
      const warehouseIds = new Set<string>();
      for (const entry of rawPilot.warehouse) {
        const converted = convertLegacyItemInstance(
          entry,
          rng,
          adminConfig.itemLevels
        );
        if (!converted) continue;
        if (invIds.has(converted.instanceId)) continue;
        if (warehouseIds.has(converted.instanceId)) continue;
        warehouseIds.add(converted.instanceId);
        rawWarehouse.push(converted);
      }
    }

    const sanitizedWorldClock =
      version < 10
        ? createDefaultWorldClock()
        : sanitizeWorldClock(rawPilot.worldClock);

    const claimedIds = new Set<string>();

    const activeGearId: MechClassId = VALID_CLASSES.has(
      rawPilot.activeGearId as MechClassId
    )
      ? (rawPilot.activeGearId as MechClassId)
      : 'striker';

    const gears = {} as Record<MechClassId, GearUnit>;
    for (const cls of MECH_CLASS_LIST) {
      const rawGear = rawPilot.gears?.[cls.id];
      const baseGear = createDefaultGearUnit(cls.id, cls.id === activeGearId);
      if (rawGear && typeof rawGear === 'object') {
        const cleanEquipped = { ...EMPTY_EQUIPPED_SLOT_IDS };
        for (const slot of EQUIPMENT_SLOTS) {
          const refId = rawGear.equipped?.[slot];
          if (
            typeof refId === 'string' &&
            invIds.has(refId) &&
            !claimedIds.has(refId)
          ) {
            cleanEquipped[slot] = refId;
            claimedIds.add(refId);
          }
        }
        const { skillLevels, equippedSkillBar } = sanitizeGearSkills(
          cls.id,
          rawGear.skillLevels,
          rawGear.equippedSkillBar
        );
        gears[cls.id] = {
          classId: cls.id,
          owned: Boolean(rawGear.owned),
          level: Math.max(1, Math.floor(Number(rawGear.level) || 1)),
          exp: Math.max(0, Number(rawGear.exp) || 0),
          unspentPoints: Math.max(0, Number(rawGear.unspentPoints) || 0),
          allocatedPoints: {
            ...EMPTY_STAT_BLOCK,
            ...(rawGear.allocatedPoints ?? {}),
          },
          equipped: cleanEquipped,
          skillLevels,
          equippedSkillBar,
          supplyLoadout: sanitizeSupplyLoadout(
            rawGear.supplyLoadout,
            adminConfig.supplyLoadoutSlots ?? DEFAULT_SUPPLY_LOADOUT_SLOTS
          ),
          extenders: sanitizeGearExtenders(rawGear.extenders),
          tactics: sanitizeGearTactics(cls.id, rawGear.tactics),
          battlesWon: Math.max(0, Number(rawGear.battlesWon) || 0),
          battlesFought: Math.max(0, Number(rawGear.battlesFought) || 0),
        };
      } else {
        gears[cls.id] = baseGear;
      }
    }

    if (!gears[activeGearId].owned) {
      const anyOwned = MECH_CLASS_LIST.find((c) => gears[c.id].owned);
      if (!anyOwned) {
        gears[activeGearId].owned = true;
      }
    }

    const finalActiveGearId = gears[activeGearId].owned
      ? activeGearId
      : MECH_CLASS_LIST.find((c) => gears[c.id].owned)?.id ?? 'striker';

    const unlockedSectorIds =
      Array.isArray(rawPilot.unlockedSectorIds) &&
      rawPilot.unlockedSectorIds.length > 0
        ? Array.from(
            new Set(
              rawPilot.unlockedSectorIds.filter((s) => typeof s === 'string')
            )
          )
        : [SECTORS_CATALOG[0].id];

    const capturedSectorIds = Array.isArray(rawPilot.capturedSectorIds)
      ? Array.from(
          new Set(rawPilot.capturedSectorIds.filter((s) => typeof s === 'string'))
        )
      : [];

    const ownedOpeningCards = Array.isArray(rawPilot.ownedOpeningCards)
      ? Array.from(
          new Set(
            rawPilot.ownedOpeningCards.filter(
              (id) => typeof id === 'string' && Boolean(getOpeningCardById(id))
            )
          )
        )
      : [];

    const rawShop: ShopItemListing[] = Array.isArray(raw.shopStock)
      ? raw.shopStock
          .map((it) => {
            const converted = convertLegacyItemInstance(
              it,
              rng,
              adminConfig.itemLevels
            );
            if (!converted) return null;
            const soldOut = Boolean(
              (it as Record<string, unknown>)?.soldOut
            );
            return { ...converted, soldOut } as ShopItemListing;
          })
          .filter((it): it is ShopItemListing => it !== null)
      : [];

    const activeGearLevel = gears[finalActiveGearId].level;

    // Sanitize per-base runtime state (allied/hostile, operational/damaged/repairing, under attack)
    const defaultBases = createInitialBaseStates();
    const cleanBaseStates: Record<string, BaseRuntimeState> = {};
    for (const sec of SECTORS_CATALOG) {
      const rawB = rawPilot.baseStates?.[sec.id];
      const defB = defaultBases[sec.id];
      if (rawB && typeof rawB === 'object') {
        cleanBaseStates[sec.id] = {
          faction:
            rawB.faction === 'allied' ||
            rawB.faction === 'hostile' ||
            rawB.faction === 'neutral'
              ? rawB.faction
              : defB.faction,
          status:
            rawB.status === 'operational' ||
            rawB.status === 'damaged' ||
            rawB.status === 'repairing'
              ? rawB.status
              : defB.status,
          repairMonthsRemaining: Math.max(
            0,
            Math.min(2, Number(rawB.repairMonthsRemaining) || 0)
          ),
          underAttack: Boolean(rawB.underAttack),
          attackCountdownMonths: Math.max(
            0,
            Number(rawB.attackCountdownMonths) || 0
          ),
          attackFromSectorId:
            typeof rawB.attackFromSectorId === 'string'
              ? rawB.attackFromSectorId
              : null,
        };
      } else {
        cleanBaseStates[sec.id] = {
          ...defB,
          faction: capturedSectorIds.includes(sec.id) ? 'allied' : defB.faction,
        };
      }
    }

    const seededUnlockedSectors = Array.from(
      new Set([...unlockedSectorIds, 'aegis_relay', 'veridian_colony'])
    );
    const finalUnlockedSectors = mergeVisibleUnlockedSectors({
      baseStates: cleanBaseStates,
      unlockedSectorIds: seededUnlockedSectors,
    });

    const rawConsumables: ConsumableItem[] = sanitizeConsumables(
      rawPilot.consumables
    );

    const pilotNameClean =
      typeof rawPilot.name === 'string' && rawPilot.name.trim().length > 0
        ? rawPilot.name.slice(0, 18)
        : 'Vance';
    const rawLegacyFormation =
      rawPilot.squadFormation ??
      (rawPilot as Record<string, unknown>).formation ??
      (raw as Record<string, unknown>).formation;
    const { squadFormation, formationCustomized } = migrateLegacySquadFormation(
      rawLegacyFormation,
      pilotNameClean,
      finalActiveGearId,
      adminConfig.formation,
      rawPilot.formationCustomized
    );

    let migratedCredits = Math.max(0, Number(rawPilot.credits) || 0);

    if (version < 13) {
      const boxCap = adminConfig.boxCapacity ?? DEFAULT_BOX_CAPACITY;
      const whCap = adminConfig.warehouseCapacity ?? DEFAULT_WAREHOUSE_CAPACITY;
      const usedInstanceIds = new Set<string>([
        ...invIds,
        ...rawWarehouse.map((it) => it.instanceId),
      ]);
      const createdByTemplateId = new Map<string, ItemInstance[]>();

      const rawModules = (rawPilot as Record<string, unknown>).modules;
      if (Array.isArray(rawModules)) {
        const mergedStacks = new Map<string, number>();
        for (const entry of rawModules) {
          if (!entry || typeof entry !== 'object') continue;
          const rawEntry = entry as { templateId?: unknown; count?: unknown };
          const templateId =
            typeof rawEntry.templateId === 'string'
              ? rawEntry.templateId.trim()
              : '';
          if (!templateId || !getModuleTemplateById(templateId)) continue;
          if (
            typeof rawEntry.count !== 'number' ||
            !Number.isFinite(rawEntry.count)
          ) {
            continue;
          }
          const clamped = Math.max(1, Math.min(99, Math.round(rawEntry.count)));
          const prev = mergedStacks.get(templateId) ?? 0;
          mergedStacks.set(templateId, Math.min(99, prev + clamped));
        }

        for (const [templateId, count] of mergedStacks.entries()) {
          for (let k = 0; k < count; k++) {
            const inst = generateItemInstance({ templateId }, rng);
            if (usedInstanceIds.has(inst.instanceId)) {
              inst.instanceId = `${inst.instanceId}_${usedInstanceIds.size}`;
            }
            usedInstanceIds.add(inst.instanceId);

            if (rawInventory.length < boxCap) {
              rawInventory.push(inst);
              const queue = createdByTemplateId.get(templateId) ?? [];
              queue.push(inst);
              createdByTemplateId.set(templateId, queue);
            } else if (rawWarehouse.length < whCap) {
              rawWarehouse.push(inst);
              const queue = createdByTemplateId.get(templateId) ?? [];
              queue.push(inst);
              createdByTemplateId.set(templateId, queue);
            } else {
              migratedCredits += getSellPrice(inst);
            }
          }
        }
      }

      for (const cls of MECH_CLASS_LIST) {
        const gear = gears[cls.id];
        if (!gear) continue;
        const unlockedCount = getUnlockedExtenderCount(gear, adminConfig);
        const seenEffectOnGear = new Set<string>();
        const seenSkillOnGear = new Set<string>();
        const convertedExtenders: (string | null)[] = Array(
          DEFAULT_EXTENDER_SLOT_COUNT
        ).fill(null);

        for (let i = 0; i < DEFAULT_EXTENDER_SLOT_COUNT; i++) {
          const val = gear.extenders?.[i] ?? null;
          if (!val || i >= unlockedCount) {
            convertedExtenders[i] = null;
            continue;
          }
          const tpl = getModuleTemplateById(val);
          if (tpl) {
            const effKey = `${tpl.family}:${tpl.effectKey}`;
            if (
              seenEffectOnGear.has(effKey) ||
              (tpl.skillId && seenSkillOnGear.has(tpl.skillId))
            ) {
              convertedExtenders[i] = null;
              continue;
            }
            const assigned = createdByTemplateId.get(val)?.shift();
            if (assigned) {
              convertedExtenders[i] = assigned.instanceId;
              seenEffectOnGear.add(effKey);
              if (tpl.skillId) {
                seenSkillOnGear.add(tpl.skillId);
              }
            }
          } else {
            convertedExtenders[i] = val;
          }
        }

        gears[cls.id] = {
          ...gear,
          extenders: convertedExtenders,
        };
      }
    }

    const sanitizedGears = sanitizeGearExtendersAcrossPilot(
      gears,
      rawInventory,
      rawWarehouse
    );

    const migratedCampaignMonth = Math.max(1, Number(rawPilot.campaignMonth) || 1);
    const sanitizedPirateIncidents = sanitizePirateIncidents(
      rawPilot.pirateIncidents,
      migratedCampaignMonth,
      adminConfig.pirates
    );

    const sanitizedSectorSupply = sanitizeSectorSupply(rawPilot.sectorSupply);

    const migratedPilot: PilotAccount = {
      name: pilotNameClean,
      credits: migratedCredits,
      warPoints: Math.max(0, Number(rawPilot.warPoints) || 0),
      ownedOpeningCards,
      inventory: rawInventory,
      warehouse: rawWarehouse,
      worldClock: sanitizedWorldClock,
      gears: sanitizedGears,
      activeGearId: finalActiveGearId,
      unlockedSectorIds: finalUnlockedSectors,
      capturedSectorIds,
      campaignMonth: migratedCampaignMonth,
      baseStates: cleanBaseStates,
      ...(sanitizedSectorSupply ? { sectorSupply: sanitizedSectorSupply } : {}),
      hiredWingman: rawPilot.hiredWingman ?? null,
      engineerShieldBoost: Boolean(rawPilot.engineerShieldBoost),
      activeBonusMission: rawPilot.activeBonusMission ?? null,
      consumables: rawConsumables,
      activeExpBoostBattles: Math.max(
        0,
        Number(rawPilot.activeExpBoostBattles) || 0
      ),
      activeEnchantBonusPct: Math.max(
        0,
        Number(rawPilot.activeEnchantBonusPct) || 0
      ),
      squadFormation,
      formationCustomized,
      pirateIncidents: sanitizedPirateIncidents,
    };

    const migratedWithStarter =
      version < 9 && adminConfig.starterSet?.enabled
        ? fillEmptyStarterSlotsForPilot(
            migratedPilot,
            adminConfig.starterSet,
            rng
          ).pilot
        : migratedPilot;
    const finalMigratedPilot = ensureIdle(
      migratedWithStarter,
      adminConfig.pirates,
      rng,
      adminConfig
    );

    const rawWpOffers: WpMarketOffer[] = Array.isArray(raw.wpMarketOffers)
      ? (raw.wpMarketOffers as WpMarketOffer[]).filter(
          (o) => Boolean(o && typeof o === 'object' && typeof o.id === 'string')
        )
      : [];

    const hasAvailableShopStock = rawShop.some((it) => !it.soldOut);

    const migratedSupplyShopStock = Array.isArray(raw.supplyShopStock)
      ? sanitizeSupplyShopStock(raw.supplyShopStock)
      : generateSupplyShopStock(
          getMaxGearLevel(finalMigratedPilot),
          adminConfig,
          SUPPLY_TEMPLATES,
          rng
        );
    const sanitizedSupplyShopStockWp = Array.isArray(raw.supplyShopStockWp)
      ? sanitizeSupplyShopStockWp(raw.supplyShopStockWp)
      : [];
    const migratedSupplyShopStockWp =
      sanitizedSupplyShopStockWp.length > 0
        ? sanitizedSupplyShopStockWp
        : generateSupplyShopStockWp(
            getMaxGearLevel(finalMigratedPilot),
            adminConfig,
            migratedSupplyShopStock.length,
            SUPPLY_TEMPLATES,
            rng
          );

    return {
      pilot: finalMigratedPilot,
      shopStock:
        rawShop.length > 0 && hasAvailableShopStock
          ? rawShop
          : generateCategorizedShopStock(
              activeGearLevel,
              buildShopOptionsFromState(finalMigratedPilot, adminConfig),
              rng
            ),
      supplyShopStock: migratedSupplyShopStock,
      supplyShopStockWp: migratedSupplyShopStockWp,
      supplyShopRefresh: sanitizeSupplyShopRefresh(raw.supplyShopRefresh),
      wpMarketOffers:
        rawWpOffers.length > 0
          ? rawWpOffers
          : generateWpMarketOffers(
              { shipyardBonus: hasOperationalShipyard(finalMigratedPilot) },
              rng
            ),
      battlesUntilRestock,
      inventoryFilterState,
      quickSellConfig,
      selectedSectorId,
      hasSaveData,
      muted,
      battleSpeed,
      skipAnimations,
      battleViewMode,
      language,
      adminConfig,
    };
  }

  // Case B: Legacy v1 / v2 / v3 save (`raw.player`) -> migrate into v5 per-Gear model!
  const legacyPlayer = (raw.player ?? {}) as Record<string, unknown>;
  const legacyClass: MechClassId = VALID_CLASSES.has(
    legacyPlayer.classId as MechClassId
  )
    ? (legacyPlayer.classId as MechClassId)
    : 'striker';

  const migratedInventory: ItemInstance[] = [];
  const equippedIds = { ...EMPTY_EQUIPPED_SLOT_IDS };

  if (legacyPlayer.equipped && typeof legacyPlayer.equipped === 'object') {
    const eqMap = legacyPlayer.equipped as Record<string, unknown>;
    for (const slot of EQUIPMENT_SLOTS) {
      const converted = convertLegacyItemInstance(
        eqMap[slot],
        rng,
        adminConfig.itemLevels
      );
      if (converted && converted.slot === slot) {
        if (
          !converted.classRestriction ||
          converted.classRestriction === legacyClass
        ) {
          migratedInventory.push(converted);
          equippedIds[slot] = converted.instanceId;
        } else {
          migratedInventory.push(converted);
        }
      }
    }
  }

  if (Array.isArray(legacyPlayer.inventory)) {
    for (const item of legacyPlayer.inventory) {
      const converted = convertLegacyItemInstance(
        item,
        rng,
        adminConfig.itemLevels
      );
      if (converted) {
        migratedInventory.push(converted);
      }
    }
  }

  const gears = {} as Record<MechClassId, GearUnit>;
  for (const cls of MECH_CLASS_LIST) {
    if (cls.id === legacyClass) {
      const { skillLevels, equippedSkillBar } = sanitizeGearSkills(
        cls.id,
        undefined,
        undefined
      );
      gears[cls.id] = {
        classId: cls.id,
        owned: true,
        level: Math.max(1, Math.floor(Number(legacyPlayer.level) || 1)),
        exp: Math.max(0, Number(legacyPlayer.exp) || 0),
        unspentPoints: Math.max(
          0,
          Number(legacyPlayer.unspentPoints) ?? BALANCE_CONFIG.initialStatPoints
        ),
        allocatedPoints: {
          ...EMPTY_STAT_BLOCK,
          ...((legacyPlayer.allocatedPoints as Record<string, number>) ?? {}),
        },
        equipped: equippedIds,
        skillLevels,
        equippedSkillBar,
        supplyLoadout: [],
        extenders: sanitizeGearExtenders(null),
        tactics: createDefaultTacticsForClass(cls.id),
        battlesWon: Math.max(0, Number(legacyPlayer.battlesWon) || 0),
        battlesFought: Math.max(0, Number(legacyPlayer.battlesFought) || 0),
      };
    } else {
      gears[cls.id] = createDefaultGearUnit(cls.id, false);
    }
  }

  const migratedLevel = gears[legacyClass].level;
  const unlockedSectorIds = [SECTORS_CATALOG[0].id];
  if (gears[legacyClass].battlesWon >= 1) {
    unlockedSectorIds.push(SECTORS_CATALOG[1].id);
  }
  if (gears[legacyClass].battlesWon >= 3) {
    unlockedSectorIds.push(SECTORS_CATALOG[2].id);
  }

  const legacyPilot: PilotAccount = {
    name:
      typeof legacyPlayer.name === 'string' &&
      legacyPlayer.name.trim().length > 0
        ? legacyPlayer.name.slice(0, 18)
        : 'Vance',
    credits: Math.max(
      0,
      Number(legacyPlayer.credits) ?? BALANCE_CONFIG.startingCredits
    ),
    warPoints: 0,
    ownedOpeningCards: [],
    inventory: migratedInventory,
    warehouse: [],
    worldClock: createDefaultWorldClock(),
    gears,
    activeGearId: legacyClass,
    unlockedSectorIds: Array.from(
      new Set([...unlockedSectorIds, 'aegis_relay', 'veridian_colony'])
    ),
    capturedSectorIds: ['aegis_relay'],
    campaignMonth: 1,
    baseStates: createInitialBaseStates(),
    hiredWingman: null,
    engineerShieldBoost: false,
    activeBonusMission: null,
    consumables: [],
    activeExpBoostBattles: 0,
    activeEnchantBonusPct: 0,
    squadFormation: createDefaultSquadFormation(
      typeof legacyPlayer.name === 'string' &&
        legacyPlayer.name.trim().length > 0
        ? legacyPlayer.name.slice(0, 18)
        : 'Vance',
      legacyClass,
      adminConfig.formation
    ),
    formationCustomized: false,
    pirateIncidents: [],
  };

  const finalLegacyPilot =
    version < 9 && adminConfig.starterSet?.enabled
      ? fillEmptyStarterSlotsForPilot(
          legacyPilot,
          adminConfig.starterSet,
          rng
        ).pilot
      : legacyPilot;

  const legacySupplyShopStock = generateSupplyShopStock(
    getMaxGearLevel(finalLegacyPilot),
    adminConfig,
    SUPPLY_TEMPLATES,
    rng
  );
  const legacySupplyShopStockWp = generateSupplyShopStockWp(
    getMaxGearLevel(finalLegacyPilot),
    adminConfig,
    legacySupplyShopStock.length,
    SUPPLY_TEMPLATES,
    rng
  );

  return {
    pilot: finalLegacyPilot,
    shopStock: generateCategorizedShopStock(
      migratedLevel,
      buildShopOptionsFromState(finalLegacyPilot, adminConfig),
      rng
    ),
    supplyShopStock: legacySupplyShopStock,
    supplyShopStockWp: legacySupplyShopStockWp,
    supplyShopRefresh: sanitizeSupplyShopRefresh(raw.supplyShopRefresh),
    wpMarketOffers: generateWpMarketOffers(
      { shipyardBonus: hasOperationalShipyard(finalLegacyPilot) },
      rng
    ),
    battlesUntilRestock,
    inventoryFilterState,
    quickSellConfig,
    selectedSectorId,
    hasSaveData: hasSaveData || gears[legacyClass].battlesFought > 0,
    muted,
    battleSpeed,
    skipAnimations,
    battleViewMode,
    language,
    adminConfig,
  };
}
