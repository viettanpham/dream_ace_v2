import type {
  AdminConfig,
  MedalId,
  MedalsConfig,
  MonthlyEconomyConfig,
} from '../types/game';
import type { CardTierNumber } from './cardTiers';
import { sanitizeMedalsConfig } from './medals';

export interface MonthlyMedalCounts {
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  t5: number;
}

export const DEFAULT_MONTHLY_ECONOMY_CONFIG: MonthlyEconomyConfig = {
  salaryBaseWp: 1000,
  salaryPerBaseWp: 100,
  coefBase: 1.0,
  coefStepPct: 10,
  coefEveryPct: 10,
  homeMedalMin: 0,
  homeMedalMax: 5,
  subBaseMedalMin: 1,
  subBaseMedalBaseMax: 3,
  subBaseMedalStepPerDecile: 1,
  tier3Pct: 11,
  tier3Count: 0,
  tier4Pct: 31,
  tier4Count: 0,
  tier5Pct: 51,
  tier5Count: 0,
};

export function cloneMonthlyEconomyConfig(
  cfg: MonthlyEconomyConfig
): MonthlyEconomyConfig {
  return { ...cfg };
}

function clampInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampFloat(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
}

export function sanitizeMonthlyEconomyConfig(
  raw: unknown
): MonthlyEconomyConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const d = DEFAULT_MONTHLY_ECONOMY_CONFIG;

  const homeMedalMin = clampInt(obj.homeMedalMin, d.homeMedalMin, 0, 50);
  const homeMedalMax = Math.max(
    homeMedalMin,
    clampInt(obj.homeMedalMax, d.homeMedalMax, 0, 100)
  );
  const subBaseMedalMin = clampInt(
    obj.subBaseMedalMin,
    d.subBaseMedalMin,
    0,
    50
  );
  const subBaseMedalBaseMax = Math.max(
    subBaseMedalMin,
    clampInt(obj.subBaseMedalBaseMax, d.subBaseMedalBaseMax, 0, 100)
  );

  return {
    salaryBaseWp: clampInt(obj.salaryBaseWp, d.salaryBaseWp, 0, 1_000_000),
    salaryPerBaseWp: clampInt(
      obj.salaryPerBaseWp,
      d.salaryPerBaseWp,
      0,
      100_000
    ),
    coefBase: clampFloat(obj.coefBase, d.coefBase, 0, 20),
    coefStepPct: clampFloat(obj.coefStepPct, d.coefStepPct, 0, 500),
    coefEveryPct: clampInt(obj.coefEveryPct, d.coefEveryPct, 1, 100),
    homeMedalMin,
    homeMedalMax,
    subBaseMedalMin,
    subBaseMedalBaseMax,
    subBaseMedalStepPerDecile: clampInt(
      obj.subBaseMedalStepPerDecile,
      d.subBaseMedalStepPerDecile,
      0,
      20
    ),
    tier3Pct: clampInt(obj.tier3Pct, d.tier3Pct, 0, 100),
    tier3Count: clampInt(obj.tier3Count, d.tier3Count, 0, 100),
    tier4Pct: clampInt(obj.tier4Pct, d.tier4Pct, 0, 100),
    tier4Count: clampInt(obj.tier4Count, d.tier4Count, 0, 100),
    tier5Pct: clampInt(obj.tier5Pct, d.tier5Pct, 0, 100),
    tier5Count: clampInt(obj.tier5Count, d.tier5Count, 0, 100),
  };
}

export function resolveMonthlyEconomyConfig(
  cfg?: Partial<MonthlyEconomyConfig> | AdminConfig | null
): MonthlyEconomyConfig {
  if (!cfg) return DEFAULT_MONTHLY_ECONOMY_CONFIG;
  if ('showRawI18nKeys' in cfg || 'monthlyEconomy' in cfg) {
    return sanitizeMonthlyEconomyConfig((cfg as AdminConfig).monthlyEconomy);
  }
  return sanitizeMonthlyEconomyConfig(cfg);
}

export function randIntInclusive(
  min: number,
  max: number,
  rng: () => number = Math.random
): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  const r = Math.min(0.999999999999, Math.max(0, Number(rng()) || 0));
  return lo + Math.floor(r * (hi - lo + 1));
}

