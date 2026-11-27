import { cloneEnrageConfig, DEFAULT_ENRAGE_CONFIG } from '../data/balance';
import type {
  AdminConfig,
  CombatLogEntry,
  EnrageBerserkerConfig,
  EnrageConfig,
  EnragePhaseConfig,
  EnragePhaseKey,
  Language,
} from '../types/game';

export const ENRAGE_PHASE_ORDER: readonly EnragePhaseKey[] = [
  'rage',
  'frenzy',
  'berserker',
];

export const MIN_ENRAGE_START_ROUND = 1;
export const MIN_ENRAGE_EVERY_ROUNDS = 1;
export const MIN_ENRAGE_MAX_STACKS = 1;
export const MAX_ENRAGE_MAX_STACKS = 1000;
export const MIN_ENRAGE_VALUE = 0;
export const MAX_ENRAGE_VALUE = 1000;
export const DEFAULT_CRIT_OVERFLOW_RATIO = 2;
export const MIN_CRIT_OVERFLOW_RATIO = 0;
export const MAX_CRIT_OVERFLOW_RATIO = 10;

export interface EnrageState {
  enabled: boolean;
  round: number;
  stacks: {
    rage: number;
    frenzy: number;
    berserker: number;
  };
  totalStacks: number;
  defDownPct: number;
  damageUpPct: number;
  critRateUpPct: number;
  critDamageUpPct: number;
  critOverflowRatio: number;
  latestPhase: EnragePhaseKey | null;
  highestPhase: EnragePhaseKey | null;
}

export function clampEnrageStartRound(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return Math.max(MIN_ENRAGE_START_ROUND, Math.floor(fallback));
  return Math.max(MIN_ENRAGE_START_ROUND, Math.floor(n));
}

export function clampEnrageEveryRounds(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return Math.max(MIN_ENRAGE_EVERY_ROUNDS, Math.floor(fallback));
  return Math.max(MIN_ENRAGE_EVERY_ROUNDS, Math.floor(n));
}

export function clampEnrageMaxStacks(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return Math.min(
      MAX_ENRAGE_MAX_STACKS,
      Math.max(MIN_ENRAGE_MAX_STACKS, Math.floor(fallback))
    );
  }
  return Math.min(
    MAX_ENRAGE_MAX_STACKS,
    Math.max(MIN_ENRAGE_MAX_STACKS, Math.floor(n))
  );
}

export function clampEnrageValue(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return Math.min(MAX_ENRAGE_VALUE, Math.max(MIN_ENRAGE_VALUE, fallback));
  }
  return Math.min(
    MAX_ENRAGE_VALUE,
    Math.max(MIN_ENRAGE_VALUE, Math.round(n * 100) / 100)
  );
}

export function clampCritOverflowRatio(
  raw: unknown,
  fallback: number = DEFAULT_CRIT_OVERFLOW_RATIO
): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return Math.min(
      MAX_CRIT_OVERFLOW_RATIO,
      Math.max(MIN_CRIT_OVERFLOW_RATIO, Math.round(fallback * 100) / 100)
    );
  }
  return Math.min(
    MAX_CRIT_OVERFLOW_RATIO,
    Math.max(MIN_CRIT_OVERFLOW_RATIO, Math.round(n * 100) / 100)
  );
}

function sanitizeEnragePhase(
  raw: unknown,
  fallback: EnragePhaseConfig
): EnragePhaseConfig {
  const rec =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    startRound: clampEnrageStartRound(rec.startRound, fallback.startRound),
    everyRounds: clampEnrageEveryRounds(rec.everyRounds, fallback.everyRounds),
    maxStacks: clampEnrageMaxStacks(rec.maxStacks, fallback.maxStacks),
    value: clampEnrageValue(rec.value, fallback.value),
  };
}

