import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BALANCE_CONFIG, getGarageUnlockCost } from '../data/balance';
import { sanitizeAutoEquipConfig } from '../data/autoEquipConfig';
import { EMPTY_STAT_BLOCK, MECH_CLASS_LIST } from '../data/classes';
import { EQUIPMENT_SLOTS } from '../data/items';
import { getNextSectorId, SECTORS_CATALOG } from '../data/maps';
import { WINGMAN_CHAT_KEYS } from '../data/pilots';
import { SHOP_STOCK_CONFIG } from '../data/shopConfig';
import { sanitizeStarterSetConfig } from '../data/starterConfig';
import { getSkillById, OPENING_CARDS_LIST } from '../data/skills';
import {
  calculateBattleRewards,
  chooseAiDecision,
  createInitialBattleState,
  createRoundHpSnapshot,
  getValidEnemyTargets,
  reconcileRemainingTurnOrder,
  resolveUnitAction,
  sortTurnOrder,
} from '../engine/combat';
import {
  applyAutoEquipPlan,
  buildAutoEquipPlan,
  undoAutoEquipSnapshot,
} from '../engine/autoEquip';
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
  startBaseRepair,
} from '../engine/mapWorld';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
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
  isValidSavePayloadShape,
  SAVE_IMPORT_BACKUP_STORAGE_KEY,
  validateImportSaveVersion,
} from '../engine/saveExport';
import { DEFAULT_QUICK_SELL_CONFIG } from '../engine/quickSell';
import {
  buildShopOptionsFromState,
  generateCategorizedShopStock,
  generateWpMarketOffers,
  hasOperationalShipyard,
} from '../engine/shop';
import {
  buyOpeningCard,
  equipSkillToGearBar,
  getSkillsForClass,
  learnOrUpgradeSkillOnGear,
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
  allocateGearStats,
  applyExpToGear,
  estimateBattlesToNextLevel,
  getTotalAvailablePointsForLevel,
  resetGearStatAllocations,
} from '../engine/stats';
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
  BattleRoundSnapshot,
  BattleSpeed,
  BattleState,
  BattleViewMode,
  CombatLogEntry,
  CombatRow,
  CombatUnit,
  ConsumableItem,
  EnchantAttemptResult,
  EquipmentSlot,
  EquipValidationResult,
  GearTacticsProfile,
  InventoryFilterState,
  ItemInstance,
  ItemRarity,
  Language,
  MechClassId,
  PilotAccount,
  QuickSellFilterConfig,
  QuickSellUndoState,
  ScreenState,
  ShopItemListing,
  SimpleTacticsConfig,
  SimpleTacticsPresetId,
  SkillValidationResult,
  StatBlock,
  TacticsPresetId,
  TacticsRule,
  WpMarketOffer,
} from '../types/game';
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

export type ShopSubTab = 'buy' | 'sell' | 'warpoints';

interface GameStoreState {
  // Persisted state (v7 per-Gear + full Skill System + Random Shop + Inventory Filters + Admin CP)
  pilot: PilotAccount;
  shopStock: ShopItemListing[];
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
  quickSellUndo: QuickSellUndoState | null;
  autoEquipUndo: AutoEquipUndoSnapshot | null;
  hasImportBackup: boolean;

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
  advanceMonth: () => MonthAdvanceSummary;
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
  startAutoRepeat: (limit?: AutoRepeatLimit, sectorId?: string) => void;
  stopAutoRepeat: (reason?: AutoStopReason) => void;
  clearAutoRepeatSummary: () => void;
  clearAutoRepeatToast: () => void;

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
  unequipSlot: (slot: EquipmentSlot) => void;
  unequipInstanceEverywhere: (instanceId: string) => void;
  buyShopItem: (instanceId: string) => { ok: boolean };
  refreshShopStock: () => { ok: boolean; cost: number };
  buyWpMarketOffer: (offerId: string) => {
    ok: boolean;
    reason?: 'not_found' | 'sold_out' | 'insufficient_wp';
  };
  refreshWpMarket: () => { ok: boolean; cost: number };
  useConsumable: (consumableId: string) => {
    ok: boolean;
    openedItem?: ItemInstance;
    kind?: ConsumableItem['kind'];
  };
  sellItem: (instanceId: string) => { ok: boolean; creditsEarned: number };
  enchantEquippedSlot: (slot: EquipmentSlot) => EnchantAttemptResult | null;

