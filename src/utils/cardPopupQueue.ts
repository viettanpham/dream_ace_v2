import type { BattleSpeed, FloatingPopup } from '../types/game';
import { shouldSkipRadarFloatingLabels } from './battleDisplay';
import type { BattleEffectsMode } from './battleVfx';

export const DEFAULT_CARD_POPUP_STAGGER_MS = 100;
export const DEFAULT_CARD_POPUP_FLIGHT_MS = 200;
export const DEFAULT_CARD_POPUP_MAX_CONCURRENT = 4;
export const CARD_POPUP_SETTLE_MS = 450;
export const CARD_POPUP_INSET_PX = 9;
export const CARD_POPUP_QUEUE_OVERFLOW_LIMIT = 8;
export const CARD_POPUP_FALLBACK_WIDTH_PX = 240;
export const CARD_POPUP_FALLBACK_HEIGHT_PX = 84;

export type CardPopupCategory = 'damage' | 'heal_shield_sp' | 'buff_debuff';
export type CardEdge = 'top' | 'right' | 'bottom' | 'left';

export interface CardPopupConfig {
  staggerMs: number;
  flightMs: number;
  maxConcurrent: number;
}

export interface CardPopupQueueOptions extends CardPopupConfig {
  battleSpeed?: BattleSpeed;
  effectsMode?: BattleEffectsMode;
}

export interface CardPopupStartPoint {
  edge: CardEdge;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  /** Offset from card center at start (x - centerX) */
  offsetFromCenterX: number;
  /** Offset from card center at start (y - centerY) */
  offsetFromCenterY: number;
  /** Direction vector from start point toward card center (centerX - x) */
  toCenterX: number;
  /** Direction vector from start point toward card center (centerY - y) */
  toCenterY: number;
}

export interface ActiveCardPopup {
  popup: FloatingPopup;
  startPoint: CardPopupStartPoint;
  startedAtMs: number;
  expiresAtMs: number;
}

export interface CardPopupQueueState {
  active: ActiveCardPopup[];
  pending: FloatingPopup[];
  seenIds: string[];
  lastLaunchAtMs: number | null;
}

export function sanitizeCardPopupStaggerMs(raw?: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_CARD_POPUP_STAGGER_MS;
  }
  return Math.max(0, Math.round(raw));
}

export function sanitizeCardPopupFlightMs(raw?: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_CARD_POPUP_FLIGHT_MS;
  }
  return Math.max(1, Math.round(raw));
}

export function sanitizeCardPopupMaxConcurrent(raw?: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_CARD_POPUP_MAX_CONCURRENT;
  }
  return Math.max(1, Math.round(raw));
}

export function resolveCardPopupConfig(raw?: {
  cardPopupStaggerMs?: unknown;
  cardPopupFlightMs?: unknown;
  cardPopupMaxConcurrent?: unknown;
} | null): CardPopupConfig {
  return {
    staggerMs: sanitizeCardPopupStaggerMs(raw?.cardPopupStaggerMs),
    flightMs: sanitizeCardPopupFlightMs(raw?.cardPopupFlightMs),
    maxConcurrent: sanitizeCardPopupMaxConcurrent(raw?.cardPopupMaxConcurrent),
  };
}

export function isSpPopupText(text: string): boolean {
  return /\bSP\b/i.test(text);
}

export function getCardPopupCategory(
  popup: Pick<FloatingPopup, 'tone' | 'text'>
): CardPopupCategory {
  if (popup.tone === 'damage' || popup.tone === 'crit') {
    return 'damage';
  }
  if (
    popup.tone === 'heal' ||
    popup.tone === 'shield' ||
    isSpPopupText(popup.text)
  ) {
    return 'heal_shield_sp';
  }
  return 'buff_debuff';
}

export function getCardPopupArrow(
  popup: Pick<FloatingPopup, 'tone' | 'text'>
): 'up' | 'down' | null {
  if (popup.tone === 'buff' && !isSpPopupText(popup.text)) {
    return 'up';
  }
  if (popup.tone === 'status') {
    return 'down';
  }
  return null;
}

export function shouldShowCardPopup(
  popup: Pick<FloatingPopup, 'tone'>,
  effectsMode: BattleEffectsMode
): boolean {
  if (effectsMode === 'off') return false;
  if (effectsMode === 'compact') {
    return (
      popup.tone === 'damage' ||
      popup.tone === 'crit' ||
      popup.tone === 'heal'
    );
  }
  return true;
}

