Done: STEP A, ITEM 0 (suppliesBattleCs2 prestage off), ITEM 1 (npcSupply config, cap, battleLimitOverride), ITEM 2 (generateNpcSupplies + combat hook), TESTS (5).
Files: src/data/npcSupply.json, src/engine/npcSupply.ts, src/engine/{supplies,migration,combat}.ts, src/types/game.ts, src/engine/__tests__/{npcSupplyCs6a.test.ts,suppliesBattleCs2.test.tsx}, docs/CODEMAP.md.
Checks: npx tsc --noEmit PASS; vitest 6 related files (33 tests) + 2 migration/prestage files (15 tests) PASS.
Sample Lv20 Hard assault (debris_belt, seed 42) stock at sectorSupply 100 -> 30:
- ally_npc_1 (ally, lv19): {} -> {}
- ally_npc_2 (ally, lv21): {"sup_sp_t3":5} -> {"sup_sp_t3":3}
- ally_npc_3 (ally, lv19): {"sup_hp_t2":2,"sup_sp_t2":2} -> {}
- enemy_1 (enemy gunship, lv27): {"sup_shield_t3":2} -> {"sup_sp_t3":1}
- enemy_2 (enemy drone, lv28): {"sup_hp_t3":4} -> {}
- enemy_3 (enemy sniper, lv28): {"sup_sp_t3":8,"sup_hp_t3":6} -> {"sup_shield_t3":1}
- enemy_4 (enemy repair_ship, lv27): {"sup_sp_t3":6,"sup_shield_t3":2} -> {"sup_shield_t3":3}
NOT checked in a real browser.
