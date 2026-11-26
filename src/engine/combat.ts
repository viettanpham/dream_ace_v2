import {
  BALANCE_CONFIG,
  COMBAT_FORMULAS,
  DEFAULT_FLUX_TRANSFER_CONFIG,
  getFluxMinPerAlly,
  getFluxPlannedAmountEach,
  getFluxTransferRule,
  sanitizeFluxTransferConfig,
} from '../data/balance';
import { EMPTY_STAT_BLOCK, MECH_CLASSES, MECH_CLASS_LIST } from '../data/classes';
import { DEFAULT_FORMATION_CONFIG, FORMATION_ROWS } from '../data/formationConfig';
import { getSectorById } from '../data/maps';
import {
  ALLY_PILOT_POOL,
  ENEMY_ARCHETYPE_DEFS,
  ENEMY_PREFIXES,
} from '../data/pilots';
import {
  CLASS_STARTER_SKILLS,
  getScaledSkillStats,
  getSkillById,
  SKILLS_LIST,
} from '../data/skills';
import type {
  ActionType,
  ActiveStatusEffect,
  AdminConfig,
  BattleEvent,
  BattleKind,
  BattleRoundSnapshot,
  BattleSize,
  BattleState,
  CombatFxEvent,
  CombatFxKind,
  CombatLogEntry,
  CombatRow,
  CombatSide,
  CombatUnit,
  EnemyArchetype,
  FloatingPopup,
  FluxTransferConfig,
  FluxTransferLevelRule,
  FormationConfig,
  ItemSpecialTraits,
  MechClassId,
  PilotAccount,
  SkillDefinition,
  SpEconomyConfig,
  StatBlock,
  StatusEffectType,
  TeamColorRole,
  TurnQueueEntry,
  TurnQueueView,
  UnitAnimState,
} from '../types/game';
import { sumGearEquipmentStats, sumGearSpecialTraits } from './equipment';
import {
  assignFormationColumns,
  autoPlaceFormation,
  enforceFormationCapacities,
  getRowCounts,
  getRowModifier,
  pickRowForClass,
  sanitizeFormationConfig,
} from './formation';
import { getBattleOptions, pickDefaultBattle } from './frontline';
import {
  canUnitUseSkill,
  type GearPassiveBonuses,
  getEffectiveSpCost,
  getGearPassiveBonuses,
  isSkillAllowedForClass,
  MAX_ACTIVE_SKILL_BAR,
} from './skills';
import {
  calculateDerivedStats,
  calculateEffectiveStats,
  generateNpcAllocations,
} from './stats';
import {
  clampEnemyLevel,
  rollEnemyLevelOffset,
} from './enemyLevel';
import { isPirateIncidentId } from './pirates';
import {
  clampShieldDamageMult,
  computeShieldRegen,
  getUnitHitsSinceOwnTurn,
  sanitizeShieldCrackedMult,
  sanitizeShieldCrackedTurns,
  sanitizeShieldRegenConfig,
} from './shieldRegen';
import {
  evaluateTurnPhaseAfterAction,
  sanitizeTurnPhaseConfig,
} from './turnPhase';

let uidCounter = 1;
function nextId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

function randomItem<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomVariance(rng: () => number = Math.random): number {
  const { damageVarianceMin, damageVarianceMax } = COMBAT_FORMULAS;
  return damageVarianceMin + rng() * (damageVarianceMax - damageVarianceMin);
}

function getSlotIndex(units: CombatUnit[], unitId: string): number {
  const target = units.find((u) => u.id === unitId);
  if (!target) return 0;
  const sameSide = units.filter((u) => u.side === target.side);
  const idx = sameSide.findIndex((u) => u.id === unitId);
  return Math.max(0, idx);
}

export const DEBUFF_TYPES = new Set<StatusEffectType>([
  'burn',
  'shield_break',
  'shield_cracked',
  'slow',
  'silence',
  'vulnerable',
  'def_down',
]);

export function hasStatus(unit: CombatUnit, type: StatusEffectType): boolean {
  return unit.statuses.some((s) => s.type === type && s.turnsRemaining > 0);
}

export function getStatus(
  unit: CombatUnit,
  type: StatusEffectType
): ActiveStatusEffect | undefined {
  return unit.statuses.find((s) => s.type === type && s.turnsRemaining > 0);
}

export function isUnitStealthed(unit: CombatUnit): boolean {
  return hasStatus(unit, 'stealth');
}

export function getEffectiveUnitSpeed(unit: CombatUnit): number {
  let speed = unit.derived.speed;
  const spdUp = getStatus(unit, 'spd_up');
  if (spdUp) {
    speed *= 1 + (spdUp.magnitude ?? 0.5);
  }
  if (hasStatus(unit, 'slow')) {
    speed *= 1 - BALANCE_CONFIG.slowSpeedPenalty;
  }
  return Math.max(1, Math.round(speed));
}

export function getEffectiveUnitDefense(
  unit: CombatUnit,
  formationConfig: FormationConfig = DEFAULT_FORMATION_CONFIG
): number {
  let def = unit.derived.defenseRating;
  const rowMod = getRowModifier(formationConfig, unit.row);
  def *= Math.max(0.1, 1 + rowMod.defensePct);
  const defUp = getStatus(unit, 'def_up');
  if (defUp) def *= 1 + (defUp.magnitude ?? 0.25);
  const siegeDef = getStatus(unit, 'siege_defense');
  if (siegeDef) def *= 1 + (siegeDef.magnitude ?? 0.8);
  const defDown = getStatus(unit, 'def_down');
  if (defDown) def *= Math.max(0.2, 1 - (defDown.magnitude ?? 0.3));
  return Math.max(0, Math.round(def));
}

export function getEffectiveUnitDodge(unit: CombatUnit): number {
  // Siege Mode locks EVA to 0!
  if (hasStatus(unit, 'siege_mode')) return 0;
  let dodge = unit.derived.dodgeChance;
  const evaUp = getStatus(unit, 'eva_up');
  if (evaUp) {
    dodge += Math.round((evaUp.magnitude ?? 0.25) * 40);
  }
  return Math.min(75, Math.max(0, dodge));
}

function getEffectiveAttackDamageMult(
  unit: CombatUnit,
  isSkill: boolean
): number {
  let mult = 1.0;
  const atkUp = getStatus(unit, 'atk_up');
  if (atkUp) mult += atkUp.magnitude ?? 0.2;

  const siegeMode = getStatus(unit, 'siege_mode');
  if (siegeMode) mult += siegeMode.magnitude ?? 0.6;

  const siegeDef = getStatus(unit, 'siege_defense');
  if (siegeDef) mult -= 0.3;

  if (!isSkill) {
    const primUp = getStatus(unit, 'primary_dmg_up');
    if (primUp) mult += primUp.magnitude ?? 0.3;
  } else {
    const skillUp = getStatus(unit, 'skill_dmg_up');
    if (skillUp) mult += skillUp.magnitude ?? 0.3;
    mult += unit.derived.passiveSkillDmgPct ?? 0;
  }

  return Math.max(0.35, mult);
}

function addOrRefreshStatus(
  statuses: ActiveStatusEffect[],
  entry: ActiveStatusEffect
): ActiveStatusEffect[] {
  const filtered = statuses.filter((s) => s.type !== entry.type);
  return [...filtered, { ...entry, isDebuff: DEBUFF_TYPES.has(entry.type) }];
}

function removeStatus(
  statuses: ActiveStatusEffect[],
  type: StatusEffectType
): ActiveStatusEffect[] {
  return statuses.filter((s) => s.type !== type);
}

function buildNpcSkillLoadout(
  classId: MechClassId,
  level: number
): { equippedSkillIds: string[]; skillLevels: Record<string, number> } {
  const unlocked = SKILLS_LIST.filter(
    (s) =>
      s.classScope === classId &&
      s.category === 'normal' &&
      s.unlockLevel <= level
  );
  const picked =
    unlocked.length > 0
      ? unlocked.slice(0, 3).map((s) => s.id)
      : [...CLASS_STARTER_SKILLS[classId]];
  const lv = Math.min(5, Math.max(1, Math.ceil(level / 5)));
  const skillLevels: Record<string, number> = {};
  for (const id of picked) {
    skillLevels[id] = lv;
  }
  return { equippedSkillIds: picked, skillLevels };
}

function buildCombatUnit(params: {
  id: string;
  name: string;
  callsign: string;
  side: CombatSide;
  row: CombatRow;
  formationCol?: number;
  hasLongRangeWeapon?: boolean;
  accuracyPct?: number;
  detectsStealth?: boolean;
  isPlayer: boolean;
  classId: MechClassId;
  archetype?: EnemyArchetype;
  isBoss?: boolean;
  isStructure?: boolean;
  level: number;
  skillLevel?: number;
  skillLevels?: Record<string, number>;
  equippedSkillIds?: string[];
  allocatedPoints: StatBlock;
  equipmentBonuses?: StatBlock;
  specialTraits?: ItemSpecialTraits;
  passives?: GearPassiveBonuses;
  adminConfig?: Partial<AdminConfig>;
}): CombatUnit {
  const stats = calculateEffectiveStats(
    params.classId,
    params.level,
    params.allocatedPoints,
    EMPTY_STAT_BLOCK,
    params.equipmentBonuses ?? EMPTY_STAT_BLOCK,
    params.specialTraits,
    params.passives
  );
  const baseDerived = calculateDerivedStats(
    params.classId,
    params.level,
    stats,
    params.specialTraits,
    params.passives,
    params.adminConfig
  );

  const archDef = params.archetype
    ? ENEMY_ARCHETYPE_DEFS[params.archetype]
    : null;
  const bossHpMult = params.isBoss ? 1.85 : 1;
  const bossAtkMult = params.isBoss ? 1.25 : 1;

  const derived = archDef
    ? {
        ...baseDerived,
        maxHp: Math.round(baseDerived.maxHp * archDef.hpMult * bossHpMult),
        maxShield: Math.round(
          baseDerived.maxShield * archDef.shieldMult * (params.isBoss ? 1.5 : 1)
        ),
        attackPower: Math.round(
          baseDerived.attackPower * archDef.attackMult * bossAtkMult
        ),
        speed: Math.max(1, Math.round(baseDerived.speed * archDef.speedMult)),
      }
    : baseDerived;

  const npcFallback = buildNpcSkillLoadout(params.classId, params.level);
  const equippedSkillIds = (params.equippedSkillIds ?? npcFallback.equippedSkillIds)
    .filter((id) => {
      const sk = getSkillById(id);
      return sk && sk.category !== 'passive' && isSkillAllowedForClass(sk, params.classId);
    })
    .slice(0, MAX_ACTIVE_SKILL_BAR);

  return {
    id: params.id,
    name: params.name,
    callsign: params.callsign,
    side: params.side,
    row: params.row,
    formationCol: params.formationCol,
    hasLongRangeWeapon: Boolean(
      params.hasLongRangeWeapon ||
        params.specialTraits?.longRange ||
        params.archetype === 'sniper'
    ),
    accuracyPct: Math.min(
      BALANCE_CONFIG.maxAccuracyPct,
      Math.max(0, params.accuracyPct ?? 0)
    ),
    detectsStealth: Boolean(params.detectsStealth),
    isPlayer: params.isPlayer,
    classId: params.classId,
    archetype: params.archetype,
    isBoss: Boolean(params.isBoss),
    isStructure: Boolean(params.isStructure),
    level: params.level,
    skillLevel: params.skillLevel ?? 1,
    skillLevels: params.skillLevels ?? npcFallback.skillLevels,
    equippedSkillIds,
    skillCooldowns: {},
    usedOnceSkills: [],
    stats,
    derived,
    hp: derived.maxHp,
    shield: derived.maxShield,
    sp: derived.maxSp,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
  };
}

export function getTeamColorRole(unit: CombatUnit): TeamColorRole {
  if (unit.isPlayer) return 'me';
  if (unit.side === 'ally') return 'ally';
  if (unit.isBoss) return 'boss';
  return 'enemy';
}

function compareUnitTurnPriority(a: CombatUnit, b: CombatUnit): number {
  const spdDiff = getEffectiveUnitSpeed(b) - getEffectiveUnitSpeed(a);
  if (spdDiff !== 0) return spdDiff;
  if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
  if (a.side !== b.side) return a.side === 'ally' ? -1 : 1;
  const baseSpdDiff = b.derived.speed - a.derived.speed;
  if (baseSpdDiff !== 0) return baseSpdDiff;
  return a.id.localeCompare(b.id);
}

export function sortTurnOrder(units: CombatUnit[]): string[] {
  return units
    .filter((u) => u.alive)
    .sort(compareUnitTurnPriority)
    .map((u) => u.id);
}

/**
 * Anti-Stalemate (Soft Enrage): after round 20, enemies deal +10% damage per round,
 * capped at +200% (3.0x total enemy damage). Returns fractional bonus (0..2.0).
 */
export function getEnemyEnrageBonusPct(
  round: number,
  enabled = true,
  startRound: number = BALANCE_CONFIG.enrageStartRound,
  stepPct: number = BALANCE_CONFIG.enrageStepPct
): number {
  const safeStart = Math.max(1, Math.floor(startRound));
  const safeStep = Math.max(0, stepPct);
  if (!enabled || round <= safeStart) return 0;
  const extraRounds = round - safeStart;
  return Math.min(
    BALANCE_CONFIG.enrageMaxBonusPct,
    Math.round(extraRounds * safeStep * 1000) / 1000
  );
}

export function createRoundHpSnapshot(
  round: number,
  units: CombatUnit[]
): BattleRoundSnapshot {
  let allyHp = 0;
  let allyMaxHp = 0;
  let enemyHp = 0;
  let enemyMaxHp = 0;
  for (const u of units) {
    if (u.side === 'ally') {
      allyMaxHp += u.derived.maxHp;
      if (u.alive) allyHp += u.hp;
    } else {
      enemyMaxHp += u.derived.maxHp;
      if (u.alive) enemyHp += u.hp;
    }
  }
  return {
    round,
    allyHp,
    allyMaxHp,
    allyHpPct: allyMaxHp > 0 ? Math.round((allyHp / allyMaxHp) * 1000) / 10 : 0,
    enemyHp,
    enemyMaxHp,
    enemyHpPct:
      enemyMaxHp > 0 ? Math.round((enemyHp / enemyMaxHp) * 1000) / 10 : 0,
  };
}

/**
 * Re-sorts ONLY the units that have NOT YET ACTED in the current round
 * (indices > activeTurnIndex) by current effective Speed descending,
 * and cleanly inserts any newly summoned/revived alive units into the upcoming queue.
 */
export function reconcileRemainingTurnOrder(
  turnOrder: string[],
  activeTurnIndex: number,
  units: CombatUnit[]
): string[] {
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const actedAndCurrent = turnOrder.slice(0, activeTurnIndex + 1);
  const existingIds = new Set(turnOrder);
  const remaining = turnOrder
    .slice(activeTurnIndex + 1)
    .filter((id) => Boolean(unitMap.get(id)?.alive));

  // Include newly summoned alive units that are not yet in turnOrder
  for (const u of units) {
    if (u.alive && !existingIds.has(u.id)) {
      remaining.push(u.id);
    }
  }

  const sortedRemaining = [...remaining].sort((idA, idB) => {
    const a = unitMap.get(idA);
    const b = unitMap.get(idB);
    if (!a && !b) return idA.localeCompare(idB);
    if (!a) return 1;
    if (!b) return -1;
    return compareUnitTurnPriority(a, b);
  });

  return [...actedAndCurrent, ...sortedRemaining];
}

function toTurnQueueEntry(
  unit: CombatUnit,
  phase: TurnQueueEntry['phase']
): TurnQueueEntry {
  return {
    unitId: unit.id,
    name: unit.name,
    level: unit.level,
    classId: unit.classId,
    side: unit.side,
    isPlayer: unit.isPlayer,
    isBoss: Boolean(unit.isBoss),
    teamRole: getTeamColorRole(unit),
    effectiveSpeed: getEffectiveUnitSpeed(unit),
    baseSpeed: unit.derived.speed,
    isSlowed: hasStatus(unit, 'slow'),
    isSpeedBoosted: hasStatus(unit, 'spd_up'),
    phase,
  };
}

/**
 * Pure conveyor turn-queue builder: returns { round, current, next }.
 * - current: living units that have NOT yet acted this round, sorted by live effective
 *   Speed DESC (deterministic tie-breakers), with the ACTING unit strictly FIRST (index 0).
 *   Units that already acted this round are excluded from current.
 * - next: ALL living units sorted by live effective Speed DESC (Round N+1 preview),
 *   including units that already acted this round in their sorted Speed slot.
 * - Dead units are excluded from both lists; newly summoned/revived alive units not yet
 *   in turnOrder are inserted into current (after acting unit) and next in Speed DESC order.
 */
export function buildTurnQueue(battle: BattleState): TurnQueueView {
  const unitMap = new Map(battle.units.map((u) => [u.id, u]));
  let actingUnit: CombatUnit | null = null;
  const upcomingUnits: CombatUnit[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < battle.turnOrder.length; i++) {
    const id = battle.turnOrder[i];
    seenIds.add(id);
    const u = unitMap.get(id);
    if (!u || !u.alive) continue;
    // Units with index < activeTurnIndex have already acted -> NOT in current
    if (i < battle.activeTurnIndex) continue;
    if (i === battle.activeTurnIndex) {
      actingUnit = u;
    } else {
      upcomingUnits.push(u);
    }
  }

  // Insert newly summoned/revived alive units not yet present in turnOrder
  for (const u of battle.units) {
    if (u.alive && !seenIds.has(u.id)) {
      upcomingUnits.push(u);
    }
  }

  // Remaining un-acted units sorted strictly by live effective Speed DESC
  const sortedUpcomingUnits = [...upcomingUnits].sort(compareUnitTurnPriority);

  // If the unit at activeTurnIndex died mid-turn, promote the next fastest un-acted living unit
  if (!actingUnit && sortedUpcomingUnits.length > 0) {
    actingUnit = sortedUpcomingUnits.shift()!;
  }

  const current: TurnQueueEntry[] = [];
  if (actingUnit) {
    current.push(toTurnQueueEntry(actingUnit, 'current'));
  }
  for (const u of sortedUpcomingUnits) {
    current.push(toTurnQueueEntry(u, 'upcoming'));
  }

  // Next round: ALL living units sorted strictly by live effective Speed DESC
  const next: TurnQueueEntry[] = battle.units
    .filter((u) => u.alive)
    .sort(compareUnitTurnPriority)
    .map((u) => toTurnQueueEntry(u, 'next_round'));

  return {
    round: battle.round,
    current,
    next,
  };
}

