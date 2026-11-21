// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  formatSpeechBubbleText,
  RADAR_BUBBLES_STORAGE_KEY,
  SPEECH_BUBBLE_DURATION_MS,
  SPEECH_BUBBLE_MAX_CHARS,
} from '../../utils/battleDisplay';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { BattleUnitCard } from '../BattleUnitCard';
import { CombatLogList } from '../CombatLogList';
import { TurnQueueBar } from '../TurnQueueBar';

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
  opts?: {
    isPlayer?: boolean;
    isBoss?: boolean;
    alive?: boolean;
    speed?: number;
    hp?: number;
    classId?: CombatUnit['classId'];
  }
): CombatUnit {
  const alive = opts?.alive ?? true;
  const maxHp = 420;
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: 0,
    isPlayer: Boolean(opts?.isPlayer),
    classId:
      opts?.classId ??
      (row === 'back' ? 'siege' : row === 'middle' ? 'support' : 'striker'),
    isBoss: Boolean(opts?.isBoss),
    level: 12,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 140,
      maxSp: 60,
      speed: opts?.speed ?? 60,
      attackPower: 45,
      defenseRating: 22,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: opts?.hp ?? (alive ? maxHp : 0),
    shield: alive ? 100 : 0,
    sp: 45,
    isDefending: false,
    alive,
    statuses: [],
    animState: 'idle',
  };
}

function makeBattle(overrides?: Partial<BattleState>): BattleState {
  const units = overrides?.units ?? [
    makeUnit('ally_front', 'Commander Zara', 'ally', 'front', {
      isPlayer: true,
      speed: 82,
      classId: 'striker',
    }),
    makeUnit('ally_mid', 'Wingman Hyperion', 'ally', 'middle', {
      speed: 70,
      classId: 'support',
    }),
    makeUnit('ally_back', 'Artillery Titan', 'ally', 'back', {
      speed: 55,
      classId: 'siege',
      alive: false,
      hp: 0,
    }),
    makeUnit('enemy_front', 'Raider Alpha', 'enemy', 'front', {
      speed: 74,
      classId: 'striker',
    }),
    makeUnit('enemy_front_2', 'Raider Beta', 'enemy', 'front', {
      speed: 71,
      classId: 'interceptor',
    }),
    makeUnit('enemy_back', 'Dreadnought Flagship', 'enemy', 'back', {
      isBoss: true,
      speed: 52,
      classId: 'siege',
    }),
  ];
  const turnOrder = sortTurnOrder(units);
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 2,
    turnCounter: 3,
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

function makeLogEntries(count: number): CombatLogEntry[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `entry_${idx + 1}`,
    round: Math.floor(idx / 3) + 1,
    tag: 'SYSTEM',
    actorName: 'Commander Zara',
    actorSide: 'ally',
    templateKey: 'log.battleStart',
    params: { sector: `Sector ${idx + 1}`, difficulty: 'Standard' },
  }));
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.removeItem(RADAR_BUBBLES_STORAGE_KEY);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGameStore.getState().setLanguage('en');
  useGameStore.getState().setAutoBattleEnabled(false);
  useGameStore.getState().setBattleViewMode('radar');
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
  }
  container = null;
});

