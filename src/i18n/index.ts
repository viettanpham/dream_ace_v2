import { useCallback } from 'react';
import { AFFIX_SUFFIX_MAP, getItemTemplate } from '../data/items';
import { getDefaultSelectedNodeId, getMapNodeById } from '../data/maps';
import { getSkillById } from '../data/skills';
import { getStatusEntry } from '../data/statusEffects';
import { formatStatusChipShortValue } from '../data/statusIconMap';
import { getEnragePhaseDisplayName } from '../engine/enrage';
import { useGameStore } from '../store/useGameStore';
import type {
  ActiveStatusEffect,
  AutoStopReason,
  BattleSkillUsability,
  BuffCardKind,
  CombatLogEntry,
  CombatLogTag,
  CombatUnit,
  EnemyArchetype,
  EnragePhaseKey,
  EquipmentSlot,
  EquipValidationResult,
  ItemInstance,
  ItemRarity,
  Language,
  MechClassId,
  SectorDifficulty,
  SimpleTacticsConfig,
  SkillCategory,
  SkillDefinition,
  SkillModDefinition,
  SkillTargetType,
  StatKey,
  StatusEffectType,
  TacticsCondition,
  TacticsPresetId,
  TacticsRule,
  TacticsTargetSelector,
  TeamColorRole,
} from '../types/game';
import { BALANCE_CONFIG } from '../data/balance';
import { getBoxCapacity } from '../engine/migration';
import {
  clampDefeatStreakLimit,
  DEFAULT_DEFEAT_STREAK_LIMIT,
} from '../utils/battleDisplay';
import { EN_TRANSLATIONS, type TranslationKey } from './en';
import { VI_TRANSLATIONS } from './vi';

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = {
  vi: VI_TRANSLATIONS,
  en: EN_TRANSLATIONS,
};