export const ARCHETYPE_ROSTER_BY_SIZE: Record<BattleSize, EnemyArchetype[]> = {
  4: ['gunship', 'drone', 'sniper', 'repair_ship'],
  6: ['gunship', 'drone', 'gunship', 'sniper', 'repair_ship', 'sniper'],
  8: [
    'gunship',
    'drone',
    'gunship',
    'drone',
    'sniper',
    'repair_ship',
    'sniper',
    'repair_ship',
  ],
};

export function createInitialBattleState(
  pilot: PilotAccount,
  sectorId: string,
  rng: () => number = Math.random,
  squadSizeOverride?: BattleSize | null,
  adminConfig?: Partial<AdminConfig>,
  battleKind?: BattleKind,
  sourceId: string | null = null,
  rewardMult?: number
): BattleState {
  const resolvedKind: BattleKind =
    battleKind ??
    pickDefaultBattle(getBattleOptions(pilot, sectorId, adminConfig)) ??
    'assault';
  const sector = getSectorById(sectorId);
  const rawSquadSize: BattleSize = squadSizeOverride ?? sector.squadSize ?? 4;
  const formationConfig = sanitizeFormationConfig(
    (adminConfig?.formation ?? adminConfig) as Record<string, unknown> | undefined
  );
  const effectiveSquadCount = Math.max(
    1,
    Math.min(rawSquadSize, formationConfig.maxUnitsPerSide)
  );
  const squadSize: BattleSize = rawSquadSize;
  const activeGear = pilot.gears[pilot.activeGearId];
  const classIds = MECH_CLASS_LIST.map((c) => c.id);

  // 1. Player's Deployed Gear (per-Gear level, stats, equipment, passives, and 6-slot skill bar)
  const playerEquipBonuses = sumGearEquipmentStats(
    activeGear,
    pilot.inventory,
    adminConfig,
    pilot.warehouse
  );
  const playerTraits = sumGearSpecialTraits(
    activeGear,
    pilot.inventory,
    adminConfig,
    pilot.warehouse
  );
  const playerPassives = getGearPassiveBonuses(activeGear);

  const savedFormation = Array.isArray(pilot.squadFormation)
    ? pilot.squadFormation
    : [];
  const savedPlayerSlot = savedFormation.find((u) => u.isPlayer);

  const playerUnit = buildCombatUnit({
    id: 'ally_player',
    name: pilot.name.trim() || 'Vance',
    callsign: savedPlayerSlot?.callsign ?? 'Lead-1',
    side: 'ally',
    row: savedPlayerSlot?.row ?? 'front',
    formationCol: 0,
    hasLongRangeWeapon: Boolean(playerTraits.longRange),
    accuracyPct: Math.min(
      BALANCE_CONFIG.maxAccuracyPct,
      Math.max(0, playerTraits.accuracyPct ?? 0)
    ),
    detectsStealth: Boolean(playerTraits.detectStealth),
    isPlayer: true,
    classId: activeGear.classId,
    level: activeGear.level,
    skillLevel: 1,
    skillLevels: { ...activeGear.skillLevels },
    equippedSkillIds: [...activeGear.equippedSkillBar],
    allocatedPoints: activeGear.allocatedPoints,
    equipmentBonuses: playerEquipBonuses,
    specialTraits: playerTraits,
    passives: playerPassives,
    adminConfig,
  });

  // 2. AI Ally Wingmen (matching effectiveSquadCount - 1)
  const usedNames = new Set<string>([playerUnit.name]);
  const usedCallsigns = new Set<string>([playerUnit.callsign]);
  const savedWingmen = savedFormation.filter((u) => !u.isPlayer);
  const rawAllyUnits: CombatUnit[] = [playerUnit];

  for (let i = 0; i < effectiveSquadCount - 1; i++) {
    const savedSlot = savedWingmen[i];
    const remainingNames = ALLY_PILOT_POOL.firstNames.filter(
      (n) => !usedNames.has(n)
    );
    const pilotName =
      savedSlot?.name && !usedNames.has(savedSlot.name)
        ? savedSlot.name
        : remainingNames.length > 0
        ? randomItem(remainingNames, rng)
        : `Wingman-${i + 1}`;
    usedNames.add(pilotName);

    const remainingCallsigns = ALLY_PILOT_POOL.callsigns.filter(
      (c) => !usedCallsigns.has(c)
    );
    const callsign =
      savedSlot?.callsign && !usedCallsigns.has(savedSlot.callsign)
        ? savedSlot.callsign
        : remainingCallsigns.length > 0
        ? randomItem(remainingCallsigns, rng)
        : `Wing-${i + 1}`;
    usedCallsigns.add(callsign);

    const allyClass: MechClassId =
      savedSlot?.classId ?? randomItem(classIds, rng);
    const levelJitter = Math.floor(rng() * 3) - 1;
    const allyLevel = Math.max(1, activeGear.level + levelJitter);

    rawAllyUnits.push(
      buildCombatUnit({
        id: savedSlot?.id ?? `ally_npc_${i + 1}`,
        name: pilotName,
        callsign,
        side: 'ally',
        row: savedSlot?.row ?? 'front',
        formationCol: 0,
        isPlayer: false,
        classId: allyClass,
        level: allyLevel,
        allocatedPoints: generateNpcAllocations(allyClass, allyLevel, rng),
        adminConfig,
      })
    );
  }

  // Place player squadron into the 3 rows:
  // - If user customized their formation in Garage, keep their row choices while enforcing capacities.
  // - Otherwise, run class-based auto-placement (Striker->front, Interceptor->front/middle, Siege->back, Support->middle/back).
  let allyUnits: CombatUnit[] =
    pilot.formationCustomized && savedFormation.length > 0
      ? enforceFormationCapacities(rawAllyUnits, formationConfig)
      : autoPlaceFormation(rawAllyUnits, formationConfig);

  // Optional Pilot-for-Hire: joins as an EXTRA veteran wingman placed into an open row by class preference!
  if (pilot.hiredWingman) {
    const hiredLv = Math.max(1, activeGear.level + pilot.hiredWingman.bonusLevel);
    const allyRowCounts = getRowCounts(allyUnits);
    const mercRow = pickRowForClass(
      pilot.hiredWingman.classId,
      allyRowCounts,
      formationConfig
    );
    allyUnits = assignFormationColumns([
      ...allyUnits,
      buildCombatUnit({
        id: 'ally_hired_merc',
        name: pilot.hiredWingman.callsign,
        callsign: 'MERC',
        side: 'ally',
        row: mercRow,
        formationCol: 0,
        isPlayer: false,
        classId: pilot.hiredWingman.classId,
        level: hiredLv,
        allocatedPoints: generateNpcAllocations(
          pilot.hiredWingman.classId,
          hiredLv,
          rng
        ),
        adminConfig,
      }),
    ]);
  }

  // Optional Engineer Field Overcharge: +25% starting Shield on Allied wing for this battle
  if (pilot.engineerShieldBoost) {
    for (let i = 0; i < allyUnits.length; i++) {
      const u = allyUnits[i];
      const boostedMax = Math.round(u.derived.maxShield * 1.25);
      allyUnits[i] = {
        ...u,
        derived: { ...u.derived, maxShield: boostedMax },
        shield: boostedMax,
      };
    }
  }

  // 3. Hostile Squadron (3-row auto-placement with small random variation)
  const roster = ARCHETYPE_ROSTER_BY_SIZE[rawSquadSize];
  const rawEnemyUnits: CombatUnit[] = [];
  const hasLevelOverride =
    adminConfig?.battleLevelOffsetOverride !== undefined &&
    adminConfig?.battleLevelOffsetOverride !== null;
  const normalLevelKind =
    resolvedKind === 'event' && isPirateIncidentId(sourceId)
      ? 'pirate'
      : resolvedKind;
  const normalRolledOffset = hasLevelOverride
    ? adminConfig!.battleLevelOffsetOverride!
    : rollEnemyLevelOffset(normalLevelKind, adminConfig?.enemyLevel, rng);
  let bossRolledOffset: number | null = null;

  for (let i = 0; i < effectiveSquadCount; i++) {
    const archetype = roster[i % roster.length];
    const archDef = ENEMY_ARCHETYPE_DEFS[archetype];
    const isBoss = (sector.hasBoss || Boolean(adminConfig?.forceBoss)) && i === 0;
    const isStructure =
      isBoss || (effectiveSquadCount >= 6 && archetype === 'gunship' && i === 2);
    const prefix = randomItem(ENEMY_PREFIXES, rng);
    const baseName = isBoss
      ? randomItem(archDef.bossNames, rng)
      : isStructure
      ? 'Defense Turret'
      : randomItem(archDef.names, rng);
    let effectiveLevelOffset: number;
    if (hasLevelOverride) {
      effectiveLevelOffset = adminConfig!.battleLevelOffsetOverride!;
    } else if (isBoss) {
      if (bossRolledOffset === null) {
        bossRolledOffset = rollEnemyLevelOffset(
          'boss',
          adminConfig?.enemyLevel,
          rng
        );
      }
      effectiveLevelOffset = bossRolledOffset + sector.levelOffset;
    } else {
      effectiveLevelOffset = normalRolledOffset + sector.levelOffset;
    }
    const unitJitter = isBoss
      ? 0
      : i === 0
      ? 0
      : Math.floor(rng() * 2) - (effectiveLevelOffset === 0 ? 1 : 0);
    const rawEnemyLevel = activeGear.level + effectiveLevelOffset + unitJitter;
    const enemyLevel = hasLevelOverride
      ? Math.max(1, rawEnemyLevel)
      : clampEnemyLevel(rawEnemyLevel, adminConfig?.enemyLevel);

    rawEnemyUnits.push(
      buildCombatUnit({
        id: `enemy_${i + 1}`,
        name: `${prefix} ${baseName}`,
        callsign: isBoss ? 'BOSS' : isStructure ? `Turret-${i + 1}` : `Hostile-${i + 1}`,
        side: 'enemy',
        row: 'front',
        formationCol: 0,
        hasLongRangeWeapon: archetype === 'sniper',
        isPlayer: false,
        classId: archDef.classId,
        archetype,
        isBoss,
        isStructure,
        level: Math.max(1, enemyLevel),
        allocatedPoints: generateNpcAllocations(
          archDef.classId,
          Math.max(1, enemyLevel),
          rng
        ),
        adminConfig,
      })
    );
  }

  const enemyUnits: CombatUnit[] = autoPlaceFormation(
    rawEnemyUnits,
    formationConfig,
    { rng, randomVariation: 0.25 }
  );

  const units = [...allyUnits, ...enemyUnits];
  const turnOrder = sortTurnOrder(units);
  const placedPlayer = allyUnits.find((u) => u.isPlayer) ?? allyUnits[0];
  const initialValidEnemies = placedPlayer
    ? getValidEnemyTargets(units, placedPlayer, 'attack')
    : enemyUnits;
  const firstEnemyId = initialValidEnemies[0]?.id ?? enemyUnits[0]?.id ?? null;

  const openingLog: CombatLogEntry = {
    id: nextId('log'),
    round: 1,
    actorName: sector.name,
    tag: 'SYSTEM',
    templateKey: 'log.battleStart',
    params: {
      sectorId: sector.id,
      difficulty: sector.difficulty,
    },
  };

  return {
    sectorId: sector.id,
    kind: resolvedKind,
    sourceId: sourceId ?? null,
    ...(rewardMult !== undefined ? { rewardMult } : {}),
    deployedGearId: activeGear.classId,
    squadSize,
    units,
    turnOrder,
    activeTurnIndex: 0,
    round: 1,
    turnCounter: 0,
    selectedTargetId: firstEnemyId,
    selectedAllyTargetId: placedPlayer.id,
    lastPlayerTargetId: null,
    autoStopNotice: null,
    wingmanChat: null,
    log: [openingLog],
    events: [],
    roundSnapshots: [createRoundHpSnapshot(1, units)],
    popups: [],
    fxEvents: [],
    explodedUnitIds: [],
    supplyByUnit: {},
    turnStep2Used: 0,
    turnLockedSkillIds: [],
    isResolving: false,
    summary: null,
  };
}

export interface ActionResolution {
  updatedUnits: CombatUnit[];
  logEntries: CombatLogEntry[];
  events: BattleEvent[];
  popups: FloatingPopup[];
  fxEvent: CombatFxEvent | null;
  destroyedUnitIds: string[];
  soundCue:
    | 'laser'
    | 'heavy'
    | 'shield'
    | 'evade'
    | 'defend'
    | 'heal'
    | 'destroy';
}

const LONG_RANGE_SKILL_EFFECTS = new Set<SkillDefinition['effectKind']>([
  'splash_attack',
  'multi_attack',
  'charge_attack',
  'aoe_elite_attack',
  'pierce_all_elite',
  'attack_slow',
  'attack_shield_break',
  'attack_pierce',
  'silence_target',
  'scan_reveal',
]);

function getTargetableOpponents(
  units: CombatUnit[],
  actorSide: CombatSide,
  detectsStealth?: boolean
): CombatUnit[] {
  const aliveOpp = units.filter((u) => u.side !== actorSide && u.alive);
  if (detectsStealth) return aliveOpp;
  const nonStealth = aliveOpp.filter((u) => !isUnitStealthed(u));
  return nonStealth.length > 0 ? nonStealth : aliveOpp;
}

/**
 * Returns true if the unit carries a long-range weapon, is Siege class,
 * is in Siege Mode, or is a Sniper archetype.
 */
export function isRangedUnit(unit: CombatUnit): boolean {
  return Boolean(
    unit.hasLongRangeWeapon ||
      unit.classId === 'siege' ||
      unit.archetype === 'sniper' ||
      hasStatus(unit, 'siege_mode')
  );
}

/**
 * Returns true if the actor/action can ignore row targeting order and hit any enemy row:
 * - Long-range weapon equipped (`hasLongRangeWeapon`)
 * - Siege class or Siege Mode active
 * - Sniper archetype
 * - Long-range skills (missile/bombing/railgun/multi-enemy/AoE/snipe/scan skills)
 */
