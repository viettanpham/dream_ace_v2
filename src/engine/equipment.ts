import { BALANCE_CONFIG } from '../data/balance';
import { EMPTY_STAT_BLOCK, MECH_CLASS_LIST, STAT_KEYS } from '../data/classes';
import {
  AFFIX_SUFFIX_BY_STAT,
  BUILTIN_ITEM_REGISTRY_TAG,
  DROP_CONFIG,
  EMPTY_EQUIPPED_SLOT_IDS,
  ENCHANT_CONFIG,
  EQUIPMENT_SLOTS,
  getItemTemplate,
  ITEM_TEMPLATES,
  SHOP_CONFIG,
} from '../data/items';
import { getSectorById } from '../data/maps';
import { computeItemPrice, countNonZeroTraits } from './itemPrice';
import type {
  CombatUnit,
  EnchantAttemptResult,
  EquipmentSlot,
  EquippedSlotIds,
  EquipValidationResult,
  GearUnit,
  ItemAffix,
  ItemInstance,
  ItemRarity,
  ItemSpecialTraits,
  ItemTemplate,
  MechClassId,
  PilotAccount,
  StatBlock,
  StatKey,
} from '../types/game';

let itemUidSeq = 1;

function rollRange(
  min: number,
  max: number,
  rng: () => number
): { value: number; pct: number } {
  const pct = rng();
  const value = Math.round(min + pct * (max - min));
  return { value, pct };
}

export interface GenerateItemOptions {
  templateId?: string;
  slot?: EquipmentSlot;
  tier?: number; // 1..4
  rarity?: ItemRarity;
  requiredLevel?: number;
  classRestriction?: MechClassId | null;
  enchantLevel?: number;
  rollQuality?: number; // optional fixed 1..100% quality roll
  statScale?: number; // optional stat multiplier (e.g. lower stats for Starter items)
  statPowerLevel?: number; // optional level used for stat scaling independent of requiredLevel
  priceOverride?: number; // optional explicit price (bypasses computeItemPrice & minPrice)
  isStarter?: boolean;
  registryTag?: string;
  isNew?: boolean;
  obtainedAt?: number;
}

/**
 * Generates a randomized ItemInstance from a distinct ItemTemplate.
 * - Base stat rolls scale by tier, required level, and rarity multiplier.
 * - Bonus affixes count = 0 (common), 1 (rare), 2 (epic), 3 (legendary).
 * - Computes rollQuality (0..100%) and affix-based suffixId.
 */
