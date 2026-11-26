// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateItemInstance } from '../../engine/equipment';
import { createFreshCampaignState } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { ItemInstance } from '../../types/game';
import { GearView } from '../GearView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeModule(instanceId: string, templateId: string): ItemInstance {
  const inst = generateItemInstance(
    {
      templateId,
      tier: 1,
      rarity: 'common',
      requiredLevel: 1,
      rollQuality: 50,
    },
    () => 0.5
  );
  return {
    ...inst,
    instanceId,
    locked: false,
    favorited: false,
    isStarter: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

function getDesktopDetail(): HTMLElement {
  return container!.querySelector(
    'section.hidden.lg\\:flex.lg\\:col-span-5'
  ) as HTMLElement;
}

function readMobileAtkStat(): number {
  const cards = Array.from(container!.querySelectorAll('div'));
  const atkLabel = cards.find((el) => el.textContent === 'ATK');
  const valText = atkLabel?.parentElement?.querySelector('.text-sm')?.textContent;
  return Number(valText ?? NaN);
}

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('PilotExt2c', 'striker'),
    language: 'vi',
  });
  useGameStore.getState().startCampaign('PilotExt2c', 'striker');
  useGameStore.getState().setLanguage('vi');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.restoreAllMocks();
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

describe('TASK EXT2c — Module UI & 5 socket tiles on GEAR', () => {
  it('1) locked socket gives no bonus in UI sums when adminConfig changes extenderLevelsPerSocket', () => {
    const atkMod = makeModule('mod_atk_sum', 'mod_stat_attack_t4');
    useGameStore.setState((s) => ({
      ...s,
      adminConfig: { ...s.adminConfig, extenderLevelsPerSocket: 10 },
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, atkMod],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 10,
            extenders: ['mod_atk_sum', null, null, null, null],
          },
        },
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });
    const atkUnlocked = readMobileAtkStat();

    act(() => {
      useGameStore.setState((s) => ({
        ...s,
        adminConfig: { ...s.adminConfig, extenderLevelsPerSocket: 20 },
      }));
    });
    const atkLocked = readMobileAtkStat();

    expect(atkUnlocked - atkLocked).toBe(8);
  });

  it('2) module detail lists 5 rows (locked / empty / filled) in desktop detail', () => {
    const mountedMod = makeModule('mod_mounted_1', 'mod_stat_attack_t1');
    const bagMod = makeModule('mod_bag_def', 'mod_stat_defense_t1');
    useGameStore.setState((s) => ({
      ...s,
      adminConfig: { ...s.adminConfig, extenderLevelsPerSocket: 10 },
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, mountedMod, bagMod],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 20,
            extenders: ['mod_mounted_1', null, null, null, null],
          },
        },
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    const modTab = Array.from(
      container!.querySelectorAll('[role="tablist"] button')
    ).find((b) => b.textContent?.includes('MÔ-ĐUN')) as HTMLButtonElement;
    expect(modTab).toBeDefined();
    act(() => {
      modTab.click();
    });

    const card = container!.querySelector(
      '[data-testid="inv-card-mod_bag_def"]'
    ) as HTMLButtonElement;
    act(() => {
      card.click();
    });

    const socketList = getDesktopDetail().querySelector(
      '[data-testid="module-socket-list"]'
    ) as HTMLElement;
    expect(socketList).not.toBeNull();
    expect(
      socketList.querySelectorAll('[data-testid^="module-socket-row-"]')
    ).toHaveLength(5);

    const row1 = socketList.querySelector('[data-testid="module-socket-row-1"]')!;
    const row2 = socketList.querySelector('[data-testid="module-socket-row-2"]')!;
    const row3 = socketList.querySelector('[data-testid="module-socket-row-3"]')!;
    expect(row1.getAttribute('data-locked')).toBe('false');
    expect(row1.textContent).toContain('Hỏa lực T1');
    expect(row2.getAttribute('data-locked')).toBe('false');
    expect(row2.textContent).toContain('Trống');
    expect(row3.getAttribute('data-locked')).toBe('true');
    expect(row3.textContent).toContain('Lv 30');
    expect(
      socketList.querySelector('[data-testid="module-socket-equip-3"]')
    ).toBeNull();
  });

  it('3) [Gắn] calls setExtenderModule with the right index and same_effect row is disabled with reason', () => {
    const atk1 = makeModule('mod_atk_1', 'mod_stat_attack_t1');
    const atk2 = makeModule('mod_atk_2', 'mod_stat_attack_t2');
    const def1 = makeModule('mod_def_1', 'mod_stat_defense_t1');
    const spy = vi.spyOn(useGameStore.getState(), 'setExtenderModule');

    useGameStore.setState((s) => ({
      ...s,
      adminConfig: { ...s.adminConfig, extenderLevelsPerSocket: 10 },
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, atk1, atk2, def1],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 20,
            extenders: ['mod_atk_1', null, null, null, null],
          },
        },
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="inv-card-mod_atk_2"]'
        ) as HTMLButtonElement
      ).click();
    });

    const dupBtn2 = getDesktopDetail().querySelector(
      '[data-testid="module-socket-equip-2"]'
    ) as HTMLButtonElement;
    const dupReason2 = getDesktopDetail().querySelector(
      '[data-testid="module-socket-reason-2"]'
    ) as HTMLElement;
    expect(dupBtn2.disabled).toBe(true);
    expect(dupReason2.textContent).toContain('#1');

    act(() => {
      (
        container!.querySelector(
          '[data-testid="inv-card-mod_def_1"]'
        ) as HTMLButtonElement
      ).click();
    });

    const equipBtn2 = getDesktopDetail().querySelector(
      '[data-testid="module-socket-equip-2"]'
    ) as HTMLButtonElement;
    expect(equipBtn2.disabled).toBe(false);
    act(() => {
      equipBtn2.click();
    });

    expect(spy).toHaveBeenCalledWith('striker', 1, 'mod_def_1');
    expect(useGameStore.getState().pilot.gears.striker.extenders?.[1]).toBe(
      'mod_def_1'
    );
    expect(
      getDesktopDetail().querySelector('[data-testid="module-socket-list"]')
    ).not.toBeNull();
  });

  it('4) socket tile opens picker for modules (inventory + warehouse) and [Gỡ] clears the socket', () => {
    const atk1 = makeModule('mod_sock_1', 'mod_stat_attack_t1');
    const whDef = makeModule('mod_wh_def', 'mod_stat_defense_t1');
    const spy = vi.spyOn(useGameStore.getState(), 'setExtenderModule');

    useGameStore.setState((s) => ({
      ...s,
      adminConfig: { ...s.adminConfig, extenderLevelsPerSocket: 10 },
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, atk1],
        warehouse: [...(s.pilot.warehouse ?? []), whDef],
        gears: {
          ...s.pilot.gears,
          striker: {
            ...s.pilot.gears.striker,
            level: 10,
            extenders: ['mod_sock_1', null, null, null, null],
          },
        },
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    const row = container!.querySelector(
      '[data-testid="gear-socket-row"]'
    ) as HTMLElement;
    expect(row).not.toBeNull();
    expect(
      row.querySelectorAll('[data-testid^="gear-socket-tile-"]')
    ).toHaveLength(5);

    const tile1 = row.querySelector(
      '[data-testid="gear-socket-tile-1"]'
    ) as HTMLButtonElement;
    const tile2 = row.querySelector(
      '[data-testid="gear-socket-tile-2"]'
    ) as HTMLButtonElement;
    expect(tile2.disabled).toBe(true);

    act(() => {
      tile1.click();
    });

    const picker = container!.querySelector(
      '[data-testid="gear-swap-picker"]'
    ) as HTMLElement;
    expect(picker).not.toBeNull();
    expect(
      picker.querySelector('[data-testid="gear-swap-row-mod_wh_def"]')
    ).not.toBeNull();

    const unequipBtn = picker.querySelector(
      '[data-testid="gear-swap-unequip-btn"]'
    ) as HTMLButtonElement;
    expect(unequipBtn).not.toBeNull();

    act(() => {
      unequipBtn.click();
    });

    expect(spy).toHaveBeenCalledWith('striker', 0, null);
    expect(useGameStore.getState().pilot.gears.striker.extenders?.[0]).toBeNull();
    expect(
      container!.querySelector('[data-testid="gear-swap-picker"]')
    ).toBeNull();
  });

  it('5) paper-doll picker remains unchanged for equipment slots', () => {
    const spareMod = makeModule('mod_paperdoll_ignore', 'mod_stat_attack_t1');
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        inventory: [...s.pilot.inventory, spareMod],
      },
    }));

    act(() => {
      root!.render(createElement(GearView));
    });

    act(() => {
      (
        container!.querySelector(
          '[data-testid="gear-slot-tile-desktop-main_weapon"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        getDesktopDetail().querySelector(
          '[data-testid="detail-swap-btn"]'
        ) as HTMLButtonElement
      ).click();
    });

    const picker = container!.querySelector(
      '[data-testid="gear-swap-picker"]'
    ) as HTMLElement;
    expect(picker).not.toBeNull();
    expect(
      picker.querySelector('[data-testid="gear-swap-unequip-btn"]')
    ).toBeNull();
    expect(
      picker.querySelector('[data-testid="gear-swap-row-mod_paperdoll_ignore"]')
    ).toBeNull();
  });
});
