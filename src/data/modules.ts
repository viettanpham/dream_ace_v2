import type {
  ItemTemplate,
  ModuleFamily,
  ModuleTemplate,
  ModuleTraitKey,
  StatKey,
} from '../types/game';
import { DEFAULT_ITEM_LEVELS_CONFIG, getTierRequiredLevel } from '../engine/itemLevels';
import { STAT_KEYS } from './classes';
import rawIconCatalog from './iconCatalog.json';
import { PRICE_FORMULA } from './itemPricing';
import rawModulesData from './modules.json';

export type { ModuleTemplate };

export const BUILTIN_MODULE_REGISTRY_TAG = 'sys' as const;

export const MODULE_FAMILIES: readonly ModuleFamily[] = [
  'stat',
  'trait',
  'skill',
];

export const MODULE_TRAIT_KEYS: readonly ModuleTraitKey[] = [
  'critBonusPct',
  'armorPiercePct',
  'spRegenPerTurn',
  'accuracyPct',
];

const VALID_FAMILY_SET = new Set<string>(MODULE_FAMILIES);
const VALID_STAT_KEY_SET = new Set<string>(STAT_KEYS as readonly string[]);
const VALID_TRAIT_KEY_SET = new Set<string>(MODULE_TRAIT_KEYS);
const VALID_ICON_ID_SET = new Set<string>(
  Array.isArray(rawIconCatalog)
    ? rawIconCatalog
        .map((row) =>
          row &&
          typeof row === 'object' &&
          typeof (row as { id?: unknown }).id === 'string'
            ? (row as { id: string }).id
            : null
        )
        .filter((id): id is string => id !== null)
    : []
);

const isNonEmptyStr = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/**
 * Validates a single raw extender module template row.
 * Returns null (and logs console.warn) on invalid rows.
 */
export function validateModuleTemplate(raw: unknown): ModuleTemplate | null {
  const r =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  if (!r) {
    console.warn('[modules] Dropped invalid module template: non-object row.');
    return null;
  }

  const rowLabel = isNonEmptyStr(r.id) ? r.id.trim() : '<unknown>';
  const familyValid =
    typeof r.family === 'string' && VALID_FAMILY_SET.has(r.family);
  const family = r.family as ModuleFamily;

  const effectKeyValid =
    isNonEmptyStr(r.effectKey) &&
    (family === 'stat'
      ? VALID_STAT_KEY_SET.has(r.effectKey)
      : family === 'trait'
      ? VALID_TRAIT_KEY_SET.has(r.effectKey)
      : true);

  const skillIdValid =
    family === 'skill'
      ? isNonEmptyStr(r.skillId)
      : r.skillId === undefined;

  const valueValid =
    typeof r.value === 'number' &&
    Number.isFinite(r.value) &&
    (family === 'skill' ? r.value >= 0 : r.value > 0);

  const registryTagValid =
    r.registryTag === undefined ||
    r.registryTag === 'sys' ||
    r.registryTag === 'mods';

  const ok =
    isNonEmptyStr(r.id) &&
    isNonEmptyStr(r.nameVi) &&
    isNonEmptyStr(r.nameEn) &&
    isNonEmptyStr(r.descVi) &&
    isNonEmptyStr(r.descEn) &&
    isNonEmptyStr(r.iconId) &&
    VALID_ICON_ID_SET.has(r.iconId) &&
    familyValid &&
    typeof r.tier === 'number' &&
    Number.isInteger(r.tier) &&
    r.tier >= 1 &&
    r.tier <= 4 &&
    typeof r.requiredLevel === 'number' &&
    Number.isInteger(r.requiredLevel) &&
    r.requiredLevel >= 1 &&
    effectKeyValid &&
    valueValid &&
    skillIdValid &&
    registryTagValid;

  if (!ok) {
    console.warn(`[modules] Dropped invalid module template "${rowLabel}".`);
    return null;
  }

  const tier = r.tier as 1 | 2 | 3 | 4;
  const requiredLevel = DEFAULT_ITEM_LEVELS_CONFIG.kinds.module.enabled
    ? getTierRequiredLevel('module', tier)
    : (r.requiredLevel as number);

  return {
    id: (r.id as string).trim(),
    nameVi: (r.nameVi as string).trim(),
    nameEn: (r.nameEn as string).trim(),
    descVi: (r.descVi as string).trim(),
    descEn: (r.descEn as string).trim(),
    iconId: (r.iconId as string).trim(),
    family,
    tier,
    requiredLevel,
    effectKey: (r.effectKey as string).trim() as StatKey | ModuleTraitKey | string,
    value: r.value as number,
    ...(family === 'skill' ? { skillId: (r.skillId as string).trim() } : {}),
    registryTag: (r.registryTag as 'sys' | 'mods') ?? BUILTIN_MODULE_REGISTRY_TAG,
  };
}

