import { BALANCE_CONFIG } from '../data/balance';
import { getSkillById } from '../data/skills';
import type {
  ActionType,
  AdminConfig,
  AutoRepeatDefeatRule,
  AutoRepeatSession,
  AutoSafetyConfig,
  AutoStopReason,
  BattleState,
  CombatUnit,
  GearTacticsProfile,
  MechClassId,
  SimpleElitePolicy,
  SimpleLowHpAction,
  SimpleSkillUsage,
  SimpleTacticsConfig,
  SimpleTacticsPresetId,
  SimpleTargetPref,
  SkillDefinition,
  StatusEffectType,
  TacticsCondition,
  TacticsConditionKind,
  TacticsMode,
  TacticsPresetId,
  TacticsRule,
  TacticsTargetSelector,
} from '../types/game';
import {
  clampDefeatStreakLimit,
  DEFAULT_DEFEAT_STREAK_LIMIT,
} from '../utils/battleDisplay';

import {
  DEBUFF_TYPES,
  getEffectiveUnitSpeed,
  getValidEnemyTargets,
  hasStatus,
  isUnitStealthed,
} from './combat';
import {
  DEFAULT_LIDAR_AUTO_CONFIG,
  sanitizeLidarAutoConfig,
} from './lidarAuto';
import {
  DEFAULT_AUTO_SUPPLIES_CONFIG,
  sanitizeAutoSuppliesConfig,
} from './supplyAi';
import {
  DEFAULT_FLUX_AUTO_CONFIG,
  sanitizeFluxAutoConfig,
} from './fluxAuto';
import { canUnitUseSkill, isSkillAllowedForClass } from './skills';

export const MAX_PRIORITY_SKILLS = BALANCE_CONFIG.maxEquippedActiveSkills;

export const TACTICS_CONDITION_KINDS: TacticsConditionKind[] = [
  'always',
  'my_hp_below',
  'my_shield_zero',
  'my_sp_gte',
  'my_sp_pct_gte',
  'my_sp_lt',
  'any_ally_hp_below',
  'any_ally_has_debuff',
  'enemy_count_gte',
  'target_has_shield',
  'target_hp_below',
  'any_enemy_stealthed',
  'round_eq',
  'first_round',
  'boss_present',
  'my_buff_not_active',
  'skill_off_cooldown',
];

export const TACTICS_TARGET_SELECTORS: TacticsTargetSelector[] = [
  'lowest_hp_enemy',
  'highest_hp_enemy',
  'highest_atk_enemy',
  'fastest_enemy',
  'enemy_support_first',
  'enemy_sniper_first',
  'front_row_first',
  'back_row_first',
  'random_enemy',
  'same_as_last_turn',
  'self',
  'lowest_hp_ally',
  'all_allies',
];

export const TACTICS_BUFF_OPTIONS: StatusEffectType[] = [
  'def_up',
  'eva_up',
  'atk_up',
  'spd_up',
  'primary_dmg_up',
  'skill_dmg_up',
  'sure_hit',
  'counter',
  'siege_mode',
  'siege_defense',
  'stealth',
  'regen_hp',
];

const VALID_CONDITIONS = new Set<TacticsConditionKind>(TACTICS_CONDITION_KINDS);
const VALID_SELECTORS = new Set<TacticsTargetSelector>(TACTICS_TARGET_SELECTORS);
const VALID_BUFFS = new Set<StatusEffectType>(TACTICS_BUFF_OPTIONS);

export function createDefaultAutoSafety(): AutoSafetyConfig {
  return {
    stopOnLowHpEnabled: false,
    stopOnLowHpPct: 25,
    stopOnEliteReady: false,
    stopOnBossPresent: false,
    autoRetreatLowHpEnabled: false,
    autoRetreatLowHpPct: 15,
  };
}

let ruleUid = 1;
export function createRuleId(prefix = 'rule'): string {
  ruleUid += 1;
  return `${prefix}_${Date.now().toString(36)}_${ruleUid}`;
}

export function createBlankTacticsRule(): TacticsRule {
  return {
    id: createRuleId('tac'),
    enabled: true,
    condition: { kind: 'always' },
    action: { type: 'attack' },
    targetSelector: 'lowest_hp_enemy',
  };
}

function makeRule(
  id: string,
  condition: TacticsCondition,
  action: TacticsRule['action'],
  targetSelector: TacticsTargetSelector,
  enabled = true
): TacticsRule {
  return { id, enabled, condition, action, targetSelector };
}

/**
 * Sensible class-specific default tactics profiles.
 * Rules use only skills allowed for `classId` + General skills.
 */
