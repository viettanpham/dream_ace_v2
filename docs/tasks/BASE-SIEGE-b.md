TASK BASE-SIEGE-b — Base siege UI: Shield + HP bars, status label, repair buttons, list % and token pip. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save this prompt verbatim to docs/tasks/BASE-SIEGE-b.md, checklist docs/tasks/BASE-SIEGE-b.progress.md (tick items), final docs/tasks/BASE-SIEGE-b.report.md and print it. On retry continue from the first unticked item.

RULES: do not touch battleVfx.ts / BattleVfxOverlay.tsx; keep every existing feature; NO save change; new strings in vi.ts AND en.ts; engine from BASE-SIEGE-a is the single source (getBaseSiege, computeWinsToCapture, repairBaseHp, repairBaseShield in src/engine/baseSiege.ts and the store); do not change the pointer-capture logic or the r=32 hit circle of MapView nodes.

TOKEN SAVING: read docs/CODEMAP.md first, grep by symbol, line ranges only for files over 300 lines, one item at a time, do not enable Firebase.

STEP 0 (read-only, max 10 lines): where MapView.tsx draws (a) the selected-base briefing panel, (b) the base list rows (map list / bottom list), (c) the node token; where the existing BaseStatus label (operational / damaged / repairing) is shown; how adminConfig.baseSiege and campaignMonth are read in components. Then do the items.

ITEM 1 — Pure helpers in src/engine/baseSiege.ts: getBaseSiegeLabel(base, baseType, cfg, campaignMonth) -> 'ally_held' | 'contested' | 'recovering' | 'enemy_held' | 'neutral'. Rules: pool below max AND attacked fewer than regen.idleMonths months ago (or a raid just hit) = 'contested'; pool below max AND idle >= idleMonths = 'recovering'; pool full = by faction (allied -> ally_held, hostile -> enemy_held, neutral -> neutral). Also computeWinsRemaining(siege, cfg) = ceil(shield / shieldDamagePerWin) + ceil(hp / hpDamagePerWin) (0 when both 0) and getSiegePct(siege) = { shieldPct, hpPct } (0-100 integers).

ITEM 2 — Briefing panel: for the selected base add a "Căn cứ" block under the existing status line: two thin bars, Shield (cyan) and HP chiếm giữ (orange; red when Shield is 0 and HP < 30%), each with numbers current / max and the %; a label chip: Phe ta chiếm / Đang giao tranh / Đang hồi phục / Phe địch chiếm / Trung lập (colours green / amber / blue / red / grey); for non-allied bases one more line "Cần thêm ~N trận thắng để chiếm" (computeWinsRemaining). Keep the existing BaseStatus (operational / damaged / repairing) text as is. The block must fit the briefing width at 360px (no overflow, nothing at x<8) and never push the action buttons off screen.

ITEM 3 — Repair buttons (allied bases only, inside the same block): [Sửa HP +N · cost CR] and [Sửa Shield +N · cost CR] using computeBaseRepairAmount / computeBaseRepairCost for the real numbers; one tap calls repairBaseHp / repairBaseShield and shows the result in a one-line message under the buttons ("Đã sửa HP +150, -1.300 CR"). Disabled states with a short reason line from the action reasons: full ("Đã đầy"), cooldown ("Chờ N tháng"), no_credits ("Thiếu credit"), busy ("Đang bận"). Hidden for non-allied bases.

ITEM 4 — List + token: each base row in the map list shows a compact "S 50% · H 100%" (only when the pool is below max, otherwise nothing); the node token gets a tiny damage pip (max 6px, top-right of the token, amber when pool below max, red when Shield is 0): purely decorative, pointer-events none, no effect on the r=32 hit circle or the node size.

HARD LIMITS: the built-in 6-node map and a generated world both render; no layout change outside the briefing block, the list rows and the pip; 360px check = no horizontal overflow, nothing at x<8.

TESTS (max 5, small): getBaseSiegeLabel 5 cases; computeWinsRemaining; the briefing shows bars + label for a damaged hostile base and repair buttons only for allied; repair disabled reasons; token pip appears only below max. Do not refactor existing tests.

CHECKS: only the related test files with --reporter=dot, then tsc --noEmit; print at most 15 lines of output; on failure re-run only the failing file. No full vitest, no production build.

REPORT (<= 12 lines): items done, files changed, test result in one line, what was NOT checked (real browser, 360px). End with "CHƯA chạy trình duyệt thật".
