import { useI18n } from '../i18n';
import type { CombatSide } from '../types/game';
import { levelConClass } from '../utils/levelCon';

export interface LevelBadgeProps {
  level: number;
  refLevel: number;
  side: CombatSide;
  isLeader?: boolean;
  textSizeClass?: string;
  className?: string;
}

export function LevelBadge({
  level,
  refLevel,
  side,
  isLeader = false,
  textSizeClass = 'text-[10px]',
  className = '',
}: LevelBadgeProps) {
  const { t } = useI18n();
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.round(level))
    : 1;
  const frameClass = isLeader
    ? 'border-emerald-500/70 bg-emerald-500/10'
    : side === 'ally'
      ? 'border-sky-500/70 bg-sky-500/10'
      : 'border-rose-500/70 bg-rose-500/10';
  const colorClass =
    side === 'enemy'
      ? levelConClass(safeLevel - refLevel)
      : isLeader
        ? 'text-emerald-200'
        : 'text-slate-300';
  const label = t('battle.levelBadge', { level: safeLevel });

  return (
    <span
      data-testid="level-badge"
      data-side={side}
      data-level={safeLevel}
      title={label}
      aria-label={label}
      className={`font-mono font-mono-nums ${textSizeClass} leading-tight font-semibold border rounded px-1 shrink-0 whitespace-nowrap ${frameClass} ${colorClass} ${className}`.trim()}
    >
      [{safeLevel}]
    </span>
  );
}
