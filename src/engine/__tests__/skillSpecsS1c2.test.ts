import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCatalog } from '../../data/iconCatalog';
import rawSkillsJson from '../../data/skills.json';
import {
  EFFECT_KIND_VALIDATORS,
  MOD_EFFECT_KINDS,
  SKILLS_CATALOG,
  SKILLS_LIST,
  getScaledSkillStats,
  getSkillById,
  validateSkillDefinitions,
} from '../../data/skills';
import { formatCombatLogMessage } from '../../i18n';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import type {
  AdminConfig,
  BattleState,
  CombatSide,
  CombatUnit,
  DerivedStats,
  SkillDefinition,
  SkillModDefinition,
} from '../../types/game';
import { parseStructuredCombatLogRow } from '../../utils/combatLogFormat';
import { formatSkillRealSummary } from '../../utils/skillDisplay';
import {
  chooseAiDecision,
  createInitialBattleState,
  resolveUnitAction,
} from '../combat';
import { createDefaultAdminConfig } from '../migration';
import {
  resolveSkillSpecs,
  validateSkillSpec,
  validateSpecSkillRow,
} from '../skillSpecs';
import { createDefaultPilotAccount } from '../stats';
import {
  chooseAction,
  createPresetTactics,
  generateTacticsFromSimple,
} from '../tactics';

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeUnit(
  id: string,
  side: CombatSide,
  overrides: Omit<Partial<CombatUnit>, 'derived'> & {
    derived?: Partial<DerivedStats>;
  } = {}
): CombatUnit {
  const { derived: dOverrides, ...rest } = overrides;
  const maxHp = dOverrides?.maxHp ?? 1000;
  const maxShield = dOverrides?.maxShield ?? 500;
  const maxSp = dOverrides?.maxSp ?? 100;
  const derived: DerivedStats = {
    maxHp,
    maxShield,
    maxSp,
    speed: 20,
    attackPower: 120,
    defenseRating: 25,
    dodgeChance: 5,
    critChance: 10,
    skillPower: 100,
    armorPiercePct: 0,
    splashPct: 0,
    spRegenPerTurn: 0,
    passiveSkillDmgPct: 0,
    critDamagePct: 0,
    healPowerPct: 0,
    shieldPowerPct: 0,
    ...dOverrides,
  };
  return {
    id,
    name: id,
    callsign: id.toUpperCase(),
    side,
    isPlayer: side === 'ally',
    classId: side === 'ally' ? 'support' : 'striker',
    level: 15,
    hp: maxHp,
    shield: maxShield,
    sp: maxSp,
    isDefending: false,
    alive: true,
    animState: 'idle',
    statuses: [],
    equippedSkillIds: [],
    skillCooldowns: {},
    skillLevels: {},
    skillLevel: 1,
    usedOnceSkills: [],
    row: 'front',
    stats: {
      attack: 30,
      defense: 20,
      fuel: 20,
      spirit: 20,
      shield: 20,
      evasion: 10,
    },
    ...rest,
    derived,
  };
}

