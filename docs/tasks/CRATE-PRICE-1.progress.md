# TASK CRATE-PRICE-1 Progress

- [x] STEP A: Read CODEMAP.md, crate shop engine/UI/tests, create CRATE-PRICE-1.md & progress checklist
- [x] ITEM 1: Update DEFAULT_CRATE_SHOP_CONFIG wp.price=10 & credit.price=1000, preserve existing saves, fix stale 100/100000 test assertions
- [x] ITEM 2: Add CrateShopConfig.priceFactor { enabled, creditPct (10..1000) }, getCrateCreditPrice(pilot, adminConfig), wire SupplyShopPanel + useGameStore + CrateShopAdminBlock UI + vi/en i18n
- [x] TESTS & CHECKS: Add <= 3 unit/UI tests (cratePrice1.test.tsx), run related vitest --reporter=dot + npx tsc --noEmit
- [x] REPORT: Update docs/CODEMAP.md, write docs/tasks/CRATE-PRICE-1.report.md (<= 10 lines)
