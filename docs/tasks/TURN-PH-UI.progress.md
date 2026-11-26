# TASK TURN-PH-UI Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/TURN-PH-UI.md`, create `docs/tasks/TURN-PH-UI.progress.md`
- [x] STEP 0: Read-only audit of desktop skill bar, phone skill row, supply-used-this-turn flag, skill bar row height, manual player turn state
- [x] ITEM 1: New `src/components/TurnStepLine.tsx` + vi/en strings + mount in `BattleScreen.tsx` (only player manual turn & `maxStep2PerTurn > 0`, no reserved space when hidden)
- [x] ITEM 2: Show `"Đã dùng lượt này"` / `"Already used this turn"` on locked skills (`turnLockedSkillIds`) in desktop skill button & `PhoneSkillsSheet`
- [x] TESTS: Add <= 4 small tests + run related tests (`--reporter=dot`) & `npx tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/TURN-PH-UI.report.md` (<= 12 lines)
