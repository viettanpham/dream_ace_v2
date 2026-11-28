import { sanitizeBattlePenaltyConfig } from '../data/balance';
import { getAllVouchers, getVoucherById } from '../data/vouchers';
import type {
  AdminConfig,
  BattlePenaltyConfig,
  BattleSummary,
  CombatUnit,
  VoucherConfig,
  VoucherKind,
} from '../types/game';
import { getExpForNextLevel } from './stats';

export type RepairFeeKind = 'defeat' | 'retreat';

export interface RepairFeeResult {
  fee: number;
  subsidy: number;
  payable: number;
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

export interface DefeatExpPenaltyResult {
  expPenalty: number;
  nextExp: number;
  free: boolean;
}

/**
 * Computes defeat penalty on deployed Gear EXP only (no credit/WP penalty).
 * Free when level <= defeatFreeLevel or defeatExpPenaltyFactor <= 0.
 * Never negative, never de-levels; short EXP clamps to what is left.
 */
export function computeDefeatExpPenalty(
  level: number,
  currentExp: number,
  cfgOrAdmin?: BattlePenaltyConfig | AdminConfig | null
): DefeatExpPenaltyResult {
  const cfg = resolveBattlePenaltyConfig(cfgOrAdmin);
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const safeExp = Math.max(0, Math.floor(currentExp || 0));

  if (safeLevel <= cfg.defeatFreeLevel || cfg.defeatExpPenaltyFactor <= 0) {
    return {
      expPenalty: 0,
      nextExp: safeExp,
      free: true,
    };
  }

  const need = getExpForNextLevel(safeLevel);
  const rawPen = Math.max(
    0,
    Math.round(need * (cfg.retreatExpPenaltyPct / 100) * cfg.defeatExpPenaltyFactor)
  );
  const expPenalty = Math.min(safeExp, rawPen);
  const nextExp = Math.max(0, safeExp - expPenalty);

  return {
    expPenalty,
    nextExp,
    free: false,
  };
}

/**
 * Pure repair fee calculation for defeat or retreat.
 * Fee follows real damage with NO cap and NO credit check:
 * - defeat: full max HP / max Shield of all ally units
 * - retreat: lost HP / lost Shield (destroyed unit = full max)
 * Government subsidy applies up to `tier.subsidyMax` when level <= `tier.subsidyLevel`.
 * Player pays `payable = max(0, fee - subsidy)`.
 */
export function computeRepairFee(
  kind: RepairFeeKind,
  level: number,
  credits: number,
  units: CombatUnit[],
  cfg?: BattlePenaltyConfig | AdminConfig | null
): RepairFeeResult {
  void credits;
  const penaltyCfg = resolveBattlePenaltyConfig(cfg);
  const tier =
    kind === 'defeat' ? penaltyCfg.repairDefeat : penaltyCfg.repairRetreat;
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;

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
  const fee = Math.round(Math.max(0, rawFee));
  const subsidyCap =
    safeLevel <= tier.subsidyLevel ? Math.max(0, Math.round(tier.subsidyMax)) : 0;
  const subsidy = Math.min(fee, subsidyCap);
  const payable = Math.max(0, fee - subsidy);
  return { fee, subsidy, payable, free: payable === 0 };
}

export interface VoucherRefundResult {
  used: Record<string, number>;
  refund: number;
}

export function getBattleSummaryCharges(
  summary?: Pick<
    BattleSummary,
    'repairFee' | 'retreatPenaltyCredit' | 'retreatPenaltyExp' | 'defeatPenaltyExp'
  > | null
): { creditCharged: number; expCharged: number } {
  if (!summary) return { creditCharged: 0, expCharged: 0 };
  const repair = Math.max(0, Math.round(Number(summary.repairFee) || 0));
  const retCr = Math.max(
    0,
    Math.round(Number(summary.retreatPenaltyCredit) || 0)
  );
  const retExp = Math.max(
    0,
    Math.round(Number(summary.retreatPenaltyExp) || 0)
  );
  const defExp = Math.max(
    0,
    Math.round(Number(summary.defeatPenaltyExp) || 0)
  );
  return {
    creditCharged: repair + retCr,
    expCharged: retExp + defExp,
  };
}

/**
 * Picks vouchers to cover `charged` using greedy smallest-sufficient loop:
 * While remaining > 0, pick the smallest owned voucher of `kind` with value >= remaining,
 * otherwise pick the largest owned voucher of `kind`.
 */
export function pickVouchersSmallestSufficient(
  owned: Record<string, number> | null | undefined,
  kind: VoucherKind,
  charged: number,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): Record<string, number> {
  const safeCharged = Number.isFinite(charged)
    ? Math.max(0, Math.floor(charged))
    : 0;
  if (safeCharged <= 0 || !owned) return {};

  const candidates = getAllVouchers(cfgOrAdmin)
    .filter((v) => v.kind === kind)
    .sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));

  const avail: Record<string, number> = {};
  for (const v of candidates) {
    const qty = Math.max(0, Math.floor(Number(owned[v.id]) || 0));
    if (qty > 0) avail[v.id] = qty;
  }

  const picked: Record<string, number> = {};
  let remaining = safeCharged;

  while (remaining > 0) {
    const available = candidates.filter((v) => (avail[v.id] ?? 0) > 0);
    if (available.length === 0) break;

    const smallestSufficient = available.find((v) => v.value >= remaining);
    const chosen = smallestSufficient ?? available[available.length - 1];

    picked[chosen.id] = (picked[chosen.id] ?? 0) + 1;
    avail[chosen.id] -= 1;
    remaining = Math.max(0, remaining - chosen.value);
  }

  return picked;
}

