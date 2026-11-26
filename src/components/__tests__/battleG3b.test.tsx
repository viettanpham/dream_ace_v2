// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActiveStatusEffect,
  BattleSize,
  BattleState,
  CombatRow,
  CombatUnit,
  StatusEffectType,
} from '../../types/game';
import {
  buildUpcomingTurnList,
  computeRingArcSpec,
  computeUnitRingArcs,
  getStatusIconMeta,
  layoutUnitStatusIcons,
  RADAR_LOW_HP_THRESHOLD,
  RADAR_RING_DEFAULT_STROKE_WIDTH,
  RADAR_RING_MIN_MARKER_RADIUS,
  RADAR_SP_RING_MIN_MARKER_RADIUS,
  RADAR_SP_RING_STROKE_WIDTH,
  RADAR_SPLIT_RING_STROKE_WIDTH,
} from '../../utils/battleDisplay';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { TurnQueueBar } from '../TurnQueueBar';
import { useGameStore } from '../../store/useGameStore';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: CombatRow,
  opts: Partial<CombatUnit> = {}
): CombatUnit {
  const maxHp = opts.derived?.maxHp ?? 1000;
  const maxShield = opts.derived?.maxShield ?? 400;
  const maxSp = opts.derived?.maxSp ?? 100;
  return {
    id,
    name,
    callsign: opts.callsign ?? name.slice(0, 4).toUpperCase(),
    side,
    isPlayer: opts.isPlayer ?? false,
    isBoss: opts.isBoss ?? false,
    isStructure: opts.isStructure ?? false,
    classId: opts.classId ?? 'striker',
    level: opts.level ?? 10,
    skillLevel: opts.skillLevel ?? 1,
    stats: opts.stats ?? {
      attack: 20,
      defense: 20,
      fuel: 20,
      spirit: 20,
      shield: 20,
      evasion: 20,
    },
    row,
    formationCol: opts.formationCol ?? 0,
    hp: opts.hp ?? maxHp,
    shield: opts.shield ?? maxShield,
    sp: opts.sp ?? maxSp,
    alive: opts.alive ?? true,
    isDefending: opts.isDefending ?? false,
    statuses: opts.statuses ?? [],
    equippedSkillIds: opts.equippedSkillIds ?? [],
    skillLevels: opts.skillLevels ?? {},
    skillCooldowns: opts.skillCooldowns ?? {},
    usedOnceSkills: opts.usedOnceSkills ?? [],
    derived: {
      maxHp,
      maxShield,
      maxSp,
      speed: opts.derived?.speed ?? 120,
      attackPower: opts.derived?.attackPower ?? 140,
      defenseRating: opts.derived?.defenseRating ?? 80,
      dodgeChance: opts.derived?.dodgeChance ?? 10,
      critChance: opts.derived?.critChance ?? 15,
      skillPower: opts.derived?.skillPower ?? 100,
      armorPiercePct: opts.derived?.armorPiercePct ?? 0,
      splashPct: opts.derived?.splashPct ?? 0,
      spRegenPerTurn: opts.derived?.spRegenPerTurn ?? 5,
      passiveSkillDmgPct: opts.derived?.passiveSkillDmgPct ?? 0,
    },
    animState: 'idle',
  };
}

function makeBattle(units: CombatUnit[], activeTurnIndex = 0): BattleState {
  const turnOrder = [...units]
    .filter((u) => u.alive)
    .sort((a, b) => b.derived.speed - a.derived.speed)
    .map((u) => u.id);

  const rawSize = Math.max(
    units.filter((u) => u.side === 'ally').length,
    units.filter((u) => u.side === 'enemy').length
  );
  const squadSize: BattleSize =
    rawSize <= 4 ? 4 : rawSize <= 6 ? 6 : 8;

  return {
    sectorId: 'sector_01',
    deployedGearId: 'striker',
    squadSize,
    round: 1,
    turnCounter: 1,
    units,
    turnOrder,
    activeTurnIndex,
    selectedTargetId: units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null,
    selectedAllyTargetId: units.find((u) => u.isPlayer)?.id ?? null,
    lastPlayerTargetId: null,
    log: [],
    events: [],
    roundSnapshots: [],
    popups: [],
    fxEvents: [],
    explodedUnitIds: [],
    wingmanChat: null,
    isResolving: false,
    autoStopNotice: null,
    summary: null,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGameStore.setState({
    language: 'en',
    autoBattleEnabled: false,
    autoRepeatLimit: 10,
    autoRepeatSession: null,
    battleSpeed: 1,
    skipAnimations: false,
    battleViewMode: 'radar',
    tacticsModalOpen: false,
  });
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  vi.restoreAllMocks();
});