export function isLongRangeAction(
  actor: CombatUnit,
  action: ActionType,
  skillId?: string
): boolean {
  if (isRangedUnit(actor)) return true;
  if (action === 'skill' && skillId) {
    const sk = getSkillById(skillId);
    if (!sk) return false;
    if (sk.targetType === 'multi_enemy' || sk.targetType === 'all_enemies') {
      return true;
    }
    if (LONG_RANGE_SKILL_EFFECTS.has(sk.effectKind)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns valid enemy targets respecting Stealth + 3-row Front -> Middle -> Back targeting:
 * Standard attacks must target the nearest non-empty enemy row (front, then middle, then back).
 * If a row is wiped out, the next row becomes exposed automatically.
 * Long-range weapons, Siege class, Siege Mode, Snipers, and long-range skills may target any row.
 */
export function getValidEnemyTargets(
  units: CombatUnit[],
  actor: CombatUnit,
  action: ActionType = 'attack',
  skillId?: string
): CombatUnit[] {
  const basePool = getTargetableOpponents(units, actor.side, actor.detectsStealth);
  if (isLongRangeAction(actor, action, skillId)) {
    return basePool;
  }
  for (const row of FORMATION_ROWS) {
    const rowTargets = basePool.filter((u) => u.row === row);
    if (rowTargets.length > 0) {
      return rowTargets;
    }
  }
  return basePool;
}

/**
 * Support abilities (heal, buff) can target any alive ally in any row (front, middle, back).
 */
export function getValidAllyTargets(
  units: CombatUnit[],
  actor: CombatUnit
): CombatUnit[] {
  return units.filter((u) => u.side === actor.side && u.alive);
}

/**
 * Finds alive units adjacent to `targetUnit` within its formation row (col - 1, col + 1).
 * Works across 4v4 (2x2), 6v6 (2x3), and 8v8 (2x4) formations.
 */
export function getAdjacentUnits(
  units: CombatUnit[],
  targetUnit: CombatUnit
): CombatUnit[] {
  const sameRow = units.filter(
    (u) => u.side === targetUnit.side && u.row === targetUnit.row
  );
  const colOf = (u: CombatUnit, fallbackIdx: number) =>
    typeof u.formationCol === 'number' ? u.formationCol : fallbackIdx;

  const targetIdx = sameRow.findIndex((u) => u.id === targetUnit.id);
  if (targetIdx === -1) return [];
  const targetCol = colOf(targetUnit, targetIdx);

  return sameRow.filter((u, idx) => {
    if (!u.alive || u.id === targetUnit.id) return false;
    const c = colOf(u, idx);
    return Math.abs(c - targetCol) === 1;
  });
}

function hydrateFxUnits(
  fx: CombatFxEvent | null,
  units: CombatUnit[],
  actorId: string
): CombatFxEvent | null {
  if (!fx) return null;
  const toSideUnits = units.filter((u) => u.side === fx.toSide);
  const toUnitIds =
    fx.toUnitIds ??
    fx.toSlotIndices
      .map((slotIdx) => toSideUnits[slotIdx]?.id)
      .filter((id): id is string => Boolean(id));
  return {
    ...fx,
    fromUnitId: fx.fromUnitId ?? actorId,
    toUnitIds,
  };
}

export interface ApplyShieldThenHullOptions {
  ignoreShield?: boolean;
  shieldMult?: number;
}

export interface ShieldThenHullResult {
  shieldLost: number;
  hullDamage: number;
  nextShield: number;
  nextHp: number;
  brokeNow: boolean;
}

export function applyShieldThenHull(
  target: Pick<CombatUnit, 'hp' | 'shield'>,
  damage: number,
  opts: ApplyShieldThenHullOptions = {}
): ShieldThenHullResult {
  const safeDamage = Math.max(0, Number.isFinite(damage) ? damage : 0);
  const startShield = Math.max(0, Number.isFinite(target.shield) ? target.shield : 0);
  const startHp = Math.max(0, Number.isFinite(target.hp) ? target.hp : 0);
  const m = clampShieldDamageMult(opts.shieldMult, 1);

  let shieldLost = 0;
  let nextShield = startShield;
  let hullDamage = safeDamage;

  if (!opts.ignoreShield && startShield > 0 && safeDamage > 0) {
    if (startShield >= safeDamage * m) {
      shieldLost = Math.min(startShield, Math.round(safeDamage * m));
      nextShield = startShield - shieldLost;
      hullDamage = 0;
    } else {
      shieldLost = startShield;
      nextShield = 0;
      hullDamage = Math.max(0, Math.round(safeDamage - startShield / m));
    }
  }

  const nextHp = Math.max(0, startHp - hullDamage);
  const brokeNow = startShield > 0 && nextShield === 0 && !opts.ignoreShield;

  return {
    shieldLost,
    hullDamage,
    nextShield,
    nextHp,
    brokeNow,
  };
}

function applyDamageToUnit(
  unitsContext: CombatUnit[],
  attacker: CombatUnit,
  target: CombatUnit,
  rawPower: number,
  options: {
    defensePierce?: number;
    ignoreDef?: boolean;
    bonusCrit?: number;
    round: number;
    actionMeta: { skillId: string; hitIndex: number; totalHits: number };
    tag: 'ATTACK' | 'SKILL';
    isCounter?: boolean;
    isSplash?: boolean;
    adminConfig?: Partial<AdminConfig>;
    rng?: () => number;
    events?: BattleEvent[];
  }
): {
  attackerAfter: CombatUnit;
  targetAfter: CombatUnit;
  logs: CombatLogEntry[];
  popups: FloatingPopup[];
  destroyed: boolean;
  evaded: boolean;
  hitShieldOnly: boolean;
  damageDealt: number;
  counteredAttackerKilled: boolean;
} {
  const rng = options.rng ?? Math.random;
  const logs: CombatLogEntry[] = [];
  const popups: FloatingPopup[] = [];
  let curAttacker = attacker;
  let curTarget = target;

  // Admin God Mode: Player takes 0 damage
  if (options.adminConfig?.godMode && curTarget.isPlayer) {
    popups.push({
      id: nextId('pop'),
      unitId: curTarget.id,
      text: 'GOD 0',
      tone: 'shield',
    });
    return {
      attackerAfter: curAttacker,
      targetAfter: { ...curTarget, animState: 'shielded' },
      logs,
      popups,
      destroyed: false,
      evaded: false,
      hitShieldOnly: true,
      damageDealt: 0,
      counteredAttackerKilled: false,
    };
  }

  // Invincible status: takes 0 damage this round
  if (hasStatus(curTarget, 'invincible')) {
    popups.push({
      id: nextId('pop'),
      unitId: curTarget.id,
      text: 'INVINCIBLE',
      tone: 'shield',
    });
    logs.push({
      id: nextId('log'),
      round: options.round,
      actorName: curTarget.name,
      actorSide: curTarget.side,
      tag: 'SHIELD',
      templateKey: 'log.invincibleBlock',
      params: { target: curTarget.name, actor: curAttacker.name },
    });
    options.events?.push({
      id: nextId('ev'),
      round: options.round,
      turn: 0,
      actorId: curAttacker.id,
      targetId: curTarget.id,
      type: 'damage',
      amount: 0,
      shieldAbsorbed: 0,
      hpDamage: 0,
      skillId: options.actionMeta.skillId || undefined,
      flags: { invincible: true },
    });
    return {
      attackerAfter: curAttacker,
      targetAfter: { ...curTarget, animState: 'shielded' },
      logs,
      popups,
      destroyed: false,
      evaded: false,
      hitShieldOnly: true,
      damageDealt: 0,
      counteredAttackerKilled: false,
    };
  }

  // Counter Turn (Snap Riposte): dodge incoming hit & answer with 100% dmg!
  const counterSt = !options.isCounter ? getStatus(curTarget, 'counter') : undefined;
  if (counterSt && (counterSt.charges ?? 1) > 0) {
    const remainingCharges = (counterSt.charges ?? 1) - 1;
    curTarget = {
      ...curTarget,
      statuses:
        remainingCharges > 0
          ? curTarget.statuses.map((s) =>
              s.type === 'counter' ? { ...s, charges: remainingCharges } : s
            )
          : removeStatus(curTarget.statuses, 'counter'),
      animState: 'evaded',
    };

    popups.push({
      id: nextId('pop'),
      unitId: curTarget.id,
      text: 'COUNTER!',
      tone: 'evade',
    });

    options.events?.push({
      id: nextId('ev'),
      round: options.round,
      turn: 0,
      actorId: curAttacker.id,
      targetId: curTarget.id,
      type: 'dodge',
      skillId: options.actionMeta.skillId || undefined,
      flags: { dodge: true, counter: true },
    });

    const counterMult = counterSt.magnitude ?? 1.0;
    const counterRaw = curTarget.derived.attackPower * 2.15 * counterMult;
    const counterRes = applyDamageToUnit(
      unitsContext,
      curTarget,
      curAttacker,
      counterRaw,
      {
        round: options.round,
        actionMeta: {
          skillId: counterSt.sourceSkillId ?? 'int_snap_riposte',
          hitIndex: 1,
          totalHits: 1,
        },
        tag: 'SKILL',
        isCounter: true,
        adminConfig: options.adminConfig,
        rng,
        events: options.events,
      }
    );

    logs.push({
      id: nextId('log'),
      round: options.round,
      actorName: curTarget.name,
      actorSide: curTarget.side,
      tag: 'EVADE',
      templateKey: 'log.counterAttack',
      params: {
        target: curTarget.name,
        actor: curAttacker.name,
        damage: counterRes.damageDealt,
      },
    });
    logs.push(...counterRes.logs);
    popups.push(...counterRes.popups);

    return {
      attackerAfter: counterRes.targetAfter,
      targetAfter: curTarget,
      logs,
      popups,
      destroyed: false,
      evaded: true,
      hitShieldOnly: false,
      damageDealt: 0,
      counteredAttackerKilled: counterRes.destroyed,
    };
  }

  // Check Target Lock (sure_hit): cannot be dodged, consumes 1 charge
  const sureHitSt = getStatus(curAttacker, 'sure_hit');
  const hasSureHit = Boolean(sureHitSt && (sureHitSt.charges ?? 1) > 0);
  if (hasSureHit && sureHitSt) {
    const nextCharges = (sureHitSt.charges ?? 1) - 1;
    curAttacker = {
      ...curAttacker,
      statuses:
        nextCharges > 0
          ? curAttacker.statuses.map((s) =>
              s.type === 'sure_hit' ? { ...s, charges: nextCharges } : s
            )
          : removeStatus(curAttacker.statuses, 'sure_hit'),
    };
  }

  // Check Camouflage break-on-attack for attacker
  const attackerStealth = getStatus(curAttacker, 'stealth');
  if (attackerStealth?.breakOnAttack) {
    curAttacker = {
      ...curAttacker,
      statuses: removeStatus(curAttacker.statuses, 'stealth'),
    };
  }

  const isOneHit = Boolean(options.adminConfig?.oneHitKills && curAttacker.isPlayer);

  // Check Barrel Roll (evade_all) or standard Dodge
  const forceDodge = !isOneHit && !hasSureHit && hasStatus(curTarget, 'evade_all');
  const effectiveDodge = Math.max(
    0,
    getEffectiveUnitDodge(curTarget) - (curAttacker.accuracyPct ?? 0)
  );
  if (forceDodge || (!isOneHit && !hasSureHit && rng() * 100 < effectiveDodge)) {
    popups.push({
      id: nextId('pop'),
      unitId: curTarget.id,
      text: forceDodge ? 'BARREL ROLL' : 'EVADED',
      tone: 'evade',
    });
    logs.push({
      id: nextId('log'),
      round: options.round,
      actorName: curTarget.name,
      actorSide: curTarget.side,
      tag: 'EVADE',
      templateKey: 'log.evade',
      params: {
        target: curTarget.name,
        actor: curAttacker.name,
        skillId: options.actionMeta.skillId,
        hitIndex: options.actionMeta.hitIndex,
        totalHits: options.actionMeta.totalHits,
      },
    });
    options.events?.push({
      id: nextId('ev'),
      round: options.round,
      turn: 0,
      actorId: curAttacker.id,
      targetId: curTarget.id,
      type: 'dodge',
      skillId: options.actionMeta.skillId || undefined,
      flags: { dodge: true },
    });
    return {
      attackerAfter: curAttacker,
      targetAfter: { ...curTarget, animState: 'evaded' },
      logs,
      popups,
      destroyed: false,
      evaded: true,
      hitShieldOnly: false,
      damageDealt: 0,
      counteredAttackerKilled: false,
    };
  }

  const totalCritChance = Math.min(
    75,
    curAttacker.derived.critChance + (options.bonusCrit ?? 0)
  );
  const isCrit = isOneHit || rng() * 100 < totalCritChance;

  const formationConfig =
    options.adminConfig?.formation ?? DEFAULT_FORMATION_CONFIG;
  const ignoreDef = Boolean(options.ignoreDef);
  const totalPierce = ignoreDef
    ? 1.0
    : Math.min(
        0.85,
        (options.defensePierce ?? 0) + curAttacker.derived.armorPiercePct / 100
      );
  const effectiveDefense = Math.max(
    0,
    getEffectiveUnitDefense(curTarget, formationConfig) * (1 - totalPierce)
  );
  const mitigation = ignoreDef
    ? 1.0
    : COMBAT_FORMULAS.defenseMitigationDivisor /
      (COMBAT_FORMULAS.defenseMitigationDivisor + effectiveDefense);

  // Configurable 3-row attacker damage modifiers (e.g. Front 0%, Middle 0%, Back +10% for ranged weapons)
  const attackerRowMod = getRowModifier(formationConfig, curAttacker.row);
  const isRangedAttacker =
    isRangedUnit(curAttacker) ||
    (options.tag === 'SKILL' &&
      Boolean(options.actionMeta.skillId) &&
      isLongRangeAction(curAttacker, 'skill', options.actionMeta.skillId));
  const rowDamageMult = Math.max(
    0.1,
    1 +
      attackerRowMod.damagePct +
      (isRangedAttacker ? attackerRowMod.rangedDamagePct : 0)
  );

  // Vulnerable debuff (+15% dmg taken from Scanning)
  const vulnSt = getStatus(curTarget, 'vulnerable');
  const vulnMult = vulnSt ? 1 + (vulnSt.magnitude ?? 0.15) : 1.0;

  // Anti-Stalemate (Soft Enrage): enemy outgoing damage scales after startRound (cap +200%)
  const enrageBonus =
    curAttacker.side === 'enemy'
      ? getEnemyEnrageBonusPct(
          options.round,
          options.adminConfig?.softEnrageEnabled ?? true,
          options.adminConfig?.enrageStartRound ?? BALANCE_CONFIG.enrageStartRound,
          options.adminConfig?.enrageStepPct ?? BALANCE_CONFIG.enrageStepPct
        )
      : 0;
  const enrageMult = 1 + enrageBonus;

  let finalDamage = isOneHit
    ? 99999
    : Math.round(
        rawPower *
          mitigation *
          rowDamageMult *
          vulnMult *
          enrageMult *
          randomVariance(rng)
      );
  if (!isOneHit && isCrit) {
    finalDamage = Math.round(finalDamage * COMBAT_FORMULAS.critDamageMultiplier);
  }
  if (!isOneHit && curTarget.isDefending) {
    finalDamage = Math.round(finalDamage * COMBAT_FORMULAS.defendDamageMultiplier);
  }
  finalDamage = Math.max(6, finalDamage);

  // Shield ALWAYS absorbs first (Starbreaker ignores DEF only; SH2b applies shield mult on skill hits)
  const isSkillHit = options.tag === 'SKILL' && !options.isCounter;
  let effectiveShieldMult = 1;
  if (isSkillHit) {
    const skillId = options.actionMeta.skillId;
    const skillDef = skillId ? getSkillById(skillId) : undefined;
    const overrideRaw = skillId
      ? options.adminConfig?.shieldDamageOverrides?.[skillId]
      : undefined;
    const attackerMult =
      typeof overrideRaw === 'number' && Number.isFinite(overrideRaw)
        ? overrideRaw
        : skillDef?.shieldDamageMult ?? 1;
    const crackedMult = hasStatus(curTarget, 'shield_cracked')
      ? sanitizeShieldCrackedMult(options.adminConfig?.shieldCrackedMult)
      : 1;
    effectiveShieldMult = clampShieldDamageMult(
      Math.max(attackerMult, crackedMult),
      1
    );
  }

  const dmgRes = applyShieldThenHull(curTarget, finalDamage, {
    shieldMult: effectiveShieldMult,
  });
  const nextShield = dmgRes.nextShield;
  const nextHp = dmgRes.nextHp;
  const shieldAbsorbed = dmgRes.shieldLost;
  const hullDamage = dmgRes.hullDamage;
  const totalDamageDealt = shieldAbsorbed + hullDamage;
  const destroyed = nextHp <= 0;
  const hitShieldOnly = shieldAbsorbed > 0 && hullDamage === 0;
  const loggedShieldMult =
    shieldAbsorbed > 0 && effectiveShieldMult > 1
      ? Number(effectiveShieldMult.toFixed(2))
      : 1;

  if (hitShieldOnly) {
    popups.push({
      id: nextId('pop'),
      unitId: curTarget.id,
      text: isCrit ? `CRIT SHD -${shieldAbsorbed}` : `SHD -${shieldAbsorbed}`,
      tone: 'shield',
    });
  } else {
    popups.push({
      id: nextId('pop'),
      unitId: curTarget.id,
      text: isCrit ? `CRIT -${totalDamageDealt}` : `-${totalDamageDealt}`,
      tone: isCrit ? 'crit' : 'damage',
    });
  }

  logs.push({
    id: nextId('log'),
    round: options.round,
    actorName: curAttacker.name,
    actorSide: curAttacker.side,
    tag: isCrit ? 'CRIT' : hitShieldOnly ? 'SHIELD' : options.tag,
    templateKey: 'log.damage',
    params: {
      actor: curAttacker.name,
      target: curTarget.name,
      skillId: options.actionMeta.skillId,
      hitIndex: options.actionMeta.hitIndex,
      totalHits: options.actionMeta.totalHits,
      shieldAbsorbed,
      hullDamage,
      shieldMult: loggedShieldMult,
      isCrit: isCrit ? 1 : 0,
      isDefending: curTarget.isDefending ? 1 : 0,
    },
  });

  options.events?.push({
    id: nextId('ev'),
    round: options.round,
    turn: 0,
    actorId: curAttacker.id,
    targetId: curTarget.id,
    type: 'damage',
    amount: totalDamageDealt,
    shieldAbsorbed,
    hpDamage: hullDamage,
    skillId: options.actionMeta.skillId || undefined,
    flags: {
      crit: isCrit,
      shieldAbsorbed: shieldAbsorbed > 0,
      kill: destroyed,
      splash: Boolean(options.isSplash),
      counter: Boolean(options.isCounter),
    },
  });

  if (destroyed) {
    options.events?.push({
      id: nextId('ev'),
      round: options.round,
      turn: 0,
      actorId: curAttacker.id,
      targetId: curTarget.id,
      type: 'kill',
      skillId: options.actionMeta.skillId || undefined,
      flags: { kill: true },
    });
    logs.push({
      id: nextId('log'),
      round: options.round,
      actorName: curTarget.name,
      actorSide: curTarget.side,
      tag: 'KO',
      templateKey: 'log.destroyed',
      params: {
        target: curTarget.name,
        classId: curTarget.classId,
      },
    });
  }

  const anim: UnitAnimState = destroyed
    ? 'destroyed'
    : hitShieldOnly
    ? 'shielded'
    : 'hit';

  const shieldRegenCfg = sanitizeShieldRegenConfig(options.adminConfig?.shieldRegen);
  let nextStatuses = destroyed ? [] : curTarget.statuses;
  let nextHitsSinceOwnTurn = curTarget.hitsSinceOwnTurn;

  if (!destroyed && dmgRes.brokeNow) {
    nextStatuses = removeStatus(nextStatuses, 'shield_cracked');
  }

  if (shieldRegenCfg.enabled) {
    if (curAttacker.side !== curTarget.side && (shieldAbsorbed > 0 || hullDamage > 0)) {
      nextHitsSinceOwnTurn = getUnitHitsSinceOwnTurn(curTarget) + 1;
    }
    if (!destroyed && dmgRes.brokeNow) {
      nextStatuses = addOrRefreshStatus(nextStatuses, {
        type: 'shield_break',
        turnsRemaining: shieldRegenCfg.restartTurns,
        isDebuff: true,
        sourceName: curAttacker.name,
      });
      options.events?.push({
        id: nextId('ev'),
        round: options.round,
        turn: 0,
        actorId: curAttacker.id,
        targetId: curTarget.id,
        type: 'status_applied',
        statusId: 'shield_break',
        skillId: options.actionMeta.skillId || undefined,
        flags: { isDebuff: true },
      });
    }
  }

  return {
    attackerAfter: curAttacker,
    targetAfter: {
      ...curTarget,
      shield: nextShield,
      hp: nextHp,
      alive: !destroyed,
      isDefending: destroyed ? false : curTarget.isDefending,
      statuses: nextStatuses,
      ...(nextHitsSinceOwnTurn !== undefined
        ? { hitsSinceOwnTurn: nextHitsSinceOwnTurn }
        : {}),
      animState: anim,
    },
    logs,
    popups,
    destroyed,
    evaded: false,
    hitShieldOnly,
    damageDealt: totalDamageDealt,
    counteredAttackerKilled: false,
  };
}

export interface ApplyShieldCrackedSource {
  actorId?: string;
  actorName?: string;
  skillId?: string;
  round?: number;
  magnitude?: number;
  events?: BattleEvent[];
}

export function applyShieldCracked(
  target: CombatUnit,
  turns: number,
  source: string | ApplyShieldCrackedSource
): {
  targetAfter: CombatUnit;
  applied: boolean;
  logs: CombatLogEntry[];
  popups: FloatingPopup[];
} {
  if (!target.alive) {
    return { targetAfter: target, applied: false, logs: [], popups: [] };
  }

  const src: ApplyShieldCrackedSource =
    typeof source === 'string' ? { actorName: source } : source;
  const actorName = src.actorName ?? 'System';
  const round = src.round ?? 1;

  if (target.shield <= 0 || hasStatus(target, 'shield_break')) {
    return {
      targetAfter: target,
      applied: false,
      logs: [
        {
          id: nextId('log'),
          round,
          actorName,
          tag: 'STATUS',
          templateKey: 'log.shieldCrackNoShield',
          params: {
            target: target.name,
          },
        },
      ],
      popups: [],
    };
  }

  const safeTurns = sanitizeShieldCrackedTurns(turns);
  const safeMult = sanitizeShieldCrackedMult(src.magnitude);
  const entry: ActiveStatusEffect = {
    type: 'shield_cracked',
    turnsRemaining: safeTurns,
    magnitude: safeMult,
    isDebuff: true,
    sourceSkillId: src.skillId,
    sourceName: actorName,
  };

  src.events?.push({
    id: nextId('ev'),
    round,
    turn: 0,
    actorId: src.actorId ?? '',
    targetId: target.id,
    type: 'status_applied',
    statusId: 'shield_cracked',
    skillId: src.skillId,
    flags: { isDebuff: true },
  });

  return {
    targetAfter: {
      ...target,
      statuses: addOrRefreshStatus(target.statuses, entry),
    },
    applied: true,
    logs: [
      {
        id: nextId('log'),
        round,
        actorName,
        tag: 'STATUS',
        templateKey: 'log.statusApplied',
        params: {
          target: target.name,
          status: 'shield_cracked',
          turns: safeTurns,
        },
      },
    ],
    popups: [
      {
        id: nextId('pop'),
        unitId: target.id,
        text: 'SHD CRACK',
        tone: 'status',
      },
    ],
  };
}

function tryInflictStatus(
  target: CombatUnit,
  entry: ActiveStatusEffect,
  chance: number,
  actorName: string,
  round: number,
  rng: () => number,
  events?: BattleEvent[],
  actorId?: string
): {
  targetAfter: CombatUnit;
  logs: CombatLogEntry[];
  popups: FloatingPopup[];
} {
  if (!target.alive || rng() > chance) {
    return { targetAfter: target, logs: [], popups: [] };
  }

  events?.push({
    id: nextId('ev'),
    round,
    turn: 0,
    actorId: actorId ?? '',
    targetId: target.id,
    type: 'status_applied',
    statusId: entry.type,
    skillId: entry.sourceSkillId,
    flags: { isDebuff: DEBUFF_TYPES.has(entry.type) },
  });

  const popupMap: Partial<Record<StatusEffectType, string>> = {
    burn: 'BURN',
    shield_break: 'SHD BREAK',
    shield_cracked: 'SHD CRACK',
    slow: 'SLOW',
    silence: 'SILENCED',
    vulnerable: 'VULN +15%',
  };

  return {
    targetAfter: {
      ...target,
      statuses: addOrRefreshStatus(target.statuses, entry),
    },
    logs: [
      {
        id: nextId('log'),
        round,
        actorName,
        tag: 'STATUS',
        templateKey: 'log.statusApplied',
        params: {
          target: target.name,
          status: entry.type,
          turns: entry.turnsRemaining,
        },
      },
    ],
    popups: [
      {
        id: nextId('pop'),
        unitId: target.id,
        text: popupMap[entry.type] ?? entry.type.toUpperCase(),
        tone: 'status',
      },
    ],
  };
}

function decrementCooldowns(
  cooldowns: Record<string, number>
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(cooldowns)) {
    if (v > 1) {
      next[k] = v - 1;
    }
  }
  return next;
}

export interface SpTransferResolution {
  updatedUnits: CombatUnit[];
  popups: FloatingPopup[];
  logEntry: CombatLogEntry;
  recipientIds: string[];
  totalMoved: number;
  cost: number;
  feePaid: number;
  amountPerAlly: number;
}

export function getMaxAffordableFluxCount(
  units: CombatUnit[],
  actorId: string,
  skillLevel: number,
  cfg?: FluxTransferConfig | null
): number {
  const actor = units.find((u) => u.id === actorId);
  if (!actor || !actor.alive) return 0;
  const rule = getFluxTransferRule(skillLevel, cfg, BALANCE_CONFIG.skillMaxLevel);
  const maxTargets = Math.max(0, Math.floor(rule.targets));
  if (maxTargets <= 0) return 0;
  const actorSp = Math.max(0, actor.sp);
  const amountEach = getFluxPlannedAmountEach(
    actorSp,
    skillLevel,
    cfg,
    BALANCE_CONFIG.skillMaxLevel
  );
  if (amountEach <= 0) return maxTargets;
  for (let k = maxTargets; k >= 1; k--) {
    const worstCaseCost = Math.ceil(k * amountEach * (1 + rule.fee / 100));
    if (worstCaseCost <= actorSp) {
      return k;
    }
  }
  return 0;
}

export function resolveSpTransfer(
  units: CombatUnit[],
  actorId: string,
  skillLevel: number,
  cfg?: FluxTransferConfig | null,
  count?: number,
  round = 1,
  nextIdFn: (prefix: string) => string = nextId,
  skillId = 'sup_flux_transfer'
): SpTransferResolution {
  const nextUnits = units.map((u) => ({ ...u }));
  const actorIdx = nextUnits.findIndex((u) => u.id === actorId);
  const popups: FloatingPopup[] = [];
  const recipientIds: string[] = [];

  if (actorIdx < 0 || !nextUnits[actorIdx].alive) {
    return {
      updatedUnits: nextUnits,
      popups,
      logEntry: {
        id: nextIdFn('log'),
        round,
        actorName: '',
        actorSide: 'ally',
        tag: 'HEAL',
        templateKey: 'log.spTransfer',
        params: { actor: '', skillId, amount: 0, count: 0, fee: 0 },
      },
      recipientIds,
      totalMoved: 0,
      cost: 0,
      feePaid: 0,
      amountPerAlly: 0,
    };
  }

  const actor = nextUnits[actorIdx];
  const rule = getFluxTransferRule(skillLevel, cfg, BALANCE_CONFIG.skillMaxLevel);
  const maxTargets = Math.max(0, Math.floor(rule.targets));
  const maxAffordable = getMaxAffordableFluxCount(
    nextUnits,
    actorId,
    skillLevel,
    cfg
  );
  const requested =
    count === undefined ? maxTargets : Math.max(0, Math.floor(count));
  const effectiveCount = Math.min(requested, maxTargets, maxAffordable);
  const amountEach = getFluxPlannedAmountEach(
    actor.sp,
    skillLevel,
    cfg,
    BALANCE_CONFIG.skillMaxLevel
  );

  const candidateIndices = nextUnits
    .map((u, idx) => ({ u, idx }))
    .filter(
      ({ u }) =>
        u.side === actor.side &&
        u.alive &&
        u.id !== actor.id &&
        u.derived.maxSp > 0 &&
        u.sp < u.derived.maxSp
    )
    .sort(
      (a, b) =>
        a.u.sp / a.u.derived.maxSp - b.u.sp / b.u.derived.maxSp
    )
    .slice(0, effectiveCount);

  let totalMoved = 0;
  if (amountEach > 0) {
    for (const { idx } of candidateIndices) {
      const ally = nextUnits[idx];
      const received = Math.min(amountEach, Math.max(0, ally.derived.maxSp - ally.sp));
      if (received <= 0) continue;
      nextUnits[idx] = {
        ...ally,
        sp: ally.sp + received,
        animState: 'shielded',
      };
      popups.push({
        id: nextIdFn('pop'),
        unitId: ally.id,
        text: `+${received} SP`,
        tone: 'buff',
      });
      recipientIds.push(ally.id);
      totalMoved += received;
    }
  }

  const rawCost =
    totalMoved > 0 ? Math.ceil(totalMoved * (1 + rule.fee / 100)) : 0;
  const nextActorSp = Math.max(0, actor.sp - rawCost);
  const actualCost = Math.max(0, actor.sp - nextActorSp);
  const feePaid = Math.max(0, rawCost - totalMoved);

  nextUnits[actorIdx] = {
    ...actor,
    sp: nextActorSp,
  };

  const logEntry: CombatLogEntry = {
    id: nextIdFn('log'),
    round,
    actorName: actor.name,
    actorSide: actor.side,
    tag: 'HEAL',
    templateKey: 'log.spTransfer',
    params: {
      actor: actor.name,
      skillId,
      amount: totalMoved,
      count: recipientIds.length,
      fee: feePaid,
    },
  };

  return {
    updatedUnits: nextUnits,
    popups,
    logEntry,
    recipientIds,
    totalMoved,
    cost: actualCost,
    feePaid,
    amountPerAlly: amountEach,
  };
}

export interface ResolveUnitActionOptions {
  skipTurnStartTicks?: boolean;
  turnLockedSkillIds?: readonly string[];
}

export function resolveUnitAction(
  units: CombatUnit[],
  actorId: string,
  action: ActionType,
  targetId: string | null,
  round: number,
  adminConfig?: Partial<AdminConfig>,
  rng: () => number = Math.random,
  skillId?: string,
  transferCount?: number,
  options?: ResolveUnitActionOptions
): ActionResolution {
  const events: BattleEvent[] = [];
  const result = resolveUnitActionCore(
    units,
    actorId,
    action,
    targetId,
    round,
    events,
    adminConfig,
    rng,
    skillId,
    transferCount,
    options
  );

  // Automatically record any buffs applied/refreshed during this turn
  const beforeMap = new Map(units.map((u) => [u.id, u]));
  const alreadyRecordedStatusKeys = new Set(
    events
      .filter((e) => e.type === 'status_applied')
      .map((e) => `${e.targetId}:${e.statusId}`)
  );
  for (const afterUnit of result.updatedUnits) {
    const beforeUnit = beforeMap.get(afterUnit.id);
    if (!beforeUnit) continue;
    for (const st of afterUnit.statuses) {
      if (DEBUFF_TYPES.has(st.type)) continue;
      const prevSt = beforeUnit.statuses.find((s) => s.type === st.type);
      const isAddedOrRefreshed =
        !prevSt || st.turnsRemaining > prevSt.turnsRemaining;
      const key = `${afterUnit.id}:${st.type}`;
      if (isAddedOrRefreshed && !alreadyRecordedStatusKeys.has(key)) {
        alreadyRecordedStatusKeys.add(key);
        events.push({
          id: nextId('ev'),
          round,
          turn: 0,
          actorId,
          targetId: afterUnit.id,
          type: 'status_applied',
          statusId: st.type,
          skillId: st.sourceSkillId ?? skillId,
          flags: { isDebuff: false },
        });
      }
    }
  }

  return {
    ...result,
    events,
    fxEvent: hydrateFxUnits(result.fxEvent, units, actorId),
  };
}

function resolveUnitActionCore(
  units: CombatUnit[],
  actorId: string,
  action: ActionType,
  targetId: string | null,
  round: number,
  events: BattleEvent[],
  adminConfig?: Partial<AdminConfig>,
  rng: () => number = Math.random,
  skillId?: string,
  transferCount?: number,
  options?: ResolveUnitActionOptions
): Omit<ActionResolution, 'events'> {
  const originalActor = units.find((u) => u.id === actorId);
  if (!originalActor || !originalActor.alive) {
    return {
      updatedUnits: units,
      logEntries: [],
      popups: [],
      fxEvent: null,
      destroyedUnitIds: [],
      soundCue: 'laser',
    };
  }

  const skipTurnStartTicks = Boolean(options?.skipTurnStartTicks);
  if (!skipTurnStartTicks) {
    events.push({
      id: nextId('ev'),
      round,
      turn: 0,
      actorId,
      type: 'turn_start',
    });
  }

  const cls = MECH_CLASSES[originalActor.classId];
  const fromSlotIndex = getSlotIndex(units, originalActor.id);

  // Clone units and reset transient animations
  const nextUnits: CombatUnit[] = units.map((u) => ({
    ...u,
    isDefending: u.id === actorId ? false : u.isDefending,
    animState: u.alive ? 'idle' : 'destroyed',
  }));

  const actorIdx = nextUnits.findIndex((u) => u.id === actorId);
  const logs: CombatLogEntry[] = [];
  const popups: FloatingPopup[] = [];
  const destroyedUnitIds: string[] = [];

  // ---- Start-of-turn: Cooldown tick, Passive SP regen, Regen HoT, Burn DoT, Status tick ----
  let actor: CombatUnit = skipTurnStartTicks
    ? { ...nextUnits[actorIdx] }
    : {
        ...nextUnits[actorIdx],
        skillCooldowns: decrementCooldowns(nextUnits[actorIdx].skillCooldowns),
      };

  // Capture whether shield_break is active on this own turn before status tick decrements it
  const shieldBreakAtTurnStart = hasStatus(actor, 'shield_break');
  const shieldRegenCfg = sanitizeShieldRegenConfig(adminConfig?.shieldRegen);

  if (!skipTurnStartTicks) {
    if (actor.derived.spRegenPerTurn > 0) {
      actor = {
        ...actor,
        sp: Math.min(actor.derived.maxSp, actor.sp + actor.derived.spRegenPerTurn),
      };
    }

    // Passive per-turn Shield Regeneration (next to SP regen, before status tick)
    if (shieldRegenCfg.enabled) {
      const shieldRegen = computeShieldRegen(actor, shieldRegenCfg);
      if (shieldRegen.amount > 0) {
        actor = {
          ...actor,
          shield: Math.min(
            actor.derived.maxShield,
            actor.shield + shieldRegen.amount
          ),
        };
        events.push({
          id: nextId('ev'),
          round,
          turn: 0,
          actorId: actor.id,
          targetId: actor.id,
          type: 'shield_grant',
          amount: shieldRegen.amount,
          flags: { isRegen: true },
        });
        if (
          actor.derived.maxShield > 0 &&
          shieldRegen.amount >= actor.derived.maxShield * 0.01
        ) {
          popups.push({
            id: nextId('pop'),
            unitId: actor.id,
            text: `SHD +${shieldRegen.amount}`,
            tone: 'shield',
          });
        }
        logs.push({
          id: nextId('log'),
          round,
          actorName: actor.name,
          actorSide: actor.side,
          tag: 'SHIELD',
          templateKey: 'log.shieldRegen',
          params: {
            target: actor.name,
            amount: shieldRegen.amount,
            reason: shieldRegen.reason,
            multPct: shieldRegen.multPct,
            hits: shieldRegen.hits,
            classId: actor.classId,
          },
        });
      }
      if (getUnitHitsSinceOwnTurn(actor) > 0) {
        actor = { ...actor, hitsSinceOwnTurn: 0 };
      }
    }

    // Healing Field HoT tick
    const regenSt = getStatus(actor, 'regen_hp');
    if (regenSt) {
      const healAmt = Math.min(
        actor.derived.maxHp - actor.hp,
        Math.max(4, Math.round(actor.derived.maxHp * (regenSt.magnitude ?? 0.1)))
      );
      if (healAmt > 0) {
        actor = { ...actor, hp: actor.hp + healAmt };
        events.push({
          id: nextId('ev'),
          round,
          turn: 0,
          actorId: actor.id,
          targetId: actor.id,
          type: 'heal',
          amount: healAmt,
          skillId: regenSt.sourceSkillId,
          flags: { isRegen: true },
        });
        popups.push({
          id: nextId('pop'),
          unitId: actor.id,
          text: `+${healAmt} HP`,
          tone: 'heal',
        });
        logs.push({
          id: nextId('log'),
          round,
          actorName: actor.name,
          actorSide: actor.side,
          tag: 'HEAL',
          templateKey: 'log.regenTick',
          params: { target: actor.name, amount: healAmt },
        });
      }
    }

    // Burn DoT tick
    if (hasStatus(actor, 'burn')) {
      const burnDmg =
        adminConfig?.godMode && actor.isPlayer
          ? 0
          : Math.max(
              5,
              Math.round(actor.derived.maxHp * BALANCE_CONFIG.burnDamageRatio)
            );
      const nextHp = Math.max(0, actor.hp - burnDmg);
      const burnedOut = nextHp <= 0;
      actor = {
        ...actor,
        hp: nextHp,
        alive: !burnedOut,
        animState: burnedOut ? 'destroyed' : 'hit',
      };
      if (burnDmg > 0) {
        events.push({
          id: nextId('ev'),
          round,
          turn: 0,
          actorId: actor.id,
          targetId: actor.id,
          type: 'damage',
          amount: burnDmg,
          shieldAbsorbed: 0,
          hpDamage: burnDmg,
          flags: { isBurn: true, kill: burnedOut },
        });
        popups.push({
          id: nextId('pop'),
          unitId: actor.id,
          text: `BURN -${burnDmg}`,
          tone: 'status',
        });
        logs.push({
          id: nextId('log'),
          round,
          actorName: actor.name,
          actorSide: actor.side,
          tag: 'STATUS',
          templateKey: 'log.burnTick',
          params: { target: actor.name, damage: burnDmg },
        });
      }
      if (burnedOut) {
        destroyedUnitIds.push(actor.id);
        events.push({
          id: nextId('ev'),
          round,
          turn: 0,
          actorId: actor.id,
          targetId: actor.id,
          type: 'kill',
          flags: { isBurn: true, kill: true },
        });
        logs.push({
          id: nextId('log'),
          round,
          actorName: actor.name,
          actorSide: actor.side,
          tag: 'KO',
          templateKey: 'log.destroyed',
          params: { target: actor.name, classId: actor.classId },
        });
      }
    }
  }

  // Check if releasing a charged shot (str_solar_capacitor) BEFORE ticking statuses
  const chargingSt = getStatus(actor, 'charging');

  if (!skipTurnStartTicks) {
    // Tick down active non-permanent status durations (99 = toggle/until-attack)
    actor = {
      ...actor,
      statuses: actor.alive
        ? actor.statuses
            .map((s) =>
              s.turnsRemaining >= 90
                ? s
                : { ...s, turnsRemaining: s.turnsRemaining - 1 }
            )
            .filter((s) => s.turnsRemaining > 0)
        : [],
    };
  }
  nextUnits[actorIdx] = actor;

  if (!actor.alive) {
    return {
      updatedUnits: nextUnits,
      logEntries: logs,
      popups,
      fxEvent: null,
      destroyedUnitIds,
      soundCue: 'destroy',
    };
  }

  // ---- AUTO-RELEASE CHARGED SHOT ON NEXT TURN ----
  if (chargingSt) {
    const chargedSkill = getSkillById(
      chargingSt.sourceSkillId ?? 'str_solar_capacitor'
    );
    const skillLv =
      actor.skillLevels[chargedSkill?.id ?? 'str_solar_capacitor'] ?? 1;
    const scaled = chargedSkill
      ? getScaledSkillStats(chargedSkill, skillLv)
      : { powerMultiplier: 3.2 };

    const opponents = getTargetableOpponents(nextUnits, actor.side, actor.detectsStealth);
    const chosenTarget =
      opponents.find((u) => u.id === chargingSt.targetId) ?? opponents[0];

    nextUnits[actorIdx] = {
      ...actor,
      statuses: removeStatus(actor.statuses, 'charging'),
      animState: 'attacking',
    };

    if (chosenTarget) {
      const targetIdx = nextUnits.findIndex((u) => u.id === chosenTarget.id);
      const dmgMult = getEffectiveAttackDamageMult(nextUnits[actorIdx], true);
      const rawPower =
        nextUnits[actorIdx].derived.attackPower *
        2.15 *
        (scaled.powerMultiplier || 3.2) *
        dmgMult;

      const res = applyDamageToUnit(
        nextUnits,
        nextUnits[actorIdx],
        chosenTarget,
        rawPower,
        {
          round,
          actionMeta: {
            skillId: chargedSkill?.id ?? 'str_solar_capacitor',
            hitIndex: 1,
            totalHits: 1,
          },
          tag: 'SKILL',
          adminConfig,
          rng,
          events,
        }
      );
      nextUnits[actorIdx] = res.attackerAfter;
      nextUnits[targetIdx] = res.targetAfter;
      logs.push(...res.logs);
      popups.push(...res.popups);
      if (res.destroyed) destroyedUnitIds.push(chosenTarget.id);
      if (res.counteredAttackerKilled) destroyedUnitIds.push(actor.id);

      return {
        updatedUnits: nextUnits,
        logEntries: logs,
        popups,
        fxEvent: {
          id: nextId('fx'),
          kind: 'railgun',
          fromSide: actor.side,
          fromSlotIndex,
          toSide: chosenTarget.side,
          toSlotIndices: [getSlotIndex(units, chosenTarget.id)],
          accentHex: '#F59E0B',
        },
        destroyedUnitIds,
        soundCue: destroyedUnitIds.length > 0 ? 'destroy' : 'heavy',
      };
    }
  }

  // ---- 1. DEFEND ACTION ----
  if (action === 'defend') {
    const spRecovered = Math.min(
      actor.derived.maxSp - actor.sp,
      COMBAT_FORMULAS.defendSpGain
    );
    const shieldBlocked = shieldBreakAtTurnStart || hasStatus(actor, 'shield_break');
    const shieldRecovered = shieldBlocked
      ? 0
      : Math.min(
          actor.derived.maxShield - actor.shield,
          Math.round(
            actor.derived.maxShield * COMBAT_FORMULAS.defendShieldRestoreRatio
          )
        );

    nextUnits[actorIdx] = {
      ...actor,
      isDefending: true,
      sp: actor.sp + spRecovered,
      shield: actor.shield + shieldRecovered,
      animState: 'shielded',
    };

    popups.push({
      id: nextId('pop'),
      unitId: actor.id,
      text:
        shieldRecovered > 0
          ? `SHIELD +${shieldRecovered}`
          : `DEFEND +${spRecovered} SP`,
      tone: 'buff',
    });

    events.push({
      id: nextId('ev'),
      round,
      turn: 0,
      actorId: actor.id,
      targetId: actor.id,
      type: 'defend',
    });
    if (shieldRecovered > 0) {
      events.push({
        id: nextId('ev'),
        round,
        turn: 0,
        actorId: actor.id,
        targetId: actor.id,
        type: 'shield_grant',
        amount: shieldRecovered,
      });
    }

    logs.push({
      id: nextId('log'),
      round,
      actorName: actor.name,
      actorSide: actor.side,
      tag: 'DEFEND',
      templateKey: 'log.defend',
      params: { actor: actor.name, shieldRecovered, spRecovered },
    });

    return {
      updatedUnits: nextUnits,
      logEntries: logs,
      popups,
      fxEvent: null,
      destroyedUnitIds,
      soundCue: 'defend',
    };
  }

  // ---- 2. SKILL ACTION (Full 38-skill engine with strict validation) ----
  if (action === 'skill') {
    const requestedSkillId = skillId ?? actor.equippedSkillIds[0];
    const usability = requestedSkillId
      ? canUnitUseSkill(
          actor,
          requestedSkillId,
          adminConfig,
          options?.turnLockedSkillIds
        )
      : null;
    const skill: SkillDefinition | undefined = requestedSkillId
      ? getSkillById(requestedSkillId)
      : undefined;

    if (skill && usability && usability.canUse) {
      const skillLv = actor.skillLevels[skill.id] ?? actor.skillLevel ?? 1;
      const scaled = getScaledSkillStats(skill, skillLv);

      // Deduct SP, set Cooldown, record Once-Per-Battle
      const nextCooldowns =
        skill.cooldown > 0
          ? { ...actor.skillCooldowns, [skill.id]: skill.cooldown }
          : { ...actor.skillCooldowns };
      const nextUsedOnce = skill.oncePerBattle
        ? [...actor.usedOnceSkills, skill.id]
        : actor.usedOnceSkills;

      nextUnits[actorIdx] = {
        ...actor,
        sp: Math.max(0, actor.sp - usability.spCost),
        skillCooldowns: nextCooldowns,
        usedOnceSkills: nextUsedOnce,
        animState:
          skill.targetType === 'self' ||
          skill.targetType === 'single_ally' ||
          skill.targetType === 'all_allies'
            ? 'casting'
            : 'attacking',
      };

      const act = nextUnits[actorIdx];

      events.push({
        id: nextId('ev'),
        round,
        turn: 0,
        actorId: act.id,
        type: 'skill_cast',
        skillId: skill.id,
        spSpent: usability.spCost,
      });

      // Handle each skill effect kind
      switch (skill.effectKind) {
        // ---- SELF BUFFS & STANCES ----
        case 'buff_def': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'def_up',
              turnsRemaining: skill.duration ?? 3,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: `DEF +${Math.round(scaled.buffMagnitude * 100)}%`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'defend',
          };
        }

        case 'buff_eva': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'eva_up',
              turnsRemaining: skill.duration ?? 3,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: `EVA +${Math.round(scaled.buffMagnitude * 100)}%`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'evade',
          };
        }

        case 'buff_primary_dmg': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'primary_dmg_up',
              turnsRemaining: skill.duration ?? 3,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: `WPN +${Math.round(scaled.buffMagnitude * 100)}%`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'defend',
          };
        }

        case 'buff_skill_dmg': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'skill_dmg_up',
              turnsRemaining: skill.duration ?? 3,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: `SKL +${Math.round(scaled.buffMagnitude * 100)}%`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'defend',
          };
        }

        case 'buff_sure_hit': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'sure_hit',
              turnsRemaining: skill.duration ?? 4,
              charges: skill.charges ?? 2,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: `LOCK x${skill.charges ?? 2}`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'defend',
          };
        }

        case 'stealth_turns': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'stealth',
              turnsRemaining: skill.duration ?? 2,
              breakOnAttack: false,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: 'STEALTH',
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'evade',
          };
        }

        case 'stealth_until_attack': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'stealth',
              turnsRemaining: 99,
              breakOnAttack: true,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: 'CAMO',
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'evade',
          };
        }

        case 'toggle_siege_mode': {
          const turningOff = hasStatus(act, 'siege_mode');
          let nextStatuses = removeStatus(act.statuses, 'siege_mode');
          if (!turningOff) {
            // Mutually exclusive with siege_defense and camo stealth
            nextStatuses = removeStatus(nextStatuses, 'siege_defense');
            nextStatuses = addOrRefreshStatus(nextStatuses, {
              type: 'siege_mode',
              turnsRemaining: 99,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            });
          }
          nextUnits[actorIdx] = { ...act, statuses: nextStatuses };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: turningOff ? 'SIEGE OFF' : 'SIEGE ON',
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.stanceToggle',
            params: {
              actor: act.name,
              skillId: skill.id,
              state: turningOff ? 'OFF' : 'ON',
            },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'defend',
          };
        }

        case 'toggle_siege_defense': {
          const turningOff = hasStatus(act, 'siege_defense');
          let nextStatuses = removeStatus(act.statuses, 'siege_defense');
          let nextShield = act.shield;
          if (!turningOff) {
            nextStatuses = removeStatus(nextStatuses, 'siege_mode');
            nextStatuses = addOrRefreshStatus(nextStatuses, {
              type: 'siege_defense',
              turnsRemaining: 99,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            });
            const shieldBlocked =
              shieldBreakAtTurnStart || hasStatus(act, 'shield_break');
            const shieldBoost = shieldBlocked
              ? 0
              : Math.round(
                  act.derived.maxShield * (scaled.secondaryMagnitude || 0.3)
                );
            nextShield = Math.min(act.derived.maxShield, act.shield + shieldBoost);
          }
          nextUnits[actorIdx] = {
            ...act,
            shield: nextShield,
            statuses: nextStatuses,
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: turningOff ? 'FORTRESS OFF' : 'FORTRESS ON',
            tone: 'shield',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.stanceToggle',
            params: {
              actor: act.name,
              skillId: skill.id,
              state: turningOff ? 'OFF' : 'ON',
            },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'shield',
          };
        }

        case 'counter_stance': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'counter',
              turnsRemaining: skill.duration ?? 2,
              charges: skill.charges ?? 1,
              magnitude: scaled.powerMultiplier || 1.0,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: 'COUNTER READY',
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'evade',
          };
        }

        case 'retreat_back_eva': {
          const formationCfg = adminConfig?.formation ?? DEFAULT_FORMATION_CONFIG;
          const sameSideAlive = nextUnits.filter(
            (u) => u.side === act.side && u.alive && u.id !== act.id
          );
          const backOccupied = sameSideAlive.filter((u) => u.row === 'back').length;
          const middleOccupied = sameSideAlive.filter((u) => u.row === 'middle').length;
          let targetRetreatRow: CombatRow = act.row;
          if (!hasStatus(act, 'siege_mode')) {
            if (act.row !== 'back' && backOccupied < formationCfg.rowCapacities.back) {
              targetRetreatRow = 'back';
            } else if (
              act.row === 'front' &&
              middleOccupied < formationCfg.rowCapacities.middle
            ) {
              targetRetreatRow = 'middle';
            }
          }
          nextUnits[actorIdx] = {
            ...act,
            row: targetRetreatRow,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'eva_up',
              turnsRemaining: skill.duration ?? 2,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: `BACK ROW +${Math.round(scaled.buffMagnitude * 100)}% EVA`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          if (targetRetreatRow !== act.row) {
            logs.push({
              id: nextId('log'),
              round,
              actorName: act.name,
              actorSide: act.side,
              tag: 'SKILL',
              templateKey: 'log.unitMovesRow',
              params: { actor: act.name, row: targetRetreatRow },
            });
          }
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'evade',
          };
        }

        case 'buff_speed': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'spd_up',
              turnsRemaining: skill.duration ?? 3,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: `SPD +${Math.round(scaled.buffMagnitude * 100)}%`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'evade',
          };
        }

        case 'evade_all_round': {
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'evade_all',
              turnsRemaining: skill.duration ?? 1,
              sourceSkillId: skill.id,
            }),
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: 'EVADE ALL',
            tone: 'evade',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'evade',
          };
        }

        case 'berserker_buff': {
          let nextSt = addOrRefreshStatus(act.statuses, {
            type: 'atk_up',
            turnsRemaining: skill.duration ?? 3,
            magnitude: scaled.buffMagnitude, // +60% ATK
            sourceSkillId: skill.id,
          });
          nextSt = addOrRefreshStatus(nextSt, {
            type: 'spd_up',
            turnsRemaining: skill.duration ?? 3,
            magnitude: scaled.secondaryMagnitude || 0.4, // +40% SPD
            sourceSkillId: skill.id,
          });
          nextSt = addOrRefreshStatus(nextSt, {
            type: 'def_down',
            turnsRemaining: skill.duration ?? 3,
            magnitude: skill.secondaryRatio ?? 0.3, // -30% DEF
            sourceSkillId: skill.id,
          });
          nextUnits[actorIdx] = { ...act, statuses: nextSt };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: 'REDLINE FURY!',
            tone: 'crit',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'heavy',
          };
        }

        // ---- CHARGE SHOT (2-turn striker skill) ----
        case 'charge_attack': {
          const opp = getTargetableOpponents(nextUnits, act.side, act.detectsStealth);
          const lockedTarget = opp.find((u) => u.id === targetId) ?? opp[0];
          nextUnits[actorIdx] = {
            ...act,
            statuses: addOrRefreshStatus(act.statuses, {
              type: 'charging',
              turnsRemaining: 2,
              sourceSkillId: skill.id,
              targetId: lockedTarget?.id,
            }),
            animState: 'casting',
          };
          popups.push({
            id: nextId('pop'),
            unitId: act.id,
            text: 'CHARGING...',
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.charging',
            params: { actor: act.name, skillId: skill.id },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: null,
            destroyedUnitIds,
            soundCue: 'defend',
          };
        }

        // ---- OFFENSIVE MULTI / SPLASH / AOE / SINGLE SKILLS ----
        case 'multi_attack': {
          const opp = getTargetableOpponents(nextUnits, act.side, act.detectsStealth);
          const targets = opp.slice(0, skill.maxTargets ?? 3);
          const dmgMult = getEffectiveAttackDamageMult(act, true);
          const rawPower = act.derived.attackPower * 2.15 * scaled.powerMultiplier * dmgMult;
          const targetSlotIndices: number[] = [];

          for (const enemy of targets) {
            const eIdx = nextUnits.findIndex((u) => u.id === enemy.id);
            if (!nextUnits[eIdx]?.alive) continue;
            targetSlotIndices.push(getSlotIndex(units, enemy.id));
            const res = applyDamageToUnit(
              nextUnits,
              nextUnits[actorIdx],
              nextUnits[eIdx],
              rawPower,
              {
                round,
                actionMeta: { skillId: skill.id, hitIndex: 1, totalHits: 1 },
                tag: 'SKILL',
                adminConfig,
                rng,
                events,
              }
            );
            nextUnits[actorIdx] = res.attackerAfter;
            nextUnits[eIdx] = res.targetAfter;
            logs.push(...res.logs);
            popups.push(...res.popups);
            if (res.destroyed) destroyedUnitIds.push(enemy.id);
            if (res.counteredAttackerKilled) destroyedUnitIds.push(act.id);
          }

          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'laser',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side === 'ally' ? 'enemy' : 'ally',
              toSlotIndices: targetSlotIndices,
              accentHex: cls.accentHex,
            },
            destroyedUnitIds,
            soundCue: destroyedUnitIds.length > 0 ? 'destroy' : 'heavy',
          };
        }

        case 'splash_attack': {
          const opp = getTargetableOpponents(nextUnits, act.side, act.detectsStealth);
          const chosen = opp.find((u) => u.id === targetId) ?? opp[0];
          const targetSlotIndices: number[] = [];
          if (chosen) {
            const cIdx = nextUnits.findIndex((u) => u.id === chosen.id);
            const cSlot = getSlotIndex(units, chosen.id);
            targetSlotIndices.push(cSlot);
            const dmgMult = getEffectiveAttackDamageMult(act, true);
            const mainRaw = act.derived.attackPower * 2.15 * scaled.powerMultiplier * dmgMult;
            const res = applyDamageToUnit(
              nextUnits,
              nextUnits[actorIdx],
              nextUnits[cIdx],
              mainRaw,
              {
                round,
                actionMeta: { skillId: skill.id, hitIndex: 1, totalHits: 1 },
                tag: 'SKILL',
                adminConfig,
                rng,
                events,
              }
            );
            nextUnits[actorIdx] = res.attackerAfter;
            nextUnits[cIdx] = res.targetAfter;
            logs.push(...res.logs);
            popups.push(...res.popups);
            if (res.destroyed) destroyedUnitIds.push(chosen.id);
            if (res.counteredAttackerKilled) destroyedUnitIds.push(act.id);

            // 50% splash to adjacent enemy units in the same formation row (col - 1, col + 1)
            const splashRaw = mainRaw * (skill.secondaryRatio ?? 0.5);
            const adjacentTargets = getAdjacentUnits(nextUnits, chosen);
            for (const adj of adjacentTargets) {
              if (!adj.alive) continue;
              const aIdx = nextUnits.findIndex((u) => u.id === adj.id);
              const adjSlot = getSlotIndex(units, adj.id);
              targetSlotIndices.push(adjSlot);
              const sRes = applyDamageToUnit(
                nextUnits,
                nextUnits[actorIdx],
                nextUnits[aIdx],
                splashRaw,
                {
                  round,
                  actionMeta: { skillId: skill.id, hitIndex: 1, totalHits: 1 },
                  tag: 'SKILL',
                  isSplash: true,
                  adminConfig,
                  rng,
                  events,
                }
              );
              nextUnits[actorIdx] = sRes.attackerAfter;
              nextUnits[aIdx] = sRes.targetAfter;
              logs.push(...sRes.logs);
              popups.push(...sRes.popups);
              if (sRes.destroyed) destroyedUnitIds.push(adj.id);
            }
          }

          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'missile',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side === 'ally' ? 'enemy' : 'ally',
              toSlotIndices: targetSlotIndices,
              accentHex: '#F59E0B',
            },
            destroyedUnitIds,
            soundCue: destroyedUnitIds.length > 0 ? 'destroy' : 'heavy',
          };
        }

        case 'aoe_elite_attack': {
          const allEnemies = nextUnits.filter(
            (u) => u.side !== act.side && u.alive
          );
          const dmgMult = getEffectiveAttackDamageMult(act, true);
          const rawPower =
            act.derived.attackPower * 2.15 * scaled.powerMultiplier * dmgMult;
          const targetSlotIndices: number[] = [];

          for (const enemy of allEnemies) {
            const eIdx = nextUnits.findIndex((u) => u.id === enemy.id);
            targetSlotIndices.push(getSlotIndex(units, enemy.id));
            const res = applyDamageToUnit(
              nextUnits,
              nextUnits[actorIdx],
              nextUnits[eIdx],
              rawPower,
              {
                round,
                actionMeta: { skillId: skill.id, hitIndex: 1, totalHits: 1 },
                tag: 'SKILL',
                adminConfig,
                rng,
                events,
              }
            );
            nextUnits[actorIdx] = res.attackerAfter;
            nextUnits[eIdx] = res.targetAfter;
            logs.push(...res.logs);
            popups.push(...res.popups);
            if (res.destroyed) destroyedUnitIds.push(enemy.id);
          }

          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'missile',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side === 'ally' ? 'enemy' : 'ally',
              toSlotIndices: targetSlotIndices,
              accentHex: '#F59E0B',
            },
            destroyedUnitIds,
            soundCue: destroyedUnitIds.length > 0 ? 'destroy' : 'heavy',
          };
        }

        case 'attack_slow':
        case 'attack_shield_break':
        case 'attack_pierce':
        case 'pierce_all_elite': {
          const opp = getTargetableOpponents(nextUnits, act.side, act.detectsStealth);
          const chosen = opp.find((u) => u.id === targetId) ?? opp[0];
          if (chosen) {
            const cIdx = nextUnits.findIndex((u) => u.id === chosen.id);
            const dmgMult = getEffectiveAttackDamageMult(act, true);
            const rawPower =
              act.derived.attackPower * 2.15 * scaled.powerMultiplier * dmgMult;

            const res = applyDamageToUnit(
              nextUnits,
              nextUnits[actorIdx],
              nextUnits[cIdx],
              rawPower,
              {
                defensePierce:
                  skill.effectKind === 'attack_pierce'
                    ? skill.secondaryRatio ?? 0.3
                    : 0,
                ignoreDef: skill.effectKind === 'pierce_all_elite',
                round,
                actionMeta: { skillId: skill.id, hitIndex: 1, totalHits: 1 },
                tag: 'SKILL',
                adminConfig,
                rng,
                events,
              }
            );
            nextUnits[actorIdx] = res.attackerAfter;
            let targetAfter = res.targetAfter;
            logs.push(...res.logs);
            popups.push(...res.popups);
            if (res.destroyed) {
              destroyedUnitIds.push(chosen.id);
            } else if (!res.evaded) {
              if (skill.effectKind === 'attack_slow') {
                const st = tryInflictStatus(
                  targetAfter,
                  {
                    type: 'slow',
                    turnsRemaining: skill.duration ?? 2,
                    sourceSkillId: skill.id,
                  },
                  1.0,
                  act.name,
                  round,
                  rng,
                  events,
                  act.id
                );
                targetAfter = st.targetAfter;
                logs.push(...st.logs);
                popups.push(...st.popups);
              } else if (skill.effectKind === 'attack_shield_break') {
                // shield sunder: applies Khiên nứt via shared helper after damage
                const crackRes = applyShieldCracked(
                  targetAfter,
                  sanitizeShieldCrackedTurns(adminConfig?.shieldCrackedTurns),
                  {
                    actorId: act.id,
                    actorName: act.name,
                    skillId: skill.id,
                    round,
                    magnitude: sanitizeShieldCrackedMult(
                      adminConfig?.shieldCrackedMult
                    ),
                    events,
                  }
                );
                targetAfter = crackRes.targetAfter;
                logs.push(...crackRes.logs);
                popups.push(...crackRes.popups);
              }
            }
            nextUnits[cIdx] = targetAfter;
            if (res.counteredAttackerKilled) destroyedUnitIds.push(act.id);

            return {
              updatedUnits: nextUnits,
              logEntries: logs,
              popups,
              fxEvent: {
                id: nextId('fx'),
                kind:
                  skill.effectKind === 'pierce_all_elite' ? 'railgun' : 'laser',
                fromSide: act.side,
                fromSlotIndex,
                toSide: chosen.side,
                toSlotIndices: [getSlotIndex(units, chosen.id)],
                accentHex: cls.accentHex,
              },
              destroyedUnitIds,
              soundCue: destroyedUnitIds.length > 0 ? 'destroy' : 'heavy',
            };
          }
          break;
        }

        case 'silence_target': {
          const opp = getTargetableOpponents(nextUnits, act.side, act.detectsStealth);
          const chosen = opp.find((u) => u.id === targetId) ?? opp[0];
          if (chosen) {
            const cIdx = nextUnits.findIndex((u) => u.id === chosen.id);
            const st = tryInflictStatus(
              nextUnits[cIdx],
              {
                type: 'silence',
                turnsRemaining: skill.duration ?? 2,
                sourceSkillId: skill.id,
              },
              1.0,
              act.name,
              round,
              rng,
              events,
              act.id
            );
            nextUnits[cIdx] = st.targetAfter;
            logs.push(...st.logs);
            popups.push(...st.popups);
            return {
              updatedUnits: nextUnits,
              logEntries: logs,
              popups,
              fxEvent: {
                id: nextId('fx'),
                kind: 'laser',
                fromSide: act.side,
                fromSlotIndex,
                toSide: chosen.side,
                toSlotIndices: [getSlotIndex(units, chosen.id)],
                accentHex: '#A855F7',
              },
              destroyedUnitIds,
              soundCue: 'shield',
            };
          }
          break;
        }

        // ---- SUPPORT SKILLS ----
        case 'scan_reveal': {
          const enemies = nextUnits.filter(
            (u) => u.side !== act.side && u.alive
          );
          let revealedCount = 0;
          const slotIndices: number[] = [];
          for (const enemy of enemies) {
            const eIdx = nextUnits.findIndex((u) => u.id === enemy.id);
            slotIndices.push(getSlotIndex(units, enemy.id));
            let stList = nextUnits[eIdx].statuses;
            if (hasStatus(nextUnits[eIdx], 'stealth')) {
              stList = removeStatus(stList, 'stealth');
              revealedCount += 1;
              popups.push({
                id: nextId('pop'),
                unitId: enemy.id,
                text: 'REVEALED!',
                tone: 'status',
              });
            }
            stList = addOrRefreshStatus(stList, {
              type: 'vulnerable',
              turnsRemaining: skill.duration ?? 2,
              magnitude: scaled.buffMagnitude,
              sourceSkillId: skill.id,
            });
            nextUnits[eIdx] = { ...nextUnits[eIdx], statuses: stList };
            popups.push({
              id: nextId('pop'),
              unitId: enemy.id,
              text: `VULN +${Math.round(scaled.buffMagnitude * 100)}%`,
              tone: 'status',
            });
          }
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'STATUS',
            templateKey: 'log.scanReveal',
            params: {
              actor: act.name,
              skillId: skill.id,
              revealed: revealedCount,
            },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'railgun',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side === 'ally' ? 'enemy' : 'ally',
              toSlotIndices: slotIndices,
              accentHex: '#10B981',
            },
            destroyedUnitIds,
            soundCue: 'shield',
          };
        }

        case 'heal_single': {
          const allies = nextUnits.filter((u) => u.side === act.side && u.alive);
          const chosenAlly =
            allies.find((a) => a.id === targetId) ??
            [...allies].sort(
              (a, b) => a.hp / a.derived.maxHp - b.hp / b.derived.maxHp
            )[0];
          if (chosenAlly) {
            const aIdx = nextUnits.findIndex((u) => u.id === chosenAlly.id);
            const healAmt = Math.min(
              chosenAlly.derived.maxHp - chosenAlly.hp,
              Math.round(chosenAlly.derived.maxHp * scaled.buffMagnitude)
            );
            nextUnits[aIdx] = {
              ...chosenAlly,
              hp: chosenAlly.hp + healAmt,
              animState: 'shielded',
            };
            if (healAmt > 0) {
              events.push({
                id: nextId('ev'),
                round,
                turn: 0,
                actorId: act.id,
                targetId: chosenAlly.id,
                type: 'heal',
                amount: healAmt,
                skillId: skill.id,
              });
            }
            popups.push({
              id: nextId('pop'),
              unitId: chosenAlly.id,
              text: `+${healAmt} HP`,
              tone: 'heal',
            });
            logs.push({
              id: nextId('log'),
              round,
              actorName: act.name,
              actorSide: act.side,
              tag: 'HEAL',
              templateKey: 'log.healSingle',
              params: {
                actor: act.name,
                target: chosenAlly.name,
                skillId: skill.id,
                amount: healAmt,
              },
            });
            return {
              updatedUnits: nextUnits,
              logEntries: logs,
              popups,
              fxEvent: {
                id: nextId('fx'),
                kind: 'heal',
                tone: 'heal',
                fromSide: act.side,
                fromSlotIndex,
                toSide: act.side,
                toSlotIndices: [getSlotIndex(units, chosenAlly.id)],
                accentHex: '#10B981',
              },
              destroyedUnitIds,
              soundCue: 'heal',
            };
          }
          break;
        }

        case 'energize_single': {
          const allies = nextUnits.filter((u) => u.side === act.side && u.alive);
          const chosenAlly =
            allies.find((a) => a.id === targetId) ??
            [...allies].sort((a, b) => a.sp - b.sp)[0];
          if (chosenAlly) {
            const aIdx = nextUnits.findIndex((u) => u.id === chosenAlly.id);
            const spGain = Math.min(
              chosenAlly.derived.maxSp - chosenAlly.sp,
              scaled.spAmount || 20
            );
            nextUnits[aIdx] = {
              ...chosenAlly,
              sp: chosenAlly.sp + spGain,
              animState: 'shielded',
            };
            popups.push({
              id: nextId('pop'),
              unitId: chosenAlly.id,
              text: `+${spGain} SP`,
              tone: 'buff',
            });
            logs.push({
              id: nextId('log'),
              round,
              actorName: act.name,
              actorSide: act.side,
              tag: 'HEAL',
              templateKey: 'log.energize',
              params: {
                actor: act.name,
                target: chosenAlly.name,
                skillId: skill.id,
                amount: spGain,
              },
            });
            return {
              updatedUnits: nextUnits,
              logEntries: logs,
              popups,
              fxEvent: {
                id: nextId('fx'),
                kind: 'heal',
                tone: 'sp',
                fromSide: act.side,
                fromSlotIndex,
                toSide: act.side,
                toSlotIndices: [getSlotIndex(units, chosenAlly.id)],
                accentHex: '#38BDF8',
              },
              destroyedUnitIds,
              soundCue: 'heal',
            };
          }
          break;
        }

        case 'sp_transfer': {
          const transfer = resolveSpTransfer(
            nextUnits,
            act.id,
            skillLv,
            adminConfig?.fluxTransfer,
            transferCount,
            round,
            nextId,
            skill.id
          );
          popups.push(...transfer.popups);
          logs.push(transfer.logEntry);
          const toSlotIndices = transfer.recipientIds.map((id) =>
            getSlotIndex(units, id)
          );
          return {
            updatedUnits: transfer.updatedUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'heal',
              tone: 'sp',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side,
              toSlotIndices,
              accentHex: '#38BDF8',
            },
            destroyedUnitIds,
            soundCue: 'heal',
          };
        }

        case 'heal_field_hot': {
          const slotIndices: number[] = [];
          for (let i = 0; i < nextUnits.length; i++) {
            const ally = nextUnits[i];
            if (ally.side !== act.side || !ally.alive) continue;
            slotIndices.push(getSlotIndex(units, ally.id));
            nextUnits[i] = {
              ...ally,
              statuses: addOrRefreshStatus(ally.statuses, {
                type: 'regen_hp',
                turnsRemaining: skill.duration ?? 3,
                magnitude: scaled.buffMagnitude,
                sourceSkillId: skill.id,
              }),
              animState: ally.id === act.id ? 'casting' : 'shielded',
            };
            popups.push({
              id: nextId('pop'),
              unitId: ally.id,
              text: `REGEN ${Math.round(scaled.buffMagnitude * 100)}%`,
              tone: 'heal',
            });
          }
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'HEAL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'heal',
              tone: 'heal',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side,
              toSlotIndices: slotIndices,
              accentHex: '#10B981',
            },
            destroyedUnitIds,
            soundCue: 'heal',
          };
        }

        case 'energize_shield_field': {
          let totalRestored = 0;
          const slotIndices: number[] = [];
          for (let i = 0; i < nextUnits.length; i++) {
            const ally = nextUnits[i];
            if (ally.side !== act.side || !ally.alive) continue;
            slotIndices.push(getSlotIndex(units, ally.id));
            const spGain = Math.min(
              ally.derived.maxSp - ally.sp,
              scaled.spAmount || 10
            );
            const shieldBlocked =
              (ally.id === act.id && shieldBreakAtTurnStart) ||
              hasStatus(ally, 'shield_break');
            const shdGain = shieldBlocked
              ? 0
              : Math.min(
                  ally.derived.maxShield - ally.shield,
                  Math.round(ally.derived.maxShield * (scaled.buffMagnitude || 0.25))
                );
            totalRestored += spGain + shdGain;
            nextUnits[i] = {
              ...ally,
              sp: ally.sp + spGain,
              shield: ally.shield + shdGain,
              animState: ally.id === act.id ? 'casting' : 'shielded',
            };
            if (shdGain > 0) {
              events.push({
                id: nextId('ev'),
                round,
                turn: 0,
                actorId: act.id,
                targetId: ally.id,
                type: 'shield_grant',
                amount: shdGain,
                skillId: skill.id,
              });
            }
            popups.push({
              id: nextId('pop'),
              unitId: ally.id,
              text: `+${spGain} SP +${shdGain} SHD`,
              tone: 'heal',
            });
          }
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'HEAL',
            templateKey: 'log.healSquad',
            params: {
              actor: act.name,
              skillId: skill.id,
              spCost: usability.spCost,
              total: totalRestored,
            },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'heal',
              tone: 'shield',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side,
              toSlotIndices: slotIndices,
              accentHex: '#38BDF8',
            },
            destroyedUnitIds,
            soundCue: 'heal',
          };
        }

        case 'team_atk_up':
        case 'team_def_up':
        case 'team_eva_up': {
          const stType: StatusEffectType =
            skill.effectKind === 'team_atk_up'
              ? 'atk_up'
              : skill.effectKind === 'team_def_up'
              ? 'def_up'
              : 'eva_up';
          const shortTag =
            stType === 'atk_up' ? 'ATK' : stType === 'def_up' ? 'DEF' : 'EVA';
          const slotIndices: number[] = [];
          for (let i = 0; i < nextUnits.length; i++) {
            const ally = nextUnits[i];
            if (ally.side !== act.side || !ally.alive) continue;
            slotIndices.push(getSlotIndex(units, ally.id));
            nextUnits[i] = {
              ...ally,
              statuses: addOrRefreshStatus(ally.statuses, {
                type: stType,
                turnsRemaining: skill.duration ?? 3,
                magnitude: scaled.buffMagnitude,
                sourceSkillId: skill.id,
              }),
              animState: ally.id === act.id ? 'casting' : 'shielded',
            };
            popups.push({
              id: nextId('pop'),
              unitId: ally.id,
              text: `${shortTag} +${Math.round(scaled.buffMagnitude * 100)}%`,
              tone: 'buff',
            });
          }
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'SKILL',
            templateKey: 'log.buffApplied',
            params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'heal',
              tone: 'buff',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side,
              toSlotIndices: slotIndices,
              accentHex: '#F59E0B',
            },
            destroyedUnitIds,
            soundCue: 'defend',
          };
        }

        case 'invincible_ally': {
          const allies = nextUnits.filter((u) => u.side === act.side && u.alive);
          const chosenAlly =
            allies.find((a) => a.id === targetId) ??
            [...allies].sort(
              (a, b) => a.hp / a.derived.maxHp - b.hp / b.derived.maxHp
            )[0];
          if (chosenAlly) {
            const aIdx = nextUnits.findIndex((u) => u.id === chosenAlly.id);
            nextUnits[aIdx] = {
              ...chosenAlly,
              statuses: addOrRefreshStatus(chosenAlly.statuses, {
                type: 'invincible',
                turnsRemaining: skill.duration ?? 1,
                sourceSkillId: skill.id,
              }),
              animState: 'shielded',
            };
            popups.push({
              id: nextId('pop'),
              unitId: chosenAlly.id,
              text: 'INVINCIBLE',
              tone: 'shield',
            });
            logs.push({
              id: nextId('log'),
              round,
              actorName: act.name,
              actorSide: act.side,
              tag: 'SKILL',
              templateKey: 'log.buffApplied',
              params: { actor: act.name, skillId: skill.id, spCost: usability.spCost },
            });
            return {
              updatedUnits: nextUnits,
              logEntries: logs,
              popups,
              fxEvent: {
                id: nextId('fx'),
                kind: 'heal',
                tone: 'buff',
                fromSide: act.side,
                fromSlotIndex,
                toSide: act.side,
                toSlotIndices: [getSlotIndex(units, chosenAlly.id)],
                accentHex: '#FBBF24',
              },
              destroyedUnitIds,
              soundCue: 'shield',
            };
          }
          break;
        }

        case 'purify_team': {
          const slotIndices: number[] = [];
          for (let i = 0; i < nextUnits.length; i++) {
            const ally = nextUnits[i];
            if (ally.side !== act.side || !ally.alive) continue;
            slotIndices.push(getSlotIndex(units, ally.id));
            const hadDebuff = ally.statuses.some((s) => DEBUFF_TYPES.has(s.type));
            nextUnits[i] = {
              ...ally,
              statuses: ally.statuses.filter((s) => !DEBUFF_TYPES.has(s.type)),
              animState: ally.id === act.id ? 'casting' : 'shielded',
            };
            if (hadDebuff) {
              events.push({
                id: nextId('ev'),
                round,
                turn: 0,
                actorId: act.id,
                targetId: ally.id,
                type: 'cleanse',
                skillId: skill.id,
              });
            }
            popups.push({
              id: nextId('pop'),
              unitId: ally.id,
              text: 'PURIFIED',
              tone: 'heal',
            });
          }
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'STATUS',
            templateKey: 'log.statusCleansed',
            params: { actor: act.name },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'heal',
              tone: 'buff',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side,
              toSlotIndices: slotIndices,
              accentHex: '#10B981',
            },
            destroyedUnitIds,
            soundCue: 'heal',
          };
        }

        case 'full_recovery_elite': {
          let totalRestored = 0;
          const slotIndices: number[] = [];
          for (let i = 0; i < nextUnits.length; i++) {
            const ally = nextUnits[i];
            if (ally.side !== act.side || !ally.alive) continue;
            slotIndices.push(getSlotIndex(units, ally.id));
            const shieldBlocked =
              (ally.id === act.id && shieldBreakAtTurnStart) ||
              hasStatus(ally, 'shield_break');
            const hpGain = ally.derived.maxHp - ally.hp;
            const shdGain = shieldBlocked ? 0 : ally.derived.maxShield - ally.shield;
            const hadDebuff = ally.statuses.some((s) => DEBUFF_TYPES.has(s.type));
            totalRestored += hpGain + shdGain;
            nextUnits[i] = {
              ...ally,
              hp: ally.derived.maxHp,
              shield: ally.shield + shdGain,
              statuses: ally.statuses.filter((s) => !DEBUFF_TYPES.has(s.type)),
              animState: ally.id === act.id ? 'casting' : 'shielded',
            };
            if (hpGain > 0) {
              events.push({
                id: nextId('ev'),
                round,
                turn: 0,
                actorId: act.id,
                targetId: ally.id,
                type: 'heal',
                amount: hpGain,
                skillId: skill.id,
              });
            }
            if (shdGain > 0) {
              events.push({
                id: nextId('ev'),
                round,
                turn: 0,
                actorId: act.id,
                targetId: ally.id,
                type: 'shield_grant',
                amount: shdGain,
                skillId: skill.id,
              });
            }
            if (hadDebuff) {
              events.push({
                id: nextId('ev'),
                round,
                turn: 0,
                actorId: act.id,
                targetId: ally.id,
                type: 'cleanse',
                skillId: skill.id,
              });
            }
            popups.push({
              id: nextId('pop'),
              unitId: ally.id,
              text: 'FULL RECOVERY',
              tone: 'heal',
            });
          }
          logs.push({
            id: nextId('log'),
            round,
            actorName: act.name,
            actorSide: act.side,
            tag: 'HEAL',
            templateKey: 'log.healSquad',
            params: {
              actor: act.name,
              skillId: skill.id,
              spCost: usability.spCost,
              total: totalRestored,
            },
          });
          return {
            updatedUnits: nextUnits,
            logEntries: logs,
            popups,
            fxEvent: {
              id: nextId('fx'),
              kind: 'heal',
              tone: 'heal',
              fromSide: act.side,
              fromSlotIndex,
              toSide: act.side,
              toSlotIndices: slotIndices,
              accentHex: '#10B981',
            },
            destroyedUnitIds,
            soundCue: 'heal',
          };
        }
      }
    } else if (usability?.reason === 'silenced') {
      logs.push({
        id: nextId('log'),
        round,
        actorName: actor.name,
        actorSide: actor.side,
        tag: 'STATUS',
        templateKey: 'log.silencedBlocked',
        params: { actor: actor.name },
      });
    }
  }

  // ---- 3. BASIC ATTACK ACTION ----
  const spGain = Math.min(
    actor.derived.maxSp - actor.sp,
    COMBAT_FORMULAS.attackSpGain
  );
  nextUnits[actorIdx] = {
    ...actor,
    sp: actor.sp + spGain,
    animState: 'attacking',
  };

  const opponents = getValidEnemyTargets(nextUnits, nextUnits[actorIdx], 'attack');
  const chosenTarget = opponents.find((u) => u.id === targetId) ?? opponents[0];

  if (!chosenTarget) {
    return {
      updatedUnits: nextUnits,
      logEntries: logs,
      popups,
      fxEvent: null,
      destroyedUnitIds,
      soundCue: 'laser',
    };
  }

  const targetIdx = nextUnits.findIndex((u) => u.id === chosenTarget.id);
  const targetSlotIdx = getSlotIndex(units, chosenTarget.id);
  const dmgMult = getEffectiveAttackDamageMult(nextUnits[actorIdx], false);
  const rawAttackPower = actor.derived.attackPower * 2.15 * dmgMult;

  events.push({
    id: nextId('ev'),
    round,
    turn: 0,
    actorId: actor.id,
    targetId: chosenTarget.id,
    type: 'attack',
  });

  const res = applyDamageToUnit(
    nextUnits,
    nextUnits[actorIdx],
    chosenTarget,
    rawAttackPower,
    {
      round,
      actionMeta: { skillId: '', hitIndex: 1, totalHits: 1 },
      tag: 'ATTACK',
      adminConfig,
      rng,
      events,
    }
  );
  nextUnits[actorIdx] = res.attackerAfter;
  nextUnits[targetIdx] = res.targetAfter;
  logs.push(...res.logs);
  popups.push(...res.popups);
  if (res.destroyed) destroyedUnitIds.push(chosenTarget.id);
  if (res.counteredAttackerKilled) destroyedUnitIds.push(actor.id);

  // Enemy Archetype basic attack status chance
  if (!res.evaded && nextUnits[targetIdx].alive && actor.archetype) {
    const archDef = ENEMY_ARCHETYPE_DEFS[actor.archetype];
    if (archDef.inflictsStatus && archDef.statusChance) {
      if (archDef.inflictsStatus === 'shield_cracked') {
        if (rng() <= archDef.statusChance * 0.55) {
          const crackRes = applyShieldCracked(
            nextUnits[targetIdx],
            sanitizeShieldCrackedTurns(adminConfig?.shieldCrackedTurns),
            {
              actorId: actor.id,
              actorName: actor.name,
              round,
              magnitude: sanitizeShieldCrackedMult(
                adminConfig?.shieldCrackedMult
              ),
              events,
            }
          );
          nextUnits[targetIdx] = crackRes.targetAfter;
          logs.push(...crackRes.logs);
          popups.push(...crackRes.popups);
        }
      } else {
        const st = tryInflictStatus(
          nextUnits[targetIdx],
          {
            type: archDef.inflictsStatus,
            turnsRemaining: 2,
            sourceName: actor.name,
          },
          archDef.statusChance * 0.55,
          actor.name,
          round,
          rng,
          events,
          actor.id
        );
        nextUnits[targetIdx] = st.targetAfter;
        logs.push(...st.logs);
        popups.push(...st.popups);
      }
    }
  }

  // Splash damage trait (from equipped weapon/reactor) hits adjacent formation units
  const fxTargetSlots = [targetSlotIdx];
  if (!res.evaded && actor.derived.splashPct > 0 && res.damageDealt > 0) {
    const splashDmg = Math.max(
      4,
      Math.round((res.damageDealt * actor.derived.splashPct) / 100)
    );
    const adjacentTargets = getAdjacentUnits(nextUnits, chosenTarget);
    for (const otherOpponent of adjacentTargets) {
      if (!otherOpponent.alive) continue;
      const oIdx = nextUnits.findIndex((u) => u.id === otherOpponent.id);
      fxTargetSlots.push(getSlotIndex(units, otherOpponent.id));
      const actualSplash =
        (adminConfig?.godMode && otherOpponent.isPlayer) ||
        hasStatus(otherOpponent, 'invincible')
          ? 0
          : splashDmg;
      const splashDmgRes = applyShieldThenHull(otherOpponent, actualSplash);
      const nextShd = splashDmgRes.nextShield;
      const nextHp = splashDmgRes.nextHp;
      const splashAbsorbed = splashDmgRes.shieldLost;
      const splashHpDmg = splashDmgRes.hullDamage;
      const splashKo = nextHp <= 0;

      let nextSplashStatuses = splashKo ? [] : otherOpponent.statuses;
      let nextSplashHits = otherOpponent.hitsSinceOwnTurn;
      if (!splashKo && splashDmgRes.brokeNow) {
        nextSplashStatuses = removeStatus(nextSplashStatuses, 'shield_cracked');
      }
      if (shieldRegenCfg.enabled) {
        if (actor.side !== otherOpponent.side && (splashAbsorbed > 0 || splashHpDmg > 0)) {
          nextSplashHits = getUnitHitsSinceOwnTurn(otherOpponent) + 1;
        }
        if (!splashKo && splashDmgRes.brokeNow) {
          nextSplashStatuses = addOrRefreshStatus(nextSplashStatuses, {
            type: 'shield_break',
            turnsRemaining: shieldRegenCfg.restartTurns,
            isDebuff: true,
            sourceName: actor.name,
          });
          events.push({
            id: nextId('ev'),
            round,
            turn: 0,
            actorId: actor.id,
            targetId: otherOpponent.id,
            type: 'status_applied',
            statusId: 'shield_break',
            flags: { isDebuff: true },
          });
        }
      }

      nextUnits[oIdx] = {
        ...otherOpponent,
        shield: nextShd,
        hp: nextHp,
        alive: !splashKo,
        statuses: nextSplashStatuses,
        ...(nextSplashHits !== undefined
          ? { hitsSinceOwnTurn: nextSplashHits }
          : {}),
        animState: splashKo ? 'destroyed' : 'hit',
      };
      if (actualSplash > 0) {
        events.push({
          id: nextId('ev'),
          round,
          turn: 0,
          actorId: actor.id,
          targetId: otherOpponent.id,
          type: 'damage',
          amount: actualSplash,
          shieldAbsorbed: splashAbsorbed,
          hpDamage: splashHpDmg,
          flags: {
            splash: true,
            shieldAbsorbed: splashAbsorbed > 0,
            kill: splashKo,
          },
        });
        popups.push({
          id: nextId('pop'),
          unitId: otherOpponent.id,
          text: `SPLASH -${actualSplash}`,
          tone: 'damage',
        });
        logs.push({
          id: nextId('log'),
          round,
          actorName: actor.name,
          actorSide: actor.side,
          tag: 'ATTACK',
          templateKey: 'log.splashDamage',
          params: {
            actor: actor.name,
            target: otherOpponent.name,
            damage: actualSplash,
          },
        });
      }
      if (splashKo) {
        destroyedUnitIds.push(otherOpponent.id);
        events.push({
          id: nextId('ev'),
          round,
          turn: 0,
          actorId: actor.id,
          targetId: otherOpponent.id,
          type: 'kill',
          flags: { splash: true, kill: true },
        });
        logs.push({
          id: nextId('log'),
          round,
          actorName: otherOpponent.name,
          actorSide: otherOpponent.side,
          tag: 'KO',
          templateKey: 'log.destroyed',
          params: { target: otherOpponent.name, classId: otherOpponent.classId },
        });
      }
    }
  }

  return {
    updatedUnits: nextUnits,
    logEntries: logs,
    popups,
    fxEvent: {
      id: nextId('fx'),
      kind:
        actor.classId === 'striker' || actor.derived.splashPct > 0
          ? 'missile'
          : 'laser',
      fromSide: actor.side,
      fromSlotIndex,
      toSide: chosenTarget.side,
      toSlotIndices: fxTargetSlots,
      accentHex: actor.side === 'ally' ? '#38BDF8' : '#F97316',
    },
    destroyedUnitIds,
    soundCue:
      destroyedUnitIds.length > 0
        ? 'destroy'
        : res.evaded
        ? 'evade'
        : res.hitShieldOnly
        ? 'shield'
        : 'laser',
  };
}