describe('TASK S1c-2: Generic skill effect specs & Support skills', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) catalog loads 52 skills with 0 dropped rows and valid new Support rows', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validated = validateSkillDefinitions(rawSkillsJson);

    expect(validated).toHaveLength(52);
    expect(SKILLS_LIST).toHaveLength(52);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(Object.keys(EFFECT_KIND_VALIDATORS)).toContain('spec');
    expect(MOD_EFFECT_KINDS).toContain('spec');

    const catalog = getCatalog();

    const hf = SKILLS_CATALOG['sup_healing_field'];
    expect(hf).toMatchObject({
      id: 'sup_healing_field',
      classScope: 'support',
      category: 'normal',
      effectKind: 'spec',
      targetType: 'all_allies',
      spCost: 26,
      cooldown: 4,
      unlockLevel: 9,
      registryTag: 'sys',
      effects: [{ kind: 'heal_hp_pct', pct: 0.15 }],
    });
    expect(catalog.some((row) => row.symbol === hf.icon)).toBe(true);

    const et = SKILLS_CATALOG['sup_energize_target'];
    expect(et).toMatchObject({
      id: 'sup_energize_target',
      classScope: 'support',
      category: 'normal',
      effectKind: 'spec',
      targetType: 'single_ally',
      spCost: 12,
      cooldown: 2,
      unlockLevel: 7,
      registryTag: 'sys',
      effects: [{ kind: 'restore_shield_pct', pct: 0.4 }],
    });
    expect(catalog.some((row) => row.symbol === et.icon)).toBe(true);
  });

  it('2) every spec kind works; heal/shieldPowerPct & cap hold; shield_break blocks & shield_cracked removed', () => {
    const caster = makeUnit('p_sup', 'ally', {
      hp: 600,
      shield: 100,
      sp: 40,
      derived: {
        maxHp: 1000,
        maxShield: 500,
        maxSp: 100,
        healPowerPct: 20,
        shieldPowerPct: 25,
      },
    });
    const crackedAlly = makeUnit('p_ally_cracked', 'ally', {
      hp: 500,
      shield: 100,
      sp: 20,
      statuses: [{ type: 'shield_cracked', turnsRemaining: 2, registryId: 'DB12' }],
    });
    const brokenAlly = makeUnit('p_ally_broken', 'ally', {
      hp: 500,
      shield: 0,
      statuses: [
        { type: 'shield_break', turnsRemaining: 2 },
        { type: 'shield_cracked', turnsRemaining: 2, registryId: 'DB12' },
      ],
    });
    const foe = makeUnit('e_1', 'enemy', {
      hp: 800,
      shield: 100,
      derived: { maxHp: 1000, maxShield: 500, defenseRating: 0 },
    });

    // Multi-effect spec covering damage, heal_hp_pct (target: 'self'), apply_status
    const comboSkill: SkillDefinition = {
      id: 'test_combo_spec',
      classScope: 'support',
      category: 'normal',
      icon: 'health_cross',
      unlockLevel: 1,
      spCost: 0,
      cooldown: 0,
      targetType: 'single_enemy',
      effectKind: 'spec',
      effects: [
        { kind: 'damage', powerMultiplier: 1.5 },
        { kind: 'heal_hp_pct', pct: 0.2, target: 'self' },
        { kind: 'apply_status', statusId: 'DB01', duration: 2 },
      ],
    };
    const comboRes = resolveSkillSpecs(caster, comboSkill, [foe], null, {
      units: [caster, foe],
    });
    const updatedFoe = comboRes.updatedUnits.find((u) => u.id === foe.id)!;
    const updatedCaster = comboRes.updatedUnits.find((u) => u.id === caster.id)!;
    expect(updatedFoe.hp + updatedFoe.shield).toBeLessThan(foe.hp + foe.shield);
    expect(updatedFoe.statuses.some((s) => s.registryId === 'DB01')).toBe(true);
    // 20% * 1.2 (healPowerPct 20%) = 24% of 1000 = +240 HP
    expect(updatedCaster.hp).toBe(840);
    expect(comboRes.popups.some((p) => p.text === '+240 HP')).toBe(true);

    // restore_sp spec
    const spSkill: SkillDefinition = {
      ...comboSkill,
      id: 'test_sp_spec',
      targetType: 'single_ally',
      effects: [{ kind: 'restore_sp', amount: 30 }],
    };
    const spRes = resolveSkillSpecs(caster, spSkill, [crackedAlly]);
    expect(spRes.updatedUnits.find((u) => u.id === crackedAlly.id)!.sp).toBe(50);

    // shield_cracked removed & shieldPowerPct applied (40% * 1.25 = 50% of 500 = +250 SHD)
    const etSkill = getSkillById('sup_energize_target')!;
    const etCrackedRes = resolveSkillSpecs(caster, etSkill, [crackedAlly], null, {
      units: [caster, crackedAlly],
    });
    const afterCracked = etCrackedRes.updatedUnits.find((u) => u.id === crackedAlly.id)!;
    expect(afterCracked.shield).toBe(350);
    expect(afterCracked.statuses.some((s) => s.type === 'shield_cracked')).toBe(false);
    expect(etCrackedRes.popups.some((p) => p.text === '+250 SHD')).toBe(true);

    // restorePctCap clamps 0.5 * 1.25 = 0.625 -> 313 SHD added to 100 = 413
    const capRes = resolveSkillSpecs(
      caster,
      etSkill,
      [crackedAlly],
      { effectMult: 2, effects: [{ kind: 'restore_shield_pct', pct: 0.5 }] },
      { units: [caster, crackedAlly], adminConfig: { restorePctCap: 0.5 } }
    );
    expect(capRes.updatedUnits.find((u) => u.id === crackedAlly.id)!.shield).toBe(413);

    // shield_break blocks restore_shield_pct -> 0 shield & canonical Vietnamese log
    const etBrokenRes = resolveSkillSpecs(caster, etSkill, [brokenAlly], null, {
      units: [caster, brokenAlly],
    });
    const afterBroken = etBrokenRes.updatedUnits.find((u) => u.id === brokenAlly.id)!;
    expect(afterBroken.shield).toBe(0);
    expect(afterBroken.statuses.some((s) => s.type === 'shield_cracked')).toBe(false);
    const blockedLog = etBrokenRes.logEntries.find(
      (l) => l.templateKey === 'log.shieldBreakBlocked'
    )!;
    expect(blockedLog).toBeDefined();
    expect(formatCombatLogMessage('vi', blockedLog)).toContain(
      'Khiên bị phá, không hồi được'
    );
    expect(parseStructuredCombatLogRow('vi', blockedLog).valueText).toBe('0 SHD');
  });

  it('3) Healing Field heals all living allies (Lv1 15% / Lv5 21%) and Energize Target AI picks lowest shield ratio', () => {
    const hf = getSkillById('sup_healing_field')!;
    expect(getScaledSkillStats(hf, 1).effects?.[0]?.pct).toBeCloseTo(0.15, 4);
    expect(getScaledSkillStats(hf, 5).effects?.[0]?.pct).toBeCloseTo(0.21, 4);

    const et = getSkillById('sup_energize_target')!;
    expect(getScaledSkillStats(et, 1).effects?.[0]?.pct).toBeCloseTo(0.4, 4);
    expect(getScaledSkillStats(et, 5).effects?.[0]?.pct).toBeCloseTo(0.56, 4);

    const sup = makeUnit('p_sup', 'ally', {
      hp: 600,
      shield: 450,
      sp: 80,
      equippedSkillIds: ['sup_healing_field', 'sup_energize_target'],
      skillLevels: { sup_healing_field: 5, sup_energize_target: 5 },
    });
    const allyLowHp = makeUnit('p_lowhp', 'ally', { hp: 500, shield: 400 });
    const allyDead = makeUnit('p_dead', 'ally', { hp: 0, shield: 0, alive: false });
    const enemy = makeUnit('e_1', 'enemy');

    const hfRes = resolveSkillSpecs(
      sup,
      hf,
      [sup, allyLowHp],
      getScaledSkillStats(hf, 5),
      { units: [sup, allyLowHp, allyDead, enemy] }
    );
    expect(hfRes.updatedUnits.find((u) => u.id === sup.id)!.hp).toBe(810);
    expect(hfRes.updatedUnits.find((u) => u.id === allyLowHp.id)!.hp).toBe(710);
    expect(hfRes.updatedUnits.find((u) => u.id === allyDead.id)!.hp).toBe(0);

    // AI pick for Energize Target: ignore maxShield===0 & shield_break, pick lowest shield/maxShield
    const noShieldAlly = makeUnit('p_noshd', 'ally', {
      hp: 1000,
      shield: 0,
      derived: { maxShield: 0 },
    });
    const brokenAlly = makeUnit('p_broken', 'ally', {
      hp: 1000,
      shield: 0,
      statuses: [{ type: 'shield_break', turnsRemaining: 2 }],
    });
    const shd30Ally = makeUnit('p_shd30', 'ally', { hp: 1000, shield: 150 }); // 30%
    const shd60Ally = makeUnit('p_shd60', 'ally', { hp: 1000, shield: 300 }); // 60%

    const supOnlyEt = { ...sup, equippedSkillIds: ['sup_energize_target'] };
    const aiPick = chooseAiDecision(
      supOnlyEt,
      [supOnlyEt, noShieldAlly, brokenAlly, shd30Ally, shd60Ally, enemy],
      () => 0.5
    );
    expect(aiPick).toEqual({
      action: 'skill',
      skillId: 'sup_energize_target',
      targetId: 'p_shd30',
    });
  });

  it('4) seeded AI & tactics.ts use both Healing Field and Energize Target; old skills stay deterministic', () => {
    const sup = makeUnit('p_sup', 'ally', {
      hp: 650,
      shield: 450,
      sp: 100,
      equippedSkillIds: ['sup_healing_field', 'sup_energize_target'],
      skillLevels: { sup_healing_field: 1, sup_energize_target: 1 },
    });
    const ally2 = makeUnit('p_ally2', 'ally', {
      hp: 600, // 60% < 70%
      shield: 100, // 20%
      classId: 'striker',
    });
    const enemy = makeUnit('e_1', 'enemy', { row: 'front' });
    const units: CombatUnit[] = [sup, ally2, enemy];

    // chooseAiDecision uses sup_healing_field when >=2 allies < 70% HP
    const d1 = chooseAiDecision(sup, units, createMulberry32(42));
    expect(d1).toEqual({
      action: 'skill',
      targetId: null,
      skillId: 'sup_healing_field',
    });

    const r1 = resolveUnitAction(
      units,
      sup.id,
      'skill',
      d1.targetId,
      1,
      undefined,
      createMulberry32(42),
      d1.skillId
    );
    // Round 2: sup_healing_field on CD -> AI casts sup_energize_target on lowest shield ally
    const supAfter1: CombatUnit = {
      ...r1.updatedUnits.find((u) => u.id === sup.id)!,
      skillCooldowns: { sup_healing_field: 3 },
    };
    const nextUnits = r1.updatedUnits.map((u) => (u.id === sup.id ? supAfter1 : u));
    const d2 = chooseAiDecision(supAfter1, nextUnits, createMulberry32(42));
    expect(d2).toEqual({
      action: 'skill',
      targetId: 'p_ally2',
      skillId: 'sup_energize_target',
    });

    // tactics.ts simple auto & preset generator include and trigger both skills
    const simpleProfile = generateTacticsFromSimple(
      'support',
      {
        presetId: 'support_team',
        preferredTarget: 'weakest',
        skillUsage: 'always',
        lowHpAction: 'defend',
        lowHpThresholdPct: 30,
        elitePolicy: 'immediate',
        prioritySkillIds: ['sup_healing_field', 'sup_energize_target'],
      },
      ['sup_healing_field', 'sup_energize_target']
    );
    expect(simpleProfile.rules.some((r) => r.action.skillId === 'sup_healing_field')).toBe(true);
    expect(simpleProfile.rules.some((r) => r.action.skillId === 'sup_energize_target')).toBe(true);

    const presetProfile = createPresetTactics('support', 'balanced', [
      'sup_healing_field',
      'sup_energize_target',
    ]);
    expect(presetProfile.rules.some((r) => r.action.skillId === 'sup_healing_field')).toBe(true);
    expect(presetProfile.rules.some((r) => r.action.skillId === 'sup_energize_target')).toBe(true);

    const battleState: BattleState = {
      sectorId: 'border_outpost',
      deployedGearId: 'support',
      squadSize: 4,
      round: 1,
      turnCounter: 1,
      turnOrder: [sup.id, ally2.id, enemy.id],
      activeTurnIndex: 0,
      units,
      selectedTargetId: enemy.id,
      selectedAllyTargetId: null,
      lastPlayerTargetId: null,
      autoStopNotice: null,
      log: [],
      events: [],
      roundSnapshots: [],
      popups: [],
      fxEvents: [],
      explodedUnitIds: [],
      isResolving: false,
      summary: null,
      turnLockedSkillIds: [],
    };
    const tac1 = chooseAction(battleState, sup, simpleProfile, createMulberry32(42));
    expect(tac1.skillId).toBe('sup_healing_field');
    const tac2 = chooseAction(
      { ...battleState, units: nextUnits },
      supAfter1,
      simpleProfile,
      createMulberry32(42)
    );
    expect(tac2.skillId).toBe('sup_energize_target');
    expect(tac2.targetId).toBe('p_ally2');

    // Old skills remain deterministic on a fixed seed
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    const bA = createInitialBattleState(pilot, 'border_outpost', createMulberry32(1337), 4);
    const bB = createInitialBattleState(pilot, 'border_outpost', createMulberry32(1337), 4);
    expect(bA.units).toEqual(bB.units);
    expect(bA.turnOrder).toEqual(bB.turnOrder);
  });

  it('5) validateSkillSpec & validateSpecSkillRow reject invalid kinds, statusIds, targets, and numbers', () => {
    expect(validateSkillSpec(null)).toContain('spec_not_object');
    expect(validateSkillSpec({ kind: 'bogus' })).toContain('unknown_kind');
    expect(validateSkillSpec({ kind: 'damage', powerMultiplier: 0.05 })).toContain('invalid_powerMultiplier');
    expect(validateSkillSpec({ kind: 'damage', powerMultiplier: 6 })).toContain('invalid_powerMultiplier');
    expect(validateSkillSpec({ kind: 'damage', powerMultiplier: Number.NaN })).toContain('invalid_powerMultiplier');
    expect(validateSkillSpec({ kind: 'heal_hp_pct', pct: 0 })).toContain('invalid_pct');
    expect(validateSkillSpec({ kind: 'restore_shield_pct', pct: 1.5 })).toContain('invalid_pct');
    expect(validateSkillSpec({ kind: 'restore_sp', amount: 0 })).toContain('invalid_restore_sp');
    expect(validateSkillSpec({ kind: 'restore_sp', amount: 201 })).toContain('invalid_restore_sp');
    expect(validateSkillSpec({ kind: 'apply_status', statusId: 'NOPE' })).toContain('unknown_statusId');
    expect(validateSkillSpec({ kind: 'apply_status', statusId: 'DB01', duration: 0 })).toContain('invalid_duration');
    expect(validateSkillSpec({ kind: 'apply_status', statusId: 'DB01', duration: 11 })).toContain('invalid_duration');
    expect(validateSkillSpec({ kind: 'heal_hp_pct', pct: 0.2, target: 'enemy' })).toContain('invalid_target');

    expect(validateSpecSkillRow({ effects: [] })).toContain('effects_length_1_to_3_required');
    expect(
      validateSpecSkillRow({
        effects: [
          { kind: 'restore_sp', amount: 10 },
          { kind: 'restore_sp', amount: 10 },
          { kind: 'restore_sp', amount: 10 },
          { kind: 'restore_sp', amount: 10 },
        ],
      })
    ).toContain('effects_length_1_to_3_required');
    expect(
      validateSpecSkillRow({ effects: [{ kind: 'heal_hp_pct', pct: 0.15 }] })
    ).toEqual([]);
  });

  it('6) adminConfig.skillMods spec row matches sys row in combat and vi/en parity holds', () => {
    const modSkill: SkillModDefinition = {
      id: 'mod_test_heal_spec',
      nameVi: 'Trường Hồi Phục Mod',
      nameEn: 'Mod Field',
      descVi: 'Hồi 15% HP toàn đội.',
      descEn: 'Restore 15% HP to all allies.',
      iconId: 'BF09',
      classScope: 'support',
      category: 'normal',
      icon: 'health_cross',
      unlockLevel: 1,
      spCost: 26,
      cooldown: 4,
      targetType: 'all_allies',
      effectKind: 'spec',
      effects: [{ kind: 'heal_hp_pct', pct: 0.15 }],
      registryTag: 'mod',
    };
    const adminWithMod: Partial<AdminConfig> = {
      ...createDefaultAdminConfig(),
      skillMods: [modSkill],
    };

    const sysCaster = makeUnit('p_sup', 'ally', {
      hp: 500,
      sp: 60,
      equippedSkillIds: ['sup_healing_field'],
    });
    const modCaster = makeUnit('p_sup', 'ally', {
      hp: 500,
      sp: 60,
      equippedSkillIds: ['mod_test_heal_spec'],
    });
    const ally = makeUnit('p_ally', 'ally', { hp: 500 });
    const foe = makeUnit('e_1', 'enemy');

    const sysRun = resolveUnitAction(
      [sysCaster, ally, foe],
      sysCaster.id,
      'skill',
      null,
      1,
      undefined,
      createMulberry32(99),
      'sup_healing_field'
    );
    const modRun = resolveUnitAction(
      [modCaster, ally, foe],
      modCaster.id,
      'skill',
      null,
      1,
      adminWithMod,
      createMulberry32(99),
      'mod_test_heal_spec'
    );

    expect(
      modRun.updatedUnits.map((u) => ({ id: u.id, hp: u.hp, sp: u.sp }))
    ).toEqual(
      sysRun.updatedUnits.map((u) => ({ id: u.id, hp: u.hp, sp: u.sp }))
    );

    // VI/EN parity & ACE labels
    expect(VI_TRANSLATIONS['skill.sup_healing_field.name']).toBe('Trường Hồi Phục');
    expect(EN_TRANSLATIONS['skill.sup_healing_field.name']).toBe('Healing Field');
    expect(VI_TRANSLATIONS['skill.sup_energize_target.name']).toBe('Nạp Khiên Mục Tiêu');
    expect(EN_TRANSLATIONS['skill.sup_energize_target.name']).toBe('Energize Target');
    expect(EN_TRANSLATIONS['skill.sup_nanite_mend.desc']).toContain('(ACE: Heal Target)');
    expect(EN_TRANSLATIONS['skill.sup_aegis_field.desc']).toContain('(ACE: Energizing Field)');
    expect(VI_TRANSLATIONS['skill.sup_nanite_mend.desc']).not.toContain('(ACE:');
    expect(VI_TRANSLATIONS['skill.sup_aegis_field.desc']).not.toContain('(ACE:');
    expect(VI_TRANSLATIONS['log.shieldBreakBlocked']).toContain('Khiên bị phá, không hồi được');
    expect(EN_TRANSLATIONS['log.shieldBreakBlocked']).toBeTruthy();

    const hfSummary = formatSkillRealSummary(getSkillById('sup_healing_field')!, 1, 'en');
    const etSummary = formatSkillRealSummary(getSkillById('sup_energize_target')!, 1, 'vi');
    expect(hfSummary.primaryText).toContain('15%');
    expect(etSummary.primaryText).toContain('40%');
  });
});
