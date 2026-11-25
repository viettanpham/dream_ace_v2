import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getTeamColorRole } from '../engine/combat';
import { useI18n } from '../i18n';
import type {
  CombatRow,
  CombatUnit,
  IconCatalogModRow,
  StatusBadgeLayout,
} from '../types/game';
import {
  STATUS_BADGE_SAFE_PX,
  STATUS_CHIP_FRAME_PX,
} from '../utils/statusDisplayPrefs';
import {
  CARD_STATUS_FALLBACK_WIDTH_PX,
  countStatusChipRows,
  FixedStatusArea,
} from './FixedStatusArea';

export const STATUS_BOARD_STORAGE_KEY = 'dreamAce.statusBoard.v1';
export const STATUS_BOARD_HEADER_HEIGHT_PX = 28;
export const STATUS_BOARD_ROW_HEIGHT_PX =
  STATUS_CHIP_FRAME_PX + 2 * STATUS_BADGE_SAFE_PX + 4;
export const STATUS_BOARD_MAX_VISIBLE_ROWS = 4;
export const STATUS_BOARD_DESKTOP_HEIGHT_PX =
  STATUS_BOARD_HEADER_HEIGHT_PX +
  STATUS_BOARD_MAX_VISIBLE_ROWS * STATUS_BOARD_ROW_HEIGHT_PX;
export const STATUS_BOARD_DESKTOP_MAX_CHIPS = 6;
export const STATUS_BOARD_PHONE_MAX_CHIPS = 4;

const BOARD_PHONE_FALLBACK_WIDTH_PX = 240;
const BOARD_MAX_VISIBLE_CHIP_ROWS = 2;

export function readStatusBoardCollapsed(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(STATUS_BOARD_STORAGE_KEY);
    if (!raw) return false;
    if (raw === 'collapsed' || raw === 'true') return true;
    if (raw === 'expanded' || raw === 'false') return false;
    const parsed = JSON.parse(raw) as { collapsed?: unknown } | null;
    if (parsed && typeof parsed === 'object' && typeof parsed.collapsed === 'boolean') {
      return parsed.collapsed;
    }
    return false;
  } catch {
    return false;
  }
}

export function writeStatusBoardCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      STATUS_BOARD_STORAGE_KEY,
      collapsed ? 'collapsed' : 'expanded'
    );
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

const ROW_ORDER_RANK: Record<CombatRow, number> = {
  front: 0,
  middle: 1,
  back: 2,
};

function getTeamAccentColor(unit: CombatUnit): string {
  const role = getTeamColorRole(unit);
  if (role === 'me') return 'var(--team-me)';
  if (role === 'ally') return 'var(--team-ally)';
  if (role === 'boss') return 'var(--team-boss)';
  return 'var(--team-enemy)';
}

/**
 * Sorts status board rows: player unit first, then lane order front -> middle -> back,
 * breaking ties deterministically by formation column and id.
 */
export function sortStatusBoardUnits(
  units: readonly CombatUnit[]
): CombatUnit[] {
  return [...units].sort((a, b) => {
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    const rowDiff =
      (ROW_ORDER_RANK[a.row] ?? 9) - (ROW_ORDER_RANK[b.row] ?? 9);
    if (rowDiff !== 0) return rowDiff;
    const colDiff = (a.formationCol ?? 0) - (b.formationCol ?? 0);
    if (colDiff !== 0) return colDiff;
    return a.id.localeCompare(b.id);
  });
}

export function filterAndSortStatusBoardSide(
  units: readonly CombatUnit[],
  side: 'ally' | 'enemy'
): CombatUnit[] {
  const eligible = units.filter(
    (u) => u.side === side && u.alive && u.statuses.length > 0
  );
  return sortStatusBoardUnits(eligible);
}

export interface RadarStatusBoardProps {
  units: readonly CombatUnit[];
  variant: 'desktop' | 'phone';
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedUnitId?: string | null;
  onSelectUnit: (unit: CombatUnit) => void;
  badgeLayout?: StatusBadgeLayout;
  iconMods?: readonly IconCatalogModRow[] | null;
}

