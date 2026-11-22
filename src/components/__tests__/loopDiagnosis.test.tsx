// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCloudStore } from '../../engine/cloudStore';
import {
  AUTO_REPEAT_MAX_DEFEAT_STREAK,
  shouldStopAutoRepeat,
} from '../../engine/tactics';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import {
  attachCloudAutosaveListeners,
  setCloudStoreAdapterForTests,
  useCloudSaveStore,
} from '../../store/useCloudSaveStore';
import { useGameStore } from '../../store/useGameStore';
import type { AutoRepeatLimit, AutoRepeatSession } from '../../types/game';
import { BattleScreen } from '../BattleScreen';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

function forceDeterministicDefeatViaAiTurn(): void {
  const curBattle = useGameStore.getState().battle;
  if (!curBattle || curBattle.summary) {
    throw new Error('Expected active battle before forcing defeat');
  }
  const enemy = curBattle.units.find((u) => u.side === 'enemy' && u.alive);
  const firstAlly = curBattle.units.find((u) => u.side === 'ally' && u.alive);
  if (!enemy || !firstAlly) {
    throw new Error('Expected at least one alive enemy and ally');
  }

  const riggedUnits = curBattle.units.map((u) => {
    if (u.side === 'ally') {
      if (u.id === firstAlly.id) {
        return {
          ...u,
          hp: 1,
          shield: 0,
          alive: true,
          statuses: [],
          derived: { ...u.derived, maxHp: 100, dodgeChance: 0 },
        };
      }
      return {
        ...u,
        hp: 0,
        shield: 0,
        alive: false,
        animState: 'destroyed' as const,
      };
    }
    if (u.id === enemy.id) {
      return {
        ...u,
        statuses: [],
        derived: { ...u.derived, attack: 9999 },
      };
    }
    return u;
  });

  useGameStore.setState({
    battle: {
      ...curBattle,
      units: riggedUnits,
      turnOrder: [enemy.id, firstAlly.id],
      activeTurnIndex: 0,
    },
  });

  useGameStore.getState().performAiTurn();
  expect(useGameStore.getState().battle?.summary?.outcome).toBe('defeat');
}

