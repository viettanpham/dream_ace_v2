# TASK ADM-CAP Report
- Hoàn thành: ITEM 1 (cả `admin-box-capacity-input` & `admin-warehouse-capacity-input` dùng local draft string, sync khi store đổi, nút `Áp dụng` `admin-box-capacity-apply` / `admin-warehouse-capacity-apply`, Enter để áp dụng, hint `"Cho phép {min}-{max}"` đỏ khi sai/ngoài khoảng, thông báo `"Đã áp dụng: {n}"` 3 giây, đủ chuỗi `vi.ts` + `en.ts`), ITEM 2 (giảm sức chứa thấp hơn số món hiện có không xóa đồ, hiện cảnh báo `"Hòm đồ/Kho đồ đang có {used}, vượt sức chứa mới"` cạnh nút Áp dụng).
- File thay đổi: `src/components/AdminCapacityField.tsx`, `src/components/AdminPanel.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/__tests__/adminCapacityAdmCap.test.tsx`, `docs/CODEMAP.md`.
- `AdminPanel.tsx` dòng trước/sau: `2561` → `2557` (-4 dòng; phần logic tách sang `AdminCapacityField.tsx`).
- Assertion test cũ thay đổi: Không sửa test cũ nào.
- Kiểm thử: `npx tsc --noEmit` PASS; 8 file test liên quan (`adminCapacityAdmCap`, `boxCapacity`, `warehouseAndClock`, `saveV10Migration`, `warehouseViewW1b1`, `warehouseQuickSellW1b2`, `noticeBannerU2b`, `shieldRegen`) PASS 44/44.
- Chưa kiểm tra: trong trình duyệt thực tế (`360px` visual check, full vitest, production build).
