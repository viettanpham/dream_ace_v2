import { SUPPLY_TEMPLATES } from '../data/consumables';
import rawNpcSupplyData from '../data/npcSupply.json';
import type {
  BaseFaction,
  BaseStatus,
  BattleKind,
  BattleNpcSupplyState,
  CombatSide,
  CombatUnit,
  EnemyArchetype,
  NpcSupplyConfig,
  NpcSupplyKitFamily,
  SectorDifficulty,
  SupplyTemplate,
} from '../types/game';
import { filterAutoOrNpcSupplies } from './supplies';

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