function sanitizeEnrageBerserker(
  raw: unknown,
  fallback: EnrageBerserkerConfig
): EnrageBerserkerConfig {
  const rec =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    startRound: clampEnrageStartRound(rec.startRound, fallback.startRound),
    everyRounds: clampEnrageEveryRounds(rec.everyRounds, fallback.everyRounds),
    maxStacks: clampEnrageMaxStacks(rec.maxStacks, fallback.maxStacks),
    critRatePct: clampEnrageValue(rec.critRatePct, fallback.critRatePct),
    critDamagePct: clampEnrageValue(rec.critDamagePct, fallback.critDamagePct),
    critOverflowRatio: clampCritOverflowRatio(
      rec.critOverflowRatio,
      fallback.critOverflowRatio ?? DEFAULT_CRIT_OVERFLOW_RATIO
    ),
  };
}

export function sanitizeEnrageConfig(
  raw: unknown,
  fallback: EnrageConfig = cloneEnrageConfig(DEFAULT_ENRAGE_CONFIG)
): EnrageConfig {
  const rec =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    rage: sanitizeEnragePhase(rec.rage, fallback.rage),
    frenzy: sanitizeEnragePhase(rec.frenzy, fallback.frenzy),
    berserker: sanitizeEnrageBerserker(rec.berserker, fallback.berserker),
  };
}

export function getEnrageStacks(
  round: number,
  phase: Pick<EnragePhaseConfig, 'startRound' | 'everyRounds' | 'maxStacks'>
): number {
  if (!Number.isFinite(round)) return 0;
  const r = Math.floor(round);
  const start = Math.max(MIN_ENRAGE_START_ROUND, Math.floor(phase.startRound));
  if (r < start) return 0;
  const every = Math.max(MIN_ENRAGE_EVERY_ROUNDS, Math.floor(phase.everyRounds));
  const maxS = Math.min(
    MAX_ENRAGE_MAX_STACKS,
    Math.max(MIN_ENRAGE_MAX_STACKS, Math.floor(phase.maxStacks))
  );
  return Math.min(maxS, 1 + Math.floor((r - start) / every));
}

export function getEnragePhaseNextStackRound(
  round: number,
  phase: Pick<EnragePhaseConfig, 'startRound' | 'everyRounds' | 'maxStacks'>
): number | null {
  const start = Math.max(MIN_ENRAGE_START_ROUND, Math.floor(phase.startRound));
  const every = Math.max(MIN_ENRAGE_EVERY_ROUNDS, Math.floor(phase.everyRounds));
  const maxS = Math.min(
    MAX_ENRAGE_MAX_STACKS,
    Math.max(MIN_ENRAGE_MAX_STACKS, Math.floor(phase.maxStacks))
  );
  const stacks = getEnrageStacks(round, {
    startRound: start,
    everyRounds: every,
    maxStacks: maxS,
  });
  if (stacks >= maxS) return null;
  if (stacks === 0) return start;
  return start + stacks * every;
}

export function computeCritWithOverflow(
  derivedCritChance: number,
  bonusCrit: number,
  critRateUpPct: number,
  critOverflowRatio: number
): {
  rawCrit: number;
  totalCritChance: number;
  overflowPct: number;
  overflowCritDamagePct: number;
} {
  const basePlusBonusCrit = Math.min(75, derivedCritChance + bonusCrit);
  const rawCrit = basePlusBonusCrit + critRateUpPct;
  const totalCritChance = Math.min(100, rawCrit);
  const overflowPct = Math.max(0, rawCrit - 100);
  const safeRatio = clampCritOverflowRatio(critOverflowRatio, 0);
  const overflowCritDamagePct = Math.round(overflowPct * safeRatio * 100) / 100;
  return {
    rawCrit,
    totalCritChance,
    overflowPct,
    overflowCritDamagePct,
  };
}

