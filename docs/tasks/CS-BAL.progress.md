# TASK CS-BAL Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/CS-BAL.md`, create `docs/tasks/CS-BAL.progress.md`
- [x] Read `docs/CODEMAP.md` and targeted source ranges; run STEP 0 read-only stats calculation (maxHp / maxShield / maxSp at Lv 1/10/20/35/40/50)
- [x] ITEM 0: Update `supplyShopUiCs3b.test.tsx` test 3 (click `supply-confirm-ok`) + `statusChipsG4a1.test.tsx` & `suppliesCs1.test.ts` `CURRENT_SAVE_VERSION` to `.toBeGreaterThanOrEqual(12)`
- [x] ITEM 1: Add flat `SupplyEffectKind` (`heal_hp`, `restore_shield`, `restore_sp`), `applySupplyEffects` min/cap + real restored log, 15 templates in `consumables.json` (T1..T5), effect text formatting, `vi.ts`/`en.ts` strings
- [x] ITEM 2: Add `adminConfig.supplyEconomy` + sanitizer, `maxUsesPerBattle` in `supplies.ts`, `computeSupplyPrice` flat + `spPriceMult`, `SupplyEconomyAdminBlock.tsx` mounted in `AdminPanel.tsx` (< 15 added lines)
- [x] Tests: write at most 5 small tests in `src/engine/__tests__/supplyRebalanceCsBal.test.ts`
- [x] Checks: `npx tsc --noEmit` + related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/CS-BAL.report.md` (<= 15 lines)
