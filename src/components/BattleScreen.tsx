import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Backpack,
  Bot,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  HeartHandshake,
  Info,
  LayoutGrid,
  Maximize2,
  MoreHorizontal,
  Radar,
  Repeat,
  ScrollText,
  Shield,
  ShieldAlert,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { BALANCE_CONFIG } from '../data/balance';
import { getScaledSkillStats, getSkillById } from '../data/skills';
import {
  getEffectiveUnitSpeed,
  getEnemyEnrageBonusPct,
  getTeamColorRole,
  getValidEnemyTargets,
  hasStatus,
  isLongRangeAction,
} from '../engine/combat';
import { canUnitUseSkill } from '../engine/skills';
import { getBattleSupplyRows } from '../engine/supplies';
import {
  getAutoStopReasonLabel,
  getBattleSkillReason,
  getClassName,
  getSectorName,
  getSkillDesc,
  getSkillName,
  getSkillTargetLabel,
  getTeamTagLabel,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  AutoRepeatDefeatRule,
  AutoRepeatLimit,
  CombatRow,
  CombatUnit,
} from '../types/game';
import {
  ALLOWED_BATTLE_SPEEDS,
  clampDefeatStreakLimit,
  computeRowExposure,
  evaluateRadarTargetValidity,
  EXTRA_BATTLE_SPEEDS,
  formatShortUnitName,
  MAX_DEFEAT_STREAK_LIMIT,
  MIN_DEFEAT_STREAK_LIMIT,
  PHONE_RADAR_LOG_GAP_PX,
  PRIMARY_BATTLE_SPEEDS,
  readSpeechBubblesEnabled,
  SIDEBAR_UNIT_PANEL_HEIGHTS,
  SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX,
  SP_COLOR_TOKENS,
  SPEECH_BUBBLE_DURATION_MS,
  useBattleLayoutMode,
  usePrefersReducedMotion,
  writeSpeechBubblesEnabled,
} from '../utils/battleDisplay';
import {
  computeFxCleanupDelayMs,
  POPUP_CLEANUP_DELAY_MS,
  resolveEffectiveVfxConfig,
  resolveReducedMotion,
  useFxSettings,
} from '../utils/battleVfx';
import { useActionStageEnabled } from '../utils/actionStagePrefs';
import { resolveFxTone, STAGE_HIT_FLASH_COLORS } from '../utils/fxTone';
import {
  parseStructuredCombatLogRow,
  readCombatLogExpandAll,
  readCombatLogOrder,
  readSidebarLogMode,
  writeCombatLogExpandAll,
  writeCombatLogOrder,
  writeSidebarLogMode,
  type CombatLogChannel,
  type CombatLogOrder,
  type SidebarCombatLogMode,
} from '../utils/combatLogFormat';
import { useStatusDisplaySettings } from '../utils/statusDisplayPrefs';
import { ActionStage, resolveStageFxActorAndTargets } from './ActionStage';
import {
  AutoRepeatBatchSummaryModal,
  AutoRepeatToast,
} from './AutoRepeatDialogs';
import { BattleMoreActionsMenu } from './BattleMoreActionsMenu';
import { BattleRadarView } from './BattleRadarView';
import { BattleResultDialog } from './BattleResultDialog';
import { CombatLogPopupSheet, PhoneUnitDetailSheet } from './BattleSheets';
import { BattleStatsModal } from './BattleStatsModal';
import { BattleUnitCard } from './BattleUnitCard';
import { CombatLogList } from './CombatLogList';
import { ErrorBoundary } from './ErrorBoundary';
import { FieldSuppliesSheet } from './FieldSuppliesSheet';
import {
  CARD_STATUS_FALLBACK_WIDTH_PX,
  FixedStatusArea,
  countStatusChipRows,
} from './FixedStatusArea';
import { PhoneSkillsSheet } from './PhoneSkillsSheet';
import {
  RadarStatusBoard,
  readStatusBoardCollapsed,
  writeStatusBoardCollapsed,
} from './RadarStatusBoard';
import { SkillIcon } from './SkillIcon';
import { StatBar } from './StatBar';
import { TurnQueueBar } from './TurnQueueBar';

const REPEAT_OPTIONS: AutoRepeatLimit[] = [1, 5, 10, 20, 'infinite'];
const ROWS_ORDER: CombatRow[] = ['front', 'middle', 'back'];

function getTeamAccentVar(unit: CombatUnit): string {
  const role = getTeamColorRole(unit);
  if (role === 'me') return 'var(--team-me)';
  if (role === 'ally') return 'var(--team-ally)';
  if (role === 'boss') return 'var(--team-boss)';
  return 'var(--team-enemy)';
}

