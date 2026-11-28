import { VOICE_DEFAULTS } from '../data/balance';
import { getSkillById } from '../data/skills';
import { pickVoiceLine } from '../data/voiceLines';
import type {
  AdminConfig,
  BattleEvent,
  BattleState,
  BattleVoiceState,
  CombatLogEntry,
  CombatSide,
  CombatUnit,
  VoiceConfig,
  VoiceSpeakerSide,
  VoiceTrigger,
} from '../types/game';
import { hashSeed, mulberry32 } from './mapGenerator';

export const VOICE_TRIGGERS: readonly VoiceTrigger[] = [
  'startTaunt',
  'skillAttack',
  'skillSupport',
  'supplyUse',
  'kill',
  'crit',
  'evade',
  'lowHp',
  'shieldBreak',
  'allyDown',
  'win',
  'lose',
] as const;

function clampInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function cloneVoiceConfig(cfg?: VoiceConfig): VoiceConfig {
  const src = cfg ?? VOICE_DEFAULTS;
  const chances = {} as Record<VoiceTrigger, number>;
  for (const trigger of VOICE_TRIGGERS) {
    chances[trigger] = src.chances[trigger];
  }
  return {
    enabled: src.enabled,
    actionCooldown: src.actionCooldown,
    maxPerRound: src.maxPerRound,
    chances,
  };
}

export function sanitizeVoiceConfig(
  raw?: Partial<VoiceConfig> | null
): VoiceConfig {
  const d = VOICE_DEFAULTS;
  if (!raw || typeof raw !== 'object') {
    return cloneVoiceConfig();
  }
  const rawChances =
    raw.chances && typeof raw.chances === 'object'
      ? (raw.chances as Partial<Record<VoiceTrigger, unknown>>)
      : {};
  const chances = {} as Record<VoiceTrigger, number>;
  for (const trigger of VOICE_TRIGGERS) {
    chances[trigger] = clampInt(
      rawChances[trigger],
      d.chances[trigger],
      0,
      100
    );
  }
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    actionCooldown: clampInt(raw.actionCooldown, d.actionCooldown, 0, 10),
    maxPerRound: clampInt(raw.maxPerRound, d.maxPerRound, 0, 6),
    chances,
  };
}

export function deriveBattleVoiceSeed(seedInput: string): number {
  return hashSeed(seedInput || 'dream_ace_voice');
}

export function createInitialBattleVoiceState(
  seed: number,
  configOrEnabled?: boolean | Partial<VoiceConfig> | null
): BattleVoiceState {
  const config =
    typeof configOrEnabled === 'boolean'
      ? sanitizeVoiceConfig({ enabled: configOrEnabled })
      : sanitizeVoiceConfig(configOrEnabled);
  return {
    enabled: config.enabled,
    config,
    seed: seed >>> 0,
    counter: 0,
    unitActionCounts: {},
    lastSpokeActionByUnit: {},
    spokenCountByRound: {},
    lowHpSpokenUnitIds: [],
    winSpoken: false,
    loseSpoken: false,
  };
}

function ensureVoiceState(state: BattleState): BattleVoiceState {
  if (state.voice) return state.voice;
  const fallbackSeed = deriveBattleVoiceSeed(
    `${state.sectorId}|${state.kind ?? 'assault'}|${state.units
      .map((u) => `${u.id}:${u.derived.maxHp}`)
      .join(',')}`
  );
  return createInitialBattleVoiceState(fallbackSeed);
}

function nextVoiceRand(voice: BattleVoiceState): {
  value: number;
  nextVoice: BattleVoiceState;
} {
  const nextCounter = voice.counter + 1;
  const mixedSeed = (voice.seed ^ Math.imul(nextCounter, 0x9e3779b9)) >>> 0;
  const value = mulberry32(mixedSeed)();
  return {
    value,
    nextVoice: {
      ...voice,
      counter: nextCounter,
    },
  };
}

function resolveVoiceSide(unit: CombatUnit): VoiceSpeakerSide {
  if (unit.side === 'enemy') return 'enemy';
  return unit.isPlayer ? 'player' : 'ally';
}

export function recordVoiceUnitAction(
  state: BattleState,
  unitId: string
): BattleState {
  const voice = ensureVoiceState(state);
  return {
    ...state,
    voice: {
      ...voice,
      unitActionCounts: {
        ...voice.unitActionCounts,
        [unitId]: (voice.unitActionCounts[unitId] ?? 0) + 1,
      },
    },
  };
}

