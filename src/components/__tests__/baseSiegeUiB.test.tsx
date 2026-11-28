// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeWinsRemaining,
  DEFAULT_BASE_SIEGE_CONFIG,
  getBaseSiegeLabel,
  getSiegePct,
} from '../../engine/baseSiege';
import { useGameStore } from '../../store/useGameStore';
import type { BaseRuntimeState } from '../../types/game';
import { MapView } from '../MapView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
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

function makeBase(
  overrides: Partial<BaseRuntimeState> = {}
): BaseRuntimeState {
  return {
    faction: 'hostile',
    status: 'operational',
    repairMonthsRemaining: 0,
    underAttack: false,
    attackCountdownMonths: 0,
    attackFromSectorId: null,
    ...overrides,
  };
}

describe('TASK BASE-SIEGE-b — Base Siege UI & Helpers', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
  });

  it('1) getBaseSiegeLabel covers all 5 cases', () => {
    const cfg = DEFAULT_BASE_SIEGE_CONFIG;
    expect(
      getBaseSiegeLabel(makeBase({ faction: 'allied' }), 'outpost', cfg, 5)
    ).toBe('ally_held');
    expect(
      getBaseSiegeLabel(makeBase({ faction: 'hostile' }), 'outpost', cfg, 5)
    ).toBe('enemy_held');
    expect(
      getBaseSiegeLabel(makeBase({ faction: 'neutral' }), 'outpost', cfg, 5)
    ).toBe('neutral');
    // Below max + attacked < idleMonths ago => contested
    expect(
      getBaseSiegeLabel(
        makeBase({
          faction: 'hostile',
          siegeShield: 500,
          siegeHp: 600,
          lastAttackedMonth: 4,
        }),
        'outpost',
        cfg,
        5
      )
    ).toBe('contested');
    // Below max + idle >= idleMonths => recovering
    expect(
      getBaseSiegeLabel(
        makeBase({
          faction: 'hostile',
          siegeShield: 500,
          siegeHp: 600,
          lastAttackedMonth: 2,
        }),
        'outpost',
        cfg,
        5
      )
    ).toBe('recovering');
  });

  it('2) computeWinsRemaining and getSiegePct compute remaining wins and percentages', () => {
    const cfg = DEFAULT_BASE_SIEGE_CONFIG;
    expect(computeWinsRemaining({ shield: 1000, hp: 600 }, cfg)).toBe(5);
    expect(computeWinsRemaining({ shield: 500, hp: 600 }, cfg)).toBe(4);
    expect(computeWinsRemaining({ shield: 0, hp: 150 }, cfg)).toBe(1);
    expect(computeWinsRemaining({ shield: 0, hp: 0 }, cfg)).toBe(0);
    expect(
      getSiegePct({ shield: 500, hp: 150, maxShield: 1000, maxHp: 600 })
    ).toEqual({ shieldPct: 50, hpPct: 25 });
  });

  it('3) briefing shows bars + label + wins remaining for damaged hostile base, list %, and repair buttons only for allied', () => {
    useGameStore.setState((s) => ({
      selectedSectorId: 'border_outpost',
      pilot: {
        ...s.pilot,
        campaignMonth: 5,
        credits: 5000,
        baseStates: {
          ...s.pilot.baseStates,
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            siegeShield: 0,
            siegeHp: 120,
            lastAttackedMonth: 4,
          },
        },
      },
    }));

    act(() => {
      root.render(createElement(MapView));
    });

    const siegeBlock = container.querySelector(
      '[data-testid="map-briefing-siege-block"]'
    )!;
    expect(siegeBlock).not.toBeNull();
    expect(
      container.querySelector('[data-testid="map-briefing-siege-label"]')
        ?.textContent
    ).toBe('Đang giao tranh');
    expect(siegeBlock.textContent).toContain('0 / 1,000 (0%)');
    expect(siegeBlock.textContent).toContain('120 / 600 (20%)');
    // Shield 0 + HP < 30% => danger red bar
    expect(
      container
        .querySelector('[data-testid="map-briefing-siege-hp-bar"]')
        ?.getAttribute('data-danger')
    ).toBe('true');
    expect(
      container.querySelector('[data-testid="map-briefing-siege-wins"]')
        ?.textContent
    ).toContain('1');
    // Repair buttons hidden on hostile base
    expect(
      container.querySelector('[data-testid="map-briefing-siege-repairs"]')
    ).toBeNull();
    // List shows compact S % · H % only for below-max base
    expect(
      container.querySelector('[data-testid="map-list-siege-pct-border_outpost"]')
        ?.textContent
    ).toBe('S 0% · H 20%');
    expect(
      container.querySelector('[data-testid="map-list-siege-pct-aegis_relay"]')
    ).toBeNull();

    // Switch to damaged allied base -> repair buttons appear & repair click updates pool + message
    act(() => {
      useGameStore.setState((s) => ({
        selectedSectorId: 'aegis_relay',
        pilot: {
          ...s.pilot,
          baseStates: {
            ...s.pilot.baseStates,
            aegis_relay: {
              ...s.pilot.baseStates.aegis_relay,
              siegeShield: 500,
              siegeHp: 400,
              lastAttackedMonth: 4,
            },
          },
        },
      }));
    });

    const hpBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="briefing-repair-hp-btn"]'
    )!;
    expect(hpBtn).not.toBeNull();
    expect(hpBtn.textContent).toContain('+150');
    expect(hpBtn.textContent).toContain('1,100 CR');

    act(() => {
      hpBtn.click();
    });
    expect(
      container.querySelector('[data-testid="briefing-repair-feedback"]')
        ?.textContent
    ).toContain('Đã sửa HP +150, -1,100 CR');
    expect(
      useGameStore.getState().pilot.baseStates.aegis_relay.siegeHp
    ).toBe(550);
  });

  it('4) repair buttons show disabled reasons for full, cooldown, no_credits, and busy', () => {
    useGameStore.setState((s) => ({
      selectedSectorId: 'aegis_relay',
      pilot: {
        ...s.pilot,
        campaignMonth: 5,
        credits: 500,
        baseStates: {
          ...s.pilot.baseStates,
          aegis_relay: {
            ...s.pilot.baseStates.aegis_relay,
            siegeShield: 1000,
            siegeHp: 400,
            lastRepairHpMonth: 4,
          },
        },
      },
    }));

    act(() => {
      root.render(createElement(MapView));
    });

    // Shield full, HP on cooldown (5 < 4 + 3 => wait 2 months)
    expect(
      container.querySelector('[data-testid="briefing-repair-shield-reason"]')
        ?.textContent
    ).toBe('Đã đầy');
    expect(
      container.querySelector('[data-testid="briefing-repair-hp-reason"]')
        ?.textContent
    ).toBe('Chờ 2 tháng');

    // Clear cooldown -> no_credits
    act(() => {
      useGameStore.setState((s) => ({
        pilot: {
          ...s.pilot,
          baseStates: {
            ...s.pilot.baseStates,
            aegis_relay: {
              ...s.pilot.baseStates.aegis_relay,
              lastRepairHpMonth: undefined,
            },
          },
        },
      }));
    });
    expect(
      container.querySelector('[data-testid="briefing-repair-hp-reason"]')
        ?.textContent
    ).toBe('Thiếu credit');

    // Active battle -> busy
    act(() => {
      useGameStore.getState().startBattle('aegis_relay');
    });
    expect(
      container.querySelector('[data-testid="briefing-repair-hp-reason"]')
        ?.textContent
    ).toBe('Đang bận');
  });

  it('5) token damage pip appears only when pool is below max (amber w/ shield, red w/ shield 0)', () => {
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        baseStates: {
          ...s.pilot.baseStates,
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            siegeShield: 500,
            siegeHp: 600,
          },
          veridian_colony: {
            ...s.pilot.baseStates.veridian_colony,
            siegeShield: 0,
            siegeHp: 400,
          },
        },
      },
    }));

    act(() => {
      root.render(createElement(MapView));
    });

    // Full base aegis_relay has no pip
    expect(
      container.querySelector('[data-testid="map-node-siege-pip-aegis_relay"]')
    ).toBeNull();

    // Shield > 0 below max -> amber pip <= 6px, pointer-events none
    const outpostPip = container.querySelector(
      '[data-testid="map-node-siege-pip-border_outpost"]'
    )!;
    expect(outpostPip).not.toBeNull();
    expect(outpostPip.getAttribute('fill')).toBe('#F59E0B');
    expect(Number(outpostPip.getAttribute('r'))).toBeLessThanOrEqual(3);
    expect(outpostPip.getAttribute('pointer-events')).toBe('none');

    // Shield === 0 -> red pip
    const veridianPip = container.querySelector(
      '[data-testid="map-node-siege-pip-veridian_colony"]'
    )!;
    expect(veridianPip).not.toBeNull();
    expect(veridianPip.getAttribute('fill')).toBe('#EF4444');
  });
});
