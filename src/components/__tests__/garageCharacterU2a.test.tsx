// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { ItemInstance } from '../../types/game';
import { soundFx } from '../../utils/sound';
import { GarageView } from '../GarageView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

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

function renderGarageView() {
  act(() => {
    root!.render(createElement(GarageView));
  });
}

function seedPilot(options?: {
  level?: number;
  unspentPoints?: number;
  evasionMod?: number;
  language?: 'vi' | 'en';
}) {
  const level = options?.level ?? 4;
  const unspentPoints = options?.unspentPoints ?? 12;
  const language = options?.language ?? 'vi';

  const baseState = useGameStore.getState();
  const baseStriker = baseState.pilot.gears.striker;
  const heavyArmor: ItemInstance | null =
    options?.evasionMod !== undefined
      ? {
          instanceId: 'test_heavy_armor',
          templateId: 'titanium_hull',
          slot: 'armor',
          tier: 2,
          requiredLevel: 1,
          classRestriction: null,
          rarity: 'rare',
          rolledBaseStats: { defense: 8 },
          affixes: [],
          suffixId: null,
          rollQuality: 80,
          price: 200,
          enchantLevel: 0,
          specialTraits: { evasionMod: options.evasionMod },
        }
      : null;

  useGameStore.setState({
    language,
    screen: 'HANGAR',
    activeTab: 'garage',
    pilot: {
      ...baseState.pilot,
      name: 'ACE-U2A',
      credits: 2000,
      inventory: heavyArmor ? [heavyArmor] : [],
      gears: {
        ...baseState.pilot.gears,
        striker: {
          ...baseStriker,
          level,
          exp: 120,
          unspentPoints,
          allocatedPoints: { ...EMPTY_STAT_BLOCK, attack: 2 },
          equipped: heavyArmor
            ? {
                ...baseStriker.equipped,
                armor: heavyArmor.instanceId,
              }
            : {
                main_weapon: null,
                sub_weapon: null,
                armor: null,
                engine: null,
                cpu: null,
                accessory: null,
                radar: null,
              },
          battlesFought: 5,
          battlesWon: 4,
        },
      },
      activeGearId: 'striker',
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  setViewport(1280, 800);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  seedPilot();
});

afterEach(() => {
  vi.useRealTimers();
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

describe('TASK U2a — Character tab (GarageView)', () => {
  it('shows "Nhân vật" / "Character" title and active Gear summary with level and unspent points', () => {
    renderGarageView();

    const heading = container!.querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('Nhân vật');

    const summary = container!.querySelector(
      '[data-testid="character-summary"]'
    );
    expect(summary).not.toBeNull();
    expect(summary!.textContent).toContain('ACE-U2A');
    expect(summary!.textContent).toContain('Lv.4');
    expect(summary!.textContent).toContain('120 /');
    expect(summary!.textContent).toContain('+12 điểm chưa cộng');

    act(() => {
      useGameStore.setState({ language: 'en' });
    });
    expect(container!.querySelector('h1')?.textContent?.trim()).toBe(
      'Character'
    );
    expect(
      container!.querySelector('[data-testid="character-summary"]')?.textContent
    ).toContain('+12 Unspent Pts');
  });

  it('renders Total Stats 5-source legend (non-green/red), omits zero sources and negative other from bars, and expands formula on desktop vs BottomSheet on phone', () => {
    seedPilot({ evasionMod: -4, unspentPoints: 5, language: 'vi' });
    renderGarageView();

    const totalSection = container!.querySelector(
      '[data-testid="total-stats-section"]'
    );
    expect(totalSection).not.toBeNull();
    expect(totalSection!.textContent).toContain('Tổng chỉ số');

    const legend = container!.querySelector(
      '[data-testid="total-stats-legend"]'
    )!;
    const swatches = Array.from(
      legend.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')
    ).map((el) => el.style.backgroundColor);
    // 5 fixed colors: #94a3b8, #38bdf8, #a78bfa, #fbbf24, #f472b6
    expect(swatches).toEqual([
      'rgb(148, 163, 184)',
      'rgb(56, 189, 248)',
      'rgb(167, 139, 250)',
      'rgb(251, 191, 36)',
      'rgb(244, 114, 182)',
    ]);

    // Zero equipment on attack -> no equipment segment drawn
    expect(
      container!.querySelector('[data-testid="total-stat-seg-attack-equipment"]')
    ).toBeNull();
    // Positive base on attack -> segment drawn with number
    const atkBaseSeg = container!.querySelector(
      '[data-testid="total-stat-seg-attack-base"]'
    );
    expect(atkBaseSeg).not.toBeNull();
    expect(atkBaseSeg!.textContent?.trim().length).toBeGreaterThan(0);

    // Negative other on evasion (-4 from evasionMod) -> NOT drawn as segment, only listed in detail
    expect(
      container!.querySelector('[data-testid="total-stat-seg-evasion-other"]')
    ).toBeNull();

    // Tap evasion row on desktop -> inline detail expands under row with formula
    const evaRow = container!.querySelector<HTMLButtonElement>(
      '[data-testid="total-stat-row-evasion"]'
    )!;
    act(() => {
      evaRow.click();
    });
    const detail = container!.querySelector(
      '[data-testid="total-stat-detail-evasion"]'
    );
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Gốc ');
    expect(detail!.textContent).toContain('- Nội tại 4 =');

    // Switch to phone viewport -> tapping row opens BottomSheet with formula and no nested scroll box
    act(() => {
      setViewport(390, 844);
    });
    const atkRowPhone = container!.querySelector<HTMLButtonElement>(
      '[data-testid="total-stat-row-attack"]'
    )!;
    act(() => {
      atkRowPhone.click();
    });
    const sheet = container!.querySelector('[data-testid="total-stat-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.textContent).toContain('Gốc ');
    expect(sheet!.textContent).toContain('= ');
    // No nested scroll box inside BottomSheet dialog
    const dialog = sheet!.closest('[role="dialog"]')!;
    expect(dialog.querySelector('.overflow-y-auto')).toBeNull();
  });

  it('supports tap = 1, press-and-hold repeat with fake timers, single sound per hold, clamping, +5, and MAX', () => {
    vi.useFakeTimers();
    const clickSpy = vi.spyOn(soundFx, 'playClick');
    seedPilot({ unspentPoints: 18, language: 'vi' });
    renderGarageView();

    const plusAtk = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="+ATK"]'
    )!;
    const minusAtk = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="-ATK"]'
    )!;
    const plus5Ful = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="+5 FUL"]'
    )!;
    const maxDef = container!.querySelector<HTMLButtonElement>(
      'button[aria-label*="DEF"][aria-label*="Dồn"]'
    )!;
    const atkCount = () =>
      Number(
        container!.querySelector('[data-testid="pending-count-attack"]')!
          .textContent
      );
    const fulCount = () =>
      Number(
        container!.querySelector('[data-testid="pending-count-fuel"]')!
          .textContent
      );
    const defCount = () =>
      Number(
        container!.querySelector('[data-testid="pending-count-defense"]')!
          .textContent
      );
    const remainingText = () =>
      Number(
        container!.querySelector(
          '[data-testid="allocation-remaining-points"]'
        )!.textContent
      );

    // 1. Plain tap = exactly 1 step (pointerdown + pointerup + click does NOT double fire)
    act(() => {
      plusAtk.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0 })
      );
      plusAtk.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, button: 0 })
      );
      plusAtk.click();
    });
    expect(atkCount()).toBe(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // 2. Hold for 500 ms -> more than 1 step, and still only 1 playClick for the whole hold
    clickSpy.mockClear();
    act(() => {
      plusAtk.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0 })
      );
    });
    expect(atkCount()).toBe(2);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(atkCount()).toBeGreaterThan(2);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Hold past 1200ms accelerates -> clamp or advance more
    const beforeRelease = atkCount();
    act(() => {
      plusAtk.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, button: 0 })
      );
    });
    // Advancing time after pointerup must stop repeating
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(atkCount()).toBe(beforeRelease);

    // 3. Hold minus until clamped at 0 (never negative)
    act(() => {
      minusAtk.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0 })
      );
      vi.advanceTimersByTime(2000);
      minusAtk.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, button: 0 })
      );
    });
    expect(atkCount()).toBe(0);
    expect(remainingText()).toBe(18);

    // 4. +5 adds 5 and clamps when remaining < 5; MAX uses all remaining
    act(() => {
      plus5Ful.click();
    });
    expect(fulCount()).toBe(5);
    expect(remainingText()).toBe(13);

    // Put 10 into defense via two +5 clicks -> 3 remaining
    act(() => {
      const plus5Def = container!.querySelector<HTMLButtonElement>(
        'button[aria-label="+5 DEF"]'
      )!;
      plus5Def.click();
      plus5Def.click();
    });
    expect(defCount()).toBe(10);
    expect(remainingText()).toBe(3);

    // Now +5 on FUL clamps to remaining 3 -> fulCount = 8
    act(() => {
      plus5Ful.click();
    });
    expect(fulCount()).toBe(8);
    expect(remainingText()).toBe(0);

    // Reset via Clear, then MAX allocates all 18 into DEF
    act(() => {
      const clearBtn = Array.from(
        container!.querySelectorAll('button')
      ).find((b) => b.textContent?.includes('Hoàn tác'));
      clearBtn?.click();
    });
    expect(remainingText()).toBe(18);

    act(() => {
      maxDef.click();
    });
    expect(defCount()).toBe(18);
    expect(remainingText()).toBe(0);

    // Hold on disabled/unspent-exhausted button or blur cleanup stays safe
    expect(plusAtk.disabled).toBe(true);
    expect(maxDef.disabled).toBe(true);
  });

  it('maintains vi/en i18n parity and overflow-safe / 44px touch-target layout classes', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);

    renderGarageView();
    const rootDiv = container!.firstElementChild as HTMLElement;
    expect(rootDiv.className).toContain('overflow-x-hidden');

    const allocPlus = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="+ATK"]'
    )!;
    const allocMinus = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="-ATK"]'
    )!;
    const allocPlus5 = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="+5 ATK"]'
    )!;
    const allocMax = container!.querySelector<HTMLButtonElement>(
      'button[aria-label*="ATK"][aria-label*="Dồn"]'
    )!;
    for (const btn of [allocPlus, allocMinus, allocPlus5, allocMax]) {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
      expect(btn.className).toContain('touch-manipulation');
      expect(btn.className).toContain('select-none');
    }
  });
});
