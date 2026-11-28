import type { ActiveBuffEntry, AdminConfig, BuffCardKind, PilotAccount } from '../types/game';
import {
  BUFF_CARD_MAX_STOCK,
  getBuffCardId,
  parseBuffCardId,
  resolveBuffCardsConfig,
  sanitizePilotActiveBuffs,
  sanitizePilotBuffCards,
} from '../data/buffCards';
export { applyPilotBuffsToPassives, getPilotBuffBonuses } from './skills';

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
