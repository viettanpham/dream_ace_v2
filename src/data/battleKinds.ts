import type { BattleKind, BattleSize, PilotAccount } from '../types/game';

export interface BattleKindRule {
  kind: BattleKind;
  needsVisible: boolean;
  needsFrontline: boolean;
  needsAllied: boolean;
  needsUnderAttack: boolean;
  allowEndgamePatrol: boolean;
  capturesOnWin: boolean;
  clearsRaid: boolean;
  requiresSource: boolean;
  completesBonusMissionOnWin: boolean;
}

export const BATTLE_KIND_RULES: Record<BattleKind, BattleKindRule> = {
  assault: {
    kind: 'assault',
    needsVisible: true,
    needsFrontline: true,
    needsAllied: false,
    needsUnderAttack: false,
    allowEndgamePatrol: false,
    capturesOnWin: true,
    clearsRaid: false,
    requiresSource: false,
    completesBonusMissionOnWin: true,
  },
  defend: {
    kind: 'defend',
    needsVisible: true,
    needsFrontline: false,
    needsAllied: true,
    needsUnderAttack: true,
    allowEndgamePatrol: false,
    capturesOnWin: false,
    clearsRaid: true,
    requiresSource: false,
    completesBonusMissionOnWin: true,
  },
  patrol: {
    kind: 'patrol',
    needsVisible: true,
    needsFrontline: true,
    needsAllied: true,
    needsUnderAttack: false,
    allowEndgamePatrol: true,
    capturesOnWin: false,
    clearsRaid: false,
    requiresSource: false,
    completesBonusMissionOnWin: false,
  },
  mission: {
    kind: 'mission',
    needsVisible: true,
    needsFrontline: false,
    needsAllied: false,
    needsUnderAttack: false,
    allowEndgamePatrol: false,
    capturesOnWin: false,
    clearsRaid: false,
    requiresSource: true,
    completesBonusMissionOnWin: false,
  },
  event: {
    kind: 'event',
    needsVisible: true,
    needsFrontline: false,
    needsAllied: false,
    needsUnderAttack: false,
    allowEndgamePatrol: false,
    capturesOnWin: false,
    clearsRaid: false,
    requiresSource: true,
    completesBonusMissionOnWin: false,
  },
};

export interface BattleSourceStatus {
  active: boolean;
  sizeOverride?: BattleSize | null;
  rewardMult?: number;
}

export type BattleSourceProvider = (
  pilot: PilotAccount,
  sourceId: string | null,
  nodeId: string
) => BattleSourceStatus;

const battleSourceProviders = new Map<BattleKind, BattleSourceProvider>();

/**
 * Registers (or unregisters when null) an external provider validating whether a
 * mission or event battle source is currently active on a node.
 */
export function registerBattleSourceProvider(
  kind: BattleKind,
  provider: BattleSourceProvider | null
): () => void {
  if (provider === null) {
    battleSourceProviders.delete(kind);
    return () => undefined;
  }
  battleSourceProviders.set(kind, provider);
  return () => {
    if (battleSourceProviders.get(kind) === provider) {
      battleSourceProviders.delete(kind);
    }
  };
}

export function getBattleSourceProvider(
  kind: BattleKind
): BattleSourceProvider | null {
  return battleSourceProviders.get(kind) ?? null;
}

export function checkBattleSource(
  kind: BattleKind,
  pilot: PilotAccount,
  sourceId: string | null,
  nodeId: string
): BattleSourceStatus {
  const rule = BATTLE_KIND_RULES[kind];
  if (!rule.requiresSource) {
    return { active: true };
  }
  const provider = battleSourceProviders.get(kind);
  if (!provider) {
    return { active: false };
  }
  const result = provider(pilot, sourceId, nodeId);
  return {
    active: Boolean(result?.active),
    sizeOverride: result?.sizeOverride,
    rewardMult: result?.rewardMult,
  };
}

export function clearBattleSourceProvidersForTests(): void {
  battleSourceProviders.clear();
}
