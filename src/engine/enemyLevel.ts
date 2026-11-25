import { BALANCE_CONFIG } from '../data/balance';
import type {
  BattleKind,
  EnemyLevelConfig,
  EnemyLevelRange,
  EnemyLevelRangeKind,
} from '../types/game';

export const ENEMY_LEVEL_RANGE_KINDS: readonly EnemyLevelRangeKind[] = [
  'patrol',
  'pirate',
  'assault',
  'defend',
  'boss',
];

export const MIN_ENEMY_LEVEL_OFFSET = -20;
export const MAX_ENEMY_LEVEL_OFFSET = 50;
export const MIN_ENEMY_LEVEL_PEAK_CHANCE_PCT = 0;
export const MAX_ENEMY_LEVEL_PEAK_CHANCE_PCT = 100;
export const MIN_ENEMY_LEVEL_CAP_OVER_MAX = -20;
export const MAX_ENEMY_LEVEL_CAP_OVER_MAX = 50;

export const DEFAULT_ENEMY_LEVEL_CONFIG: EnemyLevelConfig = {
  ranges: {
    patrol: { min: -5, max: 3, peak: 5 },
    pirate: { min: -3, max: 6, peak: 10 },
    assault: { min: 1, max: 10, peak: 15 },
    defend: { min: -3, max: 8, peak: 12 },
    boss: { min: 5, max: 10, peak: 12 },
  },
  peakChancePct: 10,
  enemyLevelCapOverMax: 10,
};

function clampInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function sanitizeRange(
  raw: unknown,
  fallback: EnemyLevelRange
): EnemyLevelRange {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Partial<EnemyLevelRange>)
      : null;
  const min = clampInt(
    obj?.min,
    MIN_ENEMY_LEVEL_OFFSET,
    MAX_ENEMY_LEVEL_OFFSET,
    fallback.min
  );
  const max = Math.max(
    min,
    clampInt(
      obj?.max,
      MIN_ENEMY_LEVEL_OFFSET,
      MAX_ENEMY_LEVEL_OFFSET,
      fallback.max
    )
  );
  const peak = clampInt(
    obj?.peak,
    MIN_ENEMY_LEVEL_OFFSET,
    MAX_ENEMY_LEVEL_OFFSET,
    fallback.peak
  );
  return { min, max, peak };
}

export function cloneEnemyLevelConfig(
  cfg: EnemyLevelConfig
): EnemyLevelConfig {
  return {
    ranges: {
      patrol: { ...cfg.ranges.patrol },
      pirate: { ...cfg.ranges.pirate },
      assault: { ...cfg.ranges.assault },
      defend: { ...cfg.ranges.defend },
      boss: { ...cfg.ranges.boss },
    },
    peakChancePct: cfg.peakChancePct,
    enemyLevelCapOverMax: cfg.enemyLevelCapOverMax,
  };
}

export function sanitizeEnemyLevelConfig(raw?: unknown): EnemyLevelConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Partial<EnemyLevelConfig>)
      : null;
  const rawRanges =
    obj?.ranges && typeof obj.ranges === 'object' && !Array.isArray(obj.ranges)
      ? (obj.ranges as Partial<Record<EnemyLevelRangeKind, unknown>>)
      : null;

  return {
    ranges: {
      patrol: sanitizeRange(
        rawRanges?.patrol,
        DEFAULT_ENEMY_LEVEL_CONFIG.ranges.patrol
      ),
      pirate: sanitizeRange(
        rawRanges?.pirate,
        DEFAULT_ENEMY_LEVEL_CONFIG.ranges.pirate
      ),
      assault: sanitizeRange(
        rawRanges?.assault,
        DEFAULT_ENEMY_LEVEL_CONFIG.ranges.assault
      ),
      defend: sanitizeRange(
        rawRanges?.defend,
        DEFAULT_ENEMY_LEVEL_CONFIG.ranges.defend
      ),
      boss: sanitizeRange(
        rawRanges?.boss,
        DEFAULT_ENEMY_LEVEL_CONFIG.ranges.boss
      ),
    },
    peakChancePct: clampInt(
      obj?.peakChancePct,
      MIN_ENEMY_LEVEL_PEAK_CHANCE_PCT,
      MAX_ENEMY_LEVEL_PEAK_CHANCE_PCT,
      DEFAULT_ENEMY_LEVEL_CONFIG.peakChancePct
    ),
    enemyLevelCapOverMax: clampInt(
      obj?.enemyLevelCapOverMax,
      MIN_ENEMY_LEVEL_CAP_OVER_MAX,
      MAX_ENEMY_LEVEL_CAP_OVER_MAX,
      DEFAULT_ENEMY_LEVEL_CONFIG.enemyLevelCapOverMax
    ),
  };
}

export function resolveEnemyLevelRangeKind(
  kind: EnemyLevelRangeKind | BattleKind
): EnemyLevelRangeKind {
  if (
    kind === 'patrol' ||
    kind === 'pirate' ||
    kind === 'assault' ||
    kind === 'defend' ||
    kind === 'boss'
  ) {
    return kind;
  }
  // mission / event use the assault range
  return 'assault';
}

export function rollEnemyLevelOffset(
  kind: EnemyLevelRangeKind | BattleKind,
  cfg?: Partial<EnemyLevelConfig> | null,
  rng: () => number = Math.random
): number {
  const safeCfg = sanitizeEnemyLevelConfig(cfg);
  const rangeKey = resolveEnemyLevelRangeKind(kind);
  const range = safeCfg.ranges[rangeKey];

  if (safeCfg.peakChancePct >= 100) {
    return range.peak;
  }
  if (safeCfg.peakChancePct > 0 && rng() * 100 < safeCfg.peakChancePct) {
    return range.peak;
  }

  const span = Math.max(1, range.max - range.min + 1);
  const roll = Math.min(0.9999999999, Math.max(0, rng()));
  return range.min + Math.floor(roll * span);
}

export function clampEnemyLevel(
  rawLevel: number,
  cfg?: Partial<EnemyLevelConfig> | null
): number {
  const safeCfg = sanitizeEnemyLevelConfig(cfg);
  const maxEnemyLevel = Math.max(
    1,
    BALANCE_CONFIG.maxLevel + safeCfg.enemyLevelCapOverMax
  );
  return Math.max(1, Math.min(maxEnemyLevel, Math.round(rawLevel)));
}
