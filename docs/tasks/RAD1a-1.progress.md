# TASK RAD1a-1 Progress Checklist

- [x] STEP A — Save prompt verbatim, inspect targeted files (`game.ts`, `items.ts`, `items.json` pattern, `itemPricing`, `equipment.ts`, `itemPrice.ts`, `starterConfig.ts`, `migration.ts`, `i18n`)
- [x] ITEM 1 — Add `radar` as 7th `EquipmentSlot`, `accuracyPct`/`detectStealth` on `ItemSpecialTraits`, 6 radar rows in `items.json`, `baseBySlot.radar: 176` + validator, optional `StarterSetConfig.slots.radar`, and type-forced minimum fixes across app
- [x] TESTS & CHECKS — Create 4-test `src/engine/__tests__/radarSlotRad1a1.test.ts`, run `npx tsc --noEmit`, run affected test files (`--reporter=dot`, <=15 lines), update only 7th-slot / 36->42 expectations if any fail
- [x] REPORT — Update `docs/CODEMAP.md`, write `docs/tasks/RAD1a-1.report.md` and print it verbatim
