import {
  getEntryForEngineType,
  getStatusEntry,
} from '../data/statusEffects';
import type {
  ActiveStatusEffect,
  CombatUnit,
  StatusEffectType,
  SupplyEffect,
} from '../types/game';
import { applyStatus } from './statusEngine';

export interface SupplyEffectGains {
  hp: number;
  shield: number;
  sp: number;
}

export interface ApplySupplyEffectsOptions {
  rng?: () => number;
}

export interface ApplySupplyEffectsResult {
  unit: CombatUnit;
  gains: SupplyEffectGains;
  resetSkillIds: string[];
  cleansedCount: number;
  dodgePts: number;
  dodgeRounds: number;
  speedPct: number;
  speedRounds: number;
}

const LEGACY_DEBUFF_TYPES: ReadonlySet<StatusEffectType> = new Set([
  'burn',
  'slow',
  'silence',
  'shield_break',
  'shield_cracked',
  'vulnerable',
  'def_down',
]);

export function isSupplyCleanseDebuff(status: ActiveStatusEffect): boolean {
  if (!status || status.turnsRemaining <= 0) return false;
  if (status.isDebuff) return true;
  if (LEGACY_DEBUFF_TYPES.has(status.type)) return true;
  if (status.type === 'registry_effect' && status.registryId) {
    return getStatusEntry(status.registryId)?.polarity === 'debuff';
  }
  return getEntryForEngineType(status.type)?.polarity === 'debuff';
}

function applyHasteStatus(
  statuses: ActiveStatusEffect[],
  speedPct: number,
  durationRounds: number
): ActiveStatusEffect[] {
  const incomingMag = speedPct / 100;
  const incomingTurns = Math.max(1, Math.round(durationRounds));
  const existingIdx = statuses.findIndex(
    (s) => s.type === 'spd_up' && s.turnsRemaining > 0
  );
  if (existingIdx < 0) {
    const cleaned = statuses.filter((s) => s.type !== 'spd_up');
    return [
      ...cleaned,
      {
        type: 'spd_up',
        turnsRemaining: incomingTurns,
        magnitude: incomingMag,
        isDebuff: false,
      },
    ];
  }

  const existing = statuses[existingIdx];
  const existingMag = existing.magnitude ?? 0.5;
  const eps = 1e-6;

  // Stronger tier overrides weaker; same tier refreshes remaining rounds to full;
  // weaker tier never lowers or changes an active stronger one.
  if (incomingMag > existingMag + eps) {
    return statuses.map((s, idx) =>
      idx === existingIdx
        ? {
            type: 'spd_up',
            turnsRemaining: incomingTurns,
            magnitude: incomingMag,
            isDebuff: false,
          }
        : s
    );
  }
  if (Math.abs(incomingMag - existingMag) <= eps) {
    return statuses.map((s, idx) =>
      idx === existingIdx
        ? {
            ...existing,
            turnsRemaining: Math.max(existing.turnsRemaining, incomingTurns),
            magnitude: existingMag,
            isDebuff: false,
          }
        : s
    );
  }
  return statuses;
}

/**
 * Applies battle supply effects cleanly without mutating the input CombatUnit.
 * Values are rounded percentages of derived max pools, clamped to max, and
 * shield restoration yields 0 while `shield_break` is active.
 */
export function applySupplyEffects(
  unit: CombatUnit,
  effects: readonly SupplyEffect[],
  opts?: ApplySupplyEffectsOptions
): ApplySupplyEffectsResult {
  const gains: SupplyEffectGains = { hp: 0, shield: 0, sp: 0 };
  const resetSkillIds: string[] = [];
  let cleansedCount = 0;
  let dodgePts = 0;
  let dodgeRounds = 0;
  let speedPct = 0;
  let speedRounds = 0;

  if (!unit.alive || effects.length === 0) {
    return {
      unit,
      gains,
      resetSkillIds,
      cleansedCount,
      dodgePts,
      dodgeRounds,
      speedPct,
      speedRounds,
    };
  }

  const shieldBroken = unit.statuses.some(
    (s) => s.type === 'shield_break' && s.turnsRemaining > 0
  );

  let hp = unit.hp;
  let shield = unit.shield;
  let sp = unit.sp;
  let nextStatuses = unit.statuses.map((s) => ({ ...s }));
  let nextSkillCooldowns = { ...(unit.skillCooldowns ?? {}) };
  let cooldownsChanged = false;
  let statusesChanged = false;
  const rand = opts?.rng ?? Math.random;

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
    } else if (eff.kind === 'reset_cooldowns') {
      const maxReset = Math.max(0, Math.floor(rawVal));
      if (maxReset > 0) {
        const orderMap = new Map<string, number>();
        (unit.equippedSkillIds ?? []).forEach((sid, idx) => {
          orderMap.set(sid, idx);
        });
        const onCooldown = Object.entries(nextSkillCooldowns)
          .filter(
            ([, cd]) => typeof cd === 'number' && Number.isFinite(cd) && cd > 0
          )
          .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            const idxA = orderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
            const idxB = orderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
            if (idxA !== idxB) return idxA - idxB;
            return a[0].localeCompare(b[0]);
          });
        const picked = onCooldown.slice(0, maxReset).map(([sid]) => sid);
        for (const sid of picked) {
          delete nextSkillCooldowns[sid];
          resetSkillIds.push(sid);
          cooldownsChanged = true;
        }
      }
    } else if (eff.kind === 'cleanse_debuffs') {
      const maxCleanse = Math.max(0, Math.floor(rawVal));
      if (maxCleanse > 0) {
        const debuffIndices: number[] = [];
        nextStatuses.forEach((st, idx) => {
          if (isSupplyCleanseDebuff(st)) debuffIndices.push(idx);
        });
        if (debuffIndices.length > 0) {
          for (let i = debuffIndices.length - 1; i > 0; i--) {
            const j = Math.min(i, Math.floor(rand() * (i + 1)));
            const tmp = debuffIndices[i];
            debuffIndices[i] = debuffIndices[j];
            debuffIndices[j] = tmp;
          }
          const removeSet = new Set(debuffIndices.slice(0, maxCleanse));
          nextStatuses = nextStatuses.filter((_, idx) => !removeSet.has(idx));
          cleansedCount += removeSet.size;
          statusesChanged = true;
        }
      }
    } else if (eff.kind === 'grant_dodge') {
      const flareEntry = getStatusEntry('ENG_flare_dodge');
      const rounds = Math.max(
        1,
        Math.round(eff.durationRounds ?? flareEntry?.durationTurns ?? 1)
      );
      if (flareEntry) {
        nextStatuses = applyStatus(nextStatuses, flareEntry, {
          value: rawVal,
          turns: rounds,
          sourceId: `supply_flare_${rawVal}`,
        });
        statusesChanged = true;
      }
      dodgePts = rawVal;
      dodgeRounds = rounds;
    } else if (eff.kind === 'grant_speed_pct') {
      const rounds = Math.max(1, Math.round(eff.durationRounds ?? 3));
      nextStatuses = applyHasteStatus(nextStatuses, rawVal, rounds);
      statusesChanged = true;
      speedPct = rawVal;
      speedRounds = rounds;
    }
  }

  return {
    unit: {
      ...unit,
      hp,
      shield,
      sp,
      ...(statusesChanged ? { statuses: nextStatuses } : {}),
      ...(cooldownsChanged ? { skillCooldowns: nextSkillCooldowns } : {}),
    },
    gains,
    resetSkillIds,
    cleansedCount,
    dodgePts,
    dodgeRounds,
    speedPct,
    speedRounds,
  };
}
