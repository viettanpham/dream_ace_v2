import { describe, expect, it } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { EMPTY_STAT_BLOCK, MECH_CLASSES } from '../../data/classes';
import { EQUIPMENT_SLOTS, ITEM_TEMPLATES } from '../../data/items';
import {
  getBattleSizeForBaseType,
  getSectorById,
  getTokenShapeForBaseType,
  SECTORS_CATALOG,
} from '../../data/maps';
import {
  getScaledSkillStats,
  getSkillById,
  OPENING_CARDS_LIST,
  SKILLS_LIST,
} from '../../data/skills';
import type {
  AutoRepeatSession,
  BattleState,
  CombatUnit,
  GearTacticsProfile,
  ItemRarity,
} from '../../types/game';
import { aggregateBattleStats } from '../battleStats';
import {
  buildTurnQueue,
  calculateBattleRewards,
  calculateSingleEnemyReward,
  chooseAiDecision,
  createInitialBattleState,
  createRoundHpSnapshot,
  getAdjacentUnits,
  getEffectiveUnitSpeed,
  getEnemyEnrageBonusPct,
  getValidEnemyTargets,
  hasStatus,
  isLongRangeAction,
  reconcileRemainingTurnOrder,
  resolveUnitAction,
  sortTurnOrder,
} from '../combat';
import {
  equipItemOnGear,
  generateItemInstance,
  generateShopStock,
  getEffectiveItemStats,
  getItemEquippedByGear,
  sumGearEquipmentStats,
  sumGearSpecialTraits,
  unequipSlotOnGear,
  validateEquipOnGear,
} from '../equipment';
import {
  advanceCampaignMonth,
  applyBattleBaseConsequences,
  getBaseMonthlyIncome,
  getBaseState,
  hirePilotForNextBattle,
  isBaseServicesAvailable,
  startBaseRepair,
} from '../mapWorld';
import { createDefaultAdminConfig, migrateSaveData } from '../migration';
import {
  buyOpeningCard,
  canUnitUseSkill,
  equipSkillToGearBar,
  getGearPassiveBonuses,
  getRequiredGearLevelForSkillLevel,
  getSkillsForClass,
  learnOrUpgradeSkillOnGear,
  MAX_ACTIVE_SKILL_BAR,
  unequipSkillFromGearBar,
  validateEquipSkillOnBar,
  validateLearnOrUpgradeSkill,
} from '../skills';
import {
  allocateGearStats,
  applyExpToGear,
  calculateDerivedStats,
  calculateEffectiveStats,
  createDefaultPilotAccount,
  estimateBattlesToNextLevel,
  getExpForNextLevel,
  resetGearStatAllocations,
} from '../stats';
import {
  chooseAction,
  createDefaultAutoSafety,
  createPresetTactics,
  createSimplePresetConfig,
  evaluateAutoSafety,
  generateTacticsFromSimple,
  sanitizeGearTactics,
  shouldStopAutoRepeat,
} from '../tactics';

function createSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const val = values[idx % values.length];
    idx += 1;
    return val;
  };
}

describe('1. Per-Gear Leveling & Progression', () => {
  it('computes EXP curve as Math.round(60 * level^1.4)', () => {
    expect(getExpForNextLevel(1)).toBe(60);
    expect(getExpForNextLevel(2)).toBe(Math.round(60 * Math.pow(2, 1.4)));
    expect(getExpForNextLevel(3)).toBe(Math.round(60 * Math.pow(3, 1.4)));
    expect(getExpForNextLevel(4)).toBe(Math.round(60 * Math.pow(4, 1.4)));
    expect(getExpForNextLevel(5)).toBe(Math.round(60 * Math.pow(5, 1.4)));
  });

  it('awards +3 stat points per level ONLY to the leveled Gear and leaves other Gears untouched', () => {
    const pilot = createDefaultPilotAccount('Kira', 'striker');
    pilot.gears.interceptor.owned = true;

    const strikerBefore = pilot.gears.striker;
    const interceptorBefore = { ...pilot.gears.interceptor };

    const res = applyExpToGear(strikerBefore, 230, { won: true });
    expect(res.leveledUp).toBe(true);
    expect(res.previousLevel).toBe(1);
    expect(res.newLevel).toBe(3);
    expect(res.statPointsGained).toBe(6);
    expect(res.updatedGear.unspentPoints).toBe(
      BALANCE_CONFIG.initialStatPoints + 6
    );
    expect(res.updatedGear.exp).toBe(12);
    expect(res.updatedGear.battlesFought).toBe(1);
    expect(res.updatedGear.battlesWon).toBe(1);

    expect(pilot.gears.interceptor.level).toBe(interceptorBefore.level);
    expect(pilot.gears.interceptor.exp).toBe(0);
    expect(pilot.gears.interceptor.unspentPoints).toBe(
      BALANCE_CONFIG.initialStatPoints
    );
  });

  it('reaches Lv 5 within ~8 battles against Lv 1 enemies using default REWARD_MULT', () => {
    const pilot = createDefaultPilotAccount('Ace', 'interceptor');
    let gear = pilot.gears.interceptor;
    const singleBattleExp =
      4 *
      calculateSingleEnemyReward(1, false).exp *
      BALANCE_CONFIG.rewardMultDefault;

    let battles = 0;
    while (gear.level < 5 && battles < 12) {
      battles += 1;
      gear = applyExpToGear(gear, singleBattleExp, { won: true }).updatedGear;
    }

    expect(gear.level).toBeGreaterThanOrEqual(5);
    expect(battles).toBeLessThanOrEqual(8);
    expect(
      estimateBattlesToNextLevel(pilot.gears.interceptor, singleBattleExp)
    ).toBe(1);
  });
});

describe('2. Per-Gear Stat Allocation & Respec', () => {
  it('allocates points strictly on the targeted Gear and updates effective & derived stats', () => {
    const pilot = createDefaultPilotAccount('Kira', 'interceptor');
    const gear = pilot.gears.interceptor;

    const baseStats = calculateEffectiveStats(
      gear.classId,
      gear.level,
      gear.allocatedPoints
    );
    const updated = allocateGearStats(gear, { attack: 2, evasion: 1 });

    expect(updated.unspentPoints).toBe(0);
    expect(updated.allocatedPoints.attack).toBe(2);
    expect(updated.allocatedPoints.evasion).toBe(1);

    const newStats = calculateEffectiveStats(
      updated.classId,
      updated.level,
      updated.allocatedPoints
    );
    const cls = MECH_CLASSES.interceptor;
    expect(newStats.attack).toBe(
      baseStats.attack + 2 * cls.perPointGain.attack
    );
    expect(newStats.evasion).toBe(
      baseStats.evasion + 1 * cls.perPointGain.evasion
    );

    const rejected = allocateGearStats(updated, { attack: 1 });
    expect(rejected).toBe(updated);

    const reset = resetGearStatAllocations(updated);
    expect(reset.allocatedPoints).toEqual(EMPTY_STAT_BLOCK);
    expect(reset.unspentPoints).toBe(BALANCE_CONFIG.initialStatPoints);
  });

  it('includes equipped item rolled stats, enchant scaling, and special traits in derived stats', () => {
    const pilot = createDefaultPilotAccount('Vance', 'striker');
    const railLance = generateItemInstance(
      {
        templateId: 'tpl_mw_rail_lance',
        tier: 2,
        rarity: 'epic',
        requiredLevel: 1,
        enchantLevel: 5,
      },
      () => 0.5
    );
    pilot.inventory.push(railLance);
    const equippedPilot = equipItemOnGear(
      pilot,
      'striker',
      railLance.instanceId
    ).pilot;
    const gear = equippedPilot.gears.striker;

    const bonuses = sumGearEquipmentStats(gear, equippedPilot.inventory);
    const traits = sumGearSpecialTraits(gear, equippedPilot.inventory);
    const effective = calculateEffectiveStats(
      gear.classId,
      gear.level,
      gear.allocatedPoints,
      EMPTY_STAT_BLOCK,
      bonuses,
      traits
    );
    const derived = calculateDerivedStats(
      gear.classId,
      gear.level,
      effective,
      traits
    );
    const baseDerived = calculateDerivedStats(
      gear.classId,
      gear.level,
      calculateEffectiveStats(gear.classId, gear.level, gear.allocatedPoints)
    );

    expect(bonuses.attack).toBeGreaterThan(0);
    expect(traits.critBonusPct).toBe(8);
    expect(derived.attackPower).toBe(baseDerived.attackPower + bonuses.attack);
    expect(derived.critChance).toBeGreaterThan(baseDerived.critChance);
  });
});

describe('3. Randomized Item Generation & Enchant Scaling', () => {
  it('defines at least 5 distinct item templates per slot', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      const count = ITEM_TEMPLATES.filter((t) => t.slot === slot).length;
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });

  it('generates 0/1/2/3 affixes by rarity, rollQuality in [1..100], and scales with min/max RNG and tier', () => {
    const rarities: ItemRarity[] = ['common', 'rare', 'epic', 'legendary'];

    for (const rarity of rarities) {
      const lowRoll = generateItemInstance(
        { templateId: 'tpl_mw_pulse_cannon', tier: 1, rarity, requiredLevel: 1 },
        () => 0
      );
      const highRoll = generateItemInstance(
        { templateId: 'tpl_mw_pulse_cannon', tier: 1, rarity, requiredLevel: 1 },
        () => 0.9999
      );

      expect(lowRoll.affixes).toHaveLength(
        BALANCE_CONFIG.rarityAffixCount[rarity]
      );
      expect(highRoll.affixes).toHaveLength(
        BALANCE_CONFIG.rarityAffixCount[rarity]
      );
      expect(lowRoll.rollQuality).toBeGreaterThanOrEqual(1);
      expect(highRoll.rollQuality).toBe(100);
      expect(highRoll.rolledBaseStats.attack!).toBeGreaterThan(
        lowRoll.rolledBaseStats.attack!
      );

      if (rarity === 'common') {
        expect(lowRoll.suffixId).toBeNull();
      } else {
        expect(lowRoll.suffixId).not.toBeNull();
      }
    }

    const tier1 = generateItemInstance(
      { templateId: 'tpl_mw_pulse_cannon', tier: 1, rarity: 'rare', requiredLevel: 1 },
      () => 0.5
    );
    const tier3 = generateItemInstance(
      { templateId: 'tpl_mw_pulse_cannon', tier: 3, rarity: 'rare', requiredLevel: 7 },
      () => 0.5
    );
    expect(tier3.rolledBaseStats.attack!).toBeGreaterThan(
      tier1.rolledBaseStats.attack!
    );

    const baseEff = getEffectiveItemStats(tier1, 0);
    const plus5Eff = getEffectiveItemStats(tier1, 5);
    expect(plus5Eff.attack).toBe(Math.round(baseEff.attack * 1.4));
  });

  it('generates randomized shop stock covering all 6 equipment slots', () => {
    const stock = generateShopStock(
      5,
      12,
      createSequenceRng([0.15, 0.45, 0.75, 0.92])
    );
    expect(stock).toHaveLength(12);
    const slotsPresent = new Set(stock.map((i) => i.slot));
    for (const slot of EQUIPMENT_SLOTS) {
      expect(slotsPresent.has(slot)).toBe(true);
    }
    const uniqueIds = new Set(stock.map((i) => i.instanceId));
    expect(uniqueIds.size).toBe(12);
  });
});

