import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getMaxLevel } from '../../data/balance';
import { getStatusEntry } from '../../data/statusEffects';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import {
  applyExpCardBatchToGear,
  applySingleExpCardToGear,
  DEFAULT_CARD_TIERS_CONFIG,
  getCardTier,
  sanitizeCardTiersConfig,
} from '../cardTiers';
import { getEffectiveUnitDodge } from '../combat';
import { advanceCampaignMonth } from '../mapWorld';
import {
  DEFAULT_MEDALS_CONFIG,
  sanitizeMedalsConfig,
  sanitizePilotMedals,
} from '../medals';
import { createFreshCampaignState } from '../migration';
import {
  cascadeMedalsByTiers,
  computeMonthlyEconomyRoll,
  computeMonthlySalary,
  estimateMonthlyEconomyAtPct,
  getAllowedMedalTiers,
  sanitizeMonthlyEconomyConfig,
} from '../monthlyEconomy';
import { rollBlackMarketMedalOffer } from '../shop';
import { applyStatus } from '../statusEngine';

function makeSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeDodgeUnit(baseDodge: number): CombatUnit {
  return {
    id: 'test_u',
    name: 'Test Unit',
    callsign: 'Test Unit',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    isPlayer: true,
    classId: 'interceptor',
    level: 10,
    skillLevel: 1,
    skillLevels: { int_dash: 1 },
    equippedSkillIds: ['int_dash'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 100,
      maxShield: 50,
      maxSp: 10,
      speed: 50,
      attackPower: 50,
      defenseRating: 20,
      dodgeChance: baseDodge,
      critChance: 10,
      skillPower: 10,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 1,
      passiveSkillDmgPct: 0,
    },
    hp: 100,
    shield: 50,
    sp: 5,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
  };
}

