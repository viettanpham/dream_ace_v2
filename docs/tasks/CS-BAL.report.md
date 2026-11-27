# TASK CS-BAL Report
STEP 0 (maxHp/maxShield/maxSp, default allocation, no gear):
- striker: Lv1 226/121/56 | Lv10 496/247/92 | Lv20 796/387/132 | Lv35 1254/603/194 | Lv40 1404/673/214 | Lv50 1712/819/256
- interceptor: Lv1 180/96/52 | Lv10 426/204/82 | Lv20 702/326/116 | Lv35 1112/506/166 | Lv40 1254/570/184 | Lv50 1530/692/218
- siege: Lv1 301/176/54 | Lv10 571/320/90 | Lv20 871/484/130 | Lv35 1329/730/192 | Lv40 1479/812/212 | Lv50 1787/976/254
- support: Lv1 232/175/78 | Lv10 526/301/120 | Lv20 858/441/168 | Lv35 1356/657/240 | Lv40 1522/727/264 | Lv50 1854/873/312
- ITEM 0: Cập nhật test cũ (supplyShopUiCs3b click supply-confirm-ok, saveVersion >= 12 ở statusChipsG4a1/suppliesCs1, và các số liệu mới ở suppliesCs1/suppliesBattleCs2/supplyLoadoutBarCsUi).
- ITEM 1: Thêm flat SupplyEffectKind (heal_hp/restore_shield/restore_sp), clamp hồi thực tế (overflow bỏ qua, trừ lượt, giữ chặn shield_break), 15 mẫu T1..T5 trong consumables.json (unlock 1/10/20/35/40, SP CD 3), text phẳng và log lượng hồi thật.
- ITEM 2: Thêm adminConfig.supplyEconomy (maxUsesPerBattle=5, spPriceMult=2) + sanitizer, áp dụng giới hạn trận ở supplies.ts, công thức giá phẳng ở computeSupplyPrice(), block "Vật tư" SupplyEconomyAdminBlock.tsx gắn vào AdminPanel.tsx (+2 dòng).
- Files changed: src/types/game.ts, src/data/consumables.ts, src/data/consumables.json, src/engine/supplyEffects.ts, src/engine/supplies.ts, src/engine/itemPrice.ts, src/engine/migration.ts, src/store/useGameStore.ts, src/components/SupplyLoadoutBar.tsx, src/components/SupplyShopPanel.tsx, src/components/admin/SupplyEconomyAdminBlock.tsx, src/components/AdminPanel.tsx, src/i18n/vi.ts, src/i18n/en.ts, docs/CODEMAP.md, và các test liên quan (+ supplyRebalanceCsBal.test.ts).
- Tests: npx tsc --noEmit PASS; 8/8 file test vật tư (45/45 tests) PASS (gồm 5 test CS-BAL mới).
NOT checked in a real browser.
