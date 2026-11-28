# TASK CARD-TIERS-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/CARD-TIERS-1.md`, create `docs/tasks/CARD-TIERS-1.progress.md`
- [x] ITEM 0a: Update stale expectations in `suppliesCs1.test.ts` (#1, #2) and `supplyRebalanceCsBal.test.ts` (#3)
- [x] ITEM 0b: Fix Decoy Flare dodge cap in `src/engine/combat.ts` (`getEffectiveUnitDodge`) so flare never lowers dodge
- [x] ITEM 1: `adminConfig.cardTiers` config, sanitizer, and `getCardTier(kind, value, cfg)`
- [x] ITEM 2: EXP card per-use level-gain cap (`maxLevels[tier]`) + `redeemCard` return metrics
- [x] ITEM 3: EXP card preview waste confirmation + "Dùng hết" auto-stop + tier badge (T1-T5) in Kho đồ Thẻ
- [x] ITEM 4: `PilotAccount.medals`, `adminConfig.medals`, medal redemption (Dùng 1 / Dùng hết), Kho đồ "Huân chương" section + icon + lore
- [x] ITEM 5: Starter rows tier dropdown for Credit/EXP/Huân chương + custom legacy fallback + live examples
- [x] ITEM 6: `adminConfig.monthlyEconomy` salary & medal cascade in `advanceCampaignMonth` + NPC money check
- [x] ITEM 7: Chợ Credit black market `'medal'` offer + `"Chợ đen"` tag
- [x] ITEM 8: `"Báo cáo tháng"` popup after `advanceMonth` in `MapView` + `showMonthReport` toggle
- [x] ITEM 9: AdminSection `"Thẻ cấp bậc & Huân chương"` with live examples, 20%/60% WP/month estimates, reset defaults, vi/en keys
- [x] TESTS: <= 7 focused tests + related test files (`--reporter=dot`) + `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/CARD-TIERS-1.report.md` (<= 15 lines)