  // Battle actions
  startBattle: (sectorId?: string) => void;
  reloadBattle: (sectorId?: string) => void;
  selectTarget: (unitId: string) => void;
  selectAllyTarget: (unitId: string) => void;
  logRadarInvalidTarget: (targetName: string, reasonKey: string) => void;
  performPlayerAction: (action: ActionType, skillId?: string) => void;
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
  adminUnlockAllGears: () => void;
  adminUnlockAllSectors: () => void;
  adminApplyStarterToEmptySlots: () => number;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
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
  const deployedGearId = battle.deployedGearId;
  const deployedGear = state.pilot.gears[deployedGearId];
  const alreadyCaptured = state.pilot.capturedSectorIds.includes(battle.sectorId);

  const rewards = calculateBattleRewards(
    updatedUnits,
    won,
    state.adminConfig.rewardMultiplier,
    battle.sectorId,
    alreadyCaptured
  );
  const droppedItems = rollBattleItemDrops(
    updatedUnits.filter((u) => u.side === 'enemy'),
    battle.sectorId,
    deployedGear.level,
    won
  );

  // Active EXP Boost consumable (+50% EXP for N battles)
  const expBoostActive = (state.pilot.activeExpBoostBattles ?? 0) > 0;
  const effectiveExpGained = expBoostActive
    ? Math.round(
        rewards.expGained * (1 + SHOP_STOCK_CONFIG.wpOffers.expBoost.expBonusPct / 100)
      )
    : rewards.expGained;

  // Per-Gear EXP: ONLY the deployed Gear receives EXP & battle record!
  const levelResult = applyExpToGear(deployedGear, effectiveExpGained, { won });
  const battlesToNextLevel = estimateBattlesToNextLevel(
    levelResult.updatedGear,
    rewards.fullVictoryExp
  );

  // Unlock next campaign sector & record base capture on victory
  let unlockedSectorId: string | null = null;
  let nextUnlockedSectors = state.pilot.unlockedSectorIds;
  let nextCapturedSectors = state.pilot.capturedSectorIds;
  if (won) {
    if (!alreadyCaptured) {
      nextCapturedSectors = [...state.pilot.capturedSectorIds, battle.sectorId];
    }
    const candidateNext = getNextSectorId(battle.sectorId);
    if (candidateNext && !state.pilot.unlockedSectorIds.includes(candidateNext)) {
      unlockedSectorId = candidateNext;
      nextUnlockedSectors = [...state.pilot.unlockedSectorIds, candidateNext];
    }
  }

  const basePilotBeforeConsequences: PilotAccount = {
    ...state.pilot,
    credits: state.pilot.credits + rewards.creditsGained,
    warPoints: state.pilot.warPoints + rewards.warPointsGained,
    inventory: [...droppedItems, ...state.pilot.inventory],
    gears: {
      ...state.pilot.gears,
      [deployedGearId]: levelResult.updatedGear,
    },
    unlockedSectorIds: nextUnlockedSectors,
    capturedSectorIds: nextCapturedSectors,
    activeExpBoostBattles: expBoostActive
      ? Math.max(0, (state.pilot.activeExpBoostBattles ?? 1) - 1)
      : 0,
  };

  // Freshly captured bases start Damaged; repelled raids clear alert; hired wingman/engineer boost consumed; bonus missions paid
  const baseConseq = applyBattleBaseConsequences(
    basePilotBeforeConsequences,
    battle.sectorId,
    won
  );
  // Advance campaign calendar 1 month after each completed non-retreat sortie
  const monthStep = retreated
    ? { pilot: baseConseq.pilot }
    : advanceCampaignMonth(baseConseq.pilot);
  const nextPilot: PilotAccount = monthStep.pilot;

