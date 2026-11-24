// @vitest-environment jsdom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleState, CombatUnit } from '../../types/game';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { sortTurnOrder } from '../../engine/combat';
import { useGameStore } from '../../store/useGameStore';
import {
  DEFAULT_FX_SETTINGS,
  FX_SETTINGS_STORAGE_KEY,
  readBattleEffectsMode,
  readFxSettings,
  resolveEffectiveVfxConfig,
  resolveReducedMotion,
  updateFxSettings,
} from '../../utils/battleVfx';
import { readShowStatusLabels } from '../../utils/combatLogFormat';
import { BattleRadarView } from '../BattleRadarView';
import { BattleUnitCard } from '../BattleUnitCard';
import { EffectsSettingsPanel } from '../EffectsSettingsPanel';
import { TopHud } from '../TopHud';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function mockReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  row: 'front' | 'middle' | 'back',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const alive = overrides.alive ?? true;
  const maxHp = 400;
  return {
    id,
    name,
    callsign: name,
    side,
    row,
    formationCol: 0,
    isPlayer: false,
    classId: 'striker',
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 120,
      maxSp: 60,
      speed: 60,
      attackPower: 45,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 30,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: alive ? maxHp : 0,
    shield: alive ? 80 : 0,
    sp: 40,
    isDefending: false,
    alive,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(
  units: CombatUnit[],
  overrides: Partial<BattleState> = {}
): BattleState {
  const turnOrder = sortTurnOrder(units);
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    turnOrder,
    activeTurnIndex: 0,
    units,
    selectedTargetId:
      units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null,
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
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
    ...overrides,
  };
}

