// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFreshCampaignState } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import { BottomSheet } from '../BottomSheet';
import { TopHud } from '../TopHud';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('PilotSet1', 'striker'),
    language: 'en',
  });
  useGameStore.getState().startCampaign('PilotSet1', 'striker');
  useGameStore.getState().setLanguage('en');
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

describe('TASK SET-1 — BottomSheet size="large" and TopHud Settings sheet', () => {
  it('1) default size renders the old class set (md:max-w-lg present, no md:w-[90vw])', () => {
    act(() => {
      root!.render(
        createElement(BottomSheet, {
          open: true,
          onClose: () => {},
          title: 'Default Sheet',
          testId: 'sheet-default',
          children: createElement('div', null, 'Body'),
        })
      );
    });

    const dialog = container!.querySelector('[data-testid="sheet-default"]') as HTMLElement;
    const panel = dialog.firstElementChild as HTMLElement;
    expect(panel.className).toContain('md:max-w-lg');
    expect(panel.className).toContain('max-h-[86dvh]');
    expect(panel.className).not.toContain('md:w-[90vw]');
    expect(panel.className).not.toContain('md:h-[90dvh]');
  });

  it('2) size="large" renders md:w-[90vw] and md:h-[90dvh] with phone max-h preserved', () => {
    act(() => {
      root!.render(
        createElement(BottomSheet, {
          open: true,
          onClose: () => {},
          title: 'Large Sheet',
          size: 'large',
          testId: 'sheet-large',
          children: createElement('div', null, 'Body'),
        })
      );
    });

    const dialog = container!.querySelector('[data-testid="sheet-large"]') as HTMLElement;
    const panel = dialog.firstElementChild as HTMLElement;
    expect(panel.className).toContain('md:w-[90vw]');
    expect(panel.className).toContain('md:max-w-none');
    expect(panel.className).toContain('md:h-[90dvh]');
    expect(panel.className).toContain('md:max-h-[90dvh]');
    expect(panel.className).toContain('max-h-[86dvh]');
    expect(panel.className).not.toContain('md:max-w-lg');
  });

  it('3) TopHud Settings sheet opens with large desktop classes', () => {
    act(() => {
      root!.render(createElement(TopHud));
    });

    const settingsBtn = container!.querySelector(
      '[data-testid="tophud-settings-btn"]'
    ) as HTMLButtonElement;
    expect(settingsBtn).not.toBeNull();

    act(() => {
      settingsBtn.click();
    });

    const dialog = container!.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    const panel = dialog.firstElementChild as HTMLElement;
    expect(panel.className).toContain('md:w-[90vw]');
    expect(panel.className).toContain('md:h-[90dvh]');
    expect(panel.className).toContain('md:max-w-none');
    expect(panel.className).toContain('md:max-h-[90dvh]');
  });
});
