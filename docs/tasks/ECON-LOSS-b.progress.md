# TASK ECON-LOSS-b Progress

- [x] STEP A: Save `docs/tasks/ECON-LOSS-b.md` & `docs/tasks/ECON-LOSS-b.progress.md`, read `docs/CODEMAP.md` & grep symbols
- [x] ITEM 1: `BattlePenaltyConfig` in `types/game.ts`, defaults/sanitizer + `computeRepairFee()` + `computeRetreatPenalty()`, wire into `migration.ts` & `useGameStore.ts` (`finalizeBattleOutcome` -> retreat penalty -> repair fee -> SYSTEM logs), update `vi.ts`/`en.ts` + `combatLogFormat.ts`
- [x] ITEM 2: `BattleSummary` fields + `BattleResultDialog.tsx` lines, create `src/components/admin/BattlePenaltyAdminBlock.tsx` + mount in `AdminPanel.tsx` battle tab near `battle-rewards` inside collapsed `<AdminSection>` `"Thua & rút lui"`, add `vi.ts`/`en.ts` strings
- [x] TESTS & CHECKS & REPORT: max 5 tests + related tests (`--reporter=dot`) + `tsc --noEmit`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/ECON-LOSS-b.report.md` (<= 12 lines)
