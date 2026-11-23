import { MAP_LANES, SECTORS_CATALOG } from '../data/maps';
import type { AdminConfig, BaseFaction, PilotAccount } from '../types/game';

export type BattleOptionKind = 'assault' | 'defend' | 'patrol';

export type BattleOptionReasonKey =
  | 'map.reason.notFrontline'
  | 'map.reason.rearBase'
  | 'map.reason.hidden';

export interface BattleOption {
  kind: BattleOptionKind;
  allowed: boolean;
  reasonKey?: BattleOptionReasonKey;
}

export type FrontlinePilotSlice = Pick<
  PilotAccount,
  'baseStates' | 'unlockedSectorIds'
>;

function getSectorFaction(
  pilot: Pick<PilotAccount, 'baseStates'>,
  id: string
): BaseFaction {
  const runtime = pilot.baseStates?.[id];
  if (runtime?.faction) return runtime.faction;
  const def = SECTORS_CATALOG.find((s) => s.id === id);
  return def?.initialFaction ?? 'hostile';
}

function isEnemyOrNeutral(faction: BaseFaction): boolean {
  return faction === 'hostile' || faction === 'neutral';
}

/**
 * Returns adjacent sector IDs from MAP_LANES in both directions (deduplicated).
 */
export function neighbours(id: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const lane of MAP_LANES) {
    if (lane.from === id && !seen.has(lane.to)) {
      seen.add(lane.to);
      result.push(lane.to);
    } else if (lane.to === id && !seen.has(lane.from)) {
      seen.add(lane.from);
      result.push(lane.from);
    }
  }
  return result;
}

/**
 * Contested enemy/neutral node: hostile or neutral AND at least 1 neighbour is allied (any status).
 */
export function isContested(
  pilot: Pick<PilotAccount, 'baseStates'>,
  id: string
): boolean {
  const faction = getSectorFaction(pilot, id);
  if (!isEnemyOrNeutral(faction)) return false;
  return neighbours(id).some((nid) => getSectorFaction(pilot, nid) === 'allied');
}

/**
 * Allied frontline node: allied AND at least 1 neighbour is hostile or neutral.
 */
export function isAlliedFrontline(
  pilot: Pick<PilotAccount, 'baseStates'>,
  id: string
): boolean {
  if (getSectorFaction(pilot, id) !== 'allied') return false;
  return neighbours(id).some((nid) =>
    isEnemyOrNeutral(getSectorFaction(pilot, nid))
  );
}

/**
 * Fog-of-war / node visibility:
 * allied OR neighbour of an allied node OR explicitly listed in pilot.unlockedSectorIds.
 */
export function isVisible(pilot: FrontlinePilotSlice, id: string): boolean {
  if (getSectorFaction(pilot, id) === 'allied') return true;
  if (neighbours(id).some((nid) => getSectorFaction(pilot, nid) === 'allied')) {
    return true;
  }
  return (
    Array.isArray(pilot.unlockedSectorIds) &&
    pilot.unlockedSectorIds.includes(id)
  );
}

/**
 * Returns all sector IDs currently visible to the player.
 */
export function visibleNodeIds(pilot: FrontlinePilotSlice): string[] {
  return SECTORS_CATALOG.filter((sec) => isVisible(pilot, sec.id)).map(
    (sec) => sec.id
  );
}

/**
 * Cumulative visibility history: appends every currently visible node without ever removing existing entries.
 */
export function mergeVisibleUnlockedSectors(
  pilot: FrontlinePilotSlice
): string[] {
  const existing = Array.isArray(pilot.unlockedSectorIds)
    ? pilot.unlockedSectorIds
    : [];
  return Array.from(new Set([...existing, ...visibleNodeIds(pilot)]));
}

/**
 * True when no hostile or neutral node remains anywhere on the map.
 */
export function noEnemyLeft(pilot: Pick<PilotAccount, 'baseStates'>): boolean {
  return SECTORS_CATALOG.every(
    (sec) => getSectorFaction(pilot, sec.id) === 'allied'
  );
}

/**
 * Computes available / blocked battle actions for a map node.
 */
export function getBattleOptions(
  pilot: FrontlinePilotSlice,
  id: string,
  adminConfig?: Partial<Pick<AdminConfig, 'ignoreFrontline'>> | null
): BattleOption[] {
  const ignoreFrontline = Boolean(adminConfig?.ignoreFrontline);
  const visible = isVisible(pilot, id);

  if (!visible) {
    return [
      {
        kind: 'assault',
        allowed: false,
        reasonKey: 'map.reason.hidden',
      },
    ];
  }

  const faction = getSectorFaction(pilot, id);
  const runtime = pilot.baseStates?.[id];

  if (isEnemyOrNeutral(faction)) {
    if (isContested(pilot, id) || ignoreFrontline) {
      return [{ kind: 'assault', allowed: true }];
    }
    return [
      {
        kind: 'assault',
        allowed: false,
        reasonKey: 'map.reason.notFrontline',
      },
    ];
  }

  // Allied node
  const options: BattleOption[] = [];
  if (runtime?.underAttack) {
    options.push({ kind: 'defend', allowed: true });
  }

  if (isAlliedFrontline(pilot, id) || noEnemyLeft(pilot) || ignoreFrontline) {
    options.push({ kind: 'patrol', allowed: true });
  } else {
    options.push({
      kind: 'patrol',
      allowed: false,
      reasonKey: 'map.reason.rearBase',
    });
  }

  return options;
}

const DEFAULT_BATTLE_PRIORITY: readonly BattleOptionKind[] = [
  'defend',
  'assault',
  'patrol',
];

/**
 * Picks the highest-priority allowed option: defend > assault > patrol (or null if none allowed).
 */
export function pickDefaultBattle(
  options: readonly BattleOption[]
): BattleOptionKind | null {
  for (const kind of DEFAULT_BATTLE_PRIORITY) {
    const match = options.find((opt) => opt.kind === kind && opt.allowed);
    if (match) return match.kind;
  }
  return null;
}
