import { getCatalogRow } from './iconCatalog';
import rawSkillsData from './skills.json';
import type {
  AdminConfig, IconCatalogModRow, MechClassId, OpeningCardDefinition,
  PassiveStatEntry, PassiveStatKey, SkillCategory, SkillClassScope,
  SkillDefinition, SkillEffectKind, SkillEffectSpec, SkillIconKey, SkillModDefinition,
  SkillRegistryTag, SkillTargetType, SkillTierKind, SkillTiersConfig,
} from '../types/game';
import {
  BALANCE_CONFIG,
  DEFAULT_SKILL_TIERS_CONFIG,
  getEffectiveSkillMaxLevel,
  sanitizePassiveScaleAfter5,
  sanitizeRestorePctCap,
  sanitizeSkillCardPriceMult,
} from './balance';
import { scaleSkillEffectSpecs, validateSpecSkillRow } from '../engine/skillSpecs';

export const BUILTIN_SKILL_REGISTRY_TAG = 'sys' as const;
export const MAX_SKILL_MODS = 100;
export const SKILL_MOD_ID_REGEX = /^mod_[a-z0-9_-]+$/;
export const PASSIVE_STAT_KEYS = [
  'attackPct',
  'defPct',
  'evaPct',
  'speedFlat',
  'spRegenFlat',
  'maxHpPct',
  'maxShieldPct',
  'critFlat',
  'critDamagePct',
  'dodgeFlat',
  'armorPierceFlat',
  'healPowerPct',
  'shieldPowerPct',
  'shieldRegenPctAdd',
  'hpRegenPctAdd',
  'executeDmgPct',
  'lastStandDefPct',
] as const satisfies readonly PassiveStatKey[];
const PASSIVE_STAT_KEY_SET = new Set<string>(PASSIVE_STAT_KEYS);

export function validatePassiveStatEntries(row: Record<string, unknown>): string[] {
  const errs: string[] = [];
  if (row.category !== 'passive') {
    errs.push('passive_stat_requires_passive_category');
  }
  if (!Array.isArray(row.passiveStats) || row.passiveStats.length < 1 || row.passiveStats.length > 2) {
    errs.push('passiveStats_length_1_to_2_required');
    return errs;
  }
  const seenKeys = new Set<string>();
  row.passiveStats.forEach((entry, idx) => {
    const p = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? (entry as Record<string, unknown>)
      : null;
    if (!p || typeof p.key !== 'string' || !PASSIVE_STAT_KEY_SET.has(p.key)) {
      errs.push(`passiveStats[${idx}].key_invalid`);
      return;
    }
    if (seenKeys.has(p.key)) {
      errs.push(`passiveStats[${idx}].key_duplicate`);
    }
    seenKeys.add(p.key);
    if (typeof p.perLevel !== 'number' || !Number.isFinite(p.perLevel) || p.perLevel <= 0 || p.perLevel > 50) {
      errs.push(`passiveStats[${idx}].perLevel_invalid`);
    }
  });
  return errs;
}

export const EFFECT_KIND_VALIDATORS: Partial<Record<SkillEffectKind, (row: Record<string, unknown>) => string[]>> = {
  passive_stat: validatePassiveStatEntries,
  spec: validateSpecSkillRow,
};
export const MOD_EFFECT_KINDS: SkillEffectKind[] = ['passive_stat', 'spec'];

