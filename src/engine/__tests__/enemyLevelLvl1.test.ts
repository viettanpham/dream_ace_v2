import { describe, expect, it } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import {
  clampEnemyLevel,
  DEFAULT_ENEMY_LEVEL_CONFIG,
  rollEnemyLevelOffset,
  sanitizeEnemyLevelConfig,
} from '../enemyLevel';

describe('TASK LVL-1 — Enemy level offset & cap rules', () => {
  it('1) rollEnemyLevelOffset stays inside [min, max] for all kinds (mission/event use assault)', () => {
    const cfgNoPeak = { ...DEFAULT_ENEMY_LEVEL_CONFIG, peakChancePct: 0 };
    const kinds = ['patrol', 'pirate', 'assault', 'defend', 'boss', 'mission', 'event'] as const;

    for (const kind of kinds) {
      const expectedRange =
        kind === 'mission' || kind === 'event'
          ? cfgNoPeak.ranges.assault
          : cfgNoPeak.ranges[kind];
      for (let step = 0; step < 25; step++) {
        const val = rollEnemyLevelOffset(kind, cfgNoPeak, () => step / 25);
        expect(val).toBeGreaterThanOrEqual(expectedRange.min);
        expect(val).toBeLessThanOrEqual(expectedRange.max);
      }
    }
  });

  it('2) peakChancePct = 100 always returns peak', () => {
    const cfgPeak = { ...DEFAULT_ENEMY_LEVEL_CONFIG, peakChancePct: 100 };
    expect(rollEnemyLevelOffset('patrol', cfgPeak, () => 0.99)).toBe(5);
    expect(rollEnemyLevelOffset('pirate', cfgPeak, () => 0.5)).toBe(10);
    expect(rollEnemyLevelOffset('assault', cfgPeak, () => 0.1)).toBe(15);
    expect(rollEnemyLevelOffset('defend', cfgPeak, () => 0.7)).toBe(12);
    expect(rollEnemyLevelOffset('boss', cfgPeak, () => 0.3)).toBe(12);
  });

  it('3) clampEnemyLevel clamps to [1, BALANCE_CONFIG.maxLevel + cap]', () => {
    expect(clampEnemyLevel(0, DEFAULT_ENEMY_LEVEL_CONFIG)).toBe(1);
    expect(clampEnemyLevel(-5, DEFAULT_ENEMY_LEVEL_CONFIG)).toBe(1);
    expect(clampEnemyLevel(999, DEFAULT_ENEMY_LEVEL_CONFIG)).toBe(
      BALANCE_CONFIG.maxLevel + 10
    );
    expect(
      clampEnemyLevel(999, { ...DEFAULT_ENEMY_LEVEL_CONFIG, enemyLevelCapOverMax: 5 })
    ).toBe(BALANCE_CONFIG.maxLevel + 5);
  });

  it('4) sanitizeEnemyLevelConfig fixes min > max, rounds ints, and clamps bounds', () => {
    const clean = sanitizeEnemyLevelConfig({
      ranges: {
        patrol: { min: 7.4, max: 2.1, peak: 99 },
        pirate: { min: -99, max: 4.6, peak: -30 },
      },
      peakChancePct: 150,
      enemyLevelCapOverMax: 80,
    });

    expect(clean.ranges.patrol).toEqual({ min: 7, max: 7, peak: 50 });
    expect(clean.ranges.pirate).toEqual({ min: -20, max: 5, peak: -20 });
    expect(clean.peakChancePct).toBe(100);
    expect(clean.enemyLevelCapOverMax).toBe(50);
  });
});
