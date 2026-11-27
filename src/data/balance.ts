import type {
  BattleSpeed,
  FluxTransferConfig,
  FluxTransferLevelRule,
  ItemRarity,
  MechClassId,
  PassiveSlotsConfig,
  SectorDifficulty,
  SkillCategory,
  SpEconomyConfig,
} from '../types/game';

/**
 * Single centralized balance & economy configuration file for DREAM ACE.
 * All leveling, reward, War Points, skill shop, shop, enchant, and garage constants live here.
 */
export const BALANCE_CONFIG = {
  // ---- Per-Gear Progression ----
  startingLevel: 1,
  maxLevel: 100,
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

  // ---- Gear Skill System (Default cap 5, configurable 1-20, +10% effect/level, 6-slot active bar) ----
  maxEquippedActiveSkills: 6,
  skillMaxLevel: 5,
  skillMaxLevelHardCap: 20,
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
    special: 800,
    elite: 1600,
  },

  // ---- Randomized Item Rarity Config ----
  rarityAffixCount: {
    common: 0,
    uncommon: 0,
    rare: 1,
    epic: 2,
    legendary: 3,
  } as Record<ItemRarity, number>,

  rarityStatMultiplier: {
    common: 1.0,
    uncommon: 1.08,
    rare: 1.16,
    epic: 1.34,
    legendary: 1.56,
  } as Record<ItemRarity, number>,

  rarityPriceMultiplier: {
    common: 1.0,
    uncommon: 1.3,
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
      rarityWeights: { common: 42, uncommon: 22, rare: 26, epic: 8, legendary: 2 },
      maxTier: 2,
    },
    Hard: {
      perEnemyDropChance: 0.36,
      maxDropsPerBattle: 3,
      rarityWeights: { common: 26, uncommon: 14, rare: 38, epic: 17, legendary: 5 },
      maxTier: 3,
    },
    Elite: {
      perEnemyDropChance: 0.45,
      maxDropsPerBattle: 3,
      rarityWeights: { common: 12, uncommon: 6, rare: 38, epic: 31, legendary: 13 },
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
  > ,

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
  maxAccuracyPct: 30,
} as const;

export const DEFAULT_ENRAGE_CONFIG = {
  rage: {
    startRound: 20,
    everyRounds: 5,
    maxStacks: 10,
    value: 5,
  },
  frenzy: {
    startRound: 50,
    everyRounds: 5,
    maxStacks: 20,
    value: 10,
  },
  berserker: {
    startRound: 100,
    everyRounds: 10,
    maxStacks: 10,
    critRatePct: 3,
    critDamagePct: 10,
    critOverflowRatio: 2,
  },
} as const;

export function cloneEnrageConfig(cfg: {
  rage: { startRound: number; everyRounds: number; maxStacks: number; value: number };
  frenzy: { startRound: number; everyRounds: number; maxStacks: number; value: number };
  berserker: {
    startRound: number;
    everyRounds: number;
    maxStacks: number;
    critRatePct: number;
    critDamagePct: number;
    critOverflowRatio?: number;
  };
} = DEFAULT_ENRAGE_CONFIG) {
  return {
    rage: { ...cfg.rage },
    frenzy: { ...cfg.frenzy },
    berserker: {
      ...cfg.berserker,
      critOverflowRatio:
        cfg.berserker.critOverflowRatio ??
        DEFAULT_ENRAGE_CONFIG.berserker.critOverflowRatio,
    },
  };
}

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
  attackSpGain: 0,
  defendSpGain: 0,
  defendShieldRestoreRatio: 0.16,
  damageVarianceMin: 0.92,
  damageVarianceMax: 1.08,
} as const;

export const DEFAULT_SP_ECONOMY_CONFIG: SpEconomyConfig = {
  regenPerSpirit: 0.3,
  classFactor: {
    striker: 1,
    interceptor: 1,
    siege: 1,
    support: 1.3,
  },
  costLevelPct: 0.02,
};

export function cloneSpEconomyConfig(cfg: SpEconomyConfig): SpEconomyConfig {
  return {
    regenPerSpirit: cfg.regenPerSpirit,
    classFactor: { ...cfg.classFactor },
    costLevelPct: cfg.costLevelPct,
  };
}

function clampSpNum(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, raw));
}

