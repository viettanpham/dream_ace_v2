TASK G4b — Support FX tone + radar buff projectile + card floating numbers inside the card. Model: NEON. If this prompt looks cut off, STOP and tell me the last words you can see.

STEP A (resume): save this prompt verbatim to docs/tasks/G4b.md, checklist docs/tasks/G4b.progress.md, tick items, final report docs/tasks/G4b.report.md and print it. On retry continue from the first unticked item.

TOKEN SAVING: read docs/CODEMAP.md first. Open ONLY: src/types/game.ts CombatFxEvent (~871-883); src/engine/combat.ts support cases ~2921-3430 (each builds fxEvent kind 'heal'); src/components/BattleVfxOverlay.tsx heal branch ~760-830; src/utils/battleVfx.ts resolveEffectiveVfxConfig ~425-510; src/components/BattleUnitCard.tsx popups ~378-410; src/index.css float-popup keyframes ~217-270, .anim-popup ~355, reduced-motion rules ~979. Related tests only while working, full vitest once at the end. Add CODEMAP lines. Do not enable Firebase.

SCOPE: this task IS FX: battleVfx.ts / BattleVfxOverlay.tsx may change only as listed. No size/layout change (radar, cards, sidebar, control row). Engine rules and numbers unchanged (only an extra field on the fx event). CURRENT_SAVE_VERSION unchanged. No new setting.

ITEM 1 — FX tone. Add optional tone?: 'heal'|'shield'|'sp'|'buff' to CombatFxEvent (kind stays 'heal' for support FX so old code keeps working). Set it in every support case of combat.ts (HP heal -> heal, shield gain -> shield, SP gain -> sp, ATK/DEF/EVA up, invincible, purify -> buff); report the mapping table. New pure file src/utils/fxTone.ts: resolveFxTone(fx) (kind heal without tone -> 'heal'; damage kinds -> 'damage') and FX_TONE_COLORS {heal #22c55e, shield #38bdf8, sp #f59e0b, buff #facc15, damage = existing team accent}.
ITEM 2 — Radar buff projectile. In the heal branch: before the existing target ring, fire a NON-damaging projectile caster -> each target reusing the existing projectile classes (vfx-cannon-fly / reduced marker), tinted with FX_TONE_COLORS; the ring on arrival uses the same color; tone buff adds 2-3 small rising "▲" inside the ring (CSS only); caster gets a short glow ring (~400ms). AoE: projectiles to max 3 targets, rings on all. Self-cast: ring only. Follow vfxConfig: showProjectiles false or battleSpeed >= 5 -> ring only; reducedMotion -> existing reduced marker; animationsSkipped -> nothing. Damage FX unchanged.
ITEM 3 — Card floating numbers stay inside the card. Today they start at top 2-30px and float UP so they are cut at the card top and cover the name. New keyframes float-popup-in / float-popup-tight-in: start at top 18px (under the name row), drift DOWN about 12px, fade; show max 3 (newest), spread horizontally (left 30% / 50% / 70%) instead of stacked rows; text truncated to the card width. Reduced motion: fade only. Radar labels untouched.

HARD LIMITS: no size change anywhere; no horizontal overflow; nothing at x<8; one projectile per fx event at any speed (existing cleanup timers).

TESTS: tone per support case; resolveFxTone defaults; heal branch renders projectile + ring in tone color, none at speed 5 or showProjectiles false; self-cast ring only; AoE max 3 projectiles; card popups use the -in classes, max 3, inside the card on a 54px card; reduced motion has no movement class; old FX tests green (update only superseded popup position asserts).

CHECKS: npx vitest run (once), tsc --noEmit / lint_applet, production build.

REPORT: items done + files changed; tone mapping table; tests old (320) -> new; NOT checked in a real browser (projectile look per tone, popup readability on 54px cards, 10x-30x).
