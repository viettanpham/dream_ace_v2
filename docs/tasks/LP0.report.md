# TASK LP0 Report — Loop (Lặp) Diagnosis (READ-ONLY)

## Verdict (First)

**Verdict: (a) Loop code exists and works; the symptom has another cause.**

The Auto-Repeat ("Lặp") engine, store state, stop checks, and next-battle auto-launcher in `useGameStore.ts`, `tactics.ts`, and `BattleScreen.tsx` are all intact and functional (nothing was "lost between workspaces").

The observed symptom — clicking `"Lặp"` makes the button look ON while battle end opens `"Chiến thắng Xuất kích"` and does **not** launch the next battle — is caused on desktop (`> 640px`) by **CSS overflow clipping + 2-step activation UX**:
1. In `src/components/BattleScreen.tsx:1906`, `battle-desktop-controls` sets `max-h-[48px] overflow-x-hidden` (which forces CSS `overflow-y: auto` per the CSS Overflow spec), and its direct child wrapper at `src/components/BattleScreen.tsx:1908` sets **`overflow-hidden`**.
2. `renderLoopControl(false)` (`src/components/BattleScreen.tsx:2012`) renders `battle-loop-popover` (`absolute right-0 top-full mt-1.5 z-50 w-[252px]` at `BattleScreen.tsx:811`) **inside** that clipped `48px` bar.
3. Clicking `"Lặp"` (`BattleScreen.tsx:782–785`) toggles `loopPopoverOpen = true`, which immediately styles the button emerald/green (`BattleScreen.tsx:788`: `'border-emerald-400 bg-emerald-500/20 text-emerald-100'`) — making `"Lặp"` appear ON — while the popover containing the count selector (`1 / 5 / 10 / 20 / ∞`) and `"Bắt đầu"` (`battle-loop-start`) is clipped invisibly outside the `48px` container.
4. Because `"Bắt đầu"` is never clicked, `startAutoRepeat(...)` is never called and `autoRepeatSession` remains `null`. At battle end, `BattleScreen.tsx:2855–2857` opens `"Chiến thắng Xuất kích"` (`#battle-outcome-title`, line `2879`) and `BattleScreen.tsx:535` returns early without starting the next battle. *(Note: even if a 1-battle loop had started via the default `autoRepeatLimit = 1` at `useGameStore.ts:815`, finishing run 1 produces `autoRepeatSession.active === false` with `stopReason: 'completed'`, which opens `"Tổng kết Lặp tự động"` `#repeat-summary-title`, NOT `"Chiến thắng Xuất kích"`.)*

---

## 1. Loop Implementation & Existing Tests

### Types (`src/types/game.ts:627–661`)
- `AutoRepeatLimit = 1 | 5 | 10 | 20 | 'infinite'`
- `AutoStopReason = 'completed' | 'defeat' | 'retreat' | 'manual_stop' | 'inventory_full' | 'low_hp' | 'boss_encounter' | 'elite_encounter' | 'auto_retreat'`
- `AutoRepeatSession`: `{ active: boolean; limit: AutoRepeatLimit; sectorId: string; completedRuns: number; wins: number; totalExp: number; totalCredits: number; totalWarPoints: number; totalDrops: ItemInstance[]; stopReason: AutoStopReason | null }`
- `AutoRepeatRunToast`: `{ id: string; runNumber: number; outcome: 'victory' | 'defeat'; expGained: number; creditsGained: number; warPointsGained: number; lootCount: number }`

### Store Fields (`src/store/useGameStore.ts:815–818`, `256`, `3656`)
- `autoRepeatLimit`: `AutoRepeatLimit` (default `1`, line `815`; transient)
- `autoRepeatStopOnDefeat`: `boolean` (default `true`, line `816`; persisted via `buildSaveSnapshotFromState` at line `256` and `partialize` at line `3656`)
- `autoRepeatSession`: `AutoRepeatSession | null` (default `null`, line `817`; tracks running state `active`, counter `completedRuns`, `wins`, rewards, drops, and `stopReason`)
- `autoRepeatToast`: `AutoRepeatRunToast | null` (default `null`, line `818`; per-run banner between runs)

