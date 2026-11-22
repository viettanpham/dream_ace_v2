# TASK LP2 Report — Loop Defeat Rule + Extra Speeds

## Step 0 Audit Facts
1. **Baseline Vitest**: `37` test files (`274` tests total: `271` passed, `3` failed in `f2aPlus.test.tsx` and `loopDiagnosis.test.tsx` because LP2 defeat-rule UI/engine code had already been partially pushed while older LP1/F2a+ assertions still queried the removed toggle/i18n keys).
2. **Loop & Speed Device Storage**:
   - Loop defeat-rule preferences live outside the save in `localStorage` under `dreamAce.loopPrefs.v1` (`LOOP_PREFS_STORAGE_KEY`), storing `{ defeatRule, defeatStreakLimit }` (`CURRENT_SAVE_VERSION` remains `9`).
   - Battle speed lives outside the save in `localStorage` under `dreamAce.battleSpeed.v1` (`BATTLE_SPEED_STORAGE_KEY`).
   - `AUTO_REPEAT_MAX_DEFEAT_STREAK` in `src/engine/tactics.ts` now serves as `DEFAULT_DEFEAT_STREAK_LIMIT` (`3`), while `shouldStopAutoRepeat` applies the streak limit strictly under `'stop_after_n'` using `clampDefeatStreakLimit(defeatStreakLimit)` (1–99).
3. **Speed Scaling & Allowed Speeds**:
   - Combat loop timing scales centrally through `BALANCE_CONFIG.battleSpeedDelays` (`src/data/balance.ts`) and `scaleVfxDurationMs` / `computeDefeatFadeDurationMs` (`src/utils/battleVfx.ts`); the pure combat engine (`src/engine/combat.ts`, `src/engine/tactics.ts`) does not read `battleSpeed`.
   - Allowed speeds: `1, 2, 3, 5, 10, 12, 15, 20, 30` (`ALLOWED_BATTLE_SPEEDS`).
4. **Radar Floating Label Queue (G4a-3a)**:
   - `BattleRadarView.tsx` uses a per-unit 600ms FIFO queue (`RadarFloatingLabelQueueState` with `activeByUnit` and `pendingByUnit`, max 3 queued). At `battleSpeed >= 15` (`RADAR_FLOATING_LABEL_SKIP_SPEED = 15`), popups are skipped rather than queued so the floating label queue never lags behind high-speed battles.

---

## Summary of Changes by Item

1. **Item 1 — Loop Popover "Khi thua" 3 Radio Options, N (1–99), Migration & Defeat Streak Stop**
   - `src/types/game.ts`, `src/utils/battleDisplay.ts`, `src/engine/tactics.ts`, `src/store/useGameStore.ts`, `src/i18n/*`, `src/components/BattleScreen.tsx`:
     - Replaced the `"Dừng khi thua"` checkbox with 3 radio options inside `battle-loop-defeat-rules`: `stop_immediately` (`Dừng ngay`), `stop_after_n` (`Dừng sau [N] trận thua liên tiếp`, integer 1–99, default `3`, clamped on invalid input and persisted in `dreamAce.loopPrefs.v1`), and `never_stop` (`Không dừng (đánh liên tục)`).
     - Removed hidden constant streak behavior when `false` is passed directly (`false` maps to `'never_stop'`); streak stopping applies solely in `stop_after_n` using `N`.
     - Added legacy toggle migration via `migrateLegacyLoopPrefs` / `readDeviceLoopPrefs`: old toggle ON (`true`) → `stop_immediately`, OFF (`false`) → `stop_after_n` (`N=3`).
     - Wired `{ reason, streak }` into `log.autoRepeatStopped` and `getAutoStopReasonLabel` (`"Dừng: thua N trận liên tiếp"` / `"Stopped: N defeats in a row"`).
     - Synced `streakDraft` in `BattleScreen.tsx` when opening the `"Lặp"` popover so the input always reflects the stored device preference.
     - Updated pre-existing LP1/F2a+ assertions in `src/components/__tests__/f2aPlus.test.tsx` and `src/components/__tests__/loopDiagnosis.test.tsx` for the LP2 3-radio model and i18n keys.

