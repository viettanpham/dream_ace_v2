import { SUPPLY_TEMPLATES } from '../data/consumables';
import { getSectorById, SECTORS_CATALOG } from '../data/maps';
import rawNpcSupplyData from '../data/npcSupply.json';
import type {
  AdminConfig,
  AutoSuppliesConfig,
  BaseFaction,
  BaseStatus,
  BattleEvent,
  BattleKind,
  BattleNpcSupplyState,
  BattleState,
  CombatFxEvent,
  CombatLogEntry,
  CombatSide,
  CombatUnit,
  EnemyArchetype,
  FloatingPopup,
  NpcSupplyConfig,
  NpcSupplyKitFamily,
  PilotAccount,
  SectorDifficulty,
  SupplyTemplate,
} from '../types/game';
import {
  applyBattleSupplyUse,
  buildSupplyUseFeedback,
  filterAutoOrNpcSupplies,
  sanitizeSupplyUsesPerTurn,
  tickBattleSupplyForUnit,
} from './supplies';
import {
  AUTO_SUPPLIES_MAX_PCT,
  AUTO_SUPPLIES_MIN_PCT,
  pickAutoSupplies,
} from './supplyAi';

export const DEFAULT_SUPPLY_MAX_PER_TYPE_PER_BATTLE = 10;
export const MIN_SUPPLY_MAX_PER_TYPE_PER_BATTLE = 1;
export const MAX_SUPPLY_MAX_PER_TYPE_PER_BATTLE = 30;

export const MIN_NPC_SUPPLY_TYPES = 1;
export const MAX_NPC_SUPPLY_TYPES = 5;
export const MIN_NPC_SUPPLY_QTY = 0;
export const MAX_NPC_SUPPLY_QTY = 30;

const NPC_SUPPLY_FAMILIES: readonly NpcSupplyKitFamily[] = [
  'hp_kit',
  'shield_kit',
  'sp_kit',
];

const FALLBACK_DEFAULT_NPC_SUPPLY: NpcSupplyConfig = {
  enabled: true,
  typesMin: 1,
  typesMax: 2,
  qtyMin: 1,
  qtyMax: 4,
  noSupplyChance: { mob: 0.15, boss: 0 },
  thresholds: { hp: 40, shield: 25, sp: 20 },
  losingGap: 0.2,
  losingBonus: 15,
  winningCut: 10,
  emergency: { enabled: true, minRound: 3, gap: 0.35, minSectorSupply: 50 },
  sector: {
    drainPerBattle: 20,
    regenPerMonth: 10,
    minQtyFactor: 0.4,
    maxExtraEmptyChance: 0.3,
    enemyScarcityWeight: 1,
  },
  baseStatusMult: { operational: 1, damaged: 0.7, repairing: 0.5 },
  tierOffset: { Standard: -1, Hard: 0, Elite: 1, boss: 1, event: 1 },
  kindMult: {
    enemy: { assault: 1.5, defend: 1, patrol: 0.75, mission: 1, event: 1.25 },
    ally: { assault: 1, defend: 1.5, patrol: 0.75, mission: 1, event: 1.25 },
  },
  diffMult: { Standard: 1, Hard: 1.25, Elite: 1.5 },
  bossQtyMult: 2,
  underdogRatio: 0.8,
  familyWeights: {
    drone: { hp_kit: 1 },
    gunship: { hp_kit: 2, shield_kit: 2, sp_kit: 1 },
    sniper: { hp_kit: 2, shield_kit: 1, sp_kit: 2 },
    repair_ship: { hp_kit: 1, shield_kit: 2, sp_kit: 2 },
    ally: { hp_kit: 1, shield_kit: 1, sp_kit: 1 },
  },
};

