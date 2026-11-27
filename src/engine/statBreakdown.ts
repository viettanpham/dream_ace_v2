import { EMPTY_STAT_BLOCK, MECH_CLASSES, STAT_KEYS } from '../data/classes';
import type {
  GearUnit,
  ItemSpecialTraits,
  StatBlock,
  StatKey,
} from '../types/game';
import type { GearPassiveBonuses } from './skills';
import { calculateEffectiveStats } from './stats';

export interface StatSourceBreakdown {
  base: number;
  levelGrowth: number;
  allocated: number;
  equipment: number;
  other: number;
  total: number;
}

export type StatBreakdownMap = Record<StatKey, StatSourceBreakdown>;

export function getStatBreakdown(
  gear: Pick<GearUnit, 'classId' | 'level' | 'allocatedPoints'>,
  equipBonuses: StatBlock = EMPTY_STAT_BLOCK,
  traits?: ItemSpecialTraits,
  passives?: GearPassiveBonuses,
  pending: StatBlock = EMPTY_STAT_BLOCK
): StatBreakdownMap {
  const cls = MECH_CLASSES[gear.classId];
  const levelBonus = Math.max(0, gear.level - 1);
  const totals = calculateEffectiveStats(
    gear.classId,
    gear.level,
    gear.allocatedPoints,
    pending,
    equipBonuses,
    traits,
    passives
  );

  const breakdown = {} as StatBreakdownMap;
  for (const key of STAT_KEYS) {
    const base = cls.baseStats[key];
    const levelGrowth = Math.floor(levelBonus * (cls.perPointGain[key] * 0.35));
    const totalPts = (gear.allocatedPoints[key] || 0) + (pending[key] || 0);
    const allocated = totalPts * cls.perPointGain[key];
    const equipment = equipBonuses[key] || 0;
    const total = totals[key];
    const other = total - (base + levelGrowth + allocated + equipment);

    breakdown[key] = {
      base,
      levelGrowth,
      allocated,
      equipment,
      other,
      total,
    };
  }

  return breakdown;
}
