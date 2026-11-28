import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { HelpCircle, Radio, X } from 'lucide-react';
import { getCatalogRow } from '../data/iconCatalog';
import {
  getCatalogRowForStatus,
  getStatusVisualKind,
  sortStatusEffects,
} from '../data/statusIconMap';
import { getTeamColorRole, hasStatus } from '../engine/combat';
import { getRowModifier } from '../engine/formation';
import {
  formatStatusEffectDetail,
  getClassName,
  translate,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  ActiveStatusEffect,
  BattleSpeed,
  BattleState,
  CombatRow,
  CombatUnit,
  FloatingPopup,
  FormationConfig,
  IconCatalogModRow,
  Language,
  MechClassId,
  StatusBadgeLayout,
  TeamColorRole,
} from '../types/game';
import {
  computeDefeatFadeDurationMs,
  computeRowExposure,
  computeSpeechBubbleAnchor,
  computeUnitRingArcs,
  evaluateRadarTargetValidity,
  formatShortUnitName,
  formatSpeechBubbleText,
  getRadarHitAreaSize,
  isCompactPopupTone,
  layoutUnitStatusIcons,
  RADAR_STATUS_MAX_VISIBLE,
  readRadarLegendOpen,
  shouldSkipRadarFloatingLabels,
  SP_COLOR_TOKENS,
  SPEECH_BUBBLE_DURATION_MS,
  SPEECH_BUBBLE_MAX_CHARS,
  useBattleLayoutMode,
  usePrefersReducedMotion,
  writeRadarLegendOpen,
  type BattleLayoutMode,
  type RowExposureState,
  type TargetInvalidReason,
  type TargetValidityResult,
} from '../utils/battleDisplay';
import {
  computeDesktopLaneFit,
  computeDesktopSlotPosition,
  computePhoneFitRadius,
  getBattleSizeClass,
  shouldShowRadarMiniChips,
} from '../utils/radarSizeLayout';
import {
  getCardPopupSymbol,
  isSpPopupText,
  parseCardPopupDisplay,
} from '../utils/cardPopupQueue';
import {
  advanceRadarFloatingLabel,
  createRadarFloatingLabelQueue,
  enqueueRadarFloatingLabel,
  pruneDeadRadarFloatingLabels,
  RADAR_FLOATING_LABEL_DURATION_MS,
  RADAR_FLOATING_LABEL_MAX_QUEUED,
  resolveEffectiveVfxConfig,
  resolveReducedMotion,
  useFxSettings,
  type BattleEffectsMode,
  type RadarFloatingLabelQueueState,
  type ReducedMotionSetting,
} from '../utils/battleVfx';
import { useStatusDisplaySettings } from '../utils/statusDisplayPrefs';
import {
  computeRadarPopupScales,
  resolveRadarPopupConfig,
} from '../utils/radarPopup';
import {
  BattleVfxOverlay,
  type ManualAimLineSpec,
  type RowSlideEffect,
} from './BattleVfxOverlay';
import { CatalogIcon } from './CatalogIcon';
import { StatusChip } from './StatusChip';

interface BattleRadarViewProps {
  battle: BattleState;
  activeUnitId: string | null;
  validBasicTargetIds: Set<string>;
  canPlayerManualAct: boolean;
  hasSingleAllySkill: boolean;
  autoBattleEnabled: boolean;
  skipAnimations: boolean;
  speechBubblesEnabled?: boolean;
  battleSpeed?: BattleSpeed;
  effectsMode?: BattleEffectsMode;
  reducedMotionMode?: ReducedMotionSetting;
  effectsDebugEnabled?: boolean;
  showStatusLabels?: boolean;
  playerWeaponId?: string | null;
  layoutMode?: BattleLayoutMode;
  selectedUnitId?: string | null;
  onSelectEnemy: (unitId: string) => void;
  onSelectAlly: (unitId: string) => void;
  onInspectUnit: (unit: CombatUnit) => void;
  onInvalidTargetLog?: (reason: TargetInvalidReason | null, unit: CombatUnit) => void;
}

export interface TokenPos {
  x: number;
  y: number;
}

export interface RowLaneRect {
  side: 'ally' | 'enemy';
  row: CombatRow;
  x: number;
  y: number;
  w: number;
  h: number;
  labelX: number;
  labelY: number;
  labelAnchor: 'start' | 'middle' | 'end';
  badgeX: number;
  badgeY: number;
  badgeAnchor: 'start' | 'middle' | 'end';
  isEmptyCollapsed?: boolean;
}

type MarkerShapeKind =
  | 'player-hex'
  | 'ally-circle'
  | 'enemy-diamond'
  | 'boss-fortress';

const STAR_DOTS = [
  { x: 12, y: 16, r: 1.1, delay: '0s' },
  { x: 28, y: 72, r: 1.3, delay: '1.2s' },
  { x: 46, y: 22, r: 0.9, delay: '2.4s' },
  { x: 64, y: 84, r: 1.2, delay: '0.7s' },
  { x: 82, y: 28, r: 1.4, delay: '1.9s' },
  { x: 91, y: 64, r: 1.0, delay: '3.1s' },
  { x: 18, y: 48, r: 1.0, delay: '2.8s' },
  { x: 74, y: 51, r: 1.2, delay: '0.4s' },
];

function getTeamHex(role: TeamColorRole): string {
  switch (role) {
    case 'me':
      return '#22c55e';
    case 'ally':
      return '#38bdf8';
    case 'boss':
      return '#f97316';
    case 'enemy':
    default:
      return '#ef4444';
  }
}

function getMarkerShape(unit: CombatUnit): MarkerShapeKind {
  if (unit.side === 'ally') {
    return unit.isPlayer ? 'player-hex' : 'ally-circle';
  }
  return unit.isBoss || unit.isStructure ? 'boss-fortress' : 'enemy-diamond';
}

function getPopupColorClass(
  tone: FloatingPopup['tone'],
  text: string = ''
): string {
  if (isSpPopupText(text) && (tone === 'buff' || tone === 'heal')) {
    return SP_COLOR_TOKENS.textClass;
  }
  switch (tone) {
    case 'crit':
      return 'text-amber-300';
    case 'damage':
      return 'text-red-400';
    case 'shield':
      return 'text-sky-300';
    case 'heal':
      return 'text-emerald-300';
    case 'evade':
      return 'text-slate-200';
    case 'buff':
      return 'text-sky-200';
    case 'status':
      return 'text-orange-300';
  }
}

