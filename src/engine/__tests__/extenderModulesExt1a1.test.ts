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

  it('3) migration v12 -> v13 converts stacks/extenders, drops pilot.modules & extenderUnlockLevels, and fills default admin values', () => {
    expect(CURRENT_SAVE_VERSION).toBe(13);
    const fresh = createFreshCampaignState('PilotExt', 'striker');
    expect('modules' in fresh.pilot).toBe(false);
    expect(fresh.pilot.gears.striker.extenders).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(fresh.adminConfig.extenderLevelsPerSocket).toBe(10);
    expect(fresh.adminConfig.maxSkillModulesPerGear).toBe(1);

    const v12Payload = JSON.parse(JSON.stringify(fresh));
    v12Payload.pilot.gears.striker.level = 10;
    v12Payload.pilot.modules = [{ templateId: 'mod_stat_attack_t1', count: 1 }];
    v12Payload.pilot.gears.striker.extenders = [
      'mod_stat_attack_t1',
      null,
      null,
      null,
      null,
    ];
    v12Payload.adminConfig.extenderUnlockLevels = [5, 15, 25, 35, 45];
    delete v12Payload.adminConfig.extenderLevelsPerSocket;
    delete v12Payload.adminConfig.maxSkillModulesPerGear;

    const migrated = migrateSaveData(v12Payload, 12);
    expect('modules' in migrated.pilot).toBe(false);
    expect('extenderUnlockLevels' in migrated.adminConfig).toBe(false);
    expect(migrated.adminConfig.extenderLevelsPerSocket).toBe(10);
    expect(migrated.adminConfig.maxSkillModulesPerGear).toBe(1);
    const createdMod = migrated.pilot.inventory.find(
      (it) => it.slot === 'module' && it.templateId === 'mod_stat_attack_t1'
    );
    expect(createdMod).toBeDefined();
    expect(migrated.pilot.gears.striker.extenders).toEqual([
      createdMod!.instanceId,
      null,
      null,
      null,
      null,
    ]);
  });

  it('4) sanitizer cleans current-version save (unknown/non-module/duplicate instance ids, wrong length, bad admin levels)', () => {
    const fresh = createFreshCampaignState('PilotSan', 'striker');
    const modAtk = fresh.pilot.inventory[0]; // non-module starter item
    const modA = {
      ...modAtk,
      instanceId: 'mod_inst_a',
      templateId: 'mod_stat_attack_t1',
      slot: 'module' as const,
      classRestriction: null,
    };
    const modB = {
      ...modAtk,
      instanceId: 'mod_inst_b',
      templateId: 'mod_trait_critBonusPct_t2',
      slot: 'module' as const,
      classRestriction: null,
    };
    const modC = {
      ...modAtk,
      instanceId: 'mod_inst_c',
      templateId: 'mod_stat_fuel_t1',
      slot: 'module' as const,
      classRestriction: null,
    };

    const dirtyCurrent = {
      ...fresh,
      pilot: {
        ...fresh.pilot,
        inventory: [...fresh.pilot.inventory, modA, modB, modC],
        gears: {
          ...fresh.pilot.gears,
          striker: {
            ...fresh.pilot.gears.striker,
            extenders: [
              modA.instanceId,
              modAtk.instanceId, // non-module -> dropped
              'unknown_extender_id', // unknown -> dropped
              modB.instanceId,
            ], // short length 4 -> padded to 5
          },
          interceptor: {
            ...fresh.pilot.gears.interceptor,
            extenders: [
              modA.instanceId, // duplicate across gears -> dropped
              modC.instanceId,
              null,
              null,
              null,
              modB.instanceId, // index 5 cut off
            ],
          },
        },
      },
      adminConfig: {
        ...createDefaultAdminConfig(),
        extenderLevelsPerSocket: 99, // clamped to 50
        maxSkillModulesPerGear: 9, // clamped to 2
      },
    };

    const migrated = migrateSaveData(dirtyCurrent, CURRENT_SAVE_VERSION);
    expect(migrated.pilot.gears.striker.extenders).toEqual([
      modA.instanceId,
      null,
      null,
      modB.instanceId,
      null,
    ]);
    expect(migrated.pilot.gears.interceptor.extenders).toEqual([
      null,
      modC.instanceId,
      null,
      null,
      null,
    ]);
    expect(migrated.adminConfig.extenderLevelsPerSocket).toBe(50);
    expect(migrated.adminConfig.maxSkillModulesPerGear).toBe(2);
  });

  it('5) SV1a export/import roundtrip keeps module instances and extenders', async () => {
    const fresh = createFreshCampaignState('PilotRoundtrip', 'striker');
    const modA = {
      ...fresh.pilot.inventory[0],
      instanceId: 'rt_mod_atk',
      templateId: 'mod_stat_attack_t2',
      slot: 'module' as const,
      classRestriction: null,
    };
    const modB = {
      ...fresh.pilot.inventory[0],
      instanceId: 'rt_mod_crit',
      templateId: 'mod_trait_critBonusPct_t3',
      slot: 'module' as const,
      classRestriction: null,
    };
    fresh.pilot.inventory.push(modA, modB);
    fresh.pilot.gears.striker.extenders = [
      modA.instanceId,
      modB.instanceId,
      null,
      null,
      null,
    ];
    fresh.adminConfig.extenderLevelsPerSocket = 8;
    fresh.adminConfig.maxSkillModulesPerGear = 2;

    const envelope = await buildExportEnvelope(fresh);
    expect(envelope.saveVersion).toBe(13);

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
    expect(migrated.pilot.gears.striker.extenders).toEqual(
      fresh.pilot.gears.striker.extenders
    );
    expect(migrated.adminConfig.extenderLevelsPerSocket).toBe(8);
    expect(migrated.adminConfig.maxSkillModulesPerGear).toBe(2);
  });
});