export function sanitizeSpEconomyConfig(raw: unknown): SpEconomyConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const rawFactors =
    obj.classFactor && typeof obj.classFactor === 'object' && !Array.isArray(obj.classFactor)
      ? (obj.classFactor as Record<string, unknown>)
      : {};
  const classIds: MechClassId[] = ['striker', 'interceptor', 'siege', 'support'];
  const classFactor = { ...DEFAULT_SP_ECONOMY_CONFIG.classFactor };
  for (const id of classIds) {
    classFactor[id] = clampSpNum(
      rawFactors[id],
      0.1,
      3,
      DEFAULT_SP_ECONOMY_CONFIG.classFactor[id]
    );
  }
  return {
    regenPerSpirit: clampSpNum(
      obj.regenPerSpirit,
      0,
      2,
      DEFAULT_SP_ECONOMY_CONFIG.regenPerSpirit
    ),
    classFactor,
    costLevelPct: clampSpNum(
      obj.costLevelPct,
      0,
      0.1,
      DEFAULT_SP_ECONOMY_CONFIG.costLevelPct
    ),
  };
}

export const DEFAULT_STEALTH_CONFIG = {
  lidarDetectMin: 1,
  lidarDetectMax: 5,
} as const;

export function cloneStealthConfig(cfg: {
  lidarDetectMin: number;
  lidarDetectMax: number;
}) {
  return {
    lidarDetectMin: cfg.lidarDetectMin,
    lidarDetectMax: cfg.lidarDetectMax,
  };
}

export function sanitizeStealthConfig(raw: unknown): {
  lidarDetectMin: number;
  lidarDetectMax: number;
} {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const clampInt = (val: unknown, min: number, max: number, fallback: number) => {
    const n = typeof val === 'number' && Number.isFinite(val) ? Math.round(val) : fallback;
    return Math.max(min, Math.min(max, n));
  };
  const lidarDetectMin = clampInt(
    obj.lidarDetectMin,
    1,
    10,
    DEFAULT_STEALTH_CONFIG.lidarDetectMin
  );
  const rawMax = clampInt(
    obj.lidarDetectMax,
    1,
    10,
    DEFAULT_STEALTH_CONFIG.lidarDetectMax
  );
  const lidarDetectMax = Math.max(lidarDetectMin, rawMax);
  return {
    lidarDetectMin,
    lidarDetectMax,
  };
}

export function computeLidarDetectCount(
  skillLevel: number,
  stealthCfg?: unknown,
  skillMaxLevel: number = BALANCE_CONFIG.skillMaxLevel
): number {
  const cfg = sanitizeStealthConfig(stealthCfg);
  const maxLv = Math.max(1, Math.round(skillMaxLevel));
  const lv = Math.max(1, Math.min(maxLv, Math.round(skillLevel || 1)));
  if (maxLv <= 1) return Math.round(cfg.lidarDetectMin);
  return Math.round(
    cfg.lidarDetectMin +
      ((cfg.lidarDetectMax - cfg.lidarDetectMin) * (lv - 1)) / (maxLv - 1)
  );
}

export const DEFAULT_FLUX_TRANSFER_LEVELS: readonly FluxTransferLevelRule[] = [
  { targets: 3, pct: 3, fee: 10 },
  { targets: 4, pct: 4, fee: 8 },
  { targets: 5, pct: 5, fee: 5 },
  { targets: 6, pct: 6, fee: 3 },
  { targets: 7, pct: 8, fee: 1 },
];

export const DEFAULT_FLUX_TRANSFER_CONFIG: Required<FluxTransferConfig> = {
  levels: DEFAULT_FLUX_TRANSFER_LEVELS.map((r) => ({ ...r })),
  minPerLevel: 20,
  allySpBelowPct: 25,
  keepSelfPct: 50,
};

export function cloneFluxTransferConfig(
  cfg: FluxTransferConfig
): Required<FluxTransferConfig> {
  const clean = sanitizeFluxTransferConfig(cfg);
  return {
    levels: clean.levels.map((r) => ({ ...r })),
    minPerLevel: clean.minPerLevel,
    allySpBelowPct: clean.allySpBelowPct,
    keepSelfPct: clean.keepSelfPct,
  };
}

export function sanitizeFluxTransferConfig(
  raw: unknown
): Required<FluxTransferConfig> {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const rawLevels = Array.isArray(obj.levels) ? obj.levels : [];
  const levels: FluxTransferLevelRule[] = DEFAULT_FLUX_TRANSFER_LEVELS.map(
    (def, idx) => {
      const row =
        rawLevels[idx] &&
        typeof rawLevels[idx] === 'object' &&
        !Array.isArray(rawLevels[idx])
          ? (rawLevels[idx] as Record<string, unknown>)
          : {};
      return {
        targets: Math.round(clampSpNum(row.targets, 1, 10, def.targets)),
        pct: clampSpNum(row.pct, 0, 100, def.pct),
        fee: clampSpNum(row.fee, 0, 100, def.fee),
      };
    }
  );
  return {
    levels,
    minPerLevel: Math.round(
      clampSpNum(
        obj.minPerLevel,
        0,
        200,
        DEFAULT_FLUX_TRANSFER_CONFIG.minPerLevel
      )
    ),
    allySpBelowPct: clampSpNum(
      obj.allySpBelowPct,
      0,
      100,
      DEFAULT_FLUX_TRANSFER_CONFIG.allySpBelowPct
    ),
    keepSelfPct: clampSpNum(
      obj.keepSelfPct,
      0,
      100,
      DEFAULT_FLUX_TRANSFER_CONFIG.keepSelfPct
    ),
  };
}

