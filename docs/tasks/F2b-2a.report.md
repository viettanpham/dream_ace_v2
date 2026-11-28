# TASK F2b-2a Report
- ITEM 1: Added `RADAR_SIZE_THRESHOLDS` (`smallMax: 8`, `mediumMax: 20`), `getBattleSizeClass(units)` (alive + dead max side), and `data-size-class` on `battle-radar-container`.
- ITEM 2: Desktop lane fit keeps `n<=2` at `r=41` & legacy positions, sets `n=3` to `r=30` (w/ chip row), drops mini chips for `n>=4` (`r` in `[14,22]`), and switches to 2 sub-columns (`1/4` & `3/4` lane width, narrower name plates) when raw `< 14` (e.g., 8 ships/lane).
- ITEM 3: Phone keeps radius growth logic, drops mini chips when `n>=4`, and shrinks `r` down to `14` when `n>=3` bottom would exceed `lane bottom - 2`.
- Files changed: `src/utils/radarSizeLayout.ts` (new), `src/components/BattleRadarView.tsx`, `src/components/__tests__/radarSizeLayoutF2b2a.test.tsx` (new), `docs/CODEMAP.md`, `docs/tasks/F2b-2a.{md,progress.md,report.md}`.
- Tests: `npx vitest run --reporter=dot src/components/__tests__/radarSizeLayoutF2b2a.test.tsx src/components/__tests__/radarPopupFlight1.test.tsx && npx tsc --noEmit` -> 2 files, 8/8 passed, tsc clean (older unrelated assertions in `battleG3b`, `battleRadarDeclutterG4a3a`, `statusBoardFullChips` remain untouched per rule).
- Visual check: NOT checked in a real browser (8v8 screenshot case).
CHƯA chạy trình duyệt thật
