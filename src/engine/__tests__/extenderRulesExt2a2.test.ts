import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import * as modulesData from '../../data/modules';
import { getModuleTemplateById } from '../../data/modules';
import { useGameStore } from '../../store/useGameStore';
import type { ItemInstance } from '../../types/game';
import {
  generateItemInstance,
  getItemEquippedByGear,
  getSellPrice,
  sumGearEquipmentStats,
  sumGearSpecialTraits,
} from '../equipment';
import {
  canEquipModule,
  clearModule,
  getUnlockedExtenderCount,
  setModule,
} from '../extenders';
import { createFreshCampaignState, migrateSaveData } from '../migration';
import {
  DEFAULT_QUICK_SELL_CONFIG,
  evaluateQuickSellCandidates,
} from '../quickSell';
import { calculateDerivedStats, calculateEffectiveStats } from '../stats';

function makeMod(instanceId: string, templateId: string): ItemInstance {
  return {
    ...generateItemInstance({ templateId }),
    instanceId,
  };
}

describe('TASK EXT2a-2 — instance-based module sockets & Save v13', () => {
  beforeEach(() => {
    useGameStore.getState().resetCampaign();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) unlock count by level/Admin n and all canEquipModule failure reasons including same_effect socket number', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    const gear = campaign.pilot.gears.striker;

    expect(getUnlockedExtenderCount({ level: 9 }, { extenderLevelsPerSocket: 10 })).toBe(0);
    expect(getUnlockedExtenderCount({ level: 10 }, { extenderLevelsPerSocket: 10 })).toBe(1);
    expect(getUnlockedExtenderCount({ level: 50 }, { extenderLevelsPerSocket: 10 })).toBe(5);
    expect(getUnlockedExtenderCount({ level: 12 }, { extenderLevelsPerSocket: 6 })).toBe(2);

    const modAtk1 = makeMod('mod_atk_1', 'mod_stat_attack_t1');
    const modAtk2 = makeMod('mod_atk_2', 'mod_stat_attack_t2');
    const modDef1 = makeMod('mod_def_1', 'mod_stat_defense_t1');
    const nonModule = generateItemInstance({ templateId: 'wpn_kinetic_t1' });
    nonModule.instanceId = 'non_module_wpn';
    campaign.pilot.inventory.push(modAtk1, modAtk2, modDef1, nonModule);

    expect(
      canEquipModule(campaign.pilot, 'striker', 0, modAtk1.instanceId, campaign.adminConfig).reason
    ).toBe('socket_locked');

    gear.level = 2;
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, modAtk2.instanceId, {
        extenderLevelsPerSocket: 2,
      }).reason
    ).toBe('level_too_low');

    gear.level = 20;
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, nonModule.instanceId, campaign.adminConfig).reason
    ).toBe('not_module');

    campaign.pilot.gears.interceptor.owned = true;
    campaign.pilot.gears.interceptor.level = 20;
    campaign.pilot.gears.interceptor.extenders = [modDef1.instanceId, null, null, null, null];
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, modDef1.instanceId, campaign.adminConfig).reason
    ).toBe('in_other_gear');

    gear.extenders = [modAtk1.instanceId, null, null, null, null];
    const sameEffect = canEquipModule(
      campaign.pilot,
      'striker',
      1,
      modAtk2.instanceId,
      campaign.adminConfig
    );
    expect(sameEffect.reason).toBe('same_effect');
    expect(sameEffect.conflictSocket).toBe(1);
    expect(sameEffect.reasonParams).toEqual({ socket: 1 });

    const origGetMod = modulesData.getModuleTemplateById;
    vi.spyOn(modulesData, 'getModuleTemplateById').mockImplementation((id) =>
      id === 'mod_skill_test'
        ? {
            id,
            nameVi: 'Skill',
            nameEn: 'Skill',
            descVi: 'd',
            descEn: 'd',
            iconId: 'shield_icon',
            family: 'skill',
            tier: 1,
            requiredLevel: 1,
            effectKey: 'sk_test',
            value: 0,
            skillId: 'sk_test',
            registryTag: 'sys',
          }
        : origGetMod(id)
    );
    const modSkill = { ...modAtk1, instanceId: 'mod_sk_1', templateId: 'mod_skill_test' };
    campaign.pilot.inventory.push(modSkill);
    expect(
      canEquipModule(campaign.pilot, 'striker', 1, modSkill.instanceId, {
        extenderLevelsPerSocket: 10,
        maxSkillModulesPerGear: 0,
      }).reason
    ).toBe('skill_limit');
  });

  it('2) setModule/clearModule work and socketed module cannot be sold or quick-sold', () => {
    const mod = makeMod('mod_sell_guard', 'mod_stat_attack_t1');
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, mod],
        gears: {
          ...s.pilot.gears,
          striker: { ...s.pilot.gears.striker, level: 10 },
        },
      },
    }));

    const eq = setModule(
      useGameStore.getState().pilot,
      'striker',
      0,
      mod.instanceId,
      useGameStore.getState().adminConfig
    );
    expect(eq.ok).toBe(true);
    expect(eq.pilot.gears.striker.extenders?.[0]).toBe(mod.instanceId);
    expect(getItemEquippedByGear(eq.pilot.gears, mod.instanceId)).toBe('striker');

    useGameStore.setState({ pilot: eq.pilot });
    expect(useGameStore.getState().sellItem(mod.instanceId).ok).toBe(false);

    const qs = evaluateQuickSellCandidates(
      eq.pilot.inventory,
      DEFAULT_QUICK_SELL_CONFIG,
      eq.pilot.gears.striker,
      eq.pilot.gears
    );
    expect(qs.matchingItems.some((it) => it.instanceId === mod.instanceId)).toBe(false);
    expect(qs.excludedStats.equipped).toBeGreaterThanOrEqual(1);

    const cleared = clearModule(eq.pilot, 'striker', 0);
    expect(cleared.ok).toBe(true);
    expect(cleared.pilot.gears.striker.extenders?.[0]).toBeNull();
    useGameStore.setState({ pilot: cleared.pilot });
    expect(useGameStore.getState().sellItem(mod.instanceId).ok).toBe(true);
  });

  it('3) stat + trait module instances affect derived stats; locked socket & missing id give 0 while keeping locked id', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    const gear = campaign.pilot.gears.striker;
    gear.level = 20;
    const modStat = makeMod('m_stat', 'mod_stat_attack_t2');
    const modTrait = makeMod('m_trait', 'mod_trait_critBonusPct_t4');
    const baseStats = sumGearEquipmentStats(gear, [modStat, modTrait], campaign.adminConfig);
    const baseTraits = sumGearSpecialTraits(gear, [modStat, modTrait], campaign.adminConfig);
    const baseDerived = calculateDerivedStats(
      gear.classId,
      gear.level,
      calculateEffectiveStats(gear.classId, gear.level, gear.allocatedPoints, EMPTY_STAT_BLOCK, baseStats, baseTraits),
      baseTraits
    );

    gear.extenders = [modStat.instanceId, modTrait.instanceId, 'missing_id', null, null];
    const modStats = sumGearEquipmentStats(gear, [modStat, modTrait], campaign.adminConfig);
    const modTraits = sumGearSpecialTraits(gear, [modStat, modTrait], campaign.adminConfig);
    const modDerived = calculateDerivedStats(
      gear.classId,
      gear.level,
      calculateEffectiveStats(gear.classId, gear.level, gear.allocatedPoints, EMPTY_STAT_BLOCK, modStats, modTraits),
      modTraits
    );
    expect(modStats.attack).toBe(baseStats.attack + 5);
    expect(modDerived.critChance).toBe(baseDerived.critChance + 5);

    gear.level = 10; // socket 1 is now locked, keeps id but gives 0 trait
    const lockedTraits = sumGearSpecialTraits(gear, [modStat, modTrait], campaign.adminConfig);
    expect(gear.extenders[1]).toBe(modTrait.instanceId);
    expect(lockedTraits.critBonusPct).toBe(baseTraits.critBonusPct);
  });

  it('4) migration v12 -> v13 converts stacks & template ids to instances, overflowing inventory -> warehouse -> CR', () => {
    const fresh = createFreshCampaignState('MigPilot', 'striker');
    const v12Save = JSON.parse(JSON.stringify(fresh));
    v12Save.adminConfig.boxCapacity = 20;
    v12Save.adminConfig.warehouseCapacity = 50;
    v12Save.adminConfig.extenderUnlockLevels = [5, 15, 25, 35, 45];
    delete v12Save.adminConfig.extenderLevelsPerSocket;

    while (v12Save.pilot.inventory.length < 19) {
      const filler = generateItemInstance({ templateId: 'wpn_kinetic_t1' });
      filler.instanceId = `fill_inv_${v12Save.pilot.inventory.length}`;
      v12Save.pilot.inventory.push(filler);
    }
    while (v12Save.pilot.warehouse.length < 49) {
      const filler = generateItemInstance({ templateId: 'wpn_kinetic_t1' });
      filler.instanceId = `fill_wh_${v12Save.pilot.warehouse.length}`;
      v12Save.pilot.warehouse.push(filler);
    }

    v12Save.pilot.credits = 1000;
    v12Save.pilot.gears.striker.level = 15; // 1 socket under default n=10
    v12Save.pilot.modules = [
      { templateId: 'mod_stat_attack_t1', count: 2 },
      { templateId: 'mod_stat_defense_t1', count: 1 },
    ];
    v12Save.pilot.gears.striker.extenders = [
      'mod_stat_attack_t1',
      'mod_stat_defense_t1', // socket 1 locked under n=10 -> dropped to null
      null,
      null,
      null,
    ];

    const migrated = migrateSaveData(v12Save, 12);
    expect('modules' in migrated.pilot).toBe(false);
    expect(migrated.adminConfig.extenderLevelsPerSocket).toBe(10);
    expect('extenderUnlockLevels' in migrated.adminConfig).toBe(false);
    expect(migrated.pilot.inventory).toHaveLength(20);
    expect(migrated.pilot.warehouse).toHaveLength(50);

    const expectedSellCr = getSellPrice(
      generateItemInstance({ templateId: 'mod_stat_defense_t1' })
    );
    expect(getModuleTemplateById('mod_stat_defense_t1')).toBeDefined();
    expect(migrated.pilot.credits).toBe(1000 + expectedSellCr);

    const invAtk = migrated.pilot.inventory.find(
      (it) => it.slot === 'module' && it.templateId === 'mod_stat_attack_t1'
    );
    expect(invAtk).toBeDefined();
    expect(migrated.pilot.gears.striker.extenders).toEqual([
      invAtk!.instanceId,
      null,
      null,
      null,
      null,
    ]);
  });

  it('5) setExtenderModule blocked during battle and auto-repeat loop', () => {
    const mod = makeMod('loop_mod', 'mod_stat_attack_t1');
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, mod],
        gears: {
          ...s.pilot.gears,
          striker: { ...s.pilot.gears.striker, level: 10 },
        },
      },
    }));

    expect(useGameStore.getState().setExtenderModule('striker', 0, mod.instanceId).ok).toBe(true);
    useGameStore.getState().startBattle('border_outpost');
    expect(useGameStore.getState().setExtenderModule('striker', 0, null).reason).toBe('locked');

    useGameStore.setState({
      battle: null,
      autoRepeatSession: {
        active: true,
        limit: 5,
        sectorId: 'border_outpost',
        completedRuns: 0,
        wins: 0,
        totalExp: 0,
        totalCredits: 0,
        totalWarPoints: 0,
        totalDrops: [],
        stopReason: null,
      },
    });
    expect(useGameStore.getState().setExtenderModule('striker', 0, null).reason).toBe('locked');
  });
});
