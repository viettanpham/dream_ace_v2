import type { EquipmentSlot, EquippedSlotIds, ItemRarity, ItemTemplate, StatKey } from '../types/game';
import { BALANCE_CONFIG } from './balance';
import rawItemsData from './items.json';

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['main_weapon', 'sub_weapon', 'armor', 'engine', 'cpu', 'accessory', 'radar'];

export interface EquipmentSlotMeta {
  slot: EquipmentSlot;
  label: string;
  shortLabel: string;
  classLocked: boolean;
}

export const EQUIPMENT_SLOT_META: Record<EquipmentSlot, EquipmentSlotMeta> = {
  main_weapon: { slot: 'main_weapon', label: 'Main Weapon', shortLabel: 'MAIN', classLocked: false },
  sub_weapon: { slot: 'sub_weapon', label: 'Sub Weapon', shortLabel: 'SUB', classLocked: false },
  armor: { slot: 'armor', label: 'Hull Plating', shortLabel: 'HULL', classLocked: true },
  engine: { slot: 'engine', label: 'Thrusters', shortLabel: 'THRUST', classLocked: true },
  cpu: { slot: 'cpu', label: 'Targeting CPU', shortLabel: 'CPU', classLocked: false },
  accessory: { slot: 'accessory', label: 'Reactor', shortLabel: 'REACTOR', classLocked: false },
  radar: { slot: 'radar', label: 'Radar', shortLabel: 'RADAR', classLocked: false },
};

export const EMPTY_EQUIPPED_SLOT_IDS: EquippedSlotIds = {
  main_weapon: null, sub_weapon: null, armor: null, engine: null, cpu: null, accessory: null, radar: null,
};

export const RARITY_LIST: ItemRarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_META: Record<
  ItemRarity,
  { label: string; textClass: string; borderClass: string; bgTintClass: string }
> = {
  common: { label: 'Common', textClass: 'text-slate-200', borderClass: 'border-slate-700', bgTintClass: 'bg-slate-800/30' },
  rare: { label: 'Rare', textClass: 'text-sky-400', borderClass: 'border-sky-500/60', bgTintClass: 'bg-sky-500/10' },
  epic: { label: 'Epic', textClass: 'text-purple-400', borderClass: 'border-purple-500/60', bgTintClass: 'bg-purple-500/10' },
  legendary: { label: 'Legendary', textClass: 'text-amber-400', borderClass: 'border-amber-400/80', bgTintClass: 'bg-amber-500/15' },
};

export interface AffixSuffixMeta {
  id: string;
  stat: StatKey;
  en: string;
  vi: string;
}

export const AFFIX_SUFFIX_BY_STAT: Record<StatKey, AffixSuffixMeta[]> = {
  attack: [
    { id: 'of_fury', stat: 'attack', en: 'of Fury', vi: 'Cuồng Nộ' },
    { id: 'of_salvo', stat: 'attack', en: 'of Overfire', vi: 'Xung Hỏa' },
  ],
  defense: [
    { id: 'of_bastion', stat: 'defense', en: 'of the Bastion', vi: 'Pháo Đài' },
    { id: 'of_plating', stat: 'defense', en: 'of Fortitude', vi: 'Kiên Cố' },
  ],
  fuel: [
    { id: 'of_velocity', stat: 'fuel', en: 'of Velocity', vi: 'Siêu Tốc' },
    { id: 'of_afterburn', stat: 'fuel', en: 'of Afterburn', vi: 'Tăng Tốc' },
  ],
  spirit: [
    { id: 'of_resonance', stat: 'spirit', en: 'of Resonance', vi: 'Cộng Hưởng' },
    { id: 'of_focus', stat: 'spirit', en: 'of Focus', vi: 'Tập Trung' },
  ],
  shield: [
    { id: 'of_aegis', stat: 'shield', en: 'of Aegis', vi: 'Lá Chắn' },
    { id: 'of_barrier', stat: 'shield', en: 'of the Barrier', vi: 'Hộ Giáp' },
  ],
  evasion: [
    { id: 'of_phantom', stat: 'evasion', en: 'of the Phantom', vi: 'Bóng Ma' },
    { id: 'of_zephyr', stat: 'evasion', en: 'of Slipstream', vi: 'Lướt Gió' },
  ],
};

export const AFFIX_SUFFIX_MAP: Record<string, AffixSuffixMeta> = Object.values(
  AFFIX_SUFFIX_BY_STAT
)
  .flat()
  .reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {} as Record<string, AffixSuffixMeta>);

export const SHOP_CONFIG = {
  sellPriceRatio: BALANCE_CONFIG.shopSellRatio,
  refreshCost: BALANCE_CONFIG.shopRefreshCost,
} as const;