const VALID_CLASS_SCOPES = new Set<SkillClassScope>(['general', 'striker', 'interceptor', 'siege', 'support']);
const VALID_CATEGORIES = new Set<SkillCategory>(['normal', 'special', 'elite', 'passive']);
const VALID_TARGET_TYPES = new Set<SkillTargetType>(['self', 'single_enemy', 'multi_enemy', 'all_enemies', 'single_ally', 'all_allies']);
const VALID_ICON_KEYS = new Set<SkillIconKey>([
  'shield', 'wind', 'flame', 'crosshair', 'target', 'zap', 'bomb', 'battery', 'ghost', 'orbit',
  'anchor', 'fortress', 'snowflake', 'shield_off', 'eye_off', 'ray', 'sword', 'rotate', 'corner_down_left', 'gauge',
  'radio', 'sparkles', 'skull', 'heart', 'radar', 'bolt', 'plus_circle', 'waves', 'swords', 'shield_plus',
  'feather', 'sun', 'cleanse', 'star',
  'remove_moderator', 'explosion', 'flare', 'health_cross', 'security', 'shield_with_heart',
  'center_focus_strong', 'air', 'health_and_safety', 'add_moderator', 'shield_moon',
]);
const VALID_EFFECT_KINDS = new Set<SkillEffectKind>([
  'buff_def', 'buff_eva', 'buff_primary_dmg', 'buff_skill_dmg', 'buff_sure_hit',
  'multi_attack', 'splash_attack', 'charge_attack', 'stealth_turns', 'aoe_elite_attack',
  'toggle_siege_mode', 'toggle_siege_defense', 'attack_slow', 'attack_shield_break',
  'stealth_until_attack', 'pierce_all_elite', 'attack_pierce', 'counter_stance',
  'retreat_back_eva', 'buff_speed', 'silence_target', 'evade_all_round', 'berserker_buff',
  'heal_single', 'scan_reveal', 'energize_single', 'sp_transfer', 'heal_field_hot',
  'energize_shield_field', 'team_atk_up', 'team_def_up', 'team_eva_up', 'invincible_ally',
  'purify_team', 'full_recovery_elite', 'passive_skill_dmg', 'passive_def_pct',
  'passive_eva_spd', 'passive_sp_regen', 'passive_stat', 'spec',
]);
const OPTIONAL_NUMERIC_KEYS = [
  'powerMultiplier', 'shieldDamageMult', 'secondaryRatio', 'buffMagnitude',
  'secondaryMagnitude', 'duration', 'maxTargets', 'charges', 'spAmount',
] as const;

const isNonEmptyStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateSkillDefinitions(raw: unknown): SkillDefinition[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { skills?: unknown }).skills)
      ? (raw as { skills: unknown[] }).skills
      : null;
  if (!rows) {
    console.warn('[skills] Invalid skills payload; expected { schemaVersion, skills: [] }.');
    return [];
  }

  const seenIds = new Set<string>();
  const droppedIds: string[] = [];
  const valid: SkillDefinition[] = [];

  rows.forEach((entry, idx) => {
    const r = entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>) : null;
    const label = r && isNonEmptyStr(r.id) ? r.id : `#${idx}`;
    if (!r) { droppedIds.push(label); return; }

    const resolvedIcon = r.registryTag === 'mod' && r.icon === undefined ? 'star' : r.icon;
    const baseOk =
      isNonEmptyStr(r.id) && !seenIds.has(r.id) &&
      typeof r.classScope === 'string' && VALID_CLASS_SCOPES.has(r.classScope as SkillClassScope) &&
      typeof r.category === 'string' && VALID_CATEGORIES.has(r.category as SkillCategory) &&
      typeof resolvedIcon === 'string' && VALID_ICON_KEYS.has(resolvedIcon as SkillIconKey) &&
      isFiniteNum(r.unlockLevel) && r.unlockLevel >= 1 &&
      isFiniteNum(r.spCost) && r.spCost >= 0 &&
      isFiniteNum(r.cooldown) && r.cooldown >= 0 &&
      typeof r.targetType === 'string' && VALID_TARGET_TYPES.has(r.targetType as SkillTargetType) &&
      typeof r.effectKind === 'string' && VALID_EFFECT_KINDS.has(r.effectKind as SkillEffectKind) &&
      OPTIONAL_NUMERIC_KEYS.every((k) => r[k] === undefined || isFiniteNum(r[k])) &&
      (r.oncePerBattle === undefined || typeof r.oncePerBattle === 'boolean') &&
      (r.isToggle === undefined || typeof r.isToggle === 'boolean') &&
      (r.phaseOverride === undefined || r.phaseOverride === 'step2' || r.phaseOverride === 'step3') &&
      (r.openingCardId === undefined || isNonEmptyStr(r.openingCardId)) &&
      (r.registryTag === undefined || r.registryTag === 'sys' || r.registryTag === 'mod');

    if (!baseOk) { droppedIds.push(label); return; }

    const hook = EFFECT_KIND_VALIDATORS[r.effectKind as SkillEffectKind];
    if (hook) {
      const hookErrs = hook(r);
      if (Array.isArray(hookErrs) && hookErrs.length > 0) {
        droppedIds.push(label);
        return;
      }
    }

    const id = r.id as string;
    seenIds.add(id);
    const registryTag: SkillRegistryTag = r.registryTag === 'mod' ? 'mod' : BUILTIN_SKILL_REGISTRY_TAG;
    valid.push({ ...(r as unknown as SkillDefinition), icon: resolvedIcon as SkillIconKey, registryTag });
  });

  if (droppedIds.length > 0) {
    console.warn(`[skills] Dropped ${droppedIds.length} invalid skill definition(s): ${droppedIds.join(', ')}`);
  }
  return valid;
}

