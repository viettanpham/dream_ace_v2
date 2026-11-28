import { describe, expect, it, vi } from 'vitest';
import { pickVoiceLine } from '../../data/voiceLines';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit, VoiceTrigger } from '../../types/game';
import { parseStructuredCombatLogRow } from '../../utils/combatLogFormat';
import { createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import {
  createInitialBattleVoiceState,
  emitVoice,
  recordVoiceUnitAction,
} from '../voice';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

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

function makeBattle(units: CombatUnit[], seed = 4242): BattleState {
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
    selectedTargetId: units.find((u) => u.side === 'enemy')?.id ?? null,
    selectedAllyTargetId: units.find((u) => u.side === 'ally')?.id ?? null,
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
    voice: createInitialBattleVoiceState(seed, true),
  };
}

describe('TASK CHAT-1a — NPC voice lines', () => {
  it('1) pickVoiceLine returns null for missing trigger/side and returns line when present', () => {
    expect(
      pickVoiceLine('nonexistent' as unknown as VoiceTrigger, 'enemy', 0.2)
    ).toBeNull();
    expect(pickVoiceLine('startTaunt', 'ally', 0.5)).toBeNull();
    expect(pickVoiceLine('startTaunt', 'player', 0.5)).toBeNull();
    expect(pickVoiceLine('startTaunt', 'enemy', 0.1)).toBe(
      'Hôm nay các ngươi không ra khỏi đây đâu!'
    );
    expect(pickVoiceLine('kill', 'player', 0.99)).toBe('Gọn gàng.');
  });

  it('2) unit cannot speak twice within 3 of its own actions', () => {
    const unit = makeUnit({ id: 'player_1', name: 'Kael', side: 'ally', isPlayer: true });
    const enemy = makeUnit({ id: 'enemy_1', name: 'Raider', side: 'enemy', isPlayer: false });
    let battle = makeBattle([unit, enemy], 1337);

    // Force deterministic 100%-passing chance using 'win'-free test: emit 'win' is outcome,
    // so emit until first line (using find seed or lowHp/kill/win? Let's test via multi-round or direct seed where kill/lowHp rolls < 60).
    // Seed 7 produces roll < 0.6 on counter 1; verify at least one speech occurs first:
    let spokeAtRound = 0;
    for (let s = 1; s <= 30; s++) {
      const candidate = emitVoice(makeBattle([unit, enemy], s), 'kill', unit);
      if (candidate.log.length === 1) {
        battle = candidate;
        spokeAtRound = 1;
        break;
      }
    }
    expect(spokeAtRound).toBe(1);
    expect(battle.log.length).toBe(1);

    // Move to new rounds while recording 0, 1, 2 actions: unit must still be blocked
    battle = { ...battle, round: 2 };
    expect(emitVoice(battle, 'evade', unit).log.length).toBe(1);

    battle = recordVoiceUnitAction(battle, unit.id); // action 1
    expect(emitVoice(battle, 'crit', unit).log.length).toBe(1);

    battle = recordVoiceUnitAction(battle, unit.id); // action 2
    expect(emitVoice(battle, 'kill', unit).log.length).toBe(1);

    // On action 3, cooldown (3) has elapsed; speaking is permitted again when chance passes
    battle = recordVoiceUnitAction(battle, unit.id); // action 3
    let spokeAgain = false;
    for (let r = 3; r <= 35; r++) {
      const nextTry = emitVoice({ ...battle, round: r }, 'lowHp', unit);
      if (nextTry.log.length > 1) {
        spokeAgain = true;
        break;
      }
    }
    expect(spokeAgain).toBe(true);
  });

  it('3) lowHp speaks at most once per unit per battle', () => {
    const unit = makeUnit({ id: 'player_1', name: 'Kael', side: 'ally', isPlayer: true, hp: 150 });
    let battle = makeBattle([unit], 1);

    // Find a seed where lowHp triggers on the first attempt
    for (let s = 1; s <= 30; s++) {
      const candidate = emitVoice(makeBattle([unit], s), 'lowHp', unit);
      if (candidate.log.length === 1) {
        battle = candidate;
        break;
      }
    }
    expect(battle.log.length).toBe(1);
    expect(battle.voice?.lowHpSpokenUnitIds).toContain(unit.id);

    // Advance well past cooldown and maxPerRound across rounds; lowHp must never fire again
    for (let a = 0; a < 5; a++) {
      battle = recordVoiceUnitAction(battle, unit.id);
    }
    for (let r = 2; r <= 25; r++) {
      battle = emitVoice({ ...battle, round: r }, 'lowHp', unit);
    }
    expect(battle.log.filter((l) => l.params.trigger === 'lowHp')).toHaveLength(1);
  });

  it('4) same battle seed produces identical battle result with voice on and off', () => {
    const runBattle = (voiceEnabled: boolean) => {
      const campaign = createFreshCampaignState('Pilot', 'striker', makeSeededRng(77));
      const baseAdmin = campaign.adminConfig ?? createDefaultAdminConfig();
      const adminConfig = {
        ...baseAdmin,
        prestage: {
          ...(baseAdmin.prestage ?? { enabled: false, countdownSec: 0 }),
          enabled: false,
        },
        voice: {
          ...(baseAdmin.voice ?? {}),
          enabled: voiceEnabled,
        },
      };
      const rng = makeSeededRng(77);
      const mathSpy = vi.spyOn(Math, 'random').mockImplementation(rng);
      try {
        const initial = createInitialBattleState(
          campaign.pilot,
          'border_outpost',
          rng,
          4,
          adminConfig,
          'assault'
        );
        useGameStore.setState({
          pilot: campaign.pilot,
          adminConfig,
          battle: initial,
          autoBattleEnabled: true,
          skipAnimations: true,
          battleSpeed: 10,
        });

        let steps = 0;
        while (!useGameStore.getState().battle?.summary && steps < 80) {
          const cur = useGameStore.getState().battle!;
          const activeId = cur.turnOrder[cur.activeTurnIndex];
          const active = cur.units.find((u) => u.id === activeId);
          if (active?.isPlayer) {
            useGameStore.getState().performAutoPlayerTurn();
          } else {
            useGameStore.getState().performAiTurn();
          }
          steps++;
        }
        return useGameStore.getState().battle!;
      } finally {
        mathSpy.mockRestore();
      }
    };

    const withVoice = runBattle(true);
    const withoutVoice = runBattle(false);

    expect(withVoice.summary).not.toBeNull();
    expect(withoutVoice.summary).not.toBeNull();
    expect(withVoice.summary?.outcome).toBe(withoutVoice.summary?.outcome);
    expect(withVoice.summary?.rounds).toBe(withoutVoice.summary?.rounds);
    expect(withVoice.summary?.enemiesDestroyed).toBe(withoutVoice.summary?.enemiesDestroyed);
    expect(withVoice.summary?.alliesSurviving).toBe(withoutVoice.summary?.alliesSurviving);
    expect(withVoice.summary?.expGained).toBe(withoutVoice.summary?.expGained);
    expect(withVoice.round).toBe(withoutVoice.round);
    expect(withVoice.turnCounter).toBe(withoutVoice.turnCounter);
    expect(withVoice.units.map((u) => ({ id: u.id, hp: u.hp, shield: u.shield, sp: u.sp, alive: u.alive }))).toEqual(
      withoutVoice.units.map((u) => ({ id: u.id, hp: u.hp, shield: u.shield, sp: u.sp, alive: u.alive }))
    );
    expect(withVoice.events.map((e) => ({ type: e.type, actorId: e.actorId, targetId: e.targetId, amount: e.amount }))).toEqual(
      withoutVoice.events.map((e) => ({ type: e.type, actorId: e.actorId, targetId: e.targetId, amount: e.amount }))
    );

    const voiceEntries = withVoice.log.filter((l) => l.tag === 'VOICE');
    expect(withoutVoice.log.some((l) => l.tag === 'VOICE')).toBe(false);
    expect(voiceEntries.length).toBeGreaterThanOrEqual(2); // win + lose guaranteed at 100%

    const formatted = formatCombatLogMessage('vi', voiceEntries[0]);
    expect(formatted).toBe(`${voiceEntries[0].actorName}: "${voiceEntries[0].params.line}"`);
    const parsed = parseStructuredCombatLogRow('vi', voiceEntries[0], withVoice.units);
    expect(parsed.actionKind).toBe('voice');
    expect(parsed.sentence).toBe(formatted);
  });
});
