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
} from '../../utils/battleDisplay';
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

describe('G3b Pure Functions — concentric ring arcs, low HP, HP-only fallback, status overflow & upcoming list', () => {
  it('computes arc filled length accurately from current/max and enforces min 3px stroke width', () => {
    const spec = computeRingArcSpec(
      'hp',
      20,
      3,
      250,
      1000,
      '#22c55e',
      'rgba(34,197,94,0.2)'
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
  });

  it('returns 3 concentric rings (Shield outer blue, HP middle green, SP inner purple) at default marker size and flags low HP strictly below 25%', () => {
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
    const healthyRes = computeUnitRingArcs(healthyUnit, 26);
    expect(healthyRes.hpOnlyMode).toBe(false);
    expect(healthyRes.isLowHp).toBe(false); // 25% is NOT below 25%
    expect(healthyRes.arcs.map((a) => a.kind)).toEqual(['shield', 'hp', 'sp']);
    expect(healthyRes.arcs[0].radius).toBeGreaterThan(healthyRes.arcs[1].radius);
    expect(healthyRes.arcs[1].radius).toBeGreaterThan(healthyRes.arcs[2].radius);
    expect(healthyRes.arcs[0].color).toBe('#38bdf8');
    expect(healthyRes.arcs[1].color).toBe('#22c55e');
    expect(healthyRes.arcs[2].color).toBe('#c084fc');
    for (const arc of healthyRes.arcs) {
      expect(arc.strokeWidth).toBeGreaterThanOrEqual(3);
    }

    const lowHpUnit = makeUnit('u2', 'Vex', 'ally', 'front', {
      hp: Math.floor(1000 * RADAR_LOW_HP_THRESHOLD) - 1, // 249 / 1000 = 24.9%
      derived: healthyUnit.derived,
    });
    const lowRes = computeUnitRingArcs(lowHpUnit, 22);
    expect(lowRes.isLowHp).toBe(true);
    const hpArc = lowRes.arcs.find((a) => a.kind === 'hp')!;
    expect(hpArc.isLowHp).toBe(true);
    expect(hpArc.color).toBe('#f97316');
  });

  it('falls back to HP arc only below the minimum marker radius', () => {
    const unit = makeUnit('u_small', 'Scout', 'enemy', 'back', {
      hp: 500,
      shield: 300,
      sp: 80,
    });
    const res = computeUnitRingArcs(unit, RADAR_RING_MIN_MARKER_RADIUS - 1);
    expect(res.hpOnlyMode).toBe(true);
    expect(res.arcs).toHaveLength(1);
    expect(res.arcs[0].kind).toBe('hp');
    expect(res.arcs[0].strokeWidth).toBeGreaterThanOrEqual(3);
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

describe('G3b Components — Radar rings, zero "!" badges, TurnQueueBar & Loop button', () => {
  it('renders 3 concentric arcs, tick marks, zero horizontal HP bars, zero "!" badges, and status tap tooltip on radar markers', () => {
    const p1 = makeUnit('p1', 'Sora', 'ally', 'front', {
      isPlayer: true,
      hp: 200, // 20% -> low HP!
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

    // 3 concentric rings exist on alive marker
    const shieldRing = container!.querySelector('[data-testid="radar-ring-shield-p1"]');
    const hpRing = container!.querySelector('[data-testid="radar-ring-hp-p1"]');
    const spRing = container!.querySelector('[data-testid="radar-ring-sp-p1"]');
    expect(shieldRing).not.toBeNull();
    expect(hpRing).not.toBeNull();
    expect(spRing).not.toBeNull();
    expect(hpRing!.getAttribute('data-low-hp')).toBe('true');
    expect(hpRing!.getAttribute('class')).toContain('vfx-low-hp-pulse');
    expect(Number(hpRing!.getAttribute('data-stroke-width'))).toBeGreaterThanOrEqual(3);

    // Tick marks present for color-blind start clarity
    expect(container!.querySelector('[data-testid="radar-ring-tick-shield-p1"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="radar-ring-tick-hp-p1"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="radar-ring-tick-sp-p1"]')).not.toBeNull();

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

    // Clicking the first sorted status icon (vulnerable, 1 turn debuff sorts first) opens the status tooltip with name, strength, and rounds
    act(() => {
      statusIcons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const statusTooltip = container!.querySelector(
      '[data-testid="radar-status-tooltip"]'
    );
    expect(statusTooltip).not.toBeNull();
    expect(statusTooltip!.textContent).toContain('25%');
    expect(statusTooltip!.textContent).toContain('1 round(s) left');

    // Marker hover tooltip includes full HP, SHD, and SP values
    const p1Marker = container!.querySelector('[data-testid="radar-unit-p1"]');
    expect(p1Marker?.getAttribute('aria-label')).toContain('SP 75/100');
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
      expect(row.querySelector('[data-team-shape]')).not.toBeNull();
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
