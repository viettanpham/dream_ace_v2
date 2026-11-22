// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { sortTurnOrder } from '../../engine/combat';
import { useGameStore } from '../../store/useGameStore';
import type {
  ActiveStatusEffect,
  BattleState,
  CombatRow,
  CombatUnit,
  MechClassId,
} from '../../types/game';
import {
  computeDefeatFadeDurationMs,
  computeRadarFxDurationMs,
  evaluateRadarTargetValidity,
  RADAR_LEGEND_STORAGE_KEY,
  RADAR_MIN_HIT_AREA_PX,
} from '../../utils/battleDisplay';
import { BattleRadarView } from '../BattleRadarView';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow,
  opts?: {
    classId?: MechClassId;
    isPlayer?: boolean;
    isBoss?: boolean;
    alive?: boolean;
    hasLongRangeWeapon?: boolean;
    statuses?: ActiveStatusEffect[];
    animState?: CombatUnit['animState'];
    speed?: number;
  }
): CombatUnit {
  const alive = opts?.alive ?? true;
  const maxHp = 400;
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: 0,
    isPlayer: Boolean(opts?.isPlayer),
    classId:
      opts?.classId ??
      (row === 'back' ? 'siege' : row === 'middle' ? 'support' : 'striker'),
    hasLongRangeWeapon: opts?.hasLongRangeWeapon,
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
    statuses: opts?.statuses ?? [],
    animState: opts?.animState ?? 'idle',
  };
}

function makeBattle(
  units: CombatUnit[],
  overrides?: Partial<BattleState>
): BattleState {
  const turnOrder = sortTurnOrder(units);
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 0,
    turnOrder,
    activeTurnIndex: 0,
    units,
    selectedTargetId: 'enemy_front',
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

function mockReducedMotion(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
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

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  mockReducedMotion(false);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGameStore.getState().setLanguage('en');
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
  vi.restoreAllMocks();
});

describe('1) Target validity function (3-row order + long-range / Siege override)', () => {
  it('enforces Front -> Middle -> Back for standard actors and reports blocking row reason', () => {
    const striker = makeUnit('p1', 'ZARA', 'ally', 'front', {
      classId: 'striker',
      isPlayer: true,
    });
    const eFront = makeUnit('ef', 'Vanguard', 'enemy', 'front');
    const eMid = makeUnit('em', 'Interceptor', 'enemy', 'middle');
    const eBack = makeUnit('eb', 'Artillery', 'enemy', 'back');
    const units = [striker, eFront, eMid, eBack];

    // Front alive: only Front valid; Middle & Back blocked by front row
    expect(evaluateRadarTargetValidity(units, striker, eFront)).toMatchObject({
      valid: true,
      blockedByRow: false,
      reason: null,
    });
    expect(evaluateRadarTargetValidity(units, striker, eMid)).toMatchObject({
      valid: false,
      blockedByRow: true,
      reason: 'front_row_alive',
      blockingRow: 'front',
    });
    expect(evaluateRadarTargetValidity(units, striker, eBack)).toMatchObject({
      valid: false,
      blockedByRow: true,
      reason: 'front_row_alive',
      blockingRow: 'front',
    });

    // Wipe Front: Middle exposed & valid; Back blocked by middle row; Down Front invalid
    const deadFront = { ...eFront, alive: false, hp: 0 };
    const afterFrontWipe = [striker, deadFront, eMid, eBack];
    expect(
      evaluateRadarTargetValidity(afterFrontWipe, striker, deadFront)
    ).toMatchObject({
      valid: false,
      blockedByRow: false,
      reason: 'unit_down',
    });
    expect(
      evaluateRadarTargetValidity(afterFrontWipe, striker, eMid)
    ).toMatchObject({
      valid: true,
      blockedByRow: false,
      reason: null,
    });
    expect(
      evaluateRadarTargetValidity(afterFrontWipe, striker, eBack)
    ).toMatchObject({
      valid: false,
      blockedByRow: true,
      reason: 'middle_row_alive',
      blockingRow: 'middle',
    });

    // Wipe Middle too: Back becomes valid
    const deadMid = { ...eMid, alive: false, hp: 0 };
    const afterMidWipe = [striker, deadFront, deadMid, eBack];
    expect(
      evaluateRadarTargetValidity(afterMidWipe, striker, eBack)
    ).toMatchObject({
      valid: true,
      blockedByRow: false,
      reason: null,
    });
  });

  it('allows Siege class and long-range weapon actors to target every enemy row', () => {
    const siegeActor = makeUnit('p_siege', 'BASTION', 'ally', 'back', {
      classId: 'siege',
      isPlayer: true,
    });
    const longRangeStriker = makeUnit('p_lr', 'RAIL', 'ally', 'front', {
      classId: 'striker',
      isPlayer: true,
      hasLongRangeWeapon: true,
    });
    const eFront = makeUnit('ef', 'Vanguard', 'enemy', 'front');
    const eMid = makeUnit('em', 'Midliner', 'enemy', 'middle');
    const eBack = makeUnit('eb', 'Backliner', 'enemy', 'back');

    for (const actor of [siegeActor, longRangeStriker]) {
      const units = [actor, eFront, eMid, eBack];
      for (const target of [eFront, eMid, eBack]) {
        expect(evaluateRadarTargetValidity(units, actor, target)).toMatchObject({
          valid: true,
          blockedByRow: false,
          reason: null,
          ignoresRowBlocking: true,
        });
      }
    }
  });
});

