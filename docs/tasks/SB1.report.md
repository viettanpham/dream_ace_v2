# TASK SB1 — Completion Report

## Step 0 Facts (Pre-Change Audit, max 6 lines)
1. **Previous status area height calculation**: `BattleScreen.tsx` (`renderSidebarSelectedUnit`) only mounted `<FixedStatusArea />` when `sidebarUnit.statuses.length > 0`, passing `rows={Math.min(2, Math.max(1, activeUnitRows))}` and `autoHeight`. In `FixedStatusArea.tsx`, `getFixedStatusAreaHeightPx(rows, compact)` returns `rows * (STATUS_CHIP_FRAME_PX + STATUS_ROW_GAP_PX)` (`1` row = `46px`, `2` rows = `92px`), while `autoHeight` shrank `effectiveRows` to `0`, `1`, or `2` and truncated overflow behind `+{overflowCount}` with `overflow-hidden`.
2. **Right column (`battle-right-sidebar`) height shifts turn-to-turn or on unit selection**:
   - `battle-selected-unit-panel`: (a) status area jumped between `0px` (unmounted), `46px` (1 row), and `92px` (2 rows); (b) `isBlocked` (`battle.frontRowBlocked`) banner renders conditionally for row-blocked middle/back enemies; (c) `showLockTargetBtn` (`min-h-[34px]`) renders only during manual player turns for alive non-stealthed enemies, disappearing on AI turns, Auto mode, or ally inspection.
   - `turn-queue-sidebar`: `32px` header + `36px` acting chip + `4` rows of `26px` (`Mở rộng` mode) stays constant while `>= 3` alive units remain in active combat, but omits the acting chip on `battle.summary` and shrinks when total alive units `< 3` (or expands to `10` rows in `Dòng` mode).
   - `battle-desktop-docked-log`: `flex-1 min-h-[220px]` in `Mở rộng` mode; its `flex-wrap` header can wrap onto 2 lines on narrow tablet sidebars, and switching to `Dòng` mode collapses it to `shrink-0`.

## Files Touched
- `docs/tasks/SB1.progress.md` — Ticked checklist items 1–3.
- `docs/tasks/SB1.report.md` — This completion report.
- `src/i18n/vi.ts`, `src/i18n/en.ts` — Added `'statusUi.areaEmpty'` (`'Không có hiệu ứng'` / `'No active effects'`).
- `src/index.css` — Added `scrollbar-width: thin` / `scrollbar-color` to `.tactical-scroll` and added `.tactical-scroll-thin` (`4px` WebKit scrollbar width).
- `src/components/FixedStatusArea.tsx` — Removed `autoHeight` and 0-row/1-row shrinking; added `scrollOverflow` and `emptyTestId` so when `scrollOverflow` is enabled it always reserves `getFixedStatusAreaHeightPx(rows, compact)`, renders all sorted chips inside `overflow-y-auto overflow-x-hidden tactical-scroll tactical-scroll-thin` with zero `+N` badge, and centers `'statusUi.areaEmpty'` when `statuses.length === 0`.
- `src/components/BattleScreen.tsx` — Removed unused `activeUnitRows`; in `renderSidebarSelectedUnit`, mounted `<FixedStatusArea rows={2} scrollOverflow emptyTestId="sidebar-status-empty" />` unconditionally for every selected unit (no `autoHeight`, no `overflowTestId`, no `statuses.length > 0` guard).
- `src/components/__tests__/battleLayoutG4a2b.test.tsx` — Updated superseded G4a-2b test 2 assertions (previously expected `0` rows / no `sidebar-status-area` when empty and `+N` overflow badge above 2 rows) to verify the fixed 2-row scrollable box, empty line, and zero `+N` badge.
- `src/components/__tests__/battleSidebarStatusSb1.test.tsx` — Added 4 Vitest tests verifying identical panel/status area height across 0/1/2/5 statuses, `overflow-y-auto` + thin scrollbar + no `+N` element, chip tap opening detail popover, `'statusUi.areaEmpty'` in `vi.ts`/`en.ts`, and right-column invariants (`turn-queue-sidebar`, `battle-desktop-docked-log` `flex-1 min-h-[220px]`, `CURRENT_SAVE_VERSION === 9`).

## Right Column Stability & What Still Jumps
- **Fixed by SB1**: Inside `battle-selected-unit-panel`, the status area (`sidebar-status-area`) no longer changes height across 0, 1, 2, or 5+ statuses or `desktopRows` preferences (`92px` fixed).
- **Still jumps (untouched per SB1 RULES restricting edits solely to the status area of `battle-selected-unit-panel`)**:
  1. `showLockTargetBtn` (`min-h-[34px]` + `6px` flex gap = `~40px`) in `battle-selected-unit-panel` toggles every time the turn switches between manual player (`isPlayerTurn && !autoBattleEnabled`) and AI/Auto turns, or when selecting an ally / dead / stealthed enemy.
  2. `isBlocked` (`battle.frontRowBlocked` banner, `~22px` + `6px` gap) in `battle-selected-unit-panel` appears only when inspecting a protected middle/back enemy while a closer row is alive.
  3. `turn-queue-acting-chip` (`36px`) hides when `battle.summary` is set (battle end), and upcoming rows drop below 4 if total alive units `< 3`.
  4. `battle-desktop-docked-log` header uses `flex-wrap`, which can wrap on very narrow `> 640px` tablet columns when event counts or labels widen.

## Final Panel / Status Area Height
- **Status area (`sidebar-status-area`) fixed height**: `2 × (STATUS_CHIP_FRAME_PX + STATUS_ROW_GAP_PX) = 2 × (32 + 14) = 92px` (`height: 92px`, `minHeight: 92px`, `maxHeight: 92px`).
- **Selected-unit panel (`battle-selected-unit-panel`)**: Content-sized (`p-2.5 flex flex-col gap-1.5 shrink-0`) with the `92px` status area constant across 0, 1, 2, and 5+ statuses (exact rendered outer `px` height varies only if the untouched `isBlocked` banner or `showLockTargetBtn` toggles, and `jsdom` does not compute live CSS layout box metrics).

## Checks & Test Count
- **Baseline (`npx vitest run` before SB1 changes)**: **30 test files passed, 238 tests passed**.
- **Final (`npx vitest run` after SB1 changes)**: **31 test files passed, 242 tests passed** (+4 tests in `battleSidebarStatusSb1.test.tsx`, plus updated G4a-2b test 2 in `battleLayoutG4a2b.test.tsx`).
- **`tsc --noEmit` (`lint_applet`)**: **passed (0 errors)**.
- **Production build (`compile_applet` / `vite build`)**: **succeeded**.

## What Could NOT Be Verified in a Real Browser
- Live rendered pixel height of `battle-selected-unit-panel` and visual absence of clipping on row 2 / scrolled row 3+ status turn badges inside the `92px` box (`jsdom` does not run CSS layout or compute `scrollHeight` / `getBoundingClientRect`).
- Real mouse-wheel / trackpad scrolling and visual rendering of the `4px` / `scrollbar-width: thin` scrollbar in Chromium and Firefox at `> 640px` viewports.
- Whether `battle-desktop-docked-log` still achieves `>= 220px` above the fold on smaller desktop/tablet heights (`~720px`–`768px`) now that `sidebar-status-area` always reserves `92px`.
