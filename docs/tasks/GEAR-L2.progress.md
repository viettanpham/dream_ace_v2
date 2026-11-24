# TASK GEAR-L2 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/GEAR-L2.md`, create `docs/tasks/GEAR-L2.progress.md`, inspect `CODEMAP.md` and targeted symbols/line ranges
- [x] Add `vi.ts` and `en.ts` strings for swap picker & entry buttons (`detail-swap-btn`, `detail-pick-btn`, empty list text, etc.)
- [x] Implement `src/components/GearSwapPicker.tsx` (`BottomSheet` based, `data-testid="gear-swap-picker"`, best-first sorting, `formatItemTraitsList`, stat delta comparison via `simulateGearEquipChange` + `calculateEffectiveStats`, `validateEquipOnGear` disabled/dimmed state, single-tap `[Trang bị]` -> close & select slot)
- [x] Wire `GearSwapPicker` and entry points in `src/components/GearView.tsx` (`detail-swap-btn` next to `detail-unequip-shortcut`, empty slot click selects empty slot instead of only filtering, `detail-pick-btn` in empty detail state, keep `GearView.tsx` growth <= ~40 lines)
- [x] Write `<= 4` focused UI tests in `src/components/__tests__/gearSwapPickerL2.test.tsx`
- [x] Run `npx tsc --noEmit` and ONLY `gearDetailActionBarU2c2`, `gearDesktopLayoutL1`, and `gearSwapPickerL2` (`--reporter=dot`, max 15 lines)
- [x] Update `docs/CODEMAP.md`, tick checklist, write and print `docs/tasks/GEAR-L2.report.md` (<= 12 lines)
