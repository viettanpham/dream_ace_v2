# TASK SH1 — Progress Checklist

- [x] STEP A — Read targeted sections of `game.ts`, `statusIconMap.ts`, `combat.ts`, `migration.ts`, and `AdminPanel.tsx`, save `SH1.md` & initialize checklist
- [x] ITEM 1 — Implement `adminConfig.shieldRegen` (types + sanitizer/defaults) & pure `src/engine/shieldRegen.ts` + wire into `combat.ts` (`applyDamageToUnit`, start-of-turn regen & `hitSinceOwnTurn` reset, `shield_cracked`) + callers passing `adminConfig.shieldRegen`
- [x] ITEM 2 — Add `'shield_cracked'` status chip (`statusIconMap.ts` + `statusDisplayPrefs` / `battleDisplay` / `StatusChip` / `vi.ts` + `en.ts`), combat log tag/line + shield popup (`>= 1% maxShield`), and Admin CP "Hồi khiên" settings + live example
- [x] ITEM 3 — Compute & verify default-stats class shield regen table (`Lv1 / Lv10 / Lv20` for all 4 classes at `100% / 75% / 30%`)
- [x] TESTS — Add comprehensive unit & integration tests (formula cases, hit/evade/DoT/reset, cracked turns & refresh, `enabled=false` seed parity, Admin sanitizer clamps, vi/en parity, seeded 4v4 battle no-NaN)
- [x] CODEMAP & CHECKS — Update `docs/CODEMAP.md`, run `npx vitest run`, `tsc --noEmit` / `lint_applet`, production build, and write/print `docs/tasks/SH1.report.md`