export function createDefaultTacticsForClass(
  classId: MechClassId
): GearTacticsProfile {
  const safety = createDefaultAutoSafety();

  switch (classId) {
    case 'support':
      return {
        safety,
        rules: [
          makeRule(
            'def_sup_1',
            { kind: 'any_ally_hp_below', value: 45 },
            { type: 'skill', skillId: 'sup_nanite_mend' },
            'lowest_hp_ally'
          ),
          makeRule(
            'def_sup_2',
            { kind: 'any_ally_has_debuff' },
            { type: 'skill', skillId: 'sup_system_purge' },
            'all_allies'
          ),
          makeRule(
            'def_sup_3',
            { kind: 'any_enemy_stealthed' },
            { type: 'skill', skillId: 'sup_lidar_sweep' },
            'lowest_hp_enemy'
          ),
          makeRule(
            'def_sup_4',
            { kind: 'first_round' },
            { type: 'skill', skillId: 'sup_war_hymn' },
            'all_allies'
          ),
          makeRule(
            'def_sup_5',
            { kind: 'my_shield_zero' },
            { type: 'skill', skillId: 'gen_hull_brace' },
            'self'
          ),
          makeRule(
            'def_sup_6',
            { kind: 'always' },
            { type: 'attack' },
            'lowest_hp_enemy'
          ),
        ],
      };

    case 'siege':
      return {
        safety,
        rules: [
          makeRule(
            'def_sge_1',
            { kind: 'my_buff_not_active', buffType: 'siege_mode' },
            { type: 'skill', skillId: 'sge_anchor_protocol' },
            'self'
          ),
          makeRule(
            'def_sge_2',
            { kind: 'target_has_shield' },
            { type: 'skill', skillId: 'sge_aegis_sunder' },
            'highest_hp_enemy'
          ),
          makeRule(
            'def_sge_3',
            { kind: 'boss_present' },
            { type: 'skill', skillId: 'sge_grav_bolas' },
            'highest_atk_enemy'
          ),
          makeRule(
            'def_sge_4',
            { kind: 'my_hp_below', value: 35 },
            { type: 'skill', skillId: 'gen_hull_brace' },
            'self'
          ),
          makeRule(
            'def_sge_5',
            { kind: 'always' },
            { type: 'attack' },
            'front_row_first'
          ),
        ],
      };

    case 'interceptor':
      return {
        safety,
        rules: [
          makeRule(
            'def_int_1',
            { kind: 'my_buff_not_active', buffType: 'spd_up' },
            { type: 'skill', skillId: 'int_mach_surge' },
            'self'
          ),
          makeRule(
            'def_int_2',
            { kind: 'boss_present' },
            { type: 'skill', skillId: 'int_ecm_blackout' },
            'enemy_support_first'
          ),
          makeRule(
            'def_int_3',
            { kind: 'my_hp_below', value: 40 },
            { type: 'skill', skillId: 'gen_thruster_feint' },
            'self'
          ),
          makeRule(
            'def_int_4',
            { kind: 'my_sp_gte', value: 8 },
            { type: 'skill', skillId: 'int_sabot_burst' },
            'enemy_sniper_first'
          ),
          makeRule(
            'def_int_5',
            { kind: 'always' },
            { type: 'attack' },
            'lowest_hp_enemy'
          ),
        ],
      };

    case 'striker':
    default:
      return {
        safety,
        rules: [
          makeRule(
            'def_str_1',
            { kind: 'my_buff_not_active', buffType: 'primary_dmg_up' },
            { type: 'skill', skillId: 'str_hotload_shells' },
            'self'
          ),
          makeRule(
            'def_str_2',
            { kind: 'enemy_count_gte', value: 3 },
            { type: 'skill', skillId: 'str_viper_sweep' },
            'lowest_hp_enemy'
          ),
          makeRule(
            'def_str_3',
            { kind: 'boss_present' },
            { type: 'skill', skillId: 'str_carpet_salvo' },
            'highest_hp_enemy'
          ),
          makeRule(
            'def_str_4',
            { kind: 'my_hp_below', value: 35 },
            { type: 'skill', skillId: 'gen_hull_brace' },
            'self'
          ),
          makeRule(
            'def_str_5',
            { kind: 'always' },
            { type: 'attack' },
            'lowest_hp_enemy'
          ),
        ],
      };
  }
}

/**
 * Generates one of the 4 loadable tactics presets for any Gear class.
 */
export function createPresetTactics(
  classId: MechClassId,
  presetId: TacticsPresetId,
  equippedSkillBar: string[] = []
): GearTacticsProfile {
  if (presetId === 'class_default') {
    return createDefaultTacticsForClass(classId);
  }

  const safety = createDefaultAutoSafety();
  const barSkills = equippedSkillBar
    .map((id) => getSkillById(id))
    .filter(
      (s): s is SkillDefinition =>
        Boolean(s) && s!.category !== 'passive' && isSkillAllowedForClass(s!, classId)
    );

  const firstHeal = barSkills.find(
    (s) => s.effectKind === 'heal_single' || s.effectKind === 'heal_field_hot'
  );
  const firstOffense = barSkills.find(
    (s) =>
      s.targetType === 'single_enemy' ||
      s.targetType === 'multi_enemy' ||
      s.targetType === 'all_enemies'
  );
  const firstBuff = barSkills.find(
    (s) =>
      s.targetType === 'self' &&
      !s.isToggle &&
      (s.effectKind === 'buff_primary_dmg' ||
        s.effectKind === 'buff_skill_dmg' ||
        s.effectKind === 'buff_speed' ||
        s.effectKind === 'buff_def' ||
        s.effectKind === 'buff_eva')
  );
  const defSkill =
    barSkills.find(
      (s) =>
        s.id === 'gen_hull_brace' ||
        s.id === 'gen_thruster_feint' ||
        s.effectKind === 'toggle_siege_defense' ||
        s.effectKind === 'evade_all_round'
    ) ?? getSkillById('gen_hull_brace');

  if (presetId === 'balanced') {
    const rules: TacticsRule[] = [];
    if (firstHeal) {
      rules.push(
        makeRule(
          createRuleId('bal'),
          { kind: 'any_ally_hp_below', value: 50 },
          { type: 'skill', skillId: firstHeal.id },
          firstHeal.targetType === 'single_ally' ? 'lowest_hp_ally' : 'all_allies'
        )
      );
    }
    rules.push(
      makeRule(
        createRuleId('bal'),
        { kind: 'my_hp_below', value: 30 },
        { type: 'defend' },
        'self'
      )
    );
    if (firstBuff) {
      rules.push(
        makeRule(
          createRuleId('bal'),
          { kind: 'first_round' },
          { type: 'skill', skillId: firstBuff.id },
          'self'
        )
      );
    }
    if (firstOffense) {
      rules.push(
        makeRule(
          createRuleId('bal'),
          { kind: 'my_sp_gte', value: firstOffense.spCost },
          { type: 'skill', skillId: firstOffense.id },
          'lowest_hp_enemy'
        )
      );
    }
    rules.push(
      makeRule(
        createRuleId('bal'),
        { kind: 'always' },
        { type: 'attack' },
        'lowest_hp_enemy'
      )
    );
    return { rules: rules.slice(0, BALANCE_CONFIG.maxTacticsRules), safety };
  }

  if (presetId === 'focus_weak') {
    const rules: TacticsRule[] = [];
    if (firstBuff) {
      rules.push(
        makeRule(
          createRuleId('foc'),
          { kind: 'first_round' },
          { type: 'skill', skillId: firstBuff.id },
          'self'
        )
      );
    }
    if (firstOffense) {
      rules.push(
        makeRule(
          createRuleId('foc'),
          { kind: 'target_hp_below', value: 60 },
          { type: 'skill', skillId: firstOffense.id },
          'lowest_hp_enemy'
        )
      );
      rules.push(
        makeRule(
          createRuleId('foc'),
          { kind: 'my_sp_gte', value: firstOffense.spCost },
          { type: 'skill', skillId: firstOffense.id },
          'enemy_support_first'
        )
      );
    }
    rules.push(
      makeRule(
        createRuleId('foc'),
        { kind: 'always' },
        { type: 'attack' },
        'lowest_hp_enemy'
      )
    );
    return { rules: rules.slice(0, BALANCE_CONFIG.maxTacticsRules), safety };
  }

  // 'defensive'
  const defRules: TacticsRule[] = [];
  if (firstHeal) {
    defRules.push(
      makeRule(
        createRuleId('dfn'),
        { kind: 'any_ally_hp_below', value: 65 },
        { type: 'skill', skillId: firstHeal.id },
        firstHeal.targetType === 'single_ally' ? 'lowest_hp_ally' : 'all_allies'
      )
    );
  }
  defRules.push(
    makeRule(
      createRuleId('dfn'),
      { kind: 'my_hp_below', value: 45 },
      { type: 'defend' },
      'self'
    )
  );
  if (defSkill && isSkillAllowedForClass(defSkill, classId)) {
    defRules.push(
      makeRule(
        createRuleId('dfn'),
        { kind: 'my_shield_zero' },
        { type: 'skill', skillId: defSkill.id },
        'self'
      )
    );
  }
  defRules.push(
    makeRule(
      createRuleId('dfn'),
      { kind: 'always' },
      { type: 'attack' },
      'highest_atk_enemy'
    )
  );
  return {
    rules: defRules.slice(0, BALANCE_CONFIG.maxTacticsRules),
    safety: {
      ...safety,
      stopOnLowHpEnabled: true,
      stopOnLowHpPct: 25,
    },
  };
}

