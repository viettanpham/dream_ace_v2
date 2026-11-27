import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

export interface TurnStepLineProps {
  supplyUsed: boolean;
  step2Used: number;
  step2Max: number;
  compact?: boolean;
}

const COLLAPSE_WIDTH_PX = 340;

export function TurnStepLine({
  supplyUsed,
  step2Used,
  step2Max,
  compact = false,
}: TurnStepLineProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.getBoundingClientRect().width || el.clientWidth;
      if (width > 0) {
        setCollapsed(width < COLLAPSE_WIDTH_PX);
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        measure();
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  if (step2Max <= 0) return null;

  const used = Math.max(0, Math.floor(step2Used || 0));
  const max = Math.max(0, Math.floor(step2Max || 0));
  const isStep2Full = used >= max;
  const step2FullText = t('battle.turnStep.step2Full');

  return (
    <div
      ref={containerRef}
      data-testid="turn-step-line"
      data-collapsed={collapsed ? 'true' : 'false'}
      className="@container w-full min-w-0 h-5 flex items-center text-[11px] leading-none whitespace-nowrap overflow-hidden px-1 select-none"
    >
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        {!collapsed && (
          <span className="hidden @[340px]:inline text-slate-400 font-medium shrink-0">
            {t('battle.turnStep.prefix')}
          </span>
        )}
        <span
          data-testid="turn-step-1"
          data-active={supplyUsed ? 'true' : 'false'}
          className={`shrink-0 ${
            supplyUsed ? 'text-emerald-300 font-semibold' : 'text-slate-400'
          }`}
        >
          ①
          {!collapsed && (
            <span className="hidden @[340px]:inline">
              {' '}
              {t('battle.turnStep.supply')}
            </span>
          )}
        </span>
        <span
          data-testid="turn-step-2"
          data-full={isStep2Full ? 'true' : 'false'}
          title={isStep2Full ? step2FullText : undefined}
          aria-label={isStep2Full ? step2FullText : undefined}
          className={`font-mono-nums shrink-0 ${
            isStep2Full ? 'text-amber-300 font-semibold' : 'text-slate-200'
          }`}
        >
          ②
          {!collapsed && (
            <span className="hidden @[340px]:inline font-sans">
              {' '}
              {t('battle.turnStep.buff')}
            </span>
          )}{' '}
          {used}/{max}
        </span>
        <span data-testid="turn-step-3" className="text-slate-200 shrink-0">
          ③
          {!collapsed && (
            <span className="hidden @[340px]:inline">
              {' '}
              {compact
                ? t('battle.turnStep.attackShort')
                : t('battle.turnStep.action')}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
