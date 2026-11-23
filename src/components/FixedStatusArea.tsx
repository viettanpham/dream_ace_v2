import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  formatStatusChipShortValue,
  getCatalogRowForStatus,
  getFirstExpiringTurns,
  getStatusVisualKind,
  sortStatusEffects,
} from '../data/statusIconMap';
import { formatStatusEffectDetail, useI18n } from '../i18n';
import type {
  ActiveStatusEffect,
  CombatUnit,
  IconCatalogModRow,
  Language,
  StatusBadgeLayout,
} from '../types/game';
import {
  STATUS_AREA_PAD_TOP_PX,
  STATUS_AREA_PAD_X_PX,
  STATUS_ARROW_BADGE_PX,
  STATUS_BADGE_SAFE_PX,
  STATUS_CHIP_BAR_FRAME_PX,
  STATUS_CHIP_CHAR_WIDTH_PX,
  STATUS_CHIP_COL_GAP_PX,
  STATUS_CHIP_FRAME_PX,
  STATUS_CHIP_OVERFLOW_WIDTH_PX,
  STATUS_CHIP_PAD_LEFT_PX,
  STATUS_CHIP_PAD_RIGHT_PX,
  STATUS_CHIP_VALUE_FONT_PX,
  STATUS_CHIP_VALUE_GAP_PX,
  STATUS_ICON_SIZE_SPECS,
  STATUS_ROW_GAP_PX,
  STATUS_TURNS_BADGE_OUTSET_PX,
  useIsPhoneWidth,
} from '../utils/statusDisplayPrefs';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { StatusChip } from './StatusChip';

export { STATUS_ROW_GAP_PX };

export const CARD_STATUS_FALLBACK_WIDTH_PX = 280;

interface FixedStatusAreaProps {
  statuses: readonly ActiveStatusEffect[];
  rows: number;
  unit?: CombatUnit | null;
  unitTitle?: string;
  badgeLayout?: StatusBadgeLayout;
  iconMods?: readonly IconCatalogModRow[] | null;
  showLabels?: boolean;
  /** Default px width when DOM measurement is 0 (e.g. jsdom or initial render) */
  fallbackWidthPx?: number;
  compact?: boolean;
  rootTestId?: string;
  chipTestIdPrefix?: string;
  labelTestIdPrefix?: string;
  overflowTestId?: string;
  emptyTestId?: string;
  /** When true, keeps fixed row height, renders all chips with internal vertical scroll, no "+N" badge, and shows muted centered empty state */
  scrollOverflow?: boolean;
  /** When true, automatically switches into thin internal vertical scroll only when chips exceed `rows` */
  scrollOnOverflow?: boolean;
  /** When true alongside scrollOverflow/scrollOnOverflow, keeps rendering the "+N" overflow mark */
  showOverflowMarkInScroll?: boolean;
  className?: string;
}

export function getFixedStatusAreaHeightPx(
  rows: number,
  compact = false
): number {
  const safeRows = Math.max(0, Math.min(5, Math.round(rows)));
  if (safeRows === 0) return 0;
  const chipPx = compact ? STATUS_CHIP_BAR_FRAME_PX : STATUS_CHIP_FRAME_PX;
  return safeRows * (chipPx + STATUS_ROW_GAP_PX);
}

function estimateChipWidthPx(
  shortText: string,
  showLabels: boolean,
  compact: boolean
): number {
  const iconBox = compact
    ? STATUS_ICON_SIZE_SPECS.bar.boxPx
    : STATUS_ICON_SIZE_SPECS.sm.boxPx;
  const basePad = STATUS_CHIP_PAD_LEFT_PX + STATUS_CHIP_PAD_RIGHT_PX + 2;
  if (!showLabels) return iconBox + basePad;
  const textW = Math.max(
    STATUS_CHIP_FRAME_PX,
    Math.round(shortText.length * STATUS_CHIP_CHAR_WIDTH_PX)
  );
  return iconBox + basePad + STATUS_CHIP_VALUE_GAP_PX + textW;
}

