TASK LVL-1 — Enemy level by battle kind (Admin-editable). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save this prompt verbatim to docs/tasks/LVL-1.md, create docs/tasks/LVL-1.progress.md, tick items as you go, final docs/tasks/LVL-1.report.md and print it. On retry continue from the first unticked item.

RULES: do not touch src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx; no save version bump (adminConfig sanitizer in migration.ts only); new strings in vi.ts AND en.ts; keep B1/STATUS-1/SHOP-CONFIRM/CS-BAL features.

TOKEN SAVING: read docs/CODEMAP.md first; grep symbols, open only the named files and line ranges; one item at a time; run only the related test file after each item; append touched files to CODEMAP at the end.

STEP 0 (read-only, max 12 lines): open src/engine/combat.ts ~725-760 and generateNpcAllocations. Report (a) how a pirate-incident battle (PIRATE-1) and a Boss battle (sector.hasBoss / forceBoss) are launched, i.e. which BattleKind/sourceId they use; (b) a compact table for activeGear Lv20 and Lv50: NPC maxHp / maxShield / attackPower / defense / speed at enemy level = gear +0, +5, +10, +15, +20 vs the player default build at the same level. Do not change anything in Step 0.

ITEM 1 — new pure file src/engine/enemyLevel.ts: rollEnemyLevelOffset(kind, cfg, rng). Kinds: patrol, pirate, assault, defend, boss (mission/event use the assault range). Roll uniform in [min,max]; with probability peakChancePct use the peak value instead. Defaults (offset vs our gear level): patrol -5..+3 peak +5; pirate -3..+6 peak +10; assault +1..+10 peak +15; defend -3..+8 peak +12; boss +5..+10 peak +12. peakChancePct default 10 (0-100). enemyLevelCapOverMax default 10: enemy level = clamp(1, BALANCE_CONFIG.maxLevel + cap).

ITEM 2 — combat.ts ~735-755: one roll per battle for normal units (then + sector.levelOffset + the existing 0..1 unit jitter); the boss unit rolls the boss range separately and drops the old +1. If adminConfig.battleLevelOffsetOverride is not null it still wins (debug override). Do not change boss hp/atk multipliers.

ITEM 3 — adminConfig.enemyLevel {ranges per kind {min,max,peak}, peakChancePct, enemyLevelCapOverMax} + sanitizer (ints, min<=max, clamp -20..+50) in migration.ts defaults and sanitize; new src/components/admin/EnemyLevelAdminBlock.tsx (fields per kind, reset to defaults) mounted in AdminPanel.tsx with at most 3 changed lines near the battleLevelOffsetOverride field (~1447).

TESTS: write at most 4 small tests in total (rollEnemyLevelOffset stays inside min..max, peak chance 100 returns peak, cap clamp, sanitizer fixes min>max); do not add tests beyond these; do not refactor existing tests.

CHECKS: related test files only with --reporter=dot + npx tsc --noEmit; print at most 15 lines; no full vitest, no build.

REPORT (max 12 lines): Step 0 findings + table, items done, files changed, one test line, what was NOT checked in a real browser.
