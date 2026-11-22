# TASK G4a-2c Report — Card mode: lane grid + dynamic status rows + compact cards

## 1. Items Completed & Files Changed
- **ITEM 1 — Lane grid + lane header**:
  - Desktop/tablet (`>640px`): Replaced the dual-column lane stacks with a single `card-lane-grid` (`grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch`), rendering headers `"Đồng minh | Kẻ địch"` once at the top, followed by 1 grid row per lane (`front` / `middle` / `back`) so paired ally and enemy lane cells align on the same top & stretched height.
  - Lane headers display the lane name only (`TIỀN TUYẾN` / `TRUNG TUYẾN` / `HẬU TUYẾN`); removed exposure badge text (`Lộ diện` / `Bảo vệ` / `Trống`) while keeping bright red/sky exposed borders and dim dashed borders otherwise.
  - Both-empty lanes render a single `20px` high line (lane name only, `col-span-2` on desktop); one-side-empty lane cells render an empty bordered box with no text.
  - Phone (`<=640px`): Preserved allies stacked above enemies (`card-side-ally` before `card-side-enemy`) with no grid, same header/border rules, and no nested scroll except overflowing `FixedStatusArea`.
- **ITEM 2 — Dynamic status rows per lane**:
  - Exported `CARD_STATUS_FALLBACK_WIDTH_PX` (`280`) and `countStatusChipRows()` from `src/components/FixedStatusArea.tsx` using the same chip-wrapping math as `packStatusChips`.
  - Updated `getFixedStatusAreaHeightPx(rows, compact)` so `rows <= 0` returns `0px` (`0`, `46px`, `92px` from constants).
  - Computed per-lane status row budgets in `src/components/BattleScreen.tsx` as a monotonic running max across both sides of each lane (capped at `2`) that grows during a battle and resets on a new battle; passed explicitly as `statusRows` to `BattleUnitCard` (`activeUnitRows` user setting no longer drives CARD mode).
  - Added `scrollOnOverflow` and `showOverflowMarkInScroll` to `FixedStatusArea` so cards needing more than `statusRows` switch to thin vertical scroll (`overflow-y-auto tactical-scroll-thin`), keep the lane's `46px`/`92px` height, render all chips, and display the `"+N"` mark (`card-status-overflow-{unitId}`).
  - Enforced `paddingTop >= STATUS_BADGE_SAFE_PX` (`6px`) and `paddingBottom >= STATUS_BADGE_SAFE_PX` (`6px`) on non-compact `FixedStatusArea` instances so chip badges are never clipped and do not overlap across rows.
- **ITEM 3 — Compact cards**:
  - Removed fixed `min-h-[50px]` from `BattleUnitCard` root and omitted `FixedStatusArea` completely when `statusRows === 0` (removing reserved empty space under chips).
- **ITEM 4 — Tests, Docs & Verification**:
  - Added `src/components/__tests__/battleCardG4a2c.test.tsx` (4 tests covering headers, borders, shared desktop grid row alignment, empty lane rules, `Tiền 1,1|2,1 -> 2` / `Trung 1,2,1|0,3 -> cap 2 + scroll + "+N"` / `Hậu 0 -> omitted`, `activeUnitRows` bypass, running max growth/reset, padding `>= STATUS_BADGE_SAFE_PX`, compact card without `min-h-[50px]`, and phone stacked layout).
  - Updated 2 superseded test assertions: `src/components/__tests__/battlePolishRound2.test.tsx` (`min-h-[50px]` removal per Item 3) and `src/components/__tests__/statusChipC2.test.tsx` (enemy unit `e1` uses 2 statuses for non-scroll `overflow-visible` verification while `p1` with 5 statuses tests scrollOverflow per Item 2).
  - Updated `docs/CODEMAP.md` and `docs/tasks/G4a-2c.progress.md`.

### Files Touched
- `src/components/FixedStatusArea.tsx`
- `src/components/BattleUnitCard.tsx`
- `src/components/BattleScreen.tsx`
- `src/components/__tests__/battleCardG4a2c.test.tsx` (new)
- `src/components/__tests__/battlePolishRound2.test.tsx` (1 superseded assertion updated)
- `src/components/__tests__/statusChipC2.test.tsx` (test 2 non-scroll card target moved from 5-status `p1` to 2-status `e1`)
- `docs/CODEMAP.md`
- `docs/tasks/G4a-2c.md`, `docs/tasks/G4a-2c.progress.md`, `docs/tasks/G4a-2c.report.md`

## 2. Measured Card Heights (from `BattleUnitCard.tsx` & `FixedStatusArea.tsx`)
Base card chrome & top row (`border` 2px + `py-1` 8px + horizontal name/bars/44px-info row 44px) = **`54px`** (top row ~20px name + 15px role/lvl alongside ~35px HP/SHD/SP bars bounded by 44px `min-h-[44px]` info button):
- **0 status rows** (`FixedStatusArea` omitted): **`54px`**
- **1 status row** (`54px` + `4px` `gap-1` + `46px` status area from `1 * (32 + 14)`): **`104px`**
- **2 status rows** (`54px` + `4px` `gap-1` + `92px` status area from `2 * (32 + 14)`): **`150px`**

## 3. Code Size & Checks
- **`BattleScreen.tsx` lines**: `3196` (CODEMAP before; `3197` on disk) -> `3347` (after).
- **`npx vitest run`**: **47 / 47 test files passed, 302 / 302 tests passed** (before: `298` across `46` files -> after: `302` across `47` files, including all radar and sidebar SB1/C1/C2 tests).
- **`lint_applet` (`tsc --noEmit`)**: **0 errors**.
- **`compile_applet` (`npm run build`)**: **succeeded**.

## 4. What Was NOT Verified in a Real Browser
- Real-browser visual layout, pixel rendering at `1440x900` (first-screen vertical fit, equal CSS Grid row stretch heights, `x >= 8` bounding rects, 0 horizontal scrollbar), chip badge visual clearance between row 1 & row 2, and touch/wheel scrolling behavior inside overflowing `FixedStatusArea` containers on phone/desktop (automated tests ran under Vitest + jsdom).
