TASK FORM-ROW-1 — Formation defaults: Siege (tank) front, Striker/Interceptor middle, Support back; Admin row capacities default 8-8-8. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save this prompt verbatim to docs/tasks/FORM-ROW-1.md, checklist docs/tasks/FORM-ROW-1.progress.md (tick items), final docs/tasks/FORM-ROW-1.report.md and print it. On retry continue from the first unticked item.

RULES: do not touch battleVfx.ts / BattleVfxOverlay.tsx; keep every existing feature; NO save version bump; new strings (if any) in vi.ts AND en.ts; saves that already store adminConfig.formation keep THEIR numbers (only fresh saves and "Khôi phục mặc định đội hình" get the new defaults); a squad already placed by the player is never moved automatically (only the "Tự động sắp xếp" button and new-unit auto placement use the new preferences).

TOKEN SAVING: read docs/CODEMAP.md first, grep by symbol, line ranges only for files over 300 lines, one item at a time, do not enable Firebase. Open ONLY: src/data/formationConfig.ts (DEFAULT_FORMATION_CONFIG :13, CLASS_FORMATION_PREFERENCES :50), src/engine/formation.ts (auto placement, enforceFormationCapacities :432), the Admin formation block in AdminPanel.tsx (~3842 reset button), the vi.ts / en.ts row description strings.

ITEM 1 — Defaults: DEFAULT_FORMATION_CONFIG.rowCapacities = front 8, middle 8, back 8 (maxUnitsPerSide stays 8, row modifiers unchanged: front +10% DEF, back -10% DEF and +10% ranged damage). The Admin fields keep their 0-8 range; Admin "Khôi phục mặc định đội hình" restores 8-8-8. Update the comment above the constant.

ITEM 2 — Class preferences (CLASS_FORMATION_PREFERENCES): siege (the tank, shield icon) preferred ['front','middle','back']; striker ['middle','front','back']; interceptor ['middle','front','back']; support ['back','middle','front']; remove the flexPair of interceptor and support so placement is deterministic; keep placementPriority so strict classes place before flexible ones; overflow still goes to the next preferred row when a row is full (e.g. capacity set to 2 -> the 3rd siege goes to middle). Update the doc comment of the table.

ITEM 3 — Check every place that still assumes 3/3/2 or the old preferences (grep rowCapacities, front: 3, formationFrontCapacity, "Siege -> back"): the Admin live examples, i18n row descriptions, the NPC / enemy squad placement (same preferences, so enemies follow the same rule), the migration of old formationFrontCapacity / formationBackCapacity (must still map exactly as today). Tests that assumed 3/3/2 or the old preferences: fix them MINIMALLY (set the capacities / expected rows explicitly), list them in ONE line of the report, do not refactor other tests.

HARD LIMITS: no layout change anywhere; Admin range and the 8-per-side cap unchanged; 8v8 with one of each class and the default 8 squad: Siege -> front, Striker + Interceptor -> middle, Support -> back.

TESTS (max 3, small): auto-arrange of a mixed 8-unit squad puts siege front / striker + interceptor middle / support back; overflow goes to the next row when a capacity is lowered; fresh config = 8-8-8 and the reset restores it while an old save with 3/3/2 keeps 3/3/2.

CHECKS: only the related test files with --reporter=dot (formation tests + the ones you fixed), then tsc --noEmit; print at most 15 lines of output; on failure re-run only the failing file. No full vitest, no production build.

REPORT (<= 12 lines): items done, files changed, the fixed old tests in one line, test result in one line, what was NOT checked (real browser). End with "CHƯA chạy trình duyệt thật".
