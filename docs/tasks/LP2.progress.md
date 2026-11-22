# TASK LP2 Progress

- [x] 0. Step 0 read-only audit (`npx vitest run` = 274, loop prefs storage key, `AUTO_REPEAT_MAX_DEFEAT_STREAK` & "Dừng khi thua", speed scaling & allowed speeds, floating label queue behavior at high speed)
- [x] 1. Loop popover "Khi thua" 3 radio options + N (1-99, default 3) input + migration + defeat streak logic + stop reason
- [x] 2. Speeds: 1, 2, 3, 5, 10, 12, 15, 20, 30 + desktop "…" portaled popover + phone full list + device persistence
- [x] 3. High speed safety: skip queueing/rendering radar floating labels at >=15x, identical battle outcome/log across speeds
- [x] 4. Tests (vitest) & verification checks (`npx vitest run`, `tsc --noEmit` / `lint_applet`, production build, report)
