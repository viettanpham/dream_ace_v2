# TASK P1b Report — Phone Battle: Control Row, Destroyed-Player Line, Legend Button & Radar-Log Gap

## Step 0 Facts
1. `docs/tasks/G4a-P1.report.md`: Did not exist in `docs/tasks/`.
2. Phone control row (`src/components/BattleScreen.tsx`, `battle-phone-controls`): `sticky top-0 z-30 h-12 max-h-[48px]`, previously used `gap-1.5` and `min-h-[44px]` buttons; `[Tự động]` (`battle-auto-toggle`) had `flex-1 min-w-0`; `[Radar/Thẻ]` (`battle-view-switch`) had icon + text span; `[Lặp]` / running chip (`battle-loop-active-chip`) had `gap-1.5 px-2 w-2 h-2 + w-3.5 h-3.5 + N/M + w-5 h-5`.
3. Legend button (`src/components/BattleRadarView.tsx`, `radar-legend-toggle`): positioned `absolute top-1.5 right-1.5` inside a `z-30` wrapper with `min-h-[44px] min-w-[44px] px-2.5` + text span `"Chú giải"`, matching the control row's `z-30` and painting over it during scroll.
4. Phone destroyed-player block (`renderPlayerStatusBar(true)` in `BattleScreen.tsx`): lacked an early `isDestroyed` return, so it omitted `[TA]` and still rendered `<FixedStatusArea statuses={[]} rows={activePlayerRows} />` below, reserving empty status height.
5. Radar-to-log spacing on phone (`BattleScreen.tsx`): radar wrapper had `p-2` (`8px` bottom) and log wrapper had `px-2 pb-1` (`0px` top), leaving only `8px` between the radar bottom and combat log header.

---