describe('4. Rebalanced Reward Formula (Victory vs Defeat & Boss + War Points)', () => {
  function makeEnemy(
    id: string,
    level: number,
    alive: boolean,
    isBoss = false
  ): CombatUnit {
    return {
      id,
      name: id,
      callsign: isBoss ? 'BOSS' : 'Hostile',
      side: 'enemy',
      row: 'front',
      isPlayer: false,
      classId: 'striker',
      archetype: 'gunship',
      isBoss,
      level,
      skillLevel: 1,
      skillLevels: { str_hotload_shells: 1 },
      equippedSkillIds: ['str_hotload_shells'],
      skillCooldowns: {},
      usedOnceSkills: [],
      stats: { ...EMPTY_STAT_BLOCK },
      derived: {
        maxHp: 100,
        maxShield: 50,
        maxSp: 40,
        speed: 30,
        attackPower: 20,
        defenseRating: 10,
        dodgeChance: 5,
        critChance: 10,
        skillPower: 20,
        armorPiercePct: 0,
        splashPct: 0,
        spRegenPerTurn: 0,
        passiveSkillDmgPct: 0,
      },
      hp: alive ? 100 : 0,
      shield: alive ? 50 : 0,
      sp: 40,
      isDefending: false,
      alive,
      statuses: [],
      animState: alive ? 'idle' : 'destroyed',
    };
  }

  it('matches EXP = 25 + 8*lv, Credits = 60 + 20*lv, War Points = 4 + lv, and x5 for bosses', () => {
    expect(calculateSingleEnemyReward(1, false)).toEqual({
      exp: 33,
      credits: 80,
      warPoints: 5,
    });
    expect(calculateSingleEnemyReward(5, false)).toEqual({
      exp: 65,
      credits: 160,
      warPoints: 9,
    });
    expect(calculateSingleEnemyReward(5, true)).toEqual({
      exp: 325,
      credits: 800,
      warPoints: 45,
    });
  });

  it('grants 100% on victory (+ first-capture WP bonus) and 50% destroyed + 20% consolation on defeat', () => {
    const enemies = [
      makeEnemy('e1', 2, false),
      makeEnemy('e2', 2, false),
      makeEnemy('e3', 2, true),
      makeEnemy('e4', 2, true),
    ];
    const victoryFirstCapture = calculateBattleRewards(
      enemies,
      true,
      2.0,
      SECTORS_CATALOG[0].id,
      false
    );
    expect(victoryFirstCapture.fullVictoryExp).toBe(328);
    expect(victoryFirstCapture.fullVictoryCredits).toBe(800);
    expect(victoryFirstCapture.expGained).toBe(328);
    expect(victoryFirstCapture.creditsGained).toBe(800);
    expect(victoryFirstCapture.baseCaptureBonusWp).toBe(
      BALANCE_CONFIG.warPointsBaseCaptureBonus.Standard
    );
    expect(victoryFirstCapture.warPointsGained).toBeGreaterThan(
      BALANCE_CONFIG.warPointsBaseCaptureBonus.Standard
    );

    const defeatHalf = calculateBattleRewards(enemies, false, 2.0);
    expect(defeatHalf.expGained).toBe(Math.round(82 + 65.6));
    expect(defeatHalf.creditsGained).toBe(360);
    expect(defeatHalf.baseCaptureBonusWp).toBe(0);

    const allAlive = enemies.map((e) => ({ ...e, alive: true, hp: 100 }));
    const defeatZero = calculateBattleRewards(allAlive, false, 2.0);
    expect(defeatZero.expGained).toBe(Math.round(328 * 0.2));
    expect(defeatZero.creditsGained).toBe(Math.round(800 * 0.2));
  });
});

describe('5. Equipment Rules (Per-Gear Exclusivity, Class Locks, Level Requirement)', () => {
  it('enforces 1-instance-per-Gear exclusivity, Armor/Engine class locks, and requiredLevel', () => {
    let pilot = createDefaultPilotAccount('Kira', 'striker');
    pilot.gears.interceptor.owned = true;

    const universalWeapon = generateItemInstance(
      { templateId: 'tpl_mw_pulse_cannon', tier: 1, rarity: 'rare', requiredLevel: 1 },
      () => 0.5
    );
    const highLevelWeapon = generateItemInstance(
      { templateId: 'tpl_mw_rail_lance', tier: 3, rarity: 'epic', requiredLevel: 8 },
      () => 0.5
    );
    const strikerArmor = generateItemInstance(
      { templateId: 'tpl_ar_striker_vanguard', tier: 1, rarity: 'common', requiredLevel: 1 },
      () => 0.5
    );
    const interceptorEngine = generateItemInstance(
      { templateId: 'tpl_en_interceptor_vector', tier: 1, rarity: 'common', requiredLevel: 1 },
      () => 0.5
    );

    pilot.inventory.push(
      universalWeapon,
      highLevelWeapon,
      strikerArmor,
      interceptorEngine
    );

    const eq1 = equipItemOnGear(pilot, 'striker', universalWeapon.instanceId);
    expect(eq1.validation.canEquip).toBe(true);
    pilot = eq1.pilot;
    expect(getItemEquippedByGear(pilot.gears, universalWeapon.instanceId)).toBe(
      'striker'
    );

    const eq2 = equipItemOnGear(
      pilot,
      'interceptor',
      universalWeapon.instanceId
    );
    expect(eq2.validation.canEquip).toBe(false);
    expect(eq2.validation.equippedOnOtherGear).toBe('striker');

    pilot = unequipSlotOnGear(pilot, 'striker', 'main_weapon');
    const eq3 = equipItemOnGear(
      pilot,
      'interceptor',
      universalWeapon.instanceId
    );
    expect(eq3.validation.canEquip).toBe(true);
    pilot = eq3.pilot;
    expect(getItemEquippedByGear(pilot.gears, universalWeapon.instanceId)).toBe(
      'interceptor'
    );

    const wrongArmor = validateEquipOnGear(
      strikerArmor,
      pilot.gears.interceptor,
      pilot.gears
    );
    expect(wrongArmor.canEquip).toBe(false);
    expect(wrongArmor.requiredClass).toBe('striker');

    const wrongEngine = validateEquipOnGear(
      interceptorEngine,
      pilot.gears.striker,
      pilot.gears
    );
    expect(wrongEngine.canEquip).toBe(false);
    expect(wrongEngine.requiredClass).toBe('interceptor');

    const tooLow = validateEquipOnGear(
      highLevelWeapon,
      pilot.gears.striker,
      pilot.gears
    );
    expect(tooLow.canEquip).toBe(false);
    expect(tooLow.missingLevel).toBe(8);
  });
});

describe('6. Save Migration (v1 / v2 / v3 / v4 / Corrupt -> v5 Skill System)', () => {
  it('migrates legacy v3 save and strips illegal cross-class skills from v4 saves', () => {
    const legacyV3 = {
      player: {
        name: 'Kira',
        classId: 'siege',
        level: 6,
        exp: 45,
        credits: 2450,
        unspentPoints: 4,
        allocatedPoints: {
          attack: 5,
          defense: 3,
          fuel: 1,
          spirit: 2,
          shield: 2,
          evasion: 1,
        },
        battlesWon: 4,
        battlesFought: 5,
        inventory: [
          { instanceId: 'old_bag_1', itemId: 'mw_plasma_lance', enchantLevel: 2 },
        ],
        equipped: {
          main_weapon: {
            instanceId: 'old_eq_mw',
            itemId: 'mw_hyperion_railgun',
            enchantLevel: 4,
          },
          sub_weapon: null,
          armor: {
            instanceId: 'old_eq_arm',
            itemId: 'ar_siege_bulwark',
            enchantLevel: 1,
          },
          engine: null,
          cpu: null,
          accessory: null,
        },
      },
      selectedSectorId: SECTORS_CATALOG[1].id,
      hasSaveData: true,
      language: 'vi',
      battleSpeed: 2,
    };

    const migrated = migrateSaveData(legacyV3, 3, () => 0.5);

    expect(migrated.pilot.name).toBe('Kira');
    expect(migrated.pilot.credits).toBe(2450);
    expect(migrated.pilot.activeGearId).toBe('siege');
    expect(migrated.pilot.warPoints).toBeGreaterThanOrEqual(0);
    expect(migrated.pilot.gears.siege.equippedSkillBar.length).toBeGreaterThan(0);
    expect(
      migrated.pilot.gears.siege.equippedSkillBar.every((id) => {
        const sk = getSkillById(id);
        return sk && (sk.classScope === 'general' || sk.classScope === 'siege');
      })
    ).toBe(true);

    // Verify v4 save with injected cross-class skill gets sanitized
    const tamperedV4 = createDefaultPilotAccount('Vance', 'striker');
    tamperedV4.gears.striker.skillLevels['sge_starbreaker_lance'] = 3;
    tamperedV4.gears.striker.equippedSkillBar.push('sge_starbreaker_lance');
    const sanitized = migrateSaveData({ pilot: tamperedV4 }, 4, () => 0.5);
    expect(
      sanitized.pilot.gears.striker.skillLevels['sge_starbreaker_lance']
    ).toBeUndefined();
    expect(
      sanitized.pilot.gears.striker.equippedSkillBar.includes(
        'sge_starbreaker_lance'
      )
    ).toBe(false);
  });

  it('handles null/corrupt payloads safely by returning a valid default campaign', () => {
    const fromNull = migrateSaveData(null, 1, () => 0.5);
    expect(fromNull.pilot.gears[fromNull.pilot.activeGearId].owned).toBe(true);
    expect(fromNull.shopStock.length).toBeGreaterThan(0);

    const fromBroken = migrateSaveData(
      { pilot: { activeGearId: 'invalid' } },
      4,
      () => 0.5
    );
    expect(fromBroken.pilot.gears[fromBroken.pilot.activeGearId].owned).toBe(
      true
    );
  });
});

describe('7. Combat Depth (Status Effects & Enemy Archetypes)', () => {
  it('applies Burn DoT at turn start, Slow reduces speed by 30%, and Shield Break no longer bypasses shields', () => {
    const pilot = createDefaultPilotAccount('Vance', 'striker');
    const battle = createInitialBattleState(
      pilot,
      SECTORS_CATALOG[0].id,
      createSequenceRng([0.1, 0.35, 0.6, 0.85])
    );

    const player = battle.units.find((u) => u.id === 'ally_player')!;
    const enemy =
      getValidEnemyTargets(battle.units, player, 'attack')[0] ??
      battle.units.find((u) => u.side === 'enemy')!;

    const slowedUnit: CombatUnit = {
      ...player,
      statuses: [{ type: 'slow', turnsRemaining: 2 }],
    };
    expect(getEffectiveUnitSpeed(slowedUnit)).toBe(
      Math.max(
        1,
        Math.round(player.derived.speed * (1 - BALANCE_CONFIG.slowSpeedPenalty))
      )
    );

    const brokenEnemy: CombatUnit = {
      ...enemy,
      shield: 200,
      hp: 300,
      statuses: [{ type: 'shield_break', turnsRemaining: 2 }],
    };
    const unitsForBreak = battle.units.map((u) =>
      u.id === enemy.id ? brokenEnemy : u
    );
    const attackRes = resolveUnitAction(
      unitsForBreak,
      player.id,
      'attack',
      enemy.id,
      1,
      undefined,
      () => 0.99
    );
    const enemyAfter = attackRes.updatedUnits.find((u) => u.id === enemy.id)!;
    // SH2a: shield ALWAYS absorbs first even when shield_break is active
    expect(enemyAfter.shield).toBeLessThan(200);
    expect(enemyAfter.hp).toBe(300);

    const burnedPlayer: CombatUnit = {
      ...player,
      hp: player.derived.maxHp,
      statuses: [{ type: 'burn', turnsRemaining: 2 }],
    };
    const unitsForBurn = battle.units.map((u) =>
      u.id === player.id ? burnedPlayer : u
    );
    const burnRes = resolveUnitAction(
      unitsForBurn,
      player.id,
      'defend',
      null,
      2,
      undefined,
      () => 0.5
    );
    const playerAfterBurn = burnRes.updatedUnits.find(
      (u) => u.id === player.id
    )!;
    const expectedBurn = Math.max(
      5,
      Math.round(player.derived.maxHp * BALANCE_CONFIG.burnDamageRatio)
    );
    expect(playerAfterBurn.hp).toBe(player.derived.maxHp - expectedBurn);
    expect(hasStatus(playerAfterBurn, 'burn')).toBe(true);
  });

  it('Sniper archetype always targets the lowest-HP opposing ship', () => {
    const pilot = createDefaultPilotAccount('Vance', 'striker');
    const battle = createInitialBattleState(
      pilot,
      SECTORS_CATALOG[0].id,
      createSequenceRng([0.1, 0.35, 0.6, 0.85])
    );
    const sniper = battle.units.find((u) => u.archetype === 'sniper')!;
    const lowestAlly = battle.units.find((u) => u.id === 'ally_npc_2')!;

    const tweakedUnits = battle.units.map((u) =>
      u.id === lowestAlly.id ? { ...u, hp: 15 } : u
    );
    const decision = chooseAiDecision(sniper, tweakedUnits, () => 0.99);
    expect(decision.targetId).toBe(lowestAlly.id);
  });
});

