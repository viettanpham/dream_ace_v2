import {
  BALANCE_CONFIG,
  getFluxMinCastCost,
  getSkillPurchaseCost,
  sanitizeSpEconomyConfig,
} from '../data/balance';
import {
  getOpeningCardById,
  getScaledSkillStats,
  getSkillById,
  SKILLS_LIST,
} from '../data/skills';
import type {
  AdminConfig,
  BattleSkillUsability,
  CombatUnit,
  GearUnit,
  MechClassId,
  PilotAccount,
  SkillDefinition,
  SkillValidationResult,
} from '../types/game';

export const MAX_ACTIVE_SKILL_BAR = BALANCE_CONFIG.maxEquippedActiveSkills;

export interface GearPassiveBonuses {
  skillDmgPct: number; // e.g., 0.15 for +15%
  defPct: number; // e.g., 0.12 for +12%
  evaPct: number; // e.g., 0.09 for +9%
  speedPct: number; // e.g., 0.06 for +6%
  spRegenPerTurn: number; // e.g., +3 SP/turn
}

/**
 * Engine rule: A Gear can ONLY learn, equip, or cast skills belonging to its own class + GENERAL.
 */
export function isSkillAllowedForClass(
  skill: SkillDefinition,
  classId: MechClassId
): boolean {
  return skill.classScope === 'general' || skill.classScope === classId;
}

/**
 * Returns all skills belonging to a Gear's class + General skills.
 */
export function getSkillsForClass(classId: MechClassId): SkillDefinition[] {
  return SKILLS_LIST.filter((s) => isSkillAllowedForClass(s, classId));
}

/**
 * Gear level required for skill level n (1..5):
 * requiredGearLevel = unlockLevel + 4 * (n - 1)
 */
export function getRequiredGearLevelForSkillLevel(
  skill: SkillDefinition,
  targetSkillLevel: number
): number {
  const n = Math.max(1, Math.min(BALANCE_CONFIG.skillMaxLevel, targetSkillLevel));
  return skill.unlockLevel + BALANCE_CONFIG.skillLevelReqStep * (n - 1);
}

/**
 * Credits cost to learn (Lv 0->1) or upgrade (Lv n-1 -> n) a skill in the Skill Shop.
 */
export function getSkillLearnOrUpgradeCost(
  skill: SkillDefinition,
  targetSkillLevel: number
): number {
  return getSkillPurchaseCost(skill.category, skill.unlockLevel, targetSkillLevel);
}

/**
 * Computes active passive bonuses for a Gear (passives are always ON once learned).
 * Strictly ignores any passive skill that does not belong to this Gear's class.
 */
export function getGearPassiveBonuses(gear: GearUnit): GearPassiveBonuses {
  let skillDmgPct = 0;
  let defPct = 0;
  let evaPct = 0;
  let speedPct = 0;
  let spRegenPerTurn = 0;

  for (const [skillId, level] of Object.entries(gear.skillLevels)) {
    if (!level || level < 1) continue;
    const skill = getSkillById(skillId);
    if (!skill || skill.category !== 'passive') continue;
    if (!isSkillAllowedForClass(skill, gear.classId)) continue;

    const scaled = getScaledSkillStats(skill, level);
    switch (skill.effectKind) {
      case 'passive_skill_dmg':
        skillDmgPct += scaled.buffMagnitude;
        break;
      case 'passive_def_pct':
        defPct += scaled.buffMagnitude;
        break;
      case 'passive_eva_spd':
        evaPct += scaled.buffMagnitude;
        speedPct += scaled.secondaryMagnitude;
        break;
      case 'passive_sp_regen':
        spRegenPerTurn += scaled.spAmount;
        break;
    }
  }

  return { skillDmgPct, defPct, evaPct, speedPct, spRegenPerTurn };
}

/**
 * Engine-enforced validation for learning or upgrading a skill on a specific Gear.
 */
export function validateLearnOrUpgradeSkill(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string
): SkillValidationResult {
  const gear = pilot.gears[gearId];
  if (!gear || !gear.owned) {
    return { ok: false, reason: 'invalid_gear' };
  }

  const skill = getSkillById(skillId);
  if (!skill) {
    return { ok: false, reason: 'invalid_skill' };
  }

  // Strict class-lock enforcement in engine
  if (!isSkillAllowedForClass(skill, gear.classId)) {
    return { ok: false, reason: 'class_mismatch' };
  }

  const currentLv = gear.skillLevels[skillId] ?? 0;
  if (currentLv >= BALANCE_CONFIG.skillMaxLevel) {
    return { ok: false, reason: 'max_level' };
  }

  const nextLv = currentLv + 1;
  const requiredGearLevel = getRequiredGearLevelForSkillLevel(skill, nextLv);
  const cost = getSkillLearnOrUpgradeCost(skill, nextLv);

  // Special & Elite skills require owning their Opening Card (bought with War Points)
  if (
    currentLv === 0 &&
    skill.openingCardId &&
    !pilot.ownedOpeningCards.includes(skill.openingCardId)
  ) {
    return {
      ok: false,
      reason: 'missing_card',
      requiredCardId: skill.openingCardId,
      requiredGearLevel,
      cost,
    };
  }

  if (gear.level < requiredGearLevel) {
    return {
      ok: false,
      reason: 'level_too_low',
      requiredGearLevel,
      cost,
    };
  }

  if (pilot.credits < cost) {
    return {
      ok: false,
      reason: 'insufficient_credits',
      requiredGearLevel,
      cost,
    };
  }

  return { ok: true, reason: 'ok', requiredGearLevel, cost };
}

