// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEFAULT_FLUX_TRANSFER_CONFIG } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { formatCombatLogMessage } from '../../i18n';
import type { CombatUnit } from '../../types/game';
import {
  chooseAiDecision,
  pickFluxCount,
  resolveSpTransfer,
} from '../combat';

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> & { maxSp?: number } = {}
): CombatUnit {
  const { maxSp = 100, derived: derivedOverride, ...rest } = overrides;
  return {
    id,
    name,
    callsign: name,
    side,
    row: 'front',
    formationCol: 0,
    isPlayer: false,
    classId: side === 'ally' ? 'striker' : 'interceptor',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 400,
      maxShield: 100,
      maxSp,
      speed: 60,
      attackPower: 45,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
      ...derivedOverride,
    },
    hp: 400,
    shield: 100,
    sp: 20,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...rest,
  };
}

describe('TASK B2a — Flux Transfer', () => {
  it('1) L1 with 400 SP gives 12 SP each to 3 allies and costs support 40 SP', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 500,
      sp: 400,
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 20 });
    const a3 = makeUnit('a3', 'A3', 'ally', { maxSp: 100, sp: 30 });
    const e1 = makeUnit('e1', 'Enemy', 'enemy', { maxSp: 100, sp: 50 });

    const res = resolveSpTransfer(
      [sup, a1, a2, a3, e1],
      'sup',
      1,
      DEFAULT_FLUX_TRANSFER_CONFIG
    );

    expect(res.recipientIds).toEqual(['a1', 'a2', 'a3']);
    expect(res.updatedUnits.find((u) => u.id === 'a1')!.sp).toBe(22);
    expect(res.updatedUnits.find((u) => u.id === 'a2')!.sp).toBe(32);
    expect(res.updatedUnits.find((u) => u.id === 'a3')!.sp).toBe(42);
    expect(res.updatedUnits.find((u) => u.id === 'sup')!.sp).toBe(360);
    expect(res.cost).toBe(40);
    expect(res.popups.map((p) => p.text)).toEqual(['+12 SP', '+12 SP', '+12 SP']);
    expect(formatCombatLogMessage('vi', res.logEntry)).toBe(
      'Support truyền 36 SP cho 3 đồng đội (phí 4)'
    );
  });

  it('2) ally with 5 free SP receives 5 and fee counts only received', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 500,
      sp: 400,
    });
    const a1 = makeUnit('a1', 'NearFull', 'ally', { maxSp: 100, sp: 95 });

    const res = resolveSpTransfer([sup, a1], 'sup', 1, DEFAULT_FLUX_TRANSFER_CONFIG);

    expect(res.updatedUnits.find((u) => u.id === 'a1')!.sp).toBe(100);
    expect(res.totalMoved).toBe(5);
    expect(res.cost).toBe(6); // ceil(5 * 1.10) = 6
    expect(res.updatedUnits.find((u) => u.id === 'sup')!.sp).toBe(394);
  });

  it('3) full allies skipped and remaining selected lowest SP% first', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 500,
      sp: 400,
    });
    const full = makeUnit('full', 'Full', 'ally', { maxSp: 100, sp: 100 });
    const high = makeUnit('high', 'High', 'ally', { maxSp: 100, sp: 60 }); // 60%
    const mid = makeUnit('mid', 'Mid', 'ally', { maxSp: 100, sp: 30 }); // 30%
    const lowPctLargePool = makeUnit('low2', 'LowPool', 'ally', {
      maxSp: 200,
      sp: 40,
    }); // 20%
    const lowest = makeUnit('low1', 'Lowest', 'ally', { maxSp: 100, sp: 10 }); // 10%

    const res = resolveSpTransfer(
      [sup, full, high, mid, lowPctLargePool, lowest],
      'sup',
      1,
      DEFAULT_FLUX_TRANSFER_CONFIG
    );

    expect(res.recipientIds).toEqual(['low1', 'low2', 'mid']);
    expect(res.updatedUnits.find((u) => u.id === 'full')!.sp).toBe(100);
    expect(res.updatedUnits.find((u) => u.id === 'high')!.sp).toBe(60);
  });

  it('4) count = 1 hits only 1 lowest-SP% ally', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 500,
      sp: 400,
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 20 });
    const a3 = makeUnit('a3', 'A3', 'ally', { maxSp: 100, sp: 30 });

    const res = resolveSpTransfer(
      [sup, a1, a2, a3],
      'sup',
      1,
      DEFAULT_FLUX_TRANSFER_CONFIG,
      1
    );

    expect(res.recipientIds).toEqual(['a1']);
    expect(res.updatedUnits.find((u) => u.id === 'a1')!.sp).toBe(22);
    expect(res.updatedUnits.find((u) => u.id === 'a2')!.sp).toBe(20);
    expect(res.updatedUnits.find((u) => u.id === 'a3')!.sp).toBe(30);
    expect(res.updatedUnits.find((u) => u.id === 'sup')!.sp).toBe(386); // ceil(12 * 1.10) = 14
  });

  it('5) NPC skips Flux Transfer when no ally is under 50% SP', () => {
    const sup = makeUnit('sup', 'Support', 'enemy', {
      classId: 'support',
      maxSp: 500,
      sp: 400,
      equippedSkillIds: ['sup_flux_transfer'],
      skillLevels: { sup_flux_transfer: 1 },
    });
    const ally50 = makeUnit('ea1', 'EA1', 'enemy', { maxSp: 100, sp: 50 });
    const ally80 = makeUnit('ea2', 'EA2', 'enemy', { maxSp: 100, sp: 80 });
    const foe = makeUnit('p1', 'Player', 'ally', { maxSp: 100, sp: 50 });

    const picked = pickFluxCount(
      [sup, ally50, ally80, foe],
      'sup',
      DEFAULT_FLUX_TRANSFER_CONFIG.levels[0],
      0,
      () => 0.1
    );
    expect(picked).toBe(0);

    const decision = chooseAiDecision(sup, [sup, ally50, ally80, foe], () => 0.1);
    expect(decision.skillId).not.toBe('sup_flux_transfer');
  });
});
