import { getSupplyTemplateById } from '../data/consumables';
import type {
  AdminConfig,
  BattleSupplyUnitState,
  CombatUnit,
  ConsumableItem,
  GearUnit,
  SupplyEffect,
  SupplyTemplate,
} from '../types/game';

export const SUPPLY_STACK_CAP = 99;

export const DEFAULT_SUPPLY_LOADOUT_SLOTS = 4;
export const MIN_SUPPLY_LOADOUT_SLOTS = 2;
export const MAX_SUPPLY_LOADOUT_SLOTS = 8;

export const DEFAULT_SUPPLY_USES_PER_TURN = 1;
export const MIN_SUPPLY_USES_PER_TURN = 1;
export const MAX_SUPPLY_USES_PER_TURN = 3;

export type SupplyRejectReason = 'unknown' | 'duplicate' | 'over_slots';

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
  cfg?: Pick<AdminConfig, 'supplyUsesPerTurn'> | null;
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
  const seen = new Set<string>();
  const accepted: string[] = [];
  const rejected: SupplyLoadoutReject[] = [];

  for (const rawId of ids) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id || !getSupplyTemplateById(id)) {
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
    seen.add(id);
    accepted.push(id);
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
  if (eff.kind === 'heal_hp_pct') {
    return unit.hp >= unit.derived.maxHp ? 'hp_full' : null;
  }
  if (eff.kind === 'restore_shield_pct') {
    const shieldBroken = unit.statuses.some(
      (s) => s.type === 'shield_break' && s.turnsRemaining > 0
    );
    if (shieldBroken) return 'shield_broken';
    return unit.shield >= unit.derived.maxShield ? 'shield_full' : null;
  }
  if (eff.kind === 'restore_sp_pct') {
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

  const usedInBattle = Math.max(
    0,
    supplyState?.usedCountsByTemplate?.[template.id] ?? 0
  );
  if (usedInBattle >= template.perBattleLimit) {
    return failUse('battle_limit', {
      n: usedInBattle,
      max: template.perBattleLimit,
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
