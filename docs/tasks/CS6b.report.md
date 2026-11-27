Done: STEP A, ITEM 1 (`runNpcSupplyStep`, `battleLimitOverride` passthrough, shared `buildSupplyUseFeedback`), ITEM 2 (emergency resupply + `vi`/`en` log keys), TESTS (5).
Files: `src/engine/{npcSupply,supplies,supplyAi}.ts`, `src/store/useGameStore.ts`, `src/types/game.ts`, `src/i18n/{vi,en,index}.ts`, `src/utils/combatLogFormat.ts`, `src/engine/__tests__/npcSupplyUseCs6b.test.ts`, `docs/CODEMAP.md`.
Hook: `performAiTurn` in `src/store/useGameStore.ts` (lines 4238-4262) calls `runNpcSupplyStep` right before `resolveMultiStepTurn` (outside `playerIsCharging`) and carries forward `workingBattle` & `npcSupplyEvents`.
Checks: `npx tsc --noEmit` PASS; vitest 5 files / 29 tests PASS (`npcSupplyUseCs6b` 5, `npcSupplyCs6a` 5, `supplyAiCs4` 5, `suppliesBattleCs2` 5, `suppliesCs1` 9).
10 seeded Lv10 Standard assault (`border_outpost`, ad-hoc pure-engine loop since repo has no built-in headless runner): enabled=true win 0%, avgRounds 20.7, allyKits 45, enemyKits 15 | enabled=false win 0%, avgRounds 17.9, allyKits 0, enemyKits 0.
NOT checked in a real browser.
