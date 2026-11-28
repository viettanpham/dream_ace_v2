// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BUFF_CARDS_CONFIG,
  getBuffCardRatePct,
  sanitizeBuffCardsConfig,
} from '../../data/buffCards';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { useGameStore } from '../../store/useGameStore';
import {
  decrementActiveBuffsAfterBattle,
  grantBuffCardToPilot,
  useBuffCard,
} from '../buffCards';
import { createInitialBattleState } from '../combat';
import { sumGearEquipmentStats, sumGearSpecialTraits } from '../equipment';
import { createDefaultAdminConfig, migrateSaveData } from '../migration';
import { applyPilotBuffsToPassives, getGearPassiveBonuses } from '../skills';
import {
  grantStarterEventPack,
  sanitizeStarterEventConfig,
  summarizeStarterEvent,
} from '../starterEvent';
import {
  calculateDerivedStats,
  calculateEffectiveStats,
  createDefaultPilotAccount,
} from '../stats';

describe('BUFFCARD-1 — Buff cards engine, stats/combat parity, migration, shop rates, and starter pack', () => {
  it('1) useBuffCard: new buff, same-tier stack, max_stack refusal without consuming, confirm replace, and parallel kinds', () => {
    const admin = createDefaultAdminConfig();
    let pilot = createDefaultPilotAccount('Ace', 'striker');
    pilot = grantBuffCardToPilot(pilot, 'bcard_attack_t3', 3);
    pilot = grantBuffCardToPilot(pilot, 'bcard_attack_t2', 1);
    pilot = grantBuffCardToPilot(pilot, 'bcard_dodge_t2', 1);

    // New buff
    const res1 = useBuffCard(pilot, 'bcard_attack_t3', admin);
    expect(res1.ok).toBe(true);
    expect(res1.pilot.activeBuffs?.attack).toEqual({ tier: 3, battles: 3 });
    expect(res1.pilot.buffCards?.bcard_attack_t3).toBe(2);

    // Same tier stacks
    const res2 = useBuffCard(res1.pilot, 'bcard_attack_t3', admin);
    expect(res2.ok).toBe(true);
    expect(res2.pilot.activeBuffs?.attack).toEqual({ tier: 3, battles: 6 });
    expect(res2.pilot.buffCards?.bcard_attack_t3).toBe(1);

    // Exceeding maxStackBattles refuses without consuming
    const tightAdmin = {
      ...admin,
      buffCards: { ...DEFAULT_BUFF_CARDS_CONFIG, maxStackBattles: 8 },
    };
    const resStackFail = useBuffCard(res2.pilot, 'bcard_attack_t3', tightAdmin);
    expect(resStackFail.ok).toBe(false);
    expect(resStackFail.reason).toBe('max_stack');
    expect(resStackFail.pilot.buffCards?.bcard_attack_t3).toBe(1);
    expect(resStackFail.pilot.activeBuffs?.attack?.battles).toBe(6);

    // Different tier requires confirm first without consuming
    const resNeedConfirm = useBuffCard(res2.pilot, 'bcard_attack_t2', admin);
    expect(resNeedConfirm.ok).toBe(false);
    expect(resNeedConfirm.reason).toBe('confirm_replace');
    expect(resNeedConfirm.pilot.buffCards?.bcard_attack_t2).toBe(1);

    // With confirmReplace: replaces old buff & resets battles to battlesPerCard
    const resReplaced = useBuffCard(res2.pilot, 'bcard_attack_t2', admin, {
      confirmReplace: true,
    });
    expect(resReplaced.ok).toBe(true);
    expect(resReplaced.pilot.activeBuffs?.attack).toEqual({ tier: 2, battles: 3 });
    expect(resReplaced.pilot.buffCards?.bcard_attack_t2).toBeUndefined();

    // Different kinds run in parallel
    const resParallel = useBuffCard(resReplaced.pilot, 'bcard_dodge_t2', admin);
    expect(resParallel.ok).toBe(true);
    expect(resParallel.pilot.activeBuffs?.attack).toEqual({ tier: 2, battles: 3 });
    expect(resParallel.pilot.activeBuffs?.dodge).toEqual({ tier: 2, battles: 3 });
  });

  it('2) decrement after win, defeat, and retreat removes active buffs at 0', () => {
    useGameStore.getState().resetCampaign();
    const store = useGameStore.getState();
    store.adminGiveBuffCard('bcard_attack_t1', 1);
    store.adminGiveBuffCard('bcard_defense_t1', 1);
    useGameStore.setState((s) => ({
      adminConfig: {
        ...s.adminConfig,
        buffCards: { ...DEFAULT_BUFF_CARDS_CONFIG, battlesPerCard: 3 },
      },
    }));
    expect(useGameStore.getState().useBuffCard('bcard_attack_t1').ok).toBe(true);
    expect(useGameStore.getState().useBuffCard('bcard_defense_t1').ok).toBe(true);

    // 1. Win
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().forceWinBattle();
    expect(useGameStore.getState().pilot.activeBuffs?.attack?.battles).toBe(2);
    expect(useGameStore.getState().pilot.activeBuffs?.defense?.battles).toBe(2);

    // 2. Retreat
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().retreatBattle();
    expect(useGameStore.getState().pilot.activeBuffs?.attack?.battles).toBe(1);
    expect(useGameStore.getState().pilot.activeBuffs?.defense?.battles).toBe(1);

    // 3. Defeat (at 1 -> 0 -> removed) via pure decrement check & battle finish
    const dec = decrementActiveBuffsAfterBattle(
      useGameStore.getState().pilot.activeBuffs
    );
    expect(dec.nextActiveBuffs.attack).toBeUndefined();
    expect(dec.nextActiveBuffs.defense).toBeUndefined();
    expect(dec.endedKinds).toEqual(['attack', 'defense']);
  });

  it('3) stats.ts and combat player unit compute identical buffed attack, maxShield, dodgeChance, and maxSp (NPCs untouched)', () => {
    const admin = createDefaultAdminConfig();
    let pilot = createDefaultPilotAccount('Ace', 'striker');
    pilot = grantBuffCardToPilot(pilot, 'bcard_attack_t3', 1); // +60%
    pilot = grantBuffCardToPilot(pilot, 'bcard_max_shield_t3', 1); // +40%
    pilot = grantBuffCardToPilot(pilot, 'bcard_dodge_t2', 1); // +6 points
    pilot = grantBuffCardToPilot(pilot, 'bcard_max_sp_t2', 1); // +10%
    pilot = useBuffCard(pilot, 'bcard_attack_t3', admin).pilot;
    pilot = useBuffCard(pilot, 'bcard_max_shield_t3', admin).pilot;
    pilot = useBuffCard(pilot, 'bcard_dodge_t2', admin).pilot;
    pilot = useBuffCard(pilot, 'bcard_max_sp_t2', admin).pilot;

    const gear = pilot.gears[pilot.activeGearId];
    const eqBonuses = sumGearEquipmentStats(gear, pilot.inventory, admin, pilot.warehouse);
    const eqTraits = sumGearSpecialTraits(gear, pilot.inventory, admin, pilot.warehouse);
    const passives = applyPilotBuffsToPassives(
      getGearPassiveBonuses(gear, admin),
      pilot.activeBuffs,
      admin
    );
    const effStats = calculateEffectiveStats(
      gear.classId,
      gear.level,
      gear.allocatedPoints,
      EMPTY_STAT_BLOCK,
      eqBonuses,
      eqTraits,
      passives
    );
    const derived = calculateDerivedStats(
      gear.classId,
      gear.level,
      effStats,
      eqTraits,
      passives,
      admin
    );

    const battle = createInitialBattleState(pilot, 'border_outpost', () => 0.5, null, admin);
    const playerUnit = battle.units.find((u) => u.isPlayer)!;
    const unbuffedBattle = createInitialBattleState(
      { ...pilot, activeBuffs: {} },
      'border_outpost',
      () => 0.5,
      null,
      admin
    );

    expect(playerUnit.derived.attackPower).toBe(derived.attackPower);
    expect(playerUnit.derived.maxShield).toBe(derived.maxShield);
    expect(playerUnit.derived.dodgeChance).toBe(derived.dodgeChance);
    expect(playerUnit.derived.maxSp).toBe(derived.maxSp);

    // NPC enemy stats unchanged
    const npcBuffed = battle.units.find((u) => u.side === 'enemy')!;
    const npcPlain = unbuffedBattle.units.find((u) => u.side === 'enemy')!;
    expect(npcBuffed.derived).toEqual(npcPlain.derived);
  });

  it('4) EXP buff multiplier scales battle EXP and legacy activeExpBoostBattles migrates to activeBuffs.exp T0', () => {
    const legacySave = {
      version: 14,
      pilot: {
        ...createDefaultPilotAccount('OldAce', 'striker'),
        activeExpBoostBattles: 4,
      },
    };
    const migrated = migrateSaveData(legacySave, 14);
    expect(migrated.pilot.activeBuffs?.exp).toEqual({ tier: 0, battles: 4 });
    expect(migrated.pilot.activeExpBoostBattles).toBeUndefined();

    // Test battle EXP multiplier (T2 = +150% EXP -> 2.5x)
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      useGameStore.getState().resetCampaign();
      useGameStore.getState().adminGiveBuffCard('bcard_exp_t2', 1);
      useGameStore.getState().useBuffCard('bcard_exp_t2');
      useGameStore.getState().startBattle('border_outpost');
      useGameStore.getState().forceWinBattle();
      const boostedExp = useGameStore.getState().battle?.summary?.expGained ?? 0;
      const boostedRemaining = useGameStore.getState().pilot.activeBuffs?.exp?.battles;
      expect(boostedRemaining).toBe(2);

      useGameStore.getState().resetCampaign();
      useGameStore.getState().startBattle('border_outpost');
      useGameStore.getState().forceWinBattle();
      const baseExp = useGameStore.getState().battle?.summary?.expGained ?? 0;

      expect(boostedExp).toBe(Math.round(baseExp * 2.5));
    } finally {
      randSpy.mockRestore();
    }
  });

  it('5) getBuffCardRatePct formula and sanitizeBuffCardsConfig clamps out-of-range inputs', () => {
    expect(
      getBuffCardRatePct(1, { baseRatePct: 3, decayPctPerTier: 0.5, minRatePct: 0.5 })
    ).toBe(2.5);
    expect(
      getBuffCardRatePct(4, { baseRatePct: 3, decayPctPerTier: 0.5, minRatePct: 0.5 })
    ).toBe(1);
    expect(
      getBuffCardRatePct(9, { baseRatePct: 3, decayPctPerTier: 0.5, minRatePct: 0.5 })
    ).toBe(0.5);

    const sanitized = sanitizeBuffCardsConfig({
      battlesPerCard: 99,
      maxStackBattles: 0,
      priceMult: 100,
      tiers: {
        dodge: [99, -5, 20, 30, 60],
        attack: [999, 10, 20, 30, 40],
      } as unknown as typeof DEFAULT_BUFF_CARDS_CONFIG.tiers,
    });
    expect(sanitized.battlesPerCard).toBe(20);
    expect(sanitized.maxStackBattles).toBe(1);
    expect(sanitized.priceMult).toBe(20);
    expect(sanitized.tiers.dodge).toEqual([45, 0, 20, 30, 45]);
    expect(sanitized.tiers.attack[0]).toBe(500);
  });

  it('6) starter event qty=0 hidden from summary and skipped on grant while buff_card & supply rows grant properly', () => {
    const cfg = sanitizeStarterEventConfig({
      enabled: true,
      mode: 'oncePerSave',
      entries: [
        { type: 'card_credit', value: 50000, qty: 0 },
        { type: 'buff_card', refId: 'bcard_attack_t2', value: 2, qty: 0 },
        { type: 'buff_card', refId: 'bcard_attack_t3', value: 3, qty: 2 },
        { type: 'supply', refId: 'sup_hp_t1', value: 1, qty: 3 },
      ],
    });
    expect(cfg.entries).toHaveLength(4);
    expect(cfg.entries[0].qty).toBe(0);

    const summary = summarizeStarterEvent(cfg);
    expect(summary.credit).toBe(0);
    expect(summary.buffCardsCount).toBe(2);
    expect(summary.suppliesCount).toBe(3);

    const basePilot = createDefaultPilotAccount('Newbie', 'striker');
    const res = grantStarterEventPack(basePilot, cfg, 'striker');
    expect(res.granted).toHaveLength(2);
    expect(res.pilot.cards).toEqual({});
    expect(res.pilot.buffCards?.bcard_attack_t2).toBeUndefined();
    expect(res.pilot.buffCards?.bcard_attack_t3).toBe(2);
    const hpSupply = res.pilot.consumables?.find(
      (c) => c.kind === 'battle_supply' && c.templateId === 'sup_hp_t1'
    );
    expect(hpSupply?.quantity).toBe(3);
  });
});
