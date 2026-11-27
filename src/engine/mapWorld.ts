import {
  createInitialBaseStates,
  getMapNodeById,
  getMapNodes,
  getSectorById,
  MAP_LANES,
  SECTORS_CATALOG,
} from '../data/maps';
import { BATTLE_KIND_RULES } from '../data/battleKinds';
import {
  applySiegeDamage,
  getBaseSiege,
  sanitizeBaseSiegeConfig,
} from './baseSiege';
import {
  isContested,
  mergeVisibleUnlockedSectors,
  neighbours,
} from './frontline';
import { sanitizeSectorSupply } from './npcSupply';
import type {
  BaseRuntimeState,
  BaseSiegeConfig,
  BattleKind,
  BonusMissionState,
  MechClassId,
  PilotAccount,
  SectorDefinition,
} from '../types/game';

export const HIRE_WINGMAN_BASE_COST = 180;
export const ENGINEER_OVERCHARGE_COST = 120;

export function getHireWingmanCost(sector: SectorDefinition): number {
  return HIRE_WINGMAN_BASE_COST + sector.baseLevel * 20;
}

export function getBaseState(
  pilot: PilotAccount,
  sectorId: string
): BaseRuntimeState {
  return (
    pilot.baseStates?.[sectorId] ??
    createInitialBaseStates()[sectorId] ?? {
      faction: 'hostile',
      status: 'operational',
      repairMonthsRemaining: 0,
      underAttack: false,
      attackCountdownMonths: 0,
      attackFromSectorId: null,
    }
  );
}

/**
 * Operational Allied bases pay monthly income; Damaged / Repairing / Hostile / Neutral pay 0.
 */
export function getBaseMonthlyIncome(
  sector: SectorDefinition,
  state: BaseRuntimeState
): { credits: number; warPoints: number } {
  if (state.faction !== 'allied' || state.status !== 'operational') {
    return { credits: 0, warPoints: 0 };
  }
  return {
    credits: sector.monthlyCredits,
    warPoints: sector.monthlyWarPoints,
  };
}

/**
 * NPC services are ONLY available on Allied, Operational bases (never when Damaged or Repairing).
 */
export function isBaseServicesAvailable(state: BaseRuntimeState): boolean {
  return state.faction === 'allied' && state.status === 'operational';
}

export function getTotalMonthlyIncome(pilot: PilotAccount): {
  credits: number;
  warPoints: number;
  operationalAlliedCount: number;
} {
  let credits = 0;
  let warPoints = 0;
  let operationalAlliedCount = 0;
  for (const sector of SECTORS_CATALOG) {
    const st = getBaseState(pilot, sector.id);
    const inc = getBaseMonthlyIncome(sector, st);
    if (inc.credits > 0 || inc.warPoints > 0) {
      operationalAlliedCount += 1;
      credits += inc.credits;
      warPoints += inc.warPoints;
    }
  }
  return { credits, warPoints, operationalAlliedCount };
}

export interface BaseActionResult {
  ok: boolean;
  reason?:
    | 'not_allied'
    | 'not_damaged'
    | 'not_operational'
    | 'insufficient_credits'
    | 'npc_unavailable'
    | 'already_active'
    | 'no_target_sector';
  pilot: PilotAccount;
  creditsSpent?: number;
}

export function startBaseRepair(
  pilot: PilotAccount,
  sectorId: string
): BaseActionResult {
  const sector = getSectorById(sectorId);
  const st = getBaseState(pilot, sector.id);
  if (st.faction !== 'allied') {
    return { ok: false, reason: 'not_allied', pilot };
  }
  if (st.status !== 'damaged') {
    return { ok: false, reason: 'not_damaged', pilot };
  }
  if (pilot.credits < sector.repairCost) {
    return { ok: false, reason: 'insufficient_credits', pilot };
  }

  return {
    ok: true,
    creditsSpent: sector.repairCost,
    pilot: {
      ...pilot,
      credits: pilot.credits - sector.repairCost,
      baseStates: {
        ...pilot.baseStates,
        [sector.id]: {
          ...st,
          status: 'repairing',
          repairMonthsRemaining: sector.repairMonths,
        },
      },
    },
  };
}

export interface RaidStrikeResult {
  sectorId: string;
  shieldBefore: number;
  shieldAfter: number;
  hpBefore: number;
  hpAfter: number;
  maxShield: number;
  maxHp: number;
  flipped: boolean;
  capitalHeld?: boolean;
}

