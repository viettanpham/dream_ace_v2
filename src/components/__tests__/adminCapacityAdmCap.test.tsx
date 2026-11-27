// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TEMPLATES } from '../../data/items';
import { generateItemInstance } from '../../engine/equipment';
import { useGameStore } from '../../store/useGameStore';
import { AdminPanel } from '../AdminPanel';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function setInputValue(input: HTMLInputElement, val: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  setter.call(input, val);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function makeTestItem(id: string) {
  const tplId = ITEM_TEMPLATES.find((t) => t.slot === 'main_weapon')!.id;
  return {
    ...generateItemInstance({ templateId: tplId, tier: 1, rarity: 'common' }, () => 0.5),
    instanceId: id,
    locked: false,
    favorited: false,
    isStarter: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

function renderBattleTab() {
  act(() => {
    useGameStore.setState({ adminPanelOpen: true });
    root!.render(createElement(AdminPanel));
  });
  const battleTab = container!.querySelector<HTMLButtonElement>(
    '[data-testid="admin-tab-battle"]'
  )!;
  act(() => {
    battleTab.click();
  });
}

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().resetCampaign();
  useGameStore.getState().startCampaign('CapTester', 'striker');
  useGameStore.getState().setLanguage('vi');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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

describe('ADM-CAP — AdminPanel capacity draft + apply', () => {
  it('(1) typing does not change the store until Áp dụng is clicked', () => {
    renderBattleTab();

    const boxInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-box-capacity-input"]'
    )!;
    const boxApply = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-box-capacity-apply"]'
    )!;
    const whInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-warehouse-capacity-input"]'
    )!;
    const whApply = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-warehouse-capacity-apply"]'
    )!;

    expect(boxApply.disabled).toBe(true);
    expect(whApply.disabled).toBe(true);

    act(() => {
      setInputValue(boxInput, '180');
      setInputValue(whInput, '750');
    });

    expect(useGameStore.getState().adminConfig.boxCapacity).toBe(100);
    expect(useGameStore.getState().adminConfig.warehouseCapacity).toBe(500);
    expect(boxApply.disabled).toBe(false);
    expect(whApply.disabled).toBe(false);

    act(() => {
      boxApply.click();
      whApply.click();
    });

    expect(useGameStore.getState().adminConfig.boxCapacity).toBe(180);
    expect(useGameStore.getState().adminConfig.warehouseCapacity).toBe(750);
  });

  it('(2) apply writes the sanitized value and shows 3s message, out-of-range draft disables button and turns hint red', () => {
    vi.useFakeTimers();
    renderBattleTab();

    const boxInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-box-capacity-input"]'
    )!;
    const boxApply = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-box-capacity-apply"]'
    )!;
    const boxHint = container!.querySelector<HTMLElement>(
      '[data-testid="admin-box-capacity-hint"]'
    )!;

    act(() => {
      setInputValue(boxInput, '5');
    });
    expect(boxInput.value).toBe('5');
    expect(boxApply.disabled).toBe(true);
    expect(boxHint.getAttribute('data-invalid')).toBe('true');
    expect(boxHint.className).toContain('text-rose-400');

    act(() => {
      setInputValue(boxInput, '5000');
    });
    expect(boxApply.disabled).toBe(true);
    expect(boxHint.getAttribute('data-invalid')).toBe('true');

    act(() => {
      setInputValue(boxInput, '220');
    });
    expect(boxApply.disabled).toBe(false);
    expect(boxHint.getAttribute('data-invalid')).toBe('false');

    act(() => {
      boxApply.click();
    });
    expect(useGameStore.getState().adminConfig.boxCapacity).toBe(220);
    expect(
      container!.querySelector('[data-testid="admin-box-capacity-applied"]')?.textContent
    ).toBe('Đã áp dụng: 220');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      container!.querySelector('[data-testid="admin-box-capacity-applied"]')
    ).toBeNull();
  });

  it('(3) Enter applies, and lower-than-used hint shows without deleting items', () => {
    const inv = Array.from({ length: 30 }, (_, idx) => makeTestItem(`inv_${idx}`));
    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, inventory: inv },
    }));
    renderBattleTab();

    const boxInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-box-capacity-input"]'
    )!;

    act(() => {
      setInputValue(boxInput, '25');
    });
    const overHintBefore = container!.querySelector(
      '[data-testid="admin-box-capacity-overcap"]'
    );
    expect(overHintBefore?.textContent).toBe('Hòm đồ đang có 30, vượt sức chứa mới');

    act(() => {
      boxInput.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });

    expect(useGameStore.getState().adminConfig.boxCapacity).toBe(25);
    expect(useGameStore.getState().pilot.inventory).toHaveLength(30);
    expect(
      container!.querySelector('[data-testid="admin-box-capacity-overcap"]')?.textContent
    ).toBe('Hòm đồ đang có 30, vượt sức chứa mới');
  });
});
