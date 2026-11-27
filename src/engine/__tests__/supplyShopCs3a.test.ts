import { beforeEach, describe, expect, it } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../../data/consumables';
import { SHOP_CONFIG } from '../../data/items';
import { OPENING_CARDS_LIST } from '../../data/skills';
import { useGameStore } from '../../store/useGameStore';
import { computeSupplyPrice } from '../itemPrice';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import {
  buildExportEnvelope,
  decryptEnvelope,
  parseImportEnvelope,
} from '../saveExport';
import {
  generateSupplyShopStock,
  sanitizeSupplyShopConfig,
  sanitizeSupplyShopStock,
} from '../shop';
import { getSupplyStockCount, SUPPLY_STACK_CAP } from '../supplies';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TASK CS3a — Supply Shop Stock, Buy/Sell, Persistence & Opening Card Costs x10', () => {
  beforeEach(() => {
    const fresh = createFreshCampaignState('Vance', 'striker', makeSeededRng(42));
    useGameStore.setState({
      ...fresh,
      supplyShopStock: fresh.supplyShopStock ?? [],
      screen: 'HANGAR',
      battle: null,
      autoRepeatSession: null,
    });
  });

  it('1) generateSupplyShopStock stays within admin ranges, picks distinct unlocked templates, and clamps min > max', () => {
    const clamped = sanitizeSupplyShopConfig({
      supplyShopMinTypes: 8,
      supplyShopMaxTypes: 3, // min > max -> max bumped to 8
      supplyShopMinQty: 20,
      supplyShopMaxQty: 5, // min > max -> max bumped to 20
    });
    expect(clamped).toEqual({
      supplyShopMinTypes: 8,
      supplyShopMaxTypes: 8,
      supplyShopMinQty: 20,
      supplyShopMaxQty: 20,
    });

    const rng = makeSeededRng(101);
    const lowLvStock = generateSupplyShopStock(
      1,
      {
        supplyShopMinTypes: 2,
        supplyShopMaxTypes: 5,
        supplyShopMinQty: 3,
        supplyShopMaxQty: 15,
      },
      SUPPLY_TEMPLATES,
      rng
    );
    // Only 3 unlockLevel <= 1 templates exist, so capped at eligible count (3)
    expect(lowLvStock.length).toBeGreaterThanOrEqual(2);
    expect(lowLvStock.length).toBeLessThanOrEqual(3);
    expect(new Set(lowLvStock.map((r) => r.templateId)).size).toBe(
      lowLvStock.length
    );
    for (const row of lowLvStock) {
      const tpl = getSupplyTemplateById(row.templateId)!;
      expect(tpl.unlockLevel).toBeLessThanOrEqual(1);
      expect(row.remaining).toBeGreaterThanOrEqual(3);
      expect(row.remaining).toBeLessThanOrEqual(15);
    }

    const highLvStock = generateSupplyShopStock(
      35,
      {
        supplyShopMinTypes: 6,
        supplyShopMaxTypes: 4, // clamped to 6..6
        supplyShopMinQty: 10,
        supplyShopMaxQty: 12,
      },
      SUPPLY_TEMPLATES,
      rng
    );
    expect(highLvStock).toHaveLength(6);
    expect(new Set(highLvStock.map((r) => r.templateId)).size).toBe(6);
    for (const row of highLvStock) {
      expect(row.remaining).toBeGreaterThanOrEqual(10);
      expect(row.remaining).toBeLessThanOrEqual(12);
    }
  });

  it('2) buySupply deducts credits, lowers remaining, respects stack cap 99, and refuses sold-out / short-credits', () => {
    const tpl = getSupplyTemplateById('sup_hp_t1')!;
    const unitPrice = computeSupplyPrice(tpl);

    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        credits: unitPrice * 5 - 1, // short by 1 credit for 5
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 95,
          },
        ],
      },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 10 }],
    }));

    // Room under 99 is 4, so bought would be 4 (afforded by unitPrice*5 - 1). Test short credits first on another qty:
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        credits: unitPrice * 2 - 1,
      },
    }));
    const shortRes = useGameStore.getState().buySupply('sup_hp_t1', 2);
    expect(shortRes.ok).toBe(false);
    expect(shortRes.reason).toBe('insufficient_credits');
    expect(useGameStore.getState().supplyShopStock[0].remaining).toBe(10);

    // Grant plenty of credits; ask for 8, remaining is 10, room under 99 is 4 -> buys 4
    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, credits: 50000 },
    }));
    const cappedRes = useGameStore.getState().buySupply('sup_hp_t1', 8);
    expect(cappedRes).toEqual({ ok: true, bought: 4 });
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_hp_t1')
    ).toBe(SUPPLY_STACK_CAP);
    expect(useGameStore.getState().supplyShopStock[0].remaining).toBe(6);
    expect(useGameStore.getState().pilot.credits).toBe(50000 - unitPrice * 4);

    // Stack full refuses
    const fullRes = useGameStore.getState().buySupply('sup_hp_t1', 1);
    expect(fullRes.ok).toBe(false);
    expect(fullRes.reason).toBe('stack_full');

    // Clear owned stack, buy over remaining (asks 10 when remaining is 6) -> buys 6, remaining stays at 0, then refuses sold_out
    useGameStore.setState((s) => ({
      ...s,
      pilot: { ...s.pilot, consumables: [] },
    }));
    const clearRes = useGameStore.getState().buySupply('sup_hp_t1', 10);
    expect(clearRes).toEqual({ ok: true, bought: 6 });
    expect(useGameStore.getState().supplyShopStock[0]).toEqual({
      templateId: 'sup_hp_t1',
      remaining: 0,
    });
    const soldOutRes = useGameStore.getState().buySupply('sup_hp_t1', 1);
    expect(soldOutRes.ok).toBe(false);
    expect(soldOutRes.reason).toBe('sold_out');

    // Not in shop refuses
    expect(useGameStore.getState().buySupply('sup_sp_t1', 1).reason).toBe(
      'not_in_stock'
    );
  });

  it('3) sellSupply pays round(price * sellRatio), lowers owned stock, and does not add to shop stock', () => {
    const tpl = getSupplyTemplateById('sup_shield_t1')!;
    const unitSell = Math.round(
      computeSupplyPrice(tpl) * SHOP_CONFIG.sellPriceRatio
    );

    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        credits: 100,
        consumables: [
          {
            id: 'supply_sup_shield_t1',
            kind: 'battle_supply',
            templateId: 'sup_shield_t1',
            quantity: 5,
          },
        ],
      },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 4 }],
    }));

    const res = useGameStore.getState().sellSupply('sup_shield_t1', 3);
    expect(res).toEqual({ ok: true, sold: 3, creditsEarned: unitSell * 3 });
    expect(useGameStore.getState().pilot.credits).toBe(100 + unitSell * 3);
    expect(
      getSupplyStockCount(
        useGameStore.getState().pilot.consumables,
        'sup_shield_t1'
      )
    ).toBe(2);
    expect(useGameStore.getState().supplyShopStock).toEqual([
      { templateId: 'sup_hp_t1', remaining: 4 },
    ]);
  });

  it('4) supplyShopStock survives SV1a export/import, drops unknown IDs, clamps 0..99, and rolls once for old saves missing it', async () => {
    const snapshot = useGameStore.getState().exportSaveStateSnapshot();
    const customStock = [
      { templateId: 'sup_hp_t1', remaining: 7 },
      { templateId: 'sup_shield_t1', remaining: 0 },
    ];
    snapshot.supplyShopStock = customStock;

    const envelope = await buildExportEnvelope(snapshot, '1234', {
      saveVersion: CURRENT_SAVE_VERSION,
    });
    const parsed = await parseImportEnvelope(JSON.stringify(envelope));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const decrypted = await decryptEnvelope(parsed.envelope, '1234');
    expect(decrypted.ok).toBe(true);
    if (!decrypted.ok) return;

    const importRes = useGameStore
      .getState()
      .importSaveFromEnvelope(decrypted.state, parsed.envelope.saveVersion);
    expect(importRes.ok).toBe(true);
    expect(useGameStore.getState().supplyShopStock).toEqual(customStock);

    // Unknown IDs dropped + remaining clamped 0..99
    expect(
      sanitizeSupplyShopStock([
        { templateId: 'unknown_item', remaining: 10 },
        { templateId: 'sup_hp_t1', remaining: 250 },
        { templateId: 'sup_sp_t1', remaining: -5 },
      ])
    ).toEqual([
      { templateId: 'sup_hp_t1', remaining: 99 },
      { templateId: 'sup_sp_t1', remaining: 0 },
    ]);

    // Old save missing supplyShopStock rolls once on migration
    const legacyPayload = {
      ...snapshot,
      supplyShopStock: undefined,
    };
    const migrated = migrateSaveData(
      legacyPayload,
      CURRENT_SAVE_VERSION,
      makeSeededRng(7)
    );
    expect(Array.isArray(migrated.supplyShopStock)).toBe(true);
    expect(migrated.supplyShopStock!.length).toBeGreaterThanOrEqual(2);
  });

  it('5) opening card costs are 800 (special) / 1600 (elite) and OPENING_CARDS_LIST reads them', () => {
    expect(BALANCE_CONFIG.openingCardCosts).toEqual({
      special: 800,
      elite: 1600,
    });
    const specialCard = OPENING_CARDS_LIST.find((c) => c.category === 'special');
    const eliteCard = OPENING_CARDS_LIST.find((c) => c.category === 'elite');
    expect(specialCard?.warPointCost).toBe(800);
    expect(eliteCard?.warPointCost).toBe(1600);
  });
});
