// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { useGameStore } from '../../store/useGameStore';
import type {
  ActiveStatusEffect,
  BattleState,
  CombatFxEvent,
  CombatRow,
  CombatUnit,
  FloatingPopup,
} from '../../types/game';
import { writeActionStageEnabled } from '../../utils/actionStagePrefs';
import {
  advanceCardPopupQueue,
  createCardPopupQueueState,
  pickCardPopupStartPoint,
  syncCardPopupQueue,
} from '../../utils/cardPopupQueue';
import { BattleScreen } from '../BattleScreen';
import { BattleUnitCard } from '../BattleUnitCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow = 'front',
  opts: Partial<CombatUnit> = {}
): CombatUnit {
  const maxHp = opts.derived?.maxHp ?? 600;
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: opts.formationCol ?? 0,
    isPlayer: Boolean(opts.isPlayer),
    classId: opts.classId ?? (side === 'ally' ? 'striker' : 'interceptor'),
    archetype: opts.archetype,
    isBoss: opts.isBoss ?? false,
    level: opts.level ?? 10,
    skillLevel: opts.skillLevel ?? 1,
    skillLevels: opts.skillLevels ?? { gen_hull_brace: 1 },
    equippedSkillIds: opts.equippedSkillIds ?? ['gen_hull_brace'],
    skillCooldowns: opts.skillCooldowns ?? {},
    usedOnceSkills: opts.usedOnceSkills ?? [],
    stats: opts.stats ?? { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 200,
      maxSp: 100,
      speed: 110,
      attackPower: 90,
      defenseRating: 60,
      dodgeChance: 12,
      critChance: 20,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
      ...(opts.derived ?? {}),
    },
    alive: opts.alive ?? true,
    hp: opts.hp ?? maxHp,
    shield: opts.shield ?? 200,
    sp: opts.sp ?? 60,
    isDefending: opts.isDefending ?? false,
    statuses: opts.statuses ?? [],
    animState: opts.animState ?? 'idle',
    isStructure: opts.isStructure,
  };
}

function makeBattle(
  units: CombatUnit[],
  overrides: Partial<BattleState> = {}
): BattleState {
  const firstEnemy = units.find((u) => u.side === 'enemy' && u.alive);
  return {
    sectorId: overrides.sectorId ?? 'sector_1',
    deployedGearId: 'striker',
    squadSize: 4,
    units,
    turnOrder: units.map((u) => u.id),
    activeTurnIndex: 0,
    round: overrides.round ?? 1,
    turnCounter: overrides.turnCounter ?? 1,
    selectedTargetId: firstEnemy?.id ?? null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: firstEnemy?.id ?? null,
    autoStopNotice: null,
    wingmanChat: null,
    log: [],
    events: [],
    roundSnapshots: [],
    popups: [],
    fxEvents: [],
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
    ...overrides,
  };
}

