// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleResultDialog } from '../../components/BattleResultDialog';
import {
  BATTLE_KIND_RULES,
  clearBattleSourceProvidersForTests,
  registerBattleSourceProvider,
} from '../../data/battleKinds';
import {
  formatCombatLogMessage,
  getAutoStopReasonLabel,
  translate,
} from '../../i18n';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { BattleKind, BattleSummary } from '../../types/game';
import { createInitialBattleState } from '../combat';
import {
  getBattleOptions,
  pickDefaultBattle,
  validateBattleLaunch,
} from '../frontline';
import { applyBattleBaseConsequences } from '../mapWorld';
import { createDefaultPilotAccount } from '../stats';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSummary(kind: BattleKind): BattleSummary {
  return {
    outcome: 'victory',
    retreated: false,
    sectorId: 'border_outpost',
    kind,
    deployedGearId: 'striker',
    rounds: 2,
    enemiesDestroyed: 4,
    totalEnemies: 4,
    alliesSurviving: 4,
    expGained: 120,
    creditsGained: 200,
    warPointsGained: 20,
    baseCaptureBonusWp: 0,
    droppedItems: [],
    leveledUp: false,
    previousLevel: 1,
    newLevel: 1,
    statPointsGained: 0,
    battlesToNextLevel: 2,
    unlockedSectorId: null,
  };
}

