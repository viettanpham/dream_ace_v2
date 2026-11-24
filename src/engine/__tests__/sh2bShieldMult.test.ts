import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { ENEMY_ARCHETYPE_DEFS } from '../../data/pilots';
import { formatCombatLogMessage } from '../../i18n';
import type { CombatUnit } from '../../types/game';
import {
  applyShieldCracked,
  applyShieldThenHull,
  resolveUnitAction,
} from '../combat';
import { createDefaultAdminConfig } from '../migration';
import { calculateDerivedStats } from '../stats';

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  const stats = {
    ...EMPTY_STAT_BLOCK,
    attack: 40,
    defense: 0,
    shield: 40,
    fuel: 20,
    evasion: 0,
    spirit: 10,
    ...(overrides.stats ?? {}),
  };
  const baseDerived = calculateDerivedStats(
    overrides.classId ?? 'striker',
    10,
    stats
  );
  return {
    id: 'u1',
    name: 'Vance',
    callsign: 'Strike-01',
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
    stats,
    derived: {
      ...baseDerived,
      maxHp: 2000,
      maxShield: 5000,
      maxSp: 100,
      speed: 35,
      defenseRating: 0,
      dodgeChance: 0,
      critChance: 0,
      attackPower: 200,
      skillPower: 200,
      spRegenPerTurn: 10,
      splashPct: 0,
      ...(overrides.derived ?? {}),
    },
    hp: 2000,
    shield: 5000,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('SH2b shield damage multiplier & Khiên nứt', () => {
  it('1) applyShieldThenHull exact spill (D=1000, m=1.5, S=1200) and non-spill (S >= D*m)', () => {
    const spill = applyShieldThenHull(
      { hp: 800, shield: 1200 },
      1000,
      { shieldMult: 1.5 }
    );
    expect(spill).toEqual({
      shieldLost: 1200,
      hullDamage: 200,
      nextShield: 0,
      nextHp: 600,
      brokeNow: true,
    });

    const absorbed = applyShieldThenHull(
      { hp: 800, shield: 1000 },
      400,
      { shieldMult: 1.5 }
    );
    expect(absorbed).toEqual({
      shieldLost: 600,
      hullDamage: 0,
      nextShield: 400,
      nextHp: 800,
      brokeNow: false,
    });
  });

  it('2) skill on cracked = 1.3, Sunder on cracked = 1.5 (max), basic/splash/counter on cracked = 1', () => {
    const adminCfg = createDefaultAdminConfig();
    const fixedRng = () => 0.99;

    const crackedStatus = {
      type: 'shield_cracked' as const,
      turnsRemaining: 2,
      magnitude: 1.3,
      isDebuff: true,
    };

    const striker = makeUnit({
      id: 'ally_1',
      classId: 'striker',
      equippedSkillIds: ['str_carpet_salvo'],
      derived: {
        ...makeUnit().derived,
        splashPct: 50,
      },
      statuses: [crackedStatus],
    });
    const siege = makeUnit({
      id: 'ally_2',
      classId: 'siege',
      equippedSkillIds: ['sge_aegis_sunder'],
    });
    const uncrackedEnemy = makeUnit({
      id: 'enemy_uncracked',
      side: 'enemy',
      isPlayer: false,
      name: 'Uncracked',
    });
    const crackedEnemy = makeUnit({
      id: 'enemy_cracked',
      side: 'enemy',
      isPlayer: false,
      name: 'Cracked',
      statuses: [crackedStatus],
    });
    const adjCrackedEnemy = makeUnit({
      id: 'enemy_adj',
      side: 'enemy',
      isPlayer: false,
      name: 'AdjCracked',
      statuses: [crackedStatus],
    });

    // Regular skill vs uncracked vs cracked (1.3x)
    const skillNormal = resolveUnitAction(
      [striker, uncrackedEnemy],
      'ally_1',
      'skill',
      'enemy_uncracked',
      1,
      adminCfg,
      fixedRng,
      'str_carpet_salvo'
    );
    const skillCracked = resolveUnitAction(
      [striker, crackedEnemy],
      'ally_1',
      'skill',
      'enemy_cracked',
      1,
      adminCfg,
      fixedRng,
      'str_carpet_salvo'
    );
    const normalShieldLoss = 5000 - skillNormal.updatedUnits[1].shield;
    const crackedShieldLoss = 5000 - skillCracked.updatedUnits[1].shield;
    expect(crackedShieldLoss).toBe(Math.round(normalShieldLoss * 1.3));
    expect(
      skillCracked.logEntries.find((l) => l.templateKey === 'log.damage')?.params
        ?.shieldMult
    ).toBe(1.3);

    // Aegis Sunder vs cracked = max(1.5, 1.3) = 1.5 (NOT 1.95)
    const sunderNormal = resolveUnitAction(
      [siege, uncrackedEnemy],
      'ally_2',
      'skill',
      'enemy_uncracked',
      1,
      adminCfg,
      fixedRng,
      'sge_aegis_sunder'
    );
    const sunderCracked = resolveUnitAction(
      [siege, crackedEnemy],
      'ally_2',
      'skill',
      'enemy_cracked',
      1,
      adminCfg,
      fixedRng,
      'sge_aegis_sunder'
    );
    expect(5000 - sunderCracked.updatedUnits[1].shield).toBe(
      5000 - sunderNormal.updatedUnits[1].shield
    );
    expect(
      sunderCracked.logEntries.find((l) => l.templateKey === 'log.damage')
        ?.params?.shieldMult
    ).toBe(1.5);

    // Basic attack + splash on cracked = 1
    const basicUncracked = resolveUnitAction(
      [striker, uncrackedEnemy],
      'ally_1',
      'attack',
      'enemy_uncracked',
      1,
      adminCfg,
      fixedRng
    );
    const basicCracked = resolveUnitAction(
      [striker, crackedEnemy, adjCrackedEnemy],
      'ally_1',
      'attack',
      'enemy_cracked',
      1,
      adminCfg,
      fixedRng
    );
    const primaryBasicLoss = 5000 - basicCracked.updatedUnits[1].shield;
    const adjSplashLoss = 5000 - basicCracked.updatedUnits[2].shield;
    expect(primaryBasicLoss).toBe(5000 - basicUncracked.updatedUnits[1].shield);
    expect(adjSplashLoss).toBe(Math.round(primaryBasicLoss * 0.5));
    expect(
      basicCracked.logEntries.find((l) => l.templateKey === 'log.damage')?.params
        ?.shieldMult
    ).toBe(1);

    // Counter attack on cracked attacker = 1
    const counterDefender = makeUnit({
      id: 'enemy_counter',
      side: 'enemy',
      isPlayer: false,
      statuses: [{ type: 'counter', turnsRemaining: 1, charges: 1, magnitude: 1 }],
    });
    const uncrackedStriker = makeUnit({
      id: 'ally_uncracked',
      classId: 'striker',
      statuses: [],
    });
    const counterVsUncracked = resolveUnitAction(
      [uncrackedStriker, counterDefender],
      'ally_uncracked',
      'attack',
      'enemy_counter',
      1,
      adminCfg,
      fixedRng
    );
    const counterVsCracked = resolveUnitAction(
      [striker, counterDefender],
      'ally_1',
      'attack',
      'enemy_counter',
      1,
      adminCfg,
      fixedRng
    );
    expect(5000 - counterVsCracked.updatedUnits[0].shield).toBe(
      5000 - counterVsUncracked.updatedUnits[0].shield
    );
    expect(
      counterVsCracked.logEntries.find((l) => l.templateKey === 'log.damage')
        ?.params?.shieldMult
    ).toBe(1);
  });

  it('3) shield to 0 clears Khiên nứt + adds Khiên vỡ; applyShieldCracked is no-op on shield 0 or Khiên vỡ', () => {
    const adminCfg = createDefaultAdminConfig();
    const attacker = makeUnit({ id: 'ally_1' });
    const crackedLowShield = makeUnit({
      id: 'enemy_low',
      side: 'enemy',
      isPlayer: false,
      shield: 50,
      hp: 1000,
      statuses: [
        {
          type: 'shield_cracked',
          turnsRemaining: 2,
          magnitude: 1.3,
          isDebuff: true,
        },
      ],
    });

    const brokeRes = resolveUnitAction(
      [attacker, crackedLowShield],
      'ally_1',
      'attack',
      'enemy_low',
      1,
      adminCfg,
      () => 0.99
    );
    const afterTarget = brokeRes.updatedUnits[1];
    expect(afterTarget.shield).toBe(0);
    expect(afterTarget.statuses.some((s) => s.type === 'shield_cracked')).toBe(
      false
    );
    expect(afterTarget.statuses.some((s) => s.type === 'shield_break')).toBe(
      true
    );

    const noShieldRes = applyShieldCracked(afterTarget, 2, 'Sunder');
    expect(noShieldRes.applied).toBe(false);
    expect(
      noShieldRes.targetAfter.statuses.some((s) => s.type === 'shield_cracked')
    ).toBe(false);
    expect(formatCombatLogMessage('vi', noShieldRes.logs[0])).toContain(
      'Không có khiên để làm nứt'
    );

    const brokenWithShield = makeUnit({
      id: 'enemy_broken',
      side: 'enemy',
      isPlayer: false,
      shield: 300,
      statuses: [{ type: 'shield_break', turnsRemaining: 2, isDebuff: true }],
    });
    const brokenRes = applyShieldCracked(brokenWithShield, 2, 'Sunder');
    expect(brokenRes.applied).toBe(false);
    expect(
      brokenRes.targetAfter.statuses.some((s) => s.type === 'shield_cracked')
    ).toBe(false);
    expect(brokenRes.logs[0]?.templateKey).toBe('log.shieldCrackNoShield');
  });

  it('4) gunship applies Khiên nứt and never shield_break when status triggers', () => {
    expect(ENEMY_ARCHETYPE_DEFS.gunship.inflictsStatus).toBe('shield_cracked');
    const adminCfg = createDefaultAdminConfig();
    const gunship = makeUnit({
      id: 'enemy_gunship',
      side: 'enemy',
      isPlayer: false,
      archetype: 'gunship',
    });
    const target = makeUnit({
      id: 'ally_1',
      shield: 2000,
      hp: 1500,
    });

    // rng 0.1 triggers statusChance * 0.55 (0.2475) cleanly while shield survives
    const res = resolveUnitAction(
      [gunship, target],
      'enemy_gunship',
      'attack',
      'ally_1',
      1,
      adminCfg,
      () => 0.1
    );
    const targetAfter = res.updatedUnits[1];
    expect(targetAfter.shield).toBeGreaterThan(0);
    expect(targetAfter.statuses.some((s) => s.type === 'shield_cracked')).toBe(
      true
    );
    expect(targetAfter.statuses.some((s) => s.type === 'shield_break')).toBe(
      false
    );
  });

  it('5) sge_starbreaker_lance ignores DEF but shield absorbs first', () => {
    const adminCfg = createDefaultAdminConfig();
    const fixedRng = () => 0.5;
    const siege = makeUnit({
      id: 'ally_siege',
      classId: 'siege',
      equippedSkillIds: ['sge_starbreaker_lance'],
      derived: {
        ...makeUnit().derived,
        attackPower: 100,
      },
    });
    const zeroDefEnemy = makeUnit({
      id: 'enemy_0def',
      side: 'enemy',
      isPlayer: false,
      shield: 5000,
      hp: 2000,
      derived: { ...makeUnit().derived, defenseRating: 0 },
    });
    const highDefEnemy = makeUnit({
      id: 'enemy_highdef',
      side: 'enemy',
      isPlayer: false,
      shield: 5000,
      hp: 2000,
      derived: { ...makeUnit().derived, defenseRating: 180 },
    });
    const partialShieldEnemy = makeUnit({
      id: 'enemy_300shd',
      side: 'enemy',
      isPlayer: false,
      shield: 300,
      hp: 2000,
      derived: { ...makeUnit().derived, defenseRating: 80 },
    });

    const vsZero = resolveUnitAction(
      [siege, zeroDefEnemy],
      'ally_siege',
      'skill',
      'enemy_0def',
      1,
      adminCfg,
      fixedRng,
      'sge_starbreaker_lance'
    );
    const vsHigh = resolveUnitAction(
      [siege, highDefEnemy],
      'ally_siege',
      'skill',
      'enemy_highdef',
      1,
      adminCfg,
      fixedRng,
      'sge_starbreaker_lance'
    );
    const vsPartial = resolveUnitAction(
      [siege, partialShieldEnemy],
      'ally_siege',
      'skill',
      'enemy_300shd',
      1,
      adminCfg,
      fixedRng,
      'sge_starbreaker_lance'
    );

    const expectedTotal = 5000 - vsZero.updatedUnits[1].shield;
    expect(expectedTotal).toBeGreaterThan(300);
    expect(5000 - vsHigh.updatedUnits[1].shield).toBe(expectedTotal);
    expect(vsHigh.updatedUnits[1].hp).toBe(2000);
    expect(vsPartial.updatedUnits[1].shield).toBe(0);
    expect(2000 - vsPartial.updatedUnits[1].hp).toBe(expectedTotal - 300);
  });
});
