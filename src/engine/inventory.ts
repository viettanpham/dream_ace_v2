import { BALANCE_CONFIG } from '../data/balance';
import { MECH_CLASS_LIST, STAT_KEYS } from '../data/classes';
import { DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS, SHOP_STOCK_CONFIG } from '../data/shopConfig';
import type {
  AdminConfig,
  GearUnit,
  InventoryFilterState,
  ItemInstance,
  ItemRarity,
  MechClassId,
} from '../types/game';
import {
  getEffectiveItemStats,
  getGearEquippedInstances,
  getItemEquippedByGear,
  getSellPrice,
  validateEquipOnGear,
} from './equipment';
import { isEnrageConfigModified } from './enrage';
import { isFormationConfigDefault } from './formation';

export const RARITY_RANK: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const STAT_POWER_WEIGHTS = {
  attack: 1.35,
  defense: 1.15,
  evasion: 1.25,
  shield: 1.05,
  spirit: 1.0,
  fuel: 0.95,
} as const;

/**
 * Deterministic power rating for an ItemInstance based on effective (enchanted) stats,
 * special traits, tier, and roll quality. Used for "Only upgrades", Quick Sell comparisons,
 * and Power Score sorting.
 */
export function calculateItemPowerScore(item: ItemInstance): number {
  const stats = getEffectiveItemStats(item);
  let score = 0;
  for (const key of STAT_KEYS) {
    score += (stats[key] ?? 0) * STAT_POWER_WEIGHTS[key];
  }
  const traits = item.specialTraits;
  if (traits) {
    score += (traits.critBonusPct ?? 0) * 1.4;
    score += (traits.armorPiercePct ?? 0) * 1.2;
    score += (traits.splashPct ?? 0) * 0.9;
    score += (traits.spRegenPerTurn ?? 0) * 2.5;
    score += (traits.evasionMod ?? 0) * 1.0;
  }
  score += item.tier * 4 + item.enchantLevel * 3 + item.rollQuality * 0.1;
  return Math.max(1, Math.round(score));
}

/**
 * Checks whether an item is usable by a specific Gear (level & class check only,
 * ignoring whether it is currently equipped on another Gear).
 */
export function isItemUsableByGear(item: ItemInstance, gear: GearUnit): boolean {
  if (gear.level < item.requiredLevel) return false;
  if (item.classRestriction !== null && item.classRestriction !== gear.classId) {
    return false;
  }
  return true;
}

/**
 * Returns true if the item is usable by `gear` and strictly beats the power score
 * of whatever `gear` currently has equipped in `item.slot` (or if that slot is empty).
 * Returns false if the item is already equipped in that slot on `gear`.
 */
export function isItemUpgradeForGear(
  item: ItemInstance,
  gear: GearUnit,
  inventory: ItemInstance[]
): boolean {
  if (item.slot === 'module') return false;
  if (!isItemUsableByGear(item, gear)) return false;
  const equippedMap = getGearEquippedInstances(gear, inventory);
  const currentInSlot = equippedMap[item.slot];
  if (!currentInSlot) return true;
  if (currentInSlot.instanceId === item.instanceId) return false;
  return calculateItemPowerScore(item) > calculateItemPowerScore(currentInSlot);
}

export function getDefaultInventoryFilterState(): InventoryFilterState {
  return {
    search: '',
    slot: 'all',
    rarities: [],
    tiers: [],
    minLevel: null,
    maxLevel: null,
    usability: 'all',
    minQuality: 0,
    maxQuality: 100,
    onlyUpgrades: false,
    lockedOnly: false,
    newOnly: false,
    sortBy: 'newest',
    sortDir: 'desc',
    pinEquippedFirst: true,
  };
}

export interface InventoryEntryView {
  item: ItemInstance;
  powerScore: number;
  sellValue: number;
  equippedBy: MechClassId | null;
  equippedOnSelected: boolean;
  usableBySelected: boolean;
  isUpgrade: boolean;
  validation: ReturnType<typeof validateEquipOnGear>;
  displayName: string;
}

/**
 * Pure inventory filter + sort pipeline.
 */
