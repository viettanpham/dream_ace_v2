// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import type { Language } from '../../types/game';
import { FieldSuppliesSheet } from '../FieldSuppliesSheet';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('FieldSuppliesSheet (RF-BS2)', () => {
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

  it('renders open/closed states and opens tactics when footer button is clicked', () => {
    const lang: Language = 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);
    const onClose = vi.fn();
    const onOpenTactics = vi.fn();
    const onReloadBattle = vi.fn();

    act(() => {
      root.render(
        createElement(FieldSuppliesSheet, {
          open: false,
          t,
          onClose,
          onOpenTactics,
          onReloadBattle,
        })
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      root.render(
        createElement(FieldSuppliesSheet, {
          open: true,
          t,
          onClose,
          onOpenTactics,
          onReloadBattle,
        })
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(t('battle.suppliesTitle'));
    expect(dialog?.textContent).toContain(t('battle.noConsumables'));

    const openTacticsBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).find((btn) => btn.textContent?.includes(t('battle.openTactics')));
    expect(openTacticsBtn).toBeDefined();

    act(() => {
      openTacticsBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenTactics).toHaveBeenCalledTimes(1);
  });
});
