import { useI18n } from '../i18n';
import type { CombatSide } from '../types/game';
import { levelConClass } from '../utils/levelCon';

export interface LevelBadgeProps {
  level: number;
  refLevel: number;
  side: CombatSide;
  className?: string;
}

export function LevelBadge({
  level,
  refLevel,
  side,
  className = '',
}: LevelBadgeProps) {
  const { t } = useI18n();
  const safeLevel = Math.max(1, Math.round(level));
  const colorClass =
    side === 'enemy' ? levelConClass(safeLevel - refLevel) : 'text-slate-300';
  const label = t('battle.levelBadge', { level: safeLevel });

  return (
    <span
      data-testid="level-badge"
      data-side={side}
      data-level={safeLevel}
      title={label}
      aria-label={label}
      className={`font-mono font-mono-nums text-[10px] leading-tight font-semibold border border-slate-700/80 bg-slate-900/85 rounded px-1 shrink-0 whitespace-nowrap ${colorClass} ${className}`.trim()}
    >
      [{safeLevel}]
    </span>
  );
}
