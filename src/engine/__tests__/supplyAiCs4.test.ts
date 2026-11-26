// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getSupplyTemplateById } from '../../data/consumables';
import { AutoTacticsModal } from '../../components/AutoTacticsModal';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import { createInitialBattleState } from '../combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import { createDefaultSimpleTactics } from '../tactics';
import {
  DEFAULT_AUTO_SUPPLIES_CONFIG,
  pickAutoSupplies,
  sanitizeAutoSuppliesConfig,
} from '../supplyAi';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'p1',
    name: 'Pilot',
    callsign: 'Pilot',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    isPlayer: true,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 2000,
      maxShield: 1000,
      maxSp: 500,
      speed: 120,
      attackPower: 100,
      defenseRating: 50,
      dodgeChance: 10,
      critChance: 15,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    alive: true,
    hp: 2000,
    shield: 1000,
    sp: 500,
    isDefending: false,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('TASK CS4 — Auto Supplies AI & Modal', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
    vi.restoreAllMocks();
  });

  it('1) sanitizeAutoSuppliesConfig returns defaults on invalid input and clamps thresholds 5..90', () => {
    expect(sanitizeAutoSuppliesConfig(undefined)).toEqual(DEFAULT_AUTO_SUPPLIES_CONFIG);
    expect(sanitizeAutoSuppliesConfig('bad')).toEqual(DEFAULT_AUTO_SUPPLIES_CONFIG);
    expect(
      sanitizeAutoSuppliesConfig({
        enabled: true,
        hpBelowPct: 1,
        shieldBelowPct: 150,
        spBelowPct: Number.NaN,
        buffAtStart: false,
      })
    ).toEqual({
      enabled: true,
      hpBelowPct: 5,
      shieldBelowPct: 90,
      spBelowPct: 20,
      buffAtStart: false,
    });
  });

  it('2) pickAutoSupplies chooses smallest sufficient HP kit by missing amount, else largest', () => {
    const adminCfg = createDefaultAdminConfig();
    const hp1 = getSupplyTemplateById('sup_hp_t1')!; // 300
    const hp2 = getSupplyTemplateById('sup_hp_t2')!; // 500
    const hp4 = getSupplyTemplateById('sup_hp_t4')!; // 1200
    const stock = { sup_hp_t1: 2, sup_hp_t2: 2, sup_hp_t4: 2 };
    const cfg = { ...DEFAULT_AUTO_SUPPLIES_CONFIG, enabled: true, hpBelowPct: 90 };

    // Missing 400 HP -> smallest >= 400 is sup_hp_t2 (500)
    const unitMid = makeUnit({ hp: 1600 });
    expect(
      pickAutoSupplies({
        unit: unitMid,
        loadoutTemplates: [hp1, hp2, hp4],
        stockByTemplate: stock,
        cfg,
        adminCfg,
      })
    ).toEqual(['sup_hp_t2']);

    // Missing 1500 HP -> none >= 1500, picks largest sup_hp_t4 (1200)
    const unitCrit = makeUnit({ hp: 500 });
    expect(
      pickAutoSupplies({
        unit: unitCrit,
        loadoutTemplates: [hp1, hp2, hp4],
        stockByTemplate: stock,
        cfg,
        adminCfg,
      })
    ).toEqual(['sup_hp_t4']);
  });

  it('3) respects thresholds, never picks utility/scan, and honors cooldown, limit, and stock', () => {
    const adminCfg = createDefaultAdminConfig();
    const hp1 = getSupplyTemplateById('sup_hp_t1')!;
    const shd1 = getSupplyTemplateById('sup_shield_t1')!;
    const scan1 = getSupplyTemplateById('sup_scan_t1')!;
    const cfg = { ...DEFAULT_AUTO_SUPPLIES_CONFIG, enabled: true };

    // Thresholds not met & utility scan ignored
    const healthy = makeUnit({ hp: 1500, shield: 800, sp: 400 });
    expect(
      pickAutoSupplies({
        unit: healthy,
        loadoutTemplates: [hp1, shd1, scan1],
        stockByTemplate: { sup_hp_t1: 5, sup_shield_t1: 5, sup_scan_t1: 5 },
        cfg,
        adminCfg,
      })
    ).toEqual([]);

    // Low HP + low shield, but hp1 is on cooldown & no stock on shd1 -> []
    const hurt = makeUnit({ hp: 200, shield: 50, sp: 10 });
    expect(
      pickAutoSupplies({
        unit: hurt,
        loadoutTemplates: [hp1, shd1, scan1],
        stockByTemplate: { sup_hp_t1: 3, sup_shield_t1: 0, sup_scan_t1: 5 },
        unitState: {
          usedThisTurn: 0,
          usedCountsByTemplate: {},
          cooldownsByTemplate: { sup_hp_t1: 1 },
        },
        cfg,
        adminCfg,
      })
    ).toEqual([]);

    // Battle limit reached -> []
    expect(
      pickAutoSupplies({
        unit: hurt,
        loadoutTemplates: [hp1],
        stockByTemplate: { sup_hp_t1: 5 },
        unitState: {
          usedThisTurn: 0,
          usedCountsByTemplate: { sup_hp_t1: 20 },
          cooldownsByTemplate: {},
        },
        cfg,
        adminCfg,
      })
    ).toEqual([]);
  });

  it('4) performAutoPlayerTurn uses a kit when enabled and leaves stock untouched when disabled', () => {
    const setupTurn = (enabled: boolean) => {
      const fresh = createFreshCampaignState('Vance', 'striker');
      const gearId = fresh.pilot.activeGearId;
      const gear = fresh.pilot.gears[gearId];
      const baseSimple =
        gear.tactics.simple ??
        createDefaultSimpleTactics(gear.classId, gear.equippedSkillBar);
      const pilot = {
        ...fresh.pilot,
        consumables: [
          {
            id: 'c_hp1',
            kind: 'battle_supply' as const,
            templateId: 'sup_hp_t1',
            quantity: 3,
          },
        ],
        gears: {
          ...fresh.pilot.gears,
          [gearId]: {
            ...gear,
            supplyLoadout: ['sup_hp_t1'],
            tactics: {
              ...gear.tactics,
              simple: {
                ...baseSimple,
                autoSupplies: {
                  ...DEFAULT_AUTO_SUPPLIES_CONFIG,
                  enabled,
                  hpBelowPct: 50,
                },
              },
            },
          },
        },
      };
      const battle = createInitialBattleState(pilot, 'border_outpost');
      const pUnit = battle.units.find((u) => u.isPlayer)!;
      const turnIdx = battle.turnOrder.indexOf(pUnit.id);
      useGameStore.setState({
        pilot,
        adminConfig: fresh.adminConfig ?? createDefaultAdminConfig(),
        autoBattleEnabled: true,
        battle: {
          ...battle,
          prestage: undefined,
          activeTurnIndex: turnIdx >= 0 ? turnIdx : 0,
          units: battle.units.map((u) =>
            u.isPlayer
              ? { ...u, hp: Math.max(10, Math.floor(u.derived.maxHp * 0.2)) }
              : u
          ),
        },
      });
    };

    setupTurn(false);
    useGameStore.getState().performAutoPlayerTurn();
    const stockDisabled =
      (useGameStore.getState().pilot.consumables ?? []).find(
        (c) => c.templateId === 'sup_hp_t1'
      )?.quantity ?? 0;
    expect(stockDisabled).toBe(3);

    setupTurn(true);
    useGameStore.getState().performAutoPlayerTurn();
    const stockEnabled =
      (useGameStore.getState().pilot.consumables ?? []).find(
        (c) => c.templateId === 'sup_hp_t1'
      )?.quantity ?? 0;
    expect(stockEnabled).toBe(2);
  });

  it('5) AutoTacticsModal toggle and inputs apply valid autoSupplies and revert invalid input', () => {
    const fresh = createFreshCampaignState('Vance', 'striker');
    const gearId = fresh.pilot.activeGearId;
    const gear = fresh.pilot.gears[gearId];
    const baseSimple =
      gear.tactics.simple ??
      createDefaultSimpleTactics(gear.classId, gear.equippedSkillBar);
    const pilot = {
      ...fresh.pilot,
      gears: {
        ...fresh.pilot.gears,
        [gearId]: {
          ...gear,
          tactics: {
            ...gear.tactics,
            mode: 'simple' as const,
            simple: baseSimple,
          },
        },
      },
    };
    const store = useGameStore.getState();
    const origApply = store.applySimpleTactics;
    const applySpy = vi.fn((patch) => origApply(patch));
    useGameStore.setState({
      language: 'vi',
      pilot,
      tacticsModalOpen: true,
      applySimpleTactics: applySpy,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(createElement(AutoTacticsModal));
    });

    expect(container.querySelector('[data-testid="auto-supplies-section"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auto-supplies-hp-input"]')).toBeNull();

    const toggle = container.querySelector('[data-testid="auto-supplies-toggle"]') as HTMLButtonElement;
    act(() => {
      toggle.click();
    });

    expect(applySpy).toHaveBeenCalledWith({
      autoSupplies: {
        ...DEFAULT_AUTO_SUPPLIES_CONFIG,
        enabled: true,
      },
    });

    act(() => {
      root!.render(createElement(AutoTacticsModal));
    });

    const hpInput = container.querySelector('[data-testid="auto-supplies-hp-input"]') as HTMLInputElement;
    const shieldInput = container.querySelector('[data-testid="auto-supplies-shield-input"]') as HTMLInputElement;
    expect(hpInput).not.toBeNull();
    expect(shieldInput).not.toBeNull();

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(hpInput, '45');
      hpInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      hpInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(applySpy).toHaveBeenLastCalledWith({
      autoSupplies: {
        ...DEFAULT_AUTO_SUPPLIES_CONFIG,
        enabled: true,
        hpBelowPct: 45,
      },
    });

    // Invalid input (>90) reverts without calling applySimpleTactics
    const callsBefore = applySpy.mock.calls.length;
    act(() => {
      shieldInput.focus();
      setter.call(shieldInput, '999');
      shieldInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      shieldInput.blur();
    });
    expect(applySpy.mock.calls.length).toBe(callsBefore);
    expect(shieldInput.value).toBe('25');
  });
});
