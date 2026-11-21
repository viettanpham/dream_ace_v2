// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { sortTurnOrder } from '../../engine/combat';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatRow, CombatUnit } from '../../types/game';
import {
  getTurnQueueSidebarListHeightPx,
  getTurnQueueSidebarRowCount,
  getTurnQueueSidebarTotalHeightPx,
  QUEUE_VISIBLE_ROWS,
  SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX,
  TURN_QUEUE_ACTING_NAME_MIN_PX,
  TURN_QUEUE_SIDEBAR_HEIGHTS,
} from '../../utils/battleDisplay';
import { BattleScreen } from '../BattleScreen';
import { TurnQueueBar } from '../TurnQueueBar';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow,
  opts?: {
    isPlayer?: boolean;
    speed?: number;
    alive?: boolean;
  }
): CombatUnit {
  const alive = opts?.alive ?? true;
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: 0,
    isPlayer: Boolean(opts?.isPlayer),
    classId: row === 'back' ? 'siege' : row === 'middle' ? 'support' : 'striker',
    isBoss: false,
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 450,
      maxShield: 120,
      maxSp: 60,
      speed: opts?.speed ?? 70,
      attackPower: 45,
      defenseRating: 22,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: alive ? 450 : 0,
    shield: alive ? 120 : 0,
    sp: 35,
    isDefending: false,
    alive,
    statuses: [],
    animState: 'idle',
  };
}

function makeUnits(count: number): CombatUnit[] {
  const specs: Array<{
    id: string;
    name: string;
    side: 'ally' | 'enemy';
    row: CombatRow;
    isPlayer?: boolean;
    speed: number;
  }> = [
    {
      id: 'u_player',
      name: 'Commander Zara Vanguard-Prime',
      side: 'ally',
      row: 'front',
      isPlayer: true,
      speed: 96,
    },
    {
      id: 'u_e1',
      name: 'Crimson Dreadnought Flagship',
      side: 'enemy',
      row: 'front',
      speed: 90,
    },
    {
      id: 'u_a2',
      name: 'Aegis Sentinel Guardian',
      side: 'ally',
      row: 'middle',
      speed: 84,
    },
    {
      id: 'u_e2',
      name: 'Obsidian Interceptor Mk-IV',
      side: 'enemy',
      row: 'front',
      speed: 80,
    },
    {
      id: 'u_a3',
      name: 'Valkyrie Recon Striker',
      side: 'ally',
      row: 'back',
      speed: 74,
    },
    {
      id: 'u_e3',
      name: 'Spectre Orbital Bombardier',
      side: 'enemy',
      row: 'middle',
      speed: 70,
    },
    {
      id: 'u_a4',
      name: 'Hyperion Support Frigate',
      side: 'ally',
      row: 'back',
      speed: 64,
    },
    {
      id: 'u_e4',
      name: 'Phantom Siege Colossus',
      side: 'enemy',
      row: 'back',
      speed: 60,
    },
  ];

  return specs.slice(0, count).map((s) =>
    makeUnit(s.id, s.name, s.side, s.row, {
      isPlayer: s.isPlayer,
      speed: s.speed,
    })
  );
}

