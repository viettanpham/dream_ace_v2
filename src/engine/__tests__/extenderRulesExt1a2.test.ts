import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_CONFIG, COMBAT_FORMULAS } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import * as modulesData from '../../data/modules';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit, ItemInstance } from '../../types/game';
import {
  generateItemInstance,
  rollBattleItemDrops,
  sumGearEquipmentStats,
  sumGearSpecialTraits,
} from '../equipment';
import {
  addModuleToPilot,
  canEquipModule,
  getGearModuleSkillGrants,
  getUnlockedExtenderCount,
  MODULE_STACK_CAP,
  rollBattleModuleDrops,
  setModule,
} from '../extenders';
import { getModuleSellPrice } from '../itemPrice';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { getStatBreakdown } from '../statBreakdown';
import { calculateDerivedStats, calculateEffectiveStats } from '../stats';

function createSeededRng(seed = 123456789): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeEnemy(id: string, isBoss = false, alive = false): CombatUnit {
  return {
    id,
    name: id,
    callsign: id,
    side: 'enemy',
    row: 'front',
    isPlayer: false,
    isBoss,
    classId: 'striker',
    level: 5,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 100,
      maxShield: 0,
      maxSp: 50,
      speed: 10,
      attackPower: 10,
      defenseRating: 10,
      dodgeChance: 0,
      critChance: 0,
      skillPower: 10,
      armorPiercePct: 0,
      accuracyPct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: alive ? 100 : 0,
    shield: 0,
    sp: 0,
    alive,
    isDefending: false,
    statuses: [],
    animState: 'idle',
  };
}

