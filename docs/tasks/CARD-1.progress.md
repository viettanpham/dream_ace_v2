# TASK CARD-1 Progress

- [x] STEP A: Save prompt verbatim to `docs/tasks/CARD-1.md`, create `docs/tasks/CARD-1.progress.md`
- [x] ITEM 0: Run `battleG3b*`, `battleRadarDeclutterG4a3a`, `statusBoardFullChips` (`--reporter=dot`); fix ONLY F2b-2a-broken asserts (or record old unrelated ones)
- [x] ITEM 1: Tier config (`adminConfig.skillTiers`, sanitizer, pure `getSkillTier`)
- [x] ITEM 2: Engine rules (`wp` & `card` learn/upgrade rules, `getSkillCardId`, `OPENING_CARDS_LIST`, `validateLearnOrUpgradeSkill`, `learnOrUpgradeSkillOnGear`)
- [x] ITEM 3: Price multiplier (`adminConfig.skillCardPriceMult`, `getSkillCardPrice`)
- [x] ITEM 4: Card dialog & UI (tier badge in `SkillView`, owned card clickable -> detail/learn dialog, missing card link to WP shop row, `ShopScreen` price helper)
- [x] ITEM 5: Admin CP (`AdminSection` "Cấp bậc kỹ năng", 4x2 grid + live preview, `skillWpCostFactor` & `skillCardPriceMult` + live examples, reset button, `vi.ts` + `en.ts`)
- [x] TESTS: 6 focused tests + related test files (`--reporter=dot`) + `tsc --noEmit`
- [x] Update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/CARD-1.report.md` (<= 15 lines)
