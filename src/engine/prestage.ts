import { getScaledSkillStats, getSkillById } from '../data/skills';
import type {
  ActiveStatusEffect,
  AdminConfig,
  CombatUnit,
  PrestageConfig,
  SkillEffectKind,
  StatusEffectType,
} from '../types/game';
import { getSkillStep } from './turnPhase';

export const MIN_PRESTAGE_COUNTDOWN_SEC = 0;
export const MAX_PRESTAGE_COUNTDOWN_SEC = 10;

export const DEFAULT_PRESTAGE_CONFIG: PrestageConfig = {
  enabled: false,
  countdownSec: 3,
};

export function clonePrestageConfig(cfg: PrestageConfig): PrestageConfig {
  return { ...sanitizePrestageConfig(cfg) };
}

export function sanitizePrestageConfig(raw: unknown): PrestageConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const enabled =
    typeof obj.enabled === 'boolean'
      ? obj.enabled
      : DEFAULT_PRESTAGE_CONFIG.enabled;
  const rawSec = Number(obj.countdownSec);
  const countdownSec = Number.isFinite(rawSec)
    ? Math.max(
        MIN_PRESTAGE_COUNTDOWN_SEC,
        Math.min(MAX_PRESTAGE_COUNTDOWN_SEC, Math.round(rawSec))
      )
    : DEFAULT_PRESTAGE_CONFIG.countdownSec;
  return {
    enabled,
    countdownSec,
  };
}

export const DEBUFF_TYPES = new Set<StatusEffectType>([
  'burn',
  'shield_break',
  'shield_cracked',
  'slow',
  'silence',
  'vulnerable',
  'def_down',
]);

export function addOrRefreshStatus(
  statuses: ActiveStatusEffect[],
  entry: ActiveStatusEffect
): ActiveStatusEffect[] {
  const filtered = statuses.filter((s) => s.type !== entry.type);
  return [...filtered, { ...entry, isDebuff: DEBUFF_TYPES.has(entry.type) }];
}

const PURE_STAT_BUFF_EFFECTS: Readonly<
  Partial<Record<SkillEffectKind, StatusEffectType>>
> = {
  buff_def: 'def_up',
  buff_eva: 'eva_up',
  buff_primary_dmg: 'primary_dmg_up',
  buff_skill_dmg: 'skill_dmg_up',
  buff_speed: 'spd_up',
  team_atk_up: 'atk_up',
  team_def_up: 'def_up',
  team_eva_up: 'eva_up',
};

export function isPureStatBuffEffect(effectKind: SkillEffectKind): boolean {
  return effectKind in PURE_STAT_BUFF_EFFECTS;
}

export interface ApplyPrestageBuffsResult {
  units: CombatUnit[];
  appliedByUnit: Record<string, string[]>;
}

export function applyPrestageBuffs(
  units: CombatUnit[],
  adminConfig?: Partial<AdminConfig>
): ApplyPrestageBuffsResult {
  const cfg = sanitizePrestageConfig(adminConfig?.prestage);
  const nextUnits = units.map((u) => ({
    ...u,
    statuses: [...u.statuses],
  }));
  const appliedByUnit: Record<string, string[]> = {};

  if (!cfg.enabled) {
    return { units: nextUnits, appliedByUnit };
  }

  const recordApplied = (unitId: string, skillId: string) => {
    const list = appliedByUnit[unitId] ?? [];
    if (!list.includes(skillId)) {
      appliedByUnit[unitId] = [...list, skillId];
    }
  };

  for (let i = 0; i < nextUnits.length; i++) {
    const caster = nextUnits[i];
    if (!caster.alive) continue;

    for (const skillId of caster.equippedSkillIds) {
      const skill = getSkillById(skillId);
      if (!skill || skill.category === 'passive') continue;
      if (getSkillStep(skill) !== 2) continue;

      const statusType = PURE_STAT_BUFF_EFFECTS[skill.effectKind];
      if (!statusType) continue;

      const skillLevel = caster.skillLevels[skill.id] ?? caster.skillLevel ?? 1;
      const scaled = getScaledSkillStats(skill, skillLevel);
      const turnsRemaining = skill.duration ?? 3;
      const statusEntry: ActiveStatusEffect = {
        type: statusType,
        turnsRemaining,
        magnitude: scaled.buffMagnitude,
        sourceSkillId: skill.id,
      };

      if (skill.targetType === 'all_allies') {
        for (let j = 0; j < nextUnits.length; j++) {
          const ally = nextUnits[j];
          if (ally.side !== caster.side || !ally.alive) continue;
          nextUnits[j] = {
            ...ally,
            statuses: addOrRefreshStatus(ally.statuses, statusEntry),
          };
          recordApplied(ally.id, skill.id);
        }
      } else if (
        skill.targetType === 'self' ||
        skill.targetType === 'single_ally'
      ) {
        const currentCaster = nextUnits[i];
        nextUnits[i] = {
          ...currentCaster,
          statuses: addOrRefreshStatus(currentCaster.statuses, statusEntry),
        };
        recordApplied(currentCaster.id, skill.id);
      }
    }
  }

  return { units: nextUnits, appliedByUnit };
}
