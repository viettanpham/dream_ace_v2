import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  ShoppingCart,
} from 'lucide-react';
import { BALANCE_CONFIG, getGarageUnlockCost } from '../data/balance';
import {
  EMPTY_STAT_BLOCK,
  MECH_CLASSES,
  MECH_CLASS_LIST,
  STAT_KEYS,
} from '../data/classes';
import {
  sumGearEquipmentStats,
  sumGearSpecialTraits,
} from '../engine/equipment';
import { getGearPassiveBonuses } from '../engine/skills';
import {
  getStatBreakdown,
  type StatSourceBreakdown,
} from '../engine/statBreakdown';
import {
  calculateDerivedStats,
  calculateEffectiveStats,
  calculateGearPowerRating,
  getExpForNextLevel,
  getTotalSpentPoints,
} from '../engine/stats';
import {
  getClassCode,
  getClassDesc,
  getClassName,
  getClassRole,
  getStatDesc,
  getStatLabel,
  getStatShort,
  useI18n,
} from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { useGameStore } from '../store/useGameStore';
import type { MechClassId, StatBlock, StatKey } from '../types/game';
import { soundFx } from '../utils/sound';
import { BottomSheet } from './BottomSheet';
import { FighterSvg } from './FighterSvg';
import { FormationEditor } from './FormationEditor';
import { ClassIcon } from './GameIcons';
import { StatBar } from './StatBar';

type StatSourceKey = Exclude<keyof StatSourceBreakdown, 'total'>;

interface StatSourceMeta {
  key: StatSourceKey;
  color: string;
  labelKey: TranslationKey;
  shortKey: TranslationKey;
}

const STAT_SOURCES: readonly StatSourceMeta[] = [
  {
    key: 'base',
    color: '#94a3b8',
    labelKey: 'garage.source.base',
    shortKey: 'garage.source.baseShort',
  },
  {
    key: 'levelGrowth',
    color: '#38bdf8',
    labelKey: 'garage.source.levelGrowth',
    shortKey: 'garage.source.levelGrowthShort',
  },
  {
    key: 'allocated',
    color: '#a78bfa',
    labelKey: 'garage.source.allocated',
    shortKey: 'garage.source.allocatedShort',
  },
  {
    key: 'equipment',
    color: '#fbbf24',
    labelKey: 'garage.source.equipment',
    shortKey: 'garage.source.equipmentShort',
  },
  {
    key: 'other',
    color: '#f472b6',
    labelKey: 'garage.source.other',
    shortKey: 'garage.source.otherShort',
  },
] as const;

const HOLD_INITIAL_DELAY_MS = 400;
const HOLD_REPEAT_SLOW_MS = 120;
const HOLD_ACCEL_DELAY_MS = 1200;
const HOLD_REPEAT_FAST_MS = 60;

