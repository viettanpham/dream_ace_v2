# TASK TURN-PH-UI Report
- STEP 0: Desktop skill bar `BattleScreen.tsx:3087` (`~3164`), phone skill row `:2709`, supply flag `battleSupplyView.usedThisTurn > 0`, row height `min-h-[44px]` (`44px`), manual turn flag `canPlayerManualAct` (`:1508`).
- ITEMS DONE:
  - STEP A & STEP 0: Saved prompt & audited `BattleScreen.tsx` + `PhoneSkillsSheet.tsx` (`turnStepLine` mount points untouched radar `min-h-[420px]`).
  - ITEM 1: Created `src/components/TurnStepLine.tsx` (`h-5`, `text-[11px]`, no-wrap, ① active `text-emerald-300`, ② `{used}/{max}` amber + tooltip at max, ③ `Đánh` compact / `Hành động` desktop, `<340px` icon collapse, mounted only when `canPlayerManualAct && turnStep2Max > 0` with 0 reserved space when hidden).
  - ITEM 2: Updated `battle.skillReason.used_this_turn` to `"Đã dùng lượt này"` / `"Already used this turn"` in `vi.ts`/`en.ts`, rendered visibly on desktop skill button (`BattleScreen.tsx:3250`) and verified visible in `PhoneSkillsSheet.tsx:107`.
  - TESTS: Added 4 tests in `src/components/__tests__/turnStepLine.test.tsx`; appended to `docs/CODEMAP.md`.
- FILES CHANGED: `src/components/TurnStepLine.tsx`, `src/components/BattleScreen.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/__tests__/turnStepLine.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/TURN-PH-UI.{md,progress.md,report.md}`.
- TESTS & CHECKS: `npx tsc --noEmit` PASS (0 errors); `npx vitest run --reporter=dot turnStepLine.test.tsx PhoneSkillsSheet.test.tsx turnPhase.test.ts` -> 3 files, 10 passed (10/10).
- NOT VERIFIED IN REAL BROWSER: Layout/overflow/clipping at phone `320/360/390`, big font setting, and desktop `1440x900` visual check (jsdom tests only; real browser not opened).
