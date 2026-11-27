# TASK SH2b Report

## Items Done
- **ITEM 1 (Multiplier + Khiên nứt engine)**: Updated `applyShieldThenHull()` and `applyDamageToUnit()` with skill-only shield damage multiplier `m = max(attackerMult, shieldCrackedMult)` (clamped `1..4`, basic/basic-splash/counter stay `m = 1`) and x1 leftover HP spill (`D - S/m`), `damageDealt = shieldLost + hullDamage`, ` (x{m} khiên)` log suffix, removal of `shield_cracked` + `shield_break` application when shield reaches `0`, shared `applyShieldCracked()` helper (no-op + `"Không có khiên để làm nứt"` when shield is `0` or `shield_break` active), and optional `AdminConfig` fields (`shieldCrackedMult`, `shieldCrackedTurns`, `shieldDamageOverrides`) with `CURRENT_SAVE_VERSION` unchanged (`11`).
- **ITEM 2 (Data + icon + text + Admin CP)**: Updated `sge_aegis_sunder` (`powerMultiplier: 1.0`, `shieldDamageMult: 1.5`, applies `shield_cracked`), `gunship` (`inflictsStatus: 'shield_cracked'`), and `sge_starbreaker_lance` (`ignoreDef: true`, shield absorbs first); added `DB12` (`shield_question`, 99th row) in `iconCatalog.json` and mapped `shield_cracked -> 'DB12'`; updated `CatalogIcon.tsx`, `StatusChip.tsx`, bilingual `vi.ts`/`en.ts`/`i18n/index.ts` strings, and added the 3 Shield inputs in `AdminPanel.tsx`.

## Files Changed
- Engine & types: `src/types/game.ts`, `src/engine/shieldRegen.ts`, `src/engine/migration.ts`, `src/engine/combat.ts`
- Data, UI & i18n: `src/data/skills.ts`, `src/data/pilots.ts`, `src/data/iconCatalog.json`, `src/data/statusIconMap.ts`, `src/components/CatalogIcon.tsx`, `src/components/StatusChip.tsx`, `src/components/AdminPanel.tsx`, `src/i18n/index.ts`, `src/i18n/vi.ts`, `src/i18n/en.ts`
- Tests & docs: `src/engine/__tests__/sh2bShieldMult.test.ts` (new, 5 tests), `src/engine/__tests__/shieldRegen.test.ts`, `src/data/__tests__/iconCatalog.test.ts`, `src/components/__tests__/statusChipsG4a1.test.tsx`, `docs/CODEMAP.md`, `docs/tasks/SH2b.md`, `docs/tasks/SH2b.progress.md`, `docs/tasks/SH2b.report.md`

## Sample Target Comparison (Shield 300, HP 800)
- **Aegis Sunder** (suppose 100% skill raw damage = `400`): Before (`0.8x`, `m=1`, dmg `320`) -> Shield `300 -> 0 (-300)`, HP `800 -> 780 (-20)` + `shield_break`. After (`1.0x`, `m=1.5`, `300/1.5 = 200` real dmg absorbed) -> Shield `300 -> 0 (-300)`, HP `800 -> 600 (-200)` + `shield_break`; if shield survives (e.g. dmg `150` -> `-225` shield, `0` HP), applies `shield_cracked` (2t) instead of `shield_break`.
- **Gunship** (basic attack): Before -> `24.75%` chance (`0.45 * 0.55`) to inflict `shield_break` (2t, even at 0 shield). After -> same `24.75%` chance via `applyShieldCracked()` inflicts `shield_cracked` (`x1.3` skill dmg to shield for 2t; no-op at 0 shield or active `shield_break`).
- **Starbreaker Lance** (suppose `ignoreDef` raw damage = `600`): Before (`ignoreDefAndShield`) -> bypassed shield, Shield `300 -> 300 (0)`, HP `800 -> 200 (-600)`. After (`ignoreDef`) -> ignores DEF only, shield absorbs first: Shield `300 -> 0 (-300)`, HP `800 -> 500 (-300)` (+ `shield_break`).

## Verification
`npx vitest run src/engine/__tests__/shieldRegen.test.ts src/engine/__tests__/sh2bShieldMult.test.ts src/data/__tests__/iconCatalog.test.ts src/components/__tests__/statusChipsG4a1.test.tsx --reporter=dot` passed (4 files, 30 tests passed), and `npx tsc --noEmit` passed with 0 errors.

## Not Checked
- Real browser rendering/UI interaction, production build (`npm run build`), and the remaining full vitest suite (not run per task scope).
