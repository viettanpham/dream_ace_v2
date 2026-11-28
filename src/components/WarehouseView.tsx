import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  Check,
  CheckSquare,
  CreditCard,
  Lock,
  PackageOpen,
  Sparkles,
  Star,
  Ticket,
  X,
} from 'lucide-react';
import {
  BUFF_CARD_ICON_IDS,
  BUFF_CARD_LIST,
  getBuffCardPercent,
  parseBuffCardId,
  resolveBuffCardsConfig,
  sanitizePilotActiveBuffs,
  sanitizePilotBuffCards,
} from '../data/buffCards';
import { STAT_KEYS } from '../data/classes';
import { getMaxLevel } from '../data/balance';
import { ITEM_SLOTS, RARITY_META } from '../data/items';
import { getCatalogRow } from '../data/iconCatalog';
import { getAllVouchers } from '../data/vouchers';
import {
  applyExpCardBatchToGear,
  applySingleExpCardToGear,
  type CardTierNumber,
  getCardTier,
  sanitizeCardTiersConfig,
} from '../engine/cardTiers';
import {
  getMedalName,
  getMedalWpValue,
  MEDAL_ICON_ID,
  MEDAL_IDS,
  parseMedalId,
  sanitizePilotMedals,
} from '../engine/medals';
import { getEffectiveItemStats, getItemEquippedByGear } from '../engine/equipment';
import {
  getBoxCapacity,
  sanitizeWarehouseCapacity,
} from '../engine/migration';
import {
  getCardDef,
  getCardName,
  sanitizeOwnedCards,
} from '../engine/starterEvent';
import type { WarehouseTransferResult } from '../engine/warehouse';
import {
  formatItemTraitsList,
  getBuffCardKindLabel,
  getBuffCardName,
  getClassName,
  getItemInstanceDesc,
  getItemInstanceName,
  getRarityLabel,
  getSlotLabel,
  getSlotShort,
  getStatShort,
  useI18n,
} from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { isBattleActive, useGameStore } from '../store/useGameStore';
import type { BuffCardKind, ItemInstance, MechClassId } from '../types/game';
import { useAutoVoucherPref } from '../utils/voucherAutoPrefs';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { ClassIcon, SlotIcon } from './GameIcons';

type WarehouseContainer = 'box' | 'warehouse';
type SlotFilter = 'all' | (typeof ITEM_SLOTS)[number];

interface SelectedWarehouseItem {
  container: WarehouseContainer;
  item: ItemInstance;
}

export function formatWarehouseTransferToast(
  result: WarehouseTransferResult,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
): string {
  if (result.reason === 'locked') {
    return t('warehouse.toastLocked');
  }
  const parts: string[] = [
    t('warehouse.toastMoved', { count: result.moved }),
  ];
  if (result.skippedEquipped > 0) {
    parts.push(
      t('warehouse.toastSkippedEquipped', { count: result.skippedEquipped })
    );
  }
  if (result.skippedProtected > 0) {
    parts.push(
      t('warehouse.toastSkippedProtected', { count: result.skippedProtected })
    );
  }
  if (result.skippedFull > 0) {
    parts.push(
      t('warehouse.toastSkippedFull', { count: result.skippedFull })
    );
  }
  return parts.join(' · ');
}

interface WarehouseItemCellProps {
  item: ItemInstance;
  container: WarehouseContainer;
  equippedBy: MechClassId | null;
  activeGearId: MechClassId;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (container: WarehouseContainer, item: ItemInstance) => void;
  onToggleTick: (itemId: string) => void;
  onBlockedEquippedTap: (gearId: MechClassId) => void;
}

