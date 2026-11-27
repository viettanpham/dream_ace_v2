# TURN-LV2 Report
- Hoàn thành: ITEM 1 (xóa `TeamShapeIcon` và tag `[TA]`/`[ĐỊCH]`/`[BOSS]` khỏi `TurnQueueBar` ở cả 3 variant default/phone/sidebar + popover), ITEM 2 (`LevelBadge` thêm `isLeader?: boolean`, viền/nền xanh lá leader, xanh dương đồng minh, đỏ địch, giữ nguyên màu chữ level-con/ally/leader và `data-side`).
- Files thay đổi: `src/components/LevelBadge.tsx`, `src/components/TurnQueueBar.tsx`, `src/components/__tests__/turnLevelBadge.test.tsx`, `src/components/__tests__/battleG3b.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/TURN-LV2.{md,progress.md,report.md}`.
- Ghi chú cập nhật test cũ: `battleG3b.test.tsx` đổi assertion `[data-team-shape]` ở sidebar row sang kiểm tra không còn `[data-team-shape]` và có `[data-testid="level-badge"]`.
- Kiểm thử: `npx vitest run src/components/__tests__/turnLevelBadge.test.tsx src/components/__tests__/battleG3b.test.tsx src/components/__tests__/TurnQueueBar.test.tsx --reporter=dot` PASS (3 files, 20/20 tests); `npx tsc --noEmit` PASS (0 lỗi). Full vitest & build không chạy theo scope.
- Chưa kiểm tra trên trình duyệt thật: phone 360px, sidebar.
