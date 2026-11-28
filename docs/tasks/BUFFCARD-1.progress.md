# TASK BUFFCARD-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/BUFFCARD-1.md`, create `docs/tasks/BUFFCARD-1.progress.md`
- [x] ITEM 0: Fix stale `OPENING_CARDS_LIST.length` assert in `src/engine/__tests__/engine.test.ts:~915` (9 -> 18)
- [x] ITEM 1: Data + config (`src/data/buffCards.ts`, `adminConfig.buffCards`, `getBuffCardRatePct`)
- [x] ITEM 2: Pilot state + rules (`PilotAccount.buffCards`/`activeBuffs`, `activeExpBoostBattles` migration, `useBuffCard()`, battle decrement on win/defeat/retreat, `exp_boost` unified flow)
- [x] ITEM 3: Apply buffs via one helper (`getPilotBuffBonuses()`, `applyPilotBuffsToPassives()`, `spMaxPct` in `stats.ts`, 5 player sites + `finalizeBattleOutcome` EXP mult, check stored current HP/shield/SP clamp)
- [x] ITEM 4: Chợ WP (`buff_card` offers rolled per refresh) + Kho đồ ("Thẻ buff" + "Buff đang chạy" + replace confirm dialog + max_stack error, icons from `iconCatalog.json`, `vi.ts` + `en.ts`)
- [x] ITEM 5: Admin CP (`AdminSection` "Thẻ buff", live examples, reset, "Tặng thẻ buff" tester row)
- [x] ITEM 6: Starter pack rows (`'buff_card'` & `'supply'`, qty min 0, max 20, grouped `+ Thêm dòng` menu)
- [x] TESTS: 6 focused tests + related test files (`--reporter=dot`) + `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/BUFFCARD-1.report.md` (<= 15 lines)
