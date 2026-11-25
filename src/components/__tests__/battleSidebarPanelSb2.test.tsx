// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatRow, CombatUnit } from '../../types/game';
import {
  SIDEBAR_UNIT_PANEL_HEIGHTS,
  SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX,
  SP_COLOR_TOKENS,
} from '../../utils/battleDisplay';
import { BattleScreen } from '../BattleScreen';
import { getFixedStatusAreaHeightPx } from '../FixedStatusArea';

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
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const defaultDerived = {
    maxHp: 900,
    maxShield: 250,
    maxSp: 80,
    speed: 80,
    attackPower: 140,
    defenseRating: 65,
    dodgeChance: 10,
    critChance: 15,
    skillPower: 25,
    armorPiercePct: 0,
    splashPct: 0,
    spRegenPerTurn: 6,
    passiveSkillDmgPct: 0,
  };
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: overrides.formationCol ?? 0,
    isPlayer: overrides.isPlayer ?? false,
    isBoss: overrides.isBoss ?? false,
    classId: overrides.classId ?? 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: { pulse_overdrive: 1 },
    equippedSkillIds: ['pulse_overdrive'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: { ...defaultDerived, ...overrides.derived },
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

function makeBattle(overrides: Partial<BattleState> = {}): BattleState {
  const units = overrides.units ?? [
    makeUnit('u_player', 'Kaelen Vance Squadron Lead', 'ally', 'front', {
      isPlayer: true,
      derived: { ...makeUnit('t', 't', 'ally', 'front').derived, speed: 95 },
    }),
    makeUnit('e_front', 'Vanguard Interceptor Alpha', 'enemy', 'front', {
      derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 90 },
    }),
    makeUnit('e_back', 'Phantom Artillery Cruiser Omega', 'enemy', 'back', {
      derived: { ...makeUnit('t', 't', 'enemy', 'back').derived, speed: 70 },
    }),
    makeUnit('e_stealth', 'Specter Cloak Unit', 'enemy', 'front', {
      statuses: [{ type: 'stealth', turnsRemaining: 2, isDebuff: false }],
      derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 85 },
    }),
    makeUnit('e_dead', 'Wrecked Drone', 'enemy', 'front', {
      alive: false,
      hp: 0,
      shield: 0,
      derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 60 },
    }),
  ];

  return {
    sectorId: 'aegis_relay',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    units,
    turnOrder: units.filter((u) => u.alive).map((u) => u.id),
    activeTurnIndex: 0,
    selectedTargetId: 'e_front',
    selectedAllyTargetId: 'u_player',
    lastPlayerTargetId: 'e_front',
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

describe('TASK SB2 — Selected-unit panel fixed height & header slots (>640px)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const origWidth = window.innerWidth;
  const origHeight = window.innerHeight;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState({
      screen: 'BATTLE',
      battle: makeBattle(),
      autoBattleEnabled: false,
      battleViewMode: 'radar',
      autoRepeatSession: null,
      autoRepeatToast: null,
      skipAnimations: true,
      battleSpeed: 1,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    setViewport(origWidth, origHeight);
    window.localStorage.clear();
  });

  it('1) Single-source constants match arithmetic and panel height is <= today smallest state (245px) and identical in ALL moments', () => {
    const computedSum =
      SIDEBAR_UNIT_PANEL_HEIGHTS.borderPx +
      SIDEBAR_UNIT_PANEL_HEIGHTS.padYPx +
      SIDEBAR_UNIT_PANEL_HEIGHTS.headerPx +
      SIDEBAR_UNIT_PANEL_HEIGHTS.barsPx +
      SIDEBAR_UNIT_PANEL_HEIGHTS.telemetryPx +
      SIDEBAR_UNIT_PANEL_HEIGHTS.statusAreaPx +
      SIDEBAR_UNIT_PANEL_HEIGHTS.gapPx * SIDEBAR_UNIT_PANEL_HEIGHTS.gapCount;

    expect(SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX).toBe(computedSum);
    expect(SIDEBAR_UNIT_PANEL_HEIGHTS.headerPx).toBe(32);
    expect(SIDEBAR_UNIT_PANEL_HEIGHTS.blockedSlotPx).toBe(24);
    expect(SIDEBAR_UNIT_PANEL_HEIGHTS.lockButtonSlotPx).toBe(32);
    expect(SIDEBAR_UNIT_PANEL_HEIGHTS.statusAreaPx).toBe(
      getFixedStatusAreaHeightPx(2, false)
    );
    expect(SIDEBAR_UNIT_PANEL_HEIGHTS.statusAreaPx).toBe(92);
    // Today's smallest state (no lock button, no blocked banner) = 245px
    expect(SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX).toBeLessThanOrEqual(245);
    expect(SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX).toBe(240);

    setViewport(1280, 800);

    const readPanelSnapshot = () => {
      const panel = container!.querySelector(
        '[data-testid="battle-selected-unit-panel"]'
      ) as HTMLElement;
      expect(panel).not.toBeNull();
      return {
        attrHeight: panel.getAttribute('data-panel-height-px'),
        styleHeight: panel.style.height,
        styleMinHeight: panel.style.minHeight,
        styleMaxHeight: panel.style.maxHeight,
        hasFixedClass: panel.className.includes(`h-[${SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}px]`),
        no244Class: !panel.className.includes('h-[244px]'),
      };
    };

    const scenarios: Array<{ label: string; setup: () => void }> = [
      {
        label: 'player turn (unlocked enemy)',
        setup: () => {
          useGameStore.setState({
            autoBattleEnabled: false,
            battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: null }),
          });
          // Inspect e_front via turn-queue chip (selectedTargetId stays null)
          const chip = container!.querySelector(
            '[data-testid="turn-queue-sidebar-chip"][data-unit-id="e_front"]'
          ) as HTMLButtonElement | null;
          chip?.click();
        },
      },
      {
        label: 'player turn (locked enemy)',
        setup: () => {
          useGameStore.setState({
            autoBattleEnabled: false,
            battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: 'e_front' }),
          });
        },
      },
      {
        label: 'AI turn',
        setup: () => {
          useGameStore.setState({
            autoBattleEnabled: false,
            battle: makeBattle({ activeTurnIndex: 1, selectedTargetId: 'e_front' }),
          });
        },
      },
      {
        label: 'Auto mode',
        setup: () => {
          useGameStore.setState({
            autoBattleEnabled: true,
            battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: 'e_front' }),
          });
        },
      },
      {
        label: 'blocked back-row enemy selected',
        setup: () => {
          useGameStore.setState({
            autoBattleEnabled: false,
            battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: 'e_back' }),
          });
        },
      },
      {
        label: 'battle end',
        setup: () => {
          useGameStore.setState({
            autoBattleEnabled: false,
            battle: makeBattle({
              summary: {
                outcome: 'victory',
                deployedGearId: 'striker',
                sectorId: 'aegis_relay',
                rounds: 3,
                expGained: 60,
                creditsGained: 120,
                warPointsGained: 10,
                baseCaptureBonusWp: 0,
                leveledUp: false,
                previousLevel: 1,
                newLevel: 1,
                statPointsGained: 0,
                battlesToNextLevel: 10,
                unlockedSectorId: null,
                enemiesDestroyed: 4,
                totalEnemies: 4,
                alliesSurviving: 1,
                droppedItems: [],
              },
            }),
          });
        },
      },
      {
        label: 'empty no-unit-selected fallback',
        setup: () => {
          useGameStore.setState({
            battle: makeBattle({ units: [], turnOrder: [] }),
          });
        },
      },
    ];

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    for (const sc of scenarios) {
      act(() => {
        sc.setup();
      });
      const snap = readPanelSnapshot();
      expect(snap.attrHeight, sc.label).toBe(
        String(SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX)
      );
      expect(snap.styleHeight, sc.label).toBe(
        `${SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}px`
      );
      expect(snap.styleMinHeight, sc.label).toBe(
        `${SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}px`
      );
      expect(snap.styleMaxHeight, sc.label).toBe(
        `${SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}px`
      );
      expect(snap.hasFixedClass, sc.label).toBe(true);
      expect(snap.no244Class, sc.label).toBe(true);
    }
  });

  it('2) Always-rendered 24px blocked slot and 32px icon-only lock button: dimmed (opacity-40, aria-disabled, no click) when N/A, active when applicable', () => {
    setViewport(1280, 800);
    // Start on player turn inspecting blocked back-row enemy (selectedTargetId null -> click radar e_back)
    act(() => {
      useGameStore.setState({
        autoBattleEnabled: false,
        battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: null }),
      });
      root!.render(createElement(BattleScreen));
    });

    // Click turn-queue chip for e_back (blocked back-row enemy) so sidebar inspects it while selectedTargetId stays null
    const backChip = container!.querySelector(
      '[data-testid="turn-queue-sidebar-chip"][data-unit-id="e_back"]'
    ) as HTMLButtonElement;
    expect(backChip).not.toBeNull();
    act(() => {
      backChip.click();
    });

    const blockedSlot = container!.querySelector(
      '[data-testid="sidebar-blocked-slot"]'
    ) as HTMLElement;
    const lockBtn = container!.querySelector(
      '[data-testid="sidebar-lock-target-btn"]'
    ) as HTMLButtonElement;

    expect(blockedSlot).not.toBeNull();
    expect(blockedSlot.style.width).toBe('24px');
    expect(blockedSlot.style.height).toBe('24px');
    expect(blockedSlot.className).toContain('shrink-0');
    expect(blockedSlot.getAttribute('data-blocked')).toBe('true');
    expect(blockedSlot.className).toContain('text-amber-400');
    expect(blockedSlot.className).not.toContain('opacity-40');
    expect(blockedSlot.getAttribute('aria-disabled')).toBeNull();
    expect(blockedSlot.getAttribute('title')).toBe(
      VI_TRANSLATIONS['battle.frontRowBlocked']
    );
    expect(blockedSlot.getAttribute('aria-label')).toBe(
      VI_TRANSLATIONS['battle.frontRowBlocked']
    );

    // Lock button is applicable and NOT locked yet
    expect(lockBtn).not.toBeNull();
    expect(lockBtn.style.width).toBe('32px');
    expect(lockBtn.style.height).toBe('32px');
    expect(lockBtn.className).toContain('shrink-0');
    expect(lockBtn.disabled).toBe(false);
    expect(lockBtn.className).not.toContain('opacity-40');
    expect(lockBtn.getAttribute('title')).toBe(
      VI_TRANSLATIONS['battle.lockTargetBtn']
    );
    expect(lockBtn.getAttribute('aria-label')).toBe(
      VI_TRANSLATIONS['battle.lockTargetBtn']
    );
    // Icon-only button: no visible text node
    expect(lockBtn.textContent?.trim()).toBe('');

    // Clicking lock button preserves selectTarget handler
    act(() => {
      lockBtn.click();
    });
    expect(useGameStore.getState().battle?.selectedTargetId).toBe('e_back');
    const lockedBtnAfter = container!.querySelector(
      '[data-testid="sidebar-lock-target-btn"]'
    ) as HTMLButtonElement;
    expect(lockedBtnAfter.disabled).toBe(true);
    expect(lockedBtnAfter.getAttribute('aria-disabled')).toBe('true');
    expect(lockedBtnAfter.getAttribute('title')).toBe(
      VI_TRANSLATIONS['battle.targetLockedBtn']
    );

    // Switch to AI turn and inspect unblocked front enemy e_front -> lock button remains rendered, dimmed (opacity-40, aria-disabled, no click)
    act(() => {
      useGameStore.setState({
        battle: makeBattle({ activeTurnIndex: 1, selectedTargetId: 'e_front' }),
      });
    });
    const aiFrontChip = container!.querySelector(
      '[data-testid="turn-queue-acting-chip"][data-unit-id="e_front"]'
    ) as HTMLButtonElement;
    expect(aiFrontChip).not.toBeNull();
    act(() => {
      aiFrontChip.click();
    });
    const aiBlockedSlot = container!.querySelector(
      '[data-testid="sidebar-blocked-slot"]'
    ) as HTMLElement;
    const aiLockBtn = container!.querySelector(
      '[data-testid="sidebar-lock-target-btn"]'
    ) as HTMLButtonElement;
    expect(aiBlockedSlot).not.toBeNull();
    expect(aiBlockedSlot.getAttribute('data-blocked')).toBe('false');
    expect(aiBlockedSlot.className).toContain('opacity-40');
    expect(aiBlockedSlot.getAttribute('aria-disabled')).toBe('true');
    expect(aiBlockedSlot.getAttribute('title')).toBe(
      VI_TRANSLATIONS['battle.frontRowNotBlocked']
    );

    expect(aiLockBtn).not.toBeNull();
    expect(aiLockBtn.disabled).toBe(true);
    expect(aiLockBtn.getAttribute('aria-disabled')).toBe('true');
    expect(aiLockBtn.className).toContain('opacity-40');
    expect(aiLockBtn.getAttribute('title')).toBe(
      VI_TRANSLATIONS['battle.lockTargetUnavailable']
    );
    act(() => {
      aiLockBtn.click();
    });
    expect(useGameStore.getState().battle?.selectedTargetId).toBe('e_front');

    // Switch to player turn inspecting ally unit via acting chip -> lock button stays rendered & dimmed, cannot lock ally
    act(() => {
      useGameStore.setState({
        battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: 'e_front' }),
      });
    });
    const allyChip = container!.querySelector(
      '[data-testid="turn-queue-acting-chip"][data-unit-id="u_player"]'
    ) as HTMLButtonElement;
    expect(allyChip).not.toBeNull();
    act(() => {
      allyChip.click();
    });
    const allyLockBtn = container!.querySelector(
      '[data-testid="sidebar-lock-target-btn"]'
    ) as HTMLButtonElement;
    expect(allyLockBtn).not.toBeNull();
    expect(allyLockBtn.className).toContain('opacity-40');
    expect(allyLockBtn.getAttribute('aria-disabled')).toBe('true');
    expect(allyLockBtn.disabled).toBe(true);
  });

  it('3) Single-line header has no flex-wrap, name & lane truncate, right slots shrink-0, and old 40px/28px elements are gone', () => {
    // Test at narrowest width above 640px (641x800 -> 260px sidebar track)
    setViewport(641, 800);
    act(() => {
      useGameStore.setState({
        battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: 'e_back' }),
      });
      root!.render(createElement(BattleScreen));
    });

    expect(
      container!.querySelector('[data-testid="battle-desktop-layout"]')
    ).not.toBeNull();

    const panel = container!.querySelector(
      '[data-testid="battle-selected-unit-panel"]'
    ) as HTMLElement;
    const header = panel.querySelector(
      '[data-testid="sidebar-unit-header"]'
    ) as HTMLElement;
    const sideTag = panel.querySelector(
      '[data-testid="sidebar-unit-side-tag"]'
    ) as HTMLElement;
    const nameEl = panel.querySelector(
      '[data-testid="sidebar-unit-name"]'
    ) as HTMLElement;
    const laneEl = panel.querySelector(
      '[data-testid="sidebar-unit-lane"]'
    ) as HTMLElement;
    const actionsGroup = panel.querySelector(
      '[data-testid="sidebar-unit-header-actions"]'
    ) as HTMLElement;
    const blockedSlot = panel.querySelector(
      '[data-testid="sidebar-blocked-slot"]'
    ) as HTMLElement;
    const lockBtn = panel.querySelector(
      '[data-testid="sidebar-lock-target-btn"]'
    ) as HTMLButtonElement;

    expect(header.className).not.toContain('flex-wrap');
    expect(header.className).toContain('flex-nowrap');
    expect(header.className).toContain('min-h-[32px]');
    expect(sideTag.className).toContain('shrink-0');
    expect(nameEl.className).toContain('truncate');
    expect(nameEl.className).toContain('min-w-0');
    expect(laneEl.className).toContain('truncate');
    expect(laneEl.className).toContain('min-w-0');
    expect(actionsGroup.className).toContain('shrink-0');
    expect(blockedSlot.className).toContain('shrink-0');
    expect(lockBtn.className).toContain('shrink-0');

    // Arithmetic narrowest width check (260px sidebar -> 238px inner header - 60px right slots - 6px gap = 172px left track)
    const innerHeaderWidthPx =
      SIDEBAR_UNIT_PANEL_HEIGHTS.sidebarMinWidthPx -
      SIDEBAR_UNIT_PANEL_HEIGHTS.borderPx -
      SIDEBAR_UNIT_PANEL_HEIGHTS.padXPx;
    const rightSlotsAndGapPx =
      SIDEBAR_UNIT_PANEL_HEIGHTS.blockedSlotPx +
      4 +
      SIDEBAR_UNIT_PANEL_HEIGHTS.lockButtonSlotPx +
      6;
    expect(innerHeaderWidthPx).toBe(238);
    expect(rightSlotsAndGapPx).toBe(66);
    expect(innerHeaderWidthPx - rightSlotsAndGapPx).toBe(172);

    // Old 40px button row and 28px banner are completely removed from panel body
    expect(panel.textContent).not.toContain(
      VI_TRANSLATIONS['battle.frontRowBlocked']
    );
    expect(panel.textContent).not.toContain(
      VI_TRANSLATIONS['battle.lockTargetBtn']
    );
    expect(panel.textContent).not.toContain(
      VI_TRANSLATIONS['battle.targetLockedBtn']
    );
    expect(panel.querySelector('.min-h-\\[34px\\]')).toBeNull();
  });

  it('4) vi/en keys exist, English attributes switch cleanly, combat log keeps flex-1 min-h-[220px], orange SP & save v9 untouched', () => {
    const keys = [
      'battle.frontRowBlocked',
      'battle.frontRowNotBlocked',
      'battle.lockTargetBtn',
      'battle.targetLockedBtn',
      'battle.lockTargetUnavailable',
    ] as const;
    for (const k of keys) {
      expect(VI_TRANSLATIONS[k], `vi missing ${k}`).toBeTruthy();
      expect(EN_TRANSLATIONS[k], `en missing ${k}`).toBeTruthy();
    }

    setViewport(1440, 900);
    act(() => {
      useGameStore.getState().setLanguage('en');
      useGameStore.setState({
        battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: 'e_back' }),
      });
      root!.render(createElement(BattleScreen));
    });

    const blockedSlotEn = container!.querySelector(
      '[data-testid="sidebar-blocked-slot"]'
    ) as HTMLElement;
    const lockBtnEn = container!.querySelector(
      '[data-testid="sidebar-lock-target-btn"]'
    ) as HTMLButtonElement;
    expect(blockedSlotEn.getAttribute('aria-label')).toBe(
      EN_TRANSLATIONS['battle.frontRowBlocked']
    );
    expect(lockBtnEn.getAttribute('aria-label')).toBe(
      EN_TRANSLATIONS['battle.targetLockedBtn']
    );

    const desktopLog = container!.querySelector(
      '[data-testid="battle-desktop-docked-log"]'
    ) as HTMLElement;
    expect(desktopLog).not.toBeNull();
    expect(desktopLog.className).toContain('flex-1');
    expect(desktopLog.className).toContain('min-h-[220px]');

    const panel = container!.querySelector(
      '[data-testid="battle-selected-unit-panel"]'
    ) as HTMLElement;
    expect(panel.innerHTML).toContain(SP_COLOR_TOKENS.barFillClass);
    expect(panel.innerHTML).toContain(SP_COLOR_TOKENS.textClass);
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(12);
  });

  it('5) Exposed radar lane header has no "Lộ diện" and sidebar unit header has no "Bảo vệ"/"Lộ diện"/"Trống"', () => {
    setViewport(1440, 900);
    act(() => {
      useGameStore.getState().setLanguage('vi');
      useGameStore.setState({
        battle: makeBattle({ activeTurnIndex: 0, selectedTargetId: 'e_back' }),
      });
      root!.render(createElement(BattleScreen));
    });

    const exposedBand = container!.querySelector(
      '[data-row-band="enemy-front"]'
    ) as SVGGElement;
    const exposedRadarHeader = container!.querySelector(
      '[data-testid="radar-lane-header-enemy-front"]'
    ) as HTMLElement;
    expect(exposedBand.getAttribute('data-row-state')).toBe('exposed');
    expect(exposedRadarHeader.textContent).toContain(
      VI_TRANSLATIONS['common.frontRow']
    );
    expect(exposedRadarHeader.textContent).not.toContain('Lộ diện');

    const sidebarHeader = container!.querySelector(
      '[data-testid="sidebar-unit-header"]'
    ) as HTMLElement;
    const sidebarLane = container!.querySelector(
      '[data-testid="sidebar-unit-lane"]'
    ) as HTMLElement;
    expect(sidebarLane.textContent).toBe(VI_TRANSLATIONS['common.backRow']);
    expect(sidebarLane.getAttribute('title')).toBe(
      VI_TRANSLATIONS['common.backRow']
    );
    expect(sidebarHeader.textContent).not.toContain('Bảo vệ');
    expect(sidebarHeader.textContent).not.toContain('Lộ diện');
    expect(sidebarHeader.textContent).not.toContain('Trống');
  });
});
