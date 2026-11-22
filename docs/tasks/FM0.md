TASK FM0 — Lane placement audit (READ-ONLY, no code changes). Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/FM0.md, checklist docs/tasks/FM0.progress.md, tick items, final report docs/tasks/FM0.report.md (max 60 lines) and print it. On retry continue from the first unticked item.

TOKEN SAVING (follow strictly): do NOT read the whole project. First read docs/CODEMAP.md (create it with a one-line header if missing). Find code with grep/search by symbol; open only the files that match, and for files over 300 lines read only the relevant line range. Change nothing except files under docs/. Do not run the full test suite (no code changes). Do not enable or provision Firebase.

QUESTIONS (answer from the code, cite file + function name):
1 Enemy units: where are they generated for a battle and how does each get its lane (random, list order, role)?
2 Ally units: how do they get a lane: automatic or chosen by the player? Is there any formation UI and where is it saved?
3 Role: do GEAR and enemy templates have a class/role field (tank, sniper, support, repair, buffer...)? Give a table: unit name | class/role | has heal/buff skills yes/no | current lane. Include every enemy template and the player GEAR classes.
4 Lanes: how many lanes and how many units fit per lane per side; value names behind Tiền tuyến / Trung tuyến / Hậu tuyến; how lane affects combat (targeting, "Lộ diện" exposed rule, lane buffs such as +36% EVA).
5 The 20 largest source files by line count (name + lines).

OUTPUT: the report answers 1-5 in short tables; then append one line per file you opened to docs/CODEMAP.md in the form "path — what it does (key functions)".
