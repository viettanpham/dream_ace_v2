# TASK ENRAGE-2 Progress

- [x] STEP A: Save `docs/tasks/ENRAGE-2.md` & `docs/tasks/ENRAGE-2.progress.md`, grep `enrage` across `src/` & inspect targeted file ranges
- [x] ITEM 1: `src/engine/enrage.ts`, types, defaults, sanitization (`migration.ts`, `inventory.ts`), remove `getEnemyEnrageBonusPct` / `BALANCE_CONFIG.enrage*` / `enrageStartRound` / `enrageStepPct`
- [x] ITEM 2: Combat integration (`combat.ts` DEF/damage/crit/critMult + 1st-time phase activation log lines + i18n keys)
- [x] ITEM 3: UI (`TurnQueueBar.tsx`, `BattleStatsModal.tsx`, `BattleScreen.tsx`, `AdminPanel.tsx` 3 phase cards + live example + test-round summary + vi/en strings)
- [x] TESTS & CHECKS & REPORT: `enrageE2.test.ts` (5 tests) + update existing enrage tests if needed, run targeted tests + `tsc --noEmit` + `lint_applet`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/ENRAGE-2.report.md` (<= 12 lines)
