import { useEffect, useState } from 'react';
import type {
  StatusBadgeLayout,
  StatusDisplayDefaults,
  StatusDisplaySettings,
} from '../types/game';

export const STATUS_DISPLAY_STORAGE_KEY = 'dreamAce.status.v1';

export const PHONE_MAX_WIDTH_PX = 640;

export type StatusChipSizeVariant = 'xs' | 'bar' | 'sm' | 'md' | 'lg';

export const STATUS_CHIP_FRAME_PX = 32;
export const STATUS_CHIP_BAR_FRAME_PX = 28;
export const STATUS_CHIP_GLYPH_PX = 20;
export const STATUS_CHIP_VALUE_FONT_PX = 13;
export const STATUS_ROW_GAP_PX = 14;
export const STATUS_CHIP_COL_GAP_PX = 6;
export const STATUS_AREA_PAD_X_PX = 8;
export const STATUS_AREA_PAD_TOP_PX = 2;

export const STATUS_CHIP_PAD_LEFT_PX = 6;
export const STATUS_CHIP_PAD_RIGHT_PX = 8;
export const STATUS_CHIP_VALUE_GAP_PX = 8;
export const STATUS_CHIP_CHAR_WIDTH_PX = 7.8;
export const STATUS_CHIP_OVERFLOW_WIDTH_PX = 38;

export const STATUS_TURNS_BADGE_COLOR = '#F5C542';
export const STATUS_TURNS_BADGE_BG = 'rgba(11, 18, 32, 0.85)';
export const STATUS_TURNS_BADGE_BORDER_COLOR = 'rgba(148, 163, 184, 0.75)';
export const STATUS_TURNS_BADGE_BORDER_PX = 1;
export const STATUS_TURNS_BADGE_FONT_PX = 11;
export const STATUS_TURNS_BADGE_CLOCK_PX = 10;
export const STATUS_TURNS_BADGE_OUTSET_PX = 4;
export const STATUS_TURNS_BADGE_HEIGHT_PX = 14;
export const STATUS_TURNS_BADGE_EST_WIDTH_PX = 24;

export const STATUS_ARROW_BADGE_PX = 14;
export const STATUS_ARROW_GLYPH_PX = 12;
export const STATUS_ARROW_BORDER_PX = 1;
export const STATUS_ARROW_BORDER_COLOR = '#0B1220';

/** Minimum safe margin (px) around chips: outset 4 + outline 1 + 1 spare */
export const STATUS_BADGE_SAFE_PX = 6;

export const STATUS_STACK_BADGE_HEIGHT_PX = 13;
export const STATUS_STACK_BADGE_EST_WIDTH_PX = 18;

export interface StatusIconSizeSpec {
  boxPx: number;
  iconFontPx: number;
  lucideSizePx: number;
  arrowBoxPx: number;
  arrowFontPx: number;
  turnsFontPx: number;
  turnsClockPx: number;
  turnsOutsetPx: number;
  stackFontPx: number;
}

export const STATUS_ICON_SIZE_SPECS: Record<
  StatusChipSizeVariant,
  StatusIconSizeSpec
