// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  DEFAULT_NOTICE_DURATION_SEC,
  migrateSaveData,
  sanitizeNoticeDurationSec,
} from '../../engine/migration';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { ItemInstance } from '../../types/game';
import { AdminPanel } from '../AdminPanel';
import { GearView } from '../GearView';
import { Notice } from '../Notice';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeItem(instanceId: string, price = 120): ItemInstance {
  return {
    instanceId,
    templateId: 'pulse_laser_mk1',
    slot: 'main_weapon',
    tier: 1,
    requiredLevel: 1,
    classRestriction: null,
    rarity: 'common',
    rolledBaseStats: { attack: 4 },
    affixes: [],
    suffixId: null,
    rollQuality: 70,
    price,
    enchantLevel: 0,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  const fresh = createFreshCampaignState('PilotU2b', 'striker');
  useGameStore.setState({
    ...fresh,
    language: 'vi',
    screen: 'HANGAR',
    activeTab: 'gear',
    quickSellUndo: null,
    autoEquipUndo: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  vi.restoreAllMocks();
});

describe('TASK U2b — Notice component + GearView single banner + Admin CP duration', () => {
  it('countdown ticks every second with visible label + progress bar and closes at duration', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        createElement(Notice, {
          tone: 'info',
          text: 'Thông báo thử nghiệm',
          durationSec: 10,
          onClose,
          testId: 'test-notice',
        })
      );
    });

    const notice = container!.querySelector<HTMLElement>('[data-testid="test-notice"]')!;
    expect(notice.getAttribute('aria-live')).toBe('off');
    expect(notice.className).toContain('h-[44px]');
    expect(
      container!.querySelector('[data-testid="notice-countdown"]')?.textContent
    ).toBe('10s');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      container!.querySelector('[data-testid="notice-countdown"]')?.textContent
    ).toBe('9s');
    const barAfter1s = container!.querySelector<HTMLElement>(
      '[data-testid="notice-progress-bar"]'
    )!;
    expect(barAfter1s.style.width).toBe('90%');
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pauses on hover, focus, or touch and resumes on leave, and closes immediately on X', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        createElement(Notice, {
          tone: 'warning',
          text: 'Hover/Touch Pause Test',
          durationSec: 5,
          onClose,
          testId: 'pause-notice',
        })
      );
    });

    const notice = container!.querySelector<HTMLElement>(
      '[data-testid="pause-notice"]'
    )!;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      container!.querySelector('[data-testid="notice-countdown"]')?.textContent
    ).toBe('4s');

    // Hover pauses countdown
    act(() => {
      notice.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      container!.querySelector('[data-testid="notice-countdown"]')?.textContent
    ).toBe('4s');
    expect(onClose).not.toHaveBeenCalled();

    // Mouse leave resumes countdown
    act(() => {
      notice.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      container!.querySelector('[data-testid="notice-countdown"]')?.textContent
    ).toBe('3s');

    // Touch start pauses, touch end resumes
    act(() => {
      notice.dispatchEvent(new Event('touchstart', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      container!.querySelector('[data-testid="notice-countdown"]')?.textContent
    ).toBe('3s');
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      notice.dispatchEvent(new Event('touchend', { bubbles: true }));
    });

    // Clicking X closes immediately
    const closeBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="notice-close-btn"]'
    )!;
    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('durationSec = 0 never auto-closes and renders no countdown or progress track', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        createElement(Notice, {
          tone: 'success',
          text: 'Sticky Notice',
          durationSec: 0,
          onClose,
          testId: 'sticky-notice',
        })
      );
    });

    expect(
      container!.querySelector('[data-testid="notice-countdown"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="notice-progress-track"]')
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('GearView shows one banner at a time, second banner replaces first, and undo only works before expiry/close', () => {
    vi.useFakeTimers();

    const spare1 = makeItem('u2b_spare_1', 100);
    const spare2 = makeItem('u2b_spare_2', 150);
    const strongWp = {
      ...makeItem('u2b_strong_wp', 300),
      rolledBaseStats: { attack: 25 },
    };
    const baseState = useGameStore.getState();

    useGameStore.setState({
      pilot: {
        ...baseState.pilot,
        inventory: [spare1, spare2, strongWp],
      },
      adminConfig: {
        ...baseState.adminConfig,
        noticeDurationSec: 4,
      },
    });

    act(() => {
      root!.render(createElement(GearView));
    });

    // Empty initially: nothing reserved
    expect(
      container!.querySelector('[data-testid="quicksell-undo-toast"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="autoequip-undo-toast"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="gear-inventory-notice"]')
    ).toBeNull();

    // Quick sell triggers quicksell-undo-toast with 4s configured countdown
    act(() => {
      useGameStore.getState().executeQuickSell(['u2b_spare_1']);
    });

    const qsToast = container!.querySelector(
      '[data-testid="quicksell-undo-toast"]'
    );
    expect(qsToast).not.toBeNull();
    expect(qsToast!.textContent).toContain('Đã bán nhanh 1 linh kiện');
    expect(
      container!.querySelector('[data-testid="notice-countdown"]')?.textContent
    ).toBe('4s');
    expect(
      container!.querySelector('[data-testid="quicksell-undo-btn"]')
    ).not.toBeNull();

    // Second banner (autoEquipUndo) replaces quicksell banner; only ONE banner rendered, replaced quickSellUndo stays in store
    const prevStrikerEquipped = { ...useGameStore.getState().pilot.gears.striker.equipped };
    act(() => {
      useGameStore.setState({
        autoEquipUndo: {
          mode: 'single',
          targetGearId: 'striker',
          previousEquippedByGear: { striker: prevStrikerEquipped },
          changedSlotsCount: 1,
          appliedAt: Date.now(),
        },
      });
    });

    expect(
      container!.querySelector('[data-testid="quicksell-undo-toast"]')
    ).toBeNull();
    expect(useGameStore.getState().quickSellUndo).not.toBeNull();
    const aeToast = container!.querySelector(
      '[data-testid="autoequip-undo-toast"]'
    );
    expect(aeToast).not.toBeNull();
    expect(aeToast!.textContent).toContain('Đã tự động trang bị (1 ô thay đổi)');

    // Let auto-equip banner expire -> calls clearAutoEquipUndo() and removes button
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(
      container!.querySelector('[data-testid="autoequip-undo-toast"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="autoequip-undo-btn"]')
    ).toBeNull();
    expect(useGameStore.getState().autoEquipUndo).toBeNull();

    // Test QuickSell Undo works BEFORE expiry, then disappears
    act(() => {
      useGameStore.getState().executeQuickSell(['u2b_spare_2']);
    });
    const qsUndoBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="quicksell-undo-btn"]'
    )!;
    expect(qsUndoBtn).not.toBeNull();
    act(() => {
      qsUndoBtn.click();
    });
    expect(
      useGameStore.getState().pilot.inventory.some((i) => i.instanceId === 'u2b_spare_2')
    ).toBe(true);
    expect(useGameStore.getState().quickSellUndo).toBeNull();
    expect(
      container!.querySelector('[data-testid="quicksell-undo-toast"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="gear-inventory-notice"]')
    ).not.toBeNull();
  });

  it('clamps adminConfig.noticeDurationSec (0..120) in sanitizer and updates via AdminPanel input', () => {
    expect(sanitizeNoticeDurationSec(undefined)).toBe(DEFAULT_NOTICE_DURATION_SEC);
    expect(sanitizeNoticeDurationSec(-10)).toBe(0);
    expect(sanitizeNoticeDurationSec(0)).toBe(0);
    expect(sanitizeNoticeDurationSec(45)).toBe(45);
    expect(sanitizeNoticeDurationSec(999)).toBe(120);

    const fresh = createFreshCampaignState('AdminCheck', 'striker');
    const migrated = migrateSaveData(
      {
        ...fresh,
        adminConfig: {
          ...fresh.adminConfig,
          noticeDurationSec: 300,
        },
      },
      CURRENT_SAVE_VERSION
    );
    expect(migrated.adminConfig.noticeDurationSec).toBe(120);

    const migratedZero = migrateSaveData(
      {
        ...fresh,
        adminConfig: {
          ...fresh.adminConfig,
          noticeDurationSec: 0,
        },
      },
      CURRENT_SAVE_VERSION
    );
    expect(migratedZero.adminConfig.noticeDurationSec).toBe(0);

    // AdminPanel field changes store adminConfig.noticeDurationSec
    act(() => {
      useGameStore.setState({ adminPanelOpen: true });
      root!.render(createElement(AdminPanel));
    });
    const battleTabBtn = Array.from(
      container!.querySelectorAll('button')
    ).find((b) => b.textContent?.includes('Chiến đấu'));
    expect(battleTabBtn).toBeDefined();
    act(() => {
      battleTabBtn!.click();
    });

    const input = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-notice-duration-input"]'
    )!;
    expect(input).not.toBeNull();
    expect(input.value).toBe('10');

    // Verify vi/en parity too
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )!.set!;
    act(() => {
      nativeInputValueSetter.call(input, '25');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(useGameStore.getState().adminConfig.noticeDurationSec).toBe(25);
  });
});