export const SKILLS_LIST: SkillDefinition[] = validateSkillDefinitions(rawSkillsData);

export const SKILLS_CATALOG: Record<string, SkillDefinition> = SKILLS_LIST.reduce(
  (acc, skill) => {
    acc[skill.id] = skill;
    return acc;
  },
  {} as Record<string, SkillDefinition>
);

export function sanitizeSkillMods(
  raw: unknown,
  iconCatalogMods?: readonly IconCatalogModRow[] | null
): SkillModDefinition[] {
  if (!Array.isArray(raw)) return [];
  const droppedIds: string[] = [];
  const candidates: Record<string, unknown>[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const r = entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>) : null;
    const label = r && isNonEmptyStr(r.id) ? r.id : `#${i}`;
    if (
      !r || !isNonEmptyStr(r.id) || !SKILL_MOD_ID_REGEX.test(r.id) || seenIds.has(r.id) ||
      Boolean(SKILLS_CATALOG[r.id]) || (r.category !== 'normal' && r.category !== 'passive') ||
      typeof r.effectKind !== 'string' || !MOD_EFFECT_KINDS.includes(r.effectKind as SkillEffectKind) ||
      !isNonEmptyStr(r.nameVi) || !isNonEmptyStr(r.nameEn) || !isNonEmptyStr(r.descVi) || !isNonEmptyStr(r.descEn) ||
      !isNonEmptyStr(r.iconId) || !getCatalogRow(r.iconId.trim(), iconCatalogMods) ||
      !isFiniteNum(r.unlockLevel) || !isFiniteNum(r.spCost) || !isFiniteNum(r.cooldown)
    ) {
      droppedIds.push(label);
      continue;
    }
    seenIds.add(r.id);
    candidates.push({
      ...r,
      icon: r.icon ?? 'star',
      iconId: r.iconId.trim(),
      nameVi: r.nameVi.trim(),
      nameEn: r.nameEn.trim(),
      descVi: r.descVi.trim(),
      descEn: r.descEn.trim(),
      unlockLevel: Math.max(1, Math.min(100, Math.round(r.unlockLevel))),
      spCost: Math.max(0, Math.min(200, Math.round(r.spCost))),
      cooldown: Math.max(0, Math.min(10, Math.round(r.cooldown))),
      disabled: r.disabled ? true : undefined,
      registryTag: 'mod',
    });
    if (candidates.length >= MAX_SKILL_MODS) break;
  }

  if (droppedIds.length > 0) {
    console.warn(`[skills] Dropped ${droppedIds.length} invalid skill mod(s): ${droppedIds.join(', ')}`);
  }
  return validateSkillDefinitions(candidates) as SkillModDefinition[];
}

export type SkillModsSource = readonly SkillModDefinition[] | Pick<AdminConfig, 'skillMods'> | null | undefined;

function extractMods(source?: SkillModsSource): readonly SkillModDefinition[] {
  if (!source) return [];
  return Array.isArray(source) ? source : Array.isArray((source as Pick<AdminConfig, 'skillMods'>).skillMods) ? (source as Pick<AdminConfig, 'skillMods'>).skillMods! : [];
}