> = {
  // Mini size for radar markers — kept untouched (G4a-3 owns radar marker layout)
  xs: {
    boxPx: 18,
    iconFontPx: 12,
    lucideSizePx: 12,
    arrowBoxPx: 9,
    arrowFontPx: 7,
    turnsFontPx: 8,
    turnsClockPx: 7,
    turnsOutsetPx: 0,
    stackFontPx: 8,
  },
  // Player bar strip size (28px frame, 20px glyph)
  bar: {
    boxPx: STATUS_CHIP_BAR_FRAME_PX,
    iconFontPx: STATUS_CHIP_GLYPH_PX,
    lucideSizePx: STATUS_CHIP_GLYPH_PX,
    arrowBoxPx: STATUS_ARROW_BADGE_PX,
    arrowFontPx: STATUS_ARROW_GLYPH_PX,
    turnsFontPx: STATUS_TURNS_BADGE_FONT_PX,
    turnsClockPx: STATUS_TURNS_BADGE_CLOCK_PX,
    turnsOutsetPx: STATUS_TURNS_BADGE_OUTSET_PX,
    stackFontPx: 10,
  },
  // Standard card & sidebar & legend chip size (32px frame, 20px glyph)
  sm: {
    boxPx: STATUS_CHIP_FRAME_PX,
    iconFontPx: STATUS_CHIP_GLYPH_PX,
    lucideSizePx: STATUS_CHIP_GLYPH_PX,
    arrowBoxPx: STATUS_ARROW_BADGE_PX,
    arrowFontPx: STATUS_ARROW_GLYPH_PX,
    turnsFontPx: STATUS_TURNS_BADGE_FONT_PX,
    turnsClockPx: STATUS_TURNS_BADGE_CLOCK_PX,
    turnsOutsetPx: STATUS_TURNS_BADGE_OUTSET_PX,
    stackFontPx: 10,
  },
  // Popover & detail sheet size (32px frame, 20px glyph)
  md: {
    boxPx: STATUS_CHIP_FRAME_PX,
    iconFontPx: STATUS_CHIP_GLYPH_PX,
    lucideSizePx: STATUS_CHIP_GLYPH_PX,
    arrowBoxPx: STATUS_ARROW_BADGE_PX,
    arrowFontPx: STATUS_ARROW_GLYPH_PX,
    turnsFontPx: STATUS_TURNS_BADGE_FONT_PX,
    turnsClockPx: STATUS_TURNS_BADGE_CLOCK_PX,
    turnsOutsetPx: STATUS_TURNS_BADGE_OUTSET_PX,
    stackFontPx: 10,
  },
  // Icon catalog preview ("Bảng icon") size (32px frame, 20px glyph)
  lg: {
    boxPx: STATUS_CHIP_FRAME_PX,
    iconFontPx: STATUS_CHIP_GLYPH_PX,
    lucideSizePx: STATUS_CHIP_GLYPH_PX,
    arrowBoxPx: STATUS_ARROW_BADGE_PX,
    arrowFontPx: STATUS_ARROW_GLYPH_PX,
    turnsFontPx: STATUS_TURNS_BADGE_FONT_PX,
    turnsClockPx: STATUS_TURNS_BADGE_CLOCK_PX,
    turnsOutsetPx: STATUS_TURNS_BADGE_OUTSET_PX,
    stackFontPx: 10,
  },
};

export interface StatusGeometryRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function rectsIntersect(
  a: StatusGeometryRect,
  b: StatusGeometryRect
): boolean {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

export function getStatusChipGeometry(
  size: Exclude<StatusChipSizeVariant, 'xs'>,
  badgeLayout: StatusBadgeLayout
): {
  framePx: number;
  glyphBox: StatusGeometryRect;
  turnsBadgeBox: StatusGeometryRect;
  arrowBadgeBox: StatusGeometryRect;
  stackBadgeBox: StatusGeometryRect;
} {
  const spec = STATUS_ICON_SIZE_SPECS[size];
  const framePx = spec.boxPx;
  const outset = spec.turnsOutsetPx;
  const glyphMargin = (framePx - spec.iconFontPx) / 2;
  const glyphBox: StatusGeometryRect = {
    left: glyphMargin,
    top: glyphMargin,
    right: glyphMargin + spec.iconFontPx,
    bottom: glyphMargin + spec.iconFontPx,
  };

  const makeCenteredRect = (
    cx: number,
    cy: number,
    w: number,
    h: number
  ): StatusGeometryRect => ({
    left: cx - w / 2,
    top: cy - h / 2,
    right: cx + w / 2,
    bottom: cy + h / 2,
  });

  const turnsCx = badgeLayout === 'A' ? -outset : framePx + outset;
  const turnsCy = framePx + outset;
  const arrowCx = badgeLayout === 'A' ? framePx + outset : -outset;
  const arrowCy = framePx + outset;

  return {
    framePx,
    glyphBox,
    turnsBadgeBox: makeCenteredRect(
      turnsCx,
      turnsCy,
      STATUS_TURNS_BADGE_EST_WIDTH_PX,
      STATUS_TURNS_BADGE_HEIGHT_PX
    ),
    arrowBadgeBox: makeCenteredRect(
      arrowCx,
      arrowCy,
      spec.arrowBoxPx,
      spec.arrowBoxPx
    ),
    stackBadgeBox: makeCenteredRect(
      framePx + outset,
      -outset,
      STATUS_STACK_BADGE_EST_WIDTH_PX,
      STATUS_STACK_BADGE_HEIGHT_PX
    ),
  };
}

export const BUILTIN_STATUS_DISPLAY_DEFAULTS: StatusDisplaySettings = {
  badgeLayout: 'B',
  phoneRows: 2,
  desktopRows: 3,
  playerPhoneRows: 1,
  playerDesktopRows: 1,
};

export interface StatusDisplayOverride {
  badgeLayout?: StatusBadgeLayout;
  phoneRows?: number;
  desktopRows?: number;
  playerPhoneRows?: number;
  playerDesktopRows?: number;
}

export function clampStatusAreaRows(value: unknown, fallback = 2): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(5, Math.round(num)));
}

