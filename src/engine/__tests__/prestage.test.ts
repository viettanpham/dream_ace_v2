// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import { applyPrestageBuffs } from '../prestage';

function createEnabledAdminConfig() {
  return {
    ...createDefaultAdminConfig(),
    prestage: {
      enabled: true,
      countdownSec: 3,
    },
  };
}

describe('TASK PREP-1a — Pre-stage buffs & start gate', () => {
  it('1) applyPrestageBuffs applies self stat buff with normal duration, no SP spent, and cooldown unchanged', () => {
    const campaign = createFreshCampaignState('Vance', 'striker');
    const baseBattle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      () => 0.5
    );
    const playerIdx = baseBattle.units.findIndex((u) => u.isPlayer);
    const startSp = baseBattle.units[playerIdx].sp;
    baseBattle.units[playerIdx] = {
      ...baseBattle.units[playerIdx],
      equippedSkillIds: ['str_hotload_shells', 'gen_hull_brace'],
      skillLevels: { str_hotload_shells: 1, gen_hull_brace: 1 },
      skillCooldowns: {},
    };

    const res = applyPrestageBuffs(baseBattle.units, createEnabledAdminConfig());
    const player = res.units[playerIdx];

    expect(player.sp).toBe(startSp);
    expect(player.skillCooldowns).toEqual({});
    expect(player.statuses.find((s) => s.type === 'primary_dmg_up')?.turnsRemaining).toBe(3);
    expect(player.statuses.find((s) => s.type === 'def_up')?.turnsRemaining).toBe(3);
    expect(res.appliedByUnit[player.id]).toEqual(
      expect.arrayContaining(['str_hotload_shells', 'gen_hull_brace'])
    );
  });

  it('2) applyPrestageBuffs skips heal, stealth, and scan_reveal skills', () => {
    const campaign = createFreshCampaignState('Vance', 'support');
    const baseBattle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      () => 0.5
    );
    const units = baseBattle.units.map((u, idx) =>
      idx === 0
        ? {
            ...u,
            equippedSkillIds: [
              'sup_nanite_mend',
              'sup_regen_grid',
              'sup_lidar_sweep',
              'str_phase_shroud',
            ],
            statuses: [],
          }
        : { ...u, equippedSkillIds: [], statuses: [] }
    );

    const res = applyPrestageBuffs(units, createEnabledAdminConfig());
    expect(res.units[0].statuses).toEqual([]);
    expect(res.appliedByUnit[res.units[0].id]).toBeUndefined();
  });

  it('3) applyPrestageBuffs buffs both ally and enemy sides without stacking the same status twice', () => {
    const campaign = createFreshCampaignState('Vance', 'support');
    const baseBattle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      () => 0.5
    );
    const ally0 = baseBattle.units.find((u) => u.side === 'ally')!;
    const enemy0 = baseBattle.units.find((u) => u.side === 'enemy')!;
    const units: CombatUnit[] = baseBattle.units.map((u): CombatUnit => {
      if (u.id === ally0.id) {
        return {
          ...u,
          equippedSkillIds: ['gen_hull_brace', 'sup_iron_canopy'],
          skillLevels: { gen_hull_brace: 1, sup_iron_canopy: 1 },
          statuses: [],
        };
      }
      if (u.id === enemy0.id) {
        return {
          ...u,
          equippedSkillIds: ['gen_thruster_feint'],
          skillLevels: { gen_thruster_feint: 1 },
          statuses: [],
        };
      }
      return { ...u, equippedSkillIds: [], statuses: [] };
    });

    const res = applyPrestageBuffs(units, createEnabledAdminConfig());
    const alliesAfter = res.units.filter((u) => u.side === 'ally' && u.alive);
    const enemyAfter = res.units.find((u) => u.id === enemy0.id)!;

    for (const a of alliesAfter) {
      expect(a.statuses.filter((s) => s.type === 'def_up')).toHaveLength(1);
    }
    expect(enemyAfter.statuses.some((s) => s.type === 'eva_up')).toBe(true);
  });

  it('4) gated battle ignores performAiTurn and performPlayerAction until confirmPrestage() logs "Vào trận"', () => {
    const campaign = createFreshCampaignState('Vance', 'striker');
    const adminConfig = createEnabledAdminConfig();
    const battle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      () => 0.5,
      undefined,
      adminConfig
    );
    const player = battle.units.find((u) => u.isPlayer)!;
    const enemy = battle.units.find((u) => u.side === 'enemy')!;

    // Test AI turn block first
    battle.turnOrder = [enemy.id, player.id];
    battle.activeTurnIndex = 0;
    useGameStore.setState({
      screen: 'BATTLE',
      pilot: campaign.pilot,
      adminConfig,
      battle,
      skipAnimations: true,
      autoBattleEnabled: false,
    });

    useGameStore.getState().performAiTurn();
    expect(useGameStore.getState().battle!.turnCounter).toBe(0);
    expect(useGameStore.getState().battle!.prestage?.active).toBe(true);

    // Test player action block while gated
    useGameStore.setState({
      battle: {
        ...useGameStore.getState().battle!,
        turnOrder: [player.id, enemy.id],
        activeTurnIndex: 0,
      },
    });
    useGameStore.getState().performPlayerAction('attack');
    expect(useGameStore.getState().battle!.turnCounter).toBe(0);

    // Confirm prestage -> unlocks gate and logs SYSTEM "Vào trận"
    useGameStore.getState().confirmPrestage();
    const afterConfirm = useGameStore.getState().battle!;
    expect(afterConfirm.prestage?.active).toBe(false);
    const lastLog = afterConfirm.log[afterConfirm.log.length - 1];
    expect(lastLog.tag).toBe('SYSTEM');
    expect(lastLog.templateKey).toBe('log.prestageConfirm');
    expect(formatCombatLogMessage('vi', lastLog)).toBe('Vào trận');

    // Now player action executes normally
    useGameStore.getState().performPlayerAction('attack');
    expect(useGameStore.getState().battle!.turnCounter).toBeGreaterThan(0);
  });

  it('5) when adminConfig.prestage.enabled is false, battle starts without gate or prestage buffs', () => {
    const campaign = createFreshCampaignState('Vance', 'striker');
    const adminConfig = {
      ...createDefaultAdminConfig(),
      prestage: { enabled: false, countdownSec: 3 },
    };
    const battle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      () => 0.5,
      undefined,
      adminConfig
    );

    expect(battle.prestage?.active).toBe(false);
    expect(battle.prestage?.appliedByUnit).toEqual({});
    expect(battle.units.every((u) => u.statuses.length === 0)).toBe(true);
  });
});
