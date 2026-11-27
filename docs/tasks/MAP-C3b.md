TASK MAP-C3b - World generator UI fixes (clickable nodes, themed names, 2 capitals, initial view, NPC skill cap). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A: save this prompt verbatim to docs/tasks/MAP-C3b.md, checklist docs/tasks/MAP-C3b.progress.md, final docs/tasks/MAP-C3b.report.md and print it. On retry continue from the first unticked item.

RULES: keep the fog rule (isVisible in src/engine/frontline.ts) unchanged; keep all existing features and the 6-node built-in map unchanged; CURRENT_SAVE_VERSION unchanged; the generator stays deterministic per (count, seed); new strings in vi.ts AND en.ts.

TOKEN SAVING: read docs/CODEMAP.md first, grep by symbol, line ranges for files over 300 lines (MapView.tsx :560-620, :1520-1530, :1741, :2153; mapGenerator.ts :153-550; combat.ts :305-342 and :455-468), do not enable Firebase.

ITEM 1 - Click fix (P1). Nodes on the map must be selectable by tap/click on desktop and phone while drag-pan and pinch still work. handlePointerDown in MapView.tsx calls setPointerCapture on the container at once, which retargets the click so the node <g onClick> (handleSelectSector) never fires. Do not capture on pointerdown; capture only once the pointer moved more than 6px (or select the node in pointerup when not moved). Keep the moved guard in handleSelectSector. Also give each node a transparent hit circle of radius >= 22 map units so small nodes are easy to tap.

ITEM 2 - Names. Create src/data/mapNames.json with 3 pools { ally, enemy, neutral } using the ACE Online names below (same text in vi and en):
ally: Stone Ruins, Tylent Jungle, Bach Mountain Chain, Blackburn Site, Zaylope Beach, Starlite Valley, Redline, Rock's Nest Bottom, Sunken City, Kahlua Beach, Nubarke Cave, Orina Peninsula, Daisy Riverhead.
enemy: Reynard Beach, Edmont Valley, Desert of Ardor, The Violence Blizzard, Crystal Cave, Plain of Doleful Melody, Herremeze Relic Site, Rock's Nest Middle, Atus Beach, Gjert Road, Slope Port, Portsmouth Canyon.
neutral: Castor, Polaris, Denebola, Alphard, Alioth, Pherkad, Eopi, Robenia City Orbit, J-Ark Hangar, J-Ark Engine Room, NGC Marine Laboratory, NGC Secret Base, Hazle Research Center, Violet Cave, Mirny Stope, El Dorado Metropolis, Floating Lake, Ash Lane, Akron, Maelstrom Desert, Infected Area, Ruined City, Petra Cave, Watermelon Island, Routhier.
Replace "Căn cứ N" / "Base N" in src/engine/mapGenerator.ts (:466): nodes nearer the allied capital (by lane distance) draw from ally, nearer the enemy capital from enemy, middle ones from neutral; seeded shuffle, no duplicates in one world; when a pool runs out use the other pools, then "<name> II". Names stay after conquest. Admin "Thế giới" block (src/components/admin/WorldGenAdminBlock.tsx): dropdown "Bộ tên" with one option "ACE Online" (default), built so more sets can be added later. Region code stays "Sector NN".

ITEM 3 - Two capitals. The start node = allied capital "Liên Minh VSS" / "VSS Alliance" (baseType capital, allied). The node farthest from the start (by lane distance) = enemy capital "Rãnh Void Sovereign" / "Void Sovereign Trench" (baseType capital, hostile). Must still pass validateMapPack and keep exactly 1 allied start. No new capital rules (HOME-1 does them later).

ITEM 4 - Initial view. On a generated map center the initial view on the start node at the zoom that shows the start and its neighbours (not the whole bounds); keep the zoom buttons, and the minimum zoom still shows the whole map.

ITEM 5 (small, independent) - NPC active skill cap. In src/engine/combat.ts buildNpcSkillLoadout (:305-342) and the NPC slice at :466, replace MAX_ACTIVE_SKILL_BAR by getUnlockedActiveSlots(level, adminConfig.activeSlots) (add activeSlots to the Pick type; level = the NPC level; the starter fallback is sliced to it too). Defaults give Lv1 3, Lv10 5, Lv15 6, Lv30 9 slots. A caller-supplied equippedSkillIds list is sliced to the same limit.

HARD LIMITS: built-in map pack output unchanged; 12 and 50 node worlds both connected with 0 lane crossings; no horizontal overflow at 360px.

TESTS (max 5, small): generator names unique + two capitals for counts 12/20/50 and determinism for the same seed; a no-move pointer sequence selects a node; a drag over 6px does not select; NPC Lv1 <= 3, Lv15 <= 6, Lv30 <= 9 active skills; custom activeSlots {initial 2, everyLevels 10, max 4} gives <= 2 at Lv1 and <= 4 at Lv40.

CHECKS: related test files with --reporter=dot, then tsc --noEmit; also run the generator once with tsx and print the node names of a 20-node world. NO full vitest, NO production build.

REPORT (<= 12 lines): items done, files changed, tests in one line, what was NOT checked. End with "CHƯA chạy trình duyệt thật".
