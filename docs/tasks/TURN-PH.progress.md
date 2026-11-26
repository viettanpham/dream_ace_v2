# TASK TURN-PH Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/TURN-PH.md`, create `docs/tasks/TURN-PH.progress.md`
- [x] STEP 0: Read-only audit of turn-end locations, AI decisions, stun/silence checks, skill targetType counts, BattleState per-turn fields
- [x] ITEM 1: Pure `src/engine/turnPhase.ts`, `phaseOverride` on `SkillDefinition` + `sup_lidar_sweep`, `adminConfig.turnPhase.maxStep2PerTurn`, `BattleState.turnStep2Used` / `turnLockedSkillIds`, `canUnitUseSkill` lock reason + `vi.ts`/`en.ts`, step-2 non-turn-ending execution in `performPlayerAction`
- [x] ITEM 2: Shared multi-step AI/auto helper for `performAiTurn` + player auto loop, and Admin CP "Lượt 3 bước" block (`maxStep2PerTurn` draft + Apply)
- [x] TESTS: Add <= 5 small tests + run related tests (`--reporter=dot`) & `npx tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/TURN-PH.report.md` (<= 12 lines)