describe('1) Merged desktop top control bar & "..." overflow menu', () => {
  it('keeps only Manual/Auto, Speed, Radar/Card, and "..." in one single row and moves secondary items into the "..." menu', () => {
    setViewport(1254, 819);
    const battle = makeBattle();
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      autoBattleEnabled: false,
      battleViewMode: 'radar',
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const controls = container!.querySelector(
      '[data-testid="battle-desktop-controls"]'
    );
    expect(controls).not.toBeNull();
    expect(controls!.className).toContain('flex-nowrap');

    // Primary controls stay visible in top bar (including G3b Loop button next to Radar/Card)
    expect(controls!.querySelector('[data-testid="battle-auto-toggle"]')).not.toBeNull();
    expect(controls!.querySelector('[data-testid="battle-speed-selector"]')).not.toBeNull();
    expect(controls!.querySelector('[data-testid="battle-view-switch"]')).not.toBeNull();
    expect(controls!.querySelector('[data-testid="battle-loop-btn"]')).not.toBeNull();
    expect(controls!.querySelector('[data-testid="battle-more-btn"]')).not.toBeNull();

    // Secondary actions are NOT directly cluttering the top control bar
    expect(controls!.querySelector('[data-testid="battle-more-tactics"]')).toBeNull();
    expect(controls!.querySelector('[data-testid="battle-more-stats"]')).toBeNull();
    expect(controls!.querySelector('[data-testid="battle-more-retreat"]')).toBeNull();
    expect(controls!.querySelector('select')).toBeNull();

    // Open "..." menu -> secondary controls appear with labels, and loop controls are moved out
    const moreBtn = controls!.querySelector(
      '[data-testid="battle-more-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      moreBtn.click();
    });

    const moreMenu = container!.querySelector('[data-testid="battle-more-menu"]');
    expect(moreMenu).not.toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-tactics"]')).not.toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-repeat-select"]')).toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-repeat-start"]')).toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-toggle-bubbles"]')).not.toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-toggle-skip-anim"]')).not.toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-stats"]')).not.toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-retreat"]')).not.toBeNull();
  });

  it('removes duplicated bottom AUTO bar on desktop when Auto is enabled', () => {
    setViewport(1254, 819);
    const battle = makeBattle();
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      autoBattleEnabled: false,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(container!.querySelector('[data-testid="battle-manual-dock"]')).not.toBeNull();

    const autoBtn = container!.querySelector(
      '[data-testid="battle-auto-toggle"]'
    ) as HTMLButtonElement;
    act(() => {
      autoBtn.click();
    });

    expect(autoBtn.getAttribute('aria-pressed')).toBe('true');
    expect(container!.querySelector('[data-testid="battle-manual-dock"]')).toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-auto-collapsed-dock"]')
    ).toBeNull();
  });
});

describe('2) Compact Card view rows & collapsed 28px down units', () => {
  it('renders alive units as compact one-line rows with acting highlight and >=44px info button, and collapses down units to 28px', () => {
    const aliveUnit = makeUnit('u_alive', 'Commander Zara', 'ally', 'front', {
      isPlayer: true,
      alive: true,
    });
    const downUnit = makeUnit('u_down', 'Artillery Titan', 'ally', 'back', {
      alive: false,
      hp: 0,
    });

    const onInspect = vi.fn();
    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(BattleUnitCard, {
            unit: aliveUnit,
            isActiveTurn: true,
            isTargeted: false,
            canTarget: false,
            exploding: false,
            skipAnimations: false,
            popups: [],
            onInspect,
          }),
          createElement(BattleUnitCard, {
            unit: downUnit,
            isActiveTurn: false,
            isTargeted: false,
            canTarget: false,
            exploding: false,
            skipAnimations: false,
            popups: [],
            onInspect,
          })
        )
      );
    });

    // Alive row: compact ~50px row, acting highlight, HP/SHD/SP numbers, >=44px info button
    const aliveRow = container!.querySelector(
      '[data-testid="unit-row-u_alive"]'
    ) as HTMLElement;
    expect(aliveRow).not.toBeNull();
    expect(aliveRow.getAttribute('data-unit-collapsed')).toBe('false');
    expect(aliveRow.getAttribute('data-acting')).toBe('true');
    expect(aliveRow.className).toContain('min-h-[50px]');
    expect(aliveRow.textContent).toContain('420/420');
    expect(aliveRow.textContent).toContain('Lv.12');

    const infoBtn = aliveRow.querySelector(
      '[data-testid="unit-row-info-u_alive"]'
    ) as HTMLButtonElement;
    expect(infoBtn).not.toBeNull();
    expect(infoBtn.className).toContain('min-w-[44px]');
    expect(infoBtn.className).toContain('min-h-[44px]');

    // Down row: collapsed 28px single-line row with "Down"
    const downRow = container!.querySelector(
      '[data-testid="unit-row-down-u_down"]'
    ) as HTMLElement;
    expect(downRow).not.toBeNull();
    expect(downRow.getAttribute('data-unit-collapsed')).toBe('true');
    expect(downRow.className).toContain('h-[28px]');
    expect(downRow.className).toContain('max-h-[28px]');
    expect(downRow.textContent).toContain('Down');
  });
});

