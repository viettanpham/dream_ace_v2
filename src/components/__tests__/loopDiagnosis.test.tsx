// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';
import { InMemoryCloudStore } from '../../engine/cloudStore';
import {
  attachCloudAutosaveListeners,
  setCloudStoreAdapterForTests,
  useCloudSaveStore,
} from '../../store/useCloudSaveStore';
import { useGameStore } from '../../store/useGameStore';
import type { AutoRepeatLimit } from '../../types/game';
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

describe('TASK LP0 — Loop (Lặp) Diagnosis', () => {
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
    vi.useRealTimers();
  });

  it('auto-starts battles 2 and 3 without clicking when loop is active for 3 runs with forced victory', () => {
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    // Activate Auto-Repeat loop for 3 battles
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

    // Battle 1: forced victory -> should show toast, NOT "Chiến thắng Xuất kích", and keep loop active
    act(() => {
      useGameStore.getState().forceWinBattle();
    });

    expect(useGameStore.getState().battle?.summary?.outcome).toBe('victory');
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(1);
    expect(container.querySelector('#battle-outcome-title')).toBeNull();
    expect(container.querySelector('[data-testid="battle-loop-toast"]')).not.toBeNull();

    // Advance timer without clicking -> Battle 2 launches automatically
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const battle2 = useGameStore.getState().battle;
    expect(battle2).not.toBeNull();
    expect(battle2).not.toBe(battle1);
    expect(battle2?.summary).toBeNull();
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(1);

    // Battle 2: forced victory -> advances to 2/3, still active
    act(() => {
      useGameStore.getState().forceWinBattle();
    });

    expect(useGameStore.getState().battle?.summary?.outcome).toBe('victory');
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(2);
    expect(container.querySelector('#battle-outcome-title')).toBeNull();

    // Advance timer without clicking -> Battle 3 launches automatically
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const battle3 = useGameStore.getState().battle;
    expect(battle3).not.toBeNull();
    expect(battle3).not.toBe(battle2);
    expect(battle3?.summary).toBeNull();
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(2);

    // Battle 3: forced victory -> reaches 3/3, stops cleanly with batch summary (not "Chiến thắng Xuất kích")
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

      // Simulate a deferred cloud upload queued mid-battle
      act(() => {
        useCloudSaveStore.setState({ deferredUploadPending: true });
        useGameStore
          .getState()
          .startAutoRepeat(3 as unknown as AutoRepeatLimit, 'debris_belt');
      });

      // Battle 1 win
      act(() => {
        useGameStore.getState().forceWinBattle();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(useGameStore.getState().battle?.summary).toBeNull();
      expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(1);

      // Battle 2 win
      act(() => {
        useGameStore.getState().forceWinBattle();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(useGameStore.getState().battle?.summary).toBeNull();
      expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(2);

      // Battle 3 win
      act(() => {
        useGameStore.getState().forceWinBattle();
      });
      expect(useGameStore.getState().autoRepeatSession?.active).toBe(false);
      expect(useGameStore.getState().autoRepeatSession?.completedRuns).toBe(3);
    } finally {
      detachCloud();
    }
  });

  // This test fails on current desktop code (BattleScreen.tsx:1906 & 1908):
  // Clicking "Lặp" highlights the button green (looking ON), while battle-loop-popover is rendered
  // inside an overflow-hidden wrapper (line 1908) and max-h-[48px] overflow-x-hidden control bar (line 1906),
  // clipping the popover containing "Bắt đầu" out of view on desktop (>640px).
  test.fails(
    'desktop "Lặp" popover is not clipped by overflow-hidden / max-h-[48px] ancestors',
    () => {
      setViewport(1280, 800);
      useGameStore.getState().startBattle('debris_belt');

      act(() => {
        root.render(createElement(BattleScreen));
      });

      const loopBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="battle-loop-btn"]'
      );
      expect(loopBtn).not.toBeNull();

      act(() => {
        loopBtn!.click();
      });

      const popover = container.querySelector<HTMLElement>(
        '[data-testid="battle-loop-popover"]'
      );
      expect(popover).not.toBeNull();

      // Walk ancestors up to battle-desktop-controls: none should clip vertical popover overflow
      let el: HTMLElement | null = popover!.parentElement;
      const clippingAncestors: string[] = [];
      while (el && el !== container) {
        if (
          el.className.includes('overflow-hidden') ||
          el.className.includes('overflow-x-hidden')
        ) {
          clippingAncestors.push(el.className);
        }
        el = el.parentElement;
      }

      expect(clippingAncestors).toEqual([]);
    }
  );

  it('reproduces the exact "Chiến thắng Xuất kích" symptom when only "Lặp" is clicked (as occurs when desktop popover is clipped)', () => {
    setViewport(1280, 800);
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    const desktopLoopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="battle-loop-btn"]'
    )!;
    act(() => {
      desktopLoopBtn.click();
    });

    // Visually highlighted emerald/green even though loop is not running
    expect(desktopLoopBtn.className).toContain('border-emerald-400');
    expect(desktopLoopBtn.getAttribute('data-loop-running')).toBe('false');
    expect(useGameStore.getState().autoRepeatSession).toBeNull();

    act(() => {
      useGameStore.getState().forceWinBattle();
    });
    const desktopBattleAfterWin = useGameStore.getState().battle;

    expect(container.querySelector('#battle-outcome-title')?.textContent).toBe(
      'Chiến thắng Xuất kích'
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // No next battle started
    expect(useGameStore.getState().battle).toBe(desktopBattleAfterWin);
    expect(useGameStore.getState().battle?.summary?.outcome).toBe('victory');
  });

  it('launches 3 battles automatically on phone portrait when clicking Lặp -> 5x -> Bắt đầu (no overflow-hidden clipping)', () => {
    setViewport(390, 844);
    useGameStore.getState().startBattle('debris_belt');

    act(() => {
      root.render(createElement(BattleScreen));
    });

    const phoneControls = container.querySelector(
      '[data-testid="battle-phone-controls"]'
    )!;
    expect(phoneControls.className).not.toContain('overflow-hidden');

    act(() => {
      phoneControls
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-btn"]')!
        .click();
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-opt-5"]')!
        .click();
    });
    act(() => {
      container
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
