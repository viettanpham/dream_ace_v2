# TASK MAP-M1 — Final Report

## Items Completed
- **STEP 0**: Audited phone detection (`useBattleLayoutMode()` in `src/utils/battleDisplay.ts` + `sm:`/`md:` Tailwind breakpoints), baseline 390px rendered heights, and existing pan/zoom mechanics; recorded findings in `docs/tasks/MAP-M1.progress.md`.
- **ITEM 1 (Phone `< 640px` compact header)**: Replaced the tall header card on `'phone-portrait'` with `data-testid="map-compact-header"` (`max-h-[72px]`): row 1 has a 1-line truncated `text-base` title plus a `40px` `(i)` button (`data-testid="map-info-btn"`) that opens `map.pageSubtitle` inside a `BottomSheet` (`data-testid="map-info-subtitle"`); row 2 renders compact single-line month and shortened income chips (`CR` and `WP`). Desktop and tablet (`>= 640px`) continue rendering `data-testid="map-desktop-header"` unchanged.
- **ITEM 2 (Phone big map & initial zoom)**: Applied `clamp(360px, 62dvh, 560px)` viewport height (`data-testid="map-viewport-box"`) on phone, extracted pure helpers `clampMapZoom`, `clampMapPan`, and `computeInitialPhoneMapView` so sector labels (`fontSize 11.5`) render `>= 11px` on screen while centered on `selectedSector.mapPos` and clamped inside viewport bounds. Preserved pointer drag, 2-finger pinch, and wheel zoom; moved zoom controls (`40px` buttons) to bottom-right (`data-testid="map-zoom-controls"`); moved pan hint to bottom-left (`data-testid="map-pan-hint"`) with a 4-second CSS `opacity` fade and non-overlapping width; reset-view restores initial phone zoom + centering.
- **ITEM 3 (Phone sticky action bar & i18n)**: Added `map.advanceMonthShort`, `map.deployShort`, `map.monthlyTotalShort`, and `map.infoBtnAria` to `src/i18n/vi.ts` and `src/i18n/en.ts`. Rendered `data-testid="map-phone-action-bar"` (`sticky bottom-0`) on phone with two `44px` buttons (`[Qua tháng]` / `advanceMonth()` and `[Xuất kích Lv.<level>]` / `startBattle(selectedSector.id)` with unit class in `title`) plus `pb-16` on the sector list container so the last list item stays visible above the sticky bar.
- **TESTS & DOCS**: Added `src/components/__tests__/mapM1.test.tsx` (pure initial zoom/centering/clamping test, 390px phone test, 1280px desktop + i18n parity test) and updated `docs/CODEMAP.md`.

## Files Changed
- `src/components/MapView.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/mapM1.test.tsx` (new)
- `docs/CODEMAP.md`
- `docs/tasks/MAP-M1.md` (new)
- `docs/tasks/MAP-M1.progress.md` (new)
- `docs/tasks/MAP-M1.report.md` (new)

## Checks
- **Tests (`npx vitest run`)**: `308 -> 311` tests passing (`49/49` test files, `311/311` tests).
- **`tsc --noEmit` (`lint_applet`)**: Passed with 0 errors.
- **Production build (`compile_applet`)**: Passed (`Build succeeded - the applet is compiled`).

## Real Browser Verification
- **NOT checked in a real browser**: Specifically unverified in a live mobile browser are real phone map size and label readability, touch pinch/drag feel, and visual placement of the sticky action bar above the mobile tab bar.
