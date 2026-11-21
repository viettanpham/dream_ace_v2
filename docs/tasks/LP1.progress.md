# TASK LP1 Progress

- [x] 1. Unclip battle-loop-popover via document.body portal with position: fixed, viewport clamping, resize/scroll recomputation, outside click / Escape / battle-end / unmount close
- [x] 2. Honest button state: neutral highlighted style (sky/slate) when popover open & not running; emerald + running dot only when autoRepeatSession.active is true; full-width emerald primary "Bắt đầu"
- [x] 3. Defeat streak stop: AUTO_REPEAT_MAX_DEFEAT_STREAK = 3, consecutiveDefeats on AutoRepeatSession (memory only), AutoStopReason 'defeat_streak', shouldStopAutoRepeat + finalizeBattleOutcome, vi.ts & en.ts strings + summary mapping + clear checkbox label & muted hint
- [x] 4. Counter: verify/fix running chip showing "N/M" and "N/∞" for infinite option
- [x] 5. Tests (vitest): update loopDiagnosis.test.tsx (convert test.fails -> pass, desktop portal & viewport coords, desktop 3-battle launch, non-emerald button state, defeat streak stop & victory reset, "N/∞", vi/en parity, all existing loop tests pass)
