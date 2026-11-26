# ST-A2 Progress

- [x] STEP 0: Read-only audit (step2UsedSoFar passing, SimpleTacticsConfig defaults/sanitizer, custom-tactics chooseNextDecision hook)
- [x] ITEM 1: Pure `pickLidarCast(units, actor, params, rng)` rule (`src/engine/lidarAuto.ts` or `src/engine/combat.ts`)
- [x] ITEM 2: Wiring (NPC `chooseAiDecision`, player `performAutoPlayerTurn`, `SimpleTacticsConfig.lidarAuto` + sanitizer, `AutoTacticsModal` 3 controls + i18n, Admin verify)
- [x] TESTS: At most 5 small tests (`src/engine/__tests__/lidarAutoStA2.test.ts` / `.tsx`)
- [x] CHECKS: Related tests (`--reporter=dot`) + `npx tsc --noEmit` + `docs/CODEMAP.md` + `docs/tasks/ST-A2.report.md`
