// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type {
  ActiveStatusEffect,
  BattleState,
  CombatLogEntry,
  CombatUnit,
} from '../../types/game';
import {
  clearStatusDisplayOverride,
  STATUS_CHIP_FRAME_PX,
  STATUS_ROW_GAP_PX,
  writeStatusDisplayOverride,
} from '../../utils/statusDisplayPrefs';
import { BattleScreen } from '../BattleScreen';
import { getFixedStatusAreaHeightPx } from '../FixedStatusArea';

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
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
    isBoss: overrides.isBoss ?? false,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: { pulse_overdrive: 1 },
    equippedSkillIds: ['pulse_overdrive'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 900,
      maxShield: 250,
      maxSp: 80,
      speed: overrides.derived?.speed ?? 80,
      attackPower: 140,
      defenseRating: 65,
      dodgeChance: 10,
      critChance: 15,
      skillPower: 25,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 6,
      passiveSkillDmgPct: 0,
      ...overrides.derived,
    },
    hp: overrides.hp ?? 900,
    shield: overrides.shield ?? 250,
    sp: overrides.sp ?? 55,
    isDefending: false,
    alive: overrides.alive ?? true,
    statuses: overrides.statuses ?? [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(statusesForEnemy: ActiveStatusEffect[] = []): BattleState {
  const units = [
    makeUnit('a1', 'Kaelen Vance', 'ally', {
      isPlayer: true,
      row: 'front',
      derived: { ...makeUnit('t', 't', 'ally').derived, speed: 95 },
    }),
    makeUnit('a2', 'Marek Solis', 'ally', {
      row: 'front',
      derived: { ...makeUnit('t', 't', 'ally').derived, speed: 88 },
    }),
    makeUnit('a3', 'Lyra Chen', 'ally', {
      row: 'middle',
      derived: { ...makeUnit('t', 't', 'ally').derived, speed: 82 },
    }),
    makeUnit('a4', 'Orin Vex', 'ally', {
      row: 'back',
      derived: { ...makeUnit('t', 't', 'ally').derived, speed: 76 },
    }),
    makeUnit('e1', 'Vanguard 1', 'enemy', {
      row: 'front',
      statuses: statusesForEnemy,
      derived: { ...makeUnit('t', 't', 'enemy').derived, speed: 91 },
    }),
    makeUnit('e2', 'Raider 2', 'enemy', {
      row: 'front',
      derived: { ...makeUnit('t', 't', 'enemy').derived, speed: 85 },
    }),
    makeUnit('e3', 'Gunship 3', 'enemy', {
      row: 'middle',
      derived: { ...makeUnit('t', 't', 'enemy').derived, speed: 79 },
    }),
    makeUnit('e4', 'Sniper 4', 'enemy', {
      row: 'back',
      derived: { ...makeUnit('t', 't', 'enemy').derived, speed: 71 },
    }),
  ];

  const logs: CombatLogEntry[] = [
    {
      id: 'log_1',
      round: 1,
      actorName: 'Kaelen Vance',
      actorSide: 'ally',
      actorIsPlayer: true,
      tag: 'ATTACK',
      templateKey: 'log.damage',
      params: {
        actor: 'Kaelen Vance',
        target: 'Vanguard 1',
        damage: 140,
        hpDamage: 140,
        shieldDamage: 0,
      },
    },
  ];

  return {
    sectorId: 'aegis_relay',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    units,
    turnOrder: units.map((u) => u.id),
    activeTurnIndex: 0,
    selectedTargetId: 'e1',
    selectedAllyTargetId: 'a1',
    lastPlayerTargetId: 'e1',
    autoStopNotice: null,
    wingmanChat: null,
    log: logs,
    events: [],
    roundSnapshots: [],
    fxEvents: [],
    popups: [],
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
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

const FIVE_STATUSES: ActiveStatusEffect[] = [
  { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
  { type: 'burn', turnsRemaining: 2, isDebuff: true, magnitude: 50 },
  { type: 'def_down', turnsRemaining: 2, isDebuff: true, magnitude: 0.25 },
  { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.2 },
  { type: 'spd_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.3 },
];

describe('TASK SB1 — Selected-unit status area fixed 2 rows (desktop/tablet sidebar)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    clearStatusDisplayOverride();
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState({
      screen: 'BATTLE',
      autoBattleEnabled: false,
      battleViewMode: 'radar',
      autoRepeatSession: null,
      autoRepeatToast: null,
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
    clearStatusDisplayOverride();
    window.localStorage.clear();
  });

  it('1) Status area height is identical (2 x (chip + gap)) for 0, 1, 2, and 5 statuses and ignores desktopRows override', () => {
    setViewport(1440, 900);
    const expectedHeightPx = 2 * (STATUS_CHIP_FRAME_PX + STATUS_ROW_GAP_PX);
    expect(getFixedStatusAreaHeightPx(2, false)).toBe(expectedHeightPx);

    // Even if user/admin desktopRows is 1 or 5, sidebar selected-unit panel stays strictly 2 rows
    writeStatusDisplayOverride({ desktopRows: 1 });

    const counts = [0, 1, 2, 5];
    const measured: Array<{
      count: number;
      height: string;
      minHeight: string;
      maxHeight: string;
      rowsAttr: string | null;
      classes: string;
      childSignature: string;
    }> = [];

    for (const count of counts) {
      const statuses = FIVE_STATUSES.slice(0, count);
      act(() => {
        useGameStore.setState({ battle: makeBattle(statuses) });
        root!.render(createElement(BattleScreen));
      });

      const panel = container!.querySelector(
        '[data-testid="battle-selected-unit-panel"]'
      ) as HTMLElement;
      const statusArea = panel.querySelector(
        '[data-testid="sidebar-status-area"]'
      ) as HTMLElement;
      expect(panel).not.toBeNull();
      expect(statusArea).not.toBeNull();

      // Panel direct layout structure remains unchanged across 0, 1, 2, 5 statuses
      const panelChildTags = Array.from(panel.children).map((el) => el.tagName);
      measured.push({
        count,
        height: statusArea.style.height,
        minHeight: statusArea.style.minHeight,
        maxHeight: statusArea.style.maxHeight,
        rowsAttr: statusArea.getAttribute('data-status-area-rows'),
        classes: statusArea.className,
        childSignature: panelChildTags.join('>'),
      });
    }

    for (const entry of measured) {
      expect(entry.height).toBe(`${expectedHeightPx}px`);
      expect(entry.minHeight).toBe(`${expectedHeightPx}px`);
      expect(entry.maxHeight).toBe(`${expectedHeightPx}px`);
      expect(entry.rowsAttr).toBe('2');
      expect(entry.classes).toContain('overflow-y-auto');
      expect(entry.childSignature).toBe(measured[0].childSignature);
    }
  });

  it('2) Overflowing statuses scroll internally (overflow-y-auto + thin scrollbar) with NO "+N" badge and tapping a chip opens detail', () => {
    setViewport(1280, 800);
    act(() => {
      useGameStore.setState({ battle: makeBattle(FIVE_STATUSES) });
      root!.render(createElement(BattleScreen));
    });

    const statusArea = container!.querySelector(
      '[data-testid="sidebar-status-area"]'
    ) as HTMLElement;
    expect(statusArea).not.toBeNull();
    expect(statusArea.className).toContain('overflow-y-auto');
    expect(statusArea.className).toContain('tactical-scroll');
    expect(statusArea.className).toContain('tactical-scroll-thin');

    // No "+N" overflow badge anywhere in sidebar status area
    expect(
      container!.querySelector('[data-testid="sidebar-status-overflow"]')
    ).toBeNull();
    for (const el of Array.from(statusArea.querySelectorAll('span'))) {
      expect(el.textContent?.trim()).not.toMatch(/^\+\d+$/);
    }

    // All 5 chips are rendered inside the scrollable container
    const chips = statusArea.querySelectorAll(
      '[data-testid^="sidebar-status-chip-"]'
    );
    expect(chips).toHaveLength(5);

    // Tapping a chip opens the status detail popover
    act(() => {
      (chips[0] as HTMLElement).click();
    });
    const popover = container!.querySelector(
      '[data-testid="status-area-popover"]'
    );
    expect(popover).not.toBeNull();
    expect(popover!.textContent).toContain('Làm chậm');
  });

  it('3) Empty status line "Không có hiệu ứng" exists in vi.ts and en.ts and renders centered muted inside the fixed box', () => {
    expect(VI_TRANSLATIONS['statusUi.areaEmpty']).toBe('Không có hiệu ứng');
    expect(EN_TRANSLATIONS['statusUi.areaEmpty']).toBe('No active effects');
    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );

    setViewport(1024, 768);
    act(() => {
      useGameStore.setState({ battle: makeBattle([]) });
      root!.render(createElement(BattleScreen));
    });

    const emptyEl = container!.querySelector(
      '[data-testid="sidebar-status-empty"]'
    ) as HTMLElement;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.textContent).toBe('Không có hiệu ứng');
    expect(emptyEl.className).toContain('text-center');
    expect(emptyEl.className).toContain('text-slate-400');

    // Switch to English -> updates to English string inside the same fixed box
    act(() => {
      useGameStore.getState().setLanguage('en');
    });
    expect(emptyEl.textContent).toBe('No active effects');
  });

  it('4) Right column invariants preserved: queue header + actor + 5 fixed rows, combat log flex-1 & min-h-[220px], CURRENT_SAVE_VERSION stays 9', () => {
    setViewport(1440, 900);
    act(() => {
      useGameStore.setState({ battle: makeBattle([]) });
      root!.render(createElement(BattleScreen));
    });

    expect(CURRENT_SAVE_VERSION).toBe(10);
    expect(
      container!.querySelector('[data-testid="turn-queue-sidebar-header"]')
        ?.className
    ).toContain('h-[32px]');
    expect(
      container!.querySelector('[data-testid="turn-queue-acting-chip"]')
    ).not.toBeNull();
    const upcomingList = container!.querySelector(
      '[data-testid="turn-queue-upcoming-list"]'
    ) as HTMLElement;
    expect(upcomingList.getAttribute('data-fixed-rows')).toBe('5');
    expect(
      container!.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]').length
    ).toBeGreaterThanOrEqual(5);

    const desktopLog = container!.querySelector(
      '[data-testid="battle-desktop-docked-log"]'
    ) as HTMLElement;
    expect(desktopLog).not.toBeNull();
    expect(desktopLog.className).toContain('flex-1');
    expect(desktopLog.className).toContain('min-h-[220px]');
  });
});
