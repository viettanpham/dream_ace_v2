# TASK BOX1 Progress Checklist

- [x] STEP A — Save BOX1 prompt verbatim, inspect CODEMAP & grep target symbols (`maxInventorySize`, `warehouseCapacity`, `enrageStepPct`)
- [x] ITEM 1 — `boxCapacity` (default 100, clamp 20-1000, `DEFAULT_BOX_CAPACITY`/`MIN`/`MAX`/`sanitizeBoxCapacity`/`getBoxCapacity`), `BALANCE_CONFIG.maxInventorySize = 100` (default only), replace all non-test uses, red `N/cap` & full-box guards
- [x] ITEM 2 — `DEFAULT_WAREHOUSE_CAPACITY` 300 -> 500 (existing stored values kept), Admin CP balance fields for `boxCapacity` (20-1000) & `warehouseCapacity` (50-2000) + `vi.ts`/`en.ts` strings
- [x] TESTS & CHECKS — Create 5-test `boxCapacity.test.ts` (update only genuinely broken old tests), update `docs/CODEMAP.md`, run targeted vitest (`--reporter=dot`, <=15 lines) + `npx tsc --noEmit`
- [x] REPORT — Write `docs/tasks/BOX1.report.md` and print it verbatim
