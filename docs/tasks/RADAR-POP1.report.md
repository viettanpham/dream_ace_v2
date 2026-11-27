# BÁO CÁO — RADAR-POP1

## 1. Đã hoàn thành
- **ITEM 1 (`BattleRadarView.tsx`, `src/index.css`)**: Nhãn nổi trên `radar-popups-layer` bắt đầu tại tâm icon (`--radar-pop-dy = (ringOuterRadius + 12) / vh * 100%`, `--radar-pop-top`, `opacity: 0.4`, `--radar-pop-start-scale`), bay lên vị trí slot hiện tại trong `cardPopupFlightMs` (đọc chung từ `adminConfig`, mặc định `200ms`) bằng `@keyframes radar-popup-flight` (`forwards`) rồi đứng yên hết ~600ms hàng đợi cũ; giữ nguyên `overflow-hidden` và clamp `leftPct`/`topPct`.
- **ITEM 2 (`src/utils/radarPopup.ts`, `BattleRadarView.tsx`)**: Tính cỡ cuối theo số tàu sống (`<= radarPopupBigMaxUnits` -> `radarPopupSmallScalePct%` mặc định `125%`, lớn hơn -> `radarPopupLargeScalePct%` mặc định `100%`) qua `transformOrigin: 'center bottom'` và `--radar-pop-end-scale`, giữ nguyên slot `18px`.
- **ITEM 3 (`src/types/game.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/components/AdminPanel.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**: Thêm 4 cấu hình `radarPopupStartScalePct` (60, 20–300), `radarPopupSmallScalePct` (125, 20–300), `radarPopupLargeScalePct` (100, 20–300), `radarPopupBigMaxUnits` (8, `>= 1`) vào cùng khối `admin-card-popup-section`, có sanitize + fallback save cũ, không bump `CURRENT_SAVE_VERSION` (`13`).
- **ITEM 4 (`BattleRadarView.tsx`, `src/index.css`)**: Giữ nguyên `shouldSkipRadarFloatingLabels` (>= 15x), `vfxConfig.showFloatingNumbers`, và `reducedMotion` (dùng `.anim-radar-popup-reduced` mờ vào tại slot với cỡ cuối, không có class bay). Không đụng `BattleUnitCard`, `BattleVfxOverlay`, layout radar.

## 2. File thay đổi
- Mới: `src/utils/radarPopup.ts`, `src/components/__tests__/radarPopupFlight1.test.tsx`, `docs/tasks/RADAR-POP1.md`, `docs/tasks/RADAR-POP1.progress.md`, `docs/tasks/RADAR-POP1.report.md`
- Sửa: `src/components/BattleRadarView.tsx`, `src/components/AdminPanel.tsx`, `src/types/game.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/index.css`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `docs/CODEMAP.md`

## 3. Kiểm thử
`npx tsc --noEmit` & `npx vitest run --reporter=dot src/components/__tests__/radarPopupFlight1.test.tsx src/components/__tests__/battleRadarDeclutterG4a3a.test.tsx` PASS (2 files, 10/10 tests); `battleFxFix.test.tsx` chỉ còn 2 fail sẵn ở bài `performPlayerAction('attack')` do prestage gate (`PREP-1a`), test `radar-popups-layer` bên trong PASS.

## 4. Trạng thái trình duyệt
**CHƯA chạy trình duyệt thật (chưa xem animation trên radar thật 4v4 và 8v8 vs trận đông).**
