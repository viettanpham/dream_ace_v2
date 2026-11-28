# TASK FORM-ROW-1 Report
- Items done: ITEM 1 (`DEFAULT_FORMATION_CONFIG` 8-8-8 + doc comment), ITEM 2 (`CLASS_FORMATION_PREFERENCES` siege->front, striker/interceptor->middle, support->back, deterministic without `flexPair`), ITEM 3 (engine/Admin/i18n/migration audit + minimal test updates), TESTS (3 new tests).
- Files changed: `src/data/formationConfig.ts`, `src/engine/formation.ts`, `src/engine/combat.ts`, `src/engine/__tests__/formRow1.test.ts`, `src/engine/__tests__/formation.test.ts`, `src/engine/__tests__/formationLanes.test.ts`, `src/components/__tests__/formationEditor.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/FORM-ROW-1.{md,progress.md,report.md}`.
- Fixed old tests: `src/engine/__tests__/formation.test.ts`, `src/engine/__tests__/formationLanes.test.ts`, `src/components/__tests__/formationEditor.test.tsx`.
- Test result: `vitest run` 5 files / 31 tests passed; `npx tsc --noEmit` passed (0 errors).
- Not checked: full test suite, production build, and live browser interaction.
CHƯA chạy trình duyệt thật
