// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_STAT_BLOCK } from '../../data/classes';
import { sortTurnOrder } from '../../engine/combat';
import { createDefaultAdminConfig, CURRENT_SAVE_VERSION } from '../../engine/migration';
import { buildExportEnvelope } from '../../engine/saveExport';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { ActiveStatusEffect, BattleSize, BattleState, CombatUnit } from '../../types/game';
import {
  STATUS_BADGE_SAFE_PX,
  STATUS_CHIP_FRAME_PX,
} from '../../utils/statusDisplayPrefs';
import { BattleScreen } from '../BattleScreen';
import {
  STATUS_BOARD_DESKTOP_HEIGHT_PX,
  STATUS_BOARD_HEADER_HEIGHT_PX,
  STATUS_BOARD_MAX_VISIBLE_ROWS,
  STATUS_BOARD_ROW_HEIGHT_PX,
  STATUS_BOARD_STORAGE_KEY,
} from '../RadarStatusBoard';
import { StatusChip } from '../StatusChip';

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

function makeStatus(
  type: ActiveStatusEffect['type'],
  turnsRemaining = 2,
  isDebuff = false
): ActiveStatusEffect {
  return {
    type,
    turnsRemaining,
    isDebuff,
    magnitude: type === 'burn' ? undefined : 0.25,
  };
}

function makeUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  overrides: Partial<CombatUnit> = {}
): CombatUnit {
  const maxHp = overrides.derived?.maxHp ?? 800;
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
      maxShield: 200,
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
      ...(overrides.derived ?? {}),
    },
    hp: overrides.hp ?? maxHp,
    shield: overrides.shield ?? 120,
    sp: overrides.sp ?? 60,
    isDefending: overrides.isDefending ?? false,
    alive: overrides.alive ?? true,
    statuses: overrides.statuses ?? [],
    animState: overrides.animState ?? 'idle',
  };
}

