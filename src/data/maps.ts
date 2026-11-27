import type {
  BaseFaction,
  BaseNpcRole,
  BaseRuntimeState,
  BaseTokenShape,
  BaseType,
  BattleSize,
  GarrisonShipSpec,
  MapBaseTypeMeta,
  MapInitialRaid,
  MapLaneDefinition,
  MapPackDefinition,
  MechClassId,
  SectorDefinition,
  SectorDifficulty,
} from '../types/game';
import rawMapData from './maps.json';

const BASE_TYPES: readonly BaseType[] = [
  'outpost',
  'colony',
  'relay',
  'fortress',
  'shipyard',
  'capital',
];
const VALID_BASE_TYPE_SET = new Set<string>(BASE_TYPES);
const VALID_TOKEN_SHAPE_SET = new Set<string>(['round', 'square']);
const VALID_FACTION_SET = new Set<string>(['allied', 'hostile', 'neutral']);
const VALID_DIFFICULTY_SET = new Set<string>(['Standard', 'Hard', 'Elite']);
const VALID_BATTLE_SIZE_SET = new Set<number>([4, 6, 8]);
const VALID_CLASS_SET = new Set<string>([
  'striker',
  'interceptor',
  'siege',
  'support',
]);
const VALID_NPC_SET = new Set<string>([
  'quartermaster',
  'mission_officer',
  'pilot_for_hire',
  'engineer',
]);

const DEFAULT_BASE_TYPE_META: Record<BaseType, MapBaseTypeMeta> = {
  outpost: { battleSize: 4, tokenShape: 'round' },
  colony: { battleSize: 4, tokenShape: 'round' },
  relay: { battleSize: 4, tokenShape: 'round' },
  fortress: { battleSize: 6, tokenShape: 'square' },
  shipyard: { battleSize: 6, tokenShape: 'square' },
  capital: { battleSize: 8, tokenShape: 'square' },
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const isNonEmptyStr = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

function parseGarrisonList(raw: unknown): GarrisonShipSpec[] | null {
  if (!Array.isArray(raw)) return null;
  const out: GarrisonShipSpec[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) return null;
    if (typeof item.classId !== 'string' || !VALID_CLASS_SET.has(item.classId)) {
      return null;
    }
    if (
      typeof item.count !== 'number' ||
      !Number.isInteger(item.count) ||
      item.count < 0
    ) {
      return null;
    }
    if (item.isBoss !== undefined && typeof item.isBoss !== 'boolean') {
      return null;
    }
    if (item.isStructure !== undefined && typeof item.isStructure !== 'boolean') {
      return null;
    }
    out.push({
      classId: item.classId as MechClassId,
      count: item.count,
      ...(item.isBoss !== undefined ? { isBoss: item.isBoss } : {}),
      ...(item.isStructure !== undefined
        ? { isStructure: item.isStructure }
        : {}),
    });
  }
  return out;
}

export interface MapPackValidationResult {
  pack: MapPackDefinition | null;
  errors: string[];
}