export function emitVoice(
  state: BattleState,
  trigger: VoiceTrigger,
  unit: CombatUnit | undefined | null
): BattleState {
  if (!unit) return state;
  const voice = ensureVoiceState(state);
  const cfg = voice.config;
  const enabled = cfg?.enabled ?? voice.enabled ?? VOICE_DEFAULTS.enabled;
  if (!enabled) return state;

  if (trigger === 'startTaunt' && unit.side !== 'enemy') {
    return state;
  }

  const isOutcome = trigger === 'win' || trigger === 'lose';
  if (trigger === 'win' && voice.winSpoken) return state;
  if (trigger === 'lose' && voice.loseSpoken) return state;

  const round = Math.max(1, Math.floor(state.round || 1));
  const roundSpoken = voice.spokenCountByRound[round] ?? 0;
  const curUnitActions = voice.unitActionCounts[unit.id] ?? 0;
  const lastSpokeAction = voice.lastSpokeActionByUnit[unit.id];
  const maxPerRound = cfg?.maxPerRound ?? VOICE_DEFAULTS.maxPerRound;
  const actionCooldown = cfg?.actionCooldown ?? VOICE_DEFAULTS.actionCooldown;

  if (!isOutcome) {
    if (
      trigger === 'lowHp' &&
      voice.lowHpSpokenUnitIds.includes(unit.id)
    ) {
      return state;
    }
    if (roundSpoken >= maxPerRound) {
      return state;
    }
    if (
      lastSpokeAction !== undefined &&
      curUnitActions - lastSpokeAction < actionCooldown
    ) {
      return state;
    }
  }

  const chance = cfg?.chances?.[trigger] ?? VOICE_DEFAULTS.chances[trigger] ?? 0;
  if (chance <= 0) return state;

  const { value: chanceRoll, nextVoice: vAfterChance } = nextVoiceRand(voice);
  if (chance < 100 && chanceRoll * 100 >= chance) {
    return {
      ...state,
      voice: vAfterChance,
    };
  }

  const speakerSide = resolveVoiceSide(unit);
  const { value: lineRoll, nextVoice: vAfterLine } = nextVoiceRand(vAfterChance);
  const line = pickVoiceLine(trigger, speakerSide, lineRoll);
  if (!line) {
    return {
      ...state,
      voice: vAfterLine,
    };
  }

  const logEntry: CombatLogEntry = {
    id: `log_voice_${vAfterLine.seed}_${vAfterLine.counter}`,
    round,
    actorName: unit.name,
    actorSide: unit.side,
    actorIsPlayer: unit.isPlayer,
    actorIsBoss: unit.isBoss,
    tag: 'VOICE',
    category: 'voice',
    templateKey: 'log.voice',
    params: {
      actor: unit.name,
      line,
      trigger,
    },
  };

  const nextVoice: BattleVoiceState = {
    ...vAfterLine,
    ...(trigger === 'win' ? { winSpoken: true } : {}),
    ...(trigger === 'lose' ? { loseSpoken: true } : {}),
    ...(!isOutcome
      ? {
          lastSpokeActionByUnit: {
            ...vAfterLine.lastSpokeActionByUnit,
            [unit.id]: curUnitActions,
          },
          spokenCountByRound: {
            ...vAfterLine.spokenCountByRound,
            [round]: roundSpoken + 1,
          },
          ...(trigger === 'lowHp'
            ? {
                lowHpSpokenUnitIds: [...vAfterLine.lowHpSpokenUnitIds, unit.id],
              }
            : {}),
        }
      : {}),
  };

  return {
    ...state,
    voice: nextVoice,
    log: [...state.log, logEntry],
  };
}

function pickRandomUnitWithVoiceRng(
  state: BattleState,
  candidates: CombatUnit[]
): { state: BattleState; unit: CombatUnit | null } {
  if (candidates.length === 0) return { state, unit: null };
  if (candidates.length === 1) return { state, unit: candidates[0] };
  const voice = ensureVoiceState(state);
  const { value, nextVoice } = nextVoiceRand(voice);
  const idx = Math.min(candidates.length - 1, Math.floor(value * candidates.length));
  return {
    state: {
      ...state,
      voice: nextVoice,
    },
    unit: candidates[idx],
  };
}

