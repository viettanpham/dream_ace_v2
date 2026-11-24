# TASK CS1 — Final Report

## 1. Items Completed
- **STEP A**: Saved prompt verbatim to `docs/tasks/CS1.md` and tracked checklist in `docs/tasks/CS1.progress.md`.
- **ITEM 1 (Data + Price Formula)**:
  - Created `src/data/consumables.json` (`schemaVersion: 1`, 12 `"sys"` templates: `hp_kit` / `shield_kit` / `sp_kit` across Tiers 1–4, `unlockLevel` 1 / 10 / 20 / 35, `cooldownTurns: 2`, `perBattleLimit: 3`, valid `iconCatalog.json` icons `SS01` / `BS05` / `SS02`).
  - Created `src/data/consumables.ts` with `validateSupplyTemplate()`, `validateSupplyTemplates()` (drops invalid/duplicate rows with `console.warn`, never crashes), `SUPPLY_TEMPLATES`, `SUPPLY_TEMPLATES_BY_ID`, and `getSupplyTemplateById()`.
  - Updated `src/data/itemPricing.json` and `src/data/itemPricing.ts` with `consumableBase: { hp_kit: 30, shield_kit: 30, sp_kit: 36, buff: 60 }` (validated with safe fallbacks).
  - Added `computeSupplyPrice(template)` in `src/engine/itemPrice.ts` (`priceOverride` wins if valid positive integer, otherwise `max(minPrice, round(base * tierFactor[tier - 1]))`).
  - Added supply template display names and battle supply reason strings to `src/i18n/vi.ts` and `src/i18n/en.ts` with full key parity.
- **ITEM 2 (Save Fields + Pure Rules)**:
  - Extended `src/types/game.ts`: `ConsumableKind` adds `'battle_supply'`, `ConsumableItem.templateId?: string`, `GearUnit.supplyLoadout: string[]`, `AdminConfig.supplyLoadoutSlots?: number` and `AdminConfig.supplyUsesPerTurn?: number`, plus `SupplyFamily`, `SupplyEffectKind`, `SupplyEffect`, `SupplyTemplate`, and `BattleSupplyUnitState`.
  - Bumped `CURRENT_SAVE_VERSION` **`10 -> 11`** in `src/engine/migration.ts`: old saves (`<= 10`) initialize `gear.supplyLoadout: []`, merge `battle_supply` stacks by `templateId` capped at `99`, drop unknown `templateId`s, deduplicate `supplyLoadout`, trim to `adminConfig.supplyLoadoutSlots`, and default/clamp `supplyLoadoutSlots` (default `4`, clamp `2–8`) & `supplyUsesPerTurn` (default `1`, clamp `1–3`).
  - Created pure `src/engine/supplies.ts`: `SUPPLY_STACK_CAP = 99`, `sanitizeConsumables()`, `addSupplyToConsumables()`, `sanitizeSupplyLoadout()`, `setSupplyLoadout()` (returns `{ gear, rejected }` with reasons `unknown` / `duplicate` / `over_slots`), and `canUseSupply()` (covers all 9 reasons: `not_your_turn`, `no_stock`, `turn_limit`, `battle_limit`, `cooldown`, `shield_broken`, `hp_full`, `shield_full`, `sp_full`).
  - Created pure `src/engine/supplyEffects.ts`: `applySupplyEffects(unit, effects)` (pure percentage HP/Shield/SP restoration clamped to max, shield gives `0` while `shield_break` is active).
  - Added base-only `setSupplyLoadout(gearId, ids)` store wrapper in `src/store/useGameStore.ts` guarded by `isBattleActive(state) || Boolean(state.autoRepeatSession?.active)`, and handled `'battle_supply'` in `src/components/GameIcons.tsx` (`ConsumableIcon`).

## 2. Save Version
- `CURRENT_SAVE_VERSION`: **`10 -> 11`** (strictly `+1`, with backward-compatible v10/older save migration and SV1a v11 export/import round-trip).

## 3. Files Changed
### Created
- `docs/tasks/CS1.md`
- `docs/tasks/CS1.progress.md`
- `docs/tasks/CS1.report.md`
- `src/data/consumables.json`
- `src/data/consumables.ts`
- `src/engine/supplies.ts`
- `src/engine/supplyEffects.ts`
- `src/engine/__tests__/suppliesCs1.test.ts`

