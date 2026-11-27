import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCatalog } from '../../data/iconCatalog';
import {
  getEntryForEngineType,
  getStatusEntry,
  IMM_CONTROL_ID,
  isValidStatusIconId,
  STATUS_EFFECTS,
  validateStatusEntries,
} from '../../data/statusEffects';
import {
  ALL_ENGINE_STATUS_TYPES,
  formatStatusChipShortValue,
  getCatalogRowForActiveStatus,
} from '../../data/statusIconMap';
import { formatCombatLogMessage } from '../../i18n';
import type { ActiveStatusEffect, CombatUnit } from '../../types/game';
import {
  chooseAiDecision,
  createInitialBattleState,
  getEffectiveUnitSpeed,
  hasStatus,
  resolveMultiStepTurn,
  resolveUnitAction,
  sortTurnOrder,
} from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import { DEBUFF_TYPES } from '../prestage';
import { DEFAULT_SHIELD_REGEN_CONFIG } from '../shieldRegen';
import {
  applyStatus,
  applyStatusWithMeta,
  getStatusStatModifier,
} from '../statusEngine';

const FIXED_RNG_SEQ = [0.23, 0.71, 0.41, 0.89, 0.13, 0.57, 0.31, 0.67, 0.09, 0.83];

function createSeqRng(seq: readonly number[] = FIXED_RNG_SEQ): () => number {
  let idx = 0;
  return () => seq[idx++ % seq.length];
}

// Recorded BEFORE editing any engine/data code for TASK S1a:
const PRE_EDIT_4V4_SNAPSHOT = [
  {
    id: 'ally_player',
    side: 'ally',
    hp: 277,
    shield: 0,
    alive: true,
    statuses: [
      { type: 'primary_dmg_up', turnsRemaining: 1, magnitude: 0.3, isDebuff: false },
      { type: 'def_up', turnsRemaining: 1, magnitude: 0.25, isDebuff: false },
    ],
  },
  {
    id: 'ally_npc_1',
    side: 'ally',
    hp: 8,
    shield: 0,
    alive: true,
    statuses: [{ type: 'burn', turnsRemaining: 1, magnitude: undefined, isDebuff: true }],
  },
  { id: 'ally_npc_2', side: 'ally', hp: 301, shield: 200, alive: true, statuses: [] },
  { id: 'ally_npc_3', side: 'ally', hp: 232, shield: 175, alive: true, statuses: [] },
  { id: 'enemy_1', side: 'enemy', hp: 796, shield: 466, alive: true, statuses: [] },
  { id: 'enemy_2', side: 'enemy', hp: 310, shield: 146, alive: true, statuses: [] },
  {
    id: 'enemy_3',
    side: 'enemy',
    hp: 442,
    shield: 119,
    alive: true,
    statuses: [
      { type: 'skill_dmg_up', turnsRemaining: 2, magnitude: 0.33, isDebuff: false },
      { type: 'sure_hit', turnsRemaining: 3, magnitude: undefined, isDebuff: false },
      { type: 'primary_dmg_up', turnsRemaining: 3, magnitude: 0.33, isDebuff: false },
    ],
  },
  {
    id: 'enemy_4',
    side: 'enemy',
    hp: 651,
    shield: 369,
    alive: true,
    statuses: [{ type: 'def_up', turnsRemaining: 2, magnitude: 0.25, isDebuff: false }],
  },
];

