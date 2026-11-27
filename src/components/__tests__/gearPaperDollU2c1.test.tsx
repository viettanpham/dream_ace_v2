// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshCampaignState } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { ItemInstance } from '../../types/game';
import { GearSlotTile } from '../GearSlotTile';
import { GearView } from '../GearView';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeSampleInstance(overrides: Partial<ItemInstance> = {}): ItemInstance {
  return {
    instanceId: 'inst_test_1',
    templateId: 'mw_plasma_repeater',
    slot: 'main_weapon',
    rarity: 'epic',
    tier: 2,
    requiredLevel: 12,
    classRestriction: null,
    rollQuality: 91,
    rolledBaseStats: { attack: 18 },
    affixes: [],
    suffixId: null,
    price: 420,
    enchantLevel: 3,
    locked: false,
    favorited: false,
    ...overrides,
  };
}

beforeEach(() => {
  useGameStore.setState({
    ...createFreshCampaignState('PilotPaper', 'striker'),
    language: 'en',
  });
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
  if (container) {
    container.remove();
    container = null;
  }
});

describe('TASK U2c-1 — GEAR 12-slot paper-doll', () => {
  it('1) GearSlotTile renders empty, filled, selected, and locked states', () => {
    const inst = makeSampleInstance();

    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(GearSlotTile, {
            slotKey: 'cpu',
            label: 'CPU',
            variant: 'desktop',
          }),
          createElement(GearSlotTile, {
            slotKey: 'main_weapon',
            label: 'MAIN',
            instance: inst,
            itemName: 'Plasma Repeater',
            variant: 'phone',
          }),
          createElement(GearSlotTile, {
            slotKey: 'sub_weapon',
            label: 'SUB',
            instance: inst,
            selected: true,
            variant: 'desktop',
          }),
          createElement(GearSlotTile, {
            slotKey: 'radar',
            label: 'Radar',
            locked: true,
            lockedLabel: 'Soon',
            title: 'Radar — Soon',
            variant: 'desktop',
          })
        )
      );
    });

    const emptyTile = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-cpu"]'
    ) as HTMLButtonElement;
    expect(emptyTile).not.toBeNull();
    expect(emptyTile.textContent).toContain('CPU');
    expect(emptyTile.textContent).toContain('—');
    expect(emptyTile.disabled).toBe(false);

    const filledPhone = container!.querySelector(
      '[data-testid="gear-slot-tile-phone-main_weapon"]'
    ) as HTMLButtonElement;
    expect(filledPhone.textContent).toContain('Plasma Repeater');
    expect(filledPhone.textContent).toContain('+3');

    const selectedTile = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-sub_weapon"]'
    ) as HTMLButtonElement;
    expect(selectedTile.className).toContain('border-sky-400');
    expect(selectedTile.className).toContain('bg-sky-500/15');

    const lockedTile = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-radar"]'
    ) as HTMLButtonElement;
    expect(lockedTile.disabled).toBe(true);
    expect(lockedTile.getAttribute('data-locked')).toBe('true');
    expect(lockedTile.className).toContain('opacity-55');
    expect(lockedTile.textContent).toContain('Soon');
  });

  it('2) slot order is left [main_weapon, radar, cpu, armor, ext2, ext4] and right [sub_weapon, accessory, engine, ext1, ext3, ext5]', () => {
    useGameStore.getState().startCampaign('PilotOrder', 'striker');

    act(() => {
      root!.render(createElement(GearView));
    });

    const getOrder = (testId: string) =>
      Array.from(
        container!.querySelectorAll(`[data-testid="${testId}"] [data-slot-key]`)
      ).map((el) => el.getAttribute('data-slot-key'));

    expect(getOrder('gear-rail-left')).toEqual([
      'main_weapon',
      'radar',
      'cpu',
      'armor',
      'ext2',
      'ext4',
    ]);
    expect(getOrder('gear-rail-right')).toEqual([
      'sub_weapon',
      'accessory',
      'engine',
      'ext1',
      'ext3',
      'ext5',
    ]);
    expect(getOrder('gear-phone-left')).toEqual([
      'main_weapon',
      'radar',
      'cpu',
      'armor',
      'ext2',
      'ext4',
    ]);
    expect(getOrder('gear-phone-right')).toEqual([
      'sub_weapon',
      'accessory',
      'engine',
      'ext1',
      'ext3',
      'ext5',
    ]);
  });

  it('3) clicking a live tile triggers selection, clicking a locked tile does nothing', () => {
    const onLive = vi.fn();
    const onLocked = vi.fn();
    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(GearSlotTile, {
            slotKey: 'main_weapon',
            label: 'MAIN',
            onSelect: onLive,
            variant: 'desktop',
          }),
          createElement(GearSlotTile, {
            slotKey: 'ext1',
            label: 'Ext 1',
            locked: true,
            lockedLabel: 'Soon',
            onSelect: onLocked,
            variant: 'desktop',
          })
        )
      );
    });

    (
      container!.querySelector(
        '[data-testid="gear-slot-tile-desktop-main_weapon"]'
      ) as HTMLButtonElement
    ).click();
    (
      container!.querySelector(
        '[data-testid="gear-slot-tile-desktop-ext1"]'
      ) as HTMLButtonElement
    ).click();
    expect(onLive).toHaveBeenCalledTimes(1);
    expect(onLocked).not.toHaveBeenCalled();

    // Also verify live click inside full GearView preserves slot selection & locked click is inert
    useGameStore.getState().startCampaign('PilotClick', 'striker');
    act(() => {
      root!.render(createElement(GearView));
    });

    const radarBtn = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-radar"]'
    ) as HTMLButtonElement;
    act(() => {
      radarBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="detail-unequip-shortcut"]')
    ).toBeNull();

    const mainBtn = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-main_weapon"]'
    ) as HTMLButtonElement;
    act(() => {
      mainBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="detail-unequip-shortcut"]')
    ).not.toBeNull();
    expect(mainBtn.className).toContain('border-sky-400');
  });

  it('4) slot-starter-badge-main_weapon is still found with Starter text', () => {
    useGameStore.getState().startCampaign('PilotStarterBadge', 'striker');

    act(() => {
      root!.render(createElement(GearView));
    });

    const badge = container!.querySelector(
      '[data-testid="slot-starter-badge-main_weapon"]'
    );
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('Starter');
  });

  it('5) old 3-column 6-tile block is gone and phone uses 2 vertical columns of 6', () => {
    useGameStore.getState().startCampaign('PilotNo3Col', 'striker');

    act(() => {
      root!.render(createElement(GearView));
    });

    const phoneSlots = container!.querySelector(
      '[data-testid="gear-phone-slots"]'
    );
    expect(phoneSlots).not.toBeNull();
    expect(phoneSlots!.querySelector('.grid-cols-3')).toBeNull();
    expect(phoneSlots!.querySelector('.grid-cols-2')).not.toBeNull();
    expect(phoneSlots!.querySelectorAll('[data-slot-key]')).toHaveLength(12);

    // Ensure no equipment slot tile anywhere sits inside a 3-column grid
    for (const tile of Array.from(
      container!.querySelectorAll('[data-slot-key]')
    )) {
      expect(tile.closest('.grid-cols-3')).toBeNull();
    }
  });
});
