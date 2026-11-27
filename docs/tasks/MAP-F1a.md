TASK MAP-F1a — Frontline rule engine ("căn cứ giao tranh"): pure functions + Admin test switch. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/MAP-F1a.md, checklist docs/tasks/MAP-F1a.progress.md, tick items, final report docs/tasks/MAP-F1a.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol (lines approximate). Open ONLY: src/data/maps.ts (MAP_LANES ~254, SECTORS_CATALOG ~42), BaseRuntimeState / BaseFaction / PilotAccount.baseStates / unlockedSectorIds / AdminConfig in src/types/game.ts, src/engine/migration.ts admin sanitizer + createDefaultAdminConfig, the Admin CP base/sector tools in src/components/AdminPanel.tsx (grep adminSetBaseFaction). Related tests only, tsc. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged (new admin field optional, sanitizer default).

SCOPE: NEW pure engine file + one optional admin field + one Admin checkbox. Nothing in the store, map UI, battle or loop changes in this prompt (MAP-F1b uses it). New strings vi.ts AND en.ts.

ITEM 1 — New pure src/engine/frontline.ts. neighbours(id) from MAP_LANES (both directions). isContested(pilot,id) = faction hostile or neutral AND >= 1 neighbour allied (any status). isAlliedFrontline(pilot,id) = allied AND >= 1 neighbour hostile/neutral. isVisible(pilot,id) = allied OR neighbour of an allied node OR in pilot.unlockedSectorIds. noEnemyLeft(pilot) = no hostile/neutral node on the map. getBattleOptions(pilot,id,adminConfig) -> {kind:'assault'|'defend'|'patrol', allowed:boolean, reasonKey?:string}[]: assault if contested; defend if allied and underAttack; patrol if isAlliedFrontline OR noEnemyLeft; reason keys map.reason.notFrontline "Chưa tiếp giáp lãnh thổ ta", map.reason.rearBase "Căn cứ hậu phương, không có giao tranh", map.reason.hidden "Chưa phát hiện" (+ en twins). adminConfig.ignoreFrontline (optional, default false, sanitizer keeps a boolean) makes assault/patrol allowed on every visible node. pickDefaultBattle(options) = defend > assault > patrol (first allowed, else null). visibleNodeIds(pilot) helper.
ITEM 2 — Admin switch + numbers. Admin CP checkbox "Bỏ qua luật tiền tuyến (test)" (en "Ignore frontline rule (test)") next to the existing base/sector admin tools, stored in adminConfig.ignoreFrontline. Print in the report a table of getBattleOptions for EVERY node on a fresh save (and after capturing border_outpost).

HARD LIMITS: no behaviour change anywhere yet (nothing calls frontline.ts except tests and the report script); no layout change beyond the one checkbox.

TESTS: neighbours both directions; contested / frontline / visible per node on a fresh save; capture border_outpost -> next neighbours contested + visible; a rear allied node has no option; patrol when no enemy left; defend on underAttack; ignoreFrontline opens assault/patrol on visible nodes; hidden node has reason hidden; pickDefaultBattle order; sanitizer default false; vi/en parity.

CHECKS: related tests + tsc --noEmit / lint_applet only (MAP-F1b runs full vitest + build).

REPORT: items done + files changed; the option table (fresh save and after capturing border_outpost); tests old (379) -> new.