export interface MonthAdvanceSummary {
  pilot: PilotAccount;
  newMonth: number;
  creditsEarned: number;
  warPointsEarned: number;
  repairedSectorIds: string[];
  raidedSectorIds: string[];
  flippedSectorIds: string[];
  raidResults: RaidStrikeResult[];
}

/**
 * Advances the campaign calendar by 1 month:
 * - Collects income from all Operational Allied bases.
 * - Progresses repairing bases (1-2 months -> Operational).
 * - Regenerates base siege Shield/HP after idleMonths without an assault.
 * - Ticks Under Attack countdowns (unanswered raids damage siege pools & can flip bases).
 * - Schedules a fresh frontier raid warning on a connected Allied base if none is under attack.
 */
export function advanceCampaignMonth(
  pilot: PilotAccount,
  regenPerMonth = 10,
  baseSiegeCfg?: Partial<BaseSiegeConfig> | null
): MonthAdvanceSummary {
  const siegeCfg = sanitizeBaseSiegeConfig(baseSiegeCfg);
  const income = getTotalMonthlyIncome(pilot);
  const nextMonth = (pilot.campaignMonth || 1) + 1;
  const nextBaseStates: Record<string, BaseRuntimeState> = {};
  const repairedSectorIds: string[] = [];
  const raidedSectorIds: string[] = [];
  const flippedSectorIds: string[] = [];
  const raidResults: RaidStrikeResult[] = [];

  for (const sector of getMapNodes()) {
    const cur = { ...getBaseState(pilot, sector.id) };

    if (cur.status === 'repairing') {
      const rem = Math.max(0, cur.repairMonthsRemaining - 1);
      if (rem === 0) {
        cur.status = 'operational';
        cur.repairMonthsRemaining = 0;
        repairedSectorIds.push(sector.id);
      } else {
        cur.repairMonthsRemaining = rem;
      }
    }

    // Monthly siege Shield/HP regen when below max and idle for >= regen.idleMonths
    const siegeBeforeRegen = getBaseSiege(cur, sector.baseType, siegeCfg);
    if (
      siegeBeforeRegen.shield < siegeBeforeRegen.maxShield ||
      siegeBeforeRegen.hp < siegeBeforeRegen.maxHp
    ) {
      const isIdleEnough =
        cur.lastAttackedMonth === undefined ||
        nextMonth - cur.lastAttackedMonth >= siegeCfg.regen.idleMonths;
      if (isIdleEnough) {
        const shieldGain = Math.round(
          (siegeBeforeRegen.maxShield * siegeCfg.regen.shieldPct) / 100
        );
        const hpGain = Math.round(
          (siegeBeforeRegen.maxHp * siegeCfg.regen.hpPct) / 100
        );
        cur.siegeShield = Math.min(
          siegeBeforeRegen.maxShield,
          siegeBeforeRegen.shield + shieldGain
        );
        cur.siegeHp = Math.min(
          siegeBeforeRegen.maxHp,
          siegeBeforeRegen.hp + hpGain
        );
      }
    }

    if (cur.underAttack && cur.faction === 'allied') {
      const nextCd = Math.max(0, cur.attackCountdownMonths - 1);
      if (nextCd === 0) {
        cur.underAttack = false;
        cur.attackCountdownMonths = 0;
        cur.attackFromSectorId = null;
        cur.status = 'damaged';
        cur.repairMonthsRemaining = 0;

        const beforeRaid = getBaseSiege(cur, sector.baseType, siegeCfg);
        const raidDmg = applySiegeDamage(
          beforeRaid,
          siegeCfg.raid.shieldDamage,
          siegeCfg.raid.hpDamage
        );
        const isAlliedCapital = sector.baseType === 'capital';

        if (isAlliedCapital) {
          cur.siegeShield = raidDmg.shield;
          cur.siegeHp = raidDmg.broken ? 1 : raidDmg.hp;
          raidResults.push({
            sectorId: sector.id,
            shieldBefore: beforeRaid.shield,
            shieldAfter: cur.siegeShield,
            hpBefore: beforeRaid.hp,
            hpAfter: cur.siegeHp,
            maxShield: beforeRaid.maxShield,
            maxHp: beforeRaid.maxHp,
            flipped: false,
            capitalHeld: raidDmg.broken,
          });
        } else if (raidDmg.broken) {
          cur.faction = 'hostile';
          cur.status = 'damaged';
          cur.repairMonthsRemaining = 0;
          cur.siegeShield = beforeRaid.maxShield;
          cur.siegeHp = beforeRaid.maxHp;
          delete cur.lastRepairHpMonth;
          delete cur.lastRepairShieldMonth;
          flippedSectorIds.push(sector.id);
          raidResults.push({
            sectorId: sector.id,
            shieldBefore: beforeRaid.shield,
            shieldAfter: 0,
            hpBefore: beforeRaid.hp,
            hpAfter: 0,
            maxShield: beforeRaid.maxShield,
            maxHp: beforeRaid.maxHp,
            flipped: true,
          });
        } else {
          cur.siegeShield = raidDmg.shield;
          cur.siegeHp = raidDmg.hp;
          raidResults.push({
            sectorId: sector.id,
            shieldBefore: beforeRaid.shield,
            shieldAfter: raidDmg.shield,
            hpBefore: beforeRaid.hp,
            hpAfter: raidDmg.hp,
            maxShield: beforeRaid.maxShield,
            maxHp: beforeRaid.maxHp,
            flipped: false,
          });
        }
        raidedSectorIds.push(sector.id);
      } else {
        cur.attackCountdownMonths = nextCd;
      }
    }

    nextBaseStates[sector.id] = cur;
  }

  // If no Allied base is currently under attack, trigger an incoming raid along a hostile->allied lane
  const anyUnderAttack = Object.values(nextBaseStates).some(
    (b) => b.faction === 'allied' && b.underAttack
  );
  if (!anyUnderAttack) {
    for (const lane of MAP_LANES) {
      const fromSt = nextBaseStates[lane.from];
      const toSt = nextBaseStates[lane.to];
      if (fromSt?.faction === 'hostile' && toSt?.faction === 'allied') {
        nextBaseStates[lane.to] = {
          ...toSt,
          underAttack: true,
          attackCountdownMonths: 2,
          attackFromSectorId: lane.from,
        };
        break;
      }
      if (toSt?.faction === 'hostile' && fromSt?.faction === 'allied') {
        nextBaseStates[lane.from] = {
          ...fromSt,
          underAttack: true,
          attackCountdownMonths: 2,
          attackFromSectorId: lane.to,
        };
        break;
      }
    }
  }

  const regen =
    typeof regenPerMonth === 'number' && Number.isFinite(regenPerMonth)
      ? Math.max(0, Math.min(100, regenPerMonth))
      : 10;
  const currentSupply = sanitizeSectorSupply(pilot.sectorSupply);
  let nextSectorSupply: Record<string, number> | undefined = currentSupply;
  if (currentSupply && regen > 0) {
    const bumped: Record<string, number> = {};
    for (const [secId, val] of Object.entries(currentSupply)) {
      bumped[secId] = Math.min(100, val + regen);
    }
    nextSectorSupply = sanitizeSectorSupply(bumped);
  }
  const { sectorSupply: _droppedSupply, ...pilotBase } = pilot;
  const flippedSet = new Set(flippedSectorIds);
  const nextCapturedSectorIds =
    flippedSet.size > 0
      ? pilot.capturedSectorIds.filter((id) => !flippedSet.has(id))
      : pilot.capturedSectorIds;

  return {
    pilot: {
      ...pilotBase,
      campaignMonth: nextMonth,
      credits: pilot.credits + income.credits,
      warPoints: pilot.warPoints + income.warPoints,
      capturedSectorIds: nextCapturedSectorIds,
      baseStates: nextBaseStates,
      ...(nextSectorSupply ? { sectorSupply: nextSectorSupply } : {}),
    },
    newMonth: nextMonth,
    creditsEarned: income.credits,
    warPointsEarned: income.warPoints,
    repairedSectorIds,
    raidedSectorIds,
    flippedSectorIds,
    raidResults,
  };
}

