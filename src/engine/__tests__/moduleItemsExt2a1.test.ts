import { describe, expect, it } from 'vitest';
import { EQUIPMENT_SLOTS, ITEM_SLOTS, ITEM_TEMPLATES, getItemTemplate } from '../../data/items';
import { MODULE_ITEM_TEMPLATES, MODULE_TEMPLATES } from '../../data/modules';
import { SECTORS_CATALOG } from '../../data/maps';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import type { CombatUnit, InventorySlotFilter } from '../../types/game';
import {
  generateItemInstance,
  getEnchantMetadata,
  resolveEnchantAttempt,
  rollBattleItemDrops,
} from '../equipment';
import { filterAndSortInventory, getDefaultInventoryFilterState } from '../inventory';
import { DEFAULT_ITEM_LEVELS_CONFIG } from '../itemLevels';
import { computeModulePrice } from '../itemPrice';
import { createFreshCampaignState } from '../migration';
import { DEFAULT_MODULE_DROP_CONFIG } from '../moduleDrop';

function createRng(seed = 20261124): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('EXT2a-1 — Modules as slot "module" items', () => {
  it('(1) ITEM_SLOTS has 8 entries with module last and EQUIPMENT_SLOTS stays 7 paper-doll slots', () => {
    expect(EQUIPMENT_SLOTS).toHaveLength(7);
    expect(EQUIPMENT_SLOTS).not.toContain('module');
    expect(ITEM_SLOTS).toHaveLength(8);
    expect(ITEM_SLOTS.slice(0, 7)).toEqual(EQUIPMENT_SLOTS);
    expect(ITEM_SLOTS[7]).toBe('module');
  });

  it('(2) loads 36 MODULE_ITEM_TEMPLATES into ITEM_TEMPLATES with fixed ranges and computeModulePrice', () => {
    expect(MODULE_TEMPLATES).toHaveLength(36);
    expect(MODULE_ITEM_TEMPLATES).toHaveLength(36);

    for (const mod of MODULE_TEMPLATES) {
      const tpl = getItemTemplate(mod.id);
      expect(tpl).toBeDefined();
      expect(tpl?.slot).toBe('module');
      expect(tpl?.classRestriction).toBeNull();
      expect(tpl?.basePrice).toBe(computeModulePrice(mod));
      expect(ITEM_TEMPLATES.some((it) => it.id === mod.id)).toBe(true);
      if (mod.family === 'stat') {
        expect(tpl?.primaryStat).toBe(mod.effectKey);
        expect(tpl?.primaryRange).toEqual([mod.value, mod.value]);
      } else {
        expect(tpl?.primaryStat).toBe('attack');
        expect(tpl?.primaryRange).toEqual([0, 0]);
        expect(tpl?.specialTraits).toEqual({ [mod.effectKey]: mod.value });
      }
    }
  });

  it('(3) generateItemInstance for a module is common, no affixes, roll 100, fixed value/trait, and not enchantable', () => {
    const statMod = MODULE_TEMPLATES.find((m) => m.family === 'stat')!;
    const traitMod = MODULE_TEMPLATES.find((m) => m.family === 'trait')!;

    const statInst = generateItemInstance({ templateId: statMod.id, rarity: 'legendary', rollQuality: 50 }, createRng(1));
    expect(statInst.slot).toBe('module');
    expect(statInst.rarity).toBe('common');
    expect(statInst.affixes).toEqual([]);
    expect(statInst.suffixId).toBeNull();
    expect(statInst.rollQuality).toBe(100);
    expect(statInst.enchantLevel).toBe(0);
    expect(statInst.rolledBaseStats).toEqual({ [statMod.effectKey]: statMod.value });
    expect(statInst.price).toBe(computeModulePrice(statMod));

    const traitInst = generateItemInstance({ templateId: traitMod.id }, createRng(2));
    expect(traitInst.rarity).toBe('common');
    expect(traitInst.rolledBaseStats).toEqual({});
    expect(traitInst.specialTraits).toEqual({ [traitMod.effectKey]: traitMod.value });

    const meta = getEnchantMetadata(statInst);
    expect(meta.isMax).toBe(true);
    expect(meta.enchantable).toBe(false);
    expect(meta.cost).toBe(0);
    expect(meta.successRate).toBe(0);

    const attempt = resolveEnchantAttempt(statInst, 99999, createRng(3));
    expect(attempt.result.attempted).toBe(false);
    expect(attempt.result.code).toBe('not_enchantable');
    expect(attempt.remainingCredits).toBe(99999);
  });

  it('(4) battle drops with moduleDrop factor=0 and un-templated generateItemInstance never contain a module', () => {
    const rng = createRng(777);
    const deadEnemies = Array.from({ length: 6 }, (_, idx) => ({
      id: `enemy_${idx}`,
      alive: false,
    })) as unknown as CombatUnit[];

    const drops = rollBattleItemDrops(
      deadEnemies,
      SECTORS_CATALOG[0].id,
      10,
      true,
      rng,
      DEFAULT_ITEM_LEVELS_CONFIG,
      { ...DEFAULT_MODULE_DROP_CONFIG, factor: 0 }
    );
    const randomAdminModuleGuard = generateItemInstance({ slot: 'module', tier: 2 }, rng);

    expect(drops.some((it) => it.slot === 'module')).toBe(false);
    expect(randomAdminModuleGuard.slot).not.toBe('module');
  });

  it('(5) InventorySlotFilter accepts "module", filters module items, and slot.module exists in vi and en', () => {
    const slotFilter: InventorySlotFilter = 'module';
    const campaign = createFreshCampaignState();
    const activeGear = campaign.pilot.gears[campaign.pilot.activeGearId];
    const modInst = generateItemInstance({ templateId: MODULE_TEMPLATES[0].id }, createRng(9));
    const weaponInst = generateItemInstance({ slot: 'main_weapon', tier: 1 }, createRng(10));

    const results = filterAndSortInventory(
      [modInst, weaponInst],
      { ...getDefaultInventoryFilterState(), slot: slotFilter },
      activeGear,
      campaign.pilot.gears
    );

    expect(results.map((r) => r.item.instanceId)).toEqual([modInst.instanceId]);
    expect(VI_TRANSLATIONS['slot.module']).toBe('Mô-đun');
    expect(EN_TRANSLATIONS['slot.module']).toBe('Module');
    expect(VI_TRANSLATIONS['slotShort.module']).toBe('MÔ-ĐUN');
    expect(EN_TRANSLATIONS['slotShort.module']).toBe('MODULE');
  });
});
