// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { isBattleActive, useGameStore } from '../../store/useGameStore';
import { soundFx } from '../../utils/sound';
import { ErrorBoundary } from '../ErrorBoundary';
import { SidebarNav } from '../SidebarNav';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGameStore.setState({
    language: 'vi',
    screen: 'HANGAR',
    activeTab: 'gear',
    shopSubTab: 'buy',
    battle: null,
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

describe('TASK U1 — Store battle lock (setActiveTab, setScreen, openWarPointShop, startBattle)', () => {
  it('blocks setActiveTab, setScreen(HANGAR/SHOP), openWarPointShop, and startBattle during active battle without playing click sound', () => {
    useGameStore.getState().startBattle('border_outpost');
    const initialBattle = useGameStore.getState().battle;
    expect(isBattleActive()).toBe(true);
    expect(initialBattle).not.toBeNull();
    expect(initialBattle?.summary).toBeNull();

    const clickSpy = vi.spyOn(soundFx, 'playClick');
    const confirmSpy = vi.spyOn(soundFx, 'playConfirm');

    useGameStore.getState().setActiveTab('shop');
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().activeTab).toBe('gear');

    useGameStore.getState().setScreen('HANGAR');
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().activeTab).toBe('gear');

    useGameStore.getState().setScreen('SHOP');
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().activeTab).toBe('gear');

    useGameStore.getState().openWarPointShop();
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().activeTab).toBe('gear');
    expect(useGameStore.getState().shopSubTab).toBe('buy');

    useGameStore.getState().startBattle('debris_belt');
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().battle).toBe(initialBattle);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('allows setActiveTab, setScreen, openWarPointShop, and startBattle once battle.summary is set', () => {
    useGameStore.getState().startBattle('border_outpost');
    const initialBattle = useGameStore.getState().battle!;
    useGameStore.setState({
      battle: {
        ...initialBattle,
        summary: {
          outcome: 'victory',
          deployedGearId: initialBattle.deployedGearId,
          sectorId: initialBattle.sectorId,
          rounds: 2,
          expGained: 40,
          creditsGained: 100,
          warPointsGained: 5,
          baseCaptureBonusWp: 0,
          leveledUp: false,
          previousLevel: 1,
          newLevel: 1,
          statPointsGained: 0,
          battlesToNextLevel: 3,
          unlockedSectorId: null,
          enemiesDestroyed: 4,
          totalEnemies: 4,
          alliesSurviving: 4,
          droppedItems: [],
        },
      },
    });
    expect(isBattleActive()).toBe(false);

    useGameStore.getState().setActiveTab('shop');
    expect(useGameStore.getState().screen).toBe('HANGAR');
    expect(useGameStore.getState().activeTab).toBe('shop');

    useGameStore.setState({ screen: 'BATTLE', activeTab: 'gear' });
    useGameStore.getState().setScreen('HANGAR');
    expect(useGameStore.getState().screen).toBe('HANGAR');

    useGameStore.setState({ screen: 'BATTLE', activeTab: 'gear' });
    useGameStore.getState().openWarPointShop();
    expect(useGameStore.getState().screen).toBe('HANGAR');
    expect(useGameStore.getState().activeTab).toBe('shop');
    expect(useGameStore.getState().shopSubTab).toBe('warpoints');

    useGameStore.setState({ screen: 'BATTLE' });
    useGameStore.getState().startBattle('border_outpost');
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().battle?.summary).toBeNull();
  });

  it('returnToHangar exits cleanly both during an active battle and when battle.summary is set', () => {
    // Case 1: Active battle
    useGameStore.getState().startBattle('border_outpost');
    expect(isBattleActive()).toBe(true);
    useGameStore.getState().returnToHangar();
    expect(useGameStore.getState().screen).toBe('HANGAR');
    expect(useGameStore.getState().battle).toBeNull();

    // Case 2: Post-battle summary
    useGameStore.getState().startBattle('border_outpost');
    const b = useGameStore.getState().battle!;
    useGameStore.setState({
      battle: {
        ...b,
        summary: {
          outcome: 'defeat',
          retreated: true,
          deployedGearId: b.deployedGearId,
          sectorId: b.sectorId,
          rounds: 1,
          expGained: 0,
          creditsGained: 0,
          warPointsGained: 0,
          baseCaptureBonusWp: 0,
          leveledUp: false,
          previousLevel: 1,
          newLevel: 1,
          statPointsGained: 0,
          battlesToNextLevel: 3,
          unlockedSectorId: null,
          enemiesDestroyed: 0,
          totalEnemies: 4,
          alliesSurviving: 4,
          droppedItems: [],
        },
      },
    });
    expect(isBattleActive()).toBe(false);
    useGameStore.getState().returnToHangar();
    expect(useGameStore.getState().screen).toBe('HANGAR');
    expect(useGameStore.getState().battle).toBeNull();
  });
});

