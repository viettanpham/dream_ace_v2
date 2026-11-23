TASK G4a-2a-fix — remove the camera slot. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (first): save THIS WHOLE prompt verbatim to docs/tasks/G4a-2a-fix.md and create docs/tasks/G4a-2a-fix.progress.md with a checklist of items 1-4 (unticked); tick each item right after finishing it; at the end write docs/tasks/G4a-2a-fix.report.md and print it. If interrupted or retried: read both files and continue from the first unticked item.

RULES: do NOT touch src/utils/battleVfx.ts or src/components/BattleVfxOverlay.tsx; CURRENT_SAVE_VERSION stays 9; no other layout changes than listed; keep the removal of the "AUTO đang chạy" bar, the loop state in the control row, sound default OFF and the phone single-page scroll exactly as they are now.

1. Remove the camera slot completely: the battle-camera-slot element in BattleScreen.tsx (desktop and phone), nothing may reserve its height or leave a gap, so the player bar is followed directly by the unit area and the radar/cards get the space back.
2. Remove the "Camera hành động" toggle from EffectsSettingsPanel.tsx and delete src/utils/battleLayoutPrefs.ts if nothing else uses it (check first; if something else uses dreamAce.layout.v1, keep only that part). Remove the now-unused i18n key battle.actionCamera in vi.ts and en.ts.
3. Update tests: delete or rewrite the tests that expect the camera slot or the toggle (src/components/__tests__/battleLayoutG4a2a.test.tsx and any battleLayoutPrefs test); add one test that the battle screen renders no element with data-testid battle-camera-slot.
4. CHECKS: npx vitest run, tsc --noEmit (lint_applet), production build. REPORT (docs file + chat): what was removed, files touched, test count.
