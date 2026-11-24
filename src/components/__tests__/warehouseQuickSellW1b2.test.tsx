// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { ITEM_TEMPLATES } from '../../data/items';
import { generateItemInstance, getSellPrice } from '../../engine/equipment';
import {
  evaluateQuickSellCandidates,
  evaluateQuickSellCandidatesWithSources,
} from '../../engine/quickSell';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { ItemInstance, ItemRarity } from '../../types/game';
import { QuickSellModal } from '../QuickSellModal';
import { WarehouseView } from '../WarehouseView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function createDeterministicRng(seed = 1337): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const TPL_WEAPON = ITEM_TEMPLATES.find((t) => t.slot === 'main_weapon')!.id;
const TPL_ARMOR = ITEM_TEMPLATES.find((t) => t.slot === 'armor')!.id;

function makeTestItem(
  instanceId: string,
  opts: {
    slot?: 'main_weapon' | 'armor';
    rarity?: ItemRarity;
    locked?: boolean;
    favorited?: boolean;
  } = {}
): ItemInstance {
  const tplId = opts.slot === 'armor' ? TPL_ARMOR : TPL_WEAPON;
  const item = generateItemInstance(
    {
      templateId: tplId,
      tier: 1,
      rarity: opts.rarity ?? 'common',
      requiredLevel: 1,
      rollQuality: 72,
    },
    createDeterministicRng(instanceId.length * 41 + 9)
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

function setSelectValue(el: HTMLSelectElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value'
  )?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
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
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
});

