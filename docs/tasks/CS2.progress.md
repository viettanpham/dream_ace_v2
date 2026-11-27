# TASK CS2 Progress Checklist

- [x] STEP A — Save prompt verbatim, inspect `supplies.ts`, `supplyEffects.ts`, `types/game.ts`, `consumables.ts`, `combat.ts`, `useGameStore.ts`, `FieldSuppliesSheet.tsx`, `BattleScreen.tsx`, `SupplyLoadoutBar.tsx`
- [x] ITEM 1 — `BattleState.supplyByUnit`, pure `applyBattleSupplyUse` + `tickSupplyState`, store `useBattleSupply`, log/popup/fx, and `tickSupplyState` in both player action paths
- [x] ITEM 2 — Pure `getBattleSupplyRows`, `FieldSuppliesSheet` supply rows + hints + empty states, `battle-action-item` usable count badge in `BattleScreen`, and `vi.ts`/`en.ts` keys
- [x] TESTS & CHECKS — Add 5 small tests (`suppliesBattleCs2.test.tsx`), run `npx tsc --noEmit` + related test files (`--reporter=dot`, <=15 lines)
- [x] REPORT — Update `docs/CODEMAP.md`, write `docs/tasks/CS2.report.md` (<=12 lines) and print it verbatim
