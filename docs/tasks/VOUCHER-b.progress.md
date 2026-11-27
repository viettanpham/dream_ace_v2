# TASK VOUCHER-b Progress

- [x] STEP A & STEP 0: Save `docs/tasks/VOUCHER-b.md` & `docs/tasks/VOUCHER-b.progress.md`, locate battle summary, penalty fields, `BattleResultDialog.tsx`, `WarehouseView.tsx`, `statusDisplayPrefs.ts`
- [x] ITEM 1: Pure helpers in `src/engine/battlePenalty.ts` (`pickVouchersSmallestSufficient`, `applyVoucherRefund`) + summary voucher fields + store action `redeemVouchers`
- [x] ITEM 2: "Dùng voucher?" dialog before defeat/retreat `BattleResultDialog` + result dialog voucher refund line + retreat repair fee visibility + `vi.ts`/`en.ts` strings
- [x] ITEM 3: `src/utils/voucherAutoPrefs.ts` + `WarehouseView.tsx` Voucher section (owned list + auto-redeem toggle) + auto-redeem wiring + `vi.ts`/`en.ts` strings
- [x] TESTS & CHECKS & REPORT: max 5 tests + related tests (`--reporter=dot`) + `tsc --noEmit`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/VOUCHER-b.report.md` (<= 12 lines)
