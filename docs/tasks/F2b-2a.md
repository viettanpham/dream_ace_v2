TASK F2b-2a — Battle size classes + radar marker fit (small battles incl. 8v8, no overlap). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save this prompt verbatim to docs/tasks/F2b-2a.md, checklist docs/tasks/F2b-2a.progress.md (tick items), final docs/tasks/F2b-2a.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol; open only the line ranges named; add one CODEMAP line per file opened. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged. New strings (if any) vi.ts AND en.ts.

OPEN ONLY: src/components/BattleRadarView.tsx ranges DESKTOP_RADAR_TOKEN_RADIUS + computeLaneTokenRadius (~322-415), buildRowLanes (~423-600), computeUnitPositions (~603-640), RadarUnitMarker name plate + mini chips (~700-740, ~1163-1250), the callers of computeLaneTokenRadius (grep); src/utils/battleDisplay.ts ~83-89 and computeUnitRingArcs (~877). NEW file src/utils/radarSizeLayout.ts.

SCOPE: radar only. Card view, status board, sidebar, phone lane heights unchanged.

ITEM 1 — Size class (pure, radarSizeLayout.ts): RADAR_SIZE_THRESHOLDS = { smallMax: 8, mediumMax: 20 }; getBattleSizeClass(units) -> 'small' | 'medium' | 'large' from the LARGER side count (alive + dead, so it never changes mid-battle). Radar root gets data-size-class. Today only 'small' occurs; medium/large are drawn by later prompts (until then they render like small).

ITEM 2 — Desktop fit: usable = laneH - 20 (header) - 8. n <= 2: radius 41 and today's positions (unchanged). n = 3: footprint 2r + 51 (ring + name plate + chip row), r = clamp(floor((usable / n - 51) / 2), 17, 41) (= 30). n >= 4: NO mini chip row (statuses stay in the status board), name plate kept, footprint 2r + 16, r = clamp(floor((usable / n - 16) / 2), 14, 22); if that value would be below 14 (about 8 or more ships in ONE lane) the lane uses 2 sub-columns of ceil(n/2) ships each (columns at 1/4 and 3/4 of the lane width) with the same formula per column. Positions for n >= 3: slotH = usable / n, centre_k = lane.y + 28 + k * slotH + r + 2. The ring tiers of computeUnitRingArcs then apply by themselves (< 30 no SP ring, < 17 HP only). The floating label slot above the ring may overlap for its 600ms (not counted).

ITEM 3 — Phone: keep today's radius logic; for a lane with n >= 4 drop the chip row; rule "name plate (and chips when shown) bottom <= lane bottom - 2" (shrink r down to 14 if needed).

HARD LIMITS: lanes with <= 2 units identical to today (radius 41, positions within 2px); name plate and chips never drawn outside their lane; viewBox and radar size unchanged; no horizontal overflow; nothing at x<8.

TESTS (max 4): (1) class 4/8 small, 9 medium, 21 large; (2) fit radius n=1,2 -> 41, n=3 -> 30, n=4 -> 22; (3) 5 ships in a 366px lane: no vertical overlap (centre distance >= 2r + 12) and every name plate inside the lane, no chip row; 8 ships in one lane: 2 sub-columns, no overlap; (4) 2 units: radius 41 and old y. Do not add tests beyond these; do not refactor existing tests.

CHECKS: only related test files with --reporter=dot + tsc --noEmit; print at most 15 lines; no full vitest, no build.

REPORT (max 12 lines): items done + files changed; one test line; NOT checked in a real browser (8v8 screenshot case). End with "CHƯA chạy trình duyệt thật".