const MERC_CALLSIGNS: Record<MechClassId, string> = {
  striker: 'Valkyrie-X',
  interceptor: 'Phantom-09',
  siege: 'Bastion-7',
  support: 'Seraph-3',
};

export function hirePilotForNextBattle(
  pilot: PilotAccount,
  sectorId: string,
  classId: MechClassId = 'interceptor'
): BaseActionResult {
  const sector = getSectorById(sectorId);
  const st = getBaseState(pilot, sector.id);
  if (!isBaseServicesAvailable(st)) {
    return { ok: false, reason: 'not_operational', pilot };
  }
  if (!sector.npcs.includes('pilot_for_hire')) {
    return { ok: false, reason: 'npc_unavailable', pilot };
  }
  if (pilot.hiredWingman) {
    return { ok: false, reason: 'already_active', pilot };
  }
  const cost = getHireWingmanCost(sector);
  if (pilot.credits < cost) {
    return { ok: false, reason: 'insufficient_credits', pilot };
  }

  return {
    ok: true,
    creditsSpent: cost,
    pilot: {
      ...pilot,
      credits: pilot.credits - cost,
      hiredWingman: {
        callsign: MERC_CALLSIGNS[classId],
        classId,
        bonusLevel: Math.max(1, Math.floor(sector.baseLevel / 3)),
        sourceSectorId: sector.id,
      },
    },
  };
}

