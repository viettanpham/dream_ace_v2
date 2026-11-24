# TASK CS-UI Progress Checklist

- [x] STEP A — Save prompt verbatim, inspect CODEMAP & target files (`GearView.tsx` paper-doll/BottomSheet, `supplies.ts`, `consumables.ts`, `useGameStore.ts`, `CatalogIcon.tsx`, `i18n`)
- [x] ITEM 1 — Create `src/components/SupplyLoadoutBar.tsx` ("Túi vật tư" `n/N`, N tiles desktop/phone, filled/empty/stock/dimmed locked state) & mount in `GearView.tsx` desktop + phone breakpoints
- [x] ITEM 2 — Add Supply Picker (desktop popover under row / phone `BottomSheet`), `"Trống / Gỡ"`, owned unlocked templates sorted family then tier, `"Đã mang"`, `setSupplyLoadout` replace/append/remove, locked guard + `vi.ts`/`en.ts` strings
- [x] TESTS & CHECKS — Create 4-test `src/components/__tests__/supplyLoadoutBarCsUi.test.tsx`, update `docs/CODEMAP.md`, run targeted vitest (`--reporter=dot`, <=15 lines) + `npx tsc --noEmit`
- [x] REPORT — Write `docs/tasks/CS-UI.report.md` and print it verbatim
