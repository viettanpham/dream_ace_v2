import { BarChart3, Package, Repeat, X } from 'lucide-react';
import { RARITY_META } from '../data/items';
import {
  getAutoStopReasonLabel,
  getClassName,
  getItemInstanceName,
  getSectorName,
  getSlotLabel,
} from '../i18n';
import type { TranslationKey } from '../i18n/en';
import type {
  AutoRepeatLimit,
  AutoRepeatRunToast,
  AutoRepeatSession,
  Language,
  MechClassId,
} from '../types/game';
import { ErrorBoundary } from './ErrorBoundary';

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

export interface AutoRepeatToastProps {
  toast: AutoRepeatRunToast;
  lang?: Language;
  t: TranslateFn;
  onClearToast: () => void;
}

export function AutoRepeatToast({
  toast,
  t,
  onClearToast,
}: AutoRepeatToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="battle-loop-toast"
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[min(94vw,480px)] rounded-lg border px-3 py-2 shadow-2xl flex items-center justify-between gap-2 text-[12px] font-medium backdrop-blur-sm ${
        toast.outcome === 'victory'
          ? 'border-emerald-400/70 bg-[#0B1814]/95 text-emerald-100'
          : 'border-amber-400/70 bg-[#1B130B]/95 text-amber-100'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Repeat
          className={`w-4 h-4 shrink-0 ${
            toast.outcome === 'victory' ? 'text-emerald-400' : 'text-amber-400'
          }`}
          aria-hidden="true"
        />
        <span className="truncate">
          {t('battle.loopToastRun', {
            run: toast.runNumber,
            outcome: t(
              toast.outcome === 'victory'
                ? 'battle.loopToastVictory'
                : 'battle.loopToastDefeat'
            ),
            exp: toast.expGained.toLocaleString(),
            credits: toast.creditsGained.toLocaleString(),
            wp: toast.warPointsGained.toLocaleString(),
            loot: toast.lootCount,
          })}
        </span>
      </div>
      <button
        type="button"
        data-testid="battle-loop-toast-close"
        onClick={onClearToast}
        aria-label={t('common.close')}
        className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded hover:bg-white/10 text-slate-300 cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export interface AutoRepeatBatchSummaryModalProps {
  session: AutoRepeatSession;
  deployedGearId: MechClassId;
  autoRepeatDefeatStreakLimit: number;
  autoRepeatLimit: AutoRepeatLimit;
  sectorId: string;
  lang: Language;
  t: TranslateFn;
  onOpenReport: () => void;
  onReturnHangar: () => void;
  onClearSummary: () => void;
  onStartAutoRepeat: (limit: AutoRepeatLimit, sectorId: string) => void;
}

export function AutoRepeatBatchSummaryModal({
  session,
  deployedGearId,
  autoRepeatDefeatStreakLimit,
  autoRepeatLimit,
  sectorId,
  lang,
  t,
  onOpenReport,
  onReturnHangar,
  onClearSummary,
  onStartAutoRepeat,
}: AutoRepeatBatchSummaryModalProps) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repeat-summary-title"
    >
      <div className="w-full max-w-md rounded-lg border border-emerald-500/50 bg-[#0E1521] p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto tactical-scroll">
        <div className="space-y-1">
          <div className="text-[12px] font-semibold tracking-widest uppercase text-emerald-400 flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" />
            <span>{getSectorName(lang, session.sectorId)}</span>
          </div>
          <h2
            id="repeat-summary-title"
            className="font-display text-[20px] font-bold tracking-wide text-slate-50"
          >
            {t('auto.repeatSummaryTitle')}
          </h2>
          {session.stopReason && (
            <p
              data-testid="battle-loop-stop-reason"
              className="text-[13px] text-orange-300 font-medium"
            >
              {getAutoStopReasonLabel(
                lang,
                session.stopReason,
                session.defeatStreakLimit ?? autoRepeatDefeatStreakLimit
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-slate-800 bg-[#090D14] p-3">
            <div className="text-[12px] text-slate-400">
              {t('auto.repeatLabel')}
            </div>
            <div className="mt-0.5 font-mono-nums text-[20px] font-bold text-emerald-400">
              {t('auto.repeatSummaryRuns', {
                wins: session.wins,
                runs: session.completedRuns,
              })}
            </div>
          </div>

          <div className="rounded border border-slate-800 bg-[#090D14] p-3">
            <div className="text-[12px] text-slate-400">
              {t('summary.expEarned', {
                gear: getClassName(lang, deployedGearId),
              })}
            </div>
            <div className="mt-0.5 font-mono-nums text-[20px] font-bold text-amber-400">
              +{session.totalExp.toLocaleString()} EXP
            </div>
          </div>

          <div className="rounded border border-slate-800 bg-[#090D14] p-3">
            <div className="text-[12px] text-slate-400">
              {t('summary.creditsAwarded')}
            </div>
            <div className="mt-0.5 font-mono-nums text-[15px] font-bold text-slate-100">
              +{session.totalCredits.toLocaleString()} CR
            </div>
          </div>

          <div className="rounded border border-purple-500/40 bg-purple-500/10 p-3">
            <div className="text-[12px] text-purple-200">
              {t('summary.warPointsAwarded')}
            </div>
            <div className="mt-0.5 font-mono-nums text-[15px] font-bold text-purple-300">
              +{session.totalWarPoints.toLocaleString()} WP
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('summary.dropsTitle')}</span>
            </span>
            <span className="font-mono-nums">
              {t('common.itemCount', {
                count: session.totalDrops.length,
              })}
            </span>
          </div>
          {session.totalDrops.length === 0 ? (
            <div className="rounded border border-slate-800/80 bg-[#090D14] px-3 py-2 text-[13px] text-slate-500">
              {t('summary.noDrops')}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto tactical-scroll">
              {session.totalDrops.map((inst) => (
                <div
                  key={inst.instanceId}
                  className={`rounded border bg-[#090D14] px-3 py-1.5 flex items-center justify-between gap-2 ${
                    RARITY_META[inst.rarity].borderClass
                  }`}
                >
                  <span
                    className={`text-[13px] font-semibold truncate ${
                      RARITY_META[inst.rarity].textClass
                    }`}
                  >
                    {getItemInstanceName(lang, inst)}
                  </span>
                  <span className="text-[12px] font-mono-nums text-slate-400 shrink-0">
                    {getSlotLabel(lang, inst.slot)} · T{inst.tier}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onOpenReport}
            className="w-full min-h-[44px] px-4 rounded-lg border border-sky-500/50 bg-sky-500/12 hover:bg-sky-500/22 text-sky-200 font-semibold text-[13px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <span>{t('stats.reportBtn')}</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReturnHangar}
              className="flex-1 min-h-[44px] px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[13px] transition-colors cursor-pointer"
            >
              {t('nav.returnHangar')}
            </button>
            <button
              type="button"
              onClick={() => {
                onClearSummary();
                onStartAutoRepeat(autoRepeatLimit, sectorId);
              }}
              className="flex-1 min-h-[44px] px-4 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-[13px] transition-colors cursor-pointer"
            >
              {t('auto.repeatStart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface AutoRepeatDialogsProps {
  toast: AutoRepeatRunToast | null;
  showRepeatBatchSummary: boolean;
  session: AutoRepeatSession | null;
  deployedGearId: MechClassId;
  autoRepeatDefeatStreakLimit: number;
  autoRepeatLimit: AutoRepeatLimit;
  sectorId: string;
  lang: Language;
  t: TranslateFn;
  onClearToast: () => void;
  onClearSummary: () => void;
  onReloadBattle: () => void;
  onOpenReport: () => void;
  onReturnHangar: () => void;
  onStartAutoRepeat: (limit: AutoRepeatLimit, sectorId: string) => void;
}

export function AutoRepeatDialogs({
  toast,
  showRepeatBatchSummary,
  session,
  deployedGearId,
  autoRepeatDefeatStreakLimit,
  autoRepeatLimit,
  sectorId,
  lang,
  t,
  onClearToast,
  onClearSummary,
  onReloadBattle,
  onOpenReport,
  onReturnHangar,
  onStartAutoRepeat,
}: AutoRepeatDialogsProps) {
  return (
    <>
      {toast && !showRepeatBatchSummary && (
        <AutoRepeatToast toast={toast} lang={lang} t={t} onClearToast={onClearToast} />
      )}

      <ErrorBoundary
        variant="panel"
        title={t('auto.repeatSummaryTitle')}
        resetKey={showRepeatBatchSummary}
        onClose={onClearSummary}
        onReloadBattle={onReloadBattle}
      >
        {showRepeatBatchSummary && session && (
          <AutoRepeatBatchSummaryModal
            session={session}
            deployedGearId={deployedGearId}
            autoRepeatDefeatStreakLimit={autoRepeatDefeatStreakLimit}
            autoRepeatLimit={autoRepeatLimit}
            sectorId={sectorId}
            lang={lang}
            t={t}
            onOpenReport={onOpenReport}
            onReturnHangar={onReturnHangar}
            onClearSummary={onClearSummary}
            onStartAutoRepeat={onStartAutoRepeat}
          />
        )}
      </ErrorBoundary>
    </>
  );
}
