import type { CombatUnit, ShieldRegenConfig, StatusEffectType } from '../types/game';

export const DEFAULT_SHIELD_REGEN_CONFIG: ShieldRegenConfig = {
  enabled: true,
  basePct: 3,
  perPointPct: 0.08,
  capPct: 12,
  notHitMult: 100,
  hitMult: 75,
  brokenMult: 30,
  brokenTurns: 3,
};

export type ShieldRegenReason =
  | 'not_hit'
  | 'hit'
  | 'cracked'
  | 'blocked'
  | 'none';

export interface ShieldRegenResult {
  amount: number;
  multPct: number;
  reason: ShieldRegenReason;
}

function clampFinite(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function sanitizeShieldRegenConfig(
  raw?: Partial<ShieldRegenConfig> | null
): ShieldRegenConfig {
  const def = DEFAULT_SHIELD_REGEN_CONFIG;
  if (!raw || typeof raw !== 'object') {
    return { ...def };
  }
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : def.enabled,
    basePct: clampFinite(raw.basePct, 0, 50, def.basePct),
    perPointPct: clampFinite(raw.perPointPct, 0, 50, def.perPointPct),
    capPct: clampFinite(raw.capPct, 0, 50, def.capPct),
    notHitMult: clampFinite(raw.notHitMult, 0, 200, def.notHitMult),
    hitMult: clampFinite(raw.hitMult, 0, 200, def.hitMult),
    brokenMult: clampFinite(raw.brokenMult, 0, 200, def.brokenMult),
    brokenTurns: Math.round(clampFinite(raw.brokenTurns, 1, 10, def.brokenTurns)),
  };
}

function unitHasActiveStatus(unit: CombatUnit, type: StatusEffectType): boolean {
  return unit.statuses.some((s) => s.type === type && s.turnsRemaining > 0);
}

export function computeShieldRegenPct(
  shieldStat: number,
  cfg: ShieldRegenConfig = DEFAULT_SHIELD_REGEN_CONFIG
): number {
  const safeStat = Number.isFinite(shieldStat) ? Math.max(0, shieldStat) : 0;
  const rawPct = cfg.basePct + safeStat * cfg.perPointPct;
  const clamped = Math.max(0, Math.min(cfg.capPct, rawPct));
  return Number(clamped.toFixed(6));
}

export function computeShieldRegen(
  unit: CombatUnit,
  cfg?: ShieldRegenConfig | null
): ShieldRegenResult {
  const resolved = cfg ?? DEFAULT_SHIELD_REGEN_CONFIG;
  const maxShield = unit.derived?.maxShield ?? 0;

  if (!resolved.enabled || !unit.alive || maxShield <= 0) {
    return { amount: 0, multPct: 0, reason: 'none' };
  }

  let multPct: number;
  let reason: ShieldRegenReason;

  if (unitHasActiveStatus(unit, 'shield_break')) {
    multPct = 0;
    reason = 'blocked';
  } else if (unitHasActiveStatus(unit, 'shield_cracked')) {
    multPct = resolved.brokenMult;
    reason = 'cracked';
  } else if (unit.hitSinceOwnTurn) {
    multPct = resolved.hitMult;
    reason = 'hit';
  } else {
    multPct = resolved.notHitMult;
    reason = 'not_hit';
  }

  const regenPct = computeShieldRegenPct(unit.stats?.shield ?? 0, resolved);
  const base = Math.round((maxShield * regenPct) / 100);
  const room = Math.max(0, maxShield - Math.max(0, unit.shield));
  const amount = Math.min(room, Math.max(0, Math.round((base * multPct) / 100)));

  return { amount, multPct, reason };
}
