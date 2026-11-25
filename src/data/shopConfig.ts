import type { EquipmentSlot, ItemRarity } from '../types/game';

/**
 * Single centralized configuration for Credits Shop & War Point Market stock generation,
 * weighted stock counts, restock cadence, price multipliers, and WP rotating offers.
 */
export interface ShopStockConfig {
  minStockPerCategory: number;
  maxStockPerCategory: number;
  /** Weighted count distribution from 3 to 10 (skewed toward low end). */
  stockCountWeights: Record<number, number>;
  /** Extra stock slots added when pilot controls an operational allied Shipyard. */
  shipyardStockBonus: number;
  /** Credits cost to manually refresh the Credits Shop. */
  refreshCostCredits: number;
  /** War Points cost to manually refresh the rotating WP offers. */
  wpRefreshCostWp: number;
  /** Auto-restock after every N completed battles. */
  restockEveryNBattles: number;
  /** Auto-restock when advancing a campaign month. */
  restockOnMonthAdvance: boolean;
  /** Default rarity weights by shop max tier (1..4). */
  rarityWeightsByTier: Record<number, Record<ItemRarity, number>>;
  /** Rotating WP Market offer bounds. */
  wpMinOffers: number;
  wpMaxOffers: number;
  wpOffers: {
    equipmentCrate: {
      baseWpCostByRarity: Record<ItemRarity, number>;
      rarityWeights: Record<ItemRarity, number>;
      slots: EquipmentSlot[];
    };
    enchantStone: {
      wpCost: number;
      bonusPct: number;
    };
    respecToken: {
      wpCost: number;
    };
    expBoost: {
      wpCost: number;
      battlesCount: number;
      expBonusPct: number;
    };
  };
}

export const SHOP_STOCK_CONFIG: ShopStockConfig = {
  minStockPerCategory: 3,
  maxStockPerCategory: 10,
  stockCountWeights: {
    3: 25,
    4: 25,
    5: 20,
    6: 12,
    7: 8,
    8: 5,
    9: 3,
    10: 2,
  },
  shipyardStockBonus: 2,
  refreshCostCredits: 120,
  wpRefreshCostWp: 25,
  restockEveryNBattles: 1,
  restockOnMonthAdvance: true,
  rarityWeightsByTier: {
    1: { common: 40, uncommon: 22, rare: 30, epic: 7, legendary: 1 },
    2: { common: 32, uncommon: 18, rare: 36, epic: 12, legendary: 2 },
    3: { common: 25, uncommon: 13, rare: 40, epic: 18, legendary: 4 },
    4: { common: 16, uncommon: 9, rare: 40, epic: 26, legendary: 9 },
  },
  wpMinOffers: 3,
  wpMaxOffers: 10,
  wpOffers: {
    equipmentCrate: {
      baseWpCostByRarity: {
        common: 35,
        uncommon: 45,
        rare: 55,
        epic: 95,
        legendary: 160,
      },
      rarityWeights: {
        common: 0,
        uncommon: 0,
        rare: 55,
        epic: 35,
        legendary: 10,
      },
      slots: ['main_weapon', 'sub_weapon', 'armor', 'engine', 'cpu', 'accessory'],
    },
    enchantStone: {
      wpCost: 45,
      bonusPct: 20,
    },
    respecToken: {
      wpCost: 40,
    },
    expBoost: {
      wpCost: 50,
      battlesCount: 5,
      expBonusPct: 50,
    },
  },
};

export const DEFAULT_ADMIN_SHOP_RARITY_WEIGHTS: Record<ItemRarity, number> = {
  common: 29,
  uncommon: 16,
  rare: 35,
  epic: 15,
  legendary: 5,
};
