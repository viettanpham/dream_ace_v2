# TASK STATUS-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/STATUS-1.md`, create `docs/tasks/STATUS-1.progress.md`
- [x] Read `docs/CODEMAP.md`, `RadarStatusBoard.tsx`, `StatusChip.tsx`, `FixedStatusArea.tsx`, and grep card-mode status popover/sheet opener
- [x] ITEM 1: Update `RadarStatusBoard.tsx` to render `StatusChip` with `showLabel={true}` wrapping onto rows (no new chip/popover component)
- [x] ITEM 2: Implement row-max chip height (cap 2 visible rows, inner scroll + `+N` when max >= 3), click chip -> existing popover / phone bottom sheet, click unit name -> select unit, keeping collapse state & phone stacked/no-overflow limits
- [x] Tests: write at most 4 small tests covering full label, max row height, inner scroll when max >= 3, and chip click opening popover
- [x] Checks: `npx tsc --noEmit` + related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/STATUS-1.report.md` (<= 12 lines)
