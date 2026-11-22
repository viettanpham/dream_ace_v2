# TASK G4a-3a Report — Radar Declutter (Markers, Floating Labels, Lanes)

## Step 0 Facts
1. Baseline `npx vitest run`: `36 test files, 268 passed`.
2. Radar rendering files: `src/components/BattleRadarView.tsx` (markers, lane bands/headers, floating popup layer, invalid-target toast), `src/components/BattleVfxOverlay.tsx` (VFX overlay text pills/labels), `src/utils/battleDisplay.ts`, `src/utils/battleVfx.ts`, `src/utils/statusDisplayPrefs.ts`.
3. Previous ring & lane dimensions: ring token radius was `28` (`outerRadius = 27`, `54px` diameter) on desktop/tablet and `22`/`18`/`16` on phone; `buildRowLanes` laid out 3 equal columns per side at `720x420` (`padTop=40`) on landscape (`1440x900`) and 3 equal horizontal bands per side at `380x500` (`padTop=34`) on phone (`402px`).
4. Toast vs combat log audit: `radar-invalid-target-toast` (`"Front row still alive"`, `"Middle row still alive"`, `"Target is stealthed"`, `"Unit is already down"`) and `radar-status-tooltip` existed ONLY over the radar and were NOT written to the combat log; invalid target taps now write `log.invalidTarget` (`SYSTEM`) into `battle.log`.
5. Dead-unit ghost markers: drawn in `BattleRadarView.tsx` (`RadarUnitMarker` rendered dimmed `0.26` opacity tokens with `X` center for `!unit.alive`) and positioned alongside living units in `computeUnitPositions`.

---

## Items Completed & Files Changed

1. **Item 1 — Radar Markers (`src/components/BattleRadarView.tsx`, `src/utils/statusDisplayPrefs.ts`, `src/components/BattleVfxOverlay.tsx`)**
   - Desktop/tablet ring expanded to `80px` diameter (`DESKTOP_RADAR_TOKEN_RADIUS = 41`, `ringOuterRadius = 40`, `data-ring-diameter="80"`). Phone keeps base ring sizes (`22/18/16`) and grows only when the lane has room (`computeLaneTokenRadius`).
   - 1-line truncated unit name (`<= 10` chars on `radar-unit-name`) with full `unit.name` in `<title>`.
   - Status row shows max 3 icon-only `20px` mini chips (`STATUS_ICON_SIZE_SPECS.xs.boxPx = 20`, sorted debuffs first then fewest turns left) + `"+N"` overflow badge.
   - Removed all text tag pills (`radar-status-labels-*` on radar markers and `VỠ KHIÊN` / `TRƯỢT` / buff / debuff / heal text pills in `BattleVfxOverlay.tsx`).
   - `AUTO` badge (`radar-auto-badge-*`, `16px`) positioned on top-left corner of ring; `lock` badge (`radar-lock-*`, `16px`) positioned on top-right corner of ring.

2. **Item 2 — Floating Labels Queue & Slot (`src/utils/battleVfx.ts`, `src/components/BattleRadarView.tsx`)**
   - Added pure FIFO floating label queue helpers (`createRadarFloatingLabelQueue`, `enqueueRadarFloatingLabel`, `advanceRadarFloatingLabel`, `pruneDeadRadarFloatingLabels`, `RADAR_FLOATING_LABEL_DURATION_MS = 600`, `RADAR_FLOATING_LABEL_MAX_QUEUED = 3`).
   - Displays 1 active floating label per alive unit at a time (~600ms each, max 3 pending dropping older) inside a fixed `18px` slot (`h-[18px] leading-[18px]`, `data-slot-height="18"`) positioned strictly ABOVE the unit's ring (`slotTopSvgY = Math.max(2, pos.y - ringOuterRadius - 21)`), clipped inside `radar-popups-layer` (`overflow-hidden inset-0`).
   - Spread desktop/tablet vertical marker positions so 80px rings, 18px above-ring label slots, names, and 20px chips never overlap adjacent markers; suppressed all floating labels and status/dodge text VFX for dead units.

3. **Item 3 — Lane Headers (`src/components/BattleRadarView.tsx`)**
   - Rendered each lane header as one muted `20px` line (`data-testid="radar-lane-header-..."`, `height: 20px`) containing `lane name` + `"Lộ diện"`/`"Exposed"` ONLY on exposed lanes (keeping highlighted stroke border) + live row buff text from formation config (`formatRadarLaneBuffText`), truncated cleanly.
   - Removed `"Bảo vệ"`/`"Protected"` and `"Trống"`/`"Empty"` text from radar lane headers (`vi.ts` / `en.ts` keys kept intact for Card mode & parity tests).

