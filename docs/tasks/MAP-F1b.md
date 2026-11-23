TASK MAP-F1b — Use the frontline rule: remove chain unlock, refuse battles on non-contested nodes, loop stop, bonus mission target, deploy button. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/MAP-F1b.md, checklist docs/tasks/MAP-F1b.progress.md, tick items, final report docs/tasks/MAP-F1b.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol (lines approximate). Open ONLY: src/engine/frontline.ts (F1a); src/data/maps.ts getNextSectorId (~286); src/engine/mapWorld.ts applyBattleBaseConsequences (~355-435, lane unlock ~394) and acceptBaseBonusMission (~273); src/store/useGameStore.ts finalizeBattleOutcome unlock block (grep getNextSectorId ~664), launchBattleForSector (~851), selectSector (~1642), startAutoRepeat (~1540) and the auto-repeat next-battle path (grep stopReason), acceptBaseBonusMission use (~1697); AutoStopReason in src/types/game.ts (~631); src/engine/migration.ts unlockedSectorIds lines (~645-650, ~729) ; MapView deployCtaLabel (~665, grep map.assaultBtn). Related tests while working; full vitest + production build ONCE at the end. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: engine + store + ONE deploy-button change. Map visuals are MAP-F2. Combat, rewards, raids unchanged. New strings vi.ts AND en.ts.

ITEM 1 — Use it. (a) Remove the getNextSectorId chain unlock from finalizeBattleOutcome (keep the export, mark it deprecated in a comment); unlockedSectorIds becomes history: after every battle and on load add every visible node, never remove one; the lane unlock in applyBattleBaseConsequences uses the same recompute; migration keeps adding the two start nodes as today. (b) launchBattleForSector refuses (no battle, toast with the reason) when the node has no allowed option; selectSector still allows any visible node. (c) Auto-repeat checks the rule before each next battle; new AutoStopReason 'node_not_contested' "Dừng: căn cứ không còn giao tranh" (+ en). (d) acceptBaseBonusMission targets a CONTESTED node only (fewest lane hops from the source base, ties by lower baseLevel), else the existing 'no_target_sector' result.
ITEM 2 — Deploy button. MapView deploy button is disabled with the reason as title/subtext when nothing is allowed; label and layout unchanged otherwise; the click uses pickDefaultBattle.

HARD LIMITS: fresh save = same first choices as today (Kestrel and Veridian assault, Aegis defend/patrol); no layout change; an allowed battle gives the same result as today for a fixed seed.

TESTS: launch refused on a non-contested node with the reason; allowed battle unchanged for a fixed seed; capture border_outpost -> new neighbours become contested and visible; loop stops with node_not_contested; bonus mission target is contested; unlockedSectorIds never shrinks; old save with chain-unlocked nodes loads and those nodes are not attackable unless contested; deploy button disabled state; vi/en parity.

CHECKS: npx vitest run (full, once), tsc --noEmit / lint_applet, production build.

REPORT: items done + files changed; tests old (386) -> new; NOT checked in a real browser (disabled deploy button).
