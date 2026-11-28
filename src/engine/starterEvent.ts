import { getMaxLevel } from '../data/balance';
import {
  BUFF_CARD_MAX_STOCK,
  getBuffCardId,
  parseBuffCardId,
  sanitizePilotBuffCards,
} from '../data/buffCards';
import { getSupplyTemplateById } from '../data/consumables';
import { getAllVouchers } from '../data/vouchers';
import type {
  AdminConfig,
  ConsumableItem,
  Language,
  PilotAccount,
  StarterEventConfig,
  StarterEventEntry,
  StarterEventEntryType,
  StarterEventMode,
  VoucherConfig,
} from '../types/game';
import { getExpForNextLevel } from './stats';
import { addSupplyToConsumables } from './supplies';
import {
  getMedalId,
  grantMedalsToMap,
  parseMedalId,
  sanitizePilotMedals,
} from './medals';
import type { CardTierNumber } from './cardTiers';
export {
  DEFAULT_CARD_TIERS_CONFIG,
  getCardTier,
  sanitizeCardTiersConfig,
  type CardTierNumber,
} from './cardTiers';

export type CardKind = 'credit' | 'exp';

export interface CardDef {
  id: string;
  kind: CardKind;
  value: number;
}

export const CARD_CREDIT_MIN = 100;
export const CARD_CREDIT_MAX = 10_000_000;
export const CARD_EXP_MIN = 100;
export const CARD_EXP_MAX = 1_000_000;
export const OWNED_CARD_MAX_QTY = 99999;

export const STARTER_EVENT_MAX_ENTRIES = 20;
export const STARTER_EVENT_MAX_QTY = 999;

export const DEFAULT_STARTER_EVENT_CONFIG: StarterEventConfig = {
  enabled: true,
  mode: 'oncePerSave',
  entries: [
    { type: 'card_credit', value: 50000, qty: 5 },
    { type: 'card_exp', value: 10000, qty: 5 },
    { type: 'voucher_credit', value: 100000, qty: 10 },
    { type: 'voucher_exp', value: 100000, qty: 10 },
  ],
};

const CARD_ID_RE = /^card_(credit|exp)_([1-9]\d*)$/;

export function clampCardValue(kind: CardKind, raw: number): number {
  const min = kind === 'credit' ? CARD_CREDIT_MIN : CARD_EXP_MIN;
  const max = kind === 'credit' ? CARD_CREDIT_MAX : CARD_EXP_MAX;
  if (!Number.isFinite(raw)) return min;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

export function makeCardId(kind: CardKind, value: number): string {
  return `card_${kind}_${clampCardValue(kind, value)}`;
}

export function getCardDef(id: string): CardDef | null {
  if (typeof id !== 'string') return null;
  const match = CARD_ID_RE.exec(id.trim());
  if (!match) return null;
  const kind = match[1] as CardKind;
  const value = Number(match[2]);
  if (!Number.isSafeInteger(value)) return null;
  const min = kind === 'credit' ? CARD_CREDIT_MIN : CARD_EXP_MIN;
  const max = kind === 'credit' ? CARD_CREDIT_MAX : CARD_EXP_MAX;
  if (value < min || value > max) return null;
  return {
    id: `card_${kind}_${value}`,
    kind,
    value,
  };
}

export function getCardName(id: string, lang: Language): string {
  const def = getCardDef(id);
  if (!def) return id;
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const formatted = def.value.toLocaleString(locale);
  if (def.kind === 'credit') {
    return lang === 'vi'
      ? `Thẻ Credit ${formatted}`
      : `Credit Card ${formatted}`;
  }
  return lang === 'vi' ? `Thẻ EXP ${formatted}` : `EXP Card ${formatted}`;
}

export function sanitizeOwnedCards(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const clean: Record<string, number> = {};
  for (const [id, qty] of Object.entries(raw as Record<string, unknown>)) {
    const def = getCardDef(id);
    if (!def) continue;
    const n = typeof qty === 'number' ? qty : Number(qty);
    if (!Number.isFinite(n)) continue;
    const cleanQty = Math.min(
      OWNED_CARD_MAX_QTY,
      Math.max(0, Math.floor(n))
    );
    if (cleanQty <= 0) continue;
    clean[def.id] = cleanQty;
  }
  return clean;
}

export function sanitizeStarterEventGranted(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    clean.push(id);
    if (clean.length >= 16) break;
  }
  return clean;
}

export function cloneStarterEventConfig(
  cfg: StarterEventConfig
): StarterEventConfig {
  return {
    enabled: Boolean(cfg.enabled),
    mode: cfg.mode === 'perGear' ? 'perGear' : 'oncePerSave',
    entries: cfg.entries.map((entry) => ({
      type: entry.type,
      value: entry.value,
      qty: entry.qty,
      ...(entry.refId ? { refId: entry.refId } : {}),
    })),
  };
}