const SUPPORT_RESERVE_EFFECT_KINDS = new Set<SkillDefinition['effectKind']>([
  'heal_single',
  'heal_field_hot',
  'energize_shield_field',
  'full_recovery_elite',
]);

export type FluxTransferRulesInput =
  | (FluxTransferLevelRule & {
      spEconomy?: SpEconomyConfig | null;
      minPerLevel?: number;
      allySpBelowPct?: number;
      keepSelfPct?: number;
    })
  | (FluxTransferConfig & { spEconomy?: SpEconomyConfig | null });

export function computeFluxBattlePressure(
  units: CombatUnit[],
  side: CombatSide
): number {
  let ownCur = 0;
  let ownMax = 0;
  let foeCur = 0;
  let foeMax = 0;
  for (const u of units) {
    const cur = u.alive ? Math.max(0, u.hp) + Math.max(0, u.shield) : 0;
    const max = Math.max(0, u.derived.maxHp) + Math.max(0, u.derived.maxShield);
    if (u.side === side) {
      ownCur += cur;
      ownMax += max;
    } else {
      foeCur += cur;
      foeMax += max;
    }
  }
  const ownRatio = ownMax > 0 ? ownCur / ownMax : 0;
  const foeRatio = foeMax > 0 ? foeCur / foeMax : 0;
  return ownRatio - foeRatio;
}

