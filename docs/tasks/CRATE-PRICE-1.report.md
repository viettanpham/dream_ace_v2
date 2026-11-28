TASK CRATE-PRICE-1 — Complete
- ITEM 1 (defaults): Updated DEFAULT_CRATE_SHOP_CONFIG in src/engine/shop.ts to wp.price=10 and credit.price=1000 (was 100 / 100_000); fresh saves and CrateShopAdminBlock Reset get new defaults while existing stored crateShop prices are preserved (CURRENT_SAVE_VERSION stays 15).
- Stale test fix: Updated src/engine/__tests__/supplyCrateShopSupGenB.test.tsx test #3 balances/expected costs (200/200_000 -> 20/2_000) and test #5 Lv.20 readout ('100 WP'/'100.000' -> '10 WP'/'1.000').
- ITEM 2 (priceFactor & UI): Added CrateShopPriceFactorConfig { enabled: false, creditPct: 100 (10-1000) }, getCrateCreditPrice(pilot, adminConfig) using deployed Gear level + estimateCrateValue() (WP stays fixed), wired into SupplyShopPanel.tsx (row + confirm) & useGameStore.ts buyCrateCredit.
- Admin UI: Added priceFactor checkbox, creditPct input, Lv.20 live example, and effective Credit price in VALUE_CHECK_LEVELS to CrateShopAdminBlock.tsx + matching vi.ts/en.ts keys.
- Files: src/types/game.ts, src/engine/{shop,supplyRewards}.ts, src/store/useGameStore.ts, src/components/{SupplyShopPanel,admin/CrateShopAdminBlock}.tsx, src/i18n/{vi,en}.ts, src/engine/__tests__/{cratePrice1,supplyCrateShopSupGenB}.test.tsx, docs/CODEMAP.md.
- Tests: npx vitest run --reporter=dot across 7 files -> 7 passed (37/37 tests passed: cratePrice1 3/3, supplyCrateShopSupGenB 5/5, supplyShopV2b 5/5, supplyShopUiCs3b 6/6, supplyShopConfirm 4/4, supplyRewardsGenA 5/5, u1BattleLock 9/9).
- TypeScript: npx tsc --noEmit -> 0 errors.
NOT checked in a real browser
