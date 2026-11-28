import { describe, expect, it } from 'vitest';
import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../../data/consumables';
import type { CombatUnit, SupplyTemplate } from '../../types/game';
import { computeSupplyPrice } from '../itemPrice';
import { applyBattleSupplyUse, tickSupplyState } from '../supplies';

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally_player',
    side: 'ally',
    row: 'front',
    isPlayer: true,
    name: 'Tester',
    callsign: 'T-01',
    classId: 'striker',
    level: 40,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    hp: 1000,
    shield: 400,
    sp: 50,
    alive: true,
    isDefending: false,
    statuses: [],
    animState: 'idle',
    stats: {
      attack: 40,
      defense: 30,
      fuel: 20,
      spirit: 25,
      shield: 25,
      evasion: 15,
    },
    derived: {
      maxHp: 3000,
      maxShield: 1000,
      maxSp: 300,
      speed: 30,
      attackPower: 40,
      defenseRating: 30,
      dodgeChance: 10,
      critChance: 10,
      skillPower: 50,
      armorPiercePct: 0,
      accuracyPct: 0,
      splashPct: 0,
      spRegenPerTurn: 12,
      passiveSkillDmgPct: 0,
    },
    ...overrides,
  };
}

describe('TASK CS-BAL — Supply rebalance (flat effects, T5, pricing, admin)', () => {
  it('1) flat heal 3000 with 2000 missing restores 2000 and spends the use', () => {
    const bigHealTpl: SupplyTemplate = {
      ...getSupplyTemplateById('sup_hp_t5')!,
      effects: [{ kind: 'heal_hp', value: 3000 }],
    };
    const unit = makeUnit({ hp: 1000 }); // 2000 missing out of 3000 maxHp

    const res = applyBattleSupplyUse({
      units: [unit],
      supplyByUnit: {},
      unitId: unit.id,
      template: bigHealTpl,
      stock: 4,
      isOwnTurn: true,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.gains.hp).toBe(2000);
    expect(res.units[0].hp).toBe(3000);
    expect(res.supplyByUnit[unit.id].usedCountsByTemplate[bigHealTpl.id]).toBe(1);
    expect(res.supplyByUnit[unit.id].usedThisTurn).toBe(1);
  });

  it('2) prices HP T3 = 160, SP T3 = 140 at x2 and 210 at x3', () => {
    const hpT3 = getSupplyTemplateById('sup_hp_t3')!;
    const spT3 = getSupplyTemplateById('sup_sp_t3')!;

    expect(computeSupplyPrice(hpT3)).toBe(160);
    expect(computeSupplyPrice(spT3, { maxUsesPerBattle: 5, spPriceMult: 2 })).toBe(140);
    expect(computeSupplyPrice(spT3, { maxUsesPerBattle: 5, spPriceMult: 3 })).toBe(210);
  });

  it('3) catalog has 36 templates, T5 unlockLevel 40, and exact rebalanced values', () => {
    expect(SUPPLY_TEMPLATES).toHaveLength(36);

    const byFamily = {
      hp_kit: [300, 500, 800, 1200, 1800],
      shield_kit: [500, 800, 1200, 1700, 2500],
      sp_kit: [100, 200, 350, 550, 800],
    } as const;
    const prefix = { hp_kit: 'sup_hp', shield_kit: 'sup_shield', sp_kit: 'sup_sp' } as const;
    const unlocks = [1, 10, 20, 35, 40];

    for (const [family, values] of Object.entries(byFamily)) {
      values.forEach((val, idx) => {
        const tpl = getSupplyTemplateById(`${prefix[family as keyof typeof prefix]}_t${idx + 1}`)!;
        expect(tpl).toBeDefined();
        expect(tpl.tier).toBe(idx + 1);
        expect(tpl.unlockLevel).toBe(unlocks[idx]);
        expect(tpl.effects[0].value).toBe(val);
      });
    }
  });

  it('4) refuses the 6th use of one type in a battle when maxUsesPerBattle = 5', () => {
    const hpT1 = getSupplyTemplateById('sup_hp_t1')!;
    let units = [makeUnit({ hp: 500 })];
    let supplyByUnit: Record<string, ReturnType<typeof tickSupplyState>> = {};

    for (let i = 0; i < 5; i++) {
      units = [{ ...units[0], hp: 500 }];
      const res = applyBattleSupplyUse({
        units,
        supplyByUnit,
        unitId: 'ally_player',
        template: hpT1,
        stock: 10 - i,
        isOwnTurn: true,
        cfg: { supplyUsesPerTurn: 1, supplyEconomy: { maxUsesPerBattle: 5, spPriceMult: 2 } },
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      units = res.units;
      supplyByUnit = {
        ally_player: tickSupplyState(
          tickSupplyState(tickSupplyState(res.supplyByUnit.ally_player))
        ),
      };
    }

    units = [{ ...units[0], hp: 500 }];
    const sixth = applyBattleSupplyUse({
      units,
      supplyByUnit,
      unitId: 'ally_player',
      template: hpT1,
      stock: 5,
      isOwnTurn: true,
      cfg: { supplyUsesPerTurn: 1, supplyEconomy: { maxUsesPerBattle: 5, spPriceMult: 2 } },
    });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) {
      expect(sixth.reason).toBe('battle_limit');
    }
  });

  it('5) sets SP kit cooldown to 3 and HP kit cooldown to 2', () => {
    const hpT1 = getSupplyTemplateById('sup_hp_t1')!;
    const spT1 = getSupplyTemplateById('sup_sp_t1')!;
    expect(hpT1.cooldownTurns).toBe(2);
    expect(spT1.cooldownTurns).toBe(3);

    const unit = makeUnit({ hp: 1000, sp: 50 });
    const useSp = applyBattleSupplyUse({
      units: [unit],
      supplyByUnit: {},
      unitId: unit.id,
      template: spT1,
      stock: 5,
      isOwnTurn: true,
    });
    expect(useSp.ok).toBe(true);
    if (!useSp.ok) return;

    // 3 turns blocked, free on 4th turn tick
    let st = tickSupplyState(useSp.supplyByUnit[unit.id]); // end use turn -> cd left 3
    expect(st.cooldownsByTemplate[spT1.id]).toBe(3);
    st = tickSupplyState(st); // end turn 2 -> cd left 2
    st = tickSupplyState(st); // end turn 3 -> cd left 1
    expect(st.cooldownsByTemplate[spT1.id]).toBe(1);
    st = tickSupplyState(st); // end turn 4 -> cd 0
    expect(st.cooldownsByTemplate[spT1.id]).toBeUndefined();
  });
});
