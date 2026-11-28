import {
  ACTIVE_SLOTS_HARD_MAX,
  BALANCE_CONFIG,
  getEffectiveSkillMaxLevel,
  getFluxMinCastCost,
  getSkillPurchaseCost,
  getUnlockedActiveSlots,
  getUnlockedPassiveSlots,
  sanitizeSkillCardPriceMult,
  sanitizeSkillWpCostFactor,
  sanitizeSpEconomyConfig,
} from '../data/balance';
import {
  getMergedSkills,
  getOpeningCardById,
  getScaledSkillStats,
  getSkillById,
  getSkillCardId,
  getSkillCardPrice,
  getSkillTier,
  type SkillModsSource,
} from '../data/skills';
import type {
  ActiveSlotsConfig,
  AdminConfig,
  BattleSkillUsability,
  CombatUnit,
  GearUnit,
  MechClassId,
  PilotAccount,
  SkillDefinition,
  SkillValidationResult,
} from '../types/game';

export const MAX_ACTIVE_SKILL_BAR = ACTIVE_SLOTS_HARD_MAX;

function extractActiveSlotsConfig(
  source?: SkillModsSource
): Partial<ActiveSlotsConfig> | null | undefined {
  if (!source || Array.isArray(source) || typeof source !== 'object') {
    return undefined;
  }
  return 'activeSlots' in source
    ? (source as { activeSlots?: Partial<ActiveSlotsConfig> | null }).activeSlots
    : undefined;
}

export interface GearPassiveBonuses {
  skillDmgPct: number; // e.g., 0.15 for +15%
  attackPct: number; // e.g., 0.15 for +15%
  defPct: number; // e.g., 0.12 for +12%
  evaPct: number; // e.g., 0.09 for +9%
  speedPct: number; // e.g., 0.06 for +6%
  speedFlat: number; // e.g., +3 SPD
  spRegenPerTurn: number; // e.g., +3 SP/turn (legacy + spRegenFlat)
  spRegenFlat: number; // e.g., +3 SP/turn from passive_stat
  maxHpPct: number; // e.g., 0.09 for +9%
  maxShieldPct: number; // e.g., 0.15 for +15%
  critFlat: number; // e.g., +4.5% crit chance
  critDamagePct: number; // e.g., +25% crit damage
  dodgeFlat: number; // e.g., +5% dodge chance
  armorPierceFlat: number; // e.g., +6% armor pierce
  healPowerPct: number; // e.g., +30% heal power
  shieldPowerPct: number; // e.g., +30% shield restore power
  shieldRegenPctAdd: number; // e.g., +1.5% per-turn shield regen + cap
  hpRegenPctAdd: number; // e.g., +0.9% own-turn-start self HP regen
  executeDmgPct: number; // e.g., +30% dmg vs <30% HP targets
  lastStandDefPct: number; // e.g., +18% own DEF when <30% HP
}

