// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActiveStatusEffect,
  BattleEvent,
  BattleState,
  CombatLogEntry,
  CombatRow,
  CombatUnit,
} from '../../types/game';
import {
  DOCKED_LOG_MAX_ENTRIES,
  POPUP_LOG_PAGE_SIZE,
  SHOW_STATUS_LABELS_STORAGE_KEY,
  buildLiveBattleProgress,
  filterCombatLogEntries,
  parseStructuredCombatLogRow,
  readCombatLogMode,
  readShowStatusLabels,
} from '../../utils/combatLogFormat';
import { aggregateBattleStats } from '../../engine/battleStats';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { BattleStatsModal } from '../BattleStatsModal';
import { BattleUnitCard } from '../BattleUnitCard';
import { CombatLogList } from '../CombatLogList';
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
    animState: opts.animState ?? 'idle',
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
  };
}

function makeBattle(overrides: Partial<BattleState> = {}): BattleState {
  const statusesBuff: ActiveStatusEffect[] = [
    { type: 'atk_up', turnsRemaining: 2, magnitude: 0.3 },
    { type: 'eva_up', turnsRemaining: 2, magnitude: 0.2 },
  ];
  const statusesDebuff: ActiveStatusEffect[] = [
    { type: 'burn', turnsRemaining: 2, magnitude: 55, isDebuff: true },
  ];

  const units: CombatUnit[] = [
    makeUnit('player_1', 'Vanguard One', 'ally', 'front', {
      isPlayer: true,
      classId: 'striker',
      hp: 820,
      shield: 260,
      statuses: statusesBuff,
    }),
    makeUnit('ally_2', 'Medic Echo', 'ally', 'back', {
      classId: 'support',
      hp: 950,
      shield: 380,
    }),
    makeUnit('enemy_1', 'Raider Alpha', 'enemy', 'front', {
      classId: 'siege',
      hp: 400,
      shield: 0,
      statuses: statusesDebuff,
    }),
    makeUnit('enemy_2', 'Sniper Beta', 'enemy', 'back', {
      classId: 'interceptor',
      hp: 0,
      shield: 0,
      alive: false,
    }),
  ];

  const defaultLog: CombatLogEntry[] = [
    {
      id: 'log_start',
      round: 1,
      actorName: 'SYSTEM',
      tag: 'SYSTEM',
      templateKey: 'log.battleStart',
      params: { sectorId: 'sector_1', squadSize: 4, count: 4 },
    },
    {
      id: 'log_atk',
      round: 1,
      actorName: 'Vanguard One',
      actorSide: 'ally',
      actorIsPlayer: true,
      tag: 'ATTACK',
      templateKey: 'log.damage',
      params: {
        actor: 'Vanguard One',
        target: 'Raider Alpha',
        action: 'basic',
        damage: 245,
        shieldDmg: 100,
        hpDmg: 145,
      },
    },
    {
      id: 'log_heal',
      round: 1,
      actorName: 'Medic Echo',
      actorSide: 'ally',
      tag: 'HEAL',
      templateKey: 'log.healSingle',
      params: {
        actor: 'Medic Echo',
        target: 'Vanguard One',
        skillId: 'repair_beam',
        amount: 180,
      },
    },
    {
      id: 'log_enemy_skill',
      round: 2,
      actorName: 'Raider Alpha',
      actorSide: 'enemy',
      tag: 'SKILL',
      templateKey: 'log.damage',
      params: {
        actor: 'Raider Alpha',
        target: 'Vanguard One',
        action: 'skill',
        skillId: 'burst_missile',
        damage: 190,
        shieldDmg: 190,
        hpDmg: 0,
      },
    },
    {
      id: 'log_kill',
      round: 2,
      actorName: 'Vanguard One',
      actorSide: 'ally',
      actorIsPlayer: true,
      tag: 'KO',
      templateKey: 'log.destroyed',
      params: {
        actor: 'Vanguard One',
        target: 'Sniper Beta',
        classId: 'interceptor',
      },
    },
  ];

  const defaultEvents: BattleEvent[] = [
    {
      id: 'ev_1',
      round: 1,
      turn: 1,
      type: 'damage',
      actorId: 'player_1',
      targetId: 'enemy_1',
      skillId: 'basic_attack',
      amount: 245,
      hpDamage: 145,
      shieldAbsorbed: 100,
    },
    {
      id: 'ev_2',
      round: 1,
      turn: 2,
      type: 'heal',
      actorId: 'ally_2',
      targetId: 'player_1',
      skillId: 'repair_beam',
      amount: 180,
    },
    {
      id: 'ev_3',
      round: 2,
      turn: 3,
      type: 'damage',
      actorId: 'enemy_1',
      targetId: 'player_1',
      skillId: 'burst_missile',
      amount: 190,
      hpDamage: 0,
      shieldAbsorbed: 190,
    },
    {
      id: 'ev_4',
      round: 2,
      turn: 4,
      type: 'damage',
      actorId: 'player_1',
      targetId: 'enemy_2',
      skillId: 'basic_attack',
      amount: 320,
      hpDamage: 320,
      shieldAbsorbed: 0,
    },
    {
      id: 'ev_5',
      round: 2,
      turn: 4,
      type: 'kill',
      actorId: 'player_1',
      targetId: 'enemy_2',
    },
  ];

  return {
    sectorId: 'sector_1',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 2,
    turnCounter: 4,
    turnOrder: units.map((u) => u.id),
    activeTurnIndex: 0,
    units,
    selectedTargetId: 'enemy_1',
    selectedAllyTargetId: 'player_1',
    lastPlayerTargetId: 'enemy_1',
    log: defaultLog,
    events: defaultEvents,
    popups: [],
    fxEvents: [],
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
    autoStopNotice: null,
    roundSnapshots: [
      {
        round: 0,
        allyHp: 2000,
        allyMaxHp: 2000,
        allyHpPct: 100,
        enemyHp: 2000,
        enemyMaxHp: 2000,
        enemyHpPct: 100,
      },
      {
        round: 1,
        allyHp: 1840,
        allyMaxHp: 2000,
        allyHpPct: 92,
        enemyHp: 1360,
        enemyMaxHp: 2000,
        enemyHpPct: 68,
      },
      {
        round: 2,
        allyHp: 1770,
        allyMaxHp: 2000,
        allyHpPct: 88,
        enemyHp: 400,
        enemyMaxHp: 2000,
        enemyHpPct: 20,
      },
    ],
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const initialStoreState = useGameStore.getState();

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({
    ...initialStoreState,
    language: 'vi',
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setViewport(1280, 800);
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
  vi.useRealTimers();
});

describe('G3c-1: Structured Combat Log rows, action icons, channels & modes', () => {
  it('parses all 9 action kinds with correct faction and value tones', () => {
    const entries: CombatLogEntry[] = [
      {
        id: 'e1',
        round: 1,
        actorName: 'Alpha',
        actorSide: 'ally',
        tag: 'ATTACK',
        templateKey: 'log.damage',
        params: {
          actor: 'Alpha',
          target: 'Hostile',
          action: 'basic',
          damage: 120,
          shieldDmg: 20,
          hpDmg: 100,
        },
      },
      {
        id: 'e2',
        round: 1,
        actorName: 'Hostile',
        actorSide: 'enemy',
        tag: 'SKILL',
        templateKey: 'log.damage',
        params: {
          actor: 'Hostile',
          target: 'Alpha',
          action: 'skill',
          skillId: 'burst_missile',
          damage: 210,
          shieldDmg: 50,
          hpDmg: 160,
        },
      },
      {
        id: 'e3',
        round: 1,
        actorName: 'Medic',
        actorSide: 'ally',
        tag: 'HEAL',
        templateKey: 'log.healSingle',
        params: {
          actor: 'Medic',
          target: 'Alpha',
          skillId: 'repair_beam',
          amount: 150,
        },
      },
      {
        id: 'e4',
        round: 1,
        actorName: 'Alpha',
        actorSide: 'ally',
        tag: 'DEFEND',
        templateKey: 'log.defend',
        params: { actor: 'Alpha', shieldRestored: 90 },
      },
      {
        id: 'e5',
        round: 1,
        actorName: 'Alpha',
        actorSide: 'ally',
        tag: 'SKILL',
        templateKey: 'log.buffApplied',
        params: { actor: 'Alpha', skillId: 'overclock', spCost: 20 },
      },
      {
        id: 'e6',
        round: 1,
        actorName: 'Hostile',
        actorSide: 'enemy',
        tag: 'STATUS',
        templateKey: 'log.statusApplied',
        params: { target: 'Alpha', status: 'burn', turns: 2 },
      },
      {
        id: 'e7',
        round: 1,
        actorName: 'Alpha',
        actorSide: 'ally',
        tag: 'KO',
        templateKey: 'log.destroyed',
        params: { actor: 'Alpha', target: 'Hostile', classId: 'striker' },
      },
      {
        id: 'e8',
        round: 1,
        actorName: 'Alpha',
        actorSide: 'ally',
        tag: 'SYSTEM',
        templateKey: 'log.unitMovesRow',
        params: { actor: 'Alpha', row: 'front' },
      },
      {
        id: 'e9',
        round: 1,
        actorName: 'SYSTEM',
        tag: 'SYSTEM',
        templateKey: 'log.battleStart',
        params: { sectorId: 'sector_1', squadSize: 4, count: 8 },
      },
    ];

    const rows = entries.map((e) => parseStructuredCombatLogRow('en', e));
    expect(rows.map((r) => r.actionKind)).toEqual([
      'attack',
      'skill',
      'heal',
      'shield',
      'buff',
      'debuff',
      'kill',
      'move-row',
      'system',
    ]);
    expect(rows[0].faction).toBe('ally');
    expect(rows[0].valueTone).toBe('damage');
    expect(rows[1].faction).toBe('enemy');
    expect(rows[1].valueTone).toBe('damage');
    expect(rows[2].valueTone).toBe('heal');
    expect(rows[3].valueTone).toBe('shield');
    expect(rows[4].valueTone).toBe('buff');
    expect(rows[5].valueTone).toBe('debuff');
    expect(rows[8].faction).toBe('system');
  });

  it('filters entries by All / Allies / Enemies / System (with kills included in System too)', () => {
    const battle = makeBattle();
    expect(filterCombatLogEntries(battle.log, 'all')).toHaveLength(5);
    expect(filterCombatLogEntries(battle.log, 'ally')).toHaveLength(3); // atk, heal, kill
    expect(filterCombatLogEntries(battle.log, 'enemy')).toHaveLength(1); // enemy skill
    // System includes battleStart AND the KO/kill entry
    const sys = filterCombatLogEntries(battle.log, 'system');
    expect(sys.map((e) => e.id)).toEqual(['log_start', 'log_kill']);

    // Verify interactive channel tabs inside CombatLogList
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: battle.log,
          active: true,
          mode: 'docked',
        })
      );
    });

    expect(
      container!.querySelectorAll('[data-testid="combat-log-entry"]')
    ).toHaveLength(5);

    const enemyTab = container!.querySelector(
      '[data-testid="combat-log-filter-enemy"]'
    ) as HTMLButtonElement;
    act(() => {
      enemyTab.click();
    });
    expect(
      container!.querySelectorAll('[data-testid="combat-log-entry"]')
    ).toHaveLength(1);

    const systemTab = container!.querySelector(
      '[data-testid="combat-log-filter-system"]'
    ) as HTMLButtonElement;
    act(() => {
      systemTab.click();
    });
    expect(
      container!.querySelectorAll('[data-testid="combat-log-entry"]')
    ).toHaveLength(2);

    // Check colored faction dots & structured columns exist
    const allTab = container!.querySelector(
      '[data-testid="combat-log-filter-all"]'
    ) as HTMLButtonElement;
    act(() => {
      allTab.click();
    });
    const dots = container!.querySelectorAll(
      '[data-testid="combat-log-faction-dot"]'
    );
    expect(dots).toHaveLength(5);
    expect(
      Array.from(dots).map((d) => d.getAttribute('data-faction'))
    ).toEqual(['ally', 'enemy', 'ally', 'ally', 'system']);
  });

  it('caps docked mode to last 200 entries and allows loading older entries in popup mode', () => {
    const manyEntries: CombatLogEntry[] = Array.from(
      { length: 260 },
      (_, idx) => ({
        id: `bulk_${idx}`,
        round: Math.floor(idx / 4) + 1,
        actorName: idx % 2 === 0 ? 'Vanguard One' : 'Raider Alpha',
        actorSide: idx % 2 === 0 ? ('ally' as const) : ('enemy' as const),
        tag: 'ATTACK' as const,
        templateKey: 'log.damage' as const,
        params: {
          actor: idx % 2 === 0 ? 'Vanguard One' : 'Raider Alpha',
          target: idx % 2 === 0 ? 'Raider Alpha' : 'Vanguard One',
          action: 'basic',
          damage: 100 + idx,
          shieldDmg: 0,
          hpDmg: 100 + idx,
        },
      })
    );

    // Docked mode caps at 200
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: manyEntries,
          active: true,
          mode: 'docked',
        })
      );
    });
    expect(
      container!.querySelectorAll('[data-testid="combat-log-entry"]')
    ).toHaveLength(DOCKED_LOG_MAX_ENTRIES);
    expect(
      container!.querySelector('[data-testid="combat-log-docked-cap"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="combat-log-load-older"]')
    ).toBeNull();

    // Popup mode shows latest page (200) + "Load older" button to reveal all 260
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: manyEntries,
          active: true,
          mode: 'popup',
        })
      );
    });
    expect(
      container!.querySelectorAll('[data-testid="combat-log-entry"]')
    ).toHaveLength(POPUP_LOG_PAGE_SIZE);
    const loadOlderBtn = container!.querySelector(
      '[data-testid="combat-log-load-older"]'
    ) as HTMLButtonElement;
    expect(loadOlderBtn).not.toBeNull();

    act(() => {
      loadOlderBtn.click();
    });
    expect(
      container!.querySelectorAll('[data-testid="combat-log-entry"]')
    ).toHaveLength(260);
    expect(
      container!.querySelector('[data-testid="combat-log-load-older"]')
    ).toBeNull();
  });

  it('toggles Docked <-> Popup mode, persists in localStorage, and does NOT pause AI turns while popup is open', () => {
    vi.useFakeTimers();
    const performAiTurnSpy = vi.fn();
    const battle = makeBattle({ activeTurnIndex: 2 }); // enemy_1's turn
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      battleSpeed: 1,
      skipAnimations: false,
      autoBattleEnabled: false,
      performAiTurn: performAiTurnSpy,
    });

    expect(readCombatLogMode()).toBe('docked');

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Click "Cửa sổ" button on desktop log header -> opens popup (not saved to localStorage)
    const toggleBtn = container!.querySelector(
      '[data-testid="combat-log-mode-toggle"]'
    ) as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('data-popup-open')).toBe('false');

    act(() => {
      toggleBtn.click();
    });

    expect(toggleBtn.getAttribute('data-popup-open')).toBe('true');
    expect(localStorage.getItem('dreamAce.logMode.v1')).toBeNull();
    expect(
      container!.querySelector('[data-testid="combat-log-popup"]')
    ).not.toBeNull();

    // Advance timers while popup is open -> battle must NOT pause
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(performAiTurnSpy).toHaveBeenCalled();

    // Close popup via dock button
    const dockBtn = container!.querySelector(
      '[data-testid="combat-log-popup-dock-btn"]'
    ) as HTMLButtonElement;
    expect(dockBtn).not.toBeNull();
    act(() => {
      dockBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="combat-log-popup"]')
    ).toBeNull();
  });

  it('renders a readable scrollable docked log on phone portrait with mode toggle', () => {
    setViewport(390, 844);
    const battle = makeBattle();
    useGameStore.setState({
      screen: 'BATTLE',
      battle,
      autoBattleEnabled: false,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(
      container!.querySelector('[data-testid="battle-phone-docked-log"]')
    ).not.toBeNull();
    const toggleBtn = container!.querySelector(
      '[data-testid="combat-log-mode-toggle"]'
    ) as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    act(() => {
      toggleBtn.click();
    });
    expect(
      container!.querySelector('[data-testid="combat-log-popup"]')
    ).not.toBeNull();
  });
});

