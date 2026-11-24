# TASK SH2b Progress Checklist

- [x] STEP A — Save SH2b prompt, inspect CODEMAP & target symbol line ranges
- [x] ITEM 1 — Shield damage multiplier (`m`) in `applyShieldThenHull`, `applyShieldCracked`, `shield_cracked` removal + `shield_break` on shield 0, log suffix ` (x{m} khiên)`, and AdminConfig/migration fields (`shieldCrackedMult`, `shieldCrackedTurns`, `shieldDamageOverrides`)
- [x] ITEM 2 — Data (`sge_aegis_sunder`, `gunship`, `sge_starbreaker_lance` `ignoreDef`), icon (`DB12` in `iconCatalog.json`, `statusIconMap.ts`, `CatalogIcon.tsx`), i18n (`index.ts`, `vi.ts`, `en.ts`), and AdminPanel Khiên inputs
- [x] TESTS & CHECKS — At most 5 focused SH2b tests, update catalog row-count test to 99 if applicable, update `docs/CODEMAP.md`, run focused vitest (`--reporter=dot`, max 15 lines) + `npx tsc --noEmit`
- [x] REPORT — Write `docs/tasks/SH2b.report.md` and print it verbatim