export function emitStartTauntVoice(state: BattleState): BattleState {
  const enemies = state.units.filter((u) => u.side === 'enemy' && u.alive);
  if (enemies.length === 0) return state;
  const boss = enemies.find((u) => u.isBoss);
  if (boss) {
    return emitVoice(state, 'startTaunt', boss);
  }
  const picked = pickRandomUnitWithVoiceRng(state, enemies);
  return emitVoice(picked.state, 'startTaunt', picked.unit);
}

export function emitOutcomeVoice(state: BattleState, won: boolean): BattleState {
  const winSide: CombatSide = won ? 'ally' : 'enemy';
  const loseSide: CombatSide = won ? 'enemy' : 'ally';

  const pickSideUnit = (s: BattleState, side: CombatSide) => {
    const aliveSide = s.units.filter((u) => u.side === side && u.alive);
    const pool =
      aliveSide.length > 0 ? aliveSide : s.units.filter((u) => u.side === side);
    return pickRandomUnitWithVoiceRng(s, pool);
  };

  let next = state;
  const winPick = pickSideUnit(next, winSide);
  next = emitVoice(winPick.state, 'win', winPick.unit);

  const losePick = pickSideUnit(next, loseSide);
  next = emitVoice(losePick.state, 'lose', losePick.unit);

  return next;
}

export function applyActionVoiceHooks(params: {
  state: BattleState;
  beforeUnits: CombatUnit[];
  events: BattleEvent[];
  actorId: string;
  adminConfig?: Partial<AdminConfig>;
}): BattleState {
  const { beforeUnits, events, actorId, adminConfig } = params;
  let next = recordVoiceUnitAction(params.state, actorId);
  const unitMap = new Map(next.units.map((u) => [u.id, u]));
  const beforeMap = new Map(beforeUnits.map((u) => [u.id, u]));
  const shieldBrokenIds = new Set<string>();

  for (const ev of events) {
    if (ev.type === 'skill_cast' && ev.skillId) {
      const actor = unitMap.get(ev.actorId);
      const skill = getSkillById(ev.skillId, adminConfig);
      if (actor && skill) {
        const isSupport =
          skill.targetType === 'self' ||
          skill.targetType === 'single_ally' ||
          skill.targetType === 'all_allies';
        next = emitVoice(
          next,
          isSupport ? 'skillSupport' : 'skillAttack',
          actor
        );
      }
      continue;
    }

    if (ev.type === 'dodge' && ev.targetId) {
      const dodger = unitMap.get(ev.targetId);
      if (dodger && dodger.alive) {
        next = emitVoice(next, 'evade', dodger);
      }
      continue;
    }

    if (ev.type === 'damage' && ev.flags?.crit) {
      const actor = unitMap.get(ev.actorId);
      if (actor && actor.alive) {
        next = emitVoice(next, 'crit', actor);
      }
      continue;
    }

    if (
      ev.type === 'status_applied' &&
      ev.statusId === 'shield_break' &&
      ev.targetId
    ) {
      shieldBrokenIds.add(ev.targetId);
      const target = unitMap.get(ev.targetId);
      if (target && target.alive) {
        next = emitVoice(next, 'shieldBreak', target);
      }
      continue;
    }

    if (ev.type === 'kill' && ev.targetId) {
      const killer = unitMap.get(ev.actorId);
      const victim = unitMap.get(ev.targetId);
      if (killer && victim && killer.id !== victim.id && killer.alive) {
        next = emitVoice(next, 'kill', killer);
      }
      if (victim) {
        const aliveAllies = next.units.filter(
          (u) => u.side === victim.side && u.alive && u.id !== victim.id
        );
        if (aliveAllies.length > 0) {
          const picked = pickRandomUnitWithVoiceRng(next, aliveAllies);
          next = emitVoice(picked.state, 'allyDown', picked.unit);
        }
      }
    }
  }

  // Fallback shieldBreak check if shield dropped from >0 to 0 without shield_break status event
  for (const unit of next.units) {
    if (shieldBrokenIds.has(unit.id) || !unit.alive) continue;
    const prev = beforeMap.get(unit.id);
    if (prev && prev.shield > 0 && unit.shield <= 0) {
      next = emitVoice(next, 'shieldBreak', unit);
    }
  }

  // lowHp (hp < 25% of maxHp), once per unit per battle
  for (const unit of next.units) {
    if (!unit.alive || unit.derived.maxHp <= 0) continue;
    if (unit.hp / unit.derived.maxHp < 0.25) {
      next = emitVoice(next, 'lowHp', unit);
    }
  }

  return next;
}
