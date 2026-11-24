# TASK MAP-F2 — Final Report

## 1. STEP 0 — Phone & Viewport Heights
- **Phone info header (`map-compact-header`, `MapView.tsx`)**: `max-h-[72px]` (`~66px` rendered: `py-1` 8px + `h-8` 32px title row + `space-y-1` 4px + badge row 20px + 2px border; unchanged).
- **Phone sticky action bar (`map-phone-action-bar`, `MapView.tsx`)**: `61px` rendered (`py-2` 16px + `h-[44px]` buttons + 1px top border; unchanged).
- **Map viewport (`map-viewport-box`, `MapView.tsx`)**: phone `clamp(360px, 62dvh, 560px)`; desktop `h-72 sm:h-80` (`288px` / `320px`; unchanged).

## 2. Items Completed & Files Changed
- **GUARD 1–3 Check (on resume)**: Verified `src/utils/statusDisplayPrefs.ts`, `src/engine/cloudSave.ts`, `src/data/battleKinds.ts`, `docs/tasks/MAP-K1.report.md`, and `@material-symbols/font-400` (`^0.49.0`) present; Firebase untouched; `CURRENT_SAVE_VERSION` remains `10`.
- **ITEM 1 — Nodes, Lanes & Legend (`src/components/MapView.tsx`, `src/index.css`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**:
  - Every visible node has `data-testid="map-node-<id>"` and `data-state` (`allied` | `allied-frontline` | `contested` | `locked`) from `getMapNodeVisualState()` + `frontline.ts`; `hidden` nodes and lanes touching hidden nodes are not rendered.
  - `allied-frontline` adds top-right `#f59e0b` dot (`map-node-frontline-dot-<id>`); `contested` adds orange `2px` slow-pulse ring (`anim-contested-pulse`, disabled under `prefers-reduced-motion` / `[data-reduced-motion="true"]`) and `"Giao tranh"` / `"Contested"` chip under the name; `locked` renders at `opacity 0.45` with a padlock badge (`map-node-lock-<id>`) and still opens the briefing when tapped.
  - Lanes carry `data-kind` (`allied-to-contested` dashed `#F59E0B` 2px, `allied-allied`, `other` at `opacity 0.35`, raid animation preserved).
  - Legend adds `map-legend-contested` (`Giao tranh` / `Contested`) and `map-legend-locked` (`Chưa tiếp giáp` / `Not adjacent`).
- **ITEM 2 — Briefing Battle Options & CTAs (`src/components/MapView.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**:
  - Added `"Trận có thể đánh"` / `"Available Battles"` (`map-briefing-options`) block in `renderBriefingBody()` listing one row per allowed `getBattleOptions()` kind (`assault` / `defend` / `patrol`) with icon, localized `Tấn công {size}v{size}` / `Phòng thủ {size}v{size}` / `Tuần tra {size}v{size}`, and `[Xuất kích]` launching that specific `kind`.
  - When no option is allowed, renders a single muted reason line (`map-briefing-options-blocked`), disables the desktop CTA (`map-deploy-btn` + `map-deploy-blocked-reason`), and disables the phone sticky CTA (`map-phone-deploy-btn`) with `map-phone-deploy-sublabel` while preserving its `h-[44px]` height and short label when 2+ options exist (`pickDefaultBattle()`).
- **Tests & Docs (`src/components/__tests__/mapFrontlineF2.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/MAP-F2.progress.md`, `docs/tasks/MAP-F2.report.md`)**:
  - Verified all 7 tests in `mapFrontlineF2.test.tsx` + all 3 tests in `mapM1.test.tsx` + `frontlineIntegrationF1b.test.tsx` + updated `MapView.tsx` line count (`2049`) in `docs/CODEMAP.md`.

## 3. Verification & Test Count (old -> new)
- `npx vitest run`: **`403` -> `410` passed** across **`63` test files** (`mapFrontlineF2.test.tsx` 7/7, `mapM1.test.tsx` 3/3, `frontlineIntegrationF1b.test.tsx` 8/8, `frontline.test.ts` 7/7, `battleKindsK1.test.tsx` 9/9).
- `npm run lint` (`tsc --noEmit`): passed (`0` errors).
- Production build (`compile_applet` / `vite build`): passed cleanly.

## 4. What Was NOT Checked in a Real Browser
- Visual rendering of `.anim-contested-pulse` SVG ring animation and `prefers-reduced-motion` behavior in Chromium/Firefox/Safari.
- Real mobile viewport fit of the `"Giao tranh"` SVG chip above the node squad-size label and truncation of `map-phone-deploy-sublabel` inside `360px`–`390px` phone screens.
