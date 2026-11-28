TASK PREP-2 — Pre-stage dialog: battle info header + Hủy button. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/PREP-2.md, checklist docs/tasks/PREP-2.progress.md, tick items, final report docs/tasks/PREP-2.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol. Open ONLY: src/components/PrestageDialog.tsx; BattleScreen.tsx only the PrestageDialog mount (~3583) and where confirmPrestage / retreat go back to the map; useGameStore.ts confirmPrestage (~4466), startBattle / launchBattleForSector (grep), retreatBattle (~5557) and the auto-repeat session stop code (grep AutoStopReason / stopAutoRepeat); the BattleKind label keys (grep battle.kind / kindLabel in MapView or i18n); prestage.* keys in vi.ts / en.ts. Related tests only + tsc. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

ITEM 0 — update ONLY the stale expectation of starterEvent.test.tsx:~156 (card_exp_10000 "Dùng hết" now opens the EXP-waste confirm dialog: assert the dialog / confirm path instead); list the assert changed.
ITEM 1 — Info header. Under the title "Chuẩn bị trận" (desktop dialog AND the phone BottomSheet) add one compact line: [kind badge] <base name> · <base type> · <N> v <N>, and a second short line "Ta tấn công <base>" / "Ta phòng thủ <base>" / for patrol, mission, event the kind label only. Kind labels vi AND en: assault Tấn công, defend Phòng thủ, patrol Tuần tra, mission Nhiệm vụ, event Sự kiện (reuse existing keys if they exist). Data: battle.kind, battle.sectorId -> sector name/baseType (fallback "—" when no sector). Do not duplicate the totals already shown. No layout growth on phone beyond +2 short lines (the list scrolls).
ITEM 2 — Hủy button. New store action cancelPrestage(): allowed ONLY while battle.prestage.active && !battle.summary. It discards the pending battle completely: no result, no penalty, no month advance, no EXP / Credits, no buff-card / EXP-boost battle countdown, no restock counter change, supplies untouched; report in one line what launchBattleForSector changes before the dialog (anything it consumed must be restored). If an auto-repeat session is active, stop it (reason 'cancelled', add it to the stop-reason type only if needed) and do not start the next battle. Then return to the screen the player came from (map). Footer: [Hủy] (secondary) next to [Vào trận] on desktop and in the BottomSheet footer; the sheet backdrop/ESC must NOT cancel by accident. No confirm dialog (it costs nothing).
ITEM 3 — vi AND en keys: prestage.cancel "Hủy" / "Cancel", kind labels, the two header lines.

HARD LIMITS: after Vào trận everything behaves exactly as before; no battle numbers change; old saves load; no new screen.

TESTS (max 4, small): header shows the right kind label for each of the 5 kinds; cancelPrestage resets the battle and leaves pilot/economy unchanged and refuses when prestage is not active; auto-repeat stops on cancel; vi/en parity.

CHECKS (slim): related test files with --reporter=dot (prestageDialog.test.tsx first) + tsc --noEmit. NO full vitest, NO production build. List old failing asserts in one line, do not fix.

REPORT (<= 10 lines): items done + files changed; ITEM 0 assert changed; what launch changes before the dialog; tests; NOT checked in a real browser.
