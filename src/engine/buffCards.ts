import type {
  ActiveBuffEntry,
  AdminConfig,
  BuffCardKind,
  CombatSide,
  NpcBuffCardKind,
  NpcBuffCardsConfig,
  PilotAccount,
} from '../types/game';
import {
  BUFF_CARD_MAX_STOCK,
  getBuffCardId,
  parseBuffCardId,
  resolveBuffCardsConfig,
  sanitizePilotActiveBuffs,
  sanitizePilotBuffCards,
} from '../data/buffCards';
export { applyPilotBuffsToPassives, getPilotBuffBonuses } from './skills';

export const NPC_BUFF_CARD_KINDS: readonly NpcBuffCardKind[] = [
  'max_hp',
  'max_shield',
  'max_sp',
  'attack',
  'defense',
  'dodge',
] as const;

export const DEFAULT_NPC_BUFF_CARDS_CONFIG: NpcBuffCardsConfig = {
  enabled: true,
  allyChancePct: 20,
  enemyChancePct: 20,
  minLevel: 10,
  maxTier: 3,
  levelPerTier: 10,
  maxKindsPerUnit: 2,
  includeBoss: true,
  includeStructure: false,
  kinds: {
    max_hp: true,
    max_shield: true,
    max_sp: true,
    attack: true,
    defense: true,
    dodge: true,
  },
};

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function cloneNpcBuffCardsConfig(
  cfg: NpcBuffCardsConfig = DEFAULT_NPC_BUFF_CARDS_CONFIG
): NpcBuffCardsConfig {
  return {
    ...cfg,
    kinds: { ...cfg.kinds },
  };
}

export function sanitizeNpcBuffCardsConfig(
  raw?: Partial<NpcBuffCardsConfig> | null
): NpcBuffCardsConfig {
  const d = DEFAULT_NPC_BUFF_CARDS_CONFIG;
  if (!raw || typeof raw !== 'object') {
    return cloneNpcBuffCardsConfig(d);
  }
  const rawKinds =
    raw.kinds && typeof raw.kinds === 'object'
      ? (raw.kinds as Partial<Record<NpcBuffCardKind, unknown>>)
      : {};
  const kinds: Record<NpcBuffCardKind, boolean> = {
    max_hp: typeof rawKinds.max_hp === 'boolean' ? rawKinds.max_hp : d.kinds.max_hp,
    max_shield:
      typeof rawKinds.max_shield === 'boolean'
        ? rawKinds.max_shield
        : d.kinds.max_shield,
    max_sp: typeof rawKinds.max_sp === 'boolean' ? rawKinds.max_sp : d.kinds.max_sp,
    attack: typeof rawKinds.attack === 'boolean' ? rawKinds.attack : d.kinds.attack,
    defense: typeof rawKinds.defense === 'boolean' ? rawKinds.defense : d.kinds.defense,
    dodge: typeof rawKinds.dodge === 'boolean' ? rawKinds.dodge : d.kinds.dodge,
  };
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    allyChancePct: clampInt(raw.allyChancePct, d.allyChancePct, 0, 100),
    enemyChancePct: clampInt(raw.enemyChancePct, d.enemyChancePct, 0, 100),
    minLevel: clampInt(raw.minLevel, d.minLevel, 1, 999),
    maxTier: clampInt(raw.maxTier, d.maxTier, 1, 5),
    levelPerTier: clampInt(raw.levelPerTier, d.levelPerTier, 1, 200),
    maxKindsPerUnit: clampInt(
      raw.maxKindsPerUnit,
      d.maxKindsPerUnit,
      0,
      NPC_BUFF_CARD_KINDS.length
    ),
    includeBoss:
      typeof raw.includeBoss === 'boolean' ? raw.includeBoss : d.includeBoss,
    includeStructure:
      typeof raw.includeStructure === 'boolean'
        ? raw.includeStructure
        : d.includeStructure,
    kinds,
  };
}