describe('G3c-2 & G3c-3: Live "Diễn biến" view during battle & cleaned-up "Báo cáo" report after battle', () => {
  it('shows "Diễn biến" (vi) / "Progress" (en) during battle and switches to "Báo cáo" / "Report" after battle', () => {
    const runningBattle = makeBattle({ summary: null });
    useGameStore.setState({
      screen: 'BATTLE',
      language: 'vi',
      battle: runningBattle,
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Open "..." menu
    const moreBtn = container!.querySelector(
      '[data-testid="battle-more-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      moreBtn.click();
    });
    const statsBtnVi = container!.querySelector(
      '[data-testid="battle-more-stats"]'
    ) as HTMLButtonElement;
    expect(statsBtnVi.textContent).toContain('Diễn biến');

    // Switch language to English while running
    act(() => {
      useGameStore.setState({ language: 'en' });
    });
    expect(
      container!.querySelector('[data-testid="battle-more-stats"]')?.textContent
    ).toContain('Progress');

    // End the battle -> label becomes "Report" (en) / "Báo cáo" (vi)
    const finishedBattle = makeBattle({
      summary: {
        outcome: 'victory',
        sectorId: 'sector_1',
        deployedGearId: 'striker',
        rounds: 3,
        expGained: 420,
        creditsGained: 1250,
        warPointsGained: 35,
        baseCaptureBonusWp: 0,
        enemiesDestroyed: 2,
        totalEnemies: 2,
        alliesSurviving: 2,
        leveledUp: false,
        previousLevel: 10,
        newLevel: 10,
        statPointsGained: 0,
        battlesToNextLevel: 2,
        unlockedSectorId: null,
        droppedItems: [],
      },
    });
    act(() => {
      useGameStore.setState({ battle: finishedBattle, language: 'en' });
    });
    expect(
      container!.querySelector('[data-testid="battle-more-stats"]')?.textContent
    ).toContain('Report');
    expect(
      container!.querySelector('[data-testid="battle-open-report-btn"]')
        ?.textContent
    ).toContain('Report');

    act(() => {
      useGameStore.setState({ language: 'vi' });
    });
    expect(
      container!.querySelector('[data-testid="battle-more-stats"]')?.textContent
    ).toContain('Báo cáo');
    expect(
      container!.querySelector('[data-testid="battle-open-report-btn"]')
        ?.textContent
    ).toContain('Báo cáo');
  });

  it('renders live battle progress metrics and updates live when new turn events arrive', () => {
    const battle = makeBattle({ summary: null });
    const stats = aggregateBattleStats(
      battle.units,
      battle.events,
      battle.roundSnapshots,
      battle.round
    );
    const live = buildLiveBattleProgress(battle, stats);

    expect(live.turn).toBe(4);
    expect(live.allyAlive).toBe(2);
    expect(live.enemyAlive).toBe(1);
    expect(live.allyDamageDealt).toBe(565);
    expect(live.enemyDamageDealt).toBe(190);
    expect(live.topDamageDealers[0].unitId).toBe('player_1');
    expect(live.topHealers[0].unitId).toBe('ally_2');
    expect(live.activeBuffsCount).toBe(2);
    expect(live.activeDebuffsCount).toBe(1);
    expect(live.killTimeline).toHaveLength(1);
    expect(live.killTimeline[0].victimName).toBe('Sniper Beta');

    act(() => {
      root!.render(
        createElement(BattleStatsModal, {
          open: true,
          onClose: () => {},
          battle,
          enrageBonusPct: 0,
        })
      );
    });

    expect(
      container!.querySelector('[data-testid="battle-live-progress-view"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="live-units-alive"]')?.textContent
    ).toContain('2/2');
    expect(
      container!.querySelector('[data-testid="live-units-alive"]')?.textContent
    ).toContain('1/2');
    expect(
      container!.querySelector('[data-testid="live-top-damage-row-0"]')
        ?.textContent
    ).toContain('Vanguard One');
    expect(
      container!.querySelector('[data-testid="live-top-healer-row-0"]')
        ?.textContent
    ).toContain('Medic Echo');
    expect(
      container!.querySelectorAll('[data-testid="live-kill-item"]')
    ).toHaveLength(1);

    // Live update: enemy_1 gets destroyed on turn 5
    const updatedBattle = makeBattle({
      summary: null,
      round: 3,
      turnCounter: 5,
      units: battle.units.map((u) =>
        u.id === 'enemy_1' ? { ...u, hp: 0, alive: false } : u
      ),
      events: [
        ...battle.events,
        {
          id: 'ev_6',
          round: 3,
          turn: 5,
          type: 'damage',
          actorId: 'player_1',
          targetId: 'enemy_1',
          skillId: 'basic_attack',
          amount: 400,
          hpDamage: 400,
          shieldAbsorbed: 0,
        },
        {
          id: 'ev_7',
          round: 3,
          turn: 5,
          type: 'kill',
          actorId: 'player_1',
          targetId: 'enemy_1',
        },
      ],
    });

    act(() => {
      root!.render(
        createElement(BattleStatsModal, {
          open: true,
          onClose: () => {},
          battle: updatedBattle,
          enrageBonusPct: 0,
        })
      );
    });

    expect(
      container!.querySelector('[data-testid="live-units-alive"]')?.textContent
    ).toContain('0/2');
    expect(
      container!.querySelectorAll('[data-testid="live-kill-item"]')
    ).toHaveLength(2);
  });

  it('renders cleaned-up single scrollable end-of-battle Report sheet with rewards, per-unit table, and log shortcut', () => {
    const onOpenLog = vi.fn();
    const finishedBattle = makeBattle({
      summary: {
        outcome: 'victory',
        sectorId: 'sector_1',
        deployedGearId: 'striker',
        rounds: 3,
        expGained: 420,
        creditsGained: 1250,
        warPointsGained: 35,
        baseCaptureBonusWp: 0,
        enemiesDestroyed: 2,
        totalEnemies: 2,
        alliesSurviving: 2,
        leveledUp: false,
        previousLevel: 10,
        newLevel: 10,
        statPointsGained: 0,
        battlesToNextLevel: 2,
        unlockedSectorId: null,
        droppedItems: [],
      },
    });

    act(() => {
      root!.render(
        createElement(BattleStatsModal, {
          open: true,
          onClose: () => {},
          battle: finishedBattle,
          enrageBonusPct: 0,
          onOpenLog,
        })
      );
    });

    const sheet = container!.querySelector(
      '[data-testid="battle-report-sheet"]'
    );
    expect(sheet).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="report-outcome-badge"]')
    ).not.toBeNull();
    const rewardsSection = container!.querySelector(
      '[data-testid="report-section-rewards"]'
    );
    expect(rewardsSection).not.toBeNull();
    // Each reward number appears once (no duplicated numbers)
    const rewardsText = rewardsSection!.textContent ?? '';
    expect(rewardsText.match(/\+420 EXP/g)).toHaveLength(1);
    expect(rewardsText.match(/\+35 WP/g)).toHaveLength(1);

    const unitsSection = container!.querySelector(
      '[data-testid="report-section-units"]'
    );
    expect(unitsSection).not.toBeNull();
    expect(unitsSection!.textContent).toContain('Vanguard One');
    expect(unitsSection!.textContent).toContain('Medic Echo');

    const logShortcutBtn = container!.querySelector(
      '[data-testid="report-open-log-btn"]'
    ) as HTMLButtonElement;
    expect(logShortcutBtn).not.toBeNull();
    act(() => {
      logShortcutBtn.click();
    });
    expect(onOpenLog).toHaveBeenCalledTimes(1);
  });
});

