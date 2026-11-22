// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { sortTurnOrder } from '../../engine/combat';
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleState,
  CombatRow,
  CombatUnit,
  FloatingPopup,
} from '../../types/game';
import {
  computeRowExposure,
  formatShortUnitName,
  getBattleLayoutMode,
  layoutStaggeredPopups,
} from '../../utils/battleDisplay';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { MapView } from '../MapView';
import { TopHud } from '../TopHud';
import { TurnQueueBar } from '../TurnQueueBar';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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
  opts?: {
    isPlayer?: boolean;
    isBoss?: boolean;
    alive?: boolean;
    speed?: number;
    hp?: number;
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
      row === 'back' ? 'siege' : row === 'middle' ? 'support' : 'striker',
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
      attackPower: 40,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: opts?.hp ?? (alive ? maxHp : 0),
    shield: alive ? 90 : 0,
    sp: 50,
    isDefending: false,
    alive,
    statuses: [],
    animState: 'idle',
  };
}

function makeThreeRowBattle(overrides?: Partial<BattleState>): BattleState {
  const units = overrides?.units ?? [
    makeUnit('ally_front', 'ZARA', 'ally', 'front', {
      isPlayer: true,
      speed: 80,
    }),
    makeUnit('ally_mid', 'Nova Wingman', 'ally', 'middle', { speed: 68 }),
    makeUnit('ally_back', 'Artillery Siege Unit', 'ally', 'back', {
      speed: 54,
    }),
    makeUnit('enemy_front', 'Raider 2', 'enemy', 'front', { speed: 72 }),
    makeUnit('enemy_mid', 'Void Interceptor', 'enemy', 'middle', {
      speed: 64,
    }),
    makeUnit('enemy_back', 'Dreadnought Boss', 'enemy', 'back', {
      isBoss: true,
      speed: 50,
    }),
  ];
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
    log: [
      {
        id: 'log_1',
        round: 1,
        tag: 'SYSTEM',
        actorName: 'System',
        templateKey: 'log.battleStart',
        params: { sector: 'Kestrel Relay Outpost', difficulty: 'Standard' },
      },
    ],
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

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGameStore.getState().setLanguage('en');
  useGameStore.getState().setAutoBattleEnabled(false);
  useGameStore.getState().setBattleViewMode('radar');
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

describe('1) Short-name & layout-mode pure functions', () => {
  it('formatShortUnitName enforces max 10 chars, collapses whitespace, and preserves short names', () => {
    expect(formatShortUnitName('ZARA')).toBe('ZARA');
    expect(formatShortUnitName('Raider 2')).toBe('Raider 2');
    expect(formatShortUnitName('1234567890')).toBe('1234567890');
    expect(formatShortUnitName('  Void   Interceptor  ')).toBe('Void Inte…');
    expect(formatShortUnitName('  Void   Interceptor  ').length).toBeLessThanOrEqual(
      10
    );
    expect(formatShortUnitName('Iron Dreadnought Flagship').length).toBeLessThanOrEqual(
      10
    );
    expect(formatShortUnitName('')).toBe('');
    expect(formatShortUnitName('   ')).toBe('');
    expect(formatShortUnitName('VeryLongCallsign', 6)).toBe('VeryL…');
  });

  it('getBattleLayoutMode classifies phone portrait, landscape phone (as PC), tablet, and PC accurately', () => {
    expect(getBattleLayoutMode(390, 844)).toBe('phone-portrait');
    expect(getBattleLayoutMode(599, 800)).toBe('phone-portrait');
    // Landscape phone uses PC layout
    expect(getBattleLayoutMode(844, 390)).toBe('pc');
    expect(getBattleLayoutMode(667, 375)).toBe('pc');
    // Tablet 600..1023
    expect(getBattleLayoutMode(768, 1024)).toBe('tablet');
    expect(getBattleLayoutMode(1023, 768)).toBe('tablet');
    // PC >= 1024
    expect(getBattleLayoutMode(1280, 800)).toBe('pc');
  });
});

describe('2) Damage-number stagger pure function', () => {
  it('staggers simultaneous popups vertically and by time, caps at 6, and uses 800ms duration', () => {
    const posMap = new Map([
      ['u1', { x: 190, y: 260 }],
      ['u2', { x: 195, y: 262 }], // intentionally adjacent to u1
    ]);

    const burst: FloatingPopup[] = Array.from({ length: 9 }, (_, i) => ({
      id: `pop_${i + 1}`,
      unitId: i < 7 ? 'u1' : 'u2',
      text: `-${40 + i * 10}`,
      tone: i % 2 === 0 ? 'damage' : 'crit',
    }));

    const laidOut = layoutStaggeredPopups(burst, posMap, 380, 520);

    // Simultaneous cap = 6, keeping newest entries (pop_4..pop_9)
    expect(laidOut).toHaveLength(6);
    expect(laidOut.map((x) => x.popup.id)).toEqual([
      'pop_4',
      'pop_5',
      'pop_6',
      'pop_7',
      'pop_8',
      'pop_9',
    ]);

    // Every popup has ~800ms duration
    for (const item of laidOut) {
      expect(item.durationMs).toBe(800);
    }

    // Popups on the same unit (u1) have strictly increasing time delays and distinct vertical positions
    const u1Popups = laidOut.filter((x) => x.popup.unitId === 'u1');
    expect(u1Popups.length).toBe(4);
    for (let i = 1; i < u1Popups.length; i++) {
      expect(u1Popups[i].delayMs).toBeGreaterThan(u1Popups[i - 1].delayMs);
      expect(u1Popups[i].topPct).not.toBe(u1Popups[i - 1].topPct);
    }

    // No two rendered popups share overlapping coordinates
    for (let i = 0; i < laidOut.length; i++) {
      for (let j = i + 1; j < laidOut.length; j++) {
        const dx = Math.abs(laidOut[i].leftPct - laidOut[j].leftPct);
        const dy = Math.abs(laidOut[i].topPct - laidOut[j].topPct);
        expect(dx >= 3 || dy >= 5).toBe(true);
      }
    }
  });
});

describe('3) Exit-confirm dialog when tapping logo during active battle', () => {
  it('opens "Leave battle?" confirm dialog on logo tap, Cancel keeps battle, Confirm exits', () => {
    setViewport(390, 844);
    const battle = makeThreeRowBattle();
    useGameStore.setState({ screen: 'BATTLE', battle });

    act(() => {
      root!.render(createElement(TopHud));
    });

    // Slim phone battle top bar rendered
    const phoneBar = container!.querySelector('[data-testid="tophud-phone-battle"]');
    expect(phoneBar).not.toBeNull();

    // Tap logo mark during battle -> MUST NOT exit immediately
    const logoBtn = container!.querySelector(
      '[data-testid="tophud-brand-logo"]'
    ) as HTMLButtonElement;
    expect(logoBtn).not.toBeNull();

    act(() => {
      logoBtn.click();
    });

    expect(useGameStore.getState().screen).toBe('BATTLE');
    const dialog = container!.querySelector('[data-testid="leave-battle-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Leave battle?');

    // Cancel keeps user inside active battle
    const cancelBtn = container!.querySelector(
      '[data-testid="leave-battle-cancel"]'
    ) as HTMLButtonElement;
    act(() => {
      cancelBtn.click();
    });
    expect(container!.querySelector('[data-testid="leave-battle-dialog"]')).toBeNull();
    expect(useGameStore.getState().screen).toBe('BATTLE');

    // Tap logo again and Confirm -> exits battle cleanly
    act(() => {
      logoBtn.click();
    });
    const confirmBtn = container!.querySelector(
      '[data-testid="leave-battle-confirm"]'
    ) as HTMLButtonElement;
    act(() => {
      confirmBtn.click();
    });
    expect(useGameStore.getState().screen).toBe('HANGAR');
    expect(useGameStore.getState().battle).toBeNull();
  });
});

describe('4) Auto mode hides manual dock (without separate AUTO bar) & responsive phone/landscape layouts', () => {
  it('hides the 4-button action dock when Auto is enabled on phone portrait without rendering a separate AUTO bar', () => {
    setViewport(390, 844);
    const battle = makeThreeRowBattle();
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      autoBattleEnabled: false,
      battleViewMode: 'radar',
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(container!.querySelector('[data-testid="battle-phone-layout"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="battle-manual-dock"]')).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-auto-collapsed-dock"]')
    ).toBeNull();

    // Toggle Auto ON via compact control row button
    const autoBtn = container!.querySelector(
      '[data-testid="battle-auto-toggle"]'
    ) as HTMLButtonElement;
    expect(autoBtn).not.toBeNull();
    act(() => {
      autoBtn.click();
    });

    expect(useGameStore.getState().autoBattleEnabled).toBe(true);
    expect(container!.querySelector('[data-testid="battle-manual-dock"]')).toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-auto-collapsed-dock"]')
    ).toBeNull();

    // Tapping battle-auto-toggle again returns to Manual and restores the 4-button dock
    act(() => {
      autoBtn.click();
    });

    expect(useGameStore.getState().autoBattleEnabled).toBe(false);
    expect(container!.querySelector('[data-testid="battle-manual-dock"]')).not.toBeNull();
  });

  it('switches to PC 2-column layout on landscape phone (844x390)', () => {
    setViewport(844, 390);
    const battle = makeThreeRowBattle();
    useGameStore.setState({ screen: 'BATTLE', battle, autoBattleEnabled: false });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(container!.querySelector('[data-testid="battle-desktop-layout"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="battle-phone-layout"]')).toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-selected-unit-panel"]')
    ).not.toBeNull();
  });
});

