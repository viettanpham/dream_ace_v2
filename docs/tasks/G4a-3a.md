TASK G4a-3a — Radar declutter (markers, floating labels, lanes). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/G4a-3a.md, checklist docs/tasks/G4a-3a.progress.md, tick items as done, final report docs/tasks/G4a-3a.report.md and print it. On retry continue from the first unticked item.

SCOPE: RADAR mode only (desktop/tablet + phone). Do NOT change card mode, right sidebar (panel/queue/log), control row, force bar, player block. No new blocks, no placeholders. The "Bảng trạng thái" board is NOT in this task.

RULES: keep CURRENT_SAVE_VERSION; keep all existing features (G4a-1, C1, C2, SB2, Q1, P1b, LP1); new strings in vi.ts AND en.ts; existing folders. src/utils/battleVfx.ts and src/components/BattleVfxOverlay.tsx: you may change ONLY position/queue of radar TEXT labels (damage, CRIT, EVADED, SKL, +HP); do not touch projectiles, beams, card-mode FX.

STEP 0 (read-only, max 10 lines in report): 1 run npx vitest run (expect 268). 2 files that render radar markers, lane headers, text tag pills, toast chips over the radar, floating labels. 3 current ring size and lane size at 1440x900 and 402px. 4 is every radar toast text also in the combat log? 5 where dead-unit ghost markers are drawn.

ITEMS:
1 Marker: ring 80px on desktop/tablet (phone: keep current, grow only if the lane has room); short name 1 line, truncate, full name in title; below it max 3 icon-only mini chips 20px (existing sort: debuffs first, fewest turns first) + "+N". REMOVE all text tag pills (TồnTh, Chậm, VK+, NE+, VỠ KHIÊN, TRƯỢT...). AUTO and lock = 16px corner badges on the ring (AUTO top-left, lock top-right).
2 Floating labels: one label per unit at a time (queue, ~600ms each, max 3 queued, drop older), in an 18px slot ABOVE the ring, fixed offset, never over the ring or another unit's name; clipped inside the radar box. No labels on dead units.
3 Lane header: one muted 20px line = lane name + "Lộ diện" only on the exposed lane (keep its highlighted border) + lane buff text (e.g. "+36% EVA") in the same line, truncate. Remove "Bảo vệ" and "Trống" texts.
4 Remove toast chips over the radar (if Step 0 item 4 finds a text that is NOT in the log, write it to the log instead).
5 Dead units: no ghost marker on desktop or phone. Phone only: a lane with no alive unit on that side collapses to one muted 20px line with the lane name.
6 "Chú giải" icon button (P1b) must not cover markers or lane headers.

HARD LIMITS: at 1440x900 the radar starts in the first screen and keeps its outer size (min 420); blocks above it unchanged (<=150px); no horizontal overflow; nothing starts at x<8; phone: no nested scroll, keep the 24px radar-to-log gap.

TESTS: <=3 mini chips + "+N" per marker; no text pills on markers; one floating label at a time per unit; no ghost for dead units; lane header without "Bảo vệ"/"Trống"; phone empty lane = 20px line; card mode unchanged (key assertions).

CHECKS: npx vitest run, tsc --noEmit / lint_applet, production build.

REPORT: Step 0 facts; each item done + files changed; tests old -> new; what was NOT checked in a real browser.
