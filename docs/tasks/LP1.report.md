# TASK LP1 Report — Loop (Lặp): Unclip Popover, Honest Button State, Defeat Streak Stop

## Summary of Changes

1. **Unclipped Popover via `document.body` Portal (`src/components/BattleScreen.tsx`)**
   - Rendered `battle-loop-popover` through `createPortal(..., document.body)` using `position: fixed`, `width: 'min(252px, 92vw)'`, and `zIndex: 70` (`z-[70]`), completely outside the G4a-L1 `max-h-[48px] overflow-x-hidden` / `overflow-hidden` control bar (`BattleScreen.tsx:1996, 1998`, left untouched).
   - Computed and clamped viewport coordinates (`left >= 8`, `right <= viewportWidth - 8`, opening below the `"Lặp"` anchor rect) via `computeLoopPopoverPosition`, recomputing on open, `window` `resize`, `scroll` (capture phase), and `layoutMode` transitions.
   - Closed the popover cleanly on outside `mousedown` (checking both `loopAnchorRef` and `loopPopoverRef`), `Escape` key, battle end (`battle?.summary`), and component unmount. Preserved all existing `data-testid` attributes.

2. **Honest Button State (`src/components/BattleScreen.tsx`)**
   - Updated inactive `battle-loop-btn` so when `loopPopoverOpen` is `true` (and loop is not running) it uses a neutral sky/slate highlight (`border-sky-400/80 bg-slate-800 text-slate-100 ring-1 ring-sky-400/30` and `text-sky-400` icon) with **zero emerald classes**.
   - Reserved emerald styling and `battle-loop-running-dot` exclusively for `battle-loop-active-chip` when `autoRepeatSession.active === true`.
   - Kept `"Bắt đầu"` (`battle-loop-start`) as the full-width emerald primary button at the bottom of `battle-loop-popover`.

3. **Consecutive Defeat Streak Stop (`src/types/game.ts`, `src/engine/tactics.ts`, `src/store/useGameStore.ts`, `src/i18n/*`, `src/components/BattleScreen.tsx`)**
   - Defined `export const AUTO_REPEAT_MAX_DEFEAT_STREAK = 3` in `src/engine/tactics.ts`.
   - Added `'defeat_streak'` to `AutoStopReason` and in-memory `consecutiveDefeats?: number` to `AutoRepeatSession` in `src/types/game.ts` (`CURRENT_SAVE_VERSION` stays `9`; not persisted).
   - Initialized `consecutiveDefeats: 0` in `startAutoRepeat` and updated `finalizeBattleOutcome` in `src/store/useGameStore.ts` to reset `consecutiveDefeats` to `0` on victory and increment by `1` on defeat.
   - Updated `shouldStopAutoRepeat` in `src/engine/tactics.ts` to return `{ stop: true, reason: 'defeat_streak' }` when `!stopOnDefeat` and `outcome === 'defeat'` reaches `(session.consecutiveDefeats ?? 0) >= AUTO_REPEAT_MAX_DEFEAT_STREAK`.
   - Added `'auto.repeatReason.defeat_streak'`, `'battle.loopStopOnDefeatHintOn'`, and `'battle.loopStopOnDefeatHintOff'` in both `src/i18n/vi.ts` and `src/i18n/en.ts`, wired `streak: AUTO_REPEAT_MAX_DEFEAT_STREAK` in `getAutoStopReasonLabel` (`src/i18n/index.ts`), and added the muted hint line (`data-testid="battle-loop-stop-on-defeat-hint"`) below `"Dừng khi thua"` / `"Stop on defeat"`.

4. **Running Chip Counter (`src/components/BattleScreen.tsx`)**
   - Verified `battle-loop-progress` renders `${currentRun}/${autoRepeatSession.limit}` (`N/M`) and `${currentRun}/∞` (`N/∞`) for `'infinite'` and added explicit test assertions for both formats.

5. **Tests (`src/components/__tests__/loopDiagnosis.test.tsx`, `battleG3b.test.tsx`, `f2aPlus.test.tsx`)**
   - Converted the previous `test.fails` case in `loopDiagnosis.test.tsx` into a passing test verifying `document.body` portal placement, zero clipping ancestors, `position: fixed`, viewport clamping, resize/scroll recomputation, and `Escape` / outside-click / battle-end dismissal.
   - Added desktop `1280×800` end-to-end assertions for non-emerald open button state, `"Bắt đầu"` primary button, auto-launch of battles 2 and 3, `N/M` + `N/∞` counters, 3-defeat streak stop with victory reset, and `vi`/`en` key parity.
   - Updated `battleG3b.test.tsx` and `f2aPlus.test.tsx` queries for the portaled `battle-loop-popover` / `battle-loop-stop-on-defeat` to read from `document.body`.

---

## Files Touched
- `src/components/BattleScreen.tsx`
- `src/engine/tactics.ts`
- `src/store/useGameStore.ts`
- `src/types/game.ts`
- `src/i18n/index.ts`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/loopDiagnosis.test.tsx`
- `src/components/__tests__/battleG3b.test.tsx`
- `src/components/__tests__/f2aPlus.test.tsx`
- `docs/tasks/LP1.md`
- `docs/tasks/LP1.progress.md`
- `docs/tasks/LP1.report.md`

---

## Checks & Test Count
- **Baseline (start)**: `32 test files, 247 tests (246 passed + 1 expected fail)`
- **Final `npx vitest run`**: **32 / 32 test files passed, 249 / 249 tests passed** (`0 failed, 0 skipped`)
- **`tsc --noEmit` (`lint_applet`)**: **Passed (0 errors)**
- **Production build (`compile_applet`)**: **Passed**
- **Constraints verified**: `CURRENT_SAVE_VERSION` stays `9`; G4a-L1 control bar overflow protection (`max-h-[48px] overflow-x-hidden` & `overflow-hidden`) untouched; radar, cards, sidebar, status chips, `src/utils/battleVfx.ts`, and `src/components/BattleVfxOverlay.tsx` untouched.

---

## What Could NOT Be Verified in a Real Browser
- Live browser `getBoundingClientRect()` pixel coordinates for the portaled `battle-loop-popover` during real desktop window resizing, scroll events inside nested containers, and mobile/tablet viewport transitions (`jsdom` does not run a real layout engine and returns zeroed rects unless mocked).
- Visual CSS stacking (`z-[70]`), `min(252px, 92vw)` computed pixel width, and visual appearance of the neutral sky/slate highlight vs emerald active chip and muted defeat-streak hint line under real browser font rendering.
