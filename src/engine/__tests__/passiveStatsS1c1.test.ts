import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMBAT_FORMULAS } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import rawSkillsJson from '../../data/skills.json';
import {
  PASSIVE_STAT_KEYS,
  SKILLS_CATALOG,
  SKILLS_LIST,
  getScaledSkillStats,
  getSkillById,
  sanitizeSkillMods,
  validateSkillDefinitions,
} from '../../data/skills';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import type {
  AdminConfig,
  CombatUnit,
  GearUnit,
  MechClassId,
  PassiveStatKey,
  SkillModDefinition,
} from '../../types/game';
import { formatSkillRealSummary } from '../../utils/skillDisplay';
import {
  getEffectiveUnitDefense,
  resolveUnitAction,
} from '../combat';
import { createDefaultAdminConfig } from '../migration';
import {
  DEFAULT_SHIELD_REGEN_CONFIG,
  computeShieldRegenPct,
} from '../shieldRegen';
import {
  createEmptyGearPassiveBonuses,
  getGearPassiveBonuses,
} from '../skills';
import { getStatBreakdown } from '../statBreakdown';
import {
  calculateDerivedStats,
  calculateEffectiveStats,
  createDefaultGearUnit,
} from '../stats';

const ALL_16_PASSIVE_IDS = [
  'str_passive_ordnance',
  'str_passive_piercer',
  'str_passive_overcharge',
  'str_passive_killzone',
  'sge_passive_plating',
  'sge_passive_hull',
  'sge_passive_capbank',
  'sge_passive_last_stand',
  'int_passive_vectored',
  'int_passive_hunter',
  'int_passive_afterimage',
  'int_passive_finisher',
  'sup_passive_capacitor',
  'sup_passive_field_medic',
  'sup_passive_shield_tech',
  'sup_passive_reactor',
] as const;

function makeCombatUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'u1',
    name: 'Unit 1',
    callsign: 'U1',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    isPlayer: true,
    classId: 'striker',
    isBoss: false,
    level: 30,
    skillLevel: 1,
    skillLevels: {
      sup_nanite_mend: 1,
      sup_regen_grid: 1,
      sup_aegis_field: 1,
      sup_genesis_wave: 1,
      sge_bastion_lock: 1,
    },
    equippedSkillIds: [
      'sup_nanite_mend',
      'sup_regen_grid',
      'sup_aegis_field',
      'sup_genesis_wave',
      'sge_bastion_lock',
    ],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK, attack: 100, defense: 100, evasion: 10, shield: 100 },
    derived: {
      maxHp: 1000,
      maxShield: 500,
      maxSp: 200,
      speed: 100,
      attackPower: 100,
      defenseRating: 100,
      dodgeChance: 0,
      critChance: 100,
      skillPower: 50,
      armorPiercePct: 0,
      accuracyPct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    alive: true,
    hp: 1000,
    shield: 0,
    sp: 200,
    isDefending: false,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makePassiveStatMod(
  id: string,
  classScope: MechClassId | 'general',
  key: PassiveStatKey,
  perLevel: number
): SkillModDefinition {
  return {
    id,
    classScope,
    category: 'passive',
    icon: 'star',
    iconId: 'BF01',
    nameVi: `Mod ${id}`,
    nameEn: `Mod ${id}`,
    descVi: `Tăng ${key} +${perLevel} mỗi cấp.`,
    descEn: `Increases ${key} +${perLevel} per level.`,
    unlockLevel: 1,
    spCost: 0,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'passive_stat',
    passiveStats: [{ key, perLevel }],
    registryTag: 'mod',
  };
}

describe('TASK S1c-1: Generic passive_stat engine & 16 passives table', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) catalog loads all 50 skills (including 16 passives) with 0 dropped rows and no console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validated = validateSkillDefinitions(rawSkillsJson);

    expect(validated).toHaveLength(50);
    expect(SKILLS_LIST).toHaveLength(50);
    expect(warnSpy).not.toHaveBeenCalled();

    for (const id of ALL_16_PASSIVE_IDS) {
      const skill = SKILLS_CATALOG[id];
      expect(skill).toBeDefined();
      expect(skill.category).toBe('passive');
      expect(skill.effectKind).toBe('passive_stat');
      expect(skill.registryTag).toBe('sys');
      expect(skill.spCost).toBe(0);
      expect(skill.cooldown).toBe(0);
      expect(skill.targetType).toBe('self');
    }

    // Per-class unlock order: 1-10-20-30
    expect(SKILLS_CATALOG.sge_passive_plating.unlockLevel).toBe(1);
    expect(SKILLS_CATALOG.sge_passive_hull.unlockLevel).toBe(10);
    expect(SKILLS_CATALOG.sge_passive_capbank.unlockLevel).toBe(20);
    expect(SKILLS_CATALOG.sge_passive_last_stand.unlockLevel).toBe(30);

    // Gear with none of these passives learned gets zero bonuses (no change vs empty)
    const cleanGear = createDefaultGearUnit('striker', true);
    expect(getGearPassiveBonuses(cleanGear)).toEqual(createEmptyGearPassiveBonuses());
  });

  it('2) every PASSIVE_STAT_KEYS key affects the right stat and caps hold (crit 65, dodge 45, pierce 50)', () => {
    expect(PASSIVE_STAT_KEYS).toHaveLength(17);

    const baseGear = createDefaultGearUnit('striker', true);
    baseGear.level = 1;
    const baseStats = calculateEffectiveStats('striker', 1, baseGear.allocatedPoints);
    const baseDerived = calculateDerivedStats('striker', 1, baseStats);

    // Stat multipliers in calculateEffectiveStats
    const atkStats = calculateEffectiveStats('striker', 1, baseGear.allocatedPoints, EMPTY_STAT_BLOCK, EMPTY_STAT_BLOCK, undefined, {
      ...createEmptyGearPassiveBonuses(),
      attackPct: 0.25,
    });
    expect(atkStats.attack).toBe(Math.round(baseStats.attack * 1.25));

    const defStats = calculateEffectiveStats('striker', 1, baseGear.allocatedPoints, EMPTY_STAT_BLOCK, EMPTY_STAT_BLOCK, undefined, {
      ...createEmptyGearPassiveBonuses(),
      defPct: 0.2,
    });
    expect(defStats.defense).toBe(Math.round(baseStats.defense * 1.2));

    const evaStats = calculateEffectiveStats('striker', 1, baseGear.allocatedPoints, EMPTY_STAT_BLOCK, EMPTY_STAT_BLOCK, undefined, {
      ...createEmptyGearPassiveBonuses(),
      evaPct: 0.15,
    });
    expect(evaStats.evasion).toBe(Math.round(baseStats.evasion * 1.15));

    // Derived stat additions + combat passives + caps
    const boosted = calculateDerivedStats('striker', 1, baseStats, undefined, {
      ...createEmptyGearPassiveBonuses(),
      speedFlat: 7,
      spRegenFlat: 9,
      maxHpPct: 0.15,
      maxShieldPct: 0.25,
      critFlat: 100, // exceeds 65 cap
      dodgeFlat: 100, // exceeds 45 cap
      armorPierceFlat: 100, // exceeds 50 cap
      critDamagePct: 25,
      healPowerPct: 30,
      shieldPowerPct: 40,
      shieldRegenPctAdd: 1.5,
      hpRegenPctAdd: 0.9,
      executeDmgPct: 30,
      lastStandDefPct: 18,
    });

    expect(boosted.speed).toBe(baseDerived.speed + 7);
    expect(boosted.spRegenPerTurn).toBe(baseDerived.spRegenPerTurn + 9);
    expect(boosted.maxHp).toBe(Math.round(baseDerived.maxHp * 1.15));
    expect(boosted.maxShield).toBe(Math.round(baseDerived.maxShield * 1.25));
    expect(boosted.critChance).toBe(COMBAT_FORMULAS.maxCritChance);
    expect(boosted.dodgeChance).toBe(COMBAT_FORMULAS.maxDodgeChance);
    expect(boosted.armorPiercePct).toBe(50);
    expect(boosted.critDamagePct).toBe(25);
    expect(boosted.healPowerPct).toBe(30);
    expect(boosted.shieldPowerPct).toBe(40);
    expect(boosted.shieldRegenPctAdd).toBe(1.5);
    expect(boosted.hpRegenPctAdd).toBe(0.9);
    expect(boosted.executeDmgPct).toBe(30);
    expect(boosted.lastStandDefPct).toBe(18);
  });

  it('3) critDamagePct Lv5 gives 1.75x crit; executeDmgPct & lastStandDefPct activate strictly below 30% HP', () => {
    const overchargeLv5 = getScaledSkillStats(SKILLS_CATALOG.str_passive_overcharge, 5, {
      skillMaxLevel: 10,
      passiveScaleAfter5: 0.5,
    });
    expect(overchargeLv5.passiveStats?.[0]?.value).toBe(25);

    const makeEnemy = (hp: number) =>
      makeCombatUnit({
        id: 'e1',
        name: 'Enemy',
        side: 'enemy',
        isPlayer: false,
        hp,
        shield: 0,
        derived: {
          ...makeCombatUnit().derived,
          maxHp: 1000,
          defenseRating: 0,
          dodgeChance: 0,
        },
      });

    const fixedRng = () => 0.5;
    const attackerNoCrit = makeCombatUnit({
      id: 'a1',
      derived: { ...makeCombatUnit().derived, critChance: 0, critDamagePct: 0 },
    });
    const attackerBase = makeCombatUnit({
      id: 'a1',
      derived: { ...makeCombatUnit().derived, critChance: 100, critDamagePct: 0 },
    });
    const attackerCritLv5 = makeCombatUnit({
      id: 'a1',
      derived: { ...makeCombatUnit().derived, critChance: 100, critDamagePct: 25 },
    });

    const dmgNoCrit = resolveUnitAction(
      [attackerNoCrit, makeEnemy(1000)],
      'a1',
      'attack',
      'e1',
      1,
      undefined,
      fixedRng
    );
    const dmgBase = resolveUnitAction(
      [attackerBase, makeEnemy(1000)],
      'a1',
      'attack',
      'e1',
      1,
      undefined,
      fixedRng
    );
    const dmgCritLv5 = resolveUnitAction(
      [attackerCritLv5, makeEnemy(1000)],
      'a1',
      'attack',
      'e1',
      1,
      undefined,
      fixedRng
    );
    const dealtNoCrit = 1000 - dmgNoCrit.updatedUnits.find((u) => u.id === 'e1')!.hp;
    const dealtBase = 1000 - dmgBase.updatedUnits.find((u) => u.id === 'e1')!.hp;
    const dealtCritLv5 = 1000 - dmgCritLv5.updatedUnits.find((u) => u.id === 'e1')!.hp;
    // Base crit = 1.5x, Lv5 overcharge (+25%) = 1.75x
    expect(dealtBase).toBe(Math.round(dealtNoCrit * 1.5));
    expect(dealtCritLv5).toBe(Math.round(dealtNoCrit * 1.75));

    // executeDmgPct: at 30% HP (600/2000) does NOT trigger; at 29% HP (580/2000) DOES trigger
    const makeExecEnemy = (hp: number) => ({
      ...makeEnemy(hp),
      derived: { ...makeEnemy(hp).derived, maxHp: 2000 },
    });
    const attackerExec = makeCombatUnit({
      id: 'a1',
      derived: { ...makeCombatUnit().derived, critChance: 0, executeDmgPct: 50 },
    });
    const at30 = resolveUnitAction(
      [attackerExec, makeExecEnemy(600)],
      'a1',
      'attack',
      'e1',
      1,
      undefined,
      fixedRng
    );
    const at29 = resolveUnitAction(
      [attackerExec, makeExecEnemy(580)],
      'a1',
      'attack',
      'e1',
      1,
      undefined,
      fixedRng
    );
    const dmgAt30 = 600 - at30.updatedUnits.find((u) => u.id === 'e1')!.hp;
    const dmgAt29 = 580 - at29.updatedUnits.find((u) => u.id === 'e1')!.hp;
    expect(dmgAt29).toBe(Math.round(dmgAt30 * 1.5));

    // lastStandDefPct: at 30% HP no boost; at 29% HP +30% DEF (middle row has 0% row mod)
    const siege = makeCombatUnit({
      row: 'middle',
      derived: { ...makeCombatUnit().derived, maxHp: 1000, defenseRating: 100, lastStandDefPct: 30 },
    });
    expect(getEffectiveUnitDefense({ ...siege, hp: 300 })).toBe(100);
    expect(getEffectiveUnitDefense({ ...siege, hp: 290 })).toBe(130);
  });

  it('4) healPowerPct & shieldPowerPct multiply casts (not Genesis), shieldRegenPctAdd raises regen+cap, hpRegenPctAdd heals self at own turn start', () => {
    const caster = makeCombatUnit({
      id: 'sup1',
      name: 'Medic',
      classId: 'support',
      hp: 500,
      shield: 100,
      derived: {
        ...makeCombatUnit().derived,
        maxHp: 1000,
        maxShield: 400,
        healPowerPct: 50,
        shieldPowerPct: 50,
        shieldRegenPctAdd: 2.5,
        hpRegenPctAdd: 5,
      },
    });
    const woundedAlly = makeCombatUnit({
      id: 'ally1',
      name: 'Ally',
      isPlayer: false,
      hp: 200,
      shield: 50,
      derived: { ...makeCombatUnit().derived, maxHp: 1000, maxShield: 400 },
    });

    // heal_single multiplied by 1.5 (0.30 * 1.5 = 450 HP)
    const healRes = resolveUnitAction(
      [caster, woundedAlly],
      'sup1',
      'skill',
      'ally1',
      1,
      undefined,
      () => 0.5,
      'sup_nanite_mend'
    );
    expect(healRes.updatedUnits.find((u) => u.id === 'ally1')!.hp).toBe(650);

    // heal_field_hot stores scaled magnitude (0.10 * 1.5 = 0.15)
    const hotRes = resolveUnitAction(
      [caster, woundedAlly],
      'sup1',
      'skill',
      null,
      1,
      undefined,
      () => 0.5,
      'sup_regen_grid'
    );
    const regenStatus = hotRes.updatedUnits
      .find((u) => u.id === 'ally1')!
      .statuses.find((s) => s.type === 'regen_hp');
    expect(regenStatus?.magnitude).toBeCloseTo(0.15, 4);

    // energize_shield_field multiplied by 1.5 (400 * 0.25 * 1.5 = 150 SHD)
    const shdRes = resolveUnitAction(
      [caster, woundedAlly],
      'sup1',
      'skill',
      null,
      1,
      undefined,
      () => 0.5,
      'sup_aegis_field'
    );
    expect(shdRes.updatedUnits.find((u) => u.id === 'ally1')!.shield).toBe(200);

    // full_recovery_elite stays 100% Max HP & Max Shield (does not overflow)
    const genRes = resolveUnitAction(
      [caster, woundedAlly],
      'sup1',
      'skill',
      null,
      1,
      undefined,
      () => 0.5,
      'sup_genesis_wave'
    );
    const allyAfterGen = genRes.updatedUnits.find((u) => u.id === 'ally1')!;
    expect(allyAfterGen.hp).toBe(1000);
    expect(allyAfterGen.shield).toBe(400);

    // shieldRegenPctAdd increases both pct and cap
    const baseCap = DEFAULT_SHIELD_REGEN_CONFIG.capPct;
    expect(computeShieldRegenPct(1000, DEFAULT_SHIELD_REGEN_CONFIG, 0)).toBe(baseCap);
    expect(computeShieldRegenPct(1000, DEFAULT_SHIELD_REGEN_CONFIG, 2.5)).toBe(baseCap + 2.5);

    // hpRegenPctAdd heals self only at own turn start, skipped on skipTurnStartTicks
    const ownTurnRes = resolveUnitAction(
      [caster, woundedAlly],
      'sup1',
      'defend',
      null,
      1,
      undefined,
      () => 0.5
    );
    expect(ownTurnRes.updatedUnits.find((u) => u.id === 'sup1')!.hp).toBe(550);
    expect(ownTurnRes.updatedUnits.find((u) => u.id === 'ally1')!.hp).toBe(200);
    expect(ownTurnRes.logEntries.some((l) => l.templateKey === 'log.hpRegen')).toBe(true);

    const extraTurnRes = resolveUnitAction(
      [caster, woundedAlly],
      'sup1',
      'defend',
      null,
      1,
      undefined,
      () => 0.5,
      undefined,
      undefined,
      { skipTurnStartTicks: true }
    );
    expect(extraTurnRes.updatedUnits.find((u) => u.id === 'sup1')!.hp).toBe(500);
  });

  it('5) passive_stat mod in adminConfig.skillMods equals sys row bonus, and validator drops invalid entries', () => {
    const modAtk = makePassiveStatMod('mod_ordnance_clone', 'striker', 'attackPct', 5);
    const sanitized = sanitizeSkillMods([modAtk]);
    expect(sanitized).toHaveLength(1);

    const admin: AdminConfig = {
      ...createDefaultAdminConfig(),
      skillMods: sanitized,
    };

    const sysGear: GearUnit = {
      ...createDefaultGearUnit('striker', true),
      level: 30,
      skillLevels: { str_passive_ordnance: 4 },
      equippedPassives: ['str_passive_ordnance'],
    };
    const modGear: GearUnit = {
      ...createDefaultGearUnit('striker', true),
      level: 30,
      skillLevels: { mod_ordnance_clone: 4 },
      equippedPassives: ['mod_ordnance_clone'],
    };

    expect(getGearPassiveBonuses(modGear, admin)).toEqual(
      getGearPassiveBonuses(sysGear, admin)
    );
    expect(getSkillById('mod_ordnance_clone', admin)?.effectKind).toBe('passive_stat');

    // Validator drops unknown key, perLevel <= 0, and category 'normal'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invalidMods = sanitizeSkillMods([
      makePassiveStatMod('mod_bad_key', 'general', 'unknownKey' as PassiveStatKey, 5),
      makePassiveStatMod('mod_zero_val', 'general', 'attackPct', 0),
      makePassiveStatMod('mod_neg_val', 'general', 'attackPct', -2),
      makePassiveStatMod('mod_over_cap', 'general', 'attackPct', 51),
      {
        ...makePassiveStatMod('mod_wrong_cat', 'general', 'attackPct', 5),
        category: 'normal',
      },
    ]);
    expect(invalidMods).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('6) statBreakdown sum equals total and vi/en parity + skillDisplay work for all 16 passives', () => {
    const gear: GearUnit = {
      ...createDefaultGearUnit('striker', true),
      level: 20,
      skillLevels: { str_passive_ordnance: 5 },
      equippedPassives: ['str_passive_ordnance'],
    };
    const passives = getGearPassiveBonuses(gear);
    const breakdown = getStatBreakdown(gear, EMPTY_STAT_BLOCK, undefined, passives);
    for (const stat of Object.values(breakdown)) {
      expect(stat.base + stat.levelGrowth + stat.allocated + stat.equipment + stat.other).toBe(
        stat.total
      );
    }
    expect(breakdown.attack.other).toBeGreaterThan(0);

    // vi/en parity + real-number display for all 16 passives + log.hpRegen
    expect(VI_TRANSLATIONS['log.hpRegen']).toBeTruthy();
    expect(EN_TRANSLATIONS['log.hpRegen']).toBeTruthy();

    for (const id of ALL_16_PASSIVE_IDS) {
      const nameKey = `skill.${id}.name` as keyof typeof VI_TRANSLATIONS;
      const descKey = `skill.${id}.desc` as keyof typeof VI_TRANSLATIONS;
      expect(VI_TRANSLATIONS[nameKey]).toBeTruthy();
      expect(EN_TRANSLATIONS[nameKey]).toBeTruthy();
      expect(VI_TRANSLATIONS[descKey]).toBeTruthy();
      expect(EN_TRANSLATIONS[descKey]).toBeTruthy();

      const summary = formatSkillRealSummary(SKILLS_CATALOG[id], 5, 'vi', {
        skillMaxLevel: 10,
        passiveScaleAfter5: 0.5,
      });
      expect(summary.primaryText).toMatch(/\d/);
      expect(summary.nextLine).toContain('→ Lv.6:');
    }
  });
});
