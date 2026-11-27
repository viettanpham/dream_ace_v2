import { describe, expect, it, vi } from 'vitest';
import { SUPPLY_TEMPLATES } from '../../data/consumables';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import { DEFAULT_NPC_SUPPLY_CONFIG, runNpcSupplyStep } from '../npcSupply';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'enemy_1',
    name: 'Hostile',
    callsign: 'H-1',
    side: 'enemy',
    row: 'front',
    isPlayer: false,
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
      maxShield: 0,
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
    shield: 0,
    sp: 50,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(units: CombatUnit[], overrides: Partial<BattleState> = {}): BattleState {
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
    npcSupply: {
      stockByUnit: {},
      sectorSupply: 100,
      emergencyUsed: { ally: false, enemy: false },
    },
    ...overrides,
  };
}

describe('TASK CS6b — NPC Battle Supply Usage & Emergency Resupply', () => {
  it('1) enemy under HP threshold uses a kit and still acts in the same turn (store performAiTurn)', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker', makeSeededRng(11));
    const baseAdmin = campaign.adminConfig ?? createDefaultAdminConfig();
    const adminConfig = {
      ...baseAdmin,
      prestage: {
        ...(baseAdmin.prestage ?? { enabled: false, countdownSec: 0 }),
        enabled: false,
      },
      npcSupply: {
        ...DEFAULT_NPC_SUPPLY_CONFIG,
        enabled: true,
      },
    };

    const rawBattle = createInitialBattleState(
      campaign.pilot,
      'border_outpost',
      makeSeededRng(11),
      4,
      adminConfig,
      'assault'
    );
    const enemy = rawBattle.units.find((u) => u.side === 'enemy' && u.alive)!;
    const enemyIdx = rawBattle.turnOrder.indexOf(enemy.id);
    const damagedEnemy: CombatUnit = {
      ...enemy,
      hp: Math.max(1, Math.floor(enemy.derived.maxHp * 0.2)),
    };
    const seededBattle: BattleState = {
      ...rawBattle,
      activeTurnIndex: enemyIdx,
      units: rawBattle.units.map((u) => (u.id === enemy.id ? damagedEnemy : u)),
      npcSupply: {
        stockByUnit: {
          ...(rawBattle.npcSupply?.stockByUnit ?? {}),
          [enemy.id]: { sup_hp_t2: 2 },
        },
        sectorSupply: 100,
        emergencyUsed: { ally: false, enemy: false },
      },
    };

    useGameStore.setState({
      pilot: campaign.pilot,
      adminConfig,
      battle: seededBattle,
      skipAnimations: false,
      battleSpeed: 10,
    });

    const hpBefore = damagedEnemy.hp;
    useGameStore.getState().performAiTurn();

    const after = useGameStore.getState().battle!;
    const enemyAfter = after.units.find((u) => u.id === enemy.id)!;
    expect(enemyAfter.hp).toBeGreaterThan(hpBefore);
    expect(after.npcSupply?.stockByUnit[enemy.id]?.sup_hp_t2).toBe(1);
    expect(after.turnCounter).toBe(seededBattle.turnCounter + 1);
    expect(after.log.some((l) => l.templateKey === 'log.useSupply' && l.actorName === enemy.name)).toBe(true);
    // Still executed combat action in the same turn (extra log entry beyond supply)
    expect(after.log.filter((l) => l.templateKey !== 'log.useSupply').length).toBeGreaterThan(0);
    expect(after.popups.length).toBeGreaterThan(0);
    expect(after.fxEvents.length).toBeGreaterThan(0);
  });

  it('2) losing side uses supply earlier than winning side at the same HP (pressure shift)', () => {
    const enemySameHp = makeUnit({ id: 'enemy_1', side: 'enemy', hp: 480 });
    const allyStrong = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true, hp: 1000 });
    const allyWeak = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true, hp: 100 });
    const adminConfig = createDefaultAdminConfig();

    const losingBattle = makeBattle([enemySameHp, allyStrong], {
      npcSupply: {
        stockByUnit: { enemy_1: { sup_hp_t1: 2 } },
        sectorSupply: 100,
        emergencyUsed: { ally: false, enemy: false },
      },
    });
    const winningBattle = makeBattle([enemySameHp, allyWeak], {
      npcSupply: {
        stockByUnit: { enemy_1: { sup_hp_t1: 2 } },
        sectorSupply: 100,
        emergencyUsed: { ally: false, enemy: false },
      },
    });

    const losingStep = runNpcSupplyStep({
      battle: losingBattle,
      unitId: 'enemy_1',
      adminConfig,
      templates: SUPPLY_TEMPLATES,
    });
    const winningStep = runNpcSupplyStep({
      battle: winningBattle,
      unitId: 'enemy_1',
      adminConfig,
      templates: SUPPLY_TEMPLATES,
    });

    // At 48% HP: losing (+15 -> 55%) uses kit; winning (-10 -> 30%) saves kit
    expect(losingStep.battle.npcSupply?.stockByUnit.enemy_1?.sup_hp_t1).toBe(1);
    expect(losingStep.battle.units.find((u) => u.id === 'enemy_1')!.hp).toBeGreaterThan(480);
    expect(winningStep.battle.npcSupply?.stockByUnit.enemy_1?.sup_hp_t1).toBe(2);
    expect(winningStep.battle.units.find((u) => u.id === 'enemy_1')!.hp).toBe(480);
  });

  it('3) NPC with no stock does nothing', () => {
    const enemy = makeUnit({ id: 'enemy_1', side: 'enemy', hp: 150 });
    const ally = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true, hp: 500 });
    const adminConfig = createDefaultAdminConfig();
    const battle = makeBattle([enemy, ally], {
      round: 1,
      npcSupply: {
        stockByUnit: {},
        sectorSupply: 100,
        emergencyUsed: { ally: false, enemy: false },
      },
    });

    const res = runNpcSupplyStep({
      battle,
      unitId: 'enemy_1',
      adminConfig,
      templates: SUPPLY_TEMPLATES,
    });

    expect(res.events).toEqual([]);
    expect(res.battle.units.find((u) => u.id === 'enemy_1')!.hp).toBe(150);
    expect(res.battle.log).toHaveLength(0);
    expect(res.battle.npcSupply?.stockByUnit.enemy_1).toBeUndefined();
  });

  it('4) emergency resupply triggers once per side at round>=3 & pressure<=-gap, and not when sectorSupply < 50', () => {
    const adminConfig = {
      ...createDefaultAdminConfig(),
      supplyMaxPerTypePerBattle: 10,
    };
    const enemy1 = makeUnit({ id: 'enemy_1', side: 'enemy', hp: 100 });
    const enemy2 = makeUnit({ id: 'enemy_2', side: 'enemy', hp: 900, level: 10 });
    const ally = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true, hp: 1000 });

    const lowSectorBattle = makeBattle([enemy1, enemy2, ally], {
      round: 3,
      npcSupply: {
        stockByUnit: { enemy_1: { sup_hp_t3: 1 } },
        sectorSupply: 49,
        emergencyUsed: { ally: false, enemy: false },
      },
    });
    const lowSectorRes = runNpcSupplyStep({
      battle: lowSectorBattle,
      unitId: 'enemy_1',
      adminConfig,
      templates: SUPPLY_TEMPLATES,
    });
    expect(lowSectorRes.battle.npcSupply?.emergencyUsed.enemy).toBe(false);
    expect(
      lowSectorRes.battle.log.some((l) => l.templateKey === 'log.emergencyResupplyEnemy')
    ).toBe(false);

    // Now sectorSupply = 50 -> triggers emergency resupply!
    // enemy_1 gets +1 to sup_hp_t3 (then immediately uses 1 because hp 100 < 55%),
    // enemy_2 (empty stock) gets 1x hp_kit of its tier (sup_hp_t2 at lv10).
    const okSectorBattle = makeBattle([enemy1, enemy2, ally], {
      round: 3,
      npcSupply: {
        stockByUnit: { enemy_1: { sup_hp_t3: 1, sup_hp_t1: 2 } },
        sectorSupply: 50,
        emergencyUsed: { ally: false, enemy: false },
      },
    });
    const firstTrigger = runNpcSupplyStep({
      battle: okSectorBattle,
      unitId: 'enemy_1',
      adminConfig,
      templates: SUPPLY_TEMPLATES,
    });
    expect(firstTrigger.battle.npcSupply?.emergencyUsed.enemy).toBe(true);
    expect(firstTrigger.battle.npcSupply?.emergencyUsed.ally).toBe(false);
    expect(
      firstTrigger.battle.log.filter((l) => l.templateKey === 'log.emergencyResupplyEnemy')
    ).toHaveLength(1);
    // enemy_1 received +1 on highest tier (sup_hp_t3: 1+1=2) then used 1 -> 1 remaining
    expect(firstTrigger.battle.npcSupply?.stockByUnit.enemy_1?.sup_hp_t3).toBe(1);
    // enemy_2 was empty -> got +1 hp_kit of its tier (Lv10 Standard: tier 2 - 1 = sup_hp_t1)
    expect(firstTrigger.battle.npcSupply?.stockByUnit.enemy_2?.sup_hp_t1).toBe(1);

    // Calling again on round 4 must NOT trigger emergency resupply a second time for enemy
    const secondCall = runNpcSupplyStep({
      battle: { ...firstTrigger.battle, round: 4 },
      unitId: 'enemy_2',
      adminConfig,
      templates: SUPPLY_TEMPLATES,
    });
    expect(
      secondCall.battle.log.filter((l) => l.templateKey === 'log.emergencyResupplyEnemy')
    ).toHaveLength(1);
  });

  it('5) npcSupply disabled or missing produces no NPC supply use and zero rng draws', () => {
    const enemy = makeUnit({ id: 'enemy_1', side: 'enemy', hp: 100 });
    const ally = makeUnit({ id: 'ally_1', side: 'ally', isPlayer: true, hp: 1000 });
    const rngSpy = vi.fn(() => 0.5);

    const disabledCfg = {
      ...createDefaultAdminConfig(),
      npcSupply: { ...DEFAULT_NPC_SUPPLY_CONFIG, enabled: false },
    };
    const battleWithStock = makeBattle([enemy, ally], {
      round: 4,
      npcSupply: {
        stockByUnit: { enemy_1: { sup_hp_t2: 3 } },
        sectorSupply: 100,
        emergencyUsed: { ally: false, enemy: false },
      },
    });
    const disabledRes = runNpcSupplyStep({
      battle: battleWithStock,
      unitId: 'enemy_1',
      adminConfig: disabledCfg,
      templates: SUPPLY_TEMPLATES,
      rng: rngSpy,
    });
    expect(disabledRes.battle).toBe(battleWithStock);
    expect(disabledRes.events).toEqual([]);
    expect(rngSpy).not.toHaveBeenCalled();

    const missingBattle = makeBattle([enemy, ally], { npcSupply: undefined });
    const missingRes = runNpcSupplyStep({
      battle: missingBattle,
      unitId: 'enemy_1',
      adminConfig: createDefaultAdminConfig(),
      templates: SUPPLY_TEMPLATES,
      rng: rngSpy,
    });
    expect(missingRes.battle).toBe(missingBattle);
    expect(missingRes.events).toEqual([]);
    expect(rngSpy).not.toHaveBeenCalled();
  });
});
