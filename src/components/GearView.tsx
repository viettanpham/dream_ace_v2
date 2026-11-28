import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  HelpCircle,
  Lock,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Unlock,
  Wand2,
  X,
} from 'lucide-react';
import { sanitizeAutoEquipConfig } from '../data/autoEquipConfig';
import { sanitizeMaxLevel } from '../data/balance';
import {
  EMPTY_STAT_BLOCK,
  MECH_CLASSES,
  MECH_CLASS_LIST,
  STAT_KEYS,
} from '../data/classes';
import { getSupplyTemplateById } from '../data/consumables';
import { getCatalogRow } from '../data/iconCatalog';
import {
  ENCHANT_CONFIG,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_META,
  ITEM_SLOTS,
  RARITY_META,
  SHOP_CONFIG,
} from '../data/items';
import {
  getEffectiveItemStats,
  getEnchantMetadata,
  getGearEquippedInstances,
  getItemEquippedByGear,
  getSellPrice,
  simulateGearEquipChange,
  sumGearEquipmentStats,
  sumGearSpecialTraits,
  validateEquipOnGear,
} from '../engine/equipment';
import { computeSupplyPrice } from '../engine/itemPrice';
import {
  countActiveInventoryFilters,
  filterAndSortInventory,
  type InventoryEntryView,
} from '../engine/inventory';
import { sanitizeNoticeDurationSec } from '../engine/migration';
import {
  applyPilotBuffsToPassives,
  getGearPassiveBonuses,
} from '../engine/skills';
import {
  calculateDerivedStats,
  calculateEffectiveStats,
  calculateGearPowerRating,
} from '../engine/stats';
import { sanitizeSupplyLoadoutSlots } from '../engine/supplies';
import {
  formatEquipValidationReason,
  formatItemTraitsList,
  getClassCode,
  getClassName,
  getClassRole,
  getItemInstanceDesc,
  getItemInstanceName,
  getRarityLabel,
  getSlotLabel,
  getSlotShort,
  getStatShort,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  AutoEquipPlan,
  ConsumableItem,
  EnchantAttemptResult,
  EquipmentSlot,
  InventorySlotFilter,
  InventorySortKey,
  ItemInstance,
  ItemRarity,
  PaperDollSlot,
  StatBlock,
  SupplyTemplate,
} from '../types/game';
import { soundFx } from '../utils/sound';
import { AutoEquipModal } from './AutoEquipModal';
import { Notice } from './Notice';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { FighterSvg } from './FighterSvg';
import { ClassIcon, ConsumableIcon, SlotIcon } from './GameIcons';
import {
  GearSlotTile,
  isEquipmentSlotKey,
  PAPER_DOLL_LEFT_SLOTS,
  PAPER_DOLL_RIGHT_SLOTS,
  type GearPaperDollSlotKey,
} from './GearSlotTile';
import { GearSwapPicker } from './GearSwapPicker';
import { GearSocketRow, ModuleSocketList } from './ModuleSocketList';
import { QuickSellModal } from './QuickSellModal';
import {
  formatSupplyEffectSummary,
  getSupplyName,
  SupplyLoadoutBar,
} from './SupplyLoadoutBar';
import { SupplyTradeConfirm } from './SupplyTradeConfirm';

type GearSelection =
  | { kind: 'slot'; slot: PaperDollSlot }
  | { kind: 'inventory'; instanceId: string }
  | null;

const RARITY_OPTIONS: ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];
const TIER_OPTIONS = [1, 2, 3, 4] as const;
const SORT_OPTIONS: InventorySortKey[] = [
  'newest',
  'level',
  'rarity',
  'tier',
  'rollQuality',
  'sellValue',
  'powerScore',
  'name',
];

const CARD_HEIGHT = 128;
const GRID_GAP = 8;
const ROW_STRIDE = CARD_HEIGHT + GRID_GAP;

function getUnusableReasonShort(
  lang: 'en' | 'vi',
  item: ItemInstance,
  gearLevel: number,
  gearClassId: string,
  t: ReturnType<typeof useI18n>['t']
): string {
  const parts: string[] = [];
  if (item.classRestriction && item.classRestriction !== gearClassId) {
    parts.push(
      t('inv.unusableClassShort', {
        className: getClassName(lang, item.classRestriction),
      })
    );
  }
  if (gearLevel < item.requiredLevel) {
    parts.push(t('inv.unusableLevelShort', { level: item.requiredLevel }));
  }
  return parts.join(' · ');
}

