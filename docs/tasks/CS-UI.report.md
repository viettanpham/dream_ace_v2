# TASK CS-UI Report

**Items done:**
- ITEM 1 — Created `src/components/SupplyLoadoutBar.tsx` displaying `"Túi vật tư"` (`n/N`), `N = adminConfig.supplyLoadoutSlots` interactive tiles (`48px` phone / `52px` desktop) with catalog icon, short label, and stock `xN` (dimmed `x0` or `+` when empty), mounted once per breakpoint (`variant="desktop"` under the owned gear selector, `variant="phone"` after the phone two-column slot grid and before the cargo panel) with unique `supply-slot-${variant}-${index}` test IDs.
- ITEM 2 — Added the supply picker (popover below row on desktop with backdrop `overflow-hidden` isolated so it never clips; `BottomSheet` on phone), `"Trống / Gỡ"` row when clearing a filled slot, owned unlocked templates sorted by family then tier with effect text and stock, `"Đã mang"` disabled state for items already equipped, compact `setSupplyLoadout` replace/append/remove updates, dimmed locked state with `"Không đổi được khi đang đánh"` on active battle/loop or `reason: 'locked'`, and bilingual strings in `vi.ts` / `en.ts`.

**Files changed:**
- `src/components/SupplyLoadoutBar.tsx`, `src/components/GearView.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/__tests__/supplyLoadoutBarCsUi.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/CS-UI.md`, `docs/tasks/CS-UI.progress.md`, `docs/tasks/CS-UI.report.md`.
- `GearView.tsx` lines: 2,837 before -> 2,852 after.

**Test & typecheck result:**
- `npx tsc --noEmit` passed (0 errors), and all 8 targeted test files (`supplyLoadoutBarCsUi`, `st1Ui`, `autoEquip`, `noticeBannerU2b`, `f2aPlus`, `shopAndIcons`, `gearPaperDollU2c1`, `gearDetailActionBarU2c2` — 39/39 tests) passed.

**Not checked:**
- Not checked in a real browser (desktop popover position, phone BottomSheet layout, 360px single-row fit), full vitest suite, or production build.
