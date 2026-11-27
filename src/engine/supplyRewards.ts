import { SUPPLY_TEMPLATES } from '../data/consumables';
import type {
  AdminConfig,
  ConsumableItem,
  PilotAccount,
  SupplyCrateRewardsConfig,
  SupplyRewardSourceConfig,
  SupplyRewardsConfig,
  SupplyTemplate,
} from '../types/game';
import {
  addSupplyToConsumables,
  getSupplyStockCount,
  SUPPLY_STACK_CAP,
} from './supplies';

export const SUPPLY_REWARDS_MIN_TIER = 1;
export const SUPPLY_REWARDS_MAX_TIER = 5;
export const SUPPLY_REWARDS_MIN_CHANCE = 0;
export const SUPPLY_REWARDS_MAX_CHANCE = 100;
export const SUPPLY_REWARDS_MIN_QTY = 1;
export const SUPPLY_REWARDS_MAX_QTY = SUPPLY_STACK_CAP;
export const SUPPLY_REWARDS_MIN_TYPES = 1;
export const SUPPLY_REWARDS_MAX_TYPES = 4;

export const SUPPLY_CRATE_CONSUMABLE_ID = 'supply_crate_stack';

export const DEFAULT_SUPPLY_REWARDS_CONFIG: SupplyRewardsConfig = {
  minTier: 1,
  maxTier: 5,
  victory: { chancePct: 25, qtyMin: 1, qtyMax: 3 },
  mission: { chancePct: 50, qtyMin: 2, qtyMax: 5 },
  event: { chancePct: 50, qtyMin: 2, qtyMax: 6 },
  crate: { typesMin: 1, typesMax: 2, qtyMin: 2, qtyMax: 6 },
};

export type SupplyRewardSource = 'victory' | 'mission' | 'event';

export type GrantSupplyRewardResult =
  | { templateId: string; qty: number }
  | { lost: true }
  | null;

export interface RolledSupplyReward {
  templateId: string;
  qty: number;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function rollIntInclusive(min: number, max: number, rng: () => number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo >= hi) return lo;
  const r = Math.max(0, Math.min(0.999999999, rng()));
  return lo + Math.floor(r * (hi - lo + 1));
}

export function cloneSupplyRewardsConfig(
  cfg: SupplyRewardsConfig = DEFAULT_SUPPLY_REWARDS_CONFIG
): SupplyRewardsConfig {
  return {
    minTier: cfg.minTier,
    maxTier: cfg.maxTier,
    victory: { ...cfg.victory },
    mission: { ...cfg.mission },
    event: { ...cfg.event },
    crate: { ...cfg.crate },
  };
}

function sanitizeSourceConfig(
  raw: unknown,
  def: SupplyRewardSourceConfig
): SupplyRewardSourceConfig {
  const r =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const chancePct = clampInt(
    r.chancePct,
    SUPPLY_REWARDS_MIN_CHANCE,
    SUPPLY_REWARDS_MAX_CHANCE,
    def.chancePct
  );
  const qtyMin = clampInt(
    r.qtyMin,
    SUPPLY_REWARDS_MIN_QTY,
    SUPPLY_REWARDS_MAX_QTY,
    def.qtyMin
  );
  const qtyMax = Math.max(
    qtyMin,
    clampInt(r.qtyMax, SUPPLY_REWARDS_MIN_QTY, SUPPLY_REWARDS_MAX_QTY, def.qtyMax)
  );
  return { chancePct, qtyMin, qtyMax };
}

function sanitizeCrateConfig(
  raw: unknown,
  def: SupplyCrateRewardsConfig
): SupplyCrateRewardsConfig {
  const r =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const typesMin = clampInt(
    r.typesMin,
    SUPPLY_REWARDS_MIN_TYPES,
    SUPPLY_REWARDS_MAX_TYPES,
    def.typesMin
  );
  const typesMax = Math.max(
    typesMin,
    clampInt(
      r.typesMax,
      SUPPLY_REWARDS_MIN_TYPES,
      SUPPLY_REWARDS_MAX_TYPES,
      def.typesMax
    )
  );
  const qtyMin = clampInt(
    r.qtyMin,
    SUPPLY_REWARDS_MIN_QTY,
    SUPPLY_REWARDS_MAX_QTY,
    def.qtyMin
  );
  const qtyMax = Math.max(
    qtyMin,
    clampInt(r.qtyMax, SUPPLY_REWARDS_MIN_QTY, SUPPLY_REWARDS_MAX_QTY, def.qtyMax)
  );
  return { typesMin, typesMax, qtyMin, qtyMax };
}

