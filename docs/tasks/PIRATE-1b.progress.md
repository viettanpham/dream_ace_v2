# TASK PIRATE-1b Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/PIRATE-1b.md`, create `docs/tasks/PIRATE-1b.progress.md`
- [x] Read targeted files (`CODEMAP.md`, `pirates.ts`, `MapView.tsx` ranges, `AdminPanel.tsx` ranges, `useGameStore.ts` admin actions)
- [x] ITEM 1: Map skull badge (`data-pirate="true"`), briefing option row text (`Truy quét cướp biển 6v6` + `[Xuất kích]`), legend entry, phone `x>=8` & no horizontal overflow
- [x] ITEM 2: Store actions (`adminSpawnPirateIncident`, `adminClearPirateIncidents`, `adminRemovePirateIncident`, config sanitizer) + `src/components/admin/PirateAdminBlock.tsx` + mount in `AdminPanel.tsx` (+3 lines, <20 lines) + `vi.ts`/`en.ts` strings
- [x] Tests: `5/5` tests in `src/components/__tests__/pirateMapAdmin1b.test.tsx` (skull badge, option row text, weights validation, spawn now + maxActive, delete incident)
- [x] Checks: `npx tsc --noEmit` + related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/PIRATE-1b.report.md` (<= 12 lines)
