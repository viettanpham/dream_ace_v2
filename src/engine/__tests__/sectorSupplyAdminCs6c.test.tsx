// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NpcSupplyAdminBlock } from '../../components/admin/NpcSupplyAdminBlock';
import { SupplyLoadoutBar } from '../../components/SupplyLoadoutBar';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import { createInitialBattleState } from '../combat';
import { advanceCampaignMonth } from '../mapWorld';
import {
  CURRENT_SAVE_VERSION,
  createFreshCampaignState,
  migrateSaveData,
} from '../migration';
import {
  drainSectorSupply,
  getSectorSupplyPct,
  sanitizeNpcSupplyConfig,
} from '../npcSupply';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  const fresh = createFreshCampaignState('PilotCs6c', 'striker');
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

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TASK CS6c — Sector supply, Admin block, and Desktop BottomSheet picker', () => {
  it('1) SUP-PICK2: desktop SupplyLoadoutBar opens BottomSheet dialog and closes on backdrop or Escape', () => {
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
        ],
      },
    }));
    const gear = useGameStore.getState().pilot.gears.striker;
    act(() => {
      root!.render(createElement(SupplyLoadoutBar, { variant: 'desktop', gear }));
    });

    expect(
      container!.querySelector('[data-testid="supply-picker-sheet-desktop"]')
    ).toBeNull();

    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-0"]'
        ) as HTMLButtonElement
      ).click();
    });

    const sheet = container!.querySelector(
      '[data-testid="supply-picker-sheet-desktop"]'
    ) as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(
      container!.querySelector('[data-testid="supply-picker-desktop"]')
    ).not.toBeNull();

    // Backdrop click closes dialog
    act(() => {
      sheet.click();
    });
    expect(
      container!.querySelector('[data-testid="supply-picker-sheet-desktop"]')
    ).toBeNull();

    // Re-open and close with Escape
    act(() => {
      (
        container!.querySelector(
          '[data-testid="supply-slot-desktop-0"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(
      container!.querySelector('[data-testid="supply-picker-sheet-desktop"]')
    ).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(
      container!.querySelector('[data-testid="supply-picker-sheet-desktop"]')
    ).toBeNull();
  });

  it('2) drainSectorSupply, advanceCampaignMonth regen, retreatBattle drain, and 5-battle sequence', () => {
    const fresh = createFreshCampaignState('PilotSeq', 'striker');
    let pilot = fresh.pilot;
    const cfg = sanitizeNpcSupplyConfig(fresh.adminConfig.npcSupply); // drainPerBattle=20, regenPerMonth=10

    expect(getSectorSupplyPct(pilot, 'border_outpost')).toBe(100);

    // 5 completed battles in a row on same sector (each battle drains 20 then advances month +10)
    for (let i = 0; i < 5; i++) {
      pilot = drainSectorSupply(pilot, 'border_outpost', cfg);
      pilot = advanceCampaignMonth(pilot, cfg.sector.regenPerMonth).pilot;
    }
    expect(getSectorSupplyPct(pilot, 'border_outpost')).toBe(50);

    // 3 more pure drains drop floor to 0, then 10 months of regen restore and omit key
    for (let i = 0; i < 3; i++) {
      pilot = drainSectorSupply(pilot, 'border_outpost', cfg);
    }
    expect(getSectorSupplyPct(pilot, 'border_outpost')).toBe(0);
    for (let i = 0; i < 10; i++) {
      pilot = advanceCampaignMonth(pilot, cfg.sector.regenPerMonth).pilot;
    }
    expect(getSectorSupplyPct(pilot, 'border_outpost')).toBe(100);
    expect(pilot.sectorSupply).toBeUndefined();

    // Retreat via store action also drains sector supply
    useGameStore.getState().startCampaign('PilotRetreat', 'striker');
    useGameStore.getState().startBattle('border_outpost', { kind: 'assault' });
    expect(useGameStore.getState().battle).not.toBeNull();
    useGameStore.getState().retreatBattle();
    expect(
      getSectorSupplyPct(useGameStore.getState().pilot, 'border_outpost')
    ).toBe(80);
  });

  it('3) migration & export preserve and sanitize sectorSupply while old saves default to 100', () => {
    const fresh = createFreshCampaignState('PilotMig', 'striker');

    // Old save without sectorSupply
    const oldMigrated = migrateSaveData(
      {
        pilot: fresh.pilot,
        adminConfig: fresh.adminConfig,
      },
      CURRENT_SAVE_VERSION
    );
    expect(oldMigrated.pilot.sectorSupply).toBeUndefined();
    expect(getSectorSupplyPct(oldMigrated.pilot, 'border_outpost')).toBe(100);

    // Save with dirty sectorSupply values (unknown id, negative, >100, and valid)
    const dirtyMigrated = migrateSaveData(
      {
        pilot: {
          ...fresh.pilot,
          sectorSupply: {
            unknown_sector_xyz: 40,
            border_outpost: 65,
            veridian_colony: 100,
            aegis_relay: 140,
            iron_citadel: -12,
          },
        },
        adminConfig: fresh.adminConfig,
      },
      CURRENT_SAVE_VERSION
    );
    expect(dirtyMigrated.pilot.sectorSupply).toEqual({
      border_outpost: 65,
      iron_citadel: 0,
    });

    // Re-export/re-import roundtrip keeps sanitized sectorSupply
    useGameStore.setState({
      ...dirtyMigrated,
    });
    const exportedJson = useGameStore.getState().adminExportSaveJson();
    const importRes = useGameStore.getState().adminImportSaveJson(exportedJson);
    expect(importRes.ok).toBe(true);
    expect(useGameStore.getState().pilot.sectorSupply).toEqual({
      border_outpost: 65,
      iron_citadel: 0,
    });
  });

  it('4) battle.log[0] starts with Quân nhu khu vực when npcSupply is enabled', () => {
    const fresh = createFreshCampaignState('PilotLog', 'striker');
    const pilotWith65 = {
      ...fresh.pilot,
      sectorSupply: { border_outpost: 65 },
    };

    const battle = createInitialBattleState(
      pilotWith65,
      'border_outpost',
      Math.random,
      null,
      fresh.adminConfig,
      'assault'
    );
    expect(battle.log[0]?.templateKey).toBe('log.sectorSupply');
    expect(formatCombatLogMessage('vi', battle.log[0]!)).toBe(
      'Quân nhu khu vực: 65%'
    );
    expect(formatCombatLogMessage('en', battle.log[0]!)).toBe(
      'Area supplies: 65%'
    );

    const npcBase = sanitizeNpcSupplyConfig(fresh.adminConfig.npcSupply);
    const disabledBattle = createInitialBattleState(
      pilotWith65,
      'border_outpost',
      Math.random,
      null,
      {
        ...fresh.adminConfig,
        npcSupply: { ...npcBase, enabled: false },
      },
      'assault'
    );
    expect(disabledBattle.log[0]?.templateKey).toBe('log.battleStart');
  });

  it('5) NpcSupplyAdminBlock edits/clamps on blur, reverts invalid drafts, and refills all sectors', () => {
    useGameStore.setState((s) => ({
      ...s,
      pilot: {
        ...s.pilot,
        sectorSupply: { border_outpost: 35, veridian_colony: 70 },
      },
    }));

    act(() => {
      root!.render(createElement(NpcSupplyAdminBlock));
    });

    const section = container!.querySelector(
      '[data-testid="admin-npc-supply-section"]'
    );
    expect(section?.textContent).toContain('Áp dụng từ trận sau');

    const drainInput = container!.querySelector(
      '[data-testid="admin-npc-supply-drain"]'
    ) as HTMLInputElement;
    // Invalid draft reverts on blur
    act(() => {
      setReactInputValue(drainInput, '');
    });
    act(() => {
      drainInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(drainInput.value).toBe('20');

    // Out-of-range draft clamps to 100
    act(() => {
      setReactInputValue(drainInput, '250');
    });
    act(() => {
      drainInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(
      sanitizeNpcSupplyConfig(useGameStore.getState().adminConfig.npcSupply)
        .sector.drainPerBattle
    ).toBe(100);
    expect(drainInput.value).toBe('100');

    // Mob empty % converts 0..100 <-> 0..1
    const mobEmptyInput = container!.querySelector(
      '[data-testid="admin-npc-supply-empty-mob-pct"]'
    ) as HTMLInputElement;
    act(() => {
      setReactInputValue(mobEmptyInput, '45');
    });
    act(() => {
      mobEmptyInput.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true })
      );
    });
    expect(
      sanitizeNpcSupplyConfig(useGameStore.getState().adminConfig.npcSupply)
        .noSupplyChance.mob
    ).toBeCloseTo(0.45);

    // Refill button clears sectorSupply map (all sectors = 100%)
    act(() => {
      (
        container!.querySelector(
          '[data-testid="admin-npc-supply-refill-all"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(useGameStore.getState().pilot.sectorSupply).toBeUndefined();
  });
});
