import { MECH_CLASS_LIST } from '../data/classes';
import type {
  GearUnit,
  ItemInstance,
  MechClassId,
  QuickSellFilterConfig,
  QuickSellPresetId,
} from '../types/game';
import {
  getGearEquippedInstances,
  getItemEquippedByGear,
  getSellPrice,
} from './equipment';
import { calculateItemPowerScore, RARITY_RANK } from './inventory';

export const DEFAULT_QUICK_SELL_CONFIG: QuickSellFilterConfig = {
  maxRarity: 'common',
  maxTier: null,
  maxRequiredLevel: null,
  belowEquippedLevel: false,
  maxSellValue: null,
  maxRollQuality: null,
  worseThanEquipped: false,
  worseThanEquippedScope: 'selected',
};

/**
 * Generates a preset QuickSellFilterConfig.
 */
export function buildQuickSellPreset(
  preset: QuickSellPresetId,
  activeGearLevel: number
): QuickSellFilterConfig {
  switch (preset) {
    case 'sell_common':
      return {
        maxRarity: 'common',
        maxTier: null,
        maxRequiredLevel: null,
        belowEquippedLevel: false,
        maxSellValue: null,
        maxRollQuality: null,
        worseThanEquipped: false,
        worseThanEquippedScope: 'selected',
      };
    case 'sell_below_level':
      return {
        maxRarity: null,
        maxTier: null,
        maxRequiredLevel: Math.max(1, activeGearLevel - 1),
        belowEquippedLevel: false,
        maxSellValue: null,
        maxRollQuality: null,
        worseThanEquipped: false,
        worseThanEquippedScope: 'selected',
      };
    case 'sell_worse_than_equipped':
      return {
        maxRarity: null,
        maxTier: null,
        maxRequiredLevel: null,
        belowEquippedLevel: false,
        maxSellValue: null,
        maxRollQuality: null,
        worseThanEquipped: true,
        worseThanEquippedScope: 'selected',
      };
  }
}

export type QuickSellItemSource = 'box' | 'warehouse';

export interface QuickSellSourceFilter {
  box: boolean;
  warehouse: boolean;
}

export interface TaggedQuickSellItem {
  item: ItemInstance;
  source: QuickSellItemSource;
}

export interface QuickSellEvaluationResult {
  matchingItems: ItemInstance[];
  totalCredits: number;
  hasAnyFilterEnabled: boolean;
  excludedStats: {
    equipped: number;
    locked: number;
    favorited: number;
  };
}

export interface QuickSellMultiSourceEvaluationResult
  extends QuickSellEvaluationResult {
  matchingEntries: TaggedQuickSellItem[];
}

/**
 * Checks whether at least one filter predicate is enabled in QuickSellFilterConfig.
 */
export function hasActiveQuickSellFilter(cfg: QuickSellFilterConfig): boolean {
  return (
    cfg.maxRarity !== null ||
    cfg.maxTier !== null ||
    cfg.maxRequiredLevel !== null ||
    cfg.belowEquippedLevel ||
    cfg.maxSellValue !== null ||
    cfg.maxRollQuality !== null ||
    cfg.worseThanEquipped
  );
}

/**
 * Pure reusable Quick Sell filter engine (usable by Quick Sell modal AND future post-battle auto-sell).
 *
 * Rules:
 * - ALWAYS excludes items equipped on ANY Gear, locked items, and favorited items.
 * - Combines all enabled conditions with strict AND logic.
 * - If NO filter condition is enabled, returns empty list (safe default — never sells entire bag by accident).
 */
export function evaluateQuickSellCandidates(
  inventory: ItemInstance[],
  config: QuickSellFilterConfig,
  activeGear: GearUnit,
  allGears: Record<MechClassId, GearUnit>
): QuickSellEvaluationResult {
  const excludedStats = { equipped: 0, locked: 0, favorited: 0 };
  const hasAnyFilterEnabled = hasActiveQuickSellFilter(config);
  if (!hasAnyFilterEnabled) {
    return {
      matchingItems: [],
      totalCredits: 0,
      hasAnyFilterEnabled: false,
      excludedStats,
    };
  }

  const activeEquippedMap = getGearEquippedInstances(activeGear, inventory);
  const ownedGears = MECH_CLASS_LIST.map((c) => allGears[c.id]).filter(
    (g): g is GearUnit => Boolean(g && g.owned)
  );
  const ownedEquippedMaps = ownedGears.map((g) => ({
    gear: g,
    equipped: getGearEquippedInstances(g, inventory),
  }));

  const matchingItems: ItemInstance[] = [];
  let totalCredits = 0;

  for (const item of inventory) {
    // Hard exclusions — NEVER sell equipped, locked, or favorited items
    if (getItemEquippedByGear(allGears, item.instanceId) !== null) {
      excludedStats.equipped += 1;
      continue;
    }
    if (item.locked) {
      excludedStats.locked += 1;
      continue;
    }
    if (item.favorited) {
      excludedStats.favorited += 1;
      continue;
    }

    // Condition 1: rarity <= X
    if (
      config.maxRarity !== null &&
      RARITY_RANK[item.rarity] > RARITY_RANK[config.maxRarity]
    ) {
      continue;
    }

    // Condition 2: tier <= T
    if (config.maxTier !== null && item.tier > config.maxTier) {
      continue;
    }

    // Condition 3: requiredLevel <= L
    if (
      config.maxRequiredLevel !== null &&
      item.requiredLevel > config.maxRequiredLevel
    ) {
      continue;
    }

    // Condition 4: required level lower than equipped item in that slot on active Gear
    if (config.belowEquippedLevel) {
      const equippedInSlot = activeEquippedMap[item.slot];
      if (!equippedInSlot || item.requiredLevel >= equippedInSlot.requiredLevel) {
        continue;
      }
    }

    // Condition 5: sellValue <= N Credits
    const sellVal = getSellPrice(item);
    if (config.maxSellValue !== null && sellVal > config.maxSellValue) {
      continue;
    }

    // Condition 6: rollQuality <= P%
    if (
      config.maxRollQuality !== null &&
      item.rollQuality > config.maxRollQuality
    ) {
      continue;
    }

    // Condition 7: worse than equipped (power score < equipped in that slot)
    if (config.worseThanEquipped) {
      const itemScore = calculateItemPowerScore(item);
      if (config.worseThanEquippedScope === 'any_owned') {
        // Worse than equipped for EVERY owned Gear that can wear this item's class restriction
        const relevantGears = ownedEquippedMaps.filter(
          ({ gear }) =>
            item.classRestriction === null || item.classRestriction === gear.classId
        );
        if (relevantGears.length === 0) continue;
        const worseForAll = relevantGears.every(({ equipped }) => {
          const eq = equipped[item.slot];
          return eq !== null && itemScore < calculateItemPowerScore(eq);
        });
        if (!worseForAll) continue;
      } else {
        const eq = activeEquippedMap[item.slot];
        if (!eq || itemScore >= calculateItemPowerScore(eq)) {
          continue;
        }
      }
    }

    matchingItems.push(item);
    totalCredits += sellVal;
  }

  return {
    matchingItems,
    totalCredits,
    hasAnyFilterEnabled: true,
    excludedStats,
  };
}

