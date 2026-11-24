// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminPanel } from '../../components/AdminPanel';
import { StatusChip } from '../../components/StatusChip';
import { COMBAT_FORMULAS } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { formatCombatLogMessage, formatStatusEffectDetail } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { AdminConfig, CombatUnit } from '../../types/game';
import {
  chooseAiDecision,
  createInitialBattleState,
  reconcileRemainingTurnOrder,
  resolveUnitAction,
  sortTurnOrder,
} from '../combat';
import { calculateDerivedStats } from '../stats';
import {
  createDefaultAdminConfig,
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import {
  computeShieldRegen,
  computeShieldRegenPct,
  DEFAULT_SHIELD_REGEN_CONFIG,
  sanitizeShieldRegenConfig,
} from '../shieldRegen';

function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextTurnSlot(
  turnOrder: string[],
  units: CombatUnit[],
  currentIdx: number
): { nextIndex: number; wrappedRound: boolean } {
  for (let i = currentIdx + 1; i < turnOrder.length; i += 1) {
    if (units.some((u) => u.id === turnOrder[i] && u.alive)) {
      return { nextIndex: i, wrappedRound: false };
    }
  }
  const firstAlive = turnOrder.findIndex((id) =>
    units.some((u) => u.id === id && u.alive)
  );
  return { nextIndex: Math.max(0, firstAlive), wrappedRound: true };
}

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  const stats = {
    ...EMPTY_STAT_BLOCK,
    attack: 25,
    defense: 20,
    shield: 25,
    fuel: 18,
    evasion: 10,
    spirit: 15,
    ...(overrides.stats ?? {}),
  };
  const baseDerived = calculateDerivedStats('striker', 10, stats);
  return {
    id: 'u1',
    name: 'Vance',
    callsign: 'Strike-01',
    side: 'ally',
    row: 'front',
    isPlayer: true,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats,
    derived: {
      ...baseDerived,
      maxHp: 600,
      maxShield: 200,
      maxSp: 100,
      speed: 35,
      dodgeChance: 5,
      critChance: 10,
      attackPower: 30,
      skillPower: 30,
      spRegenPerTurn: 10,
      ...(overrides.derived ?? {}),
    },
    hp: 600,
    shield: 100,
    sp: 50,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

describe('SH1 — Shield regeneration engine & UI integration', () => {
  it('1) computeShieldRegen covers not_hit, hit, shield_break (restarting), maxShield 0, capPct, and <= maxShield clamp', () => {
    const cfg = DEFAULT_SHIELD_REGEN_CONFIG;
    // shield = 25 -> regenPct = 3 + 25 * 0.08 = 5%, maxShield = 200 -> base = 10
    const baseUnit = makeUnit({ shield: 100 });
    expect(computeShieldRegenPct(25, cfg)).toBe(5);

    expect(computeShieldRegen(baseUnit, cfg)).toEqual({
      amount: 10,
      multPct: 100,
      hits: 0,
      reason: 'not_hit',
    });

    expect(
      computeShieldRegen({ ...baseUnit, hitsSinceOwnTurn: 1 }, cfg)
    ).toEqual({
      amount: 8, // Math.round(10 * 0.80) = 8
      multPct: 80,
      hits: 1,
      reason: 'hit',
    });

    expect(
      computeShieldRegen(
        {
          ...baseUnit,
          hitsSinceOwnTurn: 1,
          statuses: [
            { type: 'shield_cracked', turnsRemaining: 3, isDebuff: true },
            { type: 'shield_break', turnsRemaining: 1, isDebuff: true },
          ],
        },
        cfg
      )
    ).toEqual({
      amount: 0,
      multPct: 0,
      hits: 1,
      reason: 'restarting',
    });

    const zeroShieldUnit = makeUnit({
      shield: 0,
      derived: { ...makeUnit().derived, maxShield: 0 },
    });
    expect(computeShieldRegen(zeroShieldUnit, cfg)).toEqual({
      amount: 0,
      multPct: 0,
      hits: 0,
      reason: 'none',
    });

    // Huge SHIELD stat caps at capPct (12% -> 24 on 200 maxShield)
    const highStatUnit = makeUnit({
      stats: { ...makeUnit().stats, shield: 500 },
      shield: 0,
    });
    expect(computeShieldRegenPct(500, cfg)).toBe(12);
    expect(computeShieldRegen(highStatUnit, cfg)).toEqual({
      amount: 24,
      multPct: 100,
      hits: 0,
      reason: 'not_hit',
    });

    // Never exceeds maxShield
    const nearlyFull = makeUnit({ shield: 196 });
    expect(computeShieldRegen(nearlyFull, cfg)).toEqual({
      amount: 4,
      multPct: 100,
      hits: 0,
      reason: 'not_hit',
    });

    // Disabled returns none
    expect(
      computeShieldRegen(baseUnit, { ...cfg, enabled: false })
    ).toEqual({
      amount: 0,
      multPct: 0,
      hits: 0,
      reason: 'none',
    });
  });

  it('2) hitsSinceOwnTurn increments on hit, NOT by evade or burn DoT, and resets on own turn start', () => {
    const adminCfg = createDefaultAdminConfig();
    const attacker = makeUnit({
      id: 'e1',
      name: 'Raider',
      side: 'enemy',
      isPlayer: false,
      derived: { ...makeUnit().derived, dodgeChance: 0 },
    });

    // 2a) Evade does NOT increment hitsSinceOwnTurn
    const agileDefender = makeUnit({
      id: 'p1',
      name: 'Phantom',
      shield: 150,
      derived: { ...makeUnit().derived, dodgeChance: 100, maxShield: 200 },
    });
    const evadeRes = resolveUnitAction(
      [attacker, agileDefender],
      'e1',
      'attack',
      'p1',
      1,
      adminCfg,
      () => 0.01 // hits <= dodgeChance (100) -> evaded!
    );
    const afterEvade = evadeRes.updatedUnits.find((u) => u.id === 'p1')!;
    expect(afterEvade.hitsSinceOwnTurn).toBeUndefined();

    // 2b) Actual hit sets hitsSinceOwnTurn = 1
    const tankDefender = makeUnit({
      id: 'p2',
      name: 'Bastion',
      shield: 150,
      derived: { ...makeUnit().derived, dodgeChance: 0, maxShield: 200 },
    });
    const hitRes = resolveUnitAction(
      [attacker, tankDefender],
      'e1',
      'attack',
      'p2',
      1,
      adminCfg,
      () => 0.99
    );
    const afterHit = hitRes.updatedUnits.find((u) => u.id === 'p2')!;
    expect(afterHit.hitsSinceOwnTurn).toBe(1);

    // 2c) Own turn applies hit regen (8) AND resets hitsSinceOwnTurn = 0, and logs SHIELD line
    const ownTurnRes = resolveUnitAction(
      hitRes.updatedUnits,
      'p2',
      'defend',
      null,
      1,
      adminCfg,
      () => 0.5
    );
    const afterOwnTurn = ownTurnRes.updatedUnits.find((u) => u.id === 'p2')!;
    expect(afterOwnTurn.hitsSinceOwnTurn).toBe(0);
    const shieldLog = ownTurnRes.logEntries.find((l) => l.tag === 'SHIELD');
    expect(shieldLog).toBeDefined();
    expect(shieldLog?.templateKey).toBe('log.shieldRegen');
    const viMsg = formatCombatLogMessage('vi', shieldLog!);
    expect(viMsg).toContain('Bastion hồi khiên SHD +8');
    expect(viMsg).toContain(' (trúng 1 lần, 80%)');

    // 2d) Burn DoT at start of own turn does NOT increment hitsSinceOwnTurn
    const burningUnit = makeUnit({
      id: 'p3',
      name: 'Torch',
      shield: 100,
      hitsSinceOwnTurn: 0,
      statuses: [{ type: 'burn', turnsRemaining: 2, isDebuff: true }],
    });
    const burnTurnRes = resolveUnitAction(
      [burningUnit, attacker],
      'p3',
      'defend',
      null,
      2,
      adminCfg,
      () => 0.5
    );
    const afterBurnTurn = burnTurnRes.updatedUnits.find((u) => u.id === 'p3')!;
    expect(afterBurnTurn.hitsSinceOwnTurn).toBe(0);
    expect(
      burnTurnRes.logEntries.some(
        (l) =>
          l.templateKey === 'log.shieldRegen' &&
          l.params.reason === 'not_hit'
      )
    ).toBe(true);
  });

  it('3) Shield drop from > 0 to 0 adds shield_break for restartTurns own turns, blocks regen while active, and regens normally after expiring', () => {
    const adminCfg = createDefaultAdminConfig();
    const strongAttacker = makeUnit({
      id: 'e1',
      name: 'Cracker',
      side: 'enemy',
      isPlayer: false,
      derived: { ...makeUnit().derived, attackPower: 120, dodgeChance: 0 },
    });
    const defender = makeUnit({
      id: 'p1',
      name: 'Aegis',
      hp: 1000,
      shield: 40,
      derived: {
        ...makeUnit().derived,
        maxHp: 1000,
        maxShield: 200,
        dodgeChance: 0,
      },
    });

    // Hit breaks shield from 40 -> 0 -> shield_break (1 turn)
    const breakRes = resolveUnitAction(
      [strongAttacker, defender],
      'e1',
      'attack',
      'p1',
      1,
      adminCfg,
      () => 0.99
    );
    let p1 = breakRes.updatedUnits.find((u) => u.id === 'p1')!;
    expect(p1.shield).toBe(0);
    expect(p1.statuses.find((s) => s.type === 'shield_break')?.turnsRemaining).toBe(1);
    expect(p1.statuses.some((s) => s.type === 'shield_cracked')).toBe(false);

    // Own turn 1: regens 0 (no log), status expires
    const t1 = resolveUnitAction(breakRes.updatedUnits, 'p1', 'attack', 'e1', 1, adminCfg, () => 0.99);
    expect(t1.logEntries.some((l) => l.templateKey === 'log.shieldRegen')).toBe(false);
    p1 = t1.updatedUnits.find((u) => u.id === 'p1')!;
    expect(p1.shield).toBe(0);
    expect(p1.statuses.some((s) => s.type === 'shield_break')).toBe(false);

    // Turn after (no hits): regens 100% (10)
    const t2 = resolveUnitAction(t1.updatedUnits, 'p1', 'attack', 'e1', 2, adminCfg, () => 0.99);
    p1 = t2.updatedUnits.find((u) => u.id === 'p1')!;
    expect(p1.shield).toBe(10);
  });

  it('4) shieldRegen.enabled = false produces deterministic fixed-seed battle with zero regen/cracked/defend changes', () => {
    const freshA = createFreshCampaignState('Vance', 'striker', createSeededRng(42));
    const freshB = createFreshCampaignState('Vance', 'striker', createSeededRng(42));
    const disabledAdmin: AdminConfig = {
      ...createDefaultAdminConfig(),
      shieldRegen: { ...DEFAULT_SHIELD_REGEN_CONFIG, enabled: false },
    };

    const runFixed = (seed: number, pilot = freshA.pilot) => {
      const rng = createSeededRng(seed);
      let battle = createInitialBattleState(pilot, 'border_outpost', rng, 4, disabledAdmin);
      for (let step = 0; step < 24; step += 1) {
        const actorId = battle.turnOrder[battle.activeTurnIndex];
        const actor = battle.units.find((u) => u.id === actorId);
        if (!actor || !actor.alive) break;
        const dec = chooseAiDecision(actor, battle.units, rng);
        const res = resolveUnitAction(
          battle.units,
          actor.id,
          dec.action,
          dec.targetId,
          battle.round,
          disabledAdmin,
          rng,
          dec.skillId
        );
        battle = {
          ...battle,
          units: res.updatedUnits,
          log: [...battle.log, ...res.logEntries],
        };
        const aliveE = battle.units.some((u) => u.side === 'enemy' && u.alive);
        const aliveA = battle.units.some((u) => u.side === 'ally' && u.alive);
        if (!aliveE || !aliveA) break;
        const order = reconcileRemainingTurnOrder(
          battle.turnOrder,
          battle.activeTurnIndex,
          battle.units
        );
        const { nextIndex, wrappedRound } = nextTurnSlot(
          order,
          battle.units,
          battle.activeTurnIndex
        );
        battle = {
          ...battle,
          turnOrder: wrappedRound ? sortTurnOrder(battle.units) : order,
          activeTurnIndex: wrappedRound ? 0 : nextIndex,
          round: wrappedRound ? battle.round + 1 : battle.round,
        };
      }
      return battle;
    };

    const b1 = runFixed(777, freshA.pilot);
    const b2 = runFixed(777, freshB.pilot);

    expect(
      b1.units.map((u) => ({
        id: u.id,
        hp: u.hp,
        shield: u.shield,
        sp: u.sp,
        alive: u.alive,
        statuses: u.statuses,
        hitsSinceOwnTurn: u.hitsSinceOwnTurn,
      }))
    ).toEqual(
      b2.units.map((u) => ({
        id: u.id,
        hp: u.hp,
        shield: u.shield,
        sp: u.sp,
        alive: u.alive,
        statuses: u.statuses,
        hitsSinceOwnTurn: u.hitsSinceOwnTurn,
      }))
    );
    expect(b1.log.some((l) => l.templateKey === 'log.shieldRegen')).toBe(false);
    expect(
      b1.units.some(
        (u) =>
          u.hitsSinceOwnTurn !== undefined ||
          u.statuses.some((s) => s.type === 'shield_cracked')
      )
    ).toBe(false);

    // Also verify defend restore uses unchanged COMBAT_FORMULAS.defendShieldRestoreRatio (+16% = +32)
    const unit = makeUnit({ shield: 100 });
    const foe = makeUnit({ id: 'e1', side: 'enemy', isPlayer: false });
    const expectedRestore = Math.round(
      unit.derived.maxShield * COMBAT_FORMULAS.defendShieldRestoreRatio
    );
    const defendDisabled = resolveUnitAction([unit, foe], 'u1', 'defend', null, 1, disabledAdmin, () => 0.5);
    expect(defendDisabled.updatedUnits[0].shield).toBe(100 + expectedRestore);
    const defendEnabled = resolveUnitAction([unit, foe], 'u1', 'defend', null, 1, createDefaultAdminConfig(), () => 0.5);
    expect(defendEnabled.updatedUnits[0].shield).toBe(100 + 10 + expectedRestore);
  });

  it('5) Popup threshold skips tiny < 1% maxShield popups and emits SHD +N when >= 1%', () => {
    const adminCfg = createDefaultAdminConfig();
    const attacker = makeUnit({ id: 'e1', side: 'enemy', isPlayer: false });

    // maxShield = 2000, shield = 1995 -> regen capped at room = 5 (< 1% of 2000 = 20) -> no SHD +5 popup
    const giantNearlyFull = makeUnit({
      id: 'p1',
      shield: 1995,
      derived: { ...makeUnit().derived, maxShield: 2000 },
    });
    const smallRes = resolveUnitAction([giantNearlyFull, attacker], 'p1', 'attack', 'e1', 1, adminCfg, () => 0.99);
    expect(smallRes.popups.some((p) => p.text.startsWith('SHD +'))).toBe(false);
    expect(smallRes.logEntries.some((l) => l.templateKey === 'log.shieldRegen')).toBe(true);

    // maxShield = 200, shield = 100 -> regen = 10 (>= 1% of 200 = 2) -> emits SHD +10 shield popup
    const normalUnit = makeUnit({ id: 'p2', shield: 100 });
    const bigRes = resolveUnitAction([normalUnit, attacker], 'p2', 'attack', 'e1', 1, adminCfg, () => 0.99);
    expect(
      bigRes.popups.some((p) => p.text === 'SHD +10' && p.tone === 'shield')
    ).toBe(true);
  });

  it('6) Admin sanitizer clamps pct/penalty/min/restartTurns, drops old v1 keys, and migration fills defaults at CURRENT_SAVE_VERSION = 11', () => {
    expect(CURRENT_SAVE_VERSION).toBe(11);
    const clamped = sanitizeShieldRegenConfig({
      enabled: false,
      basePct: -5,
      perPointPct: 99,
      capPct: 80,
      notHitMult: -10,
      hitPenaltyPct: 250,
      minHitMultPct: -20,
      restartTurns: 0,
      hitMult: 75,
      brokenMult: 30,
      brokenTurns: 3,
    } as Record<string, unknown>);
    expect(clamped).toEqual({
      enabled: false,
      basePct: 0,
      perPointPct: 50,
      capPct: 50,
      notHitMult: 0,
      hitPenaltyPct: 100,
      minHitMultPct: 0,
      restartTurns: 1,
    });

    expect(sanitizeShieldRegenConfig({ restartTurns: 42 }).restartTurns).toBe(3);

    const fresh = createFreshCampaignState('Vance', 'striker', createSeededRng(9));
    const oldAdmin = { ...fresh.adminConfig } as Partial<AdminConfig>;
    delete oldAdmin.shieldRegen;
    const migrated = migrateSaveData(
      { ...fresh, adminConfig: oldAdmin },
      CURRENT_SAVE_VERSION
    );
    expect(migrated.adminConfig.shieldRegen).toEqual(DEFAULT_SHIELD_REGEN_CONFIG);
  });

  it('7) vi/en dictionaries keep identical keys, StatusChip & AdminPanel render shield_cracked & Hồi khiên correctly', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);

    // Detail tooltip
    const detail = formatStatusEffectDetail('vi', {
      type: 'shield_cracked',
      turnsRemaining: 3,
      magnitude: 1.3,
      isDebuff: true,
    });
    expect(detail.label).toBe('Khiên nứt');
    expect(detail.fullText).toContain('x1.3 ST lên khiên');

    const detailEn = formatStatusEffectDetail('en', {
      type: 'shield_cracked',
      turnsRemaining: 3,
      magnitude: 1.3,
      isDebuff: true,
    });
    expect(detailEn.label).toBe('Cracked shield');
    expect(detailEn.fullText).toContain('x1.3 shield dmg');

    // Render StatusChip for shield_cracked + AdminPanel Hồi khiên
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        createElement(StatusChip, {
          status: {
            type: 'shield_cracked',
            turnsRemaining: 3,
            magnitude: 1.3,
            isDebuff: true,
          },
          lang: 'vi',
          testId: 'chip-shield-cracked',
        })
      );
    });

    const chip = container.querySelector('[data-testid="chip-shield-cracked"]');
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute('data-status-kind')).toBe('debuff');
    expect(chip?.getAttribute('title')).toContain('Khiên nứt');
    expect(chip?.getAttribute('title')).toContain(
      'Khiên nứt: nhận x1,3 sát thương skill lên khiên (đánh thường không đổi), hết khi khiên về 0'
    );
    expect(chip?.textContent).toContain('x1.3');
    expect(chip?.querySelector('.material-symbols-outlined')?.textContent).toBe(
      'shield_question'
    );

    // Render AdminPanel battle tab & check Hồi khiên + live example line
    useGameStore.setState({
      language: 'vi',
      adminPanelOpen: true,
      adminConfig: createDefaultAdminConfig(),
    });
    act(() => {
      root!.render(createElement(AdminPanel));
    });
    const battleTabBtn = container.querySelector('[data-testid="admin-tab-battle"]') as HTMLElement | null;
    expect(battleTabBtn).not.toBeNull();
    act(() => {
      battleTabBtn!.click();
    });
    const srSection = container.querySelector(
      '[data-testid="admin-shield-regen-section"]'
    );
    expect(srSection).not.toBeNull();
    expect(srSection?.textContent).toContain('Hồi khiên');
    expect(
      container.querySelector('[data-testid="admin-shield-regen-example"]')?.textContent
    ).toBe('SHIELD 25 -> 5% khiên tối đa mỗi lượt · Trúng 2 lần -> hồi 3%');
  });

  it('8) Seeded 4v4 full battle finishes cleanly without any NaN values', () => {
    const rng = createSeededRng(2026);
    const adminCfg = createDefaultAdminConfig();
    const fresh = createFreshCampaignState('Vance', 'striker', rng);
    let battle = createInitialBattleState(fresh.pilot, 'border_outpost', rng, 4, adminCfg);

    let steps = 0;
    while (steps < 200) {
      steps += 1;
      const aliveE = battle.units.some((u) => u.side === 'enemy' && u.alive);
      const aliveA = battle.units.some((u) => u.side === 'ally' && u.alive);
      if (!aliveE || !aliveA) break;

      const actorId = battle.turnOrder[battle.activeTurnIndex];
      const actor = battle.units.find((u) => u.id === actorId);
      if (actor && actor.alive) {
        const dec = chooseAiDecision(actor, battle.units, rng);
        const res = resolveUnitAction(
          battle.units,
          actor.id,
          dec.action,
          dec.targetId,
          battle.round,
          adminCfg,
          rng,
          dec.skillId
        );
        battle = {
          ...battle,
          units: res.updatedUnits,
          log: [...battle.log, ...res.logEntries],
        };
      }

      for (const u of battle.units) {
        expect(Number.isNaN(u.hp)).toBe(false);
        expect(Number.isNaN(u.shield)).toBe(false);
        expect(Number.isNaN(u.sp)).toBe(false);
        expect(u.shield).toBeLessThanOrEqual(u.derived.maxShield);
        expect(u.shield).toBeGreaterThanOrEqual(0);
      }

      const order = reconcileRemainingTurnOrder(
        battle.turnOrder,
        battle.activeTurnIndex,
        battle.units
      );
      const { nextIndex, wrappedRound } = nextTurnSlot(
        order,
        battle.units,
        battle.activeTurnIndex
      );
      battle = {
        ...battle,
        turnOrder: wrappedRound ? sortTurnOrder(battle.units) : order,
        activeTurnIndex: wrappedRound ? 0 : nextIndex,
        round: wrappedRound ? battle.round + 1 : battle.round,
      };
    }

    const done =
      !battle.units.some((u) => u.side === 'enemy' && u.alive) ||
      !battle.units.some((u) => u.side === 'ally' && u.alive);
    expect(done).toBe(true);
    expect(steps).toBeLessThan(200);
  });

  it('9) SH2a: regen mult scales for 0/1/2/3/5 hits (100/80/60/40/0), respects minHitMultPct floor, and reads legacy hitSinceOwnTurn=true as 1', () => {
    const unit = makeUnit({ shield: 0 });
    const cfg = DEFAULT_SHIELD_REGEN_CONFIG;

    expect([0, 1, 2, 3, 5].map((hits) => computeShieldRegen({ ...unit, hitsSinceOwnTurn: hits }, cfg))).toEqual([
      { amount: 10, multPct: 100, hits: 0, reason: 'not_hit' },
      { amount: 8, multPct: 80, hits: 1, reason: 'hit' },
      { amount: 6, multPct: 60, hits: 2, reason: 'hit' },
      { amount: 4, multPct: 40, hits: 3, reason: 'hit' },
      { amount: 0, multPct: 0, hits: 5, reason: 'hit' },
    ]);

    expect(
      computeShieldRegen(
        { ...unit, hitsSinceOwnTurn: 6 },
        { ...cfg, minHitMultPct: 25 }
      )
    ).toEqual({ amount: 3, multPct: 25, hits: 6, reason: 'hit' });

    const legacyUnit = { ...unit, hitSinceOwnTurn: true } as unknown as CombatUnit;
    expect(computeShieldRegen(legacyUnit, cfg)).toEqual({
      amount: 8,
      multPct: 80,
      hits: 1,
      reason: 'hit',
    });
  });

  it('10) SH2a: while shield_break ("Khiên vỡ") is active, defend & skill shield restore give 0 shield and detail formats Restarting', () => {
    const adminCfg = createDefaultAdminConfig();
    const brokenUnit = makeUnit({
      id: 'p1',
      name: 'Aegis',
      classId: 'support',
      shield: 0,
      sp: 50,
      equippedSkillIds: ['sup_aegis_field'],
      skillLevels: { sup_aegis_field: 1 },
      statuses: [{ type: 'shield_break', turnsRemaining: 2, isDebuff: true }],
    });
    const enemy = makeUnit({ id: 'e1', side: 'enemy', isPlayer: false });

    const defendRes = resolveUnitAction([brokenUnit, enemy], 'p1', 'defend', null, 1, adminCfg, () => 0.5);
    expect(defendRes.updatedUnits.find((u) => u.id === 'p1')!.shield).toBe(0);

    const skillRes = resolveUnitAction([brokenUnit, enemy], 'p1', 'skill', 'p1', 1, adminCfg, () => 0.5, 'sup_aegis_field');
    expect(skillRes.updatedUnits.find((u) => u.id === 'p1')!.shield).toBe(0);

    const detailVi = formatStatusEffectDetail('vi', { type: 'shield_break', turnsRemaining: 2, isDebuff: true });
    expect(detailVi.label).toBe('Khiên vỡ');
    expect(detailVi.valueText).toBe('Khởi động lại 2 lượt');
  });

  it('11) SH2a: shield_break no longer bypasses an active shield > 0; damage at shield 0 goes to HP', () => {
    const adminCfg = createDefaultAdminConfig();
    const attacker = makeUnit({
      id: 'e1',
      side: 'enemy',
      isPlayer: false,
      derived: { ...makeUnit().derived, attackPower: 40, dodgeChance: 0 },
    });
    const shieldedBroken = makeUnit({
      id: 'p1',
      hp: 600,
      shield: 150,
      derived: { ...makeUnit().derived, maxHp: 600, maxShield: 200, dodgeChance: 0 },
      statuses: [{ type: 'shield_break', turnsRemaining: 1, isDebuff: true }],
    });

    const hitWithShield = resolveUnitAction([attacker, shieldedBroken], 'e1', 'attack', 'p1', 1, adminCfg, () => 0.99);
    const p1After = hitWithShield.updatedUnits.find((u) => u.id === 'p1')!;
    expect(p1After.shield).toBeLessThan(150);
    expect(p1After.hp).toBe(600);

    const noShield = makeUnit({ ...shieldedBroken, id: 'p2', shield: 0 });
    const hitWithoutShield = resolveUnitAction([attacker, noShield], 'e1', 'attack', 'p2', 1, adminCfg, () => 0.99);
    expect(hitWithoutShield.updatedUnits.find((u) => u.id === 'p2')!.hp).toBeLessThan(600);
  });

  it('12) SH2a: splash damage increments hitsSinceOwnTurn and triggers Khiên vỡ (shield_break) when splash drops shield > 0 to 0', () => {
    const adminCfg = createDefaultAdminConfig();
    const attacker = makeUnit({
      id: 'p1',
      name: 'Bomber',
      side: 'ally',
      derived: { ...makeUnit().derived, attackPower: 150, splashPct: 40, dodgeChance: 0 },
    });
    const enemyFront1 = makeUnit({
      id: 'e1',
      name: 'Target',
      side: 'enemy',
      row: 'front',
      formationCol: 0,
      isPlayer: false,
      shield: 200,
      derived: { ...makeUnit().derived, maxShield: 200, dodgeChance: 0 },
    });
    const enemyFront2 = makeUnit({
      id: 'e2',
      name: 'Wingman',
      side: 'enemy',
      row: 'front',
      formationCol: 1,
      isPlayer: false,
      hp: 500,
      shield: 15,
      derived: { ...makeUnit().derived, maxHp: 500, maxShield: 200, dodgeChance: 0 },
    });

    const splashRes = resolveUnitAction(
      [attacker, enemyFront1, enemyFront2],
      'p1',
      'attack',
      'e1',
      1,
      adminCfg,
      () => 0.99
    );
    const wingmanAfter = splashRes.updatedUnits.find((u) => u.id === 'e2')!;
    expect(wingmanAfter.shield).toBe(0);
    expect(wingmanAfter.hitsSinceOwnTurn).toBe(1);
    expect(wingmanAfter.statuses.find((s) => s.type === 'shield_break')?.turnsRemaining).toBe(1);
    expect(
      splashRes.events.some(
        (e) => e.type === 'status_applied' && e.targetId === 'e2' && e.statusId === 'shield_break'
      )
    ).toBe(true);
  });
});
