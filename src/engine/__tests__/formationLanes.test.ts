import { describe, expect, it } from 'vitest';
import {
  cloneFormationConfig,
  DEFAULT_FORMATION_CONFIG,
} from '../../data/formationConfig';
import { createInitialBattleState } from '../combat';
import { autoPlaceFormation, getRowCounts } from '../formation';
import { createDefaultPilotAccount } from '../stats';
import type { BattleSize, MechClassId } from '../../types/game';

function createSeededRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface SizeStats {
  size: BattleSize;
  seeds: number;
  supportInFront: number;
  supportInFrontWithMidOrBackFree: number;
  siegeInFront: number;
  supportUnitsTotal: number;
  distinctFormations: number;
}

function measureEnemySpawnsForSize(size: BattleSize, seedCount = 500): SizeStats {
  const pilot = createDefaultPilotAccount('Commander', 'striker');
  const caps = DEFAULT_FORMATION_CONFIG.rowCapacities;

  let supportInFront = 0;
  let supportInFrontWithMidOrBackFree = 0;
  let siegeInFront = 0;
  let supportUnitsTotal = 0;
  const patterns = new Set<string>();

  for (let seed = 1; seed <= seedCount; seed++) {
    const battle = createInitialBattleState(
      pilot,
      'debris_belt',
      createSeededRng(seed),
      size
    );
    const enemies = battle.units.filter((u) => u.side === 'enemy');
    const counts = getRowCounts(enemies);
    const midFree = counts.middle < caps.middle;
    const backFree = counts.back < caps.back;

    patterns.add(enemies.map((e) => `${e.archetype}:${e.row}`).join('|'));

    for (const enemy of enemies) {
      if (enemy.classId === 'support') {
        supportUnitsTotal += 1;
        if (enemy.row === 'front') {
          supportInFront += 1;
          if (midFree || backFree) {
            supportInFrontWithMidOrBackFree += 1;
          }
        }
      }
      if (enemy.classId === 'siege' && enemy.row === 'front') {
        siegeInFront += 1;
      }
    }
  }

  return {
    size,
    seeds: seedCount,
    supportInFront,
    supportInFrontWithMidOrBackFree,
    siegeInFront,
    supportUnitsTotal,
    distinctFormations: patterns.size,
  };
}

describe('FM1: Enemy spawn lane placement across 500 seeds per size', () => {
  it('never places support in front while middle or back has room, and puts siege in front across 500 seeds per size', () => {
    const results = ([4, 6, 8] as BattleSize[]).map((size) =>
      measureEnemySpawnsForSize(size, 500)
    );

    for (const r of results) {
      console.log(
        `[FM1 AFTER] size=${r.size} seeds=${r.seeds} supportTotal=${r.supportUnitsTotal} (a)supportInFront=${r.supportInFront} (b)withMidOrBackFree=${r.supportInFrontWithMidOrBackFree} (c)siegeInFront=${r.siegeInFront} patterns=${r.distinctFormations}`
      );
      expect(r.supportUnitsTotal).toBeGreaterThan(0);
      expect(r.supportInFrontWithMidOrBackFree).toBe(0);
      expect(r.supportInFront).toBe(0);
      expect(r.siegeInFront).toBeGreaterThan(0);
      expect(r.distinctFormations).toBeGreaterThan(1);
    }
  });

  it('allows support into front only when middle+back are completely full, and preserves determinism and customized ally formations', () => {
    const tightMidBackCfg = cloneFormationConfig(DEFAULT_FORMATION_CONFIG);
    tightMidBackCfg.rowCapacities = { front: 5, middle: 2, back: 1 };

    const roster: Array<{ id: string; classId: MechClassId }> = [
      { id: 'st1', classId: 'striker' },
      { id: 'in1', classId: 'interceptor' },
      { id: 'sg1', classId: 'siege' },
      { id: 'sg2', classId: 'siege' },
      { id: 'sp1', classId: 'support' },
      { id: 'sp2', classId: 'support' },
    ];

    for (let seed = 1; seed <= 50; seed++) {
      const placed = autoPlaceFormation(roster, tightMidBackCfg, {
        rng: createSeededRng(seed),
        randomVariation: 0.25,
      });
      const counts = getRowCounts(placed);
      const supportFrontCount = placed.filter(
        (u) => u.classId === 'support' && u.row === 'front'
      ).length;
      if (supportFrontCount > 0) {
        expect(counts.middle).toBe(tightMidBackCfg.rowCapacities.middle);
        expect(counts.back).toBe(tightMidBackCfg.rowCapacities.back);
      }
    }

    // Deterministic output for the same rng seed
    const pilot = createDefaultPilotAccount('Deterministic', 'striker');
    const a = createInitialBattleState(pilot, 'debris_belt', createSeededRng(123), 8);
    const b = createInitialBattleState(pilot, 'debris_belt', createSeededRng(123), 8);
    expect(a.units.map((u) => [u.id, u.row, u.formationCol])).toEqual(
      b.units.map((u) => [u.id, u.row, u.formationCol])
    );

    // Customized ally formations keep exact row choices
    const customPilot = createDefaultPilotAccount('CustomLead', 'support');
    customPilot.formationCustomized = true;
    customPilot.squadFormation = (customPilot.squadFormation ?? []).map((u) =>
      u.isPlayer ? { ...u, row: 'front' } : u
    );
    const customBattle = createInitialBattleState(
      customPilot,
      'debris_belt',
      createSeededRng(77),
      4
    );
    const placedLead = customBattle.units.find((u) => u.isPlayer)!;
    expect(placedLead.row).toBe('front');
  });
});
