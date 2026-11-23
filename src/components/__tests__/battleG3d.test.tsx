// @vitest-environment jsdom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { WINGMAN_CHAT_KEYS } from '../../data/pilots';
import { sortTurnOrder } from '../../engine/combat';
import {
  formatMissingTranslationFallback,
  formatStatusEffectDetail,
  translate,
} from '../../i18n';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
type TranslationKey = keyof typeof VI_TRANSLATIONS;
import { useGameStore } from '../../store/useGameStore';
import type {
  BattleState,
  CombatLogEntry,
  CombatUnit,
} from '../../types/game';
import { parseStructuredCombatLogRow } from '../../utils/combatLogFormat';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { BattleUnitCard } from '../BattleUnitCard';
import { CombatLogList } from '../CombatLogList';
import { TurnQueueBar } from '../TurnQueueBar';
import { UnitDetailSheet } from '../UnitDetailSheet';

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  opts?: {
    isPlayer?: boolean;
    isBoss?: boolean;
    alive?: boolean;
    hp?: number;
    maxHp?: number;
    shield?: number;
    maxShield?: number;
    sp?: number;
    maxSp?: number;
    speed?: number;
    row?: 'front' | 'middle' | 'back';
    classId?: 'interceptor' | 'striker' | 'siege' | 'support';
    statuses?: CombatUnit['statuses'];
    equippedSkillIds?: string[];
  }
): CombatUnit {
  const maxHp = opts?.maxHp ?? 930;
  const maxShield = opts?.maxShield ?? 250;
  const maxSp = opts?.maxSp ?? 80;
  const alive = opts?.alive ?? true;
  return {
    id,
    name,
    callsign: name,
    side,
    row: opts?.row ?? 'front',
    formationCol: 0,
    isPlayer: Boolean(opts?.isPlayer),
    classId: opts?.classId ?? (side === 'ally' ? 'striker' : 'interceptor'),
    isBoss: Boolean(opts?.isBoss),
    level: 10,
    skillLevel: 1,
    skillLevels: {
      rail_snipe: 1,
      shield_recharge: 1,
      aegis_lock: 1,
    },
    equippedSkillIds: opts?.equippedSkillIds ?? [
      'rail_snipe',
      'shield_recharge',
    ],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield,
      maxSp,
      speed: opts?.speed ?? 60,
      attackPower: 140,
      defenseRating: 60,
      dodgeChance: 12,
      critChance: 20,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    hp: alive ? opts?.hp ?? maxHp : 0,
    shield: alive ? opts?.shield ?? maxShield : 0,
    sp: opts?.sp ?? maxSp,
    isDefending: false,
    alive,
    statuses: opts?.statuses ?? [],
    animState: 'idle',
  };
}

