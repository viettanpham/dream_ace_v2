export const DEFAULT_RADAR_POPUP_START_SCALE_PCT = 60;
export const DEFAULT_RADAR_POPUP_SMALL_SCALE_PCT = 125;
export const DEFAULT_RADAR_POPUP_LARGE_SCALE_PCT = 100;
export const DEFAULT_RADAR_POPUP_BIG_MAX_UNITS = 8;

export const RADAR_POPUP_SCALE_MIN_PCT = 20;
export const RADAR_POPUP_SCALE_MAX_PCT = 300;
export const RADAR_POPUP_DEFAULT_FLIGHT_MS = 200;

export interface RadarPopupConfig {
  startScalePct: number;
  smallScalePct: number;
  largeScalePct: number;
  bigMaxUnits: number;
  flightMs: number;
}

function sanitizeScalePct(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.min(
    RADAR_POPUP_SCALE_MAX_PCT,
    Math.max(RADAR_POPUP_SCALE_MIN_PCT, Math.round(raw))
  );
}

export function sanitizeRadarPopupStartScalePct(raw?: unknown): number {
  return sanitizeScalePct(raw, DEFAULT_RADAR_POPUP_START_SCALE_PCT);
}

export function sanitizeRadarPopupSmallScalePct(raw?: unknown): number {
  return sanitizeScalePct(raw, DEFAULT_RADAR_POPUP_SMALL_SCALE_PCT);
}

export function sanitizeRadarPopupLargeScalePct(raw?: unknown): number {
  return sanitizeScalePct(raw, DEFAULT_RADAR_POPUP_LARGE_SCALE_PCT);
}

export function sanitizeRadarPopupBigMaxUnits(raw?: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_RADAR_POPUP_BIG_MAX_UNITS;
  }
  return Math.max(1, Math.round(raw));
}

export function sanitizeRadarPopupFlightMs(raw?: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return RADAR_POPUP_DEFAULT_FLIGHT_MS;
  }
  return Math.max(1, Math.round(raw));
}

export function resolveRadarPopupConfig(raw?: {
  radarPopupStartScalePct?: unknown;
  radarPopupSmallScalePct?: unknown;
  radarPopupLargeScalePct?: unknown;
  radarPopupBigMaxUnits?: unknown;
  cardPopupFlightMs?: unknown;
} | null): RadarPopupConfig {
  return {
    startScalePct: sanitizeRadarPopupStartScalePct(
      raw?.radarPopupStartScalePct
    ),
    smallScalePct: sanitizeRadarPopupSmallScalePct(
      raw?.radarPopupSmallScalePct
    ),
    largeScalePct: sanitizeRadarPopupLargeScalePct(
      raw?.radarPopupLargeScalePct
    ),
    bigMaxUnits: sanitizeRadarPopupBigMaxUnits(raw?.radarPopupBigMaxUnits),
    flightMs: sanitizeRadarPopupFlightMs(raw?.cardPopupFlightMs),
  };
}

export function computeRadarPopupFinalScalePct(
  aliveUnitsCount: number,
  config: Pick<
    RadarPopupConfig,
    'smallScalePct' | 'largeScalePct' | 'bigMaxUnits'
  >
): number {
  return aliveUnitsCount <= config.bigMaxUnits
    ? config.smallScalePct
    : config.largeScalePct;
}

export function computeRadarPopupScales(
  aliveUnitsCount: number,
  config: Pick<
    RadarPopupConfig,
    'startScalePct' | 'smallScalePct' | 'largeScalePct' | 'bigMaxUnits'
  >
): {
  finalScalePct: number;
  finalScale: number;
  startScale: number;
} {
  const finalScalePct = computeRadarPopupFinalScalePct(
    aliveUnitsCount,
    config
  );
  const finalScale = Number((finalScalePct / 100).toFixed(4));
  const startScale = Number(
    ((finalScalePct * config.startScalePct) / 10000).toFixed(4)
  );
  return { finalScalePct, finalScale, startScale };
}
