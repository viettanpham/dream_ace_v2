TASK SB3-RF1 — Status board badge fix + move 3 modal blocks out of BattleScreen.tsx. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/SB3-RF1.md, checklist docs/tasks/SB3-RF1.progress.md, tick items, final report docs/tasks/SB3-RF1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first. Open ONLY: src/components/RadarStatusBoard.tsx (item 1); in src/components/BattleScreen.tsx only the line ranges named in items 2-3 plus the import section and the state/handlers those blocks use (find with grep). Run only the related test files while working, full vitest once at the end. Add CODEMAP lines for new files and update the BattleScreen.tsx line count. Do not enable Firebase.

RULES: items 2-3 are PURE MOVES: no logic, style, text or behavior change; JSX moved verbatim into components that receive state and handlers as props; keep every data-testid, id and aria attribute; keep the same ErrorBoundary wrappers and render conditions in BattleScreen.tsx. Existing tests must pass with only import/selector path edits. CURRENT_SAVE_VERSION unchanged. Do not touch VFX files.

ITEM 1 — Status board badges clipped (src/components/RadarStatusBoard.tsx, constants at lines 14-20, row at about 140-200). Rows are 40px with overflow-hidden, chip 32px, corner badges overhang STATUS_BADGE_SAFE_PX (6px) so they are cut at the bottom. Fix: row height derived from constants = chip 32 + 2 x STATUS_BADGE_SAFE_PX + 4 = 48px; chip area must not clip vertically (overflow-y visible), side padding at least STATUS_BADGE_SAFE_PX; desktop expanded height constant = 28 header + 4 x 48 = 220px (replace the 190px constant and h-[190px] classes), max 4 visible rows then inner scroll, empty state keeps the same height, collapsed = header only; phone: same row height, no inner scroll. Nothing sibling may paint over the badges (relative rows, no z-index hacks). Radar and everything above it unchanged.
ITEM 2 — Move the AUTO-REPEAT per-battle toast and the AUTO-REPEAT BATCH SUMMARY MODAL (BattleScreen.tsx about lines 3296-3503) into new src/components/AutoRepeatDialogs.tsx.
ITEM 3 — Move the PHONE UNIT DETAIL SHEET and the COMBAT LOG POPUP SHEET (about lines 3528-3635) into new src/components/BattleSheets.tsx.

TESTS: item 1: row height equals chip + 2*safe + 4 from the constants, no clipping class on the chip area, desktop expanded height 220 for 0, 1 and 8 rows, phone has no inner scroll; items 2-3: one render test per new component (testids present) and the old tests green.

CHECKS: npx vitest run (once), tsc --noEmit / lint_applet, production build.

REPORT: item 1 constants old -> new; BattleScreen.tsx lines before (3687) / after; new files; tests old (293) -> new; estimated page scroll at 800px viewport height; what was NOT checked in a real browser.
