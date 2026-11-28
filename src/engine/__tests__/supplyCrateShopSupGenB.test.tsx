// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CRATE_SHOP_CONFIG,
  rollCrateShopStockCredit,
  rollCrateShopStockWp,
  sanitizeCrateShopConfig,
  sanitizeCrateShopStock,
} from '../shop';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import {
  cloneSupplyRewardsConfig,
  DEFAULT_SUPPLY_REWARDS_CONFIG,
  estimateCrateValue,
} from '../supplyRewards';
import { useGameStore } from '../../store/useGameStore';
import { SupplyShopPanel } from '../../components/SupplyShopPanel';
import { CrateShopAdminBlock } from '../../components/admin/CrateShopAdminBlock';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeSeqRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const val = values[idx % values.length] ?? 0;
    idx += 1;
    return val;
  };
}

describe('TASK SUP-GEN-b — Supply Crates in WP & Credit Shops', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
  });

  it('1) sanitizer applies defaults and clamps crateShop config and stock bounds', () => {
    const def = sanitizeCrateShopConfig(undefined);
    expect(def).toEqual(DEFAULT_CRATE_SHOP_CONFIG);

    const clamped = sanitizeCrateShopConfig({
      wp: { chancePct: 999, maxSlots: 20, maxPerSlot: 500, price: 0 },
      credit: { chancePct: -5, maxSlots: -2, maxPerSlot: 0, price: 999_999_999 },
    });
    expect(clamped.wp).toEqual({
      chancePct: 100,
      maxSlots: 6,
      maxPerSlot: 99,
      price: 1,
    });
    expect(clamped.credit).toEqual({
      chancePct: 0,
      maxSlots: 0,
      maxPerSlot: 1,
      price: 100_000_000,
    });

    const cleanStock = sanitizeCrateShopStock([
      { slotId: ' crate-wp-0 ', remaining: 150 },
      { slotId: 'crate-wp-0', remaining: 5 },
      { slotId: '', remaining: 3 },
      { slotId: 'crate-wp-1', remaining: -4 },
    ]);
    expect(cleanStock).toEqual([
      { slotId: 'crate-wp-0', remaining: 99 },
      { slotId: 'crate-wp-1', remaining: 0 },
    ]);
  });

  it('2) stock roll with fixed rng obeys chance 100/0, maxSlots, and 1..maxPerSlot quantities', () => {
    const fullWp = rollCrateShopStockWp(
      {
        wp: { chancePct: 100, maxSlots: 4, maxPerSlot: 7, price: 100 },
        credit: DEFAULT_CRATE_SHOP_CONFIG.credit,
      },
      makeSeqRng([0.0, 0.5, 0.99])
    );
    expect(fullWp).toHaveLength(4);
    for (const row of fullWp) {
      expect(row.remaining).toBeGreaterThanOrEqual(1);
      expect(row.remaining).toBeLessThanOrEqual(7);
    }

    const emptyCr = rollCrateShopStockCredit(
      {
        wp: DEFAULT_CRATE_SHOP_CONFIG.wp,
        credit: { chancePct: 0, maxSlots: 6, maxPerSlot: 5, price: 100_000 },
      },
      () => 0
    );
    expect(emptyCr).toEqual([]);
  });

  it('3) buyCrateWp / buyCrateCredit handle happy path, no_funds, stack cap 99, and UI confirm flow', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('CrateBuyer', 'striker');
    useGameStore.getState().setLanguage('vi');

    useGameStore.setState((s) => ({
      ...s,
      crateShopStockWp: [{ slotId: 'crate-wp-0', remaining: 4 }],
      crateShopStockCredit: [{ slotId: 'crate-credit-0', remaining: 6 }],
      pilot: {
        ...s.pilot,
        warPoints: 500,
        credits: 250_000,
        consumables: [],
      },
    }));

    const wpOk = useGameStore.getState().buyCrateWp('crate-wp-0', 2);
    expect(wpOk).toEqual({
      ok: true,
      bought: 2,
      cost: 200,
      cappedByStack: false,
    });
    expect(useGameStore.getState().pilot.warPoints).toBe(300);
    expect(useGameStore.getState().crateShopStockWp[0].remaining).toBe(2);

    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, warPoints: 150 },
    }));
    const wpNoFunds = useGameStore.getState().buyCrateWp('crate-wp-0', 4);
    expect(wpNoFunds.ok).toBe(false);
    expect(wpNoFunds.reason).toBe('no_funds');

    const crNoFunds = useGameStore.getState().buyCrateCredit('crate-credit-0', 3);
    expect(crNoFunds.ok).toBe(false);
    expect(crNoFunds.reason).toBe('no_funds');

    // Stack cap 99 partial buy: 97 owned + request 5 -> buys 2, hits 99, next fails with 'full'
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        credits: 1_000_000,
        consumables: [{ id: 'supply_crate_stack', kind: 'supply_crate', quantity: 97 }],
      },
    }));
    const crPartial = useGameStore.getState().buyCrateCredit('crate-credit-0', 5);
    expect(crPartial).toEqual({
      ok: true,
      bought: 2,
      cost: 200_000,
      cappedByStack: true,
    });
    expect(
      useGameStore
        .getState()
        .pilot.consumables?.find((c) => c.kind === 'supply_crate')?.quantity
    ).toBe(99);
    const crFull = useGameStore.getState().buyCrateCredit('crate-credit-0', 1);
    expect(crFull.ok).toBe(false);
    expect(crFull.reason).toBe('full');

    // UI render check: stepper + confirm dialog for WP crate
    useGameStore.setState((s) => ({
      ...s,
      crateShopStockWp: [{ slotId: 'crate-wp-0', remaining: 3 }],
      pilot: {
        ...s.pilot,
        warPoints: 500,
        consumables: [],
      },
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const notices: string[] = [];
    act(() => {
      root!.render(createElement(SupplyShopPanel, { onNotice: (m) => notices.push(m) }));
    });
    const incBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="crate-wp-inc-crate-wp-0"]'
    )!;
    const buyBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="crate-wp-buy-crate-wp-0"]'
    )!;
    expect(incBtn).not.toBeNull();
    expect(buyBtn).not.toBeNull();
    act(() => {
      incBtn.click();
    });
    expect(
      container.querySelector('[data-testid="crate-wp-qty-crate-wp-0"]')?.textContent
    ).toBe('2');
    act(() => {
      buyBtn.click();
    });
    const confirmOk = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="supply-confirm-ok"]'
    )!;
    expect(confirmOk).not.toBeNull();
    act(() => {
      confirmOk.click();
    });
    expect(useGameStore.getState().pilot.warPoints).toBe(300);
    expect(notices.length).toBeGreaterThan(0);
  });

  it('4) old save without crateShopStockWp or crateShopStockCredit loads with no crate rows', () => {
    const fresh = createFreshCampaignState('LegacyCrate', 'striker', () => 0.1);
    const legacyRaw = {
      ...fresh,
      crateShopStockWp: undefined,
      crateShopStockCredit: undefined,
      adminConfig: {
        ...fresh.adminConfig,
        crateShop: undefined,
      },
    };
    const migrated = migrateSaveData(legacyRaw, CURRENT_SAVE_VERSION);
    expect(migrated.crateShopStockWp).toEqual([]);
    expect(migrated.crateShopStockCredit).toEqual([]);
    expect(migrated.adminConfig.crateShop).toEqual(DEFAULT_CRATE_SHOP_CONFIG);
  });

  it('5) estimateCrateValue returns positive values, rises with qtyMax, and matches Admin block readout', () => {
    const baseAdmin = {
      supplyRewards: cloneSupplyRewardsConfig(DEFAULT_SUPPLY_REWARDS_CONFIG),
      crateShop: DEFAULT_CRATE_SHOP_CONFIG,
    };
    const v1 = estimateCrateValue(baseAdmin, 1);
    const v20 = estimateCrateValue(baseAdmin, 20);
    const v50 = estimateCrateValue(baseAdmin, 50);
    expect(v1).toBeGreaterThan(0);
    expect(v20).toBeGreaterThan(v1);
    expect(v50).toBeGreaterThan(v20);

    const boostedAdmin = {
      ...baseAdmin,
      supplyRewards: {
        ...baseAdmin.supplyRewards,
        crate: {
          ...baseAdmin.supplyRewards.crate,
          qtyMax: baseAdmin.supplyRewards.crate.qtyMax + 4,
        },
      },
    };
    expect(estimateCrateValue(boostedAdmin, 20)).toBeGreaterThan(v20);

    useGameStore.getState().resetCampaign();
    useGameStore.getState().setLanguage('vi');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      const st = useGameStore.getState();
      root!.render(
        createElement(CrateShopAdminBlock, {
          adminConfig: st.adminConfig,
          adminUpdateConfig: st.adminUpdateConfig,
        })
      );
    });
    const lv20Text =
      container.querySelector('[data-testid="admin-crate-shop-value-lv20"]')
        ?.textContent ?? '';
    expect(lv20Text).toContain(v20.toLocaleString('vi-VN'));
    expect(lv20Text).toContain('100 WP');
    expect(lv20Text).toContain('100.000');
  });
});