describe('G3c-4: Status effects labels in Card & Radar views + Effects menu toggle', () => {
  it('renders status chips on their own line under name/level in Card view with icon + short text', () => {
    const unit = makeUnit('player_1', 'Vanguard One', 'ally', 'front', {
      isPlayer: true,
      statuses: [
        { type: 'atk_up', turnsRemaining: 2, magnitude: 0.3 },
        { type: 'burn', turnsRemaining: 3, magnitude: 45, isDebuff: true },
      ],
    });

    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit,
          isActiveTurn: true,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: false,
          popups: [],
          showStatusLabels: true,
        })
      );
    });

    const statusRow = container!.querySelector(
      '[data-testid="card-status-row-player_1"]'
    );
    expect(statusRow).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="card-status-chip-player_1-0"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="card-status-label-player_1-0"]')
        ?.textContent
    ).toBeTruthy();

    // Turning showStatusLabels off hides short text labels while keeping icons
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit,
          isActiveTurn: true,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: false,
          popups: [],
          showStatusLabels: false,
        })
      );
    });
    expect(
      container!.querySelector('[data-testid="card-status-chip-player_1-0"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="card-status-label-player_1-0"]')
    ).toBeNull();
  });

  it('renders NO status text pills on Radar markers (G4a-3a) while Effects menu ("Hiện tên hiệu ứng") toggles Card status labels', () => {
    const battle = makeBattle();
    expect(readShowStatusLabels()).toBe(true);

    // Direct BattleRadarView check: icon-only chips only, zero text tag pills
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'player_1',
          validBasicTargetIds: new Set(['enemy_1']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          speechBubblesEnabled: false,
          battleSpeed: 1,
          effectsMode: 'full',
          showStatusLabels: true,
          playerWeaponId: null,
          layoutMode: 'pc',
          onSelectEnemy: () => {},
          onSelectAlly: () => {},
          onInspectUnit: () => {},
        })
      );
    });
    expect(
      container!.querySelector('[data-testid="radar-status-label-player_1"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-status-icon-player_1-0"]')
    ).not.toBeNull();

    // End-to-end toggle in BattleScreen Effects menu (affects Card view + persists preference)
    useGameStore.setState({
      screen: 'BATTLE',
      language: 'vi',
      battle,
      battleViewMode: 'card',
    });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    expect(
      container!.querySelector('[data-testid="card-status-label-player_1-0"]')
    ).not.toBeNull();

    const moreBtn = container!.querySelector(
      '[data-testid="battle-more-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      moreBtn.click();
    });

    const toggleStatusBtn = container!.querySelector(
      '[data-testid="battle-toggle-status-labels"]'
    ) as HTMLButtonElement;
    expect(toggleStatusBtn).not.toBeNull();
    expect(toggleStatusBtn.textContent).toContain('Hiện tên hiệu ứng');
    expect(toggleStatusBtn.getAttribute('aria-pressed')).toBe('true');

    act(() => {
      toggleStatusBtn.click();
    });

    expect(
      JSON.parse(localStorage.getItem(SHOW_STATUS_LABELS_STORAGE_KEY) || '{}')
        .showStatusLabels
    ).toBe(false);
    expect(readShowStatusLabels()).toBe(false);
    expect(toggleStatusBtn.getAttribute('aria-pressed')).toBe('false');
    expect(
      container!.querySelector('[data-testid="card-status-label-player_1-0"]')
    ).toBeNull();
  });
});
