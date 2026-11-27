# TASK UI-CL1 — Completion Report

## Items Done
- **ITEM 1 — Sidebar unit panel header (`src/components/BattleScreen.tsx`)**:
  - Updated `sidebar-unit-lane` so both its `title` attribute and visible text display only `getRowTitle(sidebarUnit.row)` (e.g., `"Trung tuyến"`), removing `" · " + getExposureLabel(exposure)`.
  - Deleted unused `getExposureLabel`, unused `exposure` in `renderSidebarUnitPanel`, and unused `RowExposureState` type import.
- **ITEM 2 — Radar lane header (`src/components/BattleRadarView.tsx`)**:
  - Removed `t('battle.rowExposed')` (`"Lộ diện"`) from `headerParts` while keeping `data-row-state` and the bright exposed lane border intact.
  - Added `getRadarLaneBuffParts` and `formatRadarLaneHeaderText` so `rowLabel` + `buffText` compact multi-buff headers cleanly to `${buffParts[0]} +${N}` (e.g., `HẬU TUYẾN · -10% DEF +1`) whenever the full buff string would exceed the header width, preventing mid-word buff truncation while preserving full text on `title` and showing only `rowLabel` on phone-collapsed lanes.
- **ITEM 3 — Tests & i18n check**:
  - Kept `battle.rowExposed`, `battle.rowProtected`, and `battle.rowEmpty` in `src/i18n/vi.ts` and `src/i18n/en.ts` (`statusChipsG4a1.test.tsx` intact).
  - Updated `src/components/__tests__/battleRadarDeclutterG4a3a.test.tsx` test 3 to verify `"Lộ diện"` is absent and back-row desktop header compacts to `-10% DEF +1` without cutting `+10% ST tầm xa` mid-word.
  - Added test 5 in `src/components/__tests__/battleSidebarPanelSb2.test.tsx` verifying an exposed radar lane header has no `"Lộ diện"` and the sidebar unit header has no `"Bảo vệ"` / `"Lộ diện"` / `"Trống"`.
  - Updated `docs/CODEMAP.md`, `docs/tasks/UI-CL1.progress.md`, and `docs/tasks/UI-CL1.report.md`.

## Files Changed
- `src/components/BattleScreen.tsx`
- `src/components/BattleRadarView.tsx`
- `src/components/__tests__/battleRadarDeclutterG4a3a.test.tsx`
- `src/components/__tests__/battleSidebarPanelSb2.test.tsx`
- `docs/CODEMAP.md`
- `docs/tasks/UI-CL1.md`
- `docs/tasks/UI-CL1.progress.md`
- `docs/tasks/UI-CL1.report.md`

## Tests & Checks
- **Tests (old -> new)**: `307` -> **`308`** (`48 test files passed, 308 tests passed` via `npx vitest run`)
- **`tsc --noEmit` (`lint_applet`)**: passed (0 errors)
- **Production build (`compile_applet` / `vite build`)**: succeeded

## Visual Verification
- **NOT checked in a real browser** (verified via Vitest JSDOM renders, TypeScript check, and Vite production build only).
