# TASK EXT1a-1 Report
- ITEM 1: Added `src/data/modules.json` (36 rows: 24 stat, 12 trait), `src/data/modules.ts` (`MODULE_TEMPLATES`, `getModuleTemplateById`, `validateModuleTemplates`), `moduleBase` in `itemPricing.json`/`itemPricing.ts`, and `computeModulePrice` + `getModuleSellPrice` in `src/engine/itemPrice.ts`.
- Module table (id | value | reqLv | buy/sell): `mod_stat_<attack|defense|fuel|spirit|shield|evasion>_t1..t4`: T1(+3, Lv1, 120/42), T2(+5, Lv3, 209/73), T3(+8, Lv6, 305/107), T4(+12, Lv9, 456/160).
- Trait table: `mod_trait_critBonusPct_t2..t4` (+2/+3/+5, Lv3/6/9, 348/508/760), `armorPiercePct` (+3/+5/+8, Lv3/6/9, 348/508/760), `spRegenPerTurn` (+1/+2/+3, Lv3/6/9, 348/508/760), `accuracyPct` (+2/+4/+6, Lv3/6/9, 348/508/760); sell = round(buy * 0.35).
- ITEM 2: Added `pilot.modules`, `gear.extenders` (5x null), `adminConfig.extenderUnlockLevels` (`[5,15,25,35,45]`), `adminConfig.maxSkillModulesPerGear` (`1`) + sanitizers in `types/game.ts`, `stats.ts`, `migration.ts`.
- Save version: `11 -> 12` (`CURRENT_SAVE_VERSION` in `src/engine/migration.ts`, read by `saveExport.ts`, `cloudSave.ts`, `useGameStore.ts`, `useCloudSaveStore.ts`, `SaveTransferSection.tsx`, `CloudSaveDialogs.tsx`).
- Old tests updated (version number only + 1 pricing snapshot): `saveV10Migration`, `suppliesCs1`, `shieldRegen`, `itemPrice`, `itemDataLoader` (+`PRICE_FORMULA` snapshot `moduleBase`), plus `11->12` assertions in 13 battle/status UI test files.
- Checks: `npx tsc --noEmit` passed; `npx vitest run --reporter=dot` across 7 related files (`saveV10Migration`, `saveExport`, `cloudSave`, `itemPrice`, `itemDataLoader`, `suppliesCs1`, `extenderModulesExt1a1`) -> 7 passed (47 tests).
- NOT checked: full suite, browser.
