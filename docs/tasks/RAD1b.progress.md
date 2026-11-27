# TASK RAD1b Progress Checklist

- [x] STEP A — Save prompt verbatim, inspect `GearSlotTile.tsx`, `GearView.tsx` targeted ranges, `GarageView.tsx` derived rows, `i18n/index.ts`, `vi.ts`/`en.ts`, and U2c testid reports
- [x] ITEM 1 — Unlock `radar` tile in `GearView.renderPaperDollTile` (keep Extender tiles locked) and verify cargo `RADAR` tab from `EQUIPMENT_SLOTS`
- [x] ITEM 2 — Add `trait.accuracy`/`trait.detectStealth` (`formatItemTraitsList`, `vi.ts`, `en.ts`) + conditional Accuracy row & Stealth detect chip/tooltip in `GearView` & `GarageView` (incl. equip preview delta)
- [x] TESTS & CHECKS — Add 5 small tests (`gearRadarRad1b.test.tsx`), run `npx tsc --noEmit` + related test files (`--reporter=dot`, <=15 lines)
- [x] REPORT — Update `docs/CODEMAP.md`, write `docs/tasks/RAD1b.report.md` (<=12 lines) and print it verbatim
