# TASK SUP-GEN-a Progress

- [x] STEP A: Save `docs/tasks/SUP-GEN-a.md` & `docs/tasks/SUP-GEN-a.progress.md`
- [x] ITEM 0: Kho đồ > Tiêu hao fix (`GearView.tsx` real `battle_supply` name/icon/effect/tier, "Đưa vào Túi vật tư" / "Đã trong Túi" + "Bán" w/ notice, no silent no-op)
- [x] ITEM 1: Reward roller (`src/engine/supplyRewards.ts` + `adminConfig.supplyRewards` type & sanitizer)
- [x] ITEM 2: Hooks (Victory `finalizeBattleOutcome` + `BattleResultDialog` + log + auto-repeat, Mission completion reward hook + feedback)
- [x] ITEM 3: Hòm vật tư (`ConsumableKind` `'supply_crate'`, `sanitizeConsumables`, `useConsumable` branch, `GearView` notice & tinted crate icon, `vi.ts`/`en.ts`)
- [x] ITEM 4: Admin (`"Vật tư ngẫu nhiên"` & `"Tặng vật tư (test)"` sections w/ live examples, `vi.ts`/`en.ts`)
- [x] TESTS & CHECKS & REPORT: <= 6 tests + related tests (`--reporter=dot`) + `tsc --noEmit`, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/SUP-GEN-a.report.md` (<= 12 lines)
