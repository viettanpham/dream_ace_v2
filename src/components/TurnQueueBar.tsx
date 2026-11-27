import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Flame,
  ListOrdered,
  Swords,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { getCatalogRow } from '../data/iconCatalog';
import { buildTurnQueue } from '../engine/combat';
import {
  ENRAGE_PHASE_ORDER,
  formatEnragePhaseSummaryPart,
  formatEnrageTooltip,
  getEnragePhaseDisplayName,
  getEnragePhaseNextStackRound,
  getEnrageState,
  sanitizeEnrageConfig,
  type EnrageState,
} from '../engine/enrage';
import { getClassName, getTeamTagLabel, useI18n } from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  BattleSpeed,
  BattleState,
  EnragePhaseKey,
  MechClassId,
  TeamColorRole,
  TurnQueueEntry,
} from '../types/game';
import {
  buildUpcomingTurnList,
  formatShortUnitName,
  getTurnQueueSidebarListHeightPx,
  getTurnQueueSidebarRowCount,
  getTurnQueueSidebarTotalHeightPx,
  TURN_QUEUE_ACTING_NAME_MIN_PX,
  TURN_QUEUE_SIDEBAR_HEIGHTS,
  TURN_QUEUE_UPCOMING_MAX,
} from '../utils/battleDisplay';
import { BottomSheet } from './BottomSheet';
import { LevelBadge } from './LevelBadge';

export type TurnQueueVariant = 'default' | 'phone' | 'sidebar';

interface TurnQueueBarProps {
  battle: BattleState;
  battleSpeed: BattleSpeed;
  skipAnimations: boolean;
  enrageState?: EnrageState;
  enrageBonusPct?: number;
  variant?: TurnQueueVariant;
  targetName?: string | null;
  onSelectUnit?: (unitId: string) => void;
  /** Maximum upcoming rows shown in sidebar variant (4 in Expanded log mode, 10 in Line mode) */
  maxUpcoming?: number;
  /** When true in sidebar variant, allows card to absorb freed height in Line log mode */
  fillHeight?: boolean;
  /** When true in sidebar variant (card mode + ActionStage ON), replaces the 36px acting row */
  hideActingRow?: boolean;
}

function getTeamCssVar(role: TeamColorRole): string {
  switch (role) {
    case 'me':
      return 'var(--team-me)';
    case 'ally':
      return 'var(--team-ally)';
    case 'boss':
      return 'var(--team-boss)';
    case 'enemy':
    default:
      return 'var(--team-enemy)';
  }
}

function getClassGlyph(classId: MechClassId): string {
  switch (classId) {
    case 'striker':
      return '▲';
    case 'interceptor':
      return '◆';
    case 'siege':
      return '■';
    case 'support':
      return '✚';
  }
}

