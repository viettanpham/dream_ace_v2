// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnrageAdminBlock } from '../../components/admin/EnrageAdminBlock';
import { TurnQueueBar } from '../../components/TurnQueueBar';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { DEFAULT_ENRAGE_CONFIG } from '../../data/balance';
import { useGameStore } from '../../store/useGameStore';
import type { AdminConfig, BattleState, CombatUnit } from '../../types/game';
import { createInitialBattleState, resolveUnitAction, sortTurnOrder } from '../combat';
import {
  clampCritOverflowRatio,
  computeCritWithOverflow,
  getEnrageState,
  sanitizeEnrageConfig,
} from '../enrage';
import { createDefaultAdminConfig } from '../migration';
import { createDefaultPilotAccount } from '../stats';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(
  id: string,
  name: string,
  speed: number,
  side: 'ally' | 'enemy',
  opts?: { isPlayer?: boolean }
): CombatUnit {
  return {
    id,
    name,
    callsign: name,
    side,
    row: 'front',
    formationCol: 0,
    isPlayer: Boolean(opts?.isPlayer),
    classId: side === 'ally' ? 'striker' : 'interceptor',
    isBoss: false,
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 300,
      maxShield: 120,
      maxSp: 60,
      speed,
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
    hp: 300,
    shield: 120,
    sp: 60,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
  };
}

function makeBattle(units: CombatUnit[], round: number): BattleState {
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round,
    turnCounter: 1,
    turnOrder: sortTurnOrder(units),
    activeTurnIndex: 0,
    units,
    selectedTargetId: null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
    autoStopNotice: null,
    wingmanChat: null,
    log: [],
    events: [],
    roundSnapshots: [],
    fxEvents: [],
    popups: [],
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
  };
}