export function getEnrageState(
  round: number,
  cfg?: Partial<Pick<AdminConfig, 'softEnrageEnabled' | 'enrage'>> | null
): EnrageState {
  const safeRound = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  const enabled = cfg?.softEnrageEnabled ?? true;
  if (!enabled) {
    return {
      enabled: false,
      round: safeRound,
      stacks: { rage: 0, frenzy: 0, berserker: 0 },
      totalStacks: 0,
      defDownPct: 0,
      damageUpPct: 0,
      critRateUpPct: 0,
      critDamageUpPct: 0,
      critOverflowRatio: 0,
      latestPhase: null,
      highestPhase: null,
    };
  }

  const enrageCfg = sanitizeEnrageConfig(cfg?.enrage);
  const rageStacks = getEnrageStacks(safeRound, enrageCfg.rage);
  const frenzyStacks = getEnrageStacks(safeRound, enrageCfg.frenzy);
  const berserkerStacks = getEnrageStacks(safeRound, enrageCfg.berserker);
  const stacks = {
    rage: rageStacks,
    frenzy: frenzyStacks,
    berserker: berserkerStacks,
  };
  const totalStacks = rageStacks + frenzyStacks + berserkerStacks;

  const defDownPct = Math.min(
    100,
    Math.max(0, Math.round(rageStacks * enrageCfg.rage.value * 100) / 100)
  );
  const damageUpPct = Math.max(
    0,
    Math.round(frenzyStacks * enrageCfg.frenzy.value * 100) / 100
  );
  const critRateUpPct = Math.max(
    0,
    Math.round(berserkerStacks * enrageCfg.berserker.critRatePct * 100) / 100
  );
  const critDamageUpPct = Math.max(
    0,
    Math.round(berserkerStacks * enrageCfg.berserker.critDamagePct * 100) / 100
  );
  const critOverflowRatio = clampCritOverflowRatio(
    enrageCfg.berserker.critOverflowRatio,
    DEFAULT_CRIT_OVERFLOW_RATIO
  );

  let latestPhase: EnragePhaseKey | null = null;
  let latestStartRound = -1;
  for (const phase of ENRAGE_PHASE_ORDER) {
    if (stacks[phase] > 0) {
      const start = enrageCfg[phase].startRound;
      if (start >= latestStartRound) {
        latestStartRound = start;
        latestPhase = phase;
      }
    }
  }

  return {
    enabled: true,
    round: safeRound,
    stacks,
    totalStacks,
    defDownPct,
    damageUpPct,
    critRateUpPct,
    critDamageUpPct,
    critOverflowRatio,
    latestPhase,
    highestPhase: latestPhase,
  };
}

export function isEnrageConfigModified(
  cfg: Partial<Pick<AdminConfig, 'softEnrageEnabled' | 'enrage'>> | undefined | null
): boolean {
  if (!cfg) return false;
  if (!cfg.softEnrageEnabled) return true;
  const cur = sanitizeEnrageConfig(cfg.enrage);
  const def = DEFAULT_ENRAGE_CONFIG;
  return (
    cur.rage.startRound !== def.rage.startRound ||
    cur.rage.everyRounds !== def.rage.everyRounds ||
    cur.rage.maxStacks !== def.rage.maxStacks ||
    Math.abs(cur.rage.value - def.rage.value) > 0.0001 ||
    cur.frenzy.startRound !== def.frenzy.startRound ||
    cur.frenzy.everyRounds !== def.frenzy.everyRounds ||
    cur.frenzy.maxStacks !== def.frenzy.maxStacks ||
    Math.abs(cur.frenzy.value - def.frenzy.value) > 0.0001 ||
    cur.berserker.startRound !== def.berserker.startRound ||
    cur.berserker.everyRounds !== def.berserker.everyRounds ||
    cur.berserker.maxStacks !== def.berserker.maxStacks ||
    Math.abs(cur.berserker.critRatePct - def.berserker.critRatePct) > 0.0001 ||
    Math.abs(cur.berserker.critDamagePct - def.berserker.critDamagePct) > 0.0001 ||
    Math.abs(
      (cur.berserker.critOverflowRatio ?? DEFAULT_CRIT_OVERFLOW_RATIO) -
        def.berserker.critOverflowRatio
    ) > 0.0001
  );
}

