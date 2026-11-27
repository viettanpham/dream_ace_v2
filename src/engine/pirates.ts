import { registerBattleSourceProvider } from '../data/battleKinds';
import { getMapNodeById, SECTORS_CATALOG } from '../data/maps';
import type {
  AdminConfig,
  BattleSize,
  PilotAccount,
  PirateIncident,
  PiratesConfig,
  PirateSizeWeights,
} from '../types/game';
import * as frontline from './frontline';

export const PIRATE_INCIDENT_ID_PREFIX = 'pir_' as const;

export const DEFAULT_PIRATES_CONFIG: PiratesConfig = {
  enabled: true,
  maxActive: 3,
  spawnChancePerMonth: 0.5,
  ensureOneWhenIdle: true,
  sizeWeights: { 4: 40, 6: 35, 8: 25 },
  expiryMonths: 3,
  rewardMult: 1.0,
};

const VALID_PIRATE_SIZES: readonly BattleSize[] = [4, 6, 8];

let pirateIncidentSeq = 1;

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFloat(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sanitizeSizeWeights(raw: unknown): PirateSizeWeights {
  const def = DEFAULT_PIRATES_CONFIG.sizeWeights;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...def };
  }
  const src = raw as Record<string, unknown>;
  const w4 = clampFloat(src['4'], 0, 10000, def[4]);
  const w6 = clampFloat(src['6'], 0, 10000, def[6]);
  const w8 = clampFloat(src['8'], 0, 10000, def[8]);
  if (w4 + w6 + w8 <= 0) {
    return { ...def };
  }
  return { 4: w4, 6: w6, 8: w8 };
}

export function clonePiratesConfig(cfg: PiratesConfig): PiratesConfig {
  return {
    ...cfg,
    sizeWeights: { ...cfg.sizeWeights },
  };
}

export function sanitizePiratesConfig(raw?: unknown): PiratesConfig {
  const def = DEFAULT_PIRATES_CONFIG;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return clonePiratesConfig(def);
  }
  const src = raw as Record<string, unknown>;
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : def.enabled,
    maxActive: clampInt(src.maxActive, 1, 6, def.maxActive),
    spawnChancePerMonth: clampFloat(
      src.spawnChancePerMonth,
      0,
      1,
      def.spawnChancePerMonth
    ),
    ensureOneWhenIdle:
      typeof src.ensureOneWhenIdle === 'boolean'
        ? src.ensureOneWhenIdle
        : def.ensureOneWhenIdle,
    sizeWeights: sanitizeSizeWeights(src.sizeWeights),
    expiryMonths: clampInt(src.expiryMonths, 1, 12, def.expiryMonths),
    rewardMult: clampFloat(src.rewardMult, 0.1, 5, def.rewardMult),
  };
}

export function isPirateIncidentId(sourceId?: string | null): boolean {
  return (
    typeof sourceId === 'string' &&
    sourceId.startsWith(PIRATE_INCIDENT_ID_PREFIX)
  );
}

export function sanitizePirateIncidents(
  raw: unknown,
  campaignMonth = 1,
  cfg?: Partial<PiratesConfig> | null
): PirateIncident[] {
  if (!Array.isArray(raw)) return [];
  const resolvedCfg = sanitizePiratesConfig(cfg);
  const currentMonth = Math.max(
    1,
    Math.floor(Number.isFinite(campaignMonth) ? campaignMonth : 1)
  );

  const seenIds = new Set<string>();
  const seenNodes = new Set<string>();
  const clean: PirateIncident[] = [];

  for (const entry of raw) {
    if (clean.length >= resolvedCfg.maxActive) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    const nodeId = typeof obj.nodeId === 'string' ? obj.nodeId.trim() : '';
    const size = obj.size as BattleSize;
    const createdMonth = Number(obj.createdMonth);
    const expiresMonth = Number(obj.expiresMonth);

    if (!id || seenIds.has(id)) continue;
    if (!nodeId || !getMapNodeById(nodeId) || seenNodes.has(nodeId)) {
      continue;
    }
    if (!VALID_PIRATE_SIZES.includes(size)) continue;
    if (!Number.isFinite(createdMonth) || createdMonth < 1) continue;
    if (!Number.isFinite(expiresMonth) || expiresMonth <= currentMonth) continue;

    seenIds.add(id);
    seenNodes.add(nodeId);
    clean.push({
      id,
      nodeId,
      size,
      createdMonth: Math.floor(createdMonth),
      expiresMonth: Math.floor(expiresMonth),
    });
  }

  return clean;
}

function pickPirateSize(
  weights: PirateSizeWeights,
  rng: () => number
): BattleSize {
  const entries: readonly { size: BattleSize; weight: number }[] = [
    { size: 4, weight: Math.max(0, weights[4]) },
    { size: 6, weight: Math.max(0, weights[6]) },
    { size: 8, weight: Math.max(0, weights[8]) },
  ];
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return 4;
  let roll = Math.min(0.999999999, Math.max(0, rng())) * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry.size;
  }
  return entries.find((e) => e.weight > 0)?.size ?? 4;
}

export function getActivePirateIncidentForNode(
  pilot: Pick<PilotAccount, 'pirateIncidents' | 'campaignMonth'>,
  nodeId: string,
  cfg?: Partial<PiratesConfig> | null
): PirateIncident | null {
  const resolvedCfg = sanitizePiratesConfig(cfg);
  if (!resolvedCfg.enabled) return null;
  const active = sanitizePirateIncidents(
    pilot.pirateIncidents,
    pilot.campaignMonth ?? 1,
    resolvedCfg
  );
  return active.find((inc) => inc.nodeId === nodeId) ?? null;
}

