# BÁO CÁO TASK LVL-1 — Cấp độ địch theo loại trận
- Step 0a: Cướp biển (PIRATE-1) chạy `kind='event'`, `sourceId='pir_*'` (`isPirateIncidentId`); Boss (`sector.hasBoss` / `forceBoss`) chạy `kind='assault'`, `sourceId=null`, unit `i=0`.
- Step 0b (Lv20, HP/Shield/ATK/DEF/SPD): Player `796/387/35/31/63` | NPC `+0: 975/478/84/70/121` | `+5: 1072/660/92/70/129` | `+10: 1267/723/131/84/143` | `+15: 1484/834/126/101/174` | `+20: 1700/881/174/118/180`.
- Step 0b (Lv50, HP/Shield/ATK/DEF/SPD): Player `1712/819/67/63/108` | NPC `+0: 2246/1110/161/168/242` | `+5: 2103/1319/182/134/252` | `+10: 2489/1479/218/175/237` | `+15: 2712/1418/229/193/272` | `+20: 2823/1497/273/195/294`.
- Hoàn thành: STEP A, STEP 0, ITEM 1 (`enemyLevel.ts`), ITEM 2 (`combat.ts`), ITEM 3 (`AdminConfig` + sanitizer + `EnemyLevelAdminBlock` gắn trong `AdminPanel.tsx` 2 dòng), TESTS (4 test).
- Files: `src/types/game.ts`, `src/engine/enemyLevel.ts`, `src/engine/combat.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/components/admin/EnemyLevelAdminBlock.tsx`, `src/components/AdminPanel.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/engine/__tests__/enemyLevelLvl1.test.ts`, `docs/CODEMAP.md`.
- Test: `npx tsc --noEmit` PASS; `vitest` 6 files / 33 tests PASS (`enemyLevelLvl1`, `pirates`, `battleKindsK1`, `spEconomyB1`, `saveV10Migration`, `supplyShopUiCs3b`).
- Chưa kiểm tra trên trình duyệt thật (NOT VERIFIED): giao diện `EnemyLevelAdminBlock` trong `AdminPanel` (nhập số, responsive, nút Khôi phục mặc định) và kiểm thử combat/lưu trang trực tiếp trên UI.
