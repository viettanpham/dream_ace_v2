# TASK SB2 v2 Report — Selected-unit panel fixed height (>640px)

## Step 0 Facts (Before SB2)
- `showLockTargetBtn` (`BattleScreen.tsx:1421-1437`): **40px** (`min-h-[34px]` button + `6px` `gap-1.5`); shown only when `sidebarUnit.alive && isEnemy && !isStealthed && canPlayerManualAct`; text: `"Khóa mục tiêu Địch"` / `"Đã khóa mục tiêu"` (`vi`), `"Lock Enemy Target"` / `"Target Locked"` (`en`).
- `isBlocked` banner (`BattleScreen.tsx:1398-1403`): **28px** (`2px` border + `4px` `py-0.5` + `16px` text + `6px` `space-y-1.5` gap); shown only when `isEnemy && sidebarUnit.alive && !validBasicTargetIds.has(sidebarUnit.id)` — meaning a living front/middle enemy row (or stealth) prevents the player's basic attack from targeting that unit; text: `"Tiền tuyến chắn đòn bắn thường"` / `"Front row blocks basic attack"`.
- `turn-queue-acting-chip` (`TurnQueueBar.tsx:765-804`): **42px** (`h-[36px]` + `6px` gap inside `turn-queue-sidebar`, outside `battle-selected-unit-panel`); shown when `!battle.summary && queue.current[0]`; text: `${teamTag} ${actor > target} SPD ${effectiveSpeed}`. Untouched per RULES (`Do NOT touch the turn queue`).
- `turn-queue-combat-icon` (`TurnQueueBar.tsx:722-731`): **24×24px** inside fixed `h-[32px]` queue header (**0px** height impact); shown when `!battle.summary`; label: `queue.inCombat`. Untouched per RULES.
- `!sidebarUnit` fallback (`BattleScreen.tsx:1262-1270`): **~42px** single-line box (`battle.noUnitSelected`) instead of the ~245px card.
- Old `battle-selected-unit-panel` total height: smallest state (no lock button, no banner) **~245px** (`2 border + 20 p-2.5 + 23 header + 52 bars + 38 telemetry + 92 status + 18 gaps`); largest state **~313px** (`245 + 28 + 40`, a **+68px** jump).

## Changes Made
1. **Single-source constants (`src/utils/battleDisplay.ts`)**:
   - Exported `SIDEBAR_UNIT_PANEL_HEIGHTS` and `SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX = 240`:
     `borderPx (2) + padYPx (12) + headerPx (32) + barsPx (52) + telemetryPx (38) + statusAreaPx (92) + gapPx * gapCount (4 * 3 = 12) = 240px`.
   - `240px <= 245px` (strictly below today's smallest state; 0px growth, 0px delta across all states including `!sidebarUnit` and `battle.summary`).
2. **Header row & fixed panel body (`src/components/BattleScreen.tsx`)**:
   - Header (`sidebar-unit-header`): single `flex-nowrap` `h-[32px] min-h-[32px] max-h-[32px]` line containing `[side tag (shrink-0)][name (flex-1 min-w-0 truncate)][lane · exposure (min-w-0 max-w-[48%] shrink truncate)]` plus always-rendered non-shrinking right slots (`sidebar-unit-header-actions`, `shrink-0`):
     - `sidebar-blocked-slot`: `24×24px` square (`w-6 h-6 shrink-0`), amber (`text-amber-400`) with `battle.frontRowBlocked` in `title` & `aria-label` when `isBlocked`; dimmed (`opacity-40`, `aria-disabled="true"`, no click) with `battle.frontRowNotBlocked` when not blocked.
     - `sidebar-lock-target-btn`: `32×32px` icon-only button (`w-8 h-8 shrink-0`), preserving `selectTarget(sidebarUnit.id)` and `canLockTarget` / `isLocked` rules, with localized `title` & `aria-label`; dimmed (`opacity-40`, `aria-disabled="true"`, `disabled`, no click) when N/A (`!canLockTarget`).
   - Removed the old 40px button row and 28px `isBlocked` banner from the panel body.
   - Locked `battle-selected-unit-panel` (including `!sidebarUnit` fallback) to `SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX` (`240px`), `bars` (`52px`), `telemetry` (`38px`), and kept `FixedStatusArea` (`92px`), `TurnQueueBar`, combat log (`flex-1 min-h-[220px]`), SP orange token (`#EF9F27`), and `CURRENT_SAVE_VERSION = 9` untouched.
3. **i18n (`src/i18n/vi.ts`, `src/i18n/en.ts`)**:
   - Added `battle.frontRowNotBlocked` and `battle.lockTargetUnavailable` in both `vi` and `en`.

## Narrowest-Width Arithmetic (>640px)
- Desktop/tablet layout grid `grid-cols-[minmax(0,65fr)_minmax(260px,35fr)]` sets the narrowest sidebar width above `640px` (`641px..771px` viewports) at **`260px`**.
- Inner header content width = `260 - borderPx (2) - padXPx (20) = 238px`.
- Right slots + gap = `24px (blocked) + 4px + 32px (lock) + 6px = 66px` (`shrink-0`, always 100% visible).
- Left flexible track = `238 - 66 = 172px`: `[side tag, shrink-0]` (~28–52px) leaves ~`112–136px` split between `[name]` (`flex-1 min-w-0 truncate`) and `[lane · exposure]` (`min-w-0 max-w-[48%] shrink truncate`), so both truncate with ellipsis without wrapping or clipping the right slots.

## Files Touched
- `src/utils/battleDisplay.ts`
- `src/components/BattleScreen.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/battleSidebarPanelSb2.test.tsx` (new)
- `docs/tasks/SB2.progress.md`
- `docs/tasks/SB2.report.md` (new)
- *(No older tests required updates; existing `not.toContain('h-[244px]')` assertions in `battleG3d.test.tsx` and `battleLayoutG4a2b.test.tsx` continue to pass, while `UnitDetailSheet` tests remain untouched.)*

## Verification & Results
- **Tests (`npx vitest run`)**: **34 passed (34)** test files, **257 passed (257)** tests (baseline 253 + 4 new SB2 tests).
- **TypeScript (`tsc --noEmit` / `lint_applet`)**: passed, 0 errors.
- **Production build (`compile_applet`)**: succeeded.
- **Final panel height**: **`240px`** across all states (`0px` delta; `5px` shorter than today's smallest `~245px` state).

## Not Verifiable in Real Browser
- Actual browser pixel measurements (`getBoundingClientRect`), visual text ellipsis cutoff rendering at `641px` viewport width with live font glyphs, native browser hover tooltip timing on `title`, and real flex-scroll interaction with the combat log (`flex-1 min-h-[220px]`) were verified via arithmetic constants and jsdom unit tests rather than a live Chromium browser.