describe('8. Gear Skill System — Class Locks & Per-Point Stat Gains', () => {
  it('matches exact per-point stat gains for all 4 Gear classes', () => {
    expect(MECH_CLASSES.siege.perPointGain).toEqual({
      attack: 4,
      evasion: 1,
      defense: 3,
      shield: 4,
      spirit: 3,
      fuel: 3,
    });
    expect(MECH_CLASSES.striker.perPointGain).toEqual({
      attack: 3,
      evasion: 3,
      defense: 3,
      shield: 3,
      spirit: 3,
      fuel: 3,
    });
    expect(MECH_CLASSES.interceptor.perPointGain).toEqual({
      attack: 4,
      defense: 2,
      evasion: 4,
      shield: 2,
      spirit: 2,
      fuel: 2,
    });
    expect(MECH_CLASSES.support.perPointGain).toEqual({
      defense: 4,
      fuel: 3,
      attack: 2,
      evasion: 2,
      shield: 3,
      spirit: 4,
    });
  });

  it('enforces class-lock in the engine for learning, equipping, and casting skills', () => {
    expect(SKILLS_LIST.length).toBe(38);
    const pilot = createDefaultPilotAccount('Kira', 'striker');
    pilot.credits = 50000;
    pilot.gears.striker.level = 30;

    // Striker catalog contains ONLY striker + general skills
    const strikerSkills = getSkillsForClass('striker');
    expect(
      strikerSkills.every(
        (s) => s.classScope === 'striker' || s.classScope === 'general'
      )
    ).toBe(true);

    // Engine rejects learning Siege/Interceptor/Support skills on Striker
    const learnSiege = validateLearnOrUpgradeSkill(
      pilot,
      'striker',
      'sge_anchor_protocol'
    );
    expect(learnSiege.ok).toBe(false);
    expect(learnSiege.reason).toBe('class_mismatch');

    const learnSupport = learnOrUpgradeSkillOnGear(
      pilot,
      'striker',
      'sup_nanite_mend'
    );
    expect(learnSupport.validation.ok).toBe(false);
    expect(learnSupport.validation.reason).toBe('class_mismatch');
    expect(learnSupport.pilot.credits).toBe(50000);

    // Engine rejects equipping a cross-class skill onto Striker's bar
    const eqCross = validateEquipSkillOnBar(
      pilot.gears.striker,
      'int_sabot_burst'
    );
    expect(eqCross.ok).toBe(false);
    expect(eqCross.reason).toBe('class_mismatch');

    // Engine ALLOWS General skills on any class
    const learnGeneral = learnOrUpgradeSkillOnGear(
      pilot,
      'striker',
      'gen_thruster_feint'
    );
    expect(learnGeneral.validation.ok).toBe(true);
    expect(learnGeneral.newLevel).toBe(1);

    // Battle engine rejects casting cross-class skill even if injected
    const battle = createInitialBattleState(pilot, SECTORS_CATALOG[0].id);
    const playerUnit = battle.units.find((u) => u.isPlayer)!;
    const crossUsability = canUnitUseSkill(playerUnit, 'sup_nanite_mend');
    expect(crossUsability.canUse).toBe(false);
    expect(crossUsability.reason).toBe('class_mismatch');
  });
});

describe('9. Per-Gear Skill Bars (Max 6), Passives Always ON, & Level Gate', () => {
  it('enforces max 6 active skills, rejects passives on bar, keeps Gear bars independent, and applies passives to stats', () => {
    let pilot = createDefaultPilotAccount('Vance', 'striker');
    pilot.credits = 100000;
    pilot.gears.striker.level = 30;
    pilot.gears.siege.owned = true;
    pilot.gears.siege.level = 30;

    // Learn enough Striker + General active skills to exceed 6
    const activeIds = [
      'str_hotload_shells',
      'str_ordnance_amp',
      'str_deadeye_link',
      'str_viper_sweep',
      'str_carpet_salvo',
      'str_solar_capacitor',
      'gen_hull_brace',
      'gen_thruster_feint',
    ];
    for (const id of activeIds) {
      if ((pilot.gears.striker.skillLevels[id] ?? 0) === 0) {
        pilot = learnOrUpgradeSkillOnGear(pilot, 'striker', id).pilot;
      }
    }

    // Auto-slotting caps strictly at 6
    expect(pilot.gears.striker.equippedSkillBar).toHaveLength(
      MAX_ACTIVE_SKILL_BAR
    );

    // Attempting to equip a 7th active skill fails with 'bar_full'
    const unslottedId = activeIds.find(
      (id) => !pilot.gears.striker.equippedSkillBar.includes(id)
    )!;
    const eq7th = equipSkillToGearBar(pilot, 'striker', unslottedId);
    expect(eq7th.validation.ok).toBe(false);
    expect(eq7th.validation.reason).toBe('bar_full');

    // Unequipping one frees a slot for the 7th skill
    const removedId = pilot.gears.striker.equippedSkillBar[0];
    pilot = unequipSkillFromGearBar(pilot, 'striker', removedId);
    expect(pilot.gears.striker.equippedSkillBar).toHaveLength(5);
    const eqAfterFree = equipSkillToGearBar(pilot, 'striker', unslottedId);
    expect(eqAfterFree.validation.ok).toBe(true);
    pilot = eqAfterFree.pilot;
    expect(pilot.gears.striker.equippedSkillBar).toHaveLength(6);

    // Siege's skill bar remains completely independent of Striker's changes
    expect(pilot.gears.siege.equippedSkillBar).toEqual([
      'sge_anchor_protocol',
      'gen_hull_brace',
    ]);

    // Passive skills cannot be placed on the active bar, but apply permanently once learned
    const baseDerived = calculateDerivedStats(
      'striker',
      30,
      calculateEffectiveStats('striker', 30, pilot.gears.striker.allocatedPoints)
    );
    pilot = learnOrUpgradeSkillOnGear(
      pilot,
      'striker',
      'str_passive_ordnance'
    ).pilot;
    pilot = learnOrUpgradeSkillOnGear(
      pilot,
      'striker',
      'str_passive_ordnance'
    ).pilot; // Lv 2 -> +10% skill dmg
    const eqPassive = equipSkillToGearBar(
      pilot,
      'striker',
      'str_passive_ordnance'
    );
    expect(eqPassive.validation.ok).toBe(false);
    expect(eqPassive.validation.reason).toBe('is_passive');

    const passives = getGearPassiveBonuses(pilot.gears.striker);
    expect(passives.skillDmgPct).toBeCloseTo(0.1, 3);
    const withPassiveDerived = calculateDerivedStats(
      'striker',
      30,
      calculateEffectiveStats(
        'striker',
        30,
        pilot.gears.striker.allocatedPoints,
        EMPTY_STAT_BLOCK,
        EMPTY_STAT_BLOCK,
        {},
        passives
      ),
      {},
      passives
    );
    expect(withPassiveDerived.passiveSkillDmgPct).toBeCloseTo(0.1, 3);
    expect(baseDerived.passiveSkillDmgPct).toBe(0);
  });

  it('enforces Gear level gate unlockLevel + 4*(n-1) and +10% effect scaling per level', () => {
    const skill = getSkillById('str_viper_sweep')!; // unlockLevel: 8, powerMultiplier: 0.6
    expect(getRequiredGearLevelForSkillLevel(skill, 1)).toBe(8);
    expect(getRequiredGearLevelForSkillLevel(skill, 2)).toBe(12);
    expect(getRequiredGearLevelForSkillLevel(skill, 3)).toBe(16);
    expect(getRequiredGearLevelForSkillLevel(skill, 5)).toBe(24);

    expect(getScaledSkillStats(skill, 1).powerMultiplier).toBe(0.6);
    expect(getScaledSkillStats(skill, 5).powerMultiplier).toBe(0.84); // 0.6 * 1.4

    const pilot = createDefaultPilotAccount('Kira', 'striker');
    pilot.credits = 50000;
    pilot.gears.striker.level = 7; // 1 level below unlockLevel 8
    const tooLow = validateLearnOrUpgradeSkill(
      pilot,
      'striker',
      'str_viper_sweep'
    );
    expect(tooLow.ok).toBe(false);
    expect(tooLow.reason).toBe('level_too_low');
    expect(tooLow.requiredGearLevel).toBe(8);
  });
});

describe('10. War Point Shop & Special/Elite Opening Cards', () => {
  it('blocks Special/Elite learning without Opening Card, enforces WP cost, and unlocks after purchase', () => {
    expect(OPENING_CARDS_LIST.length).toBe(9);
    let pilot = createDefaultPilotAccount('Ace', 'siege');
    pilot.credits = 100000;
    pilot.warPoints = 50; // Not enough for Elite card (160 WP)
    pilot.gears.siege.level = 30;

    // Cannot learn Elite Starbreaker Lance without Opening Card
    const blockedNoCard = validateLearnOrUpgradeSkill(
      pilot,
      'siege',
      'sge_starbreaker_lance'
    );
    expect(blockedNoCard.ok).toBe(false);
    expect(blockedNoCard.reason).toBe('missing_card');
    expect(blockedNoCard.requiredCardId).toBe('card_sge_starbreaker_lance');

    // Buying card with insufficient WP fails
    const buyFail = buyOpeningCard(pilot, 'card_sge_starbreaker_lance');
    expect(buyFail.ok).toBe(false);
    expect(buyFail.reason).toBe('insufficient_wp');

    // Grant WP and purchase card
    pilot.warPoints = 2000;
    const buyOk = buyOpeningCard(pilot, 'card_sge_starbreaker_lance');
    expect(buyOk.ok).toBe(true);
    expect(buyOk.pilot.warPoints).toBe(400);
    expect(
      buyOk.pilot.ownedOpeningCards.includes('card_sge_starbreaker_lance')
    ).toBe(true);
    pilot = buyOk.pilot;

    // Duplicate purchase rejected
    const buyDup = buyOpeningCard(pilot, 'card_sge_starbreaker_lance');
    expect(buyDup.ok).toBe(false);
    expect(buyDup.reason).toBe('already_owned');

    // Now Elite skill can be learned with Credits
    const learnElite = learnOrUpgradeSkillOnGear(
      pilot,
      'siege',
      'sge_starbreaker_lance'
    );
    expect(learnElite.validation.ok).toBe(true);
    expect(learnElite.newLevel).toBe(1);
  });
});

