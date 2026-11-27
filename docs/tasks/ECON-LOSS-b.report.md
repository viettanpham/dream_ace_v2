# TASK ECON-LOSS-b Report
- **GUARD 1 & 2**: All prerequisite files & `@material-symbols/font-400` present; `admUi1.test.tsx` passed (4/4).
- **STEP A**: Saved `docs/tasks/ECON-LOSS-b.md` & `ECON-LOSS-b.progress.md`, verified `docs/CODEMAP.md` & symbols.
- **ITEM 1 (Rules & Store)**: `BattlePenaltyConfig` + defaults/sanitizer in `src/types/game.ts`, `src/data/balance.ts`, `src/engine/migration.ts` (save v14 unchanged); `computeRetreatPenalty()` & `computeRepairFee()` in `src/engine/battlePenalty.ts`, wired into `finalizeBattleOutcome()` (`rewards -> retreatPenalty -> repairFee`) + `SYSTEM` repair logs in `src/store/useGameStore.ts`, `src/utils/combatLogFormat.ts`, `src/i18n/{index,vi,en}.ts`.
- **ITEM 2 (Dialog & Admin)**: Added summary penalty/repair fields & lines in `src/components/BattleResultDialog.tsx`; added `src/components/admin/BattlePenaltyAdminBlock.tsx` inside collapsed `<AdminSection>` `"Thua & rút lui"` in `src/components/AdminPanel.tsx`.
- **Examples (with numbers)**:
  - Retreat Lv25 (`need=100.000`): 9% EXP (<10%) -> `0 EXP` taken, `-30.000 CR`, `-3.000 WP`; Lv<=10 pays `0`.
  - Repair fee: Defeat Lv20 & CR<=100.000 / Retreat Lv10 & CR<=10.000 -> free (state covers); Defeat `1800 maxHP*10 + 900 maxSHD*10 = 27.000 CR` (cap `100.000`), Retreat lost/destroyed `21.000 CR` (cap `50.000`); dialog `"Phí sửa chữa: -20.581 CR"`.
- **Checks**: `battlePenaltyEconLossB.test.tsx` (5/5), `battleRewardsEconLossA.test.tsx` (5/5), `BattleResultDialog.test.tsx` (4/4), `admUi1.test.tsx` (4/4) — 4 files / 18 tests passed; `npx tsc --noEmit` passed; `docs/CODEMAP.md` updated.
- **Verification note**: NOT checked in a real browser.