function makeBattle(overrides?: Partial<BattleState>): BattleState {
  const player = makeUnit('u_player', 'Kaelen', 'ally', {
    isPlayer: true,
    hp: 620,
    maxHp: 930,
    shield: 180,
    maxShield: 250,
    sp: 55,
    maxSp: 80,
    speed: 82,
    statuses: [
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
      { type: 'regen_hp', turnsRemaining: 2, isDebuff: false, magnitude: 0.1 },
    ],
  });
  const ally = makeUnit('u_ally', 'Marek', 'ally', {
    row: 'middle',
    classId: 'siege',
    hp: 800,
    maxHp: 930,
    shield: 120,
    speed: 68,
  });
  const enemy = makeUnit('u_enemy', 'Solar Void Sniper', 'enemy', {
    row: 'front',
    classId: 'interceptor',
    hp: 540,
    maxHp: 930,
    shield: 0,
    speed: 74,
    statuses: [
      { type: 'shield_break', turnsRemaining: 2, isDebuff: true },
      { type: 'def_down', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
    ],
  });

  const units = overrides?.units ?? [player, ally, enemy];
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 2,
    turnCounter: 4,
    turnOrder: sortTurnOrder(units),
    activeTurnIndex: 0,
    units,
    selectedTargetId: enemy.id,
    selectedAllyTargetId: null,
    lastPlayerTargetId: null,
    autoStopNotice: null,
    wingmanChat: null,
    log: [
      {
        id: 'r1_1',
        round: 1,
        actorName: 'Kaelen',
        actorSide: 'ally',
        actorIsPlayer: true,
        tag: 'ATTACK',
        templateKey: 'log.evade',
        params: {
          actor: 'Kaelen',
          target: 'Solar Void Sniper',
          skillId: '',
        },
      },
      {
        id: 'r1_2',
        round: 1,
        actorName: 'Marek',
        actorSide: 'ally',
        tag: 'ATTACK',
        templateKey: 'log.damage',
        params: {
          actor: 'Marek',
          target: 'Solar Void Sniper',
          action: 'basic',
          damage: 302,
          shieldAbsorbed: 279,
          hullDamage: 23,
          isCrit: 0,
        },
      },
      {
        id: 'r2_1',
        round: 2,
        actorName: 'Lyra',
        actorSide: 'ally',
        tag: 'STATUS',
        templateKey: 'log.buffApplied',
        params: {
          actor: 'Lyra',
          target: 'Solar Void Sniper',
          skillId: 'aegis_lock',
          spCost: 18,
        },
      },
      {
        id: 'r2_2',
        round: 2,
        actorName: 'Solar Void Sniper',
        actorSide: 'enemy',
        tag: 'HEAL',
        templateKey: 'log.regenTick',
        params: {
          target: 'Solar Void Sniper',
          amount: 93,
        },
      },
    ],
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

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Task G3d — i18n audit, detailed status chips, readable combat log, player bar & layout stability', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    setViewport(1280, 800);
    useGameStore.setState({
      language: 'vi',
      screen: 'BATTLE',
      battleSpeed: 1,
      skipAnimations: false,
      autoBattleEnabled: false,
      adminConfig: {
        ...useGameStore.getState().adminConfig,
        showRawI18nKeys: false,
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('1) i18n audit: every chat.* key exists in VI & EN and missing keys render a readable fallback instead of raw key', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).filter((k) =>
      k.startsWith('chat.')
    );
    const enKeys = Object.keys(EN_TRANSLATIONS).filter((k) =>
      k.startsWith('chat.')
    );
    const allChatKeys = new Set([
      ...WINGMAN_CHAT_KEYS,
      ...viKeys,
      ...enKeys,
    ]);

    expect(allChatKeys.has('chat.shieldsHolding')).toBe(true);

    for (const k of allChatKeys) {
      const viVal = (VI_TRANSLATIONS as Record<string, string>)[k];
      const enVal = (EN_TRANSLATIONS as Record<string, string>)[k];
      expect(viVal, `Missing VI translation for ${k}`).toBeTruthy();
      expect(enVal, `Missing EN translation for ${k}`).toBeTruthy();
      expect(viVal).not.toBe(k);
      expect(enVal).not.toBe(k);
    }

    expect(
      translate('vi', 'chat.shieldsHolding' as TranslationKey)
    ).not.toBe('chat.shieldsHolding');
    expect(
      translate('en', 'chat.shieldsHolding' as TranslationKey)
    ).toBe('Shields are holding — hold formation!');

    // Fallback formatter never leaks raw dotted key string
    expect(formatMissingTranslationFallback('chat.shieldsHolding')).toBe(
      'Shields Holding'
    );
    expect(
      translate('en', 'chat.unknownFakeKey' as TranslationKey)
    ).toBe('Unknown Fake Key');
  });

  it('2) Status chips display real engine values in Card view, UnitDetailSheet, and Radar hover/tap tooltip', () => {
    const unit = makeUnit('u_status', 'Vanguard', 'ally', {
      maxHp: 930,
      statuses: [
        { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
        { type: 'regen_hp', turnsRemaining: 2, isDebuff: false, magnitude: 0.1 },
        { type: 'shield_break', turnsRemaining: 2, isDebuff: true },
        { type: 'def_down', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
      ],
    });

    const slowDetail = formatStatusEffectDetail('vi', unit.statuses[0], unit);
    const regenDetail = formatStatusEffectDetail('vi', unit.statuses[1], unit);
    const shieldBreakDetail = formatStatusEffectDetail(
      'vi',
      unit.statuses[2],
      unit
    );
    const defDownDetail = formatStatusEffectDetail('vi', unit.statuses[3], unit);

    expect(slowDetail.fullText).toBe('Làm chậm: -30% Tốc (2 lượt)');
    expect(regenDetail.fullText).toBe('Hồi Phục HP: +93/lượt (2 lượt)');
    expect(shieldBreakDetail.fullText).toBe('Vỡ Khiên: Khóa Khiên (2 lượt)');
    expect(defDownDetail.fullText).toBe('Giảm Giáp: -30% Giáp (2 lượt)');

    // Card view shows compact StatusChip value text ONLY (no effect names or "(N lượt)")
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: true,
          popups: [],
          showStatusLabels: true,
        })
      );
    });
    expect(container!.textContent).toContain('-30% Tốc');
    expect(container!.textContent).toContain('+93 HP/lượt');
    expect(container!.textContent).not.toContain('Làm chậm:');
    expect(container!.textContent).not.toContain('(2 lượt)');

    // UnitDetailSheet shows full value text
    act(() => {
      root!.render(
        createElement(UnitDetailSheet, {
          unit,
          onClose: () => {},
          isTargeted: false,
          canLockEnemy: false,
          canLockAlly: false,
        })
      );
    });
    expect(
      container!.querySelector('[data-testid="detail-status-slow"]')
        ?.textContent
    ).toContain('Làm chậm: -30% Tốc (2 lượt)');
    expect(
      container!.querySelector('[data-testid="detail-status-regen_hp"]')
        ?.textContent
    ).toContain('Hồi Phục HP: +93/lượt (2 lượt)');

    // Radar marker keeps short label AND hovering/tapping opens tooltip with full engine text
    const battle = makeBattle({
      units: [
        unit,
        makeUnit('u_enemy_1', 'Enemy 1', 'enemy', { row: 'front' }),
      ],
    });
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: unit.id,
          validBasicTargetIds: new Set(['u_enemy_1']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          battleSpeed: 1,
          skipAnimations: true,
          autoBattleEnabled: false,
          onSelectEnemy: () => {},
          onSelectAlly: () => {},
          onInspectUnit: () => {},
        })
      );
    });

    const slowChip = container!.querySelector(
      '[data-testid^="radar-status-icon-u_status-"][data-status-type="slow"]'
    ) as SVGGElement;
    expect(slowChip).not.toBeNull();
    // Radar chip stays compact with Material Symbol catalog icon (no full name on radar)
    expect(slowChip.getAttribute('data-status-symbol')).toBe('ac_unit');
    const visibleForeignText =
      slowChip.querySelector('foreignObject')?.textContent ?? '';
    expect(visibleForeignText).toContain('ac_unit');
    expect(visibleForeignText).not.toContain('Làm chậm:');
    expect(
      container!.querySelector('[data-testid="radar-status-label-u_status-2"]')
    ).toBeNull();

    // Native title / aria-label still carries the full engine detail without radar overlay tooltip
    const unitMarker = container!.querySelector(
      `[data-testid="radar-unit-${unit.id}"]`
    );
    expect(unitMarker?.getAttribute('aria-label')).toContain('Làm chậm: -30% Tốc');
    expect(unitMarker?.getAttribute('aria-label')).toContain('Còn 2 vòng');
    expect(
      container!.querySelector('[data-testid="radar-status-tooltip"]')
    ).toBeNull();
  });

  it('3) CombatLogList groups by collapsible Vòng N, formats natural sentences + dim SP tags + avatars + strong highlights', () => {
    const battle = makeBattle();
    const entries: CombatLogEntry[] = [
      ...battle.log,
      {
        id: 'r2_3',
        round: 2,
        actorName: 'Lyra',
        actorSide: 'ally',
        tag: 'STATUS',
        templateKey: 'log.statusApplied',
        params: {
          target: 'Lyra',
          status: 'shield_break',
          turns: 2,
        },
      },
      {
        id: 'r2_4',
        round: 2,
        actorName: 'Kaelen',
        actorSide: 'ally',
        actorIsPlayer: true,
        tag: 'KO',
        templateKey: 'log.destroyed',
        params: {
          target: 'Solar Void Sniper',
          classId: 'interceptor',
        },
      },
    ];

    // Check natural VI sentence formatting directly
    const missRow = parseStructuredCombatLogRow('vi', entries[0], battle.units);
    expect(missRow.sentence).toBe(
      'Kaelen bắn Pháo Chính vào Solar Void Sniper, bị né'
    );
    const dmgRow = parseStructuredCombatLogRow('vi', entries[1], battle.units);
    expect(dmgRow.sentence).toContain('gây 302 sát thương');
    expect(dmgRow.sentence).toContain('khiên -279');
    expect(dmgRow.sentence).toContain('HP -23');

    const skillRow = parseStructuredCombatLogRow(
      'vi',
      entries[2],
      battle.units
    );
    expect(skillRow.spCost).toBe(18);
    expect(skillRow.sentence).toContain('Lyra dùng');

    const regenRow = parseStructuredCombatLogRow(
      'vi',
      entries[3],
      battle.units
    );
    expect(regenRow.sentence).toBe('Solar Void Sniper tự hồi 93 HP');

    // Render CombatLogList and verify round collapsing + UI details
    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries,
          units: battle.units,
          active: true,
          mode: 'docked',
        })
      );
    });

    const round1Header = container!.querySelector(
      '[data-testid="combat-log-round-header-1"]'
    ) as HTMLButtonElement;
    const round2Header = container!.querySelector(
      '[data-testid="combat-log-round-header-2"]'
    ) as HTMLButtonElement;
    expect(round1Header).not.toBeNull();
    expect(round2Header).not.toBeNull();
    expect(round1Header.textContent).toContain('Vòng 1');
    expect(round2Header.textContent).toContain('Vòng 2');

    // Both Vòng 1 & Vòng 2 are within the 3 newest rounds -> open by default (G4a-2d)
    expect(round1Header.getAttribute('aria-expanded')).toBe('true');
    expect(round2Header.getAttribute('aria-expanded')).toBe('true');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-body-1"]')
        ?.className.includes('hidden')
    ).toBe(false);
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-body-2"]')
        ?.className.includes('hidden')
    ).toBe(false);

    // Clicking Vòng 1 toggles it collapsed, clicking again expands it
    act(() => {
      round1Header.click();
    });
    expect(round1Header.getAttribute('aria-expanded')).toBe('false');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-body-1"]')
        ?.className.includes('hidden')
    ).toBe(true);
    act(() => {
      round1Header.click();
    });
    expect(round1Header.getAttribute('aria-expanded')).toBe('true');
    expect(
      container!
        .querySelector('[data-testid="combat-log-round-body-1"]')
        ?.className.includes('hidden')
    ).toBe(false);

    // Dim SP cost badge rendered separately
    const spBadge = container!.querySelector(
      '[data-testid="combat-log-sp-cost"]'
    );
    expect(spBadge).not.toBeNull();
    expect(spBadge!.textContent).toBe('-18 SP');

    // Avatars: pilot vs NPC + strong event markers
    const avatars = Array.from(
      container!.querySelectorAll('[data-testid="combat-log-avatar"]')
    ).map((el) => el.getAttribute('data-avatar-type'));
    expect(avatars).toContain('pilot');
    expect(avatars).toContain('npc');

    const strongRows = container!.querySelectorAll(
      '[data-testid="combat-log-entry"][data-strong="true"]'
    );
    expect(strongRows.length).toBeGreaterThanOrEqual(2);
  });

  it('4) Player status bar renders under force-ratio bar, shows HP+Shield overlay + SP + destroyed gray state + 1-row phone collapse', () => {
    const battle = makeBattle();
    useGameStore.setState({ battle });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const forceBar = container!.querySelector(
      '[data-testid="battle-force-ratio-bar"]'
    ) as HTMLElement;
    const playerBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(forceBar).not.toBeNull();
    expect(playerBar).not.toBeNull();
    expect(forceBar.nextElementSibling).toBe(playerBar);
    expect(playerBar.getAttribute('data-collapsed')).toBe('false');
    expect(playerBar.getAttribute('data-destroyed')).toBe('false');

    // Combined HP + Shield overlay bar + thin SP bar + numbers + status effects
    expect(
      playerBar.querySelector('[data-testid="battle-player-hp-fill"]')
    ).not.toBeNull();
    expect(
      playerBar.querySelector('[data-testid="battle-player-shield-overlay"]')
    ).not.toBeNull();
    expect(
      playerBar.querySelector('[data-testid="battle-player-sp-bar"]')
    ).not.toBeNull();
    expect(
      playerBar.querySelector('[data-testid="battle-player-hp-numbers"]')
        ?.textContent
    ).toContain('620/930');
    expect(
      playerBar.querySelector('[data-testid="battle-player-shield-numbers"]')
        ?.textContent
    ).toContain('180/250');
    expect(
      playerBar.querySelector('[data-testid="battle-player-sp-numbers"]')
        ?.textContent
    ).toContain('55/80');
    expect(
      playerBar.querySelector('[data-testid="battle-player-status-effects"]')
        ?.textContent
    ).toContain('-30% Tốc');

    // Destroyed state turns gray with "Đã phát nổ"
    const destroyedPlayer = makeUnit('u_player', 'Kaelen', 'ally', {
      isPlayer: true,
      alive: false,
      hp: 0,
      shield: 0,
      sp: 0,
    });
    const deadBattle = makeBattle({
      units: [
        destroyedPlayer,
        battle.units[1],
        battle.units[2],
      ],
    });
    act(() => {
      useGameStore.setState({ battle: deadBattle });
    });

    const deadBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(deadBar.getAttribute('data-destroyed')).toBe('true');
    expect(deadBar.className).toContain('grayscale');
    expect(
      deadBar.querySelector('[data-testid="battle-player-destroyed-badge"]')
        ?.textContent
    ).toBe('Đã phát nổ');

    // Phone portrait collapses to one compact row
    act(() => {
      setViewport(390, 844);
      useGameStore.setState({ battle });
    });
    const phoneBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    expect(phoneBar).not.toBeNull();
    expect(phoneBar.getAttribute('data-collapsed')).toBe('true');
  });

  it('5) Layout stability: TurnQueueBar sidebar renders only populated rows (no empty slots), selected-unit panel & phone log never reserve empty height', () => {
    const slimBattle = makeBattle({
      units: [
        makeUnit('u_p', 'Kaelen', 'ally', { isPlayer: true, speed: 80 }),
        makeUnit('u_e', 'Enemy', 'enemy', { speed: 60 }),
      ],
    });

    act(() => {
      root!.render(
        createElement(TurnQueueBar, {
          battle: slimBattle,
          battleSpeed: 1,
          skipAnimations: false,
          enrageBonusPct: 0,
          variant: 'sidebar',
        })
      );
    });

    const populated = container!.querySelectorAll(
      '[data-testid="turn-queue-sidebar-chip"]'
    );
    const emptySlots = container!.querySelectorAll(
      '[data-testid="turn-queue-sidebar-slot-empty"]'
    );
    expect(populated.length).toBe(3);
    expect(emptySlots.length).toBe(0);

    // Selected-unit panel uses content height (no fixed h-[244px])
    act(() => {
      useGameStore.setState({ battle: slimBattle });
      root!.render(createElement(BattleScreen));
    });
    const selectedPanel = container!.querySelector(
      '[data-testid="battle-selected-unit-panel"]'
    ) as HTMLElement;
    expect(selectedPanel.className).not.toContain('h-[244px]');

    // Phone docked log flows inside page scroll (no fixed h-[144px] or overflow-y-auto)
    act(() => {
      setViewport(390, 844);
    });
    const phoneDockedLog = container!.querySelector(
      '[data-testid="battle-phone-docked-log"]'
    ) as HTMLElement;
    expect(phoneDockedLog.className).not.toContain('h-[144px]');
    expect(phoneDockedLog.querySelector('.overflow-y-auto')).toBeNull();
  });
});