describe('11. Battle Skill Mechanics (SP, CD, Once-Per-Battle, Silence, Siege, Charge, Counter, Scan)', () => {
  it('deducts SP, sets & decrements cooldowns, enforces Elite once-per-battle, and blocks skills when Silenced', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    pilot.gears.striker.level = 30;
    pilot.gears.striker.skillLevels = {
      str_viper_sweep: 1,
      str_skyfall_protocol: 1,
      gen_hull_brace: 1,
    };
    pilot.gears.striker.equippedSkillBar = [
      'str_viper_sweep',
      'str_skyfall_protocol',
      'gen_hull_brace',
    ];

    const battle = createInitialBattleState(
      pilot,
      SECTORS_CATALOG[0].id,
      createSequenceRng([0.2, 0.5, 0.8])
    );
    const enemy = battle.units.find((u) => u.side === 'enemy')!;
    let units = battle.units.map((u) =>
      u.isPlayer ? { ...u, sp: 100, derived: { ...u.derived, maxSp: 120 } } : u
    );

    // 1) Cast Viper Strafe (SP 18, CD 3)
    const cast1 = resolveUnitAction(
      units,
      'ally_player',
      'skill',
      enemy.id,
      1,
      undefined,
      () => 0.99,
      'str_viper_sweep'
    );
    units = cast1.updatedUnits;
    const pAfter1 = units.find((u) => u.isPlayer)!;
    expect(pAfter1.sp).toBe(82);
    expect(pAfter1.skillCooldowns['str_viper_sweep']).toBe(3);
    expect(canUnitUseSkill(pAfter1, 'str_viper_sweep').canUse).toBe(false);
    expect(canUnitUseSkill(pAfter1, 'str_viper_sweep').reason).toBe(
      'on_cooldown'
    );

    // 2) Cast Elite Skyfall Saturation (SP 60, oncePerBattle: true)
    const castElite = resolveUnitAction(
      units,
      'ally_player',
      'skill',
      enemy.id,
      2,
      undefined,
      () => 0.99,
      'str_skyfall_protocol'
    );
    units = castElite.updatedUnits;
    const pAfterElite = units.find((u) => u.isPlayer)!;
    // Start of turn 2 decremented Viper Strafe CD from 3 -> 2
    expect(pAfterElite.skillCooldowns['str_viper_sweep']).toBe(2);
    expect(pAfterElite.usedOnceSkills.includes('str_skyfall_protocol')).toBe(
      true
    );

    // Even with full SP refilled, Elite skill cannot be used a second time
    const pRefilled: CombatUnit = { ...pAfterElite, sp: 120 };
    const eliteSecond = canUnitUseSkill(pRefilled, 'str_skyfall_protocol');
    expect(eliteSecond.canUse).toBe(false);
    expect(eliteSecond.reason).toBe('already_used');

    // 3) Silence blocks all active skills
    const pSilenced: CombatUnit = {
      ...pRefilled,
      statuses: [{ type: 'silence', turnsRemaining: 2, isDebuff: true }],
    };
    const silencedCheck = canUnitUseSkill(pSilenced, 'gen_hull_brace');
    expect(silencedCheck.canUse).toBe(false);
    expect(silencedCheck.reason).toBe('silenced');
  });

  it('handles Siege Mode toggle & Camouflage conflict, Charge Shot 2-turn release, Counter riposte, and Lidar Scan reveal', () => {
    // A) Siege Mode toggle ON -> blocks Thermal Masking -> toggle OFF costs 0 SP
    const siegePilot = createDefaultPilotAccount('Iron', 'siege');
    siegePilot.gears.siege.level = 25;
    siegePilot.gears.siege.skillLevels = {
      sge_anchor_protocol: 1,
      sge_thermal_mask: 1,
    };
    siegePilot.gears.siege.equippedSkillBar = [
      'sge_anchor_protocol',
      'sge_thermal_mask',
    ];
    const siegeBattle = createInitialBattleState(
      siegePilot,
      SECTORS_CATALOG[0].id
    );
    let siegeUnits = siegeBattle.units.map((u) =>
      u.isPlayer ? { ...u, sp: 50 } : u
    );

    siegeUnits = resolveUnitAction(
      siegeUnits,
      'ally_player',
      'skill',
      null,
      1,
      undefined,
      () => 0.99,
      'sge_anchor_protocol'
    ).updatedUnits;
    const pSiegeOn = siegeUnits.find((u) => u.isPlayer)!;
    expect(hasStatus(pSiegeOn, 'siege_mode')).toBe(true);
    expect(pSiegeOn.sp).toBe(38); // -12 SP
    expect(canUnitUseSkill(pSiegeOn, 'sge_thermal_mask').reason).toBe(
      'blocked_by_siege'
    );

    // Toggle Siege Mode OFF -> costs 0 SP
    siegeUnits = resolveUnitAction(
      siegeUnits,
      'ally_player',
      'skill',
      null,
      2,
      undefined,
      () => 0.99,
      'sge_anchor_protocol'
    ).updatedUnits;
    const pSiegeOff = siegeUnits.find((u) => u.isPlayer)!;
    expect(hasStatus(pSiegeOff, 'siege_mode')).toBe(false);
    expect(pSiegeOff.sp).toBe(38); // 0 SP to turn off
    expect(canUnitUseSkill(pSiegeOff, 'sge_thermal_mask').canUse).toBe(true);

    // B) Charge Shot (2-turn execution)
    const strPilot = createDefaultPilotAccount('Nova', 'striker');
    strPilot.gears.striker.level = 20;
    strPilot.gears.striker.skillLevels = { str_solar_capacitor: 1 };
    strPilot.gears.striker.equippedSkillBar = ['str_solar_capacitor'];
    const strBattle = createInitialBattleState(strPilot, SECTORS_CATALOG[0].id);
    const strEnemy = strBattle.units.find((u) => u.side === 'enemy')!;
    let strUnits = strBattle.units.map((u) =>
      u.isPlayer ? { ...u, sp: 50 } : u.id === strEnemy.id ? { ...u, hp: 999, shield: 0 } : u
    );

    // Turn 1: starts charging
    strUnits = resolveUnitAction(
      strUnits,
      'ally_player',
      'skill',
      strEnemy.id,
      1,
      undefined,
      () => 0.99,
      'str_solar_capacitor'
    ).updatedUnits;
    expect(hasStatus(strUnits.find((u) => u.isPlayer)!, 'charging')).toBe(true);
    expect(strUnits.find((u) => u.id === strEnemy.id)!.hp).toBe(999);

    // Turn 2: auto-fires charged devastation shot
    strUnits = resolveUnitAction(
      strUnits,
      'ally_player',
      'attack',
      strEnemy.id,
      2,
      undefined,
      () => 0.99
    ).updatedUnits;
    expect(hasStatus(strUnits.find((u) => u.isPlayer)!, 'charging')).toBe(false);
    expect(strUnits.find((u) => u.id === strEnemy.id)!.hp).toBeLessThan(999);

    // C) Lidar Scan reveals stealth and applies Vulnerable
    const supPilot = createDefaultPilotAccount('Echo', 'support');
    supPilot.gears.support.level = 10;
    supPilot.gears.support.skillLevels = { sup_lidar_sweep: 1 };
    supPilot.gears.support.equippedSkillBar = ['sup_lidar_sweep'];
    const supBattle = createInitialBattleState(supPilot, SECTORS_CATALOG[0].id);
    let supUnits = supBattle.units.map((u) =>
      u.isPlayer
        ? { ...u, sp: 40 }
        : u.side === 'enemy'
        ? { ...u, statuses: [{ type: 'stealth' as const, turnsRemaining: 2 }] }
        : u
    );
    supUnits = resolveUnitAction(
      supUnits,
      'ally_player',
      'skill',
      null,
      1,
      undefined,
      () => 0.99,
      'sup_lidar_sweep'
    ).updatedUnits;
    const enemiesAfterScan = supUnits.filter((u) => u.side === 'enemy');
    expect(enemiesAfterScan.every((e) => !hasStatus(e, 'stealth'))).toBe(true);
    expect(enemiesAfterScan.every((e) => hasStatus(e, 'vulnerable'))).toBe(true);

    // D) Snap-Turn Riposte counter-attacks incoming enemy hit
    const intPilot = createDefaultPilotAccount('Dart', 'interceptor');
    intPilot.gears.interceptor.level = 10;
    intPilot.gears.interceptor.skillLevels = { int_snap_riposte: 1 };
    intPilot.gears.interceptor.equippedSkillBar = ['int_snap_riposte'];
    const intBattle = createInitialBattleState(intPilot, SECTORS_CATALOG[0].id);
    const attackerEnemy = intBattle.units.find((u) => u.side === 'enemy')!;
    let intUnits = intBattle.units.map((u) =>
      u.isPlayer
        ? { ...u, sp: 40 }
        : u.id === attackerEnemy.id
        ? { ...u, hp: 500, shield: 0 }
        : u
    );
    intUnits = resolveUnitAction(
      intUnits,
      'ally_player',
      'skill',
      null,
      1,
      undefined,
      () => 0.99,
      'int_snap_riposte'
    ).updatedUnits;
    expect(hasStatus(intUnits.find((u) => u.isPlayer)!, 'counter')).toBe(true);

    const defAdmin = createDefaultAdminConfig();
    const counterRes = resolveUnitAction(
      intUnits,
      attackerEnemy.id,
      'attack',
      'ally_player',
      1,
      {
        ...defAdmin,
        shieldRegen: { ...defAdmin.shieldRegen!, enabled: false },
      },
      () => 0.99
    );
    const enemyAfterRiposte = counterRes.updatedUnits.find(
      (u) => u.id === attackerEnemy.id
    )!;
    expect(enemyAfterRiposte.hp).toBeLessThan(500);
    expect(
      counterRes.logEntries.some((l) => l.templateKey === 'log.counterAttack')
    ).toBe(true);
  });
});

describe('12. Turn Queue Ordering & Mid-Round Speed Changes', () => {
  function makeSpeedUnit(
    id: string,
    speed: number,
    side: 'ally' | 'enemy',
    opts?: { isPlayer?: boolean; isBoss?: boolean; slowed?: boolean; boosted?: boolean }
  ): CombatUnit {
    const statuses: CombatUnit['statuses'] = [];
    if (opts?.slowed) statuses.push({ type: 'slow', turnsRemaining: 2, isDebuff: true });
    if (opts?.boosted) statuses.push({ type: 'spd_up', turnsRemaining: 2, magnitude: 0.5 });
    return {
      id,
      name: id,
      callsign: id,
      side,
      row: 'front',
      isPlayer: Boolean(opts?.isPlayer),
      classId: 'striker',
      isBoss: Boolean(opts?.isBoss),
      level: 5,
      skillLevel: 1,
      skillLevels: {},
      equippedSkillIds: [],
      skillCooldowns: {},
      usedOnceSkills: [],
      stats: { ...EMPTY_STAT_BLOCK },
      derived: {
        maxHp: 200,
        maxShield: 100,
        maxSp: 50,
        speed,
        attackPower: 30,
        defenseRating: 15,
        dodgeChance: 5,
        critChance: 10,
        skillPower: 25,
        armorPiercePct: 0,
        splashPct: 0,
        spRegenPerTurn: 0,
        passiveSkillDmgPct: 0,
      },
      hp: 200,
      shield: 100,
      sp: 50,
      isDefending: false,
      alive: true,
      statuses,
      animState: 'idle',
    };
  }

  it('sorts strictly descending by effective Speed with deterministic tie-breakers', () => {
    const units = [
      makeSpeedUnit('e_slow', 15, 'enemy'),
      makeSpeedUnit('e_fast', 22, 'enemy'),
      makeSpeedUnit('a_tie_npc', 21, 'ally'),
      makeSpeedUnit('e_tie', 21, 'enemy'),
      makeSpeedUnit('a_tie_me', 21, 'ally', { isPlayer: true }),
    ];

    const order = sortTurnOrder(units);
    // 22 first, then 21 ties: player > ally > enemy, then 15 last
    expect(order).toEqual([
      'e_fast',
      'a_tie_me',
      'a_tie_npc',
      'e_tie',
      'e_slow',
    ]);
  });

  it('re-sorts remaining upcoming units mid-round on Slow/Speed-Up and separates Round N from Round N+1', () => {
    const units = [
      makeSpeedUnit('e_22', 22, 'enemy'),
      makeSpeedUnit('a_21', 21, 'ally', { isPlayer: true }),
      makeSpeedUnit('e_18', 18, 'enemy'),
      makeSpeedUnit('a_15', 15, 'ally'),
    ];
    const initialOrder = sortTurnOrder(units);
    expect(initialOrder).toEqual(['e_22', 'a_21', 'e_18', 'a_15']);

    // e_22 acted (idx 0), a_21 is currently acting (idx 1) and applies Slow to e_18 (18 * 0.7 = 13 < 15)
    const updatedUnits = units.map((u) =>
      u.id === 'e_18'
        ? { ...u, statuses: [{ type: 'slow' as const, turnsRemaining: 2, isDebuff: true }] }
        : u
    );

    const reconciled = reconcileRemainingTurnOrder(initialOrder, 1, updatedUnits);
    // Already acted (e_22) and current (a_21) stay untouched; remaining re-sort: a_15 (15) ahead of e_18 (13)
    expect(reconciled).toEqual(['e_22', 'a_21', 'a_15', 'e_18']);

    const mockBattle: BattleState = {
      sectorId: SECTORS_CATALOG[0].id,
      deployedGearId: 'striker',
      squadSize: 4,
      round: 2,
      turnCounter: 1,
      turnOrder: reconciled,
      activeTurnIndex: 1,
      units: updatedUnits,
      selectedTargetId: null,
      selectedAllyTargetId: null,
      lastPlayerTargetId: null,
      autoStopNotice: null,
      wingmanChat: null,
      log: [],
      events: [],
      roundSnapshots: [],
      fxEvents: [],
      popups: [],
      explodedUnitIds: [],
      isResolving: false,
      summary: null,
    };

    const queue = buildTurnQueue(mockBattle);
    expect(queue.round).toBe(2);
    // e_22 already acted -> MUST NOT appear in current; acting unit a_21 is FIRST, then upcoming strictly DESC (15, 13)
    expect(queue.current.map((e) => e.unitId)).toEqual(['a_21', 'a_15', 'e_18']);
    expect(queue.current[0].phase).toBe('current');
    expect(queue.current.map((e) => e.effectiveSpeed)).toEqual([21, 15, 13]);
    expect(queue.current.some((e) => e.unitId === 'e_22')).toBe(false);
    // Next round (Round 3) includes all living units sorted strictly DESC: 22, 21, 15, 13
    expect(queue.next.map((e) => e.unitId)).toEqual([
      'e_22',
      'a_21',
      'a_15',
      'e_18',
    ]);
    expect(queue.next.map((e) => e.effectiveSpeed)).toEqual([22, 21, 15, 13]);
  });
});

