// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleScreen } from '../../components/BattleScreen';
import { FieldSuppliesSheet } from '../../components/FieldSuppliesSheet';
import { getSupplyTemplateById } from '../../data/consumables';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import {
  applyBattleSupplyUse,
  getBattleSupplyRows,
  tickSupplyState,
} from '../supplies';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally_player',
    name: 'Kestrel',
    callsign: 'K-01',
    side: 'ally',
    row: 'front',
    isPlayer: true,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: {
      attack: 30,
      defense: 20,
      fuel: 15,
      spirit: 15,
      shield: 20,
      evasion: 10,
    },
    derived: {
      maxHp: 500,
      maxShield: 200,
      maxSp: 100,
      speed: 40,
      attackPower: 30,
      defenseRating: 20,
      skillPower: 25,
      critChance: 15,
      dodgeChance: 10,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 200,
    shield: 80,
    sp: 40,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function seedStoreBattle(opts?: {
  hp?: number;
  shield?: number;
  loadout?: string[];
  consumables?: Array<{ id: string; templateId: string; quantity: number }>;
  enemyTurn?: boolean;
}) {
  const campaign = createFreshCampaignState();
  const baseAdminConfig = campaign.adminConfig ?? createDefaultAdminConfig();
  const adminConfig = {
    ...baseAdminConfig,
    prestage: {
      ...(baseAdminConfig.prestage ?? { enabled: false, countdownSec: 0 }),
      enabled: false,
    },
  };
  const pilot = {
    ...campaign.pilot,
    gears: {
      ...campaign.pilot.gears,
      [campaign.pilot.activeGearId]: {
        ...campaign.pilot.gears[campaign.pilot.activeGearId],
        supplyLoadout: opts?.loadout ?? ['sup_hp_t2', 'sup_shield_t1'],
      },
    },
    consumables: (opts?.consumables ?? [
      { id: 'supply_sup_hp_t2', templateId: 'sup_hp_t2', quantity: 5 },
      { id: 'supply_sup_shield_t1', templateId: 'sup_shield_t1', quantity: 2 },
    ]).map((c) => ({
      id: c.id,
      kind: 'battle_supply' as const,
      templateId: c.templateId,
      quantity: c.quantity,
    })),
  };

  const battle = createInitialBattleState(pilot, 'border_outpost', undefined, undefined, adminConfig);
  const playerIdx = battle.units.findIndex((u) => u.isPlayer);
  const playerUnit = battle.units[playerIdx];
  const enemyIdx = battle.units.findIndex((u) => u.side === 'enemy');
  battle.units[playerIdx] = {
    ...playerUnit,
    hp: opts?.hp ?? Math.floor(playerUnit.derived.maxHp * 0.4),
    shield: opts?.shield ?? Math.floor(playerUnit.derived.maxShield * 0.4),
  };
  battle.turnOrder = opts?.enemyTurn
    ? [battle.units[enemyIdx].id, playerUnit.id]
    : [playerUnit.id, ...battle.turnOrder.filter((id) => id !== playerUnit.id)];
  battle.activeTurnIndex = 0;

  useGameStore.setState({
    screen: 'BATTLE',
    pilot,
    adminConfig,
    battle,
    skipAnimations: false,
    autoBattleEnabled: false,
  });
}

describe('TASK CS2 — Battle Supply Use, Cooldowns, Stock & Sheet', () => {
  beforeEach(() => {
    seedStoreBattle();
  });

  it('1) applyBattleSupplyUse heals + blocks 2nd use in same turn (turn_limit) + store keeps active turn', () => {
    const hpKit = getSupplyTemplateById('sup_hp_t2')!;
    const spKit = getSupplyTemplateById('sup_sp_t1')!;
    const unit = makeUnit({ hp: 200, sp: 20 });

    const first = applyBattleSupplyUse({
      units: [unit],
      supplyByUnit: {},
      unitId: unit.id,
      template: hpKit,
      stock: 3,
      isOwnTurn: true,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.gains.hp).toBe(300);
    expect(first.units[0].hp).toBe(500);

    const second = applyBattleSupplyUse({
      units: first.units,
      supplyByUnit: first.supplyByUnit,
      unitId: unit.id,
      template: spKit,
      stock: 3,
      isOwnTurn: true,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe('turn_limit');
    }

    const before = useGameStore.getState().battle!;
    const playerBefore = before.units.find((u) => u.isPlayer)!;
    const prevTurnIndex = before.activeTurnIndex;
    const prevTurnCounter = before.turnCounter;

    useGameStore.getState().useBattleSupply('sup_hp_t2');
    const after = useGameStore.getState().battle!;
    const playerAfter = after.units.find((u) => u.isPlayer)!;

    expect(playerAfter.hp).toBeGreaterThan(playerBefore.hp);
    expect(after.activeTurnIndex).toBe(prevTurnIndex);
    expect(after.turnCounter).toBe(prevTurnCounter);
    expect(after.log[after.log.length - 1]?.templateKey).toBe('log.useSupply');
    expect(after.popups.length).toBeGreaterThan(0);
    expect(after.fxEvents.length).toBeGreaterThan(0);
  });

  it('2) cooldown blocks for 2 own turns after use, free on 3rd, and battle limit 3 blocks 4th', () => {
    const hpKit = getSupplyTemplateById('sup_hp_t2')!; // cd 2, limit 3
    let units = [makeUnit({ hp: 100 })];
    let supplyByUnit = {} as NonNullable<ReturnType<typeof createInitialBattleState>['supplyByUnit']>;

    // Use #1 on turn 1, then tick at end of turn 1 + turn 2 + turn 3
    const u1 = applyBattleSupplyUse({ units, supplyByUnit, unitId: 'ally_player', template: hpKit, stock: 5, isOwnTurn: true });
    expect(u1.ok).toBe(true);
    if (!u1.ok) return;
    units = u1.units;
    supplyByUnit = { ally_player: tickSupplyState(u1.supplyByUnit.ally_player) }; // end turn 1 -> cd left: 2

    const blockedTurn2 = applyBattleSupplyUse({ units, supplyByUnit, unitId: 'ally_player', template: hpKit, stock: 4, isOwnTurn: true });
    expect(blockedTurn2.ok).toBe(false);
    if (!blockedTurn2.ok) expect(blockedTurn2.reason).toBe('cooldown');
    supplyByUnit = { ally_player: tickSupplyState(supplyByUnit.ally_player) }; // end turn 2 -> cd left: 1

    const blockedTurn3 = applyBattleSupplyUse({ units, supplyByUnit, unitId: 'ally_player', template: hpKit, stock: 4, isOwnTurn: true });
    expect(blockedTurn3.ok).toBe(false);
    if (!blockedTurn3.ok) expect(blockedTurn3.reason).toBe('cooldown');
    supplyByUnit = { ally_player: tickSupplyState(supplyByUnit.ally_player) }; // end turn 3 -> cd 0

    // Use #2..#5 (drop HP first so not full with flat 500 heal)
    for (let useNum = 2; useNum <= 5; useNum++) {
      units = [{ ...units[0], hp: 100 }];
      const nextUse = applyBattleSupplyUse({ units, supplyByUnit, unitId: 'ally_player', template: hpKit, stock: 6 - useNum, isOwnTurn: true });
      expect(nextUse.ok).toBe(true);
      if (!nextUse.ok) return;
      units = nextUse.units;
      supplyByUnit = { ally_player: tickSupplyState(tickSupplyState(tickSupplyState(nextUse.supplyByUnit.ally_player))) };
    }

    // 6th attempt hits battle_limit (5)
    units = [{ ...units[0], hp: 100 }];
    const u6 = applyBattleSupplyUse({ units, supplyByUnit, unitId: 'ally_player', template: hpKit, stock: 2, isOwnTurn: true });
    expect(u6.ok).toBe(false);
    if (!u6.ok) expect(u6.reason).toBe('battle_limit');

    // Also verify store performPlayerAction ticks cooldown at end of own action
    useGameStore.getState().useBattleSupply('sup_hp_t2');
    const pid = useGameStore.getState().battle!.units.find((u) => u.isPlayer)!.id;
    expect(useGameStore.getState().battle!.supplyByUnit?.[pid]?.cooldownsByTemplate.sup_hp_t2).toBe(3);
    useGameStore.getState().performPlayerAction('defend');
    expect(useGameStore.getState().battle!.supplyByUnit?.[pid]?.cooldownsByTemplate.sup_hp_t2).toBe(2);
    expect(useGameStore.getState().battle!.supplyByUnit?.[pid]?.usedThisTurn).toBe(0);
  });

  it('3) decrements pilot stock by 1, removes stack at 0, and refuses template outside loadout', () => {
    seedStoreBattle({
      loadout: ['sup_hp_t2'],
      consumables: [
        { id: 'supply_sup_hp_t2', templateId: 'sup_hp_t2', quantity: 1 },
        { id: 'supply_sup_sp_t1', templateId: 'sup_sp_t1', quantity: 4 },
      ],
    });

    const hpBefore = useGameStore.getState().battle!.units.find((u) => u.isPlayer)!.hp;
    useGameStore.getState().useBattleSupply('sup_sp_t1'); // not in loadout
    expect(useGameStore.getState().battle!.units.find((u) => u.isPlayer)!.hp).toBe(hpBefore);
    expect(useGameStore.getState().pilot.consumables?.find((c) => c.templateId === 'sup_sp_t1')?.quantity).toBe(4);

    useGameStore.getState().useBattleSupply('sup_hp_t2');
    expect(useGameStore.getState().pilot.consumables?.some((c) => c.templateId === 'sup_hp_t2')).toBe(false);
  });

  it('4) shield kit blocked while shield_break and nothing usable on enemy turn', () => {
    const state = useGameStore.getState();
    const battle = state.battle!;
    const pIdx = battle.units.findIndex((u) => u.isPlayer);
    battle.units[pIdx] = {
      ...battle.units[pIdx],
      statuses: [{ type: 'shield_break', turnsRemaining: 2 }],
    };

    const rowsBreak = getBattleSupplyRows(battle, state.pilot, state.adminConfig);
    const shieldRow = rowsBreak.rows.find((r) => r.templateId === 'sup_shield_t1')!;
    expect(shieldRow.ok).toBe(false);
    expect(shieldRow.reason).toBe('shield_broken');
    expect(rowsBreak.usableCount).toBe(1); // hp kit still usable

    seedStoreBattle({ enemyTurn: true });
    const enemyState = useGameStore.getState();
    const rowsEnemyTurn = getBattleSupplyRows(enemyState.battle, enemyState.pilot, enemyState.adminConfig);
    expect(rowsEnemyTurn.isPlayerTurn).toBe(false);
    expect(rowsEnemyTurn.usableCount).toBe(0);
    expect(rowsEnemyTurn.rows.filter((r) => r.templateId !== null).every((r) => r.reason === 'not_your_turn')).toBe(true);
  });

  it('5) renders FieldSuppliesSheet rows/reasons/empty hints and BattleScreen badge count', () => {
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate('vi', key, params);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const state = useGameStore.getState();
    const summary = getBattleSupplyRows(state.battle, state.pilot, state.adminConfig);
    expect(summary.usableCount).toBe(2);

    const onUseSupply = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        createElement(FieldSuppliesSheet, {
          open: true,
          t,
          onClose,
          onOpenTactics: vi.fn(),
          onReloadBattle: vi.fn(),
          rows: summary.rows,
          usedThisTurn: summary.usedThisTurn,
          usesPerTurn: summary.usesPerTurn,
          hasLoadout: summary.hasLoadout,
          onUseSupply,
        })
      );
    });

    expect(container.textContent).toContain('Dùng 0/1 lượt này');
    expect(container.textContent).toContain('x5');
    expect(container.textContent).toContain('0/10 trận');
    expect(container.textContent).toContain('Ô trống — chọn ở GEAR > Túi vật tư');

    const useBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="supply-use-btn-sup_hp_t2"]'
    );
    expect(useBtn).not.toBeNull();
    act(() => {
      useBtn?.click();
    });
    expect(onUseSupply).toHaveBeenCalledWith('sup_hp_t2');
    expect(onClose).not.toHaveBeenCalled();

    // Empty loadout mode
    act(() => {
      root.render(
        createElement(FieldSuppliesSheet, {
          open: true,
          t,
          onClose,
          onOpenTactics: vi.fn(),
          onReloadBattle: vi.fn(),
          rows: [],
          usedThisTurn: 0,
          usesPerTurn: 1,
          hasLoadout: false,
        })
      );
    });
    expect(container.textContent).toContain('Chưa mang vật tư');
    expect(container.textContent).toContain('Ô trống — chọn ở GEAR > Túi vật tư');

    // BattleScreen badge count visible when > 0, hidden when 0
    act(() => {
      root.render(createElement(BattleScreen));
    });
    const badges = container.querySelectorAll('[data-testid="battle-action-item-badge"]');
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0]?.textContent).toBe('2');

    act(() => {
      useGameStore.getState().useBattleSupply('sup_hp_t2');
    });
    expect(container.querySelectorAll('[data-testid="battle-action-item-badge"]').length).toBe(0);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
