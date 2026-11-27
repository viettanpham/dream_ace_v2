// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { createDefaultAdminConfig, createFreshCampaignState } from '../../engine/migration';
import {
  buildAllySupplyBagSummary,
  buildPrestageSummary,
} from '../../engine/prestage';
import type { BattleSupplyRow } from '../../engine/supplies';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit, MechClassId } from '../../types/game';
import { BattleScreen } from '../BattleScreen';
import { PrestageDialog } from '../PrestageDialog';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const t = (key: TranslationKey, params?: Record<string, string | number>) =>
  translate('vi', key, params);

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  classId: MechClassId,
  level: number,
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
    classId,
    level,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 1000,
      maxShield: 500,
      maxSp: 100,
      speed: 80,
      attackPower: 50,
      defenseRating: 25,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    hp: 1000,
    shield: 500,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(units: CombatUnit[], overrides: Partial<BattleState> = {}): BattleState {
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 8 as BattleState['squadSize'],
    round: 1,
    turnCounter: 0,
    turnOrder: units.map((u) => u.id),
    activeTurnIndex: 0,
    units,
    selectedTargetId: units.find((u) => u.side === 'enemy')?.id ?? null,
    selectedAllyTargetId: units.find((u) => u.side === 'ally')?.id ?? null,
    lastPlayerTargetId: units.find((u) => u.side === 'enemy')?.id ?? null,
    autoStopNotice: null,
    wingmanChat: null,
    log: [],
    events: [],
    roundSnapshots: [],
    fxEvents: [],
    popups: [],
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
    prestage: { active: true, appliedByUnit: {} },
    ...overrides,
  };
}

