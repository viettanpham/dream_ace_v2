TASK SH1 — Shield regeneration per turn driven by the SHIELD stat. Model: Hydrogen. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/SH1.md, checklist docs/tasks/SH1.progress.md, tick items, final report docs/tasks/SH1.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first; grep by symbol (lines approximate). Open ONLY: src/engine/combat.ts resolveUnitActionCore start-of-turn block (~1585-1615) and applyDamageToUnit shield part (~1270-1300), src/types/game.ts StatusEffectType (~38-60), CombatUnit (~771-799), AdminConfig (~1223); src/data/statusIconMap.ts (how the 5 unmapped statuses use Lucide fallbacks); src/engine/migration.ts admin sanitizer (~345-380) and createDefaultAdminConfig (~104); src/components/AdminPanel.tsx only the balance block near enrageStepPct (~1440-1470). Related tests only, full vitest once at the end. Add CODEMAP lines. Do not enable Firebase.

SCOPE: engine rule + Admin numbers + status chip + log line. No layout change. CURRENT_SAVE_VERSION unchanged: adminConfig.shieldRegen is optional, the sanitizer fills defaults. New strings in vi.ts AND en.ts.

ITEM 1 — Engine. adminConfig.shieldRegen = { enabled true, basePct 3, perPointPct 0.08, capPct 12, notHitMult 100, hitMult 75, brokenMult 30, brokenTurns 3 } (sanitize: pct 0-50, mult 0-200, turns 1-10). New pure src/engine/shieldRegen.ts computeShieldRegen(unit, cfg) -> { amount, multPct, reason: 'not_hit'|'hit'|'cracked'|'blocked'|'none' }: regenPct = clamp(basePct + unit.stats.shield x perPointPct, 0, capPct); base = round(maxShield x regenPct / 100); mult: shield_break status -> 0 (blocked); new status 'shield_cracked' -> brokenMult; else unit.hitSinceOwnTurn -> hitMult; else notHitMult; amount = min(maxShield - shield, round(base x mult / 100)); maxShield 0 -> none. Apply at the START of the unit's own turn next to the SP regen, then reset hitSinceOwnTurn = false. In applyDamageToUnit set target.hitSinceOwnTurn = true when shieldAbsorbed > 0 or hullDamage > 0 (evade and DoT do not set it); when that hit takes shield from > 0 to 0 add/refresh 'shield_cracked' for brokenTurns own turns. Both sides. Defend restore unchanged.
ITEM 2 — Show it. 'shield_cracked' chip: name "Khiên nứt" (en "Cracked shield"), debuff frame, value "30%" (the brokenMult), Lucide ShieldOff via the existing fallback map; tooltip "Hồi khiên chỉ 30% trong 3 lượt". Combat log: one line when amount > 0: "<name> hồi khiên SHD +N" (+ " (bị trúng, 75%)" or " (khiên nứt, 30%)"), tag SHIELD; small shield popup "SHD +N" only when amount >= 1% of maxShield (avoid spam). Admin CP balance block: section "Hồi khiên" with the 8 numbers and a live example line "SHIELD 25 -> 5% khiên tối đa mỗi lượt".
ITEM 3 — Numbers report. Print a table: each class at Lv1/10/20 with its default stats: maxShield, regenPct, amount at 100/75/30%.

HARD LIMITS: no change to damage, HP, SP, shield max formulas; regen never exceeds maxShield; disabled when shieldRegen.enabled false (then the game behaves exactly as before).

TESTS: computeShieldRegen for not hit / hit / cracked / shield_break / maxShield 0 / cap; hitSinceOwnTurn set by a hit, not by evade or burn, reset after own turn; shield to 0 adds Khiên nứt for 3 own turns and refreshes; enabled=false = identical battle to before for a fixed seed; Admin sanitizer clamps; vi/en parity; a seeded 4v4 battle finishes without NaN.

CHECKS: npx vitest run (once), tsc --noEmit / lint_applet, production build.

REPORT: items done + files changed; the class table; tests old (352) -> new; NOT checked in a real browser (log spam at 10x+, chip look).
