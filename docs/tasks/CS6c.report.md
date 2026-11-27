Done: STEP A, ITEM 0 (SUP-PICK2 desktop `BottomSheet` picker), ITEM 1 (sector supply drain/regen, migration sanitizer, `battle.log[0]` `log.sectorSupply`), ITEM 2 (`NpcSupplyAdminBlock` + `adminRefillAllSectorSupply`), TESTS (5).
Files: `src/components/SupplyLoadoutBar.tsx`, `src/components/admin/NpcSupplyAdminBlock.tsx`, `src/components/AdminPanel.tsx`, `src/engine/{npcSupply,mapWorld,migration,combat}.ts`, `src/store/useGameStore.ts`, `src/types/game.ts`, `src/i18n/{vi,en,index}.ts`, `src/utils/combatLogFormat.ts`, `src/engine/__tests__/sectorSupplyAdminCs6c.test.tsx`, `docs/CODEMAP.md`.
Retreat: YES — `retreatBattle()` routes through `finalizeBattleOutcome`, calling `drainSectorSupply` before `monthStep`, so retreating drains `-drainPerBattle` (100 -> 80) without advancing month.
AdminPanel.tsx lines: `3437` -> `3439` (+2 lines; controls extracted to `src/components/admin/NpcSupplyAdminBlock.tsx`).
Checks: `npx tsc --noEmit` PASS; vitest 5 files / 22 tests PASS (`sectorSupplyAdminCs6c` 5, `supplyLoadoutBarCsUi` 4, `supplyPickFamilySupPick1` 3, `npcSupplyCs6a` 5, `npcSupplyUseCs6b` 5).
5 battles on same sector (defaults drain=20, regen=10): `50%` after 5 completed battles (100->90->80->70->60->50); `0%` after 5 retreats (no month advance).
NOT checked in a real browser (picker dialog on desktop and phone, Admin block).
