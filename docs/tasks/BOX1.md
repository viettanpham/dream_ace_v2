TASK BOX1 — Configurable Hòm đồ and Kho đồ capacity (Admin CP). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/BOX1.md, checklist docs/tasks/BOX1.progress.md, tick items, final report docs/tasks/BOX1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol. Open ONLY: BALANCE_CONFIG.maxInventorySize (balance.ts ~56) and every non-test use (grep maxInventorySize: useGameStore ~787, ~1729, ~2232; i18n/index.ts ~441; ShopScreen.tsx ~143, ~390, ~394, ~517, ~1741; tactics.ts ~1149; warehouse.ts ~229-245; WarehouseView.tsx ~262); DEFAULT_WAREHOUSE_CAPACITY / sanitizeWarehouseCapacity / createDefaultAdminConfig / admin sanitizer in src/engine/migration.ts (~103-120, ~244, ~549); AdminConfig in src/types/game.ts (grep warehouseCapacity); AdminPanel.tsx balance block (grep enrageStepPct). Never open whole big files. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged (optional field, sanitizer default).

SCOPE: capacity numbers only. Loot, shop prices, transfer rules unchanged. New strings vi.ts AND en.ts.

ITEM 1 — Hòm đồ capacity. adminConfig.boxCapacity (optional number, default 100, clamp 20-1000) with exported DEFAULT_BOX_CAPACITY / MIN / MAX / sanitizeBoxCapacity next to the warehouse ones in migration.ts, plus helper getBoxCapacity(adminConfig). BALANCE_CONFIG.maxInventorySize stays only as the DEFAULT (set to 100, comment "default, use getBoxCapacity"). Replace EVERY non-test use above by getBoxCapacity(adminConfig) (store: from state.adminConfig; i18n helper: take the capacity as an argument or read the store's adminConfig; engine functions keep their capacity parameter and callers pass it). Lowering the capacity never deletes items: a box above its cap shows N/cap in red and blocks new loot-to-box moves, buying and loop as today for a full box.
ITEM 2 — Kho đồ default + Admin CP. DEFAULT_WAREHOUSE_CAPACITY 300 -> 500 (new saves and saves without a stored value get 500; a stored value is KEPT and can be raised in Admin CP; clamp stays 50-2000). In the Admin CP balance block add two number fields: "Sức chứa Hòm đồ" (boxCapacity, 20-1000) and "Sức chứa Kho đồ" (warehouseCapacity, 50-2000), each with the clamp hint and instant save through the existing admin setter pattern.

HARD LIMITS: no layout change beyond the two fields; existing saves keep working (old saves get 100 for the box, their stored warehouseCapacity stays).

TESTS: write at most 5 small tests in total; do not add tests beyond these; do not refactor existing tests (only fix an old test that really fails, and list it with the reason, e.g. a 60 -> 100 expectation). The 5: (1) sanitizeBoxCapacity default / clamp / non-number and getBoxCapacity from adminConfig; (2) moveToBox and startAutoRepeat respect a custom cap; (3) Shop full-box block uses the custom cap; (4) WarehouseView shows N/cap from config and lowering the cap keeps items; (5) DEFAULT_WAREHOUSE_CAPACITY 500 for a save without a stored value, a stored 300 is kept.

CHECKS: run ONLY the new test file and the test files you touched or that fail (grep tests for maxInventorySize to find them) with --reporter=dot, then tsc --noEmit. Print at most 15 lines of output. On a failure re-run only the failing file. NO full vitest, NO production build.

REPORT (short): items done + files changed; every old test expectation changed and why; one line of test result; what was NOT checked. No tables, no test logs.
