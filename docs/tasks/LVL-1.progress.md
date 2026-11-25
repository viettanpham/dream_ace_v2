# TASK LVL-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/LVL-1.md`, create `docs/tasks/LVL-1.progress.md`
- [x] STEP 0: Read-only inspection of `combat.ts` ~725-760, `generateNpcAllocations`, pirate/boss launch `BattleKind`/`sourceId`, and Lv20/Lv50 NPC vs player stat table
- [x] ITEM 1: Create `src/engine/enemyLevel.ts` (`rollEnemyLevelOffset`, defaults, cap clamp, sanitizer)
- [x] ITEM 2: Update `src/engine/combat.ts` ~735-755 for battle-kind enemy level rolls (normal vs boss unit, `battleLevelOffsetOverride` wins, keep boss multipliers)
- [x] ITEM 3: Wire `adminConfig.enemyLevel` + sanitizer in `types/game.ts`, `migration.ts`, `useGameStore.ts`, `vi.ts`/`en.ts`, and create `src/components/admin/EnemyLevelAdminBlock.tsx` mounted in `AdminPanel.tsx` (<= 3 changed lines)
- [x] TESTS: Add <= 4 small tests in `src/engine/__tests__/enemyLevelLvl1.test.ts` + CHECKS (`npx tsc --noEmit` + related test files)
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/LVL-1.report.md` (<= 12 lines)