/**
 * Sanitizes a Gear's tactics profile: clamps rule count to max 8,
 * validates conditions/selectors, and strictly strips/blocks cross-class skills!
 */
export function sanitizeGearTactics(
  classId: MechClassId,
  raw: unknown
): GearTacticsProfile {
  const fallback = createDefaultTacticsForClass(classId);
  if (!raw || typeof raw !== 'object') return fallback;

  const obj = raw as Partial<GearTacticsProfile>;
  const rawSafety = (obj.safety ?? {}) as Partial<AutoSafetyConfig>;
  const safety: AutoSafetyConfig = {
    stopOnLowHpEnabled: Boolean(rawSafety.stopOnLowHpEnabled),
    stopOnLowHpPct: Math.max(
      5,
      Math.min(90, Math.round(Number(rawSafety.stopOnLowHpPct) || 25))
    ),
    stopOnEliteReady: Boolean(rawSafety.stopOnEliteReady),
    stopOnBossPresent: Boolean(rawSafety.stopOnBossPresent),
    autoRetreatLowHpEnabled: Boolean(rawSafety.autoRetreatLowHpEnabled),
    autoRetreatLowHpPct: Math.max(
      5,
      Math.min(75, Math.round(Number(rawSafety.autoRetreatLowHpPct) || 15))
    ),
  };

  if (!Array.isArray(obj.rules)) {
    return { rules: fallback.rules, safety };
  }

  const cleanRules: TacticsRule[] = [];
  for (const item of obj.rules) {
    if (cleanRules.length >= BALANCE_CONFIG.maxTacticsRules) break;
    if (!item || typeof item !== 'object') continue;
    const r = item as Partial<TacticsRule>;
    const condKind: TacticsConditionKind = VALID_CONDITIONS.has(
      r.condition?.kind as TacticsConditionKind
    )
      ? (r.condition!.kind as TacticsConditionKind)
      : 'always';

    const condition: TacticsCondition = { kind: condKind };
    if (typeof r.condition?.value === 'number' && Number.isFinite(r.condition.value)) {
      condition.value = Math.max(0, Math.min(999, Math.round(r.condition.value)));
    } else if (
      condKind === 'my_hp_below' ||
      condKind === 'any_ally_hp_below' ||
      condKind === 'target_hp_below'
    ) {
      condition.value = 40;
    } else if (condKind === 'my_sp_pct_gte') {
      condition.value = 50;
    } else if (condKind === 'my_sp_gte' || condKind === 'my_sp_lt') {
      condition.value = 15;
    } else if (condKind === 'enemy_count_gte') {
      condition.value = 2;
    } else if (condKind === 'round_eq') {
      condition.value = 1;
    }

    if (condKind === 'my_buff_not_active') {
      condition.buffType = VALID_BUFFS.has(
        r.condition?.buffType as StatusEffectType
      )
        ? (r.condition!.buffType as StatusEffectType)
        : 'def_up';
    }

    if (condKind === 'skill_off_cooldown' && typeof r.condition?.skillId === 'string') {
      const condSkill = getSkillById(r.condition.skillId);
      if (condSkill && isSkillAllowedForClass(condSkill, classId)) {
        condition.skillId = condSkill.id;
      }
    }

    const actionType: ActionType =
      r.action?.type === 'skill' || r.action?.type === 'defend'
        ? r.action.type
        : 'attack';

    let cleanAction: TacticsRule['action'] = { type: actionType };
    if (actionType === 'skill') {
      const sk =
        typeof r.action?.skillId === 'string'
          ? getSkillById(r.action.skillId)
          : undefined;
      // Strict engine class-lock: cross-class or passive skills are rejected!
      if (!sk || sk.category === 'passive' || !isSkillAllowedForClass(sk, classId)) {
        cleanAction = { type: 'attack' };
      } else {
        cleanAction = { type: 'skill', skillId: sk.id };
      }
    }

    const targetSelector: TacticsTargetSelector = VALID_SELECTORS.has(
      r.targetSelector as TacticsTargetSelector
    )
      ? (r.targetSelector as TacticsTargetSelector)
      : 'lowest_hp_enemy';

    cleanRules.push({
      id: typeof r.id === 'string' && r.id.length > 0 ? r.id : createRuleId('tac'),
      enabled: r.enabled !== false,
      condition,
      action: cleanAction,
      targetSelector,
    });
  }

  const rawProfile = raw as Partial<GearTacticsProfile>;
  const mode: TacticsMode =
    rawProfile.mode === 'custom' ? 'custom' : 'simple';
  const simple = sanitizeSimpleTacticsConfig(classId, rawProfile.simple);

  return { mode, simple, rules: cleanRules, safety };
}

