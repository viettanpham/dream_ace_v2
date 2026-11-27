// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshCampaignState } from '../../engine/migration';
import { ENABLE_ADMIN_CP, useGameStore } from '../../store/useGameStore';
import { TopHud } from '../TopHud';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('PilotTop1', 'striker'),
    language: 'vi',
    screen: 'HANGAR',
    adminUnlocked: false,
    adminPanelOpen: false,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.restoreAllMocks();
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

describe('TASK TOP-1 — Top bar declutter & dev Admin CP icon', () => {
  it('1) top bar renders no language toggle while the Settings sheet still has one', () => {
    act(() => {
      root!.render(createElement(TopHud));
    });

    const header = container!.querySelector('[data-testid="tophud-standard"]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.querySelector('[aria-label="Language"]')).toBeNull();

    const settingsBtn = container!.querySelector(
      '[data-testid="tophud-settings-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      settingsBtn.click();
    });

    const dialog = container!.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('[aria-label="Language"]')).not.toBeNull();
  });

  it('2) with ENABLE_ADMIN_CP true and adminUnlocked false, top-bar tophud-admin-btn is rendered icon-only (no text)', () => {
    expect(ENABLE_ADMIN_CP).toBe(true);
    useGameStore.setState({ adminUnlocked: false });

    act(() => {
      root!.render(createElement(TopHud));
    });

    const adminBtn = container!.querySelector(
      '[data-testid="tophud-admin-btn"]'
    ) as HTMLButtonElement;
    expect(adminBtn).not.toBeNull();
    expect(adminBtn.textContent?.trim()).toBe('');
    expect(adminBtn.className).toContain('hidden');
    expect(adminBtn.className).toContain('md:flex');
    expect(adminBtn.className).toContain('md:h-9');
    expect(adminBtn.className).toContain('md:w-9');
    expect(adminBtn.querySelector('svg')).not.toBeNull();
  });

  it('3) clicking tophud-admin-btn calls toggleAdminPanel', () => {
    const toggleSpy = vi.spyOn(useGameStore.getState(), 'toggleAdminPanel');

    act(() => {
      root!.render(createElement(TopHud));
    });

    const adminBtn = container!.querySelector(
      '[data-testid="tophud-admin-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      adminBtn.click();
    });

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().adminPanelOpen).toBe(true);
    expect(useGameStore.getState().adminUnlocked).toBe(true);
  });
});
