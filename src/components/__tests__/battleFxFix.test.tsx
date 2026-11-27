// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { resolveUnitAction, sortTurnOrder } from '../../engine/combat';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleSpeed,
  BattleState,
  CombatRow,
  CombatUnit,
} from '../../types/game';
import {
  getPrefersReducedMotion,
  usePrefersReducedMotion,
} from '../../utils/battleDisplay';
import {
  computeFxCleanupDelayMs,
  computeVfxDurationMs,
  POPUP_CLEANUP_DELAY_MS,
  readBattleEffectsMode,
} from '../../utils/battleVfx';
import {
  BattleRadarView,
  buildRowLanes,
  computeUnitPositions,
} from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import {
  resolveOverlayUnitPoint,
  resolveSvgPointInOverlay,
} from '../BattleVfxOverlay';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow,
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const alive = overrides.alive ?? true;
  const maxHp = 400;
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: 0,
    isPlayer: false,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: { str_hotload_shells: 1 },
    equippedSkillIds: ['str_hotload_shells'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 120,
      maxSp: 60,
      speed: 60,
      attackPower: 45,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: alive ? maxHp : 0,
    shield: alive ? 80 : 0,
    sp: 50,
    isDefending: false,
    alive,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(
  units: CombatUnit[],
  overrides: Partial<BattleState> = {}
): BattleState {
  const enemy = units.find((u) => u.side === 'enemy') ?? units[units.length - 1];
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    turnOrder: sortTurnOrder(units),
    activeTurnIndex: 0,
    units,
    selectedTargetId: enemy?.id ?? null,
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

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  mockMatchMedia(false);
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
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

describe('FX-fix: Battle VFX lifetime & persistence across x1..x10', () => {
  it('keeps created FX and floating popups alive across the animation window at every speed (x1, x2, x3, x5, x10)', () => {
    vi.useFakeTimers();
    const speeds: BattleSpeed[] = [1, 2, 3, 5, 10];

    for (const speed of speeds) {
      // Cleanup delay must always exceed the longest projectile + delayed impact window
      const cleanupDelay = computeFxCleanupDelayMs(speed);
      const longestVfxMs = computeVfxDurationMs('area', speed);
      const maxImpactEnd =
        Math.round(longestVfxMs * 0.48) +
        Math.max(110, Math.round(longestVfxMs * 0.68));
      expect(cleanupDelay).toBeGreaterThan(maxImpactEnd);

      useGameStore.getState().startBattle('border_outpost');
      const started = useGameStore.getState().battle!;
      const player = started.units.find((u) => u.isPlayer)!;
      const enemy = started.units.find((u) => u.side === 'enemy' && u.alive)!;

      const patchedUnits = started.units.map((u) =>
        u.id === player.id
          ? {
              ...u,
              derived: { ...u.derived, speed: 999 },
              sp: 60,
              equippedSkillIds: ['str_hotload_shells'],
              skillLevels: { str_hotload_shells: 1 },
              skillCooldowns: {},
            }
          : u
      );

      useGameStore.setState({
        battleViewMode: 'radar',
        autoBattleEnabled: false,
        skipAnimations: false,
        battleSpeed: speed,
        battle: {
          ...started,
          units: patchedUnits,
          turnOrder: [
            player.id,
            ...patchedUnits.filter((u) => u.id !== player.id).map((u) => u.id),
          ],
          activeTurnIndex: 0,
          selectedTargetId: enemy.id,
          fxEvents: [],
          popups: [],
          explodedUnitIds: [],
          prestage: { active: false, appliedByUnit: {} },
        },
      });

      act(() => {
        root!.render(createElement(BattleScreen));
      });

      // Trigger player basic attack via store action (same path as clicking Fire)
      act(() => {
        useGameStore.getState().performPlayerAction('attack');
      });

      const afterAttack = useGameStore.getState().battle!;
      expect(afterAttack.fxEvents.length).toBeGreaterThan(0);
      expect(afterAttack.popups.length).toBeGreaterThan(0);

      const fxId = afterAttack.fxEvents[0].id;
      const popupId = afterAttack.popups[0].id;

      // Effect elements must be rendered inside battle-radar-container immediately
      const radarContainer = container!.querySelector(
        '[data-testid="battle-radar-container"]'
      );
      expect(radarContainer).not.toBeNull();
      expect(
        radarContainer!.querySelector(`[data-testid="radar-fx-${fxId}"]`)
      ).not.toBeNull();
      expect(
        radarContainer!.querySelector('[data-testid="damage-popup"]')
      ).not.toBeNull();

      // Advance past half the cleanup window (must still be present, NOT wiped immediately)
      act(() => {
        vi.advanceTimersByTime(Math.floor(cleanupDelay * 0.5));
      });

      expect(
        useGameStore.getState().battle!.fxEvents.some((f) => f.id === fxId)
      ).toBe(true);
      expect(
        useGameStore.getState().battle!.popups.some((p) => p.id === popupId)
      ).toBe(true);
      expect(
        container!.querySelector(`[data-testid="radar-fx-${fxId}"]`)
      ).not.toBeNull();
      expect(
        container!.querySelector('[data-testid="damage-popup"]')
      ).not.toBeNull();

      // Advance past FX cleanup delay -> FX expires cleanly
      act(() => {
        vi.advanceTimersByTime(cleanupDelay);
      });
      expect(
        useGameStore.getState().battle!.fxEvents.some((f) => f.id === fxId)
      ).toBe(false);

      // Advance past popup lifetime -> popup cleans up cleanly
      act(() => {
        vi.advanceTimersByTime(POPUP_CLEANUP_DELAY_MS);
      });
      expect(
        useGameStore.getState().battle!.popups.some((p) => p.id === popupId)
      ).toBe(false);
    }
  });

  it('does not wipe active attack FX when a subsequent non-attack buff skill (e.g. WPN +30%) resolves', () => {
    useGameStore.getState().startBattle('border_outpost');
    const started = useGameStore.getState().battle!;
    const player = started.units.find((u) => u.isPlayer)!;
    const enemy = started.units.find((u) => u.side === 'enemy' && u.alive)!;

    const patchedUnits = started.units.map((u) =>
      u.id === player.id
        ? {
            ...u,
            derived: { ...u.derived, speed: 999 },
            sp: 60,
            equippedSkillIds: ['str_hotload_shells'],
            skillLevels: { str_hotload_shells: 1 },
            skillCooldowns: {},
          }
        : u
    );

    useGameStore.setState({
      battleViewMode: 'radar',
      autoBattleEnabled: false,
      skipAnimations: false,
      battleSpeed: 10,
      battle: {
        ...started,
        units: patchedUnits,
        turnOrder: [player.id, player.id, enemy.id],
        activeTurnIndex: 0,
        selectedTargetId: enemy.id,
        fxEvents: [],
        popups: [],
        prestage: { active: false, appliedByUnit: {} },
      },
    });

    // Turn 1: attack creates fxEvent
    useGameStore.getState().performPlayerAction('attack');
    const fxId = useGameStore.getState().battle!.fxEvents[0]?.id;
    expect(fxId).toBeTruthy();

    // Turn 2: self-buff skill ("WPN +30%") has no projectile fxEvent; must preserve prior FX AND add status popup
    useGameStore.getState().performPlayerAction('skill', 'str_hotload_shells');
    const afterBuff = useGameStore.getState().battle!;
    expect(afterBuff.fxEvents.some((f) => f.id === fxId)).toBe(true);
    expect(
      afterBuff.popups.some(
        (p) => p.tone === 'buff' && /WPN \+\d+%/.test(p.text)
      )
    ).toBe(true);
  });
});

describe('FX-fix: Fallback proportional coordinates when measurement is 0 or NaN', () => {
  it('falls back to valid proportional container coordinates instead of 0, NaN, or null', () => {
    const svgPosMap = new Map([
      ['p1', { x: 180, y: 210 }],
      ['e1', { x: 540, y: 210 }],
    ]);

    // Case 1: container rect is 0x0 (e.g. pre-layout or JSDOM) -> percentage fallback
    const zeroRect = { left: 0, top: 0, width: 0, height: 0 };
    const pZero = resolveOverlayUnitPoint(
      'p1',
      zeroRect,
      zeroRect,
      svgPosMap,
      720,
      420
    );
    expect(pZero).not.toBeNull();
    expect(pZero!.usedFallback).toBe(true);
    expect(pZero!.leftCss).toBe('25.00%');
    expect(pZero!.topCss).toBe('50.00%');
    expect(Number.isFinite(pZero!.xPct)).toBe(true);
    expect(Number.isFinite(pZero!.yPct)).toBe(true);

    // Case 2: marker rect is NaN while container has real bounds -> xMidYMid projected container pixels
    const validContainer = { left: 10, top: 20, width: 720, height: 420 };
    const nanMarker = { left: Number.NaN, top: Number.NaN, width: 0, height: 0 };
    const pNan = resolveOverlayUnitPoint(
      'e1',
      validContainer,
      nanMarker,
      svgPosMap,
      720,
      420
    );
    expect(pNan).not.toBeNull();
    expect(pNan!.usedFallback).toBe(true);
    expect(pNan!.x).toBeCloseTo(540, 1);
    expect(pNan!.y).toBeCloseTo(210, 1);
    expect(pNan!.leftCss).toBe('540.0px');
    expect(pNan!.topCss).toBe('210.0px');

    // Case 3: marker rect is valid inside container -> measured container-relative center
    const validMarker = { left: 160, top: 190, width: 60, height: 60 };
    const pMeasured = resolveOverlayUnitPoint(
      'p1',
      validContainer,
      validMarker,
      svgPosMap,
      720,
      420
    );
    expect(pMeasured).not.toBeNull();
    expect(pMeasured!.usedFallback).toBe(false);
    expect(pMeasured!.x).toBe(180);
    expect(pMeasured!.y).toBe(200);

    // Case 4: resolveSvgPointInOverlay rejects NaN SVG position safely
    expect(
      resolveSvgPointInOverlay({ x: Number.NaN, y: 100 }, zeroRect, 720, 420)
    ).toBeNull();
  });

  it('renders projectiles, impacts, and floating popups inside battle-radar-container even when getBoundingClientRect returns 0x0', () => {
    const rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect);

    try {
      const p1 = makeUnit('p1', 'ZARA', 'ally', 'front', {
        isPlayer: true,
        classId: 'striker',
      });
      const e1 = makeUnit('e1', 'Raider', 'enemy', 'front', { animState: 'hit' });
      const battle = makeBattle([p1, e1], {
        fxEvents: [
          {
            id: 'fx_zero_rect',
            kind: 'laser',
            fromSide: 'ally',
            fromSlotIndex: 0,
            fromUnitId: 'p1',
            toSide: 'enemy',
            toSlotIndices: [0],
            toUnitIds: ['e1'],
            accentHex: '#38bdf8',
          },
        ],
        popups: [
          { id: 'pop_dmg', unitId: 'e1', text: '-120', tone: 'damage' },
          { id: 'pop_buff', unitId: 'p1', text: 'WPN +30%', tone: 'buff' },
        ],
      });

      act(() => {
        root!.render(
          createElement(BattleRadarView, {
            battle,
            activeUnitId: 'p1',
            validBasicTargetIds: new Set(['e1']),
            canPlayerManualAct: false,
            hasSingleAllySkill: false,
            autoBattleEnabled: false,
            skipAnimations: false,
            battleSpeed: 1,
            effectsMode: 'full',
            layoutMode: 'pc',
            onSelectEnemy: vi.fn(),
            onSelectAlly: vi.fn(),
            onInspectUnit: vi.fn(),
          })
        );
      });

      const radarBox = container!.querySelector(
        '[data-testid="battle-radar-container"]'
      );
      expect(radarBox).not.toBeNull();

      const overlay = radarBox!.querySelector(
        '[data-testid="radar-vfx-overlay"]'
      ) as HTMLDivElement;
      expect(overlay).not.toBeNull();
      expect(overlay.className).toContain('absolute');
      expect(overlay.className).toContain('inset-0');
      expect(overlay.className).toContain('pointer-events-none');

      const projectile = overlay.querySelector(
        '[data-testid="vfx-cannon-fx_zero_rect-e1"]'
      ) as HTMLDivElement;
      expect(projectile).not.toBeNull();
      // Uses proportional percentage fallback instead of 0px or NaN
      expect(projectile.style.left).toMatch(/^\d+(\.\d+)?%$/);
      expect(projectile.style.top).toMatch(/^\d+(\.\d+)?%$/);
      expect(projectile.style.left).not.toContain('NaN');
      expect(projectile.style.top).not.toContain('NaN');

      const popupsLayer = radarBox!.querySelector(
        '[data-testid="radar-popups-layer"]'
      );
      expect(popupsLayer).not.toBeNull();
      const popups = popupsLayer!.querySelectorAll('[data-testid="damage-popup"]');
      expect(popups.length).toBe(2);
      expect(popupsLayer!.textContent).toContain('-120');
      expect(popupsLayer!.textContent).toContain('+30%');
      expect(
        popupsLayer!.querySelector('[data-popup-icon-kind="wpn"]')?.textContent
      ).toBe('swords');
    } finally {
      rectSpy.mockRestore();
    }
  });
});

describe('FX-fix: Reduced-motion hook default and Effects mode default', () => {
  it('defaults Effects mode to full and reduced-motion to false unless browser explicitly reports reduce', () => {
    expect(readBattleEffectsMode()).toBe('full');

    // Default mockMatchMedia(false)
    expect(getPrefersReducedMotion()).toBe(false);

    let hookValue: boolean | null = null;
    function Probe() {
      hookValue = usePrefersReducedMotion();
      return createElement('div', { 'data-testid': 'rm-probe' }, String(hookValue));
    }

    act(() => {
      root!.render(createElement(Probe));
    });
    expect(hookValue).toBe(false);

    // When matchMedia is unavailable / undefined
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    expect(getPrefersReducedMotion()).toBe(false);

    // When matchMedia returns matches: true
    mockMatchMedia(true);
    expect(getPrefersReducedMotion()).toBe(true);
    act(() => {
      root!.render(createElement(Probe, { key: 'reduced-true' }));
    });
    expect(hookValue).toBe(true);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: origMatchMedia,
    });
  });
});

