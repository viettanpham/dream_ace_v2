// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BattleRadarView,
  buildRowLanes,
  computeLaneTokenRadius,
  computeUnitPositions,
  DESKTOP_RADAR_TOKEN_RADIUS,
  PHONE_EMPTY_LANE_HEIGHT_PX,
} from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatRow, CombatUnit } from '../../types/game';
import {
  advanceRadarFloatingLabel,
  createRadarFloatingLabelQueue,
  enqueueRadarFloatingLabel,
  pruneDeadRadarFloatingLabels,
  RADAR_FLOATING_LABEL_DURATION_MS,
  RADAR_FLOATING_LABEL_MAX_QUEUED,
} from '../../utils/battleVfx';

import { EMPTY_STAT_BLOCK } from '../../data/classes';

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

function makeBattle(
  units: CombatUnit[],
  overrides: Partial<BattleState> = {}
): BattleState {
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

describe('TASK G4a-3a — Radar declutter (markers, floating labels, lanes, dead units, log)', () => {
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
    vi.useRealTimers();
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  it('1) Marker renders 80px ring on desktop/tablet, 1-line truncated name + title, max 3 20px icon-only chips + "+N", zero text pills, and 16px AUTO/lock corner badges', () => {
    const p1 = makeUnit('p1', 'Commander ZARA Prime', 'ally', 'front', {
      isPlayer: true,
      statuses: [
        { type: 'atk_up', turnsRemaining: 4, isDebuff: false },
        { type: 'burn', turnsRemaining: 2, isDebuff: true },
        { type: 'def_down', turnsRemaining: 1, isDebuff: true },
        { type: 'eva_up', turnsRemaining: 3, isDebuff: false },
        { type: 'slow', turnsRemaining: 3, isDebuff: true },
      ],
    });
    const eFront = makeUnit('e_front', 'Raider Alpha', 'enemy', 'front');
    const eBack = makeUnit('e_back', 'Sniper Dreadnought', 'enemy', 'back');
    const battle = makeBattle([p1, eFront, eBack]);

    for (const mode of ['pc', 'tablet'] as const) {
      act(() => {
        root!.render(
          createElement(BattleRadarView, {
            battle,
            activeUnitId: 'p1',
            validBasicTargetIds: new Set(['e_front']),
            canPlayerManualAct: true,
            hasSingleAllySkill: false,
            autoBattleEnabled: true,
            skipAnimations: true,
            layoutMode: mode,
            onSelectEnemy: vi.fn(),
            onSelectAlly: vi.fn(),
            onInspectUnit: vi.fn(),
          })
        );
      });

      expect(DESKTOP_RADAR_TOKEN_RADIUS).toBe(41);
      const p1Node = container!.querySelector(
        '[data-testid="radar-unit-p1"]'
      ) as SVGGElement;
      expect(p1Node).not.toBeNull();
      expect(p1Node.getAttribute('data-ring-radius')).toBe('40');
      expect(p1Node.getAttribute('data-ring-diameter')).toBe('80');

      // 1-line truncated name <= 10 chars + full name in <title>
      const nameNode = p1Node.querySelector(
        '[data-testid="radar-unit-name"]'
      ) as SVGTextElement;
      expect(nameNode).not.toBeNull();
      expect((nameNode.textContent ?? '').length).toBeLessThanOrEqual(10);
      const titleEl = nameNode.parentElement?.querySelector('title');
      expect(titleEl?.textContent).toBe('Commander ZARA Prime');

      // Max 3 20px icon-only mini chips sorted debuffs first, fewest turns first + "+2"
      const chips = Array.from(
        p1Node.querySelectorAll('[data-testid^="radar-status-icon-p1-"]')
      );
      expect(chips).toHaveLength(3);
      expect(chips[0].getAttribute('data-status-type')).toBe('def_down');
      expect(chips[1].getAttribute('data-status-type')).toBe('burn');
      expect(chips[2].getAttribute('data-status-type')).toBe('slow');
      const iconRoot = chips[0].querySelector(
        '[data-testid="catalog-icon-root"]'
      ) as HTMLElement;
      expect(iconRoot.style.width).toBe('20px');
      expect(iconRoot.style.height).toBe('20px');
      expect(
        p1Node.querySelector('[data-testid="radar-status-overflow-p1"]')
          ?.textContent
      ).toBe('+2');

      // Zero text tag pills on markers
      expect(
        container!.querySelector('[data-testid^="radar-status-label-"]')
      ).toBeNull();

      // 16px AUTO corner badge (top-left) and 16px lock corner badge (top-right)
      const autoBadge = p1Node.querySelector(
        '[data-testid="radar-auto-badge-p1"]'
      );
      expect(autoBadge).not.toBeNull();
      expect(autoBadge?.getAttribute('data-badge-size')).toBe('16');
      expect(
        autoBadge?.querySelector('rect')?.getAttribute('height')
      ).toBe('16');
      const autoMatch = autoBadge
        ?.getAttribute('transform')
        ?.match(/translate\(([^,]+),\s*([^)]+)\)/);
      expect(Number(autoMatch?.[1])).toBeLessThan(0);
      expect(Number(autoMatch?.[2])).toBeLessThan(0);

      const lockBadge = container!.querySelector(
        '[data-testid="radar-lock-e_back"]'
      );
      expect(lockBadge).not.toBeNull();
      expect(lockBadge?.getAttribute('data-badge-size')).toBe('16');
      expect(
        lockBadge?.querySelector('circle')?.getAttribute('r')
      ).toBe('8');
      const lockMatch = lockBadge
        ?.getAttribute('transform')
        ?.match(/translate\(([^,]+),\s*([^)]+)\)/);
      expect(Number(lockMatch?.[1])).toBeGreaterThan(0);
      expect(Number(lockMatch?.[2])).toBeLessThan(0);
    }
  });

  it('2) Floating labels queue 1 per alive unit at a time (~600ms, max 3 pending, drop older), render in 18px slot strictly above ring clipped inside radar, and never appear on dead units', () => {
    vi.useFakeTimers();

    // Pure queue check: 1 active + max 3 pending dropping older
    let q = createRadarFloatingLabelQueue();
    for (let i = 1; i <= 5; i += 1) {
      q = enqueueRadarFloatingLabel(
        q,
        { id: `pop_${i}`, unitId: 'e1', text: `-${i * 10}`, tone: 'damage' },
        RADAR_FLOATING_LABEL_MAX_QUEUED
      );
    }
    expect(q.activeByUnit['e1']?.id).toBe('pop_1');
    expect(q.pendingByUnit['e1'].map((p) => p.id)).toEqual([
      'pop_3',
      'pop_4',
      'pop_5',
    ]);

    // Advancing pops active -> promotes next; pruning dead clears everything
    q = advanceRadarFloatingLabel(q, 'e1', 'pop_1');
    expect(q.activeByUnit['e1']?.id).toBe('pop_3');
    q = pruneDeadRadarFloatingLabels(q, new Set(['p1']));
    expect(q.activeByUnit['e1']).toBeUndefined();
    expect(q.pendingByUnit['e1']).toBeUndefined();

    // Rendered DOM verification
    const p1 = makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true });
    const e1 = makeUnit('e1', 'Raider', 'enemy', 'front');
    const eDead = makeUnit('e_dead', 'Wreck', 'enemy', 'middle', {
      alive: false,
      hp: 0,
    });

    const battle = makeBattle([p1, e1, eDead], {
      popups: [
        { id: 'f1', unitId: 'e1', text: '-100', tone: 'damage' },
        { id: 'f2', unitId: 'e1', text: 'CRIT', tone: 'crit' },
        { id: 'f3', unitId: 'e1', text: '+50', tone: 'heal' },
        { id: 'f4', unitId: 'e1', text: 'SKL', tone: 'buff' },
        { id: 'f5', unitId: 'e1', text: 'EVADED', tone: 'evade' },
        { id: 'dead_pop', unitId: 'e_dead', text: '-999', tone: 'damage' },
      ],
    });

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
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const popLayer = container!.querySelector(
      '[data-testid="radar-popups-layer"]'
    ) as HTMLElement;
    expect(popLayer).not.toBeNull();
    expect(popLayer.className).toContain('overflow-hidden');

    // Only 1 active label on e1 (-100) and ZERO on dead unit e_dead
    const labels1 = Array.from(
      container!.querySelectorAll('[data-testid="damage-popup"]')
    ) as HTMLElement[];
    expect(labels1).toHaveLength(1);
    expect(labels1[0].textContent).toBe('-100');
    expect(labels1[0].getAttribute('data-unit-id')).toBe('e1');
    expect(labels1[0].getAttribute('data-slot-height')).toBe('18');
    expect(labels1[0].style.height).toBe('18px');

    // Slot is strictly above the ring (ring center y in pct minus ring radius > slot top pct)
    const e1Node = container!.querySelector(
      '[data-testid="radar-unit-e1"]'
    ) as SVGGElement;
    const match = e1Node
      .getAttribute('transform')
      ?.match(/translate\(([^,]+),\s*([^)]+)\)/);
    const e1Y = Number(match?.[2] ?? 0);
    const ringOuterPct = ((e1Y - 40) / 420) * 100;
    const labelTopPct = Number.parseFloat(labels1[0].style.top);
    expect(labelTopPct).toBeLessThan(ringOuterPct);

    // After 600ms, oldest dropped (f2 was dropped when 5 were queued for 1 active + 3 max pending), promotes f3 (+50)
    act(() => {
      vi.advanceTimersByTime(RADAR_FLOATING_LABEL_DURATION_MS + 10);
    });
    const labels2 = Array.from(
      container!.querySelectorAll('[data-testid="damage-popup"]')
    ) as HTMLElement[];
    expect(labels2).toHaveLength(1);
    expect(labels2[0].textContent).toBe('+50');
  });

  it('3) Lane header renders one muted 20px line with lane name + lane buff text (compact +N when overflowing), with zero "Lộ diện"/"Bảo vệ"/"Trống"', () => {
    const p1 = makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true });
    const pBack = makeUnit('p_back', 'Nova', 'ally', 'back');
    const eFront = makeUnit('e_front', 'Raider', 'enemy', 'front');
    const eBack = makeUnit('e_back', 'Sniper', 'enemy', 'back');
    const battle = makeBattle([p1, pBack, eFront, eBack]);

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e_front']),
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

    const exposedBand = container!.querySelector(
      '[data-row-band="enemy-front"]'
    ) as SVGGElement;
    const exposedHeader = container!.querySelector(
      '[data-testid="radar-lane-header-enemy-front"]'
    ) as HTMLElement;
    const protectedHeader = container!.querySelector(
      '[data-testid="radar-lane-header-enemy-back"]'
    ) as HTMLElement;
    const emptyHeader = container!.querySelector(
      '[data-testid="radar-lane-header-enemy-middle"]'
    ) as HTMLElement;

    expect(exposedBand.getAttribute('data-row-state')).toBe('exposed');
    expect(exposedHeader.style.height).toBe('20px');
    expect(exposedHeader.textContent).toContain(VI_TRANSLATIONS['common.frontRow']);
    expect(exposedHeader.textContent).not.toContain('Lộ diện');
    expect(exposedHeader.textContent).toContain('+10% DEF');

    expect(protectedHeader.textContent).toContain(VI_TRANSLATIONS['common.backRow']);
    expect(protectedHeader.textContent).toContain('-10% DEF +1');
    expect(protectedHeader.textContent).not.toContain('ST tầm xa');
    expect(protectedHeader.textContent).not.toContain('Lộ diện');

    const allHeaderText = Array.from(
      container!.querySelectorAll('[data-testid^="radar-lane-header-"]')
    )
      .map((el) => el.textContent ?? '')
      .join(' | ');
    expect(allHeaderText).not.toContain('Lộ diện');
    expect(allHeaderText).not.toContain('Exposed');
    expect(allHeaderText).not.toContain('Bảo vệ');
    expect(allHeaderText).not.toContain('Protected');
    expect(allHeaderText).not.toContain('Trống');
    expect(allHeaderText).not.toContain('Empty');
    expect(emptyHeader.textContent).not.toContain('Trống');
  });

  it('4) Invalid target tap removes radar toast chip and appends reason to combat log; legend button stays above all lanes', () => {
    setViewport(1440, 900);
    const p1 = makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true });
    const eFront = makeUnit('e_front', 'Raider', 'enemy', 'front');
    const eBack = makeUnit('e_back', 'Sniper', 'enemy', 'back');
    const battle = makeBattle([p1, eFront, eBack]);

    useGameStore.setState({
      screen: 'BATTLE',
      language: 'vi',
      battle,
      battleViewMode: 'radar',
      autoBattleEnabled: false,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Click blocked back-row enemy -> NO toast over radar, entry written to battle.log
    const backMarker = container!.querySelector(
      '[data-testid="radar-unit-e_back"]'
    ) as SVGGElement;
    act(() => {
      backMarker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(
      container!.querySelector('[data-testid="radar-invalid-target-toast"]')
    ).toBeNull();

    const logs = useGameStore.getState().battle?.log ?? [];
    expect(
      logs.some(
        (entry) =>
          entry.templateKey === 'log.invalidTarget' &&
          entry.params?.target === 'Sniper'
      )
    ).toBe(true);

    // Legend button does not cover lane bands on desktop or phone
    const desktopLanes = buildRowLanes(true, 720, 420, [p1, eFront, eBack]);
    expect(desktopLanes.every((lane) => lane.y >= 46)).toBe(true);
    const phoneLanes = buildRowLanes(false, 380, 500, [p1, eFront, eBack]);
    expect(phoneLanes.every((lane) => lane.y >= 44)).toBe(true);
  });

  it('5) Dead units render no ghost markers on desktop or phone; phone empty lane collapses to 20px line with lane name only & allows occupied lane marker to grow', () => {
    const p1 = makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true });
    const pDead = makeUnit('p_dead', 'Fallen Wingman', 'ally', 'back', {
      alive: false,
      hp: 0,
    });
    const eDead = makeUnit('e_dead', 'Destroyed Scout', 'enemy', 'front', {
      alive: false,
      hp: 0,
    });
    const eBack = makeUnit('e_back', 'Boss', 'enemy', 'back');
    const units = [p1, pDead, eDead, eBack];
    const battle = makeBattle(units);

    for (const mode of ['pc', 'phone-portrait'] as const) {
      act(() => {
        root!.render(
          createElement(BattleRadarView, {
            battle,
            activeUnitId: 'p1',
            validBasicTargetIds: new Set(['e_back']),
            canPlayerManualAct: true,
            hasSingleAllySkill: false,
            autoBattleEnabled: false,
            skipAnimations: true,
            layoutMode: mode,
            onSelectEnemy: vi.fn(),
            onSelectAlly: vi.fn(),
            onInspectUnit: vi.fn(),
          })
        );
      });

      expect(
        container!.querySelector('[data-testid="radar-unit-p_dead"]')
      ).toBeNull();
      expect(
        container!.querySelector('[data-testid="radar-unit-e_dead"]')
      ).toBeNull();
    }

    // Phone layout: empty lanes collapse to 20px with lane name only, occupied lane grows > base 22
    const phoneLanes = buildRowLanes(false, 380, 500, units);
    const emptyEnemyFront = phoneLanes.find(
      (l) => l.side === 'enemy' && l.row === 'front'
    )!;
    const occupiedEnemyBack = phoneLanes.find(
      (l) => l.side === 'enemy' && l.row === 'back'
    )!;
    expect(emptyEnemyFront.h).toBe(PHONE_EMPTY_LANE_HEIGHT_PX);
    expect(emptyEnemyFront.isEmptyCollapsed).toBe(true);
    expect(occupiedEnemyBack.isEmptyCollapsed).toBe(false);
    expect(computeLaneTokenRadius(false, occupiedEnemyBack, 1, 4)).toBeGreaterThan(22);

    const collapsedHeader = container!.querySelector(
      '[data-testid="radar-lane-header-enemy-front"]'
    );
    expect(collapsedHeader?.textContent).toBe(VI_TRANSLATIONS['common.frontRow']);
    const posPhone = computeUnitPositions(units, phoneLanes, false);
    expect(posPhone.has('p_dead')).toBe(false);
    expect(posPhone.has('e_dead')).toBe(false);
  });

  it('6) Card mode, CURRENT_SAVE_VERSION = 9, and vi/en parity remain intact', () => {
    expect(CURRENT_SAVE_VERSION).toBe(12);
    expect(VI_TRANSLATIONS['log.invalidTarget']).toBeTruthy();
    expect(EN_TRANSLATIONS['log.invalidTarget']).toBeTruthy();
    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );

    setViewport(1280, 900);
    const p1 = makeUnit('p1', 'ZARA', 'ally', 'front', {
      isPlayer: true,
      statuses: [{ type: 'atk_up', turnsRemaining: 2, isDebuff: false }],
    });
    const e1 = makeUnit('e1', 'Raider', 'enemy', 'front');
    useGameStore.setState({
      screen: 'BATTLE',
      language: 'vi',
      battle: makeBattle([p1, e1]),
      battleViewMode: 'card',
      autoBattleEnabled: false,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(
      container!.querySelector('[data-testid="battle-card-view"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="card-status-chip-p1-0"]')
    ).not.toBeNull();
  });
});
