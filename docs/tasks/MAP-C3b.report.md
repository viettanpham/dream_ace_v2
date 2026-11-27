# TASK MAP-C3b Report
- Items done: ITEM 1 (click fix: defer setPointerCapture until >6px drag + pointerEvents="all" r=32 hit circle), ITEM 2 (mapNames.json ACE Online pools + distance-pooled unique names + "Bộ tên" dropdown), ITEM 3 (2 capitals: start="Liên Minh VSS"/"VSS Alliance" & farthest="Rãnh Void Sovereign"/"Void Sovereign Trench"), ITEM 4 (generated map initial zoom/pan centered on start + neighbours), ITEM 5 (NPC active skill cap via getUnlockedActiveSlots in buildNpcSkillLoadout & buildCombatUnit).
- Files changed: src/data/mapNames.json, src/engine/{mapGenerator,combat}.ts, src/components/{MapView,admin/WorldGenAdminBlock}.tsx, src/i18n/{vi,en,index}.ts, src/engine/__tests__/mapFixesC3b.test.tsx, docs/CODEMAP.md.
- Tests & checks: 5 files / 21 tests passed (mapFixesC3b, mapGeneratorC3, mapM1, npcRoleSkillsNpcSk1, activeSlotsSkslotA via vitest --reporter=dot) + npx tsc --noEmit passed.
- 20-node world (seed KESTREL): Liên Minh VSS, Blackburn Site, Orina Peninsula, Stone Ruins, Bach Mountain Chain, Kahlua Beach, Redline, Rock's Nest Bottom, Tylent Jungle, Daisy Riverhead, Violet Cave, Floating Lake, The Violence Blizzard, Crystal Cave, Rock's Nest Middle, Herremeze Relic Site, Gjert Road, Portsmouth Canyon, Slope Port, Rãnh Void Sovereign.
- Not checked: full vitest suite, production build (npm run build), and interactive browser testing.
CHƯA chạy trình duyệt thật
