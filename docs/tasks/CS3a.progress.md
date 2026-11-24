# TASK CS3a Progress Checklist

- [x] STEP A — Save prompt verbatim, inspect targeted files (`shop.ts`, `supplies.ts`, `itemPrice.ts`, `useGameStore.ts`, `migration.ts`, `types/game.ts`, `balance.ts`, `skills.ts`)
- [x] ITEM 1a — `AdminConfig` supply shop defaults/sanitizers (`supplyShopMinTypes/MaxTypes/MinQty/MaxQty`) + `SupplyShopListing` type + pure `generateSupplyShopStock` + save/load/migration (`supplyShopStock`)
- [x] ITEM 1b — `useGameStore` `supplyShopStock` state + all re-roll sites + `buySupply` / `sellSupply` actions + `saveExport` / `cloudSave` parity check
- [x] ITEM 2 — `BALANCE_CONFIG.openingCardCosts` x10 (800/1600) + update any tests reading old numbers + check WP reward constants
- [x] TESTS & CHECKS — Add 5 small tests (`supplyShopCs3a.test.ts`), update `docs/CODEMAP.md`, run `npx tsc --noEmit` + related tests (`--reporter=dot`, <=15 lines), write & print `docs/tasks/CS3a.report.md` (<=12 lines)