describe('TASK MAP-K1 — Battle Kinds, Rule Table, Consequences, Sources & Loop', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    clearBattleSourceProvidersForTests();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().setLanguage('vi');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    clearBattleSourceProvidersForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1) enforces BATTLE_KIND_RULES single rule table for all 5 kinds', () => {
    expect(Object.keys(BATTLE_KIND_RULES).sort()).toEqual([
      'assault',
      'defend',
      'event',
      'mission',
      'patrol',
    ]);

    expect(BATTLE_KIND_RULES.assault).toMatchObject({
      needsVisible: true,
      needsFrontline: true,
      needsAllied: false,
      needsUnderAttack: false,
      capturesOnWin: true,
      clearsRaid: false,
      requiresSource: false,
      completesBonusMissionOnWin: true,
    });

    expect(BATTLE_KIND_RULES.defend).toMatchObject({
      needsVisible: true,
      needsAllied: true,
      needsUnderAttack: true,
      capturesOnWin: false,
      clearsRaid: true,
      requiresSource: false,
      completesBonusMissionOnWin: true,
    });

    expect(BATTLE_KIND_RULES.patrol).toMatchObject({
      needsVisible: true,
      needsFrontline: true,
      needsAllied: true,
      allowEndgamePatrol: true,
      capturesOnWin: false,
      clearsRaid: false,
      requiresSource: false,
      completesBonusMissionOnWin: false,
    });

    for (const kind of ['mission', 'event'] as const) {
      expect(BATTLE_KIND_RULES[kind]).toMatchObject({
        needsVisible: true,
        needsFrontline: false,
        needsAllied: false,
        needsUnderAttack: false,
        capturesOnWin: false,
        clearsRaid: false,
        requiresSource: true,
        completesBonusMissionOnWin: false,
      });
    }
  });

  it('2) picks default battle kind per node (defend > assault > patrol) and populates BattleState.kind', () => {
    const pilot = useGameStore.getState().pilot;
    const adminConfig = useGameStore.getState().adminConfig;

    expect(
      pickDefaultBattle(getBattleOptions(pilot, 'border_outpost', adminConfig))
    ).toBe('assault');
    expect(
      pickDefaultBattle(getBattleOptions(pilot, 'aegis_relay', adminConfig))
    ).toBe('defend');

    // Make border_outpost allied frontline (not underAttack) -> patrol default
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        baseStates: {
          ...s.pilot.baseStates,
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            faction: 'allied',
            underAttack: false,
          },
        },
      },
    }));
    const alliedFrontlinePilot = useGameStore.getState().pilot;
    expect(
      pickDefaultBattle(
        getBattleOptions(alliedFrontlinePilot, 'border_outpost', adminConfig)
      )
    ).toBe('patrol');

    useGameStore.getState().startBattle('border_outpost');
    const b = useGameStore.getState().battle!;
    expect(b.kind).toBe('patrol');
    expect(b.sourceId).toBeNull();
  });

  it('3) captures ONLY on assault win; patrol/defend/mission/event never capture or change faction', () => {
    const basePilot = createDefaultPilotAccount('Tester', 'striker');

    // Assault loss -> stays hostile
    const assaultLoss = applyBattleBaseConsequences(
      basePilot,
      'border_outpost',
      false,
      'assault'
    );
    expect(assaultLoss.capturedFreshly).toBe(false);
    expect(assaultLoss.pilot.baseStates.border_outpost.faction).toBe('hostile');

    // Patrol / Defend / Mission / Event win on hostile node -> NEVER changes faction
    for (const nonCaptureKind of [
      'defend',
      'patrol',
      'mission',
      'event',
    ] as const) {
      const res = applyBattleBaseConsequences(
        basePilot,
        'border_outpost',
        true,
        nonCaptureKind
      );
      expect(res.capturedFreshly).toBe(false);
      expect(res.pilot.baseStates.border_outpost.faction).toBe('hostile');
    }

    // Assault win -> captures border_outpost (damaged)
    const assaultWin = applyBattleBaseConsequences(
      basePilot,
      'border_outpost',
      true,
      'assault'
    );
    expect(assaultWin.capturedFreshly).toBe(true);
    expect(assaultWin.pilot.baseStates.border_outpost.faction).toBe('allied');
    expect(assaultWin.pilot.baseStates.border_outpost.status).toBe('damaged');

    // Full store assault win updates capturedSectorIds & summary.kind
    useGameStore.getState().startBattle('border_outpost');
    useGameStore.getState().forceWinBattle();
    expect(useGameStore.getState().pilot.baseStates.border_outpost.faction).toBe(
      'allied'
    );
    expect(useGameStore.getState().pilot.capturedSectorIds).toContain(
      'border_outpost'
    );
    expect(useGameStore.getState().battle?.summary?.kind).toBe('assault');
  });

  it('4) defend win clears underAttack raid, while patrol/mission/event wins leave raids untouched', () => {
    const pilot = createDefaultPilotAccount('Defender', 'striker');
    expect(pilot.baseStates.aegis_relay.underAttack).toBe(true);

    // Non-defend kinds never clear raids even on victory
    for (const kind of ['assault', 'patrol', 'mission', 'event'] as const) {
      const untouched = applyBattleBaseConsequences(
        pilot,
        'aegis_relay',
        true,
        kind
      );
      expect(untouched.pilot.baseStates.aegis_relay.underAttack).toBe(true);
    }

    // Direct defend clears underAttack raid
    const defendedDirect = applyBattleBaseConsequences(
      pilot,
      'aegis_relay',
      true,
      'defend'
    );
    expect(defendedDirect.pilot.baseStates.aegis_relay.underAttack).toBe(false);
    expect(defendedDirect.pilot.baseStates.aegis_relay.attackCountdownMonths).toBe(0);
    expect(defendedDirect.pilot.baseStates.aegis_relay.attackFromSectorId).toBeNull();

    // Defend via store clears underAttack on aegis_relay (with neighbors allied so next month does not immediately start a fresh raid on aegis_relay)
    useGameStore.setState((s) => ({
      pilot: {
        ...s.pilot,
        baseStates: {
          ...s.pilot.baseStates,
          border_outpost: {
            ...s.pilot.baseStates.border_outpost,
            faction: 'allied',
            underAttack: false,
          },
          veridian_colony: {
            ...s.pilot.baseStates.veridian_colony,
            faction: 'allied',
            underAttack: false,
          },
        },
      },
    }));
    useGameStore.getState().startBattle('aegis_relay');
    expect(useGameStore.getState().battle?.kind).toBe('defend');
    useGameStore.getState().forceWinBattle();
    const after = useGameStore.getState().pilot;
    expect(after.baseStates.aegis_relay.underAttack).toBe(false);
    expect(useGameStore.getState().battle?.summary?.kind).toBe('defend');
  });

  it('5) refuses mission/event without an active provider, accepts with fake provider (sizeOverride & rewardMult), and never captures', () => {
    // No provider registered -> refused with map.reason.sourceInactive
    useGameStore
      .getState()
      .startBattle('border_outpost', { kind: 'mission', sourceId: 'msn_1' });
    expect(useGameStore.getState().battle).toBeNull();
    expect(useGameStore.getState().battleLaunchToast?.reasonKey).toBe(
      'map.reason.sourceInactive'
    );

    useGameStore
      .getState()
      .startBattle('border_outpost', { kind: 'event', sourceId: 'evt_1' });
    expect(useGameStore.getState().battle).toBeNull();
    expect(useGameStore.getState().battleLaunchToast?.reasonKey).toBe(
      'map.reason.sourceInactive'
    );

    // Register active mission & event providers
    registerBattleSourceProvider('mission', (_pilot, sourceId, nodeId) => ({
      active: sourceId === 'msn_1' && nodeId === 'border_outpost',
      sizeOverride: 6,
      rewardMult: 2,
    }));
    registerBattleSourceProvider('event', (_pilot, sourceId, nodeId) => ({
      active: sourceId === 'evt_1' && nodeId === 'aegis_relay',
      sizeOverride: 8,
      rewardMult: 1.5,
    }));

    // Hidden node still refused even with active provider check
    const hiddenCheck = validateBattleLaunch(
      useGameStore.getState().pilot,
      'debris_belt',
      'mission',
      'msn_1'
    );
    expect(hiddenCheck.allowed).toBe(false);
    expect(hiddenCheck.reasonKey).toBe('map.reason.hidden');

    // Launch mission on hostile border_outpost -> accepted with sizeOverride=6, rewardMult=2
    useGameStore
      .getState()
      .startBattle('border_outpost', { kind: 'mission', sourceId: 'msn_1' });
    const mBattle = useGameStore.getState().battle!;
    expect(mBattle).not.toBeNull();
    expect(mBattle.kind).toBe('mission');
    expect(mBattle.sourceId).toBe('msn_1');
    expect(mBattle.squadSize).toBe(6);
    expect(mBattle.rewardMult).toBe(2);

    useGameStore.getState().forceWinBattle();
    const afterMission = useGameStore.getState();
    expect(afterMission.battle?.summary?.kind).toBe('mission');
    // Mission win NEVER captures border_outpost!
    expect(afterMission.pilot.baseStates.border_outpost.faction).toBe('hostile');
    expect(afterMission.pilot.capturedSectorIds).not.toContain(
      'border_outpost'
    );

    // Launch event on raided aegis_relay -> accepted with sizeOverride=8, win NEVER clears raid
    useGameStore
      .getState()
      .startBattle('aegis_relay', { kind: 'event', sourceId: 'evt_1' });
    const eBattle = useGameStore.getState().battle!;
    expect(eBattle.kind).toBe('event');
    expect(eBattle.sourceId).toBe('evt_1');
    expect(eBattle.squadSize).toBe(8);
    useGameStore.getState().forceWinBattle();
    expect(useGameStore.getState().pilot.baseStates.aegis_relay.underAttack).toBe(
      true
    );
    expect(useGameStore.getState().battle?.summary?.kind).toBe('event');
  });

  it('6) activeBonusMission overlay completes on assault/defend win at target and NOT on patrol/mission/event', () => {
    const basePilot = createDefaultPilotAccount('Bounty', 'striker');
    const pilotWithMission = {
      ...basePilot,
      activeBonusMission: {
        id: 'bm_1',
        sourceSectorId: 'aegis_relay',
        targetSectorId: 'border_outpost',
        rewardCredits: 350,
        rewardWarPoints: 25,
        completed: false,
      },
    };

    // Patrol / Mission / Event wins at target do NOT complete bonus mission
    for (const nonOverlayKind of ['patrol', 'mission', 'event'] as const) {
      const noPay = applyBattleBaseConsequences(
        pilotWithMission,
        'border_outpost',
        true,
        nonOverlayKind
      );
      expect(noPay.bonusMissionCredits).toBe(0);
      expect(noPay.bonusMissionWarPoints).toBe(0);
      expect(noPay.pilot.activeBonusMission).not.toBeNull();
    }

    // Assault win at target completes and pays out
    const assaultPay = applyBattleBaseConsequences(
      pilotWithMission,
      'border_outpost',
      true,
      'assault'
    );
    expect(assaultPay.bonusMissionCredits).toBe(350);
    expect(assaultPay.bonusMissionWarPoints).toBe(25);
    expect(assaultPay.pilot.activeBonusMission).toBeNull();

    // Defend win at target also completes and pays out
    const pilotDefendMission = {
      ...basePilot,
      activeBonusMission: {
        id: 'bm_2',
        sourceSectorId: 'aegis_relay',
        targetSectorId: 'aegis_relay',
        rewardCredits: 400,
        rewardWarPoints: 30,
        completed: false,
      },
    };
    const defendPay = applyBattleBaseConsequences(
      pilotDefendMission,
      'aegis_relay',
      true,
      'defend'
    );
    expect(defendPay.bonusMissionCredits).toBe(400);
    expect(defendPay.bonusMissionWarPoints).toBe(30);
    expect(defendPay.pilot.activeBonusMission).toBeNull();
  });

  it('7) auto-repeat preserves kind + sourceId and stops with source_inactive when mission/event source turns inactive', () => {
    let sourceActive = true;
    registerBattleSourceProvider('mission', (_pilot, sourceId) => ({
      active: sourceActive && sourceId === 'q_k1_loop',
    }));

    // Start 5x mission loop
    useGameStore
      .getState()
      .startAutoRepeat(5, 'border_outpost', {
        kind: 'mission',
        sourceId: 'q_k1_loop',
      });
    const b1 = useGameStore.getState().battle!;
    expect(b1.kind).toBe('mission');
    expect(b1.sourceId).toBe('q_k1_loop');
    expect(useGameStore.getState().autoRepeatSession?.kind).toBe('mission');
    expect(useGameStore.getState().autoRepeatSession?.sourceId).toBe(
      'q_k1_loop'
    );

    // Win Run #1 while source stays active -> schedules Run #2 preserving mission + sourceId
    useGameStore.getState().forceWinBattle();
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(true);
    // Simulate BattleScreen effect relaunching Run #2
    useGameStore.getState().startBattle('border_outpost', {
      kind: useGameStore.getState().autoRepeatSession?.kind,
      sourceId: useGameStore.getState().autoRepeatSession?.sourceId ?? null,
    });
    const b2 = useGameStore.getState().battle!;
    expect(b2.kind).toBe('mission');
    expect(b2.sourceId).toBe('q_k1_loop');

    // Source becomes inactive right before Run #2 finishes -> loop stops with 'source_inactive'
    sourceActive = false;
    useGameStore.getState().forceWinBattle();

    const session = useGameStore.getState().autoRepeatSession!;
    expect(session.active).toBe(false);
    expect(session.stopReason).toBe('source_inactive');

    const stopLog = useGameStore.getState().battle!.log.slice(-1)[0];
    expect(stopLog.templateKey).toBe('log.autoRepeatStopped');
    expect(formatCombatLogMessage('vi', stopLog)).toContain(
      'Dừng: nguồn nhiệm vụ/sự kiện không còn hoạt động'
    );
    expect(formatCombatLogMessage('en', stopLog)).toContain(
      EN_TRANSLATIONS['auto.repeatReason.source_inactive']
    );

    // Also verify assault loop on border_outpost stops with node_not_contested right after Run #1 captures it
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().startAutoRepeat(5, 'border_outpost');
    expect(useGameStore.getState().battle?.kind).toBe('assault');
    useGameStore.getState().forceWinBattle();
    expect(useGameStore.getState().autoRepeatSession?.active).toBe(false);
    expect(useGameStore.getState().autoRepeatSession?.stopReason).toBe(
      'node_not_contested'
    );
  });

  it('8) guarantees fixed-seed deterministic equality for assault, defend, and patrol map kinds', () => {
    const cases: Array<{
      kind: 'assault' | 'defend' | 'patrol';
      sectorId: string;
      makePilot: () => ReturnType<typeof createDefaultPilotAccount>;
    }> = [
      {
        kind: 'assault',
        sectorId: 'border_outpost',
        makePilot: () => createDefaultPilotAccount('SeedPilot', 'striker'),
      },
      {
        kind: 'defend',
        sectorId: 'aegis_relay',
        makePilot: () => createDefaultPilotAccount('SeedPilot', 'striker'),
      },
      {
        kind: 'patrol',
        sectorId: 'border_outpost',
        makePilot: () => {
          const p = createDefaultPilotAccount('SeedPilot', 'striker');
          return {
            ...p,
            baseStates: {
              ...p.baseStates,
              border_outpost: {
                ...p.baseStates.border_outpost,
                faction: 'allied' as const,
                underAttack: false,
              },
            },
          };
        },
      },
    ];

    for (const c of cases) {
      const pilotA = c.makePilot();
      const pilotB = c.makePilot();
      const b1 = createInitialBattleState(
        pilotA,
        c.sectorId,
        createMulberry32(777123),
        null,
        undefined,
        c.kind,
        null
      );
      const b2 = createInitialBattleState(
        pilotB,
        c.sectorId,
        createMulberry32(777123),
        null,
        undefined,
        c.kind,
        null
      );
      expect(b1.kind).toBe(c.kind);
      expect(b1.rewardMult).toBeUndefined();
      expect(b1.units).toEqual(b2.units);
      expect(b1.turnOrder).toEqual(b2.turnOrder);
      expect(b1.selectedTargetId).toBe(b2.selectedTargetId);
    }
  });

  it('9) renders BattleResultDialog kind line for all 5 kinds and keeps exact vi/en parity', () => {
    // Parity check
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
    expect(VI_TRANSLATIONS['auto.repeatReason.source_inactive']).toBe(
      'Dừng: nguồn nhiệm vụ/sự kiện không còn hoạt động'
    );
    expect(getAutoStopReasonLabel('vi', 'source_inactive')).toBe(
      'Dừng: nguồn nhiệm vụ/sự kiện không còn hoạt động'
    );
    expect(getAutoStopReasonLabel('en', 'source_inactive')).toBe(
      EN_TRANSLATIONS['auto.repeatReason.source_inactive']
    );

    const expectedVi: Record<BattleKind, string> = {
      assault: 'Loại trận: Tấn công',
      defend: 'Loại trận: Phòng thủ',
      patrol: 'Loại trận: Tuần tra',
      mission: 'Loại trận: Nhiệm vụ',
      event: 'Loại trận: Sự kiện',
    };
    const expectedEn: Record<BattleKind, string> = {
      assault: 'Battle type: Assault',
      defend: 'Battle type: Defend',
      patrol: 'Battle type: Patrol',
      mission: 'Battle type: Mission',
      event: 'Battle type: Event',
    };

    for (const kind of [
      'assault',
      'defend',
      'patrol',
      'mission',
      'event',
    ] as const) {
      act(() => {
        root.render(
          createElement(BattleResultDialog, {
            summary: makeSummary(kind),
            squadSize: 4,
            lang: 'vi',
            t: (key, params) => translate('vi', key, params),
            onOpenReport: vi.fn(),
            onOpenLog: vi.fn(),
            onReturnHangar: vi.fn(),
            onNextSortie: vi.fn(),
          })
        );
      });
      expect(
        container.querySelector('[data-testid="battle-result-kind"]')?.textContent
      ).toBe(expectedVi[kind]);

      act(() => {
        root.render(
          createElement(BattleResultDialog, {
            summary: makeSummary(kind),
            squadSize: 4,
            lang: 'en',
            t: (key, params) => translate('en', key, params),
            onOpenReport: vi.fn(),
            onOpenLog: vi.fn(),
            onReturnHangar: vi.fn(),
            onNextSortie: vi.fn(),
          })
        );
      });
      expect(
        container.querySelector('[data-testid="battle-result-kind"]')?.textContent
      ).toBe(expectedEn[kind]);
    }
  });
});