describe('G3b + RM2 Pure Functions — size-aware split ring, thin inner SP ring, 3 size tiers, low HP red, status overflow & upcoming list', () => {
  it('computes arc filled length, clamping, rounding, half-sweep orientation, and optional SP stroke clamp override accurately', () => {
    const spec = computeRingArcSpec(
      'hp',
      20,
      3,
      250,
      1000,
      '#22c55e',
      'rgba(26,46,36,0.85)'
    );
    const expectedCircumference = 2 * Math.PI * 20;
    expect(spec.ratio).toBeCloseTo(0.25, 4);
    expect(spec.circumference).toBeCloseTo(expectedCircumference, 1);
    expect(spec.filledLength).toBeCloseTo(expectedCircumference * 0.25, 1);
    expect(spec.strokeWidth).toBeGreaterThanOrEqual(
      RADAR_RING_DEFAULT_STROKE_WIDTH
    );
    expect(spec.strokeDashoffset).toBe('0');
    expect(spec.strokeDasharray).toContain(spec.filledLength.toFixed(2));
    expect(spec.transform).toBe('rotate(-90)');

    // Default callers still clamp stroke to RADAR_RING_DEFAULT_STROKE_WIDTH (3)
    const clampedDefault = computeRingArcSpec(
      'hp',
      20,
      2,
      500,
      1000,
      '#22c55e',
      'rgba(26,46,36,0.85)'
    );
    expect(clampedDefault.strokeWidth).toBe(RADAR_RING_DEFAULT_STROKE_WIDTH);

    // SP uses explicit minStrokeWidth = 2 -> strokeWidth 2, starts at 12 o'clock clockwise
    const spSpec = computeRingArcSpec(
      'sp',
      34,
      RADAR_SP_RING_STROKE_WIDTH,
      60,
      100,
      '#f59e0b',
      '#3a2a0c',
      false,
      1,
      RADAR_SP_RING_STROKE_WIDTH
    );
    expect(spSpec.strokeWidth).toBe(2);
    expect(spSpec.transform).toBe('rotate(-90)');
    expect(spSpec.ratio).toBeCloseTo(0.6, 4);

    // Split-ring left HP & right Shield transforms and ratio clamping
    const leftHp = computeRingArcSpec(
      'hp',
      38,
      4,
      1500,
      1000,
      '#22c55e',
      'rgba(26,46,36,0.85)',
      false,
      0.5
    );
    expect(leftHp.ratio).toBe(1);
    expect(leftHp.arcLength).toBeCloseTo(Math.PI * 38, 1);
    expect(leftHp.filledLength).toBeCloseTo(Math.PI * 38, 1);
    expect(leftHp.transform).toBe('rotate(90)');

    const rightShieldNegative = computeRingArcSpec(
      'shield',
      38,
      4,
      -50,
      400,
      '#38bdf8',
      'rgba(20,44,72,0.85)',
      false,
      0.5
    );
    expect(rightShieldNegative.ratio).toBe(0);
    expect(rightShieldNegative.filledLength).toBe(0);
    expect(rightShieldNegative.transform).toBe('scale(-1, 1) rotate(90)');
  });

  it('computes 3 markerRadius tiers: R >= 30 full (stroke 4 + thin SP ring at 41), 17 <= R < 30 split only, R < 17 HP-only, plus size-aware stroke & low HP red', () => {
    const healthyUnit = makeUnit('u1', 'Sora', 'ally', 'front', {
      hp: 250,
      shield: 200,
      sp: 60,
      derived: {
        maxHp: 1000,
        maxShield: 400,
        maxSp: 100,
        speed: 120,
        attackPower: 100,
        defenseRating: 80,
        dodgeChance: 10,
        critChance: 15,
        skillPower: 100,
        armorPiercePct: 0,
        splashPct: 0,
        spRegenPerTurn: 5,
        passiveSkillDmgPct: 0,
      },
    });

    // Tier 1: R = 41 (>= 30) -> outerRadius 40, split stroke 4, SP ring stroke 2 at radius 34, inner disc 32
    const healthyRes = computeUnitRingArcs(healthyUnit, 41);
    expect(healthyRes.hpOnlyMode).toBe(false);
    expect(healthyRes.isLowHp).toBe(false); // 25% is NOT below 25%
    expect(healthyRes.outerRadius).toBe(40);
    expect(healthyRes.ringRadius).toBe(38);
    expect(healthyRes.innerCircleRadius).toBe(32);
    expect(healthyRes.innerShapeRadius).toBe(30);
    expect(healthyRes.arcs.map((a) => a.kind)).toEqual(['hp', 'shield']);
    expect(healthyRes.arcs[0].radius).toBe(healthyRes.arcs[1].radius);
    expect(healthyRes.arcs[0].strokeWidth).toBe(4);
    expect(healthyRes.arcs[1].strokeWidth).toBe(4);
    expect(healthyRes.arcs[0].strokeWidth).toBe(RADAR_SPLIT_RING_STROKE_WIDTH);
    expect(healthyRes.arcs[0].color).toBe('#22c55e');
    expect(healthyRes.arcs[0].transform).toBe('rotate(90)');
    expect(healthyRes.arcs[1].color).toBe('#38bdf8');
    expect(healthyRes.arcs[1].transform).toBe('scale(-1, 1) rotate(90)');
    expect(healthyRes.spArc).not.toBeNull();
    expect(healthyRes.spArc!.radius).toBe(34);
    expect(healthyRes.spArc!.strokeWidth).toBe(2);
    expect(healthyRes.spArc!.color).toBe('#f59e0b');
    expect(healthyRes.spArc!.trackColor).toBe('#3a2a0c');
    expect(healthyRes.spArc!.transform).toBe('rotate(-90)');
    expect(healthyRes.spArc!.ratio).toBeCloseTo(0.6, 4);

    // Tier 2: R = 22 (17 <= R < 30) -> split ring only, size-aware stroke (3), NO SP ring, larger inner disc
    const tier2Res = computeUnitRingArcs(healthyUnit, 22);
    expect(tier2Res.hpOnlyMode).toBe(false);
    expect(tier2Res.outerRadius).toBe(27);
    expect(tier2Res.arcs).toHaveLength(2);
    expect(tier2Res.arcs[0].strokeWidth).toBe(3); // round(27 * 0.09) = 2 -> clamped [3, 5]
    expect(tier2Res.spArc).toBeNull();
    expect(tier2Res.innerCircleRadius).toBe(23); // 27 - 3 - 1 (bigger without SP ring)
    expect(tier2Res.innerShapeRadius).toBe(21);

    // Size-aware stroke clamps up to 5 at larger radius (R = 56 -> outerRadius = 50 -> round(4.5) = 5)
    const largeRes = computeUnitRingArcs(healthyUnit, 56);
    expect(largeRes.arcs[0].strokeWidth).toBe(5);
    expect(largeRes.spArc).not.toBeNull();
    expect(largeRes.spArc!.strokeWidth).toBe(2);

    // maxSp = 0 -> SP arc has ratio 0, hasCapacity false (track only)
    const zeroMaxSpUnit = makeUnit('u_nosp', 'Drone', 'enemy', 'front', {
      sp: 0,
      derived: { ...healthyUnit.derived, maxSp: 0 },
    });
    const zeroMaxSpRes = computeUnitRingArcs(zeroMaxSpUnit, 41);
    expect(zeroMaxSpRes.spArc).not.toBeNull();
    expect(zeroMaxSpRes.spArc!.hasCapacity).toBe(false);
    expect(zeroMaxSpRes.spArc!.ratio).toBe(0);
    expect(zeroMaxSpRes.spArc!.filledLength).toBe(0);

    // Low HP strictly below 25% -> red + pulse
    const lowHpUnit = makeUnit('u2', 'Vex', 'ally', 'front', {
      hp: Math.floor(1000 * RADAR_LOW_HP_THRESHOLD) - 1, // 249 / 1000 = 24.9%
      derived: healthyUnit.derived,
    });
    const lowRes = computeUnitRingArcs(lowHpUnit, 41);
    expect(lowRes.isLowHp).toBe(true);
    const hpArc = lowRes.arcs.find((a) => a.kind === 'hp')!;
    expect(hpArc.isLowHp).toBe(true);
    expect(hpArc.color).toBe('#ef4444');
  });

  it('falls back to HP arc only below the minimum marker radius (R < 17, e.g. R = 14)', () => {
    expect(RADAR_SP_RING_MIN_MARKER_RADIUS).toBe(30);
    const unit = makeUnit('u_small', 'Scout', 'enemy', 'back', {
      hp: 500,
      shield: 300,
      sp: 80,
    });
    const res = computeUnitRingArcs(unit, 14);
    expect(RADAR_RING_MIN_MARKER_RADIUS).toBe(17);
    expect(res.hpOnlyMode).toBe(true);
    expect(res.arcs).toHaveLength(1);
    expect(res.arcs[0].kind).toBe('hp');
    expect(res.arcs[0].transform).toBe('rotate(-90)');
    expect(res.arcs[0].strokeWidth).toBe(RADAR_RING_DEFAULT_STROKE_WIDTH);
    expect(res.spArc).toBeNull();
  });

  it('caps status icons at 3 with +N overflow and never produces an unexplained "!" badge across all status types', () => {
    const allTypes: StatusEffectType[] = [
      'burn',
      'shield_break',
      'slow',
      'silence',
      'stealth',
      'vulnerable',
      'def_up',
      'def_down',
      'eva_up',
      'atk_up',
      'spd_up',
      'primary_dmg_up',
      'skill_dmg_up',
      'sure_hit',
      'counter',
      'evade_all',
      'invincible',
      'regen_hp',
      'siege_mode',
      'siege_defense',
      'charging',
    ];

    for (const type of allTypes) {
      const meta = getStatusIconMeta({ type, turnsRemaining: 2, magnitude: 0.25 });
      expect(meta.symbol).not.toBe('!');
      expect(meta.symbol.trim().length).toBeGreaterThan(0);
      expect(meta.outlineColor).toBe(meta.isDebuff ? '#ef4444' : '#22c55e');
      expect(meta.strengthPct).toBe(25);
    }

    const fiveStatuses: ActiveStatusEffect[] = [
      { type: 'atk_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.2 },
      { type: 'burn', turnsRemaining: 3, isDebuff: true, magnitude: 0.1 },
      { type: 'shield_break', turnsRemaining: 2, isDebuff: true },
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
      { type: 'def_down', turnsRemaining: 1, isDebuff: true, magnitude: 0.15 },
    ];
    const laid = layoutUnitStatusIcons(fiveStatuses);
    expect(laid.visible).toHaveLength(3);
    expect(laid.overflowCount).toBe(2);
  });

  it('builds upcoming turn list in exact speed order and caps at 5 numbered items', () => {
    const units: CombatUnit[] = [
      makeUnit('u1', 'Sora', 'ally', 'front', {
        isPlayer: true,
        derived: { ...makeUnit('t', 't', 'ally', 'front').derived, speed: 200 },
      }),
      makeUnit('u2', 'Kira', 'ally', 'middle', {
        derived: { ...makeUnit('t', 't', 'ally', 'front').derived, speed: 185 },
      }),
      makeUnit('u3', 'Nova', 'ally', 'back', {
        derived: { ...makeUnit('t', 't', 'ally', 'front').derived, speed: 170 },
      }),
      makeUnit('e1', 'Viper', 'enemy', 'front', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 160 },
      }),
      makeUnit('e2', 'Dreadnought Commander', 'enemy', 'front', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 150 },
      }),
      makeUnit('e3', 'Goliath', 'enemy', 'middle', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 140 },
      }),
      makeUnit('e4', 'Wraith', 'enemy', 'back', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 130 },
      }),
    ];
    const battle = makeBattle(units, 0);
    const result = buildUpcomingTurnList(battle);

    expect(result.actingEntry?.unitId).toBe('u1');
    expect(result.upcoming).toHaveLength(5);
    expect(result.upcoming.map((x) => x.order)).toEqual([1, 2, 3, 4, 5]);
    expect(result.upcoming.map((x) => x.entry.unitId)).toEqual([
      'u2',
      'u3',
      'e1',
      'e2',
      'e3',
    ]);
    expect(result.upcoming[3].shortName.length).toBeLessThanOrEqual(10);
  });
});

