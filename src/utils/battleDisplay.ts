import { useEffect, useState } from 'react';
import { FORMATION_ROWS } from '../data/formationConfig';
import {
  buildTurnQueue,
  getValidEnemyTargets,
  hasStatus,
  isLongRangeAction,
} from '../engine/combat';
import type {
  ActionType,
  ActiveStatusEffect,
  BattleSpeed,
  BattleState,
  CombatFxKind,
  CombatRow,
  CombatUnit,
  FloatingPopup,
  StatusEffectType,
  TurnQueueEntry,
} from '../types/game';
import {
  STATUS_CHIP_FRAME_PX,
  STATUS_ROW_GAP_PX,
} from './statusDisplayPrefs';

export const SP_COLOR_HEX = '#EF9F27' as const;

export const SP_COLOR_TOKENS = {
  hex: SP_COLOR_HEX,
  barFillClass: 'bg-[#EF9F27]',
  textClass: 'text-[#EF9F27]',
  badgeClass: 'bg-[#EF9F27]/12 border-[#EF9F27]/35 text-[#EF9F27]',
} as const;

export type BattleLayoutMode = 'phone-portrait' | 'tablet' | 'pc';

export type RowExposureState = 'exposed' | 'protected' | 'empty';

export type TargetInvalidReason =
  | 'unit_down'
  | 'front_row_alive'
  | 'middle_row_alive'
  | 'stealthed'
  | 'not_enemy';

export interface TargetValidityResult {
  valid: boolean;
  blockedByRow: boolean;
  reason: TargetInvalidReason | null;
  blockingRow: CombatRow | null;
  ignoresRowBlocking: boolean;
}

export interface PopupAnchorPoint {
  x: number;
  y: number;
}

export interface StaggeredPopupLayout {
  popup: FloatingPopup;
  leftPct: number;
  topPct: number;
  delayMs: number;
  durationMs: number;
  slotIndex: number;
}

export interface StaggeredPopupOptions {
  maxVisible?: number;
  verticalStepPct?: number;
  staggerDelayMs?: number;
  durationMs?: number;
  baseOffsetYPct?: number;
  horizontalSpreadPct?: number;
}

export const RADAR_LEGEND_STORAGE_KEY = 'starfront_radar_legend_open_v1';
export const RADAR_BUBBLES_STORAGE_KEY = 'starfront_speech_bubbles_enabled_v1';
export const RADAR_MIN_HIT_AREA_PX = 44;
export const SPEECH_BUBBLE_MAX_CHARS = 28;
export const SPEECH_BUBBLE_DURATION_MS = 1500;
export const RADAR_RING_MIN_MARKER_RADIUS = 17;
export const RADAR_RING_DEFAULT_STROKE_WIDTH = 3;
export const RADAR_LOW_HP_THRESHOLD = 0.25;
export const RADAR_STATUS_MAX_VISIBLE = 3;
export const QUEUE_VISIBLE_ROWS = 5;
export const TURN_QUEUE_UPCOMING_MAX = QUEUE_VISIBLE_ROWS;
export const TURN_QUEUE_ACTING_NAME_MIN_PX = 56;

export const TURN_QUEUE_SIDEBAR_HEIGHTS = {
  borderPx: 2,
  padYPx: 12,
  headerPx: 32,
  actingRowPx: 36,
  outerGapPx: 4,
  nextLabelPx: 20,
  nextGapPx: 4,
  rowPx: 26,
  rowGapPx: 4,
} as const;

export function getTurnQueueSidebarRowCount(unitsAtStart: number): number {
  const safeUnits = Math.max(0, Math.floor(unitsAtStart));
  if (safeUnits <= 1) return 0;
  return Math.min(QUEUE_VISIBLE_ROWS, safeUnits - 1);
}

export function getTurnQueueSidebarListHeightPx(rowCount: number): number {
  const safeRows = Math.max(0, Math.floor(rowCount));
  if (safeRows === 0) return 0;
  return (
    safeRows * TURN_QUEUE_SIDEBAR_HEIGHTS.rowPx +
    Math.max(0, safeRows - 1) * TURN_QUEUE_SIDEBAR_HEIGHTS.rowGapPx
  );
}

