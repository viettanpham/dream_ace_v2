import {
  getEffectiveSkillMaxLevel,
  sanitizeFluxTransferConfig,
} from '../data/balance';
import { getSkillById } from '../data/skills';
import type { AdminConfig, CombatUnit, FluxAutoConfig } from '../types/game';
import { computeFluxBattlePressure, pickFluxCount } from './combat';
import { canUnitUseSkill } from './skills';
import { canCastAsStep2, getSkillStep } from './turnPhase';

export const FLUX_SKILL_ID = 'sup_flux_transfer';

export const DEFAULT_FLUX_AUTO_CONFIG: FluxAutoConfig = {
  enabled: true,
  mode: 'smart',
  allySpBelowPct: 25,
  keepSelfPct: 50,
};

function sanitizePct(raw: unknown, fallback: number): number {
  if (typeof raw === 'boolean' || raw === null || raw === undefined) {
    return fallback;
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    return fallback;
  }
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
      ? Number(raw)
      : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function sanitizeFluxAutoConfig(raw: unknown): FluxAutoConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const enabled =
    typeof obj.enabled === 'boolean'
      ? obj.enabled
      : DEFAULT_FLUX_AUTO_CONFIG.enabled;
  const mode =
    obj.mode === 'fixed' || obj.mode === 'smart'
      ? obj.mode
      : DEFAULT_FLUX_AUTO_CONFIG.mode;
  const allySpBelowPct = sanitizePct(
    obj.allySpBelowPct,
    DEFAULT_FLUX_AUTO_CONFIG.allySpBelowPct
  );
  const keepSelfPct = sanitizePct(
    obj.keepSelfPct,
    DEFAULT_FLUX_AUTO_CONFIG.keepSelfPct
  );
  return { enabled, mode, allySpBelowPct, keepSelfPct };
}

export interface PickFluxAutoParams {
  fluxAuto?: Partial<FluxAutoConfig> | null;
  adminConfig?: Partial<AdminConfig> | null;
  step2UsedSoFar?: number;
  turnLockedSkillIds?: readonly string[];
}

export function pickFluxAutoCount(
  units: CombatUnit[],
  actor: CombatUnit,
  params: PickFluxAutoParams = {},
  rng: () => number = Math.random
): number {
  if (!actor.alive) return 0;

  const cfg = sanitizeFluxAutoConfig(params.fluxAuto);
  if (!cfg.enabled) return 0;

  if (!actor.equippedSkillIds.includes(FLUX_SKILL_ID)) return 0;

  const skill = getSkillById(FLUX_SKILL_ID);
  if (!skill) return 0;

  const usability = canUnitUseSkill(
    actor,
    FLUX_SKILL_ID,
    params.adminConfig,
    params.turnLockedSkillIds
  );
  if (!usability.canUse) return 0;

  if (
    getSkillStep(skill) === 2 &&
    !canCastAsStep2(
      skill,
      params.step2UsedSoFar ?? 0,
      params.adminConfig?.turnPhase
    )
  ) {
    return 0;
  }

  const baseFluxCfg = sanitizeFluxTransferConfig(params.adminConfig?.fluxTransfer);
  const skillMaxLevel = getEffectiveSkillMaxLevel(params.adminConfig);

  if (cfg.mode === 'smart') {
    const pressure = computeFluxBattlePressure(units, actor.side);
    return pickFluxCount(
      units,
      actor.id,
      {
        ...baseFluxCfg,
        spEconomy: params.adminConfig?.spEconomy,
        skillMaxLevel,
      },
      pressure,
      rng
    );
  }

  const overriddenCfg = sanitizeFluxTransferConfig({
    ...baseFluxCfg,
    allySpBelowPct: cfg.allySpBelowPct,
    keepSelfPct: cfg.keepSelfPct,
  });
  // Fixed mode ignores losing-pressure 15% keepSelf reduction & winning random skip.
  return pickFluxCount(
    units,
    actor.id,
    {
      ...overriddenCfg,
      spEconomy: params.adminConfig?.spEconomy,
      skillMaxLevel,
    },
    0,
    rng
  );
}