export function validateMapPackDetailed(
  raw: unknown
): MapPackValidationResult {
  const errors: string[] = [];
  const fail = (msg: string): MapPackValidationResult => {
    errors.push(msg);
    console.warn(msg);
    return { pack: null, errors };
  };

  if (!isPlainObject(raw)) {
    return fail('[maps] Invalid map pack root; expected plain object.');
  }

  if (
    typeof raw.schemaVersion !== 'number' ||
    !Number.isInteger(raw.schemaVersion) ||
    raw.schemaVersion < 1
  ) {
    return fail('[maps] Invalid or missing schemaVersion.');
  }
  if (!isNonEmptyStr(raw.mapId) || !isNonEmptyStr(raw.nameVi) || !isNonEmptyStr(raw.nameEn)) {
    return fail('[maps] Missing mapId / nameVi / nameEn.');
  }

  if (!isPlainObject(raw.bounds)) {
    return fail('[maps] Missing map bounds.');
  }
  const width = raw.bounds.width;
  const height = raw.bounds.height;
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return fail('[maps] Invalid map bounds dimensions.');
  }

  if (!isNonEmptyStr(raw.defaultSelectedNodeId)) {
    return fail('[maps] Missing defaultSelectedNodeId.');
  }

  if (!isPlainObject(raw.baseTypes)) {
    return fail('[maps] Missing baseTypes table.');
  }
  const baseTypes = {} as Record<BaseType, MapBaseTypeMeta>;
  for (const bt of BASE_TYPES) {
    const rawMeta = raw.baseTypes[bt];
    if (!isPlainObject(rawMeta)) {
      return fail(`[maps] Missing baseTypes.${bt} metadata.`);
    }
    if (
      typeof rawMeta.battleSize !== 'number' ||
      !VALID_BATTLE_SIZE_SET.has(rawMeta.battleSize) ||
      typeof rawMeta.tokenShape !== 'string' ||
      !VALID_TOKEN_SHAPE_SET.has(rawMeta.tokenShape)
    ) {
      return fail(`[maps] Invalid baseTypes.${bt} metadata.`);
    }
    baseTypes[bt] = {
      battleSize: rawMeta.battleSize as BattleSize,
      tokenShape: rawMeta.tokenShape as BaseTokenShape,
    };
  }

  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.lanes)) {
    return fail('[maps] Map pack must include nodes[] and lanes[].');
  }

  const seenNodeIds = new Set<string>();
  const droppedNodes: string[] = [];
  const validNodes: SectorDefinition[] = [];

  raw.nodes.forEach((entry, idx) => {
    const r = isPlainObject(entry) ? entry : null;
    const label = r && isNonEmptyStr(r.id) ? r.id : `#${idx}`;
    const pos = r && isPlainObject(r.mapPos) ? r.mapPos : null;
    const alliedGarrison = r ? parseGarrisonList(r.alliedGarrison) : null;
    const hostileGarrison = r ? parseGarrisonList(r.hostileGarrison) : null;

    const ok =
      r !== null &&
      isNonEmptyStr(r.id) &&
      !seenNodeIds.has(r.id) &&
      isNonEmptyStr(r.name) &&
      isNonEmptyStr(r.regionCode) &&
      isNonEmptyStr(r.description) &&
      typeof r.baseType === 'string' &&
      VALID_BASE_TYPE_SET.has(r.baseType) &&
      typeof r.tokenShape === 'string' &&
      VALID_TOKEN_SHAPE_SET.has(r.tokenShape) &&
      typeof r.baseLevel === 'number' &&
      Number.isInteger(r.baseLevel) &&
      r.baseLevel >= 1 &&
      typeof r.initialFaction === 'string' &&
      VALID_FACTION_SET.has(r.initialFaction) &&
      pos !== null &&
      typeof pos.x === 'number' &&
      typeof pos.y === 'number' &&
      Number.isFinite(pos.x) &&
      Number.isFinite(pos.y) &&
      pos.x >= 0 &&
      pos.x <= width &&
      pos.y >= 0 &&
      pos.y <= height &&
      typeof r.difficulty === 'string' &&
      VALID_DIFFICULTY_SET.has(r.difficulty) &&
      typeof r.levelOffset === 'number' &&
      Number.isFinite(r.levelOffset) &&
      typeof r.squadSize === 'number' &&
      VALID_BATTLE_SIZE_SET.has(r.squadSize) &&
      typeof r.enemyCount === 'number' &&
      VALID_BATTLE_SIZE_SET.has(r.enemyCount) &&
      typeof r.hasBoss === 'boolean' &&
      typeof r.expMultiplier === 'number' &&
      Number.isFinite(r.expMultiplier) &&
      r.expMultiplier > 0 &&
      typeof r.creditsMultiplier === 'number' &&
      Number.isFinite(r.creditsMultiplier) &&
      r.creditsMultiplier > 0 &&
      typeof r.monthlyCredits === 'number' &&
      Number.isFinite(r.monthlyCredits) &&
      r.monthlyCredits >= 0 &&
      typeof r.monthlyWarPoints === 'number' &&
      Number.isFinite(r.monthlyWarPoints) &&
      r.monthlyWarPoints >= 0 &&
      typeof r.repairCost === 'number' &&
      Number.isFinite(r.repairCost) &&
      r.repairCost >= 0 &&
      (r.repairMonths === 1 || r.repairMonths === 2) &&
      Array.isArray(r.npcs) &&
      r.npcs.every((npc) => typeof npc === 'string' && VALID_NPC_SET.has(npc)) &&
      alliedGarrison !== null &&
      hostileGarrison !== null;

    if (!ok || !r || !pos || !alliedGarrison || !hostileGarrison) {
      droppedNodes.push(label);
      return;
    }

    const id = r.id as string;
    seenNodeIds.add(id);
    validNodes.push({
      id,
      name: r.name as string,
      regionCode: r.regionCode as string,
      baseType: r.baseType as BaseType,
      tokenShape: r.tokenShape as BaseTokenShape,
      baseLevel: r.baseLevel as number,
      initialFaction: r.initialFaction as BaseFaction,
      mapPos: { x: pos.x as number, y: pos.y as number },
      difficulty: r.difficulty as SectorDifficulty,
      levelOffset: r.levelOffset as number,
      squadSize: r.squadSize as BattleSize,
      enemyCount: r.enemyCount as number,
      hasBoss: r.hasBoss as boolean,
      expMultiplier: r.expMultiplier as number,
      creditsMultiplier: r.creditsMultiplier as number,
      monthlyCredits: r.monthlyCredits as number,
      monthlyWarPoints: r.monthlyWarPoints as number,
      repairCost: r.repairCost as number,
      repairMonths: r.repairMonths as 1 | 2,
      npcs: [...(r.npcs as BaseNpcRole[])],
      alliedGarrison,
      hostileGarrison,
      description: r.description as string,
    });
  });

  if (droppedNodes.length > 0) {
    const msg = `[maps] Dropped ${droppedNodes.length} invalid map node(s): ${droppedNodes.join(', ')}`;
    errors.push(msg);
    console.warn(msg);
  }

  if (validNodes.length === 0) {
    return fail('[maps] Map pack has no valid nodes.');
  }

  if (!validNodes.some((n) => n.initialFaction === 'allied')) {
    return fail('[maps] Map pack must contain at least 1 allied node.');
  }

  if (!seenNodeIds.has(raw.defaultSelectedNodeId)) {
    return fail(
      `[maps] defaultSelectedNodeId "${raw.defaultSelectedNodeId}" does not match any valid node.`
    );
  }

  const seenLaneIds = new Set<string>();
  const seenEdgeKeys = new Set<string>();
  const droppedLanes: string[] = [];
  const validLanes: MapLaneDefinition[] = [];

  raw.lanes.forEach((entry, idx) => {
    const r = isPlainObject(entry) ? entry : null;
    const label = r && isNonEmptyStr(r.id) ? r.id : `#${idx}`;
    const from = r && isNonEmptyStr(r.from) ? r.from : '';
    const to = r && isNonEmptyStr(r.to) ? r.to : '';
    const edgeKey = from < to ? `${from}::${to}` : `${to}::${from}`;

    const ok =
      r !== null &&
      isNonEmptyStr(r.id) &&
      !seenLaneIds.has(r.id) &&
      from.length > 0 &&
      to.length > 0 &&
      from !== to &&
      seenNodeIds.has(from) &&
      seenNodeIds.has(to) &&
      !seenEdgeKeys.has(edgeKey);

    if (!ok || !r) {
      droppedLanes.push(label);
      return;
    }

    seenLaneIds.add(r.id as string);
    seenEdgeKeys.add(edgeKey);
    validLanes.push({
      id: r.id as string,
      from,
      to,
    });
  });

  if (droppedLanes.length > 0) {
    const msg = `[maps] Dropped ${droppedLanes.length} invalid map lane(s): ${droppedLanes.join(', ')}`;
    errors.push(msg);
    console.warn(msg);
  }

  // Whole-map connectivity check (undirected BFS)
  if (validNodes.length > 1) {
    const adj = new Map<string, string[]>();
    for (const n of validNodes) adj.set(n.id, []);
    for (const lane of validLanes) {
      adj.get(lane.from)?.push(lane.to);
      adj.get(lane.to)?.push(lane.from);
    }
    const visited = new Set<string>();
    const queue: string[] = [validNodes[0].id];
    visited.add(validNodes[0].id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (visited.size !== validNodes.length) {
      return fail(
        `[maps] Map graph is disconnected (${visited.size}/${validNodes.length} reachable nodes).`
      );
    }
  }

  let initialRaid: MapInitialRaid | null = null;
  if (raw.initialRaid !== undefined && raw.initialRaid !== null) {
    if (!isPlainObject(raw.initialRaid)) {
      return fail('[maps] Invalid initialRaid object.');
    }
    const r = raw.initialRaid;
    if (
      !isNonEmptyStr(r.target) ||
      !isNonEmptyStr(r.from) ||
      !seenNodeIds.has(r.target) ||
      !seenNodeIds.has(r.from) ||
      r.target === r.from ||
      typeof r.months !== 'number' ||
      !Number.isInteger(r.months) ||
      r.months < 1
    ) {
      return fail('[maps] Invalid initialRaid target/from/months.');
    }
    initialRaid = {
      target: r.target,
      from: r.from,
      months: r.months,
    };
  }

  return {
    pack: {
      schemaVersion: raw.schemaVersion,
      mapId: raw.mapId.trim(),
      nameVi: raw.nameVi,
      nameEn: raw.nameEn,
      bounds: { width, height },
      defaultSelectedNodeId: raw.defaultSelectedNodeId,
      initialRaid,
      baseTypes,
      nodes: validNodes,
      lanes: validLanes,
    },
    errors,
  };
}