export function acceptBaseBonusMission(
  pilot: PilotAccount,
  sectorId: string
): BaseActionResult {
  const sector = getSectorById(sectorId);
  const st = getBaseState(pilot, sector.id);
  if (!isBaseServicesAvailable(st)) {
    return { ok: false, reason: 'not_operational', pilot };
  }
  if (!sector.npcs.includes('mission_officer')) {
    return { ok: false, reason: 'npc_unavailable', pilot };
  }
  if (pilot.activeBonusMission && !pilot.activeBonusMission.completed) {
    return { ok: false, reason: 'already_active', pilot };
  }

  // BFS shortest lane-hop distance from the source base
  const hopDist = new Map<string, number>();
  hopDist.set(sector.id, 0);
  const queue: string[] = [sector.id];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const dist = hopDist.get(cur) ?? 0;
    for (const nb of neighbours(cur)) {
      if (!hopDist.has(nb)) {
        hopDist.set(nb, dist + 1);
        queue.push(nb);
      }
    }
  }

  // Target a CONTESTED node only: fewest lane hops from source base, ties broken by lower baseLevel
  const targetSector =
    SECTORS_CATALOG.filter((s) => isContested(pilot, s.id) && hopDist.has(s.id))
      .sort((a, b) => {
        const da = hopDist.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const db = hopDist.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return a.baseLevel - b.baseLevel;
      })[0] ?? null;

  if (!targetSector) {
    return { ok: false, reason: 'no_target_sector', pilot };
  }

  const mission: BonusMissionState = {
    id: `msn_${Date.now().toString(36)}`,
    sourceSectorId: sector.id,
    targetSectorId: targetSector.id,
    rewardCredits: 220 + targetSector.baseLevel * 45,
    rewardWarPoints: 18 + targetSector.baseLevel * 3,
    completed: false,
  };

  return {
    ok: true,
    pilot: {
      ...pilot,
      activeBonusMission: mission,
    },
  };
}

export function applyBaseEngineerBoost(
  pilot: PilotAccount,
  sectorId: string
): BaseActionResult {
  const sector = getSectorById(sectorId);
  const st = getBaseState(pilot, sector.id);
  if (!isBaseServicesAvailable(st)) {
    return { ok: false, reason: 'not_operational', pilot };
  }
  if (!sector.npcs.includes('engineer')) {
    return { ok: false, reason: 'npc_unavailable', pilot };
  }
  if (pilot.engineerShieldBoost) {
    return { ok: false, reason: 'already_active', pilot };
  }
  if (pilot.credits < ENGINEER_OVERCHARGE_COST) {
    return { ok: false, reason: 'insufficient_credits', pilot };
  }

  return {
    ok: true,
    creditsSpent: ENGINEER_OVERCHARGE_COST,
    pilot: {
      ...pilot,
      credits: pilot.credits - ENGINEER_OVERCHARGE_COST,
      engineerShieldBoost: true,
    },
  };
}

export interface SiegeBattleResult {
  sectorId: string;
  shieldBefore: number;
  shieldAfter: number;
  hpBefore: number;
  hpAfter: number;
  maxShield: number;
  maxHp: number;
  captured: boolean;
}

/**
 * Applies post-battle base capture / raid defense / bonus mission completion / hired wingman consumption.
 * Freshly captured bases ALWAYS start in "damaged" status (0 income, no services until repaired over 1-2 months).
 */