export function countStatusChipRows(
  statuses: readonly ActiveStatusEffect[],
  options: {
    lang: Language;
    unit?: CombatUnit | null;
    iconMods?: readonly IconCatalogModRow[] | null;
    showLabels?: boolean;
    compact?: boolean;
    containerWidthPx?: number;
  }
): number {
  const {
    lang,
    unit = null,
    iconMods,
    showLabels = true,
    compact = false,
    containerWidthPx = CARD_STATUS_FALLBACK_WIDTH_PX,
  } = options;
  if (statuses.length === 0) return 0;

  const sorted = sortStatusEffects(statuses, iconMods);
  const usableW = Math.max(84, containerWidthPx - STATUS_AREA_PAD_X_PX * 2);
  let row = 1;
  let curW = 0;

  for (const st of sorted) {
    const w = estimateChipWidthPx(
      formatStatusChipShortValue(lang, st, unit, 1, false),
      showLabels,
      compact
    );
    const clampedW = Math.min(usableW, w);
    const needed = curW === 0 ? clampedW : STATUS_CHIP_COL_GAP_PX + clampedW;
    if (curW + needed <= usableW) {
      curW += needed;
    } else {
      row += 1;
      curW = clampedW;
    }
  }
  return row;
}

function packStatusChips(
  items: ReadonlyArray<{ status: ActiveStatusEffect; widthPx: number }>,
  containerWidthPx: number,
  maxRows: number
): { visible: ActiveStatusEffect[]; overflowCount: number; usedRows: number } {
  if (items.length === 0) return { visible: [], overflowCount: 0, usedRows: 0 };

  const usableW = Math.max(84, containerWidthPx - STATUS_AREA_PAD_X_PX * 2);
  const safeRows = Math.max(1, Math.min(5, maxRows));
  const overflowChipW = STATUS_CHIP_OVERFLOW_WIDTH_PX;

  const measureFit = (count: number, withOverflow: boolean): number | null => {
    let row = 1;
    let curW = 0;

    const placeWidth = (w: number): boolean => {
      const clampedW = Math.min(usableW, w);
      const needed = curW === 0 ? clampedW : STATUS_CHIP_COL_GAP_PX + clampedW;
      if (curW + needed <= usableW) {
        curW += needed;
        return true;
      }
      row += 1;
      if (row > safeRows) return false;
      curW = clampedW;
      return true;
    };

    for (let i = 0; i < count; i += 1) {
      if (!placeWidth(items[i].widthPx)) return null;
    }
    if (withOverflow && !placeWidth(overflowChipW)) {
      return null;
    }
    return row;
  };

  const fullRows = measureFit(items.length, false);
  if (fullRows !== null) {
    return {
      visible: items.map((x) => x.status),
      overflowCount: 0,
      usedRows: fullRows,
    };
  }

  for (let k = items.length - 1; k >= 1; k -= 1) {
    const used = measureFit(k, true);
    if (used !== null) {
      return {
        visible: items.slice(0, k).map((x) => x.status),
        overflowCount: items.length - k,
        usedRows: used,
      };
    }
  }

  return {
    visible: [],
    overflowCount: items.length,
    usedRows: 1,
  };
}