### Store Functions & `"Lặp"` Handlers
- **`src/store/useGameStore.ts`**:
  - `setAutoRepeatLimit` (lines `1364–1367`): updates `autoRepeatLimit`.
  - `setAutoRepeatStopOnDefeat` (lines `1369–1372`): updates `autoRepeatStopOnDefeat`.
  - `startAutoRepeat(limit?, sectorId?)` (lines `1374–1423`): checks `inventory.length >= BALANCE_CONFIG.maxInventorySize` (`60`); if full, creates inactive session with `stopReason: 'inventory_full'`; otherwise sets `autoBattleEnabled: true`, `autoRepeatSession.active = true`, `completedRuns: 0`, and launches `startBattle(chosenSector)` immediately if not already in an ongoing battle.
  - `stopAutoRepeat(reason = 'manual_stop')` (lines `1425–1436`): sets `autoRepeatSession.active = false` and records `stopReason`.
  - `clearAutoRepeatSummary` / `clearAutoRepeatToast` (lines `1438–1443`).
  - `finalizeBattleOutcome` (lines `690–752`): updates `completedRuns`, `wins`, totals, `totalDrops`, calls `shouldStopAutoRepeat(...)`, either sets `active: false` + `stopReason` or keeps `active: true` and sets `autoRepeatToast`.
  - `startBattle` (lines `2099–2156`): preserves `autoRepeatSession` & `autoRepeatToast` when `state.autoRepeatSession?.active` is `true` (lines `2140–2142`, `2152–2154`).
  - `performAutoPlayerTurn` (lines `2357–2387`): Auto Safety stop (`shouldRetreat` / `shouldStopAuto`) pauses/stops `autoRepeatSession` (`active: false`, `stopReason: safetyEval.reason` or `auto_retreat`).
- **`src/engine/tactics.ts`**:
  - `shouldStopAutoRepeat` (lines `1131–1150`): pure stop evaluator.
- **`src/components/BattleScreen.tsx`**:
  - `"Lặp"` UI & handlers in `renderLoopControl(phoneCompact)` (lines `726–878`):
    - Inactive state: `data-testid="battle-loop-btn"` (line `776`) toggles `loopPopoverOpen` (`setLoopPopoverOpen((v) => !v)` at line `784`).
    - Popover (`data-testid="battle-loop-popover"`, line `809`): count buttons `battle-loop-opt-{opt}` (`REPEAT_OPTIONS = [1, 5, 10, 20, 'infinite']`, line `829`), `battle-loop-stop-on-defeat` checkbox (line `855`), and Start button `battle-loop-start` (line `864`) calling `startAutoRepeat(selectedLoopCount, battle.sectorId)` and closing the popover.
    - Active state: `data-testid="battle-loop-active-chip"` (line `743`) showing pulsing `battle-loop-running-dot`, `battle-loop-progress` (`N/M`), and `battle-loop-stop` calling `stopAutoRepeat('manual_stop')` (line `746`).
  - Next-battle launcher `useEffect` (lines `534–549`): watches `battle?.summary`, `autoRepeatSession?.active`, `autoRepeatSession?.completedRuns`, `autoRepeatSession?.sectorId`, `battleSpeed`, `skipAnimations`, `startBattle`, and schedules `window.setTimeout(() => startBattle(autoRepeatSession.sectorId), delayMs)` (`320ms` when `skipAnimations || battleSpeed >= 5`, else `850ms`).

### Existing Tests Mentioning the Loop (All Passing)
1. `src/engine/__tests__/engine.test.ts:1805–1866` — `shouldStopAutoRepeat` rules (`completed`, `defeat`, `retreat`, `inventory_full`, `infinite`, `stopOnDefeat: false`) — **passes**.
2. `src/components/__tests__/f2aPlus.test.tsx:60–200` — `Auto-Repeat Loop (F2a+)`: `shouldStopAutoRepeat`, `startAutoRepeat(5)` + `forceWinBattle()` run toast & batch completion modal, manual stop mid-batch, and inventory-full stop — **passes**.
3. `src/components/__tests__/battleG3b.test.tsx:429–561` — `"Lặp"` popover (`battle-loop-btn`, `battle-loop-popover`, `battle-loop-start`), `startAutoRepeat(10)`, `battle-loop-active-chip` (`2/10`), `stopAutoRepeat`, and phone count chip — **passes** *(passed in jsdom because jsdom does not visually clip DOM nodes under `overflow-hidden`)*.
4. `src/components/__tests__/battleLayoutG4a2a.test.tsx:246–287` — `battle-loop-btn` & `battle-loop-active-chip` directly inside control row — **passes**.
5. `src/components/__tests__/battlePolishRound2.test.tsx:235` — `battle-loop-btn` presence — **passes**.
6. `src/components/__tests__/cloudSaveUi.test.tsx:1017–1030` — `stopAutoRepeat` triggers cloud autosave flush — **passes**.

