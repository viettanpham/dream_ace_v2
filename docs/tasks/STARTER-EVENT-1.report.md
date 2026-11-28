TASK STARTER-EVENT-1 — Hoàn tất
- Items done: STEP A, STEP 0, ITEM 1 (types/sanitizers/`starterEvent.ts`), ITEM 2 (hook `grantStarterEventPack` khi mở khóa GEAR), ITEM 3 (`redeemCard` + Kho đồ `"Thẻ"`), ITEM 4 (Admin `"Sự kiện tân thủ"`), TESTS.
- Files changed: `src/types/game.ts`, `src/engine/starterEvent.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/WarehouseView.tsx`, `src/components/admin/StarterEventAdminBlock.tsx`, `src/components/AdminPanel.tsx`, `src/engine/__tests__/starterEvent.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/STARTER-EVENT-1.{md,progress.md,report.md}`.
- Hook sites used: `createFreshCampaignState` (`src/engine/migration.ts` cho save mới / `startCampaign` / `resetCampaign` / `applyMapPack`), `buyGear`, và `adminUnlockAllGears` (`src/store/useGameStore.ts`) — KHÔNG tự cấp trong `migrateSaveData` (save cũ giữ nguyên, không có thẻ).
- Default pack totals: 250.000 credit (`card_credit_50000` x5), 50.000 EXP (`card_exp_10000` x5), voucher credit 1.000.000 (`voucher_credit` 100.000 x10), voucher EXP 1.000.000 (`voucher_exp` 100.000 x10).
- Tests & check: `starterEvent.test.tsx` (5/5 pass) + 5 file liên quan (`starter.test.ts`, `st1Ui.test.tsx`, `warehouseViewW1b1.test.tsx`, `vouchersA.test.tsx`, `vouchersB.test.tsx`, 24/24 pass) + `npx tsc --noEmit` (0 lỗi).
- Not checked: full vitest suite, production build, và giao diện trên trình duyệt thật (layout 360px/desktop).
CHƯA chạy trình duyệt thật
