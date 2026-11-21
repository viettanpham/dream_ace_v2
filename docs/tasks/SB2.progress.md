# TASK SB2 Progress

- [x] 1. Header row: single non-wrapping flex line (min-h 32px) with [side tag][name truncate][lane · exposure truncate] + always-rendered 24px blocked slot and 32px icon-only lock-target button (dimmed/aria-disabled when N/A); remove old 40px button row and 28px banner
- [x] 2. Stabilize acting chip and any other dynamic element in right column / selected-unit panel so total height never changes across turns, units, or battle end (heights from single constants source)
- [x] 3. Arithmetic verification from constants: identical panel height <= today's smallest state, plus narrowest >640px sidebar width truncation & full right-slot visibility check
- [x] 4. Tests (vitest): panel height constant/class identical across states, dimmed slots always present, header no-wrap/shrink-0/truncate, old 40px/28px elements removed (+ update older tests), vi/en keys, log flex-1 min-h 220, full test/lint/build pass
