import type { WorldClockSpeedMode, WorldClockState } from '../types/game';
import {
  createDefaultWorldClock,
  MAX_WORLD_CLOCK_SECONDS_PER_DAY,
  MIN_WORLD_CLOCK_SECONDS_PER_DAY,
  sanitizeWorldClock,
  WORLD_CLOCK_SPEED_PRESETS,
} from './migration';

// Every later deadline, term, and cooldown is stored in world days.

export const DEFAULT_MAX_CATCH_UP_DAYS = 30;

export {
  createDefaultWorldClock,
  MAX_WORLD_CLOCK_SECONDS_PER_DAY,
  MIN_WORLD_CLOCK_SECONDS_PER_DAY,
  WORLD_CLOCK_SPEED_PRESETS,
};

function normalizeNowMs(nowMs: number): number {
  return typeof nowMs === 'number' && Number.isFinite(nowMs) && nowMs >= 0
    ? nowMs
    : Date.now();
}

/**
 * Pure world-clock settle helper:
 * - If `lastTickAt === null`, only sets `lastTickAt = nowMs` without advancing `worldDay`.
 * - If `paused`, advances `lastTickAt` to `nowMs` without adding days so paused time never leaks later.
 * - Otherwise adds `(nowMs - lastTickAt) / 1000 / secondsPerDay` days, capped at `maxCatchUpDays`.
 */
export function settleWorldClock(
  clock: WorldClockState,
  nowMs: number,
  maxCatchUpDays: number = DEFAULT_MAX_CATCH_UP_DAYS
): WorldClockState {
  const safeClock = sanitizeWorldClock(clock);
  const safeNowMs = normalizeNowMs(nowMs);

  if (safeClock.lastTickAt === null) {
    return {
      ...safeClock,
      lastTickAt: safeNowMs,
    };
  }

  const nextLastTickAt = Math.max(safeClock.lastTickAt, safeNowMs);

  if (safeClock.paused) {
    return {
      ...safeClock,
      lastTickAt: nextLastTickAt,
    };
  }

  const elapsedMs = Math.max(0, safeNowMs - safeClock.lastTickAt);
  const rawDeltaDays = elapsedMs / 1000 / safeClock.secondsPerDay;
  const safeCap =
    typeof maxCatchUpDays === 'number' && Number.isFinite(maxCatchUpDays)
      ? Math.max(0, maxCatchUpDays)
      : DEFAULT_MAX_CATCH_UP_DAYS;
  const addedDays = Math.min(rawDeltaDays, safeCap);

  return {
    ...safeClock,
    worldDay: safeClock.worldDay + addedDays,
    lastTickAt: nextLastTickAt,
  };
}

/**
 * Changes world clock speed mode cleanly:
 * settles accumulated progress at the OLD speed first so `worldDay` stays continuous,
 * then applies the new speed (`fast`: 30s, `normal`: 180s, `slow`: 600s, `custom`: clamped 10-86400s).
 */
export function changeWorldSpeed(
  clock: WorldClockState,
  mode: WorldClockSpeedMode,
  nowMs: number,
  customSeconds?: number
): WorldClockState {
  const settled = settleWorldClock(clock, nowMs);

  let nextSecondsPerDay: number;
  if (mode === 'custom') {
    if (typeof customSeconds === 'number' && Number.isFinite(customSeconds)) {
      nextSecondsPerDay = Math.max(
        MIN_WORLD_CLOCK_SECONDS_PER_DAY,
        Math.min(MAX_WORLD_CLOCK_SECONDS_PER_DAY, customSeconds)
      );
    } else {
      nextSecondsPerDay = Math.max(
        MIN_WORLD_CLOCK_SECONDS_PER_DAY,
        Math.min(MAX_WORLD_CLOCK_SECONDS_PER_DAY, settled.secondsPerDay)
      );
    }
  } else {
    nextSecondsPerDay = WORLD_CLOCK_SPEED_PRESETS[mode];
  }

  return {
    ...settled,
    speedMode: mode,
    secondsPerDay: nextSecondsPerDay,
  };
}

/**
 * Resets the world clock back to day 0 with `lastTickAt` anchored to `nowMs`.
 */
export function resetWorldClock(nowMs: number = Date.now()): WorldClockState {
  const base = createDefaultWorldClock();
  return {
    ...base,
    worldDay: 0,
    lastTickAt: normalizeNowMs(nowMs),
    paused: false,
  };
}