export function pickCardPopupStartPoint(
  popup: Pick<FloatingPopup, 'tone' | 'text'>,
  cardWidth: number = CARD_POPUP_FALLBACK_WIDTH_PX,
  cardHeight: number = CARD_POPUP_FALLBACK_HEIGHT_PX,
  rng: () => number = Math.random,
  insetPx: number = CARD_POPUP_INSET_PX
): CardPopupStartPoint {
  const safeW = Math.max(
    24,
    Number.isFinite(cardWidth) ? cardWidth : CARD_POPUP_FALLBACK_WIDTH_PX
  );
  const safeH = Math.max(
    24,
    Number.isFinite(cardHeight) ? cardHeight : CARD_POPUP_FALLBACK_HEIGHT_PX
  );
  const maxSafeInset = Math.max(8, Math.floor(Math.min(safeW, safeH) / 2) - 1);
  const clampedInset = Math.min(Math.max(8, insetPx), maxSafeInset);

  const minX = clampedInset;
  const maxX = Math.max(minX, safeW - clampedInset);
  const minY = clampedInset;
  const maxY = Math.max(minY, safeH - clampedInset);

  const category = getCardPopupCategory(popup);
  const edges: readonly CardEdge[] =
    category === 'damage'
      ? ['top', 'right', 'bottom', 'left']
      : ['top', 'bottom'];

  const rollEdge = Math.min(0.999999, Math.max(0, rng()));
  const rollPos = Math.min(1, Math.max(0, rng()));
  const edge = edges[Math.floor(rollEdge * edges.length)];

  let x = minX;
  let y = minY;
  if (edge === 'top') {
    x = minX + rollPos * (maxX - minX);
    y = minY;
  } else if (edge === 'bottom') {
    x = minX + rollPos * (maxX - minX);
    y = maxY;
  } else if (edge === 'left') {
    x = minX;
    y = minY + rollPos * (maxY - minY);
  } else {
    x = maxX;
    y = minY + rollPos * (maxY - minY);
  }

  const centerX = safeW / 2;
  const centerY = safeH / 2;
  return {
    edge,
    x,
    y,
    centerX,
    centerY,
    offsetFromCenterX: x - centerX,
    offsetFromCenterY: y - centerY,
    toCenterX: centerX - x,
    toCenterY: centerY - y,
  };
}

function parseCoalesceNumber(
  popup: FloatingPopup
): { key: string; value: number; prefix: string; suffix: string } | null {
  const trimmed = popup.text.trim();
  if (popup.tone === 'damage' || popup.tone === 'crit') {
    const m = trimmed.match(/^-(\d+)$/);
    if (m) return { key: popup.tone, value: Number(m[1]), prefix: '-', suffix: '' };
    const splash = trimmed.match(/^SPLASH\s+-(\d+)$/i);
    if (splash) {
      return { key: 'splash', value: Number(splash[1]), prefix: 'SPLASH -', suffix: '' };
    }
    return null;
  }
  if (popup.tone === 'heal') {
    const m = trimmed.match(/^\+(\d+)\s*HP$/i);
    if (m) return { key: 'heal_hp', value: Number(m[1]), prefix: '+', suffix: ' HP' };
    return null;
  }
  if (popup.tone === 'shield') {
    const m = trimmed.match(/^\+(\d+)\s*SHD$/i);
    if (m) return { key: 'shield', value: Number(m[1]), prefix: '+', suffix: ' SHD' };
    return null;
  }
  if (popup.tone === 'buff' && isSpPopupText(trimmed)) {
    const m = trimmed.match(/^\+(\d+)\s*SP$/i);
    if (m) return { key: 'sp', value: Number(m[1]), prefix: '+', suffix: ' SP' };
  }
  return null;
}

function compactPendingPopups(
  pending: readonly FloatingPopup[],
  highSpeed: boolean
): FloatingPopup[] {
  const limit = highSpeed ? 2 : CARD_POPUP_QUEUE_OVERFLOW_LIMIT;
  if (pending.length <= limit) {
    return [...pending];
  }

  const merged: FloatingPopup[] = [];
  const mergeIdxByKey = new Map<string, number>();

  for (const item of pending) {
    const parsed = parseCoalesceNumber(item);
    if (!parsed) {
      merged.push(item);
      continue;
    }
    const existingIdx = mergeIdxByKey.get(parsed.key);
    if (existingIdx !== undefined) {
      const prev = merged[existingIdx];
      const prevParsed = parseCoalesceNumber(prev);
      if (prevParsed) {
        const sum = prevParsed.value + parsed.value;
        merged[existingIdx] = {
          ...prev,
          id: `${prev.id}+${item.id}`,
          text: `${parsed.prefix}${sum}${parsed.suffix}`,
        };
        continue;
      }
    }
    mergeIdxByKey.set(parsed.key, merged.length);
    merged.push(item);
  }

  if (merged.length > limit) {
    return merged.slice(merged.length - limit);
  }
  return merged;
}