function setViewport(width: number, height: number) {
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

describe('CARD-POP1 + STATUS-POP1', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.getState().setLanguage('vi');
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
    window.localStorage.clear();
  });

  it('1) Queue launches 1st popup immediately, staggers subsequent ones, caps maxConcurrent, and compacts overflow/high-speed pending', () => {
    const opts = {
      staggerMs: 100,
      flightMs: 200,
      maxConcurrent: 2,
      battleSpeed: 1 as const,
      effectsMode: 'full' as const,
    };
    const batch: FloatingPopup[] = [
      { id: 'p1', unitId: 'u1', text: '-100', tone: 'damage' },
      { id: 'p2', unitId: 'u1', text: '-50', tone: 'damage' },
      { id: 'p3', unitId: 'u1', text: '+80 HP', tone: 'heal' },
    ];

    let q = syncCardPopupQueue(createCardPopupQueueState(), batch, 1000, opts);
    expect(q.active.map((x) => x.popup.id)).toEqual(['p1']);
    expect(q.pending.map((x) => x.id)).toEqual(['p2', 'p3']);

    // Before staggerMs elapses -> p2 stays queued
    q = advanceCardPopupQueue(q, 1050, opts);
    expect(q.active.map((x) => x.popup.id)).toEqual(['p1']);

    // At 1100ms -> p2 launches, reaching maxConcurrent=2; p3 waits for slot/stagger
    q = advanceCardPopupQueue(q, 1100, opts);
    expect(q.active.map((x) => x.popup.id)).toEqual(['p1', 'p2']);
    expect(q.pending.map((x) => x.id)).toEqual(['p3']);

    // Even at 1200ms, maxConcurrent=2 blocks p3 until p1 expires (at 1000 + 200 + 450 = 1650ms)
    q = advanceCardPopupQueue(q, 1250, opts);
    expect(q.active).toHaveLength(2);
    expect(q.pending.map((x) => x.id)).toEqual(['p3']);

    // Overflow (>8 pending) coalesces older numbers
    const burst: FloatingPopup[] = Array.from({ length: 12 }, (_, idx) => ({
      id: `b${idx}`,
      unitId: 'u1',
      text: '-10',
      tone: 'damage' as const,
    }));
    const overflowed = syncCardPopupQueue(
      createCardPopupQueueState(),
      burst,
      2000,
      { ...opts, battleSpeed: 10 }
    );
    expect(overflowed.active).toHaveLength(1);
    expect(overflowed.pending.length).toBeLessThanOrEqual(2);
  });

  it('2) Start points stay inside card perimeter with inset >= 8px and aim toward card center', () => {
    const w = 260;
    const h = 92;
    const dmgPop: FloatingPopup = { id: 'd1', unitId: 'u1', text: '-240', tone: 'damage' };
    const dmgEdges = new Set<string>();
    const samples = [0, 0.25, 0.5, 0.75, 0.99];
    for (const edgeRoll of samples) {
      for (const posRoll of [0, 0.5, 1]) {
        const calls = [edgeRoll, posRoll];
        let i = 0;
        const pt = pickCardPopupStartPoint(dmgPop, w, h, () => calls[i++] ?? 0.5);
        dmgEdges.add(pt.edge);
        expect(pt.x).toBeGreaterThanOrEqual(8);
        expect(pt.x).toBeLessThanOrEqual(w - 8);
        expect(pt.y).toBeGreaterThanOrEqual(8);
        expect(pt.y).toBeLessThanOrEqual(h - 8);
        expect(pt.x + pt.toCenterX).toBeCloseTo(pt.centerX, 5);
        expect(pt.y + pt.toCenterY).toBeCloseTo(pt.centerY, 5);
      }
    }
    expect(dmgEdges).toEqual(new Set(['top', 'right', 'bottom', 'left']));

    // Heal / Shield / SP / Buff only spawn from top or bottom edges
    const healPop: FloatingPopup = { id: 'h1', unitId: 'u1', text: '+100 HP', tone: 'heal' };
    const spPop: FloatingPopup = { id: 's1', unitId: 'u1', text: '+50 SP', tone: 'buff' };
    const buffPop: FloatingPopup = { id: 'b1', unitId: 'u1', text: '+ATK', tone: 'buff' };
    for (const pop of [healPop, spPop, buffPop]) {
      const edges = new Set<string>();
      for (const edgeRoll of samples) {
        let i = 0;
        const rolls = [edgeRoll, 0.4];
        const pt = pickCardPopupStartPoint(pop, w, h, () => rolls[i++] ?? 0.4);
        edges.add(pt.edge);
        expect(pt.x).toBeGreaterThanOrEqual(8);
        expect(pt.y).toBeGreaterThanOrEqual(8);
      }
      expect(Array.from(edges).every((e) => e === 'top' || e === 'bottom')).toBe(true);
    }
  });

  it('3) Card popups still render when Action Stage is enabled in Card view', () => {
    setViewport(1440, 900);
    const ally = makeUnit('a1', 'Striker', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Drone', 'enemy', 'front');
    const fx: CombatFxEvent = {
      id: 'fx-card-pop-1',
      kind: 'laser',
      fromSide: 'ally',
      fromSlotIndex: 0,
      fromUnitId: 'a1',
      toSide: 'enemy',
      toSlotIndices: [0],
      toUnitIds: ['e1'],
      accentHex: '#38bdf8',
    };
    const popups: FloatingPopup[] = [
      { id: 'pop-1', unitId: 'e1', text: '-185', tone: 'damage' },
    ];
    const battle = makeBattle([ally, enemy], { fxEvents: [fx], popups });
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });
    writeActionStageEnabled(true);

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(
      container!.querySelector('[data-testid="card-stage-fx-attacker-a1"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="card-stage-fx-target-e1"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="card-popups-container-e1"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="damage-popup"]')?.textContent
    ).toContain('-185');
  });

  it('4) Desktop status popover renders via portal directly under document.body (outside card container)', () => {
    setViewport(1440, 900);
    const statuses: ActiveStatusEffect[] = [
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
      { type: 'burn', turnsRemaining: 2, isDebuff: true, magnitude: 0.1 },
    ];
    const unit = makeUnit('p1', 'Kaelen', 'ally', 'front', {
      isPlayer: true,
      statuses,
    });

    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: true,
          popups: [],
          onSelect: vi.fn(),
          onInspect: vi.fn(),
        })
      );
    });

    const cardArea = container!.querySelector(
      '[data-testid="card-status-row-p1"]'
    ) as HTMLElement;
    expect(cardArea).not.toBeNull();

    act(() => {
      cardArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(
      container!.querySelector('[data-testid="status-area-popover-backdrop"]')
    ).toBeNull();
    const bodyBackdrop = document.body.querySelector(
      '[data-testid="status-area-popover-backdrop"]'
    ) as HTMLElement;
    const bodyPopover = document.body.querySelector(
      '[data-testid="status-area-popover"]'
    ) as HTMLElement;
    expect(bodyBackdrop).not.toBeNull();
    expect(bodyBackdrop.parentElement).toBe(document.body);
    expect(bodyPopover).not.toBeNull();
    expect(bodyPopover.textContent).toContain('Làm chậm');
  });

  it('5) Updating statuses across battle ticks keeps desktop status popover open and preserves dialog node without remount', () => {
    setViewport(1440, 900);
    const initialUnit = makeUnit('p2', 'Vanguard', 'ally', 'front', {
      isPlayer: true,
      statuses: [
        { type: 'slow', turnsRemaining: 3, isDebuff: true, magnitude: 0.3 },
      ],
    });

    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: initialUnit,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: true,
          popups: [],
          onSelect: vi.fn(),
          onInspect: vi.fn(),
        })
      );
    });

    const cardArea = container!.querySelector(
      '[data-testid="card-status-row-p2"]'
    ) as HTMLElement;
    act(() => {
      cardArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const popoverBefore = document.body.querySelector(
      '[data-testid="status-area-popover"]'
    ) as HTMLElement;
    expect(popoverBefore).not.toBeNull();
    expect(popoverBefore.textContent).toContain('3 lượt');

    // Simulate battle tick updating statuses + remaining turns
    const nextUnit: CombatUnit = {
      ...initialUnit,
      hp: initialUnit.hp - 50,
      statuses: [
        { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
        { type: 'atk_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.2 },
      ],
    };

    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: nextUnit,
          isActiveTurn: true,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: true,
          popups: [],
          onSelect: vi.fn(),
          onInspect: vi.fn(),
        })
      );
    });

    const popoverAfter = document.body.querySelector(
      '[data-testid="status-area-popover"]'
    ) as HTMLElement;
    expect(popoverAfter).not.toBeNull();
    expect(popoverAfter).toBe(popoverBefore);
    expect(popoverAfter.textContent).toContain('2 lượt');
    expect(popoverAfter.textContent).toContain('Tăng Công');
  });
});