export function getTurnQueueSidebarTotalHeightPx(rowCount: number): number {
  const listPx = getTurnQueueSidebarListHeightPx(rowCount);
  const nextSectionOverheadPx =
    rowCount > 0
      ? TURN_QUEUE_SIDEBAR_HEIGHTS.outerGapPx +
        TURN_QUEUE_SIDEBAR_HEIGHTS.nextLabelPx +
        TURN_QUEUE_SIDEBAR_HEIGHTS.nextGapPx
      : 0;
  return (
    TURN_QUEUE_SIDEBAR_HEIGHTS.borderPx +
    TURN_QUEUE_SIDEBAR_HEIGHTS.padYPx +
    TURN_QUEUE_SIDEBAR_HEIGHTS.headerPx +
    TURN_QUEUE_SIDEBAR_HEIGHTS.outerGapPx +
    TURN_QUEUE_SIDEBAR_HEIGHTS.actingRowPx +
    nextSectionOverheadPx +
    listPx
  );
}

export const SIDEBAR_UNIT_PANEL_HEIGHTS = {
  borderPx: 2,
  padYPx: 12,
  padXPx: 20,
  gapPx: 4,
  gapCount: 3,
  headerPx: 32,
  blockedSlotPx: 24,
  lockButtonSlotPx: 32,
  barsPx: 52,
  telemetryPx: 38,
  statusAreaPx: 2 * (STATUS_CHIP_FRAME_PX + STATUS_ROW_GAP_PX),
  sidebarMinWidthPx: 260,
} as const;

export const SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX =
  SIDEBAR_UNIT_PANEL_HEIGHTS.borderPx +
  SIDEBAR_UNIT_PANEL_HEIGHTS.padYPx +
  SIDEBAR_UNIT_PANEL_HEIGHTS.headerPx +
  SIDEBAR_UNIT_PANEL_HEIGHTS.barsPx +
  SIDEBAR_UNIT_PANEL_HEIGHTS.telemetryPx +
  SIDEBAR_UNIT_PANEL_HEIGHTS.statusAreaPx +
  SIDEBAR_UNIT_PANEL_HEIGHTS.gapPx * SIDEBAR_UNIT_PANEL_HEIGHTS.gapCount;

/**
 * Pure responsive layout classifier for the Battle Screen.
 * - Portrait phone (width <= 640 and NOT landscape phone) -> 'phone-portrait'
 * - Landscape phone (width > height && height <= 500) -> 'pc' (per spec: landscape phone uses PC layout)
 * - Tablet (641..1023) -> 'tablet'
 * - PC (>= 1024) -> 'pc'
 */
export function getBattleLayoutMode(
  width: number,
  height: number
): BattleLayoutMode {
  const safeW = Number.isFinite(width) && width > 0 ? width : 1024;
  const safeH = Number.isFinite(height) && height > 0 ? height : 768;

  if (safeW > safeH && safeH <= 500) {
    return 'pc';
  }
  if (safeW <= 640) {
    return 'phone-portrait';
  }
  if (safeW < 1024) {
    return 'tablet';
  }
  return 'pc';
}

export function useBattleLayoutMode(): BattleLayoutMode {
  const [mode, setMode] = useState<BattleLayoutMode>(() => {
    if (typeof window === 'undefined') return 'pc';
    return getBattleLayoutMode(window.innerWidth, window.innerHeight);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      setMode(getBattleLayoutMode(window.innerWidth, window.innerHeight));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mode;
}

/**
 * Safely reads prefers-reduced-motion media query.
 */
export function getPrefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  try {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mql?.matches === true;
  } catch {
    return false;
  }
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    getPrefersReducedMotion()
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      setReduced(false);
      return;
    }
    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      setReduced(false);
      return;
    }
    if (!mql) {
      setReduced(false);
      return;
    }
    setReduced(mql.matches === true);
    const onChange = (e: MediaQueryListEvent) => {
      setReduced(e.matches === true);
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql!.removeEventListener('change', onChange);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange);
      return () => mql!.removeListener(onChange);
    }
    return undefined;
  }, []);

  return reduced;
}

/**
 * Persists the collapsible radar legend state in localStorage (closed by default).
 */
export function readRadarLegendOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RADAR_LEGEND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeRadarLegendOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      RADAR_LEGEND_STORAGE_KEY,
      open ? 'true' : 'false'
    );
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

/**
 * Persists whether radar/card unit speech bubbles are enabled (default true).
 */
