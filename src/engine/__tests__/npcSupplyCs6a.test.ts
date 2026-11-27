import { describe, expect, it } from 'vitest';
import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../../data/consumables';
import type { CombatUnit } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import {
  DEFAULT_NPC_SUPPLY_CONFIG,
  DEFAULT_SUPPLY_MAX_PER_TYPE_PER_BATTLE,
  generateNpcSupplies,
  sanitizeNpcSupplyConfig,
  sanitizeSupplyMaxPerTypePerBattle,
} from '../npcSupply';
import { canUseSupply } from '../supplies';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeTestUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
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
    level: 20,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: {
      attack: 25,
      defense: 20,
      fuel: 15,
      spirit: 15,
      shield: 20,
      evasion: 10,
    },
    derived: {
      maxHp: 500,
      maxShield: 250,
      maxSp: 100,
      speed: 35,
      attackPower: 25,
      defenseRating: 20,
      skillPower: 20,
      critChance: 10,
      dodgeChance: 10,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 200,
    shield: 100,
    sp: 50,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('TASK CS6a — NPC Battle Supplies Config, Cap & Generator', () => {
  it('1) sanitizer returns exact defaults and clamps qtyMax (30 ok, 31 -> 30) & cap', () => {
    const def = sanitizeNpcSupplyConfig();
    expect(def).toEqual(DEFAULT_NPC_SUPPLY_CONFIG);
    expect(def.enabled).toBe(true);
    expect(def.qtyMax).toBe(4);
    expect(DEFAULT_SUPPLY_MAX_PER_TYPE_PER_BATTLE).toBe(10);

    expect(sanitizeNpcSupplyConfig({ qtyMax: 30 }).qtyMax).toBe(30);
    expect(sanitizeNpcSupplyConfig({ qtyMax: 31 }).qtyMax).toBe(30);
    expect(sanitizeNpcSupplyConfig({ qtyMin: 8, qtyMax: 2 }).qtyMax).toBe(8);
    expect(sanitizeSupplyMaxPerTypePerBattle(undefined)).toBe(10);
    expect(sanitizeSupplyMaxPerTypePerBattle(0)).toBe(1);
    expect(sanitizeSupplyMaxPerTypePerBattle(35)).toBe(30);
  });

  it('2) generated stock per type respects supplyMaxPerTypePerBattle and canUseSupply with battleLimitOverride 10 allows 6th use', () => {
    const highUnits: CombatUnit[] = [
      makeTestUnit({ id: 'enemy_boss', isBoss: true, level: 25 }),
      makeTestUnit({ id: 'enemy_mob', archetype: 'gunship', level: 20 }),
    ];
    const generated = generateNpcSupplies(highUnits, {
      kind: 'assault',
      difficulty: 'Elite',
      cfg: { qtyMin: 15, qtyMax: 15, noSupplyChance: { mob: 0, boss: 0 } },
      supplyMaxPerTypePerBattle: 10,
      templates: SUPPLY_TEMPLATES,
      rng: makeSeededRng(7),
      sectorSupply: 100,
    })!;

    for (const unitStock of Object.values(generated.stockByUnit)) {
      for (const qty of Object.values(unitStock)) {
        expect(qty).toBeLessThanOrEqual(10);
        expect(qty).toBeGreaterThan(0);
      }
    }

    const hpKit = getSupplyTemplateById('sup_hp_t3')!;
    const unit = makeTestUnit({ id: 'enemy_mob', hp: 100 });
    const stateAt5 = {
      usedCountsByTemplate: { [hpKit.id]: 5 },
      cooldownsByTemplate: {},
      usedThisTurn: 0,
    };

    const blockedWithoutOverride = canUseSupply({
      template: hpKit,
      stock: 5,
      unit,
      supplyState: stateAt5,
      isOwnTurn: true,
      kind: 'patrol',
      units: [unit],
    });
    expect(blockedWithoutOverride.ok).toBe(false);
    expect(blockedWithoutOverride.reason).toBe('battle_limit');

    const allowedWithOverride = canUseSupply({
      template: hpKit,
      stock: 5,
      unit,
      supplyState: stateAt5,
      isOwnTurn: true,
      kind: 'patrol',
      units: [unit],
      battleLimitOverride: 10,
    });
    expect(allowedWithOverride.ok).toBe(true);
  });

  it('3) sectorSupply 0 gives less total stock and more empty units than sectorSupply 100 (seeded)', () => {
    const mobs = Array.from({ length: 12 }, (_, idx) =>
      makeTestUnit({
        id: `enemy_mob_${idx + 1}`,
        archetype: 'gunship',
        level: 20,
      })
    );

    const stock100 = generateNpcSupplies(mobs, {
      kind: 'assault',
      difficulty: 'Hard',
      templates: SUPPLY_TEMPLATES,
      rng: makeSeededRng(101),
      sectorSupply: 100,
    })!;
    const stock0 = generateNpcSupplies(mobs, {
      kind: 'assault',
      difficulty: 'Hard',
      templates: SUPPLY_TEMPLATES,
      rng: makeSeededRng(101),
      sectorSupply: 0,
    })!;

    const sumStock = (s: typeof stock100) =>
      Object.values(s.stockByUnit).reduce(
        (acc, map) => acc + Object.values(map).reduce((a, b) => a + b, 0),
        0
      );
    const emptyCount = (s: typeof stock100) =>
      mobs.filter((u) => Object.keys(s.stockByUnit[u.id] ?? {}).length === 0)
        .length;

    expect(stock100.sectorSupply).toBe(100);
    expect(stock0.sectorSupply).toBe(0);
    expect(sumStock(stock0)).toBeLessThan(sumStock(stock100));
    expect(emptyCount(stock0)).toBeGreaterThan(emptyCount(stock100));
  });

  it('4) boss is never empty with higher tier than same-level mob, drone max 1 type, player/structures get nothing, no scan device', () => {
    const units: CombatUnit[] = [
      makeTestUnit({ id: 'ally_player', side: 'ally', isPlayer: true, level: 20 }),
      makeTestUnit({ id: 'enemy_turret', isStructure: true, isBoss: false, level: 20 }),
      makeTestUnit({ id: 'enemy_drone', archetype: 'drone', level: 20 }),
      makeTestUnit({ id: 'enemy_mob', archetype: 'gunship', level: 20 }),
      makeTestUnit({ id: 'enemy_boss', archetype: 'gunship', isBoss: true, isStructure: true, level: 20 }),
    ];

    const res = generateNpcSupplies(units, {
      kind: 'assault',
      difficulty: 'Hard',
      cfg: { noSupplyChance: { mob: 0, boss: 0 } },
      templates: SUPPLY_TEMPLATES,
      rng: makeSeededRng(55),
      sectorSupply: 100,
    })!;

    // Player & non-boss structures get nothing
    expect(res.stockByUnit['ally_player']).toBeUndefined();
    expect(res.stockByUnit['enemy_turret']).toBeUndefined();

    // Drone max 1 type
    expect(Object.keys(res.stockByUnit['enemy_drone'] ?? {}).length).toBeLessThanOrEqual(1);

    // Boss never empty even under extreme scarcity & high mob empty chance
    const scarceRes = generateNpcSupplies(units, {
      kind: 'assault',
      difficulty: 'Hard',
      cfg: { noSupplyChance: { mob: 1, boss: 0 } },
      templates: SUPPLY_TEMPLATES,
      rng: makeSeededRng(55),
      sectorSupply: 0,
    })!;
    expect(Object.keys(scarceRes.stockByUnit['enemy_boss'] ?? {}).length).toBe(3);

    // Boss gets every kit family (3) & higher tier than same-level mob (Lv20 Hard: mob tier 3, boss tier 4)
    const bossEntries = Object.keys(res.stockByUnit['enemy_boss'] ?? {});
    expect(bossEntries.length).toBe(3);
    const bossMaxTier = Math.max(
      ...bossEntries.map((id) => getSupplyTemplateById(id)!.tier)
    );
    const mobEntries = Object.keys(res.stockByUnit['enemy_mob'] ?? {});
    expect(mobEntries.length).toBeGreaterThan(0);
    const mobMaxTier = Math.max(
      ...mobEntries.map((id) => getSupplyTemplateById(id)!.tier)
    );
    expect(bossMaxTier).toBeGreaterThan(mobMaxTier);

    // No NPC ever receives the scan device
    for (const unitStock of Object.values(res.stockByUnit)) {
      expect(unitStock['sup_scan_t1']).toBeUndefined();
    }
  });

  it('5) npcSupply enabled=false leaves rng untouched and createInitialBattleState identical with fixed seed', () => {
    const campaign = createFreshCampaignState('Pilot', 'striker', makeSeededRng(9));
    const baseAdmin = createDefaultAdminConfig();
    const disabledAdmin = {
      ...baseAdmin,
      npcSupply: { ...baseAdmin.npcSupply, enabled: false },
    };

    const rngA = makeSeededRng(2026);
    const rngB = makeSeededRng(2026);

    const battleA = createInitialBattleState(
      campaign.pilot,
      'debris_belt',
      rngA,
      4,
      disabledAdmin,
      'assault'
    );
    const battleB = createInitialBattleState(
      campaign.pilot,
      'debris_belt',
      rngB,
      4,
      disabledAdmin,
      'assault'
    );

    expect(battleA.npcSupply).toBeUndefined();
    expect(battleB.npcSupply).toBeUndefined();
    expect(battleA.units).toEqual(battleB.units);
    expect(battleA.turnOrder).toEqual(battleB.turnOrder);
    expect(rngA()).toBe(rngB());

    // Verify a battle with enabled=true consumes rng while disabled does not
    const rngDisabled = makeSeededRng(777);
    const rngEnabled = makeSeededRng(777);
    createInitialBattleState(campaign.pilot, 'debris_belt', rngDisabled, 4, disabledAdmin);
    const enabledBattle = createInitialBattleState(campaign.pilot, 'debris_belt', rngEnabled, 4, baseAdmin);
    expect(enabledBattle.npcSupply).toBeDefined();
    expect(rngDisabled()).not.toBe(rngEnabled());
  });
});
