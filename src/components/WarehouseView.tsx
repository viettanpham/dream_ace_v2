import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  Check,
  CheckSquare,
  Lock,
  PackageOpen,
  Star,
  X,
} from 'lucide-react';
import { STAT_KEYS } from '../data/classes';
import { ITEM_SLOTS, RARITY_META } from '../data/items';
import { getEffectiveItemStats, getItemEquippedByGear } from '../engine/equipment';
import {
  getBoxCapacity,
  sanitizeWarehouseCapacity,
} from '../engine/migration';
import type { WarehouseTransferResult } from '../engine/warehouse';
import {
  formatItemTraitsList,
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
import type { ItemInstance, MechClassId } from '../types/game';
import { BottomSheet } from './BottomSheet';
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
  const boxCapacityRaw = useGameStore((s) => s.adminConfig.boxCapacity);
  const warehouseCapacityRaw = useGameStore(
    (s) => s.adminConfig.warehouseCapacity
  );
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

  const [mobilePanel, setMobilePanel] = useState<WarehouseContainer>('box');
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all');
  const [selected, setSelected] = useState<SelectedWarehouseItem | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
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
    </div>
  );
}
