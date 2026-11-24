# TASK TOP-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/TOP-1.md`, create `docs/tasks/TOP-1.progress.md`
- [x] Read `src/components/TopHud.tsx` (~95-110, ~245-300) and grep tests referencing `TopHud` / `tophud-admin-btn` / `LanguageToggle` / `showAdminBtn`
- [x] ITEM 1: Remove `<LanguageToggle />` from `TopHud.tsx` top bar header (keep Settings sheet & TitleScreen unchanged)
- [x] ITEM 2: Make top-bar `tophud-admin-btn` visible whenever `ENABLE_ADMIN_CP` is true (`hidden md:flex`, `md:h-9 md:w-9`, `Sliders` icon only, placed between Return-in-battle and mute button)
- [x] Write `<= 3` focused tests in `src/components/__tests__/topHudDeclutter.test.tsx` (and update any broken old assertion if needed)
- [x] Run `npx tsc --noEmit` and ONLY TopHud / tophud-admin-btn / LanguageToggle tests + new test (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/TOP-1.report.md` (<= 12 lines)