export function clampPlayerStatusRows(value: unknown, fallback = 1): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(2, Math.round(num)));
}

export function sanitizeStatusBadgeLayout(
  value: unknown,
  fallback: StatusBadgeLayout = 'B'
): StatusBadgeLayout {
  if (value === 'A' || value === 'B') return value;
  return fallback;
}

export function sanitizeStatusDisplayDefaults(
  raw: unknown
): StatusDisplayDefaults | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const out: StatusDisplayDefaults = {};
  if (obj.badgeLayout === 'A' || obj.badgeLayout === 'B') {
    out.badgeLayout = obj.badgeLayout;
  }
  if (obj.phoneRows !== undefined && Number.isFinite(Number(obj.phoneRows))) {
    out.phoneRows = clampStatusAreaRows(
      obj.phoneRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.phoneRows
    );
  }
  if (obj.desktopRows !== undefined && Number.isFinite(Number(obj.desktopRows))) {
    out.desktopRows = clampStatusAreaRows(
      obj.desktopRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.desktopRows
    );
  }
  if (
    obj.playerPhoneRows !== undefined &&
    Number.isFinite(Number(obj.playerPhoneRows))
  ) {
    out.playerPhoneRows = clampPlayerStatusRows(
      obj.playerPhoneRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.playerPhoneRows
    );
  }
  if (
    obj.playerDesktopRows !== undefined &&
    Number.isFinite(Number(obj.playerDesktopRows))
  ) {
    out.playerDesktopRows = clampPlayerStatusRows(
      obj.playerDesktopRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.playerDesktopRows
    );
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const listeners = new Set<() => void>();

export function subscribeStatusDisplayPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitStatusDisplayChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function readStatusDisplayOverride(): StatusDisplayOverride {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STATUS_DISPLAY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return {};

    const out: StatusDisplayOverride = {};
    if (parsed.badgeLayout === 'A' || parsed.badgeLayout === 'B') {
      out.badgeLayout = parsed.badgeLayout;
    }
    if (parsed.phoneRows !== undefined && Number.isFinite(Number(parsed.phoneRows))) {
      out.phoneRows = clampStatusAreaRows(
        parsed.phoneRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.phoneRows
      );
    }
    if (
      parsed.desktopRows !== undefined &&
      Number.isFinite(Number(parsed.desktopRows))
    ) {
      out.desktopRows = clampStatusAreaRows(
        parsed.desktopRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.desktopRows
      );
    }
    if (
      parsed.playerPhoneRows !== undefined &&
      Number.isFinite(Number(parsed.playerPhoneRows))
    ) {
      out.playerPhoneRows = clampPlayerStatusRows(
        parsed.playerPhoneRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.playerPhoneRows
      );
    }
    if (
      parsed.playerDesktopRows !== undefined &&
      Number.isFinite(Number(parsed.playerDesktopRows))
    ) {
      out.playerDesktopRows = clampPlayerStatusRows(
        parsed.playerDesktopRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.playerDesktopRows
      );
    }
    return out;
  } catch {
    return {};
  }
}

export function writeStatusDisplayOverride(next: StatusDisplayOverride): void {
  if (typeof window === 'undefined') return;
  try {
    const clean: StatusDisplayOverride = {};
    if (next.badgeLayout === 'A' || next.badgeLayout === 'B') {
      clean.badgeLayout = next.badgeLayout;
    }
    if (next.phoneRows !== undefined) {
      clean.phoneRows = clampStatusAreaRows(
        next.phoneRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.phoneRows
      );
    }
    if (next.desktopRows !== undefined) {
      clean.desktopRows = clampStatusAreaRows(
        next.desktopRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.desktopRows
      );
    }
    if (next.playerPhoneRows !== undefined) {
      clean.playerPhoneRows = clampPlayerStatusRows(
        next.playerPhoneRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.playerPhoneRows
      );
    }
    if (next.playerDesktopRows !== undefined) {
      clean.playerDesktopRows = clampPlayerStatusRows(
        next.playerDesktopRows,
        BUILTIN_STATUS_DISPLAY_DEFAULTS.playerDesktopRows
      );
    }

    if (Object.keys(clean).length === 0) {
      window.localStorage.removeItem(STATUS_DISPLAY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        STATUS_DISPLAY_STORAGE_KEY,
        JSON.stringify(clean)
      );
    }
  } catch {
    // Ignore storage quota/privacy errors
  }
  emitStatusDisplayChanged();
}