export function pickFluxCount(
  units: CombatUnit[],
  actorId: string,
  rules: FluxTransferRulesInput,
  pressure?: number,
  rng: () => number = Math.random
): number {
  const actor = units.find((u) => u.id === actorId);
  if (!actor || !actor.alive || actor.derived.maxSp <= 0 || actor.sp <= 0) {
    return 0;
  }

  const fluxLv = actor.skillLevels['sup_flux_transfer'] ?? actor.skillLevel ?? 1;
  const sanitizedCfg = sanitizeFluxTransferConfig(
    'levels' in rules
      ? rules
      : {
          ...DEFAULT_FLUX_TRANSFER_CONFIG,
          levels: DEFAULT_FLUX_TRANSFER_CONFIG.levels.map(() => ({
            targets: rules.targets,
            pct: rules.pct,
            fee: rules.fee,
          })),
          minPerLevel: rules.minPerLevel,
          allySpBelowPct: rules.allySpBelowPct,
          keepSelfPct: rules.keepSelfPct,
        }
  );
  const rule: FluxTransferLevelRule =
    'levels' in rules
      ? getFluxTransferRule(fluxLv, sanitizedCfg, BALANCE_CONFIG.skillMaxLevel)
      : rules;
  const spEconomy =
    'spEconomy' in rules && rules.spEconomy ? { spEconomy: rules.spEconomy } : undefined;

  const maxTargets = Math.max(0, Math.floor(rule.targets));
  if (maxTargets <= 0) return 0;

  const diff =
    typeof pressure === 'number' && Number.isFinite(pressure)
      ? pressure
      : computeFluxBattlePressure(units, actor.side);

  if (diff >= 0.2 && rng() >= 0.5) {
    return 0;
  }
  const baseKeepRatio = sanitizedCfg.keepSelfPct / 100;
  const keepSelfRatio = diff <= -0.2 ? Math.min(baseKeepRatio, 0.15) : baseKeepRatio;
  const allyBelowRatio = sanitizedCfg.allySpBelowPct / 100;

  // Never cast if support has a ready heal/shield/revive skill it can afford; keep reserve SP logic
  let reserveSp = 0;
  for (const sid of actor.equippedSkillIds) {
    const sk = getSkillById(sid);
    if (!sk || !SUPPORT_RESERVE_EFFECT_KINDS.has(sk.effectKind)) continue;
    if (!isSkillAllowedForClass(sk, actor.classId)) continue;
    if ((actor.skillCooldowns[sid] ?? 0) > 0) continue;
    if (sk.oncePerBattle && actor.usedOnceSkills.includes(sid)) continue;
    reserveSp += getEffectiveSpCost(sk, actor, spEconomy);
    if (canUnitUseSkill(actor, sid, spEconomy).canUse) {
      return 0;
    }
  }

  // Emergency rule: cast only if at least 1 ally (self excluded) is below threshold (default 25% SP)
  const underThresholdAllies = units.filter(
    (u) =>
      u.side === actor.side &&
      u.alive &&
      u.id !== actor.id &&
      u.derived.maxSp > 0 &&
      u.sp < u.derived.maxSp * allyBelowRatio
  );
  if (underThresholdAllies.length === 0) return 0;

  const maxAffordable = getMaxAffordableFluxCount(
    units,
    actorId,
    fluxLv,
    sanitizedCfg
  );
  if (maxAffordable <= 0) return 0;

  const amountEach = getFluxPlannedAmountEach(
    actor.sp,
    fluxLv,
    sanitizedCfg,
    BALANCE_CONFIG.skillMaxLevel
  );
  if (amountEach <= 0) return 0;

  const hasReadySkillAboveSp = (ally: CombatUnit): boolean =>
    ally.equippedSkillIds.some((sid) => {
      const sk = getSkillById(sid);
      if (!sk || sk.category === 'passive') return false;
      if (!isSkillAllowedForClass(sk, ally.classId)) return false;
      if ((ally.skillCooldowns[sid] ?? 0) > 0) return false;
      if (sk.oncePerBattle && ally.usedOnceSkills.includes(sid)) return false;
      return getEffectiveSpCost(sk, ally, spEconomy) > ally.sp;
    });

  const orderedUnderThreshold = [...underThresholdAllies].sort((a, b) => {
    const aNeed = hasReadySkillAboveSp(a) ? 0 : 1;
    const bNeed = hasReadySkillAboveSp(b) ? 0 : 1;
    if (aNeed !== bNeed) return aNeed - bNeed;
    return a.sp / a.derived.maxSp - b.sp / b.derived.maxSp;
  });

  const desiredK = Math.min(
    maxTargets,
    orderedUnderThreshold.length,
    maxAffordable
  );

  // Match resolveSpTransfer recipient pool (lowest SP% non-full allies) for exact SP cost check
  const transferPool = units
    .filter(
      (u) =>
        u.side === actor.side &&
        u.alive &&
        u.id !== actor.id &&
        u.derived.maxSp > 0 &&
        u.sp < u.derived.maxSp
    )
    .sort((a, b) => a.sp / a.derived.maxSp - b.sp / b.derived.maxSp);

  const minRemainingSp = Math.max(reserveSp, keepSelfRatio * actor.derived.maxSp);

  for (let k = desiredK; k >= 1; k--) {
    let totalMoved = 0;
    const slice = transferPool.slice(0, k);
    for (const ally of slice) {
      totalMoved += Math.min(amountEach, Math.max(0, ally.derived.maxSp - ally.sp));
    }
    if (totalMoved <= 0) continue;
    const cost = Math.ceil(totalMoved * (1 + rule.fee / 100));
    if (actor.sp - cost >= minRemainingSp) {
      return k;
    }
  }

  return 0;
}

