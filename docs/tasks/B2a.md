TASK B2a — Flux Transfer: multi-ally SP transfer (engine, NPC, Admin). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save verbatim to docs/tasks/B2a.md, create docs/tasks/B2a.progress.md, tick items, final docs/tasks/B2a.report.md and print it. On retry continue from the first unticked item.

RULES: do not touch src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx; no save version bump; strings in vi.ts AND en.ts; keep B1/CS-BAL/LVL-1/LVL-2; no battle UI change (count picker is B3, player auto is B2b).

TOKEN SAVING: read docs/CODEMAP.md first; grep symbols, open only line ranges: sup_flux_transfer in src/data/skills.ts (~405), effectKind union in src/types/game.ts (grep energize_single), energize_single case in combat.ts (~3310-3345, copy its log/popup style), performPlayerAction in useGameStore (grep), chooseAiDecision heal branch (combat.ts ~4011), AdminPanel.tsx only the B1 "Kinh tế SP" block (~1853). One item at a time; related tests only; append touched files to CODEMAP.

ITEM 1 — engine. New effectKind 'sp_transfer'; sup_flux_transfer: targetType all_allies (self excluded), effectKind sp_transfer, spCost 0, cooldown 5, unlockLevel 8 kept. adminConfig.fluxTransfer.levels = [{targets 3,pct 3,fee 10},{4,4,8},{5,5,5},{6,6,3},{7,8,1}] (sanitized; if skillMaxLevel != 5 interpolate linearly between first and last row). Pure resolveSpTransfer(units, actorId, skillLevel, cfg, count?): count = min(requested ?? max targets, max targets); targets = alive allies not full, lowest SP% first; amount each = floor(actor SP at cast x pct/100); received = min(amount, maxSp - sp); actor SP -= ceil(sum(received) x (1 + fee/100)), never below 0; popups "+N SP" per ally; one log line "<tên> truyền N SP cho K đồng đội (phí F)". performPlayerAction accepts optional transferCount for this skill (default max).

ITEM 2 — NPC + Admin. Pure pickFluxCount(units, actorId, rules, pressure, rng) (player auto will reuse it in B2b). NPC Support rule: reserve the SP its own ready heal/shield/revive skills need; cast only if at least 1 ally is under 50% SP and the support keeps >= 30% of its max SP after the transfer (lower k until it fits, skip if k = 0); k = allies under 50%, those with a usable skill costing more than their SP first; when its side is losing (hp+shield ratio 20 points below the other side) keep-self drops to 15%; when winning by 20+ only 50% chance. Remove the old energize_single use of this skill (other energize skills unchanged). Admin CP: the 5 level rows (targets, %, fee) inside the "Kinh tế SP" block.

TESTS: at most 5 small tests in total (L1 with 400 SP: 3 allies get 12 each, support loses 40; ally with 5 free SP receives 5 and fee counts only received; full allies skipped, lowest SP% first; count 1 hits 1 ally; NPC skips when no ally is under 50%). No more, no refactor of old tests.

CHECKS: related test files only with --reporter=dot + npx tsc --noEmit; max 15 lines output; no full vitest, no build.

REPORT (max 12 lines): items done, files changed, one test line, example L1/L3/L5 at support SP 240 (per ally, total moved, support cost), what was NOT checked in a real browser.