describe('TASK U1 — Tab labels, i18n parity & SidebarNav render', () => {
  it('updates sidebar.gear, sidebar.garage, and all 3 Garage-tab mentions in both vi and en with full key parity', () => {
    expect(VI_TRANSLATIONS['sidebar.gear']).toBe('GEAR');
    expect(VI_TRANSLATIONS['sidebar.garage']).toBe('Nhân vật');
    expect(EN_TRANSLATIONS['sidebar.gear']).toBe('GEAR');
    expect(EN_TRANSLATIONS['sidebar.garage']).toBe('Character');

    expect(VI_TRANSLATIONS['title.starterHint']).toContain('Nhân vật');
    expect(VI_TRANSLATIONS['title.starterHint']).not.toContain('Garage');
    expect(VI_TRANSLATIONS['gear.allocateHint']).toContain('Nhân vật');
    expect(VI_TRANSLATIONS['gear.allocateHint']).not.toContain('Garage');
    expect(VI_TRANSLATIONS['summary.levelUpDesc']).toContain('Nhân vật');
    expect(VI_TRANSLATIONS['summary.levelUpDesc']).not.toContain('Garage');

    expect(EN_TRANSLATIONS['title.starterHint']).toContain('Character');
    expect(EN_TRANSLATIONS['title.starterHint']).not.toContain('Garage');
    expect(EN_TRANSLATIONS['gear.allocateHint']).toContain('Character');
    expect(EN_TRANSLATIONS['gear.allocateHint']).not.toContain('Garage');
    expect(EN_TRANSLATIONS['summary.levelUpDesc']).toContain('Character');
    expect(EN_TRANSLATIONS['summary.levelUpDesc']).not.toContain('Garage');

    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );
  });

  it('SidebarNav renders Nhân vật & GEAR in vi, Character & GEAR in en, preserves unspent badge, and keeps 6 truncated mobile tabs', () => {
    const pilot = useGameStore.getState().pilot;
    const activeGear = pilot.gears[pilot.activeGearId];
    useGameStore.setState({
      language: 'vi',
      pilot: {
        ...pilot,
        gears: {
          ...pilot.gears,
          [pilot.activeGearId]: {
            ...activeGear,
            unspentPoints: 3,
          },
        },
      },
    });

    act(() => {
      root!.render(createElement(SidebarNav));
    });

    expect(container!.textContent).toContain('Nhân vật');
    expect(container!.textContent).toContain('GEAR');
    expect(container!.textContent).toContain('KHO ĐỒ');
    expect(container!.textContent).not.toContain('Garage');

    const mobileNav = container!.querySelector('nav[aria-label="Mobile navigation"]');
    expect(mobileNav).not.toBeNull();
    const mobileButtons = Array.from(mobileNav!.querySelectorAll('button'));
    expect(mobileButtons).toHaveLength(6);
    for (const btn of mobileButtons) {
      const labelSpan = btn.querySelector('span.truncate');
      expect(labelSpan).not.toBeNull();
    }
    // Unspent-points badge sits on the Nhân vật (garage) tab (3rd slot after GEAR & KHO ĐỒ)
    expect(mobileButtons[1].textContent).toContain('KHO ĐỒ');
    expect(mobileButtons[2].textContent).toContain('Nhân vật');
    expect(mobileButtons[2].textContent).toContain('3');

    act(() => {
      useGameStore.setState({ language: 'en' });
    });
    expect(container!.textContent).toContain('Character');
    expect(container!.textContent).toContain('GEAR');
  });
});