function makeBattle(units: CombatUnit[]): BattleState {
  const firstEnemy = units.find((u) => u.side === 'enemy' && u.alive)?.id ?? null;
  const firstAlly = units.find((u) => u.side === 'ally' && u.alive)?.id ?? null;
  return {
    sectorId: 'border_outpost',
    deployedGearId: 'striker',
    squadSize: Math.min(8, Math.max(4, Math.ceil(units.length / 2))) as BattleSize,
    round: 2,
    turnCounter: 3,
    turnOrder: sortTurnOrder(units),
    activeTurnIndex: 0,
    units,
    selectedTargetId: firstEnemy,
    selectedAllyTargetId: firstAlly,
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

describe('TASK G4a-3b — Radar Status Board (under radar)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    setViewport(1440, 900);
    useGameStore.getState().resetCampaign();
    useGameStore.setState({
      language: 'vi',
      screen: 'BATTLE',
      battleViewMode: 'radar',
      autoBattleEnabled: false,
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

  it('Item 1: Desktop/tablet board sits directly under radar with 28px header, Ta|Địch columns, 48px rows (chip + 2*safe + 4), non-clipping chip area, max 6 32px chips + "+N", hides dead/empty units, constant 220px height for 0/1/8 rows, and collapses cleanly', () => {
    expect(CURRENT_SAVE_VERSION).toBe(9);
    expect(STATUS_BOARD_HEADER_HEIGHT_PX).toBe(28);
    expect(STATUS_BOARD_ROW_HEIGHT_PX).toBe(
      STATUS_CHIP_FRAME_PX + 2 * STATUS_BADGE_SAFE_PX + 4
    );
    expect(STATUS_BOARD_ROW_HEIGHT_PX).toBe(48);
    expect(STATUS_BOARD_DESKTOP_HEIGHT_PX).toBe(
      STATUS_BOARD_HEADER_HEIGHT_PX +
        STATUS_BOARD_MAX_VISIBLE_ROWS * STATUS_BOARD_ROW_HEIGHT_PX
    );
    expect(STATUS_BOARD_DESKTOP_HEIGHT_PX).toBe(220);

    // Case A: 0 units with statuses (and dead / empty units present) -> muted empty line, constant 220px height
    const emptyUnits = [
      makeUnit('p1', 'Vance', 'ally', { isPlayer: true, statuses: [] }),
      makeUnit('a_dead', 'Fallen Wing', 'ally', {
        alive: false,
        statuses: [makeStatus('atk_up', 2, false)],
      }),
      makeUnit('e1', 'Drone 1', 'enemy', { statuses: [] }),
    ];
    useGameStore.setState({ battle: makeBattle(emptyUnits) });
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const mainField = container!.querySelector(
      '[data-testid="battle-main-field"]'
    ) as HTMLElement;
    const boardEmpty = container!.querySelector(
      '[data-testid="radar-status-board"]'
    ) as HTMLElement;
    expect(boardEmpty).not.toBeNull();
    expect(boardEmpty.getAttribute('data-variant')).toBe('desktop');
    expect(
      Boolean(
        mainField.compareDocumentPosition(boardEmpty) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(boardEmpty.style.height).toBe('220px');
    expect(boardEmpty.className).toContain('h-[220px]');
    expect(
      boardEmpty.querySelector('[data-testid="status-board-header-title"]')?.textContent
    ).toBe('Trạng thái · Ta 0 · Địch 0');
    expect(
      boardEmpty.querySelector('[data-testid="status-board-empty"]')?.textContent
    ).toBe('Không có hiệu ứng');
    expect(boardEmpty.querySelector('[data-testid="status-board-row-a_dead"]')).toBeNull();
    expect(boardEmpty.querySelector('[data-testid="status-board-row-p1"]')).toBeNull();

    // Verify radar above still keeps min-h-[420px] and header caps <= 150px
    const radarBox = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    ) as HTMLElement;
    expect(radarBox.className).toContain('min-h-[420px]');
    const mainHeader = container!.querySelector(
      '[data-testid="battle-main-header"]'
    ) as HTMLElement;
    expect(mainHeader.className).toContain('max-h-[150px]');

    // Case B: 1 unit with statuses (7 statuses -> max 6 32px chips + "+1"), hides dead & empty -> still constant 220px height
    const sevenStatuses: ActiveStatusEffect[] = [
      makeStatus('burn', 2, true),
      makeStatus('slow', 3, true),
      makeStatus('def_down', 2, true),
      makeStatus('vulnerable', 4, true),
      makeStatus('atk_up', 2, false),
      makeStatus('spd_up', 3, false),
      makeStatus('def_up', 4, false),
    ];
    const oneRowUnits = [
      makeUnit('p1', 'Commander Long Callsign Name', 'ally', {
        isPlayer: true,
        statuses: sevenStatuses,
      }),
      makeUnit('a_empty', 'No Buff Wing', 'ally', { statuses: [] }),
      makeUnit('e_dead', 'Dead Enemy', 'enemy', {
        alive: false,
        statuses: [makeStatus('burn', 2, true)],
      }),
    ];
    useGameStore.setState({ battle: makeBattle(oneRowUnits) });
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const boardOne = container!.querySelector(
      '[data-testid="radar-status-board"]'
    ) as HTMLElement;
    expect(boardOne.style.height).toBe('220px');
    expect(
      boardOne.querySelector('[data-testid="status-board-header-title"]')?.textContent
    ).toBe('Trạng thái · Ta 1 · Địch 0');
    expect(boardOne.querySelector('[data-testid="status-board-row-a_empty"]')).toBeNull();
    expect(boardOne.querySelector('[data-testid="status-board-row-e_dead"]')).toBeNull();

    const p1Row = boardOne.querySelector(
      '[data-testid="status-board-row-p1"]'
    ) as HTMLElement;
    expect(p1Row).not.toBeNull();
    expect(p1Row.style.height).toBe('48px');
    expect(p1Row.className).toContain('relative');
    expect(p1Row.className).toContain('overflow-y-visible');
    expect(p1Row.className).not.toContain('overflow-hidden');
    const p1ChipsArea = p1Row.querySelector(
      '[data-testid="status-board-chips-p1"]'
    ) as HTMLElement;
    expect(p1ChipsArea.className).toContain('overflow-y-visible');
    expect(p1ChipsArea.className).not.toContain('overflow-hidden');
    expect(parseFloat(p1ChipsArea.style.paddingLeft)).toBeGreaterThanOrEqual(
      STATUS_BADGE_SAFE_PX
    );
    expect(parseFloat(p1ChipsArea.style.paddingRight)).toBeGreaterThanOrEqual(
      STATUS_BADGE_SAFE_PX
    );
    const p1Name = p1Row.querySelector(
      '[data-testid="status-board-name-p1"]'
    ) as HTMLElement;
    expect(p1Name.getAttribute('title')).toBe('Commander Long Callsign Name');
    expect(p1Name.className).toContain('truncate');

    const p1Chips = p1Row.querySelectorAll('[data-testid^="status-board-chip-p1-"]');
    expect(p1Chips.length).toBe(6);
    expect((p1Chips[0] as HTMLElement).getAttribute('data-chip-frame-px')).toBe('32');
    expect(
      p1Row.querySelector('[data-testid="status-board-overflow-p1"]')?.textContent
    ).toBe('+1');

    // Case C: 8 ally rows + 8 enemy rows -> inner scroll, still constant 220px height
    const eightPerSide: CombatUnit[] = [];
    for (let i = 0; i < 8; i++) {
      eightPerSide.push(
        makeUnit(`a_${i}`, `Ally ${i}`, 'ally', {
          isPlayer: i === 0,
          row: i < 3 ? 'front' : i < 6 ? 'middle' : 'back',
          formationCol: i,
          statuses: [makeStatus('atk_up', 2, false)],
        })
      );
      eightPerSide.push(
        makeUnit(`e_${i}`, `Enemy ${i}`, 'enemy', {
          row: i < 3 ? 'front' : i < 6 ? 'middle' : 'back',
          formationCol: i,
          statuses: [makeStatus('burn', 2, true)],
        })
      );
    }
    useGameStore.setState({ battle: makeBattle(eightPerSide) });
    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const boardEight = container!.querySelector(
      '[data-testid="radar-status-board"]'
    ) as HTMLElement;
    expect(boardEight.style.height).toBe('220px');
    expect(
      boardEight.querySelector('[data-testid="status-board-header-title"]')?.textContent
    ).toBe('Trạng thái · Ta 8 · Địch 8');
    const bodyEl = boardEight.querySelector(
      '[data-testid="status-board-body"]'
    ) as HTMLElement;
    expect(bodyEl.className).toContain('overflow-y-auto');
    expect(boardEight.querySelector('[data-testid="status-board-col-ally"]')).not.toBeNull();
    expect(boardEight.querySelector('[data-testid="status-board-col-enemy"]')).not.toBeNull();

    // Collapse toggle -> header only (28px header, body unmounted)
    const toggleBtn = boardEight.querySelector(
      '[data-testid="status-board-toggle"]'
    ) as HTMLButtonElement;
    expect(toggleBtn.style.height).toBe('28px');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');

    act(() => {
      toggleBtn.click();
    });

    expect(boardEight.getAttribute('data-collapsed')).toBe('true');
    expect(boardEight.style.height).toBe('');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(boardEight.querySelector('[data-testid="status-board-body"]')).toBeNull();

    // i18n parity check for new keys
    expect(Object.keys(VI_TRANSLATIONS).sort()).toEqual(
      Object.keys(EN_TRANSLATIONS).sort()
    );
  });

  it('Item 2: Phone stacks Ta above Địch in page flow with zero inner scroll, max 4 chips + "+N", collapsible header, and preserves 24px gap before log', () => {
    setViewport(390, 844);
    const sixStatuses: ActiveStatusEffect[] = [
      makeStatus('burn', 2, true),
      makeStatus('slow', 3, true),
      makeStatus('def_down', 2, true),
      makeStatus('atk_up', 2, false),
      makeStatus('spd_up', 3, false),
      makeStatus('def_up', 4, false),
    ];
    const units = [
      makeUnit('p1', 'Vance', 'ally', { isPlayer: true, statuses: sixStatuses }),
      makeUnit('e1', 'Interceptor X', 'enemy', {
        statuses: [makeStatus('burn', 2, true)],
      }),
    ];
    useGameStore.setState({ battle: makeBattle(units) });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const radarBox = container!.querySelector(
      '[data-testid="battle-radar-container"]'
    ) as HTMLElement;
    const board = container!.querySelector(
      '[data-testid="radar-status-board"]'
    ) as HTMLElement;
    const gapEl = container!.querySelector(
      '[data-testid="battle-phone-radar-log-gap"]'
    ) as HTMLElement;
    const phoneLog = container!.querySelector(
      '[data-testid="battle-phone-docked-log"]'
    ) as HTMLElement;

    expect(board).not.toBeNull();
    expect(board.getAttribute('data-variant')).toBe('phone');
    expect(
      Boolean(
        radarBox.compareDocumentPosition(board) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        board.compareDocumentPosition(gapEl) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        gapEl.compareDocumentPosition(phoneLog) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(gapEl.style.height).toBe('24px');

    // Zero inner scroll in phone board
    const bodyEl = board.querySelector(
      '[data-testid="status-board-body"]'
    ) as HTMLElement;
    expect(bodyEl.className).not.toContain('overflow-y-auto');
    expect(board.querySelector('.overflow-y-auto')).toBeNull();
    expect(board.style.height).toBe('');

    // Ta stacked above Địch
    const allyCol = board.querySelector(
      '[data-testid="status-board-col-ally"]'
    ) as HTMLElement;
    const enemyCol = board.querySelector(
      '[data-testid="status-board-col-enemy"]'
    ) as HTMLElement;
    expect(allyCol).not.toBeNull();
    expect(enemyCol).not.toBeNull();
    expect(
      Boolean(
        allyCol.compareDocumentPosition(enemyCol) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    // Max 4 chips + "+2" on phone and same 48px row height without clipping
    const p1Row = board.querySelector(
      '[data-testid="status-board-row-p1"]'
    ) as HTMLElement;
    expect(p1Row.style.height).toBe('48px');
    expect(p1Row.className).toContain('overflow-y-visible');
    expect(p1Row.className).not.toContain('overflow-hidden');
    expect(
      p1Row.querySelectorAll('[data-testid^="status-board-chip-p1-"]').length
    ).toBe(4);
    expect(
      p1Row.querySelector('[data-testid="status-board-overflow-p1"]')?.textContent
    ).toBe('+2');

    // Header collapsible on phone
    const toggleBtn = board.querySelector(
      '[data-testid="status-board-toggle"]'
    ) as HTMLButtonElement;
    act(() => {
      toggleBtn.click();
    });
    expect(board.getAttribute('data-collapsed')).toBe('true');
    expect(board.querySelector('[data-testid="status-board-body"]')).toBeNull();
  });

  it('Item 3: Collapse state defaults to expanded, persists in dreamAce.statusBoard.v1 across remounts, and stays excluded from save & SV1a/SV1b exports', async () => {
    expect(STATUS_BOARD_STORAGE_KEY).toBe('dreamAce.statusBoard.v1');
    const units = [
      makeUnit('p1', 'Vance', 'ally', {
        isPlayer: true,
        statuses: [makeStatus('atk_up', 2, false)],
      }),
    ];
    useGameStore.setState({ battle: makeBattle(units) });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const board = container!.querySelector(
      '[data-testid="radar-status-board"]'
    ) as HTMLElement;
    expect(board.getAttribute('data-collapsed')).toBe('false');
    expect(window.localStorage.getItem('dreamAce.statusBoard.v1')).toBeNull();

    // Collapse board -> persists to dreamAce.statusBoard.v1
    const toggleBtn = board.querySelector(
      '[data-testid="status-board-toggle"]'
    ) as HTMLButtonElement;
    act(() => {
      toggleBtn.click();
    });
    expect(board.getAttribute('data-collapsed')).toBe('true');
    expect(window.localStorage.getItem('dreamAce.statusBoard.v1')).toBe('collapsed');

    // Unmount and remount -> remembers collapsed state
    act(() => {
      root!.unmount();
    });
    root = createRoot(container!);
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    const remountedBoard = container!.querySelector(
      '[data-testid="radar-status-board"]'
    ) as HTMLElement;
    expect(remountedBoard.getAttribute('data-collapsed')).toBe('true');
    expect(remountedBoard.querySelector('[data-testid="status-board-body"]')).toBeNull();

    // Expand again -> persists expanded
    act(() => {
      (
        remountedBoard.querySelector(
          '[data-testid="status-board-toggle"]'
        ) as HTMLButtonElement
      ).click();
    });
    expect(remountedBoard.getAttribute('data-collapsed')).toBe('false');
    expect(window.localStorage.getItem('dreamAce.statusBoard.v1')).toBe('expanded');

    // Excluded from save snapshot, SV1a/SV1b export envelope, and local save key
    expect(CURRENT_SAVE_VERSION).toBe(9);
    const snapshot = useGameStore.getState().exportSaveStateSnapshot();
    expect(JSON.stringify(snapshot)).not.toContain('dreamAce.statusBoard.v1');
    expect(JSON.stringify(snapshot)).not.toContain('statusBoardCollapsed');

    const envelope = await buildExportEnvelope(snapshot);
    expect(JSON.stringify(envelope)).not.toContain('dreamAce.statusBoard.v1');
    expect(JSON.stringify(envelope)).not.toContain('statusBoardCollapsed');

    const localPersist =
      window.localStorage.getItem('starfront_mech_rpg_save_v1') ?? '';
    expect(localPersist).not.toContain('dreamAce.statusBoard.v1');
  });

  it('Item 4: Rows sort player first then front -> middle -> back, and clicking a row selects the unit and highlights its radar marker', () => {
    const units = [
      makeUnit('a_back_wing', 'Ally Back Wing', 'ally', {
        row: 'back',
        formationCol: 0,
        statuses: [makeStatus('atk_up', 2, false)],
      }),
      makeUnit('a_front', 'Ally Front', 'ally', {
        row: 'front',
        formationCol: 0,
        statuses: [makeStatus('def_up', 2, false)],
      }),
      makeUnit('a_mid', 'Ally Mid', 'ally', {
        row: 'middle',
        formationCol: 0,
        statuses: [makeStatus('spd_up', 2, false)],
      }),
      // Player placed in back row -> still must sort FIRST on ally side
      makeUnit('player_back', 'Captain Player', 'ally', {
        isPlayer: true,
        row: 'back',
        formationCol: 1,
        statuses: [makeStatus('atk_up', 3, false)],
      }),
      makeUnit('e_back', 'Enemy Back', 'enemy', {
        row: 'back',
        formationCol: 0,
        statuses: [makeStatus('burn', 2, true)],
      }),
      makeUnit('e_front', 'Enemy Front', 'enemy', {
        row: 'front',
        formationCol: 0,
        statuses: [makeStatus('slow', 3, true)],
      }),
      makeUnit('e_mid', 'Enemy Mid', 'enemy', {
        row: 'middle',
        formationCol: 0,
        statuses: [makeStatus('def_down', 2, true)],
      }),
    ];
    useGameStore.setState({ battle: makeBattle(units) });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const board = container!.querySelector(
      '[data-testid="radar-status-board"]'
    ) as HTMLElement;
    const allyRows = Array.from(
      board.querySelectorAll('[data-testid="status-board-col-ally"] > [data-testid^="status-board-row-"]')
    ).map((el) => el.getAttribute('data-testid'));
    expect(allyRows).toEqual([
      'status-board-row-player_back',
      'status-board-row-a_front',
      'status-board-row-a_mid',
      'status-board-row-a_back_wing',
    ]);

    const enemyRows = Array.from(
      board.querySelectorAll('[data-testid="status-board-col-enemy"] > [data-testid^="status-board-row-"]')
    ).map((el) => el.getAttribute('data-testid'));
    expect(enemyRows).toEqual([
      'status-board-row-e_front',
      'status-board-row-e_mid',
      'status-board-row-e_back',
    ]);

    // Click middle ally row -> selects unit in board + sidebar + highlights radar marker
    const midAllyRow = board.querySelector(
      '[data-testid="status-board-row-a_mid"]'
    ) as HTMLButtonElement;
    act(() => {
      midAllyRow.click();
    });

    expect(midAllyRow.getAttribute('data-selected')).toBe('true');
    const selectedPanel = container!.querySelector(
      '[data-testid="battle-selected-unit-panel"]'
    ) as HTMLElement;
    expect(selectedPanel.textContent).toContain('Ally Mid');

    const aMidMarker = container!.querySelector(
      '[data-testid="radar-unit-a_mid"]'
    ) as SVGGElement;
    expect(aMidMarker.getAttribute('data-selected')).toBe('true');
    expect(
      container!.querySelector('[data-testid="radar-selected-ring-a_mid"]')
    ).not.toBeNull();

    // Click back-row blocked enemy row -> selects it in sidebar + highlights its radar marker
    const backEnemyRow = board.querySelector(
      '[data-testid="status-board-row-e_back"]'
    ) as HTMLButtonElement;
    act(() => {
      backEnemyRow.click();
    });

    expect(backEnemyRow.getAttribute('data-selected')).toBe('true');
    expect(midAllyRow.getAttribute('data-selected')).toBe('false');
    expect(selectedPanel.textContent).toContain('Enemy Back');
    const eBackMarker = container!.querySelector(
      '[data-testid="radar-unit-e_back"]'
    ) as SVGGElement;
    expect(eBackMarker.getAttribute('data-selected')).toBe('true');
    expect(
      container!.querySelector('[data-testid="radar-selected-ring-e_back"]')
    ).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="radar-selected-ring-a_mid"]')
    ).toBeNull();
  });

  it('Item 5: Each board StatusChip has title and aria-label with status name, turns left, and stacks (VI & EN)', () => {
    const units = [
      makeUnit('p1', 'Vance', 'ally', {
        isPlayer: true,
        statuses: [
          makeStatus('burn', 3, true),
          makeStatus('atk_up', 2, false),
        ],
      }),
      makeUnit('e1', 'Interceptor', 'enemy', {
        statuses: [makeStatus('slow', 4, true)],
      }),
    ];
    useGameStore.setState({ battle: makeBattle(units), language: 'vi' });

    act(() => {
      root!.render(createElement(BattleScreen));
    });

    const p1Chip0 = container!.querySelector(
      '[data-testid="status-board-chip-p1-0"]'
    ) as HTMLElement;
    expect(p1Chip0).not.toBeNull();
    const viTitle = p1Chip0.getAttribute('title') ?? '';
    const viAria = p1Chip0.getAttribute('aria-label') ?? '';
    expect(viTitle).toBe(viAria);
    expect(viTitle).toContain('Thiêu đốt');
    expect(viTitle).toContain('3');
    expect(viTitle).toContain('Cộng dồn');
    expect(viTitle).toContain('x1');

    // English locale check
    act(() => {
      useGameStore.setState({ language: 'en' });
      root!.render(createElement(BattleScreen));
    });
    const enHeaderTitle = container!.querySelector(
      '[data-testid="status-board-header-title"]'
    ) as HTMLElement;
    expect(enHeaderTitle.textContent).toBe('Statuses · Ally 1 · Enemy 1');
    const enChip0 = container!.querySelector(
      '[data-testid="status-board-chip-p1-0"]'
    ) as HTMLElement;
    const enTitle = enChip0.getAttribute('title') ?? '';
    const enAria = enChip0.getAttribute('aria-label') ?? '';
    expect(enTitle).toBe(enAria);
    expect(enTitle).toContain('Burn');
    expect(enTitle).toContain('3 turns left');
    expect(enTitle).toContain('Stacks: x1');

    // Direct StatusChip with stacks=3 & infinite stance turns
    act(() => {
      root!.render(
        createElement(StatusChip, {
          status: { type: 'siege_mode', turnsRemaining: 99, isDebuff: false },
          lang: 'en',
          allowStack: true,
          stacks: 3,
          testId: 'stacked-chip',
        })
      );
    });
    const stackedChip = container!.querySelector(
      '[data-testid="stacked-chip"]'
    ) as HTMLElement;
    expect(stackedChip.getAttribute('title')).toContain('Active');
    expect(stackedChip.getAttribute('title')).toContain('Stacks: x3');
    expect(stackedChip.getAttribute('aria-label')).toBe(
      stackedChip.getAttribute('title')
    );
  });

  it('Item 6: Board is NOT rendered in card mode on desktop or phone, and toggles back on when returning to radar', () => {
    const units = [
      makeUnit('p1', 'Vance', 'ally', {
        isPlayer: true,
        statuses: [makeStatus('atk_up', 2, false)],
      }),
      makeUnit('e1', 'Interceptor', 'enemy', {
        statuses: [makeStatus('burn', 3, true)],
      }),
    ];
    useGameStore.setState({
      battle: makeBattle(units),
      battleViewMode: 'card',
    });

    // Desktop card mode -> no status board
    setViewport(1440, 900);
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    expect(container!.querySelector('[data-testid="battle-card-view"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="radar-status-board"]')).toBeNull();

    // Phone card mode -> no status board
    setViewport(390, 844);
    act(() => {
      root!.render(createElement(BattleScreen));
    });
    expect(container!.querySelector('[data-testid="battle-card-view"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="radar-status-board"]')).toBeNull();

    // Switch back to radar mode -> board appears again
    act(() => {
      useGameStore.setState({ battleViewMode: 'radar' });
    });
    expect(container!.querySelector('[data-testid="radar-status-board"]')).not.toBeNull();
  });
});