describe('Task FX-fix2: Firefox reduced-motion resilience, dreamAce.fx.v2 storage, TopHud access, debug notice, and test preview', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    mockReducedMotion(false);
    useGameStore.setState({
      screen: 'HANGAR',
      language: 'vi',
      adminUnlocked: false,
      battleViewMode: 'radar',
      skipAnimations: false,
      battleSpeed: 1,
      battle: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    window.localStorage.clear();
  });

  it('ignores old localStorage keys (starfront_battle_effects_mode_v1 / starfront_show_status_labels_v1) and defaults to Full + Reduced Motion Off under dreamAce.fx.v2', () => {
    // Seed stale legacy keys from pre-FX-fix2 builds
    window.localStorage.setItem('starfront_battle_effects_mode_v1', 'off');
    window.localStorage.setItem('starfront_show_status_labels_v1', '0');

    expect(FX_SETTINGS_STORAGE_KEY).toBe('dreamAce.fx.v2');
    const settings = readFxSettings();
    expect(settings).toEqual(DEFAULT_FX_SETTINGS);
    expect(settings.effectsMode).toBe('full');
    expect(settings.reducedMotionMode).toBe('off');
    expect(settings.showStatusLabels).toBe(true);
    expect(settings.effectsDebug).toBe(false);

    expect(readBattleEffectsMode()).toBe('full');
    expect(readShowStatusLabels()).toBe(true);

    // Updating persists under dreamAce.fx.v2
    updateFxSettings({
      effectsMode: 'compact',
      reducedMotionMode: 'system',
      effectsDebug: true,
    });
    const raw = window.localStorage.getItem('dreamAce.fx.v2');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({
      effectsMode: 'compact',
      reducedMotionMode: 'system',
      effectsDebug: true,
    });
  });

  it('keeps full floating numbers, status popups, projectiles, and ambient sweep visible when OS reports prefers-reduced-motion: reduce and default setting (off) is active', () => {
    mockReducedMotion(true);

    expect(resolveReducedMotion('off', true)).toBe(false);
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('on', false)).toBe(true);

    const player = makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Raider 1', 'enemy', 'front', {
      animState: 'hit',
    });
    const battle = makeBattle([player, enemy], {
      fxEvents: [
        {
          id: 'fx_os_reduce_default',
          kind: 'missile',
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'p1',
          toSide: 'enemy',
          toSlotIndices: [0],
          toUnitIds: ['e1'],
          accentHex: '#38bdf8',
        },
      ],
      popups: [
        { id: 'pop_dmg', unitId: 'e1', text: '-190', tone: 'damage' },
        { id: 'pop_buff', unitId: 'p1', text: 'WPN +30%', tone: 'buff' },
      ],
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 1,
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const radarEl = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    );
    expect(radarEl?.getAttribute('data-reduced-motion')).toBe('false');

    const popups = container!.querySelectorAll('[data-testid="damage-popup"]');
    expect(popups.length).toBe(2);
    expect(container!.textContent).toContain('-190');
    expect(container!.textContent).toContain('WPN +30%');

    const fxEl = container!.querySelector(
      '[data-testid="radar-fx-fx_os_reduce_default"]'
    );
    expect(fxEl).not.toBeNull();
    expect(fxEl?.getAttribute('data-reduced-marker')).toBe('false');
    expect(
      container!.querySelector('[data-testid="radar-hit-flash-e1"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-sweep-layer"]')
    ).not.toBeNull();

    // Card view also keeps floating numbers visible when OS reduced-motion is true
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: enemy,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: false,
          popups: [{ id: 'pop_card_1', unitId: 'e1', text: '-145', tone: 'damage' }],
        })
      );
    });
    expect(
      container!
        .querySelector('[data-testid="unit-row-e1"]')
        ?.getAttribute('data-reduced-motion')
    ).toBe('false');
    expect(
      container!.querySelector('[data-testid="damage-popup"]')?.textContent
    ).toContain('-145');
  });

  it('never removes core combat feedback (damage/heal/status popups, hit flash, projectile marker) even when reduced motion resolves to true, while skipping decorative smoke particles and ambient sweep', () => {
    mockReducedMotion(true);
    const cfg = resolveEffectiveVfxConfig('full', 1, true, false);
    expect(cfg).toMatchObject({
      reducedMotion: true,
      showFloatingNumbers: true,
      showProjectiles: true,
      showMainImpactOrHeal: true,
      showStatusEffects: true,
      showDecorativeParticles: false,
      showAmbientSweep: false,
      animationsSkipped: false,
    });

    const player = makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Raider 1', 'enemy', 'front', {
      animState: 'hit',
    });
    const battle = makeBattle([player, enemy], {
      fxEvents: [
        {
          id: 'fx_missile_rm',
          kind: 'missile',
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'p1',
          toSide: 'enemy',
          toSlotIndices: [0],
          toUnitIds: ['e1'],
          accentHex: '#38bdf8',
        },
      ],
      popups: [
        { id: 'pop_rm_dmg', unitId: 'e1', text: '-210', tone: 'damage' },
        { id: 'pop_rm_heal', unitId: 'p1', text: '+95', tone: 'heal' },
      ],
    });

    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 1,
          reducedMotionMode: 'system',
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    expect(
      container!
        .querySelector('[data-testid="battle-radar-container"]')
        ?.getAttribute('data-reduced-motion')
    ).toBe('true');

    // Core combat feedback remains visible
    expect(
      container!.querySelectorAll('[data-testid="damage-popup"]').length
    ).toBe(2);
    expect(
      container!
        .querySelector('[data-testid="radar-fx-fx_missile_rm"]')
        ?.getAttribute('data-reduced-marker')
    ).toBe('true');
    expect(
      container!.querySelector('[data-testid="radar-hit-flash-e1"]')
    ).not.toBeNull();

    // Decorative smoke particles & ambient sweep are omitted
    expect(
      container!.querySelector('[data-testid="vfx-particle-smoke-fx_missile_rm-0"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-sweep-layer"]')
    ).toBeNull();

    // Card view also keeps popups when reducedMotionMode='on'
    updateFxSettings({ reducedMotionMode: 'on' });
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: enemy,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: false,
          popups: [{ id: 'pop_card_rm', unitId: 'e1', text: '-80', tone: 'damage' }],
        })
      );
    });
    expect(
      container!
        .querySelector('[data-testid="unit-row-e1"]')
        ?.getAttribute('data-reduced-motion')
    ).toBe('true');
    expect(
      container!.querySelector('[data-testid="damage-popup"]')?.textContent
    ).toContain('-80');
  });

  it('makes Effects settings reachable outside battle via TopHud settings button without Admin CP unlocked', () => {
    useGameStore.setState({
      screen: 'HANGAR',
      adminUnlocked: false,
      language: 'vi',
    });

    act(() => {
      root!.render(createElement(TopHud));
    });

    const settingsBtn = container!.querySelector(
      '[data-testid="tophud-settings-btn"]'
    ) as HTMLButtonElement;
    expect(settingsBtn).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="tophud-admin-btn"]')
    ).not.toBeNull();

    act(() => {
      settingsBtn.click();
    });

    // Effects settings controls are mounted inside the TopHud Settings sheet
    expect(
      document.body.querySelector('[data-testid="battle-effects-full"]')
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="effects-reduced-motion-system"]')
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="effects-reduced-motion-off"]')
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="effects-reduced-motion-on"]')
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="battle-toggle-status-labels"]')
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="battle-toggle-effects-debug"]')
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="effects-test-btn"]')
    ).not.toBeNull();
  });

  it('renders sample damage, projectile, hit flash, heal, and buff popup when clicking "Test hiệu ứng"', () => {
    act(() => {
      root!.render(createElement(EffectsSettingsPanel));
    });

    expect(
      container!.querySelector('[data-testid="effects-preview-box"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="effects-preview-stage"]')
    ).toBeNull();

    const testBtn = container!.querySelector(
      '[data-testid="effects-test-btn"]'
    ) as HTMLButtonElement;
    expect(testBtn).not.toBeNull();

    act(() => {
      testBtn.click();
    });

    expect(
      container!.querySelector('[data-testid="effects-preview-stage"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="preview-fx-projectile"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="preview-fx-hit"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="preview-fx-damage"]')?.textContent
    ).toContain('-245');
    expect(
      container!.querySelector('[data-testid="preview-fx-heal"]')?.textContent
    ).toContain('+180');
    expect(
      container!.querySelector('[data-testid="preview-fx-buff"]')?.textContent
    ).toContain('+ATK');

    // Switching Reduced Motion to ON still keeps sample damage/heal/buff/hit and renders reduced projectile marker
    const rmOnBtn = container!.querySelector(
      '[data-testid="effects-reduced-motion-on"]'
    ) as HTMLButtonElement;
    act(() => {
      rmOnBtn.click();
    });
    expect(
      container!
        .querySelector('[data-testid="preview-fx-projectile"]')
        ?.getAttribute('data-reduced-marker')
    ).toBe('true');
    expect(
      container!.querySelector('[data-testid="preview-fx-damage"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="preview-fx-heal"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="preview-fx-buff"]')
    ).not.toBeNull();
  });

  it('shows mode, resolved + OS reduced-motion, speed, and counts in Effects debug line, and auto-shows it for 3s at battle start when reduced-motion resolves to true', () => {
    vi.useFakeTimers();
    mockReducedMotion(true);

    const player = makeUnit('p1', 'ZARA', 'ally', 'front', { isPlayer: true });
    const enemy = makeUnit('e1', 'Raider 1', 'enemy', 'front');
    const battle = makeBattle([player, enemy], {
      turnCounter: 1,
      popups: [{ id: 'pop_dbg', unitId: 'e1', text: '-77', tone: 'damage' }],
    });

    // 1) Effects debug OFF, but reducedMotionMode='system' + OS reduce -> auto-shows for 3s at battle start
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 3,
          effectsMode: 'full',
          reducedMotionMode: 'system',
          effectsDebugEnabled: false,
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const autoBanner = container!.querySelector(
      '[data-testid="radar-effects-debug-counter"]'
    );
    expect(autoBanner).not.toBeNull();
    expect(autoBanner?.getAttribute('data-auto-notice')).toBe('true');
    expect(autoBanner?.getAttribute('data-mode')).toBe('full');
    expect(autoBanner?.getAttribute('data-reduced-resolved')).toBe('true');
    expect(autoBanner?.getAttribute('data-reduced-os')).toBe('true');
    expect(autoBanner?.getAttribute('data-speed')).toBe('3');
    expect(autoBanner?.textContent).toContain('FX full');
    expect(autoBanner?.textContent).toContain('RM:ON(OS:reduce)');
    expect(autoBanner?.textContent).toContain('3x');

    // Disappears automatically after 3000ms
    act(() => {
      vi.advanceTimersByTime(3050);
    });
    expect(
      container!.querySelector('[data-testid="radar-effects-debug-counter"]')
    ).toBeNull();

    // 2) When Effects debug is explicitly enabled, line stays visible with resolved RM:OFF even when OS:reduce
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: false,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: false,
          battleSpeed: 5,
          effectsMode: 'compact',
          reducedMotionMode: 'off',
          effectsDebugEnabled: true,
          layoutMode: 'pc',
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const debugLine = container!.querySelector(
      '[data-testid="radar-effects-debug-counter"]'
    );
    expect(debugLine).not.toBeNull();
    expect(debugLine?.getAttribute('data-mode')).toBe('compact');
    expect(debugLine?.getAttribute('data-reduced-resolved')).toBe('false');
    expect(debugLine?.getAttribute('data-reduced-os')).toBe('true');
    expect(debugLine?.getAttribute('data-speed')).toBe('5');
    expect(debugLine?.textContent).toContain('FX compact');
    expect(debugLine?.textContent).toContain('RM:OFF(OS:reduce)');
    expect(debugLine?.textContent).toContain('5x');
  });
});
