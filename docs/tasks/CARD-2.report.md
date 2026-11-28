TASK CARD-2 — DONE
- Engine & persistence: added `AdminConfig.cardShop` (defaults: enabled, base 10%, step 1.5%, stepLevels 10, min 1%), `getCardAppearRate`, `rollCardShopStock`, `sanitizeCardShopStock`, and optional `cardShopStockWp` (save version kept 15; missing rolls once on load; explicit `[]` kept; bought card removed; rerolled with WP shop stocks).
- UI & i18n (vi/en): `ShopScreen` filters opening cards by `cardShopStockWp` when enabled and shows `shop.wpOpeningCardsEmpty` when empty; `SkillView` shows muted `skill.cardNotInWpShop` at all 4 `skill.getCardInWpShop` places when absent.
- Admin CP: added collapsed `AdminSection id="card-shop"` (`CardShopAdminBlock`) next to `SkillTiersAdminBlock` with enabled toggle, per-kind fields, per-field live examples + expected count, `"Làm mới chợ thẻ ngay (test)"`, and reset.
- Checks: `cardShopCard2.test.tsx`, `skillTiersCard1.test.ts`, `vouchersA.test.tsx`, `priceTablePrice1a.test.tsx` (4 files, 19/19 passed) + `npx tsc --noEmit` (0 errors); updated `shopAndIcons.test.tsx` WP test (`enabled: false`) passes (existing `slotTabsRow` test fails 9 vs 8 pre-existing).
NOT checked in a real browser
