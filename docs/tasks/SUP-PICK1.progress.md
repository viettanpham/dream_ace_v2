# TASK SUP-PICK1 Progress

- [x] Lưu prompt gốc vào `docs/tasks/SUP-PICK1.md` và tạo `docs/tasks/SUP-PICK1.progress.md`
- [x] Đọc `docs/CODEMAP.md`, `src/components/SupplyLoadoutBar.tsx`, `src/engine/supplies.ts`, `src/store/useGameStore.ts`
- [x] ITEM 1: Ẩn template trùng family với slot khác trong `SupplyLoadoutBar.tsx` + thêm chuỗi `'Không còn vật tư khác loại'` (`vi.ts`/`en.ts`)
- [x] ITEM 2: `setSupplyLoadout` từ chối `'family_duplicate'` không đổi loadout; giữ nguyên `sanitizeSupplyLoadout` không trim save cũ; không bump save version
- [x] Test tối thiểu (<= 3 tests) + cập nhật assertion cũ nếu cần + chạy `tsc` & test liên quan
- [x] Cập nhật `docs/CODEMAP.md` & `docs/tasks/SUP-PICK1.report.md`
