// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().resetCampaign();
  useGameStore.getState().startCampaign('LvTester', 'striker');
  useGameStore.getState().setLanguage('vi');
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
  }
  container = null;
});

describe('LVL-CAP — AdminPanel maxLevel draft + Apply + dynamic Set Level label', () => {
  it('typing and blur do not save maxLevel until Apply or Enter, and Set Level label updates to (1–N)', () => {
    act(() => {
      useGameStore.setState({ adminPanelOpen: true });
      root!.render(createElement(AdminPanel));
    });

    const input = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-max-level-input"]'
    )!;
    const applyBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-max-level-apply"]'
    )!;

    expect(input.getAttribute('min')).toBeNull();
    expect(input.getAttribute('max')).toBeNull();
    expect(input.value).toBe('100');
    expect(applyBtn.disabled).toBe(true);
    expect(container!.textContent).toContain('Đặt cấp (1–100)');
    expect(container!.textContent).toContain('Cấp tối đa');
    expect(container!.textContent).not.toContain('(20–100)');

    // Empty / 0 disables Apply and does not mutate store
    act(() => {
      setInputValue(input, '');
    });
    expect(applyBtn.disabled).toBe(true);
    expect(useGameStore.getState().adminConfig.maxLevel).toBe(100);

    act(() => {
      setInputValue(input, '0');
    });
    expect(applyBtn.disabled).toBe(true);

    // Typing 500 + blur does NOT save until Apply clicked
    act(() => {
      setInputValue(input, '500');
      input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    });
    expect(applyBtn.disabled).toBe(false);
    expect(useGameStore.getState().adminConfig.maxLevel).toBe(100);

    act(() => {
      applyBtn.click();
    });
    expect(useGameStore.getState().adminConfig.maxLevel).toBe(500);
    expect(container!.textContent).toContain('Đặt cấp (1–500)');
    expect(applyBtn.disabled).toBe(true);

    // Enter also applies
    act(() => {
      setInputValue(input, '300');
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });
    expect(useGameStore.getState().adminConfig.maxLevel).toBe(300);
    expect(container!.textContent).toContain('Đặt cấp (1–300)');
  });
});
