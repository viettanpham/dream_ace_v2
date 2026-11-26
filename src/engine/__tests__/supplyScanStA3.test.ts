// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../../data/consumables';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { computeSupplyPrice } from '../itemPrice';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import {
  applyBattleSupplyUse,
  canUseSupply,
  filterAutoOrNpcSupplies,
  getSupplyStockCount,
  isAutoSupplyAllowed,
  sanitizeSupplyScanCount,
} from '../supplies';

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  return {
    id,
    name,
    callsign: name,
    side,
    row: 'front',
    formationCol: 0,
    isPlayer: false,
    classId: side === 'ally' ? 'striker' : 'interceptor',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 500,
      maxShield: 200,
      maxSp: 100,
      speed: 50,
      attackPower: 40,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: 500,
    shield: 200,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function seedScanBattle(enemies: CombatUnit[], scanCount = 1) {
  const campaign = createFreshCampaignState();
  const baseAdmin = campaign.adminConfig ?? createDefaultAdminConfig();
  const adminConfig = {
    ...baseAdmin,
    supplyScanCount: scanCount,
    prestage: {
      enabled: false,
      countdownSec: baseAdmin.prestage?.countdownSec ?? 5,
    },
  };
  const pilot = {
    ...campaign.pilot,
    gears: {
      ...campaign.pilot.gears,
      [campaign.pilot.activeGearId]: {
        ...campaign.pilot.gears[campaign.pilot.activeGearId],
        level: 10,
        supplyLoadout: ['sup_scan_t1'],
      },
    },
    consumables: [
      {
        id: 'supply_sup_scan_t1',
        kind: 'battle_supply' as const,
        templateId: 'sup_scan_t1',
        quantity: 3,
      },
    ],
  };

  const player = makeUnit('ally_player', 'Vance', 'ally', {
    isPlayer: true,
    derived: {
      ...makeUnit('tmp', 'tmp', 'ally').derived,
      speed: 999,
    },
  });
  const battle = createInitialBattleState(
    pilot,
    'border_outpost',
    () => 0.5,
    undefined,
    adminConfig,
    'patrol'
  );
  battle.units = [player, ...enemies];
  battle.turnOrder = [player.id, ...enemies.map((e) => e.id)];
  battle.activeTurnIndex = 0;
  battle.selectedTargetId = enemies[0]?.id ?? null;

  useGameStore.setState({
    screen: 'BATTLE',
    adminConfig,
    pilot,
    battle,
    autoBattleEnabled: false,
    skipAnimations: true,
  });
}

describe('TASK ST-A3 — Stealth-detect supply sup_scan_t1', () => {
  it('1) reveals a stealthed enemy in the front row, sets revealedThisRound, and logs Quét: lộ <tên>', () => {
    const eFront = makeUnit('e_front', 'Phantom-F', 'enemy', {
      row: 'front',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    seedScanBattle([eFront], 1);

    useGameStore.getState().useBattleSupply('sup_scan_t1');
    const battle = useGameStore.getState().battle!;
    const afterEnemy = battle.units.find((u) => u.id === 'e_front')!;

    expect(afterEnemy.statuses.some((s) => s.type === 'stealth')).toBe(false);
    expect(afterEnemy.revealedThisRound).toBe(true);
    const lastLog = battle.log[battle.log.length - 1];
    expect(lastLog.templateKey).toBe('log.supplyScanReveal');
    expect(formatCombatLogMessage('vi', lastLog)).toBe('Quét: lộ Phantom-F');
  });

  it('2) never reveals a stealthed enemy in the back row', () => {
    const eBack = makeUnit('e_back', 'Sniper-B', 'enemy', {
      row: 'back',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    seedScanBattle([eBack], 1);

    useGameStore.getState().useBattleSupply('sup_scan_t1');
    const battle = useGameStore.getState().battle!;
    const afterBack = battle.units.find((u) => u.id === 'e_back')!;

    expect(afterBack.statuses.some((s) => s.type === 'stealth')).toBe(true);
    expect(afterBack.revealedThisRound).toBeUndefined();
    const lastLog = battle.log[battle.log.length - 1];
    expect(lastLog.templateKey).toBe('log.supplyScanNone');
    expect(formatCombatLogMessage('vi', lastLog)).toBe(
      'Quét: không phát hiện mục tiêu'
    );
  });

  it('3) nothing found still allowed at full pools, consumes stock, and sets cooldown', () => {
    const tpl = getSupplyTemplateById('sup_scan_t1')!;
    const eVisible = makeUnit('e_vis', 'Scout-1', 'enemy', { row: 'front' });
    seedScanBattle([eVisible], 1);

    const before = useGameStore.getState();
    const player = before.battle!.units.find((u) => u.isPlayer)!;
    const preCheck = canUseSupply({
      template: tpl,
      stock: 3,
      unit: player,
      supplyState: before.battle!.supplyByUnit?.[player.id],
      isOwnTurn: true,
      cfg: before.adminConfig,
      kind: before.battle!.kind,
      units: before.battle!.units,
    });
    expect(preCheck.ok).toBe(true);

    before.useBattleSupply('sup_scan_t1');
    const after = useGameStore.getState();
    expect(getSupplyStockCount(after.pilot.consumables, 'sup_scan_t1')).toBe(2);
    const st = after.battle!.supplyByUnit?.[player.id];
    expect(st?.usedThisTurn).toBe(1);
    expect(st?.usedCountsByTemplate.sup_scan_t1).toBe(1);
    expect(st?.cooldownsByTemplate.sup_scan_t1).toBe(tpl.cooldownTurns + 1);
  });

  it('4) supplyScanCount=2 reveals 2 front/middle stealthed enemies and prices sup_scan_t1 at 50', () => {
    const tpl = getSupplyTemplateById('sup_scan_t1')!;
    expect(computeSupplyPrice(tpl)).toBe(50);
    expect(sanitizeSupplyScanCount(0)).toBe(1);
    expect(sanitizeSupplyScanCount(9)).toBe(5);

    const player = makeUnit('ally_player', 'Vance', 'ally', { isPlayer: true });
    const eFront = makeUnit('e_f', 'Ghost-F', 'enemy', {
      row: 'front',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    const eMid = makeUnit('e_m', 'Ghost-M', 'enemy', {
      row: 'middle',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    const eBack = makeUnit('e_b', 'Ghost-B', 'enemy', {
      row: 'back',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });

    const res = applyBattleSupplyUse({
      units: [player, eFront, eMid, eBack],
      supplyByUnit: {},
      unitId: player.id,
      template: tpl,
      stock: 2,
      isOwnTurn: true,
      cfg: { supplyUsesPerTurn: 1, supplyScanCount: 2 },
      rng: () => 0,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.revealedUnitIds?.length).toBe(2);
    expect(res.revealedUnitIds).not.toContain('e_b');
    expect(
      res.units.find((u) => u.id === 'e_f')?.statuses.some((s) => s.type === 'stealth')
    ).toBe(false);
    expect(
      res.units.find((u) => u.id === 'e_m')?.statuses.some((s) => s.type === 'stealth')
    ).toBe(false);
    expect(
      res.units.find((u) => u.id === 'e_b')?.statuses.some((s) => s.type === 'stealth')
    ).toBe(true);
  });

  it('5) auto-play and NPC supply filters ignore utility family sup_scan_t1', () => {
    const tpl = getSupplyTemplateById('sup_scan_t1')!;
    expect(isAutoSupplyAllowed(tpl)).toBe(false);
    expect(
      filterAutoOrNpcSupplies(SUPPLY_TEMPLATES).some((t) => t.id === 'sup_scan_t1')
    ).toBe(false);

    const eFront = makeUnit('e_front', 'Ghost-F', 'enemy', {
      row: 'front',
      statuses: [{ type: 'stealth', turnsRemaining: 2 }],
    });
    seedScanBattle([eFront], 1);
    useGameStore.setState({ autoBattleEnabled: true });

    useGameStore.getState().performAutoPlayerTurn();
    const after = useGameStore.getState();
    expect(getSupplyStockCount(after.pilot.consumables, 'sup_scan_t1')).toBe(3);
    expect(
      after.battle!.supplyByUnit?.ally_player?.usedCountsByTemplate.sup_scan_t1 ?? 0
    ).toBe(0);
  });
});