describe('TASK PREP-1b — PrestageDialog & buildPrestageSummary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 800,
    });
    const fresh = createFreshCampaignState('Pilot', 'striker', () => 0.5);
    useGameStore.setState({
      language: 'vi',
      screen: 'BATTLE',
      autoBattleEnabled: false,
      adminConfig: createDefaultAdminConfig(),
      pilot: fresh.pilot,
      battle: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    useGameStore.setState({ battle: null, autoBattleEnabled: false });
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1) buildPrestageSummary computes counts, level min/max/avg, avg HP/Shield%, status counts, and hides enemy statuses', () => {
    const units: CombatUnit[] = [
      makeUnit('a1', 'Cmdr', 'ally', 'striker', 10, {
        isPlayer: true,
        hp: 800,
        shield: 500,
        statuses: [{ type: 'atk_up', turnsRemaining: 3, magnitude: 15 }],
      }),
      makeUnit('a2', 'Ally2', 'ally', 'striker', 13, {
        hp: 600,
        shield: 250,
        statuses: [
          { type: 'atk_up', turnsRemaining: 2, magnitude: 15 },
          { type: 'def_up', turnsRemaining: 2, magnitude: 15 },
        ],
      }),
      makeUnit('a3', 'Ally3', 'ally', 'support', 11),
      makeUnit('e1', 'EnemyBoss', 'enemy', 'siege', 18, {
        isBoss: true,
        statuses: [{ type: 'def_up', turnsRemaining: 3, magnitude: 20 }],
      }),
      makeUnit('e2', 'EnemyGrunt', 'enemy', 'siege', 12, {
        statuses: [{ type: 'eva_up', turnsRemaining: 3, magnitude: 20 }],
      }),
    ];

    const ally = buildPrestageSummary(units, 'ally', true);
    expect(ally.total).toBe(3);
    expect(ally.commander?.id).toBe('a1');
    expect(ally.byClass.map((c) => [c.classId, c.count])).toEqual([
      ['striker', 2],
      ['support', 1],
    ]);
    expect(ally.byClass[0]).toMatchObject({
      levelMin: 10,
      levelMax: 13,
      levelAvg: 12,
      avgHpPct: 70,
      avgShieldPct: 75,
      statuses: [
        { type: 'atk_up', count: 2 },
        { type: 'def_up', count: 1 },
      ],
    });

    const enemy = buildPrestageSummary(units, 'enemy', false);
    expect(enemy.total).toBe(2);
    expect(enemy.commander?.id).toBe('e1');
    expect(enemy.byClass[0].statuses).toEqual([]);
  });

  it('2) switches between list mode at size 8 and grouped mode at size 12 when groupFromSize is 10', () => {
    const adminConfig = {
      ...createDefaultAdminConfig(),
      prestage: { enabled: true, countdownSec: 3, groupFromSize: 10 },
    };
    const mkSquad = (n: number): CombatUnit[] => [
      ...Array.from({ length: n }, (_, i) =>
        makeUnit(`a_${i}`, `Ally ${i}`, 'ally', i % 2 === 0 ? 'striker' : 'support', 10 + i, {
          isPlayer: i === 0,
        })
      ),
      ...Array.from({ length: n }, (_, i) =>
        makeUnit(`e_${i}`, `Enemy ${i}`, 'enemy', i % 2 === 0 ? 'interceptor' : 'siege', 10 + i)
      ),
    ];

    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(mkSquad(8)),
          supplyRows: [],
          adminConfig,
          autoLoopActive: false,
          lang: 'vi',
          t,
          onConfirm: () => {},
        })
      );
    });
    expect(container.querySelector('[data-testid="prestage-dialog"]')?.getAttribute('data-mode')).toBe('list');
    expect(container.querySelector('[data-testid="prestage-ally-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="prestage-ally-grouped"]')).toBeNull();

    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(mkSquad(12)),
          supplyRows: [],
          adminConfig,
          autoLoopActive: false,
          lang: 'vi',
          t,
          onConfirm: () => {},
        })
      );
    });
    expect(container.querySelector('[data-testid="prestage-dialog"]')?.getAttribute('data-mode')).toBe('grouped');
    expect(container.querySelector('[data-testid="prestage-ally-grouped"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="prestage-ally-list"]')).toBeNull();
    expect(container.querySelector('[data-testid="prestage-group-ally-striker"]')).not.toBeNull();
  });

  it('3) BattleScreen shows PrestageDialog when battle.prestage.active is true and hides it after confirmPrestage', () => {
    const units = [
      makeUnit('a1', 'Vanguard', 'ally', 'striker', 10, { isPlayer: true }),
      makeUnit('e1', 'Raider', 'enemy', 'interceptor', 10),
    ];
    useGameStore.setState({
      battle: makeBattle(units),
    });

    act(() => {
      root.render(createElement(BattleScreen));
    });
    const confirmBtn = container.querySelector('[data-testid="prestage-confirm-btn"]') as HTMLButtonElement | null;
    expect(confirmBtn).not.toBeNull();

    act(() => {
      confirmBtn!.click();
    });
    expect(useGameStore.getState().battle?.prestage?.active).toBe(false);
    expect(container.querySelector('[data-testid="prestage-dialog"]')).toBeNull();
  });

  it('4) enemy side displays "Không có tình báo" and never shows enemy buff icons', () => {
    const units = [
      makeUnit('a1', 'Ally1', 'ally', 'striker', 10, {
        isPlayer: true,
        statuses: [{ type: 'atk_up', turnsRemaining: 3, magnitude: 15 }],
      }),
      makeUnit('e1', 'Enemy1', 'enemy', 'siege', 12, {
        statuses: [
          { type: 'def_up', turnsRemaining: 3, magnitude: 20 },
          { type: 'eva_up', turnsRemaining: 3, magnitude: 20 },
        ],
      }),
    ];
    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(units),
          supplyRows: [],
          adminConfig: createDefaultAdminConfig(),
          autoLoopActive: false,
          lang: 'vi',
          t,
          onConfirm: () => {},
        })
      );
    });

    const enemyPanel = container.querySelector('[data-testid="prestage-side-enemy"]');
    const enemyRow = container.querySelector('[data-testid="prestage-row-e1"]');
    expect(
      container.querySelector('[data-testid="prestage-enemy-intel-strip"]')?.textContent
    ).toContain('Không có tình báo');
    expect(enemyPanel?.textContent).toContain('(ẩn)');
    expect(enemyRow?.querySelectorAll('.material-symbols-outlined').length).toBe(0);
    expect(enemyRow?.textContent).not.toContain('Tăng DEF');
  });

  it('5) autoLoopActive skips PrestageDialog immediately even with countdownSec > 0, while manual and 1-battle AUTO still show it', () => {
    const onConfirmLoop3 = vi.fn();
    const units = [
      makeUnit('a1', 'Ally1', 'ally', 'striker', 10, { isPlayer: true }),
      makeUnit('e1', 'Enemy1', 'enemy', 'interceptor', 10),
    ];
    const cfg3 = {
      ...createDefaultAdminConfig(),
      prestage: { enabled: true, countdownSec: 3, groupFromSize: 10 },
    };

    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(units),
          supplyRows: [],
          adminConfig: cfg3,
          autoLoopActive: true,
          lang: 'vi',
          t,
          onConfirm: onConfirmLoop3,
        })
      );
    });

    expect(container.querySelector('[data-testid="prestage-dialog"]')).toBeNull();
    expect(onConfirmLoop3).toHaveBeenCalledTimes(1);

    // 1-battle AUTO (autoBattleEnabled: true, no autoRepeatSession) still renders PrestageDialog
    useGameStore.setState({
      autoBattleEnabled: true,
      autoRepeatSession: null,
      adminConfig: cfg3,
      battle: makeBattle(units),
    });
    act(() => {
      root.render(createElement(BattleScreen));
    });
    expect(container.querySelector('[data-testid="prestage-dialog"]')).not.toBeNull();
  });

  it('6) buildAllySupplyBagSummary merges team supplyByUnit + player supplyRows by family+tier, sorts by family then tier, and shows empty state', () => {
    const units = [
      makeUnit('a1', 'Leader', 'ally', 'striker', 10, { isPlayer: true }),
      makeUnit('a2', 'Wingman', 'ally', 'support', 10),
      makeUnit('e1', 'Enemy1', 'enemy', 'interceptor', 10),
    ];
    const playerRows: BattleSupplyRow[] = [
      {
        slotIndex: 0,
        templateId: 'sup_shield_t2',
        iconId: 'BS05',
        name: 'Shield T2',
        nameKey: null,
        effectSummary: '',
        effects: [],
        stock: 8,
        usedCount: 0,
        limit: 5,
        ok: true,
        reason: null,
        reasonKey: null,
      },
      {
        slotIndex: 1,
        templateId: 'sup_hp_t4',
        iconId: 'SS01',
        name: 'HP T4',
        nameKey: null,
        effectSummary: '',
        effects: [],
        stock: 5,
        usedCount: 0,
        limit: 5,
        ok: true,
        reason: null,
        reasonKey: null,
      },
      {
        slotIndex: 2,
        templateId: 'sup_hp_t3',
        iconId: 'SS01',
        name: 'HP T3',
        nameKey: null,
        effectSummary: '',
        effects: [],
        stock: 10,
        usedCount: 0,
        limit: 5,
        ok: true,
        reason: null,
        reasonKey: null,
      },
    ];
    const supplyByUnit = {
      a2: {
        usedThisTurn: 0,
        usedCountsByTemplate: {},
        cooldownsByTemplate: {},
        stockByTemplate: { sup_hp_t3: 6 },
      },
      e1: {
        usedThisTurn: 0,
        usedCountsByTemplate: {},
        cooldownsByTemplate: {},
        stockByTemplate: { sup_sp_t5: 99 },
      },
    };

    const merged = buildAllySupplyBagSummary(units, supplyByUnit, playerRows);
    expect(merged).toEqual([
      { family: 'hp_kit', tier: 3, count: 16 },
      { family: 'hp_kit', tier: 4, count: 5 },
      { family: 'shield_kit', tier: 2, count: 8 },
    ]);

    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(units, { supplyByUnit }),
          supplyRows: playerRows,
          adminConfig: createDefaultAdminConfig(),
          autoLoopActive: false,
          lang: 'vi',
          t,
          onConfirm: () => {},
        })
      );
    });
    expect(
      container.querySelector('[data-testid="prestage-ally-supply-strip"]')?.textContent
    ).toBe('Túi vật tư (cả phe): HP T3 x16 · HP T4 x5 · Khiên T2 x8');

    // Empty bag renders "Trống"
    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(units),
          supplyRows: [],
          adminConfig: createDefaultAdminConfig(),
          autoLoopActive: false,
          lang: 'vi',
          t,
          onConfirm: () => {},
        })
      );
    });
    expect(
      container.querySelector('[data-testid="prestage-ally-supply-strip"]')?.textContent
    ).toBe('Túi vật tư (cả phe): Trống');
  });

  it('7) renders buff chips without "Buff:" prefix, omits buff line when unit has no buff, shows header count, and removes sub-12px classes', () => {
    const units = [
      makeUnit('a1', 'Leader', 'ally', 'striker', 10, {
        isPlayer: true,
        statuses: [
          { type: 'atk_up', turnsRemaining: 3, magnitude: 0.42 },
          { type: 'eva_up', turnsRemaining: 3, magnitude: 0.375 },
        ],
      }),
      makeUnit('a2', 'NoBuffAlly', 'ally', 'support', 10, {
        statuses: [],
      }),
      makeUnit('e1', 'Enemy1', 'enemy', 'interceptor', 10),
    ];

    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(units),
          supplyRows: [],
          adminConfig: createDefaultAdminConfig(),
          autoLoopActive: false,
          lang: 'vi',
          t,
          onConfirm: () => {},
        })
      );
    });

    const dialog = container.querySelector('[data-testid="prestage-dialog"]');
    expect(dialog).not.toBeNull();
    expect(
      container.querySelector('[data-testid="prestage-buff-count"]')?.textContent
    ).toBe('Buff đầu trận đã áp dụng: 2');

    const a1Buffs = container.querySelector('[data-testid="prestage-unit-buffs-a1"]');
    expect(a1Buffs?.textContent).toContain('⬆+42% ATK');
    expect(a1Buffs?.textContent).toContain('⬆+15% EVA');
    expect(a1Buffs?.textContent).not.toContain('Buff:');

    const a2Row = container.querySelector('[data-testid="prestage-row-a2"]');
    expect(container.querySelector('[data-testid="prestage-unit-buffs-a2"]')).toBeNull();
    expect(a2Row?.textContent).not.toContain('Không buff');
    expect(dialog?.innerHTML).not.toMatch(/text-\[(9|10|11)px\]/);

    // Verify phone portrait 360px BottomSheet also renders >=12px text, buff header, and team supply strip
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 360,
    });
    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle(units),
          supplyRows: [],
          adminConfig: createDefaultAdminConfig(),
          autoLoopActive: false,
          lang: 'vi',
          t,
          onConfirm: () => {},
        })
      );
    });
    const phoneDialog = container.querySelector('[data-testid="prestage-dialog"]');
    expect(phoneDialog).not.toBeNull();
    expect(
      container.querySelector('[data-testid="prestage-buff-count"]')?.textContent
    ).toBe('Buff đầu trận đã áp dụng: 2');
    expect(phoneDialog?.innerHTML).not.toMatch(/text-\[(9|10|11)px\]/);
  });

  it('8) startAutoRepeat loop skips PrestageDialog on BattleScreen while keeping prestage buffs applied', () => {
    const fresh = createFreshCampaignState('Vance', 'striker', () => 0.5);
    fresh.pilot.gears.striker.equippedSkillBar = ['gen_hull_brace'];
    fresh.pilot.gears.striker.skillLevels = { gen_hull_brace: 1 };
    const adminConfig = {
      ...createDefaultAdminConfig(),
      prestage: { enabled: true, countdownSec: 3, groupFromSize: 10 },
    };
    useGameStore.setState({
      pilot: fresh.pilot,
      adminConfig,
      screen: 'HANGAR',
      battle: null,
      autoRepeatSession: null,
    });

    act(() => {
      useGameStore.getState().startAutoRepeat(5, 'border_outpost');
    });
    act(() => {
      root.render(createElement(BattleScreen));
    });

    const battle = useGameStore.getState().battle!;
    expect(battle).not.toBeNull();
    expect(battle.prestage?.active).toBe(false);
    expect(container.querySelector('[data-testid="prestage-dialog"]')).toBeNull();
    const playerUnit = battle.units.find((u) => u.isPlayer)!;
    expect(playerUnit.statuses.some((s) => s.type === 'def_up' && s.turnsRemaining > 0)).toBe(true);
  });
});