describe('13. Auto Tactics chooseAction (Priority, Conditions, Selectors, Fallback, Determinism)', () => {
  function setupTacticsFixture() {
    const pilot = createDefaultPilotAccount('Ace', 'support');
    pilot.gears.support.level = 25;
    pilot.gears.support.skillLevels = {
      sup_nanite_mend: 2,
      sup_system_purge: 1,
      sup_lidar_sweep: 1,
      sup_war_hymn: 1,
      gen_hull_brace: 1,
    };
    pilot.gears.support.equippedSkillBar = [
      'sup_nanite_mend',
      'sup_system_purge',
      'sup_lidar_sweep',
      'sup_war_hymn',
      'gen_hull_brace',
    ];
    const battle = createInitialBattleState(
      pilot,
      SECTORS_CATALOG[0].id,
      createSequenceRng([0.1, 0.35, 0.6, 0.85])
    );

    const units = battle.units.map((u, idx) => {
      if (u.isPlayer) {
        return {
          ...u,
          hp: 180,
          shield: 40,
          sp: 60,
          derived: { ...u.derived, maxHp: 200, maxShield: 100, maxSp: 80 },
        };
      }
      if (u.side === 'ally') {
        return {
          ...u,
          hp: idx === 1 ? 60 : 190, // ally #1 is at 30% HP
          derived: { ...u.derived, maxHp: 200 },
        };
      }
      return u;
    });

    // Customize 4 enemies to test every enemy target selector cleanly
    const enemyIds = units.filter((u) => u.side === 'enemy').map((u) => u.id);
    const customizedUnits = units.map((u) => {
      if (u.id === enemyIds[0]) {
        return {
          ...u,
          row: 'front' as const,
          archetype: 'gunship' as const,
          classId: 'siege' as const,
          hp: 50, // lowest HP
          shield: 0,
          isBoss: false,
          derived: { ...u.derived, maxHp: 200, attackPower: 20, speed: 12 },
        };
      }
      if (u.id === enemyIds[1]) {
        return {
          ...u,
          row: 'front' as const,
          archetype: 'drone' as const,
          classId: 'striker' as const,
          hp: 250, // highest HP
          shield: 120, // has shield
          isBoss: true, // boss
          derived: { ...u.derived, maxHp: 300, attackPower: 35, speed: 18 },
        };
      }
      if (u.id === enemyIds[2]) {
        return {
          ...u,
          row: 'back' as const,
          archetype: 'repair_ship' as const,
          classId: 'support' as const,
          hp: 140,
          shield: 20,
          isBoss: false,
          derived: { ...u.derived, maxHp: 200, attackPower: 15, speed: 24 },
        };
      }
      if (u.id === enemyIds[3]) {
        return {
          ...u,
          row: 'back' as const,
          archetype: 'sniper' as const,
          classId: 'interceptor' as const,
          hp: 110,
          shield: 0,
          isBoss: false,
          derived: { ...u.derived, maxHp: 180, attackPower: 80, speed: 40 }, // highest ATK & fastest
        };
      }
      return u;
    });

    const state: BattleState = {
      ...battle,
      round: 1,
      units: customizedUnits,
      lastPlayerTargetId: enemyIds[2],
    };
    const actor = state.units.find((u) => u.isPlayer)!;
    return { state, actor, enemyIds };
  }

  it('evaluates rules top-to-bottom, skips disabled/unusable rules, and falls back to lowest-HP Attack', () => {
    const { state, actor, enemyIds } = setupTacticsFixture();

    const tactics: GearTacticsProfile = {
      safety: createDefaultAutoSafety(),
      rules: [
        // Rule 1 disabled -> skipped
        {
          id: 'r1',
          enabled: false,
          condition: { kind: 'always' },
          action: { type: 'defend' },
          targetSelector: 'self',
        },
        // Rule 2 skill on cooldown -> skipped
        {
          id: 'r2',
          enabled: true,
          condition: { kind: 'always' },
          action: { type: 'skill', skillId: 'sup_war_hymn' },
          targetSelector: 'all_allies',
        },
        // Rule 3 condition true (ally #1 at 30% < 45%) & usable -> FIRES!
        {
          id: 'r3',
          enabled: true,
          condition: { kind: 'any_ally_hp_below', value: 45 },
          action: { type: 'skill', skillId: 'sup_nanite_mend' },
          targetSelector: 'lowest_hp_ally',
        },
        // Rule 4 lower priority
        {
          id: 'r4',
          enabled: true,
          condition: { kind: 'always' },
          action: { type: 'attack' },
          targetSelector: 'highest_hp_enemy',
        },
      ],
    };

    const actorWithCd: CombatUnit = {
      ...actor,
      skillCooldowns: { sup_war_hymn: 2 },
    };
    const res = chooseAction(state, actorWithCd, tactics, () => 0.5);
    expect(res.action).toBe('skill');
    expect(res.skillId).toBe('sup_nanite_mend');
    expect(res.matchedRuleIndex).toBe(2);
    expect(res.targetId).toBe('ally_npc_1');

    // When no rule matches -> fallback to basic attack on lowest-HP enemy with matchedRuleIndex = null
    const noMatchTactics: GearTacticsProfile = {
      safety: createDefaultAutoSafety(),
      rules: [
        {
          id: 'r_miss',
          enabled: true,
          condition: { kind: 'my_hp_below', value: 10 },
          action: { type: 'defend' },
          targetSelector: 'self',
        },
      ],
    };
    const fallbackRes = chooseAction(state, actor, noMatchTactics, () => 0.5);
    expect(fallbackRes.action).toBe('attack');
    expect(fallbackRes.targetId).toBe(enemyIds[0]); // hp 50 (lowest)
    expect(fallbackRes.matchedRuleIndex).toBeNull();
  });

  it('correctly evaluates target selectors and conditions deterministically', () => {
    const { state, actor, enemyIds } = setupTacticsFixture();

    // Give actor siege_mode (long-range) so all Front & Back row enemy selectors are legally reachable
    const longRangeActor: CombatUnit = {
      ...actor,
      statuses: [...actor.statuses, { type: 'siege_mode', turnsRemaining: 99 }],
    };

    const pickWith = (
      selector: GearTacticsProfile['rules'][number]['targetSelector'],
      rngVal = 0.5,
      overrideActor: CombatUnit = longRangeActor
    ) =>
      chooseAction(
        state,
        overrideActor,
        {
          safety: createDefaultAutoSafety(),
          rules: [
            {
              id: 'sel',
              enabled: true,
              condition: { kind: 'always' },
              action: { type: 'attack' },
              targetSelector: selector,
            },
          ],
        },
        () => rngVal
      );

    expect(pickWith('lowest_hp_enemy').targetId).toBe(enemyIds[0]);
    expect(pickWith('highest_hp_enemy').targetId).toBe(enemyIds[1]);
    expect(pickWith('highest_atk_enemy').targetId).toBe(enemyIds[3]);
    expect(pickWith('fastest_enemy').targetId).toBe(enemyIds[3]);
    expect(pickWith('enemy_support_first').targetId).toBe(enemyIds[2]);
    expect(pickWith('enemy_sniper_first').targetId).toBe(enemyIds[3]);
    expect(pickWith('front_row_first').targetId).toBe(enemyIds[0]); // front row lowest hp
    expect(pickWith('back_row_first').targetId).toBe(enemyIds[3]); // back row lowest hp (110 < 140)
    expect(pickWith('same_as_last_turn').targetId).toBe(enemyIds[2]);
    expect(pickWith('random_enemy', 0.01).targetId).toBe(
      pickWith('random_enemy', 0.01).targetId
    );

    // Conditions: boss_present, first_round, round_eq, target_has_shield, target_hp_below, my_sp_gte, my_buff_not_active, skill_off_cooldown
    const condCheck = (
      condition: GearTacticsProfile['rules'][number]['condition'],
      targetSelector: GearTacticsProfile['rules'][number]['targetSelector'] = 'lowest_hp_enemy',
      overrideState: BattleState = state,
      overrideActor: CombatUnit = actor
    ) =>
      chooseAction(
        overrideState,
        overrideActor,
        {
          safety: createDefaultAutoSafety(),
          rules: [
            {
              id: 'cond',
              enabled: true,
              condition,
              action: { type: 'defend' },
              targetSelector,
            },
          ],
        },
        () => 0.5
      ).matchedRuleIndex === 0;

    expect(condCheck({ kind: 'boss_present' })).toBe(true);
    expect(condCheck({ kind: 'first_round' })).toBe(true);
    expect(condCheck({ kind: 'round_eq', value: 1 })).toBe(true);
    expect(condCheck({ kind: 'round_eq', value: 3 })).toBe(false);
    expect(condCheck({ kind: 'target_has_shield' }, 'highest_hp_enemy')).toBe(true);
    expect(condCheck({ kind: 'target_has_shield' }, 'lowest_hp_enemy')).toBe(false);
    expect(condCheck({ kind: 'target_hp_below', value: 30 }, 'lowest_hp_enemy')).toBe(true); // 50/200 = 25%
    expect(condCheck({ kind: 'my_sp_gte', value: 60 })).toBe(true);
    expect(condCheck({ kind: 'my_sp_lt', value: 60 })).toBe(false);
    expect(condCheck({ kind: 'my_shield_zero' })).toBe(false);
    expect(
      condCheck({ kind: 'my_shield_zero' }, 'self', state, { ...actor, shield: 0 })
    ).toBe(true);
    expect(condCheck({ kind: 'my_buff_not_active', buffType: 'def_up' })).toBe(true);
    expect(
      condCheck({ kind: 'skill_off_cooldown', skillId: 'gen_hull_brace' })
    ).toBe(true);
    expect(condCheck({ kind: 'enemy_count_gte', value: 4 })).toBe(true);
    expect(condCheck({ kind: 'enemy_count_gte', value: 5 })).toBe(false);

    // any_ally_has_debuff & any_enemy_stealthed
    const debuffedState: BattleState = {
      ...state,
      units: state.units.map((u) =>
        u.id === 'ally_npc_1'
          ? { ...u, statuses: [{ type: 'burn', turnsRemaining: 2, isDebuff: true }] }
          : u.id === enemyIds[2]
          ? { ...u, statuses: [{ type: 'stealth', turnsRemaining: 2 }] }
          : u
      ),
    };
    expect(condCheck({ kind: 'any_ally_has_debuff' }, 'all_allies', debuffedState)).toBe(true);
    expect(condCheck({ kind: 'any_enemy_stealthed' }, 'lowest_hp_enemy', debuffedState)).toBe(true);
  });
});

