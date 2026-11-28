import type {
  SupplyEffect,
  SupplyEffectKind,
  SupplyFamily,
  SupplyTemplate,
} from '../types/game';
import rawConsumablesData from './consumables.json';
import rawIconCatalog from './iconCatalog.json';

export const BUILTIN_SUPPLY_REGISTRY_TAG = 'sys' as const;

export const SUPPLY_TEMPLATE_FAMILIES: readonly SupplyFamily[] = [
  'hp_kit',
  'shield_kit',
  'sp_kit',
  'buff',
  'utility',
];

export const SUPPLY_EFFECT_KINDS: readonly SupplyEffectKind[] = [
  'heal_hp_pct',
  'restore_shield_pct',
  'restore_sp_pct',
  'heal_hp',
  'restore_shield',
  'restore_sp',
  'reveal_stealth_front',
  'reset_cooldowns',
  'cleanse_debuffs',
  'grant_dodge',
  'grant_speed_pct',
];

const VALID_FAMILY_SET = new Set<string>(SUPPLY_TEMPLATE_FAMILIES);
const VALID_EFFECT_SET = new Set<string>(SUPPLY_EFFECT_KINDS);
const VALID_ICON_ID_SET = new Set<string>(
  Array.isArray(rawIconCatalog)
    ? rawIconCatalog
        .map((row) =>
          row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
            ? (row as { id: string }).id
            : null
        )
        .filter((id): id is string => id !== null)
    : []
);

const isNonEmptyStr = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

function isValidSupplyEffect(raw: unknown): raw is SupplyEffect {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  const durationValid =
    obj.durationRounds === undefined ||
    (typeof obj.durationRounds === 'number' &&
      Number.isInteger(obj.durationRounds) &&
      obj.durationRounds >= 1 &&
      obj.durationRounds <= 10);
  return (
    typeof obj.kind === 'string' &&
    VALID_EFFECT_SET.has(obj.kind) &&
    typeof obj.value === 'number' &&
    Number.isFinite(obj.value) &&
    obj.value > 0 &&
    durationValid
  );
}

/**
 * Validates a single raw supply template row. Returns null (and logs console.warn) on invalid rows.
 */
export function validateSupplyTemplate(raw: unknown): SupplyTemplate | null {
  const r =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  if (!r) {
    console.warn('[consumables] Dropped invalid supply template: non-object row.');
    return null;
  }

  const rowLabel = isNonEmptyStr(r.id) ? r.id.trim() : '<unknown>';
  const hasPriceOverride = r.priceOverride !== undefined;
  const priceOverrideValid =
    !hasPriceOverride ||
    (typeof r.priceOverride === 'number' &&
      Number.isFinite(r.priceOverride) &&
      r.priceOverride > 0);
  const registryTagValid =
    r.registryTag === undefined ||
    r.registryTag === 'sys' ||
    r.registryTag === 'mods';

  const ok =
    isNonEmptyStr(r.id) &&
    typeof r.family === 'string' &&
    VALID_FAMILY_SET.has(r.family) &&
    typeof r.tier === 'number' &&
    Number.isInteger(r.tier) &&
    r.tier >= 1 &&
    r.tier <= 5 &&
    typeof r.unlockLevel === 'number' &&
    Number.isInteger(r.unlockLevel) &&
    r.unlockLevel >= 1 &&
    isNonEmptyStr(r.iconId) &&
    VALID_ICON_ID_SET.has(r.iconId) &&
    Array.isArray(r.effects) &&
    r.effects.length > 0 &&
    r.effects.every(isValidSupplyEffect) &&
    typeof r.cooldownTurns === 'number' &&
    Number.isInteger(r.cooldownTurns) &&
    r.cooldownTurns >= 0 &&
    typeof r.perBattleLimit === 'number' &&
    Number.isInteger(r.perBattleLimit) &&
    r.perBattleLimit >= 1 &&
    priceOverrideValid &&
    registryTagValid;

  if (!ok) {
    console.warn(`[consumables] Dropped invalid supply template "${rowLabel}".`);
    return null;
  }

  return {
    id: (r.id as string).trim(),
    family: r.family as SupplyFamily,
    tier: r.tier as 1 | 2 | 3 | 4 | 5,
    unlockLevel: r.unlockLevel as number,
    iconId: r.iconId as string,
    effects: (r.effects as SupplyEffect[]).map((eff) => ({
      kind: eff.kind,
      value: eff.value,
      ...(eff.durationRounds !== undefined
        ? { durationRounds: eff.durationRounds }
        : {}),
    })),
    cooldownTurns: r.cooldownTurns as number,
    perBattleLimit: r.perBattleLimit as number,
    ...(hasPriceOverride ? { priceOverride: r.priceOverride as number } : {}),
    registryTag: (r.registryTag as 'sys' | 'mods') ?? BUILTIN_SUPPLY_REGISTRY_TAG,
  };
}

/**
 * Validates raw consumables JSON payload, dropping bad rows and duplicates with console.warn.
 */
export function validateSupplyTemplates(raw: unknown): SupplyTemplate[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as { templates?: unknown }).templates)
    ? (raw as { templates: unknown[] }).templates
    : null;

  if (!rows) {
    console.warn(
      '[consumables] Invalid consumables payload; expected { schemaVersion, templates: [] }.'
    );
    return [];
  }

  const seenIds = new Set<string>();
  const valid: SupplyTemplate[] = [];

  for (const entry of rows) {
    const parsed = validateSupplyTemplate(entry);
    if (!parsed) continue;
    if (seenIds.has(parsed.id)) {
      console.warn(
        `[consumables] Dropped duplicate supply template "${parsed.id}".`
      );
      continue;
    }
    seenIds.add(parsed.id);
    valid.push(parsed);
  }

  return valid;
}

export const SUPPLY_TEMPLATES: SupplyTemplate[] =
  validateSupplyTemplates(rawConsumablesData);

export const SUPPLY_TEMPLATES_BY_ID: Record<string, SupplyTemplate> =
  SUPPLY_TEMPLATES.reduce((acc, tpl) => {
    acc[tpl.id] = tpl;
    return acc;
  }, {} as Record<string, SupplyTemplate>);

export function getSupplyTemplateById(
  id: string
): SupplyTemplate | undefined {
  return SUPPLY_TEMPLATES_BY_ID[id];
}
