TASK SB1 — Selected-unit status area: fixed 2 rows (desktop/tablet sidebar). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (first): save THIS WHOLE prompt verbatim to docs/tasks/SB1.md and create docs/tasks/SB1.progress.md with a checklist of items 1-3 (unticked); tick each item right after finishing it; at the end write docs/tasks/SB1.report.md and print it. If interrupted or retried: read both files and continue from the first unticked item.

RULES: change ONLY the status area of the selected-unit panel (battle-selected-unit-panel) in the right sidebar, widths above 640px. Do NOT touch the turn queue, the combat log, unit cards, the radar, the phone layout, src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx; CURRENT_SAVE_VERSION stays 9; keep the orange SP token, the chips, the G4a-2b log modes; new strings in vi.ts AND en.ts.

STEP 0 (read-only, max 6 lines): how the status area height is computed now (FixedStatusArea autoHeight, rows min/max); everything that changes the right column heights between turns or when another unit is selected (panel, queue, log header).

1. The status area has a FIXED height of exactly 2 chip rows, computed from the existing chip row constants (2 x (chip height + row gap), no hard-coded pixels), for every unit and every moment: remove autoHeight and the 0-row / 1-row states. More statuses than 2 rows scroll INSIDE the area (overflow-y auto, thin scrollbar, no "+N" element). A unit with no statuses shows one muted centered line "Không có hiệu ứng" (key in vi.ts and en.ts) inside the same fixed box. Tapping a chip keeps opening its detail as today.
2. Make sure nothing else in the right column changes height from turn to turn (queue = header + actor + 4 rows as in G4a-2b, panel total height constant, log takes the rest, min 220px); list anything that still jumps.
3. Tests (vitest): the panel/status area height is identical for units with 0, 1, 2 and 5 statuses; the area has overflow-y auto and no "+N" element; the empty line exists in vi and en; the combat log container keeps flex-1 and min-h 220. Update the G4a-2b assertions that this task supersedes (0 rows when none, "+N" above 2 rows) and say so in the report.

CHECKS: npx vitest run (report the baseline you started from), tsc --noEmit (lint_applet), production build. REPORT: Step 0 facts, files touched, test count, the final panel height, what you could NOT verify in a real browser.
