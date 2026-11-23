# CODEMAP — read this first, open only the files you need
Rule: every task reads this file first, finds code with grep on symbols, opens only matching files (line ranges for files over 300 lines), and appends one line per new file it opens: "path — what it does (key functions)".

## Largest files (lines) — avoid reading whole
src/store/useGameStore.ts 3981; src/engine/combat.ts 3860; src/components/BattleScreen.tsx 3347; src/components/GearView.tsx 2829; src/components/BattleRadarView.tsx 2424; src/components/AdminPanel.tsx 2139; src/components/ShopScreen.tsx 1933; src/components/BattleStatsModal.tsx 1757; src/store/useCloudSaveStore.ts 1721; src/i18n/vi.ts 1654; src/i18n/en.ts 1653; src/engine/cloudSave.ts 1620; src/engine/tactics.ts 1500; src/components/BattleVfxOverlay.tsx 1496; src/components/MapView.tsx 1359; src/components/CloudSaveDialogs.tsx 1321; src/utils/battleDisplay.ts 1249; src/types/game.ts 1248; src/components/TurnQueueBar.tsx 1170; src/utils/combatLogFormat.ts 1129

## Battle setup, formation, lanes
- src/store/useGameStore.ts — persisted campaign store, battle launcher, battle-lock navigation (`isBattleActive()`, `setScreen()`, `setActiveTab()`, `openWarPointShop()`, `returnToHangar()`), and squad formation actions (`startBattle()`, `reloadBattle()`, `moveSquadUnitRow()`, `autoArrangeSquadFormation()`)
- src/engine/combat.ts — battle initialization, NPC skill loadouts, enemy roster/targeting, row modifiers, and combat resolution (`createInitialBattleState()`, `archetypeRosterBySize` (4/6/8), `buildCombatUnit()`, `buildNpcSkillLoadout()`, `getValidEnemyTargets()`, `getValidAllyTargets()`, `isLongRangeAction()`, `getAdjacentUnits()`, `getEffectiveUnitDefense()`)
- src/engine/formation.ts — formation sanitization, row moves/swaps, auto-placement, and default squad builder (`autoPlaceFormation()`, `pickRowForClass()`, `moveUnitToRow()`, `enforceFormationCapacities()`, `createDefaultSquadFormation()`)
- src/data/formationConfig.ts — centralized 3-row capacities, row modifiers, and class placement preferences (`DEFAULT_FORMATION_CONFIG` front 3 / middle 3 / back 2 / max 8 per side, `CLASS_FORMATION_PREFERENCES` striker front>middle>back, interceptor front/middle>back, siege back>middle>front, support middle/back>front, `cloneFormationConfig()`)
- src/data/pilots.ts — ally pilot name pool and enemy archetype stat/status templates (`ALLY_PILOT_POOL`, `ENEMY_ARCHETYPE_DEFS`, `ENEMY_PREFIXES`)
- src/data/classes.ts — player GEAR class definitions, roles, base stats, and growth tables (`MECH_CLASSES`, `MECH_CLASS_LIST`, `STAT_META`)
- src/data/skills.ts — 38-skill catalog, starter skills per class, and skill level scaling (`SKILLS_LIST`, `CLASS_STARTER_SKILLS`, `getScaledSkillStats()`, `getSkillById()`)
- src/data/maps.ts — sector definitions, battle sizes, garrisons, and map lanes (`SECTORS_CATALOG`, `MAP_LANES`, `getSectorById()`)
- src/components/FormationEditor.tsx (inside src/components/GarageView.tsx) — player formation UI (`FormationEditor`); src/components/AdminPanel.tsx edits capacities and row modifiers
- src/engine/__tests__/formation.test.ts + src/engine/__tests__/formationLanes.test.ts — 3-row formation, targeting, migration, and 500-seed lane-reservation regression tests
- Rules: rows `front`/`middle`/`back` = `TIỀN`/`TRUNG`/`HẬU TUYẾN`; `front` `+10% DEF`, `back` `-10% DEF` and `+10%` ranged DMG; `"Lộ diện"` = first row with an alive unit

