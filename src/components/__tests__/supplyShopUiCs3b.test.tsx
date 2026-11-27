// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSupplyTemplateById } from '../../data/consumables';
import { SHOP_CONFIG } from '../../data/items';
import { computeSupplyPrice } from '../../engine/itemPrice';
import { createDefaultAdminConfig } from '../../engine/migration';
import { getSupplyStockCount } from '../../engine/supplies';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import { AdminPanel } from '../AdminPanel';
import { ShopScreen } from '../ShopScreen';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  useGameStore.getState().resetCampaign();
  useGameStore.getState().startCampaign('Tester', 'striker');
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

describe('TASK CS3b — Shop tab "Vật tư" + Admin CP block "Cửa hàng vật tư"', () => {
  it('1) renders 4 shop tabs, switches to "Vật tư" with family groups, hides equipment filters and loadout bar', () => {
    useGameStore.setState({
      shopSubTab: 'buy',
      supplyShopStock: [
        { templateId: 'sup_sp_t1', remaining: 4 },
        { templateId: 'sup_hp_t1', remaining: 6 },
        { templateId: 'sup_shield_t1', remaining: 5 },
      ],
    });

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    expect(container!.querySelector('[data-testid="shop-tab-buy"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="shop-tab-sell"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="shop-tab-wp"]')).not.toBeNull();
    const supplyTab = container!.querySelector(
      '[data-testid="shop-tab-supply"]'
    ) as HTMLButtonElement;
    expect(supplyTab).not.toBeNull();
    expect(supplyTab.textContent).toContain('Vật tư');

    act(() => {
      supplyTab.click();
    });

    expect(useGameStore.getState().shopSubTab).toBe('supply');
    expect(container!.querySelector('[data-testid="shop-slot-tabs"]')).toBeNull();
    expect(container!.querySelector('[data-testid="supply-loadout-bar-desktop"]')).toBeNull();
    expect(container!.querySelector('[data-testid="supply-loadout-bar-phone"]')).toBeNull();

    const hpSec = container!.querySelector('[data-testid="supply-family-hp_kit"]');
    const shieldSec = container!.querySelector('[data-testid="supply-family-shield_kit"]');
    const spSec = container!.querySelector('[data-testid="supply-family-sp_kit"]');
    const buffSec = container!.querySelector('[data-testid="supply-family-buff"]');
    expect(hpSec?.textContent).toContain('Sửa chữa');
    expect(shieldSec?.textContent).toContain('Khiên');
    expect(spSec?.textContent).toContain('SP');
    expect(buffSec).toBeNull();

    const hpRow = container!.querySelector('[data-testid="supply-buy-row-sup_hp_t1"]');
    expect(hpRow?.textContent).toContain('HP +300');
    expect(hpRow?.textContent).toContain('còn 6');
    expect(hpRow?.textContent).toContain('có 0');
    expect(
      hpRow?.textContent
    ).toContain(`${computeSupplyPrice(getSupplyTemplateById('sup_hp_t1')!)} CR`);
  });

  it('2) disables [x1]/[x5]/[x10] with short reasons (sold out, credits, remaining, cap 99), keeps sold-out dimmed, and renders empty as one line', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const hpPrice = computeSupplyPrice(hpTpl);

    useGameStore.setState((s) => ({
      ...s,
      shopSubTab: 'supply',
      pilot: {
        ...s.pilot,
        credits: hpPrice * 2, // enough for x1 only on sup_hp_t1 (x5 & x10 short CR)
        consumables: [
          {
            id: 'supply_sup_sp_t1',
            kind: 'battle_supply',
            templateId: 'sup_sp_t1',
            quantity: 96, // x5 and x10 exceed 99
          },
        ],
      },
      supplyShopStock: [
        { templateId: 'sup_hp_t1', remaining: 3 }, // x5 & x10 > remaining (3)
        { templateId: 'sup_shield_t1', remaining: 0 }, // sold out
        { templateId: 'sup_sp_t1', remaining: 20 }, // over 99 cap for x5 & x10, and short CR
      ],
    }));

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    // Sold-out stays visible & dimmed with "Hết hàng"
    const soldOutRow = container!.querySelector(
      '[data-testid="supply-buy-row-sup_shield_t1"]'
    ) as HTMLElement;
    expect(soldOutRow).not.toBeNull();
    expect(soldOutRow.getAttribute('data-sold-out')).toBe('true');
    expect(soldOutRow.className).toContain('opacity-50');
    expect(soldOutRow.textContent).toContain('Hết hàng');
    expect(
      (container!.querySelector('[data-testid="supply-buy-sup_shield_t1-1"]') as HTMLButtonElement).disabled
    ).toBe(true);

    // Remaining check (remaining=3 -> x1 ok, x5 & x10 disabled "Quá số còn")
    expect(
      (container!.querySelector('[data-testid="supply-buy-sup_hp_t1-1"]') as HTMLButtonElement).disabled
    ).toBe(false);
    expect(
      (container!.querySelector('[data-testid="supply-buy-sup_hp_t1-5"]') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      container!.querySelector('[data-testid="supply-reason-sup_hp_t1"]')?.textContent
    ).toContain('Quá số còn (3)');

    // Cap 99 check (owned=96 -> x5 disabled for cap 99)
    expect(
      (container!.querySelector('[data-testid="supply-buy-sup_sp_t1-5"]') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      container!.querySelector('[data-testid="supply-reason-sup_sp_t1"]')?.textContent
    ).toContain('Vượt tối đa 99');

    // Short credits check
    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        pilot: { ...s.pilot, credits: 0, consumables: [] },
        supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 15 }],
      }));
      root!.render(createElement(ShopScreen));
    });
    expect(
      (container!.querySelector('[data-testid="supply-buy-sup_hp_t1-1"]') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      container!.querySelector('[data-testid="supply-reason-sup_hp_t1"]')?.textContent
    ).toContain('Thiếu CR');

    // Empty CREDIT stock + 0 owned renders empty line cleanly without sell section
    act(() => {
      useGameStore.setState({ supplyShopStock: [] });
      root!.render(createElement(ShopScreen));
    });
    expect(container!.querySelector('[data-testid="supply-shop-empty"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="supply-sell-section"]')).toBeNull();
  });

  it('3) buys via buySupply with notice update and sells owned supplies in "Bán lại" via sellSupply', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const buyPrice = computeSupplyPrice(hpTpl);
    const sellPrice = Math.round(buyPrice * SHOP_CONFIG.sellPriceRatio);

    useGameStore.setState((s) => ({
      ...s,
      shopSubTab: 'supply',
      pilot: {
        ...s.pilot,
        credits: 5000,
        consumables: [],
      },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 12 }],
    }));

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    const buy5Btn = container!.querySelector(
      '[data-testid="supply-buy-sup_hp_t1-5"]'
    ) as HTMLButtonElement;
    act(() => {
      buy5Btn.click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-confirm-ok"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(useGameStore.getState().pilot.credits).toBe(5000 - buyPrice * 5);
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_hp_t1')
    ).toBe(5);
    expect(useGameStore.getState().supplyShopStock[0].remaining).toBe(7);
    expect(container!.textContent).toContain(`Đã mua 5×`);

    const sellSec = container!.querySelector('[data-testid="supply-sell-section"]');
    expect(sellSec?.textContent).toContain('Bán lại');
    expect(sellSec?.textContent).toContain(`${sellPrice} CR/cái`);

    const sell5Btn = container!.querySelector(
      '[data-testid="supply-sell-sup_hp_t1-5"]'
    ) as HTMLButtonElement;
    expect(sell5Btn.disabled).toBe(false);
    act(() => {
      sell5Btn.click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-confirm-ok"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(useGameStore.getState().pilot.credits).toBe(
      5000 - buyPrice * 5 + sellPrice * 5
    );
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_hp_t1')
    ).toBe(0);
    expect(container!.textContent).toContain(`Đã bán 5×`);
  });

  it('4) vi/en keys match cleanly and SupplyShopPanel uses grid-cols-4 phone tabs with no nested scroll box', () => {
    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );

    useGameStore.setState({
      shopSubTab: 'supply',
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 5 }],
    });
    act(() => {
      root!.render(createElement(ShopScreen));
    });

    const tabBar = container!.querySelector(
      '[data-testid="shop-tab-supply"]'
    )!.parentElement!;
    expect(tabBar.className).toContain('grid-cols-4');

    const panel = container!.querySelector('[data-testid="supply-shop-panel"]')!;
    expect(panel.innerHTML).not.toContain('overflow-y-auto');
  });

  it('5) Admin CP "Cửa hàng vật tư" clamps values (1..12, 1..99), fixes min > max, and restocks on button click', () => {
    useGameStore.setState({
      adminPanelOpen: true,
      adminConfig: createDefaultAdminConfig(),
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 1 }],
    });

    act(() => {
      root!.render(createElement(AdminPanel));
    });

    const battleTabBtn = container!.querySelector(
      '[data-testid="admin-tab-battle"]'
    ) as HTMLButtonElement;
    act(() => {
      battleTabBtn.click();
    });

    const sec = container!.querySelector('[data-testid="admin-supply-shop-section"]');
    expect(sec).not.toBeNull();
    expect(sec?.textContent).toContain('Cửa hàng vật tư');
    expect(sec?.textContent).toContain('Áp dụng từ lần làm mới kho tiếp theo');

    const minTypes = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-supply-shop-min-types"]'
    )!;
    const maxTypes = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-supply-shop-max-types"]'
    )!;
    const minQty = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-supply-shop-min-qty"]'
    )!;
    const maxQty = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-supply-shop-max-qty"]'
    )!;

    act(() => {
      setInputValue(minTypes, '11'); // > current max (10) -> fixes maxTypes = 11
    });
    expect(useGameStore.getState().adminConfig.supplyShopMinTypes).toBe(11);
    expect(useGameStore.getState().adminConfig.supplyShopMaxTypes).toBe(11);

    act(() => {
      setInputValue(maxTypes, '99'); // clamped to 12
      setInputValue(minQty, '25'); // > current max (15) -> fixes maxQty = 25
      setInputValue(maxQty, '250'); // clamped to 99
    });
    expect(useGameStore.getState().adminConfig.supplyShopMaxTypes).toBe(12);
    expect(useGameStore.getState().adminConfig.supplyShopMinQty).toBe(25);
    expect(useGameStore.getState().adminConfig.supplyShopMaxQty).toBe(99);

    // Ensure restock button invokes adminRestockShopNow and respects new config
    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        pilot: {
          ...s.pilot,
          gears: {
            ...s.pilot.gears,
            striker: { ...s.pilot.gears.striker, level: 35 },
          },
        },
        adminConfig: {
          ...s.adminConfig,
          supplyShopMinTypes: 4,
          supplyShopMaxTypes: 4,
          supplyShopMinQty: 20,
          supplyShopMaxQty: 22,
        },
      }));
    });

    const restockBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-supply-shop-restock-btn"]'
    )!;
    act(() => {
      restockBtn.click();
    });

    const newStock = useGameStore.getState().supplyShopStock;
    expect(newStock).toHaveLength(4);
    for (const row of newStock) {
      expect(row.remaining).toBeGreaterThanOrEqual(20);
      expect(row.remaining).toBeLessThanOrEqual(22);
    }
  });
});
