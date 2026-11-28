import type { CombatUnit } from '../types/game';

export type BattleSizeClass = 'small' | 'medium' | 'large';

export const RADAR_SIZE_THRESHOLDS = {
  smallMax: 8,
  mediumMax: 20,
} as const;

export const DESKTOP_RADAR_HEADER_HEIGHT_PX = 20;
export const DESKTOP_RADAR_TOP_MARGIN_PX = 8;
export const DESKTOP_RADAR_TOP_OFFSET_PX =
  DESKTOP_RADAR_HEADER_HEIGHT_PX + DESKTOP_RADAR_TOP_MARGIN_PX; // 28
export const DESKTOP_RADAR_DEFAULT_RADIUS = 41;
export const RADAR_FIT_MIN_RADIUS = 14;
export const RADAR_FIT_N3_MIN_RADIUS = 17;
export const RADAR_FIT_CROWDED_MAX_RADIUS = 22;

export interface DesktopLaneFitResult {
  radius: number;
  subColumns: 1 | 2;
  perColumnCount: number;
  showMiniChips: boolean;
}

/**
 * Classifies battle size from the LARGER side count (alive + dead) so
 * the battle's size class never shifts mid-combat as units fall.
 */
export function getBattleSizeClass(
  units: ReadonlyArray<Pick<CombatUnit, 'side'>>
): BattleSizeClass {
  let allyCount = 0;
  let enemyCount = 0;
  for (const unit of units) {
    if (unit.side === 'ally') allyCount += 1;
    else if (unit.side === 'enemy') enemyCount += 1;
  }
  const maxSide = Math.max(allyCount, enemyCount);
  if (maxSide <= RADAR_SIZE_THRESHOLDS.smallMax) return 'small';
  if (maxSide <= RADAR_SIZE_THRESHOLDS.mediumMax) return 'medium';
  return 'large';
}

export function shouldShowRadarMiniChips(countInLane: number): boolean {
  return countInLane < 4;
}

/**
 * Mirrors computeUnitRingArcs(...).outerRadius for layout bounds checks.
 */
export function estimateRadarRingOuterRadius(markerRadius: number): number {
  const safe = Math.max(8, markerRadius);
  if (safe < 17) {
    const innerShapeRadius = Math.max(8, safe - 3);
    const hpR = innerShapeRadius + 3;
    return Number((hpR + 1.5).toFixed(2));
  }
  return Number((Math.max(10, Math.round(safe * 0.68)) + 12).toFixed(2));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeDesktopLaneFit(
  laneHeight: number,
  countInLane: number
): DesktopLaneFitResult {
  const n = Math.max(1, countInLane);
  if (n <= 2) {
    return {
      radius: DESKTOP_RADAR_DEFAULT_RADIUS,
      subColumns: 1,
      perColumnCount: n,
      showMiniChips: true,
    };
  }

  const usable = Math.max(40, laneHeight - DESKTOP_RADAR_TOP_OFFSET_PX);
  if (n === 3) {
    const raw = Math.floor((usable / 3 - 51) / 2);
    return {
      radius: clampInt(raw, RADAR_FIT_N3_MIN_RADIUS, DESKTOP_RADAR_DEFAULT_RADIUS),
      subColumns: 1,
      perColumnCount: 3,
      showMiniChips: true,
    };
  }

  const singleRaw = Math.floor((usable / n - 16) / 2);
  if (singleRaw >= RADAR_FIT_MIN_RADIUS) {
    return {
      radius: clampInt(
        singleRaw,
        RADAR_FIT_MIN_RADIUS,
        RADAR_FIT_CROWDED_MAX_RADIUS
      ),
      subColumns: 1,
      perColumnCount: n,
      showMiniChips: false,
    };
  }

  const perColumnCount = Math.ceil(n / 2);
  const colRaw = Math.floor((usable / perColumnCount - 16) / 2);
  return {
    radius: clampInt(colRaw, RADAR_FIT_MIN_RADIUS, RADAR_FIT_CROWDED_MAX_RADIUS),
    subColumns: 2,
    perColumnCount,
    showMiniChips: false,
  };
}

export function computeDesktopSlotPosition(
  lane: { x: number; y: number; w: number; h: number },
  idx: number,
  countInLane: number,
  fit?: DesktopLaneFitResult
): { x: number; y: number } {
  if (countInLane <= 2) {
    const topSafe = lane.y + 90;
    const bottomSafe = lane.y + lane.h - 78;
    const frac = countInLane === 1 ? 0.45 : idx / (countInLane - 1);
    return {
      x: lane.x + lane.w / 2,
      y: topSafe + frac * Math.max(20, bottomSafe - topSafe),
    };
  }

  const resolvedFit = fit ?? computeDesktopLaneFit(lane.h, countInLane);
  const perCol = resolvedFit.perColumnCount;
  const colIdx = resolvedFit.subColumns === 2 ? Math.floor(idx / perCol) : 0;
  const rowIdx = idx - colIdx * perCol;
  const colCount =
    resolvedFit.subColumns === 2
      ? colIdx === 0
        ? perCol
        : Math.max(1, countInLane - perCol)
      : countInLane;

  const x =
    resolvedFit.subColumns === 2
      ? lane.x + lane.w * (colIdx === 0 ? 0.25 : 0.75)
      : lane.x + lane.w / 2;

  const usable = Math.max(40, lane.h - DESKTOP_RADAR_TOP_OFFSET_PX);
  const slotH = usable / perCol;
  const formulaY =
    lane.y +
    DESKTOP_RADAR_TOP_OFFSET_PX +
    rowIdx * slotH +
    resolvedFit.radius +
    2;

  const ringOuter = estimateRadarRingOuterRadius(resolvedFit.radius);
  const belowCenter = ringOuter + (resolvedFit.showMiniChips ? 39 : 16);
  const minCenter = lane.y + DESKTOP_RADAR_HEADER_HEIGHT_PX + ringOuter + 1;
  const maxCenter = lane.y + lane.h - belowCenter;
  const lastFormulaY =
    lane.y +
    DESKTOP_RADAR_TOP_OFFSET_PX +
    (colCount - 1) * slotH +
    resolvedFit.radius +
    2;

  if (lastFormulaY <= maxCenter && formulaY >= minCenter) {
    return { x, y: formulaY };
  }

  if (colCount <= 1 || maxCenter <= minCenter) {
    return {
      x,
      y: Math.max(minCenter, Math.min(maxCenter, formulaY)),
    };
  }

  return {
    x,
    y: minCenter + (rowIdx / (colCount - 1)) * (maxCenter - minCenter),
  };
}

export function computePhoneFitRadius(
  baseOrGrownRadius: number,
  laneHeight: number,
  countInLane: number
): number {
  if (countInLane <= 2) {
    return baseOrGrownRadius;
  }

  const showChips = shouldShowRadarMiniChips(countInLane);
  const bodyH = Math.max(24, laneHeight - DESKTOP_RADAR_HEADER_HEIGHT_PX);
  const yRel = DESKTOP_RADAR_HEADER_HEIGHT_PX + bodyH * 0.44;
  const extraBelowRing = showChips ? 39 : 16;
  const maxBottom = laneHeight - 2;

  let r = baseOrGrownRadius;
  while (
    r > RADAR_FIT_MIN_RADIUS &&
    yRel + estimateRadarRingOuterRadius(r) + extraBelowRing > maxBottom
  ) {
    r -= 1;
  }
  return r;
}
