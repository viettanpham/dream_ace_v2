import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Coins,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { sanitizeMaxLevel } from '../data/balance';
import { getSellPrice } from '../engine/equipment';
import { calculateItemPowerScore } from '../engine/inventory';
import {
  buildQuickSellPreset,
  evaluateQuickSellCandidatesWithSources,
} from '../engine/quickSell';
import { getItemInstanceName, getRarityLabel, useI18n } from '../i18n';
import { isBattleActive, useGameStore } from '../store/useGameStore';
import type { ItemRarity, QuickSellPresetId } from '../types/game';
import { SlotIcon } from './GameIcons';

interface QuickSellModalProps {
  open: boolean;
  onClose: () => void;
  onSold?: (count: number, credits: number, skippedCount: number) => void;
}

const RARITY_OPTIONS: ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

function rarityTextClass(rarity: ItemRarity): string {
  switch (rarity) {
    case 'legendary':
      return 'text-amber-300';
    case 'epic':
      return 'text-purple-300';
    case 'rare':
      return 'text-sky-300';
    case 'uncommon':
      return 'text-emerald-300';
    default:
      return 'text-slate-200';
  }
}

export function QuickSellModal({ open, onClose, onSold }: QuickSellModalProps) {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const config = useGameStore((s) => s.quickSellConfig);
  const maxLevel = useGameStore((s) => sanitizeMaxLevel(s.adminConfig?.maxLevel));
  const setQuickSellConfig = useGameStore((s) => s.setQuickSellConfig);
  const executeQuickSell = useGameStore((s) => s.executeQuickSell);
  const screen = useGameStore((s) => s.screen);
  const battle = useGameStore((s) => s.battle);
  const autoRepeatActive = useGameStore((s) =>
    Boolean(s.autoRepeatSession?.active)
  );

  const [includeBox, setIncludeBox] = useState(true);
  const [includeWarehouse, setIncludeWarehouse] = useState(false);
  const [uncheckedIds, setUncheckedIds] = useState<Set<string>>(new Set());
  const [confirmStep, setConfirmStep] = useState(false);

  const activeGear = pilot.gears[pilot.activeGearId];
  const warehouseItems = Array.isArray(pilot.warehouse) ? pilot.warehouse : [];
  const hasWarehouseItems = warehouseItems.length > 0;
  const effectiveWarehouse = includeWarehouse && hasWarehouseItems;
  const warehouseSellBlocked =
    effectiveWarehouse && (isBattleActive({ screen, battle }) || autoRepeatActive);

  useEffect(() => {
    if (open) {
      setIncludeBox(true);
      setIncludeWarehouse(false);
      setUncheckedIds(new Set());
      setConfirmStep(false);
    }
  }, [open]);

  const evaluation = useMemo(
    () =>
      evaluateQuickSellCandidatesWithSources(
        pilot.inventory,
        warehouseItems,
        { box: includeBox, warehouse: effectiveWarehouse },
        config,
        activeGear,
        pilot.gears
      ),
    [
      pilot.inventory,
      warehouseItems,
      includeBox,
      effectiveWarehouse,
      config,
      activeGear,
      pilot.gears,
    ]
  );

  const selectedItems = useMemo(
    () =>
      evaluation.matchingItems.filter(
        (it) => !uncheckedIds.has(it.instanceId)
      ),
    [evaluation.matchingItems, uncheckedIds]
  );

  const selectedCredits = useMemo(
    () => selectedItems.reduce((sum, it) => sum + getSellPrice(it), 0),
    [selectedItems]
  );

  if (!open) return null;

  const applyPreset = (preset: QuickSellPresetId) => {
    const next = buildQuickSellPreset(preset, activeGear.level);
    setQuickSellConfig(next);
    setUncheckedIds(new Set());
    setConfirmStep(false);
  };

  const toggleItemCheck = (instanceId: string) => {
    setUncheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const handleConfirmSell = () => {
    if (warehouseSellBlocked) return;
    const ids = selectedItems.map((it) => it.instanceId);
    const res = executeQuickSell(ids);
    const skippedCount =
      evaluation.excludedStats.equipped + evaluation.excludedStats.locked;
    setConfirmStep(false);
    if (res.soldCount > 0) {
      onSold?.(res.soldCount, res.creditsEarned, skippedCount);
      onClose();
    }
  };

  const noSourceChecked = !includeBox && !effectiveWarehouse;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('qs.title')}
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-xl border border-slate-700 bg-[#0B111C] text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-[#0E1522] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-wide text-amber-300 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('qs.title')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('qs.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('error.closeBtn')}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Source Scope Checkboxes */}
          <div
            data-testid="quicksell-sources"
            className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-[#080D16]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('qs.sourcesLabel')}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-200">
                <input
                  type="checkbox"
                  data-testid="quicksell-source-box"
                  checked={includeBox}
                  onChange={(e) => {
                    setIncludeBox(e.target.checked);
                    setConfirmStep(false);
                  }}
                  className="w-4 h-4 accent-amber-400"
                />
                <span>{t('qs.sourceBox', { count: pilot.inventory.length })}</span>
              </label>

              {hasWarehouseItems && (
                <label
                  data-testid="quicksell-source-warehouse-label"
                  className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-200"
                >
                  <input
                    type="checkbox"
                    data-testid="quicksell-source-warehouse"
                    checked={includeWarehouse}
                    onChange={(e) => {
                      setIncludeWarehouse(e.target.checked);
                      setConfirmStep(false);
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                  <span>
                    {t('qs.sourceWarehouse', { count: warehouseItems.length })}
                  </span>
                </label>
              )}
            </div>
          </div>

          {warehouseSellBlocked && (
            <div
              data-testid="quicksell-warehouse-blocked-reason"
              role="alert"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{t('qs.warehouseBlockedReason')}</span>
            </div>
          )}

          {/* Presets */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('qs.presetsLabel')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  'sell_common',
                  'sell_below_level',
                  'sell_worse_than_equipped',
                ] as QuickSellPresetId[]
              ).map((presetId) => (
                <button
                  key={presetId}
                  type="button"
                  onClick={() => applyPreset(presetId)}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-700 bg-slate-900 hover:border-amber-400/70 hover:text-amber-200 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  {t(`qs.preset.${presetId}`)}
                </button>
              ))}
            </div>
          </div>

          {/* AND Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-slate-800 bg-[#080D16]">
            {/* Max Rarity */}
            <label className="space-y-1 block">
              <span className="text-xs text-slate-400 block">
                {t('qs.filterMaxRarity')}
              </span>
              <select
                value={config.maxRarity ?? ''}
                onChange={(e) =>
                  setQuickSellConfig({
                    maxRarity: e.target.value
                      ? (e.target.value as ItemRarity)
                      : null,
                  })
                }
                className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
              >
                <option value="">{t('qs.anyOption')}</option>
                {RARITY_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {getRarityLabel(lang, r)}
                  </option>
                ))}
              </select>
            </label>

            {/* Max Tier */}
            <label className="space-y-1 block">
              <span className="text-xs text-slate-400 block">
                {t('qs.filterMaxTier')}
              </span>
              <select
                value={config.maxTier ?? ''}
                onChange={(e) =>
                  setQuickSellConfig({
                    maxTier: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
              >
                <option value="">{t('qs.anyOption')}</option>
                {[1, 2, 3, 4].map((tier) => (
                  <option key={tier} value={tier}>
                    T{tier}
                  </option>
                ))}
              </select>
            </label>

            {/* Max Required Level */}
            <label className="space-y-1 block">
              <span className="text-xs text-slate-400 block">
                {t('qs.filterMaxReqLevel')}
              </span>
              <input
                type="number"
                min={1}
                max={maxLevel}
                placeholder={t('qs.anyOption')}
                value={config.maxRequiredLevel ?? ''}
                onChange={(e) =>
                  setQuickSellConfig({
                    maxRequiredLevel:
                      e.target.value === ''
                        ? null
                        : Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100 font-mono-nums"
              />
            </label>

            {/* Max Sell Value */}
            <label className="space-y-1 block">
              <span className="text-xs text-slate-400 block">
                {t('qs.filterMaxSellValue')}
              </span>
              <input
                type="number"
                min={1}
                placeholder={t('qs.anyOption')}
                value={config.maxSellValue ?? ''}
                onChange={(e) =>
                  setQuickSellConfig({
                    maxSellValue:
                      e.target.value === ''
                        ? null
                        : Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100 font-mono-nums"
              />
            </label>

            {/* Max Roll Quality */}
            <label className="space-y-1 block">
              <span className="text-xs text-slate-400 block">
                {t('qs.filterMaxQuality')}
              </span>
              <input
                type="number"
                min={1}
                max={100}
                placeholder={t('qs.anyOption')}
                value={config.maxRollQuality ?? ''}
                onChange={(e) =>
                  setQuickSellConfig({
                    maxRollQuality:
                      e.target.value === ''
                        ? null
                        : Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                  })
                }
                className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100 font-mono-nums"
              />
            </label>

            {/* Below Equipped Level checkbox */}
            <label className="flex items-center gap-2.5 pt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.belowEquippedLevel}
                onChange={(e) =>
                  setQuickSellConfig({ belowEquippedLevel: e.target.checked })
                }
                className="w-4 h-4 accent-amber-400"
              />
              <span className="text-xs text-slate-200">
                {t('qs.filterBelowEquippedLevel')}
              </span>
            </label>

            {/* Worse than equipped + Scope */}
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.worseThanEquipped}
                  onChange={(e) =>
                    setQuickSellConfig({ worseThanEquipped: e.target.checked })
                  }
                  className="w-4 h-4 accent-amber-400"
                />
                <span className="text-xs text-slate-200">
                  {t('qs.filterWorseThanEquipped')}
                </span>
              </label>

              {config.worseThanEquipped && (
                <div className="inline-flex rounded border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setQuickSellConfig({ worseThanEquippedScope: 'selected' })
                    }
                    className={`px-2 py-1 rounded cursor-pointer ${
                      config.worseThanEquippedScope === 'selected'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {t('qs.worseScopeSelected')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickSellConfig({ worseThanEquippedScope: 'any_owned' })
                    }
                    className={`px-2 py-1 rounded cursor-pointer ${
                      config.worseThanEquippedScope === 'any_owned'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {t('qs.worseScopeAny')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Auto-Protected Notice */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {t('qs.protectedNotice', {
                equipped: evaluation.excludedStats.equipped,
                locked: evaluation.excludedStats.locked,
                favorited: evaluation.excludedStats.favorited,
              })}
            </span>
          </div>

          {/* Live Preview List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>
                {t('qs.previewTitle', {
                  count: selectedItems.length,
                  credits: selectedCredits.toLocaleString(),
                })}
              </span>
            </div>

            {noSourceChecked ? (
              <div
                data-testid="quicksell-no-source-hint"
                className="p-4 rounded-lg border border-dashed border-slate-700 text-center text-xs text-slate-400"
              >
                {t('qs.noSourceHint')}
              </div>
            ) : !evaluation.hasAnyFilterEnabled ? (
              <div className="p-4 rounded-lg border border-dashed border-slate-700 text-center text-xs text-slate-400">
                {t('qs.noFilterHint')}
              </div>
            ) : evaluation.matchingEntries.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-slate-700 text-center text-xs text-slate-400">
                {t('qs.noMatchHint')}
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/80 bg-[#080D16]">
                {evaluation.matchingEntries.map(({ item: it, source }) => {
                  const checked = !uncheckedIds.has(it.instanceId);
                  const sellVal = getSellPrice(it);
                  const pwr = calculateItemPowerScore(it);
                  return (
                    <label
                      key={it.instanceId}
                      data-testid={`quicksell-preview-row-${it.instanceId}`}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-900/70 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItemCheck(it.instanceId)}
                        className="w-4 h-4 accent-amber-400 shrink-0"
                      />
                      <SlotIcon
                        slot={it.slot}
                        className="w-3.5 h-3.5 text-slate-400 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-xs font-semibold truncate ${rarityTextClass(
                              it.rarity
                            )}`}
                          >
                            {getItemInstanceName(lang, it, true)}
                          </span>
                          <span
                            data-testid={`quicksell-row-source-${it.instanceId}`}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 border ${
                              source === 'warehouse'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                            }`}
                          >
                            {source === 'warehouse'
                              ? t('qs.sourceTagWarehouse')
                              : t('qs.sourceTagBox')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-nums flex items-center gap-2">
                          <span>T{it.tier}</span>
                          <span>
                            {t('common.levelShort')}
                            {it.requiredLevel}
                          </span>
                          <span>Q{it.rollQuality}%</span>
                          <span>{t('inv.powerScoreShort', { score: pwr })}</span>
                        </div>
                      </div>
                      <span className="font-mono-nums text-xs font-semibold text-amber-300 shrink-0">
                        +{sellVal} CR
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer / Confirm Step */}
        <div className="px-4 py-3 border-t border-slate-800 bg-[#0E1522] shrink-0 pb-safe">
          {confirmStep ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {t('qs.confirmPrompt', {
                    count: selectedItems.length,
                    credits: selectedCredits.toLocaleString(),
                  })}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  className="min-h-[42px] px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  {t('qs.cancelBtn')}
                </button>
                <button
                  type="button"
                  data-testid="quicksell-confirm-execute"
                  disabled={selectedItems.length === 0 || warehouseSellBlocked}
                  onClick={handleConfirmSell}
                  className="min-h-[42px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('qs.confirmExecute')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                {t('qs.cancelBtn')}
              </button>
              <button
                type="button"
                data-testid="quicksell-open-confirm"
                disabled={selectedItems.length === 0 || warehouseSellBlocked}
                onClick={() => setConfirmStep(true)}
                className="min-h-[42px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Coins className="w-4 h-4" />
                <span>
                  {t('qs.confirmBtn', {
                    count: selectedItems.length,
                    credits: selectedCredits.toLocaleString(),
                  })}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
