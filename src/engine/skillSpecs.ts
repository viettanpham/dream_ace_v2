import { sanitizeRestorePctCap } from '../data/balance';
import { getStatusEntry } from '../data/statusEffects';
import type {
  AdminConfig,
  BattleEvent,
  CombatFxEvent,
  CombatLogEntry,
  CombatUnit,
  FloatingPopup,
  SkillDefinition,
  SkillEffectSpec,
  SkillEffectSpecKind,
} from '../types/game';
import { applyStatus } from './statusEngine';
import { applySupplyEffects } from './supplyEffects';

export const SKILL_EFFECT_SPEC_KINDS: readonly SkillEffectSpecKind[] = [
  'damage',
  'heal_hp_pct',
  'restore_shield_pct',
  'restore_sp',
  'apply_status',
];

const VALID_SPEC_KIND_SET = new Set<string>(SKILL_EFFECT_SPEC_KINDS);

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/**
 * Pure validator for a single SkillEffectSpec.
 * Returns [] when valid, or an array of machine-readable error codes.
 */
export function validateSkillSpec(spec: unknown): string[] {
  const errs: string[] = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return ['spec_not_object'];
  }
  const s = spec as Record<string, unknown>;

  if (s.target !== undefined && s.target !== 'skill' && s.target !== 'self') {
    errs.push('invalid_target');
  }

  if (typeof s.kind !== 'string' || !VALID_SPEC_KIND_SET.has(s.kind)) {
    errs.push('unknown_kind');
    return errs;
  }

  switch (s.kind as SkillEffectSpecKind) {
    case 'damage':
      if (!isFiniteNumber(s.powerMultiplier) || s.powerMultiplier < 0.1 || s.powerMultiplier > 5) {
        errs.push('invalid_powerMultiplier');
      }
      break;

    case 'heal_hp_pct':
    case 'restore_shield_pct':
      if (!isFiniteNumber(s.pct) || s.pct <= 0 || s.pct > 1) {
        errs.push('invalid_pct');
      }
      break;

    case 'restore_sp': {
      const hasAmount = s.amount !== undefined;
      const hasValue = s.value !== undefined;
      if (hasAmount && !isFiniteNumber(s.amount)) {
        errs.push('invalid_restore_sp');
        break;
      }
      if (hasValue && !isFiniteNumber(s.value)) {
        errs.push('invalid_restore_sp');
        break;
      }
      const flat = hasAmount ? s.amount : s.value;
      if (!isFiniteNumber(flat) || flat <= 0 || flat > 200) {
        errs.push('invalid_restore_sp');
      }
      break;
    }

    case 'apply_status': {
      if (typeof s.statusId !== 'string' || !s.statusId.trim() || !getStatusEntry(s.statusId.trim())) {
        errs.push('unknown_statusId');
      }
      if (s.value !== undefined && (!isFiniteNumber(s.value) || s.value < 0)) {
        errs.push('invalid_status_value');
      }
      if (s.duration !== undefined && (!isFiniteNumber(s.duration) || s.duration < 1 || s.duration > 10)) {
        errs.push('invalid_duration');
      }
      break;
    }
  }

  return errs;
}

/**
 * Validator hook registered in EFFECT_KIND_VALIDATORS for effectKind: 'spec'.
 */
export function validateSpecSkillRow(row: Record<string, unknown>): string[] {
  const errs: string[] = [];
  if (!Array.isArray(row.effects) || row.effects.length < 1 || row.effects.length > 3) {
    errs.push('effects_length_1_to_3_required');
    return errs;
  }
  row.effects.forEach((spec, idx) => {
    const sub = validateSkillSpec(spec);
    for (const e of sub) {
      errs.push(`effects[${idx}].${e}`);
    }
  });
  return errs;
}

export interface ScaledSkillSpecsLike {
  effectMult?: number;
  effects?: SkillEffectSpec[];
}

export interface SpecDamageHandlerResult {
  attackerAfter: CombatUnit;
  targetAfter: CombatUnit;
  logs: CombatLogEntry[];
  popups: FloatingPopup[];
  destroyed: boolean;
  counteredAttackerKilled: boolean;
}

