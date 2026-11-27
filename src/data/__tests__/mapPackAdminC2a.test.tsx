// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPanel } from '../../components/AdminPanel';
import {
  CURRENT_SAVE_VERSION,
  createFreshCampaignState,
  migrateSaveData,
} from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { MapPackDefinition } from '../../types/game';
import {
  MAP_LANES,
  SECTORS_CATALOG,
  getActiveMap,
  getBuiltInMapPack,
  sanitizeMapPack,
  setActiveMapPack,
  validateMapPackDetailed,
} from '../maps';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function buildCustomMapPackFixture(): MapPackDefinition {
  const builtin = getBuiltInMapPack();
  const baseA = structuredClone(builtin.nodes[3]); // aegis_relay (allied)
  const baseB = structuredClone(builtin.nodes[0]); // border_outpost (hostile)
  const baseC = structuredClone(builtin.nodes[2]); // iron_citadel (hostile, far)

  baseA.id = 'alpha_hq';
  baseA.name = 'Alpha HQ';
  baseA.initialFaction = 'allied';
  baseA.mapPos = { x: 120, y: 150 };

  baseB.id = 'beta_gate';
  baseB.name = 'Beta Gate';
  baseB.initialFaction = 'hostile';
  baseB.mapPos = { x: 420, y: 150 };

  baseC.id = 'gamma_core';
  baseC.name = 'Gamma Core';
  baseC.initialFaction = 'hostile';
  baseC.mapPos = { x: 700, y: 150 };

  return {
    schemaVersion: 1,
    mapId: 'custom_frontier_3',
    nameVi: 'Mặt trận 3 căn cứ',
    nameEn: '3-Node Frontier',
    bounds: { width: 840, height: 310 },
    defaultSelectedNodeId: 'beta_gate',
    initialRaid: null,
    baseTypes: structuredClone(builtin.baseTypes),
    nodes: [baseA, baseB, baseC],
    lanes: [
      { id: 'lane_alpha_beta', from: 'alpha_hq', to: 'beta_gate' },
      { id: 'lane_beta_gamma', from: 'beta_gate', to: 'gamma_core' },
    ],
  };
}

