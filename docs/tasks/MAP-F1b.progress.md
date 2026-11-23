# TASK MAP-F1b — Progress Checklist

- [x] STEP A — Save prompt verbatim to `docs/tasks/MAP-F1b.md`, read `docs/CODEMAP.md`, inspect allowed files & grep symbols
- [x] ITEM 1 — Wire `frontline.ts` across engine & store: (a) deprecate `getNextSectorId`, make `unlockedSectorIds` cumulative visible-node history on battle finish/mapWorld/migration load; (b) `launchBattleForSector` refusal + reason toast while `selectSector` allows any visible node; (c) auto-repeat pre-battle check + `'node_not_contested'` `AutoStopReason` + vi/en strings; (d) `acceptBaseBonusMission` targets nearest contested node by lane hops (tie-break lower `baseLevel`) else `'no_target_sector'`
- [x] ITEM 2 — Update `MapView.tsx` deploy button: disabled with reason `title`/subtext when no battle option is allowed, `pickDefaultBattle` click otherwise, preserving layout
- [x] TESTS & CHECKS & REPORT — Add comprehensive MAP-F1b tests, update `docs/CODEMAP.md`, run full `npx vitest run` ONCE, `lint_applet`, and production build, write & print `docs/tasks/MAP-F1b.report.md`
