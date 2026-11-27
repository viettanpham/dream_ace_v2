import { getMapNodeById, getMapNodes } from '../data/maps';
import type {
  BaseRuntimeState,
  BaseSiegeConfig,
  BaseSiegePoolMax,
  BaseSiegeRepairTierConfig,
  BaseType,
  PilotAccount,
} from '../types/game';

const BASE_TYPES: readonly BaseType[] = [
  'outpost',
  'colony',
  'relay',
  'fortress',
  'shipyard',
  'capital',
];

export const DEFAULT_BASE_SIEGE_CONFIG: BaseSiegeConfig = {
  byType: {
    outpost: { maxShield: 1000, maxHp: 600 },
    colony: { maxShield: 1000, maxHp: 600 },
    relay: { maxShield: 1000, maxHp: 600 },
    fortress: { maxShield: 1500, maxHp: 800 },
    shipyard: { maxShield: 1500, maxHp: 800 },
    capital: { maxShield: 5000, maxHp: 3000 },
  },
  shieldDamagePerWin: 500,
  hpDamagePerWin: 200,
  regen: {
    idleMonths: 3,
    shieldPct: 10,
    hpPct: 5,
  },
  repair: {
    hp: {
      amountPct: 25,
      costBase: 1000,
      costPerGearLevel: 100,
    },
    shield: {
      amountPct: 25,
      costBase: 1000,
      costPerGearLevel: 100,
    },
    cooldownMonths: 3,
  },
  raid: {
    shieldDamage: 500,
    hpDamage: 200,
  },
};

function clampInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function sanitizeRepairTier(
  raw: Partial<BaseSiegeRepairTierConfig> | undefined | null,
  def: BaseSiegeRepairTierConfig
): BaseSiegeRepairTierConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    amountPct: clampInt(src.amountPct, def.amountPct, 1, 100),
    costBase: clampInt(src.costBase, def.costBase, 0, 10_000_000),
    costPerGearLevel: clampInt(
      src.costPerGearLevel,
      def.costPerGearLevel,
      0,
      1_000_000
    ),
  };
}

export function cloneBaseSiegeConfig(cfg: BaseSiegeConfig): BaseSiegeConfig {
  return {
    byType: {
      outpost: { ...cfg.byType.outpost },
      colony: { ...cfg.byType.colony },
      relay: { ...cfg.byType.relay },
      fortress: { ...cfg.byType.fortress },
      shipyard: { ...cfg.byType.shipyard },
      capital: { ...cfg.byType.capital },
    },
    shieldDamagePerWin: cfg.shieldDamagePerWin,
    hpDamagePerWin: cfg.hpDamagePerWin,
    regen: { ...cfg.regen },
    repair: {
      hp: { ...cfg.repair.hp },
      shield: { ...cfg.repair.shield },
      cooldownMonths: cfg.repair.cooldownMonths,
    },
    raid: { ...cfg.raid },
  };
}

export function sanitizeBaseSiegeConfig(
  raw?: Partial<BaseSiegeConfig> | null
): BaseSiegeConfig {
  const def = DEFAULT_BASE_SIEGE_CONFIG;
  if (!raw || typeof raw !== 'object') {
    return cloneBaseSiegeConfig(def);
  }
  const byType = {} as Record<BaseType, BaseSiegePoolMax>;
  const rawByType =
    raw.byType && typeof raw.byType === 'object' ? raw.byType : undefined;
  for (const bt of BASE_TYPES) {
    const entry = rawByType?.[bt];
    const defEntry = def.byType[bt];
    byType[bt] = {
      maxShield: clampInt(entry?.maxShield, defEntry.maxShield, 1, 100_000),
      maxHp: clampInt(entry?.maxHp, defEntry.maxHp, 1, 100_000),
    };
  }
  const rawRegen =
    raw.regen && typeof raw.regen === 'object' ? raw.regen : undefined;
  const rawRepair =
    raw.repair && typeof raw.repair === 'object' ? raw.repair : undefined;
  const rawRaid =
    raw.raid && typeof raw.raid === 'object' ? raw.raid : undefined;

  return {
    byType,
    shieldDamagePerWin: clampInt(
      raw.shieldDamagePerWin,
      def.shieldDamagePerWin,
      1,
      100_000
    ),
    hpDamagePerWin: clampInt(raw.hpDamagePerWin, def.hpDamagePerWin, 1, 100_000),
    regen: {
      idleMonths: clampInt(rawRegen?.idleMonths, def.regen.idleMonths, 0, 12),
      shieldPct: clampInt(rawRegen?.shieldPct, def.regen.shieldPct, 0, 100),
      hpPct: clampInt(rawRegen?.hpPct, def.regen.hpPct, 0, 100),
    },
    repair: {
      hp: sanitizeRepairTier(rawRepair?.hp, def.repair.hp),
      shield: sanitizeRepairTier(rawRepair?.shield, def.repair.shield),
      cooldownMonths: clampInt(
        rawRepair?.cooldownMonths,
        def.repair.cooldownMonths,
        0,
        12
      ),
    },
    raid: {
      shieldDamage: clampInt(
        rawRaid?.shieldDamage,
        def.raid.shieldDamage,
        0,
        100_000
      ),
      hpDamage: clampInt(rawRaid?.hpDamage, def.raid.hpDamage, 0, 100_000),
    },
  };
}

