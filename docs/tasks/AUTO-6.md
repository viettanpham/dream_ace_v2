TASK AUTO-6 — Auto priority list 3 -> 6 skills, rule limit 8 -> 12. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/AUTO-6.md, checklist docs/tasks/AUTO-6.progress.md, tick items, final report docs/tasks/AUTO-6.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol. Open ONLY: SimpleTacticsConfig in src/types/game.ts (~617); src/data/balance.ts (maxTacticsRules ~59, maxEquippedActiveSkills ~70); src/engine/tactics.ts createDefaultSimpleTactics (~660-740), sanitizeSimpleTactics (~790-810), the simple rule generator (~900-1010); src/components/AutoTacticsModal.tsx (~185-215, ~585-670, rule counter ~313 and ~719). Related tests only + tsc --noEmit / lint_applet. Do not enable Firebase. CURRENT_SAVE_VERSION unchanged.

SCOPE: simple-auto priority list and the rule limit. Layout stays the same (priority strip wraps, picker grid unchanged, page scroll only on phone). New text in vi.ts AND en.ts.

ITEM 1 — Priority 3 -> 6. Priority list size = BALANCE_CONFIG.maxEquippedActiveSkills (6): replace every literal 3 (type comment, handleTogglePrioritySkill: push while below the size, when full replace the LAST entry, sanitizeSimpleTactics break, createDefaultSimpleTactics defaultPriority) by one constant MAX_PRIORITY_SKILLS derived from it. Presets: aggressive / balanced / default fill up to 6 non-elite bar skills in bar order; 'defensive' keeps its first 2. Saved configs keep their stored list as is (no auto fill). Label "5. Kỹ năng ưu tiên (Tối đa {max}, A > B > C ...)" with the number from the constant (en twin). Generator: priority skills are added in A > B > ... order after the fixed rules; the existing "stop at maxTacticsRules - 1" guard stays.
ITEM 2 — Rule limit 8 -> 12. BALANCE_CONFIG.maxTacticsRules = 12. The generator keeps its fixed rules first (survival, heal, purge, elite policy), then priority skills, then the basic attack as the last rule; it never exceeds 12. Custom mode counter shows x/12 and the "add rule" button disables at 12. Sanitizer slices at the constant. Old saved rule lists (up to 8) load unchanged.

HARD LIMITS: no change to battle numbers outside auto; no layout change; with a stored priority of 3 skills and 8 rules the generated rules are IDENTICAL to today (snapshot test).

TESTS: toggle fills up to 6 and replaces the last when full; sanitizer keeps up to 6 and drops duplicates, non-bar and passive ids; default presets fill up to 6 (defensive 2); generator with 6 priority + elite + heal + purge stays <= 12 and keeps fixed rules first; old 3-skill config gives identical rules (snapshot); custom counter x/12 and add button disabled at 12; vi/en parity (label shows 6).

CHECKS: related tests + tsc --noEmit / lint_applet. Full vitest NOT needed (last full run in U2b: 420).

REPORT: items done + files changed; tests old (420) -> new; list any old test whose expectation changed and why.
