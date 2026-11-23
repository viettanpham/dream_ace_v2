// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { aggregateBattleStats } from '../../engine/battleStats';
import { sortTurnOrder } from '../../engine/combat';
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleEvent,
  BattleRoundSnapshot,
  BattleState,
  CombatLogEntry,
  CombatUnit,
} from '../../types/game';
import {
  computeStickScrollState,
  getNextScrollTopOnAppend,
  isScrolledToBottom,
} from '../../utils/scrollStick';
import { BattleStatsModal, type StatsTab } from '../BattleStatsModal';
import { CombatLogList } from '../CombatLogList';
import { ErrorBoundary } from '../ErrorBoundary';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  opts?: {
    isPlayer?: boolean;
    isBoss?: boolean;
    alive?: boolean;
    hp?: number;
    maxHp?: number;
    speed?: number;
  }
): CombatUnit {
  const maxHp = opts?.maxHp ?? 400;
  const alive = opts?.alive ?? true;
  const hp = opts?.hp ?? (alive ? maxHp : 0);
  return {
    id,
    name,
    callsign: name,
    side,
    row: 'front',
    formationCol: 0,
    isPlayer: Boolean(opts?.isPlayer),
    classId: side === 'ally' ? 'striker' : 'interceptor',
    isBoss: Boolean(opts?.isBoss),
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 120,
      maxSp: 60,
      speed: opts?.speed ?? 60,
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
    hp,
    shield: alive ? 80 : 0,
    sp: 50,
    isDefending: false,
    alive,
    statuses: [],
    animState: 'idle',
  };
}

function makeBattle(overrides?: Partial<BattleState>): BattleState {
  const units = overrides?.units ?? [
    makeUnit('ally_0', 'Kira', 'ally', { isPlayer: true, speed: 70 }),
    makeUnit('ally_1', 'Dax', 'ally', { speed: 62 }),
    makeUnit('enemy_0', 'Void Raider', 'enemy', { speed: 65 }),
    makeUnit('enemy_1', 'Iron Boss', 'enemy', { isBoss: true, speed: 55 }),
  ];
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 0,
    turnOrder: sortTurnOrder(units),
    activeTurnIndex: 0,
    units,
    selectedTargetId: null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
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
    ...overrides,
  };
}

function assertNoNaNOrInfinity(value: unknown, path = 'root'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `Non-finite number at ${path}: ${value}`).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNaNOrInfinity(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      assertNoNaNOrInfinity(v, `${path}.${k}`);
    }
  }
}

function makeLogEntries(count: number): CombatLogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `log_${i + 1}`,
    round: Math.floor(i / 4) + 1,
    tag: 'ATTACK',
    actorName: i % 2 === 0 ? 'Kira' : 'Void Raider',
    templateKey: 'log.damage',
    params: {
      actor: i % 2 === 0 ? 'Kira' : 'Void Raider',
      target: i % 2 === 0 ? 'Void Raider' : 'Kira',
      dmg: 45 + i,
    },
    actorSide: i % 2 === 0 ? 'ally' : 'enemy',
    actorIsPlayer: i % 4 === 0,
  }));
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
});

