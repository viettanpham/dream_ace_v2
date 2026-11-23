// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { generateItemInstance } from '../../engine/equipment';
import { shouldStopAutoRepeat } from '../../engine/tactics';
import { useGameStore } from '../../store/useGameStore';
import type { AutoRepeatSession } from '../../types/game';
import { BattleScreen } from '../BattleScreen';
import { GearView } from '../GearView';
import { QuickSellModal } from '../QuickSellModal';
import { ShopScreen } from '../ShopScreen';
import { TopHud } from '../TopHud';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createBaseSession(
  overrides: Partial<AutoRepeatSession> = {}
): AutoRepeatSession {
  return {
    active: true,
    limit: 5,
    completedRuns: 1,
    wins: 1,
    totalExp: 100,
    totalCredits: 50,
    totalWarPoints: 10,
    totalDrops: [],
    sectorId: 'debris_belt',
    stopReason: null,
    ...overrides,
  };
}

describe('Task F2a+: Selling Protections, Battle Loop Toast/Stop-on-Defeat & Logo Nav', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().setLanguage('en');

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

  describe('1. Engine & Store: shouldStopAutoRepeat & defeatRule', () => {
    it('stops on defeat when defeatRule=stop_immediately, continues on never_stop, and ALWAYS stops on inventory_full', () => {
      const session = createBaseSession({ limit: 5, completedRuns: 1 });

      // Default ('stop_immediately'): stops on defeat
      expect(
        shouldStopAutoRepeat(
          session,
          'defeat',
          false,
          10,
          50,
          'stop_immediately'
        )
      ).toEqual({ stop: true, reason: 'defeat' });

      // 'never_stop': continues on defeat when runs remain and bag has space
      expect(
        shouldStopAutoRepeat(session, 'defeat', false, 10, 50, 'never_stop')
      ).toEqual({ stop: false, reason: null });

      // Inventory full ALWAYS stops even on defeat with 'never_stop'
      expect(
        shouldStopAutoRepeat(
          session,
          'defeat',
          false,
          BALANCE_CONFIG.maxInventorySize,
          BALANCE_CONFIG.maxInventorySize,
          'never_stop'
        )
      ).toEqual({ stop: true, reason: 'inventory_full' });

      // Inventory full ALWAYS stops on victory too
      expect(
        shouldStopAutoRepeat(session, 'victory', false, 50, 50, 'never_stop')
      ).toEqual({ stop: true, reason: 'inventory_full' });
    });
  });

  describe('2. Battle Loop UI: Defeat rule radios, per-battle toast & batch summary', () => {
    it('keeps loop button outside "..." menu, defaults Stop immediately ON, shows toast mid-loop, and shows summary on completion', () => {
      useGameStore.getState().startBattle('border_outpost');

      act(() => {
        root.render(createElement(BattleScreen));
      });

      // Loop button is visible outside the "..." menu
      const loopBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="battle-loop-btn"]'
      );
      expect(loopBtn).not.toBeNull();

      // Open loop popover and verify "Stop immediately" radio defaults to checked
      act(() => {
        loopBtn!.click();
      });
      const stopImmediatelyRadio =
        document.body.querySelector<HTMLInputElement>(
          '[data-testid="battle-loop-rule-stop-immediately"]'
        );
      const neverStopRadio = document.body.querySelector<HTMLInputElement>(
        '[data-testid="battle-loop-rule-never-stop"]'
      );
      expect(stopImmediatelyRadio).not.toBeNull();
      expect(neverStopRadio).not.toBeNull();
      expect(stopImmediatelyRadio!.checked).toBe(true);
      expect(useGameStore.getState().autoRepeatDefeatRule).toBe(
        'stop_immediately'
      );

      // Select "Never stop (continuous)"
      act(() => {
        neverStopRadio!.click();
      });
      expect(useGameStore.getState().autoRepeatDefeatRule).toBe('never_stop');

      // Start 5x auto-repeat, force win Run #1 -> toast appears, blocking outcome dialog does NOT
      act(() => {
        useGameStore.getState().startAutoRepeat(5, 'border_outpost');
      });
      act(() => {
        useGameStore.getState().forceWinBattle();
      });

      expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
      expect(
        container.querySelector('#battle-outcome-title')
      ).toBeNull();
      const toastEl = container.querySelector(
        '[data-testid="battle-loop-toast"]'
      );
      expect(toastEl).not.toBeNull();
      expect(toastEl?.textContent).toContain('Run #1: Victory');
      expect(toastEl?.textContent).toContain('EXP');
      expect(toastEl?.textContent).toContain('CR');
      expect(toastEl?.textContent).toContain('WP');

      // Run #2 ends in defeat while never_stop -> still continues
      act(() => {
        useGameStore.getState().startBattle('border_outpost');
      });
      act(() => {
        useGameStore.setState((s) => ({
          autoRepeatSession: s.autoRepeatSession
            ? { ...s.autoRepeatSession, completedRuns: 4, limit: 5 }
            : null,
        }));
      });
      act(() => {
        useGameStore.getState().forceWinBattle();
      });

      // Now 5/5 completed -> summary modal opens with totals, toast is hidden
      expect(useGameStore.getState().autoRepeatSession?.active).toBe(false);
      expect(
        container.querySelector('[data-testid="battle-loop-toast"]')
      ).toBeNull();
      const summaryTitle = container.querySelector('#repeat-summary-title');
      expect(summaryTitle).not.toBeNull();
      expect(
        container.querySelector('#battle-outcome-title')
      ).toBeNull();
    });

    it('shows summary with Inventory Full stop reason when bag reaches capacity during a loop', () => {
      // Fill inventory to maxInventorySize
      useGameStore
        .getState()
        .adminFillInventory(BALANCE_CONFIG.maxInventorySize);
      useGameStore.getState().startBattle('border_outpost');
      useGameStore.getState().setAutoRepeatDefeatRule('never_stop');

      act(() => {
        root.render(createElement(BattleScreen));
      });

      act(() => {
        useGameStore.getState().startAutoRepeat(10, 'border_outpost');
      });
      act(() => {
        useGameStore.getState().forceWinBattle();
      });

      const session = useGameStore.getState().autoRepeatSession;
      expect(session?.active).toBe(false);
      expect(session?.stopReason).toBe('inventory_full');

      const summaryTitle = container.querySelector('#repeat-summary-title');
      expect(summaryTitle).not.toBeNull();
    });
  });

  describe('3. Shop Sell Tab & Inventory Selling Protections', () => {
    it('prevents selling equipped and locked items in Shop Sell tab and provides Unequip / Unlock shortcuts', () => {
      const equippedItem = generateItemInstance({
        slot: 'armor',
        tier: 1,
        rarity: 'rare',
        requiredLevel: 1,
      });
      const lockedItem = {
        ...generateItemInstance({
          slot: 'engine',
          tier: 1,
          rarity: 'common',
          requiredLevel: 1,
        }),
        locked: true,
      };
      const normalItem = generateItemInstance({
        slot: 'accessory',
        tier: 1,
        rarity: 'common',
        requiredLevel: 1,
      });

      useGameStore.setState((s) => ({
        pilot: {
          ...s.pilot,
          inventory: [equippedItem, lockedItem, normalItem],
          gears: {
            ...s.pilot.gears,
            striker: {
              ...s.pilot.gears.striker,
              equipped: {
                ...s.pilot.gears.striker.equipped,
                armor: equippedItem.instanceId,
              },
            },
          },
        },
      }));

      act(() => {
        root.render(createElement(ShopScreen));
      });

      const sellTabBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="shop-tab-sell"]'
      );
      act(() => {
        sellTabBtn!.click();
      });

      // Equipped item is listed with "Equipped: Striker", disabled Sell button, and Unequip shortcut
      const eqRow = container.querySelector(
        `[data-testid="shop-sell-row-${equippedItem.instanceId}"]`
      );
      expect(eqRow).not.toBeNull();
      expect(
        container.querySelector(
          `[data-testid="shop-sell-equipped-badge-${equippedItem.instanceId}"]`
        )?.textContent
      ).toContain('Equipped: Striker');
      const eqSellBtn = container.querySelector<HTMLButtonElement>(
        `[data-testid="shop-sell-btn-${equippedItem.instanceId}"]`
      );
      expect(eqSellBtn?.disabled).toBe(true);

      // Click Unequip shortcut -> item stays in sell tab, badge vanishes, Sell becomes enabled
      const unequipBtn = container.querySelector<HTMLButtonElement>(
        `[data-testid="shop-sell-unequip-${equippedItem.instanceId}"]`
      );
      act(() => {
        unequipBtn!.click();
      });
      expect(
        container.querySelector(
          `[data-testid="shop-sell-equipped-badge-${equippedItem.instanceId}"]`
        )
      ).toBeNull();
      expect(
        container.querySelector<HTMLButtonElement>(
          `[data-testid="shop-sell-btn-${equippedItem.instanceId}"]`
        )?.disabled
      ).toBe(false);

      // Locked item shows lock badge, disabled Sell button, and Unlock shortcut
      expect(
        container.querySelector(
          `[data-testid="shop-sell-locked-badge-${lockedItem.instanceId}"]`
        )?.textContent
      ).toContain('Protected Lock');
      expect(
        container.querySelector<HTMLButtonElement>(
          `[data-testid="shop-sell-btn-${lockedItem.instanceId}"]`
        )?.disabled
      ).toBe(true);

      const unlockBtn = container.querySelector<HTMLButtonElement>(
        `[data-testid="shop-sell-unlock-${lockedItem.instanceId}"]`
      );
      act(() => {
        unlockBtn!.click();
      });
      expect(
        container.querySelector(
          `[data-testid="shop-sell-locked-badge-${lockedItem.instanceId}"]`
        )
      ).toBeNull();
      expect(
        container.querySelector<HTMLButtonElement>(
          `[data-testid="shop-sell-btn-${lockedItem.instanceId}"]`
        )?.disabled
      ).toBe(false);
    });

    it('skips equipped and locked items during multi-select bulk sell in GearView and reports skipped count', () => {
      const equippedItem = generateItemInstance({
        slot: 'armor',
        tier: 1,
        rarity: 'common',
        requiredLevel: 1,
      });
      const lockedItem = {
        ...generateItemInstance({
          slot: 'engine',
          tier: 1,
          rarity: 'common',
          requiredLevel: 1,
        }),
        locked: true,
      };
      const sellableItem = generateItemInstance({
        slot: 'accessory',
        tier: 1,
        rarity: 'common',
        requiredLevel: 1,
      });

      useGameStore.setState((s) => ({
        pilot: {
          ...s.pilot,
          inventory: [equippedItem, lockedItem, sellableItem],
          gears: {
            ...s.pilot.gears,
            striker: {
              ...s.pilot.gears.striker,
              equipped: {
                ...s.pilot.gears.striker.equipped,
                armor: equippedItem.instanceId,
              },
            },
          },
        },
      }));

      act(() => {
        root.render(createElement(GearView));
      });

      // Enable multi-select mode and select all visible items
      const multiBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="inv-multiselect-btn"]'
      );
      expect(multiBtn).not.toBeNull();
      act(() => {
        multiBtn!.click();
      });

      const selectAllBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="inv-select-all-btn"]'
      );
      expect(selectAllBtn).not.toBeNull();
      act(() => {
        selectAllBtn!.click();
      });

      const skippedNotice = container.querySelector(
        '[data-testid="inv-bulk-skipped"]'
      );
      expect(skippedNotice).not.toBeNull();
      expect(skippedNotice?.textContent).toContain('Skipped 2 protected');

      const bulkSellBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="inv-bulk-sell-btn"]'
      );
      expect(bulkSellBtn?.disabled).toBe(false);
      act(() => {
        bulkSellBtn!.click();
      });

      // Only the unprotected sellable item was sold; equipped and locked items remain
      const remainingIds = useGameStore
        .getState()
        .pilot.inventory.map((it) => it.instanceId);
      expect(remainingIds).toContain(equippedItem.instanceId);
      expect(remainingIds).toContain(lockedItem.instanceId);
      expect(remainingIds).not.toContain(sellableItem.instanceId);
    });

    it('QuickSellModal skips equipped and locked items and passes skippedCount to onSold', () => {
      const equippedItem = generateItemInstance({
        slot: 'armor',
        tier: 1,
        rarity: 'common',
        requiredLevel: 1,
      });
      const lockedItem = {
        ...generateItemInstance({
          slot: 'engine',
          tier: 1,
          rarity: 'common',
          requiredLevel: 1,
        }),
        locked: true,
      };
      const commonSellable = generateItemInstance({
        slot: 'accessory',
        tier: 1,
        rarity: 'common',
        requiredLevel: 1,
      });

      useGameStore.setState((s) => ({
        quickSellConfig: {
          ...s.quickSellConfig,
          maxRarity: 'common',
        },
        pilot: {
          ...s.pilot,
          inventory: [equippedItem, lockedItem, commonSellable],
          gears: {
            ...s.pilot.gears,
            striker: {
              ...s.pilot.gears.striker,
              equipped: {
                ...s.pilot.gears.striker.equipped,
                armor: equippedItem.instanceId,
              },
            },
          },
        },
      }));

      const soldResults: Array<{
        count: number;
        credits: number;
        skipped: number;
      }> = [];

      act(() => {
        root.render(
          createElement(QuickSellModal, {
            open: true,
            onClose: () => {},
            onSold: (count, credits, skipped) => {
              soldResults.push({ count, credits, skipped });
            },
          })
        );
      });

      const openConfirmBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="quicksell-open-confirm"]'
      );
      expect(openConfirmBtn).not.toBeNull();
      expect(openConfirmBtn?.disabled).toBe(false);
      act(() => {
        openConfirmBtn!.click();
      });

      const execBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="quicksell-confirm-execute"]'
      );
      expect(execBtn).not.toBeNull();
      act(() => {
        execBtn!.click();
      });

      expect(soldResults).toHaveLength(1);
      expect(soldResults[0].count).toBe(1);
      expect(soldResults[0].skipped).toBe(2);

      const remainingIds = useGameStore
        .getState()
        .pilot.inventory.map((it) => it.instanceId);
      expect(remainingIds).toContain(equippedItem.instanceId);
      expect(remainingIds).toContain(lockedItem.instanceId);
      expect(remainingIds).not.toContain(commonSellable.instanceId);
    });
  });

  describe('4. TopHud Logo & Settings Admin CP Navigation', () => {
    it('navigates straight to TITLE on logo tap outside battle and keeps Admin CP reachable inside Settings', () => {
      useGameStore.getState().setScreen('HANGAR');
      useGameStore.setState({ adminUnlocked: false, adminPanelOpen: false });

      act(() => {
        root.render(createElement(TopHud));
      });

      // Tapping logo goes directly to TITLE without unlocking Admin CP
      const logoBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="tophud-brand-logo"]'
      );
      expect(logoBtn).not.toBeNull();
      act(() => {
        logoBtn!.click();
      });
      expect(useGameStore.getState().screen).toBe('TITLE');
      expect(useGameStore.getState().adminUnlocked).toBe(false);

      // Opening Settings reveals Admin CP button even before adminUnlocked
      const settingsBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="tophud-settings-btn"]'
      );
      act(() => {
        settingsBtn!.click();
      });

      const settingsAdminBtn = document.body.querySelector<HTMLButtonElement>(
        '[data-testid="tophud-settings-admin-btn"]'
      );
      expect(settingsAdminBtn).not.toBeNull();
      act(() => {
        settingsAdminBtn!.click();
      });
      expect(useGameStore.getState().adminPanelOpen).toBe(true);
    });
  });
});