describe('FX-fix: Fixed radar row positions & row movement log + slide animation', () => {
  it('keeps all front/middle/back row lanes and living unit positions unchanged when a unit dies or a row becomes empty', () => {
    const unitsAlive: CombatUnit[] = [
      makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true, formationCol: 0 }),
      makeUnit('a2', 'LYRA', 'ally', 'middle', { formationCol: 0 }),
      makeUnit('a3', 'REX', 'ally', 'back', { formationCol: 0 }),
      makeUnit('e1', 'Vanguard 1', 'enemy', 'front', { formationCol: 0 }),
      makeUnit('e2', 'Vanguard 2', 'enemy', 'front', { formationCol: 1 }),
      makeUnit('e3', 'Sniper', 'enemy', 'back', { formationCol: 0 }),
    ];

    // Kill one front enemy, then kill BOTH front enemies (front row empty)
    const unitsOneDead = unitsAlive.map((u) =>
      u.id === 'e1' ? { ...u, alive: false, hp: 0, shield: 0 } : u
    );
    const unitsFrontEmpty = unitsAlive.map((u) =>
      u.id === 'e1' || u.id === 'e2'
        ? { ...u, alive: false, hp: 0, shield: 0 }
        : u
    );

    // Desktop/landscape: all 6 row bands remain fixed and living unit positions remain unchanged
    {
      const vw = 720;
      const vh = 420;
      const lanesInitial = buildRowLanes(true, vw, vh, unitsAlive);
      const lanesOneDead = buildRowLanes(true, vw, vh, unitsOneDead);
      const lanesEmpty = buildRowLanes(true, vw, vh, unitsFrontEmpty);

      expect(lanesOneDead).toEqual(lanesInitial);
      expect(lanesEmpty).toEqual(lanesInitial);

      const posInitial = computeUnitPositions(unitsAlive, lanesInitial, true);
      const posOneDead = computeUnitPositions(unitsOneDead, lanesOneDead, true);
      const posEmpty = computeUnitPositions(unitsFrontEmpty, lanesEmpty, true);

      // Dead units have no ghost positions; all remaining living units stay in place
      expect(posOneDead.has('e1')).toBe(false);
      expect(posEmpty.has('e1')).toBe(false);
      expect(posEmpty.has('e2')).toBe(false);
      for (const u of unitsAlive.filter((x) => x.id !== 'e1' && x.id !== 'e2')) {
        expect(posEmpty.get(u.id)).toEqual(posInitial.get(u.id));
      }
      expect(posOneDead.get('p1')).toEqual(posInitial.get('p1'));
    }

    // Phone portrait: empty lane (0 alive) collapses to 20px line while dead units have no positions
    {
      const vw = 380;
      const vh = 520;
      const lanesEmptyPhone = buildRowLanes(false, vw, vh, unitsFrontEmpty);
      const collapsedEnemyFront = lanesEmptyPhone.find(
        (l) => l.side === 'enemy' && l.row === 'front'
      );
      expect(collapsedEnemyFront?.h).toBe(20);
      expect(collapsedEnemyFront?.isEmptyCollapsed).toBe(true);

      const posEmptyPhone = computeUnitPositions(
        unitsFrontEmpty,
        lanesEmptyPhone,
        false
      );
      expect(posEmptyPhone.has('e1')).toBe(false);
      expect(posEmptyPhone.has('e2')).toBe(false);
      expect(posEmptyPhone.has('e3')).toBe(true);
    }

    // Also verify rendered SVG [data-row-band] <rect> attributes and living unit marker transforms stay identical on PC
    const renderAndSnapshot = (units: CombatUnit[]) => {
      act(() => {
        root!.render(
          createElement(BattleRadarView, {
            battle: makeBattle(units),
            activeUnitId: 'p1',
            validBasicTargetIds: new Set(['e1', 'e2', 'e3']),
            canPlayerManualAct: false,
            hasSingleAllySkill: false,
            autoBattleEnabled: false,
            skipAnimations: false,
            battleSpeed: 1,
            effectsMode: 'full',
            layoutMode: 'pc',
            onSelectEnemy: vi.fn(),
            onSelectAlly: vi.fn(),
            onInspectUnit: vi.fn(),
          })
        );
      });

      const bands = Array.from(
        container!.querySelectorAll<SVGRectElement>('[data-row-band]')
      ).map((r) => ({
        band: r.getAttribute('data-row-band'),
        x: r.getAttribute('x'),
        y: r.getAttribute('y'),
        width: r.getAttribute('width'),
        height: r.getAttribute('height'),
      }));

      const markerTransforms = ['p1', 'a2', 'a3', 'e3'].map((id) => ({
        id,
        transform: container!
          .querySelector(`[data-testid="radar-unit-${id}"]`)
          ?.getAttribute('transform'),
      }));

      return { bands, markerTransforms };
    };

    const snapAlive = renderAndSnapshot(unitsAlive);
    const snapFrontEmpty = renderAndSnapshot(unitsFrontEmpty);
    expect(snapFrontEmpty.bands).toEqual(snapAlive.bands);
    expect(snapFrontEmpty.markerTransforms).toEqual(snapAlive.markerTransforms);
    expect(
      container!.querySelector('[data-testid="radar-unit-e1"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-unit-e2"]')
    ).toBeNull();
  });

  it('logs "<unit> moves to <row>" when retreat_back_eva changes a unit row and plays a short slide animation on radar', () => {
    const interceptor = makeUnit('p1', 'ZARA', 'ally', 'front', {
      isPlayer: true,
      classId: 'interceptor',
      sp: 40,
      equippedSkillIds: ['int_afterburn_slip'],
      skillLevels: { int_afterburn_slip: 1 },
    });
    const enemy = makeUnit('e1', 'Raider', 'enemy', 'front');

    const initialUnits = [interceptor, enemy];
    const initialBattle = makeBattle(initialUnits);
    const resolution = resolveUnitAction(
      initialUnits,
      'p1',
      'skill',
      'e1',
      1,
      undefined,
      () => 0.5,
      'int_afterburn_slip'
    );

    const movedUnit = resolution.updatedUnits.find((u) => u.id === 'p1')!;
    expect(movedUnit.row).toBe('back');

    const moveLog = resolution.logEntries.find(
      (entry) => entry.templateKey === 'log.unitMovesRow'
    );
    expect(moveLog).toBeDefined();
    expect(formatCombatLogMessage('en', moveLog!)).toBe('ZARA moves to BACK.');

    // Render radar before move, then after move -> triggers compositor-only slide animation
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: initialBattle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 1,
          effectsMode: 'full',
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: { ...initialBattle, units: resolution.updatedUnits },
          activeUnitId: 'e1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 1,
          effectsMode: 'full',
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const slideEl = container!.querySelector('[data-testid="vfx-row-slide-p1"]');
    expect(slideEl).not.toBeNull();
    expect(slideEl!.className).toContain('vfx-row-slide');
  });
});

