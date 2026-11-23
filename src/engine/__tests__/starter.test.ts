import { beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_ITEM_REGISTRY_TAG, EQUIPMENT_SLOTS } from '../../data/items';
import {
  cloneStarterSetConfig,
  DEFAULT_STARTER_SET_CONFIG,
  sanitizeStarterSetConfig,
} from '../../data/starterConfig';
import { useGameStore } from '../../store/useGameStore';
import {
  generateItemInstance,
  getEffectiveItemStats,
  getSellPrice,
} from '../equipment';
import { isItemUsableByGear } from '../inventory';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import {
  computeStarterEffectiveParams,
  fillEmptyStarterSlotsForPilot,
  generateStarterItemForSlot,
  grantStarterSetToGear,
} from '../starter';
import { createDefaultPilotAccount } from '../stats';

function createDeterministicRng(seed = 101): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('ST1 Starter Equipment Set Engine & Store', () => {
  beforeEach(() => {
    useGameStore.getState().resetCampaign();
  });

  it('gives full 6-slot Common Lv1 Starter equipment with sys tag and low sell price on new game', () => {
    const fresh = createFreshCampaignState('Rookie', 'interceptor', createDeterministicRng());
    const gear = fresh.pilot.gears.interceptor;
    expect(gear.owned).toBe(true);
    expect(fresh.pilot.inventory).toHaveLength(6);

    for (const slot of EQUIPMENT_SLOTS) {
      const instId = gear.equipped[slot];
      expect(instId).not.toBeNull();
      const item = fresh.pilot.inventory.find((i) => i.instanceId === instId);
      expect(item).toBeDefined();
      expect(item!.slot).toBe(slot);
      expect(item!.rarity).toBe('common');
      expect(item!.requiredLevel).toBe(1);
      expect(item!.isStarter).toBe(true);
      expect(item!.registryTag).toBe(BUILTIN_ITEM_REGISTRY_TAG);
      expect(isItemUsableByGear(item!, gear)).toBe(true);
      expect(getSellPrice(item!)).toBeLessThanOrEqual(10);
    }

    // Store startCampaign also equips full starter set on the starter Gear
    useGameStore.getState().startCampaign('Ace', 'siege');
    const storePilot = useGameStore.getState().pilot;
    for (const slot of EQUIPMENT_SLOTS) {
      const instId = storePilot.gears.siege.equipped[slot];
      expect(instId).not.toBeNull();
      const item = storePilot.inventory.find((i) => i.instanceId === instId);
      expect(item?.isStarter).toBe(true);
      expect(item?.registryTag).toBe('sys');
      expect(isItemUsableByGear(item!, storePilot.gears.siege)).toBe(true);
    }
  });

  it('auto-grants and equips class-compatible Starter items when buying or unlocking a new Gear', () => {
    const store = useGameStore.getState();
    store.startCampaign('Commander', 'striker');
    store.adminSetCredits(50000);

    const buyRes = useGameStore.getState().buyGear('support');
    expect(buyRes.ok).toBe(true);

    const afterBuy = useGameStore.getState().pilot;
    const supportGear = afterBuy.gears.support;
    expect(supportGear.owned).toBe(true);
    for (const slot of EQUIPMENT_SLOTS) {
      const instId = supportGear.equipped[slot];
      expect(instId).not.toBeNull();
      const item = afterBuy.inventory.find((i) => i.instanceId === instId);
      expect(item).toBeDefined();
      expect(item!.isStarter).toBe(true);
      expect(item!.registryTag).toBe('sys');
      expect(isItemUsableByGear(item!, supportGear)).toBe(true);
    }

    // adminUnlockAllGears grants starter items to the remaining locked Gears too
    useGameStore.getState().adminUnlockAllGears();
    const afterUnlockAll = useGameStore.getState().pilot;
    for (const clsId of ['interceptor', 'siege'] as const) {
      const g = afterUnlockAll.gears[clsId];
      expect(g.owned).toBe(true);
      for (const slot of EQUIPMENT_SLOTS) {
        const instId = g.equipped[slot];
        expect(instId).not.toBeNull();
        const item = afterUnlockAll.inventory.find((i) => i.instanceId === instId);
        expect(item?.isStarter).toBe(true);
        expect(isItemUsableByGear(item!, g)).toBe(true);
      }
    }
  });

  it('save migration fills ONLY empty slots and never replaces already-equipped items', () => {
    const basePilot = createDefaultPilotAccount('Veteran', 'striker', []);
    const customWeapon = generateItemInstance(
      {
        templateId: 'tpl_mw_plasma_lance',
        tier: 2,
        rarity: 'epic',
        requiredLevel: 1,
        rollQuality: 85,
      },
      createDeterministicRng()
    );
    basePilot.inventory = [customWeapon];
    basePilot.gears.striker.equipped.main_weapon = customWeapon.instanceId;
    // Leave the other 5 slots null, and keep another unowned Gear empty
    const legacyState = {
      pilot: basePilot,
      hasSaveData: true,
    };

    const migrated = migrateSaveData(
      legacyState,
      8,
      createDeterministicRng()
    );
    const migratedGear = migrated.pilot.gears.striker;

    // Existing main_weapon is preserved verbatim
    expect(migratedGear.equipped.main_weapon).toBe(customWeapon.instanceId);
    // Remaining 5 empty slots were filled with Starter items
    for (const slot of EQUIPMENT_SLOTS) {
      const id = migratedGear.equipped[slot];
      expect(id).not.toBeNull();
      const item = migrated.pilot.inventory.find((i) => i.instanceId === id);
      expect(item).toBeDefined();
      if (slot === 'main_weapon') {
        expect(item!.instanceId).toBe(customWeapon.instanceId);
        expect(item!.rarity).toBe('epic');
        expect(item!.isStarter).toBeFalsy();
      } else {
        expect(item!.isStarter).toBe(true);
        expect(item!.rarity).toBe('common');
      }
    }
    // Locked gear stays unequipped
    expect(migrated.pilot.gears.interceptor.owned).toBe(false);
    expect(migrated.pilot.gears.interceptor.equipped.main_weapon).toBeNull();
  });

  it('applies "Hỗ trợ tân thủ" boost multiplier to starter level & quality and supports fill_empty_slots scope', () => {
    const cfg = cloneStarterSetConfig(DEFAULT_STARTER_SET_CONFIG);
    cfg.slots.main_weapon = {
      templateId: 'tpl_mw_pulse_cannon',
      level: 4,
      quality: 40,
    };
    cfg.rookieBoostPct = 50; // +50% => level 6, quality 60

    const params = computeStarterEffectiveParams(cfg.slots.main_weapon, 1, 50);
    expect(params.boostedLevel).toBe(6);
    expect(params.boostedQuality).toBe(60);
    // Clamped to Gear level 1 so fresh Gear can equip it immediately
    expect(params.requiredLevel).toBe(1);

    const boostedItem = generateStarterItemForSlot(
      'striker',
      1,
      'main_weapon',
      cfg,
      createDeterministicRng()
    );
    expect(boostedItem.rollQuality).toBe(60);
    expect(boostedItem.requiredLevel).toBe(1);
    expect(boostedItem.isStarter).toBe(true);

    // Unboosted comparison at same slot level/quality
    const normalCfg = cloneStarterSetConfig(cfg);
    normalCfg.rookieBoostPct = 0;
    const normalItem = generateStarterItemForSlot(
      'striker',
      1,
      'main_weapon',
      normalCfg,
      createDeterministicRng()
    );
    expect(getEffectiveItemStats(boostedItem).attack).toBeGreaterThan(
      getEffectiveItemStats(normalItem).attack
    );

    // Updating adminConfig with boostScope = 'fill_empty_slots' fills currently empty slots via store
    const store = useGameStore.getState();
    store.startCampaign('BoostTest', 'striker');
    // Unequip one slot on striker to create an empty slot
    useGameStore.getState().unequipSlot('cpu');
    expect(useGameStore.getState().pilot.gears.striker.equipped.cpu).toBeNull();

    const patchCfg = cloneStarterSetConfig(DEFAULT_STARTER_SET_CONFIG);
    patchCfg.rookieBoostPct = 50;
    patchCfg.boostScope = 'fill_empty_slots';
    patchCfg.slots.cpu = { templateId: 'tpl_cpu_tactical', level: 2, quality: 50 };

    useGameStore.getState().adminUpdateConfig({ starterSet: patchCfg });

    const afterPilot = useGameStore.getState().pilot;
    const refilledCpuId = afterPilot.gears.striker.equipped.cpu;
    expect(refilledCpuId).not.toBeNull();
    const refilledCpu = afterPilot.inventory.find((i) => i.instanceId === refilledCpuId);
    expect(refilledCpu?.isStarter).toBe(true);
    expect(refilledCpu?.rollQuality).toBe(75); // 50 * 1.5
  });

  it('grants nothing when global Starter Set switch is turned off', () => {
    const offCfg = sanitizeStarterSetConfig({
      ...DEFAULT_STARTER_SET_CONFIG,
      enabled: false,
    });

    const freshOff = createFreshCampaignState(
      'Bare',
      'striker',
      createDeterministicRng(),
      offCfg
    );
    expect(freshOff.pilot.inventory).toHaveLength(0);
    for (const slot of EQUIPMENT_SLOTS) {
      expect(freshOff.pilot.gears.striker.equipped[slot]).toBeNull();
    }

    // Store buyGear with Starter disabled grants nothing
    const store = useGameStore.getState();
    store.adminUpdateConfig({ starterSet: offCfg });
    store.startCampaign('NoStarter', 'striker');
    store.adminSetCredits(50000);
    useGameStore.getState().buyGear('interceptor');
    for (const slot of EQUIPMENT_SLOTS) {
      expect(
        useGameStore.getState().pilot.gears.interceptor.equipped[slot]
      ).toBeNull();
    }

    // fillEmptyStarterSlotsForPilot & grantStarterSetToGear grant nothing when off
    const directGrant = grantStarterSetToGear(
      freshOff.pilot,
      'striker',
      offCfg,
      createDeterministicRng()
    );
    expect(directGrant.grantedItems).toHaveLength(0);

    const directFill = fillEmptyStarterSlotsForPilot(
      freshOff.pilot,
      offCfg,
      createDeterministicRng()
    );
    expect(directFill.filledCount).toBe(0);
    expect(useGameStore.getState().adminApplyStarterToEmptySlots()).toBe(0);
  });

  it('allows selling, replacing, and auto-equipping over Starter items as regular equipment', () => {
    const store = useGameStore.getState();
    store.startCampaign('Swapper', 'striker');

    const initialMainId =
      useGameStore.getState().pilot.gears.striker.equipped.main_weapon!;
    expect(initialMainId).toBeTruthy();

    // Generate a stronger Epic weapon in inventory
    useGameStore.getState().adminGenerateItems('main_weapon', 2, 'epic', 1, {
      requiredLevel: 1,
      rollQuality: 90,
    });

    // Auto-Equip treats starter as a normal equipped item and upgrades over it
    const plan = useGameStore.getState().previewAutoEquip('single', 'striker');
    const mainSlotPlan = plan.gearPlans[0].slots.find(
      (s) => s.slot === 'main_weapon'
    );
    expect(mainSlotPlan?.changed).toBe(true);
    expect(mainSlotPlan?.currentItem?.isStarter).toBe(true);
    expect(mainSlotPlan?.nextItem?.rarity).toBe('epic');

    useGameStore.getState().applyAutoEquip(plan);
    expect(
      useGameStore.getState().pilot.gears.striker.equipped.main_weapon
    ).not.toBe(initialMainId);

    // Replaced starter item is now unequipped in cargo and can be sold normally
    const sellRes = useGameStore.getState().sellItem(initialMainId);
    expect(sellRes.ok).toBe(true);
    expect(sellRes.creditsEarned).toBeGreaterThan(0);
    expect(
      useGameStore
        .getState()
        .pilot.inventory.some((i) => i.instanceId === initialMainId)
    ).toBe(false);
  });
});
