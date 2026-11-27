import { getBuiltInMapPack, validateMapPack } from '../data/maps';
import type {
  BaseFaction,
  BaseType,
  Language,
  MapBounds,
  MapLaneDefinition,
  MapPackDefinition,
  SectorDefinition,
} from '../types/game';

export const MIN_GENERATED_BASES = 12;
export const MAX_GENERATED_BASES = 50;
export const DEFAULT_GENERATED_BASES = 20;

export interface GenerateMapPackOptions {
  nodeCount: number;
  seed: string;
  lang?: Language;
}

function hashSeed(seedText: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(initialSeed: number): () => number {
  let a = initialSeed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clampGeneratedNodeCount(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_GENERATED_BASES;
  return Math.max(
    MIN_GENERATED_BASES,
    Math.min(MAX_GENERATED_BASES, Math.round(raw))
  );
}

export function normalizeSeedText(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'KESTREL';
}

export function computeGeneratedMapBounds(nodeCount: number): MapBounds {
  const count = clampGeneratedNodeCount(nodeCount);
  const scale = Math.sqrt(count / 6);
  return {
    width: Math.round(840 * scale),
    height: Math.round(310 * scale),
  };
}

interface Pt {
  x: number;
  y: number;
}

function distSq(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function dist(a: Pt, b: Pt): number {
  return Math.sqrt(distSq(a, b));
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Pt, b: Pt, p: Pt): boolean {
  return (
    Math.abs(orient(a, b, p)) < 1e-6 &&
    p.x >= Math.min(a.x, b.x) - 1e-6 &&
    p.x <= Math.max(a.x, b.x) + 1e-6 &&
    p.y >= Math.min(a.y, b.y) - 1e-6 &&
    p.y <= Math.max(a.y, b.y) + 1e-6
  );
}

function pointToSegmentDist(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 1e-9) return dist(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq)
  );
  const projX = a.x + t * abx;
  const projY = a.y + t * aby;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Checks whether segment (a, b) intersects or overlaps segment (c, d).
 * Shared endpoints are allowed ONLY if the two segments do not overlap collinearly.
 */
export function doSegmentsCross(
  a: Pt,
  b: Pt,
  c: Pt,
  d: Pt,
  shareAOrB: boolean
): boolean {
  if (shareAOrB) {
    // Check if collinearly overlapping from the shared endpoint
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    if (Math.abs(o1) < 1e-6 && Math.abs(o2) < 1e-6) {
      // Same line: overlap iff non-shared endpoint projects onto the other segment
      const overlap =
        (onSegment(a, b, c) && !(c.x === a.x && c.y === a.y) && !(c.x === b.x && c.y === b.y)) ||
        (onSegment(a, b, d) && !(d.x === a.x && d.y === a.y) && !(d.x === b.x && d.y === b.y)) ||
        (onSegment(c, d, a) && !(a.x === c.x && a.y === c.y) && !(a.x === d.x && a.y === d.y)) ||
        (onSegment(c, d, b) && !(b.x === c.x && b.y === c.y) && !(b.x === d.x && b.y === d.y));
      return overlap;
    }
    return false;
  }

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  if (
    ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
    ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))
  ) {
    return true;
  }

  if (onSegment(a, b, c)) return true;
  if (onSegment(a, b, d)) return true;
  if (onSegment(c, d, a)) return true;
  if (onSegment(c, d, b)) return true;

  return false;
}

