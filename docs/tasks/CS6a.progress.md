# TASK CS6a Progress

- [x] STEP A: Read `docs/CODEMAP.md`, inspect target line ranges, save `docs/tasks/CS6a.md` & `docs/tasks/CS6a.progress.md`
- [x] ITEM 0: Fix stale `src/engine/__tests__/suppliesBattleCs2.test.tsx` (inactive/confirmed `prestage`)
- [x] ITEM 1: Create `src/data/npcSupply.json` & `src/engine/npcSupply.ts` (`DEFAULT_NPC_SUPPLY_CONFIG`, `sanitizeNpcSupplyConfig`, `sanitizeSupplyMaxPerTypePerBattle`), update `src/types/game.ts`, `src/engine/migration.ts`, and `canUseSupply(..., battleLimitOverride)` in `src/engine/supplies.ts`
- [x] ITEM 2: Implement pure `generateNpcSupplies(...)` in `src/engine/npcSupply.ts` and call at the end of `createInitialBattleState` in `src/engine/combat.ts` (`PilotAccount.sectorSupply?` in `types/game.ts`)
- [x] TESTS: Add `<= 5` tests in `src/engine/__tests__/npcSupplyCs6a.test.ts` covering cases (1)-(5)
- [x] CHECKS: `npx tsc --noEmit` + related tests (`--reporter=dot`, max 15 lines) + sample stock check (Lv20 Hard assault at sectorSupply 100 & 30)
- [x] REPORT: Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/CS6a.report.md` (<= 12 lines)
