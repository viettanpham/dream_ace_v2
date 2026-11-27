# TASK MAP-F1b — Final Report

## Items Completed
- **ITEM 1 — Wired `frontline.ts` across engine, migration, and store**:
  - **(a) Cumulative `unlockedSectorIds` & `@deprecated getNextSectorId`**: Marked `getNextSectorId()` as `@deprecated` in `src/data/maps.ts` (export preserved), removed its chain unlock from `finalizeBattleOutcome()` in `src/store/useGameStore.ts`, added `mergeVisibleUnlockedSectors()` in `src/engine/frontline.ts`, and updated `applyBattleBaseConsequences()` (`src/engine/mapWorld.ts`), `finalizeBattleOutcome()`, and `migrateSaveData()` (`src/engine/migration.ts`, still preserving start nodes `'aegis_relay'` & `'veridian_colony'`) so `unlockedSectorIds` accumulates every visible node without ever shrinking.
  - **(b) Battle launch guard & visible selection**: Updated `launchBattleForSector()` (`src/store/useGameStore.ts`) to check `getBattleOptions` + `pickDefaultBattle`, refusing non-allowed nodes with no battle started and setting `battleLaunchToast` (rendered in `src/App.tsx`) using the translated frontline reason key (`map.reason.hidden`, `map.reason.notFrontline`, `map.reason.rearBase`), while `selectSector()` (`useGameStore.ts`) and `handleSelectSector()` (`MapView.tsx`) still allow selecting any visible node (`isVisible()`).
  - **(c) Auto-repeat pre-battle frontline check**: Added `'node_not_contested'` to `AutoStopReason` (`src/types/game.ts`) and translations in both `src/i18n/vi.ts` (`'Dừng: căn cứ không còn giao tranh'`) and `src/i18n/en.ts` (`'Stopped: node is no longer contested'`), stopping `autoRepeatSession` cleanly in `startAutoRepeat()`, `finalizeBattleOutcome()`, and `launchBattleForSector()` when the next battle node has no allowed frontline option.
  - **(d) Bonus mission targeting**: Updated `acceptBaseBonusMission()` (`src/engine/mapWorld.ts`) to BFS lane hops via `neighbours()` and select only a `isContested()` target node (fewest lane hops from source base, tie-broken by lower `baseLevel`), returning `'no_target_sector'` when none are contested.
- **ITEM 2 — `MapView.tsx` deploy button**:
  - Updated `renderBriefingBody()` deploy CTA in `src/components/MapView.tsx` to use `getBattleOptions` + `pickDefaultBattle`: disabled with the frontline reason in `title` and subtext (`[data-testid="map-deploy-blocked-reason"]`) when nothing is allowed, preserving existing labels and layout otherwise.
- **Checks & Tests**:
  - Added `src/components/__tests__/frontlineIntegrationF1b.test.tsx` (8 integration & UI tests) and updated 3 existing loop test suites (`f2aPlus.test.tsx`, `loopDiagnosis.test.tsx`, `loopDefeatSpeedLp2.test.tsx`) from hidden `debris_belt` to contested starter `border_outpost`.
  - Updated `docs/CODEMAP.md` with MAP-F1b changes.
  - **Tests**: `386 -> 394` (`61` test files, `394` tests passed in full `npx vitest run`).
  - **Production build & TypeScript**: Verified via `compile_applet` and `lint_applet`.
  - **Browser check note**: NOT checked in a real browser (disabled deploy button).

## Files Changed
- `src/data/maps.ts`
- `src/types/game.ts`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/engine/frontline.ts`
- `src/engine/mapWorld.ts`
- `src/engine/migration.ts`
- `src/store/useGameStore.ts`
- `src/App.tsx`
- `src/components/MapView.tsx`
- `src/components/__tests__/frontlineIntegrationF1b.test.tsx`
- `src/components/__tests__/f2aPlus.test.tsx`
- `src/components/__tests__/loopDiagnosis.test.tsx`
- `src/components/__tests__/loopDefeatSpeedLp2.test.tsx`
- `docs/CODEMAP.md`
- `docs/tasks/MAP-F1b.md`
- `docs/tasks/MAP-F1b.progress.md`
- `docs/tasks/MAP-F1b.report.md`
