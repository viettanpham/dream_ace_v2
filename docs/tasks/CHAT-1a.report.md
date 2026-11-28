TASK CHAT-1a — Complete
- ITEM 1 (data): src/data/voiceLines.json + src/data/voiceLines.ts (pickVoiceLine) for all 12 triggers across ally/player/enemy.
- ITEM 2 (engine): VOICE_DEFAULTS in src/data/balance.ts + src/engine/voice.ts (emitVoice, isolated BattleState.voice RNG stream, 3-action cooldown, 2/round max, once-per-battle lowHp, 1 win/lose line).
- ITEM 3 (hooks): Wired startTaunt in src/engine/combat.ts and supplyUse/skillAttack/skillSupport/kill/crit/evade/lowHp/shieldBreak/allyDown/win/lose in src/store/useGameStore.ts (no save/Admin UI change).
- ITEM 4 (log): Added category "voice", tag VOICE, log.voice (${unitName}: "${line}") & voice icon/avatar row in CombatLogList without adding filter UI.
- Files: src/data/{voiceLines.json,voiceLines.ts,balance.ts}, src/engine/{voice.ts,combat.ts,mapGenerator.ts}, src/store/useGameStore.ts, src/types/game.ts, src/utils/combatLogFormat.ts, src/components/CombatLogList.tsx, src/i18n/{index,vi,en}.ts, src/engine/__tests__/voiceChat1a.test.ts, docs/CODEMAP.md.
- Tests: npx vitest run --reporter=dot voiceChat1a.test.ts npcSupplyUseCs6b.test.ts npcBuffCards2.test.ts -> 3 files, 13 tests passed.
- TypeScript: npx tsc --noEmit -> 0 errors.
NOT checked in a real browser
