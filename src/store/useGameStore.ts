import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  BALANCE_CONFIG,
  getEffectiveSkillMaxLevel,
  getGarageUnlockCost,
  getMaxLevel,
  getUnlockedActiveSlots,
  getUnlockedPassiveSlots,
  sanitizeActiveSlotsConfig,
  sanitizeFluxTransferConfig,
  sanitizeMaxLevel,
  sanitizePassiveScaleAfter5,
  sanitizePassiveSlotsConfig,
  sanitizeRestorePctCap,
  sanitizeSkillCardPriceMult,
  sanitizeSkillMaxLevel,
  sanitizeSkillWpCostFactor,
  sanitizeSpEconomyConfig,
  sanitizeStealthConfig,
  setRuntimeMaxLevel,
} from '../data/balance';
import {
  getBuffCardId,
  getBuffCardPercent,
  parseBuffCardId,
  sanitizeBuffCardsConfig,
  sanitizePilotActiveBuffs,
  sanitizePilotBuffCards,
} from '../data/buffCards';
import {
  decrementActiveBuffsAfterBattle,
  grantBuffCardToPilot,
  sanitizeNpcBuffCardsConfig,
  useBuffCard as useBuffCardEngine,
  type UseBuffCardResult,
} from '../engine/buffCards';
import { BATTLE_KIND_RULES } from '../data/battleKinds';
import { sanitizeAutoEquipConfig } from '../data/autoEquipConfig';
import { EMPTY_STAT_BLOCK, MECH_CLASS_LIST } from '../data/classes';
import { EQUIPMENT_SLOTS, SHOP_CONFIG } from '../data/items';
import {
  createInitialBaseStates,
  getDefaultSelectedNodeId,
  getMapNodeById,
  getMapNodes,
  MAP_LANES,
  sanitizeMapPack,
  setActiveMapPack,
  validateMapPack,
} from '../data/maps';
import { WINGMAN_CHAT_KEYS } from '../data/pilots';
import { SHOP_STOCK_CONFIG } from '../data/shopConfig';
import { sanitizeStarterSetConfig } from '../data/starterConfig';
import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../data/consumables';
import {
  getVoucherById,
  getVoucherPriceWp,
  sanitizeVoucherShopStockWp,
} from '../data/vouchers';
import {
  getOpeningCardsList,
  getSkillById,
  sanitizeSkillMods,
  sanitizeSkillTiersConfig,
} from '../data/skills';
import {
  calculateBattleRewards,
  chooseAiDecision,
  clearRevealedFlags,
  computeFluxBattlePressure,
  createInitialBattleState,
  createRoundHpSnapshot,
  getMaxAffordableFluxCount,
  getValidEnemyTargets,
  pickFluxCount,
  reconcileRemainingTurnOrder,
  resolveMultiStepTurn,
  resolveUnitAction,
  sortTurnOrder,
} from '../engine/combat';
import {
  applyAutoEquipPlan,
  buildAutoEquipPlan,
  undoAutoEquipSnapshot,
} from '../engine/autoEquip';
import {
  applyVoucherRefund,
  computeDefeatExpPenalty,
  computeRepairFee,
  computeRetreatPenalty,
  getBattleSummaryCharges,
} from '../engine/battlePenalty';
import {
  evaluateTurnPhaseAfterAction,
  sanitizeTurnPhaseConfig,
} from '../engine/turnPhase';
import { sanitizePrestageConfig } from '../engine/prestage';
import { LIDAR_SKILL_ID, pickLidarCast } from '../engine/lidarAuto';
import {
  FLUX_SKILL_ID,
  pickFluxAutoCount,
  sanitizeFluxAutoConfig,
} from '../engine/fluxAuto';
import { buildEnrageActivationLogs } from '../engine/enrage';
import {
  equipItemOnGear,
  generateItemInstance,
  getItemEquippedByGear,
  getSellPrice,
  resolveEnchantAttempt,
  rollBattleItemDrops,
  unequipInstanceFromAnyGear,
  unequipSlotOnGear,
} from '../engine/equipment';
import {
  autoPlaceFormation,
  createDefaultSquadFormation,
  enforceFormationCapacities,
  migrateLegacySquadFormation,
  moveUnitToRow,
  sanitizeFormationConfig,
} from '../engine/formation';
import {
  type BattleOptionReasonKey,
  getBattleOptions,
  isVisible,
  mergeVisibleUnlockedSectors,
  pickDefaultBattle,
  validateBattleLaunch,
  visibleNodeIds,
} from '../engine/frontline';
import {
  getDefaultInventoryFilterState,
  RARITY_RANK,
} from '../engine/inventory';
import {
  acceptBaseBonusMission,
  advanceCampaignMonth,
  applyBaseEngineerBoost,
  applyBattleBaseConsequences,
  type BaseActionResult,
  hirePilotForNextBattle,
  type MonthAdvanceSummary,
  type RaidStrikeResult,
  startBaseRepair,
} from '../engine/mapWorld';
import {
  applyBaseRepair,
  type BaseRepairFailureReason,
  resetAllBaseSiegePools,
  sanitizeBaseSiegeConfig,
} from '../engine/baseSiege';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  getBoxCapacity,
  migrateSaveData,
  type PersistedCampaignState,
} from '../engine/migration';
import {
  moveAllUnusedToWarehouse as moveAllUnusedToWarehouseEngine,
  moveToBox as moveToBoxEngine,
  moveToWarehouse as moveToWarehouseEngine,
  type WarehouseTransferResult,
} from '../engine/warehouse';
import {
  clearPirateIncidentById,
  ensureIdle,
  registerPirateBattleSourceProvider,
  rollIncident,
  sanitizePirateIncidents,
  sanitizePiratesConfig,
  spawnOnMonth,
} from '../engine/pirates';
import { sanitizeEnemyLevelConfig } from '../engine/enemyLevel';
import { sanitizeModuleDropConfig } from '../engine/moduleDrop';
import { applyExpCardBatchToGear } from '../engine/cardTiers';
import {
  getMedalWpValue,
  grantMedalsToMap,
  parseMedalId,
  sanitizePilotMedals,
} from '../engine/medals';
import {
  addSupplyToConsumables,
  applyBattleSupplyUse,
  buildSupplyUseFeedback,
  getSupplyStockCount,
  sanitizeSupplyEconomyConfig,
  sanitizeSupplyLoadout,
  sanitizeSupplyLoadoutSlots,
  sanitizeSupplyScanCount,
  sanitizeSupplyUsesPerTurn,
  setSupplyLoadout as setSupplyLoadoutEngine,
  SUPPLY_STACK_CAP,
  tickBattleSupplyForUnit,
  type SupplyLoadoutReject,
} from '../engine/supplies';
import {
  drainSectorSupply,
  runNpcSupplyStep,
  sanitizeNpcSupplyConfig,
} from '../engine/npcSupply';
import {
  pickAutoSupplies,
  sanitizeAutoSuppliesConfig,
} from '../engine/supplyAi';
import {
  applyActionVoiceHooks,
  emitOutcomeVoice,
  emitVoice,
} from '../engine/voice';
import {
  addSupplyCrateToConsumables,
  addSupplyWithOverflow,
  applySupplyRewardGrant,
  getPilotMaxGearLevel,
  rollSupplyCrateContents,
  rollSupplyReward,
  sanitizeSupplyRewardsConfig,
} from '../engine/supplyRewards';
import {
  computeSupplyPrice,
  sanitizePriceOverrides,
} from '../engine/itemPrice';
import {
  clearModule as clearModuleEngine,
  setModule as setModuleEngine,
} from '../engine/extenders';
import {
  isValidSavePayloadShape,
  SAVE_IMPORT_BACKUP_STORAGE_KEY,
  validateImportSaveVersion,
} from '../engine/saveExport';
import { DEFAULT_QUICK_SELL_CONFIG } from '../engine/quickSell';
import {
  buildShopOptionsFromState,
  generateCategorizedShopStock,
  generateSupplyShopStock,
  generateSupplyShopStockWp,
  generateWpMarketOffers,
  rollBlackMarketMedalOffer,
  rollCrateShopStockCredit,
  rollCrateShopStockWp,
  rollVoucherShopStockWp,
  getMaxGearLevel,
  getSupplyWpPrice,
  hasOperationalShipyard,
  sanitizeBlackMarketMedalOffer,
  sanitizeCrateShopConfig,
  sanitizeCrateShopStock,
  sanitizeSupplyShopConfig,
  sanitizeSupplyShopExtraConfig,
  sanitizeSupplyShopMaxRefreshes,
  sanitizeSupplyShopRefresh,
  sanitizeSupplyShopRefreshBaseCost,
  sanitizeSupplyShopStock,
  sanitizeSupplyShopStockWp,
} from '../engine/shop';
import {
  buyOpeningCard,
  equipPassiveToGear,
  equipSkillToGearBar,
  getSkillsForClass,
  learnOrUpgradeSkillOnGear,
  unequipPassiveFromGear,
  unequipSkillFromGearBar,
} from '../engine/skills';
import { sanitizeStatusDisplayDefaults } from '../utils/statusDisplayPrefs';
import {
  ALLOWED_BATTLE_SPEEDS,
  clampDefeatStreakLimit,
  DEFAULT_DEFEAT_STREAK_LIMIT,
  isValidBattleSpeed,
  LOOP_PREFS_STORAGE_KEY,
  migrateLegacyLoopPrefs,
  readDeviceBattleSpeed,
  readDeviceLoopPrefs,
  writeDeviceBattleSpeed,
  writeDeviceLoopPrefs,
} from '../utils/battleDisplay';
import {
  fillEmptyStarterSlotsForPilot,
  grantStarterSetToGear,
} from '../engine/starter';
import {
  getCardDef,
  grantStarterEventPack,
  sanitizeOwnedCards,
  sanitizeStarterEventConfig,
  sanitizeStarterEventGranted,
} from '../engine/starterEvent';
import {
  allocateGearStats,
  applyExpToGear,
  estimateBattlesToNextLevel,
  getTotalAvailablePointsForLevel,
  resetGearStatAllocations,
} from '../engine/stats';
import { resetWorldClock } from '../engine/worldClock';
import {
  chooseAction,
  createBlankTacticsRule,
  createDefaultSimpleTactics,
  createPresetTactics,
  createSimplePresetConfig,
  evaluateAutoSafety,
  generateTacticsFromSimple,
  sanitizeGearTactics,
  shouldStopAutoRepeat,
} from '../engine/tactics';
import type {
  ActionType,
  AdminConfig,
  AutoEquipPlan,
  AutoEquipUndoSnapshot,
  AutoRepeatDefeatRule,
  AutoRepeatLimit,
  AutoRepeatRunToast,
  AutoRepeatSession,
  AutoSafetyConfig,
  AutoStopReason,
  BaseFaction,
  BaseTab,
  BattleEvent,
  BlackMarketMedalOffer,
  BattleKind,
  BattleRoundSnapshot,
  BattleSpeed,
  BattleState,
  BattleSummary,
  BattleViewMode,
  CombatFxEvent,
  CombatFxTone,
  CombatLogEntry,
  CombatRow,
  ExtenderEquipFailureReason,
  CombatUnit,
  ConsumableItem,
  CrateShopListing,
  EnchantAttemptResult,
  EquipmentSlot,
  EquipValidationResult,
  FloatingPopup,
  GearTacticsProfile,
  InventoryFilterState,
  ItemInstance,
  ItemRarity,
  Language,
  LaunchBattleOptions,
  MapPackDefinition,
  MechClassId,
  PaperDollSlot,
  PilotAccount,
  QuickSellFilterConfig,
  QuickSellUndoState,
  ScreenState,
  ShopItemListing,
  SimpleTacticsConfig,
  SimpleTacticsPresetId,
  SkillValidationResult,
  StatBlock,
  SupplyShopListing,
  SupplyShopRefreshState,
  SupplyShopWpListing,
  TacticsPresetId,
  TacticsRule,
  VoucherShopListing,
  WpMarketOffer,
} from '../types/game';
import {
  sanitizeCardPopupEndScalePct,
  sanitizeCardPopupFlightMs,
  sanitizeCardPopupMaxConcurrent,
  sanitizeCardPopupStaggerMs,
  sanitizeCardPopupStartScalePct,
  sanitizeCardPopupZoneHeightPct,
  sanitizeCardPopupZoneWidthPct,
} from '../utils/cardPopupQueue';
import {
  sanitizeRadarPopupBigMaxUnits,
  sanitizeRadarPopupLargeScalePct,
  sanitizeRadarPopupSmallScalePct,
  sanitizeRadarPopupStartScalePct,
} from '../utils/radarPopup';
import { soundFx } from '../utils/sound';

export const ENABLE_ADMIN_CP: boolean =
  import.meta.env.VITE_ENABLE_ADMIN_CP !== 'false';

export const ADMIN_UNLOCK_STORAGE_KEY = 'dream_ace_admin_enabled';

