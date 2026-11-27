TASK LVL-2 — Supply use limit multiplier by side and battle kind. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save this prompt verbatim to docs/tasks/LVL-2.md, create docs/tasks/LVL-2.progress.md, tick items as you go, final docs/tasks/LVL-2.report.md and print it. On retry continue from the first unticked item.

RULES: do not touch src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx; no save version bump (sanitizer in supplies.ts sanitizeSupplyEconomyConfig + migration defaults only); new strings in vi.ts AND en.ts; keep CS-BAL/LVL-1 features.

TOKEN SAVING: read docs/CODEMAP.md first; grep symbols, open only supplies.ts (lines ~104-135, ~310-345, ~426-470, ~544-640), the call site useGameStore.ts ~3109, BattleScreen.tsx ~597 and SupplyEconomyAdminBlock.tsx; one item at a time; run only related test files after each item; append touched files to CODEMAP.

STEP 0 (read-only, max 6 lines): confirm BattleState has kind and how to tell escort units (enemy, not boss, in a battle where some unit isBoss); confirm which side is attacker in 'assault' (player) and in 'defend' (enemy). Report only differences from this assumption.

ITEM 1 — new pure function in supplies.ts: getSupplyLimitMult(kind, unit, units, cfg) returns a number or Infinity. Rules: if any unit isBoss (boss battle): the boss unit = Infinity; other enemy units (escorts) = bossEscort (default 2); player side = bossPlayers (default 3). Else kind 'assault': player (attacker) = assaultAttacker 2, enemy (defender) = assaultDefender 3. Kind 'defend': player (defender) = defendDefender 2, enemy (attacker) = defendAttacker 1. Any other kind: 1. Effective per-type battle limit = floor(maxUsesPerBattle * mult).

ITEM 2 — wire it into canUseSupply / applyBattleSupplyUse / getBattleSupplyRows (pass battle.kind and units; default mult 1 when missing so old tests stay green). The "x/y" limit text in the Túi vật tư bar must show the multiplied limit; Infinity shows as "∞".

ITEM 3 — add supplyEconomy.limitMult {assaultAttacker, assaultDefender, defendDefender, defendAttacker, bossEscort, bossPlayers} to config type + sanitizer (ints 1-10) and 6 small number fields (+ reset) in SupplyEconomyAdminBlock.tsx. Boss unlimited is fixed behaviour, no field.

TESTS: write at most 4 small tests in total (assault player 10 / enemy 15 at base 5; defend player 10 / enemy 5; boss unit unlimited + escort 10 + player 15; sanitizer clamps); do not add tests beyond these; do not refactor existing tests.

CHECKS: related test files only with --reporter=dot + npx tsc --noEmit; print at most 15 lines; no full vitest, no build.

REPORT (max 12 lines): Step 0 differences, items done, files changed, one test line, what was NOT checked in a real browser.
