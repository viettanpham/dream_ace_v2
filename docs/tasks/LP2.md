TASK LP2 — Loop defeat rule + extra speeds. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/LP2.md, checklist docs/tasks/LP2.progress.md, tick items as done, final report docs/tasks/LP2.report.md and print it. On retry continue from the first unticked item.

SCOPE: the loop ("Lặp") popover and the speed buttons in the battle control row, desktop/tablet and phone. Do NOT change the radar, card mode, right sidebar, force bar, player block or Admin CP. No placeholders. Control row height stays 40px; no horizontal overflow; nothing at x<8.

RULES: keep CURRENT_SAVE_VERSION (loop/speed prefs live outside the save, per device); keep LP1 (portaled popover, N/M and N/∞ counters, emerald running chip) and G4a-3a; new strings in vi.ts AND en.ts; existing folders. Do not touch projectile/beam code in src/utils/battleVfx.ts or src/components/BattleVfxOverlay.tsx.

STEP 0 (read-only, max 10 lines): 1 npx vitest run (expect 274). 2 where the loop prefs are stored (key) and where AUTO_REPEAT_MAX_DEFEAT_STREAK and the "Dừng khi thua" toggle live. 3 how the speed multiplier scales timers/animations (one place or many) and the list of allowed speeds. 4 how the G4a-3a radar floating label queue (600ms) behaves when speed is high.

ITEMS:
1 Loop popover "Khi thua": replace the "Dừng khi thua" toggle with 3 radio options: [Dừng ngay] [Dừng sau N trận thua liên tiếp] [Không dừng (đánh liên tục)]. N = number input inside that option, integer 1-99, default 3, clamp invalid input, remembered per device. Remove the hidden constant behaviour (the streak limit only applies in option 2, uses N). Migration of stored prefs: old toggle ON -> Dừng ngay, OFF -> Dừng sau N (N=3). Stop reason in the log/chip names the rule ("Dừng: thua 3 trận liên tiếp").
2 Speeds: allowed list becomes 1, 2, 3, 5, 10, 12, 15, 20, 30. Desktop/tablet: keep buttons 1x 2x 3x 5x 10x + a "…" button that opens a small popover (same portal + clamp x>=8 as LP1) with 12x 15x 20x 30x; when an extra speed is active the "…" button shows it (e.g. "20x") highlighted. Phone: keep the single speed button; tap opens the full list 1x-30x. Chosen speed remembered per device as today.
3 High speed safety: at 15x and above, radar floating labels are skipped (not queued) so the queue never grows behind the battle; battle result and log must be identical at any speed (engine not changed by speed).

TESTS: 3 options render and persist; N clamps to 1-99; option 2 stops exactly after N defeats in a row and resets on a win; option 3 never stops on defeat; migration of the old toggle; speed list contains the 9 values; "…" shows the active extra speed; label queue skipped at >=15x; same battle seed gives the same result at 1x and 30x.

CHECKS: npx vitest run, tsc --noEmit / lint_applet, production build.

REPORT: Step 0 facts; each item done + files changed; tests old -> new; what was NOT checked in a real browser.
