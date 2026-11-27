// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleUnitCard } from '../../components/BattleUnitCard';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getCatalogRow } from '../../data/iconCatalog';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit, FloatingPopup } from '../../types/game';
import {
  CARD_POPUP_INSET_PX,
  estimatePopupBoxSize,
  getCardPopupSymbol,
  parseCardPopupDisplay,
  pickCardPopupEndPoint,
} from '../cardPopupQueue';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(id = 'a1'): CombatUnit {
  return {
    id,
    name: 'Vanguard',
    callsign: 'A1',
    side: 'ally',
    row: 'front',
    formationCol: 0,
    isPlayer: true,
    classId: 'striker',
    isBoss: false,
    level: 10,
    skillLevel: 1,
    skillLevels: {},
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 600,
      maxShield: 200,
      maxSp: 100,
      speed: 100,
      attackPower: 80,
      defenseRating: 50,
      dodgeChance: 10,
      critChance: 15,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
    },
    alive: true,
    hp: 600,
    shield: 200,
    sp: 50,
    isDefending: false,
    statuses: [],
    animState: 'idle',
  };
}

describe('TASK POP-ICON2 — localized floating popups with leading + optional trailing icons', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState((s) => ({
      adminConfig: {
        ...s.adminConfig,
        cardPopupStaggerMs: 0,
        cardPopupMaxConcurrent: 8,
      },
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
  });

  it('1) formats leading+trailing segments for CRIT SHD, EVADED, COUNTER READY, supply +120 SP, and updated catalog rows', () => {
    expect(getCatalogRow('SS02')?.symbol).toBe('water_drop');
    expect(getCatalogRow('BF11')?.symbol).toBe('water_drop');
    expect(getCatalogRow('DT03')?.symbol).toBe('bubble_chart');
    expect(getCatalogRow('DT03')?.kind).toBe('debuff');

    const critShd = parseCardPopupDisplay({ tone: 'crit', text: 'CRIT SHD -242' });
    expect(critShd.segments).toHaveLength(1);
    expect(critShd.segments[0].iconKind).toBe('shield');
    expect(critShd.segments[0].text).toBe('-242');
    expect(critShd.segments[0].trailingIconKind).toBe('splash');
    expect(getCardPopupSymbol('splash')).toBe('explosion');

    const critHull = parseCardPopupDisplay({ tone: 'crit', text: 'CRIT -242' });
    expect(critHull.segments[0].iconKind).toBe('hp_hull');
    expect(getCardPopupSymbol('hp_hull')).toBe('health_cross');
    expect(critHull.segments[0].trailingIconKind).toBe('splash');

    const evaded = parseCardPopupDisplay({ tone: 'evade', text: 'EVADED' });
    expect(evaded.segments[0].text).toBe('NÉ');
    expect(evaded.segments[0].iconKind).toBe('eva');
    expect(evaded.segments[0].trailingIconKind).toBe('eva');
    expect(getCardPopupSymbol('eva')).toBe('air');

    const counterReady = parseCardPopupDisplay({ tone: 'buff', text: 'COUNTER READY' });
    expect(counterReady.segments[0].text).toBe('TƯ THẾ PHẢN ĐÒN');
    expect(counterReady.segments[0].iconKind).toBe('counter');
    expect(counterReady.segments[0].trailingIconKind).toBe('active');
    expect(getCardPopupSymbol('counter')).toBe('undo');
    expect(getCardPopupSymbol('active')).toBe('check_circle');

    const counterHit = parseCardPopupDisplay({ tone: 'buff', text: 'COUNTER!' });
    expect(counterHit.segments[0].text).toBe('PHẢN ĐÒN');
    expect(counterHit.segments[0].iconKind).toBe('counter');
    expect(counterHit.segments[0].trailingIconKind).toBe('flash');
    expect(getCardPopupSymbol('flash')).toBe('flash_on');

    const supplySp = parseCardPopupDisplay({
      id: 'pop_sup_sp_1',
      tone: 'buff',
      text: '+120 SP',
    });
    expect(supplySp.segments[0].iconKind).toBe('sp');
    expect(getCardPopupSymbol('sp')).toBe('water_drop');
    expect(supplySp.segments[0].text).toBe('+120');
    expect(supplySp.segments[0].trailingIconKind).toBe('supply');
    expect(supplySp.segments[0].trailingSmall).toBe(true);
    expect(getCardPopupSymbol('supply')).toBe('package_2');

    const nonSupplySp = parseCardPopupDisplay({ id: 'pop_regen', tone: 'buff', text: '+120 SP' });
    expect(nonSupplySp.segments[0].trailingIconKind).toBeUndefined();
  });

  it('2) toggle skills pick check_circle vs cancel, statuses/both-side rows map cleanly, and BattleUnitCard renders trailing icon', () => {
    const siegeOn = parseCardPopupDisplay({ tone: 'buff', text: 'SIEGE ON' });
    const siegeOff = parseCardPopupDisplay({ tone: 'buff', text: 'SIEGE OFF' });
    expect(siegeOn.arrow).toBeNull();
    expect(siegeOn.segments[0]).toMatchObject({
      iconKind: 'anchor',
      text: 'NEO PHÁO',
      trailingIconKind: 'active',
    });
    expect(siegeOff.segments[0]).toMatchObject({
      iconKind: 'anchor',
      text: 'NEO PHÁO',
      trailingIconKind: 'inactive',
    });

    const fortOn = parseCardPopupDisplay({ tone: 'buff', text: 'FORTRESS ON' });
    const fortOff = parseCardPopupDisplay({ tone: 'buff', text: 'FORTRESS OFF' });
    expect(fortOn.segments[0].iconKind).toBe('fort');
    expect(getCardPopupSymbol('fort')).toBe('fort');
    expect(fortOn.segments[0].trailingIconKind).toBe('active');
    expect(fortOff.segments[0].trailingIconKind).toBe('inactive');
    expect(getCardPopupSymbol('inactive')).toBe('cancel');

    const atk = parseCardPopupDisplay({ tone: 'buff', text: 'ATK +25%' });
    expect(atk.segments[0]).toMatchObject({ iconKind: 'wpn', text: 'ATK +25%' });

    const bothRows: Array<[string, FloatingPopup['tone'], string, string]> = [
      ['CHARGING...', 'buff', 'ĐANG NẠP', 'bolt_boost'],
      ['PURIFIED', 'buff', 'THANH TẨY', 'cleaning_services'],
      ['FULL RECOVERY', 'heal', 'HỒI PHỤC HOÀN TOÀN', 'health_cross'],
      ['BARREL ROLL', 'evade', 'LƯỢN VÒNG', 'air'],
    ];
    for (const [text, tone, viText, symbol] of bothRows) {
      const p = parseCardPopupDisplay({ tone, text });
      expect(p.segments[0].text).toBe(viText);
      expect(getCardPopupSymbol(p.segments[0].iconKind!)).toBe(symbol);
      expect(getCardPopupSymbol(p.segments[0].trailingIconKind!)).toBe(symbol);
    }

    const popups: FloatingPopup[] = [
      { id: 'p_siege', unitId: 'a1', text: 'SIEGE ON', tone: 'buff' },
      { id: 'pop_sup_sp_2', unitId: 'a1', text: '+120 SP', tone: 'buff' },
    ];
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: makeUnit('a1'),
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: false,
          popups,
          onSelect: vi.fn(),
          onInspect: vi.fn(),
        })
      );
    });
    const nodes = container!.querySelectorAll('[data-testid="damage-popup"]');
    expect(nodes).toHaveLength(2);
    expect(nodes[0].textContent).toContain('NEO PHÁO');
    expect(
      nodes[0].querySelector('[data-popup-icon-role="trailing"]')?.textContent
    ).toBe('check_circle');
    expect(
      nodes[1].querySelector('[data-popup-icon-role="trailing"]')?.textContent
    ).toBe('package_2');
  });

  it('3) plain "-120", "GOD 0", and "INVINCIBLE" stay unchanged', () => {
    const plain = parseCardPopupDisplay({ tone: 'damage', text: '-120' });
    expect(plain.segments).toEqual([{ iconKind: 'hp', text: '-120' }]);
    expect(getCardPopupSymbol('hp')).toBe('swords');

    const god = parseCardPopupDisplay({ tone: 'shield', text: 'GOD 0' });
    expect(god.segments).toEqual([{ iconKind: null, text: 'GOD 0' }]);

    const inv = parseCardPopupDisplay({ tone: 'shield', text: 'INVINCIBLE' });
    expect(inv.segments).toEqual([{ iconKind: null, text: 'INVINCIBLE' }]);
  });

  it('4) estimatePopupBoxSize counts both icons (+22px each) and keeps longest text unclipped in 160px/280px cards', () => {
    const oneIcon = estimatePopupBoxSize({ tone: 'damage', text: 'SHD -242' });
    const twoIcon = estimatePopupBoxSize({ tone: 'crit', text: 'CRIT SHD -242' });
    expect(twoIcon.width).toBeGreaterThan(oneIcon.width);

    const longest: Pick<FloatingPopup, 'tone' | 'text'> = {
      tone: 'heal',
      text: 'FULL RECOVERY',
    };
    const longestBox = estimatePopupBoxSize(longest, 'vi');
    const end280 = pickCardPopupEndPoint(
      { widthPct: 85, heightPct: 65 },
      280,
      140,
      [],
      longestBox,
      () => 0.99
    );
    expect(end280.x - longestBox.width / 2).toBeGreaterThanOrEqual(
      CARD_POPUP_INSET_PX - 0.01
    );
    expect(end280.x + longestBox.width / 2).toBeLessThanOrEqual(
      280 - CARD_POPUP_INSET_PX + 0.01
    );

    const end160 = pickCardPopupEndPoint(
      { widthPct: 85, heightPct: 65 },
      160,
      120,
      [],
      longestBox,
      () => 0.05
    );
    expect(end160.x).toBe(80);
    expect(end160.offsetFromCenterX).toBe(0);

    const crit160 = pickCardPopupEndPoint(
      { widthPct: 85, heightPct: 65 },
      160,
      120,
      [],
      twoIcon,
      () => 0.05
    );
    expect(crit160.x - twoIcon.width / 2).toBeGreaterThanOrEqual(
      CARD_POPUP_INSET_PX - 0.01
    );
    expect(crit160.x + twoIcon.width / 2).toBeLessThanOrEqual(
      160 - CARD_POPUP_INSET_PX + 0.01
    );
  });

  it('5) all popup.* keys exist in both vi.ts and en.ts and EN mode displays original English strings', () => {
    const popupKeys = Object.keys(VI_TRANSLATIONS).filter((k) =>
      k.startsWith('popup.')
    );
    expect(popupKeys.length).toBeGreaterThanOrEqual(21);
    for (const k of popupKeys) {
      expect(VI_TRANSLATIONS[k as keyof typeof VI_TRANSLATIONS]).toBeTruthy();
      expect(EN_TRANSLATIONS[k as keyof typeof EN_TRANSLATIONS]).toBeTruthy();
    }

    const enCounter = parseCardPopupDisplay(
      { tone: 'buff', text: 'COUNTER READY' },
      'en'
    );
    expect(enCounter.segments[0].text).toBe('COUNTER READY');
    const enFull = parseCardPopupDisplay(
      { tone: 'heal', text: 'FULL RECOVERY' },
      'en'
    );
    expect(enFull.segments[0].text).toBe('FULL RECOVERY');
  });
});
