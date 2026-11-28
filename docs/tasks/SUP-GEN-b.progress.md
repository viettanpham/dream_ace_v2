# TASK SUP-GEN-b Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/SUP-GEN-b.md`, create `docs/tasks/SUP-GEN-b.progress.md`
- [x] STEP 0: Inspect supply stock roll/re-roll sites, `buySupply`/`buySupplyWp`, `SupplyShopPanel`/`SupplyTradeConfirm`, `SupplyTemplate` prices & sell ratio, `addSupplyToConsumables` & `supply_crate`
- [x] ITEM 1: `adminConfig.crateShop`, `crateShopStockWp`/`crateShopStockCredit`, sanitizers, roll/re-roll hooks
- [x] ITEM 2: `buyCrateWp` / `buyCrateCredit` store actions + `SupplyShopPanel` / `SupplyTradeConfirm` crate rows & i18n
- [x] ITEM 3: `estimateCrateValue` in `src/engine/supplyRewards.ts` + Admin block `"Hòm vật tư (cửa hàng)"` + i18n
- [x] TESTS: <= 5 small tests + `--reporter=dot` + `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/SUP-GEN-b.report.md` (<= 12 lines)