export interface ResolveSkillSpecsContext {
  units?: CombatUnit[];
  round?: number;
  spCost?: number;
  adminConfig?: Partial<AdminConfig> | null;
  rng?: () => number;
  shieldBreakAtTurnStart?: boolean;
  fromSlotIndex?: number;
  getSlotIndex?: (units: CombatUnit[], unitId: string) => number;
  nextId?: (prefix: string) => string;
  events?: BattleEvent[];
  popups?: FloatingPopup[];
  logs?: CombatLogEntry[];
  destroyedUnitIds?: string[];
  applyDamageToUnit?: (
    allUnits: CombatUnit[],
    attacker: CombatUnit,
    target: CombatUnit,
    rawPower: number,
    options: {
      round: number;
      actionMeta: { skillId: string; hitIndex: number; totalHits: number };
      tag: 'SKILL';
      adminConfig?: Partial<AdminConfig>;
      rng?: () => number;
      events?: BattleEvent[];
    }
  ) => SpecDamageHandlerResult;
}

export interface ResolveSkillSpecsResult {
  updatedUnits: CombatUnit[];
  logEntries: CombatLogEntry[];
  events: BattleEvent[];
  popups: FloatingPopup[];
  fxEvent: CombatFxEvent | null;
  destroyedUnitIds: string[];
  soundCue: 'laser' | 'heavy' | 'heal' | 'shield' | 'defend' | 'destroy';
}

export function scaleSkillEffectSpecs(
  effects: readonly SkillEffectSpec[] | undefined,
  effectMult: number,
  restoreCap: number
): SkillEffectSpec[] {
  if (!Array.isArray(effects) || effects.length === 0) return [];
  const mult = Number.isFinite(effectMult) && effectMult > 0 ? effectMult : 1;
  return effects.map((eff) => {
    if (eff.kind === 'damage') {
      return {
        ...eff,
        powerMultiplier: Number(((eff.powerMultiplier ?? 1) * mult).toFixed(4)),
      };
    }
    if (eff.kind === 'heal_hp_pct' || eff.kind === 'restore_shield_pct') {
      return {
        ...eff,
        pct: Math.min(restoreCap, Number(((eff.pct ?? 0) * mult).toFixed(4))),
      };
    }
    if (eff.kind === 'restore_sp') {
      const base = eff.amount ?? eff.value ?? 0;
      return {
        ...eff,
        amount: Math.round(base * mult),
      };
    }
    if (eff.kind === 'apply_status' && eff.value !== undefined) {
      return {
        ...eff,
        value: Number((eff.value * mult).toFixed(4)),
      };
    }
    return { ...eff };
  });
}

let fallbackUid = 0;
function defaultNextId(prefix: string): string {
  fallbackUid += 1;
  return `${prefix}_spec_${fallbackUid}`;
}

