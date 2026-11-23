// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getCatalog } from '../../data/iconCatalog';
import { sortTurnOrder } from '../../engine/combat';
import { createDefaultAdminConfig, CURRENT_SAVE_VERSION } from '../../engine/migration';
import { useGameStore } from '../../store/useGameStore';
import type { ActiveStatusEffect, BattleState, CombatUnit } from '../../types/game';
import {
  BUILTIN_STATUS_DISPLAY_DEFAULTS,
  clearStatusDisplayOverride,
  getStatusChipGeometry,
  rectsIntersect,
  STATUS_CHIP_BAR_FRAME_PX,
  STATUS_CHIP_FRAME_PX,
  STATUS_CHIP_GLYPH_PX,
  STATUS_CHIP_VALUE_FONT_PX,
  STATUS_ROW_GAP_PX,
  STATUS_TURNS_BADGE_BG,
  STATUS_TURNS_BADGE_COLOR,
  STATUS_TURNS_BADGE_FONT_PX,
  STATUS_TURNS_BADGE_OUTSET_PX,
} from '../../utils/statusDisplayPrefs';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { BattleUnitCard } from '../BattleUnitCard';
import { FixedStatusArea, getFixedStatusAreaHeightPx } from '../FixedStatusArea';
import { IconCatalogPreviewModal } from '../IconCatalogPreviewModal';
import { StatusChip } from '../StatusChip';

function setViewport(width: number, height = 800) {
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

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const maxHp = overrides.derived?.maxHp ?? 920;
  return {
    id,
    name,
    callsign: name,
    side,
    row: overrides.row ?? 'front',
    formationCol: overrides.formationCol ?? 0,
    isPlayer: overrides.isPlayer ?? false,
    classId: overrides.classId ?? (side === 'ally' ? 'striker' : 'interceptor'),
    isBoss: overrides.isBoss ?? false,
    level: overrides.level ?? 10,
    skillLevel: overrides.skillLevel ?? 1,
    skillLevels: overrides.skillLevels ?? { gen_hull_brace: 1 },
    equippedSkillIds: overrides.equippedSkillIds ?? ['gen_hull_brace'],
    skillCooldowns: overrides.skillCooldowns ?? {},
    usedOnceSkills: overrides.usedOnceSkills ?? [],
    stats: overrides.stats ?? { ...EMPTY_STAT_BLOCK },
    derived: {
      maxHp,
      maxShield: 240,
      maxSp: 100,
      speed: 60,
      attackPower: 140,
      defenseRating: 60,
      dodgeChance: 12,
      critChance: 20,
      skillPower: 50,
      armorPiercePct: 0,
      splashPct: 0,
      spRegenPerTurn: 10,
      passiveSkillDmgPct: 0,
      ...(overrides.derived ?? {}),
    },
    hp: overrides.hp ?? maxHp,
    shield: overrides.shield ?? 200,
    sp: overrides.sp ?? 80,
    isDefending: overrides.isDefending ?? false,
    alive: overrides.alive ?? true,
    statuses: overrides.statuses ?? [],
    animState: overrides.animState ?? 'idle',
    archetype: overrides.archetype,
    isStructure: overrides.isStructure,
  };
}

