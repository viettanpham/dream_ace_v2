# TASK MAP-F2 — Progress Checklist

- [x] STEP A — Save prompt verbatim to `docs/tasks/MAP-F2.md`, read `docs/CODEMAP.md` & allowed files, record STEP 0 phone heights
- [x] ITEM 1 — Nodes (`data-testid`, `data-state`: `allied` / `allied-frontline` / `contested` / `locked` + hidden omitted), lanes (`data-kind` + hidden omission), and legend (`Giao tranh`, `Chưa tiếp giáp` + en)
- [x] ITEM 2 — Briefing `"Trận có thể đánh"` option rows (`assault`/`defend`/`patrol` with `[Xuất kích]`) + muted blocked reason, phone sticky CTA (`pickDefaultBattle` + blocked sublabel) & desktop CTA
- [x] TESTS & CHECKS & REPORT — Add MAP-F2 tests, update `docs/CODEMAP.md`, verify `mapM1`, full `npx vitest run` ONCE, `lint_applet`, production build, write & print `docs/tasks/MAP-F2.report.md`
