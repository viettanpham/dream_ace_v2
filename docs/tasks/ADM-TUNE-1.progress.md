# TASK ADM-TUNE-1 Progress

- [x] STEP A: Check CODEMAP.md, save ADM-TUNE-1.md & progress checklist
- [x] ITEM 1: skillCardPriceMult default 10, max 999999999 across balance.ts, SkillTiersAdminBlock.tsx, store/migration, and stale test assertions
- [x] ITEM 2: DEFAULT_FORMATION_CONFIG rowCapacities 5/5/5, verify formation.ts & Admin reset & 8-unit auto-arrange, fix stale test assertions
- [x] ITEM 3: Read-only cap audit of Admin CP number inputs & sanitizers -> docs/tasks/ADM-TUNE-1.audit.md
- [x] TESTS & CHECKS: Add <= 3 tests (admTune1.test.ts), run related vitest --reporter=dot + npx tsc --noEmit
- [x] REPORT: Update docs/CODEMAP.md, write docs/tasks/ADM-TUNE-1.report.md (<= 10 lines)
