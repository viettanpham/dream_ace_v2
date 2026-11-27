import { afterEach, describe, expect, it } from 'vitest';
import {
  BALANCE_CONFIG,
  getMaxLevel,
  sanitizeMaxLevel,
  setRuntimeMaxLevel,
} from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { useGameStore } from '../../store/useGameStore';
import { migrateSaveData } from '../migration';
import {
  applyExpToGear,
  calculateDerivedStats,
  calculateEffectiveStats,
  createDefaultGearUnit,
  getExpForNextLevel,
} from '../stats';

describe('LVL-CAP / MAXLV-1 — Uncapped Admin max level', () => {
  afterEach(() => {
    setRuntimeMaxLevel(BALANCE_CONFIG.maxLevel);
  });

  it('1) default maxLevel is 100 for new saves and stops gear leveling at 100', () => {
    setRuntimeMaxLevel(undefined);
    expect(BALANCE_CONFIG.maxLevel).toBe(100);
    expect(getMaxLevel()).toBe(100);

    const lv100 = { ...createDefaultGearUnit('striker', true), level: 100, exp: 0 };
    const res = applyExpToGear(lv100, 999999);
    expect(res.newLevel).toBe(100);
    expect(res.leveledUp).toBe(false);
    expect(res.updatedGear.level).toBe(100);
  });

  it('2) setting maxLevel to 300 via store lets a gear level past 100 and old saves preserve saved maxLevel', () => {
    useGameStore.getState().adminUpdateConfig({ maxLevel: 300 });
    expect(getMaxLevel()).toBe(300);

    const lv100 = { ...createDefaultGearUnit('striker', true), level: 100, exp: 0 };
    const needed = getExpForNextLevel(100) + getExpForNextLevel(101) + 100;
    const res = applyExpToGear(lv100, needed);
    expect(res.newLevel).toBe(102);
    expect(res.leveledUp).toBe(true);
    expect(res.statPointsGained).toBe(6);

    const legacy50 = migrateSaveData({ adminConfig: { maxLevel: 50 } }, 13);
    expect(legacy50.adminConfig.maxLevel).toBe(50);
  });

  it('3) lowering maxLevel to 30 keeps a Lv45 gear at 45 on EXP gain and save load, but gains no new level', () => {
    useGameStore.getState().adminUpdateConfig({ maxLevel: 30 });
    expect(getMaxLevel()).toBe(30);

    const lv45 = { ...createDefaultGearUnit('striker', true), level: 45, exp: 0 };
    const res = applyExpToGear(lv45, 999999);
    expect(res.updatedGear.level).toBe(45);
    expect(res.newLevel).toBe(45);
    expect(res.leveledUp).toBe(false);
    expect(res.statPointsGained).toBe(0);

    const migrated = migrateSaveData(
      {
        adminConfig: { maxLevel: 30 },
        pilot: {
          gears: {
            striker: lv45,
          },
        },
      },
      13
    );
    expect(migrated.pilot.gears.striker.level).toBe(45);
  });

  it('4) sanitizeMaxLevel allows any integer >= 1 (500 -> 500) and falls back to default on invalid/0 (< 1)', () => {
    expect(sanitizeMaxLevel(500)).toBe(500);
    expect(sanitizeMaxLevel(5)).toBe(5);
    expect(sanitizeMaxLevel(1)).toBe(1);
    expect(sanitizeMaxLevel(0)).toBe(BALANCE_CONFIG.maxLevel);
    expect(sanitizeMaxLevel(-10)).toBe(BALANCE_CONFIG.maxLevel);
    expect(sanitizeMaxLevel(Number.NaN)).toBe(BALANCE_CONFIG.maxLevel);

    const high = migrateSaveData({ adminConfig: { maxLevel: 500 } }, 13);
    const zero = migrateSaveData({ adminConfig: { maxLevel: 0 } }, 13);
    expect(high.adminConfig.maxLevel).toBe(500);
    expect(zero.adminConfig.maxLevel).toBe(BALANCE_CONFIG.maxLevel);
  });

  it('5) EXP curve and effective/derived stats at Lv 100 and Lv 300 are finite and free of NaN', () => {
    for (const lv of [100, 300]) {
      const exp = getExpForNextLevel(lv);
      expect(Number.isFinite(exp)).toBe(true);
      expect(exp).toBeGreaterThan(0);

      const eff = calculateEffectiveStats('striker', lv, EMPTY_STAT_BLOCK);
      for (const val of Object.values(eff)) {
        expect(Number.isFinite(val)).toBe(true);
      }

      const derived = calculateDerivedStats('striker', lv, eff);
      for (const val of Object.values(derived)) {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });
});