export function getEnabledSkillMods(source?: SkillModsSource): SkillModDefinition[] {
  const mods = extractMods(source);
  if (mods.length === 0) return [];
  const seen = new Set<string>();
  const active: SkillModDefinition[] = [];
  for (const mod of mods) {
    if (!mod || mod.disabled) continue;
    if (!isNonEmptyStr(mod.id) || SKILLS_CATALOG[mod.id] || seen.has(mod.id)) continue;
    if (mod.category !== 'normal' && mod.category !== 'passive') continue;
    if (!MOD_EFFECT_KINDS.includes(mod.effectKind)) continue;
    seen.add(mod.id);
    active.push(mod);
    if (active.length >= MAX_SKILL_MODS) break;
  }
  return active;
}

export function getMergedSkills(source?: SkillModsSource): SkillDefinition[] {
  const enabledMods = getEnabledSkillMods(source);
  return enabledMods.length === 0 ? SKILLS_LIST : [...SKILLS_LIST, ...enabledMods];
}

export const LEGACY_SKILL_ID_MAP: Record<string, string> = {
  overdrive_barrage: 'str_hotload_shells',
  phantom_volley: 'int_sabot_burst',
  orbital_railcannon: 'sge_anchor_protocol',
  aegis_pulse: 'sup_nanite_mend',
};

export const CLASS_STARTER_SKILLS: Record<MechClassId, string[]> = {
  striker: ['str_hotload_shells', 'gen_hull_brace'],
  siege: ['sge_anchor_protocol', 'gen_hull_brace'],
  interceptor: ['int_sabot_burst', 'gen_thruster_feint'],
  support: ['sup_nanite_mend', 'gen_hull_brace'],
};

const SKILL_CLASSES: readonly MechClassId[] = [
  'striker',
  'siege',
  'interceptor',
  'support',
];

export function getSkillCardId(
  skill: Pick<SkillDefinition, 'id' | 'openingCardId'>
): string {
  return skill.openingCardId || `card_${skill.id}`;
}

export function getClassKindCatalogSkills(
  classId: MechClassId,
  kind: 'active' | 'passive'
): SkillDefinition[] {
  return SKILLS_LIST.map((skill, catalogIndex) => ({ skill, catalogIndex }))
    .filter(
      ({ skill }) =>
        skill.classScope === classId &&
        (kind === 'passive'
          ? skill.category === 'passive'
          : skill.category !== 'passive')
    )
    .sort(
      (a, b) =>
        a.skill.unlockLevel - b.skill.unlockLevel ||
        a.catalogIndex - b.catalogIndex
    )
    .map(({ skill }) => skill);
}

export function sanitizeSkillTiersConfig(raw?: unknown): SkillTiersConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const result = {} as SkillTiersConfig;
  for (const classId of SKILL_CLASSES) {
    const classObj =
      obj[classId] && typeof obj[classId] === 'object' && !Array.isArray(obj[classId])
        ? (obj[classId] as Record<string, unknown>)
        : {};
    const defClass = DEFAULT_SKILL_TIERS_CONFIG[classId];
    const sanitizeKind = (kind: 'active' | 'passive') => {
      const total = getClassKindCatalogSkills(classId, kind).length;
      const defKind = defClass[kind];
      const kindObj =
        classObj[kind] &&
        typeof classObj[kind] === 'object' &&
        !Array.isArray(classObj[kind])
          ? (classObj[kind] as Record<string, unknown>)
          : {};
      const rawCredit = Number(kindObj.creditCount);
      const rawCard = Number(kindObj.cardCount);
      const baseCredit = Number.isFinite(rawCredit)
        ? Math.max(0, Math.floor(rawCredit))
        : defKind.creditCount;
      const baseCard = Number.isFinite(rawCard)
        ? Math.max(0, Math.floor(rawCard))
        : defKind.cardCount;
      const creditCount = Math.min(total, baseCredit);
      const cardCount = Math.min(Math.max(0, total - creditCount), baseCard);
      return { creditCount, cardCount };
    };
    result[classId] = {
      active: sanitizeKind('active'),
      passive: sanitizeKind('passive'),
    };
  }
  return result;
}

