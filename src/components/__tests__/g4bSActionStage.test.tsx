// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleState,
  CombatFxEvent,
  CombatLogEntry,
  CombatRow,
  CombatUnit,
  FloatingPopup,
} from '../../types/game';
import {
  ACTION_STAGE_STORAGE_KEY,
  readActionStageEnabled,
  writeActionStageEnabled,
} from '../../utils/actionStagePrefs';
import {
  getTurnQueueSidebarRowCount,
  getTurnQueueSidebarTotalHeightPx,
  SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX,
} from '../../utils/battleDisplay';
import {
  FX_SETTINGS_STORAGE_KEY,
  resolveEffectiveVfxConfig,
  updateFxSettings,
} from '../../utils/battleVfx';
import { STAGE_HIT_FLASH_COLORS } from '../../utils/fxTone';
import { ActionStage, StageProjectile, StageToken } from '../ActionStage';
import { BattleScreen } from '../BattleScreen';
import { EffectsSettingsPanel } from '../EffectsSettingsPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
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
  const maxHp = opts.derived?.maxHp ?? 600;
  return {
    id,
    name,
    callsign: opts.callsign ?? name,
    side,
    row,
    formationCol: opts.formationCol ?? 0,
    isPlayer: Boolean(opts.isPlayer),
    classId: opts.classId ?? (side === 'ally' ? 'striker' : 'interceptor'),
    archetype: opts.archetype,
    isBoss: opts.isBoss ?? false,
    level: opts.level ?? 10,
    skillLevel: opts.skillLevel ?? 1,
    skillLevels: opts.skillLevels ?? { gen_hull_brace: 1 },
    equippedSkillIds: opts.equippedSkillIds ?? ['gen_hull_brace'],
    skillCooldowns: opts.skillCooldowns ?? {},
    usedOnceSkills: opts.usedOnceSkills ?? [],
    stats: opts.stats ?? { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 200,
      maxSp: 100,
      speed: 110,
      attackPower: 90,
      defenseRating: 60,
      dodgeChance: 12,
      critChance: 20,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
      ...(opts.derived ?? {}),
    },
    alive: opts.alive ?? true,
    hp: opts.hp ?? maxHp,
    shield: opts.shield ?? 200,
    sp: opts.sp ?? 60,
    isDefending: opts.isDefending ?? false,
    statuses: opts.statuses ?? [],
    animState: opts.animState ?? 'idle',
    isStructure: opts.isStructure,
  };
}

function makeBattle(
  units: CombatUnit[],
  overrides: Partial<BattleState> = {}
): BattleState {
  const firstEnemy = units.find((u) => u.side === 'enemy' && u.alive);
  return {
    sectorId: overrides.sectorId ?? 'sector_1',
    deployedGearId: 'striker',
    squadSize: 4,
    units,
    turnOrder: overrides.turnOrder ?? units.map((u) => u.id),
    activeTurnIndex: overrides.activeTurnIndex ?? 0,
    round: overrides.round ?? 1,
    turnCounter: overrides.turnCounter ?? 1,
    selectedTargetId: firstEnemy?.id ?? null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: firstEnemy?.id ?? null,
    autoStopNotice: null,
    wingmanChat: null,
    log: overrides.log ?? [],
    events: overrides.events ?? [],
    roundSnapshots: [],
    popups: overrides.popups ?? [],
    fxEvents: overrides.fxEvents ?? [],
    explodedUnitIds: [],
    isResolving: false,
    summary: overrides.summary ?? null,
    ...overrides,
  };
}

function makeDamageLogEntry(
  id: string,
  actorName: string,
  targetName: string,
  skillId?: string
): CombatLogEntry {
  return {
    id,
    round: 1,
    actorName,
    tag: skillId ? 'SKILL' : 'ATTACK',
    templateKey: 'log.damage',
    params: {
      actor: actorName,
      target: targetName,
      dmg: 250,
      ...(skillId ? { skillId } : {}),
    },
  };
}