export function getBaseSiegeMax(
  baseType: BaseType,
  cfg?: Partial<BaseSiegeConfig> | null
): BaseSiegePoolMax {
  const safe = sanitizeBaseSiegeConfig(cfg);
  return { ...safe.byType[baseType] };
}

export function getBaseSiege(
  baseState: BaseRuntimeState | undefined | null,
  baseType: BaseType,
  cfg?: Partial<BaseSiegeConfig> | null
): { shield: number; hp: number; maxShield: number; maxHp: number } {
  const { maxShield, maxHp } = getBaseSiegeMax(baseType, cfg);
  const rawShield = baseState?.siegeShield;
  const rawHp = baseState?.siegeHp;
  const shield =
    typeof rawShield === 'number' && Number.isFinite(rawShield)
      ? Math.max(0, Math.min(maxShield, Math.round(rawShield)))
      : maxShield;
  const hp =
    typeof rawHp === 'number' && Number.isFinite(rawHp)
      ? Math.max(0, Math.min(maxHp, Math.round(rawHp)))
      : maxHp;
  return { shield, hp, maxShield, maxHp };
}

export function applySiegeDamage(
  siege: { shield: number; hp: number },
  shieldDmg: number,
  hpDmg: number
): { shield: number; hp: number; broken: boolean } {
  const curShield = Math.max(0, Math.round(siege.shield));
  const curHp = Math.max(0, Math.round(siege.hp));
  const sDmg = Math.max(0, Math.round(shieldDmg));
  const hDmg = Math.max(0, Math.round(hpDmg));

  if (curShield > 0) {
    const nextShield = Math.max(0, curShield - sDmg);
    return {
      shield: nextShield,
      hp: curHp,
      broken: curHp <= 0,
    };
  }

  const nextHp = Math.max(0, curHp - hDmg);
  return {
    shield: 0,
    hp: nextHp,
    broken: nextHp <= 0,
  };
}

export function computeWinsToCapture(
  baseType: BaseType,
  cfg?: Partial<BaseSiegeConfig> | null
): number {
  const safe = sanitizeBaseSiegeConfig(cfg);
  const { maxShield, maxHp } = safe.byType[baseType];
  return (
    Math.ceil(maxShield / safe.shieldDamagePerWin) +
    Math.ceil(maxHp / safe.hpDamagePerWin)
  );
}

export function getPilotHighestGearLevel(pilot: PilotAccount): number {
  const levels = Object.values(pilot.gears ?? {}).map((g) => g?.level ?? 1);
  return levels.length > 0 ? Math.max(1, ...levels) : 1;
}

export function computeBaseRepairCost(
  kind: 'hp' | 'shield',
  highestGearLevel: number,
  cfg?: Partial<BaseSiegeConfig> | null
): number {
  const safe = sanitizeBaseSiegeConfig(cfg);
  const tier = safe.repair[kind];
  const lv = Math.max(1, Math.floor(highestGearLevel || 1));
  return Math.max(0, Math.round(tier.costBase + tier.costPerGearLevel * lv));
}

export function computeBaseRepairAmount(
  kind: 'hp' | 'shield',
  baseType: BaseType,
  cfg?: Partial<BaseSiegeConfig> | null
): number {
  const safe = sanitizeBaseSiegeConfig(cfg);
  const { maxShield, maxHp } = safe.byType[baseType];
  const maxVal = kind === 'hp' ? maxHp : maxShield;
  const pct = safe.repair[kind].amountPct;
  return Math.max(1, Math.round((maxVal * pct) / 100));
}

export type BaseRepairFailureReason =
  | 'not_allied'
  | 'full'
  | 'no_credits'
  | 'cooldown'
  | 'busy';

export interface BaseRepairResult {
  ok: boolean;
  reason?: BaseRepairFailureReason;
  pilot: PilotAccount;
  cost?: number;
  healed?: { hp: number; shield: number };
}