function resolveTiersConfig(
  cfgOrAdmin?: SkillTiersConfig | Pick<AdminConfig, 'skillTiers'> | null
): SkillTiersConfig {
  if (!cfgOrAdmin || typeof cfgOrAdmin !== 'object') {
    return DEFAULT_SKILL_TIERS_CONFIG;
  }
  if ('skillTiers' in cfgOrAdmin) {
    return sanitizeSkillTiersConfig(cfgOrAdmin.skillTiers);
  }
  if ('striker' in cfgOrAdmin) {
    return sanitizeSkillTiersConfig(cfgOrAdmin);
  }
  return DEFAULT_SKILL_TIERS_CONFIG;
}

export function getSkillTier(
  skill: SkillDefinition,
  classId: MechClassId,
  cfgOrAdmin?: SkillTiersConfig | Pick<AdminConfig, 'skillTiers'> | null
): SkillTierKind {
  if (skill.registryTag === 'mod' || skill.id.startsWith('mod_')) {
    return skill.tier ?? 'credit';
  }
  if (skill.classScope === 'general' || skill.id.startsWith('gen_')) {
    return 'credit';
  }
  if (CLASS_STARTER_SKILLS[classId]?.includes(skill.id)) {
    return 'credit';
  }

  const kind: 'active' | 'passive' =
    skill.category === 'passive' ? 'passive' : 'active';
  const sorted = getClassKindCatalogSkills(classId, kind);
  const idx = sorted.findIndex((s) => s.id === skill.id);
  if (idx < 0) return 'credit';

  const cfg = resolveTiersConfig(cfgOrAdmin)[classId][kind];
  if (idx < cfg.creditCount) return 'credit';
  if (idx >= sorted.length - cfg.cardCount) return 'card';
  return 'wp';
}

export function getBaseSkillCardCost(
  skill: Pick<SkillDefinition, 'category'>
): number {
  return skill.category === 'elite'
    ? BALANCE_CONFIG.openingCardCosts.elite
    : BALANCE_CONFIG.openingCardCosts.special;
}

export function getSkillCardPrice(
  card: Pick<OpeningCardDefinition, 'warPointCost'>,
  adminCfg?: Pick<AdminConfig, 'skillCardPriceMult'> | number | null
): number {
  const mult = sanitizeSkillCardPriceMult(
    typeof adminCfg === 'number' ? adminCfg : adminCfg?.skillCardPriceMult
  );
  return Math.max(1, Math.round(card.warPointCost * mult));
}

function buildOpeningCardForSkill(s: SkillDefinition): OpeningCardDefinition {
  return {
    id: getSkillCardId(s),
    skillId: s.id,
    classId: s.classScope as MechClassId,
    category: s.category as OpeningCardDefinition['category'],
    warPointCost: getBaseSkillCardCost(s),
  };
}

export function getOpeningCardsList(
  cfgOrAdmin?: SkillTiersConfig | Pick<AdminConfig, 'skillTiers'> | null
): OpeningCardDefinition[] {
  return SKILLS_LIST.filter(
    (s) =>
      s.classScope !== 'general' &&
      getSkillTier(s, s.classScope as MechClassId, cfgOrAdmin) === 'card'
  ).map(buildOpeningCardForSkill);
}

export const OPENING_CARDS_LIST: OpeningCardDefinition[] =
  getOpeningCardsList(DEFAULT_SKILL_TIERS_CONFIG);

export const OPENING_CARDS_BY_ID: Record<string, OpeningCardDefinition> =
  OPENING_CARDS_LIST.reduce((acc, card) => {
    acc[card.id] = card;
    return acc;
  }, {} as Record<string, OpeningCardDefinition>);

const ALL_SKILL_CARDS_BY_ID: Record<string, OpeningCardDefinition> =
  SKILLS_LIST.filter((s) => s.classScope !== 'general').reduce((acc, s) => {
    const card = buildOpeningCardForSkill(s);
    acc[card.id] = card;
    return acc;
  }, {} as Record<string, OpeningCardDefinition>);

export function getSkillById(skillId: string, source?: SkillModsSource): SkillDefinition | undefined {
  if (SKILLS_CATALOG[skillId]) return SKILLS_CATALOG[skillId];
  return getEnabledSkillMods(source).find((m) => m.id === skillId);
}

