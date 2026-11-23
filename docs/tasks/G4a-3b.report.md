# TASK G4a-3b Report — Bảng trạng thái (Status Board under the Radar)

## Step 0 Facts (Pre-Change Audit)
1. **Test baseline**: `npx vitest run` passed **38 / 38 test files, 281 / 281 tests**.
2. **Radar container & height budget**:
   - `BattleScreen.tsx` renders `BattleRadarView` inside `[data-testid="battle-main-field"]` (`flex-1 min-w-0 min-h-[420px]`, with `[data-testid="battle-radar-container"]` `min-h-[420px] aspect-[12/7]` on desktop/tablet `> 640px`, and `aspect-[380/500]` inside a scrollable vertical page flow on phone `<= 640px`).
   - At `1440×900`, the header stack above the field (`battle-main-header`: control row + force bar + 1-row player status bar) caps at `max-h-[150px]`, leaving ~690px+ before the docked action bar (hidden in Auto mode) so the `>= 420px` radar and a `190px` constant-height board fit below without clipping the radar bottom. On `<= 640px` phone (`390px–402px`), page-level vertical scrolling accommodates the radar + stacked board + unchanged `24px` (`battle-phone-radar-log-gap`) gap before `battle-phone-docked-log`.
3. **Unit status source**: Same `unit.statuses` (`ActiveStatusEffect[]`) array sorted via `sortStatusEffects(unit.statuses, iconMods)` and displayed with shared `<StatusChip>` (used by the selected-unit panel, cards, and player bar).
4. **Unit selection & marker highlight**: `BattleScreen.tsx` tracks `inspectedUnitId` (sidebar priority: `inspectedUnitId` -> `selectedTarget` -> `activeUnit` -> `playerUnit`) alongside store `selectedTargetId` / `selectedAllyTargetId`. `BattleRadarView.tsx` previously highlighted `RadarUnitMarker` only via `isTargeted` (`selectedTargetId` or `selectedAllyTargetId` when `hasSingleAllySkill`), without accepting an explicit `selectedUnitId` highlight prop.

## Items Completed & Files Changed
1. **Item 1 — Desktop/tablet status board under radar (`> 640px`)**
   - Added `STATUS_BOARD_*` sizing constants (`28px` header, `40px` rows, max `4` visible rows, constant `190px` expanded height, max `6` `32px` `StatusChip`s + `+N`) and `<RadarStatusBoard variant="desktop">` in `src/components/RadarStatusBoard.tsx`.
   - Two equal columns `Ta | Địch` (`grid-cols-2`), `overflow-y-auto` inner scroll when exceeding 4 rows, truncated unit name (`w-[110px]`, full name in `title`), dead units (`!unit.alive`) and status-free units (`statuses.length === 0`) hidden, centered muted `"Không có hiệu ứng"` / `"No active effects"` when both sides are empty, and collapsed = `28px` header only.
   - Mounted directly under `battle-main-field` in `src/components/BattleScreen.tsx` (preserving `battle-main-field` `min-h-[420px]` and `battle-radar-container` classes).
   - Added bilingual `statusBoard.*` keys to `src/i18n/vi.ts` and `src/i18n/en.ts`.
2. **Item 2 — Phone status board (`<= 640px`)**
   - `<RadarStatusBoard variant="phone">` stacks `Ta` above `Địch` in normal page flow with zero inner scroll (`overflow-y-auto` omitted, natural height), caps at `4` chips + `+N`, keeps the header collapsible, and sits between the radar wrapper and `battle-phone-radar-log-gap` (`24px`) in `src/components/BattleScreen.tsx`.
3. **Item 3 — Device-local collapse persistence (`dreamAce.statusBoard.v1`)**
   - `readStatusBoardCollapsed()` and `writeStatusBoardCollapsed()` in `src/components/RadarStatusBoard.tsx` default to expanded (`false`) and persist in `localStorage` under `dreamAce.statusBoard.v1`, wired in `src/components/BattleScreen.tsx` outside `CURRENT_SAVE_VERSION = 9`, zustand campaign save, and SV1a/SV1b exports.
4. **Item 4 — Row order & unit selection + radar marker highlight**
   - `sortStatusBoardUnits()` in `src/components/RadarStatusBoard.tsx` sorts player unit first (`isPlayer`), then lane order `front` -> `middle` -> `back` (deterministic `formationCol` / `id` tie-breakers).
   - Clicking/tapping a row selects that unit (`setInspectedUnitId`, plus `selectTarget` when valid enemy / `selectAllyTarget` when ally) and passes `selectedUnitId={inspectedUnitId}` into `BattleRadarView` (`src/components/BattleRadarView.tsx`), setting `data-selected="true"` and rendering `[data-testid="radar-selected-ring-${unit.id}"]` on the radar marker without changing G4a-3a marker geometry or lanes.
5. **Item 5 — Accessible `StatusChip` `title` and `aria-label`**
   - Updated `src/components/StatusChip.tsx` so every `StatusChip` sets both `title` and `aria-label` containing status name (+ value), remaining turns (or `"Duy trì"` / `"Active"`), and stack count (`"Cộng dồn: xN"` / `"Stacks: xN"`).
6. **Item 6 — Card mode exclusion**
   - Both desktop and phone `<RadarStatusBoard />` mounts in `src/components/BattleScreen.tsx` are strictly guarded by `effectiveViewMode === 'radar'` and do not render in card mode.

## Files Touched
- **Added**:
  - `src/components/RadarStatusBoard.tsx`
  - `src/components/__tests__/statusBoardG4a3b.test.tsx`
  - `docs/tasks/G4a-3b.report.md`
- **Modified**:
  - `src/components/BattleScreen.tsx`
  - `src/components/BattleRadarView.tsx`
  - `src/components/StatusChip.tsx`
  - `src/i18n/vi.ts`
  - `src/i18n/en.ts`
  - `docs/tasks/G4a-3b.progress.md`
- **Untouched**: `src/utils/battleVfx.ts`, `src/components/BattleVfxOverlay.tsx`, `CURRENT_SAVE_VERSION` (`9`), radar markers/lanes layout (G4a-3a), card mode, right sidebar, control row, force bar, player block, loop/speed (LP2).

## Tests (Old -> New)
- **Old (`npx vitest run` baseline)**: **38 test files passed, 281 tests passed**
- **New (`npx vitest run`)**: **39 test files passed, 287 tests passed** (+1 file, +6 tests in `src/components/__tests__/statusBoardG4a3b.test.tsx` covering radar-only board mounting, dead/empty filtering, constant `190px` desktop height for 0/1/8 rows, phone stacked page flow + zero inner scroll + `24px` gap, `max 6 / 4` chips + `+N`, `dreamAce.statusBoard.v1` persistence & save/export isolation, player-first + `front -> middle -> back` sort, row tap selecting unit & highlighting radar marker, VI/EN chip `title` + `aria-label`, and absence in card mode).
- `tsc --noEmit` (`lint_applet`): **Passed (0 errors)**.
- Production build (`compile_applet` / `vite build`): **Succeeded**.

## What Was NOT Checked in a Real Browser
- Live CSS Grid/Flexbox rendered bounding boxes (`getBoundingClientRect()`) at `1440×900` (verifying visual first-screen fit of `>= 420px` radar + `190px` board with zero vertical bottom clipping or horizontal overflow at `x < 8px`) and on a `390px–402px` phone browser (touch scroll feel and absence of nested scrolling).
- Live pointer hover tooltip popup appearance from `StatusChip` `title` attributes across desktop browsers.