export function buildEnrageActivationLogs(
  round: number,
  cfg: Partial<Pick<AdminConfig, 'softEnrageEnabled' | 'enrage'>> | null | undefined,
  existingLogs: readonly CombatLogEntry[]
): CombatLogEntry[] {
  const state = getEnrageState(round, cfg);
  if (!state.enabled) return [];

  const logged = new Set<string>();
  for (const entry of existingLogs) {
    if (entry.templateKey === 'log.enragePhaseActivated' && entry.params?.phase) {
      logged.add(String(entry.params.phase));
    }
  }

  const out: CombatLogEntry[] = [];
  for (const phase of ENRAGE_PHASE_ORDER) {
    if (state.stacks[phase] > 0 && !logged.has(phase)) {
      logged.add(phase);
      out.push({
        id: `log_enrage_${phase}_${state.round}`,
        round: state.round,
        actorName: 'SYSTEM',
        tag: 'SYSTEM',
        templateKey: 'log.enragePhaseActivated',
        params: {
          round: state.round,
          phase,
        },
      });
    }
  }
  return out;
}

function fmtNum(n: number): string {
  return String(Number(n.toFixed(2)));
}

export function getEnragePhaseDisplayName(
  phase: EnragePhaseKey,
  lang: Language
): string {
  if (phase === 'rage') return lang === 'en' ? 'Rage' : 'Cuồng nộ';
  if (phase === 'frenzy') return 'Frenzy';
  return 'Berserker';
}

export function formatEnragePhaseSummaryPart(
  phase: EnragePhaseKey,
  state: EnrageState,
  lang: Language,
  withColon = false
): string {
  const name = getEnragePhaseDisplayName(phase, lang);
  const sep = withColon ? ': ' : ' ';
  const stacks = state.stacks[phase];
  if (lang === 'en') {
    const unit = stacks === 1 ? 'stack' : 'stacks';
    if (phase === 'rage') {
      return `${name}${sep}${stacks} ${unit} (-${fmtNum(state.defDownPct)}% DEF)`;
    }
    if (phase === 'frenzy') {
      return `${name}${sep}${stacks} ${unit} (+${fmtNum(state.damageUpPct)}% damage)`;
    }
    return `${name}${sep}${stacks} ${unit} (+${fmtNum(state.critRateUpPct)}% crit, +${fmtNum(state.critDamageUpPct)}% crit dmg)`;
  }

  if (phase === 'rage') {
    return `${name}${sep}${stacks} tầng (thủ -${fmtNum(state.defDownPct)}%)`;
  }
  if (phase === 'frenzy') {
    return `${name}${sep}${stacks} tầng (+${fmtNum(state.damageUpPct)}% sát thương)`;
  }
  return `${name}${sep}${stacks} tầng (+${fmtNum(state.critRateUpPct)}% crit, +${fmtNum(state.critDamageUpPct)}% sát thương crit)`;
}

export function formatEnrageTooltip(state: EnrageState, lang: Language): string {
  return ENRAGE_PHASE_ORDER.map((phase) =>
    formatEnragePhaseSummaryPart(phase, state, lang, true)
  ).join(' · ');
}

export function formatEnrageAdminSummary(
  round: number,
  cfg: Partial<Pick<AdminConfig, 'softEnrageEnabled' | 'enrage'>> | null | undefined,
  lang: Language
): string {
  const safeRound = Math.max(1, Math.floor(Number.isFinite(round) ? round : 1));
  const previewState = getEnrageState(safeRound, {
    softEnrageEnabled: true,
    enrage: cfg?.enrage,
  });
  const body = ENRAGE_PHASE_ORDER.map((phase) =>
    formatEnragePhaseSummaryPart(phase, previewState, lang, false)
  ).join(' · ');
  const prefix = lang === 'en' ? `Round ${safeRound}: ` : `Vòng ${safeRound}: `;
  if (cfg?.softEnrageEnabled === false) {
    const offTag = lang === 'en' ? ' [OFF]' : ' [ĐANG TẮT]';
    return `${prefix}${body}${offTag}`;
  }
  return `${prefix}${body}`;
}
