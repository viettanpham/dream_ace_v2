# TASK BRIEF-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/BRIEF-1.md`, create `docs/tasks/BRIEF-1.progress.md`
- [x] STEP 0: Read-only inspection of MapView options block/row heights and `archetypeRosterBySize` reusability
- [x] ITEM 1: Add `getEnemyLevelBand(kind, cfg)` in `src/engine/enemyLevel.ts` and `levelConClass(diff)` in `src/utils/levelCon.ts`
- [x] ITEM 2: Update `estimatedEnemyLevel` in `src/components/MapView.tsx` (~381) using `activeGear.level + band.mid + sector.levelOffset`
- [x] ITEM 3: Add inline preview card toggle under each row in `MapView.tsx` (~1028-1100) + `vi.ts`/`en.ts` strings
- [x] TESTS: Add <= 4 small tests + run related tests (`--reporter=dot`) & `npx tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/BRIEF-1.report.md` (<= 12 lines)
