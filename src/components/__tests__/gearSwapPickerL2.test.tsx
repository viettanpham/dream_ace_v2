// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TEMPLATES } from '../../data/items';
import { generateItemInstance } from '../../engine/equipment';
import { createFreshCampaignState } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { EquipmentSlot, ItemInstance, ItemRarity } from '../../types/game';
import { GearView } from '../GearView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeItem(
  instanceId: string,
  slot: EquipmentSlot,
  opts: {
    rarity?: ItemRarity;
    requiredLevel?: number;
    classRestriction?: ItemInstance['classRestriction'];
  } = {}
): ItemInstance {
  const tpl = ITEM_TEMPLATES.find((t) => t.slot === slot)!;
  const inst = generateItemInstance(
    {
      templateId: tpl.id,
      tier: 1,
      rarity: opts.rarity ?? 'rare',
      requiredLevel: opts.requiredLevel ?? 1,
      rollQuality: 80,
    },
    () => 0.5
  );
  return {
    ...inst,
    instanceId,
    classRestriction:
      opts.classRestriction !== undefined
        ? opts.classRestriction
        : inst.classRestriction,
    locked: false,
    favorited: false,
    isStarter: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

function getDesktopDetail(): HTMLElement {
  return container!.querySelector(
    'section.hidden.lg\\:flex.lg\\:col-span-5'
  ) as HTMLElement;
}

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('PilotL2', 'striker'),
    language: 'vi',
  });
  useGameStore.getState().startCampaign('PilotL2', 'striker');
  useGameStore.getState().setLanguage('vi');
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

describe('TASK GEAR-L2 — Quick swap & empty-slot pick modal', () => {
  it('1) detail-swap-btn opens picker listing only same-slot items, best first, excluding currently equipped one', () => {
    const spareCommon = makeItem('inv_mw_common', 'main_weapon', {
      rarity: 'common',
      requiredLevel: 1,
    });
    const spareEpic = makeItem('inv_mw_epic', 'main_weapon', {
      rarity: 'epic',
      requiredLevel: 1,
    });
    const spareArmor = makeItem('inv_arm_legend', 'armor', {
      rarity: 'legendary',
      requiredLevel: 1,
    });

    const state = useGameStore.getState();
    const equippedId = state.pilot.gears.striker.equipped.main_weapon!;
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, spareCommon, spareEpic, spareArmor],
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    const slotBtn = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-main_weapon"]'
    ) as HTMLButtonElement;
    act(() => {
      slotBtn.click();
    });

    const swapBtn = getDesktopDetail().querySelector(
      '[data-testid="detail-swap-btn"]'
    ) as HTMLButtonElement;
    expect(swapBtn).not.toBeNull();

    act(() => {
      swapBtn.click();
    });

    const picker = container!.querySelector(
      '[data-testid="gear-swap-picker"]'
    ) as HTMLElement;
    expect(picker).not.toBeNull();

    const rows = Array.from(
      picker.querySelectorAll('[data-testid^="gear-swap-row-"]')
    ).map((el) => el.getAttribute('data-testid'));
    expect(rows).not.toContain(`gear-swap-row-${equippedId}`);
    expect(rows).not.toContain('gear-swap-row-inv_arm_legend');
    expect(rows[0]).toBe('gear-swap-row-inv_mw_epic');
    expect(rows).toContain('gear-swap-row-inv_mw_common');
  });

  it('2) clicking a row equip button calls equipItem and closes the picker', () => {
    const spare = makeItem('inv_mw_swap_ok', 'main_weapon', {
      rarity: 'epic',
      requiredLevel: 1,
    });
    const equipSpy = vi.spyOn(useGameStore.getState(), 'equipItem');
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

    act(() => {
      (
        container!.querySelector(
          '[data-testid="gear-slot-tile-desktop-main_weapon"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        getDesktopDetail().querySelector(
          '[data-testid="detail-swap-btn"]'
        ) as HTMLButtonElement
      ).click();
    });

    const equipBtn = container!.querySelector(
      '[data-testid="gear-swap-equip-inv_mw_swap_ok"]'
    ) as HTMLButtonElement;
    expect(equipBtn).not.toBeNull();
    expect(equipBtn.disabled).toBe(false);

    act(() => {
      equipBtn.click();
    });

    expect(equipSpy).toHaveBeenCalledWith('inv_mw_swap_ok');
    expect(
      container!.querySelector('[data-testid="gear-swap-picker"]')
    ).toBeNull();
    expect(useGameStore.getState().pilot.gears.striker.equipped.main_weapon).toBe(
      'inv_mw_swap_ok'
    );
  });

  it('3) unusable row is dimmed with validation reason and disabled equip button', () => {
    const highLevelWeapon = makeItem('inv_mw_highlvl', 'main_weapon', {
      rarity: 'legendary',
      requiredLevel: 40,
    });
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, highLevelWeapon],
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="gear-slot-tile-desktop-main_weapon"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        getDesktopDetail().querySelector(
          '[data-testid="detail-swap-btn"]'
        ) as HTMLButtonElement
      ).click();
    });

    const row = container!.querySelector(
      '[data-testid="gear-swap-row-inv_mw_highlvl"]'
    ) as HTMLElement;
    const reason = container!.querySelector(
      '[data-testid="gear-swap-reason-inv_mw_highlvl"]'
    ) as HTMLElement;
    const equipBtn = container!.querySelector(
      '[data-testid="gear-swap-equip-inv_mw_highlvl"]'
    ) as HTMLButtonElement;

    expect(row.className).toContain('opacity-55');
    expect(reason.textContent).toContain('Lv.40');
    expect(equipBtn.disabled).toBe(true);
  });

  it('4) clicking an empty slot shows detail-pick-btn and opening picker shows empty list text when nothing fits', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        inventory: s.pilot.inventory.filter((it) => it.slot !== 'radar'),
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="gear-slot-tile-desktop-radar"]'
        ) as HTMLButtonElement
      ).click();
    });

    const pickBtn = getDesktopDetail().querySelector(
      '[data-testid="detail-pick-btn"]'
    ) as HTMLButtonElement;
    expect(pickBtn).not.toBeNull();

    act(() => {
      pickBtn.click();
    });

    const emptyMsg = container!.querySelector(
      '[data-testid="gear-swap-empty"]'
    ) as HTMLElement;
    expect(emptyMsg).not.toBeNull();
    expect(emptyMsg.textContent).toContain('Không có trang bị phù hợp trong kho');
  });
});
