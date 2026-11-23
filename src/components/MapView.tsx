import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  FastForward,
  Info,
  Lock,
  Maximize2,
  Rocket,
  ScrollText,
  Shield,
  ShoppingBag,
  Skull,
  UserPlus,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MECH_CLASS_LIST } from '../data/classes';
import { DROP_CONFIG } from '../data/items';
import {
  getSectorById,
  getTokenShapeForBaseType,
  MAP_LANES,
  SECTORS_CATALOG,
} from '../data/maps';
import { calculateSingleEnemyReward } from '../engine/combat';
import {
  getBattleOptions,
  isVisible,
  pickDefaultBattle,
} from '../engine/frontline';
import {
  ENGINEER_OVERCHARGE_COST,
  getBaseMonthlyIncome,
  getBaseState,
  getHireWingmanCost,
  getTotalMonthlyIncome,
  isBaseServicesAvailable,
} from '../engine/mapWorld';
import {
  getClassName,
  getDifficultyLabel,
  getSectorDesc,
  getSectorName,
  getSectorRegion,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  BaseFaction,
  BaseNpcRole,
  BaseType,
  MechClassId,
  SectorDifficulty,
} from '../types/game';
import { useBattleLayoutMode } from '../utils/battleDisplay';
import { soundFx } from '../utils/sound';
import { BottomSheet } from './BottomSheet';
import { FighterSvg } from './FighterSvg';

export const MAP_VIEWBOX_WIDTH = 840;
export const MAP_VIEWBOX_HEIGHT = 310;
export const MAP_SVG_LABEL_FONT_SIZE = 11.5;
export const MAP_MIN_PHONE_LABEL_PX = 11;
export const MAP_MIN_ZOOM = 0.75;
export const MAP_MAX_ZOOM = 3.2;

export function clampMapZoom(z: number): number {
  return Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, z));
}

export function clampMapPan(
  x: number,
  y: number,
  zoom: number,
  boxWidth: number,
  boxHeight: number
): { x: number; y: number } {
  const safeW = Math.max(120, boxWidth);
  const safeH = Math.max(120, boxHeight);
  const baseScale = Math.min(
    safeW / MAP_VIEWBOX_WIDTH,
    safeH / MAP_VIEWBOX_HEIGHT
  );
  const scaledW = MAP_VIEWBOX_WIDTH * baseScale * zoom;
  const scaledH = MAP_VIEWBOX_HEIGHT * baseScale * zoom;
  const maxPanX = Math.abs(scaledW - safeW) / 2;
  const maxPanY = Math.abs(scaledH - safeH) / 2;
  return {
    x: Number(Math.max(-maxPanX, Math.min(maxPanX, x)).toFixed(2)),
    y: Number(Math.max(-maxPanY, Math.min(maxPanY, y)).toFixed(2)),
  };
}

export function computeInitialPhoneMapView(
  targetPos: { x: number; y: number },
  boxWidth: number,
  boxHeight: number
): { zoom: number; pan: { x: number; y: number } } {
  const safeW = Math.max(120, boxWidth);
  const safeH = Math.max(120, boxHeight);
  const baseScale = Math.min(
    safeW / MAP_VIEWBOX_WIDTH,
    safeH / MAP_VIEWBOX_HEIGHT
  );
  const neededZoom =
    MAP_MIN_PHONE_LABEL_PX / (MAP_SVG_LABEL_FONT_SIZE * baseScale);
  const zoom = clampMapZoom(
    Math.max(1, Math.ceil(neededZoom * 100) / 100)
  );
  const rawPanX = -(targetPos.x - MAP_VIEWBOX_WIDTH / 2) * baseScale * zoom;
  const rawPanY = -(targetPos.y - MAP_VIEWBOX_HEIGHT / 2) * baseScale * zoom;
  return {
    zoom,
    pan: clampMapPan(rawPanX, rawPanY, zoom, safeW, safeH),
  };
}

function getFallbackMapBoxSize(phone: boolean): {
  width: number;
  height: number;
} {
  if (typeof window === 'undefined') {
    return phone ? { width: 364, height: 420 } : { width: 760, height: 320 };
  }
  if (!phone) {
    return {
      width: Math.max(320, window.innerWidth - 220),
      height: 320,
    };
  }
  return {
    width: Math.max(296, window.innerWidth - 26),
    height: Math.max(360, Math.min(560, Math.round(window.innerHeight * 0.62))),
  };
}

const DIFFICULTY_TEXT_CLASS: Record<SectorDifficulty, string> = {
  Standard: 'text-emerald-400',
  Hard: 'text-amber-400',
  Elite: 'text-red-400',
};

const FACTION_RING_HEX: Record<BaseFaction, string> = {
  allied: '#10B981',
  hostile: '#EF4444',
  neutral: '#F59E0B',
};

const FACTION_BADGE_CLASS: Record<BaseFaction, string> = {
  allied: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
  hostile: 'border-red-500/50 bg-red-500/15 text-red-300',
  neutral: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
};

