TASK SET-1 — Settings dialog bigger on desktop (90vw x 90dvh). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/SET-1.md, checklist docs/tasks/SET-1.progress.md, tick items, final report docs/tasks/SET-1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; open ONLY src/components/BottomSheet.tsx (whole, ~100 lines) and src/components/TopHud.tsx lines ~350-380 and the closing of that BottomSheet (~505-515). Do not read other files. Related tests + tsc only. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: layout size only. Do NOT re-arrange the settings content (no new columns, no new sections), do NOT touch mobile.

ITEM 1 — BottomSheet gets an optional prop size?: 'default' | 'large' (default 'default' = today's exact classes, so every other sheet is unchanged). size 'large' applies ONLY from md and up: panel md:w-[90vw] md:max-w-none md:h-[90dvh] md:max-h-[90dvh] (the existing max-h class must not fight it: when size is large use max-h-[90dvh] on md and keep today's max height on phone). Below md the panel is exactly as today (full width bottom sheet, same max height). The body stays the scroll container (bodyScrollable), header and footer stay pinned; the dialog stays centered on md and up.
ITEM 2 — The Settings sheet in TopHud.tsx passes size="large" (both the normal and the BATTLE menu use the same sheet, so both get it).

HARD LIMITS: no other sheet changes (keep the default size for every other BottomSheet user); no horizontal overflow at 1024 / 1280 / 1920 px; phone layout (<768px) pixel-identical to before; BottomSheet.tsx grows at most ~12 lines, TopHud.tsx at most 2 lines.

TESTS: write at most 3 small tests in total; do not add tests beyond these; do not refactor existing tests. (1) default size renders the old class set (md:max-w-lg present, no md:w-[90vw]); (2) size large renders md:w-[90vw] and md:h-[90dvh]; (3) the settings sheet in TopHud opens with the large classes (if TopHud is hard to render in a test, test through BottomSheet only and say so).

CHECKS: tsc --noEmit first, then ONLY the tests that mention BottomSheet / TopHud (grep) + the new test with --reporter=dot; print at most 15 lines; on a failure re-run only the failing file. NO full vitest, NO production build.

REPORT (max 12 lines): items done + files changed; one test line; NOT checked in a real browser (settings dialog at 1280/1920, phone unchanged).
