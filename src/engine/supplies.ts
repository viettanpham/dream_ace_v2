import { FORMATION_ROWS } from '../data/formationConfig';
import { getSupplyTemplateById } from '../data/consumables';
import type {
  AdminConfig,
  BattleKind,
  BattleState,
  BattleSupplyUnitState,
  CombatUnit,
  ConsumableItem,
  GearUnit,
  PilotAccount,
  SupplyEconomyConfig,
  SupplyEffect,
  SupplyLimitMultConfig,
  SupplyTemplate,
} from '../types/game';
import {
  applySupplyEffects,
  type SupplyEffectGains,
} from './supplyEffects';

export const SUPPLY_STACK_CAP = 99;

export const DEFAULT_SUPPLY_LOADOUT_SLOTS = 4;
export const MIN_SUPPLY_LOADOUT_SLOTS = 2;
export const MAX_SUPPLY_LOADOUT_SLOTS = 8;

export const DEFAULT_SUPPLY_USES_PER_TURN = 1;
export const MIN_SUPPLY_USES_PER_TURN = 1;
export const MAX_SUPPLY_USES_PER_TURN = 3;

export const DEFAULT_SUPPLY_MAX_USES_PER_BATTLE = 5;
export const MIN_SUPPLY_MAX_USES_PER_BATTLE = 1;
export const MAX_SUPPLY_MAX_USES_PER_BATTLE = 20;

export const DEFAULT_SUPPLY_SP_PRICE_MULT = 2;
export const MIN_SUPPLY_SP_PRICE_MULT = 1;
export const MAX_SUPPLY_SP_PRICE_MULT = 5;

export const MIN_SUPPLY_LIMIT_MULT = 1;
export const MAX_SUPPLY_LIMIT_MULT = 10;

export const DEFAULT_SUPPLY_SCAN_COUNT = 1;
export const MIN_SUPPLY_SCAN_COUNT = 1;
export const MAX_SUPPLY_SCAN_COUNT = 5;

export const DEFAULT_SUPPLY_LIMIT_MULT: SupplyLimitMultConfig = {
  assaultAttacker: 2,
  assaultDefender: 3,
  defendDefender: 2,
  defendAttacker: 1,
  bossEscort: 2,
  bossPlayers: 3,
};

export const DEFAULT_SUPPLY_ECONOMY_CONFIG: SupplyEconomyConfig = {
  maxUsesPerBattle: DEFAULT_SUPPLY_MAX_USES_PER_BATTLE,
  spPriceMult: DEFAULT_SUPPLY_SP_PRICE_MULT,
  limitMult: { ...DEFAULT_SUPPLY_LIMIT_MULT },
};

export type SupplyRejectReason =
  | 'unknown'
  | 'duplicate'
  | 'family_duplicate'
  | 'over_slots';

export interface SupplyLoadoutReject {
  id: string;
  reason: SupplyRejectReason;
}

export type SupplyUseFailureReason =
  | 'no_stock'
  | 'cooldown'
  | 'battle_limit'
  | 'turn_limit'
  | 'hp_full'
  | 'shield_full'
  | 'sp_full'
  | 'shield_broken'
  | 'not_your_turn';

export interface CanUseSupplyInput {
  template: SupplyTemplate;
  stock: number;
  unit: CombatUnit;
  supplyState?: Partial<BattleSupplyUnitState> | null;
  isOwnTurn: boolean;
  cfg?: Pick<AdminConfig, 'supplyUsesPerTurn' | 'supplyEconomy'> | null;
  kind?: BattleKind | null;
  units?: readonly CombatUnit[] | null;
}

export interface CanUseSupplyResult {
  ok: boolean;
  reason: SupplyUseFailureReason | null;
  reasonKey: string | null;
  params?: Record<string, number>;
}

function clampFiniteInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

export function sanitizeSupplyLoadoutSlots(raw: unknown): number {
  return clampFiniteInt(
    raw,
    MIN_SUPPLY_LOADOUT_SLOTS,
    MAX_SUPPLY_LOADOUT_SLOTS,
    DEFAULT_SUPPLY_LOADOUT_SLOTS
  );
}

export function sanitizeSupplyUsesPerTurn(raw: unknown): number {
  return clampFiniteInt(
    raw,
    MIN_SUPPLY_USES_PER_TURN,
    MAX_SUPPLY_USES_PER_TURN,
    DEFAULT_SUPPLY_USES_PER_TURN
  );
}

