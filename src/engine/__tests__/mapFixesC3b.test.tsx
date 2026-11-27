// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeInitialGeneratedMapView,
  MapView,
} from '../../components/MapView';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { setActiveMapPack, validateMapPack } from '../../data/maps';
import { SKILLS_LIST } from '../../data/skills';
import { useGameStore } from '../../store/useGameStore';
import { buildCombatUnit, buildNpcSkillLoadout } from '../combat';
import { doSegmentsCross, generateMapPack } from '../mapGenerator';
import { createFreshCampaignState } from '../migration';

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

function makePointerEvent(
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1
): Event {
  const evt = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(evt, 'clientX', { value: clientX });
  Object.defineProperty(evt, 'clientY', { value: clientY });
  Object.defineProperty(evt, 'pointerId', { value: pointerId });
  return evt;
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

describe('MAP-C3b — world gen names, 2 capitals, click fix, initial view, NPC skill cap', () => {
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
    vi.restoreAllMocks();
  });

  it('1) generator names are unique, deterministic, and enforce 2 capitals for 12/20/50 nodes', () => {
    for (const nodeCount of [12, 20, 50]) {
      const packVi = generateMapPack({
        nodeCount,
        seed: 'ACE77',
        lang: 'vi',
      });
      const packViRepeat = generateMapPack({
        nodeCount,
        seed: 'ACE77',
        lang: 'vi',
      });
      expect(packVi).toEqual(packViRepeat);
      expect(validateMapPack(packVi)).not.toBeNull();

      // Unique non-empty ACE Online / capital names
      const names = packVi.nodes.map((n) => n.name);
      expect(new Set(names).size).toBe(nodeCount);
      expect(names.some((n) => n.startsWith('Căn cứ ') || n.startsWith('Base '))).toBe(
        false
      );

      // Strictly 2 capitals: start (allied) + 1 hostile enemy capital
      const capitals = packVi.nodes.filter((n) => n.baseType === 'capital');
      expect(capitals).toHaveLength(2);
      const startCap = capitals.find((n) => n.id === 'start')!;
      const enemyCap = capitals.find((n) => n.id !== 'start')!;
      expect(startCap.initialFaction).toBe('allied');
      expect(startCap.name).toBe('Liên Minh VSS');
      expect(enemyCap.initialFaction).toBe('hostile');
      expect(enemyCap.name).toBe('Rãnh Void Sovereign');

      // Connected + 0 crossings
      const posById = new Map(packVi.nodes.map((n) => [n.id, n.mapPos]));
      const adj = new Map<string, string[]>(packVi.nodes.map((n) => [n.id, []]));
      for (const lane of packVi.lanes) {
        adj.get(lane.from)?.push(lane.to);
        adj.get(lane.to)?.push(lane.from);
      }
      const seen = new Set<string>(['start']);
      const queue = ['start'];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const nb of adj.get(cur) ?? []) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }
      expect(seen.size).toBe(nodeCount);
      for (let i = 0; i < packVi.lanes.length; i += 1) {
        for (let j = i + 1; j < packVi.lanes.length; j += 1) {
          const l1 = packVi.lanes[i];
          const l2 = packVi.lanes[j];
          const share =
            l1.from === l2.from ||
            l1.from === l2.to ||
            l1.to === l2.from ||
            l1.to === l2.to;
          expect(
            doSegmentsCross(
              posById.get(l1.from)!,
              posById.get(l1.to)!,
              posById.get(l2.from)!,
              posById.get(l2.to)!,
              share
            )
          ).toBe(false);
        }
      }
    }

    // EN capital names
    const packEn = generateMapPack({ nodeCount: 20, seed: 'ACE77', lang: 'en' });
    expect(packEn.nodes.find((n) => n.id === 'start')?.name).toBe('VSS Alliance');
    expect(
      packEn.nodes.find((n) => n.id !== 'start' && n.baseType === 'capital')?.name
    ).toBe('Void Sovereign Trench');
  });

  it('2) no-move pointerdown -> pointerup -> click selects a node without setPointerCapture', () => {
    const rootEl = mount(createElement(MapView));
    const viewport = rootEl.querySelector<HTMLDivElement>(
      '[data-testid="map-viewport-box"]'
    )!;
    const captureSpy = vi.fn();
    const releaseSpy = vi.fn();
    viewport.setPointerCapture = captureSpy;
    viewport.releasePointerCapture = releaseSpy;
    viewport.hasPointerCapture = () => false;

    const targetNode = rootEl.querySelector<SVGGElement>(
      '[data-testid="map-node-aegis_relay"]'
    )!;
    expect(useGameStore.getState().selectedSectorId).toBe('border_outpost');

    act(() => {
      targetNode.dispatchEvent(makePointerEvent('pointerdown', 100, 100));
      targetNode.dispatchEvent(makePointerEvent('pointerup', 102, 101));
      targetNode.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });

    expect(captureSpy).not.toHaveBeenCalled();
    expect(useGameStore.getState().selectedSectorId).toBe('aegis_relay');
  });

  it('3) drag > 6px captures pointer and prevents selecting node; generated map initial view zooms on start', () => {
    const pack20 = generateMapPack({ nodeCount: 20, seed: 'VIEW20' });
    const startNode = pack20.nodes.find((n) => n.id === 'start')!;
    const neighborIds = new Set(
      pack20.lanes
        .filter((l) => l.from === 'start' || l.to === 'start')
        .map((l) => (l.from === 'start' ? l.to : l.from))
    );
    const neighborPos = pack20.nodes
      .filter((n) => neighborIds.has(n.id))
      .map((n) => n.mapPos);
    const genView = computeInitialGeneratedMapView(
      startNode.mapPos,
      neighborPos,
      760,
      320,
      pack20.bounds
    );
    expect(genView.zoom).toBeGreaterThan(1.2);
    expect(genView.pan.x).toBeGreaterThan(0);

    const rootEl = mount(createElement(MapView));
    const viewport = rootEl.querySelector<HTMLDivElement>(
      '[data-testid="map-viewport-box"]'
    )!;
    let captured = false;
    const captureSpy = vi.fn(() => {
      captured = true;
    });
    const releaseSpy = vi.fn(() => {
      captured = false;
    });
    viewport.setPointerCapture = captureSpy;
    viewport.releasePointerCapture = releaseSpy;
    viewport.hasPointerCapture = () => captured;

    const targetNode = rootEl.querySelector<SVGGElement>(
      '[data-testid="map-node-aegis_relay"]'
    )!;
    expect(useGameStore.getState().selectedSectorId).toBe('border_outpost');

    act(() => {
      targetNode.dispatchEvent(makePointerEvent('pointerdown', 100, 100));
      targetNode.dispatchEvent(makePointerEvent('pointermove', 130, 100));
      targetNode.dispatchEvent(makePointerEvent('pointerup', 130, 100));
      targetNode.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });

    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().selectedSectorId).toBe('border_outpost');
  });

  it('4) NPC active skill loadout scales by level cap (Lv1 <= 3, Lv15 <= 6, Lv30 <= 9)', () => {
    for (const cls of ['striker', 'interceptor', 'siege', 'support'] as const) {
      expect(buildNpcSkillLoadout(cls, 1).equippedSkillIds.length).toBeLessThanOrEqual(
        3
      );
      expect(
        buildNpcSkillLoadout(cls, 15).equippedSkillIds.length
      ).toBeLessThanOrEqual(6);
      expect(
        buildNpcSkillLoadout(cls, 30).equippedSkillIds.length
      ).toBeLessThanOrEqual(9);
    }
  });

  it('5) custom activeSlots { initial: 2, everyLevels: 10, max: 4 } caps NPC at <=2 (Lv1) & <=4 (Lv40)', () => {
    const customActiveSlots = { initial: 2, everyLevels: 10, max: 4 };
    const lv1 = buildNpcSkillLoadout('striker', 1, {
      activeSlots: customActiveSlots,
    });
    const lv40 = buildNpcSkillLoadout('striker', 40, {
      activeSlots: customActiveSlots,
    });
    expect(lv1.equippedSkillIds.length).toBeLessThanOrEqual(2);
    expect(lv40.equippedSkillIds.length).toBeLessThanOrEqual(4);

    // Caller-supplied equippedSkillIds on an NPC unit is sliced to the same cap
    const manyStrikerSkills = SKILLS_LIST.filter(
      (s) => s.classScope === 'striker' && s.category === 'normal'
    )
      .slice(0, 7)
      .map((s) => s.id);
    const npcUnit = buildCombatUnit({
      id: 'enemy_cap_test',
      name: 'Cap Raider',
      callsign: 'CR-1',
      side: 'enemy',
      row: 'front',
      classId: 'striker',
      level: 40,
      allocatedPoints: { ...EMPTY_STAT_BLOCK },
      isPlayer: false,
      equippedSkillIds: manyStrikerSkills,
      adminConfig: {
        activeSlots: customActiveSlots,
      } as unknown as Parameters<typeof buildCombatUnit>[0]['adminConfig'],
    });
    expect(npcUnit.equippedSkillIds.length).toBe(4);
  });
});
