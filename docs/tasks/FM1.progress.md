# TASK FM1 Progress Checklist

- [x] 1. MEASURE: create `src/engine/__tests__/formationLanes.test.ts` and measure (a) support in front, (b) support in front with middle/back free slot, (c) siege in front across sizes 4, 6, 8 (500 seeds each)
- [x] 2. Investigate root cause if (a) > 0, apply minimal fix preserving role rules + slot reservation, add regression assertions
- [x] 3. (Alternative if (a) = 0) N/A — (a) > 0 for sizes 6 and 8 (6 and 276 respectively), fixed in Item 2
- [x] 4. Run final checks (`npx vitest run`, `tsc --noEmit` / `lint_applet`, production build), record before/after counts, write and print `docs/tasks/FM1.report.md`
