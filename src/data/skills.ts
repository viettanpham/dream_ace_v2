import type {
  MechClassId,
  OpeningCardDefinition,
  SkillDefinition,
} from '../types/game';
import { BALANCE_CONFIG } from './balance';

/**
 * Full Data-Driven Gear Skill Catalog (38 skills across General + 4 Gear Classes).
 * All skill display names and descriptions are localized in vi.ts / en.ts using original sci-fi titles.
 */
export const SKILLS_LIST: SkillDefinition[] = [
  // ===================== GENERAL (ALL CLASSES) =====================
  {
    id: 'gen_hull_brace',
    classScope: 'general',
    category: 'normal',
    icon: 'shield',
    unlockLevel: 1,
    spCost: 8,
    cooldown: 3,
    targetType: 'self',
    effectKind: 'buff_def',
    buffMagnitude: 0.25,
    duration: 3,
  },
  {
    id: 'gen_thruster_feint',
    classScope: 'general',
    category: 'normal',
    icon: 'wind',
    unlockLevel: 1,
    spCost: 8,
    cooldown: 3,
    targetType: 'self',
    effectKind: 'buff_eva',
    buffMagnitude: 0.25,
    duration: 3,
  },

  // ===================== STRIKER (BOMBER) =====================
  {
    id: 'str_hotload_shells',
    classScope: 'striker',
    category: 'normal',
    icon: 'flame',
    unlockLevel: 1,
    spCost: 10,
    cooldown: 4,
    targetType: 'self',
    effectKind: 'buff_primary_dmg',
    buffMagnitude: 0.3,
    duration: 3,
  },
  {
    id: 'str_ordnance_amp',
    classScope: 'striker',
    category: 'normal',
    icon: 'zap',
    unlockLevel: 3,
    spCost: 10,
    cooldown: 4,
    targetType: 'self',
    effectKind: 'buff_skill_dmg',
    buffMagnitude: 0.3,
    duration: 3,
  },
  {
    id: 'str_deadeye_link',
    classScope: 'striker',
    category: 'normal',
    icon: 'target',
    unlockLevel: 5,
    spCost: 8,
    cooldown: 3,
    targetType: 'self',
    effectKind: 'buff_sure_hit',
    charges: 2,
    duration: 4,
  },
  {
    id: 'str_viper_sweep',
    classScope: 'striker',
    category: 'normal',
    icon: 'crosshair',
    unlockLevel: 8,
    spCost: 18,
    cooldown: 3,
    targetType: 'multi_enemy',
    effectKind: 'multi_attack',
    powerMultiplier: 0.6,
    maxTargets: 3,
  },
  {
    id: 'str_carpet_salvo',
    classScope: 'striker',
    category: 'normal',
    icon: 'bomb',
    unlockLevel: 12,
    spCost: 24,
    cooldown: 4,
    targetType: 'single_enemy',
    effectKind: 'splash_attack',
    powerMultiplier: 1.7,
    secondaryRatio: 0.5, // 50% splash to adjacent enemies
  },
  {
    id: 'str_solar_capacitor',
    classScope: 'striker',
    category: 'normal',
    icon: 'battery',
    unlockLevel: 16,
    spCost: 20,
    cooldown: 5,
    targetType: 'single_enemy',
    effectKind: 'charge_attack',
    powerMultiplier: 3.2,
  },
  {
    id: 'str_phase_shroud',
    classScope: 'striker',
    category: 'special',
    icon: 'ghost',
    unlockLevel: 20,
    spCost: 22,
    cooldown: 6,
    targetType: 'self',
    effectKind: 'stealth_turns',
    duration: 2,
    openingCardId: 'card_str_phase_shroud',
  },
  {
    id: 'str_skyfall_protocol',
    classScope: 'striker',
    category: 'elite',
    icon: 'orbit',
    unlockLevel: 25,
    spCost: 60,
    cooldown: 0,
    targetType: 'all_enemies',
    effectKind: 'aoe_elite_attack',
    powerMultiplier: 2.2,
    oncePerBattle: true,
    openingCardId: 'card_str_skyfall_protocol',
  },
  {
    id: 'str_passive_ordnance',
    classScope: 'striker',
    category: 'passive',
    icon: 'star',
    unlockLevel: 1,
    spCost: 0,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'passive_skill_dmg',
    buffMagnitude: 0.05, // +5% skill dmg per level
  },

  // ===================== SIEGE (A-TYPE GUNSHIP) =====================
  {
    id: 'sge_anchor_protocol',
    classScope: 'siege',
    category: 'normal',
    icon: 'anchor',
    unlockLevel: 1,
    spCost: 12,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'toggle_siege_mode',
    buffMagnitude: 0.6, // +60% dmg
    isToggle: true,
  },
  {
    id: 'sge_bastion_lock',
    classScope: 'siege',
    category: 'normal',
    icon: 'fortress',
    unlockLevel: 5,
    spCost: 12,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'toggle_siege_defense',
    buffMagnitude: 0.8, // +80% DEF
    secondaryMagnitude: 0.3, // +30% Shield
    secondaryRatio: 0.3, // -30% dmg
    isToggle: true,
  },
  {
    id: 'sge_grav_bolas',
    classScope: 'siege',
    category: 'normal',
    icon: 'snowflake',
    unlockLevel: 8,
    spCost: 12,
    cooldown: 3,
    targetType: 'single_enemy',
    effectKind: 'attack_slow',
    powerMultiplier: 1.1,
    duration: 2,
  },
  {
    id: 'sge_aegis_sunder',
    classScope: 'siege',
    category: 'normal',
    icon: 'shield_off',
    unlockLevel: 12,
    spCost: 14,
    cooldown: 4,
    targetType: 'single_enemy',
    effectKind: 'attack_shield_break', // shield sunder
    powerMultiplier: 1.0,
    shieldDamageMult: 1.5,
    duration: 2,
  },
  {
    id: 'sge_thermal_mask',
    classScope: 'siege',
    category: 'special',
    icon: 'eye_off',
    unlockLevel: 18,
    spCost: 12,
    cooldown: 5,
    targetType: 'self',
    effectKind: 'stealth_until_attack',
    duration: 99,
    openingCardId: 'card_sge_thermal_mask',
  },
  {
    id: 'sge_starbreaker_lance',
    classScope: 'siege',
    category: 'elite',
    icon: 'ray',
    unlockLevel: 25,
    spCost: 70,
    cooldown: 0,
    targetType: 'single_enemy',
    effectKind: 'pierce_all_elite',
    powerMultiplier: 4.0,
    oncePerBattle: true,
    openingCardId: 'card_sge_starbreaker_lance',
  },
  {
    id: 'sge_passive_hull',
    classScope: 'siege',
    category: 'passive',
    icon: 'star',
    unlockLevel: 1,
    spCost: 0,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'passive_def_pct',
    buffMagnitude: 0.04, // +4% DEF per level
  },

  // ===================== INTERCEPTOR (I-TYPE DART FIGHTER) =====================
  {
    id: 'int_sabot_burst',
    classScope: 'interceptor',
    category: 'normal',
    icon: 'sword',
    unlockLevel: 1,
    spCost: 8,
    cooldown: 2,
    targetType: 'single_enemy',
    effectKind: 'attack_pierce',
    powerMultiplier: 1.3,
    secondaryRatio: 0.3, // ignores 30% DEF
  },
  {
    id: 'int_snap_riposte',
    classScope: 'interceptor',
    category: 'normal',
    icon: 'rotate',
    unlockLevel: 4,
    spCost: 12,
    cooldown: 4,
    targetType: 'self',
    effectKind: 'counter_stance',
    powerMultiplier: 1.0,
    charges: 1,
    duration: 2,
  },
  {
    id: 'int_afterburn_slip',
    classScope: 'interceptor',
    category: 'normal',
    icon: 'corner_down_left',
    unlockLevel: 6,
    spCost: 8,
    cooldown: 3,
    targetType: 'self',
    effectKind: 'retreat_back_eva',
    buffMagnitude: 0.3,
    duration: 2,
  },
  {
    id: 'int_mach_surge',
    classScope: 'interceptor',
    category: 'normal',
    icon: 'gauge',
    unlockLevel: 10,
    spCost: 14,
    cooldown: 5,
    targetType: 'self',
    effectKind: 'buff_speed',
    buffMagnitude: 0.5,
    duration: 3,
  },
  {
    id: 'int_ecm_blackout',
    classScope: 'interceptor',
    category: 'normal',
    icon: 'radio',
    unlockLevel: 14,
    spCost: 14,
    cooldown: 4,
    targetType: 'single_enemy',
    effectKind: 'silence_target',
    duration: 2,
  },
  {
    id: 'int_mirage_spin',
    classScope: 'interceptor',
    category: 'special',
    icon: 'sparkles',
    unlockLevel: 18,
    spCost: 20,
    cooldown: 5,
    targetType: 'self',
    effectKind: 'evade_all_round',
    duration: 1,
    openingCardId: 'card_int_mirage_spin',
  },
  {
    id: 'int_redline_fury',
    classScope: 'interceptor',
    category: 'elite',
    icon: 'skull',
    unlockLevel: 25,
    spCost: 40,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'berserker_buff',
    buffMagnitude: 0.6, // +60% ATK
    secondaryMagnitude: 0.4, // +40% SPD
    secondaryRatio: 0.3, // -30% DEF
    duration: 3,
    oncePerBattle: true,
    openingCardId: 'card_int_redline_fury',
  },
  {
    id: 'int_passive_vectored',
    classScope: 'interceptor',
    category: 'passive',
    icon: 'star',
    unlockLevel: 1,
    spCost: 0,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'passive_eva_spd',
    buffMagnitude: 0.03, // +3% EVA per level
    secondaryMagnitude: 0.02, // +2% Speed per level
  },

  // ===================== SUPPORT =====================
  {
    id: 'sup_nanite_mend',
    classScope: 'support',
    category: 'normal',
    icon: 'heart',
    unlockLevel: 1,
    spCost: 14,
    cooldown: 2,
    targetType: 'single_ally',
    effectKind: 'heal_single',
    buffMagnitude: 0.3, // 30% max HP
  },
  {
    id: 'sup_regen_grid',
    classScope: 'support',
    category: 'normal',
    icon: 'plus_circle',
    unlockLevel: 5,
    spCost: 22,
    cooldown: 5,
    targetType: 'all_allies',
    effectKind: 'heal_field_hot',
    buffMagnitude: 0.1, // 10% max HP/turn for 3 turns
    duration: 3,
  },
  {
    id: 'sup_lidar_sweep',
    classScope: 'support',
    category: 'normal',
    icon: 'radar',
    unlockLevel: 6,
    spCost: 10,
    cooldown: 3,
    targetType: 'all_enemies',
    effectKind: 'scan_reveal',
    buffMagnitude: 0.15, // +15% dmg taken for 2 turns
    duration: 2,
  },
  {
    id: 'sup_flux_transfer',
    classScope: 'support',
    category: 'normal',
    icon: 'bolt',
    unlockLevel: 8,
    spCost: 0,
    cooldown: 5,
    targetType: 'all_allies',
    effectKind: 'sp_transfer',
    spAmount: 0,
  },
  {
    id: 'sup_war_hymn',
    classScope: 'support',
    category: 'normal',
    icon: 'swords',
    unlockLevel: 10,
    spCost: 18,
    cooldown: 5,
    targetType: 'all_allies',
    effectKind: 'team_atk_up',
    buffMagnitude: 0.2,
    duration: 3,
  },
  {
    id: 'sup_aegis_field',
    classScope: 'support',
    category: 'normal',
    icon: 'waves',
    unlockLevel: 12,
    spCost: 20,
    cooldown: 5,
    targetType: 'all_allies',
    effectKind: 'energize_shield_field',
    spAmount: 10,
    buffMagnitude: 0.25, // 25% max shield recharge
  },
  {
    id: 'sup_iron_canopy',
    classScope: 'support',
    category: 'normal',
    icon: 'shield_plus',
    unlockLevel: 14,
    spCost: 18,
    cooldown: 5,
    targetType: 'all_allies',
    effectKind: 'team_def_up',
    buffMagnitude: 0.2,
    duration: 3,
  },
  {
    id: 'sup_slipstream_link',
    classScope: 'support',
    category: 'normal',
    icon: 'feather',
    unlockLevel: 18,
    spCost: 18,
    cooldown: 5,
    targetType: 'all_allies',
    effectKind: 'team_eva_up',
    buffMagnitude: 0.2,
    duration: 3,
  },
  {
    id: 'sup_stasis_shell',
    classScope: 'support',
    category: 'special',
    icon: 'sun',
    unlockLevel: 20,
    spCost: 28,
    cooldown: 6,
    targetType: 'single_ally',
    effectKind: 'invincible_ally',
    duration: 1,
    openingCardId: 'card_sup_stasis_shell',
  },
  {
    id: 'sup_system_purge',
    classScope: 'support',
    category: 'special',
    icon: 'cleanse',
    unlockLevel: 22,
    spCost: 16,
    cooldown: 4,
    targetType: 'all_allies',
    effectKind: 'purify_team',
    openingCardId: 'card_sup_system_purge',
  },
  {
    id: 'sup_genesis_wave',
    classScope: 'support',
    category: 'elite',
    icon: 'orbit',
    unlockLevel: 25,
    spCost: 70,
    cooldown: 0,
    targetType: 'all_allies',
    effectKind: 'full_recovery_elite',
    oncePerBattle: true,
    openingCardId: 'card_sup_genesis_wave',
  },
  {
    id: 'sup_passive_capacitor',
    classScope: 'support',
    category: 'passive',
    icon: 'star',
    unlockLevel: 1,
    spCost: 0,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'passive_sp_regen',
    spAmount: 1, // +1 SP regen per turn per level
  },
];

