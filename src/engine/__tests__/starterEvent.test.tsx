// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMaxLevel } from '../../data/balance';
import { StarterEventAdminBlock } from '../../components/admin/StarterEventAdminBlock';
import { AdminSection } from '../../components/admin/AdminSection';
import { WarehouseView } from '../../components/WarehouseView';
import { useGameStore } from '../../store/useGameStore';
import {
  CURRENT_SAVE_VERSION,
  createFreshCampaignState,
  migrateSaveData,
} from '../migration';
import {
  DEFAULT_STARTER_EVENT_CONFIG,
  estimateLevelFromExpFromLv1,
  getCardName,
  grantStarterEventPack,
  sanitizeOwnedCards,
  sanitizeStarterEventConfig,
  summarizeStarterEvent,
} from '../starterEvent';
import { createDefaultPilotAccount } from '../stats';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('STARTER-EVENT-1 — Starter support cards, grants, WarehouseView, and Admin', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useGameStore.getState().resetCampaign();
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
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('1) grantStarterEventPack respects oncePerSave vs perGear, disabled flag, and force', () => {
    const basePilot = createDefaultPilotAccount('Ace', 'striker', []);
    const onceRes1 = grantStarterEventPack(
      basePilot,
      { ...DEFAULT_STARTER_EVENT_CONFIG, mode: 'oncePerSave' },
      'striker'
    );
    expect(onceRes1.granted).toHaveLength(4);
    expect(onceRes1.pilot.cards).toEqual({
      card_credit_50000: 5,
      card_exp_10000: 5,
    });
    expect(onceRes1.pilot.vouchers).toEqual({
      v_credit_100000: 10,
      v_exp_100000: 10,
    });
    expect(onceRes1.pilot.starterEventGranted).toEqual(['striker']);

    // oncePerSave ignores subsequent gear unlocks
    const onceRes2 = grantStarterEventPack(
      onceRes1.pilot,
      { ...DEFAULT_STARTER_EVENT_CONFIG, mode: 'oncePerSave' },
      'interceptor'
    );
    expect(onceRes2.granted).toHaveLength(0);
    expect(onceRes2.pilot.cards).toEqual({
      card_credit_50000: 5,
      card_exp_10000: 5,
    });

    // perGear grants once per gear id
    const perGearRes = grantStarterEventPack(
      onceRes1.pilot,
      { ...DEFAULT_STARTER_EVENT_CONFIG, mode: 'perGear' },
      'interceptor'
    );
    expect(perGearRes.granted).toHaveLength(4);
    expect(perGearRes.pilot.cards?.card_credit_50000).toBe(10);
    expect(perGearRes.pilot.starterEventGranted).toEqual([
      'striker',
      'interceptor',
    ]);
    const perGearDup = grantStarterEventPack(
      perGearRes.pilot,
      { ...DEFAULT_STARTER_EVENT_CONFIG, mode: 'perGear' },
      'interceptor'
    );
    expect(perGearDup.granted).toHaveLength(0);

    // disabled is no-op unless force is true
    const disabledNoop = grantStarterEventPack(
      basePilot,
      { ...DEFAULT_STARTER_EVENT_CONFIG, enabled: false },
      'striker'
    );
    expect(disabledNoop.granted).toHaveLength(0);
    const forced = grantStarterEventPack(
      perGearRes.pilot,
      { ...DEFAULT_STARTER_EVENT_CONFIG, enabled: false },
      'interceptor',
      { force: true }
    );
    expect(forced.granted).toHaveLength(4);
    expect(forced.pilot.cards?.card_credit_50000).toBe(15);
  });

  it('2) redeemCard handles credit, EXP level-up on deployed Gear, busy in battle, max_level, and WarehouseView UI', () => {
    useGameStore.getState().startCampaign('Pilot', 'striker');
    const beforeCredits = useGameStore.getState().pilot.credits;

    // Render WarehouseView and verify default starter pack cards
    act(() => {
      root!.render(createElement(WarehouseView));
    });
    expect(
      container!.querySelector('[data-testid="warehouse-card-qty-card_credit_50000"]')
        ?.textContent
    ).toBe('×5');

    // Click [Dùng 1] on Credit card
    const useOneBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="warehouse-card-use1-card_credit_50000"]'
    );
    act(() => {
      useOneBtn!.click();
    });
    expect(useGameStore.getState().pilot.credits).toBe(beforeCredits + 50000);
    expect(useGameStore.getState().pilot.cards?.card_credit_50000).toBe(4);
    expect(
      container!.querySelector('[data-testid="warehouse-card-result"]')?.textContent
    ).toContain('+50.000 credit');

    // Click [Dùng hết] on EXP card -> levels up active Gear (striker)
    const useAllExpBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="warehouse-card-useall-card_exp_10000"]'
    );
    act(() => {
      useAllExpBtn!.click();
    });
    expect(useGameStore.getState().pilot.cards?.card_exp_10000).toBeUndefined();
    expect(useGameStore.getState().pilot.gears.striker.level).toBeGreaterThan(1);
    expect(
      container!.querySelector('[data-testid="warehouse-card-result"]')?.textContent
    ).toContain('+50.000 EXP');

    // Refused during battle (busy)
    act(() => {
      useGameStore.getState().startBattle();
      useGameStore.setState((s) => ({
        pilot: {
          ...s.pilot,
          cards: { ...(s.pilot.cards ?? {}), card_exp_1000: 2 },
        },
      }));
    });
    const busyRes = useGameStore.getState().redeemCard('card_exp_1000', 1);
    expect(busyRes).toEqual({ ok: false, reason: 'busy' });

    // Refused at max_level without consuming cards
    const maxLv = getMaxLevel();
    act(() => {
      useGameStore.setState((s) => ({
        screen: 'HANGAR',
        battle: null,
        autoRepeatSession: null,
        pilot: {
          ...s.pilot,
          gears: {
            ...s.pilot.gears,
            striker: { ...s.pilot.gears.striker, level: maxLv, exp: 0 },
          },
        },
      }));
    });
    const maxRes = useGameStore.getState().redeemCard('card_exp_1000', 1);
    expect(maxRes.ok).toBe(false);
    expect(maxRes.reason).toBe('max_level');
    expect(useGameStore.getState().pilot.cards?.card_exp_1000).toBe(2);
  });

  it('3) sanitizers validate card ids, drop zeros/invalid entries, and drop vouchers without matching defs', () => {
    const cleanCards = sanitizeOwnedCards({
      card_credit_50000: 3.9,
      card_exp_10000: 0,
      card_exp_500: -4,
      card_credit_99: 5, // below min 100
      card_exp_99999999: 2, // above max 1,000,000
      card_credit_05000: 2, // leading zero invalid
      card_invalid_1000: 4,
      card_credit_1000000: 150000, // clamped to 99999
    });
    expect(cleanCards).toEqual({
      card_credit_50000: 3,
      card_credit_1000000: 99999,
    });
    expect(getCardName('card_credit_50000', 'vi')).toBe('Thẻ Credit 50.000');
    expect(getCardName('card_exp_10000', 'en')).toBe('EXP Card 10,000');

    const entries22 = Array.from({ length: 22 }, (_, i) => ({
      type: 'card_credit',
      value: 1000 + i * 100,
      qty: 1,
    }));
    const cleanCfg = sanitizeStarterEventConfig({
      enabled: true,
      mode: 'perGear',
      entries: [
        { type: 'voucher_credit', value: 999999, qty: 3 }, // no def -> dropped
        { type: 'voucher_credit', value: 100000, qty: 2 }, // exists -> kept
        { type: 'card_exp', value: 50, qty: 2000 }, // clamped 100, qty clamped 999
        ...entries22,
      ],
    });
    expect(cleanCfg.mode).toBe('perGear');
    expect(cleanCfg.entries).toHaveLength(20);
    expect(cleanCfg.entries[0]).toEqual({
      type: 'voucher_credit',
      value: 100000,
      qty: 2,
    });
    expect(cleanCfg.entries[1]).toEqual({
      type: 'card_exp',
      value: 100,
      qty: 999,
    });
  });

  it('4) old save loads via migrateSaveData with no cards and no automatic grant', () => {
    const fresh = createFreshCampaignState('Legacy', 'striker', () => 0.25);
    const oldSaveRaw = {
      ...fresh,
      pilot: {
        ...fresh.pilot,
        vouchers: { v_credit_1000: 2 },
        cards: undefined,
        starterEventGranted: undefined,
      },
      adminConfig: {
        ...fresh.adminConfig,
        starterEvent: undefined,
      },
    };

    const migrated = migrateSaveData(oldSaveRaw, CURRENT_SAVE_VERSION - 1, () => 0.25);
    expect(migrated.pilot.cards).toBeUndefined();
    expect(migrated.pilot.starterEventGranted).toBeUndefined();
    expect(migrated.pilot.vouchers).toEqual({ v_credit_1000: 2 });
    expect(migrated.adminConfig.starterEvent).toEqual(DEFAULT_STARTER_EVENT_CONFIG);
  });

  it('5) StarterEventAdminBlock renders collapsed AdminSection and total line matching summarizeStarterEvent', () => {
    useGameStore.getState().startCampaign('AdminTester', 'striker');
    const state = useGameStore.getState();

    // Collapsed by default in AdminSection
    act(() => {
      root!.render(
        createElement(
          AdminSection,
          {
            id: 'starter-event',
            title: 'Sự kiện tân thủ',
            description: 'Mô tả sự kiện tân thủ',
          },
          createElement(StarterEventAdminBlock, {
            adminConfig: state.adminConfig,
            adminUpdateConfig: state.adminUpdateConfig,
          })
        )
      );
    });
    const body = container!.querySelector<HTMLElement>(
      '[data-testid="admin-section-body-starter-event"]'
    );
    expect(body?.hidden).toBe(true);

    // Expand section
    const toggleBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-section-toggle-starter-event"]'
    );
    act(() => {
      toggleBtn!.click();
    });
    expect(body?.hidden).toBe(false);

    const summary = summarizeStarterEvent(
      state.adminConfig.starterEvent,
      state.adminConfig.vouchers
    );
    const expectedLv = estimateLevelFromExpFromLv1(summary.exp);
    expect(summary).toEqual({
      credit: 250000,
      exp: 50000,
      voucherCredit: 1000000,
      voucherExp: 1000000,
      buffCardsCount: 0,
      suppliesCount: 0,
    });

    const totalText =
      container!.querySelector('[data-testid="admin-starter-event-total"]')
        ?.textContent ?? '';
    expect(totalText).toContain(summary.credit.toLocaleString('vi-VN'));
    expect(totalText).toContain(summary.exp.toLocaleString('vi-VN'));
    expect(totalText).toContain(`Lv.${expectedLv}`);
    expect(totalText).toContain(summary.voucherCredit.toLocaleString('vi-VN'));
    expect(totalText).toContain(summary.voucherExp.toLocaleString('vi-VN'));
  });
});
