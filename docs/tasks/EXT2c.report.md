# TASK EXT2c Report

- ITEM 1: Truyền `adminConfig` (tham số 3) và `pilot.warehouse` (tham số 4) vào `sumGearEquipmentStats`/`sumGearSpecialTraits`/`calculateGearPowerRating` (`GearView.tsx`, `GarageView.tsx`, `GearSwapPicker.tsx`).
- ITEM 2: Tab `"Mô-đun"` trong `GearView.tsx`, `WarehouseView.tsx` (đã dùng `ITEM_SLOTS`) và `ShopScreen.tsx` (`ITEM_SLOTS`); tạo `src/components/ModuleSocketList.tsx` (`module-socket-list` trong `renderDetailContent()`, 5 khe, delta, `canEquipModule`, 1-chạm `setExtenderModule`); thêm chuỗi `module.*` vào `vi.ts` & `en.ts`.
- ITEM 3: Thêm `GearSocketRow` (`gear-socket-row`, 5 ô khe) dưới paper-doll trong `GearView.tsx`; mở rộng `GearSwapPicker.tsx` với `socketIndex` (Hòm đồ + Kho chứa, hiệu ứng 1 dòng, delta, lý do khóa, `[Trang bị]`, `[Gỡ]` khi khe đang lắp, giữ nguyên slot paper-doll).
- Files changed: `GearView.tsx`, `GarageView.tsx`, `GearSwapPicker.tsx`, `ShopScreen.tsx`, `ModuleSocketList.tsx` (mới), `vi.ts`, `en.ts`, `moduleSocketUiExt2c.test.tsx` (mới), `CODEMAP.md`.
- `GearView.tsx` lines: 2975 -> 3025 (+50 lines).
- Checks: `npx tsc --noEmit` PASS; related vitest 10 files (41/46 passed: `moduleSocketUiExt2c` 5/5, `gearSwapPickerL2` 4/4, `gearPaperDollU2c1` 5/5, `gearDetailActionBarU2c2`, `warehouseViewW1b1`, `warehouseQuickSellW1b2` 5/5, `warehouseAndClock` PASS; 3 file còn lại chỉ lỗi sẵn từ B2c/C3: `fluxTransferPickerB3`, `gearDesktopLayoutL1:141`, `gearRadarRad1b`).
- Chưa kiểm tra trên trình duyệt thật: BottomSheet chi tiết trên điện thoại, 5 ô `gear-socket-row` ở màn hình 320–390px và kiểm tra tràn ngang thực tế.
