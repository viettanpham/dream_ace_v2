# TASK U2b Report — Shared Notice banner with visible countdown (GEAR tab) + Admin CP duration

## Items Completed
- **STEP A**: Saved verbatim prompt to `docs/tasks/U2b.md`, created & maintained `docs/tasks/U2b.progress.md`, read `docs/CODEMAP.md` and only target file ranges.
- **ITEM 1 — Notice component + Admin CP setting (`src/components/Notice.tsx`, `src/types/game.ts`, `src/engine/migration.ts`, `src/components/AdminPanel.tsx`, `src/i18n/vi.ts`, `src/i18n/en.ts`)**:
  - Created `src/components/Notice.tsx` exporting `Notice` and controlled timer helper `useNoticeCountdown`.
  - Displays text (truncated single-line), optional action button, visible countdown (`9s`) beside the `X` close button (`aria-live="off"`, no per-second announcements), and a thin bottom progress bar.
  - Pauses while hovered, focused, or touched (`pausedRef` + state) and resumes cleanly on leave; `X` closes immediately; `durationSec = 0` shows no countdown/progress bar and never auto-closes.
  - Added optional `AdminConfig.noticeDurationSec` (`DEFAULT_NOTICE_DURATION_SEC = 10`, clamped `0..120` via `sanitizeNoticeDurationSec()` in `src/engine/migration.ts`, wired into `createDefaultAdminConfig()` and `migrateSaveData()`, `CURRENT_SAVE_VERSION` unchanged at `10`).
  - Added `"Thời gian tự đóng banner (giây, 0 = không tự đóng)"` / `"Banner auto-close duration (sec, 0 = stay open)"` numeric field in `AdminPanel.tsx` balance section (`data-testid="admin-notice-duration-input"`).
- **ITEM 2 — GearView single-slot banner integration (`src/components/GearView.tsx`)**:
  - Replaced the three separate banners (`quicksell-undo-toast`, `autoequip-undo-toast`, `inventoryNotice`) and removed the legacy hard-coded 5000 ms quick-sell timer with one `44px`-tall `Notice` slot above the item grid (nothing rendered when empty).
  - Enforced single-banner semantics: any new banner replaces the active one while leaving replaced store undo data untouched; undo actions work only while their banner is visible, and expiry/`X` calls `clearQuickSellUndo` / `clearAutoEquipUndo`.
  - Preserved all existing `data-testid`s (`quicksell-undo-toast`, `quicksell-undo-btn`, `autoequip-undo-toast`, `autoequip-undo-btn`) and tone colors (`warning` amber for quick sell, `info` sky for auto equip, `success` emerald for plain inventory notices), plus updated `qs.undoToast` to `"Đã bán nhanh {count} linh kiện (+{credits} CR)."`.

## Files Changed
- `src/components/Notice.tsx` (new)
- `src/components/GearView.tsx` (`2829 -> 2823` lines)
- `src/types/game.ts`
- `src/engine/migration.ts`
- `src/components/AdminPanel.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/__tests__/noticeBannerU2b.test.tsx` (new)
- `docs/CODEMAP.md`
- `docs/tasks/U2b.md`
- `docs/tasks/U2b.progress.md`
- `docs/tasks/U2b.report.md`

## Checks
- **Full Vitest suite (`npx vitest run`)**: **66 files / 420 passed** (`415 -> 420`, +5 new U2b tests).
- **Typecheck (`lint_applet` / `tsc --noEmit`)**: **Passed (0 errors)**.
- **Production build (`compile_applet` / `npm run build`)**: **Passed**.

## NOT Checked in a Real Browser
- Actual `44px` banner height/truncation on a real 360px phone viewport and physical pointer hover / touch pause-resume feel were checked via DOM classes and jsdom fake-timer tests only, not live browser rendering.
