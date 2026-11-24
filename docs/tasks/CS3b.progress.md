# TASK CS3b Progress

- [x] STEP A: Read `docs/CODEMAP.md`, record baseline line counts (`ShopScreen.tsx`: 1934, `AdminPanel.tsx`: 2509), save `docs/tasks/CS3b.md` & `docs/tasks/CS3b.progress.md`
- [x] Extend `ShopSubTab` in `src/store/useGameStore.ts` with `'supply'`
- [x] Add bilingual i18n keys to `src/i18n/vi.ts` and `src/i18n/en.ts`
- [x] Create `src/components/SupplyShopPanel.tsx` (buy grouped by family + disabled reasons + dimmed sold-out + empty single-line + sell section)
- [x] Wire 4th tab `"Vật tư"` (`data-testid="shop-tab-supply"`, `grid-cols-4` on phone) and `<SupplyShopPanel />` into `src/components/ShopScreen.tsx` (<= ~25 lines added)
- [x] Add `"Cửa hàng vật tư"` block next to `shieldRegen` in `src/components/AdminPanel.tsx` (<= ~60 lines added)
- [x] Add <= 5 targeted UI tests in `src/components/__tests__/supplyShopUiCs3b.test.tsx`
- [x] Run `npx tsc --noEmit` and related vitest suites (`--reporter=dot | tail -n 15`)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/CS3b.report.md` (<= 12 lines)
