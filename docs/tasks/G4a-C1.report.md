# TASK G4a-C1 Report — Status Chip Polish (Component Only)

## Step 0 Facts
1. **Previous chip/glyph/text sizes**: `CatalogIcon` used `xs` (18px frame / 12px glyph), `sm` (22px / 14px), `md` (28px / 18px), `lg` (34px / 22px); `StatusChip` used `10px` (`text-[10px] font-semibold`) value text.
2. **Badge positions**: Arrow badge sat at `-bottom-1 -left-1` (Layout B) / `-bottom-1 -right-1` (Layout A); turns badge sat at `-bottom-1.5 -right-1.5` (B) / `-bottom-1.5 -left-1.5` (A) on `#060A12` with `text-slate-100`; stack `xN` badge sat at `-top-1.5 -right-1.5`.
3. **Row height computation**: `FixedStatusArea.getFixedStatusAreaHeightPx` computed `rows * rowH + (rows - 1) * 14 + pad` (`rowH` = 26 normal / 24 compact, `pad` = 6 normal / 4 compact), yielding 32px/72px (1/2 normal rows) and 28px/66px (1/2 compact rows).
4. **Screens using the chip/icon**: `BattleUnitCard` (`FixedStatusArea` `sm`), `BattleScreen` player bar (`FixedStatusArea` `compact`), `BattleScreen` right-sidebar selected-unit panel (`FixedStatusArea` `sm` + `autoHeight`), `FixedStatusArea` popover/sheet & `UnitDetailSheet` (`CatalogIcon` `md`), `BattleRadarView` tooltip (`StatusChip` `sm`), `BattleRadarView` legend (`CatalogIcon` `sm`), and `IconCatalogPreviewModal` ("Bảng icon", `CatalogIcon` `lg`).
5. **Mini size screen**: `BattleRadarView` unit markers use `<StatusChip size="xs" showLabel={false} />` inside `<foreignObject width="28" height="26">` — kept at 18px/12px untouched.

## Files Touched
- **Modified**:
  - `src/utils/statusDisplayPrefs.ts` (single constants source: `STATUS_CHIP_FRAME_PX = 32`, `STATUS_CHIP_BAR_FRAME_PX = 28`, `STATUS_CHIP_GLYPH_PX = 20`, `STATUS_CHIP_VALUE_FONT_PX = 13`, `STATUS_ROW_GAP_PX = 14`, `STATUS_TURNS_BADGE_COLOR = '#F5C542'`, `STATUS_TURNS_BADGE_BG = 'rgba(11, 18, 32, 0.85)'`, `STATUS_TURNS_BADGE_FONT_PX = 11`, `STATUS_TURNS_BADGE_OUTSET_PX = 4`, `STATUS_ICON_SIZE_SPECS`, and `getStatusChipGeometry` / `rectsIntersect` helpers; kept `playerPhoneRows: 1` & `playerDesktopRows: 1`)
  - `src/components/CatalogIcon.tsx` (imports `STATUS_ICON_SIZE_SPECS` and turns badge constants; `bar` = 28px/20px, `sm`/`md`/`lg` = 32px/20px, `xs` mini kept unchanged; turns badge renders clock + yellow `#F5C542` bold `11px` number on `#0B1220` 85% pill with 1px outline centered 4px outside the frame corner with A/B layout swap)
  - `src/components/StatusChip.tsx` (imports size/padding/font constants; renders `13px` bold value text and constant-driven padding/gap for non-`xs` variants while keeping `xs` untouched)
  - `src/components/FixedStatusArea.tsx` (computes `getFixedStatusAreaHeightPx(rows, compact)` strictly as `rows * (chip + gap)` using `STATUS_CHIP_FRAME_PX` / `STATUS_CHIP_BAR_FRAME_PX` and `STATUS_ROW_GAP_PX`, maps `compact` to `size="bar"`, updates chip width estimator & overflow badge height from constants)
- **Added**:
  - `src/components/__tests__/statusChipG4aC1.test.tsx` (4 Vitest tests covering 32/28/20/13 constants across cards/bar/legend/Bảng icon while keeping radar `xs` 18px/12px, `#F5C542` turns badge styling, non-intersecting badge/glyph geometry + A/B corner swap, and `rows * (chip + gap)` status area height)
  - `docs/tasks/G4a-C1.md`, `docs/tasks/G4a-C1.progress.md`, `docs/tasks/G4a-C1.report.md`

## Checks & Test Count
- **Baseline `npx vitest run`**: `29 / 29` test files passed, `234 / 234` tests passed.
- **Final `npx vitest run`**: `30 / 30` test files passed, `238 / 238` tests passed.
- **`tsc --noEmit` (`lint_applet`)**: Passed (`0` errors).
- **Production build (`compile_applet` / `vite build`)**: Passed.
- **Scope checks**: `CURRENT_SAVE_VERSION` remains `9`; `BattleRadarView`, `BattleUnitCard`, `BattleScreen`, `CombatLogList`, `battleVfx.ts`, `BattleVfxOverlay.tsx`, `vi.ts`, and `en.ts` were untouched (key parity verified at `1401 === 1401`).

## New Heights (Computed from Constants & Container Rules)
- **Player block (`battle-player-status-bar`, 1 status row default, `28px` chip + `14px` gap)**:
  - `FixedStatusArea`: `1 * (28 + 14) = 42px` (vs `28px` previously, `+14px`; default remains `1` row on both phone and desktop).
  - Desktop alive player block (`BattleScreen` `max-h-[64px]` cap intact): capped at `64px` (`+6px` max vs `~58px` previously); phone compact player block: `~78px` (`+14px` vs `~64px` previously).
- **Right-sidebar selected-unit panel (`battle-selected-unit-panel`, 2 status rows, `32px` chip + `14px` gap)**:
  - `FixedStatusArea`: `2 * (32 + 14) = 92px` (vs `72px` previously, `+20px` total / `+10px` per row; collapses to `0px` when unit has 0 statuses via `autoHeight`).
  - Panel total height increases by `+20px` when 2 status rows are active.
- **Unit card with 2 status rows (`BattleUnitCard`, `32px` chip + `14px` gap)**:
  - `FixedStatusArea`: `2 * (32 + 14) = 92px` (vs `72px` previously, `+20px` total / `+10px` per row).
  - Total card height: `~150px` (`~58px` header/bars/padding + `92px` status area, vs `~130px` previously).

## What Could NOT Be Verified in a Real Browser
- **Actual rendered `getBoundingClientRect()` & clipping**: jsdom does not run CSS layout/rasterization, so actual visual clipping of the bottom-corner turns badge inside desktop `battle-player-status-bar`'s `max-h-[64px] overflow-hidden` container (where `30px` header/chrome + `42px` status area = `72px` natural height, though the `28px` chip frame itself ends at `59px`) and `FixedStatusArea` padding could not be visually inspected.
- **Material Symbols font metrics & hex frame rendering**: Real browser glyph centering inside the 32px/28px round and CSS clip-path hexagon frames, plus 13px bold monospace chip wrapping widths across Vietnamese and English labels, were not visually verified in a live browser.
