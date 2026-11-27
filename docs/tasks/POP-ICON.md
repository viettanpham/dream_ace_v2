TASK POP-ICON — Icon cho số bay (thẻ + radar) và log. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/POP-ICON.md, checklist docs/tasks/POP-ICON.progress.md, tick items, final report docs/tasks/POP-ICON.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol; open only line ranges (BattleUnitCard.tsx, CombatLogList.tsx, BattleRadarView.tsx are big: NEVER read them whole). Open ONLY: src/utils/cardPopupQueue.ts (parseCardPopupDisplay ~179, getCardPopupSymbol ~221, getCardPopupArrow ~160), BattleUnitCard.tsx popup render (~560-640), BattleRadarView.tsx where it uses parseCardPopupDisplay (grep), src/data/iconCatalog.json + src/data/statusIconMap.ts (ids only), src/utils/combatLogFormat.ts (log.damage ~446-480 and the heal / burn / supply cases), CombatLogList.tsx only where a log row value is rendered. Related tests + tsc only. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged. UI only, no engine change (popup texts in combat.ts stay as they are; map them in the UI).

ITEM 1 — Popup icons. Extend parseCardPopupDisplay (keep its old exports working) so it returns icon + number segments from the popup text/tone:
- damage plain "-N" (tone damage) = `swords` + "-N" (replaces today's health_cross);
- crit (tone crit "-N") = `flare` (catalog SS04, amber) + "-N", text bigger as today;
- "SPLASH -N" = `explosion` (catalog SS05) + "-N" (the word SPLASH is dropped);
- "BURN -N" = `local_fire_department` (DT01) + "-N";
- heal "+N HP" = `heart_plus` + "+N" (as today);
- "+N SHD" and "SHD +N" = shield icon (BS05) + "+N";
- "+N SP" = `water_drop` + "+N", colored with the SP color (NOT the green DT03 status color); combined "+N SP +N SHD" = two icon+number pairs;
- buff/debuff labels "DEF / EVA / WPN / SKL / SPD / VULN / REGEN +N%", "LOCK xN", "BACK ROW +N% EVA": keep the arrow (up = buff, down = debuff, getCardPopupArrow) and replace the stat word by its catalog icon (DEF BF03, EVA BF04, WPN BF02, SKL BF02, SPD BF07, VULN DB09, REGEN BF09, LOCK CC02), the number stays;
- any text without a mapping (REDLINE FURY!, REVEALED!, evade labels...) stays plain text.
Colors = the existing popup tone colors. Icon size = text size (12px small tones, 14px others, crit larger as today). Keep data-testid damage-popup and card-popup-icon (data-popup-icon-kind gets the new kinds). Radar floating labels (BattleRadarView) and cards use the SAME mapper. effectsMode 'compact' filter (shouldShowCardPopup) unchanged.
ITEM 2 — Log icons. In CombatLogList render a small inline icon (same symbols and colors) before the numbers in the damage line (swords, or flare when CRIT), burn, heal, SP and supply-use lines (e.g. "Enemy_3 dùng Sửa chữa T3: [heart_plus] +800"). Keep the plain text strings produced by combatLogFormat unchanged for copy/search; if you need marker tokens, strip them wherever the text is exported or searched. Icon size = log text size; no change of log row height or row count; no horizontal overflow at 320-390px.

HARD LIMITS: no layout change of cards, radar or log rows; popups never leave the card; flight/settle timings unchanged; BattleUnitCard.tsx grows at most ~30 lines (put the mapper in cardPopupQueue.ts); the word is dropped only where an icon replaced it.

TESTS: write at most 4 small tests in total; do not add tests beyond these; do not refactor existing tests (update old expectations only where the icon change makes them stale, and say which). (1) mapper table: each text above -> symbol + number, unknown stays plain; (2) a damage popup renders swords + "-232", a crit renders flare, a splash renders explosion without the word SPLASH; (3) buff "DEF +20%" renders the up arrow + the DEF icon + "+20%"; (4) a log damage row renders an icon and the copied text is unchanged.

CHECKS: tsc --noEmit first, then ONLY cardPopup* / cardStatusPop / radar popup tests you touched + the new test with --reporter=dot; print at most 15 lines; no full vitest, no build.

REPORT (max 12 lines): items done + files changed; a short list "text -> icon" actually implemented; which old tests you updated; one test line; NOT checked in a real browser (cards, radar, log at 320-390px).
