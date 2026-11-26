# SHOP-V2a Progress

- [x] ITEM 1: Config + CREDIT area (`AdminConfig` supplyShop/WP fields, migration defaults 2/5/3/15 -> 3/10/10/50, `generateSupplyShopStock` >= 2 families when count >= 3)
- [x] ITEM 2: WP area (`supplyShopStockWp`, sanitizer, `generateSupplyShopStockWp`, `getSupplyWpPrice`, `buySupplyWp`, wired in new/load/restocks/refresh)
- [x] ITEM 3: Limited refreshes (`supplyShopRefresh {used}`, auto-restock reset, `refreshSupplyShop()`, untouched whole-shop refresh)
- [x] TESTS: At most 5 small tests in `src/engine/__tests__/supplyShopV2a.test.ts`
- [x] CHECKS: Related tests (`--reporter=dot`) + `npx tsc --noEmit` + `docs/CODEMAP.md` + `docs/tasks/SHOP-V2a.report.md`
