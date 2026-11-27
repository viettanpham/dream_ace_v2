# TASK POP-ICON Progress

- [x] STEP A: Save `docs/tasks/POP-ICON.md` & `docs/tasks/POP-ICON.progress.md`, read `docs/CODEMAP.md` and inspect target ranges
- [x] ITEM 1: Extend `parseCardPopupDisplay` in `src/utils/cardPopupQueue.ts` + wire into `BattleUnitCard.tsx` (<= +30 lines) & `BattleRadarView.tsx`
- [x] ITEM 2: Add inline log icons in `CombatLogList.tsx` / `combatLogFormat.ts` keeping plain copy/search text unchanged
- [x] TESTS: Add at most 4 tests in `src/utils/__tests__/popIcon.test.tsx` (update stale expectations only if icon change makes them stale)
- [x] CHECKS: Run `npx tsc --noEmit` + touched popup/radar/log tests + new test (`--reporter=dot`, max 15 lines)
- [x] REPORT: Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/POP-ICON.report.md` (max 12 lines)
