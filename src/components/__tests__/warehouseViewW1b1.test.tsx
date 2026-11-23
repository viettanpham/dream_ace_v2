// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { ITEM_TEMPLATES } from '../../data/items';
import { generateItemInstance } from '../../engine/equipment';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import { soundFx } from '../../utils/sound';
import { HangarScreen } from '../HangarScreen';
import { SidebarNav } from '../SidebarNav';
import { WarehouseView } from '../WarehouseView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function createDeterministicRng(seed = 88): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const TPL_WEAPON = ITEM_TEMPLATES.find((t) => t.slot === 'main_weapon')!.id;
const TPL_ARMOR = ITEM_TEMPLATES.find((t) => t.slot === 'armor')!.id;

function makeItem(
  instanceId: string,
  opts: { slot?: 'main_weapon' | 'armor'; locked?: boolean; favorited?: boolean } = {}
) {
  const tplId = opts.slot === 'armor' ? TPL_ARMOR : TPL_WEAPON;
  const item = generateItemInstance(
    {
      templateId: tplId,
      tier: 1,
      rarity: 'rare',
      requiredLevel: 1,
      rollQuality: 74,
    },
    createDeterministicRng(instanceId.length * 31 + 7)
  );
  return {
    ...item,
    instanceId,
    locked: Boolean(opts.locked),
    favorited: Boolean(opts.favorited),
    isStarter: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().resetCampaign();
  useGameStore.setState({ language: 'vi' });
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
  if (container) {
    container.remove();
    container = null;
  }
  vi.restoreAllMocks();
});

