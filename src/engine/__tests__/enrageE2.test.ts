// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnrageAdminBlock } from '../../components/admin/EnrageAdminBlock';
import { BattleStatsModal } from '../../components/BattleStatsModal';
import { DEFAULT_ENRAGE_CONFIG } from '../../data/balance';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { AdminConfig } from '../../types/game';
import {
  createInitialBattleState,
  resolveUnitAction,
} from '../combat';
import {
  buildEnrageActivationLogs,
  getEnrageStacks,
  getEnrageState,
  sanitizeEnrageConfig,
} from '../enrage';
import { isAnyCheatActive } from '../inventory';
import {
  createDefaultAdminConfig,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { createDefaultPilotAccount } from '../stats';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('TASK ENRAGE-2 — 3-phase anti-stalemate system', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
  });

  it('1) getEnrageStacks computes 0/1/1/2 at rounds 19/20/24/25 and caps at maxStacks', () => {
    const ragePhase = DEFAULT_ENRAGE_CONFIG.rage;
    expect(getEnrageStacks(19, ragePhase)).toBe(0);
    expect(getEnrageStacks(20, ragePhase)).toBe(1);
    expect(getEnrageStacks(24, ragePhase)).toBe(1);
    expect(getEnrageStacks(25, ragePhase)).toBe(2);
    expect(getEnrageStacks(65, ragePhase)).toBe(10);
    expect(getEnrageStacks(500, ragePhase)).toBe(10);

    const defCfg = createDefaultAdminConfig();
    const at100 = getEnrageState(100, defCfg);
    expect(at100.stacks).toEqual({ rage: 10, frenzy: 11, berserker: 1 });
    expect(at100.defDownPct).toBe(50);
    expect(at100.damageUpPct).toBe(110);
    expect(at100.critRateUpPct).toBe(3);
    expect(at100.critDamageUpPct).toBe(10);
    expect(at100.highestPhase).toBe('berserker');

    // defDownPct caps at 100 even when stacks * value > 100
    const overDefCfg: AdminConfig = {
      ...defCfg,
      enrage: {
        ...DEFAULT_ENRAGE_CONFIG,
        rage: { startRound: 1, everyRounds: 1, maxStacks: 50, value: 10 },
      },
    };
    expect(getEnrageState(20, overDefCfg).defDownPct).toBe(100);
  });

  it('2) player and enemy attackers both get damageUp + target DEF down, and activation logs emit once per phase', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    const battle = createInitialBattleState(pilot, 'border_outpost');
    const enemy = battle.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    const player = battle.units.find((u) => u.isPlayer)!;
    const defCfg = createDefaultAdminConfig();

    const units = battle.units.map((u) =>
      u.id === player.id
        ? {
            ...u,
            hp: 5000,
            shield: 0,
            derived: {
              ...u.derived,
              maxHp: 5000,
              attackPower: 100,
              defenseRating: 100,
              dodgeChance: 0,
              critChance: 0,
            },
          }
        : u.id === enemy.id
        ? {
            ...u,
            hp: 5000,
            shield: 0,
            derived: {
              ...u.derived,
              maxHp: 5000,
              attackPower: 100,
              defenseRating: 100,
              dodgeChance: 0,
              critChance: 0,
            },
          }
        : u
    );

    const pR1 = resolveUnitAction(units, player.id, 'attack', enemy.id, 1, defCfg, () => 0.99);
    const pR20 = resolveUnitAction(units, player.id, 'attack', enemy.id, 20, defCfg, () => 0.99);
    const pR55 = resolveUnitAction(units, player.id, 'attack', enemy.id, 55, defCfg, () => 0.99);
    const pDmg1 = 5000 - pR1.updatedUnits.find((u) => u.id === enemy.id)!.hp;
    const pDmg20 = 5000 - pR20.updatedUnits.find((u) => u.id === enemy.id)!.hp;
    const pDmg55 = 5000 - pR55.updatedUnits.find((u) => u.id === enemy.id)!.hp;
    expect(pDmg20).toBeGreaterThan(pDmg1); // Rage DEF down applies to enemy target
    expect(pDmg55).toBeGreaterThan(pDmg20); // Frenzy damageUp applies to player attacker

    const eR1 = resolveUnitAction(units, enemy.id, 'attack', player.id, 1, defCfg, () => 0.99);
    const eR55 = resolveUnitAction(units, enemy.id, 'attack', player.id, 55, defCfg, () => 0.99);
    const eDmg1 = 5000 - eR1.updatedUnits.find((u) => u.id === player.id)!.hp;
    const eDmg55 = 5000 - eR55.updatedUnits.find((u) => u.id === player.id)!.hp;
    expect(eDmg55).toBeGreaterThan(eDmg1);

    // One system log per phase, no per-tier spam
    const r20Logs = buildEnrageActivationLogs(20, defCfg, []);
    expect(r20Logs).toHaveLength(1);
    expect(formatCombatLogMessage('vi', r20Logs[0])).toBe('Vòng 20: Cuồng nộ kích hoạt');
    expect(formatCombatLogMessage('en', r20Logs[0])).toBe('Round 20: Rage activated');
    expect(buildEnrageActivationLogs(25, defCfg, r20Logs)).toHaveLength(0);
  });

  it('3) Berserker crit rate breaks 75% cap up to 100% max and adds critDamageUpPct', () => {
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    const battle = createInitialBattleState(pilot, 'border_outpost');
    const enemy = battle.units.find((u) => u.side === 'enemy' && u.row === 'front')!;
    const player = battle.units.find((u) => u.isPlayer)!;
    const defCfg = createDefaultAdminConfig();

    const units = battle.units.map((u) =>
      u.id === player.id
        ? {
            ...u,
            derived: {
              ...u.derived,
              attackPower: 200,
              critChance: 90, // capped to 75 for normal sources
            },
          }
        : u.id === enemy.id
        ? {
            ...u,
            hp: 50000,
            shield: 0,
            derived: { ...u.derived, maxHp: 50000, dodgeChance: 0, defenseRating: 0 },
          }
        : u
    );

    // Round 50 (no Berserker): normal 90% crit is capped at 75% -> rng=0.80 (80) does NOT crit
    const noBerserkHit = resolveUnitAction(
      units,
      player.id,
      'attack',
      enemy.id,
      50,
      defCfg,
      () => 0.8
    );
    expect(noBerserkHit.logEntries.some((l) => l.params.isCrit === 1)).toBe(false);

    // Round 140 (Berserker 5 stacks = +15% crit rate -> min(75,90)+15 = 90%, +50% crit dmg):
    // rng=0.80 (80 < 90) CRITS!
    const berserkCrit = resolveUnitAction(
      units,
      player.id,
      'attack',
      enemy.id,
      140,
      defCfg,
      () => 0.8
    );
    expect(berserkCrit.logEntries.some((l) => l.params.isCrit === 1)).toBe(true);

    // Even with 10 stacks (+30% crit rate -> 75+30=105 -> clamped 100%), rng=0.999 CRITS;
    // and at +21% crit rate (96% total), rng=0.97 does NOT crit (never forced past real total)
    const berserk95NoCrit = resolveUnitAction(
      units,
      player.id,
      'attack',
      enemy.id,
      160, // 7 stacks = +21% -> total 96%
      defCfg,
      () => 0.97
    );
    expect(berserk95NoCrit.logEntries.some((l) => l.params.isCrit === 1)).toBe(false);

    // Crit damage added: at round 140 (+50% crit dmg) dmg > round 100 (+10% crit dmg)
    const berserk100Crit = resolveUnitAction(
      units,
      player.id,
      'attack',
      enemy.id,
      100,
      defCfg,
      () => 0.1
    );
    const berserk140Crit = resolveUnitAction(
      units,
      player.id,
      'attack',
      enemy.id,
      140,
      defCfg,
      () => 0.1
    );
    const dmg100 = 50000 - berserk100Crit.updatedUnits.find((u) => u.id === enemy.id)!.hp;
    const dmg140 = 50000 - berserk140Crit.updatedUnits.find((u) => u.id === enemy.id)!.hp;
    expect(dmg140).toBeGreaterThan(dmg100);
  });

  it('4) sanitize ignores old enrageStartRound/enrageStepPct, restores defaults, clamps bounds, and updates cheat check', () => {
    const legacySave = {
      version: CURRENT_SAVE_VERSION,
      adminConfig: {
        ...createDefaultAdminConfig(),
        enrageStartRound: 99,
        enrageStepPct: 0.5,
        enrage: undefined,
      },
    };
    const migrated = migrateSaveData(legacySave, CURRENT_SAVE_VERSION);
    expect(migrated.adminConfig.enrage).toEqual(DEFAULT_ENRAGE_CONFIG);
    expect(isAnyCheatActive(migrated.adminConfig)).toBe(false);

    const clamped = sanitizeEnrageConfig({
      rage: { startRound: 0, everyRounds: -5, maxStacks: 5000, value: -10 },
      frenzy: { startRound: 2, everyRounds: 0, maxStacks: 0, value: 9999 },
      berserker: {
        startRound: -3,
        everyRounds: 1,
        maxStacks: 1001,
        critRatePct: -1,
        critDamagePct: 2500,
      },
    });
    expect(clamped.rage).toEqual({
      startRound: 1,
      everyRounds: 1,
      maxStacks: 1000,
      value: 0,
    });
    expect(clamped.frenzy).toEqual({
      startRound: 2,
      everyRounds: 1,
      maxStacks: 1,
      value: 1000,
    });
    expect(clamped.berserker).toEqual({
      startRound: 1,
      everyRounds: 1,
      maxStacks: 1000,
      critRatePct: 0,
      critDamagePct: 1000,
    });
    expect(
      isAnyCheatActive({ ...migrated.adminConfig, enrage: clamped })
    ).toBe(true);
  });

  it('5) Admin summary line at round 100 matches defaults and BattleStatsModal renders one line per active phase', () => {
    useGameStore.getState().setLanguage('vi');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const defCfg = createDefaultAdminConfig();
    const updateSpy = vi.fn();

    act(() => {
      root!.render(
        createElement(EnrageAdminBlock, {
          adminConfig: defCfg,
          adminUpdateConfig: updateSpy,
        })
      );
    });

    const summary = container.querySelector(
      '[data-testid="admin-enrage-summary"]'
    );
    expect(summary?.textContent).toBe(
      'Vòng 100: Cuồng nộ 10 tầng (thủ -50%) · Frenzy 11 tầng (+110% sát thương) · Berserker 1 tầng (+3% crit, +10% sát thương crit)'
    );

    // Every phase card renders live examples
    expect(
      container.querySelector('[data-testid="admin-enrage-card-rage"]')?.textContent
    ).toContain('Kích hoạt tầng 1 tại vòng 20');

    // BattleStatsModal shows 3 active phase lines at round 100
    const pilot = createDefaultPilotAccount('Ace', 'striker');
    const battle = createInitialBattleState(pilot, 'border_outpost');
    act(() => {
      root!.render(
        createElement(BattleStatsModal, {
          open: true,
          onClose: () => {},
          battle: { ...battle, round: 100 },
          enrageState: getEnrageState(100, defCfg),
        })
      );
    });
    const lines = container.querySelector('[data-testid="stats-enrage-lines"]');
    expect(lines?.children).toHaveLength(3);
    expect(lines?.textContent).toContain('Cuồng nộ: 10 tầng (thủ -50%)');
    expect(lines?.textContent).toContain('Frenzy: 11 tầng (+110% sát thương)');
    expect(lines?.textContent).toContain(
      'Berserker: 1 tầng (+3% crit, +10% sát thương crit)'
    );
  });
});