## Summary of Changes
1. **Phone Control Row (`src/components/BattleScreen.tsx`, `src/utils/battleDisplay.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**
   - Standardized `battle-phone-controls` on phone portrait (`<= 640px`) as a single non-wrapping row (`flex-nowrap overflow-x-hidden gap-1 px-1.5`) in exact order: `[Tự động]` `[speed]` `[Radar/Thẻ]` `[Lặp / running loop chip]` `[...]`.
   - Updated all 5 control buttons to `h-10` (40px) and `min-w-[44px]`.
   - Removed `flex-1` (no `w-full`/`flex-1`) from `battle-auto-toggle`, constrained to content width (`max-w-[88px] shrink-0`), and kept emerald green styling strictly conditional on `autoBattleEnabled === true`.
   - Converted phone `battle-view-switch` to icon-only (`h-10 w-11 min-w-[44px] p-0`) with `aria-label` + `title` using new `battle.switchToCard` / `battle.switchToRadar` keys in both `vi.ts` and `en.ts`.
   - Compacted `battle-loop-active-chip` on phone (`h-10 min-w-[44px] max-w-[76px] px-1 gap-0.5 text-[11px]`) while retaining `battle-loop-running-dot`, `battle-loop-progress` (`N/M` / `N/∞`), and `battle-loop-stop`.

2. **Destroyed Player Line on Phone (`src/components/BattleScreen.tsx`)**
   - Added an early `if (isDestroyed)` return inside `renderPlayerStatusBar(true)` rendering ONE `28px` slim line (`h-[28px] max-h-[28px]`) with `[TA]`/`[ALLY]` tag (`getTeamTagLabel(lang, 'me')`), struck-through unit name (`line-through`), and `"Đã phát nổ"` chip (`battle-player-destroyed-badge`).
   - Omitted HP/SHD/SP bars and `FixedStatusArea` when destroyed so no empty status rows or boxes are reserved and the layout below moves up; alive phone state remains unchanged.

3. **Radar Legend Button (`src/components/BattleRadarView.tsx`)**
   - Scoped to `layoutMode === 'phone-portrait'`: lowered legend wrapper and button `z-index` to `z-20` (below `battle-phone-controls` `z-30`) so it never covers the sticky control row.
   - Changed phone `radar-legend-toggle` to an icon-only `32px` button (`h-8 w-8 min-h-[32px] min-w-[32px] p-0`) in the radar's top-right corner with `aria-label` + `title` from `vi.ts` / `en.ts`, opening the existing `radar-legend-panel`.
   - Preserved desktop/tablet (`> 640px`) legend markup (`z-30`, `min-h-[44px]`, text label `"Chú giải"`/`"Legend"`).

4. **24px Radar-to-Log Gap on Phone (`src/utils/battleDisplay.ts`, `src/components/BattleScreen.tsx`)**
   - Added exported constant `PHONE_RADAR_LOG_GAP_PX = 24` in `src/utils/battleDisplay.ts`.
   - Removed bottom padding from the phone battlefield wrapper (`px-2 pt-2`) and inserted `<div data-testid="battle-phone-radar-log-gap" style={{ height: `${PHONE_RADAR_LOG_GAP_PX}px` }} />` solely in the `isPhonePortrait` branch between the radar container and combat log header, with zero `overflow-hidden` clipping.

5. **Tests (`src/components/__tests__/battlePhoneP1b.test.tsx`, `src/components/__tests__/battleRadarTactical.test.tsx`)**
   - Added `battlePhoneP1b.test.tsx` covering: 40px `h-10` & `min-w-[44px]` phone control buttons, non-full-width `"Tự động"` green-only-when-ON, icon-only `Radar/Thẻ` tooltips, 360px/390px control row width budget computed from constants, 28px slim destroyed-player line without status area, 32px icon-only legend button inside radar box with `z-20 < z-30`, phone-only 24px gap element, untouched desktop/tablet markup, `vi.ts`/`en.ts` parity, and `CURRENT_SAVE_VERSION === 9`.
   - Updated the `phone-portrait` assertion in `battleRadarTactical.test.tsx` from `min-h-[44px]` to `h-8` / `min-h-[32px]` while keeping `min-h-[44px]` for `'pc'`.

---

## 360px Width Arithmetic (from `PHONE_CONTROL_ROW_LAYOUT`)
- Minimum target viewport: `360px`
- Container horizontal padding (`px-1.5` = `6px * 2`): `12px`
- Inter-button gaps (`gap-1` = `4px * 4` gaps across 5 buttons): `16px`
- Worst-case button widths:
  - `[Tự động]` (`max-w-[88px]`): `88px`
  - `[speed]` (`min-w-[44px]`): `44px`
  - `[Radar/Thẻ]` (`w-11 min-w-[44px]`): `44px`
  - `[Running Loop Chip]` (`max-w-[76px]`): `76px`
  - `[...]` (`min-w-[44px]`): `44px`
  - **Button total**: `88 + 44 + 44 + 76 + 44 = 296px`
- **Total row width**: `12 + 16 + 296 = 324px` (`36px` remaining slack at `360px`; `66px` remaining slack at `390px`), fitting on one row with zero wrapping or horizontal overflow.

---

## Files Touched
- `src/utils/battleDisplay.ts`
- `src/components/BattleScreen.tsx`
- `src/components/BattleRadarView.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/battlePhoneP1b.test.tsx`
- `src/components/__tests__/battleRadarTactical.test.tsx`
- `docs/tasks/P1b.md`
- `docs/tasks/P1b.progress.md`
- `docs/tasks/P1b.report.md`

---

## Checks & Test Count
- **Baseline `npx vitest run`**: `35 test files, 263 passed`
- **Final `npx vitest run`**: **36 / 36 test files passed, 268 / 268 tests passed** (`0 failed, 0 skipped`)
- **`tsc --noEmit` (`lint_applet`)**: **Passed (0 errors)**
- **Production build (`compile_applet`)**: **Passed**
- **Constraints**: `CURRENT_SAVE_VERSION` remains `9`; `> 640px` desktop/tablet markup, radar markers/lanes, unit cards, combat log content, turn queue, `src/utils/battleVfx.ts`, and `src/components/BattleVfxOverlay.tsx` untouched.

---

## What Could NOT Be Verified in a Real Browser
- Actual rendered pixel widths, text truncation metrics, and line-height wrapping inside `battle-phone-controls` (notably `"Thủ công"` / `"Tự động"` and `"10/20"` loop chip) at `360px` and `390px` viewports under real browser font metrics (`jsdom` does not execute CSS layout).
- Live touch-scroll stacking behavior verifying `z-30` (`battle-phone-controls`) painting over `z-20` (`radar-legend-wrapper` / `radar-legend-toggle` and opened `radar-legend-panel`) and exact visual clearance of bottom-row radar floating labels above `battle-phone-radar-log-gap` on real mobile browsers.
