# TASK G4b — Report

## Items Done
- **ITEM 1 — FX tone**:
  - Added `CombatFxTone = 'heal' | 'shield' | 'sp' | 'buff'` and optional `tone?: CombatFxTone` on `CombatFxEvent` (`src/types/game.ts`), keeping `kind: 'heal'` intact.
  - Set `tone` in every support `effectKind` case of `src/engine/combat.ts` (all 8 `fxEvent` return sites).
  - Created pure helper `src/utils/fxTone.ts` with `FX_TONE_COLORS`, `DAMAGE_TEAM_ACCENTS`, `resolveFxTone(fx)`, and `resolveFxToneColor(fx)`.
- **ITEM 2 — Radar buff projectile**:
  - Updated the `isHealFx` branch in `src/components/BattleVfxOverlay.tsx` and added keyframes/classes in `src/index.css`:
    - Fires a non-damaging projectile (`vfx-cannon-fly`, or `vfx-reduced-marker` under `reducedMotion`) tinted with `FX_TONE_COLORS[tone]` before the arrival ring.
    - Arrival ring (`vfx-ring-expand`) and short caster glow ring (~400ms, `.vfx-caster-glow`, once per `fx`) use the same tone color.
    - `buff` tone renders 3 small rising `"▲"` carets (`.vfx-buff-caret`, static fade under reduced motion) inside the ring.
    - AoE sends projectiles to max 3 non-self targets while rendering rings on all targets; self-cast renders ring (+ caster glow) only; `battleSpeed >= 5` or `showProjectiles: false` renders rings only; `animationsSkipped` renders nothing; damage FX unchanged.
- **ITEM 3 — Card floating numbers inside the card**:
  - Added `@keyframes float-popup-in` / `@keyframes float-popup-tight-in` and `.anim-popup-in` / `.anim-popup-tight-in` / `.anim-popup-reduced` in `src/index.css` (starting at `top: 18px` below the name row and drifting down `12px` while fading).
  - Updated `src/components/BattleUnitCard.tsx` popups: max 3 newest (`popups.slice(-3)`), positioned at `top: 18px` and spread horizontally at `left: 30%` / `50%` / `70%` with `truncate` and capped widths inside `overflow-hidden`. Reduced motion uses `anim-popup-reduced` (fade only, no movement class). Radar floating labels in `BattleRadarView.tsx` untouched.
- **ITEM 4 — Tests, CODEMAP & Checks**:
  - Added `src/components/__tests__/g4bSupportFx.test.tsx` (7 tests) and updated `docs/CODEMAP.md`.
  - Ran `npx vitest run` (51/51 files, `327/327` tests passing), `lint_applet` (`tsc --noEmit`, 0 errors), and `compile_applet` (Vite build succeeded).

## Support Case -> FX Tone Mapping (`src/engine/combat.ts`)
| `skill.effectKind` | Example Skill ID | `fxEvent.kind` | `fxEvent.tone` | `FX_TONE_COLORS` |
| --- | --- | --- | --- | --- |
| `heal_single` | `sup_nanite_mend` | `'heal'` | `'heal'` | `#22c55e` |
| `energize_single` | `sup_flux_transfer` | `'heal'` | `'sp'` | `#f59e0b` |
| `heal_field_hot` | `sup_regen_grid` | `'heal'` | `'heal'` | `#22c55e` |
| `energize_shield_field` | `sup_aegis_field` | `'heal'` | `'shield'` | `#38bdf8` |
| `team_atk_up` / `team_def_up` / `team_eva_up` | `sup_war_hymn`, `sup_iron_canopy`, `sup_slipstream_link` | `'heal'` | `'buff'` | `#facc15` |
| `invincible_ally` | `sup_stasis_shell` | `'heal'` | `'buff'` | `#facc15` |
| `purify_team` | `sup_system_purge` | `'heal'` | `'buff'` | `#facc15` |
| `full_recovery_elite` | `sup_genesis_wave` | `'heal'` | `'heal'` | `#22c55e` |

## Files Changed
- `src/types/game.ts`
- `src/utils/fxTone.ts` (new)
- `src/engine/combat.ts`
- `src/components/BattleVfxOverlay.tsx`
- `src/components/BattleUnitCard.tsx`
- `src/index.css`
- `src/components/__tests__/g4bSupportFx.test.tsx` (new)
- `docs/CODEMAP.md`
- `docs/tasks/G4b.md`
- `docs/tasks/G4b.progress.md`
- `docs/tasks/G4b.report.md`

## Tests
- Old baseline: **320** tests (50 files)
- New total: **327** tests (51 files, +7 in `src/components/__tests__/g4bSupportFx.test.tsx`, 0 failures)
- Checks: `npx vitest run` pass (51/51 files, 327/327 tests), `tsc --noEmit` (`lint_applet`) pass (0 errors), `compile_applet` build succeeded.

## NOT Checked in a Real Browser
- Projectile look per tone (`heal`, `shield`, `sp`, `buff`) and buff `"▲"` legibility inside radar rings
- Popup readability and visual clearance inside real rendered 54px cards
- Live visual pacing at 10x–30x playback speeds