const VALID_SIMPLE_PRESETS = new Set<SimpleTacticsPresetId>([
  'balanced',
  'aggressive',
  'defensive',
  'support_team',
  'save_sp',
]);
const VALID_SIMPLE_TARGETS = new Set<SimpleTargetPref>([
  'weakest',
  'strongest',
  'support_first',
  'sniper_first',
  'front_row',
]);
const VALID_SIMPLE_SKILL_USAGE = new Set<SimpleSkillUsage>([
  'always',
  'save_sp_50',
  'needed_only',
]);
const VALID_SIMPLE_LOW_HP = new Set<SimpleLowHpAction>([
  'defend',
  'heal',
  'retreat',
  'nothing',
]);
const VALID_SIMPLE_ELITE = new Set<SimpleElitePolicy>([
  'immediate',
  'boss_only',
  'off',
]);

export function mapSimpleTargetToSelector(
  pref: SimpleTargetPref
): TacticsTargetSelector {
  switch (pref) {
    case 'strongest':
      return 'highest_hp_enemy';
    case 'support_first':
      return 'enemy_support_first';
    case 'sniper_first':
      return 'enemy_sniper_first';
    case 'front_row':
      return 'front_row_first';
    case 'weakest':
    default:
      return 'lowest_hp_enemy';
  }
}

export function createSimplePresetConfig(
  presetId: SimpleTacticsPresetId,
  classId: MechClassId,
  equippedSkillBar: string[] = []
): SimpleTacticsConfig {
  const allowedBar = equippedSkillBar.filter((id) => {
    const sk = getSkillById(id);
    return Boolean(
      sk &&
        sk.category !== 'passive' &&
        isSkillAllowedForClass(sk, classId)
    );
  });

  const nonEliteBar = allowedBar.filter((id) => {
    const sk = getSkillById(id);
    return sk && sk.category !== 'elite' && sk.category !== 'special';
  });

  const defaultPriority = (nonEliteBar.length > 0 ? nonEliteBar : allowedBar).slice(
    0,
    MAX_PRIORITY_SKILLS
  );

  const defaultLidarAuto = { ...DEFAULT_LIDAR_AUTO_CONFIG };
  const defaultFluxAuto = { ...DEFAULT_FLUX_AUTO_CONFIG };
  const defaultAutoSupplies = { ...DEFAULT_AUTO_SUPPLIES_CONFIG };

  switch (presetId) {
    case 'aggressive':
      return {
        presetId: 'aggressive',
        preferredTarget: classId === 'interceptor' ? 'sniper_first' : 'weakest',
        skillUsage: 'always',
        lowHpThresholdPct: 25,
        lowHpAction: 'nothing',
        elitePolicy: 'immediate',
        prioritySkillIds: defaultPriority,
        lidarAuto: defaultLidarAuto,
        fluxAuto: defaultFluxAuto,
        autoSupplies: defaultAutoSupplies,
      };
    case 'defensive':
      return {
        presetId: 'defensive',
        preferredTarget: 'front_row',
        skillUsage: 'save_sp_50',
        lowHpThresholdPct: 45,
        lowHpAction: classId === 'support' ? 'heal' : 'defend',
        elitePolicy: 'boss_only',
        prioritySkillIds: defaultPriority.slice(0, 2),
        lidarAuto: defaultLidarAuto,
        fluxAuto: defaultFluxAuto,
        autoSupplies: defaultAutoSupplies,
      };
    case 'support_team':
      return {
        presetId: 'support_team',
        preferredTarget: 'support_first',
        skillUsage: 'always',
        lowHpThresholdPct: 40,
        lowHpAction: classId === 'support' ? 'heal' : 'defend',
        elitePolicy: 'boss_only',
        prioritySkillIds: defaultPriority,
        lidarAuto: defaultLidarAuto,
        fluxAuto: defaultFluxAuto,
        autoSupplies: defaultAutoSupplies,
      };
    case 'save_sp':
      return {
        presetId: 'save_sp',
        preferredTarget: 'weakest',
        skillUsage: 'save_sp_50',
        lowHpThresholdPct: 35,
        lowHpAction: 'defend',
        elitePolicy: 'boss_only',
        prioritySkillIds: defaultPriority.slice(0, 2),
        lidarAuto: defaultLidarAuto,
        fluxAuto: defaultFluxAuto,
        autoSupplies: defaultAutoSupplies,
      };
    case 'balanced':
    default:
      return {
        presetId: 'balanced',
        preferredTarget:
          classId === 'interceptor'
            ? 'sniper_first'
            : classId === 'support'
            ? 'support_first'
            : 'weakest',
        skillUsage: 'always',
        lowHpThresholdPct: 35,
        lowHpAction: classId === 'support' ? 'heal' : 'defend',
        elitePolicy: 'boss_only',
        prioritySkillIds: defaultPriority,
        lidarAuto: defaultLidarAuto,
        fluxAuto: defaultFluxAuto,
        autoSupplies: defaultAutoSupplies,
      };
  }
}

export function createDefaultSimpleTactics(
  classId: MechClassId,
  equippedSkillBar: string[] = []
): SimpleTacticsConfig {
  const defaultPreset: SimpleTacticsPresetId =
    classId === 'support'
      ? 'support_team'
      : classId === 'siege'
      ? 'defensive'
      : 'balanced';
  return createSimplePresetConfig(defaultPreset, classId, equippedSkillBar);
}

