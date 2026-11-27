// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPanel } from '../../components/AdminPanel';
import { BattleResultDialog } from '../../components/BattleResultDialog';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import {
  DEFAULT_BATTLE_PENALTY_CONFIG,
  sanitizeBattlePenaltyConfig,
} from '../../data/balance';
import { formatCombatLogMessage, translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { BattleSummary, CombatUnit, Language } from '../../types/game';
import { computeRepairFee, computeRetreatPenalty } from '../battlePenalty';
import { CURRENT_SAVE_VERSION, migrateSaveData } from '../migration';
import { getExpForNextLevel } from '../stats';

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
    level: 15,
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

describe('TASK ECON-LOSS-b — Retreat penalty & defeat/retreat repair fees', () => {
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

  it('1) retreat penalty handles exp >= pen, exp < pen shortfall, never de-levels, and floors credits/WP at 0', () => {
    const level = 25;
    const need = getExpForNextLevel(level);
    const tenPct = Math.round(need * 0.1);
    const thirtyPct = Math.round(need * 0.3);

    // Branch A: gear.exp >= expPen (subtract 10% EXP, 10% CR, 10% of creditPen as WP)
    const enough = computeRetreatPenalty(
      level,
      tenPct + 200,
      50000,
      10000,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(enough.expPenalty).toBe(tenPct);
    expect(enough.nextExp).toBe(200);
    expect(enough.creditPenalty).toBe(tenPct);
    expect(enough.wpPenalty).toBe(Math.round(tenPct * 0.1));
    expect(enough.nextCredits).toBe(50000 - tenPct);
    expect(enough.nextWarPoints).toBe(10000 - Math.round(tenPct * 0.1));

    // Branch B: gear.exp < expPen (0 EXP taken, 10% + 20% = 30% need CR, 10% of creditPen as WP)
    const shortfall = computeRetreatPenalty(
      level,
      Math.max(0, tenPct - 1),
      50000,
      10000,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(shortfall.expPenalty).toBe(0);
    expect(shortfall.nextExp).toBe(Math.max(0, tenPct - 1));
    expect(shortfall.creditPenalty).toBe(thirtyPct);
    expect(shortfall.wpPenalty).toBe(Math.round(thirtyPct * 0.1));

    // Floor at 0 records ONLY actual amounts taken
    const floored = computeRetreatPenalty(
      level,
      0,
      120,
      15,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(floored.expPenalty).toBe(0);
    expect(floored.creditPenalty).toBe(120);
    expect(floored.wpPenalty).toBe(15);
    expect(floored.nextCredits).toBe(0);
    expect(floored.nextWarPoints).toBe(0);
  });

  it('2) enforces free repair window per kind (level <= freeLevel AND credits <= freeCredits)', () => {
    const allies = [makeAlly('player', 1000, 200, 500, 100)];

    // Defeat: free when lv <= 20 AND credits <= 100000
    expect(
      computeRepairFee('defeat', 20, 100000, allies, DEFAULT_BATTLE_PENALTY_CONFIG)
    ).toEqual({ fee: 0, free: true });
    expect(
      computeRepairFee('defeat', 21, 5000, allies, DEFAULT_BATTLE_PENALTY_CONFIG).free
    ).toBe(false);
    expect(
      computeRepairFee('defeat', 20, 100001, allies, DEFAULT_BATTLE_PENALTY_CONFIG).free
    ).toBe(false);

    // Retreat: free when lv <= 10 AND credits <= 10000
    expect(
      computeRepairFee('retreat', 10, 10000, allies, DEFAULT_BATTLE_PENALTY_CONFIG)
    ).toEqual({ fee: 0, free: true });
    expect(
      computeRepairFee('retreat', 11, 5000, allies, DEFAULT_BATTLE_PENALTY_CONFIG).free
    ).toBe(false);
    expect(
      computeRepairFee('retreat', 10, 10001, allies, DEFAULT_BATTLE_PENALTY_CONFIG).free
    ).toBe(false);
  });

  it('3) computes defeat (max) and retreat (lost + full max for destroyed) repair fees with cap, SYSTEM logs, and dialog lines', () => {
    const allies = [
      makeAlly('player', 1000, 400, 500, 200, true), // lost: 600 HP + 300 SHD
      makeAlly('ally_2', 800, 0, 400, 0, false), // destroyed -> full: 800 HP + 400 SHD
    ];

    // Defeat: sum max = (1800 HP * 10) + (900 SHD * 10) = 27000 (< 100000 cap)
    const defeatPaid = computeRepairFee(
      'defeat',
      25,
      50000,
      allies,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(defeatPaid).toEqual({ fee: 27000, free: false });

    // Retreat: lost = (600+800)*10 + (300+400)*10 = 14000 + 7000 = 21000 (< 50000 cap)
    const retreatPaid = computeRepairFee(
      'retreat',
      25,
      50000,
      allies,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(retreatPaid).toEqual({ fee: 21000, free: false });

    // Cap check: massive HP/Shield capped at 100000 (defeat) and 50000 (retreat)
    const huge = [makeAlly('player', 20000, 0, 20000, 0, false)];
    expect(
      computeRepairFee('defeat', 25, 200000, huge, DEFAULT_BATTLE_PENALTY_CONFIG).fee
    ).toBe(100000);
    expect(
      computeRepairFee('retreat', 25, 200000, huge, DEFAULT_BATTLE_PENALTY_CONFIG).fee
    ).toBe(50000);

    // Log templates
    expect(
      formatCombatLogMessage('vi', {
        id: 'l1',
        round: 1,
        actorName: 'SYSTEM',
        tag: 'SYSTEM',
        templateKey: 'log.repairFreeDefeat',
        params: {},
      })
    ).toBe('Quốc gia chi trả phí sửa chữa');
    expect(
      formatCombatLogMessage('vi', {
        id: 'l2',
        round: 1,
        actorName: 'SYSTEM',
        tag: 'SYSTEM',
        templateKey: 'log.repairFreeRetreat',
        params: {},
      })
    ).toBe('Quốc gia phải hỗ trợ chi trả phí sửa chữa vì hành động rút lui');
    expect(
      formatCombatLogMessage('vi', {
        id: 'l3',
        round: 1,
        actorName: 'SYSTEM',
        tag: 'SYSTEM',
        templateKey: 'log.repairFee',
        params: { fee: 20581 },
      })
    ).toBe('Phí sửa chữa: -20.581 CR');

    // BattleResultDialog lines
    const baseSummary: BattleSummary = {
      outcome: 'defeat',
      retreated: true,
      deployedGearId: 'striker',
      sectorId: 'debris_belt',
      rounds: 2,
      expGained: 0,
      creditsGained: 0,
      warPointsGained: 0,
      baseCaptureBonusWp: 0,
      repairFee: 20581,
      repairFree: false,
      retreatPenaltyExp: 500,
      retreatPenaltyCredit: 30000,
      retreatPenaltyWp: 3000,
      leveledUp: false,
      previousLevel: 25,
      newLevel: 25,
      statPointsGained: 0,
      battlesToNextLevel: 10,
      unlockedSectorId: null,
      enemiesDestroyed: 0,
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
    expect(
      container!.querySelector('[data-testid="battle-result-repair-line"]')
        ?.textContent
    ).toBe('Phí sửa chữa: -20.581 CR');
    expect(
      container!.querySelector('[data-testid="battle-result-retreat-penalty"]')
        ?.textContent
    ).toBe('Phạt rút lui: -500 EXP / -30.000 CR / -3.000 WP');

    renderDlg({
      ...baseSummary,
      repairFee: 0,
      repairFree: true,
      retreatPenaltyExp: 0,
      retreatPenaltyCredit: 0,
      retreatPenaltyWp: 0,
    });
    expect(
      container!.querySelector('[data-testid="battle-result-repair-line"]')
        ?.textContent
    ).toContain('Miễn phí (quốc gia chi trả)');
    expect(
      container!.querySelector('[data-testid="battle-result-retreat-penalty"]')
    ).toBeNull();
  });

  it('4) retreat at level <= 10 pays no penalty in store retreatBattle', () => {
    const lv10Direct = computeRetreatPenalty(
      10,
      200,
      5000,
      200,
      DEFAULT_BATTLE_PENALTY_CONFIG
    );
    expect(lv10Direct).toEqual({
      expPenalty: 0,
      creditPenalty: 0,
      wpPenalty: 0,
      nextExp: 200,
      nextCredits: 5000,
      nextWarPoints: 200,
    });

    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('RetreatLv10', 'striker');
    act(() => {
      useGameStore.setState((s) => ({
        pilot: {
          ...s.pilot,
          credits: 5000,
          warPoints: 300,
          gears: {
            ...s.pilot.gears,
            striker: { ...s.pilot.gears.striker, level: 10, exp: 500 },
          },
        },
      }));
      useGameStore.getState().startBattle('border_outpost');
    });
    act(() => {
      useGameStore.getState().retreatBattle();
    });
    const after = useGameStore.getState();
    expect(after.battle?.summary?.retreatPenaltyExp).toBe(0);
    expect(after.battle?.summary?.retreatPenaltyCredit).toBe(0);
    expect(after.battle?.summary?.retreatPenaltyWp).toBe(0);
    expect(after.battle?.summary?.repairFree).toBe(true);
    expect(after.battle?.summary?.repairFee).toBe(0);
    expect(after.pilot.credits).toBe(5000);
    expect(after.pilot.warPoints).toBe(300);
    expect(after.pilot.gears.striker.exp).toBe(500);
  });

  it('5) sanitizer enforces >= 0 defaults without bumping save version and Admin block displays live example', () => {
    expect(CURRENT_SAVE_VERSION).toBe(14);
    expect(
      sanitizeBattlePenaltyConfig({
        retreatFreeLevel: -5,
        retreatExpPenaltyPct: -2,
        repairDefeat: { cap: -100, hpCoef: -1 },
      })
    ).toEqual({
      ...DEFAULT_BATTLE_PENALTY_CONFIG,
      retreatFreeLevel: 0,
      retreatExpPenaltyPct: 0,
      repairDefeat: {
        ...DEFAULT_BATTLE_PENALTY_CONFIG.repairDefeat,
        cap: 0,
        hpCoef: 0,
      },
    });

    const migrated = migrateSaveData({ adminConfig: {} }, 13);
    expect(migrated.adminConfig.battlePenalty).toEqual(
      DEFAULT_BATTLE_PENALTY_CONFIG
    );

    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('PenaltyAdminTester', 'striker');
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
      '[data-testid="admin-section-toggle-battle-penalty"]'
    )!;
    expect(toggle.textContent).toContain('Thua & rút lui');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      toggle.click();
    });
    expect(
      container!.querySelector(
        '[data-testid="admin-battle-penalty-example-retreat"]'
      )?.textContent
    ).toBe(
      'Level 25, 9% EXP, tối đa 100.000: rút lui phạt 30.000 CR + 3.000 WP'
    );

    const extraInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-battle-penalty-retreatShortfallExtraCreditPct"]'
    )!;
    act(() => {
      setReactInputValue(extraInput, '40');
    });
    expect(
      container!.querySelector(
        '[data-testid="admin-battle-penalty-example-retreat"]'
      )?.textContent
    ).toBe(
      'Level 25, 9% EXP, tối đa 100.000: rút lui phạt 50.000 CR + 5.000 WP'
    );
  });
});
