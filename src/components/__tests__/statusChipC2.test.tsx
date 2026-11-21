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
  clearStatusDisplayOverride,
  getStatusChipGeometry,
  rectsIntersect,
  STATUS_AREA_PAD_TOP_PX,
  STATUS_AREA_PAD_X_PX,
  STATUS_ARROW_BADGE_PX,
  STATUS_ARROW_BORDER_COLOR,
  STATUS_ARROW_BORDER_PX,
  STATUS_ARROW_GLYPH_PX,
  STATUS_BADGE_SAFE_PX,
  STATUS_CHIP_PAD_LEFT_PX,
  STATUS_CHIP_PAD_RIGHT_PX,
  STATUS_ICON_SIZE_SPECS,
  STATUS_TURNS_BADGE_OUTSET_PX,
} from '../../utils/statusDisplayPrefs';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { BattleUnitCard } from '../BattleUnitCard';
import { FixedStatusArea, getFixedStatusAreaHeightPx } from '../FixedStatusArea';
import { IconCatalogPreviewModal } from '../IconCatalogPreviewModal';

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

function parseMaxHeightPx(className: string): number | null {
  const m = className.match(/max-h-\[(\d+)px\]/);
  return m ? Number(m[1]) : null;
}

describe('TASK C2 — Status chip unclipping + 14px bold arrow badge', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    setViewport(1440, 900);
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

  it('1) Player status bar wrapper has NO overflow-hidden and NO max-h smaller than natural height computed from constants (desktop & phone)', () => {
    const playerStatuses: ActiveStatusEffect[] = [
      { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
    ];
    const player = makeUnit('p1', 'Kaelen Vance', 'ally', {
      isPlayer: true,
      statuses: playerStatuses,
    });
    const enemy = makeUnit('e1', 'Vanguard 1', 'enemy', {
      statuses: playerStatuses,
    });
    const battle = makeBattle([player, enemy]);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'radar' });

    // Natural desktop player status bar height from constants:
    // border (2px) + py-0.5 (4px) + header row (22px) + space-y-0.5 (2px) + FixedStatusArea(1, compact=true) (42px) = 72px
    const naturalDesktopPlayerBarHeightPx =
      2 + 4 + 22 + 2 + getFixedStatusAreaHeightPx(1, true);
    expect(naturalDesktopPlayerBarHeightPx).toBe(72);

    setViewport(1440, 900);
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const desktopPlayerBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    const desktopStatusArea = container!.querySelector(
      '[data-testid="battle-player-status-effects"]'
    ) as HTMLElement;
    expect(desktopPlayerBar).not.toBeNull();
    expect(desktopPlayerBar.className).not.toContain('overflow-hidden');
    const maxH = parseMaxHeightPx(desktopPlayerBar.className);
    expect(maxH).not.toBeNull();
    expect(maxH!).toBeGreaterThanOrEqual(naturalDesktopPlayerBarHeightPx);
    expect(maxH! - 64).toBeLessThanOrEqual(8);
    expect(desktopStatusArea.className).toContain('overflow-visible');
    expect(desktopStatusArea.className).not.toContain('overflow-hidden');

    // Phone portrait player status bar also has no overflow-hidden and uses overflow-visible FixedStatusArea
    setViewport(390, 844);
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const phonePlayerBar = container!.querySelector(
      '[data-testid="battle-player-status-bar"]'
    ) as HTMLElement;
    const phoneStatusArea = container!.querySelector(
      '[data-testid="battle-player-status-effects"]'
    ) as HTMLElement;
    expect(phonePlayerBar).not.toBeNull();
    expect(phonePlayerBar.className).not.toContain('overflow-hidden');
    expect(parseMaxHeightPx(phonePlayerBar.className)).toBeNull();
    expect(phoneStatusArea.className).toContain('overflow-visible');
    expect(phoneStatusArea.className).not.toContain('overflow-hidden');
  });

  it('2) Scroll box (sidebar-status-area) keeps 92px fixed height and has >= STATUS_BADGE_SAFE_PX padding on all 4 sides, while non-scroll unit card FixedStatusArea is overflow-visible', () => {
    expect(STATUS_BADGE_SAFE_PX).toBe(6);

    const fiveStatuses: ActiveStatusEffect[] = [
      { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
      { type: 'burn', turnsRemaining: 2, isDebuff: true },
      { type: 'def_down', turnsRemaining: 3, isDebuff: true, magnitude: 0.25 },
      { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.2 },
      { type: 'spd_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.3 },
    ];
    const player = makeUnit('p1', 'Kaelen Vance', 'ally', {
      isPlayer: true,
      statuses: fiveStatuses,
    });
    const enemy = makeUnit('e1', 'Vanguard 1', 'enemy', {
      statuses: fiveStatuses,
    });
    const battle = makeBattle([player, enemy]);
    useGameStore.setState({ screen: 'BATTLE', battle, battleViewMode: 'card' });
    setViewport(1440, 900);

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const sidebarStatusArea = container!.querySelector(
      '[data-testid="sidebar-status-area"]'
    ) as HTMLElement;
    expect(sidebarStatusArea).not.toBeNull();
    expect(sidebarStatusArea.style.height).toBe('92px');
    expect(sidebarStatusArea.style.minHeight).toBe('92px');
    expect(sidebarStatusArea.style.maxHeight).toBe('92px');
    expect(sidebarStatusArea.className).toContain('overflow-y-auto');

    const padLeft = parseInt(sidebarStatusArea.style.paddingLeft, 10);
    const padRight = parseInt(sidebarStatusArea.style.paddingRight, 10);
    const padTop = parseInt(sidebarStatusArea.style.paddingTop, 10);
    const padBottom = parseInt(sidebarStatusArea.style.paddingBottom, 10);
    expect(padLeft).toBeGreaterThanOrEqual(
      STATUS_AREA_PAD_X_PX + STATUS_BADGE_SAFE_PX
    );
    expect(padRight).toBeGreaterThanOrEqual(
      STATUS_AREA_PAD_X_PX + STATUS_BADGE_SAFE_PX
    );
    expect(padTop).toBeGreaterThanOrEqual(STATUS_BADGE_SAFE_PX);
    expect(padBottom).toBeGreaterThanOrEqual(STATUS_BADGE_SAFE_PX);

    // Non-scroll FixedStatusArea inside BattleUnitCard is overflow-visible
    const cardStatusArea = container!.querySelector(
      '[data-testid="card-status-row-p1"]'
    ) as HTMLElement;
    expect(cardStatusArea).not.toBeNull();
    expect(cardStatusArea.className).toContain('overflow-visible');
    expect(cardStatusArea.className).not.toContain('overflow-hidden');
  });

  it('3) Arrow badge constants are 14/12, rendered with bold arrow, 1px #0B1220 outline, catalog green/red colors, non-intersecting geometry in A & B, and radar xs chips stay untouched', () => {
    expect(STATUS_ARROW_BADGE_PX).toBe(14);
    expect(STATUS_ARROW_GLYPH_PX).toBe(12);
    expect(STATUS_ARROW_BORDER_PX).toBe(1);
    expect(STATUS_ARROW_BORDER_COLOR).toBe('#0B1220');
    expect(CURRENT_SAVE_VERSION).toBe(9);

    for (const variant of ['bar', 'sm', 'md', 'lg'] as const) {
      expect(STATUS_ICON_SIZE_SPECS[variant].arrowBoxPx).toBe(14);
      expect(STATUS_ICON_SIZE_SPECS[variant].arrowFontPx).toBe(12);
      expect(STATUS_ICON_SIZE_SPECS[variant].turnsOutsetPx).toBe(4);
    }

    // Radar xs chips must remain untouched
    expect(STATUS_ICON_SIZE_SPECS.xs).toEqual({
      boxPx: 18,
      iconFontPx: 12,
      lucideSizePx: 12,
      arrowBoxPx: 9,
      arrowFontPx: 7,
      turnsFontPx: 8,
      turnsClockPx: 7,
      turnsOutsetPx: 0,
      stackFontPx: 8,
    });

    // Geometry check: arrowBadgeBox does NOT intersect 20px glyphBox or turnsBadgeBox or stackBadgeBox in A or B
    for (const size of ['bar', 'sm', 'md', 'lg'] as const) {
      for (const layout of ['A', 'B'] as const) {
        const geom = getStatusChipGeometry(size, layout);
        expect(geom.arrowBadgeBox.right - geom.arrowBadgeBox.left).toBe(14);
        expect(geom.arrowBadgeBox.bottom - geom.arrowBadgeBox.top).toBe(14);
        expect(rectsIntersect(geom.arrowBadgeBox, geom.glyphBox)).toBe(false);
        expect(rectsIntersect(geom.arrowBadgeBox, geom.turnsBadgeBox)).toBe(false);
        expect(rectsIntersect(geom.arrowBadgeBox, geom.stackBadgeBox)).toBe(false);
      }
    }

    // Render card chip & Bảng icon modal & Radar xs to verify DOM attributes & styles
    const buffUnit = makeUnit('u_buff', 'Kaelen', 'ally', {
      isPlayer: true,
      statuses: [
        { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
        { type: 'burn', turnsRemaining: 2, isDebuff: true },
      ],
    });
    const enemyUnit = makeUnit('u_debuff', 'Drone', 'enemy', {
      statuses: [{ type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 }],
    });

    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: buffUnit,
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

    // Debuff sorted first (index 0), buff second (index 1)
    const debuffArrow = container!.querySelector(
      '[data-testid="card-status-chip-u_buff-0"] [data-testid="status-arrow-badge"]'
    ) as HTMLElement;
    const buffArrow = container!.querySelector(
      '[data-testid="card-status-chip-u_buff-1"] [data-testid="status-arrow-badge"]'
    ) as HTMLElement;

    expect(debuffArrow).not.toBeNull();
    expect(debuffArrow.style.width).toBe('14px');
    expect(debuffArrow.style.height).toBe('14px');
    expect(debuffArrow.style.backgroundColor).toBe('rgb(226, 75, 74)'); // #E24B4A
    expect(debuffArrow.style.borderWidth).toBe('1px');
    expect(debuffArrow.style.borderColor).toBe('rgb(11, 18, 32)'); // #0B1220
    expect(debuffArrow.getAttribute('data-arrow-dir')).toBe('down');
    const debuffGlyph = debuffArrow.querySelector(
      '.material-symbols-outlined'
    ) as HTMLElement;
    expect(debuffGlyph.style.fontSize).toBe('12px');
    expect(debuffGlyph.className).toContain('font-bold');
    expect(debuffGlyph.textContent?.trim()).toBe('arrow_downward');

    expect(buffArrow).not.toBeNull();
    expect(buffArrow.style.width).toBe('14px');
    expect(buffArrow.style.height).toBe('14px');
    expect(buffArrow.style.backgroundColor).toBe('rgb(29, 158, 117)'); // #1D9E75
    expect(buffArrow.style.borderWidth).toBe('1px');
    expect(buffArrow.style.borderColor).toBe('rgb(11, 18, 32)'); // #0B1220
    expect(buffArrow.getAttribute('data-arrow-dir')).toBe('up');
    const buffGlyph = buffArrow.querySelector(
      '.material-symbols-outlined'
    ) as HTMLElement;
    expect(buffGlyph.style.fontSize).toBe('12px');
    expect(buffGlyph.className).toContain('font-bold');
    expect(buffGlyph.textContent?.trim()).toBe('arrow_upward');

    // Radar xs keeps 9px badge & 7px glyph
    const battle = makeBattle([buffUnit, enemyUnit]);
    act(() => {
      root!.render(
        createElement(BattleRadarView, {
          battle,
          activeUnitId: 'u_buff',
          validBasicTargetIds: new Set(['u_debuff']),
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
    const radarArrow = container!.querySelector(
      '[data-testid="radar-status-icon-u_buff-0"] [data-testid="status-arrow-badge"]'
    ) as HTMLElement;
    expect(radarArrow).not.toBeNull();
    expect(radarArrow.style.width).toBe('9px');
    expect(radarArrow.style.height).toBe('9px');
    expect(
      (radarArrow.querySelector('.material-symbols-outlined') as HTMLElement).style
        .fontSize
    ).toBe('7px');

    // Bảng icon modal renders 14px/12px arrow badge cleanly inside p-4 scroll container
    act(() => {
      root!.render(
        createElement(IconCatalogPreviewModal, {
          open: true,
          onClose: vi.fn(),
        })
      );
    });
    const catalogFirstBuff = getCatalog().find((r) => r.kind === 'buff')!;
    const catalogArrow = container!.querySelector(
      `[data-testid="icon-catalog-row-${catalogFirstBuff.id}"] [data-testid="status-arrow-badge"]`
    ) as HTMLElement;
    expect(catalogArrow).not.toBeNull();
    expect(catalogArrow.style.width).toBe('14px');
    expect(catalogArrow.style.height).toBe('14px');
  });

  it('4) Arithmetic container bounds verification across all 5 Step 0 places (layouts A & B)', () => {
    const scrollPadBottom = Math.max(
      STATUS_BADGE_SAFE_PX,
      STATUS_TURNS_BADGE_OUTSET_PX + Math.ceil(STATUS_ARROW_BADGE_PX / 2) + 1
    );
    const chipBorder = 1;

    for (const layout of ['A', 'B'] as const) {
      const barGeom = getStatusChipGeometry('bar', layout);
      const smGeom = getStatusChipGeometry('sm', layout);

      // Place 1: Player status bar (desktop 72px & phone unclipped; FixedStatusArea overflow-visible)
      const barFrameOffsetX =
        8 /* wrapper px-2 */ +
        STATUS_AREA_PAD_X_PX +
        chipBorder +
        STATUS_CHIP_PAD_LEFT_PX;
      expect(barFrameOffsetX + barGeom.turnsBadgeBox.left).toBeGreaterThanOrEqual(0);
      expect(barFrameOffsetX + barGeom.arrowBadgeBox.left).toBeGreaterThanOrEqual(0);
      // FixedStatusArea(1, compact=true) height is 42; frame sits at y = 2 + 1 = 3..31
      const barAreaHeight = getFixedStatusAreaHeightPx(1, true);
      const barFrameBottomY = STATUS_AREA_PAD_TOP_PX + chipBorder + barGeom.framePx;
      expect(
        barFrameBottomY + (barGeom.turnsBadgeBox.bottom - barGeom.framePx)
      ).toBeLessThanOrEqual(barAreaHeight);
      expect(
        barFrameBottomY + (barGeom.arrowBadgeBox.bottom - barGeom.framePx)
      ).toBeLessThanOrEqual(barAreaHeight);

      // Place 2: Unit cards (FixedStatusArea overflow-visible inside BattleUnitCard px-2 py-1 overflow-hidden)
      const cardOffsetX =
        8 /* card px-2 */ +
        STATUS_AREA_PAD_X_PX +
        chipBorder +
        STATUS_CHIP_PAD_LEFT_PX;
      expect(cardOffsetX + smGeom.turnsBadgeBox.left).toBeGreaterThanOrEqual(0);
      expect(cardOffsetX + smGeom.arrowBadgeBox.left).toBeGreaterThanOrEqual(0);
      // Right edge when showLabels=false
      const cardRightReserve =
        8 /* card px-2 */ +
        STATUS_AREA_PAD_X_PX +
        chipBorder +
        STATUS_CHIP_PAD_RIGHT_PX;
      expect(
        smGeom.turnsBadgeBox.right - smGeom.framePx
      ).toBeLessThanOrEqual(cardRightReserve);
      // Bottom of 2-row FixedStatusArea inside card (plus 4px card py-1)
      const cardAreaH = getFixedStatusAreaHeightPx(2, false);
      const cardRow2BottomY =
        STATUS_AREA_PAD_TOP_PX + (chipBorder * 2 + smGeom.framePx) + 14 + chipBorder + smGeom.framePx;
      expect(
        cardRow2BottomY + (smGeom.turnsBadgeBox.bottom - smGeom.framePx)
      ).toBeLessThanOrEqual(cardAreaH + 4);

      // Place 3: Selected-unit panel sidebar-status-area (92px fixed height, scrollOverflow safe padding)
      const sidebarPadX = STATUS_AREA_PAD_X_PX + STATUS_BADGE_SAFE_PX; // 14
      const sidebarPadTop = STATUS_AREA_PAD_TOP_PX + STATUS_BADGE_SAFE_PX; // 8
      const sidebarOffsetX = sidebarPadX + chipBorder + STATUS_CHIP_PAD_LEFT_PX; // 21
      expect(sidebarOffsetX + smGeom.turnsBadgeBox.left).toBeGreaterThanOrEqual(0);
      expect(sidebarOffsetX + smGeom.arrowBadgeBox.left).toBeGreaterThanOrEqual(0);
      const sidebarRightReserve = sidebarPadX + chipBorder + STATUS_CHIP_PAD_RIGHT_PX; // 23
      expect(
        smGeom.turnsBadgeBox.right - smGeom.framePx
      ).toBeLessThanOrEqual(sidebarRightReserve);
      // 2-row scrollable content height = sidebarPadTop(8) + row1(34) + gap(14) + row2(34) + scrollPadBottom(12) = 102
      const sidebarContentHeight =
        sidebarPadTop + (chipBorder * 2 + smGeom.framePx) * 2 + 14 + scrollPadBottom;
      const sidebarRow2FrameBottom =
        sidebarPadTop + (chipBorder * 2 + smGeom.framePx) + 14 + chipBorder + smGeom.framePx;
      expect(
        sidebarRow2FrameBottom + (smGeom.turnsBadgeBox.bottom - smGeom.framePx)
      ).toBeLessThanOrEqual(sidebarContentHeight);

      // Place 4: Popovers & BottomSheets (FixedStatusArea detail p-3 + pl-4 pr-3 py-2.5; BottomSheet p-4 + px-3 py-2)
      const popoverOffsetX = 12 /* p-3 */ + 1 /* border */ + 16 /* pl-4 */; // 29
      const popoverOffsetTop = 12 /* p-3 */ + 1 /* border */ + 10 /* py-2.5 */ + 2 /* pt-0.5 */; // 25
      expect(popoverOffsetX + smGeom.turnsBadgeBox.left).toBeGreaterThanOrEqual(0);
      expect(popoverOffsetTop + smGeom.stackBadgeBox.top).toBeGreaterThanOrEqual(0);
      expect(
        smGeom.turnsBadgeBox.bottom - smGeom.framePx
      ).toBeLessThanOrEqual(12 + 1 + 10);

      // Place 5: Bảng icon (p-4 = 16px scroll container + px-2.5 py-2 = 10px/8px card, showBadges=false, arrow only)
      const catalogOffsetX = 16 /* p-4 */ + 1 /* border */ + 10 /* px-2.5 */; // 27
      const catalogOffsetBottom = 8 /* py-2 */ + 1 /* border */ + 16 /* p-4 */; // 25
      expect(catalogOffsetX + smGeom.arrowBadgeBox.left).toBeGreaterThanOrEqual(0);
      expect(
        smGeom.arrowBadgeBox.bottom - smGeom.framePx
      ).toBeLessThanOrEqual(catalogOffsetBottom);
    }
  });
});
