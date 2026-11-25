# TASK EXT1a-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/EXT1a-1.md`, create `docs/tasks/EXT1a-1.progress.md`
- [x] Inspect targeted files/lines (`consumables`, `itemPricing`, `iconCatalog`, `types/game.ts`, `migration.ts`, `saveExport.ts`, `cloudSave.ts`)
- [x] ITEM 1: Create `src/data/modules.json` (36 rows: 24 stat + 12 trait) + `src/data/modules.ts` (`ModuleTemplate`, `MODULE_TEMPLATES`, `getModuleTemplateById`, `validateModuleTemplates`), add `moduleBase` to `itemPricing.json`/`itemPricing.ts`, and `computeModulePrice` / sell price helper in `src/engine/itemPrice.ts`
- [x] ITEM 2: Update `src/types/game.ts`, `src/engine/migration.ts` (`CURRENT_SAVE_VERSION` 11 -> 12, sanitizers for `pilot.modules`, `gear.extenders`, `adminConfig.extenderUnlockLevels`, `adminConfig.maxSkillModulesPerGear`), `src/engine/saveExport.ts`, and `src/engine/cloudSave.ts`
- [x] Write `<= 5` tests in `src/engine/__tests__/extenderModulesExt1a1.test.ts` and update only exact-save-version assertions in old tests if needed
- [x] Run `npx tsc --noEmit` and ONLY related tests (migration, saveExport, cloudSave, itemPricing, new test) (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/EXT1a-1.report.md` (<= 12 lines)
