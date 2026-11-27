import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOUCHER_CONFIG,
  getAllVouchers,
  getVoucherDefaultMaxStock,
  getVoucherPriceWp,
  getVoucherWeights,
  SYSTEM_VOUCHERS,
} from '../../data/vouchers';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { useGameStore } from '../../store/useGameStore';

describe('TASK VOUCHER-a — Voucher data, migration, and WP shop', () => {
  it('1) getVoucherPriceWp applies kind ratio and clamps at >= 1 WP', () => {
    const credit10k = SYSTEM_VOUCHERS.find(
      (v) => v.kind === 'credit' && v.value === 10000
    )!;
    const exp500 = SYSTEM_VOUCHERS.find(
      (v) => v.kind === 'exp' && v.value === 500
    )!;
    expect(SYSTEM_VOUCHERS).toHaveLength(20);
    expect(getVoucherPriceWp(credit10k, DEFAULT_VOUCHER_CONFIG)).toBe(100);
    expect(
      getVoucherPriceWp(exp500, { ...DEFAULT_VOUCHER_CONFIG, expPerWp: 1000 })
    ).toBe(1);
    expect(
      getVoucherPriceWp(credit10k, {
        ...DEFAULT_VOUCHER_CONFIG,
        creditPerWp: 200,
      })
    ).toBe(50);
  });

  it('2) getVoucherWeights supports perType vs tierDecay, overrides win, and default maxStock is 5/3/1', () => {
    const decayWeights = getVoucherWeights({
      ...DEFAULT_VOUCHER_CONFIG,
      mode: 'tierDecay',
      baseWeight: 100,
      tierDecayPct: 30,
      overrides: { v_credit_2000: { weight: 777 } },
    });
    expect(decayWeights.v_credit_1000).toBe(100);
    expect(decayWeights.v_credit_2000).toBe(777);
    expect(decayWeights.v_credit_5000).toBeCloseTo(49, 5);

    const perTypeWeights = getVoucherWeights({
      ...DEFAULT_VOUCHER_CONFIG,
      mode: 'perType',
      overrides: { v_exp_1000: { weight: 250 } },
      custom: [
        {
          id: 'v_custom_1',
          kind: 'credit',
          value: 4000,
          system: false,
          weight: 40,
          maxStock: 2,
        },
      ],
    });
    expect(perTypeWeights.v_credit_1000).toBe(100);
    expect(perTypeWeights.v_exp_1000).toBe(250);
    expect(perTypeWeights.v_custom_1).toBe(40);

    expect(
      getVoucherDefaultMaxStock(
        SYSTEM_VOUCHERS.find((v) => v.id === 'v_credit_1000')!
      )
    ).toBe(5);
    expect(
      getVoucherDefaultMaxStock(
        SYSTEM_VOUCHERS.find((v) => v.id === 'v_credit_10000')!
      )
    ).toBe(3);
    expect(
      getVoucherDefaultMaxStock(
        SYSTEM_VOUCHERS.find((v) => v.id === 'v_credit_100000')!
      )
    ).toBe(1);
  });

  it('3) migration 14 -> 15 adds defaults, drops unknown voucher ids (keeps custom), and rolls stock', () => {
    expect(CURRENT_SAVE_VERSION).toBe(15);
    const base14 = createFreshCampaignState('Pilot', 'striker', () => 0.25);
    const v14Raw = {
      ...base14,
      pilot: {
        ...base14.pilot,
        vouchers: {
          v_credit_1000: 3.8,
          v_credit_2000: -4,
          v_custom_1: 2,
          v_unknown_fake: 99,
        },
      },
      adminConfig: {
        ...base14.adminConfig,
        vouchers: {
          ...DEFAULT_VOUCHER_CONFIG,
          typesPerRoll: 4,
          custom: [
            {
              id: 'v_custom_1',
              kind: 'exp',
              value: 2500,
              system: false,
              weight: 50,
              maxStock: 4,
            },
          ],
        },
      },
      voucherShopStockWp: undefined,
    };

    const migrated = migrateSaveData(v14Raw, 14, () => 0.15);
    expect(migrated.pilot.vouchers).toEqual({
      v_credit_1000: 3,
      v_credit_2000: 0,
      v_custom_1: 2,
    });
    expect(getAllVouchers(migrated.adminConfig).some((v) => v.id === 'v_custom_1')).toBe(true);
    expect(migrated.voucherShopStockWp).toHaveLength(4);
  });

  it('4) buyVoucher happy path clamps qty to remaining, spends WP, adds owned qty, lowers stock', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Buyer', 'striker');
    useGameStore.setState((s) => ({
      pilot: { ...s.pilot, warPoints: 500, vouchers: {} },
      voucherShopStockWp: [{ voucherId: 'v_credit_10000', remaining: 2 }],
    }));

    const res = useGameStore.getState().buyVoucher('v_credit_10000', 5);
    expect(res).toEqual({ ok: true, bought: 2 });

    const next = useGameStore.getState();
    expect(next.pilot.warPoints).toBe(300);
    expect(next.pilot.vouchers?.v_credit_10000).toBe(2);
    expect(next.voucherShopStockWp[0].remaining).toBe(0);
  });

  it('5) buyVoucher fails cleanly when WP is insufficient', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('LowWp', 'striker');
    useGameStore.setState((s) => ({
      pilot: { ...s.pilot, warPoints: 50, vouchers: { v_credit_10000: 1 } },
      voucherShopStockWp: [{ voucherId: 'v_credit_10000', remaining: 3 }],
    }));

    const res = useGameStore.getState().buyVoucher('v_credit_10000', 1);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('insufficient_wp');

    const next = useGameStore.getState();
    expect(next.pilot.warPoints).toBe(50);
    expect(next.pilot.vouchers?.v_credit_10000).toBe(1);
    expect(next.voucherShopStockWp[0].remaining).toBe(3);
  });
});