describe('W1b-1 — KHO ĐỒ tab, "Hòm đồ" labels, battle/loop lock, basic WarehouseView', () => {
  it('1) SidebarNav renders 6 tabs with KHO ĐỒ / Warehouse right after GEAR and fits 6 truncated tabs in mobile bar', () => {
    act(() => {
      root!.render(createElement(SidebarNav));
    });

    const desktopWarehouse = container!.querySelector(
      '[data-testid="nav-desktop-warehouse"]'
    ) as HTMLButtonElement;
    const mobileWarehouse = container!.querySelector(
      '[data-testid="nav-mobile-warehouse"]'
    ) as HTMLButtonElement;
    expect(desktopWarehouse).not.toBeNull();
    expect(mobileWarehouse).not.toBeNull();
    expect(desktopWarehouse.textContent).toContain('KHO ĐỒ');
    expect(desktopWarehouse.disabled).toBe(false);

    const mobileGrid = container!.querySelector(
      'nav[aria-label="Mobile navigation"] > div'
    );
    expect(mobileGrid?.className).toContain('grid-cols-6');
    const mobileBtns = Array.from(mobileGrid!.querySelectorAll('button'));
    expect(mobileBtns).toHaveLength(6);
    expect(mobileBtns[0].getAttribute('data-testid')).toBe('nav-mobile-gear');
    expect(mobileBtns[1].getAttribute('data-testid')).toBe(
      'nav-mobile-warehouse'
    );
    for (const btn of mobileBtns) {
      expect(btn.className).toContain('min-w-0');
      expect(btn.querySelector('span.truncate')?.className).toContain(
        'whitespace-nowrap'
      );
    }

    act(() => {
      useGameStore.setState({ language: 'en' });
    });
    expect(desktopWarehouse.textContent).toContain('Warehouse');
  });

  it('2) disables KHO ĐỒ tab with "Chỉ dùng ở căn cứ" / "Base only" and blocks setActiveTab("warehouse") during active battle or active loop', () => {
    const clickSpy = vi.spyOn(soundFx, 'playClick');

    // Active battle
    useGameStore.getState().startBattle('border_outpost');
    act(() => {
      root!.render(createElement(SidebarNav));
    });

    const desktopWarehouse = container!.querySelector(
      '[data-testid="nav-desktop-warehouse"]'
    ) as HTMLButtonElement;
    const mobileWarehouse = container!.querySelector(
      '[data-testid="nav-mobile-warehouse"]'
    ) as HTMLButtonElement;

    expect(desktopWarehouse.disabled).toBe(true);
    expect(desktopWarehouse.className).toContain('opacity-45');
    expect(desktopWarehouse.title).toBe('Chỉ dùng ở căn cứ');
    expect(mobileWarehouse.disabled).toBe(true);
    expect(mobileWarehouse.title).toBe('Chỉ dùng ở căn cứ');

    useGameStore.getState().setActiveTab('warehouse');
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().activeTab).toBe('gear');
    expect(clickSpy).not.toHaveBeenCalled();

    // Outside active battle, during active loop
    act(() => {
      useGameStore.setState({
        screen: 'HANGAR',
        battle: null,
        activeTab: 'gear',
        language: 'en',
        autoRepeatSession: {
          active: true,
          limit: 5,
          sectorId: 'border_outpost',
          completedRuns: 1,
          wins: 1,
          consecutiveDefeats: 0,
          defeatStreakLimit: 3,
          totalExp: 40,
          totalCredits: 100,
          totalWarPoints: 5,
          totalDrops: [],
          stopReason: null,
        },
      });
    });

    expect(desktopWarehouse.disabled).toBe(true);
    expect(desktopWarehouse.title).toBe('Base only');
    useGameStore.getState().setActiveTab('warehouse');
    expect(useGameStore.getState().activeTab).toBe('gear');

    // End loop -> enabled and switches tab into HangarScreen
    act(() => {
      useGameStore.setState({
        autoRepeatSession: null,
      });
    });
    expect(desktopWarehouse.disabled).toBe(false);
    useGameStore.getState().setActiveTab('warehouse');
    expect(useGameStore.getState().activeTab).toBe('warehouse');

    act(() => {
      root!.render(createElement(HangarScreen));
    });
    expect(
      container!.querySelector('[data-testid="warehouse-view"]')
    ).not.toBeNull();
  });

  it('3) updates Cargo box ("Hòm đồ") i18n strings and keeps full vi/en key parity', () => {
    expect(VI_TRANSLATIONS['sidebar.warehouse']).toBe('KHO ĐỒ');
    expect(EN_TRANSLATIONS['sidebar.warehouse']).toBe('Warehouse');
    expect(VI_TRANSLATIONS['sidebar.warehouseBaseOnly']).toBe(
      'Chỉ dùng ở căn cứ'
    );
    expect(EN_TRANSLATIONS['sidebar.warehouseBaseOnly']).toBe('Base only');

    expect(VI_TRANSLATIONS['gear.gridHeading']).toBe('Hòm đồ');
    expect(EN_TRANSLATIONS['gear.gridHeading']).toBe('Cargo box');

    expect(VI_TRANSLATIONS['shop.cargoCount']).toBe('Hòm đồ: {count}/{max}');
    expect(EN_TRANSLATIONS['shop.cargoCount']).toBe('Cargo box: {count}/{max}');

    expect(VI_TRANSLATIONS['auto.repeatReason.inventory_full']).toBe(
      'Dừng: Hòm đồ đã đầy ({max} món)'
    );
    expect(EN_TRANSLATIONS['auto.repeatReason.inventory_full']).toBe(
      'Stopped: Cargo box full ({max} items)'
    );

    expect(VI_TRANSLATIONS['shop.wpBoughtOfferFeedback']).toContain(
      'mở Hòm đồ → Tiêu hao'
    );
    expect(EN_TRANSLATIONS['shop.wpBoughtOfferFeedback']).toContain(
      'Cargo box → Consumables'
    );

    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );
  });

  it('4) WarehouseView shows dynamic caps from BALANCE_CONFIG & adminConfig, blocks equipped items, supports single moves both ways, bulk move toast, slot filter, and mobile switch without nested scroll', () => {
    useGameStore.getState().startCampaign('WarehouseAce', 'striker');
    const eqItem = makeItem('wh_eq_1', { slot: 'main_weapon' });
    const freeWeapon = makeItem('wh_free_weapon', { slot: 'main_weapon' });
    const freeArmor = makeItem('wh_free_armor', { slot: 'armor' });
    const lockedItem = makeItem('wh_locked_1', { slot: 'armor', locked: true });
    const storedItem = makeItem('wh_stored_1', { slot: 'main_weapon' });

    useGameStore.setState((state) => ({
      language: 'vi',
      screen: 'HANGAR',
      activeTab: 'warehouse',
      pilot: {
        ...state.pilot,
        inventory: [eqItem, freeWeapon, freeArmor, lockedItem],
        warehouse: [storedItem],
        gears: {
          ...state.pilot.gears,
          striker: {
            ...state.pilot.gears.striker,
            equipped: {
              ...state.pilot.gears.striker.equipped,
              main_weapon: eqItem.instanceId,
            },
          },
        },
      },
      adminConfig: {
        ...state.adminConfig,
        warehouseCapacity: 420,
      },
    }));

    act(() => {
      root!.render(createElement(WarehouseView));
    });

    // Caps come from BALANCE_CONFIG.maxInventorySize & adminConfig.warehouseCapacity
    const boxHeading = container!.querySelector(
      '[data-testid="warehouse-box-heading"]'
    );
    const storageHeading = container!.querySelector(
      '[data-testid="warehouse-storage-heading"]'
    );
    expect(boxHeading?.textContent).toBe(
      `Hòm đồ 4/${BALANCE_CONFIG.maxInventorySize}`
    );
    expect(storageHeading?.textContent).toBe('Kho đồ 1/420');

    // No nested scroll box inside either panel
    const boxPanel = container!.querySelector(
      '[data-testid="warehouse-panel-box"]'
    )!;
    const whPanel = container!.querySelector(
      '[data-testid="warehouse-panel-warehouse"]'
    )!;
    expect(boxPanel.className).not.toContain('overflow-y-auto');
    expect(whPanel.className).not.toContain('overflow-y-auto');

    // Phone segmented switch toggles active panel
    const switchWhBtn = container!.querySelector(
      '[data-testid="warehouse-switch-warehouse"]'
    ) as HTMLButtonElement;
    expect(boxPanel.getAttribute('data-mobile-active')).toBe('true');
    act(() => {
      switchWhBtn.click();
    });
    expect(boxPanel.getAttribute('data-mobile-active')).toBe('false');
    expect(whPanel.getAttribute('data-mobile-active')).toBe('true');

    // Equipped item shows badge & cannot be moved from sheet
    const eqCell = container!.querySelector(
      '[data-testid="warehouse-cell-box-wh_eq_1"]'
    ) as HTMLButtonElement;
    expect(
      container!.querySelector('[data-testid="warehouse-equipped-badge-wh_eq_1"]')
    ).not.toBeNull();
    act(() => {
      eqCell.click();
    });
    const sheetMoveBtn = document.querySelector(
      '[data-testid="warehouse-sheet-move-btn"]'
    ) as HTMLButtonElement;
    expect(sheetMoveBtn.disabled).toBe(true);
    expect(
      document.querySelector('[data-testid="warehouse-sheet-equipped-reason"]')
    ).not.toBeNull();

    // Close sheet by clicking close button, then tap unequipped item and move to warehouse
    const closeBtn = document.querySelector(
      '[role="dialog"] button[aria-label]'
    ) as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });

    const freeWeaponCell = container!.querySelector(
      '[data-testid="warehouse-cell-box-wh_free_weapon"]'
    ) as HTMLButtonElement;
    act(() => {
      freeWeaponCell.click();
    });
    const moveToWhBtn = document.querySelector(
      '[data-testid="warehouse-sheet-move-btn"]'
    ) as HTMLButtonElement;
    expect(moveToWhBtn.disabled).toBe(false);
    expect(moveToWhBtn.textContent).toContain('Chuyển sang Kho');
    act(() => {
      moveToWhBtn.click();
    });

    expect(
      useGameStore
        .getState()
        .pilot.warehouse.map((i) => i.instanceId)
    ).toEqual(['wh_stored_1', 'wh_free_weapon']);
    expect(
      container!.querySelector('[data-testid="warehouse-toast"]')?.textContent
    ).toContain('Đã chuyển 1 món');

    // Move item back from Warehouse -> Box
    const storedCell = container!.querySelector(
      '[data-testid="warehouse-cell-warehouse-wh_stored_1"]'
    ) as HTMLButtonElement;
    act(() => {
      storedCell.click();
    });
    const moveToBoxBtn = document.querySelector(
      '[data-testid="warehouse-sheet-move-btn"]'
    ) as HTMLButtonElement;
    expect(moveToBoxBtn.textContent).toContain('Lấy ra Hòm');
    act(() => {
      moveToBoxBtn.click();
    });
    expect(
      useGameStore.getState().pilot.inventory.some((i) => i.instanceId === 'wh_stored_1')
    ).toBe(true);
    expect(
      container!.querySelector('[data-testid="warehouse-toast"]')?.textContent
    ).toContain('Đã chuyển 1 món');

    // Slot filter restricts visible cells
    const slotSelect = container!.querySelector(
      '[data-testid="warehouse-slot-filter"]'
    ) as HTMLSelectElement;
    act(() => {
      slotSelect.value = 'armor';
      slotSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(
      container!.querySelector('[data-testid="warehouse-cell-box-wh_free_armor"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="warehouse-cell-box-wh_eq_1"]')
    ).toBeNull();

    // Move all unused button shows exact count toast (1 moved: freeArmor + storedItem? Let's reset filter & see!)
    act(() => {
      slotSelect.value = 'all';
      slotSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Box currently has: eq_1 (equipped), free_armor (unequipped), locked_1 (protected), stored_1 (unequipped) -> 2 moved, 1 equipped, 1 locked
    const moveAllBtn = container!.querySelector(
      '[data-testid="warehouse-move-all-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      moveAllBtn.click();
    });
    const toast = container!.querySelector('[data-testid="warehouse-toast"]')
      ?.textContent;
    expect(toast).toContain('Đã chuyển 2 món');
    expect(toast).toContain('1 đang lắp');
    expect(toast).toContain('1 khóa/yêu thích');
  });
});
