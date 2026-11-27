# TASK EXT2a-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/EXT2a-1.md`, create `docs/tasks/EXT2a-1.progress.md`
- [x] Read targeted files (`CODEMAP.md`, `types/game.ts`, `data/items.ts`, `data/modules.ts`, `engine/itemPrice.ts`, `engine/equipment.ts`, `engine/shop.ts`, `data/itemPricing.ts`, `i18n`, filter/starter/autoEquip/admin random-item greps)
- [x] ITEM 1: Add `'module'` to `EquipmentSlot`, add `PaperDollSlot` & `ITEM_SLOTS`, update `EquippedSlotIds`/`EMPTY_EQUIPPED_SLOT_IDS`, update `InventorySlotFilter` + filter tabs + `slot.module`/`slotShort.module` in `vi.ts`/`en.ts`, keep `itemPricing.ts` validator excluding `'module'`, fix any `tsc`-forced files
- [x] ITEM 2: Export `MODULE_ITEM_TEMPLATES` in `src/data/modules.ts`, append to `ITEM_TEMPLATES` (update `itemDataLoader` snapshot), handle slot `'module'` in `generateItemInstance` and non-enchantable in `getEnchantMetadata` / `resolveEnchantAttempt`
- [x] ITEM 3: Filter `slot !== 'module'` out of `rollBattleItemDrops`, `generateShopStock`, `generateItemInstance` fallback pool, `starter`, `autoEquip`, and Admin random-item generator
- [x] Write `<= 5` tests in `src/engine/__tests__/moduleItemsExt2a1.test.ts`
- [x] Run `npx tsc --noEmit` first, then ONLY related tests (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/EXT2a-1.report.md` (<= 12 lines)