describe('14. Tactics Engine Class-Lock Enforcement & v6 Save Migration', () => {
  it('strips cross-class skills in sanitizeGearTactics, clamps max 8 rules, and blocks cross-class skills in chooseAction', () => {
    const rawRules = Array.from({ length: 12 }, (_, idx) => ({
      id: `r_${idx}`,
      enabled: true,
      condition: { kind: 'always' as const },
      action:
        idx === 0
          ? { type: 'skill' as const, skillId: 'sup_nanite_mend' } // Support skill injected into Striker!
          : idx === 1
          ? { type: 'skill' as const, skillId: 'sge_starbreaker_lance' } // Siege skill injected into Striker!
          : { type: 'skill' as const, skillId: 'gen_hull_brace' }, // General skill allowed
      targetSelector: 'self' as const,
    }));

    const sanitized = sanitizeGearTactics('striker', {
      rules: rawRules,
      safety: createDefaultAutoSafety(),
    });
    expect(sanitized.rules).toHaveLength(BALANCE_CONFIG.maxTacticsRules);
    expect(sanitized.rules[0].action).toEqual({ type: 'attack' });
    expect(sanitized.rules[1].action).toEqual({ type: 'attack' });
    expect(sanitized.rules[2].action).toEqual({
      type: 'skill',
      skillId: 'gen_hull_brace',
    });

    // Even if raw unsanitized tactics with a cross-class skill are passed directly to chooseAction, engine skips it!
    const pilot = createDefaultPilotAccount('Kira', 'striker');
    const battle = createInitialBattleState(pilot, SECTORS_CATALOG[0].id);
    const player = battle.units.find((u) => u.isPlayer)!;
    const tamperedTactics: GearTacticsProfile = {
      safety: createDefaultAutoSafety(),
      rules: [
        {
          id: 'cheat_cross',
          enabled: true,
          condition: { kind: 'always' },
          action: { type: 'skill', skillId: 'sup_nanite_mend' },
          targetSelector: 'self',
        },
        {
          id: 'valid_def',
          enabled: true,
          condition: { kind: 'always' },
          action: { type: 'defend' },
          targetSelector: 'self',
        },
      ],
    };

    const chosen = chooseAction(battle, player, tamperedTactics, () => 0.5);
    expect(chosen.action).toBe('defend');
    expect(chosen.matchedRuleIndex).toBe(1);

    // Preset generation produces only class-legal rules
    for (const preset of ['class_default', 'balanced', 'focus_weak', 'defensive'] as const) {
      const profile = createPresetTactics(
        'interceptor',
        preset,
        pilot.gears.interceptor.equippedSkillBar
      );
      expect(profile.rules.length).toBeGreaterThan(0);
      expect(profile.rules.length).toBeLessThanOrEqual(BALANCE_CONFIG.maxTacticsRules);
    }
  });

  it('migrates v5 saves to v6 with per-Gear default tactics and strips illegal cross-class tactics rules', () => {
    const v5Pilot = createDefaultPilotAccount('Nova', 'interceptor');
    // Simulate older v5 gear missing tactics + tampered tactics on striker
    const tamperedV5 = {
      pilot: {
        ...v5Pilot,
        gears: {
          ...v5Pilot.gears,
          interceptor: { ...v5Pilot.gears.interceptor, tactics: undefined },
          striker: {
            ...v5Pilot.gears.striker,
            tactics: {
              safety: createDefaultAutoSafety(),
              rules: [
                {
                  id: 'bad',
                  enabled: true,
                  condition: { kind: 'always' },
                  action: { type: 'skill', skillId: 'sup_war_hymn' },
                  targetSelector: 'all_allies',
                },
              ],
            },
          },
        },
      },
    };

    const migrated = migrateSaveData(tamperedV5, 5, () => 0.5);
    expect(migrated.pilot.gears.interceptor.tactics.rules.length).toBeGreaterThan(0);
    expect(migrated.pilot.gears.striker.tactics.rules[0].action).toEqual({
      type: 'attack',
    });
  });
});

describe('15. Auto Safety Stops & Auto-Repeat Stop Conditions', () => {
  it('evaluates low HP, auto-retreat, boss present, and elite ready safety triggers accurately', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    pilot.gears.striker.level = 30;
    pilot.gears.striker.skillLevels = { str_skyfall_protocol: 1 };
    pilot.gears.striker.equippedSkillBar = ['str_skyfall_protocol'];

    const battle = createInitialBattleState(pilot, SECTORS_CATALOG[0].id);
    const player = battle.units.find((u) => u.isPlayer)!;
    const baseSafety = createDefaultAutoSafety();

    // Default safety has all stops OFF
    expect(evaluateAutoSafety(battle, player, baseSafety)).toEqual({
      shouldStopAuto: false,
      shouldRetreat: false,
      reason: null,
    });

    // 1) Low HP pause
    const lowHpActor: CombatUnit = {
      ...player,
      hp: Math.floor(player.derived.maxHp * 0.2),
    };
    const lowHpStop = evaluateAutoSafety(battle, lowHpActor, {
      ...baseSafety,
      stopOnLowHpEnabled: true,
      stopOnLowHpPct: 25,
    });
    expect(lowHpStop).toEqual({
      shouldStopAuto: true,
      shouldRetreat: false,
      reason: 'low_hp',
    });

    // 2) Auto-retreat overrides low HP pause when HP < autoRetreatLowHpPct
    const criticalActor: CombatUnit = {
      ...player,
      hp: Math.floor(player.derived.maxHp * 0.1),
    };
    const retreatStop = evaluateAutoSafety(battle, criticalActor, {
      ...baseSafety,
      stopOnLowHpEnabled: true,
      stopOnLowHpPct: 25,
      autoRetreatLowHpEnabled: true,
      autoRetreatLowHpPct: 15,
    });
    expect(retreatStop).toEqual({
      shouldStopAuto: true,
      shouldRetreat: true,
      reason: 'auto_retreat',
    });

    // 3) Boss present pause
    const bossBattle: BattleState = {
      ...battle,
      units: battle.units.map((u, idx) =>
        u.side === 'enemy' && idx === 4 ? { ...u, isBoss: true } : u
      ),
    };
    const bossStop = evaluateAutoSafety(bossBattle, player, {
      ...baseSafety,
      stopOnBossPresent: true,
    });
    expect(bossStop.shouldStopAuto).toBe(true);
    expect(bossStop.reason).toBe('boss_present');

    // 4) Elite skill ready pause (requires sufficient SP)
    const eliteReadyActor: CombatUnit = {
      ...player,
      sp: 80,
      derived: { ...player.derived, maxSp: 100 },
    };
    const eliteStop = evaluateAutoSafety(battle, eliteReadyActor, {
      ...baseSafety,
      stopOnEliteReady: true,
    });
    expect(eliteStop.shouldStopAuto).toBe(true);
    expect(eliteStop.reason).toBe('elite_ready');
  });

  it('stops Auto-Repeat on retreat, defeat, inventory full, or target run limit reached', () => {
    const baseSession: AutoRepeatSession = {
      active: true,
      sectorId: SECTORS_CATALOG[0].id,
      limit: 5,
      completedRuns: 2,
      wins: 2,
      totalExp: 200,
      totalCredits: 500,
      totalWarPoints: 25,
      totalDrops: [],
      stopReason: null,
    };

    // Continues on victory under limit with free inventory space
    expect(shouldStopAutoRepeat(baseSession, 'victory', false, 10)).toEqual({
      stop: false,
      reason: null,
    });

    // Stops on retreat
    expect(shouldStopAutoRepeat(baseSession, 'defeat', true, 10)).toEqual({
      stop: true,
      reason: 'retreat',
    });

    // Stops on defeat
    expect(shouldStopAutoRepeat(baseSession, 'defeat', false, 10)).toEqual({
      stop: true,
      reason: 'defeat',
    });

    // Stops on full inventory
    expect(
      shouldStopAutoRepeat(
        baseSession,
        'victory',
        false,
        BALANCE_CONFIG.maxInventorySize
      )
    ).toEqual({
      stop: true,
      reason: 'inventory_full',
    });

    // Stops when completedRuns reaches limit
    expect(
      shouldStopAutoRepeat({ ...baseSession, completedRuns: 5 }, 'victory', false, 10)
    ).toEqual({
      stop: true,
      reason: 'completed',
    });

    // Infinite mode continues past 5 runs on victory
    expect(
      shouldStopAutoRepeat(
        { ...baseSession, limit: 'infinite', completedRuns: 25 },
        'victory',
        false,
        10
      )
    ).toEqual({
      stop: false,
      reason: null,
    });
  });
});

describe('16. Scalable Battle Sizes (4v4, 6v6, 8v8) & 3-Row Formations', () => {
  it('spawns 4v4, 6v6, and 8v8 battles with 3-row Front/Middle/Back formations respecting capacities and sequential columns', () => {
    const pilot = createDefaultPilotAccount('Vanguard', 'striker');
    pilot.gears.striker.level = 15;

    const sizes = [
      { size: 4 as const, sectorId: 'border_outpost' },
      { size: 6 as const, sectorId: 'debris_belt' },
      { size: 8 as const, sectorId: 'iron_citadel' },
    ];

    for (const cfg of sizes) {
      const battle = createInitialBattleState(
        pilot,
        cfg.sectorId,
        createSequenceRng([0.15, 0.45, 0.75, 0.9]),
        cfg.size
      );

      expect(battle.squadSize).toBe(cfg.size);
      const allies = battle.units.filter((u) => u.side === 'ally');
      const enemies = battle.units.filter((u) => u.side === 'enemy');
      expect(allies).toHaveLength(cfg.size);
      expect(enemies).toHaveLength(cfg.size);

      // Verify 3-row capacities (defaults: front 3, middle 3, back 2) & sequential columns on both sides
      for (const sideUnits of [allies, enemies]) {
        const front = sideUnits.filter((u) => u.row === 'front');
        const middle = sideUnits.filter((u) => u.row === 'middle');
        const back = sideUnits.filter((u) => u.row === 'back');

        expect(front.length + middle.length + back.length).toBe(cfg.size);
        expect(front.length).toBeLessThanOrEqual(3);
        expect(middle.length).toBeLessThanOrEqual(3);
        expect(back.length).toBeLessThanOrEqual(2);

        for (const rowUnits of [front, middle, back]) {
          const expectedCols = Array.from(
            { length: rowUnits.length },
            (_, i) => i
          );
          expect(
            rowUnits.map((u) => u.formationCol ?? 0).sort((a, b) => a - b)
          ).toEqual(expectedCols);
        }
      }

      // Fortress (6v6) and Capital (8v8) battles feature structure/boss tokens
      if (cfg.size >= 6) {
        expect(enemies.some((e) => e.isStructure || e.isBoss)).toBe(true);
      }
      if (cfg.size === 8) {
        expect(enemies.some((e) => e.isBoss)).toBe(true);
      }
    }
  });
});

