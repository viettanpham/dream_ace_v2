TASK RAD1b — GEAR: Radar tile live + Accuracy / Stealth text. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/RAD1b.md, checklist docs/tasks/RAD1b.progress.md, tick items, final report docs/tasks/RAD1b.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol, open only line ranges (GearView.tsx is ~2850 lines: NEVER read it whole). Open ONLY: src/components/GearSlotTile.tsx (props); GearView.tsx renderPaperDollTile (~1247-1300, the branch that renders radar as locked) and the derived-stat rows array (~735-770, dodge + crit); GarageView.tsx the same rows array (~455-470); src/i18n/index.ts formatItemTraitsList (~612-645); trait.* keys in vi.ts/en.ts (grep 'trait.crit'); docs/tasks/U2c-0.report.md + U2c-1.report.md (data-testids only). Related tests + tsc only. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: GEAR + GarageView + the shared trait text helper. Extender tiles stay locked ("Sắp có"). No new layout, no new rows when the value is 0.

ITEM 1 — Radar tile live. In renderPaperDollTile only the Extender keys stay locked; slotKey 'radar' goes through the normal equipment-slot path (same GearSlotTile states as the other 6: empty, filled with rarity border and +enchant, selected, starter badge, tap = select slot, unequip, equip preview). Same size and position as today. The cargo slot filter tab "RADAR" must come from EQUIPMENT_SLOTS (check it renders and fits at 360px, one line).
ITEM 2 — Text. formatItemTraitsList adds "Chính xác +N%" / "Accuracy +N%" (key trait.accuracy) and "Dò tàng hình" / "Stealth detect" (key trait.detectStealth); this already feeds the item detail and shop cards, so no new component. vi.ts AND en.ts. Derived rows (GearView + GarageView): add row "Chính xác" N% ONLY when the value > 0 (hidden at 0, no placeholder), and a small chip "Dò tàng hình" ONLY when the gear has detectStealth; the equip preview delta shows the accuracy change like the other rows. Tooltip text: "Giảm né tránh của mục tiêu N điểm" / "Tấn công được mục tiêu đang tàng hình".

HARD LIMITS: no tile size or rail width change; nothing at x<8; no horizontal overflow at 360px; keep every data-testid in U2c-0.report.md and U2c-1.report.md; with no radar equipped the screen looks exactly as before.

TESTS: write at most 5 small tests in total; do not add tests beyond these; do not refactor existing tests: (1) radar tile renders empty / filled and tap selects the radar slot while the Extender tiles stay locked; (2) formatItemTraitsList returns the accuracy and stealth lines in vi and en; (3) accuracy row hidden at 0 and shown with a radar equipped; (4) equip preview delta for accuracy; (5) cargo tab RADAR present.

CHECKS: tsc --noEmit first, then ONLY the related test files (GearView / garage tests touched, the new test) with --reporter=dot; print at most 15 lines; no full vitest, no build.

REPORT (max 12 lines): items done + files changed; GearView.tsx lines before/after; one test line; NOT checked in a real browser (rail at 1024-1440, phone at 360px).
