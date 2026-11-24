import type {
  BattleSpeed,
  ItemRarity,
  SectorDifficulty,
  SkillCategory,
} from '../types/game';

/**
 * Single centralized balance & economy configuration file for DREAM ACE.
 * All leveling, reward, War Points, skill shop, shop, enchant, and garage constants live here.
 */
export const BALANCE_CONFIG = {
  // ---- Per-Gear Progression ----
  startingLevel: 1,
  maxLevel: 50,
  initialStatPoints: 3,
  statPointsPerLevel: 3,
  startingCredits: 350,
  startingWarPoints: 0,

  // EXP to next level = Math.round(expBase * level ^ expExponent)
  expBase: 60,
  expExponent: 1.4,

  // ---- Battle Rewards Rebalance ----
  // EXP per enemy = 25 + 8 * enemyLevel
  // Credits per enemy = 60 + 20 * enemyLevel
  rewardMultDefault: 2.0,
  enemyExpBase: 25,
  enemyExpPerLevel: 8,
  enemyCreditsBase: 60,
  enemyCreditsPerLevel: 20,
  bossRewardMultiplier: 5,

  // War Points earned from battles & base captures
  warPointsPerEnemyBase: 4,
  warPointsPerEnemyLevel: 1,
  warPointsBaseCaptureBonus: {
    Standard: 40,
    Hard: 80,
    Elite: 140,
  } as Record<SectorDifficulty, number>,

  // Victory = 100%; Defeat/Retreat = 50% of destroyed enemies + 20% flat consolation of full victory
  victoryRewardRatio: 1.0,
  defeatDestroyedRatio: 0.5,
  defeatConsolationRatio: 0.2,

  // ---- Garage Unlock Prices (by number of Gears currently owned) ----
  garageUnlockPrices: [0, 800, 2000, 4500] as readonly number[],

  // ---- Shop & Cargo Economy ----
  shopStockSize: 12,
  shopRefreshCost: 120,
  shopSellRatio: 0.4,
  maxInventorySize: 100, // default, use getBoxCapacity

  // ---- Auto Battle Tactics ----
  maxTacticsRules: 12,

  // ---- Enchant (+0 to +10) ----
  enchantMaxLevel: 10,
  enchantBonusPerLevel: 0.08,
  enchantSuccessRates: [100, 92, 84, 75, 66, 58, 50, 42, 36, 30] as readonly number[],
  enchantBaseCostFloor: 40,
  enchantPriceCostFactor: 0.14,
  enchantLevelCostStep: 0.45,

  // ---- Gear Skill System (Levels 1-5, +10% effect/level, 6-slot active bar) ----
  maxEquippedActiveSkills: 6,
  skillMaxLevel: 5,
  skillEffectScalePerLevel: 0.1, // +10% effect per level above Lv1
  skillLevelReqStep: 4, // Gear level needed for skill Lv n = unlockLevel + 4 * (n - 1)
  skillLearnBaseCost: {
    normal: 160,
    passive: 220,
    special: 420,
    elite: 750,
  } as Record<SkillCategory, number>,
  skillUpgradeCosts: [250, 550, 1100, 2200] as readonly number[],
  openingCardCosts: {
    special: 80,
    elite: 160,
  },

  // ---- Randomized Item Rarity Config ----
  rarityAffixCount: {
    common: 0,
    rare: 1,
    epic: 2,
    legendary: 3,
  } as Record<ItemRarity, number>,

  rarityStatMultiplier: {
    common: 1.0,
    rare: 1.16,
    epic: 1.34,
    legendary: 1.56,
  } as Record<ItemRarity, number>,

  rarityPriceMultiplier: {
    common: 1.0,
    rare: 1.65,
    epic: 2.75,
    legendary: 4.6,
  } as Record<ItemRarity, number>,

  tierStatScale: [1.0, 1.45, 2.05, 2.8] as readonly number[],
  /** @deprecated Replaced by PRICE_FORMULA.tierFactor in src/data/itemPricing.ts */
  tierPriceScale: [1.0, 1.85, 3.2, 5.4] as readonly number[],

  // ---- Drop Rates per Sector Difficulty ----
  dropConfig: {
    Standard: {
      perEnemyDropChance: 0.28,
      maxDropsPerBattle: 2,
      rarityWeights: { common: 64, rare: 26, epic: 8, legendary: 2 },
      maxTier: 2,
    },
    Hard: {
      perEnemyDropChance: 0.36,
      maxDropsPerBattle: 3,
      rarityWeights: { common: 40, rare: 38, epic: 17, legendary: 5 },
      maxTier: 3,
    },
    Elite: {
      perEnemyDropChance: 0.45,
      maxDropsPerBattle: 3,
      rarityWeights: { common: 18, rare: 38, epic: 31, legendary: 13 },
      maxTier: 4,
    },
  } as Record<
    SectorDifficulty,
    {
      perEnemyDropChance: number;
      maxDropsPerBattle: number;
      rarityWeights: Record<ItemRarity, number>;
      maxTier: number;
    }
  >,

  // ---- Status Effects ----
  burnDamageRatio: 0.08, // 8% of Max HP per turn
  slowSpeedPenalty: 0.3, // -30% Turn Speed
  shieldBreakDuration: 2,
  backRowDamageReduction: 0.15, // 15% damage reduction in back row unless attacker is in Siege Mode

  // ---- Battle Speed Delays (ms) ----
  battleSpeedDelays: {
    1: 760,
    2: 400,
    3: 240,
    5: 120,
    10: 40,
    12: 32,
    15: 24,
    20: 16,
    30: 10,
  } as Record<BattleSpeed, number>,
  // Anti-Stalemate (Soft Enrage): after round 20, enemies deal +10% damage per round, capped at +200%
  enrageStartRound: 20,
  enrageStepPct: 0.1,
  enrageMaxBonusPct: 2.0,
  maxAccuracyPct: 30,
} as const;

