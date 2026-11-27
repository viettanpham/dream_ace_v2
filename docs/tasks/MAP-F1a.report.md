# TASK MAP-F1a Report — Frontline rule engine ("căn cứ giao tranh") + Admin test switch

## Items Done
- **STEP A**: Saved prompt verbatim to `docs/tasks/MAP-F1a.md`, created and maintained `docs/tasks/MAP-F1a.progress.md`.
- **ITEM 1 — Pure frontline engine (`src/engine/frontline.ts`)**:
  - `neighbours(id)` resolves symmetric bidirectional adjacencies from `MAP_LANES`.
  - `isContested(pilot, id)` returns `true` when `faction` is `'hostile'` or `'neutral'` and at least one neighbour is `'allied'` (any operational/damaged/repairing status).
  - `isAlliedFrontline(pilot, id)` returns `true` when `faction === 'allied'` and at least one neighbour is `'hostile'` or `'neutral'`.
  - `isVisible(pilot, id)` returns `true` when `faction === 'allied'`, adjacent to an allied node, or listed in `pilot.unlockedSectorIds`.
  - `visibleNodeIds(pilot)` returns visible sector IDs; `noEnemyLeft(pilot)` returns `true` when no hostile/neutral node remains on the map.
  - `getBattleOptions(pilot, id, adminConfig)` returns `{ kind: 'assault' | 'defend' | 'patrol', allowed: boolean, reasonKey?: string }[]` supporting `map.reason.hidden`, `map.reason.notFrontline`, `map.reason.rearBase`, plus `adminConfig.ignoreFrontline` (allowing `assault`/`patrol` on any visible node while keeping hidden nodes blocked).
  - `pickDefaultBattle(options)` selects the highest-priority allowed option (`defend > assault > patrol`, or `null` if none allowed).
  - Added `ignoreFrontline?: boolean` to `AdminConfig` (`src/types/game.ts`), defaulted to `false` in `createDefaultAdminConfig()` and strictly sanitized as a boolean (default `false`) in `migrateSaveData()` (`src/engine/migration.ts`). Added `map.reason.*` and `admin.campaignIgnoreFrontline` to `src/i18n/vi.ts` and `src/i18n/en.ts`.
- **ITEM 2 — Admin test switch**:
  - Added `"Bỏ qua luật tiền tuyến (test)"` / `"Ignore frontline rule (test)"` checkbox (`data-testid="admin-ignore-frontline"`) next to the Campaign bases/sectors admin section in `src/components/AdminPanel.tsx`, storing in `adminConfig.ignoreFrontline`.

## `getBattleOptions` Table per Node

### Fresh Save (`createFreshCampaignState`, `ignoreFrontline: false`)
| Sector ID | Faction | Visible | Contested | Allied Frontline | Default Battle | `getBattleOptions` |
| --- | --- | --- | --- | --- | --- | --- |
| `border_outpost` | `hostile` | `true` | `true` | `false` | `assault` | `[{ kind: 'assault', allowed: true }]` |
| `debris_belt` | `hostile` | `false` | `false` | `false` | `null` | `[{ kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' }]` |
| `iron_citadel` | `hostile` | `false` | `false` | `false` | `null` | `[{ kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' }]` |
| `aegis_relay` | `allied` (`underAttack`) | `true` | `false` | `true` | `defend` | `[{ kind: 'defend', allowed: true }, { kind: 'patrol', allowed: true }]` |
| `veridian_colony` | `neutral` | `true` | `true` | `false` | `assault` | `[{ kind: 'assault', allowed: true }]` |
| `vanguard_shipyard` | `hostile` | `false` | `false` | `false` | `null` | `[{ kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' }]` |

### After Capturing `border_outpost` (`border_outpost.faction = 'allied'`, raid cleared, `ignoreFrontline: false`)
| Sector ID | Faction | Visible | Contested | Allied Frontline | Default Battle | `getBattleOptions` |
| --- | --- | --- | --- | --- | --- | --- |
| `border_outpost` | `allied` | `true` | `false` | `true` | `patrol` | `[{ kind: 'patrol', allowed: true }]` |
| `debris_belt` | `hostile` | `true` | `true` | `false` | `assault` | `[{ kind: 'assault', allowed: true }]` |
| `iron_citadel` | `hostile` | `false` | `false` | `false` | `null` | `[{ kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' }]` |
| `aegis_relay` | `allied` | `true` | `false` | `true` | `patrol` | `[{ kind: 'patrol', allowed: true }]` |
| `veridian_colony` | `neutral` | `true` | `true` | `false` | `assault` | `[{ kind: 'assault', allowed: true }]` |
| `vanguard_shipyard` | `hostile` | `false` | `false` | `false` | `null` | `[{ kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' }]` |

## Files Changed
- `docs/tasks/MAP-F1a.md` (new)
- `docs/tasks/MAP-F1a.progress.md` (new)
- `docs/tasks/MAP-F1a.report.md` (new)
- `docs/CODEMAP.md` (updated)
- `src/engine/frontline.ts` (new)
- `src/types/game.ts` (`AdminConfig.ignoreFrontline`)
- `src/engine/migration.ts` (`createDefaultAdminConfig` + `migrateSaveData` sanitizer for `ignoreFrontline`)
- `src/components/AdminPanel.tsx` (`admin-ignore-frontline` checkbox in Campaign tab)
- `src/i18n/vi.ts` (`map.reason.*`, `admin.campaignIgnoreFrontline`)
- `src/i18n/en.ts` (`map.reason.*`, `admin.campaignIgnoreFrontline`)
- `src/engine/__tests__/frontline.test.ts` (new, 7 tests)

## Checks & Tests
- **Related Vitest suite**: `npx vitest run src/engine/__tests__/frontline.test.ts src/engine/__tests__/saveV10Migration.test.ts src/engine/__tests__/shieldRegen.test.ts src/components/__tests__/mapM1.test.tsx` — **4 test files, 23 passed (0 failed)**.
- **Test count**: `379 -> 386` (`+7` tests in `src/engine/__tests__/frontline.test.ts`; full `vitest` and production build deferred to MAP-F1b per instructions).
- **TypeScript / Lint (`lint_applet` / `tsc --noEmit`)**: **Passed** (exit code 0).
- **Invariants**: `CURRENT_SAVE_VERSION` unchanged (`10`), store/map/battle/loop behavior unchanged (nothing outside tests/table script calls `frontline.ts` yet), Firebase untouched.
