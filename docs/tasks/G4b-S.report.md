# TASK G4b-S — Final Report

## Items Completed
- **ITEM 1 — ActionStage + Setting**:
  - Created `src/utils/actionStagePrefs.ts` (`dreamAce.actionStage.v1`, default `true` / ON, subscribe pattern matching `useFxSettings`).
  - Added `STAGE_HIT_FLASH_COLORS` to `src/utils/fxTone.ts` (`damage: '#ef4444'`, `heal: '#22c55e'`, `shield: '#38bdf8'`, `sp: '#f59e0b'`, `buff: '#facc15'`).
  - Created `src/components/ActionStage.tsx` exporting shared `StageToken`, `StageProjectile`, `ActionStage`, and `resolveStageFxActorAndTargets`.
  - Updated `src/components/EffectsSettingsPanel.tsx` to reuse `StageToken` and `StageProjectile` in the preview box (all existing preview testids preserved) and added the `"Sân khấu hành động"` Bật/Tắt toggle (`data-testid="battle-toggle-action-stage"`).
  - Added bilingual i18n keys (`fx.actionStageLabel`, `fx.actionStageOn`, `fx.actionStageOff`, `actionStage.title`, `actionStage.usedAction`) to both `src/i18n/vi.ts` and `src/i18n/en.ts`.
  - Stage renders nothing (`null` / `0px`) when setting is OFF, in radar mode, or when `battle.summary` is set; displays latest `battle.fxEvents` item immediately (new FX replaces running FX), idle `actor > target` statically, up to 3 stacked target tokens + `"+N"`, tone-colored projectile + hit flash + result popup text + single-line caption on desktop; hides projectile at `battleSpeed >= 5` or `showProjectiles: false`; preserves reduced-motion markers; shows static tokens in `effectsMode: 'off'`.
- **ITEM 2 — Placement**:
  - Updated `src/utils/battleDisplay.ts` (`getTurnQueueSidebarTotalHeightPx`) and `src/components/TurnQueueBar.tsx` with `hideActingRow` prop so desktop/tablet (`>640px`) Card mode replaces the `36px` acting row (+ `4px` gap = `40px`) with the `84px` `ActionStage`, while Radar mode keeps the acting row.
  - Placed `56px` phone `ActionStage` strip in `src/components/BattleScreen.tsx` between `battle-phone-controls` and `battle-force-ratio-bar` (tokens + projectile + short result text, no caption).
- **ITEM 3 — Card Highlights & Popup Suppression**:
  - Added `stage-card-attacker-glow` (`.anim-stage-card-glow`), `stage-card-target-flash` (`.anim-stage-card-flash`), and reduced-motion fade rules in `src/index.css`.
  - Updated `src/components/BattleUnitCard.tsx` and `src/components/BattleScreen.tsx` so while ActionStage is ON in Card mode, the attacker card glows (`~0.6s`), target card border flashes in the FX tone color (`~0.6s`, keyed by `fx.id`), and inside-card floating numbers are not rendered. Turning ActionStage OFF restores G4b inside-card popups and removes card glow/flash.
- **ITEM 4 — Docs & Verification**:
  - Added `src/components/__tests__/g4bSActionStage.test.tsx` (11 tests) and updated `src/components/__tests__/statusChipsG4a1.test.tsx` (test 5 explicitly turns ActionStage OFF to test card popup containment).
  - Updated `docs/CODEMAP.md`.
  - Did not touch `src/utils/battleVfx.ts`, `src/components/BattleVfxOverlay.tsx`, `CURRENT_SAVE_VERSION` (`9`), or Firebase.

## Files Changed
- `src/utils/actionStagePrefs.ts` (new)
- `src/components/ActionStage.tsx` (new)
- `src/components/__tests__/g4bSActionStage.test.tsx` (new)
- `src/utils/fxTone.ts`
- `src/utils/battleDisplay.ts`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/index.css`
- `src/components/EffectsSettingsPanel.tsx`
- `src/components/TurnQueueBar.tsx`
- `src/components/BattleUnitCard.tsx`
- `src/components/BattleScreen.tsx`
- `src/components/__tests__/statusChipsG4a1.test.tsx`
- `docs/CODEMAP.md`
- `docs/tasks/G4b-S.progress.md`
- `docs/tasks/G4b-S.report.md`

## Desktop Sidebar Height Budget at 1440x900
- Viewport `900px` - TopHud `48px` - layout `py-2` (`16px`) = **`836px`** sidebar height (`gap-2` = `3 * 8px = 24px` across 4 children):
  - `TurnQueueBar` (`variant="sidebar"`, `hideActingRow={true}`, 5 upcoming rows): **`220px`** (`-40px` by hiding the `36px` acting row + `4px` gap)
  - `ActionStage` (`variant="desktop"`): **`84px`**
  - `SidebarUnitPanel` (`SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX`): **`240px`**
  - Inter-panel gaps (`3 * 8px`): **`24px`**
  - Remaining space for `battle-desktop-docked-log` (`flex-1 min-h-[220px]`): `836 - (220 + 84 + 240 + 24) =` **`268px`** (`>= 220px` minimum satisfied with `+48px` margin).

## Verification
- Tests: **`327 -> 338`** (`52/52` test files passed, `338/338` tests passed via `npx vitest run`).
- Typecheck / lint: `tsc --noEmit` (`lint_applet`) passed with 0 errors.
- Production build: `compile_applet` (`vite build`) succeeded.

## Manual / Real-Browser Caveat
- **NOT checked in a real browser**: visual readability at `84px` desktop / `56px` phone strip, animation pacing at `10x–30x` speeds, and real phone viewport scroll/touch feel were verified only via unit/jsdom tests and CSS/layout arithmetic, not inspected in a live browser.
