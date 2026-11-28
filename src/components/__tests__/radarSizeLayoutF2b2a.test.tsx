// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatRow, CombatUnit } from '../../types/game';
import {
  computeDesktopLaneFit,
  estimateRadarRingOuterRadius,
  getBattleSizeClass,
  RADAR_SIZE_THRESHOLDS,
} from '../../utils/radarSizeLayout';
import {
  BattleRadarView,
  buildRowLanes,
  computeLaneTokenRadius,
  computeUnitPositions,
} from '../BattleRadarView';

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow,
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const alive = overrides.alive ?? true;
  return {
    id,
    name,
    callsign: name.slice(0, 6).toUpperCase(),
    side,
    classId: side === 'ally' ? 'striker' : 'interceptor',
    isPlayer: false,
    row,
    formationCol: 0,
    hp: alive ? 600 : 0,
    shield: alive ? 120 : 0,
    sp: 50,
    isDefending: false,
    alive,
    animState: 'idle',
    statuses: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 600,
      maxShield: 120,
      maxSp: 100,
      speed: 75,
      attackPower: 120,
      defenseRating: 45,
      dodgeChance: 8,
      critChance: 12,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    level: 10,
    skillLevel: 1,
    equippedSkillIds: [],
    skillLevels: {},
    skillCooldowns: {},
    usedOnceSkills: [],
    ...overrides,
  };
}

function makeBattle(units: CombatUnit[]): BattleState {
  return {
    sectorId: 's1',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    turnOrder: units.filter((u) => u.alive).map((u) => u.id),
    activeTurnIndex: 0,
    units,
    selectedTargetId: units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
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
  };
}

