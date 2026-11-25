# TASK MAXLV-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/MAXLV-1.md`, create `docs/tasks/MAXLV-1.progress.md`
- [x] STEP 0: Read-only audit of all `BALANCE_CONFIG.maxLevel` usages and verify EXP/stat growth formulas work above 50
- [x] ITEM 1: Add `getMaxLevel()` / `setRuntimeMaxLevel(n)` in `src/data/balance.ts` and replace runtime uses (preserving existing levels above max)
- [x] ITEM 2: Add `adminConfig.maxLevel` (20–100) in `types/game.ts`, `migration.ts`, `useGameStore.ts`, `AdminPanel.tsx`, and `vi.ts`/`en.ts`
- [x] TESTS: Add <= 4 small tests + run related tests (`--reporter=dot`) & `npx tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/MAXLV-1.report.md` (<= 12 lines)