describe('17. 3-Row Targeting, Long-Range Bypass & Adjacent Formation Splash', () => {
  it('blocks non-front enemy rows from basic attacks while Front lives, unlocks Middle then Back, and lets long-range bypass', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    pilot.gears.striker.level = 20;
    pilot.gears.striker.skillLevels = { str_carpet_salvo: 1 };
    pilot.gears.striker.equippedSkillBar = ['str_carpet_salvo'];

    const battle = createInitialBattleState(
      pilot,
      'debris_belt',
      createSequenceRng([0.2, 0.5, 0.8]),
      6
    );
    const player = battle.units.find((u) => u.isPlayer)!;
    // Arrange enemies deterministically: 2 front, 2 middle, 2 back
    const enemies = battle.units.filter((u) => u.side === 'enemy');
    const rowByEnemyId = new Map<string, 'front' | 'middle' | 'back'>([
      [enemies[0].id, 'front'],
      [enemies[1].id, 'front'],
      [enemies[2].id, 'middle'],
      [enemies[3].id, 'middle'],
      [enemies[4].id, 'back'],
      [enemies[5].id, 'back'],
    ]);
    const unitsHighHp = battle.units.map((u) => ({
      ...u,
      row: rowByEnemyId.get(u.id) ?? u.row,
      hp: 1000,
      shield: 0,
      derived: { ...u.derived, maxHp: 1000, dodgeChance: 0 },
    }));

    const backTarget = unitsHighHp.find(
      (u) => u.side === 'enemy' && u.row === 'back'
    )!;

    // 1) Standard basic attack only sees Front row while Front row lives
    expect(isLongRangeAction(player, 'attack')).toBe(false);
    const basicValid = getValidEnemyTargets(unitsHighHp, player, 'attack');
    expect(basicValid.every((u) => u.row === 'front')).toBe(true);
    expect(basicValid).toHaveLength(2);

    // Attempting a basic attack aimed at a Back-row enemy redirects to a Front-row enemy
    const redirected = resolveUnitAction(
      unitsHighHp,
      player.id,
      'attack',
      backTarget.id,
      1,
      undefined,
      () => 0.99
    );
    expect(
      redirected.updatedUnits.find((u) => u.id === backTarget.id)!.hp
    ).toBe(1000);
    expect(
      redirected.updatedUnits.some(
        (u) => u.side === 'enemy' && u.row === 'front' && u.hp < 1000
      )
    ).toBe(true);

    // 2) Long-range Siege Mode bypasses Front & Middle and hits the Back-row target directly
    const unitsSiegeMode = unitsHighHp.map((u) =>
      u.id === player.id
        ? {
            ...u,
            statuses: [{ type: 'siege_mode' as const, turnsRemaining: 99 }],
          }
        : u
    );
    const siegePlayer = unitsSiegeMode.find((u) => u.isPlayer)!;
    expect(isLongRangeAction(siegePlayer, 'attack')).toBe(true);
    expect(
      getValidEnemyTargets(unitsSiegeMode, siegePlayer, 'attack')
    ).toHaveLength(6);

    const longRangeHit = resolveUnitAction(
      unitsSiegeMode,
      player.id,
      'attack',
      backTarget.id,
      1,
      undefined,
      () => 0.99
    );
    expect(
      longRangeHit.updatedUnits.find((u) => u.id === backTarget.id)!.hp
    ).toBeLessThan(1000);

    // 3) Missile skill (str_carpet_salvo) is long-range and can target Back row
    expect(isLongRangeAction(player, 'skill', 'str_carpet_salvo')).toBe(true);

    // 4) Once Front-row enemies are destroyed, Middle row becomes exposed
    const frontClearedUnits = unitsHighHp.map((u) =>
      u.side === 'enemy' && u.row === 'front' ? { ...u, hp: 0, alive: false } : u
    );
    const middleTargets = getValidEnemyTargets(
      frontClearedUnits,
      player,
      'attack'
    );
    expect(middleTargets).toHaveLength(2);
    expect(middleTargets.every((u) => u.row === 'middle')).toBe(true);

    // 5) Once Middle-row enemies are also destroyed, Back row becomes exposed
    const frontAndMidCleared = frontClearedUnits.map((u) =>
      u.side === 'enemy' && u.row === 'middle'
        ? { ...u, hp: 0, alive: false }
        : u
    );
    const backTargets = getValidEnemyTargets(
      frontAndMidCleared,
      player,
      'attack'
    );
    expect(backTargets).toHaveLength(2);
    expect(backTargets.every((u) => u.row === 'back')).toBe(true);
  });

  it('hits only adjacent columns (col - 1, col + 1) in the same formation row on splash attacks', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    pilot.gears.striker.level = 20;
    pilot.gears.striker.skillLevels = { str_carpet_salvo: 1 };
    pilot.gears.striker.equippedSkillBar = ['str_carpet_salvo'];

    const battle = createInitialBattleState(
      pilot,
      'iron_citadel',
      createSequenceRng([0.2, 0.5, 0.8]),
      8,
      {
        formation: {
          rowCapacities: { front: 4, middle: 2, back: 2 },
          maxUnitsPerSide: 8,
          rowModifiers: {
            front: { defensePct: 0.1, damagePct: 0, rangedDamagePct: 0 },
            middle: { defensePct: 0, damagePct: 0, rangedDamagePct: 0 },
            back: { defensePct: -0.1, damagePct: 0, rangedDamagePct: 0.1 },
          },
        },
      }
    );

    // Put 4 enemies in Front (cols 0..3), 2 in Middle, 2 in Back
    const enemies = battle.units.filter((u) => u.side === 'enemy');
    const enemyPlacement = new Map<
      string,
      { row: 'front' | 'middle' | 'back'; col: number }
    >([
      [enemies[0].id, { row: 'front', col: 0 }],
      [enemies[1].id, { row: 'front', col: 1 }],
      [enemies[2].id, { row: 'front', col: 2 }],
      [enemies[3].id, { row: 'front', col: 3 }],
      [enemies[4].id, { row: 'middle', col: 0 }],
      [enemies[5].id, { row: 'middle', col: 1 }],
      [enemies[6].id, { row: 'back', col: 0 }],
      [enemies[7].id, { row: 'back', col: 1 }],
    ]);

    const units = battle.units.map((u) => {
      const placed = enemyPlacement.get(u.id);
      if (u.isPlayer) {
        return { ...u, sp: 100, derived: { ...u.derived, maxSp: 100 } };
      }
      return {
        ...u,
        ...(placed ? { row: placed.row, formationCol: placed.col } : {}),
        hp: 1000,
        shield: 0,
        derived: { ...u.derived, maxHp: 1000, dodgeChance: 0 },
      };
    });

    const enemyFront = units
      .filter((u) => u.side === 'enemy' && u.row === 'front')
      .sort((a, b) => (a.formationCol ?? 0) - (b.formationCol ?? 0));
    const enemyOtherRows = units.filter(
      (u) => u.side === 'enemy' && u.row !== 'front'
    );
    expect(enemyFront).toHaveLength(4);

    // Adjacent to col 1 -> col 0 and col 2 ONLY (not col 3, not Middle/Back row)
    const adjToCol1 = getAdjacentUnits(units, enemyFront[1]);
    expect(adjToCol1.map((u) => u.id).sort()).toEqual(
      [enemyFront[0].id, enemyFront[2].id].sort()
    );

    // Adjacent to col 0 (edge) -> col 1 ONLY
    const adjToCol0 = getAdjacentUnits(units, enemyFront[0]);
    expect(adjToCol0.map((u) => u.id)).toEqual([enemyFront[1].id]);

    // Casting splash_attack skill (str_carpet_salvo) on col 1 hits col 1 + col 0 + col 2, NOT col 3 or Middle/Back
    const splashRes = resolveUnitAction(
      units,
      'ally_player',
      'skill',
      enemyFront[1].id,
      1,
      undefined,
      () => 0.99,
      'str_carpet_salvo'
    );

    const after = splashRes.updatedUnits;
    expect(after.find((u) => u.id === enemyFront[1].id)!.hp).toBeLessThan(1000);
    expect(after.find((u) => u.id === enemyFront[0].id)!.hp).toBeLessThan(1000);
    expect(after.find((u) => u.id === enemyFront[2].id)!.hp).toBeLessThan(1000);
    // Col 3 (non-adjacent) and all Middle/Back-row enemies must remain untouched
    expect(after.find((u) => u.id === enemyFront[3].id)!.hp).toBe(1000);
    for (const otherUnit of enemyOtherRows) {
      expect(after.find((u) => u.id === otherUnit.id)!.hp).toBe(1000);
    }
  });
});

describe('18. Conveyor Turn Queue (Dead Removal, Summon/Revive Insertion & Round Boundary)', () => {
  it('excludes dead units from upcoming/nextRound and cleanly inserts newly spawned/revived units in Speed order', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    const battle = createInitialBattleState(
      pilot,
      'border_outpost',
      createSequenceRng([0.2, 0.5, 0.8])
    );

    const aliveOrder = sortTurnOrder(battle.units);
    const deadId = aliveOrder[2];
    const unitsWithDeath = battle.units.map((u) =>
      u.id === deadId ? { ...u, hp: 0, alive: false } : u
    );

    // Reconcile while unit 0 is acting
    const reconciled = reconcileRemainingTurnOrder(aliveOrder, 0, unitsWithDeath);
    expect(reconciled.includes(deadId)).toBe(false);

    // Spawn a brand-new reinforcement unit mid-round with high speed
    const templateUnit = battle.units.find((u) => u.side === 'ally')!;
    const reinforcement: CombatUnit = {
      ...templateUnit,
      id: 'ally_reinforce_1',
      name: 'Reinforce-1',
      callsign: 'Reinforce-1',
      isPlayer: false,
      alive: true,
      hp: 200,
      derived: { ...templateUnit.derived, speed: 999 },
    };
    const unitsWithReinforce = [...unitsWithDeath, reinforcement];
    const reconciledWithReinforce = reconcileRemainingTurnOrder(
      reconciled,
      0,
      unitsWithReinforce
    );

    // Active unit remains at index 0; reinforcement inserts immediately at index 1 due to SPD 999
    expect(reconciledWithReinforce[0]).toBe(aliveOrder[0]);
    expect(reconciledWithReinforce[1]).toBe('ally_reinforce_1');

    const queue = buildTurnQueue({
      ...battle,
      round: 3,
      turnOrder: reconciledWithReinforce,
      activeTurnIndex: 0,
      units: unitsWithReinforce,
    });

    expect(queue.current[0]?.unitId).toBe(aliveOrder[0]);
    expect(queue.current[1]?.unitId).toBe('ally_reinforce_1');
    expect(queue.current.some((e) => e.unitId === deadId)).toBe(false);
    expect(queue.next.some((e) => e.unitId === deadId)).toBe(false);
    // Next round strictly sorted by speed DESC, so SPD 999 reinforcement is first in Round 4
    expect(queue.next[0]?.unitId).toBe('ally_reinforce_1');
  });
});

