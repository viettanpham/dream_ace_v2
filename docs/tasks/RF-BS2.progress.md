# TASK RF-BS2 Progress Checklist

- [x] 1. ITEM 1: Pure move of block "SHARED MORE ACTIONS ("...") MENU" (`BattleScreen.tsx` BottomSheet with `battle-more-menu`) into `src/components/BattleMoreActionsMenu.tsx`, preserving all `data-testid`, `id`, `aria-*`, and handlers.
- [x] 2. ITEM 2: Pure move of block "PHONE SKILLS BOTTOM SHEET" (`BattleScreen.tsx`) into `src/components/PhoneSkillsSheet.tsx`, preserving all `data-testid`, `id`, `aria-*`, and handlers.
- [x] 3. ITEM 3: Pure move of block "FIELD SUPPLIES & TACTICS BOTTOM SHEET" (including its `ErrorBoundary`) into `src/components/FieldSuppliesSheet.tsx`, preserving all `data-testid`, `id`, `aria-*`, `ErrorBoundary` wrapper, and handlers.
- [x] 4. TESTS & CHECKS: Add one render test per new component; verify related & full tests (`npx vitest run`), `tsc --noEmit` / `lint_applet`, and production build; update `docs/CODEMAP.md` and `BattleScreen.tsx` line count; write and print `docs/tasks/RF-BS2.report.md`.