function isStarterEventEntryType(raw: unknown): raw is StarterEventEntryType {
  return (
    raw === 'card_credit' ||
    raw === 'card_exp' ||
    raw === 'medal' ||
    raw === 'voucher_credit' ||
    raw === 'voucher_exp' ||
    raw === 'buff_card' ||
    raw === 'supply'
  );
}

export function sanitizeStarterEventConfig(
  raw: unknown,
  voucherCfgOrAdmin?: VoucherConfig | AdminConfig | null
): StarterEventConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const enabled =
    typeof obj.enabled === 'boolean'
      ? obj.enabled
      : DEFAULT_STARTER_EVENT_CONFIG.enabled;

  const mode: StarterEventMode =
    obj.mode === 'perGear' || obj.mode === 'oncePerSave'
      ? obj.mode
      : DEFAULT_STARTER_EVENT_CONFIG.mode;

  const allVouchers = getAllVouchers(voucherCfgOrAdmin);
  const sourceEntries = Array.isArray(obj.entries)
    ? obj.entries
    : DEFAULT_STARTER_EVENT_CONFIG.entries;

  const entries: StarterEventEntry[] = [];
  for (const item of sourceEntries) {
    if (entries.length >= STARTER_EVENT_MAX_ENTRIES) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (!isStarterEventEntryType(rec.type)) continue;

    const rawQty =
      typeof rec.qty === 'number' ? rec.qty : Number(rec.qty);
    if (!Number.isFinite(rawQty)) continue;
    const qty = Math.max(
      0,
      Math.min(STARTER_EVENT_MAX_QTY, Math.floor(rawQty))
    );

    if (rec.type === 'buff_card') {
      const parsed = parseBuffCardId(rec.refId);
      if (!parsed) continue;
      entries.push({
        type: 'buff_card',
        refId: getBuffCardId(parsed.kind, parsed.tier),
        value: parsed.tier,
        qty,
      });
      continue;
    }

    if (rec.type === 'supply') {
      const refStr = typeof rec.refId === 'string' ? rec.refId.trim() : '';
      const tpl = refStr ? getSupplyTemplateById(refStr) : undefined;
      if (!tpl) continue;
      entries.push({
        type: 'supply',
        refId: tpl.id,
        value: tpl.tier,
        qty,
      });
      continue;
    }

    if (rec.type === 'medal') {
      const parsed = parseMedalId(rec.refId);
      const rawVal =
        typeof rec.value === 'number' ? rec.value : Number(rec.value);
      const rawTier = parsed?.tier ?? Math.round(rawVal);
      if (!Number.isFinite(rawTier)) continue;
      const tier = Math.max(1, Math.min(5, Math.round(rawTier))) as CardTierNumber;
      entries.push({
        type: 'medal',
        refId: getMedalId(tier),
        value: tier,
        qty,
      });
      continue;
    }

    const rawVal =
      typeof rec.value === 'number' ? rec.value : Number(rec.value);
    if (!Number.isFinite(rawVal)) continue;

    if (rec.type === 'card_credit') {
      entries.push({
        type: 'card_credit',
        value: clampCardValue('credit', rawVal),
        qty,
      });
    } else if (rec.type === 'card_exp') {
      entries.push({
        type: 'card_exp',
        value: clampCardValue('exp', rawVal),
        qty,
      });
    } else {
      const voucherKind = rec.type === 'voucher_credit' ? 'credit' : 'exp';
      const targetVal = Math.round(rawVal);
      const matched = allVouchers.find(
        (v) => v.kind === voucherKind && v.value === targetVal
      );
      if (!matched) continue;
      entries.push({
        type: rec.type,
        value: matched.value,
        qty,
      });
    }
  }

  return {
    enabled,
    mode,
    entries,
  };
}

