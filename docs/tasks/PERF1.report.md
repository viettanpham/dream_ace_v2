# PERF1 Report

- **Items done**:
  - **STEP 0**: Audited infinite animations, blurs, backdrop-filters, and drop-shadows across TitleScreen, main shell + GEAR + Map, and BattleScreen, marking SVG-element transforms.
  - **ITEM 1a**: Replaced TitleScreen's rotating SVG radar sweep with a CSS-only `div` (`conic-gradient` + `will-change: transform`), replaced the hero `blur-3xl` glow with a `radial-gradient` background, moved `FighterSvg` hover animation onto the outer HTML `<div>` wrapper, and switched `@keyframes thruster-flicker` to opacity-only.
  - **ITEM 1b**: Added `attachPerfDocumentListeners()` in `src/utils/perfPrefs.ts` (mounted in `src/App.tsx`) to toggle `data-paused="true"` on `<html>` when `document.hidden` or the window is unfocused, paired with `html[data-paused="true"]` CSS `animation-play-state: paused !important`.
  - **ITEM 1c**: Removed `backdrop-blur` from always-visible bars (`SidebarNav.tsx`, `BattleScreen.tsx`, `MapView.tsx`) in favor of solid `bg-slate-900/95` while keeping it on modals/sheets/toasts.
  - **ITEM 2**: Added `perfMode` (`'auto' | 'full' | 'low'`) localStorage preference in `src/utils/perfPrefs.ts`, `html[data-perf="low"]` CSS block in `src/index.css`, cycling `Auto / Đầy đủ / Tiết kiệm` controls in `TitleScreen.tsx` (next to sound toggle) and `EffectsSettingsPanel.tsx`, and bilingual keys in `src/i18n/vi.ts` and `src/i18n/en.ts`.
  - **TESTS & CHECKS**: Added 5 focused tests in `src/components/__tests__/perf1.test.tsx` and updated `docs/CODEMAP.md`.
- **Files changed**: `src/utils/perfPrefs.ts`, `src/components/TitleScreen.tsx`, `src/components/FighterSvg.tsx`, `src/components/EffectsSettingsPanel.tsx`, `src/components/SidebarNav.tsx`, `src/components/BattleScreen.tsx`, `src/components/MapView.tsx`, `src/App.tsx`, `src/index.css`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/__tests__/perf1.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/PERF1.md`, `docs/tasks/PERF1.progress.md`, `docs/tasks/PERF1.report.md`.
- **Checks**: `npx vitest run src/components/__tests__/perf1.test.tsx --reporter=dot` passed (1 file, 5/5 tests) and `npx tsc --noEmit` exited 0.
- **Not checked**: Real Firefox runtime FPS/CPU not measured; full vitest suite and production build skipped per task instructions.