export function sanitizeSupplyScanCount(raw: unknown): number {
  return clampFiniteInt(
    raw,
    MIN_SUPPLY_SCAN_COUNT,
    MAX_SUPPLY_SCAN_COUNT,
    DEFAULT_SUPPLY_SCAN_COUNT
  );
}

export function isAutoSupplyAllowed(
  template: Pick<SupplyTemplate, 'family'> | null | undefined
): boolean {
  return Boolean(template && template.family !== 'utility');
}

export function filterAutoOrNpcSupplies(
  templates: readonly SupplyTemplate[]
): SupplyTemplate[] {
  return templates.filter((tpl) => isAutoSupplyAllowed(tpl));
}

export function sanitizeSupplyLimitMult(raw?: unknown): SupplyLimitMultConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Partial<SupplyLimitMultConfig>)
      : null;
  return {
    assaultAttacker: clampFiniteInt(
      obj?.assaultAttacker,
      MIN_SUPPLY_LIMIT_MULT,
      MAX_SUPPLY_LIMIT_MULT,
      DEFAULT_SUPPLY_LIMIT_MULT.assaultAttacker
    ),
    assaultDefender: clampFiniteInt(
      obj?.assaultDefender,
      MIN_SUPPLY_LIMIT_MULT,
      MAX_SUPPLY_LIMIT_MULT,
      DEFAULT_SUPPLY_LIMIT_MULT.assaultDefender
    ),
    defendDefender: clampFiniteInt(
      obj?.defendDefender,
      MIN_SUPPLY_LIMIT_MULT,
      MAX_SUPPLY_LIMIT_MULT,
      DEFAULT_SUPPLY_LIMIT_MULT.defendDefender
    ),
    defendAttacker: clampFiniteInt(
      obj?.defendAttacker,
      MIN_SUPPLY_LIMIT_MULT,
      MAX_SUPPLY_LIMIT_MULT,
      DEFAULT_SUPPLY_LIMIT_MULT.defendAttacker
    ),
    bossEscort: clampFiniteInt(
      obj?.bossEscort,
      MIN_SUPPLY_LIMIT_MULT,
      MAX_SUPPLY_LIMIT_MULT,
      DEFAULT_SUPPLY_LIMIT_MULT.bossEscort
    ),
    bossPlayers: clampFiniteInt(
      obj?.bossPlayers,
      MIN_SUPPLY_LIMIT_MULT,
      MAX_SUPPLY_LIMIT_MULT,
      DEFAULT_SUPPLY_LIMIT_MULT.bossPlayers
    ),
  };
}

export function cloneSupplyEconomyConfig(
  cfg: SupplyEconomyConfig
): SupplyEconomyConfig {
  return {
    maxUsesPerBattle: cfg.maxUsesPerBattle,
    spPriceMult: cfg.spPriceMult,
    limitMult: sanitizeSupplyLimitMult(cfg.limitMult),
  };
}

export function sanitizeSupplyEconomyConfig(
  raw?: unknown
): SupplyEconomyConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Partial<SupplyEconomyConfig>)
      : null;
  return {
    maxUsesPerBattle: clampFiniteInt(
      obj?.maxUsesPerBattle,
      MIN_SUPPLY_MAX_USES_PER_BATTLE,
      MAX_SUPPLY_MAX_USES_PER_BATTLE,
      DEFAULT_SUPPLY_MAX_USES_PER_BATTLE
    ),
    spPriceMult: clampFiniteInt(
      obj?.spPriceMult,
      MIN_SUPPLY_SP_PRICE_MULT,
      MAX_SUPPLY_SP_PRICE_MULT,
      DEFAULT_SUPPLY_SP_PRICE_MULT
    ),
    limitMult: sanitizeSupplyLimitMult(obj?.limitMult),
  };
}

function extractSupplyEconomyRaw(
  cfg?: Pick<AdminConfig, 'supplyEconomy'> | Partial<SupplyEconomyConfig> | null
): unknown {
  if (!cfg || typeof cfg !== 'object') return undefined;
  return 'supplyEconomy' in cfg ? cfg.supplyEconomy : cfg;
}