export function chooseAiDecision(
  actor: CombatUnit,
  units: CombatUnit[],
  rng: () => number = Math.random,
  adminConfig?: Partial<AdminConfig>,
  turnLockedSkillIds?: readonly string[]
): { action: ActionType; targetId: string | null; skillId?: string; transferCount?: number } {
  const allies = units.filter((u) => u.side === actor.side && u.alive);
  const enemies = getValidEnemyTargets(units, actor, 'attack');

  if (enemies.length === 0) {
    return { action: 'defend', targetId: null };
  }

  // Sniper archetype ALWAYS targets lowest HP opponent!
  let target: CombatUnit;
  if (actor.archetype === 'sniper') {
    target = [...enemies].sort((a, b) => a.hp - b.hp)[0];
  } else {
    const sortedEnemies = [...enemies].sort(
      (a, b) => a.hp + a.shield - (b.hp + b.shield)
    );
    target = rng() < 0.6 ? sortedEnemies[0] : randomItem(enemies, rng);
  }

  // Evaluate usable skills strictly on actor's equipped skill bar
  const usableSkills = actor.equippedSkillIds
    .map((id) => getSkillById(id))
    .filter(
      (s): s is SkillDefinition =>
        Boolean(s) &&
        canUnitUseSkill(actor, s!.id, adminConfig, turnLockedSkillIds).canUse
    );

  // Repair Ship / Support heals injured allies first
  const healSkill = usableSkills.find(
    (s) =>
      s.effectKind === 'heal_single' ||
      s.effectKind === 'heal_field_hot' ||
      s.effectKind === 'full_recovery_elite'
  );
  if (healSkill) {
    const injured = [...allies]
      .filter((a) => a.hp < a.derived.maxHp * 0.8)
      .sort((a, b) => a.hp / a.derived.maxHp - b.hp / b.derived.maxHp);
    if (injured.length > 0) {
      return {
        action: 'skill',
        targetId: injured[0].id,
        skillId: healSkill.id,
      };
    }
  }

  // Scan if any opposing ship is stealthed
  const scanSkill = usableSkills.find((s) => s.effectKind === 'scan_reveal');
  if (
    scanSkill &&
    units.some((u) => u.side !== actor.side && u.alive && isUnitStealthed(u))
  ) {
    return { action: 'skill', targetId: null, skillId: scanSkill.id };
  }

  // Support Flux Transfer (sp_transfer): dedicated emergency threshold & keep-self rule
  const fluxSkill = usableSkills.find((s) => s.effectKind === 'sp_transfer');
  if (fluxSkill) {
    const fluxCfg = sanitizeFluxTransferConfig(adminConfig?.fluxTransfer);
    const pressure = computeFluxBattlePressure(units, actor.side);
    const fluxCount = pickFluxCount(
      units,
      actor.id,
      { ...fluxCfg, spEconomy: adminConfig?.spEconomy },
      pressure,
      rng
    );
    if (fluxCount > 0) {
      return {
        action: 'skill',
        targetId: null,
        skillId: fluxSkill.id,
        transferCount: fluxCount,
      };
    }
  }

  // Offensive or tactical skill roll (sp_transfer excluded; handled above)
  const tacticalSkills = usableSkills.filter(
    (s) =>
      !s.isToggle &&
      s.effectKind !== 'heal_single' &&
      s.effectKind !== 'heal_field_hot' &&
      s.effectKind !== 'sp_transfer'
  );
  if (tacticalSkills.length > 0 && rng() < 0.55) {
    const pick = randomItem(tacticalSkills, rng);
    const skillEnemies = getValidEnemyTargets(units, actor, 'skill', pick.id);
    const skillEnemyTarget =
      actor.archetype === 'sniper'
        ? [...skillEnemies].sort((a, b) => a.hp - b.hp)[0]
        : skillEnemies.find((e) => e.id === target.id) ?? skillEnemies[0] ?? target;
    const resolvedTargetId =
      pick.targetType === 'single_ally'
        ? [...allies].sort((a, b) => a.hp - b.hp)[0]?.id ?? actor.id
        : skillEnemyTarget.id;
    return {
      action: 'skill',
      targetId:
        pick.targetType === 'self' || pick.targetType === 'all_allies'
          ? null
          : resolvedTargetId,
      skillId: pick.id,
    };
  }

  if (
    actor.archetype === 'gunship' &&
    actor.hp < actor.derived.maxHp * 0.35 &&
    rng() < 0.4
  ) {
    return { action: 'defend', targetId: null };
  }

  return { action: 'attack', targetId: target.id };
}