export const ENCHANT_CONFIG = {
  maxLevel: BALANCE_CONFIG.enchantMaxLevel,
  bonusPerLevel: BALANCE_CONFIG.enchantBonusPerLevel,
  successRates: BALANCE_CONFIG.enchantSuccessRates,
  baseCostFloor: BALANCE_CONFIG.enchantBaseCostFloor,
  priceCostFactor: BALANCE_CONFIG.enchantPriceCostFactor,
  levelCostStep: BALANCE_CONFIG.enchantLevelCostStep,
} as const;

export const DROP_CONFIG = BALANCE_CONFIG.dropConfig;

export const BUILTIN_ITEM_REGISTRY_TAG = 'sys' as const;

const VALID_SLOT_SET = new Set<string>(EQUIPMENT_SLOTS);
const VALID_STAT_SET = new Set<string>(['attack', 'defense', 'fuel', 'spirit', 'shield', 'evasion']);
const VALID_CLASS_SET = new Set<string>(['striker', 'interceptor', 'siege', 'support']);
const NUMERIC_TRAIT_KEYS = ['critBonusPct', 'armorPiercePct', 'splashPct', 'spRegenPerTurn', 'evasionMod', 'accuracyPct'] as const;

const isNonEmptyStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isValidRange = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 &&
  typeof v[0] === 'number' && typeof v[1] === 'number' &&
  Number.isFinite(v[0]) && Number.isFinite(v[1]) && v[0] <= v[1];

function isValidSpecialTraits(v: unknown): v is ItemTemplate['specialTraits'] {
  if (v === undefined) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  for (const k of NUMERIC_TRAIT_KEYS) {
    if (obj[k] !== undefined && (typeof obj[k] !== 'number' || !Number.isFinite(obj[k]))) return false;
  }
  return (
    (obj.longRange === undefined || typeof obj.longRange === 'boolean') &&
    (obj.detectStealth === undefined || typeof obj.detectStealth === 'boolean')
  );
}

export function validateItemTemplates(raw: unknown): ItemTemplate[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { templates?: unknown }).templates)
      ? (raw as { templates: unknown[] }).templates
      : null;
  if (!rows) {
    console.warn('[items] Invalid item templates payload; expected { schemaVersion, templates: [] }.');
    return [];
  }

  const seenIds = new Set<string>();
  const droppedIds: string[] = [];
  const valid: ItemTemplate[] = [];

  rows.forEach((entry, idx) => {
    const r = entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>) : null;
    const rowLabel = r && isNonEmptyStr(r.id) ? r.id : `#${idx}`;
    const hasSecondary = r ? r.secondaryStat !== undefined || r.secondaryRange !== undefined : false;

    const ok = r !== null &&
      isNonEmptyStr(r.id) && !seenIds.has(r.id) &&
      isNonEmptyStr(r.nameEn) && isNonEmptyStr(r.nameVi) && isNonEmptyStr(r.descEn) && isNonEmptyStr(r.descVi) &&
      typeof r.slot === 'string' && VALID_SLOT_SET.has(r.slot) &&
      typeof r.tier === 'number' && Number.isInteger(r.tier) && r.tier >= 1 && r.tier <= 4 &&
      typeof r.requiredLevel === 'number' && Number.isFinite(r.requiredLevel) && r.requiredLevel >= 1 &&
      (r.classRestriction === null || (typeof r.classRestriction === 'string' && VALID_CLASS_SET.has(r.classRestriction))) &&
      typeof r.basePrice === 'number' && Number.isFinite(r.basePrice) && r.basePrice > 0 &&
      typeof r.primaryStat === 'string' && VALID_STAT_SET.has(r.primaryStat) && isValidRange(r.primaryRange) &&
      (!hasSecondary || (typeof r.secondaryStat === 'string' && VALID_STAT_SET.has(r.secondaryStat) && isValidRange(r.secondaryRange))) &&
      Array.isArray(r.affixPool) && r.affixPool.length > 0 && r.affixPool.every((s) => typeof s === 'string' && VALID_STAT_SET.has(s)) &&
      isValidSpecialTraits(r.specialTraits) && (r.registryTag === undefined || isNonEmptyStr(r.registryTag));

    if (!ok || !r) {
      droppedIds.push(rowLabel);
      return;
    }

    const id = r.id as string;
    seenIds.add(id);
    valid.push({
      id,
      nameEn: r.nameEn as string,
      nameVi: r.nameVi as string,
      descEn: r.descEn as string,
      descVi: r.descVi as string,
      slot: r.slot as EquipmentSlot,
      tier: r.tier as number,
      requiredLevel: r.requiredLevel as number,
      classRestriction: r.classRestriction as ItemTemplate['classRestriction'],
      basePrice: r.basePrice as number,
      primaryStat: r.primaryStat as StatKey,
      primaryRange: [(r.primaryRange as [number, number])[0], (r.primaryRange as [number, number])[1]],
      ...(hasSecondary
        ? {
            secondaryStat: r.secondaryStat as StatKey,
            secondaryRange: [(r.secondaryRange as [number, number])[0], (r.secondaryRange as [number, number])[1]] as [number, number],
          }
        : {}),
      affixPool: [...(r.affixPool as StatKey[])],
      ...(r.specialTraits !== undefined
        ? { specialTraits: { ...(r.specialTraits as NonNullable<ItemTemplate['specialTraits']>) } }
        : {}),
      registryTag: (r.registryTag as ItemTemplate['registryTag']) ?? BUILTIN_ITEM_REGISTRY_TAG,
    });
  });

  if (droppedIds.length > 0) {
    console.warn(`[items] Dropped ${droppedIds.length} invalid item template(s): ${droppedIds.join(', ')}`);
  }
  return valid;
}

