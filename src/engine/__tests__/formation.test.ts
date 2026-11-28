import { describe, expect, it } from 'vitest';
import {
  cloneFormationConfig,
  DEFAULT_FORMATION_CONFIG,
} from '../../data/formationConfig';
import {
  createInitialBattleState,
  getEffectiveUnitDefense,
  getValidAllyTargets,
  getValidEnemyTargets,
  isLongRangeAction,
  resolveUnitAction,
} from '../combat';
import {
  autoPlaceFormation,
  canMoveUnitToRow,
  createDefaultSquadFormation,
  enforceFormationCapacities,
  migrateLegacySquadFormation,
  moveUnitToRow,
  sanitizeFormationConfig,
} from '../formation';
import {
  createDefaultAdminConfig,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { createDefaultPilotAccount } from '../stats';
import type { CombatRow, MechClassId, SquadFormationUnit } from '../../types/game';

function createSeededRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('3-Row Formation System', () => {
  describe('1. Targeting order & exposed-row logic after wipe', () => {
    it('targets front -> middle -> back in strict order and automatically exposes next row after a wipe', () => {
      const pilot = createDefaultPilotAccount('Commander', 'striker');
      pilot.gears.striker.level = 15;

      const battle = createInitialBattleState(
        pilot,
        'debris_belt',
        createSeededRng(42),
        6
      );
      const attacker = battle.units.find((u) => u.isPlayer)!;
      const enemies = battle.units.filter((u) => u.side === 'enemy');

      // Place 2 enemies in front, 2 in middle, 2 in back
      const assigned = new Map<string, CombatRow>([
        [enemies[0].id, 'front'],
        [enemies[1].id, 'front'],
        [enemies[2].id, 'middle'],
        [enemies[3].id, 'middle'],
        [enemies[4].id, 'back'],
        [enemies[5].id, 'back'],
      ]);
      const units = battle.units.map((u) => ({
        ...u,
        row: assigned.get(u.id) ?? u.row,
        hp: 1000,
        shield: 0,
        derived: { ...u.derived, maxHp: 1000, dodgeChance: 0 },
      }));

      // Step 1: Front is alive -> only front is targetable by standard attacks
      const t1 = getValidEnemyTargets(units, attacker, 'attack');
      expect(t1.map((u) => u.id).sort()).toEqual(
        [enemies[0].id, enemies[1].id].sort()
      );

      // Step 2: Wipe front row -> middle row automatically becomes exposed (back still protected)
      const afterFrontWipe = units.map((u) =>
        u.side === 'enemy' && u.row === 'front'
          ? { ...u, hp: 0, alive: false }
          : u
      );
      const t2 = getValidEnemyTargets(afterFrontWipe, attacker, 'attack');
      expect(t2.map((u) => u.id).sort()).toEqual(
        [enemies[2].id, enemies[3].id].sort()
      );

      // Step 3: Wipe middle row too -> back row automatically becomes exposed
      const afterMidWipe = afterFrontWipe.map((u) =>
        u.side === 'enemy' && u.row === 'middle'
          ? { ...u, hp: 0, alive: false }
          : u
      );
      const t3 = getValidEnemyTargets(afterMidWipe, attacker, 'attack');
      expect(t3.map((u) => u.id).sort()).toEqual(
        [enemies[4].id, enemies[5].id].sort()
      );

      // Step 4: If front is empty initially and middle has 1 unit, middle is targeted first
      const onlyMidAndBack = units.map((u) =>
        u.id === enemies[0].id || u.id === enemies[1].id || u.id === enemies[3].id
          ? { ...u, hp: 0, alive: false }
          : u
      );
      const t4 = getValidEnemyTargets(onlyMidAndBack, attacker, 'attack');
      expect(t4.map((u) => u.id)).toEqual([enemies[2].id]);
    });
  });

  describe('2. Long-range weapons, Siege class override & Support ally targeting', () => {
    it('allows Siege class and long-range weapons to target any enemy row even when Front is alive', () => {
      // A) Siege class pilot overrides front-row lock even on basic attacks
      const siegePilot = createDefaultPilotAccount('Artillery', 'siege');
      const siegeBattle = createInitialBattleState(
        siegePilot,
        'debris_belt',
        createSeededRng(10),
        6
      );
      const siegePlayer = siegeBattle.units.find((u) => u.isPlayer)!;
      expect(isLongRangeAction(siegePlayer, 'attack')).toBe(true);
      const allAliveEnemies = siegeBattle.units.filter(
        (u) => u.side === 'enemy' && u.alive
      );
      expect(
        getValidEnemyTargets(siegeBattle.units, siegePlayer, 'attack')
      ).toHaveLength(allAliveEnemies.length);

      // B) Non-Siege unit equipped with a long-range weapon (hasLongRangeWeapon) also targets any row
      const strikerPilot = createDefaultPilotAccount('RailAce', 'striker');
      const railWeapon = {
        instanceId: 'inst_rail_test',
        templateId: 'tpl_mw_rail_lance',
        slot: 'main_weapon' as const,
        tier: 2 as const,
        rarity: 'rare' as const,
        requiredLevel: 1,
        classRestriction: null,
        suffixId: null,
        rolledBaseStats: { attack: 25, accuracy: 8 },
        affixes: [],
        specialTraits: { armorPiercePct: 20, longRange: true },
        rollQuality: 75,
        enchantLevel: 0,
        price: 500,
        locked: false,
        favorite: false,
        obtainedAt: 1,
      };
      strikerPilot.inventory.push(railWeapon);
      strikerPilot.gears.striker.equipped.main_weapon = railWeapon.instanceId;

      const strikerBattle = createInitialBattleState(
        strikerPilot,
        'debris_belt',
        createSeededRng(11),
        6
      );
      const railPlayer = strikerBattle.units.find((u) => u.isPlayer)!;
      expect(railPlayer.hasLongRangeWeapon).toBe(true);
      expect(isLongRangeAction(railPlayer, 'attack')).toBe(true);
      expect(
        getValidEnemyTargets(strikerBattle.units, railPlayer, 'attack')
      ).toHaveLength(6);
    });

    it('allows Support heal/buff abilities to target allies in any row (front, middle, back)', () => {
      const supportPilot = createDefaultPilotAccount('Medic', 'support');
      supportPilot.gears.support.level = 10;
      supportPilot.gears.support.skillLevels = { sup_nanite_mend: 1 };
      supportPilot.gears.support.equippedSkillBar = ['sup_nanite_mend'];

      const battle = createInitialBattleState(
        supportPilot,
        'debris_belt',
        createSeededRng(21),
        6
      );
      const allies = battle.units.filter((u) => u.side === 'ally');
      const medic = allies.find((u) => u.isPlayer)!;

      // Put allies across all 3 rows and damage a front-row and back-row ally
      const placedUnits = battle.units.map((u) => {
        if (u.id === allies[0].id) return { ...u, row: 'back' as CombatRow, sp: 100 };
        if (u.id === allies[1].id) return { ...u, row: 'front' as CombatRow, hp: 50 };
        if (u.id === allies[2].id) return { ...u, row: 'middle' as CombatRow, hp: 50 };
        if (u.id === allies[3].id) return { ...u, row: 'back' as CombatRow, hp: 50 };
        return u;
      });

      const validAllies = getValidAllyTargets(placedUnits, medic);
      expect(validAllies.some((a) => a.row === 'front')).toBe(true);
      expect(validAllies.some((a) => a.row === 'middle')).toBe(true);
      expect(validAllies.some((a) => a.row === 'back')).toBe(true);
      expect(validAllies).toHaveLength(allies.length);

      // Heal front-row ally from back row
      const healFront = resolveUnitAction(
        placedUnits,
        medic.id,
        'skill',
        allies[1].id,
        1,
        undefined,
        () => 0.99,
        'sup_nanite_mend'
      );
      expect(
        healFront.updatedUnits.find((u) => u.id === allies[1].id)!.hp
      ).toBeGreaterThan(50);

      // Heal middle-row ally from back row
      const healMid = resolveUnitAction(
        placedUnits,
        medic.id,
        'skill',
        allies[2].id,
        1,
        undefined,
        () => 0.99,
        'sup_nanite_mend'
      );
      expect(
        healMid.updatedUnits.find((u) => u.id === allies[2].id)!.hp
      ).toBeGreaterThan(50);
    });
  });

  describe('3. Configurable row modifiers (Front / Middle / Back)', () => {
    it('applies default DEF and ranged DMG modifiers and respects Admin CP overrides', () => {
      const pilot = createDefaultPilotAccount('ModTest', 'siege');
      pilot.gears.siege.level = 15;
      const battle = createInitialBattleState(
        pilot,
        'border_outpost',
        createSeededRng(7),
        4
      );
      const attacker = battle.units.find((u) => u.isPlayer)!;
      const target = battle.units.find((u) => u.side === 'enemy')!;

      const baseDef = target.derived.defenseRating;
      const frontDef = getEffectiveUnitDefense(
        { ...target, row: 'front' },
        DEFAULT_FORMATION_CONFIG
      );
      const middleDef = getEffectiveUnitDefense(
        { ...target, row: 'middle' },
        DEFAULT_FORMATION_CONFIG
      );
      const backDef = getEffectiveUnitDefense(
        { ...target, row: 'back' },
        DEFAULT_FORMATION_CONFIG
      );

      expect(frontDef).toBe(Math.round(baseDef * 1.1));
      expect(middleDef).toBe(Math.round(baseDef * 1.0));
      expect(backDef).toBe(Math.round(baseDef * 0.9));

      // Siege attacker in Back row deals +10% ranged damage compared to Middle row against identical Middle target
      const setupUnits = (attackerRow: CombatRow) =>
        battle.units.map((u) => {
          if (u.id === attacker.id) {
            return {
              ...u,
              row: attackerRow,
              derived: {
                ...u.derived,
                attackPower: 200,
                critChance: 0,
                armorPiercePct: 0,
              },
            };
          }
          if (u.id === target.id) {
            return {
              ...u,
              row: 'middle' as CombatRow,
              hp: 2000,
              shield: 0,
              derived: {
                ...u.derived,
                maxHp: 2000,
                defenseRating: 40,
                dodgeChance: 0,
              },
            };
          }
          return { ...u, hp: 0, alive: false };
        });

      const defaultAdmin = {
        ...createDefaultAdminConfig(),
        formation: DEFAULT_FORMATION_CONFIG,
      };
      const fromMiddle = resolveUnitAction(
        setupUnits('middle'),
        attacker.id,
        'attack',
        target.id,
        1,
        defaultAdmin,
        () => 0.5
      );
      const fromBack = resolveUnitAction(
        setupUnits('back'),
        attacker.id,
        'attack',
        target.id,
        1,
        defaultAdmin,
        () => 0.5
      );

      const dmgMiddle =
        2000 - fromMiddle.updatedUnits.find((u) => u.id === target.id)!.hp;
      const dmgBack =
        2000 - fromBack.updatedUnits.find((u) => u.id === target.id)!.hp;
      expect(dmgBack).toBeGreaterThan(dmgMiddle);

      // Custom Admin CP override: give back row +50% ranged damage -> even higher damage
      const boostedCfg = cloneFormationConfig(DEFAULT_FORMATION_CONFIG);
      boostedCfg.rowModifiers.back.rangedDamagePct = 0.5;
      const fromBackBoosted = resolveUnitAction(
        setupUnits('back'),
        attacker.id,
        'attack',
        target.id,
        1,
        { ...defaultAdmin, formation: boostedCfg },
        () => 0.5
      );
      const dmgBackBoosted =
        2000 - fromBackBoosted.updatedUnits.find((u) => u.id === target.id)!.hp;
      expect(dmgBackBoosted).toBeGreaterThan(dmgBack);
    });
  });

  describe('4. Capacity validation & moving units between rows', () => {
    it('blocks moves into a full row and succeeds when row has capacity', () => {
      const cfg = sanitizeFormationConfig({
        rowCapacities: { front: 3, middle: 3, back: 2 },
        maxUnitsPerSide: 8,
      });
      const units: SquadFormationUnit[] = [
        { id: 'u1', name: 'A1', callsign: 'L1', classId: 'striker', isPlayer: true, row: 'front', formationCol: 0 },
        { id: 'u2', name: 'A2', callsign: 'L2', classId: 'striker', isPlayer: false, row: 'front', formationCol: 1 },
        { id: 'u3', name: 'A3', callsign: 'L3', classId: 'interceptor', isPlayer: false, row: 'front', formationCol: 2 },
        { id: 'u4', name: 'A4', callsign: 'L4', classId: 'support', isPlayer: false, row: 'middle', formationCol: 0 },
        { id: 'u5', name: 'A5', callsign: 'L5', classId: 'siege', isPlayer: false, row: 'back', formationCol: 0 },
        { id: 'u6', name: 'A6', callsign: 'L6', classId: 'siege', isPlayer: false, row: 'back', formationCol: 1 },
      ];

      // Moving u4 (middle) -> front should fail because front is 3/3
      const checkFullFront = canMoveUnitToRow(units, 'u4', 'front', cfg);
      expect(checkFullFront).toEqual({
        ok: false,
        reason: 'row_full',
        currentCount: 3,
        capacity: 3,
      });

      const failedMove = moveUnitToRow(units, 'u4', 'front', cfg);
      expect(failedMove.ok).toBe(false);
      expect(failedMove.reason).toBe('row_full');
      expect(failedMove.units).toBe(units);

      // Moving u4 -> back should also fail because back is 2/2
      expect(moveUnitToRow(units, 'u4', 'back', cfg).reason).toBe('row_full');

      // Moving u1 (front) -> middle succeeds (middle is 1/3 -> 2/3, front becomes 2/3)
      const okMove = moveUnitToRow(units, 'u1', 'middle', cfg);
      expect(okMove.ok).toBe(true);
      expect(okMove.units.find((u) => u.id === 'u1')?.row).toBe('middle');
      expect(okMove.units.filter((u) => u.row === 'front')).toHaveLength(2);
      expect(okMove.units.filter((u) => u.row === 'middle')).toHaveLength(2);

      // Now u4 can move into front (front is 2/3 -> 3/3)
      const secondMove = moveUnitToRow(okMove.units, 'u4', 'front', cfg);
      expect(secondMove.ok).toBe(true);
      expect(secondMove.units.find((u) => u.id === 'u4')?.row).toBe('front');
    });

    it('swaps units cleanly when swapIfFull is enabled and target row is at capacity', () => {
      const cfg = sanitizeFormationConfig({
        rowCapacities: { front: 3, middle: 3, back: 2 },
        maxUnitsPerSide: 8,
      });
      const units: SquadFormationUnit[] = [
        { id: 'u1', name: 'A1', callsign: 'L1', classId: 'striker', isPlayer: true, row: 'front', formationCol: 0 },
        { id: 'u2', name: 'A2', callsign: 'L2', classId: 'striker', isPlayer: false, row: 'front', formationCol: 1 },
        { id: 'u3', name: 'A3', callsign: 'L3', classId: 'interceptor', isPlayer: false, row: 'front', formationCol: 2 },
        { id: 'u4', name: 'A4', callsign: 'L4', classId: 'support', isPlayer: false, row: 'middle', formationCol: 0 },
        { id: 'u5', name: 'A5', callsign: 'L5', classId: 'siege', isPlayer: false, row: 'back', formationCol: 0 },
        { id: 'u6', name: 'A6', callsign: 'L6', classId: 'siege', isPlayer: false, row: 'back', formationCol: 1 },
      ];

      // Explicit swapWithUnitId: move u1 (front) -> back, swapping with u5 (back)
      const explicitSwap = moveUnitToRow(units, 'u1', 'back', cfg, {
        swapIfFull: true,
        swapWithUnitId: 'u5',
      });
      expect(explicitSwap.ok).toBe(true);
      expect(explicitSwap.swappedWithUnitId).toBe('u5');
      expect(explicitSwap.units.find((u) => u.id === 'u1')?.row).toBe('back');
      expect(explicitSwap.units.find((u) => u.id === 'u5')?.row).toBe('front');
      expect(explicitSwap.units.filter((u) => u.row === 'back')).toHaveLength(2);
      expect(explicitSwap.units.filter((u) => u.row === 'front')).toHaveLength(3);

      // Default row swap (no swapWithUnitId): move u4 (middle) -> back, swaps with last unit in back (u6 at formationCol 1)
      const rowSlotSwap = moveUnitToRow(explicitSwap.units, 'u4', 'back', cfg, {
        swapIfFull: true,
      });
      expect(rowSlotSwap.ok).toBe(true);
      expect(rowSlotSwap.swappedWithUnitId).toBe('u6');
      expect(rowSlotSwap.units.find((u) => u.id === 'u4')?.row).toBe('back');
      expect(rowSlotSwap.units.find((u) => u.id === 'u6')?.row).toBe('middle');
      expect(rowSlotSwap.units.filter((u) => u.row === 'back')).toHaveLength(2);
    });

    it('rebalances overflow safely when Admin CP lowers row capacities', () => {
      const squad = createDefaultSquadFormation('Pilot', 'striker');
      const tightCfg = sanitizeFormationConfig({
        rowCapacities: { front: 2, middle: 4, back: 2 },
        maxUnitsPerSide: 8,
      });
      const enforced = enforceFormationCapacities(squad, tightCfg);
      expect(enforced.filter((u) => u.row === 'front').length).toBeLessThanOrEqual(2);
      expect(enforced.filter((u) => u.row === 'middle').length).toBeLessThanOrEqual(4);
      expect(enforced.filter((u) => u.row === 'back').length).toBeLessThanOrEqual(2);
      expect(enforced).toHaveLength(squad.length);
    });
  });

  describe('5. Old-save migration (localStorage v1..v7 safety)', () => {
    it('migrates legacy 2-row bucket formation (old front -> front, old back -> back, middle empty)', () => {
      const legacy2Row = {
        front: [
          { id: 'ally_player', name: 'Vance', callsign: 'Lead-1', classId: 'striker', isPlayer: true },
          { id: 'ally_npc_1', name: 'Kira', callsign: 'Alpha', classId: 'interceptor', isPlayer: false },
        ],
        back: [
          { id: 'ally_npc_2', name: 'Nova', callsign: 'Bravo', classId: 'siege', isPlayer: false },
          { id: 'ally_npc_3', name: 'Orion', callsign: 'Echo', classId: 'support', isPlayer: false },
        ],
      };

      const migrated = migrateLegacySquadFormation(
        legacy2Row,
        'Vance',
        'striker',
        DEFAULT_FORMATION_CONFIG
      );

      expect(migrated.formationCustomized).toBe(true);
      expect(migrated.squadFormation.filter((u) => u.row === 'front')).toHaveLength(2);
      expect(migrated.squadFormation.filter((u) => u.row === 'middle')).toHaveLength(0);
      expect(migrated.squadFormation.filter((u) => u.row === 'back')).toHaveLength(2);
      expect(migrated.squadFormation.find((u) => u.id === 'ally_player')?.row).toBe('front');
      expect(migrated.squadFormation.find((u) => u.id === 'ally_npc_2')?.row).toBe('back');
    });

    it('migrates full v7 persisted save with old formationBackCapacity without crashing', () => {
      const legacySave = {
        pilot: {
          ...createDefaultPilotAccount('OldAce', 'interceptor'),
          squadFormation: {
            front: ['ally_player'],
            back: ['ally_npc_1'],
          },
        },
        adminConfig: {
          godMode: false,
          oneHitKill: false,
          formationFrontCapacity: 4,
          formationBackCapacity: 4,
          backRowDamageReduction: 0.15,
        },
        hasSaveData: true,
        language: 'en',
      };

      const migrated = migrateSaveData(legacySave, CURRENT_SAVE_VERSION - 1);
      // Old 4/4 defaults cleanly migrate to 3-row 5/5/5 defaults
      expect(migrated.adminConfig.formation.rowCapacities).toEqual({
        front: 5,
        middle: 5,
        back: 5,
      });
      expect(migrated.adminConfig.formation.maxUnitsPerSide).toBe(8);
      // Dead legacy key must not exist
      expect('formationBackCapacity' in migrated.adminConfig).toBe(false);
      // Pilot squadFormation migrated safely with middle empty from legacy 2-row save
      expect(migrated.pilot.squadFormation).toBeDefined();
      expect(migrated.pilot.squadFormation!.length).toBeGreaterThan(0);
      expect(
        migrated.pilot.squadFormation!.find((u) => u.id === 'ally_player')?.row
      ).toBe('front');
      expect(
        migrated.pilot.squadFormation!.find((u) => u.id === 'ally_npc_1')?.row
      ).toBe('back');
    });

    it('never crashes on null, corrupted, or malformed legacy saves', () => {
      expect(() => migrateSaveData(null, 5)).not.toThrow();
      expect(() => migrateSaveData('corrupted', 3)).not.toThrow();
      expect(() =>
        migrateSaveData(
          {
            pilot: {
              name: 'Broken',
              squadFormation: [null, 123, { row: 'invalid_row', classId: 'bad' }],
            },
            adminConfig: {
              formation: {
                rowCapacities: { front: 0, middle: 0, back: 0 },
                maxUnitsPerSide: -5,
              },
            },
          },
          7
        )
      ).not.toThrow();

      const recovered = migrateSaveData(
        {
          adminConfig: {
            formation: {
              rowCapacities: { front: 0, middle: 0, back: 0 },
              maxUnitsPerSide: -5,
            },
          },
        },
        7
      );
      // Total capacity can never deadlock at 0
      const rc = recovered.adminConfig.formation.rowCapacities;
      expect(rc.front + rc.middle + rc.back).toBeGreaterThanOrEqual(1);
      expect(recovered.adminConfig.formation.maxUnitsPerSide).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Auto-placement by class & enemy 3-row generation', () => {
    it('auto-places Siege -> front, Striker/Interceptor -> middle, Support -> back', () => {
      const roster: Array<{ id: string; classId: MechClassId }> = [
        { id: 's1', classId: 'striker' },
        { id: 's2', classId: 'striker' },
        { id: 'i1', classId: 'interceptor' },
        { id: 'i2', classId: 'interceptor' },
        { id: 'g1', classId: 'siege' },
        { id: 'g2', classId: 'siege' },
        { id: 'p1', classId: 'support' },
        { id: 'p2', classId: 'support' },
      ];

      const placed = autoPlaceFormation(roster, DEFAULT_FORMATION_CONFIG);
      const byId = new Map(placed.map((u) => [u.id, u.row]));

      // Sieges go front
      expect(byId.get('g1')).toBe('front');
      expect(byId.get('g2')).toBe('front');
      // Strikers and Interceptors go middle
      expect(byId.get('s1')).toBe('middle');
      expect(byId.get('s2')).toBe('middle');
      expect(byId.get('i1')).toBe('middle');
      expect(byId.get('i2')).toBe('middle');
      // Supports go back
      expect(byId.get('p1')).toBe('back');
      expect(byId.get('p2')).toBe('back');

      // Row counts stay strictly within default capacities (5 / 5 / 5)
      expect(placed.filter((u) => u.row === 'front').length).toBeLessThanOrEqual(5);
      expect(placed.filter((u) => u.row === 'middle').length).toBeLessThanOrEqual(5);
      expect(placed.filter((u) => u.row === 'back').length).toBeLessThanOrEqual(5);
    });

    it('never fails even when more units than a single preferred row capacity exist', () => {
      const eightStrikers = Array.from({ length: 8 }, (_, idx) => ({
        id: `str_${idx}`,
        classId: 'striker' as MechClassId,
      }));
      const tightCfg = sanitizeFormationConfig({
        rowCapacities: { front: 3, middle: 3, back: 2 },
        maxUnitsPerSide: 8,
      });
      const placed = autoPlaceFormation(eightStrikers, tightCfg);
      expect(placed).toHaveLength(8);
      expect(placed.filter((u) => u.row === 'front')).toHaveLength(3);
      expect(placed.filter((u) => u.row === 'middle')).toHaveLength(3);
      expect(placed.filter((u) => u.row === 'back')).toHaveLength(2);
    });

    it('places enemy squads across all 3 rows using auto-placement with small random variation', () => {
      const pilot = createDefaultPilotAccount('Scout', 'striker');
      const patterns = new Set<string>();

      for (let seed = 1; seed <= 12; seed++) {
        const battle = createInitialBattleState(
          pilot,
          'iron_citadel',
          createSeededRng(seed * 97),
          8
        );
        const enemies = battle.units.filter((u) => u.side === 'enemy');
        const front = enemies.filter((u) => u.row === 'front').length;
        const middle = enemies.filter((u) => u.row === 'middle').length;
        const back = enemies.filter((u) => u.row === 'back').length;

        expect(front + middle + back).toBe(8);
        expect(front).toBeLessThanOrEqual(8);
        expect(middle).toBeLessThanOrEqual(8);
        expect(back).toBeLessThanOrEqual(8);
        patterns.add(enemies.map((e) => `${e.classId}:${e.row}`).join('|'));
      }

      // Random variation should produce more than one distinct enemy formation across seeds
      expect(patterns.size).toBeGreaterThan(1);
    });
  });
});
