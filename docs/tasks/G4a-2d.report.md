# TASK G4a-2d Report — Combat Log: Newest-First Order, Jump Pill, Compact Header

## 1. Items Done & Files Changed
- **ITEM 1 — Order + Default Expansion**:
  - Added `order` (`'newest' | 'oldest'`, default `'newest'`) persisted per device outside saves via `dreamAce.logOrder.v1` (`LOG_ORDER_STORAGE_KEY`), wired across desktop docked sidebar, phone inline log, and popup sheet.
  - `[Mới | Cũ]` segmented toggle (`Mới nhất trước` / `Cũ nhất trước` tooltips & `aria-label`s) reverses rendered round groups (descending) and lines within each round (newest on top) in `'newest'` mode, without mutating log data; `'oldest'` preserves chronological order.
  - Default round expansion opens the **3 newest rounds** (`DEFAULT_EXPANDED_RECENT_ROUNDS = 3`) and collapses older rounds; `Mở hết` / `Thu hết` continue to work and clear manual per-round overrides (`roundOverrides`).
- **ITEM 2 — Jump Pill**:
  - Reused `scrollStick` top-threshold helpers (`computeTopStickScrollState`, `DEFAULT_TOP_THRESHOLD_PX`) plus new pure helpers (`computePreservedScrollTopOnPrepend`, `isInlineFlowAtTop`) to handle newest-first reading.
  - When scrolled away from the top in newest-first mode, arriving entries never snap scroll back to top (and preserve reading offset), while a `"↑ N dòng mới"` / `"↑ N new lines"` pill appears; tapping scrolls back to top and clears the unseen counter.
  - Works in `docked`, `popup`, and phone `inlineFlow` (page-level scroll tracking via `window` listener + `sticky` jump pill without nested scroll containers). Oldest-first preserves stick-to-bottom + `"↓ Mới nhất"`.
- **ITEM 3 — Compact 2-Row Header**:
  - Consolidated desktop docked and phone inline log chrome into two non-wrapping rows (`flex-nowrap`, `h-[36px]` each):
    - **Row 1** (`combat-log-header-row-1`): title + event count + `[Dòng | Mở rộng]` segmented toggle + popup (`Cửa sổ` / `Popup`) button.
    - **Row 2** (`combat-log-filters`): compact channel tabs (`Tất cả / Ta / Địch / Hệ thống` with full accessible labels) + `[Mới | Cũ]` order toggle + small `24x24` icon-only `Mở hết` / `Thu hết` buttons (`title` + `aria-label`).
  - Eliminated `flex-wrap` jumping above `640px` and preserved every existing `data-testid`.
- **ITEM 4 — Tests, Checks & Docs**:
  - Added `src/components/__tests__/combatLogG4a2d.test.tsx` (4 tests covering persistence, ordering, 3-round default expansion, jump pill across docked/popup/inlineFlow, compact 2-row header, and vi/en parity).
  - Updated superseded pre-G4a-2d default-order/header assertions in `src/components/__tests__/battleG3c.test.tsx`, `src/components/__tests__/battleFixes.test.tsx`, `src/components/__tests__/battleG3d.test.tsx`, `src/components/__tests__/battlePolishRound2.test.tsx`, and `src/components/__tests__/st1Ui.test.tsx`.
  - Updated `docs/CODEMAP.md` and `docs/tasks/G4a-2d.progress.md`.

**Files Changed**:
- `src/utils/scrollStick.ts`
- `src/utils/combatLogFormat.ts`
- `src/components/CombatLogList.tsx`
- `src/components/BattleSheets.tsx`
- `src/components/BattleScreen.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/combatLogG4a2d.test.tsx` (new)
- `src/components/__tests__/battleG3c.test.tsx`
- `src/components/__tests__/battleFixes.test.tsx`
- `src/components/__tests__/battleG3d.test.tsx`
- `src/components/__tests__/battlePolishRound2.test.tsx`
- `src/components/__tests__/st1Ui.test.tsx`
- `docs/CODEMAP.md`
- `docs/tasks/G4a-2d.progress.md`
- `docs/tasks/G4a-2d.report.md`

## 2. Log Header Height Before / After (From Code)
- **Before**:
  - Row 1 in `BattleScreen.tsx` (`px-2.5 py-1.5 flex-wrap` desktop / `px-2 py-1 flex-wrap` phone) combined title + count + `[Dòng|Mở rộng]` + text-labeled `Mở hết / Thu hết` + `Cửa sổ`, wrapping to 2 lines at tablet/compact widths (~74–76px), plus Row 2 `combat-log-filters` (`py-1` + buttons ≈ 34px) => **~108–110px** total chrome.
- **After (`COMBAT_LOG_CHROME_HEIGHTS`)**:
  - Row 1 (`combat-log-header-row-1`): `h-[36px] min-h-[36px] max-h-[36px] flex-nowrap` (**36px**)
  - Row 2 (`combat-log-filters`): `h-[36px] min-h-[36px] max-h-[36px] flex-nowrap` (**36px**)
  - **Total Log Chrome**: **72px** (`<= 76px`, saving **~38px** for the scrollable log body at 800px height).

## 3. Checks & Test Count
- **GUARD 2 Baseline (`npx vitest run`)**: `47 passed` files, `302 passed` tests.
- **Final `npx vitest run`**: `48 passed` files, `306 passed` tests (`302 -> 306`, +4 new G4a-2d tests).
- **`tsc --noEmit` (`lint_applet`)**: Passed cleanly with zero errors.
- **Production build (`compile_applet` / `npm run build`)**: Built cleanly with zero errors.

## 4. What Was NOT Checked in a Real Browser
- Real touch/trackpad scroll momentum, `scrollTop` clamping physics, and sticky jump pill positioning while scrolling `inlineFlow` on an actual phone viewport.
- Live `15x–30x` high-speed combat bursts inserting many log entries per second while manually scrolled away from the top/bottom.
- Actual computed pixel widths/reflow rendering across Chromium/WebKit fonts at `360px`, `641px–768px`, and `1440px` (verified via CSS classes, constants, and jsdom DOM assertions).