describe('3) Card view stacked Allies-above-Enemies on phone & side-by-side columns on desktop', () => {
  it('renders Allies above Enemies without tabs on phone portrait and supports target selection & down unit visibility', () => {
    setViewport(390, 844);
    const battle = makeBattle();
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      battleViewMode: 'card',
      autoBattleEnabled: false,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(container!.querySelector('[data-testid="card-side-tabs"]')).toBeNull();
    expect(container!.querySelector('[data-testid="card-tab-ally"]')).toBeNull();
    expect(container!.querySelector('[data-testid="card-tab-enemy"]')).toBeNull();

    const allyBlock = container!.querySelector('[data-testid="card-side-ally"]');
    const enemyBlock = container!.querySelector('[data-testid="card-side-enemy"]');
    expect(allyBlock).not.toBeNull();
    expect(enemyBlock).not.toBeNull();

    // Allies block appears above Enemies block in DOM order
    expect(
      Boolean(
        allyBlock!.compareDocumentPosition(enemyBlock!) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    // Down back-row ally unit is already visible without switching tabs
    expect(
      container!.querySelector('[data-testid="unit-row-down-ally_back"]')
    ).not.toBeNull();

    // Tapping a valid front-row enemy selects it
    const enemy2Row = container!.querySelector(
      '[data-testid="unit-row-enemy_front_2"]'
    ) as HTMLElement;
    expect(enemy2Row).not.toBeNull();
    act(() => {
      enemy2Row.click();
    });
    expect(useGameStore.getState().battle?.selectedTargetId).toBe('enemy_front_2');

    // Tapping a protected back-row enemy shows a one-line invalid reason toast
    const backEnemyRow = container!.querySelector(
      '[data-testid="unit-row-enemy_back"]'
    ) as HTMLElement;
    act(() => {
      backEnemyRow.click();
    });
    expect(
      container!.querySelector('[data-testid="card-invalid-target-toast"]')
    ).not.toBeNull();
    expect(useGameStore.getState().battle?.selectedTargetId).toBe('enemy_front_2');
  });

  it('shows Allies and Enemies side by side simultaneously in Card view on desktop (1254x819)', () => {
    setViewport(1254, 819);
    const battle = makeBattle();
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      battleViewMode: 'card',
      autoBattleEnabled: false,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(container!.querySelector('[data-testid="card-side-tabs"]')).toBeNull();
    expect(container!.querySelector('[data-testid="card-side-ally"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="card-side-enemy"]')).not.toBeNull();
    expect(
      container!.querySelector('[data-card-row="enemy-front"]')?.getAttribute('data-row-state')
    ).toBe('exposed');
    expect(
      container!.querySelector('[data-card-row="enemy-back"]')?.getAttribute('data-row-state')
    ).toBe('protected');
  });
});

describe('4) Radar speech bubble truncation, 1.5s auto-hide, bubbles-off toggle, down size & compact buff popups', () => {
  it('truncates speech bubbles to <= 28 chars, auto-hides after 1.5s, and hides when disabled', () => {
    vi.useFakeTimers();

    const formatted = formatSpeechBubbleText(
      'Wingman Hyperion',
      'Covering your flank, Commander! Engaging all incoming hostiles now!'
    );
    expect(formatted.length).toBeLessThanOrEqual(SPEECH_BUBBLE_MAX_CHARS);
    expect(formatted.endsWith('…')).toBe(true);

    const battleWithChat = makeBattle({
      wingmanChat: {
        id: 'chat_1',
        unitId: 'ally_mid',
        unitName: 'Wingman Hyperion',
        textKey: 'battle.chat.assist1',
      },
      popups: [
        { id: 'p_dmg', unitId: 'enemy_front', text: '-120', tone: 'damage' },
        { id: 'p_buff', unitId: 'ally_front', text: 'WPN +30%', tone: 'buff' },
      ],
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: battleWithChat,
          activeUnitId: 'ally_front',
          validBasicTargetIds: new Set(['enemy_front', 'enemy_front_2']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          speechBubblesEnabled: true,
          layoutMode: 'pc',
          onSelectEnemy: () => {},
          onSelectAlly: () => {},
          onInspectUnit: () => {},
        })
      );
    });

    // Bubble visible initially and <= 28 chars
    const bubbleText = container!.querySelector(
      '[data-testid="radar-speech-bubble-text"]'
    );
    expect(bubbleText).not.toBeNull();
    expect((bubbleText!.textContent ?? '').length).toBeLessThanOrEqual(
      SPEECH_BUBBLE_MAX_CHARS
    );

    // Compact buff popup is marked compact while damage popup is not
    const popups = Array.from(
      container!.querySelectorAll('[data-testid="damage-popup"]')
    );
    const buffPopup = popups.find((el) => el.textContent === 'WPN +30%');
    const dmgPopup = popups.find((el) => el.textContent === '-120');
    expect(buffPopup?.getAttribute('data-popup-compact')).toBe('true');
    expect(dmgPopup?.getAttribute('data-popup-compact')).toBe('false');

    // Down unit marker is drawn smaller than alive unit marker
    const aliveToken = container!.querySelector('[data-testid="radar-unit-ally_front"]');
    const downToken = container!.querySelector('[data-testid="radar-unit-ally_back"]');
    expect(Number(downToken?.getAttribute('data-visual-radius'))).toBeLessThan(
      Number(aliveToken?.getAttribute('data-visual-radius'))
    );

    // Auto-hides after 1.5s
    act(() => {
      vi.advanceTimersByTime(SPEECH_BUBBLE_DURATION_MS);
    });
    expect(
      container!.querySelector('[data-testid="radar-speech-bubble"]')
    ).toBeNull();

    // New bubble with speechBubblesEnabled=false never renders
    const battleWithChat2 = makeBattle({
      wingmanChat: {
        id: 'chat_2',
        unitId: 'ally_mid',
        unitName: 'Wingman Hyperion',
        textKey: 'battle.chat.assist1',
      },
    });
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: battleWithChat2,
          activeUnitId: 'ally_front',
          validBasicTargetIds: new Set(['enemy_front']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          speechBubblesEnabled: false,
          layoutMode: 'pc',
          onSelectEnemy: () => {},
          onSelectAlly: () => {},
          onInspectUnit: () => {},
        })
      );
    });
    expect(
      container!.querySelector('[data-testid="radar-speech-bubble"]')
    ).toBeNull();
  });

  it('persists speech bubbles off setting via the "..." menu in BattleScreen', () => {
    setViewport(1254, 819);
    const battle = makeBattle({
      wingmanChat: {
        id: 'chat_toggle',
        unitId: 'ally_mid',
        unitName: 'Wingman Hyperion',
        textKey: 'battle.chat.assist1',
      },
    });
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      battleViewMode: 'radar',
      autoBattleEnabled: false,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(
      container!.querySelector('[data-testid="radar-speech-bubble"]')
    ).not.toBeNull();

    const moreBtn = container!.querySelector(
      '[data-testid="battle-more-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      moreBtn.click();
    });

    const toggleBtn = container!.querySelector(
      '[data-testid="battle-toggle-bubbles"]'
    ) as HTMLButtonElement;
    act(() => {
      toggleBtn.click();
    });

    expect(window.localStorage.getItem(RADAR_BUBBLES_STORAGE_KEY)).toBe('false');
    expect(
      container!.querySelector('[data-testid="radar-speech-bubble"]')
    ).toBeNull();
  });
});

