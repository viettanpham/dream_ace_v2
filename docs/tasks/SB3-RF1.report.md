# TASK SB3-RF1 Report

## 1. Item 1 — `RadarStatusBoard.tsx` Constants (old -> new)
- `STATUS_BOARD_ROW_HEIGHT_PX`: `40` -> `48` (`STATUS_CHIP_FRAME_PX (32) + 2 * STATUS_BADGE_SAFE_PX (6) + 4`)
- `STATUS_BOARD_DESKTOP_HEIGHT_PX`: `190` -> `220` (`STATUS_BOARD_HEADER_HEIGHT_PX (28) + STATUS_BOARD_MAX_VISIBLE_ROWS (4) * STATUS_BOARD_ROW_HEIGHT_PX (48)`)
- Classes / styles updated:
  - Removed `overflow-hidden` from status rows and chip containers; applied `relative` + `overflow-y-visible` on rows and chip areas with `paddingLeft`/`paddingRight` >= `STATUS_BADGE_SAFE_PX` (`6px`).
  - Replaced `h-[190px] min-h-[190px] max-h-[190px]` with `h-[220px] min-h-[220px] max-h-[220px]` on desktop expanded board (kept for 0, 1, and >4 rows with inner scroll after 4 rows; collapsed stays `28px` header only).
  - Phone board rows use the same `48px` row height with no inner vertical scroll.

## 2. `BattleScreen.tsx` Line Count (before -> after)
- Before (`TASK R1` end): `3687` lines
- After (`TASK SB3-RF1`): `3450` lines (`-237` lines)
- Pure moves verified: same `ErrorBoundary` wrappers, render conditions, `data-testid` / `id` / `aria-*` attributes, `CURRENT_SAVE_VERSION` unchanged (`9`), VFX files untouched.

## 3. New Files Created
- `src/components/AutoRepeatDialogs.tsx` (327 lines) — extracted `AutoRepeatToast`, `AutoRepeatBatchSummaryModal`, and `AutoRepeatDialogs`
- `src/components/BattleSheets.tsx` (259 lines) — extracted `PhoneUnitDetailSheet`, `CombatLogPopupSheet`, and `BattleSheets`
- `src/components/__tests__/AutoRepeatDialogs.test.tsx` (146 lines) — render test for toast & batch summary modal testids/callbacks
- `src/components/__tests__/BattleSheets.test.tsx` (139 lines) — render test for phone unit detail sheet & combat log popup sheet testids/callbacks
- Docs: `docs/tasks/SB3-RF1.md`, `docs/tasks/SB3-RF1.progress.md`, `docs/tasks/SB3-RF1.report.md` (plus `docs/CODEMAP.md` updated)

## 4. Verification & Test Count (old -> new)
- `npx vitest run`: `293` passed (41 files) -> **`295` passed (43 files)**
  - `statusBoardG4a3b.test.tsx`: 6/6 passed (updated for `48px` rows, `220px` height, non-clipping chip area, `6px` side padding)
  - `AutoRepeatDialogs.test.tsx`: 1/1 passed
  - `BattleSheets.test.tsx`: 1/1 passed
  - `f2aPlus.test.tsx` (7/7), `battleG3c.test.tsx` (10/10), `loopDiagnosis.test.tsx` (7/7) passed with zero edits
- `npm run lint` (`tsc --noEmit`): passed (0 errors)
- `npm run build` (`vite build`): passed (`1768` modules built cleanly)

## 5. Estimated Page Scroll at `800px` Viewport Height (Desktop)
- `App.tsx` uses `h-[100dvh]` with `TopHud` (`48px` in battle) -> **`752px`** scrollable height inside `BattleScreen`.
- Desktop main column stacks `battle-main-header` (`~128–146px`), `battle-main-field` (`min-h-[420px]`, `~420–475px` at 1024–1280px width), `RadarStatusBoard` (`220px` expanded / `28px` collapsed), optional manual action bar (`~115px` when Manual ON, `0px` when Auto ON), and container padding/gaps (`~28–34px`):
  - **Expanded StatusBoard + Auto ON**: `~796–851px` total -> **~45–100px scroll** (`+30px` vs before's `190px` board)
  - **Expanded StatusBoard + Manual ON**: `~917–972px` total -> **~165–220px scroll** (`+30px` vs before)
  - **Collapsed StatusBoard (`28px`) + Auto ON**: `~604–659px` total -> **0px scroll**

## 6. What Was NOT Checked in a Real Browser
- Actual Chromium/Firefox/Safari pixel layout and `getBoundingClientRect()` heights at an `800px` viewport.
- Visual badge overhang painting order (`6px` corner badges) when hovering/scrolling inside the `4`-row `RadarStatusBoard` container.
- Live phone touch scrolling, safe-area inset spacing, and backdrop-dismiss behavior on `PhoneUnitDetailSheet` and `CombatLogPopupSheet`.
