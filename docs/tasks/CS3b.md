# TASK CS3b — Shop tab "Vật tư" (UI) + Admin CP block "Cửa hàng vật tư"

Source: Task CS3b prompt (resumed after context compaction; specification preserved verbatim from task brief):

- **ITEM 1 — Tab "Vật tư"**:
  - Create `src/components/SupplyShopPanel.tsx`.
  - In `src/components/ShopScreen.tsx`: add 4th sub-tab (`data-testid="shop-tab-supply"`, short label `"Vật tư"`, extend `ShopSubTab` in `src/store/useGameStore.ts` with `'supply'`; phone tab container fits 4 buttons at `360px` via `grid-cols-4` on phone) and render `<SupplyShopPanel />`. Keep `ShopScreen.tsx` growth `<= ~25 lines`.
  - Buy section: rows from `supplyShopStock` grouped by family (`Sửa chữa · Khiên · SP · Buff` when present): `icon | name + tier | effect summary "HP +22%" | price "52 CR" | "còn {n}" | "có {n}" | buttons [x1] [x5] [x10]` calling `buySupply(templateId, qty)`.
  - A button is disabled with a short reason text when `remaining === 0` (`"Hết hàng"`), credits are short, `qty > remaining`, or owned stack would exceed `99` (`SUPPLY_STACK_CAP`).
  - A sold-out row (`remaining === 0`) stays visible and dimmed.
  - Purchase result shows in the existing notice line (`setNoticeText` in `ShopScreen.tsx`).
  - Empty `supplyShopStock` renders one text line only.
  - Sell section below it: heading `"Bán lại"` and one row per owned supply (`consumables` with `kind === 'battle_supply' && quantity > 0`): `name | "có {n}" | sell price per piece | [Bán 1] [Bán 5]` calling `sellSupply(templateId, qty)` (disabled when owned `< 1` / `< 5`).

- **ITEM 2 — Admin CP block "Cửa hàng vật tư"**:
  - Next to the `shieldRegen` block in `src/components/AdminPanel.tsx` (`~1570-1815`), add `<= ~60 lines`: 4 number fields (số loại tối thiểu / tối đa, số lượng tối thiểu / tối đa) writing `adminConfig.supplyShopMinTypes / MaxTypes / MinQty / MaxQty` through `adminUpdateConfig`, with CS3a clamps (`types 1-12`, `qty 1-99`, `min <= max` fixed on write); help line `"Áp dụng từ lần làm mới kho tiếp theo"`; one button `"Làm mới kho ngay"` calling `adminRestockShopNow`.

- **Constraints**:
  - Other shop tabs unchanged; NO loadout panel in Shop; NO store/engine changes except extending `ShopSubTab` with `'supply'`.
  - `CURRENT_SAVE_VERSION` unchanged; do NOT enable Firebase.
  - All new strings in BOTH `vi.ts` and `en.ts`.
  - No horizontal overflow at `360px`; nothing at `x < 8`; page scroll only on phone (no nested scroll box).
  - `ShopScreen.tsx` grows `<= ~25 lines`; `AdminPanel.tsx` grows `<= ~60 lines`.

- **Tests (<= 5 tests)**:
  1. Shop renders 4 tabs; switching to `"Vật tư"` renders grouped rows and hides equipment filters.
  2. Buy `[x1]`/`[x5]`/`[x10]` disabled states & short reason text for `remaining === 0` (`"Hết hàng"`), short credits, `qty > remaining`, `owned + qty > 99`; sold-out row stays visible & dimmed; empty stock renders one text line only.
  3. Clicking buy calls `buySupply` and updates notice line; owned supplies appear in `"Bán lại"` and clicking `[Bán 1]`/`[Bán 5]` calls `sellSupply` and updates notice.
  4. `vi.ts` & `en.ts` have identical key sets and 360px layout has no nested scroll box.
  5. Admin block writes the four values clamped (`1..12`, `1..99`) and fixes `min > max`, and `"Làm mới kho ngay"` calls `adminRestockShopNow`.