function getClampedFluxSkillLevel(
  skillLevel: number,
  skillMaxLevel: number = DEFAULT_SKILL_MAX_LEVEL
): number {
  const maxLv = sanitizeSkillMaxLevel(skillMaxLevel);
  return Math.max(1, Math.min(maxLv, Math.floor(skillLevel || 1)));
}

export const DEFAULT_SKILL_MAX_LEVEL = BALANCE_CONFIG.skillMaxLevel;
export const MIN_SKILL_MAX_LEVEL = 1;
export const MAX_SKILL_MAX_LEVEL = BALANCE_CONFIG.skillMaxLevelHardCap;
export const DEFAULT_PASSIVE_SCALE_AFTER_5 = 0.5;
export const DEFAULT_RESTORE_PCT_CAP = 0.8;
export const MIN_RESTORE_PCT_CAP = 0.1;
export const MAX_RESTORE_PCT_CAP = 1.0;
export const DEFAULT_PASSIVE_SLOTS_CONFIG: PassiveSlotsConfig = {
  initial: 2,
  everyLevels: 5,
  max: 12,
};

export function sanitizeSkillMaxLevel(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_SKILL_MAX_LEVEL;
  }
  return Math.max(MIN_SKILL_MAX_LEVEL, Math.min(MAX_SKILL_MAX_LEVEL, Math.round(raw)));
}

export function getEffectiveSkillMaxLevel(
  adminOrCap?: { skillMaxLevel?: unknown } | number | null
): number {
  if (typeof adminOrCap === 'number') {
    return sanitizeSkillMaxLevel(adminOrCap);
  }
  return sanitizeSkillMaxLevel(adminOrCap?.skillMaxLevel);
}

export function sanitizePassiveScaleAfter5(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_PASSIVE_SCALE_AFTER_5;
  }
  return Math.max(0, Math.min(1, Math.round(raw * 100) / 100));
}

export function sanitizeRestorePctCap(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_RESTORE_PCT_CAP;
  }
  return Math.max(
    MIN_RESTORE_PCT_CAP,
    Math.min(MAX_RESTORE_PCT_CAP, Math.round(raw * 100) / 100)
  );
}

export function sanitizePassiveSlotsConfig(raw: unknown): PassiveSlotsConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const initialRaw =
    typeof obj.initial === 'number' && Number.isFinite(obj.initial)
      ? Math.round(obj.initial)
      : DEFAULT_PASSIVE_SLOTS_CONFIG.initial;
  const initial = Math.max(1, Math.min(12, initialRaw));
  const everyRaw =
    typeof obj.everyLevels === 'number' && Number.isFinite(obj.everyLevels)
      ? Math.round(obj.everyLevels)
      : DEFAULT_PASSIVE_SLOTS_CONFIG.everyLevels;
  const everyLevels = Math.max(1, Math.min(50, everyRaw));
  const maxRaw =
    typeof obj.max === 'number' && Number.isFinite(obj.max)
      ? Math.round(obj.max)
      : DEFAULT_PASSIVE_SLOTS_CONFIG.max;
  const max = Math.max(initial, Math.min(12, maxRaw));
  return { initial, everyLevels, max };
}

export function clonePassiveSlotsConfig(
  cfg?: Partial<PassiveSlotsConfig> | null
): PassiveSlotsConfig {
  return { ...sanitizePassiveSlotsConfig(cfg) };
}

export function getUnlockedPassiveSlots(
  level: number,
  cfg?: Partial<PassiveSlotsConfig> | null
): number {
  const clean = sanitizePassiveSlotsConfig(cfg);
  const lv = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  return Math.min(clean.max, clean.initial + Math.floor(lv / clean.everyLevels));
}

export function getPassiveSlotUnlockGearLevel(
  slotIndex: number,
  cfg?: Partial<PassiveSlotsConfig> | null
): number {
  const clean = sanitizePassiveSlotsConfig(cfg);
  if (slotIndex < clean.initial) return 1;
  return Math.max(1, (slotIndex + 1 - clean.initial) * clean.everyLevels);
}

