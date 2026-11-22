// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getSkillName, translate } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import type { CombatUnit, Language } from '../../types/game';
import { PhoneSkillsSheet } from '../PhoneSkillsSheet';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makePlayerUnit(overrides: Partial<CombatUnit> = {}): CombatUnit {
  return {
    id: 'player_1',
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
    sp: 100,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...overrides,
  };
}

describe('PhoneSkillsSheet (RF-BS2)', () => {
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

  it('renders open/closed states and invokes onUseSkill + onClose when clicking an active skill', () => {
    const lang: Language = 'vi';
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(lang, key, params);
    const unit = makePlayerUnit();
    const onClose = vi.fn();
    const onUseSkill = vi.fn();

    act(() => {
      root.render(
        createElement(PhoneSkillsSheet, {
          open: false,
          playerUnit: unit,
          playerSkillIds: unit.equippedSkillIds,
          canPlayerManualAct: true,
          lang,
          t,
          onClose,
          onUseSkill,
        })
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      root.render(
        createElement(PhoneSkillsSheet, {
          open: true,
          playerUnit: unit,
          playerSkillIds: unit.equippedSkillIds,
          canPlayerManualAct: true,
          lang,
          t,
          onClose,
          onUseSkill,
        })
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(t('battle.skillsSheetTitle'));

    const skillName = getSkillName(lang, 'gen_hull_brace');
    const skillBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).find((btn) => btn.textContent?.includes(skillName));
    expect(skillBtn).toBeDefined();
    expect(skillBtn?.disabled).toBe(false);

    act(() => {
      skillBtn?.click();
    });
    expect(onUseSkill).toHaveBeenCalledWith('gen_hull_brace');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
