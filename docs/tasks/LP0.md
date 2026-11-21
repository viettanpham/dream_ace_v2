TASK LP0 — Loop (Lặp) diagnosis, READ-ONLY. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (first): save THIS WHOLE prompt verbatim to docs/tasks/LP0.md and create docs/tasks/LP0.progress.md with a checklist of items 1-5 (unticked); tick each item right after finishing it; at the end write docs/tasks/LP0.report.md and print it. If interrupted or retried: read both files and continue from the first unticked item.

RULES: change NO source file; the only allowed new file is one vitest file src/components/__tests__/loopDiagnosis.test.tsx (or under src/engine/__tests__); if that test fails because the loop is broken, mark the failing case with test.fails or test.skip and explain, so the suite stays green; CURRENT_SAVE_VERSION untouched.

SYMPTOM: with the "Lặp" button ON, when a battle ends the result dialog ("Chiến thắng Xuất kích") appears and the next battle does NOT start automatically; the user believes the loop logic may have been lost (the code may have lived in another workspace and was never pushed).

1. Find the loop implementation: store fields (counter, on/off), the Lặp button handler, where a next battle is launched, where it stops; list file names and function names. Also say whether any test mentions the loop and whether it passes.
2. Trace what happens at battle end with the loop ON, step by step, in the code: result dialog open, what closes it, what should trigger the next battle, and every condition that can block it (Tự động mode required?, isBattleActive / battle lock, cloud upload deferral from SV1b, pending dialogs, GEAR box full, low credits, defeat vs victory).
3. Write the vitest: loop ON for 3 battles, a forced victory, assert the next battle starts without a click; if you cannot simulate it, say exactly which part you could not and why.
4. Verdict: (a) loop code exists and works, the symptom has another cause; (b) code exists but a condition blocks it (name the file and line); (c) code is missing/partly removed (say what is missing). Propose the smallest fix but do NOT apply it.
5. History check: search docs/tasks/*.report.md and docs/*.md for the words "loop", "Lặp", "repeat" and name the task that built the loop (and what that report says it added: files, store fields, tests). Then say which of those files/fields/tests are missing from the current source. If a report says the loop was built but the code is absent, the verdict is (c) "lost between workspaces" and list exactly what must be rebuilt.

CHECKS: npx vitest run (report the baseline you started from; expected 242), tsc --noEmit (lint_applet). REPORT: the verdict first, then items 1-3 and 5 facts, files you read, and the proposed fix.
