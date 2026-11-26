// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getSkillById } from '../../data/skills';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import { canUnitUseSkill } from '../skills';
import { getSkillStep } from '../turnPhase';

function seedBattle(opts?: {
  classId?: 'striker' | 'siege' | 'support' | 'interceptor';
  maxStep2PerTurn?: number;
  sp?: number;
  spRegenPerTurn?: number;
  enemyTurn?: boolean;
}) {
  const campaign = createFreshCampaignState();
  const baseAdmin = campaign.adminConfig ?? createDefaultAdminConfig();
  const adminConfig = {
    ...baseAdmin,
    turnPhase: {
      maxStep2PerTurn: opts?.maxStep2PerTurn ?? 1,
    },
  };
  const classId = opts?.classId ?? 'striker';
  const pilot = {
    ...campaign.pilot,
    activeGearId: classId,
  };
  const battle = createInitialBattleState(pilot, 'border_outpost', undefined, undefined, adminConfig);
  const playerIdx = battle.units.findIndex((u) => u.isPlayer);
  const player = battle.units[playerIdx];
  const equipped =
    classId === 'siege'
      ? ['sge_anchor_protocol', 'gen_hull_brace']
      : ['str_hotload_shells', 'gen_hull_brace'];
  battle.units[playerIdx] = {
    ...player,
    equippedSkillIds: equipped,
    skillLevels: Object.fromEntries(equipped.map((id) => [id, 1])),
    sp: opts?.sp ?? 100,
    derived: {
      ...player.derived,
      maxSp: 200,
      spRegenPerTurn: opts?.spRegenPerTurn ?? 5,
    },
  };

  if (opts?.enemyTurn) {
    const enemyIdx = battle.units.findIndex((u) => u.side === 'enemy');
    const enemy = battle.units[enemyIdx];
    battle.units[enemyIdx] = {
      ...enemy,
      classId: 'support',
      equippedSkillIds: ['sup_lidar_sweep'],
      skillLevels: { sup_lidar_sweep: 1 },
      sp: 100,
      derived: {
        ...enemy.derived,
        maxSp: 200,
        spRegenPerTurn: 0,
      },
    };
    battle.units[playerIdx] = {
      ...battle.units[playerIdx],
      statuses: [
        {
          type: 'stealth',
          turnsRemaining: 2,
          magnitude: 1,
          sourceName: battle.units[playerIdx].name,
        },
      ],
    };
    battle.turnOrder = [
      battle.units[enemyIdx].id,
      ...battle.turnOrder.filter((id) => id !== battle.units[enemyIdx].id),
    ];
  } else {
    battle.turnOrder = [
      player.id,
      ...battle.turnOrder.filter((id) => id !== player.id),
    ];
  }
  battle.activeTurnIndex = 0;
  battle.selectedTargetId =
    battle.units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null;

  useGameStore.setState({
    screen: 'BATTLE',
    pilot,
    adminConfig,
    battle,
    skipAnimations: true,
    autoBattleEnabled: false,
  });

  return useGameStore.getState();
}

