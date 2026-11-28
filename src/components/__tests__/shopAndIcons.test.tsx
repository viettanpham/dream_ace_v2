// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { EQUIPMENT_SLOTS } from '../../data/items';
import { SHOP_STOCK_CONFIG } from '../../data/shopConfig';
import { OPENING_CARDS_LIST } from '../../data/skills';
import { DEFAULT_CARD_SHOP_CONFIG } from '../../engine/cardShop';
import { generateItemInstance } from '../../engine/equipment';
import { useGameStore } from '../../store/useGameStore';
import type { ShopItemListing, WpMarketOffer } from '../../types/game';
import { ShopScreen } from '../ShopScreen';
import { SkillView } from '../SkillView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeShopItem(
  templateId: string,
  price: number,
  overrides?: Partial<ShopItemListing>
): ShopItemListing {
  const inst = generateItemInstance(
    { templateId, tier: 1, rarity: 'rare' },
    () => 0.5
  );
  return {
    ...inst,
    price,
    soldOut: false,
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  useGameStore.getState().resetCampaign();
  useGameStore.getState().startCampaign('Tester', 'striker');
  useGameStore.getState().setLanguage('en');
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

describe('ShopScreen & SkillView — Shop Stock, WP Market, and Wrapped Tab Icons', () => {
  it('uses SHOP_STOCK_CONFIG.refreshCostCredits (120 CR) and excludes soldOut items from counts & disables their Buy button', () => {
    const stock: ShopItemListing[] = [
      makeShopItem('tpl_mw_pulse_cannon', 100, {
        instanceId: 'item_avail_weapon',
        soldOut: false,
      }),
      makeShopItem('tpl_mw_rail_lance', 110, {
        instanceId: 'item_sold_weapon',
        soldOut: true,
      }),
      makeShopItem('tpl_ar_striker_vanguard', 120, {
        instanceId: 'item_avail_armor',
        soldOut: false,
      }),
    ];

    useGameStore.setState((s) => ({
      ...s,
      shopSubTab: 'buy',
      battlesUntilRestock: 2,
      shopStock: stock,
      pilot: {
        ...s.pilot,
        credits: 500,
      },
    }));

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    const refreshBtn = container!.querySelector(
      '[data-testid="shop-refresh-btn"]'
    ) as HTMLButtonElement;
    expect(refreshBtn).not.toBeNull();
    expect(refreshBtn.textContent).toContain(
      `${SHOP_STOCK_CONFIG.refreshCostCredits} CR`
    );

    // Tab total excludes soldOut (2 available out of 3 total listings)
    const buyTab = container!.querySelector('[data-testid="shop-tab-buy"]');
    expect(buyTab?.textContent).toContain('(2)');

    // All slots tab & per-slot tab show (avail/total)
    const allSlotTab = container!.querySelector(
      '[data-testid="shop-slot-tab-all"]'
    );
    expect(allSlotTab?.textContent).toContain('(2/3)');

    const mainWeaponTab = container!.querySelector(
      '[data-testid="shop-slot-tab-main_weapon"]'
    );
    expect(mainWeaponTab?.textContent).toContain('(1/2)');

    const armorTab = container!.querySelector(
      '[data-testid="shop-slot-tab-armor"]'
    );
    expect(armorTab?.textContent).toContain('(1/1)');

    const activeSlotStock = container!.querySelector(
      '[data-testid="shop-active-slot-stock"]'
    );
    expect(activeSlotStock?.textContent).toContain('2/3');

    // Sold-out listing shows SOLD OUT badge and disabled Buy button
    const soldCard = container!.querySelector(
      '[data-testid="shop-item-card-item_sold_weapon"]'
    );
    expect(soldCard).not.toBeNull();
    expect(
      soldCard!.querySelector('[data-testid="shop-sold-out-badge"]')
        ?.textContent
    ).toBe('SOLD OUT');
    const soldBuyBtn = container!.querySelector(
      '[data-testid="shop-buy-btn-item_sold_weapon"]'
    ) as HTMLButtonElement;
    expect(soldBuyBtn.disabled).toBe(true);

    // Clicking Refresh deducts SHOP_STOCK_CONFIG.refreshCostCredits (120)
    const creditsBefore = useGameStore.getState().pilot.credits;
    act(() => {
      refreshBtn.click();
    });
    expect(useGameStore.getState().pilot.credits).toBe(
      creditsBefore - SHOP_STOCK_CONFIG.refreshCostCredits
    );
  });

  it('shows restock countdown, Shipyard bonus badge when operational, and keeps equip restriction non-blocking while full inventory blocks Buy', () => {
    const fillerInventory = Array.from(
      { length: BALANCE_CONFIG.maxInventorySize },
      (_, idx) =>
        makeShopItem('tpl_ar_striker_vanguard', 80, {
          instanceId: `inv_filler_${idx}`,
        })
    );

    // Class-mismatched / high-level item that cannot be equipped right now
    const highLevelInterceptorWeapon = makeShopItem('tpl_mw_rail_lance', 100, {
      instanceId: 'item_unusable_now',
      requiredLevel: 99,
      classRestriction: 'interceptor',
      soldOut: false,
    });

    // First test: inventory NOT full, Shipyard NOT operational -> equip warning non-blocking, Buy enabled
    useGameStore.setState((s) => ({
      ...s,
      shopSubTab: 'buy',
      battlesUntilRestock: 3,
      shopStock: [highLevelInterceptorWeapon],
      pilot: {
        ...s.pilot,
        credits: 500,
        inventory: [],
        baseStates: {
          ...s.pilot.baseStates,
          vanguard_shipyard: {
            ...s.pilot.baseStates.vanguard_shipyard,
            faction: 'hostile',
            status: 'operational',
          },
        },
      },
    }));

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    expect(
      container!.querySelector('[data-testid="shop-restock-countdown"]')
        ?.textContent
    ).toContain('3');
    expect(
      container!.querySelector('[data-testid="shop-shipyard-badge"]')
    ).toBeNull();

    const buyBtnWhenEquipMismatch = container!.querySelector(
      '[data-testid="shop-buy-btn-item_unusable_now"]'
    ) as HTMLButtonElement;
    expect(buyBtnWhenEquipMismatch.disabled).toBe(false);

    // Second test: Shipyard operational + inventory full -> Shipyard badge shown, cargo full tag/banner shown, Buy disabled
    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        pilot: {
          ...s.pilot,
          inventory: fillerInventory,
          baseStates: {
            ...s.pilot.baseStates,
            vanguard_shipyard: {
              ...s.pilot.baseStates.vanguard_shipyard,
              faction: 'allied',
              status: 'operational',
            },
          },
        },
      }));
    });

    const shipyardBadge = container!.querySelector(
      '[data-testid="shop-shipyard-badge"]'
    );
    expect(shipyardBadge).not.toBeNull();
    expect(shipyardBadge?.textContent).toContain(
      `+${SHOP_STOCK_CONFIG.shipyardStockBonus}`
    );

    expect(
      container!.querySelector('[data-testid="shop-cargo-full-tag"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="shop-cargo-full-banner"]')
    ).not.toBeNull();

    const buyBtnWhenFull = container!.querySelector(
      '[data-testid="shop-buy-btn-item_unusable_now"]'
    ) as HTMLButtonElement;
    expect(buyBtnWhenFull.disabled).toBe(true);
  });

  it('renders WP Market Opening Cards (owned marked) and rotating offers with stock, sold-out marks, and paid WP refresh', () => {
    const ownedCard = OPENING_CARDS_LIST[0];
    const rotatingOffers: WpMarketOffer[] = [
      {
        id: 'wp_crate_1',
        kind: 'equipment_crate',
        slot: 'main_weapon',
        minRarity: 'epic',
        wpCost: 95,
        soldOut: false,
      },
      {
        id: 'wp_stone_1',
        kind: 'enchant_stone',
        bonusPct: 20,
        wpCost: 45,
        soldOut: true,
      },
      {
        id: 'wp_respec_1',
        kind: 'respec_token',
        wpCost: 40,
        soldOut: false,
      },
      {
        id: 'wp_exp_1',
        kind: 'exp_boost',
        battlesCount: 5,
        bonusPct: 50,
        wpCost: 50,
        soldOut: false,
      },
    ];

    useGameStore.setState((s) => ({
      ...s,
      shopSubTab: 'warpoints',
      wpMarketOffers: rotatingOffers,
      adminConfig: {
        ...s.adminConfig,
        cardShop: {
          ...DEFAULT_CARD_SHOP_CONFIG,
          enabled: false,
        },
      },
      pilot: {
        ...s.pilot,
        warPoints: 300,
        ownedOpeningCards: [ownedCard.id],
      },
    }));

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    const wpRotatingSection = container!.querySelector(
      '[data-testid="shop-wp-rotating-section"]'
    );
    expect(wpRotatingSection).not.toBeNull();
    expect(wpRotatingSection?.textContent).toContain('Epic Main Weapon Crate');
    expect(wpRotatingSection?.textContent).toContain('Enchant Stone');
    expect(wpRotatingSection?.textContent).toContain('Respec Token');
    expect(wpRotatingSection?.textContent).toContain('EXP Boost');

    // Stock badge shows 3/4 available (1 sold out)
    expect(
      container!.querySelector('[data-testid="shop-wp-stock-badge"]')
        ?.textContent
    ).toContain('3/4');

    // Sold-out WP offer shows SOLD OUT mark & disabled Buy button
    const soldWpCard = container!.querySelector(
      '[data-testid="wp-offer-card-wp_stone_1"]'
    );
    expect(
      soldWpCard?.querySelector('[data-testid="shop-sold-out-badge"]')
        ?.textContent
    ).toBe('SOLD OUT');
    const soldWpBtn = soldWpCard?.querySelector('button') as HTMLButtonElement;
    expect(soldWpBtn.disabled).toBe(true);

    // Opening cards section marks owned cards
    const cardsSection = container!.querySelector(
      '[data-testid="shop-wp-cards-section"]'
    );
    expect(cardsSection?.textContent).toContain('Card Owned');

    // Paid WP refresh deducts SHOP_STOCK_CONFIG.wpRefreshCostWp (25 WP)
    const wpRefreshBtn = container!.querySelector(
      '[data-testid="shop-wp-refresh-btn"]'
    ) as HTMLButtonElement;
    expect(wpRefreshBtn.textContent).toContain(
      `${SHOP_STOCK_CONFIG.wpRefreshCostWp} WP`
    );
    act(() => {
      wpRefreshBtn.click();
    });
    expect(useGameStore.getState().pilot.warPoints).toBe(
      300 - SHOP_STOCK_CONFIG.wpRefreshCostWp
    );
  });

  it('renders icons on all ShopScreen and SkillView tab rows without overflow-x-auto horizontal scrolling', () => {
    useGameStore.setState((s) => ({
      ...s,
      shopSubTab: 'buy',
    }));

    act(() => {
      root!.render(createElement(ShopScreen));
    });

    // Shop slot tabs: all + 6 slots, each with an SVG icon, wrapped, no overflow-x-auto
    const slotTabsRow = container!.querySelector(
      '[data-testid="shop-slot-tabs"]'
    ) as HTMLElement;
    expect(slotTabsRow.className).toContain('flex-wrap');
    expect(slotTabsRow.className).not.toContain('overflow-x-auto');
    expect(
      slotTabsRow.querySelectorAll('button svg').length
    ).toBe(1 + EQUIPMENT_SLOTS.length);

    // Shop class filter tabs: wrapped, each button has an SVG icon
    const shopClassTabsRow = container!.querySelector(
      '[data-testid="shop-class-tabs"]'
    ) as HTMLElement;
    expect(shopClassTabsRow.className).toContain('flex-wrap');
    expect(shopClassTabsRow.className).not.toContain('overflow-x-auto');
    const shopClassButtons = shopClassTabsRow.querySelectorAll('button');
    expect(shopClassButtons.length).toBe(7); // all + usable + universal + 4 classes
    shopClassButtons.forEach((btn) => {
      expect(btn.querySelector('svg')).not.toBeNull();
    });

    // Switch to WP tab to inspect WP class filter tabs
    act(() => {
      useGameStore.getState().setShopSubTab('warpoints');
    });
    const wpClassTabsRow = container!.querySelector(
      '[data-testid="shop-wp-class-tabs"]'
    ) as HTMLElement;
    expect(wpClassTabsRow.className).toContain('flex-wrap');
    expect(wpClassTabsRow.className).not.toContain('overflow-x-auto');
    const wpClassButtons = wpClassTabsRow.querySelectorAll('button');
    expect(wpClassButtons.length).toBe(5); // all + 4 classes
    wpClassButtons.forEach((btn) => {
      expect(btn.querySelector('svg')).not.toBeNull();
    });

    // Render SkillView and check its 4 filter tabs
    act(() => {
      root!.render(createElement(SkillView));
    });
    const skillFilterRow = container!.querySelector(
      '[data-testid="skill-filter-tabs"]'
    ) as HTMLElement;
    expect(skillFilterRow.className).toContain('flex-wrap');
    expect(skillFilterRow.className).not.toContain('overflow-x-auto');
    const skillFilterButtons = skillFilterRow.querySelectorAll('button');
    expect(skillFilterButtons.length).toBe(4);
    skillFilterButtons.forEach((btn) => {
      expect(btn.querySelector('svg')).not.toBeNull();
    });
  });
});
