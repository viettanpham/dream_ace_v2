import { sanitizeBattlePenaltyConfig } from '../data/balance';
import type {
  AdminConfig,
  BattlePenaltyConfig,
  CombatUnit,
} from '../types/game';
import { getExpForNextLevel } from './stats';

export type RepairFeeKind = 'defeat' | 'retreat';

export interface RepairFeeResult {
  fee: number;
  free: boolean;
}

export interface RetreatPenaltyResult {
  expPenalty: number;
  creditPenalty: number;
  wpPenalty: number;
  nextExp: number;
  nextCredits: number;
  nextWarPoints: number;
}

function resolveBattlePenaltyConfig(
  cfgOrAdmin?: BattlePenaltyConfig | AdminConfig | null
): BattlePenaltyConfig {
  if (
    cfgOrAdmin &&
    typeof cfgOrAdmin === 'object' &&
    ('battlePenalty' in cfgOrAdmin || 'rewardMultiplier' in cfgOrAdmin)
  ) {
    return sanitizeBattlePenaltyConfig(
      (cfgOrAdmin as AdminConfig).battlePenalty
    );
  }
  return sanitizeBattlePenaltyConfig(cfgOrAdmin);
}

/**
 * Computes retreat penalty on deployed Gear EXP, Credits, and War Points.
 * Only applies when deployed Gear level > retreatFreeLevel.
 * EXP, Credits, and WP never go negative and Gear never de-levels.
 */
export function computeRetreatPenalty(
  level: number,
  currentExp: number,
  credits: number,
  warPoints: number,
  cfgOrAdmin?: BattlePenaltyConfig | AdminConfig | null
): RetreatPenaltyResult {
  const cfg = resolveBattlePenaltyConfig(cfgOrAdmin);
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const safeExp = Math.max(0, Math.floor(currentExp || 0));
  const safeCredits = Math.max(0, Math.floor(credits || 0));
  const safeWp = Math.max(0, Math.floor(warPoints || 0));

  if (safeLevel <= cfg.retreatFreeLevel) {
    return {
      expPenalty: 0,
      creditPenalty: 0,
      wpPenalty: 0,
      nextExp: safeExp,
      nextCredits: safeCredits,
      nextWarPoints: safeWp,
    };
  }

  const need = getExpForNextLevel(safeLevel);
  const targetExpPen = Math.round(need * (cfg.retreatExpPenaltyPct / 100));

  let expPenalty = 0;
  let nextExp = safeExp;
  let rawCreditPen = 0;

  if (safeExp >= targetExpPen) {
    expPenalty = targetExpPen;
    nextExp = Math.max(0, safeExp - expPenalty);
    rawCreditPen = Math.round(need * (cfg.retreatExpPenaltyPct / 100));
  } else {
    expPenalty = 0;
    nextExp = safeExp;
    rawCreditPen = Math.round(
      need *
        ((cfg.retreatExpPenaltyPct + cfg.retreatShortfallExtraCreditPct) / 100)
    );
  }

  const rawWpPen = Math.round(rawCreditPen * (cfg.retreatWpPenaltyPct / 100));

  const creditPenalty = Math.min(safeCredits, Math.max(0, rawCreditPen));
  const wpPenalty = Math.min(safeWp, Math.max(0, rawWpPen));

  return {
    expPenalty,
    creditPenalty,
    wpPenalty,
    nextExp,
    nextCredits: Math.max(0, safeCredits - creditPenalty),
    nextWarPoints: Math.max(0, safeWp - wpPenalty),
  };
}

/**
 * Pure repair fee calculation for defeat or retreat.
 * Free when level <= freeLevel AND credits <= freeCredits.
 * Else fee = min(cap, sum(HP * hpCoef + Shield * shieldCoef)) across ally units:
 * - defeat: full max HP / max Shield of all ally units
 * - retreat: lost HP / lost Shield (destroyed unit = full max)
 */
export function computeRepairFee(
  kind: RepairFeeKind,
  level: number,
  credits: number,
  units: CombatUnit[],
  cfg?: BattlePenaltyConfig | AdminConfig | null
): RepairFeeResult {
  const penaltyCfg = resolveBattlePenaltyConfig(cfg);
  const tier =
    kind === 'defeat' ? penaltyCfg.repairDefeat : penaltyCfg.repairRetreat;
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const safeCredits = Math.max(0, credits || 0);

  if (safeLevel <= tier.freeLevel && safeCredits <= tier.freeCredits) {
    return { fee: 0, free: true };
  }

  const allies = units.filter((u) => u.side === 'ally');
  let hpSum = 0;
  let shieldSum = 0;

  for (const unit of allies) {
    const maxHp = Math.max(0, unit.derived?.maxHp ?? 0);
    const maxShield = Math.max(0, unit.derived?.maxShield ?? 0);
    if (kind === 'defeat') {
      hpSum += maxHp;
      shieldSum += maxShield;
    } else {
      const destroyed = !unit.alive || unit.hp <= 0;
      if (destroyed) {
        hpSum += maxHp;
        shieldSum += maxShield;
      } else {
        hpSum += Math.max(0, maxHp - Math.max(0, unit.hp));
        shieldSum += Math.max(0, maxShield - Math.max(0, unit.shield));
      }
    }
  }

  const rawFee = hpSum * tier.hpCoef + shieldSum * tier.shieldCoef;
  const fee = Math.round(Math.min(tier.cap, Math.max(0, rawFee)));
  return { fee, free: false };
}
