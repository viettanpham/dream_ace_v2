# TASK SET-1 Report
- ITEM 1: Added optional `size?: 'default' | 'large'` prop (default `'default'`) to `src/components/BottomSheet.tsx` (+6 lines); `size="large"` applies `md:w-[90vw] md:max-w-none md:h-[90dvh] md:max-h-[90dvh]` from `md` up while preserving phone `<768px` and default sheet classes.
- ITEM 2: Passed `size="large"` on the Settings `BottomSheet` in `src/components/TopHud.tsx` (+1 line, shared by normal and BATTLE menus).
- Files changed: `src/components/BottomSheet.tsx`, `src/components/TopHud.tsx`, `src/components/__tests__/settingsSheetSize.test.tsx` (new, 3 tests), `docs/CODEMAP.md`, `docs/tasks/SET-1.progress.md`.
- Checks: `npx tsc --noEmit` passed; `npx vitest run --reporter=dot` on all 12 BottomSheet/TopHud test files -> 12 passed (78 tests).
- NOT checked in a real browser (settings dialog at 1280/1920, phone unchanged).
