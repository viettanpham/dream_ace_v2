import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { buildTurnQueue, sortTurnOrder } from '../../engine/combat';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit } from '../../types/game';
import { TurnQueueBar } from '../TurnQueueBar';

function makeUnit(
  id: string,
  name: string,
  speed: number,
  side: 'ally' | 'enemy',
  opts?: { isPlayer?: boolean; isBoss?: boolean; alive?: boolean }
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
    hp: opts?.alive === false ? 0 : 300,
    shield: opts?.alive === false ? 0 : 120,
    sp: 60,
    isDefending: false,
    alive: opts?.alive ?? true,
    statuses: [],
    animState: 'idle',
  };
}

function makeBattle(
  units: CombatUnit[],
  activeTurnIndex: number,
  round = 1
): BattleState {
  const turnOrder = sortTurnOrder(units);
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round,
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

describe('Conveyor Turn Queue — buildTurnQueue & TurnQueueBar render', () => {
  it('buildTurnQueue keeps acting unit first, excludes acted units from current, sorts next, removes dead, and handles round boundary', () => {
    const units = [
      makeUnit('e_sniper', 'Void Sniper', 81, 'enemy'),
      makeUnit('a_player', 'Kira', 74, 'ally', { isPlayer: true }),
      makeUnit('a_dax', 'Dax', 65, 'ally'),
      makeUnit('e_boss', 'Iron Dreadnought', 65, 'enemy', { isBoss: true }),
      makeUnit('e_dead', 'Fallen Drone', 90, 'enemy', { alive: false }),
    ];

    // Mid-round: e_sniper (index 0) and a_player (index 1) already acted; a_dax (index 2) is ACTING
    const battleMid = makeBattle(units, 2, 1);
    const qMid = buildTurnQueue(battleMid);

    // Dead unit excluded everywhere
    expect(qMid.current.some((e) => e.unitId === 'e_dead')).toBe(false);
    expect(qMid.next.some((e) => e.unitId === 'e_dead')).toBe(false);

    // Acting unit MUST be index 0 in current; acted units (e_sniper, a_player) MUST NOT appear in current
    expect(qMid.current.map((e) => e.unitId)).toEqual(['a_dax', 'e_boss']);
    expect(qMid.current[0].phase).toBe('current');
    expect(qMid.current.some((e) => e.unitId === 'e_sniper')).toBe(false);
    expect(qMid.current.some((e) => e.unitId === 'a_player')).toBe(false);

    // Next round has ALL living units sorted by Speed desc (with deterministic tie-breaker: ally before enemy at SPD 65)
    expect(qMid.next.map((e) => e.unitId)).toEqual([
      'e_sniper',
      'a_player',
      'a_dax',
      'e_boss',
    ]);
    expect(qMid.next.map((e) => e.effectiveSpeed)).toEqual([81, 74, 65, 65]);

    // Round boundary: last living unit acting (index 3 -> e_boss)
    const battleEndOfRound = makeBattle(units, 3, 1);
    const qEnd = buildTurnQueue(battleEndOfRound);
    expect(qEnd.current.map((e) => e.unitId)).toEqual(['e_boss']);
    expect(qEnd.next.map((e) => e.unitId)).toEqual([
      'e_sniper',
      'a_player',
      'a_dax',
      'e_boss',
    ]);

    // Start of Round 2 (activeTurnIndex resets to 0): next becomes current
    const battleRound2 = makeBattle(units, 0, 2);
    const qR2 = buildTurnQueue(battleRound2);
    expect(qR2.round).toBe(2);
    expect(qR2.current.map((e) => e.unitId)).toEqual(
      qEnd.next.map((e) => e.unitId)
    );
    expect(qR2.current[0].unitId).toBe('e_sniper');
  });

  it('TurnQueueBar renders acting unit as the FIRST chip, excludes acted/dimmed chips, and has ZERO scrollable elements', () => {
    useGameStore.getState().setLanguage('vi');

    const units = [
      makeUnit('e_sniper', 'Void Sniper', 81, 'enemy'),
      makeUnit('a_player', 'Kira', 74, 'ally', { isPlayer: true }),
      makeUnit('a_dax', 'Dax', 65, 'ally'),
      makeUnit('e_boss', 'Iron Boss', 58, 'enemy', { isBoss: true }),
      makeUnit('a_wing2', 'Nova', 52, 'ally'),
      makeUnit('e_drone2', 'Raider', 44, 'enemy'),
    ];

    // e_sniper (0) and a_player (1) have ALREADY ACTED; a_dax (2) is ACTING NOW
    const battle = makeBattle(units, 2, 3);
    const html = renderToStaticMarkup(
      createElement(TurnQueueBar, {
        battle,
        battleSpeed: 1,
        skipAnimations: false,
        enrageBonusPct: 0,
      })
    );

    // Extract rendered chips in DOM order
    const chipMatches = Array.from(
      html.matchAll(
        /data-testid="turn-queue-chip"[^>]*data-unit-id="([^"]+)"[^>]*data-acting="(true|false)"[^>]*data-phase="([^"]+)"/g
      )
    );
    expect(chipMatches.length).toBeGreaterThanOrEqual(2);

    // 1) First chip MUST be the acting unit (a_dax) with data-acting="true"
    expect(chipMatches[0][1]).toBe('a_dax');
    expect(chipMatches[0][2]).toBe('true');
    expect(chipMatches[0][3]).toBe('current');

    // 2) Only the first chip is marked acting; acted units never appear as current chips
    const currentChips = chipMatches.filter((m) => m[3] !== 'next_round');
    expect(currentChips.some((m) => m[1] === 'e_sniper')).toBe(false);
    expect(currentChips.some((m) => m[1] === 'a_player')).toBe(false);
    expect(html).not.toContain('Đã đi');
    expect(html).not.toContain('Acted');

    // 3) Acting chip displays ĐANG LƯỢT and gold-white active frame; Vietnamese tags [TA] / [ĐỊCH] / [BOSS]
    expect(html).toContain('ĐANG LƯỢT');
    expect(html).toContain('var(--turn-active)');
    expect(html).toContain('[TA]');
    expect(html).toContain('[BOSS]');

    // 4) ZERO scrollable containers in the rendered TurnQueueBar (no overflow-x-auto, overflow-x-scroll, overflow-auto, overflow-scroll)
    expect(html).toContain('data-testid="turn-queue-track"');
    expect(html).toContain('overflow-hidden');
    expect(html).not.toContain('overflow-x-auto');
    expect(html).not.toContain('overflow-x-scroll');
    expect(html).not.toContain('overflow-auto');
    expect(html).not.toContain('overflow-scroll');
  });

  it('TurnQueueBar header renders [Swords icon w/ tooltip] -> [Round N (+ inline flame phase badge when enraged)] -> [acting chip first] without visible "Đang chiến đấu" text or separate enrage chip', () => {
    useGameStore.getState().setLanguage('en');

    const units = [
      makeUnit('e_sniper', 'Void Sniper', 81, 'enemy'),
      makeUnit('a_player', 'Kira', 74, 'ally', { isPlayer: true }),
      makeUnit('a_dax', 'Dax', 65, 'ally'),
      makeUnit('e_boss', 'Iron Boss', 58, 'enemy', { isBoss: true }),
    ];

    const battle = makeBattle(units, 1, 27);
    const html = renderToStaticMarkup(
      createElement(TurnQueueBar, {
        battle,
        battleSpeed: 1,
        skipAnimations: false,
      })
    );

    // Strip HTML tags to verify visible text does NOT include "In combat" or "Đang chiến đấu"
    const visibleText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(visibleText).not.toContain('In combat');
    expect(visibleText).not.toContain('Đang chiến đấu');

    // Combat icon MUST carry the tooltip and appear BEFORE the round chip, which MUST appear BEFORE the first chip
    const iconIdx = html.indexOf('data-testid="turn-queue-combat-icon"');
    const roundChipIdx = html.indexOf('data-testid="turn-queue-round-chip"');
    const enrageBadgeIdx = html.indexOf('data-testid="turn-queue-enrage-badge"');
    const firstChipIdx = html.indexOf('data-testid="turn-queue-chip"');
    const dividerIdx = html.indexOf('data-testid="turn-queue-divider"');

    expect(iconIdx).toBeGreaterThan(-1);
    expect(roundChipIdx).toBeGreaterThan(iconIdx);
    expect(enrageBadgeIdx).toBeGreaterThan(roundChipIdx);
    expect(firstChipIdx).toBeGreaterThan(enrageBadgeIdx);
    expect(dividerIdx).toBeGreaterThan(firstChipIdx);

    // Icon tooltip says "Đang chiến đấu" (SSR snapshot uses default store language 'vi')
    expect(html).toContain('title="Đang chiến đấu"');
    // Inline flame badge inside Round chip shows highest active phase name and 3-phase tooltip
    expect(html).toContain('Cuồng nộ');
    expect(html).toContain(
      'title="Cuồng nộ: 2 tầng (thủ -10%) · Frenzy: 0 tầng (+0% sát thương) · Berserker: 0 tầng (+0% crit, +0% sát thương crit)"'
    );
    // Enrage badge is nested inside turn-queue-round-chip (no separate enrage pill after closing round chip)
    const roundChipSegment = html.slice(roundChipIdx, firstChipIdx);
    expect(roundChipSegment).toContain('Vòng 27');
    expect(roundChipSegment).toContain('data-testid="turn-queue-enrage-badge"');
    expect(roundChipSegment).toContain('Cuồng nộ');
  });
});

