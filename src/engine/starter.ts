import { BALANCE_CONFIG } from '../data/balance';
import { MECH_CLASS_LIST } from '../data/classes';
import { BUILTIN_ITEM_REGISTRY_TAG, EQUIPMENT_SLOTS } from '../data/items';
import {
  DEFAULT_STARTER_SET_CONFIG,
  resolveStarterTemplateForGear,
  sanitizeStarterSetConfig,
} from '../data/starterConfig';
import type {
  GearUnit,
  ItemInstance,
  MechClassId,
  PaperDollSlot,
  PilotAccount,
  StarterSetConfig,
  StarterSlotConfig,
} from '../types/game';
import { generateItemInstance } from './equipment';

export const STARTER_BASE_STAT_SCALE = 0.55;

export interface ComputedStarterSlotParams {
  boostedLevel: number;
  boostedQuality: number;
  requiredLevel: number;
  price: number;
}

export function computeStarterEffectiveParams(
  slotCfg: StarterSlotConfig,
  gearLevel: number,
  rookieBoostPct: number
): ComputedStarterSlotParams {
  const mult = 1 + Math.max(0, Math.min(300, rookieBoostPct)) / 100;
  const boostedLevel = Math.max(
    1,
    Math.min(BALANCE_CONFIG.maxLevel, Math.round(slotCfg.level * mult))
  );
  const boostedQuality = Math.max(
    1,
    Math.min(100, Math.round(slotCfg.quality * mult))
  );
  // Clamp requiredLevel to gearLevel so rookie boosts never lock out a fresh Lv1 Gear from equipping its starter item.
  const requiredLevel = Math.min(Math.max(1, gearLevel), boostedLevel);
  // Very low sell price (~5 CR at Lv1 Q20) while scaling slightly with level/quality.
  const price = Math.max(
    10,
    Math.round(10 + boostedLevel * 2 + boostedQuality * 0.08)
  );
  return {
    boostedLevel,
    boostedQuality,
    requiredLevel,
    price,
  };
}

export function generateStarterItemForSlot(
  classId: MechClassId,
  gearLevel: number,
  slot: PaperDollSlot,
  starterConfig: StarterSetConfig = DEFAULT_STARTER_SET_CONFIG,
  rng: () => number = Math.random
): ItemInstance {
  const cleanCfg = sanitizeStarterSetConfig(starterConfig);
  const slotCfg = cleanCfg.slots[slot] ?? {
    templateId: '',
    level: 1,
    quality: 20,
  };
  const template = resolveStarterTemplateForGear(
    slot,
    slotCfg.templateId,
    classId
  );
  const params = computeStarterEffectiveParams(
    slotCfg,
    gearLevel,
    cleanCfg.rookieBoostPct
  );

  return generateItemInstance(
    {
      templateId: template.id,
      tier: template.tier,
      rarity: 'common',
      requiredLevel: params.requiredLevel,
      statPowerLevel: params.boostedLevel,
      statScale: STARTER_BASE_STAT_SCALE,
      rollQuality: params.boostedQuality,
      priceOverride: params.price,
      isStarter: true,
      registryTag: template.registryTag ?? BUILTIN_ITEM_REGISTRY_TAG,
      isNew: false,
    },
    rng
  );
}

/**
 * Generates and equips Starter items ONLY into EMPTY slots of `gearId`.
 * Never replaces an already-equipped slot!
 */
export function grantStarterSetToGear(
  pilot: PilotAccount,
  gearId: MechClassId,
  starterConfig: StarterSetConfig = DEFAULT_STARTER_SET_CONFIG,
  rng: () => number = Math.random
): { pilot: PilotAccount; grantedItems: ItemInstance[] } {
  const cleanCfg = sanitizeStarterSetConfig(starterConfig);
  if (!cleanCfg.enabled) {
    return { pilot, grantedItems: [] };
  }

  const gear = pilot.gears[gearId];
  if (!gear || !gear.owned) {
    return { pilot, grantedItems: [] };
  }

  const nextEquipped = { ...gear.equipped };
  const grantedItems: ItemInstance[] = [];

  for (const slot of EQUIPMENT_SLOTS) {
    if (nextEquipped[slot] !== null) continue;
    if (!cleanCfg.slots[slot]) continue;
    const starterItem = generateStarterItemForSlot(
      gear.classId,
      gear.level,
      slot,
      cleanCfg,
      rng
    );
    grantedItems.push(starterItem);
    nextEquipped[slot] = starterItem.instanceId;
  }

  if (grantedItems.length === 0) {
    return { pilot, grantedItems: [] };
  }

  const updatedGear: GearUnit = {
    ...gear,
    equipped: nextEquipped,
  };

  return {
    pilot: {
      ...pilot,
      inventory: [...pilot.inventory, ...grantedItems],
      gears: {
        ...pilot.gears,
        [gearId]: updatedGear,
      },
    },
    grantedItems,
  };
}

/**
 * Fills EMPTY equipment slots across all currently owned Gears with Starter items.
 * Used during save migration and when Admin CP triggers "fill_empty_slots".
 */
export function fillEmptyStarterSlotsForPilot(
  pilot: PilotAccount,
  starterConfig: StarterSetConfig = DEFAULT_STARTER_SET_CONFIG,
  rng: () => number = Math.random
): { pilot: PilotAccount; filledCount: number } {
  const cleanCfg = sanitizeStarterSetConfig(starterConfig);
  if (!cleanCfg.enabled) {
    return { pilot, filledCount: 0 };
  }

  let currentPilot = pilot;
  let filledCount = 0;

  for (const cls of MECH_CLASS_LIST) {
    if (!currentPilot.gears[cls.id]?.owned) continue;
    const res = grantStarterSetToGear(
      currentPilot,
      cls.id,
      cleanCfg,
      rng
    );
    currentPilot = res.pilot;
    filledCount += res.grantedItems.length;
  }

  return {
    pilot: currentPilot,
    filledCount,
  };
}