function makeBattle(units: CombatUnit[]): BattleState {
  const firstEnemy = units.find((u) => u.side === 'enemy')?.id ?? null;
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: 4,
    round: 1,
    turnCounter: 1,
    turnOrder: sortTurnOrder(units),
    activeTurnIndex: 0,
    units,
    selectedTargetId: firstEnemy,
    selectedAllyTargetId: units.find((u) => u.side === 'ally')?.id ?? null,
    lastPlayerTargetId: firstEnemy,
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

describe('Task G4a-C1 — Status chip polish (constants, yellow turns badge, non-intersecting geometry, row height)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    setViewport(1280, 800);
    window.localStorage.clear();
    clearStatusDisplayOverride();
    useGameStore.getState().resetCampaign();
    useGameStore.setState({
      language: 'vi',
      adminPanelOpen: false,
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
    container?.remove();
    container = null;
    root = null;
    window.localStorage.clear();
  });

  it('1) Chip frame constants (32 / 28), glyph 20px, value 13px bold used by cards, player bar, legend, and Bảng icon while radar marker xs stays 18px', () => {
    expect(STATUS_CHIP_FRAME_PX).toBe(32);
    expect(STATUS_CHIP_BAR_FRAME_PX).toBe(28);
    expect(STATUS_CHIP_GLYPH_PX).toBe(20);
    expect(STATUS_CHIP_VALUE_FONT_PX).toBe(13);
    expect(STATUS_ROW_GAP_PX).toBeGreaterThanOrEqual(14);
    expect(BUILTIN_STATUS_DISPLAY_DEFAULTS.playerPhoneRows).toBe(1);
    expect(BUILTIN_STATUS_DISPLAY_DEFAULTS.playerDesktopRows).toBe(1);
    expect(CURRENT_SAVE_VERSION).toBe(10);

    const sampleStatuses: ActiveStatusEffect[] = [
      { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
    ];
    const player = makeUnit('p1', 'Kaelen', 'ally', {
      isPlayer: true,
      statuses: sampleStatuses,
    });
    const enemy = makeUnit('e1', 'Drone', 'enemy', {
      statuses: sampleStatuses,
    });

    // Card chip uses 32px frame, 20px glyph, 13px bold value text
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: player,
          isActiveTurn: false,
          isTargeted: false,
          canTarget: true,
          exploding: false,
          skipAnimations: true,
          popups: [],
          onSelect: vi.fn(),
          onInspect: vi.fn(),
        })
      );
    });

    const cardChip = container!.querySelector(
      '[data-testid="card-status-chip-p1-0"]'
    ) as HTMLElement;
    expect(cardChip).not.toBeNull();
    expect(cardChip.getAttribute('data-chip-size')).toBe('sm');
    expect(cardChip.getAttribute('data-chip-frame-px')).toBe('32');
    expect(cardChip.style.fontSize).toBe('13px');
    expect(cardChip.className).toContain('font-bold');

    const cardIconRoot = cardChip.querySelector(
      '[data-testid="catalog-icon-root"]'
    ) as HTMLElement;
    expect(cardIconRoot.style.width).toBe('32px');
    expect(cardIconRoot.style.height).toBe('32px');
    expect(cardIconRoot.getAttribute('data-glyph-px')).toBe('20');
    const cardGlyph = cardIconRoot.querySelector(
      '.material-symbols-outlined'
    ) as HTMLElement;
    expect(cardGlyph.style.fontSize).toBe('20px');

    // Player bar strip in BattleScreen uses 28px frame, 20px glyph, 13px bold value text
    const battle = makeBattle([player, enemy]);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'radar' });
    setViewport(1440, 900);

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const barChip = container!.querySelector(
      '[data-testid="player-status-chip-0"]'
    ) as HTMLElement;
    expect(barChip).not.toBeNull();
    expect(barChip.getAttribute('data-chip-size')).toBe('bar');
    expect(barChip.getAttribute('data-chip-frame-px')).toBe('28');
    expect(barChip.style.fontSize).toBe('13px');
    expect(barChip.className).toContain('font-bold');

    const barIconRoot = barChip.querySelector(
      '[data-testid="catalog-icon-root"]'
    ) as HTMLElement;
    expect(barIconRoot.style.width).toBe('28px');
    expect(barIconRoot.style.height).toBe('28px');
    expect(barIconRoot.getAttribute('data-glyph-px')).toBe('20');

    // Radar marker mini size ('xs') is 20px/12px per G4a-3a, while legend uses 32px/20px chip
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'p1',
          validBasicTargetIds: new Set(['e1']),
          canPlayerManualAct: true,
          hasSingleAllySkill: false,
          autoBattleEnabled: false,
          skipAnimations: true,
          onSelectEnemy: vi.fn(),
          onSelectAlly: vi.fn(),
          onInspectUnit: vi.fn(),
        })
      );
    });

    const radarMarkerIcon = container!.querySelector(
      '[data-testid="radar-status-icon-p1-0"] [data-testid="catalog-icon-root"]'
    ) as HTMLElement;
    expect(radarMarkerIcon).not.toBeNull();
    expect(radarMarkerIcon.getAttribute('data-icon-size')).toBe('xs');
    expect(radarMarkerIcon.style.width).toBe('20px');
    expect(radarMarkerIcon.style.height).toBe('20px');
    expect(radarMarkerIcon.getAttribute('data-glyph-px')).toBe('12');

    const legendBtn = container!.querySelector(
      '[data-testid="radar-legend-toggle"]'
    ) as HTMLButtonElement;
    act(() => {
      legendBtn.click();
    });
    const legendPanel = container!.querySelector(
      '[data-testid="radar-legend-panel"]'
    ) as HTMLElement;
    const legendIcons = Array.from(
      legendPanel.querySelectorAll('[data-testid="catalog-icon-root"]')
    ) as HTMLElement[];
    expect(legendIcons.length).toBeGreaterThanOrEqual(4);
    for (const icon of legendIcons) {
      expect(icon.style.width).toBe('32px');
      expect(icon.getAttribute('data-glyph-px')).toBe('20');
    }

    // Bảng icon modal shows the new 32px/20px chip
    act(() => {
      root!.render(
        createElement(IconCatalogPreviewModal, {
          open: true,
          onClose: vi.fn(),
        })
      );
    });
    const catalogFirstIcon = container!.querySelector(
      `[data-testid="icon-catalog-row-${getCatalog()[0].id}"] [data-testid="catalog-icon-root"]`
    ) as HTMLElement;
    expect(catalogFirstIcon).not.toBeNull();
    expect(catalogFirstIcon.style.width).toBe('32px');
    expect(catalogFirstIcon.getAttribute('data-glyph-px')).toBe('20');
  });

  it('2) Turns badge renders clock + number with yellow #F5C542 bold 11px token on #0B1220 85% pill and 1px outline', () => {
    expect(STATUS_TURNS_BADGE_COLOR).toBe('#F5C542');
    expect(STATUS_TURNS_BADGE_FONT_PX).toBe(11);
    expect(STATUS_TURNS_BADGE_BG).toBe('rgba(11, 18, 32, 0.85)');

    const status: ActiveStatusEffect = {
      type: 'burn',
      turnsRemaining: 3,
      isDebuff: true,
    };

    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(StatusChip, {
            status,
            lang: 'vi',
            size: 'sm',
            badgeLayout: 'B',
            testId: 'chip-sm',
          }),
          createElement(StatusChip, {
            status,
            lang: 'vi',
            size: 'bar',
            badgeLayout: 'B',
            testId: 'chip-bar',
          })
        )
      );
    });

    for (const tid of ['chip-sm', 'chip-bar']) {
      const chip = container!.querySelector(`[data-testid="${tid}"]`)!;
      const turnsBadge = chip.querySelector(
        '[data-testid="status-turns-badge"]'
      ) as HTMLElement;
      const turnsNumber = chip.querySelector(
        '[data-testid="status-turns-number"]'
      ) as HTMLElement;

      expect(turnsBadge).not.toBeNull();
      expect(turnsBadge.textContent).toContain('schedule');
      expect(turnsBadge.style.fontSize).toBe('11px');
      expect(turnsBadge.style.backgroundColor).toBe('rgba(11, 18, 32, 0.85)');
      expect(turnsBadge.style.borderWidth).toBe('1px');
      expect(turnsBadge.className).toContain('bg-[#0B1220]/85');

      expect(turnsNumber).not.toBeNull();
      expect(turnsNumber.textContent).toBe('3');
      expect(turnsNumber.className).toContain('text-[#F5C542]');
      expect(turnsNumber.className).toContain('font-bold');
      expect(turnsNumber.style.color).toBe('rgb(245, 197, 66)');
    }
  });

  it('3) Badge boxes computed from constants do NOT intersect the 20px glyph box, and A/B layouts swap corners', () => {
    expect(STATUS_TURNS_BADGE_OUTSET_PX).toBe(4);

    for (const size of ['sm', 'bar'] as const) {
      for (const layout of ['A', 'B'] as const) {
        const geom = getStatusChipGeometry(size, layout);
        expect(geom.glyphBox.right - geom.glyphBox.left).toBe(20);
        expect(geom.glyphBox.bottom - geom.glyphBox.top).toBe(20);

        // No badge intersects the 20px glyph box
        expect(rectsIntersect(geom.turnsBadgeBox, geom.glyphBox)).toBe(false);
        expect(rectsIntersect(geom.arrowBadgeBox, geom.glyphBox)).toBe(false);
        expect(rectsIntersect(geom.stackBadgeBox, geom.glyphBox)).toBe(false);

        // Turns badge is centered 4px outside the bottom corner
        const turnsCenterX =
          (geom.turnsBadgeBox.left + geom.turnsBadgeBox.right) / 2;
        const turnsCenterY =
          (geom.turnsBadgeBox.top + geom.turnsBadgeBox.bottom) / 2;
        expect(turnsCenterY).toBe(geom.framePx + STATUS_TURNS_BADGE_OUTSET_PX);
        expect(turnsCenterX).toBe(
          layout === 'A'
            ? -STATUS_TURNS_BADGE_OUTSET_PX
            : geom.framePx + STATUS_TURNS_BADGE_OUTSET_PX
        );
      }
    }

    // Verify DOM A/B corner swap on rendered chips
    const buff: ActiveStatusEffect = {
      type: 'atk_up',
      turnsRemaining: 2,
      isDebuff: false,
      magnitude: 0.2,
    };
    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(StatusChip, {
            status: buff,
            lang: 'vi',
            badgeLayout: 'A',
            testId: 'layout-a',
          }),
          createElement(StatusChip, {
            status: buff,
            lang: 'vi',
            badgeLayout: 'B',
            testId: 'layout-b',
          })
        )
      );
    });

    const aTurns = container!.querySelector(
      '[data-testid="layout-a"] [data-testid="status-turns-badge"]'
    ) as HTMLElement;
    const aArrow = container!.querySelector(
      '[data-testid="layout-a"] [data-testid="status-arrow-badge"]'
    ) as HTMLElement;
    const bTurns = container!.querySelector(
      '[data-testid="layout-b"] [data-testid="status-turns-badge"]'
    ) as HTMLElement;
    const bArrow = container!.querySelector(
      '[data-testid="layout-b"] [data-testid="status-arrow-badge"]'
    ) as HTMLElement;

    expect(aTurns.getAttribute('data-badge-corner')).toBe('bottom-left');
    expect(aTurns.style.left).toBe('-4px');
    expect(aArrow.getAttribute('data-badge-corner')).toBe('bottom-right');
    expect(aArrow.style.right).toBe('-4px');

    expect(bTurns.getAttribute('data-badge-corner')).toBe('bottom-right');
    expect(bTurns.style.right).toBe('-4px');
    expect(bArrow.getAttribute('data-badge-corner')).toBe('bottom-left');
    expect(bArrow.style.left).toBe('-4px');
  });

  it('4) Status area height equals rows x (chip + gap) for both card (32) and player bar (28)', () => {
    for (const rows of [1, 2, 3, 4, 5]) {
      expect(getFixedStatusAreaHeightPx(rows, false)).toBe(
        rows * (STATUS_CHIP_FRAME_PX + STATUS_ROW_GAP_PX)
      );
    }
    for (const rows of [1, 2]) {
      expect(getFixedStatusAreaHeightPx(rows, true)).toBe(
        rows * (STATUS_CHIP_BAR_FRAME_PX + STATUS_ROW_GAP_PX)
      );
    }

    const statuses: ActiveStatusEffect[] = [
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
      { type: 'burn', turnsRemaining: 2, isDebuff: true },
      { type: 'def_down', turnsRemaining: 3, isDebuff: true, magnitude: 0.25 },
      { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.2 },
    ];

    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(FixedStatusArea, {
            statuses,
            rows: 2,
            rootTestId: 'area-card-2',
          }),
          createElement(FixedStatusArea, {
            statuses,
            rows: 1,
            compact: true,
            rootTestId: 'area-bar-1',
          })
        )
      );
    });

    const cardArea = container!.querySelector(
      '[data-testid="area-card-2"]'
    ) as HTMLElement;
    const barArea = container!.querySelector(
      '[data-testid="area-bar-1"]'
    ) as HTMLElement;

    expect(cardArea.style.height).toBe(`${2 * (32 + STATUS_ROW_GAP_PX)}px`);
    expect(barArea.style.height).toBe(`${1 * (28 + STATUS_ROW_GAP_PX)}px`);
    expect(cardArea.style.rowGap).toBe(`${STATUS_ROW_GAP_PX}px`);
  });
});
