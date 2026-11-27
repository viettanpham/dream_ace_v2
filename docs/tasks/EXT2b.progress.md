# TASK EXT2b Progress

- [x] Đọc `docs/CODEMAP.md` & lưu `docs/tasks/EXT2b.md`
- [x] ITEM 1: `adminConfig.moduleDrop` (types, sanitize & defaults trong `migration.ts` + `useGameStore.ts`, KHÔNG bump save) + bỏ `BALANCE_CONFIG.moduleDropConfig` cũ không dùng
- [x] ITEM 2: Rơi mô-đun trong `rollBattleItemDrops` (`src/engine/equipment.ts` + mở rộng `itemLevels.ts` cho `'module'`), tối đa 1 mô-đun/trận sau các roll đồ thường cũ
- [x] ITEM 3: Bán mô-đun trong `generateShopStock` / `generateCategorizedShopStock` (`src/engine/shop.ts`, `src/engine/equipment.ts`, `useGameStore.ts`), giá `computeModulePrice`, kiểm tra `ShopScreen.tsx` listing `'module'`
- [x] ITEM 4: Admin CP `admin-module-drop-section` (`src/components/ModuleDropAdminBlock.tsx` mount trong `AdminPanel.tsx`, mẫu draft + Áp dụng/Enter + Mặc định) + `vi.ts`/`en.ts`
- [x] Viết 5 test nhỏ (`moduleDropExt2b.test.ts`), chạy `tsc --noEmit` + related tests (`--reporter=dot`), cập nhật `docs/CODEMAP.md` & `docs/tasks/EXT2b.report.md`