export function BattleScreen() {
  const { lang, t } = useI18n();
  const battle = useGameStore((s) => s.battle);
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const battleSpeed = useGameStore((s) => s.battleSpeed);
  const skipAnimations = useGameStore((s) => s.skipAnimations);
  const autoBattleEnabled = useGameStore((s) => s.autoBattleEnabled);
  const autoRepeatLimit = useGameStore((s) => s.autoRepeatLimit);
  const autoRepeatDefeatRule = useGameStore((s) => s.autoRepeatDefeatRule);
  const autoRepeatDefeatStreakLimit = useGameStore(
    (s) => s.autoRepeatDefeatStreakLimit
  );
  const autoRepeatSession = useGameStore((s) => s.autoRepeatSession);
  const autoRepeatToast = useGameStore((s) => s.autoRepeatToast);
  const tacticsModalOpen = useGameStore((s) => s.tacticsModalOpen);
  const battleViewMode = useGameStore((s) => s.battleViewMode);
  const selectTarget = useGameStore((s) => s.selectTarget);
  const selectAllyTarget = useGameStore((s) => s.selectAllyTarget);
  const performPlayerAction = useGameStore((s) => s.performPlayerAction);
  const useBattleSupply = useGameStore((s) => s.useBattleSupply);
  const performAutoPlayerTurn = useGameStore((s) => s.performAutoPlayerTurn);
  const performAiTurn = useGameStore((s) => s.performAiTurn);
  const logRadarInvalidTarget = useGameStore((s) => s.logRadarInvalidTarget);
  const retreatBattle = useGameStore((s) => s.retreatBattle);
  const clearExpiredPopups = useGameStore((s) => s.clearExpiredPopups);
  const clearExpiredFx = useGameStore((s) => s.clearExpiredFx);
  const clearExplodedUnits = useGameStore((s) => s.clearExplodedUnits);
  const clearWingmanChat = useGameStore((s) => s.clearWingmanChat);
  const returnToHangar = useGameStore((s) => s.returnToHangar);
  const startBattle = useGameStore((s) => s.startBattle);
  const reloadBattle = useGameStore((s) => s.reloadBattle);
  const setBattleSpeed = useGameStore((s) => s.setBattleSpeed);
  const setBattleViewMode = useGameStore((s) => s.setBattleViewMode);
  const toggleSkipAnimations = useGameStore((s) => s.toggleSkipAnimations);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const setAutoBattleEnabled = useGameStore((s) => s.setAutoBattleEnabled);
  const toggleAutoBattle = useGameStore((s) => s.toggleAutoBattle);
  const setTacticsModalOpen = useGameStore((s) => s.setTacticsModalOpen);
  const setAutoRepeatLimit = useGameStore((s) => s.setAutoRepeatLimit);
  const setAutoRepeatDefeatRule = useGameStore(
    (s) => s.setAutoRepeatDefeatRule
  );
  const setAutoRepeatDefeatStreakLimit = useGameStore(
    (s) => s.setAutoRepeatDefeatStreakLimit
  );
  const startAutoRepeat = useGameStore((s) => s.startAutoRepeat);
  const stopAutoRepeat = useGameStore((s) => s.stopAutoRepeat);
  const clearAutoRepeatSummary = useGameStore((s) => s.clearAutoRepeatSummary);
  const clearAutoRepeatToast = useGameStore((s) => s.clearAutoRepeatToast);
  const toggleAdminPanel = useGameStore((s) => s.toggleAdminPanel);

  const layoutMode = useBattleLayoutMode();
  const isPhonePortrait = layoutMode === 'phone-portrait';
  const {
    settings: statusSettings,
    activePlayerRows,
  } = useStatusDisplaySettings(adminConfig.statusDisplayDefaults);

  const [inspectedSkillId, setInspectedSkillId] = useState<string | null>(null);
  const [inspectedUnitId, setInspectedUnitId] = useState<string | null>(null);
  const [phoneUnitSheetId, setPhoneUnitSheetId] = useState<string | null>(null);
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [skillsSheetOpen, setSkillsSheetOpen] = useState(false);
  const [suppliesSheetOpen, setSuppliesSheetOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [retreatConfirmOpen, setRetreatConfirmOpen] = useState(false);
  const [loopPopoverOpen, setLoopPopoverOpen] = useState(false);
  const [selectedLoopCount, setSelectedLoopCount] =
    useState<AutoRepeatLimit>(autoRepeatLimit);
  const [streakDraft, setStreakDraft] = useState<string>(() =>
    String(autoRepeatDefeatStreakLimit)
  );
  const loopAnchorRef = useRef<HTMLDivElement | null>(null);
  const loopPopoverRef = useRef<HTMLDivElement | null>(null);
  const [loopPopoverPos, setLoopPopoverPos] = useState<{
    top: number;
    left: number;
  }>({ top: 56, left: 8 });
  const [desktopSpeedPopoverOpen, setDesktopSpeedPopoverOpen] = useState(false);
  const desktopSpeedAnchorRef = useRef<HTMLButtonElement | null>(null);
  const desktopSpeedPopoverRef = useRef<HTMLDivElement | null>(null);
  const [desktopSpeedPopoverPos, setDesktopSpeedPopoverPos] = useState<{
    top: number;
    left: number;
  }>({ top: 56, left: 8 });
  const [phoneSpeedPopoverOpen, setPhoneSpeedPopoverOpen] = useState(false);
  const phoneSpeedAnchorRef = useRef<HTMLButtonElement | null>(null);
  const phoneSpeedPopoverRef = useRef<HTMLDivElement | null>(null);
  const [phoneSpeedPopoverPos, setPhoneSpeedPopoverPos] = useState<{
    top: number;
    left: number;
  }>({ top: 56, left: 8 });
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [speechBubblesEnabled, setSpeechBubblesEnabled] = useState<boolean>(
    () => readSpeechBubblesEnabled()
  );
  const [fxSettings] = useFxSettings();
  const [actionStageEnabled] = useActionStageEnabled();
  const osReducedMotion = usePrefersReducedMotion();
  const [sidebarLogMode, setSidebarLogMode] = useState<SidebarCombatLogMode>(
    () => readSidebarLogMode()
  );
  const [logChannel, setLogChannel] = useState<CombatLogChannel>('all');
  const [logOrder, setLogOrder] = useState<CombatLogOrder>(() =>
    readCombatLogOrder()
  );
  const [logExpandAll, setLogExpandAll] = useState<boolean>(() =>
    readCombatLogExpandAll()
  );
  const [logExpandNonce, setLogExpandNonce] = useState<number>(0);
  const [statusBoardCollapsed, setStatusBoardCollapsed] = useState<boolean>(() =>
    readStatusBoardCollapsed()
  );
  const [cardToast, setCardToast] = useState<string | null>(null);
  const popupCleanupTimersRef = useRef<Map<string, number>>(new Map());
  const fxCleanupTimersRef = useRef<Map<string, number>>(new Map());
  const explodedCleanupTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setSelectedLoopCount(autoRepeatLimit);
  }, [autoRepeatLimit]);

  useEffect(() => {
    setStreakDraft(String(autoRepeatDefeatStreakLimit));
  }, [autoRepeatDefeatStreakLimit]);

  useEffect(() => {
    if (!autoRepeatToast) return;
    const timer = window.setTimeout(() => {
      clearAutoRepeatToast();
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [autoRepeatToast, clearAutoRepeatToast]);

  const computeAnchoredPopoverPosition = useCallback(
    (anchorEl: HTMLElement | null, targetWidth: number) => {
      const MARGIN = 8;
      const vw = typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight || 800 : 800;
      const popoverWidth = Math.max(
        0,
        Math.min(targetWidth, Math.floor(vw * 0.92), vw - MARGIN * 2)
      );
      const rect = anchorEl?.getBoundingClientRect();
      const rawLeft = rect
        ? rect.right > 0
          ? rect.right - popoverWidth
          : rect.left
        : MARGIN;
      const maxLeft = Math.max(MARGIN, vw - popoverWidth - MARGIN);
      const left = Math.max(MARGIN, Math.min(rawLeft, maxLeft));
      const rawTop = rect ? rect.bottom + 6 : MARGIN;
      const maxTop = Math.max(MARGIN, vh - 80);
      const top = Math.max(MARGIN, Math.min(rawTop, maxTop));
      return { top, left };
    },
    []
  );

  const computeLoopPopoverPosition = useCallback(
    () => computeAnchoredPopoverPosition(loopAnchorRef.current, 252),
    [computeAnchoredPopoverPosition]
  );

  useEffect(() => {
    if (battle?.summary) {
      setLoopPopoverOpen(false);
      setDesktopSpeedPopoverOpen(false);
      setPhoneSpeedPopoverOpen(false);
    }
  }, [battle?.summary]);

  useEffect(() => {
    if (!loopPopoverOpen) return;
    const updatePosition = () => {
      setLoopPopoverPos(computeLoopPopoverPosition());
    };
    updatePosition();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoopPopoverOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      const inAnchor = Boolean(
        loopAnchorRef.current && target && loopAnchorRef.current.contains(target)
      );
      const inPopover = Boolean(
        loopPopoverRef.current &&
          target &&
          loopPopoverRef.current.contains(target)
      );
      if (!inAnchor && !inPopover) {
        setLoopPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [loopPopoverOpen, computeLoopPopoverPosition, layoutMode]);

  useEffect(() => {
    if (!desktopSpeedPopoverOpen) return;
    const updatePosition = () => {
      setDesktopSpeedPopoverPos(
        computeAnchoredPopoverPosition(desktopSpeedAnchorRef.current, 212)
      );
    };
    updatePosition();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDesktopSpeedPopoverOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      const inAnchor = Boolean(
        desktopSpeedAnchorRef.current &&
          target &&
          desktopSpeedAnchorRef.current.contains(target)
      );
      const inPopover = Boolean(
        desktopSpeedPopoverRef.current &&
          target &&
          desktopSpeedPopoverRef.current.contains(target)
      );
      if (!inAnchor && !inPopover) {
        setDesktopSpeedPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [desktopSpeedPopoverOpen, computeAnchoredPopoverPosition, layoutMode]);

  useEffect(() => {
    if (!phoneSpeedPopoverOpen) return;
    const updatePosition = () => {
      setPhoneSpeedPopoverPos(
        computeAnchoredPopoverPosition(phoneSpeedAnchorRef.current, 216)
      );
    };
    updatePosition();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhoneSpeedPopoverOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      const inAnchor = Boolean(
        phoneSpeedAnchorRef.current &&
          target &&
          phoneSpeedAnchorRef.current.contains(target)
      );
      const inPopover = Boolean(
        phoneSpeedPopoverRef.current &&
          target &&
          phoneSpeedPopoverRef.current.contains(target)
      );
      if (!inAnchor && !inPopover) {
        setPhoneSpeedPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [phoneSpeedPopoverOpen, computeAnchoredPopoverPosition, layoutMode]);

  useEffect(() => {
    if (!logSheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setLogSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [logSheetOpen]);

  const closeMoreActions = () => {
    setMoreActionsOpen(false);
    setRetreatConfirmOpen(false);
  };

  const toggleSpeechBubbles = () => {
    setSpeechBubblesEnabled((prev) => {
      const next = !prev;
      writeSpeechBubblesEnabled(next);
      return next;
    });
  };

  const handleSetSidebarLogMode = (nextMode: SidebarCombatLogMode) => {
    setSidebarLogMode(nextMode);
    writeSidebarLogMode(nextMode);
  };

  const handleOpenCombatLogPopup = () => {
    setLogSheetOpen(true);
  };

  const handleExpandAllLogs = () => {
    setLogExpandAll(true);
    writeCombatLogExpandAll(true);
    setLogExpandNonce((n) => n + 1);
  };

  const handleCollapseAllLogs = () => {
    setLogExpandAll(false);
    writeCombatLogExpandAll(false);
    setLogExpandNonce((n) => n + 1);
  };

  const handleSetLogOrder = (nextOrder: CombatLogOrder) => {
    setLogOrder(nextOrder);
    writeCombatLogOrder(nextOrder);
  };

  const handleToggleStatusBoard = () => {
    setStatusBoardCollapsed((prev) => {
      const next = !prev;
      writeStatusBoardCollapsed(next);
      return next;
    });
  };

  const renderLogModeSegmented = () => (
    <div
      role="group"
      aria-label={t('battle.combatLog')}
      data-testid="combat-log-mode-segmented"
      className="inline-flex items-center rounded border border-slate-700 bg-slate-950 p-0.5 shrink-0"
    >
      <button
        type="button"
        data-testid="combat-log-mode-line"
        aria-pressed={sidebarLogMode === 'line'}
        onClick={() => handleSetSidebarLogMode('line')}
        className={`min-h-[24px] px-1.5 rounded text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          sidebarLogMode === 'line'
            ? 'bg-sky-500 text-slate-950'
            : 'text-slate-300 hover:text-slate-100'
        }`}
      >
        {t('log.modeLine')}
      </button>
      <button
        type="button"
        data-testid="combat-log-mode-expanded"
        aria-pressed={sidebarLogMode === 'expanded'}
        onClick={() => handleSetSidebarLogMode('expanded')}
        className={`min-h-[24px] px-1.5 rounded text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          sidebarLogMode === 'expanded'
            ? 'bg-sky-500 text-slate-950'
            : 'text-slate-300 hover:text-slate-100'
        }`}
      >
        {t('log.modeExpanded')}
      </button>
    </div>
  );

  const renderCombatLogExpandButtons = (compact = false) => (
    <div className="inline-flex items-center gap-1 shrink-0">
      <button
        type="button"
        data-testid="combat-log-expand-all"
        aria-pressed={logExpandAll}
        onClick={handleExpandAllLogs}
        title={t('log.expandAll')}
        className={`${
          compact ? 'min-h-[24px] px-1.5 text-[10px]' : 'min-h-[28px] px-2 text-[11px]'
        } rounded border font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
          logExpandAll
            ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
            : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300'
        }`}
      >
        <ChevronsUpDown className="w-3 h-3 text-sky-400 shrink-0" />
        <span>{t('log.expandAll')}</span>
      </button>
      <button
        type="button"
        data-testid="combat-log-collapse-all"
        aria-pressed={!logExpandAll}
        onClick={handleCollapseAllLogs}
        title={t('log.collapseAll')}
        className={`${
          compact ? 'min-h-[24px] px-1.5 text-[10px]' : 'min-h-[28px] px-2 text-[11px]'
        } rounded border font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
          !logExpandAll
            ? 'border-slate-600 bg-slate-800 text-slate-100'
            : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300'
        }`}
      >
        <ChevronsDownUp className="w-3 h-3 text-slate-400 shrink-0" />
        <span>{t('log.collapseAll')}</span>
      </button>
    </div>
  );

  const playerWeaponId = useMemo(() => {
    if (!battle) return null;
    const gear = pilot.gears[battle.deployedGearId];
    const weaponInstanceId = gear?.equipped?.main_weapon;
    if (!weaponInstanceId) return null;
    const item = pilot.inventory.find(
      (entry) => entry.instanceId === weaponInstanceId
    );
    return item?.templateId ?? null;
  }, [battle, pilot]);

  const bypassFx = skipAnimations;
  const resolvedReducedMotion = resolveReducedMotion(
    fxSettings.reducedMotionMode,
    osReducedMotion
  );
  const vfxConfig = resolveEffectiveVfxConfig(
    fxSettings.effectsMode,
    battleSpeed,
    resolvedReducedMotion,
    bypassFx
  );

  const effectiveViewMode =
    battleViewMode ?? (isPhonePortrait ? 'radar' : 'radar');

  const activeUnitId = battle ? battle.turnOrder[battle.activeTurnIndex] : null;
  const activeUnit =
    battle?.units.find((u) => u.id === activeUnitId) ?? null;
  const isPlayerCharging = Boolean(
    activeUnit?.isPlayer && activeUnit.alive && hasStatus(activeUnit, 'charging')
  );
  const isPlayerTurn = Boolean(
    battle &&
      !battle.summary &&
      activeUnit?.isPlayer &&
      activeUnit.alive &&
      !isPlayerCharging
  );

  const battleSupplyView = useMemo(
    () => getBattleSupplyRows(battle, pilot, adminConfig),
    [battle, pilot, adminConfig]
  );
  const usableSupplyCount = battleSupplyView.usableCount;

  const currentBattleMeta = useMemo(() => {
    if (!battle) return null;
    return {
      sectorId: battle.sectorId,
      deployedGearId: battle.deployedGearId,
      unitSig: battle.units.map((u) => u.id).join('|'),
      turnCounter: battle.turnCounter,
      round: battle.round,
      hadSummary: Boolean(battle.summary),
    };
  }, [battle]);

  const currentLaneStatusRows = useMemo((): Record<CombatRow, number> => {
    const result: Record<CombatRow, number> = {
      front: 0,
      middle: 0,
      back: 0,
    };
    if (!battle) return result;
    for (const row of ROWS_ORDER) {
      let maxRows = 0;
      for (const unit of battle.units) {
        if (!unit.alive || unit.row !== row) continue;
        const needed = countStatusChipRows(unit.statuses, {
          lang,
          unit,
          iconMods: adminConfig.iconCatalogMods,
          showLabels: fxSettings.showStatusLabels,
          compact: false,
          containerWidthPx: CARD_STATUS_FALLBACK_WIDTH_PX,
        });
        if (needed > maxRows) maxRows = needed;
      }
      result[row] = Math.min(2, maxRows);
    }
    return result;
  }, [
    battle,
    lang,
    adminConfig.iconCatalogMods,
    fxSettings.showStatusLabels,
  ]);

  const [laneStatusState, setLaneStatusState] = useState<{
    meta: typeof currentBattleMeta;
    rows: Record<CombatRow, number>;
  }>(() => ({
    meta: currentBattleMeta,
    rows: currentLaneStatusRows,
  }));

  const isNewBattleForLaneRows = useMemo(() => {
    const prev = laneStatusState.meta;
    const curr = currentBattleMeta;
    if (!curr || !prev) return true;
    if (curr.sectorId !== prev.sectorId) return true;
    if (curr.deployedGearId !== prev.deployedGearId) return true;
    if (curr.unitSig !== prev.unitSig) return true;
    if (curr.turnCounter < prev.turnCounter) return true;
    if (curr.round < prev.round) return true;
    if (prev.hadSummary && !curr.hadSummary) return true;
    return false;
  }, [laneStatusState.meta, currentBattleMeta]);

  const laneStatusRows = useMemo((): Record<CombatRow, number> => {
    if (isNewBattleForLaneRows) return currentLaneStatusRows;
    return {
      front: Math.max(laneStatusState.rows.front, currentLaneStatusRows.front),
      middle: Math.max(laneStatusState.rows.middle, currentLaneStatusRows.middle),
      back: Math.max(laneStatusState.rows.back, currentLaneStatusRows.back),
    };
  }, [isNewBattleForLaneRows, laneStatusState.rows, currentLaneStatusRows]);

  useEffect(() => {
    const prev = laneStatusState.meta;
    const curr = currentBattleMeta;
    const metaChanged =
      (!prev && Boolean(curr)) ||
      (Boolean(prev) && !curr) ||
      (Boolean(prev) &&
        Boolean(curr) &&
        (prev!.sectorId !== curr!.sectorId ||
          prev!.deployedGearId !== curr!.deployedGearId ||
          prev!.unitSig !== curr!.unitSig ||
          prev!.turnCounter !== curr!.turnCounter ||
          prev!.round !== curr!.round ||
          prev!.hadSummary !== curr!.hadSummary));
    const rowsChanged =
      laneStatusState.rows.front !== laneStatusRows.front ||
      laneStatusState.rows.middle !== laneStatusRows.middle ||
      laneStatusState.rows.back !== laneStatusRows.back;
    if (isNewBattleForLaneRows || metaChanged || rowsChanged) {
      setLaneStatusState({
        meta: currentBattleMeta,
        rows: laneStatusRows,
      });
    }
  }, [
    isNewBattleForLaneRows,
    currentBattleMeta,
    laneStatusRows,
    laneStatusState.meta,
    laneStatusState.rows,
  ]);

  // Clean up all per-ID expiry timers on unmount
  useEffect(() => {
    return () => {
      popupCleanupTimersRef.current.forEach((tId) => window.clearTimeout(tId));
      popupCleanupTimersRef.current.clear();
      fxCleanupTimersRef.current.forEach((tId) => window.clearTimeout(tId));
      fxCleanupTimersRef.current.clear();
      explodedCleanupTimersRef.current.forEach((tId) => window.clearTimeout(tId));
      explodedCleanupTimersRef.current.clear();
    };
  }, []);

  // Per-ID popup expiry so overlapping turns never cancel or prematurely wipe active popups
  useEffect(() => {
    if (!battle) return;
    const activeIds = new Set(battle.popups.map((p) => p.id));

    for (const p of battle.popups) {
      if (!popupCleanupTimersRef.current.has(p.id)) {
        const timerId = window.setTimeout(() => {
          popupCleanupTimersRef.current.delete(p.id);
          clearExpiredPopups([p.id]);
        }, POPUP_CLEANUP_DELAY_MS);
        popupCleanupTimersRef.current.set(p.id, timerId);
      }
    }

    popupCleanupTimersRef.current.forEach((timerId, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(timerId);
        popupCleanupTimersRef.current.delete(id);
      }
    });
  }, [battle?.popups, clearExpiredPopups]);

  // Per-ID FX expiry with speed-scaled delay that always outlives the full animation at x1..x10
  useEffect(() => {
    if (!battle) return;
    const activeIds = new Set(battle.fxEvents.map((f) => f.id));
    const fxCleanupMs = computeFxCleanupDelayMs(battleSpeed);

    for (const fx of battle.fxEvents) {
      if (!fxCleanupTimersRef.current.has(fx.id)) {
        const timerId = window.setTimeout(() => {
          fxCleanupTimersRef.current.delete(fx.id);
          clearExpiredFx([fx.id]);
        }, fxCleanupMs);
        fxCleanupTimersRef.current.set(fx.id, timerId);
      }
    }

    fxCleanupTimersRef.current.forEach((timerId, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(timerId);
        fxCleanupTimersRef.current.delete(id);
      }
    });
  }, [battle?.fxEvents, battleSpeed, clearExpiredFx]);

  // Per-ID defeat/explosion expiry
  useEffect(() => {
    if (!battle) return;
    const activeIds = new Set(battle.explodedUnitIds);

    for (const unitId of battle.explodedUnitIds) {
      if (!explodedCleanupTimersRef.current.has(unitId)) {
        const timerId = window.setTimeout(() => {
          explodedCleanupTimersRef.current.delete(unitId);
          clearExplodedUnits([unitId]);
        }, 640);
        explodedCleanupTimersRef.current.set(unitId, timerId);
      }
    }

    explodedCleanupTimersRef.current.forEach((timerId, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(timerId);
        explodedCleanupTimersRef.current.delete(id);
      }
    });
  }, [battle?.explodedUnitIds, clearExplodedUnits]);

  useEffect(() => {
    if (!battle?.wingmanChat) return;
    const timer = window.setTimeout(() => {
      clearWingmanChat();
    }, SPEECH_BUBBLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [battle?.wingmanChat, clearWingmanChat]);

  useEffect(() => {
    if (!cardToast) return;
    const timer = window.setTimeout(() => {
      setCardToast(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [cardToast]);

  // Automatic AI (and player Charge Shot auto-release) scheduler
  useEffect(() => {
    if (!battle || battle.summary || isPlayerTurn) return;
    const baseDelay = BALANCE_CONFIG.battleSpeedDelays[battleSpeed] ?? 760;
    const delayMs = skipAnimations ? Math.min(baseDelay, 40) : baseDelay;
    const timer = window.setTimeout(() => {
      performAiTurn();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    battle?.activeTurnIndex,
    battle?.round,
    battle?.summary,
    isPlayerTurn,
    battleSpeed,
    skipAnimations,
    performAiTurn,
  ]);

  // Automatic Player Turn scheduler when Auto Mode is ON
  useEffect(() => {
    if (
      !battle ||
      battle.summary ||
      !isPlayerTurn ||
      !autoBattleEnabled ||
      tacticsModalOpen
    ) {
      return;
    }
    const baseDelay = BALANCE_CONFIG.battleSpeedDelays[battleSpeed] ?? 760;
    const delayMs = skipAnimations
      ? Math.min(baseDelay, 40)
      : Math.max(8, Math.round(baseDelay * 0.75));
    const timer = window.setTimeout(() => {
      performAutoPlayerTurn();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    battle?.activeTurnIndex,
    battle?.round,
    battle?.summary,
    isPlayerTurn,
    autoBattleEnabled,
    tacticsModalOpen,
    battleSpeed,
    skipAnimations,
    performAutoPlayerTurn,
  ]);

  // Auto-Repeat next battle launcher
  useEffect(() => {
    if (!battle?.summary || !autoRepeatSession?.active) return;
    const delayMs =
      skipAnimations || battleSpeed >= 15
        ? 120
        : battleSpeed >= 5
        ? 320
        : 850;
    const timer = window.setTimeout(() => {
      startBattle(
        autoRepeatSession.sectorId,
        autoRepeatSession.kind
          ? {
              kind: autoRepeatSession.kind,
              sourceId: autoRepeatSession.sourceId ?? null,
            }
          : undefined
      );
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    battle?.summary,
    autoRepeatSession?.active,
    autoRepeatSession?.completedRuns,
    autoRepeatSession?.sectorId,
    autoRepeatSession?.kind,
    autoRepeatSession?.sourceId,
    battleSpeed,
    skipAnimations,
    startBattle,
  ]);

  // Keyboard shortcuts: A Auto/Manual, M Mute, 1 Fire, 2-7 Skills, Q Shield, Tab Cycle Enemy
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!battle || tacticsModalOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggleAutoBattle();
        return;
      }
      if (e.key.toLowerCase() === 'm') {
        toggleMute();
        return;
      }
      if (battle.summary || !isPlayerTurn || autoBattleEnabled) return;

      const playerUnit = battle.units.find((u) => u.isPlayer);
      if (!playerUnit) return;

      if (e.key === '1') {
        e.preventDefault();
        performPlayerAction('attack');
      } else if (e.key.toLowerCase() === 'q') {
        e.preventDefault();
        performPlayerAction('defend');
      } else if (['2', '3', '4', '5', '6', '7'].includes(e.key)) {
        const slotIdx = Number(e.key) - 2;
        const skillId = playerUnit.equippedSkillIds[slotIdx];
        if (skillId && canUnitUseSkill(playerUnit, skillId).canUse) {
          e.preventDefault();
          performPlayerAction('skill', skillId);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const aliveEnemies = battle.units.filter(
          (u) => u.side === 'enemy' && u.alive && !hasStatus(u, 'stealth')
        );
        const pool =
          aliveEnemies.length > 0
            ? aliveEnemies
            : battle.units.filter((u) => u.side === 'enemy' && u.alive);
        if (pool.length > 0) {
          const curIdx = pool.findIndex(
            (u) => u.id === battle.selectedTargetId
          );
          const nextEnemy = pool[(curIdx + 1) % pool.length];
          selectTarget(nextEnemy.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    battle,
    isPlayerTurn,
    autoBattleEnabled,
    tacticsModalOpen,
    performPlayerAction,
    selectTarget,
    toggleAutoBattle,
    toggleMute,
  ]);

  const playerUnitForTargets = battle?.units.find(
    (u) => u.side === 'ally' && u.isPlayer
  );
  const validBasicTargetIds = useMemo(() => {
    if (!battle || !playerUnitForTargets) return new Set<string>();
    return new Set(
      getValidEnemyTargets(battle.units, playerUnitForTargets, 'attack').map(
        (u) => u.id
      )
    );
  }, [battle, playerUnitForTargets]);

  const enemyExposure = useMemo(
    () => (battle ? computeRowExposure(battle.units, 'enemy') : null),
    [battle]
  );
  const allyExposure = useMemo(
    () => (battle ? computeRowExposure(battle.units, 'ally') : null),
    [battle]
  );

  if (!battle) return null;

  const allies = battle.units.filter((u) => u.side === 'ally');
  const enemies = battle.units.filter((u) => u.side === 'enemy');
  const playerUnit = playerUnitForTargets;
  const playerSkillIds = playerUnit?.equippedSkillIds ?? [];
  const hasSingleAllySkill = playerSkillIds.some(
    (id) => getSkillById(id)?.targetType === 'single_ally'
  );
  const playerHasLongRangeBasic = playerUnit
    ? isLongRangeAction(playerUnit, 'attack')
    : false;

  const selectedTarget = enemies.find((e) => e.id === battle.selectedTargetId);
  const selectedAlly = allies.find((a) => a.id === battle.selectedAllyTargetId);
  const phoneSheetUnit = phoneUnitSheetId
    ? battle.units.find((u) => u.id === phoneUnitSheetId) ?? null
    : null;

  // Sidebar detail unit on Tablet/PC: explicitly inspected -> selected enemy -> active unit -> player
  const sidebarUnit: CombatUnit | null =
    (inspectedUnitId
      ? battle.units.find((u) => u.id === inspectedUnitId)
      : null) ??
    (selectedTarget && selectedTarget.alive ? selectedTarget : null) ??
    activeUnit ??
    playerUnit ??
    null;

  // Determine the acting unit's display target for the turn queue chip ("ACTOR > Target")
  const actingTargetName = (() => {
    if (!activeUnit || battle.summary) return null;
    if (activeUnit.side === 'ally') {
      if (selectedTarget && selectedTarget.alive) return selectedTarget.name;
      const firstValid = getValidEnemyTargets(
        battle.units,
        activeUnit,
        'attack'
      )[0];
      return firstValid?.name ?? null;
    }
    const firstValidAlly = getValidEnemyTargets(
      battle.units,
      activeUnit,
      'attack'
    )[0];
    return firstValidAlly?.name ?? null;
  })();

  const showActionStage = Boolean(
    actionStageEnabled && effectiveViewMode === 'card' && !battle.summary
  );
  const latestCardFx =
    showActionStage && battle.fxEvents.length > 0
      ? battle.fxEvents[battle.fxEvents.length - 1]
      : null;
  const latestCardFxActors = latestCardFx
    ? resolveStageFxActorAndTargets(latestCardFx, battle)
    : null;
  const latestCardFxActorId = latestCardFxActors?.actor?.id ?? null;
  const latestCardFxTargetIds = new Set(
    (latestCardFxActors?.targets ?? []).map((u) => u.id)
  );
  const latestCardFxToneColor = latestCardFx
    ? STAGE_HIT_FLASH_COLORS[resolveFxTone(latestCardFx)]
    : null;

  const sectorLabel = getSectorName(lang, battle.sectorId);
  const enrageBonusPct = getEnemyEnrageBonusPct(
    battle.round,
    adminConfig.softEnrageEnabled
  );

  const inspectedSkill = inspectedSkillId
    ? getSkillById(inspectedSkillId)
    : undefined;
  const inspectedUsability =
    playerUnit && inspectedSkill
      ? canUnitUseSkill(playerUnit, inspectedSkill.id)
      : null;
  const inspectedLv =
    playerUnit && inspectedSkill
      ? playerUnit.skillLevels[inspectedSkill.id] ?? 1
      : 1;
  const inspectedScaled = inspectedSkill
    ? getScaledSkillStats(inspectedSkill, inspectedLv)
    : null;

  const repeatLabelFor = (opt: AutoRepeatLimit): string => {
    if (opt === 1) return t('auto.repeat1');
    if (opt === 5) return t('auto.repeat5');
    if (opt === 10) return t('auto.repeat10');
    if (opt === 20) return t('auto.repeat20');
    return t('auto.repeatInfinite');
  };

  const repeatShortCount = (opt: AutoRepeatLimit): string =>
    opt === 'infinite' ? '∞' : String(opt);

  const renderLoopControl = (phoneCompact: boolean) => {
    if (autoRepeatSession?.active) {
      const currentRun =
        autoRepeatSession.limit === 'infinite'
          ? autoRepeatSession.completedRuns + 1
          : Math.min(
              autoRepeatSession.limit,
              autoRepeatSession.completedRuns + 1
            );
      const progressText =
        autoRepeatSession.limit === 'infinite'
          ? `${currentRun}/∞`
          : `${currentRun}/${autoRepeatSession.limit}`;

      return (
        <button
          type="button"
          data-testid="battle-loop-active-chip"
          data-loop-running="true"
          aria-pressed={true}
          onClick={() => stopAutoRepeat('manual_stop')}
          title={t('battle.loopStopTooltip')}
          aria-label={`${t('battle.loopRunningTag')} · ${t('battle.loopStopTooltip')} (${progressText})`}
          className={`rounded-lg border border-emerald-400/70 bg-emerald-500/20 hover:bg-red-500/20 hover:border-red-400/70 text-emerald-100 font-mono-nums font-bold inline-flex items-center justify-center cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            phoneCompact
              ? 'h-10 min-w-[44px] max-w-[76px] px-1 gap-0.5 text-[11px]'
              : 'h-[34px] min-h-[34px] px-2 gap-1.5 text-[12px]'
          }`}
        >
          <span
            data-testid="battle-loop-running-dot"
            className={`${
              phoneCompact ? 'w-1.5 h-1.5' : 'w-2 h-2'
            } rounded-full bg-emerald-400 animate-pulse shrink-0`}
            aria-hidden="true"
          />
          <Repeat
            className={`${
              phoneCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'
            } text-emerald-300 shrink-0`}
            aria-hidden="true"
          />
          <span data-testid="battle-loop-progress">{progressText}</span>
          <span
            data-testid="battle-loop-stop"
            className={`inline-flex items-center justify-center ${
              phoneCompact ? 'w-4 h-4' : 'w-5 h-5'
            } rounded bg-red-500/25 border border-red-400/60 text-red-300 shrink-0`}
          >
            <Square className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
          </span>
        </button>
      );
    }

    const handleSelectDefeatRule = (rule: AutoRepeatDefeatRule) => {
      setAutoRepeatDefeatRule(rule);
    };

    const handleStreakInputChange = (rawValue: string) => {
      if (autoRepeatDefeatRule !== 'stop_after_n') {
        setAutoRepeatDefeatRule('stop_after_n');
      }
      setStreakDraft(rawValue);
      const trimmed = rawValue.trim();
      if (trimmed === '') {
        return;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        const fallback = clampDefeatStreakLimit(rawValue);
        setAutoRepeatDefeatStreakLimit(fallback);
        setStreakDraft(String(fallback));
        return;
      }
      const clamped = clampDefeatStreakLimit(parsed);
      setAutoRepeatDefeatStreakLimit(clamped);
      if (
        parsed < MIN_DEFEAT_STREAK_LIMIT ||
        parsed > MAX_DEFEAT_STREAK_LIMIT ||
        !Number.isInteger(parsed)
      ) {
        setStreakDraft(String(clamped));
      }
    };

    const handleStreakInputBlur = () => {
      const clamped = clampDefeatStreakLimit(streakDraft);
      setAutoRepeatDefeatStreakLimit(clamped);
      setStreakDraft(String(clamped));
    };

    const stoppedReasonTitle =
      autoRepeatSession &&
      !autoRepeatSession.active &&
      autoRepeatSession.stopReason
        ? `${t('battle.loopTitle')} · ${getAutoStopReasonLabel(
            lang,
            autoRepeatSession.stopReason,
            autoRepeatSession.defeatStreakLimit ?? autoRepeatDefeatStreakLimit
          )}`
        : t('battle.loopTitle');

    const loopPopoverNode =
      loopPopoverOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={loopPopoverRef}
              role="dialog"
              data-testid="battle-loop-popover"
              aria-label={t('battle.loopTitle')}
              style={{
                position: 'fixed',
                top: `${loopPopoverPos.top}px`,
                left: `${loopPopoverPos.left}px`,
                width: 'min(252px, 92vw)',
                zIndex: 70,
              }}
              className="z-[70] rounded-lg border border-slate-700 bg-[#0B111D] p-3 shadow-2xl space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-slate-100">
                  {t('battle.loopTitle')}
                </span>
                <span className="text-[11px] font-mono-nums text-slate-400">
                  {t('battle.loopCountLabel')}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {REPEAT_OPTIONS.map((opt) => {
                  const isSelected = selectedLoopCount === opt;
                  return (
                    <button
                      key={String(opt)}
                      type="button"
                      data-testid={`battle-loop-opt-${opt}`}
                      aria-pressed={isSelected}
                      title={repeatLabelFor(opt)}
                      onClick={() => {
                        setSelectedLoopCount(opt);
                        setAutoRepeatLimit(opt);
                      }}
                      className={`min-h-[38px] rounded-md border font-mono-nums text-[12px] font-bold cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                          : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      {repeatShortCount(opt)}
                    </button>
                  );
                })}
              </div>

              <div
                role="radiogroup"
                aria-label={t('battle.loopOnDefeatLabel')}
                data-testid="battle-loop-defeat-rules"
                className="rounded-md border border-slate-800 bg-slate-900/70 p-2 space-y-1.5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('battle.loopOnDefeatLabel')}
                </div>

                <label className="flex items-center gap-2 text-[12px] text-slate-200 cursor-pointer select-none py-0.5">
                  <input
                    type="radio"
                    name="battle-loop-defeat-rule"
                    value="stop_immediately"
                    data-testid="battle-loop-rule-stop-immediately"
                    checked={autoRepeatDefeatRule === 'stop_immediately'}
                    onChange={() => handleSelectDefeatRule('stop_immediately')}
                    className="h-3.5 w-3.5 accent-emerald-400 cursor-pointer shrink-0"
                  />
                  <span>{t('battle.loopRuleStopImmediately')}</span>
                </label>

                <label className="flex items-center gap-2 text-[12px] text-slate-200 cursor-pointer select-none py-0.5 flex-wrap">
                  <input
                    type="radio"
                    name="battle-loop-defeat-rule"
                    value="stop_after_n"
                    data-testid="battle-loop-rule-stop-after-n"
                    checked={autoRepeatDefeatRule === 'stop_after_n'}
                    onChange={() => handleSelectDefeatRule('stop_after_n')}
                    className="h-3.5 w-3.5 accent-emerald-400 cursor-pointer shrink-0"
                  />
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <span>{t('battle.loopRuleStopAfterNPrefix')}</span>
                    <input
                      type="number"
                      min={MIN_DEFEAT_STREAK_LIMIT}
                      max={MAX_DEFEAT_STREAK_LIMIT}
                      step={1}
                      inputMode="numeric"
                      data-testid="battle-loop-streak-input"
                      aria-label={t('battle.loopDefeatStreakInputAria')}
                      value={streakDraft}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (autoRepeatDefeatRule !== 'stop_after_n') {
                          handleSelectDefeatRule('stop_after_n');
                        }
                      }}
                      onChange={(e) => handleStreakInputChange(e.target.value)}
                      onBlur={handleStreakInputBlur}
                      className="w-11 h-6 px-1 rounded border border-slate-700 bg-slate-950 text-center font-mono-nums text-[12px] font-bold text-slate-100 focus:outline-none focus:border-emerald-400"
                    />
                    <span>{t('battle.loopRuleStopAfterNSuffix')}</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 text-[12px] text-slate-200 cursor-pointer select-none py-0.5">
                  <input
                    type="radio"
                    name="battle-loop-defeat-rule"
                    value="never_stop"
                    data-testid="battle-loop-rule-never-stop"
                    checked={autoRepeatDefeatRule === 'never_stop'}
                    onChange={() => handleSelectDefeatRule('never_stop')}
                    className="h-3.5 w-3.5 accent-emerald-400 cursor-pointer shrink-0"
                  />
                  <span>{t('battle.loopRuleNeverStop')}</span>
                </label>
              </div>

              <button
                type="button"
                data-testid="battle-loop-start"
                onClick={() => {
                  startAutoRepeat(selectedLoopCount, battle.sectorId);
                  setLoopPopoverOpen(false);
                }}
                className="w-full min-h-[40px] px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[13px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Repeat className="w-4 h-4 shrink-0" />
                <span>{t('battle.loopStartBtn')}</span>
              </button>
            </div>,
            document.body
          )
        : null;

    return (
      <div ref={loopAnchorRef} className="relative shrink-0">
        <button
          type="button"
          data-testid="battle-loop-btn"
          data-loop-running="false"
          data-stop-reason={autoRepeatSession?.stopReason ?? ''}
          aria-expanded={loopPopoverOpen}
          aria-haspopup="dialog"
          aria-label={stoppedReasonTitle}
          title={stoppedReasonTitle}
          onClick={() => {
            setSelectedLoopCount(autoRepeatLimit);
            setStreakDraft(
              String(clampDefeatStreakLimit(autoRepeatDefeatStreakLimit))
            );
            setDesktopSpeedPopoverOpen(false);
            setPhoneSpeedPopoverOpen(false);
            setLoopPopoverOpen((v) => {
              const next = !v;
              if (next) {
                setLoopPopoverPos(computeLoopPopoverPosition());
              }
              return next;
            });
          }}
          className={`rounded-lg border transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            loopPopoverOpen
              ? 'border-sky-400/80 bg-slate-800 text-slate-100 ring-1 ring-sky-400/30'
              : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
          } ${
            phoneCompact
              ? 'h-10 min-w-[44px] px-2 text-[12px] font-mono-nums font-bold'
              : 'h-[34px] min-h-[34px] px-2 text-[12px] font-semibold'
          }`}
        >
          <Repeat
            className={`w-4 h-4 shrink-0 ${
              loopPopoverOpen ? 'text-sky-400' : 'text-slate-300'
            }`}
            aria-hidden="true"
          />
          {phoneCompact ? (
            <span data-testid="battle-loop-phone-count">
              {repeatShortCount(autoRepeatLimit)}
            </span>
          ) : (
            <span data-testid="battle-loop-label">{t('battle.loopBtn')}</span>
          )}
        </button>

        {loopPopoverNode}
      </div>
    );
  };

  const isExtraSpeedActive = EXTRA_BATTLE_SPEEDS.includes(battleSpeed);

  const desktopSpeedExtraPopoverNode =
    desktopSpeedPopoverOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={desktopSpeedPopoverRef}
            role="dialog"
            data-testid="battle-speed-extra-popover"
            aria-label={t('battle.speedMoreTooltip')}
            style={{
              position: 'fixed',
              top: `${desktopSpeedPopoverPos.top}px`,
              left: `${desktopSpeedPopoverPos.left}px`,
              width: 'min(212px, 92vw)',
              zIndex: 70,
            }}
            className="z-[70] rounded-lg border border-slate-700 bg-[#0B111D] p-2.5 shadow-2xl space-y-2"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('battle.speedMoreTooltip')}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {EXTRA_BATTLE_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  data-testid={`battle-speed-opt-${spd}`}
                  aria-pressed={battleSpeed === spd}
                  onClick={() => {
                    setBattleSpeed(spd);
                    setDesktopSpeedPopoverOpen(false);
                  }}
                  className={`min-h-[36px] rounded-md border font-mono-nums text-[12px] font-bold cursor-pointer transition-colors ${
                    battleSpeed === spd
                      ? 'border-sky-400 bg-sky-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  const phoneSpeedPopoverNode =
    phoneSpeedPopoverOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={phoneSpeedPopoverRef}
            role="dialog"
            data-testid="battle-speed-phone-popover"
            aria-label={t('battle.speedPopoverTitle')}
            style={{
              position: 'fixed',
              top: `${phoneSpeedPopoverPos.top}px`,
              left: `${phoneSpeedPopoverPos.left}px`,
              width: 'min(216px, 92vw)',
              zIndex: 70,
            }}
            className="z-[70] rounded-lg border border-slate-700 bg-[#0B111D] p-2.5 shadow-2xl space-y-2"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('battle.speedPopoverTitle')}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ALLOWED_BATTLE_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  data-testid={`battle-speed-phone-opt-${spd}`}
                  aria-pressed={battleSpeed === spd}
                  onClick={() => {
                    setBattleSpeed(spd);
                    setPhoneSpeedPopoverOpen(false);
                  }}
                  className={`min-h-[38px] rounded-md border font-mono-nums text-[12px] font-bold cursor-pointer transition-colors ${
                    battleSpeed === spd
                      ? 'border-sky-400 bg-sky-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  const canPlayerManualAct = isPlayerTurn && !autoBattleEnabled;
  const showRepeatBatchSummary = Boolean(
    autoRepeatSession &&
      !autoRepeatSession.active &&
      (battle.summary || autoRepeatSession.stopReason === 'inventory_full')
  );

  const allyRemainingHp = allies.reduce(
    (acc, u) => acc + (u.alive ? u.hp : 0),
    0
  );
  const enemyRemainingHp = enemies.reduce(
    (acc, u) => acc + (u.alive ? u.hp : 0),
    0
  );
  const totalRemainingHp = Math.max(1, allyRemainingHp + enemyRemainingHp);
  const allySharePct = Math.round((allyRemainingHp / totalRemainingHp) * 100);
  const enemySharePct = 100 - allySharePct;
  const aliveAlliesCount = allies.filter((u) => u.alive).length;
  const aliveEnemiesCount = enemies.filter((u) => u.alive).length;

  const latestLog =
    battle.log.length > 0 ? battle.log[battle.log.length - 1] : null;

  const handleInspectUnit = (unit: CombatUnit) => {
    setInspectedUnitId(unit.id);
    if (isPhonePortrait) {
      setPhoneUnitSheetId(unit.id);
    }
  };

  const getRowTitle = (row: CombatRow) =>
    row === 'front'
      ? t('common.frontRow')
      : row === 'middle'
      ? t('common.middleRow')
      : t('common.backRow');

  const getCardInvalidReason = (unit: CombatUnit): string | null => {
    const actor =
      activeUnit?.isPlayer && activeUnit.alive ? activeUnit : playerUnit ?? null;
    const check = evaluateRadarTargetValidity(battle.units, actor, unit, 'attack');
    if (check.valid) return null;
    if (check.reason === 'unit_down') return t('radar.invalidDown');
    if (check.reason === 'stealthed') return t('radar.invalidStealthed');
    if (check.reason === 'middle_row_alive') return t('radar.invalidMiddleAlive');
    return t('radar.invalidFrontAlive');
  };

  const renderCardUnit = (
    unit: CombatUnit,
    compact: boolean,
    statusRows: number
  ) => {
    const isEnemy = unit.side === 'enemy';
    const frontBlocked =
      isEnemy && unit.alive && !validBasicTargetIds.has(unit.id);
    const stageFxRole: 'attacker' | 'target' | null =
      showActionStage && latestCardFx
        ? unit.id === latestCardFxActorId &&
          (latestCardFxTargetIds.size === 0 ||
            latestCardFxTargetIds.size > 1 ||
            !latestCardFxTargetIds.has(unit.id))
          ? 'attacker'
          : latestCardFxTargetIds.has(unit.id)
          ? 'target'
          : null
        : null;

    return (
      <BattleUnitCard
        key={unit.id}
        unit={unit}
        compact={compact}
        frontBlocked={frontBlocked}
        wingmanChatText={null}
        statusRows={statusRows}
        isActiveTurn={activeUnitId === unit.id && !battle.summary}
        isTargeted={
          isEnemy
            ? battle.selectedTargetId === unit.id && unit.alive
            : hasSingleAllySkill &&
              battle.selectedAllyTargetId === unit.id &&
              unit.alive
        }
        canTarget={
          isEnemy
            ? canPlayerManualAct && unit.alive
            : canPlayerManualAct && unit.alive && hasSingleAllySkill
        }
        exploding={battle.explodedUnitIds.includes(unit.id)}
        skipAnimations={bypassFx}
        autoActive={unit.isPlayer && autoBattleEnabled}
        showStatusLabels={fxSettings.showStatusLabels}
        popups={battle.popups.filter((p) => p.unitId === unit.id)}
        suppressPopups={showActionStage}
        stageFxRole={stageFxRole}
        stageFxColor={stageFxRole === 'target' ? latestCardFxToneColor : null}
        stageFxKey={latestCardFx?.id ?? null}
        onSelect={
          isEnemy
            ? () => {
                if (frontBlocked || hasStatus(unit, 'stealth')) {
                  const reason = getCardInvalidReason(unit);
                  if (reason) setCardToast(reason);
                  return;
                }
                selectTarget(unit.id);
                setInspectedUnitId(unit.id);
              }
            : () => {
                selectAllyTarget(unit.id);
                setInspectedUnitId(unit.id);
              }
        }
        onInspect={() => handleInspectUnit(unit)}
      />
    );
  };

  const renderCardSideHeader = (side: 'ally' | 'enemy', withTestId = true) => (
    <div
      data-testid={withTestId ? `card-side-${side}` : undefined}
      className="flex items-center justify-between text-[13px] px-1 min-w-0"
    >
      <span
        className="font-display text-[14px] font-bold tracking-wider uppercase truncate"
        style={{
          color: side === 'enemy' ? 'var(--team-enemy)' : 'var(--team-ally)',
        }}
      >
        {side === 'enemy' ? t('battle.tabEnemies') : t('battle.tabAllies')}
      </span>
      <span className="font-mono-nums text-[12px] text-slate-400 shrink-0">
        {side === 'enemy'
          ? `${aliveEnemiesCount}/${enemies.length}`
          : `${aliveAlliesCount}/${allies.length}`}
      </span>
    </div>
  );

  const renderEmptyBothLaneLine = (row: CombatRow, spanTwo: boolean) => (
    <div
      key={`empty-both-${row}`}
      data-card-row-empty={row}
      className={`${
        spanTwo ? 'col-span-2' : ''
      } min-w-0 h-[20px] min-h-[20px] max-h-[20px] overflow-hidden rounded border border-dashed border-slate-800/70 bg-slate-950/25 px-2 flex items-center text-[12px] leading-none font-mono-nums font-bold text-slate-500`}
    >
      <span className="truncate">{getRowTitle(row)}</span>
    </div>
  );

  const renderCardLaneCell = (
    side: 'ally' | 'enemy',
    row: CombatRow,
    units: CombatUnit[],
    compact: boolean
  ) => {
    const exposureMap = side === 'enemy' ? enemyExposure : allyExposure;
    const exposure = exposureMap?.[row] ?? 'empty';
    const isExposed = exposure === 'exposed';
    const isProtected = exposure === 'protected';
    const rowUnits = units
      .filter((u) => u.row === row)
      .sort((a, b) => (a.formationCol ?? 0) - (b.formationCol ?? 0));

    const borderClasses = isExposed
      ? side === 'enemy'
        ? 'border-red-500/45 bg-red-950/15'
        : 'border-sky-500/45 bg-sky-950/15'
      : isProtected
      ? 'border-dashed border-slate-700/90 bg-slate-950/55'
      : 'border-dashed border-slate-800/70 bg-slate-950/25';

    if (rowUnits.length === 0) {
      return (
        <div
          key={`${side}-${row}`}
          data-card-row={`${side}-${row}`}
          data-row-state={exposure}
          className={`min-w-0 min-h-[20px] overflow-hidden rounded-lg border p-1.5 ${borderClasses}`}
        />
      );
    }

    return (
      <div
        key={`${side}-${row}`}
        data-card-row={`${side}-${row}`}
        data-row-state={exposure}
        className={`min-w-0 overflow-hidden rounded-lg border p-1.5 flex flex-col gap-1 ${borderClasses}`}
      >
        <div className="flex items-center px-1 text-[12px] font-mono-nums font-bold min-w-0">
          <span
            className={
              isExposed
                ? side === 'enemy'
                  ? 'text-red-300'
                  : 'text-sky-300'
                : 'text-slate-400'
            }
          >
            {getRowTitle(row)}
          </span>
        </div>

        <div className="space-y-1 min-w-0">
          {rowUnits.map((u) => renderCardUnit(u, compact, laneStatusRows[row]))}
        </div>
      </div>
    );
  };

  const renderFieldContent = () => {
    if (effectiveViewMode === 'radar') {
      return (
        <BattleRadarView
          battle={battle}
          activeUnitId={activeUnitId}
          validBasicTargetIds={validBasicTargetIds}
          canPlayerManualAct={canPlayerManualAct}
          hasSingleAllySkill={hasSingleAllySkill}
          autoBattleEnabled={autoBattleEnabled}
          skipAnimations={skipAnimations}
          speechBubblesEnabled={speechBubblesEnabled}
          battleSpeed={battleSpeed}
          effectsMode={fxSettings.effectsMode}
          reducedMotionMode={fxSettings.reducedMotionMode}
          effectsDebugEnabled={fxSettings.effectsDebug}
          showStatusLabels={fxSettings.showStatusLabels}
          playerWeaponId={playerWeaponId}
          layoutMode={layoutMode}
          selectedUnitId={inspectedUnitId}
          onSelectEnemy={(id) => {
            selectTarget(id);
            setInspectedUnitId(id);
          }}
          onSelectAlly={(id) => {
            selectAllyTarget(id);
            setInspectedUnitId(id);
          }}
          onInspectUnit={handleInspectUnit}
          onInvalidTargetLog={(reason, unit) => {
            const reasonKey =
              reason === 'middle_row_alive'
                ? 'radar.invalidMiddleAlive'
                : reason === 'stealthed'
                ? 'radar.invalidStealthed'
                : reason === 'unit_down'
                ? 'radar.invalidDown'
                : 'radar.invalidFrontAlive';
            logRadarInvalidTarget(unit.name, reasonKey);
          }}
        />
      );
    }

    if (isPhonePortrait) {
      return (
        <div
          data-testid="battle-card-view"
          className="flex flex-col gap-2"
        >
          {cardToast && (
            <div
              role="status"
              data-testid="card-invalid-target-toast"
              className="shrink-0 rounded-md border border-amber-400/70 bg-amber-950/85 px-2.5 py-1 text-[12px] font-semibold text-amber-100 text-center truncate"
            >
              {cardToast}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {(['ally', 'enemy'] as const).map((side) => {
              const sideUnits = side === 'enemy' ? enemies : allies;
              return (
                <div
                  key={side}
                  className="space-y-1.5 min-w-0"
                  data-testid={`card-side-${side}`}
                >
                  {renderCardSideHeader(side, false)}
                  {ROWS_ORDER.map((row) => {
                    const hasAnySide =
                      allies.some((u) => u.row === row) ||
                      enemies.some((u) => u.row === row);
                    if (!hasAnySide) {
                      return renderEmptyBothLaneLine(row, false);
                    }
                    return renderCardLaneCell(side, row, sideUnits, true);
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        data-testid="battle-card-view"
        className="flex-1 min-h-0 min-w-0 w-full flex flex-col overflow-hidden"
      >
        {cardToast && (
          <div
            role="status"
            data-testid="card-invalid-target-toast"
            className="shrink-0 mb-1.5 rounded-md border border-amber-400/70 bg-amber-950/85 px-3 py-1 text-[12px] font-semibold text-amber-100 text-center truncate"
          >
            {cardToast}
          </div>
        )}
        <div
          style={{ touchAction: 'pan-y' }}
          className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden tactical-scroll touch-pan-y p-1"
        >
          <div
            data-testid="card-lane-grid"
            className="min-w-0 w-full grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-stretch"
          >
            {renderCardSideHeader('ally', true)}
            {renderCardSideHeader('enemy', true)}
            {ROWS_ORDER.map((row) => {
              const hasAlly = allies.some((u) => u.row === row);
              const hasEnemy = enemies.some((u) => u.row === row);
              if (!hasAlly && !hasEnemy) {
                return renderEmptyBothLaneLine(row, true);
              }
              return (
                <Fragment key={`lane-row-${row}`}>
                  {renderCardLaneCell('ally', row, allies, false)}
                  {renderCardLaneCell('enemy', row, enemies, false)}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderSidebarSelectedUnit = () => {
    const panelFixedStyle = {
      height: `${SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}px`,
      minHeight: `${SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}px`,
      maxHeight: `${SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}px`,
    };

    if (!sidebarUnit) {
      return (
        <div
          data-testid="battle-selected-unit-panel"
          data-panel-height-px={SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}
          style={panelFixedStyle}
          className="rounded-lg border border-slate-800 bg-[#0A101B] px-2.5 py-1.5 flex items-center justify-center text-[13px] text-slate-400 text-center shrink-0 h-[240px] min-h-[240px] max-h-[240px] overflow-hidden"
        >
          {t('battle.noUnitSelected')}
        </div>
      );
    }

    const isEnemy = sidebarUnit.side === 'enemy';
    const teamRole = getTeamColorRole(sidebarUnit);
    const teamAccent = getTeamAccentVar(sidebarUnit);
    const hpRatio = Math.max(
      0,
      Math.min(1, sidebarUnit.hp / Math.max(1, sidebarUnit.derived.maxHp))
    );
    const hpColor =
      hpRatio <= 0.25
        ? 'bg-red-500'
        : hpRatio <= 0.55
        ? 'bg-orange-400'
        : 'bg-emerald-500';
    const isBlocked =
      isEnemy && sidebarUnit.alive && !validBasicTargetIds.has(sidebarUnit.id);
    const isStealthed = hasStatus(sidebarUnit, 'stealth');
    const isLocked =
      (isEnemy && battle.selectedTargetId === sidebarUnit.id) ||
      (!isEnemy &&
        hasSingleAllySkill &&
        battle.selectedAllyTargetId === sidebarUnit.id);
    const canLockTarget =
      sidebarUnit.alive && isEnemy && !isStealthed && canPlayerManualAct;
    const lockBtnDisabled = !canLockTarget || isLocked;
    const blockedLabel = isBlocked
      ? t('battle.frontRowBlocked')
      : t('battle.frontRowNotBlocked');
    const lockBtnLabel = !canLockTarget
      ? t('battle.lockTargetUnavailable')
      : isLocked
      ? t('battle.targetLockedBtn')
      : t('battle.lockTargetBtn');

    return (
      <div
        data-testid="battle-selected-unit-panel"
        data-panel-height-px={SIDEBAR_UNIT_PANEL_TOTAL_HEIGHT_PX}
        style={panelFixedStyle}
        className="rounded-lg border border-slate-800 bg-[#0A101B] px-2.5 py-1.5 flex flex-col gap-1 shrink-0 h-[240px] min-h-[240px] max-h-[240px] overflow-hidden"
      >
        <div
          data-testid="sidebar-unit-header"
          style={{
            height: `${SIDEBAR_UNIT_PANEL_HEIGHTS.headerPx}px`,
            minHeight: `${SIDEBAR_UNIT_PANEL_HEIGHTS.headerPx}px`,
          }}
          className="flex items-center justify-between gap-1.5 flex-nowrap h-[32px] min-h-[32px] max-h-[32px] shrink-0 min-w-0"
        >
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            <span
              data-testid="sidebar-unit-side-tag"
              className="text-[11px] font-mono-nums font-bold px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap"
              style={{ color: teamAccent, borderColor: teamAccent }}
            >
              {getTeamTagLabel(lang, teamRole)}
            </span>
            <span
              data-testid="sidebar-unit-name"
              className="font-display text-[14px] font-bold truncate min-w-0 flex-1"
              style={{ color: sidebarUnit.alive ? teamAccent : '#94a3b8' }}
              title={sidebarUnit.name}
            >
              {sidebarUnit.name}
            </span>
            <span
              data-testid="sidebar-unit-lane"
              className="text-[11px] font-mono-nums text-slate-300 truncate min-w-0 max-w-[48%] shrink"
              title={getRowTitle(sidebarUnit.row)}
            >
              {getRowTitle(sidebarUnit.row)}
            </span>
          </div>

          <div
            data-testid="sidebar-unit-header-actions"
            className="flex items-center gap-1 shrink-0"
          >
            <span
              data-testid="sidebar-blocked-slot"
              data-blocked={isBlocked ? 'true' : 'false'}
              aria-disabled={!isBlocked ? 'true' : undefined}
              title={blockedLabel}
              aria-label={blockedLabel}
              style={{
                width: `${SIDEBAR_UNIT_PANEL_HEIGHTS.blockedSlotPx}px`,
                height: `${SIDEBAR_UNIT_PANEL_HEIGHTS.blockedSlotPx}px`,
              }}
              className={`w-6 h-6 shrink-0 rounded border inline-flex items-center justify-center transition-colors ${
                isBlocked
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
                  : 'border-slate-800 bg-slate-900/60 text-slate-500 opacity-40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </span>

            <button
              type="button"
              data-testid="sidebar-lock-target-btn"
              data-applicable={canLockTarget ? 'true' : 'false'}
              data-locked={isLocked ? 'true' : 'false'}
              disabled={lockBtnDisabled}
              aria-disabled={lockBtnDisabled ? 'true' : undefined}
              aria-pressed={canLockTarget && isLocked ? true : undefined}
              onClick={
                canLockTarget && !isLocked
                  ? () => selectTarget(sidebarUnit.id)
                  : undefined
              }
              title={lockBtnLabel}
              aria-label={lockBtnLabel}
              style={{
                width: `${SIDEBAR_UNIT_PANEL_HEIGHTS.lockButtonSlotPx}px`,
                height: `${SIDEBAR_UNIT_PANEL_HEIGHTS.lockButtonSlotPx}px`,
              }}
              className={`w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center transition-colors ${
                !canLockTarget
                  ? 'border border-slate-800 bg-slate-900/60 text-slate-500 opacity-40 cursor-default'
                  : isLocked
                  ? 'border border-red-500/55 bg-red-500/20 text-red-300 cursor-default'
                  : 'bg-red-500 hover:bg-red-400 text-slate-950 cursor-pointer'
              }`}
            >
              <Crosshair className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          style={{
            height: `${SIDEBAR_UNIT_PANEL_HEIGHTS.barsPx}px`,
            minHeight: `${SIDEBAR_UNIT_PANEL_HEIGHTS.barsPx}px`,
          }}
          className="h-[52px] min-h-[52px] max-h-[52px] flex flex-col justify-between shrink-0 overflow-hidden"
        >
          <StatBar
            label="HP"
            value={sidebarUnit.hp}
            max={sidebarUnit.derived.maxHp}
            fillClassName={hpColor}
            heightClassName="h-2"
            instant={bypassFx}
            compactHeader
          />
          <div className="grid grid-cols-2 gap-2">
            <StatBar
              label="SHD"
              labelClassName="text-sky-400"
              valueClassName="text-sky-200"
              value={sidebarUnit.shield}
              max={Math.max(1, sidebarUnit.derived.maxShield)}
              valueText={`${sidebarUnit.shield}/${sidebarUnit.derived.maxShield}`}
              fillClassName="bg-sky-400"
              heightClassName="h-1.5"
              instant={bypassFx}
              compactHeader
            />
            <StatBar
              label="SP"
              labelClassName={SP_COLOR_TOKENS.textClass}
              valueClassName={SP_COLOR_TOKENS.textClass}
              value={sidebarUnit.sp}
              max={Math.max(1, sidebarUnit.derived.maxSp)}
              valueText={`${sidebarUnit.sp}/${sidebarUnit.derived.maxSp}`}
              fillClassName={SP_COLOR_TOKENS.barFillClass}
              heightClassName="h-1.5"
              instant={bypassFx}
              compactHeader
            />
          </div>
        </div>

        {/* Fixed-width tabular telemetry */}
        <div
          style={{
            height: `${SIDEBAR_UNIT_PANEL_HEIGHTS.telemetryPx}px`,
            minHeight: `${SIDEBAR_UNIT_PANEL_HEIGHTS.telemetryPx}px`,
          }}
          className="grid grid-cols-5 gap-1 text-center font-mono-nums text-[11px] leading-[16px] h-[38px] min-h-[38px] max-h-[38px] shrink-0 overflow-hidden"
        >
          <div className="rounded bg-slate-900/90 border border-slate-800 py-0.5 flex flex-col justify-center">
            <div className="text-slate-400">ATK</div>
            <div className="font-bold text-slate-100">
              {sidebarUnit.derived.attackPower}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 py-0.5 flex flex-col justify-center">
            <div className="text-slate-400">DEF</div>
            <div className="font-bold text-slate-100">
              {sidebarUnit.derived.defenseRating}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 py-0.5 flex flex-col justify-center">
            <div className="text-slate-400">SPD</div>
            <div className="font-bold text-sky-300">
              {getEffectiveUnitSpeed(sidebarUnit)}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 py-0.5 flex flex-col justify-center">
            <div className="text-slate-400">EVA</div>
            <div className="font-bold text-emerald-300">
              {sidebarUnit.derived.dodgeChance}%
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 py-0.5 flex flex-col justify-center">
            <div className="text-slate-400">CRT</div>
            <div className="font-bold text-amber-300">
              {sidebarUnit.derived.critChance}%
            </div>
          </div>
        </div>

        <FixedStatusArea
          statuses={sidebarUnit.statuses}
          rows={2}
          scrollOverflow
          unit={sidebarUnit}
          unitTitle={sidebarUnit.name}
          badgeLayout={statusSettings.badgeLayout}
          iconMods={adminConfig.iconCatalogMods}
          showLabels={fxSettings.showStatusLabels}
          fallbackWidthPx={290}
          rootTestId="sidebar-status-area"
          chipTestIdPrefix="sidebar-status-chip"
          emptyTestId="sidebar-status-empty"
        />
      </div>
    );
  };

  const renderPlayerStatusBar = (compactOneRow: boolean) => {
    const ownUnit = playerUnit ?? allies[0] ?? null;
    if (!ownUnit) return null;

    const isDestroyed = !ownUnit.alive;
    const maxHp = Math.max(1, ownUnit.derived.maxHp);
    const maxShield = Math.max(1, ownUnit.derived.maxShield);
    const maxSp = Math.max(1, ownUnit.derived.maxSp);

    const hpPct = isDestroyed
      ? 0
      : Math.max(0, Math.min(100, Math.round((ownUnit.hp / maxHp) * 100)));
    const shieldOverlayPct = isDestroyed
      ? 0
      : Math.max(0, Math.min(100, Math.round((ownUnit.shield / maxHp) * 100)));
    const spPct = isDestroyed
      ? 0
      : Math.max(0, Math.min(100, Math.round((ownUnit.sp / maxSp) * 100)));

    const hpFillClass = isDestroyed
      ? 'bg-slate-600'
      : hpPct <= 25
      ? 'bg-red-500'
      : hpPct <= 55
      ? 'bg-amber-400'
      : 'bg-emerald-500';

    if (compactOneRow) {
      if (isDestroyed) {
        return (
          <div
            data-testid="battle-player-status-bar"
            data-collapsed="true"
            data-destroyed="true"
            className="shrink-0 mx-1.5 mt-1 h-[28px] max-h-[28px] min-w-0 rounded border border-slate-700 bg-slate-900/85 px-2 flex items-center gap-1.5 text-[11px] font-mono-nums text-slate-400 grayscale overflow-hidden"
          >
            <span
              data-testid="battle-player-team-tag"
              className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-bold shrink-0"
            >
              {getTeamTagLabel(lang, 'me')}
            </span>
            <span
              className="font-semibold truncate text-slate-400 line-through min-w-0"
              title={t('battle.playerShipLabel')}
            >
              {ownUnit.name}
            </span>
            <span
              data-testid="battle-player-destroyed-badge"
              className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-600 text-slate-200 text-[10px] font-bold shrink-0"
            >
              {t('battle.playerDestroyed')}
            </span>
          </div>
        );
      }

      return (
        <div
          data-testid="battle-player-status-bar"
          data-collapsed="true"
          data-destroyed="false"
          className="shrink-0 mx-1.5 mt-1 rounded border px-2 py-1 space-y-1 text-[11px] font-mono-nums border-emerald-500/35 bg-[#09121D] text-slate-100"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 shrink">
              <span
                className={`font-semibold truncate ${
                  isDestroyed
                    ? 'text-slate-400 line-through max-w-[160px]'
                    : 'text-emerald-300 max-w-[92px]'
                }`}
              >
                {ownUnit.name}
              </span>
              {isDestroyed && (
                <span
                  data-testid="battle-player-destroyed-badge"
                  className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-bold shrink-0"
                >
                  {t('battle.playerDestroyed')}
                </span>
              )}
            </div>

            {!isDestroyed && (
              <>
                <div className="flex-1 min-w-[90px] flex flex-col gap-0.5">
                  <div
                    data-testid="battle-player-hp-shield-bar"
                    className="relative h-2 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden"
                  >
                    <div
                      data-testid="battle-player-hp-fill"
                      style={{ width: `${hpPct}%` }}
                      className={`h-full transition-all duration-200 ${hpFillClass}`}
                    />
                    {shieldOverlayPct > 0 && (
                      <div
                        data-testid="battle-player-shield-overlay"
                        style={{ width: `${shieldOverlayPct}%` }}
                        className="absolute inset-y-0 left-0 bg-sky-400/70 border-r border-cyan-200 transition-all duration-200"
                      />
                    )}
                  </div>
                  <div
                    data-testid="battle-player-sp-bar"
                    className="h-1 w-full rounded-full bg-slate-900 overflow-hidden"
                  >
                    <div
                      data-testid="battle-player-sp-fill"
                      style={{ width: `${spPct}%` }}
                      className={`h-full transition-all duration-200 ${SP_COLOR_TOKENS.barFillClass}`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                  <span data-testid="battle-player-hp-numbers" className="text-slate-200">
                    {ownUnit.hp}/{ownUnit.derived.maxHp}
                  </span>
                  {ownUnit.shield > 0 && (
                    <span data-testid="battle-player-shield-numbers" className="text-sky-300">
                      +{ownUnit.shield}
                    </span>
                  )}
                  <span
                    data-testid="battle-player-sp-numbers"
                    className={SP_COLOR_TOKENS.textClass}
                  >
                    SP {ownUnit.sp}
                  </span>
                </div>
              </>
            )}
          </div>

          <FixedStatusArea
            statuses={isDestroyed ? [] : ownUnit.statuses}
            rows={activePlayerRows}
            unit={ownUnit}
            unitTitle={ownUnit.name}
            badgeLayout={statusSettings.badgeLayout}
            iconMods={adminConfig.iconCatalogMods}
            showLabels={fxSettings.showStatusLabels}
            fallbackWidthPx={320}
            compact
            rootTestId="battle-player-status-effects"
            chipTestIdPrefix="player-status-chip"
            overflowTestId="player-status-overflow"
          />
        </div>
      );
    }

    if (isDestroyed) {
      return (
        <div
          data-testid="battle-player-status-bar"
          data-collapsed="false"
          data-destroyed="true"
          className="shrink-0 h-[28px] max-h-[28px] min-w-0 rounded-md border border-slate-700 bg-slate-900/85 px-2.5 flex items-center gap-2 text-[12px] text-slate-400 grayscale overflow-hidden"
        >
          <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-600 text-slate-300 font-mono-nums text-[10px] font-bold shrink-0">
            {getTeamTagLabel(lang, 'me')}
          </span>
          <span
            className="font-bold truncate text-slate-400 line-through min-w-0"
            title={t('battle.playerShipLabel')}
          >
            {ownUnit.name}
          </span>
          <span
            data-testid="battle-player-destroyed-badge"
            className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-600 text-slate-200 text-[10px] font-bold shrink-0"
          >
            {t('battle.playerDestroyed')}
          </span>
        </div>
      );
    }

    const shieldBarPct = Math.max(
      0,
      Math.min(100, Math.round((ownUnit.shield / maxShield) * 100))
    );

    return (
      <div
        data-testid="battle-player-status-bar"
        data-collapsed="false"
        data-destroyed="false"
        className={`shrink-0 min-w-0 rounded-lg border border-emerald-500/35 bg-[#09121D] text-slate-100 px-2 py-0.5 space-y-0.5 ${
          activePlayerRows <= 1 ? 'max-h-[72px]' : ''
        }`}
      >
        <div className="h-[22px] flex items-center gap-2 min-w-0 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0 shrink-0 max-w-[175px]">
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono-nums text-[10px] font-bold shrink-0">
              {getTeamTagLabel(lang, 'me')}
            </span>
            <span
              className="font-bold truncate text-emerald-200 text-[12px]"
              title={t('battle.playerShipLabel')}
            >
              {ownUnit.name}
            </span>
          </div>

          <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 items-center font-mono-nums text-[11px]">
            {/* HP thin bar */}
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-emerald-300 font-bold shrink-0">HP</span>
              <div
                data-testid="battle-player-hp-shield-bar"
                className="relative flex-1 min-w-0 h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden"
              >
                <div
                  data-testid="battle-player-hp-fill"
                  style={{ width: `${hpPct}%` }}
                  className={`h-full transition-all duration-200 ${hpFillClass}`}
                />
              </div>
              <span
                data-testid="battle-player-hp-numbers"
                className="text-emerald-200 shrink-0 tabular-nums"
              >
                {ownUnit.hp}/{ownUnit.derived.maxHp}
              </span>
            </div>

            {/* SHD thin bar */}
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-sky-300 font-bold shrink-0">SHD</span>
              <div
                data-testid="battle-player-shield-bar"
                className="relative flex-1 min-w-0 h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden"
              >
                {shieldBarPct > 0 && (
                  <div
                    data-testid="battle-player-shield-overlay"
                    style={{ width: `${shieldBarPct}%` }}
                    className="h-full bg-sky-400 transition-all duration-200"
                  />
                )}
              </div>
              <span
                data-testid="battle-player-shield-numbers"
                className="text-sky-200 shrink-0 tabular-nums"
              >
                {ownUnit.shield}/{maxShield}
              </span>
            </div>

            {/* SP thin bar (orange token #EF9F27) */}
            <div className="flex items-center gap-1 min-w-0">
              <span className={`${SP_COLOR_TOKENS.textClass} font-bold shrink-0`}>
                SP
              </span>
              <div
                data-testid="battle-player-sp-bar"
                className="relative flex-1 min-w-0 h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden"
              >
                <div
                  data-testid="battle-player-sp-fill"
                  style={{ width: `${spPct}%` }}
                  className={`h-full transition-all duration-200 ${SP_COLOR_TOKENS.barFillClass}`}
                />
              </div>
              <span
                data-testid="battle-player-sp-numbers"
                className={`${SP_COLOR_TOKENS.textClass} shrink-0 tabular-nums`}
              >
                {ownUnit.sp}/{ownUnit.derived.maxSp}
              </span>
            </div>
          </div>
        </div>

        <FixedStatusArea
          statuses={ownUnit.statuses}
          rows={activePlayerRows}
          unit={ownUnit}
          unitTitle={ownUnit.name}
          badgeLayout={statusSettings.badgeLayout}
          iconMods={adminConfig.iconCatalogMods}
          showLabels={fxSettings.showStatusLabels}
          fallbackWidthPx={440}
          compact
          rootTestId="battle-player-status-effects"
          chipTestIdPrefix="player-status-chip"
          overflowTestId="player-status-overflow"
        />
      </div>
    );
  };

  return (
    <div
      className={
        isPhonePortrait
          ? 'relative flex-1 flex flex-col bg-tactical-grid'
          : 'relative flex-1 min-h-0 flex flex-col bg-tactical-grid overflow-y-auto overflow-x-hidden'
      }
    >
      {isPhonePortrait ? (
        /* ==================== PHONE PORTRAIT LAYOUT (<= 640px portrait) ==================== */
        <div
          data-testid="battle-phone-layout"
          className="flex-1 flex flex-col"
        >
          {/* 2) One-line turn queue strip (max 44px) */}
          <TurnQueueBar
            battle={battle}
            battleSpeed={battleSpeed}
            skipAnimations={skipAnimations}
            enrageBonusPct={enrageBonusPct}
            variant="phone"
            targetName={actingTargetName}
            onSelectUnit={(id) => {
              const u = battle.units.find((x) => x.id === id);
              if (u) handleInspectUnit(u);
            }}
          />

          {/* 3) Sticky compact control row (max 48px): Auto, Speed Cycle, View Switch (icon-only), Loop (icon+num / running chip), "..." More */}
          <div
            data-testid="battle-phone-controls"
            className="sticky top-0 z-30 h-12 max-h-[48px] shrink-0 border-b border-slate-800/80 bg-slate-900/95 px-1.5 flex items-center justify-between gap-1 flex-nowrap overflow-x-hidden"
          >
            <button
              type="button"
              data-testid="battle-auto-toggle"
              onClick={toggleAutoBattle}
              aria-pressed={autoBattleEnabled}
              title={t('auto.hotkeyHint')}
              className={`h-10 min-w-[44px] max-w-[88px] shrink-0 px-2 rounded-lg border text-[12px] font-bold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                autoBattleEnabled
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {autoBattleEnabled ? t('auto.auto') : t('auto.manual')}
              </span>
            </button>

            <button
              ref={phoneSpeedAnchorRef}
              type="button"
              data-testid="battle-speed-cycle"
              aria-expanded={phoneSpeedPopoverOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setLoopPopoverOpen(false);
                setPhoneSpeedPopoverOpen((v) => {
                  const next = !v;
                  if (next) {
                    setPhoneSpeedPopoverPos(
                      computeAnchoredPopoverPosition(
                        phoneSpeedAnchorRef.current,
                        216
                      )
                    );
                  }
                  return next;
                });
              }}
              title={t('battle.speedCycleTooltip')}
              aria-label={`${t('battle.speedCycleTooltip')}: ${battleSpeed}x`}
              className={`h-10 min-w-[44px] px-2 rounded-lg border font-mono-nums text-[12px] font-bold inline-flex items-center justify-center cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                phoneSpeedPopoverOpen
                  ? 'border-sky-400 bg-slate-800 text-sky-200 ring-1 ring-sky-400/30'
                  : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-300'
              }`}
            >
              {battleSpeed}x
            </button>
            {phoneSpeedPopoverNode}

            <button
              type="button"
              data-testid="battle-view-switch"
              onClick={() =>
                setBattleViewMode(
                  effectiveViewMode === 'radar' ? 'card' : 'radar'
                )
              }
              title={
                effectiveViewMode === 'radar'
                  ? t('battle.switchToCard')
                  : t('battle.switchToRadar')
              }
              aria-label={
                effectiveViewMode === 'radar'
                  ? t('battle.switchToCard')
                  : t('battle.switchToRadar')
              }
              className="h-10 w-11 min-w-[44px] p-0 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              {effectiveViewMode === 'radar' ? (
                <LayoutGrid className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
              ) : (
                <Radar className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
              )}
            </button>

            {/* Loop Button / Active Progress Chip (phone: icon + number or N/M + stop) */}
            {renderLoopControl(true)}

            <button
              type="button"
              data-testid="battle-more-btn"
              onClick={() => setMoreActionsOpen(true)}
              aria-label={t('battle.moreActions')}
              title={t('battle.moreActions')}
              className="h-10 min-w-[44px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Phone Card Mode Action Stage strip (0px / null when OFF, radar mode, or summary) */}
          <ActionStage
            battle={battle}
            activeUnit={activeUnit}
            actingTargetName={actingTargetName}
            battleSpeed={battleSpeed}
            vfxConfig={vfxConfig}
            enabled={actionStageEnabled}
            viewMode={effectiveViewMode}
            variant="phone"
          />

          {/* Force-Ratio Strip + 1-Row Collapsed Player Status Bar */}
          <div
            data-testid="battle-force-ratio-bar"
            className="shrink-0 px-2 pt-1 flex items-center gap-2 text-[11px] font-mono-nums"
          >
            <span className="font-bold text-sky-300">
              {aliveAlliesCount}/{allies.length}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden flex">
              <div
                style={{ width: `${allySharePct}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-300"
              />
              <div
                style={{ width: `${enemySharePct}%` }}
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
              />
            </div>
            <span className="font-bold text-red-400">
              {aliveEnemiesCount}/{enemies.length}
            </span>
          </div>
          {renderPlayerStatusBar(true)}

          {/* Safety Pause Notice (when Auto paused on Low HP / Boss / Elite) */}
          {battle.autoStopNotice && !battle.summary && (
            <div className="shrink-0 border-b border-orange-500/40 bg-orange-500/12 px-2 py-1 flex items-center justify-between gap-2 text-[12px] text-orange-200">
              <span className="truncate">
                {t('auto.pausedNotice', {
                  reason: getAutoStopReasonLabel(lang, battle.autoStopNotice),
                })}
              </span>
              <button
                type="button"
                onClick={() => setAutoBattleEnabled(true)}
                className="min-h-[32px] px-2 rounded border border-emerald-400/60 bg-emerald-500/20 text-emerald-200 font-semibold shrink-0 cursor-pointer"
              >
                {t('auto.auto')}
              </button>
            </div>
          )}

          {/* 4) Battlefield — natural page flow, zero inner scroll & zero clipping */}
          <div className="flex flex-col px-2 pt-2">
            {renderFieldContent()}
          </div>

          {effectiveViewMode === 'radar' && (
            <div className="px-2 pt-2">
              <RadarStatusBoard
                units={battle.units}
                variant="phone"
                collapsed={statusBoardCollapsed}
                onToggleCollapse={handleToggleStatusBoard}
                selectedUnitId={inspectedUnitId}
                onSelectUnit={(unit) => {
                  setInspectedUnitId(unit.id);
                  if (unit.side === 'enemy') {
                    if (validBasicTargetIds.has(unit.id)) {
                      selectTarget(unit.id);
                    }
                  } else {
                    selectAllyTarget(unit.id);
                  }
                }}
                badgeLayout={statusSettings.badgeLayout}
                iconMods={adminConfig.iconCatalogMods}
              />
            </div>
          )}

          <div
            data-testid="battle-phone-radar-log-gap"
            aria-hidden="true"
            style={{ height: `${PHONE_RADAR_LOG_GAP_PX}px` }}
            className="shrink-0"
          />

          {/* 5) Combat log: flows inside page scroll with zero nested scroll box; Dòng = 1 line, Mở rộng = full flow, Cửa sổ = bottom sheet */}
          <div className="shrink-0 px-2 pb-1">
            <div
              data-testid="battle-phone-docked-log"
              className="rounded-lg border border-slate-800 bg-[#070A10] flex flex-col"
            >
              <div
                data-testid="combat-log-header-row-1"
                className="shrink-0 h-[36px] min-h-[36px] max-h-[36px] px-2 border-b border-slate-800/90 flex items-center justify-between gap-1.5 flex-nowrap text-[11px] text-slate-400"
              >
                <div className="inline-flex items-center gap-1 min-w-0 shrink">
                  <ScrollText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span
                    data-testid="combat-log-header-title"
                    className="font-semibold text-slate-200 whitespace-nowrap text-[11px]"
                  >
                    {t('battle.combatLog')}
                  </span>
                  <span
                    data-testid="combat-log-header-count"
                    className="font-mono-nums text-[10px] text-slate-400 whitespace-nowrap"
                  >
                    ({battle.log.length})
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-nowrap shrink-0">
                  {renderLogModeSegmented()}
                  <button
                    type="button"
                    data-testid="combat-log-mode-toggle"
                    data-popup-open={logSheetOpen ? 'true' : 'false'}
                    onClick={handleOpenCombatLogPopup}
                    title={t('log.modePopup')}
                    aria-label={t('log.modePopup')}
                    className="min-h-[24px] h-[24px] px-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Maximize2 className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>{t('log.modePopup')}</span>
                  </button>
                </div>
              </div>
              {sidebarLogMode === 'line' ? (
                <div
                  data-testid="battle-phone-log-line"
                  className="px-2.5 py-1.5 text-[12px] text-slate-200 truncate"
                >
                  {latestLog
                    ? parseStructuredCombatLogRow(lang, latestLog, battle.units)
                        .sentence
                    : t('log.emptyChannel')}
                </div>
              ) : (
                <CombatLogList
                  entries={battle.log}
                  units={battle.units}
                  active={isPhonePortrait}
                  density="compact"
                  mode="docked"
                  channel={logChannel}
                  onChannelChange={setLogChannel}
                  order={logOrder}
                  onOrderChange={handleSetLogOrder}
                  expandAll={logExpandAll}
                  expandNonce={logExpandNonce}
                  onExpandAll={handleExpandAllLogs}
                  onCollapseAll={handleCollapseAllLogs}
                  inlineFlow
                />
              )}
            </div>
          </div>

          {/* 6) Single-row bottom action dock (hidden in Auto mode — no separate AUTO bar) */}
          {!autoBattleEnabled && (
            <div className="shrink-0 border-t border-slate-800/90 bg-[#0A0F18]/98 px-2 py-1.5 pb-safe">
              <div
                data-testid="battle-manual-dock"
                className="grid grid-cols-4 gap-2"
              >
                <button
                  type="button"
                  data-testid="battle-action-attack"
                  disabled={!canPlayerManualAct}
                  onClick={() => performPlayerAction('attack')}
                  className="min-h-[44px] px-2 rounded-lg border border-emerald-500/70 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Crosshair className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('battle.actionAttack')}</span>
                </button>

                <button
                  type="button"
                  data-testid="battle-action-skill"
                  onClick={() => setSkillsSheetOpen(true)}
                  className="min-h-[44px] px-2 rounded-lg border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-100 font-bold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-sky-300 shrink-0" />
                  <span className="truncate">{t('battle.actionSkills')}</span>
                </button>

                <button
                  type="button"
                  data-testid="battle-action-defend"
                  disabled={!canPlayerManualAct}
                  onClick={() => performPlayerAction('defend')}
                  className="min-h-[44px] px-2 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 text-slate-100 font-bold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="truncate">{t('battle.actionDefend')}</span>
                </button>

                <button
                  type="button"
                  data-testid="battle-action-item"
                  onClick={() => setSuppliesSheetOpen(true)}
                  className="min-h-[44px] px-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Backpack className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{t('battle.actionItem')}</span>
                  {usableSupplyCount > 0 && (
                    <span
                      data-testid="battle-action-item-badge"
                      className="min-w-[18px] h-[18px] px-1 rounded bg-amber-400 text-slate-950 font-mono-nums text-[11px] font-bold leading-none inline-flex items-center justify-center shrink-0"
                    >
                      {usableSupplyCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================== TABLET (600-1023) & PC (>= 1024) & LANDSCAPE PHONE LAYOUT ==================== */
        <div
          data-testid="battle-desktop-layout"
          className="flex-1 min-h-0 h-full w-full max-w-full grid grid-cols-[minmax(0,65fr)_minmax(260px,35fr)] gap-2 px-2.5 py-2 overflow-x-hidden"
        >
          {/* LEFT COLUMN (~65%): Controls + Balance Bar + Player Status + Field + Action Bar under field */}
          <div
            data-testid="battle-main-column"
            className="min-w-0 max-w-full flex flex-col gap-1.5 overflow-x-hidden"
          >
            {/* Header stack: control row + force bar + player block (hard cap 150px alive with 1 status row) */}
            <div
              data-testid="battle-main-header"
              className={`shrink-0 min-w-0 max-w-full flex flex-col gap-1.5 ${
                activePlayerRows <= 1 ? 'max-h-[150px]' : ''
              }`}
            >
              {/* Single-Row Unified Control Bar (Manual/Auto + Speed + Radar/Card + Loop + "..." overflow menu) */}
              <div
                data-testid="battle-desktop-controls"
                className="shrink-0 min-w-0 max-w-full max-h-[48px] overflow-x-hidden rounded-lg border border-slate-800/90 bg-[#0A0F18]/95 px-2 py-1 flex items-center justify-between gap-1.5 flex-nowrap"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-nowrap overflow-hidden">
                  {/* Manual | Auto */}
                  <div
                    className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5 shrink-0"
                    role="group"
                    title={t('auto.hotkeyHint')}
                  >
                    <button
                      type="button"
                      data-testid="battle-manual-toggle"
                      aria-pressed={!autoBattleEnabled}
                      onClick={() => setAutoBattleEnabled(false)}
                      className={`h-[34px] min-h-[34px] px-2 rounded-md text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        !autoBattleEnabled
                          ? 'bg-slate-200 text-slate-950'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {t('auto.manual')}
                    </button>
                    <button
                      type="button"
                      data-testid="battle-auto-toggle"
                      aria-pressed={autoBattleEnabled}
                      onClick={() => setAutoBattleEnabled(true)}
                      className={`h-[34px] min-h-[34px] px-2 rounded-md text-[12px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                        autoBattleEnabled
                          ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.45)]'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('auto.auto')}</span>
                      <kbd className="font-mono-nums text-[11px] px-1 rounded bg-black/20">
                        A
                      </kbd>
                    </button>
                  </div>

                  {/* Speeds 1x 2x 3x 5x 10x + "..." extra speeds (12x 15x 20x 30x) */}
                  <div
                    data-testid="battle-speed-selector"
                    className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 shrink-0"
                    role="group"
                    aria-label={t('battle.speedLabel')}
                  >
                    {PRIMARY_BATTLE_SPEEDS.map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        data-testid={`battle-speed-opt-${spd}`}
                        aria-pressed={battleSpeed === spd}
                        onClick={() => setBattleSpeed(spd)}
                        title={`${spd}x`}
                        className={`h-[34px] min-h-[34px] px-1.5 rounded-md text-[12px] font-mono-nums font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          spd >= 5
                            ? 'hidden lg:inline-flex items-center justify-center'
                            : 'inline-flex items-center justify-center'
                        } ${
                          battleSpeed === spd
                            ? 'bg-sky-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                    <button
                      ref={desktopSpeedAnchorRef}
                      type="button"
                      data-testid="battle-speed-more-btn"
                      aria-expanded={desktopSpeedPopoverOpen}
                      aria-haspopup="dialog"
                      aria-pressed={isExtraSpeedActive}
                      title={t('battle.speedMoreTooltip')}
                      aria-label={
                        isExtraSpeedActive
                          ? `${t('battle.speedLabel')}: ${battleSpeed}x`
                          : t('battle.speedMoreTooltip')
                      }
                      onClick={() => {
                        setLoopPopoverOpen(false);
                        setDesktopSpeedPopoverOpen((v) => {
                          const next = !v;
                          if (next) {
                            setDesktopSpeedPopoverPos(
                              computeAnchoredPopoverPosition(
                                desktopSpeedAnchorRef.current,
                                212
                              )
                            );
                          }
                          return next;
                        });
                      }}
                      className={`h-[34px] min-h-[34px] px-1.5 rounded-md text-[12px] font-mono-nums font-bold transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center ${
                        isExtraSpeedActive
                          ? 'bg-sky-500 text-slate-950'
                          : desktopSpeedPopoverOpen
                          ? 'bg-slate-800 text-sky-300 ring-1 ring-sky-400/30'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {isExtraSpeedActive ? `${battleSpeed}x` : '…'}
                    </button>
                    {desktopSpeedExtraPopoverNode}
                  </div>

                  {/* Radar | Card View Switch */}
                  <div
                    data-testid="battle-view-switch"
                    className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5 shrink-0"
                    role="group"
                    aria-label={t('battle.viewModeLabel')}
                  >
                    <button
                      type="button"
                      data-testid="battle-view-radar"
                      aria-pressed={effectiveViewMode === 'radar'}
                      onClick={() => setBattleViewMode('radar')}
                      title={t('battle.viewRadar')}
                      className={`h-[34px] min-h-[34px] px-2 rounded-md text-[12px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                        effectiveViewMode === 'radar'
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <Radar className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('battle.viewRadar')}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="battle-view-card"
                      aria-pressed={effectiveViewMode === 'card'}
                      onClick={() => setBattleViewMode('card')}
                      title={t('battle.viewCard')}
                      className={`h-[34px] min-h-[34px] px-2 rounded-md text-[12px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                        effectiveViewMode === 'card'
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('battle.viewCard')}</span>
                    </button>
                  </div>
                  {/* Loop Button / Active Progress Chip directly next to Radar/Card */}
                  {renderLoopControl(false)}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="battle-more-btn"
                    onClick={() => setMoreActionsOpen(true)}
                    aria-label={t('battle.moreActions')}
                    title={t('battle.moreActions')}
                    className="h-[34px] min-h-[34px] min-w-[36px] px-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 inline-flex items-center justify-center gap-1 cursor-pointer shrink-0"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Compact Balance of Power Meter */}
              <div
                data-testid="battle-force-ratio-bar"
                className="shrink-0 min-w-0 h-[20px] max-h-[22px] px-1 flex items-center gap-2 text-[11px] font-mono-nums"
              >
                <span className="font-bold text-sky-300 w-9 text-left shrink-0">
                  {aliveAlliesCount}/{allies.length}
                </span>
                <div className="flex-1 min-w-0 h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${allySharePct}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-300"
                  />
                  <div
                    style={{ width: `${enemySharePct}%` }}
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
                  />
                </div>
                <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 font-bold text-amber-300 shrink-0">
                  {battle.squadSize}v{battle.squadSize}
                </span>
                <span className="font-bold text-red-400 w-9 text-right shrink-0">
                  {aliveEnemiesCount}/{enemies.length}
                </span>
              </div>

              {/* Player Own Ship Status Bar (directly under Balance of Power) */}
              {renderPlayerStatusBar(false)}
            </div>

            {battle.autoStopNotice && !battle.summary && (
              <div className="shrink-0 min-w-0 rounded-lg border border-orange-500/40 bg-orange-500/12 px-3 py-1.5 flex items-center justify-between gap-2 text-[13px] text-orange-200">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="truncate">
                    {t('auto.pausedNotice', {
                      reason: getAutoStopReasonLabel(lang, battle.autoStopNotice),
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoBattleEnabled(true)}
                  className="min-h-[32px] px-3 rounded border border-emerald-400/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-[12px] font-semibold cursor-pointer shrink-0"
                >
                  {t('auto.auto')}
                </button>
              </div>
            )}

            {/* Main Field */}
            <div
              data-testid="battle-main-field"
              className="flex-1 min-w-0 min-h-[420px] flex flex-col overflow-hidden"
            >
              {renderFieldContent()}
            </div>

            {effectiveViewMode === 'radar' && (
              <RadarStatusBoard
                units={battle.units}
                variant="desktop"
                collapsed={statusBoardCollapsed}
                onToggleCollapse={handleToggleStatusBoard}
                selectedUnitId={inspectedUnitId}
                onSelectUnit={(unit) => {
                  setInspectedUnitId(unit.id);
                  if (unit.side === 'enemy') {
                    if (validBasicTargetIds.has(unit.id)) {
                      selectTarget(unit.id);
                    }
                  } else {
                    selectAllyTarget(unit.id);
                  }
                }}
                badgeLayout={statusSettings.badgeLayout}
                iconMods={adminConfig.iconCatalogMods}
              />
            )}

            {/* Pinned Action Bar Under the Field (hidden when Auto is ON to avoid duplicating the top Auto indicator) */}
            {!autoBattleEnabled && (
              <div className="shrink-0 rounded-lg border border-slate-800/90 bg-[#0A0F18]/98 p-2 space-y-2">
                <>
                  {/* Turn Status + Active Locks */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] px-1">
                    <div className="font-semibold truncate">
                      {isPlayerCharging ? (
                        <span className="text-amber-300">
                          {t('battle.chargingTurn')}
                        </span>
                      ) : isPlayerTurn ? (
                        <span style={{ color: 'var(--turn-active-text)' }}>
                          {t('battle.yourTurnShort')}
                        </span>
                      ) : battle.summary ? (
                        <span className="text-slate-300">
                          {autoRepeatSession?.active
                            ? t('auto.repeatNextSoon')
                            : t('battle.concluded')}
                        </span>
                      ) : (
                        <span className="text-slate-300">
                          {t('battle.aiTurnShort', {
                            name: activeUnit?.name ?? '',
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[12px]">
                      {playerHasLongRangeBasic && (
                        <span className="font-mono-nums text-sky-300">
                          {t('battle.longRangeReady')}
                        </span>
                      )}
                      {hasSingleAllySkill && selectedAlly && selectedAlly.alive && (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <HeartHandshake className="w-3.5 h-3.5" />
                          <span>{selectedAlly.name}</span>
                        </span>
                      )}
                      {selectedTarget && selectedTarget.alive && (
                        <span className="inline-flex items-center gap-1 text-red-300">
                          <Crosshair className="w-3.5 h-3.5 text-red-400" />
                          <span className="font-semibold">
                            {selectedTarget.name}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Single-Row Core + Skill Controls */}
                  <div
                    data-testid="battle-manual-dock"
                    className="flex items-stretch gap-2 min-w-0"
                  >
                    {/* Basic Attack / Defend / Item */}
                    <div className="flex items-stretch gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid="battle-action-attack"
                        disabled={!canPlayerManualAct}
                        onClick={() => performPlayerAction('attack')}
                        title={`${t('battle.actionAttack')} (1)`}
                        className="min-h-[44px] px-3 rounded-lg border border-emerald-500/70 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[13px] inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Crosshair className="w-4 h-4 shrink-0" />
                        <span>{t('battle.actionAttack')}</span>
                        <kbd className="font-mono-nums text-[12px] px-1 rounded bg-black/15">
                          1
                        </kbd>
                      </button>

                      <button
                        type="button"
                        data-testid="battle-action-defend"
                        disabled={!canPlayerManualAct}
                        onClick={() => performPlayerAction('defend')}
                        title={`${t('battle.actionDefend')} (Q)`}
                        className="min-h-[44px] px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 text-slate-100 font-semibold text-[13px] inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>{t('battle.actionDefend')}</span>
                        <kbd className="font-mono-nums text-[12px] px-1 rounded bg-slate-950/70 text-slate-300">
                          Q
                        </kbd>
                      </button>

                      <button
                        type="button"
                        data-testid="battle-action-item"
                        onClick={() => setSuppliesSheetOpen(true)}
                        title={t('battle.suppliesTitle')}
                        className="min-h-[44px] px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-[13px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Backpack className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="hidden xl:inline">
                          {t('battle.actionItem')}
                        </span>
                        {usableSupplyCount > 0 && (
                          <span
                            data-testid="battle-action-item-badge"
                            className="min-w-[18px] h-[18px] px-1 rounded bg-amber-400 text-slate-950 font-mono-nums text-[11px] font-bold leading-none inline-flex items-center justify-center shrink-0"
                          >
                            {usableSupplyCount}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Equipped Skill Slots (hover tooltips on PC) */}
                    <div className="flex-1 min-w-0 grid grid-cols-3 xl:grid-cols-6 gap-1.5">
                      {playerSkillIds.length === 0 ? (
                        <div className="col-span-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 flex items-center justify-center text-[13px] text-slate-500">
                          {t('battle.noSkillsSlotted')}
                        </div>
                      ) : (
                        playerSkillIds.slice(0, 6).map((skillId, idx) => {
                          const skill = getSkillById(skillId);
                          if (!skill || !playerUnit) return null;
                          const usability = canUnitUseSkill(playerUnit, skill.id);
                          const clickable = canPlayerManualAct && usability.canUse;
                          const reasonText = getBattleSkillReason(lang, usability);
                          const lv = playerUnit.skillLevels[skill.id] ?? 1;
                          const isToggleOn = Boolean(usability.isToggleActive);
                          const isUsedOnce =
                            skill.oncePerBattle &&
                            playerUnit.usedOnceSkills.includes(skill.id);

                          const borderClass = isToggleOn
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                            : !clickable
                            ? 'border-slate-800 bg-slate-900/75 text-slate-500 opacity-50'
                            : skill.category === 'elite'
                            ? 'border-amber-400/80 bg-amber-500/15 hover:bg-amber-500/25 text-amber-100'
                            : skill.category === 'special'
                            ? 'border-purple-400/80 bg-purple-500/15 hover:bg-purple-500/25 text-purple-100'
                            : 'border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-100';

                          return (
                            <button
                              key={skill.id}
                              type="button"
                              data-testid={`battle-skill-btn-${skill.id}`}
                              disabled={!clickable}
                              onClick={() => {
                                if (clickable) {
                                  performPlayerAction('skill', skill.id);
                                }
                              }}
                              onMouseEnter={() => setInspectedSkillId(skill.id)}
                              onFocus={() => setInspectedSkillId(skill.id)}
                              title={`${getSkillName(lang, skill.id)} (Lv.${lv}) — ${getSkillDesc(
                                lang,
                                skill.id
                              )}${reasonText ? ` [${reasonText}]` : ''}`}
                              className={`min-w-0 min-h-[44px] px-2 py-1 rounded-lg border text-left transition-colors flex flex-col justify-between gap-0.5 overflow-hidden ${borderClass} ${
                                clickable
                                  ? 'cursor-pointer'
                                  : 'cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <SkillIcon
                                  icon={skill.icon}
                                  className="w-3.5 h-3.5 shrink-0"
                                />
                                <span
                                  className={`font-mono-nums text-[12px] font-bold truncate ${
                                    usability.cooldownRemaining > 0
                                      ? 'text-red-300'
                                      : SP_COLOR_TOKENS.textClass
                                  }`}
                                >
                                  {isToggleOn
                                    ? t('battle.skillOnTag')
                                    : isUsedOnce
                                    ? t('battle.skillUsedTag')
                                    : usability.cooldownRemaining > 0
                                    ? t('battle.skillCdShort', {
                                        turns: usability.cooldownRemaining,
                                      })
                                    : `${usability.spCost} SP`}
                                </span>
                              </div>
                              <div className="text-[12px] font-semibold leading-tight truncate">
                                {getSkillName(lang, skill.id)}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* PC Skill Hover Tooltip Bar */}
                  {inspectedSkill && inspectedScaled && inspectedUsability && (
                    <div className="rounded border border-slate-800 bg-[#070B12] px-2.5 py-1 flex items-center justify-between gap-2 text-[12px]">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="font-semibold text-slate-100 shrink-0">
                          {getSkillName(lang, inspectedSkill.id)} (Lv.{inspectedLv})
                        </span>
                        <span className="text-slate-400 truncate">
                          {getSkillDesc(lang, inspectedSkill.id)}
                        </span>
                      </div>
                      <span className="font-mono-nums text-sky-300 shrink-0">
                        {getSkillTargetLabel(lang, inspectedSkill.targetType)}
                      </span>
                    </div>
                  )}
                </>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (~35%): Turn Queue + Selected Unit Detail + Full Combat Log */}
          <aside
            data-testid="battle-right-sidebar"
            className="min-w-0 min-h-0 h-full flex flex-col gap-2 overflow-hidden"
          >
            <TurnQueueBar
              battle={battle}
              battleSpeed={battleSpeed}
              skipAnimations={skipAnimations}
              enrageBonusPct={enrageBonusPct}
              variant="sidebar"
              targetName={actingTargetName}
              hideActingRow={showActionStage}
              onSelectUnit={(id) => setInspectedUnitId(id)}
            />

            <ActionStage
              battle={battle}
              activeUnit={activeUnit}
              actingTargetName={actingTargetName}
              battleSpeed={battleSpeed}
              vfxConfig={vfxConfig}
              enabled={actionStageEnabled}
              viewMode={effectiveViewMode}
              variant="desktop"
            />

            {renderSidebarSelectedUnit()}

            <div
              data-testid="battle-desktop-docked-log"
              data-log-mode={sidebarLogMode}
              className={`${
                sidebarLogMode === 'expanded'
                  ? 'flex-1 min-h-[220px]'
                  : 'shrink-0'
              } rounded-lg border border-slate-800 bg-[#070A10] flex flex-col overflow-hidden`}
            >
              <div
                data-testid="combat-log-header-row-1"
                className="shrink-0 h-[36px] min-h-[36px] max-h-[36px] px-2 border-b border-slate-800/90 flex items-center justify-between gap-1.5 flex-nowrap text-[11px] text-slate-400"
              >
                <div className="flex items-center gap-1 min-w-0 shrink">
                  <span
                    data-testid="combat-log-header-title"
                    className="font-semibold text-slate-200 whitespace-nowrap text-[11px]"
                  >
                    {t('battle.combatLog')}
                  </span>
                  <span
                    data-testid="combat-log-header-count"
                    className="font-mono-nums text-[10px] text-slate-400 whitespace-nowrap"
                  >
                    {t('battle.eventsCount', { count: battle.log.length })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                  {renderLogModeSegmented()}
                  <button
                    type="button"
                    data-testid="combat-log-mode-toggle"
                    data-popup-open={logSheetOpen ? 'true' : 'false'}
                    onClick={handleOpenCombatLogPopup}
                    title={t('log.modePopup')}
                    aria-label={t('log.modePopup')}
                    className="min-h-[24px] h-[24px] px-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Maximize2 className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>{t('log.modePopup')}</span>
                  </button>
                </div>
              </div>
              {sidebarLogMode === 'expanded' ? (
                <CombatLogList
                  entries={battle.log}
                  units={battle.units}
                  active={!isPhonePortrait}
                  density="compact"
                  mode="docked"
                  channel={logChannel}
                  onChannelChange={setLogChannel}
                  order={logOrder}
                  onOrderChange={handleSetLogOrder}
                  expandAll={logExpandAll}
                  expandNonce={logExpandNonce}
                  onExpandAll={handleExpandAllLogs}
                  onCollapseAll={handleCollapseAllLogs}
                />
              ) : (
                <div
                  data-testid="battle-desktop-log-line"
                  className="px-2.5 py-1.5 text-[12px] text-slate-200 truncate"
                >
                  {latestLog
                    ? parseStructuredCombatLogRow(lang, latestLog, battle.units)
                        .sentence
                    : t('log.emptyChannel')}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ==================== SHARED MORE ACTIONS ("...") MENU ==================== */}
      <BattleMoreActionsMenu
        menu={{
          open: moreActionsOpen,
          sectorLabel,
          squadSize: battle.squadSize,
          hasSummary: Boolean(battle.summary),
          battleSpeed,
          speechBubblesEnabled,
          skipAnimations,
          retreatConfirmOpen,
          t,
          onClose: closeMoreActions,
          onSetBattleSpeed: setBattleSpeed,
          onOpenTactics: () => setTacticsModalOpen(true),
          onToggleSpeechBubbles: toggleSpeechBubbles,
          onToggleSkipAnimations: toggleSkipAnimations,
          onOpenStats: () => setStatsModalOpen(true),
          onSetRetreatConfirmOpen: setRetreatConfirmOpen,
          onRetreatBattle: retreatBattle,
          onToggleAdminPanel: toggleAdminPanel,
        }}
      />

      {/* ==================== PHONE SKILLS BOTTOM SHEET ==================== */}
      <PhoneSkillsSheet
        open={skillsSheetOpen}
        playerUnit={playerUnit}
        playerSkillIds={playerSkillIds}
        canPlayerManualAct={canPlayerManualAct}
        lang={lang}
        t={t}
        onClose={() => setSkillsSheetOpen(false)}
        onUseSkill={(skillId) => performPlayerAction('skill', skillId)}
      />

      {/* ==================== AUTO-REPEAT PER-BATTLE TOAST ==================== */}
      {autoRepeatToast && !showRepeatBatchSummary && (
        <AutoRepeatToast
          toast={autoRepeatToast}
          lang={lang}
          t={t}
          onClearToast={clearAutoRepeatToast}
        />
      )}

      {/* ==================== AUTO-REPEAT BATCH SUMMARY MODAL ==================== */}
      <ErrorBoundary
        variant="panel"
        title={t('auto.repeatSummaryTitle')}
        resetKey={showRepeatBatchSummary}
        onClose={clearAutoRepeatSummary}
        onReloadBattle={() => reloadBattle(battle.sectorId)}
      >
        {showRepeatBatchSummary && autoRepeatSession && (
          <AutoRepeatBatchSummaryModal
            session={autoRepeatSession}
            deployedGearId={battle.deployedGearId}
            autoRepeatDefeatStreakLimit={autoRepeatDefeatStreakLimit}
            autoRepeatLimit={autoRepeatLimit}
            sectorId={battle.sectorId}
            lang={lang}
            t={t}
            onOpenReport={() => setStatsModalOpen(true)}
            onReturnHangar={returnToHangar}
            onClearSummary={clearAutoRepeatSummary}
            onStartAutoRepeat={startAutoRepeat}
          />
        )}
      </ErrorBoundary>

      {/* ==================== VICTORY / DEFEAT / RETREAT RESULTS MODAL ==================== */}
      <ErrorBoundary
        variant="panel"
        title={t('summary.victory')}
        resetKey={Boolean(battle.summary)}
        onClose={returnToHangar}
        onReloadBattle={() => reloadBattle(battle.sectorId)}
      >
        {battle.summary &&
          !autoRepeatSession?.active &&
          !showRepeatBatchSummary && (
            <BattleResultDialog
              summary={battle.summary}
              squadSize={battle.squadSize}
              lang={lang}
              t={t}
              onOpenReport={() => setStatsModalOpen(true)}
              onOpenLog={handleOpenCombatLogPopup}
              onReturnHangar={returnToHangar}
              onNextSortie={() => startBattle()}
            />
          )}
      </ErrorBoundary>

      {/* ==================== PHONE UNIT DETAIL SHEET (full name & stats) ==================== */}
      <ErrorBoundary
        variant="panel"
        title={phoneSheetUnit?.name ?? 'Unit Telemetry'}
        resetKey={phoneUnitSheetId ?? 'none'}
        onClose={() => setPhoneUnitSheetId(null)}
        onReloadBattle={() => reloadBattle(battle.sectorId)}
      >
        <PhoneUnitDetailSheet
          unit={phoneSheetUnit}
          selectedTargetId={battle.selectedTargetId}
          selectedAllyTargetId={battle.selectedAllyTargetId}
          hasSingleAllySkill={hasSingleAllySkill}
          canPlayerManualAct={canPlayerManualAct}
          validBasicTargetIds={validBasicTargetIds}
          onClose={() => setPhoneUnitSheetId(null)}
          onLockEnemy={selectTarget}
          onLockAlly={selectAllyTarget}
        />
      </ErrorBoundary>

      {/* ==================== COMBAT LOG POPUP SHEET (NON-PAUSING) ==================== */}
      <ErrorBoundary
        variant="panel"
        title={t('battle.combatLog')}
        resetKey={logSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        onReloadBattle={() => reloadBattle(battle.sectorId)}
      >
        {logSheetOpen && (
          <CombatLogPopupSheet
            open={logSheetOpen}
            entries={battle.log}
            units={battle.units}
            channel={logChannel}
            order={logOrder}
            expandAll={logExpandAll}
            expandNonce={logExpandNonce}
            expandButtons={renderCombatLogExpandButtons(false)}
            t={t}
            onClose={() => setLogSheetOpen(false)}
            onChannelChange={setLogChannel}
            onOrderChange={handleSetLogOrder}
          />
        )}
      </ErrorBoundary>

      {/* ==================== FIELD SUPPLIES & TACTICS BOTTOM SHEET ==================== */}
      <FieldSuppliesSheet
        open={suppliesSheetOpen}
        t={t}
        onClose={() => setSuppliesSheetOpen(false)}
        onOpenTactics={() => setTacticsModalOpen(true)}
        onReloadBattle={() => reloadBattle(battle.sectorId)}
        rows={battleSupplyView.rows}
        usedThisTurn={battleSupplyView.usedThisTurn}
        usesPerTurn={battleSupplyView.usesPerTurn}
        hasLoadout={battleSupplyView.hasLoadout}
        iconCatalogMods={adminConfig.iconCatalogMods}
        onUseSupply={useBattleSupply}
      />

      {/* ==================== LIVE PROGRESS / END-OF-BATTLE REPORT MODAL ==================== */}
      <ErrorBoundary
        variant="panel"
        title={battle.summary ? t('stats.reportTitle') : t('stats.progressTitle')}
        resetKey={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        onReloadBattle={() => reloadBattle(battle.sectorId)}
      >
        <BattleStatsModal
          open={statsModalOpen}
          onClose={() => setStatsModalOpen(false)}
          battle={battle}
          enrageBonusPct={enrageBonusPct}
          onOpenLog={handleOpenCombatLogPopup}
        />
      </ErrorBoundary>
    </div>
  );
}
