import type { SkillDefinition, TurnPhaseConfig } from '../types/game';

export const MIN_MAX_STEP2_PER_TURN = 0;
export const MAX_MAX_STEP2_PER_TURN = 3;

export const DEFAULT_TURN_PHASE_CONFIG: TurnPhaseConfig = {
  maxStep2PerTurn: 1,
};

export function cloneTurnPhaseConfig(cfg: TurnPhaseConfig): TurnPhaseConfig {
  return {
    maxStep2PerTurn: sanitizeTurnPhaseConfig(cfg).maxStep2PerTurn,
  };
}

export function sanitizeTurnPhaseConfig(raw: unknown): TurnPhaseConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const n = Number(obj.maxStep2PerTurn);
  const clamped = Number.isFinite(n)
    ? Math.max(
        MIN_MAX_STEP2_PER_TURN,
        Math.min(MAX_MAX_STEP2_PER_TURN, Math.round(n))
      )
    : DEFAULT_TURN_PHASE_CONFIG.maxStep2PerTurn;
  return {
    maxStep2PerTurn: clamped,
  };
}

export function getSkillStep(
  skill: Pick<SkillDefinition, 'targetType' | 'phaseOverride'>
): 2 | 3 {
  if (skill.phaseOverride === 'step2') return 2;
  if (skill.phaseOverride === 'step3') return 3;
  if (
    skill.targetType === 'self' ||
    skill.targetType === 'single_ally' ||
    skill.targetType === 'all_allies'
  ) {
    return 2;
  }
  return 3;
}

export function canCastAsStep2(
  skill: Pick<SkillDefinition, 'targetType' | 'phaseOverride'> | undefined,
  turnStep2Used: number,
  cfg?: TurnPhaseConfig | null
): boolean {
  if (!skill) return false;
  const { maxStep2PerTurn } = sanitizeTurnPhaseConfig(cfg);
  if (maxStep2PerTurn <= 0) return false;
  if (getSkillStep(skill) !== 2) return false;
  const used = Math.max(0, Math.floor(turnStep2Used || 0));
  return used < maxStep2PerTurn;
}

export interface TurnPhaseOutcome {
  keepTurn: boolean;
  nextTurnStep2Used: number;
  nextTurnLockedSkillIds: string[];
}

export function evaluateTurnPhaseAfterAction(params: {
  skill?: Pick<SkillDefinition, 'id' | 'targetType' | 'phaseOverride'>;
  didCastSkill: boolean;
  actorAlive: boolean;
  aliveEnemiesCount: number;
  aliveAlliesCount: number;
  turnStep2Used: number;
  turnLockedSkillIds?: readonly string[];
  cfg?: TurnPhaseConfig | null;
}): TurnPhaseOutcome {
  const {
    skill,
    didCastSkill,
    actorAlive,
    aliveEnemiesCount,
    aliveAlliesCount,
    turnStep2Used,
    turnLockedSkillIds = [],
    cfg,
  } = params;

  if (
    didCastSkill &&
    skill &&
    actorAlive &&
    aliveEnemiesCount > 0 &&
    aliveAlliesCount > 0 &&
    canCastAsStep2(skill, turnStep2Used, cfg)
  ) {
    const nextLocked = turnLockedSkillIds.includes(skill.id)
      ? [...turnLockedSkillIds]
      : [...turnLockedSkillIds, skill.id];
    return {
      keepTurn: true,
      nextTurnStep2Used: Math.max(0, Math.floor(turnStep2Used || 0)) + 1,
      nextTurnLockedSkillIds: nextLocked,
    };
  }

  return {
    keepTurn: false,
    nextTurnStep2Used: 0,
    nextTurnLockedSkillIds: [],
  };
}
