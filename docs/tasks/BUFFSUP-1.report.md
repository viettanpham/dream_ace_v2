# TASK BUFFSUP-1 Report
- Done: STEP A, ITEM 1 (`reset_cooldowns`, `cleanse_debuffs`, `grant_dodge`, `grant_speed_pct`, `durationRounds` 1–10), ITEM 2 (20 supply rows + engine/pricing/WP-exclusion), ITEM 3 (UI/i18n/combat-log everywhere; NPC excluded; Admin uses `SUPPLY_TEMPLATES`), TESTS.
- Files changed (this pass): `src/engine/shop.ts`, `src/i18n/{vi,en,index}.ts`, `src/components/{SupplyLoadoutBar,GearView,SupplyShopPanel,SupplyTradeConfirm}.tsx`, `src/utils/combatLogFormat.ts`, `src/engine/__tests__/buffSupplies1.test.ts`, `docs/{CODEMAP.md,tasks/BUFFSUP-1.progress.md,tasks/BUFFSUP-1.report.md}` (building on ITEM 1/2 edits in `types/game.ts`, `data/{consumables.ts,consumables.json,statusEffects.ts}`, `engine/{supplies,supplyEffects,combat}.ts`).
- Credit shop prices (matching `sup_hp_t1..t5`): T1 `60`, T2 `100`, T3 `160`, T4 `240`, T5 `360` CR (`priceOverride`); sell ratio `SHOP_CONFIG.sellPriceRatio` (same as other supplies); 0 WP shop rows.
- How Decoy Flare (`sup_flare_t1..t5`) ends: `ENG_flare_dodge` has `durationTurns: 1` and ticks off via `tickStatusDurations()` in `combat.ts` at the start of the user's next turn (`!skipTurnStartTicks`), keeping the 45% dodge cap while active.
- Icons (`iconCatalog.json`): `sup_cooldown` -> `BF20` (`restart_alt`), `sup_cleanse` -> `CC09` (`cleaning_services`), `sup_flare` -> `BF04` (`air`), `sup_haste` -> `BF07` (`speed`).
- Checks: `npx tsc --noEmit` (0 errors); `buffSupplies1.test.ts` (5/5 pass), `popIcon.test.tsx` & `prestageDialog.test.tsx` pass, plus 10 related supply UI/NPC/shop suites pass.
- Old failing asserts (untouched): `suppliesCs1.test.ts` (#1 expects length 16 got 36; #2 checks old formula 50 vs 60), `supplyRebalanceCsBal.test.ts` (#3 expects length 15 got 36).
- Browser status: NOT checked in a real browser.