describe('EXT1a-2 extender rules, stats, drops & store guard', () => {
  beforeEach(() => {
    useGameStore.getState().resetCampaign();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) unlock count by level/Admin and every canEquipModule failure reason', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    const striker = campaign.pilot.gears.striker;

    expect(getUnlockedExtenderCount({ ...striker, level: 1 }, campaign.adminConfig)).toBe(0);
    expect(getUnlockedExtenderCount({ ...striker, level: 5 }, campaign.adminConfig)).toBe(1);
    expect(getUnlockedExtenderCount({ ...striker, level: 15 }, campaign.adminConfig)).toBe(2);
    expect(getUnlockedExtenderCount({ ...striker, level: 45 }, campaign.adminConfig)).toBe(5);
    expect(
      getUnlockedExtenderCount(
        { ...striker, level: 5 },
        { ...campaign.adminConfig, extenderUnlockLevels: [1, 2, 10, 20, 30] }
      )
    ).toBe(2);

    campaign.pilot.modules = [
      { templateId: 'mod_stat_attack_t1', count: 1 },
      { templateId: 'mod_stat_attack_t2', count: 1 },
    ];
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, 'mod_stat_attack_t1', campaign.adminConfig).reason
    ).toBe('socket_locked');

    campaign.pilot.gears.striker.level = 2;
    const customAdmin = {
      ...campaign.adminConfig,
      extenderUnlockLevels: [1, 15, 25, 35, 45],
    };
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, 'mod_stat_attack_t2', customAdmin).reason
    ).toBe('level_too_low');

    campaign.pilot.gears.striker.level = 15;
    campaign.pilot.modules = [];
    expect(
      canEquipModule(campaign.pilot, 'striker', 0, 'mod_stat_attack_t1', campaign.adminConfig).reason
    ).toBe('not_owned');

    campaign.pilot.modules = [
      { templateId: 'mod_stat_attack_t1', count: 1 },
      { templateId: 'mod_stat_attack_t2', count: 1 },
    ];
    campaign.pilot.gears.striker.extenders = ['mod_stat_attack_t1', null, null, null, null];
    expect(
      canEquipModule(campaign.pilot, 'striker', 1, 'mod_stat_attack_t2', campaign.adminConfig).reason
    ).toBe('same_effect');

    expect(getGearModuleSkillGrants(campaign.pilot.gears.striker, campaign.adminConfig)).toEqual([]);
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
    campaign.pilot.modules.push({ templateId: 'mod_skill_test_t1', count: 1 });
    expect(
      canEquipModule(
        campaign.pilot,
        'striker',
        1,
        'mod_skill_test_t1',
        { ...campaign.adminConfig, maxSkillModulesPerGear: 0 }
      ).reason
    ).toBe('skill_limit');

    for (const key of [
      'extender.reason.socket_locked',
      'extender.reason.level_too_low',
      'extender.reason.not_owned',
      'extender.reason.same_effect',
      'extender.reason.skill_limit',
      'extender.reason.locked',
    ] as const) {
      expect(VI_TRANSLATIONS[key]).toBeTruthy();
      expect(EN_TRANSLATIONS[key]).toBeTruthy();
    }
  });

  it('2) shared owned count across gears and sanitizer cleans over-owned & same-effect refs', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    campaign.pilot.gears.striker.level = 25;
    campaign.pilot.gears.interceptor.owned = true;
    campaign.pilot.gears.interceptor.level = 25;
    campaign.pilot.modules = [
      { templateId: 'mod_stat_attack_t1', count: 1 },
      { templateId: 'mod_stat_attack_t2', count: 1 },
      { templateId: 'mod_stat_defense_t1', count: 1 },
    ];

    const equipped = setModule(
      campaign.pilot,
      'striker',
      0,
      'mod_stat_attack_t1',
      campaign.adminConfig
    );
    expect(equipped.ok).toBe(true);
    expect(
      canEquipModule(
        equipped.pilot,
        'interceptor',
        0,
        'mod_stat_attack_t1',
        campaign.adminConfig
      ).reason
    ).toBe('not_owned');

    const rawSave = {
      adminConfig: campaign.adminConfig,
      pilot: {
        ...equipped.pilot,
        gears: {
          ...equipped.pilot.gears,
          striker: {
            ...equipped.pilot.gears.striker,
            extenders: [
              'mod_stat_attack_t1',
              'mod_stat_attack_t2',
              'mod_stat_defense_t1',
              null,
              null,
            ],
          },
          interceptor: {
            ...equipped.pilot.gears.interceptor,
            extenders: [
              'mod_stat_attack_t1',
              'mod_stat_defense_t1',
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
      'mod_stat_attack_t1',
      null,
      'mod_stat_defense_t1',
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

  it('3) unlocked stat + trait modules affect derived/breakdown stats, locked gives 0, caps hold', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker');
    const gear = campaign.pilot.gears.striker;
    gear.level = 50;
    const baseBonuses = sumGearEquipmentStats(gear, [], campaign.adminConfig);
    const baseTraits = sumGearSpecialTraits(gear, [], campaign.adminConfig);
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

    gear.extenders = [
      'mod_stat_attack_t2',
      'mod_trait_accuracyPct_t4',
      'mod_trait_spRegenPerTurn_t3',
      'mod_trait_critBonusPct_t4',
      'mod_trait_armorPiercePct_t4',
    ];
    const modBonuses = sumGearEquipmentStats(gear, [], campaign.adminConfig);
    const modTraits = sumGearSpecialTraits(gear, [], campaign.adminConfig);
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
    const partialBonuses = sumGearEquipmentStats(gear, [], campaign.adminConfig);
    const partialTraits = sumGearSpecialTraits(gear, [], campaign.adminConfig);
    expect(gear.extenders[1]).toBe('mod_trait_accuracyPct_t4');
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
    const cappedTraits = sumGearSpecialTraits(gear, [overCapItem], campaign.adminConfig);
    const cappedDerived = calculateDerivedStats(gear.classId, gear.level, modEffective, cappedTraits);
    expect(cappedDerived.accuracyPct).toBe(BALANCE_CONFIG.maxAccuracyPct);
    expect(cappedDerived.critChance).toBe(COMBAT_FORMULAS.maxCritChance);
    expect(cappedDerived.armorPiercePct).toBe(50);
  });

  it('4) module drops respect difficulty/boss/loss, max 1, tier cap, cap 99 -> CR, and keep item drops identical', () => {
    const enemies = [makeEnemy('e1', false, false)];
    const bossEnemies = [makeEnemy('b1', true, false)];

    const countDrops = (list: CombatUnit[], sectorId: string, won: boolean, runs = 2000) => {
      const rng = createSeededRng(777);
      let drops = 0;
      for (let i = 0; i < runs; i++) {
        const res = rollBattleModuleDrops(list, sectorId, 1, won, rng);
        expect(res.length).toBeLessThanOrEqual(1);
        for (const d of res) {
          const tpl = modulesData.getModuleTemplateById(d.templateId)!;
          expect(tpl.family === 'stat' || tpl.family === 'trait').toBe(true);
          if (tpl.family === 'trait') expect(tpl.tier).toBeGreaterThanOrEqual(2);
          if (sectorId === 'border_outpost') expect(tpl.tier).toBeLessThanOrEqual(2);
        }
        drops += res.length;
      }
      return drops / runs;
    };

    const stdWinRate = countDrops(enemies, 'border_outpost', true);
    const hardWinRate = countDrops(enemies, 'debris_belt', true);
    const eliteWinRate = countDrops(enemies, 'iron_citadel', true);
    const bossRate = countDrops(bossEnemies, 'border_outpost', true);
    const stdLossRate = countDrops(enemies, 'border_outpost', false);

    expect(stdWinRate).toBeGreaterThan(0.04);
    expect(stdWinRate).toBeLessThan(0.08);
    expect(hardWinRate).toBeGreaterThan(stdWinRate);
    expect(eliteWinRate).toBeGreaterThan(hardWinRate);
    expect(bossRate).toBeGreaterThan(0.32);
    expect(stdLossRate).toBeLessThan(stdWinRate);

    const rngA = createSeededRng(424242);
    const itemsOnly = rollBattleItemDrops(enemies, 'debris_belt', 6, true, rngA);
    const rngB = createSeededRng(424242);
    const itemsWithModAfter = rollBattleItemDrops(enemies, 'debris_belt', 6, true, rngB);
    rollBattleModuleDrops(enemies, 'debris_belt', 6, true, rngB);
    expect(itemsWithModAfter.map((x) => x.templateId)).toEqual(
      itemsOnly.map((x) => x.templateId)
    );

    const campaign = createFreshCampaignState('Pilot', 'striker');
    const tpl = modulesData.getModuleTemplateById('mod_stat_attack_t2')!;
    campaign.pilot.credits = 100;
    campaign.pilot.modules = [{ templateId: tpl.id, count: MODULE_STACK_CAP }];
    const added = addModuleToPilot(campaign.pilot, tpl.id, 1);
    expect(added.overflow).toBe(1);
    expect(added.creditsGained).toBe(getModuleSellPrice(tpl));
    expect(added.pilot.credits).toBe(100 + getModuleSellPrice(tpl));
    expect(added.pilot.modules).toEqual([{ templateId: tpl.id, count: MODULE_STACK_CAP }]);
  });

  it('5) setExtenderModule works out of battle and is blocked in battle and auto-repeat', () => {
    const store = useGameStore.getState();
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        modules: [{ templateId: 'mod_stat_attack_t1', count: 1 }],
        gears: {
          ...s.pilot.gears,
          striker: { ...s.pilot.gears.striker, level: 5 },
        },
      },
    }));

    expect(store.setExtenderModule('striker', 0, 'mod_stat_attack_t1').ok).toBe(true);
    expect(useGameStore.getState().pilot.gears.striker.extenders?.[0]).toBe('mod_stat_attack_t1');

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
        totalModuleDrops: [],
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
