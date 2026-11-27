import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Crosshair, Info, Lock, Skull, X } from 'lucide-react';
import { getTeamColorRole, hasStatus } from '../engine/combat';
import {
  getArchetypeLabel,
  getClassName,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  CombatUnit,
  FloatingPopup,
  MechClassId,
  TeamColorRole,
} from '../types/game';
import {
  formatShortUnitName,
  isCompactPopupTone,
  SP_COLOR_TOKENS,
  usePrefersReducedMotion,
} from '../utils/battleDisplay';
import { resolveReducedMotion, useFxSettings } from '../utils/battleVfx';
import {
  advanceCardPopupQueue,
  CARD_POPUP_FALLBACK_HEIGHT_PX,
  CARD_POPUP_FALLBACK_WIDTH_PX,
  CARD_POPUP_SETTLE_MS,
  createCardPopupQueueState,
  getCardPopupSymbol,
  getNextCardPopupQueueWakeupMs,
  isSpPopupText,
  parseCardPopupDisplay,
  resolveCardPopupConfig,
  syncCardPopupQueue,
  type CardPopupQueueState,
} from '../utils/cardPopupQueue';
import { useStatusDisplaySettings } from '../utils/statusDisplayPrefs';
import {
  CARD_STATUS_FALLBACK_WIDTH_PX,
  FixedStatusArea,
} from './FixedStatusArea';

interface BattleUnitCardProps {
  unit: CombatUnit;
  isActiveTurn: boolean;
  isTargeted: boolean;
  canTarget: boolean;
  exploding: boolean;
  skipAnimations: boolean;
  autoActive?: boolean;
  compact?: boolean;
  frontBlocked?: boolean;
  wingmanChatText?: string | null;
  popups: FloatingPopup[];
  showStatusLabels?: boolean;
  /** Explicit per-lane status row budget (0 = omit status area, 1..2 = fixed rows). Undefined keeps standalone activeUnitRows fallback. */
  statusRows?: number;
  stageFxRole?: 'attacker' | 'target' | null;
  stageFxColor?: string | null;
  stageFxKey?: string | null;
  onSelect?: () => void;
  onInspect?: () => void;
}

function getTeamVars(role: TeamColorRole): {
  accent: string;
  bg: string;
  border: string;
} {
  switch (role) {
    case 'me':
      return {
        accent: 'var(--team-me)',
        bg: 'var(--team-me-bg)',
        border: 'var(--team-me-border)',
      };
    case 'ally':
      return {
        accent: 'var(--team-ally)',
        bg: 'var(--team-ally-bg)',
        border: 'var(--team-ally-border)',
      };
    case 'boss':
      return {
        accent: 'var(--team-boss)',
        bg: 'var(--team-boss-bg)',
        border: 'var(--team-boss-border)',
      };
    case 'enemy':
    default:
      return {
        accent: 'var(--team-enemy)',
        bg: 'var(--team-enemy-bg)',
        border: 'var(--team-enemy-border)',
      };
  }
}

function getAnimClass(unit: CombatUnit, skip: boolean): string {
  if (skip) return '';
  switch (unit.animState) {
    case 'attacking':
      return unit.side === 'ally' ? 'anim-lunge-right' : 'anim-lunge-left';
    case 'hit':
      return 'anim-hit';
    case 'evaded':
      return 'anim-evade';
    case 'shielded':
      return 'anim-shield';
    case 'casting':
      return 'anim-cast';
    default:
      return '';
  }
}

function getPopupColor(
  tone: FloatingPopup['tone'],
  text: string = ''
): string {
  if (isSpPopupText(text) && (tone === 'buff' || tone === 'heal')) {
    return SP_COLOR_TOKENS.textClass;
  }
  switch (tone) {
    case 'crit':
      return 'text-amber-300';
    case 'damage':
      return 'text-red-400';
    case 'shield':
      return 'text-sky-300';
    case 'heal':
      return 'text-emerald-300';
    case 'evade':
      return 'text-slate-200';
    case 'buff':
      return 'text-sky-200';
    case 'status':
      return 'text-orange-300';
  }
}

