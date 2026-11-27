# TASK S1b Report
- ITEM 1: `adminConfig.skillMaxLevel` (1–20, def 5), `passiveScaleAfter5` (0–1, def 0.5), `restorePctCap` (0.1–1, def 0.8), cost >Lv5 (`last * 1.8^n`); stored levels kept (`1..20`), effective clamped (`min(stored, cap)`).
- ITEM 2: Added `src/utils/skillDisplay.ts` (`formatSkillRealSummary`) & updated `SkillView.tsx` cards/tooltips/sheets with real numbers, next-level preview & `CatalogIcon` next to words; removed all `"hiệu quả %"` text.
- ITEM 3: Added `adminConfig.passiveSlots` (`{initial:2,everyLevels:5,max:12}`), `getUnlockedPassiveSlots()`, `gear.equippedPassives`, `equipPassiveToGear`/`unequipPassiveFromGear`, NPC passive backfill, `SkillView` slot row (`"Mở ở Lv<N>"`), Admin CP `"Slot passive"` + live preview.
- Save version: `13 -> 14` (`src/engine/migration.ts`, backfills learned passives into unlocked slots in `SKILLS_LIST` order).
- `skillMaxLevel` replaced: 11 files / ~26 usages (`balance.ts`, `skills.ts`, `engine/skills.ts`, `migration.ts`, `stats.ts`, `combat.ts`, `fluxAuto.ts`, `FluxTransferPicker.tsx`, `BattleScreen.tsx`, `SkillView.tsx`, `useGameStore.ts`).
- Other files changed: `src/types/game.ts`, `src/components/AdminPanel.tsx`, `src/components/{GarageView,GearView,GearSwapPicker}.tsx`, `src/i18n/{vi,en}.ts`, `src/engine/__tests__/skillConfigS1b.test.ts`, `docs/CODEMAP.md`.
- Checks: `npx tsc --noEmit` & `lint_applet` PASS; `skillConfigS1b` (6/6), `npcRoleSkillsNpcSk1` (3/3), `fluxTransferB2c` (5/5), `fluxTransferPickerB3` (5/5), `lidarStealthStA1` (5/5), `inventoryShopAdmin` (10/10) PASS.
- Known untouched legacy test asserts: `saveV10Migration.test.ts:68,236` (13 vs 14), `engine.test.ts:1070,1600,1802` (pre-existing B1 SP cost scaling).
- Browser check: NOT checked in a real browser.