export function getSupplyLimitMult(
  kind: BattleKind | null | undefined,
  unit: Pick<CombatUnit, 'side' | 'isBoss'> | null | undefined,
  units?: readonly Pick<CombatUnit, 'isBoss'>[] | null,
  cfg?: Pick<AdminConfig, 'supplyEconomy'> | Partial<SupplyEconomyConfig> | null
): number {
  if (!unit) return 1;
  const limitMult = sanitizeSupplyEconomyConfig(
    extractSupplyEconomyRaw(cfg)
  ).limitMult!;
  const isBossBattle = Boolean(
    unit.isBoss || units?.some((u) => Boolean(u.isBoss))
  );

  if (isBossBattle) {
    if (unit.isBoss) return Infinity;
    return unit.side === 'enemy' ? limitMult.bossEscort : limitMult.bossPlayers;
  }

  if (kind === 'assault') {
    return unit.side === 'ally'
      ? limitMult.assaultAttacker
      : limitMult.assaultDefender;
  }

  if (kind === 'defend') {
    return unit.side === 'ally'
      ? limitMult.defendDefender
      : limitMult.defendAttacker;
  }

  return 1;
}

export function getEffectiveSupplyBattleLimit(
  kind: BattleKind | null | undefined,
  unit: Pick<CombatUnit, 'side' | 'isBoss'> | null | undefined,
  units?: readonly Pick<CombatUnit, 'isBoss'>[] | null,
  cfg?: Pick<AdminConfig, 'supplyEconomy'> | Partial<SupplyEconomyConfig> | null
): number {
  const baseMax = sanitizeSupplyEconomyConfig(
    extractSupplyEconomyRaw(cfg)
  ).maxUsesPerBattle;
  const mult = getSupplyLimitMult(kind, unit, units, cfg);
  if (!Number.isFinite(mult)) return Infinity;
  return Math.floor(baseMax * mult);
}

/**
 * Sanitizes PilotAccount.consumables:
 * - Preserves existing legacy consumable kinds unchanged (quantity > 0)
 * - Validates battle_supply templateIds and merges duplicate templateId stacks up to cap 99
 */
export function sanitizeConsumables(rawConsumables: unknown): ConsumableItem[] {
  if (!Array.isArray(rawConsumables)) return [];

  const result: ConsumableItem[] = [];
  const supplyIdxByTemplate = new Map<string, number>();

  for (const entry of rawConsumables) {
    if (!entry || typeof entry !== 'object') continue;
    const c = entry as ConsumableItem;
    if (typeof c.id !== 'string') continue;
    if (typeof c.quantity !== 'number' || !Number.isFinite(c.quantity) || c.quantity <= 0) {
      continue;
    }

    if (c.kind === 'battle_supply') {
      const tplId = typeof c.templateId === 'string' ? c.templateId.trim() : '';
      if (!tplId || !getSupplyTemplateById(tplId)) {
        continue;
      }
      const qtyToAdd = Math.max(1, Math.floor(c.quantity));
      const existingIdx = supplyIdxByTemplate.get(tplId);
      if (existingIdx !== undefined) {
        const existing = result[existingIdx];
        result[existingIdx] = {
          ...existing,
          quantity: Math.min(SUPPLY_STACK_CAP, existing.quantity + qtyToAdd),
        };
      } else {
        supplyIdxByTemplate.set(tplId, result.length);
        result.push({
          id: c.id,
          kind: 'battle_supply',
          templateId: tplId,
          quantity: Math.min(SUPPLY_STACK_CAP, qtyToAdd),
        });
      }
      continue;
    }

    result.push(c);
  }

  return result;
}

/**
 * Pure helper to add quantity to a battle_supply stack (merging by templateId, capped at 99).
 */
export function addSupplyToConsumables(
  consumables: readonly ConsumableItem[],
  templateId: string,
  addQty: number
): ConsumableItem[] {
  if (!getSupplyTemplateById(templateId) || !Number.isFinite(addQty) || addQty <= 0) {
    return [...consumables];
  }
  const safeAdd = Math.floor(addQty);
  const existingIdx = consumables.findIndex(
    (c) => c.kind === 'battle_supply' && c.templateId === templateId
  );
  if (existingIdx >= 0) {
    return consumables.map((c, idx) =>
      idx === existingIdx
        ? { ...c, quantity: Math.min(SUPPLY_STACK_CAP, c.quantity + safeAdd) }
        : c
    );
  }
  return [
    ...consumables,
    {
      id: `supply_${templateId}`,
      kind: 'battle_supply',
      templateId,
      quantity: Math.min(SUPPLY_STACK_CAP, safeAdd),
    },
  ];
}

