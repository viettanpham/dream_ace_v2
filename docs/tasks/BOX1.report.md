# TASK BOX1 Report

**Items done:**
- ITEM 1 — Added optional `adminConfig.boxCapacity` (default `100`, clamped `20-1000`), exported `DEFAULT_BOX_CAPACITY`, `MIN_BOX_CAPACITY`, `MAX_BOX_CAPACITY`, `sanitizeBoxCapacity`, and `getBoxCapacity` in `src/engine/migration.ts`, kept `BALANCE_CONFIG.maxInventorySize = 100` as default only, replaced all non-test capacity checks (`useGameStore.ts`, `tactics.ts`, `warehouse.ts`, `i18n/index.ts`, `ShopScreen.tsx`, `WarehouseView.tsx`), kept existing items intact when capacity is lowered, and added red over-cap indicator (`N/cap`) plus full-box buy/move/auto-repeat guards.
- ITEM 2 — Raised `DEFAULT_WAREHOUSE_CAPACITY` from `300` to `500` (applied to fresh saves and saves without a stored value while preserving stored v10/v11 values), added `"Sức chứa Hòm đồ"` (`20-1000`) and `"Sức chứa Kho đồ"` (`50-2000`) number inputs with clamp hints in `AdminPanel.tsx`, and added bilingual strings in `vi.ts` and `en.ts`.

**Files changed:**
- `src/types/game.ts`, `src/data/balance.ts`, `src/engine/migration.ts`, `src/engine/warehouse.ts`, `src/engine/tactics.ts`, `src/i18n/index.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/store/useGameStore.ts`, `src/components/ShopScreen.tsx`, `src/components/WarehouseView.tsx`, `src/components/AdminPanel.tsx`, `src/engine/__tests__/boxCapacity.test.ts`, `src/engine/__tests__/saveV10Migration.test.ts`, `src/components/__tests__/warehouseQuickSellW1b2.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/BOX1.md`, `docs/tasks/BOX1.progress.md`, `docs/tasks/BOX1.report.md`.

**Old test expectations changed and why:**
- `src/engine/__tests__/saveV10Migration.test.ts` (lines 81, 91, 133, 162, 301): updated hardcoded `300` assertions to `500` because `DEFAULT_WAREHOUSE_CAPACITY` changed from `300` to `500` for fresh saves and saves without a stored `warehouseCapacity`.
- `src/components/__tests__/warehouseQuickSellW1b2.test.tsx` (line 684): exempted `admin.warehouseCapacity` from the non-warehouse `'Kho đồ'` text sweep because BOX1 adds `"Sức chứa Kho đồ"` to Admin CP.

**Test & typecheck result:**
- `npx tsc --noEmit` passed (0 errors), and all 9 targeted test files (`boxCapacity.test.ts`, `saveV10Migration.test.ts`, `warehouseAndClock.test.ts`, `engine.test.ts`, `warehouseViewW1b1.test.tsx`, `warehouseQuickSellW1b2.test.tsx`, `f2aPlus.test.tsx`, `shopAndIcons.test.tsx`, `loopDefeatSpeedLp2.test.tsx` — 81 tests across the 7 clean initial files + 2 re-run fixed files) passed.

**Not checked:**
- Full vitest suite, production build (`npm run build`), Firebase sync, and live browser rendering were not run.