---

## 2. Step-by-Step Battle-End Trace & Blocking Conditions

### Step-by-Step Trace When a Battle Ends (`finalizeBattleOutcome` -> `BattleScreen.tsx`)
1. `finalizeBattleOutcome` (`src/store/useGameStore.ts:690–752`) runs on victory, defeat, or retreat, setting `battle.summary`.
2. If `autoRepeatSession?.active` was `true`:
   - `updatedSession` increments `completedRuns`, `wins`, `totalExp`, `totalCredits`, `totalWarPoints`, and appends `droppedItems`.
   - `shouldStopAutoRepeat` (`src/engine/tactics.ts:1131–1150`) evaluates stop criteria:
     - **Stops** (`active: false`, `stopReason` set, `autoRepeatToast: null`) if `retreated`, `inventory >= 60`, `defeat && autoRepeatStopOnDefeat`, or `limit !== 'infinite' && completedRuns >= limit`.
     - **Continues** (`active: true`, `autoRepeatToast` populated) otherwise.
3. `BattleScreen.tsx` re-renders:
   - Single-battle outcome modal `"Chiến thắng Xuất kích"` (`BattleScreen.tsx:2855–2857`) is **only** rendered when `battle.summary && !autoRepeatSession?.active && !showRepeatBatchSummary` (meaning `autoRepeatSession === null`, or the rare case where `autoRepeatSession` was manually stopped before any run started without `inventory_full`).
   - Batch summary modal `"Tổng kết Lặp tự động"` (`#repeat-summary-title`, `BattleScreen.tsx:2703`) renders when `showRepeatBatchSummary` is `true` (line `890`: `autoRepeatSession && !autoRepeatSession.active && (battle.summary || autoRepeatSession.stopReason === 'inventory_full')`).
   - While `autoRepeatSession.active === true`, **neither modal opens**; instead `battle-loop-toast` renders (`BattleScreen.tsx:2660–2693`).
4. Next-battle launcher `useEffect` (`BattleScreen.tsx:534–549`) sees `battle?.summary` truthy and `autoRepeatSession?.active === true`, schedules `window.setTimeout` (`320ms` or `850ms`), and calls `startBattle(autoRepeatSession.sectorId)`.
5. `startBattle` (`useGameStore.ts:2099–2156`) replaces `battle` with a new `BattleState` (`summary: null`), clears the old `battle.summary`, keeps `autoRepeatSession` active (lines `2140–2142` / `2152–2154`), and clears `battle-loop-toast` automatically after `4200ms` (or via close button).