describe('5) Combat log auto-scroll pause & Jump to latest button', () => {
  it('auto-scrolls at bottom, pauses when user scrolls up, and resumes on clicking Jump to latest', () => {
    const initial = makeLogEntries(10);
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: initial,
          active: true,
          density: 'compact',
        })
      );
    });

    const scrollBox = container!.querySelector(
      '[data-testid="combat-log-scroll"]'
    ) as HTMLDivElement;
    expect(scrollBox).not.toBeNull();

    Object.defineProperty(scrollBox, 'scrollHeight', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(scrollBox, 'clientHeight', {
      configurable: true,
      value: 250,
    });
    scrollBox.scrollTop = 750;

    // Appending while at bottom keeps auto-scroll pinned
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: makeLogEntries(12),
          active: true,
          density: 'compact',
        })
      );
    });
    expect(scrollBox.scrollTop).toBe(1000);
    expect(
      container!.querySelector('[data-testid="combat-log-jump-latest"]')
    ).toBeNull();

    // User scrolls up -> pauses auto-scroll and shows Jump to latest button (>=44px)
    scrollBox.scrollTop = 180;
    act(() => {
      scrollBox.dispatchEvent(new Event('scroll'));
    });

    const jumpBtn = container!.querySelector(
      '[data-testid="combat-log-jump-latest"]'
    ) as HTMLButtonElement;
    expect(jumpBtn).not.toBeNull();
    expect(jumpBtn.className).toContain('min-h-[44px]');

    // New log entry arrives while scrolled up -> does NOT yank scrollTop back to bottom
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: makeLogEntries(14),
          active: true,
          density: 'compact',
        })
      );
    });
    expect(scrollBox.scrollTop).toBe(180);

    // Clicking Jump to latest snaps to bottom and hides button
    act(() => {
      jumpBtn.click();
    });
    expect(scrollBox.scrollTop).toBe(1000);
    expect(
      container!.querySelector('[data-testid="combat-log-jump-latest"]')
    ).toBeNull();
  });
});

