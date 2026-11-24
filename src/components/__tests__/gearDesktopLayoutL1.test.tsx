// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STAT_KEYS } from '../../data/classes';
import { ITEM_TEMPLATES } from '../../data/items';
import { generateItemInstance } from '../../engine/equipment';
import { createFreshCampaignState } from '../../engine/migration';
import { getStatShort } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import { GearView } from '../GearView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('PilotL1', 'striker'),
    language: 'en',
  });
  useGameStore.getState().startCampaign('PilotL1', 'striker');
  useGameStore.getState().setLanguage('en');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
});

describe('TASK GEAR-L1 — Desktop 2-col layout + collapsible stats bar', () => {
  it('1) desktop gear-stats-bar renders collapsed by default and gear-stats-toggle expands it to all STAT_KEYS', () => {
    act(() => {
      root!.render(createElement(GearView));
    });

    const statsBar = container!.querySelector(
      '[data-testid="gear-stats-bar"]'
    ) as HTMLElement;
    const toggle = container!.querySelector(
      '[data-testid="gear-stats-toggle"]'
    ) as HTMLButtonElement;
    expect(statsBar).not.toBeNull();
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(statsBar.querySelector('.grid-cols-3.xl\\:grid-cols-4')).toBeNull();

    act(() => {
      toggle.click();
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const expandedGrid = statsBar.querySelector(
      '.grid-cols-3.xl\\:grid-cols-4'
    ) as HTMLElement;
    expect(expandedGrid).not.toBeNull();
    for (const k of STAT_KEYS) {
      expect(expandedGrid.textContent).toContain(getStatShort('en', k));
    }
  });

  it('2) the sticky right-column detail section is rendered once and shows the selected item detail', () => {
    act(() => {
      root!.render(createElement(GearView));
    });

    const detailSections = container!.querySelectorAll(
      'section.hidden.lg\\:flex.lg\\:col-span-5'
    );
    expect(detailSections).toHaveLength(1);
    const panel = detailSections[0] as HTMLElement;
    expect(panel.className).toContain('lg:sticky');
    expect(panel.className).toContain('lg:top-4');

    const mainSlot = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-main_weapon"]'
    ) as HTMLButtonElement;
    act(() => {
      mainSlot.click();
    });
    expect(
      panel.querySelector('[data-testid="detail-unequip-shortcut"]')
    ).not.toBeNull();
  });

  it('3) old col-span-3 stats section is gone and radar derived/stealth testids are never duplicated', () => {
    const tpl = ITEM_TEMPLATES.find((t) => t.id === 'tpl_rd_hunter')!;
    const radar = {
      ...generateItemInstance(
        { templateId: tpl.id, tier: tpl.tier, rarity: 'epic', rollQuality: 70 },
        () => 0.5
      ),
      instanceId: 'inst_radar_l1',
      locked: false,
      favorited: false,
      isStarter: false,
      isNew: false,
      obtainedAt: 1700000000000,
    };
    const pilot = useGameStore.getState().pilot;
    useGameStore.setState({
      pilot: {
        ...pilot,
        inventory: [...pilot.inventory, radar],
        gears: {
          ...pilot.gears,
          striker: {
            ...pilot.gears.striker,
            equipped: { ...pilot.gears.striker.equipped, radar: radar.instanceId },
          },
        },
      },
    });

    act(() => {
      root!.render(createElement(GearView));
    });

    expect(container!.querySelector('.lg\\:col-span-3')).toBeNull();
    expect(container!.querySelector('.lg\\:col-span-9')).toBeNull();
    expect(
      container!.querySelectorAll('[data-testid="gear-derived-accuracy"]')
    ).toHaveLength(1);
    expect(
      container!.querySelectorAll('[data-testid="gear-stealth-detect-chip"]')
    ).toHaveLength(1);

    act(() => {
      (
        container!.querySelector(
          '[data-testid="gear-stats-toggle"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      container!.querySelectorAll('[data-testid="gear-derived-accuracy"]')
    ).toHaveLength(1);
    expect(
      container!.querySelectorAll('[data-testid="gear-stealth-detect-chip"]')
    ).toHaveLength(1);
  });

  it('4) phone stats block still exists (lg:hidden) unchanged', () => {
    act(() => {
      root!.render(createElement(GearView));
    });

    const phoneToggle = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Full Stats') && b.closest('.lg\\:hidden')
    );
    expect(phoneToggle).toBeDefined();
    expect(container!.querySelector('.lg\\:hidden .grid-cols-2')).not.toBeNull();
  });
});