export function generateMapPack(
  opts: GenerateMapPackOptions
): MapPackDefinition {
  const count = clampGeneratedNodeCount(opts.nodeCount);
  const cleanSeed = normalizeSeedText(opts.seed);
  const lang: Language = opts.lang === 'en' ? 'en' : 'vi';
  const rng = mulberry32(hashSeed(`${cleanSeed}::${count}`));
  const bounds = computeGeneratedMapBounds(count);

  const builtIn = getBuiltInMapPack();
  const tplByType = new Map<BaseType, SectorDefinition>();
  for (const node of builtIn.nodes) {
    if (!tplByType.has(node.baseType)) {
      tplByType.set(node.baseType, node);
    }
  }

  // 1. Place 'start' on the left edge, and remaining N-1 nodes in a jittered grid
  const padX = 65;
  const padY = 48;
  const startPos: Pt = {
    x: Math.round(padX + rng() * 14),
    y: Math.round(bounds.height * (0.4 + rng() * 0.2)),
  };

  const xMin = padX + 95;
  const xMax = bounds.width - padX;
  const yMin = padY;
  const yMax = bounds.height - padY;
  const innerW = Math.max(120, xMax - xMin);
  const innerH = Math.max(100, yMax - yMin);
  const aspect = innerW / innerH;

  const restCount = count - 1;
  let rows = Math.max(2, Math.round(Math.sqrt(restCount / aspect)));
  let cols = Math.ceil(restCount / rows);
  while (cols * rows < restCount) {
    cols += 1;
  }

  const cells: Array<{ c: number; r: number }> = [];
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      cells.push({ c, r });
    }
  }
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const cellW = innerW / cols;
  const cellH = innerH / rows;
  const positions: Pt[] = [startPos];
  for (let i = 0; i < restCount; i += 1) {
    const cell = cells[i];
    const rawX = xMin + (cell.c + 0.22 + rng() * 0.56) * cellW;
    const rawY = yMin + (cell.r + 0.22 + rng() * 0.56) * cellH;
    positions.push({
      x: Math.max(padX, Math.min(bounds.width - padX, Math.round(rawX))),
      y: Math.max(padY, Math.min(bounds.height - padY, Math.round(rawY))),
    });
  }

  // 2. Build connected, non-crossing planar graph with 2-3 nearest-neighbour lanes
  const edges: Array<[number, number]> = [];
  const adjIdx: number[][] = Array.from({ length: count }, () => []);
  const edgeKeys = new Set<string>();

  const hasEdge = (u: number, v: number): boolean => {
    const key = u < v ? `${u}:${v}` : `${v}:${u}`;
    return edgeKeys.has(key);
  };

  const canAddEdge = (
    u: number,
    v: number,
    minNodeClearance: number
  ): boolean => {
    if (u === v || hasEdge(u, v)) return false;
    const pu = positions[u];
    const pv = positions[v];

    for (const [a, b] of edges) {
      const share = a === u || a === v || b === u || b === v;
      if (doSegmentsCross(pu, pv, positions[a], positions[b], share)) {
        return false;
      }
    }

    if (minNodeClearance > 0) {
      for (let k = 0; k < count; k += 1) {
        if (k === u || k === v) continue;
        if (pointToSegmentDist(positions[k], pu, pv) < minNodeClearance) {
          return false;
        }
      }
    }
    return true;
  };

  const addEdge = (u: number, v: number) => {
    const key = u < v ? `${u}:${v}` : `${v}:${u}`;
    edgeKeys.add(key);
    edges.push([u, v]);
    adjIdx[u].push(v);
    adjIdx[v].push(u);
  };

  // All pairs sorted by Euclidean distance
  const pairs: Array<{ u: number; v: number; d: number }> = [];
  for (let u = 0; u < count; u += 1) {
    for (let v = u + 1; v < count; v += 1) {
      pairs.push({ u, v, d: distSq(positions[u], positions[v]) });
    }
  }
  pairs.sort((a, b) => a.d - b.d);

  // Union-Find for spanning tree (Pass 1)
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const nx = parent[x];
      parent[x] = r;
      x = nx;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (const p of pairs) {
    if (find(p.u) !== find(p.v) && canAddEdge(p.u, p.v, 14)) {
      addEdge(p.u, p.v);
      union(p.u, p.v);
    }
  }
  // Fallback connectivity pass without clearance threshold (only non-crossing)
  for (const p of pairs) {
    if (find(p.u) !== find(p.v) && canAddEdge(p.u, p.v, 0)) {
      addEdge(p.u, p.v);
      union(p.u, p.v);
    }
  }

  // Pass 2a: ensure start (node 0) has 2-3 neighbours
  const startTargetDeg = rng() < 0.45 ? 2 : 3;
  const startNeighborsSorted = Array.from({ length: count - 1 }, (_, i) => i + 1).sort(
    (a, b) => distSq(positions[0], positions[a]) - distSq(positions[0], positions[b])
  );
  for (const clearance of [14, 0]) {
    if (adjIdx[0].length >= startTargetDeg) break;
    for (const nb of startNeighborsSorted) {
      if (adjIdx[0].length >= startTargetDeg) break;
      if (canAddEdge(0, nb, clearance)) {
        addEdge(0, nb);
      }
    }
  }

  // Pass 2b: augment remaining nodes toward 2-3 nearest non-crossing neighbours
  for (let u = 1; u < count; u += 1) {
    const targetDeg = rng() < 0.55 ? 2 : 3;
    if (adjIdx[u].length >= targetDeg) continue;

    const nearest = Array.from({ length: count }, (_, v) => v)
      .filter((v) => v !== u && v !== 0)
      .sort(
        (a, b) =>
          distSq(positions[u], positions[a]) - distSq(positions[u], positions[b])
      )
      .slice(0, Math.min(8, count - 1));

    // Prefer targets with degree < 4 first, then relax
    for (const maxOtherDeg of [3, 4]) {
      if (adjIdx[u].length >= targetDeg) break;
      for (const v of nearest) {
        if (adjIdx[u].length >= targetDeg) break;
        if (adjIdx[v].length > maxOtherDeg) continue;
        if (canAddEdge(u, v, 14)) {
          addEdge(u, v);
        }
      }
    }
  }

  // 3. BFS hop distances from start (node 0)
  const hops = new Array<number>(count).fill(999);
  hops[0] = 0;
  const bfsQueue: number[] = [0];
  while (bfsQueue.length > 0) {
    const cur = bfsQueue.shift()!;
    for (const next of adjIdx[cur]) {
      if (hops[next] > hops[cur] + 1) {
        hops[next] = hops[cur] + 1;
        bfsQueue.push(next);
      }
    }
  }
  const maxHop = Math.max(1, ...hops);

  // Order non-start nodes cleanly by (hop, x, y) for gen_01.. ids
  const sortedIndices = Array.from({ length: count }, (_, i) => i).sort((a, b) => {
    if (a === 0) return -1;
    if (b === 0) return 1;
    if (hops[a] !== hops[b]) return hops[a] - hops[b];
    if (positions[a].x !== positions[b].x) return positions[a].x - positions[b].x;
    return positions[a].y - positions[b].y;
  });

  const nodeIdByOrigIdx = new Array<string>(count);
  const displayNumberByOrigIdx = new Array<number>(count);
  sortedIndices.forEach((origIdx, orderPos) => {
    displayNumberByOrigIdx[origIdx] = orderPos + 1;
    if (origIdx === 0) {
      nodeIdByOrigIdx[origIdx] = 'start';
    } else {
      nodeIdByOrigIdx[origIdx] = `gen_${String(orderPos).padStart(2, '0')}`;
    }
  });

  // 4. Select 1-3 far capital nodes scaled with count
  const capitalCount = count >= 36 ? 3 : count >= 22 ? 2 : 1;
  const capitalSet = new Set<number>(
    sortedIndices
      .filter((idx) => idx !== 0 && hops[idx] >= 2)
      .sort((a, b) => {
        if (hops[b] !== hops[a]) return hops[b] - hops[a];
        return positions[b].x - positions[a].x;
      })
      .slice(0, capitalCount)
  );

  // 5. Assign factions: start = allied, start's neighbours = contested (1+ hostile, rest hostile/neutral)
  const factions = new Array<BaseFaction>(count);
  factions[0] = 'allied';

  const startNeighbours = [...adjIdx[0]];
  let firstHostileNeighbourIdx: number | null = null;
  startNeighbours.forEach((nbIdx, idx) => {
    if (idx === 0) {
      factions[nbIdx] = 'hostile';
      firstHostileNeighbourIdx = nbIdx;
    } else {
      factions[nbIdx] = rng() < 0.5 ? 'neutral' : 'hostile';
      if (factions[nbIdx] === 'hostile' && firstHostileNeighbourIdx === null) {
        firstHostileNeighbourIdx = nbIdx;
      }
    }
  });

  for (let i = 1; i < count; i += 1) {
    if (factions[i]) continue;
    if (capitalSet.has(i)) {
      factions[i] = 'hostile';
    } else {
      factions[i] = rng() < 0.25 ? 'neutral' : 'hostile';
    }
  }

  // 6. Build SectorDefinition entries
  const maxCapitalLevel = Math.min(
    14,
    Math.max(10, Math.round(10 + ((count - 12) / 38) * 4))
  );
  const capitalRank = new Map<number, number>();
  let capIdxCounter = 0;
  for (const idx of Array.from(capitalSet)) {
    capitalRank.set(idx, capIdxCounter++);
  }

  const nodes: SectorDefinition[] = sortedIndices.map((origIdx) => {
    const hop = hops[origIdx];
    const rel = maxHop > 1 ? hop / maxHop : 1;
    let baseType: BaseType;
    let baseLevel: number;

    if (origIdx === 0) {
      baseType = 'relay';
      baseLevel = 1;
    } else if (capitalSet.has(origIdx)) {
      baseType = 'capital';
      const rank = capitalRank.get(origIdx) ?? 0;
      baseLevel = Math.min(14, Math.max(10, maxCapitalLevel - rank));
    } else if (hop === 1 || rel <= 0.42) {
      const nearPool: BaseType[] =
        hop === 1
          ? ['outpost', 'colony', 'outpost', 'relay']
          : ['outpost', 'colony', 'relay'];
      baseType = nearPool[Math.floor(rng() * nearPool.length)];
      baseLevel = Math.max(
        1,
        Math.min(4, Math.round(1 + rel * 5 + (hop > 1 && rng() < 0.5 ? 1 : 0)))
      );
    } else {
      const midPool: BaseType[] = ['fortress', 'shipyard'];
      baseType = midPool[Math.floor(rng() * midPool.length)];
      baseLevel = Math.max(
        5,
        Math.min(9, Math.round(4 + rel * 4.5 + (rng() < 0.4 ? 1 : 0)))
      );
    }

    const tpl = tplByType.get(baseType) ?? builtIn.nodes[0];
    const typeMeta = builtIn.baseTypes[baseType];
    const ratio = baseLevel / Math.max(1, tpl.baseLevel);
    const num = displayNumberByOrigIdx[origIdx];
    const regionCode = `Sector ${String(num).padStart(2, '0')}`;
    const name = lang === 'en' ? `Base ${num}` : `Căn cứ ${num}`;

    return {
      id: nodeIdByOrigIdx[origIdx],
      name,
      regionCode,
      baseType,
      tokenShape: typeMeta.tokenShape,
      baseLevel,
      initialFaction: factions[origIdx],
      mapPos: positions[origIdx],
      difficulty: tpl.difficulty,
      levelOffset: tpl.levelOffset,
      squadSize: typeMeta.battleSize,
      enemyCount: tpl.enemyCount,
      hasBoss: tpl.hasBoss,
      expMultiplier: Number((tpl.expMultiplier * (0.9 + 0.1 * ratio)).toFixed(2)),
      creditsMultiplier: Number(
        (tpl.creditsMultiplier * (0.9 + 0.1 * ratio)).toFixed(2)
      ),
      monthlyCredits: Math.round(tpl.monthlyCredits * (0.75 + 0.25 * ratio)),
      monthlyWarPoints: Math.round(tpl.monthlyWarPoints * (0.75 + 0.25 * ratio)),
      repairCost: Math.round(tpl.repairCost * (0.75 + 0.25 * ratio)),
      repairMonths: tpl.repairMonths,
      npcs: [...tpl.npcs],
      alliedGarrison: tpl.alliedGarrison.map((g) => ({ ...g })),
      hostileGarrison: tpl.hostileGarrison.map((g) => ({ ...g })),
      description: tpl.description,
    };
  });

  const lanes: MapLaneDefinition[] = edges.map(([u, v]) => {
    const fromId = nodeIdByOrigIdx[u];
    const toId = nodeIdByOrigIdx[v];
    return {
      id: `lane_${fromId}_${toId}`,
      from: fromId,
      to: toId,
    };
  });

  const slug = cleanSeed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);

  const rawPack: MapPackDefinition = {
    schemaVersion: 1,
    mapId: `gen_${slug || 'world'}_${count}`,
    nameVi: `Thế giới ${cleanSeed} (${count})`,
    nameEn: `World ${cleanSeed} (${count})`,
    bounds,
    defaultSelectedNodeId: 'start',
    initialRaid:
      firstHostileNeighbourIdx !== null
        ? {
            target: 'start',
            from: nodeIdByOrigIdx[firstHostileNeighbourIdx],
            months: 2,
          }
        : null,
    baseTypes: {
      outpost: { ...builtIn.baseTypes.outpost },
      colony: { ...builtIn.baseTypes.colony },
      relay: { ...builtIn.baseTypes.relay },
      fortress: { ...builtIn.baseTypes.fortress },
      shipyard: { ...builtIn.baseTypes.shipyard },
      capital: { ...builtIn.baseTypes.capital },
    },
    nodes,
    lanes,
  };

  return validateMapPack(rawPack) ?? rawPack;
}

export function createRandomSeedCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