### Modified
- `src/types/game.ts`
- `src/data/itemPricing.json`
- `src/data/itemPricing.ts`
- `src/engine/itemPrice.ts`
- `src/engine/stats.ts`
- `src/engine/migration.ts`
- `src/store/useGameStore.ts`
- `src/components/GameIcons.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `docs/CODEMAP.md`
- Updated hardcoded `CURRENT_SAVE_VERSION` (`10 -> 11`) / `saveVersion` (`11 -> 12` refusal) assertions in 18 existing test files (`saveV10Migration.test.ts`, `itemPrice.test.ts`, `shieldRegen.test.ts`, `iconCatalog.test.ts`, `itemDataLoader.test.ts`, `statusChipsG4a1.test.tsx`, `battleTurnQueueQ1.test.tsx`, `battlePhoneP1b.test.tsx`, `battleSidebarStatusSb1.test.tsx`, `battleSidebarPanelSb2.test.tsx`, `statusChipG4aC1.test.tsx`, `battleLayoutG4aL1.test.tsx`, `battleLayoutG4a2b.test.tsx`, `statusChipC2.test.tsx`, `statusBoardG4a3b.test.tsx`, `loopDefeatSpeedLp2.test.tsx`, `battleRadarDeclutterG4a3a.test.tsx`, `combatLogG4a2d.test.tsx`) plus `PRICE_FORMULA` snapshot in `src/data/__tests__/__snapshots__/itemDataLoader.test.ts.snap` (`consumableBase` field added).

## 4. Supply Price Table (12 Rows) vs. Average Victory CR Rewards (20 Seeded Battles)

### Supply Price Table (`computeSupplyPrice`)
Formula: `max(minPrice=20, round(consumableBase[family] * tierFactor[tier - 1]))` with `tierFactor = [1, 1.74, 2.54, 3.8]`.

| ID | Name (EN / VI) | Family | Tier | Unlock Lv | Effect | Cooldown / Limit | Price (CR) |
|---|---|---|---:|---:|---|---:|---:|
| `sup_hp_t1` | Repair Kit T1 / Bộ sửa chữa T1 | `hp_kit` | 1 | 1 | +15% HP | 2t / 3 | **30** |
| `sup_hp_t2` | Repair Kit T2 / Bộ sửa chữa T2 | `hp_kit` | 2 | 10 | +22% HP | 2t / 3 | **52** |
| `sup_hp_t3` | Repair Kit T3 / Bộ sửa chữa T3 | `hp_kit` | 3 | 20 | +30% HP | 2t / 3 | **76** |
| `sup_hp_t4` | Repair Kit T4 / Bộ sửa chữa T4 | `hp_kit` | 4 | 35 | +40% HP | 2t / 3 | **114** |
| `sup_shield_t1` | Shield Cell T1 / Bộ nạp khiên T1 | `shield_kit` | 1 | 1 | +20% Shield | 2t / 3 | **30** |
| `sup_shield_t2` | Shield Cell T2 / Bộ nạp khiên T2 | `shield_kit` | 2 | 10 | +28% Shield | 2t / 3 | **52** |
| `sup_shield_t3` | Shield Cell T3 / Bộ nạp khiên T3 | `shield_kit` | 3 | 20 | +36% Shield | 2t / 3 | **76** |
| `sup_shield_t4` | Shield Cell T4 / Bộ nạp khiên T4 | `shield_kit` | 4 | 35 | +45% Shield | 2t / 3 | **114** |
| `sup_sp_t1` | SP Battery T1 / Pin SP T1 | `sp_kit` | 1 | 1 | +20% SP | 2t / 3 | **36** |
| `sup_sp_t2` | SP Battery T2 / Pin SP T2 | `sp_kit` | 2 | 10 | +28% SP | 2t / 3 | **63** |
| `sup_sp_t3` | SP Battery T3 / Pin SP T3 | `sp_kit` | 3 | 20 | +36% SP | 2t / 3 | **91** |
| `sup_sp_t4` | SP Battery T4 / Pin SP T4 | `sp_kit` | 4 | 35 | +45% SP | 2t / 3 | **137** |

### Average Victory CR Reward (20 Seeded Battles per Level)
Sampled via `createInitialBattleState` + `calculateBattleRewards(units, true, 1, sectorId, true)` across 20 deterministic seeds:

| Gear Level | Standard 4v4 (`border_outpost`) | Hard 6v6 (`debris_belt`) | Elite 8v8 (`iron_citadel`) |
|---:|---:|---:|---:|
| **Lv 1** | **320.00 CR** (~10.7× T1 kit) | **654.00 CR** | **1,609.00 CR** |
| **Lv 10** | **1,010.00 CR** (~19.4× T2 HP/Shield, ~16.0× T2 SP) | **1,723.00 CR** | **3,763.00 CR** |
| **Lv 20** | **1,815.00 CR** (~23.9× T3 HP/Shield, ~19.9× T3 SP) | **2,934.00 CR** | **6,168.00 CR** |

## 5. Verification & Test Results
- **Test count**: **`427 -> 436`** (`68` test files, all `436` tests passing via `npx vitest run --maxWorkers=4`).
- **Typecheck**: `npx tsc --noEmit` passed (`0` errors).
- **Lint & Compile & Build**: `lint_applet`, `compile_applet`, and `npm run build` (`vite build`) passed cleanly.
