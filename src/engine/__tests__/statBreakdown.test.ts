import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK, MECH_CLASS_LIST, STAT_KEYS } from '../../data/classes';
import { useGameStore } from '../../store/useGameStore';
import { createEmptyGearPassiveBonuses, type GearPassiveBonuses } from '../skills';
import { getStatBreakdown } from '../statBreakdown';
import { calculateEffectiveStats } from '../stats';
import type { GearUnit, ItemSpecialTraits, StatBlock } from '../../types/game';

function makeGear(
  classId: GearUnit['classId'],
  level: number,
  allocatedPoints: StatBlock = { ...EMPTY_STAT_BLOCK }
): GearUnit {
  const base = useGameStore.getState().pilot.gears[classId];
  return {
    ...base,
    classId,
    owned: true,
    level,
    exp: 0,
    unspentPoints: 0,
    allocatedPoints,
    equipped: {
      main_weapon: null,
      sub_weapon: null,
      armor: null,
      engine: null,
      cpu: null,
      accessory: null,
      radar: null,
    },
  };
}

describe('getStatBreakdown', () => {
  it('matches calculateEffectiveStats and sums to total for every class with and without equipment, traits, passives, pending, and negative evasionMod', () => {
    const samplePassives: GearPassiveBonuses = {
      ...createEmptyGearPassiveBonuses(),
      skillDmgPct: 10,
      defPct: 20,
      evaPct: 15,
      speedPct: 10,
      spRegenPerTurn: 2,
    };

    const scenarios: Array<{
      name: string;
      level: number;
      allocated: StatBlock;
      pending: StatBlock;
      equipBonuses: StatBlock;
      traits: ItemSpecialTraits;
      usePassive: boolean;
    }> = [
      {
        name: 'base level 1',
        level: 1,
        allocated: { ...EMPTY_STAT_BLOCK },
        pending: { ...EMPTY_STAT_BLOCK },
        equipBonuses: { ...EMPTY_STAT_BLOCK },
        traits: {},
        usePassive: false,
      },
      {
        name: 'full build with positive traits & passives & pending',
        level: 6,
        allocated: {
          attack: 5,
          defense: 3,
          fuel: 2,
          spirit: 4,
          shield: 2,
          evasion: 1,
        },
        pending: {
          attack: 2,
          defense: 1,
          fuel: 0,
          spirit: 1,
          shield: 0,
          evasion: 3,
        },
        equipBonuses: {
          attack: 8,
          defense: 6,
          fuel: 4,
          spirit: 5,
          shield: 7,
          evasion: 3,
        },
        traits: {
          evasionMod: 4,
        },
        usePassive: true,
      },
      {
        name: 'negative evasionMod trait produces negative other while preserving exact total',
        level: 4,
        allocated: {
          attack: 2,
          defense: 2,
          fuel: 1,
          spirit: 1,
          shield: 1,
          evasion: 1,
        },
        pending: { ...EMPTY_STAT_BLOCK },
        equipBonuses: {
          attack: 3,
          defense: 10,
          fuel: 0,
          spirit: 0,
          shield: 5,
          evasion: 2,
        },
        traits: {
          evasionMod: -6,
        },
        usePassive: false,
      },
    ];

    for (const cls of MECH_CLASS_LIST) {
      for (const sc of scenarios) {
        const gear = makeGear(cls.id, sc.level, sc.allocated);
        const passives = sc.usePassive ? samplePassives : undefined;

        const breakdown = getStatBreakdown(
          gear,
          sc.equipBonuses,
          sc.traits,
          passives,
          sc.pending
        );

        const expectedTotals = calculateEffectiveStats(
          gear.classId,
          gear.level,
          gear.allocatedPoints,
          sc.pending,
          sc.equipBonuses,
          sc.traits,
          passives
        );

        for (const key of STAT_KEYS) {
          const entry = breakdown[key];
          expect(
            entry.total,
            `${cls.id} (${sc.name}) ${key} total mismatch`
          ).toBe(expectedTotals[key]);
          expect(
            entry.base +
              entry.levelGrowth +
              entry.allocated +
              entry.equipment +
              entry.other,
            `${cls.id} (${sc.name}) ${key} additive check`
          ).toBe(entry.total);
        }

        if ((sc.traits.evasionMod ?? 0) < 0) {
          expect(breakdown.evasion.other).toBeLessThan(0);
        }
      }
    }
  });
});
