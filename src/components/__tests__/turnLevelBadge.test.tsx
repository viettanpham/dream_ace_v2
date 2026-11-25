// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { sortTurnOrder } from '../../engine/combat';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit } from '../../types/game';
import { LevelBadge } from '../LevelBadge';
import { TurnQueueBar } from '../TurnQueueBar';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(
  id: string,
  name: string,
  speed: number,
  side: 'ally' | 'enemy',
  level: number,
  opts?: { isPlayer?: boolean; isBoss?: boolean }
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
    isBoss: Boolean(opts?.isBoss),
    level,
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

function makeBattle(units: CombatUnit[], activeTurnIndex = 0): BattleState {
  const turnOrder = sortTurnOrder(units);
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: activeTurnIndex,
    turnOrder,
    activeTurnIndex,
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

describe('TASK TURN-LV — Level badge in the battle turn order', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useGameStore.getState().setLanguage('vi');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1) LevelBadge applies levelConClass for enemies and neutral text-slate-300 for allies', () => {
    act(() => {
      root.render(
        createElement(
          'div',
          null,
          createElement(LevelBadge, { level: 30, refLevel: 25, side: 'enemy' }),
          createElement(LevelBadge, { level: 28, refLevel: 25, side: 'enemy' }),
          createElement(LevelBadge, { level: 25, refLevel: 25, side: 'enemy' }),
          createElement(LevelBadge, { level: 20, refLevel: 25, side: 'enemy' }),
          createElement(LevelBadge, { level: 35, refLevel: 25, side: 'ally' })
        )
      );
    });

    const badges = container.querySelectorAll('[data-testid="level-badge"]');
    expect(badges).toHaveLength(5);
    expect(badges[0].className).toContain('text-red-400');
    expect(badges[1].className).toContain('text-orange-400');
    expect(badges[2].className).toContain('text-slate-100');
    expect(badges[3].className).toContain('text-sky-400');
    expect(badges[4].className).toContain('text-slate-300');
    expect(badges[0].textContent).toBe('[30]');
    expect(badges[0].getAttribute('title')).toBe('Cấp 30');
  });

  it('2) queue row renders [level] before the name and preserves title/aria-label', () => {
    const units = [
      makeUnit('e_boss', 'Dread Boss', 95, 'enemy', 28, { isBoss: true }),
      makeUnit('a_player', 'Kira', 82, 'ally', 25, { isPlayer: true }),
      makeUnit('e_sniper', 'Void Sniper', 71, 'enemy', 26),
    ];
    const battle = makeBattle(units, 0);

    act(() => {
      root.render(
        createElement(TurnQueueBar, {
          battle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: 'Kira',
        })
      );
    });

    const actingRow = container.querySelector('[data-testid="turn-queue-acting-chip"]')!;
    const actingText = actingRow.textContent ?? '';
    expect(actingText.indexOf('[28]')).toBeLessThan(actingText.indexOf('Dread Boss'));
    expect(actingText.indexOf('[25]')).toBeGreaterThan(actingText.indexOf('>'));
    expect(actingText.indexOf('[25]')).toBeLessThan(actingText.indexOf('Kira'));

    const nextRows = container.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]');
    expect(nextRows.length).toBeGreaterThan(0);
    const firstRow = nextRows[0];
    const badge = firstRow.querySelector('[data-testid="level-badge"]')!;
    expect(badge.textContent).toBe('[25]');
    expect(badge.getAttribute('title')).toBe('Cấp 25');
    expect(badge.getAttribute('aria-label')).toBe('Cấp 25');
    const rowText = firstRow.textContent ?? '';
    expect(rowText.indexOf('[25]')).toBeLessThan(rowText.indexOf('Kira'));
  });

  it('3) level badge does not appear twice per upcoming queue row', () => {
    const units = [
      makeUnit('e_boss', 'Dread Boss', 95, 'enemy', 28, { isBoss: true }),
      makeUnit('a_player', 'Kira', 82, 'ally', 25, { isPlayer: true }),
      makeUnit('e_sniper', 'Void Sniper', 71, 'enemy', 26),
      makeUnit('a_wing', 'Dax', 60, 'ally', 24),
    ];
    const battle = makeBattle(units, 0);

    act(() => {
      root.render(
        createElement(TurnQueueBar, {
          battle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: 'Kira',
        })
      );
    });

    const nextRows = container.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]');
    expect(nextRows.length).toBeGreaterThanOrEqual(3);
    for (const row of nextRows) {
      expect(row.querySelectorAll('[data-testid="level-badge"]')).toHaveLength(1);
    }
  });
});
