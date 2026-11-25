TASK BRIEF-1 — Battle preview card in the map briefing. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save verbatim to docs/tasks/BRIEF-1.md, create docs/tasks/BRIEF-1.progress.md, tick items, final docs/tasks/BRIEF-1.report.md and print it. On retry continue from the first unticked item.

RULES: ONE area only = the "Trận có thể đánh" block in src/components/MapView.tsx (~1028-1100). Do not touch battle screen, src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx, save version. Strings in vi.ts AND en.ts. Phone and desktop use the same inline layout; do not change other blocks of the briefing; no horizontal overflow, no nested scroll box, nothing clipped at x=0; no placeholders.

TOKEN SAVING: read docs/CODEMAP.md first; open only MapView.tsx ranges ~340-392 and ~1020-1100, src/engine/enemyLevel.ts, combat.ts ~690-735 (archetypeRosterBySize); one item at a time; related tests only; append touched files to CODEMAP.

STEP 0 (read-only, max 6 lines): report the heights of the options block and a row, and whether archetypeRosterBySize can be exported/reused for a class mix (do not change it if it can't; then show only "Số tàu" and no mix).

ITEM 1 — enemyLevel.ts: pure getEnemyLevelBand(kind, cfg) -> {min,max,mid} (offset ranges from adminConfig.enemyLevel, pirate when kind event + isPirateIncidentId(sourceId), boss band when sector.hasBoss/forceBoss; mission/event = assault). New src/utils/levelCon.ts: levelConClass(diff) -> tailwind text class: diff>=5 text-red-400; 3..4 text-orange-400; -2..2 text-slate-100; -4..-3 text-slate-400; <=-5 text-sky-400.

ITEM 2 — MapView.tsx: replace estimatedEnemyLevel (~381) with activeGear.level + band.mid + sector.levelOffset for the default battle kind so reward estimates match the new levels.

ITEM 3 — clicking a row (not the deploy button) toggles an inline card under that row (one open at a time; aria-expanded; data-testid map-option-preview-<kind>): PHE TA: <size> tàu · Lv <gear level>; ĐỊCH: <size> tàu · Lv <min>-<max> (range coloured by levelConClass of the max diff vs our level; add "Boss" tag if boss); class mix line (if available); Thưởng ước tính (EXP/credit via calculateSingleEnemyReward at the mid level); red warning line only when max diff >= 5. Card is plain content, ~120px, no extra scroll.

TESTS: at most 4 small tests (levelConClass thresholds; getEnemyLevelBand for boss/pirate; row click opens the card and a second click closes it; deploy click does not toggle). No more, no refactor of old tests.

CHECKS: related tests only with --reporter=dot + npx tsc --noEmit; max 15 lines output; no full vitest, no build.

REPORT (max 12 lines): Step 0 numbers, items done, files changed, one test line, what was NOT checked in a real browser (desktop 1440x900 and phone).
