# TASK FORM-ROW-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/FORM-ROW-1.md`, create `docs/tasks/FORM-ROW-1.progress.md`
- [x] ITEM 1: Update `DEFAULT_FORMATION_CONFIG.rowCapacities` to 8-8-8 and its doc comment (`src/data/formationConfig.ts`)
- [x] ITEM 2: Update `CLASS_FORMATION_PREFERENCES` (`siege` front, `striker`/`interceptor` middle, `support` back, deterministic without `flexPair`, doc comment)
- [x] ITEM 3: Audit & update all `3/3/2` / old-preference assumptions (Admin live examples, i18n, NPC placement, migration check, minimal fixes to existing tests)
- [x] TESTS: <= 3 small tests in `src/engine/__tests__/formRow1.test.ts` + related vitest (`--reporter=dot`) & `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/FORM-ROW-1.report.md` (<= 12 lines)