export function createEmptyGearPassiveBonuses(): GearPassiveBonuses {
  return {
    skillDmgPct: 0,
    attackPct: 0,
    defPct: 0,
    evaPct: 0,
    speedPct: 0,
    speedFlat: 0,
    spRegenPerTurn: 0,
    spRegenFlat: 0,
    maxHpPct: 0,
    maxShieldPct: 0,
    critFlat: 0,
    critDamagePct: 0,
    dodgeFlat: 0,
    armorPierceFlat: 0,
    healPowerPct: 0,
    shieldPowerPct: 0,
    shieldRegenPctAdd: 0,
    hpRegenPctAdd: 0,
    executeDmgPct: 0,
    lastStandDefPct: 0,
  };
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
 * Returns all skills belonging to a Gear's class + General skills (merging enabled admin skill mods).
 */
export function getSkillsForClass(
  classId: MechClassId,
  skillModsOrAdmin?: SkillModsSource
): SkillDefinition[] {
  return getMergedSkills(skillModsOrAdmin).filter((s) =>
    isSkillAllowedForClass(s, classId)
  );
}

/**
 * Gear level required for skill level n (1..cap):
 * requiredGearLevel = unlockLevel + 4 * (n - 1)
 */
export function getRequiredGearLevelForSkillLevel(
  skill: SkillDefinition,
  targetSkillLevel: number,
  adminOrCap?: Pick<AdminConfig, 'skillMaxLevel'> | number | null
): number {
  const maxLv = getEffectiveSkillMaxLevel(adminOrCap);
  const n = Math.max(1, Math.min(maxLv, Math.floor(targetSkillLevel || 1)));
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
 * War Points cost to learn or upgrade a WP-tier skill:
 * max(1, ceil(creditCost * skillWpCostFactor * skillCardPriceMult))
 */
export function getSkillWpLearnOrUpgradeCost(
  skill: SkillDefinition,
  targetSkillLevel: number,
  admin?: Pick<AdminConfig, 'skillWpCostFactor' | 'skillCardPriceMult'> | null
): number {
  const creditCost = getSkillLearnOrUpgradeCost(skill, targetSkillLevel);
  const wpFactor = sanitizeSkillWpCostFactor(admin?.skillWpCostFactor);
  const cardMult = sanitizeSkillCardPriceMult(admin?.skillCardPriceMult);
  return Math.max(1, Math.ceil(creditCost * wpFactor * cardMult));
}

/**
 * Computes active passive bonuses for a Gear from equipped passives (up to unlocked slots).
 * Strictly ignores unequipped passives, locked overflow slots, duplicates, and cross-class skills.
 */
export function getGearPassiveBonuses(
  gear: Pick<GearUnit, 'classId' | 'level' | 'skillLevels' | 'equippedPassives'>,
  admin?: Pick<
    AdminConfig,
    'skillMaxLevel' | 'passiveScaleAfter5' | 'restorePctCap' | 'passiveSlots' | 'skillMods'
  > | null
): GearPassiveBonuses {
  const bonuses = createEmptyGearPassiveBonuses();
  let legacySpRegen = 0;

  const unlockedSlots = getUnlockedPassiveSlots(gear.level, admin?.passiveSlots);
  const rawEquipped = Array.isArray(gear.equippedPassives)
    ? gear.equippedPassives.filter(
        (id) => !(typeof id === 'string' && id.startsWith('mod_') && !getSkillById(id, admin))
      )
    : [];
  const activeSlice = rawEquipped.slice(0, unlockedSlots);
  const seen = new Set<string>();

  for (const skillId of activeSlice) {
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);
    const level = gear.skillLevels[skillId] ?? 0;
    if (!level || level < 1) continue;
    const skill = getSkillById(skillId, admin);
    if (!skill || skill.category !== 'passive') continue;
    if (!isSkillAllowedForClass(skill, gear.classId)) continue;

    const scaled = getScaledSkillStats(skill, level, admin);
    switch (skill.effectKind) {
      case 'passive_skill_dmg':
        bonuses.skillDmgPct += scaled.buffMagnitude;
        break;
      case 'passive_def_pct':
        bonuses.defPct += scaled.buffMagnitude;
        break;
      case 'passive_eva_spd':
        bonuses.evaPct += scaled.buffMagnitude;
        bonuses.speedPct += scaled.secondaryMagnitude;
        break;
      case 'passive_sp_regen':
        legacySpRegen += scaled.spAmount;
        break;
      case 'passive_stat': {
        for (const entry of scaled.passiveStats ?? []) {
          switch (entry.key) {
            case 'attackPct':
              bonuses.attackPct += entry.value / 100;
              break;
            case 'defPct':
              bonuses.defPct += entry.value / 100;
              break;
            case 'evaPct':
              bonuses.evaPct += entry.value / 100;
              break;
            case 'maxHpPct':
              bonuses.maxHpPct += entry.value / 100;
              break;
            case 'maxShieldPct':
              bonuses.maxShieldPct += entry.value / 100;
              break;
            case 'speedFlat':
              bonuses.speedFlat += entry.value;
              break;
            case 'spRegenFlat':
              bonuses.spRegenFlat += entry.value;
              break;
            case 'critFlat':
              bonuses.critFlat += entry.value;
              break;
            case 'critDamagePct':
              bonuses.critDamagePct += entry.value;
              break;
            case 'dodgeFlat':
              bonuses.dodgeFlat += entry.value;
              break;
            case 'armorPierceFlat':
              bonuses.armorPierceFlat += entry.value;
              break;
            case 'healPowerPct':
              bonuses.healPowerPct += entry.value;
              break;
            case 'shieldPowerPct':
              bonuses.shieldPowerPct += entry.value;
              break;
            case 'shieldRegenPctAdd':
              bonuses.shieldRegenPctAdd += entry.value;
              break;
            case 'hpRegenPctAdd':
              bonuses.hpRegenPctAdd += entry.value;
              break;
            case 'executeDmgPct':
              bonuses.executeDmgPct += entry.value;
              break;
            case 'lastStandDefPct':
              bonuses.lastStandDefPct += entry.value;
              break;
          }
        }
        break;
      }
    }
  }

  bonuses.spRegenPerTurn = legacySpRegen + bonuses.spRegenFlat;
  return bonuses;
}

/**
 * Engine-enforced validation for learning or upgrading a skill on a specific Gear.
 */
export function validateLearnOrUpgradeSkill(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string,
  admin?: Pick<
    AdminConfig,
    | 'skillMaxLevel'
    | 'skillMods'
    | 'skillTiers'
    | 'skillWpCostFactor'
    | 'skillCardPriceMult'
  > | null
): SkillValidationResult {
  const gear = pilot.gears[gearId];
  if (!gear || !gear.owned) {
    return { ok: false, reason: 'invalid_gear' };
  }

  const skill = getSkillById(skillId, admin);
  if (!skill) {
    return { ok: false, reason: 'invalid_skill' };
  }

  // Strict class-lock enforcement in engine
  if (!isSkillAllowedForClass(skill, gear.classId)) {
    return { ok: false, reason: 'class_mismatch' };
  }

  const maxSkillLv = getEffectiveSkillMaxLevel(admin);
  const currentLv = gear.skillLevels[skillId] ?? 0;
  if (currentLv >= maxSkillLv) {
    return { ok: false, reason: 'max_level' };
  }

  const nextLv = currentLv + 1;
  const requiredGearLevel = getRequiredGearLevelForSkillLevel(
    skill,
    nextLv,
    maxSkillLv
  );
  const tier = getSkillTier(skill, gear.classId, admin);
  const cost = getSkillLearnOrUpgradeCost(skill, nextLv);
  const wpCost =
    tier === 'wp' ? getSkillWpLearnOrUpgradeCost(skill, nextLv, admin) : undefined;
  const requiredCardId = tier === 'card' ? getSkillCardId(skill) : undefined;

  // Card-tier skills require owning their Skill Card as a permanent licence for BOTH learn & upgrade
  if (
    tier === 'card' &&
    requiredCardId &&
    !pilot.ownedOpeningCards.includes(requiredCardId)
  ) {
    return {
      ok: false,
      reason: 'missing_card',
      tier,
      requiredCardId,
      requiredGearLevel,
      cost,
    };
  }

  if (gear.level < requiredGearLevel) {
    return {
      ok: false,
      reason: 'level_too_low',
      tier,
      ...(requiredCardId ? { requiredCardId } : {}),
      requiredGearLevel,
      cost,
      ...(wpCost !== undefined ? { wpCost } : {}),
    };
  }

  if (tier === 'wp') {
    if ((pilot.warPoints ?? 0) < (wpCost ?? 0)) {
      return {
        ok: false,
        reason: 'insufficient_wp',
        tier,
        requiredGearLevel,
        cost,
        wpCost,
      };
    }
    return { ok: true, reason: 'ok', tier, requiredGearLevel, cost, wpCost };
  }

  if (pilot.credits < cost) {
    return {
      ok: false,
      reason: 'insufficient_credits',
      tier,
      ...(requiredCardId ? { requiredCardId } : {}),
      requiredGearLevel,
      cost,
    };
  }

  return {
    ok: true,
    reason: 'ok',
    tier,
    ...(requiredCardId ? { requiredCardId } : {}),
    requiredGearLevel,
    cost,
  };
}

/**
 * Pure engine action: Learn or upgrade a skill on a specific Gear using Credits or War Points.
 * Newly learned active skills auto-slot into the Gear's bar if there is room.
 * Newly learned passive skills auto-slot into equippedPassives if there is an open passive slot.
 */
export function learnOrUpgradeSkillOnGear(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string,
  admin?: Pick<
    AdminConfig,
    | 'skillMaxLevel'
    | 'passiveSlots'
    | 'activeSlots'
    | 'skillMods'
    | 'skillTiers'
    | 'skillWpCostFactor'
    | 'skillCardPriceMult'
  > | null
): { pilot: PilotAccount; validation: SkillValidationResult; newLevel: number } {
  const validation = validateLearnOrUpgradeSkill(pilot, gearId, skillId, admin);
  const gear = pilot.gears[gearId];
  const currentLv = gear?.skillLevels[skillId] ?? 0;

  if (!validation.ok || !gear) {
    return { pilot, validation, newLevel: currentLv };
  }

  const skill = getSkillById(skillId, admin)!;
  const nextLv = currentLv + 1;
  const isWpTier = validation.tier === 'wp';
  const creditCost = isWpTier ? 0 : validation.cost ?? 0;
  const wpCost = isWpTier ? validation.wpCost ?? 0 : 0;

  const unlockedActiveSlots = getUnlockedActiveSlots(
    gear.level,
    admin?.activeSlots
  );
  let nextBar = gear.equippedSkillBar;
  if (
    currentLv === 0 &&
    skill.category !== 'passive' &&
    !nextBar.includes(skillId) &&
    nextBar.length < unlockedActiveSlots
  ) {
    nextBar = [...nextBar, skillId];
  }

  let nextPassives = Array.isArray(gear.equippedPassives)
    ? [...gear.equippedPassives]
    : [];
  const unlockedPassiveSlots = getUnlockedPassiveSlots(
    gear.level,
    admin?.passiveSlots
  );
  const activePassivesCount = nextPassives.filter(
    (id) => !(id.startsWith('mod_') && !getSkillById(id, admin))
  ).length;
  if (
    currentLv === 0 &&
    skill.category === 'passive' &&
    !nextPassives.includes(skillId) &&
    activePassivesCount < unlockedPassiveSlots
  ) {
    nextPassives = [...nextPassives, skillId];
  }

  const nextGear: GearUnit = {
    ...gear,
    skillLevels: {
      ...gear.skillLevels,
      [skillId]: nextLv,
    },
    equippedSkillBar: nextBar,
    equippedPassives: nextPassives,
  };

  return {
    pilot: {
      ...pilot,
      credits: pilot.credits - creditCost,
      warPoints: (pilot.warPoints ?? 0) - wpCost,
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
  skillId: string,
  skillModsOrAdmin?: SkillModsSource
): SkillValidationResult {
  const skill = getSkillById(skillId, skillModsOrAdmin);
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

  const unlockedActiveSlots = getUnlockedActiveSlots(
    gear.level,
    extractActiveSlotsConfig(skillModsOrAdmin)
  );
  if (gear.equippedSkillBar.length >= unlockedActiveSlots) {
    return { ok: false, reason: 'bar_full' };
  }

  return { ok: true, reason: 'ok' };
}

export function equipSkillToGearBar(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string,
  skillModsOrAdmin?: SkillModsSource
): { pilot: PilotAccount; validation: SkillValidationResult } {
  const gear = pilot.gears[gearId];
  if (!gear || !gear.owned) {
    return { pilot, validation: { ok: false, reason: 'invalid_gear' } };
  }

  const validation = validateEquipSkillOnBar(gear, skillId, skillModsOrAdmin);
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

export function validateEquipPassiveSkill(
  gear: GearUnit,
  skillId: string,
  admin?: Pick<AdminConfig, 'passiveSlots' | 'skillMods'> | null
): SkillValidationResult {
  const skill = getSkillById(skillId, admin);
  if (!skill || skill.category !== 'passive') {
    return { ok: false, reason: 'invalid_skill' };
  }
  if (!isSkillAllowedForClass(skill, gear.classId)) {
    return { ok: false, reason: 'class_mismatch' };
  }
  if ((gear.skillLevels[skillId] ?? 0) < 1) {
    return { ok: false, reason: 'not_learned' };
  }
  const equipped = Array.isArray(gear.equippedPassives)
    ? gear.equippedPassives
    : [];
  if (equipped.includes(skillId)) {
    return { ok: false, reason: 'already_equipped' };
  }
  const unlocked = getUnlockedPassiveSlots(gear.level, admin?.passiveSlots);
  const activeEquippedCount = equipped.filter(
    (id) => !(id.startsWith('mod_') && !getSkillById(id, admin))
  ).length;
  if (activeEquippedCount >= unlocked) {
    return { ok: false, reason: 'passive_slots_full' };
  }
  return { ok: true, reason: 'ok' };
}

export function equipPassiveToGear(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string,
  admin?: Pick<AdminConfig, 'passiveSlots' | 'skillMods'> | null
): { pilot: PilotAccount; validation: SkillValidationResult } {
  const gear = pilot.gears[gearId];
  if (!gear || !gear.owned) {
    return { pilot, validation: { ok: false, reason: 'invalid_gear' } };
  }
  const validation = validateEquipPassiveSkill(gear, skillId, admin);
  if (!validation.ok) {
    return { pilot, validation };
  }
  const current = Array.isArray(gear.equippedPassives)
    ? gear.equippedPassives
    : [];
  return {
    pilot: {
      ...pilot,
      gears: {
        ...pilot.gears,
        [gearId]: {
          ...gear,
          equippedPassives: [...current, skillId],
        },
      },
    },
    validation,
  };
}

export function unequipPassiveFromGear(
  pilot: PilotAccount,
  gearId: MechClassId,
  skillId: string
): PilotAccount {
  const gear = pilot.gears[gearId];
  const current = Array.isArray(gear?.equippedPassives)
    ? gear.equippedPassives
    : [];
  if (!gear || !current.includes(skillId)) return pilot;
  return {
    ...pilot,
    gears: {
      ...pilot.gears,
      [gearId]: {
        ...gear,
        equippedPassives: current.filter((id) => id !== skillId),
      },
    },
  };
}

/**
 * War Point Shop purchase of an Opening Card for Special/Elite skills.
 */
export function buyOpeningCard(
  pilot: PilotAccount,
  cardId: string,
  admin?: Pick<AdminConfig, 'skillTiers' | 'skillCardPriceMult'> | null
): {
  pilot: PilotAccount;
  ok: boolean;
  reason: 'ok' | 'invalid_card' | 'already_owned' | 'insufficient_wp';
  cost: number;
} {
  const card = getOpeningCardById(cardId, admin);
  if (!card) {
    return { pilot, ok: false, reason: 'invalid_card', cost: 0 };
  }

  const wpPrice = getSkillCardPrice(card, admin);

  if (pilot.ownedOpeningCards.includes(card.id)) {
    return { pilot, ok: false, reason: 'already_owned', cost: wpPrice };
  }

  if (pilot.warPoints < wpPrice) {
    return {
      pilot,
      ok: false,
      reason: 'insufficient_wp',
      cost: wpPrice,
    };
  }

  return {
    pilot: {
      ...pilot,
      warPoints: pilot.warPoints - wpPrice,
      ownedOpeningCards: [...pilot.ownedOpeningCards, card.id],
    },
    ok: true,
    reason: 'ok',
    cost: wpPrice,
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
  admin?: Pick<AdminConfig, 'spEconomy' | 'fluxTransfer' | 'skillMaxLevel' | 'skillMods'> | null,
  turnLockedSkillIds?: readonly string[]
): BattleSkillUsability {
  const skill = getSkillById(skillId, admin);
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

  if (turnLockedSkillIds?.includes(skillId)) {
    return {
      canUse: false,
      reason: 'used_this_turn',
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

  // Revealed this round blocks re-entering stealth until next round
  if (
    (skill.effectKind === 'stealth_turns' ||
      skill.effectKind === 'stealth_until_attack') &&
    unit.revealedThisRound
  ) {
    return {
      canUse: false,
      reason: 'revealed_this_round',
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
      getEffectiveSkillMaxLevel(admin)
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
