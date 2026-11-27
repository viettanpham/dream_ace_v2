# TASK VOUCHER-a Progress

- [x] STEP A & STEP 0: Save `docs/tasks/VOUCHER-a.md` & `docs/tasks/VOUCHER-a.progress.md`, read `docs/CODEMAP.md` & locate STEP 0 symbols
- [x] ITEM 1: `src/data/vouchers.json` + `src/data/vouchers.ts` (20 system rows, helpers `getVoucherPriceWp`, `getVoucherWeights`, `getVoucherDefaultMaxStock`, sanitizers), `PilotAccount.vouchers`, `AdminConfig.vouchers`, save v14 -> v15 chained migration in `migration.ts`
- [x] ITEM 2: `VoucherShopListing`, `rollVoucherShopStockWp()`, store `voucherShopStockWp` + re-rolls + `buyVoucher(id, qty)`, WP shop UI `"Voucher"` section with confirm purchase + `vi.ts`/`en.ts` strings
- [x] ITEM 3: `src/components/admin/VoucherAdminBlock.tsx` + `<AdminSection>` `"Voucher"` in `AdminPanel.tsx` + `vi.ts`/`en.ts` strings
- [x] TESTS & CHECKS & REPORT: max 5 tests + related tests (`--reporter=dot`) + `tsc --noEmit`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/VOUCHER-a.report.md` (<= 12 lines)
