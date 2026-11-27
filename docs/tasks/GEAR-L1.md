TASK GEAR-L1 — GEAR desktop layout: detail panel to the right column, stats become a collapsible totals bar. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/GEAR-L1.md, checklist docs/tasks/GEAR-L1.progress.md, tick items, final report docs/tasks/GEAR-L1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; GearView.tsx is ~2900 lines: NEVER read it whole. Open ONLY: the desktop top grid (~1335-1345), the stats section (~1650-1765) and the phone stats block (~1465-1545) as the pattern for the collapsible bar, the second grid start (~1765-1775), the inline detail section (~2830-2862). Related tests + tsc only. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged. New strings vi.ts AND en.ts.

SCOPE: DESKTOP ONLY (lg and up). Phone/tablet below lg stays exactly as it is (phone stats block, detail BottomSheet, phone slots).

NEW DESKTOP LAYOUT (one outer grid lg:grid-cols-12 gap-4 items-start):
- LEFT column (lg:col-span-7, flex-col gap-4) stacked top to bottom: (1) the paper-doll section (was col-span-9; now fills the 7-col column, keep its inner [auto_1fr_auto] grid and rails), (2) NEW collapsible stats bar, (3) the inventory section ("Hòm đồ", unchanged content, was col-span-7).
- RIGHT column (lg:col-span-5): the existing inline Detail section (renderDetailContent, heading, empty state) moved here. It must be STICKY so it stays visible while the inventory scrolls: lg:sticky lg:top-4 self-start with max-h-[calc(100dvh-2rem)] overflow-y-auto tactical-scroll (this is the only inner scroll box allowed, desktop only). The detail content/buttons are unchanged.
- The old right-hand stats section (col-span-3) is removed from its old place; the old detail section under the inventory is removed (moved, not duplicated; phone BottomSheet keeps calling renderDetailContent).

ITEM 1 — Collapsible stats bar (desktop, data-testid gear-stats-bar, toggle data-testid gear-stats-toggle): header row: title (gear.statsHeading), the "+/-" preview mark when isPreviewActive, and a chevron toggle. Default COLLAPSED. Collapsed = one wrapped row of the 4-6 most important totals (same ones the phone summary chips show) as "SHORT value (+delta)". Expanded = ALL STAT_KEYS in a grid (grid-cols-3 xl:grid-cols-4), each "SHORT value (+delta)". Values are the existing previewStats / statDeltas TOTALS only (no base + gear + skill breakdown). Colors for deltas as today (green/red). State: new useState desktopStatsExpanded (do not reuse the phone state). Reuse the existing Accuracy / Stealth rows currently in the old stats section (data-testid gear-stealth-detect-chip stays).
ITEM 2 — Move the detail section and wire the layout above. Keep every existing data-testid (detail-*, inv-*, gear-rail-*, auto-equip-*, ...) so existing tests keep passing.

HARD LIMITS: no change below lg; no horizontal overflow at 1024 / 1280 / 1440 px; the paper doll must still show all 12 slot tiles without clipping at 1280px (if the rails get too tight at 1024 let the rails shrink tiles, do not hide slots); the inventory virtual grid must still render (check its column logic still works at col-span-7); nothing at x<8; GearView.tsx must not grow by more than ~80 lines net.

TESTS: write at most 4 small tests in total; do not add tests beyond these; do not refactor existing tests. (1) desktop: gear-stats-bar renders collapsed by default and gear-stats-toggle expands it to all STAT_KEYS; (2) the detail section is rendered once (right column) and shows the selected item's detail; (3) the old stats section testids are gone / not duplicated; (4) phone stats block still exists (lg:hidden) unchanged.

CHECKS: tsc --noEmit first, then ONLY gearPaperDollU2c1, gearDetailActionBarU2c2, gearRadarRad1b and the new test with --reporter=dot; print at most 15 lines; on a failure re-run only the failing file. NO full vitest, NO production build.

REPORT (max 12 lines): items done + files changed; GearView.tsx lines before/after; one test line; NOT checked in a real browser (1024/1280/1440, sticky detail, phone unchanged).
