TASK CHAT-1b — Complete
- ITEM 0 (test audit): Updated combatLogG4a2d.test.tsx Row 2 channel assertions to include combat-log-filter-voice ("Thoại"); battleG3c.test.tsx & admUi1.test.tsx needed no edits.
- ITEM 1 (config): Added VoiceConfig, AdminConfig.voice, BattleVoiceState.config, and sanitizeVoiceConfig() (clamp + unknown-key filter + VOICE_DEFAULTS fallback); copied at battle start, removed unused opts.enabled (CURRENT_SAVE_VERSION stays 15).
- ITEM 2 (Admin block): Added src/components/admin/VoiceAdminBlock.tsx inside collapsed AdminSection id="voice-lines" in AdminPanel.tsx battle tab with toggle, cooldown, max/round, 12 trigger % inputs in 2-col grid, live recomputing examples, commit-on-blur drafts, and Defaults reset.
- ITEM 3 (log channel): Added 'voice' to CombatLogChannel, CHANNELS ("Thoại"/"Voice"), and filterCombatLogEntries() ('voice' only vs excluded from ally/enemy/system, kept in 'all'); tightened compact chip padding (px-1) to fit 1 row at 360px without wrap/scroll.
- Files: src/types/game.ts, src/engine/{voice,combat,migration}.ts, src/store/useGameStore.ts, src/components/{admin/VoiceAdminBlock,AdminPanel,CombatLogList}.tsx, src/utils/combatLogFormat.ts, src/i18n/{vi,en}.ts, src/engine/__tests__/{voiceAdminChat1b,voiceChat1a}.test.ts, src/components/__tests__/combatLogG4a2d.test.tsx, docs/CODEMAP.md.
- Tests: vitest --reporter=dot across 6 files (29/30 passed: voiceAdminChat1b 4/4, voiceChat1a 4/4, npcBuffCards2 4/4, battleG3c 9/9, admUi1 4/4, combatLogG4a2d 3/4 — test #1 fails only on pre-existing stale CURRENT_SAVE_VERSION 12 vs 15).
- TypeScript: npx tsc --noEmit -> 0 errors.
NOT checked in a real browser
