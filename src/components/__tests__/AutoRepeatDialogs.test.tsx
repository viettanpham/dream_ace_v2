// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import type {
  AutoRepeatRunToast,
  AutoRepeatSession,
  Language,
} from '../../types/game';
import { AutoRepeatDialogs } from '../AutoRepeatDialogs';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeToast(
  overrides: Partial<AutoRepeatRunToast> = {}
): AutoRepeatRunToast {
  return {
    id: 'toast-1',
    runNumber: 2,
    outcome: 'victory',
    expGained: 120,
    creditsGained: 450,
    warPointsGained: 25,
    lootCount: 1,
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<AutoRepeatSession> = {}
): AutoRepeatSession {
  return {
    active: false,
    sectorId: 'debris_belt',
    limit: 5,
    defeatStreakLimit: 2,
    consecutiveDefeats: 0,
    completedRuns: 5,
    wins: 5,
    totalExp: 600,
    totalCredits: 2250,
    totalWarPoints: 125,
    totalDrops: [],
    stopReason: 'completed',
    ...overrides,
  };
}

describe('AutoRepeatDialogs (SB3-RF1)', () => {
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

  it('renders toast and batch summary modal with expected testids and callbacks', () => {
    const lang: Language = 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);

    const onClearToast = vi.fn();
    const onClearSummary = vi.fn();
    const onReloadBattle = vi.fn();
    const onOpenReport = vi.fn();
    const onReturnHangar = vi.fn();
    const onStartAutoRepeat = vi.fn();

    act(() => {
      root.render(
        createElement(AutoRepeatDialogs, {
          toast: makeToast(),
          showRepeatBatchSummary: false,
          session: null,
          deployedGearId: 'striker',
          autoRepeatDefeatStreakLimit: 1,
          autoRepeatLimit: 5,
          sectorId: 'debris_belt',
          lang,
          t,
          onClearToast,
          onClearSummary,
          onReloadBattle,
          onOpenReport,
          onReturnHangar,
          onStartAutoRepeat,
        })
      );
    });

    expect(
      container.querySelector('[data-testid="battle-loop-toast"]')
    ).not.toBeNull();
    const closeBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="battle-loop-toast-close"]'
    );
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn?.click();
    });
    expect(onClearToast).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(
        createElement(AutoRepeatDialogs, {
          toast: makeToast(),
          showRepeatBatchSummary: true,
          session: makeSession(),
          deployedGearId: 'striker',
          autoRepeatDefeatStreakLimit: 2,
          autoRepeatLimit: 5,
          sectorId: 'debris_belt',
          lang,
          t,
          onClearToast,
          onClearSummary,
          onReloadBattle,
          onOpenReport,
          onReturnHangar,
          onStartAutoRepeat,
        })
      );
    });

    expect(
      container.querySelector('[data-testid="battle-loop-toast"]')
    ).toBeNull();
    expect(container.querySelector('#repeat-summary-title')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-loop-stop-reason"]')
    ).not.toBeNull();
  });
});
