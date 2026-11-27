# TASK POP-ICON2 Progress

- [x] STEP A: Save `docs/tasks/POP-ICON2.md` & `docs/tasks/POP-ICON2.progress.md`, inspect targeted files and grep popup push sites / iconCatalog / @material-symbols/font-400
- [x] ITEM 1: Icons (`water_drop` SP everywhere incl. SS02/BF11, DT03 `bubble_chart`, verify `@material-symbols/font-400` glyphs incl. `fort`/`package_2`/`check_circle`/`cancel`, supply marker)
- [x] ITEM 2: Formatter, VI/EN `popup.*` keys, leading+trailing & both-side icons in `cardPopupQueue.ts` and `BattleUnitCard.tsx` (plus `BattleRadarView.tsx` if shared)
- [x] ITEM 3: `estimatePopupBoxSize` counts both icons (+22px each) so longest text fits inside 160px card
- [x] TESTS & CHECKS & REPORT: <= 5 tests, related tests (`--reporter=dot`) + `tsc --noEmit` + `lint_applet`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/POP-ICON2.report.md` (<= 15 lines)
