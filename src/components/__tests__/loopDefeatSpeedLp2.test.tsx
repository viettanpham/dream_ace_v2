// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import {
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../../engine/migration';
import { chooseAction } from '../../engine/tactics';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleSpeed,
  BattleState,
  CombatUnit,
  FloatingPopup,
} from '../../types/game';
import {
  ALLOWED_BATTLE_SPEEDS,
  BATTLE_SPEED_STORAGE_KEY,
  clampDefeatStreakLimit,
  EXTRA_BATTLE_SPEEDS,
  LOOP_PREFS_STORAGE_KEY,
  migrateLegacyLoopPrefs,
  PRIMARY_BATTLE_SPEEDS,
  readDeviceBattleSpeed,
  readDeviceLoopPrefs,
  shouldSkipRadarFloatingLabels,
} from '../../utils/battleDisplay';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setViewport(width: number, height: number): void {
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

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function forceDeterministicDefeatViaAiTurn(): void {
  const curBattle = useGameStore.getState().battle;
  if (!curBattle || curBattle.summary) {
    throw new Error('Expected active battle before forcing defeat');
  }
  const enemy = curBattle.units.find((u) => u.side === 'enemy' && u.alive);
  const firstAlly = curBattle.units.find((u) => u.side === 'ally' && u.alive);
  if (!enemy || !firstAlly) {
    throw new Error('Expected at least one alive enemy and ally');
  }

  const riggedUnits = curBattle.units.map((u) => {
    if (u.side === 'ally') {
      if (u.id === firstAlly.id) {
        return {
          ...u,
          hp: 1,
          shield: 0,
          alive: true,
          statuses: [],
          derived: { ...u.derived, maxHp: 100, dodgeChance: 0 },
        };
      }
      return {
        ...u,
        hp: 0,
        shield: 0,
        alive: false,
        animState: 'destroyed' as const,
      };
    }
    if (u.id === enemy.id) {
      return {
        ...u,
        statuses: [],
        derived: { ...u.derived, attackPower: 9999 },
      };
    }
    return u;
  });

  useGameStore.setState({
    battle: {
      ...curBattle,
      units: riggedUnits,
      turnOrder: [enemy.id, firstAlly.id],
      activeTurnIndex: 0,
    },
  });

  useGameStore.getState().performAiTurn();
  expect(useGameStore.getState().battle?.summary?.outcome).toBe('defeat');
}

function makeRadarUnit(
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
    isPlayer: overrides.isPlayer ?? false,
    isBoss: false,
    classId: 'striker',
    level: 5,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 500,
      maxShield: 100,
      maxSp: 60,
      speed: 80,
      attackPower: 100,
      defenseRating: 40,
      dodgeChance: 10,
      critChance: 10,
      skillPower: 20,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 5,
      passiveSkillDmgPct: 0,
    },
    hp: 500,
    shield: 100,
    sp: 50,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeRadarBattle(popups: FloatingPopup[] = []): BattleState {
  const ally = makeRadarUnit('u_ally', 'Vance', 'ally', { isPlayer: true });
  const enemy = makeRadarUnit('u_enemy', 'Raider', 'enemy');
  return {
    sectorId: 'debris_belt',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    units: [ally, enemy],
    turnOrder: [ally.id, enemy.id],
    activeTurnIndex: 0,
    selectedTargetId: enemy.id,
    selectedAllyTargetId: ally.id,
    lastPlayerTargetId: enemy.id,
    autoStopNotice: null,
    wingmanChat: null,
    log: [],
    events: [],
    roundSnapshots: [],
    fxEvents: [],
    popups,
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
  };
}

function runSeededBattleAtSpeed(speed: BattleSpeed) {
  localStorage.clear();
  const seededRng = createMulberry32(987654321);
  const randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRng);
  try {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('SeededPilot', 'striker');
    useGameStore.getState().setLanguage('en');
    useGameStore.getState().setBattleSpeed(speed);
    useGameStore.getState().startBattle('border_outpost');

    let guard = 0;
    while (guard < 400) {
      const state = useGameStore.getState();
      const b = state.battle;
      if (!b || b.summary) break;
      const activeId = b.turnOrder[b.activeTurnIndex];
      const actor = b.units.find((u) => u.id === activeId);
      if (!actor || !actor.alive) {
        state.performAiTurn();
      } else if (actor.side === 'ally' && actor.isPlayer) {
        const gear = state.pilot.gears[state.pilot.activeGearId];
        const choice = chooseAction(b, actor, gear.tactics, Math.random);
        if (choice.targetId) {
          state.selectTarget(choice.targetId);
        }
        if (choice.action === 'skill' && choice.skillId) {
          state.performPlayerAction('skill', choice.skillId);
        } else if (choice.action === 'defend') {
          state.performPlayerAction('defend');
        } else {
          state.performPlayerAction('attack');
        }
      } else {
        state.performAiTurn();
      }
      guard += 1;
    }

    const finished = useGameStore.getState().battle!;
    expect(finished.summary).not.toBeNull();
    return {
      outcome: finished.summary!.outcome,
      round: finished.round,
      turnCounter: finished.turnCounter,
      units: finished.units.map((u) => ({
        id: u.id,
        name: u.name,
        hp: u.hp,
        shield: u.shield,
        sp: u.sp,
        alive: u.alive,
      })),
      logLines: finished.log.map((entry) => ({
        round: entry.round,
        tag: entry.tag,
        templateKey: entry.templateKey,
        formatted: formatCombatLogMessage('en', entry),
      })),
    };
  } finally {
    randomSpy.mockRestore();
  }
}