describe('5) 3-row field rendering with exposed/protected rows, touch-action pan-y & phone turn queue', () => {
  it('renders 3 separated rows per side, distinguishes exposed vs protected rows, and updates when front row is wiped', () => {
    const battleFull = makeThreeRowBattle({
      popups: [
        { id: 'p1', unitId: 'enemy_front', text: '-85', tone: 'damage' },
        { id: 'p2', unitId: 'enemy_front', text: '-140 CRIT', tone: 'crit' },
      ],
    });

    // Pure exposure helper check
    expect(computeRowExposure(battleFull.units, 'enemy')).toEqual({
      front: 'exposed',
      middle: 'protected',
      back: 'protected',
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: battleFull,
          activeUnitId: 'ally_front',
          validBasicTargetIds: new Set(['enemy_front']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          layoutMode: 'phone-portrait',
          onSelectEnemy: () => {},
          onSelectAlly: () => {},
          onInspectUnit: () => {},
        })
      );
    });

    // Radar container uses touch-action: pan-y so vertical scroll is never trapped
    const radarBox = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    ) as HTMLElement;
    expect(radarBox).not.toBeNull();
    expect(radarBox.style.touchAction).toBe('pan-y');

    // All 6 row bands exist with accurate exposure state
    expect(
      container!
        .querySelector('[data-row-band="enemy-front"]')
        ?.getAttribute('data-row-state')
    ).toBe('exposed');
    expect(
      container!
        .querySelector('[data-row-band="enemy-middle"]')
        ?.getAttribute('data-row-state')
    ).toBe('protected');
    expect(
      container!
        .querySelector('[data-row-band="enemy-back"]')
        ?.getAttribute('data-row-state')
    ).toBe('protected');
    expect(
      container!
        .querySelector('[data-row-band="ally-front"]')
        ?.getAttribute('data-row-state')
    ).toBe('exposed');
    expect(
      container!
        .querySelector('[data-row-band="ally-middle"]')
        ?.getAttribute('data-row-state')
    ).toBe('protected');
    expect(
      container!
        .querySelector('[data-row-band="ally-back"]')
        ?.getAttribute('data-row-state')
    ).toBe('protected');

    // Short unit names are capped at 10 chars
    const nameNodes = Array.from(
      container!.querySelectorAll('[data-testid="radar-unit-name"]')
    );
    expect(nameNodes.length).toBe(6);
    for (const node of nameNodes) {
      expect((node.textContent ?? '').length).toBeLessThanOrEqual(10);
    }

    // Floating labels: 1 active label at a time per unit in an 18px slot (G4a-3a Item 2)
    const popupNodes = Array.from(
      container!.querySelectorAll('[data-testid="damage-popup"]')
    ) as HTMLElement[];
    expect(popupNodes).toHaveLength(1);
    expect(popupNodes[0].textContent).toBe('-85');
    expect(popupNodes[0].getAttribute('data-slot-height')).toBe('18');

    // Wipe enemy front row -> enemy middle becomes exposed automatically
    const wipedUnits = battleFull.units.map((u) =>
      u.id === 'enemy_front' ? { ...u, alive: false, hp: 0 } : u
    );
    const battleWiped = { ...battleFull, units: wipedUnits };

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: battleWiped,
          activeUnitId: 'ally_front',
          validBasicTargetIds: new Set(['enemy_mid']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          layoutMode: 'phone-portrait',
          onSelectEnemy: () => {},
          onSelectAlly: () => {},
          onInspectUnit: () => {},
        })
      );
    });

    expect(
      container!
        .querySelector('[data-row-band="enemy-front"]')
        ?.getAttribute('data-row-state')
    ).toBe('empty');
    expect(
      container!
        .querySelector('[data-row-band="enemy-middle"]')
        ?.getAttribute('data-row-state')
    ).toBe('exposed');
    expect(
      container!
        .querySelector('[data-row-band="enemy-back"]')
        ?.getAttribute('data-row-state')
    ).toBe('protected');
  });

  it('TurnQueueBar phone variant renders "ZARA > Raider 2" acting chip + next upcoming chips inside max-44px strip', () => {
    const battle = makeThreeRowBattle();
    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'phone',
          targetName: 'Raider 2',
        })
      );
    });

    const strip = container!.querySelector(
      '[data-testid="turn-queue-phone-strip"]'
    );
    expect(strip).not.toBeNull();
    expect(strip!.className).toContain('max-h-[44px]');

    const actingChip = container!.querySelector(
      '[data-testid="turn-queue-acting-chip"]'
    );
    expect(actingChip).not.toBeNull();
    expect(actingChip!.textContent).toContain('ZARA > Raider 2');

    const nextChips = container!.querySelectorAll(
      '[data-testid="turn-queue-phone-next-chip"]'
    );
    expect(nextChips.length).toBeGreaterThanOrEqual(4);
    expect(nextChips.length).toBeLessThanOrEqual(5);
  });
});

describe('6) Pre-battle intro collapsible Details section', () => {
  it('renders a single short summary line by default and toggles full description when clicking Details', () => {
    useGameStore.getState().setLanguage('en');
    act(() => {
      root!.render(createElement(MapView));
    });

    const toggleBtn = container!.querySelector(
      '[data-testid="prebattle-details-toggle"]'
    ) as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(
      container!.querySelector('[data-testid="prebattle-details-content"]')
    ).toBeNull();

    act(() => {
      toggleBtn.click();
    });

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    const details = container!.querySelector(
      '[data-testid="prebattle-details-content"]'
    );
    expect(details).not.toBeNull();
    expect((details!.textContent ?? '').length).toBeGreaterThan(20);
  });
});
