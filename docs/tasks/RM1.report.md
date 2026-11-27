# TASK RM1 — Completion Report

## Items Done
- **ITEM 1 — Split Ring & SP Water Geometry (`src/utils/battleDisplay.ts`)**:
  - Replaced the 3 concentric marker arcs with a single 50/50 vertically split ring (`RADAR_SPLIT_RING_STROKE_WIDTH = 8`), keeping outer radius unchanged (`40` at `markerRadius = 41` / 80px desktop diameter).
  - Left half = HP (`rotate(90)`, filling bottom -> left -> top), right half = Shield (`scale(-1, 1) rotate(90)`, filling bottom -> right -> top), with separate dark green-grey HP track and dark blue Shield track (`maxShield = 0` flagged via `hasShield = false` for faint dashed empty track).
  - Updated HP color to `#22c55e` and low HP (`< RADAR_LOW_HP_THRESHOLD`) to `#ef4444` (preserving `vfx-low-hp-pulse`), Shield color `#38bdf8`, and preserved clamped/rounded ratios plus `hpOnlyMode` fallback below `RADAR_RING_MIN_MARKER_RADIUS`.
  - Added pure SP water sizing (`spRatio`, `spWaterHeight`, `spWaterTopY`) inside `innerCircleRadius` and expanded `innerShapeRadius` cleanly inside the thinner ring.
- **ITEM 2 — SP Water & Split Ring Render (`src/components/BattleRadarView.tsx`)**:
  - Rendered static orange `#f59e0b` SP water fill (`fillOpacity="0.45"`, `height = spRatio * innerDiameter` from bottom) clipped to the inner circle via SVG `<clipPath>`, topped by a `1px` `#fcd34d` surface line (hidden when `SP = 0` and in `hpOnlyMode`).
  - Rendered `radar-rings-<id>`, `radar-ring-hp-<id>`, `radar-ring-shield-<id>`, `radar-ring-sp-<id>` (with `data-ratio`), `radar-ring-tick-top-<id>` / `radar-ring-tick-bottom-<id>` (6px ticks at 12 & 6 o'clock), faint dashed right-half track when `maxShield = 0`, and kept dead units ringless and SVG strictly static.
  - Applied subtle `0.25` fill opacity on alive team shape interiors over the dark base disc so SP water remains visible while shape borders and `ClassCenterIcon` stay crisp on top.
- **ITEM 3 — Legend, Translations, Docs & Tests**:
  - Updated Chú giải ring glyphs (`radar-legend-split-ring`, `radar-legend-low-hp`) in `src/components/BattleRadarView.tsx` and bilingual labels (`radar.legendRings`, `radar.legendLowHp`) in `src/i18n/vi.ts` and `src/i18n/en.ts`.
  - Updated `src/components/__tests__/battleG3b.test.tsx` for split-ring transforms, bottom-up sweep, clamping, `shield=0` vs `maxShield=0` dashed track, low-HP `#ef4444` pulse, SP water height & `clipPath` & `SP=0` hidden, `hpOnlyMode` unchanged, static SVG, and Chú giải legend + `vi`/`en` labels.
  - Updated `docs/CODEMAP.md` and `docs/tasks/RM1.progress.md`.

## Files Changed
- `src/utils/battleDisplay.ts`
- `src/components/BattleRadarView.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/battleG3b.test.tsx`
- `docs/CODEMAP.md`
- `docs/tasks/RM1.progress.md`
- `docs/tasks/RM1.report.md`

## Tests & Checks
- **Tests (old -> new)**: `306` -> **`307`** (`48 test files passed, 307 tests passed` via `npx vitest run`)
- **`tsc --noEmit` (`lint_applet`)**: passed (0 errors)
- **Production build (`compile_applet` / `vite build`)**: succeeded

## What Was NOT Checked in a Real Browser
- Visual arc orientation (`rotate(90)` left HP / `scale(-1, 1) rotate(90)` right Shield) rendered in a real browser SVG engine across Chrome/Firefox/Safari.
- Visual readability and contrast of the `#f59e0b` (45% opacity) SP water fill, `1px` surface line, and `ClassCenterIcon` at 80px desktop marker size and smaller phone portrait marker sizes.