function ConveyorChip({
  entry,
  refLevel,
  isLeader,
  isActive,
  compactPhone,
  animateShift,
  onInspect,
}: {
  entry: TurnQueueEntry;
  refLevel: number;
  isLeader: boolean;
  isActive: boolean;
  compactPhone: boolean;
  animateShift: boolean;
  onInspect: (entry: TurnQueueEntry) => void;
}) {
  const { lang, t } = useI18n();
  const teamColor = getTeamCssVar(entry.teamRole);
  const teamTag = getTeamTagLabel(lang, entry.teamRole);
  const fullTooltip = `${teamTag} ${entry.name} (${getClassName(
    lang,
    entry.classId
  )}) · ${t('queue.speedLabel')} ${entry.effectiveSpeed}`;

  const speedColor = entry.isSlowed
    ? 'text-red-300'
    : entry.isSpeedBoosted
    ? 'text-emerald-300'
    : isActive
    ? 'text-amber-100'
    : 'text-slate-300';

  if (isActive) {
    return (
      <button
        type="button"
        data-testid="turn-queue-chip"
        data-unit-id={entry.unitId}
        data-acting="true"
        data-phase={entry.phase}
        onClick={() => onInspect(entry)}
        title={fullTooltip}
        aria-label={fullTooltip}
        className={`relative shrink-0 rounded-md border-2 bg-amber-400/18 text-left transition-colors cursor-pointer select-none ${
          compactPhone ? 'w-[104px] px-1.5 py-1' : 'w-[156px] px-2 py-1'
        } ${animateShift ? 'anim-conveyor-shift' : ''}`}
        style={{
          borderColor: 'var(--turn-active)',
          boxShadow:
            '0 0 12px rgba(254, 240, 138, 0.35), inset 0 0 8px rgba(254, 240, 138, 0.14)',
        }}
      >
        <span
          className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] leading-none text-amber-200 ${
            animateShift ? 'anim-turn-arrow' : ''
          }`}
          aria-hidden="true"
        >
          ▼
        </span>

        <div className="flex items-center justify-end gap-1 text-[10px] font-bold tracking-wider uppercase">
          <span className="text-amber-200 truncate">{t('queue.actingNow')}</span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {!compactPhone && (
              <LevelBadge
                level={entry.level}
                refLevel={refLevel}
                side={entry.side}
                isLeader={isLeader}
              />
            )}
            <span
              data-testid="turn-queue-chip-name"
              data-full-name={entry.name}
              className="text-[13px] font-bold text-white whitespace-nowrap truncate min-w-0"
            >
              {formatShortUnitName(entry.name, 10)}
            </span>
          </div>
          <span
            className={`font-mono-nums text-[12px] font-bold shrink-0 inline-flex items-center gap-0.5 ${speedColor}`}
          >
            {entry.isSlowed && (
              <TrendingDown className="w-3 h-3 text-red-400" />
            )}
            {entry.isSpeedBoosted && (
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            )}
            {entry.effectiveSpeed}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="turn-queue-chip"
      data-unit-id={entry.unitId}
      data-acting="false"
      data-phase={entry.phase}
      onClick={() => onInspect(entry)}
      title={fullTooltip}
      aria-label={fullTooltip}
      className={`shrink-0 rounded border bg-[#0E1522] hover:bg-slate-800/80 text-left cursor-pointer select-none ${
        compactPhone ? 'w-[78px] px-1.5 py-1' : 'w-[132px] px-2 py-1'
      } ${entry.phase === 'next_round' ? 'opacity-85' : ''} ${
        animateShift ? 'anim-conveyor-shift' : ''
      }`}
      style={{
        borderColor: 'rgba(51, 65, 85, 0.9)',
        borderLeftWidth: '3px',
        borderLeftColor: teamColor,
      }}
    >
      {compactPhone ? (
        <div className="flex flex-col items-center justify-center leading-tight">
          <div className="flex items-center gap-0.5 text-[12px] font-bold">
            <span style={{ color: teamColor }}>
              {getClassGlyph(entry.classId)}
            </span>
            <span
              data-testid="turn-queue-chip-name"
              data-full-name={entry.name}
              className="text-slate-100 whitespace-nowrap"
            >
              {formatShortUnitName(entry.name, 10)}
            </span>
          </div>
          <span className={`font-mono-nums text-[12px] ${speedColor}`}>
            {entry.effectiveSpeed}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-1 text-[12px] leading-tight">
          <LevelBadge
            level={entry.level}
            refLevel={refLevel}
            side={entry.side}
            isLeader={isLeader}
          />
          <span
            data-testid="turn-queue-chip-name"
            data-full-name={entry.name}
            className="text-slate-200 font-medium whitespace-nowrap truncate min-w-0 flex-1"
          >
            {formatShortUnitName(entry.name, 10)}
          </span>
          <span
            className={`font-mono-nums text-[12px] font-semibold shrink-0 inline-flex items-center gap-0.5 ${speedColor}`}
          >
            {entry.isSlowed && (
              <TrendingDown className="w-3 h-3 text-red-400" />
            )}
            {entry.isSpeedBoosted && (
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            )}
            {entry.effectiveSpeed}
          </span>
        </div>
      )}
    </button>
  );
}

/**
 * Turn Queue Bar supporting 3 responsive variants:
 * - 'default': Non-scrolling conveyor track (preserves existing desktop/SSR TurnQueueBar tests).
 * - 'phone': One-line max-44px strip with internal horizontal scroll only, large acting chip ("ACTOR > Target"),
 *            and next 4-5 small chips.
 * - 'sidebar': Compact vertical/grid panel for Tablet/PC right column with hover tooltips.
 */
export function TurnQueueBar({
  battle,
  battleSpeed,
  skipAnimations,
  enrageState,
  enrageBonusPct: _legacyEnrageBonusPct,
  variant = 'default',
  targetName = null,
  onSelectUnit,
  maxUpcoming = 4,
  fillHeight = false,
  hideActingRow = false,
}: TurnQueueBarProps) {
  const { lang, t } = useI18n();
  const adminConfig = useGameStore((s) => s.adminConfig);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const popoverAnchorRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.max(240, window.innerWidth - 220) : 720
  );
  const [isPhone, setIsPhone] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [enrageDetailOpen, setEnrageDetailOpen] = useState(false);
  const [inspectedEntry, setInspectedEntry] = useState<TurnQueueEntry | null>(
    null
  );
  const [unitsAtStart, setUnitsAtStart] = useState<number>(
    () => battle.units.length
  );
  const battleInitMetaRef = useRef<{
    sectorId: string;
    deployedGearId: MechClassId;
    squadSize: number;
    unitsCount: number;
  }>({
    sectorId: battle.sectorId,
    deployedGearId: battle.deployedGearId,
    squadSize: battle.squadSize,
    unitsCount: battle.units.length,
  });

  const isFreshBattleStart =
    battle.round === 1 &&
    battle.turnCounter <= 1 &&
    !battle.summary &&
    battle.units.every((u) => u.alive);
  const switchedBattleStart =
    battleInitMetaRef.current.sectorId !== battle.sectorId ||
    battleInitMetaRef.current.deployedGearId !== battle.deployedGearId ||
    battleInitMetaRef.current.squadSize !== battle.squadSize ||
    (isFreshBattleStart &&
      battleInitMetaRef.current.unitsCount !== battle.units.length);
  const effectiveUnitsAtStart = switchedBattleStart
    ? battle.units.length
    : unitsAtStart;

  useEffect(() => {
    if (switchedBattleStart) {
      battleInitMetaRef.current = {
        sectorId: battle.sectorId,
        deployedGearId: battle.deployedGearId,
        squadSize: battle.squadSize,
        unitsCount: battle.units.length,
      };
      setUnitsAtStart(battle.units.length);
    }
  }, [
    switchedBattleStart,
    battle.sectorId,
    battle.deployedGearId,
    battle.squadSize,
    battle.units.length,
  ]);

  const animateShift = battleSpeed <= 2 && !skipAnimations;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    setIsPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (variant !== 'default') return;
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const rectW = el.getBoundingClientRect?.().width ?? el.clientWidth;
      if (typeof rectW === 'number' && rectW > 0) {
        setTrackWidth(rectW);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number' && w > 0) {
        setTrackWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant]);

  useEffect(() => {
    if (!overflowOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (
        popoverAnchorRef.current &&
        !popoverAnchorRef.current.contains(e.target as Node)
      ) {
        setOverflowOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [overflowOpen]);

  const queue = useMemo(() => buildTurnQueue(battle), [battle]);
  const upcomingData = useMemo(
    () =>
      buildUpcomingTurnList(
        battle,
        variant === 'sidebar' ? 100 : TURN_QUEUE_UPCOMING_MAX
      ),
    [battle, variant]
  );
  const currentRoundChips = queue.current;
  const nextRoundChips = queue.next;
  const playerUnit = battle.units.find((u) => u.isPlayer);
  const refLevel = playerUnit?.level ?? 1;
  const playerUnitId = playerUnit?.id ?? null;
  const isEntryLeader = (entry: TurnQueueEntry) =>
    playerUnitId ? entry.unitId === playerUnitId : entry.teamRole === 'me';
  const targetUnit =
    targetName && upcomingData.actingEntry
      ? battle.units.find(
          (u) =>
            u.name === targetName &&
            u.side !== upcomingData.actingEntry!.side &&
            u.alive
        ) ?? battle.units.find((u) => u.name === targetName)
      : undefined;

  const handleChipClick = (entry: TurnQueueEntry) => {
    if (onSelectUnit) {
      onSelectUnit(entry.unitId);
    } else {
      setInspectedEntry(entry);
    }
  };

  const { visibleCurrent, visibleNext, showDivider, hiddenCount } = useMemo(() => {
    const gap = 6;
    const activeW = (isPhone ? 104 : 156) + gap;
    const chipW = (isPhone ? 68 : 126) + gap;
    const dividerW = (isPhone ? 62 : 84) + gap;
    const overflowBtnW = 54;
    const usableW = Math.max(activeW, trackWidth - 8);

    const totalChips = currentRoundChips.length + nextRoundChips.length;
    if (totalChips === 0) {
      return {
        visibleCurrent: [] as TurnQueueEntry[],
        visibleNext: [] as TurnQueueEntry[],
        showDivider: false,
        hiddenCount: 0,
      };
    }

    const fullRequiredW =
      (currentRoundChips.length > 0 ? activeW : 0) +
      Math.max(0, currentRoundChips.length - 1) * chipW +
      (nextRoundChips.length > 0 ? dividerW : 0) +
      nextRoundChips.length * chipW;

    const needsOverflow = fullRequiredW > usableW;
    let remainingW = Math.max(
      activeW,
      usableW - (needsOverflow ? overflowBtnW : 0)
    );

    const visCur: TurnQueueEntry[] = [];
    const visNext: TurnQueueEntry[] = [];

    for (let i = 0; i < currentRoundChips.length; i++) {
      const cost = i === 0 ? activeW : chipW;
      if (i === 0 || remainingW >= cost) {
        visCur.push(currentRoundChips[i]);
        remainingW -= cost;
      } else {
        break;
      }
    }

    let divVisible = false;
    if (
      visCur.length === currentRoundChips.length &&
      nextRoundChips.length > 0 &&
      remainingW >= dividerW + chipW
    ) {
      divVisible = true;
      remainingW -= dividerW;
      for (let i = 0; i < nextRoundChips.length; i++) {
        if (remainingW >= chipW) {
          visNext.push(nextRoundChips[i]);
          remainingW -= chipW;
        } else {
          break;
        }
      }
    }

    const hidden = totalChips - (visCur.length + visNext.length);
    return {
      visibleCurrent: visCur,
      visibleNext: visNext,
      showDivider: divVisible,
      hiddenCount: Math.max(0, hidden),
    };
  }, [currentRoundChips, nextRoundChips, trackWidth, isPhone]);

  const resolvedEnrage =
    enrageState ?? getEnrageState(battle.round, adminConfig);
  const latestPhase: EnragePhaseKey | null =
    resolvedEnrage.latestPhase ?? resolvedEnrage.highestPhase;
  const latestPhaseLabel = latestPhase
    ? getEnragePhaseDisplayName(latestPhase, lang)
    : null;
  const totalEnrageStacks =
    resolvedEnrage.totalStacks ??
    resolvedEnrage.stacks.rage +
      resolvedEnrage.stacks.frenzy +
      resolvedEnrage.stacks.berserker;
  const enrageTooltip = latestPhaseLabel
    ? formatEnrageTooltip(resolvedEnrage, lang)
    : undefined;
  const sanitizedEnrageCfg = useMemo(
    () => sanitizeEnrageConfig(adminConfig.enrage),
    [adminConfig.enrage]
  );

  const fmtEnrageNum = (n: number) => String(Number(n.toFixed(2)));
  const renderEnrageGlyph = (
    iconId: string,
    fallbackSymbol: string,
    fallbackColor: string
  ) => {
    const row = getCatalogRow(iconId, adminConfig.iconCatalogMods);
    return (
      <span
        data-enrage-icon={iconId}
        className="material-symbols-outlined leading-none select-none shrink-0"
        style={{ fontSize: '14px', color: row?.color ?? fallbackColor }}
        aria-hidden="true"
      >
        {row?.symbol ?? fallbackSymbol}
      </span>
    );
  };

  const renderEnrageChip = () => {
    if (!latestPhaseLabel || totalEnrageStacks <= 0) return null;
    return (
      <button
        type="button"
        data-testid="turn-queue-enrage-badge"
        title={enrageTooltip}
        aria-label={enrageTooltip}
        aria-expanded={enrageDetailOpen}
        onClick={() => setEnrageDetailOpen((prev) => !prev)}
        className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 max-w-full px-1.5 py-0.5 rounded bg-red-950/75 border border-red-500/60 hover:border-orange-400/80 text-[11px] font-mono-nums font-bold text-orange-200 leading-tight cursor-pointer transition-colors"
      >
        <span className="inline-flex items-center gap-0.5 shrink-0 text-orange-300">
          <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" aria-hidden="true" />
          <span className="hidden min-[380px]:inline">{latestPhaseLabel}</span>
          <span>x{totalEnrageStacks}</span>
        </span>
        {resolvedEnrage.stacks.rage > 0 && (
          <span
            data-testid="enrage-chip-rage"
            className="inline-flex items-center gap-0.5 shrink-0 text-sky-200"
          >
            <span aria-hidden="true" className="text-slate-400">·</span>
            {renderEnrageGlyph('BS05', 'security', '#378ADD')}
            <span>-{fmtEnrageNum(resolvedEnrage.defDownPct)}%</span>
          </span>
        )}
        {resolvedEnrage.stacks.frenzy > 0 && (
          <span
            data-testid="enrage-chip-frenzy"
            className="inline-flex items-center gap-0.5 shrink-0 text-emerald-200"
          >
            <span aria-hidden="true" className="text-slate-400">·</span>
            {renderEnrageGlyph('BF02', 'swords', '#1D9E75')}
            <span>+{fmtEnrageNum(resolvedEnrage.damageUpPct)}%</span>
          </span>
        )}
        {resolvedEnrage.stacks.berserker > 0 && (
          <>
            <span
              data-testid="enrage-chip-berserker-crit-rate"
              className="inline-flex items-center gap-0.5 shrink-0 text-amber-200"
            >
              <span aria-hidden="true" className="text-slate-400">·</span>
              {renderEnrageGlyph('SS04', 'flare', '#EF9F27')}
              <span>+{fmtEnrageNum(resolvedEnrage.critRateUpPct)}%</span>
            </span>
            <span
              data-testid="enrage-chip-berserker-crit-dmg"
              className="inline-flex items-center gap-0.5 shrink-0 text-rose-200"
            >
              <span aria-hidden="true" className="text-slate-400">·</span>
              {renderEnrageGlyph('SS05', 'explosion', '#E24B4A')}
              <span>+{fmtEnrageNum(resolvedEnrage.critDamageUpPct)}%</span>
            </span>
          </>
        )}
      </button>
    );
  };

  const renderEnrageDetailSheet = () => (
    <BottomSheet
      open={enrageDetailOpen && Boolean(latestPhaseLabel)}
      onClose={() => setEnrageDetailOpen(false)}
      testId="turn-queue-enrage-detail"
      title={
        <span className="inline-flex items-center gap-1.5 text-orange-300">
          <Flame className="w-4 h-4 text-orange-400" aria-hidden="true" />
          <span>{t('enrage.detailTitle')}</span>
        </span>
      }
      subtitle={
        latestPhaseLabel
          ? `${t('battle.round', { round: queue.round })} · ${latestPhaseLabel} x${totalEnrageStacks}`
          : undefined
      }
    >
      <div className="space-y-2">
        {ENRAGE_PHASE_ORDER.map((phase) => {
          const phaseCfg = sanitizedEnrageCfg[phase];
          const stacks = resolvedEnrage.stacks[phase];
          const nextRound = getEnragePhaseNextStackRound(
            resolvedEnrage.round,
            phaseCfg
          );
          const summaryText = formatEnragePhaseSummaryPart(
            phase,
            resolvedEnrage,
            lang,
            true
          );
          return (
            <div
              key={phase}
              data-testid={`enrage-detail-phase-${phase}`}
              className={`rounded-lg border px-3 py-2 space-y-1 text-[12px] ${
                stacks > 0
                  ? 'border-orange-500/45 bg-red-950/25 text-slate-100'
                  : 'border-slate-800/80 bg-[#0A101B] text-slate-400 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{summaryText}</span>
                <span className="font-mono-nums text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 shrink-0">
                  {stacks}/{phaseCfg.maxStacks}
                </span>
              </div>
              <div className="text-[11px] font-mono-nums text-sky-300/90">
                {nextRound !== null
                  ? t('enrage.nextStackAt', { round: nextRound })
                  : t('enrage.maxReached')}
              </div>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );

  const renderFullQueuePopover = () => (
    <div
      role="dialog"
      data-testid="turn-queue-popover"
      aria-label={t('queue.fullQueueTitle')}
      className="absolute right-0 top-full mt-2 z-50 w-[min(92vw,340px)] max-h-[70vh] flex flex-col rounded-lg border border-slate-700 bg-[#0B111D] shadow-2xl overflow-hidden"
    >
      <div className="shrink-0 px-3 py-2 border-b border-slate-800 bg-[#080C15] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-100">
          <ListOrdered className="w-3.5 h-3.5 text-amber-300" />
          <span>{t('queue.fullQueueTitle')}</span>
        </div>
        <button
          type="button"
          onClick={() => setOverflowOpen(false)}
          aria-label={t('common.close')}
          className="h-8 w-8 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 tactical-scroll">
        <div className="space-y-1.5">
          <div className="text-[12px] font-bold uppercase tracking-wider text-amber-300">
            {t('queue.currentRoundGroup', { round: queue.round })}
          </div>
          {currentRoundChips.map((entry, idx) => {
            const color = getTeamCssVar(entry.teamRole);
            const isFirst = idx === 0 && !battle.summary;
            return (
              <div
                key={`pop-cur-${entry.unitId}`}
                className={`rounded border px-2.5 py-1.5 flex items-center justify-between gap-2 ${
                  isFirst
                    ? 'border-amber-300 bg-amber-400/15'
                    : 'border-slate-800 bg-[#0A101B]'
                }`}
                style={{ borderLeftWidth: '3px', borderLeftColor: color }}
              >
                <div className="min-w-0 flex items-center gap-1.5">
                  <LevelBadge
                    level={entry.level}
                    refLevel={refLevel}
                    side={entry.side}
                    isLeader={isEntryLeader(entry)}
                  />
                  <span className="text-[13px] font-semibold text-slate-100 truncate">
                    {entry.name}
                  </span>
                  {isFirst && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-300 text-slate-950 text-[11px] font-bold uppercase shrink-0">
                      {t('queue.actingNow')}
                    </span>
                  )}
                </div>
                <div className="font-mono-nums text-[12px] text-slate-300 shrink-0">
                  {t('queue.speedLabel')} {entry.effectiveSpeed}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
            {t('queue.nextRoundGroup', { round: queue.round + 1 })}
          </div>
          {nextRoundChips.map((entry) => {
            const color = getTeamCssVar(entry.teamRole);
            return (
              <div
                key={`pop-next-${entry.unitId}`}
                className="rounded border border-slate-800/80 bg-[#090E18] px-2.5 py-1.5 flex items-center justify-between gap-2"
                style={{ borderLeftWidth: '3px', borderLeftColor: color }}
              >
                <div className="min-w-0 flex items-center gap-1.5">
                  <LevelBadge
                    level={entry.level}
                    refLevel={refLevel}
                    side={entry.side}
                    isLeader={isEntryLeader(entry)}
                  />
                  <span className="text-[13px] text-slate-200 truncate">
                    {entry.name}
                  </span>
                </div>
                <div className="font-mono-nums text-[12px] text-slate-400 shrink-0">
                  {t('queue.speedLabel')} {entry.effectiveSpeed}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // PHONE ONE-LINE STRIP VARIANT (max 44px, internal horizontal scroll only, zero chip clipping, zero page overflow)
  if (variant === 'phone') {
    const actingEntry = upcomingData.actingEntry;
    const upcomingCombined = upcomingData.upcoming;

    const actorShort = actingEntry
      ? formatShortUnitName(actingEntry.name, 10)
      : '';
    const targetShort = targetName ? formatShortUnitName(targetName, 10) : '';
    const actingLabel =
      actingEntry && targetShort
        ? `${actorShort} > ${targetShort}`
        : actorShort;

    return (
      <div
        data-testid="turn-queue-phone-strip"
        className={`shrink-0 w-full max-w-full min-w-0 border-b border-slate-800/80 bg-[#0A0F18]/95 px-1.5 flex items-center gap-1.5 ${
          latestPhaseLabel
            ? 'min-h-[44px] flex-wrap py-1'
            : 'h-11 max-h-[44px] overflow-hidden'
        }`}
      >
        {/* Compact Round Badge */}
        <span
          data-testid="turn-queue-round-chip"
          title={enrageTooltip ?? t('battle.round', { round: queue.round })}
          className={`shrink-0 inline-flex items-center gap-1 px-1.5 h-8 rounded font-mono-nums text-[12px] font-bold whitespace-nowrap ${
            latestPhaseLabel
              ? 'bg-red-950/75 border border-red-500/65 text-slate-100'
              : 'bg-slate-900 border border-slate-700 text-slate-200'
          }`}
        >
          <span>R{queue.round}</span>
        </span>
        {renderEnrageChip()}

        {/* Inner Horizontally Scrollable Track (strictly self-contained, never clips start/end chips or scrolls page) */}
        <div
          data-testid="turn-queue-phone-track"
          style={{ touchAction: 'pan-x' }}
          className="flex-1 min-w-[120px] flex items-center justify-start gap-1.5 overflow-x-auto overflow-y-hidden px-1 scroll-px-1 battle-strip-scroll overscroll-x-contain"
          aria-label={t('queue.fullQueueTitle')}
        >
          {actingEntry && (
            <button
              type="button"
              data-testid="turn-queue-acting-chip"
              data-unit-id={actingEntry.unitId}
              data-full-name={actingEntry.name}
              data-acting="true"
              title={`${getTeamTagLabel(lang, actingEntry.teamRole)} ${
                actingEntry.name
              }${targetName ? ` > ${targetName}` : ''} · ${t(
                'queue.speedLabel'
              )} ${actingEntry.effectiveSpeed}`}
              onClick={() => handleChipClick(actingEntry)}
              className="shrink-0 h-9 px-2.5 rounded-md border bg-amber-400/18 text-[13px] font-bold text-amber-100 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                borderColor: 'var(--turn-active)',
              }}
            >
              <LevelBadge
                level={actingEntry.level}
                refLevel={refLevel}
                side={actingEntry.side}
                isLeader={isEntryLeader(actingEntry)}
              />
              <span data-testid="turn-queue-acting-name">{actingLabel}</span>
            </button>
          )}

          {upcomingCombined.map((item) => {
            const entry = item.entry;
            const tip = `${item.order}. ${getTeamTagLabel(
              lang,
              entry.teamRole
            )} ${entry.name} (${getClassName(lang, entry.classId)}) · ${t(
              'queue.speedLabel'
            )} ${entry.effectiveSpeed}`;
            return (
              <button
                key={`${entry.phase}-${entry.unitId}-${item.order}`}
                type="button"
                data-testid="turn-queue-phone-next-chip"
                data-unit-id={entry.unitId}
                data-full-name={entry.name}
                data-order={item.order}
                title={tip}
                aria-label={tip}
                onClick={() => handleChipClick(entry)}
                className={`shrink-0 h-9 px-2.5 rounded border border-slate-700/90 bg-[#0E1522] text-[12px] font-semibold text-slate-200 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                  entry.phase === 'next_round' ? 'opacity-80' : ''
                }`}
              >
                <LevelBadge
                  level={entry.level}
                  refLevel={refLevel}
                  side={entry.side}
                  isLeader={isEntryLeader(entry)}
                />
                <span data-testid="turn-queue-chip-name">{item.shortName}</span>
              </button>
            );
          })}
        </div>
        {renderEnrageDetailSheet()}
      </div>
    );
  }

  // SIDEBAR VARIANT (Tablet / PC right column: constant 32px header + 36px acting row + fixed 5x26px scrollable list)
  if (variant === 'sidebar') {
    const actingEntry = upcomingData.actingEntry;
    const allUpcoming = upcomingData.upcoming;
    const fixedRowCount = getTurnQueueSidebarRowCount(effectiveUnitsAtStart);
    const listHeightPx = getTurnQueueSidebarListHeightPx(fixedRowCount);
    const totalHeightPx = getTurnQueueSidebarTotalHeightPx(
      fixedRowCount,
      hideActingRow
    );
    const sidebarHiddenCount = Math.max(0, allUpcoming.length - fixedRowCount);
    const actingChipTitle = actingEntry
      ? `${getTeamTagLabel(lang, actingEntry.teamRole)} ${actingEntry.name}${
          targetName ? ` > ${targetName}` : ''
        } (${getClassName(lang, actingEntry.classId)}) · ${t(
          'queue.speedLabel'
        )} ${actingEntry.effectiveSpeed}`
      : undefined;

    return (
      <div
        data-testid="turn-queue-sidebar"
        data-queue-rows={fixedRowCount}
        data-queue-height-px={totalHeightPx}
        data-acting-row-hidden={hideActingRow ? 'true' : 'false'}
        style={{
          height: `${totalHeightPx}px`,
          minHeight: `${totalHeightPx}px`,
          maxHeight: `${totalHeightPx}px`,
        }}
        className="rounded-lg border border-slate-800 bg-[#0A101B] px-2 py-1.5 flex flex-col gap-1 shrink-0 overflow-hidden"
      >
        <div
          data-testid="turn-queue-sidebar-header"
          style={
            latestPhaseLabel
              ? { minHeight: `${TURN_QUEUE_SIDEBAR_HEIGHTS.headerPx}px` }
              : {
                  height: `${TURN_QUEUE_SIDEBAR_HEIGHTS.headerPx}px`,
                  minHeight: `${TURN_QUEUE_SIDEBAR_HEIGHTS.headerPx}px`,
                }
          }
          className={`shrink-0 flex flex-wrap items-center justify-between gap-2 ${
            latestPhaseLabel
              ? 'min-h-[32px] py-0.5'
              : 'h-[32px] min-h-[32px] max-h-[32px]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
            {!battle.summary && (
              <span
                data-testid="turn-queue-combat-icon"
                title={t('queue.inCombat')}
                aria-label={t('queue.inCombat')}
                className="inline-flex items-center justify-center w-6 h-6 rounded bg-sky-500/12 border border-sky-500/35 text-sky-300 shrink-0"
              >
                <Swords className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            )}
            <span
              data-testid="turn-queue-round-chip"
              title={enrageTooltip}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono-nums text-[12px] font-bold whitespace-nowrap ${
                latestPhaseLabel
                  ? 'bg-red-950/70 border border-red-500/65 text-slate-100'
                  : 'bg-slate-900 border border-slate-700 text-slate-100'
              }`}
            >
              <span>{t('battle.round', { round: queue.round })}</span>
            </span>
            {renderEnrageChip()}
          </div>

          <span className="text-[12px] text-slate-400 font-medium whitespace-nowrap">
            {t('battle.turnOrder')}
          </span>
        </div>

        {/* Acting Unit Highlight (omitted when hideActingRow=true so ActionStage replaces it) */}
        {!hideActingRow &&
          (actingEntry ? (
            <button
              type="button"
              data-testid="turn-queue-acting-chip"
              data-unit-id={actingEntry.unitId}
              data-full-name={actingEntry.name}
              data-acting="true"
              onClick={() => handleChipClick(actingEntry)}
              title={actingChipTitle}
              style={{
                borderColor: 'var(--turn-active)',
                height: `${TURN_QUEUE_SIDEBAR_HEIGHTS.actingRowPx}px`,
                minHeight: `${TURN_QUEUE_SIDEBAR_HEIGHTS.actingRowPx}px`,
              }}
              className="w-full h-[36px] min-h-[36px] max-h-[36px] shrink-0 px-2.5 rounded-lg border bg-amber-400/15 hover:bg-amber-400/20 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div
                  data-testid="turn-queue-acting-name"
                  className="flex items-center gap-1 flex-1 min-w-0 text-[13px] font-bold text-amber-100"
                >
                  <LevelBadge
                    level={actingEntry.level}
                    refLevel={refLevel}
                    side={actingEntry.side}
                    isLeader={isEntryLeader(actingEntry)}
                  />
                  <span
                    data-testid="turn-queue-acting-attacker"
                    title={actingEntry.name}
                    style={
                      targetName && actingEntry.name.length > 7
                        ? {
                            minWidth: `min(${TURN_QUEUE_ACTING_NAME_MIN_PX}px, 42%)`,
                          }
                        : undefined
                    }
                    className="min-w-0 truncate"
                  >
                    {actingEntry.name}
                  </span>
                  {targetName && (
                    <>
                      <span
                        className="shrink-0 px-0.5 text-amber-200/80"
                        aria-hidden="true"
                      >
                        &gt;
                      </span>
                      {targetUnit && (
                        <LevelBadge
                          level={targetUnit.level}
                          refLevel={refLevel}
                          side={targetUnit.side}
                          isLeader={targetUnit.isPlayer}
                        />
                      )}
                      <span
                        data-testid="turn-queue-acting-target"
                        title={targetName}
                        style={
                          targetName.length > 7
                            ? {
                                minWidth: `min(${TURN_QUEUE_ACTING_NAME_MIN_PX}px, 42%)`,
                              }
                            : undefined
                        }
                        className="min-w-0 truncate"
                      >
                        {targetName}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span className="font-mono-nums text-[12px] font-bold text-amber-200 shrink-0">
                SPD {actingEntry.effectiveSpeed}
              </span>
            </button>
          ) : (
            <div
              data-testid="turn-queue-acting-empty"
              style={{
                height: `${TURN_QUEUE_SIDEBAR_HEIGHTS.actingRowPx}px`,
                minHeight: `${TURN_QUEUE_SIDEBAR_HEIGHTS.actingRowPx}px`,
              }}
              className="w-full h-[36px] min-h-[36px] max-h-[36px] shrink-0 px-2.5 rounded-lg border border-slate-800/70 bg-slate-900/35 flex items-center text-[12px] text-slate-500"
            >
              <span className="min-w-0 truncate">
                {battle.summary ? t('queue.battleEnded') : t('queue.noActiveActor')}
              </span>
            </div>
          ))}

        {/* Upcoming List: fixed rows (up to 5) x 26px + gaps, independent of log mode, internal scroll */}
        {fixedRowCount > 0 && (
          <div className="flex flex-col gap-1 shrink-0 min-h-0">
            <div
              style={{
                height: `${TURN_QUEUE_SIDEBAR_HEIGHTS.nextLabelPx}px`,
                minHeight: `${TURN_QUEUE_SIDEBAR_HEIGHTS.nextLabelPx}px`,
              }}
              className="h-[20px] min-h-[20px] max-h-[20px] px-1 flex items-center justify-between gap-2 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              <span data-testid="turn-queue-next-label">
                {t('queue.nextSectionLabel')}
              </span>
              {sidebarHiddenCount > 0 && (
                <div ref={popoverAnchorRef} className="relative shrink-0">
                  <button
                    type="button"
                    data-testid="turn-queue-overflow"
                    onClick={() => setOverflowOpen((v) => !v)}
                    aria-expanded={overflowOpen}
                    aria-haspopup="dialog"
                    title={t('queue.overflowHint', {
                      count: sidebarHiddenCount,
                    })}
                    aria-label={t('queue.overflowHint', {
                      count: sidebarHiddenCount,
                    })}
                    className="h-[20px] px-1.5 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 hover:border-amber-400/60 text-[11px] font-mono-nums font-bold text-amber-300 inline-flex items-center justify-center gap-0.5 cursor-pointer"
                  >
                    <span>+{sidebarHiddenCount}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {overflowOpen && renderFullQueuePopover()}
                </div>
              )}
            </div>
            <div
              data-testid="turn-queue-upcoming-list"
              data-fixed-rows={fixedRowCount}
              style={{
                height: `${listHeightPx}px`,
                minHeight: `${listHeightPx}px`,
                maxHeight: `${listHeightPx}px`,
              }}
              className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden tactical-scroll tactical-scroll-thin min-h-0"
            >
              {allUpcoming.map((item) => {
                const entry = item.entry;
                const tip = `${item.order}. ${getTeamTagLabel(
                  lang,
                  entry.teamRole
                )} ${entry.name} (${getClassName(lang, entry.classId)}) · ${t(
                  'queue.speedLabel'
                )} ${entry.effectiveSpeed}`;
                const speedTone = entry.isSlowed
                  ? 'text-red-300'
                  : entry.isSpeedBoosted
                  ? 'text-emerald-300'
                  : 'text-slate-300';
                return (
                  <button
                    key={`sb-${entry.phase}-${entry.unitId}-${item.order}`}
                    type="button"
                    data-testid="turn-queue-sidebar-chip"
                    data-unit-id={entry.unitId}
                    data-full-name={entry.name}
                    data-order={item.order}
                    onClick={() => handleChipClick(entry)}
                    title={tip}
                    aria-label={tip}
                    className={`w-full h-[26px] min-h-[26px] max-h-[26px] px-2 rounded border border-slate-800/90 bg-[#0E1522] hover:bg-slate-800/85 text-[12px] flex items-center justify-between gap-2 text-left cursor-pointer transition-colors shrink-0 ${
                      entry.phase === 'next_round' ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span
                        data-testid="turn-queue-order-num"
                        className="w-4 text-center font-mono-nums text-[11px] font-bold text-slate-400 shrink-0"
                      >
                        {item.order}
                      </span>
                      <LevelBadge
                        level={entry.level}
                        refLevel={refLevel}
                        side={entry.side}
                        isLeader={isEntryLeader(entry)}
                      />
                      <span
                        data-testid="turn-queue-chip-name"
                        title={entry.name}
                        className="flex-1 min-w-0 font-medium text-slate-100 truncate"
                      >
                        {entry.name}
                      </span>
                    </div>
                    <span
                      className={`font-mono-nums text-[11px] font-semibold shrink-0 inline-flex items-center gap-0.5 ${speedTone}`}
                    >
                      {entry.isSlowed && (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      {entry.isSpeedBoosted && (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      )}
                      <span>SPD {entry.effectiveSpeed}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {renderEnrageDetailSheet()}
      </div>
    );
  }

  // DEFAULT CONVEYOR VARIANT (preserves all TurnQueueBar.test.tsx invariants)
  return (
    <div
      data-testid="turn-queue-bar"
      className="relative flex flex-wrap items-center gap-2 min-w-0 w-full"
    >
      {/* Left Header Badges: [Swords icon (tooltip)] [Round N] [Compact Enrage Chip] */}
      <div
        data-testid="turn-queue-header"
        className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full"
      >
        {!battle.summary && (
          <span
            data-testid="turn-queue-combat-icon"
            title={t('queue.inCombat')}
            aria-label={t('queue.inCombat')}
            className="inline-flex items-center justify-center w-7 h-7 rounded bg-sky-500/12 border border-sky-500/35 text-sky-300 shrink-0"
          >
            <Swords className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
        )}

        <span
          data-testid="turn-queue-round-chip"
          title={enrageTooltip}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono-nums text-[12px] font-bold whitespace-nowrap ${
            latestPhaseLabel
              ? 'bg-red-950/70 border border-red-500/65 text-slate-100'
              : 'bg-slate-900 border border-slate-700 text-slate-100'
          }`}
        >
          <span>{t('battle.round', { round: queue.round })}</span>
        </span>
        {renderEnrageChip()}
      </div>

      {/* Fixed-Width Non-Scrolling Conveyor Track (overflow-hidden, zero scrollbar, zero auto-scroll) */}
      <div
        ref={trackRef}
        data-testid="turn-queue-track"
        key={animateShift ? `${battle.round}-${battle.activeTurnIndex}` : 'static'}
        className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden pt-2 pb-0.5"
        aria-label={t('queue.fullQueueTitle')}
      >
        {visibleCurrent.map((entry, idx) => (
          <ConveyorChip
            key={`cur-${entry.unitId}`}
            entry={entry}
            refLevel={refLevel}
            isLeader={isEntryLeader(entry)}
            isActive={idx === 0 && !battle.summary}
            compactPhone={isPhone}
            animateShift={animateShift}
            onInspect={handleChipClick}
          />
        ))}

        {showDivider && (
          <div
            data-testid="turn-queue-divider"
            className="shrink-0 flex items-center gap-1 px-1.5 py-1 rounded border border-dashed border-slate-700 bg-slate-950/90 text-[11px] font-mono-nums font-semibold text-slate-400 whitespace-nowrap"
          >
            <span>{t('queue.nextRound', { round: queue.round + 1 })}</span>
          </div>
        )}

        {visibleNext.map((entry) => (
          <ConveyorChip
            key={`next-${entry.unitId}`}
            entry={entry}
            refLevel={refLevel}
            isLeader={isEntryLeader(entry)}
            isActive={false}
            compactPhone={isPhone}
            animateShift={animateShift}
            onInspect={handleChipClick}
          />
        ))}
      </div>

      {/* "+N" Overflow Trigger + Anchored Full-Queue Popover */}
      {hiddenCount > 0 && (
        <div ref={popoverAnchorRef} className="relative shrink-0">
          <button
            type="button"
            data-testid="turn-queue-overflow"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-expanded={overflowOpen}
            aria-haspopup="dialog"
            title={t('queue.overflowHint', { count: hiddenCount })}
            aria-label={t('queue.overflowHint', { count: hiddenCount })}
            className="min-h-[34px] min-w-[44px] px-2 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 hover:border-amber-400/60 text-[12px] font-mono-nums font-bold text-amber-300 inline-flex items-center justify-center gap-0.5 cursor-pointer"
          >
            <span>+{hiddenCount}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {overflowOpen && renderFullQueuePopover()}
        </div>
      )}

      {/* Tap-to-inspect chip full name sheet */}
      <BottomSheet
        open={Boolean(inspectedEntry)}
        onClose={() => setInspectedEntry(null)}
        title={inspectedEntry?.name ?? ''}
        subtitle={
          inspectedEntry
            ? `${getTeamTagLabel(lang, inspectedEntry.teamRole)} · ${getClassName(
                lang,
                inspectedEntry.classId
              )}`
            : undefined
        }
      >
        {inspectedEntry && (
          <div className="rounded-lg border border-slate-800 bg-[#0A101B] p-4 space-y-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('queue.speedLabel')}</span>
              <span className="font-mono-nums font-bold text-slate-100">
                {inspectedEntry.effectiveSpeed} (Base {inspectedEntry.baseSpeed})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">
                {t('battle.round', { round: queue.round })}
              </span>
              <span className="text-amber-300 font-semibold">
                {inspectedEntry.phase === 'current'
                  ? t('queue.actingNow')
                  : inspectedEntry.phase === 'next_round'
                  ? t('queue.nextRound', { round: queue.round + 1 })
                  : t('queue.upcomingLabel')}
              </span>
            </div>
          </div>
        )}
      </BottomSheet>
      {renderEnrageDetailSheet()}
    </div>
  );
}
