import { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Flame,
  Heart,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { getMaxLevel } from '../data/balance';
import { STAT_KEYS } from '../data/classes';
import { RARITY_META } from '../data/items';
import { aggregateBattleStats } from '../engine/battleStats';
import { getEffectiveItemStats } from '../engine/equipment';
import {
  getClassName,
  getItemInstanceName,
  getRarityLabel,
  getSectorName,
  getSlotLabel,
  getStatShort,
  getStatsSkillLabel,
  useI18n,
} from '../i18n';
import type {
  BattleState,
  MechClassId,
  UnitBattleStats,
} from '../types/game';
import { buildLiveBattleProgress } from '../utils/combatLogFormat';

export type StatsTab = 'overview' | 'units' | 'charts';

interface BattleStatsModalProps {
  open: boolean;
  onClose: () => void;
  battle: BattleState;
  enrageBonusPct: number;
  initialTab?: StatsTab;
  onOpenLog?: () => void;
}

type SortColumn =
  | 'damageDealt'
  | 'damageTakenTotal'
  | 'healingDone'
  | 'shieldGranted'
  | 'critRate'
  | 'dodges'
  | 'kills'
  | 'spSpent'
  | 'damagePerTurn';
type BarMetric = 'damageDealt' | 'damageTakenTotal' | 'healingDone';

function getUnitAccentHex(u: UnitBattleStats): string {
  if (u.isPlayer) return '#22C55E';
  if (u.side === 'ally') return '#38BDF8';
  if (u.isBoss) return '#F97316';
  return '#EF4444';
}

function getClassBadgeSymbol(classId: MechClassId): string {
  switch (classId) {
    case 'striker':
      return '▲';
    case 'interceptor':
      return '◆';
    case 'siege':
      return '■';
    case 'support':
      return '✚';
    default:
      return '●';
  }
}

function safeSvgNum(val: number, fallback = 0): number {
  return Number.isFinite(val) ? Math.round(val * 100) / 100 : fallback;
}

const DONUT_COLORS = [
  '#38BDF8',
  '#F59E0B',
  '#10B981',
  '#A855F7',
  '#EC4899',
  '#F97316',
  '#22D3EE',
];

export function BattleStatsModal({
  open,
  onClose,
  battle,
  enrageBonusPct,
  initialTab = 'overview',
  onOpenLog,
}: BattleStatsModalProps) {
  const { lang, t } = useI18n();
  const [activeTab, setActiveTab] = useState<StatsTab>(initialTab);
  const [sortCol, setSortCol] = useState<SortColumn>('damageDealt');
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [barMetric, setBarMetric] = useState<BarMetric>('damageDealt');
  const [donutUnitId, setDonutUnitId] = useState<string>(() => {
    const units = Array.isArray(battle?.units) ? battle.units : [];
    const player = units.find((u) => u.isPlayer);
    return player?.id ?? units[0]?.id ?? '';
  });
  const [tooltipInfo, setTooltipInfo] = useState<string | null>(null);

  const stats = useMemo(
    () =>
      aggregateBattleStats(
        battle?.units ?? [],
        battle?.events ?? [],
        battle?.roundSnapshots ?? [],
        battle?.round ?? 1
      ),
    [battle?.units, battle?.events, battle?.roundSnapshots, battle?.round]
  );

  const liveProgress = useMemo(
    () => buildLiveBattleProgress(battle, stats),
    [battle, stats]
  );

  const unitById = useMemo(
    () => new Map(stats.units.map((u) => [u.unitId, u])),
    [stats.units]
  );

  const sortedUnits = useMemo(() => {
    return [...stats.units].sort((a, b) => {
      const aVal = Number.isFinite(a[sortCol]) ? a[sortCol] : 0;
      const bVal = Number.isFinite(b[sortCol]) ? b[sortCol] : 0;
      const diff = aVal - bVal;
      if (diff !== 0) return sortDesc ? -diff : diff;
      return a.name.localeCompare(b.name);
    });
  }, [stats.units, sortCol, sortDesc]);

  const effectiveDonutUnit =
    unitById.get(donutUnitId) ??
    stats.units.find((u) => u.isPlayer) ??
    stats.units[0] ??
    null;

  // CRITICAL: All hooks MUST run before any conditional early return (Rules of Hooks).
  const donutSlices = useMemo(() => {
    if (!effectiveDonutUnit || !effectiveDonutUnit.skills) return [];
    const entries = Object.values(effectiveDonutUnit.skills)
      .filter((sk) => sk && Number.isFinite(sk.damage) && sk.damage > 0)
      .sort((a, b) => b.damage - a.damage);
    const total = entries.reduce((sum, e) => sum + e.damage, 0);
    if (!Number.isFinite(total) || total <= 0) return [];
    let running = 0;
    return entries.map((e, idx) => {
      const pct = Math.max(0, Math.min(1, e.damage / total));
      const start = running;
      running += pct;
      return {
        skillId: e.skillId,
        label: getStatsSkillLabel(lang, e.skillId),
        damage: e.damage,
        uses: e.uses,
        pct,
        start,
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
      };
    });
  }, [effectiveDonutUnit, lang]);

  if (!open) return null;

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDesc((prev) => !prev);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const safeEnrageBonus = Number.isFinite(enrageBonusPct)
    ? Math.max(0, enrageBonusPct)
    : 0;
  const enragePct = Math.round(safeEnrageBonus * 100);
  const enrageMult = (1 + safeEnrageBonus).toFixed(1);

  const remainingSum = stats.ally.remainingHp + stats.enemy.remainingHp;
  const allyMomentumPct =
    remainingSum > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((stats.ally.remainingHp / remainingSum) * 100))
        )
      : 50;
  const enemyMomentumPct = 100 - allyMomentumPct;

  // Chart (a): Horizontal Bar Chart sorted by selected metric
  const barUnits = [...stats.units].sort(
    (a, b) => (b[barMetric] ?? 0) - (a[barMetric] ?? 0)
  );
  const barPeak = barUnits.reduce(
    (max, u) => Math.max(max, Number.isFinite(u[barMetric]) ? u[barMetric] : 0),
    0
  );
  const hasBarData = barUnits.length > 0 && barPeak > 0;
  const barMax = Math.max(1, barPeak);

  // Chart (b): Cumulative Damage Line Chart
  const dmgSeries = stats.roundDamageSeries;
  const peakCumDmg = dmgSeries.reduce(
    (max, p) =>
      Math.max(
        max,
        Number.isFinite(p.allyCumulativeDamage) ? p.allyCumulativeDamage : 0,
        Number.isFinite(p.enemyCumulativeDamage) ? p.enemyCumulativeDamage : 0
      ),
    0
  );
  const hasCumDmgData = dmgSeries.length > 0 && peakCumDmg > 0;
  const maxCumDmg = Math.max(10, peakCumDmg);

  // Chart (c): Team HP% per Round Line Chart
  const hpSeries = stats.roundHpSeries;
  const hasHpSeriesData =
    hpSeries.length > 0 &&
    stats.units.length > 0 &&
    (stats.ally.totalMaxHp > 0 || stats.enemy.totalMaxHp > 0);

  const renderLinePoints = (
    count: number,
    valueAt: (i: number) => number,
    maxVal: number,
    w: number,
    h: number,
    padX: number,
    padY: number
  ) => {
    if (count <= 0) return [];
    const safeMax = Number.isFinite(maxVal) && maxVal > 0 ? maxVal : 1;
    const innerW = Math.max(1, w - padX * 2);
    const innerH = Math.max(1, h - padY * 2);
    return Array.from({ length: count }, (_, i) => {
      const rawVal = valueAt(i);
      const val = Number.isFinite(rawVal) ? Math.max(0, rawVal) : 0;
      const x =
        count <= 1 ? padX + innerW / 2 : padX + (i / (count - 1)) * innerW;
      const ratio = Math.max(0, Math.min(1, val / safeMax));
      const y = padY + innerH - ratio * innerH;
      return {
        x: safeSvgNum(x, padX),
        y: safeSvgNum(y, padY + innerH),
      };
    });
  };

  // ==================== MODE B: END-OF-BATTLE REPORT (SINGLE SCROLLABLE SHEET) ====================
  if (battle.summary) {
    const summary = battle.summary;
    const isVictory = summary.outcome === 'victory';
    const outcomeTitle = isVictory
      ? t('summary.victory')
      : summary.retreated
      ? t('summary.retreatTitle')
      : t('summary.defeat');

    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end md:items-center justify-center md:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-stats-modal-title"
        data-testid="battle-stats-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          data-testid="battle-report-sheet"
          className="w-full md:max-w-4xl h-[92dvh] md:h-[88dvh] rounded-t-2xl md:rounded-xl border border-slate-700/90 bg-[#0B111C] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Short Header: Outcome, Sector, Turns */}
          <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-800 bg-[#090E17] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Award
                className={`w-5 h-5 shrink-0 ${
                  isVictory ? 'text-emerald-400' : 'text-red-400'
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    id="battle-stats-modal-title"
                    className="font-display text-xl sm:text-2xl font-bold text-slate-100 leading-tight truncate"
                  >
                    {t('stats.reportTitle')}
                  </h2>
                  <span
                    data-testid="report-outcome-badge"
                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      isVictory
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {outcomeTitle}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono-nums text-slate-400 mt-0.5">
                  <span>{getSectorName(lang, summary.sectorId)}</span>
                  <span>·</span>
                  <span>
                    {t('stats.roundsLabel')}:{' '}
                    <strong className="text-slate-100">{summary.rounds}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    {t('stats.turnLabel')}:{' '}
                    <strong className="text-slate-100">
                      {battle.turnCounter}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="min-w-[44px] min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white inline-flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* One Scrollable Sheet: 1) Result & Rewards  2) Per-Unit Table  3) Log Shortcut */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 tactical-scroll">
            {/* Section 1: Result & Rewards (no duplicated metrics) */}
            <section
              data-testid="report-section-rewards"
              className="space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('stats.sectionResultRewards')}
              </h3>

              {summary.leveledUp && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-[15px] font-bold text-emerald-300">
                      {t('summary.levelUp', {
                        gear: getClassName(lang, summary.deployedGearId),
                        prev: summary.previousLevel,
                        next: summary.newLevel,
                      })}
                    </div>
                    <div className="text-xs text-emerald-200/80">
                      {t('summary.levelUpDesc')}
                    </div>
                  </div>
                  <div className="font-mono-nums text-sm font-bold text-emerald-300 whitespace-nowrap">
                    +{summary.statPointsGained} PTS
                  </div>
                </div>
              )}

              {summary.unlockedSectorId && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300">
                  {t('summary.sectorUnlocked', {
                    sector: getSectorName(lang, summary.unlockedSectorId),
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-3">
                  <div className="text-[11px] text-slate-400">
                    {t('summary.expEarned', {
                      gear: getClassName(lang, summary.deployedGearId),
                    })}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-lg font-bold text-amber-400">
                    +{summary.expGained} EXP
                  </div>
                  <div className="text-[11px] font-mono-nums text-slate-500">
                    {summary.newLevel >= getMaxLevel()
                      ? t('summary.maxLevelReached')
                      : t('summary.battlesToNext', {
                          count: summary.battlesToNextLevel,
                          next: summary.newLevel + 1,
                        })}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-3">
                  <div className="text-[11px] text-slate-400">
                    {t('summary.creditsAwarded')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-lg font-bold text-slate-100">
                    +{summary.creditsGained.toLocaleString()} CR
                  </div>
                </div>

                <div className="rounded-lg border border-purple-500/35 bg-purple-500/10 p-3">
                  <div className="text-[11px] text-purple-200">
                    {t('summary.warPointsAwarded')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-lg font-bold text-purple-300">
                    +{summary.warPointsGained} WP
                  </div>
                  {summary.baseCaptureBonusWp > 0 && (
                    <div className="text-[11px] text-purple-300/80">
                      {t('summary.captureBonusNote', {
                        wp: summary.baseCaptureBonusWp,
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-3">
                  <div className="text-[11px] text-slate-400">
                    {t('summary.hostilesDestroyed')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-lg font-bold text-red-300">
                    {summary.enemiesDestroyed}/{summary.totalEnemies}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-3">
                  <div className="text-[11px] text-slate-400">
                    {t('summary.alliesSurviving')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-lg font-bold text-sky-300">
                    {summary.alliesSurviving}/{battle.squadSize}
                  </div>
                </div>
              </div>

              {/* Salvaged Drops */}
              {summary.droppedItems.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                      <Package className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('summary.dropsTitle')}</span>
                    </span>
                    <span className="font-mono-nums">
                      {t('common.itemCount', {
                        count: summary.droppedItems.length,
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {summary.droppedItems.map((inst) => {
                      const itemStats = getEffectiveItemStats(inst);
                      return (
                        <div
                          key={inst.instanceId}
                          className={`rounded border bg-[#090D14] px-3 py-2 flex items-center justify-between gap-2 ${
                            RARITY_META[inst.rarity].borderClass
                          }`}
                        >
                          <div className="min-w-0">
                            <div
                              className={`text-xs font-semibold truncate ${
                                RARITY_META[inst.rarity].textClass
                              }`}
                            >
                              {getItemInstanceName(lang, inst)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {getSlotLabel(lang, inst.slot)} ·{' '}
                              {getRarityLabel(lang, inst.rarity)} · T{inst.tier}
                            </div>
                          </div>
                          <div className="text-right font-mono-nums text-[11px] text-emerald-400 shrink-0">
                            {STAT_KEYS.filter((k) => itemStats[k] > 0)
                              .map(
                                (k) => `+${itemStats[k]} ${getStatShort(lang, k)}`
                              )
                              .join(' ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Section 2: Clean Per-Unit Table (Damage, Healing, Taken, Kills) */}
            <section data-testid="report-section-units" className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t('stats.sectionUnitsTable')}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {t('stats.expandHint')}
                </span>
              </div>

              {sortedUnits.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-[#0D1523] py-8 text-center text-xs text-slate-400">
                  {t('stats.noData')}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-[#0D1523] overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#090E17] text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">
                          {t('stats.colUnit')}
                        </th>
                        {(
                          [
                            ['damageDealt', t('stats.colDmg')],
                            ['healingDone', t('stats.colHeal')],
                            ['damageTakenTotal', t('stats.colTaken')],
                            ['kills', t('stats.colKillsSimple')],
                          ] as [SortColumn, string][]
                        ).map(([col, label]) => (
                          <th
                            key={col}
                            className="py-2.5 px-3 font-semibold whitespace-nowrap text-right"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(col)}
                              className={`inline-flex items-center gap-1 cursor-pointer hover:text-white ${
                                sortCol === col ? 'text-sky-300' : ''
                              }`}
                            >
                              <span>{label}</span>
                              {sortCol === col && (
                                <span>{sortDesc ? '↓' : '↑'}</span>
                              )}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {sortedUnits.map((u) => {
                        const isExpanded = expandedUnitId === u.unitId;
                        const accent = getUnitAccentHex(u);
                        const skillList = Object.values(u.skills ?? {}).sort(
                          (a, b) =>
                            b.damage + b.healing - (a.damage + a.healing)
                        );
                        return (
                          <tr key={u.unitId}>
                            <td colSpan={5} className="p-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedUnitId(
                                    isExpanded ? null : u.unitId
                                  )
                                }
                                className="w-full text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
                              >
                                <div className="grid grid-cols-[minmax(140px,2fr)_repeat(4,minmax(64px,1fr))] items-center">
                                  <div className="py-2.5 px-3 flex items-center gap-2 min-w-0">
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    )}
                                    <span
                                      className="text-xs font-bold shrink-0"
                                      style={{ color: accent }}
                                    >
                                      {getClassBadgeSymbol(u.classId)}
                                    </span>
                                    <div className="min-w-0">
                                      <div
                                        className={`font-semibold truncate ${
                                          u.alive
                                            ? 'text-slate-100'
                                            : 'text-slate-500 line-through'
                                        }`}
                                      >
                                        {u.name}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {getClassName(lang, u.classId)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="py-2.5 px-3 text-right font-mono-nums font-semibold text-red-300">
                                    {u.damageDealt.toLocaleString()}
                                  </div>
                                  <div className="py-2.5 px-3 text-right font-mono-nums text-emerald-300">
                                    {u.healingDone.toLocaleString()}
                                  </div>
                                  <div className="py-2.5 px-3 text-right font-mono-nums text-slate-200">
                                    {u.damageTakenTotal.toLocaleString()}
                                  </div>
                                  <div className="py-2.5 px-3 text-right font-mono-nums font-semibold text-amber-300">
                                    {u.kills}
                                  </div>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="px-4 py-2.5 bg-[#090F1A] border-t border-slate-800/80 space-y-2">
                                  {skillList.length === 0 ? (
                                    <div className="text-xs text-slate-500">
                                      {t('stats.noSkillUsage')}
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {skillList.map((sk) => (
                                        <div
                                          key={sk.skillId}
                                          className="rounded border border-slate-800 bg-[#0D1523] px-3 py-2 flex items-center justify-between gap-2"
                                        >
                                          <div className="min-w-0">
                                            <div className="text-xs font-semibold text-slate-100 truncate">
                                              {getStatsSkillLabel(
                                                lang,
                                                sk.skillId
                                              )}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                              {t('stats.uses', {
                                                count: sk.uses,
                                              })}
                                              {sk.crits > 0
                                                ? ` · ${sk.crits} CRIT`
                                                : ''}
                                            </div>
                                          </div>
                                          <div className="text-right font-mono-nums text-xs shrink-0">
                                            {sk.damage > 0 && (
                                              <div className="text-red-300 font-semibold">
                                                {sk.damage.toLocaleString()} DMG
                                              </div>
                                            )}
                                            {sk.healing > 0 && (
                                              <div className="text-emerald-300 font-semibold">
                                                +{sk.healing.toLocaleString()} HP
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Section 3: Combat Log Shortcut */}
            <section
              data-testid="report-section-log-shortcut"
              className="rounded-lg border border-slate-800 bg-[#0D1523] p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ScrollText className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100">
                    {t('battle.combatLog')}
                  </div>
                  <div className="text-xs font-mono-nums text-slate-400">
                    {t('battle.eventsCount', {
                      count: battle.log?.length ?? 0,
                    })}
                  </div>
                </div>
              </div>
              {onOpenLog && (
                <button
                  type="button"
                  data-testid="report-open-log-btn"
                  onClick={() => {
                    onClose();
                    onOpenLog();
                  }}
                  className="min-h-[40px] px-3.5 rounded-lg border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  <span>{t('stats.openCombatLog')}</span>
                </button>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MODE A: LIVE BATTLE PROGRESS ("DIỄN BIẾN") WHILE RUNNING ====================
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end md:items-center justify-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-stats-modal-title"
      data-testid="battle-stats-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full md:max-w-5xl h-[92dvh] md:h-[88dvh] rounded-t-2xl md:rounded-xl border border-slate-700/90 bg-[#0B111C] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-800 bg-[#090E17] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="battle-stats-modal-title"
                  className="font-display text-xl sm:text-2xl font-bold text-slate-100 leading-tight truncate"
                >
                  {t('stats.progressTitle')}
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  {t('stats.liveUpdating')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono-nums text-slate-400">
                <span>
                  {t('stats.roundsLabel')}:{' '}
                  <strong className="text-slate-100">{liveProgress.round}</strong>
                </span>
                <span>·</span>
                <span>
                  {t('stats.turnLabel')}:{' '}
                  <strong className="text-slate-100">{liveProgress.turn}</strong>
                </span>
                <span>·</span>
                {enragePct > 0 ? (
                  <span className="text-orange-300 font-semibold inline-flex items-center gap-1">
                    <Flame className="w-3 h-3 text-red-400" />
                    {t('stats.enrageActive', { pct: enragePct, mult: enrageMult })}
                  </span>
                ) : (
                  <span>{t('stats.enrageInactive')}</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-w-[44px] min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar: Progress | Units | Charts */}
        <div className="shrink-0 px-4 sm:px-6 pt-2.5 pb-2 border-b border-slate-800 bg-[#0A101A] flex items-center gap-2">
          {(
            [
              { id: 'overview', label: t('stats.progressBtn'), Icon: Activity },
              { id: 'units', label: t('stats.tabUnits'), Icon: Users },
              { id: 'charts', label: t('stats.tabCharts'), Icon: BarChart3 },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                data-testid={`stats-tab-${id}`}
                onClick={() => setActiveTab(id)}
                className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 tactical-scroll">
          {activeTab === 'overview' && (
            <div data-testid="battle-live-progress-view" className="space-y-4">
              {/* Top Row: Units Alive + Momentum + Active Buffs/Debuffs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Units Alive Per Side */}
                <div
                  data-testid="live-units-alive"
                  className="rounded-lg border border-slate-800 bg-[#0D1523] p-3.5 space-y-2"
                >
                  <div className="text-xs font-semibold text-slate-400">
                    {t('stats.unitsAlive')}
                  </div>
                  <div className="flex items-center justify-between font-mono-nums text-base font-bold">
                    <span className="text-sky-300">
                      {t('stats.teamAlly')}: {liveProgress.allyAlive}/
                      {liveProgress.allyTotal}
                    </span>
                    <span className="text-red-300">
                      {t('stats.teamEnemy')}: {liveProgress.enemyAlive}/
                      {liveProgress.enemyTotal}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
                    <div
                      style={{ width: `${allyMomentumPct}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-300"
                    />
                    <div
                      style={{ width: `${enemyMomentumPct}%` }}
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Damage Dealt / Taken Per Side */}
                <div
                  data-testid="live-side-damage"
                  className="rounded-lg border border-slate-800 bg-[#0D1523] p-3.5 space-y-1.5"
                >
                  <div className="text-xs font-semibold text-slate-400">
                    {t('stats.damageDealt')} / {t('stats.damageTaken')}
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono-nums">
                    <span className="text-sky-300 font-semibold">
                      {t('stats.teamAlly')}
                    </span>
                    <span className="text-slate-100">
                      <strong className="text-amber-300">
                        {liveProgress.allyDamageDealt.toLocaleString()}
                      </strong>{' '}
                      /{' '}
                      <span className="text-red-300">
                        {liveProgress.allyDamageTaken.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono-nums">
                    <span className="text-red-300 font-semibold">
                      {t('stats.teamEnemy')}
                    </span>
                    <span className="text-slate-100">
                      <strong className="text-amber-300">
                        {liveProgress.enemyDamageDealt.toLocaleString()}
                      </strong>{' '}
                      /{' '}
                      <span className="text-red-300">
                        {liveProgress.enemyDamageTaken.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Active Buffs / Debuffs Count */}
                <div
                  data-testid="live-active-effects"
                  className="rounded-lg border border-slate-800 bg-[#0D1523] p-3.5 space-y-1.5"
                >
                  <div className="text-xs font-semibold text-slate-400">
                    {t('stats.activeEffects')}
                  </div>
                  <div className="flex items-center justify-between font-mono-nums text-sm">
                    <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('stats.activeBuffs')}: {liveProgress.activeBuffsCount}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-purple-300 font-bold">
                      <Flame className="w-3.5 h-3.5" />
                      {t('stats.activeDebuffs')}: {liveProgress.activeDebuffsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono-nums text-slate-400">
                    <span>
                      {t('stats.teamAlly')}: {liveProgress.allyActiveBuffs}B /{' '}
                      {liveProgress.allyActiveDebuffs}D
                    </span>
                    <span>
                      {t('stats.teamEnemy')}: {liveProgress.enemyActiveBuffs}B /{' '}
                      {liveProgress.enemyActiveDebuffs}D
                    </span>
                  </div>
                </div>
              </div>

              {/* Top 3 Damage Dealers & Top 3 Healers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  data-testid="live-top-damage"
                  className="rounded-lg border border-slate-800 bg-[#0D1523] p-4 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                    <Swords className="w-4 h-4" />
                    <span>{t('stats.topDamageDealers')}</span>
                  </div>
                  {liveProgress.topDamageDealers.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      {t('stats.noDamageYet')}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {liveProgress.topDamageDealers.map((u, idx) => (
                        <div
                          key={u.unitId}
                          data-testid={`live-top-damage-row-${idx}`}
                          className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-800/60 last:border-b-0"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-mono-nums text-slate-500 w-4">
                              #{idx + 1}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getUnitAccentHex(u) }}
                            />
                            <span className="font-semibold text-slate-100 truncate">
                              {u.name}
                            </span>
                          </span>
                          <span className="font-mono-nums font-bold text-red-300 shrink-0">
                            {u.damageDealt.toLocaleString()} DMG
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  data-testid="live-top-healers"
                  className="rounded-lg border border-slate-800 bg-[#0D1523] p-4 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                    <Heart className="w-4 h-4" />
                    <span>{t('stats.topHealers')}</span>
                  </div>
                  {liveProgress.topHealers.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      {t('stats.noHealingYet')}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {liveProgress.topHealers.map((u, idx) => (
                        <div
                          key={u.unitId}
                          data-testid={`live-top-healer-row-${idx}`}
                          className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-800/60 last:border-b-0"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-mono-nums text-slate-500 w-4">
                              #{idx + 1}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getUnitAccentHex(u) }}
                            />
                            <span className="font-semibold text-slate-100 truncate">
                              {u.name}
                            </span>
                          </span>
                          <span className="font-mono-nums font-bold text-emerald-300 shrink-0">
                            +{u.healingDone.toLocaleString()} HP
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Mini Timeline of Kills */}
              <div
                data-testid="live-kill-timeline"
                className="rounded-lg border border-slate-800 bg-[#0D1523] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                    <Skull className="w-4 h-4" />
                    <span>{t('stats.killTimeline')}</span>
                  </div>
                  {onOpenLog && (
                    <button
                      type="button"
                      data-testid="live-progress-open-log"
                      onClick={() => {
                        onClose();
                        onOpenLog();
                      }}
                      className="px-2.5 py-1 rounded border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ScrollText className="w-3 h-3" />
                      <span>{t('battle.combatLog')}</span>
                    </button>
                  )}
                </div>
                {liveProgress.killTimeline.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    {t('stats.noKillsYet')}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {liveProgress.killTimeline.map((k) => (
                      <div
                        key={k.id}
                        data-testid="live-kill-item"
                        className="flex items-center gap-2 text-xs py-1 border-b border-slate-800/50 last:border-b-0"
                      >
                        <span className="font-mono-nums text-slate-500 shrink-0">
                          R{k.round}
                        </span>
                        <span
                          className={`font-semibold ${
                            k.killerSide === 'ally'
                              ? 'text-sky-300'
                              : k.killerSide === 'enemy'
                              ? 'text-red-300'
                              : 'text-slate-300'
                          }`}
                        >
                          {k.killerName}
                        </span>
                        <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span
                          className={`font-semibold line-through ${
                            k.victimSide === 'ally'
                              ? 'text-sky-400/80'
                              : k.victimSide === 'enemy'
                              ? 'text-red-400/80'
                              : 'text-slate-400'
                          }`}
                        >
                          {k.victimName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'units' && (
            <div className="space-y-3">
              {sortedUnits.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-[#0D1523] py-10 text-center text-xs text-slate-400">
                  {t('stats.noData')}
                </div>
              ) : (
                <>
                  <div className="text-xs text-slate-400">{t('stats.expandHint')}</div>
                  <div className="rounded-lg border border-slate-800 bg-[#0D1523] overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#090E17] text-slate-400">
                          <th className="py-2.5 px-3 font-semibold">{t('stats.colUnit')}</th>
                          {(
                            [
                              ['damageDealt', t('stats.colDmg')],
                              ['damageTakenTotal', t('stats.colTaken')],
                              ['healingDone', t('stats.colHeal')],
                              ['shieldGranted', t('stats.colShd')],
                              ['critRate', t('stats.colCrit')],
                              ['dodges', t('stats.colDodge')],
                              ['kills', t('stats.colKills')],
                              ['spSpent', t('stats.colSp')],
                              ['damagePerTurn', t('stats.colDpt')],
                            ] as [SortColumn, string][]
                          ).map(([col, label]) => (
                            <th key={col} className="py-2.5 px-2 font-semibold whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => toggleSort(col)}
                                className={`inline-flex items-center gap-1 cursor-pointer hover:text-white ${
                                  sortCol === col ? 'text-sky-300' : ''
                                }`}
                              >
                                <span>{label}</span>
                                {sortCol === col && (
                                  <span>{sortDesc ? '↓' : '↑'}</span>
                                )}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {sortedUnits.map((u) => {
                          const isExpanded = expandedUnitId === u.unitId;
                          const accent = getUnitAccentHex(u);
                          const skillList = Object.values(u.skills ?? {}).sort(
                            (a, b) => b.damage + b.healing - (a.damage + a.healing)
                          );

                          return (
                            <tr key={u.unitId} className="group">
                              <td colSpan={10} className="p-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedUnitId(isExpanded ? null : u.unitId)
                                  }
                                  className="w-full text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
                                >
                                  <div className="grid grid-cols-[minmax(150px,1.8fr)_repeat(9,minmax(54px,1fr))] items-center">
                                    <div className="py-2.5 px-3 flex items-center gap-2 min-w-0">
                                      {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      )}
                                      <span
                                        className="text-xs font-bold shrink-0"
                                        style={{ color: accent }}
                                        title={getClassName(lang, u.classId)}
                                      >
                                        {getClassBadgeSymbol(u.classId)}
                                      </span>
                                      <div className="min-w-0">
                                        <div
                                          className={`font-semibold truncate ${
                                            u.alive
                                              ? 'text-slate-100'
                                              : 'text-slate-500 line-through'
                                          }`}
                                        >
                                          {u.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          {getClassName(lang, u.classId)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums font-semibold text-amber-300">
                                      {u.damageDealt.toLocaleString()}
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-slate-200">
                                      {u.damageTakenTotal.toLocaleString()}
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-emerald-300">
                                      {u.healingDone.toLocaleString()}
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-sky-300">
                                      {u.shieldGranted.toLocaleString()}
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-slate-200">
                                      {u.critRate}%
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-slate-200">
                                      {u.dodges}
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-slate-200">
                                      {u.kills}/{u.deaths}
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-purple-300">
                                      {u.spSpent}
                                    </div>
                                    <div className="py-2.5 px-2 font-mono-nums text-slate-200">
                                      {u.damagePerTurn}
                                    </div>
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="px-4 py-3 bg-[#090F1A] border-t border-slate-800/80 space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                                      <span className="font-semibold text-slate-200">
                                        {t('stats.skillBreakdownTitle')}
                                      </span>
                                      <span className="font-mono-nums">
                                        {t('stats.hpDamage')}: {u.damageTakenHp.toLocaleString()} ·{' '}
                                        {t('stats.shieldAbsorbed')}:{' '}
                                        {u.damageTakenShield.toLocaleString()} ·{' '}
                                        {t('stats.buffsDebuffs')}: {u.buffsApplied}/
                                        {u.debuffsApplied}
                                      </span>
                                    </div>
                                    {skillList.length === 0 ? (
                                      <div className="text-xs text-slate-500">
                                        {t('stats.noSkillUsage')}
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {skillList.map((sk) => (
                                          <div
                                            key={sk.skillId}
                                            className="rounded border border-slate-800 bg-[#0D1523] px-3 py-2 flex items-center justify-between gap-2"
                                          >
                                            <div className="min-w-0">
                                              <div className="text-xs font-semibold text-slate-100 truncate">
                                                {getStatsSkillLabel(lang, sk.skillId)}
                                              </div>
                                              <div className="text-[10px] text-slate-400">
                                                {t('stats.uses', { count: sk.uses })}
                                                {sk.crits > 0 ? ` · ${sk.crits} CRIT` : ''}
                                              </div>
                                            </div>
                                            <div className="text-right font-mono-nums text-xs shrink-0">
                                              {sk.damage > 0 && (
                                                <div className="text-amber-300 font-semibold">
                                                  {sk.damage.toLocaleString()} DMG
                                                </div>
                                              )}
                                              {sk.healing > 0 && (
                                                <div className="text-emerald-300 font-semibold">
                                                  +{sk.healing.toLocaleString()} HP
                                                </div>
                                              )}
                                              {sk.shieldGranted > 0 && (
                                                <div className="text-sky-300">
                                                  +{sk.shieldGranted.toLocaleString()} SHD
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="space-y-5">
              {tooltipInfo && (
                <div className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-mono-nums text-sky-200 flex items-center justify-between gap-2">
                  <span>{tooltipInfo}</span>
                  <button
                    type="button"
                    onClick={() => setTooltipInfo(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* (a) Horizontal Bar Chart of Units with Metric Toggle */}
              <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-slate-100">
                    {t('stats.chartBarTitle')}
                  </h3>
                  <div className="inline-flex rounded border border-slate-700 bg-slate-950 p-0.5">
                    {(
                      [
                        ['damageDealt', t('stats.damageDealt')],
                        ['damageTakenTotal', t('stats.damageTaken')],
                        ['healingDone', t('stats.healingDone')],
                      ] as [BarMetric, string][]
                    ).map(([m, lbl]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBarMetric(m)}
                        className={`min-h-[32px] px-2.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          barMetric === m
                            ? 'bg-sky-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {!hasBarData ? (
                  <div
                    data-testid="stats-chart-bar-empty"
                    className="py-6 text-center text-xs text-slate-500"
                  >
                    {t('stats.noData')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {barUnits.map((u) => {
                      const val = Number.isFinite(u[barMetric]) ? u[barMetric] : 0;
                      const widthPct = Math.max(
                        val > 0 ? 4 : 0,
                        Math.min(100, safeSvgNum((val / barMax) * 100, 0))
                      );
                      const color = getUnitAccentHex(u);
                      return (
                        <button
                          key={`bar-${u.unitId}`}
                          type="button"
                          onClick={() =>
                            setTooltipInfo(
                              `${u.name}: ${val.toLocaleString()} (${getClassName(
                                lang,
                                u.classId
                              )})`
                            )
                          }
                          className="w-full text-left group cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-slate-200 font-medium truncate pr-2">
                              <span style={{ color }} className="mr-1.5">
                                {getClassBadgeSymbol(u.classId)}
                              </span>
                              {u.name}
                            </span>
                            <span className="font-mono-nums text-slate-300 font-semibold shrink-0">
                              {val.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-3 rounded bg-slate-950 border border-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-300 group-hover:brightness-115"
                              style={{ width: `${widthPct}%`, backgroundColor: color }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* (b) Cumulative Damage by Team per Round Line Chart */}
                <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-slate-100">
                      {t('stats.chartCumDmgTitle')}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-sky-300">
                        <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
                        {t('stats.teamAlly')}
                      </span>
                      <span className="inline-flex items-center gap-1 text-red-300">
                        <span className="w-2.5 h-0.5 bg-red-400 inline-block" />
                        {t('stats.teamEnemy')}
                      </span>
                    </div>
                  </div>
                  {!hasCumDmgData ? (
                    <div
                      data-testid="stats-chart-cumdmg-empty"
                      className="h-44 flex items-center justify-center text-xs text-slate-500"
                    >
                      {t('stats.noData')}
                    </div>
                  ) : (
                    <svg viewBox="0 0 360 180" className="w-full h-44 select-none">
                      {[0, 0.5, 1].map((f) => {
                        const y = safeSvgNum(18 + (1 - f) * 130, 18);
                        return (
                          <g key={f}>
                            <line
                              x1="36"
                              y1={y}
                              x2="344"
                              y2={y}
                              stroke="#1E293B"
                              strokeDasharray="3 3"
                            />
                            <text
                              x="30"
                              y={y + 3}
                              textAnchor="end"
                              fill="#64748B"
                              fontSize="9"
                            >
                              {Math.round(maxCumDmg * f)}
                            </text>
                          </g>
                        );
                      })}
                      {(() => {
                        const allyPts = renderLinePoints(
                          dmgSeries.length,
                          (i) => dmgSeries[i].allyCumulativeDamage,
                          maxCumDmg,
                          360,
                          166,
                          36,
                          18
                        );
                        const enemyPts = renderLinePoints(
                          dmgSeries.length,
                          (i) => dmgSeries[i].enemyCumulativeDamage,
                          maxCumDmg,
                          360,
                          166,
                          36,
                          18
                        );
                        return (
                          <>
                            <polyline
                              fill="none"
                              stroke="#38BDF8"
                              strokeWidth="2.4"
                              points={allyPts.map((p) => `${p.x},${p.y}`).join(' ')}
                            />
                            <polyline
                              fill="none"
                              stroke="#EF4444"
                              strokeWidth="2.4"
                              points={enemyPts.map((p) => `${p.x},${p.y}`).join(' ')}
                            />
                            {dmgSeries.map((pt, i) => (
                              <g key={pt.round}>
                                <circle
                                  cx={allyPts[i].x}
                                  cy={allyPts[i].y}
                                  r="4"
                                  fill="#38BDF8"
                                  className="cursor-pointer"
                                  onClick={() =>
                                    setTooltipInfo(
                                      `${t('stats.roundShort', { round: pt.round })} — ${t(
                                        'stats.teamAlly'
                                      )}: ${pt.allyCumulativeDamage.toLocaleString()} | ${t(
                                        'stats.teamEnemy'
                                      )}: ${pt.enemyCumulativeDamage.toLocaleString()}`
                                    )
                                  }
                                />
                                <circle
                                  cx={enemyPts[i].x}
                                  cy={enemyPts[i].y}
                                  r="4"
                                  fill="#EF4444"
                                  className="cursor-pointer"
                                  onClick={() =>
                                    setTooltipInfo(
                                      `${t('stats.roundShort', { round: pt.round })} — ${t(
                                        'stats.teamAlly'
                                      )}: ${pt.allyCumulativeDamage.toLocaleString()} | ${t(
                                        'stats.teamEnemy'
                                      )}: ${pt.enemyCumulativeDamage.toLocaleString()}`
                                    )
                                  }
                                />
                                {(dmgSeries.length <= 10 ||
                                  i === 0 ||
                                  i === dmgSeries.length - 1 ||
                                  i % Math.ceil(dmgSeries.length / 6) === 0) && (
                                  <text
                                    x={allyPts[i].x}
                                    y="174"
                                    textAnchor="middle"
                                    fill="#94A3B8"
                                    fontSize="9"
                                  >
                                    R{pt.round}
                                  </text>
                                )}
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  )}
                </div>

                {/* (c) Team Total HP% per Round Line Chart (Battle Momentum) */}
                <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-slate-100">
                      {t('stats.chartHpPctTitle')}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                        {t('stats.teamAlly')}
                      </span>
                      <span className="inline-flex items-center gap-1 text-orange-300">
                        <span className="w-2.5 h-0.5 bg-orange-400 inline-block" />
                        {t('stats.teamEnemy')}
                      </span>
                    </div>
                  </div>
                  {!hasHpSeriesData ? (
                    <div
                      data-testid="stats-chart-hp-empty"
                      className="h-44 flex items-center justify-center text-xs text-slate-500"
                    >
                      {t('stats.noData')}
                    </div>
                  ) : (
                    <svg viewBox="0 0 360 180" className="w-full h-44 select-none">
                      {[0, 50, 100].map((pct) => {
                        const y = safeSvgNum(18 + (1 - pct / 100) * 130, 18);
                        return (
                          <g key={pct}>
                            <line
                              x1="36"
                              y1={y}
                              x2="344"
                              y2={y}
                              stroke="#1E293B"
                              strokeDasharray="3 3"
                            />
                            <text
                              x="30"
                              y={y + 3}
                              textAnchor="end"
                              fill="#64748B"
                              fontSize="9"
                            >
                              {pct}%
                            </text>
                          </g>
                        );
                      })}
                      {(() => {
                        const allyPts = renderLinePoints(
                          hpSeries.length,
                          (i) => hpSeries[i].allyHpPct,
                          100,
                          360,
                          166,
                          36,
                          18
                        );
                        const enemyPts = renderLinePoints(
                          hpSeries.length,
                          (i) => hpSeries[i].enemyHpPct,
                          100,
                          360,
                          166,
                          36,
                          18
                        );
                        return (
                          <>
                            <polyline
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="2.4"
                              points={allyPts.map((p) => `${p.x},${p.y}`).join(' ')}
                            />
                            <polyline
                              fill="none"
                              stroke="#F97316"
                              strokeWidth="2.4"
                              points={enemyPts.map((p) => `${p.x},${p.y}`).join(' ')}
                            />
                            {hpSeries.map((pt, i) => (
                              <g key={pt.round}>
                                <circle
                                  cx={allyPts[i].x}
                                  cy={allyPts[i].y}
                                  r="4"
                                  fill="#10B981"
                                  className="cursor-pointer"
                                  onClick={() =>
                                    setTooltipInfo(
                                      `${t('stats.roundShort', { round: pt.round })} HP% — ${t(
                                        'stats.teamAlly'
                                      )}: ${pt.allyHpPct}% | ${t('stats.teamEnemy')}: ${
                                        pt.enemyHpPct
                                      }%`
                                    )
                                  }
                                />
                                <circle
                                  cx={enemyPts[i].x}
                                  cy={enemyPts[i].y}
                                  r="4"
                                  fill="#F97316"
                                  className="cursor-pointer"
                                  onClick={() =>
                                    setTooltipInfo(
                                      `${t('stats.roundShort', { round: pt.round })} HP% — ${t(
                                        'stats.teamAlly'
                                      )}: ${pt.allyHpPct}% | ${t('stats.teamEnemy')}: ${
                                        pt.enemyHpPct
                                      }%`
                                    )
                                  }
                                />
                                {(hpSeries.length <= 10 ||
                                  i === 0 ||
                                  i === hpSeries.length - 1 ||
                                  i % Math.ceil(hpSeries.length / 6) === 0) && (
                                  <text
                                    x={allyPts[i].x}
                                    y="174"
                                    textAnchor="middle"
                                    fill="#94A3B8"
                                    fontSize="9"
                                  >
                                    R{pt.round}
                                  </text>
                                )}
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  )}
                </div>
              </div>

              {/* (d) Donut Chart of Damage by Skill for Selectable Unit */}
              <div className="rounded-lg border border-slate-800 bg-[#0D1523] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-slate-100">
                    {t('stats.chartDonutTitle')}
                  </h3>
                  {stats.units.length > 0 && (
                    <select
                      value={effectiveDonutUnit?.unitId ?? ''}
                      onChange={(e) => setDonutUnitId(e.target.value)}
                      aria-label={t('stats.selectUnit')}
                      className="min-h-[38px] rounded border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 cursor-pointer"
                    >
                      {stats.units.map((u) => (
                        <option key={u.unitId} value={u.unitId} className="bg-slate-900">
                          {u.name} ({u.damageDealt.toLocaleString()} DMG)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {donutSlices.length === 0 ? (
                  <div
                    data-testid="stats-chart-donut-empty"
                    className="py-6 text-center text-xs text-slate-500"
                  >
                    {t('stats.noData')}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <svg
                      viewBox="0 0 140 140"
                      className="w-36 h-36 shrink-0 select-none"
                    >
                      {(() => {
                        const r = 48;
                        const circ = 2 * Math.PI * r;
                        return donutSlices.map((sl) => (
                          <circle
                            key={sl.skillId}
                            cx="70"
                            cy="70"
                            r={r}
                            fill="transparent"
                            stroke={sl.color}
                            strokeWidth="22"
                            strokeDasharray={`${safeSvgNum(sl.pct * circ, 0)} ${safeSvgNum(circ, 1)}`}
                            strokeDashoffset={safeSvgNum(-sl.start * circ, 0)}
                            transform="rotate(-90 70 70)"
                            className="cursor-pointer hover:opacity-90"
                            onClick={() =>
                              setTooltipInfo(
                                `${sl.label}: ${sl.damage.toLocaleString()} DMG (${Math.round(
                                  sl.pct * 100
                                )}%)`
                              )
                            }
                          />
                        ));
                      })()}
                      <text
                        x="70"
                        y="67"
                        textAnchor="middle"
                        fill="#F8FAFC"
                        fontSize="13"
                        fontWeight="700"
                      >
                        {(effectiveDonutUnit?.damageDealt ?? 0).toLocaleString()}
                      </text>
                      <text
                        x="70"
                        y="81"
                        textAnchor="middle"
                        fill="#94A3B8"
                        fontSize="9"
                      >
                        TOTAL DMG
                      </text>
                    </svg>

                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {donutSlices.map((sl) => (
                        <button
                          key={`leg-${sl.skillId}`}
                          type="button"
                          onClick={() =>
                            setTooltipInfo(
                              `${sl.label}: ${sl.damage.toLocaleString()} DMG (${Math.round(
                                sl.pct * 100
                              )}%)`
                            )
                          }
                          className="rounded border border-slate-800 bg-[#0A101B] px-3 py-2 flex items-center justify-between gap-2 text-xs hover:border-slate-600 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: sl.color }}
                            />
                            <span className="text-slate-200 font-medium truncate">
                              {sl.label}
                            </span>
                          </div>
                          <span className="font-mono-nums text-slate-300 shrink-0">
                            {sl.damage.toLocaleString()} ({Math.round(sl.pct * 100)}%)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