describe('1) aggregateBattleStats — total & NaN/Infinity-proof', () => {
  it('handles zero events, empty units, and null/undefined inputs with zero NaN/Infinity', () => {
    const emptyAll = aggregateBattleStats([], [], [], 0);
    assertNoNaNOrInfinity(emptyAll);
    expect(emptyAll.rounds).toBe(1);
    expect(emptyAll.units).toHaveLength(0);
    expect(emptyAll.ally.critRate).toBe(0);
    expect(emptyAll.enemy.remainingHpPct).toBe(0);

    const nullInputs = aggregateBattleStats(
      undefined,
      undefined,
      undefined,
      Number.NaN
    );
    assertNoNaNOrInfinity(nullInputs);
    expect(nullInputs.rounds).toBe(1);

    const unitsZeroEvents = aggregateBattleStats(
      [
        makeUnit('a1', 'Kira', 'ally', { isPlayer: true, maxHp: 0, hp: 0 }),
        makeUnit('e1', 'Drone', 'enemy', { maxHp: 0, hp: 0, alive: false }),
      ],
      [],
      [],
      1
    );
    assertNoNaNOrInfinity(unitsZeroEvents);
    expect(unitsZeroEvents.mvps.mostDamage).toBeNull();
  });

  it('handles single event, removed/unknown unit IDs, and malformed NaN/Infinity event payloads', () => {
    const units = [
      makeUnit('a1', 'Kira', 'ally', { isPlayer: true }),
      makeUnit('e1', 'Drone', 'enemy', { alive: false, hp: 0 }),
    ];
    const events: BattleEvent[] = [
      {
        id: 'ev1',
        round: 1,
        turn: 1,
        type: 'damage',
        actorId: 'a1',
        targetId: 'removed_unit_999',
        amount: 120,
        hpDamage: 100,
        shieldAbsorbed: 20,
        flags: { crit: true },
      },
      {
        id: 'ev2',
        round: Number.NaN,
        turn: 2,
        type: 'damage',
        actorId: 'ghost_actor',
        targetId: 'e1',
        amount: Number.POSITIVE_INFINITY,
        hpDamage: Number.NaN,
        shieldAbsorbed: -50,
      },
      {
        id: 'ev3',
        round: 2,
        turn: 3,
        type: 'heal',
        actorId: 'a1',
        targetId: 'a1',
        amount: Number.NaN,
      },
    ];

    const summary = aggregateBattleStats(units, events, [], 2);
    assertNoNaNOrInfinity(summary);
    expect(summary.ally.damageDealt).toBe(120);
    expect(summary.ally.crits).toBe(1);
    expect(summary.ally.critRate).toBe(100);
    expect(summary.mvps.mostDamage?.unitId).toBe('a1');
  });

  it('handles huge event logs (10,000 events across 50 rounds) without stack overflow or NaN', () => {
    const units = Array.from({ length: 16 }, (_, i) =>
      makeUnit(
        i < 8 ? `a_${i}` : `e_${i - 8}`,
        `Unit ${i}`,
        i < 8 ? 'ally' : 'enemy',
        { isPlayer: i === 0 }
      )
    );
    const largeEvents: BattleEvent[] = Array.from({ length: 10000 }, (_, i) => ({
      id: `big_${i}`,
      round: (i % 50) + 1,
      turn: i + 1,
      type: 'damage',
      actorId: i % 2 === 0 ? `a_${i % 8}` : `e_${i % 8}`,
      targetId: i % 2 === 0 ? `e_${i % 8}` : `a_${i % 8}`,
      amount: 25,
      hpDamage: 20,
      shieldAbsorbed: 5,
    }));

    const summary = aggregateBattleStats(units, largeEvents, [], 50);
    assertNoNaNOrInfinity(summary);
    expect(summary.rounds).toBe(50);
    expect(summary.ally.damageDealt).toBe(125000);
    expect(summary.enemy.damageDealt).toBe(125000);
    expect(summary.roundDamageSeries).toHaveLength(50);
  });
});

