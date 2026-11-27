// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../../data/consumables';
import { useGameStore } from '../../store/useGameStore';
import { computeSupplyPrice } from '../itemPrice';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import {
  generateSupplyShopStock,
  generateSupplyShopStockWp,
  getSupplyWpPrice,
} from '../shop';
import { getSupplyStockCount } from '../supplies';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TASK SHOP-V2a — Supply Shop CREDIT + WP + Limited Refreshes', () => {
  beforeEach(() => {
    const fresh = createFreshCampaignState('Vance', 'striker', makeSeededRng(42));
    useGameStore.setState({
      ...fresh,
      supplyShopStock: fresh.supplyShopStock ?? [],
      supplyShopStockWp: fresh.supplyShopStockWp ?? [],
      supplyShopRefresh: fresh.supplyShopRefresh ?? { used: 0 },
      screen: 'HANGAR',
      battle: null,
      autoRepeatSession: null,
    });
  });

  it('1) CREDIT area with 5 slots never all one family over 50 seeded rolls, and migrates legacy 2/5/3/15 only', () => {
    const def = createDefaultAdminConfig();
    expect(def.supplyShopMinTypes).toBe(3);
    expect(def.supplyShopMaxTypes).toBe(10);
    expect(def.supplyShopMinQty).toBe(10);
    expect(def.supplyShopMaxQty).toBe(50);

    for (let seed = 1; seed <= 50; seed++) {
      const stock = generateSupplyShopStock(
        40,
        {
          supplyShopMinTypes: 5,
          supplyShopMaxTypes: 5,
          supplyShopMinQty: 10,
          supplyShopMaxQty: 50,
        },
        SUPPLY_TEMPLATES,
        makeSeededRng(seed)
      );
      expect(stock).toHaveLength(5);
      const families = new Set(
        stock.map((s) => getSupplyTemplateById(s.templateId)!.family)
      );
      expect(families.size).toBeGreaterThanOrEqual(2);
    }

    const fresh = createFreshCampaignState('Vance', 'striker', makeSeededRng(7));
    const migratedLegacy = migrateSaveData(
      {
        ...fresh,
        adminConfig: {
          ...fresh.adminConfig,
          supplyShopMinTypes: 2,
          supplyShopMaxTypes: 5,
          supplyShopMinQty: 3,
          supplyShopMaxQty: 15,
        },
      },
      CURRENT_SAVE_VERSION,
      makeSeededRng(7)
    );
    expect(migratedLegacy.adminConfig.supplyShopMinTypes).toBe(3);
    expect(migratedLegacy.adminConfig.supplyShopMaxTypes).toBe(10);
    expect(migratedLegacy.adminConfig.supplyShopMinQty).toBe(10);
    expect(migratedLegacy.adminConfig.supplyShopMaxQty).toBe(50);

    const migratedCustom = migrateSaveData(
      {
        ...fresh,
        adminConfig: {
          ...fresh.adminConfig,
          supplyShopMinTypes: 2,
          supplyShopMaxTypes: 6,
          supplyShopMinQty: 3,
          supplyShopMaxQty: 15,
        },
      },
      CURRENT_SAVE_VERSION,
      makeSeededRng(7)
    );
    expect(migratedCustom.adminConfig.supplyShopMaxTypes).toBe(6);
  });

  it('2) WP stock count is 2x creditCount (min 3), includes hp_kit + sp_kit + shield_kit, and keeps tier >= 3 when available', () => {
    const minStock = generateSupplyShopStockWp(
      40,
      createDefaultAdminConfig(),
      1,
      SUPPLY_TEMPLATES,
      makeSeededRng(11)
    );
    expect(minStock).toHaveLength(3);

    const wpStock = generateSupplyShopStockWp(
      40,
      createDefaultAdminConfig(),
      5,
      SUPPLY_TEMPLATES,
      makeSeededRng(12)
    );
    expect(wpStock).toHaveLength(10);

    const fams = wpStock.map(
      (s) => getSupplyTemplateById(s.templateId)!.family
    );
    expect(fams).toContain('hp_kit');
    expect(fams).toContain('sp_kit');
    expect(fams).toContain('shield_kit');

    for (const row of wpStock) {
      const tpl = getSupplyTemplateById(row.templateId)!;
      if (tpl.family !== 'utility') {
        expect(tpl.tier).toBeGreaterThanOrEqual(3);
      }
      expect(row.remaining).toBeGreaterThanOrEqual(10);
      expect(row.remaining).toBeLessThanOrEqual(50);
    }
  });

  it('3) WP duplicates can appear but never exceed supplyWpMaxCopies', () => {
    const cfg = {
      ...createDefaultAdminConfig(),
      supplyWpDupWeight: 1,
      supplyWpMaxCopies: 2,
    };
    let sawDuplicate = false;
    for (let seed = 1; seed <= 20; seed++) {
      const stock = generateSupplyShopStockWp(
        40,
        cfg,
        6,
        SUPPLY_TEMPLATES,
        makeSeededRng(seed)
      );
      const counts = new Map<string, number>();
      for (const row of stock) {
        counts.set(row.templateId, (counts.get(row.templateId) ?? 0) + 1);
      }
      for (const count of counts.values()) {
        expect(count).toBeLessThanOrEqual(2);
        if (count > 1) sawDuplicate = true;
      }
    }
    expect(sawDuplicate).toBe(true);
  });

  it('4) refreshSupplyShop costs 0 / 1000 / 2000 then returns limit, and auto-restock resets used', () => {
    const st0 = useGameStore.getState();
    const initialGearShop = st0.shopStock;
    useGameStore.setState({
      pilot: { ...st0.pilot, credits: 5000 },
      battlesUntilRestock: 2,
    });

    const r1 = useGameStore.getState().refreshSupplyShop();
    expect(r1).toEqual({ ok: true, cost: 0 });
    expect(useGameStore.getState().pilot.credits).toBe(5000);
    expect(useGameStore.getState().shopStock).toBe(initialGearShop);

    const r2 = useGameStore.getState().refreshSupplyShop();
    expect(r2).toEqual({ ok: true, cost: 1000 });
    expect(useGameStore.getState().pilot.credits).toBe(4000);

    const r3 = useGameStore.getState().refreshSupplyShop();
    expect(r3).toEqual({ ok: true, cost: 2000 });
    expect(useGameStore.getState().pilot.credits).toBe(2000);
    expect(useGameStore.getState().supplyShopRefresh.used).toBe(3);

    const r4 = useGameStore.getState().refreshSupplyShop();
    expect(r4).toEqual({ ok: false, reason: 'limit', battlesLeft: 2 });

    useGameStore.getState().advanceMonth();
    expect(useGameStore.getState().supplyShopRefresh.used).toBe(0);
  });

  it('5) buySupplyWp pays warPoints at round(CR price / 5) and sellSupply pays credits only', () => {
    const tpl = getSupplyTemplateById('sup_hp_t3')!;
    const expectedWp = Math.max(1, Math.round(computeSupplyPrice(tpl) / 5));
    expect(getSupplyWpPrice(tpl, createDefaultAdminConfig())).toBe(expectedWp);

    const cur = useGameStore.getState();
    useGameStore.setState({
      pilot: { ...cur.pilot, credits: 100, warPoints: 500 },
      supplyShopStockWp: [
        { slotId: 'wp-0-sup_hp_t3', templateId: 'sup_hp_t3', remaining: 10 },
      ],
    });

    const buyRes = useGameStore
      .getState()
      .buySupplyWp('wp-0-sup_hp_t3', 3);
    expect(buyRes).toEqual({ ok: true, bought: 3 });

    const afterBuy = useGameStore.getState();
    expect(afterBuy.pilot.warPoints).toBe(500 - expectedWp * 3);
    expect(afterBuy.pilot.credits).toBe(100);
    expect(afterBuy.supplyShopStockWp[0].remaining).toBe(7);
    expect(getSupplyStockCount(afterBuy.pilot.consumables, 'sup_hp_t3')).toBe(3);

    const sellRes = useGameStore.getState().sellSupply('sup_hp_t3', 2);
    expect(sellRes.ok).toBe(true);
    expect(sellRes.creditsEarned).toBeGreaterThan(0);

    const afterSell = useGameStore.getState();
    expect(afterSell.pilot.warPoints).toBe(500 - expectedWp * 3);
    expect(afterSell.pilot.credits).toBe(100 + sellRes.creditsEarned);
  });
});
