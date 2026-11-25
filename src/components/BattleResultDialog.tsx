import { Award, BarChart3, Package, ScrollText } from 'lucide-react';
import { BALANCE_CONFIG } from '../data/balance';
import { STAT_KEYS } from '../data/classes';
import { RARITY_META } from '../data/items';
import { getEffectiveItemStats } from '../engine/equipment';
import { isPirateIncidentId } from '../engine/pirates';
import {
  getClassName,
  getItemInstanceName,
  getRarityLabel,
  getSectorName,
  getSlotLabel,
  getStatShort,
} from '../i18n';
import type { TranslationKey } from '../i18n/en';
import type { BattleSummary, Language } from '../types/game';

export interface BattleResultDialogProps {
  summary: BattleSummary;
  squadSize: number;
  lang: Language;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onOpenReport: () => void;
  onOpenLog: () => void;
  onReturnHangar: () => void;
  onNextSortie: () => void;
}

export function BattleResultDialog({
  summary,
  squadSize,
  lang,
  t,
  onOpenReport,
  onOpenLog,
  onReturnHangar,
  onNextSortie,
}: BattleResultDialogProps) {
  const outcomeTitle =
    summary.outcome === 'victory'
      ? t('summary.victory')
      : summary.retreated
      ? t('summary.retreatTitle')
      : t('summary.defeat');

  const outcomeDesc =
    summary.outcome === 'victory'
      ? t('summary.victoryDesc')
      : t('summary.defeatDesc');

  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-x-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-outcome-title"
    >
      <div
        data-testid="battle-result-dialog"
        className="w-full sm:w-[min(720px,92vw)] max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-lg border border-slate-700 bg-[#0E1521] shadow-2xl overflow-hidden"
      >
        <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
          <div
            data-testid="battle-result-columns"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 items-start"
          >
            {/* LEFT column (desktop) / Top section (phone): rounds, title, description, banners */}
            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <div
                  className={`text-[12px] font-semibold tracking-widest uppercase ${
                    summary.outcome === 'victory'
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {t('summary.rounds', {
                    sector: getSectorName(lang, summary.sectorId),
                    rounds: summary.rounds,
                  })}
                </div>
                <h2
                  id="battle-outcome-title"
                  className="font-display text-[20px] sm:text-[22px] font-bold tracking-wide text-slate-50"
                >
                  {outcomeTitle}
                </h2>
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  {outcomeDesc}
                </p>
                <p
                  data-testid="battle-result-kind"
                  className="text-[12px] text-slate-300"
                >
                  {t('summary.battleKindLine', {
                    kind: t(
                      (summary.kind === 'event' &&
                      isPirateIncidentId(summary.sourceId)
                        ? 'battle.kind.pirates'
                        : `battle.kind.${summary.kind ?? 'assault'}`) as TranslationKey
                    ),
                  })}
                </p>
              </div>

              {summary.leveledUp && (
                <div
                  data-testid="battle-result-levelup-banner"
                  className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold text-emerald-300">
                      {t('summary.levelUp', {
                        gear: getClassName(lang, summary.deployedGearId),
                        prev: summary.previousLevel,
                        next: summary.newLevel,
                      })}
                    </div>
                    <div className="text-[12px] text-emerald-200/80">
                      {t('summary.levelUpDesc')}
                    </div>
                  </div>
                  <div className="font-mono-nums text-[15px] font-bold text-emerald-300 whitespace-nowrap shrink-0">
                    +{summary.statPointsGained} PTS
                  </div>
                </div>
              )}

              {summary.unlockedSectorId && (
                <div
                  data-testid="battle-result-sector-banner"
                  className="rounded border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-[13px] font-semibold text-amber-300"
                >
                  {t('summary.sectorUnlocked', {
                    sector: getSectorName(lang, summary.unlockedSectorId),
                  })}
                </div>
              )}
            </div>

            {/* RIGHT column (desktop) / Middle-lower sections (phone): rewards, combat tally, drops */}
            <div className="min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded border border-slate-800 bg-[#090D14] p-2.5 sm:p-3">
                  <div className="text-[12px] text-slate-400">
                    {t('summary.expEarned', {
                      gear: getClassName(lang, summary.deployedGearId),
                    })}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[18px] sm:text-[20px] font-bold text-amber-400">
                    +{summary.expGained} EXP
                  </div>
                  <div className="text-[12px] font-mono-nums text-slate-400 mt-0.5">
                    {summary.newLevel >= BALANCE_CONFIG.maxLevel
                      ? t('summary.maxLevelReached')
                      : t('summary.battlesToNext', {
                          count: summary.battlesToNextLevel,
                          next: summary.newLevel + 1,
                        })}
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-[#090D14] p-2.5 sm:p-3">
                  <div className="text-[12px] text-slate-400">
                    {t('summary.creditsAwarded')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[18px] sm:text-[20px] font-bold text-slate-100">
                    +{summary.creditsGained.toLocaleString()} CR
                  </div>
                </div>

                <div className="col-span-2 rounded border border-purple-500/40 bg-purple-500/10 p-2.5 sm:p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] text-purple-200 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>{t('summary.warPointsAwarded')}</span>
                    </div>
                    {summary.baseCaptureBonusWp > 0 && (
                      <div className="text-[12px] text-purple-300/90 mt-0.5">
                        {t('summary.captureBonusNote', {
                          wp: summary.baseCaptureBonusWp,
                        })}
                      </div>
                    )}
                  </div>
                  <div className="font-mono-nums text-[18px] sm:text-[20px] font-bold text-purple-300 whitespace-nowrap shrink-0">
                    +{summary.warPointsGained} WP
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-[#090D14] p-2.5 sm:p-3">
                  <div className="text-[12px] text-slate-400">
                    {t('summary.hostilesDestroyed')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[15px] font-semibold text-slate-200">
                    {summary.enemiesDestroyed} / {summary.totalEnemies}
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-[#090D14] p-2.5 sm:p-3">
                  <div className="text-[12px] text-slate-400">
                    {t('summary.alliesSurviving')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[15px] font-semibold text-slate-200">
                    {summary.alliesSurviving} / {squadSize}
                  </div>
                </div>
              </div>

              {/* Salvaged Drops (up to 3 rows visible cleanly; inner scroll beyond 3) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                    <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{t('summary.dropsTitle')}</span>
                  </span>
                  <span className="font-mono-nums">
                    {t('common.itemCount', {
                      count: summary.droppedItems.length,
                    })}
                  </span>
                </div>

                {summary.droppedItems.length === 0 ? (
                  <div
                    data-testid="battle-result-empty-drops"
                    className="rounded border border-slate-800/80 bg-[#090D14] px-3 py-2.5 text-[13px] text-slate-500"
                  >
                    {t('summary.noDrops')}
                  </div>
                ) : (
                  <div
                    data-testid="battle-result-drops-list"
                    className="space-y-1.5 max-h-[176px] overflow-y-auto tactical-scroll"
                  >
                    {summary.droppedItems.map((inst) => {
                      const stats = getEffectiveItemStats(inst);
                      const itemName = getItemInstanceName(lang, inst);
                      return (
                        <div
                          key={inst.instanceId}
                          className={`rounded border bg-[#090D14] px-3 py-2 flex items-center justify-between gap-2 ${
                            RARITY_META[inst.rarity].borderClass
                          }`}
                        >
                          <div className="min-w-0">
                            <div
                              title={itemName}
                              className={`text-[13px] font-semibold truncate ${
                                RARITY_META[inst.rarity].textClass
                              }`}
                            >
                              {itemName}
                            </div>
                            <div className="text-[12px] text-slate-400">
                              {getSlotLabel(lang, inst.slot)} ·{' '}
                              {getRarityLabel(lang, inst.rarity)} · T{inst.tier}{' '}
                              · {inst.rollQuality}%
                            </div>
                          </div>
                          <div className="text-right font-mono-nums text-[12px] text-emerald-400 shrink-0">
                            {STAT_KEYS.filter((k) => stats[k] > 0)
                              .map(
                                (k) => `+${stats[k]} ${getStatShort(lang, k)}`
                              )
                              .join(' ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky 2x2 button bar on phone; single 4-button row on desktop/tablet */}
        <div className="shrink-0 sticky bottom-0 border-t border-slate-800 bg-[#0E1521] pb-safe">
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <div
              data-testid="battle-result-actions"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              <button
                type="button"
                data-testid="battle-open-report-btn"
                onClick={onOpenReport}
                className="min-h-[44px] px-2.5 sm:px-3 rounded-lg border border-sky-500/50 bg-sky-500/12 hover:bg-sky-500/22 text-sky-200 font-semibold text-[12px] sm:text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{t('stats.reportBtn')}</span>
              </button>
              <button
                type="button"
                data-testid="battle-outcome-log-btn"
                onClick={onOpenLog}
                className="min-h-[44px] px-2.5 sm:px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-[12px] sm:text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ScrollText className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{t('stats.openCombatLog')}</span>
              </button>
              <button
                type="button"
                data-testid="battle-result-hangar-btn"
                onClick={onReturnHangar}
                className="min-h-[44px] px-2.5 sm:px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[12px] sm:text-[13px] inline-flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
              >
                {t('nav.returnHangar')}
              </button>
              <button
                type="button"
                data-testid="battle-result-next-btn"
                onClick={onNextSortie}
                className="min-h-[44px] px-2.5 sm:px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-[12px] sm:text-[13px] inline-flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
              >
                {t('summary.nextSortie')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
