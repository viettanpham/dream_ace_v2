# TASK MAP-K1 — Final Report

## 1. Items Completed
- **STEP A**: Saved task prompt verbatim to `docs/tasks/MAP-K1.md`, created and tracked `docs/tasks/MAP-K1.progress.md`, read `docs/CODEMAP.md`, and updated `docs/CODEMAP.md`. `CURRENT_SAVE_VERSION` remains `10`; Firebase remains disabled.
- **ITEM 1 — Single Rule Table, `BattleKind` Extension, Battle Launch Options & Source Providers**:
  - Extended `BattleKind` (`'assault' | 'defend' | 'patrol' | 'mission' | 'event'`) in `src/types/game.ts` and reused it in `src/engine/frontline.ts` (replacing `BattleOptionKind` without creating a second type).
  - Created `src/data/battleKinds.ts` defining `BATTLE_KIND_RULES` for all 5 battle kinds (`assault`, `defend`, `patrol`, `mission`, `event`) plus the external provider registry (`registerBattleSourceProvider()`, `getBattleSourceProvider()`, `checkBattleSource()`, `clearBattleSourceProvidersForTests()`).
  - Added `kind` and `sourceId` (plus optional `rewardMult`) to `BattleState`, `BattleSummary.kind`, `AutoRepeatSession.kind` / `sourceId`, and `LaunchBattleOptions`.
  - Updated `validateBattleLaunch()` in `src/engine/frontline.ts`, `createInitialBattleState()` in `src/engine/combat.ts`, and `launchBattleForSector()` / `startBattle()` / `reloadBattle()` / `startAutoRepeat()` in `src/store/useGameStore.ts` to accept optional `{ kind, sourceId }`, default to `pickDefaultBattle()`, enforce `BATTLE_KIND_RULES`, refuse `mission`/`event` when no active provider is registered (`'map.reason.sourceInactive'`), and apply provider `sizeOverride` / `rewardMult`.
- **ITEM 2 — Consequences by Kind, Result Dialog Line & Auto-Repeat Kind Preservation**:
  - Updated `applyBattleBaseConsequences(pilot, sectorId, won, kind = 'assault')` in `src/engine/mapWorld.ts` and `finalizeBattleOutcome()` in `src/store/useGameStore.ts` to gate base capture (`capturesOnWin`: `assault` only), raid clearing (`clearsRaid`: `defend` only), and `activeBonusMission` overlay completion (`completesBonusMissionOnWin`: `assault` or `defend` win at target) by `BATTLE_KIND_RULES[kind]`. `patrol`, `mission`, and `event` never change faction or capture bases.
  - Added `<p data-testid="battle-result-kind">` to `src/components/BattleResultDialog.tsx` displaying `"Loại trận: Tấn công | Phòng thủ | Tuần tra | Nhiệm vụ | Sự kiện"` (`'Battle type: Assault | Defend | Patrol | Mission | Event'`), with matching bilingual keys in `src/i18n/vi.ts` and `src/i18n/en.ts`.
  - Updated `AutoRepeat` (`useGameStore.ts` and `BattleScreen.tsx`) to preserve the `kind` and `sourceId` of its first battle and stop when disallowed (`'node_not_contested'` for map kinds, `'source_inactive'` `"Dừng: nguồn nhiệm vụ/sự kiện không còn hoạt động"` for `mission`/`event`).
- **ITEM 3 — Tests & Verification**:
  - Added `src/engine/__tests__/battleKindsK1.test.tsx` (9 tests covering rule table, defaults, assault-only capture, defend-only raid clear, patrol/mission/event non-capture, fake provider acceptance/refusal, bonus mission overlay, auto-repeat kind preservation + `'source_inactive'`, fixed-seed determinism across the 3 map kinds, BattleResultDialog kind line, and vi/en parity).
  - Updated multi-victory loop setups in `src/components/__tests__/f2aPlus.test.tsx`, `src/components/__tests__/loopDiagnosis.test.tsx`, and `src/components/__tests__/loopDefeatSpeedLp2.test.tsx` to run `patrol` on allied frontline `border_outpost` where multi-win continuation is asserted.

## 2. Files Changed
- `src/types/game.ts`
- `src/data/battleKinds.ts` (new)
- `src/engine/frontline.ts`
- `src/engine/mapWorld.ts`
- `src/engine/combat.ts`
- `src/store/useGameStore.ts`
- `src/components/BattleScreen.tsx`
- `src/components/BattleResultDialog.tsx`
- `src/i18n/vi.ts`
- `src/i18n/en.ts`
- `src/engine/__tests__/battleKindsK1.test.tsx` (new)
- `src/components/__tests__/f2aPlus.test.tsx`
- `src/components/__tests__/loopDiagnosis.test.tsx`
- `src/components/__tests__/loopDefeatSpeedLp2.test.tsx`
- `docs/CODEMAP.md`
- `docs/tasks/MAP-K1.md` (new)
- `docs/tasks/MAP-K1.progress.md` (new)
- `docs/tasks/MAP-K1.report.md` (new)

## 3. Checks & Verification
- `npx vitest run`: **62 passed** test files, **403 passed** tests (**tests `394 -> 403`**)
- `lint_applet` (`tsc --noEmit`): **Passed**
- `compile_applet` (production build): **Passed**
- **Browser check**: **NOT checked in a real browser (result dialog line)**
