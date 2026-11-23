# TASK MAP-K1 — Progress Checklist

- [x] STEP A — Save prompt verbatim to `docs/tasks/MAP-K1.md`, read `docs/CODEMAP.md`, inspect allowed files & grep symbols
- [x] ITEM 1 — Extend `BattleKind` (`'assault' | 'defend' | 'patrol' | 'mission' | 'event'`), create `src/data/battleKinds.ts` (`BATTLE_KIND_RULES` + `registerBattleSourceProvider` registry), add `kind` + `sourceId` to `BattleState`, wire `createInitialBattleState` & `launchBattleForSector` / `startBattle` optional `{ kind, sourceId }` + provider checks
- [x] ITEM 2 — Update `applyBattleBaseConsequences` to gate capture/raid clear/bonus mission by `battle.kind`, add BattleResultDialog one-line kind label + vi/en strings, preserve kind across Auto-Repeat & add `'source_inactive'` `AutoStopReason`
- [x] TESTS & CHECKS & REPORT — Add comprehensive MAP-K1 tests, update `docs/CODEMAP.md`, run full `npx vitest run` ONCE, `lint_applet`, and production build, write & print `docs/tasks/MAP-K1.report.md`
