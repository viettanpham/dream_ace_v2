# TASK MAP-C2a Progress

- [x] STEP A: Save `docs/tasks/MAP-C2a.md` & `docs/tasks/MAP-C2a.progress.md`
- [x] ITEM 1: Engine + store (`AdminConfig.mapPack`, sanitizer via `validateMapPack`, in-place `SECTORS_CATALOG`/`MAP_LANES` refresh, `setActiveMapPack()`, `applyMapPack()` with world reset & guards)
- [x] ITEM 2: Admin CP "Bản đồ" block (`MapPackAdminBlock.tsx` inside `AdminSection`, stats/source, `[Xuất JSON]`, `[Nhập JSON]` + error display + confirm dialog, `[Khôi phục bản đồ gốc]`, `vi.ts`/`en.ts`)
- [x] TESTS & CHECKS & REPORT: max 5 tests + related tests (`--reporter=dot`) + `tsc --noEmit`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/MAP-C2a.report.md` (<= 12 lines)
