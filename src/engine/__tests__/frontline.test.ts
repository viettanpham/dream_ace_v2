// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminPanel } from '../../components/AdminPanel';
import { SECTORS_CATALOG } from '../../data/maps';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { BaseRuntimeState } from '../../types/game';
import {
  getBattleOptions,
  isAlliedFrontline,
  isContested,
  isVisible,
  neighbours,
  noEnemyLeft,
  pickDefaultBattle,
  visibleNodeIds,
} from '../frontline';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().resetCampaign();
  useGameStore.setState({ language: 'vi' });
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

describe('MAP-F1a — Frontline rule engine & Admin ignoreFrontline switch', () => {
  it('1) neighbours() resolves MAP_LANES edges symmetrically in both directions', () => {
    expect(new Set(neighbours('aegis_relay'))).toEqual(
      new Set(['border_outpost', 'veridian_colony'])
    );
    expect(new Set(neighbours('border_outpost'))).toEqual(
      new Set(['aegis_relay', 'debris_belt', 'veridian_colony'])
    );
    expect(new Set(neighbours('veridian_colony'))).toEqual(
      new Set(['aegis_relay', 'border_outpost', 'vanguard_shipyard'])
    );
    expect(new Set(neighbours('debris_belt'))).toEqual(
      new Set(['border_outpost', 'vanguard_shipyard', 'iron_citadel'])
    );
    expect(new Set(neighbours('vanguard_shipyard'))).toEqual(
      new Set(['veridian_colony', 'debris_belt', 'iron_citadel'])
    );
    expect(new Set(neighbours('iron_citadel'))).toEqual(
      new Set(['debris_belt', 'vanguard_shipyard'])
    );
    expect(neighbours('unknown_sector')).toEqual([]);
  });

  it('2) evaluates contested / frontline / visible / options per node on a fresh save', () => {
    const fresh = createFreshCampaignState('Vance', 'striker');
    const { pilot, adminConfig } = fresh;

    expect(noEnemyLeft(pilot)).toBe(false);
    expect(visibleNodeIds(pilot)).toEqual([
      'border_outpost',
      'aegis_relay',
      'veridian_colony',
    ]);

    // aegis_relay: allied + underAttack + frontline -> defend + patrol, default defend
    expect(isContested(pilot, 'aegis_relay')).toBe(false);
    expect(isAlliedFrontline(pilot, 'aegis_relay')).toBe(true);
    expect(isVisible(pilot, 'aegis_relay')).toBe(true);
    const aegisOpts = getBattleOptions(pilot, 'aegis_relay', adminConfig);
    expect(aegisOpts).toEqual([
      { kind: 'defend', allowed: true },
      { kind: 'patrol', allowed: true },
    ]);
    expect(pickDefaultBattle(aegisOpts)).toBe('defend');

    // border_outpost & veridian_colony: hostile/neutral adjacent to aegis_relay -> contested + visible -> assault
    for (const id of ['border_outpost', 'veridian_colony']) {
      expect(isContested(pilot, id)).toBe(true);
      expect(isAlliedFrontline(pilot, id)).toBe(false);
      expect(isVisible(pilot, id)).toBe(true);
      const opts = getBattleOptions(pilot, id, adminConfig);
      expect(opts).toEqual([{ kind: 'assault', allowed: true }]);
      expect(pickDefaultBattle(opts)).toBe('assault');
    }

    // deeper hostile nodes: hidden
    for (const id of ['debris_belt', 'vanguard_shipyard', 'iron_citadel']) {
      expect(isContested(pilot, id)).toBe(false);
      expect(isAlliedFrontline(pilot, id)).toBe(false);
      expect(isVisible(pilot, id)).toBe(false);
      const opts = getBattleOptions(pilot, id, adminConfig);
      expect(opts).toEqual([
        { kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' },
      ]);
      expect(pickDefaultBattle(opts)).toBeNull();
    }
  });

  it('3) capturing border_outpost makes debris_belt contested + visible and keeps deeper nodes hidden', () => {
    const fresh = createFreshCampaignState('Vance', 'striker');
    const pilot = {
      ...fresh.pilot,
      baseStates: {
        ...fresh.pilot.baseStates,
        border_outpost: {
          ...fresh.pilot.baseStates.border_outpost,
          faction: 'allied' as const,
        },
        aegis_relay: {
          ...fresh.pilot.baseStates.aegis_relay,
          underAttack: false,
          attackCountdownMonths: 0,
          attackFromSectorId: null,
        },
      },
    };

    expect(visibleNodeIds(pilot)).toEqual([
      'border_outpost',
      'debris_belt',
      'aegis_relay',
      'veridian_colony',
    ]);

    // border_outpost is now allied frontline (neighbours debris_belt + veridian_colony)
    expect(isAlliedFrontline(pilot, 'border_outpost')).toBe(true);
    expect(getBattleOptions(pilot, 'border_outpost', fresh.adminConfig)).toEqual([
      { kind: 'patrol', allowed: true },
    ]);

    // debris_belt is now contested + visible
    expect(isContested(pilot, 'debris_belt')).toBe(true);
    expect(isVisible(pilot, 'debris_belt')).toBe(true);
    expect(getBattleOptions(pilot, 'debris_belt', fresh.adminConfig)).toEqual([
      { kind: 'assault', allowed: true },
    ]);

    // vanguard_shipyard and iron_citadel stay hidden
    expect(isVisible(pilot, 'vanguard_shipyard')).toBe(false);
    expect(isVisible(pilot, 'iron_citadel')).toBe(false);
  });

  it('4) rear allied node has no allowed option until noEnemyLeft or ignoreFrontline; defend takes priority over assault/patrol', () => {
    const fresh = createFreshCampaignState('Vance', 'striker');

    // Capture border_outpost + veridian_colony (aegis_relay has no hostile/neutral neighbours now)
    const rearPilot = {
      ...fresh.pilot,
      baseStates: {
        ...fresh.pilot.baseStates,
        aegis_relay: {
          ...fresh.pilot.baseStates.aegis_relay,
          faction: 'allied' as const,
          underAttack: false,
          attackCountdownMonths: 0,
          attackFromSectorId: null,
        },
        border_outpost: {
          ...fresh.pilot.baseStates.border_outpost,
          faction: 'allied' as const,
        },
        veridian_colony: {
          ...fresh.pilot.baseStates.veridian_colony,
          faction: 'allied' as const,
        },
      },
    };

    expect(noEnemyLeft(rearPilot)).toBe(false);
    expect(isAlliedFrontline(rearPilot, 'aegis_relay')).toBe(false);
    const rearOpts = getBattleOptions(rearPilot, 'aegis_relay', {
      ignoreFrontline: false,
    });
    expect(rearOpts).toEqual([
      { kind: 'patrol', allowed: false, reasonKey: 'map.reason.rearBase' },
    ]);
    expect(pickDefaultBattle(rearOpts)).toBeNull();

    // If that rear allied node is underAttack, defend is allowed and picked first
    const attackedRear = {
      ...rearPilot,
      baseStates: {
        ...rearPilot.baseStates,
        aegis_relay: {
          ...rearPilot.baseStates.aegis_relay,
          underAttack: true,
        },
      },
    };
    const attackedOpts = getBattleOptions(attackedRear, 'aegis_relay', {
      ignoreFrontline: false,
    });
    expect(attackedOpts).toEqual([
      { kind: 'defend', allowed: true },
      { kind: 'patrol', allowed: false, reasonKey: 'map.reason.rearBase' },
    ]);
    expect(pickDefaultBattle(attackedOpts)).toBe('defend');

    // ignoreFrontline allows patrol on visible rear node, and assault on visible non-contested enemy node
    expect(
      getBattleOptions(rearPilot, 'aegis_relay', { ignoreFrontline: true })
    ).toEqual([{ kind: 'patrol', allowed: true }]);

    const unlockedDeepPilot = {
      ...fresh.pilot,
      unlockedSectorIds: [...fresh.pilot.unlockedSectorIds, 'iron_citadel'],
    };
    expect(
      getBattleOptions(unlockedDeepPilot, 'iron_citadel', {
        ignoreFrontline: false,
      })
    ).toEqual([
      {
        kind: 'assault',
        allowed: false,
        reasonKey: 'map.reason.notFrontline',
      },
    ]);
    expect(
      getBattleOptions(unlockedDeepPilot, 'iron_citadel', {
        ignoreFrontline: true,
      })
    ).toEqual([{ kind: 'assault', allowed: true }]);

    // Even with ignoreFrontline: true, hidden node stays hidden
    expect(
      getBattleOptions(fresh.pilot, 'iron_citadel', { ignoreFrontline: true })
    ).toEqual([
      { kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' },
    ]);

    // When noEnemyLeft is true (every sector allied), rear allied nodes get patrol
    const allAlliedStates: Record<string, BaseRuntimeState> = {
      ...rearPilot.baseStates,
    };
    for (const sec of SECTORS_CATALOG) {
      allAlliedStates[sec.id] = {
        ...allAlliedStates[sec.id],
        faction: 'allied',
      };
    }
    const wonPilot = { ...rearPilot, baseStates: allAlliedStates };
    expect(noEnemyLeft(wonPilot)).toBe(true);
    for (const sec of SECTORS_CATALOG) {
      expect(
        getBattleOptions(wonPilot, sec.id, { ignoreFrontline: false })
      ).toEqual([{ kind: 'patrol', allowed: true }]);
    }
  });

  it('5) pickDefaultBattle respects defend > assault > patrol priority', () => {
    expect(
      pickDefaultBattle([
        { kind: 'patrol', allowed: true },
        { kind: 'assault', allowed: true },
        { kind: 'defend', allowed: true },
      ])
    ).toBe('defend');
    expect(
      pickDefaultBattle([
        { kind: 'patrol', allowed: true },
        { kind: 'assault', allowed: true },
      ])
    ).toBe('assault');
    expect(pickDefaultBattle([{ kind: 'patrol', allowed: true }])).toBe(
      'patrol'
    );
    expect(
      pickDefaultBattle([
        { kind: 'defend', allowed: false, reasonKey: 'map.reason.rearBase' },
        { kind: 'assault', allowed: false, reasonKey: 'map.reason.hidden' },
      ])
    ).toBeNull();
  });

  it('6) sanitizer defaults adminConfig.ignoreFrontline to false and keeps valid boolean', () => {
    const def = createDefaultAdminConfig();
    expect(def.ignoreFrontline).toBe(false);

    const fresh = createFreshCampaignState('Vance', 'striker');
    const legacyAdmin = { ...fresh.adminConfig } as Record<string, unknown>;
    delete legacyAdmin.ignoreFrontline;

    const migratedDefault = migrateSaveData(
      { ...fresh, adminConfig: legacyAdmin },
      CURRENT_SAVE_VERSION
    );
    expect(migratedDefault.adminConfig.ignoreFrontline).toBe(false);

    const corruptMigrated = migrateSaveData(
      {
        ...fresh,
        adminConfig: { ...legacyAdmin, ignoreFrontline: 'yes' },
      },
      CURRENT_SAVE_VERSION
    );
    expect(corruptMigrated.adminConfig.ignoreFrontline).toBe(false);

    const enabledMigrated = migrateSaveData(
      {
        ...fresh,
        adminConfig: { ...fresh.adminConfig, ignoreFrontline: true },
      },
      CURRENT_SAVE_VERSION
    );
    expect(enabledMigrated.adminConfig.ignoreFrontline).toBe(true);
  });

  it('7) renders Admin CP Ignore frontline checkbox and verifies vi/en translation parity', () => {
    expect(VI_TRANSLATIONS['map.reason.notFrontline']).toBe(
      'Chưa tiếp giáp lãnh thổ ta'
    );
    expect(VI_TRANSLATIONS['map.reason.rearBase']).toBe(
      'Căn cứ hậu phương, không có giao tranh'
    );
    expect(VI_TRANSLATIONS['map.reason.hidden']).toBe('Chưa phát hiện');
    expect(VI_TRANSLATIONS['admin.campaignIgnoreFrontline']).toBe(
      'Bỏ qua luật tiền tuyến (test)'
    );
    expect(EN_TRANSLATIONS['admin.campaignIgnoreFrontline']).toBe(
      'Ignore frontline rule (test)'
    );

    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useGameStore.setState({
      language: 'vi',
      adminPanelOpen: true,
      adminConfig: createDefaultAdminConfig(),
    });

    act(() => {
      root!.render(createElement(AdminPanel));
    });

    const campaignTab = container.querySelector(
      '[data-testid="admin-tab-campaign"]'
    ) as HTMLButtonElement;
    expect(campaignTab).not.toBeNull();

    act(() => {
      campaignTab.click();
    });

    const cb = container.querySelector(
      '[data-testid="admin-ignore-frontline"]'
    ) as HTMLInputElement;
    expect(cb).not.toBeNull();
    expect(cb.checked).toBe(false);
    expect(container.textContent).toContain('Bỏ qua luật tiền tuyến (test)');

    act(() => {
      cb.click();
    });
    expect(useGameStore.getState().adminConfig.ignoreFrontline).toBe(true);

    act(() => {
      useGameStore.setState({ language: 'en' });
    });
    expect(container.textContent).toContain('Ignore frontline rule (test)');
  });
});