export function formatMissingTranslationFallback(rawKey: string): string {
  const cleaned = String(rawKey ?? '').trim();
  if (!cleaned) return '';
  const tail = cleaned.includes('.')
    ? cleaned.slice(cleaned.lastIndexOf('.') + 1)
    : cleaned;
  const spaced = tail
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return cleaned;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function translate(
  lang: Language,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  try {
    if (useGameStore.getState()?.adminConfig?.showRawI18nKeys) {
      return key;
    }
  } catch {
    // Store may not be initialized during static module evaluation
  }
  const dict = DICTIONARIES[lang] ?? VI_TRANSLATIONS;
  const rawEntry =
    (dict as Record<string, string | undefined>)[key] ??
    (EN_TRANSLATIONS as Record<string, string | undefined>)[key];
  let text = rawEntry ?? formatMissingTranslationFallback(key);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function getClassName(lang: Language, classId: MechClassId): string {
  return translate(lang, `class.${classId}.name` as TranslationKey);
}

export function getClassCode(lang: Language, classId: MechClassId): string {
  return translate(lang, `class.${classId}.code` as TranslationKey);
}

export function getClassRole(lang: Language, classId: MechClassId): string {
  return translate(lang, `class.${classId}.role` as TranslationKey);
}

export function getClassDesc(lang: Language, classId: MechClassId): string {
  return translate(lang, `class.${classId}.desc` as TranslationKey);
}

export function getStatLabel(lang: Language, key: StatKey): string {
  return translate(lang, `stat.${key}.label` as TranslationKey);
}

export function getStatShort(lang: Language, key: StatKey): string {
  return translate(lang, `stat.${key}.short` as TranslationKey);
}

export function getStatDesc(lang: Language, key: StatKey): string {
  return translate(lang, `stat.${key}.desc` as TranslationKey);
}

export function getSkillName(
  lang: Language,
  skillId: string,
  skillMods?: readonly SkillModDefinition[] | null
): string;
export function getSkillName(skill: SkillDefinition, lang: Language): string;
export function getSkillName(
  langOrSkill: Language | SkillDefinition,
  skillOrLang: string | Language,
  skillMods?: readonly SkillModDefinition[] | null
): string {
  if (typeof langOrSkill !== 'string') {
    const skill = langOrSkill;
    const lang = skillOrLang as Language;
    if (skill.registryTag === 'mod') {
      const mod = skill as Partial<SkillModDefinition>;
      const inline = lang === 'vi' ? mod.nameVi : mod.nameEn;
      if (typeof inline === 'string' && inline.trim().length > 0) {
        return inline;
      }
    }
    return translate(lang, `skill.${skill.id}.name` as TranslationKey);
  }
  const lang = langOrSkill;
  const skillId = skillOrLang;
  const modSkill = getSkillById(skillId, skillMods);
  if (modSkill && modSkill.registryTag === 'mod') {
    const inline =
      lang === 'vi'
        ? (modSkill as SkillModDefinition).nameVi
        : (modSkill as SkillModDefinition).nameEn;
    if (typeof inline === 'string' && inline.trim().length > 0) {
      return inline;
    }
  }
  return translate(lang, `skill.${skillId}.name` as TranslationKey);
}

export function getSkillDesc(
  lang: Language,
  skillId: string,
  skillMods?: readonly SkillModDefinition[] | null
): string;
export function getSkillDesc(skill: SkillDefinition, lang: Language): string;
export function getSkillDesc(
  langOrSkill: Language | SkillDefinition,
  skillOrLang: string | Language,
  skillMods?: readonly SkillModDefinition[] | null
): string {
  if (typeof langOrSkill !== 'string') {
    const skill = langOrSkill;
    const lang = skillOrLang as Language;
    if (skill.registryTag === 'mod') {
      const mod = skill as Partial<SkillModDefinition>;
      const inline = lang === 'vi' ? mod.descVi : mod.descEn;
      if (typeof inline === 'string' && inline.trim().length > 0) {
        return inline;
      }
    }
    return translate(lang, `skill.${skill.id}.desc` as TranslationKey);
  }
  const lang = langOrSkill;
  const skillId = skillOrLang;
  const modSkill = getSkillById(skillId, skillMods);
  if (modSkill && modSkill.registryTag === 'mod') {
    const inline =
      lang === 'vi'
        ? (modSkill as SkillModDefinition).descVi
        : (modSkill as SkillModDefinition).descEn;
    if (typeof inline === 'string' && inline.trim().length > 0) {
      return inline;
    }
  }
  return translate(lang, `skill.${skillId}.desc` as TranslationKey);
}

export function getSkillCategoryLabel(
  lang: Language,
  category: SkillCategory
): string {
  return translate(lang, `skill.category.${category}` as TranslationKey);
}

export function getSkillTargetLabel(
  lang: Language,
  targetType: SkillTargetType
): string {
  return translate(lang, `skill.target.${targetType}` as TranslationKey);
}

export function getBattleSkillReason(
  lang: Language,
  usability: BattleSkillUsability
): string | null {
  if (usability.canUse) return null;
  return translate(lang, `battle.skillReason.${usability.reason}` as TranslationKey, {
    turns: usability.cooldownRemaining,
    cost: usability.spCost,
  });
}

function hasStaticTranslation(lang: Language, key: string): boolean {
  try {
    if (useGameStore.getState()?.adminConfig?.showRawI18nKeys) {
      return true;
    }
  } catch {
    // Store may not be initialized
  }
  const dict = DICTIONARIES[lang] ?? VI_TRANSLATIONS;
  return (
    (dict as Record<string, string | undefined>)[key] !== undefined ||
    (EN_TRANSLATIONS as Record<string, string | undefined>)[key] !== undefined
  );
}

export function getSectorName(lang: Language, sectorId: string): string {
  const key = `sector.${sectorId}.name` as TranslationKey;
  if (hasStaticTranslation(lang, key)) {
    return translate(lang, key);
  }
  const node = getMapNodeById(sectorId);
  if (node) {
    if (lang === 'en' && node.name === 'Liên Minh VSS') {
      return 'VSS Alliance';
    }
    if (lang === 'vi' && node.name === 'VSS Alliance') {
      return 'Liên Minh VSS';
    }
    if (lang === 'en' && node.name === 'Rãnh Void Sovereign') {
      return 'Void Sovereign Trench';
    }
    if (lang === 'vi' && node.name === 'Void Sovereign Trench') {
      return 'Rãnh Void Sovereign';
    }
    if (lang === 'en' && node.name.startsWith('Căn cứ ')) {
      return `Base ${node.name.slice('Căn cứ '.length)}`;
    }
    if (lang === 'vi' && node.name.startsWith('Base ')) {
      return `Căn cứ ${node.name.slice('Base '.length)}`;
    }
    return node.name;
  }
  return translate(lang, key);
}

export function getSectorRegion(lang: Language, sectorId: string): string {
  const key = `sector.${sectorId}.region` as TranslationKey;
  if (hasStaticTranslation(lang, key)) {
    return translate(lang, key);
  }
  const node = getMapNodeById(sectorId);
  if (node?.regionCode) return node.regionCode;
  return translate(lang, key);
}

export function getSectorDesc(lang: Language, sectorId: string): string {
  const key = `sector.${sectorId}.desc` as TranslationKey;
  if (hasStaticTranslation(lang, key)) {
    return translate(lang, key);
  }
  const node = getMapNodeById(sectorId);
  if (node?.description) return node.description;
  return translate(lang, key);
}

export function getDifficultyLabel(
  lang: Language,
  difficulty: SectorDifficulty
): string {
  return translate(lang, `difficulty.${difficulty}` as TranslationKey);
}

export function getSlotLabel(lang: Language, slot: EquipmentSlot): string {
  return translate(lang, `slot.${slot}` as TranslationKey);
}

export function getSlotShort(lang: Language, slot: EquipmentSlot): string {
  return translate(lang, `slotShort.${slot}` as TranslationKey);
}

export function getRarityLabel(lang: Language, rarity: ItemRarity): string {
  return translate(lang, `rarity.${rarity}` as TranslationKey);
}

export function getStatusLabel(
  lang: Language,
  status: StatusEffectType
): string {
  return translate(lang, `status.${status}` as TranslationKey);
}

/**
 * S1a: Reads status name from statusEffects registry first when `registryId` is present,
 * falling back to the existing `status.<type>` i18n key.
 */
export function getStatusDisplayName(
  lang: Language,
  status: StatusEffectType,
  registryId?: string
): string {
  if (registryId) {
    const entry = getStatusEntry(registryId);
    if (entry) return lang === 'vi' ? entry.nameVi : entry.nameEn;
  }
  return getStatusLabel(lang, status);
}

export function getStatusDesc(
  lang: Language,
  status: StatusEffectType,
  turns?: number
): string {
  return translate(lang, `status.${status}.desc` as TranslationKey, {
    n: Math.max(1, turns ?? 1),
  });
}

const STATUS_SHORT_LABELS: Record<
  StatusEffectType,
  { en: string; vi: string }
> = {
  burn: { en: 'Burn', vi: 'Thiêu' },
  shield_break: { en: 'ShdDown', vi: 'KhiênVỡ' },
  shield_cracked: { en: 'Cracked', vi: 'KhiênNứt' },
  slow: { en: 'Slow', vi: 'Chậm' },
  silence: { en: 'Silence', vi: 'Câm' },
  stealth: { en: 'Stealth', vi: 'Ẩn' },
  vulnerable: { en: 'Vuln', vi: 'TổnTh' },
  def_up: { en: 'DEF+', vi: 'THỦ+' },
  def_down: { en: 'DEF-', vi: 'THỦ-' },
  eva_up: { en: 'EVA+', vi: 'NÉ+' },
  atk_up: { en: 'ATK+', vi: 'CÔNG+' },
  spd_up: { en: 'SPD+', vi: 'TỐC+' },
  primary_dmg_up: { en: 'WPN+', vi: 'VK+' },
  skill_dmg_up: { en: 'SKL+', vi: 'KN+' },
  sure_hit: { en: 'Lock', vi: 'Khóa' },
  counter: { en: 'Riposte', vi: 'Phản' },
  evade_all: { en: 'Mirage', vi: 'ẢoẢnh' },
  invincible: { en: 'Stasis', vi: 'BấtTử' },
  regen_hp: { en: 'Regen', vi: 'HồiHP' },
  siege_mode: { en: 'Siege', vi: 'Pháo' },
  siege_defense: { en: 'Bastion', vi: 'PháoĐài' },
  charging: { en: 'Charge', vi: 'Nạp' },
  registry_effect: { en: 'Effect', vi: 'Hiệu ứng' },
};

export function getStatusShortLabel(
  lang: Language,
  status: StatusEffectType
): string {
  const pair = STATUS_SHORT_LABELS[status];
  if (pair) return lang === 'vi' ? pair.vi : pair.en;
  return getStatusLabel(lang, status);
}

export interface StatusEffectDetail {
  label: string;
  valueText: string;
  durationText: string | null;
  shortText: string;
  fullText: string;
}

/**
 * Computes human-readable status chip text directly from real engine state & BALANCE_CONFIG.
 * Examples:
 *  - VI: "Làm chậm: -30% Tốc (2 lượt)", "Vỡ Khiên: Khóa Khiên (2 lượt)", "Hồi HP: +93/lượt"
 *  - EN: "Slow: -30% SPD (2t)", "Shield Break: Shields off (2t)", "Regen HP: +93/t"
 */
export function formatStatusEffectDetail(
  lang: Language,
  st: ActiveStatusEffect,
  unit?: CombatUnit | null
): StatusEffectDetail {
  const isVi = lang === 'vi';
  const label = getStatusDisplayName(lang, st.type, st.registryId);
  const maxHp = unit?.derived?.maxHp ?? 0;

  let valueText = '';
  let includeTurns = st.turnsRemaining > 0 && st.turnsRemaining < 50;

  switch (st.type) {
    case 'burn': {
      if (maxHp > 0) {
        const dmg = Math.max(
          5,
          Math.round(maxHp * BALANCE_CONFIG.burnDamageRatio)
        );
        valueText = isVi ? `-${dmg} HP/lượt` : `-${dmg} HP/t`;
      } else {
        const pct = Math.round(BALANCE_CONFIG.burnDamageRatio * 100);
        valueText = isVi ? `-${pct}% HP/lượt` : `-${pct}% HP/t`;
      }
      break;
    }
    case 'regen_hp': {
      const ratio = st.magnitude ?? 0.1;
      if (maxHp > 0) {
        const heal = Math.max(4, Math.round(maxHp * ratio));
        valueText = isVi ? `+${heal}/lượt` : `+${heal}/t`;
      } else {
        const pct = Math.round(ratio * 100);
        valueText = isVi ? `+${pct}% HP/lượt` : `+${pct}% HP/t`;
      }
      break;
    }
    case 'slow': {
      const pct = Math.round(
        (st.magnitude ?? BALANCE_CONFIG.slowSpeedPenalty) * 100
      );
      valueText = isVi ? `-${pct}% Tốc` : `-${pct}% SPD`;
      break;
    }
    case 'spd_up': {
      const pct = Math.round((st.magnitude ?? 0.5) * 100);
      valueText = isVi ? `+${pct}% Tốc` : `+${pct}% SPD`;
      break;
    }
    case 'def_up': {
      const pct = Math.round((st.magnitude ?? 0.25) * 100);
      valueText = isVi ? `+${pct}% Giáp` : `+${pct}% DEF`;
      break;
    }
    case 'def_down': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100);
      valueText = isVi ? `-${pct}% Giáp` : `-${pct}% DEF`;
      break;
    }
    case 'atk_up': {
      const pct = Math.round((st.magnitude ?? 0.2) * 100);
      valueText = isVi ? `+${pct}% Công` : `+${pct}% ATK`;
      break;
    }
    case 'primary_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100);
      valueText = isVi ? `+${pct}% ST thường` : `+${pct}% Primary`;
      break;
    }
    case 'skill_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100);
      valueText = isVi ? `+${pct}% ST kỹ năng` : `+${pct}% Skill DMG`;
      break;
    }
    case 'eva_up': {
      // Exact engine formula in combat.ts: dodge += Math.round((mag ?? 0.25) * 40)
      const bonusPct = Math.round((st.magnitude ?? 0.25) * 40);
      valueText = isVi ? `+${bonusPct}% Né` : `+${bonusPct}% EVA`;
      break;
    }
    case 'vulnerable': {
      const pct = Math.round((st.magnitude ?? 0.15) * 100);
      valueText = isVi ? `+${pct}% ST nhận` : `+${pct}% DMG taken`;
      break;
    }
    case 'shield_break': {
      const turns = Math.max(1, st.turnsRemaining || 1);
      valueText = isVi
        ? `Khởi động lại ${turns} lượt`
        : `Restarting ${turns} turn(s)`;
      includeTurns = false;
      break;
    }
    case 'shield_cracked': {
      const mult =
        st.magnitude && st.magnitude >= 1 ? Number(st.magnitude.toFixed(2)) : 1.3;
      valueText = isVi ? `x${mult} ST lên khiên` : `x${mult} shield dmg`;
      break;
    }
    case 'silence': {
      valueText = isVi ? 'Khóa kỹ năng' : 'Skills locked';
      break;
    }
    case 'stealth': {
      valueText = isVi ? 'Không thể nhắm' : 'Untargetable';
      break;
    }
    case 'evade_all': {
      valueText = isVi ? 'Né 100%' : '100% Evade';
      break;
    }
    case 'invincible': {
      valueText = isVi ? 'Miễn sát thương' : '0 DMG taken';
      break;
    }
    case 'sure_hit': {
      const charges = st.charges ?? 1;
      valueText = isVi ? `Chắc trúng (${charges} lần)` : `Sure hit (${charges}x)`;
      if (st.turnsRemaining >= 50) includeTurns = false;
      break;
    }
    case 'counter': {
      const pct = Math.round((st.magnitude ?? 1.0) * 100);
      const charges = st.charges ?? 1;
      valueText = isVi
        ? `Phản ${pct}% (${charges} lần)`
        : `Counter ${pct}% (${charges}x)`;
      if (st.turnsRemaining >= 50) includeTurns = false;
      break;
    }
    case 'siege_mode': {
      const pct = Math.round((st.magnitude ?? 0.6) * 100);
      valueText = isVi ? `+${pct}% ST, 0% Né` : `+${pct}% DMG, 0 EVA`;
      includeTurns = false;
      break;
    }
    case 'siege_defense': {
      const pct = Math.round((st.magnitude ?? 0.8) * 100);
      valueText = isVi ? `+${pct}% Giáp, -30% ST` : `+${pct}% DEF, -30% DMG`;
      includeTurns = false;
      break;
    }
    case 'charging': {
      valueText = isVi ? 'Khai hỏa lượt sau' : 'Fires next turn';
      includeTurns = false;
      break;
    }
    case 'registry_effect': {
      const shortVal = formatStatusChipShortValue(lang, st, unit);
      valueText = shortVal === label ? '' : shortVal;
      break;
    }
  }

  const durationText = includeTurns
    ? isVi
      ? `(${st.turnsRemaining} lượt)`
      : `(${st.turnsRemaining}t)`
    : null;

  const fullText = valueText
    ? durationText
      ? `${label}: ${valueText} ${durationText}`
      : `${label}: ${valueText}`
    : durationText
    ? `${label} ${durationText}`
    : label;

  const shortLabel =
    st.type === 'registry_effect' && st.registryId
      ? label
      : getStatusShortLabel(lang, st.type);
  const shortText = valueText ? `${shortLabel}: ${valueText}` : shortLabel;

  return {
    label,
    valueText,
    durationText,
    shortText,
    fullText,
  };
}