function getPolygonPoints(sides: number, radius: number, offsetDeg = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i += 1) {
    const rad = ((offsetDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push(
      `${(Math.cos(rad) * radius).toFixed(2)},${(Math.sin(rad) * radius).toFixed(2)}`
    );
  }
  return pts.join(' ');
}

function getDiamondPoints(radius: number): string {
  const r = radius * 1.1;
  return `0,${(-r).toFixed(2)} ${r.toFixed(2)},0 0,${r.toFixed(2)} ${(-r).toFixed(2)},0`;
}

function getFortressPoints(radius: number): string {
  const half = radius * 0.96;
  const cham = radius * 0.34;
  return `${(-half + cham).toFixed(2)},${(-half).toFixed(2)} ${(half - cham).toFixed(2)},${(-half).toFixed(2)} ${half.toFixed(2)},${(-half + cham).toFixed(2)} ${half.toFixed(2)},${(half - cham).toFixed(2)} ${(half - cham).toFixed(2)},${half.toFixed(2)} ${(-half + cham).toFixed(2)},${half.toFixed(2)} ${(-half).toFixed(2)},${(half - cham).toFixed(2)} ${(-half).toFixed(2)},${(-half + cham).toFixed(2)}`;
}

const ClassCenterIcon = memo(function ClassCenterIcon({
  classId,
  isStructure,
  isBoss,
  color,
  facingAngle,
  scale = 1,
}: {
  classId: MechClassId;
  isStructure?: boolean;
  isBoss?: boolean;
  color: string;
  facingAngle: number;
  scale?: number;
}) {
  const tx = `scale(${scale.toFixed(2)}) rotate(${facingAngle})`;
  if (isStructure || isBoss) {
    return (
      <g transform={tx}>
        <rect
          x="-5.5"
          y="-5.5"
          width="11"
          height="11"
          rx="1.5"
          fill={color}
          fillOpacity="0.28"
          stroke={color}
          strokeWidth="1.5"
        />
        <line
          x1="0"
          y1="-2"
          x2="0"
          y2="-9.5"
          stroke="#f8fafc"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="0" cy="0" r="2.4" fill="#f8fafc" />
      </g>
    );
  }

  switch (classId) {
    case 'interceptor':
      return (
        <g transform={tx}>
          <polygon
            points="0,-9 6.6,6.6 0,3.4 -6.6,6.6"
            fill={color}
            fillOpacity="0.3"
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <polygon points="0,-6 2,2 0,0.9 -2,2" fill="#f8fafc" />
        </g>
      );
    case 'siege':
      return (
        <g transform={tx}>
          <polygon
            points="-2,-9.5 2,-9.5 3,-2.3 7,-1 7,6.5 -7,6.5 -7,-1 -3,-2.3"
            fill={color}
            fillOpacity="0.32"
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <rect x="-1.2" y="-8.8" width="2.4" height="7.8" fill="#f8fafc" />
        </g>
      );
    case 'support':
      return (
        <g transform={tx}>
          <circle
            cx="0"
            cy="0"
            r="6.5"
            fill={color}
            fillOpacity="0.24"
            stroke={color}
            strokeWidth="1.4"
          />
          <rect x="-8.6" y="-2.5" width="2" height="5" rx="0.9" fill={color} />
          <rect x="6.6" y="-2.5" width="2" height="5" rx="0.9" fill={color} />
          <path
            d="M 0 -3.5 V 3.5 M -3.5 0 H 3.5"
            stroke="#f8fafc"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      );
    case 'striker':
    default:
      return (
        <g transform={tx}>
          <polygon
            points="0,-8.5 3,-1.8 8.8,3 8.2,6.5 2,4.2 0,7.2 -2,4.2 -8.2,6.5 -8.8,3 -3,-1.8"
            fill={color}
            fillOpacity="0.3"
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="-1.2" r="1.8" fill="#f8fafc" />
        </g>
      );
  }
});

export const DESKTOP_RADAR_RING_DIAMETER_PX = 80;
export const DESKTOP_RADAR_TOKEN_RADIUS = 41; // computeUnitRingArcs(unit, 41).outerRadius === 40 (80px diameter)
export const PHONE_EMPTY_LANE_HEIGHT_PX = 20;

function formatSignedRowPct(val: number): string {
  const pct = Math.round(val * 100);
  return pct > 0 ? `+${pct}` : `${pct}`;
}

export function getRadarLaneBuffParts(
  lang: Language,
  formationConfig: FormationConfig | undefined,
  row: CombatRow
): string[] {
  const mod = getRowModifier(formationConfig, row);
  const parts: string[] = [];
  if (Math.abs(mod.defensePct) >= 0.005) {
    parts.push(
      translate(lang, 'formation.effectDef', {
        val: formatSignedRowPct(mod.defensePct),
      })
    );
  }
  if (Math.abs(mod.damagePct) >= 0.005) {
    parts.push(
      translate(lang, 'formation.effectDmg', {
        val: formatSignedRowPct(mod.damagePct),
      })
    );
  }
  if (Math.abs(mod.rangedDamagePct) >= 0.005) {
    parts.push(
      translate(lang, 'formation.effectRangedDmg', {
        val: formatSignedRowPct(mod.rangedDamagePct),
      })
    );
  }
  return parts;
}

export function formatRadarLaneBuffText(
  lang: Language,
  formationConfig: FormationConfig | undefined,
  row: CombatRow
): string {
  return getRadarLaneBuffParts(lang, formationConfig, row).join(' · ');
}

export function formatRadarLaneHeaderText(
  rowLabel: string,
  buffParts: string[],
  laneWidth: number,
  isPhoneCollapsed: boolean
): string {
  if (isPhoneCollapsed || buffParts.length === 0) {
    return rowLabel;
  }
  const fullHeader = `${rowLabel} · ${buffParts.join(' · ')}`;
  const usableWidthPx = Math.max(24, laneWidth - 16);
  const maxChars = Math.floor(usableWidthPx / 6);
  if (fullHeader.length <= maxChars || buffParts.length <= 1) {
    return fullHeader;
  }
  return `${rowLabel} · ${buffParts[0]} +${buffParts.length - 1}`;
}

export function computeLaneTokenRadius(
  isLandscape: boolean,
  lane: RowLaneRect | undefined,
  countInLane: number,
  squadSize: number
): number {
  if (isLandscape) {
    if (!lane) {
      return countInLane <= 2
        ? DESKTOP_RADAR_TOKEN_RADIUS
        : computeDesktopLaneFit(366, countInLane).radius;
    }
    return computeDesktopLaneFit(lane.h, countInLane).radius;
  }
  const safeCount = Math.max(1, countInLane);
  const baseRadius =
    safeCount <= 2 && squadSize <= 4 ? 22 : safeCount <= 3 ? 18 : 16;

  if (!lane) {
    return baseRadius;
  }

  let phoneRadius = baseRadius;
  if (lane.h >= 115) {
    // Phone: grow ring only when collapsed empty lanes give the occupied lane room
    const bodyH = Math.max(20, lane.h - PHONE_EMPTY_LANE_HEIGHT_PX);
    const maxByHeight = Math.floor((bodyH - 58) / 2);
    const slotW = (lane.w - 16) / safeCount;
    const maxByWidth = Math.floor((slotW - 16) / 2);
    phoneRadius = Math.max(
      baseRadius,
      Math.min(DESKTOP_RADAR_TOKEN_RADIUS, maxByHeight, maxByWidth)
    );
  }

  return computePhoneFitRadius(phoneRadius, lane.h, countInLane);
}

/**
 * Builds 3 row lanes (front/middle/back) per side.
 * - Landscape (desktop/tablet): strictly fixed equal columns independent of alive/dead state,
 *   starting below the top-right legend button (padTop = 46).
 * - Portrait phone: collapses empty lanes (0 alive units on that row/side) to a 20px line
 *   and distributes remaining height proportionally among occupied lanes.
 */
export function buildRowLanes(
  isLandscape: boolean,
  vw: number,
  vh: number,
  units?: CombatUnit[]
): RowLaneRect[] {
  const distribute = (
    totalSpan: number,
    gap: number,
    weights: number[]
  ): number[] => {
    const usable = Math.max(60, totalSpan - gap * (weights.length - 1));
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    return weights.map((w) => (usable * w) / sum);
  };

  if (isLandscape) {
    const padX = 10;
    const padTop = 46;
    const padBottom = 8;
    const centerGap = 16;
    const laneGap = 5;
    const halfW = (vw - padX * 2 - centerGap) / 2;
    const y = padTop;
    const h = vh - padTop - padBottom;

    const allyRows: CombatRow[] = ['back', 'middle', 'front'];
    const enemyRows: CombatRow[] = ['front', 'middle', 'back'];

    const fixedWeights = [1, 1, 1];
    const allyWidths = distribute(halfW, laneGap, fixedWeights);
    const enemyWidths = distribute(halfW, laneGap, fixedWeights);

    const lanes: RowLaneRect[] = [];
    let curX = padX;
    allyRows.forEach((row, i) => {
      const colW = allyWidths[i];
      lanes.push({
        side: 'ally',
        row,
        x: curX,
        y,
        w: colW,
        h,
        labelX: curX + colW / 2,
        labelY: y + 14,
        labelAnchor: 'middle',
        badgeX: curX + colW / 2,
        badgeY: y + 14,
        badgeAnchor: 'middle',
        isEmptyCollapsed: false,
      });
      curX += colW + laneGap;
    });

    curX = padX + halfW + centerGap;
    enemyRows.forEach((row, i) => {
      const colW = enemyWidths[i];
      lanes.push({
        side: 'enemy',
        row,
        x: curX,
        y,
        w: colW,
        h,
        labelX: curX + colW / 2,
        labelY: y + 14,
        labelAnchor: 'middle',
        badgeX: curX + colW / 2,
        badgeY: y + 14,
        badgeAnchor: 'middle',
        isEmptyCollapsed: false,
      });
      curX += colW + laneGap;
    });

    return lanes;
  }

  // Portrait phone 6 horizontal bands: Enemy Back -> Middle -> Front || Ally Front -> Middle -> Back
  const padX = 8;
  const padTop = 44;
  const padBottom = 8;
  const centerGap = 10;
  const laneGap = 4;
  const halfH = (vh - padTop - padBottom - centerGap) / 2;
  const w = vw - padX * 2;

  const enemyRows: CombatRow[] = ['back', 'middle', 'front'];
  const allyRows: CombatRow[] = ['front', 'middle', 'back'];

  const computePhoneHeights = (
    side: 'ally' | 'enemy',
    rows: CombatRow[]
  ): { heights: number[]; collapsed: boolean[] } => {
    if (!units) {
      return {
        heights: distribute(halfH, laneGap, [1, 1, 1]),
        collapsed: rows.map(() => false),
      };
    }
    const hasAliveByRow = rows.map((row) =>
      units.some((u) => u.side === side && u.row === row && u.alive)
    );
    const emptyCount = hasAliveByRow.filter((v) => !v).length;
    const occupiedCount = rows.length - emptyCount;
    const totalGaps = laneGap * (rows.length - 1);
    const usable = Math.max(60, halfH - totalGaps);

    if (occupiedCount === 0) {
      return {
        heights: rows.map(() => PHONE_EMPTY_LANE_HEIGHT_PX),
        collapsed: rows.map(() => true),
      };
    }

    const collapsedTotal = emptyCount * PHONE_EMPTY_LANE_HEIGHT_PX;
    const perOccupied = Math.max(
      40,
      (usable - collapsedTotal) / occupiedCount
    );
    return {
      heights: hasAliveByRow.map((hasAlive) =>
        hasAlive ? perOccupied : PHONE_EMPTY_LANE_HEIGHT_PX
      ),
      collapsed: hasAliveByRow.map((hasAlive) => !hasAlive),
    };
  };

  const enemyLayout = computePhoneHeights('enemy', enemyRows);
  const allyLayout = computePhoneHeights('ally', allyRows);

  const lanes: RowLaneRect[] = [];
  let curY = padTop;
  enemyRows.forEach((row, i) => {
    const rowH = enemyLayout.heights[i];
    lanes.push({
      side: 'enemy',
      row,
      x: padX,
      y: curY,
      w,
      h: rowH,
      labelX: padX + 7,
      labelY: curY + 13,
      labelAnchor: 'start',
      badgeX: padX + w - 7,
      badgeY: curY + 13,
      badgeAnchor: 'end',
      isEmptyCollapsed: enemyLayout.collapsed[i],
    });
    curY += rowH + laneGap;
  });

  curY = padTop + halfH + centerGap;
  allyRows.forEach((row, i) => {
    const rowH = allyLayout.heights[i];
    lanes.push({
      side: 'ally',
      row,
      x: padX,
      y: curY,
      w,
      h: rowH,
      labelX: padX + 7,
      labelY: curY + 13,
      labelAnchor: 'start',
      badgeX: padX + w - 7,
      badgeY: curY + 13,
      badgeAnchor: 'end',
      isEmptyCollapsed: allyLayout.collapsed[i],
    });
    curY += rowH + laneGap;
  });

  return lanes;
}

export function computeUnitPositions(
  units: CombatUnit[],
  lanes: RowLaneRect[],
  isLandscape: boolean
): Map<string, TokenPos> {
  const map = new Map<string, TokenPos>();

  for (const lane of lanes) {
    // Only position alive units; dead units have no ghost markers and do not reserve space
    const rowUnits = units
      .filter((u) => u.alive && u.side === lane.side && u.row === lane.row)
      .sort(
        (a, b) =>
          (a.formationCol ?? 0) - (b.formationCol ?? 0) ||
          a.id.localeCompare(b.id)
      );

    const count = rowUnits.length;
    if (count === 0) continue;

    const desktopFit = isLandscape
      ? computeDesktopLaneFit(lane.h, count)
      : undefined;

    rowUnits.forEach((unit, idx) => {
      if (isLandscape) {
        map.set(
          unit.id,
          computeDesktopSlotPosition(lane, idx, count, desktopFit)
        );
      } else {
        const frac = (idx + 0.5) / count;
        const leftSafe = lane.x + 36;
        const rightSafe = lane.x + lane.w - 36;
        const bodyTop = lane.y + PHONE_EMPTY_LANE_HEIGHT_PX;
        const bodyH = Math.max(24, lane.h - PHONE_EMPTY_LANE_HEIGHT_PX);
        const x = leftSafe + frac * Math.max(20, rightSafe - leftSafe);
        const y = bodyTop + bodyH * 0.44;
        map.set(unit.id, { x, y });
      }
    });
  }

  return map;
}

interface RadarUnitMarkerProps {
  unit: CombatUnit;
  lang: Language;
  badgeLayout: StatusBadgeLayout;
  iconMods?: readonly IconCatalogModRow[];
  x: number;
  y: number;
  tokenRadius: number;
  hitSize: number;
  barW: number;
  showMiniChips?: boolean;
  facingAngle: number;
  isActive: boolean;
  isTargeted: boolean;
  isSelected: boolean;
  isBlockedByRow: boolean;
  autoBattleEnabled: boolean;
  animationsSkipped: boolean;
  hoverTooltip: string;
  autoBadgeText: string;
  formatStatusTooltip: (st: ActiveStatusEffect, unit?: CombatUnit) => string;
  onMarkerRef: (unitId: string, el: SVGGElement | null) => void;
  onHoverUnit: (unitId: string | null) => void;
  onTap: (unitId: string) => void;
  onLongPressStart: (unitId: string) => void;
  onLongPressCancel: () => void;
}

const RadarUnitMarker = memo(function RadarUnitMarker({
  unit,
  lang,
  badgeLayout,
  iconMods,
  x,
  y,
  tokenRadius,
  hitSize,
  barW,
  showMiniChips = true,
  facingAngle,
  isActive,
  isTargeted,
  isSelected,
  isBlockedByRow,
  autoBattleEnabled,
  animationsSkipped,
  hoverTooltip,
  autoBadgeText,
  formatStatusTooltip,
  onMarkerRef,
  onHoverUnit,
  onTap,
  onLongPressStart,
  onLongPressCancel,
}: RadarUnitMarkerProps) {
  if (!unit.alive) return null;

  const isEnemy = unit.side === 'enemy';
  const role = getTeamColorRole(unit);
  const teamHex = getTeamHex(role);
  const shape = getMarkerShape(unit);
  const isStealthed = hasStatus(unit, 'stealth');

  const shortName = formatShortUnitName(unit.name, barW <= 48 ? 7 : 10);

  const visualRadius = tokenRadius;
  const ringResult = computeUnitRingArcs(unit, visualRadius);
  const shapeRadius = ringResult.innerShapeRadius;
  const ringOuterRadius = ringResult.outerRadius;
  const ringDiameter = Math.round(ringOuterRadius * 2);
  const cornerBadgeOffset = Number((ringOuterRadius * 0.72).toFixed(1));

  const sortedStatuses = sortStatusEffects(unit.statuses, iconMods);
  const statusLayout = layoutUnitStatusIcons(
    sortedStatuses,
    RADAR_STATUS_MAX_VISIBLE
  );

  const markerOpacity = isStealthed ? 0.55 : isBlockedByRow ? 0.56 : 1;

  const iconScale = Math.max(0.74, Math.min(1.25, shapeRadius / 18));
  const hexOuter = getPolygonPoints(6, shapeRadius, -90);
  const hexInner = getPolygonPoints(6, Math.max(5, shapeRadius - 2.6), -90);
  const diamondOuter = getDiamondPoints(shapeRadius);
  const diamondInner = getDiamondPoints(Math.max(5, shapeRadius - 2.8));
  const fortressOuter = getFortressPoints(shapeRadius);
  const fortressInner = getFortressPoints(Math.max(5, shapeRadius - 2.8));

  // Status row horizontal centering under the name plate (20px chips)
  const statusStep = 22;
  const statusTotalCount =
    statusLayout.visible.length + (statusLayout.overflowCount > 0 ? 1 : 0);
  const statusStartX =
    statusTotalCount > 0 ? -((statusTotalCount - 1) * statusStep) / 2 : 0;

  return (
    <g
      ref={(el) => onMarkerRef(unit.id, el)}
      data-testid={`radar-unit-${unit.id}`}
      data-unit-row={unit.row}
      data-unit-side={unit.side}
      data-marker-shape={shape}
      data-visual-radius={visualRadius}
      data-ring-radius={ringOuterRadius}
      data-ring-diameter={ringDiameter}
      data-ring-mode={ringResult.hpOnlyMode ? 'hp-only' : 'split-ring'}
      data-low-hp={ringResult.isLowHp ? 'true' : 'false'}
      data-acting={isActive ? 'true' : 'false'}
      data-targeted={isTargeted ? 'true' : 'false'}
      data-selected={isSelected || isTargeted ? 'true' : 'false'}
      data-blocked-by-row={isBlockedByRow ? 'true' : 'false'}
      data-unit-down="false"
      transform={`translate(${x}, ${y})`}
      role="button"
      tabIndex={0}
      aria-label={hoverTooltip}
      aria-disabled={!unit.alive ? 'true' : undefined}
      onClick={() => onTap(unit.id)}
      onMouseEnter={() => onHoverUnit(unit.id)}
      onMouseLeave={() => onHoverUnit(null)}
      onFocus={() => onHoverUnit(unit.id)}
      onBlur={() => onHoverUnit(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(unit.id);
        }
      }}
      onPointerDown={() => onLongPressStart(unit.id)}
      onPointerUp={onLongPressCancel}
      onPointerCancel={onLongPressCancel}
      onPointerLeave={onLongPressCancel}
      className={
        !unit.alive
          ? 'cursor-not-allowed focus:outline-none'
          : 'cursor-pointer focus:outline-none'
      }
    >
      <title>{hoverTooltip}</title>

      {/* Invisible >= 44px hit target area (independent of visual icon radius) */}
      <rect
        data-testid={`radar-hit-area-${unit.id}`}
        data-hit-size={hitSize}
        x={-hitSize / 2}
        y={-hitSize / 2}
        width={hitSize}
        height={hitSize}
        rx={hitSize / 2}
        fill="transparent"
      />

      {/* Core visual body with dimmed/down opacity (static SVG — zero animated SVG transforms) */}
      <g opacity={markerOpacity}>
        <g>
          {/* Acting Unit Ring (distinct gold-white halo around concentric rings) */}
          {isActive && unit.alive && (
            <circle
              data-testid={`radar-acting-ring-${unit.id}`}
              cx="0"
              cy="0"
              r={ringOuterRadius + 4.5}
              fill="rgba(254, 240, 138, 0.12)"
              stroke="#fef08a"
              strokeWidth="2.2"
            />
          )}

          {/* Selected Unit Ring (triggered by status board row selection or direct inspection) */}
          {isSelected && unit.alive && (
            <circle
              data-testid={`radar-selected-ring-${unit.id}`}
              cx="0"
              cy="0"
              r={ringOuterRadius + 6}
              fill="rgba(56, 189, 248, 0.14)"
              stroke="#38bdf8"
              strokeWidth="2.2"
            />
          )}

          {/* Current Target Ring (distinct dashed/reticle ring) */}
          {isTargeted && unit.alive && (
            <g data-testid={`radar-target-ring-${unit.id}`}>
              <circle
                cx="0"
                cy="0"
                r={ringOuterRadius + 3.5}
                fill="none"
                stroke={isEnemy ? '#f87171' : '#34d399'}
                strokeWidth="1.6"
                strokeDasharray="4 3"
              />
              <path
                d={`M ${-ringOuterRadius - 5} ${-ringOuterRadius + 2} V ${-ringOuterRadius - 5} H ${-ringOuterRadius + 2}
                    M ${ringOuterRadius - 2} ${-ringOuterRadius - 5} H ${ringOuterRadius + 5} V ${-ringOuterRadius + 2}
                    M ${ringOuterRadius + 5} ${ringOuterRadius - 2} V ${ringOuterRadius + 5} H ${ringOuterRadius - 2}
                    M ${-ringOuterRadius + 2} ${ringOuterRadius + 5} H ${-ringOuterRadius - 5} V ${ringOuterRadius - 2}`}
                fill="none"
                stroke={isEnemy ? '#ef4444' : '#22c55e'}
                strokeWidth="2.1"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Defending / Invincible Shield Aura */}
          {unit.alive &&
            (unit.isDefending || hasStatus(unit, 'invincible')) && (
              <circle
                cx="0"
                cy="0"
                r={ringOuterRadius + 2.5}
                fill="rgba(56, 189, 248, 0.10)"
                stroke="#38bdf8"
                strokeWidth="1.4"
                strokeDasharray="3 3"
              />
            )}

          {/* Inner Disc Base + Thin Inner SP Ring (R >= 30 only; hidden in tier 2 & hpOnlyMode) */}
          {unit.alive && !ringResult.hpOnlyMode && (
            <circle
              cx="0"
              cy="0"
              r={ringResult.innerCircleRadius}
              fill="#070d17"
            />
          )}
          {unit.alive && ringResult.spArc && (
            <g data-testid={`radar-ring-sp-group-${unit.id}`}>
              <circle
                data-testid={`radar-ring-track-sp-${unit.id}`}
                cx="0"
                cy="0"
                r={ringResult.spArc.radius}
                fill="none"
                stroke={ringResult.spArc.trackColor}
                strokeWidth={ringResult.spArc.strokeWidth}
              />
              <circle
                data-testid={`radar-ring-sp-${unit.id}`}
                data-ring-kind="sp"
                data-ratio={ringResult.spArc.ratio}
                data-stroke-width={ringResult.spArc.strokeWidth}
                data-has-capacity={
                  ringResult.spArc.hasCapacity ? 'true' : 'false'
                }
                cx="0"
                cy="0"
                r={ringResult.spArc.radius}
                fill="none"
                stroke={ringResult.spArc.color}
                strokeWidth={ringResult.spArc.strokeWidth}
                strokeDasharray={ringResult.spArc.strokeDasharray}
                strokeDashoffset={ringResult.spArc.strokeDashoffset}
                strokeLinecap="butt"
                transform={ringResult.spArc.transform}
              />
            </g>
          )}

          {/* Split Ring (Left HP, Right Shield, bottom -> top) or HP-only fallback */}
          {unit.alive && (
            <g data-testid={`radar-rings-${unit.id}`}>
              {ringResult.hpOnlyMode ? (
                ringResult.arcs.map((arc) => (
                  <g key={arc.kind}>
                    <circle
                      cx="0"
                      cy="0"
                      r={arc.radius}
                      fill="none"
                      stroke={arc.trackColor}
                      strokeWidth={arc.strokeWidth}
                    />
                    <circle
                      data-testid={`radar-ring-${arc.kind}-${unit.id}`}
                      data-ring-kind={arc.kind}
                      data-ratio={arc.ratio}
                      data-stroke-width={arc.strokeWidth}
                      data-low-hp={arc.isLowHp ? 'true' : 'false'}
                      cx="0"
                      cy="0"
                      r={arc.radius}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={arc.strokeWidth}
                      strokeDasharray={arc.strokeDasharray}
                      strokeDashoffset={arc.strokeDashoffset}
                      strokeLinecap="butt"
                      transform={arc.transform}
                      className={
                        arc.kind === 'hp' && arc.isLowHp && !animationsSkipped
                          ? 'vfx-low-hp-pulse'
                          : undefined
                      }
                    />
                    <line
                      data-testid={`radar-ring-tick-${arc.kind}-${unit.id}`}
                      x1="0"
                      y1={arc.tickY - 1.4}
                      x2="0"
                      y2={arc.tickY + 1.4}
                      stroke="#f8fafc"
                      strokeOpacity="0.85"
                      strokeWidth="1.1"
                    />
                  </g>
                ))
              ) : (
                <>
                  {ringResult.arcs.map((arc) => (
                    <g key={arc.kind}>
                      {arc.kind === 'shield' && !ringResult.hasShield ? (
                        <path
                          data-testid={`radar-ring-shield-empty-track-${unit.id}`}
                          d={`M 0 ${arc.radius} A ${arc.radius} ${arc.radius} 0 0 0 0 ${-arc.radius}`}
                          fill="none"
                          stroke={arc.trackColor}
                          strokeWidth={arc.strokeWidth}
                          strokeDasharray="3 3"
                          strokeOpacity="0.65"
                        />
                      ) : (
                        <circle
                          data-testid={`radar-ring-track-${arc.kind}-${unit.id}`}
                          cx="0"
                          cy="0"
                          r={arc.radius}
                          fill="none"
                          stroke={arc.trackColor}
                          strokeWidth={arc.strokeWidth}
                          strokeDasharray={arc.trackDasharray}
                          strokeDashoffset="0"
                          strokeLinecap="butt"
                          transform={arc.transform}
                        />
                      )}
                      <circle
                        data-testid={`radar-ring-${arc.kind}-${unit.id}`}
                        data-ring-kind={arc.kind}
                        data-ratio={arc.ratio}
                        data-stroke-width={arc.strokeWidth}
                        data-low-hp={arc.isLowHp ? 'true' : 'false'}
                        data-has-capacity={arc.hasCapacity ? 'true' : 'false'}
                        cx="0"
                        cy="0"
                        r={arc.radius}
                        fill="none"
                        stroke={arc.color}
                        strokeWidth={arc.strokeWidth}
                        strokeDasharray={arc.strokeDasharray}
                        strokeDashoffset={arc.strokeDashoffset}
                        strokeLinecap="butt"
                        transform={arc.transform}
                        className={
                          arc.kind === 'hp' && arc.isLowHp && !animationsSkipped
                            ? 'vfx-low-hp-pulse'
                            : undefined
                        }
                      />
                    </g>
                  ))}
                  {/* 6px ticks at 12 and 6 o'clock marking the vertical 50/50 split */}
                  <line
                    data-testid={`radar-ring-tick-top-${unit.id}`}
                    x1="0"
                    y1={-(ringResult.ringRadius + 3)}
                    x2="0"
                    y2={-(ringResult.ringRadius - 3)}
                    stroke="#f8fafc"
                    strokeOpacity="0.9"
                    strokeWidth="1.3"
                  />
                  <line
                    data-testid={`radar-ring-tick-bottom-${unit.id}`}
                    x1="0"
                    y1={ringResult.ringRadius - 3}
                    x2="0"
                    y2={ringResult.ringRadius + 3}
                    stroke="#f8fafc"
                    strokeOpacity="0.9"
                    strokeWidth="1.3"
                  />
                </>
              )}
            </g>
          )}

          {/* Color-blind readable team shape + outline */}
          {shape === 'player-hex' && (
            <g>
              <polygon
                points={hexOuter}
                fill={unit.alive ? '#0a1622' : '#0b1019'}
                stroke={isActive ? '#fef08a' : teamHex}
                strokeWidth={isActive ? '2.1' : unit.alive ? '1.8' : '1.2'}
                strokeLinejoin="round"
              />
              {unit.alive && (
                <polygon
                  points={hexInner}
                  fill="none"
                  stroke={teamHex}
                  strokeOpacity="0.55"
                  strokeWidth="0.9"
                  strokeLinejoin="round"
                />
              )}
            </g>
          )}

          {shape === 'ally-circle' && (
            <circle
              cx="0"
              cy="0"
              r={shapeRadius}
              fill={unit.alive ? '#0b1320' : '#0b1019'}
              stroke={isActive ? '#fef08a' : teamHex}
              strokeWidth={isActive ? '2' : unit.alive ? '1.6' : '1.2'}
              strokeDasharray={isStealthed ? '3 2' : undefined}
            />
          )}

          {shape === 'enemy-diamond' && (
            <g>
              <polygon
                points={diamondOuter}
                fill={unit.alive ? '#140b12' : '#0b1019'}
                stroke={isActive ? '#fef08a' : teamHex}
                strokeWidth={isActive ? '2' : unit.alive ? '1.7' : '1.2'}
                strokeDasharray={isStealthed ? '3 2' : undefined}
                strokeLinejoin="miter"
              />
              {unit.alive && (
                <polygon
                  points={diamondInner}
                  fill="none"
                  stroke={teamHex}
                  strokeOpacity="0.45"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                />
              )}
            </g>
          )}

          {shape === 'boss-fortress' && (
            <g>
              <polygon
                points={fortressOuter}
                fill={unit.alive ? '#170f0c' : '#0b1019'}
                stroke={isActive ? '#fef08a' : teamHex}
                strokeWidth={isActive ? '2.1' : unit.alive ? '1.9' : '1.2'}
                strokeLinejoin="miter"
              />
              {unit.alive && (
                <polygon
                  points={fortressInner}
                  fill="none"
                  stroke={teamHex}
                  strokeOpacity="0.6"
                  strokeWidth="1"
                />
              )}
            </g>
          )}

          {/* Center Role Icon or small dim Down X */}
          {unit.alive ? (
            <ClassCenterIcon
              classId={unit.classId}
              isStructure={unit.isStructure}
              isBoss={unit.isBoss}
              color={teamHex}
              facingAngle={facingAngle}
              scale={iconScale}
            />
          ) : (
            <path
              d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5"
              stroke="#64748b"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}

          {/* 16px AUTO Badge on top-left corner of Player Ring */}
          {unit.isPlayer && autoBattleEnabled && (
            <g
              data-testid={`radar-auto-badge-${unit.id}`}
              data-badge-size="16"
              transform={`translate(${-cornerBadgeOffset}, ${-cornerBadgeOffset})`}
            >
              <rect
                x="-14"
                y="-8"
                width="28"
                height="16"
                rx="4"
                fill="#22c55e"
                stroke="#052e16"
                strokeWidth="1"
              />
              <text
                x="0"
                y="2.5"
                textAnchor="middle"
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="800"
                fill="#020617"
              >
                {autoBadgeText}
              </text>
            </g>
          )}
        </g>

        {/* Under the marker: 1-line truncated Name Plate + max 3 icon-only 20px mini chips + "+N" (no text tag pills) */}
        <g transform={`translate(0, ${ringOuterRadius + 4})`}>
          <title>{unit.name}</title>
          <rect
            x={-barW / 2 - 4}
            y="0"
            width={barW + 8}
            height="12"
            rx="3"
            fill="rgba(5, 10, 18, 0.9)"
          />
          <text
            data-testid="radar-unit-name"
            x="0"
            y="8.8"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill={isActive ? '#fef08a' : '#f1f5f9'}
          >
            {shortName}
          </text>

          {/* Up to 3 icon-only 20px mini chips (+N when more); suppressed in crowded >=4-unit lanes */}
          {showMiniChips && statusLayout.visible.length > 0 && (
            <g
              data-testid={`radar-status-${unit.id}`}
              transform="translate(0, 23)"
            >
              {statusLayout.visible.map((st, sIdx) => {
                const row = getCatalogRowForStatus(st.type, iconMods);
                const visualKind = getStatusVisualKind(st, row);
                const stTip = formatStatusTooltip(st, unit);
                const cxIcon = statusStartX + sIdx * statusStep;
                return (
                  <g
                    key={`${st.type}-${sIdx}`}
                    data-testid={`radar-status-icon-${unit.id}-${sIdx}`}
                    data-status-type={st.type}
                    data-status-kind={visualKind}
                    data-status-symbol={row?.symbol ?? st.type}
                    transform={`translate(${cxIcon}, 0)`}
                    role="button"
                    tabIndex={-1}
                    aria-label={stTip}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTap(unit.id);
                    }}
                    className="cursor-pointer"
                  >
                    <title>{stTip}</title>
                    <foreignObject
                      x="-12"
                      y="-12"
                      width="24"
                      height="24"
                      overflow="visible"
                    >
                      <div className="w-full h-full flex items-center justify-center pointer-events-none">
                        <StatusChip
                          status={st}
                          lang={lang}
                          unit={unit}
                          badgeLayout={badgeLayout}
                          iconMods={iconMods}
                          size="xs"
                          showLabel={false}
                          allowStack={false}
                          stacks={1}
                          className="!p-0 !border-0 !bg-transparent"
                        />
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
              {statusLayout.overflowCount > 0 && (
                <g
                  transform={`translate(${
                    statusStartX + statusLayout.visible.length * statusStep
                  }, 0)`}
                >
                  <rect
                    x="-9"
                    y="-8"
                    width="18"
                    height="16"
                    rx="3"
                    fill="#0f172a"
                    stroke="#64748b"
                    strokeWidth="1"
                  />
                  <text
                    data-testid={`radar-status-overflow-${unit.id}`}
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="800"
                    fill="#e2e8f0"
                  >
                    +{statusLayout.overflowCount}
                  </text>
                </g>
              )}
            </g>
          )}
        </g>
      </g>

      {/* 16px Lock Icon on top-right corner of Ring when blocked by front/middle row */}
      {isBlockedByRow && (
        <g
          data-testid={`radar-lock-${unit.id}`}
          data-badge-size="16"
          transform={`translate(${cornerBadgeOffset}, ${-cornerBadgeOffset})`}
        >
          <circle
            cx="0"
            cy="0"
            r="8"
            fill="#090f1a"
            stroke="#fbbf24"
            strokeWidth="1.4"
          />
          <path
            d="M -2.5 -0.8 V -2.6 A 2.5 2.5 0 0 1 2.5 -2.6 V -0.8"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <rect
            x="-3.6"
            y="-0.8"
            width="7.2"
            height="5.2"
            rx="1"
            fill="#fbbf24"
          />
        </g>
      )}
    </g>
  );
});

export function BattleRadarView({
  battle,
  activeUnitId,
  validBasicTargetIds,
  canPlayerManualAct,
  hasSingleAllySkill,
  autoBattleEnabled,
  skipAnimations,
  speechBubblesEnabled = true,
  battleSpeed = 1,
  effectsMode: effectsModeProp,
  reducedMotionMode: reducedMotionModeProp,
  effectsDebugEnabled: effectsDebugProp,
  showStatusLabels: _showStatusLabelsProp,
  playerWeaponId = null,
  layoutMode: layoutModeProp,
  selectedUnitId = null,
  onSelectEnemy,
  onSelectAlly,
  onInspectUnit,
  onInvalidTargetLog,
}: BattleRadarViewProps) {
  const { lang, t } = useI18n();
  const adminStatusDefaults = useGameStore(
    (s) => s.adminConfig.statusDisplayDefaults
  );
  const formationConfig = useGameStore((s) => s.adminConfig.formation);
  const iconMods = useGameStore((s) => s.adminConfig.iconCatalogMods);
  const adminPopupFlightMs = useGameStore(
    (s) => s.adminConfig.cardPopupFlightMs
  );
  const adminRadarStartScalePct = useGameStore(
    (s) => s.adminConfig.radarPopupStartScalePct
  );
  const adminRadarSmallScalePct = useGameStore(
    (s) => s.adminConfig.radarPopupSmallScalePct
  );
  const adminRadarLargeScalePct = useGameStore(
    (s) => s.adminConfig.radarPopupLargeScalePct
  );
  const adminRadarBigMaxUnits = useGameStore(
    (s) => s.adminConfig.radarPopupBigMaxUnits
  );
  const radarPopupCfg = useMemo(
    () =>
      resolveRadarPopupConfig({
        cardPopupFlightMs: adminPopupFlightMs,
        radarPopupStartScalePct: adminRadarStartScalePct,
        radarPopupSmallScalePct: adminRadarSmallScalePct,
        radarPopupLargeScalePct: adminRadarLargeScalePct,
        radarPopupBigMaxUnits: adminRadarBigMaxUnits,
      }),
    [
      adminPopupFlightMs,
      adminRadarStartScalePct,
      adminRadarSmallScalePct,
      adminRadarLargeScalePct,
      adminRadarBigMaxUnits,
    ]
  );
  const { settings: statusSettings } =
    useStatusDisplaySettings(adminStatusDefaults);
  const detectedMode = useBattleLayoutMode();
  const [fxSettings] = useFxSettings();
  const osReducedMotion = usePrefersReducedMotion();
  const effectiveEffectsMode = effectsModeProp ?? fxSettings.effectsMode;
  const effectiveReducedMotionMode =
    reducedMotionModeProp ?? fxSettings.reducedMotionMode;
  const effectiveDebugEnabled = effectsDebugProp ?? fxSettings.effectsDebug;
  const resolvedReducedMotion = resolveReducedMotion(
    effectiveReducedMotionMode,
    osReducedMotion
  );
  const layoutMode = layoutModeProp ?? detectedMode;
  const isLandscape = layoutMode !== 'phone-portrait';
  const vfxConfig = useMemo(
    () =>
      resolveEffectiveVfxConfig(
        effectiveEffectsMode,
        battleSpeed,
        resolvedReducedMotion,
        skipAnimations
      ),
    [effectiveEffectsMode, battleSpeed, resolvedReducedMotion, skipAnimations]
  );
  const animationsSkipped = vfxConfig.animationsSkipped;

  // Auto-show the FX debug line for 3 seconds at battle start when reduced-motion resolves to true
  const [autoReducedNoticeVisible, setAutoReducedNoticeVisible] = useState(false);
  const lastNoticedBattleKeyRef = useRef<string | null>(null);
  const battleNoticeKey = `${battle.sectorId}:${battle.deployedGearId}:${battle.round <= 1 ? 'start' : 'mid'}`;

  useEffect(() => {
    if (!resolvedReducedMotion) {
      setAutoReducedNoticeVisible(false);
      return;
    }
    if (lastNoticedBattleKeyRef.current === battleNoticeKey) return;
    lastNoticedBattleKeyRef.current = battleNoticeKey;
    setAutoReducedNoticeVisible(true);
    const timer = window.setTimeout(() => {
      setAutoReducedNoticeVisible(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [resolvedReducedMotion, battleNoticeKey]);

  const [legendOpen, setLegendOpen] = useState<boolean>(() =>
    readRadarLegendOpen()
  );
  const [fadingDefeatIds, setFadingDefeatIds] = useState<string[]>([]);
  const [rowSlides, setRowSlides] = useState<RowSlideEffect[]>([]);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [visibleBubbleId, setVisibleBubbleId] = useState<string | null>(
    battle.wingmanChat?.id ?? null
  );

  // Per-unit floating label FIFO queue (1 active label at a time per unit, ~600ms each, max 3 queued, drop older)
  const seenPopupIdsRef = useRef<Set<string>>(new Set());
  const floatingTimersRef = useRef<Map<string, number>>(new Map());
  const lastTurnForPopupsRef = useRef<number>(battle.turnCounter);
  const [floatingQueue, setFloatingQueue] =
    useState<RadarFloatingLabelQueueState>(() => {
      if (shouldSkipRadarFloatingLabels(battleSpeed)) {
        for (const pop of battle.popups) {
          seenPopupIdsRef.current.add(pop.id);
        }
        return createRadarFloatingLabelQueue();
      }
      const aliveIds = new Set(
        battle.units.filter((u) => u.alive).map((u) => u.id)
      );
      let q = createRadarFloatingLabelQueue();
      for (const pop of battle.popups) {
        seenPopupIdsRef.current.add(pop.id);
        if (!aliveIds.has(pop.unitId)) continue;
        q = enqueueRadarFloatingLabel(q, pop, RADAR_FLOATING_LABEL_MAX_QUEUED);
      }
      return q;
    });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerElementsRef = useRef<Map<string, SVGGElement>>(new Map());
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const prevAliveMapRef = useRef<Map<string, boolean>>(new Map());
  const prevRowPosMapRef = useRef<Map<string, { row: CombatRow; pos: TokenPos }>>(
    new Map()
  );
  const defeatTimersRef = useRef<Map<string, number>>(new Map());
  const rowSlideTimersRef = useRef<Map<string, number>>(new Map());

  const registerMarkerRef = useCallback(
    (unitId: string, el: SVGGElement | null) => {
      if (el) {
        markerElementsRef.current.set(unitId, el);
      } else {
        markerElementsRef.current.delete(unitId);
      }
    },
    []
  );

  const defeatFadeDurationMs = computeDefeatFadeDurationMs(battleSpeed);

  const toggleLegend = useCallback(() => {
    setLegendOpen((prev) => {
      const next = !prev;
      writeRadarLegendOpen(next);
      return next;
    });
  }, []);

  const formatStatusTooltip = useCallback(
    (st: ActiveStatusEffect, unit?: CombatUnit): string => {
      const detail = formatStatusEffectDetail(lang, st, unit);
      const valuePart = detail.valueText
        ? `${detail.label}: ${detail.valueText}`
        : detail.label;
      if (st.turnsRemaining > 0 && st.turnsRemaining < 50) {
        return `${valuePart} (${translate(lang, 'radar.statusRounds', {
          turns: st.turnsRemaining,
        })})`;
      }
      return valuePart;
    },
    [lang]
  );

  const skipFloatingLabelsForSpeed = shouldSkipRadarFloatingLabels(battleSpeed);

  // Sync incoming popups & dead units into per-unit floating label queue
  useEffect(() => {
    if (battle.turnCounter < lastTurnForPopupsRef.current) {
      seenPopupIdsRef.current.clear();
      floatingTimersRef.current.forEach((id) => window.clearTimeout(id));
      floatingTimersRef.current.clear();
    }
    lastTurnForPopupsRef.current = battle.turnCounter;

    // LP2 High speed safety: at >=15x, skip queueing floating labels so queue never lags behind battle
    if (skipFloatingLabelsForSpeed) {
      for (const pop of battle.popups) {
        seenPopupIdsRef.current.add(pop.id);
      }
      floatingTimersRef.current.forEach((id) => window.clearTimeout(id));
      floatingTimersRef.current.clear();
      setFloatingQueue((prev) =>
        Object.keys(prev.activeByUnit).length === 0 &&
        Object.keys(prev.pendingByUnit).length === 0
          ? prev
          : createRadarFloatingLabelQueue()
      );
      return;
    }

    const aliveIds = new Set(
      battle.units.filter((u) => u.alive).map((u) => u.id)
    );

    setFloatingQueue((prev) => {
      let next = pruneDeadRadarFloatingLabels(prev, aliveIds);
      for (const pop of battle.popups) {
        if (seenPopupIdsRef.current.has(pop.id)) continue;
        seenPopupIdsRef.current.add(pop.id);
        if (!aliveIds.has(pop.unitId)) continue;
        next = enqueueRadarFloatingLabel(
          next,
          pop,
          RADAR_FLOATING_LABEL_MAX_QUEUED
        );
      }
      return next;
    });
  }, [battle.popups, battle.units, battle.turnCounter, skipFloatingLabelsForSpeed]);

  // Schedule 600ms auto-advance per active floating label slot
  useEffect(() => {
    if (!vfxConfig.showFloatingNumbers || skipFloatingLabelsForSpeed) {
      floatingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      floatingTimersRef.current.clear();
      return;
    }

    const activeKeys = new Set<string>();
    for (const [unitId, popup] of Object.entries(floatingQueue.activeByUnit)) {
      if (!popup) continue;
      const timerKey = `${unitId}:${popup.id}`;
      activeKeys.add(timerKey);
      if (!floatingTimersRef.current.has(timerKey)) {
        const timerId = window.setTimeout(() => {
          floatingTimersRef.current.delete(timerKey);
          setFloatingQueue((cur) =>
            advanceRadarFloatingLabel(cur, unitId, popup.id)
          );
        }, RADAR_FLOATING_LABEL_DURATION_MS);
        floatingTimersRef.current.set(timerKey, timerId);
      }
    }

    floatingTimersRef.current.forEach((timerId, key) => {
      if (!activeKeys.has(key)) {
        window.clearTimeout(timerId);
        floatingTimersRef.current.delete(key);
      }
    });
  }, [floatingQueue, vfxConfig.showFloatingNumbers, skipFloatingLabelsForSpeed]);

  // Auto-hide speech bubble after 1.5s cleanly even when rendered standalone
  useEffect(() => {
    const chatId = battle.wingmanChat?.id ?? null;
    if (!chatId || !speechBubblesEnabled) {
      setVisibleBubbleId(null);
      return;
    }
    setVisibleBubbleId(chatId);
    const timer = window.setTimeout(() => {
      setVisibleBubbleId((cur) => (cur === chatId ? null : cur));
    }, SPEECH_BUBBLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [battle.wingmanChat?.id, speechBubblesEnabled]);

  useEffect(() => {
    return () => {
      floatingTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      floatingTimersRef.current.clear();
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
      defeatTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      defeatTimersRef.current.clear();
      rowSlideTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      rowSlideTimersRef.current.clear();
    };
  }, []);

  // Purely visual defeat fade-out tracker (~400ms scaled by speed); skipped under reduced motion
  useEffect(() => {
    const prevMap = prevAliveMapRef.current;
    const newlyDefeated: string[] = [];

    for (const u of battle.units) {
      const wasAlive = prevMap.get(u.id);
      if (wasAlive === true && !u.alive) {
        newlyDefeated.push(u.id);
      }
      prevMap.set(u.id, u.alive);
    }

    if (animationsSkipped || newlyDefeated.length === 0) return;

    setFadingDefeatIds((prev) => {
      const next = new Set(prev);
      for (const id of newlyDefeated) next.add(id);
      return Array.from(next);
    });

    for (const id of newlyDefeated) {
      const existing = defeatTimersRef.current.get(id);
      if (existing !== undefined) {
        window.clearTimeout(existing);
      }
      const timerId = window.setTimeout(() => {
        setFadingDefeatIds((prev) => prev.filter((x) => x !== id));
        defeatTimersRef.current.delete(id);
      }, defeatFadeDurationMs + 40);
      defeatTimersRef.current.set(id, timerId);
    }
  }, [battle.units, animationsSkipped, defeatFadeDurationMs]);

  // Tighter viewBox so 4v4 fills the field well and 8v8 still fits with zero clipping
  const vw = isLandscape ? 720 : 380;
  const vh = isLandscape ? 420 : 500;
  const cx = vw / 2;
  const cy = vh / 2;

  const lanes = useMemo(
    () => buildRowLanes(isLandscape, vw, vh, battle.units),
    [isLandscape, vw, vh, battle.units]
  );

  const laneByKey = useMemo(() => {
    const map = new Map<string, RowLaneRect>();
    for (const lane of lanes) {
      map.set(`${lane.side}:${lane.row}`, lane);
    }
    return map;
  }, [lanes]);

  const posMap = useMemo(
    () => computeUnitPositions(battle.units, lanes, isLandscape),
    [battle.units, lanes, isLandscape]
  );

  // Include transient defeat-fade coordinates for BattleVfxOverlay explosion FX only
  // (never rendered as RadarUnitMarker ghosts or floating labels)
  const defeatPosFallbackMap = useMemo(() => {
    const map = new Map(posMap);
    for (const u of battle.units) {
      if (u.alive || map.has(u.id)) continue;
      const lane = laneByKey.get(`${u.side}:${u.row}`);
      if (!lane) continue;
      map.set(u.id, {
        x: lane.x + lane.w / 2,
        y: isLandscape
          ? lane.y + lane.h * 0.45
          : lane.y +
            PHONE_EMPTY_LANE_HEIGHT_PX +
            Math.max(24, lane.h - PHONE_EMPTY_LANE_HEIGHT_PX) * 0.44,
      });
    }
    return map;
  }, [posMap, battle.units, laneByKey, isLandscape]);

  // Detect engine-driven unit row changes and play a short compositor-only slide animation
  useEffect(() => {
    const prevMap = prevRowPosMapRef.current;
    const newSlides: RowSlideEffect[] = [];
    const slideDurationMs = Math.max(140, Math.round(320 / Math.max(1, battleSpeed)));

    for (const u of battle.units) {
      const curPos = posMap.get(u.id);
      if (!curPos) continue;
      const prev = prevMap.get(u.id);
      if (prev && prev.row !== u.row && u.alive && !animationsSkipped) {
        newSlides.push({
          id: `slide_${u.id}_${Date.now()}_${u.row}`,
          unitId: u.id,
          side: u.side,
          fromPos: prev.pos,
          toPos: curPos,
          durationMs: slideDurationMs,
        });
      }
      prevMap.set(u.id, { row: u.row, pos: curPos });
    }

    if (newSlides.length === 0) return;

    setRowSlides((prev) => [...prev, ...newSlides].slice(-8));
    for (const slide of newSlides) {
      const timerId = window.setTimeout(() => {
        setRowSlides((prev) => prev.filter((s) => s.id !== slide.id));
        rowSlideTimersRef.current.delete(slide.id);
      }, slide.durationMs + 60);
      rowSlideTimersRef.current.set(slide.id, timerId);
    }
  }, [battle.units, posMap, battleSpeed, animationsSkipped]);

  const enemyExposure = useMemo(
    () => computeRowExposure(battle.units, 'enemy'),
    [battle.units]
  );
  const allyExposure = useMemo(
    () => computeRowExposure(battle.units, 'ally'),
    [battle.units]
  );

  const aliveCountByLane = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of battle.units) {
      if (!u.alive) continue;
      const key = `${u.side}:${u.row}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [battle.units]);

  const unitRingMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        tokenRadius: number;
        ringOuterRadius: number;
        barW: number;
        showMiniChips: boolean;
      }
    >();
    for (const u of battle.units) {
      if (!u.alive) continue;
      const laneKey = `${u.side}:${u.row}`;
      const lane = laneByKey.get(laneKey);
      const countInLane = aliveCountByLane.get(laneKey) ?? 1;
      const fit = isLandscape
        ? computeDesktopLaneFit(lane?.h ?? 366, countInLane)
        : null;
      const tokenRadius = computeLaneTokenRadius(
        isLandscape,
        lane,
        countInLane,
        battle.squadSize
      );
      const ringOuterRadius = computeUnitRingArcs(u, tokenRadius).outerRadius;
      const showMiniChips = fit
        ? fit.showMiniChips
        : shouldShowRadarMiniChips(countInLane);
      const barW = isLandscape
        ? fit && fit.subColumns === 2 && lane
          ? Math.min(64, Math.max(28, Math.floor(lane.w * 0.5 - 10)))
          : 64
        : tokenRadius >= 28
        ? 60
        : tokenRadius >= 22
        ? 56
        : 52;
      map.set(u.id, { tokenRadius, ringOuterRadius, barW, showMiniChips });
    }
    return map;
  }, [battle.units, battle.squadSize, laneByKey, aliveCountByLane, isLandscape]);

  const hitSize = getRadarHitAreaSize(isLandscape);

  // Active unit and targeting actor
  const activeUnit = useMemo(
    () => battle.units.find((u) => u.id === activeUnitId) ?? null,
    [battle.units, activeUnitId]
  );

  const targetingActor = useMemo(() => {
    if (activeUnit && activeUnit.side === 'ally' && activeUnit.alive) {
      return activeUnit;
    }
    return (
      battle.units.find((u) => u.isPlayer && u.alive) ??
      battle.units.find((u) => u.side === 'ally' && u.alive) ??
      null
    );
  }, [activeUnit, battle.units]);

  const enemyValidityMap = useMemo(() => {
    const map = new Map<string, TargetValidityResult>();
    for (const unit of battle.units) {
      if (unit.side !== 'enemy') continue;
      const result = evaluateRadarTargetValidity(
        battle.units,
        targetingActor,
        unit,
        'attack'
      );
      if (
        !result.ignoresRowBlocking &&
        result.valid &&
        validBasicTargetIds.size > 0 &&
        !validBasicTargetIds.has(unit.id)
      ) {
        map.set(unit.id, {
          ...result,
          valid: false,
          blockedByRow: true,
          reason:
            enemyExposure.front === 'exposed'
              ? 'front_row_alive'
              : 'middle_row_alive',
          blockingRow: enemyExposure.front === 'exposed' ? 'front' : 'middle',
        });
      } else {
        map.set(unit.id, result);
      }
    }
    return map;
  }, [battle.units, targetingActor, validBasicTargetIds, enemyExposure]);

  const fxHitTargetIds = useMemo(() => {
    const set = new Set<string>();
    for (const u of battle.units) {
      if (u.animState === 'hit' || u.animState === 'shielded') set.add(u.id);
    }
    for (const fx of battle.fxEvents) {
      if (fx.kind === 'heal') continue;
      if (fx.toUnitIds && fx.toUnitIds.length > 0) {
        for (const id of fx.toUnitIds) {
          if (id) set.add(id);
        }
      } else {
        const toSideUnits = battle.units.filter((u) => u.side === fx.toSide);
        for (const slotIdx of fx.toSlotIndices) {
          const target = toSideUnits[slotIdx];
          if (target) set.add(target.id);
        }
      }
    }
    return set;
  }, [battle.units, battle.fxEvents]);

  const defeatFadingSet = useMemo(() => {
    const set = new Set<string>(fadingDefeatIds);
    for (const id of battle.explodedUnitIds) {
      set.add(id);
    }
    return set;
  }, [fadingDefeatIds, battle.explodedUnitIds]);

  const aliveUnitsCount = useMemo(
    () => battle.units.reduce((acc, u) => (u.alive ? acc + 1 : acc), 0),
    [battle.units]
  );
  const radarPopupScales = useMemo(
    () => computeRadarPopupScales(aliveUnitsCount, radarPopupCfg),
    [aliveUnitsCount, radarPopupCfg]
  );

  // One active floating label per alive unit, fixed 18px slot strictly ABOVE the unit ring
  const activeFloatingLabels = useMemo(() => {
    if (skipFloatingLabelsForSpeed) return [];
    const items: Array<{
      popup: FloatingPopup;
      leftPct: number;
      topPct: number;
      dyPct: number;
    }> = [];
    for (const u of battle.units) {
      if (!u.alive) continue;
      const popup = floatingQueue.activeByUnit[u.id];
      if (!popup) continue;
      const pos = posMap.get(u.id);
      if (!pos) continue;
      const ringMeta = unitRingMetaMap.get(u.id);
      const ringOuterRadius = ringMeta?.ringOuterRadius ?? (isLandscape ? 40 : 25);
      const leftPct = Number(
        Math.max(10, Math.min(90, (pos.x / Math.max(1, vw)) * 100)).toFixed(2)
      );
      const slotTopSvgY = Math.max(2, pos.y - ringOuterRadius - 21);
      const topPct = Number(
        Math.max(0.5, Math.min(88, (slotTopSvgY / Math.max(1, vh)) * 100)).toFixed(2)
      );
      const dyPct = Number(
        (((ringOuterRadius + 12) / Math.max(1, vh)) * 100).toFixed(2)
      );
      items.push({ popup, leftPct, topPct, dyPct });
    }
    return items;
  }, [
    battle.units,
    floatingQueue.activeByUnit,
    posMap,
    unitRingMetaMap,
    isLandscape,
    vw,
    vh,
    skipFloatingLabelsForSpeed,
  ]);

  const interactionRef = useRef({
    battle,
    canPlayerManualAct,
    hasSingleAllySkill,
    enemyValidityMap,
    onSelectEnemy,
    onSelectAlly,
    onInspectUnit,
    onInvalidTargetLog,
  });
  interactionRef.current = {
    battle,
    canPlayerManualAct,
    hasSingleAllySkill,
    enemyValidityMap,
    onSelectEnemy,
    onSelectAlly,
    onInspectUnit,
    onInvalidTargetLog,
  };

  const handleTokenTap = useCallback((unitId: string) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    const ctx = interactionRef.current;
    const unit = ctx.battle.units.find((u) => u.id === unitId);
    if (!unit || !unit.alive) return;

    const isEnemy = unit.side === 'enemy';
    const isEnemySelected = ctx.battle.selectedTargetId === unit.id;
    const isAllySelected = ctx.battle.selectedAllyTargetId === unit.id;

    if (isEnemy && ctx.canPlayerManualAct) {
      const validity = ctx.enemyValidityMap.get(unit.id);
      if (validity && !validity.valid) {
        ctx.onInvalidTargetLog?.(validity.reason, unit);
        return;
      }
      if (!isEnemySelected) {
        ctx.onSelectEnemy(unit.id);
        return;
      }
    }

    if (
      !isEnemy &&
      ctx.hasSingleAllySkill &&
      ctx.canPlayerManualAct &&
      !isAllySelected
    ) {
      ctx.onSelectAlly(unit.id);
      return;
    }

    ctx.onInspectUnit(unit);
  }, []);

  const handleLongPressStart = useCallback((unitId: string) => {
    longPressFiredRef.current = false;
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      const ctx = interactionRef.current;
      const unit = ctx.battle.units.find((u) => u.id === unitId);
      if (unit) ctx.onInspectUnit(unit);
    }, 420);
  }, []);

  const handleLongPressCancel = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Thin targeting line shown ONLY while the player is choosing a target in Manual mode.
  // Removed in Auto mode, during enemy/AI turns, and as soon as an action is confirmed/resolving.
  const manualAimLine = useMemo<ManualAimLineSpec | null>(() => {
    if (
      battle.summary ||
      autoBattleEnabled ||
      !canPlayerManualAct ||
      battle.isResolving ||
      battle.fxEvents.length > 0 ||
      !activeUnit ||
      !activeUnit.isPlayer ||
      !activeUnit.alive
    ) {
      return null;
    }

    let targetUnit: CombatUnit | null = null;

    // Priority 1: Hovered valid target during Manual selection
    if (hoveredTargetId && hoveredTargetId !== activeUnit.id) {
      const hovered = battle.units.find(
        (u) => u.id === hoveredTargetId && u.alive
      );
      if (hovered) {
        if (hovered.side === 'enemy') {
          const validity = enemyValidityMap.get(hovered.id);
          if (!validity || validity.valid) {
            targetUnit = hovered;
          }
        } else if (hasSingleAllySkill) {
          targetUnit = hovered;
        }
      }
    }

    // Priority 2: Currently selected ally (when player has single-ally support skill)
    if (!targetUnit && hasSingleAllySkill && battle.selectedAllyTargetId) {
      const allyTarget = battle.units.find(
        (u) => u.id === battle.selectedAllyTargetId && u.alive
      );
      if (allyTarget && allyTarget.id !== activeUnit.id) {
        targetUnit = allyTarget;
      }
    }

    // Priority 3: Currently selected enemy target
    if (!targetUnit && battle.selectedTargetId) {
      const enemyTarget = battle.units.find(
        (u) => u.id === battle.selectedTargetId && u.alive
      );
      if (enemyTarget) {
        targetUnit = enemyTarget;
      }
    }

    if (!targetUnit || targetUnit.id === activeUnit.id) return null;

    return {
      fromId: activeUnit.id,
      toId: targetUnit.id,
      isAllySupport: targetUnit.side === activeUnit.side,
    };
  }, [
    battle.summary,
    battle.isResolving,
    battle.fxEvents.length,
    battle.units,
    battle.selectedTargetId,
    battle.selectedAllyTargetId,
    autoBattleEnabled,
    canPlayerManualAct,
    activeUnit,
    hoveredTargetId,
    enemyValidityMap,
    hasSingleAllySkill,
  ]);

  // Compact speech bubble (single short line <= 28 chars, collision-avoiding anchor, auto-hides after 1.5s, toggleable)
  const activeBubble = useMemo(() => {
    if (
      !speechBubblesEnabled ||
      !battle.wingmanChat ||
      visibleBubbleId !== battle.wingmanChat.id
    ) {
      return null;
    }
    const unit = battle.units.find(
      (u) => u.id === battle.wingmanChat?.unitId && u.alive
    );
    if (!unit) return null;
    const anchor = computeSpeechBubbleAnchor(unit.id, posMap, vw, vh);
    if (!anchor) return null;
    const rawMsg = t(battle.wingmanChat.textKey as Parameters<typeof t>[0]);
    const text = formatSpeechBubbleText(
      unit.name,
      rawMsg,
      SPEECH_BUBBLE_MAX_CHARS
    );
    return {
      id: battle.wingmanChat.id,
      text,
      fullText: `${unit.name}: ${rawMsg}`,
      leftPct: anchor.leftPct,
      topPct: anchor.topPct,
    };
  }, [
    speechBubblesEnabled,
    battle.wingmanChat,
    battle.units,
    visibleBubbleId,
    posMap,
    vw,
    vh,
    t,
  ]);

  const getRowLabel = (row: CombatRow) =>
    row === 'front'
      ? t('common.frontRow')
      : row === 'middle'
      ? t('common.middleRow')
      : t('common.backRow');

  const rowBuffParts = useMemo<Record<CombatRow, string[]>>(
    () => ({
      front: getRadarLaneBuffParts(lang, formationConfig, 'front'),
      middle: getRadarLaneBuffParts(lang, formationConfig, 'middle'),
      back: getRadarLaneBuffParts(lang, formationConfig, 'back'),
    }),
    [lang, formationConfig]
  );

  const autoBadgeText = t('auto.badge');
  const sizeClass = useMemo(
    () => getBattleSizeClass(battle.units),
    [battle.units]
  );

  return (
    <div
      ref={containerRef}
      data-testid="battle-radar-container"
      data-size-class={sizeClass}
      data-animations-skipped={animationsSkipped ? 'true' : 'false'}
      data-reduced-motion={resolvedReducedMotion ? 'true' : 'false'}
      style={{ touchAction: 'pan-y' }}
      className={
        layoutMode === 'phone-portrait'
          ? 'relative w-full aspect-[380/500] flex items-center justify-center rounded-lg border border-slate-800/90 bg-[#050A12] select-none touch-pan-y'
          : 'relative flex-1 min-w-0 w-full min-h-[420px] aspect-[12/7] flex items-center justify-center overflow-hidden rounded-lg border border-slate-800/90 bg-[#050A12] select-none touch-pan-y'
      }
    >
      {/* Main Tactical 3-Row Radar SVG — static geometry only (zero animated SVG transforms) */}
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ touchAction: 'pan-y' }}
        className="w-full h-full touch-pan-y"
        role="img"
        aria-label={t('battle.viewRadar')}
      >
        <defs>
          <radialGradient id="radarBgGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0f2538" stopOpacity="0.6" />
            <stop offset="55%" stopColor="#07111d" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#04080f" stopOpacity="1" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={vw} height={vh} fill="url(#radarBgGlow)" />

        {STAR_DOTS.map((st, idx) => (
          <circle
            key={idx}
            cx={(st.x / 100) * vw}
            cy={(st.y / 100) * vh}
            r={st.r}
            fill="#bae6fd"
            opacity="0.3"
          />
        ))}

        {[0.34, 0.66, 0.96].map((scale, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={Math.min(vw, vh) * 0.46 * scale}
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.08"
            strokeWidth="1"
            strokeDasharray={i === 1 ? '4 5' : undefined}
          />
        ))}

        {/* 3-ROW LANE BANDS — one muted 20px header line (lane name + buff) */}
        {lanes.map((lane) => {
          const exposure: RowExposureState =
            lane.side === 'enemy'
              ? enemyExposure[lane.row]
              : allyExposure[lane.row];
          const isEnemySide = lane.side === 'enemy';
          const isExposed = exposure === 'exposed';
          const isProtected = exposure === 'protected';
          const isPhoneCollapsed = Boolean(lane.isEmptyCollapsed);

          const fillColor = isExposed
            ? isEnemySide
              ? 'rgba(239, 68, 68, 0.11)'
              : 'rgba(56, 189, 248, 0.11)'
            : isProtected
            ? 'rgba(15, 23, 42, 0.62)'
            : 'rgba(15, 23, 42, 0.24)';

          const strokeColor = isExposed
            ? isEnemySide
              ? 'rgba(248, 113, 113, 0.6)'
              : 'rgba(56, 189, 248, 0.6)'
            : isProtected
            ? 'rgba(148, 163, 184, 0.42)'
            : 'rgba(51, 65, 85, 0.28)';

          const rowLabel = getRowLabel(lane.row);
          const buffParts = rowBuffParts[lane.row];
          const fullBuffText = buffParts.join(' · ');
          const fullHeaderText = isPhoneCollapsed
            ? rowLabel
            : [rowLabel, ...(fullBuffText ? [fullBuffText] : [])].join(' · ');
          const headerText = formatRadarLaneHeaderText(
            rowLabel,
            buffParts,
            lane.w,
            isPhoneCollapsed
          );

          return (
            <g
              key={`${lane.side}-${lane.row}`}
              data-row-band={`${lane.side}-${lane.row}`}
              data-row-state={exposure}
              data-lane-collapsed={isPhoneCollapsed ? 'true' : 'false'}
            >
              <rect
                x={lane.x}
                y={lane.y}
                width={lane.w}
                height={lane.h}
                rx="6"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isExposed ? '1.6' : '1'}
                strokeDasharray={
                  isProtected || exposure === 'empty' ? '4 4' : undefined
                }
              />
              <foreignObject
                x={lane.x + 4}
                y={lane.y}
                width={Math.max(32, lane.w - 8)}
                height={PHONE_EMPTY_LANE_HEIGHT_PX}
              >
                <div
                  data-testid={`radar-lane-header-${lane.side}-${lane.row}`}
                  title={fullHeaderText}
                  style={{ height: `${PHONE_EMPTY_LANE_HEIGHT_PX}px`, lineHeight: `${PHONE_EMPTY_LANE_HEIGHT_PX}px` }}
                  className={`w-full h-[20px] leading-[20px] px-1 flex items-center text-[10px] font-mono-nums truncate ${
                    isLandscape ? 'justify-center text-center' : 'justify-start text-left'
                  } ${
                    isPhoneCollapsed
                      ? 'text-slate-500/85'
                      : isExposed
                      ? isEnemySide
                        ? 'text-red-300/90'
                        : 'text-sky-300/90'
                      : 'text-slate-400/85'
                  }`}
                >
                  <span className="truncate font-semibold">{headerText}</span>
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Center Frontline Divider */}
        {isLandscape ? (
          <line
            x1={cx}
            y1="46"
            x2={cx}
            y2={vh - 8}
            stroke="#f59e0b"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
        ) : (
          <line
            x1="8"
            y1={44 + (vh - 52) / 2}
            x2={vw - 8}
            y2={44 + (vh - 52) / 2}
            stroke="#f59e0b"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
        )}

        {/* MEMOIZED UNIT MARKERS (alive units only; no dead ghost markers) */}
        {battle.units.map((unit) => {
          if (!unit.alive) return null;
          const pos = posMap.get(unit.id);
          const ringMeta = unitRingMetaMap.get(unit.id);
          if (!pos || !ringMeta) return null;

          const isEnemy = unit.side === 'enemy';
          const isActive = activeUnitId === unit.id && !battle.summary;
          const isTargeted =
            (isEnemy && battle.selectedTargetId === unit.id) ||
            (!isEnemy &&
              hasSingleAllySkill &&
              battle.selectedAllyTargetId === unit.id);

          const validity = isEnemy ? enemyValidityMap.get(unit.id) : undefined;
          const isBlockedByRow = Boolean(isEnemy && validity?.blockedByRow);

          const facingAngle = isLandscape
            ? isEnemy
              ? -90
              : 90
            : isEnemy
            ? 180
            : 0;

          const hoverTooltip = `${unit.name} (${getClassName(
            lang,
            unit.classId
          )}) · ${getRowLabel(unit.row)} · HP ${unit.hp}/${
            unit.derived.maxHp
          } · SHD ${unit.shield}/${unit.derived.maxShield} · SP ${unit.sp}/${
            unit.derived.maxSp
          }${
            unit.statuses.length > 0
              ? ` · ${unit.statuses
                  .map((s) => formatStatusTooltip(s, unit))
                  .join(', ')}`
              : ''
          }`;

          return (
            <RadarUnitMarker
              key={unit.id}
              unit={unit}
              lang={lang}
              badgeLayout={statusSettings.badgeLayout}
              iconMods={iconMods}
              x={pos.x}
              y={pos.y}
              tokenRadius={ringMeta.tokenRadius}
              hitSize={hitSize}
              barW={ringMeta.barW}
              showMiniChips={ringMeta.showMiniChips}
              facingAngle={facingAngle}
              isActive={isActive}
              isTargeted={isTargeted}
              isSelected={selectedUnitId === unit.id}
              isBlockedByRow={isBlockedByRow}
              autoBattleEnabled={autoBattleEnabled}
              animationsSkipped={animationsSkipped}
              hoverTooltip={hoverTooltip}
              autoBadgeText={autoBadgeText}
              formatStatusTooltip={formatStatusTooltip}
              onMarkerRef={registerMarkerRef}
              onHoverUnit={setHoveredTargetId}
              onTap={handleTokenTap}
              onLongPressStart={handleLongPressStart}
              onLongPressCancel={handleLongPressCancel}
            />
          );
        })}
      </svg>

      {/* Firefox-Safe HTML Visual Effects Overlay (translate3d + opacity only; zero animated SVG transforms) */}
      <BattleVfxOverlay
        battle={battle}
        containerRef={containerRef}
        markerElementsRef={markerElementsRef}
        svgPosMap={defeatPosFallbackMap}
        vw={vw}
        vh={vh}
        battleSpeed={battleSpeed}
        vfxConfig={vfxConfig}
        playerWeaponId={playerWeaponId}
        manualAimLine={manualAimLine}
        hitFlashUnitIds={fxHitTargetIds}
        defeatFadingUnitIds={defeatFadingSet}
        rowSlides={rowSlides}
        renderedPopupCount={
          vfxConfig.showFloatingNumbers ? activeFloatingLabels.length : 0
        }
        effectsDebugEnabled={effectiveDebugEnabled}
        osReducedMotion={osReducedMotion}
        autoReducedNoticeVisible={autoReducedNoticeVisible}
      />

      {/* Collapsible Tactical Legend (closed by default, persisted in localStorage) */}
      <div
        data-testid="radar-legend-wrapper"
        className={`absolute top-1.5 right-1.5 flex flex-col items-end ${
          layoutMode === 'phone-portrait' ? 'z-20' : 'z-30'
        }`}
      >
        <button
          type="button"
          data-testid="radar-legend-toggle"
          aria-expanded={legendOpen}
          aria-controls="radar-legend-panel"
          aria-label={t('radar.legendToggle')}
          title={t('radar.legendToggle')}
          onClick={toggleLegend}
          className={
            layoutMode === 'phone-portrait'
              ? 'z-20 h-8 w-8 min-h-[32px] min-w-[32px] p-0 rounded-lg border border-slate-700/90 bg-[#08101c]/92 hover:bg-slate-800/95 text-slate-200 inline-flex items-center justify-center shadow-md cursor-pointer'
              : 'min-h-[44px] min-w-[44px] px-2.5 rounded-lg border border-slate-700/90 bg-[#08101c]/92 hover:bg-slate-800/95 text-slate-200 text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-md cursor-pointer'
          }
        >
          {legendOpen ? (
            <X className="w-4 h-4 text-slate-300 shrink-0" />
          ) : (
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
          )}
          {layoutMode !== 'phone-portrait' && (
            <span className="whitespace-nowrap">{t('radar.legendToggle')}</span>
          )}
        </button>

        {legendOpen && (
          <div
            id="radar-legend-panel"
            data-testid="radar-legend-panel"
            className="mt-1.5 w-[248px] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-700/90 bg-[#070E1A]/96 p-2.5 shadow-xl text-[12px] text-slate-200 space-y-2"
          >
            <div className="font-semibold text-slate-100 border-b border-slate-800 pb-1">
              {t('radar.legendTitle')}
            </div>

            <div className="space-y-1.5 leading-snug">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
                  <circle cx="9" cy="9" r="6.5" fill="rgba(254,240,138,0.16)" stroke="#fef08a" strokeWidth="2" />
                </svg>
                <span>{t('radar.legendActing')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
                  <circle cx="9" cy="9" r="6" fill="none" stroke="#ef4444" strokeWidth="1.6" strokeDasharray="3 2" />
                  <path d="M 4 9 H 13 M 10 6 L 13.5 9 L 10 12" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{t('radar.legendTarget')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
                  <circle cx="9" cy="9" r="7" fill="#090f1a" stroke="#fbbf24" strokeWidth="1.3" />
                  <path d="M 6.8 8.5 V 7 A 2.2 2.2 0 0 1 11.2 7 V 8.5" fill="none" stroke="#fbbf24" strokeWidth="1.2" />
                  <rect x="5.8" y="8.5" width="6.4" height="4.6" rx="1" fill="#fbbf24" />
                </svg>
                <span>{t('radar.legendLocked')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
                  <polygon points="9,2 15,5.5 15,12.5 9,16 3,12.5 3,5.5" fill="#0a1622" stroke="#22c55e" strokeWidth="1.6" />
                </svg>
                <span>{t('radar.legendAllyShape')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
                  <polygon points="9,2 16,9 9,16 2,9" fill="#140b12" stroke="#ef4444" strokeWidth="1.6" />
                </svg>
                <span>{t('radar.legendEnemyShape')}</span>
              </div>

              <div
                data-testid="radar-legend-split-ring"
                className="flex items-center gap-2 pt-0.5 border-t border-slate-800/90"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                  <circle cx="10" cy="10" r="4.6" fill="#070d17" />
                  <circle
                    data-testid="radar-legend-sp-ring"
                    cx="10"
                    cy="10"
                    r="5.2"
                    fill="none"
                    stroke="#3a2a0c"
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="5.2"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                    strokeDasharray="24.5 32.7"
                    transform="rotate(-90 10 10)"
                  />
                  <path d="M 10 17.8 A 7.8 7.8 0 0 1 10 2.2" fill="none" stroke="rgba(26,46,36,0.85)" strokeWidth="2.1" />
                  <path d="M 10 17.8 A 7.8 7.8 0 0 1 4.8 4.2" fill="none" stroke="#22c55e" strokeWidth="2.1" />
                  <path d="M 10 17.8 A 7.8 7.8 0 0 0 10 2.2" fill="none" stroke="rgba(20,44,72,0.85)" strokeWidth="2.1" />
                  <path d="M 10 17.8 A 7.8 7.8 0 0 0 16.8 6.1" fill="none" stroke="#38bdf8" strokeWidth="2.1" />
                  <line x1="10" y1="1.1" x2="10" y2="3.7" stroke="#f8fafc" strokeWidth="1" />
                  <line x1="10" y1="16.3" x2="10" y2="18.9" stroke="#f8fafc" strokeWidth="1" />
                </svg>
                <span>{t('radar.legendRings')}</span>
              </div>

              <div
                data-testid="radar-legend-low-hp"
                className="flex items-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                  <path d="M 10 17.5 A 7.5 7.5 0 0 1 10 2.5" fill="none" stroke="rgba(127,29,29,0.55)" strokeWidth="2.6" />
                  <path d="M 10 17.5 A 7.5 7.5 0 0 1 3.5 13.8" fill="none" stroke="#ef4444" strokeWidth="2.6" />
                  <path d="M 10 17.5 A 7.5 7.5 0 0 0 10 2.5" fill="none" stroke="rgba(20,44,72,0.55)" strokeWidth="2.6" />
                  <line x1="10" y1="1.2" x2="10" y2="4.2" stroke="#f8fafc" strokeWidth="1" />
                  <line x1="10" y1="15.8" x2="10" y2="18.8" stroke="#f8fafc" strokeWidth="1" />
                </svg>
                <span>{t('radar.legendLowHp')}</span>
              </div>

              <div className="space-y-1.5 pt-0.5 border-t border-slate-800/90">
                <div className="flex items-center gap-2">
                  <CatalogIcon
                    row={getCatalogRow('BF02', iconMods) ?? null}
                    size="sm"
                    badgeLayout={statusSettings.badgeLayout}
                    showBadges={false}
                  />
                  <span>{t('radar.legendBuff')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CatalogIcon
                    row={getCatalogRow('DB05', iconMods) ?? null}
                    size="sm"
                    badgeLayout={statusSettings.badgeLayout}
                    showBadges={false}
                  />
                  <span>{t('radar.legendDebuff')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CatalogIcon
                    row={getCatalogRow('BF09', iconMods) ?? null}
                    size="sm"
                    badgeLayout={statusSettings.badgeLayout}
                    stacks={2}
                    allowStack={true}
                    turnsLeft={null}
                    showArrowBadge={false}
                  />
                  <span>{t('radar.legendStack')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CatalogIcon
                    row={getCatalogRow('DT01', iconMods) ?? null}
                    size="sm"
                    badgeLayout={statusSettings.badgeLayout}
                    turnsLeft={2}
                    showArrowBadge={false}
                  />
                  <span>{t('radar.legendTurns')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5 border-t border-slate-800/90">
                <svg width="18" height="14" viewBox="0 0 18 14" className="shrink-0">
                  <rect x="1" y="2" width="16" height="10" rx="2" fill="rgba(239,68,68,0.16)" stroke="#f87171" strokeWidth="1.5" />
                </svg>
                <span>{t('radar.legendExposed')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="18" height="14" viewBox="0 0 18 14" className="shrink-0">
                  <rect x="1" y="2" width="16" height="10" rx="2" fill="rgba(15,23,42,0.65)" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
                </svg>
                <span>{t('radar.legendProtected')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="18" height="14" viewBox="0 0 18 14" className="shrink-0">
                  <rect x="1" y="2" width="16" height="10" rx="2" fill="rgba(15,23,42,0.25)" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                </svg>
                <span>{t('radar.legendEmpty')}</span>
              </div>

              <div className="text-[12px] text-slate-400 pt-0.5 border-t border-slate-800/90">
                {t('radar.legendLongRange')} · {t('radar.legendDown')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-Unit Queued Floating Labels (1 active per alive unit at a time, 18px fixed slot above ring, clipped inside radar box) */}
      {vfxConfig.showFloatingNumbers && activeFloatingLabels.length > 0 && (
        <div
          data-testid="radar-popups-layer"
          className="pointer-events-none absolute inset-0 overflow-hidden z-30"
        >
          {activeFloatingLabels.map((item) => {
            const isSmall =
              isCompactPopupTone(item.popup.tone) &&
              !isSpPopupText(item.popup.text);
            const display = parseCardPopupDisplay(item.popup, lang);
            const iconPx = isSmall
              ? 11
              : item.popup.tone === 'crit'
              ? 13
              : 12;
            const animClass = vfxConfig.reducedMotion
              ? 'anim-radar-popup-reduced'
              : 'anim-radar-popup-flight';
            return (
              <div
                key={item.popup.id}
                data-testid="damage-popup"
                data-unit-id={item.popup.unitId}
                data-slot-height="18"
                data-popup-compact={isSmall ? 'true' : 'false'}
                style={
                  {
                    left: `${item.leftPct}%`,
                    top: `${item.topPct}%`,
                    height: '18px',
                    lineHeight: '18px',
                    transformOrigin: 'center bottom',
                    transform: `translateX(-50%) scale(${radarPopupScales.finalScale})`,
                    '--radar-pop-top': `${item.topPct}%`,
                    '--radar-pop-dy': `${item.dyPct}%`,
                    '--radar-pop-start-scale': `${radarPopupScales.startScale}`,
                    '--radar-pop-end-scale': `${radarPopupScales.finalScale}`,
                    animationDuration: vfxConfig.reducedMotion
                      ? '160ms'
                      : `${radarPopupCfg.flightMs}ms`,
                  } as CSSProperties
                }
                className={`absolute h-[18px] leading-[18px] px-1.5 rounded bg-[#050a12]/90 inline-flex items-center justify-center gap-0.5 font-display font-bold tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap ${animClass} ${
                  isSmall
                    ? 'text-[11px]'
                    : item.popup.tone === 'crit'
                    ? 'text-[13px]'
                    : 'text-[12px]'
                } ${getPopupColorClass(item.popup.tone, item.popup.text)}`}
              >
                {display.arrow === 'up' && <span aria-hidden="true">↑</span>}
                {display.arrow === 'down' && <span aria-hidden="true">↓</span>}
                {display.segments.map((seg, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-0.5 ${
                      seg.colorClass ?? ''
                    }`}
                  >
                    {seg.iconKind && (
                      <span
                        data-testid="card-popup-icon"
                        data-popup-icon-kind={seg.iconKind}
                        className="material-symbols-outlined leading-none select-none shrink-0"
                        style={{ fontSize: `${iconPx}px` }}
                        aria-hidden="true"
                      >
                        {getCardPopupSymbol(seg.iconKind, iconMods)}
                      </span>
                    )}
                    <span>{seg.text}</span>
                    {seg.trailingIconKind && (
                      <span
                        data-testid="card-popup-icon"
                        data-popup-icon-kind={seg.trailingIconKind}
                        data-popup-icon-role="trailing"
                        className={`material-symbols-outlined leading-none select-none shrink-0 ${
                          seg.trailingColorClass ?? ''
                        }`}
                        style={{
                          fontSize: `${
                            seg.trailingSmall ? Math.max(9, iconPx - 2) : iconPx
                          }px`,
                        }}
                        aria-hidden="true"
                      >
                        {getCardPopupSymbol(seg.trailingIconKind, iconMods)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Compact Single-Line Unit Speech Bubble (<= 28 chars, collision-avoiding, 1.5s auto-hide, toggleable) */}
      {activeBubble && (
        <div
          data-testid="radar-speech-bubble"
          title={activeBubble.fullText}
          style={{
            left: `${activeBubble.leftPct}%`,
            top: `${activeBubble.topPct}%`,
          }}
          className="pointer-events-none absolute z-30 -translate-x-1/2 max-w-[205px] rounded-md border border-sky-400/65 bg-[#071322]/94 px-2 py-0.5 shadow-md flex items-center gap-1 whitespace-nowrap"
        >
          <Radio className="w-3 h-3 text-sky-400 shrink-0" aria-hidden="true" />
          <span
            data-testid="radar-speech-bubble-text"
            className="text-[12px] leading-tight font-medium text-sky-100 truncate"
          >
            {activeBubble.text}
          </span>
        </div>
      )}
    </div>
  );
}
