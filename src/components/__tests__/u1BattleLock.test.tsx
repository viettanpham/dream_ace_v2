// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { isBattleActive, useGameStore } from '../../store/useGameStore';
import { soundFx } from '../../utils/sound';
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

  it('SidebarNav renders Nhân vật & GEAR in vi, Character & GEAR in en, preserves unspent badge, and keeps 5 truncated mobile tabs', () => {
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
    expect(container!.textContent).not.toContain('Garage');

    const mobileNav = container!.querySelector('nav[aria-label="Mobile navigation"]');
    expect(mobileNav).not.toBeNull();
    const mobileButtons = Array.from(mobileNav!.querySelectorAll('button'));
    expect(mobileButtons).toHaveLength(5);
    for (const btn of mobileButtons) {
      const labelSpan = btn.querySelector('span.truncate');
      expect(labelSpan).not.toBeNull();
    }
    // Unspent-points badge sits on the Nhân vật (garage) tab
    expect(mobileButtons[1].textContent).toContain('Nhân vật');
    expect(mobileButtons[1].textContent).toContain('3');

    act(() => {
      useGameStore.setState({ language: 'en' });
    });
    expect(container!.textContent).toContain('Character');
    expect(container!.textContent).toContain('GEAR');
  });
});
