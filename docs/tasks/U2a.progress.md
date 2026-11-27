# TASK U2a — Progress Checklist

- [x] STEP A — Save prompt verbatim to `docs/tasks/U2a.md`, read `docs/CODEMAP.md` and target files/ranges
- [x] ITEM 1(a) — Create pure `src/engine/statBreakdown.ts` (`getStatBreakdown`) matching `calculateEffectiveStats` exactly
- [x] ITEM 1(b) — Update `GarageView.tsx` title/subtitle ("Nhân vật"/"Character"), active Gear summary block, and "Tổng chỉ số" 6-row source-segmented breakdown (desktop inline expand + phone BottomSheet) + `vi.ts`/`en.ts` strings
- [x] ITEM 2 — Update `GarageView.tsx` allocation controls (`+5`, `MAX`, press-and-hold auto-repeat on `+`/`-` with 400ms->120ms->60ms cadence, pointer/focus cleanup, 44px targets fitting 360px)
- [x] TESTS & CHECKS & REPORT — Add unit & UI tests, update `docs/CODEMAP.md`, run related vitest + `lint_applet` (`tsc --noEmit`), write & print `docs/tasks/U2a.report.md`