export const SKILLS_CATALOG: Record<string, SkillDefinition> = SKILLS_LIST.reduce(
  (acc, skill) => {
    acc[skill.id] = skill;
    return acc;
  },
  {} as Record<string, SkillDefinition>
);

export const OPENING_CARDS_LIST: OpeningCardDefinition[] = SKILLS_LIST.filter(
  (s) =>
    Boolean(s.openingCardId) &&
    (s.category === 'special' || s.category === 'elite') &&
    s.classScope !== 'general'
).map((s) => ({
  id: s.openingCardId!,
  skillId: s.id,
  classId: s.classScope as MechClassId,
  category: s.category as 'special' | 'elite',
  warPointCost:
    s.category === 'elite'
      ? BALANCE_CONFIG.openingCardCosts.elite
      : BALANCE_CONFIG.openingCardCosts.special,
}));

export const OPENING_CARDS_BY_ID: Record<string, OpeningCardDefinition> =
  OPENING_CARDS_LIST.reduce((acc, card) => {
    acc[card.id] = card;
    return acc;
  }, {} as Record<string, OpeningCardDefinition>);

/**
 * Legacy v4 skill ID mapping for crash-proof save migration.
 */
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

export function getSkillById(skillId: string): SkillDefinition | undefined {
  return SKILLS_CATALOG[skillId];
}

