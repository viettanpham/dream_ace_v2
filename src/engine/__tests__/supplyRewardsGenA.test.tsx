// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSupplyTemplateById } from '../../data/consumables';
import { AdminPanel } from '../../components/AdminPanel';
import { BattleResultDialog } from '../../components/BattleResultDialog';
import { GearView } from '../../components/GearView';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import {
  DEFAULT_SUPPLY_REWARDS_CONFIG,
  grantSupplyReward,
  rollSupplyCrateContents,
  rollSupplyReward,
  sanitizeSupplyRewardsConfig,
} from '../supplyRewards';
import { getSupplyStockCount, SUPPLY_STACK_CAP } from '../supplies';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setReactSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value'
  )!.set!;
  setter.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function BattleResultDialogHarness() {
  const { t, lang } = useI18n();
  const summary = useGameStore((s) => s.battle?.summary);
  if (!summary) return null;
  return createElement(BattleResultDialog, {
    summary,
    squadSize: 4,
    lang,
    t,
    onOpenReport: () => {},
    onOpenLog: () => {},
    onReturnHangar: () => {},
    onNextSortie: () => {},
  });
}

describe('TASK SUP-GEN-a — Random supply rewards, Hòm vật tư, Kho đồ fix, Admin give', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('SupplyTester', 'striker');
    useGameStore.getState().setLanguage('vi');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
  });

  it('1) roller respects unlock level, tier bounds, and qty range for seeded rng', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 40; i += 1) {
      const rolled = rollSupplyReward(
        15,
        { minTier: 1, maxTier: 2, qtyMin: 2, qtyMax: 4 },
        rng
      );
      expect(rolled).not.toBeNull();
      const tpl = getSupplyTemplateById(rolled!.templateId)!;
      expect(tpl.unlockLevel).toBeLessThanOrEqual(15);
      expect(tpl.tier).toBeGreaterThanOrEqual(1);
      expect(tpl.tier).toBeLessThanOrEqual(2);
      expect(rolled!.qty).toBeGreaterThanOrEqual(2);
      expect(rolled!.qty).toBeLessThanOrEqual(4);
    }

    const crateItems = rollSupplyCrateContents(
      25,
      { minTier: 2, maxTier: 3, typesMin: 2, typesMax: 3, qtyMin: 2, qtyMax: 5 },
      makeRng(99)
    );
    expect(crateItems.length).toBeGreaterThanOrEqual(2);
    expect(crateItems.length).toBeLessThanOrEqual(3);
    const uniqueIds = new Set(crateItems.map((it) => it.templateId));
    expect(uniqueIds.size).toBe(crateItems.length);
    for (const item of crateItems) {
      const tpl = getSupplyTemplateById(item.templateId)!;
      expect(tpl.unlockLevel).toBeLessThanOrEqual(25);
      expect(tpl.tier).toBeGreaterThanOrEqual(2);
      expect(tpl.tier).toBeLessThanOrEqual(3);
      expect(item.qty).toBeGreaterThanOrEqual(2);
      expect(item.qty).toBeLessThanOrEqual(5);
    }
  });

  it('2) chancePct 0 never grants and chancePct 100 always grants', () => {
    const basePilot = useGameStore.getState().pilot;
    const neverState = {
      pilot: { ...basePilot, consumables: [] },
      adminConfig: {
        supplyRewards: sanitizeSupplyRewardsConfig({
          ...DEFAULT_SUPPLY_REWARDS_CONFIG,
          victory: { chancePct: 0, qtyMin: 1, qtyMax: 3 },
        }),
      },
    };
    for (let i = 0; i < 15; i += 1) {
      expect(grantSupplyReward(neverState, 'victory', () => 0)).toBeNull();
    }
    expect(neverState.pilot.consumables).toHaveLength(0);

    const alwaysState = {
      pilot: { ...basePilot, consumables: [] },
      adminConfig: {
        supplyRewards: sanitizeSupplyRewardsConfig({
          ...DEFAULT_SUPPLY_REWARDS_CONFIG,
          event: { chancePct: 100, qtyMin: 2, qtyMax: 2 },
        }),
      },
    };
    const granted = grantSupplyReward(alwaysState, 'event', () => 0.99);
    expect(granted).not.toBeNull();
    expect('templateId' in granted! ? granted.qty : 0).toBe(2);
    expect(
      getSupplyStockCount(
        alwaysState.pilot.consumables,
        (granted as { templateId: string; qty: number }).templateId
      )
    ).toBe(2);
  });

  it('3) victory grants on win only (not defeat/retreat), sets summary.supplyDrop, and shows BattleResultDialog line', () => {
    useGameStore.getState().adminUpdateConfig({
      supplyRewards: {
        ...DEFAULT_SUPPLY_REWARDS_CONFIG,
        victory: { chancePct: 100, qtyMin: 2, qtyMax: 2 },
        mission: { chancePct: 100, qtyMin: 3, qtyMax: 3 },
      },
    });

    // Retreat does NOT grant
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().confirmPrestage();
    useGameStore.getState().retreatBattle();
    expect(useGameStore.getState().battle?.summary?.supplyDrop).toBeUndefined();
    useGameStore.getState().returnToHangar();

    // Win DOES grant victory supplyDrop + bonus mission drop
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        activeBonusMission: {
          id: 'bm_test_1',
          sourceSectorId: 'earth_orbit',
          targetSectorId: 'border_outpost',
          rewardCredits: 100,
          rewardWarPoints: 10,
          completed: false,
        },
      },
    }));
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().confirmPrestage();
    useGameStore.getState().forceWinBattle();

    const summary = useGameStore.getState().battle?.summary;
    expect(summary?.outcome).toBe('victory');
    expect(summary?.supplyDrop?.qty).toBe(2);
    expect(summary?.missionSupplyDrop?.qty).toBe(3);

    act(() => {
      root!.render(createElement(BattleResultDialogHarness));
    });
    const lineEl = container!.querySelector(
      '[data-testid="battle-result-supply-drop"]'
    );
    expect(lineEl?.textContent).toContain('Vật tư nhận được:');
    expect(lineEl?.textContent).toContain('x2');
    const missionEl = container!.querySelector(
      '[data-testid="battle-result-mission-supply-drop"]'
    );
    expect(missionEl?.textContent).toContain('Vật tư nhận được:');
    expect(missionEl?.textContent).toContain('x3');
  });

  it('4) opening supply_crate via useConsumable and GearView adds supplies and removes 1 crate', () => {
    const giveRes = useGameStore.getState().adminGiveSupply('supply_crate', 2);
    expect(giveRes.ok).toBe(true);
    expect(giveRes.added).toBe(2);

    useGameStore.getState().setInventoryFilterState({ slot: 'consumables' });
    act(() => {
      root!.render(createElement(GearView));
    });

    const openBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="use-consumable-supply_crate"]'
    )!;
    expect(openBtn).not.toBeNull();
    expect(openBtn.textContent).toContain('Mở Rương');

    act(() => {
      openBtn.click();
    });

    const pilotAfter = useGameStore.getState().pilot;
    const consumablesAfter = pilotAfter.consumables ?? [];
    const crateAfter = consumablesAfter.find(
      (c) => c.kind === 'supply_crate'
    );
    expect(crateAfter?.quantity).toBe(1);
    const totalSupplies = consumablesAfter
      .filter((c) => c.kind === 'battle_supply')
      .reduce((acc, c) => acc + c.quantity, 0);
    expect(totalSupplies).toBeGreaterThan(0);
    const noticeEl = container!.querySelector(
      '[data-testid="gear-inventory-notice"]'
    );
    expect(noticeEl?.textContent).toContain('Nhận:');
  });

  it('5) Kho đồ > Tiêu hao battle_supply card shows real name and "Đưa vào Túi vật tư" updates loadout', () => {
    useGameStore.getState().adminGiveSupply('sup_hp_t1', 3);
    useGameStore.getState().setInventoryFilterState({ slot: 'consumables' });

    act(() => {
      root!.render(createElement(GearView));
    });

    const card = container!.querySelector(
      '[data-testid="consumable-supply-sup_hp_t1"]'
    )!;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Bộ sửa chữa T1');
    expect(card.textContent).not.toContain('Vật tư chiến đấu');

    const addBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="supply-add-bag-sup_hp_t1"]'
    )!;
    expect(addBtn.textContent).toContain('Đưa vào Túi vật tư');

    act(() => {
      addBtn.click();
    });

    const activeGear =
      useGameStore.getState().pilot.gears[
        useGameStore.getState().pilot.activeGearId
      ];
    expect(activeGear.supplyLoadout).toContain('sup_hp_t1');
    expect(
      container!.querySelector('[data-testid="supply-in-bag-sup_hp_t1"]')
        ?.textContent
    ).toContain('Đã trong Túi');
  });

  it('6) Admin give adds requested qty, caps at 99 with overflow note, and Admin sections render collapsed w/ live examples', () => {
    act(() => {
      useGameStore.setState({ adminPanelOpen: true });
      root!.render(createElement(AdminPanel));
    });
    act(() => {
      container!
        .querySelector<HTMLButtonElement>('[data-testid="admin-tab-battle"]')!
        .click();
    });

    const rewardsToggle = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-section-toggle-supply-rewards"]'
    )!;
    const giveToggle = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-section-toggle-supply-give-test"]'
    )!;
    expect(rewardsToggle.getAttribute('aria-expanded')).toBe('false');
    expect(giveToggle.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      rewardsToggle.click();
      giveToggle.click();
    });

    expect(
      container!.querySelector(
        '[data-testid="admin-supply-rewards-victory-chance-ex"]'
      )?.textContent
    ).toContain('25%');

    const selectEl = container!.querySelector<HTMLSelectElement>(
      '[data-testid="admin-supply-give-select"]'
    )!;
    const qtyInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-supply-give-qty"]'
    )!;
    const giveBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-supply-give-btn"]'
    )!;

    act(() => {
      setReactSelectValue(selectEl, 'sup_sp_t1');
      setReactInputValue(qtyInput, '95');
    });
    act(() => {
      giveBtn.click();
    });
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_sp_t1')
    ).toBe(95);

    act(() => {
      setReactInputValue(qtyInput, '10');
    });
    act(() => {
      giveBtn.click();
    });
    expect(
      getSupplyStockCount(useGameStore.getState().pilot.consumables, 'sup_sp_t1')
    ).toBe(SUPPLY_STACK_CAP);
    const fb = container!.querySelector(
      '[data-testid="admin-supply-give-feedback"]'
    );
    expect(fb?.textContent).toContain('Đã tặng');
    expect(fb?.textContent).toContain('kho đầy, mất 6');
  });
});