export function generateItemInstance(
  options: GenerateItemOptions = {},
  rng: () => number = Math.random
): ItemInstance {
  let template: ItemTemplate | undefined = options.templateId
    ? getItemTemplate(options.templateId)
    : undefined;

  if (!template) {
    let pool = ITEM_TEMPLATES;
    if (options.slot) {
      pool = pool.filter((t) => t.slot === options.slot);
    }
    if (options.tier !== undefined) {
      const exactTier = pool.filter((t) => t.tier === options.tier);
      if (exactTier.length > 0) {
        pool = exactTier;
      }
    }
    if (options.classRestriction !== undefined) {
      const classMatch = pool.filter(
        (t) =>
          t.classRestriction === options.classRestriction ||
          t.classRestriction === null
      );
      if (classMatch.length > 0) pool = classMatch;
    }
    if (pool.length === 0) pool = ITEM_TEMPLATES;
    template = pool[Math.floor(rng() * pool.length)];
  }

  const tier = Math.max(1, Math.min(4, options.tier ?? template.tier));
  const rarity: ItemRarity = options.rarity ?? 'common';
  const tierScale = BALANCE_CONFIG.tierStatScale[tier - 1] ?? 1;
  const templateTierScale = BALANCE_CONFIG.tierStatScale[template.tier - 1] ?? 1;
  const relativeTierFactor = tierScale / templateTierScale;
  const rarityStatMult = BALANCE_CONFIG.rarityStatMultiplier[rarity];

  const requiredLevel = Math.max(
    1,
    options.requiredLevel ??
      Math.max(template.requiredLevel, (tier - 1) * 3 + 1)
  );
  const scalingLevel = Math.max(1, options.statPowerLevel ?? requiredLevel);
  const levelFactor =
    1 + Math.max(0, scalingLevel - template.requiredLevel) * 0.045;
  const statScale = Math.max(0.1, options.statScale ?? 1);
  const totalBaseMult =
    relativeTierFactor * rarityStatMult * levelFactor * statScale;

  const qualitySamples: number[] = [];
  const rolledBaseStats: Partial<StatBlock> = {};

  const forcedPct =
    options.rollQuality !== undefined
      ? Math.max(0.01, Math.min(1, options.rollQuality / 100))
      : null;
  const rollWithOverride = (min: number, max: number) =>
    forcedPct !== null
      ? { value: Math.round(min + forcedPct * (max - min)), pct: forcedPct }
      : rollRange(min, max, rng);

  const pMin = Math.max(1, Math.round(template.primaryRange[0] * totalBaseMult));
  const pMax = Math.max(pMin + 1, Math.round(template.primaryRange[1] * totalBaseMult));
  const primaryRoll = rollWithOverride(pMin, pMax);
  rolledBaseStats[template.primaryStat] = primaryRoll.value;
  qualitySamples.push(primaryRoll.pct);

  if (template.secondaryStat && template.secondaryRange) {
    const sMin = Math.max(1, Math.round(template.secondaryRange[0] * totalBaseMult));
    const sMax = Math.max(
      sMin + 1,
      Math.round(template.secondaryRange[1] * totalBaseMult)
    );
    const secondaryRoll = rollWithOverride(sMin, sMax);
    rolledBaseStats[template.secondaryStat] =
      (rolledBaseStats[template.secondaryStat] ?? 0) + secondaryRoll.value;
    qualitySamples.push(secondaryRoll.pct);
  }

  // Roll 0 / 1 / 2 / 3 random bonus affixes based on rarity
  const affixCount = BALANCE_CONFIG.rarityAffixCount[rarity];
  const affixes: ItemAffix[] = [];
  const availableAffixStats: StatKey[] = [...template.affixPool];

  for (let i = 0; i < affixCount; i++) {
    const statPool =
      availableAffixStats.length > 0 ? availableAffixStats : STAT_KEYS;
    const pickIdx = Math.floor(rng() * statPool.length);
    const chosenStat = statPool[pickIdx];
    if (availableAffixStats.length > 0) {
      availableAffixStats.splice(pickIdx, 1);
    }

    const affixMin = Math.max(2, Math.round((2 + tier * 2) * (0.9 + requiredLevel * 0.03)));
    const affixMax = Math.max(
      affixMin + 2,
      Math.round((4 + tier * 3.5) * (1.0 + requiredLevel * 0.04))
    );
    const affixRoll = rollWithOverride(affixMin, affixMax);
    qualitySamples.push(affixRoll.pct);

    const suffixPool = AFFIX_SUFFIX_BY_STAT[chosenStat];
    const suffixMeta = suffixPool[Math.floor(rng() * suffixPool.length)];
    affixes.push({
      stat: chosenStat,
      value: affixRoll.value,
      suffixId: suffixMeta.id,
    });
  }

  const avgQuality =
    qualitySamples.reduce((sum, q) => sum + q, 0) / Math.max(1, qualitySamples.length);
  const rollQuality =
    options.rollQuality !== undefined
      ? Math.max(1, Math.min(100, Math.round(options.rollQuality)))
      : Math.max(1, Math.min(100, Math.round(avgQuality * 100)));

  // Pick suffix from the highest-rolled affix (null for Common)
  let suffixId: string | null = null;
  if (affixes.length > 0) {
    const bestAffix = [...affixes].sort((a, b) => b.value - a.value)[0];
    suffixId = bestAffix.suffixId;
  }

  const traitCount = countNonZeroTraits(template.specialTraits);
  const price =
    options.priceOverride !== undefined
      ? Math.max(1, Math.round(options.priceOverride))
      : computeItemPrice({
          slot: template.slot,
          tier,
          rarity,
          rollQuality,
          affixCount: affixes.length,
          traitCount,
        });

  itemUidSeq += 1;
  return {
    instanceId: `itm_${Date.now().toString(36)}_${itemUidSeq}_${Math.floor(
      rng() * 1e6
    ).toString(36)}`,
    templateId: template.id,
    slot: template.slot,
    tier,
    requiredLevel,
    classRestriction: template.classRestriction,
    rarity,
    rolledBaseStats,
    affixes,
    suffixId,
    rollQuality,
    price,
    enchantLevel: Math.max(
      0,
      Math.min(ENCHANT_CONFIG.maxLevel, options.enchantLevel ?? 0)
    ),
    specialTraits: template.specialTraits
      ? { ...template.specialTraits }
      : undefined,
    registryTag:
      options.registryTag ?? template.registryTag ?? BUILTIN_ITEM_REGISTRY_TAG,
    ...(options.isStarter ? { isStarter: true } : {}),
    isNew: options.isNew ?? false,
    obtainedAt: options.obtainedAt ?? Date.now(),
  };
}

