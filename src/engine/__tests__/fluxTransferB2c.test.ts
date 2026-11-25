// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { previewFluxTransfer } from '../../components/FluxTransferPicker';
import { DEFAULT_FLUX_TRANSFER_CONFIG } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getBattleSkillReason } from '../../i18n';
import type { CombatUnit } from '../../types/game';
import {
  getMaxAffordableFluxCount,
  pickFluxCount,
  resolveSpTransfer,
} from '../combat';
import { canUnitUseSkill } from '../skills';

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

describe('TASK B2c — Flux Transfer min per ally & emergency rule', () => {
  it('1) L1 support SP 120: 3 allies get 20 each, support pays 66', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 300,
      sp: 120,
      skillLevels: { sup_flux_transfer: 1 },
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 15 });
    const a3 = makeUnit('a3', 'A3', 'ally', { maxSp: 100, sp: 20 });

    const res = resolveSpTransfer(
      [sup, a1, a2, a3],
      'sup',
      1,
      DEFAULT_FLUX_TRANSFER_CONFIG
    );

    expect(res.recipientIds).toEqual(['a1', 'a2', 'a3']);
    expect(res.updatedUnits.find((u) => u.id === 'a1')!.sp).toBe(30);
    expect(res.updatedUnits.find((u) => u.id === 'a2')!.sp).toBe(35);
    expect(res.updatedUnits.find((u) => u.id === 'a3')!.sp).toBe(40);
    expect(res.totalMoved).toBe(60);
    expect(res.cost).toBe(66);
    expect(res.updatedUnits.find((u) => u.id === 'sup')!.sp).toBe(54);
  });

  it('2) L3 support SP 100: k lowered to 1, amount 60 (picker matches cap)', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 300,
      sp: 100,
      skillLevels: { sup_flux_transfer: 3 },
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 200, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 200, sp: 20 });
    const a3 = makeUnit('a3', 'A3', 'ally', { maxSp: 200, sp: 30 });
    const units = [sup, a1, a2, a3];

    expect(
      getMaxAffordableFluxCount(units, 'sup', 3, DEFAULT_FLUX_TRANSFER_CONFIG)
    ).toBe(1);

    const preview = previewFluxTransfer(units, 'sup', DEFAULT_FLUX_TRANSFER_CONFIG);
    expect(preview.maxCount).toBe(1);
    expect(preview.count).toBe(1);

    const res = resolveSpTransfer(units, 'sup', 3, DEFAULT_FLUX_TRANSFER_CONFIG);
    expect(res.recipientIds).toEqual(['a1']);
    expect(res.amountPerAlly).toBe(60);
    expect(res.totalMoved).toBe(60);
    expect(res.cost).toBe(63);
    expect(res.updatedUnits.find((u) => u.id === 'sup')!.sp).toBe(37);
  });

  it('3) ally with 5 free SP receives 5 and fee counts only that', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 300,
      sp: 120,
      skillLevels: { sup_flux_transfer: 1 },
    });
    const a1 = makeUnit('a1', 'NearFull', 'ally', { maxSp: 100, sp: 95 });

    const res = resolveSpTransfer(
      [sup, a1],
      'sup',
      1,
      DEFAULT_FLUX_TRANSFER_CONFIG
    );

    expect(res.updatedUnits.find((u) => u.id === 'a1')!.sp).toBe(100);
    expect(res.totalMoved).toBe(5);
    expect(res.cost).toBe(6); // ceil(5 * 1.10) = 6
    expect(res.updatedUnits.find((u) => u.id === 'sup')!.sp).toBe(114);
  });

  it('4) NPC skips when no ally is under 25% SP and casts when an ally is under 25% SP keeping >=50%', () => {
    const sup = makeUnit('sup', 'Support', 'enemy', {
      classId: 'support',
      maxSp: 200,
      sp: 180,
      equippedSkillIds: ['sup_flux_transfer'],
      skillLevels: { sup_flux_transfer: 1 },
    });
    const ally30 = makeUnit('ea1', 'EA1', 'enemy', { maxSp: 100, sp: 30 });
    const ally20 = makeUnit('ea2', 'EA2', 'enemy', { maxSp: 100, sp: 20 });
    const foe = makeUnit('p1', 'Player', 'ally', { maxSp: 100, sp: 50 });

    const skipCount = pickFluxCount(
      [sup, ally30, foe],
      'sup',
      DEFAULT_FLUX_TRANSFER_CONFIG,
      0,
      () => 0.1
    );
    expect(skipCount).toBe(0);

    const emergencyCount = pickFluxCount(
      [sup, ally30, ally20, foe],
      'sup',
      DEFAULT_FLUX_TRANSFER_CONFIG,
      0,
      () => 0.1
    );
    expect(emergencyCount).toBe(1);
  });

  it('5) skill not castable when support cannot afford 1 x min', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      classId: 'support',
      maxSp: 200,
      sp: 21, // L1 min=20, fee 10% -> minCostForOne = 22
      equippedSkillIds: ['sup_flux_transfer'],
      skillLevels: { sup_flux_transfer: 1 },
    });

    const usability = canUnitUseSkill(sup, 'sup_flux_transfer', {
      fluxTransfer: DEFAULT_FLUX_TRANSFER_CONFIG,
    });
    expect(usability.canUse).toBe(false);
    expect(usability.reason).toBe('flux_min_sp');
    expect(usability.spCost).toBe(22);
    expect(getBattleSkillReason('vi', usability)).toBe('Cần tối thiểu 22 SP');
    expect(getBattleSkillReason('en', usability)).toBe('Need 22 SP min');
  });
});