export function getFluxTransferRule(
  skillLevel: number,
  cfg?: FluxTransferConfig | null,
  skillMaxLevel: number = DEFAULT_SKILL_MAX_LEVEL
): FluxTransferLevelRule {
  const clean = sanitizeFluxTransferConfig(cfg);
  const maxLv = sanitizeSkillMaxLevel(skillMaxLevel);
  const lv = getClampedFluxSkillLevel(skillLevel, maxLv);
  if (maxLv === clean.levels.length) {
    return { ...clean.levels[lv - 1] };
  }
  const first = clean.levels[0];
  const last = clean.levels[clean.levels.length - 1];
  const t = maxLv <= 1 ? 0 : (lv - 1) / (maxLv - 1);
  return {
    targets: Math.max(
      1,
      Math.round(first.targets + (last.targets - first.targets) * t)
    ),
    pct: Math.round((first.pct + (last.pct - first.pct) * t) * 100) / 100,
    fee: Math.round((first.fee + (last.fee - first.fee) * t) * 100) / 100,
  };
}

export function getFluxMinPerAlly(
  skillLevel: number,
  cfg?: FluxTransferConfig | null,
  skillMaxLevel: number = DEFAULT_SKILL_MAX_LEVEL
): number {
  const clean = sanitizeFluxTransferConfig(cfg);
  const lv = getClampedFluxSkillLevel(skillLevel, skillMaxLevel);
  return clean.minPerLevel * lv;
}

export function getFluxPlannedAmountEach(
  actorSp: number,
  skillLevel: number,
  cfg?: FluxTransferConfig | null,
  skillMaxLevel: number = DEFAULT_SKILL_MAX_LEVEL
): number {
  const rule = getFluxTransferRule(skillLevel, cfg, skillMaxLevel);
  const minPerAlly = getFluxMinPerAlly(skillLevel, cfg, skillMaxLevel);
  const safeSp = Math.max(0, Math.floor(actorSp));
  return Math.max(Math.floor(safeSp * (rule.pct / 100)), minPerAlly);
}

export function getFluxMinCastCost(
  actorSp: number,
  skillLevel: number,
  cfg?: FluxTransferConfig | null,
  skillMaxLevel: number = DEFAULT_SKILL_MAX_LEVEL
): number {
  const rule = getFluxTransferRule(skillLevel, cfg, skillMaxLevel);
  const amountEach = getFluxPlannedAmountEach(
    actorSp,
    skillLevel,
    cfg,
    skillMaxLevel
  );
  return amountEach > 0 ? Math.ceil(amountEach * (1 + rule.fee / 100)) : 0;
}

export function getGarageUnlockCost(ownedCount: number): number {
  const idx = Math.max(
    0,
    Math.min(BALANCE_CONFIG.garageUnlockPrices.length - 1, ownedCount)
  );
  return BALANCE_CONFIG.garageUnlockPrices[idx];
}

export function getSkillUpgradeBaseCostForTargetLevel(targetLevel: number): number {
  const lv = Math.max(2, Math.floor(targetLevel));
  const table = BALANCE_CONFIG.skillUpgradeCosts;
  const idx = lv - 2;
  if (idx < table.length) {
    return table[idx];
  }
  const lastCost = table[table.length - 1];
  const extraLevels = idx - (table.length - 1);
  return Math.round(lastCost * Math.pow(1.8, extraLevels));
}

export function getSkillUpgradeCost(
  currentLevel: number,
  skillMaxLevel: number = DEFAULT_SKILL_MAX_LEVEL
): number | null {
  const maxLv = sanitizeSkillMaxLevel(skillMaxLevel);
  if (currentLevel >= maxLv) return null;
  return getSkillUpgradeBaseCostForTargetLevel(Math.max(1, currentLevel) + 1);
}

export function getSkillPurchaseCost(
  category: SkillCategory,
  unlockLevel: number,
  targetLevel: number
): number {
  const base = BALANCE_CONFIG.skillLearnBaseCost[category] + unlockLevel * 18;
  if (targetLevel <= 1) return base;
  const stepCost = getSkillUpgradeBaseCostForTargetLevel(targetLevel);
  return Math.round(stepCost + unlockLevel * 20);
}

let runtimeMaxLevel: number = BALANCE_CONFIG.maxLevel;

export function sanitizeMaxLevel(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return BALANCE_CONFIG.maxLevel;
  }
  const rounded = Math.round(raw);
  if (rounded < 1) {
    return BALANCE_CONFIG.maxLevel;
  }
  return rounded;
}

export function getMaxLevel(): number {
  return runtimeMaxLevel;
}

export function setRuntimeMaxLevel(raw: unknown): number {
  runtimeMaxLevel = sanitizeMaxLevel(raw);
  return runtimeMaxLevel;
}