/**
 * Evaluates Quick Sell candidates across checked sources ("Hòm đồ" / "Kho đồ")
 * by delegating to the pure `evaluateQuickSellCandidates` without altering its rules.
 * - When only `box` is checked, returns `evaluateQuickSellCandidates(boxItems, ...)` verbatim.
 * - Always passes `boxItems` in the combined pool so `getGearEquippedInstances` can resolve equipped slot gear.
 */
export function evaluateQuickSellCandidatesWithSources(
  boxItems: ItemInstance[],
  warehouseItems: ItemInstance[],
  sources: QuickSellSourceFilter,
  config: QuickSellFilterConfig,
  activeGear: GearUnit,
  allGears: Record<MechClassId, GearUnit>
): QuickSellMultiSourceEvaluationResult {
  const hasAnyFilterEnabled = hasActiveQuickSellFilter(config);

  if (!sources.box && !sources.warehouse) {
    return {
      matchingItems: [],
      matchingEntries: [],
      totalCredits: 0,
      hasAnyFilterEnabled,
      excludedStats: { equipped: 0, locked: 0, favorited: 0 },
    };
  }

  if (sources.box && !sources.warehouse) {
    const base = evaluateQuickSellCandidates(
      boxItems,
      config,
      activeGear,
      allGears
    );
    return {
      ...base,
      matchingEntries: base.matchingItems.map((item) => ({
        item,
        source: 'box',
      })),
    };
  }

  const sourceById = new Map<string, QuickSellItemSource>();
  for (const item of boxItems) {
    if (!sourceById.has(item.instanceId)) {
      sourceById.set(item.instanceId, 'box');
    }
  }
  const uniqueWarehouse: ItemInstance[] = [];
  for (const item of warehouseItems) {
    if (!sourceById.has(item.instanceId)) {
      sourceById.set(item.instanceId, 'warehouse');
      uniqueWarehouse.push(item);
    }
  }

  const combined = [...boxItems, ...uniqueWarehouse];
  const raw = evaluateQuickSellCandidates(
    combined,
    config,
    activeGear,
    allGears
  );

  if (!raw.hasAnyFilterEnabled) {
    return {
      ...raw,
      matchingEntries: [],
      excludedStats: sources.box
        ? raw.excludedStats
        : computeExcludedStatsForPool(uniqueWarehouse, allGears),
    };
  }

  const matchingEntries: TaggedQuickSellItem[] = [];
  const matchingItems: ItemInstance[] = [];
  let totalCredits = 0;

  for (const item of raw.matchingItems) {
    const source = sourceById.get(item.instanceId) ?? 'box';
    if (!sources[source]) continue;
    matchingItems.push(item);
    matchingEntries.push({ item, source });
    totalCredits += getSellPrice(item);
  }

  return {
    matchingItems,
    matchingEntries,
    totalCredits: sources.box && sources.warehouse ? raw.totalCredits : totalCredits,
    hasAnyFilterEnabled: true,
    excludedStats: sources.box
      ? raw.excludedStats
      : computeExcludedStatsForPool(uniqueWarehouse, allGears),
  };
}

function computeExcludedStatsForPool(
  items: ItemInstance[],
  allGears: Record<MechClassId, GearUnit>
): QuickSellEvaluationResult['excludedStats'] {
  const excludedStats = { equipped: 0, locked: 0, favorited: 0 };
  for (const item of items) {
    if (getItemEquippedByGear(allGears, item.instanceId) !== null) {
      excludedStats.equipped += 1;
      continue;
    }
    if (item.locked) {
      excludedStats.locked += 1;
      continue;
    }
    if (item.favorited) {
      excludedStats.favorited += 1;
    }
  }
  return excludedStats;
}