export function filterAndSortInventory(
  inventory: ItemInstance[],
  filter: InventoryFilterState,
  activeGear: GearUnit,
  allGears: Record<MechClassId, GearUnit>,
  resolveDisplayName: (item: ItemInstance) => string = (it) => it.templateId
): InventoryEntryView[] {
  const ownedGears = MECH_CLASS_LIST.map((c) => allGears[c.id]).filter(
    (g): g is GearUnit => Boolean(g && g.owned)
  );
  const query = filter.search.trim().toLowerCase();

  const enriched: InventoryEntryView[] = [];

  for (let idx = 0; idx < inventory.length; idx++) {
    const item = inventory[idx];
    if (
      filter.slot !== 'all' &&
      filter.slot !== 'consumables' &&
      item.slot !== filter.slot
    ) {
      continue;
    }
    if (filter.rarities.length > 0 && !filter.rarities.includes(item.rarity)) {
      continue;
    }
    if (filter.tiers.length > 0 && !filter.tiers.includes(item.tier)) {
      continue;
    }
    if (filter.minLevel !== null && item.requiredLevel < filter.minLevel) {
      continue;
    }
    if (filter.maxLevel !== null && item.requiredLevel > filter.maxLevel) {
      continue;
    }
    if (item.rollQuality < filter.minQuality || item.rollQuality > filter.maxQuality) {
      continue;
    }
    if (filter.lockedOnly && !item.locked) {
      continue;
    }
    if (filter.newOnly && !item.isNew) {
      continue;
    }

    const usableBySelected = isItemUsableByGear(item, activeGear);
    if (filter.usability === 'selected_gear' && !usableBySelected) {
      continue;
    }
    if (filter.usability === 'any_gear') {
      const usableByAny = ownedGears.some((g) => isItemUsableByGear(item, g));
      if (!usableByAny) continue;
    }

    const isUpgrade = isItemUpgradeForGear(item, activeGear, inventory);
    if (filter.onlyUpgrades && !isUpgrade) {
      continue;
    }

    const displayName = resolveDisplayName(item);
    if (query.length > 0 && !displayName.toLowerCase().includes(query)) {
      continue;
    }

    const equippedBy = getItemEquippedByGear(allGears, item.instanceId);
    const equippedOnSelected = equippedBy === activeGear.classId;
    const validation = validateEquipOnGear(item, activeGear, allGears);

    enriched.push({
      item,
      powerScore: calculateItemPowerScore(item),
      sellValue: getSellPrice(item),
      equippedBy,
      equippedOnSelected,
      usableBySelected,
      isUpgrade,
      validation,
      displayName,
    });
  }

  const indexMap = new Map(inventory.map((it, i) => [it.instanceId, i]));
  const dir = filter.sortDir === 'asc' ? 1 : -1;

  enriched.sort((a, b) => {
    if (a.usableBySelected !== b.usableBySelected) {
      return a.usableBySelected ? -1 : 1;
    }

    if (filter.pinEquippedFirst) {
      const pinA = a.equippedOnSelected ? 2 : a.equippedBy ? 1 : 0;
      const pinB = b.equippedOnSelected ? 2 : b.equippedBy ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
    }

    let cmp = 0;
    switch (filter.sortBy) {
      case 'newest': {
        const tA = a.item.obtainedAt ?? 0;
        const tB = b.item.obtainedAt ?? 0;
        if (tA !== tB) {
          return (tA - tB) * dir;
        }
        // Store prepends new drops/purchases at index 0, so smaller index = newer.
        // Apply sort direction once: desc (-1) keeps smaller index first; asc (+1) puts larger index first.
        const idxA = indexMap.get(a.item.instanceId) ?? 0;
        const idxB = indexMap.get(b.item.instanceId) ?? 0;
        if (idxA !== idxB) {
          return dir === -1 ? idxA - idxB : idxB - idxA;
        }
        return a.item.instanceId.localeCompare(b.item.instanceId);
      }
      case 'level':
        cmp = a.item.requiredLevel - b.item.requiredLevel;
        break;
      case 'rarity':
        cmp = RARITY_RANK[a.item.rarity] - RARITY_RANK[b.item.rarity];
        break;
      case 'tier':
        cmp = a.item.tier - b.item.tier;
        break;
      case 'rollQuality':
        cmp = a.item.rollQuality - b.item.rollQuality;
        break;
      case 'sellValue':
        cmp = a.sellValue - b.sellValue;
        break;
      case 'powerScore':
        cmp = a.powerScore - b.powerScore;
        break;
      case 'name':
        cmp = a.displayName.localeCompare(b.displayName);
        break;
    }

    if (cmp !== 0) return cmp * dir;
    return a.item.instanceId.localeCompare(b.item.instanceId);
  });

  return enriched;
}

/**
 * Counts how many active non-default filters are enabled in the filter drawer.
 */
export function countActiveInventoryFilters(filter: InventoryFilterState): number {
  let count = 0;
  if (filter.rarities.length > 0) count += 1;
  if (filter.tiers.length > 0) count += 1;
  if (filter.minLevel !== null || filter.maxLevel !== null) count += 1;
  if (filter.usability !== 'all') count += 1;
  if (filter.minQuality > 0 || filter.maxQuality < 100) count += 1;
  if (filter.onlyUpgrades) count += 1;
  if (filter.lockedOnly) count += 1;
  if (filter.newOnly) count += 1;
  return count;
}

/**
 * Detects whether ANY gameplay-altering cheat/override is active in AdminConfig.
 * Drives the visible "Cheats active" badge in TopHud.
 */
export function isAnyCheatActive(cfg: AdminConfig | undefined | null): boolean {
  if (!cfg) return false;
  if (cfg.godMode || cfg.oneHitKills || cfg.alwaysWin) return true;
  if (cfg.rewardMultiplier !== BALANCE_CONFIG.rewardMultDefault) return true;
  if (cfg.battleSizeOverride !== null) return true;
  if (isEnrageConfigModified(cfg)) return true;
  if (cfg.forceBoss) return true;
  if (cfg.battleLevelOffsetOverride !== null) return true;
  if (
    cfg.shopMinStock !== SHOP_STOCK_CONFIG.minStockPerCategory ||
    cfg.shopMaxStock !== SHOP_STOCK_CONFIG.maxStockPerCategory
  ) {
    return true;
  }
  if (Math.abs(cfg.shopPriceMultiplier - 1) > 0.001) return true;
  if (
    cfg.shopRarityWeights.common !== DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.common ||
    cfg.shopRarityWeights.uncommon !== DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.uncommon ||
    cfg.shopRarityWeights.rare !== DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.rare ||
    cfg.shopRarityWeights.epic !== DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.epic ||
    cfg.shopRarityWeights.legendary !== DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS.legendary
  ) {
    return true;
  }
  if (!isFormationConfigDefault(cfg.formation)) {
    return true;
  }
  return false;
}
