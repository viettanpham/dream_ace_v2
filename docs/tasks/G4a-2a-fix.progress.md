# TASK G4a-2a-fix Progress

- [x] 1. Remove `battle-camera-slot` completely from `BattleScreen.tsx` (desktop and phone), reserving no height or gap
- [x] 2. Remove `"Camera hành động"` toggle from `EffectsSettingsPanel.tsx`, check usages & delete `src/utils/battleLayoutPrefs.ts` if unused, remove `battle.actionCamera` in `vi.ts` and `en.ts`
- [x] 3. Update tests (`src/components/__tests__/battleLayoutG4a2a.test.tsx` & any `battleLayoutPrefs` test) and add test asserting no `data-testid="battle-camera-slot"` on BattleScreen
- [x] 4. Run checks (`npx vitest run`, `tsc --noEmit`, production build) and write `docs/tasks/G4a-2a-fix.report.md`