function RoleBadgeSvg({
  classId,
  side,
  isPlayer,
  isBoss,
  color,
}: {
  classId: MechClassId;
  side: 'ally' | 'enemy';
  isPlayer: boolean;
  isBoss?: boolean;
  color: string;
}) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="-14 -14 28 28"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Team shape outline (color-blind distinguishable) */}
      {side === 'ally' && isPlayer ? (
        <polygon
          points="0,-12 10.4,-6 10.4,6 0,12 -10.4,6 -10.4,-6"
          fill="#0a1622"
          stroke={color}
          strokeWidth="1.7"
        />
      ) : side === 'ally' ? (
        <circle
          cx="0"
          cy="0"
          r="11.5"
          fill="#0b1320"
          stroke={color}
          strokeWidth="1.6"
        />
      ) : isBoss ? (
        <polygon
          points="-7,-11 7,-11 11,-7 11,7 7,11 -7,11 -11,7 -11,-7"
          fill="#170f0c"
          stroke={color}
          strokeWidth="1.8"
        />
      ) : (
        <polygon
          points="0,-12.5 12.5,0 0,12.5 -12.5,0"
          fill="#140b12"
          stroke={color}
          strokeWidth="1.6"
        />
      )}

      {/* Role silhouette */}
      {classId === 'interceptor' ? (
        <polygon points="0,-6.5 4.8,5 0,2.5 -4.8,5" fill={color} />
      ) : classId === 'siege' ? (
        <polygon
          points="-1.6,-6.5 1.6,-6.5 2.4,-1.5 5.2,-0.5 5.2,5 -5.2,5 -5.2,-0.5 -2.4,-1.5"
          fill={color}
        />
      ) : classId === 'support' ? (
        <path
          d="M 0 -5 V 5 M -5 0 H 5"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <polygon
          points="0,-6 2,-1.2 6.2,2.2 5.6,4.8 1.5,3 0,5.2 -1.5,3 -5.6,4.8 -6.2,2.2 -2,-1.2"
          fill={color}
        />
      )}
    </svg>
  );
}

/**
 * Compact Tactical Unit Row for Card View ("Thẻ"):
 * - Alive units render as a dense 48–56px one-line row (role icon, short name, class & level,
 *   tabular HP/SHD/SP bars with scaleX compositor fills, up to 2 status icons +N, and >=44px info button).
 * - Down units collapse to a thin 28px single-line greyed row (name + "Down") instead of a full card.
 */
