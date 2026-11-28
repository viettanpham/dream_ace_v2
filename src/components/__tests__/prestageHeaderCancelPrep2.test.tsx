// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { createDefaultAdminConfig, createFreshCampaignState } from '../../engine/migration';
import { translate } from '../../i18n';
import { EN_TRANSLATIONS, type TranslationKey } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { BattleKind, BattleState, CombatUnit } from '../../types/game';
import { PrestageDialog } from '../PrestageDialog';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const tVi = (key: TranslationKey, params?: Record<string, string | number>) =>
  translate('vi', key, params);
const tEn = (key: TranslationKey, params?: Record<string, string | number>) =>
  translate('en', key, params);

function makeUnit(id: string, side: 'ally' | 'enemy', isPlayer = false): CombatUnit {
  return {
    id,
    name: id,
    callsign: id,
    side,
    row: 'front',
    formationCol: 0,
    isPlayer,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 1000,
      maxShield: 500,
      maxSp: 100,
      speed: 80,
      attackPower: 50,
      defenseRating: 25,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    hp: 1000,
    shield: 500,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
  };
}

function makeBattle(kind: BattleKind, sectorId = 'border_outpost'): BattleState {
  const units = [makeUnit('a1', 'ally', true), makeUnit('e1', 'enemy')];
  return {
    sectorId,
    kind,
    deployedGearId: 'striker',
    squadSize: 4 as BattleState['squadSize'],
    round: 1,
    turnCounter: 0,
    turnOrder: ['a1', 'e1'],
    activeTurnIndex: 0,
    units,
    selectedTargetId: 'e1',
    selectedAllyTargetId: 'a1',
    lastPlayerTargetId: 'e1',
    autoStopNotice: null,
    wingmanChat: null,
    log: [],
    events: [],
    roundSnapshots: [],
    fxEvents: [],
    popups: [],
    explodedUnitIds: [],
    isResolving: false,
    summary: null,
    prestage: { active: true, appliedByUnit: {} },
  };
}

