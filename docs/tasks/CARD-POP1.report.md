# BÁO CÁO — CARD-POP1 + STATUS-POP1

## 1. Đã hoàn thành
- **ITEM 1 (`BattleScreen.tsx`, `BattleUnitCard.tsx`)**: Bỏ `suppressPopups` và chú thích cũ; thẻ luôn hiển thị số bay kể cả khi Action Stage (`showActionStage`) bật.
- **ITEM 2 (`src/utils/cardPopupQueue.ts`, `BattleUnitCard.tsx`, `src/index.css`)**:
  - Hàm thuần `pickCardPopupStartPoint` & `syncCardPopupQueue`/`advanceCardPopupQueue`: chọn điểm xuất phát ngẫu nhiên trên chu vi thẻ thụt vào 9px (`>= 8px`, sát thương lấy 4 cạnh, hồi HP/khiên/SP và buff/debuff lấy cạnh trên/dưới), bay về giữa thẻ rồi scale-pop và mờ dần.
  - Màu theo `getPopupColor` + tone (hổ phách cho `SP`, mũi tên `↑`/`↓` cho buff/debuff); hàng đợi theo thẻ (số đầu hiện ngay, số sau giãn cách `cardPopupStaggerMs`, tối đa `cardPopupMaxConcurrent`, gộp/bỏ số cũ khi hàng đợi `> 8` hoặc `shouldSkipRadarFloatingLabels(battleSpeed)`); hỗ trợ `effectsMode` (`full`/`compact`/`off`) và reduced motion.
- **ITEM 3 (`AdminPanel.tsx`, `src/types/game.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**: Thêm 3 cấu hình `cardPopupStaggerMs` (mặc định `100`), `cardPopupFlightMs` (mặc định `200`), `cardPopupMaxConcurrent` (mặc định `4`) kèm sanitize và i18n `vi`/`en`, không bump `CURRENT_SAVE_VERSION` (`13`).
- **ITEM 4 (`FixedStatusArea.tsx`, `BottomSheet.tsx`)**: Portal popup `"Hiệu ứng đang hoạt động"` desktop và `BottomSheet` phone trực tiếp ra `document.body` (chặn event bubble về thẻ), giữ `detailOpen` và DOM dialog/keys ổn định qua các battle tick/auto-play ở thẻ, sidebar, player bar và status board.
- **Lưu ý test cũ**: Không sửa 4 test cũ còn giữ assertion trước CARD-POP1/STATUS-POP1 (`g4bSupportFx.test.tsx`, `g4bSActionStage.test.tsx`, `statusChipsG4a1.test.tsx`, `statusBoardFullChips.test.tsx`, `battleSidebarStatusSb1.test.tsx` đoạn popover).

## 2. File thay đổi
- Mới: `src/utils/cardPopupQueue.ts`, `src/components/__tests__/cardPopStatusPop1.test.tsx`, `docs/tasks/CARD-POP1.md`, `docs/tasks/CARD-POP1.progress.md`, `docs/tasks/CARD-POP1.report.md`
- Sửa: `src/components/BattleScreen.tsx`, `src/components/BattleUnitCard.tsx`, `src/components/FixedStatusArea.tsx`, `src/components/BottomSheet.tsx`, `src/components/AdminPanel.tsx`, `src/types/game.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/index.css`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `docs/CODEMAP.md`

## 3. Kiểm thử
`npx tsc --noEmit` PASS; `npx vitest run --reporter=dot src/components/__tests__/cardPopStatusPop1.test.tsx src/components/__tests__/battleCardG4a2c.test.tsx` PASS (2 files, 9/9 tests).

## 4. Trạng thái trình duyệt
**CHƯA chạy trình duyệt thật (chưa xem số bay trên card thật, điện thoại 360/390 và desktop).**
