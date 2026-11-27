TASK UI-CL1 — label cleanup after RM1. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

RESUME: save this prompt to docs/tasks/UI-CL1.md, the checklist to docs/tasks/UI-CL1.progress.md, the final report to docs/tasks/UI-CL1.report.md (print it at the end). If those files already exist, continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first, grep by symbol, open only the line ranges below, run only the related test files while working and the full `npx vitest run` once at the end, append CODEMAP lines if needed. Do NOT enable Firebase. Baseline: 307 tests.

ITEM 1 — Sidebar unit panel header (src/components/BattleScreen.tsx, around lines 1846-1850): show only the row title (getRowTitle(sidebarUnit.row)), e.g. "Trung tuyến". Remove the " · " + getExposureLabel(exposure) part from both the title attribute and the visible text. If getExposureLabel (about line 1459) is then unused, delete it.

ITEM 2 — Radar lane header (src/components/BattleRadarView.tsx, around lines 2144-2153, headerParts): remove t('battle.rowExposed') ("Lộ diện") from the header. The bright lane border already shows exposure; keep data-row-state as it is. Keep rowLabel + buffText. buffText must never be cut mid-word by truncation: if the text is too long for the header, show only the first buff followed by "+N" (N = remaining buffs). Phone-collapsed lanes still show only rowLabel.

ITEM 3 — Keep i18n keys battle.rowExposed / battle.rowProtected / battle.rowEmpty in vi.ts and en.ts (test statusChipsG4a1 around line 715 expects them). Update only the tests that assert the removed header text. Add one test: radar lane header of an exposed lane has no "Lộ diện"; the sidebar header has no "Bảo vệ"/"Lộ diện"/"Trống".

HARD LIMITS: change nothing else (no layout, no sizes, no desktop/phone differences beyond the header text).

REPORT at the end: tests old -> new, tsc --noEmit, production build, files changed, and "NOT checked in a real browser".
