// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import {
  createDefaultAdminConfig,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { CombatUnit } from '../../types/game';
import {
  CARD_POPUP_INSET_PX,
  estimatePopupBoxSize,
  pickCardPopupEndPoint,
  resolveCardPopupConfig,
  sanitizeCardPopupEndScalePct,
  sanitizeCardPopupStartScalePct,
} from '../../utils/cardPopupQueue';
import { AdminPanel } from '../AdminPanel';
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

function setReactInputValue(input: HTMLInputElement, next: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  setter?.call(input, next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('POPUP-SCALE card popup start/end scale', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.getState().setLanguage('vi');
    useGameStore.setState({
      adminPanelOpen: true,
      adminConfig: createDefaultAdminConfig(),
    });
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

  it('1) sanitizers clamp + defaults and resolveCardPopupConfig passes both', () => {
    expect(sanitizeCardPopupStartScalePct(undefined)).toBe(100);
    expect(sanitizeCardPopupStartScalePct(10)).toBe(50);
    expect(sanitizeCardPopupStartScalePct(300)).toBe(200);
    expect(sanitizeCardPopupStartScalePct(112.4)).toBe(112);

    expect(sanitizeCardPopupEndScalePct(undefined)).toBe(125);
    expect(sanitizeCardPopupEndScalePct(10)).toBe(50);
    expect(sanitizeCardPopupEndScalePct(400)).toBe(250);
    expect(sanitizeCardPopupEndScalePct(149.6)).toBe(150);

    const defaults = resolveCardPopupConfig(null);
    expect(defaults.startScalePct).toBe(100);
    expect(defaults.endScalePct).toBe(125);

    const custom = resolveCardPopupConfig({
      cardPopupStartScalePct: 40,
      cardPopupEndScalePct: 300,
    });
    expect(custom.startScalePct).toBe(50);
    expect(custom.endScalePct).toBe(250);
  });

  it('2) estimatePopupBoxSize grows with max(start, end) scale and stays inside a 160px card', () => {
    const pop = { tone: 'damage' as const, text: '-240' };
    const box100 = estimatePopupBoxSize(pop, 'vi', {
      startScalePct: 100,
      endScalePct: 100,
    });
    const box125 = estimatePopupBoxSize(pop, 'vi', {
      startScalePct: 100,
      endScalePct: 125,
    });
    const boxStartLarger = estimatePopupBoxSize(pop, 'vi', {
      startScalePct: 180,
      endScalePct: 110,
    });

    expect(box125.width).toBeGreaterThan(box100.width);
    expect(box125.height).toBeGreaterThan(box100.height);
    expect(boxStartLarger.width).toBeGreaterThan(box125.width);

    for (const scale of [
      { startScalePct: 100, endScalePct: 125 },
      { startScalePct: 100, endScalePct: 250 },
    ]) {
      const box = estimatePopupBoxSize(pop, 'vi', scale);
      const end160 = pickCardPopupEndPoint(
        { widthPct: 85, heightPct: 65 },
        160,
        120,
        [],
        box,
        () => 0.99
      );
      if (box.width + CARD_POPUP_INSET_PX * 2 > 160) {
        expect(end160.x).toBe(80);
        expect(end160.offsetFromCenterX).toBe(0);
      } else {
        expect(end160.x - box.width / 2).toBeGreaterThanOrEqual(
          CARD_POPUP_INSET_PX - 0.01
        );
        expect(end160.x + box.width / 2).toBeLessThanOrEqual(
          160 - CARD_POPUP_INSET_PX + 0.01
        );
      }
    }
  });

  it('3) Admin fields write adminConfig, recompute live example lines, and BattleUnitCard sets CSS scale vars', () => {
    act(() => {
      root!.render(createElement(AdminPanel));
    });

    const battleTab = container!.querySelector(
      '[data-testid="admin-tab-battle"]'
    ) as HTMLButtonElement;
    expect(battleTab).not.toBeNull();
    act(() => {
      battleTab.click();
    });

    const startInput = container!.querySelector(
      '[data-testid="admin-card-popup-start-scale"]'
    ) as HTMLInputElement;
    const endInput = container!.querySelector(
      '[data-testid="admin-card-popup-end-scale"]'
    ) as HTMLInputElement;
    const startExample = container!.querySelector(
      '[data-testid="admin-card-popup-start-scale-example"]'
    ) as HTMLElement;
    const endExample = container!.querySelector(
      '[data-testid="admin-card-popup-end-scale-example"]'
    ) as HTMLElement;

    expect(startInput).not.toBeNull();
    expect(endInput).not.toBeNull();
    expect(startExample.textContent).toContain('15px -> 15px');
    expect(endExample.textContent).toContain('15px -> 19px');

    act(() => {
      setReactInputValue(startInput, '80');
      setReactInputValue(endInput, '160');
    });

    const cfg = useGameStore.getState().adminConfig;
    expect(cfg.cardPopupStartScalePct).toBe(80);
    expect(cfg.cardPopupEndScalePct).toBe(160);
    expect(startExample.textContent).toContain('15px -> 12px');
    expect(startExample.textContent).toContain('12px -> 10px');
    expect(endExample.textContent).toContain('15px -> 24px');
    expect(endExample.textContent).toContain('12px -> 19px');

    const unit = makeUnit('e1');
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: false,
          exploding: false,
          skipAnimations: false,
          popups: [{ id: 'pop-scale-1', unitId: 'e1', text: '-120', tone: 'damage' }],
          onSelect: vi.fn(),
          onInspect: vi.fn(),
        })
      );
    });

    const popEl = container!.querySelector(
      '[data-testid="damage-popup"]'
    ) as HTMLElement;
    expect(popEl).not.toBeNull();
    expect(popEl.style.getPropertyValue('--card-pop-start-scale')).toBe('0.8');
    expect(popEl.style.getPropertyValue('--card-pop-end-scale')).toBe('1.6');
    expect(popEl.style.transformOrigin).toBe('center');
  });

  it('4) old save without cardPopupStartScalePct/EndScalePct loads with defaults 100/125', () => {
    const oldAdmin = createDefaultAdminConfig();
    delete oldAdmin.cardPopupStartScalePct;
    delete oldAdmin.cardPopupEndScalePct;

    const migrated = migrateSaveData(
      {
        version: 13,
        adminConfig: oldAdmin,
      },
      CURRENT_SAVE_VERSION
    );

    expect(migrated.adminConfig.cardPopupStartScalePct).toBe(100);
    expect(migrated.adminConfig.cardPopupEndScalePct).toBe(125);
  });
});
