// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleUnitCard } from '../../components/BattleUnitCard';
import { CombatLogList } from '../../components/CombatLogList';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { formatCombatLogMessage } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { CombatLogEntry, CombatUnit, FloatingPopup } from '../../types/game';
import { SP_COLOR_TOKENS } from '../battleDisplay';
import { parseStructuredCombatLogRow } from '../combatLogFormat';
import { getCardPopupSymbol, parseCardPopupDisplay } from '../cardPopupQueue';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(id = 'e1'): CombatUnit {
  return {
    id,
    name: 'Scout',
    callsign: 'E1',
    side: 'enemy',
    row: 'front',
    formationCol: 0,
    isPlayer: false,
    classId: 'striker',
    isBoss: false,
    level: 10,
    skillLevel: 1,
    skillLevels: { gen_hull_brace: 1 },
    equippedSkillIds: ['gen_hull_brace'],
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

describe('TASK POP-ICON — card/radar popup icons and combat log inline icons', () => {
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

  it('1) mapper table maps all popup labels to catalog symbols + numbers and keeps unknown text plain', () => {
    const cases: Array<{
      pop: Pick<FloatingPopup, 'tone' | 'text'>;
      segs: Array<{ kind: string | null; symbol?: string; text: string }>;
      arrow?: 'up' | 'down' | null;
    }> = [
      { pop: { tone: 'damage', text: '-232' }, segs: [{ kind: 'hp', symbol: 'swords', text: '-232' }] },
      { pop: { tone: 'crit', text: '-410' }, segs: [{ kind: 'crit', symbol: 'flare', text: '-410' }] },
      { pop: { tone: 'damage', text: 'SPLASH -30' }, segs: [{ kind: 'splash', symbol: 'explosion', text: '-30' }] },
      { pop: { tone: 'status', text: 'BURN -45' }, segs: [{ kind: 'burn', symbol: 'local_fire_department', text: '-45' }], arrow: null },
      { pop: { tone: 'heal', text: '+50 HP' }, segs: [{ kind: 'hp_plus', symbol: 'heart_plus', text: '+50' }] },
      { pop: { tone: 'shield', text: '+30 SHD' }, segs: [{ kind: 'shield', symbol: 'security', text: '+30' }] },
      { pop: { tone: 'shield', text: 'SHD +25' }, segs: [{ kind: 'shield', symbol: 'security', text: '+25' }] },
      { pop: { tone: 'buff', text: '+25 SP' }, segs: [{ kind: 'sp', symbol: 'water_drop', text: '+25' }], arrow: null },
      {
        pop: { tone: 'heal', text: '+30 SP +50 SHD' },
        segs: [
          { kind: 'sp', symbol: 'water_drop', text: '+30' },
          { kind: 'shield', symbol: 'security', text: '+50' },
        ],
      },
      { pop: { tone: 'buff', text: 'DEF +20%' }, segs: [{ kind: 'def', symbol: 'shield', text: '+20%' }], arrow: 'up' },
      { pop: { tone: 'buff', text: 'EVA +15%' }, segs: [{ kind: 'eva', symbol: 'air', text: '+15%' }], arrow: 'up' },
      { pop: { tone: 'buff', text: 'WPN +30%' }, segs: [{ kind: 'wpn', symbol: 'swords', text: '+30%' }], arrow: 'up' },
      { pop: { tone: 'buff', text: 'SKL +25%' }, segs: [{ kind: 'skl', symbol: 'swords', text: '+25%' }], arrow: 'up' },
      { pop: { tone: 'buff', text: 'SPD +40%' }, segs: [{ kind: 'spd', symbol: 'speed', text: '+40%' }], arrow: 'up' },
      { pop: { tone: 'status', text: 'VULN +15%' }, segs: [{ kind: 'vuln', symbol: 'crisis_alert', text: '+15%' }], arrow: 'down' },
      { pop: { tone: 'heal', text: 'REGEN +10%' }, segs: [{ kind: 'regen', symbol: 'health_cross', text: '+10%' }], arrow: 'up' },
      { pop: { tone: 'status', text: 'LOCK x2' }, segs: [{ kind: 'lock', symbol: 'lock', text: 'x2' }], arrow: 'down' },
      {
        pop: { tone: 'buff', text: 'BACK ROW +12% EVA' },
        segs: [
          { kind: null, text: 'BACK ROW' },
          { kind: 'eva', symbol: 'air', text: '+12%' },
        ],
        arrow: 'up',
      },
      { pop: { tone: 'buff', text: 'REDLINE FURY!' }, segs: [{ kind: 'splash', symbol: 'explosion', text: 'CUỒNG NỘ' }], arrow: 'up' },
      { pop: { tone: 'evade', text: 'REVEALED!' }, segs: [{ kind: 'revealed', symbol: 'visibility', text: 'LỘ DIỆN' }], arrow: null },
    ];

    for (const c of cases) {
      const parsed = parseCardPopupDisplay(c.pop);
      expect(parsed.segments.length).toBe(c.segs.length);
      c.segs.forEach((expectedSeg, i) => {
        const seg = parsed.segments[i];
        expect(seg.iconKind).toBe(expectedSeg.kind);
        expect(seg.text).toBe(expectedSeg.text);
        if (seg.iconKind) {
          expect(getCardPopupSymbol(seg.iconKind)).toBe(expectedSeg.symbol);
        }
      });
      if (c.arrow !== undefined) {
        expect(parsed.arrow).toBe(c.arrow);
      }
      if (c.pop.text === '+25 SP') {
        expect(parsed.segments[0]?.colorClass).toBe(SP_COLOR_TOKENS.textClass);
      }
    }
  });

  it('2) damage renders swords + "-232", crit renders flare, and splash renders explosion without "SPLASH"', () => {
    const unit = makeUnit('e1');
    const popups: FloatingPopup[] = [
      { id: 'p1', unitId: 'e1', text: '-232', tone: 'damage' },
      { id: 'p2', unitId: 'e1', text: '-450', tone: 'crit' },
      { id: 'p3', unitId: 'e1', text: 'SPLASH -30', tone: 'damage' },
    ];

    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit,
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

    const nodes = Array.from(
      container!.querySelectorAll('[data-testid="damage-popup"]')
    ) as HTMLElement[];
    expect(nodes).toHaveLength(3);

    expect(nodes[0].querySelector('[data-testid="card-popup-icon"]')?.textContent).toBe('swords');
    expect(nodes[0].textContent).toContain('-232');

    const critIcon = nodes[1].querySelector('[data-testid="card-popup-icon"]') as HTMLElement;
    expect(critIcon?.getAttribute('data-popup-icon-kind')).toBe('crit');
    expect(critIcon?.textContent).toBe('flare');
    expect(nodes[1].textContent).toContain('-450');

    const splashIcon = nodes[2].querySelector('[data-testid="card-popup-icon"]') as HTMLElement;
    expect(splashIcon?.getAttribute('data-popup-icon-kind')).toBe('splash');
    expect(splashIcon?.textContent).toBe('explosion');
    expect(nodes[2].textContent).toContain('-30');
    expect(nodes[2].textContent).not.toContain('SPLASH');
  });

  it('3) buff "DEF +20%" renders up arrow + DEF icon + "+20%"', () => {
    const unit = makeUnit('a1');
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: false,
          popups: [{ id: 'p-def', unitId: 'a1', text: 'DEF +20%', tone: 'buff' }],
          onSelect: vi.fn(),
          onInspect: vi.fn(),
        })
      );
    });

    const node = container!.querySelector('[data-testid="damage-popup"]') as HTMLElement;
    expect(node).not.toBeNull();
    const icon = node.querySelector('[data-testid="card-popup-icon"]') as HTMLElement;
    expect(icon?.getAttribute('data-popup-icon-kind')).toBe('def');
    expect(icon?.textContent).toBe('shield');
    expect(node.textContent).toContain('↑');
    expect(node.textContent).toContain('+20%');
    expect(node.textContent).not.toContain('DEF');
  });

  it('4) log damage and supply-use rows render inline icons while plain/copied sentence strings stay unchanged', () => {
    const dmgEntry: CombatLogEntry = {
      id: 'log-dmg-1',
      round: 1,
      actorName: 'Strike-01',
      actorSide: 'ally',
      tag: 'ATTACK',
      templateKey: 'log.damage',
      params: {
        actor: 'Strike-01',
        target: 'Drone-A',
        hullDamage: 232,
        shieldAbsorbed: 0,
        isCrit: 0,
      },
    };
    const supplyEntry: CombatLogEntry = {
      id: 'log-sup-1',
      round: 1,
      actorName: 'Enemy_3',
      actorSide: 'enemy',
      tag: 'HEAL',
      templateKey: 'log.useSupply',
      params: {
        actor: 'Enemy_3',
        templateId: 'sup_hp_t3',
        hp: 800,
        shield: 0,
        sp: 0,
      },
    };

    const structuredDmg = parseStructuredCombatLogRow('vi', dmgEntry, []);
    const structuredSupply = parseStructuredCombatLogRow('vi', supplyEntry, []);
    expect(structuredDmg.sentence).toBe(
      'Strike-01 bắn Pháo Chính trúng Drone-A, gây 232 sát thương (HP -232)'
    );
    expect(structuredSupply.sentence).toBe(
      'Enemy_3 dùng Bộ sửa chữa T3: HP +800'
    );
    expect(formatCombatLogMessage('vi', dmgEntry)).not.toContain('swords');

    act(() => {
      root!.render(
        createElement(CombatLogList, {
          entries: [dmgEntry, supplyEntry],
          units: [],
          order: 'oldest',
          active: true,
        })
      );
    });

    const rows = Array.from(
      container!.querySelectorAll('[data-testid="combat-log-entry"]')
    ) as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('title')).toBe(structuredDmg.sentence);
    const dmgIcon = rows[0].querySelector(
      '[data-testid="combat-log-inline-icon"]'
    ) as HTMLElement;
    expect(dmgIcon).not.toBeNull();
    expect(dmgIcon.textContent).toBe('swords');
    expect(rows[1].getAttribute('title')).toBe(structuredSupply.sentence);
    const supIcon = rows[1].querySelector(
      '[data-testid="combat-log-inline-icon"]'
    ) as HTMLElement;
    expect(supIcon).not.toBeNull();
    expect(supIcon.textContent).toBe('heart_plus');
    expect(rows[1].textContent).toContain('+800');
  });
});
