import { describe, expect, it, vi } from 'vitest';
import { SHOP_CONFIG } from '../../data/items';
import {
  getModuleTemplateById,
  MODULE_TEMPLATES,
  validateModuleTemplates,
} from '../../data/modules';
import { computeModulePrice, getModuleSellPrice } from '../itemPrice';
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

describe('TASK EXT1a-1 — Extender modules data, pricing, and Save v12 migration', () => {
  it('1) validator drops bad rows and duplicate ids; 36 shipped rows load with expected values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validated = validateModuleTemplates({
      schemaVersion: 1,
      modules: [
        MODULE_TEMPLATES[0],
        MODULE_TEMPLATES[0], // duplicate id
        { ...MODULE_TEMPLATES[0], id: 'bad_family', family: 'gadget' },
        { ...MODULE_TEMPLATES[0], id: 'bad_effect', effectKey: 'luck' },
        { ...MODULE_TEMPLATES[0], id: 'bad_tier', tier: 5 },
        { ...MODULE_TEMPLATES[0], id: 'bad_skill_prop', skillId: 'atk_basic' },
      ],
    });
    expect(validated).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    expect(MODULE_TEMPLATES).toHaveLength(36);
    expect(MODULE_TEMPLATES.filter((m) => m.family === 'stat')).toHaveLength(24);
    expect(MODULE_TEMPLATES.filter((m) => m.family === 'trait')).toHaveLength(12);
    expect(MODULE_TEMPLATES.filter((m) => m.family === 'skill')).toHaveLength(0);

    const atkT2 = getModuleTemplateById('mod_stat_attack_t2');
    expect(atkT2).toMatchObject({
      family: 'stat',
      tier: 2,
      requiredLevel: 3,
      effectKey: 'attack',
      value: 5,
      registryTag: 'sys',
    });

    const critT4 = getModuleTemplateById('mod_trait_critBonusPct_t4');
    expect(critT4).toMatchObject({
      family: 'trait',
      tier: 4,
      requiredLevel: 9,
      effectKey: 'critBonusPct',
      value: 5,
      registryTag: 'sys',
    });
  });

  it('2) price formula and sell ratio for stat and trait modules', () => {
    const statT2 = getModuleTemplateById('mod_stat_attack_t2')!;
    const traitT3 = getModuleTemplateById('mod_trait_armorPiercePct_t3')!;

    // stat: 120 * 1.74 = 208.8 -> 209; trait: 200 * 2.54 = 508
    expect(computeModulePrice(statT2)).toBe(209);
    expect(computeModulePrice(traitT3)).toBe(508);

    expect(getModuleSellPrice(statT2)).toBe(
      Math.round(209 * SHOP_CONFIG.sellPriceRatio)
    );
    expect(getModuleSellPrice(traitT3)).toBe(
      Math.round(508 * SHOP_CONFIG.sellPriceRatio)
    );
  });

  it('3) migration v11 -> v12 fills modules [], extenders 5x null, and default admin values', () => {
    expect(CURRENT_SAVE_VERSION).toBe(12);
    const fresh = createFreshCampaignState('PilotExt', 'striker');
    expect(fresh.pilot.modules).toEqual([]);
    expect(fresh.pilot.gears.striker.extenders).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(fresh.adminConfig.extenderUnlockLevels).toEqual([5, 15, 25, 35, 45]);
    expect(fresh.adminConfig.maxSkillModulesPerGear).toBe(1);

    const v11Payload = JSON.parse(JSON.stringify(fresh));
    delete v11Payload.pilot.modules;
    delete v11Payload.pilot.gears.striker.extenders;
    delete v11Payload.adminConfig.extenderUnlockLevels;
    delete v11Payload.adminConfig.maxSkillModulesPerGear;

    const migrated = migrateSaveData(v11Payload, 11);
    expect(migrated.pilot.modules).toEqual([]);
    expect(migrated.pilot.gears.striker.extenders).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(migrated.adminConfig.extenderUnlockLevels).toEqual([
      5, 15, 25, 35, 45,
    ]);
    expect(migrated.adminConfig.maxSkillModulesPerGear).toBe(1);
    expect(migrated.pilot.inventory).toHaveLength(fresh.pilot.inventory.length);
  });

  it('4) sanitizer cleans current-version save (duplicate merge, clamp, wrong length, unknown ids, bad admin levels)', () => {
    const fresh = createFreshCampaignState('PilotSan', 'striker');
    const dirtyCurrent = {
      ...fresh,
      pilot: {
        ...fresh.pilot,
        modules: [
          { templateId: 'mod_stat_attack_t1', count: 50 },
          { templateId: 'mod_stat_attack_t1', count: 80 }, // merge & clamp -> 99
          { templateId: 'mod_trait_accuracyPct_t2', count: 0 }, // clamp min 1
          { templateId: 'unknown_mod_id', count: 5 }, // dropped
        ],
        gears: {
          ...fresh.pilot.gears,
          striker: {
            ...fresh.pilot.gears.striker,
            extenders: [
              'mod_stat_attack_t1',
              'unknown_extender',
              'mod_trait_critBonusPct_t2',
            ], // short length 3 -> padded to 5 with unknown -> null
          },
          interceptor: {
            ...fresh.pilot.gears.interceptor,
            extenders: [
              'mod_stat_fuel_t1',
              null,
              'mod_stat_shield_t1',
              null,
              null,
              'mod_stat_attack_t4', // index 5 cut off
            ],
          },
        },
      },
      adminConfig: {
        ...createDefaultAdminConfig(),
        extenderUnlockLevels: [20, 10, 30, 40, 50], // non-monotonic -> default
        maxSkillModulesPerGear: 9, // clamped to 2
      },
    };

    const migrated = migrateSaveData(dirtyCurrent, CURRENT_SAVE_VERSION);
    expect(migrated.pilot.modules).toEqual([
      { templateId: 'mod_stat_attack_t1', count: 99 },
      { templateId: 'mod_trait_accuracyPct_t2', count: 1 },
    ]);
    expect(migrated.pilot.gears.striker.extenders).toEqual([
      'mod_stat_attack_t1',
      null,
      'mod_trait_critBonusPct_t2',
      null,
      null,
    ]);
    expect(migrated.pilot.gears.interceptor.extenders).toEqual([
      'mod_stat_fuel_t1',
      null,
      'mod_stat_shield_t1',
      null,
      null,
    ]);
    expect(migrated.adminConfig.extenderUnlockLevels).toEqual([
      5, 15, 25, 35, 45,
    ]);
    expect(migrated.adminConfig.maxSkillModulesPerGear).toBe(2);
  });

  it('5) SV1a export/import roundtrip keeps modules and extenders', async () => {
    const fresh = createFreshCampaignState('PilotRoundtrip', 'striker');
    fresh.pilot.modules = [
      { templateId: 'mod_stat_attack_t2', count: 4 },
      { templateId: 'mod_trait_critBonusPct_t3', count: 2 },
    ];
    fresh.pilot.gears.striker.extenders = [
      'mod_stat_attack_t2',
      'mod_trait_critBonusPct_t3',
      null,
      null,
      null,
    ];
    fresh.adminConfig.extenderUnlockLevels = [1, 10, 20, 30, 40];
    fresh.adminConfig.maxSkillModulesPerGear = 2;

    const envelope = await buildExportEnvelope(fresh);
    expect(envelope.saveVersion).toBe(12);

    const parsed = await parseImportEnvelope(JSON.stringify(envelope));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const decrypted = await decryptEnvelope(parsed.envelope);
    expect(decrypted.ok).toBe(true);
    if (!decrypted.ok) return;

    const migrated = migrateSaveData(
      decrypted.state,
      parsed.envelope.saveVersion
    );
    expect(migrated.pilot.modules).toEqual(fresh.pilot.modules);
    expect(migrated.pilot.gears.striker.extenders).toEqual(
      fresh.pilot.gears.striker.extenders
    );
    expect(migrated.adminConfig.extenderUnlockLevels).toEqual([
      1, 10, 20, 30, 40,
    ]);
    expect(migrated.adminConfig.maxSkillModulesPerGear).toBe(2);
  });
});
