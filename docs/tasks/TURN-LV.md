TASK TURN-LV — Level badge in the battle turn order. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save verbatim to docs/tasks/TURN-LV.md, create docs/tasks/TURN-LV.progress.md, tick items, final docs/tasks/TURN-LV.report.md and print it. On retry continue from the first unticked item.

RULES: ONE area = the turn order (src/components/TurnQueueBar.tsx: current actor row + "Tiếp theo" list) and the enemy detail card header. Add only a small badge; do not change row heights, order, spacing or any other block; phone and desktop identical; no horizontal overflow, nothing clipped at x=0; do not touch src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx, save version; strings in vi.ts AND en.ts; no placeholders.

TOKEN SAVING: read docs/CODEMAP.md first; TurnQueueBar.tsx is 1182 lines: grep "entry.name" / "actingEntry.name" and open only +/-25 lines around the hits (~588, 624, 875, 1009); find the enemy detail card header by grepping the "[ĐỊCH]" tag component; one item at a time; related tests only; append touched files to CODEMAP.

STEP 0 (read-only, max 6 lines): where the queue entry type is built and whether it has the unit level (CombatUnit.level); the file+line of the enemy detail card header; the current row height of the acting row and one Tiếp theo row.

ITEM 1 — add level to the queue entry (no new data, copy unit.level). New small component LevelBadge in src/components/LevelBadge.tsx: props level, refLevel (our deployed gear level), side. Renders "[25]" as a tiny boxed badge (font-mono, text-[10px]/[11px], border rounded, px-1, shrink-0, no wrap), title/aria-label t('battle.levelBadge', {level}) = "Cấp 25". Enemy colour = levelConClass(level - refLevel) from src/utils/levelCon.ts; allies neutral text-slate-300. It goes right before the name: acting row "[ĐỊCH] [28] Name > [25] Target" (both names), list rows "1 icon [25] Name   SPD 471". Truncation: name truncates, badge never does.

ITEM 2 — enemy detail card header: badge before the name using the same component.

TESTS: at most 3 small tests (LevelBadge colour per side/diff; queue row renders [level] before the name and its title; badge does not appear twice per row). No more, no refactor of old tests.

CHECKS: related tests only with --reporter=dot + npx tsc --noEmit; max 15 lines output; no full vitest, no build.

REPORT (max 12 lines): Step 0 numbers, items done, files changed, one test line, what was NOT checked in a real browser (phone + desktop).