### Every Condition Checked
- **`Tự động` (`autoBattleEnabled`) required?** **No** for launching the next battle — `BattleScreen.tsx:535` checks only `battle?.summary` and `autoRepeatSession?.active` (plus `startAutoRepeat` sets `autoBattleEnabled: true` at `useGameStore.ts:1403`). Note: if the player turns `Tự động` off mid-loop, future runs won't auto-play player turns unless turned back on; conversely, if **Auto Safety** (`performAutoPlayerTurn`, `useGameStore.ts:2357–2387`) triggers (`low_hp`, `boss_encounter`, `elite_encounter`, `auto_retreat`), it sets `autoRepeatSession.active = false`, stopping the loop with `#repeat-summary-title` (NOT `"Chiến thắng Xuất kích"`).
- **`isBattleActive` / battle lock**: **Does NOT block.** `isBattleActive` (`useGameStore.ts:794–801`) returns `false` as soon as `battle.summary` is non-null, and neither `startBattle` nor `BattleScreen.tsx:535` checks `isBattleActive`.
- **SV1b cloud upload deferral**: **Does NOT block.** In `src/store/useCloudSaveStore.ts:1675–1697`, `attachCloudAutosaveListeners()` observes `isBattleActive` and calls `requestAutosave()` / `flushDeferredUploadsIfReady()` asynchronously on `useCloudSaveStore` without modifying `useGameStore` loop state or cancelling `BattleScreen`'s `setTimeout`.
- **Pending dialogs**: **Do NOT block** `BattleScreen.tsx:534–549` (`CloudConflictDialog`, `UnlockCloudPinDialog`, `statsModalOpen`, `battle-loop-toast`, `moreActionsOpen`, etc. do not cancel or guard the `useEffect` timer; only `tacticsModalOpen` pauses `performAutoPlayerTurn` at `BattleScreen.tsx:509`). Note that if `BattleScreen` unmounts (e.g., returning to Hangar), its `useEffect` cleanup clears the timer.
- **GEAR box / Inventory full (`>= 60`, `BALANCE_CONFIG.maxInventorySize`)**: Stops at `startAutoRepeat` (`useGameStore.ts:1380–1398`) or `shouldStopAutoRepeat` (`tactics.ts:1140–1142`) with `stopReason: 'inventory_full'`, opening `"Tổng kết Lặp tự động"` (`#repeat-summary-title`).
- **Low credits**: **Never blocks.** Sorties and loops have no credits requirement.
- **Defeat vs Victory**: `outcome === 'defeat' && autoRepeatStopOnDefeat` (`true` by default) stops the loop with `stopReason: 'defeat'` and opens `#repeat-summary-title`; with `autoRepeatStopOnDefeat: false`, defeat continues to the next run unless `retreated`, `inventory_full`, or `completedRuns >= limit`.

---

## 3. Vitest Diagnosis (`src/components/__tests__/loopDiagnosis.test.tsx`)

Added **1 new test file** (`src/components/__tests__/loopDiagnosis.test.tsx`, 5 tests):
1. `auto-starts battles 2 and 3 without clicking when loop is active for 3 runs with forced victory` — **PASS**. Simulates a 3-battle loop with `forceWinBattle()`, verifying no `"Chiến thắng Xuất kích"`, toast shown, battle 2 and battle 3 auto-launch via timers without any click, and run 3 completes with `"Tổng kết Lặp tự động"` (`stopReason: 'completed'`). *(Note: passes `3` to `startAutoRepeat` via type cast because `REPEAT_OPTIONS` in the UI offers `[1, 5, 10, 20, 'infinite']`.)*
2. `does not get blocked by SV1b cloud autosave / deferred upload listeners across the 3-battle loop` — **PASS**. Attaches `attachCloudAutosaveListeners()` with `InMemoryCloudStore` and `deferredUploadPending: true`, confirming all 3 battles still auto-advance cleanly.
3. `[test.fails] desktop "Lặp" popover is not clipped by overflow-hidden / max-h-[48px] ancestors` — **EXPECTED FAIL**. Renders desktop (`1280×800`), clicks `battle-loop-btn`, confirms `battle-loop-popover` renders inside two clipping ancestors (`max-h-[48px] overflow-x-hidden` at `BattleScreen.tsx:1906` and `overflow-hidden` at `BattleScreen.tsx:1908`). *(Note: jsdom does not perform real CSS pixel layout/hit-testing, so visual occlusion is verified via the ancestor CSS classes.)*
4. `reproduces the exact "Chiến thắng Xuất kích" symptom when only "Lặp" is clicked (as occurs when desktop popover is clipped)` — **PASS**. Clicking `"Lặp"` sets `border-emerald-400` (`data-loop-running="false"`, `autoRepeatSession === null`), and after `forceWinBattle()` + `2000ms` timer advance, `"Chiến thắng Xuất kích"` appears and the next battle never launches.
5. `launches 3 battles automatically on phone portrait when clicking Lặp -> 5x -> Bắt đầu (no overflow-hidden clipping)` — **PASS**. On phone (`390×844`), `battle-phone-controls` lacks `overflow-hidden`, so clicking `Lặp -> 5 -> Bắt đầu` starts the loop and launches battles 2 and 3 automatically.

---

## 5. History Check (`docs/tasks/*.report.md` and `docs/*.md`)

