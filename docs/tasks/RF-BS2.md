TASK RF-BS2 — Move 3 more blocks out of BattleScreen.tsx (pure moves). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/RF-BS2.md, checklist docs/tasks/RF-BS2.progress.md, tick items, final report docs/tasks/RF-BS2.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first. Open ONLY src/components/BattleScreen.tsx line ranges named below (find them by the "{/* ====" marker comments, line numbers drift) plus the import section; grep the state/handlers each block uses. Run only the related test files while working, full vitest once at the end. Add CODEMAP lines for new files and update the BattleScreen.tsx line count. Do not enable Firebase.

RULES: PURE MOVES: no logic, style, text or behavior change; JSX moved verbatim into components that receive state and handlers as props; keep every data-testid, id and aria attribute, the same ErrorBoundary wrappers and render conditions in BattleScreen.tsx. Existing tests pass with only import/selector path edits. CURRENT_SAVE_VERSION unchanged. Do not touch VFX files.

ITEM 1 — block "SHARED MORE ACTIONS ("...") MENU" (about lines 3035-3201, the BottomSheet with data-testid battle-more-menu) -> new src/components/BattleMoreActionsMenu.tsx.
ITEM 2 — block "PHONE SKILLS BOTTOM SHEET" (about lines 3202-3294) -> new src/components/PhoneSkillsSheet.tsx.
ITEM 3 — block "FIELD SUPPLIES & TACTICS BOTTOM SHEET" (about lines 3399-3431, incl. its ErrorBoundary) -> new src/components/FieldSuppliesSheet.tsx.
If a block uses more than about 12 props, group them in one typed props object, but do not change any handler.

TESTS: one render test per new component (key testids present, open/closed, main handler called); old tests green.

CHECKS: npx vitest run (once), tsc --noEmit / lint_applet, production build.

REPORT: new files + line counts; BattleScreen.tsx lines before (3450) / after; tests old (295) -> new; what was NOT checked in a real browser.
