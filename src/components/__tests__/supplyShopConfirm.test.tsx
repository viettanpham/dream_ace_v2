// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupplyTemplateById } from '../../data/consumables';
import { SHOP_CONFIG } from '../../data/items';
import { computeSupplyPrice } from '../../engine/itemPrice';
import { getSupplyStockCount } from '../../engine/supplies';
import { useGameStore } from '../../store/useGameStore';
import { SupplyShopPanel } from '../SupplyShopPanel';
import { SupplyTradeConfirm } from '../SupplyTradeConfirm';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

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

describe('TASK SHOP-CONFIRM — Supply buy/sell confirm dialog & button prices', () => {
  it('1) clicking x5 opens the confirm dialog with total & does NOT change credits or stock', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const unitPrice = computeSupplyPrice(hpTpl);
    const total5 = unitPrice * 5;

    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, credits: 5000, consumables: [] },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 12 }],
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel));
    });

    const buy5Btn = container!.querySelector(
      '[data-testid="supply-buy-sup_hp_t1-5"]'
    ) as HTMLButtonElement;
    expect(buy5Btn.textContent).toContain('x5');
    expect(buy5Btn.textContent).toContain(`${total5.toLocaleString()} CR`);

    act(() => {
      buy5Btn.click();
    });

    const dialog = container!.querySelector(
      '[data-testid="supply-confirm-dialog"]'
    ) as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(
      dialog.querySelector('[data-testid="supply-confirm-total"]')?.textContent
    ).toBe(`${total5.toLocaleString()} CR`);
    expect(useGameStore.getState().pilot.credits).toBe(5000);
    expect(useGameStore.getState().supplyShopStock[0].remaining).toBe(12);
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_hp_t1')
    ).toBe(0);
  });

  it('2) confirm buys exactly once with the shown total and passes notice', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const unitPrice = computeSupplyPrice(hpTpl);
    const total5 = unitPrice * 5;
    const onNotice = vi.fn();

    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, credits: 5000, consumables: [] },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 12 }],
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel, { onNotice }));
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-buy-sup_hp_t1-5"]'
        ) as HTMLButtonElement
      ).click();
    });

    const shownTotal = container!.querySelector(
      '[data-testid="supply-confirm-total"]'
    )?.textContent;
    expect(shownTotal).toBe(`${total5.toLocaleString()} CR`);

    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-confirm-ok"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(
      container!.querySelector('[data-testid="supply-confirm-dialog"]')
    ).toBeNull();
    expect(useGameStore.getState().pilot.credits).toBe(5000 - total5);
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_hp_t1')
    ).toBe(5);
    expect(useGameStore.getState().supplyShopStock[0].remaining).toBe(7);
    expect(onNotice).toHaveBeenCalledTimes(1);
    expect(onNotice.mock.calls[0][0]).toContain('Đã mua 5×');
  });

  it('3) cancel and Esc close the dialog without changing credits/stock, and insufficient credits disables confirm', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const unitPrice = computeSupplyPrice(hpTpl);

    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, credits: 3000, consumables: [] },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 10 }],
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel));
    });

    // Cancel via button
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-buy-sup_hp_t1-1"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-confirm-cancel"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      container!.querySelector('[data-testid="supply-confirm-dialog"]')
    ).toBeNull();
    expect(useGameStore.getState().pilot.credits).toBe(3000);
    expect(useGameStore.getState().supplyShopStock[0].remaining).toBe(10);

    // Cancel via Esc
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-buy-sup_hp_t1-5"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(
      container!.querySelector('[data-testid="supply-confirm-dialog"]')
    ).toBeNull();
    expect(useGameStore.getState().pilot.credits).toBe(3000);

    // Insufficient credits check in dialog
    act(() => {
      root!.render(
        createElement(SupplyTradeConfirm, {
          mode: 'buy',
          template: hpTpl,
          qty: 5,
          unitPrice,
          credits: unitPrice,
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
        })
      );
    });
    const okBtn = container!.querySelector(
      '[data-testid="supply-confirm-ok"]'
    ) as HTMLButtonElement;
    const afterEl = container!.querySelector(
      '[data-testid="supply-confirm-after-credits"]'
    ) as HTMLElement;
    expect(okBtn.disabled).toBe(true);
    expect(afterEl.className).toContain('text-rose-400');
  });

  it('4) sell button shows earned credits, opens confirm dialog without selling, and confirm sells once', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const sellPrice = Math.round(
      computeSupplyPrice(hpTpl) * SHOP_CONFIG.sellPriceRatio
    );
    const earn5 = sellPrice * 5;
    const onNotice = vi.fn();

    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        credits: 1000,
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 7,
          },
        ],
      },
      supplyShopStock: [],
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel, { onNotice }));
    });

    const sell5Btn = container!.querySelector(
      '[data-testid="supply-sell-sup_hp_t1-5"]'
    ) as HTMLButtonElement;
    expect(sell5Btn.textContent).toContain(`+${earn5.toLocaleString()} CR`);

    act(() => {
      sell5Btn.click();
    });

    expect(
      container!.querySelector('[data-testid="supply-confirm-dialog"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="supply-confirm-total"]')?.textContent
    ).toBe(`${earn5.toLocaleString()} CR`);
    expect(useGameStore.getState().pilot.credits).toBe(1000);
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_hp_t1')
    ).toBe(7);

    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-confirm-ok"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(useGameStore.getState().pilot.credits).toBe(1000 + earn5);
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_hp_t1')
    ).toBe(2);
    expect(onNotice).toHaveBeenCalledTimes(1);
    expect(onNotice.mock.calls[0][0]).toContain('Đã bán 5×');
  });
});
