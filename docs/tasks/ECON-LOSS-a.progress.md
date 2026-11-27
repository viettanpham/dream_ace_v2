# TASK ECON-LOSS-a Progress

- [x] STEP A: Save `docs/tasks/ECON-LOSS-a.md` & `docs/tasks/ECON-LOSS-a.progress.md`, read `docs/CODEMAP.md` & grep symbols
- [x] ITEM 1: `BattleRewardsConfig` in `types/game.ts`, `balance.ts`, `migration.ts`, `combat.ts` (`calculateBattleRewards`), `useGameStore.ts` (`finalizeBattleOutcome`), `BattleResultDialog.tsx`, update old tests referencing `defeatDestroyedRatio`/`defeatConsolationRatio` + `vi.ts`/`en.ts`
- [x] ITEM 2: Create `src/components/admin/BattleRewardsAdminBlock.tsx`, mount in `AdminPanel.tsx` battle tab near `enrage` inside collapsed `AdminSection` `"Thưởng trận"`, add `vi.ts`/`en.ts` strings
- [x] TESTS & CHECKS & REPORT: max 5 tests + related tests + `tsc --noEmit`/`lint_applet`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/ECON-LOSS-a.report.md` (<= 12 lines)
