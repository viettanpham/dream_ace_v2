// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleResultDialog } from '../../components/BattleResultDialog';
import { BattleScreen } from '../../components/BattleScreen';
import {
  VoucherRedeemDialog,
  hasUsableVoucherForSummary,
} from '../../components/VoucherRedeemDialog';
import { WarehouseView } from '../../components/WarehouseView';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { BattleSummary, Language } from '../../types/game';
import { VOUCHER_AUTO_STORAGE_KEY } from '../../utils/voucherAutoPrefs';
import {
  applyVoucherRefund,
  pickVouchersSmallestSufficient,
} from '../battlePenalty';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeSummary(overrides: Partial<BattleSummary> = {}): BattleSummary {
  return {
    outcome: 'defeat',
    retreated: true,
    deployedGearId: 'striker',
    sectorId: 'debris_belt',
    rounds: 4,
    expGained: 0,
    creditsGained: 0,
    warPointsGained: 0,
    baseCaptureBonusWp: 0,
    leveledUp: false,
    previousLevel: 4,
    newLevel: 4,
    statPointsGained: 0,
    battlesToNextLevel: 2,
    unlockedSectorId: null,
    enemiesDestroyed: 1,
    totalEnemies: 4,
    alliesSurviving: 2,
    droppedItems: [],
    repairFee: 10000,
    retreatPenaltyCredit: 5000,
    retreatPenaltyExp: 500,
    expBeforePenalty: 1000,
    ...overrides,
  };
}

