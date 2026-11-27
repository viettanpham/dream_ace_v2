# TASK AUTO-6 — Final Report

## Items Done
- **ITEM 1 — Priority 3 -> 6**:
  - Exported `MAX_PRIORITY_SKILLS = BALANCE_CONFIG.maxEquippedActiveSkills` (`6`) in `src/engine/tactics.ts` and replaced every literal `3` across `src/types/game.ts`, `src/engine/tactics.ts`, and `src/components/AutoTacticsModal.tsx`.
  - Updated `handleTogglePrioritySkill` to push while below `MAX_PRIORITY_SKILLS` and replace the last entry (`cur[cur.length - 1] = skillId`) when full; generated `priorityRankLabels` dynamically (`A`–`F`).
  - Updated `createSimplePresetConfig`: `aggressive`, `balanced`, and `support_team` (default) fill up to `6` non-elite bar skills in bar order, while `'defensive'` and `'save_sp'` keep their first `2`; `sanitizeSimpleTacticsConfig` preserves existing saved lists (e.g. 3-skill configs) without auto-fill.
  - Updated `'auto.simple.priorityLabel'` in `src/i18n/vi.ts` and `src/i18n/en.ts` to use `{max}` (`5. Kỹ năng ưu tiên (Tối đa {max}, A > B > C ...)` / `5. Priority Skills (Max {max}, A > B > C ...)`) fed by `MAX_PRIORITY_SKILLS`.
- **ITEM 2 — Rule limit 8 -> 12**:
  - Set `BALANCE_CONFIG.maxTacticsRules = 12` in `src/data/balance.ts`.
  - Confirmed `generateTacticsFromSimple` keeps fixed rules first (survival, heal, purge, elite/special policy), then priority skills in `A > B > ...` order up to `maxTacticsRules - 1`, with basic `attack` always last and total rules `<= 12`.
  - Confirmed Custom mode header shows `x / 12`, disables the "Add Rule" button at `12`, and `sanitizeGearTactics` clamps at `BALANCE_CONFIG.maxTacticsRules` while loading old `<= 8` rule lists unchanged.
- **TESTS**:
  - Added `src/components/__tests__/autoPriorityLimitA6.test.tsx` (7 tests) covering `MAX_PRIORITY_SKILLS` derivation, UI toggle + `A..F` badges + replace-last-when-full + `vi`/`en` label `6`, sanitizer filtering & no-auto-fill on saved 3-skill configs, preset defaults (`6` vs `defensive` `2`), generator fixed-first + `6` priority + basic attack last `<= 12`, exact 3-skill / `<= 8`-rule snapshot parity, Custom `12 / 12` counter + disabled Add Rule button + sanitizer clamping + 8-rule load + i18n parity.

## Files Changed
- `src/data/balance.ts`
- `src/types/game.ts`
- `src/engine/tactics.ts`
- `src/components/AutoTacticsModal.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/autoPriorityLimitA6.test.tsx` (new)
- `docs/CODEMAP.md`
- `docs/tasks/AUTO-6.md`, `docs/tasks/AUTO-6.progress.md`, `docs/tasks/AUTO-6.report.md`

## Checks & Tests
- **Related Vitest**: `npx vitest run src/components/__tests__/autoPriorityLimitA6.test.tsx src/engine/__tests__/engine.test.ts src/components/__tests__/u1BattleLock.test.tsx` -> **3 files / 55 passed** (`7` new in `autoPriorityLimitA6.test.tsx`, `39` in `engine.test.ts`, `9` in `u1BattleLock.test.tsx`).
- **Tests Count**: old full baseline `420` (from U2b) -> new `427` (`+7` new tests; full vitest not run per task instructions).
- **Typecheck / Build**: `lint_applet` (`tsc --noEmit`) + `compile_applet` -> passed.
- **Old Test Expectations Changed**: None. All `39` existing tests in `src/engine/__tests__/engine.test.ts` (including rule cap and simple tactics tests) passed unchanged.
