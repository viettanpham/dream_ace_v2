import { getCatalogRow } from './iconCatalog';
import rawSkillsData from './skills.json';
import type {
  AdminConfig, IconCatalogModRow, MechClassId, OpeningCardDefinition,
  SkillCategory, SkillClassScope, SkillDefinition, SkillEffectKind,
  SkillIconKey, SkillModDefinition, SkillRegistryTag, SkillTargetType,
} from '../types/game';
import { BALANCE_CONFIG, getEffectiveSkillMaxLevel, sanitizePassiveScaleAfter5, sanitizeRestorePctCap } from './balance';

export const BUILTIN_SKILL_REGISTRY_TAG = 'sys' as const;
export const MAX_SKILL_MODS = 100;
export const SKILL_MOD_ID_REGEX = /^mod_[a-z0-9_-]+$/;
export const EFFECT_KIND_VALIDATORS: Partial<Record<SkillEffectKind, (row: Record<string, unknown>) => string[]>> = {};
export const MOD_EFFECT_KINDS: SkillEffectKind[] = [];

const VALID_CLASS_SCOPES = new Set<SkillClassScope>(['general', 'striker', 'interceptor', 'siege', 'support']);
const VALID_CATEGORIES = new Set<SkillCategory>(['normal', 'special', 'elite', 'passive']);
const VALID_TARGET_TYPES = new Set<SkillTargetType>(['self', 'single_enemy', 'multi_enemy', 'all_enemies', 'single_ally', 'all_allies']);
const VALID_ICON_KEYS = new Set<SkillIconKey>([
  'shield', 'wind', 'flame', 'crosshair', 'target', 'zap', 'bomb', 'battery', 'ghost', 'orbit',
  'anchor', 'fortress', 'snowflake', 'shield_off', 'eye_off', 'ray', 'sword', 'rotate', 'corner_down_left', 'gauge',
  'radio', 'sparkles', 'skull', 'heart', 'radar', 'bolt', 'plus_circle', 'waves', 'swords', 'shield_plus',
  'feather', 'sun', 'cleanse', 'star',
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
  'passive_eva_spd', 'passive_sp_regen',
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

export const OPENING_CARDS_LIST: OpeningCardDefinition[] = SKILLS_LIST.filter(
  (s) => Boolean(s.openingCardId) && (s.category === 'special' || s.category === 'elite') && s.classScope !== 'general'
).map((s) => ({
  id: s.openingCardId!,
  skillId: s.id,
  classId: s.classScope as MechClassId,
  category: s.category as 'special' | 'elite',
  warPointCost: s.category === 'elite' ? BALANCE_CONFIG.openingCardCosts.elite : BALANCE_CONFIG.openingCardCosts.special,
}));

export const OPENING_CARDS_BY_ID: Record<string, OpeningCardDefinition> = OPENING_CARDS_LIST.reduce(
  (acc, card) => { acc[card.id] = card; return acc; },
  {} as Record<string, OpeningCardDefinition>
);

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

export function getSkillById(skillId: string, source?: SkillModsSource): SkillDefinition | undefined {
  if (SKILLS_CATALOG[skillId]) return SKILLS_CATALOG[skillId];
  return getEnabledSkillMods(source).find((m) => m.id === skillId);
}

export function getOpeningCardById(cardId: string): OpeningCardDefinition | undefined {
  return OPENING_CARDS_BY_ID[cardId];
}

export interface SkillScaleOptions {
  skillMaxLevel?: number;
  passiveScaleAfter5?: number;
  restorePctCap?: number;
}

export function getScaledSkillStats(
  skill: SkillDefinition,
  level: number,
  adminOrOpts?: Pick<AdminConfig, 'skillMaxLevel' | 'passiveScaleAfter5' | 'restorePctCap'> | SkillScaleOptions | null
) {
  const maxLv = getEffectiveSkillMaxLevel(adminOrOpts);
  const clampedLv = Math.max(1, Math.min(maxLv, Math.floor(level || 1)));
  const effectMult = 1 + (clampedLv - 1) * BALANCE_CONFIG.skillEffectScalePerLevel;

  if (skill.category === 'passive') {
    const scaleAfter5 = sanitizePassiveScaleAfter5(adminOrOpts?.passiveScaleAfter5);
    const passiveMult = clampedLv <= 5 ? clampedLv : 5 + (clampedLv - 5) * scaleAfter5;
    return {
      level: clampedLv, effectMult: passiveMult, spCost: 0, cooldown: 0, powerMultiplier: 0, secondaryRatio: 0,
      buffMagnitude: Number(((skill.buffMagnitude ?? 0) * passiveMult).toFixed(3)),
      secondaryMagnitude: Number(((skill.secondaryMagnitude ?? 0) * passiveMult).toFixed(3)),
      spAmount: Math.round((skill.spAmount ?? 0) * passiveMult),
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
  };
}
