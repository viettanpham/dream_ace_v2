# TASK S1b Progress

- [x] STEP A: Save `docs/tasks/S1b.md` & `docs/tasks/S1b.progress.md`, read `docs/CODEMAP.md`, grep symbols & inspect target ranges
- [x] ITEM 1: `adminConfig.skillMaxLevel` (1–20, default 5), `passiveScaleAfter5` (0–1, default 0.5), `restorePctCap` (0.1–1, default 0.8) across `balance.ts`, `skills.ts`, `migration.ts`, `combat.ts`, `FluxTransferPicker.tsx`, `SkillView.tsx`, `AdminPanel.tsx`, `useGameStore.ts`
- [x] ITEM 2: Real-number skill cards & tooltips (stat, value, duration, SP, CD, targets, next level, catalog icons next to words, zero "hiệu quả %") in `SkillView.tsx` + `vi.ts`/`en.ts`
- [x] ITEM 3: Configurable passive slots (`adminConfig.passiveSlots`, `getUnlockedPassiveSlots`, `gear.equippedPassives`, migration step `13 -> 14`, NPC auto-fill in `buildNpcSkillLoadout`, `SkillView.tsx` slot UI, `AdminPanel.tsx` section)
- [x] TESTS: Add max 6 focused tests (new `src/engine/__tests__/skillConfigS1b.test.ts` + vi/en parity)
- [x] CHECKS & REPORT: Run related tests (`--reporter=dot`) + `tsc --noEmit` + `lint_applet`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/S1b.report.md` (<= 15 lines)
