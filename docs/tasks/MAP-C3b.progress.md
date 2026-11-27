# TASK MAP-C3b Progress

- [x] STEP A: Save `docs/tasks/MAP-C3b.md` & `docs/tasks/MAP-C3b.progress.md`
- [x] ITEM 1: Click fix (`MapView.tsx` capture only after >6px move + transparent >=22 hit circle)
- [x] ITEM 2: Names (`src/data/mapNames.json`, `mapGenerator.ts` distance-based pooled names + `WorldGenAdminBlock.tsx` name-set dropdown + `vi.ts`/`en.ts`)
- [x] ITEM 3: Two capitals (start = allied capital `"Liên Minh VSS"`/`"VSS Alliance"`, farthest = enemy capital `"Rãnh Void Sovereign"`/`"Void Sovereign Trench"`)
- [x] ITEM 4: Initial view (`MapView.tsx` center on start node & zoom showing start + neighbours on generated map, keep zoom buttons & min zoom)
- [x] ITEM 5: NPC active skill cap (`combat.ts` `buildNpcSkillLoadout` & `:466` using `getUnlockedActiveSlots(level, adminConfig?.activeSlots)`)
- [x] TESTS & CHECKS & REPORT: <= 5 tests + related tests (`--reporter=dot`) + `tsc --noEmit` + tsx 20-node names print, update `docs/CODEMAP.md`, tick checklist, write & print `docs/tasks/MAP-C3b.report.md` (<= 12 lines)
