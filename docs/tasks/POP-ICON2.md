TASK POP-ICON2 — Floating card popups: icon + Vietnamese text + optional icon. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/POP-ICON2.md, checklist docs/tasks/POP-ICON2.progress.md, tick items, final report docs/tasks/POP-ICON2.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol. Open ONLY: src/utils/cardPopupQueue.ts (parseCardPopupDisplay ~223-350, ICON_KIND_SYMBOLS, estimatePopupBoxSize); src/components/BattleUnitCard.tsx lines ~556-660 (popup render); the popup push sites in src/engine/combat.ts, supplies.ts, statusEngine.ts found by grep on `popups.push` and the texts below (line ranges only); src/data/iconCatalog.json rows DT03, SS02, BF11 (grep). Related tests only + tsc. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: popup display only. Engine popup texts stay as they are (keys/tags); ONE formatter maps them. Format of every popup: <leading icon, MANDATORY> text <trailing icon, OPTIONAL>. Number popups (-N, +N HP/SHD/SP) stay icon + number. New strings in vi.ts AND en.ts as popup.<kind> (vi shown below; en = the old English word). parseCardPopupDisplay segments must support a leading AND a trailing icon, and icons on BOTH sides of the text for the "both" rows.

ITEM 1 — Icons. SP icon = water_drop everywhere (popups, catalog rows SS02 and BF11 move from bolt to water_drop). Catalog row DT03 "Ăn mòn" icon -> bubble_chart (keep green, hexagon frame, down badge). Verify every icon name exists in @material-symbols/font-400 before use; there is NO `fortress` glyph: use `fort`. Item-use marker = package_2 (small, trailing, only for supplies.ts popups: +N HP / +N SHD / +N SP / REVEALED!). Active marker = check_circle green, inactive = cancel grey: ONE shared pair for ALL toggle/stance skills.
ITEM 2 — Table (vi text | leading icon | trailing icon):
- SHD -N: shield | none (text = -N). CRIT SHD -N: shield | explosion (SS05). CRIT -N (hull): hp (SS01) | explosion. Drains -N SP: water_drop; -N SHD: shield.
- EVADED "NÉ", EVADE ALL "NÉ", BARREL ROLL "LƯỢN VÒNG": air (BS06) on BOTH sides.
- COUNTER! "PHẢN ĐÒN": undo (SS14) | flash. Skill counter_stance (popup now COUNTER READY): "TƯ THẾ PHẢN ĐÒN": undo | check_circle green.
- STEALTH "TÀNG HÌNH", CAMO "NGỤY TRANG": visibility_off | none. REVEALED! "LỘ DIỆN": visibility. SHD BREAK "VỠ KHIÊN": shield_toggle. SHD CRACK "NỨT KHIÊN": the DB12 icon. SLOW "LÀM CHẬM": ac_unit. SILENCED "KHÓA KỸ NĂNG": block. REDLINE FURY! "CUỒNG NỘ": explosion. BURN status "THIÊU ĐỐT": DT01.
- CHARGING... "ĐANG NẠP": bolt_boost on BOTH sides. PURIFIED "THANH TẨY": cleaning_services on BOTH sides. FULL RECOVERY "HỒI PHỤC HOÀN TOÀN": health_cross on BOTH sides.
- generic ATK +N%: swords + "ATK +N%". Siege toggle "NEO PHÁO": anchor | check_circle green (on) / cancel grey (off); Fortress toggle "GIÁP PHÁO ĐÀI": fort | check_circle / cancel. GOD 0 / INVINCIBLE: unchanged (admin).
ITEM 3 — Size. estimatePopupBoxSize counts both icons (+22px each) so no popup is clipped at the card edge (the 160px card case).

HARD LIMITS: no engine / damage / save change; no layout change; popups never icon-only; same-seed battles identical.

TESTS (max 5, small): formatter gives leading+trailing segments for "CRIT SHD -242", "EVADED" (both sides), counter_stance (undo + check_circle), a supply "+120 SP" (water_drop + package_2 trailing); toggle skill ON vs OFF picks check_circle vs cancel; plain "-120" unchanged; box width for the longest text stays inside a 160px card; vi/en keys present.

CHECKS (slim): related test files with --reporter=dot + tsc --noEmit / lint_applet. NO full vitest, NO production build. Known old asserts: list in one line, do not fix.

REPORT (<= 15 lines): items done + files changed; the final table as implemented (text | icons); tests; NOT checked in a real browser.