describe('VOUCHER-b — Use vouchers after defeat/retreat', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    if (typeof window.matchMedia !== 'function') {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as typeof window.matchMedia;
    }
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    if (typeof Element.prototype.scrollIntoView !== 'function') {
      Element.prototype.scrollIntoView = vi.fn();
    }
    useGameStore.getState().resetCampaign();
    useGameStore.setState({ language: 'vi' });
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

  it('1) pickVouchersSmallestSufficient picks smallest >= remaining, else largest', () => {
    expect(
      pickVouchersSmallestSufficient(
        { v_credit_10000: 1, v_credit_20000: 1, v_exp_100000: 2 },
        'credit',
        15000
      )
    ).toEqual({ v_credit_20000: 1 });

    expect(
      pickVouchersSmallestSufficient(
        { v_credit_5000: 2, v_credit_10000: 1 },
        'credit',
        12000
      )
    ).toEqual({ v_credit_10000: 1, v_credit_5000: 1 });

    expect(
      pickVouchersSmallestSufficient({ v_credit_1000: 2 }, 'credit', 0)
    ).toEqual({});
  });

  it('2) applyVoucherRefund caps refund at charged when using a bigger voucher and isolates kinds', () => {
    const res = applyVoucherRefund(
      { v_credit_20000: 1, v_exp_5000: 1 },
      'credit',
      15000
    );
    expect(res).toEqual({
      used: { v_credit_20000: 1 },
      refund: 15000,
    });

    const expRes = applyVoucherRefund(
      { v_credit_20000: 1, v_exp_1000: 1 },
      'exp',
      600
    );
    expect(expRes).toEqual({
      used: { v_exp_1000: 1 },
      refund: 600,
    });
  });

  it('3) store redeemVouchers refunds credits and EXP (capped at pre-penalty EXP) once only', () => {
    useGameStore.getState().startCampaign('VoucherAce', 'striker');
    useGameStore.getState().startBattle('border_outpost');

    const summary = makeSummary({
      repairFee: 10000,
      retreatPenaltyCredit: 5000,
      retreatPenaltyExp: 500,
      expBeforePenalty: 1000,
    });

    useGameStore.setState((state) => ({
      pilot: {
        ...state.pilot,
        credits: 20000,
        vouchers: { v_credit_20000: 1, v_exp_1000: 2 },
        gears: {
          ...state.pilot.gears,
          striker: {
            ...state.pilot.gears.striker,
            exp: 500,
          },
        },
      },
      battle: state.battle ? { ...state.battle, summary } : state.battle,
    }));

    const first = useGameStore.getState().redeemVouchers({
      credit: { v_credit_20000: 1 },
      exp: { v_exp_1000: 1 },
    });
    expect(first.ok).toBe(true);
    expect(first.creditRefund).toBe(15000);
    expect(first.expRefund).toBe(500);

    const after = useGameStore.getState();
    expect(after.pilot.credits).toBe(35000);
    expect(after.pilot.gears.striker.exp).toBe(1000);
    expect(after.pilot.vouchers).toEqual({ v_exp_1000: 1 });
    expect(after.battle?.summary?.voucherCreditUsed).toEqual({
      v_credit_20000: 1,
    });
    expect(after.battle?.summary?.voucherCreditRefund).toBe(15000);
    expect(after.battle?.summary?.voucherExpRefund).toBe(500);

    const second = useGameStore.getState().redeemVouchers({
      credit: {},
      exp: { v_exp_1000: 1 },
    });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already_redeemed');
    expect(useGameStore.getState().pilot.vouchers).toEqual({ v_exp_1000: 1 });
  });

  it('4) VoucherRedeemDialog shows only when usable vouchers exist, supports skip, and BattleResultDialog shows retreat repair + voucher line', () => {
    const victorySummary = makeSummary({
      outcome: 'victory',
      retreated: false,
      repairFee: 0,
      retreatPenaltyCredit: 0,
      retreatPenaltyExp: 0,
    });
    expect(
      hasUsableVoucherForSummary(victorySummary, { v_credit_5000: 1 })
    ).toBe(false);

    const defeatSummary = makeSummary({
      outcome: 'defeat',
      retreated: true,
      repairFee: 10000,
      retreatPenaltyCredit: 5000,
      retreatPenaltyExp: 0,
    });
    expect(
      hasUsableVoucherForSummary(defeatSummary, { v_exp_1000: 1 })
    ).toBe(false);
    expect(
      hasUsableVoucherForSummary(defeatSummary, { v_credit_20000: 1 })
    ).toBe(true);

    const lang: Language = 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    act(() => {
      root.render(
        createElement(VoucherRedeemDialog, {
          summary: defeatSummary,
          ownedVouchers: { v_credit_10000: 1, v_credit_20000: 1 },
          lang,
          t,
          onConfirm,
          onSkip,
        })
      );
    });

    expect(
      container.querySelector('[data-testid="voucher-redeem-qty-v_credit_20000"]')
        ?.textContent
    ).toBe('1');
    expect(
      container.querySelector('[data-testid="voucher-redeem-refund-credit"]')
        ?.textContent
    ).toContain('15.000');

    const skipBtn = container.querySelector(
      '[data-testid="voucher-redeem-skip"]'
    ) as HTMLButtonElement;
    act(() => {
      skipBtn.click();
    });
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => {
      root.render(
        createElement(BattleResultDialog, {
          summary: {
            ...defeatSummary,
            voucherRedeemed: true,
            voucherCreditRefund: 15000,
            voucherExpRefund: 0,
          },
          squadSize: 3,
          lang,
          t,
          onOpenReport: vi.fn(),
          onOpenLog: vi.fn(),
          onReturnHangar: vi.fn(),
          onNextSortie: vi.fn(),
        })
      );
    });

    expect(
      container.querySelector('[data-testid="battle-result-repair-line"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-result-voucher-line"]')
        ?.textContent
    ).toContain('15.000 credit');
  });

  it('5) WarehouseView lists vouchers + auto toggle (default OFF), and ON auto-redeems without dialog on BattleScreen', () => {
    useGameStore.getState().startCampaign('AutoVoucherAce', 'striker');
    useGameStore.setState((state) => ({
      language: 'vi',
      screen: 'HANGAR',
      activeTab: 'warehouse',
      pilot: {
        ...state.pilot,
        credits: 5000,
        vouchers: { v_credit_10000: 2 },
      },
    }));

    act(() => {
      root.render(createElement(WarehouseView));
    });

    expect(
      container.querySelector('[data-testid="warehouse-voucher-qty-v_credit_10000"]')
        ?.textContent
    ).toBe('×2');

    const toggle = container.querySelector(
      '[data-testid="warehouse-voucher-auto-toggle"]'
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    act(() => {
      toggle.click();
    });
    expect(toggle.checked).toBe(true);
    expect(window.localStorage.getItem(VOUCHER_AUTO_STORAGE_KEY)).toBe('1');

    act(() => {
      useGameStore.getState().startBattle('border_outpost');
      const summary = makeSummary({
        outcome: 'defeat',
        retreated: true,
        repairFee: 7000,
        retreatPenaltyCredit: 0,
        retreatPenaltyExp: 0,
      });
      useGameStore.setState((state) => ({
        screen: 'BATTLE',
        battle: state.battle ? { ...state.battle, summary } : state.battle,
      }));
      root.render(createElement(BattleScreen));
    });

    expect(
      container.querySelector('[data-testid="voucher-redeem-dialog"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="battle-result-dialog"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="battle-result-voucher-line"]')
        ?.textContent
    ).toContain('7.000 credit');
    expect(useGameStore.getState().pilot.credits).toBe(12000);
    expect(useGameStore.getState().pilot.vouchers).toEqual({
      v_credit_10000: 1,
    });
  });
});