describe('W1b-2 — Warehouse multi-select bulk move, Quick Sell sources & undo, label sweep', () => {
  it('1) toggles multi-select mode, ticks/unticks items (including locked/favorited), selects all in filter, clears on filter/panel change', () => {
    const state = useGameStore.getState();
    const activeGear = state.pilot.gears[state.pilot.activeGearId];
    const eqId = activeGear.equipped.main_weapon!;
    const eqItem = state.pilot.inventory.find((i) => i.instanceId === eqId)!;

    const wLocked = makeTestItem('box_w_locked', {
      slot: 'main_weapon',
      locked: true,
    });
    const aFav = makeTestItem('box_a_fav', {
      slot: 'armor',
      favorited: true,
    });
    const aPlain = makeTestItem('box_a_plain', { slot: 'armor' });

    useGameStore.setState({
      pilot: {
        ...state.pilot,
        inventory: [eqItem, wLocked, aFav, aPlain],
        warehouse: [],
      },
    });

    act(() => {
      root!.render(createElement(WarehouseView));
    });

    const toggleBtn = container!.querySelector(
      '[data-testid="warehouse-multiselect-btn-box"]'
    ) as HTMLButtonElement;
    expect(toggleBtn.textContent).toContain('Chọn nhiều');

    // Toggle ON selection mode
    act(() => {
      toggleBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="warehouse-selection-bar-box"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 0');

    // Tap locked item and favorited item -> both CAN be ticked
    const lockedCell = container!.querySelector(
      '[data-testid="warehouse-cell-box-box_w_locked"]'
    ) as HTMLButtonElement;
    const favCell = container!.querySelector(
      '[data-testid="warehouse-cell-box-box_a_fav"]'
    ) as HTMLButtonElement;

    act(() => {
      lockedCell.click();
    });
    expect(lockedCell.getAttribute('data-selected')).toBe('true');
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 1');

    act(() => {
      favCell.click();
    });
    expect(favCell.getAttribute('data-selected')).toBe('true');
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 2');

    // Untick locked item
    act(() => {
      lockedCell.click();
    });
    expect(lockedCell.getAttribute('data-selected')).toBe('false');
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 1');

    // Changing slot filter clears selection
    const slotSelect = container!.querySelector(
      '[data-testid="warehouse-slot-filter"]'
    ) as HTMLSelectElement;
    act(() => {
      setSelectValue(slotSelect, 'armor');
    });
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 0');

    // Select all (filtered -> only armor items, never main_weapon)
    const selectAllBtn = container!.querySelector(
      '[data-testid="warehouse-select-all-btn-box"]'
    ) as HTMLButtonElement;
    act(() => {
      selectAllBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 2');

    // Clear selection button clears all
    const clearBtn = container!.querySelector(
      '[data-testid="warehouse-clear-select-btn-box"]'
    ) as HTMLButtonElement;
    act(() => {
      clearBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 0');

    // Re-select then change mobile panel -> clears selection and mode
    act(() => {
      selectAllBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 2');
    const switchWarehouseBtn = container!.querySelector(
      '[data-testid="warehouse-switch-warehouse"]'
    ) as HTMLButtonElement;
    act(() => {
      switchWarehouseBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="warehouse-selection-bar-box"]')
    ).toBeNull();
  });

  it('2) equipped items cannot be ticked (dimmed + reason on tap), bulk moves work both ways in tap order respecting caps and counts', () => {
    const state = useGameStore.getState();
    const activeGear = state.pilot.gears[state.pilot.activeGearId];
    const eqId = activeGear.equipped.main_weapon!;
    const eqItem = state.pilot.inventory.find((i) => i.instanceId === eqId)!;

    // Pre-fill warehouse to 49/50 capacity so only 1 item fits from Box -> Warehouse
    const whExisting = Array.from({ length: 49 }, (_, i) =>
      makeTestItem(`wh_fill_${i}`)
    );
    const b1 = makeTestItem('box_first_in_list');
    const b2 = makeTestItem('box_second_picked_first', { locked: true });

    useGameStore.setState({
      adminConfig: { ...state.adminConfig, warehouseCapacity: 50 },
      pilot: {
        ...state.pilot,
        inventory: [eqItem, b1, b2],
        warehouse: whExisting,
      },
    });

    act(() => {
      root!.render(createElement(WarehouseView));
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-multiselect-btn-box"]'
        ) as HTMLButtonElement
      ).click();
    });

    // Equipped cell is dimmed and not tickable; tapping shows reason
    const eqCell = container!.querySelector(
      `[data-testid="warehouse-cell-box-${eqId}"]`
    ) as HTMLButtonElement;
    expect(eqCell.getAttribute('data-selection-blocked')).toBe('true');
    expect(eqCell.className).toContain('opacity-45');

    act(() => {
      eqCell.click();
    });
    expect(eqCell.getAttribute('data-selected')).toBe('false');
    expect(
      container!.querySelector('[data-testid="warehouse-toast"]')?.textContent
    ).toContain('không thể chọn');
    expect(
      container!.querySelector('[data-testid="warehouse-selected-count-box"]')
        ?.textContent
    ).toBe('Đã chọn 0');

    // Tap b2 first, then b1 -> tap order [b2, b1]
    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-cell-box-box_second_picked_first"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-cell-box-box_first_in_list"]'
        ) as HTMLButtonElement
      ).click();
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-bulk-move-btn-box"]'
        ) as HTMLButtonElement
      ).click();
    });

    // Cap 50 reached: b2 moved (even though locked!), b1 stayed; toast reflects 1 moved + 1 skippedFull
    const afterBoxToWh = useGameStore.getState();
    expect(afterBoxToWh.pilot.warehouse).toHaveLength(50);
    expect(
      afterBoxToWh.pilot.warehouse.some(
        (i) => i.instanceId === 'box_second_picked_first'
      )
    ).toBe(true);
    expect(
      afterBoxToWh.pilot.inventory.some((i) => i.instanceId === 'box_first_in_list')
    ).toBe(true);
    const toastAfter1 = container!.querySelector(
      '[data-testid="warehouse-toast"]'
    )?.textContent;
    expect(toastAfter1).toContain('Đã chuyển 1 món');
    expect(toastAfter1).toContain('1 không đủ chỗ');
    expect(
      container!.querySelector('[data-testid="warehouse-selection-bar-box"]')
    ).toBeNull();

    // Now test Warehouse -> Box with Box nearly full (maxInventorySize - 1 items)
    const boxFillerCount = BALANCE_CONFIG.maxInventorySize - 1;
    const boxFillers = [
      eqItem,
      ...Array.from({ length: boxFillerCount - 1 }, (_, i) =>
        makeTestItem(`box_cap_${i}`)
      ),
    ];
    const whTakeA = makeTestItem('wh_take_a', { favorited: true });
    const whTakeB = makeTestItem('wh_take_b');
    useGameStore.setState({
      pilot: {
        ...afterBoxToWh.pilot,
        inventory: boxFillers,
        warehouse: [whTakeA, whTakeB],
      },
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-multiselect-btn-warehouse"]'
        ) as HTMLButtonElement
      ).click();
    });

    // Tap whTakeB first, then whTakeA -> only 1 slot free in box so whTakeB moves first
    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-cell-warehouse-wh_take_b"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-cell-warehouse-wh_take_a"]'
        ) as HTMLButtonElement
      ).click();
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="warehouse-bulk-move-btn-warehouse"]'
        ) as HTMLButtonElement
      ).click();
    });

    const afterWhToBox = useGameStore.getState();
    expect(afterWhToBox.pilot.inventory).toHaveLength(
      BALANCE_CONFIG.maxInventorySize
    );
    expect(
      afterWhToBox.pilot.inventory.some((i) => i.instanceId === 'wh_take_b')
    ).toBe(true);
    expect(
      afterWhToBox.pilot.warehouse.some((i) => i.instanceId === 'wh_take_a')
    ).toBe(true);
    const toastAfter2 = container!.querySelector(
      '[data-testid="warehouse-toast"]'
    )?.textContent;
    expect(toastAfter2).toContain('Đã chuyển 1 món');
    expect(toastAfter2).toContain('1 không đủ chỗ');
  });

  it('3) Quick Sell with only Hòm đồ checked equals old result; ticking Kho đồ sells warehouse items, skips protected, and Undo restores each item to its own array', () => {
    const state = useGameStore.getState();
    const activeGear = state.pilot.gears[state.pilot.activeGearId];
    const eqId = activeGear.equipped.main_weapon!;
    const eqItem = state.pilot.inventory.find((i) => i.instanceId === eqId)!;

    const boxJunk = makeTestItem('qs_box_junk', { rarity: 'common' });
    const boxLocked = makeTestItem('qs_box_locked', {
      rarity: 'common',
      locked: true,
    });
    const whJunk = makeTestItem('qs_wh_junk', { rarity: 'common' });
    const whFav = makeTestItem('qs_wh_fav', {
      rarity: 'common',
      favorited: true,
    });
    const whLocked = makeTestItem('qs_wh_locked', {
      rarity: 'common',
      locked: true,
    });

    const cfg = {
      ...state.quickSellConfig,
      maxRarity: 'common' as const,
      maxTier: null,
      maxRequiredLevel: null,
      belowEquippedLevel: false,
      maxSellValue: null,
      maxRollQuality: null,
      worseThanEquipped: false,
    };

    const boxArr = [eqItem, boxJunk, boxLocked];
    const whArr = [whJunk, whFav, whLocked];

    // Hard Limit: Hòm đồ only produces identical results to legacy evaluateQuickSellCandidates
    const legacyRes = evaluateQuickSellCandidates(
      boxArr,
      cfg,
      activeGear,
      state.pilot.gears
    );
    const boxOnlyRes = evaluateQuickSellCandidatesWithSources(
      boxArr,
      whArr,
      { box: true, warehouse: false },
      cfg,
      activeGear,
      state.pilot.gears
    );
    expect(boxOnlyRes.matchingItems).toEqual(legacyRes.matchingItems);
    expect(boxOnlyRes.totalCredits).toBe(legacyRes.totalCredits);
    expect(boxOnlyRes.excludedStats).toEqual(legacyRes.excludedStats);
    expect(boxOnlyRes.hasAnyFilterEnabled).toBe(legacyRes.hasAnyFilterEnabled);

    const startCredits = 1000;
    useGameStore.setState({
      pilot: {
        ...state.pilot,
        credits: startCredits,
        inventory: boxArr,
        warehouse: whArr,
      },
      quickSellConfig: cfg,
    });

    const onSold = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        createElement(QuickSellModal, { open: true, onClose, onSold })
      );
    });

    const boxCheckbox = container!.querySelector(
      '[data-testid="quicksell-source-box"]'
    ) as HTMLInputElement;
    const whCheckbox = container!.querySelector(
      '[data-testid="quicksell-source-warehouse"]'
    ) as HTMLInputElement;

    expect(boxCheckbox.checked).toBe(true);
    expect(whCheckbox.checked).toBe(false);

    // Only box junk in preview initially
    expect(
      container!.querySelector('[data-testid="quicksell-row-source-qs_box_junk"]')
        ?.textContent
    ).toBe('Hòm đồ');
    expect(
      container!.querySelector('[data-testid="quicksell-preview-row-qs_wh_junk"]')
    ).toBeNull();

    // Check Kho đồ -> both appear with own source labels; protected items excluded
    act(() => {
      whCheckbox.click();
    });
    expect(
      container!.querySelector('[data-testid="quicksell-row-source-qs_wh_junk"]')
        ?.textContent
    ).toBe('Kho đồ');
    expect(
      container!.querySelector('[data-testid="quicksell-preview-row-qs_wh_fav"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="quicksell-preview-row-qs_wh_locked"]')
    ).toBeNull();

    // Execute Quick Sell
    act(() => {
      (
        container!.querySelector(
          '[data-testid="quicksell-open-confirm"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="quicksell-confirm-execute"]'
        ) as HTMLButtonElement
      ).click();
    });

    const expectedEarned = getSellPrice(boxJunk) + getSellPrice(whJunk);
    expect(onSold).toHaveBeenCalledWith(2, expectedEarned, expect.any(Number));
    expect(onClose).toHaveBeenCalled();

    const afterSell = useGameStore.getState();
    expect(afterSell.pilot.credits).toBe(startCredits + expectedEarned);
    expect(
      afterSell.pilot.inventory.map((i) => i.instanceId)
    ).not.toContain('qs_box_junk');
    expect(afterSell.pilot.inventory.map((i) => i.instanceId)).toContain(
      'qs_box_locked'
    );
    expect(
      afterSell.pilot.warehouse.map((i) => i.instanceId)
    ).not.toContain('qs_wh_junk');
    expect(afterSell.pilot.warehouse.map((i) => i.instanceId)).toEqual(
      expect.arrayContaining(['qs_wh_fav', 'qs_wh_locked'])
    );
    expect(afterSell.quickSellUndo?.soldFromWarehouseIds).toEqual([
      'qs_wh_junk',
    ]);

    // Undo restores each item strictly back to its OWN array + exact credits
    const undoRes = useGameStore.getState().undoQuickSell();
    expect(undoRes).toEqual({ ok: true, restoredCount: 2 });

    const afterUndo = useGameStore.getState();
    expect(afterUndo.pilot.credits).toBe(startCredits);
    expect(afterUndo.pilot.inventory.map((i) => i.instanceId)).toContain(
      'qs_box_junk'
    );
    expect(
      afterUndo.pilot.inventory.map((i) => i.instanceId)
    ).not.toContain('qs_wh_junk');
    expect(afterUndo.pilot.warehouse.map((i) => i.instanceId)).toContain(
      'qs_wh_junk'
    );
    expect(
      afterUndo.pilot.warehouse.map((i) => i.instanceId)
    ).not.toContain('qs_box_junk');
    expect(afterUndo.quickSellUndo).toBeNull();
  });

  it('4) hides Kho đồ checkbox when warehouse is empty and blocks warehouse quick-sell during active battle or auto-repeat loop', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      pilot: {
        ...state.pilot,
        warehouse: [],
      },
    });

    act(() => {
      root!.render(
        createElement(QuickSellModal, {
          open: true,
          onClose: vi.fn(),
        })
      );
    });
    expect(
      container!.querySelector('[data-testid="quicksell-source-box"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="quicksell-source-warehouse"]')
    ).toBeNull();

    // Now add warehouse junk and enter active loop
    const whJunk = makeTestItem('qs_loop_wh_junk', { rarity: 'common' });
    useGameStore.setState({
      pilot: {
        ...useGameStore.getState().pilot,
        warehouse: [whJunk],
      },
      quickSellConfig: {
        ...useGameStore.getState().quickSellConfig,
        maxRarity: 'common',
      },
      autoRepeatSession: {
        active: true,
        limit: 5,
        sectorId: 'border_outpost',
        completedRuns: 1,
        wins: 1,
        consecutiveDefeats: 0,
        defeatStreakLimit: 3,
        totalExp: 10,
        totalCredits: 50,
        totalWarPoints: 2,
        totalDrops: [],
        stopReason: null,
      },
    });

    act(() => {
      root!.render(
        createElement(QuickSellModal, {
          open: true,
          onClose: vi.fn(),
        })
      );
    });

    const whCheckbox = container!.querySelector(
      '[data-testid="quicksell-source-warehouse"]'
    ) as HTMLInputElement;
    expect(whCheckbox).not.toBeNull();

    act(() => {
      whCheckbox.click();
    });

    const blockedBanner = container!.querySelector(
      '[data-testid="quicksell-warehouse-blocked-reason"]'
    );
    expect(blockedBanner).not.toBeNull();
    expect(blockedBanner?.textContent).toContain('Kho đồ');

    const confirmBtn = container!.querySelector(
      '[data-testid="quicksell-open-confirm"]'
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    // Store guard also blocks selling warehouse item during loop or battle
    const loopSellRes = useGameStore
      .getState()
      .executeQuickSell(['qs_loop_wh_junk']);
    expect(loopSellRes).toEqual({ soldCount: 0, creditsEarned: 0 });
    expect(useGameStore.getState().pilot.warehouse).toHaveLength(1);

    // Active battle guard
    useGameStore.setState({ autoRepeatSession: null });
    useGameStore.getState().startBattle('border_outpost');
    const battleSellRes = useGameStore
      .getState()
      .executeQuickSell(['qs_loop_wh_junk']);
    expect(battleSellRes).toEqual({ soldCount: 0, creditsEarned: 0 });
    expect(useGameStore.getState().pilot.warehouse).toHaveLength(1);
  });

  it('5) sweeps old box wording out of vi.ts/en.ts while preserving warehouse.* strings and 100% vi/en key parity', () => {
    // Swept shared box labels
    expect(VI_TRANSLATIONS['gear.inCargo']).toBe('Trong Hòm đồ');
    expect(EN_TRANSLATIONS['gear.inCargo']).toBe('In Cargo box');
    expect(VI_TRANSLATIONS['gear.emptyDetailDesc']).toContain('Hòm đồ');
    expect(EN_TRANSLATIONS['gear.emptyDetailDesc']).toContain('Cargo box');
    expect(VI_TRANSLATIONS['shop.tabSell']).toBe('Bán từ Hòm đồ ({count})');
    expect(EN_TRANSLATIONS['shop.tabSell']).toBe('Sell Cargo box ({count})');
    expect(VI_TRANSLATIONS['shop.cargoFullTag']).toBe('Hòm đồ đầy ({count}/{max})');
    expect(EN_TRANSLATIONS['shop.cargoFullTag']).toBe('Cargo box Full ({count}/{max})');
    expect(VI_TRANSLATIONS['shop.cargoFullBtn']).toBe('Hòm đồ đã đầy');
    expect(EN_TRANSLATIONS['shop.cargoFullBtn']).toBe('Cargo box Full');
    expect(VI_TRANSLATIONS['equip.inventoryEmpty']).toContain('Hòm đồ');
    expect(EN_TRANSLATIONS['equip.inventoryEmpty']).toContain('Cargo box');
    expect(VI_TRANSLATIONS['shop.boughtMsg']).toContain('Hòm đồ');
    expect(EN_TRANSLATIONS['shop.boughtMsg']).toContain('Cargo box');

    // No stale shared-cargo terms left anywhere in user-facing translations (outside warehouse.* / qs.*Warehouse*)
    for (const [key, val] of Object.entries(VI_TRANSLATIONS)) {
      if (
        key.startsWith('warehouse.') ||
        key.startsWith('sidebar.warehouse') ||
        key.startsWith('qs.') ||
        key === 'admin.warehouseCapacity'
      ) {
        continue;
      }
      expect(val).not.toMatch(/Kho chung|kho chung|Kho đồ chung|Bán từ Kho|Kho đầy|Kho đã đầy/);
      expect(val).not.toContain('Kho đồ');
    }
    for (const [key, val] of Object.entries(EN_TRANSLATIONS)) {
      if (key.startsWith('warehouse.') || key.startsWith('sidebar.warehouse') || key.startsWith('qs.')) {
        continue;
      }
      expect(val).not.toMatch(/Shared Cargo|Shared cargo|In Shared Cargo|Sell Cargo(?! box)|Cargo Full/);
    }

    // warehouse.* strings kept intact
    expect(VI_TRANSLATIONS['warehouse.storageHeading']).toBe('Kho đồ {count}/{max}');
    expect(EN_TRANSLATIONS['warehouse.storageHeading']).toBe('Warehouse {count}/{max}');

    // Exact vi/en key parity
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
  });
});