describe('TASK ENRAGE-2b — Crit overflow + compact header chip', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState({ adminConfig: createDefaultAdminConfig() });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
  });

  it('1) crit overflow math: rawCrit 130 ratio 2 -> +60 crit DMG, ratio 0 -> 0, rawCrit 90 -> 0, and affects combat damage', () => {
    expect(computeCritWithOverflow(75, 0, 55, 2)).toEqual({
      rawCrit: 130,
      totalCritChance: 100,
      overflowPct: 30,
      overflowCritDamagePct: 60,
    });
    expect(computeCritWithOverflow(75, 0, 55, 0)).toEqual({
      rawCrit: 130,
      totalCritChance: 100,
      overflowPct: 30,
      overflowCritDamagePct: 0,
    });
    expect(computeCritWithOverflow(75, 0, 15, 2)).toEqual({
      rawCrit: 90,
      totalCritChance: 90,
      overflowPct: 0,
      overflowCritDamagePct: 0,
    });

    const pilot = createDefaultPilotAccount('Ace', 'striker');
    const battle = createInitialBattleState(pilot, 'border_outpost');
    const enemy =
      battle.units.find((u) => u.side === 'enemy' && u.row === 'front') ??
      battle.units.find((u) => u.side === 'enemy')!;
    const player = battle.units.find((u) => u.isPlayer)!;
    const units = battle.units.map((u) =>
      u.id === player.id
        ? {
            ...u,
            row: 'front' as const,
            derived: { ...u.derived, attackPower: 200, critChance: 75 },
          }
        : u.id === enemy.id
        ? {
            ...u,
            row: 'front' as const,
            hp: 50000,
            shield: 0,
            derived: { ...u.derived, maxHp: 50000, dodgeChance: 0, defenseRating: 0 },
          }
        : u
    );

    const cfgBase: AdminConfig = {
      ...createDefaultAdminConfig(),
      enrage: {
        ...DEFAULT_ENRAGE_CONFIG,
        berserker: {
          startRound: 1,
          everyRounds: 1,
          maxStacks: 20,
          critRatePct: 55,
          critDamagePct: 0,
          critOverflowRatio: 0,
        },
      },
    };
    const cfgRatio2: AdminConfig = {
      ...cfgBase,
      enrage: {
        ...cfgBase.enrage!,
        berserker: { ...cfgBase.enrage!.berserker, critOverflowRatio: 2 },
      },
    };

    const resOff = resolveUnitAction(units, player.id, 'attack', enemy.id, 1, cfgBase, () => 0.5);
    const resOn = resolveUnitAction(units, player.id, 'attack', enemy.id, 1, cfgRatio2, () => 0.5);
    const dmgOff = 50000 - resOff.updatedUnits.find((u) => u.id === enemy.id)!.hp;
    const dmgOn = 50000 - resOn.updatedUnits.find((u) => u.id === enemy.id)!.hp;
    expect(dmgOn).toBeGreaterThan(dmgOff);
  });

  it('2) critOverflowRatio sanitizer defaults to 2, clamps 0..10, and Admin live example recomputes', () => {
    expect(clampCritOverflowRatio(undefined)).toBe(2);
    expect(clampCritOverflowRatio(-5)).toBe(0);
    expect(clampCritOverflowRatio(25)).toBe(10);
    expect(sanitizeEnrageConfig(null).berserker.critOverflowRatio).toBe(2);
    expect(
      sanitizeEnrageConfig({ berserker: { critOverflowRatio: 15 } }).berserker
        .critOverflowRatio
    ).toBe(10);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        createElement(EnrageAdminBlock, {
          adminConfig: createDefaultAdminConfig(),
          adminUpdateConfig: vi.fn(),
        })
      );
    });
    const example = container.querySelector(
      '[data-testid="admin-enrage-berserker-overflow-example"]'
    );
    expect(example?.textContent).toBe(
      '130% crit -> 30% thừa x 2 = +60% sát thương crit'
    );
  });

  it('3) latestPhase picks active phase with highest startRound even when order is swapped', () => {
    const defCfg = createDefaultAdminConfig();
    expect(getEnrageState(19, defCfg).latestPhase).toBeNull();
    expect(getEnrageState(22, defCfg).latestPhase).toBe('rage');
    expect(getEnrageState(55, defCfg).latestPhase).toBe('frenzy');
    expect(getEnrageState(120, defCfg).latestPhase).toBe('berserker');

    const swapped: AdminConfig = {
      ...defCfg,
      enrage: {
        rage: { startRound: 80, everyRounds: 5, maxStacks: 10, value: 5 },
        frenzy: { startRound: 10, everyRounds: 5, maxStacks: 20, value: 10 },
        berserker: {
          startRound: 40,
          everyRounds: 10,
          maxStacks: 10,
          critRatePct: 3,
          critDamagePct: 10,
          critOverflowRatio: 2,
        },
      },
    };
    expect(getEnrageState(20, swapped).latestPhase).toBe('frenzy');
    expect(getEnrageState(60, swapped).latestPhase).toBe('berserker');
    expect(getEnrageState(90, swapped).latestPhase).toBe('rage');
  });

  it('4) header chip hides when inactive and renders only active phases icons and numbers at rounds 22, 55, 120', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const units = [
      makeUnit('a1', 'Kira', 80, 'ally', { isPlayer: true }),
      makeUnit('e1', 'Raider', 70, 'enemy'),
    ];

    const renderRound = (round: number, variant: 'default' | 'phone' | 'sidebar' = 'default') => {
      act(() => {
        root!.render(
          createElement(TurnQueueBar, {
            battle: makeBattle(units, round),
            battleSpeed: 1,
            skipAnimations: false,
            variant,
          })
        );
      });
      return container!.querySelector('[data-testid="turn-queue-enrage-badge"]');
    };

    expect(renderRound(10)).toBeNull();

    const chip22 = renderRound(22)!;
    expect(chip22.textContent).toContain('Cuồng nộ');
    expect(chip22.textContent).toContain('x1');
    expect(chip22.textContent).toContain('-5%');
    expect(chip22.querySelector('[data-enrage-icon="BS05"]')).not.toBeNull();
    expect(chip22.querySelector('[data-enrage-icon="BF02"]')).toBeNull();
    expect(chip22.querySelector('[data-enrage-icon="SS04"]')).toBeNull();

    const chip55 = renderRound(55)!;
    expect(chip55.textContent).toContain('Frenzy');
    expect(chip55.textContent).toContain('x10');
    expect(chip55.textContent).toContain('-40%');
    expect(chip55.textContent).toContain('+20%');
    expect(chip55.querySelector('[data-enrage-icon="BS05"]')).not.toBeNull();
    expect(chip55.querySelector('[data-enrage-icon="BF02"]')).not.toBeNull();
    expect(chip55.querySelector('[data-enrage-icon="SS04"]')).toBeNull();

    const chip120 = renderRound(120, 'phone')!;
    expect(chip120.textContent).toContain('Berserker');
    expect(chip120.textContent).toContain('x28');
    expect(chip120.textContent).toContain('-50%');
    expect(chip120.textContent).toContain('+150%');
    expect(chip120.textContent).toContain('+9%');
    expect(chip120.textContent).toContain('+30%');
    expect(chip120.querySelector('[data-enrage-icon="BS05"]')).not.toBeNull();
    expect(chip120.querySelector('[data-enrage-icon="BF02"]')).not.toBeNull();
    expect(chip120.querySelector('[data-enrage-icon="SS04"]')).not.toBeNull();
    expect(chip120.querySelector('[data-enrage-icon="SS05"]')).not.toBeNull();
  });

  it('5) clicking the header chip opens the detail box listing 3 phases, stacks/max, numbers, and next stack round', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const units = [
      makeUnit('a1', 'Kira', 80, 'ally', { isPlayer: true }),
      makeUnit('e1', 'Raider', 70, 'enemy'),
    ];

    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle: makeBattle(units, 55),
          battleSpeed: 1,
          skipAnimations: false,
          variant: 'phone',
        })
      );
    });

    expect(
      container.querySelector('[data-testid="turn-queue-enrage-detail"]')
    ).toBeNull();

    const chip = container.querySelector(
      '[data-testid="turn-queue-enrage-badge"]'
    ) as HTMLButtonElement;
    act(() => {
      chip.click();
    });

    const detail = container.querySelector(
      '[data-testid="turn-queue-enrage-detail"]'
    );
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Cuồng nộ: 8 tầng (thủ -40%)');
    expect(detail!.textContent).toContain('8/10');
    expect(detail!.textContent).toContain('Tầng kế tiếp tại vòng 60');
    expect(detail!.textContent).toContain('Frenzy: 2 tầng (+20% sát thương)');
    expect(detail!.textContent).toContain('2/20');
    expect(detail!.textContent).toContain('0/10');
    expect(detail!.textContent).toContain('Tầng kế tiếp tại vòng 100');
  });
});
