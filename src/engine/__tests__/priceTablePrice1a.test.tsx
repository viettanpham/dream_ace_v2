// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPanel } from '../../components/AdminPanel';
import { getSupplyTemplateById } from '../../data/consumables';
import { getOpeningCardById, getSkillCardPrice } from '../../data/skills';
import { useGameStore } from '../../store/useGameStore';
import { computeSupplyPrice, sanitizePriceOverrides } from '../itemPrice';
import {
  createDefaultAdminConfig,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('PRICE-1a — Admin item price overrides for supplies & skill cards', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it('1) override beats default (including template.priceOverride and skillCardPriceMult) while preserving all 3 computeSupplyPrice shapes', () => {
    const hpTpl = getSupplyTemplateById('sup_hp_t1')!;
    const spTpl = getSupplyTemplateById('sup_sp_t1')!;
    const card = getOpeningCardById('card_str_phase_shroud')!;

    expect(computeSupplyPrice(hpTpl)).toBeGreaterThan(0);
    expect(computeSupplyPrice(spTpl, { maxUsesPerBattle: 5, spPriceMult: 3 })).toBeGreaterThan(0);

    const adminWithOverride = {
      ...createDefaultAdminConfig(),
      skillCardPriceMult: 2,
      priceOverrides: {
        sup_hp_t1: 777,
        card_str_phase_shroud: 321,
      },
    };
    // Override wins even over template.priceOverride
    expect(
      computeSupplyPrice({ ...hpTpl, priceOverride: 999 }, adminWithOverride)
    ).toBe(777);
    expect(getSkillCardPrice(card, adminWithOverride)).toBe(321);
    expect(getSkillCardPrice({ warPointCost: 1000 }, 2)).toBe(2000);
  });

  it('2) sanitizer drops empty/invalid/non-positive/unknown ids without bumping save version', () => {
    expect(CURRENT_SAVE_VERSION).toBe(15);
    expect(
      sanitizePriceOverrides({
        sup_hp_t1: 450,
        card_str_phase_shroud: 900.4,
        sup_sp_t1: 0,
        sup_shield_t1: -50,
        sup_hp_t2: Number.NaN,
        sup_hp_t3: '',
        unknown_item_xyz: 500,
      })
    ).toEqual({
      sup_hp_t1: 450,
      card_str_phase_shroud: 900,
    });

    const migrated = migrateSaveData(
      {
        adminConfig: {
          priceOverrides: {
            sup_hp_t1: 333,
            bogus_id: 99,
          },
        },
      },
      15
    );
    expect(migrated.adminConfig.priceOverrides).toEqual({ sup_hp_t1: 333 });
  });

  it('3) Admin section price-table supports edit, live resale example, single reset, reset-all confirm, and read-only Other tab', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('PriceAdmin', 'striker');
    useGameStore.getState().setLanguage('vi');

    act(() => {
      useGameStore.setState({ adminPanelOpen: true });
      root.render(createElement(AdminPanel));
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-tab-battle"]')!
        .click();
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-section-toggle-price-table"]'
    )!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => {
      toggle.click();
    });

    const hpInput = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-price-table-input-sup_hp_t1"]'
    )!;
    act(() => {
      setReactInputValue(hpInput, '500');
    });
    expect(useGameStore.getState().adminConfig.priceOverrides).toEqual({
      sup_hp_t1: 500,
    });
    expect(
      container.querySelector('[data-testid="admin-price-table-live-sup_hp_t1"]')
        ?.textContent
    ).toBe('Giá bán lại = 40% = 200 CR');

    // Reset single row removes the key
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-price-table-reset-sup_hp_t1"]'
        )!
        .click();
    });
    expect(useGameStore.getState().adminConfig.priceOverrides).toEqual({});

    // Edit on Skill Cards tab, then Reset All w/ confirm
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-price-table-tab-skillCards"]'
        )!
        .click();
    });
    const cardInput = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-price-table-input-card_str_phase_shroud"]'
    )!;
    act(() => {
      setReactInputValue(cardInput, '555');
    });
    expect(
      useGameStore.getState().adminConfig.priceOverrides?.card_str_phase_shroud
    ).toBe(555);

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-price-table-reset-all"]'
        )!
        .click();
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-price-table-reset-all-confirm"]'
        )!
        .click();
    });
    expect(useGameStore.getState().adminConfig.priceOverrides).toEqual({});

    // Other tab lists the 5 read-only categories with section names
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-price-table-tab-other"]'
        )!
        .click();
    });
    const otherList = container.querySelector(
      '[data-testid="admin-price-table-other-list"]'
    )?.textContent;
    expect(otherList).toContain('Thẻ buff');
    expect(otherList).toContain('Voucher');
    expect(otherList).toContain('Rương vật tư');
    expect(otherList).toContain('Thẻ EXP/Credit');
    expect(otherList).toContain('Huân chương');
  });

  it('4) store buySupply and buyOpeningCardAction charge overridden prices', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('PriceBuyer', 'striker');
    useGameStore.getState().adminUpdateConfig({
      priceOverrides: {
        sup_hp_t1: 250,
        card_str_phase_shroud: 450,
      },
    });
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        credits: 1000,
        warPoints: 600,
      },
      supplyShopStock: [{ templateId: 'sup_hp_t1', remaining: 5 }],
    }));

    const buySupRes = useGameStore.getState().buySupply('sup_hp_t1', 2);
    expect(buySupRes.ok).toBe(true);
    expect(useGameStore.getState().pilot.credits).toBe(500);

    const buyCardRes = useGameStore
      .getState()
      .buyOpeningCardAction('card_str_phase_shroud');
    expect(buyCardRes).toEqual({
      ok: true,
      reason: 'ok',
      cost: 450,
    });
    expect(useGameStore.getState().pilot.warPoints).toBe(150);
  });
});
