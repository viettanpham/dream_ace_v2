# TASK SH2a — Final Report

## Items Completed
- **ITEM 1 — Regen per hit**:
  - Updated `ShieldRegenConfig` (`hitPenaltyPct: 20`, `minHitMultPct: 0`, `restartTurns: 1`), `sanitizeShieldRegenConfig()` (drops legacy `hitMult` / `brokenMult` / `brokenTurns`), `CombatUnit.hitsSinceOwnTurn`, `getUnitHitsSinceOwnTurn()` (reads legacy `hitSinceOwnTurn: true` as `1`), and `computeShieldRegen()` (`'restarting'` / `'not_hit'` / `'hit'`, `hits`, `minHitMultPct` floor).
  - Increments `hitsSinceOwnTurn` `+1` per enemy damage instance removing shield or HP (main, multi-hit, splash, counter; excludes evade, 0 damage, DoT ticks, self-damage), resets to `0` after own-turn regen, formats `" (trúng {hits} lần, {multPct}%)"`, and omits log when amount is `0`.
- **ITEM 2 — Khiên vỡ + Shared Shield-Damage Helper**:
  - Added `applyShieldThenHull(target, damage, opts)` in `src/engine/combat.ts` and routed both `applyDamageToUnit()` and the splash block through it.
  - Removed `hasStatus(..., 'shield_break')` from shield-disable checks (shield always absorbs first unless `ignoreDefAndShield`).
  - Dropping shield from `> 0` to `0` applies/refreshes `shield_break` for `restartTurns` own turns (with `status_applied` event when `shieldRegen.enabled`), stops auto-adding `shield_cracked` (keeping `shield_cracked` type/chip/i18n intact), and blocks shield recovery from regen, defend, and skills while active.
- **ITEM 3 — Text & Admin CP**:
  - Updated `shield_break` strings (`"Khiên vỡ"` / `"Shield down"`, short `"KhiênVỡ"` / `"ShdDown"`, valueText `"Khởi động lại {n} lượt"` / `"Restarting {n} turn(s)"`, tooltip) and Admin CP Hồi khiên inputs (`"Giảm mỗi lần trúng (%)"`, `"Hồi tối thiểu khi bị trúng (%)"`, `"Số lượt khiên vỡ"`, example with `"Trúng 2 lần -> hồi {hit2Pct}%"`) across `src/i18n/vi.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`, and `src/components/AdminPanel.tsx`.
- **ITEM 4 — Focused Tests, Checks & Docs (SLIM OVERRIDE)**:
  - Updated 6 existing SH1 tests in `src/engine/__tests__/shieldRegen.test.ts` for SH2a expectations and added 4 focused SH2a tests (9–12).
  - Updated `docs/CODEMAP.md` and `docs/tasks/SH2a.progress.md`.

## Files Changed
- `src/types/game.ts`
- `src/engine/shieldRegen.ts`
- `src/engine/combat.ts`
- `src/i18n/index.ts`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/components/AdminPanel.tsx`
- `src/engine/__tests__/shieldRegen.test.ts` (updated + 4 new SH2a tests)
- `docs/CODEMAP.md`
- `docs/tasks/SH2a.progress.md`
- `docs/tasks/SH2a.report.md`

## Regen Table per Class (Lv1 / Lv10 / Lv20 — 0 allocated/equip points, `DEFAULT_SHIELD_REGEN_CONFIG`)

| Class | Level | SHIELD | maxShield | 0 hits (100%) | 1 hit (80%) | 2 hits (60%) | 3 hits (40%) | 5 hits (0%) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Striker | Lv1 | 11 | 121 | 5 | 4 | 3 | 2 | 0 |
| Striker | Lv10 | 20 | 247 | 11 | 9 | 7 | 4 | 0 |
| Striker | Lv20 | 30 | 387 | 21 | 17 | 13 | 8 | 0 |
| Interceptor | Lv1 | 9 | 96 | 4 | 3 | 2 | 2 | 0 |
| Interceptor | Lv10 | 15 | 204 | 9 | 7 | 5 | 4 | 0 |
| Interceptor | Lv20 | 22 | 326 | 16 | 13 | 10 | 6 | 0 |
| Siege | Lv1 | 16 | 176 | 8 | 6 | 5 | 3 | 0 |
| Siege | Lv10 | 28 | 320 | 17 | 14 | 10 | 7 | 0 |
| Siege | Lv20 | 42 | 484 | 31 | 25 | 19 | 12 | 0 |
| Support | Lv1 | 15 | 175 | 7 | 6 | 4 | 3 | 0 |
| Support | Lv10 | 24 | 301 | 15 | 12 | 9 | 6 | 0 |
| Support | Lv20 | 34 | 441 | 25 | 20 | 15 | 10 | 0 |

## Existing Tests Updated & Why (`src/engine/__tests__/shieldRegen.test.ts`)
- **Test 1**: `computeShieldRegen()` now returns `hits` and uses `hitPenaltyPct: 20` (`80%` on 1 hit -> `8`) and `'restarting'` (`0` on `shield_break`), instead of SH1 `'cracked'`/`'blocked'` and `75%`/`30%`.
- **Test 2**: `CombatUnit.hitSinceOwnTurn` (boolean) was replaced by `hitsSinceOwnTurn` (number), and the log suffix changed from ` (bị trúng, 75%)` to ` (trúng 1 lần, 80%)`.
- **Test 3**: Dropping shield `> 0 -> 0` now applies `shield_break` (`1` turn) instead of auto-applying `shield_cracked` (`3` turns), blocking regen to `0` on the next own turn until expiry.
- **Test 4**: Renamed `hitSinceOwnTurn` field reference to `hitsSinceOwnTurn` to match `CombatUnit`.
- **Test 6**: Updated `sanitizeShieldRegenConfig()` test to pass/assert `hitPenaltyPct`, `minHitMultPct`, `restartTurns` (1–3) and verify legacy v1 keys are dropped.
- **Test 7**: Updated AdminPanel live example assertion to match the new suffix ` · Trúng 2 lần -> hồi 3%`.

## Verification
`src/engine/__tests__/shieldRegen.test.ts`: 12/12 passed (`--reporter=dot`); `tsc --noEmit`: 0 errors; **full vitest + build NOT run**.
