import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import type { CombatUnit } from '../../types/game';
import {
  DEFAULT_FLUX_AUTO_CONFIG,
  FLUX_SKILL_ID,
  pickFluxAutoCount,
  sanitizeFluxAutoConfig,
} from '../fluxAuto';
import { createDefaultAdminConfig } from '../migration';

function makeUnit(
  id: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  return {
    id,
    name: id,
    callsign: id,
    side,
    row: 'back',
    formationCol: 0,
    isPlayer: side === 'ally',
    classId: 'support',
    level: 10,
    skillLevel: 1,
    skillLevels: {
      [FLUX_SKILL_ID]: 3,
      sup_nanite_mend: 1,
    },
    equippedSkillIds: [FLUX_SKILL_ID],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 600,
      maxShield: 200,
      maxSp: 100,
      speed: 90,
      attackPower: 60,
      defenseRating: 25,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    hp: 600,
    shield: 200,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('B2b — Auto Flux Transfer (fluxAuto)', () => {
  it('1) sanitizeFluxAutoConfig replaces garbage with defaults and clamps 0..100', () => {
    expect(sanitizeFluxAutoConfig(undefined)).toEqual(DEFAULT_FLUX_AUTO_CONFIG);
    expect(sanitizeFluxAutoConfig('bad')).toEqual(DEFAULT_FLUX_AUTO_CONFIG);
    expect(
      sanitizeFluxAutoConfig({
        enabled: 'nope',
        mode: 'other',
        allySpBelowPct: '',
        keepSelfPct: null,
      })
    ).toEqual(DEFAULT_FLUX_AUTO_CONFIG);
    expect(
      sanitizeFluxAutoConfig({
        enabled: false,
        mode: 'fixed',
        allySpBelowPct: 145.6,
        keepSelfPct: -20,
      })
    ).toEqual({
      enabled: false,
      mode: 'fixed',
      allySpBelowPct: 100,
      keepSelfPct: 0,
    });
  });

  it('2) pickFluxAutoCount returns 0 when enabled=false', () => {
    const adminConfig = createDefaultAdminConfig();
    const support = makeUnit('sup', 'ally', {
      sp: 500,
      derived: { ...makeUnit('tmp', 'ally').derived, maxSp: 500 },
    });
    const allyLow = makeUnit('ally1', 'ally', { classId: 'striker', sp: 10 });
    const enemy = makeUnit('e1', 'enemy', { isPlayer: false, classId: 'striker' });

    const count = pickFluxAutoCount(
      [support, allyLow, enemy],
      support,
      {
        fluxAuto: { enabled: false, mode: 'smart', allySpBelowPct: 25, keepSelfPct: 50 },
        adminConfig,
      },
      () => 0.1
    );
    expect(count).toBe(0);
  });

  it('3) smart mode returns >0 when ally SP < 25% and no ready heal, and returns 0 when heal is available', () => {
    const adminConfig = createDefaultAdminConfig();
    const allyLow = makeUnit('ally1', 'ally', { classId: 'striker', sp: 10 });
    const enemy = makeUnit('e1', 'enemy', { isPlayer: false, classId: 'striker' });

    const supportNoHeal = makeUnit('sup', 'ally', {
      sp: 500,
      derived: { ...makeUnit('tmp', 'ally').derived, maxSp: 500 },
      equippedSkillIds: [FLUX_SKILL_ID],
    });
    expect(
      pickFluxAutoCount(
        [supportNoHeal, allyLow, enemy],
        supportNoHeal,
        { fluxAuto: DEFAULT_FLUX_AUTO_CONFIG, adminConfig },
        () => 0.1
      )
    ).toBeGreaterThan(0);

    const supportWithHeal = makeUnit('sup', 'ally', {
      sp: 500,
      derived: { ...makeUnit('tmp', 'ally').derived, maxSp: 500 },
      equippedSkillIds: [FLUX_SKILL_ID, 'sup_nanite_mend'],
    });
    expect(
      pickFluxAutoCount(
        [supportWithHeal, allyLow, enemy],
        supportWithHeal,
        { fluxAuto: DEFAULT_FLUX_AUTO_CONFIG, adminConfig },
        () => 0.1
      )
    ).toBe(0);
  });

  it('4) fixed mode with allySpBelowPct=60 triggers on 50% SP ally while smart mode returns 0', () => {
    const adminConfig = createDefaultAdminConfig();
    const support = makeUnit('sup', 'ally', {
      sp: 500,
      derived: { ...makeUnit('tmp', 'ally').derived, maxSp: 500 },
      equippedSkillIds: [FLUX_SKILL_ID],
    });
    const allyMid = makeUnit('ally1', 'ally', { classId: 'striker', sp: 50 });
    const enemy = makeUnit('e1', 'enemy', { isPlayer: false, classId: 'striker' });

    expect(
      pickFluxAutoCount(
        [support, allyMid, enemy],
        support,
        { fluxAuto: { enabled: true, mode: 'smart', allySpBelowPct: 25, keepSelfPct: 50 }, adminConfig },
        () => 0.1
      )
    ).toBe(0);

    expect(
      pickFluxAutoCount(
        [support, allyMid, enemy],
        support,
        { fluxAuto: { enabled: true, mode: 'fixed', allySpBelowPct: 60, keepSelfPct: 50 }, adminConfig },
        () => 0.1
      )
    ).toBeGreaterThan(0);
  });
});