describe('2) Invalid-target toast reason, lock icons, target rings/arrow, shapes & status overflow', () => {
  it('shows lock icons on blocked rows, displays one-line toast reason on invalid tap, and selects valid targets', () => {
    const onSelectEnemy = vi.fn();
    const onInvalidTargetLog = vi.fn();
    const player = makeUnit('p1', 'ZARA', 'ally', 'front', {
      classId: 'striker',
      isPlayer: true,
      speed: 90,
    });
    const ally = makeUnit('a2', 'Nova', 'ally', 'middle', {
      classId: 'support',
      speed: 70,
    });
    const eFront = makeUnit('enemy_front', 'Raider 1', 'enemy', 'front', {
      speed: 80,
      statuses: [
        { type: 'burn', turnsRemaining: 2, isDebuff: true },
        { type: 'slow', turnsRemaining: 2, isDebuff: true },
        { type: 'def_down', turnsRemaining: 2, isDebuff: true },
        { type: 'vulnerable', turnsRemaining: 2, isDebuff: true },
      ],
    });
    const eMid = makeUnit('enemy_mid', 'Raider 2', 'enemy', 'middle', {
      speed: 65,
    });
    const eBackBoss = makeUnit('enemy_back', 'Dreadnought', 'enemy', 'back', {
      isBoss: true,
      speed: 50,
    });
    const eDown = makeUnit('enemy_down', 'Fallen Drone', 'enemy', 'front', {
      alive: false,
      speed: 40,
    });

    const battle = makeBattle([player, ally, eFront, eMid, eBackBoss, eDown], {
      selectedTargetId: 'enemy_front',
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['enemy_front']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 1,
          layoutMode: 'phone-portrait',
          onSelectEnemy,
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
          onInvalidTargetLog,
        })
      );
    });

    // Acting ring, target ring, and aim arrow are rendered
    expect(
      container!.querySelector('[data-testid="radar-acting-ring-p1"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-target-ring-enemy_front"]')
    ).not.toBeNull();
    const arrow = container!.querySelector('[data-testid="radar-target-arrow"]');
    expect(arrow).not.toBeNull();
    expect(arrow!.getAttribute('data-from')).toBe('p1');
    expect(arrow!.getAttribute('data-to')).toBe('enemy_front');

    // Distinct color-blind marker shapes
    expect(
      container!
        .querySelector('[data-testid="radar-unit-p1"]')
        ?.getAttribute('data-marker-shape')
    ).toBe('player-hex');
    expect(
      container!
        .querySelector('[data-testid="radar-unit-a2"]')
        ?.getAttribute('data-marker-shape')
    ).toBe('ally-circle');
    expect(
      container!
        .querySelector('[data-testid="radar-unit-enemy_front"]')
        ?.getAttribute('data-marker-shape')
    ).toBe('enemy-diamond');
    expect(
      container!
        .querySelector('[data-testid="radar-unit-enemy_back"]')
        ?.getAttribute('data-marker-shape')
    ).toBe('boss-fortress');

    // Up to 3 status icons + "+1" overflow for 4 statuses (G3b)
    expect(
      container!.querySelector(
        '[data-testid="radar-status-icon-enemy_front-0"]'
      )
    ).not.toBeNull();
    expect(
      container!.querySelector(
        '[data-testid="radar-status-icon-enemy_front-1"]'
      )
    ).not.toBeNull();
    expect(
      container!.querySelector(
        '[data-testid="radar-status-icon-enemy_front-2"]'
      )
    ).not.toBeNull();
    expect(
      container!.querySelector(
        '[data-testid="radar-status-icon-enemy_front-3"]'
      )
    ).toBeNull();
    expect(
      container!.querySelector(
        '[data-testid="radar-status-overflow-enemy_front"]'
      )?.textContent
    ).toBe('+1');

    // Front enemy has no lock; Middle & Back enemies show lock icon
    expect(
      container!.querySelector('[data-testid="radar-lock-enemy_front"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-lock-enemy_mid"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-lock-enemy_back"]')
    ).not.toBeNull();

    // Tapping blocked Back enemy does NOT select it, logs reason via onInvalidTargetLog, and renders ZERO toast chips over radar
    const backEl = container!.querySelector(
      '[data-testid="radar-unit-enemy_back"]'
    ) as SVGGElement;
    act(() => {
      backEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectEnemy).not.toHaveBeenCalled();
    expect(
      container!.querySelector('[data-testid="radar-invalid-target-toast"]')
    ).toBeNull();
    expect(onInvalidTargetLog).toHaveBeenCalledWith(
      'front_row_alive',
      expect.objectContaining({ id: 'enemy_back' })
    );

    // Dead units have NO ghost marker on radar (G4a-3a Item 5)
    expect(
      container!.querySelector('[data-testid="radar-unit-enemy_down"]')
    ).toBeNull();

    // Switch actor to Siege -> every row becomes targetable, zero lock icons, tapping Back selects it
    const siegePlayer = { ...player, classId: 'siege' as MechClassId };
    const siegeBattle = makeBattle(
      [siegePlayer, ally, eFront, eMid, eBackBoss, eDown],
      { selectedTargetId: 'enemy_front' }
    );
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: siegeBattle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set([
            'enemy_front',
            'enemy_mid',
            'enemy_back',
          ]),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 1,
          layoutMode: 'phone-portrait',
          onSelectEnemy,
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    expect(
      container!.querySelector('[data-testid="radar-lock-enemy_mid"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-lock-enemy_back"]')
    ).toBeNull();

    const siegeBackEl = container!.querySelector(
      '[data-testid="radar-unit-enemy_back"]'
    ) as SVGGElement;
    act(() => {
      siegeBackEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectEnemy).toHaveBeenCalledWith('enemy_back');
  });
});