/**
 * Pure engine action: Learn or upgrade a skill on a specific Gear using Credits.
 * Newly learned active skills automatically slot into the Gear's bar if there is room (< 6).
 */
export function learnOrUpgradeSkillOnGear(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string
): { pilot: PilotAccount; validation: SkillValidationResult; newLevel: number } {
  const validation = validateLearnOrUpgradeSkill(pilot, gearId, skillId);
  const gear = pilot.gears[gearId];
  const currentLv = gear?.skillLevels[skillId] ?? 0;

  if (!validation.ok || !gear) {
    return { pilot, validation, newLevel: currentLv };
  }

  const skill = getSkillById(skillId)!;
  const nextLv = currentLv + 1;
  const cost = validation.cost ?? 0;

  let nextBar = gear.equippedSkillBar;
  if (
    currentLv === 0 &&
    skill.category !== 'passive' &&
    !nextBar.includes(skillId) &&
    nextBar.length < MAX_ACTIVE_SKILL_BAR
  ) {
    nextBar = [...nextBar, skillId];
  }

  const nextGear: GearUnit = {
    ...gear,
    skillLevels: {
      ...gear.skillLevels,
      [skillId]: nextLv,
    },
    equippedSkillBar: nextBar,
  };

  return {
    pilot: {
      ...pilot,
      credits: pilot.credits - cost,
      gears: {
        ...pilot.gears,
        [gearId]: nextGear,
      },
    },
    validation,
    newLevel: nextLv,
  };
}

/**
 * Engine-enforced validation for equipping an active skill onto a Gear's 6-slot skill bar.
 */
export function validateEquipSkillOnBar(
  gear: GearUnit,
  skillId: string
): SkillValidationResult {
  const skill = getSkillById(skillId);
  if (!skill) {
    return { ok: false, reason: 'invalid_skill' };
  }

  if (!isSkillAllowedForClass(skill, gear.classId)) {
    return { ok: false, reason: 'class_mismatch' };
  }

  if (skill.category === 'passive') {
    return { ok: false, reason: 'is_passive' };
  }

  if ((gear.skillLevels[skillId] ?? 0) < 1) {
    return { ok: false, reason: 'not_learned' };
  }

  if (gear.equippedSkillBar.includes(skillId)) {
    return { ok: false, reason: 'already_equipped' };
  }

  if (gear.equippedSkillBar.length >= MAX_ACTIVE_SKILL_BAR) {
    return { ok: false, reason: 'bar_full' };
  }

  return { ok: true, reason: 'ok' };
}

export function equipSkillToGearBar(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string
): { pilot: PilotAccount; validation: SkillValidationResult } {
  const gear = pilot.gears[gearId];
  if (!gear || !gear.owned) {
    return { pilot, validation: { ok: false, reason: 'invalid_gear' } };
  }

  const validation = validateEquipSkillOnBar(gear, skillId);
  if (!validation.ok) {
    return { pilot, validation };
  }

  return {
    pilot: {
      ...pilot,
      gears: {
        ...pilot.gears,
        [gearId]: {
          ...gear,
          equippedSkillBar: [...gear.equippedSkillBar, skillId],
        },
      },
    },
    validation,
  };
}

export function unequipSkillFromGearBar(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string
): PilotAccount {
  const gear = pilot.gears[gearId];
  if (!gear || !gear.equippedSkillBar.includes(skillId)) return pilot;
  return {
    ...pilot,
    gears: {
      ...pilot.gears,
      [gearId]: {
        ...gear,
        equippedSkillBar: gear.equippedSkillBar.filter((id) => id !== skillId),
      },
    },
  };
}

/**
 * War Point Shop purchase of an Opening Card for Special/Elite skills.
 */
export function buyOpeningCard(
  pilot: PilotAccount,
  cardId: string
): {
  pilot: PilotAccount;
  ok: boolean;
  reason: 'ok' | 'invalid_card' | 'already_owned' | 'insufficient_wp';
  cost: number;
} {
  const card = getOpeningCardById(cardId);
  if (!card) {
    return { pilot, ok: false, reason: 'invalid_card', cost: 0 };
  }

  if (pilot.ownedOpeningCards.includes(card.id)) {
    return { pilot, ok: false, reason: 'already_owned', cost: card.warPointCost };
  }

  if (pilot.warPoints < card.warPointCost) {
    return {
      pilot,
      ok: false,
      reason: 'insufficient_wp',
      cost: card.warPointCost,
    };
  }

  return {
    pilot: {
      ...pilot,
      warPoints: pilot.warPoints - card.warPointCost,
      ownedOpeningCards: [...pilot.ownedOpeningCards, card.id],
    },
    ok: true,
    reason: 'ok',
    cost: card.warPointCost,
  };
}

