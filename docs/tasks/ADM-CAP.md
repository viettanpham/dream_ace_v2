TASK ADM-CAP — Admin CP: capacity inputs get a draft value + confirm button. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/ADM-CAP.md, checklist docs/tasks/ADM-CAP.progress.md, tick items, final report docs/tasks/ADM-CAP.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; AdminPanel.tsx is ~2560 lines: NEVER read it whole. Open ONLY the "Sức chứa Hòm đồ" and "Sức chứa Kho đồ" blocks (grep admin-box-capacity-input, admin.boxCapacity, admin.warehouseCapacity, ~1505-1570) and the sanitizers sanitizeBoxCapacity / sanitizeWarehouseCapacity (grep). Also grep the tests that mention admin-box-capacity-input or boxCapacity. Related tests + tsc only. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: the two capacity inputs only. No change to defaults (box 100, min 20, max 1000), sanitizers, or save data.

ITEM 1 — For BOTH inputs (Hòm đồ: data-testid admin-box-capacity-input; Kho đồ: give it admin-warehouse-capacity-input): the field edits a LOCAL draft string (useState per input, initialised from the stored value and re-synced when the stored value changes). Typing never writes to the store. Next to each input a button "Áp dụng" (data-testid admin-box-capacity-apply / admin-warehouse-capacity-apply): enabled only when the draft is a whole number different from the stored value; clicking it writes adminUpdateConfig({ boxCapacity: sanitizeBoxCapacity(n) }) (or warehouseCapacity) and the input then shows the CLAMPED value. Enter inside the input also applies. A small hint under the field shows "Cho phép {min}-{max}"; when the draft is outside that range or not a number, the hint turns red and Áp dụng is disabled (do not silently clamp while typing). After applying, one short line "Đã áp dụng: {n}" for 3 seconds (or reuse the existing Admin notice style if there is one). New strings vi.ts AND en.ts.
ITEM 2 — Applying a LOWER capacity than the current item count must not delete anything: if the existing code already handles over-capacity boxes, keep that behaviour and just show the hint "Hòm đồ đang có {used}, vượt sức chứa mới" next to Áp dụng; if it does not, only show the hint (no deletion, no store change beyond the capacity value).

HARD LIMITS: AdminPanel.tsx grows at most ~50 lines; no other Admin field changes; no horizontal overflow at 360px.

TESTS: write at most 3 small tests in total; do not add tests beyond these; do not refactor existing tests (update an existing assertion only if it typed into the capacity input and expected an immediate write, and say which): (1) typing does not change the store until Áp dụng is clicked; (2) apply writes the sanitized value, out-of-range draft disables the button; (3) Enter applies, and the lower-than-used hint shows.

CHECKS: tsc --noEmit first, then ONLY the test files found by grep (admin capacity / boxCapacity / warehouse) + the new test with --reporter=dot; print at most 15 lines; on a failure re-run only the failing file. NO full vitest, NO production build.

REPORT (max 12 lines): items done + files changed; AdminPanel.tsx lines before/after; any old assertion changed; one test line; NOT checked in a real browser.