describe('TASK PREP-2 — Prestage info header & cancelPrestage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    const fresh = createFreshCampaignState('Pilot', 'striker', () => 0.5);
    useGameStore.setState({
      language: 'vi',
      screen: 'HANGAR',
      activeTab: 'map',
      adminConfig: createDefaultAdminConfig(),
      pilot: fresh.pilot,
      battle: null,
      autoRepeatSession: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    useGameStore.setState({ battle: null, autoRepeatSession: null });
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1) renders kind badge, sector info, and line 2 for all 5 battle kinds (desktop + phone) and does not cancel on ESC/backdrop', () => {
    const cases: Array<{ kind: BattleKind; badgeVi: string; line2Vi: string; line2En: string }> = [
      { kind: 'assault', badgeVi: 'Tấn công', line2Vi: 'Ta tấn công', line2En: 'Assaulting' },
      { kind: 'defend', badgeVi: 'Phòng thủ', line2Vi: 'Ta phòng thủ', line2En: 'Defending' },
      { kind: 'patrol', badgeVi: 'Tuần tra', line2Vi: 'Tuần tra', line2En: 'Patrol' },
      { kind: 'mission', badgeVi: 'Nhiệm vụ', line2Vi: 'Nhiệm vụ', line2En: 'Mission' },
      { kind: 'event', badgeVi: 'Sự kiện', line2Vi: 'Sự kiện', line2En: 'Event' },
    ];

    for (const c of cases) {
      act(() => {
        root.render(
          createElement(PrestageDialog, {
            battle: makeBattle(c.kind, 'border_outpost'),
            supplyRows: [],
            adminConfig: createDefaultAdminConfig(),
            autoLoopActive: false,
            lang: 'vi',
            t: tVi,
            onConfirm: () => {},
            onCancel: () => {},
          })
        );
      });
      expect(container.querySelector('[data-testid="prestage-kind-badge"]')?.textContent).toBe(c.badgeVi);
      expect(container.querySelector('[data-testid="prestage-info-line1"]')?.textContent).toContain('1 v 1');
      expect(container.querySelector('[data-testid="prestage-info-line2"]')?.textContent).toContain(c.line2Vi);

      act(() => {
        root.render(
          createElement(PrestageDialog, {
            battle: makeBattle(c.kind, ''),
            supplyRows: [],
            adminConfig: createDefaultAdminConfig(),
            autoLoopActive: false,
            lang: 'en',
            t: tEn,
            onConfirm: () => {},
            onCancel: () => {},
          })
        );
      });
      expect(container.querySelector('[data-testid="prestage-info-line1"]')?.textContent).toContain('— · — · 1 v 1');
      expect(container.querySelector('[data-testid="prestage-info-line2"]')?.textContent).toContain(c.line2En);
    }

    // Phone BottomSheet: renders [Hủy] + info header, ESC/backdrop must NOT trigger onCancel
    let cancelCalls = 0;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 360 });
    act(() => {
      root.render(
        createElement(PrestageDialog, {
          battle: makeBattle('assault', 'border_outpost'),
          supplyRows: [],
          adminConfig: createDefaultAdminConfig(),
          autoLoopActive: false,
          lang: 'vi',
          t: tVi,
          onConfirm: () => {},
          onCancel: () => { cancelCalls += 1; },
        })
      );
    });
    const sheetOverlay = container.querySelector('[data-testid="prestage-dialog"]') as HTMLElement | null;
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      sheetOverlay?.click();
    });
    expect(cancelCalls).toBe(0);
    const cancelBtn = container.querySelector('[data-testid="prestage-cancel-btn"]') as HTMLButtonElement | null;
    expect(cancelBtn?.textContent).toBe('Hủy');
    act(() => {
      cancelBtn?.click();
    });
    expect(cancelCalls).toBe(1);
  });

  it('2) cancelPrestage discards pending battle cleanly, restores map view without changing pilot/economy, and refuses when prestage inactive', () => {
    const fresh = createFreshCampaignState('Pilot', 'striker', () => 0.5);
    fresh.pilot.credits = 12345;
    fresh.pilot.activeBuffs = { exp: { tier: 1, battles: 3 } };
    useGameStore.setState({
      pilot: fresh.pilot,
      screen: 'HANGAR',
      activeTab: 'gear',
      supplyShopRefresh: { used: 1 },
      adminConfig: { ...createDefaultAdminConfig(), prestage: { enabled: true, countdownSec: 0, groupFromSize: 10 } },
    });

    const snapshotPilot = structuredClone(useGameStore.getState().pilot);
    const snapshotRefresh = structuredClone(useGameStore.getState().supplyShopRefresh);

    act(() => {
      useGameStore.getState().startBattle('border_outpost');
    });
    expect(useGameStore.getState().screen).toBe('BATTLE');
    expect(useGameStore.getState().battle?.prestage?.active).toBe(true);

    act(() => {
      useGameStore.getState().cancelPrestage();
    });
    const afterCancel = useGameStore.getState();
    expect(afterCancel.battle).toBeNull();
    expect(afterCancel.screen).toBe('HANGAR');
    expect(afterCancel.activeTab).toBe('map');
    expect(afterCancel.pilot).toEqual(snapshotPilot);
    expect(afterCancel.supplyShopRefresh).toEqual(snapshotRefresh);

    // Refuses once prestage is confirmed (active: false)
    act(() => {
      useGameStore.getState().startBattle('border_outpost');
      useGameStore.getState().confirmPrestage();
      useGameStore.getState().cancelPrestage();
    });
    expect(useGameStore.getState().battle).not.toBeNull();
    expect(useGameStore.getState().screen).toBe('BATTLE');
  });

  it('3) auto-repeat stops with stopReason cancelled when cancelPrestage runs during active prestage', () => {
    useGameStore.setState({
      screen: 'BATTLE',
      battle: makeBattle('assault', 'border_outpost'),
      autoRepeatSession: {
        active: true,
        limit: 5,
        sectorId: 'border_outpost',
        kind: 'assault',
        sourceId: null,
        completedRuns: 1,
        wins: 1,
        totalExp: 100,
        totalCredits: 200,
        totalWarPoints: 10,
        totalDrops: [],
        stopReason: null,
      },
    });

    act(() => {
      useGameStore.getState().cancelPrestage();
    });

    const state = useGameStore.getState();
    expect(state.battle).toBeNull();
    expect(state.screen).toBe('HANGAR');
    expect(state.activeTab).toBe('map');
    expect(state.autoRepeatSession?.active).toBe(false);
    expect(state.autoRepeatSession?.stopReason).toBe('cancelled');
  });

  it('4) vi/en key parity for all prestage.*, battle.kind.*, and auto.repeatReason.cancelled keys', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).filter(
      (k) =>
        k.startsWith('prestage.') ||
        k.startsWith('battle.kind.') ||
        k === 'auto.repeatReason.cancelled'
    );
    const enKeys = Object.keys(EN_TRANSLATIONS).filter(
      (k) =>
        k.startsWith('prestage.') ||
        k.startsWith('battle.kind.') ||
        k === 'auto.repeatReason.cancelled'
    );
    expect(viKeys.sort()).toEqual(enKeys.sort());
    for (const key of viKeys) {
      expect(String(VI_TRANSLATIONS[key as TranslationKey]).trim().length).toBeGreaterThan(0);
      expect(String(EN_TRANSLATIONS[key as TranslationKey]).trim().length).toBeGreaterThan(0);
    }
  });
});