describe('3) Invisible hit-area size >= 44px across portrait and landscape', () => {
  it('renders every unit with an invisible hit area >= 44px in both phone portrait and landscape PC', () => {
    const units = [
      makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true }),
      makeUnit('e1', 'Raider 1', 'enemy', 'front'),
    ];
    const battle = makeBattle(units, { squadSize: 8 });

    for (const mode of ['phone-portrait', 'pc'] as const) {
      act(() => {
        root!.render(
          createElement(BattleRadarView, {
            battle,
            activeUnitId: 'p1',
            validBasicTargetIds: new Set(['e1']),
            canPlayerManualAct: true,
            hasSingleAllySkill: false,
            autoBattleEnabled: false,
            skipAnimations: false,
            layoutMode: mode,
            onSelectEnemy: vi.fn(),
            onSelectAlly: vi.fn(),
            onInspectUnit: vi.fn(),
          })
        );
      });

      for (const u of units) {
        const hitEl = container!.querySelector(
          `[data-testid="radar-hit-area-${u.id}"]`
        );
        expect(hitEl).not.toBeNull();
        const width = Number(hitEl!.getAttribute('width'));
        const height = Number(hitEl!.getAttribute('height'));
        expect(width).toBeGreaterThanOrEqual(RADAR_MIN_HIT_AREA_PX);
        expect(height).toBeGreaterThanOrEqual(RADAR_MIN_HIT_AREA_PX);
      }

      const legendToggle = container!.querySelector(
        '[data-testid="radar-legend-toggle"]'
      );
      if (mode === 'phone-portrait') {
        expect(legendToggle?.className).toContain('h-8');
        expect(legendToggle?.className).toContain('min-h-[32px]');
      } else {
        expect(legendToggle?.className).toContain('min-h-[44px]');
      }
    }
  });
});

