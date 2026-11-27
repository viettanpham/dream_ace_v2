# TASK S1a Progress

- [x] STEP A: Save `docs/tasks/S1a.md` & `docs/tasks/S1a.progress.md`, read `docs/CODEMAP.md`, inspect target ranges, and record pre-edit 4v4 regression snapshot
- [x] ITEM 1: Create `src/data/statusEffects.ts` (51 catalog BF/DB/DT/CC + 5 `ENG_*` + `IMM_CONTROL` + helpers + `validateStatusEntries`) and rebuild `DEBUFF_TYPES` in `src/engine/prestage.ts`
- [x] ITEM 2: Update `ActiveStatusEffect` / `StatusEffectType` (`registry_effect`) / `statusIconMap.ts`; create `src/engine/statusEngine.ts` (`applyStatus`, `getStatusKey`, `getStatusStatModifier`, DoT/HoT tick & control immunity helpers); wire `prestage.ts` & `combat.ts`
- [x] ITEM 3: Wire registry-first chip icon/name/stacks lookup + registry log names + vi.ts/en.ts strings (no layout change)
- [x] TESTS: Write 5 tests in `src/engine/__tests__/statusRegistryS1a.test.ts` including pre-edit 4v4 regression assertion
- [x] CHECKS & REPORT: Run slim vitest + `tsc --noEmit` + `lint_applet`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/S1a.report.md`