export function getArchetypeLabel(
  lang: Language,
  archetype: EnemyArchetype
): string {
  return translate(lang, `archetype.${archetype}` as TranslationKey);
}

export function getTeamTagLabel(lang: Language, role: TeamColorRole): string {
  if (role === 'me' || role === 'ally') {
    return translate(lang, 'queue.teamTag.ally');
  }
  if (role === 'boss') {
    return translate(lang, 'queue.teamTag.boss');
  }
  return translate(lang, 'queue.teamTag.enemy');
}

export function getAutoStopReasonLabel(
  lang: Language,
  reason: AutoStopReason,
  streakLimit: number = DEFAULT_DEFEAT_STREAK_LIMIT,
  boxCapacity?: number
): string {
  const max =
    typeof boxCapacity === 'number' && Number.isFinite(boxCapacity)
      ? Math.max(1, Math.round(boxCapacity))
      : getBoxCapacity(useGameStore.getState()?.adminConfig);
  return translate(lang, `auto.repeatReason.${reason}` as TranslationKey, {
    max,
    streak: clampDefeatStreakLimit(streakLimit),
  });
}

export function getTacticsPresetLabel(
  lang: Language,
  presetId: TacticsPresetId
): string {
  return translate(lang, `auto.preset.${presetId}` as TranslationKey);
}

