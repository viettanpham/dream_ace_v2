# TASK ADM-TUNE-1 Report
- ITEM 1: `skillCardPriceMult` default 1->10, max 20->999999999 (`balance.ts`, `SkillTiersAdminBlock.tsx`, `migration.ts`, `useGameStore.ts`); saved kept.
- ITEM 2: `DEFAULT_FORMATION_CONFIG.rowCapacities` 8/8/8->5/5/5 (`formationConfig.ts`, `formation.ts`, Admin reset); 8-unit auto-arrange ok.
- ITEM 3 (read-only audit, 0 code edits): 145 non-natural caps / 226 inputs (`docs/tasks/ADM-TUNE-1.audit.md`), 10 examples:
  1) AdminPanel.tsx:1842|boxCapacity|20-1000|n ; 2) AdminPanel.tsx:1868|warehouseCapacity|50-2000|n ; 3) AdminPanel.tsx:1720|skillMaxLevel|1-20|n
  4) AdminPanel.tsx:1375|shopMinStock|1-10|n ; 5) AdminPanel.tsx:1418|shopPriceMultiplier|0.1-5|n ; 6) AdminPanel.tsx:2340|shieldRegen.basePct|0-50|n
  7) BuffCardsAdminBlock.tsx:179|buffCards.priceMult|0.1-20|n ; 8) CrateShopAdminBlock.tsx:258|crateShop.*.price|1-1M/100M|n ; 9) EnrageAdminBlock.tsx:198|enrage.rage.value|0-1000|n ; 10) NpcSupplyAdminBlock.tsx:169|npcSupply.qtyMin|0-30|n
- CHECKS: vitest (`admTune1`, `priceTablePrice1a`, `skillTiersCard1`, `formRow1`) 4/4 files (16/16) passed; `npx tsc --noEmit` 0 errors; save v15.
NOT checked in a real browser
