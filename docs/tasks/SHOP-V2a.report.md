# SHOP-V2a Report
- Hoàn thành: ITEM 1 (config CREDIT/WP + migration `2/5/3/15`→`3/10/10/50` + ≥2 family khi `count >= 3`), ITEM 2 (khu WP: `supplyShopStockWp`, `getSupplyWpPrice()`, `generateSupplyShopStockWp()`, `buySupplyWp()`), ITEM 3 (`supplyShopRefresh {used}`, reset khi auto-restock, `refreshSupplyShop()`).
- Files thay đổi: `src/types/game.ts`, `src/engine/shop.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/engine/__tests__/supplyShopV2a.test.ts`, `docs/CODEMAP.md`, `docs/tasks/SHOP-V2a.{md,progress.md,report.md}`.
- Kiểm thử: `npx vitest run src/engine/__tests__/supplyShopV2a.test.ts src/engine/__tests__/supplyShopCs3a.test.ts --reporter=dot` PASS (2 files, 10/10 tests); `npx tsc --noEmit` PASS (0 lỗi). Full vitest & build không chạy theo scope.
- Whole-shop refresh cũ: `refreshShopStock()` (`src/store/useGameStore.ts`) thu phí cố định `SHOP_STOCK_CONFIG.refreshCostCredits = 120` Credits, làm mới `shopStock` + `supplyShopStock` (+ `supplyShopStockWp`) và đặt lại `battlesUntilRestock = 1`.
- UI / Browser: NOT checked in a real browser (engine-only, không sửa UI; WP UI thuộc `SHOP-V2b`).
