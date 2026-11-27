import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearBattleSourceProvidersForTests } from '../../data/battleKinds';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { PirateIncident } from '../../types/game';
import * as frontline from '../frontline';
import {
  DEFAULT_PIRATES_CONFIG,
  ensureIdle,
  registerPirateBattleSourceProvider,
  rollIncident,
  sanitizePirateIncidents,
} from '../pirates';
import { createDefaultPilotAccount } from '../stats';

function createRng(seed = 20261125): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TASK PIRATE-1a — Pirate incidents (engine + store + battle option)', () => {
  beforeEach(() => {
    clearBattleSourceProvidersForTests();
    registerPirateBattleSourceProvider(
      () => useGameStore.getState().adminConfig?.pirates
    );
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearBattleSourceProvidersForTests();
  });

  it('(1) rollIncident picks a visible allied node without an active incident and a size in {4, 6, 8}', () => {
    const pilot = createDefaultPilotAccount('PirateTest', 'striker');
    const rng = createRng(101);
    for (let i = 0; i < 6; i++) {
      const incident = rollIncident(pilot, DEFAULT_PIRATES_CONFIG, rng);
      expect(incident).not.toBeNull();
      const faction = pilot.baseStates[incident!.nodeId]?.faction;
      expect(faction).toBe('allied');
      expect(frontline.isVisible(pilot, incident!.nodeId)).toBe(true);
      expect([4, 6, 8]).toContain(incident!.size);
      expect(incident!.expiresMonth).toBe(
        pilot.campaignMonth + DEFAULT_PIRATES_CONFIG.expiryMonths
      );
    }
  });

  it('(2) ensureIdle spawns exactly one when nothing else can be fought, none otherwise', () => {
    const pilot = createDefaultPilotAccount('IdleTest', 'striker');
    const unchanged = ensureIdle(pilot, DEFAULT_PIRATES_CONFIG, createRng(201));
    expect(unchanged.pirateIncidents).toEqual([]);

    vi.spyOn(frontline, 'getBattleOptions').mockReturnValue([
      { kind: 'patrol', allowed: false, reasonKey: 'map.reason.rearBase' },
    ]);
    const spawnedOnce = ensureIdle(pilot, DEFAULT_PIRATES_CONFIG, createRng(202));
    expect(spawnedOnce.pirateIncidents).toHaveLength(1);

    const spawnedTwice = ensureIdle(
      spawnedOnce,
      DEFAULT_PIRATES_CONFIG,
      createRng(203)
    );
    expect(spawnedTwice.pirateIncidents).toHaveLength(1);
    expect(spawnedTwice.pirateIncidents?.[0].id).toBe(
      spawnedOnce.pirateIncidents?.[0].id
    );
  });

  it('(3) an incident shows as an event option and launching it uses its size', () => {
    const incident: PirateIncident = {
      id: 'pir_1_size8',
      nodeId: 'aegis_relay',
      size: 8,
      createdMonth: 1,
      expiresMonth: 4,
    };
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        pirateIncidents: [incident],
      },
    }));

    const state = useGameStore.getState();
    const opts = frontline.getBattleOptions(
      state.pilot,
      'aegis_relay',
      state.adminConfig
    );
    const eventOpt = opts.find((o) => o.kind === 'event');
    expect(eventOpt).toMatchObject({
      kind: 'event',
      allowed: true,
      sourceId: incident.id,
      labelKey: 'map.battle.pirates',
      sizeOverride: 8,
    });
    expect(VI_TRANSLATIONS['map.battle.pirates']).toBe('Truy quét cướp biển');

    useGameStore.getState().startBattle('aegis_relay', {
      kind: 'event',
      sourceId: incident.id,
    });
    const battle = useGameStore.getState().battle!;
    expect(battle).not.toBeNull();
    expect(battle.kind).toBe('event');
    expect(battle.sourceId).toBe(incident.id);
    expect(battle.squadSize).toBe(8);
  });

  it('(4) winning a pirate incident battle removes it and captures nothing', () => {
    const incident: PirateIncident = {
      id: 'pir_1_win',
      nodeId: 'border_outpost',
      size: 6,
      createdMonth: 1,
      expiresMonth: 4,
    };
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        pirateIncidents: [incident],
      },
    }));

    useGameStore.getState().startBattle('border_outpost', {
      kind: 'event',
      sourceId: incident.id,
    });
    useGameStore.getState().forceWinBattle();

    const after = useGameStore.getState();
    expect(
      after.pilot.pirateIncidents?.some((inc) => inc.id === incident.id)
    ).toBe(false);
    expect(after.pilot.baseStates.border_outpost.faction).toBe('hostile');
    expect(after.pilot.capturedSectorIds).not.toContain('border_outpost');
    expect(after.battle?.summary?.kind).toBe('event');
    expect(after.battle?.summary?.sourceId).toBe(incident.id);
  });

  it('(5) sanitizer drops expired and unknown incidents and clamps maxActive', () => {
    const cleaned = sanitizePirateIncidents(
      [
        {
          id: 'pir_expired',
          nodeId: 'aegis_relay',
          size: 4,
          createdMonth: 1,
          expiresMonth: 5,
        },
        {
          id: 'pir_unknown',
          nodeId: 'missing_sector',
          size: 4,
          createdMonth: 3,
          expiresMonth: 8,
        },
        {
          id: 'pir_ok_1',
          nodeId: 'aegis_relay',
          size: 4,
          createdMonth: 4,
          expiresMonth: 7,
        },
        {
          id: 'pir_ok_2',
          nodeId: 'border_outpost',
          size: 6,
          createdMonth: 4,
          expiresMonth: 7,
        },
        {
          id: 'pir_ok_3',
          nodeId: 'veridian_colony',
          size: 8,
          createdMonth: 4,
          expiresMonth: 7,
        },
      ],
      5,
      { maxActive: 2 }
    );

    expect(cleaned.map((i) => i.id)).toEqual(['pir_ok_1', 'pir_ok_2']);
  });
});