export function sanitizeSupplyLoadout(
  rawIds: unknown,
  maxSlots: number = DEFAULT_SUPPLY_LOADOUT_SLOTS
): string[] {
  if (!Array.isArray(rawIds)) return [];
  const cap = sanitizeSupplyLoadoutSlots(maxSlots);
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const rawId of rawIds) {
    if (typeof rawId !== 'string') continue;
    const id = rawId.trim();
    if (!id || !getSupplyTemplateById(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    clean.push(id);
    if (clean.length >= cap) break;
  }

  return clean;
}

export function setSupplyLoadout(
  gear: GearUnit,
  ids: readonly string[],
  cfg?: Pick<AdminConfig, 'supplyLoadoutSlots'> | null
): { gear: GearUnit; rejected: SupplyLoadoutReject[] } {
  const maxSlots = sanitizeSupplyLoadoutSlots(cfg?.supplyLoadoutSlots);
  const prevIds = Array.isArray(gear.supplyLoadout) ? gear.supplyLoadout : [];
  const prevIdSet = new Set(prevIds);
  const prevCountByFamily = new Map<string, number>();
  for (const prevId of prevIds) {
    const prevTpl = getSupplyTemplateById(prevId);
    if (prevTpl) {
      prevCountByFamily.set(
        prevTpl.family,
        (prevCountByFamily.get(prevTpl.family) ?? 0) + 1
      );
    }
  }

  const seen = new Set<string>();
  const accepted: string[] = [];
  const rejected: SupplyLoadoutReject[] = [];
  const nextFamilyItems = new Map<string, { id: string; isNew: boolean }[]>();

  for (const rawId of ids) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    const tpl = id ? getSupplyTemplateById(id) : undefined;
    if (!id || !tpl) {
      rejected.push({ id: String(rawId ?? ''), reason: 'unknown' });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ id, reason: 'duplicate' });
      continue;
    }
    if (accepted.length >= maxSlots) {
      rejected.push({ id, reason: 'over_slots' });
      continue;
    }

    const famList = nextFamilyItems.get(tpl.family) ?? [];
    const isNew = !prevIdSet.has(id);
    const prevFamCount = prevCountByFamily.get(tpl.family) ?? 0;
    const hasAnyNewInFamily = isNew || famList.some((item) => item.isNew);
    const exceedsLegacyPreservation =
      famList.length >= 1 &&
      (hasAnyNewInFamily || famList.length + 1 > prevFamCount);

    if (exceedsLegacyPreservation) {
      const rejectId = isNew
        ? id
        : famList.find((item) => item.isNew)?.id ?? id;
      rejected.push({ id: rejectId, reason: 'family_duplicate' });
      continue;
    }

    seen.add(id);
    famList.push({ id, isNew });
    nextFamilyItems.set(tpl.family, famList);
    accepted.push(id);
  }

  if (rejected.some((r) => r.reason === 'family_duplicate')) {
    return {
      gear,
      rejected,
    };
  }

  return {
    gear: {
      ...gear,
      supplyLoadout: accepted,
    },
    rejected,
  };
}

function checkEffectBlockedReason(
  eff: SupplyEffect,
  unit: CombatUnit
): SupplyUseFailureReason | null {
  if (eff.kind === 'heal_hp_pct' || eff.kind === 'heal_hp') {
    return unit.hp >= unit.derived.maxHp ? 'hp_full' : null;
  }
  if (eff.kind === 'restore_shield_pct' || eff.kind === 'restore_shield') {
    const shieldBroken = unit.statuses.some(
      (s) => s.type === 'shield_break' && s.turnsRemaining > 0
    );
    if (shieldBroken) return 'shield_broken';
    return unit.shield >= unit.derived.maxShield ? 'shield_full' : null;
  }
  if (eff.kind === 'restore_sp_pct' || eff.kind === 'restore_sp') {
    return unit.sp >= unit.derived.maxSp ? 'sp_full' : null;
  }
  return null;
}

function failUse(
  reason: SupplyUseFailureReason,
  params?: Record<string, number>
): CanUseSupplyResult {
  return {
    ok: false,
    reason,
    reasonKey: `supply.reason.${reason}`,
    ...(params ? { params } : {}),
  };
}

