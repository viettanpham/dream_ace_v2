// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getBattleSkillReason } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import { createInitialBattleState, resolveUnitAction } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import { canUnitUseSkill } from '../skills';

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  return {
    id,
    name,
    callsign: name,
    side,
    row: 'front',
    formationCol: 0,
    isPlayer: false,
    classId: side === 'ally' ? 'support' : 'striker',
    level: 1,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 400,
      maxShield: 100,
      maxSp: 200,
      speed: 50,
      attackPower: 40,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 400,
    shield: 100,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('TASK ST-A1 — Lidar Sweep N-target & revealedThisRound rule', () => {
  it('1) level 1 reveals 1 of 3 stealthed opponents, level 5 reveals 3, and log names only revealed units', () => {
    const admin = createDefaultAdminConfig();
    const stealthedEnemies = [
      makeUnit('e1', 'Ghost-1', 'enemy', {
        statuses: [{ type: 'stealth', turnsRemaining: 2 }],
      }),
      makeUnit('e2', 'Ghost-2', 'enemy', {
        statuses: [{ type: 'stealth', turnsRemaining: 2 }],
      }),
      makeUnit('e3', 'Ghost-3', 'enemy', {
        statuses: [{ type: 'stealth', turnsRemaining: 2 }],
      }),
    ];

    const supLv1 = makeUnit('sup1', 'Scanner', 'ally', {
      equippedSkillIds: ['sup_lidar_sweep'],
      skillLevels: { sup_lidar_sweep: 1 },
      sp: 100,
    });
    const res1 = resolveUnitAction(
      [supLv1, ...stealthedEnemies],
      'sup1',
      'skill',
      null,
      1,
      admin,
      () => 0.1,
      'sup_lidar_sweep'
    );
    const revealed1 = res1.updatedUnits.filter(
      (u) => u.side === 'enemy' && !u.statuses.some((s) => s.type === 'stealth')
    );
    expect(revealed1).toHaveLength(1);
    expect(res1.logEntries[0].templateKey).toBe('log.scanReveal');
    expect(res1.logEntries[0].params.revealedNames).toBe(revealed1[0].name);
    for (const unrevealed of res1.updatedUnits.filter(
      (u) => u.side === 'enemy' && u.statuses.some((s) => s.type === 'stealth')
    )) {
      expect(String(res1.logEntries[0].params.revealedNames)).not.toContain(
        unrevealed.name
      );
    }

    const supLv5 = makeUnit('sup5', 'Scanner', 'ally', {
      equippedSkillIds: ['sup_lidar_sweep'],
      skillLevels: { sup_lidar_sweep: 5 },
      sp: 100,
    });
    const res5 = resolveUnitAction(
      [supLv5, ...stealthedEnemies],
      'sup5',
      'skill',
      null,
      1,
      admin,
      () => 0.5,
      'sup_lidar_sweep'
    );
    const revealed5 = res5.updatedUnits.filter(
      (u) => u.side === 'enemy' && !u.statuses.some((s) => s.type === 'stealth')
    );
    expect(revealed5).toHaveLength(3);
  });

  it('2) scan with nobody stealthed still costs 20 SP and applies the vulnerable debuff', () => {
    const admin = createDefaultAdminConfig();
    const sup = makeUnit('sup', 'Scanner', 'ally', {
      level: 1,
      equippedSkillIds: ['sup_lidar_sweep'],
      skillLevels: { sup_lidar_sweep: 1 },
      sp: 100,
    });
    const enemy = makeUnit('e1', 'Vanguard', 'enemy');

    const res = resolveUnitAction(
      [sup, enemy],
      'sup',
      'skill',
      null,
      1,
      admin,
      () => 0.5,
      'sup_lidar_sweep'
    );

    const supAfter = res.updatedUnits.find((u) => u.id === 'sup')!;
    const enemyAfter = res.updatedUnits.find((u) => u.id === 'e1')!;
    expect(supAfter.sp).toBe(80);
    expect(enemyAfter.statuses.some((s) => s.type === 'vulnerable')).toBe(true);
    expect(res.logEntries[0].templateKey).toBe('log.scanRevealNone');
  });

  it('3) a revealed unit cannot use phase shroud until the round wraps, then can', () => {
    const campaign = createFreshCampaignState();
    const adminConfig = createDefaultAdminConfig();
    const pilot = { ...campaign.pilot, activeGearId: 'striker' as const };
    const battle = createInitialBattleState(pilot, 'border_outpost', undefined, undefined, adminConfig);

    const player = battle.units.find((u) => u.isPlayer)!;
    const enemy = battle.units.find((u) => u.side === 'enemy')!;
    const trimmedUnits: CombatUnit[] = [
      {
        ...player,
        equippedSkillIds: ['str_phase_shroud'],
        skillLevels: { str_phase_shroud: 1 },
        sp: 200,
        revealedThisRound: true,
        derived: { ...player.derived, maxSp: 200, spRegenPerTurn: 0 },
      },
      { ...enemy, sp: 100 },
    ];
    battle.units = trimmedUnits;
    battle.turnOrder = [player.id, enemy.id];
    battle.activeTurnIndex = 0;
    battle.round = 1;
    battle.selectedTargetId = enemy.id;

    const blocked = canUnitUseSkill(trimmedUnits[0], 'str_phase_shroud', adminConfig);
    expect(blocked.canUse).toBe(false);
    expect(blocked.reason).toBe('revealed_this_round');
    expect(getBattleSkillReason('vi', blocked)).toBe('Vừa bị lộ diện — chờ round sau');
    expect(getBattleSkillReason('en', blocked)).toBe('Just revealed — wait for next round');

    useGameStore.setState({
      screen: 'BATTLE',
      pilot,
      adminConfig,
      battle,
      skipAnimations: true,
      autoBattleEnabled: false,
    });

    // Player defends (ends player turn, still round 1), then enemy takes turn (wraps round 1 -> 2)
    useGameStore.getState().performPlayerAction('defend');
    expect(useGameStore.getState().battle!.round).toBe(1);
    useGameStore.getState().performAiTurn();

    const afterWrap = useGameStore.getState().battle!;
    expect(afterWrap.round).toBe(2);
    const playerAfterWrap = afterWrap.units.find((u) => u.isPlayer)!;
    expect(playerAfterWrap.revealedThisRound).toBe(false);
    expect(canUnitUseSkill(playerAfterWrap, 'str_phase_shroud', adminConfig).canUse).toBe(true);
  });

  it('4) Lidar is usable even when nobody on the field is stealthed', () => {
    const admin = createDefaultAdminConfig();
    const sup = makeUnit('sup', 'Scanner', 'ally', {
      equippedSkillIds: ['sup_lidar_sweep'],
      skillLevels: { sup_lidar_sweep: 1 },
      sp: 50,
    });
    const usability = canUnitUseSkill(sup, 'sup_lidar_sweep', admin);
    expect(usability.canUse).toBe(true);
    expect(usability.spCost).toBe(20);
  });

  it('5) after a Lidar cast the turn is not ended (TURN-PH step 2) and the next decision can attack', () => {
    const campaign = createFreshCampaignState();
    const adminConfig = createDefaultAdminConfig();
    const pilot = { ...campaign.pilot, activeGearId: 'support' as const };
    const battle = createInitialBattleState(pilot, 'border_outpost', undefined, undefined, adminConfig);
    const playerIdx = battle.units.findIndex((u) => u.isPlayer);
    const player = battle.units[playerIdx];
    const enemy = battle.units.find((u) => u.side === 'enemy')!;
    battle.units[playerIdx] = {
      ...player,
      classId: 'support',
      equippedSkillIds: ['sup_lidar_sweep'],
      skillLevels: { sup_lidar_sweep: 1 },
      sp: 200,
      derived: { ...player.derived, maxSp: 200, spRegenPerTurn: 0 },
    };
    battle.turnOrder = [player.id, ...battle.turnOrder.filter((id) => id !== player.id)];
    battle.activeTurnIndex = 0;
    battle.selectedTargetId = enemy.id;

    useGameStore.setState({
      screen: 'BATTLE',
      pilot,
      adminConfig,
      battle,
      skipAnimations: true,
      autoBattleEnabled: false,
    });

    useGameStore.getState().performPlayerAction('skill', 'sup_lidar_sweep');
    const midTurn = useGameStore.getState().battle!;
    expect(midTurn.activeTurnIndex).toBe(0);
    expect(midTurn.turnStep2Used).toBe(1);

    useGameStore.getState().performPlayerAction('attack');
    const endTurn = useGameStore.getState().battle!;
    expect(endTurn.activeTurnIndex).not.toBe(0);
    expect(endTurn.turnStep2Used).toBe(0);
  });
});
