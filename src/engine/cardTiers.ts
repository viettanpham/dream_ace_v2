import { BALANCE_CONFIG, getMaxLevel } from '../data/balance';
import type {
  AdminConfig,
  CardTiersConfig,
  GearUnit,
  TierTuple5,
} from '../types/game';
import { getExpForNextLevel } from './stats';

export type CardTierNumber = 1 | 2 | 3 | 4 | 5;

export const DEFAULT_CARD_TIERS_CONFIG: CardTiersConfig = {
  exp: {
    values: [1000, 3000, 5000, 10000, 20000],
    maxLevels: [1, 2, 3, 4, 5],
  },
  credit: {
    values: [10000, 20000, 50000, 100000, 200000],
  },
  previewWastePct: 50,
};

export function cloneCardTiersConfig(cfg: CardTiersConfig): CardTiersConfig {
  return {
    exp: {
      values: [...cfg.exp.values] as TierTuple5,
      maxLevels: [...cfg.exp.maxLevels] as TierTuple5,
    },
    credit: {
      values: [...cfg.credit.values] as TierTuple5,
    },
    previewWastePct: cfg.previewWastePct,
  };
}

function sanitizeAscendingPositiveTuple(
  raw: unknown,
  fallback: TierTuple5,
  maxCap: number
): TierTuple5 {
  if (!Array.isArray(raw) || raw.length !== 5) {
    return [...fallback] as TierTuple5;
  }
  const parsed: number[] = [];
  for (let i = 0; i < 5; i++) {
    const n = typeof raw[i] === 'number' ? raw[i] : Number(raw[i]);
    if (!Number.isFinite(n) || Math.floor(n) < 1) {
      return [...fallback] as TierTuple5;
    }
    parsed.push(Math.min(maxCap, Math.floor(n)));
  }
  for (let i = 1; i < 5; i++) {
    if (parsed[i] <= parsed[i - 1]) {
      parsed[i] = Math.min(maxCap, parsed[i - 1] + 1);
    }
  }
  // If upper values collided at maxCap, guarantee strict ascending via fallback
  for (let i = 1; i < 5; i++) {
    if (parsed[i] <= parsed[i - 1]) {
      return [...fallback] as TierTuple5;
    }
  }
  return parsed as TierTuple5;
}

function sanitizeMaxLevelsTuple(raw: unknown, fallback: TierTuple5): TierTuple5 {
  if (!Array.isArray(raw) || raw.length !== 5) {
    return [...fallback] as TierTuple5;
  }
  const out: number[] = [];
  for (let i = 0; i < 5; i++) {
    const n = typeof raw[i] === 'number' ? raw[i] : Number(raw[i]);
    if (!Number.isFinite(n)) {
      out.push(fallback[i]);
    } else {
      out.push(Math.max(1, Math.min(20, Math.round(n))));
    }
  }
  return out as TierTuple5;
}

export function sanitizeCardTiersConfig(raw: unknown): CardTiersConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const rawExp =
    obj.exp && typeof obj.exp === 'object' && !Array.isArray(obj.exp)
      ? (obj.exp as Record<string, unknown>)
      : {};
  const rawCredit =
    obj.credit && typeof obj.credit === 'object' && !Array.isArray(obj.credit)
      ? (obj.credit as Record<string, unknown>)
      : {};

  const rawWaste =
    typeof obj.previewWastePct === 'number'
      ? obj.previewWastePct
      : Number(obj.previewWastePct);
  const previewWastePct = Number.isFinite(rawWaste)
    ? Math.max(0, Math.min(100, Math.round(rawWaste)))
    : DEFAULT_CARD_TIERS_CONFIG.previewWastePct;

  return {
    exp: {
      values: sanitizeAscendingPositiveTuple(
        rawExp.values,
        DEFAULT_CARD_TIERS_CONFIG.exp.values,
        1_000_000
      ),
      maxLevels: sanitizeMaxLevelsTuple(
        rawExp.maxLevels,
        DEFAULT_CARD_TIERS_CONFIG.exp.maxLevels
      ),
    },
    credit: {
      values: sanitizeAscendingPositiveTuple(
        rawCredit.values,
        DEFAULT_CARD_TIERS_CONFIG.credit.values,
        10_000_000
      ),
    },
    previewWastePct,
  };
}

function resolveCardTiersConfig(
  cfg?: CardTiersConfig | AdminConfig | null
): CardTiersConfig {
  if (!cfg) return DEFAULT_CARD_TIERS_CONFIG;
  if ('showRawI18nKeys' in cfg || 'cardTiers' in cfg) {
    return sanitizeCardTiersConfig((cfg as AdminConfig).cardTiers);
  }
  return sanitizeCardTiersConfig(cfg as CardTiersConfig);
}

