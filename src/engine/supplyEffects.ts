import type { CombatUnit, SupplyEffect } from '../types/game';

export interface SupplyEffectGains {
  hp: number;
  shield: number;
  sp: number;
}

export interface ApplySupplyEffectsResult {
  unit: CombatUnit;
  gains: SupplyEffectGains;
}

/**
 * Applies battle supply effects cleanly without mutating the input CombatUnit.
 * Values are rounded percentages of derived max pools, clamped to max, and
 * shield restoration yields 0 while `shield_break` is active.
 */
export function applySupplyEffects(
  unit: CombatUnit,
  effects: readonly SupplyEffect[]
): ApplySupplyEffectsResult {
  const gains: SupplyEffectGains = { hp: 0, shield: 0, sp: 0 };
  if (!unit.alive || effects.length === 0) {
    return { unit, gains };
  }

  const shieldBroken = unit.statuses.some(
    (s) => s.type === 'shield_break' && s.turnsRemaining > 0
  );

  let hp = unit.hp;
  let shield = unit.shield;
  let sp = unit.sp;

  for (const eff of effects) {
    const rawVal = Number.isFinite(eff.value) && eff.value > 0 ? eff.value : 0;
    if (rawVal <= 0) continue;

    if (eff.kind === 'heal_hp_pct' || eff.kind === 'heal_hp') {
      const maxHp = Math.max(0, unit.derived.maxHp);
      const rawAdd =
        eff.kind === 'heal_hp'
          ? Math.round(rawVal)
          : Math.round((maxHp * rawVal) / 100);
      const add = Math.min(Math.max(0, rawAdd), Math.max(0, maxHp - hp));
      gains.hp += add;
      hp += add;
    } else if (
      eff.kind === 'restore_shield_pct' ||
      eff.kind === 'restore_shield'
    ) {
      if (shieldBroken) continue;
      const maxShield = Math.max(0, unit.derived.maxShield);
      const rawAdd =
        eff.kind === 'restore_shield'
          ? Math.round(rawVal)
          : Math.round((maxShield * rawVal) / 100);
      const add = Math.min(
        Math.max(0, rawAdd),
        Math.max(0, maxShield - shield)
      );
      gains.shield += add;
      shield += add;
    } else if (eff.kind === 'restore_sp_pct' || eff.kind === 'restore_sp') {
      const maxSp = Math.max(0, unit.derived.maxSp);
      const rawAdd =
        eff.kind === 'restore_sp'
          ? Math.round(rawVal)
          : Math.round((maxSp * rawVal) / 100);
      const add = Math.min(Math.max(0, rawAdd), Math.max(0, maxSp - sp));
      gains.sp += add;
      sp += add;
    }
  }

  return {
    unit: {
      ...unit,
      hp,
      shield,
      sp,
    },
    gains,
  };
}