describe('TASK G4b-S — Card mode Action Stage ("Sân khấu hành động")', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState({
      battleSpeed: 1,
      skipAnimations: false,
      autoBattleEnabled: false,
    });
    updateFxSettings({ effectsMode: 'full', reducedMotionMode: 'off' });
    writeActionStageEnabled(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
    window.localStorage.clear();
  });

  it('1) Stage renders nothing (0px / no wrapper) when OFF, in radar mode, or when battle.summary is set', () => {
    setViewport(1440, 900);
    const ally = makeUnit('a1', 'Striker Alpha', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Drone X', 'enemy', 'front');
    const battle = makeBattle([ally, enemy]);

    // Case A: setting OFF in card mode
    writeActionStageEnabled(false);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    expect(container!.querySelector('[data-testid="action-stage"]')).toBeNull();

    // Case B: radar mode with setting ON
    act(() => {
      writeActionStageEnabled(true);
      useGameStore.setState({ battleViewMode: 'radar' });
    });
    expect(container!.querySelector('[data-testid="action-stage"]')).toBeNull();

    // Case C: battle.summary set in card mode with setting ON
    const summaryBattle = makeBattle([ally, enemy], {
      summary: {
        outcome: 'victory',
        deployedGearId: 'striker',
        sectorId: 'sector_1',
        rounds: 3,
        expGained: 100,
        creditsGained: 200,
        warPointsGained: 10,
        baseCaptureBonusWp: 0,
        leveledUp: false,
        previousLevel: 10,
        newLevel: 10,
        statPointsGained: 0,
        battlesToNextLevel: 3,
        unlockedSectorId: null,
        enemiesDestroyed: 1,
        totalEnemies: 1,
        alliesSurviving: 1,
        droppedItems: [],
      },
    });
    act(() => {
      useGameStore.setState({ battle: summaryBattle, battleViewMode: 'card' });
    });
    expect(container!.querySelector('[data-testid="action-stage"]')).toBeNull();
  });

  it('2) Idle state shows current actor > target from actingTargetName statically (no projectile/flash)', () => {
    setViewport(1440, 900);
    const ally = makeUnit('a1', 'Striker Alpha', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Viper Scout', 'enemy', 'front');
    const battle = makeBattle([ally, enemy]);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const stage = container!.querySelector('[data-testid="action-stage"]') as HTMLElement;
    expect(stage).not.toBeNull();
    expect(stage.dataset.stageState).toBe('idle');
    expect(stage.querySelector('[data-testid="action-stage-attacker"]')).not.toBeNull();
    expect(stage.querySelector('[data-testid="action-stage-target"]')).not.toBeNull();
    expect(stage.querySelector('[data-testid="action-stage-projectile"]')).toBeNull();
    expect(stage.querySelector('[data-testid="action-stage-hit-flash"]')).toBeNull();
    const caption = stage.querySelector('[data-testid="action-stage-caption"]') as HTMLElement;
    expect(caption.textContent).toContain('Striker Alpha > Viper Scout');
  });

  it('3) Latest fx replaces old immediately (max 1 lane/projectile), including at 10x speed', () => {
    setViewport(1440, 900);
    const ally = makeUnit('a1', 'Striker Alpha', 'ally', 'front', { isPlayer: true });
    const e1 = makeUnit('e1', 'Scout One', 'enemy', 'front');
    const e2 = makeUnit('e2', 'Scout Two', 'enemy', 'middle');

    const fx1: CombatFxEvent = {
      id: 'fx-1',
      kind: 'laser',
      fromSide: 'ally',
      fromSlotIndex: 0,
      fromUnitId: 'a1',
      toSide: 'enemy',
      toSlotIndices: [0],
      toUnitIds: ['e1'],
      accentHex: '#38bdf8',
    };
    const fx2: CombatFxEvent = {
      id: 'fx-2',
      kind: 'railgun',
      fromSide: 'ally',
      fromSlotIndex: 0,
      fromUnitId: 'a1',
      toSide: 'enemy',
      toSlotIndices: [1],
      toUnitIds: ['e2'],
      accentHex: '#38bdf8',
    };

    const battle1 = makeBattle([ally, e1, e2], {
      fxEvents: [fx1, fx2],
      popups: [{ id: 'p2', unitId: 'e2', text: '-320', tone: 'damage' }],
      log: [makeDamageLogEntry('l2', 'Striker Alpha', 'Scout Two', 'str_piercing_salvo')],
    });
    useGameStore.setState({ screen: 'BATTLE', battle: battle1, battleViewMode: 'card', battleSpeed: 1 });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const stage = container!.querySelector('[data-testid="action-stage"]') as HTMLElement;
    expect(stage.dataset.fxId).toBe('fx-2');
    expect(stage.querySelectorAll('[data-testid="action-stage-fx-lane"]')).toHaveLength(1);
    expect(stage.querySelectorAll('[data-testid="action-stage-projectile"]')).toHaveLength(1);
    expect(stage.querySelector('[data-testid="action-stage-result"]')?.textContent).toBe('-320');
    expect(stage.querySelector('[data-testid="action-stage-caption"]')?.textContent).toContain(
      'Striker Alpha'
    );

    // Push fx-3 at 10x speed: replaces fx-2 immediately, max 1 lane
    const fx3: CombatFxEvent = {
      id: 'fx-3',
      kind: 'laser',
      fromSide: 'enemy',
      fromSlotIndex: 0,
      fromUnitId: 'e1',
      toSide: 'ally',
      toSlotIndices: [0],
      toUnitIds: ['a1'],
      accentHex: '#f97316',
    };
    const battle2 = makeBattle([ally, e1, e2], {
      fxEvents: [fx1, fx2, fx3],
      popups: [{ id: 'p3', unitId: 'a1', text: 'EVADED', tone: 'evade' }],
      log: [makeDamageLogEntry('l3', 'Scout One', 'Striker Alpha')],
    });
    act(() => {
      useGameStore.setState({ battle: battle2, battleSpeed: 10 });
    });

    const updatedStage = container!.querySelector('[data-testid="action-stage"]') as HTMLElement;
    expect(updatedStage.dataset.fxId).toBe('fx-3');
    expect(updatedStage.querySelectorAll('[data-testid="action-stage-fx-lane"]')).toHaveLength(1);
    expect(updatedStage.querySelector('[data-testid="action-stage-projectile"]')).toBeNull();
    expect(updatedStage.querySelector('[data-testid="action-stage-result"]')?.textContent).toBe(
      'EVADED'
    );
  });

  it('4) Speed >= 5 & showProjectiles=false hide projectile while keeping flash+text; reducedMotion uses reduced marker; effectsMode=off uses static tokens', () => {
    const ally = makeUnit('a1', 'Striker Alpha', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Drone X', 'enemy', 'front');
    const fx: CombatFxEvent = {
      id: 'fx-s5',
      kind: 'laser',
      fromSide: 'ally',
      fromSlotIndex: 0,
      fromUnitId: 'a1',
      toSide: 'enemy',
      toSlotIndices: [0],
      toUnitIds: ['e1'],
      accentHex: '#38bdf8',
    };
    const battle = makeBattle([ally, enemy], {
      fxEvents: [fx],
      popups: [{ id: 'p1', unitId: 'e1', text: 'CRIT -278', tone: 'crit' }],
    });

    // Speed 5 -> flash + text, no projectile
    act(() => {
      root!.render(
        createElement(ActionStage, {
          battle,
          activeUnit: ally,
          actingTargetName: 'Drone X',
          battleSpeed: 5,
          vfxConfig: resolveEffectiveVfxConfig('full', 5, false, false),
          enabled: true,
          viewMode: 'card',
          variant: 'desktop',
        })
      );
    });
    expect(container!.querySelector('[data-testid="action-stage-projectile"]')).toBeNull();
    expect(container!.querySelector('[data-testid="action-stage-hit-flash"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="action-stage-result"]')?.textContent).toBe(
      'CRIT -278'
    );

    // showProjectiles: false at speed 1 -> no projectile, keeps flash + text
    act(() => {
      root!.render(
        createElement(ActionStage, {
          battle,
          activeUnit: ally,
          actingTargetName: 'Drone X',
          battleSpeed: 1,
          vfxConfig: {
            ...resolveEffectiveVfxConfig('full', 1, false, false),
            showProjectiles: false,
          },
          enabled: true,
          viewMode: 'card',
          variant: 'desktop',
        })
      );
    });
    expect(container!.querySelector('[data-testid="action-stage-projectile"]')).toBeNull();
    expect(container!.querySelector('[data-testid="action-stage-hit-flash"]')).not.toBeNull();

    // reducedMotion: true -> existing reduced marker on projectile + hit flash
    act(() => {
      root!.render(
        createElement(ActionStage, {
          battle,
          activeUnit: ally,
          actingTargetName: 'Drone X',
          battleSpeed: 1,
          vfxConfig: resolveEffectiveVfxConfig('full', 1, true, false),
          enabled: true,
          viewMode: 'card',
          variant: 'desktop',
        })
      );
    });
    const proj = container!.querySelector('[data-testid="action-stage-projectile"]') as HTMLElement;
    expect(proj).not.toBeNull();
    expect(proj.dataset.reducedMarker).toBe('true');
    expect(proj.className).toContain('vfx-reduced-marker');
    expect(
      container!.querySelector('[data-testid="action-stage-hit-flash"]')?.className
    ).toContain('vfx-reduced-marker');

    // effectsMode: 'off' -> static tokens (no projectile, no hit flash)
    act(() => {
      root!.render(
        createElement(ActionStage, {
          battle,
          activeUnit: ally,
          actingTargetName: 'Drone X',
          battleSpeed: 1,
          vfxConfig: resolveEffectiveVfxConfig('off', 1, false, false),
          enabled: true,
          viewMode: 'card',
          variant: 'desktop',
        })
      );
    });
    expect(container!.querySelector('[data-testid="action-stage-attacker"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="action-stage-target"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="action-stage-projectile"]')).toBeNull();
    expect(container!.querySelector('[data-testid="action-stage-hit-flash"]')).toBeNull();
  });

  it('5) AoE with 5 targets renders at most 3 stacked target tokens + "+2" overflow pill', () => {
    const ally = makeUnit('a1', 'Siege One', 'ally', 'back', { isPlayer: true });
    const enemies = ['e1', 'e2', 'e3', 'e4', 'e5'].map((id, i) =>
      makeUnit(id, `Enemy ${i + 1}`, 'enemy', i < 3 ? 'front' : 'middle')
    );
    const fx: CombatFxEvent = {
      id: 'fx-aoe5',
      kind: 'missile',
      fromSide: 'ally',
      fromSlotIndex: 0,
      fromUnitId: 'a1',
      toSide: 'enemy',
      toSlotIndices: [0, 1, 2, 3, 4],
      toUnitIds: enemies.map((e) => e.id),
      accentHex: '#38bdf8',
    };
    const battle = makeBattle([ally, ...enemies], { fxEvents: [fx] });

    act(() => {
      root!.render(
        createElement(ActionStage, {
          battle,
          activeUnit: ally,
          actingTargetName: 'Enemy 1',
          battleSpeed: 1,
          vfxConfig: resolveEffectiveVfxConfig('full', 1, false, false),
          enabled: true,
          viewMode: 'card',
          variant: 'desktop',
        })
      );
    });

    expect(container!.querySelectorAll('[data-testid="action-stage-target"]')).toHaveLength(3);
    expect(
      container!.querySelector('[data-testid="action-stage-target-overflow"]')?.textContent
    ).toBe('+2');
  });

  it('6) Tone colors match damage (red), heal (green), shield (blue), sp (orange), buff (yellow)', () => {
    const ally = makeUnit('a1', 'Support', 'ally', 'middle', { isPlayer: true });
    const ally2 = makeUnit('a2', 'Striker', 'ally', 'front');
    const enemy = makeUnit('e1', 'Raider', 'enemy', 'front');

    const cases: Array<{
      fx: CombatFxEvent;
      expectedTone: keyof typeof STAGE_HIT_FLASH_COLORS;
    }> = [
      {
        expectedTone: 'damage',
        fx: {
          id: 't-dmg',
          kind: 'laser',
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'a1',
          toSide: 'enemy',
          toSlotIndices: [0],
          toUnitIds: ['e1'],
          accentHex: '#38bdf8',
        },
      },
      {
        expectedTone: 'heal',
        fx: {
          id: 't-heal',
          kind: 'heal',
          tone: 'heal',
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'a1',
          toSide: 'ally',
          toSlotIndices: [1],
          toUnitIds: ['a2'],
          accentHex: '#22c55e',
        },
      },
      {
        expectedTone: 'shield',
        fx: {
          id: 't-shield',
          kind: 'heal',
          tone: 'shield',
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'a1',
          toSide: 'ally',
          toSlotIndices: [1],
          toUnitIds: ['a2'],
          accentHex: '#38bdf8',
        },
      },
      {
        expectedTone: 'sp',
        fx: {
          id: 't-sp',
          kind: 'heal',
          tone: 'sp',
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'a1',
          toSide: 'ally',
          toSlotIndices: [1],
          toUnitIds: ['a2'],
          accentHex: '#f59e0b',
        },
      },
      {
        expectedTone: 'buff',
        fx: {
          id: 't-buff',
          kind: 'heal',
          tone: 'buff',
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'a1',
          toSide: 'ally',
          toSlotIndices: [1],
          toUnitIds: ['a2'],
          accentHex: '#facc15',
        },
      },
    ];

    for (const c of cases) {
      const battle = makeBattle([ally, ally2, enemy], { fxEvents: [c.fx] });
      act(() => {
        root!.render(
          createElement(ActionStage, {
            battle,
            activeUnit: ally,
            actingTargetName: 'Raider',
            battleSpeed: 1,
            vfxConfig: resolveEffectiveVfxConfig('full', 1, false, false),
            enabled: true,
            viewMode: 'card',
            variant: 'desktop',
          })
        );
      });
      const stage = container!.querySelector('[data-testid="action-stage"]') as HTMLElement;
      expect(stage.dataset.fxTone).toBe(c.expectedTone);
      const hitFlash = container!.querySelector(
        '[data-testid="action-stage-hit-flash"]'
      ) as HTMLElement;
      expect(hitFlash).not.toBeNull();
      expect(hitFlash.dataset.flashColor).toBe(STAGE_HIT_FLASH_COLORS[c.expectedTone]);
    }
  });

  it('7) Desktop card mode hides TurnQueueBar acting row and keeps sidebar log >= 220px at 1440x900; radar mode keeps acting row', () => {
    setViewport(1440, 900);
    const units = [
      makeUnit('a1', 'Ally 1', 'ally', 'front', { isPlayer: true }),
      makeUnit('a2', 'Ally 2', 'ally', 'middle'),
      makeUnit('a3', 'Ally 3', 'ally', 'back'),
      makeUnit('e1', 'Enemy 1', 'enemy', 'front'),
      makeUnit('e2', 'Enemy 2', 'enemy', 'middle'),
      makeUnit('e3', 'Enemy 3', 'enemy', 'back'),
    ];
    const battle = makeBattle(units);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const sidebarQueue = container!.querySelector(
      '[data-testid="turn-queue-sidebar"]'
    ) as HTMLElement;
    expect(sidebarQueue).not.toBeNull();
    expect(sidebarQueue.dataset.actingRowHidden).toBe('true');
    expect(sidebarQueue.querySelector('[data-testid="turn-queue-acting-chip"]')).toBeNull();
    expect(sidebarQueue.querySelector('[data-testid="turn-queue-acting-empty"]')).toBeNull();
    expect(
      container!.querySelector(
        '[data-testid="battle-right-sidebar"] [data-testid="action-stage"][data-stage-variant="desktop"]'
      )
    ).not.toBeNull();

    // Verify 1440x900 desktop sidebar budget arithmetic:
    // TopHud(48) + py-2(16) => sidebar height = 836px; 3 gaps * 8px = 24px
    const rows = getTurnQueueSidebarRowCount(units.length);
    const queueH = getTurnQueueSidebarTotalHeightPx(rows, true);
    const stageH = 84;
    const unitPanelH = SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX;
    const sidebarH = 900 - 48 - 16;
    const logRemainingH = sidebarH - (queueH + stageH + unitPanelH + 24);
    expect(logRemainingH).toBeGreaterThanOrEqual(220);

    // Switch to radar mode -> acting row returns, ActionStage disappears
    act(() => {
      useGameStore.setState({ battleViewMode: 'radar' });
    });
    const radarQueue = container!.querySelector(
      '[data-testid="turn-queue-sidebar"]'
    ) as HTMLElement;
    expect(radarQueue.dataset.actingRowHidden).toBe('false');
    expect(radarQueue.querySelector('[data-testid="turn-queue-acting-chip"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="action-stage"]')).toBeNull();
  });

  it('8) Phone card mode places 56px ActionStage strip directly between control row and force bar with no caption', () => {
    setViewport(390, 844);
    const ally = makeUnit('a1', 'Ally 1', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Enemy 1', 'enemy', 'front');
    const battle = makeBattle([ally, enemy]);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const controls = container!.querySelector('[data-testid="battle-phone-controls"]') as HTMLElement;
    const stage = container!.querySelector('[data-testid="action-stage"]') as HTMLElement;
    const forceBar = container!.querySelector('[data-testid="battle-force-ratio-bar"]') as HTMLElement;
    expect(controls).not.toBeNull();
    expect(stage).not.toBeNull();
    expect(forceBar).not.toBeNull();
    expect(stage.dataset.stageVariant).toBe('phone');
    expect(stage.className).toContain('h-[56px]');
    expect(stage.querySelector('[data-testid="action-stage-caption"]')).toBeNull();
    expect(controls.nextElementSibling).toBe(stage);
    expect(stage.nextElementSibling).toBe(forceBar);
  });

  it('9) Stage ON: attacker card glows, target card border flashes in tone color, and card popups are hidden; Stage OFF: card popups show and glow/flash absent', () => {
    setViewport(1440, 900);
    const ally = makeUnit('a1', 'Striker', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Drone', 'enemy', 'front');
    const fx: CombatFxEvent = {
      id: 'fx-card-1',
      kind: 'laser',
      fromSide: 'ally',
      fromSlotIndex: 0,
      fromUnitId: 'a1',
      toSide: 'enemy',
      toSlotIndices: [0],
      toUnitIds: ['e1'],
      accentHex: '#38bdf8',
    };
    const popups: FloatingPopup[] = [
      { id: 'pop-1', unitId: 'e1', text: '-185', tone: 'damage' },
    ];
    const battle = makeBattle([ally, enemy], { fxEvents: [fx], popups });
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });

    // Stage ON
    writeActionStageEnabled(true);
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const attackerFx = container!.querySelector(
      '[data-testid="card-stage-fx-attacker-a1"]'
    ) as HTMLElement;
    const targetFx = container!.querySelector(
      '[data-testid="card-stage-fx-target-e1"]'
    ) as HTMLElement;
    expect(attackerFx).not.toBeNull();
    expect(attackerFx.className).toContain('anim-stage-card-glow');
    expect(attackerFx.dataset.fxId).toBe('fx-card-1');

    expect(targetFx).not.toBeNull();
    expect(targetFx.className).toContain('anim-stage-card-flash');
    expect(targetFx.dataset.fxId).toBe('fx-card-1');
    expect(targetFx.dataset.fxToneColor).toBe(STAGE_HIT_FLASH_COLORS.damage);

    // Card floating popups hidden while ActionStage is ON
    expect(container!.querySelector('[data-testid="card-popups-container-e1"]')).toBeNull();
    expect(container!.querySelector('[data-testid="damage-popup"]')).toBeNull();

    // Stage OFF -> G4b inside-card popups restored, glow/flash absent
    act(() => {
      writeActionStageEnabled(false);
    });
    expect(container!.querySelector('[data-testid="card-stage-fx-attacker-a1"]')).toBeNull();
    expect(container!.querySelector('[data-testid="card-stage-fx-target-e1"]')).toBeNull();
    expect(container!.querySelector('[data-testid="card-popups-container-e1"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="damage-popup"]')?.textContent).toBe('-185');
  });

  it('10) EffectsSettingsPanel reuses StageToken/StageProjectile with old preview testids and persists Action Stage toggle', () => {
    act(() => {
      root!.render(createElement(EffectsSettingsPanel));
    });

    // Shared StageToken & StageProjectile exports exist and render properly
    expect(typeof StageToken).toBe('function');
    expect(typeof StageProjectile).toBe('function');

    const previewBox = container!.querySelector('[data-testid="effects-preview-box"]');
    expect(previewBox).not.toBeNull();
    expect(previewBox!.textContent).toContain('A1');
    expect(previewBox!.textContent).toContain('E1');

    const testBtn = container!.querySelector('[data-testid="effects-test-btn"]') as HTMLButtonElement;
    act(() => {
      testBtn.click();
    });

    expect(container!.querySelector('[data-testid="effects-preview-stage"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="preview-fx-projectile"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="preview-fx-hit"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="preview-fx-damage"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="preview-fx-heal"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="preview-fx-buff"]')).not.toBeNull();

    // Toggle Action Stage setting -> persists to dreamAce.actionStage.v1
    const toggleBtn = container!.querySelector(
      '[data-testid="battle-toggle-action-stage"]'
    ) as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
    expect(readActionStageEnabled()).toBe(true);

    act(() => {
      toggleBtn.click();
    });
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');
    expect(readActionStageEnabled()).toBe(false);
    expect(window.localStorage.getItem(ACTION_STAGE_STORAGE_KEY)).toBe('false');
  });

  it('11) vi/en i18n parity for new Action Stage strings', () => {
    const keys = [
      'fx.actionStageLabel',
      'fx.actionStageOn',
      'fx.actionStageOff',
      'actionStage.title',
      'actionStage.usedAction',
    ] as const;

    for (const k of keys) {
      expect(typeof VI_TRANSLATIONS[k]).toBe('string');
      expect(VI_TRANSLATIONS[k].trim().length).toBeGreaterThan(0);
      expect(typeof EN_TRANSLATIONS[k]).toBe('string');
      expect(EN_TRANSLATIONS[k].trim().length).toBeGreaterThan(0);
    }
    expect(FX_SETTINGS_STORAGE_KEY).toBeTruthy();
  });
});
