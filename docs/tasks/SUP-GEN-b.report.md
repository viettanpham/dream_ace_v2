TASK SUP-GEN-b — Hoàn tất
- Items done: STEP A, STEP 0, ITEM 1 (`crateShop` config/stock/sanitizers/rerolls), ITEM 2 (`buyCrateWp`/`buyCrateCredit` + stepper & `SupplyTradeConfirm`), ITEM 3 (`estimateCrateValue` + Admin `"Hòm vật tư (cửa hàng)"`), TESTS.
- Files changed: `src/types/game.ts`, `src/engine/shop.ts`, `src/engine/migration.ts`, `src/engine/supplyRewards.ts`, `src/store/useGameStore.ts`, `src/components/SupplyShopPanel.tsx`, `src/components/SupplyTradeConfirm.tsx`, `src/components/admin/CrateShopAdminBlock.tsx`, `src/components/AdminPanel.tsx`, `src/i18n/{vi,en}.ts`, `src/engine/__tests__/supplyCrateShopSupGenB.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/SUP-GEN-b.{md,progress.md,report.md}`.
- Re-roll moments used: `createFreshCampaignState` (new/reset/`applyMapPack`), `startCampaign`, `finalizeBattleOutcome` (when `shouldRestock`), `advanceCampaignMonth` (when `restockOnMonthAdvance`), `refreshSupplyShop`, `adminRestockShopNow` (old-save `migrateSaveData` & rehydrate load `[]`, never auto-rolled).
- estimateCrateValue vs prices: Lv.1 ≈ 400 CR (giá bán 100), Lv.20 ≈ 678 CR (giá bán 170), Lv.50 ≈ 1.166 CR (giá bán 292) — so với giá cửa hàng 100 WP / 100.000 CR.
- Tests & check: `supplyCrateShopSupGenB.test.tsx` (5/5 pass) + 6 file liên quan (`supplyRewardsGenA`, `supplyShopCs3a`, `supplyShopV2a`, `supplyShopConfirm`, `supplyShopV2b`, `admUi1`, 29/29 pass) + `npx tsc --noEmit` (0 lỗi).
- Not checked: full vitest suite, production build, và giao diện trên trình duyệt thật (layout 360px/desktop).
CHƯA chạy trình duyệt thật
