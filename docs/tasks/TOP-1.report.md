# TASK TOP-1 Report
- ITEM 1: Removed `<LanguageToggle />` from the top bar header in `src/components/TopHud.tsx` (Settings sheet and `TitleScreen` unchanged).
- ITEM 2: Updated top-bar `tophud-admin-btn` to show whenever `ENABLE_ADMIN_CP` is true (dropped `adminUnlocked` gate for top bar), icon-only (`Sliders`, `hidden md:flex md:h-9 md:w-9`, `aria-label` + `title` = `t('admin.title')`), placed between Return-in-battle and mute button; kept cheats-active badge and Settings sheet Admin button unchanged.
- Files changed: `src/components/TopHud.tsx` (-3 net lines), `src/components/__tests__/topHudDeclutter.test.tsx` (new, 3 tests), `src/components/__tests__/battleFxFix2.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/TOP-1.progress.md`.
- Updated assertion: `src/components/__tests__/battleFxFix2.test.tsx:417-419` changed from `.toBeNull()` to `.not.toBeNull()` for `tophud-admin-btn` when `adminUnlocked: false` (since `ENABLE_ADMIN_CP` now reveals it on md+ without prior unlock).
- Checks: `npx tsc --noEmit` passed; `npx vitest run --reporter=dot` across all 10 TopHud/LanguageToggle/tophud-admin-btn test files -> 10 passed (67 tests).
- NOT checked in a real browser (top bar at 360 / 768 / 1280).