export function canUseSupply({
  template,
  stock,
  unit,
  supplyState,
  isOwnTurn,
  cfg,
  kind,
  units,
}: CanUseSupplyInput): CanUseSupplyResult {
  if (!isOwnTurn) {
    return failUse('not_your_turn');
  }
  if (!Number.isFinite(stock) || stock <= 0) {
    return failUse('no_stock');
  }

  const usesPerTurn = sanitizeSupplyUsesPerTurn(cfg?.supplyUsesPerTurn);
  const usedThisTurn = Math.max(0, supplyState?.usedThisTurn ?? 0);
  if (usedThisTurn >= usesPerTurn) {
    return failUse('turn_limit', { n: usedThisTurn, max: usesPerTurn });
  }

  const effectiveBattleLimit = getEffectiveSupplyBattleLimit(
    kind,
    unit,
    units,
    cfg
  );
  const usedInBattle = Math.max(
    0,
    supplyState?.usedCountsByTemplate?.[template.id] ?? 0
  );
  if (
    Number.isFinite(effectiveBattleLimit) &&
    usedInBattle >= effectiveBattleLimit
  ) {
    return failUse('battle_limit', {
      n: usedInBattle,
      max: effectiveBattleLimit,
    });
  }

  const cooldownLeft = Math.max(
    0,
    supplyState?.cooldownsByTemplate?.[template.id] ?? 0
  );
  if (cooldownLeft > 0) {
    return failUse('cooldown', { n: cooldownLeft });
  }

  const effectBlocks = template.effects.map((eff) =>
    checkEffectBlockedReason(eff, unit)
  );
  if (effectBlocks.length > 0 && effectBlocks.every((r) => r !== null)) {
    return failUse(effectBlocks[0]!);
  }

  return {
    ok: true,
    reason: null,
    reasonKey: null,
  };
}

export interface ApplyBattleSupplyUseInput {
  units: readonly CombatUnit[];
  supplyByUnit?: Record<string, BattleSupplyUnitState>;
  unitId: string;
  template: SupplyTemplate;
  stock: number;
  isOwnTurn: boolean;
  cfg?: Pick<
    AdminConfig,
    'supplyUsesPerTurn' | 'supplyEconomy' | 'supplyScanCount'
  > | null;
  kind?: BattleKind | null;
  rng?: () => number;
}

export type ApplyBattleSupplyUseResult =
  | {
      ok: false;
      reason: SupplyUseFailureReason;
      reasonKey: string;
      params?: Record<string, number>;
    }
  | {
      ok: true;
      units: CombatUnit[];
      supplyByUnit: Record<string, BattleSupplyUnitState>;
      gains: SupplyEffectGains;
      revealedUnitIds?: string[];
      revealedNames?: string[];
    };

export function tickSupplyState(
  state?: Partial<BattleSupplyUnitState> | null
): BattleSupplyUnitState {
  const nextCooldowns: Record<string, number> = {};
  for (const [tplId, rawLeft] of Object.entries(
    state?.cooldownsByTemplate ?? {}
  )) {
    const left =
      typeof rawLeft === 'number' && Number.isFinite(rawLeft)
        ? Math.max(0, Math.floor(rawLeft) - 1)
        : 0;
    if (left > 0) {
      nextCooldowns[tplId] = left;
    }
  }
  return {
    usedCountsByTemplate: { ...(state?.usedCountsByTemplate ?? {}) },
    cooldownsByTemplate: nextCooldowns,
    usedThisTurn: 0,
  };
}

export function tickBattleSupplyForUnit(
  supplyByUnit: Record<string, BattleSupplyUnitState> | undefined,
  unitId: string
): Record<string, BattleSupplyUnitState> | undefined {
  if (!supplyByUnit || !supplyByUnit[unitId]) {
    return supplyByUnit;
  }
  return {
    ...supplyByUnit,
    [unitId]: tickSupplyState(supplyByUnit[unitId]),
  };
}

