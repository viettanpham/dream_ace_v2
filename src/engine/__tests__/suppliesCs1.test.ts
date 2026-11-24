import { describe, expect, it, vi } from 'vitest';
import {
  getSupplyTemplateById,
  SUPPLY_TEMPLATES,
  validateSupplyTemplate,
  validateSupplyTemplates,
} from '../../data/consumables';
import rawIconCatalog from '../../data/iconCatalog.json';
import { PRICE_FORMULA } from '../../data/itemPricing';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { translate } from '../../i18n';
type TranslateKey = Parameters<typeof translate>[1];
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit, ConsumableItem } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { computeSupplyPrice } from '../itemPrice';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import {
  buildExportEnvelope,
  decryptEnvelope,
  parseImportEnvelope,
} from '../saveExport';
import {
  addSupplyToConsumables,
  canUseSupply,
  DEFAULT_SUPPLY_LOADOUT_SLOTS,
  DEFAULT_SUPPLY_USES_PER_TURN,
  sanitizeConsumables,
  setSupplyLoadout,
  SUPPLY_STACK_CAP,
} from '../supplies';
import { applySupplyEffects } from '../supplyEffects';

function makeDummyUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally_player',
    name: 'Vance',
    callsign: 'V-01',
    side: 'ally',
    row: 'front',
    isPlayer: true,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: {
      attack: 30,
      defense: 20,
      fuel: 15,
      spirit: 15,
      shield: 20,
      evasion: 10,
    },
    derived: {
      maxHp: 500,
      maxShield: 200,
      maxSp: 100,
      speed: 30,
      attackPower: 30,
      defenseRating: 20,
      skillPower: 25,
      critChance: 15,
      dodgeChance: 10,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 250,
    shield: 80,
    sp: 40,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('TASK CS1 — Battle Supply Data, Price Formula, Save v11 & Pure Rules', () => {
  it('1) loads 12 valid sys supply templates (hp/shield/sp x T1-T4) and drops bad rows with console.warn', () => {
    expect(SUPPLY_TEMPLATES).toHaveLength(12);
    const catalogIds = new Set(
      (rawIconCatalog as Array<{ id: string }>).map((row) => row.id)
    );
    for (const tpl of SUPPLY_TEMPLATES) {
      expect(tpl.registryTag).toBe('sys');
      expect(tpl.cooldownTurns).toBe(2);
      expect(tpl.perBattleLimit).toBe(3);
      expect(catalogIds.has(tpl.iconId)).toBe(true);
    }

    expect(getSupplyTemplateById('sup_hp_t2')?.unlockLevel).toBe(10);
    expect(getSupplyTemplateById('sup_hp_t2')?.effects).toEqual([
      { kind: 'heal_hp_pct', value: 22 },
    ]);
    expect(getSupplyTemplateById('sup_shield_t4')?.effects).toEqual([
      { kind: 'restore_shield_pct', value: 45 },
    ]);
    expect(getSupplyTemplateById('sup_sp_t3')?.effects).toEqual([
      { kind: 'restore_sp_pct', value: 36 },
    ]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateSupplyTemplate(null)).toBeNull();
    expect(
      validateSupplyTemplate({
        id: 'bad_icon',
        family: 'hp_kit',
        tier: 1,
        unlockLevel: 1,
        iconId: 'NOT_IN_CATALOG',
        effects: [{ kind: 'heal_hp_pct', value: 15 }],
        cooldownTurns: 2,
        perBattleLimit: 3,
      })
    ).toBeNull();

    const parsed = validateSupplyTemplates({
      schemaVersion: 1,
      templates: [
        SUPPLY_TEMPLATES[0],
        { ...SUPPLY_TEMPLATES[0] }, // duplicate id dropped
        { id: 'bad_tier', family: 'hp_kit', tier: 9 }, // invalid row dropped
        {
          id: 'bad_effect',
          family: 'sp_kit',
          tier: 1,
          unlockLevel: 1,
          iconId: 'SS02',
          effects: [],
          cooldownTurns: 2,
          perBattleLimit: 3,
        },
        SUPPLY_TEMPLATES[4],
      ],
    });
    expect(parsed.map((t) => t.id)).toEqual(['sup_hp_t1', 'sup_shield_t1']);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('2) computes all 12 supply prices strictly from formula and lets priceOverride win', () => {
    expect(PRICE_FORMULA.consumableBase).toEqual({
      hp_kit: 30,
      shield_kit: 30,
      sp_kit: 36,
      buff: 60,
    });

    const expected: Record<string, number> = {
      sup_hp_t1: 30,
      sup_hp_t2: 52,
      sup_hp_t3: 76,
      sup_hp_t4: 114,
      sup_shield_t1: 30,
      sup_shield_t2: 52,
      sup_shield_t3: 76,
      sup_shield_t4: 114,
      sup_sp_t1: 36,
      sup_sp_t2: 63,
      sup_sp_t3: 91,
      sup_sp_t4: 137,
    };

    for (const tpl of SUPPLY_TEMPLATES) {
      const base = PRICE_FORMULA.consumableBase[tpl.family];
      const factor = PRICE_FORMULA.tierFactor[tpl.tier - 1];
      const formulaPrice = Math.max(
        PRICE_FORMULA.minPrice,
        Math.round(base * factor)
      );
      expect(computeSupplyPrice(tpl)).toBe(formulaPrice);
      expect(computeSupplyPrice(tpl)).toBe(expected[tpl.id]);
    }

    expect(
      computeSupplyPrice({
        family: 'hp_kit',
        tier: 1,
        priceOverride: 275,
      })
    ).toBe(275);
  });

  it('3) merges battle_supply stacks by templateId capped at 99 while preserving existing 4 kinds', () => {
    const legacyCrate: ConsumableItem = {
      id: 'crate_1',
      kind: 'equipment_crate',
      quantity: 2,
      slot: 'main_weapon',
      minRarity: 'rare',
    };
    const merged = sanitizeConsumables([
      legacyCrate,
      { id: 's1', kind: 'battle_supply', templateId: 'sup_hp_t1', quantity: 60 },
      { id: 's2', kind: 'battle_supply', templateId: 'sup_hp_t1', quantity: 55 },
      { id: 'bad', kind: 'battle_supply', templateId: 'missing_tpl', quantity: 5 },
      { id: 'zero', kind: 'battle_supply', templateId: 'sup_sp_t1', quantity: 0 },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(legacyCrate);
    expect(merged[1]).toEqual({
      id: 's1',
      kind: 'battle_supply',
      templateId: 'sup_hp_t1',
      quantity: SUPPLY_STACK_CAP,
    });

    const added = addSupplyToConsumables(merged, 'sup_sp_t1', 120);
    expect(added.find((c) => c.templateId === 'sup_sp_t1')?.quantity).toBe(99);
  });

  it('4) bumps CURRENT_SAVE_VERSION to 11 and migrates old saves, loadouts, and admin defaults', () => {
    expect(CURRENT_SAVE_VERSION).toBe(11);

    const defAdmin = createDefaultAdminConfig();
    expect(defAdmin.supplyLoadoutSlots).toBe(DEFAULT_SUPPLY_LOADOUT_SLOTS);
    expect(defAdmin.supplyUsesPerTurn).toBe(DEFAULT_SUPPLY_USES_PER_TURN);

    const fresh = createFreshCampaignState('PilotCS1', 'striker');
    expect(fresh.pilot.gears.striker.supplyLoadout).toEqual([]);

    // Old v10 save without supplyLoadout or new admin fields -> gets [] & defaults
    const v10Stripped = {
      ...fresh,
      adminConfig: {
        ...fresh.adminConfig,
        supplyLoadoutSlots: undefined,
        supplyUsesPerTurn: undefined,
      },
      pilot: {
        ...fresh.pilot,
        gears: {
          ...fresh.pilot.gears,
          striker: {
            ...fresh.pilot.gears.striker,
            supplyLoadout: undefined,
          },
        },
      },
    };
    const migratedV10 = migrateSaveData(v10Stripped, 10);
    expect(migratedV10.pilot.gears.striker.supplyLoadout).toEqual([]);
    expect(migratedV10.adminConfig.supplyLoadoutSlots).toBe(4);
    expect(migratedV10.adminConfig.supplyUsesPerTurn).toBe(1);

    // Unknown templateIds dropped, duplicates removed, trimmed to clamped slots (2..8), usesPerTurn clamped (1..3)
    const dirtySave = {
      ...fresh,
      adminConfig: {
        ...fresh.adminConfig,
        supplyLoadoutSlots: 99, // clamps to 8
        supplyUsesPerTurn: 9, // clamps to 3
      },
      pilot: {
        ...fresh.pilot,
        gears: {
          ...fresh.pilot.gears,
          striker: {
            ...fresh.pilot.gears.striker,
            supplyLoadout: [
              'sup_hp_t1',
              'unknown_tpl',
              'sup_hp_t1',
              'sup_shield_t1',
              'sup_sp_t1',
              'sup_hp_t2',
              'sup_shield_t2',
              'sup_sp_t2',
              'sup_hp_t3',
              'sup_shield_t3',
              'sup_sp_t3',
            ],
          },
        },
      },
    };
    const migratedDirty = migrateSaveData(dirtySave, 11);
    expect(migratedDirty.adminConfig.supplyLoadoutSlots).toBe(8);
    expect(migratedDirty.adminConfig.supplyUsesPerTurn).toBe(3);
    expect(migratedDirty.pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_shield_t1',
      'sup_sp_t1',
      'sup_hp_t2',
      'sup_shield_t2',
      'sup_sp_t2',
      'sup_hp_t3',
      'sup_shield_t3',
    ]);

    // Min clamps: slots -> 2, usesPerTurn -> 1
    const minClamped = migrateSaveData(
      {
        ...fresh,
        adminConfig: {
          ...fresh.adminConfig,
          supplyLoadoutSlots: 0,
          supplyUsesPerTurn: 0,
        },
      },
      11
    );
    expect(minClamped.adminConfig.supplyLoadoutSlots).toBe(2);
    expect(minClamped.adminConfig.supplyUsesPerTurn).toBe(1);
  });

  it('5) enforces setSupplyLoadout rules (unknown/duplicate/over_slots) and base-only store wrapper', () => {
    const fresh = createFreshCampaignState('PilotLoadout', 'striker');
    const gear = fresh.pilot.gears.striker;

    const res = setSupplyLoadout(
      gear,
      [
        'sup_hp_t1',
        'bad_item',
        'sup_hp_t1',
        'sup_shield_t1',
        'sup_sp_t1',
      ],
      { supplyLoadoutSlots: 2 }
    );
    expect(res.gear.supplyLoadout).toEqual(['sup_hp_t1', 'sup_shield_t1']);
    expect(res.rejected).toEqual([
      { id: 'bad_item', reason: 'unknown' },
      { id: 'sup_hp_t1', reason: 'duplicate' },
      { id: 'sup_sp_t1', reason: 'over_slots' },
    ]);
    expect(gear.supplyLoadout).toEqual([]); // pure

    // Store wrapper: allowed at base, blocked during active battle or autoRepeat loop
    useGameStore.setState({
      ...fresh,
      battle: null,
      autoRepeatSession: null,
    });
    const baseRes = useGameStore
      .getState()
      .setSupplyLoadout('striker', ['sup_hp_t1', 'sup_sp_t1']);
    expect(baseRes).toEqual({ ok: true, rejected: [] });
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_sp_t1',
    ]);

    const battle = createInitialBattleState(
      useGameStore.getState().pilot,
      'aegis_relay',
      Math.random,
      undefined,
      useGameStore.getState().adminConfig
    );
    useGameStore.setState({ screen: 'BATTLE', battle });
    const inBattleRes = useGameStore
      .getState()
      .setSupplyLoadout('striker', ['sup_shield_t1']);
    expect(inBattleRes).toEqual({ ok: false, rejected: [], reason: 'locked' });
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_sp_t1',
    ]);

    useGameStore.setState({
      battle: null,
      autoRepeatSession: {
        active: true,
        limit: 5,
        sectorId: 'aegis_relay',
        completedRuns: 0,
        wins: 0,
        totalExp: 0,
        totalCredits: 0,
        totalWarPoints: 0,
        totalDrops: [],
        stopReason: null,
      },
    });
    const inLoopRes = useGameStore
      .getState()
      .setSupplyLoadout('striker', ['sup_shield_t1']);
    expect(inLoopRes).toEqual({ ok: false, rejected: [], reason: 'locked' });
    useGameStore.setState({ autoRepeatSession: null });
  });

  it('6) validates all 9 canUseSupply failure reasons + ok case + i18n reason formatting', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const shieldTpl = getSupplyTemplateById('sup_shield_t1')!;
    const spTpl = getSupplyTemplateById('sup_sp_t1')!;
    const baseState = {
      usedThisTurn: 0,
      usedCountsByTemplate: {},
      cooldownsByTemplate: {},
    };

    expect(
      canUseSupply({
        template: hpTpl,
        stock: 3,
        unit: makeDummyUnit(),
        supplyState: baseState,
        isOwnTurn: true,
      })
    ).toEqual({ ok: true, reason: null, reasonKey: null });

    expect(
      canUseSupply({
        template: hpTpl,
        stock: 3,
        unit: makeDummyUnit(),
        supplyState: baseState,
        isOwnTurn: false,
      }).reason
    ).toBe('not_your_turn');

    expect(
      canUseSupply({
        template: hpTpl,
        stock: 0,
        unit: makeDummyUnit(),
        supplyState: baseState,
        isOwnTurn: true,
      }).reason
    ).toBe('no_stock');

    expect(
      canUseSupply({
        template: hpTpl,
        stock: 3,
        unit: makeDummyUnit(),
        supplyState: { ...baseState, usedThisTurn: 1 },
        isOwnTurn: true,
        cfg: { supplyUsesPerTurn: 1 },
      }).reason
    ).toBe('turn_limit');

    const battleLimitRes = canUseSupply({
      template: hpTpl,
      stock: 3,
      unit: makeDummyUnit(),
      supplyState: {
        ...baseState,
        usedCountsByTemplate: { [hpTpl.id]: 3 },
      },
      isOwnTurn: true,
    });
    expect(battleLimitRes.reason).toBe('battle_limit');
    expect(
      translate(
        'vi',
        battleLimitRes.reasonKey as TranslateKey,
        battleLimitRes.params
      )
    ).toBe('Đã dùng 3/3');

    const cdRes = canUseSupply({
      template: hpTpl,
      stock: 3,
      unit: makeDummyUnit(),
      supplyState: {
        ...baseState,
        cooldownsByTemplate: { [hpTpl.id]: 2 },
      },
      isOwnTurn: true,
    });
    expect(cdRes.reason).toBe('cooldown');
    expect(translate('vi', cdRes.reasonKey as TranslateKey, cdRes.params)).toBe(
      'Hồi 2 lượt'
    );

    expect(
      canUseSupply({
        template: hpTpl,
        stock: 3,
        unit: makeDummyUnit({ hp: 500 }),
        supplyState: baseState,
        isOwnTurn: true,
      }).reason
    ).toBe('hp_full');

    expect(
      canUseSupply({
        template: shieldTpl,
        stock: 3,
        unit: makeDummyUnit({ shield: 200 }),
        supplyState: baseState,
        isOwnTurn: true,
      }).reason
    ).toBe('shield_full');

    expect(
      canUseSupply({
        template: spTpl,
        stock: 3,
        unit: makeDummyUnit({ sp: 100 }),
        supplyState: baseState,
        isOwnTurn: true,
      }).reason
    ).toBe('sp_full');

    const brokenRes = canUseSupply({
      template: shieldTpl,
      stock: 3,
      unit: makeDummyUnit({
        shield: 0,
        statuses: [
          {
            type: 'shield_break',
            turnsRemaining: 2,
          },
        ],
      }),
      supplyState: baseState,
      isOwnTurn: true,
    });
    expect(brokenRes.reason).toBe('shield_broken');
    expect(translate('vi', brokenRes.reasonKey as TranslateKey)).toBe(
      'Khiên bị phá'
    );
  });

  it('7) applySupplyEffects clamps to max pools, is pure, and yields 0 shield while shield_break is active', () => {
    const unit = makeDummyUnit({ hp: 460, shield: 170, sp: 85 });
    const resHp = applySupplyEffects(unit, [
      { kind: 'heal_hp_pct', value: 20 }, // 20% of 500 = 100 -> clamped to +40
    ]);
    expect(resHp.gains).toEqual({ hp: 40, shield: 0, sp: 0 });
    expect(resHp.unit.hp).toBe(500);
    expect(unit.hp).toBe(460); // pure

    const resMulti = applySupplyEffects(unit, [
      { kind: 'restore_shield_pct', value: 25 }, // 25% of 200 = 50 -> +30
      { kind: 'restore_sp_pct', value: 30 }, // 30% of 100 = 30 -> +15
    ]);
    expect(resMulti.gains).toEqual({ hp: 0, shield: 30, sp: 15 });
    expect(resMulti.unit.shield).toBe(200);
    expect(resMulti.unit.sp).toBe(100);

    const brokenUnit = makeDummyUnit({
      hp: 400,
      shield: 0,
      sp: 40,
      statuses: [
        {
          type: 'shield_break',
          turnsRemaining: 1,
        },
      ],
    });
    const resBroken = applySupplyEffects(brokenUnit, [
      { kind: 'restore_shield_pct', value: 45 },
      { kind: 'heal_hp_pct', value: 15 },
    ]);
    expect(resBroken.gains).toEqual({ hp: 75, shield: 0, sp: 0 });
    expect(resBroken.unit.shield).toBe(0);
    expect(resBroken.unit.hp).toBe(475);
  });

  it('8) round-trips save export/import at CURRENT_SAVE_VERSION = 11 with supply loadouts and stacks', async () => {
    const fresh = createFreshCampaignState('PilotExport', 'striker');
    fresh.pilot.gears.striker.supplyLoadout = ['sup_hp_t1', 'sup_sp_t1'];
    fresh.pilot.consumables = addSupplyToConsumables(
      fresh.pilot.consumables ?? [],
      'sup_hp_t1',
      12
    );
    fresh.adminConfig.supplyLoadoutSlots = 6;
    fresh.adminConfig.supplyUsesPerTurn = 2;

    const envelope = await buildExportEnvelope(fresh);
    expect(envelope.saveVersion).toBe(11);

    const parsed = await parseImportEnvelope(JSON.stringify(envelope));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const decrypted = await decryptEnvelope(parsed.envelope);
    expect(decrypted.ok).toBe(true);
    if (!decrypted.ok) return;

    const migrated = migrateSaveData(decrypted.state, envelope.saveVersion);
    expect(migrated.pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_sp_t1',
    ]);
    expect(migrated.pilot.consumables).toEqual([
      {
        id: 'supply_sup_hp_t1',
        kind: 'battle_supply',
        templateId: 'sup_hp_t1',
        quantity: 12,
      },
    ]);
    expect(migrated.adminConfig.supplyLoadoutSlots).toBe(6);
    expect(migrated.adminConfig.supplyUsesPerTurn).toBe(2);
  });

  it('9) maintains vi.ts / en.ts translation parity including all supply names & reason strings', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);

    expect(VI_TRANSLATIONS['supply.sup_hp_t1.name']).toBe('Bộ sửa chữa T1');
    expect(EN_TRANSLATIONS['supply.sup_hp_t1.name']).toBe('Repair Kit T1');
    expect(VI_TRANSLATIONS['supply.sup_shield_t1.name']).toContain('Bộ nạp khiên');
    expect(VI_TRANSLATIONS['supply.sup_sp_t1.name']).toContain('Pin SP');
  });
});
