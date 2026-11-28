// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPanel } from '../../components/AdminPanel';
import { BattleResultDialog } from '../../components/BattleResultDialog';
import {
  VoucherRedeemDialog,
  hasUsableVoucherForSummary,
} from '../../components/VoucherRedeemDialog';
import {
  DEFAULT_BATTLE_PENALTY_CONFIG,
  sanitizeBattlePenaltyConfig,
} from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { BattleSummary, CombatUnit, Language } from '../../types/game';
import { computeRepairFee } from '../battlePenalty';
import { migrateSaveData } from '../migration';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeAlly(
  id: string,
  maxHp: number,
  hp: number,
  maxShield: number,
  shield: number,
  alive = hp > 0
): CombatUnit {
  return {
    id,
    name: id,
    callsign: id,
    side: 'ally',
    isPlayer: id === 'player',
    classId: 'striker',
    row: 'front',
    isBoss: false,
    level: 1,
    skillLevel: 1,
    skillLevels: { str_hotload_shells: 1 },
    equippedSkillIds: ['str_hotload_shells'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield,
      maxSp: 40,
      speed: 30,
      attackPower: 20,
      defenseRating: 10,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 20,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp,
    shield,
    sp: 40,
    isDefending: false,
    alive,
    statuses: [],
    animState: alive ? 'idle' : 'destroyed',
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

describe('VOUCHER-2 — Government repair subsidy & smarter voucher dialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
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

  it('1) fee 18,770 at Lv1 defeat -> payable 0, free, 3-number result line, no voucher dialog', () => {
    // 1877 * 10 = 18770
    const allies = [makeAlly('player', 1877, 0, 0, 0, false)];
    const res = computeRepairFee(
      'defeat',
      1,
      9999999,
      allies,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(res).toEqual({
      fee: 18770,
      subsidy: 18770,
      payable: 0,
      free: true,
    });

    const summary: BattleSummary = {
      outcome: 'defeat',
      retreated: false,
      deployedGearId: 'striker',
      sectorId: 'debris_belt',
      rounds: 2,
      expGained: 0,
      creditsGained: 0,
      warPointsGained: 0,
      baseCaptureBonusWp: 0,
      repairFee: res.payable,
      repairFeeGross: res.fee,
      repairSubsidy: res.subsidy,
      repairFree: res.free,
      leveledUp: false,
      previousLevel: 1,
      newLevel: 1,
      statPointsGained: 0,
      battlesToNextLevel: 1,
      unlockedSectorId: null,
      enemiesDestroyed: 0,
      totalEnemies: 4,
      alliesSurviving: 0,
      droppedItems: [],
    };
    expect(
      hasUsableVoucherForSummary(summary, { v_credit_10000: 2 })
    ).toBe(false);

    const lang: Language = 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);
    act(() => {
      root.render(
        createElement(BattleResultDialog, {
          summary,
          squadSize: 1,
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
        ?.textContent
    ).toBe('Phí sửa chữa 18.770 · Hỗ trợ quốc gia -18.770 · Phải trả 0');
  });

  it('2) fee 30,000 at Lv1 defeat -> payable 10,000; Lv16 defeat -> payable 30,000', () => {
    const allies = [makeAlly('player', 2000, 0, 1000, 0, false)];
    expect(
      computeRepairFee('defeat', 1, 0, allies, DEFAULT_BATTLE_PENALTY_CONFIG)
    ).toEqual({
      fee: 30000,
      subsidy: 20000,
      payable: 10000,
      free: false,
    });
    expect(
      computeRepairFee('defeat', 16, 0, allies, DEFAULT_BATTLE_PENALTY_CONFIG)
    ).toEqual({
      fee: 30000,
      subsidy: 0,
      payable: 30000,
      free: false,
    });
  });

  it('3) retreat Lv12 fee 15,000 -> payable 5,000; Lv13 -> payable 15,000', () => {
    const allies = [makeAlly('player', 2000, 1000, 1000, 500, true)]; // lost: 1000 HP + 500 SHD = 15,000
    expect(
      computeRepairFee('retreat', 12, 0, allies, DEFAULT_BATTLE_PENALTY_CONFIG)
    ).toEqual({
      fee: 15000,
      subsidy: 10000,
      payable: 5000,
      free: false,
    });
    expect(
      computeRepairFee('retreat', 13, 0, allies, DEFAULT_BATTLE_PENALTY_CONFIG)
    ).toEqual({
      fee: 15000,
      subsidy: 0,
      payable: 15000,
      free: false,
    });
  });

  it('4) legacy repair config with freeLevel/freeCredits/cap sanitizes to new defaults', () => {
    const legacy = {
      repairDefeat: {
        freeLevel: 20,
        freeCredits: 100000,
        cap: 100000,
        hpCoef: 10,
        shieldCoef: 10,
      },
      repairRetreat: {
        freeLevel: 10,
        freeCredits: 10000,
        cap: 50000,
        hpCoef: 10,
        shieldCoef: 10,
      },
    };
    expect(sanitizeBattlePenaltyConfig(legacy)).toEqual(
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    const migrated = migrateSaveData(
      { adminConfig: { battlePenalty: legacy } },
      15
    );
    expect(migrated.adminConfig.battlePenalty?.repairDefeat).toEqual({
      subsidyLevel: 15,
      subsidyMax: 20000,
      hpCoef: 10,
      shieldCoef: 10,
    });
    expect(migrated.adminConfig.battlePenalty?.repairRetreat).toEqual({
      subsidyLevel: 12,
      subsidyMax: 10000,
      hpCoef: 10,
      shieldCoef: 10,
    });
  });

  it('5) VoucherRedeemDialog shows credits before/after, waste warning, skips default when waste > 50%; Admin live example updates', () => {
    const lang: Language = 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);

    // Charged 2,000 CR, smallest voucher 10,000 CR -> waste 8,000 (80% > 50%) => default selects 0
    const highWasteSummary: BattleSummary = {
      outcome: 'defeat',
      retreated: false,
      deployedGearId: 'striker',
      sectorId: 'debris_belt',
      rounds: 2,
      expGained: 0,
      creditsGained: 0,
      warPointsGained: 0,
      baseCaptureBonusWp: 0,
      repairFee: 2000,
      repairFree: false,
      leveledUp: false,
      previousLevel: 1,
      newLevel: 1,
      statPointsGained: 0,
      battlesToNextLevel: 1,
      unlockedSectorId: null,
      enemiesDestroyed: 0,
      totalEnemies: 4,
      alliesSurviving: 0,
      droppedItems: [],
    };
    act(() => {
      root.render(
        createElement(VoucherRedeemDialog, {
          summary: highWasteSummary,
          ownedVouchers: { v_credit_10000: 1 },
          currentCredits: 40000,
          lang,
          t,
          onConfirm: vi.fn(),
          onSkip: vi.fn(),
        })
      );
    });
    expect(
      container.querySelector('[data-testid="voucher-redeem-qty-v_credit_10000"]')
        ?.textContent
    ).toBe('0');
    expect(
      container.querySelector('[data-testid="voucher-redeem-credits-after"]')
        ?.textContent
    ).toContain('40.000 CR');
    expect(
      container.querySelector('[data-testid="voucher-redeem-credits-skip"]')
        ?.textContent
    ).toContain('40.000 CR');
    expect(
      container.querySelector('[data-testid="voucher-redeem-waste-credit"]')
    ).toBeNull();

    // Manually add v_credit_10000 -> creditsAfterUse becomes 42.000 CR and waste warning shows 8.000 CR
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="voucher-redeem-inc-v_credit_10000"]'
        )!
        .click();
    });
    expect(
      container.querySelector('[data-testid="voucher-redeem-credits-after"]')
        ?.textContent
    ).toContain('42.000 CR');
    expect(
      container.querySelector('[data-testid="voucher-redeem-waste-credit"]')
        ?.textContent
    ).toContain('Phần thừa 8.000 CR bị bỏ');

    // Admin block: tier desc + live example updates immediately when subsidyMax changes
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('VoucherAdminV2', 'striker');
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
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="admin-section-toggle-battle-penalty"]'
        )!
        .click();
    });

    expect(
      container.querySelector(
        '[data-testid="admin-battle-penalty-repairDefeat-desc"]'
      )?.textContent
    ).toContain('Phí sửa tính theo hư hỏng, không có trần.');
    expect(
      container.querySelector(
        '[data-testid="admin-battle-penalty-repairDefeat-subsidyMax-example"]'
      )?.textContent
    ).toBe(
      'Phi cơ HP 3000 + khiên 1000 × 4 chiếc: phí 160.000 → hỗ trợ 20.000 → trả 140.000 (cấp ≤ 15)'
    );

    const subMaxInput = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-battle-penalty-repairDefeat-subsidyMax"]'
    )!;
    act(() => {
      setReactInputValue(subMaxInput, '50000');
    });
    expect(
      container.querySelector(
        '[data-testid="admin-battle-penalty-repairDefeat-subsidyMax-example"]'
      )?.textContent
    ).toBe(
      'Phi cơ HP 3000 + khiên 1000 × 4 chiếc: phí 160.000 → hỗ trợ 50.000 → trả 110.000 (cấp ≤ 15)'
    );
  });
});
