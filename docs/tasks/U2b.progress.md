# TASK U2b — Progress Checklist

- [x] STEP A — Save prompt verbatim to `docs/tasks/U2b.md`, check `docs/CODEMAP.md`, grep target symbols
- [x] ITEM 1 — Create `src/components/Notice.tsx` (`useNoticeCountdown` + `Notice`), add `noticeDurationSec` to `AdminConfig` + `src/engine/migration.ts` sanitizer/default + `AdminPanel.tsx` balance field + `vi.ts`/`en.ts` strings
- [x] ITEM 2 — Integrate `Notice` in `GearView.tsx` single-slot banner above the item grid, replace the three legacy banners + remove 5000ms timer, preserve testids and undo callbacks
- [x] TESTS & CHECKS & REPORT — Add Notice/GearView/AdminConfig tests, update `docs/CODEMAP.md`, run full `npx vitest run`, `lint_applet` (`tsc --noEmit`), and `npm run build`, write & print `docs/tasks/U2b.report.md`
