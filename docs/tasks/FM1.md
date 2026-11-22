TASK FM1 — Support/repair units ending in the FRONT lane (investigate, then fix). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/FM1.md, checklist docs/tasks/FM1.progress.md, tick items, final report docs/tasks/FM1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol; open only src/engine/formation.ts (autoPlaceFormation, pickRowForClass, enforceFormationCapacities), src/data/formationConfig.ts and the enemy spawn part of createInitialBattleState in src/engine/combat.ts (line ranges only). Run only the related test files while working; full vitest once at the end. Add one CODEMAP line for each new file you open. Do not enable Firebase.

PROBLEM: in a real battle a "Xeno Repair Tender" (class support, archetype repair_ship) stood in the FRONT lane while the middle lane still had a free slot. Role rules say support prefers middle/back. My hypothesis (verify, do not assume): strict classes (striker, siege) are placed first and the 25% random row swap can push a sniper (striker) into the middle row, so with capacity front 3 / middle 3 / back 2 the flex support overflows to the front.

RULES: do not change allies with formationCustomized = true; do not change capacities, row modifiers, save version, UI or VFX; keep deterministic output for a given rng seed except where the fix requires it.

ITEMS:
1 MEASURE: new test file src/engine/__tests__/formationLanes.test.ts. Build enemy battles through the same code path as startBattle for sizes 4, 6 and 8 over 500 seeds each. Count (a) support units placed in the front lane, (b) of those, cases where middle or back still had a free slot at the end, (c) siege units in the front lane. Print the counts per size in the report (before the fix).
2 If (a) > 0: find the root cause (cite function + lines) and fix it with the smallest change that keeps the role rules: a support unit must not take the front lane while middle or back has room, and random swaps of strict classes must not consume the middle/back slots that supports need (reserve them by counting supports first). Add regression assertions: over 500 seeds per size, support in front only if middle+back are completely full.
3 If (a) = 0 for fresh spawns: the cause is during the battle (units moved by skills such as retreat/advance, or rows shifting after deaths). Find which, say whether it is intended, and DO NOT change combat rules: report the cause and your proposal only.
4 Report the counts before and after.

CHECKS: npx vitest run (once), tsc --noEmit / lint_applet, production build.

REPORT: counts per size before/after, root cause, files changed, tests old (287) -> new, what was NOT checked in a real browser.
