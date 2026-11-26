# TASK CARD-POP1 + STATUS-POP1 Progress

- [x] Đọc `docs/CODEMAP.md` & lưu `docs/tasks/CARD-POP1.md`
- [x] ITEM 1: Bỏ `suppressPopups` khi Action Stage bật (`BattleScreen.tsx`, `BattleUnitCard.tsx`)
- [x] ITEM 2: Số bay kiểu mới trên `BattleUnitCard.tsx` + pure logic `src/utils/cardPopupQueue.ts` (chu vi ngẫu nhiên thụt 8-10px -> giữa thẻ, hàng đợi stagger/maxConcurrent, tốc độ cao/hàng đợi >8, `effectsMode`, reduced motion)
- [x] ITEM 3: Admin CP + config + sanitize + i18n (`cardPopupStaggerMs`, `cardPopupFlightMs`, `cardPopupMaxConcurrent`), không bump save version
- [x] ITEM 4: `FixedStatusArea.tsx` portal `createPortal(..., document.body)` + giữ `detailOpen` ổn định khi tick/auto-play
- [x] Viết 5 test nhỏ (`src/components/__tests__/cardPopStatusPop1.test.tsx`), không sửa test cũ, chạy `tsc --noEmit` + related tests (`--reporter=dot`), cập nhật `docs/CODEMAP.md` & `docs/tasks/CARD-POP1.report.md`
