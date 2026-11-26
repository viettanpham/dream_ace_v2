# TASK B2b Progress

- [x] Đọc `docs/CODEMAP.md` & lưu `docs/tasks/B2b.md`
- [x] ITEM 0: Cập nhật `src/engine/__tests__/moduleItemsExt2a1.test.ts` test (4) (`factor: 0`, bỏ 2 expect shop) & chạy riêng file này (5/5 PASS)
- [x] ITEM 1: Tạo `src/engine/fluxAuto.ts` + `FluxAutoConfig` & `SimpleTacticsConfig.fluxAuto` trong `src/types/game.ts`
- [x] ITEM 2: Nối `fluxAuto` vào `src/engine/tactics.ts` (presets + sanitize) & `src/store/useGameStore.ts` (`resolveMultiStepTurn`)
- [x] ITEM 3: Thêm section `auto-flux-section` vào `src/components/AutoTacticsModal.tsx` + `src/i18n/{vi,en}.ts`
- [x] TESTS & CHECKS: `fluxAutoB2b.test.ts` + UI test + related vitest (`--reporter=dot`) + `npx tsc --noEmit`, cập nhật `docs/CODEMAP.md` & `docs/tasks/B2b.report.md`
