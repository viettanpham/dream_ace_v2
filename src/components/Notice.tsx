import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n';

export type NoticeTone = 'info' | 'success' | 'warning';

export interface NoticeAction {
  label: string;
  onClick: () => void;
  testId?: string;
}

export interface NoticeProps {
  tone: NoticeTone;
  text: string;
  action?: NoticeAction;
  durationSec: number;
  onClose: () => void;
  testId?: string;
}

export interface UseNoticeCountdownOptions {
  durationSec: number;
  onExpire: () => void;
  resetKey?: string | number;
}

export interface UseNoticeCountdownResult {
  remainingMs: number;
  remainingSec: number;
  progressPct: number;
  paused: boolean;
  hasAutoClose: boolean;
  pause: () => void;
  resume: () => void;
}

const TICK_STEP_MS = 100;

export function useNoticeCountdown({
  durationSec,
  onExpire,
  resetKey,
}: UseNoticeCountdownOptions): UseNoticeCountdownResult {
  const safeDurationSec =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : 0;
  const totalMs = Math.round(safeDurationSec * 1000);
  const hasAutoClose = totalMs > 0;

  const [remainingMs, setRemainingMs] = useState(totalMs);
  const [paused, setPaused] = useState(false);

  const remainingMsRef = useRef(totalMs);
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);
  const pausedRef = useRef(false);

  onExpireRef.current = onExpire;

  useEffect(() => {
    remainingMsRef.current = totalMs;
    expiredRef.current = false;
    pausedRef.current = false;
    setRemainingMs(totalMs);
    setPaused(false);
  }, [totalMs, resetKey]);

  useEffect(() => {
    if (!hasAutoClose || paused || remainingMsRef.current <= 0) {
      return;
    }

    const timer = setInterval(() => {
      if (pausedRef.current) return;
      const next = Math.max(0, remainingMsRef.current - TICK_STEP_MS);
      remainingMsRef.current = next;
      setRemainingMs(next);

      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(timer);
        onExpireRef.current();
      }
    }, TICK_STEP_MS);

    return () => clearInterval(timer);
  }, [hasAutoClose, paused, totalMs, resetKey]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const remainingSec = hasAutoClose ? Math.ceil(remainingMs / 1000) : 0;
  const progressPct =
    hasAutoClose && totalMs > 0
      ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
      : 0;

  return {
    remainingMs,
    remainingSec,
    progressPct,
    paused,
    hasAutoClose,
    pause,
    resume,
  };
}

const TONE_STYLES: Record<
  NoticeTone,
  {
    container: string;
    actionBtn: string;
    closeBtn: string;
    progressBar: string;
  }
> = {
  warning: {
    container: 'border-amber-400/60 bg-amber-500/15 text-amber-100',
    actionBtn: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
    closeBtn: 'text-amber-300 hover:text-white',
    progressBar: 'bg-amber-400',
  },
  info: {
    container: 'border-sky-400/60 bg-sky-500/15 text-sky-100',
    actionBtn: 'bg-sky-400 hover:bg-sky-300 text-slate-950',
    closeBtn: 'text-sky-300 hover:text-white',
    progressBar: 'bg-sky-400',
  },
  success: {
    container: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    actionBtn: 'bg-emerald-400 hover:bg-emerald-300 text-slate-950',
    closeBtn: 'text-emerald-300 hover:text-white',
    progressBar: 'bg-emerald-400',
  },
};

export function Notice({
  tone,
  text,
  action,
  durationSec,
  onClose,
  testId,
}: NoticeProps) {
  const { t } = useI18n();
  const styles = TONE_STYLES[tone];

  const pauseReasonsRef = useRef({
    hover: false,
    focus: false,
    touch: false,
  });

  const { remainingSec, progressPct, hasAutoClose, pause, resume } =
    useNoticeCountdown({
      durationSec,
      onExpire: onClose,
      resetKey: `${tone}::${text}::${action?.label ?? ''}`,
    });

  const syncPauseState = () => {
    const { hover, focus, touch } = pauseReasonsRef.current;
    if (hover || focus || touch) {
      pause();
    } else {
      resume();
    }
  };

  return (
    <div
      data-testid={testId}
      aria-live="off"
      onMouseEnter={() => {
        pauseReasonsRef.current.hover = true;
        syncPauseState();
      }}
      onMouseLeave={() => {
        pauseReasonsRef.current.hover = false;
        syncPauseState();
      }}
      onFocus={() => {
        pauseReasonsRef.current.focus = true;
        syncPauseState();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          pauseReasonsRef.current.focus = false;
          syncPauseState();
        }
      }}
      onTouchStart={() => {
        pauseReasonsRef.current.touch = true;
        syncPauseState();
      }}
      onTouchEnd={() => {
        pauseReasonsRef.current.touch = false;
        syncPauseState();
      }}
      onTouchCancel={() => {
        pauseReasonsRef.current.touch = false;
        syncPauseState();
      }}
      className={`relative h-[44px] w-full overflow-hidden rounded-lg border px-2.5 flex items-center justify-between gap-2 text-xs select-none ${styles.container}`}
    >
      <span title={text} className="min-w-0 flex-1 truncate font-medium leading-tight">
        {text}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        {action && (
          <button
            type="button"
            data-testid={action.testId}
            onClick={action.onClick}
            className={`min-h-[30px] h-[30px] px-2.5 rounded font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${styles.actionBtn}`}
          >
            {action.label}
          </button>
        )}

        {hasAutoClose && (
          <span
            data-testid="notice-countdown"
            aria-live="off"
            aria-hidden="true"
            className="font-mono-nums text-[11px] font-semibold tabular-nums shrink-0"
          >
            {remainingSec}s
          </span>
        )}

        <button
          type="button"
          data-testid="notice-close-btn"
          onClick={onClose}
          aria-label={t('error.closeBtn')}
          className={`h-[42px] min-w-[34px] -mr-1 flex items-center justify-center rounded transition-colors cursor-pointer shrink-0 ${styles.closeBtn}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {hasAutoClose && (
        <div
          data-testid="notice-progress-track"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-slate-950/35"
        >
          <div
            data-testid="notice-progress-bar"
            className={`h-full transition-[width] duration-100 ease-linear ${styles.progressBar}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
