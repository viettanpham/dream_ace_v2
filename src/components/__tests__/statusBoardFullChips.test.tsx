// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { createDefaultAdminConfig } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { ActiveStatusEffect, CombatUnit } from '../../types/game';
import {
  CARD_STATUS_FALLBACK_WIDTH_PX,
  countStatusChipRows,
  getFixedStatusAreaHeightPx,
} from '../FixedStatusArea';
import { RadarStatusBoard } from '../RadarStatusBoard';

const POOL_STATUSES: ActiveStatusEffect[] = [
  { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
  { type: 'burn', turnsRemaining: 2, isDebuff: true, magnitude: 0.1 },
  { type: 'def_down', turnsRemaining: 3, isDebuff: true, magnitude: 0.25 },
  { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
  { type: 'spd_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.3 },
  { type: 'def_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
  { type: 'eva_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.25 },
];

function statusesForRowCount(
  targetRows: 1 | 2 | 3,
  containerWidthPx = CARD_STATUS_FALLBACK_WIDTH_PX
): ActiveStatusEffect[] {
  for (let n = 1; n <= POOL_STATUSES.length; n += 1) {
    const slice = POOL_STATUSES.slice(0, n);
    const rows = countStatusChipRows(slice, {
      lang: 'vi',
      showLabels: true,
      compact: false,
      containerWidthPx,
    });
    if (rows === targetRows) return slice;
  }
  throw new Error(`Could not build ${targetRows} rows from POOL_STATUSES`);
}

function setViewport(width: number, height = 844) {
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
  statuses: ActiveStatusEffect[],
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  return {
    id,
    name,
    callsign: name,
    side,
    row: overrides.row ?? 'front',
    formationCol: overrides.formationCol ?? 0,
    isPlayer: overrides.isPlayer ?? false,
    classId: overrides.classId ?? (side === 'ally' ? 'striker' : 'interceptor'),
    isBoss: false,
    level: 10,
    skillLevel: 1,
    skillLevels: { gen_hull_brace: 1 },
    equippedSkillIds: ['gen_hull_brace'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 900,
      maxShield: 200,
      maxSp: 100,
      speed: 55,
      attackPower: 120,
      defenseRating: 50,
      dodgeChance: 10,
      critChance: 15,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    hp: 900,
    shield: 200,
    sp: 60,
    isDefending: false,
    alive: true,
    statuses,
    animState: 'idle',
  };
}

describe('TASK STATUS-1 — RadarStatusBoard full card-mode chips', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    setViewport(1280, 800);
    window.localStorage.clear();
    useGameStore.setState({
      language: 'vi',
      adminConfig: createDefaultAdminConfig(),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    window.localStorage.clear();
  });

  it('1) Board reuses card-mode StatusChip with visible label, turns badge, and pill frame', () => {
    const units = [
      makeUnit(
        'p1',
        'Vance',
        'ally',
        [
          { type: 'slow', turnsRemaining: 3, isDebuff: true, magnitude: 0.3 },
          { type: 'atk_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.25 },
        ],
        { isPlayer: true }
      ),
    ];

    act(() => {
      root!.render(
        createElement(RadarStatusBoard, {
          units,
          variant: 'desktop',
          collapsed: false,
          onToggleCollapse: vi.fn(),
          onSelectUnit: vi.fn(),
        })
      );
    });

    const chip0 = container!.querySelector(
      '[data-testid="status-board-chip-p1-0"]'
    ) as HTMLElement;
    const label0 = container!.querySelector(
      '[data-testid="status-board-chip-label-p1-0"]'
    ) as HTMLElement;
    const turns0 = chip0.querySelector(
      '[data-testid="status-turns-number"]'
    ) as HTMLElement;

    expect(chip0).not.toBeNull();
    expect(chip0.className).not.toContain('!bg-transparent');
    expect(label0).not.toBeNull();
    expect(label0.textContent).toBe('-30% Tốc');
    expect(turns0.textContent).toBe('3');

    const label1 = container!.querySelector(
      '[data-testid="status-board-chip-label-p1-1"]'
    ) as HTMLElement;
    expect(label1.textContent).toBe('+25% ST');
  });

  it('2) Board row height uses max chip rows across Ta | Địch side by side and hides empty units', () => {
    const s1 = statusesForRowCount(1);
    const s2 = statusesForRowCount(2);
    const units = [
      makeUnit('a1', 'Ally 1', 'ally', s1, { isPlayer: true, formationCol: 0 }),
      makeUnit('a2', 'Ally 2', 'ally', s1, { row: 'middle', formationCol: 0 }),
      makeUnit('a_empty', 'No Status', 'ally', []),
      makeUnit('e1', 'Enemy 1', 'enemy', s2, { formationCol: 0 }),
      makeUnit('e2', 'Enemy 2', 'enemy', s1, { row: 'middle', formationCol: 0 }),
    ];

    act(() => {
      root!.render(
        createElement(RadarStatusBoard, {
          units,
          variant: 'desktop',
          collapsed: false,
          onToggleCollapse: vi.fn(),
          onSelectUnit: vi.fn(),
        })
      );
    });

    expect(
      container!.querySelector('[data-testid="status-board-row-a_empty"]')
    ).toBeNull();

    // Row 0 pair (a1=1 row, e1=2 rows) -> both sides get 2 rows (92px)
    const a1Area = container!.querySelector(
      '[data-testid="status-board-chips-a1"]'
    ) as HTMLElement;
    const e1Area = container!.querySelector(
      '[data-testid="status-board-chips-e1"]'
    ) as HTMLElement;
    expect(a1Area.getAttribute('data-status-area-rows')).toBe('2');
    expect(e1Area.getAttribute('data-status-area-rows')).toBe('2');
    expect(a1Area.style.height).toBe(`${getFixedStatusAreaHeightPx(2, false)}px`);
    expect(e1Area.style.height).toBe(`${getFixedStatusAreaHeightPx(2, false)}px`);

    // Row 1 pair (a2=1 row, e2=1 row) -> both sides get 1 row (46px)
    const a2Area = container!.querySelector(
      '[data-testid="status-board-chips-a2"]'
    ) as HTMLElement;
    const e2Area = container!.querySelector(
      '[data-testid="status-board-chips-e2"]'
    ) as HTMLElement;
    expect(a2Area.getAttribute('data-status-area-rows')).toBe('1');
    expect(e2Area.getAttribute('data-status-area-rows')).toBe('1');
    expect(a2Area.style.height).toBe(`${getFixedStatusAreaHeightPx(1, false)}px`);
    expect(e2Area.style.height).toBe(`${getFixedStatusAreaHeightPx(1, false)}px`);
  });

  it('3) Caps visible height at 2 rows and enables inner scroll + "+N" only when chip rows >= 3 (including phone stacked)', () => {
    const s2 = statusesForRowCount(2);
    const s3 = statusesForRowCount(3);
    const units = [
      makeUnit('p1', 'Vance', 'ally', s2, { isPlayer: true }),
      makeUnit('e1', 'Boss Drone', 'enemy', s3),
    ];

    act(() => {
      root!.render(
        createElement(RadarStatusBoard, {
          units,
          variant: 'desktop',
          collapsed: false,
          onToggleCollapse: vi.fn(),
          onSelectUnit: vi.fn(),
        })
      );
    });

    const p1Area = container!.querySelector(
      '[data-testid="status-board-chips-p1"]'
    ) as HTMLElement;
    const e1Area = container!.querySelector(
      '[data-testid="status-board-chips-e1"]'
    ) as HTMLElement;

    expect(p1Area.className).toContain('overflow-visible');
    expect(p1Area.className).not.toContain('overflow-y-auto');
    expect(
      container!.querySelector('[data-testid="status-board-overflow-p1"]')
    ).toBeNull();

    expect(e1Area.getAttribute('data-status-area-rows')).toBe('2');
    expect(e1Area.style.height).toBe(`${getFixedStatusAreaHeightPx(2, false)}px`);
    expect(e1Area.className).toContain('overflow-y-auto');
    const e1Overflow = container!.querySelector(
      '[data-testid="status-board-overflow-e1"]'
    ) as HTMLElement;
    expect(e1Overflow).not.toBeNull();
    expect(e1Overflow.textContent?.trim()).toMatch(/^\+\d+$/);

    // Phone: board body stays non-scrolling, only the >=3 row status area scrolls
    setViewport(390, 844);
    const phoneS3 = statusesForRowCount(3, 240);
    act(() => {
      root!.render(
        createElement(RadarStatusBoard, {
          units: [makeUnit('p1', 'Vance', 'ally', phoneS3, { isPlayer: true })],
          variant: 'phone',
          collapsed: false,
          onToggleCollapse: vi.fn(),
          onSelectUnit: vi.fn(),
        })
      );
    });
    const phoneBody = container!.querySelector(
      '[data-testid="status-board-body"]'
    ) as HTMLElement;
    expect(phoneBody.className).not.toContain('overflow-y-auto');
    const phoneArea = container!.querySelector(
      '[data-testid="status-board-chips-p1"]'
    ) as HTMLElement;
    expect(phoneArea.className).toContain('overflow-y-auto');
  });

  it('4) Clicking a chip opens the status popover (bottom sheet on phone), while clicking unit name selects the unit', () => {
    const onSelectUnit = vi.fn();
    const units = [
      makeUnit(
        'p1',
        'Vance',
        'ally',
        [{ type: 'atk_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.25 }],
        { isPlayer: true }
      ),
    ];

    act(() => {
      root!.render(
        createElement(RadarStatusBoard, {
          units,
          variant: 'desktop',
          collapsed: false,
          onToggleCollapse: vi.fn(),
          onSelectUnit,
        })
      );
    });

    const chip0 = container!.querySelector(
      '[data-testid="status-board-chip-p1-0"]'
    ) as HTMLElement;
    act(() => {
      chip0.click();
    });

    expect(onSelectUnit).not.toHaveBeenCalled();
    expect(
      container!.querySelector('[data-testid="status-area-popover"]')
    ).not.toBeNull();

    const closeBtn = container!.querySelector(
      '[data-testid="status-area-popover-close"]'
    ) as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="status-area-popover"]')
    ).toBeNull();

    const nameBtn = container!.querySelector(
      '[data-testid="status-board-name-p1"]'
    ) as HTMLButtonElement;
    act(() => {
      nameBtn.click();
    });
    expect(onSelectUnit).toHaveBeenCalledTimes(1);
    expect(onSelectUnit.mock.calls[0][0].id).toBe('p1');

    // Phone opens BottomSheet
    setViewport(390, 844);
    act(() => {
      root!.render(
        createElement(RadarStatusBoard, {
          units,
          variant: 'phone',
          collapsed: false,
          onToggleCollapse: vi.fn(),
          onSelectUnit,
        })
      );
    });
    const phoneChip = container!.querySelector(
      '[data-testid="status-board-chip-p1-0"]'
    ) as HTMLElement;
    act(() => {
      phoneChip.click();
    });
    expect(
      container!.querySelector('[data-testid="status-area-sheet-body"]')
    ).not.toBeNull();
  });
});
