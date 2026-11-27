# SHOP-V2b Progress

- [x] ITEM 0: Old refresh (`refreshShopStock()` stops touching `supplyShopStock`, `supplyShopStockWp`, `supplyShopRefresh`)
- [x] ITEM 1: Two areas in `SupplyShopPanel` + refresh row + `SupplyTradeConfirm` currency `'CR' | 'WP'` + empty states + vi/en strings
- [x] ITEM 2: `[MAX]` 4th buy button in both CREDIT & WP areas (`min(remaining, floor(currency/unitPrice), SUPPLY_STACK_CAP - owned)`)
- [x] ITEM 3: Sell + Admin (`BÁN LẠI` has no "only accepts CR" text + Admin CP 6 `supplyShop*`/`supplyWp*` inputs)
- [x] TESTS: At most 5 small tests covering items (1)–(5)
- [x] CHECKS: Related tests (`--reporter=dot`) + `npx tsc --noEmit` + `docs/CODEMAP.md` + `docs/tasks/SHOP-V2b.report.md`
