# TASK G4a-3a Progress

- [x] 0. Step 0 read-only baseline check (`npx vitest run` = 268, file inventory, ring/lane dimensions, radar toast vs log audit, dead ghost location)
- [x] 1. Marker: 80px ring on desktop/tablet (phone keep/grow if room), 1-line truncated name + title, max 3 icon-only 20px mini chips + "+N", remove all text tag pills, 16px AUTO (top-left) & lock (top-right) corner badges on ring
- [x] 2. Floating labels: 1 label per unit at a time (queued ~600ms each, max 3 queued, drop older), 18px slot ABOVE ring, fixed offset, never over ring/other unit name, clipped inside radar box, none on dead units
- [x] 3. Lane header: one muted 20px line = lane name + "Lộ diện" only on exposed lane + lane buff text (e.g. "+36% EVA") in same line, truncate; remove "Bảo vệ" and "Trống"
- [x] 4. Remove toast chips over the radar (write any non-logged text to combat log if needed)
- [x] 5. Dead units: no ghost marker on desktop or phone; phone-only empty lane collapses to one muted 20px line with lane name
- [x] 6. "Chú giải" icon button must not cover markers or lane headers
- [x] 7. Tests (vitest) & verification checks (`npx vitest run`, `tsc --noEmit` / `lint_applet`, production build)
