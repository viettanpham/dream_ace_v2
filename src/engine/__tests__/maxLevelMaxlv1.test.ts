import { afterEach, describe, expect, it } from 'vitest';
import {
  BALANCE_CONFIG,
  getMaxLevel,
  sanitizeMaxLevel,
  setRuntimeMaxLevel,
} from '../../data/balance';
import { useGameStore } from '../../store/useGameStore';
import { migrateSaveData } from '../migration';
import { applyExpToGear, createDefaultGearUnit, getExpForNextLevel } from '../stats';

describe('TASK MAXLV-1 — Admin max level', () => {
  afterEach(() => {
    setRuntimeMaxLevel(BALANCE_CONFIG.maxLevel);
  });

  it('1) default maxLevel is 50 and stops gear leveling at 50', () => {
    setRuntimeMaxLevel(undefined);
    expect(getMaxLevel()).toBe(50);

    const lv50 = { ...createDefaultGearUnit('striker', true), level: 50, exp: 0 };
    const res = applyExpToGear(lv50, 999999);
    expect(res.newLevel).toBe(50);
    expect(res.leveledUp).toBe(false);
    expect(res.updatedGear.level).toBe(50);
  });

  it('2) setting maxLevel to 60 via store lets a gear level past 50', () => {
    useGameStore.getState().adminUpdateConfig({ maxLevel: 60 });
    expect(getMaxLevel()).toBe(60);

    const lv50 = { ...createDefaultGearUnit('striker', true), level: 50, exp: 0 };
    const needed = getExpForNextLevel(50) + getExpForNextLevel(51) + 100;
    const res = applyExpToGear(lv50, needed);
    expect(res.newLevel).toBe(52);
    expect(res.leveledUp).toBe(true);
    expect(res.statPointsGained).toBe(6);
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

  it('4) sanitizer clamps 5 -> 20 and 500 -> 100', () => {
    expect(sanitizeMaxLevel(5)).toBe(20);
    expect(sanitizeMaxLevel(500)).toBe(100);

    const low = migrateSaveData({ adminConfig: { maxLevel: 5 } }, 13);
    const high = migrateSaveData({ adminConfig: { maxLevel: 500 } }, 13);
    expect(low.adminConfig.maxLevel).toBe(20);
    expect(high.adminConfig.maxLevel).toBe(100);
  });
});
