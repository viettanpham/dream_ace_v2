# TASK RAD1b Report
- ITEM 1 done: made `'radar'` live in `GearSlotTile.ts(x)` (`isEquipmentSlotKey`) and `GearView.renderPaperDollTile` (all 6 tile states, selection, unequip, equip preview; Extender tiles `ext1..ext5` stay locked), with cargo `RADAR` filter tab driven by `EQUIPMENT_SLOTS`.
- ITEM 2 done: added `trait.accuracy` / `trait.detectStealth` in `vi.ts`, `en.ts`, and `formatItemTraitsList()`, plus conditional `"Chính xác"`/`"Accuracy"` row (`> 0` or preview `> 0`, with preview delta + tooltip) and `"Dò tàng hình"`/`"Stealth detect"` chip + tooltip in both `GearView.tsx` and `GarageView.tsx`.
- Files changed: `src/components/GearSlotTile.tsx`, `src/components/GearView.tsx`, `src/components/GarageView.tsx`, `src/i18n/index.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `docs/CODEMAP.md`, `src/components/__tests__/gearRadarRad1b.test.tsx`.
- `GearView.tsx` lines: `2,848` before -> `2,914` after.
- Checks: `npx tsc --noEmit` passed (0 errors); vitest (`gearPaperDollU2c1`, `gearDetailActionBarU2c2`, `supplyLoadoutBarCsUi`, `garageCharacterU2a`, `st1Ui`, `autoEquip`, `gearRadarRad1b`) passed 7 files / 32 tests.
- NOT checked in a real browser (desktop rail at 1024-1440px, phone layout/cargo `RADAR` tab at 360px, full vitest suite, production build).
