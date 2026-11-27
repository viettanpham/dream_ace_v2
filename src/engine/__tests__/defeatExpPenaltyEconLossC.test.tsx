import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BATTLE_PENALTY_CONFIG,
  sanitizeBattlePenaltyConfig,
} from '../../data/balance';
import {
  computeDefeatExpPenalty,
  getBattleSummaryCharges,
} from '../battlePenalty';
import { getExpForNextLevel } from '../stats';

describe('ECON-LOSS-c defeat EXP penalty', () => {
  it('1) free at low level (<= defeatFreeLevel) and sanitizer gives defaults to old saves', () => {
    const res = computeDefeatExpPenalty(10, 5000, DEFAULT_BATTLE_PENALTY_CONFIG);
    expect(res).toEqual({ expPenalty: 0, nextExp: 5000, free: true });

    const sanitizedOld = sanitizeBattlePenaltyConfig({
      retreatFreeLevel: 12,
    });
    expect(sanitizedOld.defeatFreeLevel).toBe(10);
    expect(sanitizedOld.defeatExpPenaltyFactor).toBe(0.5);
  });

  it('2) computes penalty = round(need * retreatExpPenaltyPct/100 * defeatExpPenaltyFactor)', () => {
    const level = 20;
    const currentExp = 50000;
    const expected = Math.round(
      getExpForNextLevel(level) *
        (DEFAULT_BATTLE_PENALTY_CONFIG.retreatExpPenaltyPct / 100) *
        DEFAULT_BATTLE_PENALTY_CONFIG.defeatExpPenaltyFactor
    );
    const res = computeDefeatExpPenalty(
      level,
      currentExp,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(res).toEqual({
      expPenalty: expected,
      nextExp: currentExp - expected,
      free: false,
    });
  });

  it('3) clamps penalty to current EXP without going negative or de-leveling', () => {
    const res = computeDefeatExpPenalty(25, 123, DEFAULT_BATTLE_PENALTY_CONFIG);
    expect(res).toEqual({ expPenalty: 123, nextExp: 0, free: false });

    const zeroExp = computeDefeatExpPenalty(25, 0, DEFAULT_BATTLE_PENALTY_CONFIG);
    expect(zeroExp).toEqual({ expPenalty: 0, nextExp: 0, free: false });
  });

  it('4) factor 0 disables penalty (clamped 0..5) and defeatPenaltyExp feeds getBattleSummaryCharges', () => {
    const offCfg = sanitizeBattlePenaltyConfig({
      ...DEFAULT_BATTLE_PENALTY_CONFIG,
      defeatExpPenaltyFactor: 0,
    });
    expect(computeDefeatExpPenalty(30, 50000, offCfg)).toEqual({
      expPenalty: 0,
      nextExp: 50000,
      free: true,
    });

    const cappedCfg = sanitizeBattlePenaltyConfig({
      defeatExpPenaltyFactor: 9,
    });
    expect(cappedCfg.defeatExpPenaltyFactor).toBe(5);

    expect(
      getBattleSummaryCharges({
        repairFee: 400,
        retreatPenaltyCredit: 0,
        retreatPenaltyExp: 0,
        defeatPenaltyExp: 1200,
      })
    ).toEqual({ creditCharged: 400, expCharged: 1200 });
  });
});
