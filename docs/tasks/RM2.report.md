# TASK RM2 — Completion Report

## Items Done
- **ITEM 1 — Ring Geometry & 3 Size Tiers (`src/utils/battleDisplay.ts`)**:
  - Updated split-ring HP/Shield stroke to size-aware `clamp(round(outerRadius * 0.09), 3, 5)` (`4px` at `outerRadius = 40` / `markerRadius = 41`, `RADAR_SPLIT_RING_STROKE_WIDTH = 4`), preserving 80px desktop outer diameter, left HP / right Shield 6->12 o'clock sweeps, `#ef4444` low HP, `#38bdf8` Shield, and dashed empty track when `maxShield = 0`.
  - Replaced SP water geometry (`spRatio`, `spWaterHeight`, `spWaterTopY` removed) with `spArc: RadarRingArcSpec | null` via an optional `minStrokeWidth` parameter on `computeRingArcSpec()` (default `3` unchanged for existing callers, `2` for SP): `strokeWidth = 2`, `#f59e0b` arc, `#3a2a0c` track, 1px gap inside the split ring (`radius = outerRadius - stroke - 2` = `34` at 80px), starting at 12 o'clock clockwise (`rotate(-90)`), `maxSp = 0` rendering track-only (`ratio = 0`).
  - Implemented 3 `markerRadius` tiers (`RADAR_SP_RING_MIN_MARKER_RADIUS = 30`, `RADAR_RING_MIN_MARKER_RADIUS = 17`):
    - `R >= 30`: split ring + thin inner SP ring (`innerCircleRadius = outerRadius - stroke - 4 = 32`, `innerShapeRadius = 30`).
    - `17 <= R < 30`: split ring only (no SP ring), larger inner disc (`outerRadius - stroke - 1`).
    - `R < 17`: HP-only full ring unchanged.
- **ITEM 2 — Radar Marker & Legend Render (`src/components/BattleRadarView.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**:
  - Deleted SP water SVG `<clipPath>`, fill `<rect>`, surface `<line>`, `useId` import, and `radar-ring-sp-fill-*` / `radar-ring-sp-surface-*` nodes.
  - Rendered the SP ring track (`radar-ring-track-sp-<id>`) + arc (`radar-ring-sp-<id>` with `data-ratio`, `data-stroke-width`, `data-has-capacity`) as static `<circle>` elements when `ringResult.spArc` is present (no animation; dead units stay ringless).
  - Removed the `fillOpacity={0.25}` override on alive team shapes (`player-hex`, `ally-circle`, `enemy-diamond`, `boss-fortress`), restoring their normal solid opaque interior fills since the SP ring now sits cleanly outside `innerShapeRadius` rather than behind the shape.
  - Updated Chú giải (`radar-legend-split-ring`) with the split ring + thin inner orange SP ring (`radar-legend-sp-ring`) and updated `radar.legendRings` in `vi.ts` and `en.ts` (replacing SP water wording).
- **ITEM 3 — Tests & Docs (`src/components/__tests__/battleG3b.test.tsx`, `docs/CODEMAP.md`)**:
  - Updated pure and component tests for size-aware split-ring stroke (`4` at `R=41`, `3` at `R=22`, `5` at `R=56`), `computeRingArcSpec` SP clamp override (`2`), 12 o'clock clockwise SP arc, `maxSp = 0` track-only, all 3 tiers (`R = 41` full, `R = 22` phone split-only with no `radar-ring-sp`, `R = 14` / crowded phone HP-only), zero `radar-ring-sp-fill`/`surface`/`clipPath`, static SVG, and updated legend glyph + `vi`/`en` labels.
  - Updated `docs/CODEMAP.md` and `docs/tasks/RM2.progress.md`.

## Files Changed
- `src/utils/battleDisplay.ts`
- `src/components/BattleRadarView.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/battleG3b.test.tsx`
- `docs/CODEMAP.md`
- `docs/tasks/RM2.md`
- `docs/tasks/RM2.progress.md`
- `docs/tasks/RM2.report.md`

## Tests & Checks
- **Tests (old -> new)**: `308` -> **`308`** (`48 test files passed, 308 tests passed` via `npx vitest run`)
- **`tsc --noEmit` (`lint_applet`)**: passed (0 errors)
- **Production build (`compile_applet` / `vite build`)**: succeeded

## Visual Verification
- **NOT checked in a real browser** — specifically NOT seen visually:
  - Ring thickness look (`4px` split ring + `2px` inner SP ring with `1px` gaps) at `80px` desktop marker size.
  - Readability and color contrast of the thin `2px` `#f59e0b` SP ring / `#3a2a0c` track at desktop scale and in the `20x20` Chú giải legend icon.
  - Visual balance and `ClassCenterIcon` size inside the restored solid `innerShapeRadius` (`30px` at `80px` diameter) disc.
