# TURN-LV2 Progress

- [x] ITEM 1: Remove side icon & acting-row `[TA]`/side tag across all `TurnQueueBar` variants (default, phone, sidebar)
- [x] ITEM 2: Add `isLeader?: boolean` to `LevelBadge`, apply side border/bg tint (`emerald` leader, `sky` ally, `rose` enemy), keep text colors, pass `isLeader` from `TurnQueueBar`
- [x] TESTS: Add at most 4 small tests covering items (1)–(4) (update old `turnLevelBadge` assertions only if they break)
- [x] CHECKS: Run related test files (`--reporter=dot`) + `npx tsc --noEmit`, update `docs/CODEMAP.md`, write & print `docs/tasks/TURN-LV2.report.md`
