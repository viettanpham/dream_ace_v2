# TASK U2a Report — Nhân vật tab: character summary, total stats with source breakdown, faster point allocation

## Items Completed
- **STEP A**: Saved verbatim prompt to `docs/tasks/U2a.md`, tracked checklist in `docs/tasks/U2a.progress.md`, read `docs/CODEMAP.md` and only target ranges.
- **ITEM 1(a) — Pure source breakdown (`src/engine/statBreakdown.ts`)**:
  - Added `getStatBreakdown(gear, equipBonuses, traits, passives, pending?)` returning `{ base, levelGrowth, allocated, equipment, other, total }` per `StatKey`.
  - Computes `total` directly via `calculateEffectiveStats(...)` without duplicating its formula, and derives `other` by difference (`total - (base + levelGrowth + allocated + equipment)`, allowing negative values such as `evasionMod < 0`).
- **ITEM 1(b) — Character Summary & "Tổng chỉ số" (`src/components/GarageView.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**:
  - Updated `garage.title` / `garage.subtitle` to `"Nhân vật"` / `"Character"` and updated character-focused subtitle text.
  - Added active Gear summary block (`data-testid="character-summary"`) under the header showing callsign/name, class name/code/role, `Lv.`, `EXP` progress to next level, Power, battle record, and `"+N điểm chưa cộng"` / `"+N Unspent Pts"`.
  - Added `"Tổng chỉ số"` / `"Total Stats"` (`data-testid="total-stats-section"`) with 5-source legend using fixed non-green/non-red colors (`Gốc` slate `#94a3b8`, `Cấp` sky `#38bdf8`, `Điểm cộng` violet `#a78bfa`, `Trang bị` amber `#fbbf24`, `Nội tại` pink `#f472b6`).
  - Rendered 6 rows with short + full stat label, total value, and proportional horizontal segmented bar showing numeric source values (zero sources and negative `other` omitted from bar segments).
  - Tapping a row expands an inline formula detail below the row on desktop (`>= 640px`), and opens a non-scrolling `BottomSheet` (`bodyScrollable={false}`) on phone (`< 640px`).
- **ITEM 2 — Faster Point Allocation (`src/components/GarageView.tsx`)**:
  - Added `[+5]` and `[MAX]` buttons next to `+` in the allocation block while keeping live preview and derived telemetry intact.
  - Added press-and-hold auto-repeat on `+` and `−`: immediate first step on `pointerdown`, repeat every `120 ms` after `400 ms`, accelerating to `60 ms` after `1200 ms`, stopping on `pointerup` / `pointerleave` / `pointercancel` / `blur` / unmount, clamped to `[0, remainingPoints]`.
  - Prevented double-step on `pointerdown` + `click` (plain tap = exactly 1 step) and played `soundFx.playClick()` once per hold.
  - Applied `min-h-[44px] min-w-[44px]`, `touch-manipulation`, `select-none`, `onContextMenu` suppression, and responsive wrapping (`overflow-x-hidden` on root) to fit 360px viewports cleanly.

## Files Changed
- `src/engine/statBreakdown.ts` (new)
- `src/components/GarageView.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/engine/__tests__/statBreakdown.test.ts` (new)
- `src/components/__tests__/garageCharacterU2a.test.tsx` (new)
- `docs/CODEMAP.md`
- `docs/tasks/U2a.md`
- `docs/tasks/U2a.progress.md`
- `docs/tasks/U2a.report.md`

## Checks
- **Related Vitest run** (`statBreakdown.test.ts`, `garageCharacterU2a.test.tsx`, `u1BattleLock.test.tsx`): **3 files / 14 passed** (5 new U2a tests added: `410 -> 415` total suite count).
- **Typecheck (`lint_applet` / `tsc --noEmit`)**: **Passed (0 errors)**.
- Full `vitest` suite and production build were intentionally skipped per task instructions.

## NOT Checked in a Real Browser
- Physical touch press-and-hold repeat timing and visual bar/button fit at `360px` viewport width on an actual mobile browser/device were verified via DOM/CSS and jsdom fake-timer tests only, not live browser rendering.