export function GearView() {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const currentMaxLevel = sanitizeMaxLevel(adminConfig?.maxLevel);
  const filterState = useGameStore((s) => s.inventoryFilterState);
  const quickSellUndo = useGameStore((s) => s.quickSellUndo);
  const autoEquipUndo = useGameStore((s) => s.autoEquipUndo);

  const selectActiveGear = useGameStore((s) => s.selectActiveGear);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipSlot = useGameStore((s) => s.unequipSlot);
  const unequipInstanceEverywhere = useGameStore(
    (s) => s.unequipInstanceEverywhere
  );
  const enchantEquippedSlot = useGameStore((s) => s.enchantEquippedSlot);
  const setActiveTab = useGameStore((s) => s.setActiveTab);

  const setInventoryFilterState = useGameStore(
    (s) => s.setInventoryFilterState
  );
  const resetInventoryFilterState = useGameStore(
    (s) => s.resetInventoryFilterState
  );
  const toggleItemLock = useGameStore((s) => s.toggleItemLock);
  const toggleItemFavorite = useGameStore((s) => s.toggleItemFavorite);
  const markItemSeen = useGameStore((s) => s.markItemSeen);
  const bulkSetItemLock = useGameStore((s) => s.bulkSetItemLock);
  const bulkSellItems = useGameStore((s) => s.bulkSellItems);
  const sellItem = useGameStore((s) => s.sellItem);
  const undoQuickSell = useGameStore((s) => s.undoQuickSell);
  const clearQuickSellUndo = useGameStore((s) => s.clearQuickSellUndo);
  const previewAutoEquip = useGameStore((s) => s.previewAutoEquip);
  const applyAutoEquip = useGameStore((s) => s.applyAutoEquip);
  const undoAutoEquip = useGameStore((s) => s.undoAutoEquip);
  const clearAutoEquipUndo = useGameStore((s) => s.clearAutoEquipUndo);
  const useConsumable = useGameStore((s) => s.useConsumable);
  const setSupplyLoadout = useGameStore((s) => s.setSupplyLoadout);
  const sellSupply = useGameStore((s) => s.sellSupply);
  const [pendingSellSupply, setPendingSellSupply] =
    useState<SupplyTemplate | null>(null);

  const [selection, setSelection] = useState<GearSelection>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileStatsExpanded, setMobileStatsExpanded] = useState(false);
  const [desktopStatsExpanded, setDesktopStatsExpanded] = useState(false);
  const [confirmingUnequipSlot, setConfirmingUnequipSlot] =
    useState<PaperDollSlot | null>(null);
  const [confirmingSellId, setConfirmingSellId] = useState<string | null>(null);
  const [enchantFeedback, setEnchantFeedback] =
    useState<EnchantAttemptResult | null>(null);

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkRare, setConfirmBulkRare] = useState(false);
  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [swapPickerSlot, setSwapPickerSlot] = useState<PaperDollSlot | null>(null);
  const [swapPickerSocketIndex, setSwapPickerSocketIndex] = useState<number | null>(null);
  const [autoEquipPlan, setAutoEquipPlan] = useState<AutoEquipPlan | null>(
    null
  );
  type ActiveGearBanner =
    | { id: number; kind: 'quicksell' }
    | { id: number; kind: 'autoequip' }
    | { id: number; kind: 'notice'; text: string };

  const [activeBanner, setActiveBanner] = useState<ActiveGearBanner | null>(() => {
    if (quickSellUndo) return { id: 1, kind: 'quicksell' };
    if (autoEquipUndo) return { id: 1, kind: 'autoequip' };
    return null;
  });
  const bannerSeqRef = useRef(2);
  const prevQuickSellUndoRef = useRef(quickSellUndo);
  const prevAutoEquipUndoRef = useRef(autoEquipUndo);

  // Virtualized grid measurement state
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [gridMetrics, setGridMetrics] = useState({
    width: 640,
    height: 384,
    scrollTop: 0,
  });

  const activeGear = pilot.gears[pilot.activeGearId];
  const activeClass = MECH_CLASSES[activeGear.classId];
  const ownedGears = MECH_CLASS_LIST.filter((c) => pilot.gears[c.id].owned);

  const setInventoryNotice = useCallback((text: string | null) => {
    if (!text) {
      setActiveBanner(null);
      return;
    }
    setActiveBanner({
      id: bannerSeqRef.current++,
      kind: 'notice',
      text,
    });
  }, []);

  useEffect(() => {
    if (quickSellUndo && quickSellUndo !== prevQuickSellUndoRef.current) {
      setActiveBanner({ id: bannerSeqRef.current++, kind: 'quicksell' });
    } else if (!quickSellUndo && prevQuickSellUndoRef.current) {
      setActiveBanner((prev) => (prev?.kind === 'quicksell' ? null : prev));
    }
    prevQuickSellUndoRef.current = quickSellUndo;
  }, [quickSellUndo]);

  useEffect(() => {
    if (autoEquipUndo && autoEquipUndo !== prevAutoEquipUndoRef.current) {
      setActiveBanner({ id: bannerSeqRef.current++, kind: 'autoequip' });
    } else if (!autoEquipUndo && prevAutoEquipUndoRef.current) {
      setActiveBanner((prev) => (prev?.kind === 'autoequip' ? null : prev));
    }
    prevAutoEquipUndoRef.current = autoEquipUndo;
  }, [autoEquipUndo]);

  // Measure virtualized grid container
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const syncSize = () => {
      setGridMetrics((prev) => ({
        ...prev,
        width: el.clientWidth || prev.width,
        height: el.clientHeight || prev.height,
      }));
    };
    syncSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncSize);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', syncSize);
    return () => window.removeEventListener('resize', syncSize);
  }, [filterState.slot]);

  const equippedMap = useMemo(
    () => getGearEquippedInstances(activeGear, pilot.inventory),
    [activeGear, pilot.inventory]
  );

  const selectedInventoryInstance =
    selection?.kind === 'inventory'
      ? pilot.inventory.find((i) => i.instanceId === selection.instanceId) ??
        null
      : null;

  const selectedSlotInstance =
    selection?.kind === 'slot' ? equippedMap[selection.slot] : null;

  const previewGear = useMemo(() => {
    if (selectedInventoryInstance) {
      const equippedOwner = getItemEquippedByGear(
        pilot.gears,
        selectedInventoryInstance.instanceId
      );
      if (equippedOwner !== activeGear.classId) {
        return simulateGearEquipChange(activeGear, {
          type: 'equip',
          instance: selectedInventoryInstance,
        });
      }
    }
    if (confirmingUnequipSlot && equippedMap[confirmingUnequipSlot]) {
      return simulateGearEquipChange(activeGear, {
        type: 'unequip',
        slot: confirmingUnequipSlot,
      });
    }
    return activeGear;
  }, [
    activeGear,
    pilot.gears,
    selectedInventoryInstance,
    confirmingUnequipSlot,
    equippedMap,
  ]);

  const currentEquipBonuses = useMemo(
    () =>
      sumGearEquipmentStats(
        activeGear,
        pilot.inventory,
        adminConfig,
        pilot.warehouse
      ),
    [activeGear, pilot.inventory, adminConfig, pilot.warehouse]
  );
  const currentEquipTraits = useMemo(
    () =>
      sumGearSpecialTraits(
        activeGear,
        pilot.inventory,
        adminConfig,
        pilot.warehouse
      ),
    [activeGear, pilot.inventory, adminConfig, pilot.warehouse]
  );

  const previewEquipBonuses = useMemo(
    () =>
      sumGearEquipmentStats(
        previewGear,
        pilot.inventory,
        adminConfig,
        pilot.warehouse
      ),
    [previewGear, pilot.inventory, adminConfig, pilot.warehouse]
  );
  const previewEquipTraits = useMemo(
    () =>
      sumGearSpecialTraits(
        previewGear,
        pilot.inventory,
        adminConfig,
        pilot.warehouse
      ),
    [previewGear, pilot.inventory, adminConfig, pilot.warehouse]
  );

  const passiveBonuses = useMemo(
    () =>
      applyPilotBuffsToPassives(
        getGearPassiveBonuses(activeGear, adminConfig),
        pilot.activeBuffs,
        adminConfig
      ),
    [activeGear, pilot.activeBuffs, adminConfig]
  );

  const currentStats = useMemo(
    () =>
      calculateEffectiveStats(
        activeGear.classId,
        activeGear.level,
        activeGear.allocatedPoints,
        EMPTY_STAT_BLOCK,
        currentEquipBonuses,
        currentEquipTraits,
        passiveBonuses
      ),
    [activeGear, currentEquipBonuses, currentEquipTraits, passiveBonuses]
  );

  const previewStats = useMemo(
    () =>
      calculateEffectiveStats(
        activeGear.classId,
        activeGear.level,
        activeGear.allocatedPoints,
        EMPTY_STAT_BLOCK,
        previewEquipBonuses,
        previewEquipTraits,
        passiveBonuses
      ),
    [activeGear, previewEquipBonuses, previewEquipTraits, passiveBonuses]
  );

  const currentDerived = useMemo(
    () =>
      calculateDerivedStats(
        activeGear.classId,
        activeGear.level,
        currentStats,
        currentEquipTraits,
        passiveBonuses
      ),
    [activeGear, currentStats, currentEquipTraits, passiveBonuses]
  );

  const previewDerived = useMemo(
    () =>
      calculateDerivedStats(
        activeGear.classId,
        activeGear.level,
        previewStats,
        previewEquipTraits,
        passiveBonuses
      ),
    [activeGear, previewStats, previewEquipTraits, passiveBonuses]
  );

  const powerRating = useMemo(
    () =>
      calculateGearPowerRating(
        activeGear,
        pilot.inventory,
        adminConfig,
        pilot.warehouse,
        pilot.activeBuffs
      ),
    [activeGear, pilot.inventory, adminConfig, pilot.warehouse, pilot.activeBuffs]
  );

  const statDeltas: StatBlock = useMemo(() => {
    const d = { ...EMPTY_STAT_BLOCK };
    for (const k of STAT_KEYS) {
      d[k] = previewStats[k] - currentStats[k];
    }
    return d;
  }, [previewStats, currentStats]);

  const isPreviewActive =
    (Boolean(selectedInventoryInstance) &&
      getItemEquippedByGear(
        pilot.gears,
        selectedInventoryInstance?.instanceId ?? ''
      ) !== activeGear.classId) ||
    Boolean(confirmingUnequipSlot);

  // Per-slot counts across entire inventory
  const slotCounts = useMemo(() => {
    const counts = {} as Record<EquipmentSlot, number>;
    for (const slot of ITEM_SLOTS) {
      counts[slot] = 0;
    }
    for (const inst of pilot.inventory) {
      counts[inst.slot] += 1;
    }
    return counts;
  }, [pilot.inventory]);

  const consumablesList = pilot.consumables ?? [];
  const totalConsumablesQty = useMemo(
    () => consumablesList.reduce((sum, c) => sum + c.quantity, 0),
    [consumablesList]
  );

  const activeFilterCount = useMemo(
    () => countActiveInventoryFilters(filterState),
    [filterState]
  );

  // Engine filter & sort pipeline
  const filteredEntries = useMemo<InventoryEntryView[]>(() => {
    if (filterState.slot === 'consumables') return [];
    return filterAndSortInventory(
      pilot.inventory,
      filterState,
      activeGear,
      pilot.gears,
      (item) => getItemInstanceName(lang, item, true)
    );
  }, [pilot.inventory, filterState, activeGear, pilot.gears, lang]);

  // Prune stale multi-select IDs if inventory shrinks
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(pilot.inventory.map((i) => i.instanceId));
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [pilot.inventory]);

  // Virtualization calculations
  const cols =
    gridMetrics.width >= 680 ? 4 : gridMetrics.width >= 440 ? 3 : 2;
  const totalRows = Math.ceil(filteredEntries.length / cols);
  const totalGridHeight =
    totalRows > 0 ? totalRows * ROW_STRIDE - GRID_GAP : 0;
  const startRow = Math.max(
    0,
    Math.floor(gridMetrics.scrollTop / ROW_STRIDE) - 2
  );
  const visibleRowCount =
    Math.ceil(gridMetrics.height / ROW_STRIDE) + 4;
  const endRow = Math.min(totalRows, startRow + visibleRowCount);
  const visibleEntries = filteredEntries.slice(
    startRow * cols,
    endRow * cols
  );

  const handleSelectSlot = (slot: PaperDollSlot) => {
    soundFx.playClick();
    setEnchantFeedback(null);
    setConfirmingUnequipSlot(null);
    setConfirmingSellId(null);
    setSelection({ kind: 'slot', slot });
    setMobileDetailOpen(true);
    if (!equippedMap[slot]) {
      setInventoryFilterState({ slot });
    }
  };

  const handleSelectInventory = (instanceId: string) => {
    soundFx.playClick();
    if (multiSelectMode) {
      setConfirmBulkRare(false);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(instanceId)) next.delete(instanceId);
        else next.add(instanceId);
        return next;
      });
      return;
    }
    markItemSeen(instanceId);
    setEnchantFeedback(null);
    setConfirmingUnequipSlot(null);
    setConfirmingSellId(null);
    setSelection((prev) => {
      const same = prev?.kind === 'inventory' && prev.instanceId === instanceId;
      if (same && window.innerWidth >= 1024) {
        return null;
      }
      return { kind: 'inventory', instanceId };
    });
    setMobileDetailOpen(true);
  };

  const handleConfirmEquip = () => {
    if (!selectedInventoryInstance) return;
    const res = equipItem(selectedInventoryInstance.instanceId);
    if (res.canEquip && selectedInventoryInstance.slot !== 'module') {
      setSelection({ kind: 'slot', slot: selectedInventoryInstance.slot });
      setConfirmingSellId(null);
    }
  };

  const handleConfirmUnequip = (slot: PaperDollSlot) => {
    unequipSlot(slot);
    setConfirmingUnequipSlot(null);
    setSelection(null);
    setMobileDetailOpen(false);
    setEnchantFeedback(null);
  };

  const handleEnchant = (slot: PaperDollSlot) => {
    const res = enchantEquippedSlot(slot);
    if (res) setEnchantFeedback(res);
  };

  const handleDetailSell = (inst: ItemInstance) => {
    if (inst.rarity !== 'common' && confirmingSellId !== inst.instanceId) {
      soundFx.playClick();
      setConfirmingSellId(inst.instanceId);
      return;
    }
    const name = getItemInstanceName(lang, inst, true);
    const res = sellItem(inst.instanceId);
    if (res.ok) {
      setConfirmingSellId(null);
      setSelection(null);
      setMobileDetailOpen(false);
      setInventoryNotice(
        t('shop.soldMsg', {
          item: name,
          price: res.creditsEarned.toLocaleString(),
        })
      );
    }
  };

  // Multi-select bulk helpers
  const selectedEntries = useMemo(
    () =>
      pilot.inventory.filter((it) => selectedIds.has(it.instanceId)),
    [pilot.inventory, selectedIds]
  );
  const bulkSellableItems = useMemo(
    () =>
      selectedEntries.filter(
        (it) =>
          !it.locked &&
          getItemEquippedByGear(pilot.gears, it.instanceId) === null
      ),
    [selectedEntries, pilot.gears]
  );
  const bulkSkippedEquippedCount = useMemo(
    () =>
      selectedEntries.filter(
        (it) => getItemEquippedByGear(pilot.gears, it.instanceId) !== null
      ).length,
    [selectedEntries, pilot.gears]
  );
  const bulkSkippedLockedCount = useMemo(
    () =>
      selectedEntries.filter(
        (it) =>
          Boolean(it.locked) &&
          getItemEquippedByGear(pilot.gears, it.instanceId) === null
      ).length,
    [selectedEntries, pilot.gears]
  );
  const bulkSkippedTotal = selectedEntries.length - bulkSellableItems.length;
  const bulkHasRareOrHigher = bulkSellableItems.some(
    (it) => it.rarity !== 'common'
  );

  const handleBulkSell = () => {
    if (bulkSellableItems.length === 0) {
      if (bulkSkippedTotal > 0) {
        setInventoryNotice(
          t('inv.bulkAllSkippedFeedback', { skipped: bulkSkippedTotal })
        );
      }
      return;
    }
    if (bulkHasRareOrHigher && !confirmBulkRare) {
      soundFx.playClick();
      setConfirmBulkRare(true);
      return;
    }
    const skippedCount = bulkSkippedTotal;
    const res = bulkSellItems(bulkSellableItems.map((i) => i.instanceId));
    setConfirmBulkRare(false);
    setSelectedIds(new Set());
    if (res.soldCount > 0) {
      setInventoryNotice(
        skippedCount > 0
          ? t('inv.bulkSoldWithSkippedFeedback', {
              count: res.soldCount,
              credits: res.creditsEarned.toLocaleString(),
              skipped: skippedCount,
            })
          : t('inv.bulkSoldFeedback', {
              count: res.soldCount,
              credits: res.creditsEarned.toLocaleString(),
            })
      );
    }
  };

  const handleUseConsumable = (c: ConsumableItem) => {
    const res = useConsumable(c.id);
    if (!res.ok) {
      setInventoryNotice(t('inv.consumableUseFailed'));
      return;
    }
    if (res.kind === 'equipment_crate' && res.openedItem) {
      setInventoryNotice(
        t('inv.consumableOpenedFeedback', {
          item: getItemInstanceName(lang, res.openedItem, true),
        })
      );
    } else if (res.kind === 'supply_crate') {
      const entries = res.openedSupplies ?? [];
      const gotParts = entries
        .filter((e) => e.qty > 0)
        .map((e) => `${getSupplyName(e.templateId, t)} x${e.qty}`);
      const lostParts = entries
        .filter((e) => (e.lost ?? 0) > 0)
        .map((e) => `${getSupplyName(e.templateId, t)} x${e.lost}`);
      if (gotParts.length === 0 && lostParts.length === 0) {
        setInventoryNotice(t('inv.consumableSupplyCrateEmpty'));
      } else {
        const base =
          gotParts.length > 0
            ? t('inv.consumableSupplyCrateFeedback', {
                items: gotParts.join(', '),
              })
            : t('inv.consumableSupplyCrateFeedback', { items: '0' });
        const lostSuffix =
          lostParts.length > 0
            ? t('inv.consumableSupplyCrateLostPart', {
                lostItems: lostParts.join(', '),
              })
            : '';
        setInventoryNotice(`${base}${lostSuffix}`);
      }
    } else if (res.kind === 'enchant_stone') {
      setInventoryNotice(
        t('inv.consumableEnchantFeedback', { pct: c.bonusPct ?? 20 })
      );
    } else if (res.kind === 'respec_token') {
      setInventoryNotice(
        t('inv.consumableRespecFeedback', {
          gear: getClassName(lang, activeGear.classId),
        })
      );
    } else if (res.kind === 'exp_boost') {
      setInventoryNotice(
        t('inv.consumableExpFeedback', { battles: c.battlesCount ?? 5 })
      );
    }
  };

  const handleAddSupplyToBag = (tpl: SupplyTemplate) => {
    const current = activeGear.supplyLoadout ?? [];
    const maxSlots = sanitizeSupplyLoadoutSlots(adminConfig.supplyLoadoutSlots);
    if (current.length >= maxSlots) {
      setInventoryNotice(t('inv.supplyBagFullNotice', { max: maxSlots }));
      return;
    }
    const res = setSupplyLoadout(activeGear.classId, [...current, tpl.id]);
    if (res.reason === 'locked') {
      setInventoryNotice(t('supply.lockedHint'));
      return;
    }
    if (res.rejected.some((r) => r.reason === 'over_slots')) {
      setInventoryNotice(t('inv.supplyBagFullNotice', { max: maxSlots }));
      return;
    }
    if (res.rejected.some((r) => r.reason === 'family_duplicate')) {
      setInventoryNotice(t('inv.supplyBagDuplicateFamilyNotice'));
      return;
    }
    if (!res.ok || res.rejected.length > 0) {
      setInventoryNotice(t('inv.consumableUseFailed'));
      return;
    }
    setInventoryNotice(
      t('inv.supplyAddedToBagNotice', { name: getSupplyName(tpl.id, t) })
    );
  };

  const toggleRarityFilter = (rarity: ItemRarity) => {
    const exists = filterState.rarities.includes(rarity);
    setInventoryFilterState({
      rarities: exists
        ? filterState.rarities.filter((r) => r !== rarity)
        : [...filterState.rarities, rarity],
    });
  };

  const toggleTierFilter = (tier: number) => {
    const exists = filterState.tiers.includes(tier);
    setInventoryFilterState({
      tiers: exists
        ? filterState.tiers.filter((x) => x !== tier)
        : [...filterState.tiers, tier],
    });
  };

  const renderConsumableText = (c: ConsumableItem) => {
    const rarityLabel = c.minRarity ? getRarityLabel(lang, c.minRarity) : '';
    const slotLabel = c.slot ? getSlotLabel(lang, c.slot) : '';
    const pct = c.bonusPct ?? 20;
    const battles = c.battlesCount ?? 5;
    return {
      name: t(`consumable.${c.kind}.name`, {
        rarity: rarityLabel,
        slot: slotLabel,
        pct,
        battles,
      }),
      desc: t(`consumable.${c.kind}.desc`, {
        rarity: rarityLabel,
        slot: slotLabel,
        pct,
        battles,
      }),
    };
  };

  const renderEnchantMessage = (fb: EnchantAttemptResult): string => {
    const inst = pilot.inventory.find((i) => i.instanceId === fb.instanceId);
    const itemName = inst ? getItemInstanceName(lang, inst) : fb.templateId;
    if (fb.code === 'max_level') {
      return t('enchant.msg.max_level', { item: itemName });
    }
    if (fb.code === 'not_enchantable') {
      return t('enchant.msg.not_enchantable', { item: itemName });
    }
    if (fb.code === 'insufficient_credits') {
      return t('enchant.msg.insufficient_credits', {
        cost: fb.creditsSpent.toLocaleString(),
      });
    }
    if (fb.code === 'success') {
      return t('enchant.msg.success', {
        item: itemName,
        level: fb.newLevel,
        pct: Math.round(fb.newLevel * ENCHANT_CONFIG.bonusPerLevel * 100),
      });
    }
    return t('enchant.msg.failed', {
      item: itemName,
      rate: fb.successRate,
      level: fb.previousLevel,
      cost: fb.creditsSpent.toLocaleString(),
    });
  };

  const curAcc = currentDerived.accuracyPct ?? 0;
  const prevAcc = previewDerived.accuracyPct ?? 0;

  const derivedMetrics: Array<{
    key: string;
    label: string;
    cur: number;
    prev: number;
    suffix?: string;
    color: string;
    title?: string;
  }> = [
    {
      key: 'hp',
      label: 'HP',
      cur: currentDerived.maxHp,
      prev: previewDerived.maxHp,
      color: 'text-emerald-400',
    },
    {
      key: 'shd',
      label: 'SHD',
      cur: currentDerived.maxShield,
      prev: previewDerived.maxShield,
      color: 'text-sky-400',
    },
    {
      key: 'sp',
      label: 'SP',
      cur: currentDerived.maxSp,
      prev: previewDerived.maxSp,
      color: 'text-amber-400',
    },
    {
      key: 'spd',
      label: 'SPD',
      cur: currentDerived.speed,
      prev: previewDerived.speed,
      color: 'text-slate-100',
    },
    {
      key: 'dodge',
      label: t('derived.dodge'),
      cur: currentDerived.dodgeChance,
      prev: previewDerived.dodgeChance,
      suffix: '%',
      color: 'text-slate-200',
    },
    {
      key: 'crit',
      label: t('derived.crit'),
      cur: currentDerived.critChance,
      prev: previewDerived.critChance,
      suffix: '%',
      color: 'text-slate-200',
    },
  ];

  if (curAcc > 0 || prevAcc > 0) {
    derivedMetrics.push({
      key: 'accuracy',
      label: t('derived.accuracy'),
      cur: curAcc,
      prev: prevAcc,
      suffix: '%',
      color: 'text-teal-300',
      title: t('derived.accuracyHint', { val: prevAcc }),
    });
  }

  const activeDetailInstance = selectedInventoryInstance ?? selectedSlotInstance;
  const activeDetailStats = activeDetailInstance
    ? getEffectiveItemStats(activeDetailInstance)
    : null;
  const activeDetailOwnerGear = activeDetailInstance
    ? getItemEquippedByGear(pilot.gears, activeDetailInstance.instanceId)
    : null;
  const activeValidation =
    selectedInventoryInstance &&
    activeDetailOwnerGear !== activeGear.classId
      ? validateEquipOnGear(selectedInventoryInstance, activeGear, pilot.gears)
      : null;
  const activeEnchantMeta =
    selectedSlotInstance && selection?.kind === 'slot'
      ? getEnchantMetadata(selectedSlotInstance)
      : null;

  const renderDetailContent = () => {
    if (!activeDetailInstance || !activeDetailStats) {
      const emptySlot = selection?.kind === 'slot' ? selection.slot : null;
      const slotLabel = emptySlot ? getSlotLabel(lang, emptySlot) : '';
      return (
        <div className="flex-1 min-h-[180px] rounded border border-slate-800/80 bg-[#080C14] p-5 flex flex-col items-center justify-center text-center space-y-2.5">
          <div className="font-display text-lg font-semibold text-slate-300">
            {emptySlot ? t('gear.emptySlotDetailTitle', { slot: slotLabel }) : t('gear.emptyDetailTitle')}
          </div>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            {emptySlot ? t('gear.emptySlotDetailDesc', { slot: slotLabel }) : t('gear.emptyDetailDesc')}
          </p>
          {emptySlot && (
            <button
              type="button"
              data-testid="detail-pick-btn"
              onClick={() => setSwapPickerSlot(emptySlot)}
              className="min-h-[40px] px-4 rounded-lg border border-emerald-500/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-bold text-emerald-200 transition-colors cursor-pointer"
            >
              {t('gear.pickBtn')}
            </button>
          )}
        </div>
      );
    }
    const sellPrice = getSellPrice(activeDetailInstance);
    const isLocked = Boolean(activeDetailInstance.locked);
    const isFavorited = Boolean(activeDetailInstance.favorited);
    const isEquippedAny = activeDetailOwnerGear !== null;
    const canSellThis = !isLocked && !isEquippedAny;
    const isConfirmingThisSell =
      confirmingSellId === activeDetailInstance.instanceId;

    return (
      <div className="flex-1 flex flex-col gap-3">
        {/* Item Header + Lock/Favorite Quick Toggles */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`font-display text-xl font-bold leading-tight ${
                  RARITY_META[activeDetailInstance.rarity].textClass
                }`}
              >
                {getItemInstanceName(lang, activeDetailInstance, true)}
              </h3>
              <span
                className={`font-mono-nums text-xs font-semibold shrink-0 pt-0.5 ${
                  activeDetailInstance.rollQuality >= 80
                    ? 'text-amber-400'
                    : activeDetailInstance.rollQuality >= 50
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {t('common.quality', {
                  pct: activeDetailInstance.rollQuality,
                })}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              {activeDetailInstance.isStarter && (
                <span
                  data-testid="detail-starter-badge"
                  className="px-1.5 py-0.5 rounded border border-cyan-500/45 bg-cyan-500/12 text-[10px] font-semibold uppercase tracking-wide text-cyan-300"
                >
                  {t('inv.starterBadge')}
                </span>
              )}
              <span>
                {getSlotLabel(lang, activeDetailInstance.slot)} ·{' '}
                {getRarityLabel(lang, activeDetailInstance.rarity)} ·{' '}
                {t('common.tier', { tier: activeDetailInstance.tier })} ·{' '}
                {t('common.levelShort')}
                {activeDetailInstance.requiredLevel}
                {' · '}
                {activeDetailInstance.classRestriction
                  ? t('common.classOnly', {
                      className: getClassName(
                        lang,
                        activeDetailInstance.classRestriction
                      ),
                    })
                  : t('common.allClasses')}
              </span>
            </div>

            {/* Protection / Favorite / Sell controls */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <button
                type="button"
                data-testid="detail-lock-btn"
                onClick={() => toggleItemLock(activeDetailInstance.instanceId)}
                className={`min-h-[36px] px-2.5 rounded border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isLocked
                    ? 'border-amber-400/70 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300'
                }`}
              >
                {isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{isLocked ? t('inv.unlockBtn') : t('inv.lockBtn')}</span>
              </button>

              <button
                type="button"
                data-testid="detail-fav-btn"
                onClick={() =>
                  toggleItemFavorite(activeDetailInstance.instanceId)
                }
                className={`min-h-[36px] px-2.5 rounded border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isFavorited
                    ? 'border-yellow-400/70 bg-yellow-500/15 text-yellow-200'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    isFavorited
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-slate-400'
                  }`}
                />
                <span>
                  {isFavorited ? t('inv.unfavoriteBtn') : t('inv.favoriteBtn')}
                </span>
              </button>

              <button
                type="button"
                data-testid="detail-sell-btn"
                disabled={!canSellThis}
                onClick={() => handleDetailSell(activeDetailInstance)}
                title={
                  isEquippedAny
                    ? t('inv.sellDisabledEquipped')
                    : isLocked
                    ? t('inv.sellDisabledLocked')
                    : undefined
                }
                className={`min-h-[36px] px-2.5 rounded border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  isConfirmingThisSell
                    ? 'border-rose-400 bg-rose-600 text-white'
                    : 'border-slate-700 bg-slate-900 hover:border-amber-400/70 hover:text-amber-200 text-slate-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  {isEquippedAny
                    ? t('inv.sellDisabledEquipped')
                    : isLocked
                    ? t('inv.sellDisabledLocked')
                    : isConfirmingThisSell
                    ? t('inv.sellConfirmRare', {
                        rarity: getRarityLabel(
                          lang,
                          activeDetailInstance.rarity
                        ),
                        credits: sellPrice.toLocaleString(),
                      })
                    : t('inv.sellForBtn', {
                        credits: sellPrice.toLocaleString(),
                      })}
                </span>
              </button>
            </div>

            {(activeDetailOwnerGear !== null || isLocked) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {activeDetailOwnerGear !== null && (
                  <span
                    data-testid="detail-equipped-badge"
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-sky-500/45 bg-sky-500/12 text-xs font-semibold text-sky-200"
                  >
                    <span>
                      {t('shop.equippedOnGear', {
                        gear: getClassName(lang, activeDetailOwnerGear),
                      })}
                    </span>
                    <button
                      type="button"
                      data-testid="detail-unequip-shortcut"
                      onClick={() => {
                        const instId = activeDetailInstance.instanceId;
                        unequipInstanceEverywhere(instId);
                        if (selection?.kind === 'slot') {
                          setSelection({ kind: 'inventory', instanceId: instId });
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-sky-500/25 hover:bg-sky-500/40 text-sky-100 font-bold cursor-pointer"
                    >
                      {t('shop.unequipShortcut')}
                    </button>
                    {activeDetailInstance.slot !== 'module' && (
                      <button
                        type="button"
                        data-testid="detail-swap-btn"
                        onClick={() =>
                          setSwapPickerSlot(activeDetailInstance.slot as PaperDollSlot)
                        }
                        className="px-2 py-0.5 rounded bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-100 font-bold cursor-pointer"
                      >
                        {t('gear.swapBtn')}
                      </button>
                    )}
                  </span>
                )}
                {isLocked && (
                  <span
                    data-testid="detail-locked-badge"
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-amber-500/45 bg-amber-500/12 text-xs font-semibold text-amber-200"
                  >
                    <Lock className="w-3 h-3 shrink-0" />
                    <span>{t('shop.lockedProtectBadge')}</span>
                  </span>
                )}
              </div>
            )}
          </div>

        {/* Action Buttons (>= 44px height) */}
        {activeDetailInstance.slot !== 'module' && (
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-800/80">
          {selection?.kind === 'inventory' &&
            activeDetailOwnerGear !== activeGear.classId && (
              <>
                <button
                  type="button"
                  disabled={!activeValidation?.canEquip}
                  onClick={handleConfirmEquip}
                  className="flex-1 min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold text-sm lg:text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {t('gear.confirmEquip', {
                      gear: getClassName(lang, activeGear.classId),
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setSelection(null);
                    setMobileDetailOpen(false);
                  }}
                  className="min-h-[44px] px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm lg:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('common.cancel')}
                </button>
              </>
            )}

          {selection?.kind === 'inventory' &&
            activeDetailOwnerGear === activeGear.classId && (
              <button
                type="button"
                onClick={() => {
                  if (activeDetailInstance.slot !== 'module') {
                    setSelection({
                      kind: 'slot',
                      slot: activeDetailInstance.slot,
                    });
                  }
                }}
                className="flex-1 min-h-[44px] px-4 rounded-lg border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-sm lg:text-xs transition-colors cursor-pointer"
              >
                {t('gear.currentlyEquipped')} · Enchant / Unequip
              </button>
            )}

          {selection?.kind === 'slot' && activeEnchantMeta && (
            <>
              {!activeEnchantMeta.isMax && (
                <button
                  type="button"
                  disabled={pilot.credits < activeEnchantMeta.cost}
                  onClick={() => handleEnchant(selection.slot)}
                  className="flex-1 min-h-[44px] px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-semibold text-sm lg:text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  {pilot.credits < activeEnchantMeta.cost
                    ? t('equip.needCredits', {
                        cost: activeEnchantMeta.cost.toLocaleString(),
                      })
                    : t('equip.enchantAction', {
                        level: activeEnchantMeta.nextLevel,
                        cost: activeEnchantMeta.cost.toLocaleString(),
                      })}
                </button>
              )}

              {confirmingUnequipSlot === selection.slot ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleConfirmUnequip(selection.slot)}
                    className="min-h-[44px] px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm lg:text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t('gear.confirmUnequip')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setConfirmingUnequipSlot(null);
                    }}
                    className="min-h-[44px] px-3.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm lg:text-xs font-medium cursor-pointer whitespace-nowrap"
                  >
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setConfirmingUnequipSlot(selection.slot);
                  }}
                  className="min-h-[44px] px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm lg:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('gear.previewUnequip')}
                </button>
              )}
            </>
          )}
        </div>
        )}

          <p className="text-sm lg:text-xs text-slate-300 leading-relaxed">
            {getItemInstanceDesc(lang, activeDetailInstance)}
          </p>

          {/* Total Effective Stats + Affixes + Traits */}
          <div className="rounded border border-slate-800/80 bg-[#080C14] p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm lg:text-xs font-mono-nums text-slate-100 font-semibold">
              {STAT_KEYS.filter((k) => activeDetailStats[k] > 0).map((k) => (
                <span key={k}>
                  +{activeDetailStats[k]} {getStatShort(lang, k)}
                </span>
              ))}
            </div>

            {activeDetailInstance.affixes.length > 0 && (
              <div className="text-xs text-sky-300/90 flex flex-wrap gap-x-2.5 gap-y-0.5 pt-1.5 border-t border-slate-800/80">
                <span className="text-slate-500">
                  {t('gear.affixesHeading')}:
                </span>
                {activeDetailInstance.affixes.map((af, idx) => (
                  <span
                    key={`${af.suffixId}_${idx}`}
                    className="font-mono-nums"
                  >
                    +{af.value} {getStatShort(lang, af.stat)}
                  </span>
                ))}
              </div>
            )}

            {formatItemTraitsList(lang, activeDetailInstance).length > 0 && (
              <div className="text-xs text-amber-300 flex flex-wrap gap-x-2.5 gap-y-0.5 pt-1.5 border-t border-slate-800/80">
                {formatItemTraitsList(lang, activeDetailInstance).map(
                  (tr, idx) => (
                    <span key={idx}>{tr}</span>
                  )
                )}
              </div>
            )}
          </div>

          {/* Live +/- Comparison Block */}
          {isPreviewActive && activeDetailInstance.slot !== 'module' && (
            <div className="rounded border border-slate-800 bg-[#080C14] p-3 space-y-1.5">
              <div className="text-xs font-semibold text-amber-300">
                {t('gear.comparisonHeading')}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm lg:text-xs font-mono-nums">
                {STAT_KEYS.filter((k) => statDeltas[k] !== 0).length > 0 ? (
                  STAT_KEYS.filter((k) => statDeltas[k] !== 0).map((k) => {
                    const delta = statDeltas[k];
                    return (
                      <span
                        key={k}
                        className={
                          delta > 0
                            ? 'text-emerald-400 font-semibold'
                            : 'text-red-400 font-semibold'
                        }
                      >
                        {getStatShort(lang, k)}{' '}
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-500">{t('gear.noStatDiff')}</span>
                )}
              </div>
            </div>
          )}

          {activeDetailInstance.slot === 'module' && (
            <ModuleSocketList moduleInstance={activeDetailInstance} />
          )}

          {/* Cannot-Equip Inline Warning */}
          {activeValidation &&
            !activeValidation.canEquip &&
            activeDetailInstance.slot !== 'module' && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Ban className="w-4 h-4 shrink-0" />
                <span>
                  {t('equip.cannotEquip', {
                    reason:
                      formatEquipValidationReason(lang, activeValidation) ?? '',
                  })}
                </span>
              </div>
              {activeValidation.equippedOnOtherGear && (
                <button
                  type="button"
                  onClick={() =>
                    unequipInstanceEverywhere(activeDetailInstance.instanceId)
                  }
                  className="shrink-0 min-h-[36px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold cursor-pointer"
                >
                  {t('gear.unequipFromOther', {
                    gear: getClassName(
                      lang,
                      activeValidation.equippedOnOtherGear
                    ),
                  })}
                </button>
              )}
            </div>
          )}

          {/* Inline Enchant Section (when inspecting an Equipped Slot) */}
          {selection?.kind === 'slot' && activeEnchantMeta && (
            <div className="rounded border border-sky-500/35 bg-[#091322] p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-sky-300">
                  {activeEnchantMeta.isMax
                    ? t('equip.enchantMaxReached')
                    : `+${activeEnchantMeta.currentLevel} → +${activeEnchantMeta.nextLevel} (+8%/lv)`}
                </span>
                {!activeEnchantMeta.isMax && (
                  <span className="font-mono-nums text-slate-300">
                    <span
                      className={
                        activeEnchantMeta.successRate >= 70
                          ? 'text-emerald-400 font-semibold'
                          : activeEnchantMeta.successRate >= 45
                          ? 'text-amber-400 font-semibold'
                          : 'text-red-400 font-semibold'
                      }
                    >
                      {activeEnchantMeta.successRate}%
                      {(pilot.activeEnchantBonusPct ?? 0) > 0 && (
                        <span className="text-purple-300 ml-1">
                          (+{pilot.activeEnchantBonusPct}%)
                        </span>
                      )}
                    </span>
                    {' · '}
                    <span>{activeEnchantMeta.cost.toLocaleString()} CR</span>
                  </span>
                )}
              </div>

              {!activeEnchantMeta.isMax && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-nums text-slate-300">
                  {STAT_KEYS.filter(
                    (k) => activeEnchantMeta.currentStats[k] > 0
                  ).map((k) => (
                    <span key={k}>
                      {getStatShort(lang, k)} +{activeEnchantMeta.currentStats[k]}{' '}
                      <span className="text-emerald-400">
                        → +{activeEnchantMeta.nextStats[k]}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {enchantFeedback && (
                <div
                  className={`text-xs px-2.5 py-2 rounded border ${
                    enchantFeedback.success
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-red-500/40 bg-red-500/10 text-red-300'
                  }`}
                >
                  {renderEnchantMessage(enchantFeedback)}
                </div>
              )}
            </div>
          )}
      </div>
    );
  };

  const renderPaperDollTile = (
    slotKey: GearPaperDollSlotKey,
    variant: 'desktop' | 'phone'
  ) => {
    if (!isEquipmentSlotKey(slotKey)) {
      const extNum = slotKey.replace('ext', '');
      const fullLabel = t('slot.extender', { n: extNum });
      const shortLabel = t('slotShort.extender', { n: extNum });
      const lockedLabel = t('slot.lockedSoon');
      return (
        <GearSlotTile
          key={`${variant}-${slotKey}`}
          slotKey={slotKey}
          label={variant === 'desktop' ? shortLabel : fullLabel}
          locked
          lockedLabel={lockedLabel}
          title={`${fullLabel} — ${lockedLabel}`}
          variant={variant}
        />
      );
    }

    const slot = slotKey;
    const slotMeta = EQUIPMENT_SLOT_META[slot];
    const inst = equippedMap[slot];
    const fullLabel = getSlotLabel(lang, slot);
    const shortLabel = getSlotShort(lang, slot);
    const itemName = inst ? getItemInstanceName(lang, inst) : undefined;
    const isSelected = selection?.kind === 'slot' && selection.slot === slot;
    const isTargetOfPreview = Boolean(
      selectedInventoryInstance &&
        selectedInventoryInstance.slot === slot &&
        getItemEquippedByGear(
          pilot.gears,
          selectedInventoryInstance.instanceId
        ) !== activeGear.classId
    );
    const isUnequipping = confirmingUnequipSlot === slot;
    const title = inst
      ? `${fullLabel}: ${itemName}${
          inst.enchantLevel > 0 ? ` (+${inst.enchantLevel})` : ''
        } · ${inst.rollQuality}%`
      : `${fullLabel}: —`;

    return (
      <GearSlotTile
        key={`${variant}-${slot}`}
        slotKey={slot}
        label={shortLabel}
        instance={inst}
        itemName={itemName}
        selected={isSelected}
        previewTarget={isTargetOfPreview}
        confirmingUnequip={isUnequipping}
        classLocked={slotMeta.classLocked}
        classOnlyTitle={t('common.classOnly', {
          className: getClassName(lang, activeGear.classId),
        })}
        starterBadgeLabel={t('inv.starterBadge')}
        title={title}
        variant={variant}
        onSelect={() => handleSelectSlot(slot)}
      />
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3.5 sm:space-y-4">
      {/* ==================== DESKTOP 2-COL: Left (Paper-Doll + Stats Bar + Inventory, 7) | Right (Sticky Detail, 5) ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        <div className="lg:col-span-7 flex flex-col gap-3.5 sm:gap-4 min-w-0">
          <section className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-3.5 flex flex-col lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center gap-2.5 xl:gap-3 relative">
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 360 280"
              className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
            >
              <circle
                cx="180"
                cy="128"
                r="88"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="5 5"
                fill="none"
              />
              <circle
                cx="180"
                cy="128"
                r="120"
                stroke="#1E293B"
                strokeWidth="1"
                fill="none"
              />
              <line
                x1="30"
                y1="128"
                x2="330"
                y2="128"
                stroke="#1E293B"
                strokeWidth="1"
              />
            </svg>

            <div
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full blur-3xl opacity-20"
              style={{ backgroundColor: activeClass.accentHex }}
            />
          </div>

          {/* Desktop Left Slot Rail (>= lg) */}
          <div
            data-testid="gear-rail-left"
            className="hidden lg:flex flex-col items-center gap-1.5 shrink-0 relative z-10"
          >
            {PAPER_DOLL_LEFT_SLOTS.map((slotKey) =>
              renderPaperDollTile(slotKey, 'desktop')
            )}
          </div>

          {/* Center Ship Showcase + Key Stats + Collapsible Full Stats + Owned Gear Selector */}
          <div className="relative z-10 w-full lg:h-full min-w-0 flex flex-col justify-between items-center gap-3">
            {/* Active Gear Level & Power Rating */}
            <div className="w-full flex items-start justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-xl font-bold tracking-wide text-slate-50 leading-none">
                    {getClassName(lang, activeGear.classId)}
                  </span>
                  <span className="font-mono-nums text-xs font-bold text-amber-400">
                    {t('common.levelShort')}
                    {activeGear.level}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {getClassCode(lang, activeGear.classId)} ·{' '}
                  {getClassRole(lang, activeGear.classId)}
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono-nums text-xs text-sky-300 font-semibold">
                  {t('common.power')}: {powerRating}
                </div>
                {activeGear.unspentPoints > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('garage')}
                    className="text-xs font-mono-nums font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer whitespace-nowrap"
                  >
                    {t('gear.allocateHint', { count: activeGear.unspentPoints })}
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Compact Showcase: Ship Left + Key Stats Right */}
            <div className="w-full flex items-center justify-center lg:py-2 gap-3">
              <FighterSvg
                classId={activeGear.classId}
                side="ally"
                facing="right"
                size="lg"
                heroHover
                className="w-32 h-32 sm:w-40 sm:h-40 lg:w-44 lg:h-44 xl:w-52 xl:h-52 shrink-0"
              />

              {/* Key stats strip shown only on < lg */}
              <div className="lg:hidden flex-1 min-w-0 grid grid-cols-2 gap-1.5 font-mono-nums">
                <div className="rounded border border-slate-800 bg-[#080C14]/90 px-2 py-1.5">
                  <div className="text-[11px] text-slate-400">HP</div>
                  <div className="text-sm font-bold text-emerald-400">
                    {currentDerived.maxHp}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#080C14]/90 px-2 py-1.5">
                  <div className="text-[11px] text-slate-400">SHD</div>
                  <div className="text-sm font-bold text-sky-400">
                    {currentDerived.maxShield}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#080C14]/90 px-2 py-1.5">
                  <div className="text-[11px] text-slate-400">ATK</div>
                  <div className="text-sm font-bold text-slate-100">
                    {currentStats.attack}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#080C14]/90 px-2 py-1.5">
                  <div className="text-[11px] text-slate-400">SPD</div>
                  <div className="text-sm font-bold text-amber-300">
                    {currentDerived.speed}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Collapsible Full Stats Toggle (< lg) */}
            <div className="lg:hidden w-full space-y-2">
              <button
                type="button"
                onClick={() => setMobileStatsExpanded((v) => !v)}
                className="w-full min-h-[44px] px-3 rounded-lg border border-slate-800 bg-[#080C14]/90 text-slate-200 text-sm font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>
                  {mobileStatsExpanded
                    ? t('mobile.hideStats')
                    : t('mobile.fullStats')}
                </span>
                {mobileStatsExpanded ? (
                  <ChevronUp className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {mobileStatsExpanded && (
                <div className="rounded-lg border border-slate-800 bg-[#080C14]/95 p-3 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 font-mono-nums">
                    {STAT_KEYS.map((key) => (
                      <div
                        key={key}
                        className="rounded border border-slate-800/80 bg-slate-950/70 px-2 py-1.5 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-400">
                          {getStatShort(lang, key)}
                        </span>
                        <span className="font-bold text-slate-100">
                          {currentStats[key]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono-nums">
                    {derivedMetrics
                      .filter((m) => m.key !== 'accuracy' || m.cur > 0)
                      .map((m) => (
                        <div
                          key={m.key}
                          data-testid={
                            m.key === 'accuracy'
                              ? 'gear-mobile-derived-accuracy'
                              : undefined
                          }
                          title={
                            m.key === 'accuracy'
                              ? t('derived.accuracyHint', { val: m.cur })
                              : m.title
                          }
                          className="rounded border border-slate-800/80 bg-slate-950/70 px-2 py-1.5"
                        >
                          <div className="text-[10px] text-slate-400 truncate">
                            {m.label}
                          </div>
                          <div className={`text-xs font-bold ${m.color}`}>
                            {m.cur}
                            {m.suffix ?? ''}
                          </div>
                        </div>
                      ))}
                  </div>
                  {currentEquipTraits.detectStealth && (
                    <div className="pt-0.5">
                      <span
                        data-testid="gear-mobile-stealth-detect-chip"
                        title={t('derived.detectStealthHint')}
                        className="inline-flex items-center gap-1 rounded border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-300"
                      >
                        <SlotIcon slot="radar" className="w-3 h-3 shrink-0" />
                        <span>{t('derived.detectStealth')}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Owned Gears Selector (with ClassIcon) */}
            <div className="w-full flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {ownedGears.map((cls) => {
                  const g = pilot.gears[cls.id];
                  const isSelected = cls.id === activeGear.classId;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => {
                        setSelection(null);
                        setMobileDetailOpen(false);
                        setConfirmingUnequipSlot(null);
                        setConfirmingSellId(null);
                        setEnchantFeedback(null);
                        selectActiveGear(cls.id);
                      }}
                      className={`min-h-[44px] lg:min-h-0 lg:h-8 px-3 lg:px-2.5 rounded border text-xs font-display font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-slate-800 border-amber-400/80 text-slate-50'
                          : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <ClassIcon classId={cls.id} className="w-3.5 h-3.5 shrink-0" />
                      <span>{getClassName(lang, cls.id)}</span>
                      <span className="font-mono-nums text-[11px] opacity-80">
                        Lv.{g.level}
                      </span>
                    </button>
                  );
                })}
              </div>

              {ownedGears.length < 4 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('garage')}
                  className="min-h-[44px] lg:min-h-0 px-2 text-xs font-medium text-amber-400 hover:text-amber-300 cursor-pointer whitespace-nowrap"
                >
                  + Garage ({ownedGears.length}/4)
                </button>
              )}
            </div>

            {/* Desktop Supply Loadout Row (>= lg) */}
            <div className="hidden lg:block w-full">
              <SupplyLoadoutBar variant="desktop" gear={activeGear} />
            </div>
          </div>

          {/* Desktop Right Slot Rail (>= lg) */}
          <div
            data-testid="gear-rail-right"
            className="hidden lg:flex flex-col items-center gap-1.5 shrink-0 relative z-10"
          >
            {PAPER_DOLL_RIGHT_SLOTS.map((slotKey) =>
              renderPaperDollTile(slotKey, 'desktop')
            )}
          </div>

          {/* Phone Two-Column 12-Slot Grid (< lg) */}
          <div
            data-testid="gear-phone-slots"
            className="lg:hidden relative z-10 w-full pt-2 border-t border-slate-800/80 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h2 className="font-display text-base font-bold tracking-wide text-slate-100">
                {t('gear.slotsHeading')}
              </h2>
              <span className="text-xs font-mono-nums text-slate-400">
                {EQUIPMENT_SLOTS.filter((s) => Boolean(equippedMap[s])).length}/{EQUIPMENT_SLOTS.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                data-testid="gear-phone-left"
                className="flex flex-col gap-1.5 min-w-0"
              >
                {PAPER_DOLL_LEFT_SLOTS.map((slotKey) =>
                  renderPaperDollTile(slotKey, 'phone')
                )}
              </div>
              <div
                data-testid="gear-phone-right"
                className="flex flex-col gap-1.5 min-w-0"
              >
                {PAPER_DOLL_RIGHT_SLOTS.map((slotKey) =>
                  renderPaperDollTile(slotKey, 'phone')
                )}
              </div>
            </div>
          </div>

          {/* Phone Supply Loadout Row (< lg) */}
          <div className="lg:hidden relative z-10 w-full pt-2 border-t border-slate-800/80">
            <SupplyLoadoutBar variant="phone" gear={activeGear} />
          </div>

          <GearSocketRow
            onSelectSocket={(idx) => {
              setSwapPickerSlot(null);
              setSwapPickerSocketIndex(idx);
            }}
          />
        </section>

        {/* Collapsible Desktop Stats Bar (>= lg) */}
        <section
          data-testid="gear-stats-bar"
          className="hidden lg:flex flex-col gap-2 rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-3.5"
        >
          <button
            type="button"
            data-testid="gear-stats-toggle"
            aria-expanded={desktopStatsExpanded}
            onClick={() => setDesktopStatsExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
                {t('gear.statsHeading')}
              </h2>
              {isPreviewActive && (
                <span className="text-[11px] font-semibold text-amber-300">+/-</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200">
              <span>{desktopStatsExpanded ? t('mobile.hideStats') : t('mobile.fullStats')}</span>
              {desktopStatsExpanded ? (
                <ChevronUp className="w-4 h-4 text-amber-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </span>
          </button>

          {!desktopStatsExpanded ? (
            <div className="flex flex-wrap items-center gap-1.5 font-mono-nums text-xs">
              {[
                { key: 'hp', label: 'HP', val: previewDerived.maxHp, delta: previewDerived.maxHp - currentDerived.maxHp, color: 'text-emerald-400', suffix: '' },
                { key: 'shd', label: 'SHD', val: previewDerived.maxShield, delta: previewDerived.maxShield - currentDerived.maxShield, color: 'text-sky-400', suffix: '' },
                { key: 'atk', label: getStatShort(lang, 'attack'), val: previewStats.attack, delta: statDeltas.attack, color: 'text-slate-100', suffix: '' },
                { key: 'def', label: getStatShort(lang, 'defense'), val: previewStats.defense, delta: statDeltas.defense, color: 'text-slate-100', suffix: '' },
                { key: 'spd', label: 'SPD', val: previewDerived.speed, delta: previewDerived.speed - currentDerived.speed, color: 'text-amber-300', suffix: '' },
                { key: 'sp', label: 'SP', val: previewDerived.maxSp, delta: previewDerived.maxSp - currentDerived.maxSp, color: 'text-amber-400', suffix: '' },
                ...(curAcc > 0 || prevAcc > 0
                  ? [{ key: 'accuracy', label: t('derived.accuracy'), val: prevAcc, delta: prevAcc - curAcc, color: 'text-teal-300', suffix: '%', title: t('derived.accuracyHint', { val: prevAcc }) }]
                  : []),
              ].map((item) => (
                <div
                  key={item.key}
                  data-testid={item.key === 'accuracy' ? 'gear-derived-accuracy' : undefined}
                  title={'title' in item ? item.title : undefined}
                  className="rounded border border-slate-800/80 bg-[#080C14] px-2 py-1 inline-flex items-baseline gap-1.5"
                >
                  <span className="text-[11px] font-semibold text-slate-400">{item.label}</span>
                  <span className={`font-bold ${item.delta > 0 ? 'text-emerald-400' : item.delta < 0 ? 'text-red-400' : item.color}`}>
                    {item.val}{item.suffix}
                  </span>
                  {item.delta !== 0 && (
                    <span className={`text-[11px] font-semibold ${item.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ({item.delta > 0 ? `+${item.delta}` : item.delta})
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-1.5 font-mono-nums">
                {STAT_KEYS.map((key) => {
                  const delta = statDeltas[key];
                  return (
                    <div key={key} className="rounded border border-slate-800/80 bg-[#080C14] px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-xs">
                      <span className="font-semibold text-slate-400">{getStatShort(lang, key)}</span>
                      <span className="inline-flex items-baseline gap-1">
                        <span className={`font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-100'}`}>
                          {previewStats[key]}
                        </span>
                        {delta !== 0 && (
                          <span className={`text-[11px] font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ({delta > 0 ? `+${delta}` : delta})
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-1.5 font-mono-nums">
                {derivedMetrics.map((m) => {
                  const diff = m.prev - m.cur;
                  return (
                    <div key={m.key} data-testid={m.key === 'accuracy' ? 'gear-derived-accuracy' : undefined} title={m.title} className="rounded border border-slate-800/80 bg-[#080C14] px-2.5 py-1.5">
                      <div className="text-[10px] text-slate-400 truncate">{m.label}</div>
                      <div className="text-xs font-bold flex items-baseline gap-1">
                        <span className={diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : m.color}>
                          {m.prev}{m.suffix ?? ''}
                        </span>
                        {diff !== 0 && (
                          <span className={`text-[10px] ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(currentEquipTraits.detectStealth || previewEquipTraits.detectStealth) && (
            <div>
              <span
                data-testid="gear-stealth-detect-chip"
                title={t('derived.detectStealthHint')}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${
                  !currentEquipTraits.detectStealth && previewEquipTraits.detectStealth
                    ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300'
                    : currentEquipTraits.detectStealth && !previewEquipTraits.detectStealth
                    ? 'border-red-500/45 bg-red-500/10 text-red-300 line-through'
                    : 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                }`}
              >
                <SlotIcon slot="radar" className="w-3 h-3 shrink-0" />
                <span>{t('derived.detectStealth')}</span>
              </span>
            </div>
          )}
        </section>

        {/* Shared Cargo Grid ("Kho đồ chung") */}
        <section className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-3.5 sm:p-4 flex flex-col gap-3 relative">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
                {t('gear.gridHeading')}
              </h2>
              <span className="font-mono-nums text-xs text-slate-400">
                {t('common.itemCount', { count: pilot.inventory.length })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="auto-equip-btn"
                onClick={() => {
                  soundFx.playClick();
                  setAutoEquipPlan(previewAutoEquip('single', activeGear.classId));
                }}
                className="min-h-[36px] px-2.5 rounded border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t('ae.btn')}</span>
              </button>

              <button
                type="button"
                data-testid="auto-equip-all-btn"
                onClick={() => {
                  soundFx.playClick();
                  setAutoEquipPlan(previewAutoEquip('all', activeGear.classId));
                }}
                className="min-h-[36px] px-2.5 rounded border border-slate-700 bg-slate-900 hover:border-sky-400/60 hover:text-sky-200 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>{t('ae.btnAll')}</span>
              </button>

              <button
                type="button"
                data-testid="open-quicksell-btn"
                onClick={() => setQuickSellOpen(true)}
                className="min-h-[36px] px-2.5 rounded border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t('qs.btn')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('shop')}
                className="min-h-[36px] px-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                {t('equip.openShop')}
              </button>
            </div>
          </div>

          {/* Shared Single-Slot Notice Banner above item grid */}
          {(() => {
            if (!activeBanner) return null;
            const durationSec = sanitizeNoticeDurationSec(
              adminConfig.noticeDurationSec
            );

            if (activeBanner.kind === 'quicksell' && quickSellUndo) {
              return (
                <Notice
                  key={activeBanner.id}
                  testId="quicksell-undo-toast"
                  tone="warning"
                  text={t('qs.undoToast', {
                    count: quickSellUndo.soldItems.length,
                    credits: quickSellUndo.totalCredits.toLocaleString(),
                  })}
                  action={{
                    label: t('qs.undoBtn'),
                    testId: 'quicksell-undo-btn',
                    onClick: () => {
                      const res = undoQuickSell();
                      if (res.ok) {
                        setInventoryNotice(
                          t('qs.undoneFeedback', { count: res.restoredCount })
                        );
                      }
                    },
                  }}
                  durationSec={durationSec}
                  onClose={() => {
                    clearQuickSellUndo();
                    setActiveBanner(null);
                  }}
                />
              );
            }

            if (activeBanner.kind === 'autoequip' && autoEquipUndo) {
              return (
                <Notice
                  key={activeBanner.id}
                  testId="autoequip-undo-toast"
                  tone="info"
                  text={t('ae.undoToast', {
                    count: autoEquipUndo.changedSlotsCount,
                  })}
                  action={{
                    label: t('ae.undoBtn'),
                    testId: 'autoequip-undo-btn',
                    onClick: () => {
                      const res = undoAutoEquip();
                      if (res.ok) {
                        setInventoryNotice(t('ae.undoneFeedback'));
                      }
                    },
                  }}
                  durationSec={durationSec}
                  onClose={() => {
                    clearAutoEquipUndo();
                    setActiveBanner(null);
                  }}
                />
              );
            }

            if (activeBanner.kind === 'notice') {
              return (
                <Notice
                  key={activeBanner.id}
                  testId="gear-inventory-notice"
                  tone="success"
                  text={activeBanner.text}
                  durationSec={durationSec}
                  onClose={() => setActiveBanner(null)}
                />
              );
            }

            return null;
          })()}

          {/* Wrapped Slot Tabs WITH Shared Icons & Per-Slot Counts (NO horizontal scrollbar) */}
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label={t('gear.gridHeading')}
          >
            <button
              type="button"
              onClick={() => setInventoryFilterState({ slot: 'all' })}
              className={`min-h-[40px] lg:min-h-[34px] px-2.5 rounded-lg lg:rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                filterState.slot === 'all'
                  ? 'bg-slate-800 text-slate-100 border border-amber-400/80'
                  : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <SlotIcon slot="all" className="w-3.5 h-3.5 shrink-0" />
              <span>{t('inv.tabAll')}</span>
              <span className="font-mono-nums text-[11px] opacity-80">
                ({pilot.inventory.length})
              </span>
            </button>

            {ITEM_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setInventoryFilterState({ slot })}
                className={`min-h-[40px] lg:min-h-[34px] px-2.5 rounded-lg lg:rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                  filterState.slot === slot
                    ? 'bg-slate-800 text-slate-100 border border-amber-400/80'
                    : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <SlotIcon slot={slot} className="w-3.5 h-3.5 shrink-0" />
                <span>{getSlotShort(lang, slot)}</span>
                <span className="font-mono-nums text-[11px] opacity-80">
                  ({slotCounts[slot]})
                </span>
              </button>
            ))}

            <button
              type="button"
              data-testid="inv-tab-consumables"
              onClick={() =>
                setInventoryFilterState({
                  slot: 'consumables' as InventorySlotFilter,
                })
              }
              className={`min-h-[40px] lg:min-h-[34px] px-2.5 rounded-lg lg:rounded text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                filterState.slot === 'consumables'
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-400/80'
                  : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <SlotIcon slot="consumables" className="w-3.5 h-3.5 shrink-0" />
              <span>{t('inv.tabConsumables')}</span>
              <span className="font-mono-nums text-[11px] opacity-80">
                ({totalConsumablesQty})
              </span>
            </button>
          </div>

          {/* Search, Filter Drawer Toggle, Sort, Multi-select & Legend Toolbar */}
          {filterState.slot !== 'consumables' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[170px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    data-testid="inv-search-input"
                    value={filterState.search}
                    onChange={(e) =>
                      setInventoryFilterState({ search: e.target.value })
                    }
                    placeholder={t('inv.searchPlaceholder')}
                    className="w-full h-9 pl-8 pr-7 rounded border border-slate-800 bg-[#080C14] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/70"
                  />
                  {filterState.search && (
                    <button
                      type="button"
                      onClick={() => setInventoryFilterState({ search: '' })}
                      aria-label={t('inv.clearSelection')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Drawer Toggle */}
                <button
                  type="button"
                  data-testid="inv-filter-toggle"
                  onClick={() => setFilterDrawerOpen((v) => !v)}
                  className={`h-9 px-2.5 rounded border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    filterDrawerOpen || activeFilterCount > 0
                      ? 'border-sky-400/70 bg-sky-500/15 text-sky-200'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{t('inv.filtersBtn')}</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 font-mono-nums text-[10px] font-bold leading-none">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Sort Dropdown + Direction */}
                <div className="flex items-center">
                  <select
                    data-testid="inv-sort-select"
                    aria-label={t('inv.sortLabel')}
                    value={filterState.sortBy}
                    onChange={(e) =>
                      setInventoryFilterState({
                        sortBy: e.target.value as InventorySortKey,
                      })
                    }
                    className="h-9 px-2 rounded-l border border-slate-800 bg-[#080C14] text-xs text-slate-200 focus:outline-none focus:border-amber-400/70"
                  >
                    {SORT_OPTIONS.map((key) => (
                      <option key={key} value={key}>
                        {t(`inv.sort.${key}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="inv-sort-dir-btn"
                    onClick={() =>
                      setInventoryFilterState({
                        sortDir: filterState.sortDir === 'desc' ? 'asc' : 'desc',
                      })
                    }
                    title={
                      filterState.sortDir === 'desc'
                        ? t('inv.sortDesc')
                        : t('inv.sortAsc')
                    }
                    aria-label={
                      filterState.sortDir === 'desc'
                        ? t('inv.sortDesc')
                        : t('inv.sortAsc')
                    }
                    className="h-9 w-9 rounded-r border border-l-0 border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    {filterState.sortDir === 'desc' ? (
                      <ArrowDownWideNarrow className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <ArrowUpNarrowWide className="w-3.5 h-3.5 text-sky-400" />
                    )}
                  </button>
                </div>

                {/* Multi-select Toggle */}
                <button
                  type="button"
                  data-testid="inv-multiselect-btn"
                  onClick={() => {
                    setMultiSelectMode((v) => !v);
                    setSelectedIds(new Set());
                    setConfirmBulkRare(false);
                  }}
                  className={`h-9 px-2.5 rounded border text-xs font-semibold cursor-pointer ${
                    multiSelectMode
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  {multiSelectMode
                    ? t('inv.multiSelectDone')
                    : t('inv.multiSelect')}
                </button>

                {/* Legend Popover Toggle */}
                <div className="relative">
                  <button
                    type="button"
                    data-testid="inv-legend-btn"
                    onClick={() => setLegendOpen((v) => !v)}
                    className={`h-9 px-2.5 rounded border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                      legendOpen
                        ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('inv.legendBtn')}</span>
                  </button>

                  {legendOpen && (
                    <div
                      data-testid="inv-legend-popover"
                      className="absolute right-0 top-11 z-30 w-72 rounded-lg border border-slate-700 bg-[#0A101B] p-3 shadow-2xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-amber-300">
                          {t('inv.legendTitle')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLegendOpen(false)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        <li className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded border-2 border-emerald-400 bg-emerald-500/20 shrink-0" />
                          <span>{t('inv.legendEquipped')}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded border-2 border-amber-400 bg-amber-500/20 shrink-0" />
                          <span>{t('inv.legendSelected')}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{t('inv.legendUpgrade')}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 mx-0.5" />
                          <span>{t('inv.legendNew')}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          <span>{t('inv.legendLocked')}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                          <span>{t('inv.legendFavorite')}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Ban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{t('inv.legendUnusable')}</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible Filter Drawer */}
              {filterDrawerOpen && (
                <div
                  data-testid="inv-filter-drawer"
                  className="rounded-lg border border-slate-800 bg-[#080C14] p-3 space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Rarity multi */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400">
                        {t('inv.filterRarity')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {RARITY_OPTIONS.map((r) => {
                          const active = filterState.rarities.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => toggleRarityFilter(r)}
                              className={`h-7 px-2 rounded border text-[11px] font-semibold cursor-pointer ${
                                active
                                  ? `${RARITY_META[r].borderClass} bg-slate-800 ${RARITY_META[r].textClass}`
                                  : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {getRarityLabel(lang, r)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tier multi */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400">
                        {t('inv.filterTier')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {TIER_OPTIONS.map((tier) => {
                          const active = filterState.tiers.includes(tier);
                          return (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => toggleTierFilter(tier)}
                              className={`h-7 px-2.5 rounded border font-mono-nums text-[11px] font-semibold cursor-pointer ${
                                active
                                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                                  : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              T{tier}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Required-level range */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400">
                        {t('inv.filterLevelRange')}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={currentMaxLevel}
                          placeholder="Min"
                          value={filterState.minLevel ?? ''}
                          onChange={(e) =>
                            setInventoryFilterState({
                              minLevel:
                                e.target.value === ''
                                  ? null
                                  : Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-20 h-8 px-2 rounded border border-slate-700 bg-slate-900 font-mono-nums text-xs"
                        />
                        <span className="text-slate-500">–</span>
                        <input
                          type="number"
                          min={1}
                          max={currentMaxLevel}
                          placeholder="Max"
                          value={filterState.maxLevel ?? ''}
                          onChange={(e) =>
                            setInventoryFilterState({
                              maxLevel:
                                e.target.value === ''
                                  ? null
                                  : Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-20 h-8 px-2 rounded border border-slate-700 bg-slate-900 font-mono-nums text-xs"
                        />
                      </div>
                    </div>

                    {/* Roll quality range */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400">
                        {t('inv.filterQualityRange')}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={filterState.minQuality}
                          onChange={(e) =>
                            setInventoryFilterState({
                              minQuality: Math.max(
                                0,
                                Math.min(100, Number(e.target.value) || 0)
                              ),
                            })
                          }
                          className="w-20 h-8 px-2 rounded border border-slate-700 bg-slate-900 font-mono-nums text-xs"
                        />
                        <span className="text-slate-500">–</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={filterState.maxQuality}
                          onChange={(e) =>
                            setInventoryFilterState({
                              maxQuality: Math.max(
                                0,
                                Math.min(
                                  100,
                                  e.target.value === ''
                                    ? 100
                                    : Number(e.target.value)
                                )
                              ),
                            })
                          }
                          className="w-20 h-8 px-2 rounded border border-slate-700 bg-slate-900 font-mono-nums text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Usability segmented control */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-slate-400">
                      {t('inv.filterUsability')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        ['all', 'selected_gear', 'any_gear'] as const
                      ).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() =>
                            setInventoryFilterState({ usability: u })
                          }
                          className={`h-8 px-2.5 rounded border text-xs font-medium cursor-pointer ${
                            filterState.usability === u
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                              : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t(`inv.usability.${u}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles + Reset */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterState.onlyUpgrades}
                          onChange={(e) =>
                            setInventoryFilterState({
                              onlyUpgrades: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-emerald-400"
                        />
                        <span>{t('inv.onlyUpgrades')}</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterState.lockedOnly}
                          onChange={(e) =>
                            setInventoryFilterState({
                              lockedOnly: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-amber-400"
                        />
                        <span>{t('inv.lockedOnly')}</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterState.newOnly}
                          onChange={(e) =>
                            setInventoryFilterState({
                              newOnly: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-cyan-400"
                        />
                        <span>{t('inv.newOnly')}</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterState.pinEquippedFirst}
                          onChange={(e) =>
                            setInventoryFilterState({
                              pinEquippedFirst: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-sky-400"
                        />
                        <span>{t('inv.pinEquippedFirst')}</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => resetInventoryFilterState()}
                      className="h-8 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer"
                    >
                      {t('inv.filtersReset')}
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-Select Bulk Action Bar */}
              {multiSelectMode && (
                <div
                  data-testid="inv-bulk-bar"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex flex-col gap-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-200">
                        {t('inv.selectedCount', { count: selectedIds.size })}
                      </span>
                      <button
                        type="button"
                        data-testid="inv-select-all-btn"
                        onClick={() => {
                          setConfirmBulkRare(false);
                          setSelectedIds(
                            new Set(
                              filteredEntries.map((e) => e.item.instanceId)
                            )
                          );
                        }}
                        className="text-sky-300 hover:text-sky-200 font-medium cursor-pointer"
                      >
                        {t('inv.selectAllVisible')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmBulkRare(false);
                          setSelectedIds(new Set());
                        }}
                        className="text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {t('inv.clearSelection')}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={selectedIds.size === 0}
                        onClick={() =>
                          bulkSetItemLock(Array.from(selectedIds), true)
                        }
                        className="h-8 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-amber-200 font-semibold inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{t('inv.bulkLock')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={selectedIds.size === 0}
                        onClick={() =>
                          bulkSetItemLock(Array.from(selectedIds), false)
                        }
                        className="h-8 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{t('inv.bulkUnlock')}</span>
                      </button>
                      <button
                        type="button"
                        data-testid="inv-bulk-sell-btn"
                        disabled={bulkSellableItems.length === 0}
                        onClick={handleBulkSell}
                        className={`h-8 px-3 rounded font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          confirmBulkRare
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>
                          {confirmBulkRare
                            ? t('inv.bulkSellConfirmRare', {
                                count: bulkSellableItems.length,
                                rarity: getRarityLabel(lang, 'rare'),
                              })
                            : t('inv.bulkSell', {
                                count: bulkSellableItems.length,
                              })}
                        </span>
                      </button>
                    </div>
                  </div>
                  {bulkSkippedTotal > 0 && (
                    <div
                      data-testid="inv-bulk-skipped"
                      className="text-[11px] font-medium text-amber-300"
                    >
                      {t('inv.bulkSkippedNotice', {
                        skipped: bulkSkippedTotal,
                        equipped: bulkSkippedEquippedCount,
                        locked: bulkSkippedLockedCount,
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Showing count + Pin Equipped quick indicator */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {t('inv.showingCount', {
                    shown: filteredEntries.length,
                    total: pilot.inventory.length,
                  })}
                </span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterState.pinEquippedFirst}
                    onChange={(e) =>
                      setInventoryFilterState({
                        pinEquippedFirst: e.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5 accent-sky-400"
                  />
                  <span>{t('inv.pinEquippedFirst')}</span>
                </label>
              </div>
            </div>
          )}

          {/* ==================== CONSUMABLES TAB CONTENT ==================== */}
          {filterState.slot === 'consumables' ? (
            <div className="space-y-3">
              {((pilot.activeEnchantBonusPct ?? 0) > 0 ||
                (pilot.activeBuffs?.exp?.battles ?? pilot.activeExpBoostBattles ?? 0) > 0) && (
                <div className="flex flex-wrap gap-2">
                  {(pilot.activeEnchantBonusPct ?? 0) > 0 && (
                    <div className="rounded border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-200 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                      <span>
                        {t('inv.enchantBonusReady', {
                          pct: pilot.activeEnchantBonusPct ?? 0,
                        })}
                      </span>
                    </div>
                  )}
                  {(pilot.activeBuffs?.exp?.battles ?? pilot.activeExpBoostBattles ?? 0) > 0 && (
                    <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                      <span>
                        {t('inv.expBoostActive', {
                          battles:
                            pilot.activeBuffs?.exp?.battles ??
                            pilot.activeExpBoostBattles ??
                            0,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {consumablesList.length === 0 ? (
                <div className="min-h-[160px] rounded border border-slate-800/80 bg-[#080C14] px-4 py-8 flex items-center justify-center text-center text-sm lg:text-xs text-slate-400">
                  {t('inv.consumablesEmpty')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1 tactical-scroll">
                  {consumablesList.map((c) => {
                    const supplyTpl =
                      c.kind === 'battle_supply' && c.templateId
                        ? getSupplyTemplateById(c.templateId)
                        : undefined;
                    if (c.kind === 'battle_supply' && supplyTpl) {
                      const realName = getSupplyName(supplyTpl.id, t);
                      const effectText = formatSupplyEffectSummary(supplyTpl, t);
                      const iconRow =
                        getCatalogRow(
                          supplyTpl.iconId,
                          adminConfig.iconCatalogMods
                        ) ?? null;
                      const inLoadout = (
                        activeGear.supplyLoadout ?? []
                      ).includes(supplyTpl.id);

                      return (
                        <div
                          key={c.id}
                          data-testid={`consumable-supply-${supplyTpl.id}`}
                          className="rounded-lg border border-sky-500/35 bg-[#080C14] p-3 flex flex-col justify-between gap-2.5 min-w-0"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="h-9 w-9 rounded border border-sky-400/40 bg-sky-500/15 flex items-center justify-center shrink-0">
                              <CatalogIcon
                                row={iconRow}
                                size="sm"
                                showBadges={false}
                                showArrowBadge={false}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-100 truncate">
                                  {realName}
                                </span>
                                <span className="font-mono-nums text-xs font-bold text-sky-300 shrink-0">
                                  {t('inv.consumableQty', { qty: c.quantity })}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-mono-nums px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                                  T{supplyTpl.tier}
                                </span>
                                <span className="text-[11px] text-emerald-300 truncate">
                                  {effectText}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {inLoadout ? (
                              <span
                                data-testid={`supply-in-bag-${supplyTpl.id}`}
                                className="min-h-[36px] flex-1 px-2.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold inline-flex items-center justify-center"
                              >
                                {t('inv.supplyInBagLabel')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                data-testid={`supply-add-bag-${supplyTpl.id}`}
                                onClick={() => handleAddSupplyToBag(supplyTpl)}
                                className="min-h-[36px] flex-1 px-2.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                              >
                                {t('inv.supplyAddToBagBtn')}
                              </button>
                            )}
                            <button
                              type="button"
                              data-testid={`supply-sell-one-${supplyTpl.id}`}
                              onClick={() => setPendingSellSupply(supplyTpl)}
                              className="min-h-[36px] px-3 rounded border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold cursor-pointer shrink-0"
                            >
                              {t('inv.supplySellOneBtn')}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const { name, desc } = renderConsumableText(c);
                    const isSupplyCrate = c.kind === 'supply_crate';
                    return (
                      <div
                        key={c.id}
                        className={`rounded-lg border bg-[#080C14] p-3 flex flex-col justify-between gap-2.5 ${
                          isSupplyCrate
                            ? 'border-amber-500/35'
                            : 'border-purple-500/35'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`h-9 w-9 rounded border flex items-center justify-center shrink-0 ${
                              isSupplyCrate
                                ? 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                                : 'border-purple-400/40 bg-purple-500/15 text-purple-300'
                            }`}
                          >
                            <ConsumableIcon kind={c.kind} className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-100 truncate">
                                {name}
                              </span>
                              <span
                                className={`font-mono-nums text-xs font-bold shrink-0 ${
                                  isSupplyCrate ? 'text-amber-300' : 'text-purple-300'
                                }`}
                              >
                                {t('inv.consumableQty', { qty: c.quantity })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {desc}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          data-testid={`use-consumable-${c.kind}`}
                          onClick={() => handleUseConsumable(c)}
                          className={`min-h-[36px] px-3 rounded text-white text-xs font-semibold cursor-pointer ${
                            isSupplyCrate
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'bg-purple-600 hover:bg-purple-500'
                          }`}
                        >
                          {c.kind === 'equipment_crate' || c.kind === 'supply_crate'
                            ? t('inv.consumableOpenBtn')
                            : t('inv.consumableUseBtn')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex-1 min-h-[160px] rounded border border-slate-800/80 bg-[#080C14] px-4 py-8 flex items-center justify-center text-center text-sm lg:text-xs text-slate-400">
              {pilot.inventory.length === 0
                ? t('equip.inventoryEmpty')
                : t('inv.noMatch')}
            </div>
          ) : (
            /* ==================== VIRTUALIZED FIXED-HEIGHT GRID ==================== */
            <div
              ref={gridContainerRef}
              data-testid="inv-virtual-grid"
              onScroll={(e) => {
                const target = e.currentTarget;
                setGridMetrics((prev) => ({
                  ...prev,
                  scrollTop: target.scrollTop,
                }));
              }}
              className="h-[384px] sm:h-[420px] overflow-y-auto pr-1 tactical-scroll"
            >
              <div
                style={{ height: `${totalGridHeight}px` }}
                className="relative w-full"
              >
                <div
                  style={{
                    transform: `translateY(${startRow * ROW_STRIDE}px)`,
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gap: `${GRID_GAP}px`,
                  }}
                  className="grid w-full"
                >
                  {visibleEntries.map((entry) => {
                    const inst = entry.item;
                    const isSelected =
                      selection?.kind === 'inventory' &&
                      selection.instanceId === inst.instanceId;
                    const isChecked = selectedIds.has(inst.instanceId);
                    const isEquippedSelected = entry.equippedOnSelected;
                    const isEquippedOther =
                      entry.equippedBy !== null && !entry.equippedOnSelected;
                    const isUnusable = !entry.usableBySelected;
                    const unusableReason = isUnusable
                      ? getUnusableReasonShort(
                          lang,
                          inst,
                          activeGear.level,
                          activeGear.classId,
                          t
                        )
                      : '';

                    const frameClasses = isSelected
                      ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/60'
                      : isChecked
                      ? 'border-amber-400 bg-amber-500/10'
                      : isEquippedSelected
                      ? 'border-emerald-400 bg-emerald-500/12 ring-1 ring-emerald-400/50'
                      : isUnusable
                      ? 'border-slate-700/80 bg-slate-900/90 grayscale-[80%] opacity-60'
                      : isEquippedOther
                      ? 'border-sky-400/75 bg-sky-500/10'
                      : `${RARITY_META[inst.rarity].borderClass} ${
                          RARITY_META[inst.rarity].bgTintClass
                        } hover:bg-slate-900/90`;

                    return (
                      <button
                        key={inst.instanceId}
                        type="button"
                        data-testid={`inv-card-${inst.instanceId}`}
                        data-unusable={isUnusable ? 'true' : 'false'}
                        title={entry.displayName}
                        onClick={() => handleSelectInventory(inst.instanceId)}
                        className={`relative h-[128px] overflow-hidden p-2.5 rounded-lg lg:rounded border text-left transition-colors cursor-pointer flex flex-col justify-between ${frameClasses}`}
                      >
                        {/* Striped overlay for unusable items */}
                        {isUnusable && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(148,163,184,0.09)_0px,rgba(148,163,184,0.09)_6px,transparent_6px,transparent_12px)]"
                          />
                        )}

                        {/* EQUIPPED Corner Ribbon */}
                        {entry.equippedBy && (
                          <div
                            className={`absolute top-0 right-0 z-10 px-1.5 py-0.5 rounded-bl text-[9px] font-bold tracking-tight inline-flex items-center gap-1 max-w-[85%] ${
                              isEquippedSelected
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-sky-500/90 text-slate-950'
                            }`}
                          >
                            <ClassIcon
                              classId={entry.equippedBy}
                              colored={false}
                              className="w-2.5 h-2.5 shrink-0"
                            />
                            <span className="truncate">
                              {isEquippedSelected
                                ? t('inv.ribbonEquipped')
                                : t('inv.ribbonOnGear', {
                                    gear: getClassName(lang, entry.equippedBy),
                                  })}
                            </span>
                          </div>
                        )}

                        {/* Top Metadata Row */}
                        <div className="relative z-10 flex items-center justify-between gap-1 pt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-mono-nums ${
                              RARITY_META[inst.rarity].textClass
                            }`}
                          >
                            {multiSelectMode && (
                              <span
                                className={`w-3.5 h-3.5 rounded border inline-flex items-center justify-center shrink-0 ${
                                  isChecked
                                    ? 'border-amber-400 bg-amber-400 text-slate-950'
                                    : 'border-slate-500 bg-slate-950/80'
                                }`}
                              >
                                {isChecked && <Check className="w-2.5 h-2.5" />}
                              </span>
                            )}
                            <SlotIcon
                              slot={inst.slot}
                              className="w-3.5 h-3.5 shrink-0"
                            />
                            <span>T{inst.tier}</span>
                            {inst.isStarter && (
                              <span
                                data-testid="inv-starter-badge"
                                className="px-1 py-0.2 rounded border border-cyan-500/45 bg-cyan-500/12 text-[9px] font-sans font-semibold text-cyan-300 leading-tight"
                              >
                                {t('inv.starterBadge')}
                              </span>
                            )}
                            {inst.isNew && (
                              <span
                                title={t('inv.badgeNew')}
                                className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"
                              />
                            )}
                          </span>

                          <div
                            className={`flex items-center gap-1 font-mono-nums text-[11px] ${
                              entry.equippedBy ? 'mt-3' : ''
                            }`}
                          >
                            {entry.isUpgrade && (
                              <span
                                title={t('inv.badgeUpgrade', {
                                  gear: getClassName(lang, activeGear.classId),
                                })}
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              </span>
                            )}
                            {inst.locked && (
                              <span title={t('inv.badgeLocked')}>
                                <Lock className="w-3 h-3 text-amber-300 shrink-0" />
                              </span>
                            )}
                            {inst.favorited && (
                              <span title={t('inv.badgeFavorited')}>
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                              </span>
                            )}
                            {inst.enchantLevel > 0 && (
                              <span className="font-bold text-amber-400">
                                +{inst.enchantLevel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Clamped 2-Line Item Name + Tooltip */}
                        <div
                          title={entry.displayName}
                          className={`relative z-10 text-xs font-semibold leading-snug line-clamp-2 ${
                            isUnusable
                              ? 'text-slate-300'
                              : RARITY_META[inst.rarity].textClass
                          }`}
                        >
                          {entry.displayName}
                        </div>

                        {/* Bottom Reason / Quality + Level Line */}
                        <div className="relative z-10 text-[11px] font-mono-nums flex items-center justify-between gap-1">
                          {isUnusable ? (
                            <span
                              data-testid="inv-unusable-reason"
                              className="inline-flex items-center gap-1 text-rose-300/90 truncate"
                            >
                              <Ban className="w-3 h-3 shrink-0" />
                              <span className="truncate">{unusableReason}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 truncate">
                              {t('common.levelShort')}
                              {inst.requiredLevel}
                              {inst.classRestriction
                                ? ` · ${getClassName(
                                    lang,
                                    inst.classRestriction
                                  )}`
                                : ''}
                            </span>
                          )}
                          <span className="text-slate-400 shrink-0">
                            {inst.rollQuality}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
        </div>

        {/* Inline Detail Panel (Desktop >= lg, Sticky Right Column) */}
        <section className="hidden lg:flex lg:col-span-5 lg:sticky lg:top-4 self-start max-h-[calc(100dvh-2rem)] overflow-y-auto tactical-scroll rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-4 flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
              {t('gear.detailHeading')}
            </h2>
            {activeDetailInstance && (
              <span className="text-[11px] font-medium text-slate-400">
                {activeDetailOwnerGear
                  ? t('common.equippedOnGear', {
                      gear: getClassName(lang, activeDetailOwnerGear),
                    })
                  : t('gear.inCargo')}
              </span>
            )}
          </div>

          {renderDetailContent()}
        </section>
      </div>

      {/* Mobile Bottom Sheet for Item Detail / Compare / Enchant (< lg) */}
      <div className="lg:hidden">
        <BottomSheet
          open={
            mobileDetailOpen &&
            (Boolean(activeDetailInstance) || selection?.kind === 'slot')
          }
          onClose={() => {
            setMobileDetailOpen(false);
            setConfirmingUnequipSlot(null);
            setConfirmingSellId(null);
          }}
          title={
            activeDetailInstance
              ? getItemInstanceName(lang, activeDetailInstance, true)
              : selection?.kind === 'slot'
              ? getSlotLabel(lang, selection.slot)
              : t('gear.detailHeading')
          }
          subtitle={
            activeDetailInstance
              ? activeDetailOwnerGear
                ? t('common.equippedOnGear', {
                    gear: getClassName(lang, activeDetailOwnerGear),
                  })
                : t('gear.inCargo')
              : undefined
          }
        >
          {renderDetailContent()}
        </BottomSheet>
      </div>

      {/* Auto-Equip Preview Modal */}
      <AutoEquipModal
        open={autoEquipPlan !== null}
        plan={autoEquipPlan}
        replaceMarginPct={
          sanitizeAutoEquipConfig(adminConfig.autoEquip).replaceMarginPct
        }
        onClose={() => setAutoEquipPlan(null)}
        onApply={() => {
          if (!autoEquipPlan) return;
          applyAutoEquip(autoEquipPlan);
          setAutoEquipPlan(null);
        }}
      />

      {/* Quick Sell Modal */}
      <QuickSellModal
        open={quickSellOpen}
        onClose={() => setQuickSellOpen(false)}
        onSold={() => {}}
      />

      {/* Quick Swap / Pick Modal */}
      <GearSwapPicker
        open={swapPickerSlot !== null || swapPickerSocketIndex !== null}
        slot={swapPickerSocketIndex !== null ? 'module' : swapPickerSlot}
        socketIndex={swapPickerSocketIndex ?? undefined}
        onClose={() => {
          setSwapPickerSlot(null);
          setSwapPickerSocketIndex(null);
        }}
        onEquipped={(equippedSlot) => { setSelection({ kind: 'slot', slot: equippedSlot }); setConfirmingSellId(null); }}
      />

      {/* Supply Sell Confirmation */}
      <SupplyTradeConfirm
        mode="sell"
        currency="CR"
        template={pendingSellSupply}
        voucher={null}
        qty={1}
        unitPrice={
          pendingSellSupply
            ? Math.round(
                computeSupplyPrice(pendingSellSupply, adminConfig) *
                  SHOP_CONFIG.sellPriceRatio
              )
            : 0
        }
        credits={pilot.credits}
        iconCatalogMods={adminConfig.iconCatalogMods}
        onConfirm={() => {
          const tpl = pendingSellSupply;
          setPendingSellSupply(null);
          if (!tpl) return;
          const res = sellSupply(tpl.id, 1);
          if (res.ok && res.sold > 0) {
            setInventoryNotice(
              t('shop.supplySellNotice', {
                qty: res.sold,
                name: getSupplyName(tpl.id, t),
                credits: res.creditsEarned.toLocaleString(),
              })
            );
          } else {
            setInventoryNotice(t('shop.supplySellFailed'));
          }
        }}
        onCancel={() => setPendingSellSupply(null)}
      />
    </div>
  );
}
