// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import {
  getMapLaneVisualKind,
  getMapNodeVisualState,
  MapView,
} from '../MapView';

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

describe('TASK MAP-F2 — Map Frontline Nodes, Lanes, Legend, Briefing Options & CTAs', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().setLanguage('vi');
    useGameStore.getState().selectSector('border_outpost');
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

  it('1) assigns node data-state and hides undiscovered nodes on fresh save, then updates after capture', () => {
    act(() => {
      root.render(createElement(MapView));
    });

    // Fresh save: aegis_relay allied-frontline (with orange top-right dot), border_outpost & veridian_colony contested
    const aegisNode = container.querySelector('[data-testid="map-node-aegis_relay"]')!;
    const borderNode = container.querySelector('[data-testid="map-node-border_outpost"]')!;
    const veridianNode = container.querySelector('[data-testid="map-node-veridian_colony"]')!;
    expect(aegisNode).not.toBeNull();
    expect(aegisNode.getAttribute('data-state')).toBe('allied-frontline');
    expect(
      container.querySelector('[data-testid="map-node-frontline-dot-aegis_relay"]')?.getAttribute('fill')
    ).toBe('#f59e0b');

    expect(borderNode.getAttribute('data-state')).toBe('contested');
    const borderRing = container.querySelector(
      '[data-testid="map-node-contested-ring-border_outpost"]'
    )!;
    expect(borderRing.getAttribute('stroke')).toBe('#F59E0B');
    expect(borderRing.getAttribute('stroke-width')).toBe('2');
    expect(borderRing.getAttribute('class')).toContain('anim-contested-pulse');
    expect(
      container.querySelector('[data-testid="map-node-contested-chip-border_outpost"]')?.textContent
    ).toBe('Giao tranh');

    expect(veridianNode.getAttribute('data-state')).toBe('contested');

    // Hidden nodes are NOT rendered on fresh save
    expect(container.querySelector('[data-testid="map-node-debris_belt"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-node-iron_citadel"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-node-vanguard_shipyard"]')).toBeNull();

    // Capture border_outpost -> border_outpost becomes allied-frontline, debris_belt becomes contested
    act(() => {
      useGameStore.setState((s) => ({
        pilot: {
          ...s.pilot,
          baseStates: {
            ...s.pilot.baseStates,
            border_outpost: {
              ...s.pilot.baseStates.border_outpost,
              siegeShield: 0,
              siegeHp: 1,
            },
            veridian_colony: {
              ...s.pilot.baseStates.veridian_colony,
              siegeShield: 0,
              siegeHp: 1,
              lastAttackedMonth: s.pilot.campaignMonth,
            },
          },
        },
      }));
      useGameStore.getState().startBattle('border_outpost');
      useGameStore.getState().forceWinBattle();
    });
    expect(
      container.querySelector('[data-testid="map-node-border_outpost"]')?.getAttribute('data-state')
    ).toBe('allied-frontline');
    expect(
      container.querySelector('[data-testid="map-node-frontline-dot-border_outpost"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="map-node-debris_belt"]')?.getAttribute('data-state')
    ).toBe('contested');
    // iron_citadel still hidden
    expect(container.querySelector('[data-testid="map-node-iron_citadel"]')).toBeNull();

    // Capture veridian_colony too -> aegis_relay has no hostile neighbor -> pure allied (dot removed)
    act(() => {
      useGameStore.getState().startBattle('veridian_colony');
      useGameStore.getState().forceWinBattle();
    });
    expect(
      container.querySelector('[data-testid="map-node-aegis_relay"]')?.getAttribute('data-state')
    ).toBe('allied');
    expect(
      container.querySelector('[data-testid="map-node-frontline-dot-aegis_relay"]')
    ).toBeNull();
  });

  it('2) renders visible non-contested nodes as locked (opacity 0.45 + padlock) and opens briefing when tapped', () => {
    setViewport(390, 844);
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        unlockedSectorIds: [...s.pilot.unlockedSectorIds, 'iron_citadel'],
      },
    }));

    act(() => {
      root.render(createElement(MapView));
    });

    const ironNode = container.querySelector<SVGGElement>(
      '[data-testid="map-node-iron_citadel"]'
    )!;
    expect(ironNode).not.toBeNull();
    expect(ironNode.getAttribute('data-state')).toBe('locked');
    expect(ironNode.getAttribute('opacity')).toBe('0.45');
    expect(
      container.querySelector('[data-testid="map-node-lock-iron_citadel"]')
    ).not.toBeNull();

    // Tapping locked node selects it and opens mobile briefing sheet with muted blocked reason
    act(() => {
      ironNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(useGameStore.getState().selectedSectorId).toBe('iron_citadel');
    expect(
      document.body.querySelector('[data-testid="map-briefing-options-blocked"]')
        ?.textContent
    ).toBe('Chưa tiếp giáp lãnh thổ ta — chiếm một căn cứ kề bên trước');
  });

  it('3) assigns lane data-kind, omits lanes touching hidden nodes, keeps raid animation, and shows 2 new legend entries', () => {
    const pilotFresh = useGameStore.getState().pilot;
    expect(getMapNodeVisualState(pilotFresh, 'debris_belt')).toBe('hidden');
    expect(
      getMapLaneVisualKind(pilotFresh, {
        from: 'border_outpost',
        to: 'debris_belt',
      })
    ).toBe('hidden');

    act(() => {
      root.render(createElement(MapView));
    });

    // Fresh save: hidden lanes not rendered
    expect(container.querySelector('[data-testid="map-lane-lane_border_caldera"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-lane-lane_veridian_shipyard"]')).toBeNull();

    // allied-to-contested lanes: aegis_relay <-> border_outpost (has incoming raid on fresh save) & aegis_relay <-> veridian_colony (orange dashed 2px)
    const laneAegisBorder = container.querySelector(
      '[data-testid="map-lane-lane_aegis_border"]'
    )!;
    const laneAegisVeridian = container.querySelector(
      '[data-testid="map-lane-lane_aegis_veridian"]'
    )!;
    const laneBorderVeridian = container.querySelector(
      '[data-testid="map-lane-lane_border_veridian"]'
    )!;

    expect(laneAegisBorder.getAttribute('data-kind')).toBe('allied-to-contested');
    // Raid animation preserved on lane_aegis_border when aegis_relay is underAttack from border_outpost
    expect(laneAegisBorder.getAttribute('class')).toContain('anim-lane-flow');
    expect(laneAegisBorder.parentElement?.querySelectorAll('animateMotion').length).toBe(3);

    expect(laneAegisVeridian.getAttribute('data-kind')).toBe('allied-to-contested');
    expect(laneAegisVeridian.getAttribute('stroke')).toBe('#F59E0B');
    expect(laneAegisVeridian.getAttribute('stroke-width')).toBe('2');
    expect(laneAegisVeridian.getAttribute('stroke-dasharray')).toBe('6 4');

    // Non-allied visible lane gets data-kind="other" + opacity 0.35
    expect(laneBorderVeridian.getAttribute('data-kind')).toBe('other');
    expect(laneBorderVeridian.getAttribute('opacity')).toBe('0.35');

    // After capturing border_outpost & veridian_colony -> lane_aegis_veridian becomes allied-allied, lane_border_caldera becomes allied-to-contested
    act(() => {
      useGameStore.setState((s) => ({
        pilot: {
          ...s.pilot,
          baseStates: {
            ...s.pilot.baseStates,
            border_outpost: {
              ...s.pilot.baseStates.border_outpost,
              siegeShield: 0,
              siegeHp: 1,
            },
            veridian_colony: {
              ...s.pilot.baseStates.veridian_colony,
              siegeShield: 0,
              siegeHp: 1,
              lastAttackedMonth: s.pilot.campaignMonth,
            },
          },
        },
      }));
      useGameStore.getState().startBattle('border_outpost');
      useGameStore.getState().forceWinBattle();
      useGameStore.getState().startBattle('veridian_colony');
      useGameStore.getState().forceWinBattle();
    });

    expect(
      container
        .querySelector('[data-testid="map-lane-lane_aegis_veridian"]')
        ?.getAttribute('data-kind')
    ).toBe('allied-allied');
    expect(
      container
        .querySelector('[data-testid="map-lane-lane_border_caldera"]')
        ?.getAttribute('data-kind')
    ).toBe('allied-to-contested');

    // Legend includes both new entries
    expect(
      container.querySelector('[data-testid="map-legend-contested"]')?.textContent
    ).toContain('Giao tranh');
    expect(
      container.querySelector('[data-testid="map-legend-locked"]')?.textContent
    ).toContain('Chưa tiếp giáp');
  });

  it('4) renders "Trận có thể đánh" option rows only for allowed map kinds and launches chosen kind', () => {
    // 2 allowed options on aegis_relay (defend + patrol)
    useGameStore.getState().selectSector('aegis_relay');
    act(() => {
      root.render(createElement(MapView));
    });

    expect(
      container.querySelector('[data-testid="map-briefing-options"]')?.textContent
    ).toContain('Trận có thể đánh');
    expect(
      container.querySelector('[data-testid="map-option-row-defend"]')?.textContent
    ).toContain('Phòng thủ 4v4');
    expect(
      container.querySelector('[data-testid="map-option-row-patrol"]')?.textContent
    ).toContain('Tuần tra 4v4');
    expect(container.querySelector('[data-testid="map-option-row-assault"]')).toBeNull();

    // Clicking [Xuất kích] on the Patrol row starts a patrol battle!
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="map-option-deploy-patrol"]')!
        .click();
    });
    expect(useGameStore.getState().battle?.sectorId).toBe('aegis_relay');
    expect(useGameStore.getState().battle?.kind).toBe('patrol');
  });

  it('5) shows node battle size in option row (e.g. 6v6 debris_belt) and single muted line + disabled CTA when nothing is allowed', () => {
    // Capture border_outpost so debris_belt (6v6) is contested -> "Tấn công 6v6"
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        baseStates: {
          ...s.pilot.baseStates,
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            siegeShield: 0,
            siegeHp: 1,
          },
        },
      },
    }));
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().forceWinBattle();
    useGameStore.getState().selectSector('debris_belt');

    act(() => {
      root.render(createElement(MapView));
    });

    expect(
      container.querySelector('[data-testid="map-option-row-assault"]')?.textContent
    ).toContain('Tấn công 6v6');
    expect(container.querySelector('[data-testid="map-option-row-defend"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-option-row-patrol"]')).toBeNull();

    // Switch to rear allied base (make veridian_colony allied & clear aegis raid) -> 0 allowed rows, 1 muted line, disabled CTA
    act(() => {
      useGameStore.setState((s) => ({
        selectedSectorId: 'aegis_relay',
        pilot: {
          ...s.pilot,
          baseStates: {
            ...s.pilot.baseStates,
            aegis_relay: {
              ...s.pilot.baseStates.aegis_relay,
              faction: 'allied',
              underAttack: false,
            },
            veridian_colony: {
              ...s.pilot.baseStates.veridian_colony,
              faction: 'allied',
              underAttack: false,
            },
          },
        },
      }));
    });

    expect(container.querySelectorAll('[data-testid^="map-option-row-"]')).toHaveLength(0);
    expect(
      container.querySelector('[data-testid="map-briefing-options-blocked"]')?.textContent
    ).toBe('Căn cứ hậu phương — không có giao tranh trực tiếp');
    const desktopDeployBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-deploy-btn"]'
    )!;
    expect(desktopDeployBtn.disabled).toBe(true);
    expect(
      container.querySelector('[data-testid="map-deploy-blocked-reason"]')?.textContent
    ).toBe(VI_TRANSLATIONS['map.reason.rearBase']);
  });

  it('6) phone sticky CTA keeps short label when 2+ options exist, triggers pickDefaultBattle, and disables with reason sublabel when blocked', () => {
    setViewport(390, 844);
    // Select aegis_relay where BOTH defend and patrol are allowed -> pickDefaultBattle = defend
    useGameStore.getState().selectSector('aegis_relay');
    act(() => {
      root.render(createElement(MapView));
    });

    const phoneBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-phone-deploy-btn"]'
    )!;
    expect(phoneBtn.disabled).toBe(false);
    expect(phoneBtn.className).toContain('h-[44px]');
    // Short label kept even with 2+ options
    expect(phoneBtn.textContent).toContain(VI_TRANSLATIONS['map.deployShort']);
    expect(phoneBtn.textContent).toContain('Lv.');

    act(() => {
      phoneBtn.click();
    });
    expect(useGameStore.getState().battle?.sectorId).toBe('aegis_relay');
    expect(useGameStore.getState().battle?.kind).toBe('defend');

    // Now block aegis_relay (rear base, no raid) -> disabled + reason as sublabel inside h-[44px]
    act(() => {
      useGameStore.setState((s) => ({
        battle: null,
        screen: 'HANGAR',
        activeTab: 'map',
        selectedSectorId: 'aegis_relay',
        pilot: {
          ...s.pilot,
          baseStates: {
            ...s.pilot.baseStates,
            aegis_relay: {
              ...s.pilot.baseStates.aegis_relay,
              faction: 'allied',
              underAttack: false,
            },
            border_outpost: {
              ...s.pilot.baseStates.border_outpost,
              faction: 'allied',
              underAttack: false,
            },
            veridian_colony: {
              ...s.pilot.baseStates.veridian_colony,
              faction: 'allied',
              underAttack: false,
            },
          },
        },
      }));
    });

    const disabledPhoneBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-phone-deploy-btn"]'
    )!;
    expect(disabledPhoneBtn.disabled).toBe(true);
    expect(disabledPhoneBtn.className).toContain('h-[44px]');
    expect(
      container.querySelector('[data-testid="map-phone-deploy-sublabel"]')?.textContent
    ).toBe(VI_TRANSLATIONS['map.reason.rearBase']);
  });

  it('7) disables pulse under prefers-reduced-motion and preserves exact vi/en translation parity', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.anim-contested-pulse[\s\S]*?animation:\s*none/);
    expect(css).toContain('[data-reduced-motion="true"] .anim-contested-pulse');

    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);

    for (const k of [
      'map.legendContested',
      'map.legendLocked',
      'map.nodeChipContested',
      'map.briefingOptionsTitle',
      'map.optionLabel.assault',
      'map.optionLabel.defend',
      'map.optionLabel.patrol',
      'map.briefingReason.notFrontline',
      'map.briefingReason.rearBase',
      'map.briefingReason.hidden',
    ] as const) {
      expect(VI_TRANSLATIONS[k]).toBeTruthy();
      expect(EN_TRANSLATIONS[k]).toBeTruthy();
    }
  });
});
