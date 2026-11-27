// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../store/useGameStore';
import { MapView } from '../MapView';
import { PirateAdminBlock } from '../admin/PirateAdminBlock';

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

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  );
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('TASK PIRATE-1b — Map skull badge, briefing option & PirateAdminBlock', () => {
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
    vi.restoreAllMocks();
  });

  it('1) renders skull badge only on incident nodes with title and legend entry', () => {
    useGameStore.setState((state) => ({
      pilot: {
        ...state.pilot,
        pirateIncidents: [
          {
            id: 'pir_1_badge',
            nodeId: 'aegis_relay',
            size: 6,
            createdMonth: 1,
            expiresMonth: 3,
          },
        ],
      },
    }));

    act(() => {
      root.render(createElement(MapView));
    });

    const aegisBadge = container.querySelector(
      '[data-testid="map-node-aegis_relay"] [data-pirate="true"]'
    );
    expect(aegisBadge).not.toBeNull();
    expect(aegisBadge?.getAttribute('title')).toBe(
      'Cướp biển 6v6 · còn 2 tháng'
    );
    expect(
      container.querySelector(
        '[data-testid="map-node-border_outpost"] [data-pirate="true"]'
      )
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="map-legend-pirates"]')
    ).not.toBeNull();

    // Phone viewport keeps the same badge on incident node
    act(() => {
      setViewport(360, 780);
    });
    expect(
      container.querySelector(
        '[data-testid="map-node-aegis_relay"] [data-pirate="true"]'
      )
    ).not.toBeNull();
  });

  it('2) shows "Truy quét cướp biển 6v6" + [Xuất kích] option row in briefing', () => {
    useGameStore.getState().selectSector('aegis_relay');
    useGameStore.setState((state) => ({
      pilot: {
        ...state.pilot,
        pirateIncidents: [
          {
            id: 'pir_1_opt',
            nodeId: 'aegis_relay',
            size: 6,
            createdMonth: 1,
            expiresMonth: 3,
          },
        ],
      },
    }));

    act(() => {
      root.render(createElement(MapView));
    });

    const row = container.querySelector(
      '[data-testid="map-option-row-event"]'
    );
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('Truy quét cướp biển 6v6');
    expect(
      row?.querySelector('[data-testid="map-option-deploy-event"]')?.textContent
    ).toContain('Xuất kích');
  });

  it('3) rejects all-zero size weights and keeps valid weights in store', () => {
    act(() => {
      root.render(createElement(PirateAdminBlock, { flash: vi.fn() }));
    });

    const w4 = container.querySelector(
      '[data-testid="admin-pirates-weight-4"]'
    ) as HTMLInputElement;
    const w6 = container.querySelector(
      '[data-testid="admin-pirates-weight-6"]'
    ) as HTMLInputElement;
    const w8 = container.querySelector(
      '[data-testid="admin-pirates-weight-8"]'
    ) as HTMLInputElement;

    act(() => {
      setInputValue(w4, '0');
    });
    act(() => {
      setInputValue(w6, '0');
    });
    act(() => {
      setInputValue(w8, '0');
    });

    expect(
      container.querySelector('[data-testid="pirate-weights-error"]')
    ).not.toBeNull();
    const saved = useGameStore.getState().adminConfig.pirates?.sizeWeights;
    expect((saved?.[4] ?? 0) + (saved?.[6] ?? 0) + (saved?.[8] ?? 0)).toBeGreaterThan(
      0
    );
  });

  it('4) [Phát sinh ngay] spawns one incident and respects maxActive', () => {
    useGameStore.getState().adminSetBaseFaction('border_outpost', 'allied');
    useGameStore.getState().adminUpdateConfig({
      pirates: {
        enabled: true,
        maxActive: 1,
        spawnChancePerMonth: 0.5,
        ensureOneWhenIdle: true,
        sizeWeights: { 4: 40, 6: 35, 8: 25 },
        expiryMonths: 3,
        rewardMult: 1,
      },
    });

    act(() => {
      root.render(createElement(PirateAdminBlock, { flash: vi.fn() }));
    });

    const spawnBtn = container.querySelector(
      '[data-testid="admin-pirates-spawn-btn"]'
    ) as HTMLButtonElement;
    expect(spawnBtn.textContent).toContain('Phát sinh ngay');

    act(() => {
      spawnBtn.click();
    });
    expect(useGameStore.getState().pilot.pirateIncidents?.length).toBe(1);

    act(() => {
      spawnBtn.click();
    });
    expect(useGameStore.getState().pilot.pirateIncidents?.length).toBe(1);
  });

  it('5) [Xóa] removes the selected active incident', () => {
    useGameStore.setState((state) => ({
      pilot: {
        ...state.pilot,
        pirateIncidents: [
          {
            id: 'pir_1_del',
            nodeId: 'aegis_relay',
            size: 4,
            createdMonth: 1,
            expiresMonth: 4,
          },
        ],
      },
    }));

    act(() => {
      root.render(createElement(PirateAdminBlock, { flash: vi.fn() }));
    });

    const delBtn = container.querySelector(
      '[data-testid="admin-pirates-remove-pir_1_del"]'
    ) as HTMLButtonElement;
    expect(delBtn.textContent).toContain('Xóa');

    act(() => {
      delBtn.click();
    });

    expect(useGameStore.getState().pilot.pirateIncidents).toEqual([]);
    expect(
      container.querySelector('[data-testid="admin-pirates-empty"]')
    ).not.toBeNull();
  });
});
