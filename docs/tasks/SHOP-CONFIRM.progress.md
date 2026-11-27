# TASK SHOP-CONFIRM Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/SHOP-CONFIRM.md`, create `docs/tasks/SHOP-CONFIRM.progress.md`
- [x] Read `docs/CODEMAP.md`, `SupplyShopPanel.tsx`, `BottomSheet.tsx`, `SupplyLoadoutBar.tsx` exports, and grep `CURRENT_SAVE_VERSION` & `credits`
- [x] ITEM 0: Update `expect(CURRENT_SAVE_VERSION).toBe(12)` -> `.toBeGreaterThanOrEqual(12)` in the 9 listed test files; run `statusChipG4aC1` and `statusChipsG4a1`
- [x] ITEM 1: Create `src/components/SupplyTradeConfirm.tsx` using `BottomSheet` (`size`), rows, insufficient-credits guard, Esc/backdrop cancel + add `vi.ts`/`en.ts` strings
- [x] ITEM 2: Wire `SupplyShopPanel.tsx` x1/x5/x10 & sell buttons to open `SupplyTradeConfirm`, show total price/credits earned on buttons, keep existing testIds/disabled reasons, add `supply-confirm-dialog`/`supply-confirm-total`/`supply-confirm-ok`
- [x] Tests: write at most 4 small tests covering open w/o side-effect, confirm buys once with total, cancel/Esc no-op, sell open + confirm
- [x] Checks: `npx tsc --noEmit` + related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/SHOP-CONFIRM.report.md` (<= 12 lines)