/**
 * Validates raw modules JSON payload, dropping bad rows and duplicate ids with console.warn.
 */
export function validateModuleTemplates(raw: unknown): ModuleTemplate[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as { modules?: unknown }).modules)
    ? (raw as { modules: unknown[] }).modules
    : null;

  if (!rows) {
    console.warn(
      '[modules] Invalid modules payload; expected { schemaVersion, modules: [] }.'
    );
    return [];
  }

  const seenIds = new Set<string>();
  const valid: ModuleTemplate[] = [];

  for (const entry of rows) {
    const parsed = validateModuleTemplate(entry);
    if (!parsed) continue;
    if (seenIds.has(parsed.id)) {
      console.warn(
        `[modules] Dropped duplicate module template "${parsed.id}".`
      );
      continue;
    }
    seenIds.add(parsed.id);
    valid.push(parsed);
  }

  return valid;
}

export const MODULE_TEMPLATES: ModuleTemplate[] =
  validateModuleTemplates(rawModulesData);

export const MODULE_TEMPLATES_BY_ID: Record<string, ModuleTemplate> =
  MODULE_TEMPLATES.reduce((acc, tpl) => {
    acc[tpl.id] = tpl;
    return acc;
  }, {} as Record<string, ModuleTemplate>);

export function getModuleTemplateById(
  id: string
): ModuleTemplate | undefined {
  return MODULE_TEMPLATES_BY_ID[id];
}

export const MODULE_ITEM_TEMPLATES: ItemTemplate[] = MODULE_TEMPLATES.map(
  (mod): ItemTemplate => {
    const tierIdx = Math.max(
      0,
      Math.min(PRICE_FORMULA.tierFactor.length - 1, Math.round(mod.tier) - 1)
    );
    const basePrice = Math.round(
      PRICE_FORMULA.moduleBase[mod.family] *
        (PRICE_FORMULA.tierFactor[tierIdx] ?? 1)
    );
    if (mod.family === 'stat') {
      return {
        id: mod.id,
        nameEn: mod.nameEn,
        nameVi: mod.nameVi,
        descEn: mod.descEn,
        descVi: mod.descVi,
        slot: 'module',
        tier: mod.tier,
        requiredLevel: mod.requiredLevel,
        classRestriction: null,
        basePrice,
        primaryStat: mod.effectKey as StatKey,
        primaryRange: [mod.value, mod.value],
        affixPool: [],
        registryTag: BUILTIN_MODULE_REGISTRY_TAG,
      };
    }
    return {
      id: mod.id,
      nameEn: mod.nameEn,
      nameVi: mod.nameVi,
      descEn: mod.descEn,
      descVi: mod.descVi,
      slot: 'module',
      tier: mod.tier,
      requiredLevel: mod.requiredLevel,
      classRestriction: null,
      basePrice,
      primaryStat: 'attack',
      primaryRange: [0, 0],
      affixPool: [],
      ...(mod.family === 'trait'
        ? { specialTraits: { [mod.effectKey]: mod.value } }
        : {}),
      registryTag: BUILTIN_MODULE_REGISTRY_TAG,
    };
  }
);
