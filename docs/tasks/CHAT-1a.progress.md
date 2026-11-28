# TASK CHAT-1a Progress

- [x] STEP A: Check docs, read CODEMAP & inspect hooks/log/rng helpers
- [x] ITEM 1: `src/data/voiceLines.json` + `src/data/voiceLines.ts` (`pickVoiceLine`)
- [x] ITEM 2: `VOICE_DEFAULTS` in `src/data/balance.ts`, `src/engine/voice.ts` (`emitVoice`, separate RNG stream, cooldown/round/once/win-lose rules, `BattleState.voice`)
- [x] ITEM 3: Battle hooks in `src/engine/combat.ts`, supply use & battle end
- [x] ITEM 4: `voice` log category & `${unitName}: "${line}"` formatter/renderer
- [x] TESTS & CHECKS: `<= 4` tests, related tests + `tsc --noEmit`, `CODEMAP.md`, `CHAT-1a.report.md`