export function getOpeningCardById(
  cardId: string,
  _cfgOrAdmin?: SkillTiersConfig | Pick<AdminConfig, 'skillTiers'> | null
): OpeningCardDefinition | undefined {
  return OPENING_CARDS_BY_ID[cardId] ?? ALL_SKILL_CARDS_BY_ID[cardId];
}

export interface SkillScaleOptions {
  skillMaxLevel?: number;
  passiveScaleAfter5?: number;
  restorePctCap?: number;
}

export interface ScaledSkillStats {
  level: number;
  effectMult: number;
  spCost: number;
  cooldown: number;
  powerMultiplier: number;
  secondaryRatio: number;
  buffMagnitude: number;
  secondaryMagnitude: number;
  spAmount: number;
  passiveStats?: Array<PassiveStatEntry & { value: number }>;
  effects?: SkillEffectSpec[];
}

export function getScaledSkillStats(
  skill: SkillDefinition,
  level: number,
  adminOrOpts?: Pick<AdminConfig, 'skillMaxLevel' | 'passiveScaleAfter5' | 'restorePctCap'> | SkillScaleOptions | null
): ScaledSkillStats {
  const maxLv = getEffectiveSkillMaxLevel(adminOrOpts);
  const clampedLv = Math.max(1, Math.min(maxLv, Math.floor(level || 1)));
  const effectMult = 1 + (clampedLv - 1) * BALANCE_CONFIG.skillEffectScalePerLevel;

  if (skill.category === 'passive') {
    const scaleAfter5 = sanitizePassiveScaleAfter5(adminOrOpts?.passiveScaleAfter5);
    const passiveMult = clampedLv <= 5 ? clampedLv : 5 + (clampedLv - 5) * scaleAfter5;
    const restoreCap = sanitizeRestorePctCap(adminOrOpts?.restorePctCap);
    const scaledPassiveStats: Array<PassiveStatEntry & { value: number }> =
      Array.isArray(skill.passiveStats)
        ? skill.passiveStats.map((entry) => ({
            key: entry.key,
            perLevel: entry.perLevel,
            value: Number((entry.perLevel * passiveMult).toFixed(4)),
          }))
        : [];
    return {
      level: clampedLv, effectMult: passiveMult, spCost: 0, cooldown: 0, powerMultiplier: 0, secondaryRatio: 0,
      buffMagnitude: Number(((skill.buffMagnitude ?? 0) * passiveMult).toFixed(3)),
      secondaryMagnitude: Number(((skill.secondaryMagnitude ?? 0) * passiveMult).toFixed(3)),
      spAmount: Math.round((skill.spAmount ?? 0) * passiveMult),
      passiveStats: scaledPassiveStats,
      ...(skill.effectKind === 'spec'
        ? { effects: scaleSkillEffectSpecs(skill.effects, passiveMult, restoreCap) }
        : {}),
    };
  }

  const restoreCap = sanitizeRestorePctCap(adminOrOpts?.restorePctCap);
  let buffMagnitude = skill.buffMagnitude ? Number((skill.buffMagnitude * effectMult).toFixed(3)) : 0;
  let secondaryMagnitude = skill.secondaryMagnitude ? Number((skill.secondaryMagnitude * effectMult).toFixed(3)) : 0;
  if (skill.effectKind === 'heal_single' || skill.effectKind === 'heal_field_hot' || skill.effectKind === 'energize_shield_field') {
    buffMagnitude = Math.min(restoreCap, buffMagnitude);
  }
  if (skill.effectKind === 'toggle_siege_defense') {
    secondaryMagnitude = Math.min(restoreCap, secondaryMagnitude);
  }
  return {
    level: clampedLv, effectMult, spCost: skill.spCost, cooldown: skill.cooldown,
    powerMultiplier: skill.powerMultiplier ? Number((skill.powerMultiplier * effectMult).toFixed(2)) : 0,
    secondaryRatio: skill.secondaryRatio ? Number((skill.secondaryRatio * effectMult).toFixed(2)) : 0,
    buffMagnitude, secondaryMagnitude,
    spAmount: skill.spAmount ? Math.round(skill.spAmount * effectMult) : 0,
    ...(skill.effectKind === 'spec'
      ? { effects: scaleSkillEffectSpecs(skill.effects, effectMult, restoreCap) }
      : {}),
  };
}