export interface TurnDecision {
  action: ActionType;
  targetId: string | null;
  skillId?: string;
  transferCount?: number;
  matchedRuleIndex?: number | null;
}

export interface MultiStepTurnResolution extends ActionResolution {
  decisionsCount: number;
  step2SkillIds: string[];
  fxEvents: CombatFxEvent[];
  lastDecision: TurnDecision | null;
  lastMatchedRuleIndex: number | null;
}

export function resolveMultiStepTurn(params: {
  units: CombatUnit[];
  actorId: string;
  round: number;
  adminConfig?: Partial<AdminConfig>;
  rng?: () => number;
  initialTurnStep2Used?: number;
  initialTurnLockedSkillIds?: readonly string[];
  chooseNextDecision: (
    currentUnits: CombatUnit[],
    currentActor: CombatUnit,
    turnLockedSkillIds: string[],
    stepIndex: number
  ) => TurnDecision | null | undefined;
}): MultiStepTurnResolution {
  const {
    units,
    actorId,
    round,
    adminConfig,
    rng = Math.random,
    initialTurnStep2Used = 0,
    initialTurnLockedSkillIds = [],
    chooseNextDecision,
  } = params;

  const turnPhaseCfg = sanitizeTurnPhaseConfig(adminConfig?.turnPhase);
  const baseStep2Used = Math.max(0, Math.floor(initialTurnStep2Used || 0));
  const maxSteps = Math.max(1, turnPhaseCfg.maxStep2PerTurn - baseStep2Used + 1);

  let currentUnits = units;
  let step2Used = baseStep2Used;
  let lockedSkillIds: string[] = [...initialTurnLockedSkillIds];
  const step2SkillIds: string[] = [];
  const logEntries: CombatLogEntry[] = [];
  const events: BattleEvent[] = [];
  const popups: FloatingPopup[] = [];
  const fxEvents: CombatFxEvent[] = [];
  const destroyedUnitIds: string[] = [];
  let lastFxEvent: CombatFxEvent | null = null;
  let lastSoundCue: ActionResolution['soundCue'] = 'defend';
  let lastDecision: TurnDecision | null = null;
  let lastMatchedRuleIndex: number | null = null;
  let decisionsCount = 0;

  for (let stepIdx = 0; stepIdx < maxSteps; stepIdx++) {
    const currentActor = currentUnits.find((u) => u.id === actorId);
    const hasAliveEnemies = currentUnits.some(
      (u) => currentActor && u.side !== currentActor.side && u.alive
    );
    const hasAliveAllies = currentUnits.some(
      (u) => currentActor && u.side === currentActor.side && u.alive
    );
    if (!currentActor || !currentActor.alive || !hasAliveEnemies || !hasAliveAllies) {
      break;
    }

    const picked = chooseNextDecision(
      currentUnits,
      currentActor,
      lockedSkillIds,
      stepIdx
    );
    const decision: TurnDecision = picked ?? {
      action: 'defend',
      targetId: null,
    };
    decisionsCount += 1;
    lastDecision = decision;
    lastMatchedRuleIndex = decision.matchedRuleIndex ?? null;

    const skillDef =
      decision.action === 'skill' && decision.skillId
        ? getSkillById(decision.skillId)
        : undefined;

    const res = resolveUnitAction(
      currentUnits,
      actorId,
      decision.action,
      decision.targetId,
      round,
      adminConfig,
      rng,
      decision.skillId,
      decision.transferCount,
      {
        skipTurnStartTicks: stepIdx > 0 || baseStep2Used > 0,
        turnLockedSkillIds: lockedSkillIds,
      }
    );

    currentUnits = res.updatedUnits;
    logEntries.push(...res.logEntries);
    events.push(...res.events);
    popups.push(...res.popups);
    destroyedUnitIds.push(...res.destroyedUnitIds);
    if (res.fxEvent) {
      fxEvents.push(res.fxEvent);
      lastFxEvent = res.fxEvent;
    }
    lastSoundCue = res.soundCue;

    const actorAfter = currentUnits.find((u) => u.id === actorId);
    const aliveEnemiesCount = currentUnits.filter(
      (u) => u.side === 'enemy' && u.alive
    ).length;
    const aliveAlliesCount = currentUnits.filter(
      (u) => u.side === 'ally' && u.alive
    ).length;
    const didCastSkill =
      decision.action === 'skill' &&
      Boolean(decision.skillId) &&
      res.events.some(
        (ev) =>
          ev.type === 'skill_cast' &&
          ev.actorId === actorId &&
          ev.skillId === decision.skillId
      );

    const phaseOutcome = evaluateTurnPhaseAfterAction({
      skill: skillDef,
      didCastSkill,
      actorAlive: Boolean(actorAfter?.alive),
      aliveEnemiesCount,
      aliveAlliesCount,
      turnStep2Used: step2Used,
      turnLockedSkillIds: lockedSkillIds,
      cfg: turnPhaseCfg,
    });

    if (!phaseOutcome.keepTurn) {
      break;
    }

    if (decision.skillId) {
      step2SkillIds.push(decision.skillId);
    }
    step2Used = phaseOutcome.nextTurnStep2Used;
    lockedSkillIds = phaseOutcome.nextTurnLockedSkillIds;
  }

  return {
    updatedUnits: currentUnits,
    logEntries,
    events,
    popups,
    fxEvent: lastFxEvent,
    fxEvents,
    destroyedUnitIds,
    soundCue: lastSoundCue,
    decisionsCount,
    step2SkillIds,
    lastDecision,
    lastMatchedRuleIndex,
  };
}

