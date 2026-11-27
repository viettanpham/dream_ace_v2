# TASK CARD-POP2 Report

## ITEM 0(a) — Why a card may show NO popup (audit)
1. `skipAnimations`: defaults `false`, toggled only manually via FX/More menu (`toggleSkipAnimations`); speed >=10 mutes SFX and >=15 skips step delay only. When `true`, store skips creating popups and `BattleUnitCard` unmounts the popup container.
2. `effectsMode`: `'off'` suppresses all popups (`shouldShowCardPopup` & unmount); `'compact'` only keeps `'damage' | 'crit' | 'heal'`, hiding `'shield'`, `'buff'` (`+SP`), and `'status'`.
3. `reducedMotion`: `'on'` or OS `prefers-reduced-motion` skips perimeter flight and fades at center (`600ms`) — popups still show unless suppressed above.
4. `perfMode`: `html[data-perf="low"]` only disables infinite/ambient FX and drop-shadows (`index.css`); `.anim-card-popup-*` still run (only `html[data-paused="true"]` pauses CSS animations on blurred/hidden tab).
5. Lifetime at 2x: `flightMs + 450ms` (`650ms`, unscaled by `battleSpeed`); high-speed pending compacting only runs at `>=15x`, and popups vanish early only if unit dies (`!unit.alive` resets queue). No plain bug found.

## Items & Files Changed
- ITEM 0(b): updated expectations in 3 stale tests (`fluxTransferPickerB3.test.tsx`, `gearDesktopLayoutL1.test.tsx`, `gearRadarRad1b.test.tsx`).
- ITEM 1 (zone): added `cardPopupZoneWidthPct`/`cardPopupZoneHeightPct` (default 60/45, sanitized 20..100 without bumping `CURRENT_SAVE_VERSION`), `pickCardPopupEndPoint()` (6 candidates maximizing min distance), `--card-pop-ex`/`--card-pop-ey`, and blur/Enter draft inputs (`20-100`).
- ITEM 2 (icons): added `parseCardPopupDisplay()` & `getCardPopupSymbol()` using `iconCatalog` Material Symbols (`SS01` `health_cross`, `heart_plus`, `BS05` `security`, `SS02` `bolt`; `12px` small / `14px` normal; SP matched to `SP_COLOR_TOKENS`, crit kept `text-[15px]` amber; plain labels unchanged).
- Files: `src/types/game.ts`, `src/engine/migration.ts`, `src/store/useGameStore.ts`, `src/utils/cardPopupQueue.ts`, `src/components/AdminPanel.tsx`, `src/components/BattleUnitCard.tsx`, `src/index.css`, `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/components/__tests__/cardPopupZoneIconsPop2.test.tsx`, `docs/CODEMAP.md`.
- Checks: `npx tsc --noEmit` passed; targeted vitest passed 5/5 files, 23/23 tests (`cardPopStatusPop1`, `cardPopupZoneIconsPop2`, `fluxTransferPickerB3`, `gearDesktopLayoutL1`, `gearRadarRad1b`).
- NOT checked in a real browser: visual popup landing placement across 6v6 cards and Material Symbol icon legibility/size on phone viewport.