export function sanitizeSimpleTacticsConfig(
  classId: MechClassId,
  raw: unknown,
  equippedSkillBar?: string[]
): SimpleTacticsConfig {
  const fallback = createDefaultSimpleTactics(classId, equippedSkillBar ?? []);
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<SimpleTacticsConfig>;

  const presetId: SimpleTacticsPresetId = VALID_SIMPLE_PRESETS.has(
    obj.presetId as SimpleTacticsPresetId
  )
    ? (obj.presetId as SimpleTacticsPresetId)
    : fallback.presetId;
  const preferredTarget: SimpleTargetPref = VALID_SIMPLE_TARGETS.has(
    obj.preferredTarget as SimpleTargetPref
  )
    ? (obj.preferredTarget as SimpleTargetPref)
    : fallback.preferredTarget;
  const skillUsage: SimpleSkillUsage = VALID_SIMPLE_SKILL_USAGE.has(
    obj.skillUsage as SimpleSkillUsage
  )
    ? (obj.skillUsage as SimpleSkillUsage)
    : fallback.skillUsage;
  const lowHpAction: SimpleLowHpAction = VALID_SIMPLE_LOW_HP.has(
    obj.lowHpAction as SimpleLowHpAction
  )
    ? (obj.lowHpAction as SimpleLowHpAction)
    : fallback.lowHpAction;
  const elitePolicy: SimpleElitePolicy = VALID_SIMPLE_ELITE.has(
    obj.elitePolicy as SimpleElitePolicy
  )
    ? (obj.elitePolicy as SimpleElitePolicy)
    : fallback.elitePolicy;
  const lowHpThresholdPct = Math.max(
    10,
    Math.min(80, Number(obj.lowHpThresholdPct) || fallback.lowHpThresholdPct)
  );

  const prioritySkillIds: string[] = [];
  if (Array.isArray(obj.prioritySkillIds)) {
    for (const sid of obj.prioritySkillIds) {
      if (typeof sid !== 'string' || prioritySkillIds.includes(sid)) continue;
      const sk = getSkillById(sid);
      if (
        sk &&
        sk.category !== 'passive' &&
        isSkillAllowedForClass(sk, classId) &&
        (!equippedSkillBar || equippedSkillBar.includes(sid))
      ) {
        prioritySkillIds.push(sid);
      }
      if (prioritySkillIds.length >= MAX_PRIORITY_SKILLS) break;
    }
  }

  const lidarAuto = sanitizeLidarAutoConfig(obj.lidarAuto);
  const fluxAuto = sanitizeFluxAutoConfig(obj.fluxAuto);
  const autoSupplies = sanitizeAutoSuppliesConfig(obj.autoSupplies);

  return {
    presetId,
    preferredTarget,
    skillUsage,
    lowHpThresholdPct,
    lowHpAction,
    elitePolicy,
    prioritySkillIds,
    lidarAuto,
    fluxAuto,
    autoSupplies,
  };
}

function getDefaultTargetForSkill(
  skill: SkillDefinition,
  enemySelector: TacticsTargetSelector
): TacticsTargetSelector {
  if (skill.targetType === 'self') return 'self';
  if (skill.targetType === 'single_ally') return 'lowest_hp_ally';
  if (skill.targetType === 'all_allies') return 'all_allies';
  return enemySelector;
}

function getBuffTypeForSkill(skill: SkillDefinition): StatusEffectType | null {
  switch (skill.effectKind) {
    case 'buff_def':
    case 'team_def_up':
      return 'def_up';
    case 'buff_eva':
    case 'team_eva_up':
      return 'eva_up';
    case 'buff_speed':
      return 'spd_up';
    case 'buff_primary_dmg':
      return 'primary_dmg_up';
    case 'buff_skill_dmg':
      return 'skill_dmg_up';
    case 'team_atk_up':
      return 'atk_up';
    case 'toggle_siege_mode':
      return 'siege_mode';
    case 'toggle_siege_defense':
      return 'siege_defense';
    case 'stealth_turns':
    case 'stealth_until_attack':
      return 'stealth';
    case 'counter_stance':
      return 'counter';
    case 'buff_sure_hit':
      return 'sure_hit';
    case 'heal_field_hot':
      return 'regen_hp';
    default:
      return null;
  }
}

/**
 * Pure generator: compiles a user-friendly SimpleTacticsConfig into the canonical
 * TacticsRule[] list (max 8 rules) and AutoSafetyConfig used by chooseAction().
 */