function BaseTypeGlyph({
  type,
  x,
  y,
  color,
}: {
  type: BaseType;
  x: number;
  y: number;
  color: string;
}) {
  switch (type) {
    case 'outpost':
      // Radar diamond + cross
      return (
        <g stroke={color} strokeWidth="1.6" fill="none">
          <polygon points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`} />
          <circle cx={x} cy={y} r="2" fill={color} />
        </g>
      );
    case 'colony':
      // Orbital habitat dome
      return (
        <g stroke={color} strokeWidth="1.6" fill="none">
          <path d={`M ${x - 7} ${y + 3} A 7 7 0 0 1 ${x + 7} ${y + 3} Z`} />
          <line x1={x - 9} y1={y + 6} x2={x + 9} y2={y + 6} />
        </g>
      );
    case 'relay':
      // Comm antenna + waves
      return (
        <g stroke={color} strokeWidth="1.6" fill="none">
          <line x1={x} y1={y - 6} x2={x} y2={y + 7} />
          <circle cx={x} cy={y - 6} r="2.2" fill={color} />
          <path d={`M ${x - 6} ${y - 3} Q ${x - 9} ${y} ${x - 6} ${y + 3}`} />
          <path d={`M ${x + 6} ${y - 3} Q ${x + 9} ${y} ${x + 6} ${y + 3}`} />
        </g>
      );
    case 'fortress':
      // Armored shield bastion
      return (
        <path
          d={`M ${x} ${y - 8} L ${x + 7} ${y - 4} L ${x + 6} ${y + 3} L ${x} ${y + 8} L ${x - 6} ${y + 3} L ${x - 7} ${y - 4} Z`}
          fill="none"
          stroke={color}
          strokeWidth="1.7"
        />
      );
    case 'shipyard':
      // Orbital dock bays
      return (
        <g stroke={color} strokeWidth="1.6" fill="none">
          <rect x={x - 7} y={y - 6} width="14" height="4" rx="1" />
          <rect x={x - 7} y={y + 2} width="14" height="4" rx="1" />
          <line x1={x - 3} y1={y - 2} x2={x - 3} y2={y + 2} />
          <line x1={x + 3} y1={y - 2} x2={x + 3} y2={y + 2} />
        </g>
      );
    case 'capital':
      // Crowned citadel star
      return (
        <polygon
          points={`${x},${y - 9} ${x + 3},${y - 3} ${x + 9},${y - 3} ${x + 4},${y + 2} ${x + 6},${y + 8} ${x},${y + 4} ${x - 6},${y + 8} ${x - 4},${y + 2} ${x - 9},${y - 3} ${x - 3},${y - 3}`}
          fill={color}
          fillOpacity="0.25"
          stroke={color}
          strokeWidth="1.5"
        />
      );
  }
}

export function MapView() {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const selectedSectorId = useGameStore((s) => s.selectedSectorId);
  const selectSector = useGameStore((s) => s.selectSector);
  const startBattle = useGameStore((s) => s.startBattle);
  const setActiveTab = useGameStore((s) => s.setActiveTab);
  const repairBase = useGameStore((s) => s.repairBase);
  const advanceMonth = useGameStore((s) => s.advanceMonth);
  const hireWingmanAtBase = useGameStore((s) => s.hireWingmanAtBase);
  const acceptMissionAtBase = useGameStore((s) => s.acceptMissionAtBase);
  const useEngineerAtBase = useGameStore((s) => s.useEngineerAtBase);

  const layoutMode = useBattleLayoutMode();
  const isPhone = layoutMode === 'phone-portrait';
  const initialSelectedSector = getSectorById(selectedSectorId);
  const initialFallbackSize = getFallbackMapBoxSize(isPhone);
  const initialView = isPhone
    ? computeInitialPhoneMapView(
        initialSelectedSector.mapPos,
        initialFallbackSize.width,
        initialFallbackSize.height
      )
    : { zoom: 1, pan: { x: 0, y: 0 } };

  const [zoom, setZoom] = useState(initialView.zoom);
  const [pan, setPan] = useState(initialView.pan);
  const [mapBoxSize, setMapBoxSize] = useState(initialFallbackSize);
  const [hintFaded, setHintFaded] = useState(false);
  const [mapInfoOpen, setMapInfoOpen] = useState(false);
  const [mobileBriefingOpen, setMobileBriefingOpen] = useState(false);
  const [preBattleDetailsOpen, setPreBattleDetailsOpen] = useState(false);
  const [hireClass, setHireClass] = useState<MechClassId>('interceptor');

  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const userInteractedRef = useRef(false);
  const prevIsPhoneRef = useRef(isPhone);
  // Pointer drag-to-pan & 2-finger pinch-to-zoom state
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchBaseRef = useRef<{ dist: number; zoom: number } | null>(null);
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const activeGear = pilot.gears[pilot.activeGearId];
  const selectedSector = getSectorById(selectedSectorId);
  const selectedBaseState = getBaseState(pilot, selectedSector.id);
  const selectedBaseIncome = getBaseMonthlyIncome(
    selectedSector,
    selectedBaseState
  );
  const servicesAvailable = isBaseServicesAvailable(selectedBaseState);
  const totalIncome = getTotalMonthlyIncome(pilot);

  const effectiveSquadSize =
    adminConfig.battleSizeOverride ?? selectedSector.squadSize;
  const selectedDropConfig = DROP_CONFIG[selectedSector.difficulty];
  const estimatedEnemyLevel = Math.max(
    1,
    activeGear.level + selectedSector.levelOffset
  );

  const estRegular = calculateSingleEnemyReward(estimatedEnemyLevel, false);
  const estBoss = selectedSector.hasBoss
    ? calculateSingleEnemyReward(estimatedEnemyLevel + 1, true)
    : null;
  const regularCount = selectedSector.hasBoss
    ? Math.max(1, effectiveSquadSize - 1)
    : effectiveSquadSize;
  const estFullExp = Math.round(
    (estRegular.exp * regularCount + (estBoss?.exp ?? 0)) *
      adminConfig.rewardMultiplier
  );
  const estFullCr = Math.round(
    (estRegular.credits * regularCount + (estBoss?.credits ?? 0)) *
      adminConfig.rewardMultiplier
  );

  const getCurrentMapBoxSize = () => {
    const el = mapViewportRef.current;
    if (el && el.clientWidth > 0 && el.clientHeight > 0) {
      return { width: el.clientWidth, height: el.clientHeight };
    }
    return mapBoxSize;
  };

  const clampZoom = (z: number) => clampMapZoom(z);
  const clampPan = (x: number, y: number, targetZoom = zoom) => {
    const size = getCurrentMapBoxSize();
    return clampMapPan(x, y, targetZoom, size.width, size.height);
  };

  const resetMapView = () => {
    userInteractedRef.current = false;
    if (isPhone) {
      const size = getCurrentMapBoxSize();
      const view = computeInitialPhoneMapView(
        selectedSector.mapPos,
        size.width,
        size.height
      );
      setZoom(view.zoom);
      setPan(view.pan);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    const el = mapViewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const syncSize = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        const nextSize = { width: el.clientWidth, height: el.clientHeight };
        setMapBoxSize(nextSize);
        if (isPhone && !userInteractedRef.current) {
          const view = computeInitialPhoneMapView(
            selectedSector.mapPos,
            nextSize.width,
            nextSize.height
          );
          setZoom(view.zoom);
          setPan(view.pan);
        }
      }
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPhone, selectedSector.mapPos]);

  useEffect(() => {
    const fallback = getFallbackMapBoxSize(isPhone);
    setMapBoxSize((prev) => {
      const el = mapViewportRef.current;
      if (el && el.clientWidth > 0 && el.clientHeight > 0) {
        return { width: el.clientWidth, height: el.clientHeight };
      }
      return prev.width > 0 && prev.height > 0 && prevIsPhoneRef.current === isPhone
        ? prev
        : fallback;
    });

    if (prevIsPhoneRef.current !== isPhone) {
      prevIsPhoneRef.current = isPhone;
      userInteractedRef.current = false;
      if (isPhone) {
        const el = mapViewportRef.current;
        const size =
          el && el.clientWidth > 0 && el.clientHeight > 0
            ? { width: el.clientWidth, height: el.clientHeight }
            : fallback;
        const view = computeInitialPhoneMapView(
          selectedSector.mapPos,
          size.width,
          size.height
        );
        setZoom(view.zoom);
        setPan(view.pan);
      } else {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setMapInfoOpen(false);
      }
    }
  }, [isPhone, selectedSector.mapPos]);

  useEffect(() => {
    if (!isPhone) {
      setHintFaded(false);
      return;
    }
    setHintFaded(false);
    const timer = window.setTimeout(() => {
      setHintFaded(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [isPhone]);

  const handleSelectSector = (sectorId: string) => {
    if (dragOriginRef.current?.moved) return;
    if (!isVisible(pilot, sectorId)) return;
    soundFx.playClick();
    selectSector(sectorId);
    setPreBattleDetailsOpen(false);
    setMobileBriefingOpen(true);
  };

  const applyZoomDelta = (delta: number) => {
    userInteractedRef.current = true;
    setZoom((z) => {
      const nextZoom = clampZoom(z + delta);
      setPan((prevPan) => clampPan(prevPan.x, prevPan.y, nextZoom));
      return nextZoom;
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      dragOriginRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      };
      pinchBaseRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchBaseRef.current = { dist: Math.max(1, dist), zoom };
      dragOriginRef.current = null;
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchBaseRef.current) {
      userInteractedRef.current = true;
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const nextZoom = clampZoom(
        pinchBaseRef.current.zoom * (dist / pinchBaseRef.current.dist)
      );
      setZoom(nextZoom);
      setPan((prevPan) => clampPan(prevPan.x, prevPan.y, nextZoom));
    } else if (pointersRef.current.size === 1 && dragOriginRef.current) {
      const dx = e.clientX - dragOriginRef.current.x;
      const dy = e.clientY - dragOriginRef.current.y;
      if (Math.hypot(dx, dy) > 6) {
        dragOriginRef.current.moved = true;
        userInteractedRef.current = true;
      }
      setPan(
        clampPan(dragOriginRef.current.panX + dx, dragOriginRef.current.panY + dy)
      );
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchBaseRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      setTimeout(() => {
        dragOriginRef.current = null;
      }, 20);
    }
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    applyZoomDelta(delta);
  };

  const renderNpcRow = (npc: BaseNpcRole) => {
    const hireCost = getHireWingmanCost(selectedSector);
    const canAffordHire = pilot.credits >= hireCost && !pilot.hiredWingman;
    const canAffordEngineer =
      pilot.credits >= ENGINEER_OVERCHARGE_COST && !pilot.engineerShieldBoost;
    const missionActive = Boolean(
      pilot.activeBonusMission && !pilot.activeBonusMission.completed
    );

    switch (npc) {
      case 'quartermaster':
        return (
          <div
            key={npc}
            className="rounded-lg border border-slate-800 bg-[#080C15] p-2.5 flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex items-start gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  {t('map.npc.quartermaster')}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t('map.npc.quartermasterDesc')}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!servicesAvailable}
              onClick={() => {
                setMobileBriefingOpen(false);
                setActiveTab('shop');
              }}
              className="min-h-[40px] px-3 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 text-xs font-semibold shrink-0 cursor-pointer"
            >
              {t('map.npc.quartermasterBtn')}
            </button>
          </div>
        );

      case 'mission_officer':
        return (
          <div
            key={npc}
            className="rounded-lg border border-slate-800 bg-[#080C15] p-2.5 flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex items-start gap-2">
              <ScrollText className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  {t('map.npc.mission_officer')}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t('map.npc.mission_officerDesc')}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!servicesAvailable || missionActive}
              onClick={() => {
                soundFx.playClick();
                acceptMissionAtBase(selectedSector.id);
              }}
              className="min-h-[40px] px-3 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-sky-200 text-xs font-semibold shrink-0 cursor-pointer"
            >
              {t('map.npc.mission_officerBtn')}
            </button>
          </div>
        );

      case 'pilot_for_hire':
        return (
          <div
            key={npc}
            className="rounded-lg border border-slate-800 bg-[#080C15] p-2.5 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-start gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">
                    {t('map.npc.pilot_for_hire')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t('map.npc.pilot_for_hireDesc')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={!servicesAvailable || !canAffordHire}
                onClick={() => {
                  soundFx.playClick();
                  hireWingmanAtBase(selectedSector.id, hireClass);
                }}
                className="min-h-[40px] px-3 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-200 text-xs font-semibold shrink-0 cursor-pointer whitespace-nowrap"
              >
                {t('map.npc.pilot_for_hireBtn', { cost: hireCost })}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {MECH_CLASS_LIST.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  disabled={!servicesAvailable}
                  onClick={() => setHireClass(cls.id)}
                  className={`min-h-[32px] px-2 rounded border text-[11px] font-medium cursor-pointer disabled:opacity-40 ${
                    hireClass === cls.id
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {getClassName(lang, cls.id)}
                </button>
              ))}
            </div>
          </div>
        );

      case 'engineer':
        return (
          <div
            key={npc}
            className="rounded-lg border border-slate-800 bg-[#080C15] p-2.5 flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex items-start gap-2">
              <Wrench className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  {t('map.npc.engineer')}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t('map.npc.engineerDesc')}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!servicesAvailable || !canAffordEngineer}
              onClick={() => {
                soundFx.playClick();
                useEngineerAtBase(selectedSector.id);
              }}
              className="min-h-[40px] px-3 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-purple-200 text-xs font-semibold shrink-0 cursor-pointer whitespace-nowrap"
            >
              {t('map.npc.engineerBtn', { cost: ENGINEER_OVERCHARGE_COST })}
            </button>
          </div>
        );
    }
  };

  const renderBriefingBody = () => {
    const garrisonList =
      selectedBaseState.faction === 'allied'
        ? selectedSector.alliedGarrison
        : selectedSector.hostileGarrison;
    const isAllied = selectedBaseState.faction === 'allied';
    const isDamaged = selectedBaseState.status === 'damaged';
    const isRepairing = selectedBaseState.status === 'repairing';

    const battleOptions = getBattleOptions(
      pilot,
      selectedSector.id,
      adminConfig
    );
    const defaultBattleKind = pickDefaultBattle(battleOptions);
    const canDeploy = defaultBattleKind !== null;
    const blockedReasonKey = !canDeploy
      ? battleOptions.find((opt) => !opt.allowed && opt.reasonKey)?.reasonKey ??
        'map.reason.notFrontline'
      : null;
    const blockedReasonText = blockedReasonKey ? t(blockedReasonKey) : undefined;

    const deployCtaLabel =
      defaultBattleKind === 'defend' ||
      (defaultBattleKind === null && selectedBaseState.underAttack)
        ? t('map.defendBtn', { size: effectiveSquadSize })
        : defaultBattleKind === 'patrol' ||
          (defaultBattleKind === null && isAllied)
        ? t('map.patrolBtn', { size: effectiveSquadSize })
        : t('map.assaultBtn', { size: effectiveSquadSize });

    return (
      <div className="space-y-4">
        {/* Title + Faction / Type / Status Badges */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] mb-1">
            <span
              className={`px-2 py-0.5 rounded border font-semibold ${
                FACTION_BADGE_CLASS[selectedBaseState.faction]
              }`}
            >
              {t(`map.faction.${selectedBaseState.faction}` as never)}
            </span>
            <span className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-sky-300 font-semibold">
              {t(`map.baseType.${selectedSector.baseType}` as never)}
            </span>
            <span className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 font-mono-nums text-slate-200 font-bold">
              {t('common.levelShort')}
              {selectedSector.baseLevel}
            </span>
            <span
              className={`px-2 py-0.5 rounded border font-semibold ${
                isDamaged
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                  : isRepairing
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {isRepairing
                ? t('map.status.repairing', {
                    months: selectedBaseState.repairMonthsRemaining,
                  })
                : t(`map.status.${selectedBaseState.status}` as never)}
            </span>
          </div>

          <h2 className="font-display text-2xl font-bold text-slate-50 leading-tight">
            {getSectorName(lang, selectedSector.id)}
          </h2>
          <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>{getSectorRegion(lang, selectedSector.id)}</span>
            <span>·</span>
            <span className={DIFFICULTY_TEXT_CLASS[selectedSector.difficulty]}>
              {getDifficultyLabel(lang, selectedSector.difficulty)}
            </span>
            <span>·</span>
            <span className="font-mono-nums text-sky-300 font-semibold">
              {effectiveSquadSize}v{effectiveSquadSize}
            </span>
          </div>
        </div>

        {/* Under Attack Urgent Alert */}
        {selectedBaseState.underAttack && (
          <div className="rounded-lg border border-red-500/60 bg-red-500/15 px-3 py-2 text-xs text-red-200 flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              {t('map.underAttack', {
                months: selectedBaseState.attackCountdownMonths,
              })}
            </span>
          </div>
        )}

        {selectedSector.hasBoss && !isAllied && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-center gap-2 font-semibold">
            <Skull className="w-4 h-4 shrink-0" />
            <span>{t('map.bossWarning')}</span>
          </div>
        )}

        {/* Pre-battle intro: single short line + collapsible Details section */}
        <div
          data-testid="prebattle-intro"
          className="rounded-lg border border-slate-800/90 bg-[#080C15] p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-slate-200 font-medium truncate">
              {t('battle.preBattleSummary', {
                region: getSectorRegion(lang, selectedSector.id),
                difficulty: getDifficultyLabel(lang, selectedSector.difficulty),
                size: effectiveSquadSize,
                level: estimatedEnemyLevel,
              })}
            </p>
            <button
              type="button"
              data-testid="prebattle-details-toggle"
              aria-expanded={preBattleDetailsOpen}
              onClick={() => setPreBattleDetailsOpen((v) => !v)}
              className="min-h-[44px] px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-300 text-[13px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>
                {preBattleDetailsOpen
                  ? t('battle.detailsHide')
                  : t('battle.detailsShow')}
              </span>
              {preBattleDetailsOpen ? (
                <ChevronUp className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
          {preBattleDetailsOpen && (
            <p
              data-testid="prebattle-details-content"
              className="text-[13px] text-slate-300 leading-relaxed pt-2 border-t border-slate-800/80"
            >
              {getSectorDesc(lang, selectedSector.id)}
            </p>
          )}
        </div>

        {/* Stationed Fleet (Garrison) as small ship icons */}
        <div className="rounded-lg border border-slate-800 bg-[#080C15] p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('map.garrisonTitle')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {garrisonList.map((spec, idx) => (
              <div
                key={`${spec.classId}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded border border-slate-800 bg-slate-950/90 px-2 py-1"
              >
                <FighterSvg
                  classId={spec.classId}
                  side={isAllied ? 'ally' : 'enemy'}
                  size="sm"
                  className="w-7 h-5 shrink-0"
                />
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-slate-200 flex items-center gap-1">
                    <span>{getClassName(lang, spec.classId)}</span>
                    <span className="font-mono-nums text-sky-300">
                      ×{spec.count}
                    </span>
                  </div>
                  {spec.isBoss && (
                    <span className="text-[9px] font-bold uppercase text-orange-400">
                      BOSS
                    </span>
                  )}
                  {spec.isStructure && (
                    <span className="text-[9px] font-bold uppercase text-slate-400">
                      {t('battle.structureTag')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Income & Repair Status */}
        <div className="rounded-lg border border-slate-800 bg-[#080C15] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('map.incomeTitle')}</span>
            </span>
            {isAllied && !isDamaged && !isRepairing && (
              <span className="font-mono-nums font-bold text-emerald-400">
                +{selectedBaseIncome.credits.toLocaleString()} CR · +
                {selectedBaseIncome.warPoints} WP / mo
              </span>
            )}
          </div>

          {isAllied && isDamaged && (
            <div className="space-y-2">
              <p className="text-xs text-amber-300">
                {t('map.incomeZeroDamaged')}
              </p>
              <button
                type="button"
                disabled={pilot.credits < selectedSector.repairCost}
                onClick={() => {
                  soundFx.playClick();
                  repairBase(selectedSector.id);
                }}
                className="w-full min-h-[44px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Wrench className="w-4 h-4" />
                <span>
                  {t('map.repairBtn', {
                    cost: selectedSector.repairCost.toLocaleString(),
                    months: selectedSector.repairMonths,
                  })}
                </span>
              </button>
            </div>
          )}

          {isAllied && isRepairing && (
            <p className="text-xs text-sky-300">
              {t('map.repairInProgress', {
                months: selectedBaseState.repairMonthsRemaining,
              })}
            </p>
          )}

          {!isAllied && (
            <p className="text-xs text-slate-400">
              {t('map.incomeZeroHostile')} (
              +{selectedSector.monthlyCredits.toLocaleString()} CR · +
              {selectedSector.monthlyWarPoints} WP / mo)
            </p>
          )}
        </div>

        {/* Resident NPCs & Services */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span>{t('map.servicesTitle')}</span>
            {!servicesAvailable && (
              <span className="text-[11px] text-amber-400 font-normal">
                <Lock className="w-3 h-3 inline mr-1" />
                {isAllied
                  ? t('map.status.damaged')
                  : t(`map.faction.${selectedBaseState.faction}` as never)}
              </span>
            )}
          </div>

          {!servicesAvailable && (
            <div className="rounded border border-slate-800/90 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-400">
              {isAllied
                ? t('map.servicesLockedDamaged')
                : t('map.servicesLockedHostile')}
            </div>
          )}

          <div className="space-y-2">
            {selectedSector.npcs.map((npc) => renderNpcRow(npc))}
          </div>
        </div>

        {/* Combat Telemetry Summary */}
        <div className="divide-y divide-slate-800/80 border-y border-slate-800/80 text-xs">
          <div className="py-2 flex items-center justify-between gap-2">
            <span className="text-slate-400">{t('map.enemyEstimate')}</span>
            <span className="font-mono-nums font-semibold text-slate-100">
              {effectiveSquadSize} × ~{t('common.levelShort')}
              {estimatedEnemyLevel}
            </span>
          </div>
          <div className="py-2 flex items-center justify-between gap-2">
            <span className="text-slate-400">{t('map.rewardRate')}</span>
            <span className="font-mono-nums font-semibold text-emerald-400">
              ~{estFullExp} EXP · ~{estFullCr.toLocaleString()} CR
            </span>
          </div>
          <div className="py-2 flex items-center justify-between gap-2">
            <span className="text-slate-400">{t('map.dropOdds')}</span>
            <span className="font-mono-nums font-semibold text-amber-400">
              {selectedDropConfig.rarityWeights.epic}% /{' '}
              {selectedDropConfig.rarityWeights.legendary}%
            </span>
          </div>
        </div>

        {/* Deploy Button */}
        <button
          type="button"
          data-testid="map-deploy-btn"
          disabled={!canDeploy}
          title={blockedReasonText}
          onClick={() => {
            if (!defaultBattleKind) return;
            setMobileBriefingOpen(false);
            startBattle(selectedSector.id);
          }}
          className={`w-full min-h-[48px] px-4 inline-flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
            !canDeploy
              ? 'bg-slate-800 text-slate-400 border border-slate-700'
              : selectedBaseState.underAttack
              ? 'bg-red-500 hover:bg-red-400 text-white cursor-pointer'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
          }`}
        >
          <Rocket className="w-4 h-4" />
          <span>{deployCtaLabel}</span>
        </button>
        {!canDeploy && blockedReasonText && (
          <p
            data-testid="map-deploy-blocked-reason"
            className="text-xs text-slate-400 text-center"
          >
            {blockedReasonText}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid="map-scroll-container"
      className={
        isPhone
          ? 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pt-2.5 space-y-3'
          : 'flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3.5 sm:space-y-4'
      }
    >
      {/* Header: Compact <=72px on Phone, Full Header + Actions on Desktop/Tablet */}
      {isPhone ? (
        <div
          data-testid="map-compact-header"
          className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 px-2.5 py-1 space-y-1 max-h-[72px]"
        >
          <div className="flex items-center justify-between gap-2 h-8 min-w-0">
            <h1 className="font-display text-base font-bold tracking-wide text-slate-100 truncate min-w-0">
              {t('map.pageTitle')}
            </h1>
            <button
              type="button"
              data-testid="map-info-btn"
              onClick={() => setMapInfoOpen(true)}
              aria-label={t('map.infoBtnAria')}
              title={t('map.pageSubtitle')}
              className="w-10 h-10 -my-1 -mr-1.5 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-sky-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-sky-500/40 bg-sky-500/12 text-[11px] leading-4 font-mono-nums font-semibold text-sky-200 shrink-0 whitespace-nowrap">
              <Calendar className="w-3 h-3 text-sky-400" />
              {t('map.monthBadge', { month: pilot.campaignMonth ?? 1 })}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-[11px] leading-4 font-mono-nums font-semibold text-emerald-300 truncate min-w-0">
              {t('map.monthlyTotalShort', {
                cr: totalIncome.credits.toLocaleString(),
                wp: totalIncome.warPoints,
              })}
            </span>
          </div>
        </div>
      ) : (
        <div
          data-testid="map-desktop-header"
          className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100">
                {t('map.pageTitle')}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-sky-500/40 bg-sky-500/12 text-xs font-mono-nums font-semibold text-sky-200">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                {t('map.monthBadge', { month: pilot.campaignMonth ?? 1 })}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-xs font-mono-nums font-semibold text-emerald-300">
                {t('map.monthlyTotal', {
                  cr: totalIncome.credits.toLocaleString(),
                  wp: totalIncome.warPoints,
                })}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('map.pageSubtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                advanceMonth();
              }}
              className="flex-1 sm:flex-none min-h-[44px] px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <FastForward className="w-4 h-4" />
              <span>{t('map.advanceMonth')}</span>
            </button>

            <button
              type="button"
              onClick={() => startBattle(selectedSector.id)}
              className="flex-1 sm:flex-none min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Rocket className="w-4 h-4" />
              <span>
                {t('hangar.deploySquad')} ({getClassName(lang, activeGear.classId)}{' '}
                Lv.{activeGear.level})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Active Pre-Battle Buffs & Bonus Mission Strip */}
      {(pilot.hiredWingman ||
        pilot.engineerShieldBoost ||
        (pilot.activeBonusMission && !pilot.activeBonusMission.completed)) && (
        <div className="flex flex-wrap items-center gap-2">
          {pilot.hiredWingman && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/12 px-3 py-1.5 text-xs text-emerald-200 font-semibold">
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {t('map.activeBuffWingman', {
                  callsign: `${pilot.hiredWingman.callsign} (${getClassName(
                    lang,
                    pilot.hiredWingman.classId
                  )})`,
                })}
              </span>
            </div>
          )}
          {pilot.engineerShieldBoost && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-500/12 px-3 py-1.5 text-xs text-purple-200 font-semibold">
              <Wrench className="w-3.5 h-3.5 text-purple-400" />
              <span>{t('map.activeBuffShield')}</span>
            </div>
          )}
          {pilot.activeBonusMission && !pilot.activeBonusMission.completed && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/12 px-3 py-1.5 text-xs text-sky-200 font-semibold">
              <ScrollText className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {t('map.activeMissionBanner', {
                  sector: getSectorName(
                    lang,
                    pilot.activeBonusMission.targetSectorId
                  ),
                  cr: pilot.activeBonusMission.rewardCredits,
                  wp: pilot.activeBonusMission.rewardWarPoints,
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Pan & Pinch-to-Zoom Star Chart + Legend */}
      <section className="rounded-lg border border-slate-800/90 bg-[#080C14] relative overflow-hidden">
        <div
          ref={mapViewportRef}
          data-testid="map-viewport-box"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          style={isPhone ? { height: 'clamp(360px, 62dvh, 560px)' } : undefined}
          className={
            isPhone
              ? 'relative w-full touch-none cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center'
              : 'relative w-full h-72 sm:h-80 touch-none cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center'
          }
        >
          <div
            data-testid="map-pan-hint"
            data-hint-faded={isPhone && hintFaded ? 'true' : 'false'}
            className={
              isPhone
                ? `absolute bottom-2 left-2 z-10 max-w-[calc(100%-148px)] text-[11px] leading-tight text-slate-300 bg-slate-950/85 border border-slate-800 rounded px-2 py-1 pointer-events-none transition-opacity duration-500 ${
                    hintFaded ? 'opacity-0' : 'opacity-100'
                  }`
                : 'absolute top-2 left-2.5 z-10 text-[11px] text-slate-400 bg-slate-950/85 border border-slate-800 rounded px-2 py-1 pointer-events-none'
            }
          >
            {t('mobile.mapPanHint')}
          </div>

          <div
            data-testid="map-zoom-controls"
            className={
              isPhone
                ? 'absolute bottom-2 right-2 z-10 flex items-center gap-1'
                : 'absolute top-2 right-2 z-10 flex items-center gap-1'
            }
          >
            <button
              type="button"
              onClick={() => applyZoomDelta(0.25)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t('mobile.mapZoomIn')}
              className={
                isPhone
                  ? 'w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer'
                  : 'min-w-[44px] min-h-[44px] rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer'
              }
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyZoomDelta(-0.25)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t('mobile.mapZoomOut')}
              className={
                isPhone
                  ? 'w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer'
                  : 'min-w-[44px] min-h-[44px] rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer'
              }
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetMapView}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t('mobile.mapResetView')}
              className={
                isPhone
                  ? 'w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer'
                  : 'min-w-[44px] min-h-[44px] rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer'
              }
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <svg
            viewBox="0 0 840 310"
            className="w-full h-full select-none transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
            role="img"
            aria-label={t('map.pageTitle')}
          >
            {/* Subtle orbital grid rings */}
            <ellipse
              cx="420"
              cy="165"
              rx="375"
              ry="135"
              fill="none"
              stroke="#1E293B"
              strokeWidth="1"
              strokeDasharray="6 6"
            />
            <ellipse
              cx="420"
              cy="165"
              rx="235"
              ry="90"
              fill="none"
              stroke="#1E293B"
              strokeWidth="1"
              strokeDasharray="4 6"
            />

            {/* Star Lanes + Animated Incoming Raid Dots */}
            {MAP_LANES.map((lane) => {
              const sFrom = getSectorById(lane.from);
              const sTo = getSectorById(lane.to);
              const stFrom = getBaseState(pilot, lane.from);
              const stTo = getBaseState(pilot, lane.to);

              const raidToTarget =
                stTo.underAttack && stTo.attackFromSectorId === lane.from;
              const raidToSource =
                stFrom.underAttack && stFrom.attackFromSectorId === lane.to;
              const isIncomingLane = raidToTarget || raidToSource;

              const startPos = raidToSource ? sTo.mapPos : sFrom.mapPos;
              const endPos = raidToSource ? sFrom.mapPos : sTo.mapPos;
              const pathId = `lane-${lane.from}-${lane.to}`;
              const pathD = `M ${startPos.x} ${startPos.y} L ${endPos.x} ${endPos.y}`;

              return (
                <g key={pathId}>
                  <path
                    id={pathId}
                    d={pathD}
                    fill="none"
                    stroke={isIncomingLane ? '#EF4444' : '#334155'}
                    strokeWidth={isIncomingLane ? '2.6' : '1.8'}
                    strokeDasharray={isIncomingLane ? '6 6' : '5 5'}
                    className={isIncomingLane ? 'anim-lane-flow' : undefined}
                    opacity={isIncomingLane ? 0.92 : 0.72}
                  />
                  {isIncomingLane && (
                    <>
                      {[0, 0.33, 0.66].map((offset) => (
                        <circle
                          key={offset}
                          r="3.8"
                          fill="#F97316"
                          stroke="#FEF08A"
                          strokeWidth="1"
                        >
                          <animateMotion
                            dur="2.4s"
                            begin={`${-offset * 2.4}s`}
                            repeatCount="indefinite"
                            path={pathD}
                          />
                        </circle>
                      ))}
                    </>
                  )}
                </g>
              );
            })}

            {/* Base Nodes (Round = Outpost/Colony/Relay, Square = Fortress/Shipyard/Capital) */}
            {SECTORS_CATALOG.map((sector) => {
              const pos = sector.mapPos;
              const unlocked = pilot.unlockedSectorIds.includes(sector.id);
              const isSelected = sector.id === selectedSector.id;
              const baseState = getBaseState(pilot, sector.id);
              const ringHex = unlocked
                ? FACTION_RING_HEX[baseState.faction]
                : '#475569';
              const tokenShape = getTokenShapeForBaseType(sector.baseType);
              const isSquare = tokenShape === 'square';
              const scale = adminConfig.battleSizeOverride ?? sector.squadSize;

              return (
                <g
                  key={sector.id}
                  onClick={() => handleSelectSector(sector.id)}
                  className={unlocked ? 'cursor-pointer' : 'opacity-45'}
                >
                  {/* Pulsing Under Attack Warning Halo */}
                  {baseState.underAttack && unlocked && (
                    isSquare ? (
                      <rect
                        x={pos.x - 28}
                        y={pos.y - 28}
                        width="56"
                        height="56"
                        rx="9"
                        fill="#EF4444"
                        fillOpacity="0.14"
                        stroke="#EF4444"
                        strokeWidth="2.2"
                        className="anim-raid-pulse"
                      />
                    ) : (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="31"
                        fill="#EF4444"
                        fillOpacity="0.14"
                        stroke="#EF4444"
                        strokeWidth="2.2"
                        className="anim-raid-pulse"
                      />
                    )
                  )}

                  {/* Selected Outer Highlight Ring */}
                  {isSelected && unlocked && (
                    isSquare ? (
                      <rect
                        x={pos.x - 26}
                        y={pos.y - 26}
                        width="52"
                        height="52"
                        rx="8"
                        fill={ringHex}
                        fillOpacity="0.12"
                        stroke="#F8FAFC"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                      />
                    ) : (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="28"
                        fill={ringHex}
                        fillOpacity="0.12"
                        stroke="#F8FAFC"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                      />
                    )
                  )}

                  {/* Enlarged >= 44px transparent hit target */}
                  <circle cx={pos.x} cy={pos.y} r="32" fill="transparent" />

                  {/* Main Token Body (Round or Square) */}
                  {isSquare ? (
                    <rect
                      x={pos.x - 20}
                      y={pos.y - 20}
                      width="40"
                      height="40"
                      rx="6"
                      fill="#0D131D"
                      stroke={ringHex}
                      strokeWidth={isSelected ? '3.2' : '2.5'}
                    />
                  ) : (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="20"
                      fill="#0D131D"
                      stroke={ringHex}
                      strokeWidth={isSelected ? '3.2' : '2.5'}
                    />
                  )}

                  {/* Base Type Icon */}
                  <BaseTypeGlyph
                    type={sector.baseType}
                    x={pos.x}
                    y={pos.y}
                    color={ringHex}
                  />

                  {/* Level Badge (Bottom-Right) */}
                  <g transform={`translate(${pos.x + 15}, ${pos.y + 13})`}>
                    <rect
                      x="-13"
                      y="-8"
                      width="26"
                      height="15"
                      rx="4"
                      fill="#0F172A"
                      stroke={ringHex}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="9"
                      fontWeight="700"
                    >
                      Lv{sector.baseLevel}
                    </text>
                  </g>

                  {/* Under Attack Countdown Pill (Top-Right) */}
                  {baseState.underAttack && unlocked && (
                    <g transform={`translate(${pos.x + 18}, ${pos.y - 22})`}>
                      <rect
                        x="-18"
                        y="-9"
                        width="36"
                        height="16"
                        rx="4"
                        fill="#DC2626"
                        stroke="#FEF08A"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="9.5"
                        fontWeight="800"
                      >
                        ! {baseState.attackCountdownMonths}m
                      </text>
                    </g>
                  )}

                  {/* Damaged / Repairing Mini Badge (Top-Left) */}
                  {baseState.faction === 'allied' &&
                    baseState.status !== 'operational' && (
                      <g transform={`translate(${pos.x - 20}, ${pos.y - 21})`}>
                        <rect
                          x="-15"
                          y="-8"
                          width="30"
                          height="15"
                          rx="4"
                          fill={
                            baseState.status === 'repairing'
                              ? '#0284C7'
                              : '#D97706'
                          }
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="8.5"
                          fontWeight="800"
                        >
                          {baseState.status === 'repairing'
                            ? `${baseState.repairMonthsRemaining}m`
                            : 'DMG'}
                        </text>
                      </g>
                    )}

                  {/* Base Label */}
                  <text
                    x={pos.x}
                    y={pos.y + 39}
                    textAnchor="middle"
                    fill={isSelected ? '#F8FAFC' : '#CBD5E1'}
                    fontSize="11.5"
                    fontWeight={isSelected ? '700' : '600'}
                  >
                    {getSectorName(lang, sector.id)}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 52}
                    textAnchor="middle"
                    fill={ringHex}
                    fontSize="10"
                    fontWeight="600"
                  >
                    {unlocked
                      ? `${scale}v${scale}${sector.hasBoss ? ' · BOSS' : ''}`
                      : t('common.locked')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Map Legend Strip */}
        <div className="border-t border-slate-800/90 bg-[#0A0F1A] px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-300">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
            {t('map.legendTitle')}:
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-slate-300 inline-block" />
            <span>{t('map.legendRound')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] border-2 border-slate-300 inline-block" />
            <span>{t('map.legendSquare')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>{t('map.faction.allied')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span>{t('map.faction.hostile')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>{t('map.faction.neutral')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-orange-300">
            <span className="w-4 border-t-2 border-dashed border-red-500 inline-block" />
            <span>{t('map.legendIncoming')}</span>
          </span>
        </div>
      </section>

      {/* Base List + Desktop Inline Base Panel */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ${
          isPhone ? 'pb-16' : ''
        }`}
      >
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTORS_CATALOG.map((sector) => {
            const unlocked = pilot.unlockedSectorIds.includes(sector.id);
            const isSelected = sector.id === selectedSector.id;
            const st = getBaseState(pilot, sector.id);
            const inc = getBaseMonthlyIncome(sector, st);
            const scale = adminConfig.battleSizeOverride ?? sector.squadSize;
            const isSquare =
              getTokenShapeForBaseType(sector.baseType) === 'square';

            return (
              <button
                key={sector.id}
                type="button"
                disabled={!unlocked}
                onClick={() => handleSelectSector(sector.id)}
                className={`rounded-lg border p-3.5 text-left transition-colors space-y-2 ${
                  !unlocked
                    ? 'border-slate-800/60 bg-[#090D14]/60 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-amber-400/80 bg-slate-900/95 cursor-pointer'
                    : 'border-slate-800/90 bg-[#0C121D]/95 hover:border-slate-700 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-block w-2.5 h-2.5 border ${
                          isSquare ? 'rounded-[2px]' : 'rounded-full'
                        }`}
                        style={{
                          borderColor: FACTION_RING_HEX[st.faction],
                        }}
                      />
                      <span>
                        {t(`map.baseType.${sector.baseType}` as never)}
                      </span>
                      <span>·</span>
                      <span className="font-mono-nums text-slate-200 font-semibold">
                        Lv{sector.baseLevel}
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-bold text-slate-100 leading-tight truncate mt-0.5">
                      {getSectorName(lang, sector.id)}
                    </h2>
                  </div>

                  {unlocked ? (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                        FACTION_BADGE_CLASS[st.faction]
                      }`}
                    >
                      {t(`map.faction.${st.faction}` as never)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>{t('common.locked')}</span>
                    </span>
                  )}
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-mono-nums text-sky-300 font-semibold">
                    {scale}v{scale}
                  </span>
                  {sector.hasBoss && (
                    <span className="inline-flex items-center gap-0.5 text-red-400 font-semibold">
                      · <Skull className="w-3 h-3" /> BOSS
                    </span>
                  )}
                  {st.underAttack && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/60 text-red-200 font-semibold">
                      {t('map.underAttack', {
                        months: st.attackCountdownMonths,
                      })}
                    </span>
                  )}
                  {st.faction === 'allied' && st.status === 'damaged' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-200 font-semibold">
                      {t('map.status.damaged')}
                    </span>
                  )}
                  {st.faction === 'allied' && st.status === 'repairing' && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/50 text-sky-200 font-semibold">
                      {t('map.status.repairing', {
                        months: st.repairMonthsRemaining,
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono-nums text-slate-300">
                  <span className={DIFFICULTY_TEXT_CLASS[sector.difficulty]}>
                    {getDifficultyLabel(lang, sector.difficulty)}
                  </span>
                  {st.faction === 'allied' ? (
                    <span
                      className={
                        inc.credits > 0 ? 'text-emerald-400' : 'text-amber-400'
                      }
                    >
                      +{inc.credits} CR · +{inc.warPoints} WP/mo
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      +{sector.monthlyCredits} CR/mo
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop Inline Base Briefing Panel (>= lg) */}
        <section className="hidden lg:block lg:col-span-5 rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-5">
          {renderBriefingBody()}
        </section>
      </div>

      {/* Phone Sticky Bottom Action Bar (< 640px, sits above bottom tab bar) */}
      {isPhone && (
        <div
          data-testid="map-phone-action-bar"
          className="sticky bottom-0 z-20 -mx-3 px-3 py-2 border-t border-slate-800/95 bg-[#080C15]/95 backdrop-blur-md flex items-center gap-2"
        >
          <button
            type="button"
            data-testid="map-phone-advance-btn"
            onClick={() => {
              soundFx.playClick();
              advanceMonth();
            }}
            className="flex-1 min-h-[44px] h-[44px] px-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/15 active:bg-sky-500/25 text-sky-200 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <FastForward className="w-4 h-4 shrink-0" />
            <span>{t('map.advanceMonthShort')}</span>
          </button>

          <button
            type="button"
            data-testid="map-phone-deploy-btn"
            title={`${t('hangar.deploySquad')} (${getClassName(
              lang,
              activeGear.classId
            )} Lv.${activeGear.level})`}
            onClick={() => startBattle(selectedSector.id)}
            className="flex-1 min-h-[44px] h-[44px] px-2.5 inline-flex flex-col items-center justify-center leading-tight rounded-lg bg-amber-500 active:bg-amber-600 text-slate-950 font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <span className="inline-flex items-center gap-1 text-xs font-bold">
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>{t('map.deployShort')}</span>
            </span>
            <span className="text-[10px] font-mono-nums font-bold opacity-85">
              Lv.{activeGear.level}
            </span>
          </button>
        </div>
      )}

      {/* Mobile Map Subtitle Info Sheet (< 640px) */}
      {isPhone && (
        <BottomSheet
          open={mapInfoOpen}
          onClose={() => setMapInfoOpen(false)}
          title={t('map.pageTitle')}
        >
          <p
            data-testid="map-info-subtitle"
            className="text-sm text-slate-300 leading-relaxed"
          >
            {t('map.pageSubtitle')}
          </p>
        </BottomSheet>
      )}

      {/* Mobile Base Panel BottomSheet (< lg) */}
      <div className="lg:hidden">
        <BottomSheet
          open={mobileBriefingOpen}
          onClose={() => setMobileBriefingOpen(false)}
          title={getSectorName(lang, selectedSector.id)}
          subtitle={`${t(
            `map.baseType.${selectedSector.baseType}` as never
          )} · Lv${selectedSector.baseLevel}`}
        >
          {renderBriefingBody()}
        </BottomSheet>
      </div>
    </div>
  );
}
