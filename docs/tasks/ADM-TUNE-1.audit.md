# TASK ADM-TUNE-1 — Admin CP Number Input & Sanitizer Cap Audit (Read-Only)

Classification rule (`natural?`):
- `y`: percent `0-100` (or `0-1` fraction / `1-100` %), formation row capacity / units per side bound by `8`, or counts/amounts that only require `>= 1` / `>= 0` (uncapped or bounded by configured `maxLevel` / category item count).
- `n`: arbitrary non-natural `max=` / `clamp` / `Math.min` (or artificial non-zero lower cap on percents) in Admin CP inputs and/or their engine sanitizers.

Format: `file:line | field | current min-max | natural? (y/n)`

## 1. src/components/AdminPanel.tsx
src/components/AdminPanel.tsx:572 | levelInput (grant gear level) | 1-storedMaxLevel | y
src/components/AdminPanel.tsx:617 | maxLevel (migration/balance.ts:708) | 1-uncapped | y
src/components/AdminPanel.tsx:654 | expInput (grant EXP) | 1-uncapped | y
src/components/AdminPanel.tsx:685 | pointsInput (grant stat points) | 0-uncapped | y
src/components/AdminPanel.tsx:759 | creditsInput (grant credits) | 0-uncapped | y
src/components/AdminPanel.tsx:800 | wpInput (grant WP) | 0-uncapped | y
src/components/AdminPanel.tsx:892 | genReqLevel (generate gear level) | 1-storedMaxLevel | y
src/components/AdminPanel.tsx:907 | genQuality (generate gear quality %) | 1-100 | y
src/components/AdminPanel.tsx:920 | genQty (generate gear count) | 1-100 | n
src/components/AdminPanel.tsx:1117 | starterBoostPct (admin-starter-boost-input) | 0-300 | n
src/components/AdminPanel.tsx:1281 | starterSet.slots[].level | 1-maxLevel | y
src/components/AdminPanel.tsx:1310 | starterSet.slots[].rollQuality | 1-100 | y
src/components/AdminPanel.tsx:1375 | shopMinStock (migration.ts:961) | 1-10 | n
src/components/AdminPanel.tsx:1398 | shopMaxStock (migration.ts:965) | 1-10 (sanitizer: shopMinStock-10) | n
src/components/AdminPanel.tsx:1418 | shopPriceMultiplier (migration.ts:1015) | UI 0.1-5 (sanitizer: >0 uncapped) | n
src/components/AdminPanel.tsx:1448 | shopRarityWeights[r] (migration.ts:1005) | UI 0-100 (sanitizer: >=0 uncapped) | n
src/components/AdminPanel.tsx:1680 | battleLevelOffsetOverride (migration.ts:989) | UI -10..30 (sanitizer: any finite int) | n
src/components/AdminPanel.tsx:1720 | skillMaxLevel (balance.ts:477) | 1-20 | n
src/components/AdminPanel.tsx:1754 | passiveScaleAfter5 (balance.ts:493) | 0-1 | y
src/components/AdminPanel.tsx:1788 | restorePctCap (balance.ts:500) | 0.1-1 | n
src/components/AdminPanel.tsx:1825 | noticeDurationSec (migration.ts:482) | 0-120 | n
src/components/AdminPanel.tsx:1842 | boxCapacity (migration.ts:364) | 20-1000 | n
src/components/AdminPanel.tsx:1868 | warehouseCapacity (migration.ts:380) | 50-2000 | n
src/components/AdminPanel.tsx:2023 | activeSlots.initial (balance.ts:566) | 1-9 | n
src/components/AdminPanel.tsx:2058 | activeSlots.everyLevels (balance.ts:571) | 1-50 | n
src/components/AdminPanel.tsx:2093 | activeSlots.max (balance.ts:576) | initial-9 | n
src/components/AdminPanel.tsx:2167 | passiveSlots.initial (balance.ts:519) | 1-12 | n
src/components/AdminPanel.tsx:2193 | passiveSlots.everyLevels (balance.ts:524) | 1-50 | n
src/components/AdminPanel.tsx:2219 | passiveSlots.max (balance.ts:529) | initial-12 | n
src/components/AdminPanel.tsx:2340 | shieldRegen.basePct (shieldRegen.ts:75) | 0-50 | n
src/components/AdminPanel.tsx:2357 | shieldRegen.perPointPct (shieldRegen.ts:76) | 0-50 | n
src/components/AdminPanel.tsx:2374 | shieldRegen.capPct (shieldRegen.ts:77) | 0-50 | n
src/components/AdminPanel.tsx:2391 | shieldRegen.notHitMult (shieldRegen.ts:78) | 0-200 | n
src/components/AdminPanel.tsx:2408 | shieldRegen.hitPenaltyPct (shieldRegen.ts:79) | 0-100 | y
src/components/AdminPanel.tsx:2425 | shieldRegen.minHitMultPct (shieldRegen.ts:80) | 0-100 | y
src/components/AdminPanel.tsx:2442 | shieldRegen.restartTurns (shieldRegen.ts:81) | 1-3 | n
src/components/AdminPanel.tsx:2459 | shieldDamageOverrides.aegis_sunder (shieldRegen.ts:39) | 1-4 | n
src/components/AdminPanel.tsx:2486 | shieldCrackedMult (shieldRegen.ts:43) | 1-2 | n
src/components/AdminPanel.tsx:2510 | shieldCrackedTurns (shieldRegen.ts:47) | 1-5 | n
src/components/AdminPanel.tsx:2605 | spEconomy.regenPerSpirit (balance.ts:299) | 0-2 | n
src/components/AdminPanel.tsx:2623 | spEconomy.costLevelPct (balance.ts:306) | 0-0.1 | n
src/components/AdminPanel.tsx:2644 | spEconomy.classFactor[cls] (balance.ts:291) | 0.1-3 | n
src/components/AdminPanel.tsx:2708 | fluxTransfer.minPerLevel (balance.ts:429) | 0-200 | n
src/components/AdminPanel.tsx:2727 | fluxTransfer.allySpBelowPct (balance.ts:436) | 0-100 | y
src/components/AdminPanel.tsx:2746 | fluxTransfer.keepSelfPct (balance.ts:442) | 0-100 | y
src/components/AdminPanel.tsx:2777 | fluxTransfer.levels[].targets (balance.ts:420) | 1-10 | n
src/components/AdminPanel.tsx:2791 | fluxTransfer.levels[].pct (balance.ts:421) | 0-100 | y
src/components/AdminPanel.tsx:2805 | fluxTransfer.levels[].fee (balance.ts:422) | 0-100 | y
src/components/AdminPanel.tsx:2841 | stealth.lidarDetectMin (balance.ts:342) | 1-10 | n
src/components/AdminPanel.tsx:2860 | stealth.lidarDetectMax (balance.ts:348) | 1-10 (sanitizer: min-10) | n
src/components/AdminPanel.tsx:2899 | turnPhase.maxStep2PerTurn (turnPhase.ts:3-4) | 0-3 | n
src/components/AdminPanel.tsx:2952 | prestage.countdownSec (prestage.ts:24-25) | 0-10 | n
src/components/AdminPanel.tsx:2987 | prestage.groupFromSize (prestage.ts:26-27) | 4-50 | n
src/components/AdminPanel.tsx:3044 | supplyShopMinTypes (shop.ts:428-429) | 1-12 | n
src/components/AdminPanel.tsx:3045 | supplyShopMaxTypes (shop.ts:428-429) | 1-12 | n
src/components/AdminPanel.tsx:3046 | supplyShopMinQty (shop.ts:433-434) | 1-99 | n
src/components/AdminPanel.tsx:3047 | supplyShopMaxQty (shop.ts:433-434) | 1-99 | n
src/components/AdminPanel.tsx:3050 | supplyShopMaxRefreshes (shop.ts:437-438) | 1-10 | n
src/components/AdminPanel.tsx:3051 | supplyShopRefreshBaseCost (shop.ts:441-442) | 0-100000 | n
src/components/AdminPanel.tsx:3052 | supplyWpPriceDivisor (shop.ts:445-446) | 1-100 | n
src/components/AdminPanel.tsx:3053 | supplyWpMinTier (shop.ts:449-450) | 1-5 | n
src/components/AdminPanel.tsx:3054 | supplyWpDupWeight (shop.ts:453-454) | 0.05-1 | n
src/components/AdminPanel.tsx:3055 | supplyWpMaxCopies (shop.ts:457-458) | 1-5 | n
src/components/AdminPanel.tsx:3286 | statusDisplayDefaults.phoneRows (statusDisplayPrefs.ts:461) | 1-5 | n
src/components/AdminPanel.tsx:3311 | statusDisplayDefaults.desktopRows (statusDisplayPrefs.ts:465) | 1-5 | n
src/components/AdminPanel.tsx:3336 | statusDisplayDefaults.playerPhoneRows (statusDisplayPrefs.ts:469) | 1-2 | n
src/components/AdminPanel.tsx:3361 | statusDisplayDefaults.playerDesktopRows (statusDisplayPrefs.ts:473) | 1-2 | n
src/components/AdminPanel.tsx:3411 | cardPopupStaggerMs (cardPopupQueue.ts:113) | 0-uncapped | y
src/components/AdminPanel.tsx:3431 | cardPopupFlightMs (cardPopupQueue.ts:120) | 1-uncapped | y
src/components/AdminPanel.tsx:3451 | cardPopupMaxConcurrent (cardPopupQueue.ts:127) | 1-uncapped | y
src/components/AdminPanel.tsx:3468 | cardPopupZoneWidthPct (AdminPanel.tsx:254, cardPopupQueue.ts:34) | 20-100 | n
src/components/AdminPanel.tsx:3477 | cardPopupZoneHeightPct (AdminPanel.tsx:254, cardPopupQueue.ts:34) | 20-100 | n
src/components/AdminPanel.tsx:3494 | cardPopupStartScalePct (cardPopupQueue.ts:36-37) | 50-200 | n
src/components/AdminPanel.tsx:3526 | cardPopupEndScalePct (cardPopupQueue.ts:38-39) | 50-250 | n
src/components/AdminPanel.tsx:3570 | radarPopupStartScalePct (radarPopup.ts:6-7) | 20-300 | n
src/components/AdminPanel.tsx:3592 | radarPopupSmallScalePct (radarPopup.ts:6-7) | 20-300 | n
src/components/AdminPanel.tsx:3614 | radarPopupLargeScalePct (radarPopup.ts:6-7) | 20-300 | n
src/components/AdminPanel.tsx:3636 | radarPopupBigMaxUnits (radarPopup.ts:40) | 1-uncapped | y
src/components/AdminPanel.tsx:3673 | skipRoundInput | 1-999 | n
src/components/AdminPanel.tsx:3753 | monthInput | 1-999 | n
src/components/AdminPanel.tsx:3889 | formation.rowCapacities[row] (formation.ts:59) | 0-8 | y
src/components/AdminPanel.tsx:3914 | formation.maxUnitsPerSide (formation.ts:59) | 1-8 | y
src/components/AdminPanel.tsx:3988 | formation.rowModifiers[row].defensePct | -80..100 | n
src/components/AdminPanel.tsx:4006 | formation.rowModifiers[row].damagePct | -80..100 | n
src/components/AdminPanel.tsx:4024 | formation.rowModifiers[row].rangedDamagePct | -80..100 | n

