// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  createFreshCampaignState,
  migrateSaveData,
} from '../../engine/migration';
import { setSupplyLoadout } from '../../engine/supplies';
import { useGameStore } from '../../store/useGameStore';
import { SupplyLoadoutBar } from '../SupplyLoadoutBar';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  const fresh = createFreshCampaignState('PilotSupPick1', 'striker');
  useGameStore.setState({
    ...fresh,
    language: 'vi',
  });
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
});

describe('SUP-PICK1 — 1 supply family per loadout slot', () => {
  it('1) slot 2 hides hp_kit when slot 1 has hp_kit, shows empty-other-family message, while slot 1 keeps same-family tiers', () => {
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
            id: 'supply_sup_hp_t2',
            kind: 'battle_supply',
            templateId: 'sup_hp_t2',
            quantity: 2,
          },
        ],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 10,
            supplyLoadout: ['sup_hp_t1'],
          },
        },
      },
    }));

    const gear = useGameStore.getState().pilot.gears.striker;
    act(() => {
      root!.render(createElement(SupplyLoadoutBar, { variant: 'desktop', gear }));
    });

    // Open slot 2 (index 1): all hp_kit templates are hidden -> empty-other-family text shown
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-1"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      container!.querySelector('[data-testid="supply-picker-item-desktop-sup_hp_t1"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="supply-picker-item-desktop-sup_hp_t2"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="supply-picker-desktop"]')?.textContent
    ).toContain('Không còn vật tư khác loại');

    // Open slot 1 (index 0): still sees its current sup_hp_t1 and sup_hp_t2 (same family tier upgrade)
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-0"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      container!.querySelector('[data-testid="supply-picker-item-desktop-sup_hp_t1"]')
    ).not.toBeNull();
    const hpT2OnSlot0 = container!.querySelector(
      '[data-testid="supply-picker-item-desktop-sup_hp_t2"]'
    ) as HTMLButtonElement;
    expect(hpT2OnSlot0).not.toBeNull();
    expect(hpT2OnSlot0.disabled).toBe(false);
  });

  it('2) slot 2 still lists and can equip shield_kit and sp_kit when slot 1 has hp_kit', () => {
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
            id: 'supply_sup_shield_t1',
            kind: 'battle_supply',
            templateId: 'sup_shield_t1',
            quantity: 4,
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
            level: 10,
            supplyLoadout: ['sup_hp_t1'],
          },
        },
      },
    }));

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

    const shieldBtn = container!.querySelector(
      '[data-testid="supply-picker-item-desktop-sup_shield_t1"]'
    ) as HTMLButtonElement;
    const spBtn = container!.querySelector(
      '[data-testid="supply-picker-item-desktop-sup_sp_t1"]'
    ) as HTMLButtonElement;
    expect(shieldBtn).not.toBeNull();
    expect(spBtn).not.toBeNull();

    act(() => {
      shieldBtn.click();
    });
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_shield_t1',
    ]);
  });

  it('3) setSupplyLoadout rejects same-family add/swap with family_duplicate without mutating loadout, while migration preserves legacy 3-HP save', () => {
    const fresh = createFreshCampaignState('PilotSupRule', 'striker');
    const gearWithTwo = {
      ...fresh.pilot.gears.striker,
      supplyLoadout: ['sup_hp_t1', 'sup_sp_t1'],
    };

    const engineRes = setSupplyLoadout(gearWithTwo, ['sup_hp_t1', 'sup_hp_t2']);
    expect(engineRes.rejected).toEqual([
      { id: 'sup_hp_t2', reason: 'family_duplicate' },
    ]);
    expect(engineRes.gear.supplyLoadout).toEqual(['sup_hp_t1', 'sup_sp_t1']);

    useGameStore.setState({
      ...fresh,
      battle: null,
      autoRepeatSession: null,
      pilot: {
        ...fresh.pilot,
        gears: {
          ...fresh.pilot.gears,
          striker: gearWithTwo,
        },
      },
    });
    const storeRes = useGameStore
      .getState()
      .setSupplyLoadout('striker', ['sup_hp_t1', 'sup_hp_t2']);
    expect(storeRes).toEqual({
      ok: false,
      rejected: [{ id: 'sup_hp_t2', reason: 'family_duplicate' }],
    });
    expect(useGameStore.getState().pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_sp_t1',
    ]);

    // Legacy save with 3 HP kits is preserved on load (not trimmed)
    const legacyMigrated = migrateSaveData(
      {
        pilot: {
          gears: {
            striker: {
              ...fresh.pilot.gears.striker,
              supplyLoadout: ['sup_hp_t1', 'sup_hp_t2', 'sup_hp_t3'],
            },
          },
        },
      },
      CURRENT_SAVE_VERSION
    );
    expect(legacyMigrated.pilot.gears.striker.supplyLoadout).toEqual([
      'sup_hp_t1',
      'sup_hp_t2',
      'sup_hp_t3',
    ]);
  });
});
