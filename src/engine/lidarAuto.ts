import { getSkillById } from '../data/skills';
import type {
  AdminConfig,
  CombatUnit,
  LidarAutoConfig,
  SkillEffectKind,
} from '../types/game';
import { canUnitUseSkill } from './skills';
import { canCastAsStep2 } from './turnPhase';

export const LIDAR_SKILL_ID = 'sup_lidar_sweep';

export const DEFAULT_LIDAR_AUTO_CONFIG: LidarAutoConfig = {
  enabled: true,
  mode: 'smart',
  minSpPct: 50,
};

const SUPPORT_HEAL_SHIELD_REVIVE_EFFECTS = new Set<SkillEffectKind>([
  'heal_single',
  'heal_field_hot',
  'energize_shield_field',
  'full_recovery_elite',
]);

export function sanitizeLidarAutoConfig(raw: unknown): LidarAutoConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const enabled =
    typeof obj.enabled === 'boolean'
      ? obj.enabled
      : DEFAULT_LIDAR_AUTO_CONFIG.enabled;
  const mode =
    obj.mode === 'fixed' || obj.mode === 'smart'
      ? obj.mode
      : DEFAULT_LIDAR_AUTO_CONFIG.mode;
  const rawPct = Number(obj.minSpPct);
  const minSpPct = Number.isFinite(rawPct)
    ? Math.max(0, Math.min(100, Math.round(rawPct)))
    : DEFAULT_LIDAR_AUTO_CONFIG.minSpPct;
  return { enabled, mode, minSpPct };
}

export interface PickLidarCastParams {
  role: 'player' | 'npc';
  lidarAuto?: Partial<LidarAutoConfig> | null;
  adminConfig?: Partial<AdminConfig> | null;
  step2UsedSoFar?: number;
  turnLockedSkillIds?: readonly string[];
}

export function pickLidarCast(
  units: readonly CombatUnit[],
  actor: CombatUnit,
  params: PickLidarCastParams,
  rng: () => number = Math.random
): boolean {
  if (!actor.alive) return false;

  const enemies = units.filter((u) => u.side !== actor.side && u.alive);
  if (enemies.length === 0) return false;

  const playerCfg =
    params.role === 'player'
      ? sanitizeLidarAutoConfig(params.lidarAuto)
      : null;
  if (playerCfg && !playerCfg.enabled) return false;

  if (!actor.equippedSkillIds.includes(LIDAR_SKILL_ID)) return false;

  const skill = getSkillById(LIDAR_SKILL_ID, params.adminConfig);
  if (!skill) return false;

  const usability = canUnitUseSkill(
    actor,
    LIDAR_SKILL_ID,
    params.adminConfig,
    params.turnLockedSkillIds
  );
  if (!usability.canUse) return false;

  if (
    !canCastAsStep2(
      skill,
      params.step2UsedSoFar ?? 0,
      params.adminConfig?.turnPhase
    )
  ) {
    return false;
  }

  const maxSp = actor.derived.maxSp;
  const spPct = maxSp > 0 ? (actor.sp / maxSp) * 100 : 0;
  const hasStealthedOpponent = enemies.some((u) =>
    u.statuses.some((s) => s.type === 'stealth' && s.turnsRemaining > 0)
  );

  if (params.role === 'npc') {
    if (spPct < 40) return false;
    return hasStealthedOpponent ? rng() < 0.7 : rng() < 0.15;
  }

  // Player auto ('smart' or 'fixed')
  if (playerCfg!.mode === 'fixed') {
    if (spPct < playerCfg!.minSpPct) return false;
    return hasStealthedOpponent || rng() < 0.25;
  }

  // Player auto mode 'smart'
  if (spPct < 50) return false;

  const spAfterCast = actor.sp - usability.spCost;
  for (const sid of actor.equippedSkillIds) {
    if (sid === LIDAR_SKILL_ID) continue;
    const sk = getSkillById(sid, params.adminConfig);
    if (!sk || !SUPPORT_HEAL_SHIELD_REVIVE_EFFECTS.has(sk.effectKind)) continue;
    const skUsability = canUnitUseSkill(
      actor,
      sid,
      params.adminConfig,
      params.turnLockedSkillIds
    );
    if (!skUsability.canUse) continue;
    if (spAfterCast < skUsability.spCost) return false;
  }

  return hasStealthedOpponent ? true : rng() < 0.25;
}
