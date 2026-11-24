TASK TOP-1 — Top bar declutter: remove VI|EN, Admin CP icon always visible in dev. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/TOP-1.md, checklist docs/tasks/TOP-1.progress.md, tick items, final report docs/tasks/TOP-1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; open ONLY src/components/TopHud.tsx lines ~95-110 (showAdminBtn) and ~245-300 (right-hand controls), and grep tests that mention tophud-admin-btn / LanguageToggle / showAdminBtn. Related tests + tsc only. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: the top bar (header) only. The Settings sheet is NOT changed: it keeps its own LanguageToggle and its muted Admin button.

ITEM 1 — Remove the <LanguageToggle /> from the top bar header (TopHud.tsx ~275). Do not remove the one inside the Settings sheet (~391) and do not touch TitleScreen.
ITEM 2 — Admin CP button in the top bar: visible whenever ENABLE_ADMIN_CP is true (drop the adminUnlocked requirement for the TOP BAR button only; toggleAdminPanel already unlocks and persists). Make it ICON ONLY (Sliders icon, keep data-testid tophud-admin-btn, aria-label + title = t('admin.title'), no text label), same height as the neighbouring buttons (md:h-9, md:w-9), placed where the VI|EN toggle was (between Return-in-battle and the mute button). Show it from md and up only (hidden on phone: on phone the Admin button stays reachable through the Settings sheet as today). Keep the existing "cheats active" badge as it is.

HARD LIMITS: no change to the Settings sheet content; no change to phone layout except that the VI|EN toggle disappears from the phone top bar; no horizontal overflow at 360 / 768 / 1280 px; TopHud.tsx net change at most ~15 lines.

TESTS: write at most 3 small tests in total; do not add tests beyond these; do not refactor existing tests (update an existing assertion only if it expected the top-bar language toggle or the adminUnlocked rule, and say which). (1) the top bar renders no language toggle while the Settings sheet still has one; (2) with ENABLE_ADMIN_CP true and adminUnlocked false the top-bar tophud-admin-btn is rendered, icon only (no text); (3) clicking it calls toggleAdminPanel.

CHECKS: tsc --noEmit first, then ONLY the tests that mention TopHud / tophud-admin-btn / LanguageToggle (grep) + the new test with --reporter=dot; print at most 15 lines; on a failure re-run only the failing file. NO full vitest, NO production build.

REPORT (max 12 lines): items done + files changed; one test line; any existing test assertion you had to update; NOT checked in a real browser (top bar at 360 / 768 / 1280).