function WarehouseItemCell({
  item,
  container,
  equippedBy,
  activeGearId,
  selectionMode,
  isSelected,
  onSelect,
  onToggleTick,
  onBlockedEquippedTap,
}: WarehouseItemCellProps) {
  const { lang, t } = useI18n();
  const displayName = getItemInstanceName(lang, item);
  const isEquippedSelected = equippedBy === activeGearId;
  const blockedInSelection = selectionMode && equippedBy !== null;

  const frameClasses = blockedInSelection
    ? 'border-slate-800 bg-slate-950/60 opacity-45 cursor-not-allowed'
    : selectionMode && isSelected
    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/70'
    : equippedBy
    ? isEquippedSelected
      ? 'border-emerald-400 bg-emerald-500/12 ring-1 ring-emerald-400/50'
      : 'border-sky-400/75 bg-sky-500/10'
    : `${RARITY_META[item.rarity].borderClass} ${
        RARITY_META[item.rarity].bgTintClass
      } hover:bg-slate-900/90`;

  const handleClick = () => {
    if (!selectionMode) {
      onSelect(container, item);
      return;
    }
    if (equippedBy !== null) {
      onBlockedEquippedTap(equippedBy);
      return;
    }
    onToggleTick(item.instanceId);
  };

  return (
    <button
      type="button"
      data-testid={`warehouse-cell-${container}-${item.instanceId}`}
      data-selected={selectionMode && isSelected ? 'true' : 'false'}
      data-selection-blocked={blockedInSelection ? 'true' : 'false'}
      aria-pressed={selectionMode && equippedBy === null ? isSelected : undefined}
      aria-disabled={blockedInSelection ? true : undefined}
      title={displayName}
      onClick={handleClick}
      className={`relative h-[128px] overflow-hidden p-2.5 rounded-lg lg:rounded border text-left transition-colors cursor-pointer flex flex-col justify-between ${frameClasses}`}
    >
      {/* Multi-select checkbox corner indicator */}
      {selectionMode && equippedBy === null && (
        <span
          data-testid={`warehouse-tick-${item.instanceId}`}
          aria-hidden="true"
          className={`absolute top-1.5 right-1.5 z-20 w-4 h-4 rounded border flex items-center justify-center ${
            isSelected
              ? 'bg-amber-400 border-amber-300 text-slate-950'
              : 'bg-slate-950/90 border-slate-500 text-transparent'
          }`}
        >
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      )}

      {/* Equipped Corner Ribbon */}
      {equippedBy && (
        <div
          data-testid={`warehouse-equipped-badge-${item.instanceId}`}
          className={`absolute top-0 right-0 z-10 px-1.5 py-0.5 rounded-bl text-[9px] font-bold tracking-tight inline-flex items-center gap-1 max-w-[85%] ${
            isEquippedSelected
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-sky-500/90 text-slate-950'
          }`}
        >
          <ClassIcon
            classId={equippedBy}
            colored={false}
            className="w-2.5 h-2.5 shrink-0"
          />
          <span className="truncate">
            {isEquippedSelected
              ? t('inv.ribbonEquipped')
              : t('inv.ribbonOnGear', {
                  gear: getClassName(lang, equippedBy),
                })}
          </span>
        </div>
      )}

      {/* Top Metadata Row */}
      <div className="relative z-10 flex items-center justify-between gap-1 pt-0.5">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-mono-nums min-w-0 ${
            RARITY_META[item.rarity].textClass
          }`}
        >
          <SlotIcon slot={item.slot} className="w-3.5 h-3.5 shrink-0" />
          <span>T{item.tier}</span>
          <span className="text-[10px] text-slate-400 font-sans truncate">
            {getSlotShort(lang, item.slot)}
          </span>
        </span>

        <div
          className={`flex items-center gap-1 font-mono-nums text-[11px] shrink-0 ${
            equippedBy || selectionMode ? 'mt-3' : ''
          }`}
        >
          {item.locked && (
            <span title={t('inv.badgeLocked')}>
              <Lock className="w-3 h-3 text-amber-300 shrink-0" />
            </span>
          )}
          {item.favorited && (
            <span title={t('inv.badgeFavorited')}>
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
            </span>
          )}
          {item.enchantLevel > 0 && (
            <span className="font-bold text-amber-400">
              +{item.enchantLevel}
            </span>
          )}
        </div>
      </div>

      {/* Clamped 2-Line Item Name */}
      <div
        title={displayName}
        className={`relative z-10 text-xs font-semibold leading-snug line-clamp-2 ${
          RARITY_META[item.rarity].textClass
        }`}
      >
        {displayName}
      </div>

      {/* Bottom Level & Quality Line */}
      <div className="relative z-10 text-[11px] font-mono-nums flex items-center justify-between gap-1 text-slate-400">
        <span className="truncate">
          {t('common.levelShort')}
          {item.requiredLevel}
          {item.classRestriction
            ? ` · ${getClassName(lang, item.classRestriction)}`
            : ''}
        </span>
        <span className="shrink-0">{item.rollQuality}%</span>
      </div>
    </button>
  );
}

export function WarehouseView() {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const boxCapacityRaw = adminConfig.boxCapacity;
  const warehouseCapacityRaw = adminConfig.warehouseCapacity;
  const screen = useGameStore((s) => s.screen);
  const battle = useGameStore((s) => s.battle);
  const autoRepeatActive = useGameStore((s) =>
    Boolean(s.autoRepeatSession?.active)
  );
  const moveToWarehouse = useGameStore((s) => s.moveToWarehouse);
  const moveToBox = useGameStore((s) => s.moveToBox);
  const moveAllUnusedToWarehouse = useGameStore(
    (s) => s.moveAllUnusedToWarehouse
  );
  const redeemCard = useGameStore((s) => s.redeemCard);
  const useBuffCard = useGameStore((s) => s.useBuffCard);
  const redeemMedal = useGameStore((s) => s.redeemMedal);
  const [autoVoucherEnabled, setAutoVoucherEnabled] = useAutoVoucherPref();

  const [mobilePanel, setMobilePanel] = useState<WarehouseContainer>('box');
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all');
  const [selected, setSelected] = useState<SelectedWarehouseItem | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [cardResultText, setCardResultText] = useState<string | null>(null);
  const [cardResultIsError, setCardResultIsError] = useState(false);
  const [buffResultText, setBuffResultText] = useState<string | null>(null);
  const [buffResultIsError, setBuffResultIsError] = useState(false);
  const [medalResultText, setMedalResultText] = useState<string | null>(null);
  const [medalResultIsError, setMedalResultIsError] = useState(false);
  const [pendingBuffReplace, setPendingBuffReplace] = useState<{
    cardId: string;
    kind: BuffCardKind;
    previousTier: number;
    nextTier: number;
  } | null>(null);
  const [pendingCardWasteConfirm, setPendingCardWasteConfirm] = useState<{
    cardId: string;
    qty: number;
    appliedExp: number;
    totalCardExp: number;
    wastedExp: number;
    levelsGained: number;
  } | null>(null);
  const [selectionContainer, setSelectionContainer] =
    useState<WarehouseContainer | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const boxCap = getBoxCapacity({ boxCapacity: boxCapacityRaw });
  const warehouseCap = sanitizeWarehouseCapacity(warehouseCapacityRaw);
  const boxItems = pilot.inventory;
  const warehouseItems = Array.isArray(pilot.warehouse) ? pilot.warehouse : [];
  const isBoxOverCap = boxItems.length > boxCap;
  const transferLocked =
    isBattleActive({ screen, battle }) || autoRepeatActive;

  const filteredBoxItems = useMemo(
    () =>
      slotFilter === 'all'
        ? boxItems
        : boxItems.filter((it) => it.slot === slotFilter),
    [boxItems, slotFilter]
  );

  const filteredWarehouseItems = useMemo(
    () =>
      slotFilter === 'all'
        ? warehouseItems
        : warehouseItems.filter((it) => it.slot === slotFilter),
    [warehouseItems, slotFilter]
  );

  const selectedEquippedBy = selected
    ? getItemEquippedByGear(pilot.gears, selected.item.instanceId)
    : null;

  const selectedStats = selected ? getEffectiveItemStats(selected.item) : null;
  const selectedTraits = selected
    ? formatItemTraitsList(lang, selected.item)
    : [];

  const ownedVoucherRows = useMemo(() => {
    const numberLocale = lang === 'vi' ? 'vi-VN' : 'en-US';
    const ownedMap = pilot.vouchers ?? {};
    const all = getAllVouchers(adminConfig);
    return all
      .map((def) => {
        const qty = Math.max(0, Math.floor(Number(ownedMap[def.id]) || 0));
        if (qty <= 0) return null;
        const valFmt = def.value.toLocaleString(numberLocale);
        const name =
          def.kind === 'credit'
            ? t('shop.voucherNameCredit', { value: valFmt })
            : t('shop.voucherNameExp', { value: valFmt });
        return { def, name, qty };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [pilot.vouchers, adminConfig, lang, t]);

  const totalOwnedVouchers = useMemo(
    () => ownedVoucherRows.reduce((s, r) => s + r.qty, 0),
    [ownedVoucherRows]
  );

  const ownedCardRows = useMemo(() => {
    const clean = sanitizeOwnedCards(pilot.cards);
    return Object.entries(clean)
      .map(([id, qty]) => {
        const def = getCardDef(id);
        if (!def || qty <= 0) return null;
        return {
          def,
          name: getCardName(def.id, lang),
          tier: getCardTier(def.kind, def.value, adminConfig),
          qty,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        if (a.def.kind !== b.def.kind) {
          return a.def.kind === 'credit' ? -1 : 1;
        }
        return a.def.value - b.def.value;
      });
  }, [pilot.cards, lang, adminConfig]);

  const totalOwnedCards = useMemo(
    () => ownedCardRows.reduce((s, r) => s + r.qty, 0),
    [ownedCardRows]
  );

  const buffCardsCfg = useMemo(
    () => resolveBuffCardsConfig(adminConfig),
    [adminConfig]
  );

  const ownedBuffCardRows = useMemo(() => {
    const clean = sanitizePilotBuffCards(pilot.buffCards);
    return BUFF_CARD_LIST.map((def) => {
      const qty = clean[def.id] ?? 0;
      if (qty <= 0) return null;
      return {
        def,
        qty,
        name: getBuffCardName(lang, def.kind, def.tier),
        pct: getBuffCardPercent(def.kind, def.tier, buffCardsCfg),
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [pilot.buffCards, lang, buffCardsCfg]);

  const totalOwnedBuffCards = useMemo(
    () => ownedBuffCardRows.reduce((s, r) => s + r.qty, 0),
    [ownedBuffCardRows]
  );

  const ownedMedalRows = useMemo(() => {
    const clean = sanitizePilotMedals(pilot.medals);
    return MEDAL_IDS.map((id) => {
      const qty = clean[id] ?? 0;
      const parsed = parseMedalId(id);
      if (!parsed || qty <= 0) return null;
      return {
        id,
        tier: parsed.tier,
        name: getMedalName(parsed.tier, lang),
        wp: getMedalWpValue(parsed.tier, adminConfig),
        qty,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [pilot.medals, lang, adminConfig]);

  const totalOwnedMedals = useMemo(
    () => ownedMedalRows.reduce((s, r) => s + r.qty, 0),
    [ownedMedalRows]
  );

  const activeBuffRows = useMemo(() => {
    const sanitized = sanitizePilotActiveBuffs(
      pilot.activeBuffs,
      pilot.activeExpBoostBattles
    );
    return (
      Object.entries(sanitized) as [
        BuffCardKind,
        { tier: number; battles: number },
      ][]
    ).map(([kind, entry]) => ({
      kind,
      tier: entry.tier,
      battles: entry.battles,
      pct: getBuffCardPercent(kind, entry.tier, buffCardsCfg),
      label: getBuffCardKindLabel(lang, kind),
      iconId: BUFF_CARD_ICON_IDS[kind],
    }));
  }, [pilot.activeBuffs, pilot.activeExpBoostBattles, buffCardsCfg, lang]);

  const handleUseBuffCard = (cardId: string, confirmReplace = false) => {
    const res = useBuffCard(cardId, { confirmReplace });
    if (!res.ok) {
      if (res.reason === 'confirm_replace' && res.kind !== undefined) {
        setPendingBuffReplace({
          cardId,
          kind: res.kind,
          previousTier: res.previousTier ?? 0,
          nextTier: res.nextTier ?? 1,
        });
        return;
      }
      setBuffResultIsError(true);
      if (res.reason === 'busy') {
        setBuffResultText(t('warehouse.buffBusy'));
      } else if (res.reason === 'max_stack') {
        setBuffResultText(
          t('warehouse.buffMaxStack', {
            max: res.maxStackBattles ?? buffCardsCfg.maxStackBattles,
          })
        );
      }
      return;
    }

    setPendingBuffReplace(null);
    setBuffResultIsError(false);
    const parsed = parseBuffCardId(cardId);
    const cardName = parsed
      ? getBuffCardName(lang, parsed.kind, parsed.tier)
      : cardId;
    setBuffResultText(
      t('warehouse.buffUsedMsg', {
        name: cardName,
        battles: res.battles ?? buffCardsCfg.battlesPerCard,
      })
    );
  };

  const handleRedeemMedal = (medalId: string, qty: number) => {
    const res = redeemMedal(medalId, qty);
    const numberLocale = lang === 'vi' ? 'vi-VN' : 'en-US';
    if (!res.ok) {
      setMedalResultIsError(true);
      if (res.reason === 'busy') {
        setMedalResultText(t('warehouse.medalBusy'));
      }
      return;
    }
    setMedalResultIsError(false);
    const tier = ((res.tier ?? 1) as CardTierNumber);
    setMedalResultText(
      t('warehouse.medalUsedMsg', {
        wp: (res.wpGained ?? 0).toLocaleString(numberLocale),
        qty: res.qtyUsed ?? 1,
        name: getMedalName(tier, lang),
      })
    );
  };

  const activeGearForCards = pilot.gears[pilot.activeGearId];

  const handleRedeemCard = (cardId: string, qty: number) => {
    setPendingCardWasteConfirm(null);
    const res = redeemCard(cardId, qty);
    const numberLocale = lang === 'vi' ? 'vi-VN' : 'en-US';
    if (!res.ok) {
      setCardResultIsError(true);
      if (res.reason === 'busy') {
        setCardResultText(t('warehouse.cardBusy'));
      } else if (res.reason === 'max_level') {
        const gearName = getClassName(
          lang,
          res.gearId ?? pilot.activeGearId
        );
        setCardResultText(
          t('warehouse.cardMaxLevel', {
            gear: gearName,
            level: res.newLevel ?? activeGearForCards.level,
          })
        );
      }
      return;
    }

    setCardResultIsError(false);
    if (res.kind === 'credit') {
      setCardResultText(
        t('warehouse.cardUsedCredit', {
          value: (res.credit ?? 0).toLocaleString(numberLocale),
        })
      );
    } else if (res.kind === 'exp') {
      const gearName = getClassName(lang, res.gearId ?? pilot.activeGearId);
      const applied = res.appliedExp ?? res.exp ?? 0;
      const wasted = res.wastedExp ?? 0;
      const valStr = applied.toLocaleString(numberLocale);
      const wastedStr = wasted.toLocaleString(numberLocale);
      if ((res.levelsGained ?? 0) > 0) {
        setCardResultText(
          wasted > 0
            ? t('warehouse.cardUsedExpLevelUpWasted', {
                value: valStr,
                gear: gearName,
                level: res.newLevel ?? activeGearForCards.level,
                wasted: wastedStr,
              })
            : t('warehouse.cardUsedExpLevelUp', {
                value: valStr,
                gear: gearName,
                level: res.newLevel ?? activeGearForCards.level,
              })
        );
      } else {
        setCardResultText(
          wasted > 0
            ? t('warehouse.cardUsedExpWasted', {
                value: valStr,
                gear: gearName,
                wasted: wastedStr,
              })
            : t('warehouse.cardUsedExp', {
                value: valStr,
                gear: gearName,
              })
        );
      }
    }
  };

  const handleRequestRedeemCard = (
    cardId: string,
    qty: number,
    isUseAll = false
  ) => {
    const def = getCardDef(cardId);
    if (
      !def ||
      def.kind === 'credit' ||
      transferLocked ||
      !activeGearForCards ||
      !activeGearForCards.owned ||
      activeGearForCards.level >= getMaxLevel()
    ) {
      handleRedeemCard(cardId, qty);
      return;
    }

    if (!isUseAll) {
      const preview = applySingleExpCardToGear(
        activeGearForCards,
        def.value,
        adminConfig
      );
      const previewWastePct = sanitizeCardTiersConfig(
        adminConfig?.cardTiers
      ).previewWastePct;
      if (
        preview.cardExp > 0 &&
        preview.wastedExp / preview.cardExp >= previewWastePct / 100
      ) {
        setPendingCardWasteConfirm({
          cardId: def.id,
          qty: 1,
          appliedExp: preview.appliedExp,
          totalCardExp: preview.cardExp,
          wastedExp: preview.wastedExp,
          levelsGained: preview.levelsGained,
        });
        return;
      }
      handleRedeemCard(def.id, 1);
      return;
    }

    const batchPreview = applyExpCardBatchToGear(
      activeGearForCards,
      def.value,
      qty,
      adminConfig
    );
    if (batchPreview.cardsUsed <= 0) {
      handleRedeemCard(def.id, qty);
      return;
    }
    if (batchPreview.wastedExp > 0) {
      setPendingCardWasteConfirm({
        cardId: def.id,
        qty: batchPreview.cardsUsed,
        appliedExp: batchPreview.appliedExp,
        totalCardExp: batchPreview.cardExp,
        wastedExp: batchPreview.wastedExp,
        levelsGained: batchPreview.levelsGained,
      });
      return;
    }
    handleRedeemCard(def.id, batchPreview.cardsUsed);
  };

  const handleBulkMoveUnused = () => {
    const res = moveAllUnusedToWarehouse();
    setToastText(formatWarehouseTransferToast(res, t));
  };

  const handleToggleSelectionMode = (container: WarehouseContainer) => {
    setSelectedIds([]);
    setSelectionContainer((prev) => (prev === container ? null : container));
  };

  const handleSlotFilterChange = (nextFilter: SlotFilter) => {
    setSlotFilter(nextFilter);
    setSelectedIds([]);
  };

  const handleMobilePanelChange = (nextPanel: WarehouseContainer) => {
    setMobilePanel(nextPanel);
    setSelectedIds([]);
    setSelectionContainer(null);
  };

  const handleToggleTick = (instanceId: string) => {
    setSelectedIds((prev) =>
      prev.includes(instanceId)
        ? prev.filter((id) => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  const handleSelectAllFiltered = (items: ItemInstance[]) => {
    const eligibleIds = items
      .filter((it) => getItemEquippedByGear(pilot.gears, it.instanceId) === null)
      .map((it) => it.instanceId);
    setSelectedIds((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const id of eligibleIds) {
        if (!seen.has(id)) {
          seen.add(id);
          next.push(id);
        }
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBlockedEquippedTap = (gearId: MechClassId) => {
    setToastText(
      t('warehouse.equippedCannotTick', { gear: getClassName(lang, gearId) })
    );
  };

  const handleBulkMoveSelected = (container: WarehouseContainer) => {
    if (selectedIds.length === 0) return;
    const res =
      container === 'box'
        ? moveToWarehouse(selectedIds)
        : moveToBox(selectedIds);
    setToastText(formatWarehouseTransferToast(res, t));
    setSelectedIds([]);
    setSelectionContainer(null);
  };

  const handleSingleMove = () => {
    if (!selected) return;
    if (selected.container === 'box') {
      const res = moveToWarehouse([selected.item.instanceId]);
      setToastText(formatWarehouseTransferToast(res, t));
      if (res.moved > 0 || res.reason === 'locked') {
        setSelected(null);
      }
      return;
    }
    const res = moveToBox([selected.item.instanceId]);
    setToastText(formatWarehouseTransferToast(res, t));
    if (res.moved > 0 || res.reason === 'locked') {
      setSelected(null);
    }
  };

  const renderSelectionBar = (
    container: WarehouseContainer,
    filteredItems: ItemInstance[]
  ) => {
    if (selectionContainer !== container) return null;
    const hasEligible = filteredItems.some(
      (it) => getItemEquippedByGear(pilot.gears, it.instanceId) === null
    );
    return (
      <div
        data-testid={`warehouse-selection-bar-${container}`}
        className="rounded border border-amber-500/40 bg-amber-950/20 p-2 flex flex-wrap items-center justify-between gap-2 min-w-0"
      >
        <span
          data-testid={`warehouse-selected-count-${container}`}
          className="text-xs font-bold text-amber-200 whitespace-nowrap"
        >
          {t('warehouse.selectedCount', { count: selectedIds.length })}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <button
            type="button"
            data-testid={`warehouse-select-all-btn-${container}`}
            disabled={!hasEligible}
            onClick={() => handleSelectAllFiltered(filteredItems)}
            className="h-8 px-2.5 rounded border border-slate-700 bg-slate-900 hover:border-amber-400/60 disabled:opacity-45 text-[11px] font-medium text-slate-200 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            {t('warehouse.selectAllFilteredBtn')}
          </button>
          <button
            type="button"
            data-testid={`warehouse-clear-select-btn-${container}`}
            disabled={selectedIds.length === 0}
            onClick={handleClearSelection}
            className="h-8 px-2.5 rounded border border-slate-700 bg-slate-900 hover:border-slate-500 disabled:opacity-45 text-[11px] font-medium text-slate-300 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            {t('warehouse.clearSelectBtn')}
          </button>
          <button
            type="button"
            data-testid={`warehouse-bulk-move-btn-${container}`}
            disabled={selectedIds.length === 0 || transferLocked}
            onClick={() => handleBulkMoveSelected(container)}
            className="h-8 px-2.5 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <ArrowLeftRight className="w-3 h-3 shrink-0" />
            <span>
              {container === 'box'
                ? t('warehouse.moveToWarehouseBtn')
                : t('warehouse.moveToBoxBtn')}
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="warehouse-view"
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-4 md:py-4"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-3 min-w-0">
        {/* Top Header & Controls */}
        <section className="rounded-lg border border-slate-800 bg-[#0B111C]/90 p-3 flex flex-col gap-2.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Archive className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-sm md:text-base font-bold text-slate-100 truncate">
                {t('warehouse.title')}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Slot Filter Select */}
              <select
                data-testid="warehouse-slot-filter"
                aria-label={t('warehouse.slotAll')}
                value={slotFilter}
                onChange={(e) =>
                  handleSlotFilterChange(e.target.value as SlotFilter)
                }
                className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100 min-w-0 flex-1 sm:flex-none cursor-pointer"
              >
                <option value="all">{t('warehouse.slotAll')}</option>
                {ITEM_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {getSlotLabel(lang, slot)}
                  </option>
                ))}
              </select>

              {/* Move All Unused Button */}
              <button
                type="button"
                data-testid="warehouse-move-all-btn"
                disabled={transferLocked}
                onClick={handleBulkMoveUnused}
                className={`h-9 px-3 rounded border text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                  transferLocked
                    ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-not-allowed opacity-50'
                    : 'border-amber-500/60 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 cursor-pointer'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                <span>{t('warehouse.moveAllUnusedBtn')}</span>
              </button>
            </div>
          </div>

          {/* Result Toast */}
          {toastText && (
            <div
              role="status"
              data-testid="warehouse-toast"
              className="rounded border border-cyan-500/45 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 flex items-center justify-between gap-2"
            >
              <span className="min-w-0 break-words">{toastText}</span>
              <button
                type="button"
                onClick={() => setToastText(null)}
                aria-label={t('common.close')}
                className="p-1 text-cyan-300 hover:text-cyan-100 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Phone Segmented Switch (< 768px) */}
          <div
            data-testid="warehouse-mobile-switch"
            className="md:hidden grid grid-cols-2 gap-1.5 rounded-lg bg-slate-950/90 p-1 border border-slate-800"
          >
            <button
              type="button"
              data-testid="warehouse-switch-box"
              aria-pressed={mobilePanel === 'box'}
              onClick={() => handleMobilePanelChange('box')}
              className={`h-9 px-2 rounded text-xs font-semibold truncate transition-colors cursor-pointer ${
                isBoxOverCap
                  ? mobilePanel === 'box'
                    ? 'bg-rose-500/20 border border-rose-400/70 text-rose-300'
                    : 'border border-transparent text-rose-400'
                  : mobilePanel === 'box'
                  ? 'bg-amber-500/20 border border-amber-400/70 text-amber-200'
                  : 'border border-transparent text-slate-400'
              }`}
            >
              {t('warehouse.switchBox', {
                count: boxItems.length,
                max: boxCap,
              })}
            </button>
            <button
              type="button"
              data-testid="warehouse-switch-warehouse"
              aria-pressed={mobilePanel === 'warehouse'}
              onClick={() => handleMobilePanelChange('warehouse')}
              className={`h-9 px-2 rounded text-xs font-semibold truncate transition-colors cursor-pointer ${
                mobilePanel === 'warehouse'
                  ? 'bg-amber-500/20 border border-amber-400/70 text-amber-200'
                  : 'border border-transparent text-slate-400'
              }`}
            >
              {t('warehouse.switchStorage', {
                count: warehouseItems.length,
                max: warehouseCap,
              })}
            </button>
          </div>
        </section>

        {/* Side-by-side panels on tablet/desktop; single active panel on phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 min-w-0 items-start">
          {/* Left Panel: Cargo Box ("Hòm đồ") */}
          <section
            data-testid="warehouse-panel-box"
            data-mobile-active={mobilePanel === 'box' ? 'true' : 'false'}
            className={`rounded-lg border border-slate-800 bg-[#0B111C]/90 p-3 min-w-0 flex-col gap-2.5 ${
              mobilePanel === 'box' ? 'flex' : 'hidden md:flex'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
              <h3
                data-testid="warehouse-box-heading"
                data-over-cap={isBoxOverCap ? 'true' : 'false'}
                className={`text-xs md:text-sm font-bold inline-flex items-center gap-1.5 truncate ${
                  isBoxOverCap ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                <PackageOpen
                  className={`w-4 h-4 shrink-0 ${
                    isBoxOverCap ? 'text-rose-400' : 'text-sky-400'
                  }`}
                />
                <span className="truncate">
                  {t('warehouse.boxHeading', {
                    count: boxItems.length,
                    max: boxCap,
                  })}
                </span>
              </h3>
              <button
                type="button"
                data-testid="warehouse-multiselect-btn-box"
                aria-pressed={selectionContainer === 'box'}
                onClick={() => handleToggleSelectionMode('box')}
                className={`h-7 px-2 rounded border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                  selectionContainer === 'box'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>{t('warehouse.selectManyBtn')}</span>
              </button>
            </div>

            {renderSelectionBar('box', filteredBoxItems)}

            {filteredBoxItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                {t('warehouse.emptyBox')}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredBoxItems.map((item) => (
                  <WarehouseItemCell
                    key={item.instanceId}
                    item={item}
                    container="box"
                    equippedBy={getItemEquippedByGear(
                      pilot.gears,
                      item.instanceId
                    )}
                    activeGearId={pilot.activeGearId}
                    selectionMode={selectionContainer === 'box'}
                    isSelected={
                      selectionContainer === 'box' &&
                      selectedIds.includes(item.instanceId)
                    }
                    onSelect={(c, it) => setSelected({ container: c, item: it })}
                    onToggleTick={handleToggleTick}
                    onBlockedEquippedTap={handleBlockedEquippedTap}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right Panel: Warehouse ("Kho đồ") */}
          <section
            data-testid="warehouse-panel-warehouse"
            data-mobile-active={mobilePanel === 'warehouse' ? 'true' : 'false'}
            className={`rounded-lg border border-slate-800 bg-[#0B111C]/90 p-3 min-w-0 flex-col gap-2.5 ${
              mobilePanel === 'warehouse' ? 'flex' : 'hidden md:flex'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
              <h3
                data-testid="warehouse-storage-heading"
                className="text-xs md:text-sm font-bold text-slate-100 inline-flex items-center gap-1.5 truncate"
              >
                <Archive className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">
                  {t('warehouse.storageHeading', {
                    count: warehouseItems.length,
                    max: warehouseCap,
                  })}
                </span>
              </h3>
              <button
                type="button"
                data-testid="warehouse-multiselect-btn-warehouse"
                aria-pressed={selectionContainer === 'warehouse'}
                onClick={() => handleToggleSelectionMode('warehouse')}
                className={`h-7 px-2 rounded border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                  selectionContainer === 'warehouse'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>{t('warehouse.selectManyBtn')}</span>
              </button>
            </div>

            {renderSelectionBar('warehouse', filteredWarehouseItems)}

            {filteredWarehouseItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                {t('warehouse.emptyStorage')}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredWarehouseItems.map((item) => (
                  <WarehouseItemCell
                    key={item.instanceId}
                    item={item}
                    container="warehouse"
                    equippedBy={getItemEquippedByGear(
                      pilot.gears,
                      item.instanceId
                    )}
                    activeGearId={pilot.activeGearId}
                    selectionMode={selectionContainer === 'warehouse'}
                    isSelected={
                      selectionContainer === 'warehouse' &&
                      selectedIds.includes(item.instanceId)
                    }
                    onSelect={(c, it) => setSelected({ container: c, item: it })}
                    onToggleTick={handleToggleTick}
                    onBlockedEquippedTap={handleBlockedEquippedTap}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Cards ("Thẻ") + Vouchers + Buff Cards ("Thẻ buff") + Medals ("Huân chương") */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-w-0 items-start">
          {/* Cards Section ("Thẻ") */}
          <section
            data-testid="warehouse-card-section"
            className="rounded-lg border border-amber-500/30 bg-[#0B111C]/90 p-3 space-y-2.5 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
              <h3 className="text-xs md:text-sm font-bold text-slate-100 inline-flex items-center gap-1.5">
                <CreditCard
                  className="w-4 h-4 text-amber-400 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {t('warehouse.cardSectionTitle', { count: totalOwnedCards })}
                </span>
              </h3>
              <span className="text-[11px] text-slate-400 truncate max-w-full">
                {t('warehouse.cardTargetHint', {
                  gear: getClassName(lang, pilot.activeGearId),
                  level: activeGearForCards?.level ?? 1,
                })}
              </span>
            </div>

            {ownedCardRows.length === 0 ? (
              <p
                data-testid="warehouse-card-empty"
                className="text-xs text-slate-500 py-1"
              >
                {t('warehouse.cardEmpty')}
              </p>
            ) : (
              <div className="space-y-2 min-w-0">
                {ownedCardRows.map(({ def, name, tier, qty }) => (
                  <div
                    key={def.id}
                    data-testid={`warehouse-card-row-${def.id}`}
                    className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        data-testid={`warehouse-card-tier-${def.id}`}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                          def.kind === 'credit'
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                        }`}
                      >
                        T{tier}
                      </span>
                      <span className="font-medium text-slate-100 truncate">
                        {name}
                      </span>
                      <span
                        data-testid={`warehouse-card-qty-${def.id}`}
                        className="font-mono-nums font-bold text-amber-300 shrink-0"
                      >
                        ×{qty}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid={`warehouse-card-use1-${def.id}`}
                        onClick={() => handleRequestRedeemCard(def.id, 1, false)}
                        className="min-h-[34px] px-2.5 rounded border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-semibold text-xs cursor-pointer"
                      >
                        {t('warehouse.cardUseOne')}
                      </button>
                      <button
                        type="button"
                        data-testid={`warehouse-card-useall-${def.id}`}
                        onClick={() => handleRequestRedeemCard(def.id, qty, true)}
                        className="min-h-[34px] px-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        {t('warehouse.cardUseAll')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cardResultText && (
              <div
                data-testid="warehouse-card-result"
                className={`text-xs font-medium px-2.5 py-1.5 rounded border break-words ${
                  cardResultIsError
                    ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                    : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                }`}
              >
                {cardResultText}
              </div>
            )}
          </section>

          {/* Voucher Section */}
          <section
            data-testid="warehouse-voucher-section"
            className="rounded-lg border border-purple-500/30 bg-[#0B111C]/90 p-3 space-y-2.5 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
              <h3 className="text-xs md:text-sm font-bold text-slate-100 inline-flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
                <span>
                  {t('warehouse.voucherSectionTitle', { count: totalOwnedVouchers })}
                </span>
              </h3>

              <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="warehouse-voucher-auto-toggle"
                  checked={autoVoucherEnabled}
                  onChange={(e) => setAutoVoucherEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-purple-500 cursor-pointer"
                />
                <span>{t('warehouse.voucherAutoToggle')}</span>
              </label>
            </div>

            {ownedVoucherRows.length === 0 ? (
              <p
                data-testid="warehouse-voucher-empty"
                className="text-xs text-slate-500 py-1"
              >
                {t('warehouse.voucherEmpty')}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ownedVoucherRows.map(({ def, name, qty }) => (
                  <div
                    key={def.id}
                    data-testid={`warehouse-voucher-row-${def.id}`}
                    className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-2 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <span className="font-medium text-slate-100 truncate">
                      {name}
                    </span>
                    <span
                      data-testid={`warehouse-voucher-qty-${def.id}`}
                      className="font-mono-nums font-bold text-purple-300 shrink-0"
                    >
                      ×{qty}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Buff Cards Section ("Thẻ buff") */}
          <section
            data-testid="warehouse-buff-card-section"
            className="rounded-lg border border-emerald-500/30 bg-[#0B111C]/90 p-3 space-y-2.5 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
              <h3 className="text-xs md:text-sm font-bold text-slate-100 inline-flex items-center gap-1.5">
                <Sparkles
                  className="w-4 h-4 text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {t('warehouse.buffSectionTitle', {
                    count: totalOwnedBuffCards,
                  })}
                </span>
              </h3>
            </div>

            {/* Active Buffs strip ("Buff đang chạy") */}
            <div
              data-testid="warehouse-active-buffs"
              className="rounded border border-emerald-500/25 bg-slate-950/80 p-2 space-y-1.5"
            >
              <div className="text-[11px] font-semibold text-emerald-300">
                {t('warehouse.activeBuffsTitle')}
              </div>
              {activeBuffRows.length === 0 ? (
                <p
                  data-testid="warehouse-active-buffs-empty"
                  className="text-[11px] text-slate-500"
                >
                  {t('warehouse.activeBuffsEmpty')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeBuffRows.map((ab) => (
                    <div
                      key={ab.kind}
                      data-testid={`warehouse-active-buff-${ab.kind}`}
                      className="inline-flex items-center gap-1.5 rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100"
                    >
                      <CatalogIcon
                        row={
                          getCatalogRow(
                            ab.iconId,
                            adminConfig.iconCatalogMods
                          ) ?? null
                        }
                        size="sm"
                        showBadges={false}
                        showArrowBadge={false}
                      />
                      <span>
                        {t('buffCard.activeEntry', {
                          stat: ab.label,
                          pct: ab.pct,
                          tier: ab.tier,
                          battles: ab.battles,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ownedBuffCardRows.length === 0 ? (
              <p
                data-testid="warehouse-buff-empty"
                className="text-xs text-slate-500 py-1"
              >
                {t('warehouse.buffEmpty')}
              </p>
            ) : (
              <div className="space-y-2 min-w-0">
                {ownedBuffCardRows.map(({ def, name, qty, pct }) => (
                  <div
                    key={def.id}
                    data-testid={`warehouse-buff-row-${def.id}`}
                    className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CatalogIcon
                        row={
                          getCatalogRow(
                            def.iconId,
                            adminConfig.iconCatalogMods
                          ) ?? null
                        }
                        size="sm"
                        showBadges={false}
                        showArrowBadge={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-100 truncate">
                          {name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          T{def.tier} · +{pct}% ·{' '}
                          <span
                            data-testid={`warehouse-buff-qty-${def.id}`}
                            className="font-mono-nums font-bold text-emerald-300"
                          >
                            ×{qty}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid={`warehouse-buff-use1-${def.id}`}
                      onClick={() => handleUseBuffCard(def.id)}
                      className="min-h-[34px] px-2.5 rounded border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 font-semibold text-xs cursor-pointer shrink-0"
                    >
                      {t('warehouse.buffUseOne')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {buffResultText && (
              <div
                data-testid="warehouse-buff-result"
                className={`text-xs font-medium px-2.5 py-1.5 rounded border break-words ${
                  buffResultIsError
                    ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                    : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                }`}
              >
                {buffResultText}
              </div>
            )}
          </section>

          {/* Medals Section ("Huân chương") */}
          <section
            data-testid="warehouse-medal-section"
            className="rounded-lg border border-violet-500/30 bg-[#0B111C]/90 p-3 space-y-2.5 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
              <h3 className="text-xs md:text-sm font-bold text-slate-100 inline-flex items-center gap-1.5">
                <CatalogIcon
                  row={
                    getCatalogRow(MEDAL_ICON_ID, adminConfig.iconCatalogMods) ??
                    null
                  }
                  size="sm"
                  showBadges={false}
                  showArrowBadge={false}
                />
                <span>
                  {t('warehouse.medalSectionTitle', { count: totalOwnedMedals })}
                </span>
              </h3>
              <span className="text-[11px] text-slate-400 italic">
                {t('warehouse.medalLore')}
              </span>
            </div>

            {ownedMedalRows.length === 0 ? (
              <p
                data-testid="warehouse-medal-empty"
                className="text-xs text-slate-500 py-1"
              >
                {t('warehouse.medalEmpty')}
              </p>
            ) : (
              <div className="space-y-2 min-w-0">
                {ownedMedalRows.map(({ id, tier, name, wp, qty }) => (
                  <div
                    key={id}
                    data-testid={`warehouse-medal-row-${id}`}
                    className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CatalogIcon
                        row={
                          getCatalogRow(
                            MEDAL_ICON_ID,
                            adminConfig.iconCatalogMods
                          ) ?? null
                        }
                        size="sm"
                        showBadges={false}
                        showArrowBadge={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-100 truncate">
                          {name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          T{tier} · +{wp.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} WP ·{' '}
                          <span
                            data-testid={`warehouse-medal-qty-${id}`}
                            className="font-mono-nums font-bold text-violet-300"
                          >
                            ×{qty}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid={`warehouse-medal-use1-${id}`}
                        onClick={() => handleRedeemMedal(id, 1)}
                        className="min-h-[34px] px-2.5 rounded border border-violet-500/50 bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 font-semibold text-xs cursor-pointer"
                      >
                        {t('warehouse.medalUseOne')}
                      </button>
                      <button
                        type="button"
                        data-testid={`warehouse-medal-useall-${id}`}
                        onClick={() => handleRedeemMedal(id, qty)}
                        className="min-h-[34px] px-2.5 rounded bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        {t('warehouse.medalUseAll')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {medalResultText && (
              <div
                data-testid="warehouse-medal-result"
                className={`text-xs font-medium px-2.5 py-1.5 rounded border break-words ${
                  medalResultIsError
                    ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                    : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                }`}
              >
                {medalResultText}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Item Info & Single-Move Sheet */}
      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected ? (
            <span className={RARITY_META[selected.item.rarity].textClass}>
              {getItemInstanceName(lang, selected.item)}
              {selected.item.enchantLevel > 0
                ? ` +${selected.item.enchantLevel}`
                : ''}
            </span>
          ) : null
        }
        subtitle={
          selected
            ? `${getSlotLabel(lang, selected.item.slot)} · T${selected.item.tier} · ${getRarityLabel(
                lang,
                selected.item.rarity
              )} · ${t('common.levelShort')}${selected.item.requiredLevel} · ${
                selected.item.rollQuality
              }%`
            : undefined
        }
        footer={
          selected ? (
            <div className="flex flex-col gap-2">
              {selectedEquippedBy && (
                <div
                  data-testid="warehouse-sheet-equipped-reason"
                  className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded px-2.5 py-1.5"
                >
                  {t('warehouse.equippedCannotMove', {
                    gear: getClassName(lang, selectedEquippedBy),
                  })}
                </div>
              )}
              <button
                type="button"
                data-testid="warehouse-sheet-move-btn"
                disabled={Boolean(selectedEquippedBy) || transferLocked}
                onClick={handleSingleMove}
                className={`h-10 w-full rounded font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors ${
                  selectedEquippedBy || transferLocked
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                <span>
                  {selected.container === 'box'
                    ? t('warehouse.moveToWarehouseBtn')
                    : t('warehouse.moveToBoxBtn')}
                </span>
              </button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-3 text-xs text-slate-200">
            {/* Status badges */}
            {(selectedEquippedBy ||
              selected.item.locked ||
              selected.item.favorited) && (
              <div className="flex flex-wrap gap-1.5">
                {selectedEquippedBy && (
                  <span
                    data-testid="warehouse-sheet-equipped-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-200 font-semibold"
                  >
                    <ClassIcon
                      classId={selectedEquippedBy}
                      colored={false}
                      className="w-3 h-3"
                    />
                    {t('common.equippedOnGear', {
                      gear: getClassName(lang, selectedEquippedBy),
                    })}
                  </span>
                )}
                {selected.item.locked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200">
                    <Lock className="w-3 h-3" />
                    {t('inv.badgeLocked')}
                  </span>
                )}
                {selected.item.favorited && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/15 border border-yellow-400/40 text-yellow-200">
                    <Star className="w-3 h-3 fill-yellow-400" />
                    {t('inv.badgeFavorited')}
                  </span>
                )}
              </div>
            )}

            {getItemInstanceDesc(lang, selected.item) && (
              <p className="text-slate-400 leading-relaxed">
                {getItemInstanceDesc(lang, selected.item)}
              </p>
            )}

            {selectedStats && (
              <div className="grid grid-cols-2 gap-1.5 rounded border border-slate-800 bg-slate-950/60 p-2.5 font-mono-nums">
                {STAT_KEYS.filter((k) => selectedStats[k] !== 0).map((k) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans">
                      {getStatShort(lang, k)}
                    </span>
                    <span className="text-emerald-300 font-semibold">
                      +{selectedStats[k]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedTraits.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTraits.map((tr) => (
                  <span
                    key={tr}
                    className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300"
                  >
                    {tr}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Replace Active Buff Confirm Dialog */}
      <BottomSheet
        open={pendingBuffReplace !== null}
        onClose={() => setPendingBuffReplace(null)}
        title={t('warehouse.buffConfirmTitle')}
        footer={
          pendingBuffReplace ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid="warehouse-buff-cancel-btn"
                onClick={() => setPendingBuffReplace(null)}
                className="min-h-[40px] px-3.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {t('warehouse.buffCancelBtn')}
              </button>
              <button
                type="button"
                data-testid="warehouse-buff-confirm-btn"
                onClick={() =>
                  handleUseBuffCard(pendingBuffReplace.cardId, true)
                }
                className="min-h-[40px] px-3.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                {t('warehouse.buffConfirmBtn')}
              </button>
            </div>
          ) : undefined
        }
      >
        {pendingBuffReplace && (
          <p
            data-testid="warehouse-buff-confirm-body"
            className="text-sm text-slate-200 leading-relaxed"
          >
            {t('warehouse.buffConfirmBody', {
              old: getBuffCardName(
                lang,
                pendingBuffReplace.kind,
                pendingBuffReplace.previousTier
              ),
              next: getBuffCardName(
                lang,
                pendingBuffReplace.kind,
                pendingBuffReplace.nextTier
              ),
            })}
          </p>
        )}
      </BottomSheet>

      {/* EXP Card Waste Confirm Dialog */}
      <BottomSheet
        open={pendingCardWasteConfirm !== null}
        onClose={() => setPendingCardWasteConfirm(null)}
        title={t('warehouse.cardWasteConfirmTitle')}
        footer={
          pendingCardWasteConfirm ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid="warehouse-card-waste-cancel-btn"
                onClick={() => setPendingCardWasteConfirm(null)}
                className="min-h-[40px] px-3.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {t('warehouse.cardWasteCancelBtn')}
              </button>
              <button
                type="button"
                data-testid="warehouse-card-waste-confirm-btn"
                onClick={() =>
                  handleRedeemCard(
                    pendingCardWasteConfirm.cardId,
                    pendingCardWasteConfirm.qty
                  )
                }
                className="min-h-[40px] px-3.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                {t('warehouse.cardWasteUseBtn')}
              </button>
            </div>
          ) : undefined
        }
      >
        {pendingCardWasteConfirm && (
          <div
            data-testid="warehouse-card-waste-confirm-body"
            className="space-y-1.5 text-sm text-slate-200 leading-relaxed"
          >
            <p>
              {t('warehouse.cardWasteConfirmBody', {
                applied: pendingCardWasteConfirm.appliedExp.toLocaleString(
                  lang === 'vi' ? 'vi-VN' : 'en-US'
                ),
                card: pendingCardWasteConfirm.totalCardExp.toLocaleString(
                  lang === 'vi' ? 'vi-VN' : 'en-US'
                ),
              })}
            </p>
            {pendingCardWasteConfirm.qty > 1 && (
              <p className="text-xs text-amber-300 font-mono-nums">
                {t('warehouse.cardWasteBatchNote', {
                  cards: pendingCardWasteConfirm.qty,
                  levels: pendingCardWasteConfirm.levelsGained,
                })}
              </p>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