describe('G3b + RM2 Components — Split ring (stroke 4), thin inner SP ring, 3 tiers, zero water/animation, legend & Loop button', () => {
  it('renders 4px split ring (left HP, right Shield, 12/6 ticks), 2px thin inner SP ring (no water), zero "!" badges, and static SVG', () => {
    const p1 = makeUnit('p1', 'Sora', 'ally', 'front', {
      isPlayer: true,
      hp: 200, // 20% -> low HP red!
      shield: 200,
      sp: 75,
      statuses: [
        { type: 'atk_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.3 },
        { type: 'shield_break', turnsRemaining: 2, isDebuff: true },
        { type: 'def_down', turnsRemaining: 3, isDebuff: true, magnitude: 0.2 },
        { type: 'vulnerable', turnsRemaining: 1, isDebuff: true, magnitude: 0.25 },
      ],
    });
    const e1 = makeUnit('e1', 'Raider', 'enemy', 'front', {
      hp: 900,
      shield: 300,
      sp: 40,
    });
    const battle = makeBattle([p1, e1]);

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
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    // Split ring arcs exist on alive marker with left/right bottom-up transforms & stroke 4
    const hpRing = container!.querySelector('[data-testid="radar-ring-hp-p1"]');
    const shieldRing = container!.querySelector('[data-testid="radar-ring-shield-p1"]');
    const spTrack = container!.querySelector('[data-testid="radar-ring-track-sp-p1"]');
    const spRing = container!.querySelector('[data-testid="radar-ring-sp-p1"]');
    expect(hpRing).not.toBeNull();
    expect(shieldRing).not.toBeNull();
    expect(spTrack).not.toBeNull();
    expect(spRing).not.toBeNull();

    expect(hpRing!.getAttribute('transform')).toBe('rotate(90)');
    expect(shieldRing!.getAttribute('transform')).toBe('scale(-1, 1) rotate(90)');
    expect(hpRing!.getAttribute('stroke')).toBe('#ef4444');
    expect(hpRing!.getAttribute('data-low-hp')).toBe('true');
    expect(hpRing!.getAttribute('class')).toContain('vfx-low-hp-pulse');
    expect(Number(hpRing!.getAttribute('data-stroke-width'))).toBe(4);
    expect(Number(shieldRing!.getAttribute('data-stroke-width'))).toBe(4);
    expect(shieldRing!.getAttribute('stroke')).toBe('#38bdf8');
    expect(shieldRing!.getAttribute('data-ratio')).toBe('0.5');

    // SP is a 2px thin inner ring starting at 12 o'clock clockwise, zero water fill/surface
    expect(spRing!.tagName.toLowerCase()).toBe('circle');
    expect(spRing!.getAttribute('data-ratio')).toBe('0.75');
    expect(spRing!.getAttribute('data-stroke-width')).toBe('2');
    expect(spRing!.getAttribute('stroke')).toBe('#f59e0b');
    expect(spRing!.getAttribute('transform')).toBe('rotate(-90)');
    expect(spTrack!.getAttribute('stroke')).toBe('#3a2a0c');
    expect(spTrack!.getAttribute('stroke-width')).toBe('2');
    expect(
      container!.querySelectorAll('[data-testid^="radar-ring-sp-fill-"]')
    ).toHaveLength(0);
    expect(
      container!.querySelectorAll('[data-testid^="radar-ring-sp-surface-"]')
    ).toHaveLength(0);
    expect(container!.querySelectorAll('clipPath')).toHaveLength(0);

    // 6px ticks at 12 and 6 o'clock mark the split
    const topTick = container!.querySelector('[data-testid="radar-ring-tick-top-p1"]');
    const bottomTick = container!.querySelector('[data-testid="radar-ring-tick-bottom-p1"]');
    expect(topTick).not.toBeNull();
    expect(bottomTick).not.toBeNull();
    expect(
      Math.abs(Number(topTick!.getAttribute('y2')) - Number(topTick!.getAttribute('y1')))
    ).toBeCloseTo(6, 1);
    expect(
      Math.abs(Number(bottomTick!.getAttribute('y2')) - Number(bottomTick!.getAttribute('y1')))
    ).toBeCloseTo(6, 1);

    // Static SVG only: zero <animate> or <animateTransform> elements
    expect(container!.querySelectorAll('animate, animateTransform')).toHaveLength(0);

    // Up to 3 status icons + "+1" overflow, and ZERO "!" symbols anywhere on unit markers
    const statusIcons = Array.from(
      container!.querySelectorAll('[data-testid^="radar-status-icon-p1-"]')
    );
    expect(statusIcons).toHaveLength(3);
    for (const icon of statusIcons) {
      expect(icon.getAttribute('data-status-symbol')).not.toBe('!');
      expect(icon.textContent).not.toContain('!');
    }
    expect(
      container!.querySelector('[data-testid="radar-status-overflow-p1"]')?.textContent
    ).toBe('+1');

    // G4a-3a: No overlay tooltip rendered over radar; details live in native title & aria-label
    act(() => {
      statusIcons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(
      container!.querySelector('[data-testid="radar-status-tooltip"]')
    ).toBeNull();
    expect(statusIcons[0].getAttribute('aria-label')).toContain('25%');

    // Marker hover tooltip includes full HP, SHD, and SP values
    const p1Marker = container!.querySelector('[data-testid="radar-unit-p1"]');
    expect(p1Marker?.getAttribute('aria-label')).toContain('SP 75/100');
  });

  it('RM2 edge cases & tiers: maxSp=0 track-only, shield=0 vs maxShield=0 dashed track, dead ringless, tier 2 (R=22 split only), tier 3 (phone crowded HP-only), and legend', () => {
    const brokenShieldUnit = makeUnit('u_broken', 'Broken', 'ally', 'front', {
      isPlayer: true,
      hp: 800,
      shield: 0,
      sp: 0,
      derived: {
        ...makeUnit('t', 't', 'ally', 'front').derived,
        maxSp: 0,
      },
    });
    const noShieldCapUnit = makeUnit('u_nocap', 'Turret', 'enemy', 'front', {
      hp: 600,
      shield: 0,
      sp: 50,
      derived: {
        ...makeUnit('t', 't', 'enemy', 'front').derived,
        maxShield: 0,
      },
    });
    const deadUnit = makeUnit('u_dead', 'Fallen', 'enemy', 'back', {
      hp: 0,
      shield: 0,
      sp: 0,
      alive: false,
    });
    const battle = makeBattle([brokenShieldUnit, noShieldCapUnit, deadUnit]);

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'u_broken',
          validBasicTargetIds: new Set(['u_nocap']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    // shield=0 with maxShield>0 -> solid dark blue track, ratio=0, no dashed empty track
    const brokenShieldRing = container!.querySelector('[data-testid="radar-ring-shield-u_broken"]');
    expect(brokenShieldRing?.getAttribute('data-ratio')).toBe('0');
    expect(
      container!.querySelector('[data-testid="radar-ring-track-shield-u_broken"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-ring-shield-empty-track-u_broken"]')
    ).toBeNull();

    // maxSp=0 -> track rendered, SP arc ratio 0 with zero filled dash (track only)
    const zeroMaxSpTrack = container!.querySelector(
      '[data-testid="radar-ring-track-sp-u_broken"]'
    );
    const zeroMaxSpRing = container!.querySelector(
      '[data-testid="radar-ring-sp-u_broken"]'
    );
    expect(zeroMaxSpTrack).not.toBeNull();
    expect(zeroMaxSpRing).not.toBeNull();
    expect(zeroMaxSpRing!.getAttribute('data-ratio')).toBe('0');
    expect(zeroMaxSpRing!.getAttribute('data-has-capacity')).toBe('false');
    expect(zeroMaxSpRing!.getAttribute('stroke-dasharray')).toMatch(/^0\.00 /);

    // maxShield=0 -> faint dashed track on right half, nothing filled
    const noCapShieldRing = container!.querySelector('[data-testid="radar-ring-shield-u_nocap"]');
    expect(noCapShieldRing?.getAttribute('data-ratio')).toBe('0');
    expect(noCapShieldRing?.getAttribute('stroke-dasharray')).toMatch(/^0\.00 /);
    const emptyTrack = container!.querySelector(
      '[data-testid="radar-ring-shield-empty-track-u_nocap"]'
    );
    expect(emptyTrack).not.toBeNull();
    expect(emptyTrack!.getAttribute('stroke-dasharray')).toBe('3 3');

    // Dead unit -> no ring
    expect(container!.querySelector('[data-testid="radar-rings-u_dead"]')).toBeNull();

    // Phone Tier 2 (R = 22: all 3 enemy rows occupied, 2 units in row, squadSize = 4 -> split ring, NO radar-ring-sp)
    const tier2Units = [
      makeUnit('p_t2', 'Sora', 'ally', 'front', { isPlayer: true }),
      makeUnit('e_f1', 'F1', 'enemy', 'front'),
      makeUnit('e_f2', 'F2', 'enemy', 'front'),
      makeUnit('e_m1', 'M1', 'enemy', 'middle'),
      makeUnit('e_b1', 'B1', 'enemy', 'back'),
    ];
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: makeBattle(tier2Units),
          activeUnitId: 'p_t2',
          validBasicTargetIds: new Set(['e_f1', 'e_f2']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: true,
          layoutMode: 'phone-portrait',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });
    const tier2EnemyMarker = container!.querySelector('[data-testid="radar-unit-e_f1"]');
    expect(tier2EnemyMarker?.getAttribute('data-ring-mode')).toBe('split-ring');
    expect(container!.querySelector('[data-testid="radar-ring-hp-e_f1"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="radar-ring-shield-e_f1"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="radar-ring-sp-e_f1"]')).toBeNull();

    // Phone Tier 3 (R = 16 < 17: crowded row -> HP-only fallback, no shield/sp ring)
    const tier3Units = [
      makeUnit('p_t3', 'Sora', 'ally', 'front', { isPlayer: true }),
      makeUnit('e3_f1', 'F1', 'enemy', 'front'),
      makeUnit('e3_f2', 'F2', 'enemy', 'front'),
      makeUnit('e3_f3', 'F3', 'enemy', 'front'),
      makeUnit('e3_f4', 'F4', 'enemy', 'front'),
      makeUnit('e3_m1', 'M1', 'enemy', 'middle'),
      makeUnit('e3_b1', 'B1', 'enemy', 'back'),
    ];
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle: makeBattle(tier3Units),
          activeUnitId: 'p_t3',
          validBasicTargetIds: new Set(['e3_f1']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: true,
          layoutMode: 'phone-portrait',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });
    const tier3EnemyMarker = container!.querySelector('[data-testid="radar-unit-e3_f1"]');
    expect(tier3EnemyMarker?.getAttribute('data-ring-mode')).toBe('hp-only');
    expect(container!.querySelector('[data-testid="radar-ring-hp-e3_f1"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="radar-ring-shield-e3_f1"]')).toBeNull();
    expect(container!.querySelector('[data-testid="radar-ring-sp-e3_f1"]')).toBeNull();

    // Open Legend ("Chú giải") on desktop and verify split-ring + thin SP ring glyph and vi/en labels (no water wording)
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'u_broken',
          validBasicTargetIds: new Set(['u_nocap']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });
    const legendBtn = container!.querySelector(
      '[data-testid="radar-legend-toggle"]'
    ) as HTMLButtonElement;
    expect(legendBtn).not.toBeNull();
    act(() => {
      legendBtn.click();
    });
    const legendSplitRing = container!.querySelector(
      '[data-testid="radar-legend-split-ring"]'
    );
    expect(legendSplitRing).not.toBeNull();
    expect(
      legendSplitRing!.querySelector('[data-testid="radar-legend-sp-ring"]')
    ).not.toBeNull();
    expect(legendSplitRing!.querySelector('clipPath')).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-legend-low-hp"]')
    ).not.toBeNull();
    expect(VI_TRANSLATIONS['radar.legendRings']).toContain('SP');
    expect(EN_TRANSLATIONS['radar.legendRings']).toContain('SP');
    expect(VI_TRANSLATIONS['radar.legendRings'].toLowerCase()).not.toContain('nước');
    expect(EN_TRANSLATIONS['radar.legendRings'].toLowerCase()).not.toContain('water');
    expect(VI_TRANSLATIONS['radar.legendLowHp']).toContain('đỏ');
    expect(EN_TRANSLATIONS['radar.legendLowHp']).toContain('red');
    expect(container!.querySelectorAll('animate, animateTransform')).toHaveLength(0);
  });

  it('renders Loop popover (1/5/10/20/infinite + Start), switches to active progress chip (2/10 + Stop), stops loop without ending battle, and keeps "..." menu free of loop controls', () => {
    setViewport(1280, 800);
    const units = [
      makeUnit('p1', 'Sora', 'ally', 'front', { isPlayer: true }),
      makeUnit('e1', 'Viper', 'enemy', 'front'),
    ];
    const battle = makeBattle(units);
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      autoRepeatLimit: 10,
      autoRepeatSession: null,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Open Loop popover next to Radar/Card
    const loopBtn = container!.querySelector(
      '[data-testid="battle-loop-btn"]'
    ) as HTMLButtonElement;
    expect(loopBtn).not.toBeNull();
    expect(loopBtn.textContent).toContain('Loop');

    act(() => {
      loopBtn.click();
    });

    const popover = document.body.querySelector('[data-testid="battle-loop-popover"]');
    expect(popover).not.toBeNull();
    expect(popover!.querySelector('[data-testid="battle-loop-opt-1"]')).not.toBeNull();
    expect(popover!.querySelector('[data-testid="battle-loop-opt-5"]')).not.toBeNull();
    expect(popover!.querySelector('[data-testid="battle-loop-opt-10"]')).not.toBeNull();
    expect(popover!.querySelector('[data-testid="battle-loop-opt-20"]')).not.toBeNull();
    expect(popover!.querySelector('[data-testid="battle-loop-opt-infinite"]')).not.toBeNull();

    // Pick 10 and Start
    act(() => {
      (popover!.querySelector('[data-testid="battle-loop-opt-10"]') as HTMLButtonElement).click();
    });
    act(() => {
      (popover!.querySelector('[data-testid="battle-loop-start"]') as HTMLButtonElement).click();
    });

    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.limit).toBe(10);

    // Simulate 1 completed run -> active chip shows "2/10" with Stop square
    act(() => {
      const cur = useGameStore.getState().autoRepeatSession!;
      useGameStore.setState({
        autoRepeatSession: { ...cur, completedRuns: 1 },
      });
    });

    const activeChip = container!.querySelector(
      '[data-testid="battle-loop-active-chip"]'
    ) as HTMLButtonElement;
    expect(activeChip).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="battle-loop-progress"]')?.textContent
    ).toBe('2/10');
    expect(
      container!.querySelector('[data-testid="battle-loop-stop"]')
    ).not.toBeNull();

    // Tapping Stop stops the loop immediately without ending the current battle
    act(() => {
      activeChip.click();
    });
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(false);
    expect(useGameStore.getState().battle?.summary).toBeNull();

    // Open "..." menu -> zero loop controls inside, and Surrender requires confirmation
    const moreBtn = container!.querySelector(
      '[data-testid="battle-more-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      moreBtn.click();
    });

    const moreMenu = container!.querySelector('[data-testid="battle-more-menu"]');
    expect(moreMenu).not.toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-repeat-select"]')).toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-repeat-start"]')).toBeNull();
    expect(moreMenu!.querySelector('[data-testid="battle-more-repeat-stop"]')).toBeNull();

    // Clicking Surrender opens confirm step instead of immediately ending battle
    const retreatBtn = moreMenu!.querySelector(
      '[data-testid="battle-more-retreat"]'
    ) as HTMLButtonElement;
    act(() => {
      retreatBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="battle-retreat-confirm-box"]')
    ).not.toBeNull();
    expect(useGameStore.getState().battle?.summary).toBeNull();
  });

  it('shows icon + number only (no text label) for Loop button on phone portrait and keeps active chip visible', () => {
    setViewport(390, 844);
    const units = [
      makeUnit('p1', 'Sora', 'ally', 'front', { isPlayer: true }),
      makeUnit('e1', 'Viper', 'enemy', 'front'),
    ];
    useGameStore.setState({
      screen: 'BATTLE',
      battle: makeBattle(units),
      autoRepeatLimit: 20,
      autoRepeatSession: null,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const phoneControls = container!.querySelector(
      '[data-testid="battle-phone-controls"]'
    );
    expect(phoneControls).not.toBeNull();

    const loopBtn = phoneControls!.querySelector(
      '[data-testid="battle-loop-btn"]'
    ) as HTMLButtonElement;
    expect(loopBtn).not.toBeNull();
    expect(loopBtn.querySelector('[data-testid="battle-loop-label"]')).toBeNull();
    expect(
      loopBtn.querySelector('[data-testid="battle-loop-phone-count"]')?.textContent
    ).toBe('20');
    expect(loopBtn.textContent?.trim()).toBe('20');
  });

  it('renders sidebar TurnQueueBar with "Next" label + vertical 1..5 list and keeps phone TurnQueueBar strictly self-scrollable without clipping leftmost chip', () => {
    const units = [
      makeUnit('p1', 'Sora', 'ally', 'front', {
        isPlayer: true,
        derived: { ...makeUnit('t', 't', 'ally', 'front').derived, speed: 210 },
      }),
      makeUnit('a2', 'Kira', 'ally', 'middle', {
        derived: { ...makeUnit('t', 't', 'ally', 'front').derived, speed: 195 },
      }),
      makeUnit('a3', 'Orion', 'ally', 'back', {
        derived: { ...makeUnit('t', 't', 'ally', 'front').derived, speed: 180 },
      }),
      makeUnit('e1', 'Viper', 'enemy', 'front', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 170 },
      }),
      makeUnit('e2', 'Titan', 'enemy', 'front', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 160 },
      }),
      makeUnit('e3', 'Spectre', 'enemy', 'middle', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 150 },
      }),
      makeUnit('e4', 'Phantom', 'enemy', 'back', {
        derived: { ...makeUnit('t', 't', 'enemy', 'front').derived, speed: 140 },
      }),
    ];
    const battle = makeBattle(units, 0);

    // 1) Sidebar variant
    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
          targetName: 'Viper',
        })
      );
    });

    const nextLabel = container!.querySelector(
      '[data-testid="turn-queue-next-label"]'
    );
    expect(nextLabel?.textContent).toBe('Next');

    const upcomingList = container!.querySelector(
      '[data-testid="turn-queue-upcoming-list"]'
    );
    expect(upcomingList).not.toBeNull();
    expect(upcomingList!.className).toContain('flex-col');
    expect(upcomingList!.className).toContain('overflow-y-auto');
    expect(upcomingList!.getAttribute('data-fixed-rows')).toBe('5');

    const rows = Array.from(
      container!.querySelectorAll('[data-testid="turn-queue-sidebar-chip"]')
    );
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(
      rows
        .slice(0, 5)
        .map(
          (r) => r.querySelector('[data-testid="turn-queue-order-num"]')?.textContent
        )
    ).toEqual(['1', '2', '3', '4', '5']);
    for (const row of rows) {
      expect(row.querySelector('[data-team-shape]')).toBeNull();
      expect(row.querySelector('[data-testid="level-badge"]')).not.toBeNull();
    }
    expect(
      container!.querySelector('[data-testid="turn-queue-overflow"]')?.textContent
    ).toContain('+8');

    // 2) Phone narrow-width strip variant
    act(() => {
      root!.render(
        createElement(
          'div',
          { style: { width: '360px', overflow: 'hidden' } },
          createElement(TurnQueueBar, {
            battle,
            battleSpeed: 1,
            skipAnimations: false,
            enrageBonusPct: 0,
            variant: 'phone',
            targetName: 'Viper',
          })
        )
      );
    });

    const strip = container!.querySelector(
      '[data-testid="turn-queue-phone-strip"]'
    ) as HTMLElement;
    const track = container!.querySelector(
      '[data-testid="turn-queue-phone-track"]'
    ) as HTMLElement;
    const actingChip = container!.querySelector(
      '[data-testid="turn-queue-acting-chip"]'
    ) as HTMLElement;

    expect(strip.className).toContain('overflow-hidden');
    expect(strip.className).toContain('max-w-full');
    expect(track.className).toContain('overflow-x-auto');
    expect(track.className).toContain('justify-start');
    expect(track.className).toContain('min-w-0');
    expect(actingChip.className).toContain('shrink-0');
    expect(actingChip.className).toContain('whitespace-nowrap');
    expect(
      actingChip.querySelector('[data-testid="turn-queue-acting-name"]')?.textContent
    ).toBe('Sora > Viper');
  });
});