export function validateMapPack(raw: unknown): MapPackDefinition | null {
  return validateMapPackDetailed(raw).pack;
}

export function sanitizeMapPack(raw: unknown): MapPackDefinition | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  return validateMapPack(raw);
}

const VALIDATED_MAP_PACK: MapPackDefinition = (() => {
  const pack = validateMapPack(rawMapData);
  if (!pack) {
    throw new Error('[maps] Built-in maps.json failed validateMapPack().');
  }
  return pack;
})();

let activeMapPack: MapPackDefinition = VALIDATED_MAP_PACK;

export const SECTORS_CATALOG: SectorDefinition[] = [...VALIDATED_MAP_PACK.nodes];

export const MAP_LANES: MapLaneDefinition[] = [...VALIDATED_MAP_PACK.lanes];

function syncCatalogArraysInPlace(pack: MapPackDefinition): void {
  SECTORS_CATALOG.length = 0;
  SECTORS_CATALOG.push(...pack.nodes);
  MAP_LANES.length = 0;
  MAP_LANES.push(...pack.lanes);
}

export function getBuiltInMapPack(): MapPackDefinition {
  return VALIDATED_MAP_PACK;
}

export function isUsingCustomMapPack(): boolean {
  return activeMapPack !== VALIDATED_MAP_PACK;
}

