// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyBaseRepair,
  computeBaseRepairAmount,
  computeBaseRepairCost,
  computeWinsToCapture,
  DEFAULT_BASE_SIEGE_CONFIG,
  getBaseSiege,
} from '../baseSiege';
import {
  advanceCampaignMonth,
  applyBattleBaseConsequences,
  getBaseState,
} from '../mapWorld';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { useGameStore } from '../../store/useGameStore';

beforeEach(() => {
  window.localStorage.clear();
  useGameStore.getState().resetCampaign();
});

describe('BASE-SIEGE-a — Base Shield & Capture HP pools', () => {
  it('1) outpost default needs 5 won assaults (2 shield + 3 HP); 5th flips & restores full pool for new owner', () => {
    expect(computeWinsToCapture('outpost', DEFAULT_BASE_SIEGE_CONFIG)).toBe(5);
    let pilot = createFreshCampaignState('Tester', 'striker').pilot;

    // Wins 1-2 chip Shield: 1000 -> 500 -> 0 (HP untouched at 600)
    const w1 = applyBattleBaseConsequences(pilot, 'border_outpost', true, 'assault');
    expect(w1.capturedFreshly).toBe(false);
    expect(w1.siegeResult).toMatchObject({
      shieldBefore: 1000,
      shieldAfter: 500,
      hpBefore: 600,
      hpAfter: 600,
      captured: false,
    });
    expect(w1.pilot.baseStates.border_outpost.faction).toBe('hostile');

    const w2 = applyBattleBaseConsequences(w1.pilot, 'border_outpost', true, 'assault');
    expect(w2.capturedFreshly).toBe(false);
    expect(w2.siegeResult).toMatchObject({
      shieldBefore: 500,
      shieldAfter: 0,
      hpBefore: 600,
      hpAfter: 600,
      captured: false,
    });

    // Wins 3-4 chip HP: 600 -> 400 -> 200
    const w3 = applyBattleBaseConsequences(w2.pilot, 'border_outpost', true, 'assault');
    expect(w3.capturedFreshly).toBe(false);
    expect(w3.siegeResult).toMatchObject({
      shieldBefore: 0,
      shieldAfter: 0,
      hpBefore: 600,
      hpAfter: 400,
      captured: false,
    });

    const w4 = applyBattleBaseConsequences(w3.pilot, 'border_outpost', true, 'assault');
    expect(w4.capturedFreshly).toBe(false);
    expect(w4.siegeResult).toMatchObject({
      hpBefore: 400,
      hpAfter: 200,
      captured: false,
    });

    // 5th win breaks HP -> flips to allied damaged with FULL pool restored
    const w5 = applyBattleBaseConsequences(w4.pilot, 'border_outpost', true, 'assault');
    expect(w5.capturedFreshly).toBe(true);
    expect(w5.siegeResult?.captured).toBe(true);
    const after = getBaseState(w5.pilot, 'border_outpost');
    expect(after.faction).toBe('allied');
    expect(after.status).toBe('damaged');
    expect(getBaseSiege(after, 'outpost')).toEqual({
      shield: 1000,
      hp: 600,
      maxShield: 1000,
      maxHp: 600,
    });
  });

  it('2) defeat and retreat leave siege pool unchanged and record lastAttackedMonth', () => {
    const pilot = createFreshCampaignState('Tester', 'striker').pilot;
    const w1 = applyBattleBaseConsequences(pilot, 'border_outpost', true, 'assault');
    expect(w1.pilot.baseStates.border_outpost.siegeShield).toBe(500);

    // Defeat leaves pool unchanged
    const defeat = applyBattleBaseConsequences(
      w1.pilot,
      'border_outpost',
      false,
      'assault'
    );
    expect(defeat.capturedFreshly).toBe(false);
    expect(defeat.pilot.baseStates.border_outpost.siegeShield).toBe(500);
    expect(defeat.pilot.baseStates.border_outpost.siegeHp).toBe(600);
    expect(defeat.pilot.baseStates.border_outpost.lastAttackedMonth).toBe(
      w1.pilot.campaignMonth
    );

    // Store retreat leaves pool unchanged and sets lastAttackedMonth
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        campaignMonth: 4,
        baseStates: {
          ...s.pilot.baseStates,
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            siegeShield: 500,
            siegeHp: 400,
          },
        },
      },
    }));
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().retreatBattle();
    const st = useGameStore.getState().pilot.baseStates.border_outpost;
    expect(st.siegeShield).toBe(500);
    expect(st.siegeHp).toBe(400);
    expect(st.lastAttackedMonth).toBe(4);
  });

  it('3) monthly regen triggers only after idleMonths without an attack and clamps at max', () => {
    let pilot = createFreshCampaignState('Tester', 'striker').pilot;
    pilot = {
      ...pilot,
      campaignMonth: 1,
      baseStates: {
        ...pilot.baseStates,
        aegis_relay: {
          ...pilot.baseStates.aegis_relay,
          underAttack: false,
          attackCountdownMonths: 0,
          attackFromSectorId: null,
        },
        border_outpost: {
          ...pilot.baseStates.border_outpost,
          siegeShield: 850,
          siegeHp: 580,
          lastAttackedMonth: 1,
        },
      },
    };

    // Month 2 (diff 1 < 3) & Month 3 (diff 2 < 3): no regen
    pilot = advanceCampaignMonth(pilot).pilot;
    expect(pilot.campaignMonth).toBe(2);
    expect(pilot.baseStates.border_outpost.siegeShield).toBe(850);
    expect(pilot.baseStates.border_outpost.siegeHp).toBe(580);

    pilot = advanceCampaignMonth(pilot).pilot;
    expect(pilot.campaignMonth).toBe(3);
    expect(pilot.baseStates.border_outpost.siegeShield).toBe(850);
    expect(pilot.baseStates.border_outpost.siegeHp).toBe(580);

    // Month 4 (diff 3 >= 3): +10% shield (+100 -> 950), +5% HP (+30 -> capped at 600)
    pilot = advanceCampaignMonth(pilot).pilot;
    expect(pilot.campaignMonth).toBe(4);
    expect(pilot.baseStates.border_outpost.siegeShield).toBe(950);
    expect(pilot.baseStates.border_outpost.siegeHp).toBe(600);

    // Month 5: clamps shield at 1000 max
    pilot = advanceCampaignMonth(pilot).pilot;
    expect(pilot.baseStates.border_outpost.siegeShield).toBe(1000);
    expect(pilot.baseStates.border_outpost.siegeHp).toBe(600);
  });

  it('4) repair actions enforce ally, full, cost, cooldown, and busy checks', () => {
    // Reject non-allied
    const nonAllied = useGameStore.getState().repairBaseHp('border_outpost');
    expect(nonAllied).toEqual({ ok: false, reason: 'not_allied' });

    // Reject full allied base
    const full = useGameStore.getState().repairBaseHp('aegis_relay');
    expect(full).toEqual({ ok: false, reason: 'full' });

    // Damaged allied base, insufficient credits
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        campaignMonth: 2,
        credits: 500,
        baseStates: {
          ...s.pilot.baseStates,
          aegis_relay: {
            ...s.pilot.baseStates.aegis_relay,
            siegeShield: 700,
            siegeHp: 400,
          },
        },
      },
    }));
    const noCred = useGameStore.getState().repairBaseHp('aegis_relay');
    expect(noCred.ok).toBe(false);
    expect(noCred.reason).toBe('no_credits');

    // Give enough credits -> succeeds (cost 1000 + 100*1 = 1100, heals 25% of 600 = 150 HP)
    useGameStore.setState((s) => ({
      pilot: { ...s.pilot, credits: 5000 },
    }));
    const expectedCost = computeBaseRepairCost('hp', 1);
    const expectedAmt = computeBaseRepairAmount('hp', 'relay');
    const hpOk = useGameStore.getState().repairBaseHp('aegis_relay');
    expect(hpOk).toEqual({ ok: true, cost: expectedCost, healed: expectedAmt });
    expect(useGameStore.getState().pilot.baseStates.aegis_relay.siegeHp).toBe(550);

    // Immediate second HP repair -> cooldown
    const cd = useGameStore.getState().repairBaseHp('aegis_relay');
    expect(cd).toEqual({ ok: false, reason: 'cooldown' });

    // Shield repair still independent & succeeds
    const shOk = useGameStore.getState().repairBaseShield('aegis_relay');
    expect(shOk.ok).toBe(true);
    expect(shOk.healed).toBe(250);

    // Pure applyBaseRepair after cooldown succeeds
    const laterPilot = {
      ...useGameStore.getState().pilot,
      campaignMonth: 5,
    };
    const pureRes = applyBaseRepair(laterPilot, 'aegis_relay', { hp: true });
    expect(pureRes.ok).toBe(true);
    expect(pureRes.healed?.hp).toBe(50);

    // Busy while battle active
    useGameStore.getState().startBattle('border_outpost');
    expect(useGameStore.getState().repairBaseHp('aegis_relay')).toEqual({
      ok: false,
      reason: 'busy',
    });
  });

  it('5) undefended raid damages pool & flips base only when broken; allied capital stops at 1 HP', () => {
    // Part A: outpost survives first raid hit, flips when broken
    let pilot = createFreshCampaignState('Tester', 'striker').pilot;
    pilot = {
      ...pilot,
      capturedSectorIds: ['aegis_relay', 'border_outpost'],
      unlockedSectorIds: ['aegis_relay', 'border_outpost', 'debris_belt'],
      baseStates: {
        ...pilot.baseStates,
        aegis_relay: {
          ...pilot.baseStates.aegis_relay,
          underAttack: false,
          attackCountdownMonths: 0,
          attackFromSectorId: null,
        },
        border_outpost: {
          faction: 'allied',
          status: 'operational',
          repairMonthsRemaining: 0,
          underAttack: true,
          attackCountdownMonths: 1,
          attackFromSectorId: 'debris_belt',
          siegeShield: 0,
          siegeHp: 300,
          lastAttackedMonth: 1,
        },
      },
    };
    // Raid #1: 300 HP - 200 = 100 HP -> still allied, status damaged
    const r1 = advanceCampaignMonth(pilot);
    expect(r1.raidedSectorIds).toContain('border_outpost');
    expect(r1.flippedSectorIds).toEqual([]);
    expect(r1.pilot.baseStates.border_outpost.faction).toBe('allied');
    expect(r1.pilot.baseStates.border_outpost.siegeHp).toBe(100);

    // Raid #2: 100 HP - 200 -> 0 -> flips to hostile, full pool, removed from capturedSectorIds, unlockedSectorIds preserved
    const r2Pilot = {
      ...r1.pilot,
      baseStates: {
        ...r1.pilot.baseStates,
        border_outpost: {
          ...r1.pilot.baseStates.border_outpost,
          underAttack: true,
          attackCountdownMonths: 1,
          attackFromSectorId: 'debris_belt',
        },
      },
    };
    const r2 = advanceCampaignMonth(r2Pilot);
    expect(r2.flippedSectorIds).toContain('border_outpost');
    expect(r2.pilot.baseStates.border_outpost.faction).toBe('hostile');
    expect(r2.pilot.baseStates.border_outpost.status).toBe('damaged');
    expect(r2.pilot.baseStates.border_outpost.siegeShield).toBe(1000);
    expect(r2.pilot.baseStates.border_outpost.siegeHp).toBe(600);
    expect(r2.pilot.capturedSectorIds).not.toContain('border_outpost');
    expect(r2.pilot.unlockedSectorIds).toContain('debris_belt');

    // Part B: allied capital stops at 1 HP and never flips
    const capPilot: typeof pilot = {
      ...pilot,
      baseStates: {
        ...pilot.baseStates,
        border_outpost: {
          ...pilot.baseStates.border_outpost,
          underAttack: false,
          attackCountdownMonths: 0,
          attackFromSectorId: null,
        },
        iron_citadel: {
          faction: 'allied',
          status: 'operational',
          repairMonthsRemaining: 0,
          underAttack: true,
          attackCountdownMonths: 1,
          attackFromSectorId: 'debris_belt',
          siegeShield: 0,
          siegeHp: 50,
          lastAttackedMonth: 1,
        },
      },
    };
    const capRes = advanceCampaignMonth(capPilot);
    expect(capRes.flippedSectorIds).not.toContain('iron_citadel');
    expect(capRes.pilot.baseStates.iron_citadel.faction).toBe('allied');
    expect(capRes.pilot.baseStates.iron_citadel.siegeHp).toBe(1);
    expect(
      capRes.raidResults.find((x) => x.sectorId === 'iron_citadel')?.capitalHeld
    ).toBe(true);
  });

  it('6) old save without siege fields loads with bases treated as full', () => {
    const freshPilot = createFreshCampaignState('Legacy', 'striker').pilot;
    // Strip siege fields & baseSiege from adminConfig to simulate an older save
    const rawOld = {
      saveVersion: CURRENT_SAVE_VERSION,
      pilot: freshPilot,
      adminConfig: { godMode: false },
    };
    const migrated = migrateSaveData(rawOld, CURRENT_SAVE_VERSION);
    expect(migrated.adminConfig.baseSiege).toEqual(DEFAULT_BASE_SIEGE_CONFIG);
    const outpostState = migrated.pilot.baseStates.border_outpost;
    expect(outpostState.siegeShield).toBeUndefined();
    expect(outpostState.siegeHp).toBeUndefined();
    expect(getBaseSiege(outpostState, 'outpost', migrated.adminConfig.baseSiege)).toEqual({
      shield: 1000,
      hp: 600,
      maxShield: 1000,
      maxHp: 600,
    });
  });
});
