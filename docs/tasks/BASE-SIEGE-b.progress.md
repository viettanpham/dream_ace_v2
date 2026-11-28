# TASK BASE-SIEGE-b Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/BASE-SIEGE-b.md`, create `docs/tasks/BASE-SIEGE-b.progress.md`
- [x] STEP 0: Locate briefing panel, base list rows, node token, BaseStatus label, `adminConfig.baseSiege` / `campaignMonth` in `MapView.tsx`
- [x] ITEM 1: Pure helpers in `src/engine/baseSiege.ts` (`getBaseSiegeLabel`, `computeWinsRemaining`, `getSiegePct`)
- [x] ITEM 2: Briefing panel `"Căn cứ"` block (Shield + HP bars, label chip, wins remaining, keep BaseStatus, 360px fit)
- [x] ITEM 3: Repair buttons (allied only: `[Sửa HP +N · cost CR]`, `[Sửa Shield +N · cost CR]`, result line, disabled reason)
- [x] ITEM 4: List row `"S X% · H Y%"` (only below max) + node token top-right damage pip (max 6px, amber / red, pointer-events none)
- [x] TESTS: <= 5 small tests in `src/components/__tests__/baseSiegeUiB.test.tsx` + `vitest --reporter=dot` & `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/BASE-SIEGE-b.report.md` (<= 12 lines)
