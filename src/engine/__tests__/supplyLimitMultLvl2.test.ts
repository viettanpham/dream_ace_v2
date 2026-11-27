import { describe, expect, it } from 'vitest';
import { getSupplyTemplateById } from '../../data/consumables';
import type { CombatUnit } from '../../types/game';
import {
  canUseSupply,
  DEFAULT_SUPPLY_ECONOMY_CONFIG,
  getEffectiveSupplyBattleLimit,
  getSupplyLimitMult,
  sanitizeSupplyEconomyConfig,
} from '../supplies';

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'unit_1',
    side: 'ally',
    row: 'front',
    isPlayer: true,
    isBoss: false,
    name: 'Tester',
    callsign: 'T-01',
    classId: 'striker',
    level: 30,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    hp: 500,
    shield: 200,
    sp: 40,
    alive: true,
    isDefending: false,
    statuses: [],
    animState: 'idle',
    stats: {
      attack: 30,
      defense: 25,
      fuel: 20,
      spirit: 20,
      shield: 20,
      evasion: 10,
    },
    derived: {
      maxHp: 2000,
      maxShield: 1000,
      maxSp: 200,
      speed: 30,
      attackPower: 35,
      defenseRating: 25,
      dodgeChance: 10,
      critChance: 10,
      skillPower: 40,
      armorPiercePct: 0,
      accuracyPct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    ...overrides,
  };
}

describe('TASK LVL-2 — Supply use limit multiplier by side & battle kind', () => {
  it('1) assault: player limit 10 / enemy limit 15 at base 5', () => {
    const player = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true });
    const enemy = makeUnit({ id: 'enemy_1', side: 'enemy', isPlayer: false });
    const units = [player, enemy];

    expect(getSupplyLimitMult('assault', player, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(2);
    expect(getSupplyLimitMult('assault', enemy, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(3);
    expect(getEffectiveSupplyBattleLimit('assault', player, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(10);
    expect(getEffectiveSupplyBattleLimit('assault', enemy, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(15);
  });

  it('2) defend: player limit 10 / enemy limit 5 at base 5 (patrol = 5)', () => {
    const player = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true });
    const enemy = makeUnit({ id: 'enemy_1', side: 'enemy', isPlayer: false });
    const units = [player, enemy];

    expect(getEffectiveSupplyBattleLimit('defend', player, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(10);
    expect(getEffectiveSupplyBattleLimit('defend', enemy, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(5);
    expect(getEffectiveSupplyBattleLimit('patrol', player, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(5);
  });

  it('3) boss battle: boss unlimited (Infinity), escort 10, player 15', () => {
    const player = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true });
    const boss = makeUnit({ id: 'boss_1', side: 'enemy', isPlayer: false, isBoss: true });
    const escort = makeUnit({ id: 'escort_1', side: 'enemy', isPlayer: false, isBoss: false });
    const units = [player, boss, escort];

    expect(getSupplyLimitMult('assault', boss, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(Infinity);
    expect(getEffectiveSupplyBattleLimit('assault', boss, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(Infinity);
    expect(getEffectiveSupplyBattleLimit('assault', escort, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(10);
    expect(getEffectiveSupplyBattleLimit('assault', player, units, DEFAULT_SUPPLY_ECONOMY_CONFIG)).toBe(15);

    const tpl = getSupplyTemplateById('sup_hp_t1')!;
    const check = canUseSupply({
      template: tpl,
      stock: 5,
      unit: boss,
      supplyState: { usedCountsByTemplate: { [tpl.id]: 999 }, usedThisTurn: 0 },
      isOwnTurn: true,
      kind: 'assault',
      units,
      cfg: { supplyUsesPerTurn: 1, supplyEconomy: DEFAULT_SUPPLY_ECONOMY_CONFIG },
    });
    expect(check.ok).toBe(true);
  });

  it('4) sanitizeSupplyEconomyConfig clamps limitMult ints to [1, 10] and keeps defaults', () => {
    const clean = sanitizeSupplyEconomyConfig({
      maxUsesPerBattle: 5,
      spPriceMult: 2,
      limitMult: {
        assaultAttacker: 0,
        assaultDefender: 15,
        defendDefender: 2.6,
        defendAttacker: -5,
        bossEscort: Number.NaN,
        bossPlayers: 10.4,
      },
    });

    expect(clean.limitMult).toEqual({
      assaultAttacker: 1,
      assaultDefender: 10,
      defendDefender: 3,
      defendAttacker: 1,
      bossEscort: 2,
      bossPlayers: 10,
    });
  });
});