export function getEffectiveSpCost(
  skill: SkillDefinition,
  unit: Pick<CombatUnit, 'level'> & { statuses?: CombatUnit['statuses'] },
  admin?: Pick<AdminConfig, 'spEconomy'> | null
): number {
  if (skill.spCost <= 0) return 0;
  const isToggleActive = Boolean(
    unit.statuses &&
      ((skill.effectKind === 'toggle_siege_mode' &&
        unit.statuses.some((s) => s.type === 'siege_mode')) ||
        (skill.effectKind === 'toggle_siege_defense' &&
          unit.statuses.some((s) => s.type === 'siege_defense')))
  );
  if (isToggleActive) return 0;
  const cfg = sanitizeSpEconomyConfig(admin?.spEconomy);
  return Math.round(
    skill.spCost * (1 + cfg.costLevelPct * Math.max(0, unit.level - 1))
  );
}

/**
 * Pure battle usability check for a unit casting `skillId`.
 * Enforces class-lock, bar membership, Silence, Charging lock, Cooldown,
 * Once-per-battle, Camouflage-vs-SiegeMode conflict, and SP cost.
 */
export function canUnitUseSkill(
  unit: CombatUnit,
  skillId: string,
  admin?: Pick<AdminConfig, 'spEconomy' | 'fluxTransfer'> | null
): BattleSkillUsability {
  const skill = getSkillById(skillId);
  if (!skill || skill.category === 'passive') {
    return {
      canUse: false,
      reason: 'not_equipped',
      cooldownRemaining: 0,
      spCost: 0,
    };
  }

  const isToggleActive =
    (skill.effectKind === 'toggle_siege_mode' &&
      unit.statuses.some((s) => s.type === 'siege_mode')) ||
    (skill.effectKind === 'toggle_siege_defense' &&
      unit.statuses.some((s) => s.type === 'siege_defense'));

  const effectiveSpCost = getEffectiveSpCost(skill, unit, admin);

  if (!isSkillAllowedForClass(skill, unit.classId)) {
    return {
      canUse: false,
      reason: 'class_mismatch',
      cooldownRemaining: 0,
      spCost: effectiveSpCost,
    };
  }

  if (!unit.equippedSkillIds.includes(skillId)) {
    return {
      canUse: false,
      reason: 'not_equipped',
      cooldownRemaining: 0,
      spCost: effectiveSpCost,
    };
  }

  const cd = unit.skillCooldowns[skillId] ?? 0;

  if (unit.statuses.some((s) => s.type === 'charging')) {
    return {
      canUse: false,
      reason: 'charging',
      cooldownRemaining: cd,
      spCost: effectiveSpCost,
      isToggleActive,
    };
  }

  if (unit.statuses.some((s) => s.type === 'silence')) {
    return {
      canUse: false,
      reason: 'silenced',
      cooldownRemaining: cd,
      spCost: effectiveSpCost,
      isToggleActive,
    };
  }

  if (skill.oncePerBattle && unit.usedOnceSkills.includes(skillId)) {
    return {
      canUse: false,
      reason: 'already_used',
      cooldownRemaining: cd,
      spCost: effectiveSpCost,
      isToggleActive,
    };
  }

  if (cd > 0) {
    return {
      canUse: false,
      reason: 'on_cooldown',
      cooldownRemaining: cd,
      spCost: effectiveSpCost,
      isToggleActive,
    };
  }

  // Camouflage cannot be used while in Siege Mode
  if (
    skill.effectKind === 'stealth_until_attack' &&
    unit.statuses.some((s) => s.type === 'siege_mode')
  ) {
    return {
      canUse: false,
      reason: 'blocked_by_siege',
      cooldownRemaining: cd,
      spCost: effectiveSpCost,
      isToggleActive,
    };
  }

  if (unit.sp < effectiveSpCost) {
    return {
      canUse: false,
      reason: 'insufficient_sp',
      cooldownRemaining: cd,
      spCost: effectiveSpCost,
      isToggleActive,
    };
  }

  if (skill.effectKind === 'sp_transfer') {
    const skillLv = unit.skillLevels[skill.id] ?? unit.skillLevel ?? 1;
    const minCost = getFluxMinCastCost(
      unit.sp,
      skillLv,
      admin?.fluxTransfer,
      BALANCE_CONFIG.skillMaxLevel
    );
    if (unit.sp < minCost) {
      return {
        canUse: false,
        reason: 'flux_min_sp',
        cooldownRemaining: cd,
        spCost: minCost,
        isToggleActive,
      };
    }
  }

  return {
    canUse: true,
    reason: 'ok',
    cooldownRemaining: 0,
    spCost: effectiveSpCost,
    isToggleActive,
  };
}