export function generateTacticsFromSimple(
  classId: MechClassId,
  rawSimple: SimpleTacticsConfig,
  equippedSkillBar: string[],
  baseSafety?: AutoSafetyConfig
): GearTacticsProfile {
  const simple = sanitizeSimpleTacticsConfig(classId, rawSimple, equippedSkillBar);
  const enemySelector = mapSimpleTargetToSelector(simple.preferredTarget);
  const rules: TacticsRule[] = [];
  const addedSkillIds = new Set<string>();

  const safety: AutoSafetyConfig = {
    ...(baseSafety ?? createDefaultAutoSafety()),
    autoRetreatLowHpEnabled: simple.lowHpAction === 'retreat',
    autoRetreatLowHpPct:
      simple.lowHpAction === 'retreat'
        ? simple.lowHpThresholdPct
        : baseSafety?.autoRetreatLowHpPct ?? 15,
  };

  const allowedBarSkills = equippedSkillBar
    .map((id) => getSkillById(id))
    .filter(
      (sk): sk is SkillDefinition =>
        Boolean(sk && sk.category !== 'passive' && isSkillAllowedForClass(sk, classId))
    );

  // 1. Low HP Survival Rule (highest priority)
  if (simple.lowHpAction === 'defend') {
    rules.push(
      makeRule(
        createRuleId('sim_lowhp'),
        { kind: 'my_hp_below', value: simple.lowHpThresholdPct },
        { type: 'defend' },
        'self'
      )
    );
  } else if (simple.lowHpAction === 'heal') {
    const selfHealSkill = allowedBarSkills.find(
      (s) =>
        s.effectKind === 'heal_single' ||
        s.effectKind === 'heal_field_hot' ||
        s.effectKind === 'full_recovery_elite' ||
        s.effectKind === 'invincible_ally'
    );
    if (selfHealSkill) {
      rules.push(
        makeRule(
          createRuleId('sim_heal'),
          { kind: 'my_hp_below', value: simple.lowHpThresholdPct },
          { type: 'skill', skillId: selfHealSkill.id },
          selfHealSkill.targetType === 'all_allies' ? 'all_allies' : 'self'
        )
      );
    }
    rules.push(
      makeRule(
        createRuleId('sim_lowdef'),
        { kind: 'my_hp_below', value: Math.max(10, simple.lowHpThresholdPct - 10) },
        { type: 'defend' },
        'self'
      )
    );
  }

  // 2. Support-team emergency heal / cleanse if Support preset is active
  if (simple.presetId === 'support_team') {
    const allyHeal = allowedBarSkills.find(
      (s) => s.effectKind === 'heal_single' || s.effectKind === 'heal_field_hot'
    );
    if (allyHeal) {
      rules.push(
        makeRule(
          createRuleId('sim_supheal'),
          { kind: 'any_ally_hp_below', value: 55 },
          { type: 'skill', skillId: allyHeal.id },
          allyHeal.targetType === 'all_allies' ? 'all_allies' : 'lowest_hp_ally'
        )
      );
      addedSkillIds.add(allyHeal.id);
    }
    const purify = allowedBarSkills.find((s) => s.effectKind === 'purify_team');
    if (purify) {
      rules.push(
        makeRule(
          createRuleId('sim_purify'),
          { kind: 'any_ally_has_debuff' },
          { type: 'skill', skillId: purify.id },
          'all_allies'
        )
      );
      addedSkillIds.add(purify.id);
    }
  }

  // 3. Elite & Special Skills Policy
  if (simple.elitePolicy !== 'off') {
    const eliteSkills = allowedBarSkills.filter(
      (s) => s.category === 'elite' || s.category === 'special'
    );
    for (const sk of eliteSkills) {
      if (rules.length >= BALANCE_CONFIG.maxTacticsRules - 1) break;
      const cond: TacticsCondition =
        simple.elitePolicy === 'boss_only'
          ? { kind: 'boss_present' }
          : sk.effectKind === 'full_recovery_elite'
          ? { kind: 'any_ally_hp_below', value: 45 }
          : { kind: 'always' };
      rules.push(
        makeRule(
          createRuleId('sim_elite'),
          cond,
          { type: 'skill', skillId: sk.id },
          getDefaultTargetForSkill(sk, enemySelector)
        )
      );
      addedSkillIds.add(sk.id);
    }
  }

  // 4. Priority Skills (A > B > C) from equipped bar
  const orderedPrioritySkills = simple.prioritySkillIds
    .map((id) => getSkillById(id))
    .filter(
      (sk): sk is SkillDefinition =>
        Boolean(
          sk &&
            sk.category !== 'passive' &&
            isSkillAllowedForClass(sk, classId) &&
            equippedSkillBar.includes(sk.id) &&
            !(
              simple.elitePolicy === 'off' &&
              (sk.category === 'elite' || sk.category === 'special')
            )
        )
    );

  for (const sk of orderedPrioritySkills) {
    if (rules.length >= BALANCE_CONFIG.maxTacticsRules - 1) break;
    if (addedSkillIds.has(sk.id)) continue;

    let cond: TacticsCondition;
    if (
      sk.effectKind === 'heal_single' ||
      sk.effectKind === 'heal_field_hot' ||
      sk.effectKind === 'full_recovery_elite'
    ) {
      const thresh =
        simple.skillUsage === 'needed_only'
          ? 45
          : simple.skillUsage === 'save_sp_50'
          ? 55
          : 70;
      cond = { kind: 'any_ally_hp_below', value: thresh };
    } else if (sk.effectKind === 'purify_team') {
      cond = { kind: 'any_ally_has_debuff' };
    } else if (sk.effectKind === 'scan_reveal') {
      cond = { kind: 'any_enemy_stealthed' };
    } else if (simple.skillUsage === 'save_sp_50') {
      cond = { kind: 'my_sp_pct_gte', value: 50 };
    } else if (simple.skillUsage === 'needed_only') {
      const buffType = getBuffTypeForSkill(sk);
      if (buffType) {
        cond = { kind: 'my_buff_not_active', buffType };
      } else {
        cond = { kind: 'target_hp_below', value: 55 };
      }
    } else {
      const buffType = getBuffTypeForSkill(sk);
      cond = buffType
        ? { kind: 'my_buff_not_active', buffType }
        : { kind: 'always' };
    }

    rules.push(
      makeRule(
        createRuleId('sim_prio'),
        cond,
        { type: 'skill', skillId: sk.id },
        getDefaultTargetForSkill(sk, enemySelector)
      )
    );
    addedSkillIds.add(sk.id);
  }

  // 5. Fallback Basic Attack on Preferred Target
  rules.push(
    makeRule(
      createRuleId('sim_atk'),
      { kind: 'always' },
      { type: 'attack' },
      enemySelector
    )
  );

  return {
    mode: 'simple',
    simple,
    rules: rules.slice(0, BALANCE_CONFIG.maxTacticsRules),
    safety,
  };
}

export interface AutoSafetyEvaluation {
  shouldStopAuto: boolean;
  shouldRetreat: boolean;
  reason: AutoStopReason | null;
}

/**
 * Evaluates Auto-battle safety rules before executing the player's Auto turn.
 */
export function evaluateAutoSafety(
  state: BattleState,
  actor: CombatUnit,
  safety: AutoSafetyConfig,
  adminConfig?: Pick<AdminConfig, 'spEconomy'> | null
): AutoSafetyEvaluation {
  const hpPct =
    actor.derived.maxHp > 0 ? (actor.hp / actor.derived.maxHp) * 100 : 0;

  if (safety.autoRetreatLowHpEnabled && hpPct < safety.autoRetreatLowHpPct) {
    return {
      shouldStopAuto: true,
      shouldRetreat: true,
      reason: 'auto_retreat',
    };
  }

  if (safety.stopOnLowHpEnabled && hpPct < safety.stopOnLowHpPct) {
    return {
      shouldStopAuto: true,
      shouldRetreat: false,
      reason: 'low_hp',
    };
  }

  if (
    safety.stopOnBossPresent &&
    state.units.some((u) => u.side !== actor.side && u.alive && u.isBoss)
  ) {
    return {
      shouldStopAuto: true,
      shouldRetreat: false,
      reason: 'boss_present',
    };
  }

  if (safety.stopOnEliteReady) {
    const eliteReady = actor.equippedSkillIds.some((sid) => {
      const sk = getSkillById(sid);
      return sk?.category === 'elite' && canUnitUseSkill(actor, sid, adminConfig).canUse;
    });
    if (eliteReady) {
      return {
        shouldStopAuto: true,
        shouldRetreat: false,
        reason: 'elite_ready',
      };
    }
  }

  return { shouldStopAuto: false, shouldRetreat: false, reason: null };
}

export const AUTO_REPEAT_MAX_DEFEAT_STREAK = DEFAULT_DEFEAT_STREAK_LIMIT;

/**
 * Pure check for whether an Auto-Repeat batch should stop after a battle concludes.
 * Inventory full ALWAYS stops the loop regardless of defeat rule.
 * - 'stop_immediately': stops on first defeat ('defeat')
 * - 'stop_after_n': stops once consecutive defeats reach defeatStreakLimit 1..99 ('defeat_streak')
 * - 'never_stop': never stops on defeat
 */
