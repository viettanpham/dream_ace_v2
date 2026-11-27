// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { getNextSectorId } from '../../data/maps';
import { createInitialBattleState } from '../../engine/combat';
import {
  getBattleOptions,
  isContested,
  pickDefaultBattle,
} from '../../engine/frontline';
import { acceptBaseBonusMission } from '../../engine/mapWorld';
import {
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../../engine/migration';
import {
  formatCombatLogMessage,
  getAutoStopReasonLabel,
  translate,
} from '../../i18n';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import { MapView } from '../MapView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('TASK MAP-F1b — Frontline Integration (Store, Engine, Loop, MapView)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().setLanguage('vi');

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

  it('1) refuses battle launch on non-contested / rear / hidden nodes with translated reason toast, while selectSector allows any visible node', () => {
    // Hidden node: debris_belt on fresh save
    useGameStore.getState().startBattle('debris_belt');
    expect(useGameStore.getState().battle).toBeNull();
    expect(useGameStore.getState().screen).toBe('HANGAR');
    expect(useGameStore.getState().battleLaunchToast?.reasonKey).toBe(
      'map.reason.hidden'
    );
    expect(
      translate('vi', useGameStore.getState().battleLaunchToast!.reasonKey)
    ).toBe(VI_TRANSLATIONS['map.reason.hidden']);

    // Visible rear allied base: make border_outpost & veridian_colony allied and clear raid on aegis_relay
    useGameStore.setState((s) => ({
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
          },
          veridian_colony: {
            ...s.pilot.baseStates.veridian_colony,
            faction: 'allied',
          },
        },
        unlockedSectorIds: [...s.pilot.unlockedSectorIds, 'iron_citadel'],
      },
    }));

    // selectSector allows selecting any visible node (rear base & discovered iron_citadel), blocks hidden? Wait: iron_citadel is in unlockedSectorIds
    useGameStore.getState().selectSector('aegis_relay');
    expect(useGameStore.getState().selectedSectorId).toBe('aegis_relay');
    useGameStore.getState().selectSector('iron_citadel');
    expect(useGameStore.getState().selectedSectorId).toBe('iron_citadel');

    // Launch on rear allied base refused with rearBase reason
    useGameStore.getState().startBattle('aegis_relay');
    expect(useGameStore.getState().battle).toBeNull();
    expect(useGameStore.getState().battleLaunchToast?.reasonKey).toBe(
      'map.reason.rearBase'
    );

    // Launch on discovered non-contested iron_citadel refused with notFrontline reason
    useGameStore.getState().startBattle('iron_citadel');
    expect(useGameStore.getState().battle).toBeNull();
    expect(useGameStore.getState().battleLaunchToast?.reasonKey).toBe(
      'map.reason.notFrontline'
    );

    // App renders the toast with translated text
    act(() => {
      root.render(createElement(App));
    });
    const toast = container.querySelector('[data-testid="battle-launch-toast"]');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain(
      VI_TRANSLATIONS['map.reason.notFrontline']
    );
  });

  it('2) keeps fresh save initial choices and fixed-seed allowed battle deterministic', () => {
    const pilot = useGameStore.getState().pilot;
    const adminConfig = useGameStore.getState().adminConfig;

    expect(
      pickDefaultBattle(getBattleOptions(pilot, 'border_outpost', adminConfig))
    ).toBe('assault');
    expect(
      pickDefaultBattle(getBattleOptions(pilot, 'veridian_colony', adminConfig))
    ).toBe('assault');
    expect(
      pickDefaultBattle(getBattleOptions(pilot, 'aegis_relay', adminConfig))
    ).toBe('defend');

    const b1 = createInitialBattleState(
      pilot,
      'border_outpost',
      createMulberry32(424242),
      null,
      adminConfig
    );
    const b2 = createInitialBattleState(
      pilot,
      'border_outpost',
      createMulberry32(424242),
      null,
      adminConfig
    );
    expect(b1.units).toEqual(b2.units);
    expect(b1.turnOrder).toEqual(b2.turnOrder);
  });

  it('3) capturing border_outpost makes debris_belt contested + visible without chain-unlocking deep nodes and keeps getNextSectorId deprecated export', () => {
    expect(typeof getNextSectorId).toBe('function');
    expect(getNextSectorId('border_outpost')).toBe('debris_belt');

    useGameStore.getState().startBattle('border_outpost');
    expect(useGameStore.getState().battle).not.toBeNull();

    useGameStore.getState().forceWinBattle();

    const pilotAfter = useGameStore.getState().pilot;
    expect(pilotAfter.baseStates.border_outpost.faction).toBe('allied');
    expect(isContested(pilotAfter, 'debris_belt')).toBe(true);
    expect(pilotAfter.unlockedSectorIds).toContain('debris_belt');
    // No chain unlock for iron_citadel or vanguard_shipyard
    expect(pilotAfter.unlockedSectorIds).not.toContain('iron_citadel');
    expect(pilotAfter.unlockedSectorIds).not.toContain('vanguard_shipyard');
  });

  it('4) auto-repeat stops with node_not_contested before a next battle on a no-longer-contested node', () => {
    // Make border_outpost & veridian_colony allied while aegis_relay is underAttack (defend allowed for Run #1)
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        baseStates: {
          ...s.pilot.baseStates,
          aegis_relay: {
            ...s.pilot.baseStates.aegis_relay,
            faction: 'allied',
            underAttack: true,
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

    useGameStore.getState().startAutoRepeat(5, 'aegis_relay');
    expect(useGameStore.getState().battle?.sectorId).toBe('aegis_relay');
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);

    // Winning Run #1 clears underAttack -> aegis_relay becomes rearBase (no allowed options), so loop stops immediately with node_not_contested
    useGameStore.getState().forceWinBattle();

    const session = useGameStore.getState().autoRepeatSession;
    expect(session?.active).toBe(false);
    expect(session?.stopReason).toBe('node_not_contested');

    const lastLog = useGameStore.getState().battle!.log.slice(-1)[0];
    expect(lastLog.templateKey).toBe('log.autoRepeatStopped');
    expect(formatCombatLogMessage('vi', lastLog)).toContain(
      'Dừng: căn cứ không còn giao tranh'
    );
    expect(formatCombatLogMessage('en', lastLog)).toContain(
      EN_TRANSLATIONS['auto.repeatReason.node_not_contested']
    );

    // Starting auto-repeat when idle on non-contested node also refuses with node_not_contested
    useGameStore.setState({ battle: null, autoRepeatSession: null });
    useGameStore.getState().startAutoRepeat(5, 'aegis_relay');
    expect(useGameStore.getState().battle).toBeNull();
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(false);
    expect(useGameStore.getState().autoRepeatSession?.stopReason).toBe(
      'node_not_contested'
    );
  });

  it('5) acceptBaseBonusMission targets nearest CONTESTED node by lane hops, tie-breaking by lower baseLevel, else returns no_target_sector', () => {
    const freshPilot = useGameStore.getState().pilot;

    // Fresh save from aegis_relay: border_outpost (1 hop, L1) & veridian_colony (1 hop, L3) -> picks border_outpost
    const res1 = acceptBaseBonusMission(freshPilot, 'aegis_relay');
    expect(res1.ok).toBe(true);
    expect(res1.pilot.activeBonusMission?.targetSectorId).toBe(
      'border_outpost'
    );

    // Capture border_outpost & clear veridian -> now contested are debris_belt (2 hops, L4) and veridian_colony (1 hop, L3)
    const pilot2: typeof freshPilot = {
      ...freshPilot,
      baseStates: {
        ...freshPilot.baseStates,
        border_outpost: {
          ...freshPilot.baseStates.border_outpost,
          faction: 'allied' as const,
        },
      },
    };
    const res2 = acceptBaseBonusMission(pilot2, 'aegis_relay');
    expect(res2.ok).toBe(true);
    expect(res2.pilot.activeBonusMission?.targetSectorId).toBe(
      'veridian_colony'
    );

    // Both border_outpost and veridian_colony allied: contested are debris_belt (2 hops from aegis, L4) and vanguard_shipyard (2 hops from aegis, L5) -> tie broken by lower baseLevel (debris_belt)
    const pilot3: typeof freshPilot = {
      ...pilot2,
      baseStates: {
        ...pilot2.baseStates,
        veridian_colony: {
          ...pilot2.baseStates.veridian_colony,
          faction: 'allied' as const,
        },
      },
    };
    const res3 = acceptBaseBonusMission(pilot3, 'aegis_relay');
    expect(res3.ok).toBe(true);
    expect(res3.pilot.activeBonusMission?.targetSectorId).toBe('debris_belt');

    // All sectors allied -> no_target_sector
    const allAlliedStates = Object.fromEntries(
      Object.entries(pilot3.baseStates).map(([k, v]) => [
        k,
        { ...v, faction: 'allied' as const },
      ])
    );
    const resNone = acceptBaseBonusMission(
      { ...pilot3, baseStates: allAlliedStates },
      'aegis_relay'
    );
    expect(resNone.ok).toBe(false);
    expect(resNone.reason).toBe('no_target_sector');
  });

  it('6) unlockedSectorIds never shrinks and old save with chain-unlocked deep node cannot attack it unless contested', () => {
    const basePilot = useGameStore.getState().pilot;
    const legacyPayload = {
      version: CURRENT_SAVE_VERSION,
      pilot: {
        ...basePilot,
        unlockedSectorIds: ['border_outpost', 'iron_citadel'],
      },
    };
    const migrated = migrateSaveData(legacyPayload, CURRENT_SAVE_VERSION);
    expect(migrated.pilot.unlockedSectorIds).toEqual(
      expect.arrayContaining([
        'border_outpost',
        'iron_citadel',
        'aegis_relay',
        'veridian_colony',
      ])
    );

    useGameStore.setState({ pilot: migrated.pilot });
    // Even though iron_citadel is in unlockedSectorIds, it is NOT contested -> refused!
    useGameStore.getState().startBattle('iron_citadel');
    expect(useGameStore.getState().battle).toBeNull();
    expect(useGameStore.getState().battleLaunchToast?.reasonKey).toBe(
      'map.reason.notFrontline'
    );

    // Losing a battle on border_outpost never removes iron_citadel or any unlockedSectorIds
    useGameStore.getState().startBattle('border_outpost');
    const b = useGameStore.getState().battle!;
    useGameStore.getState().retreatBattle();
    expect(b).not.toBeNull();
    expect(useGameStore.getState().pilot.unlockedSectorIds).toEqual(
      expect.arrayContaining([
        'border_outpost',
        'iron_citadel',
        'aegis_relay',
        'veridian_colony',
      ])
    );
  });

  it('7) MapView deploy button is disabled with reason title and subtext when nothing is allowed, and enabled when contested', () => {
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
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            faction: 'allied',
          },
          veridian_colony: {
            ...s.pilot.baseStates.veridian_colony,
            faction: 'allied',
          },
        },
      },
    }));

    act(() => {
      root.render(createElement(MapView));
    });

    const deployBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-deploy-btn"]'
    )!;
    expect(deployBtn).not.toBeNull();
    expect(deployBtn.disabled).toBe(true);
    expect(deployBtn.getAttribute('title')).toBe(
      VI_TRANSLATIONS['map.reason.rearBase']
    );
    const subtext = container.querySelector(
      '[data-testid="map-deploy-blocked-reason"]'
    );
    expect(subtext?.textContent).toBe(VI_TRANSLATIONS['map.reason.rearBase']);

    // Selecting contested debris_belt re-enables deploy button with no blocked subtext
    act(() => {
      useGameStore.getState().selectSector('debris_belt');
    });
    const enabledBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-deploy-btn"]'
    )!;
    expect(enabledBtn.disabled).toBe(false);
    expect(enabledBtn.getAttribute('title')).toBeNull();
    expect(
      container.querySelector('[data-testid="map-deploy-blocked-reason"]')
    ).toBeNull();
  });

  it('8) keeps vi/en translation parity for node_not_contested auto stop reason', () => {
    expect(VI_TRANSLATIONS['auto.repeatReason.node_not_contested']).toBe(
      'Dừng: căn cứ không còn giao tranh'
    );
    expect(
      EN_TRANSLATIONS['auto.repeatReason.node_not_contested']
    ).toBeTruthy();
    expect(getAutoStopReasonLabel('vi', 'node_not_contested')).toBe(
      'Dừng: căn cứ không còn giao tranh'
    );
    expect(getAutoStopReasonLabel('en', 'node_not_contested')).toBe(
      EN_TRANSLATIONS['auto.repeatReason.node_not_contested']
    );
  });
});
