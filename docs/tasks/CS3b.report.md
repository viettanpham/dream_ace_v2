# TASK CS3b Report
- ITEM 1 done: added 4th `"Vật tư"` tab (`shop-tab-supply`, `grid-cols-4` phone bar) + `<SupplyShopPanel />` with family-grouped buy rows (`[x1][x5][x10]`, disabled reasons, dimmed sold-out, single-line empty state, notice feedback) and `"Bán lại"` sell section (`[Bán 1][Bán 5]`).
- ITEM 2 done: added `"Cửa hàng vật tư"` block next to `shieldRegen` in `AdminPanel.tsx` (+51 lines: 4 clamped inputs `1..12` / `1..99` fixing `min > max`, helper text, `"Làm mới kho ngay"`).
- Files changed: `src/components/SupplyShopPanel.tsx` (new, 384L), `src/components/ShopScreen.tsx`, `src/components/AdminPanel.tsx`, `src/store/useGameStore.ts` (`ShopSubTab`), `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/__tests__/supplyShopUiCs3b.test.tsx`, `docs/CODEMAP.md`.
- `ShopScreen.tsx` lines: 1934 -> 1951 (+17 lines). `AdminPanel.tsx` lines: 2509 -> 2560 (+51 lines).
- Checks: `npx tsc --noEmit` passed; `vitest` 5 files / 31 tests passed (`supplyShopUiCs3b`, `shopAndIcons`, `supplyShopCs3a`, `shieldRegen`, `noticeBannerU2b`).
- Manual check: NOT checked in a real browser.
