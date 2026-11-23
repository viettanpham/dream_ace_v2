# TASK MAP-M1 — Progress Checklist

## STEP 0 Findings (audit before edits)
- **Phone detection**:
  - `useBattleLayoutMode()` in `src/utils/battleDisplay.ts` classifies `'phone-portrait'` when `width <= 640` (and not landscape phone `width > height && height <= 500`), `'tablet'` for `641..1023`, and `'pc'` for `>= 1024`.
  - Responsive CSS uses Tailwind `sm:` (`640px`, used in `MapView.tsx`: `p-3 sm:p-5`, `h-72 sm:h-80`) and `md:` (`768px`, used in `SidebarNav.tsx` / `HangarScreen.tsx` where `pb-[60px] md:pb-0` reserves space for the `56px` fixed bottom tab bar).
  - Reusing `useBattleLayoutMode() === 'phone-portrait'` paired with `sm:` breakpoints covers both real phone viewports and jsdom tests cleanly.
- **Current 390px rendered heights (`src/components/MapView.tsx`)**:
  - Header card (`lines 745–792`): `~260–285px` (`p-3.5`, `text-2xl` title, month + income chips, 3-line `map.pageSubtitle`, and two 44px CTA buttons).
  - Map box (`line 878`): `h-72` (`288px`), while `viewBox="0 0 840 310"` at `~364px` width renders the map SVG at `364 * 310 / 840 ≈ 134px` tall (`zoom = 1`, tiny ~5px labels).
  - Zoom button area (`lines 842–870`): `top-2 right-2` with 3 × `44px` buttons (`140px × 44px`), colliding with `mobile.mapPanHint` at `top-2 left-2.5` on ~366px inner width.
- **Pan/zoom mechanics (`lines 213–287`)**:
  - `zoom` starts at `1`, `pan` starts at `{ x: 0, y: 0 }`.
  - `clampZoom(z)` clamps to `[0.75, 2.4]`; `clampPan(x, y)` clamps to fixed `[-260, 260]` / `[-150, 150]`.
  - `handlePointerDown/Move/Up` manages 1-pointer drag pan (with 6px move threshold to guard `handleSelectSector`) and 2-pointer pinch zoom; `handleWheel` steps zoom by `±0.15`.

## Checklist
- [x] ITEM 1 — Compact header on phone `< 640px` (`MapView.tsx`, max 72px, `(i)` subtitle sheet/popover, desktop unchanged)
- [x] ITEM 2 — Big map + pure initial phone zoom/centering + floating bottom-right 40px zoom buttons + 4s auto-fade bottom-left hint + reset view
- [x] ITEM 3 — Sticky bottom action bar on phone (`map.advanceMonthShort`, `map.deployShort` in `vi.ts`/`en.ts`, bottom padding so last sector isn't hidden)
- [x] ITEM 4 — Tests (`src/components/__tests__/mapM1.test.tsx`), `docs/CODEMAP.md`, full `npx vitest run`, `tsc --noEmit`, production build, report
