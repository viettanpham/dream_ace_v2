# TASK EXT1a-2 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/EXT1a-2.md`, create `docs/tasks/EXT1a-2.progress.md`
- [x] Read targeted files (`CODEMAP.md`, `modules.ts`, `EXT1a-1.report.md`, `supplies.ts`, `equipment.ts`, `useGameStore.ts`, `balance.ts`, `migration.ts`)
- [x] ITEM 1: Implement `src/engine/extenders.ts` (`getUnlockedExtenderCount`, `canEquipModule`, `setModule`, `clearModule`, `addModuleToPilot`, `getGearModuleSkillGrants`), update `src/engine/migration.ts` (over-owned & same-effect sanitizer), add `setExtenderModule` to `src/store/useGameStore.ts`, add vi/en reason strings
- [x] ITEM 2: Update `sumGearEquipmentStats` & `sumGearSpecialTraits` (with `adminConfig`), add `BALANCE_CONFIG.moduleDropConfig`, implement `rollBattleModuleDrops`, wire battle loot / `droppedModules` / auto-repeat totals in `useGameStore.ts` & `src/types/game.ts`
- [x] Write `<= 5` tests in `src/engine/__tests__/extenderRulesExt1a2.test.ts`
- [x] Run `npx tsc --noEmit` and ONLY related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/EXT1a-2.report.md` (<= 12 lines)
