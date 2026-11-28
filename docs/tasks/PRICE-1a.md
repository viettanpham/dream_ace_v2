TASK PRICE-1a — Admin "Bảng giá vật phẩm" (price overrides for supplies + skill cards). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/PRICE-1a.md, checklist docs/tasks/PRICE-1a.progress.md, tick items, final report docs/tasks/PRICE-1a.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol. Open ONLY: src/engine/itemPrice.ts (computeSupplyPrice ~80); src/data/skills.ts getSkillCardPrice (~394) + getOpeningCardsList; src/data/consumables.ts SUPPLY_TEMPLATES (~184); src/types/game.ts AdminConfig (~1805); src/engine/migration.ts only where skillCardPriceMult / supplyEconomy are defaulted + sanitized (~558, ~1051, ~1098); AdminPanel.tsx only the battle-tab AdminSection list near id="crate-shop" (~3112); src/components/admin/CrateShopAdminBlock.tsx as the style example. Related tests only + tsc. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged (adminConfig sanitizer only).

ITEM 1 — Engine. New optional AdminConfig.priceOverrides: Record<string, number> (itemId -> price, integer >= 1; sanitize: drop non-finite / <= 0 / unknown ids; default {}; clone in migration). computeSupplyPrice: if admin.priceOverrides[template.id] exists use it (wins over everything, including template.priceOverride) — check the 3 call shapes (admin object or economy object) still work; getSkillCardPrice: same for card.id (extend the Pick with optional id and pass the id at the call sites that have the card). Selling still = price x sellPriceRatio, untouched.
ITEM 2 — Admin section "Bảng giá vật phẩm" (new AdminSection id "price-table", collapsed by default, title + one-line description, mounted after crate-shop). Tabs: "Vật tư" and "Thẻ kỹ năng" (editable rows) and "Khác" (read-only). Editable row = icon/name, tier, currency (CR / WP), default price (computed without override), input "Giá riêng" (empty = default), final price, [Đặt lại] reset button; a search box and a "Đặt lại tất cả" button with a confirm. Each input has a LIVE EXAMPLE line ("Giá bán lại = 70% = X"). Tab "Khác": a short list "Thẻ buff, Voucher, Rương vật tư, Thẻ EXP/Credit, Huân chương" each with the current price range and the name of the Admin section where it is edited (no editing here).
ITEM 3 — vi AND en keys.

HARD LIMITS: no shop/store behaviour changes except the price source; old saves load; no new screen; all other price formulas untouched.

TESTS (max 4, small): override beats default for a supply and for a skill card; empty/invalid override ignored by sanitizer; reset removes the key; shop buy price uses the override (one store/engine test).

CHECKS (slim): related test files with --reporter=dot + tsc --noEmit. NO full vitest, NO production build.

REPORT (<= 10 lines): items + files changed; call sites touched; tests; NOT checked in a real browser.