describe('4) Collapsible legend default closed & localStorage persistence', () => {
  it('starts closed by default, persists open state to localStorage, and restores across remounts', () => {
    const battle = makeBattle([
      makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true }),
      makeUnit('e1', 'Raider 1', 'enemy', 'front'),
    ]);

    const renderRadar = () => {
      act(() => {
        root!.render(
          createElement(BattleRadarView, {
            battle,
            activeUnitId: 'p1',
            validBasicTargetIds: new Set(['e1']),
            canPlayerManualAct: true,
            hasSingleAllySkill: false,
            autoBattleEnabled: false,
            skipAnimations: false,
            layoutMode: 'phone-portrait',
            onSelectEnemy: vi.fn(),
            onSelectAlly: vi.fn(),
            onInspectUnit: vi.fn(),
          })
        );
      });
    };

    // Closed by default
    renderRadar();
    const toggle1 = container!.querySelector(
      '[data-testid="radar-legend-toggle"]'
    ) as HTMLButtonElement;
    expect(toggle1.getAttribute('aria-expanded')).toBe('false');
    expect(
      container!.querySelector('[data-testid="radar-legend-panel"]')
    ).toBeNull();

    // Open legend -> saved to localStorage
    act(() => {
      toggle1.click();
    });
    expect(toggle1.getAttribute('aria-expanded')).toBe('true');
    expect(
      container!.querySelector('[data-testid="radar-legend-panel"]')
    ).not.toBeNull();
    expect(window.localStorage.getItem(RADAR_LEGEND_STORAGE_KEY)).toBe('true');

    // Unmount and remount fresh instance -> restores open state
    act(() => {
      root!.unmount();
    });
    root = createRoot(container!);
    renderRadar();
    const toggle2 = container!.querySelector(
      '[data-testid="radar-legend-toggle"]'
    ) as HTMLButtonElement;
    expect(toggle2.getAttribute('aria-expanded')).toBe('true');
    expect(
      container!.querySelector('[data-testid="radar-legend-panel"]')
    ).not.toBeNull();

    // Close legend -> persists 'false'
    act(() => {
      toggle2.click();
    });
    expect(window.localStorage.getItem(RADAR_LEGEND_STORAGE_KEY)).toBe('false');
    expect(
      container!.querySelector('[data-testid="radar-legend-panel"]')
    ).toBeNull();
  });
});