export function applyBattleBaseConsequences(
  pilot: PilotAccount,
  sectorId: string,
  won: boolean,
  kind: BattleKind = 'assault',
  baseSiegeCfg?: Partial<BaseSiegeConfig> | null
): {
  pilot: PilotAccount;
  bonusMissionCredits: number;
  bonusMissionWarPoints: number;
  capturedFreshly: boolean;
  siegeResult?: SiegeBattleResult;
} {
  const rule = BATTLE_KIND_RULES[kind];
  const siegeCfg = sanitizeBaseSiegeConfig(baseSiegeCfg);
  const sector = getMapNodeById(sectorId) ?? getSectorById(sectorId);
  const curBase = getBaseState(pilot, sectorId);
  const curMonth = Math.max(1, Math.floor(pilot.campaignMonth || 1));
  const nextBaseStates: Record<string, BaseRuntimeState> = {
    ...(pilot.baseStates ?? createInitialBaseStates()),
  };
  let capturedFreshly = false;
  let siegeResult: SiegeBattleResult | undefined = undefined;

  if (rule.capturesOnWin) {
    if (won && curBase.faction !== 'allied') {
      const before = getBaseSiege(curBase, sector.baseType, siegeCfg);
      const dmg = applySiegeDamage(
        before,
        siegeCfg.shieldDamagePerWin,
        siegeCfg.hpDamagePerWin
      );
      siegeResult = {
        sectorId,
        shieldBefore: before.shield,
        shieldAfter: dmg.shield,
        hpBefore: before.hp,
        hpAfter: dmg.hp,
        maxShield: before.maxShield,
        maxHp: before.maxHp,
        captured: dmg.broken,
      };
      if (dmg.broken) {
        // Freshly captured base starts DAMAGED with full siege pool for new owner!
        nextBaseStates[sectorId] = {
          faction: 'allied',
          status: 'damaged',
          repairMonthsRemaining: 0,
          underAttack: false,
          attackCountdownMonths: 0,
          attackFromSectorId: null,
          siegeShield: before.maxShield,
          siegeHp: before.maxHp,
          lastAttackedMonth: curMonth,
        };
        capturedFreshly = true;
      } else {
        nextBaseStates[sectorId] = {
          ...curBase,
          siegeShield: dmg.shield,
          siegeHp: dmg.hp,
          lastAttackedMonth: curMonth,
        };
      }
    } else if (!won) {
      // Defeat or retreat leaves siege pool untouched, but marks lastAttackedMonth
      nextBaseStates[sectorId] = {
        ...curBase,
        lastAttackedMonth: curMonth,
      };
    }
  } else if (
    won &&
    rule.clearsRaid &&
    curBase.faction === 'allied' &&
    curBase.underAttack
  ) {
    // Successfully defended Allied base from incoming raid
    nextBaseStates[sectorId] = {
      ...curBase,
      underAttack: false,
      attackCountdownMonths: 0,
      attackFromSectorId: null,
    };
  }

  // Cumulative visibility history: add every visible node, never remove one
  const nextUnlocked = mergeVisibleUnlockedSectors({
    baseStates: nextBaseStates,
    unlockedSectorIds: pilot.unlockedSectorIds,
  });

  // Check Bonus Mission completion (overlay: assault or defend win at target base)
  let bonusMissionCredits = 0;
  let bonusMissionWarPoints = 0;
  let nextBonusMission = pilot.activeBonusMission;
  if (
    won &&
    rule.completesBonusMissionOnWin &&
    pilot.activeBonusMission &&
    !pilot.activeBonusMission.completed &&
    pilot.activeBonusMission.targetSectorId === sectorId
  ) {
    bonusMissionCredits = pilot.activeBonusMission.rewardCredits;
    bonusMissionWarPoints = pilot.activeBonusMission.rewardWarPoints;
    nextBonusMission = null;
  }

  return {
    pilot: {
      ...pilot,
      credits: pilot.credits + bonusMissionCredits,
      warPoints: pilot.warPoints + bonusMissionWarPoints,
      unlockedSectorIds: nextUnlocked,
      baseStates: nextBaseStates,
      hiredWingman: null,
      engineerShieldBoost: false,
      activeBonusMission: nextBonusMission,
    },
    bonusMissionCredits,
    bonusMissionWarPoints,
    capturedFreshly,
    ...(siegeResult ? { siegeResult } : {}),
  };
}
