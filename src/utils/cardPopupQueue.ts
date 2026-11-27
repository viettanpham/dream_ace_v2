import { getCatalogRow } from '../data/iconCatalog';
import type {
  BattleSpeed,
  FloatingPopup,
  IconCatalogModRow,
} from '../types/game';
import {
  shouldSkipRadarFloatingLabels,
  SP_COLOR_TOKENS,
} from './battleDisplay';
import type { BattleEffectsMode } from './battleVfx';

export const DEFAULT_CARD_POPUP_STAGGER_MS = 100;
export const DEFAULT_CARD_POPUP_FLIGHT_MS = 200;
export const DEFAULT_CARD_POPUP_MAX_CONCURRENT = 4;
export const DEFAULT_CARD_POPUP_ZONE_WIDTH_PCT = 60;
export const DEFAULT_CARD_POPUP_ZONE_HEIGHT_PCT = 45;
export const CARD_POPUP_ZONE_MIN_PCT = 20;
export const CARD_POPUP_ZONE_MAX_PCT = 100;
export const CARD_POPUP_END_CANDIDATES = 6;
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
  zoneWidthPct: number;
  zoneHeightPct: number;
}

export interface CardPopupQueueOptions {
  staggerMs: number;
  flightMs: number;
  maxConcurrent: number;
  zoneWidthPct?: number;
  zoneHeightPct?: number;
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

export interface CardPopupEndPoint {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  offsetFromCenterX: number;
  offsetFromCenterY: number;
}

export interface ActiveCardPopup {
  popup: FloatingPopup;
  startPoint: CardPopupStartPoint;
  endPoint: CardPopupEndPoint;
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

function sanitizeCardPopupZonePct(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(
    CARD_POPUP_ZONE_MIN_PCT,
    Math.min(CARD_POPUP_ZONE_MAX_PCT, Math.round(raw))
  );
}

export function sanitizeCardPopupZoneWidthPct(raw?: unknown): number {
  return sanitizeCardPopupZonePct(raw, DEFAULT_CARD_POPUP_ZONE_WIDTH_PCT);
}

export function sanitizeCardPopupZoneHeightPct(raw?: unknown): number {
  return sanitizeCardPopupZonePct(raw, DEFAULT_CARD_POPUP_ZONE_HEIGHT_PCT);
}

export function resolveCardPopupConfig(raw?: {
  cardPopupStaggerMs?: unknown;
  cardPopupFlightMs?: unknown;
  cardPopupMaxConcurrent?: unknown;
  cardPopupZoneWidthPct?: unknown;
  cardPopupZoneHeightPct?: unknown;
} | null): CardPopupConfig {
  return {
    staggerMs: sanitizeCardPopupStaggerMs(raw?.cardPopupStaggerMs),
    flightMs: sanitizeCardPopupFlightMs(raw?.cardPopupFlightMs),
    maxConcurrent: sanitizeCardPopupMaxConcurrent(raw?.cardPopupMaxConcurrent),
    zoneWidthPct: sanitizeCardPopupZoneWidthPct(raw?.cardPopupZoneWidthPct),
    zoneHeightPct: sanitizeCardPopupZoneHeightPct(raw?.cardPopupZoneHeightPct),
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
  const trimmed = popup.text.trim();
  if (/^BURN\s+-\d+$/i.test(trimmed)) {
    return null;
  }
  if (/^REGEN\s+[+-]?\d+%$/i.test(trimmed)) {
    return 'up';
  }
  if (popup.tone === 'buff' && !isSpPopupText(popup.text)) {
    return 'up';
  }
  if (popup.tone === 'status') {
    return 'down';
  }
  return null;
}

export type CardPopupIconKind =
  | 'hp'
  | 'crit'
  | 'splash'
  | 'burn'
  | 'hp_plus'
  | 'shield'
  | 'sp'
  | 'def'
  | 'eva'
  | 'wpn'
  | 'skl'
  | 'spd'
  | 'vuln'
  | 'regen'
  | 'lock';

export interface CardPopupSegment {
  iconKind: CardPopupIconKind | null;
  text: string;
  colorClass?: string;
}

export interface CardPopupDisplayInfo {
  iconKind: CardPopupIconKind | null;
  displayText: string;
  segments: CardPopupSegment[];
  arrow: 'up' | 'down' | null;
}

const STAT_POPUP_PATTERNS: readonly {
  regex: RegExp;
  kind: CardPopupIconKind;
}[] = [
  { regex: /^DEF\s+([+-]?\d+%)$/i, kind: 'def' },
  { regex: /^EVA\s+([+-]?\d+%)$/i, kind: 'eva' },
  { regex: /^WPN\s+([+-]?\d+%)$/i, kind: 'wpn' },
  { regex: /^SKL\s+([+-]?\d+%)$/i, kind: 'skl' },
  { regex: /^SPD\s+([+-]?\d+%)$/i, kind: 'spd' },
  { regex: /^VULN\s+([+-]?\d+%)$/i, kind: 'vuln' },
  { regex: /^REGEN\s+([+-]?\d+%)$/i, kind: 'regen' },
  { regex: /^LOCK\s+(x\d+)$/i, kind: 'lock' },
];

export function parseCardPopupDisplay(
  popup: Pick<FloatingPopup, 'tone' | 'text'>
): CardPopupDisplayInfo {
  const trimmed = popup.text.trim();
  const arrow = getCardPopupArrow(popup);

  const build = (segments: CardPopupSegment[]): CardPopupDisplayInfo => {
    const firstIcon =
      segments.find((seg) => seg.iconKind !== null)?.iconKind ?? null;
    return {
      iconKind: firstIcon,
      displayText: segments.map((s) => s.text).join(' '),
      segments,
      arrow,
    };
  };

  // Combined "+N SP +M SHD" or "+N SHD +M SP"
  const spShdMatch = /^\+(\d+)\s*SP\s+\+(\d+)\s*SHD$/i.exec(trimmed);
  if (spShdMatch) {
    return build([
      {
        iconKind: 'sp',
        text: `+${spShdMatch[1]}`,
        colorClass: SP_COLOR_TOKENS.textClass,
      },
      {
        iconKind: 'shield',
        text: `+${spShdMatch[2]}`,
        colorClass: 'text-sky-300',
      },
    ]);
  }
  const shdSpMatch = /^\+(\d+)\s*SHD\s+\+(\d+)\s*SP$/i.exec(trimmed);
  if (shdSpMatch) {
    return build([
      {
        iconKind: 'shield',
        text: `+${shdSpMatch[1]}`,
        colorClass: 'text-sky-300',
      },
      {
        iconKind: 'sp',
        text: `+${shdSpMatch[2]}`,
        colorClass: SP_COLOR_TOKENS.textClass,
      },
    ]);
  }

  // Single "+N SP"
  const spMatch = /^\+(\d+)\s*SP$/i.exec(trimmed);
  if (spMatch) {
    return build([
      {
        iconKind: 'sp',
        text: `+${spMatch[1]}`,
        colorClass: SP_COLOR_TOKENS.textClass,
      },
    ]);
  }

  // Burn "-N"
  const burnMatch = /^BURN\s+(-\d+)$/i.exec(trimmed);
  if (burnMatch) {
    return build([{ iconKind: 'burn', text: burnMatch[1] }]);
  }

  // Splash "-N" (drop the word SPLASH)
  const splashMatch = /^SPLASH\s+(-\d+)$/i.exec(trimmed);
  if (splashMatch) {
    return build([{ iconKind: 'splash', text: splashMatch[1] }]);
  }

  // Plain damage / crit "-N"
  if (popup.tone === 'damage' || popup.tone === 'crit') {
    const dmgMatch = /^(-\d+)$/.exec(trimmed);
    if (dmgMatch) {
      return build([
        {
          iconKind: popup.tone === 'crit' ? 'crit' : 'hp',
          text: dmgMatch[1],
        },
      ]);
    }
    return build([{ iconKind: null, text: popup.text }]);
  }

  // Heal "+N HP"
  const healMatch = /^\+(\d+)\s*HP$/i.exec(trimmed);
  if (healMatch) {
    return build([{ iconKind: 'hp_plus', text: `+${healMatch[1]}` }]);
  }

  // Shield "+N SHD" or "SHD +N"
  const shdPrefixMatch = /^SHD\s+\+(\d+)$/i.exec(trimmed);
  const shdSuffixMatch = /^\+(\d+)\s*SHD$/i.exec(trimmed);
  const shdVal = shdPrefixMatch?.[1] ?? shdSuffixMatch?.[1];
  if (shdVal !== undefined) {
    return build([
      {
        iconKind: 'shield',
        text: `+${shdVal}`,
        colorClass: 'text-sky-300',
      },
    ]);
  }

  // Back Row "+N% EVA" (replace EVA word with EVA icon, keep BACK ROW + number)
  const backRowMatch = /^BACK ROW\s+([+-]?\d+%)\s*EVA$/i.exec(trimmed);
  if (backRowMatch) {
    return build([
      { iconKind: null, text: 'BACK ROW' },
      { iconKind: 'eva', text: backRowMatch[1] },
    ]);
  }

  // Stat buff / debuff labels
  for (const rule of STAT_POPUP_PATTERNS) {
    const m = rule.regex.exec(trimmed);
    if (m) {
      return build([{ iconKind: rule.kind, text: m[1] }]);
    }
  }

  return build([{ iconKind: null, text: popup.text }]);
}

export function getCardPopupSymbol(
  kind: CardPopupIconKind,
  iconMods?: readonly IconCatalogModRow[] | null
): string {
  switch (kind) {
    case 'hp':
      return 'swords';
    case 'crit':
      return getCatalogRow('SS04', iconMods)?.symbol ?? 'flare';
    case 'splash':
      return getCatalogRow('SS05', iconMods)?.symbol ?? 'explosion';
    case 'burn':
      return getCatalogRow('DT01', iconMods)?.symbol ?? 'local_fire_department';
    case 'hp_plus':
      return 'heart_plus';
    case 'shield':
      return getCatalogRow('BS05', iconMods)?.symbol ?? 'security';
    case 'sp':
      return 'water_drop';
    case 'def':
      return getCatalogRow('BF03', iconMods)?.symbol ?? 'shield';
    case 'eva':
      return getCatalogRow('BF04', iconMods)?.symbol ?? 'air';
    case 'wpn':
      return getCatalogRow('BF02', iconMods)?.symbol ?? 'swords';
    case 'skl':
      return getCatalogRow('BF02', iconMods)?.symbol ?? 'swords';
    case 'spd':
      return getCatalogRow('BF07', iconMods)?.symbol ?? 'speed';
    case 'vuln':
      return getCatalogRow('DB09', iconMods)?.symbol ?? 'crisis_alert';
    case 'regen':
      return getCatalogRow('BF09', iconMods)?.symbol ?? 'health_cross';
    case 'lock':
      return getCatalogRow('CC02', iconMods)?.symbol ?? 'lock';
  }
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

export function pickCardPopupEndPoint(
  zone: { widthPct?: number; heightPct?: number } = {},
  cardW: number = CARD_POPUP_FALLBACK_WIDTH_PX,
  cardH: number = CARD_POPUP_FALLBACK_HEIGHT_PX,
  activeEndPoints: readonly Pick<CardPopupEndPoint, 'x' | 'y'>[] = [],
  popupSizeEstimate: { width?: number; height?: number } = {},
  rng: () => number = Math.random
): CardPopupEndPoint {
  const safeW = Math.max(
    24,
    Number.isFinite(cardW) ? cardW : CARD_POPUP_FALLBACK_WIDTH_PX
  );
  const safeH = Math.max(
    24,
    Number.isFinite(cardH) ? cardH : CARD_POPUP_FALLBACK_HEIGHT_PX
  );
  const centerX = safeW / 2;
  const centerY = safeH / 2;

  const zoneW = (sanitizeCardPopupZoneWidthPct(zone.widthPct) / 100) * safeW;
  const zoneH = (sanitizeCardPopupZoneHeightPct(zone.heightPct) / 100) * safeH;

  const estW = Math.max(
    0,
    typeof popupSizeEstimate.width === 'number' &&
      Number.isFinite(popupSizeEstimate.width)
      ? popupSizeEstimate.width
      : 0
  );
  const estH = Math.max(
    0,
    typeof popupSizeEstimate.height === 'number' &&
      Number.isFinite(popupSizeEstimate.height)
      ? popupSizeEstimate.height
      : 0
  );
  const halfW = estW / 2;
  const halfH = estH / 2;

  const rawCardMinX = CARD_POPUP_INSET_PX + halfW;
  const rawCardMaxX = safeW - CARD_POPUP_INSET_PX - halfW;
  const cardMinX = rawCardMinX <= rawCardMaxX ? rawCardMinX : centerX;
  const cardMaxX = rawCardMinX <= rawCardMaxX ? rawCardMaxX : centerX;

  const rawCardMinY = CARD_POPUP_INSET_PX + halfH;
  const rawCardMaxY = safeH - CARD_POPUP_INSET_PX - halfH;
  const cardMinY = rawCardMinY <= rawCardMaxY ? rawCardMinY : centerY;
  const cardMaxY = rawCardMinY <= rawCardMaxY ? rawCardMaxY : centerY;

  let minX = Math.max(cardMinX, centerX - zoneW / 2);
  let maxX = Math.min(cardMaxX, centerX + zoneW / 2);
  if (minX > maxX) {
    minX = centerX;
    maxX = centerX;
  }

  let minY = Math.max(cardMinY, centerY - zoneH / 2);
  let maxY = Math.min(cardMaxY, centerY + zoneH / 2);
  if (minY > maxY) {
    minY = centerY;
    maxY = centerY;
  }

  const candidates: CardPopupEndPoint[] = [];
  for (let i = 0; i < CARD_POPUP_END_CANDIDATES; i++) {
    const rx = Math.min(1, Math.max(0, rng()));
    const ry = Math.min(1, Math.max(0, rng()));
    const x = minX + rx * (maxX - minX);
    const y = minY + ry * (maxY - minY);
    candidates.push({
      x,
      y,
      centerX,
      centerY,
      offsetFromCenterX: x - centerX,
      offsetFromCenterY: y - centerY,
    });
  }

  if (activeEndPoints.length === 0) {
    return candidates[0];
  }

  let best = candidates[0];
  let bestMinDistSq = -1;
  for (const c of candidates) {
    let minDistSq = Infinity;
    for (const p of activeEndPoints) {
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
      }
    }
    if (minDistSq > bestMinDistSq) {
      bestMinDistSq = minDistSq;
      best = c;
    }
  }
  return best;
}

export function estimatePopupBoxSize(
  popup: Pick<FloatingPopup, 'tone' | 'text'>
): {
  width: number;
  height: number;
} {
  const isSmall =
    (popup.tone === 'buff' || popup.tone === 'status') &&
    !isSpPopupText(popup.text);
  const charW = isSmall ? 8 : 10;
  const chars = popup.text.trim().length;
  const width = Math.max(36, Math.ceil((chars * charW + 28) * 1.2));
  const height = (isSmall ? 18 : 22) + 4;
  return { width, height };
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
  const zoneCfg = {
    widthPct: sanitizeCardPopupZoneWidthPct(options.zoneWidthPct),
    heightPct: sanitizeCardPopupZoneHeightPct(options.zoneHeightPct),
  };

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
    const endPoint = pickCardPopupEndPoint(
      zoneCfg,
      cardSize.width,
      cardSize.height,
      nextActive.map((a) => a.endPoint),
      estimatePopupBoxSize(nextPopup),
      rng
    );
    nextActive.push({
      popup: nextPopup,
      startPoint,
      endPoint,
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