export function FixedStatusArea({
  statuses,
  rows,
  unit = null,
  unitTitle,
  badgeLayout = 'B',
  iconMods,
  showLabels = true,
  fallbackWidthPx = CARD_STATUS_FALLBACK_WIDTH_PX,
  compact = false,
  rootTestId,
  chipTestIdPrefix,
  labelTestIdPrefix,
  overflowTestId,
  emptyTestId,
  scrollOverflow = false,
  scrollOnOverflow = false,
  showOverflowMarkInScroll = false,
  className = '',
}: FixedStatusAreaProps) {
  const { lang, t } = useI18n();
  const isPhone = useIsPhoneWidth();
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(fallbackWidthPx);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const syncWidth = () => {
      if (el.clientWidth > 0) {
        setMeasuredWidth(el.clientWidth);
      }
    };
    syncWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, []);

  useEffect(() => {
    if (!detailOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setDetailOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailOpen]);

  const sorted = useMemo(
    () => sortStatusEffects(statuses, iconMods),
    [statuses, iconMods]
  );

  const packed = useMemo(() => {
    const measured = sorted.map((st) => ({
      status: st,
      widthPx: estimateChipWidthPx(
        formatStatusChipShortValue(lang, st, unit, 1, false),
        showLabels,
        compact
      ),
    }));
    const widthToUse = measuredWidth > 0 ? measuredWidth : fallbackWidthPx;
    return packStatusChips(measured, widthToUse, rows);
  }, [sorted, lang, unit, showLabels, compact, measuredWidth, fallbackWidthPx, rows]);

  const effectiveRows = Math.max(0, Math.min(5, Math.round(rows)));
  const heightPx = getFixedStatusAreaHeightPx(effectiveRows, compact);
  const effectiveScrollOverflow =
    scrollOverflow || (scrollOnOverflow && packed.overflowCount > 0);
  const visibleStatuses = effectiveScrollOverflow ? sorted : packed.visible;
  const overflowCount = effectiveScrollOverflow
    ? showOverflowMarkInScroll
      ? packed.overflowCount
      : 0
    : packed.overflowCount;

  const openDetails = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setDetailOpen(true);
  };

  const renderDetailList = () => {
    if (sorted.length === 0) {
      return (
        <div
          data-testid="status-area-detail-empty"
          className="rounded-lg border border-slate-800 bg-[#080D16] px-3 py-2.5 text-xs text-slate-400"
        >
          {t('statusUi.popoverEmpty')}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {sorted.map((st, idx) => {
          const catalogRow = getCatalogRowForStatus(st.type, iconMods);
          const visualKind = getStatusVisualKind(st, catalogRow);
          const detail = formatStatusEffectDetail(lang, st, unit);
          const shortVal = formatStatusChipShortValue(lang, st, unit, 1, false);
          const turns = getFirstExpiringTurns(st, undefined, false);

          return (
            <div
              key={`${st.type}-${idx}`}
              data-testid={`status-detail-item-${st.type}`}
              className={`rounded-lg border pl-4 pr-3 py-2.5 flex items-start gap-2.5 ${
                visualKind === 'debuff'
                  ? 'border-red-500/40 bg-red-950/20'
                  : visualKind === 'buff'
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : 'border-slate-700/80 bg-slate-900/70'
              }`}
            >
              <div className="pt-0.5 shrink-0">
                <CatalogIcon
                  row={catalogRow}
                  fallbackStatusType={st.type}
                  kindOverride={visualKind}
                  size="md"
                  badgeLayout={badgeLayout}
                  turnsLeft={turns}
                  stacks={1}
                  allowStack={false}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-100 truncate">
                    {detail.label}
                  </span>
                  <span className="text-[11px] font-mono-nums text-slate-300 shrink-0">
                    {turns !== null
                      ? t('statusUi.turnsLabel', { turns })
                      : t('statusUi.turnsInfinite')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 leading-snug">
                  {detail.fullText}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono-nums text-slate-400">
                  <span>
                    {t('statusUi.valueLabel')}:{' '}
                    <strong className="text-slate-200">{shortVal}</strong>
                  </span>
                  <span>
                    {t('statusUi.stacksLabel')}: <strong className="text-slate-200">1</strong>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (effectiveRows <= 0) {
    return null;
  }

  return (
    <>
      <div
        ref={areaRef}
        data-testid={rootTestId}
        data-status-area-rows={effectiveRows}
        data-status-count={sorted.length}
        role="button"
        tabIndex={0}
        aria-label={t('statusUi.popoverTitle')}
        onClick={openDetails}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setDetailOpen(true);
          }
        }}
        style={{
          height: `${heightPx}px`,
          minHeight: `${heightPx}px`,
          maxHeight: `${heightPx}px`,
          rowGap: `${STATUS_ROW_GAP_PX}px`,
          columnGap: `${STATUS_CHIP_COL_GAP_PX}px`,
          paddingLeft: `${
            effectiveScrollOverflow
              ? STATUS_AREA_PAD_X_PX + STATUS_BADGE_SAFE_PX
              : STATUS_AREA_PAD_X_PX
          }px`,
          paddingRight: `${
            effectiveScrollOverflow
              ? STATUS_AREA_PAD_X_PX + STATUS_BADGE_SAFE_PX
              : STATUS_AREA_PAD_X_PX
          }px`,
          paddingTop: `${
            compact
              ? STATUS_AREA_PAD_TOP_PX
              : effectiveScrollOverflow
              ? sorted.length > 0
                ? STATUS_AREA_PAD_TOP_PX + STATUS_BADGE_SAFE_PX
                : STATUS_BADGE_SAFE_PX
              : STATUS_BADGE_SAFE_PX
          }px`,
          paddingBottom: `${
            compact
              ? 0
              : effectiveScrollOverflow
              ? sorted.length > 0
                ? Math.max(
                    STATUS_BADGE_SAFE_PX,
                    STATUS_TURNS_BADGE_OUTSET_PX +
                      Math.ceil(STATUS_ARROW_BADGE_PX / 2) +
                      1
                  )
                : STATUS_BADGE_SAFE_PX
              : STATUS_BADGE_SAFE_PX
          }px`,
        }}
        className={`w-full min-w-0 flex flex-wrap ${
          scrollOverflow && sorted.length === 0
            ? 'items-center justify-center'
            : 'content-start items-start'
        } ${
          effectiveScrollOverflow
            ? 'overflow-y-auto overflow-x-hidden tactical-scroll tactical-scroll-thin'
            : 'overflow-visible'
        } rounded cursor-pointer hover:bg-slate-800/30 transition-colors ${className}`}
      >
        {scrollOverflow && sorted.length === 0 ? (
          <div
            data-testid={emptyTestId}
            className="w-full h-full flex items-center justify-center text-center text-[12px] text-slate-400 select-none"
          >
            {t('statusUi.areaEmpty')}
          </div>
        ) : (
          visibleStatuses.map((st, idx) => (
            <StatusChip
              key={`${st.type}-${idx}`}
              status={st}
              lang={lang}
              unit={unit}
              badgeLayout={badgeLayout}
              iconMods={iconMods}
              size={compact ? 'bar' : 'sm'}
              showLabel={showLabels}
              allowStack={false}
              stacks={1}
              testId={chipTestIdPrefix ? `${chipTestIdPrefix}-${idx}` : undefined}
              labelTestId={
                labelTestIdPrefix ? `${labelTestIdPrefix}-${idx}` : undefined
              }
            />
          ))
        )}

        {overflowCount > 0 && (
          <span
            data-testid={overflowTestId}
            style={{
              height: `${compact ? STATUS_CHIP_BAR_FRAME_PX : STATUS_CHIP_FRAME_PX}px`,
              fontSize: `${STATUS_CHIP_VALUE_FONT_PX}px`,
            }}
            className="inline-flex items-center justify-center px-1.5 rounded border border-slate-600/80 bg-slate-900 font-mono-nums font-bold text-slate-200 shrink-0"
          >
            +{overflowCount}
          </span>
        )}
      </div>

      {/* Responsive full effect list: BottomSheet on phone <= 640px, Popover Modal on desktop > 640px */}
      {isPhone ? (
        <BottomSheet
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title={unitTitle ? `${unitTitle} — ${t('statusUi.popoverTitle')}` : t('statusUi.popoverTitle')}
        >
          <div data-testid="status-area-sheet-body" onClick={(e) => e.stopPropagation()}>
            {renderDetailList()}
          </div>
        </BottomSheet>
      ) : (
        detailOpen && (
          <div
            data-testid="status-area-popover-backdrop"
            onClick={(e) => {
              e.stopPropagation();
              setDetailOpen(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          >
            <div
              role="dialog"
              aria-modal="true"
              data-testid="status-area-popover"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[80vh] flex flex-col rounded-xl border border-slate-700 bg-[#0A101B] text-slate-100 shadow-2xl overflow-hidden"
            >
              <div className="px-3.5 py-2.5 border-b border-slate-800 bg-[#0E1624] flex items-center justify-between gap-2 shrink-0">
                <span className="font-display text-sm font-bold text-slate-100 truncate">
                  {unitTitle
                    ? `${unitTitle} — ${t('statusUi.popoverTitle')}`
                    : t('statusUi.popoverTitle')}
                </span>
                <button
                  type="button"
                  data-testid="status-area-popover-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailOpen(false);
                  }}
                  aria-label={t('common.close')}
                  className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 overflow-y-auto tactical-scroll">
                {renderDetailList()}
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
}
