// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MapView } from '../../components/MapView';
import { WorldGenAdminBlock } from '../../components/admin/WorldGenAdminBlock';
import { setActiveMapPack, validateMapPack } from '../../data/maps';
import { useGameStore } from '../../store/useGameStore';
import { createFreshCampaignState } from '../migration';
import { doSegmentsCross, generateMapPack } from '../mapGenerator';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(element: React.ReactElement): HTMLDivElement {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
  }
  if (!root) {
    root = createRoot(container);
  }
  act(() => {
    root!.render(element);
  });
  return container;
}

function setInputText(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function resetStoreClean() {
  setActiveMapPack(null);
  const fresh = createFreshCampaignState('Vance', 'striker');
  useGameStore.setState({
    ...fresh,
    battle: null,
    autoRepeatSession: null,
    screen: 'HANGAR',
    activeTab: 'map',
  });
}

describe('MAP-C3 procedural map generator & WorldGenAdminBlock', () => {
  beforeEach(() => {
    resetStoreClean();
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
      container = null;
    }
    setActiveMapPack(null);
  });

  it('1) generateMapPack is valid, deterministic for 12/30/50 & 2 seeds, connected, non-crossing, with 2-3 contested at start', () => {
    for (const nodeCount of [12, 30, 50]) {
      for (const seed of ['ALPHA', 'ORBIT9']) {
        const packA = generateMapPack({ nodeCount, seed });
        const packB = generateMapPack({ nodeCount, seed });
        expect(packA).toEqual(packB);
        expect(validateMapPack(packA)).not.toBeNull();
        expect(packA.nodes).toHaveLength(nodeCount);
        expect(packA.defaultSelectedNodeId).toBe('start');

        const posById = new Map(packA.nodes.map((n) => [n.id, n.mapPos]));
        const adj = new Map<string, string[]>(packA.nodes.map((n) => [n.id, []]));
        for (const lane of packA.lanes) {
          adj.get(lane.from)?.push(lane.to);
          adj.get(lane.to)?.push(lane.from);
        }

        // Connected BFS
        const visited = new Set<string>(['start']);
        const queue = ['start'];
        while (queue.length > 0) {
          const cur = queue.shift()!;
          for (const next of adj.get(cur) ?? []) {
            if (!visited.has(next)) {
              visited.add(next);
              queue.push(next);
            }
          }
        }
        expect(visited.size).toBe(nodeCount);

        // No crossing lanes
        for (let i = 0; i < packA.lanes.length; i += 1) {
          for (let j = i + 1; j < packA.lanes.length; j += 1) {
            const l1 = packA.lanes[i];
            const l2 = packA.lanes[j];
            const share =
              l1.from === l2.from ||
              l1.from === l2.to ||
              l1.to === l2.from ||
              l1.to === l2.to;
            const crosses = doSegmentsCross(
              posById.get(l1.from)!,
              posById.get(l1.to)!,
              posById.get(l2.from)!,
              posById.get(l2.to)!,
              share
            );
            expect(crosses).toBe(false);
          }
        }

        // Only start is allied, and 2-3 neighbours are contested at start
        const alliedNodes = packA.nodes.filter((n) => n.initialFaction === 'allied');
        expect(alliedNodes.map((n) => n.id)).toEqual(['start']);
        const startNeighbors = adj.get('start') ?? [];
        expect(startNeighbors.length).toBeGreaterThanOrEqual(2);
        expect(startNeighbors.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('2) different seeds produce different maps', () => {
    const a = generateMapPack({ nodeCount: 20, seed: 'SEED_A' });
    const b = generateMapPack({ nodeCount: 20, seed: 'SEED_B' });
    expect(a.nodes.map((n) => n.mapPos)).not.toEqual(
      b.nodes.map((n) => n.mapPos)
    );
  });

  it('3) unticked WorldGenAdminBlock apply keeps credits & gears and resets baseStates', () => {
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        credits: 54321,
        gears: {
          ...s.pilot.gears,
          striker: { ...s.pilot.gears.striker, level: 9 },
        },
      },
    }));

    const rootEl = mount(createElement(WorldGenAdminBlock));
    const seedInput = rootEl.querySelector<HTMLInputElement>(
      '[data-testid="world-gen-seed-input"]'
    )!;
    setInputText(seedInput, 'ALPHA20');
    act(() => {
      rootEl
        .querySelector<HTMLButtonElement>('[data-testid="world-gen-create-btn"]')!
        .click();
    });
    expect(
      rootEl.querySelector('[data-testid="world-gen-reset-warning"]')
    ).toBeNull();
    act(() => {
      rootEl
        .querySelector<HTMLButtonElement>('[data-testid="world-gen-confirm-apply"]')!
        .click();
    });

    const next = useGameStore.getState();
    expect(next.pilot.credits).toBe(54321);
    expect(next.pilot.gears.striker.level).toBe(9);
    expect(Object.keys(next.pilot.baseStates)).toHaveLength(20);
    expect(
      rootEl.querySelector('[data-testid="world-gen-result"]')?.textContent
    ).toContain('ALPHA20');
  });

  it('4) ticked WorldGenAdminBlock apply requires RESET, rebuilds pilot, and keeps adminConfig + new map', () => {
    useGameStore.setState((s) => ({
      language: 'en',
      pilot: {
        ...s.pilot,
        name: 'KestrelAce',
        activeGearId: 'interceptor',
        credits: 77777,
        gears: {
          ...s.pilot.gears,
          interceptor: { ...s.pilot.gears.interceptor, unlocked: true, level: 12 },
        },
      },
      adminConfig: {
        ...s.adminConfig,
        rewardMultiplier: 2.5,
      },
    }));

    const rootEl = mount(createElement(WorldGenAdminBlock));
    act(() => {
      rootEl
        .querySelector<HTMLInputElement>(
          '[data-testid="world-gen-reset-progress-checkbox"]'
        )!
        .click();
    });
    act(() => {
      rootEl
        .querySelector<HTMLButtonElement>('[data-testid="world-gen-create-btn"]')!
        .click();
    });

    expect(
      rootEl.querySelector('[data-testid="world-gen-reset-warning"]')
    ).not.toBeNull();
    const confirmBtn = rootEl.querySelector<HTMLButtonElement>(
      '[data-testid="world-gen-confirm-apply"]'
    )!;
    expect(confirmBtn.disabled).toBe(true);

    const resetInput = rootEl.querySelector<HTMLInputElement>(
      '[data-testid="world-gen-confirm-reset-input"]'
    )!;
    setInputText(resetInput, 'RESET');
    expect(confirmBtn.disabled).toBe(false);

    act(() => {
      confirmBtn.click();
    });

    const next = useGameStore.getState();
    expect(next.pilot.name).toBe('KestrelAce');
    expect(next.pilot.activeGearId).toBe('interceptor');
    expect(next.pilot.credits).toBe(350);
    expect(next.pilot.gears.interceptor.level).toBe(1);
    expect(Object.keys(next.pilot.baseStates)).toHaveLength(20);
    expect(next.adminConfig.rewardMultiplier).toBe(2.5);
    expect(next.adminConfig.mapPack?.nodes).toHaveLength(20);
    expect(next.language).toBe('en');
    expect(next.screen).toBe('HANGAR');
  });

  it('5) MapView viewBox follows active map bounds and keeps 0 0 840 310 for built-in map', () => {
    const rootEl = mount(createElement(MapView));
    const svgBuiltIn = rootEl.querySelector('svg[role="img"]');
    expect(svgBuiltIn?.getAttribute('viewBox')).toBe('0 0 840 310');

    const pack30 = generateMapPack({ nodeCount: 30, seed: 'BIG30' });
    act(() => {
      useGameStore.getState().applyMapPack(pack30);
    });
    mount(createElement(MapView));
    const svgBig = rootEl.querySelector('svg[role="img"]');
    expect(svgBig?.getAttribute('viewBox')).toBe(
      `0 0 ${pack30.bounds.width} ${pack30.bounds.height}`
    );
    expect(pack30.bounds.width).toBeGreaterThan(840);
    expect(pack30.bounds.height).toBeGreaterThan(310);
  });
});
