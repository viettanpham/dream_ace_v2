import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HelpCircle, Radio, X } from 'lucide-react';
import { getCatalogRow } from '../data/iconCatalog';
import {
  getCatalogRowForStatus,
  getStatusVisualKind,
  sortStatusEffects,
} from '../data/statusIconMap';
import { getTeamColorRole, hasStatus } from '../engine/combat';
import {
  formatStatusEffectDetail,
  getClassName,
  getStatusShortLabel,
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
  layoutStaggeredPopups,
  layoutUnitStatusIcons,
  RADAR_STATUS_MAX_VISIBLE,
  readRadarLegendOpen,
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
  resolveEffectiveVfxConfig,
  resolveReducedMotion,
  useFxSettings,
  type BattleEffectsMode,
  type ReducedMotionSetting,
} from '../utils/battleVfx';
import { useStatusDisplaySettings } from '../utils/statusDisplayPrefs';
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
  onSelectEnemy: (unitId: string) => void;
  onSelectAlly: (unitId: string) => void;
  onInspectUnit: (unit: CombatUnit) => void;
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

function getPopupColorClass(tone: FloatingPopup['tone']): string {
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

/**
 * Builds 3 fixed-position row lanes (front/middle/back) per side.
 * Lane geometry is strictly fixed and independent of unit counts or alive/dead state
 * so rows never resize or reflow when units die or a row becomes empty.
 */
export function buildRowLanes(
  isLandscape: boolean,
  vw: number,
  vh: number,
  _units?: CombatUnit[]
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
    const centerGap = 16;
    const laneGap = 5;
    const halfW = (vw - padX * 2 - centerGap) / 2;
    const y = 8;
    const h = vh - 16;

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
        labelY: y + 13,
        labelAnchor: 'middle',
        badgeX: curX + colW / 2,
        badgeY: y + 24,
        badgeAnchor: 'middle',
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
        labelY: y + 13,
        labelAnchor: 'middle',
        badgeX: curX + colW / 2,
        badgeY: y + 24,
        badgeAnchor: 'middle',
      });
      curX += colW + laneGap;
    });

    return lanes;
  }

  // Portrait 6 fixed horizontal bands: Enemy Back -> Middle -> Front || Ally Front -> Middle -> Back
  const padX = 8;
  const padY = 8;
  const centerGap = 12;
  const laneGap = 4;
  const halfH = (vh - padY * 2 - centerGap) / 2;
  const w = vw - padX * 2;

  const enemyRows: CombatRow[] = ['back', 'middle', 'front'];
  const allyRows: CombatRow[] = ['front', 'middle', 'back'];

  const fixedWeights = [1, 1, 1];
  const enemyHeights = distribute(halfH, laneGap, fixedWeights);
  const allyHeights = distribute(halfH, laneGap, fixedWeights);

  const lanes: RowLaneRect[] = [];
  let curY = padY;
  enemyRows.forEach((row, i) => {
    const rowH = enemyHeights[i];
    lanes.push({
      side: 'enemy',
      row,
      x: padX,
      y: curY,
      w,
      h: rowH,
      labelX: padX + 7,
      labelY: curY + 11,
      labelAnchor: 'start',
      badgeX: padX + w - 7,
      badgeY: curY + 11,
      badgeAnchor: 'end',
    });
    curY += rowH + laneGap;
  });

  curY = padY + halfH + centerGap;
  allyRows.forEach((row, i) => {
    const rowH = allyHeights[i];
    lanes.push({
      side: 'ally',
      row,
      x: padX,
      y: curY,
      w,
      h: rowH,
      labelX: padX + 7,
      labelY: curY + 11,
      labelAnchor: 'start',
      badgeX: padX + w - 7,
      badgeY: curY + 11,
      badgeAnchor: 'end',
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
    const rowUnits = units
      .filter((u) => u.side === lane.side && u.row === lane.row)
      .sort(
        (a, b) =>
          (a.formationCol ?? 0) - (b.formationCol ?? 0) ||
          a.id.localeCompare(b.id)
      );

    const count = rowUnits.length;
    if (count === 0) continue;

    rowUnits.forEach((unit, idx) => {
      const frac = (idx + 0.5) / count;
      if (isLandscape) {
        const topSafe = lane.y + 34;
        const bottomSafe = lane.y + lane.h - 26;
        const x = lane.x + lane.w / 2;
        const y = topSafe + frac * Math.max(20, bottomSafe - topSafe);
        map.set(unit.id, { x, y });
      } else {
        const leftSafe = lane.x + 32;
        const rightSafe = lane.x + lane.w - 32;
        const x = leftSafe + frac * Math.max(20, rightSafe - leftSafe);
        const y = lane.y + lane.h * 0.54;
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
  facingAngle: number;
  isActive: boolean;
  isTargeted: boolean;
  isBlockedByRow: boolean;
  autoBattleEnabled: boolean;
  animationsSkipped: boolean;
  hoverTooltip: string;
  autoBadgeText: string;
  showStatusLabels: boolean;
  formatStatusShortText: (st: ActiveStatusEffect) => string;
  formatStatusTooltip: (st: ActiveStatusEffect, unit?: CombatUnit) => string;
  onMarkerRef: (unitId: string, el: SVGGElement | null) => void;
  onHoverUnit: (unitId: string | null) => void;
  onInspectStatus: (unit: CombatUnit, st: ActiveStatusEffect) => void;
  onHoverStatus?: (unit: CombatUnit, st: ActiveStatusEffect | null) => void;
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
  facingAngle,
  isActive,
  isTargeted,
  isBlockedByRow,
  autoBattleEnabled,
  animationsSkipped,
  hoverTooltip,
  autoBadgeText,
  showStatusLabels,
  formatStatusShortText,
  formatStatusTooltip,
  onMarkerRef,
  onHoverUnit,
  onInspectStatus,
  onHoverStatus,
  onTap,
  onLongPressStart,
  onLongPressCancel,
}: RadarUnitMarkerProps) {
  const isEnemy = unit.side === 'enemy';
  const role = getTeamColorRole(unit);
  const teamHex = unit.alive ? getTeamHex(role) : '#475569';
  const shape = getMarkerShape(unit);
  const isStealthed = unit.alive && hasStatus(unit, 'stealth');

  const shortName = formatShortUnitName(unit.name, 10);

  // Down units draw smaller & dimmer so they do not clutter active lanes
  const visualRadius = unit.alive
    ? tokenRadius
    : Math.max(9, Math.round(tokenRadius * 0.52));

  // Concentric 3-ring arcs (Shield outer blue, HP middle green, SP inner purple) or HP-only below min size
  const ringResult = computeUnitRingArcs(unit, visualRadius);
  const shapeRadius = unit.alive ? ringResult.innerShapeRadius : visualRadius;
  const ringOuterRadius = unit.alive ? ringResult.outerRadius : visualRadius;

  const sortedStatuses = unit.alive
    ? sortStatusEffects(unit.statuses, iconMods)
    : [];
  const statusLayout = unit.alive
    ? layoutUnitStatusIcons(sortedStatuses, RADAR_STATUS_MAX_VISIBLE)
    : { visible: [] as ActiveStatusEffect[], overflowCount: 0 };

  const markerOpacity = !unit.alive
    ? 0.26
    : isStealthed
    ? 0.55
    : isBlockedByRow
    ? 0.56
    : 1;

  const iconScale = Math.max(0.74, Math.min(1.15, shapeRadius / 16));
  const hexOuter = getPolygonPoints(6, shapeRadius, -90);
  const hexInner = getPolygonPoints(6, Math.max(5, shapeRadius - 2.6), -90);
  const diamondOuter = getDiamondPoints(shapeRadius);
  const diamondInner = getDiamondPoints(Math.max(5, shapeRadius - 2.8));
  const fortressOuter = getFortressPoints(shapeRadius);
  const fortressInner = getFortressPoints(Math.max(5, shapeRadius - 2.8));

  // Status row horizontal centering under the name plate
  const statusStep = 21;
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
      data-ring-mode={
        !unit.alive
          ? 'none'
          : ringResult.hpOnlyMode
          ? 'hp-only'
          : 'three-rings'
      }
      data-low-hp={ringResult.isLowHp ? 'true' : 'false'}
      data-acting={isActive ? 'true' : 'false'}
      data-targeted={isTargeted ? 'true' : 'false'}
      data-blocked-by-row={isBlockedByRow ? 'true' : 'false'}
      data-unit-down={!unit.alive ? 'true' : 'false'}
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

          {/* 3 Concentric Ring Arcs (Shield outer blue, HP middle green/orange-red, SP inner purple) */}
          {unit.alive && (
            <g data-testid={`radar-rings-${unit.id}`}>
              {ringResult.arcs.map((arc) => (
                <g key={arc.kind}>
                  {/* Subtle full-circle track */}
                  <circle
                    cx="0"
                    cy="0"
                    r={arc.radius}
                    fill="none"
                    stroke={arc.trackColor}
                    strokeWidth={arc.strokeWidth}
                  />
                  {/* Filled arc clockwise from 12 o'clock using stroke-dasharray / stroke-dashoffset (Firefox-safe) */}
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
                    transform="rotate(-90)"
                    className={
                      arc.kind === 'hp' && arc.isLowHp && !animationsSkipped
                        ? 'vfx-low-hp-pulse'
                        : undefined
                    }
                  />
                  {/* Tiny start tick mark at top 12 o'clock for color-blind ring order clarity */}
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
              ))}
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

          {/* AUTO Badge on Player Token */}
          {unit.isPlayer && autoBattleEnabled && unit.alive && (
            <g transform={`translate(0, ${-ringOuterRadius - 8})`}>
              <rect
                x="-15"
                y="-6"
                width="30"
                height="11"
                rx="3"
                fill="#22c55e"
              />
              <text
                x="0"
                y="2.2"
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

        {/* Under the marker: Name Plate + Status Icons Row (max 3 + "+N" overflow; no horizontal HP/Shield bars) */}
        {unit.alive ? (
          <g transform={`translate(0, ${ringOuterRadius + 4})`}>
            <rect
              x={-barW / 2 - 4}
              y="0"
              width={barW + 8}
              height="12.5"
              rx="3"
              fill="rgba(5, 10, 18, 0.9)"
            />
            <text
              data-testid="radar-unit-name"
              x="0"
              y="9.2"
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={isActive ? '#fef08a' : '#f1f5f9'}
            >
              {shortName}
            </text>

            {/* Up to 3 compact StatusChips (+N when more) with buff/debuff/normal frames & Material Symbols */}
            {statusLayout.visible.length > 0 && (
              <g
                data-testid={`radar-status-${unit.id}`}
                transform="translate(0, 22)"
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
                        onInspectStatus(unit, st);
                      }}
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        onHoverStatus?.(unit, st);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        onHoverStatus?.(unit, null);
                      }}
                      className="cursor-pointer"
                    >
                      <title>{stTip}</title>
                      <foreignObject
                        x="-14"
                        y="-13"
                        width="28"
                        height="26"
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
                      x="-8"
                      y="-7"
                      width="16"
                      height="14"
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
                {showStatusLabels && (
                  <g
                    data-testid={`radar-status-labels-${unit.id}`}
                    transform="translate(0, 15)"
                  >
                    <rect
                      x={-Math.max(24, barW / 2 + 6)}
                      y="-5.5"
                      width={Math.max(48, barW + 12)}
                      height="10.5"
                      rx="2.5"
                      fill="rgba(5, 10, 18, 0.88)"
                    />
                    <text
                      data-testid={`radar-status-label-${unit.id}`}
                      x="0"
                      y="2.3"
                      textAnchor="middle"
                      fontSize="7.2"
                      fontWeight="700"
                      fill="#cbd5e1"
                    >
                      {statusLayout.visible
                        .slice(0, 2)
                        .map((st) => formatStatusShortText(st))
                        .join(' · ')}
                      {statusLayout.visible.length > 2 ||
                      statusLayout.overflowCount > 0
                        ? ` +${
                            Math.max(0, statusLayout.visible.length - 2) +
                            statusLayout.overflowCount
                          }`
                        : ''}
                    </text>
                  </g>
                )}
              </g>
            )}
          </g>
        ) : (
          <text
            data-testid="radar-unit-name"
            x="0"
            y={visualRadius + 10}
            textAnchor="middle"
            fontSize="8"
            fontWeight="600"
            fill="#64748b"
          >
            {shortName}
          </text>
        )}
      </g>

      {/* Small Lock Icon when unit cannot be targeted because a front/middle row is alive */}
      {isBlockedByRow && unit.alive && (
        <g
          data-testid={`radar-lock-${unit.id}`}
          transform={`translate(${ringOuterRadius - 2}, ${ringOuterRadius - 3})`}
        >
          <circle
            cx="0"
            cy="0"
            r="7.5"
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
  showStatusLabels: showStatusLabelsProp,
  playerWeaponId = null,
  layoutMode: layoutModeProp,
  onSelectEnemy,
  onSelectAlly,
  onInspectUnit,
}: BattleRadarViewProps) {
  const { lang, t } = useI18n();
  const adminStatusDefaults = useGameStore(
    (s) => s.adminConfig.statusDisplayDefaults
  );
  const iconMods = useGameStore((s) => s.adminConfig.iconCatalogMods);
  const { settings: statusSettings } =
    useStatusDisplaySettings(adminStatusDefaults);
  const detectedMode = useBattleLayoutMode();
  const [fxSettings] = useFxSettings();
  const osReducedMotion = usePrefersReducedMotion();
  const effectiveEffectsMode = effectsModeProp ?? fxSettings.effectsMode;
  const effectiveReducedMotionMode =
    reducedMotionModeProp ?? fxSettings.reducedMotionMode;
  const effectiveDebugEnabled = effectsDebugProp ?? fxSettings.effectsDebug;
  const effectiveShowStatusLabels =
    showStatusLabelsProp ?? fxSettings.showStatusLabels;
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
  const [invalidToast, setInvalidToast] = useState<string | null>(null);
  const [inspectedStatusInfo, setInspectedStatusInfo] = useState<{
    unit: CombatUnit;
    status: ActiveStatusEffect;
    unitName: string;
    detailText: string;
    isDebuff: boolean;
    source: 'tap' | 'hover';
  } | null>(null);
  const [fadingDefeatIds, setFadingDefeatIds] = useState<string[]>([]);
  const [rowSlides, setRowSlides] = useState<RowSlideEffect[]>([]);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [visibleBubbleId, setVisibleBubbleId] = useState<string | null>(
    battle.wingmanChat?.id ?? null
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerElementsRef = useRef<Map<string, SVGGElement>>(new Map());
  const toastTimerRef = useRef<number | null>(null);
  const statusTooltipTimerRef = useRef<number | null>(null);
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

  const showInvalidToast = useCallback((message: string) => {
    setInvalidToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setInvalidToast(null);
      toastTimerRef.current = null;
    }, 2200);
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

  const handleInspectStatus = useCallback(
    (unit: CombatUnit, st: ActiveStatusEffect) => {
      const row = getCatalogRowForStatus(st.type, iconMods);
      const isDebuff = getStatusVisualKind(st, row) === 'debuff';
      setInspectedStatusInfo({
        unit,
        status: st,
        unitName: formatShortUnitName(unit.name, 10),
        detailText: formatStatusTooltip(st, unit),
        isDebuff,
        source: 'tap',
      });
      if (statusTooltipTimerRef.current !== null) {
        window.clearTimeout(statusTooltipTimerRef.current);
      }
      statusTooltipTimerRef.current = window.setTimeout(() => {
        setInspectedStatusInfo(null);
        statusTooltipTimerRef.current = null;
      }, 3200);
    },
    [formatStatusTooltip, iconMods]
  );

  const handleHoverStatus = useCallback(
    (unit: CombatUnit, st: ActiveStatusEffect | null) => {
      if (!st) {
        setInspectedStatusInfo((cur) =>
          cur && cur.source === 'hover' ? null : cur
        );
        return;
      }
      if (statusTooltipTimerRef.current !== null) {
        window.clearTimeout(statusTooltipTimerRef.current);
        statusTooltipTimerRef.current = null;
      }
      const row = getCatalogRowForStatus(st.type, iconMods);
      const isDebuff = getStatusVisualKind(st, row) === 'debuff';
      setInspectedStatusInfo({
        unit,
        status: st,
        unitName: formatShortUnitName(unit.name, 10),
        detailText: formatStatusTooltip(st, unit),
        isDebuff,
        source: 'hover',
      });
    },
    [formatStatusTooltip, iconMods]
  );

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
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (statusTooltipTimerRef.current !== null) {
        window.clearTimeout(statusTooltipTimerRef.current);
      }
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
    () => buildRowLanes(isLandscape, vw, vh),
    [isLandscape, vw, vh]
  );

  const posMap = useMemo(
    () => computeUnitPositions(battle.units, lanes, isLandscape),
    [battle.units, lanes, isLandscape]
  );

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

  // Adaptive unit marker scaling: larger in 4v4 so units fill the field, clean fit in 8v8
  const maxUnitsInRow = useMemo(() => {
    const counts = new Map<string, number>();
    let max = 1;
    for (const u of battle.units) {
      const key = `${u.side}:${u.row}`;
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      if (next > max) max = next;
    }
    return max;
  }, [battle.units]);

  const tokenRadius = isLandscape
    ? maxUnitsInRow <= 2 && battle.squadSize <= 4
      ? 26
      : maxUnitsInRow <= 3
      ? 22
      : 19
    : maxUnitsInRow <= 2 && battle.squadSize <= 4
    ? 22
    : maxUnitsInRow <= 3
    ? 18
    : 16;

  const hitSize = getRadarHitAreaSize(isLandscape);
  const barW = isLandscape ? (tokenRadius >= 24 ? 62 : 56) : 52;

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

  // All floating text (damage + buff/status like "WPN +30%") shares the same max-6 stagger queue
  const staggeredPopups = useMemo(
    () =>
      layoutStaggeredPopups(battle.popups, posMap, vw, vh, {
        maxVisible: 6,
        verticalStepPct: 6.2,
        staggerDelayMs: 110,
        durationMs: 800,
        baseOffsetYPct: 8,
      }),
    [battle.popups, posMap, vw, vh]
  );

  const getInvalidReasonMessage = useCallback(
    (reason: TargetInvalidReason | null): string => {
      switch (reason) {
        case 'front_row_alive':
          return t('radar.invalidFrontAlive');
        case 'middle_row_alive':
          return t('radar.invalidMiddleAlive');
        case 'stealthed':
          return t('radar.invalidStealthed');
        case 'unit_down':
          return t('radar.invalidDown');
        default:
          return t('radar.invalidFrontAlive');
      }
    },
    [t]
  );

  const interactionRef = useRef({
    battle,
    canPlayerManualAct,
    hasSingleAllySkill,
    enemyValidityMap,
    onSelectEnemy,
    onSelectAlly,
    onInspectUnit,
    showInvalidToast,
    getInvalidReasonMessage,
  });
  interactionRef.current = {
    battle,
    canPlayerManualAct,
    hasSingleAllySkill,
    enemyValidityMap,
    onSelectEnemy,
    onSelectAlly,
    onInspectUnit,
    showInvalidToast,
    getInvalidReasonMessage,
  };

  const handleTokenTap = useCallback((unitId: string) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    const ctx = interactionRef.current;
    const unit = ctx.battle.units.find((u) => u.id === unitId);
    if (!unit) return;

    const isEnemy = unit.side === 'enemy';
    const isEnemySelected = ctx.battle.selectedTargetId === unit.id;
    const isAllySelected = ctx.battle.selectedAllyTargetId === unit.id;

    if (!unit.alive) {
      if (ctx.canPlayerManualAct) {
        ctx.showInvalidToast(ctx.getInvalidReasonMessage('unit_down'));
      }
      return;
    }

    if (isEnemy && ctx.canPlayerManualAct) {
      const validity = ctx.enemyValidityMap.get(unit.id);
      if (validity && !validity.valid) {
        ctx.showInvalidToast(ctx.getInvalidReasonMessage(validity.reason));
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

  const getExposureLabel = (state: RowExposureState) =>
    state === 'exposed'
      ? t('battle.rowExposed')
      : state === 'protected'
      ? t('battle.rowProtected')
      : t('battle.rowEmpty');

  const autoBadgeText = t('auto.badge');

  return (
    <div
      ref={containerRef}
      data-testid="battle-radar-container"
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

        {/* 3-ROW CONTENT-FIT LANE BANDS (smaller Exposed/Protected labels) */}
        {lanes.map((lane) => {
          const exposure =
            lane.side === 'enemy'
              ? enemyExposure[lane.row]
              : allyExposure[lane.row];
          const isEnemySide = lane.side === 'enemy';
          const isExposed = exposure === 'exposed';
          const isProtected = exposure === 'protected';

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

          const labelFill = isExposed
            ? isEnemySide
              ? '#fca5a5'
              : '#7dd3fc'
            : '#94a3b8';

          const badgeFill = isExposed
            ? isEnemySide
              ? '#f87171'
              : '#38bdf8'
            : isProtected
            ? '#fbbf24'
            : '#64748b';

          return (
            <g
              key={`${lane.side}-${lane.row}`}
              data-row-band={`${lane.side}-${lane.row}`}
              data-row-state={exposure}
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
              <text
                x={lane.labelX}
                y={lane.labelY}
                textAnchor={lane.labelAnchor}
                fontSize={isLandscape ? '9' : '8.5'}
                fontFamily="monospace"
                fontWeight="700"
                fill={labelFill}
              >
                {getRowLabel(lane.row)}
              </text>
              <text
                x={lane.badgeX}
                y={lane.badgeY}
                textAnchor={lane.badgeAnchor}
                fontSize={isLandscape ? '8' : '7.5'}
                fontFamily="monospace"
                fontWeight="700"
                fill={badgeFill}
              >
                {getExposureLabel(exposure)}
              </text>
            </g>
          );
        })}

        {/* Center Frontline Divider */}
        {isLandscape ? (
          <line
            x1={cx}
            y1="8"
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
            y1={cy}
            x2={vw - 8}
            y2={cy}
            stroke="#f59e0b"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
        )}

        {/* MEMOIZED UNIT MARKERS */}
        {battle.units.map((unit) => {
          const pos = posMap.get(unit.id);
          if (!pos) return null;

          const isEnemy = unit.side === 'enemy';
          const isActive = activeUnitId === unit.id && !battle.summary;
          const isTargeted =
            unit.alive &&
            ((isEnemy && battle.selectedTargetId === unit.id) ||
              (!isEnemy &&
                hasSingleAllySkill &&
                battle.selectedAllyTargetId === unit.id));

          const validity = isEnemy ? enemyValidityMap.get(unit.id) : undefined;
          const isBlockedByRow = Boolean(
            unit.alive && isEnemy && validity?.blockedByRow
          );

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
              tokenRadius={tokenRadius}
              hitSize={hitSize}
              barW={barW}
              facingAngle={facingAngle}
              isActive={isActive}
              isTargeted={isTargeted}
              isBlockedByRow={isBlockedByRow}
              autoBattleEnabled={autoBattleEnabled}
              animationsSkipped={animationsSkipped}
              hoverTooltip={hoverTooltip}
              autoBadgeText={autoBadgeText}
              showStatusLabels={effectiveShowStatusLabels}
              formatStatusShortText={(st) => getStatusShortLabel(lang, st.type)}
              formatStatusTooltip={formatStatusTooltip}
              onMarkerRef={registerMarkerRef}
              onHoverUnit={setHoveredTargetId}
              onInspectStatus={handleInspectStatus}
              onHoverStatus={handleHoverStatus}
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
        svgPosMap={posMap}
        vw={vw}
        vh={vh}
        battleSpeed={battleSpeed}
        vfxConfig={vfxConfig}
        playerWeaponId={playerWeaponId}
        manualAimLine={manualAimLine}
        hitFlashUnitIds={fxHitTargetIds}
        defeatFadingUnitIds={defeatFadingSet}
        rowSlides={rowSlides}
        renderedPopupCount={vfxConfig.showFloatingNumbers ? staggeredPopups.length : 0}
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

              <div className="flex items-center gap-2 pt-0.5 border-t border-slate-800/90">
                <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                  <circle cx="10" cy="10" r="8.2" fill="none" stroke="#38bdf8" strokeWidth="1.6" strokeDasharray="38 52" transform="rotate(-90 10 10)" />
                  <circle cx="10" cy="10" r="5.8" fill="none" stroke="#22c55e" strokeWidth="1.6" strokeDasharray="28 37" transform="rotate(-90 10 10)" />
                  <circle cx="10" cy="10" r="3.4" fill="none" stroke="#c084fc" strokeWidth="1.6" strokeDasharray="16 22" transform="rotate(-90 10 10)" />
                  <line x1="10" y1="0.8" x2="10" y2="7.5" stroke="#f8fafc" strokeWidth="0.9" />
                </svg>
                <span>{t('radar.legendRings')}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                  <circle cx="10" cy="10" r="6.5" fill="none" stroke="rgba(249,115,22,0.28)" strokeWidth="2.2" />
                  <circle cx="10" cy="10" r="6.5" fill="none" stroke="#f97316" strokeWidth="2.2" strokeDasharray="10 41" transform="rotate(-90 10 10)" />
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

      {/* Status Icon Tap & Hover Tooltip (uses shared StatusChip + unit name + exact effect detail) */}
      {inspectedStatusInfo && (
        <div
          role="status"
          aria-live="polite"
          data-testid="radar-status-tooltip"
          onClick={() => setInspectedStatusInfo(null)}
          className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 max-w-[92%] rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold font-mono-nums shadow-lg inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            inspectedStatusInfo.isDebuff
              ? 'border-red-500/70 bg-[#1a0a0d]/95 text-red-100'
              : 'border-emerald-500/70 bg-[#071a10]/95 text-emerald-100'
          }`}
        >
          <StatusChip
            status={inspectedStatusInfo.status}
            lang={lang}
            unit={inspectedStatusInfo.unit}
            badgeLayout={statusSettings.badgeLayout}
            iconMods={iconMods}
            size="sm"
            showLabel={true}
            allowStack={false}
            stacks={1}
          />
          <span className="truncate">
            {inspectedStatusInfo.unitName}: {inspectedStatusInfo.detailText}
          </span>
        </div>
      )}

      {/* Invalid Target Reason One-Line Toast (non-blocking) */}
      {invalidToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="radar-invalid-target-toast"
          className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 max-w-[92%] rounded-lg border border-amber-400/70 bg-[#120e08]/95 px-3 py-1.5 text-[13px] font-semibold text-amber-200 shadow-lg whitespace-nowrap truncate"
        >
          {invalidToast}
        </div>
      )}

      {/* Staggered Floating Popups (max 6 simultaneous; kept when Effects=Off, skipped on reduced motion) */}
      {vfxConfig.showFloatingNumbers && staggeredPopups.length > 0 && (
        <div
          data-testid="radar-popups-layer"
          className="pointer-events-none absolute inset-0 overflow-hidden z-30"
        >
          {staggeredPopups.map((item) => {
            const isSmall = isCompactPopupTone(item.popup.tone);
            return (
              <div
                key={item.popup.id}
                data-testid="damage-popup"
                data-popup-compact={isSmall ? 'true' : 'false'}
                style={{
                  left: `${item.leftPct}%`,
                  top: `${item.topPct}%`,
                  animationDelay: `${item.delayMs}ms`,
                  animationDuration: `${item.durationMs}ms`,
                }}
                className={`absolute font-display font-bold tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap ${
                  isSmall
                    ? 'text-[12px] px-1 rounded bg-[#050a12]/80 anim-popup-tight'
                    : item.popup.tone === 'crit'
                    ? 'text-[17px] anim-popup'
                    : 'text-[15px] anim-popup'
                } ${getPopupColorClass(item.popup.tone)}`}
              >
                {item.popup.text}
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
