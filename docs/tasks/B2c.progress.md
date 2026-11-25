# TASK B2c Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/B2c.md`, create `docs/tasks/B2c.progress.md`
- [x] ITEM 1: Engine + config (`minPerLevel`, `minPerAlly`, `resolveSpTransfer`, `getMaxAffordableFluxCount`, `canUnitUseSkill` uncastable path + `vi.ts`/`en.ts`, `previewFluxTransfer` / `FluxTransferPicker`, `performPlayerAction` clamp)
- [x] ITEM 2: NPC/auto emergency rule + Admin (`pickFluxCount` ally < 25% SP + keep >= 50% SP + better-option check + admin fields for `minPerLevel`, `allySpBelowPct`, `keepSelfPct` in `AdminPanel.tsx` + `vi.ts`/`en.ts`)
- [x] TESTS: Add <= 5 small tests + run related tests (`--reporter=dot`) & `npx tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/B2c.report.md` (<= 12 lines)
