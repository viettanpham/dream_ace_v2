// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  COMBAT_FORMULAS,
  sanitizeSpEconomyConfig,
} from '../../data/balance';
import { MECH_CLASSES } from '../../data/classes';
import { getSkillById } from '../../data/skills';
import { createInitialBattleState, resolveUnitAction } from '../combat';
import { generateItemInstance } from '../equipment';
import { createFreshCampaignState } from '../migration';
import { canUnitUseSkill, getEffectiveSpCost } from '../skills';
import { calculateDerivedStats } from '../stats';

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TASK B1 — SP economy (spirit regen, 0 attack/defend gain, level-scaled cost)', () => {
  it('1) support spirit 18 Lv1 regen 7, striker spirit 12 regen 4', () => {
    const supDerived = calculateDerivedStats(
      'support',
      1,
      MECH_CLASSES.support.baseStats
    );
    const strDerived = calculateDerivedStats(
      'striker',
      1,
      MECH_CLASSES.striker.baseStats
    );
    expect(supDerived.spRegenPerTurn).toBe(7);
    expect(strDerived.spRegenPerTurn).toBe(4);
  });

  it('2) basic attack and defend give 0 SP', () => {
    expect(COMBAT_FORMULAS.attackSpGain).toBe(0);
    expect(COMBAT_FORMULAS.defendSpGain).toBe(0);

    const campaign = createFreshCampaignState('NoGain', 'striker', createRng(2));
    const battle = createInitialBattleState(campaign.pilot, 'sec_1', createRng(3));
    const units = battle.units.map((u) =>
      u.id === 'ally_player'
        ? { ...u, sp: 10, derived: { ...u.derived, spRegenPerTurn: 0 } }
        : u
    );
    const enemy = units.find((u) => u.side === 'enemy')!;

    const atkRes = resolveUnitAction(units, 'ally_player', 'attack', enemy.id, 1);
    expect(atkRes.updatedUnits.find((u) => u.id === 'ally_player')!.sp).toBe(10);

    const defRes = resolveUnitAction(units, 'ally_player', 'defend', null, 1);
    expect(defRes.updatedUnits.find((u) => u.id === 'ally_player')!.sp).toBe(10);
  });

  it('3) regen plus a +3 SP-regen module adds up and clamps at maxSp', () => {
    const campaign = createFreshCampaignState('ModRegen', 'striker', createRng(4));
    const basePilot = {
      ...campaign.pilot,
      gears: {
        ...campaign.pilot.gears,
        striker: { ...campaign.pilot.gears.striker, level: 10 },
      },
    };
    const battleNoMod = createInitialBattleState(basePilot, 'sec_1', createRng(6));
    const playerNoMod = battleNoMod.units.find((u) => u.isPlayer)!;

    const spMod = generateItemInstance(
      { templateId: 'mod_trait_spRegenPerTurn_t2', tier: 2, requiredLevel: 1 },
      createRng(5)
    );
    const pilotWithMod = {
      ...basePilot,
      inventory: [...basePilot.inventory, spMod],
      gears: {
        ...basePilot.gears,
        striker: {
          ...basePilot.gears.striker,
          extenders: [spMod.instanceId, null, null, null, null],
        },
      },
    };

    const battle = createInitialBattleState(pilotWithMod, 'sec_1', createRng(6));
    const player = battle.units.find((u) => u.isPlayer)!;
    expect(player.derived.spRegenPerTurn).toBe(
      playerNoMod.derived.spRegenPerTurn + 3
    );

    const nearCapUnits = battle.units.map((u) =>
      u.id === 'ally_player' ? { ...u, sp: u.derived.maxSp - 1 } : u
    );
    const res = resolveUnitAction(nearCapUnits, 'ally_player', 'defend', null, 1);
    expect(res.updatedUnits.find((u) => u.id === 'ally_player')!.sp).toBe(
      player.derived.maxSp
    );
  });

  it('4) a 20-cost skill costs 20 at Lv1 and 40 at Lv50', () => {
    const skill = getSkillById('str_solar_capacitor')!;
    expect(skill.spCost).toBe(20);
    expect(getEffectiveSpCost(skill, { level: 1 })).toBe(20);
    expect(getEffectiveSpCost(skill, { level: 50 })).toBe(40);

    const campaign = createFreshCampaignState('CostPilot', 'striker', createRng(7));
    const battle = createInitialBattleState(campaign.pilot, 'sec_1', createRng(8));
    const basePlayer = battle.units.find((u) => u.isPlayer)!;
    const lv50Unit = {
      ...basePlayer,
      level: 50,
      sp: 50,
      equippedSkillIds: [...basePlayer.equippedSkillIds, 'str_solar_capacitor'],
      skillLevels: { ...basePlayer.skillLevels, str_solar_capacitor: 1 },
    };
    const check = canUnitUseSkill(lv50Unit, 'str_solar_capacitor');
    expect(check.canUse).toBe(true);
    expect(check.spCost).toBe(40);
  });

  it('5) sanitizer clamps (regenPerSpirit 0-2, factors 0.1-3, costLevelPct 0-0.1)', () => {
    const low = sanitizeSpEconomyConfig({
      regenPerSpirit: -1,
      classFactor: { striker: 0, interceptor: -5, siege: 0.01, support: NaN },
      costLevelPct: -0.05,
    });
    expect(low.regenPerSpirit).toBe(0);
    expect(low.classFactor).toEqual({
      striker: 0.1,
      interceptor: 0.1,
      siege: 0.1,
      support: 1.3,
    });
    expect(low.costLevelPct).toBe(0);

    const high = sanitizeSpEconomyConfig({
      regenPerSpirit: 5,
      classFactor: { striker: 9, interceptor: 4, siege: 3.5, support: 10 },
      costLevelPct: 0.5,
    });
    expect(high.regenPerSpirit).toBe(2);
    expect(high.classFactor).toEqual({
      striker: 3,
      interceptor: 3,
      siege: 3,
      support: 3,
    });
    expect(high.costLevelPct).toBe(0.1);
  });
});
