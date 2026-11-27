# TASK SH1 — Completion Report

## 1. Items Done
- **ITEM 1 — Engine**:
  - Added optional `adminConfig.shieldRegen` (`ShieldRegenConfig`) with defaults `{ enabled: true, basePct: 3, perPointPct: 0.08, capPct: 12, notHitMult: 100, hitMult: 75, brokenMult: 30, brokenTurns: 3 }`.
  - Created pure `src/engine/shieldRegen.ts` exporting `DEFAULT_SHIELD_REGEN_CONFIG`, `sanitizeShieldRegenConfig` (clamps `pct` to `0..50`, `mult` to `0..200`, `turns` to `1..10`), `computeShieldRegenPct`, and `computeShieldRegen(unit, cfg)` returning `{ amount, multPct, reason }`.
  - Added `'shield_cracked'` to `StatusEffectType` and `DEBUFF_TYPES`, and `hitSinceOwnTurn?: boolean` to `CombatUnit`.
  - Wired start-of-turn shield regeneration into `resolveUnitActionCore` (right after `spRegenPerTurn`, before status ticks) and reset `hitSinceOwnTurn = false`.
  - Wired `applyDamageToUnit` to set `targetAfter.hitSinceOwnTurn = true` when `shieldAbsorbed > 0 || hullDamage > 0` (leaving evade and burn DoT untouched) and apply/refresh `'shield_cracked'` for `brokenTurns` own turns when a surviving hit reduces shield from `> 0` to `0`.
  - Preserved exact pre-SH1 behavior when `shieldRegen.enabled` is `false` and kept `CURRENT_SAVE_VERSION = 9`.
- **ITEM 2 — UI, Status Chip, Combat Log & Admin Controls**:
  - Added `'shield_cracked'` status chip (`"Khiên nứt"` / `"Cracked shield"`, debuff frame, value `"30%"`, Lucide `ShieldOff` fallback via `UNMAPPED_STATUS_ALLOWLIST`, tooltip `"Hồi khiên chỉ 30% trong 3 lượt"`).
  - Added `log.shieldRegen` (`tag: 'SHIELD'`) combat log line (`"<name> hồi khiên SHD +N"` with `" (bị trúng, 75%)"` / `" (khiên nứt, 30%)"` suffixes) and small `"SHD +N"` shield popup gated on `amount >= 1%` of `maxShield`.
  - Added Admin CP **"Hồi khiên"** (`"Shield Regen"`) section with controls for all 8 fields and dynamic live example line (`"SHIELD 25 -> 5% khiên tối đa mỗi lượt"`).
  - Added bilingual strings to both `src/i18n/vi.ts` and `src/i18n/en.ts`.
- **ITEM 3 — Class Shield Regen Table** (computed from default stats / 0 allocated points):

| Class | Level | SHIELD Stat | Max Shield | Regen % | Not Hit (100%) | Hit (75%) | Cracked (30%) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Striker (`striker`) | Lv1 | 11 | 121 | 3.88% | +5 | +4 | +2 |
| Striker (`striker`) | Lv10 | 20 | 247 | 4.60% | +11 | +8 | +3 |
| Striker (`striker`) | Lv20 | 30 | 387 | 5.40% | +21 | +16 | +6 |
| Interceptor (`interceptor`) | Lv1 | 9 | 96 | 3.72% | +4 | +3 | +1 |
| Interceptor (`interceptor`) | Lv10 | 15 | 204 | 4.20% | +9 | +7 | +3 |
| Interceptor (`interceptor`) | Lv20 | 22 | 326 | 4.76% | +16 | +12 | +5 |
| Siege (`siege`) | Lv1 | 16 | 176 | 4.28% | +8 | +6 | +2 |
| Siege (`siege`) | Lv10 | 28 | 320 | 5.24% | +17 | +13 | +5 |
| Siege (`siege`) | Lv20 | 42 | 484 | 6.36% | +31 | +23 | +9 |
| Support (`support`) | Lv1 | 15 | 175 | 4.20% | +7 | +5 | +2 |
| Support (`support`) | Lv10 | 24 | 301 | 4.92% | +15 | +11 | +5 |
| Support (`support`) | Lv20 | 34 | 441 | 5.72% | +25 | +19 | +8 |

## 2. Files Changed
- `src/types/game.ts` — added `ShieldRegenConfig`, `AdminConfig.shieldRegen`, `CombatUnit.hitSinceOwnTurn`, `'shield_cracked'`, and `'log.shieldRegen'`
- `src/engine/shieldRegen.ts` (new) — `DEFAULT_SHIELD_REGEN_CONFIG`, `sanitizeShieldRegenConfig`, `computeShieldRegenPct`, `computeShieldRegen`
- `src/engine/migration.ts` — added `shieldRegen` default and sanitizer (no `CURRENT_SAVE_VERSION` bump)
- `src/engine/combat.ts` — wired start-of-turn shield regen, `hitSinceOwnTurn` tracking/reset, `'shield_cracked'` infliction, `'SHIELD'` log entry, and `>= 1%` popup threshold
- `src/data/statusIconMap.ts` — added `'shield_cracked'` to `STATUS_TO_CATALOG_ID` (`null`), `UNMAPPED_STATUS_ALLOWLIST`, `ALL_ENGINE_STATUS_TYPES`, debuff kind fallback, and `"30%"` short chip value
- `src/components/CatalogIcon.tsx` — added Lucide `ShieldOff` fallback for `'shield_cracked'`
- `src/utils/battleDisplay.ts` — added `'shield_cracked'` to `DEFAULT_DEBUFF_TYPES` and `getStatusIconMeta`
- `src/utils/combatLogFormat.ts` — added `'shield_cracked'` debuff set and `log.shieldRegen` structured row formatting
- `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/i18n/index.ts` — added bilingual labels/descriptions/log templates/admin labels and status detail formatter
- `src/components/AdminPanel.tsx` — added **"Hồi khiên"** balance controls and live `"SHIELD 25 -> 5% khiên tối đa mỗi lượt"` example
- `src/components/__tests__/statusChipsG4a1.test.tsx` — updated engine status count expectation from `21` to `22`
- `src/engine/__tests__/engine.test.ts` — passed `shieldRegen.enabled = false` for the pre-SH1 Snap-Turn Riposte `hp < 500` assertion so regenerated enemy shield cannot absorb low-level counter damage
- `src/engine/__tests__/shieldRegen.test.ts` (new) — 8 tests covering formula cases, hit/evade/burn/reset, `'shield_cracked'` turns & refresh, `enabled = false` fixed-seed determinism, popup threshold, sanitizer clamping, vi/en parity, `StatusChip`, `AdminPanel`, and a full seeded 4v4 no-`NaN` battle
- `docs/CODEMAP.md`, `docs/tasks/SH1.md`, `docs/tasks/SH1.progress.md`, `docs/tasks/SH1.report.md`

## 3. Verification & Test Counts
- **Tests**: `352` (54 files) -> **`360` passed across `55` files** (`npx vitest run`: `55 passed (55)`, `360 passed (360)`).
- **TypeScript / Lint (`tsc --noEmit` / `lint_applet`)**: passed with zero errors.
- **Production Build (`compile_applet` / `npm run build`)**: succeeded cleanly.
- **Browser check**: **NOT checked in a real browser** (log spam at 10x+, chip look).
