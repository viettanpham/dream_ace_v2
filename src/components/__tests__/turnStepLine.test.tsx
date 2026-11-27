// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { createDefaultAdminConfig, createFreshCampaignState } from '../../engine/migration';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit } from '../../types/game';
import { BattleScreen } from '../BattleScreen';
import { PhoneSkillsSheet } from '../PhoneSkillsSheet';
import { TurnStepLine } from '../TurnStepLine';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  return {
    id,
    name,
    callsign: name,
    side,
    row: 'front',
    formationCol: 0,
    isPlayer: false,
    classId: side === 'ally' ? 'striker' : 'interceptor',
    level: 10,
    skillLevel: 1,
    skillLevels: { gen_hull_brace: 1 },
    equippedSkillIds: ['gen_hull_brace'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 500,
      maxShield: 120,
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
    hp: 500,
    shield: 120,
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

function makeBattle(units: CombatUnit[], overrides: Partial<BattleState> = {}): BattleState {
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    turnOrder: units.map((u) => u.id),
    activeTurnIndex: 0,
    units,
    selectedTargetId: units.find((u) => u.side === 'enemy')?.id ?? null,
    selectedAllyTargetId: units[0]?.id ?? null,
    lastPlayerTargetId: units.find((u) => u.side === 'enemy')?.id ?? null,
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

describe('TASK TURN-PH-UI — TurnStepLine & used_this_turn UI', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1440,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 900,
    });
    const fresh = createFreshCampaignState('Pilot', 'striker', () => 0.5);
    useGameStore.setState({
      language: 'vi',
      screen: 'BATTLE',
      autoBattleEnabled: false,
      adminConfig: createDefaultAdminConfig(),
      pilot: fresh.pilot,
      battle: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    useGameStore.setState({ battle: null, autoBattleEnabled: false });
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1) renders used/max counts, turns step ② amber with tooltip at max, and uses compact action label', () => {
    act(() => {
      root.render(
        createElement(TurnStepLine, {
          supplyUsed: false,
          step2Used: 0,
          step2Max: 1,
        })
      );
    });

    let step2 = container.querySelector('[data-testid="turn-step-2"]');
    let step3 = container.querySelector('[data-testid="turn-step-3"]');
    expect(step2?.textContent).toContain('0/1');
    expect(step2?.getAttribute('data-full')).toBe('false');
    expect(step2?.getAttribute('title')).toBeNull();
    expect(step3?.textContent).toContain('Hành động');

    act(() => {
      root.render(
        createElement(TurnStepLine, {
          supplyUsed: false,
          step2Used: 1,
          step2Max: 1,
          compact: true,
        })
      );
    });

    step2 = container.querySelector('[data-testid="turn-step-2"]');
    step3 = container.querySelector('[data-testid="turn-step-3"]');
    expect(step2?.textContent).toContain('1/1');
    expect(step2?.getAttribute('data-full')).toBe('true');
    expect(step2?.className).toContain('text-amber-300');
    expect(step2?.getAttribute('title')).toBe('Buff tiếp theo tính là hành động chính');
    expect(step2?.getAttribute('aria-label')).toBe('Buff tiếp theo tính là hành động chính');
    expect(step3?.textContent).toContain('Đánh');
    expect(step3?.textContent).not.toContain('Hành động');
  });

  it('2) hides when step2Max === 0 and during autoBattle or enemy turn in BattleScreen', () => {
    act(() => {
      root.render(
        createElement(TurnStepLine, {
          supplyUsed: false,
          step2Used: 0,
          step2Max: 0,
        })
      );
    });
    expect(container.querySelector('[data-testid="turn-step-line"]')).toBeNull();

    const player = makeUnit('player_1', 'Vanguard', 'ally', { isPlayer: true });
    const enemy = makeUnit('enemy_1', 'Raider', 'enemy');

    useGameStore.setState({
      autoBattleEnabled: true,
      battle: makeBattle([player, enemy], { activeTurnIndex: 0 }),
    });
    act(() => {
      root.render(createElement(BattleScreen));
    });
    expect(container.querySelectorAll('[data-testid="turn-step-line"]').length).toBe(0);

    useGameStore.setState({
      autoBattleEnabled: false,
      battle: makeBattle([player, enemy], { activeTurnIndex: 1 }),
    });
    act(() => {
      root.render(createElement(BattleScreen));
    });
    expect(container.querySelectorAll('[data-testid="turn-step-line"]').length).toBe(0);
  });

  it('3) lights step ① when supplyUsed=true and shows "Đã dùng lượt này" on locked skills', () => {
    act(() => {
      root.render(
        createElement(TurnStepLine, {
          supplyUsed: true,
          step2Used: 0,
          step2Max: 1,
        })
      );
    });
    const step1 = container.querySelector('[data-testid="turn-step-1"]');
    expect(step1?.getAttribute('data-active')).toBe('true');
    expect(step1?.className).toContain('text-emerald-300');

    const player = makeUnit('player_1', 'Vanguard', 'ally', {
      isPlayer: true,
      equippedSkillIds: ['gen_hull_brace'],
    });
    const enemy = makeUnit('enemy_1', 'Raider', 'enemy');

    useGameStore.setState({
      autoBattleEnabled: false,
      battle: makeBattle([player, enemy], {
        activeTurnIndex: 0,
        turnStep2Used: 1,
        turnLockedSkillIds: ['gen_hull_brace'],
      }),
    });
    act(() => {
      root.render(createElement(BattleScreen));
    });
    const desktopReason = container.querySelector(
      '[data-testid="battle-skill-used-turn-gen_hull_brace"]'
    );
    expect(desktopReason?.textContent).toBe('Đã dùng lượt này');

    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate('vi', key, params);
    act(() => {
      root.render(
        createElement(PhoneSkillsSheet, {
          open: true,
          playerUnit: player,
          playerSkillIds: ['gen_hull_brace'],
          turnLockedSkillIds: ['gen_hull_brace'],
          canPlayerManualAct: true,
          lang: 'vi',
          t,
          onClose: () => {},
          onUseSkill: () => {},
        })
      );
    });
    expect(container.textContent).toContain('Đã dùng lượt này');
  });

  it('4) collapses to ① ② used/max ③ when width is below 340px', () => {
    const origGetRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 20,
        width: 320,
        height: 20,
        toJSON: () => ({}),
      } as DOMRect;
    };

    try {
      act(() => {
        root.render(
          createElement(TurnStepLine, {
            supplyUsed: false,
            step2Used: 0,
            step2Max: 1,
          })
        );
      });

      const line = container.querySelector('[data-testid="turn-step-line"]');
      expect(line?.getAttribute('data-collapsed')).toBe('true');
      expect(container.querySelector('[data-testid="turn-step-1"]')?.textContent?.trim()).toBe('①');
      expect(
        container.querySelector('[data-testid="turn-step-2"]')?.textContent?.replace(/\s+/g, ' ').trim()
      ).toBe('② 0/1');
      expect(container.querySelector('[data-testid="turn-step-3"]')?.textContent?.trim()).toBe('③');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = origGetRect;
    }
  });
});
