// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatRow, CombatUnit } from '../../types/game';
import {
  computeRadarPopupFinalScalePct,
  computeRadarPopupScales,
  DEFAULT_RADAR_POPUP_BIG_MAX_UNITS,
  DEFAULT_RADAR_POPUP_LARGE_SCALE_PCT,
  DEFAULT_RADAR_POPUP_SMALL_SCALE_PCT,
  DEFAULT_RADAR_POPUP_START_SCALE_PCT,
  resolveRadarPopupConfig,
  sanitizeRadarPopupBigMaxUnits,
  sanitizeRadarPopupLargeScalePct,
  sanitizeRadarPopupSmallScalePct,
  sanitizeRadarPopupStartScalePct,
} from '../../utils/radarPopup';
import { BattleRadarView } from '../BattleRadarView';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow,
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const alive = overrides.alive ?? true;
  return {
    id,
    name,
    callsign: name.slice(0, 6).toUpperCase(),
    side,
    classId: side === 'ally' ? 'striker' : 'interceptor',
    isPlayer: false,
    row,
    formationCol: 0,
    hp: alive ? 600 : 0,
    shield: alive ? 120 : 0,
    sp: 50,
    isDefending: false,
    alive,
    animState: 'idle',
    statuses: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 600,
      maxShield: 120,
      maxSp: 100,
      speed: 75,
      attackPower: 120,
      defenseRating: 45,
      dodgeChance: 8,
      critChance: 12,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    level: 10,
    skillLevel: 1,
    equippedSkillIds: [],
    skillLevels: {},
    skillCooldowns: {},
    usedOnceSkills: [],
    ...overrides,
  };
}

function makeBattle(
  units: CombatUnit[],
  overrides: Partial<BattleState> = {}
): BattleState {
  return {
    sectorId: 's1',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    turnOrder: units.filter((u) => u.alive).map((u) => u.id),
    activeTurnIndex: 0,
    units,
    selectedTargetId: units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
    autoStopNotice: null,
    wingmanChat: null,
    log: [],
    events: [],
    roundSnapshots: [],
    popups: [],
    fxEvents: [],
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
    ...overrides,
  };
}

describe('RADAR-POP1 — Radar floating popup flight animation & scale config', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStore.setState((s) => ({
      language: 'vi',
      battleViewMode: 'radar',
      autoBattleEnabled: false,
      skipAnimations: false,
      adminConfig: {
        ...s.adminConfig,
        cardPopupFlightMs: 200,
        radarPopupStartScalePct: DEFAULT_RADAR_POPUP_START_SCALE_PCT,
        radarPopupSmallScalePct: DEFAULT_RADAR_POPUP_SMALL_SCALE_PCT,
        radarPopupLargeScalePct: DEFAULT_RADAR_POPUP_LARGE_SCALE_PCT,
        radarPopupBigMaxUnits: DEFAULT_RADAR_POPUP_BIG_MAX_UNITS,
      },
    }));
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
    localStorage.clear();
  });

  it('1) Computes final scale % from alive unit count and config (8 -> 125, 9 -> 100)', () => {
    const cfg = resolveRadarPopupConfig(null);
    expect(computeRadarPopupFinalScalePct(8, cfg)).toBe(125);
    expect(computeRadarPopupFinalScalePct(9, cfg)).toBe(100);

    const customCfg = resolveRadarPopupConfig({
      radarPopupStartScalePct: 50,
      radarPopupSmallScalePct: 140,
      radarPopupLargeScalePct: 90,
      radarPopupBigMaxUnits: 6,
    });
    expect(computeRadarPopupScales(6, customCfg)).toEqual({
      finalScalePct: 140,
      finalScale: 1.4,
      startScale: 0.7,
    });
    expect(computeRadarPopupScales(7, customCfg)).toEqual({
      finalScalePct: 90,
      finalScale: 0.9,
      startScale: 0.45,
    });
  });

  it('2) Sanitizes 4 radar popup configs (clamps out-of-range and falls back to defaults)', () => {
    expect(sanitizeRadarPopupStartScalePct(undefined)).toBe(60);
    expect(sanitizeRadarPopupStartScalePct(5)).toBe(20);
    expect(sanitizeRadarPopupStartScalePct(450)).toBe(300);

    expect(sanitizeRadarPopupSmallScalePct(Number.NaN)).toBe(125);
    expect(sanitizeRadarPopupSmallScalePct(10)).toBe(20);
    expect(sanitizeRadarPopupSmallScalePct(350)).toBe(300);

    expect(sanitizeRadarPopupLargeScalePct(undefined)).toBe(100);
    expect(sanitizeRadarPopupLargeScalePct(0)).toBe(20);
    expect(sanitizeRadarPopupLargeScalePct(500)).toBe(300);

    expect(sanitizeRadarPopupBigMaxUnits(undefined)).toBe(8);
    expect(sanitizeRadarPopupBigMaxUnits(0)).toBe(1);
    expect(sanitizeRadarPopupBigMaxUnits(12.6)).toBe(13);
  });

  it('3) Renders floating popup with --radar-pop-dy CSS var, start/end scales, flight class, and shared cardPopupFlightMs duration', () => {
    const units: CombatUnit[] = [
      makeUnit('p1', 'Alpha', 'ally', 'front', { isPlayer: true }),
      makeUnit('e1', 'Raider', 'enemy', 'front'),
    ];
    const battle = makeBattle(units, {
      popups: [{ id: 'pop_fly_1', unitId: 'e1', text: '-240', tone: 'crit' }],
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          reducedMotionMode: 'off',
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const el = container!.querySelector(
      '[data-testid="radar-popups-layer"] [data-testid="damage-popup"]'
    ) as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.classList.contains('anim-radar-popup-flight')).toBe(true);
    expect(el.classList.contains('anim-radar-popup-reduced')).toBe(false);
    expect(el.style.transformOrigin).toBe('center bottom');
    expect(el.style.animationDuration).toBe('200ms');

    const dyPct = Number.parseFloat(el.style.getPropertyValue('--radar-pop-dy'));
    expect(dyPct).toBeGreaterThan(0);
    expect(el.style.getPropertyValue('--radar-pop-start-scale')).toBe('0.75');
    expect(el.style.getPropertyValue('--radar-pop-end-scale')).toBe('1.25');
  });

  it('4) Uses reduced-motion fade class without flight class when reducedMotionMode is on', () => {
    const units: CombatUnit[] = [
      makeUnit('p1', 'Alpha', 'ally', 'front', { isPlayer: true }),
      makeUnit('e1', 'Raider', 'enemy', 'front'),
    ];
    const battle = makeBattle(units, {
      popups: [{ id: 'pop_rm_1', unitId: 'e1', text: '+50', tone: 'buff' }],
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          reducedMotionMode: 'on',
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const el = container!.querySelector(
      '[data-testid="radar-popups-layer"] [data-testid="damage-popup"]'
    ) as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.classList.contains('anim-radar-popup-flight')).toBe(false);
    expect(el.classList.contains('anim-radar-popup-reduced')).toBe(true);
    expect(el.style.getPropertyValue('--radar-pop-end-scale')).toBe('1.25');
  });
});
