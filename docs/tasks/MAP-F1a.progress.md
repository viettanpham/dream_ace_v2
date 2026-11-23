# TASK MAP-F1a — Progress Checklist

- [x] STEP A — Save prompt verbatim to `docs/tasks/MAP-F1a.md`, read `docs/CODEMAP.md`, inspect allowed files & grep symbols
- [x] ITEM 1 — Add `adminConfig.ignoreFrontline` (optional boolean + sanitizer default `false`), i18n reason/admin keys in `vi.ts` & `en.ts`, and pure `src/engine/frontline.ts` (`neighbours`, `isContested`, `isAlliedFrontline`, `isVisible`, `noEnemyLeft`, `getBattleOptions`, `pickDefaultBattle`, `visibleNodeIds`)
- [x] ITEM 2 — Add `"Bỏ qua luật tiền tuyến (test)"` / `"Ignore frontline rule (test)"` checkbox in `src/components/AdminPanel.tsx` next to base/sector admin tools + generate fresh-save & captured-`border_outpost` option tables
- [x] TESTS & CHECKS & REPORT — Write `src/engine/__tests__/frontline.test.ts`, update `docs/CODEMAP.md`, run related tests + `lint_applet` (`tsc --noEmit`), write & print `docs/tasks/MAP-F1a.report.md`
