TASK MAP-K1 — Battle kinds (assault / defend / patrol / mission / event) with one rule table. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/MAP-K1.md, checklist docs/tasks/MAP-K1.progress.md, tick items, final report docs/tasks/MAP-K1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol (lines approximate). Open ONLY: src/engine/frontline.ts (getBattleOptions, pickDefaultBattle ~189); BattleState in src/types/game.ts (~1079); createInitialBattleState (src/engine/combat.ts ~515); useGameStore launchBattleForSector (~875), finalizeBattleOutcome (~623), auto-repeat next-battle path (grep node_not_contested); mapWorld.ts applyBattleBaseConsequences (~375); BattleResultDialog.tsx title area (grep). Related tests while working; full vitest + production build ONCE at the end. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged (battle state is not saved).

SCOPE: engine/store + one result-dialog line. NO content for mission/event battles (H1/M add them). New strings vi.ts AND en.ts. Reuse the kind type already used by getBattleOptions in frontline.ts and extend it with 'mission' | 'event' (do not create a second type).

ITEM 1 — New src/data/battleKinds.ts BATTLE_KIND_RULES: assault {needsFrontline, capturesOnWin}, defend {needs allied+underAttack, clearsRaid}, patrol {needs allied frontline or endgame, no capture}, mission and event {needsVisible, requiresSource, never capture}. BattleState gets kind: BattleKind and sourceId: string | null. launchBattleForSector / startBattle take optional {kind, sourceId}; default = pickDefaultBattle (MAP-F1a). mission/event are refused unless a provider says the source is active: registerBattleSourceProvider(kind, (pilot, sourceId, nodeId) => {active, sizeOverride?, rewardMult?}), empty by default (no UI can start them yet).
ITEM 2 — Consequences by kind. applyBattleBaseConsequences reads battle.kind: capture only on an assault win; raid cleared only on a defend win; patrol/mission/event never change faction. activeBonusMission stays an overlay: it completes on a WIN of assault or defend at its target. Result dialog: one line "Loại trận: Tấn công | Phòng thủ | Tuần tra | Nhiệm vụ | Sự kiện". Auto-repeat keeps the kind of its first battle; if that kind is no longer allowed it stops (it already stops with node_not_contested since MAP-F1b; ADD only the new AutoStopReason 'source_inactive' "Dừng: nguồn nhiệm vụ/sự kiện không còn hoạt động" (+ en) for mission/event).

HARD LIMITS: assault/defend/patrol give the same results as today for a fixed seed (rewards, capture, raid clear); no layout change beyond the one line.

TESTS: rule table; default kind per node; capture only on assault win; defend clears raid; patrol never captures; mission/event refused without provider, accepted with a fake provider and never capture; bonus mission pays on an assault win; loop keeps kind and stops with source_inactive; fixed-seed equality for the three map kinds; vi/en parity.

CHECKS: npx vitest run (once at the end), tsc --noEmit / lint_applet, production build.

REPORT: items done + files changed; tests old (394) -> new; NOT checked in a real browser (result dialog line).