export function shouldStopAutoRepeat(
  session: AutoRepeatSession,
  outcome: 'victory' | 'defeat',
  retreated: boolean,
  inventoryCount: number,
  maxInventorySize: number = 100,
  defeatRule: AutoRepeatDefeatRule | boolean = 'stop_immediately',
  defeatStreakLimit: number = DEFAULT_DEFEAT_STREAK_LIMIT
): { stop: boolean; reason: AutoStopReason | null } {
  if (retreated) return { stop: true, reason: 'retreat' };
  if (inventoryCount >= maxInventorySize) {
    return { stop: true, reason: 'inventory_full' };
  }

  const resolvedRule: AutoRepeatDefeatRule =
    defeatRule === true
      ? 'stop_immediately'
      : defeatRule === false
      ? 'never_stop'
      : defeatRule;

  if (outcome === 'defeat') {
    if (resolvedRule === 'stop_immediately') {
      return { stop: true, reason: 'defeat' };
    }
    if (resolvedRule === 'stop_after_n') {
      const limit = clampDefeatStreakLimit(defeatStreakLimit);
      if ((session.consecutiveDefeats ?? 0) >= limit) {
        return { stop: true, reason: 'defeat_streak' };
      }
    }
  }

  if (session.limit !== 'infinite' && session.completedRuns >= session.limit) {
    return { stop: true, reason: 'completed' };
  }
  return { stop: false, reason: null };
}

function pickEnemyBySelector(
  state: BattleState,
  actor: CombatUnit,
  selector: TacticsTargetSelector,
  rng: () => number,
  actionType: ActionType = 'attack',
  skillId?: string
): CombatUnit | null {
  const enemies = getValidEnemyTargets(state.units, actor, actionType, skillId);
  if (enemies.length === 0) return null;

  const byIdTie = (a: CombatUnit, b: CombatUnit) => a.id.localeCompare(b.id);

  switch (selector) {
    case 'highest_hp_enemy':
      return [...enemies].sort((a, b) => b.hp - a.hp || byIdTie(a, b))[0];

    case 'highest_atk_enemy':
      return [...enemies].sort(
        (a, b) => b.derived.attackPower - a.derived.attackPower || byIdTie(a, b)
      )[0];

    case 'fastest_enemy':
      return [...enemies].sort(
        (a, b) =>
          getEffectiveUnitSpeed(b) - getEffectiveUnitSpeed(a) || byIdTie(a, b)
      )[0];

    case 'enemy_support_first': {
      const supports = enemies.filter(
        (e) => e.archetype === 'repair_ship' || e.classId === 'support'
      );
      const pool = supports.length > 0 ? supports : enemies;
      return [...pool].sort((a, b) => a.hp - b.hp || byIdTie(a, b))[0];
    }

    case 'enemy_sniper_first': {
      const snipers = enemies.filter(
        (e) => e.archetype === 'sniper' || e.classId === 'interceptor'
      );
      const pool = snipers.length > 0 ? snipers : enemies;
      return [...pool].sort((a, b) => a.hp - b.hp || byIdTie(a, b))[0];
    }

    case 'front_row_first': {
      const front = enemies.filter((e) => e.row === 'front');
      const middle = enemies.filter((e) => e.row === 'middle');
      const pool = front.length > 0 ? front : middle.length > 0 ? middle : enemies;
      return [...pool].sort((a, b) => a.hp - b.hp || byIdTie(a, b))[0];
    }

    case 'back_row_first': {
      const back = enemies.filter((e) => e.row === 'back');
      const middle = enemies.filter((e) => e.row === 'middle');
      const pool = back.length > 0 ? back : middle.length > 0 ? middle : enemies;
      return [...pool].sort((a, b) => a.hp - b.hp || byIdTie(a, b))[0];
    }

    case 'random_enemy': {
      const idx = Math.min(
        enemies.length - 1,
        Math.max(0, Math.floor(rng() * enemies.length))
      );
      return enemies[idx];
    }

    case 'same_as_last_turn': {
      if (state.lastPlayerTargetId) {
        const prev = enemies.find((e) => e.id === state.lastPlayerTargetId);
        if (prev) return prev;
      }
      return [...enemies].sort((a, b) => a.hp - b.hp || byIdTie(a, b))[0];
    }

    case 'lowest_hp_enemy':
    default:
      return [...enemies].sort((a, b) => a.hp - b.hp || byIdTie(a, b))[0];
  }
}

function resolveRuleTarget(
  state: BattleState,
  actor: CombatUnit,
  rule: TacticsRule,
  skillDef: SkillDefinition | undefined,
  rng: () => number
): { targetUnit: CombatUnit | null; targetId: string | null; valid: boolean } {
  const allies = state.units.filter((u) => u.side === actor.side && u.alive);

  if (rule.action.type === 'defend') {
    return { targetUnit: actor, targetId: null, valid: true };
  }

  if (rule.action.type === 'skill' && skillDef) {
    if (skillDef.targetType === 'self') {
      return { targetUnit: actor, targetId: actor.id, valid: true };
    }
    if (skillDef.targetType === 'all_allies') {
      return {
        targetUnit: allies[0] ?? actor,
        targetId: null,
        valid: allies.length > 0,
      };
    }
    if (skillDef.targetType === 'single_ally') {
      if (rule.targetSelector === 'self') {
        return { targetUnit: actor, targetId: actor.id, valid: true };
      }
      const lowestAlly = [...allies].sort(
        (a, b) =>
          a.hp / Math.max(1, a.derived.maxHp) -
            b.hp / Math.max(1, b.derived.maxHp) || a.id.localeCompare(b.id)
      )[0];
      return lowestAlly
        ? { targetUnit: lowestAlly, targetId: lowestAlly.id, valid: true }
        : { targetUnit: null, targetId: null, valid: false };
    }
    // Enemy-targeting skill (single_enemy, multi_enemy, all_enemies)
    const enemy = pickEnemyBySelector(
      state,
      actor,
      rule.targetSelector,
      rng,
      'skill',
      skillDef.id
    );
    return enemy
      ? { targetUnit: enemy, targetId: enemy.id, valid: true }
      : { targetUnit: null, targetId: null, valid: false };
  }

  // Basic attack -> must pick a valid enemy (respecting Front/Back row rules)
  const enemy = pickEnemyBySelector(
    state,
    actor,
    rule.targetSelector,
    rng,
    'attack'
  );
  return enemy
    ? { targetUnit: enemy, targetId: enemy.id, valid: true }
    : { targetUnit: null, targetId: null, valid: false };
}