export function applyBattleSupplyUse({
  units,
  supplyByUnit,
  unitId,
  template,
  stock,
  isOwnTurn,
  cfg,
  kind,
  rng,
}: ApplyBattleSupplyUseInput): ApplyBattleSupplyUseResult {
  const unitIdx = units.findIndex((u) => u.id === unitId);
  const unit = unitIdx >= 0 ? units[unitIdx] : undefined;
  if (!unit || !unit.alive) {
    return {
      ok: false,
      reason: 'not_your_turn',
      reasonKey: 'supply.reason.not_your_turn',
    };
  }

  const prevState = supplyByUnit?.[unitId];
  const check = canUseSupply({
    template,
    stock,
    unit,
    supplyState: prevState,
    isOwnTurn,
    cfg,
    kind,
    units,
  });

  if (!check.ok) {
    return {
      ok: false,
      reason: check.reason ?? 'not_your_turn',
      reasonKey: check.reasonKey ?? 'supply.reason.not_your_turn',
      ...(check.params ? { params: check.params } : {}),
    };
  }

  const { unit: nextUnit, gains } = applySupplyEffects(unit, template.effects);
  let nextUnits = units.map((u, idx) => (idx === unitIdx ? nextUnit : u));

  const scanEff = template.effects.find(
    (e) => e.kind === 'reveal_stealth_front'
  );
  let revealedUnitIds: string[] | undefined;
  let revealedNames: string[] | undefined;

  if (scanEff) {
    const scanCount =
      cfg?.supplyScanCount !== undefined
        ? sanitizeSupplyScanCount(cfg.supplyScanCount)
        : sanitizeSupplyScanCount(scanEff.value);
    const frontRows = new Set(FORMATION_ROWS.slice(0, 2));
    const candidates = nextUnits.filter(
      (u) =>
        u.side !== unit.side &&
        u.alive &&
        frontRows.has(u.row) &&
        u.statuses.some((s) => s.type === 'stealth' && s.turnsRemaining > 0)
    );
    const rand = rng ?? Math.random;
    const pool = [...candidates];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(rand() * (i + 1)));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    const picked = pool.slice(0, Math.min(scanCount, pool.length));
    const pickedIds = new Set(picked.map((u) => u.id));
    revealedUnitIds = picked.map((u) => u.id);
    revealedNames = picked.map((u) => u.name);

    if (pickedIds.size > 0) {
      nextUnits = nextUnits.map((u) => {
        if (!pickedIds.has(u.id)) return u;
        return {
          ...u,
          statuses: u.statuses.filter((s) => s.type !== 'stealth'),
          revealedThisRound: true,
        };
      });
    }
  }

  const prevCounts = prevState?.usedCountsByTemplate ?? {};
  const prevCooldowns = prevState?.cooldownsByTemplate ?? {};
  const nextUnitState: BattleSupplyUnitState = {
    usedCountsByTemplate: {
      ...prevCounts,
      [template.id]: Math.max(0, prevCounts[template.id] ?? 0) + 1,
    },
    cooldownsByTemplate: {
      ...prevCooldowns,
      [template.id]: Math.max(0, Math.floor(template.cooldownTurns)) + 1,
    },
    usedThisTurn: Math.max(0, prevState?.usedThisTurn ?? 0) + 1,
  };

  return {
    ok: true,
    units: nextUnits,
    supplyByUnit: {
      ...(supplyByUnit ?? {}),
      [unitId]: nextUnitState,
    },
    gains,
    ...(scanEff ? { revealedUnitIds, revealedNames } : {}),
  };
}

export interface BattleSupplyRow {
  slotIndex: number;
  templateId: string | null;
  iconId: string | null;
  name: string;
  nameKey: string | null;
  effectSummary: string;
  effects: SupplyEffect[];
  stock: number;
  usedCount: number;
  limit: number;
  ok: boolean;
  reason: SupplyUseFailureReason | null;
  reasonKey: string | null;
  params?: Record<string, number>;
}

export interface BattleSupplyRowsSummary {
  rows: BattleSupplyRow[];
  hasLoadout: boolean;
  usedThisTurn: number;
  usesPerTurn: number;
  usableCount: number;
  isPlayerTurn: boolean;
}

function formatRawEffects(effects: readonly SupplyEffect[]): string {
  return effects
    .map((eff) => {
      if (eff.kind === 'heal_hp_pct') return `HP +${eff.value}%`;
      if (eff.kind === 'heal_hp') return `HP +${eff.value}`;
      if (eff.kind === 'restore_shield_pct') return `SHD +${eff.value}%`;
      if (eff.kind === 'restore_shield') return `SHD +${eff.value}`;
      if (eff.kind === 'restore_sp_pct') return `SP +${eff.value}%`;
      if (eff.kind === 'reveal_stealth_front') return `Scan x${eff.value}`;
      return `SP +${eff.value}`;
    })
    .join(', ');
}

export function getSupplyStockCount(
  consumables: readonly ConsumableItem[] | undefined,
  templateId: string
): number {
  let total = 0;
  for (const c of consumables ?? []) {
    if (c.kind === 'battle_supply' && c.templateId === templateId && c.quantity > 0) {
      total += Math.floor(c.quantity);
    }
  }
  return total;
}

