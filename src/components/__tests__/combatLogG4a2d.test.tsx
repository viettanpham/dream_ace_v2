// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { buildExportEnvelope } from '../../engine/saveExport';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatLogEntry, CombatUnit } from '../../types/game';
import {
  COMBAT_LOG_CHROME_HEIGHTS,
  LOG_ORDER_STORAGE_KEY,
  readCombatLogOrder,
} from '../../utils/combatLogFormat';
import {
  computePreservedScrollTopOnPrepend,
  computeTopStickScrollState,
  isInlineFlowAtTop,
  isScrolledToTop,
} from '../../utils/scrollStick';
import { BattleScreen } from '../BattleScreen';
import { CombatLogList } from '../CombatLogList';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally_1',
    name: 'Vanguard-01',
    callsign: 'Vanguard-01',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    isPlayer: true,
    classId: 'striker',
    isBoss: false,
    level: 5,
    skillLevel: 1,
    skillLevels: { gen_hull_brace: 1 },
    equippedSkillIds: ['gen_hull_brace'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 900,
      maxShield: 220,
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
    shield: 220,
    sp: 80,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeMultiRoundEntries(
  rounds: number[],
  entriesPerRound = 2
): CombatLogEntry[] {
  const entries: CombatLogEntry[] = [];
  for (const r of rounds) {
    for (let i = 1; i <= entriesPerRound; i += 1) {
      entries.push({
        id: `r${r}_e${i}`,
        round: r,
        actorName: i % 2 === 1 ? 'Vanguard-01' : 'Raider-01',
        actorSide: i % 2 === 1 ? 'ally' : 'enemy',
        tag: 'ATTACK',
        templateKey: 'log.damage',
        params: {
          actor: i % 2 === 1 ? 'Vanguard-01' : 'Raider-01',
          target: i % 2 === 1 ? 'Raider-01' : 'Vanguard-01',
          damage: r * 100 + i,
          hullDamage: r * 100 + i,
        },
      });
    }
  }
  return entries;
}

function makeBattle(logs: CombatLogEntry[] = makeMultiRoundEntries([1, 2, 3, 4, 5])): BattleState {
  const ally = makeUnit();
  const enemy = makeUnit({
    id: 'enemy_1',
    name: 'Raider-01',
    callsign: 'Raider-01',
    side: 'enemy',
    isPlayer: false,
  });
  return {
    sectorId: 'aegis_relay',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 5,
    turnCounter: 10,
    units: [ally, enemy],
    turnOrder: ['ally_1', 'enemy_1'],
    activeTurnIndex: 0,
    selectedTargetId: 'enemy_1',
    selectedAllyTargetId: 'ally_1',
    lastPlayerTargetId: 'enemy_1',
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

describe('TASK G4a-2d — Combat log newest-first order, jump pill & compact 2-row header', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().setLanguage('vi');
    setViewport(1280, 800);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it('1) Defaults to newest-first, persists under dreamAce.logOrder.v1 outside saves, and reverses rounds & lines without mutating input', async () => {
    expect(readCombatLogOrder()).toBe('newest');

    const sourceLogs = makeMultiRoundEntries([1, 2, 3], 2);
    const snapshotIdsBefore = sourceLogs.map((e) => e.id);

    useGameStore.setState({
      screen: 'BATTLE',
      language: 'vi',
      battle: makeBattle(sourceLogs),
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const roundHeaders = Array.from(
      container!.querySelectorAll<HTMLElement>(
        '[data-testid^="combat-log-round-header-"]'
      )
    );
    expect(
      roundHeaders.map((el) => el.getAttribute('data-testid'))
    ).toEqual([
      'combat-log-round-header-3',
      'combat-log-round-header-2',
      'combat-log-round-header-1',
    ]);

    // Inside round 3: e2 (dmg 302) appears above e1 (dmg 301)
    const r3Entries = Array.from(
      container!.querySelectorAll<HTMLElement>(
        '[data-testid="combat-log-round-body-3"] [data-testid="combat-log-sentence"]'
      )
    );
    expect(r3Entries[0].textContent).toContain('302');
    expect(r3Entries[1].textContent).toContain('301');

    // Toggle to Oldest first
    const oldestBtn = container!.querySelector(
      '[data-testid="combat-log-order-oldest"]'
    ) as HTMLButtonElement;
    expect(oldestBtn).not.toBeNull();
    expect(oldestBtn.getAttribute('title')).toBe('Cũ nhất trước');

    act(() => {
      oldestBtn.click();
    });

    expect(window.localStorage.getItem(LOG_ORDER_STORAGE_KEY)).toBe('oldest');
    expect(readCombatLogOrder()).toBe('oldest');

    const oldestHeaders = Array.from(
      container!.querySelectorAll<HTMLElement>(
        '[data-testid^="combat-log-round-header-"]'
      )
    );
    expect(
      oldestHeaders.map((el) => el.getAttribute('data-testid'))
    ).toEqual([
      'combat-log-round-header-1',
      'combat-log-round-header-2',
      'combat-log-round-header-3',
    ]);
    const r3OldestEntries = Array.from(
      container!.querySelectorAll<HTMLElement>(
        '[data-testid="combat-log-round-body-3"] [data-testid="combat-log-sentence"]'
      )
    );
    expect(r3OldestEntries[0].textContent).toContain('301');
    expect(r3OldestEntries[1].textContent).toContain('302');

    // Original array is untouched
    expect(sourceLogs.map((e) => e.id)).toEqual(snapshotIdsBefore);

    // Order preference persists on remount & never enters save data or bumps CURRENT_SAVE_VERSION
    act(() => {
      root!.unmount();
    });
    root = createRoot(container!);
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    expect(
      container!
        .querySelector('[data-testid="combat-log-order-oldest"]')
        ?.getAttribute('aria-pressed')
    ).toBe('true');

    expect(CURRENT_SAVE_VERSION).toBe(12);
    const snapshot = useGameStore.getState().exportSaveStateSnapshot();
    const env = await buildExportEnvelope(snapshot);
    expect(JSON.stringify(env)).not.toContain('dreamAce.logOrder.v1');
  });

  it('2) Expands only the 3 newest rounds by default, keeps older collapsed, and Expand All / Collapse All still clear manual overrides', () => {
    const entries = makeMultiRoundEntries([1, 2, 3, 4, 5], 1);
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries,
          active: true,
          mode: 'docked',
          expandAll: false,
          expandNonce: 0,
          onExpandAll: () => {},
          onCollapseAll: () => {},
        })
      );
    });

    for (const r of [5, 4, 3]) {
      expect(
        container!
          .querySelector(`[data-testid="combat-log-round-header-${r}"]`)
          ?.getAttribute('aria-expanded')
      ).toBe('true');
    }
    for (const r of [2, 1]) {
      expect(
        container!
          .querySelector(`[data-testid="combat-log-round-header-${r}"]`)
          ?.getAttribute('aria-expanded')
      ).toBe('false');
    }

    // Manual override on round 1 -> stays open until Collapse All clears overrides
    act(() => {
      (
        container!.querySelector(
          '[data-testid="combat-log-round-header-1"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-1"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');

    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries,
          active: true,
          mode: 'docked',
          expandAll: false,
          expandNonce: 1,
          onExpandAll: () => {},
          onCollapseAll: () => {},
        })
      );
    });
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-1"]')
        ?.getAttribute('aria-expanded')
    ).toBe('false');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-3"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('3) Jump pill in newest-first appears only when scrolled away + new lines arrive, preserves scroll offset, and tap scrolls to top across docked, popup, and inlineFlow', () => {
    expect(isScrolledToTop({ scrollHeight: 1000, scrollTop: 24, clientHeight: 200 })).toBe(true);
    expect(isScrolledToTop({ scrollHeight: 1000, scrollTop: 25, clientHeight: 200 })).toBe(false);
    expect(computeTopStickScrollState({ scrollHeight: 1000, scrollTop: 80, clientHeight: 200 })).toEqual({
      isAtTop: false,
      isScrolledAway: true,
    });
    expect(computePreservedScrollTopOnPrepend(120, 600, 750)).toBe(270);
    expect(isInlineFlowAtTop(300, 500, 0)).toBe(true);
    expect(isInlineFlowAtTop(-40, 500, 200)).toBe(false);

    // Docked newest-first
    const initial = makeMultiRoundEntries([1, 2, 3], 2);
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: initial,
          active: true,
          mode: 'docked',
        })
      );
    });
    const scrollEl = container!.querySelector(
      '[data-testid="combat-log-scroll"]'
    ) as HTMLDivElement;

    let sh = 600;
    Object.defineProperty(scrollEl, 'clientHeight', {
      configurable: true,
      get: () => 200,
    });
    Object.defineProperty(scrollEl, 'scrollHeight', {
      configurable: true,
      get: () => sh,
    });

    // At top -> new entries arrive -> stays at top, NO pill
    sh = 720;
    const withMoreAtTop = [...initial, ...makeMultiRoundEntries([4], 2)];
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: withMoreAtTop,
          active: true,
          mode: 'docked',
        })
      );
    });
    expect(scrollEl.scrollTop).toBe(0);
    expect(container!.querySelector('[data-testid="combat-log-jump-latest"]')).toBeNull();

    // Scroll away from top -> still no pill until new lines arrive
    scrollEl.scrollTop = 180;
    act(() => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });
    expect(container!.querySelector('[data-testid="combat-log-jump-latest"]')).toBeNull();

    // New lines arrive while scrolled away -> view does NOT jump to top (preserved + delta) and pill shows count
    sh = 860;
    const withMoreAway = [...withMoreAtTop, ...makeMultiRoundEntries([5], 3)];
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: withMoreAway,
          active: true,
          mode: 'docked',
        })
      );
    });
    expect(scrollEl.scrollTop).toBe(320); // 180 + (860 - 720)
    const pill = container!.querySelector(
      '[data-testid="combat-log-jump-latest"]'
    ) as HTMLButtonElement;
    expect(pill).not.toBeNull();
    expect(pill.getAttribute('data-direction')).toBe('up');
    expect(pill.textContent).toContain('↑');
    expect(pill.textContent).toContain('3 dòng mới');

    // Click pill -> scrolls to top and clears pill
    act(() => {
      pill.click();
    });
    expect(scrollEl.scrollTop).toBe(0);
    expect(container!.querySelector('[data-testid="combat-log-jump-latest"]')).toBeNull();

    // Phone inlineFlow (page scroll, zero nested scroll)
    const scrollToSpy = vi.fn();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollToSpy,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });

    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: initial,
          active: true,
          mode: 'docked',
          inlineFlow: true,
        })
      );
    });
    const inlineScrollEl = container!.querySelector(
      '[data-testid="combat-log-scroll"]'
    ) as HTMLDivElement;
    expect(inlineScrollEl.className).not.toContain('overflow-y-auto');

    // Simulate user scrolling phone page down past log top
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 240,
    });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: [...initial, ...makeMultiRoundEntries([6], 2)],
          active: true,
          mode: 'docked',
          inlineFlow: true,
        })
      );
    });

    const inlinePill = container!.querySelector(
      '[data-testid="combat-log-jump-latest"]'
    ) as HTMLButtonElement;
    expect(inlinePill).not.toBeNull();
    expect(inlinePill.textContent).toContain('↑');
    expect(inlinePill.textContent).toContain('2 dòng mới');

    act(() => {
      inlinePill.click();
    });
    expect(scrollToSpy).toHaveBeenCalled();
    expect(container!.querySelector('[data-testid="combat-log-jump-latest"]')).toBeNull();

    // Popup mode newest-first jump pill works identically when scrolled away
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: initial,
          active: true,
          mode: 'popup',
        })
      );
    });
    const popupScrollEl = container!.querySelector(
      '[data-testid="combat-log-scroll"]'
    ) as HTMLDivElement;
    let popupSh = 700;
    Object.defineProperty(popupScrollEl, 'clientHeight', {
      configurable: true,
      get: () => 250,
    });
    Object.defineProperty(popupScrollEl, 'scrollHeight', {
      configurable: true,
      get: () => popupSh,
    });
    popupScrollEl.scrollTop = 140;
    act(() => {
      popupScrollEl.dispatchEvent(new Event('scroll'));
    });
    popupSh = 820;
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: [...initial, ...makeMultiRoundEntries([7], 2)],
          active: true,
          mode: 'popup',
        })
      );
    });
    const popupPill = container!.querySelector(
      '[data-testid="combat-log-jump-latest"]'
    ) as HTMLButtonElement;
    expect(popupPill).not.toBeNull();
    expect(popupPill.textContent).toContain('↑');
    expect(popupPill.textContent).toContain('2 dòng mới');
    expect(popupScrollEl.scrollTop).toBe(260);
    act(() => {
      popupPill.click();
    });
    expect(popupScrollEl.scrollTop).toBe(0);
    expect(container!.querySelector('[data-testid="combat-log-jump-latest"]')).toBeNull();
  });

  it('4) Compact 2-row header on desktop & phone has zero flex-wrap, <=76px total chrome, and preserves all data-testid controls & vi/en parity', () => {
    expect(COMBAT_LOG_CHROME_HEIGHTS.row1Px + COMBAT_LOG_CHROME_HEIGHTS.row2Px).toBeLessThanOrEqual(76);

    // Tablet width just above 640px
    setViewport(680, 800);
    useGameStore.setState({
      screen: 'BATTLE',
      language: 'vi',
      battle: makeBattle(),
    });
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const desktopLog = container!.querySelector(
      '[data-testid="battle-desktop-docked-log"]'
    ) as HTMLElement;
    const row1 = desktopLog.querySelector(
      '[data-testid="combat-log-header-row-1"]'
    ) as HTMLElement;
    const row2 = desktopLog.querySelector(
      '[data-testid="combat-log-filters"]'
    ) as HTMLElement;
    expect(row1).not.toBeNull();
    expect(row2).not.toBeNull();
    expect(row1.className).toContain('flex-nowrap');
    expect(row2.className).toContain('flex-nowrap');
    expect(row1.className).not.toContain('flex-wrap');
    expect(row2.className).not.toContain('flex-wrap');

    // Row 1 controls
    expect(row1.querySelector('[data-testid="combat-log-header-title"]')).not.toBeNull();
    expect(row1.querySelector('[data-testid="combat-log-header-count"]')).not.toBeNull();
    expect(row1.querySelector('[data-testid="combat-log-mode-segmented"]')).not.toBeNull();
    expect(row1.querySelector('[data-testid="combat-log-mode-toggle"]')).not.toBeNull();
    expect(row1.querySelector('[data-testid="combat-log-expand-all"]')).toBeNull();

    // Row 2 controls: channels + order toggle + icon-only expand/collapse
    expect(row2.querySelector('[data-testid="combat-log-filter-all"]')).not.toBeNull();
    expect(row2.querySelector('[data-testid="combat-log-filter-ally"]')?.textContent).toBe('Ta');
    expect(row2.querySelector('[data-testid="combat-log-filter-enemy"]')?.textContent).toBe('Địch');
    expect(row2.querySelector('[data-testid="combat-log-filter-system"]')).not.toBeNull();
    expect(row2.querySelector('[data-testid="combat-log-order-toggle"]')).not.toBeNull();
    const row2Expand = row2.querySelector('[data-testid="combat-log-expand-all"]') as HTMLButtonElement;
    const row2Collapse = row2.querySelector('[data-testid="combat-log-collapse-all"]') as HTMLButtonElement;
    expect(row2Expand.textContent).toBe('');
    expect(row2Expand.getAttribute('aria-label')).toBe('Mở hết');
    expect(row2Expand.getAttribute('title')).toBe('Mở hết');
    expect(row2Collapse.textContent).toBe('');
    expect(row2Collapse.getAttribute('aria-label')).toBe('Thu hết');
    expect(row2Collapse.getAttribute('title')).toBe('Thu hết');

    // Phone portrait <=640px also uses compact 2-row header with zero nested scroll
    setViewport(360, 740);
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    const phoneLog = container!.querySelector(
      '[data-testid="battle-phone-docked-log"]'
    ) as HTMLElement;
    expect(phoneLog.querySelector('[data-testid="combat-log-header-row-1"]')?.className).toContain('flex-nowrap');
    expect(phoneLog.querySelector('[data-testid="combat-log-filters"]')?.className).toContain('flex-nowrap');
    expect(phoneLog.querySelector('.overflow-y-auto')).toBeNull();
    expect(phoneLog.querySelector('.overflow-x-auto')).toBeNull();

    // vi/en key parity
    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );
  });
});