describe('TASK LP1 — Loop (Lặp) Unclip, Honest State, Defeat Streak & Counter', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useCloudSaveStore.getState().resetCloudStoreForTests();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().setLanguage('vi');
    setViewport(1280, 800);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    setCloudStoreAdapterForTests(undefined);
    useCloudSaveStore.getState().resetCloudStoreForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('auto-starts battles 2 and 3 without clicking when loop is active for 3 runs with forced victory', () => {
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    act(() => {
      useGameStore
        .getState()
        .startAutoRepeat(3 as unknown as AutoRepeatLimit, 'debris_belt');
    });

    const battle1 = useGameStore.getState().battle;
    expect(battle1).not.toBeNull();
    expect(battle1?.summary).toBeNull();
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.limit).toBe(3);

    act(() => {
      useGameStore.getState().forceWinBattle();
    });

    expect(useGameStore.getState().battle?.summary?.outcome).toBe('victory');
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(1);
    expect(container.querySelector('#battle-outcome-title')).toBeNull();
    expect(container.querySelector('[data-testid="battle-loop-toast"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const battle2 = useGameStore.getState().battle;
    expect(battle2).not.toBeNull();
    expect(battle2).not.toBe(battle1);
    expect(battle2?.summary).toBeNull();
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(1);

    act(() => {
      useGameStore.getState().forceWinBattle();
    });

    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const battle3 = useGameStore.getState().battle;
    expect(battle3).not.toBeNull();
    expect(battle3).not.toBe(battle2);
    expect(battle3?.summary).toBeNull();

    act(() => {
      useGameStore.getState().forceWinBattle();
    });

    const finalSession = useGameStore.getState().autoRepeatSession;
    expect(finalSession?.active).toBe(false);
    expect(finalSession?.completedRuns).toBe(3);
    expect(finalSession?.wins).toBe(3);
    expect(finalSession?.stopReason).toBe('completed');
    expect(container.querySelector('#battle-outcome-title')).toBeNull();
    expect(container.querySelector('#repeat-summary-title')?.textContent).toContain(
      'Tổng kết Lặp tự động'
    );
  });

  it('does not get blocked by SV1b cloud autosave / deferred upload listeners across the 3-battle loop', async () => {
    const adapter = new InMemoryCloudStore();
    setCloudStoreAdapterForTests(adapter);
    const detachCloud = attachCloudAutosaveListeners();

    try {
      await act(async () => {
        await useCloudSaveStore.getState().createCloudSave('1234', false);
      });

      useGameStore.getState().startBattle('debris_belt');

      act(() => {
        root.render(createElement(BattleScreen));
      });

      act(() => {
        useCloudSaveStore.setState({ deferredUploadPending: true });
        useGameStore
          .getState()
          .startAutoRepeat(3 as unknown as AutoRepeatLimit, 'debris_belt');
      });

      act(() => {
        useGameStore.getState().forceWinBattle();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(useGameStore.getState().battle?.summary).toBeNull();
      expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(1);

      act(() => {
        useGameStore.getState().forceWinBattle();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(useGameStore.getState().battle?.summary).toBeNull();
      expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(2);

      act(() => {
        useGameStore.getState().forceWinBattle();
      });
      expect(useGameStore.getState().autoRepeatSession?.active).toBe(false);
      expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(3);
    } finally {
      detachCloud();
    }
  });

  it('portals desktop "Lặp" popover into document.body with fixed viewport-clamped position outside overflow-hidden/max-h ancestors', () => {
    setViewport(1280, 800);
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    const loopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="battle-loop-btn"]'
    )!;
    expect(loopBtn).not.toBeNull();

    // Anchor wrapper keeps G4a-L1 overflow protection in the desktop control bar
    const anchorWrapper = loopBtn.parentElement!;
    vi.spyOn(anchorWrapper, 'getBoundingClientRect').mockReturnValue({
      top: 12,
      bottom: 46,
      left: 1180,
      right: 1278,
      width: 98,
      height: 34,
      x: 1180,
      y: 12,
      toJSON: () => ({}),
    });

    act(() => {
      loopBtn.click();
    });

    // Popover must NOT live inside `container`, must live directly in document.body
    expect(container.querySelector('[data-testid="battle-loop-popover"]')).toBeNull();
    const popover = document.body.querySelector<HTMLElement>(
      '[data-testid="battle-loop-popover"]'
    );
    expect(popover).not.toBeNull();
    expect(popover!.parentElement).toBe(document.body);

    // No ancestor with overflow-hidden, overflow-x-hidden, or max-h-*
    let el: HTMLElement | null = popover!.parentElement;
    const clippingAncestors: string[] = [];
    while (el) {
      if (
        el.className.includes('overflow-hidden') ||
        el.className.includes('overflow-x-hidden') ||
        /\bmax-h-/.test(el.className)
      ) {
        clippingAncestors.push(el.className);
      }
      el = el.parentElement;
    }
    expect(clippingAncestors).toEqual([]);

    // Fixed positioning, width, z-index, and right-edge viewport clamping (right <= 1280 - 8)
    expect(popover!.style.position).toBe('fixed');
    expect(popover!.style.width).toBe('min(252px, 92vw)');
    expect(Number(popover!.style.zIndex)).toBeGreaterThanOrEqual(70);
    const leftPx = Number.parseFloat(popover!.style.left);
    const topPx = Number.parseFloat(popover!.style.top);
    expect(topPx).toBeGreaterThanOrEqual(50); // opens below button (46 + 6 = 52)
    expect(leftPx).toBeGreaterThanOrEqual(8);
    expect(leftPx + 252).toBeLessThanOrEqual(1280 - 8);

    // Window resize recomputes position cleanly inside smaller desktop viewport
    act(() => {
      setViewport(720, 720);
    });
    const resizedPopover = document.body.querySelector<HTMLElement>(
      '[data-testid="battle-loop-popover"]'
    )!;
    const resizedLeft = Number.parseFloat(resizedPopover.style.left);
    expect(resizedLeft).toBeGreaterThanOrEqual(8);
    expect(resizedLeft + 252).toBeLessThanOrEqual(720 - 8);

    // Scroll recomputes position
    vi.spyOn(anchorWrapper, 'getBoundingClientRect').mockReturnValue({
      top: 40,
      bottom: 74,
      left: 300,
      right: 380,
      width: 80,
      height: 34,
      x: 300,
      y: 40,
      toJSON: () => ({}),
    });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(Number.parseFloat(popover!.style.top)).toBe(80);

    // Closes on Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.querySelector('[data-testid="battle-loop-popover"]')).toBeNull();

    // Re-open -> closes on outside mousedown
    act(() => {
      loopBtn.click();
    });
    expect(document.body.querySelector('[data-testid="battle-loop-popover"]')).not.toBeNull();
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(document.body.querySelector('[data-testid="battle-loop-popover"]')).toBeNull();

    // Re-open -> closes when battle ends
    act(() => {
      loopBtn.click();
    });
    expect(document.body.querySelector('[data-testid="battle-loop-popover"]')).not.toBeNull();
    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    expect(document.body.querySelector('[data-testid="battle-loop-popover"]')).toBeNull();
  });

  it('uses honest non-emerald button state while popover is open on desktop and launches battles 2 and 3 via Lặp -> Bắt đầu', () => {
    setViewport(1280, 800);
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    const loopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="battle-loop-btn"]'
    )!;
    expect(loopBtn.className).not.toContain('emerald');

    act(() => {
      loopBtn.click();
    });

    // While popover is open & loop NOT running: neutral sky/slate highlight, NO emerald, NO running dot
    expect(loopBtn.getAttribute('data-loop-running')).toBe('false');
    expect(loopBtn.className).not.toContain('emerald');
    expect(loopBtn.className).toContain('sky');
    expect(loopBtn.innerHTML).not.toContain('emerald');
    expect(container.querySelector('[data-testid="battle-loop-running-dot"]')).toBeNull();

    // Primary "Bắt đầu" CTA is full-width emerald at bottom of popover
    const popover = document.body.querySelector<HTMLElement>(
      '[data-testid="battle-loop-popover"]'
    )!;
    const startBtn = popover.querySelector<HTMLButtonElement>(
      '[data-testid="battle-loop-start"]'
    )!;
    expect(startBtn.className).toContain('bg-emerald-500');
    expect(startBtn.className).toContain('w-full');

    // Click 5x and Bắt đầu directly from desktop popover
    act(() => {
      popover
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-opt-5"]')!
        .click();
    });
    act(() => {
      startBtn.click();
    });

    // Now active chip has emerald + running dot + 1/5 counter
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    const activeChip = container.querySelector<HTMLButtonElement>(
      '[data-testid="battle-loop-active-chip"]'
    )!;
    expect(activeChip).not.toBeNull();
    expect(activeChip.className).toContain('emerald');
    expect(
      activeChip.querySelector('[data-testid="battle-loop-running-dot"]')
    ).not.toBeNull();
    expect(
      activeChip.querySelector('[data-testid="battle-loop-progress"]')?.textContent
    ).toBe('1/5');

    // Battles 2 and 3 auto-launch without any click
    const b1 = useGameStore.getState().battle;
    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const b2 = useGameStore.getState().battle;
    expect(b2).not.toBe(b1);
    expect(b2?.summary).toBeNull();
    expect(
      container.querySelector('[data-testid="battle-loop-progress"]')?.textContent
    ).toBe('2/5');

    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const b3 = useGameStore.getState().battle;
    expect(b3).not.toBe(b2);
    expect(b3?.summary).toBeNull();
    expect(
      container.querySelector('[data-testid="battle-loop-progress"]')?.textContent
    ).toBe('3/5');
  });

  it('displays N/M and N/∞ counters accurately on the running chip', () => {
    setViewport(1280, 800);
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-btn"]')!
        .click();
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-opt-infinite"]')!
        .click();
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-start"]')!
        .click();
    });

    expect(
      container.querySelector('[data-testid="battle-loop-progress"]')?.textContent
    ).toBe('1/∞');

    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      container.querySelector('[data-testid="battle-loop-progress"]')?.textContent
    ).toBe('2/∞');

    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      container.querySelector('[data-testid="battle-loop-progress"]')?.textContent
    ).toBe('3/∞');
  });

  it('stops after N consecutive defeats when "Dừng sau N trận thua liên tiếp" is selected, and resets the streak on a victory', () => {
    expect(AUTO_REPEAT_MAX_DEFEAT_STREAK).toBe(3);

    // Pure shouldStopAutoRepeat check
    const baseSession: AutoRepeatSession = {
      active: true,
      limit: 'infinite',
      sectorId: 'debris_belt',
      completedRuns: 2,
      wins: 0,
      consecutiveDefeats: 2,
      totalExp: 0,
      totalCredits: 0,
      totalWarPoints: 0,
      totalDrops: [],
      stopReason: null,
    };
    expect(
      shouldStopAutoRepeat(baseSession, 'defeat', false, 10, 60, 'stop_after_n', 3)
    ).toEqual({ stop: false, reason: null });
    expect(
      shouldStopAutoRepeat(
        { ...baseSession, completedRuns: 3, consecutiveDefeats: 3 },
        'defeat',
        false,
        10,
        60,
        'stop_after_n',
        3
      )
    ).toEqual({ stop: true, reason: 'defeat_streak' });
    expect(
      shouldStopAutoRepeat(
        { ...baseSession, completedRuns: 3, consecutiveDefeats: 3 },
        'defeat',
        false,
        10,
        60,
        'never_stop',
        3
      )
    ).toEqual({ stop: false, reason: null });
    expect(
      shouldStopAutoRepeat(
        { ...baseSession, completedRuns: 3, consecutiveDefeats: 3 },
        'victory',
        false,
        10,
        60,
        'stop_after_n',
        3
      )
    ).toEqual({ stop: false, reason: null });

    // End-to-end store + UI flow with 3 radio options + N input
    setViewport(1280, 800);
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-btn"]')!
        .click();
    });

    const stopImmediatelyRadio =
      document.body.querySelector<HTMLInputElement>(
        '[data-testid="battle-loop-rule-stop-immediately"]'
      )!;
    const stopAfterNRadio = document.body.querySelector<HTMLInputElement>(
      '[data-testid="battle-loop-rule-stop-after-n"]'
    )!;
    const streakInput = document.body.querySelector<HTMLInputElement>(
      '[data-testid="battle-loop-streak-input"]'
    )!;
    expect(stopImmediatelyRadio.checked).toBe(true);
    expect(stopAfterNRadio.checked).toBe(false);
    expect(streakInput.value).toBe('3');

    // Select "Dừng sau 3 trận thua liên tiếp"
    act(() => {
      stopAfterNRadio.click();
    });
    expect(useGameStore.getState().autoRepeatDefeatRule).toBe('stop_after_n');
    expect(useGameStore.getState().autoRepeatDefeatStreakLimit).toBe(3);

    // Start 10x loop
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-opt-10"]')!
        .click();
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-start"]')!
        .click();
    });

    // Defeat #1 -> streak = 1, continues
    act(() => {
      forceDeterministicDefeatViaAiTurn();
    });
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Defeat #2 -> streak = 2, continues
    act(() => {
      forceDeterministicDefeatViaAiTurn();
    });
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Victory -> resets consecutiveDefeats back to 0!
    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Defeat #1 after victory -> streak = 1, continues
    act(() => {
      forceDeterministicDefeatViaAiTurn();
    });
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Defeat #2 after victory -> streak = 2, continues
    act(() => {
      forceDeterministicDefeatViaAiTurn();
    });
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Defeat #3 in a row -> stops with stopReason = 'defeat_streak' & summary modal
    act(() => {
      forceDeterministicDefeatViaAiTurn();
    });
    const session = useGameStore.getState().autoRepeatSession;
    expect(session?.active).toBe(false);
    expect(session?.consecutiveDefeats).toBe(3);
    expect(session?.completedRuns).toBe(6);
    expect(session?.wins).toBe(1);
    expect(session?.stopReason).toBe('defeat_streak');
    expect(container.querySelector('#repeat-summary-title')?.textContent).toContain(
      'Tổng kết Lặp tự động'
    );
    expect(container.textContent).toContain('Dừng: thua 3 trận liên tiếp');
  });

  it('launches 3 battles automatically on phone portrait when clicking Lặp -> 5x -> Bắt đầu and keeps vi/en translation key parity', () => {
    // Key parity check
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
    expect(VI_TRANSLATIONS['auto.repeatReason.defeat_streak']).toContain('{streak}');
    expect(EN_TRANSLATIONS['auto.repeatReason.defeat_streak']).toContain('{streak}');
    expect(VI_TRANSLATIONS['battle.loopRuleStopImmediately']).toBeTruthy();
    expect(EN_TRANSLATIONS['battle.loopRuleStopImmediately']).toBeTruthy();
    expect(VI_TRANSLATIONS['battle.loopRuleNeverStop']).toBeTruthy();
    expect(EN_TRANSLATIONS['battle.loopRuleNeverStop']).toBeTruthy();
    expect(VI_TRANSLATIONS['battle.speedPopoverTitle']).toBeTruthy();
    expect(EN_TRANSLATIONS['battle.speedPopoverTitle']).toBeTruthy();

    setViewport(390, 844);
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    const phoneControls = container.querySelector(
      '[data-testid="battle-phone-controls"]'
    )!;
    act(() => {
      phoneControls
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-btn"]')!
        .click();
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-opt-5"]')!
        .click();
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-start"]')!
        .click();
    });

    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.limit).toBe(5);

    const b1 = useGameStore.getState().battle;
    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const b2 = useGameStore.getState().battle;
    expect(b2).not.toBe(b1);
    expect(b2?.summary).toBeNull();

    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const b3 = useGameStore.getState().battle;
    expect(b3).not.toBe(b2);
    expect(b3?.summary).toBeNull();
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(2);
  });
});