/**
 * Generates randomized shop stock scaled around the pilot's active Gear level.
 */
export function generateShopStock(
  referenceLevel: number,
  count: number = BALANCE_CONFIG.shopStockSize,
  rng: () => number = Math.random
): ItemInstance[] {
  const maxTier =
    referenceLevel >= 9 ? 4 : referenceLevel >= 6 ? 3 : referenceLevel >= 3 ? 2 : 1;

  const shopRarityWeights: Record<ItemRarity, number> =
    maxTier >= 4
      ? { common: 25, rare: 40, epic: 26, legendary: 9 }
      : maxTier === 3
      ? { common: 38, rare: 40, epic: 18, legendary: 4 }
      : maxTier === 2
      ? { common: 50, rare: 36, epic: 12, legendary: 2 }
      : { common: 62, rare: 30, epic: 7, legendary: 1 };

  const stock: ItemInstance[] = [];
  for (let i = 0; i < count; i++) {
    // Ensure every slot appears at least twice in a 12-item stock
    const slot = EQUIPMENT_SLOTS[i % EQUIPMENT_SLOTS.length];
    const eligibleTemplates = ITEM_TEMPLATES.filter(
      (t) => t.slot === slot && t.tier <= maxTier
    );
    const pickedTpl =
      eligibleTemplates[Math.floor(rng() * eligibleTemplates.length)] ??
      ITEM_TEMPLATES.find((t) => t.slot === slot) ??
      ITEM_TEMPLATES[0];

    const rarity = pickWeightedRarity(shopRarityWeights, rng);
    const tier = Math.min(maxTier, Math.max(1, pickedTpl.tier));
    stock.push(
      generateItemInstance(
        {
          templateId: pickedTpl.id,
          tier,
          rarity,
        },
        rng
      )
    );
  }
  return stock;
}

/**
 * Computes effective flat stat bonuses for an ItemInstance (rolled base + affixes),
 * scaled by +8% per enchant level.
 */
export function getEffectiveItemStats(
  instance: ItemInstance,
  overrideEnchantLevel?: number
): StatBlock {
  const result: StatBlock = { ...EMPTY_STAT_BLOCK };
  const enchant = overrideEnchantLevel ?? instance.enchantLevel;
  const multiplier = 1 + Math.max(0, enchant) * ENCHANT_CONFIG.bonusPerLevel;

  const rawSum: StatBlock = { ...EMPTY_STAT_BLOCK };
  for (const key of STAT_KEYS) {
    rawSum[key] += instance.rolledBaseStats[key] ?? 0;
  }
  for (const afx of instance.affixes) {
    rawSum[afx.stat] += afx.value;
  }

  for (const key of STAT_KEYS) {
    if (rawSum[key] > 0) {
      result[key] = Math.round(rawSum[key] * multiplier);
    }
  }

  return result;
}

/**
 * Resolves the ItemInstance currently equipped in each slot of a GearUnit.
 */
export function getGearEquippedInstances(
  gear: GearUnit,
  inventory: ItemInstance[]
): Record<EquipmentSlot, ItemInstance | null> {
  const byId = new Map(inventory.map((it) => [it.instanceId, it]));
  const result = {
    ...EMPTY_EQUIPPED_SLOT_IDS,
  } as Record<EquipmentSlot, ItemInstance | null>;
  for (const slot of EQUIPMENT_SLOTS) {
    const id = gear.equipped[slot];
    result[slot] = id ? byId.get(id) ?? null : null;
  }
  return result;
}

/**
 * Sums all effective flat stat bonuses across all equipped slots of a GearUnit.
 */
export function sumGearEquipmentStats(
  gear: GearUnit,
  inventory: ItemInstance[]
): StatBlock {
  const total: StatBlock = { ...EMPTY_STAT_BLOCK };
  const equippedMap = getGearEquippedInstances(gear, inventory);

  for (const slot of EQUIPMENT_SLOTS) {
    const inst = equippedMap[slot];
    if (!inst) continue;
    const stats = getEffectiveItemStats(inst);
    for (const key of STAT_KEYS) {
      total[key] += stats[key];
    }
  }
  return total;
}