export function getTacticsTargetLabel(
  lang: Language,
  selector: TacticsTargetSelector
): string {
  return translate(lang, `auto.target.${selector}` as TranslationKey);
}

export function formatTacticsConditionText(
  lang: Language,
  cond: TacticsCondition
): string {
  const buffLabel = cond.buffType ? getStatusLabel(lang, cond.buffType) : '';
  const skillLabel = cond.skillId ? getSkillName(lang, cond.skillId) : '—';
  return translate(lang, `auto.cond.${cond.kind}` as TranslationKey, {
    value: cond.value ?? 0,
    buff: buffLabel,
    skill: skillLabel,
  });
}

export function formatTacticsRuleSentence(
  lang: Language,
  rule: TacticsRule
): string {
  const ifWord = translate(lang, 'auto.colIf');
  const condStr = formatTacticsConditionText(lang, rule.condition);
  const actionStr =
    rule.action.type === 'defend'
      ? translate(lang, 'auto.actionDefend')
      : rule.action.type === 'skill' && rule.action.skillId
      ? getSkillName(lang, rule.action.skillId)
      : translate(lang, 'auto.actionAttack');
  const targetStr = getTacticsTargetLabel(lang, rule.targetSelector);
  return `${ifWord} ${condStr} → ${actionStr} → ${targetStr}`;
}

export function getStatsSkillLabel(lang: Language, skillKey: string): string {
  if (skillKey === 'basic_attack' || !skillKey) {
    return translate(lang, 'stats.basicAttack');
  }
  if (skillKey === 'defend') {
    return translate(lang, 'stats.defendAction');
  }
  if (skillKey === 'regen_hp') {
    return translate(lang, 'stats.regenTick');
  }
  return getSkillName(lang, skillKey);
}

/**
 * Generates a natural plain-language sentence describing what Simple Auto will do.
 */