export function rollIncident(
  pilot: Pick<PilotAccount, 'baseStates' | 'unlockedSectorIds' | 'pirateIncidents' | 'campaignMonth'>,
  cfg: Partial<PiratesConfig> = DEFAULT_PIRATES_CONFIG,
  rng: () => number = Math.random
): PirateIncident | null {
  const resolvedCfg = sanitizePiratesConfig(cfg);
  if (!resolvedCfg.enabled) return null;

  const month = Math.max(1, Math.floor(pilot.campaignMonth || 1));
  const active = sanitizePirateIncidents(
    pilot.pirateIncidents,
    month,
    resolvedCfg
  );
  const occupiedNodes = new Set(active.map((inc) => inc.nodeId));

  const candidates = SECTORS_CATALOG.filter((sec) => {
    const faction = pilot.baseStates?.[sec.id]?.faction ?? sec.initialFaction;
    return (
      faction === 'allied' &&
      frontline.isVisible(pilot, sec.id) &&
      !occupiedNodes.has(sec.id)
    );
  });
  if (candidates.length === 0) return null;

  const idx = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(rng() * candidates.length))
  );
  const pickedNode = candidates[idx];
  const pickedSize = pickPirateSize(resolvedCfg.sizeWeights, rng);
  const suffix = Math.floor(Math.max(0, rng()) * 1e6).toString(36);
  const id = `${PIRATE_INCIDENT_ID_PREFIX}${month}_${pirateIncidentSeq++}_${suffix}`;

  return {
    id,
    nodeId: pickedNode.id,
    size: pickedSize,
    createdMonth: month,
    expiresMonth: month + resolvedCfg.expiryMonths,
  };
}

export function spawnOnMonth(
  pilot: PilotAccount,
  cfg: Partial<PiratesConfig> = DEFAULT_PIRATES_CONFIG,
  rng: () => number = Math.random
): PilotAccount {
  const resolvedCfg = sanitizePiratesConfig(cfg);
  if (!resolvedCfg.enabled) {
    return pilot;
  }

  const active = sanitizePirateIncidents(
    pilot.pirateIncidents,
    pilot.campaignMonth,
    resolvedCfg
  );

  if (active.length < resolvedCfg.maxActive && rng() < resolvedCfg.spawnChancePerMonth) {
    const spawned = rollIncident(
      { ...pilot, pirateIncidents: active },
      resolvedCfg,
      rng
    );
    if (spawned) {
      active.push(spawned);
    }
  }

  return {
    ...pilot,
    pirateIncidents: active,
  };
}

export function ensureIdle(
  pilot: PilotAccount,
  cfg: Partial<PiratesConfig> = DEFAULT_PIRATES_CONFIG,
  rng: () => number = Math.random,
  adminConfig?: Partial<Pick<AdminConfig, 'ignoreFrontline'>> | null
): PilotAccount {
  const resolvedCfg = sanitizePiratesConfig(cfg);
  if (!resolvedCfg.enabled || !resolvedCfg.ensureOneWhenIdle) {
    return pilot;
  }

  const active = sanitizePirateIncidents(
    pilot.pirateIncidents,
    pilot.campaignMonth,
    resolvedCfg
  );
  if (active.length > 0) {
    return active.length === (pilot.pirateIncidents?.length ?? 0)
      ? pilot
      : { ...pilot, pirateIncidents: active };
  }

  const hasFightableOption = SECTORS_CATALOG.some((sec) =>
    frontline.getBattleOptions(pilot, sec.id, adminConfig).some(
      (opt) =>
        opt.allowed &&
        (opt.kind === 'assault' ||
          opt.kind === 'defend' ||
          opt.kind === 'patrol')
    )
  );
  if (hasFightableOption) {
    return pilot;
  }

  const spawned = rollIncident(
    { ...pilot, pirateIncidents: active },
    resolvedCfg,
    rng
  );
  if (!spawned) {
    return pilot;
  }

  return {
    ...pilot,
    pirateIncidents: [spawned],
  };
}

export function clearPirateIncidentById(
  pilot: PilotAccount,
  incidentId: string | null | undefined
): PilotAccount {
  if (!incidentId || !Array.isArray(pilot.pirateIncidents)) {
    return pilot;
  }
  const filtered = pilot.pirateIncidents.filter((inc) => inc.id !== incidentId);
  if (filtered.length === pilot.pirateIncidents.length) {
    return pilot;
  }
  return {
    ...pilot,
    pirateIncidents: filtered,
  };
}

export function registerPirateBattleSourceProvider(
  getConfig: () => Partial<PiratesConfig> | undefined = () =>
    DEFAULT_PIRATES_CONFIG
): () => void {
  return registerBattleSourceProvider('event', (pilot, sourceId, nodeId) => {
    const cfg = sanitizePiratesConfig(getConfig());
    if (!cfg.enabled || !sourceId) {
      return { active: false };
    }
    const active = sanitizePirateIncidents(
      pilot.pirateIncidents,
      pilot.campaignMonth ?? 1,
      cfg
    );
    const incident = active.find(
      (inc) => inc.id === sourceId && inc.nodeId === nodeId
    );
    if (!incident) {
      return { active: false };
    }
    return {
      active: true,
      sizeOverride: incident.size,
      rewardMult: cfg.rewardMult,
    };
  });
}

// Register default pirate event provider whenever pirates module is loaded.
registerPirateBattleSourceProvider();