/**
 * Sums special mechanical traits (crit %, armor pierce %, splash %, SP regen, evasion mod, accuracy %, detectStealth)
 * across all equipped items on a GearUnit.
 */
export function sumGearSpecialTraits(
  gear: GearUnit,
  inventory: ItemInstance[]
): ItemSpecialTraits {
  const equippedMap = getGearEquippedInstances(gear, inventory);
  let critBonusPct = 0;
  let armorPiercePct = 0;
  let splashPct = 0;
  let spRegenPerTurn = 0;
  let evasionMod = 0;
  let longRange = false;
  let accuracyPct = 0;
  let detectStealth = false;

  for (const slot of EQUIPMENT_SLOTS) {
    const inst = equippedMap[slot];
    const tr = inst?.specialTraits;
    if (!tr) continue;
    critBonusPct += tr.critBonusPct ?? 0;
    armorPiercePct += tr.armorPiercePct ?? 0;
    splashPct += tr.splashPct ?? 0;
    spRegenPerTurn += tr.spRegenPerTurn ?? 0;
    evasionMod += tr.evasionMod ?? 0;
    if (tr.longRange) longRange = true;
    accuracyPct += tr.accuracyPct ?? 0;
    if (tr.detectStealth) detectStealth = true;
  }

  return {
    critBonusPct,
    armorPiercePct,
    splashPct,
    spRegenPerTurn,
    evasionMod,
    longRange,
    accuracyPct,
    detectStealth,
  };
}

/**
 * Checks across all 4 Gears whether an ItemInstance is currently equipped,
 * and returns the Gear's MechClassId (or null if unequipped).
 */
export function getItemEquippedByGear(
  gears: Record<MechClassId, GearUnit>,
  instanceId: string
): MechClassId | null {
  for (const cls of MECH_CLASS_LIST) {
    const gear = gears[cls.id];
    if (!gear) continue;
    for (const slot of EQUIPMENT_SLOTS) {
      if (gear.equipped[slot] === instanceId) {
        return cls.id;
      }
    }
  }
  return null;
}

/**
 * Validates whether an ItemInstance can be equipped on `targetGear`.
 * Enforces:
 * 1) Gear level >= item.requiredLevel
 * 2) Class-locked slots (Armor/Engine) match targetGear.classId
 * 3) Item instance is NOT currently equipped on another Gear (1 instance = 1 Gear max)
 */
export function validateEquipOnGear(
  instance: ItemInstance,
  targetGear: GearUnit,
  allGears: Record<MechClassId, GearUnit>
): EquipValidationResult {
  const missingLevel =
    targetGear.level < instance.requiredLevel ? instance.requiredLevel : null;
  const requiredClass =
    instance.classRestriction && instance.classRestriction !== targetGear.classId
      ? instance.classRestriction
      : null;

  const ownerGear = getItemEquippedByGear(allGears, instance.instanceId);
  const equippedOnOtherGear =
    ownerGear && ownerGear !== targetGear.classId ? ownerGear : null;

  return {
    canEquip:
      missingLevel === null &&
      requiredClass === null &&
      equippedOnOtherGear === null,
    missingLevel,
    requiredClass,
    equippedOnOtherGear,
  };
}

/**
 * Pure equip operation on PilotAccount for a specific GearUnit.
 */
export function equipItemOnGear(
  pilot: PilotAccount,
  gearId: MechClassId,
  instanceId: string
): { pilot: PilotAccount; validation: EquipValidationResult } {
  const gear = pilot.gears[gearId];
  const instance = pilot.inventory.find((it) => it.instanceId === instanceId);
  if (!gear || !gear.owned || !instance) {
    return {
      pilot,
      validation: {
        canEquip: false,
        missingLevel: null,
        requiredClass: null,
        equippedOnOtherGear: null,
      },
    };
  }

  const validation = validateEquipOnGear(instance, gear, pilot.gears);
  if (!validation.canEquip) {
    return { pilot, validation };
  }

  const updatedGear: GearUnit = {
    ...gear,
    equipped: {
      ...gear.equipped,
      [instance.slot]: instance.instanceId,
    },
  };

  return {
    pilot: {
      ...pilot,
      gears: {
        ...pilot.gears,
        [gearId]: updatedGear,
      },
    },
    validation,
  };
}

/**
 * Pure unequip operation on PilotAccount for a specific GearUnit & slot.
 */