function makeBattle(units: CombatUnit[], overrides?: Partial<BattleState>): BattleState {
  const turnOrder = sortTurnOrder(units);
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    units,
    turnOrder,
    activeTurnIndex: 0,
    selectedTargetId: units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null,
    selectedAllyTargetId: units.find((u) => u.side === 'ally' && u.alive)?.id ?? null,
    lastPlayerTargetId: units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null,
    autoStopNotice: null,
    wingmanChat: null,
    log: [
      {
        id: 'log_q1_1',
        round: 1,
        actorName: units[0]?.name ?? 'Commander Zara',
        actorSide: 'ally',
        actorIsPlayer: true,
        tag: 'SYSTEM',
        templateKey: 'log.battleStart',
        params: { sector: 'border_outpost' },
      },
    ],
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

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setViewport(1280, 800);
  useGameStore.getState().setLanguage('vi');
  useGameStore.setState({
    screen: 'BATTLE',
    autoBattleEnabled: false,
    battleViewMode: 'radar',
    autoRepeatSession: null,
    autoRepeatToast: null,
    skipAnimations: true,
    battleSpeed: 1,
  });
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

describe('TASK Q1 — Turn queue fixed rows & full names (desktop/tablet right sidebar)', () => {
  it('1) Exports QUEUE_VISIBLE_ROWS = 5 and matches constant 260px height math (keeping 220px for log at 800px viewport)', () => {
    expect(QUEUE_VISIBLE_ROWS).toBe(5);
    expect(TURN_QUEUE_SIDEBAR_HEIGHTS.headerPx).toBe(32);
    expect(TURN_QUEUE_SIDEBAR_HEIGHTS.actingRowPx).toBe(36);
    expect(TURN_QUEUE_SIDEBAR_HEIGHTS.rowPx).toBe(26);
    expect(TURN_QUEUE_ACTING_NAME_MIN_PX).toBe(56);

    expect(getTurnQueueSidebarRowCount(8)).toBe(5);
    expect(getTurnQueueSidebarRowCount(6)).toBe(5);
    expect(getTurnQueueSidebarRowCount(4)).toBe(3);
    expect(getTurnQueueSidebarRowCount(2)).toBe(1);

    expect(getTurnQueueSidebarListHeightPx(5)).toBe(146);
    expect(getTurnQueueSidebarTotalHeightPx(5)).toBe(260);

    // At 800px viewport: 800 - 48 (TopHud) - 16 (layout py-2) - 16 (2 sidebar gaps) - 240 (SB2) - 260 (Q1) = 220px
    const logHeightAt800 =
      800 - 48 - 16 - 16 - SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX - getTurnQueueSidebarTotalHeightPx(5);
    expect(logHeightAt800).toBeGreaterThanOrEqual(220);
  });

  it('2) Queue block height & fixed row count (5) stay identical with 8, 5, 3 and 2 units alive in the same battle + internal scroll class', () => {
    const baseUnits = makeUnits(8);
    const battle8 = makeBattle(baseUnits);

    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle: battle8,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: baseUnits[1].name,
        })
      );
    });

    const queueBox = () =>
      container!.querySelector('[data-testid="turn-queue-sidebar"]') as HTMLElement;
    const listBox = () =>
      container!.querySelector(
        '[data-testid="turn-queue-upcoming-list"]'
      ) as HTMLElement;

    expect(queueBox().getAttribute('data-queue-rows')).toBe('5');
    expect(queueBox().style.height).toBe('260px');
    expect(listBox().style.height).toBe('146px');
    expect(listBox().className).toContain('overflow-y-auto');
    expect(listBox().className).toContain('tactical-scroll-thin');

    for (const aliveCount of [5, 3, 2]) {
      const updatedUnits = baseUnits.map((u, idx) => ({
        ...u,
        alive: idx < aliveCount,
        hp: idx < aliveCount ? 450 : 0,
      }));
      const nextBattle = makeBattle(updatedUnits, {
        round: 2,
        turnCounter: 9 - aliveCount,
      });

      act(() => {
        root!.render(
          createElement(TurnQueueBar, {
            battle: nextBattle,
            battleSpeed: 1,
            skipAnimations: false,
            enrageBonusPct: 0,
            variant: 'sidebar',
            targetName: updatedUnits[1].name,
          })
        );
      });

      expect(queueBox().getAttribute('data-queue-rows')).toBe('5');
      expect(queueBox().style.height).toBe('260px');
      expect(listBox().style.height).toBe('146px');
      expect(
        container!.querySelectorAll('[data-testid="turn-queue-sidebar-slot-empty"]')
      ).toHaveLength(0);
    }

    // With 2 alive units -> 3 upcoming turns (< 5 fixed rows): blank space stays, NO "+N" chip, NO height change
    expect(
      container!.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]')
    ).toHaveLength(3);
    expect(
      container!.querySelector('[data-testid="turn-queue-overflow"]')
    ).toBeNull();
  });

  it('3) Battle starting with fewer than 6 units locks rows = unitsAtStart - 1 and never shrinks when units die', () => {
    const fourUnits = makeUnits(4);
    const startBattle = makeBattle(fourUnits);

    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle: startBattle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: fourUnits[1].name,
        })
      );
    });

    const queueBox = container!.querySelector(
      '[data-testid="turn-queue-sidebar"]'
    ) as HTMLElement;
    const listBox = container!.querySelector(
      '[data-testid="turn-queue-upcoming-list"]'
    ) as HTMLElement;

    expect(queueBox.getAttribute('data-queue-rows')).toBe('3');
    expect(listBox.style.height).toBe(`${getTurnQueueSidebarListHeightPx(3)}px`);
    const initialTotalH = queueBox.style.height;

    // 2 units destroyed later in the same battle -> rows stay 3, height stays identical
    const twoLeftUnits = fourUnits.map((u, idx) => ({
      ...u,
      alive: idx < 2,
      hp: idx < 2 ? 450 : 0,
    }));
    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle: makeBattle(twoLeftUnits, { round: 2, turnCounter: 5 }),
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: twoLeftUnits[1].name,
        })
      );
    });

    expect(queueBox.getAttribute('data-queue-rows')).toBe('3');
    expect(queueBox.style.height).toBe(initialTotalH);
  });

  it('4) Dòng and Mở rộng log modes give the exact same queue height & fixed rows, and combat log retains flex-1 min-h-[220px]', () => {
    setViewport(1280, 800);
    const battle = makeBattle(makeUnits(8));
    useGameStore.setState({ battle });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const queueEl = container!.querySelector(
      '[data-testid="turn-queue-sidebar"]'
    ) as HTMLElement;
    const expandedHeight = queueEl.style.height;
    const expandedRows = queueEl.getAttribute('data-queue-rows');
    expect(expandedHeight).toBe('260px');
    expect(expandedRows).toBe('5');

    const desktopLog = container!.querySelector(
      '[data-testid="battle-desktop-docked-log"]'
    ) as HTMLElement;
    expect(desktopLog.className).toContain('flex-1');
    expect(desktopLog.className).toContain('min-h-[220px]');

    act(() => {
      (
        container!.querySelector(
          '[data-testid="combat-log-mode-line"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(queueEl.style.height).toBe(expandedHeight);
    expect(queueEl.getAttribute('data-queue-rows')).toBe(expandedRows);
    expect(
      container!.querySelector('[data-testid="turn-queue-overflow"]')?.textContent
    ).toContain('+10');

    // Switch back to Mở rộng -> log still flex-1 min-h-[220px]
    act(() => {
      (
        container!.querySelector(
          '[data-testid="combat-log-mode-expanded"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(desktopLog.className).toContain('flex-1');
    expect(desktopLog.className).toContain('min-h-[220px]');
  });

  it('5) Full names in acting row & queue rows: min-w-0 + truncate, no max-w-* limit, title attributes, shared width on acting row', () => {
    const units = makeUnits(8);
    const battle = makeBattle(units);

    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: units[1].name,
        })
      );
    });

    const attackerEl = container!.querySelector(
      '[data-testid="turn-queue-acting-attacker"]'
    ) as HTMLElement;
    const targetEl = container!.querySelector(
      '[data-testid="turn-queue-acting-target"]'
    ) as HTMLElement;

    expect(attackerEl.textContent).toBe(units[0].name);
    expect(attackerEl.title).toBe(units[0].name);
    expect(attackerEl.className).toContain('min-w-0');
    expect(attackerEl.className).toContain('truncate');
    expect(attackerEl.className).not.toMatch(/max-w-/);
    expect(attackerEl.style.minWidth).toContain('56px');

    expect(targetEl.textContent).toBe(units[1].name);
    expect(targetEl.title).toBe(units[1].name);
    expect(targetEl.className).toContain('min-w-0');
    expect(targetEl.className).toContain('truncate');
    expect(targetEl.className).not.toMatch(/max-w-/);
    expect(targetEl.style.minWidth).toContain('56px');

    const rowNames = Array.from(
      container!.querySelectorAll(
        '[data-testid="turn-queue-sidebar-chip"] [data-testid="turn-queue-chip-name"]'
      )
    ) as HTMLElement[];
    expect(rowNames.length).toBeGreaterThanOrEqual(5);

    for (const el of rowNames) {
      const chip = el.closest('[data-testid="turn-queue-sidebar-chip"]')!;
      const fullName = chip.getAttribute('data-full-name') ?? '';
      expect(el.textContent).toBe(fullName);
      expect(el.title).toBe(fullName);
      expect(el.className).toContain('min-w-0');
      expect(el.className).toContain('truncate');
      expect(el.className).not.toMatch(/max-w-/);
    }
  });

  it('6) Header stays 32px, acting row stays 36px even when no actor / at battle end, vi/en keys synced, save version 9', () => {
    expect(CURRENT_SAVE_VERSION).toBe(9);
    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );
    expect(VI_TRANSLATIONS['queue.battleEnded']).toBeTruthy();
    expect(EN_TRANSLATIONS['queue.battleEnded']).toBeTruthy();
    expect(VI_TRANSLATIONS['queue.noActiveActor']).toBeTruthy();
    expect(EN_TRANSLATIONS['queue.noActiveActor']).toBeTruthy();

    const units = makeUnits(8);
    const activeBattle = makeBattle(units);
    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle: activeBattle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: units[1].name,
        })
      );
    });

    const queueBox = container!.querySelector(
      '[data-testid="turn-queue-sidebar"]'
    ) as HTMLElement;
    const header = container!.querySelector(
      '[data-testid="turn-queue-sidebar-header"]'
    ) as HTMLElement;
    const acting = container!.querySelector(
      '[data-testid="turn-queue-acting-chip"]'
    ) as HTMLElement;
    expect(header.style.height).toBe('32px');
    expect(acting.style.height).toBe('36px');
    expect(queueBox.style.height).toBe('260px');

    // Battle ended -> acting row becomes 36px placeholder and queue block stays 260px
    const endedBattle = makeBattle(units, {
      round: 4,
      turnCounter: 21,
      summary: {
        outcome: 'victory',
        deployedGearId: 'striker',
        sectorId: 'border_outpost',
        rounds: 4,
        expGained: 300,
        creditsGained: 150,
        warPointsGained: 40,
        baseCaptureBonusWp: 0,
        leveledUp: false,
        previousLevel: 10,
        newLevel: 10,
        statPointsGained: 0,
        battlesToNextLevel: 3,
        unlockedSectorId: null,
        enemiesDestroyed: 4,
        totalEnemies: 4,
        alliesSurviving: 4,
        droppedItems: [],
      },
    });
    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle: endedBattle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: null,
        })
      );
    });

    const emptyActing = container!.querySelector(
      '[data-testid="turn-queue-acting-empty"]'
    ) as HTMLElement;
    expect(emptyActing).not.toBeNull();
    expect(emptyActing.style.height).toBe('36px');
    expect(header.style.height).toBe('32px');
    expect(queueBox.style.height).toBe('260px');
  });
});
