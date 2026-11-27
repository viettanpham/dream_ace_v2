import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_EQUIP_CONFIG } from '../../data/autoEquipConfig';
import { BALANCE_CONFIG } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { buildAutoEquipPlan, scoreItemForClass } from '../autoEquip';
import {
  chooseAiDecision,
  createInitialBattleState,
  getValidEnemyTargets,
  resolveUnitAction,
} from '../combat';
import { generateItemInstance } from '../equipment';
import { createFreshCampaignState } from '../migration';
import { calculateDerivedStats } from '../stats';
import type { CombatUnit } from '../../types/game';

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeBattleUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'u1',
    name: 'Unit',
    callsign: 'U-1',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    hasLongRangeWeapon: false,
    accuracyPct: 0,
    detectsStealth: false,
    isPlayer: false,
    classId: 'striker',
    level: 5,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: {
      attack: 40,
      defense: 20,
      fuel: 20,
      spirit: 20,
      shield: 20,
      evasion: 10,
    },
    derived: {
      maxHp: 500,
      maxShield: 200,
      maxSp: 100,
      speed: 30,
      attackPower: 40,
      defenseRating: 20,
      dodgeChance: 40,
      critChance: 10,
      skillPower: 40,
      armorPiercePct: 0,
      accuracyPct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 500,
    shield: 200,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('TASK RAD1a-2 — Radar accuracy, stealth detection, and auto-equip weights', () => {
  it('1) accuracy 12 lowers dodge 40 -> 28 in a seeded hit roll, caps total accuracy at 30, and Barrel Roll still evades', () => {
    const defender = makeBattleUnit({
      id: 'enemy_1',
      side: 'enemy',
      derived: { ...makeBattleUnit().derived, dodgeChance: 40 },
    });

    // rng() = 0.35 => roll 35: misses against dodge 40 (accuracy 0), hits against dodge 28 (accuracy 12)
    const zeroAcc = makeBattleUnit({ id: 'ally_player', isPlayer: true, accuracyPct: 0 });
    const missRes = resolveUnitAction([zeroAcc, defender], 'ally_player', 'attack', 'enemy_1', 1, undefined, () => 0.35);
    expect(missRes.popups.some((p) => p.text === 'EVADED')).toBe(true);

    const acc12 = makeBattleUnit({ id: 'ally_player', isPlayer: true, accuracyPct: 12 });
    const hitRes = resolveUnitAction([acc12, defender], 'ally_player', 'attack', 'enemy_1', 1, undefined, () => 0.35);
    expect(hitRes.popups.some((p) => p.text === 'EVADED')).toBe(false);
    expect(hitRes.updatedUnits[1].shield).toBeLessThan(200);

    // Total accuracy capped at 30 on battle init even when gear traits sum > 30 (e.g. 22 + 12 = 34 -> 30)
    const campaign = createFreshCampaignState('CapPilot', 'striker', createRng(1));
    const hunter = {
      ...generateItemInstance({ templateId: 'tpl_rd_hunter', rarity: 'rare', rollQuality: 50 }, createRng(2)),
      specialTraits: { accuracyPct: 22, detectStealth: true },
    };
    const aegis = generateItemInstance({ templateId: 'tpl_rd_aegis_eye', rarity: 'epic', rollQuality: 50 }, createRng(3));
    const stackedPilot = {
      ...campaign.pilot,
      inventory: [...campaign.pilot.inventory, hunter, aegis],
      gears: {
        ...campaign.pilot.gears,
        striker: {
          ...campaign.pilot.gears.striker,
          level: 10,
          equipped: {
            ...campaign.pilot.gears.striker.equipped,
            radar: aegis.instanceId,
            accessory: hunter.instanceId,
          },
        },
      },
    };
    const battle = createInitialBattleState(stackedPilot, 'sec_1', createRng(4));
    const player = battle.units.find((u) => u.isPlayer)!;
    expect(player.accuracyPct).toBe(BALANCE_CONFIG.maxAccuracyPct);
    expect(player.accuracyPct).toBe(30);

    // Against dodge 40 with capped accuracy 30 => effectiveDodge = 10: roll 0.05 evades, roll 0.25 hits
    const evadeCap = resolveUnitAction([player, defender], player.id, 'attack', 'enemy_1', 1, undefined, () => 0.05);
    expect(evadeCap.popups.some((p) => p.text === 'EVADED')).toBe(true);

    // Barrel Roll (evade_all) still evades regardless of accuracy
    const barrelDefender = makeBattleUnit({
      id: 'enemy_br',
      side: 'enemy',
      statuses: [{ type: 'evade_all', turnsRemaining: 1 }],
    });
    const barrelRes = resolveUnitAction([player, barrelDefender], player.id, 'attack', 'enemy_br', 1, undefined, () => 0.99);
    expect(barrelRes.popups.some((p) => p.text === 'BARREL ROLL')).toBe(true);
  });

  it('2) detectStealth attacker can target a stealthed enemy, normal attacker cannot, and NPC units never detect', () => {
    const enemyStealth = makeBattleUnit({
      id: 'enemy_s',
      side: 'enemy',
      row: 'front',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    const enemyVisible = makeBattleUnit({
      id: 'enemy_v',
      side: 'enemy',
      row: 'front',
    });

    const normalPlayer = makeBattleUnit({ id: 'ally_player', isPlayer: true, detectsStealth: false });
    const detectorPlayer = makeBattleUnit({
      id: 'ally_player',
      isPlayer: true,
      detectsStealth: true,
      equippedSkillIds: ['str_armor_breaker'],
    });

    expect(getValidEnemyTargets([normalPlayer, enemyStealth, enemyVisible], normalPlayer, 'attack').map((u) => u.id)).toEqual(['enemy_v']);
    expect(getValidEnemyTargets([detectorPlayer, enemyStealth, enemyVisible], detectorPlayer, 'attack').map((u) => u.id)).toEqual(['enemy_s', 'enemy_v']);

    // Skill resolution also respects detectsStealth via getTargetableOpponents
    const skillHitStealth = resolveUnitAction(
      [detectorPlayer, enemyStealth, enemyVisible],
      'ally_player',
      'skill',
      'enemy_s',
      1,
      undefined,
      () => 0.95,
      'str_armor_breaker'
    );
    expect(skillHitStealth.updatedUnits.find((u) => u.id === 'enemy_s')!.shield).toBeLessThan(200);

    // Real battle init: player with wideband radar gets accuracyPct 5 and no detectStealth
    const campaign = createFreshCampaignState('ScanPilot', 'striker', createRng(5));
    const wideband = generateItemInstance({ templateId: 'tpl_rd_wideband', rarity: 'rare', rollQuality: 50 }, createRng(6));
    const pilotWithRadar = {
      ...campaign.pilot,
      inventory: [...campaign.pilot.inventory, wideband],
      gears: {
        ...campaign.pilot.gears,
        striker: {
          ...campaign.pilot.gears.striker,
          equipped: { ...campaign.pilot.gears.striker.equipped, radar: wideband.instanceId },
        },
      },
    };
    const battle = createInitialBattleState(pilotWithRadar, 'sec_1', createRng(7));
    const player = battle.units.find((u) => u.isPlayer)!;
    const npcs = battle.units.filter((u) => !u.isPlayer);
    expect(player.detectsStealth).toBe(false);
    expect(player.accuracyPct).toBe(5);
    expect(npcs.length).toBeGreaterThan(0);
    expect(npcs.every((u) => u.detectsStealth === false && u.accuracyPct === 0)).toBe(true);
  });

  it('3) autoEquip picks a radar for a striker and scores accuracyPct', () => {
    const campaign = createFreshCampaignState('AutoRadar', 'striker', createRng(10));
    const scout = generateItemInstance({ templateId: 'tpl_rd_scout', rarity: 'common', rollQuality: 50 }, createRng(11));
    const hunter = generateItemInstance({ templateId: 'tpl_rd_hunter', rarity: 'epic', rollQuality: 60 }, createRng(12));

    // Confirm score contribution from accuracyPct (1.2 for striker)
    expect(scoreItemForClass(hunter, 'striker', DEFAULT_AUTO_EQUIP_CONFIG)).toBeGreaterThan(
      scoreItemForClass(scout, 'striker', DEFAULT_AUTO_EQUIP_CONFIG)
    );
    const plainHunter = { ...hunter, specialTraits: {} };
    const delta =
      scoreItemForClass(hunter, 'striker', DEFAULT_AUTO_EQUIP_CONFIG) -
      scoreItemForClass(plainHunter, 'striker', DEFAULT_AUTO_EQUIP_CONFIG);
    // hunter traits: accuracyPct 8 * 1.2 = 9.6
    expect(delta).toBeCloseTo(9.6, 1);

    const pilot = {
      ...campaign.pilot,
      gears: {
        ...campaign.pilot.gears,
        striker: { ...campaign.pilot.gears.striker, level: 25 },
      },
      inventory: [...campaign.pilot.inventory, scout, hunter],
    };
    const plan = buildAutoEquipPlan(pilot, { mode: 'single', targetGearId: 'striker' });
    const radarPlan = plan.gearPlans[0].slots.find((s) => s.slot === 'radar')!;
    expect(radarPlan.changed).toBe(true);
    expect(radarPlan.nextItem?.instanceId).toBe(hunter.instanceId);
    expect(radarPlan.traitDeltas.accuracyPct).toBe(8);
    expect(radarPlan.traitDeltas.detectStealthDelta).toBe(0);
  });

  it('4) fixed-seed battle with no radar is identical to before (zero defaults and deterministic outcomes)', () => {
    const campaign = createFreshCampaignState('NoRadar', 'striker', createRng(21));
    const battleA = createInitialBattleState(campaign.pilot, 'sec_1', createRng(99));
    const battleB = createInitialBattleState(campaign.pilot, 'sec_1', createRng(99));

    const playerA = battleA.units.find((u) => u.isPlayer)!;
    expect(playerA.accuracyPct).toBe(0);
    expect(playerA.detectsStealth).toBe(false);
    expect(playerA.derived.accuracyPct).toBe(0);

    // Simulate 8 turns with identical RNG and verify byte-identical unit states
    const rngA = createRng(777);
    const rngB = createRng(777);
    let unitsA = battleA.units;
    let unitsB = battleB.units;
    for (let i = 0; i < 8; i++) {
      const actorA = unitsA.find((u) => u.alive) ?? unitsA[0];
      const actorB = unitsB.find((u) => u.alive) ?? unitsB[0];
      const decA = chooseAiDecision(actorA, unitsA, rngA);
      const decB = chooseAiDecision(actorB, unitsB, rngB);
      unitsA = resolveUnitAction(unitsA, actorA.id, decA.action, decA.targetId, 1, undefined, rngA, decA.skillId).updatedUnits;
      unitsB = resolveUnitAction(unitsB, actorB.id, decB.action, decB.targetId, 1, undefined, rngB, decB.skillId).updatedUnits;
    }
    expect(unitsA.map((u) => ({ id: u.id, hp: u.hp, shield: u.shield, sp: u.sp }))).toEqual(
      unitsB.map((u) => ({ id: u.id, hp: u.hp, shield: u.shield, sp: u.sp }))
    );

    // Explicitly verify omitted accuracyPct behaves identically to accuracyPct: 0 on same-seed roll
    const targetA = makeBattleUnit({ id: 't', side: 'enemy', derived: { ...makeBattleUnit().derived, dodgeChance: 35 } });
    const targetB = makeBattleUnit({ id: 't', side: 'enemy', derived: { ...makeBattleUnit().derived, dodgeChance: 35 } });
    const attOmitted = makeBattleUnit({ id: 'a', accuracyPct: undefined });
    const attZero = makeBattleUnit({ id: 'a', accuracyPct: 0 });
    const resOmitted = resolveUnitAction([attOmitted, targetA], 'a', 'attack', 't', 1, undefined, createRng(555));
    const resZero = resolveUnitAction([attZero, targetB], 'a', 'attack', 't', 1, undefined, createRng(555));
    expect(resOmitted.updatedUnits[1].shield).toBe(resZero.updatedUnits[1].shield);
    expect(resOmitted.updatedUnits[1].hp).toBe(resZero.updatedUnits[1].hp);
  });

  it('5) calculateDerivedStats computes accuracyPct and caps it at BALANCE_CONFIG.maxAccuracyPct (30)', () => {
    const none = calculateDerivedStats('striker', 10, EMPTY_STAT_BLOCK);
    const partial = calculateDerivedStats('striker', 10, EMPTY_STAT_BLOCK, { accuracyPct: 12 });
    const capped = calculateDerivedStats('striker', 10, EMPTY_STAT_BLOCK, { accuracyPct: 48 });
    expect(none.accuracyPct).toBe(0);
    expect(partial.accuracyPct).toBe(12);
    expect(capped.accuracyPct).toBe(BALANCE_CONFIG.maxAccuracyPct);
    expect(capped.accuracyPct).toBe(30);
  });
});
