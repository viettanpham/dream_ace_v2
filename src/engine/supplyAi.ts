import type {
  AdminConfig,
  AutoSuppliesConfig,
  BattleKind,
  BattleSupplyUnitState,
  CombatUnit,
  SupplyTemplate,
} from '../types/game';
import {
  canUseSupply,
  isAutoSupplyAllowed,
  sanitizeSupplyUsesPerTurn,
} from './supplies';

export const AUTO_SUPPLIES_MIN_PCT = 5;
export const AUTO_SUPPLIES_MAX_PCT = 90;

export const DEFAULT_AUTO_SUPPLIES_CONFIG: AutoSuppliesConfig = {
  enabled: false,
  hpBelowPct: 35,
  shieldBelowPct: 25,
  spBelowPct: 20,
  buffAtStart: true,
};

function clampAutoSuppliesPct(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(
    AUTO_SUPPLIES_MIN_PCT,
    Math.min(AUTO_SUPPLIES_MAX_PCT, Math.round(raw))
  );
}

export function sanitizeAutoSuppliesConfig(raw?: unknown): AutoSuppliesConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Partial<AutoSuppliesConfig>)
      : null;
  return {
    enabled:
      typeof obj?.enabled === 'boolean'
        ? obj.enabled
        : DEFAULT_AUTO_SUPPLIES_CONFIG.enabled,
    hpBelowPct: clampAutoSuppliesPct(
      obj?.hpBelowPct,
      DEFAULT_AUTO_SUPPLIES_CONFIG.hpBelowPct
    ),
    shieldBelowPct: clampAutoSuppliesPct(
      obj?.shieldBelowPct,
      DEFAULT_AUTO_SUPPLIES_CONFIG.shieldBelowPct
    ),
    spBelowPct: clampAutoSuppliesPct(
      obj?.spBelowPct,
      DEFAULT_AUTO_SUPPLIES_CONFIG.spBelowPct
    ),
    buffAtStart:
      typeof obj?.buffAtStart === 'boolean'
        ? obj.buffAtStart
        : DEFAULT_AUTO_SUPPLIES_CONFIG.buffAtStart,
  };
}

type KitFamily = 'hp_kit' | 'shield_kit' | 'sp_kit';

function getKitFlatValue(template: SupplyTemplate, family: KitFamily): number {
  const targetEffectKind =
    family === 'hp_kit'
      ? 'heal_hp'
      : family === 'shield_kit'
      ? 'restore_shield'
      : 'restore_sp';
  let sum = 0;
  for (const eff of template.effects) {
    if (eff.kind === targetEffectKind && Number.isFinite(eff.value)) {
      sum += eff.value;
    }
  }
  if (sum > 0) return sum;
  return template.effects[0]?.value ?? 0;
}

export interface PickAutoSuppliesInput {
  unit: CombatUnit;
  loadoutTemplates: readonly SupplyTemplate[];
  stockByTemplate: Record<string, number>;
  unitState?: Partial<BattleSupplyUnitState> | null;
  cfg?: unknown;
  adminCfg?: Pick<AdminConfig, 'supplyUsesPerTurn' | 'supplyEconomy'> | null;
  kind?: BattleKind | null;
  units?: readonly CombatUnit[] | null;
  battleLimitOverride?: number | null;
}

export function pickAutoSupplies({
  unit,
  loadoutTemplates,
  stockByTemplate,
  unitState,
  cfg,
  adminCfg,
  kind,
  units,
  battleLimitOverride,
}: PickAutoSuppliesInput): string[] {
  const autoCfg = sanitizeAutoSuppliesConfig(cfg);
  if (!autoCfg.enabled || !unit.alive) return [];

  const maxPerTurn = sanitizeSupplyUsesPerTurn(adminCfg?.supplyUsesPerTurn);
  let usedThisTurn = Math.max(0, unitState?.usedThisTurn ?? 0);
  if (usedThisTurn >= maxPerTurn) return [];

  const needs: Array<{ family: KitFamily; triggered: boolean; missing: number }> = [
    {
      family: 'hp_kit',
      triggered:
        unit.derived.maxHp > 0 &&
        (unit.hp / unit.derived.maxHp) * 100 < autoCfg.hpBelowPct,
      missing: Math.max(0, unit.derived.maxHp - unit.hp),
    },
    {
      family: 'shield_kit',
      triggered:
        unit.derived.maxShield > 0 &&
        (unit.shield / unit.derived.maxShield) * 100 < autoCfg.shieldBelowPct,
      missing: Math.max(0, unit.derived.maxShield - unit.shield),
    },
    {
      family: 'sp_kit',
      triggered:
        unit.derived.maxSp > 0 &&
        (unit.sp / unit.derived.maxSp) * 100 < autoCfg.spBelowPct,
      missing: Math.max(0, unit.derived.maxSp - unit.sp),
    },
  ];

  const picks: string[] = [];
  const chosenIds = new Set<string>();

  for (const need of needs) {
    if (usedThisTurn >= maxPerTurn) break;
    if (!need.triggered) continue;

    const usable = loadoutTemplates.filter((tpl) => {
      if (tpl.family !== need.family) return false;
      if (!isAutoSupplyAllowed(tpl)) return false;
      if (chosenIds.has(tpl.id)) return false;
      const check = canUseSupply({
        template: tpl,
        stock: stockByTemplate[tpl.id] ?? 0,
        unit,
        supplyState: {
          ...unitState,
          usedThisTurn,
        },
        isOwnTurn: true,
        cfg: adminCfg,
        kind,
        units,
        battleLimitOverride,
      });
      return check.ok;
    });

    if (usable.length === 0) continue;

    const sorted = [...usable].sort((a, b) => {
      const diff = getKitFlatValue(a, need.family) - getKitFlatValue(b, need.family);
      if (diff !== 0) return diff;
      return a.tier - b.tier;
    });

    const chosen =
      sorted.find((tpl) => getKitFlatValue(tpl, need.family) >= need.missing) ??
      sorted[sorted.length - 1];

    picks.push(chosen.id);
    chosenIds.add(chosen.id);
    usedThisTurn += 1;
  }

  return picks;
}