export function formatSimpleTacticsSummary(
  lang: Language,
  config: SimpleTacticsConfig
): string {
  const targetLabel = translate(
    lang,
    `auto.simple.target.${config.preferredTarget}` as TranslationKey
  ).toLowerCase();
  const firstSkill = config.prioritySkillIds[0]
    ? getSkillName(lang, config.prioritySkillIds[0])
    : null;
  const skillUsageClauseEn =
    config.skillUsage === 'save_sp_50'
      ? 'only cast skills above 50% SP'
      : config.skillUsage === 'needed_only'
      ? 'only cast skills when needed'
      : firstSkill
      ? `prioritize ${firstSkill}`
      : 'use equipped skills whenever ready';
  const skillUsageClauseVi =
    config.skillUsage === 'save_sp_50'
      ? 'chỉ dùng kỹ năng khi trên 50% SP'
      : config.skillUsage === 'needed_only'
      ? 'chỉ dùng kỹ năng khi thật sự cần'
      : firstSkill
      ? `ưu tiên tung ${firstSkill}`
      : 'dùng kỹ năng ngay khi sẵn sàng';

  const lowHpClauseEn =
    config.lowHpAction === 'defend'
      ? `defend below ${config.lowHpThresholdPct}% HP`
      : config.lowHpAction === 'heal'
      ? `heal itself below ${config.lowHpThresholdPct}% HP`
      : config.lowHpAction === 'retreat'
      ? `auto-retreat below ${config.lowHpThresholdPct}% HP`
      : 'keep attacking even at low HP';
  const lowHpClauseVi =
    config.lowHpAction === 'defend'
      ? `phòng thủ khi HP dưới ${config.lowHpThresholdPct}%`
      : config.lowHpAction === 'heal'
      ? `tự hồi phục khi HP dưới ${config.lowHpThresholdPct}%`
      : config.lowHpAction === 'retreat'
      ? `tự rút lui khi HP dưới ${config.lowHpThresholdPct}%`
      : 'tiếp tục tấn công dù HP thấp';

  const eliteClauseEn =
    config.elitePolicy === 'boss_only'
      ? 'save Elite skills for bosses'
      : config.elitePolicy === 'immediate'
      ? 'fire Elite skills immediately'
      : 'leave Elite skills for manual use';
  const eliteClauseVi =
    config.elitePolicy === 'boss_only'
      ? 'để dành kỹ năng Tinh Anh cho Boss'
      : config.elitePolicy === 'immediate'
      ? 'tung kỹ năng Tinh Anh ngay khi sẵn sàng'
      : 'không tự động dùng kỹ năng Tinh Anh';

  if (lang === 'vi') {
    return `Auto sẽ ưu tiên mục tiêu ${targetLabel}, ${skillUsageClauseVi}, ${lowHpClauseVi}, và ${eliteClauseVi}.`;
  }
  return `Auto will focus the ${targetLabel} enemy, ${skillUsageClauseEn}, ${lowHpClauseEn}, and ${eliteClauseEn}.`;
}

/**
 * Formats randomized ItemInstance name: Template Name + Affix-based Suffix (+Enchant).
 */
export function getItemInstanceName(
  lang: Language,
  instance: ItemInstance,
  includeEnchant = false
): string {
  const tpl = getItemTemplate(instance.templateId);
  const baseName = tpl
    ? lang === 'vi'
      ? tpl.nameVi
      : tpl.nameEn
    : instance.templateId;
  const suffixMeta = instance.suffixId
    ? AFFIX_SUFFIX_MAP[instance.suffixId]
    : null;
  const suffixText = suffixMeta
    ? lang === 'vi'
      ? ` ${suffixMeta.vi}`
      : ` ${suffixMeta.en}`
    : '';
  const enchantText =
    includeEnchant && instance.enchantLevel > 0
      ? ` +${instance.enchantLevel}`
      : '';
  return `${baseName}${suffixText}${enchantText}`;
}

export function getItemInstanceDesc(
  lang: Language,
  instance: ItemInstance
): string {
  const tpl = getItemTemplate(instance.templateId);
  if (!tpl) return '';
  return lang === 'vi' ? tpl.descVi : tpl.descEn;
}

export function formatItemTraitsList(
  lang: Language,
  instance: ItemInstance
): string[] {
  const tr = instance.specialTraits;
  if (!tr) return [];
  const list: string[] = [];
  if (tr.critBonusPct) {
    list.push(translate(lang, 'trait.crit', { val: tr.critBonusPct }));
  }
  if (tr.armorPiercePct) {
    list.push(translate(lang, 'trait.pierce', { val: tr.armorPiercePct }));
  }
  if (tr.splashPct) {
    list.push(translate(lang, 'trait.splash', { val: tr.splashPct }));
  }
  if (tr.spRegenPerTurn) {
    list.push(translate(lang, 'trait.spRegen', { val: tr.spRegenPerTurn }));
  }
  if (tr.evasionMod) {
    list.push(
      translate(lang, 'trait.evasionMod', {
        val: tr.evasionMod > 0 ? `+${tr.evasionMod}` : tr.evasionMod,
      })
    );
  }
  if (tr.longRange) {
    list.push(translate(lang, 'trait.longRange'));
  }
  if (tr.accuracyPct) {
    list.push(translate(lang, 'trait.accuracy', { val: tr.accuracyPct }));
  }
  if (tr.detectStealth) {
    list.push(translate(lang, 'trait.detectStealth'));
  }
  return list;
}

export function getLogTagLabel(lang: Language, tag: CombatLogTag): string {
  return translate(lang, `log.tag.${tag}` as TranslationKey);
}

export function formatEquipValidationReason(
  lang: Language,
  validation: EquipValidationResult
): string | null {
  if (validation.canEquip) return null;
  const parts: string[] = [];
  if (validation.missingLevel !== null) {
    parts.push(translate(lang, 'common.reqLevel', { level: validation.missingLevel }));
  }
  if (validation.requiredClass !== null) {
    parts.push(
      translate(lang, 'common.reqClass', {
        className: getClassName(lang, validation.requiredClass),
      })
    );
  }
  if (validation.equippedOnOtherGear !== null) {
    parts.push(
      translate(lang, 'common.equippedOnGear', {
        gear: getClassName(lang, validation.equippedOnOtherGear),
      })
    );
  }
  return parts.join(' · ');
}

export function formatCombatLogMessage(
  lang: Language,
  entry: CombatLogEntry
): string {
  const autoPrefix =
    entry.autoRuleNumber !== undefined
      ? entry.autoRuleNumber > 0
        ? `[AUTO #${entry.autoRuleNumber}] `
        : '[AUTO] '
      : '';
  return `${autoPrefix}${formatCombatLogBody(lang, entry)}`;
}

