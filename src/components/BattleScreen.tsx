import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Backpack,
  BarChart3,
  Bot,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Flag,
  HeartHandshake,
  Info,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Package,
  Radar,
  Repeat,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Square,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { BALANCE_CONFIG } from '../data/balance';
import { RARITY_META } from '../data/items';
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
import {
  getAutoStopReasonLabel,
  getBattleSkillReason,
  getClassName,
  getItemInstanceName,
  getSectorName,
  getSkillDesc,
  getSkillName,
  getSkillTargetLabel,
  getSlotLabel,
  getTeamTagLabel,
  useI18n,
} from '../i18n';
import { ENABLE_ADMIN_CP, useGameStore } from '../store/useGameStore';
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
  writeSpeechBubblesEnabled,
  type RowExposureState,
} from '../utils/battleDisplay';
import {
  computeFxCleanupDelayMs,
  POPUP_CLEANUP_DELAY_MS,
  useFxSettings,
} from '../utils/battleVfx';
import {
  parseStructuredCombatLogRow,
  readCombatLogExpandAll,
  readSidebarLogMode,
  writeCombatLogExpandAll,
  writeSidebarLogMode,
  type CombatLogChannel,
  type SidebarCombatLogMode,
} from '../utils/combatLogFormat';
import { useStatusDisplaySettings } from '../utils/statusDisplayPrefs';
import { BattleRadarView } from './BattleRadarView';
import { BattleResultDialog } from './BattleResultDialog';
import { BattleStatsModal } from './BattleStatsModal';
import { BattleUnitCard } from './BattleUnitCard';
import { BottomSheet } from './BottomSheet';
import { CombatLogList } from './CombatLogList';
import { EffectsSettingsPanel } from './EffectsSettingsPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { FixedStatusArea } from './FixedStatusArea';
import {
  RadarStatusBoard,
  readStatusBoardCollapsed,
  writeStatusBoardCollapsed,
} from './RadarStatusBoard';
import { SkillIcon } from './SkillIcon';
import { StatBar } from './StatBar';
import { TurnQueueBar } from './TurnQueueBar';
import { UnitDetailSheet } from './UnitDetailSheet';

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
  const [sidebarLogMode, setSidebarLogMode] = useState<SidebarCombatLogMode>(
    () => readSidebarLogMode()
  );
  const [logChannel, setLogChannel] = useState<CombatLogChannel>('all');
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
      startBattle(autoRepeatSession.sectorId);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    battle?.summary,
    autoRepeatSession?.active,
    autoRepeatSession?.completedRuns,
    autoRepeatSession?.sectorId,
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

  const getExposureLabel = (state: RowExposureState) =>
    state === 'exposed'
      ? t('battle.rowExposed')
      : state === 'protected'
      ? t('battle.rowProtected')
      : t('battle.rowEmpty');

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

  const renderCardUnit = (unit: CombatUnit, compact: boolean) => {
    const isEnemy = unit.side === 'enemy';
    const frontBlocked =
      isEnemy && unit.alive && !validBasicTargetIds.has(unit.id);

    return (
      <BattleUnitCard
        key={unit.id}
        unit={unit}
        compact={compact}
        frontBlocked={frontBlocked}
        wingmanChatText={null}
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

  const renderThreeRowCardSide = (
    side: 'ally' | 'enemy',
    units: CombatUnit[],
    compact: boolean
  ) => {
    const exposureMap =
      side === 'enemy' ? enemyExposure : allyExposure;
    const orderedRows: CombatRow[] = ROWS_ORDER;

    return (
      <div className="space-y-1.5 min-w-0" data-testid={`card-side-${side}`}>
        <div className="flex items-center justify-between text-[13px] px-1">
          <span
            className="font-display text-[14px] font-bold tracking-wider uppercase truncate"
            style={{
              color:
                side === 'enemy' ? 'var(--team-enemy)' : 'var(--team-ally)',
            }}
          >
            {side === 'enemy'
              ? t('battle.tabEnemies')
              : t('battle.tabAllies')}
          </span>
          <span className="font-mono-nums text-[12px] text-slate-400 shrink-0">
            {side === 'enemy'
              ? `${aliveEnemiesCount}/${enemies.length}`
              : `${aliveAlliesCount}/${allies.length}`}
          </span>
        </div>

        {orderedRows.map((row) => {
          const rowUnits = units
            .filter((u) => u.row === row)
            .sort((a, b) => (a.formationCol ?? 0) - (b.formationCol ?? 0));
          const exposure = exposureMap?.[row] ?? 'empty';
          const isExposed = exposure === 'exposed';
          const isProtected = exposure === 'protected';

          return (
            <div
              key={`${side}-${row}`}
              data-card-row={`${side}-${row}`}
              data-row-state={exposure}
              className={`min-w-0 overflow-hidden rounded-lg border p-1.5 space-y-1 ${
                isExposed
                  ? side === 'enemy'
                    ? 'border-red-500/45 bg-red-950/15'
                    : 'border-sky-500/45 bg-sky-950/15'
                  : isProtected
                  ? 'border-dashed border-slate-700/90 bg-slate-950/55'
                  : 'border-dashed border-slate-800/70 bg-slate-950/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-1 text-[12px] font-mono-nums font-bold min-w-0">
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
                <span
                  className={`px-1.5 py-0.2 rounded text-[12px] shrink-0 ${
                    isExposed
                      ? side === 'enemy'
                        ? 'bg-red-500/20 text-red-200'
                        : 'bg-sky-500/20 text-sky-200'
                      : isProtected
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'text-slate-500'
                  }`}
                >
                  {getExposureLabel(exposure)}
                </span>
              </div>

              {rowUnits.length > 0 && (
                <div className="space-y-1 min-w-0">
                  {rowUnits.map((u) => renderCardUnit(u, compact))}
                </div>
              )}
            </div>
          );
        })}
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
            {renderThreeRowCardSide('ally', allies, true)}
            {renderThreeRowCardSide('enemy', enemies, true)}
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
          <div className="min-w-0 w-full grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 items-start">
            {renderThreeRowCardSide('ally', allies, false)}
            {renderThreeRowCardSide('enemy', enemies, false)}
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
    const exposure =
      (isEnemy ? enemyExposure : allyExposure)?.[sidebarUnit.row] ?? 'empty';
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
              title={`${getRowTitle(sidebarUnit.row)} · ${getExposureLabel(
                exposure
              )}`}
            >
              {getRowTitle(sidebarUnit.row)} · {getExposureLabel(exposure)}
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
            className="sticky top-0 z-30 h-12 max-h-[48px] shrink-0 border-b border-slate-800/80 bg-[#080D16]/95 backdrop-blur-sm px-1.5 flex items-center justify-between gap-1 flex-nowrap overflow-x-hidden"
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
              <div className="shrink-0 px-2 py-1 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-400">
                <div className="inline-flex items-center gap-1.5 shrink-0">
                  <ScrollText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="font-semibold text-slate-200 whitespace-nowrap">
                    {t('battle.combatLog')}
                  </span>
                  <span className="font-mono-nums text-slate-400 whitespace-nowrap">
                    ({battle.log.length})
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap shrink-0">
                  {renderLogModeSegmented()}
                  {sidebarLogMode === 'expanded' &&
                    renderCombatLogExpandButtons(true)}
                  <button
                    type="button"
                    data-testid="combat-log-mode-toggle"
                    data-popup-open={logSheetOpen ? 'true' : 'false'}
                    onClick={handleOpenCombatLogPopup}
                    title={t('log.modePopup')}
                    aria-label={t('log.modePopup')}
                    className="min-h-[24px] px-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
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
                  expandAll={logExpandAll}
                  expandNonce={logExpandNonce}
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
              onSelectUnit={(id) => setInspectedUnitId(id)}
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
              <div className="shrink-0 px-2.5 py-1.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-1.5 text-[12px] text-slate-400">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    data-testid="combat-log-header-title"
                    className="font-semibold text-slate-200 whitespace-nowrap"
                  >
                    {t('battle.combatLog')}
                  </span>
                  <span
                    data-testid="combat-log-header-count"
                    className="font-mono-nums text-[11px] text-slate-400 whitespace-nowrap"
                  >
                    {t('battle.eventsCount', { count: battle.log.length })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {renderLogModeSegmented()}
                  {sidebarLogMode === 'expanded' &&
                    renderCombatLogExpandButtons(true)}
                  <button
                    type="button"
                    data-testid="combat-log-mode-toggle"
                    data-popup-open={logSheetOpen ? 'true' : 'false'}
                    onClick={handleOpenCombatLogPopup}
                    title={t('log.modePopup')}
                    aria-label={t('log.modePopup')}
                    className="min-h-[24px] px-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
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
                  expandAll={logExpandAll}
                  expandNonce={logExpandNonce}
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
      <BottomSheet
        open={moreActionsOpen}
        onClose={closeMoreActions}
        title={t('battle.moreActions')}
        subtitle={`${sectorLabel} · ${battle.squadSize}v${battle.squadSize}`}
      >
        <div data-testid="battle-more-menu" className="space-y-4">
          {/* Full Speed Picker (1x - 30x) */}
          <div className="space-y-2">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              {t('battle.speedLabel')}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {ALLOWED_BATTLE_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setBattleSpeed(spd)}
                  className={`min-h-[44px] rounded-lg border font-mono-nums text-[13px] font-bold cursor-pointer ${
                    battleSpeed === spd
                      ? 'border-sky-400 bg-sky-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900 text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Visual Effects (Full/Compact/Off, Reduced Motion, Status Labels, Debug & Test Preview) */}
          <EffectsSettingsPanel compact />

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              data-testid="battle-more-tactics"
              onClick={() => {
                closeMoreActions();
                setTacticsModalOpen(true);
              }}
              className="min-h-[44px] px-3.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-[13px] font-semibold flex items-center gap-2.5 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>{t('auto.tacticsBtn')}</span>
            </button>

            <button
              type="button"
              data-testid="battle-toggle-bubbles"
              onClick={toggleSpeechBubbles}
              aria-pressed={speechBubblesEnabled}
              className={`min-h-[44px] px-3.5 rounded-lg border text-[13px] font-semibold flex items-center justify-between cursor-pointer ${
                speechBubblesEnabled
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>{t('battle.speechBubbles')}</span>
              </span>
              <span className="font-mono-nums text-[12px]">
                {speechBubblesEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              data-testid="battle-toggle-skip-anim"
              onClick={toggleSkipAnimations}
              aria-pressed={skipAnimations}
              className={`min-h-[44px] px-3.5 rounded-lg border text-[13px] font-semibold flex items-center justify-between cursor-pointer ${
                skipAnimations
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                  : 'border-slate-700 bg-slate-900 text-slate-200'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <ZapOff className="w-4 h-4 text-sky-400" />
                <span>{t('battle.skipAnim')}</span>
              </span>
              <span className="font-mono-nums text-[12px]">
                {skipAnimations ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              data-testid="battle-more-stats"
              onClick={() => {
                closeMoreActions();
                setStatsModalOpen(true);
              }}
              className="min-h-[44px] px-3.5 rounded-lg border border-sky-500/45 bg-sky-500/12 text-sky-200 text-[13px] font-semibold flex items-center gap-2.5 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>
                {battle.summary ? t('stats.reportBtn') : t('stats.progressBtn')}
              </span>
            </button>

            {!battle.summary &&
              (retreatConfirmOpen ? (
                <div
                  data-testid="battle-retreat-confirm-box"
                  className="rounded-lg border border-red-500/60 bg-red-950/35 p-3 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-red-100">
                    <Flag className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{t('battle.retreatConfirmTitle')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="battle-retreat-cancel"
                      onClick={() => setRetreatConfirmOpen(false)}
                      className="min-h-[40px] px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[13px] font-semibold cursor-pointer"
                    >
                      {t('battle.retreatCancelBtn')}
                    </button>
                    <button
                      type="button"
                      data-testid="battle-retreat-confirm"
                      onClick={() => {
                        closeMoreActions();
                        retreatBattle();
                      }}
                      className="min-h-[40px] px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold cursor-pointer"
                    >
                      {t('battle.retreatConfirmBtn')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="battle-more-retreat"
                  onClick={() => setRetreatConfirmOpen(true)}
                  className="min-h-[44px] px-3.5 rounded-lg border border-red-500/45 bg-red-500/12 text-red-200 text-[13px] font-semibold flex items-center gap-2.5 cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-red-400" />
                  <span>{t('battle.retreat')}</span>
                </button>
              ))}

            {ENABLE_ADMIN_CP && (
              <div className="pt-2 border-t border-slate-800/70">
                <button
                  type="button"
                  data-testid="battle-more-admin-btn"
                  onClick={() => {
                    closeMoreActions();
                    toggleAdminPanel();
                  }}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-[12px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t('statusUi.adminBtnMuted')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* ==================== PHONE SKILLS BOTTOM SHEET ==================== */}
      <BottomSheet
        open={skillsSheetOpen}
        onClose={() => setSkillsSheetOpen(false)}
        title={t('battle.skillsSheetTitle')}
        subtitle={
          playerUnit
            ? `SP ${playerUnit.sp}/${playerUnit.derived.maxSp}`
            : undefined
        }
      >
        {playerSkillIds.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-center text-[13px] text-slate-400">
            {t('battle.noSkillsSlotted')}
          </div>
        ) : (
          <div className="space-y-2">
            {playerSkillIds.slice(0, 6).map((skillId) => {
              const skill = getSkillById(skillId);
              if (!skill || !playerUnit) return null;
              const usability = canUnitUseSkill(playerUnit, skill.id);
              const clickable = canPlayerManualAct && usability.canUse;
              const isToggleOn = Boolean(usability.isToggleActive);
              const isUsedOnce =
                skill.oncePerBattle &&
                playerUnit.usedOnceSkills.includes(skill.id);
              const reasonText = getBattleSkillReason(lang, usability);

              return (
                <button
                  key={skill.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (clickable) {
                      performPlayerAction('skill', skill.id);
                      setSkillsSheetOpen(false);
                    }
                  }}
                  className={`w-full min-h-[56px] p-3 rounded-lg border text-left flex items-start justify-between gap-3 transition-colors ${
                    isToggleOn
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                      : !clickable
                      ? 'border-slate-800 bg-slate-900/70 text-slate-500 opacity-65'
                      : skill.category === 'elite'
                      ? 'border-amber-400/80 bg-amber-500/15 text-amber-100 cursor-pointer'
                      : skill.category === 'special'
                      ? 'border-purple-400/80 bg-purple-500/15 text-purple-100 cursor-pointer'
                      : 'border-sky-500/50 bg-sky-500/15 text-sky-100 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded bg-slate-950/80 border border-slate-700 flex items-center justify-center shrink-0">
                      <SkillIcon icon={skill.icon} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold leading-tight truncate">
                        {getSkillName(lang, skill.id)}
                      </div>
                      <div className="text-[12px] text-slate-300 mt-0.5 leading-snug">
                        {getSkillDesc(lang, skill.id)}
                      </div>
                      {!usability.canUse && reasonText && (
                        <div className="text-[12px] text-red-400 font-semibold mt-0.5">
                          {reasonText}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`text-right font-mono-nums text-[12px] font-bold shrink-0 ${
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
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {/* ==================== AUTO-REPEAT PER-BATTLE TOAST ==================== */}
      {autoRepeatToast && !showRepeatBatchSummary && (
        <div
          role="status"
          aria-live="polite"
          data-testid="battle-loop-toast"
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[min(94vw,480px)] rounded-lg border px-3 py-2 shadow-2xl flex items-center justify-between gap-2 text-[12px] font-medium backdrop-blur-sm ${
            autoRepeatToast.outcome === 'victory'
              ? 'border-emerald-400/70 bg-[#0B1814]/95 text-emerald-100'
              : 'border-amber-400/70 bg-[#1B130B]/95 text-amber-100'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Repeat
              className={`w-4 h-4 shrink-0 ${
                autoRepeatToast.outcome === 'victory'
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
              aria-hidden="true"
            />
            <span className="truncate">
              {t('battle.loopToastRun', {
                run: autoRepeatToast.runNumber,
                outcome: t(
                  autoRepeatToast.outcome === 'victory'
                    ? 'battle.loopToastVictory'
                    : 'battle.loopToastDefeat'
                ),
                exp: autoRepeatToast.expGained.toLocaleString(),
                credits: autoRepeatToast.creditsGained.toLocaleString(),
                wp: autoRepeatToast.warPointsGained.toLocaleString(),
                loot: autoRepeatToast.lootCount,
              })}
            </span>
          </div>
          <button
            type="button"
            data-testid="battle-loop-toast-close"
            onClick={clearAutoRepeatToast}
            aria-label={t('common.close')}
            className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded hover:bg-white/10 text-slate-300 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================== AUTO-REPEAT BATCH SUMMARY MODAL ==================== */}
      <ErrorBoundary
        variant="panel"
        title={t('auto.repeatSummaryTitle')}
        resetKey={showRepeatBatchSummary}
        onClose={clearAutoRepeatSummary}
        onReloadBattle={() => startBattle(battle.sectorId)}
      >
        {showRepeatBatchSummary && autoRepeatSession && (
          <div
            className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="repeat-summary-title"
          >
            <div className="w-full max-w-md rounded-lg border border-emerald-500/50 bg-[#0E1521] p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto tactical-scroll">
              <div className="space-y-1">
                <div className="text-[12px] font-semibold tracking-widest uppercase text-emerald-400 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" />
                  <span>{getSectorName(lang, autoRepeatSession.sectorId)}</span>
                </div>
                <h2
                  id="repeat-summary-title"
                  className="font-display text-[20px] font-bold tracking-wide text-slate-50"
                >
                  {t('auto.repeatSummaryTitle')}
                </h2>
                {autoRepeatSession.stopReason && (
                  <p
                    data-testid="battle-loop-stop-reason"
                    className="text-[13px] text-orange-300 font-medium"
                  >
                    {getAutoStopReasonLabel(
                      lang,
                      autoRepeatSession.stopReason,
                      autoRepeatSession.defeatStreakLimit ??
                        autoRepeatDefeatStreakLimit
                    )}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-slate-800 bg-[#090D14] p-3">
                  <div className="text-[12px] text-slate-400">
                    {t('auto.repeatLabel')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[20px] font-bold text-emerald-400">
                    {t('auto.repeatSummaryRuns', {
                      wins: autoRepeatSession.wins,
                      runs: autoRepeatSession.completedRuns,
                    })}
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-[#090D14] p-3">
                  <div className="text-[12px] text-slate-400">
                    {t('summary.expEarned', {
                      gear: getClassName(lang, battle.deployedGearId),
                    })}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[20px] font-bold text-amber-400">
                    +{autoRepeatSession.totalExp.toLocaleString()} EXP
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-[#090D14] p-3">
                  <div className="text-[12px] text-slate-400">
                    {t('summary.creditsAwarded')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[15px] font-bold text-slate-100">
                    +{autoRepeatSession.totalCredits.toLocaleString()} CR
                  </div>
                </div>

                <div className="rounded border border-purple-500/40 bg-purple-500/10 p-3">
                  <div className="text-[12px] text-purple-200">
                    {t('summary.warPointsAwarded')}
                  </div>
                  <div className="mt-0.5 font-mono-nums text-[15px] font-bold text-purple-300">
                    +{autoRepeatSession.totalWarPoints.toLocaleString()} WP
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('summary.dropsTitle')}</span>
                  </span>
                  <span className="font-mono-nums">
                    {t('common.itemCount', {
                      count: autoRepeatSession.totalDrops.length,
                    })}
                  </span>
                </div>
                {autoRepeatSession.totalDrops.length === 0 ? (
                  <div className="rounded border border-slate-800/80 bg-[#090D14] px-3 py-2 text-[13px] text-slate-500">
                    {t('summary.noDrops')}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto tactical-scroll">
                    {autoRepeatSession.totalDrops.map((inst) => (
                      <div
                        key={inst.instanceId}
                        className={`rounded border bg-[#090D14] px-3 py-1.5 flex items-center justify-between gap-2 ${
                          RARITY_META[inst.rarity].borderClass
                        }`}
                      >
                        <span
                          className={`text-[13px] font-semibold truncate ${
                            RARITY_META[inst.rarity].textClass
                          }`}
                        >
                          {getItemInstanceName(lang, inst)}
                        </span>
                        <span className="text-[12px] font-mono-nums text-slate-400 shrink-0">
                          {getSlotLabel(lang, inst.slot)} · T{inst.tier}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStatsModalOpen(true)}
                  className="w-full min-h-[44px] px-4 rounded-lg border border-sky-500/50 bg-sky-500/12 hover:bg-sky-500/22 text-sky-200 font-semibold text-[13px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>{t('stats.reportBtn')}</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={returnToHangar}
                    className="flex-1 min-h-[44px] px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[13px] transition-colors cursor-pointer"
                  >
                    {t('nav.returnHangar')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearAutoRepeatSummary();
                      startAutoRepeat(autoRepeatLimit, battle.sectorId);
                    }}
                    className="flex-1 min-h-[44px] px-4 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-[13px] transition-colors cursor-pointer"
                  >
                    {t('auto.repeatStart')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </ErrorBoundary>

      {/* ==================== VICTORY / DEFEAT / RETREAT RESULTS MODAL ==================== */}
      <ErrorBoundary
        variant="panel"
        title={t('summary.victory')}
        resetKey={Boolean(battle.summary)}
        onClose={returnToHangar}
        onReloadBattle={() => startBattle(battle.sectorId)}
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
        onReloadBattle={() => startBattle(battle.sectorId)}
      >
        <UnitDetailSheet
          unit={phoneSheetUnit}
          onClose={() => setPhoneUnitSheetId(null)}
          isTargeted={Boolean(
            phoneSheetUnit &&
              ((phoneSheetUnit.side === 'enemy' &&
                battle.selectedTargetId === phoneSheetUnit.id) ||
                (phoneSheetUnit.side === 'ally' &&
                  hasSingleAllySkill &&
                  battle.selectedAllyTargetId === phoneSheetUnit.id))
          )}
          canLockEnemy={canPlayerManualAct}
          canLockAlly={canPlayerManualAct && hasSingleAllySkill}
          frontRowBlocked={Boolean(
            phoneSheetUnit &&
              phoneSheetUnit.side === 'enemy' &&
              !validBasicTargetIds.has(phoneSheetUnit.id)
          )}
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
        onReloadBattle={() => startBattle(battle.sectorId)}
      >
        {logSheetOpen && (
          <div
            data-testid="combat-log-popup"
            className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/70 p-0 md:p-4"
            role="dialog"
            aria-modal="false"
            aria-label={t('battle.combatLog')}
            onClick={(e) => {
              if (e.target === e.currentTarget) setLogSheetOpen(false);
            }}
          >
            <div className="w-full md:max-w-2xl h-[82dvh] max-h-[88dvh] flex flex-col rounded-t-2xl md:rounded-xl border-t md:border border-slate-700/90 bg-[#0B111C] text-slate-100 shadow-2xl overflow-hidden pb-safe">
              <div className="md:hidden pt-2.5 pb-1 flex justify-center shrink-0">
                <span className="w-10 h-1 rounded-full bg-slate-700" />
              </div>

              <div className="px-4 py-2.5 border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-slate-100 truncate">
                      {t('battle.combatLog')}
                    </div>
                    <div className="text-[11px] font-mono-nums text-slate-400">
                      {t('battle.eventsCount', { count: battle.log.length })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {renderCombatLogExpandButtons(false)}
                  <button
                    type="button"
                    data-testid="combat-log-popup-dock-btn"
                    onClick={() => setLogSheetOpen(false)}
                    className="min-h-[36px] px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('log.modeDocked')}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="combat-log-popup-close"
                    onClick={() => setLogSheetOpen(false)}
                    aria-label={t('common.close')}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <CombatLogList
                  entries={battle.log}
                  units={battle.units}
                  active={logSheetOpen}
                  density="comfortable"
                  mode="popup"
                  channel={logChannel}
                  onChannelChange={setLogChannel}
                  expandAll={logExpandAll}
                  expandNonce={logExpandNonce}
                />
              </div>
            </div>
          </div>
        )}
      </ErrorBoundary>

      {/* ==================== FIELD SUPPLIES & TACTICS BOTTOM SHEET ==================== */}
      <ErrorBoundary
        variant="panel"
        title={t('battle.suppliesTitle')}
        resetKey={suppliesSheetOpen}
        onClose={() => setSuppliesSheetOpen(false)}
        onReloadBattle={() => startBattle(battle.sectorId)}
      >
        <BottomSheet
          open={suppliesSheetOpen}
          onClose={() => setSuppliesSheetOpen(false)}
          title={t('battle.suppliesTitle')}
          footer={
            <button
              type="button"
              onClick={() => {
                setSuppliesSheetOpen(false);
                setTacticsModalOpen(true);
              }}
              className="w-full min-h-[44px] px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[13px] inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>{t('battle.openTactics')}</span>
            </button>
          }
        >
          <div className="rounded-lg border border-slate-800 bg-[#080D16] p-4 text-[13px] text-slate-300 leading-relaxed flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{t('battle.noConsumables')}</span>
          </div>
        </BottomSheet>
      </ErrorBoundary>

      {/* ==================== LIVE PROGRESS / END-OF-BATTLE REPORT MODAL ==================== */}
      <ErrorBoundary
        variant="panel"
        title={battle.summary ? t('stats.reportTitle') : t('stats.progressTitle')}
        resetKey={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        onReloadBattle={() => startBattle(battle.sectorId)}
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