function useIsPhoneViewport(): boolean {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsPhone(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isPhone;
}

export function GarageView() {
  const { lang, t } = useI18n();
  const isPhone = useIsPhoneViewport();
  const pilot = useGameStore((s) => s.pilot);
  const setPilotName = useGameStore((s) => s.setPilotName);
  const selectActiveGear = useGameStore((s) => s.selectActiveGear);
  const buyGear = useGameStore((s) => s.buyGear);
  const commitStatAllocations = useGameStore((s) => s.commitStatAllocations);
  const resetStatAllocations = useGameStore((s) => s.resetStatAllocations);

  const [pending, setPending] = useState<StatBlock>({ ...EMPTY_STAT_BLOCK });
  const [expandedStatKey, setExpandedStatKey] = useState<StatKey | null>(null);
  const [sheetStatKey, setSheetStatKey] = useState<StatKey | null>(null);

  const activeGear = pilot.gears[pilot.activeGearId];
  const activeClass = MECH_CLASSES[activeGear.classId];

  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const unspentRef = useRef(activeGear.unspentPoints);
  unspentRef.current = activeGear.unspentPoints;

  const holdDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAccelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerHandledRef = useRef<{ key: StatKey; dir: 1 | -1 } | null>(null);

  const clearHoldTimers = useCallback(() => {
    if (holdDelayTimerRef.current !== null) {
      clearTimeout(holdDelayTimerRef.current);
      holdDelayTimerRef.current = null;
    }
    if (holdAccelTimerRef.current !== null) {
      clearTimeout(holdAccelTimerRef.current);
      holdAccelTimerRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleWindowBlur = () => {
      clearHoldTimers();
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      clearHoldTimers();
    };
  }, [clearHoldTimers]);

  const ownedCount = MECH_CLASS_LIST.filter(
    (c) => pilot.gears[c.id].owned
  ).length;
  const nextGearPrice = getGarageUnlockCost(ownedCount);

  const pendingTotal = STAT_KEYS.reduce((sum, key) => sum + pending[key], 0);
  const remainingPoints = activeGear.unspentPoints - pendingTotal;
  const spentTotal = getTotalSpentPoints(activeGear.allocatedPoints);

  const activePower = useMemo(
    () => calculateGearPowerRating(activeGear, pilot.inventory),
    [activeGear, pilot.inventory]
  );
  const activeNextExp = getExpForNextLevel(activeGear.level);

  const equipBonuses = useMemo(
    () => sumGearEquipmentStats(activeGear, pilot.inventory),
    [activeGear, pilot.inventory]
  );

  const equipTraits = useMemo(
    () => sumGearSpecialTraits(activeGear, pilot.inventory),
    [activeGear, pilot.inventory]
  );

  const passiveBonuses = useMemo(
    () => getGearPassiveBonuses(activeGear),
    [activeGear]
  );

  const currentStats = useMemo(
    () =>
      calculateEffectiveStats(
        activeGear.classId,
        activeGear.level,
        activeGear.allocatedPoints,
        EMPTY_STAT_BLOCK,
        equipBonuses,
        equipTraits,
        passiveBonuses
      ),
    [activeGear, equipBonuses, equipTraits, passiveBonuses]
  );

  const previewStats = useMemo(
    () =>
      calculateEffectiveStats(
        activeGear.classId,
        activeGear.level,
        activeGear.allocatedPoints,
        pending,
        equipBonuses,
        equipTraits,
        passiveBonuses
      ),
    [activeGear, pending, equipBonuses, equipTraits, passiveBonuses]
  );

  const statBreakdown = useMemo(
    () =>
      getStatBreakdown(
        activeGear,
        equipBonuses,
        equipTraits,
        passiveBonuses,
        pending
      ),
    [activeGear, equipBonuses, equipTraits, passiveBonuses, pending]
  );

  const currentDerived = useMemo(
    () =>
      calculateDerivedStats(
        activeGear.classId,
        activeGear.level,
        currentStats,
        equipTraits,
        passiveBonuses
      ),
    [activeGear.classId, activeGear.level, currentStats, equipTraits, passiveBonuses]
  );

  const previewDerived = useMemo(
    () =>
      calculateDerivedStats(
        activeGear.classId,
        activeGear.level,
        previewStats,
        equipTraits,
        passiveBonuses
      ),
    [activeGear.classId, activeGear.level, previewStats, equipTraits, passiveBonuses]
  );

  const applyStep = useCallback((key: StatKey, delta: number): boolean => {
    const currentPending = pendingRef.current;
    const currentPendingTotal = STAT_KEYS.reduce(
      (sum, statKey) => sum + currentPending[statKey],
      0
    );
    const currentRemaining = unspentRef.current - currentPendingTotal;

    let actualDelta = 0;
    if (delta > 0) {
      if (currentRemaining <= 0) return false;
      actualDelta = Math.min(delta, currentRemaining);
    } else if (delta < 0) {
      if (currentPending[key] <= 0) return false;
      actualDelta = -Math.min(-delta, currentPending[key]);
    }
    if (actualDelta === 0) return false;

    const nextPending: StatBlock = {
      ...currentPending,
      [key]: Math.max(0, currentPending[key] + actualDelta),
    };
    pendingRef.current = nextPending;
    setPending(nextPending);
    return true;
  }, []);

  const handleStepPointerDown = (
    key: StatKey,
    dir: 1 | -1,
    e: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearHoldTimers();
    pointerHandledRef.current = { key, dir };

    const didStep = applyStep(key, dir);
    if (!didStep) return;
    soundFx.playClick();

    holdDelayTimerRef.current = setTimeout(() => {
      const repeatOk = applyStep(key, dir);
      if (!repeatOk) {
        clearHoldTimers();
        return;
      }
      holdIntervalRef.current = setInterval(() => {
        if (!applyStep(key, dir)) {
          clearHoldTimers();
        }
      }, HOLD_REPEAT_SLOW_MS);
    }, HOLD_INITIAL_DELAY_MS);

    holdAccelTimerRef.current = setTimeout(() => {
      if (holdIntervalRef.current !== null) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
      holdIntervalRef.current = setInterval(() => {
        if (!applyStep(key, dir)) {
          clearHoldTimers();
        }
      }, HOLD_REPEAT_FAST_MS);
    }, HOLD_ACCEL_DELAY_MS);
  };

  const handleStepPointerEnd = (resetHandled = false) => {
    clearHoldTimers();
    if (resetHandled) {
      pointerHandledRef.current = null;
    }
  };

  const handleStepClick = (key: StatKey, dir: 1 | -1) => {
    if (
      pointerHandledRef.current &&
      pointerHandledRef.current.key === key &&
      pointerHandledRef.current.dir === dir
    ) {
      pointerHandledRef.current = null;
      return;
    }
    pointerHandledRef.current = null;
    if (applyStep(key, dir)) {
      soundFx.playClick();
    }
  };

  const handleQuickAdd = (key: StatKey, amount: number) => {
    clearHoldTimers();
    if (amount <= 0) return;
    if (applyStep(key, amount)) {
      soundFx.playClick();
    }
  };

  const handleSelectGear = (classId: MechClassId) => {
    clearHoldTimers();
    setPending({ ...EMPTY_STAT_BLOCK });
    setExpandedStatKey(null);
    setSheetStatKey(null);
    selectActiveGear(classId);
  };

  const handleBuyGear = (classId: MechClassId) => {
    clearHoldTimers();
    const res = buyGear(classId);
    if (res.ok) {
      setPending({ ...EMPTY_STAT_BLOCK });
      setExpandedStatKey(null);
      setSheetStatKey(null);
    }
  };

  const handleConfirmAllocation = () => {
    clearHoldTimers();
    if (pendingTotal <= 0) return;
    commitStatAllocations(pending);
    setPending({ ...EMPTY_STAT_BLOCK });
  };

  const handleRespec = () => {
    clearHoldTimers();
    resetStatAllocations();
    setPending({ ...EMPTY_STAT_BLOCK });
  };

  const formatBreakdownFormula = useCallback(
    (entry: StatSourceBreakdown): string => {
      const terms = STAT_SOURCES.map((src, index) => {
        const value = entry[src.key];
        const label = t(src.labelKey);
        if (index === 0) return `${label} ${value}`;
        if (value < 0) return `- ${label} ${Math.abs(value)}`;
        return `+ ${label} ${value}`;
      });
      return `${terms.join(' ')} = ${entry.total}`;
    },
    [t]
  );

  const handleToggleBreakdownRow = (key: StatKey) => {
    soundFx.playClick();
    if (isPhone) {
      setSheetStatKey(key);
      return;
    }
    setExpandedStatKey((prev) => (prev === key ? null : key));
  };

  const activeGearDisplayName =
    pilot.name.trim() || getClassName(lang, activeGear.classId);

  const derivedCards = [
    {
      key: 'hp',
      label: t('derived.maxHp'),
      cur: currentDerived.maxHp,
      prev: previewDerived.maxHp,
      color: 'text-emerald-400',
    },
    {
      key: 'shield',
      label: t('derived.maxShield'),
      cur: currentDerived.maxShield,
      prev: previewDerived.maxShield,
      color: 'text-sky-400',
    },
    {
      key: 'sp',
      label: t('derived.maxSp'),
      cur: currentDerived.maxSp,
      prev: previewDerived.maxSp,
      color: 'text-amber-400',
    },
    {
      key: 'speed',
      label: t('derived.speed'),
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

  const sheetEntry = sheetStatKey ? statBreakdown[sheetStatKey] : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4">
      {/* Header + Pilot Callsign & Shared Wallet */}
      <div className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100">
            {t('garage.title')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('garage.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="garage-pilot-name"
              className="text-xs text-slate-400 whitespace-nowrap"
            >
              {t('hangar.callsign')}:
            </label>
            <input
              id="garage-pilot-name"
              type="text"
              maxLength={18}
              value={pilot.name}
              onChange={(e) => setPilotName(e.target.value)}
              placeholder={t('hangar.callsignPlaceholder')}
              className="min-h-[44px] sm:min-h-0 sm:h-9 w-36 px-2.5 rounded border border-slate-700 bg-[#080C14] text-sm sm:text-xs font-semibold text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="pl-3 border-l border-slate-800 text-right">
            <div className="text-[10px] text-slate-400">
              {t('shop.availableCredits')}
            </div>
            <div className="font-mono-nums text-base font-bold text-amber-400 leading-tight">
              {pilot.credits.toLocaleString()} CR
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE GEAR CHARACTER SUMMARY */}
      <section
        data-testid="character-summary"
        className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-lg border border-slate-800 bg-[#080C14] flex items-center justify-center shrink-0">
              <FighterSvg
                classId={activeGear.classId}
                side="ally"
                facing="right"
                size="sm"
                className="w-10 h-10"
              />
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t('garage.summaryTitle')}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h2 className="font-display text-xl font-bold text-slate-100 leading-none truncate">
                  {activeGearDisplayName}
                </h2>
                <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-semibold text-slate-200">
                  <ClassIcon
                    classId={activeGear.classId}
                    className="w-3.5 h-3.5 shrink-0"
                  />
                  <span>{getClassName(lang, activeGear.classId)}</span>
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1 truncate">
                {getClassCode(lang, activeGear.classId)} ·{' '}
                {getClassRole(lang, activeGear.classId)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="rounded border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 font-mono-nums text-sm font-bold text-amber-300">
              {t('common.levelShort')}
              {activeGear.level}
            </span>
            {activeGear.unspentPoints > 0 ? (
              <span
                data-testid="summary-unspent-points"
                className="rounded border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 font-mono-nums text-xs font-semibold text-sky-300"
              >
                {t('garage.unspentPts', { count: activeGear.unspentPoints })}
              </span>
            ) : (
              <span
                data-testid="summary-unspent-points"
                className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400"
              >
                {t('garage.allAllocated')}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80 items-center">
          <div className="md:col-span-6">
            <StatBar
              label={t('garage.expToNext')}
              value={activeGear.exp}
              max={activeNextExp}
              valueText={`${activeGear.exp} / ${activeNextExp}`}
              valueClassName="text-slate-300"
              fillClassName="bg-amber-400"
              heightClassName="h-2"
              showTrail={false}
            />
          </div>

          <div className="md:col-span-6 flex flex-wrap items-center justify-between md:justify-end gap-4 text-xs font-mono-nums">
            <div>
              <span className="text-slate-400">{t('common.power')}: </span>
              <span className="font-bold text-sky-300">{activePower}</span>
            </div>
            <div className="text-slate-300">
              {t('garage.record', {
                won: activeGear.battlesWon,
                fought: activeGear.battlesFought,
              })}
            </div>
          </div>
        </div>
      </section>

      {/* TOTAL STATS WITH SOURCE BREAKDOWN */}
      <section
        data-testid="total-stats-section"
        className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold tracking-wide text-slate-100">
            {t('garage.totalStatsTitle')}
          </h2>
          <span className="text-xs text-slate-400">
            {t('garage.totalStatsHint')}
          </span>
        </div>

        {/* 5-Source Color + Label Legend (non-green, non-red) */}
        <div
          data-testid="total-stats-legend"
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-2 border-b border-slate-800/80 text-xs"
        >
          {STAT_SOURCES.map((src) => (
            <div key={src.key} className="inline-flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-xs shrink-0"
                style={{ backgroundColor: src.color }}
                aria-hidden="true"
              />
              <span className="text-slate-200 font-medium">
                {t(src.labelKey)}
              </span>
            </div>
          ))}
        </div>

        {/* 6 Stat Rows */}
        <div className="space-y-2">
          {STAT_KEYS.map((key) => {
            const entry = statBreakdown[key];
            const isExpanded = !isPhone && expandedStatKey === key;
            const positiveSources = STAT_SOURCES.filter(
              (src) => entry[src.key] > 0
            );
            const statShort = getStatShort(lang, key);
            const statLabel = getStatLabel(lang, key);
            const formula = formatBreakdownFormula(entry);

            return (
              <div
                key={key}
                className="rounded-lg border border-slate-800/90 bg-[#080C14]/90 overflow-hidden"
              >
                <button
                  type="button"
                  data-testid={`total-stat-row-${key}`}
                  aria-expanded={!isPhone ? isExpanded : undefined}
                  onClick={() => handleToggleBreakdownRow(key)}
                  className="w-full min-h-[44px] px-3 py-2.5 text-left hover:bg-slate-900/70 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-mono-nums text-xs font-bold text-slate-400 w-9 shrink-0">
                        {statShort}
                      </span>
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {statLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        data-testid={`total-stat-value-${key}`}
                        className="font-mono-nums text-base font-bold text-slate-100"
                      >
                        {entry.total}
                      </span>
                      {!isPhone &&
                        (isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ))}
                    </div>
                  </div>

                  {/* Segmented Source Bar (positive sources only; numbers inside segments) */}
                  <div
                    data-testid={`total-stat-bar-${key}`}
                    className="w-full h-5 rounded bg-slate-900/95 border border-slate-800 flex items-stretch overflow-hidden gap-px"
                  >
                    {positiveSources.map((src) => {
                      const val = entry[src.key];
                      const srcLabel = t(src.labelKey);
                      return (
                        <div
                          key={src.key}
                          data-testid={`total-stat-seg-${key}-${src.key}`}
                          aria-label={`${srcLabel}: ${val}`}
                          title={`${srcLabel}: ${val}`}
                          style={{
                            backgroundColor: src.color,
                            flexGrow: val,
                            flexBasis: '0%',
                            minWidth: '24px',
                          }}
                          className="flex items-center justify-center px-1 font-mono-nums text-[11px] font-bold text-slate-950 leading-none select-none overflow-hidden"
                        >
                          <span className="truncate">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </button>

                {isExpanded && (
                  <div
                    data-testid={`total-stat-detail-${key}`}
                    className="px-3 py-2.5 border-t border-slate-800/80 bg-[#0A101B] space-y-1.5 text-xs"
                  >
                    <div className="font-mono-nums text-slate-200 font-medium break-words">
                      {formula}
                    </div>
                    {entry.other < 0 && (
                      <div className="text-[11px] text-slate-400">
                        {t('garage.breakdownNegativeNote', {
                          source: t('garage.source.other'),
                          val: entry.other,
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* OWNED & LOCKED GEARS ROSTER (4 Cards) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
            {t('garage.rosterTitle', { owned: ownedCount })}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {MECH_CLASS_LIST.map((cls) => {
            const gear = pilot.gears[cls.id];
            const isSelected = pilot.activeGearId === cls.id;
            const power = calculateGearPowerRating(gear, pilot.inventory);
            const nextExp = getExpForNextLevel(gear.level);
            const canAfford = pilot.credits >= nextGearPrice;

            return (
              <div
                key={cls.id}
                className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  !gear.owned
                    ? 'border-slate-800/80 bg-[#0A0F18]/80 opacity-90'
                    : isSelected
                    ? 'border-amber-400/90 bg-slate-900/95 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]'
                    : 'border-slate-800/90 bg-[#0C121D]/95 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <ClassIcon
                          classId={cls.id}
                          className="w-4 h-4 shrink-0"
                        />
                        <h3 className="font-display text-xl font-bold text-slate-100 leading-none truncate">
                          {getClassName(lang, cls.id)}
                        </h3>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate">
                        {getClassCode(lang, cls.id)} ·{' '}
                        {getClassRole(lang, cls.id)}
                      </div>
                    </div>

                    {gear.owned ? (
                      <span className="font-mono-nums text-xs font-bold text-amber-400 shrink-0">
                        {t('common.levelShort')}
                        {gear.level}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                        <Lock className="w-3 h-3" />
                        <span>{t('common.locked')}</span>
                      </span>
                    )}
                  </div>

                  {/* Fighter Preview */}
                  <div className="relative py-1 flex items-center justify-center">
                    <div
                      className={gear.owned ? '' : 'opacity-45 grayscale'}
                    >
                      <FighterSvg
                        classId={cls.id}
                        side="ally"
                        facing="right"
                        size="sm"
                        heroHover={isSelected}
                        className="w-24 h-24"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                    {getClassDesc(lang, cls.id)}
                  </p>

                  {/* Metrics: Power, EXP, Record, Unspent Pts */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between font-mono-nums">
                      <span className="text-slate-400">{t('common.power')}</span>
                      <span className="font-bold text-sky-300">{power}</span>
                    </div>

                    {gear.owned && (
                      <>
                        <StatBar
                          label="EXP"
                          value={gear.exp}
                          max={nextExp}
                          valueText={`${gear.exp} / ${nextExp}`}
                          valueClassName="text-slate-400"
                          fillClassName="bg-amber-400"
                          heightClassName="h-1.5"
                          showTrail={false}
                        />

                        <div className="flex items-center justify-between text-[11px] font-mono-nums pt-0.5">
                          <span className="text-slate-400">
                            {t('garage.record', {
                              won: gear.battlesWon,
                              fought: gear.battlesFought,
                            })}
                          </span>
                          {gear.unspentPoints > 0 && (
                            <span className="text-emerald-400 font-semibold">
                              +{gear.unspentPoints} pts
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Button: Select (if owned) or Buy (if locked) */}
                {gear.owned ? (
                  <button
                    type="button"
                    onClick={() => handleSelectGear(cls.id)}
                    className={`w-full min-h-[44px] px-3 rounded-lg text-sm sm:text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100'
                    }`}
                  >
                    {isSelected
                      ? t('garage.selectedGear')
                      : t('garage.selectGear')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => handleBuyGear(cls.id)}
                    className="w-full min-h-[44px] px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-semibold text-sm sm:text-xs transition-colors cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>
                      {canAfford
                        ? t('garage.buyGear', {
                            cost: nextGearPrice.toLocaleString(),
                          })
                        : t('garage.needMoreCr', {
                            cost: nextGearPrice.toLocaleString(),
                          })}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3-ROW SQUAD FORMATION EDITOR */}
      <FormationEditor />

      {/* ACTIVE GEAR STAT ALLOCATION PANEL */}
      <section className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide text-slate-100">
              {t('garage.statsSection', {
                gear: getClassName(lang, activeGear.classId),
                level: activeGear.level,
              })}
            </h2>
            <p className="text-xs text-slate-400">
              {t('hangar.statSubtitle', {
                perLevel: BALANCE_CONFIG.statPointsPerLevel,
              })}
            </p>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-slate-400">
              {t('hangar.availablePts')}
            </div>
            <div
              data-testid="allocation-remaining-points"
              className={`font-mono-nums text-2xl font-bold leading-none ${
                remainingPoints > 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {remainingPoints}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* 6 Base Stat Allocation Rows */}
          <div className="xl:col-span-7 divide-y divide-slate-800/80">
            {STAT_KEYS.map((key) => {
              const gainPerPt = activeClass.perPointGain[key];
              const curVal = currentStats[key];
              const prevVal = previewStats[key];
              const delta = prevVal - curVal;
              const gearBonus = equipBonuses[key];
              const spentPts = activeGear.allocatedPoints[key];
              const pendingPts = pending[key];
              const statShort = getStatShort(lang, key);

              return (
                <div
                  key={key}
                  className="py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono-nums text-xs font-bold text-slate-400 w-9">
                        {statShort}
                      </span>
                      <span className="text-sm font-semibold text-slate-100">
                        {getStatLabel(lang, key)}
                      </span>
                      <span className="font-mono-nums text-xs text-sky-400">
                        {t('hangar.perPt', { gain: gainPerPt })}
                      </span>
                      {gearBonus > 0 && (
                        <span className="font-mono-nums text-xs text-amber-400">
                          {t('hangar.gearBonus', { bonus: gearBonus })}
                        </span>
                      )}
                      {spentPts > 0 && (
                        <span className="font-mono-nums text-xs text-slate-500">
                          {t('hangar.spentPt', { pts: spentPts })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {getStatDesc(lang, key)}
                    </p>
                  </div>

                  <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="sm:w-20 text-left sm:text-right font-mono-nums">
                      <span
                        className={`text-base font-bold ${
                          delta > 0 ? 'text-emerald-400' : 'text-slate-100'
                        }`}
                      >
                        {prevVal}
                      </span>
                      {delta > 0 && (
                        <span className="ml-1 text-xs font-semibold text-emerald-400">
                          +{delta}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={pendingPts <= 0}
                        onPointerDown={(e) => handleStepPointerDown(key, -1, e)}
                        onPointerUp={() => handleStepPointerEnd(false)}
                        onPointerLeave={() => handleStepPointerEnd(true)}
                        onPointerCancel={() => handleStepPointerEnd(true)}
                        onBlur={() => handleStepPointerEnd(true)}
                        onClick={() => handleStepClick(key, -1)}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={`-${statShort}`}
                        className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center text-slate-200 transition-colors cursor-pointer touch-manipulation select-none"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span
                        data-testid={`pending-count-${key}`}
                        className="w-5 sm:w-6 text-center font-mono-nums text-xs font-semibold text-slate-300"
                      >
                        {pendingPts}
                      </span>
                      <button
                        type="button"
                        disabled={remainingPoints <= 0}
                        onPointerDown={(e) => handleStepPointerDown(key, 1, e)}
                        onPointerUp={() => handleStepPointerEnd(false)}
                        onPointerLeave={() => handleStepPointerEnd(true)}
                        onPointerCancel={() => handleStepPointerEnd(true)}
                        onBlur={() => handleStepPointerEnd(true)}
                        onClick={() => handleStepClick(key, 1)}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={`+${statShort}`}
                        className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center text-emerald-400 transition-colors cursor-pointer touch-manipulation select-none"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={remainingPoints <= 0}
                        onClick={() => handleQuickAdd(key, 5)}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={t('garage.allocationPlus5Label', {
                          stat: statShort,
                        })}
                        className="min-h-[44px] min-w-[44px] px-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center font-mono-nums text-xs font-bold text-sky-300 transition-colors cursor-pointer touch-manipulation select-none"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        disabled={remainingPoints <= 0}
                        onClick={() => handleQuickAdd(key, remainingPoints)}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={t('garage.allocationMaxLabel', {
                          stat: statShort,
                        })}
                        className="min-h-[44px] min-w-[44px] px-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center font-mono-nums text-[11px] font-bold tracking-wide text-amber-300 transition-colors cursor-pointer touch-manipulation select-none"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Derived Combat Telemetry Preview + Commit/Respec */}
          <div className="xl:col-span-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                {t('hangar.derivedTitle')}
              </span>
              {pendingTotal > 0 && (
                <span className="text-emerald-400 font-medium">
                  {t('hangar.livePreview')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {derivedCards.map((m) => {
                const diff = m.prev - m.cur;
                return (
                  <div
                    key={m.key}
                    className="rounded border border-slate-800/90 bg-[#080C14] px-3 py-2"
                  >
                    <div className="text-[11px] text-slate-400">{m.label}</div>
                    <div className="mt-0.5 font-mono-nums text-base font-bold flex items-baseline gap-1.5">
                      <span className={diff > 0 ? 'text-emerald-400' : m.color}>
                        {m.prev}
                        {m.suffix ?? ''}
                      </span>
                      {diff > 0 && (
                        <span className="text-xs text-emerald-400">+{diff}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={spentTotal <= 0}
                onClick={handleRespec}
                title={t('hangar.respecTitle')}
                className="min-h-[44px] px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-slate-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('hangar.respec')}</span>
              </button>

              <div className="flex items-center gap-2">
                {pendingTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearHoldTimers();
                      soundFx.playClick();
                      setPending({ ...EMPTY_STAT_BLOCK });
                    }}
                    className="min-h-[44px] px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 cursor-pointer"
                  >
                    {t('common.clear')}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pendingTotal <= 0}
                  onClick={handleConfirmAllocation}
                  className="min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {pendingTotal > 0
                      ? t('hangar.confirmAllocCount', { count: pendingTotal })
                      : t('hangar.confirmAlloc')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phone Stat Breakdown BottomSheet (no nested scroll box) */}
      <BottomSheet
        open={sheetStatKey !== null && sheetEntry !== null}
        onClose={() => setSheetStatKey(null)}
        bodyScrollable={false}
        title={
          sheetStatKey
            ? `${getStatShort(lang, sheetStatKey)} — ${getStatLabel(lang, sheetStatKey)}`
            : ''
        }
        subtitle={
          sheetEntry
            ? `${t('garage.breakdownTotal')}: ${sheetEntry.total}`
            : undefined
        }
      >
        {sheetStatKey && sheetEntry && (
          <div data-testid="total-stat-sheet" className="p-4 space-y-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-[#080C14] p-3 font-mono-nums text-xs text-slate-100 leading-relaxed">
              {formatBreakdownFormula(sheetEntry)}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {STAT_SOURCES.map((src) => (
                <div
                  key={src.key}
                  className="flex items-center justify-between rounded border border-slate-800/90 bg-[#080C14]/80 px-2.5 py-2 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: src.color }}
                      aria-hidden="true"
                    />
                    <span>{t(src.labelKey)}</span>
                  </span>
                  <span className="font-mono-nums font-bold text-slate-100">
                    {sheetEntry[src.key]}
                  </span>
                </div>
              ))}
            </div>

            {sheetEntry.other < 0 && (
              <p className="text-xs text-slate-400">
                {t('garage.breakdownNegativeNote', {
                  source: t('garage.source.other'),
                  val: sheetEntry.other,
                })}
              </p>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

