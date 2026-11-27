TASK MAP-F2 — Map shows the frontline: contested nodes, frontline lanes, locked nodes, battle options in the briefing. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/MAP-F2.md, checklist docs/tasks/MAP-F2.progress.md, tick items, final report docs/tasks/MAP-F2.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol (lines approximate). Open ONLY src/components/MapView.tsx in ranges (briefing body renderBriefingBody ~661, deploy button + blocked reason ~958-980, lanes loop MAP_LANES.map ~1240, node rendering right after it, legend ~1517, phone action bar ~1679-1700), src/engine/frontline.ts, src/data/battleKinds.ts, src/components/__tests__/mapM1.test.tsx. STEP 0 (read-only, max 6 lines): today's heights of the phone info line, the phone sticky action bar and the map viewport. Related tests while working; full vitest + production build ONCE at the end. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: MapView only, desktop + phone. Engine rules unchanged. Phone MAP-M1 heights unchanged. New strings vi.ts AND en.ts.

ITEM 1 — Nodes and lanes. Give every node data-testid map-node-<id> (add it if missing) and a data-state computed from frontline.ts: allied = as today; allied-frontline = as today + small orange (#f59e0b) dot top-right; contested = orange 2px ring, slow pulse, chip "Giao tranh" under the name; locked (visible but hostile/neutral and not contested, e.g. a node seen earlier) = opacity 0.45 + small padlock badge, tap still opens the briefing; hidden = not drawn and its lanes not drawn. Lanes get data-kind: allied-to-contested = orange dashed 2px; allied-allied = today's style; others opacity 0.35; raid animation unchanged. Legend gets two entries: "Giao tranh" and "Chưa tiếp giáp" (en twins). No other new text over the map.
ITEM 2 — Briefing + buttons. New block "Trận có thể đánh" in renderBriefingBody: one row per ALLOWED option of getBattleOptions for the map kinds (assault / defend / patrol): icon + "Tấn công 4v4" / "Phòng thủ 4v4" / "Tuần tra 4v4" (size from the node) + [Xuất kích] that launches that kind. When nothing is allowed show ONE muted line with the reason (e.g. "Chưa tiếp giáp lãnh thổ ta — chiếm một căn cứ kề bên trước"). Phone sticky [Xuất kích] = pickDefaultBattle; disabled with the reason as sublabel when nothing is allowed; the label stays short when 2+ options exist (the list in the briefing is where to pick another). The desktop deploy button follows the same rule (keep the F1b blocked-reason testid).

HARD LIMITS: no horizontal overflow; nothing at x<8; phone info line and sticky bar heights unchanged; desktop map size unchanged; pulse off with prefers-reduced-motion; combat and rules unchanged.

TESTS: data-state per node state on a fresh save and after capturing border_outpost; hidden node not rendered; lane data-kind; option rows only for allowed kinds; disabled CTA + reason; phone sticky bar starts the default option; existing mapM1 tests still pass; vi/en parity.

CHECKS: npx vitest run (full, once), tsc --noEmit / lint_applet, production build.

REPORT: Step 0 heights; items done + files changed; tests old (403) -> new; NOT checked in a real browser (pulse, chip fit on phone).
