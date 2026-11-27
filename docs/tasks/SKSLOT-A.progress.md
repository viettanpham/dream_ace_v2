# TASK SKSLOT-A Progress

- [x] STEP A: Save `docs/tasks/SKSLOT-A.md` & `docs/tasks/SKSLOT-A.progress.md`
- [x] ITEM 1: Engine + config (`AdminConfig.activeSlots`, `DEFAULT_ACTIVE_SLOTS_CONFIG`, `sanitizeActiveSlotsConfig`, `getUnlockedActiveSlots`, `ACTIVE_SLOTS_HARD_MAX = 9`, `MAX_ACTIVE_SKILL_BAR`/`MAX_PRIORITY_SKILLS`, `skills.ts` equip limits, `migration.ts`/`combat.ts` grandfathering, `tactics.ts` unlocked slot priority)
- [x] ITEM 2: UI (`SkillView.tsx` unlocked + next locked active tile, `AutoTacticsModal.tsx` priority length, `AdminPanel.tsx` 3 fields + preview + live examples, `vi.ts`/`en.ts`)
- [x] TESTS & CHECKS & REPORT: <= 5 tests + related tests (`--reporter=dot`) + `tsc --noEmit`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/SKSLOT-A.report.md` (<= 12 lines)
