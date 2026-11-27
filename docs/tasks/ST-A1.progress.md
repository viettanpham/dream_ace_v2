# TASK ST-A1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/ST-A1.md`, create `docs/tasks/ST-A1.progress.md`
- [x] ITEM 1: `sup_lidar_sweep` spCost 20, usable anytime, `adminConfig.stealth { lidarDetectMin: 1, lidarDetectMax: 5 }`, `scan_reveal` reveals N random stealthed opponents + log only revealed units + Admin CP 2 inputs in "Kinh tế SP"
- [x] ITEM 2: `CombatUnit.revealedThisRound?: boolean`, `canUnitUseSkill` blocks `stealth_turns`/`stealth_until_attack` with vi/en reasons, `clearRevealedFlags(units)` at every round wrap
- [x] TESTS: Add <= 5 tests + run related tests (`--reporter=dot`) & `npx tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/ST-A1.report.md` (<= 12 lines)