describe('2) BattleStatsModal — open transition + empty & populated renders across all 3 tabs', () => {
  it('transitions from open={false} to open={true} without crashing (Rules-of-Hooks regression test)', () => {
    useGameStore.getState().setLanguage('vi');
    const battle = makeBattle();

    // First mount closed (exact state at battle start before clicking Stats)
    act(() => {
      root!.render(
        createElement(BattleStatsModal, {
          open: false,
          onClose: () => {},
          battle,
          enrageBonusPct: 0,
        })
      );
    });
    expect(container!.querySelector('[data-testid="battle-stats-modal"]')).toBeNull();

    // Now click Stats -> open becomes true (previously threw "Rendered more hooks than during the previous render")
    act(() => {
      root!.render(
        createElement(BattleStatsModal, {
          open: true,
          onClose: () => {},
          battle,
          enrageBonusPct: 0,
        })
      );
    });
    expect(container!.querySelector('[data-testid="battle-stats-modal"]')).not.toBeNull();

    // Switch through all 3 tabs via DOM clicks
    const unitsTabBtn = container!.querySelector(
      '[data-testid="stats-tab-units"]'
    ) as HTMLButtonElement;
    const chartsTabBtn = container!.querySelector(
      '[data-testid="stats-tab-charts"]'
    ) as HTMLButtonElement;
    act(() => {
      unitsTabBtn.click();
    });
    act(() => {
      chartsTabBtn.click();
    });

    const html = container!.innerHTML;
    expect(html).toContain('Chưa có dữ liệu');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('renders clean empty states ("Chưa có dữ liệu") and zero NaN/Infinity across all 3 tabs with empty data', () => {
    useGameStore.getState().setLanguage('vi');
    const emptyBattle = makeBattle({
      units: [],
      events: [],
      roundSnapshots: [],
      round: 1,
    });

    for (const tab of ['overview', 'units', 'charts'] as StatsTab[]) {
      const html = renderToStaticMarkup(
        createElement(BattleStatsModal, {
          open: true,
          onClose: () => {},
          battle: emptyBattle,
          enrageBonusPct: 0,
          initialTab: tab,
        })
      );
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
      if (tab === 'units' || tab === 'charts') {
        expect(html).toContain('Chưa có dữ liệu');
      }
    }
  });

  it('renders populated 8v8 battle data across all 3 tabs with finite SVG attributes', () => {
    useGameStore.getState().setLanguage('en');
    const units = [
      makeUnit('a0', 'Kira', 'ally', { isPlayer: true, hp: 280, maxHp: 400 }),
      makeUnit('a1', 'Dax', 'ally', { alive: false, hp: 0, maxHp: 350 }),
      makeUnit('e0', 'Void Sniper', 'enemy', { hp: 150, maxHp: 300 }),
      makeUnit('e1', 'Iron Dreadnought', 'enemy', {
        isBoss: true,
        hp: 400,
        maxHp: 800,
      }),
    ];
    const events: BattleEvent[] = [
      { id: '1', round: 1, turn: 1, type: 'turn_start', actorId: 'a0' },
      {
        id: '2',
        round: 1,
        turn: 1,
        type: 'skill_cast',
        actorId: 'a0',
        skillId: 'laser_barrage',
        spSpent: 15,
      },
      {
        id: '3',
        round: 1,
        turn: 1,
        type: 'damage',
        actorId: 'a0',
        targetId: 'e0',
        skillId: 'laser_barrage',
        amount: 150,
        hpDamage: 120,
        shieldAbsorbed: 30,
        flags: { crit: true },
      },
      { id: '4', round: 2, turn: 2, type: 'turn_start', actorId: 'e1' },
      {
        id: '5',
        round: 2,
        turn: 2,
        type: 'damage',
        actorId: 'e1',
        targetId: 'a1',
        amount: 350,
        hpDamage: 350,
        shieldAbsorbed: 0,
      },
      {
        id: '6',
        round: 2,
        turn: 2,
        type: 'kill',
        actorId: 'e1',
        targetId: 'a1',
      },
    ];
    const snapshots: BattleRoundSnapshot[] = [
      {
        round: 1,
        allyHp: 750,
        allyMaxHp: 750,
        allyHpPct: 100,
        enemyHp: 950,
        enemyMaxHp: 1100,
        enemyHpPct: 86.4,
      },
      {
        round: 2,
        allyHp: 280,
        allyMaxHp: 750,
        allyHpPct: 37.3,
        enemyHp: 550,
        enemyMaxHp: 1100,
        enemyHpPct: 50,
      },
    ];

    const populated = makeBattle({
      units,
      events,
      roundSnapshots: snapshots,
      round: 22,
    });

    for (const tab of ['overview', 'units', 'charts'] as StatsTab[]) {
      const html = renderToStaticMarkup(
        createElement(BattleStatsModal, {
          open: true,
          onClose: () => {},
          battle: populated,
          enrageBonusPct: 0.2,
          initialTab: tab,
        })
      );
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
      if (tab === 'charts') {
        expect(html).toContain('<polyline');
        expect(html).toContain('<circle');
      }
    }
  });
});

describe('3) ErrorBoundary — catches throwing child and preserves sibling UI', () => {
  it('renders fallback with Close, Reload battle, and Copy error controls without crashing parent', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = vi.fn();
    const onReloadBattle = vi.fn();

    function Boom(): null {
      throw new Error('Simulated chart crash');
    }

    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement('div', { 'data-testid': 'battle-canvas' }, 'Battle Active'),
          createElement(ErrorBoundary, {
            variant: 'panel',
            title: 'Battle Statistics',
            onClose,
            onReloadBattle,
            children: createElement(Boom),
          })
        )
      );
    });

    // Parent / sibling battle UI remains alive (no black screen)
    expect(container!.querySelector('[data-testid="battle-canvas"]')?.textContent).toBe(
      'Battle Active'
    );

    // Fallback UI rendered with error details and all 3 controls
    const fallback = container!.querySelector('[data-testid="error-boundary-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback!.textContent).toContain('Simulated chart crash');
    expect(container!.querySelector('[data-testid="error-boundary-close"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="error-boundary-reload"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="error-boundary-copy"]')).not.toBeNull();

    // console.error was called (never swallowed silently)
    expect(consoleSpy).toHaveBeenCalled();

    // Clicking Close calls onClose
    const closeBtn = container!.querySelector(
      '[data-testid="error-boundary-close"]'
    ) as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});

