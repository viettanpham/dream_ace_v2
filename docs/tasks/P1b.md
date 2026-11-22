TASK P1b — Phone battle: control row, destroyed-player line, legend button, radar-log gap. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see. This supersedes G4a-P1, which never reached this repo.

STEP A (first): save THIS WHOLE prompt verbatim to docs/tasks/P1b.md and create docs/tasks/P1b.progress.md with a checklist of items 1-5 (unticked); tick each item right after finishing it; at the end write docs/tasks/P1b.report.md and print it. If interrupted or retried: read both files and continue from the first unticked item.

RULES: PHONE ONLY (<=640px). Do NOT change anything above 640px, the radar markers and lanes, unit cards, the combat log content, the turn queue, src/utils/battleVfx.ts, src/components/BattleVfxOverlay.tsx; CURRENT_SAVE_VERSION stays 9; keep ST1, chips, SV1a, LP1 loop chip/popover, the orange SP token; new strings in vi.ts AND en.ts; no nested scroll box; no empty reserved space.

STEP 0 (read-only, max 8 lines): does docs/tasks/G4a-P1.report.md exist; the phone control row component, classes and widths (Tự động, speed, Radar/Thẻ, Lặp or the running loop chip "N/M + stop", "..."); how the "Chú giải" button is positioned and its z-index versus the sticky control row; the phone destroyed-player block height; the spacing between the radar bottom and the combat log header.

1. Control row: one row, every button h-10 (40px), min width 44px; "Tự động" = content width (max about 88px), no w-full / flex-1, green only while ON; order [Tự động] [speed] [Radar/Thẻ] [Lặp or the running loop chip] [...]; Radar/Thẻ icon-only with aria-label + title from vi/en; the row fits at 360px and 390px with the running loop chip (about 76px) showing, no wrapping, no horizontal scroll.
2. Destroyed player (phone): ONE slim line 28px: [TA] tag, struck-through name, chip "Đã phát nổ"; no empty box, no reserved status rows, no bars; the layout below moves up. The alive state stays as it is.
3. "Chú giải" must never cover the control row or any button: icon-only 32px button in the radar's top-right corner with a z-index BELOW the sticky control row; it opens the same legend as today.
4. Gap: 24px of space between the radar bottom and the combat log header on phone (one constant), so floating labels near the radar bottom do not run into the log; no clipping of markers or labels.
5. Tests (vitest): phone control row buttons carry the 40px class, "Tự động" has no full-width class, the loop chip fits the width budget computed from constants at 360px; destroyed player renders the slim line and no status area; legend button z-index class is lower than the control row and it sits inside the radar box; the 24px gap element exists on phone only; desktop/tablet markup unchanged; vi/en parity.

CHECKS: npx vitest run (baseline 263), tsc --noEmit (lint_applet), production build. REPORT: Step 0 facts, files touched, test count, the 360px width arithmetic of the row, what you could NOT verify in a real browser.
