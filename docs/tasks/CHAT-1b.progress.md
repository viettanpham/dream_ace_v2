# TASK CHAT-1b Progress

- [x] STEP A: Check docs, read CODEMAP & inspect admin/log patterns
- [x] ITEM 0: Check & update tests asserting the exact log channel list (`combatLogG4a2d.test.tsx`)
- [x] ITEM 1: `VoiceConfig`, `AdminConfig.voice`, `BattleVoiceState.config`, `sanitizeVoiceConfig()`, battle-start config copy, remove unused `opts.enabled`
- [x] ITEM 2: `src/components/admin/VoiceAdminBlock.tsx` mounted in `AdminPanel.tsx` battle tab (`AdminSection id="voice-lines"`, collapsed, live examples, reset)
- [x] ITEM 3: `'voice'` channel in `CombatLogChannel`, `CHANNELS`, `filterCombatLogEntries()` & compact 360px 1-row layout
- [x] TESTS & CHECKS: `<= 4` tests, related `--reporter=dot` + `tsc --noEmit`, `CODEMAP.md`, `CHAT-1b.report.md`
