// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateItemInstance } from '../../engine/equipment';
import { getItemInstanceName, translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import type { BattleSummary, Language } from '../../types/game';
import { BattleResultDialog } from '../BattleResultDialog';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeSummary(overrides: Partial<BattleSummary> = {}): BattleSummary {
  return {
    outcome: 'victory',
    retreated: false,
    deployedGearId: 'striker',
    sectorId: 'debris_belt',
    rounds: 5,
    expGained: 180,
    creditsGained: 950,
    warPointsGained: 45,
    baseCaptureBonusWp: 15,
    leveledUp: false,
    previousLevel: 4,
    newLevel: 4,
    statPointsGained: 0,
    battlesToNextLevel: 2,
    unlockedSectorId: null,
    enemiesDestroyed: 6,
    totalEnemies: 6,
    alliesSurviving: 4,
    droppedItems: [],
    ...overrides,
  };
}

describe('BattleResultDialog (R1)', () => {
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

  function renderDialog(
    summary: BattleSummary,
    opts?: {
      lang?: Language;
      squadSize?: number;
      onOpenReport?: () => void;
      onOpenLog?: () => void;
      onReturnHangar?: () => void;
      onNextSortie?: () => void;
    }
  ) {
    const lang: Language = opts?.lang ?? 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);

    act(() => {
      root.render(
        createElement(BattleResultDialog, {
          summary,
          squadSize: opts?.squadSize ?? 4,
          lang,
          t,
          onOpenReport: opts?.onOpenReport ?? vi.fn(),
          onOpenLog: opts?.onOpenLog ?? vi.fn(),
          onReturnHangar: opts?.onReturnHangar ?? vi.fn(),
          onNextSortie: opts?.onNextSortie ?? vi.fn(),
        })
      );
    });
  }

  it('renders victory, defeat, and retreat titles with required accessibility attributes', () => {
    renderDialog(makeSummary({ outcome: 'victory', retreated: false }), {
      lang: 'vi',
    });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('battle-outcome-title');
    expect(
      container.querySelector('#battle-outcome-title')?.textContent
    ).toContain(translate('vi', 'summary.victory'));

    renderDialog(makeSummary({ outcome: 'defeat', retreated: false }), {
      lang: 'vi',
    });
    expect(
      container.querySelector('#battle-outcome-title')?.textContent
    ).toContain(translate('vi', 'summary.defeat'));

    renderDialog(makeSummary({ outcome: 'defeat', retreated: true }), {
      lang: 'vi',
    });
    expect(
      container.querySelector('#battle-outcome-title')?.textContent
    ).toContain(translate('vi', 'summary.retreatTitle'));
  });

  it('renders level-up and unlocked-sector banners only when present', () => {
    renderDialog(
      makeSummary({
        leveledUp: false,
        unlockedSectorId: null,
      })
    );
    expect(
      container.querySelector('[data-testid="battle-result-levelup-banner"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="battle-result-sector-banner"]')
    ).toBeNull();

    renderDialog(
      makeSummary({
        leveledUp: true,
        previousLevel: 4,
        newLevel: 5,
        statPointsGained: 3,
        unlockedSectorId: 'iron_citadel',
      })
    );
    const levelBanner = container.querySelector(
      '[data-testid="battle-result-levelup-banner"]'
    );
    const sectorBanner = container.querySelector(
      '[data-testid="battle-result-sector-banner"]'
    );
    expect(levelBanner).not.toBeNull();
    expect(levelBanner?.textContent).toContain('+3 PTS');
    expect(sectorBanner).not.toBeNull();
  });

  it('handles empty drops and non-empty drops (with title attribute and truncate only on item names)', () => {
    renderDialog(makeSummary({ droppedItems: [] }), { lang: 'vi' });
    expect(
      container.querySelector('[data-testid="battle-result-empty-drops"]')
        ?.textContent
    ).toContain(translate('vi', 'summary.noDrops'));
    expect(
      container.querySelector('[data-testid="battle-result-drops-list"]')
    ).toBeNull();

    const item1 = generateItemInstance({
      templateId: 'tpl_mw_arc_blade',
      tier: 2,
      rarity: 'rare',
    });
    const item2 = generateItemInstance({
      templateId: 'tpl_sh_aegis_core',
      tier: 2,
      rarity: 'epic',
    });
    const item3 = generateItemInstance({
      templateId: 'tpl_en_fusion_drive',
      tier: 2,
      rarity: 'common',
    });
    const item4 = generateItemInstance({
      templateId: 'tpl_mw_rail_lance',
      tier: 3,
      rarity: 'legendary',
    });

    renderDialog(
      makeSummary({ droppedItems: [item1, item2, item3, item4] }),
      { lang: 'en' }
    );
    const dropsList = container.querySelector(
      '[data-testid="battle-result-drops-list"]'
    );
    expect(dropsList).not.toBeNull();
    expect(dropsList?.className).toContain('overflow-y-auto');
    expect(dropsList?.className).toContain('max-h-[176px]');

    const expectedName = getItemInstanceName('en', item1);
    const titledEl = Array.from(dropsList?.querySelectorAll('[title]') ?? []).find(
      (el) => el.getAttribute('title') === expectedName
    );
    expect(titledEl).toBeDefined();
    expect(titledEl?.className).toContain('truncate');
    expect(titledEl?.parentElement?.className).toContain('min-w-0');
  });

  it('calls all 4 action handlers when clicked and verifies responsive layout/sizing classes', () => {
    const onOpenReport = vi.fn();
    const onOpenLog = vi.fn();
    const onReturnHangar = vi.fn();
    const onNextSortie = vi.fn();

    renderDialog(makeSummary(), {
      lang: 'vi',
      onOpenReport,
      onOpenLog,
      onReturnHangar,
      onNextSortie,
    });

    const dialogPanel = container.querySelector(
      '[data-testid="battle-result-dialog"]'
    );
    expect(dialogPanel).not.toBeNull();
    expect(dialogPanel?.className).toContain('w-full');
    expect(dialogPanel?.className).toContain('sm:w-[min(720px,92vw)]');
    expect(dialogPanel?.className).toContain('max-h-[92vh]');
    expect(dialogPanel?.className).toContain('sm:max-h-[90vh]');

    const columns = container.querySelector(
      '[data-testid="battle-result-columns"]'
    );
    expect(columns?.className).toContain('grid-cols-1');
    expect(columns?.className).toContain('sm:grid-cols-2');

    const actions = container.querySelector(
      '[data-testid="battle-result-actions"]'
    );
    expect(actions?.className).toContain('grid-cols-2');
    expect(actions?.className).toContain('sm:grid-cols-4');

    const reportBtn = container.querySelector(
      '[data-testid="battle-open-report-btn"]'
    ) as HTMLButtonElement;
    const logBtn = container.querySelector(
      '[data-testid="battle-outcome-log-btn"]'
    ) as HTMLButtonElement;
    const hangarBtn = container.querySelector(
      '[data-testid="battle-result-hangar-btn"]'
    ) as HTMLButtonElement;
    const nextBtn = container.querySelector(
      '[data-testid="battle-result-next-btn"]'
    ) as HTMLButtonElement;

    expect(reportBtn).not.toBeNull();
    expect(logBtn).not.toBeNull();
    expect(hangarBtn).not.toBeNull();
    expect(nextBtn).not.toBeNull();
    expect(reportBtn.className).toContain('min-h-[44px]');
    expect(logBtn.className).toContain('min-h-[44px]');
    expect(hangarBtn.className).toContain('min-h-[44px]');
    expect(nextBtn.className).toContain('min-h-[44px]');

    // Button labels must not be clipped with truncate
    expect(logBtn.innerHTML).not.toContain('truncate');

    // Sticky safe-area footer bar present on mobile
    expect(container.innerHTML).toContain('sticky bottom-0');
    expect(container.innerHTML).toContain('pb-safe');

    act(() => {
      reportBtn.click();
      logBtn.click();
      hangarBtn.click();
      nextBtn.click();
    });

    expect(onOpenReport).toHaveBeenCalledTimes(1);
    expect(onOpenLog).toHaveBeenCalledTimes(1);
    expect(onReturnHangar).toHaveBeenCalledTimes(1);
    expect(onNextSortie).toHaveBeenCalledTimes(1);
  });
});
