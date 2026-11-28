import { describe, expect, it } from 'vitest';
import { VOICE_DEFAULTS } from '../../data/balance';
import type { BattleState, CombatLogEntry, CombatUnit } from '../../types/game';
import { filterCombatLogEntries } from '../../utils/combatLogFormat';
import {
  createInitialBattleVoiceState,
  emitVoice,
  sanitizeVoiceConfig,
} from '../voice';

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally_1',
    name: 'Vanguard',
    callsign: 'A-1',
    side: 'ally',
    row: 'front',
    isPlayer: true,
    classId: 'striker',
    archetype: 'gunship',
    isBoss: false,
    isStructure: false,
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: {
      attack: 25,
      defense: 15,
      fuel: 15,
      spirit: 15,
      shield: 15,
      evasion: 5,
    },
    derived: {
      maxHp: 1000,
      maxShield: 200,
      maxSp: 100,
      speed: 35,
      attackPower: 25,
      defenseRating: 15,
      skillPower: 20,
      critChance: 10,
      dodgeChance: 5,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 1000,
    shield: 200,
    sp: 50,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(units: CombatUnit[], voiceConfig?: Record<string, unknown>): BattleState {
  return {
    sectorId: 'border_outpost',
    kind: 'patrol',
    squadSize: 4,
    sourceId: null,
    deployedGearId: 'striker',
    round: 1,
    turnCounter: 0,
    turnOrder: units.map((u) => u.id),
    activeTurnIndex: 0,
    units,
    selectedTargetId: null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
    autoStopNotice: null,
    log: [],
    events: [],
    roundSnapshots: [],
    popups: [],
    fxEvents: [],
    explodedUnitIds: [],
    wingmanChat: null,
    summary: null,
    isResolving: false,
    turnStep2Used: 0,
    turnLockedSkillIds: [],
    voice: createInitialBattleVoiceState(101, voiceConfig as never),
  };
}

describe('TASK CHAT-1b — Voice Admin config & log channel', () => {
  it('1) sanitizeVoiceConfig clamps fields, ignores unknown keys, and falls back to VOICE_DEFAULTS', () => {
    const sanitized = sanitizeVoiceConfig({
      enabled: false,
      actionCooldown: 99,
      maxPerRound: -4,
      unknownTopKey: 'ignore-me',
      chances: {
        kill: 150,
        crit: -10,
        win: 42.6,
        bogusTrigger: 99,
      } as never,
    } as never);

    expect(sanitized.enabled).toBe(false);
    expect(sanitized.actionCooldown).toBe(10);
    expect(sanitized.maxPerRound).toBe(0);
    expect(sanitized.chances.kill).toBe(100);
    expect(sanitized.chances.crit).toBe(0);
    expect(sanitized.chances.win).toBe(43);
    expect(sanitized.chances.evade).toBe(VOICE_DEFAULTS.chances.evade);
    expect('unknownTopKey' in sanitized).toBe(false);
    expect('bogusTrigger' in sanitized.chances).toBe(false);
  });

  it('2) chance 0 for a trigger prevents emitVoice from speaking that trigger', () => {
    const unit = makeUnit({ id: 'player_1', name: 'Kael', side: 'ally', isPlayer: true });
    let battle = makeBattle([unit], {
      enabled: true,
      actionCooldown: 0,
      maxPerRound: 6,
      chances: {
        ...VOICE_DEFAULTS.chances,
        win: 0,
        kill: 0,
        lowHp: 0,
      },
    });

    battle = emitVoice(battle, 'win', unit);
    battle = emitVoice(battle, 'kill', unit);
    battle = emitVoice(battle, 'lowHp', unit);
    expect(battle.log).toHaveLength(0);

    // Other triggers with non-zero chance still work (lose = 100%)
    battle = emitVoice(battle, 'lose', unit);
    expect(battle.log).toHaveLength(1);
    expect(battle.log[0].params.trigger).toBe('lose');
  });

  it('3) enabled=false in state.voice.config emits no voice logs', () => {
    const unit = makeUnit({ id: 'player_1', name: 'Kael', side: 'ally', isPlayer: true });
    const enemy = makeUnit({ id: 'enemy_1', name: 'Raider', side: 'enemy', isPlayer: false });
    let battle = makeBattle([unit, enemy], {
      enabled: false,
      actionCooldown: 0,
      maxPerRound: 6,
      chances: {
        ...VOICE_DEFAULTS.chances,
        startTaunt: 100,
        win: 100,
        lose: 100,
      },
    });

    battle = emitVoice(battle, 'startTaunt', enemy);
    battle = emitVoice(battle, 'win', unit);
    battle = emitVoice(battle, 'lose', enemy);
    expect(battle.log).toHaveLength(0);
  });

  it('4) filterCombatLogEntries voice channel returns only voice entries and ally/enemy/system exclude them', () => {
    const entries: CombatLogEntry[] = [
      {
        id: 'sys_1',
        round: 1,
        actorName: 'SYSTEM',
        tag: 'SYSTEM',
        templateKey: 'log.battleStart',
        params: { sectorId: 'border_outpost', difficulty: 'Standard' },
      },
      {
        id: 'ally_1',
        round: 1,
        actorName: 'Kael',
        actorSide: 'ally',
        actorIsPlayer: true,
        tag: 'ATTACK',
        templateKey: 'log.damage',
        params: { actor: 'Kael', target: 'Raider', damage: 50 },
      },
      {
        id: 'enemy_1',
        round: 1,
        actorName: 'Raider',
        actorSide: 'enemy',
        tag: 'SKILL',
        templateKey: 'log.damage',
        params: { actor: 'Raider', target: 'Kael', damage: 40 },
      },
      {
        id: 'voice_ally',
        round: 1,
        actorName: 'Kael',
        actorSide: 'ally',
        actorIsPlayer: true,
        tag: 'VOICE',
        category: 'voice',
        templateKey: 'log.voice',
        params: { actor: 'Kael', line: 'Khai hỏa!', trigger: 'skillAttack' },
      },
      {
        id: 'voice_enemy',
        round: 1,
        actorName: 'Raider',
        actorSide: 'enemy',
        tag: 'VOICE',
        category: 'voice',
        templateKey: 'log.voice',
        params: { actor: 'Raider', line: 'Chết đi!', trigger: 'skillAttack' },
      },
    ];

    expect(filterCombatLogEntries(entries, 'all').map((e) => e.id)).toEqual([
      'sys_1',
      'ally_1',
      'enemy_1',
      'voice_ally',
      'voice_enemy',
    ]);
    expect(filterCombatLogEntries(entries, 'voice').map((e) => e.id)).toEqual([
      'voice_ally',
      'voice_enemy',
    ]);
    expect(filterCombatLogEntries(entries, 'ally').map((e) => e.id)).toEqual([
      'ally_1',
    ]);
    expect(filterCombatLogEntries(entries, 'enemy').map((e) => e.id)).toEqual([
      'enemy_1',
    ]);
    expect(filterCombatLogEntries(entries, 'system').map((e) => e.id)).toEqual([
      'sys_1',
    ]);
  });
});