describe('TASK LP2 — Loop defeat rule + extra speeds + high speed safety', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().setLanguage('vi');
    setViewport(1280, 800);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1) Renders 3 defeat-rule radio options, clamps N to 1-99, and persists per device outside save', () => {
    expect(CURRENT_SAVE_VERSION).toBe(11);
    expect(clampDefeatStreakLimit(0)).toBe(1);
    expect(clampDefeatStreakLimit(-7)).toBe(1);
    expect(clampDefeatStreakLimit(100)).toBe(99);
    expect(clampDefeatStreakLimit('42')).toBe(42);
    expect(clampDefeatStreakLimit('not-a-number')).toBe(3);

    useGameStore.getState().startBattle('border_outpost');
    act(() => {
      root.render(createElement(BattleScreen));
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-btn"]')!
        .click();
    });

    const stopImm = document.body.querySelector<HTMLInputElement>(
      '[data-testid="battle-loop-rule-stop-immediately"]'
    )!;
    const stopAfterN = document.body.querySelector<HTMLInputElement>(
      '[data-testid="battle-loop-rule-stop-after-n"]'
    )!;
    const neverStop = document.body.querySelector<HTMLInputElement>(
      '[data-testid="battle-loop-rule-never-stop"]'
    )!;
    const streakInput = document.body.querySelector<HTMLInputElement>(
      '[data-testid="battle-loop-streak-input"]'
    )!;

    expect(stopImm).not.toBeNull();
    expect(stopAfterN).not.toBeNull();
    expect(neverStop).not.toBeNull();
    expect(streakInput).not.toBeNull();
    expect(stopImm.checked).toBe(true);
    expect(streakInput.value).toBe('3');

    // Selecting option 2 and typing invalid bounds clamps to 1..99
    act(() => {
      stopAfterN.click();
    });
    const setInputValue = (val: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )!.set!;
      setter.call(streakInput, val);
      streakInput.dispatchEvent(new Event('input', { bubbles: true }));
      streakInput.dispatchEvent(new Event('change', { bubbles: true }));
    };

    act(() => setInputValue('0'));
    expect(useGameStore.getState().autoRepeatDefeatStreakLimit).toBe(1);
    expect(streakInput.value).toBe('1');

    act(() => setInputValue('150'));
    expect(useGameStore.getState().autoRepeatDefeatStreakLimit).toBe(99);
    expect(streakInput.value).toBe('99');

    act(() => setInputValue('5'));
    expect(useGameStore.getState().autoRepeatDefeatStreakLimit).toBe(5);
    expect(readDeviceLoopPrefs()).toEqual({
      defeatRule: 'stop_after_n',
      defeatStreakLimit: 5,
    });

    // Persists across unmount + remount + campaign reset (device pref)
    act(() => {
      root.unmount();
    });
    root = createRoot(container);
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().startBattle('border_outpost');
    act(() => {
      root.render(createElement(BattleScreen));
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-loop-btn"]')!
        .click();
    });
    expect(
      document.body.querySelector<HTMLInputElement>(
        '[data-testid="battle-loop-rule-stop-after-n"]'
      )!.checked
    ).toBe(true);
    expect(
      document.body.querySelector<HTMLInputElement>(
        '[data-testid="battle-loop-streak-input"]'
      )!.value
    ).toBe('5');
  });

  it('2) Option 2 stops exactly after custom N defeats in a row (resets on win) and logs rule reason', () => {
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        baseStates: {
          ...s.pilot.baseStates,
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            faction: 'allied',
            underAttack: false,
          },
        },
      },
    }));
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().setAutoRepeatDefeatRule('stop_after_n');
    useGameStore.getState().setAutoRepeatDefeatStreakLimit(2);

    act(() => {
      root.render(createElement(BattleScreen));
    });
    act(() => {
      useGameStore.getState().startAutoRepeat('infinite', 'border_outpost');
    });

    // Defeat #1 -> streak 1, continues
    act(() => forceDeterministicDefeatViaAiTurn());
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(1);
    act(() => vi.advanceTimersByTime(1000));

    // Victory -> resets streak to 0
    act(() => useGameStore.getState().forceWinBattle());
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(0);
    act(() => vi.advanceTimersByTime(1000));

    // Defeat #1 after win -> streak 1, continues
    act(() => forceDeterministicDefeatViaAiTurn());
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(1);
    act(() => vi.advanceTimersByTime(1000));

    // Defeat #2 after win -> stops immediately with N=2 rule reason in summary and log
    act(() => forceDeterministicDefeatViaAiTurn());
    const session = useGameStore.getState().autoRepeatSession;
    expect(session?.active).toBe(false);
    expect(session?.stopReason).toBe('defeat_streak');
    expect(session?.consecutiveDefeats).toBe(2);
    expect(
      container.querySelector('[data-testid="battle-loop-stop-reason"]')
        ?.textContent
    ).toBe('Dừng: thua 2 trận liên tiếp');

    const lastLog = useGameStore.getState().battle!.log.slice(-1)[0];
    expect(lastLog.templateKey).toBe('log.autoRepeatStopped');
    expect(formatCombatLogMessage('vi', lastLog)).toContain(
      'Dừng: thua 2 trận liên tiếp'
    );
  });

  it('3) Option 3 (never_stop) never stops on repeated defeats while still respecting completion limit', () => {
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().setAutoRepeatDefeatRule('never_stop');
    useGameStore.getState().setAutoRepeatDefeatStreakLimit(1);

    act(() => {
      root.render(createElement(BattleScreen));
    });
    act(() => {
      useGameStore.getState().startAutoRepeat(5, 'border_outpost');
    });

    // 4 consecutive defeats do NOT stop the loop
    for (let i = 1; i <= 4; i++) {
      act(() => forceDeterministicDefeatViaAiTurn());
      expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
      expect(useGameStore.getState().autoRepeatSession?.consecutiveDefeats).toBe(
        i
      );
      act(() => vi.advanceTimersByTime(1000));
    }

    // 5th run (even defeat) stops only because 5/5 completed
    act(() => forceDeterministicDefeatViaAiTurn());
    const finalSession = useGameStore.getState().autoRepeatSession;
    expect(finalSession?.active).toBe(false);
    expect(finalSession?.stopReason).toBe('completed');
    expect(finalSession?.completedRuns).toBe(5);
  });

  it('4) Migrates legacy stop-on-defeat toggle (ON->stop_immediately, OFF->stop_after_n N=3) and preserves extra speeds in save migration', () => {
    expect(migrateLegacyLoopPrefs(true)).toEqual({
      defeatRule: 'stop_immediately',
      defeatStreakLimit: 3,
    });
    expect(migrateLegacyLoopPrefs(false)).toEqual({
      defeatRule: 'stop_after_n',
      defeatStreakLimit: 3,
    });

    // Legacy dreamAce.loopPrefs.v1 with stopOnDefeat: false
    localStorage.setItem(
      LOOP_PREFS_STORAGE_KEY,
      JSON.stringify({ stopOnDefeat: false })
    );
    expect(readDeviceLoopPrefs()).toEqual({
      defeatRule: 'stop_after_n',
      defeatStreakLimit: 3,
    });

    // Legacy save JSON with autoRepeatStopOnDefeat: false when loopPrefs key absent
    localStorage.clear();
    localStorage.setItem(
      'starfront_mech_rpg_save_v1',
      JSON.stringify({ state: { autoRepeatStopOnDefeat: false } })
    );
    expect(readDeviceLoopPrefs()).toEqual({
      defeatRule: 'stop_after_n',
      defeatStreakLimit: 3,
    });

    // Save migration preserves extra speeds 12, 15, 20, 30
    const migrated = migrateSaveData(
      {
        version: CURRENT_SAVE_VERSION,
        battleSpeed: 20,
      },
      CURRENT_SAVE_VERSION
    );
    expect(migrated.battleSpeed).toBe(20);
  });

  it('5) Speed list has the 9 exact values; desktop "..." opens portaled popover, shows active extra speed, and persists; phone shows full 1x-30x list', () => {
    expect(ALLOWED_BATTLE_SPEEDS).toEqual([1, 2, 3, 5, 10, 12, 15, 20, 30]);
    expect(PRIMARY_BATTLE_SPEEDS).toEqual([1, 2, 3, 5, 10]);
    expect(EXTRA_BATTLE_SPEEDS).toEqual([12, 15, 20, 30]);
    for (const spd of ALLOWED_BATTLE_SPEEDS) {
      expect(typeof BALANCE_CONFIG.battleSpeedDelays[spd]).toBe('number');
      expect(BALANCE_CONFIG.battleSpeedDelays[spd]).toBeGreaterThan(0);
    }

    setViewport(1280, 800);
    useGameStore.getState().startBattle('border_outpost');
    act(() => {
      root.render(createElement(BattleScreen));
    });

    const moreBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="battle-speed-more-btn"]'
    )!;
    expect(moreBtn).not.toBeNull();
    expect(moreBtn.textContent?.trim()).toBe('…');

    act(() => {
      moreBtn.click();
    });

    const extraPopover = document.body.querySelector<HTMLElement>(
      '[data-testid="battle-speed-extra-popover"]'
    )!;
    expect(extraPopover).not.toBeNull();
    expect(extraPopover.parentElement).toBe(document.body);
    expect(extraPopover.style.position).toBe('fixed');
    expect(Number.parseFloat(extraPopover.style.left)).toBeGreaterThanOrEqual(8);
    for (const spd of EXTRA_BATTLE_SPEEDS) {
      expect(
        extraPopover.querySelector(`[data-testid="battle-speed-opt-${spd}"]`)
      ).not.toBeNull();
    }

    // Pick 20x -> "..." button shows "20x" highlighted and persists to device storage
    act(() => {
      extraPopover
        .querySelector<HTMLButtonElement>('[data-testid="battle-speed-opt-20"]')!
        .click();
    });
    expect(useGameStore.getState().battleSpeed).toBe(20);
    expect(readDeviceBattleSpeed()).toBe(20);
    expect(localStorage.getItem(BATTLE_SPEED_STORAGE_KEY)).toBe('20');
    expect(moreBtn.textContent?.trim()).toBe('20x');
    expect(moreBtn.getAttribute('aria-pressed')).toBe('true');
    expect(moreBtn.className).toContain('bg-sky-500');

    // Pick primary speed 5x -> "..." returns to "…"
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="battle-speed-opt-5"]')!
        .click();
    });
    expect(moreBtn.textContent?.trim()).toBe('…');
    expect(moreBtn.getAttribute('aria-pressed')).toBe('false');

    // Phone portrait: tapping speed cycle button opens full 1x-30x popover
    act(() => {
      setViewport(390, 844);
    });
    const phoneSpeedBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="battle-speed-cycle"]'
    )!;
    expect(phoneSpeedBtn).not.toBeNull();
    act(() => {
      phoneSpeedBtn.click();
    });

    const phonePopover = document.body.querySelector<HTMLElement>(
      '[data-testid="battle-speed-phone-popover"]'
    )!;
    expect(phonePopover).not.toBeNull();
    for (const spd of ALLOWED_BATTLE_SPEEDS) {
      expect(
        phonePopover.querySelector(
          `[data-testid="battle-speed-phone-opt-${spd}"]`
        )
      ).not.toBeNull();
    }
    act(() => {
      phonePopover
        .querySelector<HTMLButtonElement>(
          '[data-testid="battle-speed-phone-opt-30"]'
        )!
        .click();
    });
    expect(useGameStore.getState().battleSpeed).toBe(30);
    expect(phoneSpeedBtn.textContent?.trim()).toBe('30x');
  });

  it('6) Skips radar floating label queueing & rendering at >= 15x while queueing normally below 15x', () => {
    expect(shouldSkipRadarFloatingLabels(12)).toBe(false);
    expect(shouldSkipRadarFloatingLabels(15)).toBe(true);
    expect(shouldSkipRadarFloatingLabels(30)).toBe(true);

    const popup1: FloatingPopup = {
      id: 'pop_1',
      unitId: 'u_enemy',
      text: '-120',
      tone: 'damage',
    };
    const popup2: FloatingPopup = {
      id: 'pop_2',
      unitId: 'u_enemy',
      text: '-240',
      tone: 'crit',
    };

    const propsBase = {
      activeUnitId: 'u_ally',
      validBasicTargetIds: new Set(['u_enemy']),
      canPlayerManualAct: true,
      hasSingleAllySkill: false,
      autoBattleEnabled: false,
      skipAnimations: false,
      layoutMode: 'pc' as const,
      onSelectEnemy: vi.fn(),
      onSelectAlly: vi.fn(),
      onInspectUnit: vi.fn(),
    };

    // At 15x on mount: popup is skipped immediately (0 damage-popup elements)
    act(() => {
      root.render(
        createElement(BattleRadarView, {
          ...propsBase,
          battle: makeRadarBattle([popup1]),
          battleSpeed: 15,
        })
      );
    });
    expect(container.querySelectorAll('[data-testid="damage-popup"]')).toHaveLength(
      0
    );

    // Adding another popup at 30x still skips queueing
    act(() => {
      root.render(
        createElement(BattleRadarView, {
          ...propsBase,
          battle: makeRadarBattle([popup1, popup2]),
          battleSpeed: 30,
        })
      );
    });
    expect(container.querySelectorAll('[data-testid="damage-popup"]')).toHaveLength(
      0
    );

    // At 12x (< 15x) with a fresh popup, floating label queues and renders
    const popup3: FloatingPopup = {
      id: 'pop_3',
      unitId: 'u_enemy',
      text: '-95',
      tone: 'damage',
    };
    act(() => {
      root.render(
        createElement(BattleRadarView, {
          ...propsBase,
          battle: makeRadarBattle([popup1, popup2, popup3]),
          battleSpeed: 12,
        })
      );
    });
    const activePopups = container.querySelectorAll(
      '[data-testid="damage-popup"]'
    );
    expect(activePopups).toHaveLength(1);
    expect(activePopups[0].textContent).toContain('-95');

    // Switching up to 15x clears active floating labels cleanly
    act(() => {
      root.render(
        createElement(BattleRadarView, {
          ...propsBase,
          battle: makeRadarBattle([popup1, popup2, popup3]),
          battleSpeed: 15,
        })
      );
    });
    expect(container.querySelectorAll('[data-testid="damage-popup"]')).toHaveLength(
      0
    );
  });

  it('7) Same seeded battle produces identical outcome, HP/stats, and combat log at 1x and 30x', () => {
    vi.useRealTimers();
    const res1x = runSeededBattleAtSpeed(1);
    const res30x = runSeededBattleAtSpeed(30);

    expect(res30x.outcome).toBe(res1x.outcome);
    expect(res30x.round).toBe(res1x.round);
    expect(res30x.turnCounter).toBe(res1x.turnCounter);
    expect(res30x.units).toEqual(res1x.units);
    expect(res30x.logLines).toEqual(res1x.logLines);
    expect(BALANCE_CONFIG.maxInventorySize).toBeGreaterThan(0);
  });
});