describe('CARD-TIERS-1', () => {
  it('1) Decoy Flare never lowers dodge and respects max(45, baseWithoutFlare) cap', () => {
    const flareEntry = getStatusEntry('ENG_flare_dodge')!;
    const unit55 = makeDodgeUnit(55);
    const unit55Flare: CombatUnit = {
      ...unit55,
      statuses: applyStatus([], flareEntry, { value: 20, turns: 1 }),
    };
    expect(getEffectiveUnitDodge(unit55)).toBe(55);
    expect(getEffectiveUnitDodge(unit55Flare)).toBe(55);

    const unit35 = makeDodgeUnit(35);
    const unit35Flare: CombatUnit = {
      ...unit35,
      statuses: applyStatus([], flareEntry, { value: 20, turns: 1 }),
    };
    expect(getEffectiveUnitDodge(unit35Flare)).toBe(45);

    const unit90 = makeDodgeUnit(90);
    expect(getEffectiveUnitDodge(unit90)).toBe(75);
  });

  it('2) EXP card per-use level-gain cap (Lv1+1000 EXP -> +1 lvl waste; T5 -> +5 lvls; never above global cap)', () => {
    const fresh = createFreshCampaignState('CapTester', 'striker', makeSeededRng(1));
    const lv1Gear = { ...fresh.pilot.gears.striker, level: 1, exp: 0 };

    const resT1 = applySingleExpCardToGear(lv1Gear, 1000);
    expect(resT1.newLevel).toBe(2);
    expect(resT1.levelsGained).toBe(1);
    expect(resT1.wastedExp).toBeGreaterThan(0);

    const resT5 = applySingleExpCardToGear(lv1Gear, 20000);
    expect(resT5.tier).toBe(5);
    expect(resT5.levelsGained).toBeLessThanOrEqual(5);
    expect(resT5.newLevel).toBeLessThanOrEqual(getMaxLevel());

    const maxGear = { ...lv1Gear, level: getMaxLevel(), exp: 0 };
    const atCap = applySingleExpCardToGear(maxGear, 5000);
    expect(atCap.appliedExp).toBe(0);
    expect(atCap.cardsUsed).toBe(0);
    expect(atCap.newLevel).toBe(getMaxLevel());
  });

  it('3) Legacy value maps to nearest tier <= value and batch Dùng hết stops when next card adds 0 effective EXP', () => {
    expect(getCardTier('exp', 500)).toBe(1);
    expect(getCardTier('exp', 2500)).toBe(1);
    expect(getCardTier('exp', 7500)).toBe(3);
    expect(getCardTier('exp', 50000)).toBe(5);
    expect(getCardTier('credit', 35000)).toBe(2);

    const fresh = createFreshCampaignState('BatchTester', 'striker', makeSeededRng(2));
    const nearCap = { ...fresh.pilot.gears.striker, level: getMaxLevel() - 1, exp: 0 };
    const batch = applyExpCardBatchToGear(nearCap, 5000, 10);
    expect(batch.cardsUsed).toBeGreaterThan(0);
    expect(batch.cardsUsed).toBeLessThan(10);
    expect(batch.newLevel).toBe(getMaxLevel());
    const atCapBatch = applyExpCardBatchToGear(batch.updatedGear, 5000, 10);
    expect(atCapBatch.cardsUsed).toBe(0);
    expect(atCapBatch.appliedExp).toBe(0);
  });

  it('4) Medal use adds WP + consumes medals, and Chợ đen black market offer computes Credit price accurately', () => {
    const fresh = createFreshCampaignState('MedalTester', 'striker', makeSeededRng(3));
    useGameStore.setState({
      pilot: {
        ...fresh.pilot,
        warPoints: 50,
        medals: { medal_t1: 3, medal_t2: 1 },
      },
      battle: null,
      autoRepeatSession: null,
    });

    const r1 = useGameStore.getState().redeemMedal('medal_t1', 1);
    expect(r1.ok).toBe(true);
    expect(r1.wpGained).toBe(1000);
    expect(useGameStore.getState().pilot.warPoints).toBe(1050);
    expect(useGameStore.getState().pilot.medals?.medal_t1).toBe(2);

    const rAll = useGameStore.getState().redeemMedal('medal_t1', 2);
    expect(rAll.ok).toBe(true);
    expect(useGameStore.getState().pilot.warPoints).toBe(3050);
    expect(useGameStore.getState().pilot.medals?.medal_t1).toBeUndefined();

    const bmOffer = rollBlackMarketMedalOffer(
      { ...DEFAULT_MEDALS_CONFIG, blackMarketRatePct: 10, blackMarketWeights: [100, 0, 0, 0, 0] },
      () => 0
    );
    expect(bmOffer).not.toBeNull();
    expect(bmOffer?.kind).toBe('medal');
    expect(bmOffer?.tier).toBe(1);
    expect(bmOffer?.creditPrice).toBe(1_500_000);
  });

  it('5) Monthly salary formula matches (base + per*captured) * coef (6/20 = 2,080 WP) and still pays at 0 captured', () => {
    const sal620 = computeMonthlySalary({
      capturedSubBases: 6,
      totalSubBases: 20,
      hasCapital: true,
    });
    expect(sal620.coef).toBe(1.3);
    expect(sal620.salaryWp).toBe(2080);

    const sal0 = computeMonthlySalary({
      capturedSubBases: 0,
      totalSubBases: 20,
      hasCapital: true,
    });
    expect(sal0.coef).toBe(1.0);
    expect(sal0.salaryWp).toBe(1000);

    const salLostCap = computeMonthlySalary({
      capturedSubBases: 3,
      totalSubBases: 5,
      hasCapital: false,
    });
    expect(salLostCap.salaryWp).toBe(0);
  });

  it('6) Medal cascade with seeded rng (total 50 across T1/T2/T3) + tier unlock thresholds (11/31/51%) + advanceCampaignMonth', () => {
    expect(getAllowedMedalTiers(10, 0)).toEqual([1, 2]);
    expect(getAllowedMedalTiers(11, 0)).toEqual([1, 2, 3]);
    expect(getAllowedMedalTiers(31, 0)).toEqual([1, 2, 3, 4]);
    expect(getAllowedMedalTiers(51, 0)).toEqual([1, 2, 3, 4, 5]);

    const cascaded = cascadeMedalsByTiers(50, [1, 2, 3], makeSeededRng(42));
    expect(cascaded.t1 + cascaded.t2 + cascaded.t3).toBe(50);
    expect(cascaded.t4).toBe(0);
    expect(cascaded.t5).toBe(0);

    const fresh = createFreshCampaignState('MonthTester', 'striker', makeSeededRng(7));
    const summary = advanceCampaignMonth(fresh.pilot, 10, null, null, makeSeededRng(99));
    expect(summary.salaryWp).toBeGreaterThanOrEqual(1000);
    expect(summary.lostSectorIds).toEqual(summary.flippedSectorIds);
    expect(
      summary.medals.t1 + summary.medals.t2 + summary.medals.t3 + summary.medals.t4 + summary.medals.t5
    ).toBeGreaterThanOrEqual(0);
    // Also verify economy estimate helper runs cleanly for 20% & 60%
    const est20 = estimateMonthlyEconomyAtPct({ capturedPct: 20, totalSubBases: 5 });
    const est60 = estimateMonthlyEconomyAtPct({ capturedPct: 60, totalSubBases: 5 });
    expect(est60.expectedTotalWp).toBeGreaterThan(est20.expectedTotalWp);
    const fixedRoll = computeMonthlyEconomyRoll({
      capturedSubBases: 3,
      totalSubBases: 5,
      hasCapital: true,
      rng: makeSeededRng(15),
    });
    expect(fixedRoll.allowedTiers).toEqual([1, 2, 3, 4, 5]);
  });

  it('7) Config/pilot sanitizers clamp safely and VI/EN translation keys match in parity', () => {
    const cleanCards = sanitizeCardTiersConfig({
      exp: { values: [500, 500, 100, -1, 99999999], maxLevels: [0, 25, 2, 3, 4] },
      credit: { values: [1, 2, 3, 4, 5] },
      previewWastePct: 150,
    });
    expect(cleanCards.exp.values).toEqual(DEFAULT_CARD_TIERS_CONFIG.exp.values);
    expect(cleanCards.previewWastePct).toBe(100);

    const cleanMedals = sanitizeMedalsConfig({
      wp: [1000, -5, 5000, 8000, 12000],
      blackMarketRatePct: 25,
      blackMarketCreditPerWp: 0,
    });
    expect(cleanMedals.blackMarketRatePct).toBe(10);
    expect(cleanMedals.blackMarketCreditPerWp).toBe(1);
    expect(cleanMedals.wp[1]).toBe(2000);

    const cleanPilotMedals = sanitizePilotMedals({
      medal_t1: 999999,
      medal_t2: -3,
      bogus: 5,
    });
    expect(cleanPilotMedals).toEqual({ medal_t1: 99999 });

    const cleanEco = sanitizeMonthlyEconomyConfig({ coefEveryPct: 0, homeMedalMax: 0, homeMedalMin: 4 });
    expect(cleanEco.coefEveryPct).toBe(1);
    expect(cleanEco.homeMedalMax).toBe(4);

    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
  });
});