export function grantStarterEventPack(
  pilot: PilotAccount,
  cfg: StarterEventConfig | null | undefined,
  gearId: string,
  opts?: {
    force?: boolean;
    voucherCfgOrAdmin?: VoucherConfig | AdminConfig | null;
  }
): { pilot: PilotAccount; granted: StarterEventEntry[] } {
  const cleanCfg = sanitizeStarterEventConfig(cfg, opts?.voucherCfgOrAdmin);
  const existingGranted = sanitizeStarterEventGranted(pilot.starterEventGranted);

  if (!opts?.force) {
    if (!cleanCfg.enabled) {
      return { pilot, granted: [] };
    }
    if (cleanCfg.mode === 'oncePerSave' && existingGranted.length > 0) {
      return { pilot, granted: [] };
    }
    if (cleanCfg.mode === 'perGear' && existingGranted.includes(gearId)) {
      return { pilot, granted: [] };
    }
  }

  if (cleanCfg.entries.length === 0) {
    return { pilot, granted: [] };
  }

  const allVouchers = getAllVouchers(opts?.voucherCfgOrAdmin);
  const nextCards = sanitizeOwnedCards(pilot.cards);
  const nextVouchers: Record<string, number> = { ...(pilot.vouchers ?? {}) };
  const nextBuffCards = sanitizePilotBuffCards(pilot.buffCards);
  let nextMedals = sanitizePilotMedals(pilot.medals);
  let nextConsumables: ConsumableItem[] = Array.isArray(pilot.consumables)
    ? [...pilot.consumables]
    : [];
  const granted: StarterEventEntry[] = [];

  for (const entry of cleanCfg.entries) {
    if (entry.qty <= 0) continue;

    if (entry.type === 'card_credit' || entry.type === 'card_exp') {
      const kind: CardKind = entry.type === 'card_credit' ? 'credit' : 'exp';
      const cardId = makeCardId(kind, entry.value);
      nextCards[cardId] = Math.min(
        OWNED_CARD_MAX_QTY,
        (nextCards[cardId] ?? 0) + entry.qty
      );
      granted.push({ ...entry });
    } else if (entry.type === 'medal') {
      const parsed = parseMedalId(entry.refId);
      const tier = (
        parsed?.tier ?? Math.max(1, Math.min(5, Math.round(entry.value || 1)))
      ) as CardTierNumber;
      const medalId = getMedalId(tier);
      nextMedals = grantMedalsToMap(nextMedals, { [medalId]: entry.qty });
      granted.push({ ...entry, refId: medalId, value: tier });
    } else if (entry.type === 'buff_card') {
      const parsed = parseBuffCardId(entry.refId);
      if (!parsed) continue;
      const cardId = getBuffCardId(parsed.kind, parsed.tier);
      nextBuffCards[cardId] = Math.min(
        BUFF_CARD_MAX_STOCK,
        (nextBuffCards[cardId] ?? 0) + entry.qty
      );
      granted.push({ ...entry });
    } else if (entry.type === 'supply') {
      const tpl = entry.refId ? getSupplyTemplateById(entry.refId) : undefined;
      if (!tpl) continue;
      nextConsumables = addSupplyToConsumables(nextConsumables, tpl.id, entry.qty);
      granted.push({ ...entry });
    } else {
      const voucherKind = entry.type === 'voucher_credit' ? 'credit' : 'exp';
      const matched = allVouchers.find(
        (v) => v.kind === voucherKind && v.value === entry.value
      );
      if (!matched) continue;
      const curQty = Math.max(0, Math.floor(Number(nextVouchers[matched.id]) || 0));
      nextVouchers[matched.id] = curQty + entry.qty;
      granted.push({ ...entry });
    }
  }

  if (granted.length === 0) {
    return { pilot, granted: [] };
  }

  const cleanGearId = gearId.trim();
  const nextGranted =
    cleanGearId && !existingGranted.includes(cleanGearId)
      ? [...existingGranted, cleanGearId]
      : existingGranted;

  return {
    pilot: {
      ...pilot,
      cards: nextCards,
      vouchers: nextVouchers,
      ...(Object.keys(nextBuffCards).length > 0 ? { buffCards: nextBuffCards } : {}),
      ...(Object.keys(nextMedals).length > 0 ? { medals: nextMedals } : {}),
      consumables: nextConsumables,
      starterEventGranted: nextGranted,
    },
    granted,
  };
}

export interface StarterEventSummary {
  credit: number;
  exp: number;
  voucherCredit: number;
  voucherExp: number;
  buffCardsCount: number;
  suppliesCount: number;
  medalsCount?: number;
}

export function summarizeStarterEvent(
  cfg: StarterEventConfig | null | undefined,
  voucherCfgOrAdmin?: VoucherConfig | AdminConfig | null
): StarterEventSummary {
  const cleanCfg = sanitizeStarterEventConfig(cfg, voucherCfgOrAdmin);
  let credit = 0;
  let exp = 0;
  let voucherCredit = 0;
  let voucherExp = 0;
  let buffCardsCount = 0;
  let suppliesCount = 0;
  let medalsCount = 0;

  for (const entry of cleanCfg.entries) {
    if (entry.qty <= 0) continue;
    const total = entry.value * entry.qty;
    if (entry.type === 'card_credit') credit += total;
    else if (entry.type === 'card_exp') exp += total;
    else if (entry.type === 'voucher_credit') voucherCredit += total;
    else if (entry.type === 'voucher_exp') voucherExp += total;
    else if (entry.type === 'buff_card') buffCardsCount += entry.qty;
    else if (entry.type === 'supply') suppliesCount += entry.qty;
    else if (entry.type === 'medal') medalsCount += entry.qty;
  }

  return {
    credit,
    exp,
    voucherCredit,
    voucherExp,
    buffCardsCount,
    suppliesCount,
    ...(medalsCount > 0 ? { medalsCount } : {}),
  };
}

export function estimateLevelFromExpFromLv1(totalExp: number): number {
  let level = 1;
  let remaining = Math.max(0, Math.round(totalExp));
  const maxLv = getMaxLevel();
  while (level < maxLv) {
    const needed = getExpForNextLevel(level);
    if (remaining >= needed) {
      remaining -= needed;
      level += 1;
    } else {
      break;
    }
  }
  return level;
}