function asObj(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function clampFinite(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeWeightMap(
  raw: unknown,
  def: Partial<Record<NpcSupplyKitFamily, number>>
): Partial<Record<NpcSupplyKitFamily, number>> {
  const src = asObj(raw);
  const out: Partial<Record<NpcSupplyKitFamily, number>> = {};
  for (const fam of NPC_SUPPLY_FAMILIES) {
    const rawVal = src?.[fam];
    if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
      const clamped = Math.max(0, Math.min(100, rawVal));
      if (clamped > 0 || def[fam] !== undefined) {
        out[fam] = clamped;
      }
    } else if (def[fam] !== undefined) {
      out[fam] = def[fam];
    }
  }
  return out;
}

function sanitizeSideKindMult(
  raw: unknown,
  def: Record<BattleKind, number>
): Record<BattleKind, number> {
  const src = asObj(raw);
  return {
    assault: clampFinite(src?.assault, 0, 10, def.assault),
    defend: clampFinite(src?.defend, 0, 10, def.defend),
    patrol: clampFinite(src?.patrol, 0, 10, def.patrol),
    mission: clampFinite(src?.mission, 0, 10, def.mission),
    event: clampFinite(src?.event, 0, 10, def.event),
  };
}

function sanitizeConfigWithBase(
  raw: unknown,
  base: NpcSupplyConfig
): NpcSupplyConfig {
  const src = asObj(raw);
  if (!src) {
    return {
      ...base,
      noSupplyChance: { ...base.noSupplyChance },
      thresholds: { ...base.thresholds },
      emergency: { ...base.emergency },
      sector: { ...base.sector },
      baseStatusMult: { ...base.baseStatusMult },
      tierOffset: { ...base.tierOffset },
      kindMult: {
        enemy: { ...base.kindMult.enemy },
        ally: { ...base.kindMult.ally },
      },
      diffMult: { ...base.diffMult },
      familyWeights: {
        drone: { ...base.familyWeights.drone },
        gunship: { ...base.familyWeights.gunship },
        sniper: { ...base.familyWeights.sniper },
        repair_ship: { ...base.familyWeights.repair_ship },
        ally: { ...base.familyWeights.ally },
      },
    };
  }

  const typesMin = clampInt(
    src.typesMin,
    MIN_NPC_SUPPLY_TYPES,
    MAX_NPC_SUPPLY_TYPES,
    base.typesMin
  );
  const typesMax = Math.max(
    typesMin,
    clampInt(
      src.typesMax,
      MIN_NPC_SUPPLY_TYPES,
      MAX_NPC_SUPPLY_TYPES,
      base.typesMax
    )
  );
  const qtyMin = clampInt(
    src.qtyMin,
    MIN_NPC_SUPPLY_QTY,
    MAX_NPC_SUPPLY_QTY,
    base.qtyMin
  );
  const qtyMax = Math.max(
    qtyMin,
    clampInt(
      src.qtyMax,
      MIN_NPC_SUPPLY_QTY,
      MAX_NPC_SUPPLY_QTY,
      base.qtyMax
    )
  );

  const noSupplySrc = asObj(src.noSupplyChance);
  const threshSrc = asObj(src.thresholds);
  const emergencySrc = asObj(src.emergency);
  const sectorSrc = asObj(src.sector);
  const baseStatusSrc = asObj(src.baseStatusMult);
  const tierSrc = asObj(src.tierOffset);
  const kindSrc = asObj(src.kindMult);
  const diffSrc = asObj(src.diffMult);
  const weightsSrc = asObj(src.familyWeights);

  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : base.enabled,
    typesMin,
    typesMax,
    qtyMin,
    qtyMax,
    noSupplyChance: {
      mob: clampFinite(noSupplySrc?.mob, 0, 1, base.noSupplyChance.mob),
      boss: clampFinite(noSupplySrc?.boss, 0, 1, base.noSupplyChance.boss),
    },
    thresholds: {
      hp: clampFinite(threshSrc?.hp, 0, 100, base.thresholds.hp),
      shield: clampFinite(threshSrc?.shield, 0, 100, base.thresholds.shield),
      sp: clampFinite(threshSrc?.sp, 0, 100, base.thresholds.sp),
    },
    losingGap: clampFinite(src.losingGap, 0, 1, base.losingGap),
    losingBonus: clampFinite(src.losingBonus, 0, 100, base.losingBonus),
    winningCut: clampFinite(src.winningCut, 0, 100, base.winningCut),
    emergency: {
      enabled:
        typeof emergencySrc?.enabled === 'boolean'
          ? emergencySrc.enabled
          : base.emergency.enabled,
      minRound: clampInt(
        emergencySrc?.minRound,
        1,
        50,
        base.emergency.minRound
      ),
      gap: clampFinite(emergencySrc?.gap, 0, 1, base.emergency.gap),
      minSectorSupply: clampFinite(
        emergencySrc?.minSectorSupply,
        0,
        100,
        base.emergency.minSectorSupply
      ),
    },
    sector: {
      drainPerBattle: clampFinite(
        sectorSrc?.drainPerBattle,
        0,
        100,
        base.sector.drainPerBattle
      ),
      regenPerMonth: clampFinite(
        sectorSrc?.regenPerMonth,
        0,
        100,
        base.sector.regenPerMonth
      ),
      minQtyFactor: clampFinite(
        sectorSrc?.minQtyFactor,
        0,
        1,
        base.sector.minQtyFactor
      ),
      maxExtraEmptyChance: clampFinite(
        sectorSrc?.maxExtraEmptyChance,
        0,
        1,
        base.sector.maxExtraEmptyChance
      ),
      enemyScarcityWeight: clampFinite(
        sectorSrc?.enemyScarcityWeight,
        0,
        2,
        base.sector.enemyScarcityWeight
      ),
    },
    baseStatusMult: {
      operational: clampFinite(
        baseStatusSrc?.operational,
        0,
        10,
        base.baseStatusMult.operational
      ),
      damaged: clampFinite(
        baseStatusSrc?.damaged,
        0,
        10,
        base.baseStatusMult.damaged
      ),
      repairing: clampFinite(
        baseStatusSrc?.repairing,
        0,
        10,
        base.baseStatusMult.repairing
      ),
    },
    tierOffset: {
      Standard: clampInt(tierSrc?.Standard, -5, 5, base.tierOffset.Standard),
      Hard: clampInt(tierSrc?.Hard, -5, 5, base.tierOffset.Hard),
      Elite: clampInt(tierSrc?.Elite, -5, 5, base.tierOffset.Elite),
      boss: clampInt(tierSrc?.boss, -5, 5, base.tierOffset.boss),
      event: clampInt(tierSrc?.event, -5, 5, base.tierOffset.event),
    },
    kindMult: {
      enemy: sanitizeSideKindMult(kindSrc?.enemy, base.kindMult.enemy),
      ally: sanitizeSideKindMult(kindSrc?.ally, base.kindMult.ally),
    },
    diffMult: {
      Standard: clampFinite(diffSrc?.Standard, 0, 10, base.diffMult.Standard),
      Hard: clampFinite(diffSrc?.Hard, 0, 10, base.diffMult.Hard),
      Elite: clampFinite(diffSrc?.Elite, 0, 10, base.diffMult.Elite),
    },
    bossQtyMult: clampFinite(src.bossQtyMult, 0, 10, base.bossQtyMult),
    underdogRatio: clampFinite(src.underdogRatio, 0, 1, base.underdogRatio),
    familyWeights: {
      drone: sanitizeWeightMap(weightsSrc?.drone, base.familyWeights.drone),
      gunship: sanitizeWeightMap(
        weightsSrc?.gunship,
        base.familyWeights.gunship
      ),
      sniper: sanitizeWeightMap(weightsSrc?.sniper, base.familyWeights.sniper),
      repair_ship: sanitizeWeightMap(
        weightsSrc?.repair_ship,
        base.familyWeights.repair_ship
      ),
      ally: sanitizeWeightMap(weightsSrc?.ally, base.familyWeights.ally),
    },
  };
}

