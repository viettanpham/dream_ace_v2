# TASK FM1 — Support/Repair Units in Front Lane Investigation & Fix Report

## 1. Counts Per Size (500 Seeds Each via `createInitialBattleState`)

Measured over seeds `1..500` on `debris_belt` for enemy squad sizes `4`, `6`, and `8` (`DEFAULT_FORMATION_CONFIG`: `front: 3`, `middle: 3`, `back: 2`):

### Before Fix
| Size | Seeds | Support Units | (a) Support in `front` | (b) `front` w/ `middle` or `back` Free | (c) Siege in `front` |
| :-: | --: | --: | --: | --: | --: |
| 4 | 500 | 500 | **0** | 0 | 0 |
| 6 | 500 | 500 | **6** | 0 | 0 |
| 8 | 500 | 1000 | **276** | 0 | 0 |

### After Fix
| Size | Seeds | Support Units | (a) Support in `front` | (b) `front` w/ `middle` or `back` Free | (c) Siege in `front` | Distinct Enemy Patterns |
| :-: | --: | --: | --: | --: | --: | --: |
| 4 | 500 | 500 | **0** | 0 | 0 | 15 |
| 6 | 500 | 500 | **0** | 0 | 0 | 34 |
| 8 | 500 | 1000 | **0** | 0 | 0 | 24 |

*(Additional regression check across 50 seeds with tight `middle: 2, back: 1` capacities confirms `support` only overflows to `front` when `middle + back` are completely full; deterministic output per RNG seed and customized ally `formationCustomized = true` rows are preserved.)*

---

## 2. Root Cause (Function & Line Citations)
- **Caller**: `createInitialBattleState()` (`src/engine/combat.ts:735-739`) spawns enemies with `autoPlaceFormation(rawEnemyUnits, formationConfig, { rng, randomVariation: 0.25 })`, using `archetypeRosterBySize` (`src/engine/combat.ts:666-679`).
- **Root cause 1 — No slot reservation in `autoPlaceFormation()` (`src/engine/formation.ts:357-393`)**: Units are sorted strictly by `placementPriority` (`1`: `striker`/`siege`, `2`: `interceptor`/`support`) then index (`368-374`), and placed sequentially via `pickRowForClass()` (`376-385`) without counting remaining unplaced `support`/`siege` units that need `middle`/`back` capacity.
- **Root cause 2 — Unconstrained swap / flex consumption of `middle` in `pickRowForClass()` (`src/engine/formation.ts:304-346`)**:
  - Under `randomVariation: 0.25`, strict `striker` (`sniper`, lines `325-334`) has a 25% chance to swap `front` <-> `middle`.
  - Flex `interceptor` (`drone`, lines `319-324`), appearing earlier in `archetypeRosterBySize[6]` and `[8]` than `support` (`repair_ship`), has a 50% chance to pick `middle` before `front`.
  - When `back` (cap `2`) fills with `siege` (`gunship`) and `middle` (cap `3`) fills with swapped `striker`/`siege` + `interceptor` units while `front` still had free capacity, all 5 `middle+back` slots are exhausted before `support` (`repair_ship`) is placed, forcing `support` into `front` (6/500 in size 6; 276/1000 in size 8).

---

## 3. Minimal Fix Applied
- `src/engine/formation.ts`:
  - `autoPlaceFormation()` counts remaining unplaced `support` and `siege` units (`remainingMidBackNeeders`) and passes `reservedMidBackSlots` to `pickRowForClass()`.
  - `pickRowForClass()` computes `freeMidBack` and sets `reserveBlocksMidBack` when `reservedMidBackSlots > 0`, `pref.preferred[0] === 'front'` (`striker`/`interceptor`), and `freeMidBack <= reservedMidBackSlots`. While an unreserved row (`front`) has capacity, `middle`/`back` slots needed by remaining `support`/`siege` units are skipped (falling back to any row with capacity only if `front` is already full).

---

## 4. Files Changed
- `src/engine/formation.ts` — reserve `middle`/`back` capacity for remaining `support`/`siege` units in `autoPlaceFormation()` and `pickRowForClass()`.
- `src/engine/__tests__/formationLanes.test.ts` — new FM1 measurement and regression test suite (sizes 4/6/8 x 500 seeds, overflow-only-when-full, RNG determinism, and `formationCustomized = true` preservation).
- `docs/CODEMAP.md` — added entry for `formation.test.ts` and `formationLanes.test.ts`.
- `docs/tasks/FM1.md`, `docs/tasks/FM1.progress.md`, `docs/tasks/FM1.report.md` — task prompt, checklist, and report.

---

## 5. Checks & Test Results
- **Tests (old -> new)**: `287 passed` (39 files) -> **`289 passed`** (40 files, `npx vitest run`).
- **TypeScript / Lint**: `npx tsc --noEmit` / `npm run lint` passed (0 errors).
- **Production Build**: `npm run build` / `compile_applet` succeeded (`✓ built in 2.19s`).

---

## 6. Not Checked in a Real Browser
- Interactive browser launch of `BattleScreen` / `BattleRadarView` / `FormationEditor` was not executed; verification covers engine/store unit tests, TypeScript check, and Vite production build only.
