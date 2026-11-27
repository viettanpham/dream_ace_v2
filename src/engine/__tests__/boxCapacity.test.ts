// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ShopScreen } from '../../components/ShopScreen';
import { WarehouseView } from '../../components/WarehouseView';
import { ITEM_TEMPLATES } from '../../data/items';
import { useGameStore } from '../../store/useGameStore';
import type { ShopItemListing } from '../../types/game';
import { generateItemInstance } from '../equipment';
import {
  CURRENT_SAVE_VERSION,
  DEFAULT_BOX_CAPACITY,
  DEFAULT_WAREHOUSE_CAPACITY,
  MAX_BOX_CAPACITY,
  MIN_BOX_CAPACITY,
  createDefaultAdminConfig,
  getBoxCapacity,
  migrateSaveData,
  sanitizeBoxCapacity,
} from '../migration';
import { createDefaultPilotAccount } from '../stats';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeTestItem(instanceId: string) {
  const tplId = ITEM_TEMPLATES.find((t) => t.slot === 'main_weapon')!.id;
  const item = generateItemInstance(
    { templateId: tplId, tier: 1, rarity: 'rare', requiredLevel: 1, rollQuality: 70 },
    () => 0.5
  );
  return {
    ...item,
    instanceId,
    locked: false,
    favorited: false,
    isStarter: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().resetCampaign();
  useGameStore.getState().startCampaign('BoxTester', 'striker');
  useGameStore.getState().setLanguage('vi');
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

describe('BOX1 — configurable Hòm đồ & Kho đồ capacity', () => {
  it('1) sanitizeBoxCapacity handles defaults, clamps, non-numbers, and getBoxCapacity reads adminConfig', () => {
    expect(DEFAULT_BOX_CAPACITY).toBe(100);
    expect(MIN_BOX_CAPACITY).toBe(20);
    expect(MAX_BOX_CAPACITY).toBe(1000);

    expect(sanitizeBoxCapacity(undefined)).toBe(100);
    expect(sanitizeBoxCapacity(null)).toBe(100);
    expect(sanitizeBoxCapacity('250')).toBe(100);
    expect(sanitizeBoxCapacity(Number.NaN)).toBe(100);
    expect(sanitizeBoxCapacity(Number.POSITIVE_INFINITY)).toBe(100);

    expect(sanitizeBoxCapacity(5)).toBe(20);
    expect(sanitizeBoxCapacity(5000)).toBe(1000);
    expect(sanitizeBoxCapacity(42.6)).toBe(43);

    expect(getBoxCapacity(undefined)).toBe(100);
    expect(getBoxCapacity({})).toBe(100);
    expect(getBoxCapacity({ boxCapacity: 35 })).toBe(35);
    expect(getBoxCapacity({ boxCapacity: 12 })).toBe(20);
  });

  it('2) moveToBox and startAutoRepeat respect a custom adminConfig.boxCapacity', () => {
    const inv = Array.from({ length: 24 }, (_, idx) => makeTestItem(`inv_${idx}`));
    const whItemA = makeTestItem('wh_a');
    const whItemB = makeTestItem('wh_b');

    useGameStore.setState((s) => ({
      ...s,
      adminConfig: { ...s.adminConfig, boxCapacity: 25 },
      pilot: {
        ...s.pilot,
        inventory: inv,
        warehouse: [whItemA, whItemB],
      },
    }));

    const firstMove = useGameStore.getState().moveToBox(['wh_a']);
    expect(firstMove.moved).toBe(1);
    expect(firstMove.skippedFull).toBe(0);
    expect(useGameStore.getState().pilot.inventory).toHaveLength(25);

    const secondMove = useGameStore.getState().moveToBox(['wh_b']);
    expect(secondMove.moved).toBe(0);
    expect(secondMove.skippedFull).toBe(1);

    useGameStore.getState().startAutoRepeat(5, 'sec_1');
    const session = useGameStore.getState().autoRepeatSession;
    expect(session?.active).toBe(false);
    expect(session?.stopReason).toBe('inventory_full');
  });

  it('3) Shop full-box banner and buyShopItem block use custom adminConfig.boxCapacity', () => {
    const inv = Array.from({ length: 22 }, (_, idx) => makeTestItem(`shop_inv_${idx}`));
    const listing: ShopItemListing = {
      ...makeTestItem('shop_offer_1'),
      price: 100,
      soldOut: false,
    };

    useGameStore.setState((s) => ({
      ...s,
      shopSubTab: 'buy',
      shopStock: [listing],
      adminConfig: { ...s.adminConfig, boxCapacity: 22 },
      pilot: {
        ...s.pilot,
        credits: 5000,
        inventory: inv,
      },
    }));

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    const banner = container!.querySelector('[data-testid="shop-cargo-full-banner"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('22/22');

    const buyResult = useGameStore.getState().buyShopItem('shop_offer_1');
    expect(buyResult.ok).toBe(false);
    expect(useGameStore.getState().pilot.inventory).toHaveLength(22);
  });

  it('4) WarehouseView renders N/cap from config and lowering cap keeps items with over-cap red warning', () => {
    const inv = Array.from({ length: 30 }, (_, idx) => makeTestItem(`keep_inv_${idx}`));
    const wh = Array.from({ length: 2 }, (_, idx) => makeTestItem(`keep_wh_${idx}`));

    useGameStore.setState((s) => ({
      ...s,
      adminConfig: { ...s.adminConfig, boxCapacity: 40, warehouseCapacity: 600 },
      pilot: {
        ...s.pilot,
        inventory: inv,
        warehouse: wh,
      },
    }));

    act(() => {
      root!.render(createElement(WarehouseView));
    });

    const heading = container!.querySelector('[data-testid="warehouse-box-heading"]');
    const whHeading = container!.querySelector('[data-testid="warehouse-storage-heading"]');
    expect(heading?.textContent).toContain('30/40');
    expect(heading?.getAttribute('data-over-cap')).toBe('false');
    expect(whHeading?.textContent).toContain('2/600');

    act(() => {
      useGameStore.getState().adminUpdateConfig({ boxCapacity: 25 });
    });

    const afterState = useGameStore.getState();
    expect(afterState.pilot.inventory).toHaveLength(30);
    const updatedHeading = container!.querySelector('[data-testid="warehouse-box-heading"]');
    expect(updatedHeading?.textContent).toContain('30/25');
    expect(updatedHeading?.getAttribute('data-over-cap')).toBe('true');
    expect(updatedHeading?.className).toContain('text-rose-400');
  });

  it('5) DEFAULT_WAREHOUSE_CAPACITY is 500 when missing, while a stored 300 in save is preserved', () => {
    expect(DEFAULT_WAREHOUSE_CAPACITY).toBe(500);
    const defAdmin = createDefaultAdminConfig();
    expect(defAdmin.warehouseCapacity).toBe(500);

    const basePilot = createDefaultPilotAccount('Legacy', 'striker');
    const adminWithoutWh = { ...defAdmin } as Record<string, unknown>;
    delete adminWithoutWh.warehouseCapacity;
    delete adminWithoutWh.boxCapacity;

    const migratedNoWh = migrateSaveData(
      { pilot: basePilot, adminConfig: adminWithoutWh, hasSaveData: true },
      CURRENT_SAVE_VERSION,
      () => 0.5
    );
    expect(migratedNoWh.adminConfig.warehouseCapacity).toBe(500);
    expect(migratedNoWh.adminConfig.boxCapacity).toBe(100);

    const migratedStored300 = migrateSaveData(
      {
        pilot: basePilot,
        adminConfig: { ...defAdmin, warehouseCapacity: 300 },
        hasSaveData: true,
      },
      CURRENT_SAVE_VERSION,
      () => 0.5
    );
    expect(migratedStored300.adminConfig.warehouseCapacity).toBe(300);
  });
});