export function computeNpcBuffTierCap(
  level: number,
  isBoss: boolean,
  cfg: NpcBuffCardsConfig
): number {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const steps =
    safeLevel >= cfg.minLevel
      ? Math.floor((safeLevel - cfg.minLevel) / Math.max(1, cfg.levelPerTier))
      : 0;
  const baseCap = Math.min(cfg.maxTier, 1 + steps);
  const bossBonus = isBoss && cfg.includeBoss ? 1 : 0;
  return Math.max(1, Math.min(5, baseCap + bossBonus));
}

export function rollNpcBuffCards(
  rng: () => number,
  side: CombatSide,
  level: number,
  isBoss: boolean,
  isStructure: boolean,
  admin?: Partial<AdminConfig> | null
): Partial<Record<BuffCardKind, ActiveBuffEntry>> {
  const cfg = sanitizeNpcBuffCardsConfig(admin?.npcBuffCards);
  if (!cfg.enabled) return {};
  if (!Number.isFinite(level) || level < cfg.minLevel) return {};
  if (isStructure && !(isBoss && cfg.includeBoss) && !cfg.includeStructure) {
    return {};
  }

  const allowedKinds = NPC_BUFF_CARD_KINDS.filter((kind) => cfg.kinds[kind]);
  if (allowedKinds.length === 0 || cfg.maxKindsPerUnit <= 0) return {};

  const baseChance = side === 'ally' ? cfg.allyChancePct : cfg.enemyChancePct;
  const effectiveChance =
    isBoss && cfg.includeBoss ? Math.min(100, baseChance * 2) : baseChance;
  if (effectiveChance <= 0) return {};
  if (rng() * 100 >= effectiveChance) return {};

  const maxCount = Math.min(cfg.maxKindsPerUnit, allowedKinds.length);
  const count = 1 + Math.min(maxCount - 1, Math.floor(rng() * maxCount));
  const pool = [...allowedKinds];
  const buffCfg = resolveBuffCardsConfig(admin);
  const baseTierCap = computeNpcBuffTierCap(level, isBoss, cfg);
  const out: Partial<Record<BuffCardKind, ActiveBuffEntry>> = {};

  for (let i = 0; i < count && pool.length > 0; i++) {
    const pickIdx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    const [kind] = pool.splice(pickIdx, 1);
    const existingTiers = Math.max(1, buffCfg.tiers[kind]?.length ?? 5);
    const tierCap = Math.max(1, Math.min(baseTierCap, existingTiers));
    const tier = 1 + Math.min(tierCap - 1, Math.floor(rng() * tierCap));
    out[kind] = { tier, battles: 1 };
  }

  return out;
}

export type UseBuffCardReason =
  | 'ok'
  | 'busy'
  | 'invalid_card'
  | 'no_stock'
  | 'max_stack'
  | 'confirm_replace';

export interface UseBuffCardResult {
  ok: boolean;
  reason: UseBuffCardReason;
  pilot: PilotAccount;
  cardId?: string;
  kind?: BuffCardKind;
  tier?: number;
  previousTier?: number;
  nextTier?: number;
  maxStackBattles?: number;
  battles?: number;
}

export function grantBuffCardToPilot(
  pilot: PilotAccount,
  cardId: string,
  qty = 1
): PilotAccount {
  const parsed = parseBuffCardId(cardId);
  const amount = Math.floor(Number(qty));
  if (!parsed || !Number.isFinite(amount) || amount <= 0) return pilot;
  const normalizedId = getBuffCardId(parsed.kind, parsed.tier);
  const current = sanitizePilotBuffCards(pilot.buffCards);
  const nextQty = Math.min(
    BUFF_CARD_MAX_STOCK,
    (current[normalizedId] ?? 0) + amount
  );
  return {
    ...pilot,
    buffCards: {
      ...current,
      [normalizedId]: nextQty,
    },
  };
}

