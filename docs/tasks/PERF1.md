TASK PERF1 — Cut always-on rendering cost (Firefox lag) + Low-effects setting. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/PERF1.md, checklist docs/tasks/PERF1.progress.md, tick items, final report docs/tasks/PERF1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol: "animation:" and "@keyframes" in src/index.css, "anim-", "blur-3xl", "backdrop-blur", "drop-shadow", "feGaussianBlur", "requestAnimationFrame", "setInterval" in src; open ONLY the hit lines. TitleScreen.tsx (~80-120 backdrop SVG, ~380 hero glow), src/components/FighterSvg.tsx (classes only), src/utils/statusDisplayPrefs.ts (pattern for a local pref). Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

STEP 0 (read-only, max 12 lines): list the INFINITE animations and blur / backdrop-filter / SVG filter / drop-shadow that are alive (a) on TitleScreen, (b) in the main shell + GEAR + Map, (c) in BattleScreen (per card). Mark which are SVG-element transforms (CPU-painted in Firefox).

ITEM 1 — Cheap fixes without changing the look much.
 a) TitleScreen: the fixed full-screen backdrop SVG keeps its static circles/lines but NOT the rotating sweep; draw the sweep as a small CSS-only div (conic/linear gradient, size of the outer ring, transform: rotate, will-change: transform, own layer) or make it static. Replace the hero "blur-3xl" div by a radial-gradient background (no blur filter). Move the hero hover (translate/rotate) to an HTML wrapper div around FighterSvg (not on the SVG element); thruster flicker uses opacity only (no scaleX on SVG parts).
 b) Pause: when document.hidden or the window is not focused, set data-paused="true" on <html>; CSS html[data-paused="true"] *, ::before, ::after { animation-play-state: paused !important }. Remove it on return.
 c) backdrop-blur: remove it from always-visible bars (sidebar, headers, battle HUD) and use a solid bg-slate-900/95; keep it only on open modals / sheets.
ITEM 2 — "Hiệu ứng" setting. Local pref perfMode 'auto' | 'full' | 'low' (localStorage via the statusDisplayPrefs pattern, NOT in the save). 'auto' = low when prefers-reduced-motion or navigator.hardwareConcurrency <= 4, else full. html[data-perf="low"] disables every infinite animation, blur, drop-shadow glow and shield-bubble pulse (one CSS block in index.css, no per-component code). Button on the title top controls next to the sound toggle and an entry in the existing settings area, cycling Auto / Đầy đủ / Tiết kiệm. Strings in vi.ts AND en.ts.

HARD LIMITS: no gameplay or battle number change; look in "full" stays about the same; no layout change; keep every data-testid.

TESTS: write at most 5 small tests in total; do not add tests beyond these; do not refactor existing tests. The 5: (1) perfMode persists and sets data-perf on <html>; (2) 'auto' resolves from hardwareConcurrency / reduced motion (mock); (3) hidden tab sets and clears data-paused; (4) TitleScreen has no blur-3xl element and no rotating SVG child; (5) the low-mode CSS block contains the infinite-animation selectors.

CHECKS: run ONLY the new test file and the existing title/settings test files that you touched, with --reporter=dot, then tsc --noEmit. Print at most 15 lines of output. On a failure re-run only the failing file. NO full vitest, NO production build.

REPORT (short): items done + files changed + one line of test result + what was NOT checked (real Firefox not measured). No tables, no test logs.
