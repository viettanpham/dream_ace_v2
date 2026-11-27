TASK RAD1a-2 — Radar combat: accuracy lowers dodge, stealth detection, auto-equip weights. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/RAD1a-2.md, checklist docs/tasks/RAD1a-2.progress.md, tick items, final report docs/tasks/RAD1a-2.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol, open only line ranges. Open ONLY: src/engine/stats.ts derived block (~115-145, grep critChance, armorPiercePct); DerivedStats in src/types/game.ts (grep armorPiercePct); BALANCE_CONFIG in src/engine/balance.ts (~179 maxCritChance); src/engine/combat.ts: CombatUnit field hasLongRangeWeapon (~234) and buildCombatUnit (~301), the player unit build (~560-570), getTargetableOpponents (~837) and its callers (~897, ~2037, ~2784, ~2823, ~2874, ~3008, ~3106), the hit roll (~1227); src/engine/autoEquip.ts scoreItemForClass (~27-55, ~83) + src/data/autoEquipConfig.ts (class weights ~15-90). Related tests + tsc only. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: engine only, NO UI, no new items. Enemies and allied AI get no radar (detectsStealth false, accuracy 0). New strings: none.

ITEM 1 — Accuracy + stealth detection.
- BALANCE_CONFIG.maxAccuracyPct = 30. DerivedStats.accuracyPct = min(maxAccuracyPct, traits.accuracyPct ?? 0) (stats.ts, same place as armorPiercePct).
- CombatUnit gets accuracyPct (number, default 0) and detectsStealth (boolean, default false); the player unit takes them from the gear traits (sumGearSpecialTraits result next to hasLongRangeWeapon ~568), every other unit keeps the defaults.
- Hit roll (~1227): dodge used = max(0, getEffectiveUnitDodge(target) - attacker.accuracyPct). Barrel Roll (evade_all), sure-hit and one-hit rules stay exactly as they are.
- getTargetableOpponents(units, actorSide, detectsStealth?): when detectsStealth is true the pool is ALL alive opponents (stealth ignored); otherwise unchanged. Pass the actor's detectsStealth from all 7 callers (list them in the report).
ITEM 2 — Auto-equip. autoEquipConfig per class weights: accuracyPct striker 1.2, interceptor 1.0, siege 1.0, support 0.6; detectStealthBonus 5 (flat score when the item has detectStealth). scoreItemForClass and the delta helper (~83) use them. A radar must be auto-equipped like other slots.

HARD LIMITS: with no radar equipped a fixed-seed battle is IDENTICAL to before; Barrel Roll and sure-hit unchanged; no UI change.

TESTS: write at most 5 small tests in total; do not add tests beyond these; do not refactor existing tests: (1) accuracy 12 lowers dodge 40 -> 28 in a seeded hit roll, total accuracy capped at 30, Barrel Roll still evades; (2) detectStealth attacker can target a stealthed enemy, a normal attacker cannot, NPC units never detect; (3) autoEquip picks a radar for a striker; (4) fixed-seed battle with no radar identical to before; (5) one derived-stats test: accuracyPct cap.

CHECKS: tsc --noEmit first, then ONLY the related test files (combat, stats, autoEquip, the new test) with --reporter=dot; print at most 15 lines of output; on a failure re-run only the failing file. NO full vitest, NO production build.

REPORT (max 12 lines): items done + files changed; the 7 getTargetableOpponents callers and what each passes; one line of test result; what was NOT checked (real browser, full suite).
