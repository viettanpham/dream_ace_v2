// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { sortTurnOrder } from '../../engine/combat';
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleState,
  CombatLogEntry,
  CombatRow,
  CombatUnit,
} from '../../types/game';
import {
  COMBAT_LOG_EXPAND_ALL_STORAGE_KEY,
  readCombatLogExpandAll,
} from '../../utils/combatLogFormat';
import { AdminPanel } from '../AdminPanel';
import { BattleScreen } from '../BattleScreen';
import { CombatLogList } from '../CombatLogList';
import { GearView } from '../GearView';

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
  opts: Partial<CombatUnit> = {}
): CombatUnit {
  const maxHp = opts.derived?.maxHp ?? 600;
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: 0,
    isPlayer: Boolean(opts.isPlayer),
    classId: opts.classId ?? 'striker',
    isBoss: Boolean(opts.isBoss),
    level: 5,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 180,
      maxSp: 60,
      speed: 75,
      attackPower: 60,
      defenseRating: 25,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 35,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
      ...opts.derived,
    },
    hp: opts.hp ?? maxHp,
    shield: opts.shield ?? 120,
    sp: opts.sp ?? 40,
    isDefending: false,
    alive: opts.alive ?? true,
    statuses: opts.statuses ?? [],
    animState: 'idle',
  };
}

function makeMultiRoundLogs(rounds: number[]): CombatLogEntry[] {
  return rounds.map((r, idx) => ({
    id: `r_${r}_${idx}`,
    round: r,
    tag: 'ATTACK',
    actorName: 'Commander',
    actorSide: 'ally',
    actorIsPlayer: true,
    templateKey: 'log.damage',
    params: {
      actor: 'Commander',
      target: 'Raider',
      action: 'basic',
      damage: 100 + idx * 10,
      shieldDmg: 20,
      hpDmg: 80 + idx * 10,
    },
  }));
}

function makeBattle(overrides: Partial<BattleState> = {}): BattleState {
  const units = overrides.units ?? [
    makeUnit('ally_player', 'Vance', 'ally', 'front', {
      isPlayer: true,
      alive: true,
    }),
    makeUnit('ally_wing', 'Echo', 'ally', 'middle', {
      alive: true,
    }),
    makeUnit('enemy_1', 'Raider', 'enemy', 'front', {
      alive: true,
    }),
  ];
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 2,
    turnCounter: 3,
    turnOrder: sortTurnOrder(units),
    activeTurnIndex: 0,
    units,
    selectedTargetId: 'enemy_1',
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
    autoStopNotice: null,
    wingmanChat: null,
    log: makeMultiRoundLogs([1, 2]),
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
const initialStoreState = useGameStore.getState();

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({ ...initialStoreState });
  useGameStore.getState().resetCampaign();
  useGameStore.getState().setLanguage('vi');
  setViewport(1280, 820);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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
});