describe('TASK U1-F1 — reloadBattle & ErrorBoundary crash recovery', () => {
  it('reloadBattle discards an active battle and starts a fresh round-1 battle while startBattle remains locked', () => {
    useGameStore.getState().startBattle('border_outpost');
    const firstBattle = useGameStore.getState().battle!;
    useGameStore.setState({
      battle: {
        ...firstBattle,
        round: 4,
      },
    });
    expect(isBattleActive()).toBe(true);

    // startBattle is still a no-op during active battle
    useGameStore.getState().startBattle('border_outpost');
    expect(useGameStore.getState().battle?.round).toBe(4);

    // reloadBattle bypasses the lock and produces a fresh battle
    useGameStore.getState().reloadBattle('border_outpost');
    const reloaded = useGameStore.getState().battle!;
    expect(reloaded).not.toBe(firstBattle);
    expect(reloaded.round).toBe(1);
    expect(reloaded.summary).toBeNull();
    expect(reloaded.sectorId).toBe('border_outpost');
    expect(useGameStore.getState().screen).toBe('BATTLE');
  });

  it('reloadBattle works when battle is null and when battle.summary is already set', () => {
    // Case 1: battle === null
    useGameStore.setState({ screen: 'HANGAR', battle: null });
    useGameStore.getState().reloadBattle('border_outpost');
    const fromNull = useGameStore.getState().battle;
    expect(fromNull).not.toBeNull();
    expect(fromNull?.round).toBe(1);
    expect(fromNull?.summary).toBeNull();
    expect(useGameStore.getState().screen).toBe('BATTLE');

    // Case 2: battle.summary is set
    useGameStore.setState({
      battle: {
        ...fromNull!,
        round: 3,
        summary: {
          outcome: 'victory',
          deployedGearId: fromNull!.deployedGearId,
          sectorId: fromNull!.sectorId,
          rounds: 3,
          expGained: 50,
          creditsGained: 120,
          warPointsGained: 8,
          baseCaptureBonusWp: 0,
          leveledUp: false,
          previousLevel: 1,
          newLevel: 1,
          statPointsGained: 0,
          battlesToNextLevel: 3,
          unlockedSectorId: null,
          enemiesDestroyed: 4,
          totalEnemies: 4,
          alliesSurviving: 4,
          droppedItems: [],
        },
      },
    });
    expect(isBattleActive()).toBe(false);
    useGameStore.getState().reloadBattle('border_outpost');
    const fromSummary = useGameStore.getState().battle!;
    expect(fromSummary.round).toBe(1);
    expect(fromSummary.summary).toBeNull();
    expect(fromSummary).not.toBe(fromNull);
  });

  it('ErrorBoundary reload button recovers an active battle crash via reloadBattle', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    useGameStore.getState().startBattle('border_outpost');
    const brokenBattle = useGameStore.getState().battle!;
    useGameStore.setState({
      battle: {
        ...brokenBattle,
        round: 3,
      },
    });
    expect(isBattleActive()).toBe(true);

    function CrashWhileBrokenChild() {
      const round = useGameStore((s) => s.battle?.round ?? 0);
      if (round > 1) {
        throw new Error('Simulated battle render crash');
      }
      return createElement(
        'div',
        { 'data-testid': 'recovered-battle' },
        `round:${round}`
      );
    }

    act(() => {
      root!.render(
        createElement(ErrorBoundary, {
          variant: 'global',
          onReloadBattle: () =>
            useGameStore
              .getState()
              .reloadBattle(useGameStore.getState().battle?.sectorId),
          children: createElement(CrashWhileBrokenChild),
        })
      );
    });

    const reloadBtn = container!.querySelector(
      '[data-testid="error-boundary-reload"]'
    ) as HTMLButtonElement;
    expect(reloadBtn).not.toBeNull();

    act(() => {
      reloadBtn.click();
    });

    const freshBattle = useGameStore.getState().battle!;
    expect(freshBattle).not.toBe(brokenBattle);
    expect(freshBattle.round).toBe(1);
    expect(freshBattle.summary).toBeNull();
    expect(
      container!.querySelector('[data-testid="recovered-battle"]')?.textContent
    ).toBe('round:1');
    expect(
      container!.querySelector('[data-testid="error-boundary-fallback"]')
    ).toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it('auto-repeat still starts the next battle via startBattle once summary is set', () => {
    useGameStore.getState().startBattle('border_outpost');
    const finishedBattle = useGameStore.getState().battle!;
    useGameStore.setState({
      autoRepeatSession: {
        active: true,
        limit: 5,
        sectorId: 'border_outpost',
        completedRuns: 1,
        wins: 1,
        consecutiveDefeats: 0,
        defeatStreakLimit: 1,
        totalExp: 40,
        totalCredits: 100,
        totalWarPoints: 5,
        totalDrops: [],
        stopReason: null,
      },
      battle: {
        ...finishedBattle,
        round: 2,
        summary: {
          outcome: 'victory',
          deployedGearId: finishedBattle.deployedGearId,
          sectorId: finishedBattle.sectorId,
          rounds: 2,
          expGained: 40,
          creditsGained: 100,
          warPointsGained: 5,
          baseCaptureBonusWp: 0,
          leveledUp: false,
          previousLevel: 1,
          newLevel: 1,
          statPointsGained: 0,
          battlesToNextLevel: 3,
          unlockedSectorId: null,
          enemiesDestroyed: 4,
          totalEnemies: 4,
          alliesSurviving: 4,
          droppedItems: [],
        },
      },
    });
    expect(isBattleActive()).toBe(false);

    useGameStore
      .getState()
      .startBattle(useGameStore.getState().autoRepeatSession!.sectorId);
    const nextBattle = useGameStore.getState().battle!;
    expect(nextBattle).not.toBe(finishedBattle);
    expect(nextBattle.round).toBe(1);
    expect(nextBattle.summary).toBeNull();
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
  });
});
