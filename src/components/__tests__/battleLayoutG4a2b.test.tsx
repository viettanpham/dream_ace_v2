// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { buildExportEnvelope } from '../../engine/saveExport';
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
  LOG_MODE_STORAGE_KEY,
  readSidebarLogMode,
} from '../../utils/combatLogFormat';
import { BattleScreen } from '../BattleScreen';

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

function makeBattle(overrides: Partial<BattleState> = {}): BattleState {
  const units = overrides.units ?? [
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

  const defaultLogs: CombatLogEntry[] = [
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
    {
      id: 'log_2',
      round: 2,
      actorName: 'Vanguard 1',
      actorSide: 'enemy',
      tag: 'SKILL',
      templateKey: 'log.damage',
      params: {
        actor: 'Vanguard 1',
        target: 'Kaelen Vance',
        damage: 95,
        hpDamage: 95,
        shieldDamage: 0,
      },
    },
  ];

  return {
    sectorId: 'aegis_relay',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 2,
    turnCounter: 4,
    units,
    turnOrder: units.map((u) => u.id),
    activeTurnIndex: 0,
    selectedTargetId: units.find((u) => u.side === 'enemy')?.id ?? null,
    selectedAllyTargetId: units.find((u) => u.side === 'ally')?.id ?? null,
    lastPlayerTargetId: units.find((u) => u.side === 'enemy')?.id ?? null,
    autoStopNotice: null,
    wingmanChat: null,
    log: overrides.log ?? defaultLogs,
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

describe('TASK G4a-2b — Right sidebar heights, [Dòng | Mở rộng] log modes & phone inline log', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
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
    window.localStorage.clear();
  });

  it('1) [Dòng | Mở rộng] persists in dreamAce.logMode.v1, defaults to Mở rộng, Cửa sổ popup is not saved, Mở hết/Thu hết only in Mở rộng, and excluded from save exports', async () => {
    setViewport(1440, 900);
    const battle = makeBattle();
    useGameStore.setState({ battle });

    expect(readSidebarLogMode()).toBe('expanded');

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const expandedBtn = container!.querySelector(
      '[data-testid="combat-log-mode-expanded"]'
    ) as HTMLButtonElement;
    const lineBtn = container!.querySelector(
      '[data-testid="combat-log-mode-line"]'
    ) as HTMLButtonElement;
    expect(expandedBtn.textContent).toBe('Mở rộng');
    expect(lineBtn.textContent).toBe('Dòng');
    expect(expandedBtn.getAttribute('aria-pressed')).toBe('true');
    expect(lineBtn.getAttribute('aria-pressed')).toBe('false');
    expect(
      container!.querySelector('[data-testid="combat-log-expand-all"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="combat-log-collapse-all"]')
    ).not.toBeNull();

    // Switch to Dòng -> saved to dreamAce.logMode.v1 and hides Mở hết / Thu hết
    act(() => {
      lineBtn.click();
    });
    expect(window.localStorage.getItem(LOG_MODE_STORAGE_KEY)).toBe('line');
    expect(readSidebarLogMode()).toBe('line');
    expect(
      container!.querySelector('[data-testid="battle-desktop-log-line"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="combat-log-expand-all"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="combat-log-collapse-all"]')
    ).toBeNull();

    // Open Cửa sổ popup -> transient, does NOT overwrite dreamAce.logMode.v1
    const popupBtn = container!.querySelector(
      '[data-testid="combat-log-mode-toggle"]'
    ) as HTMLButtonElement;
    expect(popupBtn.textContent).toContain('Cửa sổ');
    act(() => {
      popupBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="combat-log-popup"]')
    ).not.toBeNull();
    expect(window.localStorage.getItem(LOG_MODE_STORAGE_KEY)).toBe('line');

    // Close popup & remount with stored 'line' -> persists across mounts
    act(() => {
      root!.unmount();
    });
    root = createRoot(container!);
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    expect(
      container!
        .querySelector('[data-testid="combat-log-mode-line"]')
        ?.getAttribute('aria-pressed')
    ).toBe('true');

    // Verify dreamAce.logMode.v1 is NOT in SV1a or SV1b exports and CURRENT_SAVE_VERSION stays 9
    expect(CURRENT_SAVE_VERSION).toBe(11);
    const snapshot = useGameStore.getState().exportSaveStateSnapshot();
    const snapshotJson = JSON.stringify(snapshot);
    expect(snapshotJson).not.toContain('dreamAce.logMode.v1');
    expect(snapshotJson).not.toContain('sidebarLogMode');

    const exportEnvelope = await buildExportEnvelope(snapshot);
    const exportJson = JSON.stringify(exportEnvelope);
    expect(exportJson).not.toContain('dreamAce.logMode.v1');
    expect(exportJson).not.toContain('sidebarLogMode');

    const localPersist =
      window.localStorage.getItem('starfront_mech_rpg_save_v1') ?? '';
    expect(localPersist).not.toContain('dreamAce.logMode.v1');
    expect(localPersist).not.toContain('sidebarLogMode');
  });

  it('2) Selected-unit panel status area uses fixed 2-row height (muted empty line when 0 statuses, internal scroll without "+N" when >2 rows)', () => {
    setViewport(1440, 900);

    // 0 statuses -> fixed 2-row status area with muted centered "Không có hiệu ứng" and no h-[244px]
    const noStatusBattle = makeBattle();
    useGameStore.setState({ battle: noStatusBattle });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const panelNoStatus = container!.querySelector(
      '[data-testid="battle-selected-unit-panel"]'
    ) as HTMLElement;
    expect(panelNoStatus).not.toBeNull();
    expect(panelNoStatus.className).not.toContain('h-[244px]');
    expect(panelNoStatus.querySelector('.opacity-0')).toBeNull();

    const emptyStatusArea = panelNoStatus.querySelector(
      '[data-testid="sidebar-status-area"]'
    ) as HTMLElement;
    expect(emptyStatusArea).not.toBeNull();
    expect(emptyStatusArea.getAttribute('data-status-area-rows')).toBe('2');
    expect(emptyStatusArea.className).toContain('overflow-y-auto');
    expect(emptyStatusArea.textContent).toContain(
      VI_TRANSLATIONS['statusUi.areaEmpty']
    );
    expect(
      panelNoStatus.querySelector('[data-testid="sidebar-status-overflow"]')
    ).toBeNull();

    // Many statuses -> same 2-row height, internal scroll (overflow-y-auto), NO "+N", tapping a chip opens popover
    const manyStatuses: ActiveStatusEffect[] = [
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
      { type: 'burn', turnsRemaining: 2, isDebuff: true, magnitude: 50 },
      { type: 'def_down', turnsRemaining: 2, isDebuff: true, magnitude: 0.25 },
      { type: 'vulnerable', turnsRemaining: 2, isDebuff: true, magnitude: 0.15 },
      { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.2 },
      { type: 'spd_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.3 },
      { type: 'def_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
      { type: 'eva_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.2 },
      { type: 'regen_hp', turnsRemaining: 3, isDebuff: false, magnitude: 0.1 },
    ];
    const richUnits = noStatusBattle.units.map((u) =>
      u.id === noStatusBattle.selectedTargetId
        ? { ...u, statuses: manyStatuses }
        : u
    );
    act(() => {
      useGameStore.setState({
        battle: makeBattle({ units: richUnits }),
      });
    });

    const statusArea = container!.querySelector(
      '[data-testid="sidebar-status-area"]'
    ) as HTMLElement;
    expect(statusArea).not.toBeNull();
    expect(statusArea.getAttribute('data-status-area-rows')).toBe('2');
    expect(statusArea.style.height).toBe(emptyStatusArea.style.height);
    expect(statusArea.className).toContain('overflow-y-auto');
    expect(
      container!.querySelector('[data-testid="sidebar-status-overflow"]')
    ).toBeNull();
    expect(
      statusArea.querySelectorAll('[data-testid^="sidebar-status-chip-"]').length
    ).toBe(manyStatuses.length);

    const firstChip = statusArea.querySelector(
      '[data-testid="sidebar-status-chip-0"]'
    ) as HTMLElement;
    expect(firstChip).not.toBeNull();
    act(() => {
      firstChip.click();
    });
    expect(
      container!.querySelector('[data-testid="status-area-popover"]')
    ).not.toBeNull();
  });

  it('3) Turn queue shows 32px header, current actor, fixed 5-row 26px list (260px total) identical in Mở rộng & Dòng (+N popover)', () => {
    setViewport(1440, 900);
    const battle = makeBattle();
    useGameStore.setState({ battle });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const header = container!.querySelector(
      '[data-testid="turn-queue-sidebar-header"]'
    ) as HTMLElement;
    expect(header.className).toContain('h-[32px]');
    expect(
      container!.querySelector('[data-testid="turn-queue-acting-chip"]')
    ).not.toBeNull();

    const sidebarQueue = container!.querySelector(
      '[data-testid="turn-queue-sidebar"]'
    ) as HTMLElement;
    const expandedQueueHeight = sidebarQueue.getAttribute('data-queue-height-px');
    expect(expandedQueueHeight).toBe('260');
    expect(sidebarQueue.getAttribute('data-queue-rows')).toBe('5');

    const upcomingListExpanded = container!.querySelector(
      '[data-testid="turn-queue-upcoming-list"]'
    ) as HTMLElement;
    expect(upcomingListExpanded.className).toContain('overflow-y-auto');
    expect(upcomingListExpanded.style.height).toBe('146px');

    const chipsExpanded = Array.from(
      container!.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]')
    ) as HTMLElement[];
    expect(chipsExpanded).toHaveLength(15);
    for (const chip of chipsExpanded) {
      expect(chip.className).toContain('h-[26px]');
    }
    const overflowExpanded = container!.querySelector(
      '[data-testid="turn-queue-overflow"]'
    ) as HTMLButtonElement;
    expect(overflowExpanded).not.toBeNull();
    expect(overflowExpanded.textContent).toContain('+10');

    // Clicking "+N" opens full queue popover
    act(() => {
      overflowExpanded.click();
    });
    expect(
      container!.querySelector('[data-testid="turn-queue-popover"]')
    ).not.toBeNull();

    // Switch to Dòng -> queue keeps the exact same fixed 5-row height and +10 overflow
    act(() => {
      (
        container!.querySelector(
          '[data-testid="combat-log-mode-line"]'
        ) as HTMLButtonElement
      ).click();
    });

    const chipsLine = Array.from(
      container!.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]')
    ) as HTMLElement[];
    expect(chipsLine).toHaveLength(15);
    for (const chip of chipsLine) {
      expect(chip.className).toContain('h-[26px]');
    }
    expect(
      container!.querySelector('[data-testid="turn-queue-overflow"]')?.textContent
    ).toContain('+10');

    expect(sidebarQueue.getAttribute('data-queue-height-px')).toBe(
      expandedQueueHeight
    );
    expect(sidebarQueue.className).toContain('shrink-0');
    const desktopLog = container!.querySelector(
      '[data-testid="battle-desktop-docked-log"]'
    ) as HTMLElement;
    expect(desktopLog.className).toContain('shrink-0');
    expect(desktopLog.className).not.toContain('min-h-[220px]');
  });

  it('4) Desktop right column fills viewport height cleanly and combat log has flex-1, min-h-[220px], internal scroll, and non-truncated title + count', () => {
    setViewport(1440, 900);
    useGameStore.setState({ battle: makeBattle() });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const rightSidebar = container!.querySelector(
      '[data-testid="battle-right-sidebar"]'
    ) as HTMLElement;
    expect(rightSidebar).not.toBeNull();
    expect(rightSidebar.className).toContain('h-full');
    expect(rightSidebar.className).toContain('min-h-0');
    expect(rightSidebar.className).toContain('overflow-hidden');

    const desktopLog = container!.querySelector(
      '[data-testid="battle-desktop-docked-log"]'
    ) as HTMLElement;
    expect(desktopLog.className).toContain('flex-1');
    expect(desktopLog.className).toContain('min-h-[220px]');
    expect(desktopLog.className).toContain('overflow-hidden');

    const scrollBox = desktopLog.querySelector(
      '[data-testid="combat-log-scroll"]'
    ) as HTMLElement;
    expect(scrollBox.className).toContain('overflow-y-auto');

    const titleEl = desktopLog.querySelector(
      '[data-testid="combat-log-header-title"]'
    ) as HTMLElement;
    const countEl = desktopLog.querySelector(
      '[data-testid="combat-log-header-count"]'
    ) as HTMLElement;
    expect(titleEl.className).not.toContain('truncate');
    expect(countEl.className).not.toContain('truncate');
    expect(titleEl.textContent).toBe(VI_TRANSLATIONS['battle.combatLog']);
    expect(countEl.textContent).toBe('2 sự kiện');
  });

  it('5) Phone (<=640px): keeps non-log blocks intact, has NO nested vertical scroll container in phone combat log across Mở rộng & Dòng, and opens BottomSheet via Cửa sổ', () => {
    setViewport(390, 844);
    useGameStore.setState({ battle: makeBattle() });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Existing non-log phone blocks remain intact
    expect(
      container!.querySelector('[data-testid="turn-queue-phone-strip"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-phone-controls"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-player-status-bar"]')
    ).not.toBeNull();

    // Phone combat log in Mở rộng flows inside page scroll with zero nested scroll container
    const phoneLog = container!.querySelector(
      '[data-testid="battle-phone-docked-log"]'
    ) as HTMLElement;
    expect(phoneLog).not.toBeNull();
    expect(phoneLog.className).not.toContain('h-[144px]');
    expect(phoneLog.className).not.toContain('overflow-hidden');

    const scrollClassTokens = [
      'overflow-y-auto',
      'overflow-y-scroll',
      'overflow-x-auto',
      'overflow-x-scroll',
      'overflow-auto',
      'overflow-scroll',
      'overscroll-contain',
    ];
    for (const el of [phoneLog, ...Array.from(phoneLog.querySelectorAll('*'))]) {
      const cls = (el.getAttribute('class') || '').split(/\s+/);
      for (const bad of scrollClassTokens) {
        expect(cls).not.toContain(bad);
      }
    }
    expect(
      phoneLog.querySelector('[data-testid="combat-log-expand-all"]')
    ).not.toBeNull();

    // Switch to Dòng -> renders single latest-event line & hides Mở hết / Thu hết
    act(() => {
      (
        phoneLog.querySelector(
          '[data-testid="combat-log-mode-line"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      phoneLog.querySelector('[data-testid="battle-phone-log-line"]')
    ).not.toBeNull();
    expect(
      phoneLog.querySelector('[data-testid="combat-log-expand-all"]')
    ).toBeNull();
    expect(phoneLog.querySelector('.overflow-y-auto')).toBeNull();

    // Click Cửa sổ -> opens bottom sheet popup without changing dreamAce.logMode.v1
    act(() => {
      (
        phoneLog.querySelector(
          '[data-testid="combat-log-mode-toggle"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      container!.querySelector('[data-testid="combat-log-popup"]')
    ).not.toBeNull();
    expect(window.localStorage.getItem(LOG_MODE_STORAGE_KEY)).toBe('line');
  });

  it('6) vi.ts and en.ts maintain full key parity including log.modeLine and log.modeExpanded', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
    expect(VI_TRANSLATIONS['log.modeLine']).toBe('Dòng');
    expect(VI_TRANSLATIONS['log.modeExpanded']).toBe('Mở rộng');
    expect(EN_TRANSLATIONS['log.modeLine']).toBe('Line');
    expect(EN_TRANSLATIONS['log.modeExpanded']).toBe('Expanded');
    for (const key of viKeys) {
      expect(
        (VI_TRANSLATIONS as Record<string, string>)[key].trim().length
      ).toBeGreaterThan(0);
      expect(
        (EN_TRANSLATIONS as Record<string, string>)[key].trim().length
      ).toBeGreaterThan(0);
    }
  });
});
