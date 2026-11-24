// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleState,
  CombatLogEntry,
  CombatUnit,
} from '../../types/game';
import { SP_COLOR_HEX, SP_COLOR_TOKENS } from '../../utils/battleDisplay';
import {
  BUILTIN_STATUS_DISPLAY_DEFAULTS,
  resolveEffectiveStatusDisplaySettings,
} from '../../utils/statusDisplayPrefs';
import { BattleScreen } from '../BattleScreen';
import { BattleUnitCard } from '../BattleUnitCard';
import { CombatLogList } from '../CombatLogList';
import { EffectsSettingsPanel } from '../EffectsSettingsPanel';
import { UnitDetailSheet } from '../UnitDetailSheet';

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const maxHp = overrides.derived?.maxHp ?? 900;
  const maxShield = overrides.derived?.maxShield ?? 250;
  const maxSp = overrides.derived?.maxSp ?? 80;
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
    equippedSkillIds: overrides.equippedSkillIds ?? ['pulse_overdrive'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield,
      maxSp,
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
    hp: overrides.hp ?? maxHp,
    shield: overrides.shield ?? maxShield,
    sp: overrides.sp ?? 55,
    isDefending: false,
    alive: overrides.alive ?? true,
    statuses: overrides.statuses ?? [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(overrides: Partial<BattleState> = {}): BattleState {
  const player = makeUnit('u_player', 'Kaelen Vance', 'ally', {
    isPlayer: true,
    row: 'front',
    formationCol: 0,
    hp: 640,
    shield: 180,
    sp: 55,
    statuses: [
      {
        type: 'slow',
        turnsRemaining: 2,
        magnitude: 0.2,
      },
      {
        type: 'burn',
        turnsRemaining: 2,
        magnitude: 45,
      },
    ],
  });
  const ally2 = makeUnit('u_ally_2', 'Marek Solis', 'ally', {
    row: 'middle',
    formationCol: 0,
  });
  const enemy1 = makeUnit('u_enemy_1', 'Vanguard Striker', 'enemy', {
    row: 'front',
    formationCol: 0,
  });
  const enemy2 = makeUnit('u_enemy_2', 'Void Sniper', 'enemy', {
    row: 'back',
    formationCol: 0,
  });

  const units = overrides.units ?? [player, ally2, enemy1, enemy2];
  return {
    sectorId: 'aegis_relay',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    units,
    turnOrder: units.filter((u) => u.alive).map((u) => u.id),
    activeTurnIndex: 0,
    selectedTargetId: enemy1.id,
    selectedAllyTargetId: player.id,
    lastPlayerTargetId: enemy1.id,
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

describe('G4a-L1: Battle main column layout fix & orange SP token', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    window.localStorage.clear();
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState({
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
    vi.restoreAllMocks();
  });

  it('1) Renders NO battle-camera-slot on phone (390x844) or desktop (1440x900) and NO action camera toggle', () => {
    const battle = makeBattle();
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'radar' });

    setViewport(390, 844);
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    expect(container!.querySelector('[data-testid="battle-camera-slot"]')).toBeNull();
    expect(container!.innerHTML).not.toContain('h-[120px]');

    act(() => {
      setViewport(1440, 900);
    });
    expect(container!.querySelector('[data-testid="battle-camera-slot"]')).toBeNull();
    expect(container!.innerHTML).not.toContain('h-[160px]');

    act(() => {
      root!.render(createElement(EffectsSettingsPanel));
    });
    expect(container!.querySelector('[data-testid="battle-toggle-action-camera"]')).toBeNull();
  });

  it('2) Destroyed player on desktop is ONE slim line (max 28px) with [TA], struck-through name, "Đã phát nổ", NO bars and NO status strip', () => {
    setViewport(1440, 900);
    const deadPlayer = makeUnit('u_player', 'Kaelen Vance', 'ally', {
      isPlayer: true,
      alive: false,
      hp: 0,
      shield: 0,
      sp: 0,
      statuses: [
        {
          type: 'burn',
          turnsRemaining: 2,
          magnitude: 30,
        },
      ],
    });
    const battle = makeBattle({
      units: [
        deadPlayer,
        makeUnit('u_ally_2', 'Marek Solis', 'ally', { row: 'middle' }),
        makeUnit('u_enemy_1', 'Vanguard Striker', 'enemy', { row: 'front' }),
      ],
    });
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'radar' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const playerBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(playerBar).not.toBeNull();
    expect(playerBar.getAttribute('data-destroyed')).toBe('true');
    expect(playerBar.className).toContain('max-h-[28px]');
    expect(playerBar.className).toContain('h-[28px]');
    expect(playerBar.textContent).toContain('TA');
    expect(playerBar.textContent).toContain('Kaelen Vance');
    expect(playerBar.innerHTML).toContain('line-through');
    expect(
      playerBar.querySelector('[data-testid="battle-player-destroyed-badge"]')?.textContent
    ).toBe('Đã phát nổ');

    // No bars, no numbers, no reserved status strip
    expect(playerBar.querySelector('[data-testid="battle-player-hp-shield-bar"]')).toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-shield-bar"]')).toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-sp-bar"]')).toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-hp-numbers"]')).toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-shield-numbers"]')).toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-sp-numbers"]')).toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-status-effects"]')).toBeNull();
  });

  it('3) Alive player block on desktop enforces max-h-[72px] without overflow-hidden, default playerDesktopRows=1 (still overridden by player/Admin prefs), and header max-h-[150px]', () => {
    expect(BUILTIN_STATUS_DISPLAY_DEFAULTS.playerDesktopRows).toBe(1);
    expect(
      resolveEffectiveStatusDisplaySettings({ playerDesktopRows: 2 }, null)
        .playerDesktopRows
    ).toBe(2);
    expect(
      resolveEffectiveStatusDisplaySettings(
        { playerDesktopRows: 1 },
        { playerDesktopRows: 2 }
      ).playerDesktopRows
    ).toBe(2);

    setViewport(1440, 900);
    const battle = makeBattle();
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'radar' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const header = container!.querySelector(
      '[data-testid="battle-main-header"]'
    ) as HTMLElement;
    const controls = container!.querySelector(
      '[data-testid="battle-desktop-controls"]'
    ) as HTMLElement;
    const forceBar = container!.querySelector(
      '[data-testid="battle-force-ratio-bar"]'
    ) as HTMLElement;
    const playerBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    const mainField = container!.querySelector(
      '[data-testid="battle-main-field"]'
    ) as HTMLElement;
    const radarBox = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    ) as HTMLElement;

    expect(header).not.toBeNull();
    expect(header.className).toContain('max-h-[150px]');
    expect(controls.className).toContain('max-h-[48px]');
    expect(forceBar.className).toContain('max-h-[22px]');
    expect(playerBar.className).toContain('max-h-[72px]');
    expect(playerBar.className).not.toContain('overflow-hidden');
    // Side-by-side thin HP / SHD / SP bars
    expect(playerBar.querySelector('[data-testid="battle-player-hp-shield-bar"]')).not.toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-shield-bar"]')).not.toBeNull();
    expect(playerBar.querySelector('[data-testid="battle-player-sp-bar"]')).not.toBeNull();
    // Status strip defaults to 1 row
    const statusArea = playerBar.querySelector(
      '[data-testid="battle-player-status-effects"]'
    ) as HTMLElement;
    expect(statusArea).not.toBeNull();
    expect(statusArea.getAttribute('data-status-area-rows')).toBe('1');

    // Main field fills remaining height with min-h-[420px] and full-width radar aspect-[12/7]
    expect(mainField.className).toContain('min-h-[420px]');
    expect(mainField.className).toContain('flex-1');
    expect(radarBox.className).toContain('min-h-[420px]');
    expect(radarBox.className).toContain('w-full');
    expect(radarBox.className).toContain('aspect-[12/7]');
  });

  it('4) Enforces horizontal overflow guards, min-w-0, and >= 8px left inset (px-2.5) at 1246 and 1440 in both card and radar mode', () => {
    const battle = makeBattle();

    for (const width of [1246, 1440]) {
      for (const viewMode of ['radar', 'card'] as const) {
        setViewport(width, 900);
        useGameStore.setState({
          screen: 'BATTLE',
          battle,
          battleViewMode: viewMode,
        });
        act(() => {
          root!.render(createElement(BattleScreen));
        });

        const desktopLayout = container!.querySelector(
          '[data-testid="battle-desktop-layout"]'
        ) as HTMLElement;
        const mainCol = container!.querySelector(
          '[data-testid="battle-main-column"]'
        ) as HTMLElement;
        const controls = container!.querySelector(
          '[data-testid="battle-desktop-controls"]'
        ) as HTMLElement;

        expect(desktopLayout.className).toContain('px-2.5');
        expect(desktopLayout.className).toContain('overflow-x-hidden');
        expect(mainCol.className).toContain('min-w-0');
        expect(mainCol.className).toContain('overflow-x-hidden');
        expect(controls.className).toContain('overflow-x-hidden');

        if (viewMode === 'card') {
          const cardView = container!.querySelector(
            '[data-testid="battle-card-view"]'
          ) as HTMLElement;
          expect(cardView.className).toContain('min-w-0');
          expect(cardView.className).toContain('w-full');
          const rowBoxes = Array.from(
            cardView.querySelectorAll('[data-card-row]')
          ) as HTMLElement[];
          expect(rowBoxes.length).toBeGreaterThan(0);
          for (const box of rowBoxes) {
            expect(box.className).toContain('min-w-0');
            expect(box.className).toContain('overflow-hidden');
          }
        }
      }
    }
  });

  it('5) SP uses the single orange token #EF9F27 across player block, unit cards, selected-unit panel, UnitDetailSheet, and combat log — no purple SP styling', () => {
    expect(SP_COLOR_HEX).toBe('#EF9F27');
    expect(SP_COLOR_TOKENS.hex).toBe('#EF9F27');
    expect(SP_COLOR_TOKENS.barFillClass).toContain('#EF9F27');
    expect(SP_COLOR_TOKENS.textClass).toContain('#EF9F27');

    // Desktop BattleScreen: player block + selected-unit panel + card mode unit cards
    setViewport(1440, 900);
    const battle = makeBattle();
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      battleViewMode: 'card',
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const playerSpFill = container!.querySelector(
      '[data-testid="battle-player-sp-fill"]'
    ) as HTMLElement;
    const playerSpNumbers = container!.querySelector(
      '[data-testid="battle-player-sp-numbers"]'
    ) as HTMLElement;
    expect(playerSpFill.className).toContain(SP_COLOR_TOKENS.barFillClass);
    expect(playerSpFill.className).not.toContain('purple');
    expect(playerSpNumbers.className).toContain(SP_COLOR_TOKENS.textClass);
    expect(playerSpNumbers.className).not.toContain('purple');

    // Unit card SP bar & value
    const cardSpFill = container!.querySelector(
      '[data-testid="unit-row-sp-fill-u_player"]'
    ) as HTMLElement;
    const cardSpVal = container!.querySelector(
      '[data-testid="unit-row-sp-value-u_player"]'
    ) as HTMLElement;
    expect(cardSpFill.className).toContain(SP_COLOR_TOKENS.barFillClass);
    expect(cardSpFill.className).not.toContain('purple');
    expect(cardSpVal.className).toContain(SP_COLOR_TOKENS.textClass);
    expect(cardSpVal.className).not.toContain('purple');

    // Sidebar selected-unit panel SP StatBar
    const sidebarPanel = container!.querySelector(
      '[data-testid="battle-selected-unit-panel"]'
    ) as HTMLElement;
    expect(sidebarPanel.innerHTML).toContain(SP_COLOR_TOKENS.barFillClass);
    expect(sidebarPanel.innerHTML).toContain(SP_COLOR_TOKENS.textClass);
    expect(sidebarPanel.innerHTML).not.toContain('bg-purple');
    expect(sidebarPanel.innerHTML).not.toContain('text-purple');

    // Standalone BattleUnitCard
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: battle.units[0],
          isActiveTurn: false,
          isTargeted: false,
          canTarget: true,
          exploding: false,
          skipAnimations: true,
          compact: false,
          popups: [],
          showStatusLabels: false,
          onSelect: () => {},
          onInspect: () => {},
        })
      );
    });
    expect(container!.innerHTML).toContain(SP_COLOR_TOKENS.barFillClass);
    expect(container!.innerHTML).not.toContain('bg-purple');
    expect(container!.innerHTML).not.toContain('text-purple');

    // UnitDetailSheet
    act(() => {
      root!.render(
        createElement(UnitDetailSheet, {
          unit: battle.units[0],
          onClose: () => {},
          isTargeted: false,
          canLockEnemy: false,
          canLockAlly: false,
        })
      );
    });
    expect(container!.innerHTML).toContain(SP_COLOR_TOKENS.barFillClass);
    expect(container!.innerHTML).not.toContain('bg-purple');
    expect(container!.innerHTML).not.toContain('text-purple');

    // CombatLogList SP cost tag
    const spLogEntry: CombatLogEntry = {
      id: 'log_sp_1',
      round: 1,
      actorName: 'Kaelen Vance',
      actorSide: 'ally',
      actorIsPlayer: true,
      tag: 'SKILL',
      templateKey: 'log.damage',
      params: {
        actor: 'Kaelen Vance',
        target: 'Vanguard Striker',
        skillId: 'pulse_overdrive',
        damage: 140,
        hpDamage: 140,
        shieldDamage: 0,
        spCost: 20,
      },
    };
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: [spLogEntry],
          units: battle.units,
          active: true,
          expandAll: true,
        })
      );
    });
    const spCostChip = container!.querySelector(
      '[data-testid="combat-log-sp-cost"]'
    ) as HTMLElement;
    expect(spCostChip).not.toBeNull();
    expect(spCostChip.className).toContain('#EF9F27');
    expect(spCostChip.className).not.toContain('purple');
  });

  it('6) vi.ts and en.ts have identical key sets, battle.actionCamera is removed, and CURRENT_SAVE_VERSION stays 9', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
    expect('battle.actionCamera' in VI_TRANSLATIONS).toBe(false);
    expect('battle.actionCamera' in EN_TRANSLATIONS).toBe(false);
    for (const k of viKeys) {
      expect(
        (VI_TRANSLATIONS as Record<string, string>)[k].trim().length
      ).toBeGreaterThan(0);
      expect(
        (EN_TRANSLATIONS as Record<string, string>)[k].trim().length
      ).toBeGreaterThan(0);
    }
    expect(CURRENT_SAVE_VERSION).toBe(11);
  });
});
