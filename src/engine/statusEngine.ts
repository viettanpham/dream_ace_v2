import {
  getEntryForEngineType,
  getStatusEntry,
  getStatusKey,
  IMM_CONTROL_ID,
  type StatusEffectEntry,
} from '../data/statusEffects';
import type {
  ActiveStatusEffect,
  AdminConfig,
  BattleEvent,
  CombatLogEntry,
  CombatUnit,
  FloatingPopup,
  StatusEffectType,
} from '../types/game';

export { getStatusKey };

export interface ApplyStatusLogContext {
  round: number;
  targetName: string;
  targetSide: 'ally' | 'enemy';
  nextId?: (prefix: string) => string;
}

export interface ApplyStatusOptions {
  value?: number;
  turns?: number;
  stacks?: number;
  sourceId?: string;
  sourceSkillId?: string;
  sourceName?: string;
  charges?: number;
  breakOnAttack?: boolean;
  targetId?: string;
  engineType?: StatusEffectType;
  logContext?: ApplyStatusLogContext;
  onResist?: (entry: StatusEffectEntry) => void;
}

export interface ApplyStatusResult {
  statuses: ActiveStatusEffect[];
  applied: boolean;
  resisted: boolean;
  resistedEntry?: StatusEffectEntry;
  logEntry?: CombatLogEntry;
}

export interface StatusStatModifier {
  flat: number;
  pct: number;
}

function isStatusEffectEntry(
  input: ActiveStatusEffect | StatusEffectEntry
): input is StatusEffectEntry {
  return (
    'id' in input &&
    'polarity' in input &&
    'stackRule' in input &&
    !('type' in input)
  );
}

function resolveIncomingStatus(
  input: ActiveStatusEffect | StatusEffectEntry,
  opts?: ApplyStatusOptions
): {
  status: ActiveStatusEffect;
  reg: StatusEffectEntry | undefined;
  isRegistryOnly: boolean;
} {
  if (isStatusEffectEntry(input)) {
    const hasEngineTypes =
      Array.isArray(input.engineTypes) && input.engineTypes.length > 0;
    const isRegistryOnly = !hasEngineTypes;
    const type: StatusEffectType = isRegistryOnly
      ? 'registry_effect'
      : opts?.engineType ?? input.engineTypes![0];
    const turnsRemaining =
      opts?.turns !== undefined ? opts.turns : input.durationTurns;
    const magnitude =
      opts?.value !== undefined ? opts.value : input.defaultValue;
    const maxStacks = Math.max(1, input.maxStacks);
    const rawStacks = opts?.stacks !== undefined ? Math.floor(opts.stacks) : 1;
    const clampedStacks = Math.max(1, Math.min(maxStacks, rawStacks));

    const status: ActiveStatusEffect = {
      type,
      turnsRemaining,
      magnitude,
      isDebuff: input.polarity === 'debuff',
      ...(isRegistryOnly ? { registryId: input.id } : {}),
      ...(isRegistryOnly || clampedStacks > 1 ? { stacks: clampedStacks } : {}),
      ...(opts?.sourceId !== undefined ? { sourceId: opts.sourceId } : {}),
      ...(opts?.sourceSkillId !== undefined
        ? { sourceSkillId: opts.sourceSkillId }
        : {}),
      ...(opts?.sourceName !== undefined ? { sourceName: opts.sourceName } : {}),
      ...(opts?.charges !== undefined ? { charges: opts.charges } : {}),
      ...(opts?.breakOnAttack !== undefined
        ? { breakOnAttack: opts.breakOnAttack }
        : {}),
      ...(opts?.targetId !== undefined ? { targetId: opts.targetId } : {}),
    };
    return { status, reg: input, isRegistryOnly };
  }

  const reg = input.registryId
    ? getStatusEntry(input.registryId)
    : getEntryForEngineType(input.type);
  const isRegistryOnly =
    input.type === 'registry_effect' && Boolean(input.registryId);
  const isDebuff = reg ? reg.polarity === 'debuff' : Boolean(input.isDebuff);

  const nextStatus: ActiveStatusEffect = {
    ...input,
    ...(opts?.turns !== undefined ? { turnsRemaining: opts.turns } : {}),
    ...(opts?.value !== undefined ? { magnitude: opts.value } : {}),
    ...(opts?.sourceId !== undefined ? { sourceId: opts.sourceId } : {}),
    ...(opts?.sourceSkillId !== undefined
      ? { sourceSkillId: opts.sourceSkillId }
      : {}),
    ...(opts?.sourceName !== undefined ? { sourceName: opts.sourceName } : {}),
    ...(opts?.charges !== undefined ? { charges: opts.charges } : {}),
    ...(opts?.breakOnAttack !== undefined
      ? { breakOnAttack: opts.breakOnAttack }
      : {}),
    ...(opts?.targetId !== undefined ? { targetId: opts.targetId } : {}),
    isDebuff,
  };

  if (opts?.stacks !== undefined) {
    const maxStacks = Math.max(1, reg?.maxStacks ?? 1);
    nextStatus.stacks = Math.max(
      1,
      Math.min(maxStacks, Math.floor(opts.stacks))
    );
  } else if (nextStatus.stacks !== undefined) {
    const maxStacks = Math.max(1, reg?.maxStacks ?? 1);
    nextStatus.stacks = Math.max(
      1,
      Math.min(maxStacks, Math.floor(nextStatus.stacks))
    );
  }

  return { status: nextStatus, reg, isRegistryOnly };
}

