// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { previewFluxTransfer } from '../../components/FluxTransferPicker';
import {
  DEFAULT_PASSIVE_SLOTS_CONFIG,
  getFluxTransferRule,
  getSkillUpgradeCost,
  getUnlockedPassiveSlots,
  sanitizePassiveSlotsConfig,
} from '../../data/balance';
import { getCatalogRow } from '../../data/iconCatalog';
import { SECTORS_CATALOG } from '../../data/maps';
import { getScaledSkillStats, getSkillById } from '../../data/skills';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import type { AdminConfig, GearUnit } from '../../types/game';
import { formatSkillRealSummary } from '../../utils/skillDisplay';
import {
  buildNpcSkillLoadout,
  createInitialBattleState,
  resolveSpTransfer,
} from '../combat';
import {
  CURRENT_SAVE_VERSION,
  createDefaultAdminConfig,
  migrateSaveData,
} from '../migration';
import { getGearPassiveBonuses } from '../skills';
import { createDefaultGearUnit, createDefaultPilotAccount } from '../stats';

function makeAdmin(overrides: Partial<AdminConfig> = {}): AdminConfig {
  return {
    ...createDefaultAdminConfig(),
    ...overrides,
  };
}

describe('TASK S1b: Skill level cap, real-number cards, configurable passive slots', () => {
  it('1) cap 5 -> 10 -> 3 preserves stored levels, clamps effective, and Flux uses effective cap', () => {
    const pilot = createDefaultPilotAccount('Ace', 'support');
    pilot.gears.support.level = 50;
    pilot.gears.support.skillLevels = {
      sup_nanite_mend: 8,
      sup_flux_transfer: 8,
    };
    pilot.gears.support.equippedSkillBar = ['sup_nanite_mend', 'sup_flux_transfer'];

    // Migrate at cap 3: stored level 8 is preserved (sanity 1..20)
    const migrated = migrateSaveData(
      {
        saveVersion: CURRENT_SAVE_VERSION,
        pilot,
        adminConfig: makeAdmin({ skillMaxLevel: 3 }),
      },
      CURRENT_SAVE_VERSION
    );
    expect(migrated.pilot.gears.support.skillLevels.sup_flux_transfer).toBe(8);

    // Effective level in battle & cards is clamped to cap 3 vs 10
    const viper = getSkillById('str_viper_sweep')!;
    const scaledCap10 = getScaledSkillStats(viper, 8, { skillMaxLevel: 10 });
    const scaledCap3 = getScaledSkillStats(viper, 8, { skillMaxLevel: 3 });
    expect(scaledCap10.level).toBe(8);
    expect(scaledCap3.level).toBe(3);

    const cardSummaryCap3 = formatSkillRealSummary(viper, 8, 'vi', {
      skillMaxLevel: 3,
    });
    expect(cardSummaryCap3.effectiveLevel).toBe(3);
    expect(cardSummaryCap3.nextLevel).toBeNull();

    // Flux Transfer respects effective cap (3 vs 10)
    const battle = createInitialBattleState(
      pilot,
      SECTORS_CATALOG[0].id,
      () => 0.5,
      undefined,
      makeAdmin({ skillMaxLevel: 3 })
    );
    const units = battle.units.map((u) =>
      u.isPlayer
        ? { ...u, sp: 100 }
        : u.side === 'ally'
        ? { ...u, sp: 0 }
        : u
    );
    const playerUnit = units.find((u) => u.isPlayer)!;
    expect(playerUnit.skillLevels.sup_flux_transfer).toBe(3);

    const previewCap3 = previewFluxTransfer(units, playerUnit.id, undefined, undefined, 3);
    const ruleCap3 = getFluxTransferRule(8, undefined, 3);
    expect(previewCap3.rule.targets).toBe(ruleCap3.targets);
    expect(previewCap3.rule.pct).toBe(ruleCap3.pct);
    expect(previewCap3.skillLevel).toBe(3);

    const resolvedCap3 = resolveSpTransfer(
      units,
      playerUnit.id,
      8,
      undefined,
      1,
      1,
      undefined,
      'sup_flux_transfer',
      3
    );
    expect(resolvedCap3.logEntry.params?.fee).toBe(ruleCap3.fee);
  });

  it('2) passive scaling above Lv5, restorePctCap, and upgrade cost beyond Lv5 table', () => {
    const passive = getSkillById('str_passive_ordnance')!; // +5% per level
    const lv5 = getScaledSkillStats(passive, 5, {
      skillMaxLevel: 10,
      passiveScaleAfter5: 0.5,
    });
    expect(lv5.buffMagnitude).toBeCloseTo(0.25, 4);

    const lv8 = getScaledSkillStats(passive, 8, {
      skillMaxLevel: 10,
      passiveScaleAfter5: 0.5,
    });
    // 5 + (8 - 5) * 0.5 = 6.5 * 0.05 = 0.325
    expect(lv8.buffMagnitude).toBeCloseTo(0.325, 4);

    // Heal / shield restore % cap
    const mend = getSkillById('sup_nanite_mend')!; // base 0.30
    const mendUncapped = getScaledSkillStats(mend, 20, {
      skillMaxLevel: 20,
      restorePctCap: 1.0,
    });
    const mendCapped = getScaledSkillStats(mend, 20, {
      skillMaxLevel: 20,
      restorePctCap: 0.8,
    });
    expect(mendUncapped.buffMagnitude).toBeCloseTo(0.87, 3);
    expect(mendCapped.buffMagnitude).toBe(0.8);

    const bastion = getSkillById('sge_bastion_lock')!; // secondaryMagnitude 0.30 shield restore
    const bastionCapped = getScaledSkillStats(bastion, 20, {
      skillMaxLevel: 20,
      restorePctCap: 0.5,
    });
    expect(bastionCapped.secondaryMagnitude).toBe(0.5);

    // Upgrade costs Lv1..5 match legacy; Lv6+ = round(2200 * 1.8^(targetLv - 5))
    expect(getSkillUpgradeCost(4, 5)).toBe(2200);
    expect(getSkillUpgradeCost(5, 5)).toBeNull();
    expect(getSkillUpgradeCost(5, 10)).toBe(Math.round(2200 * 1.8));
    expect(getSkillUpgradeCost(6, 10)).toBe(Math.round(2200 * Math.pow(1.8, 2)));
  });

  it('3) getUnlockedPassiveSlots with defaults and custom config', () => {
    expect(getUnlockedPassiveSlots(1, DEFAULT_PASSIVE_SLOTS_CONFIG)).toBe(2);
    expect(getUnlockedPassiveSlots(5, DEFAULT_PASSIVE_SLOTS_CONFIG)).toBe(3);
    expect(getUnlockedPassiveSlots(10, DEFAULT_PASSIVE_SLOTS_CONFIG)).toBe(4);
    expect(getUnlockedPassiveSlots(30, DEFAULT_PASSIVE_SLOTS_CONFIG)).toBe(8);
    expect(getUnlockedPassiveSlots(50, DEFAULT_PASSIVE_SLOTS_CONFIG)).toBe(12);
    expect(getUnlockedPassiveSlots(99, DEFAULT_PASSIVE_SLOTS_CONFIG)).toBe(12);

    const custom = sanitizePassiveSlotsConfig({
      initial: 3,
      everyLevels: 10,
      max: 7,
    });
    expect(getUnlockedPassiveSlots(1, custom)).toBe(3);
    expect(getUnlockedPassiveSlots(10, custom)).toBe(4);
    expect(getUnlockedPassiveSlots(50, custom)).toBe(7);

    // Sanitizer clamps bounds & max >= initial
    const clamped = sanitizePassiveSlotsConfig({
      initial: 8,
      everyLevels: 0,
      max: 2,
    });
    expect(clamped).toEqual({ initial: 8, everyLevels: 1, max: 8 });
  });

  it('4) only equipped passives apply, migration fills slots, overflow kept in save, NPC loadout equips passives', () => {
    const gear: GearUnit = {
      ...createDefaultGearUnit('striker', true),
      level: 1, // unlocked slots = 2 (default config)
      skillLevels: {
        str_passive_ordnance: 3,
      },
      equippedPassives: [], // learned, NOT equipped
    };
    expect(getGearPassiveBonuses(gear).skillDmgPct).toBe(0);

    // Equipping applies bonus
    const gearEquipped: GearUnit = {
      ...gear,
      equippedPassives: ['str_passive_ordnance'],
    };
    expect(getGearPassiveBonuses(gearEquipped).skillDmgPct).toBeCloseTo(0.15, 4);

    // Shrinking cap/unlocked slots ignores overflow passives without deleting from save
    const overflowGear: GearUnit = {
      ...gearEquipped,
      level: 1,
      equippedPassives: ['sge_passive_hull', 'str_passive_ordnance'], // invalid class + 2nd slot
    };
    expect(
      getGearPassiveBonuses(overflowGear, {
        passiveSlots: { initial: 1, everyLevels: 5, max: 12 },
      }).skillDmgPct
    ).toBe(0);
    expect(overflowGear.equippedPassives).toHaveLength(2);

    // Migration v13 -> v14 backfills learned passives into unlocked slots in catalog order
    const legacyPilot = createDefaultPilotAccount('Ace', 'striker');
    legacyPilot.gears.striker.level = 1;
    legacyPilot.gears.striker.skillLevels = {
      str_passive_ordnance: 2,
    };
    delete (legacyPilot.gears.striker as unknown as Record<string, unknown>)
      .equippedPassives;
    const migrated = migrateSaveData(
      {
        saveVersion: 13,
        pilot: legacyPilot,
      },
      13
    );
    expect(migrated.pilot.gears.striker.equippedPassives).toEqual([
      'str_passive_ordnance',
    ]);

    // NPC loadout equips passives up to unlocked slots and applies them in createInitialBattleState
    const admin = makeAdmin({
      passiveSlots: { initial: 2, everyLevels: 5, max: 12 },
    });
    const npcLoadout = buildNpcSkillLoadout('support', 12, admin);
    expect(npcLoadout.equippedPassives).toContain('sup_passive_capacitor');
    expect(
      getGearPassiveBonuses(
        {
          classId: 'support',
          level: 12,
          skillLevels: npcLoadout.skillLevels,
          equippedPassives: npcLoadout.equippedPassives,
        },
        admin
      ).spRegenPerTurn
    ).toBeGreaterThan(0);

    const npcBattle = createInitialBattleState(
      legacyPilot,
      SECTORS_CATALOG[0].id,
      () => 0.5,
      undefined,
      admin
    );
    const npcUnitsWithPassive = npcBattle.units.filter(
      (u) =>
        !u.isPlayer &&
        Object.keys(u.skillLevels).some(
          (id) => getSkillById(id)?.category === 'passive'
        )
    );
    expect(npcUnitsWithPassive.length).toBeGreaterThan(0);
    const supportNpc = npcBattle.units.find(
      (u) => !u.isPlayer && u.classId === 'support'
    );
    if (supportNpc) {
      expect(supportNpc.derived.spRegenPerTurn).toBeGreaterThan(0);
    }
  });

  it('5) real-number skill card summary renders stat + value + next level without % scale text', () => {
    const samples = [
      getSkillById('str_viper_sweep')!,
      getSkillById('sup_nanite_mend')!,
      getSkillById('str_passive_ordnance')!,
    ];
    for (const skill of samples) {
      const s = formatSkillRealSummary(skill, 3, 'vi', { skillMaxLevel: 5 });
      expect(s.primaryText).toMatch(/\d/);
      expect(s.nextLine).toContain('→ Lv.4:');
      expect(s.primaryText.toLowerCase()).not.toContain('hiệu quả %');
      expect(s.primaryText.toLowerCase()).not.toContain('hiệu lực:');
      expect(s.iconIds.length).toBeGreaterThan(0);
      for (const id of s.iconIds) {
        expect(getCatalogRow(id)).toBeDefined();
      }
    }
  });

  it('6) vi/en parity for all new S1b skill and admin strings', () => {
    const keys = [
      'skill.pageSubtitle',
      'skill.passivesTitle',
      'skill.passiveSlotsTitle',
      'skill.passiveSlotsHint',
      'skill.passiveSlotEmpty',
      'skill.passiveSlotLocked',
      'skill.passiveSlotActive',
      'skill.passiveUnequippedTag',
      'skill.passiveOverCapTag',
      'skill.passiveEquipBtn',
      'skill.passiveUnequipBtn',
      'skill.passiveEquippedBtn',
      'skill.passiveSlotsFull',
      'skill.passiveEquippedFeedback',
      'skill.passiveUnequippedFeedback',
      'skill.storedLevelNote',
      'skill.maxLevel',
      'admin.skillMaxLevel',
      'admin.passiveScaleAfter5',
      'admin.restorePctCap',
      'admin.passiveSlotsSection',
      'admin.passiveSlotsInitial',
      'admin.passiveSlotsEveryLevels',
      'admin.passiveSlotsMax',
      'admin.passiveSlotsPreview',
    ] as const;

    for (const key of keys) {
      expect(VI_TRANSLATIONS[key]).toBeTruthy();
      expect(EN_TRANSLATIONS[key]).toBeTruthy();
    }
  });
});
