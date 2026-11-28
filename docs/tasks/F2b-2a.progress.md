# TASK F2b-2a Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/F2b-2a.md`, create `docs/tasks/F2b-2a.progress.md`
- [x] ITEM 1: Size class (`src/utils/radarSizeLayout.ts`: `RADAR_SIZE_THRESHOLDS`, `getBattleSizeClass`, `data-size-class` on radar root)
- [x] ITEM 2: Desktop fit (`n <= 2` unchanged 41, `n = 3` -> `r = 30`, `n >= 4` drop chip row & `r in [14,22]`, 2 sub-columns when raw `< 14`)
- [x] ITEM 3: Phone fit (keep radius logic, drop chip row for `n >= 4`, shrink `r` down to 14 if needed so name plate + chips bottom `<= lane bottom - 2`)
- [x] TESTS: 4 tests + related test files (`--reporter=dot`) + `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/F2b-2a.report.md` (<= 12 lines)
