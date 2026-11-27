// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FLUX_TRANSFER_CONFIG } from '../../data/balance';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { resolveSpTransfer } from '../../engine/combat';
import { createDefaultAdminConfig, createFreshCampaignState } from '../../engine/migration';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import type { TranslationKey } from '../../i18n/en';
import { useGameStore } from '../../store/useGameStore';
import type { BattleState, CombatUnit } from '../../types/game';
import { BattleScreen } from '../BattleScreen';
import { FluxTransferPicker, previewFluxTransfer } from '../FluxTransferPicker';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function translateVi(
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let out: string = VI_TRANSLATIONS[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> & { maxSp?: number } = {}
): CombatUnit {
  const { maxSp = 100, derived: derivedOverride, ...rest } = overrides;
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
    skillLevels: { sup_flux_transfer: 1 },
    equippedSkillIds: [],
    skillCooldowns: {},
    usedOnceSkills: [],
    stats: { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp: 400,
      maxShield: 100,
      maxSp,
      speed: 80,
      attackPower: 45,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
      ...derivedOverride,
    },
    hp: 400,
    shield: 100,
    sp: 20,
    isDefending: false,
    alive: true,
    statuses: [],
    animState: 'idle',
    ...rest,
  };
}

function makeBattle(units: CombatUnit[]): BattleState {
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'support',
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

describe('TASK B3 — FluxTransferPicker', () => {
  let container: HTMLDivElement;
  let root: Root;
  const origPerform = useGameStore.getState().performPlayerAction;

  beforeEach(() => {
    setViewport(1440, 900);
    const fresh = createFreshCampaignState('Pilot', 'support', () => 0.5);
    useGameStore.setState({
      language: 'vi',
      screen: 'BATTLE',
      autoBattleEnabled: false,
      adminConfig: createDefaultAdminConfig(),
      pilot: fresh.pilot,
      battle: null,
      performPlayerAction: origPerform,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    useGameStore.setState({ performPlayerAction: origPerform, battle: null });
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1) tapping sup_flux_transfer opens picker and does not cast immediately', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      isPlayer: true,
      classId: 'support',
      maxSp: 500,
      sp: 400,
      equippedSkillIds: ['sup_flux_transfer'],
      skillLevels: { sup_flux_transfer: 1 },
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 20 });
    const e1 = makeUnit('e1', 'Enemy', 'enemy', { maxSp: 100, sp: 50 });

    const spyPerform = vi.fn();
    useGameStore.setState({
      battle: makeBattle([sup, a1, a2, e1]),
      performPlayerAction: spyPerform,
    });

    act(() => {
      root.render(createElement(BattleScreen));
    });

    const btn = container.querySelector(
      '[data-testid="battle-skill-btn-sup_flux_transfer"]'
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();

    act(() => {
      btn.click();
    });

    const picker = container.querySelector('[data-testid="flux-transfer-picker"]');
    expect(picker).toBeTruthy();
    expect(picker?.getAttribute('data-placement')).toBe('desktop-popover');
    expect(spyPerform).not.toHaveBeenCalled();

    // Esc closes it without casting
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.querySelector('[data-testid="flux-transfer-picker"]')).toBeNull();
    expect(spyPerform).not.toHaveBeenCalled();
  });

  it('2) [+]/[−] clamps count strictly between 1 and rule max', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      isPlayer: true,
      classId: 'support',
      maxSp: 500,
      sp: 400,
      skillLevels: { sup_flux_transfer: 1 },
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 20 });
    const aFull = makeUnit('afull', 'Full', 'ally', { maxSp: 100, sp: 100 });

    act(() => {
      root.render(
        createElement(FluxTransferPicker, {
          open: true,
          units: [sup, a1, a2, aFull],
          actorId: 'sup',
          fluxConfig: DEFAULT_FLUX_TRANSFER_CONFIG,
          isPhone: false,
          t: translateVi,
          onCancel: vi.fn(),
          onConfirm: vi.fn(),
        })
      );
    });

    const countEl = () =>
      container.querySelector('[data-testid="flux-picker-count"]')?.textContent;
    const decBtn = container.querySelector(
      '[data-testid="flux-picker-dec"]'
    ) as HTMLButtonElement;
    const incBtn = container.querySelector(
      '[data-testid="flux-picker-inc"]'
    ) as HTMLButtonElement;

    // Defaults to 2 non-full allies (max is L1 = 3)
    expect(countEl()).toBe('2');

    act(() => incBtn.click());
    expect(countEl()).toBe('3');
    expect(incBtn.disabled).toBe(true);
    act(() => incBtn.click());
    expect(countEl()).toBe('3');

    act(() => decBtn.click());
    expect(countEl()).toBe('2');
    act(() => decBtn.click());
    expect(countEl()).toBe('1');
    expect(decBtn.disabled).toBe(true);
    act(() => decBtn.click());
    expect(countEl()).toBe('1');
  });

  it('3) preview cost and left SP match resolveSpTransfer for every k', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      isPlayer: true,
      classId: 'support',
      maxSp: 500,
      sp: 400,
      skillLevels: { sup_flux_transfer: 1 },
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 20 });
    const a3 = makeUnit('a3', 'A3', 'ally', { maxSp: 100, sp: 30 });
    const units = [sup, a1, a2, a3];

    for (const k of [1, 2, 3]) {
      const p = previewFluxTransfer(units, 'sup', DEFAULT_FLUX_TRANSFER_CONFIG, k);
      const r = resolveSpTransfer(units, 'sup', 1, DEFAULT_FLUX_TRANSFER_CONFIG, k);
      expect(p.cost).toBe(r.cost);
      expect(p.leftSp).toBe(r.updatedUnits.find((u) => u.id === 'sup')!.sp);
    }

    act(() => {
      root.render(
        createElement(FluxTransferPicker, {
          open: true,
          units,
          actorId: 'sup',
          fluxConfig: DEFAULT_FLUX_TRANSFER_CONFIG,
          isPhone: false,
          t: translateVi,
          onCancel: vi.fn(),
          onConfirm: vi.fn(),
        })
      );
    });

    const estText =
      container.querySelector('[data-testid="flux-picker-estimate"]')?.textContent ?? '';
    expect(estText).toContain('−66 SP');
    expect(estText).toContain('còn 334');
  });

  it('4) [Truyền] casts sup_flux_transfer with chosen transferCount', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      isPlayer: true,
      classId: 'support',
      maxSp: 500,
      sp: 400,
      equippedSkillIds: ['sup_flux_transfer'],
      skillLevels: { sup_flux_transfer: 1 },
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 10 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 20 });
    const a3 = makeUnit('a3', 'A3', 'ally', { maxSp: 100, sp: 30 });
    const e1 = makeUnit('e1', 'Enemy', 'enemy', { maxSp: 100, sp: 50 });

    const spyPerform = vi.fn();
    useGameStore.setState({
      battle: makeBattle([sup, a1, a2, a3, e1]),
      performPlayerAction: spyPerform,
    });

    act(() => {
      root.render(createElement(BattleScreen));
    });

    act(() => {
      (
        container.querySelector(
          '[data-testid="battle-skill-btn-sup_flux_transfer"]'
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      (
        container.querySelector('[data-testid="flux-picker-dec"]') as HTMLButtonElement
      ).click();
    });
    expect(
      container.querySelector('[data-testid="flux-picker-count"]')?.textContent
    ).toBe('2');

    act(() => {
      (
        container.querySelector(
          '[data-testid="flux-picker-confirm"]'
        ) as HTMLButtonElement
      ).click();
    });

    expect(spyPerform).toHaveBeenCalledTimes(1);
    expect(spyPerform).toHaveBeenCalledWith('skill', 'sup_flux_transfer', 2);
    expect(container.querySelector('[data-testid="flux-transfer-picker"]')).toBeNull();
  });

  it('5) disables [Truyền] and shows empty notice when no ally needs SP', () => {
    const sup = makeUnit('sup', 'Support', 'ally', {
      isPlayer: true,
      classId: 'support',
      maxSp: 500,
      sp: 400,
      skillLevels: { sup_flux_transfer: 1 },
    });
    const a1 = makeUnit('a1', 'A1', 'ally', { maxSp: 100, sp: 100 });
    const a2 = makeUnit('a2', 'A2', 'ally', { maxSp: 100, sp: 100 });
    const onConfirm = vi.fn();

    act(() => {
      root.render(
        createElement(FluxTransferPicker, {
          open: true,
          units: [sup, a1, a2],
          actorId: 'sup',
          fluxConfig: DEFAULT_FLUX_TRANSFER_CONFIG,
          isPhone: true,
          t: translateVi,
          onCancel: vi.fn(),
          onConfirm,
        })
      );
    });

    const picker = container.querySelector('[data-testid="flux-transfer-picker"]');
    expect(picker?.getAttribute('data-placement')).toBe('phone-bottom');
    expect(
      container.querySelector('[data-testid="flux-picker-estimate"]')?.textContent
    ).toBe('Không có đồng đội thiếu SP');
    const confirmBtn = container.querySelector(
      '[data-testid="flux-picker-confirm"]'
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    act(() => confirmBtn.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