## Battle UI
- src/components/BattleScreen.tsx — battle screen layout, control row, sidebar
- src/components/BattleResultDialog.tsx + src/components/__tests__/BattleResultDialog.test.tsx — single-battle victory/defeat/retreat summary modal (2-col desktop, sticky-footer bottom-sheet phone) + tests
- src/components/AutoRepeatDialogs.tsx + src/components/__tests__/AutoRepeatDialogs.test.tsx — auto-repeat per-battle toast & batch summary modal (`AutoRepeatToast`, `AutoRepeatBatchSummaryModal`, `AutoRepeatDialogs`) + tests
- src/components/BattleSheets.tsx + src/components/__tests__/BattleSheets.test.tsx — phone unit detail sheet wrapper & combat log popup sheet (`PhoneUnitDetailSheet`, `CombatLogPopupSheet`, `BattleSheets`) + tests
- src/components/BattleMoreActionsMenu.tsx + src/components/__tests__/BattleMoreActionsMenu.test.tsx — shared "..." overflow actions BottomSheet (`BattleMoreActionsMenu`) + tests
- src/components/PhoneSkillsSheet.tsx + src/components/__tests__/PhoneSkillsSheet.test.tsx — phone active skills BottomSheet (`PhoneSkillsSheet`) + tests
- src/components/FieldSuppliesSheet.tsx + src/components/__tests__/FieldSuppliesSheet.test.tsx — field supplies & tactics BottomSheet wrapped in ErrorBoundary (`FieldSuppliesSheet`) + tests
- src/components/BattleRadarView.tsx — tactical 3-row SVG radar markers, lanes, floating labels, and lane buff formatting (`BattleRadarView`, `getRadarLaneBuffParts()`, `formatRadarLaneBuffText()`, `formatRadarLaneHeaderText()`, `computeLaneTokenRadius()`)
- src/components/__tests__/battleRadarDeclutterG4a3a.test.tsx + src/components/__tests__/battleSidebarPanelSb2.test.tsx — radar declutter, lane header labels, and fixed-height sidebar unit panel tests
- src/components/RadarStatusBoard.tsx — collapsible status board under the radar (`RadarStatusBoard`)
- src/components/StatusChip.tsx — shared compact status icon chip (`StatusChip`)
- src/components/FixedStatusArea.tsx — fixed/dynamic height status chip box with row counter & overflow scroll (`FixedStatusArea`, `getFixedStatusAreaHeightPx()`, `countStatusChipRows()`)
- src/components/BattleUnitCard.tsx — compact card unit row & per-lane dynamic status rows (`BattleUnitCard`)
- src/components/__tests__/battleCardG4a2c.test.tsx — card mode lane grid, headers, running per-lane status rows & compact card tests
- src/components/TurnQueueBar.tsx — turn order conveyor strip and sidebar queue (`TurnQueueBar`)
- src/components/BattleStatsModal.tsx — post-battle and live combat statistics modal (`BattleStatsModal`)
- src/components/CombatLogList.tsx + src/components/__tests__/combatLogG4a2d.test.tsx — structured, round-grouped combat log (newest-first default, 3 newest rounds open, jump pill, compact Row 2) + G4a-2d tests
- src/utils/combatLogFormat.ts — combat log formatting, log order/mode prefs (`LOG_MODE_STORAGE_KEY`, `LOG_ORDER_STORAGE_KEY`, `COMBAT_LOG_CHROME_HEIGHTS`, `groupCombatLogEntriesByRound()`)
- src/utils/scrollStick.ts — pure top/bottom stick scroll predicates & prepend scroll preservation (`computeTopStickScrollState()`, `computeStickScrollState()`, `computePreservedScrollTopOnPrepend()`, `isInlineFlowAtTop()`)
- src/utils/battleDisplay.ts — UI constants, row exposure states, 3-tier split-ring & thin SP-ring geometry, and target validity helpers (`computeRowExposure()`, `computeUnitRingArcs()`, `computeRingArcSpec()`, `evaluateRadarTargetValidity()`, `formatShortUnitName()`)
- src/components/__tests__/battleG3b.test.tsx — radar marker ring geometry/render (RM2), status icons, legend, upcoming queue, and Loop popover tests
- src/components/BattleVfxOverlay.tsx + src/utils/battleVfx.ts + src/utils/fxTone.ts + src/components/__tests__/g4bSupportFx.test.tsx — combat FX overlay, support tone resolution (`resolveFxTone()`, `resolveFxToneColor()`, `FX_TONE_COLORS`, `STAGE_HIT_FLASH_COLORS`), support buff projectiles/carets, and card-contained popups
- src/components/ActionStage.tsx + src/utils/actionStagePrefs.ts + src/components/__tests__/g4bSActionStage.test.tsx — card-mode Action Stage ("Sân khấu hành động", shared `StageToken`/`StageProjectile`, `ActionStage`, `resolveStageFxActorAndTargets`, `dreamAce.actionStage.v1` pref hook) + G4b-S tests

