# TASK MAP-C2a Report
- Items done: STEP A, ITEM 1 (`AdminConfig.mapPack`, `sanitizeMapPack`, `setActiveMapPack` in-place refresh, `applyMapPack` w/ guards), ITEM 2 (`MapPackAdminBlock` export/import/restore + confirm dialog), TESTS & CHECKS.
- Files changed: `src/data/maps.ts`, `src/types/game.ts`, `src/engine/{migration,npcSupply,pirates}.ts`, `src/store/useGameStore.ts`, `src/components/admin/MapPackAdminBlock.tsx`, `src/components/AdminPanel.tsx`, `src/i18n/{vi,en}.ts`, `src/data/__tests__/mapPackAdminC2a.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/MAP-C2a.{md,progress.md,report.md}`.
- World reset fields on `applyMapPack`: `pilot.baseStates`, `unlockedSectorIds`, `capturedSectorIds`, `activeBonusMission`, `hiredWingman`, `pirateIncidents`, `sectorSupply`, `campaignMonth` (1), `worldClock` (`resetWorldClock()`), `selectedSectorId`, `adminConfig.mapPack`; untouched: character, gears, inventory, warehouse, credits, WP, skills.
- Checks: `mapPackAdminC2a.test.tsx` (5/5), `mapDataLoader.test.ts`, `frontline.test.ts`, `admUi1.test.tsx` (4 files / 21 tests passed, `--reporter=dot`) + `mapPackAdminC2a.test.tsx` fix re-run (5/5) + `npx tsc --noEmit` exit 0.
- Not checked: full vitest suite, production build, and live browser / 360px layout check.
CHƯA chạy trình duyệt thật