export function getAllowedMedalTiers(
  capturedPct: number,
  capturedSubBases: number,
  cfg?: Partial<MonthlyEconomyConfig> | null
): CardTierNumber[] {
  const clean = sanitizeMonthlyEconomyConfig(cfg);
  const allowed: CardTierNumber[] = [1, 2];
  if (
    capturedPct >= clean.tier3Pct ||
    (clean.tier3Count > 0 && capturedSubBases >= clean.tier3Count)
  ) {
    allowed.push(3);
  }
  if (
    capturedPct >= clean.tier4Pct ||
    (clean.tier4Count > 0 && capturedSubBases >= clean.tier4Count)
  ) {
    allowed.push(4);
  }
  if (
    capturedPct >= clean.tier5Pct ||
    (clean.tier5Count > 0 && capturedSubBases >= clean.tier5Count)
  ) {
    allowed.push(5);
  }
  return allowed;
}

export function cascadeMedalsByTiers(
  total: number,
  allowedTiers: readonly CardTierNumber[],
  rng: () => number = Math.random
): MonthlyMedalCounts {
  const counts: MonthlyMedalCounts = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 };
  const sorted = Array.from(new Set(allowedTiers)).sort((a, b) => a - b);
  let remaining = Math.max(0, Math.floor(total));
  if (remaining <= 0 || sorted.length === 0) return counts;

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const key = `t${tier}` as keyof MonthlyMedalCounts;
    if (i === sorted.length - 1) {
      counts[key] = remaining;
      remaining = 0;
    } else {
      const rolled = randIntInclusive(0, remaining, rng);
      counts[key] = rolled;
      remaining -= rolled;
    }
  }
  return counts;
}

export function medalCountsToPilotMap(
  counts: MonthlyMedalCounts
): Partial<Record<MedalId, number>> {
  return {
    ...(counts.t1 > 0 ? { medal_t1: counts.t1 } : {}),
    ...(counts.t2 > 0 ? { medal_t2: counts.t2 } : {}),
    ...(counts.t3 > 0 ? { medal_t3: counts.t3 } : {}),
    ...(counts.t4 > 0 ? { medal_t4: counts.t4 } : {}),
    ...(counts.t5 > 0 ? { medal_t5: counts.t5 } : {}),
  };
}

export interface MonthlyEconomyRollResult {
  capturedSubBases: number;
  totalSubBases: number;
  capturedPct: number;
  hasCapital: boolean;
  salaryCoef: number;
  salaryWp: number;
  homeRoll: number;
  subTotal: number;
  totalMedals: number;
  allowedTiers: CardTierNumber[];
  medals: MonthlyMedalCounts;
}

export function computeMonthlySalary(params: {
  capturedSubBases: number;
  totalSubBases: number;
  hasCapital: boolean;
  economyCfg?: Partial<MonthlyEconomyConfig> | null;
}): {
  capturedPct: number;
  coef: number;
  salaryWp: number;
} {
  const cfg = sanitizeMonthlyEconomyConfig(params.economyCfg);
  const total = Math.max(0, Math.floor(params.totalSubBases));
  const captured = Math.max(0, Math.min(total, Math.floor(params.capturedSubBases)));
  const capturedPct = total > 0 ? (captured / total) * 100 : 0;

  if (!params.hasCapital) {
    return { capturedPct, coef: 0, salaryWp: 0 };
  }

  const steps = cfg.coefEveryPct > 0 ? Math.floor(capturedPct / cfg.coefEveryPct) : 0;
  const coef =
    Math.round((cfg.coefBase + (cfg.coefStepPct / 100) * steps) * 10000) /
    10000;
  const salaryWp = Math.max(
    0,
    Math.round((cfg.salaryBaseWp + cfg.salaryPerBaseWp * captured) * coef)
  );
  return { capturedPct, coef, salaryWp };
}