## Save and cloud
- src/engine/migration.ts — save validation and version migration (`CURRENT_SAVE_VERSION = 9`)
- src/engine/saveExport.ts — SV1a JSON export/import and checksum validation
- src/engine/cloudSave.ts + src/store/useCloudSaveStore.ts + src/components/CloudSaveDialogs.tsx — Firebase Auth/Firestore cloud save sync

## Other
- src/components/GearView.tsx — gear loadout, equipment, and inventory management
- src/components/ShopScreen.tsx — item, gear, and WP market shop
- src/components/MapView.tsx + src/components/__tests__/mapM1.test.tsx — sector campaign map, phone compact layout/initial zoom (`computeInitialPhoneMapView()`, `clampMapPan()`, `clampMapZoom()`), and base status view + tests
- src/components/HangarScreen.tsx + src/components/SidebarNav.tsx + src/components/BottomSheet.tsx — hangar tab shell (`pb-[60px]` above mobile fixed tab bar), sidebar/mobile nav (`GEAR`, `Nhân vật`/`Character`), and shared BottomSheet modal
- src/components/TopHud.tsx — top HUD bar, slim phone battle bar, and battle-exit confirm dialog (`confirmExitBattle()`, `returnToHangar()`)
- src/components/__tests__/u1BattleLock.test.tsx — store battle lock (`isBattleActive`), `reloadBattle` ErrorBoundary recovery, and tab label/i18n parity tests
- src/App.tsx + src/components/ErrorBoundary.tsx — root shell and crash-recovery ErrorBoundary (`reloadBattle()` callbacks)
- src/i18n/vi.ts + src/i18n/en.ts — bilingual translations (every new string in both)
- src/types/game.ts — shared domain and battle state types
- src/data/items.ts + src/data/items.json + src/data/balance.ts + src/data/itemPricing.ts + src/data/itemPricing.json + src/data/shopConfig.ts + src/data/starterConfig.ts — typed item template loader (`validateItemTemplates()`, `ITEM_TEMPLATES`, `ITEM_TEMPLATES_BY_ID` from `items.json`), economy/rarity/tier/drop/enchant tables (`BALANCE_CONFIG`), validated unified pricing constants (`validatePriceFormula()`, `PRICE_FORMULA` from `itemPricing.json`), WP offers (`SHOP_STOCK_CONFIG`), starter gear defaults (`DEFAULT_STARTER_SET_CONFIG`)
- src/data/__tests__/itemDataLoader.test.ts — D1-2b JSON migration snapshot equality guard, same-seed generation/shop parity, malformed item row dropping, and per-field pricing fallback tests
- src/engine/equipment.ts + src/engine/itemPrice.ts + src/engine/shop.ts + src/engine/quickSell.ts + src/engine/starter.ts — item generation (`generateItemInstance()`), unified pricing (`computeItemPrice()`, `countNonZeroTraits()`), sell/enchant (`getSellPrice()`, `getEnchantMetadata()`), shop stock (`generateCategorizedShopStock()`, `generateWpMarketOffers()`), quick-sell (`evaluateQuickSellCandidates()`), starter gear (`generateStarterItemForSlot()`)
- src/engine/__tests__/itemPrice.test.ts — D1-2a unified item price formula, monotonicity, affix/trait percentages, floor, shop multiplier, priceOverride, and legacy save price preservation tests
- docs/audit/D1-items-prices.md + docs/audit/D1-items-prices-after.md — read-only before/after item count & 96-cell + 200-roll shop-buy / quick-sell price audit tables
