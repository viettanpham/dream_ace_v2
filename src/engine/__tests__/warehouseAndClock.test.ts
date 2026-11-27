// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { ITEM_TEMPLATES } from '../../data/items';
import { useGameStore } from '../../store/useGameStore';
import { generateItemInstance } from '../equipment';
import { createDefaultPilotAccount } from '../stats';
import {
  moveAllUnusedToWarehouse,
  moveToBox,
  moveToWarehouse,
} from '../warehouse';
import {
  changeWorldSpeed,
  createDefaultWorldClock,
  MAX_WORLD_CLOCK_SECONDS_PER_DAY,
  MIN_WORLD_CLOCK_SECONDS_PER_DAY,
  resetWorldClock,
  settleWorldClock,
} from '../worldClock';

function createDeterministicRng(seed = 77): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const TPL_WEAPON = ITEM_TEMPLATES.find((t) => t.slot === 'main_weapon')!.id;
const TPL_ARMOR = ITEM_TEMPLATES.find((t) => t.slot === 'armor')!.id;

function makeItem(
  instanceId: string,
  opts: { locked?: boolean; favorited?: boolean; templateId?: string } = {}
) {
  const item = generateItemInstance(
    {
      templateId: opts.templateId ?? TPL_WEAPON,
      tier: 1,
      rarity: 'rare',
      requiredLevel: 1,
      rollQuality: 70,
    },
    createDeterministicRng(instanceId.length * 41 + 9)
  );
  return {
    ...item,
    instanceId,
    locked: Boolean(opts.locked),
    favorited: Boolean(opts.favorited),
    isStarter: false,
    isNew: false,
    obtainedAt: 1700000000000,
  };
}