export function sanitizeSupplyRewardsConfig(raw: unknown): SupplyRewardsConfig {
  const r =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const minTier = clampInt(
    r.minTier,
    SUPPLY_REWARDS_MIN_TIER,
    SUPPLY_REWARDS_MAX_TIER,
    DEFAULT_SUPPLY_REWARDS_CONFIG.minTier
  );
  const maxTier = Math.max(
    minTier,
    clampInt(
      r.maxTier,
      SUPPLY_REWARDS_MIN_TIER,
      SUPPLY_REWARDS_MAX_TIER,
      DEFAULT_SUPPLY_REWARDS_CONFIG.maxTier
    )
  );
  return {
    minTier,
    maxTier,
    victory: sanitizeSourceConfig(r.victory, DEFAULT_SUPPLY_REWARDS_CONFIG.victory),
    mission: sanitizeSourceConfig(r.mission, DEFAULT_SUPPLY_REWARDS_CONFIG.mission),
    event: sanitizeSourceConfig(r.event, DEFAULT_SUPPLY_REWARDS_CONFIG.event),
    crate: sanitizeCrateConfig(r.crate, DEFAULT_SUPPLY_REWARDS_CONFIG.crate),
  };
}

export function getPilotMaxGearLevel(
  pilot: Pick<PilotAccount, 'gears'> | null | undefined
): number {
  const gears = pilot?.gears;
  if (!gears || typeof gears !== 'object') return 1;
  let maxLv = 1;
  for (const gear of Object.values(gears)) {
    if (gear && typeof gear.level === 'number' && Number.isFinite(gear.level)) {
      maxLv = Math.max(maxLv, Math.floor(gear.level));
    }
  }
  return maxLv;
}

export function getEligibleSupplyTemplates(
  maxGearLevel: number,
  minTier: number,
  maxTier: number,
  templates: readonly SupplyTemplate[] = SUPPLY_TEMPLATES
): SupplyTemplate[] {
  const safeLv = Math.max(1, Math.floor(Number.isFinite(maxGearLevel) ? maxGearLevel : 1));
  const loTier = clampInt(minTier, SUPPLY_REWARDS_MIN_TIER, SUPPLY_REWARDS_MAX_TIER, 1);
  const hiTier = Math.max(
    loTier,
    clampInt(maxTier, SUPPLY_REWARDS_MIN_TIER, SUPPLY_REWARDS_MAX_TIER, 5)
  );
  return templates.filter(
    (tpl) =>
      tpl.unlockLevel <= safeLv && tpl.tier >= loTier && tpl.tier <= hiTier
  );
}

export interface RollSupplyRewardConfig {
  minTier?: number;
  maxTier?: number;
  qtyMin: number;
  qtyMax: number;
}

export function rollSupplyReward(
  maxGearLevel: number,
  cfg: RollSupplyRewardConfig,
  rng: () => number = Math.random,
  templates: readonly SupplyTemplate[] = SUPPLY_TEMPLATES
): RolledSupplyReward | null {
  const eligible = getEligibleSupplyTemplates(
    maxGearLevel,
    cfg.minTier ?? SUPPLY_REWARDS_MIN_TIER,
    cfg.maxTier ?? SUPPLY_REWARDS_MAX_TIER,
    templates
  );
  if (eligible.length === 0) return null;

  const qtyMin = clampInt(cfg.qtyMin, SUPPLY_REWARDS_MIN_QTY, SUPPLY_REWARDS_MAX_QTY, 1);
  const qtyMax = Math.max(
    qtyMin,
    clampInt(cfg.qtyMax, SUPPLY_REWARDS_MIN_QTY, SUPPLY_REWARDS_MAX_QTY, qtyMin)
  );
  const r = Math.max(0, Math.min(0.999999999, rng()));
  const picked = eligible[Math.floor(r * eligible.length)];
  const qty = rollIntInclusive(qtyMin, qtyMax, rng);
  return { templateId: picked.id, qty };
}

export interface RollSupplyCrateConfig extends SupplyCrateRewardsConfig {
  minTier?: number;
  maxTier?: number;
}

export function rollSupplyCrateContents(
  maxGearLevel: number,
  crateCfg: RollSupplyCrateConfig,
  rng: () => number = Math.random,
  templates: readonly SupplyTemplate[] = SUPPLY_TEMPLATES
): RolledSupplyReward[] {
  const eligible = getEligibleSupplyTemplates(
    maxGearLevel,
    crateCfg.minTier ?? SUPPLY_REWARDS_MIN_TIER,
    crateCfg.maxTier ?? SUPPLY_REWARDS_MAX_TIER,
    templates
  );
  if (eligible.length === 0) return [];

  const sanitizedCrate = sanitizeCrateConfig(
    crateCfg,
    DEFAULT_SUPPLY_REWARDS_CONFIG.crate
  );
  const wantTypes = Math.min(
    eligible.length,
    rollIntInclusive(sanitizedCrate.typesMin, sanitizedCrate.typesMax, rng)
  );

  const pool = [...eligible];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const r = Math.max(0, Math.min(0.999999999, rng()));
    const j = Math.floor(r * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, wantTypes).map((tpl) => ({
    templateId: tpl.id,
    qty: rollIntInclusive(sanitizedCrate.qtyMin, sanitizedCrate.qtyMax, rng),
  }));
}

