// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BALANCE_CONFIG,
  DEFAULT_BATTLE_REWARDS_CONFIG,
  sanitizeBattleRewardsConfig,
} from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { SECTORS_CATALOG } from '../../data/maps';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { BattleSummary, CombatUnit, Language } from '../../types/game';
import { BattleResultDialog } from '../../components/BattleResultDialog';
import { AdminPanel } from '../../components/AdminPanel';
import { calculateBattleRewards } from '../combat';
import { CURRENT_SAVE_VERSION, migrateSaveData } from '../migration';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeEnemy(id: string, level: number, alive: boolean): CombatUnit {
  return {
    id,
    name: id,
    callsign: id,
    side: 'enemy',
    isPlayer: false,
    classId: 'striker',
    row: 'front',
    archetype: 'gunship',
    isBoss: false,
    level,
    skillLevel: 1,
    skillLevels: { str_hotload_shells: 1 },
    equippedSkillIds: ['str_hotload_shells'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 100,
      maxShield: 50,
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
    hp: alive ? 100 : 0,
    shield: alive ? 50 : 0,
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

describe('TASK ECON-LOSS-a — National support & capped defeat/retreat rewards', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it('1) win at level 1 -> EXP x3, credit/enemy-WP x2 (capture WP unscaled); level 11 -> x1; dialog line only when > 0', () => {
    const enemies = [
      makeEnemy('e1', 2, false),
      makeEnemy('e2', 2, false),
      makeEnemy('e3', 2, false),
      makeEnemy('e4', 2, false),
    ];
    // Full victory base at mult 2.0: exp = 164*2 = 328, credits = 400*2 = 800, enemyWp = 24
    const sector = SECTORS_CATALOG[0];
    const captureBonus = BALANCE_CONFIG.warPointsBaseCaptureBonus[sector.difficulty];

    const lv1Win = calculateBattleRewards(
      enemies,
      true,
      2.0,
      sector.id,
      false,
      DEFAULT_BATTLE_REWARDS_CONFIG,
      1,
      false
    );
    expect(lv1Win.fullVictoryExp).toBe(328);
    expect(lv1Win.fullVictoryCredits).toBe(800);
    expect(lv1Win.expGained).toBe(328 * 3);
    expect(lv1Win.creditsGained).toBe(800 * 2);
    expect(lv1Win.baseCaptureBonusWp).toBe(captureBonus);
    expect(lv1Win.warPointsGained).toBe(24 * 2 + captureBonus);
    expect(lv1Win.supportExpPct).toBe(200);
    expect(lv1Win.supportCreditPct).toBe(100);

    const lv11Win = calculateBattleRewards(
      enemies,
      true,
      2.0,
      sector.id,
      false,
      DEFAULT_BATTLE_REWARDS_CONFIG,
      11,
      false
    );
    expect(lv11Win.expGained).toBe(328);
    expect(lv11Win.creditsGained).toBe(800);
    expect(lv11Win.warPointsGained).toBe(24 + captureBonus);
    expect(lv11Win.supportExpPct).toBe(0);
    expect(lv11Win.supportCreditPct).toBe(0);

    const baseSummary: BattleSummary = {
      outcome: 'victory',
      retreated: false,
      deployedGearId: 'striker',
      sectorId: sector.id,
      rounds: 3,
      expGained: lv1Win.expGained,
      creditsGained: lv1Win.creditsGained,
      warPointsGained: lv1Win.warPointsGained,
      baseCaptureBonusWp: lv1Win.baseCaptureBonusWp,
      supportExpPct: lv1Win.supportExpPct,
      supportCreditPct: lv1Win.supportCreditPct,
      leveledUp: false,
      previousLevel: 1,
      newLevel: 1,
      statPointsGained: 0,
      battlesToNextLevel: 1,
      unlockedSectorId: null,
      enemiesDestroyed: 4,
      totalEnemies: 4,
      alliesSurviving: 4,
      droppedItems: [],
    };
    const renderDlg = (summary: BattleSummary, lang: Language = 'vi') => {
      const t = (key: TranslationKey, params?: Record<string, string | number>) =>
        translate(lang, key, params);
      act(() => {
        root!.render(
          createElement(BattleResultDialog, {
            summary,
            squadSize: 4,
            lang,
            t,
            onOpenReport: vi.fn(),
            onOpenLog: vi.fn(),
            onReturnHangar: vi.fn(),
            onNextSortie: vi.fn(),
          })
        );
      });
    };

    renderDlg(baseSummary);
    const supportLine = container!.querySelector(
      '[data-testid="battle-result-national-support"]'
    );
    expect(supportLine?.textContent).toBe(
      'Hỗ trợ quốc gia: +200% EXP, +100% Credit/WP'
    );

    renderDlg({ ...baseSummary, supportExpPct: 0, supportCreditPct: 0 });
    expect(
      container!.querySelector('[data-testid="battle-result-national-support"]')
    ).toBeNull();
  });

  it('2) defeat uses 5%/20%/50% destroyed shares (no consolation/support) and caps each at defeatMaxPctOfVictory (50%)', () => {
    const twoDown = [
      makeEnemy('e1', 2, false),
      makeEnemy('e2', 2, false),
      makeEnemy('e3', 2, true),
      makeEnemy('e4', 2, true),
    ];
    // Destroyed full: 164 EXP, 400 CR, 12 WP; Full victory: 328 EXP, 800 CR, 24 WP
    const res = calculateBattleRewards(
      twoDown,
      false,
      2.0,
      SECTORS_CATALOG[0].id,
      true,
      DEFAULT_BATTLE_REWARDS_CONFIG,
      1,
      false
    );
    expect(res.expGained).toBe(8); // round(164 * 0.05) = 8
    expect(res.creditsGained).toBe(80); // 400 * 0.20
    expect(res.warPointsGained).toBe(6); // 12 * 0.50
    expect(res.supportExpPct).toBe(0);
    expect(res.supportCreditPct).toBe(0);

    // Three down with 100% shares hits the 50% of victory cap
    const threeDown = [
      makeEnemy('e1', 2, false),
      makeEnemy('e2', 2, false),
      makeEnemy('e3', 2, false),
      makeEnemy('e4', 2, true),
    ];
    const capped = calculateBattleRewards(
      threeDown,
      false,
      2.0,
      SECTORS_CATALOG[0].id,
      true,
      {
        ...DEFAULT_BATTLE_REWARDS_CONFIG,
        defeatExpPct: 100,
        defeatCreditPct: 100,
        defeatWpPct: 100,
        defeatMaxPctOfVictory: 50,
      },
      1,
      false
    );
    expect(capped.expGained).toBe(164); // 50% of 328
    expect(capped.creditsGained).toBe(400); // 50% of 800
    expect(capped.warPointsGained).toBe(12); // 50% of 24
  });

  it('3) setting any defeat share to 0 disables that reward', () => {
    const allDown = [
      makeEnemy('e1', 2, false),
      makeEnemy('e2', 2, false),
      makeEnemy('e3', 2, false),
      makeEnemy('e4', 2, false),
    ];
    const zeroExp = calculateBattleRewards(
      allDown,
      false,
      2.0,
      undefined,
      true,
      { ...DEFAULT_BATTLE_REWARDS_CONFIG, defeatExpPct: 0 },
      1,
      false
    );
    expect(zeroExp.expGained).toBe(0);
    expect(zeroExp.creditsGained).toBe(160);
    expect(zeroExp.warPointsGained).toBe(12);

    const zeroAll = calculateBattleRewards(
      allDown,
      false,
      2.0,
      undefined,
      true,
      {
        ...DEFAULT_BATTLE_REWARDS_CONFIG,
        defeatExpPct: 0,
        defeatCreditPct: 0,
        defeatWpPct: 0,
      },
      1,
      false
    );
    expect(zeroAll.expGained).toBe(0);
    expect(zeroAll.creditsGained).toBe(0);
    expect(zeroAll.warPointsGained).toBe(0);
  });

  it('4) retreat awards 50% of the capped defeat reward', () => {
    const allDown = [
      makeEnemy('e1', 2, false),
      makeEnemy('e2', 2, false),
      makeEnemy('e3', 2, false),
      makeEnemy('e4', 2, false),
    ];
    const defeatRes = calculateBattleRewards(
      allDown,
      false,
      2.0,
      undefined,
      true,
      DEFAULT_BATTLE_REWARDS_CONFIG,
      3,
      false
    );
    const retreatRes = calculateBattleRewards(
      allDown,
      false,
      2.0,
      undefined,
      true,
      DEFAULT_BATTLE_REWARDS_CONFIG,
      3,
      true
    );
    expect(defeatRes.expGained).toBe(16); // round(328 * 0.05) = 16
    expect(defeatRes.creditsGained).toBe(160); // 800 * 0.20 = 160
    expect(defeatRes.warPointsGained).toBe(12); // 24 * 0.50 = 12

    expect(retreatRes.expGained).toBe(8);
    expect(retreatRes.creditsGained).toBe(80);
    expect(retreatRes.warPointsGained).toBe(6);
  });

  it('5) sanitizer clamps ranges, old saves default cleanly without bumping CURRENT_SAVE_VERSION, and Admin block shows live examples', () => {
    expect(CURRENT_SAVE_VERSION).toBe(14);

    const clamped = sanitizeBattleRewardsConfig({
      supportMaxLevel: 999,
      supportExpPerLevelPct: 999,
      supportCreditWpPerLevelPct: -10,
      defeatExpPct: -5,
      defeatCreditPct: 150,
      defeatWpPct: 25,
      defeatMaxPctOfVictory: 200,
      retreatRewardPct: -1,
    });
    expect(clamped).toEqual({
      supportMaxLevel: 100,
      supportExpPerLevelPct: 500,
      supportCreditWpPerLevelPct: 0,
      defeatExpPct: 0,
      defeatCreditPct: 100,
      defeatWpPct: 25,
      defeatMaxPctOfVictory: 100,
      retreatRewardPct: 0,
    });

    const migrated = migrateSaveData(
      {
        adminConfig: {},
      },
      13
    );
    expect(migrated.adminConfig.battleRewards).toEqual(
      DEFAULT_BATTLE_REWARDS_CONFIG
    );

    // AdminPanel mounts collapsed "Thưởng trận" section with live examples
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('RewardAdminTester', 'striker');
    useGameStore.getState().setLanguage('vi');
    act(() => {
      useGameStore.setState({ adminPanelOpen: true });
      root!.render(createElement(AdminPanel));
    });
    act(() => {
      container!
        .querySelector<HTMLButtonElement>('[data-testid="admin-tab-battle"]')!
        .click();
    });
    const toggle = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-section-toggle-battle-rewards"]'
    )!;
    expect(toggle.textContent).toContain('Thưởng trận');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      toggle.click();
    });
    expect(
      container!.querySelector(
        '[data-testid="admin-battle-rewards-example-win"]'
      )?.textContent
    ).toBe('Level 1 thắng: EXP 300%, Credit/WP 200%');
    expect(
      container!.querySelector(
        '[data-testid="admin-battle-rewards-example-defeat"]'
      )?.textContent
    ).toBe('Thua: tối đa 50% phần thưởng thắng');

    const capInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-battle-rewards-defeatMaxPctOfVictory"]'
    )!;
    act(() => {
      setReactInputValue(capInput, '35');
    });
    expect(
      container!.querySelector(
        '[data-testid="admin-battle-rewards-example-defeat"]'
      )?.textContent
    ).toBe('Thua: tối đa 35% phần thưởng thắng');
  });
});
