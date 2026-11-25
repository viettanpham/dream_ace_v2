import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_CONFIG, COMBAT_FORMULAS } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import * as modulesData from '../../data/modules';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { ItemInstance } from '../../types/game';
import {
  generateItemInstance,
  sumGearEquipmentStats,
  sumGearSpecialTraits,
} from '../equipment';
import {
  canEquipModule,
  getGearModuleSkillGrants,
  getUnlockedExtenderCount,
  setModule,
} from '../extenders';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { getStatBreakdown } from '../statBreakdown';
import { calculateDerivedStats, calculateEffectiveStats } from '../stats';

function makeModInstance(instanceId: string, templateId: string): ItemInstance {
  return {
    ...generateItemInstance({ templateId }),
    instanceId,
  };
}

describe('EXT1a-2 extender rules, stats & store guard (converted to instance sockets)', () => {
  beforeEach(() => {
    useGameStore.getState().resetCampaign();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) unlock count by level/Admin and every canEquipModule failure reason', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    const striker = campaign.pilot.gears.striker;

    expect(getUnlockedExtenderCount({ ...striker, level: 9 }, campaign.adminConfig)).toBe(0);
    expect(getUnlockedExtenderCount({ ...striker, level: 10 }, campaign.adminConfig)).toBe(1);
    expect(getUnlockedExtenderCount({ ...striker, level: 20 }, campaign.adminConfig)).toBe(2);
    expect(getUnlockedExtenderCount({ ...striker, level: 50 }, campaign.adminConfig)).toBe(5);
    expect(
      getUnlockedExtenderCount(
        { ...striker, level: 10 },
        { ...campaign.adminConfig, extenderLevelsPerSocket: 5 }
      )
    ).toBe(2);

    const modAtk1 = makeModInstance('m_atk1', 'mod_stat_attack_t1');
    const modAtk2 = makeModInstance('m_atk2', 'mod_stat_attack_t2');
    campaign.pilot.inventory.push(modAtk1, modAtk2);

    expect(
      canEquipModule(campaign.pilot, 'striker', 0, modAtk1.instanceId, campaign.adminConfig).reason
    ).toBe('socket_locked');

    campaign.pilot.gears.striker.level = 2;
    const customAdmin = {
      ...campaign.adminConfig,
      extenderLevelsPerSocket: 2,
    };
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, modAtk2.instanceId, customAdmin).reason
    ).toBe('level_too_low');

    campaign.pilot.gears.striker.level = 20;
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, 'missing_mod', campaign.adminConfig).reason
    ).toBe('not_module');

    campaign.pilot.gears.striker.extenders = [modAtk1.instanceId, null, null, null, null];
    const sameEffect = canEquipModule(
      campaign.pilot,
      'striker',
      1,
      modAtk2.instanceId,
      campaign.adminConfig
    );
    expect(sameEffect.reason).toBe('same_effect');
    expect(sameEffect.conflictSocket).toBe(1);

    expect(
      getGearModuleSkillGrants(
        campaign.pilot.gears.striker,
        campaign.pilot.inventory,
        campaign.adminConfig
      )
    ).toEqual([]);

    const origGetMod = modulesData.getModuleTemplateById;
    vi.spyOn(modulesData, 'getModuleTemplateById').mockImplementation((id) => {
      if (id === 'mod_skill_test_t1') {
        return {
          id,
          nameVi: 'Kỹ năng thử',
          nameEn: 'Test Skill',
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
        };
      }
      return origGetMod(id);
    });
    const modSkill: ItemInstance = {
      ...modAtk1,
      instanceId: 'm_skill_1',
      templateId: 'mod_skill_test_t1',
    };
    campaign.pilot.inventory.push(modSkill);
    expect(
      canEquipModule(
        campaign.pilot,
        'striker',
        1,
        modSkill.instanceId,
        { ...campaign.adminConfig, maxSkillModulesPerGear: 0 }
      ).reason
    ).toBe('skill_limit');

    for (const key of [
      'extender.reason.socket_locked',
      'extender.reason.level_too_low',
      'extender.reason.not_module',
      'extender.reason.in_other_gear',
      'extender.reason.same_effect',
      'extender.reason.skill_limit',
      'extender.reason.locked',
    ] as const) {
      expect(VI_TRANSLATIONS[key]).toBeTruthy();
      expect(EN_TRANSLATIONS[key]).toBeTruthy();
    }
  });

  it('2) single-owner instance across gears and sanitizer cleans duplicate & same-effect refs', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    campaign.pilot.gears.striker.level = 30;
    campaign.pilot.gears.interceptor.owned = true;
    campaign.pilot.gears.interceptor.level = 30;
    const modAtk1 = makeModInstance('m_atk1', 'mod_stat_attack_t1');
    const modAtk2 = makeModInstance('m_atk2', 'mod_stat_attack_t2');
    const modDef1 = makeModInstance('m_def1', 'mod_stat_defense_t1');
    campaign.pilot.inventory.push(modAtk1, modAtk2, modDef1);

    const equipped = setModule(
      campaign.pilot,
      'striker',
      0,
      modAtk1.instanceId,
      campaign.adminConfig
    );
    expect(equipped.ok).toBe(true);
    expect(
      canEquipModule(
        equipped.pilot,
        'interceptor',
        0,
        modAtk1.instanceId,
        campaign.adminConfig
      ).reason
    ).toBe('in_other_gear');

    const rawSave = {
      adminConfig: campaign.adminConfig,
      pilot: {
        ...equipped.pilot,
        gears: {
          ...equipped.pilot.gears,
          striker: {
            ...equipped.pilot.gears.striker,
            extenders: [
              modAtk1.instanceId,
              modAtk2.instanceId,
              modDef1.instanceId,
              null,
              null,
            ],
          },
          interceptor: {
            ...equipped.pilot.gears.interceptor,
            extenders: [
              modAtk1.instanceId,
              modDef1.instanceId,
              null,
              null,
              null,
            ],
          },
        },
      },
    };
    const migrated = migrateSaveData(rawSave, CURRENT_SAVE_VERSION);
    expect(migrated.pilot.gears.striker.extenders).toEqual([
      modAtk1.instanceId,
      null,
      modDef1.instanceId,
      null,
      null,
    ]);
    expect(migrated.pilot.gears.interceptor.extenders).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('3) unlocked stat + trait module instances affect derived/breakdown stats, locked gives 0, caps hold', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    const gear = campaign.pilot.gears.striker;
    gear.level = 50;
    const mods = [
      makeModInstance('m1', 'mod_stat_attack_t2'),
      makeModInstance('m2', 'mod_trait_accuracyPct_t4'),
      makeModInstance('m3', 'mod_trait_spRegenPerTurn_t3'),
      makeModInstance('m4', 'mod_trait_critBonusPct_t4'),
      makeModInstance('m5', 'mod_trait_armorPiercePct_t4'),
    ];
    const baseBonuses = sumGearEquipmentStats(gear, mods, campaign.adminConfig);
    const baseTraits = sumGearSpecialTraits(gear, mods, campaign.adminConfig);
    const baseEffective = calculateEffectiveStats(
      gear.classId,
      gear.level,
      gear.allocatedPoints,
      EMPTY_STAT_BLOCK,
      baseBonuses,
      baseTraits
    );
    const baseDerived = calculateDerivedStats(
      gear.classId,
      gear.level,
      baseEffective,
      baseTraits
    );

    gear.extenders = mods.map((m) => m.instanceId);
    const modBonuses = sumGearEquipmentStats(gear, mods, campaign.adminConfig);
    const modTraits = sumGearSpecialTraits(gear, mods, campaign.adminConfig);
    const modEffective = calculateEffectiveStats(
      gear.classId,
      gear.level,
      gear.allocatedPoints,
      EMPTY_STAT_BLOCK,
      modBonuses,
      modTraits
    );
    const modDerived = calculateDerivedStats(
      gear.classId,
      gear.level,
      modEffective,
      modTraits
    );
    const breakdown = getStatBreakdown(gear, modBonuses, modTraits);

    expect(modBonuses.attack).toBe(baseBonuses.attack + 5);
    expect(breakdown.attack.equipment).toBe(baseBonuses.attack + 5);
    expect(modDerived.accuracyPct ?? 0).toBe((baseDerived.accuracyPct ?? 0) + 6);
    expect(modDerived.spRegenPerTurn).toBe(baseDerived.spRegenPerTurn + 2);
    expect(modDerived.critChance).toBe(baseDerived.critChance + 5);
    expect(modDerived.armorPiercePct).toBe(baseDerived.armorPiercePct + 8);

    gear.level = 10;
    const partialBonuses = sumGearEquipmentStats(gear, mods, campaign.adminConfig);
    const partialTraits = sumGearSpecialTraits(gear, mods, campaign.adminConfig);
    expect(gear.extenders[1]).toBe('m2');
    expect(partialBonuses.attack).toBe(baseBonuses.attack + 5);
    expect(partialTraits.accuracyPct).toBe(0);
    expect(partialTraits.spRegenPerTurn).toBe(0);

    gear.level = 50;
    const overCapItem: ItemInstance = {
      ...generateItemInstance({ templateId: 'radar_recon_t4', tier: 4, rarity: 'legendary' }),
      instanceId: 'test_overcap_radar',
      specialTraits: { accuracyPct: 28, critBonusPct: 90, armorPiercePct: 48 },
    };
    gear.equipped.radar = overCapItem.instanceId;
    const cappedTraits = sumGearSpecialTraits(gear, [...mods, overCapItem], campaign.adminConfig);
    const cappedDerived = calculateDerivedStats(gear.classId, gear.level, modEffective, cappedTraits);
    expect(cappedDerived.accuracyPct).toBe(BALANCE_CONFIG.maxAccuracyPct);
    expect(cappedDerived.critChance).toBe(COMBAT_FORMULAS.maxCritChance);
    expect(cappedDerived.armorPiercePct).toBe(50);
  });

  it('5) setExtenderModule works out of battle and is blocked in battle and auto-repeat', () => {
    const store = useGameStore.getState();
    const modAtk1 = makeModInstance('store_mod_atk1', 'mod_stat_attack_t1');
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, modAtk1],
        gears: {
          ...s.pilot.gears,
          striker: { ...s.pilot.gears.striker, level: 10 },
        },
      },
    }));

    expect(store.setExtenderModule('striker', 0, modAtk1.instanceId).ok).toBe(true);
    expect(useGameStore.getState().pilot.gears.striker.extenders?.[0]).toBe(modAtk1.instanceId);

    store.startBattle('border_outpost');
    const inBattleRes = useGameStore
      .getState()
      .setExtenderModule('striker', 0, null);
    expect(inBattleRes.ok).toBe(false);
    expect(inBattleRes.reason).toBe('locked');

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
    const inLoopRes = useGameStore
      .getState()
      .setExtenderModule('striker', 0, null);
    expect(inLoopRes.ok).toBe(false);
    expect(inLoopRes.reason).toBe('locked');
  });
});
