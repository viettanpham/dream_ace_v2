# TASK CS6b Progress

- [x] STEP A: Save `docs/tasks/CS6b.md` & `docs/tasks/CS6b.progress.md`, inspect target ranges in `supplyAi.ts`, `supplies.ts`, `useGameStore.ts`, `i18n`
- [x] ITEM 1: Extract shared supply log/popup/fx builder from `useBattleSupply`; add `battleLimitOverride` passthrough to `pickAutoSupplies` & `applyBattleSupplyUse`; implement pure `runNpcSupplyStep(...)` in `src/engine/npcSupply.ts` and call it in `performAiTurn` (`useGameStore.ts`)
- [x] ITEM 2: Implement emergency resupply in `runNpcSupplyStep` + i18n keys in `vi.ts` & `en.ts`
- [x] TESTS: Add `<= 5` tests in `src/engine/__tests__/npcSupplyUseCs6b.test.ts` covering cases (1)-(5)
- [x] CHECKS: `npx tsc --noEmit` + related vitest files (`--reporter=dot`, max 15 lines) + 10 seeded auto battles Lv10 Standard assault stats
- [x] REPORT: Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/CS6b.report.md` (<= 12 lines)
