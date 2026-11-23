TASK G4a-2d — Combat log: newest-first order, jump pill, compact header. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/G4a-2d.md, checklist docs/tasks/G4a-2d.progress.md, tick items, final report docs/tasks/G4a-2d.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first. Open ONLY src/components/CombatLogList.tsx (635 lines: scrollToBottom, isAtBottomRef, showJumpToLatest, roundOverrides, expandAll), src/utils/scrollStick.ts, src/utils/combatLogFormat.ts (log prefs, LOG_MODE_STORAGE_KEY), BattleScreen.tsx lines about 3105-3180 (desktop docked log header) and 495-535 (renderCombatLogExpandButtons), BattleSheets.tsx CombatLogPopupSheet. Run only related test files while working, full vitest once at the end. Add CODEMAP lines. Do not enable Firebase.

SCOPE: the combat log in ALL its places (desktop docked sidebar, phone inline log, popup sheet). Do NOT touch the turn queue, selected-unit panel, radar, cards, control row, VFX, engine/log generation. CURRENT_SAVE_VERSION unchanged. Preferences live per device outside the save. New strings in vi.ts AND en.ts.

ITEM 1 — Order + default expansion. New order toggle [Mới nhất trước | Cũ nhất trước], DEFAULT newest first, saved per device (key dreamAce.logOrder.v1). Newest first = rounds in descending order and lines inside a round newest on top; oldest first = today's behaviour. Only the 3 newest rounds are expanded by default, older rounds collapsed (Mở hết / Thu hết keep working and still clear manual overrides). Order only changes how entries are listed, never the log data.
ITEM 2 — Jump pill. Newest-first: the newest is at the TOP; if the player scrolled away from the top, new lines must NOT move the view and a pill "↑ N dòng mới" appears; tap = scroll to top and clear it. Oldest-first: keep the existing stick-to-bottom behaviour and the existing jump-to-latest pill ("↓ Mới nhất"). Reuse scrollStick helpers (mirror the threshold logic for the top). Works in docked, inlineFlow (phone page flow, no nested scroll) and popup.
ITEM 3 — Compact header (desktop docked + phone). Two rows only: row 1 = title + event count + [Dòng|Mở rộng] + popup button; row 2 = channel tabs (Tất cả/Ta/Địch/Hệ thống) + order toggle + Mở hết/Thu hết as small icon buttons (title + aria-label). No flex-wrap jumping on tablet widths just above 640px. Total log chrome (rows 1+2) <= 76px (was about 110px) so the list gains about 35px at 800px height. Keep every existing data-testid.

HARD LIMITS: right column height unchanged (the log is flex-1, the queue and unit panel stay as they are); no horizontal overflow; nothing at x<8; phone: no nested scroll in inlineFlow.

TESTS: default order newest first and persists; toggle reverses rounds and lines; only the 3 newest rounds expanded by default; Mở hết/Thu hết still work; pill appears when new lines arrive while scrolled away (newest-first) and not when at top; tap scrolls to top; oldest-first keeps stick-to-bottom; header is 2 rows with the listed controls; existing log tests green (update only superseded order/header assertions).

CHECKS: npx vitest run (once), tsc --noEmit / lint_applet, production build.

REPORT: items done + files changed; header height before/after from the code; tests old (302) -> new; what was NOT checked in a real browser (scroll behaviour on touch, 15x-30x speed with many new lines).
