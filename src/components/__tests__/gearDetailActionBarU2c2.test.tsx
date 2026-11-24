// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ITEM_TEMPLATES } from '../../data/items';
import { generateItemInstance } from '../../engine/equipment';
import { createFreshCampaignState } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import { GearView } from '../GearView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeInventoryWeapon(instanceId: string) {
  const tplId = ITEM_TEMPLATES.find((t) => t.slot === 'main_weapon')!.id;
  const inst = generateItemInstance(
    {
      templateId: tplId,
      tier: 1,
      rarity: 'rare',
      requiredLevel: 1,
      rollQuality: 85,
    },
    () => 0.5
  );
  return {
    ...inst,
    instanceId,
    locked: false,
    favorited: false,
    isStarter: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

function getDesktopDetailPanel(): HTMLElement {
  const panel = container!.querySelector('section.hidden.lg\\:flex.lg\\:col-span-5');
  expect(panel).not.toBeNull();
  return panel as HTMLElement;
}

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('PilotU2c2', 'striker'),
    language: 'en',
  });
  useGameStore.getState().startCampaign('PilotU2c2', 'striker');
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

describe('TASK U2c-2 — GEAR detail action bar moved to top under header', () => {
  it('1) with an inventory item selected, the equip button appears BEFORE the stat block in DOM order', () => {
    const spare = makeInventoryWeapon('inv_spare_u2c2');
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, spare],
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    const card = container!.querySelector(
      '[data-testid="inv-card-inv_spare_u2c2"]'
    ) as HTMLButtonElement;
    expect(card).not.toBeNull();
    act(() => {
      card.click();
    });

    const panel = getDesktopDetailPanel();
    const equipBtn = Array.from(panel.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Equip on')
    );
    const statBlock = Array.from(panel.querySelectorAll('div')).find(
      (d) =>
        d.className.includes('bg-[#080C14]') &&
        d.className.includes('space-y-2')
    );

    expect(equipBtn).toBeTruthy();
    expect(statBlock).toBeTruthy();
    const pos = equipBtn!.compareDocumentPosition(statBlock!);
    expect((pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it('2) with an equipped slot selected, Enchant and Unequip appear before the stat block and 2-step confirm works', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        credits: 5000,
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    const mainSlotBtn = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-main_weapon"]'
    ) as HTMLButtonElement;
    expect(mainSlotBtn).not.toBeNull();
    act(() => {
      mainSlotBtn.click();
    });

    const panel = getDesktopDetailPanel();
    const actionBar = panel.querySelector('.pb-3.border-b');
    expect(actionBar).not.toBeNull();
    const enchantBtn = Array.from(actionBar!.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Enchant to +')
    );
    const unequipBtn = Array.from(actionBar!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Unequip'
    );
    const statBlock = Array.from(panel.querySelectorAll('div')).find(
      (d) =>
        d.className.includes('bg-[#080C14]') &&
        d.className.includes('space-y-2')
    );

    expect(enchantBtn).toBeTruthy();
    expect(unequipBtn).toBeTruthy();
    expect(statBlock).toBeTruthy();
    expect(
      (enchantBtn!.compareDocumentPosition(statBlock!) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
    ).toBe(true);
    expect(
      (unequipBtn!.compareDocumentPosition(statBlock!) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
    ).toBe(true);

    // 2-step unequip confirm
    act(() => {
      unequipBtn!.click();
    });
    const confirmUnequipBtn = Array.from(
      panel.querySelectorAll('button')
    ).find((b) => b.textContent?.trim() === 'Confirm Unequip');
    expect(confirmUnequipBtn).toBeTruthy();

    act(() => {
      confirmUnequipBtn!.click();
    });
    expect(useGameStore.getState().pilot.gears.striker.equipped.main_weapon).toBeNull();
  });

  it('3) detail-unequip-shortcut, detail-lock-btn, detail-sell-btn are still found', () => {
    act(() => {
      root!.render(createElement(GearView));
    });

    const mainSlotBtn = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-main_weapon"]'
    ) as HTMLButtonElement;
    act(() => {
      mainSlotBtn.click();
    });

    const panel = getDesktopDetailPanel();
    expect(
      panel.querySelector('[data-testid="detail-unequip-shortcut"]')
    ).not.toBeNull();
    expect(
      panel.querySelector('[data-testid="detail-lock-btn"]')
    ).not.toBeNull();
    expect(
      panel.querySelector('[data-testid="detail-sell-btn"]')
    ).not.toBeNull();
  });

  it('4) old bottom bar is gone and the action bar container exists exactly once', () => {
    const spare = makeInventoryWeapon('inv_single_bar_u2c2');
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, spare],
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    const card = container!.querySelector(
      '[data-testid="inv-card-inv_single_bar_u2c2"]'
    ) as HTMLButtonElement;
    act(() => {
      card.click();
    });

    const panel = getDesktopDetailPanel();
    const oldBottomBars = panel.querySelectorAll('.border-t.pt-3');
    expect(oldBottomBars).toHaveLength(0);

    const actionBars = panel.querySelectorAll(
      '.flex.flex-wrap.items-center.gap-2.pb-3.border-b'
    );
    expect(actionBars).toHaveLength(1);
  });
});
