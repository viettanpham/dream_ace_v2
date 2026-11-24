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
    const pct = Number.isFinite(eff.value) && eff.value > 0 ? eff.value : 0;
    if (pct <= 0) continue;

    if (eff.kind === 'heal_hp_pct') {
      const maxHp = Math.max(0, unit.derived.maxHp);
      const rawAdd = Math.round((maxHp * pct) / 100);
      const nextHp = Math.min(maxHp, hp + Math.max(0, rawAdd));
      gains.hp += Math.max(0, nextHp - hp);
      hp = nextHp;
    } else if (eff.kind === 'restore_shield_pct') {
      if (shieldBroken) continue;
      const maxShield = Math.max(0, unit.derived.maxShield);
      const rawAdd = Math.round((maxShield * pct) / 100);
      const nextShield = Math.min(maxShield, shield + Math.max(0, rawAdd));
      gains.shield += Math.max(0, nextShield - shield);
      shield = nextShield;
    } else if (eff.kind === 'restore_sp_pct') {
      const maxSp = Math.max(0, unit.derived.maxSp);
      const rawAdd = Math.round((maxSp * pct) / 100);
      const nextSp = Math.min(maxSp, sp + Math.max(0, rawAdd));
      gains.sp += Math.max(0, nextSp - sp);
      sp = nextSp;
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
