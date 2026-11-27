# TASK GEAR-L2 Report
- ITEM 1: Created `src/components/GearSwapPicker.tsx` (`BottomSheet` `z-[60]` `max-h-[86dvh]`, `data-testid="gear-swap-picker"`), sorted best-first by rarity/level/power, displaying `formatItemTraitsList`, top-4 `calculateEffectiveStats` deltas vs current slot, `validateEquipOnGear` disabled/dimmed rows with localized reason, single-tap `[Trang bị]`, and `[Đóng]` footer / empty-list state.
- ITEM 2: Wired `detail-swap-btn` next to `detail-unequip-shortcut`, empty-slot selection + `detail-pick-btn` inside shared `renderDetailContent()`, and stacked `BottomSheet` support in `src/components/GearView.tsx` & `src/components/BottomSheet.tsx`.
- Files changed: `src/components/GearSwapPicker.tsx` (new), `src/components/GearView.tsx`, `src/components/BottomSheet.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/__tests__/gearSwapPickerL2.test.tsx` (new), `docs/CODEMAP.md`, `docs/tasks/GEAR-L2.progress.md`.
- `GearView.tsx` lines: 2924 before -> 2955 after (+31 lines).
- Checks: `npx tsc --noEmit` passed; `npx vitest run --reporter=dot src/components/__tests__/gearDetailActionBarU2c2.test.tsx src/components/__tests__/gearDesktopLayoutL1.test.tsx src/components/__tests__/gearSwapPickerL2.test.tsx` -> 3 passed (12 tests).
- NOT checked in a real browser (phone sheet over sheet, desktop right column).
