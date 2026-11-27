# TASK EXT2a-2 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/EXT2a-2.md`, create `docs/tasks/EXT2a-2.progress.md`
- [x] Read targeted files (`CODEMAP.md`, `extenders.ts`, `equipment.ts` ranges, `useGameStore.ts` ranges, `migration.ts` ranges, grep symbols & version checks)
- [x] ITEM 1: Instance-based `gear.extenders`, `extenderLevelsPerSocket` (default 10, 1-50), `canEquipModule` reasons (`socket_locked`, `level_too_low`, `not_module`, `same_effect` w/ socket number, `skill_limit`, `in_other_gear`), `setModule`/`clearModule`, store `setExtenderModule` battle/loop guard, protect socketed modules from sell/quick-sell/enchant
- [x] ITEM 2: `sumGearEquipmentStats` / `sumGearSpecialTraits` read module instances from unlocked sockets only (missing id = empty, locked = keeps id & gives 0)
- [x] ITEM 3: Remove stack system (`addModuleToPilot`, `addModuleDropsToPilot`, `mergeModuleStacks`, `getOwnedModuleCount`, `countSlottedModuleCopies`, stack `rollBattleModuleDrops`, `droppedModules`, `totalModuleDrops`, `pilot.modules`), keep `getGearModuleSkillGrants` (reading instances)
- [x] ITEM 4: Save v12 -> v13 (`CURRENT_SAVE_VERSION = 13`, update version checks in `saveExport`/`cloudSave`, migrate `pilot.modules` + template-id `gear.extenders` + drop `extenderUnlockLevels`, sanitize current saves)
- [x] Tests: convert/delete obsolete stack tests & write `<= 5` tests in `src/engine/__tests__/extenderRulesExt2a2.test.ts` (update exact save version checks only where needed)
- [x] Run `npx tsc --noEmit` first, then ONLY related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/EXT2a-2.report.md` (<= 12 lines)