describe('4) Combat Log Stick-to-Bottom — pure helpers & DOM scrolling behavior', () => {
  it('pure scrollStick helpers enforce the 24px bottom threshold accurately', () => {
    expect(
      isScrolledToBottom({ scrollHeight: 1000, scrollTop: 776, clientHeight: 200 }, 24)
    ).toBe(true);
    expect(
      isScrolledToBottom({ scrollHeight: 1000, scrollTop: 775, clientHeight: 200 }, 24)
    ).toBe(false);
    // Short content that does not overflow is always at bottom
    expect(
      isScrolledToBottom({ scrollHeight: 120, scrollTop: 0, clientHeight: 200 }, 24)
    ).toBe(true);

    expect(
      computeStickScrollState({ scrollHeight: 1000, scrollTop: 500, clientHeight: 200 })
    ).toEqual({ isAtBottom: false, showJumpToLatest: true });

    expect(getNextScrollTopOnAppend(true, 400, 1200)).toBe(1200);
    expect(getNextScrollTopOnAppend(false, 400, 1200)).toBe(400);
  });

  it('CombatLogList sticks to bottom across rapid bursts (>80 events), pauses when scrolled up, and re-sticks on Jump to latest', () => {
    useGameStore.getState().setLanguage('en');
    const initialEntries = makeLogEntries(20);

    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: initialEntries,
          active: true,
          order: 'oldest',
        })
      );
    });

    const scrollEl = container!.querySelector(
      '[data-testid="combat-log-scroll"]'
    ) as HTMLDivElement;
    expect(scrollEl).not.toBeNull();

    // Mock layout metrics in jsdom
    let currentScrollHeight = 800;
    Object.defineProperty(scrollEl, 'clientHeight', {
      configurable: true,
      get: () => 200,
    });
    Object.defineProperty(scrollEl, 'scrollHeight', {
      configurable: true,
      get: () => currentScrollHeight,
    });

    // Append burst to 95 entries (verifying >80 entries all render & stay pinned)
    currentScrollHeight = 2400;
    const burstEntries = makeLogEntries(95);
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: burstEntries,
          active: true,
          order: 'oldest',
        })
      );
    });
    expect(container!.querySelectorAll('[data-testid="combat-log-entry"]')).toHaveLength(95);
    expect(scrollEl.scrollTop).toBe(2400);
    expect(container!.querySelector('[data-testid="combat-log-jump-latest"]')).toBeNull();

    // User scrolls UP to read older events (distance = 2400 - 300 - 200 = 1900 > 24)
    scrollEl.scrollTop = 300;
    act(() => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });

    // "Jump to latest" button MUST now appear
    const jumpBtn = container!.querySelector(
      '[data-testid="combat-log-jump-latest"]'
    ) as HTMLButtonElement;
    expect(jumpBtn).not.toBeNull();
    expect(jumpBtn.textContent).toContain('Jump to latest');

    // New events arrive while user is scrolled up -> MUST NOT yank scrollTop down
    currentScrollHeight = 2600;
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: makeLogEntries(105),
          active: true,
          order: 'oldest',
        })
      );
    });
    expect(scrollEl.scrollTop).toBe(300);

    // Clicking "Jump to latest" jumps to bottom, hides button, and re-enables auto-scroll
    act(() => {
      jumpBtn.click();
    });
    expect(scrollEl.scrollTop).toBe(2600);
    expect(container!.querySelector('[data-testid="combat-log-jump-latest"]')).toBeNull();

    // Subsequent event now auto-scrolls again
    currentScrollHeight = 2750;
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: makeLogEntries(110),
          active: true,
          order: 'oldest',
        })
      );
    });
    expect(scrollEl.scrollTop).toBe(2750);
  });
});