export const COMBAT_FORMULAS = {
  hpPerDefense: 8,
  hpPerLevel: 22,
  shieldPerShieldStat: 6,
  shieldPerLevel: 8,
  spPerSpirit: 2,
  spPerLevel: 2,
  speedFuelWeight: 0.85,
  speedEvasionWeight: 0.55,
  dodgePerEvasion: 0.75,
  maxDodgeChance: 42,
  baseCritChance: 8,
  critPerEvasion: 0.4,
  maxCritChance: 65,
  critDamageMultiplier: 1.5,
  defenseMitigationDivisor: 65,
  defendDamageMultiplier: 0.5,
  attackSpGain: 5,
  defendSpGain: 12,
  defendShieldRestoreRatio: 0.16,
  damageVarianceMin: 0.92,
  damageVarianceMax: 1.08,
} as const;

export function getGarageUnlockCost(ownedCount: number): number {
  const idx = Math.max(
    0,
    Math.min(BALANCE_CONFIG.garageUnlockPrices.length - 1, ownedCount)
  );
  return BALANCE_CONFIG.garageUnlockPrices[idx];
}

export function getSkillUpgradeCost(currentLevel: number): number | null {
  if (currentLevel >= BALANCE_CONFIG.skillMaxLevel) return null;
  const idx = Math.max(0, currentLevel - 1);
  return BALANCE_CONFIG.skillUpgradeCosts[idx] ?? null;
}

export function getSkillPurchaseCost(
  category: SkillCategory,
  unlockLevel: number,
  targetLevel: number
): number {
  const base = BALANCE_CONFIG.skillLearnBaseCost[category] + unlockLevel * 18;
  if (targetLevel <= 1) return base;
  const stepCost =
    BALANCE_CONFIG.skillUpgradeCosts[
      Math.min(BALANCE_CONFIG.skillUpgradeCosts.length - 1, targetLevel - 2)
    ] ?? 500;
  return Math.round(stepCost + unlockLevel * 20);
}
