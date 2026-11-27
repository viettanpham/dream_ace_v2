# TASK SKSLOT-A Report
- Items done: STEP A, ITEM 1 (AdminConfig.activeSlots, DEFAULT_ACTIVE_SLOTS_CONFIG, sanitizeActiveSlotsConfig, getUnlockedActiveSlots, ACTIVE_SLOTS_HARD_MAX=9, skills.ts equip limits, migration/combat grandfathering, tactics per-gear priority length), ITEM 2 (SkillView unlocked + next locked tile, AutoTacticsModal priority cap, AdminPanel #active-slots w/ preview + 3 live examples, vi/en i18n), CODEMAP & tests.
- Files changed: src/types/game.ts, src/data/balance.ts, src/engine/{skills,tactics,migration}.ts, src/store/useGameStore.ts, src/components/{SkillView,AutoTacticsModal,AdminPanel}.tsx, src/i18n/{vi,en}.ts, src/engine/__tests__/activeSlotsSkslotA.test.tsx, docs/CODEMAP.md, docs/tasks/SKSLOT-A.{md,progress.md,report.md}.
- Checks: `vitest run activeSlotsSkslotA.test.tsx npcRoleSkillsNpcSk1.test.ts skillConfigS1b.test.ts admUi1.test.tsx --reporter=dot` -> 4 files / 18 tests passed; `npx tsc --noEmit` passed (0 errors).
- Not checked: full vitest suite, production build, real browser 360px layout/interaction.
CHƯA chạy trình duyệt thật