export function useBuffCard(
  pilot: PilotAccount,
  cardId: string,
  admin?: Partial<AdminConfig> | null,
  opts?: {
    confirmReplace?: boolean;
    isBattleActive?: boolean;
    isAutoRepeatActive?: boolean;
  }
): UseBuffCardResult {
  if (opts?.isBattleActive || opts?.isAutoRepeatActive) {
    return {
      ok: false,
      reason: 'busy',
      pilot,
    };
  }

  const parsed = parseBuffCardId(cardId);
  if (!parsed) {
    return {
      ok: false,
      reason: 'invalid_card',
      pilot,
    };
  }

  const normalizedId = getBuffCardId(parsed.kind, parsed.tier);
  const stockMap = sanitizePilotBuffCards(pilot.buffCards);
  const ownedQty = stockMap[normalizedId] ?? 0;
  if (ownedQty < 1) {
    return {
      ok: false,
      reason: 'no_stock',
      pilot,
      cardId: normalizedId,
      kind: parsed.kind,
      tier: parsed.tier,
    };
  }

  const cfg = resolveBuffCardsConfig(admin);
  const battlesPerCard = cfg.battlesPerCard;
  const maxStackBattles = cfg.maxStackBattles;
  const activeMap = sanitizePilotActiveBuffs(
    pilot.activeBuffs,
    pilot.activeExpBoostBattles
  );
  const existing = activeMap[parsed.kind];

  let nextBattles = battlesPerCard;
  if (existing) {
    if (existing.tier === parsed.tier) {
      const stacked = existing.battles + battlesPerCard;
      if (stacked > maxStackBattles) {
        return {
          ok: false,
          reason: 'max_stack',
          pilot,
          cardId: normalizedId,
          kind: parsed.kind,
          tier: parsed.tier,
          maxStackBattles,
        };
      }
      nextBattles = stacked;
    } else if (!opts?.confirmReplace) {
      return {
        ok: false,
        reason: 'confirm_replace',
        pilot,
        cardId: normalizedId,
        kind: parsed.kind,
        tier: parsed.tier,
        previousTier: existing.tier,
        nextTier: parsed.tier,
      };
    }
  }

  const nextStock = { ...stockMap };
  if (ownedQty - 1 <= 0) {
    delete nextStock[normalizedId];
  } else {
    nextStock[normalizedId] = ownedQty - 1;
  }

  const nextActive: Partial<Record<BuffCardKind, ActiveBuffEntry>> = {
    ...activeMap,
    [parsed.kind]: {
      tier: parsed.tier,
      battles: nextBattles,
    },
  };

  return {
    ok: true,
    reason: 'ok',
    pilot: {
      ...pilot,
      buffCards: nextStock,
      activeBuffs: nextActive,
      activeExpBoostBattles: 0,
    },
    cardId: normalizedId,
    kind: parsed.kind,
    tier: parsed.tier,
    battles: nextBattles,
  };
}

export function decrementActiveBuffsAfterBattle(
  activeBuffs?: Partial<Record<BuffCardKind, ActiveBuffEntry>> | null,
  legacyExpBoostBattles?: number
): {
  nextActiveBuffs: Partial<Record<BuffCardKind, ActiveBuffEntry>>;
  endedKinds: BuffCardKind[];
} {
  const sanitized = sanitizePilotActiveBuffs(activeBuffs, legacyExpBoostBattles);
  const nextActiveBuffs: Partial<Record<BuffCardKind, ActiveBuffEntry>> = {};
  const endedKinds: BuffCardKind[] = [];

  for (const [key, entry] of Object.entries(sanitized) as [
    BuffCardKind,
    ActiveBuffEntry | undefined,
  ][]) {
    if (!entry) continue;
    const remaining = entry.battles - 1;
    if (remaining > 0) {
      nextActiveBuffs[key] = {
        tier: entry.tier,
        battles: remaining,
      };
    } else {
      endedKinds.push(key);
    }
  }

  return { nextActiveBuffs, endedKinds };
}
