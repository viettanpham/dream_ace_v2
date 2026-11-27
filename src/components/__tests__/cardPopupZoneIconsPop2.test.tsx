// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { createDefaultAdminConfig } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit, FloatingPopup } from '../../types/game';
import {
  CARD_POPUP_INSET_PX,
  pickCardPopupEndPoint,
  resolveCardPopupConfig,
  sanitizeCardPopupZoneHeightPct,
  sanitizeCardPopupZoneWidthPct,
} from '../../utils/cardPopupQueue';
import { BattleUnitCard } from '../BattleUnitCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeUnit(id: string): CombatUnit {
  return {
    id,
    name: 'Test Unit',
    callsign: 'Test',
    side: 'enemy',
    row: 'front',
    formationCol: 0,
    isPlayer: false,
    classId: 'interceptor',
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

describe('CARD-POP2 zone & icons', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.getState().setLanguage('vi');
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

  it('1) end point stays inside the centered zone and inside the card for zone 20% and 100%', () => {
    const w = 240;
    const h = 90;
    for (const pct of [20, 100]) {
      for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
        const pt = pickCardPopupEndPoint(
          { widthPct: pct, heightPct: pct },
          w,
          h,
          [],
          { width: 40, height: 18 },
          () => roll
        );
        expect(pt.x).toBeGreaterThanOrEqual(CARD_POPUP_INSET_PX);
        expect(pt.x).toBeLessThanOrEqual(w - CARD_POPUP_INSET_PX);
        expect(pt.y).toBeGreaterThanOrEqual(CARD_POPUP_INSET_PX);
        expect(pt.y).toBeLessThanOrEqual(h - CARD_POPUP_INSET_PX);
        expect(Math.abs(pt.offsetFromCenterX)).toBeLessThanOrEqual((w * pct) / 200 + 0.01);
        expect(Math.abs(pt.offsetFromCenterY)).toBeLessThanOrEqual((h * pct) / 200 + 0.01);
      }
    }
  });

  it('2) candidate selection prefers the point farthest from an active popup end point', () => {
    const w = 240;
    const h = 90;
    const rolls = [0.05, 0.5, 0.1, 0.5, 0.95, 0.5, 0.2, 0.5, 0.3, 0.5, 0.4, 0.5];
    let idx = 0;
    const picked = pickCardPopupEndPoint(
      { widthPct: 80, heightPct: 80 },
      w,
      h,
      [{ x: 40, y: h / 2 }],
      { width: 0, height: 0 },
      () => rolls[idx++] ?? 0.5
    );
    expect(picked.x).toBeGreaterThan(w / 2 + 50);
  });

  it('3) sanitize defaults 60/45 and clamps zone width/height to 20..100', () => {
    const defaults = createDefaultAdminConfig();
    expect(defaults.cardPopupZoneWidthPct).toBe(60);
    expect(defaults.cardPopupZoneHeightPct).toBe(45);
    expect(sanitizeCardPopupZoneWidthPct(undefined)).toBe(60);
    expect(sanitizeCardPopupZoneHeightPct(Number.NaN)).toBe(45);
    expect(sanitizeCardPopupZoneWidthPct(5)).toBe(20);
    expect(sanitizeCardPopupZoneHeightPct(180)).toBe(100);
    const resolved = resolveCardPopupConfig({
      cardPopupZoneWidthPct: 12.6,
      cardPopupZoneHeightPct: 999,
    });
    expect(resolved.zoneWidthPct).toBe(20);
    expect(resolved.zoneHeightPct).toBe(100);
  });

  it('4) damage popup renders HP icon + "-232" and "REDLINE FURY!" stays plain text', () => {
    const unit = makeUnit('e1');
    const popups: FloatingPopup[] = [
      { id: 'pop-dmg', unitId: 'e1', text: '-232', tone: 'damage' },
      { id: 'pop-heal', unitId: 'e1', text: '+50 HP', tone: 'heal' },
      { id: 'pop-shd', unitId: 'e1', text: '+30 SHD', tone: 'shield' },
      { id: 'pop-sp', unitId: 'e1', text: '+25 SP', tone: 'buff' },
      { id: 'pop-splash', unitId: 'e1', text: 'SPLASH -30', tone: 'damage' },
      { id: 'pop-fury', unitId: 'e1', text: 'REDLINE FURY!', tone: 'buff' },
    ];
    useGameStore.setState((s) => ({
      adminConfig: {
        ...s.adminConfig,
        cardPopupStaggerMs: 0,
        cardPopupMaxConcurrent: 8,
      },
    }));

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
    expect(nodes).toHaveLength(6);

    const dmgNode = nodes[0];
    expect(dmgNode.querySelector('[data-testid="card-popup-icon"]')?.getAttribute('data-popup-icon-kind')).toBe('hp');
    expect(dmgNode.textContent).toContain('-232');

    expect(nodes[1].querySelector('[data-testid="card-popup-icon"]')?.getAttribute('data-popup-icon-kind')).toBe('hp_plus');
    expect(nodes[1].textContent).toContain('+50');
    expect(nodes[1].textContent).not.toContain('HP');

    expect(nodes[2].querySelector('[data-testid="card-popup-icon"]')?.getAttribute('data-popup-icon-kind')).toBe('shield');
    expect(nodes[2].textContent).toContain('+30');
    expect(nodes[2].textContent).not.toContain('SHD');

    expect(nodes[3].querySelector('[data-testid="card-popup-icon"]')?.getAttribute('data-popup-icon-kind')).toBe('sp');
    expect(nodes[3].textContent).toContain('+25');
    expect(nodes[3].textContent).not.toContain('SP');

    expect(nodes[4].querySelector('[data-testid="card-popup-icon"]')?.getAttribute('data-popup-icon-kind')).toBe('splash');
    expect(nodes[4].textContent).toContain('-30');
    expect(nodes[4].textContent).not.toContain('SPLASH');

    const furyNode = nodes[5];
    expect(furyNode.querySelector('[data-testid="card-popup-icon"]')).toBeNull();
    expect(furyNode.textContent).toContain('REDLINE FURY!');
  });
});