describe('W1a-2 — Warehouse transfers & World clock helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().resetCampaign();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1) blocks items equipped by ANY gear (active or inactive) while allowing unequipped moves free of credits and keeping consumables untouched', () => {
    const eqStriker = makeItem('eq_striker');
    const eqInterceptor = makeItem('eq_interceptor', { templateId: TPL_ARMOR });
    const spare1 = makeItem('spare_1');
    const spare2 = makeItem('spare_2');

    const pilot = createDefaultPilotAccount('Ace', 'striker', [
      eqStriker,
      eqInterceptor,
      spare1,
      spare2,
    ]);
    pilot.credits = 1234;
    pilot.consumables = [{ id: 'enchant_stone_1', kind: 'enchant_stone', quantity: 3 }];
    pilot.gears.striker.equipped.main_weapon = eqStriker.instanceId;
    pilot.gears.interceptor.owned = true;
    pilot.gears.interceptor.equipped.armor = eqInterceptor.instanceId;

    const res = moveToWarehouse(
      pilot,
      ['eq_striker', 'eq_interceptor', 'spare_1', 'spare_1'],
      300
    );

    expect(res.moved).toBe(1);
    expect(res.skippedEquipped).toBe(2);
    expect(res.skippedProtected).toBe(0);
    expect(res.skippedFull).toBe(0);

    expect(res.pilot.credits).toBe(1234);
    expect(res.pilot.consumables).toEqual([
      { id: 'enchant_stone_1', kind: 'enchant_stone', quantity: 3 },
    ]);
    expect(res.pilot.inventory.map((i) => i.instanceId)).toEqual([
      'eq_striker',
      'eq_interceptor',
      'spare_2',
    ]);
    expect(res.pilot.warehouse.map((i) => i.instanceId)).toEqual(['spare_1']);

    // No id exists in both arrays
    const invSet = new Set(res.pilot.inventory.map((i) => i.instanceId));
    expect(res.pilot.warehouse.some((i) => invSet.has(i.instanceId))).toBe(false);
  });

  it('2) locked and favorited items move when picked singly (moveToWarehouse & moveToBox) but are skipped by moveAllUnusedToWarehouse', () => {
    const eqItem = makeItem('eq_main');
    const lockedItem = makeItem('locked_item', { locked: true });
    const favItem = makeItem('fav_item', { favorited: true });
    const looseA = makeItem('loose_a');
    const looseB = makeItem('loose_b');

    const pilot = createDefaultPilotAccount('Ace', 'striker', [
      eqItem,
      lockedItem,
      favItem,
      looseA,
      looseB,
    ]);
    pilot.gears.striker.equipped.main_weapon = eqItem.instanceId;

    // Bulk move skips equipped + locked + favorited
    const bulkRes = moveAllUnusedToWarehouse(pilot, 300);
    expect(bulkRes).toMatchObject({
      moved: 2,
      skippedEquipped: 1,
      skippedProtected: 2,
      skippedFull: 0,
    });
    expect(bulkRes.pilot.inventory.map((i) => i.instanceId)).toEqual([
      'eq_main',
      'locked_item',
      'fav_item',
    ]);
    expect(bulkRes.pilot.warehouse.map((i) => i.instanceId)).toEqual([
      'loose_a',
      'loose_b',
    ]);

    // Picking locked & favorited items explicitly DOES move them to warehouse
    const singleToWh = moveToWarehouse(
      bulkRes.pilot,
      ['locked_item', 'fav_item'],
      300
    );
    expect(singleToWh).toMatchObject({
      moved: 2,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
    });
    expect(singleToWh.pilot.inventory.map((i) => i.instanceId)).toEqual([
      'eq_main',
    ]);
    expect(singleToWh.pilot.warehouse.map((i) => i.instanceId)).toEqual([
      'loose_a',
      'loose_b',
      'locked_item',
      'fav_item',
    ]);

    // Picking locked & favorited items back via moveToBox also moves them
    const singleToBox = moveToBox(
      singleToWh.pilot,
      ['fav_item', 'locked_item'],
      BALANCE_CONFIG.maxInventorySize
    );
    expect(singleToBox).toMatchObject({
      moved: 2,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
    });
    expect(singleToBox.pilot.inventory.map((i) => i.instanceId)).toEqual([
      'eq_main',
      'fav_item',
      'locked_item',
    ]);
    expect(singleToBox.pilot.warehouse.map((i) => i.instanceId)).toEqual([
      'loose_a',
      'loose_b',
    ]);
  });

  it('3) handles partial moves when target is full in given order with exact counts and keeps box <= BALANCE_CONFIG.maxInventorySize', () => {
    const whExisting = Array.from({ length: 48 }, (_, idx) =>
      makeItem(`wh_pre_${idx}`)
    );
    const eqItem = makeItem('inv_eq');
    const a = makeItem('inv_a');
    const b = makeItem('inv_b');
    const c = makeItem('inv_c');
    const d = makeItem('inv_d');

    const pilot = createDefaultPilotAccount('Ace', 'striker', [
      eqItem,
      a,
      b,
      c,
      d,
    ]);
    pilot.warehouse = whExisting;
    pilot.gears.striker.equipped.main_weapon = eqItem.instanceId;

    // Warehouse capacity = 50 -> only 2 free slots; order: [inv_c, inv_eq, inv_a, inv_d]
    const partialWh = moveToWarehouse(
      pilot,
      ['inv_c', 'inv_eq', 'inv_a', 'inv_d'],
      50
    );
    expect(partialWh).toMatchObject({
      moved: 2,
      skippedEquipped: 1,
      skippedProtected: 0,
      skippedFull: 1,
    });
    expect(partialWh.pilot.warehouse).toHaveLength(50);
    expect(
      partialWh.pilot.warehouse.slice(-2).map((i) => i.instanceId)
    ).toEqual(['inv_c', 'inv_a']);
    expect(partialWh.pilot.inventory.map((i) => i.instanceId)).toEqual([
      'inv_eq',
      'inv_b',
      'inv_d',
    ]);

    // moveToBox: fill box to maxInventorySize - 2, then request 4 items from warehouse
    const boxCap = BALANCE_CONFIG.maxInventorySize;
    const nearFullBox = Array.from({ length: boxCap - 2 }, (_, idx) =>
      makeItem(`box_pre_${idx}`)
    );
    const boxPilot = createDefaultPilotAccount('Ace', 'striker', nearFullBox);
    boxPilot.warehouse = [
      makeItem('w_1'),
      makeItem('w_2'),
      makeItem('w_3'),
      makeItem('w_4'),
    ];

    const partialBox = moveToBox(boxPilot, ['w_4', 'w_2', 'w_1', 'w_3']);
    expect(partialBox).toMatchObject({
      moved: 2,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 2,
    });
    expect(partialBox.pilot.inventory.length).toBe(boxCap);
    expect(
      partialBox.pilot.inventory.slice(-2).map((i) => i.instanceId)
    ).toEqual(['w_4', 'w_2']);
    expect(partialBox.pilot.warehouse.map((i) => i.instanceId)).toEqual([
      'w_1',
      'w_3',
    ]);

    // Further moveToBox keeps box strictly <= cap (0 moved, all skippedFull)
    const overfullAttempt = moveToBox(partialBox.pilot, ['w_1', 'w_3']);
    expect(overfullAttempt).toMatchObject({
      moved: 0,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 2,
    });
    expect(overfullAttempt.pilot.inventory.length).toBe(boxCap);

    // Even if box is already overflowing from loot (> maxInventorySize), moveToBox never grows it
    const overflowPilot = createDefaultPilotAccount(
      'Ace',
      'striker',
      Array.from({ length: boxCap + 3 }, (_, idx) => makeItem(`ov_${idx}`))
    );
    overflowPilot.warehouse = [makeItem('wh_locked_out')];
    const blockedOverflow = moveToBox(overflowPilot, ['wh_locked_out']);
    expect(blockedOverflow.moved).toBe(0);
    expect(blockedOverflow.skippedFull).toBe(1);
    expect(blockedOverflow.pilot.inventory.length).toBe(boxCap + 3);

    // Ensure no shared id across inventory & warehouse
    const invIds = new Set(partialBox.pilot.inventory.map((i) => i.instanceId));
    expect(partialBox.pilot.warehouse.some((i) => invIds.has(i.instanceId))).toBe(
      false
    );
  });

  it('4) store wrappers return no-op with reason "locked" during active battle or active auto-repeat loop, and work outside them', () => {
    useGameStore.getState().startCampaign('GuardPilot', 'striker');
    const itemA = makeItem('store_a');
    const itemB = makeItem('store_b', { locked: true });
    const whOnly = makeItem('store_wh');

    useGameStore.setState((state) => ({
      pilot: {
        ...state.pilot,
        inventory: [...state.pilot.inventory, itemA, itemB],
        warehouse: [whOnly],
      },
    }));

    // Simulate active battle (screen === 'BATTLE' and battle.summary === null)
    useGameStore.setState({
      screen: 'BATTLE',
      battle: {
        sectorId: 'aegis_relay',
        sectorName: 'Aegis Relay',
        round: 1,
        turnCounter: 1,
        units: [],
        turnQueue: [],
        actedUnitIds: [],
        activeUnitId: null,
        selectedTargetId: null,
        log: [],
        summary: null,
        autoBattle: false,
      } as unknown as ReturnType<typeof useGameStore.getState>['battle'],
    });

    const invBeforeBattle = useGameStore.getState().pilot.inventory.length;
    const whBeforeBattle = useGameStore.getState().pilot.warehouse.length;

    expect(useGameStore.getState().moveToWarehouse(['store_a'])).toEqual({
      moved: 0,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
      reason: 'locked',
    });
    expect(useGameStore.getState().moveToBox(['store_wh'])).toEqual({
      moved: 0,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
      reason: 'locked',
    });
    expect(useGameStore.getState().moveAllUnusedToWarehouse()).toEqual({
      moved: 0,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
      reason: 'locked',
    });
    expect(useGameStore.getState().pilot.inventory.length).toBe(invBeforeBattle);
    expect(useGameStore.getState().pilot.warehouse.length).toBe(whBeforeBattle);

    // Exit battle, activate autoRepeatSession -> still locked!
    useGameStore.setState({
      screen: 'HANGAR',
      battle: null,
      autoRepeatSession: {
        active: true,
        limit: 5,
        sectorId: 'aegis_relay',
        completedRuns: 1,
        wins: 1,
        consecutiveDefeats: 0,
        defeatStreakLimit: 3,
        totalExp: 100,
        totalCredits: 200,
        totalWarPoints: 10,
        totalDrops: [],
        stopReason: null,
      },
    });

    expect(useGameStore.getState().moveToWarehouse(['store_a'])).toEqual({
      moved: 0,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
      reason: 'locked',
    });
    expect(useGameStore.getState().moveToBox(['store_wh'])).toEqual({
      moved: 0,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
      reason: 'locked',
    });
    expect(useGameStore.getState().moveAllUnusedToWarehouse()).toEqual({
      moved: 0,
      skippedEquipped: 0,
      skippedProtected: 0,
      skippedFull: 0,
      reason: 'locked',
    });

    // Deactivate loop -> store wrappers execute properly (respecting adminConfig.warehouseCapacity)
    useGameStore.setState((state) => ({
      autoRepeatSession: {
        ...state.autoRepeatSession!,
        active: false,
        stopReason: 'manual_stop',
      },
    }));

    const bulkStoreRes = useGameStore.getState().moveAllUnusedToWarehouse();
    expect(bulkStoreRes.reason).toBeUndefined();
    expect(bulkStoreRes.moved).toBe(1);
    expect(bulkStoreRes.skippedEquipped).toBe(6);
    expect(bulkStoreRes.skippedProtected).toBe(1);

    const singleMoveRes = useGameStore.getState().moveToWarehouse(['store_b']);
    expect(singleMoveRes.moved).toBe(1);

    const backRes = useGameStore.getState().moveToBox(['store_wh', 'store_a']);
    expect(backRes.moved).toBe(2);
    expect(
      useGameStore
        .getState()
        .pilot.warehouse.map((it) => it.instanceId)
    ).toEqual(['store_b']);
  });

  it('5) worldClock helpers with fake timers: settle, paused, null lastTickAt, catch-up cap, continuous mid-day speed change, custom clamp, and reset', () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-06-01T00:00:00.000Z').getTime();
    vi.setSystemTime(t0);

    // Null lastTickAt -> only anchors lastTickAt
    const initClock = createDefaultWorldClock();
    expect(initClock.lastTickAt).toBeNull();
    const anchored = settleWorldClock(initClock, Date.now());
    expect(anchored).toEqual({
      worldDay: 0,
      lastTickAt: t0,
      speedMode: 'normal',
      secondsPerDay: 180,
      paused: false,
    });

    // Advance 90 seconds at normal speed (180s/day) => +0.5 worldDay
    vi.advanceTimersByTime(90_000);
    const halfDay = settleWorldClock(anchored, Date.now());
    expect(halfDay.worldDay).toBeCloseTo(0.5, 6);
    expect(halfDay.lastTickAt).toBe(t0 + 90_000);

    // Paused clock advances 0 days and updates lastTickAt so paused time does not leak
    const pausedClock = { ...halfDay, paused: true };
    vi.advanceTimersByTime(360_000);
    const settledPaused = settleWorldClock(pausedClock, Date.now());
    expect(settledPaused.worldDay).toBeCloseTo(0.5, 6);
    expect(settledPaused.lastTickAt).toBe(t0 + 450_000);

    // Unpause and test catch-up cap (default 30 days)
    const unpaused = { ...settledPaused, paused: false };
    vi.advanceTimersByTime(100 * 180_000); // +100 days worth of ms
    const capped = settleWorldClock(unpaused, Date.now());
    expect(capped.worldDay).toBeCloseTo(30.5, 6);

    // Custom catch-up cap
    vi.advanceTimersByTime(10 * 180_000);
    const customCapped = settleWorldClock(capped, Date.now(), 2);
    expect(customCapped.worldDay).toBeCloseTo(32.5, 6);

    // Mid-day speed change keeps worldDay continuous:
    // Currently at day 32.5 (normal = 180s/day). Advance 45s (+0.25 day -> 32.75) then switch to fast (30s/day).
    vi.advanceTimersByTime(45_000);
    const tSwitch = Date.now();
    const switchedFast = changeWorldSpeed(customCapped, 'fast', tSwitch);
    expect(switchedFast.worldDay).toBeCloseTo(32.75, 6);
    expect(switchedFast.speedMode).toBe('fast');
    expect(switchedFast.secondsPerDay).toBe(30);
    expect(switchedFast.lastTickAt).toBe(tSwitch);

    // Advance 15s at fast speed (30s/day) => +0.5 day -> 33.25
    vi.advanceTimersByTime(15_000);
    const afterFast = settleWorldClock(switchedFast, Date.now());
    expect(afterFast.worldDay).toBeCloseTo(33.25, 6);

    // Slow preset (600s/day) and custom speed clamping (10..86400)
    const slowClock = changeWorldSpeed(afterFast, 'slow', Date.now());
    expect(slowClock.secondsPerDay).toBe(600);
    expect(slowClock.worldDay).toBeCloseTo(33.25, 6);

    const customLow = changeWorldSpeed(slowClock, 'custom', Date.now(), 2);
    expect(customLow.speedMode).toBe('custom');
    expect(customLow.secondsPerDay).toBe(MIN_WORLD_CLOCK_SECONDS_PER_DAY);

    const customHigh = changeWorldSpeed(customLow, 'custom', Date.now(), 999999);
    expect(customHigh.speedMode).toBe('custom');
    expect(customHigh.secondsPerDay).toBe(MAX_WORLD_CLOCK_SECONDS_PER_DAY);

    // Reset world clock anchors worldDay = 0 at nowMs
    vi.advanceTimersByTime(10_000);
    const tReset = Date.now();
    expect(resetWorldClock(tReset)).toEqual({
      worldDay: 0,
      lastTickAt: tReset,
      speedMode: 'normal',
      secondsPerDay: 180,
      paused: false,
    });
  });
});
