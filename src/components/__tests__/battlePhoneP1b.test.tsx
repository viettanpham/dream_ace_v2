// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { CURRENT_SAVE_VERSION } from '../../engine/migration';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit } from '../../types/game';
import {
  computePhoneControlRowBudgetPx,
  PHONE_CONTROL_ROW_LAYOUT,
  PHONE_RADAR_LOG_GAP_PX,
} from '../../utils/battleDisplay';
import { BattleScreen } from '../BattleScreen';

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

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const maxHp = overrides.derived?.maxHp ?? 800;
  const maxShield = overrides.derived?.maxShield ?? 200;
  const maxSp = overrides.derived?.maxSp ?? 80;
  const alive = overrides.alive ?? true;
  return {
    id,
    name,
    callsign: name,
    side,
    row: overrides.row ?? 'front',
    formationCol: overrides.formationCol ?? 0,
    isPlayer: overrides.isPlayer ?? false,
    isBoss: overrides.isBoss ?? false,
    classId: overrides.classId ?? 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield,
      maxSp,
      speed: overrides.derived?.speed ?? 80,
      attackPower: 140,
      defenseRating: 60,
      dodgeChance: 10,
      critChance: 15,
      skillPower: 25,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 5,
      passiveSkillDmgPct: 0,
      ...overrides.derived,
    },
    hp: alive ? overrides.hp ?? maxHp : 0,
    shield: alive ? overrides.shield ?? maxShield : 0,
    sp: overrides.sp ?? 45,
    isDefending: false,
    alive,
    statuses: overrides.statuses ?? [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(overrides: Partial<BattleState> = {}): BattleState {
  const units = overrides.units ?? [
    makeUnit('u_player', 'Kaelen Vance', 'ally', {
      isPlayer: true,
      row: 'front',
      statuses: [{ type: 'atk_up', turnsRemaining: 2, magnitude: 0.2 }],
    }),
    makeUnit('u_ally_back', 'Echo Support', 'ally', { row: 'back' }),
    makeUnit('u_enemy_front', 'Raider Alpha', 'enemy', { row: 'front' }),
    makeUnit('u_enemy_back', 'Void Sniper', 'enemy', { row: 'back' }),
  ];

  return {
    sectorId: 'aegis_relay',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 2,
    turnCounter: 3,
    units,
    turnOrder: units.filter((u) => u.alive).map((u) => u.id),
    activeTurnIndex: 0,
    selectedTargetId: 'u_enemy_front',
    selectedAllyTargetId: 'u_player',
    lastPlayerTargetId: 'u_enemy_front',
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

function parseMaxZIndex(className: string): number {
  const matches = className.match(/\bz-(\d+)\b/g) ?? [];
  return matches.reduce(
    (max, token) => Math.max(max, Number(token.slice(2))),
    0
  );
}

describe('TASK P1b — Phone battle control row, destroyed-player line, legend button & 24px radar-log gap', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState({
      screen: 'BATTLE',
      battle: makeBattle(),
      autoBattleEnabled: false,
      autoRepeatLimit: 10,
      autoRepeatSession: null,
      battleSpeed: 1,
      battleViewMode: 'radar',
    });
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
      container = null;
    }
    window.localStorage.clear();
  });

  it('1) Phone control row buttons carry h-10 & min-w-[44px], Tự động has no w-full/flex-1 and is green only when ON, Radar/Thẻ is icon-only, and loop chip fits 360px/390px budget', () => {
    const budget = computePhoneControlRowBudgetPx();
    expect(PHONE_CONTROL_ROW_LAYOUT.minViewportWidthPx).toBe(360);
    expect(PHONE_CONTROL_ROW_LAYOUT.buttonHeightPx).toBe(40);
    expect(PHONE_CONTROL_ROW_LAYOUT.buttonMinWidthPx).toBe(44);
    expect(PHONE_CONTROL_ROW_LAYOUT.autoMaxWidthPx).toBe(88);
    expect(PHONE_CONTROL_ROW_LAYOUT.loopChipMaxWidthPx).toBe(76);
    expect(budget.totalRowWidthPx).toBe(324);
    expect(budget.totalRowWidthPx).toBeLessThanOrEqual(360);
    expect(budget.remainingAt360Px).toBeGreaterThanOrEqual(0);

    for (const vw of [360, 390]) {
      setViewport(vw, 800);
      useGameStore.setState({
        autoBattleEnabled: false,
        battleViewMode: 'radar',
        autoRepeatSession: {
          active: true,
          sectorId: 'aegis_relay',
          limit: 10,
          completedRuns: 2,
          wins: 2,
          totalExp: 0,
          totalCredits: 0,
          totalWarPoints: 0,
          totalDrops: [],
          stopReason: null,
        },
      });

      act(() => {
        root!.render(createElement(BattleScreen));
      });

      const controls = container!.querySelector(
        '[data-testid="battle-phone-controls"]'
      ) as HTMLElement;
      expect(controls).not.toBeNull();
      expect(controls.className).toContain('flex-nowrap');
      expect(controls.className).toContain('overflow-x-hidden');
      expect(controls.className).not.toContain('flex-wrap');

      const autoBtn = controls.querySelector(
        '[data-testid="battle-auto-toggle"]'
      ) as HTMLButtonElement;
      const speedBtn = controls.querySelector(
        '[data-testid="battle-speed-cycle"]'
      ) as HTMLButtonElement;
      const viewBtn = controls.querySelector(
        '[data-testid="battle-view-switch"]'
      ) as HTMLButtonElement;
      const loopChip = controls.querySelector(
        '[data-testid="battle-loop-active-chip"]'
      ) as HTMLButtonElement;
      const moreBtn = controls.querySelector(
        '[data-testid="battle-more-btn"]'
      ) as HTMLButtonElement;

      // Exact left-to-right order
      const buttons = [autoBtn, speedBtn, viewBtn, loopChip, moreBtn];
      for (const btn of buttons) {
        expect(btn).not.toBeNull();
        expect(btn.className.split(/\s+/)).toContain('h-10');
        expect(btn.className).toContain('min-w-[44px]');
      }
      for (let i = 0; i < buttons.length - 1; i++) {
        expect(
          Boolean(
            buttons[i].compareDocumentPosition(buttons[i + 1]) &
              Node.DOCUMENT_POSITION_FOLLOWING
          )
        ).toBe(true);
      }

      // Tự động: content-width (max-w-[88px]), no w-full / flex-1, green ONLY while ON
      const autoCls = autoBtn.className.split(/\s+/);
      expect(autoCls).not.toContain('w-full');
      expect(autoCls).not.toContain('flex-1');
      expect(autoCls).toContain('max-w-[88px]');
      expect(autoBtn.className).not.toContain('emerald');
      expect(autoBtn.className).not.toContain('green');

      act(() => {
        autoBtn.click();
      });
      expect(useGameStore.getState().autoBattleEnabled).toBe(true);
      expect(autoBtn.className).toContain('bg-emerald-500');

      // Radar/Thẻ: icon-only with aria-label & title from vi.ts / en.ts
      expect(viewBtn.textContent?.trim()).toBe('');
      expect(viewBtn.getAttribute('aria-label')).toBe(
        VI_TRANSLATIONS['battle.switchToCard']
      );
      expect(viewBtn.getAttribute('title')).toBe(
        VI_TRANSLATIONS['battle.switchToCard']
      );

      act(() => {
        viewBtn.click();
      });
      expect(viewBtn.textContent?.trim()).toBe('');
      expect(viewBtn.getAttribute('aria-label')).toBe(
        VI_TRANSLATIONS['battle.switchToRadar']
      );

      // Running loop chip fits ~76px cap
      expect(loopChip.className).toContain('max-w-[76px]');
      expect(
        loopChip.querySelector('[data-testid="battle-loop-progress"]')
          ?.textContent
      ).toBe('3/10');
      expect(
        loopChip.querySelector('[data-testid="battle-loop-stop"]')
      ).not.toBeNull();
    }

    // Also verify idle Lặp button carries h-10 & min-w-[44px] and EN tooltips work
    act(() => {
      useGameStore.getState().setLanguage('en');
      useGameStore.setState({ autoRepeatSession: null, battleViewMode: 'radar' });
    });
    const idleLoopBtn = container!.querySelector(
      '[data-testid="battle-phone-controls"] [data-testid="battle-loop-btn"]'
    ) as HTMLButtonElement;
    expect(idleLoopBtn).not.toBeNull();
    expect(idleLoopBtn.className.split(/\s+/)).toContain('h-10');
    expect(idleLoopBtn.className).toContain('min-w-[44px]');
    const viewBtnEn = container!.querySelector(
      '[data-testid="battle-view-switch"]'
    ) as HTMLButtonElement;
    expect(viewBtnEn.getAttribute('aria-label')).toBe(
      EN_TRANSLATIONS['battle.switchToCard']
    );
  });

  it('2) Destroyed player on phone renders ONE 28px slim line with [TA], struck-through name, "Đã phát nổ", and NO status area or bars; alive state unchanged', () => {
    setViewport(360, 800);

    // Alive state first: keeps HP/SHD/SP bars & FixedStatusArea
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    const aliveBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(aliveBar.getAttribute('data-destroyed')).toBe('false');
    expect(
      aliveBar.querySelector('[data-testid="battle-player-hp-shield-bar"]')
    ).not.toBeNull();
    expect(
      aliveBar.querySelector('[data-testid="battle-player-status-effects"]')
    ).not.toBeNull();

    // Destroyed player on phone -> 28px slim line, no reserved status rows, no bars
    const deadPlayer = makeUnit('u_player', 'Kaelen Vance', 'ally', {
      isPlayer: true,
      alive: false,
      hp: 0,
      shield: 0,
      sp: 0,
      statuses: [{ type: 'burn', turnsRemaining: 2, magnitude: 40 }],
    });
    act(() => {
      useGameStore.setState({
        battle: makeBattle({
          units: [
            deadPlayer,
            makeUnit('u_ally_back', 'Echo Support', 'ally', { row: 'back' }),
            makeUnit('u_enemy_front', 'Raider Alpha', 'enemy', { row: 'front' }),
          ],
        }),
      });
    });

    const deadBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(deadBar).not.toBeNull();
    expect(deadBar.getAttribute('data-collapsed')).toBe('true');
    expect(deadBar.getAttribute('data-destroyed')).toBe('true');
    expect(deadBar.className).toContain('h-[28px]');
    expect(deadBar.className).toContain('max-h-[28px]');
    expect(deadBar.textContent).toContain('[TA]');
    expect(deadBar.textContent).toContain('Kaelen Vance');
    expect(deadBar.innerHTML).toContain('line-through');
    expect(
      deadBar.querySelector('[data-testid="battle-player-destroyed-badge"]')
        ?.textContent
    ).toBe('Đã phát nổ');

    expect(
      deadBar.querySelector('[data-testid="battle-player-status-effects"]')
    ).toBeNull();
    expect(
      deadBar.querySelector('[data-testid="battle-player-hp-shield-bar"]')
    ).toBeNull();
    expect(
      deadBar.querySelector('[data-testid="battle-player-sp-bar"]')
    ).toBeNull();
    expect(
      deadBar.querySelector('[data-testid="battle-player-hp-numbers"]')
    ).toBeNull();
  });

  it('3) Legend button on phone is icon-only 32px inside top-right radar box with z-index lower than sticky control row, and opens legend', () => {
    setViewport(390, 844);
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const controls = container!.querySelector(
      '[data-testid="battle-phone-controls"]'
    ) as HTMLElement;
    const radarBox = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    ) as HTMLElement;
    const legendWrapper = radarBox.querySelector(
      '[data-testid="radar-legend-wrapper"]'
    ) as HTMLElement;
    const legendBtn = radarBox.querySelector(
      '[data-testid="radar-legend-toggle"]'
    ) as HTMLButtonElement;

    expect(radarBox).not.toBeNull();
    expect(legendWrapper).not.toBeNull();
    expect(legendBtn).not.toBeNull();
    expect(radarBox.contains(legendBtn)).toBe(true);
    expect(legendWrapper.className).toContain('top-1.5');
    expect(legendWrapper.className).toContain('right-1.5');

    // Z-index strictly lower than sticky control row
    const controlZ = parseMaxZIndex(controls.className);
    const wrapperZ = parseMaxZIndex(legendWrapper.className);
    const btnZ = parseMaxZIndex(legendBtn.className);
    expect(controlZ).toBe(30);
    expect(wrapperZ).toBeGreaterThan(0);
    expect(wrapperZ).toBeLessThan(controlZ);
    expect(btnZ).toBeGreaterThan(0);
    expect(btnZ).toBeLessThan(controlZ);

    // 32px icon-only button on phone
    expect(legendBtn.className.split(/\s+/)).toContain('h-8');
    expect(legendBtn.className.split(/\s+/)).toContain('w-8');
    expect(legendBtn.className).toContain('min-h-[32px]');
    expect(legendBtn.className).toContain('min-w-[32px]');
    expect(legendBtn.textContent?.trim()).toBe('');
    expect(legendBtn.getAttribute('aria-label')).toBe(
      VI_TRANSLATIONS['radar.legendToggle']
    );

    // Opens the same legend panel on click
    expect(
      radarBox.querySelector('[data-testid="radar-legend-panel"]')
    ).toBeNull();
    act(() => {
      legendBtn.click();
    });
    expect(
      radarBox.querySelector('[data-testid="radar-legend-panel"]')
    ).not.toBeNull();
  });

  it('4) 24px gap element exists on phone only between radar bottom and combat log header, with zero clipping', () => {
    expect(PHONE_RADAR_LOG_GAP_PX).toBe(24);

    setViewport(360, 800);
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const radarBox = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    ) as HTMLElement;
    const gapEl = container!.querySelector(
      '[data-testid="battle-phone-radar-log-gap"]'
    ) as HTMLElement;
    const phoneLog = container!.querySelector(
      '[data-testid="battle-phone-docked-log"]'
    ) as HTMLElement;

    expect(gapEl).not.toBeNull();
    expect(gapEl.style.height).toBe('24px');
    expect(
      Boolean(
        radarBox.compareDocumentPosition(gapEl) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        gapEl.compareDocumentPosition(phoneLog) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    // Zero clipping on radar box or its wrapper
    expect(radarBox.className).not.toContain('overflow-hidden');
    expect(radarBox.parentElement?.className ?? '').not.toContain(
      'overflow-hidden'
    );
    expect(radarBox.parentElement?.className ?? '').not.toContain('p-2');
    expect(radarBox.parentElement?.className ?? '').not.toContain('pb-');

    // Absent on tablet (768px) and desktop (1280px)
    for (const width of [768, 1280]) {
      act(() => {
        setViewport(width, 900);
      });
      expect(
        container!.querySelector('[data-testid="battle-phone-radar-log-gap"]')
      ).toBeNull();
      expect(
        container!.querySelector('[data-testid="battle-desktop-layout"]')
      ).not.toBeNull();
    }
  });

  it('5) Desktop/tablet markup (> 640px) stays unchanged and vi.ts / en.ts have full key parity with CURRENT_SAVE_VERSION = 9', () => {
    setViewport(1280, 900);
    useGameStore.setState({
      autoRepeatSession: {
        active: true,
        sectorId: 'aegis_relay',
        limit: 5,
        completedRuns: 1,
        wins: 1,
        totalExp: 0,
        totalCredits: 0,
        totalWarPoints: 0,
        totalDrops: [],
        stopReason: null,
      },
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(
      container!.querySelector('[data-testid="battle-phone-controls"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-phone-radar-log-gap"]')
    ).toBeNull();

    const desktopControls = container!.querySelector(
      '[data-testid="battle-desktop-controls"]'
    ) as HTMLElement;
    expect(desktopControls).not.toBeNull();
    const desktopLoopChip = desktopControls.querySelector(
      '[data-testid="battle-loop-active-chip"]'
    ) as HTMLElement;
    expect(desktopLoopChip.className).toContain('h-[34px]');

    const desktopLegendBtn = container!.querySelector(
      '[data-testid="radar-legend-toggle"]'
    ) as HTMLButtonElement;
    expect(desktopLegendBtn.className).toContain('min-h-[44px]');
    expect(desktopLegendBtn.textContent).toContain(
      VI_TRANSLATIONS['radar.legendToggle']
    );
    expect(
      container!.querySelector('[data-testid="radar-legend-wrapper"]')
        ?.className
    ).toContain('z-30');

    // vi.ts / en.ts parity & save version
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
    expect(VI_TRANSLATIONS['battle.switchToCard']).toBeTruthy();
    expect(EN_TRANSLATIONS['battle.switchToCard']).toBeTruthy();
    expect(VI_TRANSLATIONS['battle.switchToRadar']).toBeTruthy();
    expect(EN_TRANSLATIONS['battle.switchToRadar']).toBeTruthy();
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(12);
  });
});
