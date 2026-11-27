# BÁO CÁO TASK ENRAGE-2b
- Đã xong: ITEM 1 (đổi crit thừa >100% thành sát thương crit theo `critOverflowRatio` mặc định 2, clamp 0..10 + Admin input & ví dụ trực tiếp) và ITEM 2 (`latestPhase`, `totalStacks`, chip header gọn ở 3 chế độ `TurnQueueBar`, `flex-wrap`, click mở `BottomSheet` chi tiết 3 phase + vòng kế tiếp).
- Files đã sửa: `src/types/game.ts`, `src/data/balance.ts`, `src/engine/enrage.ts`, `src/engine/combat.ts`, `src/components/admin/EnrageAdminBlock.tsx`, `src/components/TurnQueueBar.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/engine/__tests__/enrageE2.test.ts`, `src/components/__tests__/TurnQueueBar.test.tsx`, `src/engine/__tests__/enrageE2b.test.tsx`, `docs/CODEMAP.md`.
- Chip theo vòng: vòng 22 `Cuồng nộ x1 · -5%` (`BS05`); vòng 55 `Frenzy x10 · -40% · +20%` (`BS05`, `BF02`); vòng 120 `Berserker x28 · -50% · +150% · +9% · +30%` (`BS05`, `BF02`, `SS04`, `SS05`).
- Kiểm thử PASS: `vitest` (`enrageE2b.test.tsx` 5/5, `enrageE2.test.ts` 5/5, `TurnQueueBar.test.tsx` 3/3 = 13/13 PASS), `tsc --noEmit` (`lint_applet` 0 lỗi), kiểm tra i18n `vi.ts`/`en.ts` khớp 100% (`diff: [] []`).
- Lưu ý: `CURRENT_SAVE_VERSION` giữ nguyên (`14`), Firebase không bật, không chạy full vitest/production build.
- NOT VERIFIED: Chưa kiểm tra trực quan trên trình duyệt thật (wrap chip header ở màn hình phone `360px`).
- Bước tiếp theo: Kiểm tra giao diện trình duyệt ở viewport `360px` nếu cần nghiệm thu thị giác, hoặc chuyển sang task kế tiếp.