export const DEFAULT_NPC_SUPPLY_CONFIG: NpcSupplyConfig = sanitizeConfigWithBase(
  rawNpcSupplyData,
  FALLBACK_DEFAULT_NPC_SUPPLY
);

export function sanitizeNpcSupplyConfig(
  raw?: Partial<NpcSupplyConfig> | Record<string, unknown> | null
): NpcSupplyConfig {
  return sanitizeConfigWithBase(raw, DEFAULT_NPC_SUPPLY_CONFIG);
}

export function cloneNpcSupplyConfig(cfg: NpcSupplyConfig): NpcSupplyConfig {
  return sanitizeNpcSupplyConfig(cfg);
}

export function sanitizeSupplyMaxPerTypePerBattle(raw: unknown): number {
  return clampInt(
    raw,
    MIN_SUPPLY_MAX_PER_TYPE_PER_BATTLE,
    MAX_SUPPLY_MAX_PER_TYPE_PER_BATTLE,
    DEFAULT_SUPPLY_MAX_PER_TYPE_PER_BATTLE
  );
}

const KNOWN_SECTOR_IDS = new Set<string>(SECTORS_CATALOG.map((s) => s.id));

/**
 * Sanitizes a PilotAccount.sectorSupply map:
 * - keeps only known sector ids from SECTORS_CATALOG
 * - clamps values to [0, 100]
 * - stores only entries < 100 (missing === 100)
 * Returns undefined when empty so old saves / full sectors stay compact.
 */