4. **Item 4 — Remove Toast Chips Over Radar & Log Invalid Targets (`src/components/BattleRadarView.tsx`, `src/components/BattleScreen.tsx`, `src/store/useGameStore.ts`, `src/types/game.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`, `src/utils/combatLogFormat.ts`)**
   - Removed `radar-invalid-target-toast` and `radar-status-tooltip` overlays from `BattleRadarView.tsx`.
   - Added `log.invalidTarget` template key (`vi.ts` + `en.ts`), `logRadarInvalidTarget` store action (`SYSTEM` combat log entry), and `onInvalidTargetLog` wiring in `BattleScreen.tsx` so invalid-target taps on radar record the reason directly in the combat log.

5. **Item 5 — Dead Units & Phone Empty Lane Collapse (`src/components/BattleRadarView.tsx`)**
   - Eliminated dead-unit ghost markers on both desktop/tablet and phone (`RadarUnitMarker` returns `null` if `!unit.alive`; `computeUnitPositions` only positions alive units). Kept `defeatPosFallbackMap` exclusively for transient explosion fade-out FX in `BattleVfxOverlay`.
   - Phone-portrait only: lanes with 0 alive units on that side collapse to `PHONE_EMPTY_LANE_HEIGHT_PX = 20` (`isEmptyCollapsed: true`) displaying only the muted lane name, redistributing remaining vertical room to occupied lanes.

6. **Item 6 — "Chú giải" Button Clearance (`src/components/BattleRadarView.tsx`)**
   - Set `buildRowLanes` `padTop` to `46` (desktop/tablet, clearing the 44px legend button) and `44` (phone, clearing the 32px icon-only `radar-legend-toggle`), preventing legend button overlap with lane headers or unit markers.

---

## Files Touched
- `src/components/BattleRadarView.tsx`
- `src/components/BattleVfxOverlay.tsx`
- `src/components/BattleScreen.tsx`
- `src/utils/battleVfx.ts`
- `src/utils/statusDisplayPrefs.ts`
- `src/utils/combatLogFormat.ts`
- `src/store/useGameStore.ts`
- `src/types/game.ts`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/i18n/index.ts`
- `src/components/__tests__/battleRadarDeclutterG4a3a.test.tsx` (new)
- `src/components/__tests__/statusChipC2.test.tsx` (updated xs chip size `18 -> 20`)
- `src/components/__tests__/statusChipG4aC1.test.tsx` (updated xs chip size `18px -> 20px`)
- `src/components/__tests__/battleG3b.test.tsx` (updated removed radar overlay tooltip -> native `aria-label` + no overlay tooltip)
- `src/components/__tests__/battleG3c.test.tsx` (updated Radar no-text-pills check + kept Card toggle check)
- `src/components/__tests__/battleG3d.test.tsx` (updated removed radar overlay tooltip -> native `aria-label` + no text pills)
- `src/components/__tests__/battleRadarTactical.test.tsx` (updated `onInvalidTargetLog` + no dead ghost marker)
- `src/components/__tests__/battleFxFix.test.tsx` (updated phone empty-lane collapse & living-only positions)
- `src/components/__tests__/battleRedesign.test.tsx` (updated 1-at-a-time queued floating label assertion)
- `src/components/__tests__/battlePolishRound2.test.tsx` (updated dead unit renders `null` on radar)
- `docs/tasks/G4a-3a.md`
- `docs/tasks/G4a-3a.progress.md`
- `docs/tasks/G4a-3a.report.md`

---

## Tests & Verification Checks
- **Tests (old -> new)**: `36 test files, 268 tests` -> **`37 test files, 274 tests` passed** (`npx vitest run`, 0 failed, 0 skipped).
- **TypeScript / Lint (`tsc --noEmit` via `lint_applet`)**: **Passed (0 errors)**.
- **Production Build (`compile_applet`)**: **Passed**.
- **Invariants**: `CURRENT_SAVE_VERSION` remains `9`; card mode, right sidebar, control row, force bar, and player status block unchanged; full `vi.ts` / `en.ts` key parity preserved.

---

## What Was NOT Checked in a Real Browser
- Live CSS/SVG rendering, font metrics truncation of lane headers & unit names, and visual pixel clearance between 80px desktop rings / 18px floating label slots / 20px mini chips at exact `1440x900` and `402px` viewports (`jsdom` does not execute full SVG/CSS layout engines).
- Live 600ms timer visual cadence during multi-hit animations and `radar-popups-layer` visual clipping near radar edges in desktop/mobile browsers.
- Real viewport hard-limit measurements (`x >= 8`, above-the-fold height `<= 150px` above radar, zero horizontal overflow across Chromium/Firefox/Safari).
