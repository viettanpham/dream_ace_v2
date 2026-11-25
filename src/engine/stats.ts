import { BALANCE_CONFIG, COMBAT_FORMULAS } from '../data/balance';
import {
  EMPTY_STAT_BLOCK,
  MECH_CLASSES,
  MECH_CLASS_LIST,
  STAT_KEYS,
} from '../data/classes';
import { EMPTY_EQUIPPED_SLOT_IDS } from '../data/items';
import { createInitialBaseStates, SECTORS_CATALOG } from '../data/maps';
import { CLASS_STARTER_SKILLS } from '../data/skills';
import type {
  AdminConfig,
  DerivedStats,
  GearUnit,
  ItemInstance,
  ItemSpecialTraits,
  MechClassId,
  PilotAccount,
  StatBlock,
  WorldClockState,
} from '../types/game';
import { sumGearEquipmentStats, sumGearSpecialTraits } from './equipment';
import { createDefaultSquadFormation } from './formation';
import { type GearPassiveBonuses, getGearPassiveBonuses } from './skills';
import { createDefaultTacticsForClass } from './tactics';

/**
 * EXP required to advance from `level` to `level + 1`.
 * Formula: Math.round(60 * level^1.4)
 */
export function getExpForNextLevel(level: number): number {
  const lvl = Math.max(1, level);
  return Math.round(
    BALANCE_CONFIG.expBase * Math.pow(lvl, BALANCE_CONFIG.expExponent)
  );
}

/**
 * Computes effective 6-stat block from a Gear class definition, level,
 * committed allocated points, optional pending preview allocations,
 * optional flat equipment bonuses, special traits, and passive bonuses.
 */
export function calculateEffectiveStats(
  classId: MechClassId,
  level: number,
  allocatedPoints: StatBlock,
  pendingPoints: StatBlock = EMPTY_STAT_BLOCK,
  equipmentBonuses: StatBlock = EMPTY_STAT_BLOCK,
  specialTraits?: ItemSpecialTraits,
  passives?: GearPassiveBonuses
): StatBlock {
  const cls = MECH_CLASSES[classId];
  const levelBonus = Math.max(0, level - 1);

  const result = { ...EMPTY_STAT_BLOCK };
  for (const key of STAT_KEYS) {
    const totalPts = (allocatedPoints[key] || 0) + (pendingPoints[key] || 0);
    const naturalGrowth = Math.floor(levelBonus * (cls.perPointGain[key] * 0.35));
    const equipBonus = equipmentBonuses[key] || 0;
    let total =
      cls.baseStats[key] +
      naturalGrowth +
      totalPts * cls.perPointGain[key] +
      equipBonus;
    if (key === 'evasion' && specialTraits?.evasionMod) {
      total = Math.max(1, total + specialTraits.evasionMod);
    }
    if (key === 'defense' && passives?.defPct) {
      total = Math.round(total * (1 + passives.defPct));
    }
    if (key === 'evasion' && passives?.evaPct) {
      total = Math.round(total * (1 + passives.evaPct));
    }
    result[key] = total;
  }
  return result;
}

/**
 * Derives combat metrics (HP, Shield, SP, Turn Speed, Dodge, Crit, Skill Power, and item/passive traits)
 * from the 6 effective stats, level, equipped special traits, and learned passives.
 */
export function calculateDerivedStats(
  classId: MechClassId,
  level: number,
  stats: StatBlock,
  specialTraits?: ItemSpecialTraits,
  passives?: GearPassiveBonuses
): DerivedStats {
  const cls = MECH_CLASSES[classId];
  const lvl = Math.max(1, level);

  const maxHp = Math.round(
    cls.baseHp +
      stats.defense * COMBAT_FORMULAS.hpPerDefense +
      (lvl - 1) * COMBAT_FORMULAS.hpPerLevel
  );

  const maxShield = Math.round(
    cls.baseShield +
      stats.shield * COMBAT_FORMULAS.shieldPerShieldStat +
      (lvl - 1) * COMBAT_FORMULAS.shieldPerLevel
  );

  const maxSp = Math.round(
    cls.baseSp +
      stats.spirit * COMBAT_FORMULAS.spPerSpirit +
      (lvl - 1) * COMBAT_FORMULAS.spPerLevel
  );

  const rawSpeed =
    cls.baseSpeed +
    stats.fuel * COMBAT_FORMULAS.speedFuelWeight +
    stats.evasion * COMBAT_FORMULAS.speedEvasionWeight;
  const speed = Math.round(rawSpeed * (1 + (passives?.speedPct ?? 0)));

  const dodgeChance = Math.min(
    COMBAT_FORMULAS.maxDodgeChance,
    Math.max(0, Math.round(stats.evasion * COMBAT_FORMULAS.dodgePerEvasion))
  );

  const critChance = Math.min(
    COMBAT_FORMULAS.maxCritChance,
    Math.round(
      COMBAT_FORMULAS.baseCritChance +
        stats.evasion * COMBAT_FORMULAS.critPerEvasion +
        (specialTraits?.critBonusPct ?? 0)
    )
  );

  const skillPower = Math.round(stats.attack * 0.7 + stats.spirit * 0.85);

  return {
    maxHp,
    maxShield,
    maxSp,
    speed,
    attackPower: stats.attack,
    defenseRating: stats.defense,
    dodgeChance,
    critChance,
    skillPower,
    armorPiercePct: Math.min(50, specialTraits?.armorPiercePct ?? 0),
    accuracyPct: Math.min(
      BALANCE_CONFIG.maxAccuracyPct,
      Math.max(0, specialTraits?.accuracyPct ?? 0)
    ),
    splashPct: Math.min(40, specialTraits?.splashPct ?? 0),
    spRegenPerTurn:
      (specialTraits?.spRegenPerTurn ?? 0) + (passives?.spRegenPerTurn ?? 0),
    passiveSkillDmgPct: passives?.skillDmgPct ?? 0,
  };
}