export function sanitizeSectorSupply(
  raw: unknown
): Record<string, number> | undefined {
  const src = asObj(raw);
  if (!src) return undefined;
  const cleaned: Record<string, number> = {};
  for (const [sectorId, rawVal] of Object.entries(src)) {
    if (!KNOWN_SECTOR_IDS.has(sectorId)) continue;
    if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) continue;
    const clamped = Math.max(0, Math.min(100, Math.round(rawVal * 100) / 100));
    if (clamped < 100) {
      cleaned[sectorId] = clamped;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function getSectorSupplyPct(
  pilot: Pick<PilotAccount, 'sectorSupply'>,
  sectorId: string
): number {
  const raw = pilot.sectorSupply?.[sectorId];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 100;
  return Math.max(0, Math.min(100, raw));
}

export function drainSectorSupply(
  pilot: PilotAccount,
  sectorId: string,
  npcCfg?: Partial<NpcSupplyConfig> | Record<string, unknown> | null
): PilotAccount {
  if (!KNOWN_SECTOR_IDS.has(sectorId)) return pilot;
  const cfg = sanitizeNpcSupplyConfig(npcCfg);
  const drain = cfg.sector.drainPerBattle;
  if (drain <= 0) return pilot;
  const cur = getSectorSupplyPct(pilot, sectorId);
  const nextVal = Math.max(0, Math.min(100, cur - drain));
  const merged = {
    ...(pilot.sectorSupply ?? {}),
    [sectorId]: nextVal,
  };
  const nextMap = sanitizeSectorSupply(merged);
  if (!nextMap) {
    if (!pilot.sectorSupply) return pilot;
    const { sectorSupply: _dropped, ...rest } = pilot;
    return rest;
  }
  return {
    ...pilot,
    sectorSupply: nextMap,
  };
}

export interface GenerateNpcSuppliesOptions {
  kind: BattleKind;
  difficulty: SectorDifficulty;
  cfg?: Partial<NpcSupplyConfig> | Record<string, unknown> | null;
  supplyMaxPerTypePerBattle?: number;
  templates?: readonly SupplyTemplate[];
  rng?: () => number;
  sectorSupply?: number;
  ownerFaction?: BaseFaction | null;
  baseStatus?: BaseStatus | null;
  eventSupplyMult?: number;
}

function rollIntInclusive(
  min: number,
  max: number,
  rng: () => number
): number {
  if (max <= min) return min;
  const span = max - min + 1;
  return Math.min(max, min + Math.floor(rng() * span));
}

function getBaseTierForLevel(
  level: number,
  templates: readonly SupplyTemplate[]
): number {
  let highestUnlockTier = 0;
  let lowestTier = Infinity;
  for (const tpl of templates) {
    lowestTier = Math.min(lowestTier, tpl.tier);
    if (tpl.unlockLevel <= level && tpl.tier > highestUnlockTier) {
      highestUnlockTier = tpl.tier;
    }
  }
  if (highestUnlockTier > 0) return highestUnlockTier;
  return Number.isFinite(lowestTier) ? lowestTier : 1;
}

function pickTemplateForFamilyAndTier(
  templates: readonly SupplyTemplate[],
  family: NpcSupplyKitFamily,
  targetTier: number
): SupplyTemplate | undefined {
  const famTemplates = templates
    .filter((t) => t.family === family)
    .sort((a, b) => a.tier - b.tier);
  if (famTemplates.length === 0) return undefined;
  const exact = famTemplates.find((t) => t.tier === targetTier);
  if (exact) return exact;
  let bestLower: SupplyTemplate | undefined;
  for (const t of famTemplates) {
    if (t.tier <= targetTier) bestLower = t;
  }
  return bestLower ?? famTemplates[0];
}

function pickWeightedFamilies(
  pool: Array<{ family: NpcSupplyKitFamily; weight: number }>,
  count: number,
  rng: () => number
): NpcSupplyKitFamily[] {
  const remaining = pool.map((p) => ({ ...p }));
  const picked: NpcSupplyKitFamily[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const total = remaining.reduce((sum, e) => sum + e.weight, 0);
    if (total <= 0) break;
    let roll = rng() * total;
    let pickedIdx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      if (roll < remaining[j].weight) {
        pickedIdx = j;
        break;
      }
      roll -= remaining[j].weight;
    }
    picked.push(remaining[pickedIdx].family);
    remaining.splice(pickedIdx, 1);
  }
  return picked;
}

function getFamilyWeightsForUnit(
  unit: Pick<CombatUnit, 'side' | 'archetype'>,
  cfg: NpcSupplyConfig
): Partial<Record<NpcSupplyKitFamily, number>> {
  if (unit.side === 'ally') {
    return cfg.familyWeights.ally;
  }
  const arch: EnemyArchetype | undefined = unit.archetype;
  if (arch && cfg.familyWeights[arch]) {
    return cfg.familyWeights[arch];
  }
  return cfg.familyWeights.ally;
}

export function generateNpcSupplies(
  units: readonly CombatUnit[],
  options: GenerateNpcSuppliesOptions
): BattleNpcSupplyState | undefined {
  const safeCfg = sanitizeNpcSupplyConfig(options.cfg);
  if (!safeCfg.enabled) {
    return undefined;
  }

  const maxPerType = sanitizeSupplyMaxPerTypePerBattle(
    options.supplyMaxPerTypePerBattle ??
      (asObj(options.cfg)?.supplyMaxPerTypePerBattle as unknown)
  );
  const safeSectorSupply = clampFinite(options.sectorSupply, 0, 100, 100);
  const safeEventMult = clampFinite(options.eventSupplyMult, 0, 10, 1);
  const rng = options.rng ?? Math.random;

  const allowedTemplates = filterAutoOrNpcSupplies(
    options.templates ?? SUPPLY_TEMPLATES
  ).filter((tpl): tpl is SupplyTemplate & { family: NpcSupplyKitFamily } =>
    NPC_SUPPLY_FAMILIES.includes(tpl.family as NpcSupplyKitFamily)
  );

  const maxTemplateTier = allowedTemplates.reduce(
    (max, tpl) => Math.max(max, tpl.tier),
    1
  );
  const availableFamilies = NPC_SUPPLY_FAMILIES.filter((fam) =>
    allowedTemplates.some((tpl) => tpl.family === fam)
  );

  let allyTotalLevel = 0;
  let enemyTotalLevel = 0;
  for (const unit of units) {
    if (!unit.alive) continue;
    const lv = Math.max(0, unit.level);
    if (unit.side === 'ally') allyTotalLevel += lv;
    else enemyTotalLevel += lv;
  }
  const underdogBySide: Record<CombatSide, boolean> = {
    ally: allyTotalLevel < safeCfg.underdogRatio * enemyTotalLevel,
    enemy: enemyTotalLevel < safeCfg.underdogRatio * allyTotalLevel,
  };

  const stockByUnit: Record<string, Record<string, number>> = {};

  if (availableFamilies.length === 0) {
    return {
      stockByUnit,
      sectorSupply: safeSectorSupply,
      emergencyUsed: { ally: false, enemy: false },
    };
  }

  const baseS = safeSectorSupply / 100;

  for (const unit of units) {
    if (!unit.alive || unit.isPlayer || (unit.isStructure && !unit.isBoss)) {
      continue;
    }

    const isBoss = Boolean(unit.isBoss);
    const s =
      unit.side === 'enemy'
        ? Math.max(
            0,
            Math.min(1, 1 - (1 - baseS) * safeCfg.sector.enemyScarcityWeight)
          )
        : Math.max(0, Math.min(1, baseS));

    const emptyChance = isBoss
      ? safeCfg.noSupplyChance.boss
      : Math.max(
          0,
          Math.min(
            1,
            safeCfg.noSupplyChance.mob +
              (1 - s) * safeCfg.sector.maxExtraEmptyChance
          )
        );
    if (rng() < emptyChance) {
      continue;
    }

    const baseTier = getBaseTierForLevel(unit.level, allowedTemplates);
    const offset =
      (unit.side === 'enemy' ? safeCfg.tierOffset[options.difficulty] : 0) +
      (isBoss ? safeCfg.tierOffset.boss : 0) +
      (options.kind === 'event' ? safeCfg.tierOffset.event : 0);
    const targetTier = Math.max(
      1,
      Math.min(maxTemplateTier, Math.round(baseTier + offset))
    );

    let chosenFamilies: NpcSupplyKitFamily[];
    if (isBoss) {
      chosenFamilies = [...availableFamilies];
    } else {
      const weights = getFamilyWeightsForUnit(unit, safeCfg);
      const weightedPool = availableFamilies
        .map((fam) => ({
          family: fam,
          weight: Math.max(0, weights[fam] ?? 0),
        }))
        .filter((e) => e.weight > 0);
      if (weightedPool.length === 0) continue;

      let maxTypes = Math.min(weightedPool.length, safeCfg.typesMax);
      if (unit.archetype === 'drone') {
        maxTypes = Math.min(1, maxTypes);
      }
      const minTypes = Math.min(maxTypes, safeCfg.typesMin);
      const typeCount = rollIntInclusive(minTypes, maxTypes, rng);
      chosenFamilies = pickWeightedFamilies(weightedPool, typeCount, rng);
    }

    const kMult = safeCfg.kindMult[unit.side][options.kind];
    const dMult =
      unit.side === 'enemy' ? safeCfg.diffMult[options.difficulty] : 1;
    const bMult = isBoss ? safeCfg.bossQtyMult : 1;
    const secFactor =
      safeCfg.sector.minQtyFactor + (1 - safeCfg.sector.minQtyFactor) * s;
    const ownsSector =
      (unit.side === 'ally' && options.ownerFaction === 'allied') ||
      (unit.side === 'enemy' && options.ownerFaction === 'hostile');
    const statusMult =
      ownsSector && options.baseStatus
        ? safeCfg.baseStatusMult[options.baseStatus]
        : 1;
    const underdogBonus = underdogBySide[unit.side] ? 1 : 0;

    const unitStock: Record<string, number> = {};
    for (const fam of chosenFamilies) {
      const tpl = pickTemplateForFamilyAndTier(
        allowedTemplates,
        fam,
        targetTier
      );
      if (!tpl) continue;
      const baseQty = rollIntInclusive(safeCfg.qtyMin, safeCfg.qtyMax, rng);
      const rawQty =
        baseQty *
          kMult *
          dMult *
          bMult *
          secFactor *
          statusMult *
          safeEventMult +
        underdogBonus;
      const qty = Math.max(0, Math.min(maxPerType, Math.round(rawQty)));
      if (qty > 0) {
        unitStock[tpl.id] = qty;
      }
    }

    if (Object.keys(unitStock).length > 0) {
      stockByUnit[unit.id] = unitStock;
    }
  }

  return {
    stockByUnit,
    sectorSupply: safeSectorSupply,
    emergencyUsed: { ally: false, enemy: false },
  };
}

export function computeSidePressure(
  units: readonly CombatUnit[],
  side: CombatSide
): number {
  let ownCur = 0;
  let ownMax = 0;
  let otherCur = 0;
  let otherMax = 0;

  for (const unit of units) {
    if (!unit.alive) continue;
    const cur = Math.max(0, unit.hp) + Math.max(0, unit.shield);
    const max =
      Math.max(0, unit.derived.maxHp) + Math.max(0, unit.derived.maxShield);
    if (unit.side === side) {
      ownCur += cur;
      ownMax += max;
    } else {
      otherCur += cur;
      otherMax += max;
    }
  }

  const ownRatio = ownMax > 0 ? ownCur / ownMax : 0;
  const otherRatio = otherMax > 0 ? otherCur / otherMax : 0;
  return ownRatio - otherRatio;
}

function computeUnitSupplyTargetTier(
  unit: Pick<CombatUnit, 'level' | 'side' | 'isBoss'>,
  kind: BattleKind,
  difficulty: SectorDifficulty,
  cfg: NpcSupplyConfig,
  allowedTemplates: readonly SupplyTemplate[]
): number {
  const maxTemplateTier = allowedTemplates.reduce(
    (max, tpl) => Math.max(max, tpl.tier),
    1
  );
  const baseTier = getBaseTierForLevel(unit.level, allowedTemplates);
  const offset =
    (unit.side === 'enemy' ? cfg.tierOffset[difficulty] : 0) +
    (unit.isBoss ? cfg.tierOffset.boss : 0) +
    (kind === 'event' ? cfg.tierOffset.event : 0);
  return Math.max(1, Math.min(maxTemplateTier, Math.round(baseTier + offset)));
}

function pickHighestTierStockTemplate(
  unitStock: Record<string, number>,
  allowedById: ReadonlyMap<string, SupplyTemplate>
): SupplyTemplate | undefined {
  let best: SupplyTemplate | undefined;
  for (const [tplId, qty] of Object.entries(unitStock)) {
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const tpl = allowedById.get(tplId);
    if (!tpl) continue;
    if (!best) {
      best = tpl;
      continue;
    }
    if (tpl.tier !== best.tier) {
      if (tpl.tier > best.tier) best = tpl;
      continue;
    }
    const tplFamIdx = NPC_SUPPLY_FAMILIES.indexOf(
      tpl.family as NpcSupplyKitFamily
    );
    const bestFamIdx = NPC_SUPPLY_FAMILIES.indexOf(
      best.family as NpcSupplyKitFamily
    );
    if (tplFamIdx !== bestFamIdx) {
      if (tplFamIdx >= 0 && (bestFamIdx < 0 || tplFamIdx < bestFamIdx)) {
        best = tpl;
      }
    } else if (tpl.id < best.id) {
      best = tpl;
    }
  }
  return best;
}

export interface RunNpcSupplyStepInput {
  battle: BattleState;
  unitId: string;
  npcCfg?: Partial<NpcSupplyConfig> | Record<string, unknown> | null;
  adminConfig?: AdminConfig | null;
  templates?: readonly SupplyTemplate[];
  rng?: () => number;
}

export interface RunNpcSupplyStepResult {
  battle: BattleState;
  events: BattleEvent[];
}

export function runNpcSupplyStep({
  battle,
  unitId,
  npcCfg,
  adminConfig,
  templates,
}: RunNpcSupplyStepInput): RunNpcSupplyStepResult {
  const safeCfg = sanitizeNpcSupplyConfig(npcCfg ?? adminConfig?.npcSupply);
  if (!safeCfg.enabled || !battle.npcSupply) {
    return { battle, events: [] };
  }

  const activeUnit = battle.units.find((u) => u.id === unitId);
  if (
    !activeUnit ||
    !activeUnit.alive ||
    activeUnit.isPlayer ||
    (activeUnit.isStructure && !activeUnit.isBoss)
  ) {
    return { battle, events: [] };
  }

  const allowedTemplates = filterAutoOrNpcSupplies(
    templates ?? SUPPLY_TEMPLATES
  ).filter((tpl): tpl is SupplyTemplate & { family: NpcSupplyKitFamily } =>
    NPC_SUPPLY_FAMILIES.includes(tpl.family as NpcSupplyKitFamily)
  );
  const allowedById = new Map<string, SupplyTemplate>(
    allowedTemplates.map((t) => [t.id, t])
  );
  const maxPerType = sanitizeSupplyMaxPerTypePerBattle(
    adminConfig?.supplyMaxPerTypePerBattle
  );

  // (a) Tick this unit's supply cooldowns/per-turn count at the start of its own turn
  let workingSupplyByUnit =
    tickBattleSupplyForUnit(battle.supplyByUnit, unitId) ?? battle.supplyByUnit;
  let workingUnits = battle.units;
  const workingStockByUnit: Record<string, Record<string, number>> = {
    ...battle.npcSupply.stockByUnit,
  };
  let workingEmergencyUsed = { ...battle.npcSupply.emergencyUsed };
  let stockChanged = false;
  let emergencyTriggered = false;

  const newLogs: CombatLogEntry[] = [];
  const newPopups: FloatingPopup[] = [];
  const newFxEvents: CombatFxEvent[] = [];
  const events: BattleEvent[] = [];

  // (b) Pressure across alive units on both sides
  const pressure = computeSidePressure(workingUnits, activeUnit.side);

  // ITEM 2: Emergency resupply (before picking, once per side per battle)
  if (
    safeCfg.emergency.enabled &&
    battle.round >= safeCfg.emergency.minRound &&
    pressure <= -safeCfg.emergency.gap &&
    battle.npcSupply.sectorSupply >= safeCfg.emergency.minSectorSupply &&
    !workingEmergencyUsed[activeUnit.side]
  ) {
    const difficulty: SectorDifficulty =
      getSectorById(battle.sectorId)?.difficulty ?? 'Standard';
    for (const unit of workingUnits) {
      if (
        !unit.alive ||
        unit.side !== activeUnit.side ||
        unit.isPlayer ||
        (unit.isStructure && !unit.isBoss)
      ) {
        continue;
      }
      const uStock = { ...(workingStockByUnit[unit.id] ?? {}) };
      const bestExisting = pickHighestTierStockTemplate(uStock, allowedById);
      if (bestExisting) {
        const curQty = Math.max(0, uStock[bestExisting.id] ?? 0);
        const nextQty = Math.min(maxPerType, curQty + 1);
        if (nextQty > 0) {
          uStock[bestExisting.id] = nextQty;
        }
      } else {
        const targetTier = computeUnitSupplyTargetTier(
          unit,
          battle.kind ?? 'patrol',
          difficulty,
          safeCfg,
          allowedTemplates
        );
        const fallbackHpKit = pickTemplateForFamilyAndTier(
          allowedTemplates,
          'hp_kit',
          targetTier
        );
        if (fallbackHpKit) {
          uStock[fallbackHpKit.id] = Math.min(maxPerType, 1);
        }
      }
      if (Object.keys(uStock).length > 0) {
        workingStockByUnit[unit.id] = uStock;
      }
    }
    workingEmergencyUsed = {
      ...workingEmergencyUsed,
      [activeUnit.side]: true,
    };
    stockChanged = true;
    emergencyTriggered = true;
    newLogs.push({
      id: `log_emg_${activeUnit.side}_${battle.round}_${battle.turnCounter}`,
      round: battle.round,
      actorName: activeUnit.name,
      actorSide: activeUnit.side,
      actorIsPlayer: false,
      actorIsBoss: Boolean(activeUnit.isBoss),
      tag: 'SYSTEM',
      templateKey:
        activeUnit.side === 'ally'
          ? 'log.emergencyResupplyAlly'
          : 'log.emergencyResupplyEnemy',
      params: {},
    });
  }

  // (b)-(c) Situation-adjusted thresholds + pickAutoSupplies
  const shift =
    pressure <= -safeCfg.losingGap
      ? safeCfg.losingBonus
      : pressure >= safeCfg.losingGap
      ? -safeCfg.winningCut
      : 0;
  const clampThresh = (val: number) =>
    Math.max(
      AUTO_SUPPLIES_MIN_PCT,
      Math.min(AUTO_SUPPLIES_MAX_PCT, Math.round(val + shift))
    );
  const pickCfg: AutoSuppliesConfig = {
    enabled: true,
    hpBelowPct: clampThresh(safeCfg.thresholds.hp),
    shieldBelowPct: clampThresh(safeCfg.thresholds.shield),
    spBelowPct: clampThresh(safeCfg.thresholds.sp),
    buffAtStart: false,
  };

  const actorStock = { ...(workingStockByUnit[unitId] ?? {}) };
  const loadoutTemplates: SupplyTemplate[] = [];
  for (const [tplId, qty] of Object.entries(actorStock)) {
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const tpl = allowedById.get(tplId);
    if (tpl) loadoutTemplates.push(tpl);
  }

  if (loadoutTemplates.length > 0) {
    const maxPerTurn = sanitizeSupplyUsesPerTurn(adminConfig?.supplyUsesPerTurn);
    const picks = pickAutoSupplies({
      unit: activeUnit,
      loadoutTemplates,
      stockByTemplate: actorStock,
      unitState: workingSupplyByUnit?.[unitId],
      cfg: pickCfg,
      adminCfg: adminConfig,
      kind: battle.kind,
      units: workingUnits,
      battleLimitOverride: maxPerType,
    });

    for (let i = 0; i < picks.length && i < maxPerTurn; i++) {
      const tpl = allowedById.get(picks[i]);
      if (!tpl) continue;
      const curStock = actorStock[tpl.id] ?? 0;
      if (curStock <= 0) continue;

      const useResult = applyBattleSupplyUse({
        units: workingUnits,
        supplyByUnit: workingSupplyByUnit,
        unitId,
        template: tpl,
        stock: curStock,
        isOwnTurn: true,
        cfg: adminConfig,
        kind: battle.kind,
        battleLimitOverride: maxPerType,
      });
      if (!useResult.ok) continue;

      workingUnits = useResult.units;
      workingSupplyByUnit = useResult.supplyByUnit;
      const nextQty = curStock - 1;
      if (nextQty > 0) {
        actorStock[tpl.id] = nextQty;
      } else {
        delete actorStock[tpl.id];
      }
      stockChanged = true;

      const uidSuffix = `npc_${battle.round}_${battle.turnCounter}_${unitId}_${i}`;
      const actorRef =
        workingUnits.find((u) => u.id === unitId) ?? activeUnit;
      const feedback = buildSupplyUseFeedback({
        units: workingUnits,
        round: battle.round,
        actor: actorRef,
        template: tpl,
        result: useResult,
        uidSuffix,
      });
      newLogs.push(feedback.logEntry);
      newPopups.push(...feedback.popups);
      newFxEvents.push(feedback.fxEvent);

      if (useResult.gains.hp > 0) {
        events.push({
          id: `evt_sup_hp_${uidSuffix}`,
          round: battle.round,
          turn: battle.turnCounter,
          actorId: unitId,
          targetId: unitId,
          type: 'heal',
          amount: useResult.gains.hp,
        });
      }
      if (useResult.gains.shield > 0) {
        events.push({
          id: `evt_sup_shd_${uidSuffix}`,
          round: battle.round,
          turn: battle.turnCounter,
          actorId: unitId,
          targetId: unitId,
          type: 'shield_grant',
          amount: useResult.gains.shield,
        });
      }
    }

    if (stockChanged) {
      if (Object.keys(actorStock).length > 0) {
        workingStockByUnit[unitId] = actorStock;
      } else {
        delete workingStockByUnit[unitId];
      }
    }
  }

  const supplyStateChanged = workingSupplyByUnit !== battle.supplyByUnit;
  if (!supplyStateChanged && !stockChanged && !emergencyTriggered) {
    return { battle, events: [] };
  }

  const nextBattle: BattleState = {
    ...battle,
    units: workingUnits,
    ...(workingSupplyByUnit !== undefined
      ? { supplyByUnit: workingSupplyByUnit }
      : {}),
    npcSupply: stockChanged || emergencyTriggered
      ? {
          ...battle.npcSupply,
          stockByUnit: workingStockByUnit,
          emergencyUsed: workingEmergencyUsed,
        }
      : battle.npcSupply,
    log: newLogs.length > 0 ? [...battle.log, ...newLogs] : battle.log,
    popups:
      newPopups.length > 0
        ? [...battle.popups, ...newPopups].slice(-18)
        : battle.popups,
    fxEvents:
      newFxEvents.length > 0
        ? [...battle.fxEvents, ...newFxEvents].slice(-12)
        : battle.fxEvents,
  };

  return {
    battle: nextBattle,
    events,
  };
}
