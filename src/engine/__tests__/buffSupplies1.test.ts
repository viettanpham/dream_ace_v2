import { describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import rawConsumablesJson from '../../data/consumables.json';
import {
  getSupplyTemplateById,
  SUPPLY_TEMPLATES,
  validateSupplyTemplates,
} from '../../data/consumables';
import { formatCombatLogMessage } from '../../i18n';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import type { CombatUnit } from '../../types/game';
import { getEffectiveUnitDodge, getEffectiveUnitSpeed } from '../combat';
import { generateSupplyShopStockWp } from '../shop';
import { tickStatusDurations } from '../statusEngine';
import {
  applyBattleSupplyUse,
  buildSupplyUseFeedback,
  canUseSupply,
  filterAutoOrNpcSupplies,
} from '../supplies';

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally_player',
    name: 'Vance',
    callsign: 'Vance',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    isPlayer: true,
    classId: 'striker',
    level: 40,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: ['str_plasma_burst', 'str_piercing_salvo', 'str_overdrive'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 1000,
      maxShield: 500,
      maxSp: 200,
      speed: 100,
      attackPower: 80,
      defenseRating: 40,
      dodgeChance: 10,
      critChance: 10,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 1000,
    shield: 500,
    sp: 200,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('TASK BUFFSUP-1 — 4 new battle supply families', () => {
  it('1) reset_cooldowns picks longest cooldowns first, logs skill names, and refuses without any', () => {
    const tpl2 = getSupplyTemplateById('sup_cooldown_t2')!;
    const noCdUnit = makeUnit({ skillCooldowns: {} });
    const refused = canUseSupply({
      template: tpl2,
      stock: 3,
      unit: noCdUnit,
      isOwnTurn: true,
    });
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('no_cooldowns');

    const failApply = applyBattleSupplyUse({
      units: [noCdUnit],
      unitId: noCdUnit.id,
      template: tpl2,
      stock: 3,
      isOwnTurn: true,
    });
    expect(failApply.ok).toBe(false);

    const cdUnit = makeUnit({
      skillCooldowns: {
        str_plasma_burst: 1,
        str_piercing_salvo: 3,
        str_overdrive: 3,
      },
    });
    const res = applyBattleSupplyUse({
      units: [cdUnit],
      unitId: cdUnit.id,
      template: tpl2,
      stock: 3,
      isOwnTurn: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.resetSkillIds).toEqual(['str_piercing_salvo', 'str_overdrive']);
    expect(res.units[0].skillCooldowns).toEqual({ str_plasma_burst: 1 });

    const fb = buildSupplyUseFeedback({
      units: [cdUnit],
      round: 1,
      actor: cdUnit,
      template: tpl2,
      result: res,
      uidSuffix: 'cd',
    });
    expect(formatCombatLogMessage('vi', fb.logEntry)).toContain('Reset hồi chiêu:');
  });

  it('2) cleanse_debuffs removes at most N debuffs using rng, keeps buffs, and refuses without any', () => {
    const tpl3 = getSupplyTemplateById('sup_cleanse_t3')!; // value: 2
    const buffOnlyUnit = makeUnit({
      statuses: [{ type: 'atk_up', turnsRemaining: 2, magnitude: 0.2, isDebuff: false }],
    });
    const refused = canUseSupply({
      template: tpl3,
      stock: 3,
      unit: buffOnlyUnit,
      isOwnTurn: true,
    });
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('no_debuffs');

    const unit = makeUnit({
      statuses: [
        { type: 'atk_up', turnsRemaining: 2, magnitude: 0.2, isDebuff: false },
        { type: 'burn', turnsRemaining: 2 },
        { type: 'slow', turnsRemaining: 2 },
        { type: 'shield_cracked', turnsRemaining: 2, isDebuff: true },
      ],
    });
    const res = applyBattleSupplyUse({
      units: [unit],
      unitId: unit.id,
      template: tpl3,
      stock: 3,
      isOwnTurn: true,
      rng: () => 0.25,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.cleansedCount).toBe(2);
    const remaining = res.units[0].statuses;
    expect(remaining.some((s) => s.type === 'atk_up')).toBe(true);
    expect(remaining).toHaveLength(2);
  });

  it('3) flare adds flat dodge points for 1 round, ticks off at next own turn, and caps at 45', () => {
    const tpl5 = getSupplyTemplateById('sup_flare_t5')!; // +17 dodge, 1 round
    const unit = makeUnit({
      derived: { ...makeUnit().derived, dodgeChance: 35 },
    });
    const res = applyBattleSupplyUse({
      units: [unit],
      unitId: unit.id,
      template: tpl5,
      stock: 2,
      isOwnTurn: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const buffed = res.units[0];
    expect(buffed.statuses.some((s) => s.type === 'eva_up')).toBe(false);
    expect(
      buffed.statuses.some((s) => s.registryId === 'ENG_flare_dodge')
    ).toBe(true);
    expect(getEffectiveUnitDodge(buffed)).toBe(45); // 35 + 17 = 52 capped at 45

    const lowDodgeRes = applyBattleSupplyUse({
      units: [makeUnit({ derived: { ...makeUnit().derived, dodgeChance: 10 } })],
      unitId: 'ally_player',
      template: tpl5,
      stock: 2,
      isOwnTurn: true,
    });
    expect(lowDodgeRes.ok).toBe(true);
    if (!lowDodgeRes.ok) return;
    expect(getEffectiveUnitDodge(lowDodgeRes.units[0])).toBe(27);

    const ticked = tickStatusDurations(lowDodgeRes.units[0].statuses).statuses;
    expect(ticked.some((s) => s.registryId === 'ENG_flare_dodge')).toBe(false);
  });

  it('4) haste refreshes rounds on same tier (no pct stacking), stronger wins, weaker never lowers', () => {
    const t2 = getSupplyTemplateById('sup_haste_t2')!; // +20%, 3 rounds
    const t4 = getSupplyTemplateById('sup_haste_t4')!; // +40%, 3 rounds
    const t1 = getSupplyTemplateById('sup_haste_t1')!; // +10%, 3 rounds

    const base = makeUnit({
      statuses: [{ type: 'spd_up', turnsRemaining: 1, magnitude: 0.2, isDebuff: false }],
    });
    const refreshed = applyBattleSupplyUse({
      units: [base],
      unitId: base.id,
      template: t2,
      stock: 3,
      isOwnTurn: true,
    });
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(getEffectiveUnitSpeed(refreshed.units[0])).toBe(120);
    expect(
      refreshed.units[0].statuses.find((s) => s.type === 'spd_up')?.turnsRemaining
    ).toBe(3);

    const upgraded = applyBattleSupplyUse({
      units: refreshed.units,
      unitId: base.id,
      template: t4,
      stock: 3,
      isOwnTurn: true,
    });
    expect(upgraded.ok).toBe(true);
    if (!upgraded.ok) return;
    expect(getEffectiveUnitSpeed(upgraded.units[0])).toBe(140);

    const weakerAttempt = applyBattleSupplyUse({
      units: upgraded.units,
      unitId: base.id,
      template: t1,
      stock: 3,
      isOwnTurn: true,
    });
    expect(weakerAttempt.ok).toBe(true);
    if (!weakerAttempt.ok) return;
    expect(getEffectiveUnitSpeed(weakerAttempt.units[0])).toBe(140);
  });

  it('5) catalog = 16 + 20 rows (0 dropped), vi/en parity, no WP rows, and NPC/auto excluded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validated = validateSupplyTemplates(rawConsumablesJson);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();

    expect(SUPPLY_TEMPLATES).toHaveLength(36);
    expect(validated).toHaveLength(36);

    const newIds = [
      'sup_cooldown_t1', 'sup_cooldown_t2', 'sup_cooldown_t3', 'sup_cooldown_t4', 'sup_cooldown_t5',
      'sup_cleanse_t1', 'sup_cleanse_t2', 'sup_cleanse_t3', 'sup_cleanse_t4', 'sup_cleanse_t5',
      'sup_flare_t1', 'sup_flare_t2', 'sup_flare_t3', 'sup_flare_t4', 'sup_flare_t5',
      'sup_haste_t1', 'sup_haste_t2', 'sup_haste_t3', 'sup_haste_t4', 'sup_haste_t5',
    ];
    for (const id of newIds) {
      expect(getSupplyTemplateById(id)).toBeDefined();
      const key = `supply.${id}.name` as keyof typeof VI_TRANSLATIONS;
      expect(typeof VI_TRANSLATIONS[key]).toBe('string');
      expect(typeof EN_TRANSLATIONS[key]).toBe('string');
    }

    const extraKeys = [
      'supply.reason.no_cooldowns',
      'supply.reason.no_debuffs',
      'supply.effect.resetCooldowns',
      'supply.effect.cleanseDebuffs',
      'supply.effect.grantDodgeOne',
      'supply.effect.grantDodge',
      'supply.effect.grantSpeedPctOne',
      'supply.effect.grantSpeedPct',
      'supply.perBattleLimit',
    ] as const;
    for (const k of extraKeys) {
      expect(typeof VI_TRANSLATIONS[k]).toBe('string');
      expect(typeof EN_TRANSLATIONS[k]).toBe('string');
    }

    const wpStock = generateSupplyShopStockWp(40, null, 10, SUPPLY_TEMPLATES, () => 0.42);
    expect(wpStock.some((row) => newIds.includes(row.templateId))).toBe(false);

    const npcFiltered = filterAutoOrNpcSupplies(SUPPLY_TEMPLATES);
    expect(npcFiltered.some((tpl) => newIds.includes(tpl.id))).toBe(false);
  });
});