export function updateStatusDisplayOverride(
  patch: Partial<StatusDisplayOverride>
): StatusDisplayOverride {
  const merged: StatusDisplayOverride = {
    ...readStatusDisplayOverride(),
    ...patch,
  };
  writeStatusDisplayOverride(merged);
  return readStatusDisplayOverride();
}

export function clearStatusDisplayOverride(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STATUS_DISPLAY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  emitStatusDisplayChanged();
}

/**
 * Precedence: Player local override > Admin CP default > Built-in default.
 */
export function resolveEffectiveStatusDisplaySettings(
  adminDefaults?: StatusDisplayDefaults | null,
  playerOverride?: StatusDisplayOverride | null
): StatusDisplaySettings {
  const admin = sanitizeStatusDisplayDefaults(adminDefaults) ?? {};
  const player = playerOverride ?? {};

  const rawLayout =
    player.badgeLayout ??
    admin.badgeLayout ??
    BUILTIN_STATUS_DISPLAY_DEFAULTS.badgeLayout;
  const rawPhoneRows =
    player.phoneRows ??
    admin.phoneRows ??
    BUILTIN_STATUS_DISPLAY_DEFAULTS.phoneRows;
  const rawDesktopRows =
    player.desktopRows ??
    admin.desktopRows ??
    BUILTIN_STATUS_DISPLAY_DEFAULTS.desktopRows;
  const rawPlayerPhoneRows =
    player.playerPhoneRows ??
    admin.playerPhoneRows ??
    BUILTIN_STATUS_DISPLAY_DEFAULTS.playerPhoneRows;
  const rawPlayerDesktopRows =
    player.playerDesktopRows ??
    admin.playerDesktopRows ??
    BUILTIN_STATUS_DISPLAY_DEFAULTS.playerDesktopRows;

  return {
    badgeLayout: sanitizeStatusBadgeLayout(
      rawLayout,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.badgeLayout
    ),
    phoneRows: clampStatusAreaRows(
      rawPhoneRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.phoneRows
    ),
    desktopRows: clampStatusAreaRows(
      rawDesktopRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.desktopRows
    ),
    playerPhoneRows: clampPlayerStatusRows(
      rawPlayerPhoneRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.playerPhoneRows
    ),
    playerDesktopRows: clampPlayerStatusRows(
      rawPlayerDesktopRows,
      BUILTIN_STATUS_DISPLAY_DEFAULTS.playerDesktopRows
    ),
  };
}

export function isPhoneWidthViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= PHONE_MAX_WIDTH_PX;
}

export function useIsPhoneWidth(): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(() => isPhoneWidthViewport());

  useEffect(() => {
    const sync = () => setIsPhone(isPhoneWidthViewport());
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return isPhone;
}

export function useStatusDisplaySettings(
  adminDefaults?: StatusDisplayDefaults | null
): {
  settings: StatusDisplaySettings;
  override: StatusDisplayOverride;
  hasOverride: boolean;
  isPhoneWidth: boolean;
  activeUnitRows: number;
  activePlayerRows: number;
  updateOverride: (patch: Partial<StatusDisplayOverride>) => void;
  resetToDefaults: () => void;
} {
  const [override, setOverride] = useState<StatusDisplayOverride>(() =>
    readStatusDisplayOverride()
  );
  const isPhoneWidth = useIsPhoneWidth();

  useEffect(() => {
    const sync = () => setOverride(readStatusDisplayOverride());
    const unsub = subscribeStatusDisplayPrefs(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STATUS_DISPLAY_STORAGE_KEY) {
        sync();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const settings = resolveEffectiveStatusDisplaySettings(adminDefaults, override);

  return {
    settings,
    override,
    hasOverride: Object.keys(override).length > 0,
    isPhoneWidth,
    activeUnitRows: isPhoneWidth ? settings.phoneRows : settings.desktopRows,
    activePlayerRows: isPhoneWidth
      ? settings.playerPhoneRows
      : settings.playerDesktopRows,
    updateOverride: (patch) => {
      const next = updateStatusDisplayOverride(patch);
      setOverride(next);
    },
    resetToDefaults: () => {
      clearStatusDisplayOverride();
      setOverride({});
    },
  };
}
