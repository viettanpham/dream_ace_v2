// @vitest-environment jsdom
import { createElement, createRef } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { resolveUnitAction, sortTurnOrder } from '../../engine/combat';
import type {
  BattleState,
  CombatFxEvent,
  CombatUnit,
  FloatingPopup,
} from '../../types/game';
import {
  DEFAULT_FX_SETTINGS,
  resolveEffectiveVfxConfig,
  updateFxSettings,
} from '../../utils/battleVfx';
import {
  FX_TONE_COLORS,
  resolveFxTone,
  resolveFxToneColor,
} from '../../utils/fxTone';
import { BattleUnitCard } from '../BattleUnitCard';
import { BattleVfxOverlay } from '../BattleVfxOverlay';

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
    classId: 'support',
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
      maxSp: 80,
      speed: 60,
      attackPower: 45,
      defenseRating: 20,
      dodgeChance: 5,
      critChance: 10,
      skillPower: 40,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 0,
      passiveSkillDmgPct: 0,
    },
    hp: alive ? 220 : 0,
    shield: alive ? 40 : 0,
    sp: 60,
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

function hexToRgbCss(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe('G4b: Support FX tone + radar buff projectile + card floating numbers', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    mockReducedMotion(false);
    updateFxSettings({ ...DEFAULT_FX_SETTINGS });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  describe('ITEM 1: fxTone helper & combat support case tones', () => {
    it('resolveFxTone and FX_TONE_COLORS apply expected defaults and colors', () => {
      expect(FX_TONE_COLORS).toEqual({
        heal: '#22c55e',
        shield: '#38bdf8',
        sp: '#f59e0b',
        buff: '#facc15',
        damage: '#38bdf8',
      });

      expect(resolveFxTone({ kind: 'heal' })).toBe('heal');
      expect(resolveFxTone({ kind: 'heal', tone: 'shield' })).toBe('shield');
      expect(resolveFxTone({ kind: 'heal', tone: 'sp' })).toBe('sp');
      expect(resolveFxTone({ kind: 'heal', tone: 'buff' })).toBe('buff');
      expect(resolveFxTone({ kind: 'laser' })).toBe('damage');
      expect(resolveFxTone({ kind: 'missile' })).toBe('damage');
      expect(resolveFxTone({ kind: 'railgun' })).toBe('damage');

      expect(
        resolveFxToneColor({
          kind: 'laser',
          fromSide: 'enemy',
          accentHex: '#F97316',
        })
      ).toBe('#f97316');
      expect(
        resolveFxToneColor({
          kind: 'heal',
          tone: 'buff',
          fromSide: 'ally',
          accentHex: '#10B981',
        })
      ).toBe('#facc15');
    });

    it('sets the expected tone on every support skill case in resolveUnitAction', () => {
      const cases: Array<{
        skillId: string;
        expectedTone: 'heal' | 'shield' | 'sp' | 'buff';
      }> = [
        { skillId: 'sup_nanite_mend', expectedTone: 'heal' },
        { skillId: 'sup_flux_transfer', expectedTone: 'sp' },
        { skillId: 'sup_regen_grid', expectedTone: 'heal' },
        { skillId: 'sup_aegis_field', expectedTone: 'shield' },
        { skillId: 'sup_war_hymn', expectedTone: 'buff' },
        { skillId: 'sup_iron_canopy', expectedTone: 'buff' },
        { skillId: 'sup_slipstream_link', expectedTone: 'buff' },
        { skillId: 'sup_stasis_shell', expectedTone: 'buff' },
        { skillId: 'sup_system_purge', expectedTone: 'buff' },
        { skillId: 'sup_genesis_wave', expectedTone: 'heal' },
      ];

      for (const { skillId, expectedTone } of cases) {
        const caster = makeUnit('caster', 'Medic', 'ally', 'middle', {
          isPlayer: true,
          equippedSkillIds: [skillId],
          sp: 80,
          hp: 200,
        });
        const ally = makeUnit('ally1', 'Vanguard', 'ally', 'front', {
          classId: 'striker',
          hp: 180,
          shield: 20,
          sp: 10,
          statuses: [
            { type: 'burn', turnsRemaining: 2, magnitude: 10 },
          ],
        });
        const enemy = makeUnit('e1', 'Raider', 'enemy', 'front');

        const res = resolveUnitAction(
          [caster, ally, enemy],
          caster.id,
          'skill',
          ally.id,
          1,
          undefined,
          () => 0.5,
          skillId
        );

        expect(res.fxEvent, `${skillId} should produce fxEvent`).not.toBeNull();
        expect(res.fxEvent!.kind).toBe('heal');
        expect(res.fxEvent!.tone, `${skillId} tone`).toBe(expectedTone);
      }
    });
  });

  describe('ITEM 2: BattleVfxOverlay support projectile, ring, buff carets & gating', () => {
    function renderOverlay(
      battle: BattleState,
      opts: {
        battleSpeed?: 1 | 2 | 3 | 5 | 10;
        effectsMode?: 'full' | 'compact' | 'off';
        reducedMotion?: boolean;
        skipAnimations?: boolean;
        vfxOverrides?: Partial<ReturnType<typeof resolveEffectiveVfxConfig>>;
      } = {}
    ) {
      const battleSpeed = opts.battleSpeed ?? 1;
      const vfxConfig = {
        ...resolveEffectiveVfxConfig(
          opts.effectsMode ?? 'full',
          battleSpeed,
          opts.reducedMotion ?? false,
          opts.skipAnimations ?? false
        ),
        ...(opts.vfxOverrides ?? {}),
      };
      const svgPosMap = new Map(
        battle.units.map((u, i) => [
          u.id,
          {
            x: u.side === 'ally' ? 120 + (i % 3) * 60 : 560 - (i % 3) * 60,
            y: 90 + (i % 4) * 70,
          },
        ])
      );
      const containerRef = createRef<HTMLDivElement>();
      const markerElementsRef = {
        current: new Map<string, SVGGElement>(),
      };

      act(() => {
        root!.render(
          createElement(
            'div',
            {
              ref: containerRef,
              className: 'relative w-[720px] h-[420px]',
              'data-reduced-motion': vfxConfig.reducedMotion ? 'true' : 'false',
            },
            createElement(BattleVfxOverlay, {
              battle,
              containerRef,
              markerElementsRef,
              svgPosMap,
              vw: 720,
              vh: 420,
              battleSpeed,
              vfxConfig,
              manualAimLine: null,
              hitFlashUnitIds: new Set<string>(),
              defeatFadingUnitIds: new Set<string>(),
            })
          )
        );
      });
    }

    it('renders tone-colored projectile, arrival ring, caster glow, and buff ▲ carets', () => {
      const caster = makeUnit('p1', 'Caster', 'ally', 'back', { isPlayer: true });
      const ally = makeUnit('a1', 'Ally 1', 'ally', 'front');
      const enemy = makeUnit('e1', 'Enemy 1', 'enemy', 'front');

      const tones: Array<'heal' | 'shield' | 'sp' | 'buff'> = [
        'heal',
        'shield',
        'sp',
        'buff',
      ];
      for (const tone of tones) {
        const fx: CombatFxEvent = {
          id: `fx_${tone}`,
          kind: 'heal',
          tone,
          fromSide: 'ally',
          fromSlotIndex: 0,
          fromUnitId: 'p1',
          toSide: 'ally',
          toSlotIndices: [1],
          toUnitIds: ['a1'],
          accentHex: '#10B981',
        };
        const battle = makeBattle([caster, ally, enemy], { fxEvents: [fx] });
        renderOverlay(battle, { battleSpeed: 1 });

        const proj = container!.querySelector(
          `[data-testid="vfx-heal-proj-fx_${tone}-a1"]`
        ) as HTMLElement;
        const ring = container!.querySelector(
          `[data-testid="vfx-heal-ring-a1"]`
        ) as HTMLElement;
        const casterGlow = container!.querySelector(
          `[data-testid="vfx-heal-caster-fx_${tone}"]`
        ) as HTMLElement;

        expect(proj).not.toBeNull();
        expect(proj.className).toContain('vfx-cannon-fly');
        expect(proj.getAttribute('data-fx-tone')).toBe(tone);

        expect(ring).not.toBeNull();
        expect(ring.className).toContain('vfx-ring-expand');
        expect(ring.style.borderColor).toBe(hexToRgbCss(FX_TONE_COLORS[tone]));

        expect(casterGlow).not.toBeNull();
        expect(casterGlow.className).toContain('vfx-caster-glow');
        expect(casterGlow.style.borderColor).toBe(
          hexToRgbCss(FX_TONE_COLORS[tone])
        );

        const carets = ring.querySelectorAll(
          `[data-testid^="vfx-buff-caret-fx_${tone}-a1-"]`
        );
        if (tone === 'buff') {
          expect(carets.length).toBe(3);
          expect(carets[0].textContent).toBe('▲');
          expect(carets[0].className).toContain('vfx-buff-caret');
        } else {
          expect(carets.length).toBe(0);
        }
      }
    });

    it('renders ring only at battleSpeed >= 5, when showProjectiles is false, or on self-cast; and nothing when animationsSkipped', () => {
      const caster = makeUnit('p1', 'Caster', 'ally', 'back', { isPlayer: true });
      const ally = makeUnit('a1', 'Ally 1', 'ally', 'front');
      const enemy = makeUnit('e1', 'Enemy 1', 'enemy', 'front');

      const allyCastFx: CombatFxEvent = {
        id: 'fx_spd',
        kind: 'heal',
        tone: 'shield',
        fromSide: 'ally',
        fromSlotIndex: 0,
        fromUnitId: 'p1',
        toSide: 'ally',
        toSlotIndices: [1],
        toUnitIds: ['a1'],
        accentHex: '#38BDF8',
      };

      // speed = 5 -> ring only
      renderOverlay(makeBattle([caster, ally, enemy], { fxEvents: [allyCastFx] }), {
        battleSpeed: 5,
      });
      expect(
        container!.querySelector('[data-testid^="vfx-heal-proj-"]')
      ).toBeNull();
      expect(
        container!.querySelector('[data-testid="vfx-heal-ring-a1"]')
      ).not.toBeNull();

      // effectsMode = off (showProjectiles false & showMainImpactOrHeal false) -> nothing
      renderOverlay(makeBattle([caster, ally, enemy], { fxEvents: [allyCastFx] }), {
        battleSpeed: 1,
        effectsMode: 'off',
      });
      expect(
        container!.querySelector('[data-testid^="vfx-heal-proj-"]')
      ).toBeNull();
      expect(
        container!.querySelector('[data-testid="vfx-heal-ring-a1"]')
      ).toBeNull();

      // animationsSkipped -> nothing
      renderOverlay(makeBattle([caster, ally, enemy], { fxEvents: [allyCastFx] }), {
        battleSpeed: 1,
        skipAnimations: true,
      });
      expect(
        container!.querySelector('[data-testid="radar-fx-fx_spd"]')
      ).toBeNull();

      // self-cast -> ring only (no projectile)
      const selfFx: CombatFxEvent = {
        id: 'fx_self',
        kind: 'heal',
        tone: 'heal',
        fromSide: 'ally',
        fromSlotIndex: 0,
        fromUnitId: 'p1',
        toSide: 'ally',
        toSlotIndices: [0],
        toUnitIds: ['p1'],
        accentHex: '#10B981',
      };
      renderOverlay(makeBattle([caster, ally, enemy], { fxEvents: [selfFx] }), {
        battleSpeed: 1,
      });
      expect(
        container!.querySelector('[data-testid^="vfx-heal-proj-"]')
      ).toBeNull();
      expect(
        container!.querySelector('[data-testid="vfx-heal-ring-p1"]')
      ).not.toBeNull();

      // reducedMotion -> reduced marker for projectile (no vfx-cannon-fly)
      renderOverlay(makeBattle([caster, ally, enemy], { fxEvents: [allyCastFx] }), {
        battleSpeed: 1,
        reducedMotion: true,
      });
      const rmProj = container!.querySelector(
        '[data-testid="vfx-heal-proj-fx_spd-a1"]'
      ) as HTMLElement;
      expect(rmProj).not.toBeNull();
      expect(rmProj.className).toContain('vfx-reduced-marker');
      expect(rmProj.className).not.toContain('vfx-cannon-fly');

      // explicit showProjectiles=false with showMainImpactOrHeal=true -> ring only
      renderOverlay(makeBattle([caster, ally, enemy], { fxEvents: [allyCastFx] }), {
        battleSpeed: 1,
        vfxOverrides: { showProjectiles: false, showMainImpactOrHeal: true },
      });
      expect(
        container!.querySelector('[data-testid^="vfx-heal-proj-"]')
      ).toBeNull();
      expect(
        container!.querySelector('[data-testid="vfx-heal-ring-a1"]')
      ).not.toBeNull();

      // damage FX unchanged (support caster laser resolves to beam)
      const dmgFx: CombatFxEvent = {
        id: 'fx_dmg_keep',
        kind: 'laser',
        fromSide: 'ally',
        fromSlotIndex: 0,
        fromUnitId: 'p1',
        toSide: 'enemy',
        toSlotIndices: [0],
        toUnitIds: ['e1'],
        accentHex: '#38BDF8',
      };
      renderOverlay(makeBattle([caster, ally, enemy], { fxEvents: [dmgFx] }), {
        battleSpeed: 1,
      });
      expect(
        container!.querySelector('[data-testid="vfx-beam-fx_dmg_keep-e1"]')
      ).not.toBeNull();
      expect(
        container!.querySelector('[data-testid^="vfx-heal-caster-"]')
      ).toBeNull();
      expect(
        container!.querySelector('[data-testid^="vfx-heal-proj-"]')
      ).toBeNull();
    });

    it('AoE caps projectiles at max 3 non-self targets while rendering rings on all targets', () => {
      const caster = makeUnit('p1', 'Caster', 'ally', 'back', { isPlayer: true });
      const a1 = makeUnit('a1', 'Ally 1', 'ally', 'front');
      const a2 = makeUnit('a2', 'Ally 2', 'ally', 'front');
      const a3 = makeUnit('a3', 'Ally 3', 'ally', 'middle');
      const a4 = makeUnit('a4', 'Ally 4', 'ally', 'middle');
      const enemy = makeUnit('e1', 'Enemy 1', 'enemy', 'front');

      const aoeFx: CombatFxEvent = {
        id: 'fx_aoe',
        kind: 'heal',
        tone: 'buff',
        fromSide: 'ally',
        fromSlotIndex: 0,
        fromUnitId: 'p1',
        toSide: 'ally',
        toSlotIndices: [0, 1, 2, 3, 4],
        toUnitIds: ['p1', 'a1', 'a2', 'a3', 'a4'],
        accentHex: '#F59E0B',
      };

      renderOverlay(
        makeBattle([caster, a1, a2, a3, a4, enemy], { fxEvents: [aoeFx] }),
        { battleSpeed: 1 }
      );

      const projectiles = container!.querySelectorAll(
        '[data-testid^="vfx-heal-proj-fx_aoe-"]'
      );
      const rings = container!.querySelectorAll('[data-testid^="vfx-heal-ring-"]');
      expect(projectiles.length).toBe(3);
      expect(rings.length).toBe(5);
    });
  });

  describe('ITEM 3: BattleUnitCard floating popups stay inside the card', () => {
    it('renders max 3 newest popups using -in classes, top 18px, horizontal spread 30%/50%/70%, and truncated inside a 54px card', () => {
      const unit = makeUnit('u1', 'Striker', 'ally', 'front');
      const popups: FloatingPopup[] = [
        { id: 'p1', unitId: 'u1', text: '-10', tone: 'damage' },
        { id: 'p2', unitId: 'u1', text: '-20', tone: 'damage' },
        { id: 'p3', unitId: 'u1', text: '-30', tone: 'damage' },
        { id: 'p4', unitId: 'u1', text: '+50 HP', tone: 'heal' },
        { id: 'p5', unitId: 'u1', text: 'ATK +25%', tone: 'buff' },
        { id: 'p6', unitId: 'u1', text: '-185', tone: 'crit' },
      ];

      act(() => {
        root!.render(
          createElement(
            'div',
            { className: 'w-[220px] h-[54px] overflow-hidden' },
            createElement(BattleUnitCard, {
              unit,
              isActiveTurn: false,
              isTargeted: false,
              canTarget: false,
              exploding: false,
              skipAnimations: false,
              statusRows: 0,
              popups,
            })
          )
        );
      });

      const rendered = Array.from(
        container!.querySelectorAll('[data-testid="damage-popup"]')
      ) as HTMLElement[];

      expect(rendered.length).toBe(3);
      expect(rendered.map((el) => el.textContent)).toEqual([
        '+50 HP',
        'ATK +25%',
        '-185',
      ]);

      expect(rendered.map((el) => el.style.left)).toEqual(['30%', '50%', '70%']);
      for (const el of rendered) {
        expect(el.style.top).toBe('18px');
        expect(el.className).toContain('truncate');
        expect(el.className).not.toMatch(/\banim-popup(?:\s|$)/);
        expect(el.className).not.toMatch(/\banim-popup-tight(?:\s|$)/);
      }
      expect(rendered[0].className).toContain('anim-popup-in');
      expect(rendered[1].className).toContain('anim-popup-tight-in');
      expect(rendered[2].className).toContain('anim-popup-in');
    });

    it('uses fade-only class with no movement class when reduced motion is enabled', () => {
      updateFxSettings({ reducedMotionMode: 'on' });
      const unit = makeUnit('u1', 'Striker', 'ally', 'front');

      act(() => {
        root!.render(
          createElement(BattleUnitCard, {
            unit,
            isActiveTurn: false,
            isTargeted: false,
            canTarget: false,
            exploding: false,
            skipAnimations: false,
            statusRows: 0,
            popups: [
              { id: 'p1', unitId: 'u1', text: '-120', tone: 'damage' },
              { id: 'p2', unitId: 'u1', text: 'DEF +20%', tone: 'buff' },
            ],
          })
        );
      });

      const rendered = Array.from(
        container!.querySelectorAll('[data-testid="damage-popup"]')
      ) as HTMLElement[];
      expect(rendered.length).toBe(2);
      for (const el of rendered) {
        expect(el.className).toContain('anim-popup-reduced');
        expect(el.className).not.toContain('anim-popup-in');
        expect(el.className).not.toContain('anim-popup-tight-in');
        expect(el.className).not.toMatch(/\banim-popup(?:\s|$)/);
        expect(el.className).not.toMatch(/\banim-popup-tight(?:\s|$)/);
      }
    });
  });
});
