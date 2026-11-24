# TASK RAD1a-1 Report

Items done:
- Added `'radar'` as the 7th and last `EquipmentSlot` (`EQUIPMENT_SLOTS`, `EQUIPMENT_SLOT_META.radar`, `EMPTY_EQUIPPED_SLOT_IDS.radar = null`), replaced hardcoded 6-slot structures/counters (`getGearEquippedInstances`, `GearView` `/6` -> `EQUIPMENT_SLOTS.length`, `validatePriceFormula` slot check), kept U2c-1 locked Radar tile locked, and left `CURRENT_SAVE_VERSION` at `11` with no combat changes.
- Added `accuracyPct?: number` and `detectStealth?: boolean` to `ItemSpecialTraits`, allowed them in `validateItemTemplates`, summed/ORed them in `sumGearSpecialTraits`, and left `countNonZeroTraits` pricing both (`+traitPct` each).
- Appended 6 `'sys'` radar templates (`tpl_rd_scout`, `tpl_rd_fire_control`, `tpl_rd_wideband`, `tpl_rd_phased`, `tpl_rd_hunter`, `tpl_rd_aegis_eye`) to `items.json` and added `baseBySlot.radar: 176` in `itemPricing.json` and `DEFAULT_PRICE_FORMULA` (missing `radar` warns and falls back to `176`).
- Made `StarterSetConfig.slots.radar` optional with no default starter radar (so new saves and v11 saves without `radar` start with `equipped.radar = null`, and Admin CP starter table renders `"—"` when absent), plus `Radar` icon and `slot.radar`/`slotShort.radar` i18n keys.

Files changed:
- App & data: `src/types/game.ts`, `src/data/items.ts`, `src/data/items.json`, `src/data/itemPricing.json`, `src/data/itemPricing.ts`, `src/data/starterConfig.ts`, `src/engine/starter.ts`, `src/engine/equipment.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/GameIcons.tsx`, `src/components/AdminPanel.tsx`, `src/components/GearView.tsx`, `docs/CODEMAP.md`.
- Tests: `src/engine/__tests__/radarSlotRad1a1.test.ts` (new, 4 tests), `src/components/__tests__/garageCharacterU2a.test.tsx`, `src/engine/__tests__/statBreakdown.test.ts`, `src/data/__tests__/itemDataLoader.test.ts`, `src/data/__tests__/__snapshots__/itemDataLoader.test.ts.snap`, `src/engine/__tests__/cloudSave.test.ts`, `src/engine/__tests__/saveExport.test.ts`, `src/engine/__tests__/starter.test.ts`.

Old test expectations changed and why:
- `src/components/__tests__/garageCharacterU2a.test.tsx` (line 101) and `src/engine/__tests__/statBreakdown.test.ts` (line 30): added `radar: null` to `EquippedSlotIds` literals required by TypeScript after adding the 7th slot.
- `src/data/__tests__/itemDataLoader.test.ts` (lines 76-81) and `itemDataLoader.test.ts.snap`: updated `36` template length check to `42` and refreshed the JSON snapshots (`ITEM_TEMPLATES`, `ITEM_TEMPLATES_BY_ID`, `PRICE_FORMULA`, and `EQUIPMENT_SLOTS`-based generation/shop rolls) due to adding the 6 radar templates and `baseBySlot.radar: 176`.
- `src/engine/__tests__/cloudSave.test.ts` (line 209), `src/engine/__tests__/saveExport.test.ts` (line 211), and `src/engine/__tests__/starter.test.ts` (lines 49, 66, 87, 103, 143): changed `EQUIPMENT_SLOTS` starter-fill loops to expect `radar === null` because the default starter set omits `radar`.

Checks & runtime status:
- `npx tsc --noEmit` passed (0 errors), and all 22 affected vitest files passed (18 passed on first run + 4 updated files re-run and passed with 26/26 tests; `radarSlotRad1a1.test.ts` + 21 targeted existing suites).
- NOT checked in a real browser.
