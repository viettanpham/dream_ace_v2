# Task G4a-C1 Progress

- [x] 1. Sizes (one constants file): chip frame 32px (28px in the player bar strip), glyph 20px, value text 13px bold; row height = chip + gap, gap stays at least 14px; all status areas compute their height from these constants only.
- [x] 2. Turns badge: clock icon + number, number in YELLOW #F5C542 bold 11px on a dark pill (#0B1220 at 85%, 1px outline) so it stays readable on any frame; centered ON a frame corner (about 4px outside the frame), never overlapping the 20px glyph box; the A/B badge layout setting still chooses the corners.
- [x] 3. Check the screens from Step 0: the player block, the right-sidebar unit panel and the cards must not grow taller than about 8px per status row; if the player bar would exceed its current height by more than 8px, keep its default at 1 row. Bảng icon and legend show the new chip.
- [x] 4. Tests (vitest): chip frame constants (32 / 28) used by cards and bar; the turns number carries the yellow token; badge boxes computed from the constants do not intersect the glyph box; A/B layouts still swap corners; the status area height equals rows x (chip + gap); existing tests still pass.