describe('FX-fix: Effects debug counter toggle in "..." menu', () => {
  it('hides the effects debug counter by default and shows created / active / rendered counts when enabled', () => {
    useGameStore.getState().startBattle('border_outpost');
    const started = useGameStore.getState().battle!;
    const player = started.units.find((u) => u.isPlayer)!;
    const enemy = started.units.find((u) => u.side === 'enemy' && u.alive)!;

    useGameStore.setState({
      battleViewMode: 'radar',
      autoBattleEnabled: false,
      skipAnimations: false,
      battleSpeed: 1,
      battle: {
        ...started,
        fxEvents: [
          {
            id: 'fx_dbg_1',
            kind: 'laser',
            fromSide: 'ally',
            fromSlotIndex: 0,
            fromUnitId: player.id,
            toSide: 'enemy',
            toSlotIndices: [0],
            toUnitIds: [enemy.id],
            accentHex: '#38bdf8',
          },
        ],
        popups: [
          { id: 'pop_dbg_1', unitId: enemy.id, text: '-75', tone: 'damage' },
        ],
      },
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Hidden by default
    expect(
      container!.querySelector('[data-testid="radar-effects-debug-counter"]')
    ).toBeNull();

    // Open "..." menu and toggle Effects debug on
    const moreBtn = container!.querySelector(
      '[data-testid="battle-more-btn"]'
    ) as HTMLButtonElement;
    expect(moreBtn).not.toBeNull();
    act(() => {
      moreBtn.click();
    });

    const debugToggle = container!.querySelector(
      '[data-testid="battle-toggle-effects-debug"]'
    ) as HTMLButtonElement;
    expect(debugToggle).not.toBeNull();
    act(() => {
      debugToggle.click();
    });

    const counter = container!.querySelector(
      '[data-testid="radar-effects-debug-counter"]'
    );
    expect(counter).not.toBeNull();
    expect(Number(counter!.getAttribute('data-created'))).toBeGreaterThanOrEqual(2);
    expect(Number(counter!.getAttribute('data-active'))).toBeGreaterThanOrEqual(2);
    expect(Number(counter!.getAttribute('data-rendered'))).toBeGreaterThanOrEqual(2);
  });
});