export function unequipSlotOnGear(
  pilot: PilotAccount,
  gearId: MechClassId,
  slot: EquipmentSlot
): PilotAccount {
  const gear = pilot.gears[gearId];
  if (!gear || !gear.equipped[slot]) return pilot;
  return {
    ...pilot,
    gears: {
      ...pilot.gears,
      [gearId]: {
        ...gear,
        equipped: {
          ...gear.equipped,
          [slot]: null,
        },
      },
    },
  };
}

/**
 * Unequips an item instance from whichever Gear currently has it equipped.
 */
export function unequipInstanceFromAnyGear(
  pilot: PilotAccount,
  instanceId: string
): PilotAccount {
  const owner = getItemEquippedByGear(pilot.gears, instanceId);
  if (!owner) return pilot;
  const gear = pilot.gears[owner];
  const slot = EQUIPMENT_SLOTS.find((s) => gear.equipped[s] === instanceId);
  if (!slot) return pilot;
  return unequipSlotOnGear(pilot, owner, slot);
}

/**
 * Sell value is 40% of item instance's rolled price.
 */
export function getSellPrice(instance: ItemInstance): number {
  return Math.floor(instance.price * SHOP_CONFIG.sellPriceRatio);
}

/**
 * Calculates enchant cost, success rate, and current vs next-level stats for an ItemInstance.
 */
export function getEnchantMetadata(instance: ItemInstance): {
  currentLevel: number;
  nextLevel: number;
  isMax: boolean;
  cost: number;
  successRate: number;
  currentStats: StatBlock;
  nextStats: StatBlock;
} {
  const currentLevel = Math.max(
    0,
    Math.min(ENCHANT_CONFIG.maxLevel, instance.enchantLevel)
  );
  const isMax = currentLevel >= ENCHANT_CONFIG.maxLevel;
  const nextLevel = isMax ? currentLevel : currentLevel + 1;

  const cost = isMax
    ? 0
    : Math.round(
        (ENCHANT_CONFIG.baseCostFloor +
          instance.price * ENCHANT_CONFIG.priceCostFactor) *
          (1 + currentLevel * ENCHANT_CONFIG.levelCostStep)
      );

  const successRate = isMax
    ? 0
    : ENCHANT_CONFIG.successRates[currentLevel] ?? 30;

  return {
    currentLevel,
    nextLevel,
    isMax,
    cost,
    successRate,
    currentStats: getEffectiveItemStats(instance, currentLevel),
    nextStats: getEffectiveItemStats(instance, nextLevel),
  };
}

/**
 * Executes an enchant roll (+0 to +10). On failure, part remains unchanged and Credits are lost.
 */
export function resolveEnchantAttempt(
  instance: ItemInstance,
  pilotCredits: number,
  rng: () => number = Math.random,
  bonusSuccessPct = 0
): {
  result: EnchantAttemptResult;
  updatedInstance: ItemInstance;
  remainingCredits: number;
} {
  const meta = getEnchantMetadata(instance);
  const effectiveSuccessRate = meta.isMax
    ? 0
    : Math.min(100, meta.successRate + Math.max(0, bonusSuccessPct));

  if (meta.isMax) {
    return {
      result: {
        attempted: false,
        success: false,
        code: 'max_level',
        instanceId: instance.instanceId,
        templateId: instance.templateId,
        previousLevel: meta.currentLevel,
        newLevel: meta.currentLevel,
        creditsSpent: 0,
        successRate: 0,
      },
      updatedInstance: instance,
      remainingCredits: pilotCredits,
    };
  }

  if (pilotCredits < meta.cost) {
    return {
      result: {
        attempted: false,
        success: false,
        code: 'insufficient_credits',
        instanceId: instance.instanceId,
        templateId: instance.templateId,
        previousLevel: meta.currentLevel,
        newLevel: meta.currentLevel,
        creditsSpent: meta.cost,
        successRate: effectiveSuccessRate,
      },
      updatedInstance: instance,
      remainingCredits: pilotCredits,
    };
  }

  const roll = rng() * 100;
  const succeeded = roll < effectiveSuccessRate;
  const nextCredits = pilotCredits - meta.cost;

  if (succeeded) {
    const upgraded: ItemInstance = {
      ...instance,
      enchantLevel: meta.nextLevel,
    };
    return {
      result: {
        attempted: true,
        success: true,
        code: 'success',
        instanceId: instance.instanceId,
        templateId: instance.templateId,
        previousLevel: meta.currentLevel,
        newLevel: meta.nextLevel,
        creditsSpent: meta.cost,
        successRate: effectiveSuccessRate,
      },
      updatedInstance: upgraded,
      remainingCredits: nextCredits,
    };
  }

  return {
    result: {
      attempted: true,
      success: false,
      code: 'failed',
      instanceId: instance.instanceId,
      templateId: instance.templateId,
      previousLevel: meta.currentLevel,
      newLevel: meta.currentLevel,
      creditsSpent: meta.cost,
      successRate: effectiveSuccessRate,
    },
    updatedInstance: instance,
    remainingCredits: nextCredits,
  };
}

