// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupplyTemplateById } from '../../data/consumables';
import { computeSupplyPrice } from '../../engine/itemPrice';
import { createDefaultAdminConfig } from '../../engine/migration';
import { getSupplyWpPrice } from '../../engine/shop';
import { useGameStore } from '../../store/useGameStore';
import { SupplyShopPanel } from '../SupplyShopPanel';

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

describe('TASK SHOP-V2b — Supply Shop UI: CREDIT + WP, Refresh, [MAX], Sell', () => {
  it('1) refreshShopStock leaves supply stocks and supplyShopRefresh unchanged', () => {
    const supplyCredit = [{ templateId: 'sup_hp_t1', remaining: 12 }];
    const supplyWp = [
      { slotId: 'wp-0-sup_hp_t3', templateId: 'sup_hp_t3', remaining: 14 },
    ];
    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, credits: 5000 },
      supplyShopStock: supplyCredit,
      supplyShopStockWp: supplyWp,
      supplyShopRefresh: { used: 1 },
    }));

    const res = useGameStore.getState().refreshShopStock();
    expect(res.ok).toBe(true);

    const after = useGameStore.getState();
    expect(after.supplyShopStock).toEqual(supplyCredit);
    expect(after.supplyShopStockWp).toEqual(supplyWp);
    expect(after.supplyShopRefresh).toEqual({ used: 1 });
  });

  it('2) refresh button label shows "1/3" + "0 CR" then "2/3" + "1,000 CR" after one use, and is disabled with wait message at limit', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, credits: 5000 },
      supplyShopRefresh: { used: 0 },
      battlesUntilRestock: 2,
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel));
    });

    const counter = () =>
      container!.querySelector('[data-testid="supply-refresh-counter"]')
        ?.textContent;
    const btn = () =>
      container!.querySelector(
        '[data-testid="supply-refresh-btn"]'
      ) as HTMLButtonElement;

    expect(counter()).toContain('1/3');
    expect(btn().textContent).toContain('0 CR');
    expect(btn().disabled).toBe(false);

    act(() => {
      btn().click();
    });

    expect(counter()).toContain('2/3');
    expect(btn().textContent).toContain('1,000 CR');

    act(() => {
      useGameStore.setState({ supplyShopRefresh: { used: 3 } });
      root!.render(createElement(SupplyShopPanel));
    });

    expect(counter()).toContain('3/3');
    expect(btn().disabled).toBe(true);
    expect(
      container!.querySelector('[data-testid="supply-refresh-wait"]')?.textContent
    ).toContain('Chờ 2 trận hoặc sang tháng mới');
  });

  it('3) WP row shows the WP price and buying calls buySupplyWp and reduces warPoints', () => {
    const tpl = getSupplyTemplateById('sup_hp_t3')!;
    const wpPrice = getSupplyWpPrice(tpl, createDefaultAdminConfig());
    const origBuyWp = useGameStore.getState().buySupplyWp;
    const buyWpSpy = vi.fn((slotId: string, qty: number) =>
      origBuyWp(slotId, qty)
    );

    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, warPoints: 500, consumables: [] },
      supplyShopStockWp: [
        { slotId: 'wp-0-sup_hp_t3', templateId: 'sup_hp_t3', remaining: 10 },
      ],
      buySupplyWp: buyWpSpy,
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel));
    });

    const wpRow = container!.querySelector(
      '[data-testid="supply-wp-row-wp-0-sup_hp_t3"]'
    );
    expect(wpRow?.textContent).toContain(`${wpPrice.toLocaleString()} WP`);

    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-wp-buy-wp-0-sup_hp_t3-5"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(
      container!.querySelector('[data-testid="supply-confirm-total"]')
        ?.textContent
    ).toBe(`${(wpPrice * 5).toLocaleString()} WP`);

    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-confirm-ok"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(buyWpSpy).toHaveBeenCalledWith('wp-0-sup_hp_t3', 5);
    expect(useGameStore.getState().pilot.warPoints).toBe(500 - wpPrice * 5);
    expect(useGameStore.getState().supplyShopStockWp[0].remaining).toBe(5);
  });

  it('4) [MAX] = min(remaining, affordable, stack cap room) and is disabled at 0', () => {
    const unitPrice = computeSupplyPrice(getSupplyTemplateById('sup_hp_t1')!);

    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        credits: unitPrice * 5,
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 92, // cap room = 7; affordable = 5; remaining = 12 -> 5
          },
        ],
      },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 12 }],
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel));
    });

    const maxBtn = () =>
      container!.querySelector(
        '[data-testid="supply-buy-sup_hp_t1-max"]'
      ) as HTMLButtonElement;
    expect(maxBtn().disabled).toBe(false);
    expect(maxBtn().textContent).toContain('MAX 5');

    // Cap room smallest (99 - 96 = 3)
    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        pilot: {
          ...s.pilot,
          credits: unitPrice * 50,
          consumables: [
            {
              id: 'supply_sup_hp_t1',
              kind: 'battle_supply',
              templateId: 'sup_hp_t1',
              quantity: 96,
            },
          ],
        },
      }));
      root!.render(createElement(SupplyShopPanel));
    });
    expect(maxBtn().textContent).toContain('MAX 3');

    // Disabled at 0
    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        pilot: { ...s.pilot, credits: 0 },
      }));
      root!.render(createElement(SupplyShopPanel));
    });
    expect(maxBtn().disabled).toBe(true);
    expect(maxBtn().textContent).toContain('MAX 0');
  });

  it('5) sell rows contain no "chỉ nhận CR" text', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 4,
          },
        ],
      },
    }));

    act(() => {
      root!.render(createElement(SupplyShopPanel));
    });

    const sellSec = container!.querySelector(
      '[data-testid="supply-sell-section"]'
    );
    expect(sellSec).not.toBeNull();
    expect(sellSec?.textContent).toContain('CR');
    expect(sellSec?.textContent?.toLowerCase()).not.toContain('chỉ nhận cr');
  });
});
