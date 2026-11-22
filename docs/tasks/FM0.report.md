# TASK FM0 — Lane Placement Audit Report

## 1. Enemy Generation & Lane Assignment
| Aspect | Implementation (`file` + `function`) |
| :--- | :--- |
| Where generated | `useGameStore.startBattle()` (`src/store/useGameStore.ts`) -> `createInitialBattleState()` & `buildCombatUnit()` (`src/engine/combat.ts`) using hardcoded `archetypeRosterBySize` (4/6/8) + `ENEMY_ARCHETYPE_DEFS` (`src/data/pilots.ts`), not `hostileGarrison`. |
| How lane assigned | **Role + priority + 25% random variation**: `autoPlaceFormation(..., { rng, randomVariation: 0.25 })` (`src/engine/formation.ts`) places strict classes first (`placementPriority: 1` `striker`/`siege`) then flex (`2` `interceptor`/`support`); `pickRowForClass()` swaps top-2 preferred rows 50% (flex) or 25% (strict) before checking `rowCapacities`. |

## 2. Ally Lane Assignment, Formation UI & Save
| Aspect | Implementation (`file` + `function`) |
| :--- | :--- |
| Automatic vs Player | **Auto by default** (`formationCustomized: false`): `createDefaultSquadFormation()` & `createInitialBattleState()` run deterministic `autoPlaceFormation()` (`randomVariation: 0`); hired merc uses `pickRowForClass()`. **Player-chosen** (`formationCustomized: true`): `createInitialBattleState()` preserves `pilot.squadFormation` via `enforceFormationCapacities()`. |
| Formation UI & Save | `<FormationEditor />` (`src/components/FormationEditor.tsx`) in `GarageView.tsx` calls `moveSquadUnitRow()` / `autoArrangeSquadFormation()` (`src/store/useGameStore.ts`). Saved in `pilot.squadFormation` & `pilot.formationCustomized` inside `localStorage` `'starfront_mech_rpg_save_v1'` (+ `migration.ts`/`cloudSave.ts`). |

## 3. Role, Heal/Buff Skills & Current Lane (GEAR + Enemy Templates)
| Unit / Template | Class / Role (`classes.ts`, `pilots.ts`) | Heal / Buff Skills (`skills.ts`, `buildNpcSkillLoadout`) | Current Lane (`CLASS_FORMATION_PREFERENCES`) |
| :--- | :--- | :--- | :--- |
| GEAR `Striker` | `striker` / `Heavy Bomber` | Heal: **No** · Buff: **Yes** (self primary/skill/sure-hit) | `front` -> `middle` -> `back` (prio 1) |
| GEAR `Interceptor` | `interceptor` / `Fast Dart Fighter` | Heal: **No** · Buff: **Yes** (self EVA/SPD/berserk) | `front` / `middle` -> `back` (prio 2) |
| GEAR `Siege` | `siege` / `Heavy Gunship` | Heal: **No** · Buff: **Yes** (self Siege stances/stealth) | `back` -> `middle` -> `front` (prio 1) |
| GEAR `Support` | `support` / `Repair & Shield Craft` | Heal: **Yes** · Buff: **Yes** (team ATK/DEF/EVA/shield/SP) | `middle` / `back` -> `front` (prio 2) |
| Enemy `drone` | `interceptor` (archetype `drone`) | Heal: **No** · Buff: **Yes** (self EVA/SPD via `buildNpcSkillLoadout`) | `front` / `middle` (50% swap) |
| Enemy `gunship` (+Boss/Turret) | `siege` (archetype `gunship`) | Heal: **No** · Buff: **Yes** (`gen_hull_brace`/stances) | `back` (25% swap `middle`) |
| Enemy `sniper` | `striker` (archetype `sniper`) | Heal: **No** · Buff: **Yes** (`str_hotload_shells`/self) | `front` (25% swap `middle`) |
| Enemy `repair_ship` | `support` (archetype `repair_ship`) | Heal: **Yes** · Buff: **Yes** (`sup_nanite_mend`/team buffs) | `middle` / `back` (50% swap) |

## 4. Lanes, Capacity, Values & Combat Rules
| Rule / Property | Details (`formationConfig.ts`, `combat.ts`, `battleDisplay.ts`, `vi.ts`) |
| :--- | :--- |
| Count & Capacity | **3 lanes/side**; defaults: `front: 3`, `middle: 3`, `back: 2`, `maxUnitsPerSide: 8` (`DEFAULT_FORMATION_CONFIG`, editable `0..8` in `AdminPanel.tsx`). |
| Row Value Names | `'front'` = `TIỀN TUYẾN` (`common.frontRow`), `'middle'` = `TRUNG TUYẾN` (`common.middleRow`), `'back'` = `HẬU TUYẾN` (`common.backRow`). |
| Targeting & Splash | `getValidEnemyTargets()` forces non-ranged hits onto nearest alive row (`front -> middle -> back`); `isLongRangeAction()` (long-range weapon, `siege`, `sniper`, `siege_mode`, AoE/multi/snipe skills) & `getValidAllyTargets()` ignore row blocking. `getAdjacentUnits()` splashes `formationCol ± 1` in same row. |
| "Lộ diện" (Exposed) | `computeRowExposure()`: first row (`front -> middle -> back`) with >=1 alive unit is `'exposed'` (`Lộ diện`); lanes behind it are `'protected'` until closer rows fall. |
| Lane Buffs & EVA | `rowModifiers` applied in `getEffectiveUnitDefense()` & damage formula: `front` `+10% DEF`, `middle` neutral, `back` `-10% DEF · +10% Ranged DMG`. **No `+36% EVA` lane buff exists** in `FormationRowModifier` or `combat.ts` (`retreat_back_eva` skill only moves unit back/mid + self `eva_up`). |

## 5. Top 20 Largest Source Files (`src/`, excl. `__tests__`)
| # | File | Lines | # | File | Lines |
| :-: | :--- | --: | :-: | :--- | --: |
| 1 | `src/store/useGameStore.ts` | 3981 | 11 | `src/i18n/en.ts` | 1653 |
| 2 | `src/components/BattleScreen.tsx` | 3918 | 12 | `src/engine/cloudSave.ts` | 1620 |
| 3 | `src/engine/combat.ts` | 3860 | 13 | `src/engine/tactics.ts` | 1500 |
| 4 | `src/components/GearView.tsx` | 2829 | 14 | `src/components/BattleVfxOverlay.tsx` | 1496 |
| 5 | `src/components/BattleRadarView.tsx` | 2424 | 15 | `src/components/MapView.tsx` | 1359 |
| 6 | `src/components/AdminPanel.tsx` | 2139 | 16 | `src/components/CloudSaveDialogs.tsx` | 1321 |
| 7 | `src/components/ShopScreen.tsx` | 1933 | 17 | `src/utils/battleDisplay.ts` | 1249 |
| 8 | `src/components/BattleStatsModal.tsx` | 1757 | 18 | `src/types/game.ts` | 1248 |
| 9 | `src/store/useCloudSaveStore.ts` | 1721 | 19 | `src/components/TurnQueueBar.tsx` | 1170 |
| 10 | `src/i18n/vi.ts` | 1654 | 20 | `src/utils/combatLogFormat.ts` | 1129 |

*(Note: including `__tests__/`, `src/engine/__tests__/engine.test.ts` at `2516` lines ranks #5.)*