export function pickWeightedRarity(
  weights: Record<ItemRarity, number>,
  rng: () => number = Math.random
): ItemRarity {
  const total =
    weights.common + weights.rare + weights.epic + weights.legendary;
  let roll = rng() * total;
  if (roll < weights.common) return 'common';
  roll -= weights.common;
  if (roll < weights.rare) return 'rare';
  roll -= weights.rare;
  if (roll < weights.epic) return 'epic';
  return 'legendary';
}

/**
 * Rolls randomized enemy ship part drops weighted by rarity and sector difficulty.
 */
export function rollBattleItemDrops(
  enemies: CombatUnit[],
  sectorId: string,
  gearLevel: number,
  won: boolean,
  rng: () => number = Math.random
): ItemInstance[] {
  const sector = getSectorById(sectorId);
  const cfg = DROP_CONFIG[sector.difficulty];
  const destroyedEnemies = enemies.filter((e) => !e.alive);
  if (destroyedEnemies.length === 0) return [];

  const drops: ItemInstance[] = [];
  const maxTier = Math.min(
    4,
    Math.max(cfg.maxTier, gearLevel >= 9 ? 4 : gearLevel >= 6 ? 3 : gearLevel >= 3 ? 2 : 1)
  );

  const pickTemplateForDrop = (): ItemTemplate => {
    const pool = ITEM_TEMPLATES.filter((t) => t.tier <= maxTier);
    const source = pool.length > 0 ? pool : ITEM_TEMPLATES;
    return source[Math.floor(rng() * source.length)];
  };

  for (const enemy of destroyedEnemies) {
    if (drops.length >= cfg.maxDropsPerBattle) break;
    const effectiveChance = enemy.isBoss
      ? 1.0
      : won
      ? cfg.perEnemyDropChance
      : cfg.perEnemyDropChance * 0.45;
    if (rng() > effectiveChance) continue;

    const rarity = enemy.isBoss
      ? pickWeightedRarity(
          { common: 0, rare: 20, epic: 55, legendary: 25 },
          rng
        )
      : pickWeightedRarity(cfg.rarityWeights, rng);
    const tpl = pickTemplateForDrop();
    drops.push(
      generateItemInstance(
        {
          templateId: tpl.id,
          tier: Math.min(maxTier, tpl.tier),
          rarity,
          isNew: true,
        },
        rng
      )
    );
  }

  // Victory pity drop so progression feels rewarding
  if (won && drops.length === 0) {
    const pityChance =
      sector.difficulty === 'Elite'
        ? 0.95
        : sector.difficulty === 'Hard'
        ? 0.75
        : 0.55;
    if (rng() < pityChance) {
      const rarity = pickWeightedRarity(cfg.rarityWeights, rng);
      const tpl = pickTemplateForDrop();
      drops.push(
        generateItemInstance(
          {
            templateId: tpl.id,
            tier: Math.min(maxTier, tpl.tier),
            rarity,
            isNew: true,
          },
          rng
        )
      );
    }
  }

  return drops;
}

/**
 * Simulates equipping or unequipping an item on a GearUnit for live +/- comparison previews.
 */
export function simulateGearEquipChange(
  gear: GearUnit,
  change:
    | { type: 'equip'; instance: ItemInstance }
    | { type: 'unequip'; slot: EquipmentSlot }
): GearUnit {
  const nextEquipped: EquippedSlotIds = {
    ...EMPTY_EQUIPPED_SLOT_IDS,
    ...gear.equipped,
  };
  if (change.type === 'unequip') {
    nextEquipped[change.slot] = null;
  } else {
    nextEquipped[change.instance.slot] = change.instance.instanceId;
  }
  return {
    ...gear,
    equipped: nextEquipped,
  };
}