describe('TASK TURN-PH — 3-step turn phase engine, player, AI & Admin', () => {
  beforeEach(() => {
    seedBattle();
  });

  it('1) getSkillStep classifies self/allies as step 2, attacks as step 3, and honors sup_lidar_sweep phaseOverride', () => {
    expect(getSkillStep(getSkillById('str_phase_shroud')!)).toBe(2);
    expect(getSkillStep(getSkillById('sup_nanite_mend')!)).toBe(2);
    expect(getSkillStep(getSkillById('sup_flux_transfer')!)).toBe(2);
    expect(getSkillStep(getSkillById('sup_lidar_sweep')!)).toBe(2);
    expect(getSkillStep(getSkillById('int_sabot_burst')!)).toBe(3);
  });

  it('2) player buff keeps turn (step 2), caps at 1 step-2 buff, and skips double SP regen on main action', () => {
    const startOrderActor = useGameStore.getState().battle!.turnOrder[0];
    const startSp = useGameStore
      .getState()
      .battle!.units.find((u) => u.id === startOrderActor)!.sp;

    // Step 2: self buff
    useGameStore.getState().performPlayerAction('skill', 'str_hotload_shells');
    const afterBuff = useGameStore.getState().battle!;
    expect(afterBuff.activeTurnIndex).toBe(0);
    expect(afterBuff.turnStep2Used).toBe(1);
    expect(afterBuff.turnLockedSkillIds).toContain('str_hotload_shells');
    const actorMid = afterBuff.units.find((u) => u.id === startOrderActor)!;
    const spGainAfterFirst = actorMid.sp - startSp; // regen (+5) - skill cost

    // Step 3: 2nd buff hits cap (maxStep2PerTurn = 1) so it executes as main action and ends turn without 2nd SP regen
    useGameStore.getState().performPlayerAction('skill', 'gen_hull_brace');
    const afterMain = useGameStore.getState().battle!;
    expect(afterMain.activeTurnIndex).not.toBe(0);
    expect(afterMain.turnStep2Used).toBe(0);
    expect(afterMain.turnLockedSkillIds).toEqual([]);
    const actorEnd = afterMain.units.find((u) => u.id === startOrderActor)!;
    expect(actorEnd.sp).toBeLessThan(actorMid.sp); // no +5 regen re-applied
    expect(spGainAfterFirst).toBeLessThan(5);
  });

  it('3) cooldown-0 skill used in step 2 is locked in turnLockedSkillIds for rest of turn', () => {
    seedBattle({ classId: 'siege', maxStep2PerTurn: 1 });
    useGameStore.getState().performPlayerAction('skill', 'sge_anchor_protocol');
    const battle = useGameStore.getState().battle!;
    expect(battle.activeTurnIndex).toBe(0);
    expect(battle.turnLockedSkillIds).toContain('sge_anchor_protocol');
    const actor: CombatUnit = battle.units.find(
      (u) => u.id === battle.turnOrder[battle.activeTurnIndex]
    )!;
    const usability = canUnitUseSkill(
      actor,
      'sge_anchor_protocol',
      useGameStore.getState().adminConfig,
      battle.turnLockedSkillIds
    );
    expect(usability.canUse).toBe(false);
    expect(usability.reason).toBe('used_this_turn');
  });

  it('4) maxStep2PerTurn = 0 restores legacy turn-ending behavior on buff skills', () => {
    seedBattle({ maxStep2PerTurn: 0 });
    useGameStore.getState().performPlayerAction('skill', 'str_hotload_shells');
    const battle = useGameStore.getState().battle!;
    expect(battle.activeTurnIndex).not.toBe(0);
    expect(battle.turnStep2Used).toBe(0);
    expect(battle.turnLockedSkillIds).toEqual([]);
  });

  it('5) AI multi-step turn casts sup_lidar_sweep (step 2) against stealthed foe then attacks in the same turn', () => {
    seedBattle({ enemyTurn: true, maxStep2PerTurn: 1 });
    const before = useGameStore.getState().battle!;
    const enemyId = before.turnOrder[0];

    useGameStore.getState().performAiTurn();
    const after = useGameStore.getState().battle!;
    expect(after.activeTurnIndex).not.toBe(0);
    expect(after.turnStep2Used).toBe(0);
    expect(after.turnLockedSkillIds).toEqual([]);

    const turnEvents = after.events.filter(
      (ev) => ev.actorId === enemyId && ev.turn === after.turnCounter
    );
    expect(
      turnEvents.some((ev) => ev.type === 'skill_cast' && ev.skillId === 'sup_lidar_sweep')
    ).toBe(true);
    expect(turnEvents.some((ev) => ev.type === 'damage')).toBe(true);
  });
});