export function addSupplyWithOverflow(
  consumables: readonly ConsumableItem[],
  templateId: string,
  addQty: number
): { consumables: ConsumableItem[]; added: number; lost: number } {
  const safeAdd = Number.isFinite(addQty) ? Math.max(0, Math.floor(addQty)) : 0;
  if (safeAdd <= 0) {
    return { consumables: [...consumables], added: 0, lost: 0 };
  }
  const prevOwned = getSupplyStockCount(consumables, templateId);
  const nextConsumables = addSupplyToConsumables(consumables, templateId, safeAdd);
  const nextOwned = getSupplyStockCount(nextConsumables, templateId);
  const added = Math.max(0, nextOwned - prevOwned);
  const lost = Math.max(0, safeAdd - added);
  return { consumables: nextConsumables, added, lost };
}

export function addSupplyCrateToConsumables(
  consumables: readonly ConsumableItem[],
  addQty: number
): { consumables: ConsumableItem[]; added: number; lost: number } {
  const safeAdd = Number.isFinite(addQty) ? Math.max(0, Math.floor(addQty)) : 0;
  if (safeAdd <= 0) {
    return { consumables: [...consumables], added: 0, lost: 0 };
  }
  const existingIdx = consumables.findIndex((c) => c.kind === 'supply_crate');
  const prevOwned = existingIdx >= 0 ? Math.max(0, consumables[existingIdx].quantity) : 0;
  const nextQty = Math.min(SUPPLY_STACK_CAP, prevOwned + safeAdd);
  const added = Math.max(0, nextQty - prevOwned);
  const lost = Math.max(0, safeAdd - added);
  if (existingIdx >= 0) {
    return {
      consumables: consumables.map((c, idx) =>
        idx === existingIdx ? { ...c, quantity: nextQty } : c
      ),
      added,
      lost,
    };
  }
  return {
    consumables: [
      ...consumables,
      {
        id: SUPPLY_CRATE_CONSUMABLE_ID,
        kind: 'supply_crate',
        quantity: nextQty,
      },
    ],
    added,
    lost,
  };
}

export interface AppliedSupplyRewardOutcome {
  pilot: PilotAccount;
  result: GrantSupplyRewardResult;
  templateId: string | null;
  rolledQty: number;
  added: number;
  lost: number;
}

export function applySupplyRewardGrant(
  pilot: PilotAccount,
  adminConfig: Pick<AdminConfig, 'supplyRewards'> | null | undefined,
  source: SupplyRewardSource,
  rng: () => number = Math.random
): AppliedSupplyRewardOutcome {
  const cfg = sanitizeSupplyRewardsConfig(adminConfig?.supplyRewards);
  const srcCfg = cfg[source];
  if (srcCfg.chancePct <= 0) {
    return { pilot, result: null, templateId: null, rolledQty: 0, added: 0, lost: 0 };
  }
  if (srcCfg.chancePct < 100 && rng() * 100 >= srcCfg.chancePct) {
    return { pilot, result: null, templateId: null, rolledQty: 0, added: 0, lost: 0 };
  }

  const maxGearLevel = getPilotMaxGearLevel(pilot);
  const rolled = rollSupplyReward(
    maxGearLevel,
    {
      minTier: cfg.minTier,
      maxTier: cfg.maxTier,
      qtyMin: srcCfg.qtyMin,
      qtyMax: srcCfg.qtyMax,
    },
    rng
  );
  if (!rolled) {
    return { pilot, result: null, templateId: null, rolledQty: 0, added: 0, lost: 0 };
  }

  const addRes = addSupplyWithOverflow(
    pilot.consumables ?? [],
    rolled.templateId,
    rolled.qty
  );
  const nextPilot: PilotAccount = {
    ...pilot,
    consumables: addRes.consumables,
  };

  if (addRes.added <= 0) {
    return {
      pilot: nextPilot,
      result: { lost: true },
      templateId: rolled.templateId,
      rolledQty: rolled.qty,
      added: 0,
      lost: addRes.lost,
    };
  }

  return {
    pilot: nextPilot,
    result: { templateId: rolled.templateId, qty: addRes.added },
    templateId: rolled.templateId,
    rolledQty: rolled.qty,
    added: addRes.added,
    lost: addRes.lost,
  };
}

export function grantSupplyReward(
  state: {
    pilot: PilotAccount;
    adminConfig?: Pick<AdminConfig, 'supplyRewards'> | null;
  },
  source: SupplyRewardSource,
  rng: () => number = Math.random
): GrantSupplyRewardResult {
  const applied = applySupplyRewardGrant(state.pilot, state.adminConfig, source, rng);
  if (applied.result !== null) {
    state.pilot = applied.pilot;
  }
  return applied.result;
}