## 2. src/components/ModuleDropAdminBlock.tsx & src/components/admin/*
src/components/ModuleDropAdminBlock.tsx:180 | moduleDrop.factorPct (moduleDrop.ts:33-34) | 0-100 | y
src/components/ModuleDropAdminBlock.tsx:203 | moduleDrop.shopCount (moduleDrop.ts:37-38) | 0-3 | n
src/components/ModuleDropAdminBlock.tsx:235 | moduleDrop.effectWeights (stat, moduleDrop.ts:41-42) | 0-100 | n
src/components/ModuleDropAdminBlock.tsx:274 | moduleDrop.effectWeights (special, moduleDrop.ts:41-42) | 0-100 | n
src/components/admin/BaseSiegeAdminBlock.tsx:156 | baseSiege.maxShield[baseType] (baseSiege.ts:106) | 1-100000 | n
src/components/admin/BaseSiegeAdminBlock.tsx:186 | baseSiege.maxHp[baseType] (baseSiege.ts:106) | 1-100000 | n
src/components/admin/BaseSiegeAdminBlock.tsx:242 | baseSiege.shieldDamagePerWin (baseSiege.ts:106) | 1-100000 | n
src/components/admin/BaseSiegeAdminBlock.tsx:269 | baseSiege.hpDamagePerWin (baseSiege.ts:106) | 1-100000 | n
src/components/admin/BaseSiegeAdminBlock.tsx:305 | baseSiege.regen.idleMonths (baseSiege.ts:106) | 0-12 | n
src/components/admin/BaseSiegeAdminBlock.tsx:334 | baseSiege.regen.shieldPct (baseSiege.ts:106) | 0-100 | y
src/components/admin/BaseSiegeAdminBlock.tsx:368 | baseSiege.regen.hpPct (baseSiege.ts:106) | 0-100 | y
src/components/admin/BaseSiegeAdminBlock.tsx:410 | baseSiege.repair.cooldownMonths (baseSiege.ts:106) | 0-12 | n
src/components/admin/BaseSiegeAdminBlock.tsx:438 | baseSiege.repair.hp.amountPct (baseSiege.ts:106) | 1-100 | y
src/components/admin/BaseSiegeAdminBlock.tsx:473 | baseSiege.repair.hp.costBase (baseSiege.ts:106) | 0-uncapped | y
src/components/admin/BaseSiegeAdminBlock.tsx:505 | baseSiege.repair.hp.costPerGearLevel (baseSiege.ts:106) | 0-uncapped | y
src/components/admin/BaseSiegeAdminBlock.tsx:536 | baseSiege.repair.shield.amountPct (baseSiege.ts:106) | 1-100 | y
src/components/admin/BaseSiegeAdminBlock.tsx:571 | baseSiege.repair.shield.costBase (baseSiege.ts:106) | 0-uncapped | y
src/components/admin/BaseSiegeAdminBlock.tsx:603 | baseSiege.repair.shield.costPerGearLevel (baseSiege.ts:106) | 0-uncapped | y
src/components/admin/BaseSiegeAdminBlock.tsx:641 | baseSiege.raid.shieldDamage (baseSiege.ts:106) | 0-100000 | n
src/components/admin/BaseSiegeAdminBlock.tsx:672 | baseSiege.raid.hpDamage (baseSiege.ts:106) | 0-100000 | n
src/components/admin/BattlePenaltyAdminBlock.tsx:261 | battlePenalty.retreat* (balance.ts:878) | 0-uncapped | y
src/components/admin/BattlePenaltyAdminBlock.tsx:291 | battlePenalty.defeatFreeLevel (balance.ts:896) | 0-uncapped | y
src/components/admin/BattlePenaltyAdminBlock.tsx:321 | battlePenalty.defeatExpPenaltyFactor (balance.ts:902) | 0-5 | n
src/components/admin/BattlePenaltyAdminBlock.tsx:385 | battlePenalty.repairDefeat/repairRetreat fields (balance.ts:842) | 0-uncapped | y
src/components/admin/BattleRewardsAdminBlock.tsx:45 | battleRewards.supportMaxLevel (balance.ts:763) | 0-100 | n
src/components/admin/BattleRewardsAdminBlock.tsx:52 | battleRewards.supportExpPerLevelPct (balance.ts:771) | 0-500 | n
src/components/admin/BattleRewardsAdminBlock.tsx:59 | battleRewards.supportCreditWpPerLevelPct (balance.ts:777) | 0-500 | n
src/components/admin/BattleRewardsAdminBlock.tsx:66 | battleRewards.defeatExpPct (balance.ts:783) | 0-100 | y
src/components/admin/BattleRewardsAdminBlock.tsx:73 | battleRewards.defeatCreditPct (balance.ts:789) | 0-100 | y
src/components/admin/BattleRewardsAdminBlock.tsx:80 | battleRewards.defeatWpPct (balance.ts:795) | 0-100 | y
src/components/admin/BattleRewardsAdminBlock.tsx:87 | battleRewards.defeatMaxPctOfVictory (balance.ts:801) | 0-100 | y
src/components/admin/BattleRewardsAdminBlock.tsx:94 | battleRewards.retreatRewardPct (balance.ts:807) | 0-100 | y
src/components/admin/BuffCardsAdminBlock.tsx:130 | buffCards.battlesPerCard (data/buffCards.ts:172) | 1-20 | n
src/components/admin/BuffCardsAdminBlock.tsx:155 | buffCards.maxStackBattles (data/buffCards.ts:173) | 1-200 | n
src/components/admin/BuffCardsAdminBlock.tsx:179 | buffCards.priceMult (data/buffCards.ts:180) | 0.1-20 | n
src/components/admin/BuffCardsAdminBlock.tsx:207 | buffCards.shop.baseRatePct (data/buffCards.ts:186) | 0-100 | y
src/components/admin/BuffCardsAdminBlock.tsx:226 | buffCards.shop.decayPctPerTier (data/buffCards.ts:187) | 0-100 | y
src/components/admin/BuffCardsAdminBlock.tsx:245 | buffCards.shop.minRatePct (data/buffCards.ts:193) | 0-baseRatePct (<=100) | y
src/components/admin/BuffCardsAdminBlock.tsx:308 | buffCards.tiers[kind][tier] (data/buffCards.ts:219) | 0-45 (dodge) / 0-500 (others) | n
src/components/admin/BuffCardsAdminBlock.tsx:327 | buffCards.wpPrice[kind][tier] (data/buffCards.ts:224) | 1-999999 | n
src/components/admin/BuffCardsAdminBlock.tsx:383 | buffCards.giftQty | 1-999 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:210 | cardTiers.exp.values[tier] (cardTiers.ts:110) | 1-1000000 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:234 | cardTiers.exp.maxLevels[tier] (cardTiers.ts:76) | 1-20 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:258 | cardTiers.credit.values[tier] (cardTiers.ts:118) | 1-10000000 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:286 | cardTiers.previewWastePct (cardTiers.ts:102) | 0-100 | y
src/components/admin/CardTiersMedalsAdminBlock.tsx:354 | medals.wp[tier] (medals.ts:48) | 1-10000000 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:375 | medals.blackMarketWeights[tier] (medals.ts:70) | 0-100000 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:403 | medals.blackMarketRatePct (medals.ts:58) | 0-10 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:426 | medals.blackMarketCreditPerWp (medals.ts:80) | 1-1000000 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:458 | monthlyEconomy.salaryBaseWp (monthlyEconomy.ts:91) | 0-1000000 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:465 | monthlyEconomy.salaryPerBaseWp (monthlyEconomy.ts:92) | 0-100000 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:472 | monthlyEconomy.coefBase (monthlyEconomy.ts:98) | 0-20 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:479 | monthlyEconomy.coefStepPct (monthlyEconomy.ts:99) | 0-500 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:486 | monthlyEconomy.coefEveryPct (monthlyEconomy.ts:100) | 1-100 | y
src/components/admin/CardTiersMedalsAdminBlock.tsx:533 | monthlyEconomy.homeMedalMin (monthlyEconomy.ts:74) | 0-50 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:556 | monthlyEconomy.homeMedalMax (monthlyEconomy.ts:75) | 0-100 (medal count) | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:579 | monthlyEconomy.subBaseMedalMin (monthlyEconomy.ts:79) | 0-50 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:599 | monthlyEconomy.subBaseMedalBaseMax (monthlyEconomy.ts:85) | 0-100 (medal count) | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:619 | monthlyEconomy.subBaseMedalStepPerDecile (monthlyEconomy.ts:105) | 0-20 | n
src/components/admin/CardTiersMedalsAdminBlock.tsx:656 | monthlyEconomy.tier{3,4,5}Pct (monthlyEconomy.ts:111-115) | 0-100 | y
src/components/admin/CardTiersMedalsAdminBlock.tsx:667 | monthlyEconomy.tier{3,4,5}Count (monthlyEconomy.ts:112-116) | 0-100 (medal count) | n
src/components/admin/CrateShopAdminBlock.tsx:178 | crateShop.*.chancePct (shop.ts:1028-1029) | 0-100 | y
src/components/admin/CrateShopAdminBlock.tsx:206 | crateShop.*.slots (shop.ts:1030-1031) | 0-6 | n
src/components/admin/CrateShopAdminBlock.tsx:232 | crateShop.*.maxPerSlot (shop.ts:1032-1033) | 1-99 | n
src/components/admin/CrateShopAdminBlock.tsx:258 | crateShop.*.price (shop.ts:1034-1036) | 1-1000000 (WP) / 1-100000000 (credit) | n
src/components/admin/CrateShopAdminBlock.tsx:298 | crateShop.priceFactorPct (shop.ts:1037-1038) | 10-1000 | n
src/components/admin/EnemyLevelAdminBlock.tsx:97 | enemyLevel.peakChancePct (enemyLevel.ts:20-21) | 0-100 | y
src/components/admin/EnemyLevelAdminBlock.tsx:116 | enemyLevel.capOverMax (enemyLevel.ts:22-23) | -20..50 | n
src/components/admin/EnemyLevelAdminBlock.tsx:156 | enemyLevel.offsets[kind] (enemyLevel.ts:18-19) | -20..50 | n
src/components/admin/EnrageAdminBlock.tsx:83 | enrage.previewRound | 1-uncapped | y
src/components/admin/EnrageAdminBlock.tsx:135 | enrage.rage.startRound (enrage.ts:46) | 1-uncapped | y
src/components/admin/EnrageAdminBlock.tsx:165 | enrage.rage.everyRounds (enrage.ts:52) | 1-uncapped | y
src/components/admin/EnrageAdminBlock.tsx:198 | enrage.rage.value (enrage.ts:72) | 0-1000 | n
src/components/admin/EnrageAdminBlock.tsx:234 | enrage.rage.maxStacks (enrage.ts:58) | 1-1000 | n
src/components/admin/EnrageAdminBlock.tsx:278 | enrage.frenzy.startRound (enrage.ts:46) | 1-uncapped | y
src/components/admin/EnrageAdminBlock.tsx:308 | enrage.frenzy.everyRounds (enrage.ts:52) | 1-uncapped | y
src/components/admin/EnrageAdminBlock.tsx:341 | enrage.frenzy.value (enrage.ts:72) | 0-1000 | n
src/components/admin/EnrageAdminBlock.tsx:375 | enrage.frenzy.maxStacks (enrage.ts:58) | 1-1000 | n
src/components/admin/EnrageAdminBlock.tsx:419 | enrage.berserker.startRound (enrage.ts:46) | 1-uncapped | y
src/components/admin/EnrageAdminBlock.tsx:451 | enrage.berserker.everyRounds (enrage.ts:52) | 1-uncapped | y
src/components/admin/EnrageAdminBlock.tsx:485 | enrage.berserker.critRatePct (enrage.ts:72) | 0-1000 | n
src/components/admin/EnrageAdminBlock.tsx:521 | enrage.berserker.critDamagePct (enrage.ts:72) | 0-1000 | n
src/components/admin/EnrageAdminBlock.tsx:557 | enrage.berserker.critOverflowRatio (enrage.ts:83) | 0-10 | n
src/components/admin/EnrageAdminBlock.tsx:604 | enrage.berserker.maxStacks (enrage.ts:58) | 1-1000 | n
src/components/admin/NpcBuffCardsAdminBlock.tsx:187 | npcBuffCards.allyChancePct (engine/buffCards.ts:88) | 0-100 | y
src/components/admin/NpcBuffCardsAdminBlock.tsx:201 | npcBuffCards.enemyChancePct (engine/buffCards.ts:89) | 0-100 | y
src/components/admin/NpcBuffCardsAdminBlock.tsx:216 | npcBuffCards.minLevel (engine/buffCards.ts:90) | 1-999 | n
src/components/admin/NpcBuffCardsAdminBlock.tsx:230 | npcBuffCards.maxTier (engine/buffCards.ts:91) | 1-5 | n
src/components/admin/NpcBuffCardsAdminBlock.tsx:245 | npcBuffCards.levelPerTier (engine/buffCards.ts:92) | 1-200 | n
src/components/admin/NpcBuffCardsAdminBlock.tsx:263 | npcBuffCards.maxKindsPerUnit (engine/buffCards.ts:93) | 0-6 (NPC_BUFF_CARD_KINDS.length) | n
src/components/admin/NpcSupplyAdminBlock.tsx:169 | npcSupply.qtyMin (npcSupply.ts:44-45) | 0-30 | n
src/components/admin/NpcSupplyAdminBlock.tsx:177 | npcSupply.qtyMax (npcSupply.ts:44-45) | 0-30 | n
src/components/admin/NpcSupplyAdminBlock.tsx:185 | supplyMaxPerTypePerBattle (npcSupply.ts:39-40) | 1-30 | n
src/components/admin/NpcSupplyAdminBlock.tsx:198 | npcSupply.typesMin (npcSupply.ts:42-43) | 1-5 | n
src/components/admin/NpcSupplyAdminBlock.tsx:206 | npcSupply.typesMax (npcSupply.ts:42-43) | 1-5 | n
src/components/admin/NpcSupplyAdminBlock.tsx:214 | npcSupply.noSupplyChance.mob (npcSupply.ts:125) | 0-100 | y
src/components/admin/NpcSupplyAdminBlock.tsx:229 | npcSupply.thresholds.hp (npcSupply.ts:125) | 0-100 | y
src/components/admin/NpcSupplyAdminBlock.tsx:239 | npcSupply.thresholds.shield (npcSupply.ts:125) | 0-100 | y
src/components/admin/NpcSupplyAdminBlock.tsx:249 | npcSupply.thresholds.sp (npcSupply.ts:125) | 0-100 | y
src/components/admin/NpcSupplyAdminBlock.tsx:259 | npcSupply.sector.drainPerBattle (npcSupply.ts:390) | 0-100 | y
src/components/admin/NpcSupplyAdminBlock.tsx:271 | npcSupply.sector.regenPerMonth (npcSupply.ts:390) | 0-100 | y
src/components/admin/PirateAdminBlock.tsx:169 | pirates.maxActive (pirates.ts:79) | 1-6 | n
src/components/admin/PirateAdminBlock.tsx:187 | pirates.spawnChancePerMonth (pirates.ts:80) | 0-1 | y
src/components/admin/PirateAdminBlock.tsx:205 | pirates.expiryMonths (pirates.ts:91) | 1-12 | n
src/components/admin/PirateAdminBlock.tsx:223 | pirates.rewardMult (pirates.ts:92) | 0.1-5 | n
src/components/admin/PirateAdminBlock.tsx:249 | pirates.sizeWeights[4/6/8] (pirates.ts:71) | 0-uncapped | y
src/components/admin/PriceTableAdminBlock.tsx:358 | priceOverrides[supplyId] | 1-uncapped | y
src/components/admin/PriceTableAdminBlock.tsx:447 | priceOverrides[buffCardId] | 1-uncapped | y
src/components/admin/SkillTiersAdminBlock.tsx:132 | skillTiers[cls][cat].creditCount | 0-total (skills in class/category) | y
src/components/admin/SkillTiersAdminBlock.tsx:153 | skillTiers[cls][cat].cardCount | 0-total (skills in class/category) | y
src/components/admin/SkillTiersAdminBlock.tsx:198 | skillWpCostFactor (balance.ts:921-922) | 0.0001-1 | n
src/components/admin/SkillTiersAdminBlock.tsx:231 | skillCardPriceMult (balance.ts:925-926) | 0.1-999999999 | n
src/components/admin/StarterEventAdminBlock.tsx:882 | starterEvent.entries[].qty (starterEvent.ts:52) | 0-999 | n
src/components/admin/SupplyEconomyAdminBlock.tsx:95 | supplyEconomy.maxUsesPerBattle (supplies.ts:38-39) | 1-20 | n
src/components/admin/SupplyEconomyAdminBlock.tsx:114 | supplyEconomy.spPriceMult (supplies.ts:42-43) | 1-5 | n
src/components/admin/SupplyEconomyAdminBlock.tsx:133 | supplyScanCount (supplies.ts:49-50) | 1-5 | n
src/components/admin/SupplyEconomyAdminBlock.tsx:163 | supplyEconomy.limitMult[role] (supplies.ts:45-46) | 1-10 | n
src/components/admin/SupplyGiveAdminBlock.tsx:90 | supplyGive.qty (supplies.ts:27) | 1-99 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:139 | supplyRewards.minTier (supplyRewards.ts:18-19) | 1-5 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:160 | supplyRewards.maxTier (supplyRewards.ts:18-19) | 1-5 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:204 | supplyRewards.*.chancePct (supplyRewards.ts:20-21) | 0-100 | y
src/components/admin/SupplyRewardsAdminBlock.tsx:225 | supplyRewards.*.minQty (supplyRewards.ts:22-23) | 1-99 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:243 | supplyRewards.*.maxQty (supplyRewards.ts:22-23) | 1-99 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:271 | supplyRewards.crateTypesMin (supplyRewards.ts:24-25) | 1-4 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:294 | supplyRewards.crateTypesMax (supplyRewards.ts:24-25) | 1-4 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:317 | supplyRewards.crateQtyMin (supplyRewards.ts:22-23) | 1-99 | n
src/components/admin/SupplyRewardsAdminBlock.tsx:338 | supplyRewards.crateQtyMax (supplyRewards.ts:22-23) | 1-99 | n
src/components/admin/VoiceAdminBlock.tsx:226 | voice.actionCooldown (voice.ts:80) | 0-10 | n
src/components/admin/VoiceAdminBlock.tsx:241 | voice.maxPerRound (voice.ts:81) | 0-6 | n
src/components/admin/VoiceAdminBlock.tsx:259 | voice.chances[trigger] (voice.ts:71) | 0-100 | y
src/components/admin/VoucherAdminBlock.tsx:178 | vouchers.creditPerWp (vouchers.ts:119) | 1-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:205 | vouchers.expPerWp (vouchers.ts:127) | 1-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:264 | vouchers.baseWeight (vouchers.ts:138) | 0-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:295 | vouchers.tierDecayPct (vouchers.ts:144) | 0-100 | y
src/components/admin/VoucherAdminBlock.tsx:327 | vouchers.typesPerRoll (vouchers.ts:150) | 0-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:380 | vouchers.newValue | 1-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:401 | vouchers.newWeight | 0-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:424 | vouchers.newMaxStock | 1-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:531 | vouchers.overrides[id].weight (vouchers.ts:184) | 0-uncapped | y
src/components/admin/VoucherAdminBlock.tsx:545 | vouchers.overrides[id].maxStock (vouchers.ts:190) | 1-uncapped | y
src/components/admin/WorldGenAdminBlock.tsx:148 | worldGen.nodeCount (mapGenerator.ts:13-14) | 12-50 | n
