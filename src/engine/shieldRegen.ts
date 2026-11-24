import { SKILLS_LIST } from '../data/skills';
import type { CombatUnit, ShieldRegenConfig, StatusEffectType } from '../types/game';

export const DEFAULT_SHIELD_REGEN_CONFIG: ShieldRegenConfig = {
  enabled: true,
  basePct: 3,
  perPointPct: 0.08,
  capPct: 12,
  notHitMult: 100,
  hitPenaltyPct: 20,
  minHitMultPct: 0,
  restartTurns: 1,
};

export const DEFAULT_SHIELD_CRACKED_MULT = 1.3;
export const DEFAULT_SHIELD_CRACKED_TURNS = 2;

const KNOWN_SKILL_ID_SET = new Set<string>(SKILLS_LIST.map((s) => s.id));

export type ShieldRegenReason =
  | 'not_hit'
  | 'hit'
  | 'restarting'
  | 'none';

export interface ShieldRegenResult {
  amount: number;
  multPct: number;
  hits: number;
  reason: ShieldRegenReason;
}

function clampFinite(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function clampShieldDamageMult(value: unknown, fallback = 1): number {
  return clampFinite(value, 1, 4, fallback);
}

export function sanitizeShieldCrackedMult(raw: unknown): number {
  return Number(clampFinite(raw, 1, 2, DEFAULT_SHIELD_CRACKED_MULT).toFixed(4));
}

export function sanitizeShieldCrackedTurns(raw: unknown): number {
  return Math.round(clampFinite(raw, 1, 5, DEFAULT_SHIELD_CRACKED_TURNS));
}

export function sanitizeShieldDamageOverrides(
  raw: unknown
): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [skillId, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN_SKILL_ID_SET.has(skillId)) continue;
    if (typeof val !== 'number' || !Number.isFinite(val)) continue;
    out[skillId] = Number(clampShieldDamageMult(val, 1).toFixed(4));
  }
  return out;
}

export function sanitizeShieldRegenConfig(
  raw?: Partial<ShieldRegenConfig> | Record<string, unknown> | null
): ShieldRegenConfig {
  const def = DEFAULT_SHIELD_REGEN_CONFIG;
  if (!raw || typeof raw !== 'object') {
    return { ...def };
  }
  const src = raw as Record<string, unknown>;
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : def.enabled,
    basePct: clampFinite(src.basePct, 0, 50, def.basePct),
    perPointPct: clampFinite(src.perPointPct, 0, 50, def.perPointPct),
    capPct: clampFinite(src.capPct, 0, 50, def.capPct),
    notHitMult: clampFinite(src.notHitMult, 0, 200, def.notHitMult),
    hitPenaltyPct: clampFinite(src.hitPenaltyPct, 0, 100, def.hitPenaltyPct),
    minHitMultPct: clampFinite(src.minHitMultPct, 0, 100, def.minHitMultPct),
    restartTurns: Math.round(clampFinite(src.restartTurns, 1, 3, def.restartTurns)),
  };
}

export function getUnitHitsSinceOwnTurn(unit: CombatUnit): number {
  if (typeof unit.hitsSinceOwnTurn === 'number' && Number.isFinite(unit.hitsSinceOwnTurn)) {
    return Math.max(0, Math.floor(unit.hitsSinceOwnTurn));
  }
  const legacyHit = (unit as CombatUnit & { hitSinceOwnTurn?: unknown }).hitSinceOwnTurn;
  if (legacyHit === true) return 1;
  if (typeof legacyHit === 'number' && Number.isFinite(legacyHit)) {
    return Math.max(0, Math.floor(legacyHit));
  }
  return 0;
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
    return { amount: 0, multPct: 0, hits: 0, reason: 'none' };
  }

  const hits = getUnitHitsSinceOwnTurn(unit);
  let multPct: number;
  let reason: ShieldRegenReason;

  if (unitHasActiveStatus(unit, 'shield_break')) {
    multPct = 0;
    reason = 'restarting';
  } else if (hits > 0) {
    multPct = Math.max(
      resolved.minHitMultPct,
      resolved.notHitMult - resolved.hitPenaltyPct * hits
    );
    reason = 'hit';
  } else {
    multPct = resolved.notHitMult;
    reason = 'not_hit';
  }

  const regenPct = computeShieldRegenPct(unit.stats?.shield ?? 0, resolved);
  const base = Math.round((maxShield * regenPct) / 100);
  const room = Math.max(0, maxShield - Math.max(0, unit.shield));
  const amount = Math.min(room, Math.max(0, Math.round((base * multPct) / 100)));

  return { amount, multPct, hits, reason };
}