  // Auto-restock Credits Shop & WP Market based on restockEveryNBattles cadence
  const nextBattlesUntilRestock = Math.max(0, (state.battlesUntilRestock || 1) - 1);
  const shouldRestock = nextBattlesUntilRestock <= 0 || state.shopStock.length === 0;
  const refreshedShopStock = shouldRestock
    ? generateCategorizedShopStock(
        levelResult.updatedGear.level,
        buildShopOptionsFromState(nextPilot, state.adminConfig)
      )
    : state.shopStock;
  const refreshedWpOffers = shouldRestock
    ? generateWpMarketOffers({ shipyardBonus: hasOperationalShipyard(nextPilot) })
    : state.wpMarketOffers;

  if (won) soundFx.playVictory();
  else soundFx.playDefeat();

  const enemies = updatedUnits.filter((u) => u.side === 'enemy');
  const aliveAllies = updatedUnits.filter((u) => u.side === 'ally' && u.alive);

  // Update Auto-Repeat batch session if active (or stopped manually during current run)
  let nextAutoRepeat = state.autoRepeatSession;
  let nextAutoRepeatToast: AutoRepeatRunToast | null = null;
  let finalLog = extraLog;
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
      totalCredits: state.autoRepeatSession.totalCredits + rewards.creditsGained,
      totalWarPoints:
        state.autoRepeatSession.totalWarPoints + rewards.warPointsGained,
      totalDrops: [...state.autoRepeatSession.totalDrops, ...droppedItems],
    };
    if (state.autoRepeatSession.active) {
      const stopCheck = shouldStopAutoRepeat(
        updatedSession,
        won ? 'victory' : 'defeat',
        retreated,
        nextPilot.inventory.length,
        BALANCE_CONFIG.maxInventorySize,
        state.autoRepeatDefeatRule,
        streakLimit
      );
      if (stopCheck.stop) {
        const finalReason = updatedSession.stopReason ?? stopCheck.reason;
        nextAutoRepeat = {
          ...updatedSession,
          active: false,
          stopReason: finalReason,
        };
        nextAutoRepeatToast = null;
        if (finalReason) {
          finalLog = [
            ...extraLog,
            {
              id: `log_repeat_stop_${Date.now()}_${extraTurnCounter}`,
              round: battle.round,
              actorName: 'SYSTEM',
              tag: 'SYSTEM' as const,
              templateKey: 'log.autoRepeatStopped' as const,
              params: {
                reason: finalReason,
                streak: streakLimit,
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
    wpMarketOffers: refreshedWpOffers,
    battlesUntilRestock: shouldRestock
      ? SHOP_STOCK_CONFIG.restockEveryNBattles
      : nextBattlesUntilRestock,
    hasSaveData: true,
    autoRepeatSession: nextAutoRepeat,
    autoRepeatToast: nextAutoRepeatToast,
    battle: {
      ...battle,
      units: updatedUnits,
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
        deployedGearId,
        sectorId: battle.sectorId,
        rounds: battle.round,
        expGained: effectiveExpGained,
        creditsGained: rewards.creditsGained,
        warPointsGained: rewards.warPointsGained,
        baseCaptureBonusWp: rewards.baseCaptureBonusWp,
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
  sectorId?: string
): void {
  const requestedSector = sectorId ?? state.selectedSectorId;
  const targetSectorId = state.pilot.unlockedSectorIds.includes(requestedSector)
    ? requestedSector
    : state.pilot.unlockedSectorIds[0] ?? SECTORS_CATALOG[0].id;

  const battleState = createInitialBattleState(
    state.pilot,
    targetSectorId,
    Math.random,
    state.adminConfig.battleSizeOverride,
    state.adminConfig
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
      ...(!state.autoRepeatSession?.active
        ? { autoRepeatSession: null, autoRepeatToast: null }
        : {}),
    });
    return;
  }

  set({
    selectedSectorId: targetSectorId,
    battle: battleState,
    screen: 'BATTLE',
    hasSaveData: true,
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
      battleSpeed: initialDeviceSpeed ?? initialFresh.battleSpeed,
      screen: 'TITLE',
      activeTab: 'gear',
      shopSubTab: 'buy',
      battle: null,
      adminUnlocked: readPersistedAdminUnlock(),
      adminPanelOpen: false,
      autoBattleEnabled: false,
      tacticsModalOpen: false,
      autoRepeatLimit: 1,
      autoRepeatDefeatRule: initialDeviceLoopPrefs.defeatRule,
      autoRepeatDefeatStreakLimit: initialDeviceLoopPrefs.defeatStreakLimit,
      autoRepeatStopOnDefeat:
        initialDeviceLoopPrefs.defeatRule === 'stop_immediately',
      autoRepeatSession: null,
      autoRepeatToast: null,
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
        if (isBattleActive(get())) return;
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
          const cleanName =
            (pilotName ?? state.pilot.name).trim().slice(0, 18) || 'Vance';
          const chosenClass =
            starterClassId ?? state.pilot.activeGearId ?? 'striker';
          const fresh = createFreshCampaignState(
            cleanName,
            chosenClass,
            Math.random,
            state.adminConfig.starterSet
          );
          set({
            ...fresh,
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
          });
        } else {
          set({ screen: 'HANGAR', activeTab: 'gear' });
        }
      },

      continueCampaign: () => {
        soundFx.playConfirm();
        set({ screen: 'HANGAR', activeTab: 'gear' });
      },

      resetCampaign: () => {
        const state = get();
        soundFx.playClick();
        clearImportBackupRaw();
        const fresh = createFreshCampaignState('Vance', 'striker');
        const deviceLoopPrefs = readDeviceLoopPrefs();
        set({
          ...fresh,
          language: state.language,
          muted: state.muted,
          battleSpeed: state.battleSpeed,
          skipAnimations: state.skipAnimations,
          battleViewMode: state.battleViewMode,
          adminConfig: createDefaultAdminConfig(),
          hasSaveData: false,
          battle: null,
          screen: 'TITLE',
          activeTab: 'gear',
          shopSubTab: 'buy',
          autoRepeatSession: null,
          autoRepeatToast: null,
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

        set({
          pilot: withStarter,
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
          skillId
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
          skillId
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

      buyOpeningCardAction: (cardId) => {
        const state = get();
        const res = buyOpeningCard(state.pilot, cardId);
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
        const currentSimple =
          gear.tactics.simple ??
          createDefaultSimpleTactics(gear.classId, gear.equippedSkillBar);
        const nextSimple: SimpleTacticsConfig = {
          ...currentSimple,
          ...patch,
        };
        const generated = generateTacticsFromSimple(
          gear.classId,
          nextSimple,
          gear.equippedSkillBar,
          gear.tactics.safety
        );
        soundFx.playClick();
        get().setActiveGearTactics(generated);
      },

      applySimpleTacticsPreset: (presetId) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const presetSimple = createSimplePresetConfig(
          presetId,
          gear.classId,
          gear.equippedSkillBar
        );
        const generated = generateTacticsFromSimple(
          gear.classId,
          presetSimple,
          gear.equippedSkillBar,
          gear.tactics.safety
        );
        soundFx.playConfirm();
        get().setActiveGearTactics(generated);
      },

      resetTacticsToSimple: () => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
        const baseSimple =
          gear.tactics.simple ??
          createDefaultSimpleTactics(gear.classId, gear.equippedSkillBar);
        const generated = generateTacticsFromSimple(
          gear.classId,
          baseSimple,
          gear.equippedSkillBar,
          gear.tactics.safety
        );
        soundFx.playConfirm();
        get().setActiveGearTactics(generated);
      },

      loadTacticsPreset: (presetId) => {
        const state = get();
        const id = state.pilot.activeGearId;
        const gear = state.pilot.gears[id];
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
            createDefaultSimpleTactics(gear.classId, gear.equippedSkillBar),
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

      startAutoRepeat: (limit, sectorId) => {
        const state = get();
        const chosenLimit = limit ?? state.autoRepeatLimit;
        const chosenSector =
          sectorId ?? state.battle?.sectorId ?? state.selectedSectorId;
        const streakLimit = clampDefeatStreakLimit(
          state.autoRepeatDefeatStreakLimit
        );

        if (state.pilot.inventory.length >= BALANCE_CONFIG.maxInventorySize) {
          set({
            autoRepeatLimit: chosenLimit,
            autoRepeatToast: null,
            autoRepeatSession: {
              active: false,
              limit: chosenLimit,
              sectorId: chosenSector,
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

        soundFx.playConfirm();
        set({
          autoRepeatLimit: chosenLimit,
          autoBattleEnabled: true,
          autoRepeatToast: null,
          autoRepeatSession: {
            active: true,
            limit: chosenLimit,
            sectorId: chosenSector,
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
          get().startBattle(chosenSector);
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

      selectSector: (sectorId) => {
        const state = get();
        if (!state.pilot.unlockedSectorIds.includes(sectorId)) return;
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

      advanceMonth: () => {
        const state = get();
        const summary = advanceCampaignMonth(state.pilot);
        soundFx.playConfirm();
        const activeGear = summary.pilot.gears[summary.pilot.activeGearId];
        const nextShopStock = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? generateCategorizedShopStock(
              activeGear.level,
              buildShopOptionsFromState(summary.pilot, state.adminConfig)
            )
          : state.shopStock;
        const nextWpOffers = SHOP_STOCK_CONFIG.restockOnMonthAdvance
          ? generateWpMarketOffers({
              shipyardBonus: hasOperationalShipyard(summary.pilot),
            })
          : state.wpMarketOffers;
        set({
          pilot: summary.pilot,
          shopStock: nextShopStock,
          wpMarketOffers: nextWpOffers,
          battlesUntilRestock: SHOP_STOCK_CONFIG.restockEveryNBattles,
          hasSaveData: true,
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
        const remaining: ItemInstance[] = [];
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
          quickSellUndo: {
            soldItems,
            totalCredits: creditsEarned,
            soldAt: Date.now(),
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
          BALANCE_CONFIG.maxInventorySize
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
        const existingIds = new Set(
          state.pilot.inventory.map((i) => i.instanceId)
        );
        const toRestore = undo.soldItems.filter(
          (i) => !existingIds.has(i.instanceId)
        );
        soundFx.playClick();
        set({
          pilot: {
            ...state.pilot,
            credits: Math.max(0, state.pilot.credits - undo.totalCredits),
            inventory: [...toRestore, ...state.pilot.inventory],
          },
          quickSellUndo: null,
          hasSaveData: true,
        });
        return { ok: true, restoredCount: toRestore.length };
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
          battlesUntilRestock: SHOP_STOCK_CONFIG.restockEveryNBattles,
          hasSaveData: true,
        });
        return { ok: true, cost };
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

        const nextOffers = state.wpMarketOffers.map((o, i) =>
          i === idx ? { ...o, soldOut: true } : o
        );

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
          }),
          hasSaveData: true,
        });
        return { ok: true, cost };
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
          const battles =
            entry.battlesCount ?? SHOP_STOCK_CONFIG.wpOffers.expBoost.battlesCount;
          soundFx.playConfirm();
          set({
            pilot: {
              ...state.pilot,
              consumables: nextConsumables,
              activeExpBoostBattles:
                (state.pilot.activeExpBoostBattles ?? 0) + battles,
            },
            hasSaveData: true,
          });
          return { ok: true, kind: entry.kind };
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

      startBattle: (sectorId) => {
        const state = get();
        if (isBattleActive(state)) return;
        launchBattleForSector(state, set, sectorId);
      },

      reloadBattle: (sectorId) => {
        launchBattleForSector(get(), set, sectorId);
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

      performPlayerAction: (action, skillId) => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary || battle.isResolving) return;

        const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
        const activeUnit = battle.units.find((u) => u.id === activeUnitId);
        if (!activeUnit || !activeUnit.isPlayer || !activeUnit.alive) return;

        const skipVisualFx = state.skipAnimations;
        const muteSound = state.skipAnimations || state.battleSpeed >= 10;

        // Route single_ally skills to selectedAllyTargetId; offensive actions to selectedTargetId
        const skillDef = skillId ? getSkillById(skillId) : undefined;
        const resolvedTargetId =
          action === 'skill' && skillDef?.targetType === 'single_ally'
            ? battle.selectedAllyTargetId ?? activeUnit.id
            : battle.selectedTargetId;

        const resolution = resolveUnitAction(
          battle.units,
          activeUnit.id,
          action,
          resolvedTargetId,
          battle.round,
          state.adminConfig,
          Math.random,
          skillId
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
        const nextLog = [...battle.log, ...enrichedLogs];
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
              battle,
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
          battle.turnOrder,
          battle.activeTurnIndex,
          resolution.updatedUnits
        );
        const { nextIndex, wrappedRound } = findNextAliveTurnIndex(
          reconciledOrder,
          resolution.updatedUnits,
          battle.activeTurnIndex
        );

        let nextTurnOrder = reconciledOrder;
        let finalTurnIndex = nextIndex;
        const nextRound = wrappedRound ? battle.round + 1 : battle.round;
        let nextSnapshots = appendRoundSnapshot(
          battle.roundSnapshots,
          battle.round,
          resolution.updatedUnits
        );
        if (wrappedRound) {
          nextTurnOrder = sortTurnOrder(resolution.updatedUnits);
          const firstAliveIdx = nextTurnOrder.findIndex((id) =>
            resolution.updatedUnits.some((u) => u.id === id && u.alive)
          );
          finalTurnIndex = Math.max(0, firstAliveIdx);
          nextSnapshots = appendRoundSnapshot(
            nextSnapshots,
            nextRound,
            resolution.updatedUnits
          );
        }

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

        set({
          battle: {
            ...battle,
            units: resolution.updatedUnits,
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
            autoStopNotice: null,
            isResolving: false,
          },
        });
      },

      performAutoPlayerTurn: () => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary || battle.isResolving || !state.autoBattleEnabled) {
          return;
        }

        const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
        const activeUnit = battle.units.find((u) => u.id === activeUnitId);
        if (!activeUnit || !activeUnit.isPlayer || !activeUnit.alive) return;

        const deployedGear = state.pilot.gears[battle.deployedGearId];
        const tactics = deployedGear.tactics;

        // 1. Evaluate Safety Stops before executing Auto turn
        const safetyEval = evaluateAutoSafety(battle, activeUnit, tactics.safety);
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

        // 2. Evaluate pure Tactics engine (top-to-bottom priority)
        const choice = chooseAction(battle, activeUnit, tactics, Math.random);
        const autoRuleNumber =
          choice.matchedRuleIndex !== null ? choice.matchedRuleIndex + 1 : 0;

        const skipVisualFx = state.skipAnimations;
        const muteSound = state.skipAnimations || state.battleSpeed >= 10;
        const resolution = resolveUnitAction(
          battle.units,
          activeUnit.id,
          choice.action,
          choice.targetId,
          battle.round,
          state.adminConfig,
          Math.random,
          choice.skillId
        );
        playCue(resolution.soundCue, muteSound);

        const targetedEnemy =
          choice.targetId &&
          battle.units.some((u) => u.id === choice.targetId && u.side === 'enemy')
            ? choice.targetId
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
        const nextLog = [...battle.log, ...enrichedLogs];
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
              battle,
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

        let nextTurnOrder = reconciledOrder;
        let finalTurnIndex = nextIndex;
        const nextRound = wrappedRound ? battle.round + 1 : battle.round;
        let nextSnapshots = appendRoundSnapshot(
          battle.roundSnapshots,
          battle.round,
          resolution.updatedUnits
        );
        if (wrappedRound) {
          nextTurnOrder = sortTurnOrder(resolution.updatedUnits);
          const firstAliveIdx = nextTurnOrder.findIndex((id) =>
            resolution.updatedUnits.some((u) => u.id === id && u.alive)
          );
          finalTurnIndex = Math.max(0, firstAliveIdx);
          nextSnapshots = appendRoundSnapshot(
            nextSnapshots,
            nextRound,
            resolution.updatedUnits
          );
        }

        const currentTargetStillAlive = aliveEnemies.some(
          (e) => e.id === (targetedEnemy ?? battle.selectedTargetId)
        );
        const currentAllyStillAlive = aliveAllies.some(
          (a) => a.id === battle.selectedAllyTargetId
        );

        set({
          battle: {
            ...battle,
            units: resolution.updatedUnits,
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
            autoStopNotice: null,
            isResolving: false,
          },
        });
      },

      performAiTurn: () => {
        const state = get();
        const { battle } = state;
        if (!battle || battle.summary) return;

        const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
        const activeUnit = battle.units.find((u) => u.id === activeUnitId);

        if (!activeUnit || !activeUnit.alive) {
          const { nextIndex, wrappedRound } = findNextAliveTurnIndex(
            battle.turnOrder,
            battle.units,
            battle.activeTurnIndex
          );
          let nextTurnOrder = battle.turnOrder;
          let finalTurnIndex = nextIndex;
          if (wrappedRound) {
            nextTurnOrder = sortTurnOrder(battle.units);
            finalTurnIndex = Math.max(
              0,
              nextTurnOrder.findIndex((id) =>
                battle.units.some((u) => u.id === id && u.alive)
              )
            );
          }
          set({
            battle: {
              ...battle,
              turnOrder: nextTurnOrder,
              activeTurnIndex: finalTurnIndex,
              round: wrappedRound ? battle.round + 1 : battle.round,
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
        const decision = playerIsCharging
          ? {
              action: 'attack' as ActionType,
              targetId: battle.selectedTargetId,
              skillId: undefined,
            }
          : chooseAiDecision(activeUnit, battle.units);

        const resolution = resolveUnitAction(
          battle.units,
          activeUnit.id,
          decision.action,
          decision.targetId,
          battle.round,
          state.adminConfig,
          Math.random,
          decision.skillId
        );
        playCue(resolution.soundCue, muteSound);

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
        const nextLog = [...battle.log, ...enrichedLogs];
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
              battle,
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
          battle.turnOrder,
          battle.activeTurnIndex,
          resolution.updatedUnits
        );
        const { nextIndex, wrappedRound } = findNextAliveTurnIndex(
          reconciledOrder,
          resolution.updatedUnits,
          battle.activeTurnIndex
        );

        let nextTurnOrder = reconciledOrder;
        let finalTurnIndex = nextIndex;
        const nextRound = wrappedRound ? battle.round + 1 : battle.round;
        let nextSnapshots = appendRoundSnapshot(
          battle.roundSnapshots,
          battle.round,
          resolution.updatedUnits
        );
        if (wrappedRound) {
          nextTurnOrder = sortTurnOrder(resolution.updatedUnits);
          const firstAliveIdx = nextTurnOrder.findIndex((id) =>
            resolution.updatedUnits.some((u) => u.id === id && u.alive)
          );
          finalTurnIndex = Math.max(0, firstAliveIdx);
          nextSnapshots = appendRoundSnapshot(
            nextSnapshots,
            nextRound,
            resolution.updatedUnits
          );
        }

        // Occasional AI wingman radio callout (~28% chance when animations are enabled)
        let nextWingmanChat = battle.wingmanChat ?? null;
        if (
          !skipVisualFx &&
          activeUnit.side === 'ally' &&
          !activeUnit.isPlayer &&
          Math.random() < 0.28
        ) {
          const textKey =
            WINGMAN_CHAT_KEYS[
              Math.floor(Math.random() * WINGMAN_CHAT_KEYS.length)
            ];
          nextWingmanChat = {
            id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            unitId: activeUnit.id,
            unitName: activeUnit.name,
            textKey,
          };
        }

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

        set({
          battle: {
            ...battle,
            units: resolution.updatedUnits,
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
              ? battle.selectedTargetId
              : validFrontEnemies[0]?.id ?? aliveEnemies[0]?.id ?? null,
            selectedAllyTargetId: currentAllyStillAlive
              ? battle.selectedAllyTargetId
              : aliveAllies[0]?.id ?? null,
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
          Math.min(BALANCE_CONFIG.maxLevel, Math.floor(level) || 1)
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
        const rarities: ItemRarity[] = ['common', 'rare', 'epic', 'legendary'];
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
                Math.min(BALANCE_CONFIG.maxLevel, activeGear.level + (i % 5) - 2)
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
        set({
          shopStock: generateCategorizedShopStock(
            activeGear.level,
            buildShopOptionsFromState(state.pilot, state.adminConfig)
          ),
          wpMarketOffers: generateWpMarketOffers({
            shipyardBonus: hasOperationalShipyard(state.pilot),
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
        const allowed = getSkillsForClass(id);
        const nextLevels: Record<string, number> = { ...gear.skillLevels };
        const targetLv = maxLevel ? BALANCE_CONFIG.skillMaxLevel : 1;
        for (const sk of allowed) {
          nextLevels[sk.id] = Math.max(nextLevels[sk.id] ?? 0, targetLv);
        }
        const activeBar = [...gear.equippedSkillBar];
        for (const sk of allowed) {
          if (sk.category !== 'passive' && !activeBar.includes(sk.id) && activeBar.length < 6) {
            activeBar.push(sk.id);
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
            ownedOpeningCards: OPENING_CARDS_LIST.map((c) => c.id),
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
        const hostileSource =
          SECTORS_CATALOG.find(
            (s) => state.pilot.baseStates[s.id]?.faction === 'hostile'
          )?.id ?? SECTORS_CATALOG[SECTORS_CATALOG.length - 1].id;
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
          }
          return {
            pilot: nextPilot,
            hasSaveData: true,
          };
        });
      },

      adminUnlockAllSectors: () => {
        set((state) => ({
          pilot: {
            ...state.pilot,
            unlockedSectorIds: SECTORS_CATALOG.map((s) => s.id),
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
          const nextAdminConfig: AdminConfig = {
            ...state.adminConfig,
            ...patch,
            formation: nextFormation,
            autoEquip: nextAutoEquip,
            starterSet: nextStarterSet,
            statusDisplayDefaults: nextStatusDefaults,
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
          if (
            typeof state.selectedSectorId !== 'string' ||
            !SECTORS_CATALOG.some((s) => s.id === state.selectedSectorId)
          ) {
            state.selectedSectorId = SECTORS_CATALOG[0].id;
          }
          if (!state.adminConfig || typeof state.adminConfig !== 'object') {
            state.adminConfig = createDefaultAdminConfig();
          } else {
            const rawAdmin = state.adminConfig as unknown as Record<
              string,
              unknown
            >;
            const sanitizedFormation = sanitizeFormationConfig(rawAdmin);
            state.adminConfig = {
              ...createDefaultAdminConfig(),
              ...state.adminConfig,
              formation: sanitizedFormation,
              autoEquip: sanitizeAutoEquipConfig(rawAdmin.autoEquip),
              starterSet: sanitizeStarterSetConfig(rawAdmin.starterSet),
              statusDisplayDefaults: sanitizeStatusDisplayDefaults(
                rawAdmin.statusDisplayDefaults
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
          if (state.pilot && typeof state.pilot === 'object') {
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
          if (
            !Array.isArray(state.wpMarketOffers) ||
            state.wpMarketOffers.length === 0
          ) {
            state.wpMarketOffers = generateWpMarketOffers({
              shipyardBonus: hasOperationalShipyard(state.pilot),
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
          soundFx.setMuted(state.muted);
        }
      },
    }
  )
);
