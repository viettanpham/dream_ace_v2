TASK G4a-3b — Bảng trạng thái (status board under the radar). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/G4a-3b.md, checklist docs/tasks/G4a-3b.progress.md, tick items as done, final report docs/tasks/G4a-3b.report.md and print it. On retry continue from the first unticked item.

SCOPE: RADAR mode only. ONE new block: the board, directly under the radar. Do NOT change radar markers/lanes (G4a-3a), card mode, right sidebar, control row, force bar, player block, loop/speed (LP2). No other placeholders. Do not touch projectile/beam code in src/utils/battleVfx.ts or src/components/BattleVfxOverlay.tsx.

RULES: keep CURRENT_SAVE_VERSION; keep G4a-1, C1, C2, SB1/SB2, Q1, P1b, G4a-3a, LP1/LP2; reuse StatusChip and the FixedStatusArea sort (debuffs first, fewest turns first), no new icon data; new strings in vi.ts AND en.ts; existing folders.

STEP 0 (read-only, max 8 lines): 1 npx vitest run (expect 281). 2 the file/container that renders the radar and the height budget below it at 1440x900 and 402px. 3 where unit statuses are read (same source as the selected-unit panel). 4 how unit selection and marker highlight work today.

ITEMS:
1 Desktop/tablet: board under the radar. Header 28px "Trạng thái · Ta N · Địch M" + collapse arrow. Two columns Ta | Địch. Row 40px = short name (~110px, truncate, full name in title) + StatusChip 32px x max 6 + "+N". Max 4 rows visible, then inner scroll. Hide units with no status and dead units. Expanded height is CONSTANT (about 190px) whatever the content, no jumping; if nobody has a status show one muted line "Không có hiệu ứng" inside it. Collapsed = header only.
2 Phone: Ta stacked above Địch, rows in page flow, NO inner scroll, chips max 4 + "+N", header collapsible; keep the 24px gap before the log.
3 Collapse state saved per device outside the save, key dreamAce.statusBoard.v1, default expanded.
4 Row order: player first, then lane order front to rear. Tap/click a row = select that unit and highlight its radar marker.
5 Each chip has a title/aria-label: status name, turns left, stacks (replaces the removed marker hover).
6 Board is NOT rendered in card mode.

HARD LIMITS: at 1440x900 the radar still starts in the first screen and keeps its size (min 420); blocks above it unchanged (<=150px); radar + board fit without hiding the radar bottom; no horizontal overflow; nothing at x<8; phone: no nested scroll.

TESTS: board only in radar mode; hidden units without status/dead; rows sorted player then front to rear; max 6 chips (desktop) / 4 (phone) + "+N"; collapse persists; tap selects the unit; constant height with 0, 1 and 8 rows; card mode has no board.

CHECKS: npx vitest run, tsc --noEmit / lint_applet, production build.

REPORT: Step 0 facts; each item + files changed; tests old -> new; what was NOT checked in a real browser.
