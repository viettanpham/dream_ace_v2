# TASK ADM-CAP Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/ADM-CAP.md`, create `docs/tasks/ADM-CAP.progress.md`
- [x] Read targeted files (`CODEMAP.md`, `AdminPanel.tsx` capacity blocks & notice style, `sanitizeBoxCapacity` / `sanitizeWarehouseCapacity`, `vi.ts`/`en.ts`, grep related tests)
- [x] ITEM 1: Local draft strings + "Áp dụng" buttons (`admin-box-capacity-apply` / `admin-warehouse-capacity-apply`) + Enter apply + `"Cho phép {min}-{max}"` hint + `"Đã áp dụng: {n}"` 3s feedback + `vi.ts`/`en.ts` strings
- [x] ITEM 2: Non-destructive lower-than-used over-capacity warning hint next to Áp dụng (`"Hòm đồ đang có {used}, vượt sức chứa mới"` / Kho đồ equivalent)
- [x] Write `<= 3` small tests (update any existing test assertion only if it expected immediate write on typing)
- [x] Run `npx tsc --noEmit` first, then ONLY related test files (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md` if needed, tick checklist, write and print `docs/tasks/ADM-CAP.report.md` (<= 12 lines)