export function getOpeningCardById(
  cardId: string
): OpeningCardDefinition | undefined {
  return OPENING_CARDS_BY_ID[cardId];
}

/**
 * Scales a skill's numeric effect by +10% per skill level (Lv 1 = 1.0x, Lv 5 = 1.4x).
 * Passives scale linearly per level (Lv 1 = 1x, Lv 5 = 5x).
 */
export function getScaledSkillStats(skill: SkillDefinition, level: number) {
  const clampedLv = Math.max(1, Math.min(BALANCE_CONFIG.skillMaxLevel, level));
  const effectMult =
    1 + (clampedLv - 1) * BALANCE_CONFIG.skillEffectScalePerLevel;

  if (skill.category === 'passive') {
    return {
      level: clampedLv,
      effectMult: clampedLv,
      spCost: 0,
      cooldown: 0,
      powerMultiplier: 0,
      secondaryRatio: 0,
      buffMagnitude: Number(((skill.buffMagnitude ?? 0) * clampedLv).toFixed(3)),
      secondaryMagnitude: Number(
        ((skill.secondaryMagnitude ?? 0) * clampedLv).toFixed(3)
      ),
      spAmount: (skill.spAmount ?? 0) * clampedLv,
    };
  }

  return {
    level: clampedLv,
    effectMult,
    spCost: skill.spCost,
    cooldown: skill.cooldown,
    powerMultiplier: skill.powerMultiplier
      ? Number((skill.powerMultiplier * effectMult).toFixed(2))
      : 0,
    secondaryRatio: skill.secondaryRatio
      ? Number((skill.secondaryRatio * effectMult).toFixed(2))
      : 0,
    buffMagnitude: skill.buffMagnitude
      ? Number((skill.buffMagnitude * effectMult).toFixed(3))
      : 0,
    secondaryMagnitude: skill.secondaryMagnitude
      ? Number((skill.secondaryMagnitude * effectMult).toFixed(3))
      : 0,
    spAmount: skill.spAmount ? Math.round(skill.spAmount * effectMult) : 0,
  };
}
