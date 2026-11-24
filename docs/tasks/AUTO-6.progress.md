# TASK AUTO-6 — Progress Checklist

- [x] STEP A — Save prompt verbatim to `docs/tasks/AUTO-6.md`, inspect `docs/CODEMAP.md` and target symbol ranges
- [x] ITEM 1 — Derive `MAX_PRIORITY_SKILLS = BALANCE_CONFIG.maxEquippedActiveSkills` (6), replace literal 3 in types/tactics/presets/modal/i18n (`(Tối đa {max}, A > B > C ...)`), keep `defensive` at 2 and saved configs unchanged
- [x] ITEM 2 — Update `BALANCE_CONFIG.maxTacticsRules = 12`, ensure generator keeps fixed rules first + priority + basic attack `<= 12`, sanitizer slices at constant, Custom counter `x/12` & add button disables at 12
- [x] TESTS & CHECKS & REPORT — Add AUTO-6 unit & modal tests (incl. 3-skill/8-rule snapshot), update `docs/CODEMAP.md`, run related vitest tests + `lint_applet` (`tsc --noEmit`), write & print `docs/tasks/AUTO-6.report.md`