describe('ST1 UI: AdminPanel Starter tab, GearView Starter badge, Destroyed status bar & Log Expand/Collapse All', () => {
  it('1) AdminPanel "Bộ Starter" tab configures per-slot settings, rookie boost, scope, toggle, and fills empty slots', () => {
    useGameStore.getState().startCampaign('AdminUser', 'striker');
    useGameStore.getState().unequipSlot('accessory');
    useGameStore.getState().unlockAdminMode(true);

    act(() => {
      root!.render(createElement(AdminPanel));
    });

    const starterTab = container!.querySelector(
      '[data-testid="admin-tab-starter"]'
    ) as HTMLButtonElement;
    expect(starterTab).not.toBeNull();
    expect(starterTab.textContent).toContain('Bộ Starter');

    act(() => {
      starterTab.click();
    });

    expect(
      container!.querySelector('[data-testid="admin-starter-panel"]')
    ).not.toBeNull();

    // All 6 slot editors exist
    for (const slot of [
      'main_weapon',
      'sub_weapon',
      'armor',
      'engine',
      'cpu',
      'accessory',
    ]) {
      expect(
        container!.querySelector(`[data-testid="admin-starter-slot-${slot}"]`)
      ).not.toBeNull();
    }

    // Apply +50% Rookie Boost preset
    const boost50Btn = container!.querySelector(
      '[data-testid="admin-starter-boost-preset-50"]'
    ) as HTMLButtonElement;
    act(() => {
      boost50Btn.click();
    });
    expect(useGameStore.getState().adminConfig.starterSet?.rookieBoostPct).toBe(
      50
    );

    // Click "Lấp ô trống ngay" -> fills empty accessory slot with boosted starter item
    const applyEmptyBtn = container!.querySelector(
      '[data-testid="admin-starter-apply-empty"]'
    ) as HTMLButtonElement;
    act(() => {
      applyEmptyBtn.click();
    });
    const accId = useGameStore.getState().pilot.gears.striker.equipped.accessory;
    expect(accId).not.toBeNull();
    const accItem = useGameStore
      .getState()
      .pilot.inventory.find((i) => i.instanceId === accId);
    expect(accItem?.isStarter).toBe(true);
    expect(accItem?.rollQuality).toBe(30); // default Q20 * 1.5

    // Select scope "fill_empty_slots"
    const fillScopeRadio = container!.querySelector(
      '[data-testid="admin-starter-scope-fill"]'
    ) as HTMLInputElement;
    act(() => {
      fillScopeRadio.click();
    });
    expect(useGameStore.getState().adminConfig.starterSet?.boostScope).toBe(
      'fill_empty_slots'
    );

    // Toggle global Starter switch off
    const enabledCheckbox = container!.querySelector(
      '[data-testid="admin-starter-enabled"]'
    ) as HTMLInputElement;
    act(() => {
      enabledCheckbox.click();
    });
    expect(useGameStore.getState().adminConfig.starterSet?.enabled).toBe(false);

    // Reset defaults restores enabled=true & boost=0
    const resetBtn = container!.querySelector(
      '[data-testid="admin-starter-reset"]'
    ) as HTMLButtonElement;
    act(() => {
      resetBtn.click();
    });
    expect(useGameStore.getState().adminConfig.starterSet?.enabled).toBe(true);
    expect(useGameStore.getState().adminConfig.starterSet?.rookieBoostPct).toBe(0);
  });

  it('2) GearView shows Starter badge on equipped slots, inventory cards, and detail panel', () => {
    useGameStore.getState().startCampaign('PilotStarter', 'striker');

    act(() => {
      root!.render(createElement(GearView));
    });

    const invStarterBadges = container!.querySelectorAll(
      '[data-testid="inv-starter-badge"]'
    );
    expect(invStarterBadges.length).toBeGreaterThanOrEqual(6);
    expect(invStarterBadges[0].textContent).toBe('Starter');

    expect(
      container!.querySelector('[data-testid="slot-starter-badge-main_weapon"]')
        ?.textContent
    ).toBe('Starter');

    // Click first starter inventory card -> detail panel shows Starter badge
    const firstItemId = useGameStore.getState().pilot.inventory[0].instanceId;
    const card = container!.querySelector(
      `[data-testid="inv-card-${firstItemId}"]`
    ) as HTMLButtonElement;
    act(() => {
      card.click();
    });
    expect(
      container!.querySelector('[data-testid="detail-starter-badge"]')
        ?.textContent
    ).toBe('Starter');
  });

  it('3) Hides player HP/Shield/SP bars completely when player ship is destroyed (desktop and phone)', () => {
    const destroyedUnit = makeUnit('ally_player', 'Vance', 'ally', 'front', {
      isPlayer: true,
      alive: false,
      hp: 0,
      shield: 0,
      sp: 0,
    });
    const battle = makeBattle({
      units: [
        destroyedUnit,
        makeUnit('ally_wing', 'Echo', 'ally', 'middle', { alive: true }),
        makeUnit('enemy_1', 'Raider', 'enemy', 'front', { alive: true }),
      ],
    });

    // Desktop view
    setViewport(1280, 820);
    useGameStore.setState({ screen: 'BATTLE', battle });
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const desktopBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(desktopBar).not.toBeNull();
    expect(desktopBar.getAttribute('data-destroyed')).toBe('true');
    expect(
      desktopBar.querySelector('[data-testid="battle-player-destroyed-badge"]')
        ?.textContent
    ).toBe('Đã phát nổ');
    expect(
      desktopBar.querySelector('[data-testid="battle-player-hp-shield-bar"]')
    ).toBeNull();
    expect(
      desktopBar.querySelector('[data-testid="battle-player-hp-fill"]')
    ).toBeNull();
    expect(
      desktopBar.querySelector('[data-testid="battle-player-sp-bar"]')
    ).toBeNull();
    expect(
      desktopBar.querySelector('[data-testid="battle-player-hp-numbers"]')
    ).toBeNull();
    expect(
      desktopBar.querySelector('[data-testid="battle-player-shield-numbers"]')
    ).toBeNull();
    expect(
      desktopBar.querySelector('[data-testid="battle-player-sp-numbers"]')
    ).toBeNull();

    // Phone portrait compact view
    act(() => {
      setViewport(390, 844);
    });
    const phoneBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(phoneBar).not.toBeNull();
    expect(phoneBar.getAttribute('data-collapsed')).toBe('true');
    expect(phoneBar.getAttribute('data-destroyed')).toBe('true');
    expect(
      phoneBar.querySelector('[data-testid="battle-player-destroyed-badge"]')
        ?.textContent
    ).toBe('Đã phát nổ');
    expect(
      phoneBar.querySelector('[data-testid="battle-player-hp-shield-bar"]')
    ).toBeNull();
    expect(
      phoneBar.querySelector('[data-testid="battle-player-sp-bar"]')
    ).toBeNull();
    expect(
      phoneBar.querySelector('[data-testid="battle-player-hp-numbers"]')
    ).toBeNull();
  });

  it('4) Combat log "Mở hết" / "Thu hết" works in docked & popup headers, auto-expands new rounds, persists in localStorage, and translates vi/en', () => {
    setViewport(1280, 820);
    const battle = makeBattle({
      log: makeMultiRoundLogs([1, 2, 3, 4]),
    });
    useGameStore.setState({ screen: 'BATTLE', language: 'vi', battle });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const expandBtn = container!.querySelector(
      '[data-testid="combat-log-expand-all"]'
    ) as HTMLButtonElement;
    const collapseBtn = container!.querySelector(
      '[data-testid="combat-log-collapse-all"]'
    ) as HTMLButtonElement;
    expect(expandBtn).not.toBeNull();
    expect(collapseBtn).not.toBeNull();
    expect(expandBtn.getAttribute('aria-label')).toBe('Mở hết');
    expect(expandBtn.getAttribute('title')).toBe('Mở hết');
    expect(collapseBtn.getAttribute('aria-label')).toBe('Thu hết');
    expect(collapseBtn.getAttribute('title')).toBe('Thu hết');

    // Default (G4a-2d): only the 3 newest rounds (2, 3, 4) are expanded; older round (1) is collapsed
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-1"]')
        ?.getAttribute('aria-expanded')
    ).toBe('false');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-2"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-4"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');

    // Click "Mở hết" -> all rounds expand & choice saved to localStorage
    act(() => {
      expandBtn.click();
    });
    expect(readCombatLogExpandAll()).toBe(true);
    expect(localStorage.getItem(COMBAT_LOG_EXPAND_ALL_STORAGE_KEY)).toBe('1');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-1"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-4"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');

    // Newly created Round 5 arrives -> auto-expands!
    act(() => {
      useGameStore.setState({
        battle: makeBattle({ log: makeMultiRoundLogs([1, 2, 3, 4, 5]) }),
      });
    });
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-5"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');

    // Switch to English & open popup mode -> popup header also has Expand All / Collapse All
    act(() => {
      useGameStore.getState().setLanguage('en');
      const modeBtn = container!.querySelector(
        '[data-testid="combat-log-mode-toggle"]'
      ) as HTMLButtonElement;
      modeBtn.click();
    });
    expect(localStorage.getItem('dreamAce.logMode.v1')).toBeNull();
    const popup = container!.querySelector(
      '[data-testid="combat-log-popup"]'
    ) as HTMLElement;
    expect(popup).not.toBeNull();
    const popupExpand = popup.querySelector(
      '[data-testid="combat-log-expand-all"]'
    ) as HTMLButtonElement;
    const popupCollapse = popup.querySelector(
      '[data-testid="combat-log-collapse-all"]'
    ) as HTMLButtonElement;
    expect(popupExpand.textContent).toContain('Expand All');
    expect(popupCollapse.textContent).toContain('Collapse All');
    expect(
      popup
        .querySelector('[data-testid="combat-log-round-header-1"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');

    // Click "Collapse All" -> returns to default (3 newest rounds 3, 4, 5 open; 1, 2 closed) & clears expandAll flag
    act(() => {
      popupCollapse.click();
    });
    expect(readCombatLogExpandAll()).toBe(false);
    expect(
      popup
        .querySelector('[data-testid="combat-log-round-header-1"]')
        ?.getAttribute('aria-expanded')
    ).toBe('false');
    expect(
      popup
        .querySelector('[data-testid="combat-log-round-header-2"]')
        ?.getAttribute('aria-expanded')
    ).toBe('false');
    expect(
      popup
        .querySelector('[data-testid="combat-log-round-header-3"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');
    expect(
      popup
        .querySelector('[data-testid="combat-log-round-header-5"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');

    // Direct CombatLogList standalone mount remembers localStorage preference when expandAll=true
    localStorage.setItem(COMBAT_LOG_EXPAND_ALL_STORAGE_KEY, '1');
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: makeMultiRoundLogs([1, 2, 3, 4]),
          active: true,
          mode: 'docked',
        })
      );
    });
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-1"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-2"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-header-4"]')
        ?.getAttribute('aria-expanded')
    ).toBe('true');
  });
});
