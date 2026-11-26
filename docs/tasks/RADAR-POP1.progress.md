# TASK RADAR-POP1 Progress

- [x] Đọc `docs/CODEMAP.md` & lưu `docs/tasks/RADAR-POP1.md`
- [x] ITEM 1: Animation số nổi trên `BattleRadarView.tsx` (bắt đầu tại tâm icon, cỡ = `radarPopupStartScalePct%` cỡ cuối, bay lên vị trí nhãn trong `cardPopupFlightMs` bằng CSS keyframes + biến CSS, giữ nguyên hàng đợi 600ms & overflow clamp)
- [x] ITEM 2: Cỡ cuối theo số tàu sống trên radar (`<= radarPopupBigMaxUnits` -> `radarPopupSmallScalePct%` else `radarPopupLargeScalePct%`), origin giữa-đáy, không đổi slot 18px / collision
- [x] ITEM 3: 4 cấu hình `radarPopupStartScalePct`, `radarPopupSmallScalePct`, `radarPopupLargeScalePct`, `radarPopupBigMaxUnits` trong `types/game.ts`, `migration.ts`, `useGameStore.ts`, `AdminPanel.tsx`, `vi.ts`, `en.ts`, không bump `CURRENT_SAVE_VERSION`
- [x] ITEM 4: Giữ nguyên `shouldSkipRadarFloatingLabels`, `vfxConfig.showFloatingNumbers`, và reduced motion (không bay, chỉ mờ vào tại slot với cỡ cuối)
- [x] Viết 4 test nhỏ (`src/components/__tests__/radarPopupFlight1.test.tsx`) + chạy `tsc --noEmit` & related tests (`--reporter=dot`), cập nhật `docs/CODEMAP.md` & `docs/tasks/RADAR-POP1.report.md`
