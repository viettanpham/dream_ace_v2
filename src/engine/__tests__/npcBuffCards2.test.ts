import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { formatCombatLogMessage } from '../../i18n';
import {
  DEFAULT_NPC_BUFF_CARDS_CONFIG,
  rollNpcBuffCards,
  sanitizeNpcBuffCardsConfig,
} from '../buffCards';
import { buildCombatUnit, createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('BUFFCARD-2 — NPC battle buff cards', () => {
  it('1) level below minLevel returns no cards', () => {
    const admin = createDefaultAdminConfig();
    admin.npcBuffCards = {
      ...DEFAULT_NPC_BUFF_CARDS_CONFIG,
      enabled: true,
      allyChancePct: 100,
      enemyChancePct: 100,
      minLevel: 10,
    };
    const rng = makeSeededRng(42);
    expect(rollNpcBuffCards(rng, 'enemy', 9, false, false, admin)).toEqual({});
    expect(rollNpcBuffCards(rng, 'ally', 1, false, false, admin)).toEqual({});
  });

  it('2) disabled returns no cards even with 100% chance', () => {
    const admin = createDefaultAdminConfig();
    admin.npcBuffCards = {
      ...DEFAULT_NPC_BUFF_CARDS_CONFIG,
      enabled: false,
      allyChancePct: 100,
      enemyChancePct: 100,
      minLevel: 1,
    };
    const rng = makeSeededRng(99);
    expect(rollNpcBuffCards(rng, 'enemy', 25, true, false, admin)).toEqual({});
    expect(rollNpcBuffCards(rng, 'ally', 25, false, false, admin)).toEqual({});
  });

  it('3) deterministic roll respects tierCap, boss +1 tier / x2 chance, structure gate, and never returns exp', () => {
    const admin = createDefaultAdminConfig();
    admin.npcBuffCards = sanitizeNpcBuffCardsConfig({
      enabled: true,
      allyChancePct: 100,
      enemyChancePct: 100,
      minLevel: 10,
      maxTier: 3,
      levelPerTier: 10,
      maxKindsPerUnit: 2,
      includeBoss: true,
      includeStructure: false,
    });

    // At Lv25: tierCap = min(3, 1 + floor((25-10)/10)) = 2
    for (let seed = 1; seed <= 25; seed++) {
      const normalRoll = rollNpcBuffCards(
        makeSeededRng(seed),
        'enemy',
        25,
        false,
        false,
        admin
      );
      const repeatRoll = rollNpcBuffCards(
        makeSeededRng(seed),
        'enemy',
        25,
        false,
        false,
        admin
      );
      expect(normalRoll).toEqual(repeatRoll);
      expect('exp' in normalRoll).toBe(false);
      const entries = Object.entries(normalRoll);
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries.length).toBeLessThanOrEqual(2);
      for (const [, entry] of entries) {
        expect(entry?.battles).toBe(1);
        expect(entry?.tier).toBeGreaterThanOrEqual(1);
        expect(entry?.tier).toBeLessThanOrEqual(2);
      }
    }

    // Non-boss structure is excluded when includeStructure=false; boss (with isStructure=true as in combat.ts) gets +1 tierCap
    expect(
      rollNpcBuffCards(makeSeededRng(7), 'enemy', 25, false, true, admin)
    ).toEqual({});
    const bossRoll = rollNpcBuffCards(
      makeSeededRng(7),
      'enemy',
      40,
      true,
      true,
      admin
    );
    expect(Object.keys(bossRoll).length).toBeGreaterThanOrEqual(1);
    for (const [, entry] of Object.entries(bossRoll)) {
      expect(entry?.tier).toBeLessThanOrEqual(4); // maxTier 3 + boss bonus 1 = 4
    }
  });

  it('4) buildCombatUnit applies npcBuffs attack T2, player without npcBuffs is unchanged, and start battle logs NPC cards', () => {
    const admin = createDefaultAdminConfig();
    const baseUnit = buildCombatUnit({
      id: 'enemy_1',
      name: 'Vanguard Hostile',
      callsign: 'H-1',
      side: 'enemy',
      row: 'front',
      isPlayer: false,
      classId: 'striker',
      level: 20,
      allocatedPoints: EMPTY_STAT_BLOCK,
      adminConfig: admin,
    });
    const buffedUnit = buildCombatUnit({
      id: 'enemy_1',
      name: 'Vanguard Hostile',
      callsign: 'H-1',
      side: 'enemy',
      row: 'front',
      isPlayer: false,
      classId: 'striker',
      level: 20,
      allocatedPoints: EMPTY_STAT_BLOCK,
      npcBuffs: { attack: { tier: 2, battles: 1 }, max_hp: { tier: 2, battles: 1 } },
      adminConfig: admin,
    });
    expect(buffedUnit.derived.attackPower).toBeGreaterThan(baseUnit.derived.attackPower);
    expect(buffedUnit.hp).toBe(buffedUnit.derived.maxHp);
    expect(buffedUnit.hp).toBeGreaterThan(baseUnit.hp);

    const playerNoBuff = buildCombatUnit({
      id: 'player_1',
      name: 'Ace',
      callsign: 'A-1',
      side: 'ally',
      row: 'front',
      isPlayer: true,
      classId: 'striker',
      level: 20,
      allocatedPoints: EMPTY_STAT_BLOCK,
      npcBuffs: { attack: { tier: 3, battles: 1 } },
      adminConfig: admin,
    });
    const playerBase = buildCombatUnit({
      id: 'player_1',
      name: 'Ace',
      callsign: 'A-1',
      side: 'ally',
      row: 'front',
      isPlayer: true,
      classId: 'striker',
      level: 20,
      allocatedPoints: EMPTY_STAT_BLOCK,
      adminConfig: admin,
    });
    expect(playerNoBuff.derived.attackPower).toBe(playerBase.derived.attackPower);

    // Full battle creation emits SYSTEM logs for NPCs receiving cards and formats vi/en
    const fresh = createFreshCampaignState('Pilot', 'striker');
    fresh.pilot.gears.striker.level = 25;
    fresh.adminConfig.npcBuffCards = sanitizeNpcBuffCardsConfig({
      enabled: true,
      allyChancePct: 100,
      enemyChancePct: 100,
      minLevel: 10,
      maxTier: 3,
      levelPerTier: 10,
      maxKindsPerUnit: 2,
      includeBoss: true,
      includeStructure: false,
    });
    const battle = createInitialBattleState(
      fresh.pilot,
      'sector_01',
      makeSeededRng(123),
      null,
      fresh.adminConfig,
      'patrol'
    );
    const cardLogs = battle.log.filter((l) => l.templateKey === 'log.npcBuffCards');
    expect(cardLogs.length).toBeGreaterThan(0);
    const viLine = formatCombatLogMessage('vi', cardLogs[0]);
    const enLine = formatCombatLogMessage('en', cardLogs[0]);
    expect(viLine).toContain('dùng thẻ');
    expect(viLine).not.toContain('EXP');
    expect(enLine).toContain('uses buff cards:');
  });
});