Searched all docs (excluding `LP0.*`) for `loop`, `Lặp`, and `repeat`:
- **`docs/tasks/G4a-2a.md` / `.progress.md` / `.report.md`**: Document keeping `renderLoopControl` directly in `battle-phone-controls` and `battle-desktop-controls` outside `"..."`, removing the separate `"AUTO đang chạy"` bar, adding `battle-loop-active-chip`, `battle-loop-running-dot`, `battle-loop-progress`, `battle-loop-stop`, `battle.loopRunningTag` (`vi.ts` / `en.ts`), and `battleLayoutG4a2a.test.tsx`. **All files, fields, keys, and tests listed in `G4a-2a.report.md` are present in current source.**
- **`docs/tasks/G4a-L1.md` / `.report.md`**: Kept `"loop state in the control row"` and modified `battle-desktop-controls` in `src/components/BattleScreen.tsx` to add `max-h-[48px] overflow-x-hidden` (`1906`) and inner `overflow-hidden` (`1908`) to fix 1246px/1440px horizontal overflow — inadvertently clipping `battle-loop-popover`.
- **Origin of core Auto-Repeat loop**: Evidenced by code comments/i18n/tests (`src/components/__tests__/f2aPlus.test.tsx`, `src/components/__tests__/battleG3b.test.tsx`, `src/i18n/vi.ts:1298`), indicating the core loop was built in pre-import tasks **F2a+** and **G3b** (which predate `docs/tasks/*.report.md` in this repo). **Zero files, store fields, or tests from any `.report.md` are missing**, so the code was **not** `"lost between workspaces"`.

---

## Files Read
- `src/store/useGameStore.ts`
- `src/components/BattleScreen.tsx`
- `src/engine/tactics.ts`
- `src/store/useCloudSaveStore.ts`
- `src/types/game.ts`
- `src/engine/migration.ts`
- `src/data/balance.ts`
- `src/App.tsx`
- `src/i18n/vi.ts`, `src/i18n/en.ts`
- `src/components/__tests__/f2aPlus.test.tsx`, `battleG3b.test.tsx`, `battleLayoutG4a2a.test.tsx`, `battlePolishRound2.test.tsx`, `cloudSaveUi.test.tsx`, `src/engine/__tests__/engine.test.ts`
- `docs/tasks/*.report.md` (`G4a-2a`, `G4a-2b`, `G4a-C1`, `G4a-L1`, `SB1`, `SV1b-1`, `SV1b-2-fix`), `docs/tasks/G4a-2a.md`, `G4a-2a.progress.md`, `G4a-L1.md`, `LP0.md`, `LP0.progress.md`

---

## Proposed Smallest Fix (NOT Applied — Read-Only)

1. **Unclip `battle-loop-popover` on desktop (`src/components/BattleScreen.tsx:1906, 1908, 811`)**:
   - Remove `overflow-hidden` from the inner button group wrapper (`BattleScreen.tsx:1908`) and either remove `overflow-x-hidden` from `battle-desktop-controls` (`BattleScreen.tsx:1906`) while keeping `min-w-0` / responsive button sizing, **or** render `battle-loop-popover` (`BattleScreen.tsx:811`) in a portal / `fixed` overlay anchored via `loopAnchorRef.current.getBoundingClientRect()` so the dropdown never gets clipped by `max-h-[48px]`.
2. **Optional clarity improvements**:
   - Distinguish `"popover open"` vs `"loop running"` styling on `battle-loop-btn` (`BattleScreen.tsx:788`: avoid solid green fill before `"Bắt đầu"` is clicked, or show subtle slate/amber highlight while configuring).
   - Default `autoRepeatLimit` to `5` instead of `1` (`src/store/useGameStore.ts:815`) so opening and starting the loop doesn't default to a single 1-run batch.

---

## Checks
- Baseline before LP0: **31 / 31 test files passed, 242 / 242 tests passed**
- Final `npx vitest run`: **32 / 32 test files passed, 246 passed | 1 expected fail (247)** *(including `src/components/__tests__/loopDiagnosis.test.tsx`: 4 passed, 1 `test.fails`)*
- `npx vitest run src/components/__tests__/loopDiagnosis.test.tsx`: **1 / 1 test file passed, 4 passed | 1 expected fail (5)**
- `tsc --noEmit` (`lint_applet`): **Passed (0 errors)**
- Compliance: **0 existing source files modified**; `CURRENT_SAVE_VERSION` untouched (`9`).
