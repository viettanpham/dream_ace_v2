# TASK PIRATE-1a Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/PIRATE-1a.md`, create `docs/tasks/PIRATE-1a.progress.md`
- [x] Read targeted files (`CODEMAP.md`, `battleKinds.ts`, `frontline.ts`, `useGameStore.ts` ranges, `mapWorld.ts` range, `migration.ts` ranges, `radarCombatRad1a2.test.ts`)
- [x] ITEM 0: Fix `radarCombatRad1a2` test 3 expectation for C1 T3 radar level (Lv25)
- [x] ITEM 1: `AdminConfig.pirates` + `PilotAccount.pirateIncidents` types, defaults, and sanitizers in `src/engine/migration.ts`
- [x] ITEM 2: Pure `src/engine/pirates.ts`, `getBattleOptions` event option + `registerBattleSourceProvider('event', ...)`, month/load/battle spawn & win cleanup, `vi.ts`/`en.ts` keys, Result dialog "Cướp biển" label
- [x] Tests: `<= 5` small tests in `src/engine/__tests__/pirates.test.ts`
- [x] Checks: `npx tsc --noEmit` + related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/PIRATE-1a.report.md` (<= 12 lines)