async function flushUi(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('TASK MAP-C2a — Admin map pack (store, world reset, export/import UI)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setActiveMapPack(null);
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('MapTester', 'striker');
    useGameStore.getState().setLanguage('vi');
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
    setActiveMapPack(null);
    vi.restoreAllMocks();
  });

  it('1) sanitizer keeps valid custom mapPack and drops invalid mapPack with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const customPack = buildCustomMapPackFixture();

    const validResult = sanitizeMapPack(customPack);
    expect(validResult?.mapId).toBe('custom_frontier_3');

    const migratedValid = migrateSaveData(
      {
        ...createFreshCampaignState('Pilot', 'striker'),
        adminConfig: { mapPack: customPack },
      },
      CURRENT_SAVE_VERSION
    );
    expect(migratedValid.adminConfig.mapPack?.mapId).toBe('custom_frontier_3');
    expect(getActiveMap().mapId).toBe('custom_frontier_3');
    expect(SECTORS_CATALOG.map((n) => n.id)).toEqual([
      'alpha_hq',
      'beta_gate',
      'gamma_core',
    ]);

    const invalidPack = { schemaVersion: 1, mapId: 'broken', nodes: [] };
    expect(sanitizeMapPack(invalidPack)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    const migratedInvalid = migrateSaveData(
      {
        ...createFreshCampaignState('Pilot', 'striker'),
        adminConfig: { mapPack: invalidPack },
      },
      CURRENT_SAVE_VERSION
    );
    expect(migratedInvalid.adminConfig.mapPack).toBeNull();
    expect(getActiveMap().mapId).toBe('sys_orbital_6');
  });

  it('2) applyMapPack resets map state, preserves character/credits/WP/items/gears, and refreshes SECTORS_CATALOG & MAP_LANES in place', () => {
    const catalogRef = SECTORS_CATALOG;
    const lanesRef = MAP_LANES;
    const customPack = buildCustomMapPackFixture();

    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        credits: 98765,
        warPoints: 432,
        campaignMonth: 9,
        capturedSectorIds: ['border_outpost'],
        unlockedSectorIds: ['aegis_relay', 'border_outpost', 'iron_citadel'],
        activeBonusMission: {
          id: 'mission_test_1',
          sourceSectorId: 'aegis_relay',
          targetSectorId: 'border_outpost',
          rewardCredits: 500,
          rewardWarPoints: 10,
          completed: false,
        },
        hiredWingman: {
          callsign: 'Nova Kestrel',
          classId: 'interceptor',
          bonusLevel: 2,
          sourceSectorId: 'aegis_relay',
        },
        worldClock: {
          ...s.pilot.worldClock,
          worldDay: 14,
          speedMode: 'fast',
          lastTickAt: 99999,
        },
      },
      selectedSectorId: 'iron_citadel',
    }));

    const beforeInvLen = useGameStore.getState().pilot.inventory.length;
    const beforeWhLen = useGameStore.getState().pilot.warehouse.length;
    const beforeLevel = useGameStore.getState().pilot.gears.striker.level;

    const res = useGameStore.getState().applyMapPack(customPack);
    expect(res).toEqual({ ok: true, nodes: 3, lanes: 2 });

    expect(SECTORS_CATALOG).toBe(catalogRef);
    expect(MAP_LANES).toBe(lanesRef);
    expect(SECTORS_CATALOG.map((n) => n.id)).toEqual([
      'alpha_hq',
      'beta_gate',
      'gamma_core',
    ]);
    expect(MAP_LANES.map((l) => l.id)).toEqual([
      'lane_alpha_beta',
      'lane_beta_gamma',
    ]);

    const after = useGameStore.getState();
    expect(after.adminConfig.mapPack?.mapId).toBe('custom_frontier_3');
    expect(after.selectedSectorId).toBe('beta_gate');
    expect(after.pilot.campaignMonth).toBe(1);
    expect(after.pilot.capturedSectorIds).toEqual([]);
    expect(after.pilot.activeBonusMission).toBeNull();
    expect(after.pilot.hiredWingman).toBeNull();
    expect(after.pilot.worldClock.worldDay).toBe(0);
    expect(after.pilot.unlockedSectorIds).toEqual(['alpha_hq', 'beta_gate']);
    expect(Object.keys(after.pilot.baseStates)).toEqual([
      'alpha_hq',
      'beta_gate',
      'gamma_core',
    ]);

    expect(after.pilot.credits).toBe(98765);
    expect(after.pilot.warPoints).toBe(432);
    expect(after.pilot.inventory.length).toBe(beforeInvLen);
    expect(after.pilot.warehouse.length).toBe(beforeWhLen);
    expect(after.pilot.gears.striker.level).toBe(beforeLevel);
  });

  it('3) applyMapPack is refused during an active battle or autoRepeatSession', () => {
    const customPack = buildCustomMapPackFixture();
    useGameStore.getState().startBattle('border_outpost');
    expect(useGameStore.getState().battle).not.toBeNull();

    const battleBlocked = useGameStore.getState().applyMapPack(customPack);
    expect(battleBlocked.ok).toBe(false);
    expect(battleBlocked.reason).toBe('in_battle');
    expect(getActiveMap().mapId).toBe('sys_orbital_6');

    useGameStore.setState({
      battle: null,
      screen: 'HANGAR',
      autoRepeatSession: {
        active: true,
        sectorId: 'border_outpost',
        kind: 'assault',
        sourceId: null,
        limit: 'infinite',
        completedRuns: 1,
        wins: 1,
        totalExp: 0,
        totalCredits: 0,
        totalWarPoints: 0,
        totalDrops: [],
        stopReason: null,
      },
    });
    const autoBlocked = useGameStore.getState().applyMapPack(customPack);
    expect(autoBlocked.ok).toBe(false);
    expect(autoBlocked.reason).toBe('auto_repeat_active');
    expect(getActiveMap().mapId).toBe('sys_orbital_6');
  });

  it('4) Admin Bản đồ block: collapsed by default, export -> import JSON roundtrip with invalid error check + confirm dialog', async () => {
    let capturedBlobText = '';
    const OrigBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function MockBlob(
      parts?: BlobPart[],
      options?: BlobPropertyBag
    ) {
      if (Array.isArray(parts) && typeof parts[0] === 'string') {
        capturedBlobText = parts[0];
      }
      return new OrigBlob(parts, options);
    } as unknown as typeof Blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-map');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useGameStore.getState().setAdminPanelOpen(true);
    act(() => {
      root!.render(createElement(AdminPanel));
    });

    // Switch to Campaign tab
    const tabBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-tab-campaign"]'
    )!;
    act(() => {
      tabBtn.click();
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-section-toggle-campaign-map-pack"]'
    )!;
    const body = container.querySelector<HTMLElement>(
      '[data-testid="admin-section-body-campaign-map-pack"]'
    )!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body.hasAttribute('hidden')).toBe(true);

    act(() => {
      toggle.click();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      container.querySelector('[data-testid="map-pack-counts"]')?.textContent
    ).toBe('6 căn cứ · 8 tuyến');
    expect(
      container.querySelector('[data-testid="map-pack-source"]')?.textContent
    ).toContain('gốc');

    // Export JSON and verify roundtrip payload validates cleanly
    act(() => {
      container!
        .querySelector<HTMLButtonElement>('[data-testid="map-pack-export"]')!
        .click();
    });
    expect(capturedBlobText.length).toBeGreaterThan(20);
    const exportedParsed = JSON.parse(capturedBlobText) as MapPackDefinition;
    expect(validateMapPackDetailed(exportedParsed).pack?.mapId).toBe(
      'sys_orbital_6'
    );

    // Modify exported pack into custom 3-node pack and verify invalid vs valid file upload
    const fileInput = container.querySelector<HTMLInputElement>(
      '[data-testid="map-pack-file-input"]'
    )!;

    const badFile = new File(['{bad json'], 'bad.json', {
      type: 'application/json',
    });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [badFile],
    });
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flushUi();
    expect(
      container.querySelector('[data-testid="map-pack-errors"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="map-pack-confirm-dialog"]')
    ).toBeNull();

    const customPack = buildCustomMapPackFixture();
    const goodFile = new File([JSON.stringify(customPack)], 'custom.json', {
      type: 'application/json',
    });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [goodFile],
    });
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flushUi();

    const dialog = container.querySelector(
      '[data-testid="map-pack-confirm-dialog"]'
    );
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(
      'Áp dụng bản đồ mới sẽ RESET thế giới (căn cứ, tiền tuyến, nhiệm vụ, đồng hồ). Nhân vật và đồ giữ nguyên.'
    );

    act(() => {
      container!
        .querySelector<HTMLButtonElement>(
          '[data-testid="map-pack-confirm-apply"]'
        )!
        .click();
    });

    expect(
      container.querySelector('[data-testid="map-pack-confirm-dialog"]')
    ).toBeNull();
    expect(useGameStore.getState().adminConfig.mapPack?.mapId).toBe(
      'custom_frontier_3'
    );
    expect(
      container.querySelector('[data-testid="map-pack-counts"]')?.textContent
    ).toBe('3 căn cứ · 2 tuyến');
    expect(
      container.querySelector('[data-testid="map-pack-source"]')?.textContent
    ).toContain('mods');
  });

  it('5) Restore built-in map button confirms via the same dialog and resets back to sys_orbital_6', () => {
    const customPack = buildCustomMapPackFixture();
    useGameStore.getState().applyMapPack(customPack);
    expect(getActiveMap().mapId).toBe('custom_frontier_3');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useGameStore.getState().setAdminPanelOpen(true);
    act(() => {
      root!.render(createElement(AdminPanel));
    });
    const tabBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-tab-campaign"]'
    )!;
    act(() => {
      tabBtn.click();
    });
    act(() => {
      container!
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-section-toggle-campaign-map-pack"]'
        )!
        .click();
    });

    act(() => {
      container!
        .querySelector<HTMLButtonElement>('[data-testid="map-pack-restore"]')!
        .click();
    });
    const dialog = container.querySelector(
      '[data-testid="map-pack-confirm-dialog"]'
    );
    expect(dialog).not.toBeNull();

    const catalogRef = SECTORS_CATALOG;
    act(() => {
      container!
        .querySelector<HTMLButtonElement>(
          '[data-testid="map-pack-confirm-apply"]'
        )!
        .click();
    });

    expect(useGameStore.getState().adminConfig.mapPack).toBeNull();
    expect(getActiveMap().mapId).toBe('sys_orbital_6');
    expect(SECTORS_CATALOG).toBe(catalogRef);
    expect(SECTORS_CATALOG.length).toBe(6);
    expect(MAP_LANES.length).toBe(8);
    expect(
      container.querySelector('[data-testid="map-pack-counts"]')?.textContent
    ).toBe('6 căn cứ · 8 tuyến');
  });
});