export function getVoucherSelectionFaceSum(
  selection: Record<string, number> | null | undefined,
  kind: VoucherKind,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): number {
  if (!selection) return 0;
  let faceSum = 0;
  for (const [id, rawQty] of Object.entries(selection)) {
    const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
    if (qty <= 0) continue;
    const def = getVoucherById(id, cfgOrAdmin);
    if (!def || def.kind !== kind) continue;
    faceSum += def.value * qty;
  }
  return faceSum;
}

export function pickDefaultVoucherSelection(
  owned: Record<string, number> | null | undefined,
  kind: VoucherKind,
  charged: number,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): Record<string, number> {
  const picked = pickVouchersSmallestSufficient(owned, kind, charged, cfgOrAdmin);
  const faceSum = getVoucherSelectionFaceSum(picked, kind, cfgOrAdmin);
  if (faceSum <= 0) return {};
  const safeCharged = Number.isFinite(charged)
    ? Math.max(0, Math.floor(charged))
    : 0;
  const waste = Math.max(0, faceSum - safeCharged);
  if (waste > faceSum * 0.5) return {};
  return picked;
}

/**
 * Applies a selected set of vouchers of `kind` against `charged`.
 * Refund is capped at `charged`; extra face value of any voucher is NOT refunded.
 */
export function applyVoucherRefund(
  selection: Record<string, number> | null | undefined,
  kind: VoucherKind,
  charged: number,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): VoucherRefundResult {
  const safeCharged = Number.isFinite(charged)
    ? Math.max(0, Math.floor(charged))
    : 0;
  if (safeCharged <= 0 || !selection) {
    return { used: {}, refund: 0 };
  }

  const used: Record<string, number> = {};
  let faceSum = 0;

  for (const [id, rawQty] of Object.entries(selection)) {
    const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
    if (qty <= 0) continue;
    const def = getVoucherById(id, cfgOrAdmin);
    if (!def || def.kind !== kind) continue;
    used[id] = qty;
    faceSum += def.value * qty;
  }

  return {
    used,
    refund: Math.min(faceSum, safeCharged),
  };
}
