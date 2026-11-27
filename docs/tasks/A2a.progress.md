# TASK A2a Progress

- [x] STEP A: Save `docs/tasks/A2a.md` & `docs/tasks/A2a.progress.md`, inspect `docs/CODEMAP.md` & target file ranges, capture `SKILLS_LIST` snapshot before moving to JSON
- [x] ITEM 1: Move `SKILLS_LIST` to `src/data/skills.json` (`schemaVersion: 1`, `registryTag: "sys"`), add `validateSkillDefinitions()` + `EFFECT_KIND_VALIDATORS` in `src/data/skills.ts` (< 300 lines), keep all existing exports & exact snapshot parity
- [x] ITEM 2: Add `SkillModDefinition`, `adminConfig.skillMods` (max 100), `MOD_EFFECT_KINDS`, `sanitizeSkillMods()`, catalog merge (`getSkillById`, `getSkillsForClass`, `getSkillName`/`getSkillDesc`), `sanitizeGearSkills` preserving `'mod_'` levels, disabled/missing mod blocking in `engine/skills.ts` + `combat.ts` + UI components, and SV1a export/import preservation
- [x] ITEM Y: Add live example lines under `skillMaxLevel`, `passiveScaleAfter5`, `restorePctCap` in `AdminPanel.tsx` + `vi.ts`/`en.ts` keys
- [x] ITEM Z: Fix `BattleUnitCard.tsx` popup clipping (`truncate` -> `whitespace-nowrap overflow-visible`) & `cardPopupQueue.ts` `estimatePopupBoxSize()` + `pickCardPopupEndPoint()` inset/centering
- [x] TESTS: Add max 6 focused tests in `src/engine/__tests__/skillModsA2a.test.ts` (snapshot equality, validator drop, `MOD_EFFECT_KINDS` seeded battle + drop unknown, disabled mod keep level/no effect/no equippedPassives, sys clash + clamp + export/import roundtrip, popup box inside 280px & 160px cards with no `truncate`)
- [x] CHECKS & REPORT: Run related tests (`--reporter=dot`) + `tsc --noEmit` + `lint_applet`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/A2a.report.md` (<= 15 lines)
