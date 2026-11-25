# TASK STATUS-1 Report
- Đã xong: ITEM 1 (`RadarStatusBoard` tái sử dụng `FixedStatusArea` + card-mode `StatusChip` `showLabel={true}`, xuống hàng tự động, không tạo component chip/popover mới), ITEM 2 (chiều cao mỗi hàng `Ta | Địch` lấy max số hàng chip của hàng đó, cap tối đa 2 hàng, `>= 3` bật cuộn trong + `+N`, bấm chip mở popover/BottomSheet sẵn có, bấm tên chọn đơn vị, giữ nguyên collapse/phone stacked/không đổi radar markers, card mode, sidebar).
- Files sửa: `src/components/RadarStatusBoard.tsx`, `src/components/__tests__/statusBoardFullChips.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/STATUS-1.md`, `docs/tasks/STATUS-1.progress.md`, `docs/tasks/STATUS-1.report.md`.
- Kiểm thử: PASS `npx tsc --noEmit` + `statusBoardFullChips.test.tsx` (4/4) + `battleCardG4a2c.test.tsx` (100%); `statusChipsG4a1` & `statusChipG4aC1` chỉ fail 2 assert cũ `CURRENT_SAVE_VERSION === 12` (đã là 13 từ C1, giữ nguyên test cũ theo rule).
NOT checked in a real browser (phone board).
