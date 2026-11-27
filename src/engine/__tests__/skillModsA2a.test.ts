// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BattleUnitCard } from '../../components/BattleUnitCard';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import rawSkillsJson from '../../data/skills.json';
import { useGameStore } from '../../store/useGameStore';
import {
  BUILTIN_SKILL_REGISTRY_TAG,
  EFFECT_KIND_VALIDATORS,
  MAX_SKILL_MODS,
  MOD_EFFECT_KINDS,
  SKILLS_CATALOG,
  SKILLS_LIST,
  getScaledSkillStats,
  getSkillById,
  sanitizeSkillMods,
  validateSkillDefinitions,
} from '../../data/skills';
import { getSkillDesc, getSkillName } from '../../i18n';
import type {
  AdminConfig,
  CombatUnit,
  FloatingPopup,
  SkillModDefinition,
} from '../../types/game';
import {
  CARD_POPUP_INSET_PX,
  estimatePopupBoxSize,
  pickCardPopupEndPoint,
} from '../../utils/cardPopupQueue';
import { createInitialBattleState, resolveUnitAction } from '../combat';
import {
  CURRENT_SAVE_VERSION,
  createDefaultAdminConfig,
  migrateSaveData,
} from '../migration';
import {
  buildExportEnvelope,
  canonicalJsonStringify,
  decryptEnvelope,
  parseImportEnvelope,
} from '../saveExport';
import {
  canUnitUseSkill,
  getGearPassiveBonuses,
  getSkillsForClass,
  learnOrUpgradeSkillOnGear,
  validateEquipPassiveSkill,
  validateEquipSkillOnBar,
  validateLearnOrUpgradeSkill,
} from '../skills';
import { createDefaultPilotAccount } from '../stats';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeHealingMod(overrides: Partial<SkillModDefinition> = {}): SkillModDefinition {
  return {
    id: 'mod_nano_patch',
    classScope: 'general',
    category: 'normal',
    icon: 'heart',
    iconId: 'BF09',
    nameVi: 'Vá Nano Tùy Chỉnh',
    nameEn: 'Custom Nano Patch',
    descVi: 'Hồi giáp đồng đội theo công thức mod.',
    descEn: 'Restores ally armor using mod formula.',
    unlockLevel: 1,
    spCost: 8,
    cooldown: 0,
    targetType: 'single_ally',
    effectKind: 'heal_single',
    buffMagnitude: 0.35,
    registryTag: 'mod',
    ...overrides,
  };
}

function makePassiveMod(overrides: Partial<SkillModDefinition> = {}): SkillModDefinition {
  return {
    id: 'mod_overclock_core',
    classScope: 'general',
    category: 'passive',
    icon: 'zap',
    iconId: 'BF02',
    nameVi: 'Lõi Ép Xung Mod',
    nameEn: 'Mod Overclock Core',
    descVi: 'Tăng sát thương kỹ năng.',
    descEn: 'Boosts skill damage.',
    unlockLevel: 1,
    spCost: 0,
    cooldown: 0,
    targetType: 'self',
    effectKind: 'passive_skill_dmg',
    buffMagnitude: 0.08,
    registryTag: 'mod',
    ...overrides,
  };
}

