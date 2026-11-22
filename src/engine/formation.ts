import {
  CLASS_FORMATION_PREFERENCES,
  cloneFormationConfig,
  DEFAULT_FORMATION_CONFIG,
  FORMATION_ROWS,
} from '../data/formationConfig';
import { ALLY_PILOT_POOL } from '../data/pilots';
import type {
  CombatRow,
  FormationConfig,
  FormationRowModifier,
  MechClassId,
  SquadFormationUnit,
} from '../types/game';

const VALID_ROWS = new Set<CombatRow>(['front', 'middle', 'back']);
const VALID_CLASSES = new Set<MechClassId>([
  'striker',
  'interceptor',
  'siege',
  'support',
]);

export function isValidCombatRow(value: unknown): value is CombatRow {
  return typeof value === 'string' && VALID_ROWS.has(value as CombatRow);
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function clampPct(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(Math.max(min, Math.min(max, num)) * 1000) / 1000;
}

/**
 * Sanitizes a FormationConfig or migrates legacy AdminConfig fields
 * (`formationFrontCapacity`, `formationBackCapacity`) safely into the 3-row FormationConfig.
 */
export function sanitizeFormationConfig(
  raw?: Partial<FormationConfig> | Record<string, unknown> | null
): FormationConfig {
  const def = cloneFormationConfig(DEFAULT_FORMATION_CONFIG);
  if (!raw || typeof raw !== 'object') {
    return def;
  }

  const obj = raw as Record<string, unknown>;
  const nested =
    obj.formation && typeof obj.formation === 'object'
      ? (obj.formation as Record<string, unknown>)
      : obj;

  const hasRowCapacities =
    nested.rowCapacities && typeof nested.rowCapacities === 'object';

  let frontCap = def.rowCapacities.front;
  let middleCap = def.rowCapacities.middle;
  let backCap = def.rowCapacities.back;

  if (hasRowCapacities) {
    const rc = nested.rowCapacities as Record<string, unknown>;
    frontCap = clampInt(rc.front, 0, 8, def.rowCapacities.front);
    middleCap = clampInt(rc.middle, 0, 8, def.rowCapacities.middle);
    backCap = clampInt(rc.back, 0, 8, def.rowCapacities.back);
  } else if (
    'formationFrontCapacity' in obj ||
    'formationBackCapacity' in obj
  ) {
    // Legacy save migration: if old defaults (4/4), adopt clean 3-row defaults (3/3/2).
    // If customized, preserve custom front/back caps while adding middle row.
    const oldFront = Number(obj.formationFrontCapacity);
    const oldBack = Number(obj.formationBackCapacity);
    const wasOldDefault =
      (!Number.isFinite(oldFront) || oldFront === 4) &&
      (!Number.isFinite(oldBack) || oldBack === 4);
    if (!wasOldDefault) {
      frontCap = clampInt(oldFront, 0, 8, def.rowCapacities.front);
      backCap = clampInt(oldBack, 0, 8, def.rowCapacities.back);
      middleCap = def.rowCapacities.middle;
    }
  }

  // Ensure total row capacity is at least 1 so placement can never deadlock
  if (frontCap + middleCap + backCap < 1) {
    frontCap = def.rowCapacities.front;
    middleCap = def.rowCapacities.middle;
    backCap = def.rowCapacities.back;
  }

  const maxUnitsPerSide = clampInt(
    nested.maxUnitsPerSide,
    1,
    8,
    def.maxUnitsPerSide
  );

  const rawMods =
    nested.rowModifiers && typeof nested.rowModifiers === 'object'
      ? (nested.rowModifiers as Record<string, unknown>)
      : {};

  const sanitizeMod = (row: CombatRow): FormationRowModifier => {
    const d = def.rowModifiers[row];
    const m =
      rawMods[row] && typeof rawMods[row] === 'object'
        ? (rawMods[row] as Record<string, unknown>)
        : {};
    return {
      defensePct: clampPct(m.defensePct, -0.8, 1.0, d.defensePct),
      damagePct: clampPct(m.damagePct, -0.8, 1.0, d.damagePct),
      rangedDamagePct: clampPct(m.rangedDamagePct, -0.8, 1.0, d.rangedDamagePct),
    };
  };

  return {
    rowCapacities: {
      front: frontCap,
      middle: middleCap,
      back: backCap,
    },
    maxUnitsPerSide,
    rowModifiers: {
      front: sanitizeMod('front'),
      middle: sanitizeMod('middle'),
      back: sanitizeMod('back'),
    },
  };
}

export function isFormationConfigDefault(
  cfg: FormationConfig | undefined | null
): boolean {
  if (!cfg) return true;
  const d = DEFAULT_FORMATION_CONFIG;
  if (cfg.maxUnitsPerSide !== d.maxUnitsPerSide) return false;
  for (const row of FORMATION_ROWS) {
    if (cfg.rowCapacities[row] !== d.rowCapacities[row]) return false;
    const m = cfg.rowModifiers[row];
    const dm = d.rowModifiers[row];
    if (
      Math.abs(m.defensePct - dm.defensePct) > 0.0001 ||
      Math.abs(m.damagePct - dm.damagePct) > 0.0001 ||
      Math.abs(m.rangedDamagePct - dm.rangedDamagePct) > 0.0001
    ) {
      return false;
    }
  }
  return true;
}

export function getRowModifier(
  config: FormationConfig | undefined | null,
  row: CombatRow
): FormationRowModifier {
  return (
    config?.rowModifiers?.[row] ?? DEFAULT_FORMATION_CONFIG.rowModifiers[row]
  );
}

export function getRowCounts(
  units: ReadonlyArray<{ row: CombatRow }>
): Record<CombatRow, number> {
  const counts: Record<CombatRow, number> = { front: 0, middle: 0, back: 0 };
  for (const u of units) {
    if (isValidCombatRow(u.row)) {
      counts[u.row] += 1;
    }
  }
  return counts;
}

/**
 * Re-indexes sequential formationCol (0..n-1) within each row.
 */
export function assignFormationColumns<
  T extends { row: CombatRow; formationCol?: number }
>(units: T[]): Array<T & { formationCol: number }> {
  const colCounters: Record<CombatRow, number> = {
    front: 0,
    middle: 0,
    back: 0,
  };
  return units.map((u) => {
    const row: CombatRow = isValidCombatRow(u.row) ? u.row : 'front';
    const col = colCounters[row];
    colCounters[row] = col + 1;
    return {
      ...u,
      row,
      formationCol: col,
    };
  });
}

export interface MoveUnitResult<T> {
  ok: boolean;
  reason?: 'not_found' | 'same_row' | 'row_full';
  units: T[];
  currentCount: number;
  capacity: number;
  swappedWithUnitId?: string;
}

/**
 * Validates whether a unit can be moved into `targetRow` respecting `config.rowCapacities`.
 */
export function canMoveUnitToRow(
  units: ReadonlyArray<{ id: string; row: CombatRow }>,
  unitId: string,
  targetRow: CombatRow,
  config: FormationConfig = DEFAULT_FORMATION_CONFIG
): {
  ok: boolean;
  reason?: 'not_found' | 'same_row' | 'row_full';
  currentCount: number;
  capacity: number;
} {
  const capacity = config.rowCapacities[targetRow] ?? 0;
  const currentCount = units.filter((u) => u.row === targetRow).length;
  const targetUnit = units.find((u) => u.id === unitId);
  if (!targetUnit) {
    return { ok: false, reason: 'not_found', currentCount, capacity };
  }
  if (targetUnit.row === targetRow) {
    return { ok: false, reason: 'same_row', currentCount, capacity };
  }
  if (currentCount >= capacity) {
    return { ok: false, reason: 'row_full', currentCount, capacity };
  }
  return { ok: true, currentCount, capacity };
}

/**
 * Moves a unit to `targetRow` if capacity allows, or swaps with a unit in `targetRow`
 * when `options.swapIfFull` is true, and refreshes `formationCol` indices.
 */
export function moveUnitToRow<
  T extends { id: string; row: CombatRow; formationCol?: number }
>(
  units: T[],
  unitId: string,
  targetRow: CombatRow,
  config: FormationConfig = DEFAULT_FORMATION_CONFIG,
  options?: { swapIfFull?: boolean; swapWithUnitId?: string }
): MoveUnitResult<T> {
  const check = canMoveUnitToRow(units, unitId, targetRow, config);
  if (check.ok) {
    const updated = units.map((u) =>
      u.id === unitId ? { ...u, row: targetRow } : u
    );
    return {
      ok: true,
      units: assignFormationColumns(updated),
      currentCount: check.currentCount + 1,
      capacity: check.capacity,
    };
  }

  if (check.reason === 'row_full' && options?.swapIfFull && check.capacity > 0) {
    const sourceUnit = units.find((u) => u.id === unitId);
    const targetRowUnits = units
      .filter((u) => u.row === targetRow)
      .sort((a, b) => (a.formationCol ?? 0) - (b.formationCol ?? 0));
    const swapTarget =
      (options.swapWithUnitId
        ? targetRowUnits.find((u) => u.id === options.swapWithUnitId)
        : undefined) ?? targetRowUnits[targetRowUnits.length - 1];

    if (sourceUnit && swapTarget) {
      const updated = units.map((u) => {
        if (u.id === sourceUnit.id) return { ...u, row: targetRow };
        if (u.id === swapTarget.id) return { ...u, row: sourceUnit.row };
        return u;
      });
      return {
        ok: true,
        units: assignFormationColumns(updated),
        currentCount: targetRowUnits.length,
        capacity: check.capacity,
        swappedWithUnitId: swapTarget.id,
      };
    }
  }

  return {
    ok: false,
    reason: check.reason,
    units,
    currentCount: check.currentCount,
    capacity: check.capacity,
  };
}

/**
 * Picks the best row for a single unit given current row occupancy and capacities.
 * Never fails — if every row is at capacity, picks the row with highest remaining
 * headroom (or fewest units) as a safe overflow fallback.
 */
export function pickRowForClass(
  classId: MechClassId,
  counts: Record<CombatRow, number>,
  config: FormationConfig = DEFAULT_FORMATION_CONFIG,
  options?: {
    rng?: () => number;
    randomVariation?: number;
    reservedMidBackSlots?: number;
  }
): CombatRow {
  const pref = CLASS_FORMATION_PREFERENCES[classId] ?? CLASS_FORMATION_PREFERENCES.striker;
  const caps = config.rowCapacities;
  const rng = options?.rng ?? Math.random;
  const variation = options?.randomVariation ?? 0;
  const reservedMidBack = Math.max(0, options?.reservedMidBackSlots ?? 0);

  let candidateOrder: CombatRow[] = [...pref.preferred];

  // If unplaced support/siege units still need middle/back capacity, keep front-preferring
  // classes (striker, interceptor) out of middle/back while an unreserved row (front) has room.
  const freeMidBack =
    Math.max(0, caps.middle - counts.middle) +
    Math.max(0, caps.back - counts.back);
  const reserveBlocksMidBack =
    reservedMidBack > 0 &&
    pref.preferred[0] === 'front' &&
    freeMidBack <= reservedMidBack;

  // For flex classes (Interceptor: front/middle, Support: middle/back), allow random variation on enemy squads;
  // deterministic auto-placement follows preferred priority order so front/middle/back fill cleanly without starving flex classes.
  if (pref.flexPair && variation > 0 && rng() < 0.5) {
    const [r1, r2] = pref.flexPair;
    if (counts[r1] < caps[r1] && counts[r2] < caps[r2]) {
      const rest = candidateOrder.filter((r) => r !== r1 && r !== r2);
      candidateOrder = [r2, r1, ...rest];
    }
  } else if (!pref.flexPair && variation > 0 && rng() < variation) {
    // Small random variation for enemy squads: swap top 2 preferred rows
    if (candidateOrder.length >= 2) {
      candidateOrder = [
        candidateOrder[1],
        candidateOrder[0],
        ...candidateOrder.slice(2),
      ];
    }
  }

  for (const row of candidateOrder) {
    if (counts[row] < caps[row]) {
      if (reserveBlocksMidBack && (row === 'middle' || row === 'back')) {
        continue;
      }
      return row;
    }
  }

  // If every non-reserved row (e.g. front) is already full, fall back to any row with remaining capacity
  for (const row of candidateOrder) {
    if (counts[row] < caps[row]) {
      return row;
    }
  }

  // Fallback if all rows are at/over capacity (never fails): pick row with smallest overflow
  return [...candidateOrder].sort(
    (a, b) => counts[a] - caps[a] - (counts[b] - caps[b])
  )[0];
}

/**
 * Default auto-placement by class respecting 3-row capacities:
 * - Striker     -> front
 * - Interceptor -> front / middle
 * - Siege       -> back
 * - Support     -> middle / back
 * Preserves input unit order in the returned array, sets `row` and sequential `formationCol`,
 * and NEVER fails.
 */
export function autoPlaceFormation<
  T extends { id: string; classId: MechClassId; row?: CombatRow; formationCol?: number }
>(
  units: T[],
  config: FormationConfig = DEFAULT_FORMATION_CONFIG,
  options?: { rng?: () => number; randomVariation?: number }
): Array<T & { row: CombatRow; formationCol: number }> {
  const counts: Record<CombatRow, number> = { front: 0, middle: 0, back: 0 };
  const assignedRows = new Map<string, CombatRow>();

  // Place strict-preference classes (Striker, Siege) before flex classes (Interceptor, Support)
  const indexed = units.map((u, idx) => ({
    unit: u,
    idx,
    priority:
      CLASS_FORMATION_PREFERENCES[u.classId]?.placementPriority ?? 2,
  }));
  indexed.sort((a, b) => a.priority - b.priority || a.idx - b.idx);

  // Track how many remaining unplaced units require middle/back rows (support & siege)
  // so strict swaps or interceptor flex placements never starve supports into the front lane.
  let remainingMidBackNeeders = indexed.filter(
    (entry) =>
      entry.unit.classId === 'support' || entry.unit.classId === 'siege'
  ).length;

  for (const entry of indexed) {
    if (entry.unit.classId === 'support' || entry.unit.classId === 'siege') {
      remainingMidBackNeeders -= 1;
    }
    const chosen = pickRowForClass(entry.unit.classId, counts, config, {
      ...options,
      reservedMidBackSlots: remainingMidBackNeeders,
    });
    counts[chosen] += 1;
    assignedRows.set(entry.unit.id, chosen);
  }

  const placed = units.map((u) => ({
    ...u,
    row: assignedRows.get(u.id) ?? ('front' as CombatRow),
  }));

  return assignFormationColumns(placed);
}

/**
 * Ensures an existing list of units respects row capacities (e.g. after Admin CP shrinks a row).
 * Keeps units in their chosen rows when capacity permits; spills excess units to open rows.
 */
export function enforceFormationCapacities<
  T extends { id: string; classId: MechClassId; row: CombatRow; formationCol?: number }
>(
  units: T[],
  config: FormationConfig = DEFAULT_FORMATION_CONFIG
): Array<T & { row: CombatRow; formationCol: number }> {
  const counts: Record<CombatRow, number> = { front: 0, middle: 0, back: 0 };
  const caps = config.rowCapacities;
  const result: Array<T & { row: CombatRow }> = [];

  for (const unit of units) {
    const desired = isValidCombatRow(unit.row) ? unit.row : null;
    if (desired && counts[desired] < caps[desired]) {
      counts[desired] += 1;
      result.push({ ...unit, row: desired });
    } else {
      const fallback = pickRowForClass(unit.classId, counts, config);
      counts[fallback] += 1;
      result.push({ ...unit, row: fallback });
    }
  }

  return assignFormationColumns(result);
}

/**
 * Builds the default 8-unit player squad roster (Player Lead + 7 wingmen covering all 4 classes)
 * and auto-places them across Front / Middle / Back.
 */
export function createDefaultSquadFormation(
  pilotName: string,
  activeGearId: MechClassId,
  config: FormationConfig = DEFAULT_FORMATION_CONFIG
): SquadFormationUnit[] {
  const leadName = pilotName.trim() || 'Vance';

  // Ensure the first 4 slots cover all 4 distinct classes (player + 3 complementary wingmen),
  // and slots 5..8 give a balanced 8-unit fleet (Striker/Interceptor/Siege/Support mix).
  const allClasses: MechClassId[] = ['striker', 'interceptor', 'siege', 'support'];
  const otherClasses = allClasses.filter((c) => c !== activeGearId);
  const wingmanClasses: MechClassId[] = [
    otherClasses[0],
    otherClasses[1],
    otherClasses[2],
    'striker',
    'interceptor',
    'support',
    'siege',
  ];

  const baseRoster: Array<Omit<SquadFormationUnit, 'row' | 'formationCol'>> = [
    {
      id: 'ally_player',
      name: leadName,
      callsign: 'Lead-1',
      classId: activeGearId,
      isPlayer: true,
    },
  ];

  const usedNames = new Set<string>([leadName]);
  for (let i = 0; i < 7; i++) {
    const candidateName =
      ALLY_PILOT_POOL.firstNames.find((n) => !usedNames.has(n)) ??
      `Wingman-${i + 1}`;
    usedNames.add(candidateName);
    const callsign = ALLY_PILOT_POOL.callsigns[i] ?? `Wing-${i + 1}`;
    baseRoster.push({
      id: `ally_npc_${i + 1}`,
      name: candidateName,
      callsign,
      classId: wingmanClasses[i],
      isPlayer: false,
    });
  }

  return autoPlaceFormation(baseRoster, config);
}

/**
 * Safely migrates old saved formation data from localStorage (v1..v7) into the 3-row model.
 * - Old `front` -> `front`
 * - Old `back` -> `back`
 * - `middle` starts empty when migrating 2-row saves
 * - Respects capacity limits and NEVER throws on corrupted/missing saves.
 */
export function migrateLegacySquadFormation(
  rawFormation: unknown,
  pilotName: string,
  activeGearId: MechClassId,
  config: FormationConfig = DEFAULT_FORMATION_CONFIG,
  rawCustomized?: unknown
): {
  squadFormation: SquadFormationUnit[];
  formationCustomized: boolean;
} {
  const defaultSquad = createDefaultSquadFormation(
    pilotName,
    activeGearId,
    config
  );
  const leadName = pilotName.trim() || 'Vance';

  if (!rawFormation || typeof rawFormation !== 'object') {
    return {
      squadFormation: defaultSquad,
      formationCustomized: false,
    };
  }

  // Case 1: Legacy 2-row or 3-row bucketed object: { front: [...], middle?: [...], back: [...] }
  if (!Array.isArray(rawFormation)) {
    const obj = rawFormation as Record<string, unknown>;
    const hasBucketKeys =
      Array.isArray(obj.front) ||
      Array.isArray(obj.middle) ||
      Array.isArray(obj.back);

    if (!hasBucketKeys) {
      return { squadFormation: defaultSquad, formationCustomized: false };
    }

    const rowMap = new Map<string, CombatRow>();
    const parsedUnits: SquadFormationUnit[] = [];
    const seenIds = new Set<string>();

    const ingestBucket = (bucket: unknown, row: CombatRow) => {
      if (!Array.isArray(bucket)) return;
      for (const entry of bucket) {
        if (typeof entry === 'string') {
          rowMap.set(entry, row);
        } else if (entry && typeof entry === 'object') {
          const e = entry as Record<string, unknown>;
          const id =
            typeof e.id === 'string' && e.id.trim().length > 0
              ? e.id
              : `ally_migrated_${parsedUnits.length + 1}`;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          const isPlayer = Boolean(e.isPlayer) || id === 'ally_player';
          const cls: MechClassId = isPlayer
            ? activeGearId
            : VALID_CLASSES.has(e.classId as MechClassId)
            ? (e.classId as MechClassId)
            : 'striker';
          parsedUnits.push({
            id,
            name: isPlayer
              ? leadName
              : typeof e.name === 'string' && e.name.trim().length > 0
              ? e.name
              : id,
            callsign:
              typeof e.callsign === 'string' && e.callsign.trim().length > 0
                ? e.callsign
                : isPlayer
                ? 'Lead-1'
                : 'Wing',
            classId: cls,
            isPlayer,
            row,
            formationCol: 0,
          });
        }
      }
    };

    ingestBucket(obj.front, 'front');
    ingestBucket(obj.middle, 'middle');
    ingestBucket(obj.back, 'back');

    if (parsedUnits.length > 0) {
      // Ensure player lead is present
      if (!parsedUnits.some((u) => u.isPlayer)) {
        parsedUnits.unshift({
          ...defaultSquad[0],
          row: 'front',
        });
      }
      return {
        squadFormation: enforceFormationCapacities(
          parsedUnits.slice(0, 8),
          config
        ),
        formationCustomized: true,
      };
    }

    if (rowMap.size > 0) {
      // Map known IDs onto the default squad while keeping unmentioned rows in front/back (middle empty!)
      const mapped = defaultSquad.map((u) => ({
        ...u,
        row: rowMap.get(u.id) ?? (u.row === 'middle' ? 'front' : u.row),
      }));
      return {
        squadFormation: enforceFormationCapacities(mapped, config),
        formationCustomized: true,
      };
    }

    return { squadFormation: defaultSquad, formationCustomized: false };
  }

  // Case 2: Array of unit objects (v8 save or legacy array with front/back rows)
  const arr = rawFormation as unknown[];
  const parsed: SquadFormationUnit[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < arr.length; i++) {
    const entry = arr[i];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id =
      typeof e.id === 'string' && e.id.trim().length > 0
        ? e.id
        : i === 0
        ? 'ally_player'
        : `ally_npc_${i}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const isPlayer = Boolean(e.isPlayer) || id === 'ally_player';
    const classId: MechClassId = isPlayer
      ? activeGearId
      : VALID_CLASSES.has(e.classId as MechClassId)
      ? (e.classId as MechClassId)
      : 'striker';
    const rawRow = e.row;
    const row: CombatRow = isValidCombatRow(rawRow)
      ? rawRow
      : rawRow === 'rear'
      ? 'back'
      : 'front';

    parsed.push({
      id,
      name: isPlayer
        ? leadName
        : typeof e.name === 'string' && e.name.trim().length > 0
        ? e.name
        : `Wingman-${i}`,
      callsign:
        typeof e.callsign === 'string' && e.callsign.trim().length > 0
          ? e.callsign
          : isPlayer
          ? 'Lead-1'
          : `Wing-${i}`,
      classId,
      isPlayer,
      row,
      formationCol: 0,
    });
  }

  if (parsed.length === 0) {
    return { squadFormation: defaultSquad, formationCustomized: false };
  }

  // Ensure player unit exists and is first
  const playerIdx = parsed.findIndex((u) => u.isPlayer);
  if (playerIdx === -1) {
    parsed.unshift({ ...defaultSquad[0], row: 'front' });
  } else if (playerIdx > 0) {
    const [p] = parsed.splice(playerIdx, 1);
    parsed.unshift(p);
  }

  return {
    squadFormation: enforceFormationCapacities(parsed.slice(0, 8), config),
    formationCustomized:
      typeof rawCustomized === 'boolean' ? rawCustomized : true,
  };
}
