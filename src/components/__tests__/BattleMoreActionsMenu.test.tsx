// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import type { Language } from '../../types/game';
import {
  BattleMoreActionsMenu,
  type BattleMoreActionsMenuConfig,
} from '../BattleMoreActionsMenu';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeMenuConfig(
  overrides: Partial<BattleMoreActionsMenuConfig> = {}
): BattleMoreActionsMenuConfig {
  const lang: Language = 'vi';
  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(lang, key, params);

  return {
    open: true,
    sectorLabel: 'Vành đai mảnh vỡ',
    squadSize: 4,
    hasSummary: false,
    battleSpeed: 1,
    speechBubblesEnabled: true,
    skipAnimations: false,
    retreatConfirmOpen: false,
    t,
    onClose: vi.fn(),
    onSetBattleSpeed: vi.fn(),
    onOpenTactics: vi.fn(),
    onToggleSpeechBubbles: vi.fn(),
    onToggleSkipAnimations: vi.fn(),
    onOpenStats: vi.fn(),
    onSetRetreatConfirmOpen: vi.fn(),
    onRetreatBattle: vi.fn(),
    onToggleAdminPanel: vi.fn(),
    ...overrides,
  };
}

describe('BattleMoreActionsMenu (RF-BS2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('respects open/closed state, renders key testids, and calls main handlers', () => {
    act(() => {
      root.render(
        createElement(BattleMoreActionsMenu, {
          menu: makeMenuConfig({ open: false }),
        })
      );
    });
    expect(
      container.querySelector('[data-testid="battle-more-menu"]')
    ).toBeNull();

    const onClose = vi.fn();
    const onOpenTactics = vi.fn();
    const onToggleSpeechBubbles = vi.fn();

    act(() => {
      root.render(
        createElement(BattleMoreActionsMenu, {
          menu: makeMenuConfig({
            open: true,
            onClose,
            onOpenTactics,
            onToggleSpeechBubbles,
          }),
        })
      );
    });

    const menuEl = container.querySelector('[data-testid="battle-more-menu"]');
    expect(menuEl).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-more-tactics"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-toggle-bubbles"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-toggle-skip-anim"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-more-stats"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-more-retreat"]')
    ).not.toBeNull();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-toggle-bubbles"]')
        ?.click();
    });
    expect(onToggleSpeechBubbles).toHaveBeenCalledTimes(1);

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-more-tactics"]')
        ?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenTactics).toHaveBeenCalledTimes(1);
  });
});
