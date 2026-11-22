// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { useGameStore } from '../../store/useGameStore';
import type {
  ActiveStatusEffect,
  BattleState,
  CombatRow,
  CombatUnit,
} from '../../types/game';
import {
  STATUS_AREA_PAD_X_PX,
  STATUS_BADGE_SAFE_PX,
  STATUS_CHIP_FRAME_PX,
  STATUS_DISPLAY_STORAGE_KEY,
  STATUS_ROW_GAP_PX,
} from '../../utils/statusDisplayPrefs';
import { BattleScreen } from '../BattleScreen';
import {
  CARD_STATUS_FALLBACK_WIDTH_PX,
  countStatusChipRows,
  getFixedStatusAreaHeightPx,
} from '../FixedStatusArea';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow,
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

const POOL_STATUSES: ActiveStatusEffect[] = [
  { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
  { type: 'burn', turnsRemaining: 2, isDebuff: true, magnitude: 0.1 },
  { type: 'def_down', turnsRemaining: 3, isDebuff: true, magnitude: 0.25 },
  { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.2 },
  { type: 'spd_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.3 },
  { type: 'def_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
  { type: 'eva_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.25 },
];

function statusesForRowCount(targetRows: 0 | 1 | 2 | 3): ActiveStatusEffect[] {
  if (targetRows === 0) return [];
  for (let n = 1; n <= POOL_STATUSES.length; n += 1) {
    const slice = POOL_STATUSES.slice(0, n);
    const rows = countStatusChipRows(slice, {
      lang: 'vi',
      showLabels: true,
      compact: false,
      containerWidthPx: CARD_STATUS_FALLBACK_WIDTH_PX,
    });
    if (rows === targetRows) return slice;
  }
  throw new Error(`Could not build ${targetRows} rows from POOL_STATUSES`);
}

describe('TASK G4a-2c — Card mode: lane grid + dynamic status rows + compact cards', () => {
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

  it('1) Card lane headers contain ONLY lane name (no Lộ diện/Bảo vệ/Trống), exposed lane keeps bright border, and desktop sides share one grid row', () => {
    setViewport(1440, 900);
    const battle = makeBattle([
      makeUnit('a_f', 'Ally Front', 'ally', 'front', { isPlayer: true }),
      // ally middle & enemy middle both empty -> 20px line only
      makeUnit('a_b', 'Ally Back', 'ally', 'back'), // enemy back empty -> empty box, no text
      makeUnit('e_f', 'Enemy Front', 'enemy', 'front'),
    ]);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const cardView = container!.querySelector(
      '[data-testid="battle-card-view"]'
    ) as HTMLElement;
    expect(cardView).not.toBeNull();
    expect(cardView.textContent).not.toContain('Lộ diện');
    expect(cardView.textContent).not.toContain('Bảo vệ');
    expect(cardView.textContent).not.toContain('Trống');

    // Single grid with Đồng minh | Kẻ địch headers once at top
    const grid = cardView.querySelector(
      '[data-testid="card-lane-grid"]'
    ) as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
    expect(grid.className).toContain('items-stretch');

    expect(cardView.querySelectorAll('[data-testid="card-side-ally"]')).toHaveLength(1);
    expect(cardView.querySelectorAll('[data-testid="card-side-enemy"]')).toHaveLength(1);

    // Front row cells share the same grid parent consecutively
    const directChildren = Array.from(grid.children) as HTMLElement[];
    const allyFrontIdx = directChildren.findIndex(
      (el) => el.getAttribute('data-card-row') === 'ally-front'
    );
    const enemyFrontIdx = directChildren.findIndex(
      (el) => el.getAttribute('data-card-row') === 'enemy-front'
    );
    expect(allyFrontIdx).toBeGreaterThanOrEqual(2);
    expect(enemyFrontIdx).toBe(allyFrontIdx + 1);

    // Exposed lane keeps bright red/sky border; protected/empty keeps dim dashed border
    const enemyFront = directChildren[enemyFrontIdx];
    const allyFront = directChildren[allyFrontIdx];
    expect(enemyFront.getAttribute('data-row-state')).toBe('exposed');
    expect(enemyFront.className).toContain('border-red-500/45');
    expect(allyFront.getAttribute('data-row-state')).toBe('exposed');
    expect(allyFront.className).toContain('border-sky-500/45');

    // Both-empty middle lane = one 20px line (name only, col-span-2)
    const emptyMiddle = grid.querySelector(
      '[data-card-row-empty="middle"]'
    ) as HTMLElement;
    expect(emptyMiddle).not.toBeNull();
    expect(emptyMiddle.className).toContain('col-span-2');
    expect(emptyMiddle.className).toContain('h-[20px]');
    expect(emptyMiddle.textContent?.trim()).toBe('TRUNG TUYẾN');
    expect(grid.querySelector('[data-card-row="ally-middle"]')).toBeNull();
    expect(grid.querySelector('[data-card-row="enemy-middle"]')).toBeNull();

    // One-side empty cell (enemy-back) = empty box, no text
    const enemyBack = grid.querySelector(
      '[data-card-row="enemy-back"]'
    ) as HTMLElement;
    expect(enemyBack).not.toBeNull();
    expect(enemyBack.className).toContain('border-dashed');
    expect(enemyBack.textContent?.trim()).toBe('');

    // Ally back (populated) has lane name only
    const allyBack = grid.querySelector(
      '[data-card-row="ally-back"]'
    ) as HTMLElement;
    expect(allyBack.getAttribute('data-row-state')).toBe('protected');
    expect(allyBack.className).toContain('border-dashed');
    expect(allyBack.textContent).toContain('HẬU TUYẾN');
  });

  it('2) Enforces max-per-lane dynamic status rows (Tiền 1,1|2,1 -> 2; Trung 1,2,1|0,3 -> cap 2 + scroll + "+N"; Hậu 0 -> omitted), heights 0/46/92, safe padding, and ignores activeUnitRows', () => {
    setViewport(1440, 900);
    // Even if user/admin activeUnitRows is set to 1, CARD mode ignores it
    window.localStorage.setItem(
      STATUS_DISPLAY_STORAGE_KEY,
      JSON.stringify({ desktopRows: 1, phoneRows: 1 })
    );

    const s0 = statusesForRowCount(0);
    const s1 = statusesForRowCount(1);
    const s2 = statusesForRowCount(2);
    const s3 = statusesForRowCount(3);

    expect(getFixedStatusAreaHeightPx(0, false)).toBe(0);
    expect(getFixedStatusAreaHeightPx(1, false)).toBe(
      STATUS_CHIP_FRAME_PX + STATUS_ROW_GAP_PX
    ); // 46
    expect(getFixedStatusAreaHeightPx(2, false)).toBe(
      2 * (STATUS_CHIP_FRAME_PX + STATUS_ROW_GAP_PX)
    ); // 92

    const battle = makeBattle([
      // Tiền: Ally 1, 1 | Enemy 2, 1 -> max = 2
      makeUnit('af1', 'AF1', 'ally', 'front', {
        isPlayer: true,
        statuses: s1,
        formationCol: 0,
      }),
      makeUnit('af2', 'AF2', 'ally', 'front', {
        statuses: s1,
        formationCol: 1,
      }),
      makeUnit('ef1', 'EF1', 'enemy', 'front', {
        statuses: s2,
        formationCol: 0,
      }),
      makeUnit('ef2', 'EF2', 'enemy', 'front', {
        statuses: s1,
        formationCol: 1,
      }),

      // Trung: Ally 1, 2, 1 | Enemy 0, 3 -> cap at 2, em2 scrolls with all chips + "+N"
      makeUnit('am1', 'AM1', 'ally', 'middle', {
        statuses: s1,
        formationCol: 0,
      }),
      makeUnit('am2', 'AM2', 'ally', 'middle', {
        statuses: s2,
        formationCol: 1,
      }),
      makeUnit('am3', 'AM3', 'ally', 'middle', {
        statuses: s1,
        formationCol: 2,
      }),
      makeUnit('em1', 'EM1', 'enemy', 'middle', {
        statuses: s0,
        formationCol: 0,
      }),
      makeUnit('em2', 'EM2', 'enemy', 'middle', {
        statuses: s3,
        formationCol: 1,
      }),

      // Hậu: 0 statuses on both sides -> NO status area
      makeUnit('ab1', 'AB1', 'ally', 'back', { statuses: s0 }),
      makeUnit('eb1', 'EB1', 'enemy', 'back', { statuses: s0 }),
    ]);

    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Tiền: all 4 cards get 2 rows (92px)
    for (const id of ['af1', 'af2', 'ef1', 'ef2']) {
      const area = container!.querySelector(
        `[data-testid="card-status-row-${id}"]`
      ) as HTMLElement;
      expect(area).not.toBeNull();
      expect(area.getAttribute('data-status-area-rows')).toBe('2');
      expect(area.style.height).toBe('92px');
      expect(parseInt(area.style.paddingTop, 10)).toBeGreaterThanOrEqual(
        STATUS_BADGE_SAFE_PX
      );
      expect(parseInt(area.style.paddingBottom, 10)).toBeGreaterThanOrEqual(
        STATUS_BADGE_SAFE_PX
      );
      expect(parseInt(area.style.paddingLeft, 10)).toBeGreaterThanOrEqual(
        STATUS_AREA_PAD_X_PX
      );
      expect(parseInt(area.style.paddingRight, 10)).toBeGreaterThanOrEqual(
        STATUS_AREA_PAD_X_PX
      );
      // Cards with <= 2 rows do not enable internal scroll
      expect(area.className).toContain('overflow-visible');
    }

    // Trung: em1 (0 statuses) still gets 2 rows (92px) to stay aligned with lane max 2
    const em1Area = container!.querySelector(
      '[data-testid="card-status-row-em1"]'
    ) as HTMLElement;
    expect(em1Area).not.toBeNull();
    expect(em1Area.style.height).toBe('92px');

    // Trung: em2 (needs 3 rows) caps at 2 rows (92px) + scrollOverflow + all chips + "+N" mark
    const em2Area = container!.querySelector(
      '[data-testid="card-status-row-em2"]'
    ) as HTMLElement;
    expect(em2Area).not.toBeNull();
    expect(em2Area.getAttribute('data-status-area-rows')).toBe('2');
    expect(em2Area.style.height).toBe('92px');
    expect(em2Area.className).toContain('overflow-y-auto');
    expect(em2Area.className).toContain('tactical-scroll-thin');
    expect(parseInt(em2Area.style.paddingTop, 10)).toBeGreaterThanOrEqual(
      STATUS_BADGE_SAFE_PX
    );
    expect(parseInt(em2Area.style.paddingBottom, 10)).toBeGreaterThanOrEqual(
      STATUS_BADGE_SAFE_PX
    );
    expect(
      em2Area.querySelectorAll('[data-testid^="card-status-chip-em2-"]')
    ).toHaveLength(s3.length);
    const em2Overflow = em2Area.querySelector(
      '[data-testid="card-status-overflow-em2"]'
    ) as HTMLElement;
    expect(em2Overflow).not.toBeNull();
    expect(em2Overflow.textContent?.trim()).toMatch(/^\+\d+$/);

    // Hậu: 0 status rows -> NO status area rendered at all, compact card without min-h-[50px]
    expect(
      container!.querySelector('[data-testid="card-status-row-ab1"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="card-status-row-eb1"]')
    ).toBeNull();
    const ab1Card = container!.querySelector(
      '[data-testid="unit-row-ab1"]'
    ) as HTMLElement;
    expect(ab1Card.className).not.toContain('min-h-[50px]');
  });

  it('3) Running max per lane grows from 0 -> 1 -> 2, never shrinks when statuses expire, and resets on a new battle', () => {
    setViewport(1440, 900);
    const s0 = statusesForRowCount(0);
    const s1 = statusesForRowCount(1);
    const s2 = statusesForRowCount(2);

    const b1Turn1 = makeBattle(
      [
        makeUnit('af', 'AF', 'ally', 'front', { isPlayer: true, statuses: s1 }),
        makeUnit('ef', 'EF', 'enemy', 'front', { statuses: s0 }),
      ],
      { sectorId: 'sector_1', round: 1, turnCounter: 1 }
    );

    useGameStore.setState({
      screen: 'BATTLE',
      battle: b1Turn1,
      battleViewMode: 'card',
    });
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Turn 1: front = 1 row (46px)
    expect(
      (
        container!.querySelector(
          '[data-testid="card-status-row-af"]'
        ) as HTMLElement
      ).style.height
    ).toBe('46px');

    // Turn 2: enemy gains 2 rows -> front grows to 2 rows (92px)
    const b1Turn2 = makeBattle(
      [
        makeUnit('af', 'AF', 'ally', 'front', { isPlayer: true, statuses: s1 }),
        makeUnit('ef', 'EF', 'enemy', 'front', { statuses: s2 }),
      ],
      { sectorId: 'sector_1', round: 1, turnCounter: 2 }
    );
    act(() => {
      useGameStore.setState({ battle: b1Turn2 });
      root!.render(createElement(BattleScreen));
    });
    expect(
      (
        container!.querySelector(
          '[data-testid="card-status-row-af"]'
        ) as HTMLElement
      ).style.height
    ).toBe('92px');

    // Turn 3: all statuses wear off -> front STILL stays at 2 rows (running max never shrinks)
    const b1Turn3 = makeBattle(
      [
        makeUnit('af', 'AF', 'ally', 'front', { isPlayer: true, statuses: s0 }),
        makeUnit('ef', 'EF', 'enemy', 'front', { statuses: s0 }),
      ],
      { sectorId: 'sector_1', round: 2, turnCounter: 3 }
    );
    act(() => {
      useGameStore.setState({ battle: b1Turn3 });
      root!.render(createElement(BattleScreen));
    });
    expect(
      (
        container!.querySelector(
          '[data-testid="card-status-row-af"]'
        ) as HTMLElement
      ).style.height
    ).toBe('92px');

    // New battle starts (turnCounter resets to 1) with 0 statuses -> running max resets to 0
    const b2Turn1 = makeBattle(
      [
        makeUnit('af', 'AF', 'ally', 'front', { isPlayer: true, statuses: s0 }),
        makeUnit('ef', 'EF', 'enemy', 'front', { statuses: s0 }),
      ],
      { sectorId: 'sector_1', round: 1, turnCounter: 1 }
    );
    act(() => {
      useGameStore.setState({ battle: b2Turn1 });
      root!.render(createElement(BattleScreen));
    });
    expect(
      container!.querySelector('[data-testid="card-status-row-af"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="card-status-row-ef"]')
    ).toBeNull();
  });

  it('4) Phone (<=640px) keeps allies above enemies with no grid, same lane header & border rules, and no nested scroll except overflowing status area', () => {
    setViewport(390, 844);
    const s0 = statusesForRowCount(0);
    const s3 = statusesForRowCount(3);
    const battle = makeBattle([
      makeUnit('af', 'AF', 'ally', 'front', { isPlayer: true, statuses: s3 }),
      makeUnit('ef', 'EF', 'enemy', 'front', { statuses: s0 }),
      makeUnit('ab', 'AB', 'ally', 'back', { statuses: s0 }),
      // middle empty on both sides -> 20px line; enemy-back empty -> empty box, no text
    ]);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const cardView = container!.querySelector(
      '[data-testid="battle-card-view"]'
    ) as HTMLElement;
    expect(cardView.querySelector('[data-testid="card-lane-grid"]')).toBeNull();
    expect(cardView.textContent).not.toContain('Lộ diện');
    expect(cardView.textContent).not.toContain('Bảo vệ');
    expect(cardView.textContent).not.toContain('Trống');

    const allyBlock = cardView.querySelector(
      '[data-testid="card-side-ally"]'
    ) as HTMLElement;
    const enemyBlock = cardView.querySelector(
      '[data-testid="card-side-enemy"]'
    ) as HTMLElement;
    expect(
      Boolean(
        allyBlock.compareDocumentPosition(enemyBlock) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    // No nested overflow-y-auto in phone cardView except FixedStatusArea on af (3 rows capped at 2)
    const scrollEls = Array.from(
      cardView.querySelectorAll('.overflow-y-auto')
    ) as HTMLElement[];
    expect(scrollEls).toHaveLength(1);
    expect(scrollEls[0].getAttribute('data-testid')).toBe('card-status-row-af');

    // Empty back cell on enemy side has no text
    const enemyBack = cardView.querySelector(
      '[data-card-row="enemy-back"]'
    ) as HTMLElement;
    expect(enemyBack.textContent?.trim()).toBe('');
  });
});