export function getBattleSupplyRows(
  battle: Pick<
    BattleState,
    | 'kind'
    | 'deployedGearId'
    | 'units'
    | 'turnOrder'
    | 'activeTurnIndex'
    | 'supplyByUnit'
    | 'summary'
    | 'isResolving'
  > | null | undefined,
  pilot: Pick<PilotAccount, 'gears' | 'consumables'> | null | undefined,
  cfg?: Pick<
    AdminConfig,
    'supplyLoadoutSlots' | 'supplyUsesPerTurn' | 'supplyEconomy'
  > | null
): BattleSupplyRowsSummary {
  const maxSlots = sanitizeSupplyLoadoutSlots(cfg?.supplyLoadoutSlots);
  const usesPerTurn = sanitizeSupplyUsesPerTurn(cfg?.supplyUsesPerTurn);
  const maxUsesPerBattle = sanitizeSupplyEconomyConfig(
    cfg?.supplyEconomy
  ).maxUsesPerBattle;
  if (!battle || !pilot) {
    return {
      rows: [],
      hasLoadout: false,
      usedThisTurn: 0,
      usesPerTurn,
      usableCount: 0,
      isPlayerTurn: false,
    };
  }

  const deployedGear = pilot.gears?.[battle.deployedGearId];
  const loadoutIds = sanitizeSupplyLoadout(deployedGear?.supplyLoadout, maxSlots);
  const hasLoadout = loadoutIds.length > 0;

  const playerUnit = battle.units.find((u) => u.isPlayer) ?? null;
  const activeUnitId = battle.turnOrder[battle.activeTurnIndex];
  const isPlayerCharging = Boolean(
    playerUnit?.statuses.some(
      (s) => s.type === 'charging' && s.turnsRemaining > 0
    )
  );
  const isPlayerTurn = Boolean(
    !battle.summary &&
      !battle.isResolving &&
      playerUnit &&
      playerUnit.alive &&
      activeUnitId === playerUnit.id &&
      !isPlayerCharging
  );

  const supplyState = playerUnit
    ? battle.supplyByUnit?.[playerUnit.id]
    : undefined;
  const usedThisTurn = Math.max(0, supplyState?.usedThisTurn ?? 0);

  let usableCount = 0;
  const rows: BattleSupplyRow[] = [];

  for (let slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
    const tplId = loadoutIds[slotIndex] ?? null;
    const tpl = tplId ? getSupplyTemplateById(tplId) : undefined;
    if (!tpl) {
      rows.push({
        slotIndex,
        templateId: null,
        iconId: null,
        name: '',
        nameKey: null,
        effectSummary: '',
        effects: [],
        stock: 0,
        usedCount: 0,
        limit: 0,
        ok: false,
        reason: null,
        reasonKey: null,
      });
      continue;
    }

    const stock = getSupplyStockCount(pilot.consumables, tpl.id);
    const usedCount = Math.max(
      0,
      supplyState?.usedCountsByTemplate?.[tpl.id] ?? 0
    );
    const effectiveLimit = playerUnit
      ? getEffectiveSupplyBattleLimit(battle.kind, playerUnit, battle.units, cfg)
      : maxUsesPerBattle;
    const check: CanUseSupplyResult = playerUnit
      ? canUseSupply({
          template: tpl,
          stock,
          unit: playerUnit,
          supplyState,
          isOwnTurn: isPlayerTurn,
          cfg,
          kind: battle.kind,
          units: battle.units,
        })
      : {
          ok: false,
          reason: 'not_your_turn',
          reasonKey: 'supply.reason.not_your_turn',
        };

    if (check.ok) {
      usableCount += 1;
    }

    rows.push({
      slotIndex,
      templateId: tpl.id,
      iconId: tpl.iconId,
      name: tpl.id,
      nameKey: `supply.${tpl.id}.name`,
      effectSummary: formatRawEffects(tpl.effects),
      effects: tpl.effects,
      stock,
      usedCount,
      limit: effectiveLimit,
      ok: check.ok,
      reason: check.reason,
      reasonKey: check.reasonKey,
      ...(check.params ? { params: check.params } : {}),
    });
  }

  return {
    rows,
    hasLoadout,
    usedThisTurn,
    usesPerTurn,
    usableCount,
    isPlayerTurn,
  };
}
