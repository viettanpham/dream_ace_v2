# TASK GEAR-L1 Report
- ITEM 1 done: added `desktopStatsExpanded` (default `false`) and collapsible `gear-stats-bar` (`gear-stats-toggle`, collapsed 6 key totals + conditional `gear-derived-accuracy` / `gear-stealth-detect-chip`, expanded `grid-cols-3 xl:grid-cols-4` all `STAT_KEYS` + `derivedMetrics`); removed old `lg:col-span-3` stats section.
- ITEM 2 done: refactored desktop layout into one `lg:grid-cols-12 items-start` grid with `lg:col-span-7` left column (paper-doll, `gear-stats-bar`, cargo inventory) and sticky scrollable `lg:col-span-5` right Detail column; adjusted `GearSlotTile` (`w-[58px] h-[62px] xl:w-[66px] xl:h-[66px]`) & `FighterSvg` below `xl` so 1024px rails fit cleanly; `< lg` phone layout unchanged.
- Files changed: `src/components/GearView.tsx`, `src/components/GearSlotTile.tsx`, `src/components/__tests__/gearDesktopLayoutL1.test.tsx` (new, 4 tests), `docs/tasks/GEAR-L1.progress.md`, `docs/CODEMAP.md`.
- `GearView.tsx` lines: 2915 -> 2923 (+8 net lines; baseline note 2914 -> 2923, +9).
- Checks: `npx tsc --noEmit` passed; `vitest --reporter=dot` passed 4 files / 18 tests (`gearPaperDollU2c1`, `gearDetailActionBarU2c2`, `gearRadarRad1b`, `gearDesktopLayoutL1`).
- Manual check: NOT checked in a real browser (1024/1280/1440px, sticky detail scroll, phone layout unchanged).