export function setActiveMapPack(
  rawOrPack: MapPackDefinition | null | undefined
): MapPackDefinition {
  if (rawOrPack === null || rawOrPack === undefined) {
    activeMapPack = VALIDATED_MAP_PACK;
    syncCatalogArraysInPlace(activeMapPack);
    return activeMapPack;
  }
  const validated = validateMapPack(rawOrPack);
  activeMapPack = validated ?? VALIDATED_MAP_PACK;
  syncCatalogArraysInPlace(activeMapPack);
  return activeMapPack;
}

export function getActiveMap(): MapPackDefinition {
  return activeMapPack;
}

export function getMapNodes(): SectorDefinition[] {
  return SECTORS_CATALOG;
}

export function getMapLanes(): MapLaneDefinition[] {
  return MAP_LANES;
}

export function getMapNodeById(sectorId: string): SectorDefinition | undefined {
  return SECTORS_CATALOG.find((s) => s.id === sectorId);
}

export function getDefaultSelectedNodeId(): string {
  return activeMapPack.defaultSelectedNodeId;
}

export function getFirstAlliedNodeId(): string {
  return (
    activeMapPack.nodes.find((s) => s.initialFaction === 'allied')?.id ??
    activeMapPack.defaultSelectedNodeId
  );
}

/**
 * Canonical battle size by base type (sourced from active map pack baseTypes).
 */
export function getBattleSizeForBaseType(baseType: BaseType): BattleSize {
  return (
    activeMapPack.baseTypes[baseType]?.battleSize ??
    DEFAULT_BASE_TYPE_META[baseType]?.battleSize ??
    4
  );
}

export function getTokenShapeForBaseType(baseType: BaseType): BaseTokenShape {
  return (
    activeMapPack.baseTypes[baseType]?.tokenShape ??
    DEFAULT_BASE_TYPE_META[baseType]?.tokenShape ??
    'round'
  );
}

export function createInitialBaseStates(): Record<string, BaseRuntimeState> {
  const map = getActiveMap();
  const raid = map.initialRaid;
  const states: Record<string, BaseRuntimeState> = {};
  for (const sector of map.nodes) {
    const isRaidTarget = Boolean(raid && sector.id === raid.target);
    states[sector.id] = {
      faction: sector.initialFaction,
      status: 'operational',
      repairMonthsRemaining: 0,
      underAttack: isRaidTarget,
      attackCountdownMonths: isRaidTarget && raid ? raid.months : 0,
      attackFromSectorId: isRaidTarget && raid ? raid.from : null,
    };
  }
  return states;
}

export function getSectorById(sectorId: string): SectorDefinition {
  return getMapNodeById(sectorId) ?? getMapNodes()[0];
}

/**
 * @deprecated Replaced by cumulative visible-node frontline tracking in `src/engine/frontline.ts`.
 * Kept exported for backwards-compatibility only.
 */
export function getNextSectorId(currentSectorId: string): string | null {
  const campaignChain = getMapNodes()
    .filter((n) => n.initialFaction !== 'allied')
    .map((n) => n.id);
  const idx = campaignChain.indexOf(currentSectorId);
  if (idx === -1 || idx + 1 >= campaignChain.length) return null;
  return campaignChain[idx + 1];
}
