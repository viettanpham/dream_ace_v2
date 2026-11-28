# TASK BUFFSUP-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/BUFFSUP-1.md`, create `docs/tasks/BUFFSUP-1.progress.md`
- [x] ITEM 1: New effect kinds (`reset_cooldowns`, `cleanse_debuffs`, `grant_dodge`, `grant_speed_pct`, `durationRounds`) in `src/types/game.ts`, `src/data/consumables.ts`, and effect-summary formatter
- [x] ITEM 2: 20 supply rows in `src/data/consumables.json` + engine execution (`useSupply`, `supplyEffects.ts`, `statusEngine.ts`, flat dodge status/field, `spd_up` refresh/stronger-wins, pricing/sell price)
- [x] ITEM 3: Everywhere (`Túi vật tư`, `Kho đồ`, `Chợ vật tư`, `combatLogFormat.ts`, `vi.ts`/`en.ts`, keep NPC supply logic excluding new supplies, check Admin supply tables)
- [x] TESTS: 5 focused tests + related test files (`--reporter=dot`) + `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/BUFFSUP-1.report.md` (<= 12 lines)
