# TASK GEAR-L1 Progress

- [x] STEP A: Read `docs/CODEMAP.md`, record `GearView.tsx` baseline line count (`2914`), save `docs/tasks/GEAR-L1.md` & `docs/tasks/GEAR-L1.progress.md`
- [x] Add `desktopStatsExpanded` state (default `false`) in `src/components/GearView.tsx`
- [x] Refactor desktop outer layout to single `lg:grid-cols-12 gap-4 items-start` (`lg:col-span-7` left column + sticky `lg:col-span-5` right Detail column) without touching `< lg` phone layout
- [x] Replace old `col-span-3` stats section with collapsible `gear-stats-bar` (`gear-stats-toggle`, collapsed 4-6 key totals, expanded `grid-cols-3 xl:grid-cols-4` all `STAT_KEYS` + derived metrics + `gear-derived-accuracy` + `gear-stealth-detect-chip`)
- [x] Verify rails at 1024/1280/1440 (`gear-rail-left`/`gear-rail-right` shrink cleanly if tight) and inventory virtual grid at `col-span-7`, and `GearView.tsx` net line growth `<= ~80`
- [x] Add `<= 4` focused UI tests in `src/components/__tests__/gearDesktopLayoutL1.test.tsx`
- [x] Run `npx tsc --noEmit` and ONLY `gearPaperDollU2c1`, `gearDetailActionBarU2c2`, `gearRadarRad1b`, and `gearDesktopLayoutL1` (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/GEAR-L1.report.md` (<= 12 lines)
