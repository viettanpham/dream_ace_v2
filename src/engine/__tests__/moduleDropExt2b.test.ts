import { describe, expect, it } from 'vitest';
import { SECTORS_CATALOG } from '../../data/maps';
import { getModuleTemplateById } from '../../data/modules';
import type { CombatUnit, ModuleDropConfig } from '../../types/game';
import { generateShopStock, rollBattleItemDrops } from '../equipment';
import { DEFAULT_ITEM_LEVELS_CONFIG } from '../itemLevels';
import { computeModulePrice } from '../itemPrice';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import {
  DEFAULT_MODULE_DROP_CONFIG,
  DEFAULT_MODULE_DROP_WEIGHTS,
  MODULE_DROP_EFFECT_KEYS,
  sanitizeModuleDropConfig,
} from '../moduleDrop';
import { generateCategorizedShopStock } from '../shop';

function createRng(seed = 20261126): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeDefeatedEnemy(id: string, isBoss = false): CombatUnit {
  return {
    id,
    alive: false,
    isBoss,
  } as unknown as CombatUnit;
}

describe('EXT2b — Module drops, shop stock & Admin sanitize', () => {
  it('(1) keeps normal drops identical for same seed; factor 0 drops no modules', () => {
    const enemies = [
      makeDefeatedEnemy('e1', false),
      makeDefeatedEnemy('e2', false),
      makeDefeatedEnemy('boss', true),
    ];
    const sectorId = SECTORS_CATALOG[0].id;

    const dropsZero = rollBattleItemDrops(
      enemies,
      sectorId,
      10,
      true,
      createRng(4242),
      DEFAULT_ITEM_LEVELS_CONFIG,
      { ...DEFAULT_MODULE_DROP_CONFIG, factor: 0 }
    );
    const dropsWithMod = rollBattleItemDrops(
      enemies,
      sectorId,
      10,
      true,
      createRng(4242),
      DEFAULT_ITEM_LEVELS_CONFIG,
      { ...DEFAULT_MODULE_DROP_CONFIG, factor: 1 }
    );

    expect(dropsZero.some((d) => d.slot === 'module')).toBe(false);
    const normalFromZero = dropsZero.map((d) => ({
      templateId: d.templateId,
      slot: d.slot,
      rarity: d.rarity,
      rolledBaseStats: d.rolledBaseStats,
      affixes: d.affixes,
      price: d.price,
    }));
    const normalFromWithMod = dropsWithMod
      .filter((d) => d.slot !== 'module')
      .map((d) => ({
        templateId: d.templateId,
        slot: d.slot,
        rarity: d.rarity,
        rolledBaseStats: d.rolledBaseStats,
        affixes: d.affixes,
        price: d.price,
      }));
    expect(normalFromWithMod).toEqual(normalFromZero);
  });

  it('(2) factor 1 drops 1 valid module for defeated boss and caps at max 1 module even with multiple defeated enemies', () => {
    const singleBoss = [makeDefeatedEnemy('boss', true)];
    const multiBosses = Array.from({ length: 5 }, (_, i) =>
      makeDefeatedEnemy(`boss_${i}`, true)
    );
    const sectorId = SECTORS_CATALOG[0].id;
    const cfg: ModuleDropConfig = { ...DEFAULT_MODULE_DROP_CONFIG, factor: 1 };

    const dropsSingle = rollBattleItemDrops(
      singleBoss,
      sectorId,
      10,
      true,
      createRng(101),
      DEFAULT_ITEM_LEVELS_CONFIG,
      cfg
    );
    const modsSingle = dropsSingle.filter((d) => d.slot === 'module');
    expect(modsSingle).toHaveLength(1);
    expect(modsSingle[0].rarity).toBe('common');
    expect(modsSingle[0].affixes).toEqual([]);

    const dropsMulti = rollBattleItemDrops(
      multiBosses,
      sectorId,
      10,
      true,
      createRng(202),
      DEFAULT_ITEM_LEVELS_CONFIG,
      cfg
    );
    expect(dropsMulti.filter((d) => d.slot === 'module')).toHaveLength(1);
  });

  it('(3) shield-only effectWeights always drops shield module and level window prevents T4 drop at low level', () => {
    const zeroWeights = Object.fromEntries(
      MODULE_DROP_EFFECT_KEYS.map((k) => [k, 0])
    ) as Record<(typeof MODULE_DROP_EFFECT_KEYS)[number], number>;
    const shieldOnlyCfg: ModuleDropConfig = {
      factor: 1,
      shopCount: 1,
      effectWeights: {
        ...zeroWeights,
        shield: 50,
      },
    };
    const enemies = [makeDefeatedEnemy('boss', true)];
    const sectorId = SECTORS_CATALOG[0].id;

    for (let seed = 1; seed <= 8; seed += 1) {
      const drops = rollBattleItemDrops(
        enemies,
        sectorId,
        10,
        true,
        createRng(seed),
        DEFAULT_ITEM_LEVELS_CONFIG,
        shieldOnlyCfg
      );
      const mods = drops.filter((d) => d.slot === 'module');
      expect(mods).toHaveLength(1);
      const modTpl = getModuleTemplateById(mods[0].templateId);
      expect(modTpl?.effectKey).toBe('shield');
      expect(mods[0].tier).toBeLessThan(4);
    }
  });

  it('(4) shop adds shopCount unique modules (0 adds none) and keeps normal items identical for same seed', () => {
    const sectorPriceMult = 1;
    const catZero = generateCategorizedShopStock(
      10,
      {
        priceMultiplier: sectorPriceMult,
        moduleDrop: { ...DEFAULT_MODULE_DROP_CONFIG, shopCount: 0 },
      },
      createRng(777)
    );
    const catTwo = generateCategorizedShopStock(
      10,
      {
        priceMultiplier: sectorPriceMult,
        moduleDrop: { ...DEFAULT_MODULE_DROP_CONFIG, shopCount: 2 },
      },
      createRng(777)
    );

    expect(catZero.some((i) => i.slot === 'module')).toBe(false);
    const catTwoMods = catTwo.filter((i) => i.slot === 'module');
    expect(catTwoMods).toHaveLength(2);
    expect(new Set(catTwoMods.map((m) => m.templateId)).size).toBe(2);
    for (const mod of catTwoMods) {
      const modTpl = getModuleTemplateById(mod.templateId)!;
      expect(mod.price).toBe(computeModulePrice(modTpl));
    }

    const normalStrip = (arr: typeof catZero) =>
      arr
        .filter((i) => i.slot !== 'module')
        .map((i) => ({
          templateId: i.templateId,
          rarity: i.rarity,
          rolledBaseStats: i.rolledBaseStats,
          price: i.price,
        }));
    expect(normalStrip(catTwo)).toEqual(normalStrip(catZero));

    const flatTwo = generateShopStock(
      10,
      12,
      createRng(888),
      DEFAULT_ITEM_LEVELS_CONFIG,
      { ...DEFAULT_MODULE_DROP_CONFIG, shopCount: 2 }
    );
    const flatMods = flatTwo.filter((i) => i.slot === 'module');
    expect(flatMods).toHaveLength(2);
    expect(new Set(flatMods.map((m) => m.templateId)).size).toBe(2);
  });

  it('(5) sanitizeModuleDropConfig clamps out-of-range, resets zero-sum weights, and migrates legacy save without version bump', () => {
    const clamped = sanitizeModuleDropConfig({
      factor: 5,
      shopCount: 9,
      effectWeights: {
        ...DEFAULT_MODULE_DROP_WEIGHTS,
        attack: 250,
        defense: -15,
      },
    });
    expect(clamped.factor).toBe(1);
    expect(clamped.shopCount).toBe(3);
    expect(clamped.effectWeights.attack).toBe(100);
    expect(clamped.effectWeights.defense).toBe(0);

    const zeroWeights = Object.fromEntries(
      MODULE_DROP_EFFECT_KEYS.map((k) => [k, 0])
    ) as Record<(typeof MODULE_DROP_EFFECT_KEYS)[number], number>;
    const resetZero = sanitizeModuleDropConfig({
      factor: 0.25,
      shopCount: 2,
      effectWeights: zeroWeights,
    });
    expect(resetZero.effectWeights).toEqual(DEFAULT_MODULE_DROP_WEIGHTS);

    const fresh = createFreshCampaignState('Tester', 'striker', createRng(11));
    const legacyAdmin = { ...fresh.adminConfig } as Record<string, unknown>;
    delete legacyAdmin.moduleDrop;
    const migrated = migrateSaveData(
      { ...fresh, adminConfig: legacyAdmin as unknown as typeof fresh.adminConfig },
      CURRENT_SAVE_VERSION,
      createRng(12)
    );
    expect(CURRENT_SAVE_VERSION).toBe(13);
    expect(migrated.adminConfig.moduleDrop).toEqual(DEFAULT_MODULE_DROP_CONFIG);
  });
});