describe('19. Structured Battle Events & Battle Statistics Aggregation', () => {
  it('aggregates damage, shield vs HP split, crits, dodges, heals, kills, SP spent, per-skill breakdown, round curves, and MVPs', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    pilot.gears.striker.level = 15;
    pilot.gears.striker.skillLevels = { str_viper_sweep: 2 };
    pilot.gears.striker.equippedSkillBar = ['str_viper_sweep'];

    const battle = createInitialBattleState(
      pilot,
      'border_outpost',
      createSequenceRng([0.2, 0.5, 0.8])
    );
    const enemy = battle.units.find((u) => u.side === 'enemy' && u.row === 'front')!;

    // Set up deterministic stats so attacks land cleanly
    let units = battle.units.map((u) =>
      u.isPlayer
        ? {
            ...u,
            sp: 100,
            derived: { ...u.derived, maxSp: 100, attackPower: 120, critChance: 0 },
          }
        : u.id === enemy.id
        ? {
            ...u,
            hp: 500,
            shield: 60,
            derived: { ...u.derived, maxHp: 500, maxShield: 60, dodgeChance: 0 },
          }
        : u
    );

    const res1 = resolveUnitAction(
      units,
      'ally_player',
      'skill',
      enemy.id,
      1,
      undefined,
      () => 0.99,
      'str_viper_sweep'
    );
    units = res1.updatedUnits;

    const snap1 = createRoundHpSnapshot(1, units);
    const summary = aggregateBattleStats(
      units,
      res1.events,
      [...battle.roundSnapshots, snap1],
      1
    );

    const playerRow = summary.units.find((u) => u.unitId === 'ally_player')!;
    const enemyRow = summary.units.find((u) => u.unitId === enemy.id)!;

    expect(playerRow.turnsTaken).toBe(1);
    expect(playerRow.spSpent).toBeGreaterThan(0);
    expect(playerRow.damageDealt).toBeGreaterThan(0);
    expect(playerRow.hits).toBeGreaterThan(0);
    expect(playerRow.skills['str_viper_sweep']?.uses).toBe(1);

    // Enemy absorbed some damage on shield and took the rest on HP
    expect(enemyRow.damageTakenTotal).toBe(
      enemyRow.damageTakenHp + enemyRow.damageTakenShield
    );
    expect(enemyRow.shieldAbsorbed).toBeGreaterThan(0);

    // Team totals match sum of units
    expect(summary.ally.damageDealt).toBeGreaterThan(0);
    expect(summary.roundDamageSeries.length).toBeGreaterThanOrEqual(1);
    expect(summary.roundHpSeries.length).toBeGreaterThanOrEqual(1);
    expect(summary.mvps.mostDamage?.unitId).toBe('ally_player');
  });
});

describe('20. Simple Auto Tactics Compiler & Presets', () => {
  it('compiles all 5 Simple presets and custom 5-control configs into strictly class-legal rules + safety config', () => {
    const pilot = createDefaultPilotAccount('Ace', 'support');
    pilot.gears.support.level = 30;
    pilot.gears.support.skillLevels = {
      sup_nanite_mend: 2,
      sup_war_hymn: 1,
      sup_genesis_wave: 1, // Elite
      gen_hull_brace: 1,
    };
    pilot.gears.support.equippedSkillBar = [
      'sup_nanite_mend',
      'sup_war_hymn',
      'sup_genesis_wave',
      'gen_hull_brace',
    ];

    const presets = [
      'balanced',
      'aggressive',
      'defensive',
      'support_team',
      'save_sp',
    ] as const;

    for (const presetId of presets) {
      const cfg = createSimplePresetConfig(
        presetId,
        'support',
        pilot.gears.support.equippedSkillBar
      );
      const compiled = generateTacticsFromSimple(
        'support',
        cfg,
        pilot.gears.support.equippedSkillBar
      );
      expect(compiled.rules.length).toBeGreaterThan(0);
      expect(compiled.rules.length).toBeLessThanOrEqual(
        BALANCE_CONFIG.maxTacticsRules
      );
      // Every generated skill rule must belong to support or general
      for (const r of compiled.rules) {
        if (r.action.type === 'skill' && r.action.skillId) {
          const sk = getSkillById(r.action.skillId)!;
          expect(['support', 'general']).toContain(sk.classScope);
        }
      }
    }

    // Specific controls: save_sp_50 uses my_sp_pct_gte 50, retreat enables autoRetreatLowHpEnabled, boss_only Elite uses boss_present
    const customSimple = {
      presetId: 'balanced' as const,
      preferredTarget: 'sniper_first' as const,
      skillUsage: 'save_sp_50' as const,
      lowHpThresholdPct: 30,
      lowHpAction: 'retreat' as const,
      elitePolicy: 'boss_only' as const,
      prioritySkillIds: ['sup_war_hymn'],
    };
    const compiledCustom = generateTacticsFromSimple(
      'support',
      customSimple,
      pilot.gears.support.equippedSkillBar
    );

    expect(compiledCustom.safety.autoRetreatLowHpEnabled).toBe(true);
    expect(compiledCustom.safety.autoRetreatLowHpPct).toBe(30);
    expect(
      compiledCustom.rules.some(
        (r) =>
          r.action.type === 'skill' &&
          r.action.skillId === 'sup_genesis_wave' &&
          r.condition.kind === 'boss_present'
      )
    ).toBe(true);
    expect(
      compiledCustom.rules.some(
        (r) =>
          r.action.type === 'skill' &&
          r.action.skillId === 'sup_war_hymn' &&
          r.condition.kind === 'my_sp_pct_gte' &&
          r.condition.value === 50
      )
    ).toBe(true);
    expect(
      compiledCustom.rules.some(
        (r) =>
          r.action.type === 'attack' &&
          r.targetSelector === 'enemy_sniper_first'
      )
    ).toBe(true);
  });
});

describe('21. Anti-Stalemate Soft Enrage (Round 20+)', () => {
  it('computes +10%/round after Round 20 capped at +200%, respects Admin toggle, and scales enemy damage in combat', () => {
    expect(getEnemyEnrageBonusPct(1, true)).toBe(0);
    expect(getEnemyEnrageBonusPct(20, true)).toBe(0);
    expect(getEnemyEnrageBonusPct(21, true)).toBeCloseTo(0.1, 5);
    expect(getEnemyEnrageBonusPct(25, true)).toBeCloseTo(0.5, 5);
    expect(getEnemyEnrageBonusPct(40, true)).toBeCloseTo(2.0, 5);
    expect(getEnemyEnrageBonusPct(99, true)).toBeCloseTo(2.0, 5);
    // Admin disable -> 0 even at Round 50
    expect(getEnemyEnrageBonusPct(50, false)).toBe(0);

    // Combat check: enemy attack deals higher damage at Round 35 than Round 1
    const pilot = createDefaultPilotAccount('Ace', 'siege');
    const battle = createInitialBattleState(pilot, 'border_outpost');
    const enemy = battle.units.find((u) => u.side === 'enemy')!;
    const baseUnits = battle.units.map((u) =>
      u.isPlayer
        ? {
            ...u,
            hp: 5000,
            shield: 0,
            derived: { ...u.derived, maxHp: 5000, dodgeChance: 0, defenseRating: 5 },
          }
        : u.id === enemy.id
        ? { ...u, derived: { ...u.derived, attackPower: 100, critChance: 0 } }
        : u
    );

    const enrageOnCfg = { ...createDefaultAdminConfig(), softEnrageEnabled: true };
    const enrageOffCfg = { ...createDefaultAdminConfig(), softEnrageEnabled: false };

    const hitR1 = resolveUnitAction(
      baseUnits,
      enemy.id,
      'attack',
      'ally_player',
      1,
      enrageOnCfg,
      () => 0.99
    );
    const hitR35 = resolveUnitAction(
      baseUnits,
      enemy.id,
      'attack',
      'ally_player',
      35,
      enrageOnCfg,
      () => 0.99
    );
    const hitR35Disabled = resolveUnitAction(
      baseUnits,
      enemy.id,
      'attack',
      'ally_player',
      35,
      enrageOffCfg,
      () => 0.99
    );

    const dmgR1 = 5000 - hitR1.updatedUnits.find((u) => u.isPlayer)!.hp;
    const dmgR35 = 5000 - hitR35.updatedUnits.find((u) => u.isPlayer)!.hp;
    const dmgR35Disabled =
      5000 - hitR35Disabled.updatedUnits.find((u) => u.isPlayer)!.hp;

    expect(dmgR35).toBeGreaterThan(dmgR1 * 2); // Round 35 = +150% = 2.5x damage
    expect(dmgR35Disabled).toBe(dmgR1);
  });
});

describe('22. Map UI World Rules (Base Shapes, Battle Sizes, Damaged Capture, Repair & Pilot-for-Hire)', () => {
  it('maps base types to round/square tokens and 4v4 / 6v6 / 8v8+Boss battle sizes', () => {
    expect(getTokenShapeForBaseType('outpost')).toBe('round');
    expect(getTokenShapeForBaseType('colony')).toBe('round');
    expect(getTokenShapeForBaseType('relay')).toBe('round');
    expect(getTokenShapeForBaseType('fortress')).toBe('square');
    expect(getTokenShapeForBaseType('shipyard')).toBe('square');
    expect(getTokenShapeForBaseType('capital')).toBe('square');

    expect(getBattleSizeForBaseType('outpost')).toBe(4);
    expect(getBattleSizeForBaseType('colony')).toBe(4);
    expect(getBattleSizeForBaseType('relay')).toBe(4);
    expect(getBattleSizeForBaseType('fortress')).toBe(6);
    expect(getBattleSizeForBaseType('shipyard')).toBe(6);
    expect(getBattleSizeForBaseType('capital')).toBe(8);
    expect(getSectorById('iron_citadel').hasBoss).toBe(true);
  });

  it('marks freshly captured bases as Damaged (0 income, services offline) until repaired over 1-2 months, and deploys hired wingmen', () => {
    let pilot = createDefaultPilotAccount('Commander', 'striker');
    pilot.credits = 5000;

    // Hire Pilot-for-Hire at Aegis Relay while operational -> spawns +1 extra allied wingman in next battle
    const hireOk = hirePilotForNextBattle(pilot, 'aegis_relay', 'siege');
    expect(hireOk.ok).toBe(true);
    pilot = hireOk.pilot;
    expect(pilot.hiredWingman?.classId).toBe('siege');

    const battle = createInitialBattleState(pilot, 'border_outpost');
    const allies = battle.units.filter((u) => u.side === 'ally');
    expect(allies).toHaveLength(battle.squadSize + 1);
    expect(allies.some((a) => a.id === 'ally_hired_merc')).toBe(true);

    // Freshly capture hostile Fortress (debris_belt, 2 months repair)
    const capture = applyBattleBaseConsequences(pilot, 'debris_belt', true);
    pilot = capture.pilot;
    expect(capture.capturedFreshly).toBe(true);

    const damagedState = getBaseState(pilot, 'debris_belt');
    expect(damagedState.faction).toBe('allied');
    expect(damagedState.status).toBe('damaged');
    expect(getBaseMonthlyIncome(getSectorById('debris_belt'), damagedState)).toEqual({
      credits: 0,
      warPoints: 0,
    });
    expect(isBaseServicesAvailable(damagedState)).toBe(false);

    // Hiring a wingman at a Damaged base is rejected
    const hireBlocked = hirePilotForNextBattle(pilot, 'debris_belt', 'interceptor');
    expect(hireBlocked.ok).toBe(false);
    expect(hireBlocked.reason).toBe('not_operational');

    // Pay Credits to begin 2-month repair
    const repairRes = startBaseRepair(pilot, 'debris_belt');
    expect(repairRes.ok).toBe(true);
    pilot = repairRes.pilot;
    expect(getBaseState(pilot, 'debris_belt').status).toBe('repairing');
    expect(getBaseState(pilot, 'debris_belt').repairMonthsRemaining).toBe(2);

    // Month +1 -> still repairing (1 month left)
    const m1 = advanceCampaignMonth(pilot);
    pilot = m1.pilot;
    expect(getBaseState(pilot, 'debris_belt').status).toBe('repairing');
    expect(getBaseState(pilot, 'debris_belt').repairMonthsRemaining).toBe(1);

    // Month +2 -> debris_belt completes repair to Operational; unanswered raid damages aegis_relay
    const m2 = advanceCampaignMonth(pilot);
    pilot = m2.pilot;
    const opState = getBaseState(pilot, 'debris_belt');
    expect(opState.status).toBe('operational');
    expect(isBaseServicesAvailable(opState)).toBe(true);
    expect(getBaseMonthlyIncome(getSectorById('debris_belt'), opState).credits).toBeGreaterThan(0);
    expect(getBaseState(pilot, 'aegis_relay').status).toBe('damaged');
  });
});



