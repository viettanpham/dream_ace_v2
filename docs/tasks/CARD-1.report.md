# TASK CARD-1 Report
Done: ITEM 0..5 + 6 focused tests + docs/CODEMAP.md.
Files: src/{types/game,data/{balance,skills},engine/{skills,migration},store/useGameStore,i18n/{vi,en}}.ts, src/components/{SkillView,ShopScreen,AdminPanel,admin/SkillTiersAdminBlock}.tsx, src/engine/__tests__/skillTiersCard1.test.ts
Card ID rule: getSkillCardId(s) => s.openingCardId || 'card_' + s.id (18 default OPENING_CARDS_LIST: 9 active + 9 passive; special/elite unchanged at mult 1).
Default tiers (unlockLevel asc; gen_/* & starters & mods = credit):
| Class | Credit | WP | Card |
|---|---|---|---|
| striker | A: str_hotload_shells, str_ordnance_amp / P: str_passive_ordnance | A: str_deadeye_link, str_viper_sweep, str_carpet_salvo, str_solar_capacitor / P: str_passive_piercer | A: str_phase_shroud, str_skyfall_protocol / P: str_passive_overcharge, str_passive_killzone |
| siege | A: sge_anchor_protocol, sge_bastion_lock / P: sge_passive_plating | A: sge_grav_bolas, sge_aegis_sunder / P: sge_passive_hull | A: sge_thermal_mask, sge_starbreaker_lance / P: sge_passive_capbank, sge_passive_last_stand |
| interceptor | A: int_sabot_burst, int_snap_riposte / P: int_passive_vectored | A: int_afterburn_slip, int_mach_surge, int_ecm_blackout / P: int_passive_hunter | A: int_mirage_spin, int_redline_fury / P: int_passive_afterimage, int_passive_finisher |
| support | A: sup_nanite_mend, sup_regen_grid / P: sup_passive_capacitor | A: sup_lidar_sweep, sup_energize_target, sup_flux_transfer, sup_healing_field, sup_war_hymn, sup_aegis_field, sup_iron_canopy, sup_slipstream_link / P: - | A: sup_stasis_shell, sup_system_purge, sup_genesis_wave / P: sup_passive_field_medic, sup_passive_shield_tech, sup_passive_reactor |
Tests: skillTiersCard1 (6/6), skillConfigS1b (6/6), supplyShopCs3a (5/5) + tsc --noEmit PASS.
Old failing asserts (untouched): ITEM 0 (0 broken by F2b-2a; 3 old: battleG3b:1004, battleRadarDeclutterG4a3a:335, statusBoardFullChips:335); shopAndIcons:359 (9 vs 8 tabs); engine.test:915 (9 vs 18 OPENING_CARDS_LIST).
Browser check: NOT checked in a real browser.