/**
 * Unified Power Rating for a Gear shown in Garage & Gear tabs.
 */
export function calculateGearPowerRating(
  gear: GearUnit,
  inventory: ItemInstance[],
  admin?: Pick<AdminConfig, 'extenderLevelsPerSocket'> | null,
  warehouse: readonly ItemInstance[] = []
): number {
  const equipBonuses = sumGearEquipmentStats(gear, inventory, admin, warehouse);
  const traits = sumGearSpecialTraits(gear, inventory, admin, warehouse);
  const passives = getGearPassiveBonuses(gear);
  const stats = calculateEffectiveStats(
    gear.classId,
    gear.level,
    gear.allocatedPoints,
    EMPTY_STAT_BLOCK,
    equipBonuses,
    traits,
    passives
  );
  const derived = calculateDerivedStats(
    gear.classId,
    gear.level,
    stats,
    traits,
    passives
  );
  const totalSkillLevels = Object.values(gear.skillLevels).reduce(
    (sum, lv) => sum + Math.max(0, lv),
    0
  );

  return Math.round(
    derived.maxHp * 0.35 +
      derived.maxShield * 0.45 +
      derived.attackPower * 4.2 +
      derived.defenseRating * 2.8 +
      derived.speed * 2.4 +
      derived.skillPower * 2.2 +
      derived.critChance * 2.5 +
      derived.armorPiercePct * 2.0 +
      totalSkillLevels * 18
  );
}

export function getTotalSpentPoints(allocatedPoints: StatBlock): number {
  return STAT_KEYS.reduce((sum, key) => sum + (allocatedPoints[key] || 0), 0);
}

export function getTotalAvailablePointsForLevel(level: number): number {
  return (
    BALANCE_CONFIG.initialStatPoints +
    Math.max(0, level - 1) * BALANCE_CONFIG.statPointsPerLevel
  );
}

export function createDefaultGearUnit(
  classId: MechClassId,
  owned: boolean
): GearUnit {
  const starterSkills = CLASS_STARTER_SKILLS[classId];
  const skillLevels: Record<string, number> = {};
  for (const sid of starterSkills) {
    skillLevels[sid] = 1;
  }

  return {
    classId,
    owned,
    level: BALANCE_CONFIG.startingLevel,
    exp: 0,
    unspentPoints: BALANCE_CONFIG.initialStatPoints,
    allocatedPoints: { ...EMPTY_STAT_BLOCK },
    equipped: { ...EMPTY_EQUIPPED_SLOT_IDS },
    skillLevels,
    equippedSkillBar: [...starterSkills],
    supplyLoadout: [],
    extenders: [null, null, null, null, null],
    tactics: createDefaultTacticsForClass(classId),
    battlesWon: 0,
    battlesFought: 0,
  };
}

export function createDefaultWorldClock(): WorldClockState {
  return {
    worldDay: 0,
    lastTickAt: null,
    speedMode: 'normal',
    secondsPerDay: 180,
    paused: false,
  };
}

export function createDefaultPilotAccount(
  name = 'Vance',
  starterClassId: MechClassId = 'striker',
  starterItems: ItemInstance[] = []
): PilotAccount {
  const gears = {} as Record<MechClassId, GearUnit>;
  for (const cls of MECH_CLASS_LIST) {
    gears[cls.id] = createDefaultGearUnit(cls.id, cls.id === starterClassId);
  }

  return {
    name,
    credits: BALANCE_CONFIG.startingCredits,
    warPoints: BALANCE_CONFIG.startingWarPoints,
    ownedOpeningCards: [],
    inventory: starterItems,
    warehouse: [],
    worldClock: createDefaultWorldClock(),
    gears,
    activeGearId: starterClassId,
    unlockedSectorIds: [
      SECTORS_CATALOG[0].id,
      'aegis_relay',
      'veridian_colony',
    ],
    capturedSectorIds: ['aegis_relay'],
    campaignMonth: 1,
    baseStates: createInitialBaseStates(),
    hiredWingman: null,
    engineerShieldBoost: false,
    activeBonusMission: null,
    squadFormation: createDefaultSquadFormation(name, starterClassId),
    formationCustomized: false,
  };
}

