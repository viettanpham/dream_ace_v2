TASK RM2 — radar marker rings: thinner HP/shield ring, SP as a thin inner RING (no water), size tiers. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

RESUME: save this prompt to docs/tasks/RM2.md, the checklist to docs/tasks/RM2.progress.md, the final report to docs/tasks/RM2.report.md (print it at the end). If those files exist, continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first, grep by symbol, open only line ranges (battleDisplay.ts about 780-990, BattleRadarView.tsx about 830-1010 and the legend about 2400-2440), run only src/components/__tests__/battleG3b.test.tsx while working and the full `npx vitest run` once at the end, append CODEMAP lines. Do NOT enable Firebase. Baseline: 308 tests.

CONTEXT: RM1 made one split ring (left half HP, right half shield, stroke 8) plus an orange SP "water" fill inside the circle. The director says the water looks ugly and the ring is too thick. Replace the water with a thin SP ring and make the HP/shield ring thinner. Keep marker sizes unchanged (desktop 80px diameter, outer radius 40).

ITEM 1 — Geometry (src/utils/battleDisplay.ts, computeUnitRingArcs / computeRingArcSpec, RADAR_SPLIT_RING_STROKE_WIDTH):
- HP/shield stroke becomes size-aware: stroke = clamp(round(outerRadius * 0.09), 3, 5) (= 4px at outerRadius 40). The split ring keeps everything else from RM1: left HP / right shield, fill from 6 o'clock upward, ticks at 12 and 6, red #ef4444 for low HP, shield #38bdf8, dashed faint right half when maxShield = 0.
- SP becomes a thin full ring: stroke 2px, color #f59e0b, dark track #3a2a0c, gap 1px inside the HP/shield ring (center radius = outerRadius - stroke - 2), full 360 degrees starting at 12 o'clock going clockwise (rotate(-90) like the old full-circle case), ratio = clamp(sp / maxSp, 0, 1); maxSp = 0 -> track only. NOTE: computeRingArcSpec clamps stroke to RADAR_RING_DEFAULT_STROKE_WIDTH (3): SP needs stroke 2, so lower the clamp for SP only (add a parameter) and do not change other callers.
- Inner disc radius = outerRadius - stroke - 1 - 2 - 1 (about 32 at 80px); innerShapeRadius follows (keep the 2px margin). Remove spWaterHeight / spWaterTopY / spRatio-based water fields if nothing else uses them (grep first), expose the SP arc in the result instead.
- Size tiers by markerRadius: >= 30 = full (split ring + SP ring); RADAR_RING_MIN_MARKER_RADIUS (17) <= R < 30 = split ring only, NO SP ring, inner disc bigger accordingly; R < 17 = HP-only full ring exactly as today.

ITEM 2 — Render (src/components/BattleRadarView.tsx, about 836-1010): delete the SP water group (clipPath, fill rect, surface line, testids radar-ring-sp-fill-<id> / radar-ring-sp-surface-<id>). Render the SP ring track + arc as circles with data-testid radar-ring-sp-<id> (data-ratio, data-stroke-width), static SVG, no animation. Dead units stay ringless. Alive shape interior opacity: back to the normal solid look (remove the 0.25 fill-opacity trick that only existed so the water showed through, unless the shape then looks wrong; say what you did).
Legend ("Chú giải", about line 2400-2440, vi/en labels in src/i18n): update the ring glyph to the split ring + inner thin SP ring; label text for SP says it is the thin inner ring (replace any "water" wording).

ITEM 3 — Tests (battleG3b.test.tsx and any test asserting water ids): update to the new geometry: stroke 4 at markerRadius 41 and size-aware at smaller radii, SP ring stroke 2 + ratio + starts at 12 o'clock clockwise, maxSp = 0 track only, three tiers (R 41 full, R 22 split only with no radar-ring-sp, R 14 HP-only), no radar-ring-sp-fill/surface anywhere, static SVG (no animate/animateTransform), legend glyph + labels.

HARD LIMITS: do not change marker sizes, lane layout, floating labels, mini chips or any other file area. Phone markers below the 17 radius keep the HP-only ring.

REPORT at the end: tests old -> new, tsc --noEmit, production build, files changed, and "NOT checked in a real browser" (say specifically what was not seen: ring thickness look at 80px, SP ring readability, icon size inside the disc).
