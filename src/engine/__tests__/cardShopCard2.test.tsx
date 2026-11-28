// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ShopScreen } from '../../components/ShopScreen';
import { SkillView } from '../../components/SkillView';
import { getOpeningCardsList } from '../../data/skills';
import { useGameStore } from '../../store/useGameStore';
import {
  DEFAULT_CARD_SHOP_CONFIG,
  DEFAULT_CARD_SHOP_KIND_CONFIG,
  getCardAppearRate,
  rollCardShopStock,
} from '../cardShop';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

describe('CARD-2 — WP shop skill cards appear by chance', () => {
  it('1) getCardAppearRate follows formula and clamps by minRatePct at Lv1/Lv30/Lv100', () => {
    const cfg = DEFAULT_CARD_SHOP_KIND_CONFIG;
    expect(getCardAppearRate({ unlockLevel: 1 }, cfg)).toBe(10);
    expect(getCardAppearRate({ unlockLevel: 30 }, cfg)).toBe(5.5);
    expect(getCardAppearRate({ unlockLevel: 100 }, cfg)).toBe(1);
  });

  it('2) rollCardShopStock excludes owned cards and is deterministic for a fixed seed', () => {
    const allCards = getOpeningCardsList();
    expect(allCards.length).toBeGreaterThan(2);
    const owned = [allCards[0].id, allCards[1].id];

    const rollA = rollCardShopStock(owned, { cardShop: DEFAULT_CARD_SHOP_CONFIG }, makeSeededRng(12345));
    const rollB = rollCardShopStock(owned, { cardShop: DEFAULT_CARD_SHOP_CONFIG }, makeSeededRng(12345));

    expect(rollA).toEqual(rollB);
    expect(rollA).not.toContain(owned[0]);
    expect(rollA).not.toContain(owned[1]);

    // With 100% rate, all unowned appear and owned stay excluded
    const allRateConfig = {
      cardShop: {
        enabled: true,
        active: { baseRatePct: 100, stepPct: 0, stepLevels: 10, minRatePct: 100 },
        passive: { baseRatePct: 100, stepPct: 0, stepLevels: 10, minRatePct: 100 },
      },
    };
    const allUnowned = rollCardShopStock(owned, allRateConfig, () => 0.99);
    expect(allUnowned).toHaveLength(allCards.length - owned.length);
    expect(allUnowned).not.toContain(owned[0]);
    expect(allUnowned).not.toContain(owned[1]);

    // Active vs passive separation: passive 0% excludes passive cards while keeping active cards
    const activeOnlyConfig = {
      cardShop: {
        enabled: true,
        active: { baseRatePct: 100, stepPct: 0, stepLevels: 10, minRatePct: 100 },
        passive: { baseRatePct: 0, stepPct: 0, stepLevels: 10, minRatePct: 0 },
      },
    };
    const activeOnlyIds = rollCardShopStock([], activeOnlyConfig, () => 0);
    expect(activeOnlyIds.length).toBeGreaterThan(0);
    expect(activeOnlyIds.length).toBeLessThan(allCards.length);
  });

  it('3) buying a card removes it from cardShopStockWp, and old saves missing the field roll once', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('CardBuyer', 'striker');
    const allCards = getOpeningCardsList(useGameStore.getState().adminConfig);
    const target = allCards[0];
    const second = allCards[1];

    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        warPoints: 50000,
        ownedOpeningCards: [],
      },
      cardShopStockWp: [target.id, second.id],
    }));

    const buyRes = useGameStore.getState().buyOpeningCardAction(target.id);
    expect(buyRes.ok).toBe(true);
    expect(useGameStore.getState().pilot.ownedOpeningCards).toContain(target.id);
    expect(useGameStore.getState().cardShopStockWp).toEqual([second.id]);

    // Missing field -> rolls once on migration
    const baseSave = createFreshCampaignState('Legacy', 'striker', makeSeededRng(7));
    const withoutField: Record<string, unknown> = { ...baseSave };
    delete withoutField.cardShopStockWp;
    const migratedMissing = migrateSaveData(
      withoutField,
      CURRENT_SAVE_VERSION,
      () => 0 // ensures < every non-zero rate so deterministic roll is non-empty
    );
    expect(Array.isArray(migratedMissing.cardShopStockWp)).toBe(true);
    expect((migratedMissing.cardShopStockWp ?? []).length).toBeGreaterThan(0);

    // Explicit empty array -> preserved as []
    const withEmptyField = { ...baseSave, cardShopStockWp: [] };
    const migratedEmpty = migrateSaveData(
      withEmptyField,
      CURRENT_SAVE_VERSION,
      () => 0
    );
    expect(migratedEmpty.cardShopStockWp).toEqual([]);
  });

  it('4) enabled=false lists all cards; enabled=true shows empty text in ShopScreen and grey text in SkillView when absent', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('ShopViewer', 'striker');
    const allCards = getOpeningCardsList(useGameStore.getState().adminConfig);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Empty stock with enabled=true -> ShopScreen empty message & SkillView grey text
    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        language: 'vi',
        shopSubTab: 'warpoints',
        cardShopStockWp: [],
        adminConfig: {
          ...s.adminConfig,
          cardShop: { ...DEFAULT_CARD_SHOP_CONFIG, enabled: true },
        },
      }));
      root!.render(createElement(ShopScreen));
    });
    expect(
      container.querySelector('[data-testid="shop-wp-cards-empty"]')?.textContent
    ).toContain('Hôm nay chưa có thẻ kỹ năng nào');

    act(() => {
      root!.render(createElement(SkillView));
    });
    expect(container.textContent).toContain('Thẻ chưa xuất hiện ở Chợ WP');
    expect(container.textContent).not.toContain('Mua Thẻ (Chợ WP) →');

    // enabled=false -> ShopScreen lists every card regardless of empty cardShopStockWp
    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        shopSubTab: 'warpoints',
        cardShopStockWp: [],
        adminConfig: {
          ...s.adminConfig,
          cardShop: { ...DEFAULT_CARD_SHOP_CONFIG, enabled: false },
        },
      }));
      root!.render(createElement(ShopScreen));
    });
    expect(
      container.querySelector('[data-testid="shop-wp-cards-empty"]')
    ).toBeNull();
    const desktopCards = container.querySelectorAll(
      '[data-testid="shop-wp-cards-section"] .md\\:grid > div'
    );
    expect(desktopCards.length).toBe(allCards.length);
  });
});
