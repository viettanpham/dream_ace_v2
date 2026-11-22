# TASK G4a-3b Progress

- [x] Step 0 — Read-only audit (vitest baseline 281, radar container & height budget, unit status source, unit selection & marker highlight)
- [x] Item 1 — Desktop/tablet status board under radar (header 28px, Ta | Địch 2 columns, row 40px, max 6 chips + "+N", max 4 visible rows + inner scroll, hide dead/no-status, constant ~190px expanded height, empty muted line, collapsed = header only)
- [x] Item 2 — Phone status board (Ta stacked above Địch, rows in page flow, NO inner scroll, max 4 chips + "+N", collapsible header, keep 24px gap before log)
- [x] Item 3 — Collapse state saved per device outside save (`dreamAce.statusBoard.v1`, default expanded)
- [x] Item 4 — Row order (player first, then lane order front -> rear) and tap/click selects unit & highlights radar marker
- [x] Item 5 — Chip `title` and `aria-label` (status name, turns left, stacks)
- [x] Item 6 — Board NOT rendered in card mode
- [x] Tests — G4a-3b test suite covering all requirements
- [x] Checks — `npx vitest run`, `tsc --noEmit` / `lint_applet`, production build, final report in `docs/tasks/G4a-3b.report.md`
