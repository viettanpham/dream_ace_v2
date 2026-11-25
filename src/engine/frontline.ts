import {
  BATTLE_KIND_RULES,
  checkBattleSource,
} from '../data/battleKinds';
import { MAP_LANES, SECTORS_CATALOG } from '../data/maps';
import type {
  AdminConfig,
  BaseFaction,
  BattleKind,
  BattleSize,
  PilotAccount,
} from '../types/game';

export type BattleOptionReasonKey =
  | 'map.reason.notFrontline'
  | 'map.reason.rearBase'
  | 'map.reason.hidden'
  | 'map.reason.sourceInactive';

export interface BattleOption {
  kind: BattleKind;
  allowed: boolean;
  reasonKey?: BattleOptionReasonKey;
  sourceId?: string | null;
  labelKey?: string;
  sizeOverride?: BattleSize;
}

export type FrontlinePilotSlice = Pick<
  PilotAccount,
  'baseStates' | 'unlockedSectorIds'
> &
  Partial<Pick<PilotAccount, 'pirateIncidents' | 'campaignMonth'>>;

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
  adminConfig?: Partial<Pick<AdminConfig, 'ignoreFrontline' | 'pirates'>> | null
): BattleOption[] {
  const ignoreFrontline = Boolean(adminConfig?.ignoreFrontline);
  const piratesEnabled =
    adminConfig?.pirates !== undefined
      ? Boolean(adminConfig.pirates.enabled)
      : true;
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

  const currentMonth =
    typeof pilot.campaignMonth === 'number' && Number.isFinite(pilot.campaignMonth)
      ? Math.floor(pilot.campaignMonth)
      : null;
  const activePirateIncident =
    piratesEnabled && Array.isArray(pilot.pirateIncidents)
      ? pilot.pirateIncidents.find(
          (inc) =>
            inc.nodeId === id &&
            (currentMonth === null || inc.expiresMonth > currentMonth)
        ) ?? null
      : null;

  const faction = getSectorFaction(pilot, id);
  const runtime = pilot.baseStates?.[id];

  if (isEnemyOrNeutral(faction)) {
    const enemyOptions: BattleOption[] =
      isContested(pilot, id) || ignoreFrontline
        ? [{ kind: 'assault', allowed: true }]
        : [
            {
              kind: 'assault',
              allowed: false,
              reasonKey: 'map.reason.notFrontline',
            },
          ];
    if (activePirateIncident) {
      enemyOptions.push({
        kind: 'event',
        allowed: true,
        sourceId: activePirateIncident.id,
        labelKey: 'map.battle.pirates',
        sizeOverride: activePirateIncident.size,
      });
    }
    return enemyOptions;
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

  if (activePirateIncident) {
    options.push({
      kind: 'event',
      allowed: true,
      sourceId: activePirateIncident.id,
      labelKey: 'map.battle.pirates',
      sizeOverride: activePirateIncident.size,
    });
  }

  return options;
}

const DEFAULT_BATTLE_PRIORITY: readonly BattleKind[] = [
  'defend',
  'assault',
  'patrol',
];

/**
 * Picks the highest-priority allowed option: defend > assault > patrol (or null if none allowed).
 */
export function pickDefaultBattle(
  options: readonly BattleOption[]
): BattleKind | null {
  for (const kind of DEFAULT_BATTLE_PRIORITY) {
    const match = options.find((opt) => opt.kind === kind && opt.allowed);
    if (match) return match.kind;
  }
  return null;
}

export interface BattleLaunchValidation {
  allowed: boolean;
  kind: BattleKind;
  sourceId: string | null;
  reasonKey?: BattleOptionReasonKey;
  sizeOverride?: BattleSize | null;
  rewardMult?: number;
}

/**
 * Validates whether a specific BattleKind (+ optional sourceId) can launch at `nodeId`.
 */
export function validateBattleLaunch(
  pilot: PilotAccount,
  nodeId: string,
  kind: BattleKind,
  sourceId: string | null = null,
  adminConfig?: Partial<Pick<AdminConfig, 'ignoreFrontline'>> | null
): BattleLaunchValidation {
  const rule = BATTLE_KIND_RULES[kind];

  if (rule.needsVisible && !isVisible(pilot, nodeId)) {
    return {
      allowed: false,
      kind,
      sourceId,
      reasonKey: 'map.reason.hidden',
    };
  }

  if (rule.requiresSource) {
    const status = checkBattleSource(kind, pilot, sourceId, nodeId);
    if (!status.active) {
      return {
        allowed: false,
        kind,
        sourceId,
        reasonKey: 'map.reason.sourceInactive',
      };
    }
    return {
      allowed: true,
      kind,
      sourceId,
      sizeOverride: status.sizeOverride,
      rewardMult: status.rewardMult,
    };
  }

  const options = getBattleOptions(pilot, nodeId, adminConfig);
  const matching = options.find((opt) => opt.kind === kind);
  if (matching?.allowed) {
    return {
      allowed: true,
      kind,
      sourceId: null,
    };
  }

  const fallbackReason: BattleOptionReasonKey =
    matching?.reasonKey ??
    (getSectorFaction(pilot, nodeId) === 'allied'
      ? 'map.reason.rearBase'
      : 'map.reason.notFrontline');

  return {
    allowed: false,
    kind,
    sourceId: null,
    reasonKey: fallbackReason,
  };
}