/**
 * Pure per-enemy base reward formula (before global REWARD_MULT).
 * EXP per enemy = 25 + 8 * enemyLevel (x5 for bosses)
 * Credits per enemy = 60 + 20 * enemyLevel (x5 for bosses)
 * War Points per enemy = 4 + 1 * enemyLevel (x5 for bosses)
 */
export function calculateSingleEnemyReward(
  enemyLevel: number,
  isBoss = false
): { exp: number; credits: number; warPoints: number } {
  const lv = Math.max(1, enemyLevel);
  const bossMult = isBoss ? BALANCE_CONFIG.bossRewardMultiplier : 1;
  return {
    exp:
      (BALANCE_CONFIG.enemyExpBase + BALANCE_CONFIG.enemyExpPerLevel * lv) *
      bossMult,
    credits:
      (BALANCE_CONFIG.enemyCreditsBase +
        BALANCE_CONFIG.enemyCreditsPerLevel * lv) *
      bossMult,
    warPoints:
      (BALANCE_CONFIG.warPointsPerEnemyBase +
        BALANCE_CONFIG.warPointsPerEnemyLevel * lv) *
      bossMult,
  };
}

/**
 * Rebalanced Battle Rewards + War Points (battle + first-time base capture bonus):
 * - Victory = 100% of full victory pool (+ baseCaptureBonusWp if first capture)
 * - Defeat / Retreat = 50% of destroyed enemies + 20% flat consolation of full victory
 */
export function calculateBattleRewards(
  units: CombatUnit[],
  won: boolean,
  rewardMult: number = BALANCE_CONFIG.rewardMultDefault,
  sectorId?: string,
  alreadyCaptured = true
): {
  expGained: number;
  creditsGained: number;
  warPointsGained: number;
  baseCaptureBonusWp: number;
  fullVictoryExp: number;
  fullVictoryCredits: number;
} {
  const enemies = units.filter((u) => u.side === 'enemy');

  let fullExpRaw = 0;
  let fullCreditsRaw = 0;
  let fullWpRaw = 0;
  let destroyedExpRaw = 0;
  let destroyedCreditsRaw = 0;
  let destroyedWpRaw = 0;

  for (const enemy of enemies) {
    const r = calculateSingleEnemyReward(enemy.level, Boolean(enemy.isBoss));
    fullExpRaw += r.exp;
    fullCreditsRaw += r.credits;
    fullWpRaw += r.warPoints;
    if (!enemy.alive) {
      destroyedExpRaw += r.exp;
      destroyedCreditsRaw += r.credits;
      destroyedWpRaw += r.warPoints;
    }
  }

  const fullVictoryExp = Math.round(fullExpRaw * rewardMult);
  const fullVictoryCredits = Math.round(fullCreditsRaw * rewardMult);

  let baseCaptureBonusWp = 0;
  if (won && sectorId && !alreadyCaptured) {
    const sector = getSectorById(sectorId);
    baseCaptureBonusWp = BALANCE_CONFIG.warPointsBaseCaptureBonus[sector.difficulty];
  }

  if (won) {
    return {
      expGained: Math.round(fullVictoryExp * BALANCE_CONFIG.victoryRewardRatio),
      creditsGained: Math.round(
        fullVictoryCredits * BALANCE_CONFIG.victoryRewardRatio
      ),
      warPointsGained: Math.round(fullWpRaw) + baseCaptureBonusWp,
      baseCaptureBonusWp,
      fullVictoryExp,
      fullVictoryCredits,
    };
  }

  const destroyedExp =
    destroyedExpRaw * rewardMult * BALANCE_CONFIG.defeatDestroyedRatio;
  const destroyedCredits =
    destroyedCreditsRaw * rewardMult * BALANCE_CONFIG.defeatDestroyedRatio;
  const destroyedWp = destroyedWpRaw * BALANCE_CONFIG.defeatDestroyedRatio;

  const consolationExp = fullVictoryExp * BALANCE_CONFIG.defeatConsolationRatio;
  const consolationCredits =
    fullVictoryCredits * BALANCE_CONFIG.defeatConsolationRatio;
  const consolationWp = fullWpRaw * BALANCE_CONFIG.defeatConsolationRatio;

  return {
    expGained: Math.round(destroyedExp + consolationExp),
    creditsGained: Math.round(destroyedCredits + consolationCredits),
    warPointsGained: Math.round(destroyedWp + consolationWp),
    baseCaptureBonusWp: 0,
    fullVictoryExp,
    fullVictoryCredits,
  };
}
