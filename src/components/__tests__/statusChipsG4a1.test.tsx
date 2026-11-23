// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { getCatalog, ICON_CATALOG_GROUPS } from '../../data/iconCatalog';
import {
  ALL_ENGINE_STATUS_TYPES,
  getCatalogRowForStatus,
  sortStatusEffects,
  STATUS_TO_CATALOG_ID,
  UNMAPPED_STATUS_ALLOWLIST,
} from '../../data/statusIconMap';
import { resolveUnitAction, sortTurnOrder } from '../../engine/combat';
import {
  createDefaultAdminConfig,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../../engine/migration';
import { buildExportEnvelope } from '../../engine/saveExport';
import { translate } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type {
  ActiveStatusEffect,
  BattleState,
  CombatUnit,
} from '../../types/game';
import {
  BUILTIN_STATUS_DISPLAY_DEFAULTS,
  clearStatusDisplayOverride,
  readStatusDisplayOverride,
  resolveEffectiveStatusDisplaySettings,
  STATUS_DISPLAY_STORAGE_KEY,
  writeStatusDisplayOverride,
} from '../../utils/statusDisplayPrefs';
import { writeActionStageEnabled } from '../../utils/actionStagePrefs';
import { AdminPanel } from '../AdminPanel';
import { BattleRadarView } from '../BattleRadarView';
import { BattleScreen } from '../BattleScreen';
import { BattleUnitCard } from '../BattleUnitCard';
import { CatalogIcon } from '../CatalogIcon';
import { EffectsSettingsPanel } from '../EffectsSettingsPanel';
import {
  FixedStatusArea,
  getFixedStatusAreaHeightPx,
  STATUS_ROW_GAP_PX,
} from '../FixedStatusArea';
import { IconCatalogPreviewModal } from '../IconCatalogPreviewModal';
import { StatusChip } from '../StatusChip';
import { TopHud } from '../TopHud';

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

describe('Task G4a-1 Part 2 — Icon catalog, status chips, settings, Bảng icon & layout fixes', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
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

  it('1) Frames, arrow badges, and SS12 multi-layer rendering', () => {
    const catalog = getCatalog();
    const normalRow = catalog.find((r) => r.id === 'BS01')!;
    const buffRow = catalog.find((r) => r.id === 'BF02')!;
    const debuffRow = catalog.find((r) => r.id === 'DB05')!;
    const ss12Row = catalog.find((r) => r.id === 'SS12')!;

    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(
            'div',
            { 'data-testid': 'test-normal' },
            createElement(CatalogIcon, { row: normalRow, showBadges: false })
          ),
          createElement(
            'div',
            { 'data-testid': 'test-buff' },
            createElement(CatalogIcon, { row: buffRow, turnsLeft: 2 })
          ),
          createElement(
            'div',
            { 'data-testid': 'test-debuff' },
            createElement(CatalogIcon, { row: debuffRow, turnsLeft: 3 })
          ),
          createElement(
            'div',
            { 'data-testid': 'test-ss12' },
            createElement(CatalogIcon, { row: ss12Row, showBadges: false })
          )
        )
      );
    });

    // Normal: rounded-square in own hex color, NO arrow badge
    const normalWrap = container!.querySelector('[data-testid="test-normal"]')!;
    const normalFrame = normalWrap.querySelector(
      '[data-testid="status-icon-frame"]'
    ) as HTMLElement;
    expect(normalFrame.getAttribute('data-frame-shape')).toBe('rounded-square');
    expect(normalWrap.querySelector('[data-testid="status-arrow-badge"]')).toBeNull();

    // Buff: round green frame + up arrow badge
    const buffWrap = container!.querySelector('[data-testid="test-buff"]')!;
    const buffFrame = buffWrap.querySelector(
      '[data-testid="status-icon-frame"]'
    ) as HTMLElement;
    const buffArrow = buffWrap.querySelector(
      '[data-testid="status-arrow-badge"]'
    ) as HTMLElement;
    expect(buffFrame.getAttribute('data-frame-shape')).toBe('round');
    expect(buffArrow.getAttribute('data-arrow-dir')).toBe('up');
    expect(buffArrow.textContent).toContain('arrow_upward');

    // Debuff: hex red frame + down arrow badge
    const debuffWrap = container!.querySelector('[data-testid="test-debuff"]')!;
    const debuffFrame = debuffWrap.querySelector(
      '[data-testid="status-icon-frame"]'
    ) as HTMLElement;
    const debuffArrow = debuffWrap.querySelector(
      '[data-testid="status-arrow-badge"]'
    ) as HTMLElement;
    expect(debuffFrame.getAttribute('data-frame-shape')).toBe('hex');
    expect(debuffFrame.className).toContain('status-hex-frame');
    expect(debuffArrow.getAttribute('data-arrow-dir')).toBe('down');
    expect(debuffArrow.textContent).toContain('arrow_downward');

    // SS12: layered symbols rendered back-to-front, ignoring #EF9F27 hex validation color on glyph
    const ss12Wrap = container!.querySelector('[data-testid="test-ss12"]')!;
    const layerSpans = ss12Wrap.querySelectorAll('.material-symbols-outlined');
    expect(layerSpans.length).toBe(ss12Row.layers!.length);
    ss12Row.layers!.forEach((layer, idx) => {
      expect(layerSpans[idx].textContent).toBe(layer.symbol);
    });
  });

  it('2) StatusChip shows short value text ONLY (no name, no "(N lượt)"), respects stack & A/B badge layout', () => {
    const unit = makeUnit('u1', 'Kaelen', 'ally');
    const regen: ActiveStatusEffect = {
      type: 'regen_hp',
      turnsRemaining: 3,
      isDebuff: false,
      magnitude: 0.1,
    };
    const slow: ActiveStatusEffect = {
      type: 'slow',
      turnsRemaining: 2,
      isDebuff: true,
      magnitude: 0.3,
    };

    act(() => {
      root!.render(
        createElement(
          'div',
          null,
          createElement(StatusChip, {
            status: regen,
            lang: 'vi',
            unit,
            badgeLayout: 'B',
            allowStack: false,
            stacks: 1,
            testId: 'chip-single',
          }),
          createElement(StatusChip, {
            status: regen,
            lang: 'vi',
            unit,
            badgeLayout: 'A',
            allowStack: true,
            stacks: 2,
            stackTurns: [3, 2],
            testId: 'chip-stacked',
          }),
          createElement(StatusChip, {
            status: slow,
            lang: 'vi',
            unit,
            badgeLayout: 'B',
            testId: 'chip-slow',
          })
        )
      );
    });

    const single = container!.querySelector('[data-testid="chip-single"]')!;
    expect(single.textContent).toContain('+92 HP/lượt');
    expect(single.textContent).not.toContain('Hồi Phục HP');
    expect(single.textContent).not.toContain('3 lượt');
    expect(single.querySelector('[data-testid="status-stack-badge"]')).toBeNull();

    // Layout B: arrow bottom-left, turns bottom-right
    expect(
      single.querySelector('[data-testid="status-arrow-badge"]')?.className
    ).toContain('-left-1');
    expect(
      single.querySelector('[data-testid="status-turns-badge"]')?.className
    ).toContain('-right-1.5');
    expect(
      single.querySelector('[data-testid="status-turns-badge"]')?.textContent
    ).toContain('schedule');
    expect(
      single.querySelector('[data-testid="status-turns-badge"]')?.textContent
    ).toContain('3');

    // Stacked chip: yellow x2 badge, stacked value +184 HP/lượt, min turns 2, Layout A swapped corners
    const stacked = container!.querySelector('[data-testid="chip-stacked"]')!;
    expect(stacked.textContent).toContain('+184 HP/lượt');
    const stackBadge = stacked.querySelector(
      '[data-testid="status-stack-badge"]'
    ) as HTMLElement;
    expect(stackBadge).not.toBeNull();
    expect(stackBadge.textContent).toBe('x2');
    expect(stackBadge.className).toContain('bg-amber-400');
    expect(
      stacked.querySelector('[data-testid="status-turns-badge"]')?.textContent
    ).toContain('2');
    expect(
      stacked.querySelector('[data-testid="status-arrow-badge"]')?.className
    ).toContain('-right-1');
    expect(
      stacked.querySelector('[data-testid="status-turns-badge"]')?.className
    ).toContain('-left-1.5');

    const slowChip = container!.querySelector('[data-testid="chip-slow"]')!;
    expect(slowChip.textContent).toContain('-30% Tốc');
    expect(slowChip.textContent).not.toContain('Làm chậm');
    expect(slowChip.textContent).not.toContain('2 lượt');
  });

  it('3) Every engine StatusEffectType is mapped or allowlisted, and engine addOrRefreshStatus does NOT create additive stacks', () => {
    const allowSet = new Set(UNMAPPED_STATUS_ALLOWLIST);
    const catalogIds = new Set(getCatalog().map((r) => r.id));

    expect(ALL_ENGINE_STATUS_TYPES).toHaveLength(21);
    for (const statusType of ALL_ENGINE_STATUS_TYPES) {
      const mappedId = STATUS_TO_CATALOG_ID[statusType];
      if (mappedId !== null) {
        expect(catalogIds.has(mappedId)).toBe(true);
        expect(getCatalogRowForStatus(statusType)).not.toBeNull();
      } else {
        expect(allowSet.has(statusType)).toBe(true);
        expect(getCatalogRowForStatus(statusType)).toBeNull();
      }
    }

    // Engine sanity: casting gen_hull_brace twice refreshes def_up instead of stacking additively
    const ally = makeUnit('p1', 'Kaelen', 'ally', {
      isPlayer: true,
      sp: 100,
      equippedSkillIds: ['gen_hull_brace'],
      skillLevels: { gen_hull_brace: 1 },
    });
    const enemy = makeUnit('e1', 'Drone', 'enemy');
    const res1 = resolveUnitAction(
      [ally, enemy],
      'p1',
      'skill',
      'p1',
      1,
      undefined,
      () => 0.5,
      'gen_hull_brace'
    );
    const pAfterFirst = res1.updatedUnits.find((u) => u.id === 'p1')!;
    const withZeroCd = res1.updatedUnits.map((u) =>
      u.id === 'p1' ? { ...u, skillCooldowns: {} } : u
    );
    const res2 = resolveUnitAction(
      withZeroCd,
      'p1',
      'skill',
      'p1',
      2,
      undefined,
      () => 0.5,
      'gen_hull_brace'
    );
    const pAfterSecond = res2.updatedUnits.find((u) => u.id === 'p1')!;
    expect(
      pAfterFirst.statuses.filter((s) => s.type === 'def_up')
    ).toHaveLength(1);
    expect(
      pAfterSecond.statuses.filter((s) => s.type === 'def_up')
    ).toHaveLength(1);
  });

  it('4) FixedStatusArea keeps fixed height across 0/1/12 statuses, sorts debuffs first, enforces 14px rowGap, and opens details without triggering card onSelect', () => {
    expect(STATUS_ROW_GAP_PX).toBeGreaterThanOrEqual(14);
    const heights = [1, 2, 3, 4, 5].map((r) => getFixedStatusAreaHeightPx(r));
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }

    const manyStatuses: ActiveStatusEffect[] = [
      { type: 'atk_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.2 },
      { type: 'spd_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.3 },
      { type: 'def_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
      { type: 'eva_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.25 },
      { type: 'regen_hp', turnsRemaining: 3, isDebuff: false, magnitude: 0.1 },
      { type: 'primary_dmg_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.3 },
      { type: 'skill_dmg_up', turnsRemaining: 2, isDebuff: false, magnitude: 0.3 },
      { type: 'sure_hit', turnsRemaining: 2, isDebuff: false, charges: 1 },
      { type: 'counter', turnsRemaining: 2, isDebuff: false, magnitude: 1.0, charges: 1 },
      { type: 'burn', turnsRemaining: 2, isDebuff: true },
      { type: 'slow', turnsRemaining: 1, isDebuff: true, magnitude: 0.3 },
      { type: 'def_down', turnsRemaining: 3, isDebuff: true, magnitude: 0.3 },
    ];

    const sorted = sortStatusEffects(manyStatuses);
    // Debuffs sorted first, lowest turnsRemaining first
    expect(sorted[0].type).toBe('slow');
    expect(sorted[1].type).toBe('burn');
    expect(sorted[2].type).toBe('def_down');

    const unit = makeUnit('u_test', 'Kaelen', 'ally');
    const getRenderedHeight = (statuses: ActiveStatusEffect[], rows: number) => {
      act(() => {
        root!.render(
          createElement(FixedStatusArea, {
            statuses,
            rows,
            unit,
            unitTitle: 'Kaelen',
            rootTestId: 'fixed-area',
            chipTestIdPrefix: 'fixed-chip',
            overflowTestId: 'fixed-overflow',
          })
        );
      });
      const el = container!.querySelector('[data-testid="fixed-area"]') as HTMLElement;
      return {
        height: el.style.height,
        rowGap: el.style.rowGap,
        overflow: container!.querySelector('[data-testid="fixed-overflow"]')?.textContent,
        firstChipType: container!
          .querySelector('[data-testid="fixed-chip-0"]')
          ?.getAttribute('data-status-type'),
      };
    };

    const h0 = getRenderedHeight([], 2);
    const h1 = getRenderedHeight([manyStatuses[0]], 2);
    const h12 = getRenderedHeight(manyStatuses, 2);

    expect(h0.height).toBe(h1.height);
    expect(h1.height).toBe(h12.height);
    expect(h0.rowGap).toBe('14px');
    expect(h12.firstChipType).toBe('slow');
    expect(h12.overflow).toMatch(/^\+\d+$/);

    // Click status area on BattleUnitCard should NOT call onSelect, and opens desktop popover
    const onSelect = vi.fn();
    act(() => {
      root!.render(
        createElement(BattleUnitCard, {
          unit: makeUnit('p1', 'Kaelen', 'ally', { isPlayer: true, statuses: manyStatuses }),
          isActiveTurn: false,
          isTargeted: false,
          canTarget: true,
          exploding: false,
          skipAnimations: true,
          popups: [],
          onSelect,
          onInspect: vi.fn(),
        })
      );
    });

    const cardArea = container!.querySelector(
      '[data-testid="card-status-row-p1"]'
    ) as HTMLElement;
    act(() => {
      cardArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelect).not.toHaveBeenCalled();
    const popover = container!.querySelector('[data-testid="status-area-popover"]');
    expect(popover).not.toBeNull();
    expect(popover!.textContent).toContain('Làm chậm: -30% Tốc (1 lượt)');
  });

  it('5) Responsive Phone BottomSheet, Player Status Bar, card equal-width columns, and popup containment', () => {
    setViewport(390, 844);
    const player = makeUnit('u_player', 'Kaelen Long Callsign', 'ally', {
      isPlayer: true,
      statuses: [
        { type: 'slow', turnsRemaining: 2, isDebuff: true, magnitude: 0.3 },
        { type: 'burn', turnsRemaining: 1, isDebuff: true },
        { type: 'atk_up', turnsRemaining: 3, isDebuff: false, magnitude: 0.25 },
      ],
    });
    const enemy = makeUnit('u_enemy', 'Enemy Striker', 'enemy');
    const battle = makeBattle([player, enemy]);
    battle.popups = [
      {
        id: 'pop1',
        unitId: 'u_player',
        text: '-120',
        tone: 'damage',
      },
    ];
    useGameStore.setState({ battle, battleViewMode: 'card' });
    writeActionStageEnabled(false);

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    // Player status bar uses FixedStatusArea even on compact phone width
    const playerArea = container!.querySelector(
      '[data-testid="battle-player-status-effects"]'
    ) as HTMLElement;
    expect(playerArea).not.toBeNull();
    expect(playerArea.getAttribute('data-status-area-rows')).toBe('1');

    // Tapping player status area on phone opens BottomSheet
    act(() => {
      playerArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const sheetBody = container!.querySelector(
      '[data-testid="status-area-sheet-body"]'
    );
    expect(sheetBody).not.toBeNull();
    expect(sheetBody!.textContent).toContain('Thiêu đốt');

    // Close modal before inspecting cards
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    // Verify player card on phone (in Ally tab) & popup containment
    const allyTab = container!.querySelector(
      '[data-testid="card-tab-ally"]'
    ) as HTMLButtonElement | null;
    if (allyTab) {
      act(() => {
        allyTab.click();
      });
    }
    const phonePlayerCard = container!.querySelector(
      '[data-testid="unit-row-u_player"]'
    ) as HTMLElement;
    expect(phonePlayerCard).not.toBeNull();
    expect(phonePlayerCard.className).toContain('w-full');
    expect(phonePlayerCard.className).toContain('min-w-0');
    expect(phonePlayerCard.className).toContain('overflow-hidden');
    const popupWrap = phonePlayerCard.querySelector(
      '[data-testid="card-popups-container-u_player"]'
    ) as HTMLElement;
    expect(popupWrap).not.toBeNull();
    expect(popupWrap.className).toContain('overflow-hidden');

    // Switch to desktop width to verify equal-width minmax(0,1fr) columns for Ally & Enemy cards
    act(() => {
      setViewport(1280, 800);
    });
    const cardView = container!.querySelector(
      '[data-testid="battle-card-view"]'
    ) as HTMLElement;
    expect(cardView).not.toBeNull();
    const grid = cardView.querySelector(
      '.grid-cols-\\[minmax\\(0\\,1fr\\)_minmax\\(0\\,1fr\\)\\]'
    ) as HTMLElement;
    expect(grid).not.toBeNull();
  });

  it('6) Status prefs clamping, separate phone/desktop, precedence, "Dùng mặc định", migration & SV1a isolation', async () => {
    // Corrupted/out-of-range storage gets clamped
    window.localStorage.setItem(
      STATUS_DISPLAY_STORAGE_KEY,
      JSON.stringify({
        badgeLayout: 'Z',
        phoneRows: 99,
        desktopRows: -4,
        playerPhoneRows: 8,
        playerDesktopRows: 0,
      })
    );
    const clampedRead = readStatusDisplayOverride();
    expect(clampedRead.badgeLayout).toBeUndefined();
    expect(clampedRead.phoneRows).toBe(5);
    expect(clampedRead.desktopRows).toBe(1);
    expect(clampedRead.playerPhoneRows).toBe(2);
    expect(clampedRead.playerDesktopRows).toBe(1);

    // Precedence: Player > Admin > Built-in
    const adminDef = {
      badgeLayout: 'A' as const,
      phoneRows: 4,
      desktopRows: 5,
      playerPhoneRows: 2,
      playerDesktopRows: 1,
    };
    clearStatusDisplayOverride();
    expect(resolveEffectiveStatusDisplaySettings(adminDef, null)).toEqual({
      badgeLayout: 'A',
      phoneRows: 4,
      desktopRows: 5,
      playerPhoneRows: 2,
      playerDesktopRows: 1,
    });

    writeStatusDisplayOverride({ phoneRows: 1, desktopRows: 2 });
    const withPlayer = resolveEffectiveStatusDisplaySettings(
      adminDef,
      readStatusDisplayOverride()
    );
    expect(withPlayer.phoneRows).toBe(1);
    expect(withPlayer.desktopRows).toBe(2);
    expect(withPlayer.badgeLayout).toBe('A'); // falls back to admin

    // Settings UI: note + "Dùng mặc định" button clears dreamAce.status.v1
    useGameStore.setState({
      adminConfig: {
        ...createDefaultAdminConfig(),
        statusDisplayDefaults: adminDef,
      },
    });
    act(() => {
      root!.render(createElement(EffectsSettingsPanel));
    });
    expect(container!.textContent).toContain(
      'Nhiều hàng làm trang dài hơn trên điện thoại'
    );
    const resetBtn = container!.querySelector(
      '[data-testid="status-reset-defaults-btn"]'
    ) as HTMLButtonElement;
    expect(resetBtn.disabled).toBe(false);
    act(() => {
      resetBtn.click();
    });
    expect(window.localStorage.getItem(STATUS_DISPLAY_STORAGE_KEY)).toBeNull();
    expect(
      resolveEffectiveStatusDisplaySettings(adminDef, readStatusDisplayOverride())
    ).toEqual(adminDef);

    // Built-in defaults & old saves without statusDisplayDefaults + CURRENT_SAVE_VERSION=9
    expect(CURRENT_SAVE_VERSION).toBe(9);
    const migrated = migrateSaveData({ credits: 500 }, 8);
    expect(
      resolveEffectiveStatusDisplaySettings(
        migrated.adminConfig?.statusDisplayDefaults,
        null
      )
    ).toEqual(BUILTIN_STATUS_DISPLAY_DEFAULTS);

    // SV1a save export does NOT include dreamAce.status.v1
    writeStatusDisplayOverride({ phoneRows: 4, badgeLayout: 'A' });
    const env = await buildExportEnvelope(useGameStore.getState());
    expect(env.saveVersion).toBe(9);
    expect(JSON.stringify(env)).not.toContain('dreamAce.status.v1');
  });

  it('7) "Bảng icon" preview renders all 98 sys rows + mods across 8 groups, and read-only', () => {
    useGameStore.setState({
      adminConfig: {
        ...createDefaultAdminConfig(),
        iconCatalogMods: [
          {
            id: 'BF99',
            nameVi: 'Mod Test Overdrive',
            group: 'BF',
            symbol: 'rocket_launch',
            color: '#1D9E75',
            kind: 'buff',
          },
        ],
      },
    });

    act(() => {
      root!.render(
        createElement(IconCatalogPreviewModal, {
          open: true,
          onClose: vi.fn(),
        })
      );
    });

    const modal = container!.querySelector('[data-testid="icon-catalog-modal"]');
    expect(modal).not.toBeNull();
    for (const grp of ICON_CATALOG_GROUPS) {
      expect(
        modal!.querySelector(`[data-testid="icon-catalog-group-${grp.id}"]`)
      ).not.toBeNull();
    }
    const sysTags = Array.from(
      modal!.querySelectorAll('[data-testid^="icon-catalog-tag-"]')
    );
    expect(sysTags.filter((el) => el.textContent === 'sys')).toHaveLength(98);
    expect(
      modal!.querySelector('[data-testid="icon-catalog-tag-BF99"]')?.textContent
    ).toBe('mods');
    // Read-only: no inputs/textareas inside preview grid
    expect(modal!.querySelectorAll('input, textarea, select')).toHaveLength(0);
  });

  it('8) Admin CP entry in TopHud/Battle more menu + "Mặc định trạng thái" section + vi/en renames + Radar legend', () => {
    expect(translate('vi', 'status.vulnerable')).toBe('Dễ tổn thương');
    expect(translate('en', 'status.vulnerable')).toBe('Vulnerable');
    expect(translate('vi', 'battle.rowProtected')).toBe('Bảo vệ');
    expect(translate('en', 'battle.rowProtected')).toBe('Protected');
    expect(translate('vi', 'battle.rowExposed')).toBe('Lộ diện');

    // TopHud settings bottom Admin CP button
    act(() => {
      root!.render(createElement(TopHud));
    });
    const settingsBtn = container!.querySelector(
      '[aria-label="Cài đặt"]'
    ) as HTMLButtonElement;
    act(() => {
      settingsBtn.click();
    });
    const topHudAdminBtn = container!.querySelector(
      '[data-testid="tophud-settings-admin-btn"]'
    ) as HTMLButtonElement;
    expect(topHudAdminBtn).not.toBeNull();
    expect(topHudAdminBtn.textContent).toContain('Admin CP');
    act(() => {
      topHudAdminBtn.click();
    });
    expect(useGameStore.getState().adminPanelOpen).toBe(true);

    // AdminPanel Battle tab contains "Mặc định trạng thái"
    act(() => {
      root!.render(createElement(AdminPanel));
    });
    const battleTab = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Chiến đấu') || b.textContent?.includes('Battle')
    );
    if (battleTab) {
      act(() => {
        battleTab.click();
      });
    }
    expect(
      container!.querySelector('[data-testid="admin-status-defaults-section"]')
    ).not.toBeNull();

    // Radar legend includes Buff, Debuff, Stack (x2), and Turns left
    const battle = makeBattle([
      makeUnit('p1', 'Kaelen', 'ally', { isPlayer: true }),
      makeUnit('e1', 'Drone', 'enemy'),
    ]);
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
    const legendBtn = container!.querySelector(
      '[data-testid="radar-legend-toggle"]'
    ) as HTMLButtonElement;
    act(() => {
      legendBtn.click();
    });
    const legendPanel = container!.querySelector(
      '[data-testid="radar-legend-panel"]'
    )!;
    expect(legendPanel.textContent).toContain('Buff');
    expect(legendPanel.textContent).toContain('Debuff');
    expect(legendPanel.textContent).toContain('x2');
    expect(legendPanel.textContent).toContain('Lượt còn lại');
  });
});
