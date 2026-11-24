# TASK PERF1 Progress Checklist

- [x] STEP 0 — Audit always-on infinite animations, blur / backdrop-filter / SVG filter / drop-shadow across TitleScreen, main shell+GEAR+Map, and BattleScreen (marking SVG-element transforms)
  - (a) TitleScreen: `<g class="anim-radar">` (**SVG transform**), `.blur-3xl` hero div, `FighterSvg` `<svg class="anim-ship-hover-hero">` + `<g class="anim-thruster">` (`scaleX`, **SVG transforms**).
  - (b) Main shell+GEAR+Map: `SidebarNav` `backdrop-blur-md`; `GearView` `.blur-3xl` + `FighterSvg` (**SVG transforms**); `MapView` `.anim-contested-pulse` (**SVG transform**), `.anim-raid-pulse`, `.anim-lane-flow`, sticky bar `backdrop-blur-md`.
  - (c) BattleScreen: phone bar `backdrop-blur-sm`; acting `.animate-pulse`; `BattleUnitCard` `.anim-turn-active` + `drop-shadow` + `FighterSvg` (**SVG transforms**); `TurnQueueBar` `.anim-turn-arrow`; `BattleRadarView` `.anim-radar-sweep`/`.anim-radar-star`/`.anim-token-hover`/`.anim-reticle-pulse` (**SVG transforms**), `.vfx-low-hp-pulse`, `drop-shadow`. Zero `feGaussianBlur` / `requestAnimationFrame`.
- [x] ITEM 1a — TitleScreen: CSS-only sweep div (no rotating backdrop SVG sweep), radial-gradient hero glow (no blur-3xl), HTML wrapper hover for FighterSvg, opacity-only thruster flicker
- [x] ITEM 1b — Pause always-on animations when `document.hidden` or window unfocused (`data-paused="true"` on `<html>` + CSS `animation-play-state: paused !important`)
- [x] ITEM 1c — Remove `backdrop-blur` from always-visible bars (sidebar, headers, battle HUD) -> solid `bg-slate-900/95` (keep on open modals/sheets)
- [x] ITEM 2 — `perfMode` (`'auto' | 'full' | 'low'`) pref in localStorage (`statusDisplayPrefs` pattern), `data-perf` on `<html>`, `html[data-perf="low"]` CSS block in `index.css`, TitleScreen + settings cycling toggle (`Auto / Đầy đủ / Tiết kiệm`), `vi.ts`/`en.ts` strings
- [x] TESTS & CHECKS — 5 focused tests, `docs/CODEMAP.md`, `--reporter=dot` on new/touched tests (max 15 lines) + `npx tsc --noEmit`, write & print `docs/tasks/PERF1.report.md`