describe('TASK F2b-2a — Battle size classes + radar marker fit', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStore.setState({
      language: 'vi',
      battleViewMode: 'radar',
      autoBattleEnabled: false,
      skipAnimations: true,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  });

  it('1) getBattleSizeClass classifies 4/8 as small, 9 as medium, and 21 as large (alive + dead)', () => {
    expect(RADAR_SIZE_THRESHOLDS).toEqual({ smallMax: 8, mediumMax: 20 });

    const makeSide = (
      side: 'ally' | 'enemy',
      count: number,
      deadIndices: number[] = []
    ) =>
      Array.from({ length: count }, (_, i) =>
        makeUnit(`${side}_${i}`, `${side}${i}`, side, 'front', {
          alive: !deadIndices.includes(i),
        })
      );

    expect(
      getBattleSizeClass([...makeSide('ally', 4), ...makeSide('enemy', 4)])
    ).toBe('small');
    expect(
      getBattleSizeClass([...makeSide('ally', 8), ...makeSide('enemy', 8)])
    ).toBe('small');
    expect(
      getBattleSizeClass([
        ...makeSide('ally', 4),
        ...makeSide('enemy', 9, [0, 1, 2]),
      ])
    ).toBe('medium');
    expect(
      getBattleSizeClass([...makeSide('ally', 21), ...makeSide('enemy', 6)])
    ).toBe('large');
  });

  it('2) Desktop fit radius gives n=1,2 -> 41, n=3 -> 30, n=4 -> 22 in 366px lane', () => {
    const lanes = buildRowLanes(true, 720, 420);
    const allyFront = lanes.find((l) => l.side === 'ally' && l.row === 'front')!;
    expect(allyFront.h).toBe(366);

    expect(computeLaneTokenRadius(true, allyFront, 1, 4)).toBe(41);
    expect(computeLaneTokenRadius(true, allyFront, 2, 4)).toBe(41);
    expect(computeLaneTokenRadius(true, allyFront, 3, 4)).toBe(30);
    expect(computeLaneTokenRadius(true, allyFront, 4, 4)).toBe(22);
  });

  it('3) 5 ships in 366px lane: no vertical overlap & name plates inside lane, no chip row; 8 ships use 2 sub-columns without overlap', () => {
    const lanes = buildRowLanes(true, 720, 420);
    const enemyFront = lanes.find(
      (l) => l.side === 'enemy' && l.row === 'front'
    )!;

    const fiveShips = [
      makeUnit('p1', 'Leader', 'ally', 'front', { isPlayer: true }),
      ...Array.from({ length: 5 }, (_, i) =>
        makeUnit(`e5_${i}`, `Enemy5-${i}`, 'enemy', 'front', {
          formationCol: i,
          statuses: [
            { type: 'shield_break', turnsRemaining: 2, sourceSkillId: 'p1' },
          ],
        })
      ),
    ];

    const fit5 = computeDesktopLaneFit(enemyFront.h, 5);
    expect(fit5.subColumns).toBe(1);
    expect(fit5.showMiniChips).toBe(false);
    const r5 = computeLaneTokenRadius(true, enemyFront, 5, 1);
    const outer5 = estimateRadarRingOuterRadius(r5);
    const pos5 = computeUnitPositions(fiveShips, lanes, true);
    const ys5 = fiveShips
      .filter((u) => u.side === 'enemy')
      .map((u) => pos5.get(u.id)!);

    for (let i = 1; i < ys5.length; i++) {
      expect(ys5[i].y - ys5[i - 1].y).toBeGreaterThanOrEqual(2 * r5 + 12);
    }
    for (const p of ys5) {
      expect(p.x).toBeGreaterThanOrEqual(8);
      expect(p.y - outer5).toBeGreaterThanOrEqual(enemyFront.y + 20);
      expect(p.y + outer5 + 16).toBeLessThanOrEqual(enemyFront.y + enemyFront.h);
    }

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: makeBattle(fiveShips),
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e5_0']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: true,
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });
    const radarRoot = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    );
    expect(radarRoot?.getAttribute('data-size-class')).toBe('small');
    expect(
      container!.querySelector('[data-testid="radar-status-e5_0"]')
    ).toBeNull();

    const eightShips = [
      makeUnit('p1', 'Leader', 'ally', 'front', { isPlayer: true }),
      ...Array.from({ length: 8 }, (_, i) =>
        makeUnit(`e8_${i}`, `Enemy8-${i}`, 'enemy', 'front', {
          formationCol: i,
        })
      ),
    ];
    const fit8 = computeDesktopLaneFit(enemyFront.h, 8);
    expect(fit8.subColumns).toBe(2);
    expect(fit8.perColumnCount).toBe(4);
    expect(fit8.showMiniChips).toBe(false);
    const r8 = computeLaneTokenRadius(true, enemyFront, 8, 1);
    const outer8 = estimateRadarRingOuterRadius(r8);
    const pos8 = computeUnitPositions(eightShips, lanes, true);
    const coords8 = eightShips
      .filter((u) => u.side === 'enemy')
      .map((u) => pos8.get(u.id)!);

    const distinctXs = Array.from(new Set(coords8.map((c) => Number(c.x.toFixed(2)))));
    expect(distinctXs).toEqual([
      Number((enemyFront.x + enemyFront.w * 0.25).toFixed(2)),
      Number((enemyFront.x + enemyFront.w * 0.75).toFixed(2)),
    ]);

    for (const colX of distinctXs) {
      const colYs = coords8
        .filter((c) => Math.abs(c.x - colX) < 0.1)
        .map((c) => c.y)
        .sort((a, b) => a - b);
      expect(colYs.length).toBe(4);
      for (let i = 1; i < colYs.length; i++) {
        expect(colYs[i] - colYs[i - 1]).toBeGreaterThanOrEqual(2 * r8 + 12);
      }
      for (const y of colYs) {
        expect(y + outer8 + 16).toBeLessThanOrEqual(enemyFront.y + enemyFront.h);
      }
    }
  });

  it('4) Lanes with 2 units preserve radius 41 and exact legacy y positions', () => {
    const lanes = buildRowLanes(true, 720, 420);
    const allyFront = lanes.find((l) => l.side === 'ally' && l.row === 'front')!;
    expect(computeLaneTokenRadius(true, allyFront, 2, 2)).toBe(41);

    const twoUnits = [
      makeUnit('a0', 'Alpha', 'ally', 'front', { formationCol: 0 }),
      makeUnit('a1', 'Beta', 'ally', 'front', { formationCol: 1 }),
    ];
    const pos = computeUnitPositions(twoUnits, lanes, true);
    const p0 = pos.get('a0')!;
    const p1 = pos.get('a1')!;

    expect(p0.x).toBeCloseTo(allyFront.x + allyFront.w / 2, 2);
    expect(p1.x).toBeCloseTo(allyFront.x + allyFront.w / 2, 2);
    expect(p0.y).toBeCloseTo(allyFront.y + 90, 2);
    expect(p1.y).toBeCloseTo(allyFront.y + allyFront.h - 78, 2);
  });
});