export function computeMonthlyEconomyRoll(params: {
  capturedSubBases: number;
  totalSubBases: number;
  hasCapital: boolean;
  economyCfg?: Partial<MonthlyEconomyConfig> | null;
  rng?: () => number;
}): MonthlyEconomyRollResult {
  const cfg = sanitizeMonthlyEconomyConfig(params.economyCfg);
  const rng = params.rng ?? Math.random;
  const total = Math.max(0, Math.floor(params.totalSubBases));
  const captured = Math.max(0, Math.min(total, Math.floor(params.capturedSubBases)));
  const { capturedPct, coef, salaryWp } = computeMonthlySalary({
    capturedSubBases: captured,
    totalSubBases: total,
    hasCapital: params.hasCapital,
    economyCfg: cfg,
  });

  if (!params.hasCapital) {
    return {
      capturedSubBases: captured,
      totalSubBases: total,
      capturedPct,
      hasCapital: false,
      salaryCoef: 0,
      salaryWp: 0,
      homeRoll: 0,
      subTotal: 0,
      totalMedals: 0,
      allowedTiers: [],
      medals: { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 },
    };
  }

  const homeRoll = randIntInclusive(cfg.homeMedalMin, cfg.homeMedalMax, rng);
  const deciles = Math.floor(capturedPct / 10);
  const subMax = Math.max(
    cfg.subBaseMedalMin,
    cfg.subBaseMedalBaseMax + cfg.subBaseMedalStepPerDecile * deciles
  );
  const subTotal =
    captured > 0
      ? captured * randIntInclusive(cfg.subBaseMedalMin, subMax, rng)
      : 0;
  const totalMedals = homeRoll + subTotal;
  const allowedTiers = getAllowedMedalTiers(capturedPct, captured, cfg);
  const medals = cascadeMedalsByTiers(totalMedals, allowedTiers, rng);

  return {
    capturedSubBases: captured,
    totalSubBases: total,
    capturedPct,
    hasCapital: true,
    salaryCoef: coef,
    salaryWp,
    homeRoll,
    subTotal,
    totalMedals,
    allowedTiers,
    medals,
  };
}

export interface MonthlyEconomyEstimate {
  capturedPct: number;
  capturedSubBases: number;
  totalSubBases: number;
  salaryCoef: number;
  salaryWp: number;
  expectedMedals: number;
  allowedTiers: CardTierNumber[];
  expectedByTier: MonthlyMedalCounts;
  expectedMedalWp: number;
  expectedTotalWp: number;
}

export function estimateMonthlyEconomyAtPct(params: {
  capturedPct: number;
  totalSubBases: number;
  economyCfg?: Partial<MonthlyEconomyConfig> | null;
  medalsCfg?: Partial<MedalsConfig> | null;
}): MonthlyEconomyEstimate {
  const cfg = sanitizeMonthlyEconomyConfig(params.economyCfg);
  const mCfg = sanitizeMedalsConfig(params.medalsCfg);
  const total = Math.max(1, Math.floor(params.totalSubBases));
  const pct = Math.max(0, Math.min(100, params.capturedPct));
  const captured = Math.round((pct / 100) * total);
  const salary = computeMonthlySalary({
    capturedSubBases: captured,
    totalSubBases: total,
    hasCapital: true,
    economyCfg: cfg,
  });

  const avgHome = (cfg.homeMedalMin + cfg.homeMedalMax) / 2;
  const deciles = Math.floor(salary.capturedPct / 10);
  const subMax = Math.max(
    cfg.subBaseMedalMin,
    cfg.subBaseMedalBaseMax + cfg.subBaseMedalStepPerDecile * deciles
  );
  const avgPerBase = (cfg.subBaseMedalMin + subMax) / 2;
  const expectedMedals = avgHome + captured * avgPerBase;

  const allowedTiers = getAllowedMedalTiers(salary.capturedPct, captured, cfg);
  const expectedByTier: MonthlyMedalCounts = {
    t1: 0,
    t2: 0,
    t3: 0,
    t4: 0,
    t5: 0,
  };
  let remaining = expectedMedals;
  for (let i = 0; i < allowedTiers.length; i++) {
    const tier = allowedTiers[i];
    const key = `t${tier}` as keyof MonthlyMedalCounts;
    if (i === allowedTiers.length - 1) {
      expectedByTier[key] = Math.round(remaining * 10) / 10;
    } else {
      const avgShare = remaining / 2;
      expectedByTier[key] = Math.round(avgShare * 10) / 10;
      remaining -= avgShare;
    }
  }

  // Compute exact unrounded expected WP sum across tiers
  let remUnrounded = expectedMedals;
  let medalWpSum = 0;
  for (let i = 0; i < allowedTiers.length; i++) {
    const tier = allowedTiers[i];
    const wpPerMedal = mCfg.wp[tier - 1] ?? 0;
    if (i === allowedTiers.length - 1) {
      medalWpSum += remUnrounded * wpPerMedal;
    } else {
      const share = remUnrounded / 2;
      medalWpSum += share * wpPerMedal;
      remUnrounded -= share;
    }
  }

  const expectedMedalWp = Math.round(medalWpSum);
  return {
    capturedPct: Math.round(salary.capturedPct),
    capturedSubBases: captured,
    totalSubBases: total,
    salaryCoef: salary.coef,
    salaryWp: salary.salaryWp,
    expectedMedals: Math.round(expectedMedals * 10) / 10,
    allowedTiers,
    expectedByTier,
    expectedMedalWp,
    expectedTotalWp: salary.salaryWp + expectedMedalWp,
  };
}