function isSameStatusSource(
  existing: ActiveStatusEffect,
  incoming: ActiveStatusEffect
): boolean {
  const a = existing.sourceId;
  const b = incoming.sourceId;
  if (!a && !b) return true;
  if (a && b) return a === b;
  return false;
}

/**
 * Single status application entry point supporting:
 * - Registry-only control immunity (`IMM_CONTROL`) resist + log
 * - Same key + same source -> refresh duration and value
 * - Same key + other source -> entry `stackRule` (`refresh`, `add` up to `maxStacks`, `highest`)
 * - All 22 existing engine types use `refresh`, matching legacy `addOrRefreshStatus` identically.
 */
export function applyStatusWithMeta(
  statuses: ActiveStatusEffect[],
  entry: ActiveStatusEffect | StatusEffectEntry,
  opts?: ApplyStatusOptions
): ApplyStatusResult {
  const { status: incoming, reg, isRegistryOnly } = resolveIncomingStatus(
    entry,
    opts
  );

  // Control immunity applies ONLY to registry-only control effects (silence unchanged).
  if (isRegistryOnly && reg?.controlType) {
    const hasControlImmunity = statuses.some(
      (s) => getStatusKey(s) === IMM_CONTROL_ID && s.turnsRemaining > 0
    );
    if (hasControlImmunity) {
      opts?.onResist?.(reg);
      const logEntry: CombatLogEntry | undefined = opts?.logContext
        ? {
            id: opts.logContext.nextId
              ? opts.logContext.nextId('log')
              : `log_res_${opts.logContext.round}_${reg.id}`,
            round: opts.logContext.round,
            actorName: opts.logContext.targetName,
            actorSide: opts.logContext.targetSide,
            tag: 'STATUS',
            templateKey: 'log.controlResisted',
            params: {
              target: opts.logContext.targetName,
              registryId: reg.id,
            },
          }
        : undefined;
      return {
        statuses,
        applied: false,
        resisted: true,
        resistedEntry: reg,
        logEntry,
      };
    }
  }

  const key = getStatusKey(incoming);
  const existing = statuses.find((s) => getStatusKey(s) === key);

  if (!existing) {
    return {
      statuses: [...statuses, incoming],
      applied: true,
      resisted: false,
    };
  }

  const withoutExisting = statuses.filter((s) => getStatusKey(s) !== key);

  if (isSameStatusSource(existing, incoming)) {
    // Same key + same source -> refresh duration and value
    const merged: ActiveStatusEffect = {
      ...incoming,
      ...(existing.stacks !== undefined && incoming.stacks === undefined
        ? { stacks: existing.stacks }
        : existing.stacks !== undefined &&
          incoming.stacks !== undefined &&
          existing.stacks > incoming.stacks
        ? { stacks: existing.stacks }
        : {}),
    };
    return {
      statuses: [...withoutExisting, merged],
      applied: true,
      resisted: false,
    };
  }

  // Same key + other source -> apply row's stackRule
  const rule = reg?.stackRule ?? 'refresh';
  const maxStacks = Math.max(1, reg?.maxStacks ?? 1);

  if (rule === 'add') {
    const prevStacks = Math.max(1, Math.floor(existing.stacks ?? 1));
    const addStacks = Math.max(1, Math.floor(incoming.stacks ?? 1));
    const nextStacks = Math.min(maxStacks, prevStacks + addStacks);
    const merged: ActiveStatusEffect = {
      ...existing,
      ...incoming,
      turnsRemaining: Math.max(existing.turnsRemaining, incoming.turnsRemaining),
      stacks: nextStacks,
    };
    return {
      statuses: [...withoutExisting, merged],
      applied: true,
      resisted: false,
    };
  }

  if (rule === 'highest') {
    const existingVal = Math.abs(
      Number.isFinite(existing.magnitude)
        ? (existing.magnitude as number)
        : reg?.defaultValue ?? 0
    );
    const incomingVal = Math.abs(
      Number.isFinite(incoming.magnitude)
        ? (incoming.magnitude as number)
        : reg?.defaultValue ?? 0
    );
    if (incomingVal > existingVal) {
      return {
        statuses: [...withoutExisting, incoming],
        applied: true,
        resisted: false,
      };
    }
    if (incomingVal === existingVal) {
      return {
        statuses: [
          ...withoutExisting,
          {
            ...existing,
            turnsRemaining: Math.max(
              existing.turnsRemaining,
              incoming.turnsRemaining
            ),
          },
        ],
        applied: true,
        resisted: false,
      };
    }
    return {
      statuses,
      applied: false,
      resisted: false,
    };
  }

  // 'refresh' -> replace
  return {
    statuses: [...withoutExisting, incoming],
    applied: true,
    resisted: false,
  };
}

