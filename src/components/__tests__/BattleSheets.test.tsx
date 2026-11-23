// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import type { CombatUnit, Language } from '../../types/game';
import { BattleSheets } from '../BattleSheets';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'ally_1',
    name: 'Vanguard-01',
    callsign: 'Vanguard-01',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    isPlayer: true,
    classId: 'striker',
    isBoss: false,
    level: 5,
    skillLevel: 1,
    skillLevels: { gen_hull_brace: 1 },
    equippedSkillIds: ['gen_hull_brace'],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 900,
      maxShield: 220,
      maxSp: 100,
      speed: 55,
      attackPower: 120,
      defenseRating: 50,
      dodgeChance: 10,
      critChance: 15,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    hp: 900,
    shield: 220,
    sp: 80,
    isDefending: false,
    alive: true,
    statuses: [
      {
        type: 'def_up',
        turnsRemaining: 2,
        isDebuff: false,
        magnitude: 0.3,
      },
    ],
    animState: 'idle',
    ...overrides,
  };
}

describe('BattleSheets (SB3-RF1)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders phone unit detail sheet and combat log popup sheet with expected testids', () => {
    const lang: Language = 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);

    const unit = makeUnit();
    const onClosePhoneSheet = vi.fn();
    const onCloseLogSheet = vi.fn();

    act(() => {
      root.render(
        createElement(BattleSheets, {
          phoneSheetUnit: unit,
          phoneUnitSheetId: unit.id,
          selectedTargetId: null,
          selectedAllyTargetId: unit.id,
          hasSingleAllySkill: true,
          canPlayerManualAct: true,
          validBasicTargetIds: new Set<string>(),
          onClosePhoneSheet,
          onLockEnemy: vi.fn(),
          onLockAlly: vi.fn(),
          logSheetOpen: true,
          entries: [],
          units: [unit],
          logChannel: 'all',
          logExpandAll: false,
          logExpandNonce: 0,
          expandButtons: null,
          t,
          onCloseLogSheet,
          onLogChannelChange: vi.fn(),
          onReloadBattle: vi.fn(),
        })
      );
    });

    expect(
      container.querySelector('[data-testid="detail-status-def_up"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="combat-log-popup"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="combat-log-popup-dock-btn"]')
    ).not.toBeNull();

    const closeBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="combat-log-popup-close"]'
    );
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn?.click();
    });
    expect(onCloseLogSheet).toHaveBeenCalledTimes(1);
  });
});