export function applyBaseRepair(
  pilot: PilotAccount,
  sectorId: string,
  opts: {
    hp?: boolean;
    shield?: boolean;
    hpAmount?: number;
    shieldAmount?: number;
    free?: boolean;
    ignoreCooldown?: boolean;
  },
  cfg?: Partial<BaseSiegeConfig> | null
): BaseRepairResult {
  const sector = getMapNodeById(sectorId);
  if (!sector) {
    return { ok: false, reason: 'not_allied', pilot };
  }
  const curBase: BaseRuntimeState = pilot.baseStates?.[sectorId] ?? {
    faction: sector.initialFaction,
    status: 'operational',
    repairMonthsRemaining: 0,
    underAttack: false,
    attackCountdownMonths: 0,
    attackFromSectorId: null,
  };
  if (curBase.faction !== 'allied') {
    return { ok: false, reason: 'not_allied', pilot };
  }

  const safeCfg = sanitizeBaseSiegeConfig(cfg);
  const siege = getBaseSiege(curBase, sector.baseType, safeCfg);
  const wantHp = Boolean(opts.hp);
  const wantShield = Boolean(opts.shield);

  const hpMissing = wantHp ? Math.max(0, siege.maxHp - siege.hp) : 0;
  const shieldMissing = wantShield
    ? Math.max(0, siege.maxShield - siege.shield)
    : 0;

  if (hpMissing === 0 && shieldMissing === 0) {
    return { ok: false, reason: 'full', pilot };
  }

  const curMonth = Math.max(1, Math.floor(pilot.campaignMonth || 1));
  const cooldown = safeCfg.repair.cooldownMonths;
  if (!opts.ignoreCooldown) {
    if (
      hpMissing > 0 &&
      typeof curBase.lastRepairHpMonth === 'number' &&
      curMonth < curBase.lastRepairHpMonth + cooldown
    ) {
      return { ok: false, reason: 'cooldown', pilot };
    }
    if (
      shieldMissing > 0 &&
      typeof curBase.lastRepairShieldMonth === 'number' &&
      curMonth < curBase.lastRepairShieldMonth + cooldown
    ) {
      return { ok: false, reason: 'cooldown', pilot };
    }
  }

  const highestLv = getPilotHighestGearLevel(pilot);
  const hpCost =
    hpMissing > 0 ? computeBaseRepairCost('hp', highestLv, safeCfg) : 0;
  const shieldCost =
    shieldMissing > 0 ? computeBaseRepairCost('shield', highestLv, safeCfg) : 0;
  const cost = opts.free ? 0 : hpCost + shieldCost;

  if (pilot.credits < cost) {
    return { ok: false, reason: 'no_credits', pilot, cost };
  }

  const rawHpGain =
    hpMissing > 0
      ? opts.hpAmount !== undefined
        ? Math.max(0, Math.round(opts.hpAmount))
        : computeBaseRepairAmount('hp', sector.baseType, safeCfg)
      : 0;
  const rawShieldGain =
    shieldMissing > 0
      ? opts.shieldAmount !== undefined
        ? Math.max(0, Math.round(opts.shieldAmount))
        : computeBaseRepairAmount('shield', sector.baseType, safeCfg)
      : 0;

  const hpGain = Math.min(hpMissing, rawHpGain);
  const shieldGain = Math.min(shieldMissing, rawShieldGain);

  const nextBase: BaseRuntimeState = {
    ...curBase,
    siegeHp: Math.min(siege.maxHp, siege.hp + hpGain),
    siegeShield: Math.min(siege.maxShield, siege.shield + shieldGain),
    ...(hpGain > 0 && !opts.ignoreCooldown
      ? { lastRepairHpMonth: curMonth }
      : {}),
    ...(shieldGain > 0 && !opts.ignoreCooldown
      ? { lastRepairShieldMonth: curMonth }
      : {}),
  };

  return {
    ok: true,
    cost,
    healed: { hp: hpGain, shield: shieldGain },
    pilot: {
      ...pilot,
      credits: pilot.credits - cost,
      baseStates: {
        ...pilot.baseStates,
        [sectorId]: nextBase,
      },
    },
  };
}

export function resetAllBaseSiegePools(
  pilot: PilotAccount,
  cfg?: Partial<BaseSiegeConfig> | null
): PilotAccount {
  const safeCfg = sanitizeBaseSiegeConfig(cfg);
  const nextBaseStates: Record<string, BaseRuntimeState> = {
    ...(pilot.baseStates ?? {}),
  };
  for (const sector of getMapNodes()) {
    const existing = nextBaseStates[sector.id];
    const { maxShield, maxHp } = getBaseSiegeMax(sector.baseType, safeCfg);
    if (existing) {
      nextBaseStates[sector.id] = {
        ...existing,
        siegeShield: maxShield,
        siegeHp: maxHp,
      };
    } else {
      nextBaseStates[sector.id] = {
        faction: sector.initialFaction,
        status: 'operational',
        repairMonthsRemaining: 0,
        underAttack: false,
        attackCountdownMonths: 0,
        attackFromSectorId: null,
        siegeShield: maxShield,
        siegeHp: maxHp,
      };
    }
  }
  return {
    ...pilot,
    baseStates: nextBaseStates,
  };
}