function readPersistedAdminUnlock(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(ADMIN_UNLOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePersistedAdminUnlock(enabled: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (enabled) {
      window.localStorage.setItem(ADMIN_UNLOCK_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(ADMIN_UNLOCK_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures
  }
}

let inMemoryImportBackupJson: string | null = null;

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function readImportBackupRaw(): string | null {
  const storage = getSafeLocalStorage();
  if (storage) {
    try {
      return storage.getItem(SAVE_IMPORT_BACKUP_STORAGE_KEY);
    } catch {
      return inMemoryImportBackupJson;
    }
  }
  return inMemoryImportBackupJson;
}

function writeImportBackupRaw(raw: string): void {
  inMemoryImportBackupJson = raw;
  const storage = getSafeLocalStorage();
  if (storage) {
    try {
      storage.setItem(SAVE_IMPORT_BACKUP_STORAGE_KEY, raw);
    } catch {
      // Fall back to in-memory backup if storage quota/availability fails
    }
  }
}

function clearImportBackupRaw(): void {
  inMemoryImportBackupJson = null;
  const storage = getSafeLocalStorage();
  if (storage) {
    try {
      storage.removeItem(SAVE_IMPORT_BACKUP_STORAGE_KEY);
    } catch {
      // Ignore storage failures
    }
  }
}

function hasPersistedImportBackup(): boolean {
  const raw = readImportBackupRaw();
  return typeof raw === 'string' && raw.length > 0;
}

export type SaveSnapshotPayload = PersistedCampaignState & {
  autoRepeatStopOnDefeat: boolean;
};

function buildSaveSnapshotFromState(state: GameStoreState): SaveSnapshotPayload {
  return {
    pilot: state.pilot,
    shopStock: state.shopStock,
    supplyShopStock: state.supplyShopStock,
    supplyShopStockWp: state.supplyShopStockWp,
    voucherShopStockWp: state.voucherShopStockWp,
    crateShopStockWp: state.crateShopStockWp,
    crateShopStockCredit: state.crateShopStockCredit,
    blackMarketOffer: state.blackMarketOffer,
    supplyShopRefresh: state.supplyShopRefresh,
    wpMarketOffers: state.wpMarketOffers,
    battlesUntilRestock: state.battlesUntilRestock,
    inventoryFilterState: state.inventoryFilterState,
    quickSellConfig: state.quickSellConfig,
    selectedSectorId: state.selectedSectorId,
    hasSaveData: state.hasSaveData,
    muted: state.muted,
    battleSpeed: state.battleSpeed,
    skipAnimations: state.skipAnimations,
    battleViewMode: state.battleViewMode,
    language: state.language,
    autoRepeatStopOnDefeat: state.autoRepeatStopOnDefeat,
    adminConfig: state.adminConfig,
  };
}

export type ShopSubTab = 'buy' | 'sell' | 'warpoints' | 'supply';

interface GameStoreState {
  // Persisted state (v7 per-Gear + full Skill System + Random Shop + Inventory Filters + Admin CP)
  pilot: PilotAccount;
  shopStock: ShopItemListing[];
  supplyShopStock: SupplyShopListing[];
  supplyShopStockWp: SupplyShopWpListing[];
  voucherShopStockWp: VoucherShopListing[];
  crateShopStockWp: CrateShopListing[];
  crateShopStockCredit: CrateShopListing[];
  blackMarketOffer: BlackMarketMedalOffer | null;
  supplyShopRefresh: SupplyShopRefreshState;
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

  // Session UI / Battle state (transient)
  screen: ScreenState;
  activeTab: BaseTab;
  shopSubTab: ShopSubTab;
  battle: BattleState | null;
  adminUnlocked: boolean;
  adminPanelOpen: boolean;
  autoBattleEnabled: boolean;
  tacticsModalOpen: boolean;
  autoRepeatLimit: AutoRepeatLimit;
  autoRepeatDefeatRule: AutoRepeatDefeatRule;
  autoRepeatDefeatStreakLimit: number;
  autoRepeatStopOnDefeat: boolean;
  autoRepeatSession: AutoRepeatSession | null;
  autoRepeatToast: AutoRepeatRunToast | null;
  battleLaunchToast: {
    id: string;
    reasonKey: BattleOptionReasonKey;
    sectorId: string;
  } | null;
  quickSellUndo: QuickSellUndoState | null;
  autoEquipUndo: AutoEquipUndoSnapshot | null;
  hasImportBackup: boolean;
  lastRaidNotice: RaidStrikeResult[] | null;

  // Language
  setLanguage: (lang: Language) => void;

  // Navigation & Campaign creation
  setScreen: (screen: ScreenState) => void;
  setActiveTab: (tab: BaseTab) => void;
  setShopSubTab: (subTab: ShopSubTab) => void;
  openWarPointShop: () => void;
  startCampaign: (pilotName?: string, starterClassId?: MechClassId) => void;
  continueCampaign: () => void;
  resetCampaign: () => void;

  // Pilot & Garage (per-Gear) actions
  setPilotName: (name: string) => void;
  selectActiveGear: (classId: MechClassId) => void;
  buyGear: (classId: MechClassId) => { ok: boolean; cost: number };
  commitStatAllocations: (pending: StatBlock) => void;
  resetStatAllocations: () => void;
  selectSector: (sectorId: string) => void;
  repairBase: (sectorId: string) => BaseActionResult;
  repairBaseHp: (sectorId: string) => {
    ok: boolean;
    reason?: BaseRepairFailureReason;
    cost?: number;
    healed?: number;
  };
  repairBaseShield: (sectorId: string) => {
    ok: boolean;
    reason?: BaseRepairFailureReason;
    cost?: number;
    healed?: number;
  };
  advanceMonth: () => MonthAdvanceSummary;
  clearRaidNotice: () => void;
  hireWingmanAtBase: (sectorId: string, classId?: MechClassId) => BaseActionResult;
  acceptMissionAtBase: (sectorId: string) => BaseActionResult;
  useEngineerAtBase: (sectorId: string) => BaseActionResult;

  // 3-Row Squad Formation actions
  moveSquadUnitRow: (
    unitId: string,
    targetRow: CombatRow,
    swapWithUnitId?: string
  ) => {
    ok: boolean;
    reason?: 'not_found' | 'same_row' | 'row_full';
    currentCount: number;
    capacity: number;
    swappedWithUnitId?: string;
  };
  autoArrangeSquadFormation: () => void;

  // Gear Skill System actions (engine-enforced class locks & per-Gear bars)
  learnOrUpgradeSkill: (
    skillId: string
  ) => { validation: SkillValidationResult; newLevel: number };
  equipSkillToBar: (skillId: string) => SkillValidationResult;
  unequipSkillFromBar: (skillId: string) => void;
  equipPassiveSkill: (skillId: string) => SkillValidationResult;
  unequipPassiveSkill: (skillId: string) => void;
  buyOpeningCardAction: (cardId: string) => {
    ok: boolean;
    reason: 'ok' | 'invalid_card' | 'already_owned' | 'insufficient_wp';
    cost: number;
  };

  // Auto Battle & Per-Gear Tactics actions
  setAutoBattleEnabled: (enabled: boolean) => void;
  toggleAutoBattle: () => void;
  setTacticsModalOpen: (open: boolean) => void;
  setActiveGearTactics: (tactics: GearTacticsProfile) => void;
  applySimpleTactics: (patch: Partial<SimpleTacticsConfig>) => void;
  applySimpleTacticsPreset: (presetId: SimpleTacticsPresetId) => void;
  resetTacticsToSimple: () => void;
  loadTacticsPreset: (presetId: TacticsPresetId) => void;
  addTacticsRule: () => void;
  updateTacticsRule: (ruleId: string, patch: Partial<TacticsRule>) => void;
  deleteTacticsRule: (ruleId: string) => void;
  reorderTacticsRules: (fromIndex: number, toIndex: number) => void;
  updateTacticsSafety: (patch: Partial<AutoSafetyConfig>) => void;
  setAutoRepeatLimit: (limit: AutoRepeatLimit) => void;
  setAutoRepeatDefeatRule: (rule: AutoRepeatDefeatRule) => void;
  setAutoRepeatDefeatStreakLimit: (limit: number) => void;
  setAutoRepeatStopOnDefeat: (stopOnDefeat: boolean) => void;
  startAutoRepeat: (
    limit?: AutoRepeatLimit,
    sectorId?: string,
    opts?: LaunchBattleOptions
  ) => void;
  stopAutoRepeat: (reason?: AutoStopReason) => void;
  clearAutoRepeatSummary: () => void;
  clearAutoRepeatToast: () => void;
  clearBattleLaunchToast: () => void;

  // Equipment, Inventory, Quick Sell, Shop, WP Market & Consumables actions
  setInventoryFilterState: (patch: Partial<InventoryFilterState>) => void;
  resetInventoryFilterState: () => void;
  setQuickSellConfig: (patch: Partial<QuickSellFilterConfig>) => void;
  toggleItemLock: (instanceId: string) => void;
  toggleItemFavorite: (instanceId: string) => void;
  markItemSeen: (instanceId: string) => void;
  bulkSetItemLock: (instanceIds: string[], locked: boolean) => void;
  bulkSellItems: (instanceIds: string[]) => {
    soldCount: number;
    creditsEarned: number;
  };
  executeQuickSell: (instanceIds: string[]) => {
    soldCount: number;
    creditsEarned: number;
  };
  moveToWarehouse: (ids: string[]) => WarehouseTransferResult;
  moveToBox: (ids: string[]) => WarehouseTransferResult;
  moveAllUnusedToWarehouse: () => WarehouseTransferResult;
  setSupplyLoadout: (
    gearId: MechClassId,
    ids: string[]
  ) => { ok: boolean; rejected: SupplyLoadoutReject[]; reason?: 'locked' };
  setExtenderModule: (
    gearId: MechClassId,
    index: number,
    instanceId: string | null
  ) => {
    ok: boolean;
    reason?: ExtenderEquipFailureReason | 'locked';
    reasonKey?: string | null;
    conflictSocket?: number;
    reasonParams?: { socket: number };
  };
  undoQuickSell: () => { ok: boolean; restoredCount: number };
  clearQuickSellUndo: () => void;
  previewAutoEquip: (
    mode: 'single' | 'all',
    targetGearId?: MechClassId
  ) => AutoEquipPlan;
  applyAutoEquip: (
    plan: AutoEquipPlan
  ) => { ok: boolean; changedSlotsCount: number };
  undoAutoEquip: () => { ok: boolean; restoredGearsCount: number };
  clearAutoEquipUndo: () => void;
  equipItem: (instanceId: string) => EquipValidationResult;
  unequipSlot: (slot: PaperDollSlot) => void;
  unequipInstanceEverywhere: (instanceId: string) => void;
  buyShopItem: (instanceId: string) => { ok: boolean };
  buySupply: (
    templateId: string,
    qty: number
  ) => { ok: boolean; bought: number; reason?: string };
  buySupplyWp: (
    slotId: string,
    qty: number
  ) => { ok: boolean; bought: number; reason?: string };
  buyVoucher: (
    id: string,
    qty: number
  ) => { ok: boolean; bought: number; reason?: string };
  buyCrateWp: (
    slotId: string,
    qty: number
  ) => {
    ok: boolean;
    bought: number;
    cost: number;
    cappedByStack?: boolean;
    reason?: 'locked' | 'invalid_qty' | 'not_found' | 'sold_out' | 'full' | 'no_funds';
  };
  buyCrateCredit: (
    slotId: string,
    qty: number
  ) => {
    ok: boolean;
    bought: number;
    cost: number;
    cappedByStack?: boolean;
    reason?: 'locked' | 'invalid_qty' | 'not_found' | 'sold_out' | 'full' | 'no_funds';
  };
  redeemVouchers: (selection: {
    credit?: Record<string, number>;
    exp?: Record<string, number>;
  }) => {
    ok: boolean;
    reason?: 'no_summary' | 'already_redeemed' | 'not_chargeable';
    creditUsed: Record<string, number>;
    expUsed: Record<string, number>;
    creditRefund: number;
    expRefund: number;
  };
  redeemCard: (
    cardId: string,
    qty?: number
  ) => {
    ok: boolean;
    reason?: 'busy' | 'not_found' | 'invalid_qty' | 'max_level';
    kind?: 'credit' | 'exp';
    credit?: number;
    exp?: number;
    appliedExp?: number;
    wastedExp?: number;
    cardsUsed?: number;
    gearId?: MechClassId;
    previousLevel?: number;
    newLevel?: number;
    levelsGained?: number;
  };
  redeemMedal: (
    medalId: string,
    qty?: number
  ) => {
    ok: boolean;
    reason?: 'busy' | 'not_found' | 'invalid_qty';
    medalId?: string;
    tier?: number;
    qtyUsed?: number;
    wpGained?: number;
    newWarPoints?: number;
  };
  refreshSupplyShop: () => {
    ok: boolean;
    cost?: number;
    reason?: 'locked' | 'limit' | 'credits';
    battlesLeft?: number;
  };
  refreshShopStock: () => { ok: boolean; cost: number };
  buyBlackMarketOffer: () => {
    ok: boolean;
    reason?: 'not_found' | 'sold_out' | 'insufficient_credits';
    creditCost?: number;
    medalId?: string;
  };
  buyWpMarketOffer: (offerId: string) => {
    ok: boolean;
    reason?: 'not_found' | 'sold_out' | 'insufficient_wp';
  };
  refreshWpMarket: () => { ok: boolean; cost: number };
  useBuffCard: (
    cardId: string,
    opts?: { confirmReplace?: boolean }
  ) => UseBuffCardResult;
  useConsumable: (consumableId: string) => {
    ok: boolean;
    openedItem?: ItemInstance;
    openedSupplies?: Array<{ templateId: string; qty: number; lost?: number }>;
    kind?: ConsumableItem['kind'];
  };
  sellItem: (instanceId: string) => { ok: boolean; creditsEarned: number };
  sellSupply: (
    templateId: string,
    qty: number
  ) => { ok: boolean; sold: number; creditsEarned: number };
  enchantEquippedSlot: (slot: PaperDollSlot) => EnchantAttemptResult | null;

  // Battle actions
  startBattle: (sectorId?: string, opts?: LaunchBattleOptions) => void;
  reloadBattle: (sectorId?: string, opts?: LaunchBattleOptions) => void;
  confirmPrestage: () => void;
  cancelPrestage: () => void;
  selectTarget: (unitId: string) => void;
  selectAllyTarget: (unitId: string) => void;
  logRadarInvalidTarget: (targetName: string, reasonKey: string) => void;
  performPlayerAction: (action: ActionType, skillId?: string, transferCount?: number) => void;
  useBattleSupply: (templateId: string) => void;
  performAutoPlayerTurn: () => void;
  performAiTurn: () => void;
  retreatBattle: () => void;
  forceWinBattle: () => void;
  clearExpiredPopups: (ids: string[]) => void;
  clearExpiredFx: (ids: string[]) => void;
  clearExplodedUnits: (ids: string[]) => void;
  clearWingmanChat: () => void;
  returnToHangar: () => void;

  // Audio, View & Speed controls
  toggleMute: () => void;
  setBattleSpeed: (speed: BattleSpeed) => void;
  toggleSkipAnimations: () => void;
  setBattleViewMode: (mode: BattleViewMode) => void;

  // Admin CP actions (all routed through store reducers)
  unlockAdminMode: (openPanel?: boolean) => void;
  setAdminPanelOpen: (open: boolean) => void;
  toggleAdminPanel: () => void;
  adminSetGearLevel: (level: number, gearId?: MechClassId) => void;
  adminAddGearExp: (amount: number, gearId?: MechClassId) => void;
  adminSetGearUnspentPoints: (points: number, gearId?: MechClassId) => void;
  adminAddGearUnspentPoints: (delta: number, gearId?: MechClassId) => void;
  adminResetGearAllocation: (gearId?: MechClassId) => void;
  adminSetCredits: (amount: number) => void;
  adminAddCredits: (delta: number) => void;
  adminSetWarPoints: (amount: number) => void;
  adminAddWarPoints: (delta: number) => void;
  adminGenerateItems: (
    slot: EquipmentSlot,
    tier: number,
    rarity: ItemRarity,
    quantity: number,
    options?: { requiredLevel?: number; rollQuality?: number }
  ) => number;
  adminDeleteItems: (
    mode: 'all_unequipped' | 'by_filter',
    filter?: { maxRarity?: ItemRarity | null; maxTier?: number | null }
  ) => number;
  adminFillInventory: (count: number) => number;
  adminRestockShopNow: () => void;
  adminForceAddShopItem: (options: {
    templateId?: string;
    slot: EquipmentSlot;
    tier: number;
    rarity: ItemRarity;
  }) => void;
  adminUnlockAllSkillsForGear: (gearId?: MechClassId, maxLevel?: boolean) => void;
  adminGrantAllOpeningCards: () => void;
  adminResetBattleCooldowns: () => void;
  adminSkipBattleToRound: (targetRound: number) => void;
  adminSetCampaignMonth: (month: number) => void;
  adminSetBaseFaction: (sectorId: string, faction: BaseFaction) => void;
  adminTriggerEnemyAttack: (sectorId: string) => void;
  adminSpawnPirateIncident: () => boolean;
  adminClearPirateIncidents: () => void;
  adminRemovePirateIncident: (incidentId: string) => void;
  adminRefillAllSectorSupply: () => void;
  adminResetAllBaseSiege: () => void;
  adminUnlockAllGears: () => void;
  adminUnlockAllSectors: () => void;
  adminApplyStarterToEmptySlots: () => number;
  adminGrantStarterEventNow: () => number;
  adminResetStarterEventGranted: () => void;
  adminGiveSupply: (
    target: string,
    qty: number
  ) => {
    ok: boolean;
    kind: 'supply_crate' | 'battle_supply';
    templateId?: string;
    added: number;
    lost: number;
  };
  adminGiveBuffCard: (
    cardId: string,
    qty: number
  ) => { ok: boolean; cardId?: string; qty?: number };
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
  applyMapPack: (
    pack: MapPackDefinition | null
  ) => {
    ok: boolean;
    reason?: 'in_battle' | 'auto_repeat_active' | 'invalid_pack';
    nodes: number;
    lanes: number;
  };
  applyWorldAndResetProgress: (
    pack: MapPackDefinition | null
  ) => {
    ok: boolean;
    reason?: 'in_battle' | 'auto_repeat_active' | 'invalid_pack';
    nodes: number;
    lanes: number;
  };
  adminExportSaveJson: () => string;
  adminImportSaveJson: (rawJson: string) => { ok: boolean; error?: string };

  // Portable Save Export / Import with One-Time Backup Undo (SV1a)
  exportSaveStateSnapshot: () => SaveSnapshotPayload;
  importSaveFromEnvelope: (
    rawState: unknown,
    saveVersion: number
  ) =>
    | { ok: true; migratedVersion: number }
    | {
        ok: false;
        code: 'BATTLE_ACTIVE' | 'VERSION_TOO_NEW' | 'CORRUPT';
        error: string;
      };
  undoSaveImport: () => { ok: boolean; error?: string };
}

function findNextAliveTurnIndex(
  turnOrder: string[],
  units: CombatUnit[],
  startFromIndex: number
): { nextIndex: number; wrappedRound: boolean } {
  const total = turnOrder.length;
  for (let step = 1; step <= total; step++) {
    const idx = (startFromIndex + step) % total;
    const unitId = turnOrder[idx];
    const unit = units.find((u) => u.id === unitId);
    if (unit && unit.alive) {
      const wrappedRound = startFromIndex + step >= total;
      return { nextIndex: idx, wrappedRound };
    }
  }
  return { nextIndex: startFromIndex, wrappedRound: false };
}

function enrichLogEntries(
  entries: CombatLogEntry[],
  actor: CombatUnit,
  autoRuleNumber?: number
): CombatLogEntry[] {
  return entries.map((e, idx) => ({
    ...e,
    actorSide: e.actorSide ?? actor.side,
    actorIsPlayer: e.actorName === actor.name ? actor.isPlayer : e.actorIsPlayer,
    actorIsBoss: e.actorName === actor.name ? Boolean(actor.isBoss) : e.actorIsBoss,
    // Tag the primary action log entry with [AUTO #N] when executed by Auto tactics
    autoRuleNumber:
      autoRuleNumber !== undefined && idx === 0 ? autoRuleNumber : e.autoRuleNumber,
  }));
}

function playCue(
  cue: 'laser' | 'heavy' | 'shield' | 'evade' | 'defend' | 'heal' | 'destroy',
  skipAnim: boolean
): void {
  if (skipAnim) return;
  switch (cue) {
    case 'laser':
      soundFx.playLaser();
      break;
    case 'heavy':
      soundFx.playHeavy();
      break;
    case 'shield':
      soundFx.playShield();
      break;
    case 'evade':
      soundFx.playEvade();
      break;
    case 'defend':
      soundFx.playDefend();
      break;
    case 'heal':
      soundFx.playHeal();
      break;
    case 'destroy':
      soundFx.playDestroy();
      break;
  }
}

function appendRoundSnapshot(
  snapshots: BattleRoundSnapshot[],
  round: number,
  units: CombatUnit[]
): BattleRoundSnapshot[] {
  const snap = createRoundHpSnapshot(round, units);
  const idx = snapshots.findIndex((s) => s.round === round);
  if (idx >= 0) {
    const next = [...snapshots];
    next[idx] = snap;
    return next;
  }
  return [...snapshots, snap];
}

function stampTurnEvents(
  events: BattleEvent[],
  turnNumber: number
): BattleEvent[] {
  return events.map((e) => ({ ...e, turn: turnNumber }));
}

function finalizeBattleOutcome(
  state: GameStoreState,
  battle: BattleState,
  updatedUnits: CombatUnit[],
  won: boolean,
  retreated: boolean,
  extraLog = battle.log,
  extraPopups = battle.popups,
  extraFx = battle.fxEvents,
  extraExploded = battle.explodedUnitIds,
  extraEvents = battle.events,
  extraTurnCounter = battle.turnCounter
): Partial<GameStoreState> {
  const battleKind: BattleKind = battle.kind ?? 'assault';
  const kindRule = BATTLE_KIND_RULES[battleKind];
  const deployedGearId = battle.deployedGearId;
  const deployedGear = state.pilot.gears[deployedGearId];
  const alreadyCaptured = state.pilot.capturedSectorIds.includes(battle.sectorId);
  const siegeCapturePreview = applyBattleBaseConsequences(
    state.pilot,
    battle.sectorId,
    won,
    battleKind,
    state.adminConfig.baseSiege
  );
  const effectiveAlreadyCaptured =
    kindRule.capturesOnWin && siegeCapturePreview.capturedFreshly
      ? alreadyCaptured
      : true;
  const effectiveRewardMult =
    state.adminConfig.rewardMultiplier * (battle.rewardMult ?? 1);

  const rewards = calculateBattleRewards(
    updatedUnits,
    won,
    effectiveRewardMult,
    battle.sectorId,
    effectiveAlreadyCaptured,
    state.adminConfig?.battleRewards,
    deployedGear.level,
    retreated
  );
  const droppedItems = rollBattleItemDrops(
    updatedUnits.filter((u) => u.side === 'enemy'),
    battle.sectorId,
    deployedGear.level,
    won,
    Math.random,
    state.adminConfig?.itemLevels,
    state.adminConfig?.moduleDrop
  );

  // Active EXP buff card multiplier
  const activeBuffsBeforeBattle = sanitizePilotActiveBuffs(
    state.pilot.activeBuffs,
    state.pilot.activeExpBoostBattles
  );
  const expBuffEntry = activeBuffsBeforeBattle.exp;
  const expBuffPct =
    expBuffEntry && expBuffEntry.battles > 0
      ? getBuffCardPercent('exp', expBuffEntry.tier, state.adminConfig)
      : 0;
  const effectiveExpGained =
    expBuffPct > 0
      ? Math.round(rewards.expGained * (1 + expBuffPct / 100))
      : rewards.expGained;

  // Per-Gear EXP: ONLY the deployed Gear receives EXP & battle record!
  const levelResult = applyExpToGear(deployedGear, effectiveExpGained, { won });
  const postRewardCredits = state.pilot.credits + rewards.creditsGained;
  const postRewardWp = state.pilot.warPoints + rewards.warPointsGained;

  // Order in finalizeBattleOutcome: rewards -> retreat/defeat penalty -> repair fee (defeat or retreat; victory never)
  const retreatPenalty =
    !won && retreated
      ? computeRetreatPenalty(
          levelResult.updatedGear.level,
          levelResult.updatedGear.exp,
          postRewardCredits,
          postRewardWp,
          state.adminConfig?.battlePenalty
        )
      : {
          expPenalty: 0,
          creditPenalty: 0,
          wpPenalty: 0,
          nextExp: levelResult.updatedGear.exp,
          nextCredits: postRewardCredits,
          nextWarPoints: postRewardWp,
        };
  const defeatPenalty =
    !won && !retreated
      ? computeDefeatExpPenalty(
          levelResult.updatedGear.level,
          levelResult.updatedGear.exp,
          state.adminConfig?.battlePenalty
        )
      : {
          expPenalty: 0,
          nextExp: retreatPenalty.nextExp,
          free: true,
        };
  const gearAfterPenalty = {
    ...levelResult.updatedGear,
    exp: !won && !retreated ? defeatPenalty.nextExp : retreatPenalty.nextExp,
  };

  const repairCheck = !won
    ? computeRepairFee(
        retreated ? 'retreat' : 'defeat',
        gearAfterPenalty.level,
        retreatPenalty.nextCredits,
        updatedUnits,
        state.adminConfig?.battlePenalty
      )
    : { fee: 0, subsidy: 0, payable: 0, free: false };
  const repairPaid = repairCheck.free
    ? 0
    : Math.min(Math.max(0, retreatPenalty.nextCredits), repairCheck.payable);
  const finalCredits = Math.max(0, retreatPenalty.nextCredits - repairPaid);
  const finalWarPoints = Math.max(0, retreatPenalty.nextWarPoints);

  const battlesToNextLevel = estimateBattlesToNextLevel(
    gearAfterPenalty,
    rewards.fullVictoryExp
  );

  // Record base capture only when siege pool actually breaks; unlockedSectorIds is cumulative visibility history (never shrinks)
  let nextCapturedSectors = state.pilot.capturedSectorIds;
  if (siegeCapturePreview.capturedFreshly && !alreadyCaptured) {
    nextCapturedSectors = [...state.pilot.capturedSectorIds, battle.sectorId];
  }

  const { nextActiveBuffs } = decrementActiveBuffsAfterBattle(
    state.pilot.activeBuffs,
    state.pilot.activeExpBoostBattles
  );

  const pilotWithBaseRewards: PilotAccount = {
    ...state.pilot,
    credits: finalCredits,
    warPoints: finalWarPoints,
    inventory: [...droppedItems, ...state.pilot.inventory],
    gears: {
      ...state.pilot.gears,
      [deployedGearId]: gearAfterPenalty,
    },
    unlockedSectorIds: state.pilot.unlockedSectorIds,
    capturedSectorIds: nextCapturedSectors,
    activeBuffs: nextActiveBuffs,
    activeExpBoostBattles: undefined,
  };
  const basePilotBeforeConsequences = pilotWithBaseRewards;
  const totalCreditsGained = rewards.creditsGained;

  // Freshly captured bases start Damaged (assault only when siege pool breaks); repelled raids clear alert (defend only); bonus missions paid (assault/defend)
  const baseConseq = applyBattleBaseConsequences(
    basePilotBeforeConsequences,
    battle.sectorId,
    won,
    battleKind,
    state.adminConfig.baseSiege
  );
  const pilotAfterPirateClear =
    won && battleKind === 'event' && battle.sourceId
      ? clearPirateIncidentById(baseConseq.pilot, battle.sourceId)
      : baseConseq.pilot;
  const npcSupplyCfg = sanitizeNpcSupplyConfig(state.adminConfig.npcSupply);
  const pilotAfterSupplyDrain = drainSectorSupply(
    pilotAfterPirateClear,
    battle.sectorId,
    npcSupplyCfg
  );
  // Advance campaign calendar 1 month after each completed non-retreat sortie
  const monthAdvance = retreated
    ? null
    : advanceCampaignMonth(
        pilotAfterSupplyDrain,
        npcSupplyCfg.sector.regenPerMonth,
        state.adminConfig.baseSiege
      );
  const monthStep = monthAdvance
    ? {
        pilot: spawnOnMonth(
          monthAdvance.pilot,
          state.adminConfig.pirates,
          Math.random
        ),
      }
    : { pilot: pilotAfterSupplyDrain };
  const nextUnlockedSectors = mergeVisibleUnlockedSectors(monthStep.pilot);
  const nextPilotBase: PilotAccount = ensureIdle(
    {
      ...monthStep.pilot,
      unlockedSectorIds: nextUnlockedSectors,
    },
    state.adminConfig.pirates,
    Math.random,
    state.adminConfig
  );

  // Random supply rewards on Victory & Bonus Mission completion (SUP-GEN-a)
  let pilotAfterSupplyRewards = nextPilotBase;
  let supplyDrop: BattleSummary['supplyDrop'] = undefined;
  let missionSupplyDrop: BattleSummary['missionSupplyDrop'] = undefined;
  const supplyRewardLogs: CombatLogEntry[] = [];
  if (won && !retreated) {
    const winSupply = applySupplyRewardGrant(
      pilotAfterSupplyRewards,
      state.adminConfig,
      'victory',
      Math.random
    );
    pilotAfterSupplyRewards = winSupply.pilot;
    if (winSupply.templateId && (winSupply.added > 0 || winSupply.lost > 0)) {
      supplyDrop = {
        templateId: winSupply.templateId,
        qty: winSupply.added,
        ...(winSupply.lost > 0 ? { lostQty: winSupply.lost } : {}),
      };
      if (winSupply.added > 0) {
        supplyRewardLogs.push({
          id: `log_supply_win_${Date.now()}_${extraTurnCounter}`,
          round: battle.round,
          actorName: 'SYSTEM',
          tag: 'SYSTEM' as const,
          templateKey: 'log.supplyDrop' as const,
          params: {
            templateId: winSupply.templateId,
            qty: winSupply.added,
          },
        });
      }
      if (winSupply.lost > 0) {
        supplyRewardLogs.push({
          id: `log_supply_win_lost_${Date.now()}_${extraTurnCounter}`,
          round: battle.round,
          actorName: 'SYSTEM',
          tag: 'SYSTEM' as const,
          templateKey: 'log.supplyDropLost' as const,
          params: {
            templateId: winSupply.templateId,
            lost: winSupply.lost,
            cap: SUPPLY_STACK_CAP,
          },
        });
      }
    }

    const bonusMissionCompleted =
      baseConseq.bonusMissionCredits > 0 ||
      baseConseq.bonusMissionWarPoints > 0 ||
      Boolean(
        kindRule.completesBonusMissionOnWin &&
          state.pilot.activeBonusMission &&
          !state.pilot.activeBonusMission.completed &&
          state.pilot.activeBonusMission.targetSectorId === battle.sectorId &&
          !baseConseq.pilot.activeBonusMission
      );
    if (bonusMissionCompleted) {
      const missionSupply = applySupplyRewardGrant(
        pilotAfterSupplyRewards,
        state.adminConfig,
        'mission',
        Math.random
      );
      pilotAfterSupplyRewards = missionSupply.pilot;
      if (
        missionSupply.templateId &&
        (missionSupply.added > 0 || missionSupply.lost > 0)
      ) {
        missionSupplyDrop = {
          templateId: missionSupply.templateId,
          qty: missionSupply.added,
          ...(missionSupply.lost > 0 ? { lostQty: missionSupply.lost } : {}),
        };
        if (missionSupply.added > 0) {
          supplyRewardLogs.push({
            id: `log_supply_mission_${Date.now()}_${extraTurnCounter}`,
            round: battle.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: 'log.supplyDrop' as const,
            params: {
              templateId: missionSupply.templateId,
              qty: missionSupply.added,
            },
          });
        }
        if (missionSupply.lost > 0) {
          supplyRewardLogs.push({
            id: `log_supply_mission_lost_${Date.now()}_${extraTurnCounter}`,
            round: battle.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: 'log.supplyDropLost' as const,
            params: {
              templateId: missionSupply.templateId,
              lost: missionSupply.lost,
              cap: SUPPLY_STACK_CAP,
            },
          });
        }
      }
    }
  }
  const nextPilot: PilotAccount = pilotAfterSupplyRewards;
  const unlockedSectorId =
    nextUnlockedSectors.find(
      (id) => !state.pilot.unlockedSectorIds.includes(id)
    ) ?? null;

  // Auto-restock Credits Shop & WP Market based on restockEveryNBattles cadence
  const nextBattlesUntilRestock = Math.max(0, (state.battlesUntilRestock || 1) - 1);
  const shouldRestock = nextBattlesUntilRestock <= 0 || state.shopStock.length === 0;
  const refreshedShopStock = shouldRestock
    ? generateCategorizedShopStock(
        levelResult.updatedGear.level,
        buildShopOptionsFromState(nextPilot, state.adminConfig)
      )
    : state.shopStock;
  const refreshedSupplyShopStock = shouldRestock
    ? generateSupplyShopStock(
        getMaxGearLevel(nextPilot),
        state.adminConfig,
        SUPPLY_TEMPLATES
      )
    : state.supplyShopStock;
  const refreshedSupplyShopStockWp = shouldRestock
    ? generateSupplyShopStockWp(
        getMaxGearLevel(nextPilot),
        state.adminConfig,
        refreshedSupplyShopStock.length,
        SUPPLY_TEMPLATES
      )
    : state.supplyShopStockWp;
  const refreshedVoucherShopStockWp = shouldRestock
    ? rollVoucherShopStockWp(state.adminConfig)
    : state.voucherShopStockWp;
  const refreshedCrateShopStockWp = shouldRestock
    ? rollCrateShopStockWp(state.adminConfig)
    : (state.crateShopStockWp ?? []);
  const refreshedCrateShopStockCredit = shouldRestock
    ? rollCrateShopStockCredit(state.adminConfig)
    : (state.crateShopStockCredit ?? []);
  const refreshedBlackMarketOffer = shouldRestock
    ? rollBlackMarketMedalOffer(state.adminConfig)
    : (state.blackMarketOffer ?? null);
  const refreshedSupplyShopRefresh: SupplyShopRefreshState = shouldRestock
    ? { used: 0 }
    : sanitizeSupplyShopRefresh(state.supplyShopRefresh);
  const refreshedWpOffers = shouldRestock
    ? generateWpMarketOffers({
        shipyardBonus: hasOperationalShipyard(nextPilot),
        adminConfig: state.adminConfig,
      })
    : state.wpMarketOffers;

  if (won) soundFx.playVictory();
  else soundFx.playDefeat();

  const enemies = updatedUnits.filter((u) => u.side === 'enemy');
  const aliveAllies = updatedUnits.filter((u) => u.side === 'ally' && u.alive);

  const outcomeVoiced = emitOutcomeVoice(
    {
      ...battle,
      units: updatedUnits,
      log: extraLog,
    },
    won
  );

  // Update Auto-Repeat batch session if active (or stopped manually during current run)
  let nextAutoRepeat = state.autoRepeatSession;
  let nextAutoRepeatToast: AutoRepeatRunToast | null = null;
  let finalLog =
    supplyRewardLogs.length > 0
      ? [...outcomeVoiced.log, ...supplyRewardLogs]
      : outcomeVoiced.log;
  if (baseConseq.siegeResult) {
    const sr = baseConseq.siegeResult;
    finalLog = [
      ...finalLog,
      sr.captured
        ? {
            id: `log_siege_${Date.now()}_${extraTurnCounter}`,
            round: battle.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: 'log.baseSiegeCaptured' as const,
            params: {
              sectorId: sr.sectorId,
            },
          }
        : sr.shieldBefore !== sr.shieldAfter
        ? {
            id: `log_siege_${Date.now()}_${extraTurnCounter}`,
            round: battle.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: 'log.baseSiegeDamaged' as const,
            params: {
              sectorId: sr.sectorId,
              shieldBefore: sr.shieldBefore,
              shieldAfter: sr.shieldAfter,
              hpAfter: sr.hpAfter,
            },
          }
        : {
            id: `log_siege_${Date.now()}_${extraTurnCounter}`,
            round: battle.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: 'log.baseSiegeHpDamaged' as const,
            params: {
              sectorId: sr.sectorId,
              hpBefore: sr.hpBefore,
              hpAfter: sr.hpAfter,
            },
          },
    ];
  }
  if (!won && (repairCheck.free || repairPaid > 0)) {
    finalLog = [
      ...finalLog,
      repairCheck.free
        ? {
            id: `log_repair_${Date.now()}_${extraTurnCounter}`,
            round: battle.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: retreated
              ? ('log.repairFreeRetreat' as const)
              : ('log.repairFreeDefeat' as const),
            params: {},
          }
        : {
            id: `log_repair_${Date.now()}_${extraTurnCounter}`,
            round: battle.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: 'log.repairFee' as const,
            params: { fee: repairPaid },
          },
    ];
  }
  if (
    state.autoRepeatSession &&
    (state.autoRepeatSession.active ||
      state.autoRepeatSession.stopReason === 'manual_stop')
  ) {
    const nextConsecutiveDefeats = won
      ? 0
      : (state.autoRepeatSession.consecutiveDefeats ?? 0) + 1;
    const streakLimit = clampDefeatStreakLimit(
      state.autoRepeatDefeatStreakLimit
    );
    const updatedSession: AutoRepeatSession = {
      ...state.autoRepeatSession,
      completedRuns: state.autoRepeatSession.completedRuns + 1,
      wins: state.autoRepeatSession.wins + (won ? 1 : 0),
      consecutiveDefeats: nextConsecutiveDefeats,
      defeatStreakLimit: streakLimit,
      totalExp: state.autoRepeatSession.totalExp + effectiveExpGained,
      totalCredits: state.autoRepeatSession.totalCredits + totalCreditsGained,
      totalWarPoints:
        state.autoRepeatSession.totalWarPoints + rewards.warPointsGained,
      totalDrops: [...state.autoRepeatSession.totalDrops, ...droppedItems],
    };
    if (state.autoRepeatSession.active) {
      const boxCap = getBoxCapacity(state.adminConfig);
      const stopCheck = shouldStopAutoRepeat(
        updatedSession,
        won ? 'victory' : 'defeat',
        retreated,
        nextPilot.inventory.length,
        boxCap,
        state.autoRepeatDefeatRule,
        streakLimit
      );
      const loopKind: BattleKind = updatedSession.kind ?? battleKind;
      const loopSourceId =
        updatedSession.sourceId !== undefined
          ? updatedSession.sourceId
          : battle.sourceId ?? null;
      const nextValidation = !stopCheck.stop
        ? validateBattleLaunch(
            nextPilot,
            updatedSession.sectorId,
            loopKind,
            loopSourceId,
            state.adminConfig
          )
        : null;
      const shouldStopNow =
        stopCheck.stop || (nextValidation !== null && !nextValidation.allowed);
      if (shouldStopNow) {
        const blockedStopReason: AutoStopReason =
          (loopKind === 'mission' || loopKind === 'event') &&
          nextValidation?.reasonKey === 'map.reason.sourceInactive'
            ? 'source_inactive'
            : 'node_not_contested';
        const finalReason: AutoStopReason | null =
          updatedSession.stopReason ??
          (stopCheck.stop ? stopCheck.reason : blockedStopReason);
        nextAutoRepeat = {
          ...updatedSession,
          active: false,
          stopReason: finalReason,
        };
        nextAutoRepeatToast = null;
        if (finalReason) {
          finalLog = [
            ...finalLog,
            {
              id: `log_repeat_stop_${Date.now()}_${extraTurnCounter}`,
              round: battle.round,
              actorName: 'SYSTEM',
              tag: 'SYSTEM' as const,
              templateKey: 'log.autoRepeatStopped' as const,
              params: {
                reason: finalReason,
                streak: streakLimit,
                max: boxCap,
              },
            },
          ];
        }
      } else {
        nextAutoRepeat = updatedSession;
        nextAutoRepeatToast = {
          id: `loop_toast_${Date.now()}_${updatedSession.completedRuns}`,
          runNumber: updatedSession.completedRuns,
          outcome: won ? 'victory' : 'defeat',
          expGained: effectiveExpGained,
          creditsGained: rewards.creditsGained,
          warPointsGained: rewards.warPointsGained,
          lootCount: droppedItems.length,
        };
      }
    } else {
      nextAutoRepeat = updatedSession;
      nextAutoRepeatToast = null;
    }
  }

  return {
    pilot: nextPilot,
    shopStock: refreshedShopStock,
    supplyShopStock: refreshedSupplyShopStock,
    supplyShopStockWp: refreshedSupplyShopStockWp,
    voucherShopStockWp: refreshedVoucherShopStockWp,
    crateShopStockWp: refreshedCrateShopStockWp,
    crateShopStockCredit: refreshedCrateShopStockCredit,
    blackMarketOffer: refreshedBlackMarketOffer,
    supplyShopRefresh: refreshedSupplyShopRefresh,
    wpMarketOffers: refreshedWpOffers,
    battlesUntilRestock: shouldRestock
      ? SHOP_STOCK_CONFIG.restockEveryNBattles
      : nextBattlesUntilRestock,
    hasSaveData: true,
    autoRepeatSession: nextAutoRepeat,
    autoRepeatToast: nextAutoRepeatToast,
    ...(monthAdvance && monthAdvance.raidResults.length > 0
      ? { lastRaidNotice: monthAdvance.raidResults }
      : {}),
    battle: {
      ...battle,
      units: updatedUnits,
      voice: outcomeVoiced.voice,
      turnCounter: extraTurnCounter,
      log: finalLog,
      events: extraEvents,
      roundSnapshots: appendRoundSnapshot(
        battle.roundSnapshots,
        battle.round,
        updatedUnits
      ),
      popups: extraPopups,
      fxEvents: extraFx,
      explodedUnitIds: extraExploded,
      isResolving: false,
      summary: {
        outcome: won ? 'victory' : 'defeat',
        retreated,
        kind: battleKind,
        sourceId: battle.sourceId ?? null,
        deployedGearId,
        sectorId: battle.sectorId,
        rounds: battle.round,
        expGained: effectiveExpGained,
        creditsGained: totalCreditsGained,
        warPointsGained: rewards.warPointsGained,
        baseCaptureBonusWp: rewards.baseCaptureBonusWp,
        supportExpPct: rewards.supportExpPct,
        supportCreditPct: rewards.supportCreditPct,
        repairFee: repairPaid,
        repairFeeGross: !won ? repairCheck.fee : 0,
        repairSubsidy: !won ? repairCheck.subsidy : 0,
        repairFree: repairCheck.free,
        retreatPenaltyExp: retreatPenalty.expPenalty,
        retreatPenaltyCredit: retreatPenalty.creditPenalty,
        retreatPenaltyWp: retreatPenalty.wpPenalty,
        defeatPenaltyExp: defeatPenalty.expPenalty,
        expBeforePenalty: levelResult.updatedGear.exp,
        leveledUp: levelResult.leveledUp,
        previousLevel: levelResult.previousLevel,
        newLevel: levelResult.newLevel,
        statPointsGained: levelResult.statPointsGained,
        battlesToNextLevel,
        unlockedSectorId,
        enemiesDestroyed: enemies.filter((e) => !e.alive).length,
        totalEnemies: enemies.length,
        alliesSurviving: aliveAllies.length,
        droppedItems,
        ...(supplyDrop ? { supplyDrop } : {}),
        ...(missionSupplyDrop ? { missionSupplyDrop } : {}),
        ...(baseConseq.siegeResult ? { siegeResult: baseConseq.siegeResult } : {}),
      },
    },
  };
}

const initialFresh = createFreshCampaignState('Vance', 'striker');
const initialDeviceLoopPrefs = readDeviceLoopPrefs();
const initialDeviceSpeed = readDeviceBattleSpeed();

function launchBattleForSector(
  state: GameStoreState,
  set: (partial: Partial<GameStoreState>) => void,
  sectorId?: string,
  opts?: LaunchBattleOptions
): void {
  const targetSectorId = sectorId ?? state.selectedSectorId;
  const activeLoopKind =
    opts?.kind === undefined && state.autoRepeatSession?.active
      ? state.autoRepeatSession.kind
      : undefined;
  const requestedKind = opts?.kind ?? activeLoopKind;
  const requestedSourceId =
    opts?.sourceId !== undefined
      ? opts.sourceId
      : activeLoopKind !== undefined
      ? state.autoRepeatSession?.sourceId ?? null
      : null;

  let validation: ReturnType<typeof validateBattleLaunch>;
  if (requestedKind !== undefined) {
    validation = validateBattleLaunch(
      state.pilot,
      targetSectorId,
      requestedKind,
      requestedSourceId,
      state.adminConfig
    );
  } else {
    const battleOptions = getBattleOptions(
      state.pilot,
      targetSectorId,
      state.adminConfig
    );
    const defaultKind = pickDefaultBattle(battleOptions);
    const defaultOpt =
      defaultKind !== null
        ? battleOptions.find(
            (opt) => opt.kind === defaultKind && opt.allowed
          ) ?? null
        : null;
    if (defaultKind === null || !defaultOpt) {
      validation = {
        allowed: false,
        kind: 'assault',
        sourceId: null,
        reasonKey:
          battleOptions.find((opt) => !opt.allowed && opt.reasonKey)
            ?.reasonKey ?? 'map.reason.notFrontline',
      };
    } else if (defaultOpt.sourceId) {
      validation = validateBattleLaunch(
        state.pilot,
        targetSectorId,
        defaultOpt.kind,
        defaultOpt.sourceId,
        state.adminConfig
      );
    } else {
      validation = {
        allowed: true,
        kind: defaultOpt.kind,
        sourceId: null,
        sizeOverride: defaultOpt.sizeOverride,
      };
    }
  }

  if (!validation.allowed) {
    const reasonKey: BattleOptionReasonKey =
      validation.reasonKey ?? 'map.reason.notFrontline';
    const patch: Partial<GameStoreState> = {
      battleLaunchToast: {
        id: `launch_toast_${Date.now()}`,
        reasonKey,
        sectorId: targetSectorId,
      },
    };
    if (state.autoRepeatSession?.active) {
      const stopReason: AutoStopReason =
        state.autoRepeatSession.stopReason ??
        ((validation.kind === 'mission' || validation.kind === 'event') &&
        reasonKey === 'map.reason.sourceInactive'
          ? 'source_inactive'
          : 'node_not_contested');
      const streakLimit = clampDefeatStreakLimit(
        state.autoRepeatSession.defeatStreakLimit ??
          state.autoRepeatDefeatStreakLimit
      );
      patch.autoRepeatSession = {
        ...state.autoRepeatSession,
        active: false,
        stopReason,
      };
      patch.autoRepeatToast = null;
      if (state.battle) {
        patch.battle = {
          ...state.battle,
          log: [
            ...state.battle.log,
            {
              id: `log_repeat_stop_${Date.now()}_${state.battle.turnCounter}`,
              round: state.battle.round,
              actorName: 'SYSTEM',
              tag: 'SYSTEM' as const,
              templateKey: 'log.autoRepeatStopped' as const,
              params: {
                reason: stopReason,
                streak: streakLimit,
              },
            },
          ],
        };
      }
    }
    set(patch);
    return;
  }

  const effectiveSizeOverride =
    validation.sizeOverride ?? state.adminConfig.battleSizeOverride;
  const battleState = createInitialBattleState(
    state.pilot,
    targetSectorId,
    Math.random,
    effectiveSizeOverride,
    state.adminConfig,
    validation.kind,
    validation.sourceId,
    validation.rewardMult
  );
  soundFx.playConfirm();

  if (state.adminConfig.alwaysWin) {
    const defeatedEnemies = battleState.units.map((u) =>
      u.side === 'enemy'
        ? {
            ...u,
            hp: 0,
            shield: 0,
            alive: false,
            animState: 'destroyed' as const,
          }
        : u
    );
    const outcomePatch = finalizeBattleOutcome(
      state,
      battleState,
      defeatedEnemies,
      true,
      false
    );
    set({
      ...outcomePatch,
      selectedSectorId: targetSectorId,
      screen: 'BATTLE',
      battleLaunchToast: null,
      ...(!state.autoRepeatSession?.active
        ? { autoRepeatSession: null, autoRepeatToast: null }
        : {}),
    });
    return;
  }

  const loopAutoConfirmPrestage =
    Boolean(state.autoRepeatSession?.active) &&
    Boolean(battleState.prestage?.active);
  const initialBattle = loopAutoConfirmPrestage
    ? {
        ...battleState,
        prestage: {
          ...battleState.prestage!,
          active: false,
        },
        log: [
          ...battleState.log,
          {
            id: `log_prestage_${Date.now()}_${battleState.turnCounter}`,
            round: battleState.round,
            actorName: 'SYSTEM',
            tag: 'SYSTEM' as const,
            templateKey: 'log.prestageConfirm' as const,
            params: {},
          },
        ],
      }
    : battleState;

  set({
    selectedSectorId: targetSectorId,
    battle: initialBattle,
    screen: 'BATTLE',
    hasSaveData: true,
    battleLaunchToast: null,
    ...(!state.autoRepeatSession?.active
      ? { autoRepeatSession: null, autoRepeatToast: null }
      : {}),
  });
}

export function isBattleActive(
  state?: Pick<GameStoreState, 'screen' | 'battle'>
): boolean {
  const target = state ?? useGameStore.getState();
  return (
    target.screen === 'BATTLE' && Boolean(target.battle && !target.battle.summary)
  );
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      ...initialFresh,
      supplyShopStock: initialFresh.supplyShopStock ?? [],
      supplyShopStockWp: initialFresh.supplyShopStockWp ?? [],
      voucherShopStockWp: initialFresh.voucherShopStockWp ?? [],
      crateShopStockWp: initialFresh.crateShopStockWp ?? [],
      crateShopStockCredit: initialFresh.crateShopStockCredit ?? [],
      blackMarketOffer: initialFresh.blackMarketOffer ?? null,
      supplyShopRefresh: initialFresh.supplyShopRefresh ?? { used: 0 },
      battleSpeed: initialDeviceSpeed ?? initialFresh.battleSpeed,
      screen: 'TITLE',
      activeTab: 'gear',
      shopSubTab: 'buy',
      battle: null,
      adminUnlocked: readPersistedAdminUnlock(),
      adminPanelOpen: false,
      autoBattleEnabled: false,
      tacticsModalOpen: false,
      lastRaidNotice: null,
      autoRepeatLimit: 1,
      autoRepeatDefeatRule: initialDeviceLoopPrefs.defeatRule,
      autoRepeatDefeatStreakLimit: initialDeviceLoopPrefs.defeatStreakLimit,
      autoRepeatStopOnDefeat:
        initialDeviceLoopPrefs.defeatRule === 'stop_immediately',
      autoRepeatSession: null,
      autoRepeatToast: null,
      battleLaunchToast: null,
      quickSellUndo: null,
      autoEquipUndo: null,
      hasImportBackup: hasPersistedImportBackup(),

      setLanguage: (language) => {
        soundFx.playClick();
        set({ language });
      },

      setScreen: (screen) => {
        if (isBattleActive(get())) return;
        soundFx.playClick();
        if (screen === 'SHOP') {
          set({ screen: 'HANGAR', activeTab: 'shop' });
          return;
        }
        set({ screen });
      },

      setActiveTab: (activeTab) => {
        const state = get();
        if (isBattleActive(state)) return;
        if (activeTab === 'warehouse' && state.autoRepeatSession?.active) {
          return;
        }
        soundFx.playClick();
        set({ screen: 'HANGAR', activeTab });
      },

      setShopSubTab: (shopSubTab) => {
        soundFx.playClick();
        set({ shopSubTab });
      },

      openWarPointShop: () => {
        if (isBattleActive(get())) return;
        soundFx.playClick();
        set({ screen: 'HANGAR', activeTab: 'shop', shopSubTab: 'warpoints' });
      },

      startCampaign: (pilotName, starterClassId) => {
        const state = get();
        soundFx.playConfirm();
        if (!state.hasSaveData) {
          setActiveMapPack(state.adminConfig.mapPack ?? null);
          const cleanName =
            (pilotName ?? state.pilot.name).trim().slice(0, 18) || 'Vance';
          const chosenClass =
            starterClassId ?? state.pilot.activeGearId ?? 'striker';
          const fresh = createFreshCampaignState(
            cleanName,
            chosenClass,
            Math.random,
            state.adminConfig.starterSet,
            state.adminConfig.starterEvent,
            state.adminConfig.vouchers,
            state.adminConfig.crateShop
          );
          const startSupplyStock = generateSupplyShopStock(
            getMaxGearLevel(fresh.pilot),
            state.adminConfig,
            SUPPLY_TEMPLATES
          );
          const startSupplyStockWp = generateSupplyShopStockWp(
            getMaxGearLevel(fresh.pilot),
            state.adminConfig,
            startSupplyStock.length,
            SUPPLY_TEMPLATES
          );
          const startVoucherStockWp = rollVoucherShopStockWp(state.adminConfig);
          const startCrateStockWp = rollCrateShopStockWp(state.adminConfig);
          const startCrateStockCredit = rollCrateShopStockCredit(state.adminConfig);
          const startBlackMarketOffer = rollBlackMarketMedalOffer(state.adminConfig);
          set({
            ...fresh,
            supplyShopStock: startSupplyStock,
            supplyShopStockWp: startSupplyStockWp,
            voucherShopStockWp: startVoucherStockWp,
            crateShopStockWp: startCrateStockWp,
            crateShopStockCredit: startCrateStockCredit,
            blackMarketOffer: startBlackMarketOffer,
            supplyShopRefresh: { used: 0 },
            language: state.language,
            muted: state.muted,
            battleSpeed: state.battleSpeed,
            skipAnimations: state.skipAnimations,
            battleViewMode: state.battleViewMode,
            adminConfig: state.adminConfig,
            hasSaveData: true,
            screen: 'HANGAR',
            activeTab: 'gear',
            battle: null,
            battleLaunchToast: null,
          });
        } else {
          set({ screen: 'HANGAR', activeTab: 'gear', battleLaunchToast: null });
        }
      },

      continueCampaign: () => {
        soundFx.playConfirm();
        set({ screen: 'HANGAR', activeTab: 'gear', battleLaunchToast: null });
      },

      resetCampaign: () => {
        const state = get();
        soundFx.playClick();
        clearImportBackupRaw();
        setActiveMapPack(null);
        const fresh = createFreshCampaignState('Vance', 'striker');
        const deviceLoopPrefs = readDeviceLoopPrefs();
        const defaultAdmin = createDefaultAdminConfig();
        setRuntimeMaxLevel(defaultAdmin.maxLevel);
        set({
          ...fresh,
          supplyShopStock: fresh.supplyShopStock ?? [],
          supplyShopStockWp: fresh.supplyShopStockWp ?? [],
          voucherShopStockWp: fresh.voucherShopStockWp ?? [],
          crateShopStockWp: fresh.crateShopStockWp ?? [],
          crateShopStockCredit: fresh.crateShopStockCredit ?? [],
          blackMarketOffer: fresh.blackMarketOffer ?? null,
          supplyShopRefresh: fresh.supplyShopRefresh ?? { used: 0 },
          language: state.language,
          muted: state.muted,
          battleSpeed: state.battleSpeed,
          skipAnimations: state.skipAnimations,
          battleViewMode: state.battleViewMode,
          adminConfig: defaultAdmin,
          hasSaveData: false,
          battle: null,
          screen: 'TITLE',
          activeTab: 'gear',
          shopSubTab: 'buy',
          autoRepeatSession: null,
          autoRepeatToast: null,
          battleLaunchToast: null,
          autoRepeatDefeatRule: deviceLoopPrefs.defeatRule,
          autoRepeatDefeatStreakLimit: deviceLoopPrefs.defeatStreakLimit,
          autoRepeatStopOnDefeat:
            deviceLoopPrefs.defeatRule === 'stop_immediately',
          quickSellUndo: null,
          autoEquipUndo: null,
          hasImportBackup: false,
        });
      },

      setPilotName: (name) => {
        const clean = name.slice(0, 18);
        set((state) => {
          const leadName = clean.trim() || 'Vance';
          const updatedFormation = state.pilot.squadFormation?.map((u) =>
            u.isPlayer || u.id === 'ally_player' ? { ...u, name: leadName } : u
          );
          return {
            pilot: {
              ...state.pilot,
              name: clean,
              ...(updatedFormation ? { squadFormation: updatedFormation } : {}),
            },
            hasSaveData: true,
          };
        });
      },

      selectActiveGear: (classId) => {
        const state = get();
        const targetGear = state.pilot.gears[classId];
        if (!targetGear || !targetGear.owned) return;
        soundFx.playClick();
        const baseFormation =
          state.pilot.squadFormation && state.pilot.squadFormation.length > 0
            ? state.pilot.squadFormation.map((u) =>
                u.isPlayer || u.id === 'ally_player' ? { ...u, classId } : u
              )
            : createDefaultSquadFormation(
                state.pilot.name,
                classId,
                state.adminConfig.formation
              );
        const nextFormation = state.pilot.formationCustomized
          ? enforceFormationCapacities(baseFormation, state.adminConfig.formation)
          : autoPlaceFormation(baseFormation, state.adminConfig.formation);
        set({
          pilot: {
            ...state.pilot,
            activeGearId: classId,
            squadFormation: nextFormation,
          },
          hasSaveData: true,
        });
      },

      buyGear: (classId) => {
        const state = get();
        const targetGear = state.pilot.gears[classId];
        if (!targetGear || targetGear.owned) {
          return { ok: false, cost: 0 };
        }
        const ownedCount = MECH_CLASS_LIST.filter(
          (c) => state.pilot.gears[c.id].owned
        ).length;
        const cost = getGarageUnlockCost(ownedCount);
        if (state.pilot.credits < cost) {
          return { ok: false, cost };
        }

        soundFx.playVictory();
        const baseFormation =
          state.pilot.squadFormation && state.pilot.squadFormation.length > 0
            ? state.pilot.squadFormation.map((u) =>
                u.isPlayer || u.id === 'ally_player' ? { ...u, classId } : u
              )
            : createDefaultSquadFormation(
                state.pilot.name,
                classId,
                state.adminConfig.formation
              );
        const nextFormation = state.pilot.formationCustomized
          ? enforceFormationCapacities(baseFormation, state.adminConfig.formation)
          : autoPlaceFormation(baseFormation, state.adminConfig.formation);

        const unlockedPilot: PilotAccount = {
          ...state.pilot,
          credits: state.pilot.credits - cost,
          activeGearId: classId,
          squadFormation: nextFormation,
          gears: {
            ...state.pilot.gears,
            [classId]: {
              ...targetGear,
              owned: true,
            },
          },
        };
        const withStarter = grantStarterSetToGear(
          unlockedPilot,
          classId,
          state.adminConfig.starterSet
        ).pilot;
        const withStarterEvent = grantStarterEventPack(
          withStarter,
          state.adminConfig.starterEvent,
          classId,
          { voucherCfgOrAdmin: state.adminConfig }
        ).pilot;

        set({
          pilot: withStarterEvent,
          hasSaveData: true,
        });
        return { ok: true, cost };
      },

      moveSquadUnitRow: (unitId, targetRow, swapWithUnitId) => {
        const state = get();
        const formationCfg = sanitizeFormationConfig(state.adminConfig.formation);
        const currentFormation =
          state.pilot.squadFormation && state.pilot.squadFormation.length > 0
            ? state.pilot.squadFormation
            : createDefaultSquadFormation(
                state.pilot.name,
                state.pilot.activeGearId,
                formationCfg
              );
        const result = moveUnitToRow(
          currentFormation,
          unitId,
          targetRow,
          formationCfg,
          { swapIfFull: true, swapWithUnitId }
        );
        if (result.ok) {
          soundFx.playClick();
          set({
            pilot: {
              ...state.pilot,
              squadFormation: result.units,
              formationCustomized: true,
            },
            hasSaveData: true,
          });
        }
        return {
          ok: result.ok,
          reason: result.reason,
          currentCount: result.currentCount,
          capacity: result.capacity,
          swappedWithUnitId: result.swappedWithUnitId,
        };
      },

      autoArrangeSquadFormation: () => {
        const state = get();
        const formationCfg = sanitizeFormationConfig(state.adminConfig.formation);
        const currentFormation =
          state.pilot.squadFormation && state.pilot.squadFormation.length > 0
            ? state.pilot.squadFormation
            : createDefaultSquadFormation(
                state.pilot.name,
                state.pilot.activeGearId,
                formationCfg
              );
        const arranged = autoPlaceFormation(currentFormation, formationCfg);
        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            squadFormation: arranged,
            formationCustomized: false,
          },
          hasSaveData: true,
        });
      },

      commitStatAllocations: (pending) => {
        const state = get();
        const activeId = state.pilot.activeGearId;
        const activeGear = state.pilot.gears[activeId];
        const nextGear = allocateGearStats(activeGear, pending);
        if (nextGear === activeGear) return;

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [activeId]: nextGear,
            },
          },
          hasSaveData: true,
        });
      },

      resetStatAllocations: () => {
        const state = get();
        const activeId = state.pilot.activeGearId;
        const activeGear = state.pilot.gears[activeId];
        const nextGear = resetGearStatAllocations(activeGear);

        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [activeId]: nextGear,
            },
          },
          hasSaveData: true,
        });
      },

      // ---- GEAR SKILL SYSTEM ACTIONS ----
      learnOrUpgradeSkill: (skillId) => {
        const state = get();
        const res = learnOrUpgradeSkillOnGear(
          state.pilot,
          state.pilot.activeGearId,
          skillId,
          state.adminConfig
        );
        if (res.validation.ok) {
          soundFx.playVictory();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return { validation: res.validation, newLevel: res.newLevel };
      },

      equipSkillToBar: (skillId) => {
        const state = get();
        const res = equipSkillToGearBar(
          state.pilot,
          state.pilot.activeGearId,
          skillId,
          state.adminConfig
        );
        if (res.validation.ok) {
          soundFx.playConfirm();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return res.validation;
      },

      unequipSkillFromBar: (skillId) => {
        const state = get();
        const nextPilot = unequipSkillFromGearBar(
          state.pilot,
          state.pilot.activeGearId,
          skillId
        );
        if (nextPilot === state.pilot) return;
        soundFx.playClick();
        set({ pilot: nextPilot, hasSaveData: true });
      },

      equipPassiveSkill: (skillId) => {
        const state = get();
        const res = equipPassiveToGear(
          state.pilot,
          state.pilot.activeGearId,
          skillId,
          state.adminConfig
        );
        if (res.validation.ok) {
          soundFx.playConfirm();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return res.validation;
      },

      unequipPassiveSkill: (skillId) => {
        const state = get();
        const nextPilot = unequipPassiveFromGear(
          state.pilot,
          state.pilot.activeGearId,
          skillId
        );
        if (nextPilot === state.pilot) return;
        soundFx.playClick();
        set({ pilot: nextPilot, hasSaveData: true });
      },

      buyOpeningCardAction: (cardId) => {
        const state = get();
        const res = buyOpeningCard(state.pilot, cardId, state.adminConfig);
        if (res.ok) {
          soundFx.playVictory();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return { ok: res.ok, reason: res.reason, cost: res.cost };
      },

      // ---- AUTO BATTLE & PER-GEAR TACTICS ACTIONS ----
      setAutoBattleEnabled: (enabled) => {
        soundFx.playClick();
        set((state) => ({
          autoBattleEnabled: enabled,
          battle: state.battle
            ? {
                ...state.battle,
                autoStopNotice: enabled ? null : state.battle.autoStopNotice,
              }
            : null,
        }));
      },

      toggleAutoBattle: () => {
        const next = !get().autoBattleEnabled;
        get().setAutoBattleEnabled(next);
      },

      setTacticsModalOpen: (tacticsModalOpen) => {
        soundFx.playClick();
        set({ tacticsModalOpen });
      },

      setActiveGearTactics: (tactics) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const clean = sanitizeGearTactics(gear.classId, tactics);
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [id]: {
                ...gear,
                tactics: clean,
              },
            },
          },
          hasSaveData: true,
        });
      },

      applySimpleTactics: (patch) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const unlockedActive = getUnlockedActiveSlots(
          gear.level,
          state.adminConfig?.activeSlots
        );
        const currentSimple =
          gear.tactics.simple ??
          createDefaultSimpleTactics(
            gear.classId,
            gear.equippedSkillBar,
            unlockedActive
          );
        const nextSimple: SimpleTacticsConfig = {
          ...currentSimple,
          ...patch,
        };
        const generated = generateTacticsFromSimple(
          gear.classId,
          nextSimple,
          gear.equippedSkillBar,
          gear.tactics.safety,
          unlockedActive
        );
        soundFx.playClick();
        get().setActiveGearTactics(generated);
      },

      applySimpleTacticsPreset: (presetId) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const unlockedActive = getUnlockedActiveSlots(
          gear.level,
          state.adminConfig?.activeSlots
        );
        const presetSimple = createSimplePresetConfig(
          presetId,
          gear.classId,
          gear.equippedSkillBar,
          unlockedActive
        );
        const generated = generateTacticsFromSimple(
          gear.classId,
          presetSimple,
          gear.equippedSkillBar,
          gear.tactics.safety,
          unlockedActive
        );
        soundFx.playConfirm();
        get().setActiveGearTactics(generated);
      },

      resetTacticsToSimple: () => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const unlockedActive = getUnlockedActiveSlots(
          gear.level,
          state.adminConfig?.activeSlots
        );
        const baseSimple =
          gear.tactics.simple ??
          createDefaultSimpleTactics(
            gear.classId,
            gear.equippedSkillBar,
            unlockedActive
          );
        const generated = generateTacticsFromSimple(
          gear.classId,
          baseSimple,
          gear.equippedSkillBar,
          gear.tactics.safety,
          unlockedActive
        );
        soundFx.playConfirm();
        get().setActiveGearTactics(generated);
      },

      loadTacticsPreset: (presetId) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const unlockedActive = getUnlockedActiveSlots(
          gear.level,
          state.adminConfig?.activeSlots
        );
        soundFx.playConfirm();
        const preset = createPresetTactics(
          gear.classId,
          presetId,
          gear.equippedSkillBar
        );
        get().setActiveGearTactics({
          ...preset,
          mode: 'custom',
          simple:
            gear.tactics.simple ??
            createDefaultSimpleTactics(
              gear.classId,
              gear.equippedSkillBar,
              unlockedActive
            ),
        });
      },

      addTacticsRule: () => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        if (gear.tactics.rules.length >= BALANCE_CONFIG.maxTacticsRules) return;
        soundFx.playClick();
        get().setActiveGearTactics({
          ...gear.tactics,
          mode: 'custom',
          rules: [...gear.tactics.rules, createBlankTacticsRule()],
        });
      },

      updateTacticsRule: (ruleId, patch) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const nextRules = gear.tactics.rules.map((r) =>
          r.id === ruleId ? { ...r, ...patch } : r
        );
        get().setActiveGearTactics({
          ...gear.tactics,
          mode: 'custom',
          rules: nextRules,
        });
      },

      deleteTacticsRule: (ruleId) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        soundFx.playClick();
        get().setActiveGearTactics({
          ...gear.tactics,
          mode: 'custom',
          rules: gear.tactics.rules.filter((r) => r.id !== ruleId),
        });
      },

      reorderTacticsRules: (fromIndex, toIndex) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const rules = [...gear.tactics.rules];
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= rules.length ||
          toIndex >= rules.length ||
          fromIndex === toIndex
        ) {
          return;
        }
        const [moved] = rules.splice(fromIndex, 1);
        rules.splice(toIndex, 0, moved);
        soundFx.playClick();
        get().setActiveGearTactics({
          ...gear.tactics,
          mode: 'custom',
          rules,
        });
      },

      updateTacticsSafety: (patch) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        get().setActiveGearTactics({
          ...gear.tactics,
          safety: {
            ...gear.tactics.safety,
            ...patch,
          },
        });
      },

      setAutoRepeatLimit: (autoRepeatLimit) => {
        soundFx.playClick();
        set({ autoRepeatLimit });
      },

      setAutoRepeatDefeatRule: (autoRepeatDefeatRule) => {
        soundFx.playClick();
        const limit = clampDefeatStreakLimit(get().autoRepeatDefeatStreakLimit);
        writeDeviceLoopPrefs({
          defeatRule: autoRepeatDefeatRule,
          defeatStreakLimit: limit,
        });
        set({
          autoRepeatDefeatRule,
          autoRepeatStopOnDefeat: autoRepeatDefeatRule === 'stop_immediately',
        });
      },

      setAutoRepeatDefeatStreakLimit: (rawLimit) => {
        const clamped = clampDefeatStreakLimit(rawLimit);
        const defeatRule = get().autoRepeatDefeatRule;
        writeDeviceLoopPrefs({
          defeatRule,
          defeatStreakLimit: clamped,
        });
        set({ autoRepeatDefeatStreakLimit: clamped });
      },

      setAutoRepeatStopOnDefeat: (autoRepeatStopOnDefeat) => {
        soundFx.playClick();
        const nextRule: AutoRepeatDefeatRule = autoRepeatStopOnDefeat
          ? 'stop_immediately'
          : 'stop_after_n';
        const limit = clampDefeatStreakLimit(get().autoRepeatDefeatStreakLimit);
        writeDeviceLoopPrefs({
          defeatRule: nextRule,
          defeatStreakLimit: limit,
        });
        set({
          autoRepeatDefeatRule: nextRule,
          autoRepeatStopOnDefeat,
        });
      },

      startAutoRepeat: (limit, sectorId, opts) => {
        const state = get();
        const chosenLimit = limit ?? state.autoRepeatLimit;
        const chosenSector =
          sectorId ?? state.battle?.sectorId ?? state.selectedSectorId;
        const streakLimit = clampDefeatStreakLimit(
          state.autoRepeatDefeatStreakLimit
        );

        const ongoingBattle =
          state.battle && !state.battle.summary ? state.battle : null;
        const autoBattleOptions =
          opts?.kind === undefined && !ongoingBattle
            ? getBattleOptions(state.pilot, chosenSector, state.adminConfig)
            : null;
        const pickedDefaultKind = autoBattleOptions
          ? pickDefaultBattle(autoBattleOptions)
          : null;
        const pickedDefaultOpt =
          autoBattleOptions && pickedDefaultKind
            ? autoBattleOptions.find(
                (opt) => opt.kind === pickedDefaultKind && opt.allowed
              ) ?? null
            : null;
        const resolvedKind: BattleKind | undefined =
          opts?.kind ?? ongoingBattle?.kind ?? pickedDefaultKind ?? undefined;
        const resolvedSourceId =
          opts?.sourceId !== undefined
            ? opts.sourceId
            : ongoingBattle
            ? ongoingBattle.sourceId ?? null
            : pickedDefaultOpt?.sourceId ?? null;

        const boxCap = getBoxCapacity(state.adminConfig);
        if (state.pilot.inventory.length >= boxCap) {
          set({
            autoRepeatLimit: chosenLimit,
            autoRepeatToast: null,
            autoRepeatSession: {
              active: false,
              limit: chosenLimit,
              sectorId: chosenSector,
              kind: resolvedKind,
              sourceId: resolvedSourceId,
              completedRuns: 0,
              wins: 0,
              consecutiveDefeats: 0,
              defeatStreakLimit: streakLimit,
              totalExp: 0,
              totalCredits: 0,
              totalWarPoints: 0,
              totalDrops: [],
              stopReason: 'inventory_full',
            },
          });
          return;
        }

        const isNextBattleIdle = !state.battle || Boolean(state.battle.summary);
        if (isNextBattleIdle) {
          const checkKind: BattleKind = resolvedKind ?? 'assault';
          const validation =
            resolvedKind !== undefined
              ? validateBattleLaunch(
                  state.pilot,
                  chosenSector,
                  checkKind,
                  resolvedSourceId,
                  state.adminConfig
                )
              : null;
          if (!validation || !validation.allowed) {
            const optsList = getBattleOptions(
              state.pilot,
              chosenSector,
              state.adminConfig
            );
            const reasonKey: BattleOptionReasonKey =
              validation?.reasonKey ??
              optsList.find((opt) => !opt.allowed && opt.reasonKey)
                ?.reasonKey ??
              'map.reason.notFrontline';
            const stopReason: AutoStopReason =
              (checkKind === 'mission' || checkKind === 'event') &&
              reasonKey === 'map.reason.sourceInactive'
                ? 'source_inactive'
                : 'node_not_contested';
            set({
              autoRepeatLimit: chosenLimit,
              autoRepeatToast: null,
              battleLaunchToast: {
                id: `launch_toast_${Date.now()}`,
                reasonKey,
                sectorId: chosenSector,
              },
              autoRepeatSession: {
                active: false,
                limit: chosenLimit,
                sectorId: chosenSector,
                kind: resolvedKind,
                sourceId: resolvedSourceId,
                completedRuns: 0,
                wins: 0,
                consecutiveDefeats: 0,
                defeatStreakLimit: streakLimit,
                totalExp: 0,
                totalCredits: 0,
                totalWarPoints: 0,
                totalDrops: [],
                stopReason,
              },
            });
            return;
          }
        }

        soundFx.playConfirm();
        set({
          autoRepeatLimit: chosenLimit,
          autoBattleEnabled: true,
          autoRepeatToast: null,
          autoRepeatSession: {
            active: true,
            limit: chosenLimit,
            sectorId: chosenSector,
            kind: resolvedKind,
            sourceId: resolvedSourceId,
            completedRuns: 0,
            wins: 0,
            consecutiveDefeats: 0,
            defeatStreakLimit: streakLimit,
            totalExp: 0,
            totalCredits: 0,
            totalWarPoints: 0,
            totalDrops: [],
            stopReason: null,
          },
        });

        // If not currently in an ongoing battle, start immediately
        if (!state.battle || state.battle.summary) {
          get().startBattle(chosenSector, {
            kind: resolvedKind,
            sourceId: resolvedSourceId,
          });
        } else if (state.battle.prestage?.active) {
          get().confirmPrestage();
        }
      },

      stopAutoRepeat: (reason = 'manual_stop') => {
        const state = get();
        if (!state.autoRepeatSession) return;
        soundFx.playClick();
        const finalReason = state.autoRepeatSession.stopReason ?? reason;
        const streakLimit = clampDefeatStreakLimit(
          state.autoRepeatSession.defeatStreakLimit ??
            state.autoRepeatDefeatStreakLimit
        );
        set({
          autoRepeatSession: {
            ...state.autoRepeatSession,
            active: false,
            stopReason: finalReason,
          },
          battle: state.battle
            ? {
                ...state.battle,
                log: [
                  ...state.battle.log,
                  {
                    id: `log_repeat_stop_${Date.now()}_${state.battle.turnCounter}`,
                    round: state.battle.round,
                    actorName: 'SYSTEM',
                    tag: 'SYSTEM' as const,
                    templateKey: 'log.autoRepeatStopped' as const,
                    params: {
                      reason: finalReason,
                      streak: streakLimit,
                    },
                  },
                ],
              }
            : null,
        });
      },

      clearAutoRepeatSummary: () => {
        soundFx.playClick();
        set({ autoRepeatSession: null, autoRepeatToast: null });
      },

      clearAutoRepeatToast: () => set({ autoRepeatToast: null }),

      clearBattleLaunchToast: () => set({ battleLaunchToast: null }),

      selectSector: (sectorId) => {
        const state = get();
        if (!isVisible(state.pilot, sectorId)) return;
        soundFx.playClick();
        set({ selectedSectorId: sectorId, hasSaveData: true });
      },

      repairBase: (sectorId) => {
        const state = get();
        const res = startBaseRepair(state.pilot, sectorId);
        if (res.ok) {
          soundFx.playConfirm();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return res;
      },

      repairBaseHp: (sectorId) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, reason: 'busy' };
        }
        const res = applyBaseRepair(
          state.pilot,
          sectorId,
          { hp: true },
          state.adminConfig.baseSiege
        );
        if (!res.ok) {
          return {
            ok: false,
            reason: res.reason,
            ...(res.cost !== undefined ? { cost: res.cost } : {}),
          };
        }
        soundFx.playConfirm();
        set({ pilot: res.pilot, hasSaveData: true });
        return {
          ok: true,
          cost: res.cost,
          healed: res.healed?.hp ?? 0,
        };
      },

      repairBaseShield: (sectorId) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, reason: 'busy' };
        }
        const res = applyBaseRepair(
          state.pilot,
          sectorId,
          { shield: true },
          state.adminConfig.baseSiege
        );
        if (!res.ok) {
          return {
            ok: false,
            reason: res.reason,
            ...(res.cost !== undefined ? { cost: res.cost } : {}),
          };
        }
        soundFx.playConfirm();
        set({ pilot: res.pilot, hasSaveData: true });
        return {
          ok: true,
          cost: res.cost,
          healed: res.healed?.shield ?? 0,
        };
      },

      clearRaidNotice: () => set({ lastRaidNotice: null }),

      advanceMonth: () => {
        const state = get();
        const npcSupplyCfg = sanitizeNpcSupplyConfig(
          state.adminConfig.npcSupply
        );
        const rawSummary = advanceCampaignMonth(
          state.pilot,
          npcSupplyCfg.sector.regenPerMonth,
          state.adminConfig.baseSiege,
          state.adminConfig.monthlyEconomy,
          Math.random
        );
        const pilotAfterPirates = ensureIdle(
          spawnOnMonth(
            rawSummary.pilot,
            state.adminConfig.pirates,
            Math.random
          ),
          state.adminConfig.pirates,
          Math.random,
          state.adminConfig
        );
        const summary: MonthAdvanceSummary = {
          ...rawSummary,
          pilot: pilotAfterPirates,
        };
        soundFx.playConfirm();
        const activeGear = summary.pilot.gears[summary.pilot.activeGearId];
        const nextShopStock = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? generateCategorizedShopStock(
              activeGear.level,
              buildShopOptionsFromState(summary.pilot, state.adminConfig)
            )
          : state.shopStock;
        const nextSupplyShopStock = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? generateSupplyShopStock(
              getMaxGearLevel(summary.pilot),
              state.adminConfig,
              SUPPLY_TEMPLATES
            )
          : state.supplyShopStock;
        const nextSupplyShopStockWp = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? generateSupplyShopStockWp(
              getMaxGearLevel(summary.pilot),
              state.adminConfig,
              nextSupplyShopStock.length,
              SUPPLY_TEMPLATES
            )
          : state.supplyShopStockWp;
        const nextVoucherShopStockWp = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? rollVoucherShopStockWp(state.adminConfig)
          : state.voucherShopStockWp;
        const nextCrateShopStockWp = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? rollCrateShopStockWp(state.adminConfig)
          : (state.crateShopStockWp ?? []);
        const nextCrateShopStockCredit = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? rollCrateShopStockCredit(state.adminConfig)
          : (state.crateShopStockCredit ?? []);
        const nextBlackMarketOffer = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? rollBlackMarketMedalOffer(state.adminConfig)
          : (state.blackMarketOffer ?? null);
        const nextSupplyShopRefresh: SupplyShopRefreshState =
          SHOP_STOCK_CONFIG.restockOnMonthAdvance
            ? { used: 0 }
            : sanitizeSupplyShopRefresh(state.supplyShopRefresh);
        const nextWpOffers = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? generateWpMarketOffers({
              shipyardBonus: hasOperationalShipyard(summary.pilot),
              adminConfig: state.adminConfig,
            })
          : state.wpMarketOffers;
        set({
          pilot: summary.pilot,
          shopStock: nextShopStock,
          supplyShopStock: nextSupplyShopStock,
          supplyShopStockWp: nextSupplyShopStockWp,
          voucherShopStockWp: nextVoucherShopStockWp,
          crateShopStockWp: nextCrateShopStockWp,
          crateShopStockCredit: nextCrateShopStockCredit,
          blackMarketOffer: nextBlackMarketOffer,
          supplyShopRefresh: nextSupplyShopRefresh,
          wpMarketOffers: nextWpOffers,
          battlesUntilRestock: SHOP_STOCK_CONFIG.restockEveryNBattles,
          hasSaveData: true,
          ...(summary.raidResults.length > 0
            ? { lastRaidNotice: summary.raidResults }
            : {}),
        });
        return summary;
      },

      hireWingmanAtBase: (sectorId, classId = 'interceptor') => {
        const state = get();
        const res = hirePilotForNextBattle(state.pilot, sectorId, classId);
        if (res.ok) {
          soundFx.playConfirm();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return res;
      },

      acceptMissionAtBase: (sectorId) => {
        const state = get();
        const res = acceptBaseBonusMission(state.pilot, sectorId);
        if (res.ok) {
          soundFx.playConfirm();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return res;
      },

      useEngineerAtBase: (sectorId) => {
        const state = get();
        const res = applyBaseEngineerBoost(state.pilot, sectorId);
        if (res.ok) {
          soundFx.playConfirm();
          set({ pilot: res.pilot, hasSaveData: true });
        }
        return res;
      },

      setInventoryFilterState: (patch) => {
        set((state) => ({
          inventoryFilterState: {
            ...state.inventoryFilterState,
            ...patch,
          },
        }));
      },

      resetInventoryFilterState: () => {
        set({ inventoryFilterState: getDefaultInventoryFilterState() });
      },

      setQuickSellConfig: (patch) => {
        set((state) => ({
          quickSellConfig: {
            ...state.quickSellConfig,
            ...patch,
          },
        }));
      },

      toggleItemLock: (instanceId) => {
        soundFx.playClick();
        set((state) => ({
          pilot: {
            ...state.pilot,
            inventory: state.pilot.inventory.map((it) =>
              it.instanceId === instanceId ? { ...it, locked: !it.locked } : it
            ),
          },
          hasSaveData: true,
        }));
      },

      toggleItemFavorite: (instanceId) => {
        soundFx.playClick();
        set((state) => ({
          pilot: {
            ...state.pilot,
            inventory: state.pilot.inventory.map((it) =>
              it.instanceId === instanceId
                ? { ...it, favorited: !it.favorited }
                : it
            ),
          },
          hasSaveData: true,
        }));
      },

      markItemSeen: (instanceId) => {
        const state = get();
        const target = state.pilot.inventory.find(
          (it) => it.instanceId === instanceId
        );
        if (!target || !target.isNew) return;
        set({
          pilot: {
            ...state.pilot,
            inventory: state.pilot.inventory.map((it) =>
              it.instanceId === instanceId ? { ...it, isNew: false } : it
            ),
          },
        });
      },

      bulkSetItemLock: (instanceIds, locked) => {
        if (instanceIds.length === 0) return;
        const idSet = new Set(instanceIds);
        soundFx.playClick();
        set((state) => ({
          pilot: {
            ...state.pilot,
            inventory: state.pilot.inventory.map((it) =>
              idSet.has(it.instanceId) ? { ...it, locked } : it
            ),
          },
          hasSaveData: true,
        }));
      },

      bulkSellItems: (instanceIds) => {
        const state = get();
        if (instanceIds.length === 0) {
          return { soldCount: 0, creditsEarned: 0 };
        }
        const idSet = new Set(instanceIds);
        const soldItems: ItemInstance[] = [];
        const remaining: ItemInstance[] = [];
        let creditsEarned = 0;

        for (const it of state.pilot.inventory) {
          if (
            idSet.has(it.instanceId) &&
            !it.locked &&
            getItemEquippedByGear(state.pilot.gears, it.instanceId) === null
          ) {
            soldItems.push(it);
            creditsEarned += getSellPrice(it);
          } else {
            remaining.push(it);
          }
        }

        if (soldItems.length === 0) {
          return { soldCount: 0, creditsEarned: 0 };
        }

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits + creditsEarned,
            inventory: remaining,
          },
          hasSaveData: true,
        });
        return { soldCount: soldItems.length, creditsEarned };
      },

      executeQuickSell: (instanceIds) => {
        const state = get();
        if (instanceIds.length === 0) {
          return { soldCount: 0, creditsEarned: 0 };
        }
        const idSet = new Set(instanceIds);
        const soldItems: ItemInstance[] = [];
        const soldFromWarehouseIds: string[] = [];
        const remainingInventory: ItemInstance[] = [];
        const currentWarehouse = Array.isArray(state.pilot.warehouse)
          ? state.pilot.warehouse
          : [];
        const warehouseLocked =
          isBattleActive(state) || Boolean(state.autoRepeatSession?.active);
        const remainingWarehouse: ItemInstance[] = [];
        let creditsEarned = 0;

        for (const it of state.pilot.inventory) {
          if (
            idSet.has(it.instanceId) &&
            !it.locked &&
            !it.favorited &&
            getItemEquippedByGear(state.pilot.gears, it.instanceId) === null
          ) {
            soldItems.push(it);
            creditsEarned += getSellPrice(it);
          } else {
            remainingInventory.push(it);
          }
        }

        for (const it of currentWarehouse) {
          if (
            !warehouseLocked &&
            idSet.has(it.instanceId) &&
            !it.locked &&
            !it.favorited &&
            getItemEquippedByGear(state.pilot.gears, it.instanceId) === null
          ) {
            soldItems.push(it);
            soldFromWarehouseIds.push(it.instanceId);
            creditsEarned += getSellPrice(it);
          } else {
            remainingWarehouse.push(it);
          }
        }

        if (soldItems.length === 0) {
          return { soldCount: 0, creditsEarned: 0 };
        }

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits + creditsEarned,
            inventory: remainingInventory,
            warehouse:
              soldFromWarehouseIds.length > 0
                ? remainingWarehouse
                : currentWarehouse,
          },
          quickSellUndo: {
            soldItems,
            totalCredits: creditsEarned,
            soldAt: Date.now(),
            ...(soldFromWarehouseIds.length > 0
              ? { soldFromWarehouseIds }
              : {}),
          },
          hasSaveData: true,
        });
        return { soldCount: soldItems.length, creditsEarned };
      },

      moveToWarehouse: (ids) => {
        const state = get();
        if (isBattleActive(state) || Boolean(state.autoRepeatSession?.active)) {
          return {
            moved: 0,
            skippedEquipped: 0,
            skippedProtected: 0,
            skippedFull: 0,
            reason: 'locked',
          };
        }
        const {
          pilot,
          moved,
          skippedEquipped,
          skippedProtected,
          skippedFull,
        } = moveToWarehouseEngine(
          state.pilot,
          ids,
          state.adminConfig.warehouseCapacity
        );
        if (pilot !== state.pilot) {
          set({ pilot, hasSaveData: true });
        }
        return { moved, skippedEquipped, skippedProtected, skippedFull };
      },

      setSupplyLoadout: (gearId, ids) => {
        const state = get();
        if (isBattleActive(state) || Boolean(state.autoRepeatSession?.active)) {
          return { ok: false, rejected: [], reason: 'locked' };
        }
        const gear = state.pilot.gears[gearId];
        if (!gear) {
          return { ok: false, rejected: [] };
        }
        const { gear: nextGear, rejected } = setSupplyLoadoutEngine(
          gear,
          ids,
          state.adminConfig
        );
        if (rejected.some((r) => r.reason === 'family_duplicate')) {
          return { ok: false, rejected };
        }
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [gearId]: nextGear,
            },
          },
          hasSaveData: true,
        });
        return { ok: true, rejected };
      },

      setExtenderModule: (gearId, index, instanceId) => {
        const state = get();
        if (isBattleActive(state) || Boolean(state.autoRepeatSession?.active)) {
          return {
            ok: false,
            reason: 'locked',
            reasonKey: 'extender.reason.locked',
          };
        }
        if (instanceId === null) {
          const cleared = clearModuleEngine(state.pilot, gearId, index);
          if (!cleared.ok) {
            return {
              ok: false,
              reason: 'socket_locked',
              reasonKey: 'extender.reason.socket_locked',
            };
          }
          set({ pilot: cleared.pilot, hasSaveData: true });
          return { ok: true };
        }
        const equipped = setModuleEngine(
          state.pilot,
          gearId,
          index,
          instanceId,
          state.adminConfig
        );
        if (!equipped.ok) {
          return {
            ok: false,
            reason: equipped.reason ?? 'socket_locked',
            reasonKey: equipped.reasonKey,
            ...(equipped.conflictSocket !== undefined
              ? {
                  conflictSocket: equipped.conflictSocket,
                  reasonParams: equipped.reasonParams,
                }
              : {}),
          };
        }
        set({ pilot: equipped.pilot, hasSaveData: true });
        return { ok: true };
      },

      moveToBox: (ids) => {
        const state = get();
        if (isBattleActive(state) || Boolean(state.autoRepeatSession?.active)) {
          return {
            moved: 0,
            skippedEquipped: 0,
            skippedProtected: 0,
            skippedFull: 0,
            reason: 'locked',
          };
        }
        const {
          pilot,
          moved,
          skippedEquipped,
          skippedProtected,
          skippedFull,
        } = moveToBoxEngine(
          state.pilot,
          ids,
          getBoxCapacity(state.adminConfig)
        );
        if (pilot !== state.pilot) {
          set({ pilot, hasSaveData: true });
        }
        return { moved, skippedEquipped, skippedProtected, skippedFull };
      },

      moveAllUnusedToWarehouse: () => {
        const state = get();
        if (isBattleActive(state) || Boolean(state.autoRepeatSession?.active)) {
          return {
            moved: 0,
            skippedEquipped: 0,
            skippedProtected: 0,
            skippedFull: 0,
            reason: 'locked',
          };
        }
        const {
          pilot,
          moved,
          skippedEquipped,
          skippedProtected,
          skippedFull,
        } = moveAllUnusedToWarehouseEngine(
          state.pilot,
          state.adminConfig.warehouseCapacity
        );
        if (pilot !== state.pilot) {
          set({ pilot, hasSaveData: true });
        }
        return { moved, skippedEquipped, skippedProtected, skippedFull };
      },

      undoQuickSell: () => {
        const state = get();
        const undo = state.quickSellUndo;
        if (!undo || undo.soldItems.length === 0) {
          return { ok: false, restoredCount: 0 };
        }
        const currentWarehouse = Array.isArray(state.pilot.warehouse)
          ? state.pilot.warehouse
          : [];
        const existingBoxIds = new Set(
          state.pilot.inventory.map((i) => i.instanceId)
        );
        const existingWarehouseIds = new Set(
          currentWarehouse.map((i) => i.instanceId)
        );
        const warehouseOriginSet = new Set(undo.soldFromWarehouseIds ?? []);

        const toRestoreBox: ItemInstance[] = [];
        const toRestoreWarehouse: ItemInstance[] = [];
        for (const it of undo.soldItems) {
          if (
            existingBoxIds.has(it.instanceId) ||
            existingWarehouseIds.has(it.instanceId)
          ) {
            continue;
          }
          if (warehouseOriginSet.has(it.instanceId)) {
            toRestoreWarehouse.push(it);
          } else {
            toRestoreBox.push(it);
          }
        }

        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            credits: Math.max(0, state.pilot.credits - undo.totalCredits),
            inventory: [...toRestoreBox, ...state.pilot.inventory],
            warehouse: [...toRestoreWarehouse, ...currentWarehouse],
          },
          quickSellUndo: null,
          hasSaveData: true,
        });
        return {
          ok: true,
          restoredCount: toRestoreBox.length + toRestoreWarehouse.length,
        };
      },

      clearQuickSellUndo: () => set({ quickSellUndo: null }),

      previewAutoEquip: (mode, targetGearId) => {
        const state = get();
        const config = sanitizeAutoEquipConfig(state.adminConfig.autoEquip);
        return buildAutoEquipPlan(state.pilot, {
          mode,
          targetGearId: targetGearId ?? state.pilot.activeGearId,
          config,
        });
      },

      applyAutoEquip: (plan) => {
        const state = get();
        if (!plan || plan.totalChangedSlots <= 0) {
          return { ok: false, changedSlotsCount: 0 };
        }
        const { pilot: nextPilot, undoSnapshot } = applyAutoEquipPlan(
          state.pilot,
          plan
        );
        soundFx.playConfirm();
        set({
          pilot: nextPilot,
          autoEquipUndo: undoSnapshot,
          hasSaveData: true,
        });
        return { ok: true, changedSlotsCount: undoSnapshot.changedSlotsCount };
      },

      undoAutoEquip: () => {
        const state = get();
        const snapshot = state.autoEquipUndo;
        if (!snapshot) {
          return { ok: false, restoredGearsCount: 0 };
        }
        const nextPilot = undoAutoEquipSnapshot(state.pilot, snapshot);
        soundFx.playClick();
        set({
          pilot: nextPilot,
          autoEquipUndo: null,
          hasSaveData: true,
        });
        return {
          ok: true,
          restoredGearsCount: Object.keys(snapshot.previousEquippedByGear).length,
        };
      },

      clearAutoEquipUndo: () => set({ autoEquipUndo: null }),

      equipItem: (instanceId) => {
        const state = get();
        const { pilot: nextPilot, validation } = equipItemOnGear(
          state.pilot,
          state.pilot.activeGearId,
          instanceId
        );
        if (validation.canEquip) {
          soundFx.playConfirm();
          set({ pilot: nextPilot, hasSaveData: true });
        }
        return validation;
      },

      unequipSlot: (slot) => {
        const state = get();
        const nextPilot = unequipSlotOnGear(
          state.pilot,
          state.pilot.activeGearId,
          slot
        );
        if (nextPilot === state.pilot) return;
        soundFx.playClick();
        set({ pilot: nextPilot, hasSaveData: true });
      },

      unequipInstanceEverywhere: (instanceId) => {
        const state = get();
        const nextPilot = unequipInstanceFromAnyGear(state.pilot, instanceId);
        if (nextPilot === state.pilot) return;
        soundFx.playClick();
        set({ pilot: nextPilot, hasSaveData: true });
      },

      buyShopItem: (instanceId) => {
        const state = get();
        const idx = state.shopStock.findIndex(
          (it) => it.instanceId === instanceId
        );
        if (idx === -1) return { ok: false };
        const listing = state.shopStock[idx];
        if (listing.soldOut) return { ok: false };
        if (state.pilot.inventory.length >= getBoxCapacity(state.adminConfig)) {
          return { ok: false };
        }
        if (state.pilot.credits < listing.price) return { ok: false };

        // Mark listing as SOLD OUT instead of removing so shop never appears empty/0
        const nextStock = state.shopStock.map((it, i) =>
          i === idx ? { ...it, soldOut: true } : it
        );
        const { soldOut: _ignored, ...cleanItem } = listing;
        const purchasedItem: ItemInstance = {
          ...cleanItem,
          isNew: true,
          obtainedAt: Date.now(),
        };

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits - listing.price,
            inventory: [purchasedItem, ...state.pilot.inventory],
          },
          shopStock: nextStock,
          hasSaveData: true,
        });
        return { ok: true };
      },

      buySupply: (templateId, qty) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, bought: 0, reason: 'locked' };
        }
        const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
        if (safeQty <= 0) {
          return { ok: false, bought: 0, reason: 'invalid_qty' };
        }

        const idx = state.supplyShopStock.findIndex(
          (it) => it.templateId === templateId
        );
        if (idx === -1) {
          return { ok: false, bought: 0, reason: 'not_in_stock' };
        }
        const listing = state.supplyShopStock[idx];
        if (listing.remaining <= 0) {
          return { ok: false, bought: 0, reason: 'sold_out' };
        }

        const tpl = getSupplyTemplateById(templateId);
        if (!tpl) {
          return { ok: false, bought: 0, reason: 'unknown_template' };
        }

        const owned = getSupplyStockCount(state.pilot.consumables, tpl.id);
        const room = Math.max(0, SUPPLY_STACK_CAP - owned);
        if (room <= 0) {
          return { ok: false, bought: 0, reason: 'stack_full' };
        }

        const bought = Math.min(safeQty, listing.remaining, room);
        const unitPrice = computeSupplyPrice(tpl, state.adminConfig);
        const totalCost = unitPrice * bought;
        if (state.pilot.credits < totalCost) {
          return { ok: false, bought: 0, reason: 'insufficient_credits' };
        }

        const nextSupplyStock = state.supplyShopStock.map((it, i) =>
          i === idx
            ? { ...it, remaining: Math.max(0, it.remaining - bought) }
            : it
        );
        const nextConsumables = addSupplyToConsumables(
          state.pilot.consumables ?? [],
          tpl.id,
          bought
        );

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits - totalCost,
            consumables: nextConsumables,
          },
          supplyShopStock: nextSupplyStock,
          hasSaveData: true,
        });
        return { ok: true, bought };
      },

      buySupplyWp: (slotId, qty) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, bought: 0, reason: 'locked' };
        }
        const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
        if (safeQty <= 0) {
          return { ok: false, bought: 0, reason: 'invalid_qty' };
        }

        const idx = state.supplyShopStockWp.findIndex(
          (it) => it.slotId === slotId
        );
        if (idx === -1) {
          return { ok: false, bought: 0, reason: 'not_in_stock' };
        }
        const listing = state.supplyShopStockWp[idx];
        if (listing.remaining <= 0) {
          return { ok: false, bought: 0, reason: 'sold_out' };
        }

        const tpl = getSupplyTemplateById(listing.templateId);
        if (!tpl) {
          return { ok: false, bought: 0, reason: 'unknown_template' };
        }

        const owned = getSupplyStockCount(state.pilot.consumables, tpl.id);
        const room = Math.max(0, SUPPLY_STACK_CAP - owned);
        if (room <= 0) {
          return { ok: false, bought: 0, reason: 'stack_full' };
        }

        const bought = Math.min(safeQty, listing.remaining, room);
        const unitPrice = getSupplyWpPrice(tpl, state.adminConfig);
        const totalCost = unitPrice * bought;
        if (state.pilot.warPoints < totalCost) {
          return { ok: false, bought: 0, reason: 'insufficient_wp' };
        }

        const nextWpStock = state.supplyShopStockWp.map((it, i) =>
          i === idx
            ? { ...it, remaining: Math.max(0, it.remaining - bought) }
            : it
        );
        const nextConsumables = addSupplyToConsumables(
          state.pilot.consumables ?? [],
          tpl.id,
          bought
        );

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            warPoints: state.pilot.warPoints - totalCost,
            consumables: nextConsumables,
          },
          supplyShopStockWp: nextWpStock,
          hasSaveData: true,
        });
        return { ok: true, bought };
      },

      buyVoucher: (id, qty) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, bought: 0, reason: 'locked' };
        }
        const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
        if (safeQty <= 0) {
          return { ok: false, bought: 0, reason: 'invalid_qty' };
        }

        const idx = state.voucherShopStockWp.findIndex(
          (it) => it.voucherId === id
        );
        if (idx === -1) {
          return { ok: false, bought: 0, reason: 'not_in_stock' };
        }
        const listing = state.voucherShopStockWp[idx];
        if (listing.remaining <= 0) {
          return { ok: false, bought: 0, reason: 'sold_out' };
        }

        const def = getVoucherById(id, state.adminConfig);
        if (!def) {
          return { ok: false, bought: 0, reason: 'unknown_voucher' };
        }

        const bought = Math.min(safeQty, listing.remaining);
        const unitPrice = getVoucherPriceWp(def, state.adminConfig);
        const totalCost = unitPrice * bought;
        if ((state.pilot.warPoints ?? 0) < totalCost) {
          return { ok: false, bought: 0, reason: 'insufficient_wp' };
        }

        const nextVoucherStock = state.voucherShopStockWp.map((it, i) =>
          i === idx
            ? { ...it, remaining: Math.max(0, it.remaining - bought) }
            : it
        );
        const prevOwned = state.pilot.vouchers ?? {};
        const nextOwned = {
          ...prevOwned,
          [id]: Math.max(0, Math.floor(prevOwned[id] ?? 0)) + bought,
        };

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            warPoints: (state.pilot.warPoints ?? 0) - totalCost,
            vouchers: nextOwned,
          },
          voucherShopStockWp: nextVoucherStock,
          hasSaveData: true,
        });
        return { ok: true, bought };
      },

      buyCrateWp: (slotId, qty) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, bought: 0, cost: 0, reason: 'locked' };
        }
        const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
        if (safeQty <= 0) {
          return { ok: false, bought: 0, cost: 0, reason: 'invalid_qty' };
        }
        const stock = state.crateShopStockWp ?? [];
        const idx = stock.findIndex((it) => it.slotId === slotId);
        if (idx === -1) {
          return { ok: false, bought: 0, cost: 0, reason: 'not_found' };
        }
        const listing = stock[idx];
        if (listing.remaining <= 0) {
          return { ok: false, bought: 0, cost: 0, reason: 'sold_out' };
        }
        const owned = (state.pilot.consumables ?? []).reduce(
          (sum, c) =>
            c.kind === 'supply_crate'
              ? sum + Math.max(0, Math.floor(c.quantity))
              : sum,
          0
        );
        const room = Math.max(0, SUPPLY_STACK_CAP - owned);
        if (room <= 0) {
          return { ok: false, bought: 0, cost: 0, reason: 'full' };
        }
        const wanted = Math.min(safeQty, listing.remaining);
        const bought = Math.min(wanted, room);
        const cappedByStack = bought < wanted;
        const unitPrice = sanitizeCrateShopConfig(state.adminConfig?.crateShop).wp
          .price;
        const totalCost = unitPrice * bought;
        if ((state.pilot.warPoints ?? 0) < totalCost) {
          return { ok: false, bought: 0, cost: 0, reason: 'no_funds' };
        }
        const nextStock = stock.map((it, i) =>
          i === idx
            ? { ...it, remaining: Math.max(0, it.remaining - bought) }
            : it
        );
        const addRes = addSupplyCrateToConsumables(
          state.pilot.consumables ?? [],
          bought
        );
        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            warPoints: (state.pilot.warPoints ?? 0) - totalCost,
            consumables: addRes.consumables,
          },
          crateShopStockWp: nextStock,
          hasSaveData: true,
        });
        return {
          ok: true,
          bought: addRes.added,
          cost: totalCost,
          cappedByStack,
        };
      },

      buyCrateCredit: (slotId, qty) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, bought: 0, cost: 0, reason: 'locked' };
        }
        const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
        if (safeQty <= 0) {
          return { ok: false, bought: 0, cost: 0, reason: 'invalid_qty' };
        }
        const stock = state.crateShopStockCredit ?? [];
        const idx = stock.findIndex((it) => it.slotId === slotId);
        if (idx === -1) {
          return { ok: false, bought: 0, cost: 0, reason: 'not_found' };
        }
        const listing = stock[idx];
        if (listing.remaining <= 0) {
          return { ok: false, bought: 0, cost: 0, reason: 'sold_out' };
        }
        const owned = (state.pilot.consumables ?? []).reduce(
          (sum, c) =>
            c.kind === 'supply_crate'
              ? sum + Math.max(0, Math.floor(c.quantity))
              : sum,
          0
        );
        const room = Math.max(0, SUPPLY_STACK_CAP - owned);
        if (room <= 0) {
          return { ok: false, bought: 0, cost: 0, reason: 'full' };
        }
        const wanted = Math.min(safeQty, listing.remaining);
        const bought = Math.min(wanted, room);
        const cappedByStack = bought < wanted;
        const unitPrice = sanitizeCrateShopConfig(state.adminConfig?.crateShop)
          .credit.price;
        const totalCost = unitPrice * bought;
        if (state.pilot.credits < totalCost) {
          return { ok: false, bought: 0, cost: 0, reason: 'no_funds' };
        }
        const nextStock = stock.map((it, i) =>
          i === idx
            ? { ...it, remaining: Math.max(0, it.remaining - bought) }
            : it
        );
        const addRes = addSupplyCrateToConsumables(
          state.pilot.consumables ?? [],
          bought
        );
        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits - totalCost,
            consumables: addRes.consumables,
          },
          crateShopStockCredit: nextStock,
          hasSaveData: true,
        });
        return {
          ok: true,
          bought: addRes.added,
          cost: totalCost,
          cappedByStack,
        };
      },

      redeemVouchers: (selection) => {
        const state = get();
        const battle = state.battle;
        const summary = battle?.summary;
        if (!battle || !summary) {
          return {
            ok: false,
            reason: 'no_summary',
            creditUsed: {},
            expUsed: {},
            creditRefund: 0,
            expRefund: 0,
          };
        }
        if (summary.voucherRedeemed) {
          return {
            ok: false,
            reason: 'already_redeemed',
            creditUsed: summary.voucherCreditUsed ?? {},
            expUsed: summary.voucherExpUsed ?? {},
            creditRefund: summary.voucherCreditRefund ?? 0,
            expRefund: summary.voucherExpRefund ?? 0,
          };
        }
        if (summary.outcome !== 'defeat' && !summary.retreated) {
          return {
            ok: false,
            reason: 'not_chargeable',
            creditUsed: {},
            expUsed: {},
            creditRefund: 0,
            expRefund: 0,
          };
        }

        const { creditCharged, expCharged } = getBattleSummaryCharges(summary);
        const owned = state.pilot.vouchers ?? {};

        const clampSel = (rawSel?: Record<string, number>) => {
          const clamped: Record<string, number> = {};
          if (!rawSel) return clamped;
          for (const [id, rawQty] of Object.entries(rawSel)) {
            const avail = Math.max(0, Math.floor(Number(owned[id]) || 0));
            const req = Math.max(0, Math.floor(Number(rawQty) || 0));
            const qty = Math.min(avail, req);
            if (qty > 0) clamped[id] = qty;
          }
          return clamped;
        };

        const creditRes = applyVoucherRefund(
          clampSel(selection?.credit),
          'credit',
          creditCharged,
          state.adminConfig
        );
        const expRes = applyVoucherRefund(
          clampSel(selection?.exp),
          'exp',
          expCharged,
          state.adminConfig
        );

        const nextVouchers: Record<string, number> = {};
        for (const [id, rawQty] of Object.entries(owned)) {
          const cur = Math.max(0, Math.floor(Number(rawQty) || 0));
          const usedQty =
            (creditRes.used[id] ?? 0) + (expRes.used[id] ?? 0);
          const left = Math.max(0, cur - usedQty);
          if (left > 0) {
            nextVouchers[id] = left;
          }
        }

        const deployedGear = state.pilot.gears[summary.deployedGearId];
        const maxAllowedExp =
          summary.expBeforePenalty !== undefined
            ? summary.expBeforePenalty
            : (deployedGear?.exp ?? 0) + expCharged;
        const nextGearExp = deployedGear
          ? Math.min(maxAllowedExp, deployedGear.exp + expRes.refund)
          : 0;

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits + creditRes.refund,
            vouchers: nextVouchers,
            gears: deployedGear
              ? {
                  ...state.pilot.gears,
                  [summary.deployedGearId]: {
                    ...deployedGear,
                    exp: nextGearExp,
                  },
                }
              : state.pilot.gears,
          },
          battle: {
            ...battle,
            summary: {
              ...summary,
              voucherRedeemed: true,
              voucherCreditUsed: creditRes.used,
              voucherExpUsed: expRes.used,
              voucherCreditRefund: creditRes.refund,
              voucherExpRefund: expRes.refund,
            },
          },
          hasSaveData: true,
        });

        return {
          ok: true,
          creditUsed: creditRes.used,
          expUsed: expRes.used,
          creditRefund: creditRes.refund,
          expRefund: expRes.refund,
        };
      },

      redeemCard: (cardId, qty = 1) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, reason: 'busy' };
        }
        const def = getCardDef(cardId);
        if (!def) {
          return { ok: false, reason: 'not_found' };
        }
        const currentCards = sanitizeOwnedCards(state.pilot.cards);
        const ownedQty = currentCards[def.id] ?? 0;
        if (ownedQty <= 0) {
          return { ok: false, reason: 'not_found' };
        }
        const reqQty = Math.floor(Number(qty));
        if (!Number.isFinite(reqQty) || reqQty <= 0) {
          return { ok: false, reason: 'invalid_qty' };
        }
        const useQty = Math.min(ownedQty, reqQty);

        if (def.kind === 'credit') {
          const remaining = ownedQty - useQty;
          const nextCards = { ...currentCards };
          if (remaining > 0) {
            nextCards[def.id] = remaining;
          } else {
            delete nextCards[def.id];
          }
          const creditGain = useQty * def.value;
          soundFx.playConfirm();
          set({
            pilot: {
              ...state.pilot,
              credits: state.pilot.credits + creditGain,
              cards: nextCards,
            },
            hasSaveData: true,
          });
          return {
            ok: true,
            kind: 'credit',
            credit: creditGain,
            cardsUsed: useQty,
          };
        }

        const activeGearId = state.pilot.activeGearId;
        const activeGear = state.pilot.gears[activeGearId];
        if (!activeGear || !activeGear.owned) {
          return { ok: false, reason: 'not_found' };
        }
        const maxLevel = getMaxLevel();
        if (activeGear.level >= maxLevel) {
          return {
            ok: false,
            reason: 'max_level',
            kind: 'exp',
            exp: 0,
            appliedExp: 0,
            wastedExp: 0,
            cardsUsed: 0,
            gearId: activeGearId,
            previousLevel: activeGear.level,
            newLevel: activeGear.level,
            levelsGained: 0,
          };
        }

        const levelRes = applyExpCardBatchToGear(
          activeGear,
          def.value,
          useQty,
          state.adminConfig
        );
        const cardsUsed = levelRes.cardsUsed;
        if (cardsUsed <= 0) {
          return {
            ok: false,
            reason: 'max_level',
            kind: 'exp',
            exp: 0,
            appliedExp: 0,
            wastedExp: 0,
            cardsUsed: 0,
            gearId: activeGearId,
            previousLevel: activeGear.level,
            newLevel: activeGear.level,
            levelsGained: 0,
          };
        }

        const remaining = ownedQty - cardsUsed;
        const nextCards = { ...currentCards };
        if (remaining > 0) {
          nextCards[def.id] = remaining;
        } else {
          delete nextCards[def.id];
        }

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [activeGearId]: levelRes.updatedGear,
            },
            cards: nextCards,
          },
          hasSaveData: true,
        });
        return {
          ok: true,
          kind: 'exp',
          exp: levelRes.appliedExp,
          appliedExp: levelRes.appliedExp,
          wastedExp: levelRes.wastedExp,
          cardsUsed,
          gearId: activeGearId,
          previousLevel: levelRes.previousLevel,
          newLevel: levelRes.newLevel,
          levelsGained: levelRes.levelsGained,
        };
      },

      redeemMedal: (medalId, qty = 1) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, reason: 'busy' };
        }
        const parsed = parseMedalId(medalId);
        if (!parsed) {
          return { ok: false, reason: 'not_found' };
        }
        const currentMedals = sanitizePilotMedals(state.pilot.medals);
        const ownedQty = currentMedals[parsed.id] ?? 0;
        if (ownedQty <= 0) {
          return { ok: false, reason: 'not_found' };
        }
        const reqQty = Math.floor(Number(qty));
        if (!Number.isFinite(reqQty) || reqQty <= 0) {
          return { ok: false, reason: 'invalid_qty' };
        }
        const useQty = Math.min(ownedQty, reqQty);
        const remaining = ownedQty - useQty;
        const nextMedals = { ...currentMedals };
        if (remaining > 0) {
          nextMedals[parsed.id] = remaining;
        } else {
          delete nextMedals[parsed.id];
        }
        const wpPerMedal = getMedalWpValue(parsed.tier, state.adminConfig);
        const wpGained = useQty * wpPerMedal;
        const newWarPoints = state.pilot.warPoints + wpGained;
        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            warPoints: newWarPoints,
            medals: nextMedals,
          },
          hasSaveData: true,
        });
        return {
          ok: true,
          medalId: parsed.id,
          tier: parsed.tier,
          qtyUsed: useQty,
          wpGained,
          newWarPoints,
        };
      },

      refreshSupplyShop: () => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, reason: 'locked' };
        }
        const used = sanitizeSupplyShopRefresh(state.supplyShopRefresh).used;
        const maxRefreshes = sanitizeSupplyShopMaxRefreshes(
          state.adminConfig?.supplyShopMaxRefreshes
        );
        if (used >= maxRefreshes) {
          return {
            ok: false,
            reason: 'limit',
            battlesLeft: Math.max(0, state.battlesUntilRestock),
          };
        }
        const baseCost = sanitizeSupplyShopRefreshBaseCost(
          state.adminConfig?.supplyShopRefreshBaseCost
        );
        const cost = used * baseCost;
        if (state.pilot.credits < cost) {
          return { ok: false, reason: 'credits', cost };
        }

        const maxLevel = getMaxGearLevel(state.pilot);
        const nextCreditStock = generateSupplyShopStock(
          maxLevel,
          state.adminConfig,
          SUPPLY_TEMPLATES
        );
        const nextWpStock = generateSupplyShopStockWp(
          maxLevel,
          state.adminConfig,
          nextCreditStock.length,
          SUPPLY_TEMPLATES
        );
        const nextVoucherStockWp = rollVoucherShopStockWp(state.adminConfig);
        const nextCrateCreditStock = rollCrateShopStockCredit(state.adminConfig);
        const nextCrateWpStock = rollCrateShopStockWp(state.adminConfig);

        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits - cost,
          },
          supplyShopStock: nextCreditStock,
          supplyShopStockWp: nextWpStock,
          voucherShopStockWp: nextVoucherStockWp,
          crateShopStockWp: nextCrateWpStock,
          crateShopStockCredit: nextCrateCreditStock,
          supplyShopRefresh: { used: used + 1 },
          hasSaveData: true,
        });
        return { ok: true, cost };
      },

      refreshShopStock: () => {
        const state = get();
        const cost = SHOP_STOCK_CONFIG.refreshCostCredits;
        if (state.pilot.credits < cost) {
          return { ok: false, cost };
        }
        const activeGear = state.pilot.gears[state.pilot.activeGearId];
        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits - cost,
          },
          shopStock: generateCategorizedShopStock(
            activeGear.level,
            buildShopOptionsFromState(state.pilot, state.adminConfig)
          ),
          blackMarketOffer: rollBlackMarketMedalOffer(state.adminConfig),
          battlesUntilRestock: SHOP_STOCK_CONFIG.restockEveryNBattles,
          hasSaveData: true,
        });
        return { ok: true, cost };
      },

      buyBlackMarketOffer: () => {
        const state = get();
        const offer = state.blackMarketOffer;
        if (!offer) return { ok: false, reason: 'not_found' };
        if (offer.soldOut) return { ok: false, reason: 'sold_out' };
        if (state.pilot.credits < offer.creditPrice) {
          return { ok: false, reason: 'insufficient_credits' };
        }
        const nextMedals = grantMedalsToMap(state.pilot.medals, {
          [offer.medalId]: 1,
        });
        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits - offer.creditPrice,
            medals: nextMedals,
          },
          blackMarketOffer: { ...offer, soldOut: true },
          hasSaveData: true,
        });
        return {
          ok: true,
          creditCost: offer.creditPrice,
          medalId: offer.medalId,
        };
      },

      buyWpMarketOffer: (offerId) => {
        const state = get();
        const idx = state.wpMarketOffers.findIndex((o) => o.id === offerId);
        if (idx === -1) return { ok: false, reason: 'not_found' };
        const offer = state.wpMarketOffers[idx];
        if (offer.soldOut) return { ok: false, reason: 'sold_out' };
        if (state.pilot.warPoints < offer.wpCost) {
          return { ok: false, reason: 'insufficient_wp' };
        }

        const nextOffers = state.wpMarketOffers.map((o, i) =>
          i === idx ? { ...o, soldOut: true } : o
        );

        if (offer.kind === 'buff_card' || offer.kind === 'exp_boost') {
          const targetCardId =
            offer.cardId ?? getBuffCardId('exp', 0);
          const pilotWithCard = grantBuffCardToPilot(
            state.pilot,
            targetCardId,
            1
          );
          soundFx.playConfirm();
          set({
            pilot: {
              ...pilotWithCard,
              warPoints: state.pilot.warPoints - offer.wpCost,
            },
            wpMarketOffers: nextOffers,
            hasSaveData: true,
          });
          return { ok: true };
        }

        const existingConsumables = [...(state.pilot.consumables ?? [])];
        // Stack identical consumables when possible
        const matchIdx = existingConsumables.findIndex(
          (c) =>
            c.kind === offer.kind &&
            c.slot === offer.slot &&
            c.minRarity === offer.minRarity &&
            c.bonusPct === offer.bonusPct &&
            c.battlesCount === offer.battlesCount
        );
        if (matchIdx >= 0) {
          existingConsumables[matchIdx] = {
            ...existingConsumables[matchIdx],
            quantity: existingConsumables[matchIdx].quantity + 1,
          };
        } else {
          existingConsumables.push({
            id: `cons_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5).toString(36)}`,
            kind: offer.kind,
            quantity: 1,
            slot: offer.slot,
            minRarity: offer.minRarity,
            bonusPct: offer.bonusPct,
            battlesCount: offer.battlesCount,
          });
        }

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            warPoints: state.pilot.warPoints - offer.wpCost,
            consumables: existingConsumables,
          },
          wpMarketOffers: nextOffers,
          hasSaveData: true,
        });
        return { ok: true };
      },

      refreshWpMarket: () => {
        const state = get();
        const cost = SHOP_STOCK_CONFIG.wpRefreshCostWp;
        if (state.pilot.warPoints < cost) {
          return { ok: false, cost };
        }
        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            warPoints: state.pilot.warPoints - cost,
          },
          wpMarketOffers: generateWpMarketOffers({
            shipyardBonus: hasOperationalShipyard(state.pilot),
            adminConfig: state.adminConfig,
          }),
          hasSaveData: true,
        });
        return { ok: true, cost };
      },

      useBuffCard: (cardId, opts) => {
        const state = get();
        const res = useBuffCardEngine(
          state.pilot,
          cardId,
          state.adminConfig,
          {
            confirmReplace: opts?.confirmReplace,
            isBattleActive: isBattleActive(state),
            isAutoRepeatActive: Boolean(state.autoRepeatSession?.active),
          }
        );
        if (!res.ok) return res;
        soundFx.playConfirm();
        set({
          pilot: res.pilot,
          hasSaveData: true,
        });
        return res;
      },

      useConsumable: (consumableId) => {
        const state = get();
        const consumables = state.pilot.consumables ?? [];
        const idx = consumables.findIndex((c) => c.id === consumableId);
        if (idx === -1 || consumables[idx].quantity <= 0) {
          return { ok: false };
        }
        const entry = consumables[idx];
        const nextConsumables = consumables
          .map((c, i) =>
            i === idx ? { ...c, quantity: c.quantity - 1 } : c
          )
          .filter((c) => c.quantity > 0);

        const activeGear = state.pilot.gears[state.pilot.activeGearId];

        if (entry.kind === 'equipment_crate') {
          const maxTier =
            activeGear.level >= 9
              ? 4
              : activeGear.level >= 6
              ? 3
              : activeGear.level >= 3
              ? 2
              : 1;
          const openedItem = generateItemInstance({
            slot: entry.slot ?? 'main_weapon',
            tier: maxTier,
            rarity: entry.minRarity ?? 'rare',
            requiredLevel: Math.max(1, activeGear.level),
            isNew: true,
          });
          soundFx.playVictory();
          set({
            pilot: {
              ...state.pilot,
              consumables: nextConsumables,
              inventory: [openedItem, ...state.pilot.inventory],
            },
            hasSaveData: true,
          });
          return { ok: true, openedItem, kind: entry.kind };
        }

        if (entry.kind === 'enchant_stone') {
          const bonus =
            entry.bonusPct ?? SHOP_STOCK_CONFIG.wpOffers.enchantStone.bonusPct;
          soundFx.playConfirm();
          set({
            pilot: {
              ...state.pilot,
              consumables: nextConsumables,
              activeEnchantBonusPct: Math.min(
                50,
                (state.pilot.activeEnchantBonusPct ?? 0) + bonus
              ),
            },
            hasSaveData: true,
          });
          return { ok: true, kind: entry.kind };
        }

        if (entry.kind === 'respec_token') {
          const resetGear = resetGearStatAllocations(activeGear);
          soundFx.playConfirm();
          set({
            pilot: {
              ...state.pilot,
              consumables: nextConsumables,
              gears: {
                ...state.pilot.gears,
                [state.pilot.activeGearId]: resetGear,
              },
            },
            hasSaveData: true,
          });
          return { ok: true, kind: entry.kind };
        }

        if (entry.kind === 'exp_boost') {
          const cardId = getBuffCardId('exp', 0);
          const pilotWithCard = grantBuffCardToPilot(
            { ...state.pilot, consumables: nextConsumables },
            cardId,
            1
          );
          const useRes = useBuffCardEngine(
            pilotWithCard,
            cardId,
            state.adminConfig,
            {
              isBattleActive: isBattleActive(state),
              isAutoRepeatActive: Boolean(state.autoRepeatSession?.active),
            }
          );
          if (!useRes.ok) {
            if (useRes.reason === 'busy') {
              return { ok: false };
            }
            // Move into buffCards stock so user can confirm replace or wait for stack room
            soundFx.playConfirm();
            set({
              pilot: pilotWithCard,
              hasSaveData: true,
            });
            return { ok: true, kind: entry.kind };
          }
          soundFx.playConfirm();
          set({
            pilot: useRes.pilot,
            hasSaveData: true,
          });
          return { ok: true, kind: entry.kind };
        }

        if (entry.kind === 'supply_crate') {
          const rewardsCfg = sanitizeSupplyRewardsConfig(
            state.adminConfig.supplyRewards
          );
          const maxGearLevel = getPilotMaxGearLevel(state.pilot);
          const rolledList = rollSupplyCrateContents(
            maxGearLevel,
            {
              ...rewardsCfg.crate,
              minTier: rewardsCfg.minTier,
              maxTier: rewardsCfg.maxTier,
            },
            Math.random
          );
          let workingConsumables = nextConsumables;
          const openedSupplies: Array<{
            templateId: string;
            qty: number;
            lost?: number;
          }> = [];
          for (const item of rolledList) {
            const addRes = addSupplyWithOverflow(
              workingConsumables,
              item.templateId,
              item.qty
            );
            workingConsumables = addRes.consumables;
            openedSupplies.push({
              templateId: item.templateId,
              qty: addRes.added,
              ...(addRes.lost > 0 ? { lost: addRes.lost } : {}),
            });
          }
          soundFx.playVictory();
          set({
            pilot: {
              ...state.pilot,
              consumables: workingConsumables,
            },
            hasSaveData: true,
          });
          return { ok: true, kind: entry.kind, openedSupplies };
        }

        return { ok: false };
      },

      sellItem: (instanceId) => {
        const state = get();
        if (getItemEquippedByGear(state.pilot.gears, instanceId) !== null) {
          return { ok: false, creditsEarned: 0 };
        }
        const idx = state.pilot.inventory.findIndex(
          (i) => i.instanceId === instanceId
        );
        if (idx === -1) return { ok: false, creditsEarned: 0 };

        const inst = state.pilot.inventory[idx];
        if (inst.locked) {
          return { ok: false, creditsEarned: 0 };
        }
        const sellValue = getSellPrice(inst);
        const nextInventory = [...state.pilot.inventory];
        nextInventory.splice(idx, 1);

        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits + sellValue,
            inventory: nextInventory,
          },
          hasSaveData: true,
        });
        return { ok: true, creditsEarned: sellValue };
      },

      sellSupply: (templateId, qty) => {
        const state = get();
        if (isBattleActive(state) || state.autoRepeatSession?.active) {
          return { ok: false, sold: 0, creditsEarned: 0 };
        }
        const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
        if (safeQty <= 0) {
          return { ok: false, sold: 0, creditsEarned: 0 };
        }

        const tpl = getSupplyTemplateById(templateId);
        if (!tpl) {
          return { ok: false, sold: 0, creditsEarned: 0 };
        }

        const owned = getSupplyStockCount(state.pilot.consumables, tpl.id);
        if (owned <= 0) {
          return { ok: false, sold: 0, creditsEarned: 0 };
        }

        const sold = Math.min(safeQty, owned);
        const unitCredit = Math.round(
          computeSupplyPrice(tpl, state.adminConfig) * SHOP_CONFIG.sellPriceRatio
        );
        const creditsEarned = unitCredit * sold;

        let remainingToRemove = sold;
        const nextConsumables = (state.pilot.consumables ?? [])
          .map((c) => {
            if (
              remainingToRemove > 0 &&
              c.kind === 'battle_supply' &&
              c.templateId === tpl.id
            ) {
              const take = Math.min(c.quantity, remainingToRemove);
              remainingToRemove -= take;
              return { ...c, quantity: c.quantity - take };
            }
            return c;
          })
          .filter((c) => c.quantity > 0);

        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            credits: state.pilot.credits + creditsEarned,
            consumables: nextConsumables,
          },
          hasSaveData: true,
        });
        return { ok: true, sold, creditsEarned };
      },

      enchantEquippedSlot: (slot) => {
        const state = get();
        const activeGear = state.pilot.gears[state.pilot.activeGearId];
        const instanceId = activeGear.equipped[slot];
        if (!instanceId) return null;

        const invIdx = state.pilot.inventory.findIndex(
          (it) => it.instanceId === instanceId
        );
        if (invIdx === -1) return null;

        const instance = state.pilot.inventory[invIdx];
        const bonusPct = state.pilot.activeEnchantBonusPct ?? 0;
        const { result, updatedInstance, remainingCredits } =
          resolveEnchantAttempt(
            instance,
            state.pilot.credits,
            Math.random,
            bonusPct
          );

        if (!result.attempted) {
          return result;
        }

        if (result.success) {
          soundFx.playVictory();
        } else {
          soundFx.playEvade();
        }

        const nextInventory = [...state.pilot.inventory];
        nextInventory[invIdx] = updatedInstance;

        set({
          pilot: {
            ...state.pilot,
            credits: remainingCredits,
            inventory: nextInventory,
            activeEnchantBonusPct: 0,
          },
          hasSaveData: true,
        });

        return result;
      },

      startBattle: (sectorId, opts) => {
        const state = get();
        if (isBattleActive(state)) return;
        launchBattleForSector(state, set, sectorId, opts);
      },

      reloadBattle: (sectorId, opts) => {
        launchBattleForSector(get(), set, sectorId, opts);
      },

      confirmPrestage: () => {
        const { battle } = get();
        if (!battle || !battle.prestage?.active) return;
        const confirmLog: CombatLogEntry = {
          id: `log_prestage_${Date.now()}_${battle.turnCounter}`,
          round: battle.round,
          actorName: 'SYSTEM',
          tag: 'SYSTEM',
          templateKey: 'log.prestageConfirm',
          params: {},
        };
        set({
          battle: {
            ...battle,
            prestage: {
              ...battle.prestage,
              active: false,
            },
            log: [...battle.log, confirmLog],
          },
        });
      },

      cancelPrestage: () => {
        const state = get();
        const { battle } = state;
        if (!battle || !battle.prestage?.active || battle.summary) return;
        soundFx.playClick();
        if (state.autoRepeatSession?.active) {
          const stopReason: AutoStopReason =
            state.autoRepeatSession.stopReason ?? 'cancelled';
          set({
            battle: null,
            screen: 'HANGAR',
            activeTab: 'map',
            autoRepeatToast: null,
            autoRepeatSession: {
              ...state.autoRepeatSession,
              active: false,
              stopReason,
            },
          });
          return;
        }
        set({
          battle: null,
          screen: 'HANGAR',
          activeTab: 'map',
        });
      },

      selectTarget: (unitId) => {
        const { battle } = get();
        if (!battle || battle.summary) return;
        const unit = battle.units.find((u) => u.id === unitId);
        if (!unit || !unit.alive || unit.side !== 'enemy') return;
        soundFx.playClick();
        set({
          battle: {
            ...battle,
            selectedTargetId: unitId,
          },
        });
      },

      selectAllyTarget: (unitId) => {
        const { battle } = get();
        if (!battle || battle.summary) return;
        const unit = battle.units.find((u) => u.id === unitId);
        if (!unit || !unit.alive || unit.side !== 'ally') return;
        soundFx.playClick();
        set({
          battle: {
            ...battle,
            selectedAllyTargetId: unitId,
          },
        });
      },

      logRadarInvalidTarget: (targetName, reasonKey) => {
        const { battle } = get();
        if (!battle || battle.summary) return;
        const cleanTarget = String(targetName ?? '').trim() || '—';
        const nextEntry: CombatLogEntry = {
          id: `log_inv_${Date.now()}_${battle.log.length}`,
          round: battle.round,
          actorName: cleanTarget,
          tag: 'SYSTEM',
          templateKey: 'log.invalidTarget',
          params: {
            target: cleanTarget,
            reasonKey,
          },
        };
        set({
          battle: {
            ...battle,
            log: [...battle.log, nextEntry],
          },
        });
      },

      useBattleSupply: (templateId) => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary || battle.isResolving || battle.prestage?.active) {
          return;
        }

        const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
        const activeUnit = battle.units.find((u) => u.id === activeUnitId);
        if (!activeUnit || !activeUnit.isPlayer || !activeUnit.alive) return;

        const activeGear = state.pilot.gears[battle.deployedGearId];
        const maxSlots = sanitizeSupplyLoadoutSlots(
          state.adminConfig?.supplyLoadoutSlots
        );
        const cleanLoadout = sanitizeSupplyLoadout(
          activeGear?.supplyLoadout,
          maxSlots
        );
        if (!cleanLoadout.includes(templateId)) return;

        const template = getSupplyTemplateById(templateId);
        if (!template) return;

        const stock = getSupplyStockCount(state.pilot.consumables, template.id);
        const res = applyBattleSupplyUse({
          units: battle.units,
          supplyByUnit: battle.supplyByUnit,
          unitId: activeUnit.id,
          template,
          stock,
          isOwnTurn: true,
          cfg: state.adminConfig,
          kind: battle.kind,
        });
        if (!res.ok) return;

        let decremented = false;
        const nextConsumables = (state.pilot.consumables ?? [])
          .map((c) => {
            if (
              !decremented &&
              c.kind === 'battle_supply' &&
              c.templateId === template.id
            ) {
              decremented = true;
              return { ...c, quantity: c.quantity - 1 };
            }
            return c;
          })
          .filter((c) => c.quantity > 0);

        const skipVisualFx = state.skipAnimations;
        const muteSound = state.skipAnimations || state.battleSpeed >= 10;
        const uidSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const feedback = buildSupplyUseFeedback({
          units: battle.units,
          round: battle.round,
          actor: activeUnit,
          template,
          result: res,
          uidSuffix,
        });
        playCue(feedback.cue, muteSound);

        const supplyLog = enrichLogEntries([feedback.logEntry], activeUnit);
        const supplyActorAfter =
          res.units.find((u) => u.id === activeUnit.id) ?? activeUnit;
        const supplyVoiced = emitVoice(
          {
            ...battle,
            units: res.units,
            log: [...battle.log, ...supplyLog],
          },
          'supplyUse',
          supplyActorAfter
        );

        set({
          battle: {
            ...battle,
            units: res.units,
            supplyByUnit: res.supplyByUnit,
            log: supplyVoiced.log,
            voice: supplyVoiced.voice,
            popups: skipVisualFx
              ? []
              : [...battle.popups, ...feedback.popups].slice(-18),
            fxEvents: skipVisualFx
              ? []
              : [...battle.fxEvents, feedback.fxEvent].slice(-12),
          },
          pilot: {
            ...state.pilot,
            consumables: nextConsumables,
          },
          hasSaveData: true,
        });
      },

      performPlayerAction: (action, skillId, transferCount) => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary || battle.isResolving || battle.prestage?.active) {
          return;
        }

        const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
        const activeUnit = battle.units.find((u) => u.id === activeUnitId);
        if (!activeUnit || !activeUnit.isPlayer || !activeUnit.alive) return;

        const skipVisualFx = state.skipAnimations;
        const muteSound = state.skipAnimations || state.battleSpeed >= 10;

        // Route single_ally skills to selectedAllyTargetId; offensive actions to selectedTargetId
        const skillDef = skillId ? getSkillById(skillId, state.adminConfig) : undefined;
        let clampedTransferCount = transferCount;
        if (action === 'skill' && skillDef?.effectKind === 'sp_transfer') {
          const fluxLv =
            activeUnit.skillLevels[skillDef.id] ?? activeUnit.skillLevel ?? 1;
          const maxAffordable = getMaxAffordableFluxCount(
            battle.units,
            activeUnit.id,
            fluxLv,
            state.adminConfig.fluxTransfer,
            getEffectiveSkillMaxLevel(state.adminConfig)
          );
          clampedTransferCount =
            transferCount === undefined
              ? maxAffordable
              : Math.max(0, Math.min(maxAffordable, Math.floor(transferCount)));
        }
        const resolvedTargetId =
          action === 'skill' && skillDef?.targetType === 'single_ally'
            ? battle.selectedAllyTargetId ?? activeUnit.id
            : battle.selectedTargetId;

        const turnStep2Used = battle.turnStep2Used ?? 0;
        const turnLockedSkillIds = battle.turnLockedSkillIds ?? [];
        const resolution = resolveUnitAction(
          battle.units,
          activeUnit.id,
          action,
          resolvedTargetId,
          battle.round,
          state.adminConfig,
          Math.random,
          skillId,
          clampedTransferCount,
          {
            skipTurnStartTicks: turnStep2Used > 0,
            turnLockedSkillIds,
          }
        );
        playCue(resolution.soundCue, muteSound);

        const targetedEnemy =
          resolvedTargetId &&
          battle.units.some((u) => u.id === resolvedTargetId && u.side === 'enemy')
            ? resolvedTargetId
            : battle.lastPlayerTargetId;

        const aliveEnemies = resolution.updatedUnits.filter(
          (u) => u.side === 'enemy' && u.alive
        );
        const aliveAllies = resolution.updatedUnits.filter(
          (u) => u.side === 'ally' && u.alive
        );

        const nextTurnCounter = battle.turnCounter + 1;
        const nextEvents = [
          ...battle.events,
          ...stampTurnEvents(resolution.events, nextTurnCounter),
        ].slice(-5000);
        const enrichedLogs = enrichLogEntries(resolution.logEntries, activeUnit);
        let nextLog = [...battle.log, ...enrichedLogs];
        const voicedAfterAction = applyActionVoiceHooks({
          state: {
            ...battle,
            units: resolution.updatedUnits,
            log: nextLog,
          },
          beforeUnits: battle.units,
          events: resolution.events,
          actorId: activeUnit.id,
          adminConfig: state.adminConfig,
        });
        nextLog = voicedAfterAction.log;
        const nextVoice = voicedAfterAction.voice;
        const nextPopups = skipVisualFx
          ? []
          : [...battle.popups, ...resolution.popups].slice(-18);
        const nextFx = skipVisualFx
          ? []
          : resolution.fxEvent
          ? [...battle.fxEvents, resolution.fxEvent].slice(-12)
          : battle.fxEvents;
        const nextExploded = skipVisualFx
          ? []
          : resolution.destroyedUnitIds.length > 0
          ? [...battle.explodedUnitIds, ...resolution.destroyedUnitIds].slice(-8)
          : battle.explodedUnitIds;

        if (aliveEnemies.length === 0 || aliveAllies.length === 0) {
          const won = aliveEnemies.length === 0;
          set(
            finalizeBattleOutcome(
              state,
              { ...battle, voice: nextVoice },
              resolution.updatedUnits,
              won,
              false,
              nextLog,
              nextPopups,
              nextFx,
              nextExploded,
              nextEvents,
              nextTurnCounter
            )
          );
          return;
        }

        const actorAfter = resolution.updatedUnits.find(
          (u) => u.id === activeUnit.id
        );
        const didCastSkill =
          action === 'skill' &&
          Boolean(skillId) &&
          resolution.events.some(
            (ev) =>
              ev.type === 'skill_cast' &&
              ev.actorId === activeUnit.id &&
              ev.skillId === skillId
          );
        const phaseOutcome = evaluateTurnPhaseAfterAction({
          skill: skillDef,
          didCastSkill,
          actorAlive: Boolean(actorAfter?.alive),
          aliveEnemiesCount: aliveEnemies.length,
          aliveAlliesCount: aliveAllies.length,
          turnStep2Used,
          turnLockedSkillIds,
          cfg: state.adminConfig.turnPhase,
        });

        const playerNext = resolution.updatedUnits.find((u) => u.isPlayer);
        const validFrontEnemies = playerNext
          ? getValidEnemyTargets(resolution.updatedUnits, playerNext, 'attack')
          : aliveEnemies;
        const currentTargetStillAlive = aliveEnemies.some(
          (e) => e.id === battle.selectedTargetId
        );
        const currentAllyStillAlive = aliveAllies.some(
          (a) => a.id === battle.selectedAllyTargetId
        );

        if (phaseOutcome.keepTurn) {
          set({
            battle: {
              ...battle,
              units: resolution.updatedUnits,
              voice: nextVoice,
              log: nextLog,
              events: nextEvents,
              popups: nextPopups,
              fxEvents: nextFx,
              explodedUnitIds: nextExploded,
              selectedTargetId: currentTargetStillAlive
                ? battle.selectedTargetId
                : validFrontEnemies[0]?.id ?? aliveEnemies[0]?.id ?? null,
              selectedAllyTargetId: currentAllyStillAlive
                ? battle.selectedAllyTargetId
                : aliveAllies[0]?.id ?? null,
              lastPlayerTargetId: targetedEnemy,
              turnStep2Used: phaseOutcome.nextTurnStep2Used,
              turnLockedSkillIds: phaseOutcome.nextTurnLockedSkillIds,
              autoStopNotice: null,
              isResolving: false,
            },
          });
          return;
        }

        // Reconcile upcoming units in current round by live Speed DESC
        const reconciledOrder = reconcileRemainingTurnOrder(
          battle.turnOrder,
          battle.activeTurnIndex,
          resolution.updatedUnits
        );
        const { nextIndex, wrappedRound } = findNextAliveTurnIndex(
          reconciledOrder,
          resolution.updatedUnits,
          battle.activeTurnIndex
        );

        let finalUnits = resolution.updatedUnits;
        let nextTurnOrder = reconciledOrder;
        let finalTurnIndex = nextIndex;
        const nextRound = wrappedRound ? battle.round + 1 : battle.round;
        let nextSnapshots = appendRoundSnapshot(
          battle.roundSnapshots,
          battle.round,
          resolution.updatedUnits
        );
        if (wrappedRound) {
          finalUnits = clearRevealedFlags(resolution.updatedUnits);
          nextTurnOrder = sortTurnOrder(finalUnits);
          const firstAliveIdx = nextTurnOrder.findIndex((id) =>
            finalUnits.some((u) => u.id === id && u.alive)
          );
          finalTurnIndex = Math.max(0, firstAliveIdx);
          nextSnapshots = appendRoundSnapshot(
            nextSnapshots,
            nextRound,
            finalUnits
          );
          const enrageLogs = buildEnrageActivationLogs(
            nextRound,
            get().adminConfig,
            nextLog
          );
          if (enrageLogs.length > 0) {
            nextLog = [...nextLog, ...enrageLogs];
          }
        }

        const nextSupplyByUnit = tickBattleSupplyForUnit(
          battle.supplyByUnit,
          activeUnit.id
        );

        set({
          battle: {
            ...battle,
            units: finalUnits,
            voice: nextVoice,
            supplyByUnit: nextSupplyByUnit,
            turnCounter: nextTurnCounter,
            log: nextLog,
            events: nextEvents,
            roundSnapshots: nextSnapshots,
            popups: nextPopups,
            fxEvents: nextFx,
            explodedUnitIds: nextExploded,
            turnOrder: nextTurnOrder,
            activeTurnIndex: finalTurnIndex,
            round: nextRound,
            selectedTargetId: currentTargetStillAlive
              ? battle.selectedTargetId
              : validFrontEnemies[0]?.id ?? aliveEnemies[0]?.id ?? null,
            selectedAllyTargetId: currentAllyStillAlive
              ? battle.selectedAllyTargetId
              : aliveAllies[0]?.id ?? null,
            lastPlayerTargetId: targetedEnemy,
            turnStep2Used: 0,
            turnLockedSkillIds: [],
            autoStopNotice: null,
            isResolving: false,
          },
        });
      },

      performAutoPlayerTurn: () => {
        let state = get();
        let { battle } = state;
        if (
          !battle ||
          battle.summary ||
          battle.isResolving ||
          battle.prestage?.active ||
          !state.autoBattleEnabled
        ) {
          return;
        }

        const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
        let activeUnit = battle.units.find((u) => u.id === activeUnitId);
        if (!activeUnit || !activeUnit.isPlayer || !activeUnit.alive) return;

        let deployedGear = state.pilot.gears[battle.deployedGearId];
        let tactics = deployedGear.tactics;

        // 0. Auto supplies (when enabled in Simple tactics, runs at start of player's auto turn)
        const autoSuppliesCfg = sanitizeAutoSuppliesConfig(
          tactics.simple?.autoSupplies
        );
        if (autoSuppliesCfg.enabled) {
          const usesPerTurn = sanitizeSupplyUsesPerTurn(
            state.adminConfig?.supplyUsesPerTurn
          );
          for (let i = 0; i < usesPerTurn; i++) {
            const curState = get();
            const curBattle = curState.battle;
            if (
              !curBattle ||
              curBattle.summary ||
              curBattle.isResolving ||
              curBattle.prestage?.active ||
              !curState.autoBattleEnabled
            ) {
              return;
            }
            const curUnit = curBattle.units.find((u) => u.id === activeUnitId);
            if (!curUnit || !curUnit.isPlayer || !curUnit.alive) return;
            const curGear = curState.pilot.gears[curBattle.deployedGearId];
            const maxSlots = sanitizeSupplyLoadoutSlots(
              curState.adminConfig?.supplyLoadoutSlots
            );
            const loadoutIds = sanitizeSupplyLoadout(
              curGear?.supplyLoadout,
              maxSlots
            );
            const loadoutTemplates = loadoutIds
              .map((id) => getSupplyTemplateById(id))
              .filter((t): t is NonNullable<typeof t> => Boolean(t));
            if (loadoutTemplates.length === 0) break;
            const stockByTemplate: Record<string, number> = {};
            for (const tpl of loadoutTemplates) {
              stockByTemplate[tpl.id] = getSupplyStockCount(
                curState.pilot.consumables,
                tpl.id
              );
            }
            const picks = pickAutoSupplies({
              unit: curUnit,
              loadoutTemplates,
              stockByTemplate,
              unitState: curBattle.supplyByUnit?.[curUnit.id],
              cfg: autoSuppliesCfg,
              adminCfg: curState.adminConfig,
              kind: curBattle.kind,
              units: curBattle.units,
            });
            if (picks.length === 0) break;
            curState.useBattleSupply(picks[0]);
          }

          state = get();
          battle = state.battle;
          if (
            !battle ||
            battle.summary ||
            battle.isResolving ||
            battle.prestage?.active ||
            !state.autoBattleEnabled
          ) {
            return;
          }
          const refreshedUnit = battle.units.find((u) => u.id === activeUnitId);
          if (!refreshedUnit || !refreshedUnit.isPlayer || !refreshedUnit.alive) {
            return;
          }
          activeUnit = refreshedUnit;
          deployedGear = state.pilot.gears[battle.deployedGearId];
          tactics = deployedGear.tactics;
        }

        // 1. Evaluate Safety Stops before executing Auto turn
        const safetyEval = evaluateAutoSafety(
          battle,
          activeUnit,
          tactics.safety,
          state.adminConfig
        );
        if (safetyEval.shouldRetreat) {
          set((prev) => ({
            autoBattleEnabled: false,
            autoRepeatSession: prev.autoRepeatSession?.active
              ? {
                  ...prev.autoRepeatSession,
                  stopReason: 'auto_retreat',
                }
              : prev.autoRepeatSession,
          }));
          get().retreatBattle();
          return;
        }
        if (safetyEval.shouldStopAuto && safetyEval.reason) {
          soundFx.playEvade();
          const safetyReason = safetyEval.reason;
          set((prev) => ({
            autoBattleEnabled: false,
            autoRepeatSession: prev.autoRepeatSession?.active
              ? {
                  ...prev.autoRepeatSession,
                  active: false,
                  stopReason: safetyReason,
                }
              : prev.autoRepeatSession,
            battle: prev.battle
              ? {
                  ...prev.battle,
                  autoStopNotice: safetyReason,
                  log: prev.autoRepeatSession?.active
                    ? [
                        ...prev.battle.log,
                        {
                          id: `log_repeat_stop_${Date.now()}_${prev.battle.turnCounter}`,
                          round: prev.battle.round,
                          actorName: 'SYSTEM',
                          tag: 'SYSTEM' as const,
                          templateKey: 'log.autoRepeatStopped' as const,
                          params: {
                            reason: safetyReason,
                            streak: clampDefeatStreakLimit(
                              prev.autoRepeatDefeatStreakLimit
                            ),
                          },
                        },
                      ]
                    : prev.battle.log,
                }
              : null,
          }));
          return;
        }

        // 2. Evaluate pure Tactics engine with multi-step support (step 2 buffs + step 3 main action)
        const skipVisualFx = state.skipAnimations;
        const muteSound = state.skipAnimations || state.battleSpeed >= 10;
        const resolution = resolveMultiStepTurn({
          units: battle.units,
          actorId: activeUnit.id,
          round: battle.round,
          adminConfig: state.adminConfig,
          rng: Math.random,
          initialTurnStep2Used: battle.turnStep2Used ?? 0,
          initialTurnLockedSkillIds: battle.turnLockedSkillIds ?? [],
          chooseNextDecision: (
            curUnits,
            curActor,
            lockedSkillIds,
            _stepIdx,
            step2UsedSoFar
          ) => {
            if (
              pickLidarCast(
                curUnits,
                curActor,
                {
                  role: 'player',
                  lidarAuto: tactics.simple?.lidarAuto,
                  adminConfig: state.adminConfig,
                  step2UsedSoFar,
                  turnLockedSkillIds: lockedSkillIds,
                },
                Math.random
              )
            ) {
              return {
                action: 'skill',
                targetId: null,
                skillId: LIDAR_SKILL_ID,
                matchedRuleIndex: null,
              };
            }
            const fluxAutoCfg = sanitizeFluxAutoConfig(tactics.simple?.fluxAuto);
            const autoFluxCount = pickFluxAutoCount(
              curUnits,
              curActor,
              {
                fluxAuto: fluxAutoCfg,
                adminConfig: state.adminConfig,
                step2UsedSoFar,
                turnLockedSkillIds: lockedSkillIds,
              },
              Math.random
            );
            if (autoFluxCount > 0) {
              return {
                action: 'skill',
                targetId: null,
                skillId: FLUX_SKILL_ID,
                transferCount: autoFluxCount,
                matchedRuleIndex: null,
              };
            }
            let choice = chooseAction(
              {
                ...battle,
                units: curUnits,
                turnLockedSkillIds: lockedSkillIds,
              },
              curActor,
              tactics,
              Math.random,
              state.adminConfig
            );
            let autoTransferCount: number | undefined;
            const chosenSkillDef =
              choice.action === 'skill' && choice.skillId
                ? getSkillById(choice.skillId, state.adminConfig)
                : undefined;
            if (chosenSkillDef?.effectKind === 'sp_transfer') {
              const fluxCfg = sanitizeFluxTransferConfig(
                state.adminConfig.fluxTransfer
              );
              const pressure = computeFluxBattlePressure(curUnits, curActor.side);
              const count = fluxAutoCfg.enabled
                ? pickFluxCount(
                    curUnits,
                    curActor.id,
                    {
                      ...fluxCfg,
                      spEconomy: state.adminConfig.spEconomy,
                      skillMaxLevel: getEffectiveSkillMaxLevel(state.adminConfig),
                    },
                    pressure,
                    Math.random
                  )
                : 0;
              if (count > 0) {
                autoTransferCount = count;
              } else {
                const validEnemies = getValidEnemyTargets(
                  curUnits,
                  curActor,
                  'attack'
                );
                const fallbackEnemy = [...validEnemies].sort(
                  (a, b) => a.hp - b.hp
                )[0];
                choice = fallbackEnemy
                  ? {
                      action: 'attack',
                      targetId: fallbackEnemy.id,
                      matchedRuleIndex: null,
                    }
                  : {
                      action: 'defend',
                      targetId: null,
                      matchedRuleIndex: null,
                    };
              }
            }
            return {
              action: choice.action,
              targetId: choice.targetId,
              skillId: choice.skillId,
              transferCount: autoTransferCount,
              matchedRuleIndex: choice.matchedRuleIndex,
            };
          },
        });
        playCue(resolution.soundCue, muteSound);

        const autoRuleNumber =
          resolution.lastMatchedRuleIndex !== null
            ? resolution.lastMatchedRuleIndex + 1
            : 0;
        const lastTargetId = resolution.lastDecision?.targetId ?? null;
        const targetedEnemy =
          lastTargetId &&
          battle.units.some((u) => u.id === lastTargetId && u.side === 'enemy')
            ? lastTargetId
            : battle.lastPlayerTargetId;

        const aliveEnemies = resolution.updatedUnits.filter(
          (u) => u.side === 'enemy' && u.alive
        );
        const aliveAllies = resolution.updatedUnits.filter(
          (u) => u.side === 'ally' && u.alive
        );

        const nextTurnCounter = battle.turnCounter + 1;
        const nextEvents = [
          ...battle.events,
          ...stampTurnEvents(resolution.events, nextTurnCounter),
        ].slice(-5000);
        const enrichedLogs = enrichLogEntries(
          resolution.logEntries,
          activeUnit,
          autoRuleNumber
        );
        let nextLog = [...battle.log, ...enrichedLogs];
        const voicedAfterAuto = applyActionVoiceHooks({
          state: {
            ...battle,
            units: resolution.updatedUnits,
            log: nextLog,
          },
          beforeUnits: battle.units,
          events: resolution.events,
          actorId: activeUnit.id,
          adminConfig: state.adminConfig,
        });
        nextLog = voicedAfterAuto.log;
        const nextVoice = voicedAfterAuto.voice;
        const nextPopups = skipVisualFx
          ? []
          : [...battle.popups, ...resolution.popups].slice(-18);
        const nextFx = skipVisualFx
          ? []
          : resolution.fxEvents.length > 0
          ? [...battle.fxEvents, ...resolution.fxEvents].slice(-12)
          : battle.fxEvents;
        const nextExploded = skipVisualFx
          ? []
          : resolution.destroyedUnitIds.length > 0
          ? [...battle.explodedUnitIds, ...resolution.destroyedUnitIds].slice(-8)
          : battle.explodedUnitIds;

        if (aliveEnemies.length === 0 || aliveAllies.length === 0) {
          const won = aliveEnemies.length === 0;
          set(
            finalizeBattleOutcome(
              state,
              { ...battle, voice: nextVoice },
              resolution.updatedUnits,
              won,
              false,
              nextLog,
              nextPopups,
              nextFx,
              nextExploded,
              nextEvents,
              nextTurnCounter
            )
          );
          return;
        }

        const reconciledOrder = reconcileRemainingTurnOrder(
          battle.turnOrder,
          battle.activeTurnIndex,
          resolution.updatedUnits
        );
        const { nextIndex, wrappedRound } = findNextAliveTurnIndex(
          reconciledOrder,
          resolution.updatedUnits,
          battle.activeTurnIndex
        );

        let finalUnits = resolution.updatedUnits;
        let nextTurnOrder = reconciledOrder;
        let finalTurnIndex = nextIndex;
        const nextRound = wrappedRound ? battle.round + 1 : battle.round;
        let nextSnapshots = appendRoundSnapshot(
          battle.roundSnapshots,
          battle.round,
          resolution.updatedUnits
        );
        if (wrappedRound) {
          finalUnits = clearRevealedFlags(resolution.updatedUnits);
          nextTurnOrder = sortTurnOrder(finalUnits);
          const firstAliveIdx = nextTurnOrder.findIndex((id) =>
            finalUnits.some((u) => u.id === id && u.alive)
          );
          finalTurnIndex = Math.max(0, firstAliveIdx);
          nextSnapshots = appendRoundSnapshot(
            nextSnapshots,
            nextRound,
            finalUnits
          );
          const enrageLogs = buildEnrageActivationLogs(
            nextRound,
            get().adminConfig,
            nextLog
          );
          if (enrageLogs.length > 0) {
            nextLog = [...nextLog, ...enrageLogs];
          }
        }

        const currentTargetStillAlive = aliveEnemies.some(
          (e) => e.id === (targetedEnemy ?? battle.selectedTargetId)
        );
        const currentAllyStillAlive = aliveAllies.some(
          (a) => a.id === battle.selectedAllyTargetId
        );

        const nextSupplyByUnit = tickBattleSupplyForUnit(
          battle.supplyByUnit,
          activeUnit.id
        );

        set({
          battle: {
            ...battle,
            units: finalUnits,
            voice: nextVoice,
            supplyByUnit: nextSupplyByUnit,
            turnCounter: nextTurnCounter,
            log: nextLog,
            events: nextEvents,
            roundSnapshots: nextSnapshots,
            popups: nextPopups,
            fxEvents: nextFx,
            explodedUnitIds: nextExploded,
            turnOrder: nextTurnOrder,
            activeTurnIndex: finalTurnIndex,
            round: nextRound,
            selectedTargetId: currentTargetStillAlive
              ? targetedEnemy ?? battle.selectedTargetId
              : aliveEnemies[0]?.id ?? null,
            selectedAllyTargetId: currentAllyStillAlive
              ? battle.selectedAllyTargetId
              : aliveAllies[0]?.id ?? null,
            lastPlayerTargetId: targetedEnemy,
            turnStep2Used: 0,
            turnLockedSkillIds: [],
            autoStopNotice: null,
            isResolving: false,
          },
        });
      },

      performAiTurn: () => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary || battle.prestage?.active) return;

        const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
        const activeUnit = battle.units.find((u) => u.id === activeUnitId);

        if (!activeUnit || !activeUnit.alive) {
          const { nextIndex, wrappedRound } = findNextAliveTurnIndex(
            battle.turnOrder,
            battle.units,
            battle.activeTurnIndex
          );
          let nextUnits = battle.units;
          let nextTurnOrder = battle.turnOrder;
          let finalTurnIndex = nextIndex;
          if (wrappedRound) {
            nextUnits = clearRevealedFlags(battle.units);
            nextTurnOrder = sortTurnOrder(nextUnits);
            finalTurnIndex = Math.max(
              0,
              nextTurnOrder.findIndex((id) =>
                nextUnits.some((u) => u.id === id && u.alive)
              )
            );
          }
          set({
            battle: {
              ...battle,
              units: nextUnits,
              turnOrder: nextTurnOrder,
              activeTurnIndex: finalTurnIndex,
              round: wrappedRound ? battle.round + 1 : battle.round,
              turnStep2Used: 0,
              turnLockedSkillIds: [],
            },
          });
          return;
        }

        // If player is mid-Charge Shot, auto-release their charged attack immediately!
        const playerIsCharging =
          activeUnit.isPlayer &&
          activeUnit.statuses.some((s) => s.type === 'charging');
        if (activeUnit.isPlayer && !playerIsCharging) return;

        const skipVisualFx = state.skipAnimations;
        const muteSound = state.skipAnimations || state.battleSpeed >= 10;

        let workingBattle = battle;
        let workingActor = activeUnit;
        let npcSupplyEvents: BattleEvent[] = [];
        const npcCfg = sanitizeNpcSupplyConfig(state.adminConfig?.npcSupply);
        if (
          !playerIsCharging &&
          !activeUnit.isPlayer &&
          !(activeUnit.isStructure && !activeUnit.isBoss) &&
          workingBattle.npcSupply &&
          npcCfg.enabled
        ) {
          const supplyStep = runNpcSupplyStep({
            battle: workingBattle,
            unitId: activeUnit.id,
            npcCfg,
            adminConfig: state.adminConfig,
            templates: SUPPLY_TEMPLATES,
            rng: Math.random,
          });
          const usedSupplyInStep =
            supplyStep.battle.log.length > workingBattle.log.length;
          workingBattle = supplyStep.battle;
          npcSupplyEvents = supplyStep.events;
          workingActor =
            workingBattle.units.find((u) => u.id === activeUnit.id) ??
            activeUnit;
          if (usedSupplyInStep) {
            workingBattle = emitVoice(workingBattle, 'supplyUse', workingActor);
          }
        }

        const resolution = resolveMultiStepTurn({
          units: workingBattle.units,
          actorId: workingActor.id,
          round: workingBattle.round,
          adminConfig: state.adminConfig,
          rng: Math.random,
          initialTurnStep2Used: workingBattle.turnStep2Used ?? 0,
          initialTurnLockedSkillIds: workingBattle.turnLockedSkillIds ?? [],
          chooseNextDecision: (
            curUnits,
            curActor,
            lockedSkillIds,
            _stepIdx,
            step2UsedSoFar
          ) =>
            playerIsCharging
              ? {
                  action: 'attack',
                  targetId: workingBattle.selectedTargetId,
                }
              : chooseAiDecision(
                  curActor,
                  curUnits,
                  Math.random,
                  state.adminConfig,
                  lockedSkillIds,
                  step2UsedSoFar
                ),
        });
        playCue(resolution.soundCue, muteSound);

        const aliveEnemies = resolution.updatedUnits.filter(
          (u) => u.side === 'enemy' && u.alive
        );
        const aliveAllies = resolution.updatedUnits.filter(
          (u) => u.side === 'ally' && u.alive
        );

        const nextTurnCounter = workingBattle.turnCounter + 1;
        const nextEvents = [
          ...workingBattle.events,
          ...stampTurnEvents(npcSupplyEvents, nextTurnCounter),
          ...stampTurnEvents(resolution.events, nextTurnCounter),
        ].slice(-5000);
        const enrichedLogs = enrichLogEntries(
          resolution.logEntries,
          workingActor
        );
        let nextLog = [...workingBattle.log, ...enrichedLogs];
        const voicedAfterAi = applyActionVoiceHooks({
          state: {
            ...workingBattle,
            units: resolution.updatedUnits,
            log: nextLog,
          },
          beforeUnits: workingBattle.units,
          events: resolution.events,
          actorId: workingActor.id,
          adminConfig: state.adminConfig,
        });
        nextLog = voicedAfterAi.log;
        const nextVoice = voicedAfterAi.voice;
        const nextPopups = skipVisualFx
          ? []
          : [...workingBattle.popups, ...resolution.popups].slice(-18);
        const nextFx = skipVisualFx
          ? []
          : resolution.fxEvents.length > 0
          ? [...workingBattle.fxEvents, ...resolution.fxEvents].slice(-12)
          : workingBattle.fxEvents;
        const nextExploded = skipVisualFx
          ? []
          : resolution.destroyedUnitIds.length > 0
          ? [...workingBattle.explodedUnitIds, ...resolution.destroyedUnitIds].slice(-8)
          : workingBattle.explodedUnitIds;

        if (aliveEnemies.length === 0 || aliveAllies.length === 0) {
          const won = aliveEnemies.length === 0;
          set(
            finalizeBattleOutcome(
              state,
              { ...workingBattle, voice: nextVoice },
              resolution.updatedUnits,
              won,
              false,
              nextLog,
              nextPopups,
              nextFx,
              nextExploded,
              nextEvents,
              nextTurnCounter
            )
          );
          return;
        }

        // Reconcile upcoming units in current round by live Speed DESC
        const reconciledOrder = reconcileRemainingTurnOrder(
          workingBattle.turnOrder,
          workingBattle.activeTurnIndex,
          resolution.updatedUnits
        );
        const { nextIndex, wrappedRound } = findNextAliveTurnIndex(
          reconciledOrder,
          resolution.updatedUnits,
          workingBattle.activeTurnIndex
        );

        let finalUnits = resolution.updatedUnits;
        let nextTurnOrder = reconciledOrder;
        let finalTurnIndex = nextIndex;
        const nextRound = wrappedRound
          ? workingBattle.round + 1
          : workingBattle.round;
        let nextSnapshots = appendRoundSnapshot(
          workingBattle.roundSnapshots,
          workingBattle.round,
          resolution.updatedUnits
        );
        if (wrappedRound) {
          finalUnits = clearRevealedFlags(resolution.updatedUnits);
          nextTurnOrder = sortTurnOrder(finalUnits);
          const firstAliveIdx = nextTurnOrder.findIndex((id) =>
            finalUnits.some((u) => u.id === id && u.alive)
          );
          finalTurnIndex = Math.max(0, firstAliveIdx);
          nextSnapshots = appendRoundSnapshot(
            nextSnapshots,
            nextRound,
            finalUnits
          );
          const enrageLogs = buildEnrageActivationLogs(
            nextRound,
            get().adminConfig,
            nextLog
          );
          if (enrageLogs.length > 0) {
            nextLog = [...nextLog, ...enrageLogs];
          }
        }

        // Occasional AI wingman radio callout (~28% chance when animations are enabled)
        let nextWingmanChat = workingBattle.wingmanChat ?? null;
        if (
          !skipVisualFx &&
          workingActor.side === 'ally' &&
          !workingActor.isPlayer &&
          Math.random() < 0.28
        ) {
          const textKey =
            WINGMAN_CHAT_KEYS[
              Math.floor(Math.random() * WINGMAN_CHAT_KEYS.length)
            ];
          nextWingmanChat = {
            id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            unitId: workingActor.id,
            unitName: workingActor.name,
            textKey,
          };
        }

        const playerNext = finalUnits.find((u) => u.isPlayer);
        const validFrontEnemies = playerNext
          ? getValidEnemyTargets(finalUnits, playerNext, 'attack')
          : aliveEnemies;
        const currentTargetStillAlive = aliveEnemies.some(
          (e) => e.id === workingBattle.selectedTargetId
        );
        const currentAllyStillAlive = aliveAllies.some(
          (a) => a.id === workingBattle.selectedAllyTargetId
        );

        set({
          battle: {
            ...workingBattle,
            units: finalUnits,
            voice: nextVoice,
            supplyByUnit: workingBattle.supplyByUnit,
            npcSupply: workingBattle.npcSupply,
            turnCounter: nextTurnCounter,
            log: nextLog,
            events: nextEvents,
            roundSnapshots: nextSnapshots,
            popups: nextPopups,
            fxEvents: nextFx,
            explodedUnitIds: nextExploded,
            wingmanChat: nextWingmanChat,
            turnOrder: nextTurnOrder,
            activeTurnIndex: finalTurnIndex,
            round: nextRound,
            selectedTargetId: currentTargetStillAlive
              ? workingBattle.selectedTargetId
              : validFrontEnemies[0]?.id ?? aliveEnemies[0]?.id ?? null,
            selectedAllyTargetId: currentAllyStillAlive
              ? workingBattle.selectedAllyTargetId
              : aliveAllies[0]?.id ?? null,
            turnStep2Used: 0,
            turnLockedSkillIds: [],
          },
        });
      },

      retreatBattle: () => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary) return;
        const retreatLog = [
          ...battle.log,
          {
            id: `log_retreat_${Date.now()}`,
            round: battle.round,
            actorName: state.pilot.name || 'Vance',
            tag: 'SYSTEM' as const,
            templateKey: 'log.retreat' as const,
            params: { actor: state.pilot.name || 'Vance' },
          },
        ];
        set(
          finalizeBattleOutcome(
            state,
            battle,
            battle.units,
            false,
            true,
            retreatLog,
            [],
            [],
            []
          )
        );
      },

      forceWinBattle: () => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary) return;
        const defeatedEnemies = battle.units.map((u) =>
          u.side === 'enemy'
            ? {
                ...u,
                hp: 0,
                shield: 0,
                alive: false,
                animState: 'destroyed' as const,
              }
            : u
        );
        set(
          finalizeBattleOutcome(
            state,
            battle,
            defeatedEnemies,
            true,
            false,
            battle.log,
            [],
            [],
            []
          )
        );
      },

      clearExpiredPopups: (ids) => {
        const { battle } = get();
        if (!battle || ids.length === 0) return;
        const idSet = new Set(ids);
        set({
          battle: {
            ...battle,
            popups: battle.popups.filter((p) => !idSet.has(p.id)),
          },
        });
      },

      clearExpiredFx: (ids) => {
        const { battle } = get();
        if (!battle || ids.length === 0) return;
        const idSet = new Set(ids);
        set({
          battle: {
            ...battle,
            fxEvents: battle.fxEvents.filter((f) => !idSet.has(f.id)),
          },
        });
      },

      clearExplodedUnits: (ids) => {
        const { battle } = get();
        if (!battle || ids.length === 0) return;
        const idSet = new Set(ids);
        set({
          battle: {
            ...battle,
            explodedUnitIds: battle.explodedUnitIds.filter(
              (uid) => !idSet.has(uid)
            ),
          },
        });
      },

      clearWingmanChat: () => {
        const { battle } = get();
        if (!battle || !battle.wingmanChat) return;
        set({
          battle: {
            ...battle,
            wingmanChat: null,
          },
        });
      },

      returnToHangar: () => {
        soundFx.playClick();
        set({
          battle: null,
          screen: 'HANGAR',
          autoRepeatSession: null,
          autoRepeatToast: null,
        });
      },

      toggleMute: () => {
        const nextMuted = !get().muted;
        soundFx.setMuted(nextMuted);
        if (!nextMuted) soundFx.playClick();
        set({ muted: nextMuted });
      },

      setBattleSpeed: (battleSpeed) => {
        if (!isValidBattleSpeed(battleSpeed)) return;
        soundFx.playClick();
        writeDeviceBattleSpeed(battleSpeed);
        set({ battleSpeed });
      },

      toggleSkipAnimations: () => {
        soundFx.playClick();
        set((state) => ({ skipAnimations: !state.skipAnimations }));
      },

      setBattleViewMode: (battleViewMode) => {
        soundFx.playClick();
        set({ battleViewMode });
      },

      // ---- ADMIN CP ACTIONS ----
      unlockAdminMode: (openPanel = false) => {
        if (!ENABLE_ADMIN_CP) return;
        writePersistedAdminUnlock(true);
        set((state) => ({
          adminUnlocked: true,
          adminPanelOpen: openPanel ? true : state.adminPanelOpen,
        }));
      },

      setAdminPanelOpen: (adminPanelOpen) => {
        if (adminPanelOpen && !ENABLE_ADMIN_CP) return;
        set({ adminPanelOpen });
      },

      toggleAdminPanel: () => {
        if (!ENABLE_ADMIN_CP) return;
        writePersistedAdminUnlock(true);
        set((state) => ({
          adminUnlocked: true,
          adminPanelOpen: !state.adminPanelOpen,
        }));
      },

      adminSetGearLevel: (level, gearId) => {
        const state = get();
        const clamped = Math.max(
          1,
          Math.min(getMaxLevel(), Math.floor(level) || 1)
        );
        const id = gearId ?? state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        if (!gear) return;
        const totalForLevel = getTotalAvailablePointsForLevel(clamped);
        const spent = Object.values(gear.allocatedPoints).reduce(
          (a, b) => a + b,
          0
        );
        const unspent = Math.max(0, totalForLevel - spent);
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [id]: {
                ...gear,
                level: clamped,
                exp: 0,
                unspentPoints: unspent,
              },
            },
          },
          hasSaveData: true,
        });
      },

      adminAddGearExp: (amount, gearId) => {
        const state = get();
        const id = gearId ?? state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        if (!gear) return;
        const res = applyExpToGear(gear, Math.max(0, Math.floor(amount) || 0));
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [id]: res.updatedGear,
            },
          },
          hasSaveData: true,
        });
      },

      adminSetGearUnspentPoints: (points, gearId) => {
        const state = get();
        const id = gearId ?? state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        if (!gear) return;
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [id]: {
                ...gear,
                unspentPoints: Math.max(0, Math.floor(points) || 0),
              },
            },
          },
          hasSaveData: true,
        });
      },

      adminAddGearUnspentPoints: (delta, gearId) => {
        const state = get();
        const id = gearId ?? state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        if (!gear) return;
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [id]: {
                ...gear,
                unspentPoints: Math.max(
                  0,
                  gear.unspentPoints + (Math.floor(delta) || 0)
                ),
              },
            },
          },
          hasSaveData: true,
        });
      },

      adminResetGearAllocation: (gearId) => {
        const state = get();
        const id = gearId ?? state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        if (!gear) return;
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [id]: {
                ...gear,
                allocatedPoints: { ...EMPTY_STAT_BLOCK },
                unspentPoints: getTotalAvailablePointsForLevel(gear.level),
              },
            },
          },
          hasSaveData: true,
        });
      },

      adminSetCredits: (amount) => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            credits: Math.max(0, Math.floor(amount) || 0),
          },
          hasSaveData: true,
        }));
      },

      adminAddCredits: (delta) => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            credits: Math.max(
              0,
              state.pilot.credits + (Math.floor(delta) || 0)
            ),
          },
          hasSaveData: true,
        }));
      },

      adminSetWarPoints: (amount) => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            warPoints: Math.max(0, Math.floor(amount) || 0),
          },
          hasSaveData: true,
        }));
      },

      adminAddWarPoints: (delta) => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            warPoints: Math.max(
              0,
              state.pilot.warPoints + (Math.floor(delta) || 0)
            ),
          },
          hasSaveData: true,
        }));
      },

      adminGenerateItems: (slot, tier, rarity, quantity, options) => {
        if (slot === 'module') return 0;
        const count = Math.max(1, Math.min(200, Math.floor(quantity) || 1));
        const generated: ItemInstance[] = [];
        const now = Date.now();
        for (let i = 0; i < count; i++) {
          generated.push(
            generateItemInstance({
              slot,
              tier: Math.max(1, Math.min(4, tier)),
              rarity,
              requiredLevel: options?.requiredLevel,
              rollQuality: options?.rollQuality,
              isNew: true,
              obtainedAt: now + i,
            })
          );
        }
        set((state) => ({
          pilot: {
            ...state.pilot,
            inventory: [...generated, ...state.pilot.inventory],
          },
          hasSaveData: true,
        }));
        return generated.length;
      },

      adminDeleteItems: (mode, filter) => {
        const state = get();
        let removed = 0;
        const remaining = state.pilot.inventory.filter((it) => {
          // Never delete equipped or locked items
          if (getItemEquippedByGear(state.pilot.gears, it.instanceId) !== null) {
            return true;
          }
          if (it.locked) return true;
          if (mode === 'all_unequipped') {
            removed += 1;
            return false;
          }
          const matchesRarity =
            filter?.maxRarity == null ||
            RARITY_RANK[it.rarity] <= RARITY_RANK[filter.maxRarity];
          const matchesTier =
            filter?.maxTier == null || it.tier <= filter.maxTier;
          if (matchesRarity && matchesTier) {
            removed += 1;
            return false;
          }
          return true;
        });

        set({
          pilot: {
            ...state.pilot,
            inventory: remaining,
          },
          hasSaveData: true,
        });
        return removed;
      },

      adminFillInventory: (count) => {
        const state = get();
        const safeCount = Math.max(1, Math.min(250, Math.floor(count) || 100));
        const rarities: ItemRarity[] = [
          'common',
          'uncommon',
          'rare',
          'epic',
          'legendary',
        ];
        const activeGear = state.pilot.gears[state.pilot.activeGearId];
        const generated: ItemInstance[] = [];
        const now = Date.now();
        for (let i = 0; i < safeCount; i++) {
          const slot = EQUIPMENT_SLOTS[i % EQUIPMENT_SLOTS.length];
          const tier = ((i % 4) + 1) as 1 | 2 | 3 | 4;
          const rarity = rarities[i % rarities.length];
          generated.push(
            generateItemInstance({
              slot,
              tier,
              rarity,
              requiredLevel: Math.max(
                1,
                Math.min(getMaxLevel(), activeGear.level + (i % 5) - 2)
              ),
              isNew: i < 12,
              obtainedAt: now + i,
            })
          );
        }
        set({
          pilot: {
            ...state.pilot,
            inventory: [...generated, ...state.pilot.inventory],
          },
          hasSaveData: true,
        });
        return generated.length;
      },

      adminRestockShopNow: () => {
        const state = get();
        const activeGear = state.pilot.gears[state.pilot.activeGearId];
        const maxLevel = getMaxGearLevel(state.pilot);
        const nextSupplyStock = generateSupplyShopStock(
          maxLevel,
          state.adminConfig,
          SUPPLY_TEMPLATES
        );
        const nextSupplyStockWp = generateSupplyShopStockWp(
          maxLevel,
          state.adminConfig,
          nextSupplyStock.length,
          SUPPLY_TEMPLATES
        );
        const nextVoucherStockWp = rollVoucherShopStockWp(state.adminConfig);
        const nextCrateWpStock = rollCrateShopStockWp(state.adminConfig);
        const nextCrateCreditStock = rollCrateShopStockCredit(state.adminConfig);
        set({
          shopStock: generateCategorizedShopStock(
            activeGear.level,
            buildShopOptionsFromState(state.pilot, state.adminConfig)
          ),
          supplyShopStock: nextSupplyStock,
          supplyShopStockWp: nextSupplyStockWp,
          voucherShopStockWp: nextVoucherStockWp,
          crateShopStockWp: nextCrateWpStock,
          crateShopStockCredit: nextCrateCreditStock,
          blackMarketOffer: rollBlackMarketMedalOffer(state.adminConfig),
          supplyShopRefresh: { used: 0 },
          wpMarketOffers: generateWpMarketOffers({
            shipyardBonus: hasOperationalShipyard(state.pilot),
            adminConfig: state.adminConfig,
          }),
          battlesUntilRestock: SHOP_STOCK_CONFIG.restockEveryNBattles,
          hasSaveData: true,
        });
      },

      adminForceAddShopItem: ({ templateId, slot, tier, rarity }) => {
        const state = get();
        const item = generateItemInstance({
          templateId,
          slot,
          tier: Math.max(1, Math.min(4, tier)),
          rarity,
        });
        const listing: ShopItemListing = {
          ...item,
          price: Math.max(
            40,
            Math.round(item.price * (state.adminConfig.shopPriceMultiplier || 1))
          ),
          soldOut: false,
        };
        set({
          shopStock: [listing, ...state.shopStock],
          hasSaveData: true,
        });
      },

      adminUnlockAllSkillsForGear: (gearId, maxLevel = true) => {
        const state = get();
        const id = gearId ?? state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        if (!gear) return;
        const allowed = getSkillsForClass(id, state.adminConfig);
        const nextLevels: Record<string, number> = { ...gear.skillLevels };
        const effectiveCap = getEffectiveSkillMaxLevel(state.adminConfig);
        const targetLv = maxLevel ? effectiveCap : 1;
        for (const sk of allowed) {
          nextLevels[sk.id] = Math.max(nextLevels[sk.id] ?? 0, targetLv);
        }
        const activeBar = [...gear.equippedSkillBar];
        for (const sk of allowed) {
          if (sk.category !== 'passive' && !activeBar.includes(sk.id) && activeBar.length < 6) {
            activeBar.push(sk.id);
          }
        }
        const passiveSlotCap = getUnlockedPassiveSlots(
          gear.level,
          state.adminConfig.passiveSlots
        );
        const nextPassives = Array.isArray(gear.equippedPassives)
          ? [...gear.equippedPassives]
          : [];
        for (const sk of allowed) {
          if (
            sk.category === 'passive' &&
            !nextPassives.includes(sk.id) &&
            nextPassives.length < passiveSlotCap
          ) {
            nextPassives.push(sk.id);
          }
        }
        set({
          pilot: {
            ...state.pilot,
            gears: {
              ...state.pilot.gears,
              [id]: {
                ...gear,
                skillLevels: nextLevels,
                equippedSkillBar: activeBar,
                equippedPassives: nextPassives,
              },
            },
          },
          hasSaveData: true,
        });
      },

      adminGrantAllOpeningCards: () => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            ownedOpeningCards: getOpeningCardsList(state.adminConfig).map(
              (c) => c.id
            ),
          },
          hasSaveData: true,
        }));
      },

      adminResetBattleCooldowns: () => {
        const { battle } = get();
        if (!battle || battle.summary) return;
        set({
          battle: {
            ...battle,
            units: battle.units.map((u) =>
              u.isPlayer
                ? {
                    ...u,
                    skillCooldowns: {},
                    usedOnceSkills: [],
                    sp: u.derived.maxSp,
                  }
                : u
            ),
          },
        });
      },

      adminSkipBattleToRound: (targetRound) => {
        const { battle } = get();
        if (!battle || battle.summary) return;
        const safeRound = Math.max(1, Math.min(999, Math.floor(targetRound) || 1));
        set({
          battle: {
            ...battle,
            round: safeRound,
          },
        });
      },

      adminSetCampaignMonth: (month) => {
        const safeMonth = Math.max(1, Math.min(999, Math.floor(month) || 1));
        set((state) => ({
          pilot: {
            ...state.pilot,
            campaignMonth: safeMonth,
          },
          hasSaveData: true,
        }));
      },

      adminSetBaseFaction: (sectorId, faction) => {
        const state = get();
        const existing = state.pilot.baseStates[sectorId];
        if (!existing) return;
        const nextCaptured =
          faction === 'allied'
            ? Array.from(new Set([...state.pilot.capturedSectorIds, sectorId]))
            : state.pilot.capturedSectorIds.filter((id) => id !== sectorId);
        const nextUnlocked =
          faction === 'allied'
            ? Array.from(new Set([...state.pilot.unlockedSectorIds, sectorId]))
            : state.pilot.unlockedSectorIds;
        set({
          pilot: {
            ...state.pilot,
            capturedSectorIds: nextCaptured,
            unlockedSectorIds: nextUnlocked,
            baseStates: {
              ...state.pilot.baseStates,
              [sectorId]: {
                ...existing,
                faction,
                status: 'operational',
                repairMonthsRemaining: 0,
                underAttack: false,
                attackCountdownMonths: 0,
                attackFromSectorId: null,
              },
            },
          },
          hasSaveData: true,
        });
      },

      adminTriggerEnemyAttack: (sectorId) => {
        const state = get();
        const existing = state.pilot.baseStates[sectorId];
        if (!existing) return;
        const mapNodes = getMapNodes();
        const hostileSource =
          mapNodes.find(
            (s) => state.pilot.baseStates[s.id]?.faction === 'hostile'
          )?.id ??
          mapNodes[mapNodes.length - 1]?.id ??
          getDefaultSelectedNodeId();
        set({
          pilot: {
            ...state.pilot,
            baseStates: {
              ...state.pilot.baseStates,
              [sectorId]: {
                ...existing,
                faction: 'allied',
                underAttack: true,
                attackCountdownMonths: 2,
                attackFromSectorId: hostileSource,
              },
            },
          },
          hasSaveData: true,
        });
      },

      adminSpawnPirateIncident: () => {
        const state = get();
        const cfg = sanitizePiratesConfig(state.adminConfig.pirates);
        if (!cfg.enabled) return false;
        const month = Math.max(1, Math.floor(state.pilot.campaignMonth || 1));
        const active = sanitizePirateIncidents(
          state.pilot.pirateIncidents,
          month,
          cfg
        );
        if (active.length >= cfg.maxActive) return false;
        const spawned = rollIncident(
          { ...state.pilot, pirateIncidents: active },
          cfg
        );
        if (!spawned) return false;
        set({
          pilot: {
            ...state.pilot,
            pirateIncidents: [...active, spawned],
          },
          hasSaveData: true,
        });
        return true;
      },

      adminClearPirateIncidents: () => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            pirateIncidents: [],
          },
          hasSaveData: true,
        }));
      },

      adminRemovePirateIncident: (incidentId) => {
        set((state) => ({
          pilot: clearPirateIncidentById(state.pilot, incidentId),
          hasSaveData: true,
        }));
      },

      adminRefillAllSectorSupply: () => {
        set((state) => {
          const { sectorSupply: _dropped, ...pilotRest } = state.pilot;
          return {
            pilot: pilotRest,
            hasSaveData: true,
          };
        });
      },

      adminResetAllBaseSiege: () => {
        set((state) => ({
          pilot: resetAllBaseSiegePools(state.pilot, state.adminConfig.baseSiege),
          hasSaveData: true,
        }));
      },

      adminUnlockAllGears: () => {
        set((state) => {
          const nextGears = { ...state.pilot.gears };
          const newlyUnlocked: MechClassId[] = [];
          for (const cls of MECH_CLASS_LIST) {
            if (!nextGears[cls.id].owned) {
              newlyUnlocked.push(cls.id);
            }
            nextGears[cls.id] = { ...nextGears[cls.id], owned: true };
          }
          let nextPilot: PilotAccount = {
            ...state.pilot,
            gears: nextGears,
          };
          for (const clsId of newlyUnlocked) {
            nextPilot = grantStarterSetToGear(
              nextPilot,
              clsId,
              state.adminConfig.starterSet
            ).pilot;
            nextPilot = grantStarterEventPack(
              nextPilot,
              state.adminConfig.starterEvent,
              clsId,
              { voucherCfgOrAdmin: state.adminConfig }
            ).pilot;
          }
          return {
            pilot: nextPilot,
            hasSaveData: true,
          };
        });
      },

      adminGrantStarterEventNow: () => {
        let grantedCount = 0;
        set((state) => {
          const res = grantStarterEventPack(
            state.pilot,
            state.adminConfig.starterEvent,
            state.pilot.activeGearId,
            { force: true, voucherCfgOrAdmin: state.adminConfig }
          );
          grantedCount = res.granted.length;
          if (res.granted.length === 0) return {};
          soundFx.playConfirm();
          return {
            pilot: res.pilot,
            hasSaveData: true,
          };
        });
        return grantedCount;
      },

      adminResetStarterEventGranted: () => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            starterEventGranted: [],
          },
          hasSaveData: true,
        }));
      },

      adminUnlockAllSectors: () => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            unlockedSectorIds: getMapNodes().map((s) => s.id),
          },
          hasSaveData: true,
        }));
      },

      adminApplyStarterToEmptySlots: () => {
        let filledCount = 0;
        set((state) => {
          const starterCfg = sanitizeStarterSetConfig(state.adminConfig.starterSet);
          if (!starterCfg.enabled) {
            return {};
          }
          const res = fillEmptyStarterSlotsForPilot(state.pilot, starterCfg);
          filledCount = res.filledCount;
          if (res.filledCount === 0) return {};
          return {
            pilot: res.pilot,
            hasSaveData: true,
          };
        });
        return filledCount;
      },

      applyMapPack: (pack) => {
        const state = get();
        if (isBattleActive(state)) {
          return {
            ok: false,
            reason: 'in_battle',
            nodes: getMapNodes().length,
            lanes: MAP_LANES.length,
          };
        }
        if (state.autoRepeatSession?.active) {
          return {
            ok: false,
            reason: 'auto_repeat_active',
            nodes: getMapNodes().length,
            lanes: MAP_LANES.length,
          };
        }

        let validated: MapPackDefinition | null = null;
        if (pack !== null) {
          validated = validateMapPack(pack);
          if (!validated) {
            return {
              ok: false,
              reason: 'invalid_pack',
              nodes: getMapNodes().length,
              lanes: MAP_LANES.length,
            };
          }
        }

        const nextActiveMap = setActiveMapPack(validated);
        const nextBaseStates = createInitialBaseStates();
        const nextUnlocked = visibleNodeIds({
          baseStates: nextBaseStates,
          unlockedSectorIds: [],
        });

        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            baseStates: nextBaseStates,
            unlockedSectorIds: nextUnlocked,
            capturedSectorIds: [],
            activeBonusMission: null,
            hiredWingman: null,
            pirateIncidents: [],
            sectorSupply: undefined,
            campaignMonth: 1,
            worldClock: resetWorldClock(),
          },
          selectedSectorId: nextActiveMap.defaultSelectedNodeId,
          adminConfig: {
            ...state.adminConfig,
            mapPack: validated,
          },
          hasSaveData: true,
        });

        return {
          ok: true,
          nodes: nextActiveMap.nodes.length,
          lanes: nextActiveMap.lanes.length,
        };
      },

      applyWorldAndResetProgress: (pack) => {
        const state = get();
        if (isBattleActive(state)) {
          return {
            ok: false,
            reason: 'in_battle',
            nodes: getMapNodes().length,
            lanes: MAP_LANES.length,
          };
        }
        if (state.autoRepeatSession?.active) {
          return {
            ok: false,
            reason: 'auto_repeat_active',
            nodes: getMapNodes().length,
            lanes: MAP_LANES.length,
          };
        }

        let validated: MapPackDefinition | null = null;
        if (pack !== null) {
          validated = validateMapPack(pack);
          if (!validated) {
            return {
              ok: false,
              reason: 'invalid_pack',
              nodes: getMapNodes().length,
              lanes: MAP_LANES.length,
            };
          }
        }

        const nextActiveMap = setActiveMapPack(validated);
        const pilotName = state.pilot.name?.trim() || 'Vance';
        const starterClassId = state.pilot.activeGearId ?? 'striker';
        const fresh = createFreshCampaignState(
          pilotName,
          starterClassId,
          Math.random,
          state.adminConfig?.starterSet,
          state.adminConfig?.starterEvent,
          state.adminConfig?.vouchers,
          state.adminConfig?.crateShop
        );
        const nextAdminConfig: AdminConfig = {
          ...state.adminConfig,
          mapPack: validated,
        };
        setRuntimeMaxLevel(nextAdminConfig.maxLevel);

        soundFx.playConfirm();
        set({
          pilot: fresh.pilot,
          shopStock: fresh.shopStock,
          supplyShopStock: fresh.supplyShopStock ?? [],
          supplyShopStockWp: fresh.supplyShopStockWp ?? [],
          voucherShopStockWp: fresh.voucherShopStockWp ?? [],
          crateShopStockWp: fresh.crateShopStockWp ?? [],
          crateShopStockCredit: fresh.crateShopStockCredit ?? [],
          blackMarketOffer: rollBlackMarketMedalOffer(nextAdminConfig),
          supplyShopRefresh: fresh.supplyShopRefresh ?? { used: 0 },
          wpMarketOffers: fresh.wpMarketOffers,
          battlesUntilRestock: fresh.battlesUntilRestock,
          inventoryFilterState: fresh.inventoryFilterState,
          quickSellConfig: fresh.quickSellConfig,
          selectedSectorId: nextActiveMap.defaultSelectedNodeId,
          adminConfig: nextAdminConfig,
          language: state.language,
          muted: state.muted,
          battleSpeed: state.battleSpeed,
          skipAnimations: state.skipAnimations,
          battleViewMode: state.battleViewMode,
          autoRepeatDefeatRule: state.autoRepeatDefeatRule,
          autoRepeatDefeatStreakLimit: state.autoRepeatDefeatStreakLimit,
          autoRepeatStopOnDefeat: state.autoRepeatStopOnDefeat,
          hasSaveData: true,
          battle: null,
          screen: state.screen === 'TITLE' ? 'HANGAR' : state.screen,
          activeTab: 'map',
          shopSubTab: 'buy',
          autoRepeatSession: null,
          autoRepeatToast: null,
          battleLaunchToast: null,
          quickSellUndo: null,
          autoEquipUndo: null,
        });

        return {
          ok: true,
          nodes: nextActiveMap.nodes.length,
          lanes: nextActiveMap.lanes.length,
        };
      },

      adminGiveSupply: (target, qty) => {
        const safeQty = Math.max(
          1,
          Math.min(SUPPLY_STACK_CAP, Math.round(Number.isFinite(qty) ? qty : 1))
        );
        const state = get();
        if (target === 'supply_crate') {
          const res = addSupplyCrateToConsumables(
            state.pilot.consumables ?? [],
            safeQty
          );
          soundFx.playConfirm();
          set({
            pilot: {
              ...state.pilot,
              consumables: res.consumables,
            },
            hasSaveData: true,
          });
          return {
            ok: true,
            kind: 'supply_crate',
            added: res.added,
            lost: res.lost,
          };
        }

        let resolvedTemplateId: string | null = null;
        if (target === 'random_supply') {
          const cfg = sanitizeSupplyRewardsConfig(
            state.adminConfig.supplyRewards
          );
          const maxGearLevel = getPilotMaxGearLevel(state.pilot);
          const rolled =
            rollSupplyReward(
              maxGearLevel,
              {
                minTier: cfg.minTier,
                maxTier: cfg.maxTier,
                qtyMin: safeQty,
                qtyMax: safeQty,
              },
              Math.random
            ) ??
            rollSupplyReward(
              maxGearLevel,
              {
                minTier: 1,
                maxTier: 5,
                qtyMin: safeQty,
                qtyMax: safeQty,
              },
              Math.random
            );
          resolvedTemplateId = rolled?.templateId ?? null;
        } else if (getSupplyTemplateById(target)) {
          resolvedTemplateId = target;
        }

        if (!resolvedTemplateId) {
          return {
            ok: false,
            kind: 'battle_supply',
            added: 0,
            lost: 0,
          };
        }

        const res = addSupplyWithOverflow(
          state.pilot.consumables ?? [],
          resolvedTemplateId,
          safeQty
        );
        soundFx.playConfirm();
        set({
          pilot: {
            ...state.pilot,
            consumables: res.consumables,
          },
          hasSaveData: true,
        });
        return {
          ok: true,
          kind: 'battle_supply',
          templateId: resolvedTemplateId,
          added: res.added,
          lost: res.lost,
        };
      },

      adminGiveBuffCard: (cardId, qty) => {
        const parsed = parseBuffCardId(cardId);
        const amount = Math.max(
          1,
          Math.min(999, Math.floor(Number(qty) || 1))
        );
        if (!parsed) return { ok: false };
        const normalizedId = getBuffCardId(parsed.kind, parsed.tier);
        set((state) => ({
          pilot: grantBuffCardToPilot(state.pilot, normalizedId, amount),
          hasSaveData: true,
        }));
        soundFx.playConfirm();
        return { ok: true, cardId: normalizedId, qty: amount };
      },

      adminUpdateConfig: (patch) => {
        set((state) => {
          const nextFormation = patch.formation
            ? sanitizeFormationConfig(patch.formation)
            : state.adminConfig.formation;
          const nextAutoEquip = patch.autoEquip
            ? sanitizeAutoEquipConfig(patch.autoEquip)
            : sanitizeAutoEquipConfig(state.adminConfig.autoEquip);
          const nextStarterSet = patch.starterSet
            ? sanitizeStarterSetConfig(patch.starterSet)
            : sanitizeStarterSetConfig(state.adminConfig.starterSet);
          const nextStatusDefaults =
            patch.statusDisplayDefaults !== undefined
              ? sanitizeStatusDisplayDefaults(patch.statusDisplayDefaults)
              : sanitizeStatusDisplayDefaults(
                  state.adminConfig.statusDisplayDefaults
                );
          const nextPirates =
            patch.pirates !== undefined
              ? sanitizePiratesConfig(patch.pirates)
              : sanitizePiratesConfig(state.adminConfig.pirates);
          const nextSpEconomy =
            patch.spEconomy !== undefined
              ? sanitizeSpEconomyConfig(patch.spEconomy)
              : sanitizeSpEconomyConfig(state.adminConfig.spEconomy);
          const nextFluxTransfer =
            patch.fluxTransfer !== undefined
              ? sanitizeFluxTransferConfig(patch.fluxTransfer)
              : sanitizeFluxTransferConfig(state.adminConfig.fluxTransfer);
          const nextSupplyEconomy =
            patch.supplyEconomy !== undefined
              ? sanitizeSupplyEconomyConfig(patch.supplyEconomy)
              : sanitizeSupplyEconomyConfig(state.adminConfig.supplyEconomy);
          const nextEnemyLevel =
            patch.enemyLevel !== undefined
              ? sanitizeEnemyLevelConfig(patch.enemyLevel)
              : sanitizeEnemyLevelConfig(state.adminConfig.enemyLevel);
          const nextTurnPhase =
            patch.turnPhase !== undefined
              ? sanitizeTurnPhaseConfig(patch.turnPhase)
              : sanitizeTurnPhaseConfig(state.adminConfig.turnPhase);
          const nextPrestage =
            patch.prestage !== undefined
              ? sanitizePrestageConfig(patch.prestage)
              : sanitizePrestageConfig(state.adminConfig.prestage);
          const nextStealth =
            patch.stealth !== undefined
              ? sanitizeStealthConfig(patch.stealth)
              : sanitizeStealthConfig(state.adminConfig.stealth);
          const nextMaxLevel =
            patch.maxLevel !== undefined
              ? sanitizeMaxLevel(patch.maxLevel)
              : sanitizeMaxLevel(state.adminConfig.maxLevel);
          setRuntimeMaxLevel(nextMaxLevel);
          const nextBaseSiege =
            patch.baseSiege !== undefined
              ? sanitizeBaseSiegeConfig(patch.baseSiege)
              : sanitizeBaseSiegeConfig(state.adminConfig.baseSiege);
          const nextBuffCards =
            patch.buffCards !== undefined
              ? sanitizeBuffCardsConfig(patch.buffCards)
              : sanitizeBuffCardsConfig(state.adminConfig.buffCards);
          const nextAdminConfig: AdminConfig = {
            ...state.adminConfig,
            ...patch,
            baseSiege: nextBaseSiege,
            buffCards: nextBuffCards,
            npcBuffCards: sanitizeNpcBuffCardsConfig(
              patch.npcBuffCards !== undefined
                ? patch.npcBuffCards
                : state.adminConfig.npcBuffCards
            ),
            ...sanitizeSupplyShopExtraConfig({
              supplyShopMaxRefreshes:
                patch.supplyShopMaxRefreshes ??
                state.adminConfig.supplyShopMaxRefreshes,
              supplyShopRefreshBaseCost:
                patch.supplyShopRefreshBaseCost ??
                state.adminConfig.supplyShopRefreshBaseCost,
              supplyWpPriceDivisor:
                patch.supplyWpPriceDivisor ??
                state.adminConfig.supplyWpPriceDivisor,
              supplyWpMinTier:
                patch.supplyWpMinTier ?? state.adminConfig.supplyWpMinTier,
              supplyWpDupWeight:
                patch.supplyWpDupWeight ?? state.adminConfig.supplyWpDupWeight,
              supplyWpMaxCopies:
                patch.supplyWpMaxCopies ?? state.adminConfig.supplyWpMaxCopies,
            }),
            maxLevel: nextMaxLevel,
            skillMaxLevel: sanitizeSkillMaxLevel(
              patch.skillMaxLevel !== undefined
                ? patch.skillMaxLevel
                : state.adminConfig.skillMaxLevel
            ),
            passiveScaleAfter5: sanitizePassiveScaleAfter5(
              patch.passiveScaleAfter5 !== undefined
                ? patch.passiveScaleAfter5
                : state.adminConfig.passiveScaleAfter5
            ),
            restorePctCap: sanitizeRestorePctCap(
              patch.restorePctCap !== undefined
                ? patch.restorePctCap
                : state.adminConfig.restorePctCap
            ),
            passiveSlots: sanitizePassiveSlotsConfig(
              patch.passiveSlots !== undefined
                ? patch.passiveSlots
                : state.adminConfig.passiveSlots
            ),
            activeSlots: sanitizeActiveSlotsConfig(
              patch.activeSlots !== undefined
                ? patch.activeSlots
                : state.adminConfig.activeSlots
            ),
            skillTiers: sanitizeSkillTiersConfig(
              patch.skillTiers !== undefined
                ? patch.skillTiers
                : state.adminConfig.skillTiers
            ),
            skillWpCostFactor: sanitizeSkillWpCostFactor(
              patch.skillWpCostFactor !== undefined
                ? patch.skillWpCostFactor
                : state.adminConfig.skillWpCostFactor
            ),
            skillCardPriceMult: sanitizeSkillCardPriceMult(
              patch.skillCardPriceMult !== undefined
                ? patch.skillCardPriceMult
                : state.adminConfig.skillCardPriceMult
            ),
            priceOverrides: sanitizePriceOverrides(
              patch.priceOverrides !== undefined
                ? patch.priceOverrides
                : state.adminConfig.priceOverrides
            ),
            skillMods: sanitizeSkillMods(
              patch.skillMods !== undefined
                ? patch.skillMods
                : state.adminConfig.skillMods,
              Array.isArray(patch.iconCatalogMods)
                ? patch.iconCatalogMods
                : state.adminConfig.iconCatalogMods
            ),
            formation: nextFormation,
            autoEquip: nextAutoEquip,
            starterSet: nextStarterSet,
            statusDisplayDefaults: nextStatusDefaults,
            cardPopupStaggerMs: sanitizeCardPopupStaggerMs(
              patch.cardPopupStaggerMs !== undefined
                ? patch.cardPopupStaggerMs
                : state.adminConfig.cardPopupStaggerMs
            ),
            cardPopupFlightMs: sanitizeCardPopupFlightMs(
              patch.cardPopupFlightMs !== undefined
                ? patch.cardPopupFlightMs
                : state.adminConfig.cardPopupFlightMs
            ),
            cardPopupMaxConcurrent: sanitizeCardPopupMaxConcurrent(
              patch.cardPopupMaxConcurrent !== undefined
                ? patch.cardPopupMaxConcurrent
                : state.adminConfig.cardPopupMaxConcurrent
            ),
            cardPopupZoneWidthPct: sanitizeCardPopupZoneWidthPct(
              patch.cardPopupZoneWidthPct !== undefined
                ? patch.cardPopupZoneWidthPct
                : state.adminConfig.cardPopupZoneWidthPct
            ),
            cardPopupZoneHeightPct: sanitizeCardPopupZoneHeightPct(
              patch.cardPopupZoneHeightPct !== undefined
                ? patch.cardPopupZoneHeightPct
                : state.adminConfig.cardPopupZoneHeightPct
            ),
            cardPopupStartScalePct: sanitizeCardPopupStartScalePct(
              patch.cardPopupStartScalePct !== undefined
                ? patch.cardPopupStartScalePct
                : state.adminConfig.cardPopupStartScalePct
            ),
            cardPopupEndScalePct: sanitizeCardPopupEndScalePct(
              patch.cardPopupEndScalePct !== undefined
                ? patch.cardPopupEndScalePct
                : state.adminConfig.cardPopupEndScalePct
            ),
            radarPopupStartScalePct: sanitizeRadarPopupStartScalePct(
              patch.radarPopupStartScalePct !== undefined
                ? patch.radarPopupStartScalePct
                : state.adminConfig.radarPopupStartScalePct
            ),
            radarPopupSmallScalePct: sanitizeRadarPopupSmallScalePct(
              patch.radarPopupSmallScalePct !== undefined
                ? patch.radarPopupSmallScalePct
                : state.adminConfig.radarPopupSmallScalePct
            ),
            radarPopupLargeScalePct: sanitizeRadarPopupLargeScalePct(
              patch.radarPopupLargeScalePct !== undefined
                ? patch.radarPopupLargeScalePct
                : state.adminConfig.radarPopupLargeScalePct
            ),
            radarPopupBigMaxUnits: sanitizeRadarPopupBigMaxUnits(
              patch.radarPopupBigMaxUnits !== undefined
                ? patch.radarPopupBigMaxUnits
                : state.adminConfig.radarPopupBigMaxUnits
            ),
            pirates: nextPirates,
            spEconomy: nextSpEconomy,
            fluxTransfer: nextFluxTransfer,
            supplyEconomy: nextSupplyEconomy,
            supplyScanCount: sanitizeSupplyScanCount(
              patch.supplyScanCount !== undefined
                ? patch.supplyScanCount
                : state.adminConfig.supplyScanCount
            ),
            enemyLevel: nextEnemyLevel,
            moduleDrop:
              patch.moduleDrop !== undefined
                ? sanitizeModuleDropConfig(patch.moduleDrop)
                : sanitizeModuleDropConfig(state.adminConfig.moduleDrop),
            turnPhase: nextTurnPhase,
            prestage: nextPrestage,
            stealth: nextStealth,
            supplyRewards:
              patch.supplyRewards !== undefined
                ? sanitizeSupplyRewardsConfig(patch.supplyRewards)
                : sanitizeSupplyRewardsConfig(state.adminConfig.supplyRewards),
            crateShop:
              patch.crateShop !== undefined
                ? sanitizeCrateShopConfig(patch.crateShop)
                : sanitizeCrateShopConfig(state.adminConfig.crateShop),
            starterEvent: sanitizeStarterEventConfig(
              patch.starterEvent !== undefined
                ? patch.starterEvent
                : state.adminConfig.starterEvent,
              patch.vouchers !== undefined
                ? patch.vouchers
                : state.adminConfig.vouchers
            ),
          };
          let updatedPilot =
            patch.formation &&
            state.pilot.squadFormation &&
            state.pilot.squadFormation.length > 0
              ? {
                  ...state.pilot,
                  squadFormation: enforceFormationCapacities(
                    state.pilot.squadFormation,
                    nextFormation
                  ),
                }
              : state.pilot;
          if (patch.pirates !== undefined) {
            updatedPilot = {
              ...updatedPilot,
              pirateIncidents: sanitizePirateIncidents(
                updatedPilot.pirateIncidents,
                updatedPilot.campaignMonth,
                nextPirates
              ),
            };
          }
          if (
            patch.starterSet &&
            nextStarterSet.enabled &&
            nextStarterSet.boostScope === 'fill_empty_slots'
          ) {
            updatedPilot = fillEmptyStarterSlotsForPilot(
              updatedPilot,
              nextStarterSet
            ).pilot;
          }
          return {
            adminConfig: nextAdminConfig,
            pilot: updatedPilot,
          };
        });
      },

      adminExportSaveJson: () => {
        const state = get();
        const payload = {
          version: CURRENT_SAVE_VERSION,
          exportedAt: new Date().toISOString(),
          state: {
            pilot: state.pilot,
            shopStock: state.shopStock,
            supplyShopStock: state.supplyShopStock,
            supplyShopStockWp: state.supplyShopStockWp,
            voucherShopStockWp: state.voucherShopStockWp,
            crateShopStockWp: state.crateShopStockWp,
            crateShopStockCredit: state.crateShopStockCredit,
            blackMarketOffer: state.blackMarketOffer,
            supplyShopRefresh: state.supplyShopRefresh,
            wpMarketOffers: state.wpMarketOffers,
            battlesUntilRestock: state.battlesUntilRestock,
            inventoryFilterState: state.inventoryFilterState,
            quickSellConfig: state.quickSellConfig,
            selectedSectorId: state.selectedSectorId,
            hasSaveData: state.hasSaveData,
            muted: state.muted,
            battleSpeed: state.battleSpeed,
            skipAnimations: state.skipAnimations,
            battleViewMode: state.battleViewMode,
            language: state.language,
            adminConfig: state.adminConfig,
          },
        };
        return JSON.stringify(payload, null, 2);
      },

      adminImportSaveJson: (rawJson) => {
        try {
          const parsed = JSON.parse(rawJson);
          if (!parsed || typeof parsed !== 'object') {
            return { ok: false, error: 'Invalid JSON object' };
          }
          const version =
            typeof (parsed as { version?: unknown }).version === 'number'
              ? (parsed as { version: number }).version
              : CURRENT_SAVE_VERSION;
          const payloadState =
            (parsed as { state?: unknown }).state ?? parsed;
          const migrated = migrateSaveData(payloadState, version);
          setRuntimeMaxLevel(migrated.adminConfig.maxLevel);
          set({
            ...migrated,
            battle: null,
            screen: migrated.hasSaveData ? 'HANGAR' : 'TITLE',
          });
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },

      exportSaveStateSnapshot: () => {
        return buildSaveSnapshotFromState(get());
      },

      importSaveFromEnvelope: (rawState, saveVersion) => {
        const state = get();
        if (isBattleActive(state)) {
          return {
            ok: false,
            code: 'BATTLE_ACTIVE',
            error: 'Cannot import save while a battle is active.',
          };
        }

        const verCheck = validateImportSaveVersion(
          saveVersion,
          CURRENT_SAVE_VERSION
        );
        if (!verCheck.ok) {
          return {
            ok: false,
            code: 'VERSION_TOO_NEW',
            error: verCheck.error.message,
          };
        }

        if (!isValidSavePayloadShape(rawState, saveVersion)) {
          return {
            ok: false,
            code: 'CORRUPT',
            error: 'Imported save payload is missing pilot data.',
          };
        }

        const migrated = migrateSaveData(rawState, saveVersion);
        setRuntimeMaxLevel(migrated.adminConfig.maxLevel);
        const rawObj = rawState as Record<string, unknown>;
        const importedAutoRepeatStopOnDefeat =
          typeof rawObj.autoRepeatStopOnDefeat === 'boolean'
            ? rawObj.autoRepeatStopOnDefeat
            : state.autoRepeatStopOnDefeat;

        // Store a one-time backup of the current save under a separate localStorage key before overwriting
        const currentBackup = {
          version: CURRENT_SAVE_VERSION,
          backedUpAt: new Date().toISOString(),
          state: buildSaveSnapshotFromState(state),
        };
        writeImportBackupRaw(JSON.stringify(currentBackup));

        soundFx.setMuted(migrated.muted);
        set({
          ...migrated,
          autoRepeatStopOnDefeat: importedAutoRepeatStopOnDefeat,
          battle: null,
          screen: migrated.hasSaveData ? 'HANGAR' : 'TITLE',
          activeTab: 'gear',
          shopSubTab: 'buy',
          autoBattleEnabled: false,
          autoRepeatSession: null,
          autoRepeatToast: null,
          battleLaunchToast: null,
          quickSellUndo: null,
          autoEquipUndo: null,
          tacticsModalOpen: false,
          adminPanelOpen: false,
          hasImportBackup: true,
        });

        return { ok: true, migratedVersion: saveVersion };
      },

      undoSaveImport: () => {
        const state = get();
        if (isBattleActive(state)) {
          return {
            ok: false,
            error: 'Cannot undo import while a battle is active.',
          };
        }

        const rawBackup = readImportBackupRaw();
        if (!rawBackup) {
          set({ hasImportBackup: false });
          return { ok: false, error: 'No import backup available.' };
        }

        try {
          const parsed = JSON.parse(rawBackup) as {
            version?: number;
            state?: unknown;
          };
          const backupVersion =
            typeof parsed.version === 'number'
              ? parsed.version
              : CURRENT_SAVE_VERSION;
          const backupPayload = parsed.state ?? parsed;
          if (!isValidSavePayloadShape(backupPayload, backupVersion)) {
            clearImportBackupRaw();
            set({ hasImportBackup: false });
            return { ok: false, error: 'Backup data is invalid.' };
          }

          const restored = migrateSaveData(backupPayload, backupVersion);
          setRuntimeMaxLevel(restored.adminConfig.maxLevel);
          const rawObj = backupPayload as Record<string, unknown>;
          const restoredAutoRepeatStopOnDefeat =
            typeof rawObj.autoRepeatStopOnDefeat === 'boolean'
              ? rawObj.autoRepeatStopOnDefeat
              : state.autoRepeatStopOnDefeat;

          clearImportBackupRaw();
          soundFx.setMuted(restored.muted);
          set({
            ...restored,
            autoRepeatStopOnDefeat: restoredAutoRepeatStopOnDefeat,
            battle: null,
            screen: restored.hasSaveData ? 'HANGAR' : 'TITLE',
            activeTab: 'gear',
            shopSubTab: 'buy',
            autoBattleEnabled: false,
            autoRepeatSession: null,
            autoRepeatToast: null,
            battleLaunchToast: null,
            quickSellUndo: null,
            autoEquipUndo: null,
            tacticsModalOpen: false,
            adminPanelOpen: false,
            hasImportBackup: false,
          });
          return { ok: true };
        } catch (err) {
          clearImportBackupRaw();
          set({ hasImportBackup: false });
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    }),
    {
      name: 'starfront_mech_rpg_save_v1',
      version: CURRENT_SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pilot: state.pilot,
        shopStock: state.shopStock,
        supplyShopStock: state.supplyShopStock,
        supplyShopStockWp: state.supplyShopStockWp,
        voucherShopStockWp: state.voucherShopStockWp,
        crateShopStockWp: state.crateShopStockWp,
        crateShopStockCredit: state.crateShopStockCredit,
        blackMarketOffer: state.blackMarketOffer,
        supplyShopRefresh: state.supplyShopRefresh,
        wpMarketOffers: state.wpMarketOffers,
        battlesUntilRestock: state.battlesUntilRestock,
        inventoryFilterState: state.inventoryFilterState,
        quickSellConfig: state.quickSellConfig,
        selectedSectorId: state.selectedSectorId,
        hasSaveData: state.hasSaveData,
        muted: state.muted,
        battleSpeed: state.battleSpeed,
        skipAnimations: state.skipAnimations,
        battleViewMode: state.battleViewMode,
        language: state.language,
        autoRepeatStopOnDefeat: state.autoRepeatStopOnDefeat,
        adminConfig: state.adminConfig,
      }),
      migrate: (persistedState: unknown, version: number) =>
        migrateSaveData(persistedState, version),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[useGameStore] Failed to rehydrate persisted state:', error);
          return;
        }
        if (state) {
          // Validate & sanitize persisted UI slice + per-device speed & loop prefs
          const deviceSpeed = readDeviceBattleSpeed();
          if (deviceSpeed !== null) {
            state.battleSpeed = deviceSpeed;
          } else if (!ALLOWED_BATTLE_SPEEDS.includes(state.battleSpeed)) {
            state.battleSpeed = 1;
          }
          if (
            state.battleViewMode !== null &&
            state.battleViewMode !== 'card' &&
            state.battleViewMode !== 'radar'
          ) {
            state.battleViewMode = null;
          }
          if (state.language !== 'en' && state.language !== 'vi') {
            state.language = 'vi';
          }
          if (!state.adminConfig || typeof state.adminConfig !== 'object') {
            setActiveMapPack(null);
            state.adminConfig = createDefaultAdminConfig();
          } else {
            const rawAdmin = state.adminConfig as unknown as Record<
              string,
              unknown
            >;
            const sanitizedMapPack = sanitizeMapPack(rawAdmin.mapPack);
            setActiveMapPack(sanitizedMapPack);
            const sanitizedFormation = sanitizeFormationConfig(rawAdmin);
            state.adminConfig = {
              ...createDefaultAdminConfig(),
              ...state.adminConfig,
              mapPack: sanitizedMapPack,
              maxLevel: sanitizeMaxLevel(rawAdmin.maxLevel),
              formation: sanitizedFormation,
              autoEquip: sanitizeAutoEquipConfig(rawAdmin.autoEquip),
              starterSet: sanitizeStarterSetConfig(rawAdmin.starterSet),
              statusDisplayDefaults: sanitizeStatusDisplayDefaults(
                rawAdmin.statusDisplayDefaults
              ),
              cardPopupStaggerMs: sanitizeCardPopupStaggerMs(
                rawAdmin.cardPopupStaggerMs
              ),
              cardPopupFlightMs: sanitizeCardPopupFlightMs(
                rawAdmin.cardPopupFlightMs
              ),
              cardPopupMaxConcurrent: sanitizeCardPopupMaxConcurrent(
                rawAdmin.cardPopupMaxConcurrent
              ),
              cardPopupZoneWidthPct: sanitizeCardPopupZoneWidthPct(
                rawAdmin.cardPopupZoneWidthPct
              ),
              cardPopupZoneHeightPct: sanitizeCardPopupZoneHeightPct(
                rawAdmin.cardPopupZoneHeightPct
              ),
              cardPopupStartScalePct: sanitizeCardPopupStartScalePct(
                rawAdmin.cardPopupStartScalePct
              ),
              cardPopupEndScalePct: sanitizeCardPopupEndScalePct(
                rawAdmin.cardPopupEndScalePct
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
              ...sanitizeSupplyShopConfig(rawAdmin as Partial<AdminConfig>),
              ...sanitizeSupplyShopExtraConfig(rawAdmin as Partial<AdminConfig>),
              spEconomy: sanitizeSpEconomyConfig(rawAdmin.spEconomy),
              fluxTransfer: sanitizeFluxTransferConfig(rawAdmin.fluxTransfer),
              supplyEconomy: sanitizeSupplyEconomyConfig(rawAdmin.supplyEconomy),
              supplyScanCount: sanitizeSupplyScanCount(rawAdmin.supplyScanCount),
              enemyLevel: sanitizeEnemyLevelConfig(rawAdmin.enemyLevel),
              moduleDrop: sanitizeModuleDropConfig(rawAdmin.moduleDrop),
              pirates: sanitizePiratesConfig(rawAdmin.pirates),
              stealth: sanitizeStealthConfig(rawAdmin.stealth),
              skillMaxLevel: sanitizeSkillMaxLevel(rawAdmin.skillMaxLevel),
              passiveScaleAfter5: sanitizePassiveScaleAfter5(
                rawAdmin.passiveScaleAfter5
              ),
              restorePctCap: sanitizeRestorePctCap(rawAdmin.restorePctCap),
              passiveSlots: sanitizePassiveSlotsConfig(rawAdmin.passiveSlots),
              activeSlots: sanitizeActiveSlotsConfig(rawAdmin.activeSlots),
              skillTiers: sanitizeSkillTiersConfig(rawAdmin.skillTiers),
              skillWpCostFactor: sanitizeSkillWpCostFactor(
                rawAdmin.skillWpCostFactor
              ),
              skillCardPriceMult: sanitizeSkillCardPriceMult(
                rawAdmin.skillCardPriceMult
              ),
              priceOverrides: sanitizePriceOverrides(rawAdmin.priceOverrides),
              starterEvent: sanitizeStarterEventConfig(
                rawAdmin.starterEvent,
                rawAdmin.vouchers as AdminConfig['vouchers']
              ),
              buffCards: sanitizeBuffCardsConfig(rawAdmin.buffCards),
              npcBuffCards: sanitizeNpcBuffCardsConfig(
                rawAdmin.npcBuffCards as AdminConfig['npcBuffCards']
              ),
              rewardMultiplier:
                typeof state.adminConfig.rewardMultiplier === 'number' &&
                Number.isFinite(state.adminConfig.rewardMultiplier) &&
                state.adminConfig.rewardMultiplier > 0
                  ? state.adminConfig.rewardMultiplier
                  : BALANCE_CONFIG.rewardMultDefault,
            };
            // Remove legacy dead fields if present on old saves
            const cleaned = state.adminConfig as unknown as Record<
              string,
              unknown
            >;
            delete cleaned.formationFrontCapacity;
            delete cleaned.formationBackCapacity;
            delete cleaned.backRowDamageReduction;
          }
          setRuntimeMaxLevel(state.adminConfig.maxLevel);
          if (
            typeof state.selectedSectorId !== 'string' ||
            !getMapNodeById(state.selectedSectorId)
          ) {
            state.selectedSectorId = getDefaultSelectedNodeId();
          }
          if (state.pilot && typeof state.pilot === 'object') {
            if (state.pilot.cards !== undefined) {
              const sanitizedCards = sanitizeOwnedCards(state.pilot.cards);
              if (Object.keys(sanitizedCards).length > 0) {
                state.pilot.cards = sanitizedCards;
              } else {
                delete state.pilot.cards;
              }
            }
            const sanitizedBuffCards = sanitizePilotBuffCards(
              state.pilot.buffCards
            );
            if (Object.keys(sanitizedBuffCards).length > 0) {
              state.pilot.buffCards = sanitizedBuffCards;
            } else {
              delete state.pilot.buffCards;
            }
            const sanitizedActiveBuffs = sanitizePilotActiveBuffs(
              state.pilot.activeBuffs,
              state.pilot.activeExpBoostBattles
            );
            if (Object.keys(sanitizedActiveBuffs).length > 0) {
              state.pilot.activeBuffs = sanitizedActiveBuffs;
            } else {
              delete state.pilot.activeBuffs;
            }
            delete state.pilot.activeExpBoostBattles;
            if (state.pilot.starterEventGranted !== undefined) {
              const sanitizedGranted = sanitizeStarterEventGranted(
                state.pilot.starterEventGranted
              );
              if (sanitizedGranted.length > 0) {
                state.pilot.starterEventGranted = sanitizedGranted;
              } else {
                delete state.pilot.starterEventGranted;
              }
            }
            if (
              !Array.isArray(state.pilot.squadFormation) ||
              state.pilot.squadFormation.length === 0
            ) {
              const migratedFormation = migrateLegacySquadFormation(
                state.pilot.squadFormation,
                state.pilot.name,
                state.pilot.activeGearId,
                state.adminConfig.formation,
                state.pilot.formationCustomized
              );
              state.pilot.squadFormation = migratedFormation.squadFormation;
              state.pilot.formationCustomized =
                migratedFormation.formationCustomized;
            } else {
              state.pilot.squadFormation = enforceFormationCapacities(
                state.pilot.squadFormation,
                state.adminConfig.formation
              );
            }
            state.pilot.pirateIncidents = sanitizePirateIncidents(
              state.pilot.pirateIncidents,
              state.pilot.campaignMonth ?? 1,
              state.adminConfig.pirates
            );
            state.pilot = ensureIdle(
              state.pilot,
              state.adminConfig.pirates,
              Math.random,
              state.adminConfig
            );
          }
          // Guarantee shop stock and WP market offers are NEVER empty on reload!
          const activeGear = state.pilot?.gears?.[state.pilot?.activeGearId];
          const refLevel = activeGear?.level ?? 1;
          if (
            !Array.isArray(state.shopStock) ||
            state.shopStock.length === 0 ||
            !state.shopStock.some((it) => !it.soldOut)
          ) {
            state.shopStock = generateCategorizedShopStock(
              refLevel,
              buildShopOptionsFromState(state.pilot, state.adminConfig)
            );
          }
          if (!Array.isArray(state.supplyShopStock)) {
            state.supplyShopStock = generateSupplyShopStock(
              getMaxGearLevel(state.pilot),
              state.adminConfig,
              SUPPLY_TEMPLATES
            );
          } else {
            state.supplyShopStock = sanitizeSupplyShopStock(state.supplyShopStock);
          }
          const sanitizedWpStock = Array.isArray(state.supplyShopStockWp)
            ? sanitizeSupplyShopStockWp(state.supplyShopStockWp)
            : [];
          if (sanitizedWpStock.length > 0) {
            state.supplyShopStockWp = sanitizedWpStock;
          } else {
            state.supplyShopStockWp = generateSupplyShopStockWp(
              getMaxGearLevel(state.pilot),
              state.adminConfig,
              state.supplyShopStock.length,
              SUPPLY_TEMPLATES
            );
          }
          const sanitizedVoucherStock = Array.isArray(state.voucherShopStockWp)
            ? sanitizeVoucherShopStockWp(state.voucherShopStockWp, state.adminConfig.vouchers)
            : [];
          if (sanitizedVoucherStock.length > 0) {
            state.voucherShopStockWp = sanitizedVoucherStock;
          } else {
            state.voucherShopStockWp = rollVoucherShopStockWp(state.adminConfig.vouchers);
          }
          state.crateShopStockWp = Array.isArray(state.crateShopStockWp)
            ? sanitizeCrateShopStock(state.crateShopStockWp)
            : [];
          state.crateShopStockCredit = Array.isArray(state.crateShopStockCredit)
            ? sanitizeCrateShopStock(state.crateShopStockCredit)
            : [];
          state.blackMarketOffer = sanitizeBlackMarketMedalOffer(
            state.blackMarketOffer
          );
          state.supplyShopRefresh = sanitizeSupplyShopRefresh(
            state.supplyShopRefresh
          );
          if (
            !Array.isArray(state.wpMarketOffers) ||
            state.wpMarketOffers.length === 0
          ) {
            state.wpMarketOffers = generateWpMarketOffers({
              shipyardBonus: hasOperationalShipyard(state.pilot),
              adminConfig: state.adminConfig,
            });
          }
          if (
            typeof state.battlesUntilRestock !== 'number' ||
            state.battlesUntilRestock < 1
          ) {
            state.battlesUntilRestock = SHOP_STOCK_CONFIG.restockEveryNBattles;
          }
          if (!state.inventoryFilterState || typeof state.inventoryFilterState !== 'object') {
            state.inventoryFilterState = getDefaultInventoryFilterState();
          }
          if (!state.quickSellConfig || typeof state.quickSellConfig !== 'object') {
            state.quickSellConfig = { ...DEFAULT_QUICK_SELL_CONFIG };
          }
          // Ensure transient modal/UI flags are always reset on reload
          state.adminPanelOpen = false;
          state.tacticsModalOpen = false;
          state.quickSellUndo = null;
          state.autoEquipUndo = null;
          state.hasImportBackup = hasPersistedImportBackup();
          state.adminUnlocked = readPersistedAdminUnlock();
          state.muted = typeof state.muted === 'boolean' ? state.muted : true;
          state.skipAnimations = Boolean(state.skipAnimations);
          const hasStoredLoopPrefs =
            typeof window !== 'undefined' &&
            Boolean(window.localStorage?.getItem(LOOP_PREFS_STORAGE_KEY));
          const resolvedLoopPrefs = hasStoredLoopPrefs
            ? readDeviceLoopPrefs()
            : typeof state.autoRepeatStopOnDefeat === 'boolean'
            ? (() => {
                const migrated = migrateLegacyLoopPrefs(
                  state.autoRepeatStopOnDefeat
                );
                writeDeviceLoopPrefs(migrated);
                return migrated;
              })()
            : readDeviceLoopPrefs();
          state.autoRepeatDefeatRule = resolvedLoopPrefs.defeatRule;
          state.autoRepeatDefeatStreakLimit = clampDefeatStreakLimit(
            resolvedLoopPrefs.defeatStreakLimit,
            DEFAULT_DEFEAT_STREAK_LIMIT
          );
          state.autoRepeatStopOnDefeat =
            resolvedLoopPrefs.defeatRule === 'stop_immediately';
          state.autoRepeatToast = null;
          state.battleLaunchToast = null;
          soundFx.setMuted(state.muted);
        }
      },
    }
  )
);

useGameStore.subscribe((state, prevState) => {
  if (state.adminConfig?.maxLevel !== prevState.adminConfig?.maxLevel) {
    setRuntimeMaxLevel(state.adminConfig?.maxLevel);
  }
});

registerPirateBattleSourceProvider(
  () => useGameStore.getState().adminConfig?.pirates
);
