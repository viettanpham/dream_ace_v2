TASK RAD1a-1 — Radar = 7th equipment slot: type, 6 items, pricing, save (no combat change, no new layout). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/RAD1a-1.md, checklist docs/tasks/RAD1a-1.progress.md, tick items, final report docs/tasks/RAD1a-1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol (lines approximate). Open ONLY: src/types/game.ts EquipmentSlot (~337), ItemSpecialTraits (~347), EquippedSlotIds (~528), StarterSlotConfig/StarterSetConfig (grep); src/data/items.ts lines 1-30; src/data/items.json (APPEND only: grep one cpu row as the pattern, do NOT read the whole file); src/data/itemPricing.json + the validator in src/data/itemPricing.ts (~30-110); src/engine/equipment.ts getGearEquippedInstances (~319), sumGearSpecialTraits (~364), countNonZeroTraits import (~15, ~195); src/data/starterConfig.ts; src/engine/migration.ts equipped sanitizer and starter sanitizer (grep EQUIPMENT_SLOTS); i18n keys slot.* and slotShort.* (vi.ts + en.ts). Run tsc --noEmit first: it lists every place forced by the new slot; fix each with the MINIMUM change (GearView slot count and the "/6" counter -> EQUIPMENT_SLOTS.length, ShopScreen ~151 / ~202, AdminPanel starter loop ~965). Never open whole big files. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: type + data + type-forced minimum edits only. NO combat change (accuracy and stealth are RAD1a-2), NO new GEAR tile (the U2c-1 locked Radar tile stays locked until RAD1b). Enemies get no radar. New strings vi.ts AND en.ts.

ITEM 1 — Slot + items.
- EquipmentSlot adds 'radar' (LAST in EQUIPMENT_SLOTS); EQUIPMENT_SLOT_META.radar { label 'Radar', shortLabel 'RADAR', classLocked false }; EMPTY_EQUIPPED_SLOT_IDS.radar null; slot.radar "Radar" / slotShort.radar "RADAR" (vi + en). Replace hard-coded slot lists / counts with EQUIPMENT_SLOTS (getGearEquippedInstances literal, "/6" -> EQUIPMENT_SLOTS.length, comments "6 slots").
- ItemSpecialTraits gets accuracyPct?: number and detectStealth?: boolean; sumGearSpecialTraits sums accuracyPct and ORs detectStealth; countNonZeroTraits counts both (price +traitPct each). Nothing reads them in combat yet.
- Append 6 rows to items.json (registryTag "sys", basePrice consistent with the D1-2a formula, nameVi/nameEn/descVi/descEn short):
  tpl_rd_scout "Radar Trinh Sát"/"Scout Radar" T1 Lv1: evasion 3-6, attack 2-4, affix [evasion, attack, fuel, spirit], {accuracyPct 4}
  tpl_rd_fire_control "Radar Điều Khiển Hỏa Lực"/"Fire-Control Radar" T2 Lv3: attack 5-9, evasion 3-6, affix [attack, evasion, fuel, spirit], {accuracyPct 6, critBonusPct 3}
  tpl_rd_wideband "Radar Dải Rộng"/"Wide-Band Radar" T2 Lv4: spirit 6-10, fuel 3-6, affix [spirit, fuel, shield, evasion], {accuracyPct 5, detectStealth true}
  tpl_rd_phased "Radar Mảng Pha"/"Phased-Array Radar" T3 Lv6: evasion 8-12, attack 6-9, affix [evasion, attack, spirit, fuel], {accuracyPct 9, critBonusPct 4}
  tpl_rd_hunter "Radar Săn Mồi"/"Hunter Radar" T3 Lv6: attack 8-12, spirit 5-8, affix [attack, spirit, evasion, defense], {accuracyPct 8, detectStealth true}
  tpl_rd_aegis_eye "Mắt Thần AEGIS"/"AEGIS Eye" T4 Lv9: attack 10-15, evasion 8-12, affix [attack, evasion, spirit, shield, fuel], {accuracyPct 12, critBonusPct 4, detectStealth true}
- itemPricing.json baseBySlot.radar 176; the validator checks every EQUIPMENT_SLOTS entry (missing radar -> default 176 with a warning).
- Starter: StarterSetConfig.slots.radar is OPTIONAL; the default starter set has no radar (new saves start with an empty radar slot); starter sanitizer and the Admin starter loop accept a missing radar (minimum change, show "—").
- Save: no version bump. Old saves get equipped.radar = null through the existing EQUIPMENT_SLOTS loop in the sanitizer. Drops (rollBattleItemDrops) and shop stock already loop over templates / slots: radar items drop and appear in stock with no special code; sell ratio unchanged.

HARD LIMITS: the 36 old templates unchanged; with no radar equipped nothing in combat changes; no layout change; CURRENT_SAVE_VERSION unchanged.

TESTS: write at most 4 small tests in total; do not add tests beyond these; do not refactor existing tests. The 4: (1) EQUIPMENT_SLOTS has 7 with radar last, and a v11 save without radar loads with radar null; (2) the 6 radar templates load with 0 dropped and a generated radar item price follows the formula incl. traits; (3) sumGearSpecialTraits sums accuracyPct and ORs detectStealth; (4) radar items can appear in a seeded drop roll and in shop stock.

CHECKS: tsc --noEmit first. Then run ONLY the test files found by grep for EQUIPMENT_SLOTS, ITEM_TEMPLATES, rollBattleItemDrops, itemPricing or loops over 'accessory' (about 15 files: autoEquip, shopAndIcons, warehouseViewW1b1, engine, itemPrice, inventoryShopAdmin, itemDataLoader, saveExport, starter, cloudSave, boxCapacity, plus your new file) with --reporter=dot. Print at most 15 lines of output. On a failure fix only expectations that changed because of the 7th slot or the pool growing 36 -> 42 (and list each with the reason); re-run only the failing file. NO full vitest, NO production build.

REPORT (short): items done + files changed; every old test expectation changed and why; one line of test result; NOT checked in a real browser. No tables, no test logs.
