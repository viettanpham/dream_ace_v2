TASK POPUP-SCALE — Card-view floating popups grow while flying to the card center (Admin CP configurable). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/POPUP-SCALE.md, checklist docs/tasks/POPUP-SCALE.progress.md, tick items, final report docs/tasks/POPUP-SCALE.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol. Open ONLY: src/utils/cardPopupQueue.ts (CardPopupConfig ~44, sanitize* ~100-160, resolveCardPopupConfig ~142, estimatePopupBoxSize ~830); src/components/BattleUnitCard.tsx popup render ~556-680; src/index.css @keyframes card-popup-flight (~411) and .anim-card-popup-flight (~464) only; src/types/game.ts AdminConfig card popup fields (~1613); src/engine/migration.ts admin sanitizer (~413 defaults, ~848); src/components/AdminPanel.tsx card popup block (~2957-3045) as the pattern + the radar scale fields (~3060) for wording; i18n keys admin.cardPopup*. Related tests only + tsc. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged (new admin fields optional, sanitizer defaults).

SCOPE: card-view popup size + 2 Admin fields. Radar popups unchanged. Popup content/format (POP-ICON2) unchanged. New strings vi.ts AND en.ts.

ITEM 1 — Fields + animation. AdminConfig gets cardPopupStartScalePct (default 100, clamp 50-200) and cardPopupEndScalePct (default 125, clamp 50-250), with sanitize functions + defaults in cardPopupQueue.ts, passed through resolveCardPopupConfig, migration sanitizer. BattleUnitCard sets CSS vars --card-pop-start-scale and --card-pop-end-scale (pct / 100) on the flight div; @keyframes card-popup-flight gets scale(var(--card-pop-start-scale, 1)) at 0% and scale(var(--card-pop-end-scale, 1.25)) at 100% appended AFTER the existing translate3d (same translate values, transform-origin center); the reduced-motion / pop-fade variants use the end scale statically. Text of every popup (icon + text + trailing icon) scales together.
ITEM 2 — Box + Admin. estimatePopupBoxSize and the zone clamp use max(start, end) scale so a scaled popup never leaves the card edge (the 160px card case). Admin CP card popup block gets 2 number fields "Cỡ chữ popup lúc bắt đầu (%)" and "Cỡ chữ popup khi vào giữa thẻ (%)" in the same style as the radar scale fields, each with a LIVE EXAMPLE line ("15px -> 19px") that recomputes from the typed value and the base font size 15px (12px small cards).

HARD LIMITS: no engine / damage change; same-seed battles identical; popups never clipped at the card edge; defaults 100/125 give the new look, 100/100 = exactly today's look; no layout change outside the Admin block.

TESTS (max 4, small): sanitizers clamp + defaults; resolveCardPopupConfig passes both; estimatePopupBoxSize grows with the larger scale and stays inside a 160px card; Admin fields write adminConfig and the live example line recomputes; old save without the fields loads with 100/125.

CHECKS (slim): related test files with --reporter=dot + tsc --noEmit / lint_applet. NO full vitest, NO production build.

REPORT (<= 12 lines): items done + files changed; keyframe lines before/after; tests; NOT checked in a real browser (overlap of larger popups).