describe('6) Turn queue full-name display & full-name tooltip/tap (Q1)', () => {
  it('shows full names with min-w-0 truncate in sidebar turn queue chips and preserves full name on hover & tap', () => {
    const battle = makeBattle();
    const onSelectUnit = vi.fn();

    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: 'Dreadnought Flagship',
          onSelectUnit,
        })
      );
    });

    const actingChip = container!.querySelector(
      '[data-testid="turn-queue-acting-chip"]'
    ) as HTMLButtonElement;
    expect(actingChip).not.toBeNull();
    expect(actingChip.getAttribute('data-full-name')).toBe('Commander Zara');
    expect(actingChip.title).toContain('Commander Zara');
    expect(
      actingChip.querySelector('[data-testid="turn-queue-acting-attacker"]')?.textContent
    ).toBe('Commander Zara');
    expect(
      actingChip.querySelector('[data-testid="turn-queue-acting-target"]')?.textContent
    ).toBe('Dreadnought Flagship');

    const chips = Array.from(
      container!.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]')
    ) as HTMLButtonElement[];
    expect(chips.length).toBeGreaterThan(0);

    for (const chip of chips) {
      const nameNode = chip.querySelector(
        '[data-testid="turn-queue-chip-name"]'
      ) as HTMLElement;
      expect(nameNode).not.toBeNull();
      const fullName = chip.getAttribute('data-full-name') ?? '';
      expect(nameNode.textContent).toBe(fullName);
      expect(nameNode.className).toContain('min-w-0');
      expect(nameNode.className).toContain('truncate');
      expect(nameNode.className).not.toMatch(/max-w-/);
      expect(nameNode.title).toBe(fullName);
      expect(chip.title).toContain(fullName);
    }

    // Tapping a chip invokes onSelectUnit with its unit ID so full details open
    const targetId = chips[0].getAttribute('data-unit-id');
    act(() => {
      chips[0].click();
    });
    expect(onSelectUnit).toHaveBeenCalledWith(targetId);
  });
});