function evaluateCondition(
  state: BattleState,
  actor: CombatUnit,
  rule: TacticsRule,
  resolvedTarget: CombatUnit | null,
  rng: () => number,
  adminConfig?: Pick<AdminConfig, 'spEconomy'> | null
): boolean {
  const { condition } = rule;
  const allies = state.units.filter((u) => u.side === actor.side && u.alive);
  const aliveEnemies = state.units.filter((u) => u.side !== actor.side && u.alive);
  const myHpPct =
    actor.derived.maxHp > 0 ? (actor.hp / actor.derived.maxHp) * 100 : 0;

  switch (condition.kind) {
    case 'always':
      return true;

    case 'my_hp_below':
      return myHpPct < (condition.value ?? 40);

    case 'my_shield_zero':
      return actor.shield <= 0;

    case 'my_sp_gte':
      return actor.sp >= (condition.value ?? 15);

    case 'my_sp_pct_gte': {
      const spPct =
        actor.derived.maxSp > 0 ? (actor.sp / actor.derived.maxSp) * 100 : 0;
      return spPct >= (condition.value ?? 50);
    }

    case 'my_sp_lt':
      return actor.sp < (condition.value ?? 15);

    case 'any_ally_hp_below': {
      const threshold = condition.value ?? 45;
      return allies.some(
        (a) => a.derived.maxHp > 0 && (a.hp / a.derived.maxHp) * 100 < threshold
      );
    }

    case 'any_ally_has_debuff':
      return allies.some((a) =>
        a.statuses.some((s) => s.turnsRemaining > 0 && DEBUFF_TYPES.has(s.type))
      );

    case 'enemy_count_gte':
      return aliveEnemies.length >= (condition.value ?? 2);

    case 'target_has_shield': {
      const candidate =
        resolvedTarget && resolvedTarget.side !== actor.side
          ? resolvedTarget
          : pickEnemyBySelector(state, actor, rule.targetSelector, rng);
      return Boolean(candidate && candidate.shield > 0);
    }

    case 'target_hp_below': {
      const threshold = condition.value ?? 50;
      const candidate =
        resolvedTarget && resolvedTarget.side !== actor.side
          ? resolvedTarget
          : pickEnemyBySelector(state, actor, rule.targetSelector, rng);
      if (!candidate || candidate.derived.maxHp <= 0) return false;
      return (candidate.hp / candidate.derived.maxHp) * 100 < threshold;
    }

    case 'any_enemy_stealthed':
      return aliveEnemies.some((e) => isUnitStealthed(e));

    case 'round_eq':
      return state.round === (condition.value ?? 1);

    case 'first_round':
      return state.round === 1;

    case 'boss_present':
      return aliveEnemies.some((e) => Boolean(e.isBoss));

    case 'my_buff_not_active': {
      const buffType = condition.buffType ?? 'def_up';
      return !hasStatus(actor, buffType);
    }

    case 'skill_off_cooldown': {
      const checkSkillId =
        condition.skillId ??
        (rule.action.type === 'skill' ? rule.action.skillId : undefined);
      if (!checkSkillId) return false;
      const sk = getSkillById(checkSkillId);
      if (!sk || !isSkillAllowedForClass(sk, actor.classId)) return false;
      return canUnitUseSkill(
        actor,
        checkSkillId,
        adminConfig,
        state.turnLockedSkillIds
      ).canUse;
    }

    default:
      return false;
  }
}

export interface TacticsChoiceResult {
  action: ActionType;
  skillId?: string;
  targetId: string | null;
  matchedRuleIndex: number | null; // 0-based index of matched rule, null if fallback
  matchedRuleId?: string;
}

/**
 * Pure, deterministic Tactics evaluator for the player's Gear in Auto Mode.
 * Evaluates rules top-to-bottom; the first enabled rule whose condition is true
 * AND whose action is usable (SP, cooldown, class-locked, valid target) executes.
 * Fallback: basic Attack on the lowest-HP enemy.
 */
export function chooseAction(
  state: BattleState,
  actor: CombatUnit,
  tactics: GearTacticsProfile,
  rng: () => number = Math.random,
  adminConfig?: Pick<AdminConfig, 'spEconomy' | 'fluxTransfer'> | null
): TacticsChoiceResult {
  const rules = (tactics?.rules ?? []).slice(0, BALANCE_CONFIG.maxTacticsRules);

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule.enabled) continue;

    let skillDef: SkillDefinition | undefined;
    if (rule.action.type === 'skill') {
      const sid = rule.action.skillId;
      if (!sid) continue;
      skillDef = getSkillById(sid);
      // Engine-enforced class lock & active-bar/SP/CD/Silence validation
      if (!skillDef || !isSkillAllowedForClass(skillDef, actor.classId)) {
        continue;
      }
      if (
        !canUnitUseSkill(actor, sid, adminConfig, state.turnLockedSkillIds)
          .canUse
      ) {
        continue;
      }
    }

    const targetRes = resolveRuleTarget(state, actor, rule, skillDef, rng);
    if (!targetRes.valid) continue;

    const condMet = evaluateCondition(
      state,
      actor,
      rule,
      targetRes.targetUnit,
      rng,
      adminConfig
    );
    if (!condMet) continue;

    return {
      action: rule.action.type,
      skillId: rule.action.type === 'skill' ? rule.action.skillId : undefined,
      targetId: targetRes.targetId,
      matchedRuleIndex: i,
      matchedRuleId: rule.id,
    };
  }

  // Fallback: basic Attack on lowest-HP enemy
  const fallbackEnemy = pickEnemyBySelector(state, actor, 'lowest_hp_enemy', rng);
  if (fallbackEnemy) {
    return {
      action: 'attack',
      targetId: fallbackEnemy.id,
      matchedRuleIndex: null,
    };
  }

  return {
    action: 'defend',
    targetId: null,
    matchedRuleIndex: null,
  };
}