export function getCardTier(
  kind: 'exp' | 'credit',
  value: number,
  cfg?: CardTiersConfig | AdminConfig | null
): CardTierNumber {
  const clean = resolveCardTiersConfig(cfg);
  const values = kind === 'exp' ? clean.exp.values : clean.credit.values;
  if (!Number.isFinite(value) || value < values[0]) {
    return 1;
  }
  const exactIdx = values.indexOf(value);
  if (exactIdx !== -1) {
    return (exactIdx + 1) as CardTierNumber;
  }
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] <= value) {
      return (i + 1) as CardTierNumber;
    }
  }
  return 1;
}

export interface ExpCardApplyResult {
  updatedGear: GearUnit;
  previousLevel: number;
  newLevel: number;
  levelsGained: number;
  cardExp: number;
  appliedExp: number;
  wastedExp: number;
  statPointsGained: number;
  tier: CardTierNumber;
  maxLevelsAllowed: number;
  cardsUsed: number;
}

export function applySingleExpCardToGear(
  gear: GearUnit,
  cardExp: number,
  cfg?: CardTiersConfig | AdminConfig | null
): ExpCardApplyResult {
  const cleanCfg = resolveCardTiersConfig(cfg);
  const cleanCardExp = Math.max(0, Math.round(cardExp));
  const tier = getCardTier('exp', cleanCardExp, cleanCfg);
  const maxLevelsAllowed = Math.max(1, cleanCfg.exp.maxLevels[tier - 1] ?? 1);
  const globalMaxLevel = getMaxLevel();

  if (gear.level >= globalMaxLevel || cleanCardExp <= 0) {
    return {
      updatedGear: gear,
      previousLevel: gear.level,
      newLevel: gear.level,
      levelsGained: 0,
      cardExp: cleanCardExp,
      appliedExp: 0,
      wastedExp: cleanCardExp,
      statPointsGained: 0,
      tier,
      maxLevelsAllowed,
      cardsUsed: 0,
    };
  }

  const levelCap = Math.min(globalMaxLevel, gear.level + maxLevelsAllowed);
  let level = gear.level;
  let exp = Math.max(0, Math.round(gear.exp));
  let remainingCardExp = cleanCardExp;
  let appliedExp = 0;
  let unspentPoints = gear.unspentPoints;
  let statPointsGained = 0;

  while (level < levelCap && remainingCardExp > 0) {
    const neededForNext = Math.max(0, getExpForNextLevel(level) - exp);
    if (remainingCardExp >= neededForNext) {
      remainingCardExp -= neededForNext;
      appliedExp += neededForNext;
      level += 1;
      exp = 0;
      unspentPoints += BALANCE_CONFIG.statPointsPerLevel;
      statPointsGained += BALANCE_CONFIG.statPointsPerLevel;
    } else {
      exp += remainingCardExp;
      appliedExp += remainingCardExp;
      remainingCardExp = 0;
      break;
    }
  }

  if (level >= levelCap) {
    exp = 0;
  }
  const wastedExp = Math.max(0, cleanCardExp - appliedExp);

  const updatedGear: GearUnit = {
    ...gear,
    level,
    exp,
    unspentPoints,
  };

  return {
    updatedGear,
    previousLevel: gear.level,
    newLevel: level,
    levelsGained: level - gear.level,
    cardExp: cleanCardExp,
    appliedExp,
    wastedExp,
    statPointsGained,
    tier,
    maxLevelsAllowed,
    cardsUsed: 1,
  };
}

export function applyExpCardBatchToGear(
  gear: GearUnit,
  cardExp: number,
  maxCards: number,
  cfg?: CardTiersConfig | AdminConfig | null
): ExpCardApplyResult {
  const cleanCfg = resolveCardTiersConfig(cfg);
  const cleanCardExp = Math.max(0, Math.round(cardExp));
  const tier = getCardTier('exp', cleanCardExp, cleanCfg);
  const maxLevelsAllowed = Math.max(1, cleanCfg.exp.maxLevels[tier - 1] ?? 1);
  const globalMaxLevel = getMaxLevel();
  const limit = Math.max(0, Math.floor(maxCards));

  let curGear = gear;
  let totalCardExp = 0;
  let totalApplied = 0;
  let totalWasted = 0;
  let totalStatPoints = 0;
  let cardsUsed = 0;

  for (let i = 0; i < limit; i++) {
    if (curGear.level >= globalMaxLevel) break;
    const single = applySingleExpCardToGear(curGear, cleanCardExp, cleanCfg);
    if (single.appliedExp <= 0 && single.levelsGained <= 0) break;
    curGear = single.updatedGear;
    totalCardExp += single.cardExp;
    totalApplied += single.appliedExp;
    totalWasted += single.wastedExp;
    totalStatPoints += single.statPointsGained;
    cardsUsed += 1;
  }

  return {
    updatedGear: curGear,
    previousLevel: gear.level,
    newLevel: curGear.level,
    levelsGained: curGear.level - gear.level,
    cardExp: totalCardExp,
    appliedExp: totalApplied,
    wastedExp: totalWasted,
    statPointsGained: totalStatPoints,
    tier,
    maxLevelsAllowed,
    cardsUsed,
  };
}
