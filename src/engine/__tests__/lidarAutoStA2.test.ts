import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import type { CombatUnit } from '../../types/game';
import { chooseAiDecision, resolveMultiStepTurn } from '../combat';
import {
  DEFAULT_LIDAR_AUTO_CONFIG,
  LIDAR_SKILL_ID,
  pickLidarCast,
  sanitizeLidarAutoConfig,
} from '../lidarAuto';
import { createDefaultAdminConfig } from '../migration';
import { sanitizeSimpleTacticsConfig } from '../tactics';

function makeUnit(
  id: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  return {
    id,
    name: id,
    callsign: id,
    side,
    row: 'back',
    formationCol: 0,
    isPlayer: side === 'ally',
    classId: 'support',
    level: 10,
    skillLevel: 1,
    skillLevels: {
      sup_lidar_sweep: 1,
      sup_nanite_mend: 1,
    },
    equippedSkillIds: ['sup_lidar_sweep', 'sup_nanite_mend'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 600,
      maxShield: 200,
      maxSp: 100,
      speed: 90,
      attackPower: 60,
      defenseRating: 25,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    hp: 600,
    shield: 200,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('TASK ST-A2 — Lidar auto & NPC Support step-2 rule', () => {
  it('1) player smart casts at 60% SP with stealthed enemy, and skips at 40% SP or insufficient reserve', () => {
    const adminConfig = createDefaultAdminConfig();
    const stealthedEnemy = makeUnit('e1', 'enemy', {
      classId: 'interceptor',
      isPlayer: false,
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    const actor60 = makeUnit('p1', 'ally', { sp: 60 });
    const actor40 = makeUnit('p1', 'ally', { sp: 40 });
    const actor30LowReserve = makeUnit('p1', 'ally', {
      sp: 30,
      derived: { ...makeUnit('tmp', 'ally').derived, maxSp: 60 },
    });

    expect(
      pickLidarCast(
        [actor60, stealthedEnemy],
        actor60,
        { role: 'player', lidarAuto: { enabled: true, mode: 'smart', minSpPct: 50 }, adminConfig },
        () => 0.99
      )
    ).toBe(true);

    expect(
      pickLidarCast(
        [actor40, stealthedEnemy],
        actor40,
        { role: 'player', lidarAuto: { enabled: true, mode: 'smart', minSpPct: 50 }, adminConfig },
        () => 0.01
      )
    ).toBe(false);

    // 30/60 = 50% SP, but 30 - 20 = 10 < 14 (sup_nanite_mend SP cost)
    expect(
      pickLidarCast(
        [actor30LowReserve, stealthedEnemy],
        actor30LowReserve,
        { role: 'player', lidarAuto: { enabled: true, mode: 'smart', minSpPct: 50 }, adminConfig },
        () => 0.01
      )
    ).toBe(false);
  });

  it('2) does not cast when step-2 cap is already used or Lidar is locked / on cooldown', () => {
    const adminConfig = {
      ...createDefaultAdminConfig(),
      turnPhase: { maxStep2PerTurn: 1 },
    };
    const stealthedEnemy = makeUnit('e1', 'enemy', {
      classId: 'interceptor',
      isPlayer: false,
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    const readyActor = makeUnit('p1', 'ally', { sp: 90 });

    expect(
      pickLidarCast(
        [readyActor, stealthedEnemy],
        readyActor,
        { role: 'player', adminConfig, step2UsedSoFar: 1 },
        () => 0.01
      )
    ).toBe(false);

    expect(
      pickLidarCast(
        [readyActor, stealthedEnemy],
        readyActor,
        {
          role: 'player',
          adminConfig,
          step2UsedSoFar: 0,
          turnLockedSkillIds: [LIDAR_SKILL_ID],
        },
        () => 0.01
      )
    ).toBe(false);

    const cooldownActor = makeUnit('p1', 'ally', {
      sp: 90,
      skillCooldowns: { [LIDAR_SKILL_ID]: 2 },
    });
    expect(
      pickLidarCast(
        [cooldownActor, stealthedEnemy],
        cooldownActor,
        { role: 'player', adminConfig, step2UsedSoFar: 0 },
        () => 0.01
      )
    ).toBe(false);
  });

  it('3) NPC Support casts Lidar as step-2 without ending turn and then attacks in resolveMultiStepTurn', () => {
    const adminConfig = {
      ...createDefaultAdminConfig(),
      turnPhase: { maxStep2PerTurn: 1 },
    };
    const npcSupport = makeUnit('npc_sup', 'enemy', {
      isPlayer: false,
      sp: 80,
      equippedSkillIds: [LIDAR_SKILL_ID],
      skillLevels: { [LIDAR_SKILL_ID]: 1 },
    });
    const stealthedPlayer = makeUnit('p1', 'ally', {
      classId: 'striker',
      row: 'front',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });

    const res = resolveMultiStepTurn({
      units: [npcSupport, stealthedPlayer],
      actorId: 'npc_sup',
      round: 1,
      adminConfig,
      rng: () => 0.1,
      chooseNextDecision: (curUnits, curActor, locked, _stepIdx, step2Used) =>
        chooseAiDecision(curActor, curUnits, () => 0.1, adminConfig, locked, step2Used),
    });

    expect(res.step2SkillIds).toEqual([LIDAR_SKILL_ID]);
    expect(res.decisionsCount).toBe(2);
    expect(res.lastDecision?.action).toBe('attack');
    const playerAfter = res.updatedUnits.find((u) => u.id === 'p1')!;
    expect(playerAfter.statuses.some((s) => s.type === 'stealth')).toBe(false);
    expect(playerAfter.revealedThisRound).toBe(true);
  });

  it('4) chooseAiDecision does not return scan_reveal merely because an enemy is stealthed', () => {
    const adminConfig = createDefaultAdminConfig();
    const npcSupport = makeUnit('npc_sup', 'enemy', {
      isPlayer: false,
      sp: 80,
      equippedSkillIds: [LIDAR_SKILL_ID],
      skillLevels: { [LIDAR_SKILL_ID]: 1 },
    });
    const stealthedPlayer = makeUnit('p1', 'ally', {
      classId: 'striker',
      row: 'front',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });

    // High rng (0.85 >= 0.7) & step2 cap reached both reject Lidar even with stealth present
    const highRollDecision = chooseAiDecision(
      npcSupport,
      [npcSupport, stealthedPlayer],
      () => 0.85,
      adminConfig,
      [],
      0
    );
    expect(highRollDecision.skillId).not.toBe(LIDAR_SKILL_ID);
    expect(highRollDecision.action).toBe('attack');

    const cappedDecision = chooseAiDecision(
      npcSupport,
      [npcSupport, stealthedPlayer],
      () => 0.05,
      adminConfig,
      [],
      1
    );
    expect(cappedDecision.skillId).not.toBe(LIDAR_SKILL_ID);
  });

  it('5) lidarAuto disabled never scans and sanitizer fills defaults & clamps minSpPct', () => {
    const stealthedEnemy = makeUnit('e1', 'enemy', {
      classId: 'interceptor',
      isPlayer: false,
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    const actor = makeUnit('p1', 'ally', { sp: 100 });
    let rngCalled = false;

    expect(
      pickLidarCast(
        [actor, stealthedEnemy],
        actor,
        {
          role: 'player',
          lidarAuto: { enabled: false, mode: 'smart', minSpPct: 50 },
          adminConfig: createDefaultAdminConfig(),
        },
        () => {
          rngCalled = true;
          return 0.01;
        }
      )
    ).toBe(false);
    expect(rngCalled).toBe(false);

    expect(sanitizeLidarAutoConfig(undefined)).toEqual(DEFAULT_LIDAR_AUTO_CONFIG);
    expect(
      sanitizeLidarAutoConfig({ enabled: false, mode: 'fixed', minSpPct: 145 })
    ).toEqual({ enabled: false, mode: 'fixed', minSpPct: 100 });

    const sanitizedSimple = sanitizeSimpleTacticsConfig('support', {
      presetId: 'support_team',
      preferredTarget: 'support_first',
      skillUsage: 'always',
      lowHpThresholdPct: 40,
      lowHpAction: 'heal',
      elitePolicy: 'boss_only',
      prioritySkillIds: [],
    });
    expect(sanitizedSimple.lidarAuto).toEqual(DEFAULT_LIDAR_AUTO_CONFIG);
  });
});