function formatCombatLogBody(
  lang: Language,
  entry: CombatLogEntry
): string {
  const p = entry.params;

  switch (entry.templateKey) {
    case 'log.battleStart': {
      const sectorId = String(p.sectorId ?? getDefaultSelectedNodeId());
      const diff = String(p.difficulty ?? 'Standard') as SectorDifficulty;
      return translate(lang, 'log.battleStart', {
        sector: getSectorName(lang, sectorId),
        difficulty: getDifficultyLabel(lang, diff),
      });
    }

    case 'log.sectorSupply': {
      const n = Math.max(0, Math.min(100, Math.round(Number(p.n ?? 100))));
      return translate(lang, 'log.sectorSupply', { n });
    }

    case 'log.enragePhaseActivated': {
      const phase = String(p.phase ?? 'rage') as EnragePhaseKey;
      const round = Math.max(1, Math.floor(Number(p.round ?? entry.round ?? 1)));
      return translate(lang, 'log.enragePhaseActivated', {
        round,
        phase: getEnragePhaseDisplayName(phase, lang),
      });
    }

    case 'log.prestageConfirm':
      return translate(lang, 'log.prestageConfirm');

    case 'log.defend': {
      const shd = Number(p.shieldRecovered ?? 0);
      const sp = Number(p.spRecovered ?? 0);
      const shieldPart =
        shd > 0 ? `, +${shd} ${getStatShort(lang, 'shield')}` : '';
      const spPart = sp > 0 ? `, +${sp} SP` : '';
      return translate(lang, 'log.defend', {
        actor: String(p.actor ?? ''),
        shieldPart,
        spPart,
      });
    }

    case 'log.healSquad': {
      const skillId = String(p.skillId ?? 'sup_aegis_field');
      return translate(lang, 'log.healSquad', {
        actor: String(p.actor ?? ''),
        skill: getSkillName(lang, skillId),
        spCost: Number(p.spCost ?? 0),
        total: Number(p.total ?? 0),
      });
    }

    case 'log.healSingle': {
      const skillId = String(p.skillId ?? 'sup_nanite_mend');
      return translate(lang, 'log.healSingle', {
        actor: String(p.actor ?? ''),
        target: String(p.target ?? ''),
        skill: getSkillName(lang, skillId),
        amount: Number(p.amount ?? 0),
      });
    }

    case 'log.shieldSingle': {
      const skillId = String(p.skillId ?? 'sup_energize_target');
      return translate(lang, 'log.shieldSingle', {
        actor: String(p.actor ?? ''),
        target: String(p.target ?? ''),
        skill: getSkillName(lang, skillId),
        amount: Number(p.amount ?? 0),
      });
    }

    case 'log.energize': {
      const skillId = String(p.skillId ?? 'sup_flux_transfer');
      return translate(lang, 'log.energize', {
        actor: String(p.actor ?? ''),
        target: String(p.target ?? ''),
        skill: getSkillName(lang, skillId),
        amount: Number(p.amount ?? 0),
      });
    }

    case 'log.spTransfer': {
      return translate(lang, 'log.spTransfer', {
        actor: String(p.actor ?? ''),
        amount: Number(p.amount ?? 0),
        count: Number(p.count ?? 0),
        fee: Number(p.fee ?? 0),
      });
    }

    case 'log.useSupply': {
      const tplId = String(p.templateId ?? '');
      const supplyKey = `supply.${tplId}.name` as TranslationKey;
      const resolvedSupply = translate(lang, supplyKey);
      const supplyName =
        resolvedSupply === supplyKey ? tplId : resolvedSupply;
      const hp = Math.max(0, Number(p.hp ?? 0));
      const shield = Math.max(0, Number(p.shield ?? 0));
      const sp = Math.max(0, Number(p.sp ?? 0));
      const resetIdsRaw = String(p.resetSkillIds ?? '').trim();
      const cleansed = Math.max(0, Number(p.cleansed ?? 0));
      const dodge = Math.max(0, Number(p.dodge ?? 0));
      const dodgeRounds = Math.max(1, Number(p.dodgeRounds ?? 1));
      const speedPct = Math.max(0, Number(p.speedPct ?? 0));
      const speedRounds = Math.max(1, Number(p.speedRounds ?? 3));

      const parts: string[] = [];
      if (hp > 0) parts.push(`HP +${hp}`);
      if (shield > 0) parts.push(`SHD +${shield}`);
      if (sp > 0) parts.push(`SP +${sp}`);
      if (resetIdsRaw) {
        const skillNames = resetIdsRaw
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .map((id) => getSkillName(lang, id))
          .join(', ');
        if (skillNames) {
          parts.push(
            lang === 'vi'
              ? `Reset hồi chiêu: ${skillNames}`
              : `Reset cooldown: ${skillNames}`
          );
        }
      }
      if (cleansed > 0) {
        parts.push(
          lang === 'vi'
            ? `Thanh tẩy ${cleansed} hiệu ứng xấu`
            : `Cleansed ${cleansed} debuff(s)`
        );
      }
      if (dodge > 0) {
        parts.push(
          lang === 'vi'
            ? `Né +${dodge}% (${dodgeRounds} vòng)`
            : `Dodge +${dodge}% (${dodgeRounds} ${dodgeRounds === 1 ? 'round' : 'rounds'})`
        );
      }
      if (speedPct > 0) {
        parts.push(
          lang === 'vi'
            ? `Tốc độ +${speedPct}% (${speedRounds} vòng)`
            : `Speed +${speedPct}% (${speedRounds} ${speedRounds === 1 ? 'round' : 'rounds'})`
        );
      }

      const gains = parts.length > 0 ? parts.join(', ') : 'HP +0';
      return translate(lang, 'log.useSupply', {
        actor: String(p.actor ?? ''),
        supply: supplyName,
        gains,
      });
    }

    case 'log.supplyScanReveal': {
      const names = String(p.revealedNames ?? '').trim();
      if (!names) {
        return translate(lang, 'log.supplyScanNone');
      }
      return translate(lang, 'log.supplyScanReveal', { names });
    }

    case 'log.supplyScanNone': {
      return translate(lang, 'log.supplyScanNone');
    }

    case 'log.supplyDrop':
    case 'log.supplyDropLost': {
      const tplId = String(p.templateId ?? '');
      const supplyKey = `supply.${tplId}.name` as TranslationKey;
      const resolvedSupply = translate(lang, supplyKey);
      const name =
        tplId === 'supply_crate'
          ? translate(lang, 'consumable.supply_crate.name')
          : resolvedSupply === supplyKey
            ? tplId
            : resolvedSupply;
      if (entry.templateKey === 'log.supplyDropLost') {
        return translate(lang, 'log.supplyDropLost', {
          name,
          lost: Math.max(0, Number(p.lost ?? 0)),
          cap: Math.max(1, Number(p.cap ?? 99)),
        });
      }
      return translate(lang, 'log.supplyDrop', {
        name,
        qty: Math.max(0, Number(p.qty ?? 0)),
      });
    }

    case 'log.emergencyResupplyAlly':
      return translate(lang, 'log.emergencyResupplyAlly');

    case 'log.emergencyResupplyEnemy':
      return translate(lang, 'log.emergencyResupplyEnemy');

    case 'log.evade': {
      const actionText = formatActionParam(lang, p);
      return translate(lang, 'log.evade', {
        target: String(p.target ?? ''),
        actor: String(p.actor ?? ''),
        action: actionText,
      });
    }

    case 'log.damage': {
      const actionText = formatActionParam(lang, p);
      const shd = Number(p.shieldAbsorbed ?? 0);
      const hp = Number(p.hullDamage ?? 0);
      const breakdown =
        shd > 0 && hp > 0
          ? translate(lang, 'log.breakdownBoth', { shield: shd, hp })
          : shd > 0
          ? translate(lang, 'log.breakdownShield', { shield: shd })
          : translate(lang, 'log.breakdownHp', { hp });
      const rawShieldMult = Number(p.shieldMult ?? 1);
      const shieldMultTag =
        Number.isFinite(rawShieldMult) && rawShieldMult > 1
          ? translate(lang, 'log.shieldMultTag', {
              mult: Number(rawShieldMult.toFixed(2)),
            })
          : '';
      const critTag = Number(p.isCrit ?? 0)
        ? translate(lang, 'log.critTag')
        : '';
      const defendTag = Number(p.isDefending ?? 0)
        ? translate(lang, 'log.defendTag')
        : '';

      return translate(lang, 'log.damage', {
        actor: String(p.actor ?? ''),
        action: actionText,
        target: String(p.target ?? ''),
        breakdown,
        shieldMultTag,
        critTag,
        defendTag,
      });
    }

    case 'log.destroyed': {
      const classId = String(p.classId ?? 'striker') as MechClassId;
      return translate(lang, 'log.destroyed', {
        target: String(p.target ?? ''),
        className: getClassName(lang, classId),
      });
    }

    case 'log.statusApplied': {
      const status = String(p.status ?? 'burn') as StatusEffectType;
      const registryId = p.registryId ? String(p.registryId) : undefined;
      return translate(lang, 'log.statusApplied', {
        target: String(p.target ?? ''),
        status: getStatusDisplayName(lang, status, registryId),
        turns: Number(p.turns ?? 2),
      });
    }

    case 'log.shieldCrackNoShield':
      return translate(lang, 'log.shieldCrackNoShield', {
        target: String(p.target ?? ''),
      });

    case 'log.shieldBreakBlocked':
      return translate(lang, 'log.shieldBreakBlocked', {
        target: String(p.target ?? ''),
      });

    case 'log.burnTick':
      return translate(lang, 'log.burnTick', {
        target: String(p.target ?? ''),
        damage: Number(p.damage ?? 0),
      });

    case 'log.regenTick':
      return translate(lang, 'log.regenTick', {
        target: String(p.target ?? ''),
        amount: Number(p.amount ?? 0),
      });

    case 'log.registryDotTick': {
      const registryId = p.registryId ? String(p.registryId) : undefined;
      return translate(lang, 'log.registryDotTick', {
        target: String(p.target ?? ''),
        damage: Number(p.damage ?? 0),
        resource: String(p.resource ?? 'HP'),
        status: getStatusDisplayName(lang, 'registry_effect', registryId),
      });
    }

    case 'log.registryHotTick': {
      const registryId = p.registryId ? String(p.registryId) : undefined;
      return translate(lang, 'log.registryHotTick', {
        target: String(p.target ?? ''),
        amount: Number(p.amount ?? 0),
        resource: String(p.resource ?? 'HP'),
        status: getStatusDisplayName(lang, 'registry_effect', registryId),
      });
    }

    case 'log.controlResisted': {
      const registryId = p.registryId ? String(p.registryId) : undefined;
      return translate(lang, 'log.controlResisted', {
        status: getStatusDisplayName(lang, 'registry_effect', registryId),
      });
    }

    case 'log.shieldRegen': {
      const reason = String(p.reason ?? 'not_hit');
      const multPct = Number(p.multPct ?? 100);
      const hits = Number(p.hits ?? 0);
      const suffix =
        reason === 'hit'
          ? translate(lang, 'log.shieldRegenHitSuffix', { hits, multPct })
          : reason === 'cracked'
          ? translate(lang, 'log.shieldRegenCrackedSuffix', { multPct })
          : '';
      return translate(lang, 'log.shieldRegen', {
        target: String(p.target ?? ''),
        amount: Number(p.amount ?? 0),
        suffix,
      });
    }

    case 'log.hpRegen':
      return translate(lang, 'log.hpRegen', {
        target: String(p.target ?? ''),
        amount: Number(p.amount ?? 0),
      });

    case 'log.statusCleansed':
      return translate(lang, 'log.statusCleansed', {
        actor: String(p.actor ?? ''),
      });

    case 'log.splashDamage':
      return translate(lang, 'log.splashDamage', {
        actor: String(p.actor ?? ''),
        target: String(p.target ?? ''),
        damage: Number(p.damage ?? 0),
      });

    case 'log.retreat':
      return translate(lang, 'log.retreat', {
        actor: String(p.actor ?? ''),
      });

    case 'log.repairFreeDefeat':
      return translate(lang, 'log.repairFreeDefeat');

    case 'log.repairFreeRetreat':
      return translate(lang, 'log.repairFreeRetreat');

    case 'log.repairFee':
      return translate(lang, 'log.repairFee', {
        fee: Number(p.fee ?? 0).toLocaleString(
          lang === 'vi' ? 'vi-VN' : 'en-US'
        ),
      });

    case 'log.baseSiegeDamaged':
      return translate(lang, 'log.baseSiegeDamaged', {
        sector: getSectorName(lang, String(p.sectorId ?? '')),
        shieldBefore: Number(p.shieldBefore ?? 0),
        shieldAfter: Number(p.shieldAfter ?? 0),
        hpAfter: Number(p.hpAfter ?? 0),
      });

    case 'log.baseSiegeHpDamaged':
      return translate(lang, 'log.baseSiegeHpDamaged', {
        sector: getSectorName(lang, String(p.sectorId ?? '')),
        hpBefore: Number(p.hpBefore ?? 0),
        hpAfter: Number(p.hpAfter ?? 0),
      });

    case 'log.baseSiegeCaptured':
      return translate(lang, 'log.baseSiegeCaptured', {
        sector: getSectorName(lang, String(p.sectorId ?? '')),
      });

    case 'log.buffApplied': {
      const skillId = String(p.skillId ?? 'gen_hull_brace');
      return translate(lang, 'log.buffApplied', {
        actor: String(p.actor ?? ''),
        skill: getSkillName(lang, skillId),
        spCost: Number(p.spCost ?? 0),
      });
    }

    case 'log.stanceToggle': {
      const skillId = String(p.skillId ?? 'sge_anchor_protocol');
      return translate(lang, 'log.stanceToggle', {
        actor: String(p.actor ?? ''),
        skill: getSkillName(lang, skillId),
        state: String(p.state ?? 'ON'),
      });
    }

    case 'log.charging': {
      const skillId = String(p.skillId ?? 'str_solar_capacitor');
      return translate(lang, 'log.charging', {
        actor: String(p.actor ?? ''),
        skill: getSkillName(lang, skillId),
      });
    }

    case 'log.counterAttack':
      return translate(lang, 'log.counterAttack', {
        target: String(p.target ?? ''),
        actor: String(p.actor ?? ''),
        damage: Number(p.damage ?? 0),
      });

    case 'log.scanReveal': {
      const skillId = String(p.skillId ?? 'sup_lidar_sweep');
      const revealedNames = String(p.revealedNames ?? '').trim();
      if (!revealedNames) {
        return translate(lang, 'log.scanRevealNone', {
          actor: String(p.actor ?? ''),
          skill: getSkillName(lang, skillId),
        });
      }
      return translate(lang, 'log.scanReveal', {
        actor: String(p.actor ?? ''),
        skill: getSkillName(lang, skillId),
        revealed: Number(p.revealed ?? 0),
        revealedNames,
      });
    }

    case 'log.scanRevealNone': {
      const skillId = String(p.skillId ?? 'sup_lidar_sweep');
      return translate(lang, 'log.scanRevealNone', {
        actor: String(p.actor ?? ''),
        skill: getSkillName(lang, skillId),
      });
    }

    case 'log.invincibleBlock':
      return translate(lang, 'log.invincibleBlock', {
        target: String(p.target ?? ''),
        actor: String(p.actor ?? ''),
      });

    case 'log.silencedBlocked':
      return translate(lang, 'log.silencedBlocked', {
        actor: String(p.actor ?? ''),
      });

    case 'log.wingmanChat': {
      const chatKey = String(p.chatKey ?? 'chat.engaging') as TranslationKey;
      return translate(lang, 'log.wingmanChat', {
        actor: String(p.actor ?? ''),
        quote: translate(lang, chatKey),
      });
    }

    case 'log.unitMovesRow': {
      const rowKey =
        p.row === 'front'
          ? 'common.frontRow'
          : p.row === 'middle'
          ? 'common.middleRow'
          : 'common.backRow';
      return translate(lang, 'log.unitMovesRow', {
        actor: String(p.actor ?? ''),
        row: translate(lang, rowKey),
      });
    }

    case 'log.invalidTarget': {
      const reasonKey = String(
        p.reasonKey ?? 'radar.invalidFrontAlive'
      ) as TranslationKey;
      return translate(lang, 'log.invalidTarget', {
        target: String(p.target ?? ''),
        reason: translate(lang, reasonKey),
      });
    }

    case 'log.autoRepeatStopped': {
      const stopReason = String(p.reason ?? 'manual_stop') as AutoStopReason;
      const streak =
        typeof p.streak === 'number'
          ? p.streak
          : DEFAULT_DEFEAT_STREAK_LIMIT;
      const maxCap = typeof p.max === 'number' ? p.max : undefined;
      return translate(lang, 'log.autoRepeatStopped', {
        reason: getAutoStopReasonLabel(lang, stopReason, streak, maxCap),
      });
    }

    default:
      return '';
  }
}

