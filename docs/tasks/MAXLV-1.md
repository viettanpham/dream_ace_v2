TASK MAXLV-1 — Admin max level. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save verbatim to docs/tasks/MAXLV-1.md, create docs/tasks/MAXLV-1.progress.md, tick items, final docs/tasks/MAXLV-1.report.md and print it. On retry continue from the first unticked item.

RULES: do not touch src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx; no save version bump; strings in vi.ts AND en.ts; existing gear/pilot levels are NEVER clamped down when the max is lowered; keep CS-BAL/LVL-1/LVL-2.

TOKEN SAVING: read docs/CODEMAP.md first; grep BALANCE_CONFIG.maxLevel and open only the hit lines; one item at a time; related test files only; append touched files to CODEMAP.

STEP 0 (read-only, max 10 lines): list every use of BALANCE_CONFIG.maxLevel (known: balance.ts:17, stats.ts ~324/336/409, migration.ts ~787/1207, starter.ts:37, progression.ts:10, AdminPanel ~399-405/1049, BattleResultDialog, BattleStatsModal, enemyLevel.ts clampEnemyLevel). Also report whether EXP-to-next-level and stat growth are formulas (work above 50) or fixed tables of 50 entries. If any table stops at 50, STOP after Step 0, write the report, and do not change code.

ITEM 1 — balance.ts: keep BALANCE_CONFIG.maxLevel = 50 as DEFAULT; add getMaxLevel() / setRuntimeMaxLevel(n) (module variable, default 50, clamp 20-100). Replace every runtime use of BALANCE_CONFIG.maxLevel with getMaxLevel() (progression, stats, starter, result dialogs, enemyLevel clamp). Existing levels above the new max are kept; only gaining new levels stops at the max.

ITEM 2 — adminConfig.maxLevel (int, default 50, sanitized 20-100) in types + migration.ts defaults/sanitize; the store calls setRuntimeMaxLevel on load and whenever adminConfig.maxLevel changes; AdminPanel ~399-405 and ~1049 show/edit it (one number field + short vi/en hint "không hạ cấp tàu đang có").

TESTS: at most 4 small tests (default 50; set 60 lets a pilot level past 50; lowering to 30 keeps a Lv45 gear at 45 but gains no new level; sanitizer clamps 5 -> 20 and 500 -> 100). Do not add more, do not refactor existing tests.

CHECKS: related test files only with --reporter=dot + npx tsc --noEmit; max 15 lines output; no full vitest, no build.

REPORT (max 12 lines): Step 0 findings, items done, files changed, one test line, what was NOT checked in a real browser.
