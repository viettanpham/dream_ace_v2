// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshCampaignState } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import { SupplyLoadoutBar } from '../SupplyLoadoutBar';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('PilotCsUi', 'striker'),
    language: 'vi',
  });
  useGameStore.getState().startCampaign('PilotCsUi', 'striker');
  useGameStore.getState().setLanguage('vi');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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
  vi.restoreAllMocks();
});

describe('TASK CS-UI — SupplyLoadoutBar ("Túi vật tư") + Picker', () => {
  it('1) row renders N tiles from supplyLoadoutSlots, filled and empty states with stock x7 / x0', () => {
    useGameStore.setState((s) => ({
      ...s,
      adminConfig: { ...s.adminConfig, supplyLoadoutSlots: 5 },
      pilot: {
        ...s.pilot,
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 7,
          },
        ],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 10,
            supplyLoadout: ['sup_hp_t1', 'sup_shield_t1'],
          },
        },
      },
    }));

    const gear = useGameStore.getState().pilot.gears.striker;
    act(() => {
      root!.render(createElement(SupplyLoadoutBar, { variant: 'desktop', gear }));
    });

    expect(
      container!.querySelector('[data-testid="supply-loadout-count-desktop"]')?.textContent
    ).toBe('2/5');

    const slot0 = container!.querySelector('[data-testid="supply-slot-desktop-0"]');
    const slot1 = container!.querySelector('[data-testid="supply-slot-desktop-1"]');
    const slot2 = container!.querySelector('[data-testid="supply-slot-desktop-2"]');
    const slot4 = container!.querySelector('[data-testid="supply-slot-desktop-4"]');

    expect(slot0?.textContent).toContain('Sửa chữa T1');
    expect(slot0?.textContent).toContain('x7');
    expect(slot1?.textContent).toContain('x0');
    expect(slot2?.getAttribute('data-supply-template-id')).toBe('');
    expect(slot4).not.toBeNull();
  });

  it('2) picker lists owned unlocked templates only, disables equipped ones, and hides higher locked tiers', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 3,
          },
          {
            id: 'supply_sup_hp_t4',
            kind: 'battle_supply',
            templateId: 'sup_hp_t4',
            quantity: 2,
          },
          {
            id: 'supply_sup_sp_t1',
            kind: 'battle_supply',
            templateId: 'sup_sp_t1',
            quantity: 5,
          },
        ],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 5, // unlocks tier 1 (unlockLevel 1), NOT tier 4 (unlockLevel 35)
            supplyLoadout: ['sup_hp_t1'],
          },
        },
      },
    }));

    const gear = useGameStore.getState().pilot.gears.striker;
    act(() => {
      root!.render(createElement(SupplyLoadoutBar, { variant: 'desktop', gear }));
    });

    const slot1 = container!.querySelector(
      '[data-testid="supply-slot-desktop-1"]'
    ) as HTMLButtonElement;
    act(() => {
      slot1.click();
    });

    const picker = container!.querySelector('[data-testid="supply-picker-desktop"]');
    expect(picker).not.toBeNull();
    // Already empty slot -> clear row hidden
    expect(
      container!.querySelector('[data-testid="supply-picker-clear-desktop"]')
    ).toBeNull();

    const hpT1Row = container!.querySelector(
      '[data-testid="supply-picker-item-desktop-sup_hp_t1"]'
    ) as HTMLButtonElement;
    const spT1Row = container!.querySelector(
      '[data-testid="supply-picker-item-desktop-sup_sp_t1"]'
    ) as HTMLButtonElement;
    const hpT4Row = container!.querySelector(
      '[data-testid="supply-picker-item-desktop-sup_hp_t4"]'
    );
    const shieldT1Row = container!.querySelector(
      '[data-testid="supply-picker-item-desktop-sup_shield_t1"]'
    );

    expect(hpT1Row).not.toBeNull();
    expect(hpT1Row.disabled).toBe(true);
    expect(hpT1Row.textContent).toContain('Đã mang');
    expect(spT1Row).not.toBeNull();
    expect(spT1Row.disabled).toBe(false);
    expect(spT1Row.textContent).toContain('SP +20%');
    expect(hpT4Row).toBeNull();
    expect(shieldT1Row).toBeNull();
  });

  it('3) choosing a row calls setSupplyLoadout to replace/append and Trống/Gỡ removes element i compactly', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 4,
          },
          {
            id: 'supply_sup_shield_t1',
            kind: 'battle_supply',
            templateId: 'sup_shield_t1',
            quantity: 6,
          },
          {
            id: 'supply_sup_sp_t1',
            kind: 'battle_supply',
            templateId: 'sup_sp_t1',
            quantity: 2,
          },
        ],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 5,
            supplyLoadout: ['sup_hp_t1'],
          },
        },
      },
    }));

    const renderWithLatest = () => {
      const latestGear = useGameStore.getState().pilot.gears.striker;
      act(() => {
        root!.render(
          createElement(SupplyLoadoutBar, { variant: 'desktop', gear: latestGear })
        );
      });
    };
    renderWithLatest();

    // Tap empty slot 3 -> appends to end (index 1, compact)
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-3"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-picker-item-desktop-sup_sp_t1"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_sp_t1',
    ]);

    // Re-render and replace slot 0 with sup_shield_t1
    renderWithLatest();
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-0"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-picker-item-desktop-sup_shield_t1"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_shield_t1',
      'sup_sp_t1',
    ]);

    // Re-render and click "Trống / Gỡ" on slot 0 -> compact shift
    renderWithLatest();
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-0"]'
        ) as HTMLButtonElement
      ).click();
    });
    const clearBtn = container!.querySelector(
      '[data-testid="supply-picker-clear-desktop"]'
    ) as HTMLButtonElement;
    expect(clearBtn.textContent).toContain('Trống / Gỡ');
    act(() => {
      clearBtn.click();
    });
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_sp_t1',
    ]);
  });

  it('4) when the store returns reason locked, nothing changes and tiles are dimmed', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        consumables: [
          {
            id: 'supply_sup_hp_t1',
            kind: 'battle_supply',
            templateId: 'sup_hp_t1',
            quantity: 4,
          },
          {
            id: 'supply_sup_sp_t1',
            kind: 'battle_supply',
            templateId: 'sup_sp_t1',
            quantity: 3,
          },
        ],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 5,
            supplyLoadout: ['sup_hp_t1'],
          },
        },
      },
    }));

    const lockedStub = vi
      .fn()
      .mockReturnValue({ ok: false, rejected: [], reason: 'locked' });
    useGameStore.setState({ setSupplyLoadout: lockedStub });

    const gear = useGameStore.getState().pilot.gears.striker;
    act(() => {
      root!.render(createElement(SupplyLoadoutBar, { variant: 'desktop', gear }));
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-1"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-picker-item-desktop-sup_sp_t1"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(lockedStub).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
    ]);
    const slot0 = container!.querySelector(
      '[data-testid="supply-slot-desktop-0"]'
    ) as HTMLButtonElement;
    expect(slot0.getAttribute('data-supply-dimmed')).toBe('true');
    expect(slot0.className).toContain('opacity-50');
    expect(slot0.title).toBe('Không đổi được khi đang đánh');
  });
});