describe('TASK S1a — Status effect registry, applyStatus, DoT, control immunity, 4v4 regression', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) coverage: every BF/DB/DT/CC row and engine StatusEffectType has a valid entry; DEBUFF_TYPES equals the 7 debuffs; bad rows are dropped', () => {
    const catalogStatusRows = getCatalog().filter((r) =>
      r.group === 'BF' || r.group === 'DB' || r.group === 'DT' || r.group === 'CC'
    );
    expect(catalogStatusRows).toHaveLength(51);

    for (const row of catalogStatusRows) {
      const entry = getStatusEntry(row.id);
      expect(entry, `Missing registry entry for ${row.id}`).toBeDefined();
      expect(isValidStatusIconId(entry!.iconId)).toBe(true);
    }

    const concreteEngineTypes = ALL_ENGINE_STATUS_TYPES.filter(
      (t) => t !== 'registry_effect'
    );
    expect(concreteEngineTypes).toHaveLength(22);
    for (const stType of concreteEngineTypes) {
      const entry = getEntryForEngineType(stType);
      expect(entry, `Missing entry for engine type ${stType}`).toBeDefined();
      expect(isValidStatusIconId(entry!.iconId)).toBe(true);
      expect(entry!.stackRule).toBe('refresh');
    }

    // BF02 derives all three damage buff engineTypes automatically
    expect(getStatusEntry('BF02')?.engineTypes).toEqual(
      expect.arrayContaining(['atk_up', 'primary_dmg_up', 'skill_dmg_up'])
    );
    expect(getStatusEntry(IMM_CONTROL_ID)?.polarity).toBe('neutral');

    // DEBUFF_TYPES stays the exact 7 legacy debuff types
    expect([...DEBUFF_TYPES].sort()).toEqual(
      [
        'burn',
        'def_down',
        'shield_break',
        'shield_cracked',
        'silence',
        'slow',
        'vulnerable',
      ].sort()
    );

    // validateStatusEntries drops malformed rows with console.warn and never throws
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const valid = validateStatusEntries([
      STATUS_EFFECTS[0],
      { ...STATUS_EFFECTS[1], id: 'BAD_ICON', iconId: 'NO_SUCH_ICON' },
      { ...STATUS_EFFECTS[1], id: 'BAD_STACKS', maxStacks: 0 },
      { ...STATUS_EFFECTS[1], id: 'BAD_NAN', defaultValue: Number.NaN },
    ]);
    expect(valid.map((v) => v.id)).toEqual([STATUS_EFFECTS[0].id]);
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it('2) applyStatus handles refresh same source, add up to maxStacks, highest, net of opposite stats, and chip xN lookup', () => {
    const bf01 = getStatusEntry('BF01')!; // add, maxStacks 3, flat attack
    const bf05 = getStatusEntry('BF05')!; // highest, critChance
    const bf17 = getStatusEntry('BF17')!; // add, speed buff +20%
    const cc06 = getStatusEntry('CC06')!; // add, speed debuff -20%

    // Same source -> refresh duration and value, no extra stack
    let list: ActiveStatusEffect[] = [];
    list = applyStatus(list, bf01, { sourceId: 'caster_a', value: 15, turns: 1 });
    list = applyStatus(list, bf01, { sourceId: 'caster_a', value: 25, turns: 3 });
    expect(list).toHaveLength(1);
    expect(list[0].stacks).toBe(1);
    expect(list[0].magnitude).toBe(25);
    expect(list[0].turnsRemaining).toBe(3);

    // Other sources -> add up to maxStacks (3)
    list = applyStatus(list, bf01, { sourceId: 'caster_b', value: 25, turns: 2 });
    list = applyStatus(list, bf01, { sourceId: 'caster_c', value: 25, turns: 2 });
    list = applyStatus(list, bf01, { sourceId: 'caster_d', value: 25, turns: 2 });
    expect(list[0].stacks).toBe(3);

    // Chip lookup reads registryId first and shows xN through short-value formatter
    expect(getCatalogRowForActiveStatus(list[0])?.id).toBe('BF01');
    expect(formatStatusChipShortValue('en', list[0])).toContain('x3');

    // Highest keeps the larger value across sources
    let hi: ActiveStatusEffect[] = [];
    hi = applyStatus(hi, bf05, { sourceId: 'caster_a', value: 0.25, turns: 2 });
    hi = applyStatus(hi, bf05, { sourceId: 'caster_b', value: 0.15, turns: 3 });
    expect(hi[0].magnitude).toBe(0.25);
    hi = applyStatus(hi, bf05, { sourceId: 'caster_c', value: 0.4, turns: 2 });
    expect(hi[0].magnitude).toBe(0.4);

    // Opposite registry effects on speed both apply -> net modifier + effective speed
    let speedList: ActiveStatusEffect[] = [];
    speedList = applyStatus(speedList, bf17, { sourceId: 'ally_1', value: 0.3, turns: 2 });
    speedList = applyStatus(speedList, cc06, { sourceId: 'enemy_1', value: 0.1, turns: 2 });
    const fakeUnit = {
      derived: { speed: 100 },
      statuses: speedList,
    } as unknown as CombatUnit;
    const mod = getStatusStatModifier(fakeUnit, 'speed');
    expect(mod.flat).toBe(0);
    expect(mod.pct).toBeCloseTo(0.2, 6);
    expect(getEffectiveUnitSpeed(fakeUnit)).toBe(120);
  });

  it('3) registry DoT ticks once per own turn, skips skipTurnStartTicks, respects ignoresShield, and expires', () => {
    const rng = createSeqRng();
    vi.spyOn(Math, 'random').mockImplementation(rng);
    const campaign = createFreshCampaignState('Vance', 'striker');
    const baseAdmin = createDefaultAdminConfig();
    const adminConfig = {
      ...baseAdmin,
      shieldRegen: { ...DEFAULT_SHIELD_REGEN_CONFIG, enabled: false },
      prestage: { enabled: false, countdownSec: 3 },
    };
    const battle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      rng,
      undefined,
      adminConfig
    );
    const actorIdx = battle.units.findIndex((u) => u.isPlayer);
    const enemyTargetId = battle.units.find((u) => u.side === 'enemy' && u.alive)!.id;

    // DT02 Poison: ignoresShield = true, 5% maxHp, 2 turns (value * stacks)
    // DT03 Corrosion: ignoresShield = false, 6% maxHp, 1 turn
    const dt02 = getStatusEntry('DT02')!;
    const dt03 = getStatusEntry('DT03')!;
    let statuses = applyStatus([], dt02, {
      sourceId: 'e1',
      value: 0.05,
      turns: 2,
      stacks: 2,
    });
    statuses = applyStatus(statuses, dt03, {
      sourceId: 'e2',
      value: 0.06,
      turns: 1,
    });

    const baseActor: CombatUnit = {
      ...battle.units[actorIdx],
      derived: { ...battle.units[actorIdx].derived, maxHp: 1000, maxShield: 300 },
      hp: 1000,
      shield: 300,
      statuses,
    };
    let units = battle.units.map((u, i) => (i === actorIdx ? baseActor : u));

    // Turn 1 (skipTurnStartTicks = false): DT02 deals 100 direct HP (ignores shield); DT03 deals 60 to shield
    const step1 = resolveUnitAction(
      units,
      baseActor.id,
      'attack',
      enemyTargetId,
      1,
      adminConfig,
      rng,
      undefined,
      undefined,
      { skipTurnStartTicks: false }
    );
    units = step1.updatedUnits;
    const after1 = units[actorIdx];
    expect(after1.hp).toBe(900);
    expect(after1.shield).toBe(240);
    expect(hasStatus(after1, 'DT02')).toBe(true); // 2 -> 1
    expect(hasStatus(after1, 'DT03')).toBe(false); // 1 -> 0 expired
    expect(
      step1.logEntries.some(
        (l) =>
          l.templateKey === 'log.registryDotTick' &&
          formatCombatLogMessage('en', l).includes('Poison')
      )
    ).toBe(true);

    // Same-turn step 2 (skipTurnStartTicks = true): MUST NOT tick DoT again or decrement duration
    const step2 = resolveUnitAction(
      units,
      baseActor.id,
      'attack',
      enemyTargetId,
      1,
      adminConfig,
      rng,
      undefined,
      undefined,
      { skipTurnStartTicks: true }
    );
    units = step2.updatedUnits;
    const after2 = units[actorIdx];
    expect(after2.hp).toBe(900);
    expect(after2.shield).toBe(240);
    expect(hasStatus(after2, 'DT02')).toBe(true);

    // Turn 2 (skipTurnStartTicks = false): DT02 ticks final time (-100 HP) and expires
    const step3 = resolveUnitAction(
      units,
      baseActor.id,
      'attack',
      enemyTargetId,
      2,
      adminConfig,
      rng,
      undefined,
      undefined,
      { skipTurnStartTicks: false }
    );
    const after3 = step3.updatedUnits[actorIdx];
    expect(after3.hp).toBe(800);
    expect(after3.shield).toBe(240);
    expect(hasStatus(after3, 'DT02')).toBe(false);
  });

  it('4) control immunity triggers when registry control expires, resists next control with log, and expires after 1 own turn', () => {
    const rng = createSeqRng();
    vi.spyOn(Math, 'random').mockImplementation(rng);
    const campaign = createFreshCampaignState('Vance', 'striker');
    const adminConfig = {
      ...createDefaultAdminConfig(),
      prestage: { enabled: false, countdownSec: 3 },
    };
    const battle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      rng,
      undefined,
      adminConfig
    );
    const actorIdx = battle.units.findIndex((u) => u.isPlayer);
    const cc02 = getStatusEntry('CC02')!; // Stun (controlType: 'stun')
    const cc01 = getStatusEntry('CC01')!; // EMP Shock (controlType: 'emp')

    const stunnedActor: CombatUnit = {
      ...battle.units[actorIdx],
      statuses: applyStatus([], cc02, { sourceId: 'e1', turns: 1 }),
    };
    let units = battle.units.map((u, i) => (i === actorIdx ? stunnedActor : u));

    // Own turn 1: CC02 expires by duration -> unit receives IMM_CONTROL (1 own turn)
    const turn1 = resolveUnitAction(
      units,
      stunnedActor.id,
      'defend',
      null,
      1,
      adminConfig,
      rng
    );
    units = turn1.updatedUnits;
    const afterTurn1 = units[actorIdx];
    expect(hasStatus(afterTurn1, 'CC02')).toBe(false);
    expect(hasStatus(afterTurn1, IMM_CONTROL_ID)).toBe(true);

    // Attempt to apply another registry control during immunity -> resisted + localized log
    const resisted = applyStatusWithMeta(afterTurn1.statuses, cc01, {
      sourceId: 'e2',
      turns: 1,
      logContext: {
        round: 1,
        targetName: afterTurn1.name,
        targetSide: afterTurn1.side,
      },
    });
    expect(resisted.applied).toBe(false);
    expect(resisted.resisted).toBe(true);
    expect(resisted.statuses.some((s) => s.registryId === 'CC01')).toBe(false);
    expect(resisted.logEntry).toBeDefined();
    expect(formatCombatLogMessage('vi', resisted.logEntry!)).toBe(
      `Kháng: ${cc01.nameVi}`
    );
    expect(formatCombatLogMessage('en', resisted.logEntry!)).toBe(
      `Resisted: ${cc01.nameEn}`
    );

    // Own turn 2: IMM_CONTROL expires after 1 own turn; subsequent control applies normally
    const turn2 = resolveUnitAction(
      units,
      stunnedActor.id,
      'defend',
      null,
      2,
      adminConfig,
      rng
    );
    const afterTurn2 = turn2.updatedUnits[actorIdx];
    expect(hasStatus(afterTurn2, IMM_CONTROL_ID)).toBe(false);
    const appliedAfter = applyStatusWithMeta(afterTurn2.statuses, cc01, {
      sourceId: 'e2',
      turns: 1,
    });
    expect(appliedAfter.applied).toBe(true);
    expect(appliedAfter.resisted).toBe(false);
  });

  it('5) regression: fixed-sequence 4v4 battle with prestage + NPC buff caster matches pre-edit HP/shield/status snapshot', () => {
    const rng = createSeqRng();
    vi.spyOn(Math, 'random').mockImplementation(rng);

    const campaign = createFreshCampaignState('Vance', 'striker');
    const adminConfig = {
      ...createDefaultAdminConfig(),
      prestage: { enabled: true, countdownSec: 3 },
    };
    const battle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      rng,
      undefined,
      adminConfig
    );
    expect(Object.keys(battle.prestage?.appliedByUnit ?? {}).length).toBe(2);

    let units = battle.units.map((u) => {
      if (u.side === 'enemy' && u.classId === 'support') {
        return {
          ...u,
          equippedSkillIds: ['sup_aegis_field', 'gen_hull_brace'],
          skillLevels: { sup_aegis_field: 1, gen_hull_brace: 1 },
          sp: 100,
        };
      }
      return u;
    });
    if (
      !units.some(
        (u) => u.side === 'enemy' && u.equippedSkillIds.includes('sup_aegis_field')
      )
    ) {
      const eIdx = units.findIndex((u) => u.side === 'enemy');
      units[eIdx] = {
        ...units[eIdx],
        classId: 'support',
        equippedSkillIds: ['sup_aegis_field', 'gen_hull_brace'],
        skillLevels: { sup_aegis_field: 1, gen_hull_brace: 1 },
        sp: 100,
      };
    }

    let round = 1;
    let turnOrder = sortTurnOrder(units);
    let cursor = 0;
    let npcBuffSteps = 0;
    for (let step = 0; step < 16; step++) {
      while (
        cursor < turnOrder.length &&
        !units.find((u) => u.id === turnOrder[cursor] && u.alive)
      ) {
        cursor++;
      }
      if (cursor >= turnOrder.length) {
        round++;
        turnOrder = sortTurnOrder(units);
        cursor = 0;
      }
      const actorId = turnOrder[cursor++];
      const actor = units.find((u) => u.id === actorId);
      if (!actor || !actor.alive) break;
      const aliveAllies = units.filter((u) => u.side === 'ally' && u.alive).length;
      const aliveEnemies = units.filter((u) => u.side === 'enemy' && u.alive).length;
      if (aliveAllies === 0 || aliveEnemies === 0) break;

      const res = resolveMultiStepTurn({
        units,
        actorId,
        round,
        adminConfig,
        rng,
        chooseNextDecision: (curUnits, curActor, locked, _stepIdx, step2Used) =>
          chooseAiDecision(curActor, curUnits, rng, adminConfig, locked, step2Used),
      });
      units = res.updatedUnits;
      if (actor.side === 'enemy' && res.step2SkillIds.length > 0) {
        npcBuffSteps += res.step2SkillIds.length;
      }
    }

    expect(npcBuffSteps).toBe(3);

    const snapshot = units.map((u) => ({
      id: u.id,
      side: u.side,
      hp: u.hp,
      shield: u.shield,
      alive: u.alive,
      statuses: u.statuses.map((s) => ({
        type: s.type,
        turnsRemaining: s.turnsRemaining,
        magnitude: s.magnitude,
        isDebuff: s.isDebuff,
      })),
    }));

    expect(snapshot).toEqual(PRE_EDIT_4V4_SNAPSHOT);
  });
});
