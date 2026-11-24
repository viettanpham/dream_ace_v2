# TASK RAD1a-2 Progress Checklist

- [x] STEP A — Save prompt verbatim, read `docs/CODEMAP.md` and inspect targeted symbol line ranges
- [x] ITEM 1 — Add `BALANCE_CONFIG.maxAccuracyPct = 30`, `DerivedStats.accuracyPct`, `CombatUnit.accuracyPct`/`detectsStealth`, hit roll dodge reduction, and `getTargetableOpponents(..., detectsStealth?)` across all 7 callers
- [x] ITEM 2 — Add `accuracyPct` class weights (`striker 1.2`, `interceptor 1.0`, `siege 1.0`, `support 0.6`) and `detectStealthBonus: 5` in `autoEquipConfig` + `autoEquip.ts` (`scoreItemForClass` and delta helper)
- [x] TESTS & CHECKS — Add 5 small tests (`radarCombatRad1a2.test.ts`), run `npx tsc --noEmit` + related test files (`--reporter=dot`, <=15 lines)
- [x] REPORT — Update `docs/CODEMAP.md`, write `docs/tasks/RAD1a-2.report.md` (<= 12 lines) and print it verbatim
