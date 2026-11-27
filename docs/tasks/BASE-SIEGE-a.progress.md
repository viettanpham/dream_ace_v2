# TASK BASE-SIEGE-a Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/BASE-SIEGE-a.md`, create `docs/tasks/BASE-SIEGE-a.progress.md`
- [x] ITEM 1: Data + config (`BaseRuntimeState`, `AdminConfig.baseSiege`, `src/engine/baseSiege.ts`, `migration.ts` sanitizer/defaults)
- [x] ITEM 2: Capture rule (`mapWorld.ts` `applyBattleBaseConsequences`, `useGameStore.ts` `finalizeBattleOutcome`, `BattleSummary.siegeResult`, `BattleResultDialog` line + log line)
- [x] ITEM 3: Regen in `advanceCampaignMonth` (`mapWorld.ts`)
- [x] ITEM 4: Raids damage + flip + allied capital 1 HP stop + month summary & raid notice (`raidedSectorIds`)
- [x] ITEM 5: Repair actions (`applyBaseRepair` pure + `repairBaseHp` / `repairBaseShield` store actions)
- [x] ITEM 6: Admin section "Căn cứ - Chiếm giữ" (`AdminSection`, live examples, reset-all-bases-to-full button, `vi.ts`/`en.ts`)
- [x] TESTS: <= 6 small tests + minimal fix to existing single-win capture tests + `vitest --reporter=dot` & `npx tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/BASE-SIEGE-a.report.md` (<= 12 lines)
