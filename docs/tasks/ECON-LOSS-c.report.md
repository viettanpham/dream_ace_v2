# TASK ECON-LOSS-c Report
- Items done: STEP A, ITEM 1 (`BattlePenaltyConfig.defeatFreeLevel`/`defeatExpPenaltyFactor`, `sanitizeBattlePenaltyConfig`, `computeDefeatExpPenalty`, `finalizeBattleOutcome` defeat branch, `BattleSummary.defeatPenaltyExp` + `getBattleSummaryCharges`), ITEM 2 (`BattlePenaltyAdminBlock` fields + live examples, `BattleResultDialog` defeat EXP line, `vi.ts`/`en.ts`), TESTS & CHECKS.
- Files changed: `src/types/game.ts`, `src/data/balance.ts`, `src/engine/battlePenalty.ts`, `src/store/useGameStore.ts`, `src/components/admin/BattlePenaltyAdminBlock.tsx`, `src/components/BattleResultDialog.tsx`, `src/i18n/{vi,en}.ts`, `src/engine/__tests__/defeatExpPenaltyEconLossC.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/ECON-LOSS-c.{md,progress.md,report.md}`.
- Checks: `defeatExpPenaltyEconLossC.test.tsx` (4/4), `vouchersB.test.tsx`, `BattleResultDialog.test.tsx` passed + `npx tsc --noEmit` exit 0; `battlePenaltyEconLossB.test.tsx` 4/5 passed (test 5 had pre-existing `CURRENT_SAVE_VERSION` 15 vs 14 assertion from VOUCHER-a, untouched).
- Not checked: full vitest suite, production build, and live browser rendering/interactions.
CHƯA chạy trình duyệt thật