export function createCardPopupQueueState(): CardPopupQueueState {
  return {
    active: [],
    pending: [],
    seenIds: [],
    lastLaunchAtMs: null,
  };
}

export function syncCardPopupQueue(
  state: CardPopupQueueState,
  incomingPopups: readonly FloatingPopup[],
  nowMs: number,
  options: CardPopupQueueOptions,
  cardSize: { width?: number; height?: number } = {},
  rng: () => number = Math.random
): CardPopupQueueState {
  const staggerMs = sanitizeCardPopupStaggerMs(options.staggerMs);
  const flightMs = sanitizeCardPopupFlightMs(options.flightMs);
  const maxConcurrent = sanitizeCardPopupMaxConcurrent(options.maxConcurrent);
  const effectsMode = options.effectsMode ?? 'full';
  const battleSpeed = options.battleSpeed ?? 1;
  const totalDurationMs = flightMs + CARD_POPUP_SETTLE_MS;
  const highSpeed = shouldSkipRadarFloatingLabels(battleSpeed);

  const active = state.active.filter((item) => item.expiresAtMs > nowMs);
  const seenSet = new Set(state.seenIds);
  const nextSeen = [...state.seenIds];
  let pending = [...state.pending];

  for (const pop of incomingPopups) {
    if (!shouldShowCardPopup(pop, effectsMode)) continue;
    if (seenSet.has(pop.id)) continue;
    seenSet.add(pop.id);
    nextSeen.push(pop.id);
    pending.push(pop);
  }

  if (pending.length > CARD_POPUP_QUEUE_OVERFLOW_LIMIT || (highSpeed && pending.length > 2)) {
    pending = compactPendingPopups(pending, highSpeed);
  }

  let lastLaunchAtMs = state.lastLaunchAtMs;
  const nextActive = [...active];

  while (nextActive.length < maxConcurrent && pending.length > 0) {
    if (
      lastLaunchAtMs !== null &&
      staggerMs > 0 &&
      nowMs - lastLaunchAtMs < staggerMs
    ) {
      break;
    }
    const nextPopup = pending.shift()!;
    const startPoint = pickCardPopupStartPoint(
      nextPopup,
      cardSize.width,
      cardSize.height,
      rng
    );
    nextActive.push({
      popup: nextPopup,
      startPoint,
      startedAtMs: nowMs,
      expiresAtMs: nowMs + totalDurationMs,
    });
    lastLaunchAtMs = nowMs;
  }

  return {
    active: nextActive,
    pending,
    seenIds: nextSeen.slice(-48),
    lastLaunchAtMs,
  };
}

export function advanceCardPopupQueue(
  state: CardPopupQueueState,
  nowMs: number,
  options: CardPopupQueueOptions,
  cardSize: { width?: number; height?: number } = {},
  rng: () => number = Math.random
): CardPopupQueueState {
  return syncCardPopupQueue(state, [], nowMs, options, cardSize, rng);
}

export function getNextCardPopupQueueWakeupMs(
  state: CardPopupQueueState,
  nowMs: number,
  options: Pick<CardPopupQueueOptions, 'staggerMs' | 'maxConcurrent'>
): number | null {
  const staggerMs = sanitizeCardPopupStaggerMs(options.staggerMs);
  const maxConcurrent = sanitizeCardPopupMaxConcurrent(options.maxConcurrent);
  let nextDelay: number | null = null;

  if (state.pending.length > 0 && state.active.length < maxConcurrent) {
    const launchWait =
      state.lastLaunchAtMs === null
        ? 0
        : Math.max(0, state.lastLaunchAtMs + staggerMs - nowMs);
    nextDelay = launchWait;
  }

  for (const item of state.active) {
    const expireWait = Math.max(0, item.expiresAtMs - nowMs);
    if (nextDelay === null || expireWait < nextDelay) {
      nextDelay = expireWait;
    }
  }

  return nextDelay;
}