export function readSpeechBubblesEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(RADAR_BUBBLES_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function writeSpeechBubblesEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      RADAR_BUBBLES_STORAGE_KEY,
      enabled ? 'true' : 'false'
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Formats a unit speech bubble into a single short line (default max 28 chars, truncated with '…').
 */
export function formatSpeechBubbleText(
  speakerName: string,
  message: string,
  maxLen = SPEECH_BUBBLE_MAX_CHARS
): string {
  const limit = Math.max(4, Math.floor(maxLen));
  const cleanSpeaker = formatShortUnitName(speakerName, 8);
  const cleanMsg = String(message ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const combined = cleanSpeaker
    ? cleanMsg
      ? `${cleanSpeaker}: ${cleanMsg}`
      : cleanSpeaker
    : cleanMsg;
  if (!combined) return '';
  if (combined.length <= limit) return combined;
  return `${combined.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Places a compact speech bubble above the speaking unit while avoiding nearby unit markers.
 */
export function computeSpeechBubbleAnchor(
  speakerUnitId: string,
  posMap: Map<string, PopupAnchorPoint>,
  vw: number,
  vh: number
): { leftPct: number; topPct: number } | null {
  const speakerPos = posMap.get(speakerUnitId);
  if (!speakerPos) return null;

  const safeVw = Math.max(1, vw);
  const safeVh = Math.max(1, vh);
  const baseLeftPct = (speakerPos.x / safeVw) * 100;
  const baseTopPct = (speakerPos.y / safeVh) * 100;

  const others: Array<{ leftPct: number; topPct: number }> = [];
  posMap.forEach((pos, id) => {
    if (id === speakerUnitId) return;
    others.push({
      leftPct: (pos.x / safeVw) * 100,
      topPct: (pos.y / safeVh) * 100,
    });
  });

  // Candidate offsets: directly above, higher above, slightly left/right above, or below as last resort
  const candidates = [
    { dx: 0, dy: -13 },
    { dx: 0, dy: -19 },
    { dx: -12, dy: -13 },
    { dx: 12, dy: -13 },
    { dx: 0, dy: 14 },
  ];

  let best = {
    leftPct: Math.min(82, Math.max(18, baseLeftPct)),
    topPct: Math.min(88, Math.max(4, baseTopPct - 13)),
  };

  for (const cand of candidates) {
    const leftPct = Math.min(82, Math.max(18, baseLeftPct + cand.dx));
    const topPct = Math.min(88, Math.max(4, baseTopPct + cand.dy));
    const collides = others.some(
      (o) => Math.abs(o.leftPct - leftPct) < 16 && Math.abs(o.topPct - topPct) < 10
    );
    if (!collides) {
      best = {
        leftPct: Number(leftPct.toFixed(2)),
        topPct: Number(topPct.toFixed(2)),
      };
      break;
    }
  }

  return best;
}

/**
 * Returns true for secondary buff/status/evade/shield floating callouts (e.g. "WPN +30%")
 * that should render compactly and tightly anchored to the affected unit.
 */
export function isCompactPopupTone(tone: FloatingPopup['tone']): boolean {
  return (
    tone === 'buff' ||
    tone === 'status' ||
    tone === 'evade' ||
    tone === 'shield'
  );
}

/**
 * Returns the invisible SVG hit-area width/height (in SVG units) sized to remain
 * >= 44px on phone portrait (vw 380) and tablet/PC landscape (vw 820).
 */
export function getRadarHitAreaSize(isLandscape: boolean): number {
  return isLandscape ? 64 : 52;
}

/**
 * Pure short-name formatter for compact battle tokens and phone turn queue chips.
 * - Normalizes whitespace into a single line (no wrap).
 * - Guarantees output length <= maxLen (default 10).
 * - Uses single ellipsis character '…' when truncated.
 */
export function formatShortUnitName(name: string, maxLen = 10): string {
  const limit = Math.max(1, Math.floor(maxLen));
  const cleaned = String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= limit) return cleaned;
  if (limit === 1) return '…';
  const head = cleaned.slice(0, limit - 1).trimEnd();
  return `${head}…`;
}

/**
 * Computes which rows on a side are currently 'exposed' (nearest non-empty row),
 * 'protected' (alive units behind a closer non-empty row), or 'empty'.
 * Mirrors the combat engine's front -> middle -> back targeting order for display only.
 */
export function computeRowExposure(
  units: CombatUnit[],
  side: 'ally' | 'enemy'
): Record<CombatRow, RowExposureState> {
  const rows: CombatRow[] = ['front', 'middle', 'back'];
  const result: Record<CombatRow, RowExposureState> = {
    front: 'empty',
    middle: 'empty',
    back: 'empty',
  };

  let foundExposed = false;
  for (const row of rows) {
    const hasAlive = units.some(
      (u) => u.side === side && u.row === row && u.alive
    );
    if (!hasAlive) {
      result[row] = 'empty';
    } else if (!foundExposed) {
      result[row] = 'exposed';
      foundExposed = true;
    } else {
      result[row] = 'protected';
    }
  }

  return result;
}

/**
 * Pure radar target validity evaluator using the existing combat engine rules.
 * Never alters combat logic; classifies whether a target can be selected and why not:
 * - Down unit -> invalid ('unit_down')
 * - Same side -> invalid ('not_enemy')
 * - Long-range weapon / Siege class / Siege Mode / Sniper -> ignores row blocking
 * - Stealthed while non-stealthed enemies exist -> invalid ('stealthed')
 * - Behind an alive Front or Middle row -> invalid ('front_row_alive' | 'middle_row_alive')
 */
export function evaluateRadarTargetValidity(
  units: CombatUnit[],
  actor: CombatUnit | null,
  target: CombatUnit,
  action: ActionType = 'attack',
  skillId?: string
): TargetValidityResult {
  const ignoresRowBlocking = actor
    ? isLongRangeAction(actor, action, skillId)
    : false;

  if (!target.alive) {
    return {
      valid: false,
      blockedByRow: false,
      reason: 'unit_down',
      blockingRow: null,
      ignoresRowBlocking,
    };
  }

  if (actor && target.side === actor.side) {
    return {
      valid: false,
      blockedByRow: false,
      reason: 'not_enemy',
      blockingRow: null,
      ignoresRowBlocking,
    };
  }

  if (!actor) {
    return {
      valid: true,
      blockedByRow: false,
      reason: null,
      blockingRow: null,
      ignoresRowBlocking: false,
    };
  }

  const validTargets = getValidEnemyTargets(units, actor, action, skillId);
  if (validTargets.some((u) => u.id === target.id)) {
    return {
      valid: true,
      blockedByRow: false,
      reason: null,
      blockingRow: null,
      ignoresRowBlocking,
    };
  }

  // Distinguish stealth from row-blocking
  const aliveOpp = units.filter((u) => u.side !== actor.side && u.alive);
  const nonStealthOpp = aliveOpp.filter((u) => !hasStatus(u, 'stealth'));
  if (hasStatus(target, 'stealth') && nonStealthOpp.length > 0) {
    return {
      valid: false,
      blockedByRow: false,
      reason: 'stealthed',
      blockingRow: null,
      ignoresRowBlocking,
    };
  }

  const pool = nonStealthOpp.length > 0 ? nonStealthOpp : aliveOpp;
  const firstAliveRow =
    FORMATION_ROWS.find((row) => pool.some((u) => u.row === row)) ?? 'front';

  return {
    valid: false,
    blockedByRow: true,
    reason:
      firstAliveRow === 'middle' ? 'middle_row_alive' : 'front_row_alive',
    blockingRow: firstAliveRow,
    ignoresRowBlocking,
  };
}

/**
 * Returns attack projectile/beam animation duration in ms (300..500ms at x1),
 * scaled down by the battle speed setting (x1 / x2 / x3 / x5 / x10).
 */
export function computeRadarFxDurationMs(
  kind: CombatFxKind,
  battleSpeed: BattleSpeed = 1
): number {
  const baseMs =
    kind === 'missile'
      ? 480
      : kind === 'railgun' || kind === 'heal'
      ? 440
      : 400;
  const safeSpeed = Math.max(1, battleSpeed);
  return Math.max(90, Math.round(baseMs / safeSpeed));
}

export function computeHitFlashDurationMs(
  battleSpeed: BattleSpeed = 1
): number {
  const safeSpeed = Math.max(1, battleSpeed);
  return Math.max(80, Math.round(260 / safeSpeed));
}

export function computeDefeatFadeDurationMs(
  battleSpeed: BattleSpeed = 1
): number {
  const safeSpeed = Math.max(1, battleSpeed);
  return Math.max(120, Math.round(400 / safeSpeed));
}

/**
 * Pure damage/status popup layout function.
 * - Caps simultaneous visible popups (default 6, keeping newest).
 * - Places popups above the unit body (never covering the unit silhouette/HP bar).
 * - Staggers multiple popups on the same unit (or nearby units) vertically and by time
 *   so floating numbers never overlap each other.
 * - Sets a crisp 800ms fade duration.
 */
export function layoutStaggeredPopups(
  popups: FloatingPopup[],
  posMap: Map<string, PopupAnchorPoint>,
  vw: number,
  vh: number,
  options?: StaggeredPopupOptions
): StaggeredPopupLayout[] {
  const maxVisible = Math.max(1, options?.maxVisible ?? 6);
  const verticalStepPct = options?.verticalStepPct ?? 7.5;
  const staggerDelayMs = options?.staggerDelayMs ?? 110;
  const durationMs = options?.durationMs ?? 800;
  const baseOffsetYPct = options?.baseOffsetYPct ?? 11;
  const horizontalSpreadPct = options?.horizontalSpreadPct ?? 3.5;

  const safeVw = Math.max(1, vw);
  const safeVh = Math.max(1, vh);

  const anchored = popups.filter((p) => posMap.has(p.unitId));
  const capped =
    anchored.length > maxVisible
      ? anchored.slice(anchored.length - maxVisible)
      : anchored;

  const unitSlotCounts = new Map<string, number>();
  const placed: StaggeredPopupLayout[] = [];

  for (const popup of capped) {
    const pos = posMap.get(popup.unitId)!;
    const slotIndex = unitSlotCounts.get(popup.unitId) ?? 0;
    unitSlotCounts.set(popup.unitId, slotIndex + 1);

    const rawLeftPct = (pos.x / safeVw) * 100;
    const rawTopPct = (pos.y / safeVh) * 100;

    // Slight alternating horizontal offset for stacked numbers on the same unit
    const horizontalShift =
      slotIndex === 0
        ? 0
        : (slotIndex % 2 === 1 ? 1 : -1) * horizontalSpreadPct;

    let leftPct = Math.max(10, Math.min(90, rawLeftPct + horizontalShift));
    let topPct = Math.max(
      4,
      Math.min(86, rawTopPct - baseOffsetYPct - slotIndex * verticalStepPct)
    );

    // Avoid cross-unit collision if two adjacent units pop simultaneously
    let guard = 0;
    while (
      guard < 5 &&
      placed.some(
        (other) =>
          Math.abs(other.leftPct - leftPct) < 9 &&
          Math.abs(other.topPct - topPct) < 5.5
      )
    ) {
      topPct = Math.max(4, topPct - verticalStepPct);
      if (topPct <= 4.1) {
        leftPct = Math.max(
          10,
          Math.min(90, leftPct + (guard % 2 === 0 ? 10 : -10))
        );
      }
      guard += 1;
    }

    placed.push({
      popup,
      leftPct: Number(leftPct.toFixed(2)),
      topPct: Number(topPct.toFixed(2)),
      delayMs: slotIndex * staggerDelayMs,
      durationMs,
      slotIndex,
    });
  }

  return placed;
}

export type RadarRingKind = 'shield' | 'hp' | 'sp';

export interface RadarRingArcSpec {
  kind: RadarRingKind;
  radius: number;
  strokeWidth: number;
  current: number;
  max: number;
  ratio: number;
  circumference: number;
  filledLength: number;
  strokeDasharray: string;
  strokeDashoffset: string;
  color: string;
  trackColor: string;
  isLowHp: boolean;
  tickY: number;
}

export interface UnitRingArcsResult {
  hpOnlyMode: boolean;
  isLowHp: boolean;
  outerRadius: number;
  innerShapeRadius: number;
  arcs: RadarRingArcSpec[];
}

export interface StatusIconLayoutResult {
  visible: ActiveStatusEffect[];
  overflowCount: number;
}

export interface StatusIconMeta {
  symbol: string;
  isDebuff: boolean;
  outlineColor: string;
  textColor: string;
  bgColor: string;
  strengthPct: number | null;
}

export interface UpcomingTurnItem {
  order: number;
  entry: TurnQueueEntry;
  shortName: string;
}

export interface UpcomingTurnListResult {
  round: number;
  actingEntry: TurnQueueEntry | null;
  upcoming: UpcomingTurnItem[];
}

const DEFAULT_DEBUFF_TYPES: ReadonlySet<StatusEffectType> = new Set([
  'burn',
  'shield_break',
  'slow',
  'silence',
  'vulnerable',
  'def_down',
]);

/**
 * Pure concentric ring arc computation for radar unit markers.
 * Uses stroke-dasharray / stroke-dashoffset attributes (zero animated SVG transforms)
 * starting at 12 o'clock (top) and progressing clockwise.
 */
export function computeRingArcSpec(
  kind: RadarRingKind,
  radius: number,
  strokeWidth: number,
  current: number,
  max: number,
  color: string,
  trackColor: string,
  isLowHp = false
): RadarRingArcSpec {
  const safeRadius = Math.max(1, radius);
  const safeStroke = Math.max(RADAR_RING_DEFAULT_STROKE_WIDTH, strokeWidth);
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeCur = Number.isFinite(current) ? Math.max(0, current) : 0;
  const ratio = safeMax > 0 ? Math.max(0, Math.min(1, safeCur / safeMax)) : 0;
  const circumference = 2 * Math.PI * safeRadius;
  const filledLength = circumference * ratio;

  return {
    kind,
    radius: Number(safeRadius.toFixed(2)),
    strokeWidth: safeStroke,
    current: safeCur,
    max: safeMax,
    ratio: Number(ratio.toFixed(4)),
    circumference: Number(circumference.toFixed(2)),
    filledLength: Number(filledLength.toFixed(2)),
    strokeDasharray: `${filledLength.toFixed(2)} ${circumference.toFixed(2)}`,
    strokeDashoffset: '0',
    color,
    trackColor,
    isLowHp,
    tickY: Number((-safeRadius).toFixed(2)),
  };
}

/**
 * Computes the 3 concentric ring arcs (Shield outer blue, HP middle green, SP inner purple)
 * for a radar unit marker. Falls back to HP-only when markerRadius < RADAR_RING_MIN_MARKER_RADIUS.
 * Marks low HP strictly below 25% (hp / maxHp < 0.25) with red-orange color & pulse flag.
 */
export function computeUnitRingArcs(
  unit: CombatUnit,
  markerRadius: number
): UnitRingArcsResult {
  const safeMarkerRadius = Math.max(8, markerRadius);
  const hpRatio =
    unit.derived.maxHp > 0
      ? Math.max(0, Math.min(1, unit.hp / unit.derived.maxHp))
      : 0;
  const isLowHp =
    unit.alive && hpRatio > 0 && hpRatio < RADAR_LOW_HP_THRESHOLD;
  const hpOnlyMode = safeMarkerRadius < RADAR_RING_MIN_MARKER_RADIUS;
  const strokeWidth = RADAR_RING_DEFAULT_STROKE_WIDTH;
  const hpColor = isLowHp ? '#f97316' : '#22c55e';
  const hpTrack = isLowHp
    ? 'rgba(249, 115, 22, 0.24)'
    : 'rgba(34, 197, 94, 0.20)';

  if (hpOnlyMode) {
    const innerShapeRadius = Math.max(8, safeMarkerRadius - 3);
    const hpR = innerShapeRadius + 3;
    const hpArc = computeRingArcSpec(
      'hp',
      hpR,
      strokeWidth,
      unit.hp,
      unit.derived.maxHp,
      hpColor,
      hpTrack,
      isLowHp
    );
    return {
      hpOnlyMode: true,
      isLowHp,
      outerRadius: Number((hpR + strokeWidth / 2).toFixed(2)),
      innerShapeRadius,
      arcs: [hpArc],
    };
  }

  const innerShapeRadius = Math.max(10, Math.round(safeMarkerRadius * 0.68));
  const spR = innerShapeRadius + 2.5;
  const hpR = spR + 4;
  const shieldR = hpR + 4;

  const shieldArc = computeRingArcSpec(
    'shield',
    shieldR,
    strokeWidth,
    unit.shield,
    unit.derived.maxShield,
    '#38bdf8',
    'rgba(56, 189, 248, 0.18)',
    false
  );
  const hpArc = computeRingArcSpec(
    'hp',
    hpR,
    strokeWidth,
    unit.hp,
    unit.derived.maxHp,
    hpColor,
    hpTrack,
    isLowHp
  );
  const spArc = computeRingArcSpec(
    'sp',
    spR,
    strokeWidth,
    unit.sp,
    unit.derived.maxSp,
    '#c084fc',
    'rgba(192, 132, 252, 0.20)',
    false
  );

  return {
    hpOnlyMode: false,
    isLowHp,
    outerRadius: Number((shieldR + strokeWidth / 2).toFixed(2)),
    innerShapeRadius,
    arcs: [shieldArc, hpArc, spArc],
  };
}

/**
 * Caps visible status icons under a radar unit marker (default 3) and returns overflow count (+N).
 */
export function layoutUnitStatusIcons(
  statuses: ActiveStatusEffect[],
  maxVisible = RADAR_STATUS_MAX_VISIBLE
): StatusIconLayoutResult {
  const limit = Math.max(0, Math.floor(maxVisible));
  const visible = statuses.slice(0, limit);
  const overflowCount = Math.max(0, statuses.length - visible.length);
  return { visible, overflowCount };
}

/**
 * Returns color-blind-safe icon metadata for a status effect:
 * - Buffs use green outline; debuffs use red outline.
 * - Every status has a distinct, self-explanatory symbol (never an unexplained "!").
 */
export function getStatusIconMeta(status: ActiveStatusEffect): StatusIconMeta {
  const isDebuff =
    status.isDebuff !== undefined
      ? Boolean(status.isDebuff)
      : DEFAULT_DEBUFF_TYPES.has(status.type);

  let symbol = '▲';
  switch (status.type) {
    case 'burn':
      symbol = '✹';
      break;
    case 'shield_break':
      symbol = '✕';
      break;
    case 'def_down':
      symbol = '↓';
      break;
    case 'vulnerable':
      symbol = '▽';
      break;
    case 'slow':
      symbol = '❄';
      break;
    case 'silence':
      symbol = '⊘';
      break;
    case 'stealth':
      symbol = '◌';
      break;
    case 'def_up':
      symbol = '◈';
      break;
    case 'atk_up':
      symbol = '↑';
      break;
    case 'spd_up':
      symbol = '»';
      break;
    case 'eva_up':
      symbol = '◇';
      break;
    case 'primary_dmg_up':
      symbol = '✦';
      break;
    case 'skill_dmg_up':
      symbol = '★';
      break;
    case 'sure_hit':
      symbol = '◎';
      break;
    case 'counter':
      symbol = '↺';
      break;
    case 'evade_all':
      symbol = '✧';
      break;
    case 'invincible':
      symbol = '⬡';
      break;
    case 'regen_hp':
      symbol = '+';
      break;
    case 'siege_mode':
      symbol = '⌖';
      break;
    case 'siege_defense':
      symbol = '▣';
      break;
    case 'charging':
      symbol = '⚡';
      break;
  }

  const strengthPct =
    typeof status.magnitude === 'number' && status.magnitude !== 0
      ? Math.round(Math.abs(status.magnitude) * 100)
      : null;

  return {
    symbol,
    isDebuff,
    outlineColor: isDebuff ? '#ef4444' : '#22c55e',
    textColor: isDebuff ? '#fca5a5' : '#86efac',
    bgColor: isDebuff ? '#26090d' : '#052615',
    strengthPct,
  };
}

/**
 * Pure upcoming turn-list builder using the existing combat engine turn order.
 * Returns the acting unit separately and up to `maxVisible` (default 5) numbered upcoming units.
 */
export function buildUpcomingTurnList(
  battle: BattleState,
  maxVisible = TURN_QUEUE_UPCOMING_MAX
): UpcomingTurnListResult {
  const queue = buildTurnQueue(battle);
  const actingEntry = !battle.summary ? queue.current[0] ?? null : null;
  const combined = [
    ...queue.current.slice(actingEntry ? 1 : 0),
    ...queue.next,
  ];
  const limit = Math.max(0, Math.floor(maxVisible));

  const upcoming: UpcomingTurnItem[] = combined
    .slice(0, limit)
    .map((entry, idx) => ({
      order: idx + 1,
      entry,
      shortName: formatShortUnitName(entry.name, 10),
    }));

  return {
    round: queue.round,
    actingEntry,
    upcoming,
  };
}