function formatActionParam(
  lang: Language,
  params: Record<string, string | number>
): string {
  const skillId = params.skillId ? String(params.skillId) : '';
  const hitIndex = Number(params.hitIndex ?? 0);
  const totalHits = Number(params.totalHits ?? 1);

  if (!skillId) {
    return translate(lang, 'log.primaryWeapons');
  }
  const base = getSkillName(lang, skillId);
  return totalHits > 1 ? `${base} (${hitIndex}/${totalHits})` : base;
}

export function getBuffCardKindLabel(
  lang: Language,
  kind: BuffCardKind
): string {
  return translate(lang, `buffCard.kind.${kind}` as TranslationKey);
}

export function getBuffCardName(
  lang: Language,
  kind: BuffCardKind,
  tier: number
): string {
  if (kind === 'exp' && tier === 0) {
    return translate(lang, 'buffCard.name.exp0');
  }
  return translate(lang, `buffCard.name.${kind}` as TranslationKey, { tier });
}

export function useI18n() {
  const lang = useGameStore((s) => s.language);
  const showRawKeys = useGameStore((s) => s.adminConfig.showRawI18nKeys);
  const setLanguage = useGameStore((s) => s.setLanguage);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      showRawKeys ? key : translate(lang, key, params),
    [lang, showRawKeys]
  );

  return { lang, t, setLanguage };
}
