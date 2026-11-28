// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CRATE_SHOP_CONFIG,
  getCrateCreditPrice,
  sanitizeCrateShopConfig,
} from '../shop';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { estimateCrateValue } from '../supplyRewards';
import { useGameStore } from '../../store/useGameStore';
import { SupplyShopPanel } from '../../components/SupplyShopPanel';
import { CrateShopAdminBlock } from '../../components/admin/CrateShopAdminBlock';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('TASK CRATE-PRICE-1 — Crate shop default pricing & optional level-scaled priceFactor', () => {
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

  it('1) fresh defaults are wp.price=10 / credit.price=1000, Reset applies them, and existing saved numbers are preserved', () => {
    expect(DEFAULT_CRATE_SHOP_CONFIG.wp.price).toBe(10);
    expect(DEFAULT_CRATE_SHOP_CONFIG.credit.price).toBe(1000);
    expect(DEFAULT_CRATE_SHOP_CONFIG.priceFactor).toEqual({
      enabled: false,
      creditPct: 100,
    });

    const freshAdmin = createDefaultAdminConfig();
    expect(freshAdmin.crateShop?.wp.price).toBe(10);
    expect(freshAdmin.crateShop?.credit.price).toBe(1000);
    expect(freshAdmin.crateShop?.priceFactor).toEqual({
      enabled: false,
      creditPct: 100,
    });

    // Legacy save with stored 100 WP / 100,000 CR preserves its stored numbers
    const fresh = createFreshCampaignState('LegacyPrices', 'striker', () => 0.2);
    const legacySave = {
      ...fresh,
      adminConfig: {
        ...fresh.adminConfig,
        crateShop: {
          wp: { chancePct: 10, maxSlots: 2, maxPerSlot: 10, price: 100 },
          credit: { chancePct: 5, maxSlots: 3, maxPerSlot: 5, price: 100_000 },
        },
      },
    };
    const migrated = migrateSaveData(legacySave, CURRENT_SAVE_VERSION);
    expect(migrated.adminConfig.crateShop?.wp.price).toBe(100);
    expect(migrated.adminConfig.crateShop?.credit.price).toBe(100_000);
    expect(migrated.adminConfig.crateShop?.priceFactor).toEqual({
      enabled: false,
      creditPct: 100,
    });

    // Admin block Reset button restores 10 / 1000 and clamps priceFactor pct 10..1000
    expect(
      sanitizeCrateShopConfig({
        priceFactor: { enabled: true, creditPct: 9999 },
      }).priceFactor
    ).toEqual({ enabled: true, creditPct: 1000 });
    expect(
      sanitizeCrateShopConfig({
        priceFactor: { enabled: false, creditPct: 1 },
      }).priceFactor
    ).toEqual({ enabled: false, creditPct: 10 });

    useGameStore.getState().resetCampaign();
    useGameStore.getState().setLanguage('vi');
    useGameStore.getState().adminUpdateConfig({
      crateShop: {
        wp: { chancePct: 10, maxSlots: 2, maxPerSlot: 10, price: 100 },
        credit: { chancePct: 5, maxSlots: 3, maxPerSlot: 5, price: 100_000 },
        priceFactor: { enabled: true, creditPct: 150 },
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const renderAdmin = () => {
      const st = useGameStore.getState();
      root!.render(
        createElement(CrateShopAdminBlock, {
          adminConfig: st.adminConfig,
          adminUpdateConfig: st.adminUpdateConfig,
        })
      );
    };
    act(renderAdmin);

    const lv20Val = estimateCrateValue(useGameStore.getState().adminConfig, 20);
    const expected150 = Math.round((lv20Val * 150) / 100);
    const exText =
      container.querySelector('[data-testid="admin-crate-shop-factor-ex"]')
        ?.textContent ?? '';
    expect(exText).toContain(lv20Val.toLocaleString('vi-VN'));
    expect(exText).toContain('150%');
    expect(exText).toContain(expected150.toLocaleString('vi-VN'));

    const resetBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-crate-shop-reset"]'
    )!;
    act(() => {
      resetBtn.click();
    });
    expect(useGameStore.getState().adminConfig.crateShop).toEqual(
      DEFAULT_CRATE_SHOP_CONFIG
    );
  });

  it('2) priceFactor.enabled=true scales Credit crate price by deployed Gear level across helper, UI, confirm, and buyCrateCredit while WP stays fixed', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('ScaledPilot', 'striker');
    useGameStore.getState().setLanguage('vi');

    useGameStore.setState((s) => ({
      ...s,
      adminConfig: {
        ...s.adminConfig,
        crateShop: {
          wp: { chancePct: 100, maxSlots: 1, maxPerSlot: 5, price: 10 },
          credit: { chancePct: 100, maxSlots: 1, maxPerSlot: 5, price: 1000 },
          priceFactor: { enabled: true, creditPct: 120 },
        },
      },
      crateShopStockWp: [{ slotId: 'crate-wp-0', remaining: 5 }],
      crateShopStockCredit: [{ slotId: 'crate-credit-0', remaining: 5 }],
      pilot: {
        ...s.pilot,
        activeGearId: 'striker',
        gears: {
          ...s.pilot.gears,
          striker: { ...s.pilot.gears.striker, level: 20 },
          siege: { ...s.pilot.gears.siege, level: 5 },
        },
        credits: 50_000,
        warPoints: 100,
        consumables: [],
      },
    }));

    const st = useGameStore.getState();
    const expectedLv20 = Math.round(
      (estimateCrateValue(st.adminConfig, 20) * 120) / 100
    );
    expect(getCrateCreditPrice(st.pilot, st.adminConfig)).toBe(expectedLv20);

    // Switching activeGearId to Lv.5 lowers dynamic price
    const lv5Pilot = { ...st.pilot, activeGearId: 'siege' as const };
    const expectedLv5 = Math.round(
      (estimateCrateValue(st.adminConfig, 5) * 120) / 100
    );
    expect(getCrateCreditPrice(lv5Pilot, st.adminConfig)).toBe(expectedLv5);
    expect(expectedLv20).not.toBe(expectedLv5);

    // Shop UI row + Confirm dialog + buyCrateCredit all match expectedLv20, while WP stays 10
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(createElement(SupplyShopPanel));
    });

    const crRowText =
      container.querySelector(
        '[data-testid="crate-credit-row-crate-credit-0"]'
      )?.textContent ?? '';
    expect(crRowText).toContain(`${expectedLv20.toLocaleString()} CR`);

    const wpRowText =
      container.querySelector('[data-testid="crate-wp-row-crate-wp-0"]')
        ?.textContent ?? '';
    expect(wpRowText).toContain('10 WP');

    const crBuyBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="crate-credit-buy-crate-credit-0"]'
    )!;
    act(() => {
      crBuyBtn.click();
    });
    const confirmTotal =
      document.body.querySelector('[data-testid="supply-confirm-total"]')
        ?.textContent ?? '';
    expect(confirmTotal).toContain(`${expectedLv20.toLocaleString()} CR`);

    const confirmOk = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="supply-confirm-ok"]'
    )!;
    act(() => {
      confirmOk.click();
    });
    expect(useGameStore.getState().pilot.credits).toBe(50_000 - expectedLv20);

    // WP purchase remains fixed at 10 WP
    let wpRes: ReturnType<ReturnType<typeof useGameStore.getState>['buyCrateWp']>;
    act(() => {
      wpRes = useGameStore.getState().buyCrateWp('crate-wp-0', 2);
    });
    expect(wpRes!).toEqual({
      ok: true,
      bought: 2,
      cost: 20,
      cappedByStack: false,
    });
    expect(useGameStore.getState().pilot.warPoints).toBe(80);
  });

  it('3) priceFactor.enabled=false uses fixed credit.price regardless of Gear level and WP remains fixed', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('FixedPilot', 'striker');

    useGameStore.setState((s) => ({
      ...s,
      adminConfig: {
        ...s.adminConfig,
        crateShop: {
          wp: { chancePct: 100, maxSlots: 1, maxPerSlot: 5, price: 15 },
          credit: { chancePct: 100, maxSlots: 1, maxPerSlot: 5, price: 2500 },
          priceFactor: { enabled: false, creditPct: 300 },
        },
      },
      crateShopStockWp: [{ slotId: 'crate-wp-0', remaining: 5 }],
      crateShopStockCredit: [{ slotId: 'crate-credit-0', remaining: 5 }],
      pilot: {
        ...s.pilot,
        activeGearId: 'striker',
        gears: {
          ...s.pilot.gears,
          striker: { ...s.pilot.gears.striker, level: 40 },
        },
        credits: 20_000,
        warPoints: 100,
        consumables: [],
      },
    }));

    const st = useGameStore.getState();
    expect(getCrateCreditPrice(st.pilot, st.adminConfig)).toBe(2500);

    const crRes = useGameStore.getState().buyCrateCredit('crate-credit-0', 2);
    expect(crRes).toEqual({
      ok: true,
      bought: 2,
      cost: 5000,
      cappedByStack: false,
    });
    expect(useGameStore.getState().pilot.credits).toBe(15_000);

    const wpRes = useGameStore.getState().buyCrateWp('crate-wp-0', 2);
    expect(wpRes).toEqual({
      ok: true,
      bought: 2,
      cost: 30,
      cappedByStack: false,
    });
  });
});
