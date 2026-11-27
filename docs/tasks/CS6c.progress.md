# TASK CS6c Progress

- [x] STEP A: Save `docs/tasks/CS6c.md` & `docs/tasks/CS6c.progress.md`, inspect target ranges across `SupplyLoadoutBar`, `BottomSheet`, `mapWorld`, `migration`, `useGameStore`, `combat`, `AdminPanel`
- [x] ITEM 0: Render desktop supply picker inside `BottomSheet` (remove absolute dropdown, keep `supply-picker-desktop`, close on outside/close/pick)
- [x] ITEM 1: Sector supply sanitizer (`migration.ts`), `drainSectorSupply` (`npcSupply.ts`), `finalizeBattleOutcome` & `advanceCampaignMonth` wiring (`mapWorld.ts`, `useGameStore.ts`), `createInitialBattleState` first log `"Quân nhu khu vực: {n}%"` (`combat.ts`, `types/game.ts`, `i18n`, `combatLogFormat.ts`)
- [x] ITEM 2: Admin CP `"Vật tư NPC"` block (`NpcSupplyAdminBlock` component + wire next to `shieldRegen` in `AdminPanel.tsx` <= +80 lines, store action to refill all sectors to 100)
- [x] TESTS: Add `<= 6` tests in `src/engine/__tests__/sectorSupplyAdminCs6c.test.tsx` covering cases (1)-(6)
- [x] CHECKS: `npx tsc --noEmit` + related vitest files (`--reporter=dot`, max 15 lines) + verify 5 battles drain value
- [x] REPORT: Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/CS6c.report.md` (<= 12 lines)
