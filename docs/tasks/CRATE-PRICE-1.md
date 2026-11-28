TASK CRATE-PRICE-1 — Hòm vật tư price default A (1.000 credit / 10 WP) + optional price factor. Model: Hydrogen.

STEP A: docs/tasks/CRATE-PRICE-1.md (copy), .progress.md, .report.md as usual; on retry continue from first unticked item.
TOKEN SAVING: read docs/CODEMAP.md first, grep by symbol, line ranges only.

ITEM 1 — defaults: crateShop defaults (sanitizer in src/engine/shop.ts ~1066-1121, CrateShopAdminBlock) wp.price 10, credit.price 1000 (was 100 / 100000). Saves that already store crateShop keep THEIR numbers; fresh saves and the block's "Khôi phục mặc định" get the new ones. Update live-example text and any test that asserts 100 / 100000 (fix minimally, list in report).

ITEM 2 — optional factor: crateShop.priceFactor { enabled false, creditPct 100 (10-1000) }: when enabled, the credit price shown/charged = round(estimateCrateValue(adminConfig, deployed Gear level) x creditPct / 100) instead of the fixed price; the WP price stays the fixed number. One shared helper getCrateCreditPrice(pilot, adminConfig) used in SupplyShopPanel.tsx crate row + confirm dialog and useGameStore.ts buyCrateCredit. Admin block (CrateShopAdminBlock.tsx): checkbox (enabled) + number input (creditPct 10-1000) with live example at Gear Lv.20.

HARD LIMITS:
- No save version bump (CURRENT_SAVE_VERSION stays 15).
- No change to crate contents / odds.
- Old saves unchanged (existing stored crateShop wp/credit prices preserved).

TESTS (max 3):
1. Fresh defaults are wp.price === 10 / credit.price === 1000 (and legacy saved numbers preserved).
2. priceFactor.enabled = true -> getCrateCreditPrice (and shop row / buyCrateCredit) follows deployed Gear level (estimateCrateValue(adminConfig, gearLevel) * creditPct / 100) while WP price stays fixed.
3. priceFactor.enabled = false -> uses fixed credit.price (and WP stays fixed).

CHECKS: Related tests (--reporter=dot) + npx tsc --noEmit only. No full vitest, no build.
REPORT (<= 10 lines) ending "NOT checked in a real browser".