export function applyStatus(
  statuses: ActiveStatusEffect[],
  entry: ActiveStatusEffect | StatusEffectEntry,
  opts?: ApplyStatusOptions
): ActiveStatusEffect[] {
  return applyStatusWithMeta(statuses, entry, opts).statuses;
}

/**
 * Sums ONLY registry-only effects matching `statKey`:
 * value * stacks; buff = +, debuff = -; opposite effects on the same stat both apply (net).
 * With no registry-only effects, returns `{ flat: 0, pct: 0 }`.
 */
export function getStatusStatModifier(
  unit: Pick<CombatUnit, 'statuses'>,
  statKey: string
): StatusStatModifier {
  let flat = 0;
  let pct = 0;
  for (const st of unit.statuses) {
    if (st.turnsRemaining <= 0) continue;
    if (st.type !== 'registry_effect' || !st.registryId) continue;
    const entry = getStatusEntry(st.registryId);
    if (!entry || entry.stat !== statKey) continue;
    const sign =
      entry.polarity === 'buff' ? 1 : entry.polarity === 'debuff' ? -1 : 0;
    if (sign === 0) continue;
    const rawVal = Number.isFinite(st.magnitude)
      ? (st.magnitude as number)
      : entry.defaultValue;
    const stacks = Math.max(1, Math.floor(st.stacks ?? 1));
    const delta = sign * rawVal * stacks;
    if (entry.mode === 'flat') {
      flat += delta;
    } else {
      pct += delta;
    }
  }
  return { flat, pct };
}

/**
 * Decrements non-permanent status durations (`< 90`) by 1 turn and removes expired ones.
 * When any registry-only control effect (`controlType`) expires by duration, grants
 * `IMM_CONTROL` (neutral, 1 own turn). Legacy `silence` is untouched.
 */
export function tickStatusDurations(statuses: ActiveStatusEffect[]): {
  statuses: ActiveStatusEffect[];
  expiredRegistryControls: StatusEffectEntry[];
} {
  const expiredRegistryControls: StatusEffectEntry[] = [];
  const ticked: ActiveStatusEffect[] = [];

  for (const s of statuses) {
    if (s.turnsRemaining >= 90) {
      ticked.push(s);
      continue;
    }
    const nextTurns = s.turnsRemaining - 1;
    if (nextTurns > 0) {
      ticked.push({ ...s, turnsRemaining: nextTurns });
    } else if (s.type === 'registry_effect' && s.registryId) {
      const entry = getStatusEntry(s.registryId);
      if (entry?.controlType) {
        expiredRegistryControls.push(entry);
      }
    }
  }

  let nextStatuses = ticked;
  if (expiredRegistryControls.length > 0) {
    const immEntry = getStatusEntry(IMM_CONTROL_ID);
    if (immEntry) {
      nextStatuses = applyStatus(nextStatuses, immEntry, {
        turns: immEntry.durationTurns,
      });
    }
  }

  return { statuses: nextStatuses, expiredRegistryControls };
}