describe('5) Animations respect prefers-reduced-motion and scale with battle speed', () => {
  it('scales attack projectile/beam (300-500ms at x1) and defeat fade (~400ms at x1) by battleSpeed', () => {
    const laserX1 = computeRadarFxDurationMs('laser', 1);
    const missileX1 = computeRadarFxDurationMs('missile', 1);
    const railgunX1 = computeRadarFxDurationMs('railgun', 1);
    expect(laserX1).toBeGreaterThanOrEqual(300);
    expect(laserX1).toBeLessThanOrEqual(500);
    expect(missileX1).toBeGreaterThanOrEqual(300);
    expect(missileX1).toBeLessThanOrEqual(500);
    expect(railgunX1).toBeGreaterThanOrEqual(300);
    expect(railgunX1).toBeLessThanOrEqual(500);

    expect(computeRadarFxDurationMs('laser', 2)).toBeLessThan(laserX1);
    expect(computeRadarFxDurationMs('laser', 3)).toBeLessThan(
      computeRadarFxDurationMs('laser', 2)
    );
    expect(computeDefeatFadeDurationMs(1)).toBe(400);
    expect(computeDefeatFadeDurationMs(2)).toBe(200);
  });

  it('preserves core feedback under reduced motion and skips all animated FX when skipAnimations is enabled', () => {
    const battleWithFx = makeBattle(
      [
        makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true }),
        makeUnit('e1', 'Raider 1', 'enemy', 'front', { animState: 'hit' }),
        makeUnit('e2', 'Raider 2', 'enemy', 'middle', { alive: false }),
      ],
      {
        fxEvents: [
          {
            id: 'fx_1',
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
        explodedUnitIds: ['e2'],
        popups: [{ id: 'pop_1', unitId: 'e1', text: '-120', tone: 'damage' }],
      }
    );

    // 1) Normal motion (prefers-reduced-motion: no-preference): FX, hit flash, defeat fade, sweep all render
    mockReducedMotion(false);
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: battleWithFx,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 2,
          layoutMode: 'phone-portrait',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    expect(
      container!
        .querySelector('[data-testid="battle-radar-container"]')
        ?.getAttribute('data-animations-skipped')
    ).toBe('false');
    const fxNode = container!.querySelector('[data-testid="radar-fx-fx_1"]');
    expect(fxNode).not.toBeNull();
    expect(Number(fxNode!.getAttribute('data-fx-duration'))).toBe(
      computeRadarFxDurationMs('laser', 2)
    );
    expect(
      container!.querySelector('[data-testid="radar-hit-flash-e1"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-defeat-fade-e2"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-sweep-layer"]')
    ).not.toBeNull();

    // 2) Reduced motion (mode='system' + OS reduce): ambient sweep skipped, core feedback stays visible as fade-only markers
    act(() => {
      root!.unmount();
    });
    mockReducedMotion(true);
    root = createRoot(container!);

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: battleWithFx,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 1,
          reducedMotionMode: 'system',
          layoutMode: 'phone-portrait',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    expect(
      container!
        .querySelector('[data-testid="battle-radar-container"]')
        ?.getAttribute('data-reduced-motion')
    ).toBe('true');
    expect(
      container!
        .querySelector('[data-testid="radar-fx-fx_1"]')
        ?.getAttribute('data-reduced-marker')
    ).toBe('true');
    expect(
      container!.querySelector('[data-testid="radar-hit-flash-e1"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="damage-popup"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-sweep-layer"]')
    ).toBeNull();

    // 3) Explicit skipAnimations=true: all animated FX and popups are skipped
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: battleWithFx,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: true,
          battleSpeed: 1,
          layoutMode: 'phone-portrait',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    expect(
      container!
        .querySelector('[data-testid="battle-radar-container"]')
        ?.getAttribute('data-animations-skipped')
    ).toBe('true');
    expect(
      container!.querySelector('[data-testid="radar-fx-fx_1"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-hit-flash-e1"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-defeat-fade-e2"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-sweep-layer"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="damage-popup"]')
    ).toBeNull();
  });
});