export function resolveSkillSpecs(
  act: CombatUnit,
  skill: SkillDefinition,
  targets: CombatUnit[],
  scaled?: ScaledSkillSpecsLike | null,
  ctx?: ResolveSkillSpecsContext
): ResolveSkillSpecsResult {
  const round = ctx?.round ?? 1;
  const spCost = ctx?.spCost ?? skill.spCost;
  const adminConfig = ctx?.adminConfig ?? undefined;
  const restoreCap = sanitizeRestorePctCap(adminConfig?.restorePctCap);
  const nextId = ctx?.nextId ?? defaultNextId;
  const events = ctx?.events ?? [];
  const popups = ctx?.popups ?? [];
  const logs = ctx?.logs ?? [];
  const destroyedUnitIds = ctx?.destroyedUnitIds ?? [];
  const fromSlotIndex = ctx?.fromSlotIndex ?? 0;

  const baseUnits: CombatUnit[] = ctx?.units ? [...ctx.units] : [act];
  if (!ctx?.units) {
    for (const t of targets) {
      if (!baseUnits.some((u) => u.id === t.id)) {
        baseUnits.push(t);
      }
    }
  }
  const workingUnits = baseUnits.map((u) =>
    u.id === act.id ? { ...act } : { ...u }
  );

  const getSlot = (unitId: string): number => {
    if (ctx?.getSlotIndex) return ctx.getSlotIndex(workingUnits, unitId);
    const target = workingUnits.find((u) => u.id === unitId);
    if (!target) return 0;
    return Math.max(
      0,
      workingUnits.filter((u) => u.side === target.side).findIndex((u) => u.id === unitId)
    );
  };

  const effectiveSpecs: SkillEffectSpec[] =
    scaled?.effects && scaled.effects.length > 0
      ? scaled.effects
      : scaleSkillEffectSpecs(skill.effects, scaled?.effectMult ?? 1, restoreCap);

  let totalHpHealed = 0;
  let totalShieldRestored = 0;
  let totalSpRestored = 0;
  let hadDamage = false;
  let hadHeal = false;
  let hadShield = false;
  let hadSp = false;
  let shieldBlockLogged = false;
  let lastHealTarget: CombatUnit | null = null;
  let lastShieldTarget: CombatUnit | null = null;
  let lastSpTarget: CombatUnit | null = null;
  const affectedSlots: number[] = [];
  let fxSide = act.side;

  const recordSlot = (unit: CombatUnit) => {
    fxSide = unit.side;
    const idx = getSlot(unit.id);
    if (!affectedSlots.includes(idx)) affectedSlots.push(idx);
  };

  const findUnitIndex = (id: string) => workingUnits.findIndex((u) => u.id === id);

  for (const eff of effectiveSpecs) {
    const rawTargets =
      eff.target === 'self'
        ? [workingUnits[findUnitIndex(act.id)] ?? act]
        : targets.map((t) => workingUnits[findUnitIndex(t.id)] ?? t);

    const effTargets = rawTargets.filter((u) => u && u.alive);

    for (const targetSnapshot of effTargets) {
      const tIdx = findUnitIndex(targetSnapshot.id);
      const aIdx = findUnitIndex(act.id);
      if (tIdx < 0 || aIdx < 0) continue;
      const currentActor = workingUnits[aIdx];
      const currentTarget = workingUnits[tIdx];
      if (!currentTarget.alive) continue;

      if (eff.kind === 'damage') {
        hadDamage = true;
        recordSlot(currentTarget);
        const mult = eff.powerMultiplier ?? 1;
        const rawPower = currentActor.derived.attackPower * 1.45 * mult;

        if (ctx?.applyDamageToUnit) {
          const dmgRes = ctx.applyDamageToUnit(
            workingUnits,
            currentActor,
            currentTarget,
            rawPower,
            {
              round,
              actionMeta: { skillId: skill.id, hitIndex: 1, totalHits: 1 },
              tag: 'SKILL',
              adminConfig: adminConfig ?? undefined,
              rng: ctx.rng,
              events,
            }
          );
          workingUnits[aIdx] = dmgRes.attackerAfter;
          workingUnits[tIdx] = dmgRes.targetAfter;
          logs.push(...dmgRes.logs);
          popups.push(...dmgRes.popups);
          if (dmgRes.destroyed && !destroyedUnitIds.includes(currentTarget.id)) {
            destroyedUnitIds.push(currentTarget.id);
          }
          if (
            dmgRes.counteredAttackerKilled &&
            !destroyedUnitIds.includes(currentActor.id)
          ) {
            destroyedUnitIds.push(currentActor.id);
          }
        } else {
          const mitigation =
            65 / (65 + Math.max(0, currentTarget.derived.defenseRating));
          const finalDmg = Math.max(6, Math.round(rawPower * mitigation));
          const shieldAbsorbed = Math.min(currentTarget.shield, finalDmg);
          const hullDamage = Math.min(currentTarget.hp, finalDmg - shieldAbsorbed);
          const nextHp = currentTarget.hp - hullDamage;
          const nextShield = currentTarget.shield - shieldAbsorbed;
          const destroyed = nextHp <= 0;
          workingUnits[tIdx] = {
            ...currentTarget,
            hp: nextHp,
            shield: nextShield,
            alive: !destroyed,
            animState: destroyed ? 'destroyed' : 'hit',
          };
          popups.push({
            id: nextId('pop'),
            unitId: currentTarget.id,
            text: `-${shieldAbsorbed + hullDamage}`,
            tone: 'damage',
          });
          events.push({
            id: nextId('ev'),
            round,
            turn: 0,
            actorId: currentActor.id,
            targetId: currentTarget.id,
            type: 'damage',
            amount: shieldAbsorbed + hullDamage,
            shieldAbsorbed,
            hpDamage: hullDamage,
            skillId: skill.id,
          });
          if (destroyed && !destroyedUnitIds.includes(currentTarget.id)) {
            destroyedUnitIds.push(currentTarget.id);
          }
        }
        continue;
      }

      if (eff.kind === 'heal_hp_pct') {
        hadHeal = true;
        recordSlot(currentTarget);
        const healPowerMult = 1 + (currentActor.derived.healPowerPct ?? 0) / 100;
        const cappedPct = Math.min(restoreCap, Math.max(0, eff.pct ?? 0));
        const applied = applySupplyEffects(currentTarget, [
          { kind: 'heal_hp_pct', value: cappedPct * healPowerMult * 100 },
        ]);
        const healAmt = applied.gains.hp;
        totalHpHealed += healAmt;
        lastHealTarget = applied.unit;
        workingUnits[tIdx] = {
          ...applied.unit,
          animState: currentTarget.id === currentActor.id ? 'casting' : 'shielded',
        };
        if (healAmt > 0) {
          events.push({
            id: nextId('ev'),
            round,
            turn: 0,
            actorId: currentActor.id,
            targetId: currentTarget.id,
            type: 'heal',
            amount: healAmt,
            skillId: skill.id,
          });
        }
        popups.push({
          id: nextId('pop'),
          unitId: currentTarget.id,
          text: `+${healAmt} HP`,
          tone: 'heal',
        });
        continue;
      }

      if (eff.kind === 'restore_shield_pct') {
        hadShield = true;
        recordSlot(currentTarget);
        const shieldBlocked =
          (currentTarget.id === currentActor.id &&
            Boolean(ctx?.shieldBreakAtTurnStart)) ||
          currentTarget.statuses.some(
            (s) => s.type === 'shield_break' && s.turnsRemaining > 0
          );
        // Removing 'shield_cracked' (DB12) on target
        const cleanedStatuses = currentTarget.statuses.filter(
          (s) => s.type !== 'shield_cracked' && s.registryId !== 'DB12'
        );
        const baseTarget: CombatUnit = {
          ...currentTarget,
          statuses: cleanedStatuses,
        };

        if (shieldBlocked) {
          workingUnits[tIdx] = {
            ...baseTarget,
            animState: currentTarget.id === currentActor.id ? 'casting' : 'shielded',
          };
          popups.push({
            id: nextId('pop'),
            unitId: currentTarget.id,
            text: '+0 SHD',
            tone: 'shield',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: currentActor.name,
            actorSide: currentActor.side,
            tag: 'SHIELD',
            templateKey: 'log.shieldBreakBlocked',
            params: {
              actor: currentActor.name,
              target: currentTarget.name,
              skillId: skill.id,
            },
          });
          shieldBlockLogged = true;
          lastShieldTarget = workingUnits[tIdx];
        } else {
          const shieldPowerMult =
            1 + (currentActor.derived.shieldPowerPct ?? 0) / 100;
          const cappedPct = Math.min(restoreCap, Math.max(0, eff.pct ?? 0));
          const applied = applySupplyEffects(baseTarget, [
            {
              kind: 'restore_shield_pct',
              value: cappedPct * shieldPowerMult * 100,
            },
          ]);
          const shdGain = applied.gains.shield;
          totalShieldRestored += shdGain;
          lastShieldTarget = applied.unit;
          workingUnits[tIdx] = {
            ...applied.unit,
            animState:
              currentTarget.id === currentActor.id ? 'casting' : 'shielded',
          };
          if (shdGain > 0) {
            events.push({
              id: nextId('ev'),
              round,
              turn: 0,
              actorId: currentActor.id,
              targetId: currentTarget.id,
              type: 'shield_grant',
              amount: shdGain,
              skillId: skill.id,
            });
          }
          popups.push({
            id: nextId('pop'),
            unitId: currentTarget.id,
            text: `+${shdGain} SHD`,
            tone: 'shield',
          });
        }
        continue;
      }

      if (eff.kind === 'restore_sp') {
        hadSp = true;
        recordSlot(currentTarget);
        const flat = Math.max(0, eff.amount ?? eff.value ?? 0);
        const applied = applySupplyEffects(currentTarget, [
          { kind: 'restore_sp', value: flat },
        ]);
        const spGain = applied.gains.sp;
        totalSpRestored += spGain;
        lastSpTarget = applied.unit;
        workingUnits[tIdx] = {
          ...applied.unit,
          animState: currentTarget.id === currentActor.id ? 'casting' : 'shielded',
        };
        popups.push({
          id: nextId('pop'),
          unitId: currentTarget.id,
          text: `+${spGain} SP`,
          tone: 'buff',
        });
        continue;
      }

      if (eff.kind === 'apply_status' && eff.statusId) {
        const entry = getStatusEntry(eff.statusId);
        if (!entry) continue;
        recordSlot(currentTarget);
        const turns = eff.duration ?? entry.durationTurns;
        const mag = eff.value ?? entry.defaultValue;
        const nextStatuses = applyStatus(currentTarget.statuses, entry, {
          turns,
          value: mag,
          sourceSkillId: skill.id,
        });
        workingUnits[tIdx] = {
          ...currentTarget,
          statuses: nextStatuses,
        };
        popups.push({
          id: nextId('pop'),
          unitId: currentTarget.id,
          text: entry.nameEn,
          tone: entry.polarity === 'buff' ? 'buff' : 'status',
        });
        logs.push({
          id: nextId('log'),
          round,
          actorName: currentActor.name,
          actorSide: currentActor.side,
          tag: 'STATUS',
          templateKey: 'log.statusApplied',
          params: {
            target: currentTarget.name,
            status: entry.id,
            statusId: entry.id,
            turns,
          },
        });
      }
    }
  }

  // Emit canonical cast summary logs for non-damage specs matching existing heal / shield cases
  if (skill.targetType === 'all_allies' && (hadHeal || hadShield)) {
    logs.push({
      id: nextId('log'),
      round,
      actorName: act.name,
      actorSide: act.side,
      tag: 'HEAL',
      templateKey: 'log.healSquad',
      params: {
        actor: act.name,
        skillId: skill.id,
        spCost,
        total: totalHpHealed + totalShieldRestored,
      },
    });
  } else {
    if (hadHeal && lastHealTarget) {
      logs.push({
        id: nextId('log'),
        round,
        actorName: act.name,
        actorSide: act.side,
        tag: 'HEAL',
        templateKey: 'log.healSingle',
        params: {
          actor: act.name,
          target: lastHealTarget.name,
          skillId: skill.id,
          amount: totalHpHealed,
        },
      });
    }
    if (hadShield && lastShieldTarget && !shieldBlockLogged) {
      logs.push({
        id: nextId('log'),
        round,
        actorName: act.name,
        actorSide: act.side,
        tag: 'SHIELD',
        templateKey: 'log.shieldSingle',
        params: {
          actor: act.name,
          target: lastShieldTarget.name,
          skillId: skill.id,
          amount: totalShieldRestored,
        },
      });
    }
  }

  if (hadSp && lastSpTarget) {
    logs.push({
      id: nextId('log'),
      round,
      actorName: act.name,
      actorSide: act.side,
      tag: 'HEAL',
      templateKey: 'log.energize',
      params: {
        actor: act.name,
        target: lastSpTarget.name,
        skillId: skill.id,
        amount: totalSpRestored,
      },
    });
  }

  const fxEvent: CombatFxEvent | null = hadDamage
    ? {
        id: nextId('fx'),
        kind: 'laser',
        fromSide: act.side,
        fromSlotIndex,
        toSide: fxSide,
        toSlotIndices: affectedSlots,
        accentHex: '#38BDF8',
      }
    : hadHeal
    ? {
        id: nextId('fx'),
        kind: 'heal',
        tone: 'heal',
        fromSide: act.side,
        fromSlotIndex,
        toSide: act.side,
        toSlotIndices: affectedSlots,
        accentHex: '#10B981',
      }
    : hadShield
    ? {
        id: nextId('fx'),
        kind: 'heal',
        tone: 'shield',
        fromSide: act.side,
        fromSlotIndex,
        toSide: act.side,
        toSlotIndices: affectedSlots,
        accentHex: '#38BDF8',
      }
    : hadSp
    ? {
        id: nextId('fx'),
        kind: 'heal',
        tone: 'sp',
        fromSide: act.side,
        fromSlotIndex,
        toSide: act.side,
        toSlotIndices: affectedSlots,
        accentHex: '#38BDF8',
      }
    : null;

  const soundCue: ResolveSkillSpecsResult['soundCue'] =
    destroyedUnitIds.length > 0
      ? 'destroy'
      : hadDamage
      ? 'laser'
      : hadHeal || hadSp
      ? 'heal'
      : hadShield
      ? 'shield'
      : 'defend';

  return {
    updatedUnits: workingUnits,
    logEntries: logs,
    events,
    popups,
    fxEvent,
    destroyedUnitIds,
    soundCue,
  };
}