export interface ShieldHullApplyResult {
  shieldLost: number;
  hullDamage: number;
  nextShield: number;
  nextHp: number;
  brokeNow: boolean;
}

export interface ProcessRegistryTicksParams {
  actor: CombatUnit;
  round: number;
  adminConfig?: Partial<AdminConfig>;
  applyShieldThenHull: (
    target: Pick<CombatUnit, 'hp' | 'shield'>,
    damage: number,
    opts?: { ignoreShield?: boolean }
  ) => ShieldHullApplyResult;
  nextId: (prefix: string) => string;
  events: BattleEvent[];
  popups: FloatingPopup[];
  logs: CombatLogEntry[];
  destroyedUnitIds: string[];
}

/**
 * Runs start-of-turn generic DoT/HoT ticks for registry-only entries with `tickTiming`.
 * Caller MUST gate this with `!skipTurnStartTicks` so it runs once per own turn
 * (never on TURN-PH steps 2-3). Existing `burn` and `regen_hp` keep their own code paths.
 */
export function processRegistryTickEffects(
  params: ProcessRegistryTicksParams
): CombatUnit {
  const {
    round,
    adminConfig,
    applyShieldThenHull,
    nextId,
    events,
    popups,
    logs,
    destroyedUnitIds,
  } = params;
  let actor = params.actor;
  if (!actor.alive) return actor;

  for (const st of actor.statuses) {
    if (!actor.alive) break;
    if (st.turnsRemaining <= 0) continue;
    if (st.type !== 'registry_effect' || !st.registryId) continue;

    const entry = getStatusEntry(st.registryId);
    if (!entry || !entry.tickTiming) continue;

    const stacks = Math.max(1, Math.floor(st.stacks ?? 1));
    const perStack = Number.isFinite(st.magnitude)
      ? (st.magnitude as number)
      : entry.defaultValue;
    const totalVal = perStack * stacks;

    if (entry.polarity === 'buff') {
      if (entry.stat === 'shield') {
        const hasShieldBreak = actor.statuses.some(
          (s) => s.type === 'shield_break' && s.turnsRemaining > 0
        );
        if (hasShieldBreak) continue;
        const rawAmt =
          entry.mode === 'percent'
            ? Math.max(1, Math.round(actor.derived.maxShield * totalVal))
            : Math.max(1, Math.round(totalVal));
        const gain = Math.min(
          Math.max(0, actor.derived.maxShield - actor.shield),
          rawAmt
        );
        if (gain > 0) {
          actor = { ...actor, shield: actor.shield + gain };
          events.push({
            id: nextId('ev'),
            round,
            turn: 0,
            actorId: actor.id,
            targetId: actor.id,
            type: 'shield_grant',
            amount: gain,
            flags: { isRegen: true },
          });
          popups.push({
            id: nextId('pop'),
            unitId: actor.id,
            text: `SHD +${gain}`,
            tone: 'shield',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: actor.name,
            actorSide: actor.side,
            tag: 'SHIELD',
            templateKey: 'log.registryHotTick',
            params: {
              target: actor.name,
              amount: gain,
              registryId: entry.id,
              resource: 'SHD',
            },
          });
        }
      } else if (entry.stat === 'sp') {
        const rawAmt =
          entry.mode === 'percent'
            ? Math.max(1, Math.round(actor.derived.maxSp * totalVal))
            : Math.max(1, Math.round(totalVal));
        const gain = Math.min(Math.max(0, actor.derived.maxSp - actor.sp), rawAmt);
        if (gain > 0) {
          actor = { ...actor, sp: actor.sp + gain };
          popups.push({
            id: nextId('pop'),
            unitId: actor.id,
            text: `+${gain} SP`,
            tone: 'buff',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: actor.name,
            actorSide: actor.side,
            tag: 'STATUS',
            templateKey: 'log.registryHotTick',
            params: {
              target: actor.name,
              amount: gain,
              registryId: entry.id,
              resource: 'SP',
            },
          });
        }
      } else {
        const rawAmt =
          entry.mode === 'percent'
            ? Math.max(1, Math.round(actor.derived.maxHp * totalVal))
            : Math.max(1, Math.round(totalVal));
        const gain = Math.min(Math.max(0, actor.derived.maxHp - actor.hp), rawAmt);
        if (gain > 0) {
          actor = { ...actor, hp: actor.hp + gain };
          events.push({
            id: nextId('ev'),
            round,
            turn: 0,
            actorId: actor.id,
            targetId: actor.id,
            type: 'heal',
            amount: gain,
            skillId: st.sourceSkillId,
            flags: { isRegen: true },
          });
          popups.push({
            id: nextId('pop'),
            unitId: actor.id,
            text: `+${gain} HP`,
            tone: 'heal',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: actor.name,
            actorSide: actor.side,
            tag: 'HEAL',
            templateKey: 'log.registryHotTick',
            params: {
              target: actor.name,
              amount: gain,
              registryId: entry.id,
              resource: 'HP',
            },
          });
        }
      }
      continue;
    }

    if (entry.polarity === 'debuff') {
      if (entry.stat === 'sp') {
        const rawDrain =
          adminConfig?.godMode && actor.isPlayer
            ? 0
            : entry.mode === 'percent'
            ? Math.max(1, Math.round(actor.derived.maxSp * totalVal))
            : Math.max(1, Math.round(totalVal));
        const actualDrain = Math.min(actor.sp, rawDrain);
        if (actualDrain > 0) {
          actor = { ...actor, sp: actor.sp - actualDrain };
          popups.push({
            id: nextId('pop'),
            unitId: actor.id,
            text: `-${actualDrain} SP`,
            tone: 'status',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: actor.name,
            actorSide: actor.side,
            tag: 'STATUS',
            templateKey: 'log.registryDotTick',
            params: {
              target: actor.name,
              damage: actualDrain,
              registryId: entry.id,
              resource: 'SP',
            },
          });
        }
      } else if (entry.stat === 'shield') {
        const rawDrain =
          adminConfig?.godMode && actor.isPlayer
            ? 0
            : entry.mode === 'percent'
            ? Math.max(1, Math.round(actor.derived.maxShield * totalVal))
            : Math.max(1, Math.round(totalVal));
        const actualDrain = Math.min(actor.shield, rawDrain);
        if (actualDrain > 0) {
          actor = { ...actor, shield: actor.shield - actualDrain };
          popups.push({
            id: nextId('pop'),
            unitId: actor.id,
            text: `-${actualDrain} SHD`,
            tone: 'status',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: actor.name,
            actorSide: actor.side,
            tag: 'STATUS',
            templateKey: 'log.registryDotTick',
            params: {
              target: actor.name,
              damage: actualDrain,
              registryId: entry.id,
              resource: 'SHD',
            },
          });
        }
      } else {
        const rawDmg =
          adminConfig?.godMode && actor.isPlayer
            ? 0
            : entry.mode === 'percent'
            ? Math.max(1, Math.round(actor.derived.maxHp * totalVal))
            : Math.max(1, Math.round(totalVal));
        const dmgRes = applyShieldThenHull(actor, rawDmg, {
          ignoreShield: Boolean(entry.ignoresShield),
        });
        const killed = dmgRes.nextHp <= 0;
        actor = {
          ...actor,
          shield: dmgRes.nextShield,
          hp: dmgRes.nextHp,
          alive: !killed,
          animState: killed ? 'destroyed' : 'hit',
        };
        if (rawDmg > 0) {
          events.push({
            id: nextId('ev'),
            round,
            turn: 0,
            actorId: actor.id,
            targetId: actor.id,
            type: 'damage',
            amount: dmgRes.shieldLost + dmgRes.hullDamage,
            shieldAbsorbed: dmgRes.shieldLost,
            hpDamage: dmgRes.hullDamage,
            flags: { kill: killed },
          });
          popups.push({
            id: nextId('pop'),
            unitId: actor.id,
            text: `-${rawDmg}`,
            tone: 'status',
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: actor.name,
            actorSide: actor.side,
            tag: 'STATUS',
            templateKey: 'log.registryDotTick',
            params: {
              target: actor.name,
              damage: rawDmg,
              registryId: entry.id,
              resource: 'HP',
            },
          });
        }
        if (killed) {
          destroyedUnitIds.push(actor.id);
          events.push({
            id: nextId('ev'),
            round,
            turn: 0,
            actorId: actor.id,
            targetId: actor.id,
            type: 'kill',
            flags: { kill: true },
          });
          logs.push({
            id: nextId('log'),
            round,
            actorName: actor.name,
            actorSide: actor.side,
            tag: 'KO',
            templateKey: 'log.destroyed',
            params: { target: actor.name, classId: actor.classId },
          });
          break;
        }
      }
    }
  }

  return actor;
}