export const BattleUnitCard = memo(function BattleUnitCard({
  unit,
  isActiveTurn,
  isTargeted,
  canTarget,
  skipAnimations,
  autoActive = false,
  frontBlocked = false,
  popups,
  showStatusLabels = true,
  statusRows,
  stageFxRole = null,
  stageFxColor = null,
  stageFxKey = null,
  onSelect,
  onInspect,
}: BattleUnitCardProps) {
  const { lang, t } = useI18n();
  const [fxSettings] = useFxSettings();
  const battleSpeed = useGameStore((s) => s.battleSpeed);
  const adminStatusDefaults = useGameStore(
    (s) => s.adminConfig.statusDisplayDefaults
  );
  const cardPopupStaggerMs = useGameStore(
    (s) => s.adminConfig.cardPopupStaggerMs
  );
  const cardPopupFlightMs = useGameStore(
    (s) => s.adminConfig.cardPopupFlightMs
  );
  const cardPopupMaxConcurrent = useGameStore(
    (s) => s.adminConfig.cardPopupMaxConcurrent
  );
  const cardPopupZoneWidthPct = useGameStore(
    (s) => s.adminConfig.cardPopupZoneWidthPct
  );
  const cardPopupZoneHeightPct = useGameStore(
    (s) => s.adminConfig.cardPopupZoneHeightPct
  );
  const iconMods = useGameStore((s) => s.adminConfig.iconCatalogMods);
  const { settings: statusSettings, activeUnitRows } =
    useStatusDisplaySettings(adminStatusDefaults);
  const effectiveStatusRows =
    statusRows !== undefined
      ? Math.max(0, Math.min(2, Math.round(statusRows)))
      : activeUnitRows;
  const osReducedMotion = usePrefersReducedMotion();
  const resolvedReducedMotion = resolveReducedMotion(
    fxSettings.reducedMotionMode,
    osReducedMotion
  );
  const skipCardMotion = skipAnimations || resolvedReducedMotion;

  const cardRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const cardPopupCfg = useMemo(
    () =>
      resolveCardPopupConfig({
        cardPopupStaggerMs,
        cardPopupFlightMs,
        cardPopupMaxConcurrent,
        cardPopupZoneWidthPct,
        cardPopupZoneHeightPct,
      }),
    [
      cardPopupStaggerMs,
      cardPopupFlightMs,
      cardPopupMaxConcurrent,
      cardPopupZoneWidthPct,
      cardPopupZoneHeightPct,
    ]
  );

  const [popupQueue, setPopupQueue] = useState<CardPopupQueueState>(() => {
    if (skipAnimations || fxSettings.effectsMode === 'off' || !unit.alive) {
      return createCardPopupQueueState();
    }
    return syncCardPopupQueue(
      createCardPopupQueueState(),
      popups,
      Date.now(),
      {
        ...cardPopupCfg,
        battleSpeed,
        effectsMode: fxSettings.effectsMode,
      },
      {
        width: CARD_POPUP_FALLBACK_WIDTH_PX,
        height: CARD_POPUP_FALLBACK_HEIGHT_PX,
      }
    );
  });

  useEffect(() => {
    if (skipAnimations || fxSettings.effectsMode === 'off' || !unit.alive) {
      setPopupQueue((prev) =>
        prev.active.length === 0 && prev.pending.length === 0
          ? prev
          : createCardPopupQueueState()
      );
      return;
    }
    const cardWidth = cardRef.current?.clientWidth || CARD_POPUP_FALLBACK_WIDTH_PX;
    const cardHeight =
      cardRef.current?.clientHeight || CARD_POPUP_FALLBACK_HEIGHT_PX;
    setPopupQueue((prev) =>
      syncCardPopupQueue(
        prev,
        popups,
        Date.now(),
        {
          ...cardPopupCfg,
          battleSpeed,
          effectsMode: fxSettings.effectsMode,
        },
        { width: cardWidth, height: cardHeight }
      )
    );
  }, [
    popups,
    cardPopupCfg,
    battleSpeed,
    fxSettings.effectsMode,
    skipAnimations,
    unit.alive,
  ]);

  useEffect(() => {
    if (skipAnimations || fxSettings.effectsMode === 'off' || !unit.alive) {
      return;
    }
    const wakeupMs = getNextCardPopupQueueWakeupMs(
      popupQueue,
      Date.now(),
      cardPopupCfg
    );
    if (wakeupMs === null) return;
    const timerId = window.setTimeout(() => {
      const cardWidth =
        cardRef.current?.clientWidth || CARD_POPUP_FALLBACK_WIDTH_PX;
      const cardHeight =
        cardRef.current?.clientHeight || CARD_POPUP_FALLBACK_HEIGHT_PX;
      setPopupQueue((prev) =>
        advanceCardPopupQueue(
          prev,
          Date.now(),
          {
            ...cardPopupCfg,
            battleSpeed,
            effectsMode: fxSettings.effectsMode,
          },
          { width: cardWidth, height: cardHeight }
        )
      );
    }, wakeupMs);
    return () => window.clearTimeout(timerId);
  }, [
    popupQueue,
    cardPopupCfg,
    battleSpeed,
    fxSettings.effectsMode,
    skipAnimations,
    unit.alive,
  ]);

  const isEnemy = unit.side === 'enemy';
  const shortName = formatShortUnitName(unit.name, 10);

  // COLLAPSED 28px DOWN ROW
  if (!unit.alive) {
    return (
      <div
        data-testid={`unit-row-down-${unit.id}`}
        data-unit-id={unit.id}
        data-unit-collapsed="true"
        data-unit-down="true"
        onClick={onInspect}
        title={`${unit.name} · ${t('battle.unitDown')}`}
        className="w-full min-w-0 h-[28px] max-h-[28px] rounded-md border border-slate-800/70 bg-[#070B12]/70 px-2 flex items-center justify-between gap-2 text-[12px] text-slate-500 select-none cursor-pointer hover:bg-slate-900/60"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <X className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-slate-500 line-through truncate">
            {shortName}
          </span>
        </div>
        <span className="font-mono-nums text-[12px] text-slate-500 shrink-0">
          {t('battle.unitDown')}
        </span>
      </div>
    );
  }

  const hpRatio = Math.max(
    0,
    Math.min(1, unit.hp / Math.max(1, unit.derived.maxHp))
  );
  const shdRatio = Math.max(
    0,
    Math.min(1, unit.shield / Math.max(1, unit.derived.maxShield))
  );
  const spRatio = Math.max(
    0,
    Math.min(1, unit.sp / Math.max(1, unit.derived.maxSp))
  );

  const shieldBroken = hasStatus(unit, 'shield_break');
  const isStealthed = hasStatus(unit, 'stealth');
  const teamRole = getTeamColorRole(unit);
  const teamVars = getTeamVars(teamRole);

  const hpBarColor =
    hpRatio <= 0.25
      ? 'bg-red-500'
      : hpRatio <= 0.55
      ? 'bg-orange-400'
      : 'bg-emerald-500';

  const rowStyle: React.CSSProperties = isActiveTurn
    ? {
        borderColor: 'var(--turn-active)',
        backgroundColor: '#151E2E',
      }
    : isTargeted
    ? {
        borderColor: isEnemy ? 'var(--team-enemy)' : 'var(--team-me)',
        backgroundColor: isEnemy ? '#1B1218' : '#0F1E1A',
      }
    : {
        borderColor: teamVars.border,
      };

  const rowClass = isActiveTurn
    ? skipCardMotion
      ? 'shadow-[0_0_0_1px_var(--turn-active)]'
      : 'anim-turn-active'
    : 'bg-[#0C121D]/95 hover:bg-[#111927]';

  const startLongPress = () => {
    if (!onInspect) return;
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onInspect();
    }, 420);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleRowClick = () => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (canTarget && onSelect) {
      onSelect();
    } else if (onInspect) {
      onInspect();
    }
  };

  const isClickable = (canTarget && Boolean(onSelect)) || Boolean(onInspect);
  const roleLabel = unit.archetype
    ? getArchetypeLabel(lang, unit.archetype)
    : getClassName(lang, unit.classId);

  return (
    <div
      ref={cardRef}
      data-testid={`unit-row-${unit.id}`}
      data-unit-id={unit.id}
      data-unit-collapsed="false"
      data-acting={isActiveTurn ? 'true' : 'false'}
      data-targeted={isTargeted ? 'true' : 'false'}
      data-reduced-motion={resolvedReducedMotion ? 'true' : 'false'}
      data-stage-fx-role={stageFxRole ?? undefined}
      data-stage-fx-id={stageFxKey ?? undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleRowClick : undefined}
      onKeyDown={
        isClickable
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick();
              }
            }
          : undefined
      }
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      style={rowStyle}
      className={`relative w-full min-w-0 overflow-hidden rounded-lg border px-2 py-1 flex flex-col gap-1 transition-colors select-none ${rowClass} ${
        isClickable ? 'cursor-pointer' : ''
      } ${isStealthed ? 'border-dashed opacity-75' : ''} ${
        frontBlocked ? 'opacity-65' : ''
      } ${getAnimClass(unit, skipCardMotion)}`}
    >
      {/* Action Stage card highlight: attacker glows ~0.6s, target border flashes in tone color ~0.6s */}
      {!skipAnimations && stageFxRole && stageFxKey && (
        <span
          key={`stage-fx-${stageFxKey}-${stageFxRole}`}
          data-testid={`card-stage-fx-${stageFxRole}-${unit.id}`}
          data-fx-id={stageFxKey}
          data-fx-tone-color={stageFxColor ?? undefined}
          className={`pointer-events-none absolute inset-0 rounded-lg z-10 ${
            stageFxRole === 'attacker'
              ? 'anim-stage-card-glow border border-amber-300/80'
              : 'anim-stage-card-flash border-2'
          }`}
          style={
            stageFxRole === 'target' && stageFxColor
              ? {
                  borderColor: stageFxColor,
                  boxShadow: `0 0 12px ${stageFxColor}, inset 0 0 8px ${stageFxColor}40`,
                }
              : undefined
          }
        />
      )}

      {/* Queued perimeter-to-center floating popups strictly clipped & contained inside this card */}
      {!skipAnimations &&
        fxSettings.effectsMode !== 'off' &&
        popupQueue.active.length > 0 && (
          <div
            data-testid={`card-popups-container-${unit.id}`}
            className="pointer-events-none absolute inset-0 overflow-hidden z-20"
          >
            {popupQueue.active.map((item) => {
              const pop = item.popup;
              const sp = item.startPoint;
              const isSmall =
                isCompactPopupTone(pop.tone) && !isSpPopupText(pop.text);
              const display = parseCardPopupDisplay(pop);
              const arrow = display.arrow;
              const iconPx = isSmall ? 12 : pop.tone === 'crit' ? 15 : 14;
              const colorClass = getPopupColor(pop.tone, pop.text);
              const sizeClass = isSmall ? 'text-[12px]' : 'text-[15px]';
              const innerContent = (
                <>
                  {arrow === 'up' && <span aria-hidden="true">↑</span>}
                  {arrow === 'down' && <span aria-hidden="true">↓</span>}
                  {display.segments.map((seg, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-0.5 ${
                        seg.colorClass ?? ''
                      }`}
                    >
                      {seg.iconKind && (
                        <span
                          data-testid="card-popup-icon"
                          data-popup-icon-kind={seg.iconKind}
                          className="material-symbols-outlined leading-none select-none shrink-0"
                          style={{ fontSize: `${iconPx}px` }}
                          aria-hidden="true"
                        >
                          {getCardPopupSymbol(seg.iconKind, iconMods)}
                        </span>
                      )}
                      <span>{seg.text}</span>
                    </span>
                  ))}
                </>
              );

              if (resolvedReducedMotion) {
                return (
                  <div
                    key={pop.id}
                    data-testid="damage-popup"
                    data-popup-compact={isSmall ? 'true' : 'false'}
                    data-popup-edge={sp.edge}
                    style={{
                      left: '50%',
                      top: '50%',
                      maxWidth: 'calc(100% - 16px)',
                      animationDuration: '600ms',
                    }}
                    className={`pointer-events-none absolute inline-flex items-center gap-0.5 whitespace-nowrap overflow-visible font-display font-bold tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] anim-card-popup-reduced ${sizeClass} ${colorClass}`}
                  >
                    {innerContent}
                  </div>
                );
              }

              const ep = item.endPoint;
              const flightStyle = {
                left: '50%',
                top: '50%',
                maxWidth: 'calc(100% - 16px)',
                '--card-pop-dx': `${sp.offsetFromCenterX}px`,
                '--card-pop-dy': `${sp.offsetFromCenterY}px`,
                '--card-pop-ex': `${ep.offsetFromCenterX}px`,
                '--card-pop-ey': `${ep.offsetFromCenterY}px`,
                animationDuration: `${cardPopupCfg.flightMs}ms`,
              } as CSSProperties;

              return (
                <div
                  key={pop.id}
                  data-testid="damage-popup"
                  data-popup-compact={isSmall ? 'true' : 'false'}
                  data-popup-edge={sp.edge}
                  data-popup-start-x={Math.round(sp.x)}
                  data-popup-start-y={Math.round(sp.y)}
                  data-popup-end-x={Math.round(ep.x)}
                  data-popup-end-y={Math.round(ep.y)}
                  style={flightStyle}
                  className={`pointer-events-none absolute whitespace-nowrap overflow-visible font-display font-bold tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] anim-card-popup-flight ${sizeClass} ${colorClass}`}
                >
                  <span
                    style={{
                      animationDelay: `${cardPopupCfg.flightMs}ms`,
                      animationDuration: `${CARD_POPUP_SETTLE_MS}ms`,
                    }}
                    className="inline-flex items-center gap-0.5 anim-card-popup-pop-fade"
                  >
                    {innerContent}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      <div className="flex items-center gap-2 min-w-0">
        {/* 1. Role / Team Shape Icon */}
        <div className="relative shrink-0">
          <RoleBadgeSvg
            classId={unit.classId}
            side={unit.side}
            isPlayer={unit.isPlayer}
            isBoss={unit.isBoss}
            color={teamVars.accent}
          />
          {frontBlocked && (
            <span
              data-testid={`unit-row-lock-${unit.id}`}
              title={t('radar.invalidFrontAlive')}
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#070B12] border border-amber-400 flex items-center justify-center"
            >
              <Lock className="w-2.5 h-2.5 text-amber-300" />
            </span>
          )}
        </div>

        {/* 2. Short Name + Class & Level */}
        <div className="w-[96px] xl:w-[116px] shrink-0 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            {unit.isBoss && (
              <Skull
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: 'var(--team-boss)' }}
              />
            )}
            <span
              title={unit.name}
              style={{
                color: isActiveTurn ? 'var(--turn-active-text)' : teamVars.accent,
              }}
              className="text-[13px] font-bold leading-tight whitespace-nowrap truncate"
            >
              {shortName}
            </span>
            {isTargeted && (
              <Crosshair
                className={`w-3.5 h-3.5 shrink-0 ${
                  isEnemy ? 'text-red-400' : 'text-emerald-400'
                }`}
                aria-hidden="true"
              />
            )}
            {unit.isPlayer && autoActive && (
              <span className="text-[11px] font-mono-nums font-bold text-emerald-300 shrink-0">
                {t('auto.badge')}
              </span>
            )}
          </div>
          <div className="text-[12px] text-slate-400 font-mono-nums leading-tight truncate">
            {roleLabel} · {t('common.levelShort')}
            {unit.level}
          </div>
        </div>

        {/* 3. Fixed-Width Tabular HP Bar + Shield & SP Bars (zero layout shift via scaleX) */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* HP line */}
          <div className="flex items-center gap-1 min-w-0">
            <div className="flex-1 min-w-[20px] h-2 rounded-full bg-slate-900 border border-slate-800/90 overflow-hidden">
              <div
                className={`h-full w-full ${hpBarColor}`}
                style={{
                  transform: `scaleX(${hpRatio})`,
                  transformOrigin: 'left center',
                }}
              />
            </div>
            <span className="w-[58px] text-right font-mono-nums text-[12px] font-semibold text-slate-200 shrink-0">
              {unit.hp}/{unit.derived.maxHp}
            </span>
          </div>

          {/* Shield + SP compact dual bars */}
          <div className="grid grid-cols-2 gap-1 items-center min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <div className="flex-1 min-w-[14px] h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className={`h-full w-full ${
                    shieldBroken ? 'bg-red-500/60' : 'bg-sky-400'
                  }`}
                  style={{
                    transform: `scaleX(${
                      unit.derived.maxShield > 0 ? shdRatio : 0
                    })`,
                    transformOrigin: 'left center',
                  }}
                />
              </div>
              <span
                className={`w-[28px] text-right font-mono-nums text-[12px] shrink-0 ${
                  shieldBroken ? 'text-red-300 line-through' : 'text-sky-300'
                }`}
              >
                {unit.shield}
              </span>
            </div>

            <div className="flex items-center gap-1 min-w-0">
              <div className="flex-1 min-w-[14px] h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div
                  data-testid={`unit-row-sp-fill-${unit.id}`}
                  className={`h-full w-full ${SP_COLOR_TOKENS.barFillClass}`}
                  style={{
                    transform: `scaleX(${unit.derived.maxSp > 0 ? spRatio : 0})`,
                    transformOrigin: 'left center',
                  }}
                />
              </div>
              <span
                data-testid={`unit-row-sp-value-${unit.id}`}
                className={`w-[24px] text-right font-mono-nums text-[12px] shrink-0 ${SP_COLOR_TOKENS.textClass}`}
              >
                {unit.sp}
              </span>
            </div>
          </div>
        </div>

        {/* 4. >=44px Info Button */}
        <div className="shrink-0 flex items-center gap-1">
          {onInspect && (
            <button
              type="button"
              data-testid={`unit-row-info-${unit.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onInspect();
              }}
              aria-label={t('battle.inspectUnit')}
              title={t('battle.inspectUnit')}
              className="min-w-[44px] min-h-[44px] rounded-md border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-sky-300 inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Status Area (omitted when statusRows === 0) */}
      {effectiveStatusRows > 0 && (
        <FixedStatusArea
          statuses={unit.statuses}
          rows={effectiveStatusRows}
          unit={unit}
          unitTitle={unit.name}
          badgeLayout={statusSettings.badgeLayout}
          iconMods={iconMods}
          showLabels={showStatusLabels}
          fallbackWidthPx={CARD_STATUS_FALLBACK_WIDTH_PX}
          scrollOnOverflow={statusRows !== undefined}
          showOverflowMarkInScroll={statusRows !== undefined}
          rootTestId={`card-status-row-${unit.id}`}
          chipTestIdPrefix={`card-status-chip-${unit.id}`}
          labelTestIdPrefix={`card-status-label-${unit.id}`}
          overflowTestId={`card-status-overflow-${unit.id}`}
        />
      )}
    </div>
  );
});