export const ITEM_TEMPLATES: ItemTemplate[] = validateItemTemplates(rawItemsData);

export const ITEM_TEMPLATES_BY_ID: Record<string, ItemTemplate> = ITEM_TEMPLATES.reduce((acc, tpl) => {
  acc[tpl.id] = tpl;
  return acc;
}, {} as Record<string, ItemTemplate>);

export function getItemTemplate(templateId: string): ItemTemplate | undefined {
  return ITEM_TEMPLATES_BY_ID[templateId];
}

/**
 * Maps legacy Phase 2 item IDs to modern ItemTemplate IDs for smooth save migration.
 */
export const LEGACY_ITEM_ID_TO_TEMPLATE: Record<string, string> = {
  mw_pulse_carbine: 'tpl_mw_pulse_cannon',
  mw_autocannon_30: 'tpl_mw_scatter_gun',
  mw_plasma_lance: 'tpl_mw_plasma_repeater',
  mw_viper_repeater: 'tpl_mw_rail_lance',
  mw_hyperion_railgun: 'tpl_mw_rail_lance',
  mw_eclipse_beam: 'tpl_mw_nova_beam',
  sw_micro_missiles: 'tpl_sw_missile_pod',
  sw_buckler_emitter: 'tpl_sw_aegis_drone',
  sw_flak_gatling: 'tpl_sw_flak_turret',
  sw_aegis_drone: 'tpl_sw_aegis_drone',
  sw_nova_mortar: 'tpl_sw_ion_torpedo',
  sw_phantom_blades: 'tpl_sw_phantom_seekers',
  ar_striker_composite: 'tpl_ar_striker_vanguard',
  ar_striker_valkyrie: 'tpl_ar_striker_valkyrie',
  ar_interceptor_carbon: 'tpl_ar_interceptor_carbon',
  ar_interceptor_wraith: 'tpl_ar_interceptor_wraith',
  ar_siege_bulwark: 'tpl_ar_siege_bastion',
  ar_siege_titan: 'tpl_ar_siege_titan',
  ar_support_conduit: 'tpl_ar_support_conduit',
  ar_support_seraph: 'tpl_ar_support_seraph',
  en_striker_ion: 'tpl_en_striker_ion',
  en_striker_overdrive: 'tpl_en_striker_afterburner',
  en_interceptor_vector: 'tpl_en_interceptor_vector',
  en_interceptor_slipstream: 'tpl_en_interceptor_slipstream',
  en_siege_hydraulic: 'tpl_en_siege_hydraulic',
  en_siege_colossus: 'tpl_en_siege_colossus',
  en_support_harmonic: 'tpl_en_support_harmonic',
  en_support_aether: 'tpl_en_support_aether',
  cpu_tactical_mk1: 'tpl_cpu_tactical',
  cpu_reflex_gyro: 'tpl_cpu_reflex',
  cpu_oracle_link: 'tpl_cpu_oracle',
  cpu_predator_optic: 'tpl_cpu_predator',
  cpu_chronos_core: 'tpl_cpu_reflex',
  cpu_sovereign_ai: 'tpl_cpu_sovereign',
  ac_capacitor_cell: 'tpl_ac_capacitor',
  ac_alloy_stabilizer: 'tpl_ac_aegis_core',
  ac_chaff_module: 'tpl_ac_chaff',
  ac_overclock_coil: 'tpl_ac_overclock',
  ac_valkyrie_crest: 'tpl_ac_singularity',
  ac_singularity_charm: 'tpl_ac_singularity',
};