2. **Item 2 — Extra Speeds (`1, 2, 3, 5, 10, 12, 15, 20, 30`) + Desktop `"…"` Popover & Phone List**
   - `src/types/game.ts`, `src/data/balance.ts`, `src/utils/battleDisplay.ts`, `src/store/useGameStore.ts`, `src/components/BattleScreen.tsx`, `src/i18n/*`:
     - Expanded `BattleSpeed` and `ALLOWED_BATTLE_SPEEDS` to `[1, 2, 3, 5, 10, 12, 15, 20, 30]` with `PRIMARY_BATTLE_SPEEDS = [1, 2, 3, 5, 10]` and `EXTRA_BATTLE_SPEEDS = [12, 15, 20, 30]`.
     - Desktop/tablet `battle-speed-selector` keeps primary buttons plus `"…"` (`battle-speed-more-btn`), opening a `document.body`-portaled `position: fixed` popover (`battle-speed-extra-popover`, clamped `left >= 8`) with `12x 15x 20x 30x`; when an extra speed is active, `"…"` displays the active speed (e.g. `"20x"`) highlighted (`bg-sky-500 text-slate-950`).
     - Phone keeps `battle-speed-cycle`, opening a `document.body`-portaled popover (`battle-speed-phone-popover`) with all 9 speeds `1x–30x`. Speed continues to persist per device (`dreamAce.battleSpeed.v1`).
   - `src/engine/migration.ts`:
     - Updated `VALID_SPEEDS` from `[1, 2, 3, 5, 10]` to `new Set<BattleSpeed>(ALLOWED_BATTLE_SPEEDS)` so extra speeds (`12, 15, 20, 30`) are preserved during save migration/import instead of resetting to `1x`.

3. **Item 3 — High Speed Safety (`>= 15x` Floating Label Skip + Engine Determinism)**
   - `src/utils/battleDisplay.ts`, `src/components/BattleRadarView.tsx`:
     - Fixed `BattleRadarView.tsx` to reference `prev.pendingByUnit` (instead of non-existent `prev.queuedByUnit`) on `RadarFloatingLabelQueueState`.
     - Updated the `floatingQueue` `useState` initializer to skip enqueueing popups at mount when `shouldSkipRadarFloatingLabels(battleSpeed)` (`battleSpeed >= 15`) is `true`.
     - Added `skipFloatingLabelsForSpeed` to `activeFloatingLabels` `useMemo` dependencies so toggling across the `15x` threshold immediately clears/updates floating labels.
     - Verified combat resolution (`src/engine/combat.ts`, `src/engine/tactics.ts`) has zero dependency on `battleSpeed`.

4. **Item 4 — LP2 Tests & Full Verification**
   - Added `src/components/__tests__/loopDefeatSpeedLp2.test.tsx` (7 tests) verifying all LP2 requirements: 3 radio options + device persistence, N clamping `1–99`, option 2 exact `N`-defeat stop & win reset + combat log/chip stop reason, option 3 continuous run across defeats, legacy toggle & extra speed migration, 9-speed list & desktop `"…"` / phone popovers, radar label skip at `>= 15x`, and identical seeded battle outcomes/logs at `1x` vs `30x`.

---

## Files Changed (LP2-R Session + LP2 Scope)
- `src/components/BattleScreen.tsx`
- `src/components/BattleRadarView.tsx`
- `src/engine/migration.ts`
- `src/engine/tactics.ts`
- `src/store/useGameStore.ts`
- `src/types/game.ts`
- `src/data/balance.ts`
- `src/utils/battleDisplay.ts`
- `src/i18n/index.ts`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/f2aPlus.test.tsx`
- `src/components/__tests__/loopDiagnosis.test.tsx`
- `src/components/__tests__/loopDefeatSpeedLp2.test.tsx`
- `docs/tasks/LP2.progress.md`
- `docs/tasks/LP2.report.md`

---

## Checks & Test Count
- **Tests (old → new)**: `274` tests in `37` files (`271 passed, 3 failed` at baseline before test updates) → **`281` tests in `38` files (`281 passed, 0 failed`)**.
- **`tsc --noEmit` (`lint_applet`)**: **Passed (`0` errors)**.
- **Production build (`compile_applet`)**: **Passed**.
- **Constraints**: `CURRENT_SAVE_VERSION` kept at `9`; control row height (`h-10` / `max-h-[48px]`) and overflow guards preserved; radar, card mode, sidebar, force bar, player block, Admin CP, `src/utils/battleVfx.ts`, and `src/components/BattleVfxOverlay.tsx` projectile/beam code unchanged.

---

## What Was NOT Checked in a Real Browser
- Live Chromium/mobile browser layout geometry (`getBoundingClientRect()`), visual wrapping of the 3 radio options + `N` input inside `min(252px, 92vw)` on real font metrics, and `40px` control bar row pixel height across narrow mobile (`360px`/`390px`), tablet (`768px`), and desktop (`1280px`/`1440px`) viewports.
- Visual smoothness and timing feel of battle cadence and VFX at `12x`, `15x`, `20x`, and `30x` under real `requestAnimationFrame` / CSS animation execution.