function makePopupUnit(): CombatUnit {
  return {
    id: 'e1',
    name: 'Scout',
    callsign: 'E1',
    side: 'enemy',
    row: 'front',
    formationCol: 0,
    isPlayer: false,
    classId: 'striker',
    isBoss: false,
    level: 10,
    skillLevel: 1,
    skillLevels: { gen_hull_brace: 1 },
    equippedSkillIds: ['gen_hull_brace'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 600,
      maxShield: 200,
      maxSp: 100,
      speed: 100,
      attackPower: 80,
      defenseRating: 50,
      dodgeChance: 10,
      critChance: 15,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    alive: true,
    hp: 600,
    shield: 200,
    sp: 50,
    isDefending: false,
    statuses: [],
    animState: 'idle',
  };
}

describe('TASK A2a: skills.json + Admin skillMods engine + ITEM Z popups', () => {
  const roots: Root[] = [];
  const initialModEffectKinds = [...MOD_EFFECT_KINDS];
  const initialValidators = { ...EFFECT_KIND_VALIDATORS };

  afterEach(() => {
    while (roots.length > 0) {
      const r = roots.pop()!;
      act(() => r.unmount());
    }
    MOD_EFFECT_KINDS.splice(0, MOD_EFFECT_KINDS.length, ...initialModEffectKinds);
    for (const k of Object.keys(EFFECT_KIND_VALIDATORS) as Array<keyof typeof EFFECT_KIND_VALIDATORS>) {
      delete EFFECT_KIND_VALIDATORS[k];
    }
    Object.assign(EFFECT_KIND_VALIDATORS, initialValidators);
    vi.restoreAllMocks();
  });

  it('1) skills.json schema & snapshot equality + same-seed determinism when skillMods = []', () => {
    expect(CURRENT_SAVE_VERSION).toBe(14);
    expect(Object.keys(EFFECT_KIND_VALIDATORS)).toEqual(['passive_stat', 'spec']);
    expect(MOD_EFFECT_KINDS).toEqual(['passive_stat', 'spec']);

    expect(rawSkillsJson.schemaVersion).toBe(1);
    expect(rawSkillsJson.skills).toHaveLength(52);
    expect(SKILLS_LIST).toHaveLength(52);
    for (const skill of SKILLS_LIST) {
      expect(skill.registryTag).toBe(BUILTIN_SKILL_REGISTRY_TAG);
      expect(SKILLS_CATALOG[skill.id]).toEqual(skill);
    }

    // Exact byte-equal canonical parity between JSON source rows and validated SKILLS_LIST
    const normalizedJson = rawSkillsJson.skills.map((row) => ({
      ...row,
      registryTag: 'sys',
    }));
    expect(canonicalJsonStringify(SKILLS_LIST)).toBe(
      canonicalJsonStringify(normalizedJson)
    );

    // Same-seed battle is identical with default vs empty skillMods
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    const bDefault = createInitialBattleState(pilot, 'border_outpost', createMulberry32(777), 4);
    const bEmptyMods = createInitialBattleState(
      pilot,
      'border_outpost',
      createMulberry32(777),
      4,
      { ...createDefaultAdminConfig(), skillMods: [] }
    );
    expect(canonicalJsonStringify(bEmptyMods.units)).toBe(canonicalJsonStringify(bDefault.units));
    expect(bEmptyMods.turnOrder).toEqual(bDefault.turnOrder);
    expect(bEmptyMods.round).toBe(bDefault.round);
    expect(bEmptyMods.log.map((l) => l.templateKey)).toEqual(
      bDefault.log.map((l) => l.templateKey)
    );
  });

  it('2) validateSkillDefinitions + EFFECT_KIND_VALIDATORS drop invalid rows with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    EFFECT_KIND_VALIDATORS.heal_single = (row) =>
      typeof row.buffMagnitude === 'number' && row.buffMagnitude > 0
        ? []
        : ['buffMagnitude_required'];

    const sampleValid = { ...SKILLS_CATALOG.sup_nanite_mend, id: 'valid_copy' };
    const missingField = { id: 'bad_missing', classScope: 'general' };
    const badEnum = { ...sampleValid, id: 'bad_enum', category: 'mythic' };
    const dupId = { ...sampleValid, id: 'valid_copy' };
    const failedHook = {
      ...sampleValid,
      id: 'bad_hook',
      buffMagnitude: -1,
    };

    const result = validateSkillDefinitions({
      schemaVersion: 1,
      skills: [sampleValid, missingField, badEnum, dupId, failedHook],
    });

    expect(result.map((s) => s.id)).toEqual(['valid_copy']);
    expect(result[0]?.registryTag).toBe('sys');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0] ?? '')).toContain('bad_missing');
  });

  it('3) MOD_EFFECT_KINDS extended to heal_single merges mod, resolves inline names, casts in seeded battle, and drops unlisted kinds', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    MOD_EFFECT_KINDS.push('heal_single');

    const healMod = makeHealingMod();
    const unlistedMod = makeHealingMod({
      id: 'mod_unlisted_atk',
      effectKind: 'splash_attack',
      targetType: 'single_enemy',
    });

    const sanitized = sanitizeSkillMods([healMod, unlistedMod]);
    expect(sanitized.map((m) => m.id)).toEqual(['mod_nano_patch']);
    expect(warnSpy).toHaveBeenCalled();

    const admin: AdminConfig = {
      ...createDefaultAdminConfig(),
      skillMods: sanitized,
    };

    const merged = getSkillById('mod_nano_patch', admin);
    expect(merged?.registryTag).toBe('mod');
    expect(getSkillsForClass('striker', admin).some((s) => s.id === 'mod_nano_patch')).toBe(true);
    expect(getSkillName(merged!, 'vi')).toBe('Vá Nano Tùy Chỉnh');
    expect(getSkillName(merged!, 'en')).toBe('Custom Nano Patch');
    expect(getSkillDesc(merged!, 'vi')).toBe('Hồi giáp đồng đội theo công thức mod.');
    expect(getSkillDesc(merged!, 'en')).toBe('Restores ally armor using mod formula.');

    // Teach & equip mod onto player pilot and cast in seeded battle
    let pilot = createDefaultPilotAccount('Medic', 'striker');
    pilot.credits = 50_000;
    const learned = learnOrUpgradeSkillOnGear(pilot, 'striker', 'mod_nano_patch', admin);
    expect(learned.validation.ok).toBe(true);
    pilot = learned.pilot;
    expect(pilot.gears.striker.equippedSkillBar).toContain('mod_nano_patch');

    const battle = createInitialBattleState(pilot, 'border_outpost', createMulberry32(42), 4, admin);
    const player = battle.units.find((u) => u.isPlayer)!;
    const woundedAlly = battle.units.find((u) => u.side === 'ally' && !u.isPlayer)!;
    woundedAlly.hp = Math.max(1, Math.floor(woundedAlly.derived.maxHp * 0.4));
    player.sp = 50;

    expect(canUnitUseSkill(player, 'mod_nano_patch', admin).canUse).toBe(true);
    const hpBefore = woundedAlly.hp;
    const res = resolveUnitAction(
      battle.units,
      player.id,
      'skill',
      woundedAlly.id,
      1,
      admin,
      createMulberry32(43),
      'mod_nano_patch'
    );
    const healedAlly = res.updatedUnits.find((u) => u.id === woundedAlly.id)!;
    expect(healedAlly.hp).toBeGreaterThan(hpBefore);
    expect(res.logEntries.some((l) => l.templateKey === 'log.healSingle')).toBe(true);
  });

  it('4) disabled or missing mod keeps learned level in gear.skillLevels, grants no effect, and is ignored in equippedPassives', () => {
    MOD_EFFECT_KINDS.push('passive_skill_dmg');

    const activeMod = makePassiveMod({ id: 'mod_passive_alpha', buffMagnitude: 0.1 });
    const adminEnabled: AdminConfig = {
      ...createDefaultAdminConfig(),
      skillMods: sanitizeSkillMods([activeMod]),
    };

    let pilot = createDefaultPilotAccount('Ace', 'support');
    pilot.credits = 50_000;
    pilot.gears.support.level = 1; // 2 initial passive slots
    const learned = learnOrUpgradeSkillOnGear(pilot, 'support', 'mod_passive_alpha', adminEnabled);
    expect(learned.validation.ok).toBe(true);
    pilot = learned.pilot;
    expect(pilot.gears.support.skillLevels.mod_passive_alpha).toBe(1);
    expect(pilot.gears.support.equippedPassives).toContain('mod_passive_alpha');
    expect(getGearPassiveBonuses(pilot.gears.support, adminEnabled).skillDmgPct).toBeCloseTo(0.1, 4);

    // Disable the mod and run migration
    const adminDisabled: AdminConfig = {
      ...adminEnabled,
      skillMods: [{ ...activeMod, disabled: true }],
    };
    const migrated = migrateSaveData(
      { saveVersion: CURRENT_SAVE_VERSION, pilot, adminConfig: adminDisabled },
      CURRENT_SAVE_VERSION
    );
    const gear = migrated.pilot.gears.support;
    expect(gear.skillLevels.mod_passive_alpha).toBe(1);
    expect(getSkillById('mod_passive_alpha', adminDisabled)).toBeUndefined();
    expect(validateLearnOrUpgradeSkill(migrated.pilot, 'support', 'mod_passive_alpha', adminDisabled).ok).toBe(false);
    expect(validateEquipSkillOnBar(gear, 'mod_passive_alpha', adminDisabled).ok).toBe(false);
    expect(validateEquipPassiveSkill(gear, 'mod_passive_alpha', adminDisabled).ok).toBe(false);
    expect(getGearPassiveBonuses(gear, adminDisabled).skillDmgPct).toBe(0);

    // Disabled mod passive is ignored in equippedPassives so remaining unlocked slots are still usable
    gear.skillLevels.sup_passive_capacitor = 1;
    gear.equippedPassives = ['mod_passive_alpha', 'sup_passive_capacitor'];
    const bonuses = getGearPassiveBonuses(gear, adminDisabled);
    const capLv1 =
      getScaledSkillStats(SKILLS_CATALOG.sup_passive_capacitor, 1, adminDisabled)
        .passiveStats?.[0]?.value ?? 0;
    expect(bonuses.spRegenPerTurn).toBe(capLv1);
    expect(bonuses.skillDmgPct).toBe(0);

    // Re-enabling restores effect without losing learned level
    const reenabledBonuses = getGearPassiveBonuses(gear, adminEnabled);
    expect(reenabledBonuses.skillDmgPct).toBeCloseTo(0.1, 4);
    expect(reenabledBonuses.spRegenPerTurn).toBe(capLv1);
  });

  it('5) sys id wins clash, sanitizeSkillMods clamps fields & max 100, and SV1a export/import preserves skillMods', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    MOD_EFFECT_KINDS.push('heal_single');

    // Attempt to override a system skill id or bypass regex
    const clashMod = makeHealingMod({ id: 'sup_nanite_mend' as string });
    const rawMods = [
      clashMod,
      makeHealingMod({
        id: 'mod_clamped_test',
        unlockLevel: 999,
        spCost: -20,
        cooldown: 55,
      }),
      ...Array.from({ length: 110 }, (_, idx) =>
        makeHealingMod({ id: `mod_bulk_${idx}` })
      ),
    ];

    const sanitized = sanitizeSkillMods(rawMods);
    expect(sanitized.some((m) => m.id === 'sup_nanite_mend')).toBe(false);
    expect(sanitized.length).toBe(MAX_SKILL_MODS);

    const clamped = sanitized.find((m) => m.id === 'mod_clamped_test')!;
    expect(clamped.unlockLevel).toBe(100);
    expect(clamped.spCost).toBe(0);
    expect(clamped.cooldown).toBe(10);

    // Sys always wins even if an unsanitized mod with a sys ID is injected manually
    const sysWinner = getSkillById('sup_nanite_mend', [clashMod]);
    expect(sysWinner?.registryTag).toBe('sys');

    // SV1a Export / Import roundtrip preserves adminConfig.skillMods
    const pilot = createDefaultPilotAccount('Exporter', 'support');
    const adminConfig: AdminConfig = {
      ...createDefaultAdminConfig(),
      skillMods: [clamped],
    };
    const envelope = await buildExportEnvelope(
      { saveVersion: CURRENT_SAVE_VERSION, pilot, adminConfig },
      '1234'
    );
    const parsed = await parseImportEnvelope(JSON.stringify(envelope));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const decrypted = await decryptEnvelope(parsed.envelope, '1234');
    expect(decrypted.ok).toBe(true);
    if (!decrypted.ok) return;

    const restored = migrateSaveData(decrypted.state, CURRENT_SAVE_VERSION);
    expect(restored.adminConfig.skillMods).toHaveLength(1);
    expect(restored.adminConfig.skillMods?.[0]).toEqual(clamped);
  });

  it('6) card popup end box stays inside 280px card and centered in 160px card with no truncate class on popup', () => {
    const cases: Array<Pick<FloatingPopup, 'tone' | 'text'>> = [
      { tone: 'buff', text: 'EVADE!' },
      { tone: 'crit', text: 'CRIT SHD -242' },
      { tone: 'damage', text: 'SPLASH -1234' },
    ];

    for (const c of cases) {
      const box = estimatePopupBoxSize(c);
      const halfW = box.width / 2;

      // 280px desktop card: whole scaled box stays inside inset bounds
      const end280 = pickCardPopupEndPoint(
        { widthPct: 85, heightPct: 65 },
        280,
        140,
        [],
        box,
        () => 0.99
      );
      expect(end280.x - halfW).toBeGreaterThanOrEqual(CARD_POPUP_INSET_PX - 0.01);
      expect(end280.x + halfW).toBeLessThanOrEqual(280 - CARD_POPUP_INSET_PX + 0.01);

      // 160px narrow card: wider popups stay centered instead of clipping edge
      const end160 = pickCardPopupEndPoint(
        { widthPct: 85, heightPct: 65 },
        160,
        120,
        [],
        box,
        () => 0.05
      );
      if (box.width + CARD_POPUP_INSET_PX * 2 > 160) {
        expect(end160.x).toBe(80);
        expect(end160.offsetFromCenterX).toBe(0);
      } else {
        expect(end160.x - halfW).toBeGreaterThanOrEqual(CARD_POPUP_INSET_PX - 0.01);
        expect(end160.x + halfW).toBeLessThanOrEqual(160 - CARD_POPUP_INSET_PX + 0.01);
      }
    }

    // Verify BattleUnitCard renders popups with whitespace-nowrap & overflow-visible (no truncate)
    const prevAdmin = useGameStore.getState().adminConfig;
    useGameStore.setState({
      adminConfig: {
        ...prevAdmin,
        cardPopupStaggerMs: 0,
        cardPopupMaxConcurrent: 8,
      },
    });
    try {
      const unit = makePopupUnit();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      roots.push(root);

      const popups: FloatingPopup[] = [
        { id: 'p_crit', unitId: 'e1', text: 'CRIT SHD -242', tone: 'crit' },
        { id: 'p_splash', unitId: 'e1', text: 'SPLASH -1234', tone: 'damage' },
      ];

      act(() => {
        root.render(
          createElement(BattleUnitCard, {
            unit,
            isActiveTurn: false,
            isTargeted: false,
            canTarget: false,
            exploding: false,
            skipAnimations: false,
            popups,
            onSelect: vi.fn(),
            onInspect: vi.fn(),
          })
        );
      });

      const renderedPopups = Array.from(
        container.querySelectorAll('[data-testid="damage-popup"]')
      );
      expect(renderedPopups.length).toBe(2);
      for (const el of renderedPopups) {
        expect(el.className).not.toContain('truncate');
        expect(el.className).toContain('whitespace-nowrap');
        expect(el.className).toContain('overflow-visible');
      }
      container.remove();
    } finally {
      useGameStore.setState({ adminConfig: prevAdmin });
    }
  });
});