export function RadarStatusBoard({
  units,
  variant,
  collapsed,
  onToggleCollapse,
  selectedUnitId = null,
  onSelectUnit,
  badgeLayout = 'B',
  iconMods,
}: RadarStatusBoardProps) {
  const { lang, t } = useI18n();
  const isPhone = variant === 'phone';
  const defaultChipWidthPx = isPhone
    ? BOARD_PHONE_FALLBACK_WIDTH_PX
    : CARD_STATUS_FALLBACK_WIDTH_PX;

  const boardBodyRef = useRef<HTMLDivElement | null>(null);
  const [measuredBodyWidth, setMeasuredBodyWidth] = useState<number>(0);

  useEffect(() => {
    if (collapsed) return;
    const el = boardBodyRef.current;
    if (!el) return;
    const syncWidth = () => {
      if (el.clientWidth > 0) {
        setMeasuredBodyWidth(el.clientWidth);
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
  }, [collapsed, isPhone]);

  const chipAreaWidthPx = useMemo(() => {
    if (measuredBodyWidth <= 0) return defaultChipWidthPx;
    if (isPhone) {
      // px-2 (16) + 100px name + gap-2 (8) = 124px
      return Math.max(120, measuredBodyWidth - 124);
    }
    // 2 columns + 1px divider; each row: px-2 (16) + 110px name + gap-2 (8) = 134px
    const colWidth = Math.floor((measuredBodyWidth - 1) / 2);
    return Math.max(120, colWidth - 134);
  }, [measuredBodyWidth, isPhone, defaultChipWidthPx]);

  const allyUnits = useMemo(
    () => filterAndSortStatusBoardSide(units, 'ally'),
    [units]
  );
  const enemyUnits = useMemo(
    () => filterAndSortStatusBoardSide(units, 'enemy'),
    [units]
  );

  const allyNeededRows = useMemo(
    () =>
      allyUnits.map((unit) =>
        countStatusChipRows(unit.statuses, {
          lang,
          unit,
          iconMods,
          showLabels: true,
          compact: false,
          containerWidthPx: chipAreaWidthPx,
        })
      ),
    [allyUnits, lang, iconMods, chipAreaWidthPx]
  );

  const enemyNeededRows = useMemo(
    () =>
      enemyUnits.map((unit) =>
        countStatusChipRows(unit.statuses, {
          lang,
          unit,
          iconMods,
          showLabels: true,
          compact: false,
          containerWidthPx: chipAreaWidthPx,
        })
      ),
    [enemyUnits, lang, iconMods, chipAreaWidthPx]
  );

  const desktopPairRows = useMemo(() => {
    const pairCount = Math.max(allyUnits.length, enemyUnits.length);
    const result: number[] = [];
    for (let i = 0; i < pairCount; i += 1) {
      const maxForRow = Math.max(
        allyNeededRows[i] ?? 0,
        enemyNeededRows[i] ?? 0
      );
      result.push(Math.max(1, Math.min(BOARD_MAX_VISIBLE_CHIP_ROWS, maxForRow)));
    }
    return result;
  }, [allyUnits.length, enemyUnits.length, allyNeededRows, enemyNeededRows]);

  const totalRows = allyUnits.length + enemyUnits.length;

  const renderUnitRow = (unit: CombatUnit, areaRows: number) => {
    const isSelected = selectedUnitId === unit.id;
    const accentColor = getTeamAccentColor(unit);

    return (
      <div
        key={unit.id}
        data-testid={`status-board-row-${unit.id}`}
        data-unit-side={unit.side}
        data-unit-row={unit.row}
        data-status-rows={areaRows}
        data-selected={isSelected ? 'true' : 'false'}
        onClick={() => onSelectUnit(unit)}
        className={`relative w-full px-2 py-1 flex items-center gap-2 text-left transition-colors min-w-0 overflow-y-visible ${
          isSelected
            ? 'bg-sky-500/18 ring-1 ring-inset ring-sky-400/60'
            : 'hover:bg-slate-800/50'
        }`}
      >
        <button
          type="button"
          data-testid={`status-board-name-${unit.id}`}
          title={unit.name}
          style={{ color: accentColor }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectUnit(unit);
          }}
          className={`${
            isPhone ? 'w-[100px] max-w-[100px]' : 'w-[110px] max-w-[110px]'
          } shrink-0 truncate text-left text-[12px] font-semibold leading-tight cursor-pointer py-1`}
        >
          {unit.name}
        </button>

        <FixedStatusArea
          statuses={unit.statuses}
          rows={areaRows}
          unit={unit}
          unitTitle={unit.name}
          badgeLayout={badgeLayout}
          iconMods={iconMods}
          showLabels={true}
          fallbackWidthPx={chipAreaWidthPx}
          compact={false}
          scrollOnOverflow={true}
          showOverflowMarkInScroll={true}
          rootTestId={`status-board-chips-${unit.id}`}
          chipTestIdPrefix={`status-board-chip-${unit.id}`}
          labelTestIdPrefix={`status-board-chip-label-${unit.id}`}
          overflowTestId={`status-board-overflow-${unit.id}`}
          className="flex-1 min-w-0"
        />
      </div>
    );
  };

  return (
    <section
      data-testid="radar-status-board"
      data-variant={variant}
      data-collapsed={collapsed ? 'true' : 'false'}
      style={
        !isPhone && !collapsed
          ? {
              height: `${STATUS_BOARD_DESKTOP_HEIGHT_PX}px`,
              minHeight: `${STATUS_BOARD_DESKTOP_HEIGHT_PX}px`,
              maxHeight: `${STATUS_BOARD_DESKTOP_HEIGHT_PX}px`,
            }
          : undefined
      }
      className={`shrink-0 min-w-0 w-full rounded-lg border border-slate-800/90 bg-[#0A101B]/95 flex flex-col ${
        isPhone
          ? ''
          : collapsed
          ? 'overflow-hidden'
          : 'overflow-hidden h-[220px] min-h-[220px] max-h-[220px]'
      }`}
    >
      <button
        type="button"
        data-testid="status-board-toggle"
        aria-expanded={!collapsed}
        aria-label={
          collapsed
            ? t('statusBoard.expandLabel')
            : t('statusBoard.collapseLabel')
        }
        onClick={onToggleCollapse}
        style={{
          height: `${STATUS_BOARD_HEADER_HEIGHT_PX}px`,
          minHeight: `${STATUS_BOARD_HEADER_HEIGHT_PX}px`,
          maxHeight: `${STATUS_BOARD_HEADER_HEIGHT_PX}px`,
        }}
        className={`w-full h-[28px] min-h-[28px] max-h-[28px] px-2.5 flex items-center justify-between gap-2 text-left bg-[#0E1624] hover:bg-slate-800/75 transition-colors cursor-pointer shrink-0 ${
          collapsed ? '' : 'border-b border-slate-800/90'
        }`}
      >
        <span
          data-testid="status-board-header-title"
          className="text-[12px] font-semibold font-mono-nums text-slate-200 truncate"
        >
          {t('statusBoard.header', {
            allies: allyUnits.length,
            enemies: enemyUnits.length,
          })}
        </span>
        {collapsed ? (
          <ChevronRight
            className="w-4 h-4 text-slate-400 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className="w-4 h-4 text-sky-400 shrink-0"
            aria-hidden="true"
          />
        )}
      </button>

      {!collapsed && (
        <div
          ref={boardBodyRef}
          data-testid="status-board-body"
          className={
            isPhone
              ? 'flex flex-col divide-y divide-slate-800/80'
              : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden tactical-scroll tactical-scroll-thin'
          }
        >
          {totalRows === 0 ? (
            <div
              data-testid="status-board-empty"
              className={
                isPhone
                  ? 'py-3 px-2.5 text-center text-[12px] text-slate-400'
                  : 'h-full min-h-0 flex items-center justify-center px-3 text-center text-[12px] text-slate-400'
              }
            >
              {t('statusBoard.empty')}
            </div>
          ) : isPhone ? (
            <div className="flex flex-col divide-y divide-slate-800/80">
              {allyUnits.length > 0 && (
                <div
                  data-testid="status-board-col-ally"
                  className="flex flex-col divide-y divide-slate-800/50"
                >
                  <div className="px-2.5 py-0.5 bg-sky-950/20 text-[11px] font-mono-nums font-bold text-sky-300">
                    {t('statusBoard.allyCol')} ({allyUnits.length})
                  </div>
                  {allyUnits.map((unit, idx) =>
                    renderUnitRow(
                      unit,
                      Math.max(
                        1,
                        Math.min(
                          BOARD_MAX_VISIBLE_CHIP_ROWS,
                          allyNeededRows[idx] ?? 1
                        )
                      )
                    )
                  )}
                </div>
              )}
              {enemyUnits.length > 0 && (
                <div
                  data-testid="status-board-col-enemy"
                  className="flex flex-col divide-y divide-slate-800/50"
                >
                  <div className="px-2.5 py-0.5 bg-red-950/20 text-[11px] font-mono-nums font-bold text-red-300">
                    {t('statusBoard.enemyCol')} ({enemyUnits.length})
                  </div>
                  {enemyUnits.map((unit, idx) =>
                    renderUnitRow(
                      unit,
                      Math.max(
                        1,
                        Math.min(
                          BOARD_MAX_VISIBLE_CHIP_ROWS,
                          enemyNeededRows[idx] ?? 1
                        )
                      )
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-slate-800/80 min-h-full">
              <div
                data-testid="status-board-col-ally"
                className="min-w-0 flex flex-col divide-y divide-slate-800/40"
              >
                {allyUnits.map((unit, idx) =>
                  renderUnitRow(unit, desktopPairRows[idx] ?? 1)
                )}
              </div>
              <div
                data-testid="status-board-col-enemy"
                className="min-w-0 flex flex-col divide-y divide-slate-800/40"
              >
                {enemyUnits.map((unit, idx) =>
                  renderUnitRow(unit, desktopPairRows[idx] ?? 1)
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