export interface GearLevelUpResult {
  updatedGear: GearUnit;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  statPointsGained: number;
}

/**
 * Applies battle EXP (and optional battle count) to a SINGLE GearUnit only.
 * Each level-up grants +3 stat points strictly to this Gear.
 */
export function applyExpToGear(
  gear: GearUnit,
  expGained: number,
  recordBattle?: { won: boolean }
): GearLevelUpResult {
  let level = gear.level;
  let exp = gear.exp + Math.max(0, Math.round(expGained));
  let unspentPoints = gear.unspentPoints;
  let statPointsGained = 0;

  while (level < BALANCE_CONFIG.maxLevel) {
    const needed = getExpForNextLevel(level);
    if (exp >= needed) {
      exp -= needed;
      level += 1;
      unspentPoints += BALANCE_CONFIG.statPointsPerLevel;
      statPointsGained += BALANCE_CONFIG.statPointsPerLevel;
    } else {
      break;
    }
  }

  if (level >= BALANCE_CONFIG.maxLevel) {
    exp = 0;
  }

  const updatedGear: GearUnit = {
    ...gear,
    level,
    exp,
    unspentPoints,
    battlesFought: gear.battlesFought + (recordBattle ? 1 : 0),
    battlesWon: gear.battlesWon + (recordBattle?.won ? 1 : 0),
  };

  return {
    updatedGear,
    leveledUp: level > gear.level,
    previousLevel: gear.level,
    newLevel: level,
    statPointsGained,
  };
}

/**
 * Commits pending stat points strictly to a single GearUnit.
 */
export function allocateGearStats(
  gear: GearUnit,
  pending: Partial<StatBlock>
): GearUnit {
  const totalPending = STAT_KEYS.reduce(
    (sum, key) => sum + Math.max(0, Math.floor(pending[key] ?? 0)),
    0
  );
  if (totalPending <= 0 || totalPending > gear.unspentPoints) {
    return gear;
  }

  const nextAllocated: StatBlock = { ...gear.allocatedPoints };
  for (const key of STAT_KEYS) {
    nextAllocated[key] =
      (nextAllocated[key] || 0) + Math.max(0, Math.floor(pending[key] ?? 0));
  }

  return {
    ...gear,
    allocatedPoints: nextAllocated,
    unspentPoints: gear.unspentPoints - totalPending,
  };
}

/**
 * Resets a single GearUnit's allocated points back into its own unspentPoints pool.
 */
export function resetGearStatAllocations(gear: GearUnit): GearUnit {
  const totalAvailable =
    getTotalSpentPoints(gear.allocatedPoints) + gear.unspentPoints;
  return {
    ...gear,
    allocatedPoints: { ...EMPTY_STAT_BLOCK },
    unspentPoints: Math.max(
      getTotalAvailablePointsForLevel(gear.level),
      totalAvailable
    ),
  };
}

/**
 * Estimates how many similar victories are needed for this Gear to reach its next level.
 */
export function estimateBattlesToNextLevel(
  gear: GearUnit,
  expPerVictory: number
): number {
  if (gear.level >= BALANCE_CONFIG.maxLevel) return 0;
  const remaining = Math.max(0, getExpForNextLevel(gear.level) - gear.exp);
  if (remaining === 0) return 0;
  return Math.max(1, Math.ceil(remaining / Math.max(1, expPerVictory)));
}

/**
 * Generates an NPC stat allocation block weighted toward that class's strongest per-point gains.
 */
export function generateNpcAllocations(
  classId: MechClassId,
  level: number,
  rng: () => number = Math.random
): StatBlock {
  const cls = MECH_CLASSES[classId];
  const totalPoints = getTotalAvailablePointsForLevel(level);
  const block: StatBlock = { ...EMPTY_STAT_BLOCK };

  const weightedKeys: Array<keyof StatBlock> = [];
  for (const key of STAT_KEYS) {
    const weight = Math.max(1, cls.perPointGain[key]);
    for (let i = 0; i < weight; i++) {
      weightedKeys.push(key);
    }
  }

  for (let i = 0; i < totalPoints; i++) {
    const pick = weightedKeys[Math.floor(rng() * weightedKeys.length)];
    block[pick] += 1;
  }

  return block;
}
