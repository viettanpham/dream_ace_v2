import type { CombatRow, FormationConfig, MechClassId } from '../types/game';

export const FORMATION_ROWS: readonly CombatRow[] = ['front', 'middle', 'back'] as const;

/**
 * Centralized 3-row formation configuration (editable in Admin CP).
 * - Row capacities default: front 8, middle 8, back 8 (max 8 per side).
 * - Row modifiers default:
 *   - front:  +10% DEF, 0% damage
 *   - middle: neutral (0% DEF, 0% damage)
 *   - back:   -10% DEF, +10% damage for ranged weapons
 */
export const DEFAULT_FORMATION_CONFIG: FormationConfig = {
  rowCapacities: {
    front: 8,
    middle: 8,
    back: 8,
  },
  maxUnitsPerSide: 8,
  rowModifiers: {
    front: {
      defensePct: 0.1,
      damagePct: 0,
      rangedDamagePct: 0,
    },
    middle: {
      defensePct: 0,
      damagePct: 0,
      rangedDamagePct: 0,
    },
    back: {
      defensePct: -0.1,
      damagePct: 0,
      rangedDamagePct: 0.1,
    },
  },
};

export interface ClassFormationPreference {
  /** Preferred rows in priority order */
  preferred: CombatRow[];
  /** Whether this class naturally balances across its first two preferred rows */
  flexPair?: [CombatRow, CombatRow];
  /** Lower number places first so strict-row classes claim their primary row before flex classes */
  placementPriority: number;
}

/**
 * Default auto-placement preferences by class:
 * - Siege (tank) -> front  (['front', 'middle', 'back'])
 * - Striker      -> middle (['middle', 'front', 'back'])
 * - Interceptor  -> middle (['middle', 'front', 'back'])
 * - Support      -> back   (['back', 'middle', 'front'])
 */
export const CLASS_FORMATION_PREFERENCES: Record<MechClassId, ClassFormationPreference> = {
  siege: {
    preferred: ['front', 'middle', 'back'],
    placementPriority: 1,
  },
  support: {
    preferred: ['back', 'middle', 'front'],
    placementPriority: 1,
  },
  striker: {
    preferred: ['middle', 'front', 'back'],
    placementPriority: 2,
  },
  interceptor: {
    preferred: ['middle', 'front', 'back'],
    placementPriority: 2,
  },
};

export function cloneFormationConfig(
  cfg: FormationConfig = DEFAULT_FORMATION_CONFIG
): FormationConfig {
  return {
    rowCapacities: {
      front: cfg.rowCapacities.front,
      middle: cfg.rowCapacities.middle,
      back: cfg.rowCapacities.back,
    },
    maxUnitsPerSide: cfg.maxUnitsPerSide,
    rowModifiers: {
      front: { ...cfg.rowModifiers.front },
      middle: { ...cfg.rowModifiers.middle },
      back: { ...cfg.rowModifiers.back },
    },
  };
}
