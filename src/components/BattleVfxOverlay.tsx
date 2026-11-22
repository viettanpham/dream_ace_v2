import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type {
  BattleSpeed,
  BattleState,
  CombatFxEvent,
  CombatSide,
  CombatUnit,
} from '../types/game';
import {
  computeDefeatFadeDurationMs,
  computeHitFlashDurationMs,
  computeRadarFxDurationMs,
  type PopupAnchorPoint,
} from '../utils/battleDisplay';
import {
  completeUnitEffect,
  computeVfxDurationMs,
  createUnitEffectQueue,
  deriveStatusVfxFromDelta,
  enqueueUnitEffect,
  MAX_SIMULTANEOUS_EFFECTS_PER_UNIT,
  resolveFxWeaponStyle,
  resolveTargetAttackOutcome,
  type EffectiveVfxConfig,
  type QueuedUnitVfx,
  type UnitEffectQueueState,
} from '../utils/battleVfx';

export interface ManualAimLineSpec {
  fromId: string;
  toId: string;
  isAllySupport: boolean;
}

export interface RowSlideEffect {
  id: string;
  unitId: string;
  side: CombatSide;
  fromPos: PopupAnchorPoint;
  toPos: PopupAnchorPoint;
  durationMs: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OverlayPoint {
  x: number;
  y: number;
  xPct: number;
  yPct: number;
  leftCss: string;
  topCss: string;
  usedFallback: boolean;
}

interface BattleVfxOverlayProps {
  battle: BattleState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  markerElementsRef: React.RefObject<Map<string, SVGGElement>>;
  svgPosMap: Map<string, PopupAnchorPoint>;
  vw: number;
  vh: number;
  battleSpeed: BattleSpeed;
  vfxConfig: EffectiveVfxConfig;
  playerWeaponId?: string | null;
  manualAimLine: ManualAimLineSpec | null;
  hitFlashUnitIds: Set<string>;
  defeatFadingUnitIds: Set<string>;
  rowSlides?: RowSlideEffect[];
  renderedPopupCount?: number;
  effectsDebugEnabled?: boolean;
  osReducedMotion?: boolean;
  autoReducedNoticeVisible?: boolean;
}

function isFinitePositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isValidRect(rect: RectLike | null | undefined): rect is RectLike {
  return Boolean(
    rect &&
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.top) &&
      isFinitePositive(rect.width) &&
      isFinitePositive(rect.height)
  );
}

/**
 * Projects a radar SVG layout point into overlay coordinates relative to the radar container.
 * Uses xMidYMid meet pixel projection when the container has a real non-zero box, and falls back
 * to proportional container percentages when container measurement is 0 or invalid.
 */
export function resolveSvgPointInOverlay(
  svgPos: PopupAnchorPoint | null | undefined,
  containerRect: RectLike | null | undefined,
  vw: number,
  vh: number
): OverlayPoint | null {
  if (
    !svgPos ||
    !Number.isFinite(svgPos.x) ||
    !Number.isFinite(svgPos.y)
  ) {
    return null;
  }
  const safeVw = isFinitePositive(vw) ? vw : 720;
  const safeVh = isFinitePositive(vh) ? vh : 420;

  if (isValidRect(containerRect)) {
    const scale = Math.min(
      containerRect.width / safeVw,
      containerRect.height / safeVh
    );
    const renderedW = safeVw * scale;
    const renderedH = safeVh * scale;
    const offsetX = (containerRect.width - renderedW) / 2;
    const offsetY = (containerRect.height - renderedH) / 2;
    const x = offsetX + svgPos.x * scale;
    const y = offsetY + svgPos.y * scale;
    const xPct = Math.max(0, Math.min(100, (x / containerRect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (y / containerRect.height) * 100));
    return {
      x,
      y,
      xPct,
      yPct,
      leftCss: `${x.toFixed(1)}px`,
      topCss: `${y.toFixed(1)}px`,
      usedFallback: true,
    };
  }

  // Container bounding rect is 0 or unavailable (e.g. pre-layout or JSDOM):
  // use proportional percentage of the radar container derived from radar layout.
  const xPct = Math.max(0, Math.min(100, (svgPos.x / safeVw) * 100));
  const yPct = Math.max(0, Math.min(100, (svgPos.y / safeVh) * 100));
  return {
    x: svgPos.x,
    y: svgPos.y,
    xPct,
    yPct,
    leftCss: `${xPct.toFixed(2)}%`,
    topCss: `${yPct.toFixed(2)}%`,
    usedFallback: true,
  };
}

/**
 * Resolves a unit's center in container-relative coordinates.
 * Prefers a valid measured bounding rect inside the radar container, and falls back to
 * proportional radar-layout coordinates whenever the measured box is 0, NaN, or out of bounds.
 */
export function resolveOverlayUnitPoint(
  unitId: string,
  containerRect: RectLike | null | undefined,
  markerRect: RectLike | null | undefined,
  svgPosMap: Map<string, PopupAnchorPoint>,
  vw: number,
  vh: number
): OverlayPoint | null {
  if (isValidRect(containerRect) && isValidRect(markerRect)) {
    const x = markerRect.left - containerRect.left + markerRect.width / 2;
    const y = markerRect.top - containerRect.top + markerRect.height / 2;
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x > 0 &&
      y > 0 &&
      x < containerRect.width &&
      y < containerRect.height
    ) {
      const xPct = (x / containerRect.width) * 100;
      const yPct = (y / containerRect.height) * 100;
      return {
        x,
        y,
        xPct,
        yPct,
        leftCss: `${x.toFixed(1)}px`,
        topCss: `${y.toFixed(1)}px`,
        usedFallback: false,
      };
    }
  }

  return resolveSvgPointInOverlay(svgPosMap.get(unitId), containerRect, vw, vh);
}

function measureUnitCenter(
  unitId: string,
  containerEl: HTMLDivElement | null,
  markerMap: Map<string, SVGGElement> | null,
  svgPosMap: Map<string, PopupAnchorPoint>,
  vw: number,
  vh: number
): OverlayPoint | null {
  const cRect = containerEl?.getBoundingClientRect() ?? null;
  const markerEl = markerMap?.get(unitId) ?? null;
  // Measure the ring-centered hit-area rect inside the marker so nameplates/status icons
  // below the marker do not skew the vertical center.
  const hitEl = markerEl?.querySelector<Element>(
    `[data-testid="radar-hit-area-${unitId}"]`
  );
  const mRect = (hitEl ?? markerEl)?.getBoundingClientRect() ?? null;
  return resolveOverlayUnitPoint(unitId, cRect, mRect, svgPosMap, vw, vh);
}

function resolveFxActorAndTargets(
  fx: CombatFxEvent,
  battle: BattleState
): { actor?: CombatUnit; targetIds: string[] } {
  const fromSideUnits = battle.units.filter((u) => u.side === fx.fromSide);
  const actor =
    (fx.fromUnitId
      ? battle.units.find((u) => u.id === fx.fromUnitId)
      : undefined) ?? fromSideUnits[fx.fromSlotIndex];

  const toSideUnits = battle.units.filter((u) => u.side === fx.toSide);
  const targetIds: string[] = [];

  if (fx.toUnitIds && fx.toUnitIds.length > 0) {
    for (const id of fx.toUnitIds) {
      if (id && !targetIds.includes(id)) targetIds.push(id);
    }
  } else {
    for (const slotIdx of fx.toSlotIndices) {
      const target = toSideUnits[slotIdx];
      if (target && !targetIds.includes(target.id)) {
        targetIds.push(target.id);
      }
    }
  }

  return { actor, targetIds };
}

function getTeamPalette(side: CombatSide): {
  primary: string;
  core: string;
  glow: string;
  border: string;
} {
  if (side === 'ally') {
    return {
      primary: '#38bdf8',
      core: '#e0f2fe',
      glow: 'rgba(56, 189, 248, 0.45)',
      border: '#7dd3fc',
    };
  }
  return {
    primary: '#f97316',
    core: '#ffedd5',
    glow: 'rgba(249, 115, 22, 0.48)',
    border: '#fb923c',
  };
}

/**
 * Firefox-safe HTML overlay rendering ALL animated battle visual effects inside the radar container:
 * - Uses ONLY absolutely positioned HTML elements with transform: translate3d/rotate/scale and opacity.
 * - Zero animated SVG transforms, zero transform-box, zero offset-path, zero SVG SMIL.
 * - Computes positions relative to the radar container and falls back to proportional radar-layout
 *   positions if bounding-box measurement is 0 or invalid instead of skipping the effect.
 * - Enforces max 2 simultaneous status effects per unit with FIFO queuing.
 */
export function BattleVfxOverlay({
  battle,
  containerRef,
  markerElementsRef,
  svgPosMap,
  vw,
  vh,
  battleSpeed,
  vfxConfig,
  playerWeaponId = null,
  manualAimLine,
  hitFlashUnitIds,
  defeatFadingUnitIds,
  rowSlides = [],
  renderedPopupCount = 0,
  effectsDebugEnabled = false,
  osReducedMotion = false,
  autoReducedNoticeVisible = false,
}: BattleVfxOverlayProps) {
  const [unitQueue, setUnitQueue] = useState<UnitEffectQueueState<QueuedUnitVfx>>(
    () => createUnitEffectQueue<QueuedUnitVfx>()
  );
  const [layoutTick, setLayoutTick] = useState(0);

  const prevEventCountRef = useRef<number>(battle.events.length);
  const prevUnitsRef = useRef<CombatUnit[]>(battle.units);
  const activeTimersRef = useRef<Map<string, number>>(new Map());
  const fxPointSnapshotRef = useRef<
    Map<
      string,
      { from: OverlayPoint; targets: Record<string, OverlayPoint>; usedFallback: boolean }
    >
  >(new Map());
  const seenCreatedIdsRef = useRef<Set<string>>(new Set());
  const lastTurnCounterRef = useRef<number>(battle.turnCounter);

  // Re-measure overlay coordinates cleanly on window resize and container ResizeObserver updates
  useEffect(() => {
    const onResize = () => setLayoutTick((n) => n + 1);
    window.addEventListener('resize', onResize);

    let observer: ResizeObserver | null = null;
    if (
      typeof ResizeObserver !== 'undefined' &&
      containerRef.current
    ) {
      observer = new ResizeObserver(() => {
        setLayoutTick((n) => n + 1);
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [containerRef]);

  // Cleanup active timers on unmount
  useEffect(() => {
    return () => {
      activeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      activeTimersRef.current.clear();
    };
  }, []);

  // Reset debug seen-ID tracker when a brand-new battle begins
  if (battle.turnCounter < lastTurnCounterRef.current) {
    seenCreatedIdsRef.current.clear();
  }
  lastTurnCounterRef.current = battle.turnCounter;

  // Derive status effects from newly appended battle events & unit state transitions
  useEffect(() => {
    const prevCount = prevEventCountRef.current;
    const prevUnits = prevUnitsRef.current;

    const newEvents =
      battle.events.length > prevCount
        ? battle.events.slice(prevCount)
        : battle.events.length < prevCount && battle.turnCounter <= 1
        ? battle.events
        : [];

    prevEventCountRef.current = battle.events.length;
    prevUnitsRef.current = battle.units;

    if (
      !vfxConfig.showStatusEffects ||
      vfxConfig.animationsSkipped ||
      (newEvents.length === 0 && prevUnits === battle.units)
    ) {
      return;
    }

    const derived = deriveStatusVfxFromDelta(
      newEvents,
      prevUnits,
      battle.units,
      battleSpeed,
      Date.now()
    );

    if (derived.length === 0) return;

    setUnitQueue((prev) => {
      let next = prev;
      for (const item of derived) {
        next = enqueueUnitEffect(
          next,
          item.unitId,
          item,
          MAX_SIMULTANEOUS_EFFECTS_PER_UNIT
        );
      }
      return next;
    });
  }, [
    battle.events,
    battle.units,
    battle.turnCounter,
    battleSpeed,
    vfxConfig.showStatusEffects,
    vfxConfig.animationsSkipped,
  ]);

  // Clear queued status effects immediately if effects are turned off or reduced motion activates
  useEffect(() => {
    if (!vfxConfig.showStatusEffects || vfxConfig.animationsSkipped) {
      activeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      activeTimersRef.current.clear();
      setUnitQueue(createUnitEffectQueue<QueuedUnitVfx>());
    }
  }, [vfxConfig.showStatusEffects, vfxConfig.animationsSkipped]);

  // Schedule auto-completion timers for currently active per-unit effects
  useEffect(() => {
    const activeIds = new Set<string>();
    Object.entries(unitQueue.activeByUnit).forEach(([unitId, list]) => {
      for (const fx of list) {
        activeIds.add(fx.id);
        if (!activeTimersRef.current.has(fx.id)) {
          const timerId = window.setTimeout(() => {
            activeTimersRef.current.delete(fx.id);
            setUnitQueue((cur) =>
              completeUnitEffect(
                cur,
                unitId,
                fx.id,
                MAX_SIMULTANEOUS_EFFECTS_PER_UNIT
              )
            );
          }, fx.durationMs + 40);
          activeTimersRef.current.set(fx.id, timerId);
        }
      }
    });

    activeTimersRef.current.forEach((timerId, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(timerId);
        activeTimersRef.current.delete(id);
      }
    });
  }, [unitQueue]);

  // Capture container-relative positions (with proportional fallback) for active CombatFxEvents
  const fxRenderItems = useMemo(() => {
    void layoutTick;
    if (
      vfxConfig.animationsSkipped ||
      (!vfxConfig.showProjectiles && !vfxConfig.showMainImpactOrHeal)
    ) {
      return [];
    }

    const activeFxIds = new Set(battle.fxEvents.map((f) => f.id));
    fxPointSnapshotRef.current.forEach((_, key) => {
      if (!activeFxIds.has(key)) fxPointSnapshotRef.current.delete(key);
    });

    const recentEvents = battle.events.slice(-16);

    return battle.fxEvents.map((fx) => {
      const { actor, targetIds } = resolveFxActorAndTargets(fx, battle);
      let snap = fxPointSnapshotRef.current.get(fx.id);

      // Re-measure if no snapshot yet OR if the cached snapshot was a pre-layout fallback
      if (!snap || snap.usedFallback) {
        const fromPt = actor
          ? measureUnitCenter(
              actor.id,
              containerRef.current,
              markerElementsRef.current,
              svgPosMap,
              vw,
              vh
            )
          : null;
        const targetPts: Record<string, OverlayPoint> = {};
        let anyFallback = Boolean(fromPt?.usedFallback);
        for (const tid of targetIds) {
          const pt = measureUnitCenter(
            tid,
            containerRef.current,
            markerElementsRef.current,
            svgPosMap,
            vw,
            vh
          );
          if (pt) {
            targetPts[tid] = pt;
            if (pt.usedFallback) anyFallback = true;
          }
        }
        if (fromPt) {
          snap = { from: fromPt, targets: targetPts, usedFallback: anyFallback };
          // Only lock the snapshot once real non-fallback measurements are available
          if (!anyFallback) {
            fxPointSnapshotRef.current.set(fx.id, snap);
          }
        }
      }

      const weaponStyle = resolveFxWeaponStyle(
        fx,
        actor,
        targetIds.length,
        recentEvents,
        playerWeaponId
      );

      // Keep radar-fx duration aligned with computeRadarFxDurationMs for speed scaling consistency
      const durationMs = computeRadarFxDurationMs(fx.kind, battleSpeed);
      const vfxDurationMs = computeVfxDurationMs(weaponStyle, battleSpeed);

      return {
        fx,
        actor,
        targetIds,
        snap: snap ?? null,
        weaponStyle,
        durationMs,
        vfxDurationMs,
        recentEvents,
      };
    });
  }, [
    battle,
    battleSpeed,
    containerRef,
    markerElementsRef,
    svgPosMap,
    vw,
    vh,
    playerWeaponId,
    vfxConfig,
    layoutTick,
  ]);

  // Measure Manual-only thin targeting line from live bounding boxes (or proportional fallback)
  const manualAimGeometry = useMemo(() => {
    void layoutTick;
    if (!manualAimLine) return null;
    const from = measureUnitCenter(
      manualAimLine.fromId,
      containerRef.current,
      markerElementsRef.current,
      svgPosMap,
      vw,
      vh
    );
    const to = measureUnitCenter(
      manualAimLine.toId,
      containerRef.current,
      markerElementsRef.current,
      svgPosMap,
      vw,
      vh
    );
    if (!from || !to) return null;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const pad = 22;
    if (dist <= pad * 2 + 4) return null;

    const ux = dx / dist;
    const uy = dy / dist;
    const length = dist - pad * 2;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    return {
      ...manualAimLine,
      leftCss: from.leftCss,
      topCss: from.topCss,
      offsetX: ux * pad,
      offsetY: uy * pad,
      length,
      angleDeg,
    };
  }, [manualAimLine, containerRef, markerElementsRef, svgPosMap, vw, vh, layoutTick]);

  const hitFlashDurationMs = computeHitFlashDurationMs(battleSpeed);
  const defeatFadeDurationMs = computeDefeatFadeDurationMs(battleSpeed);

  const unitCenter = (unitId: string): OverlayPoint | null =>
    measureUnitCenter(
      unitId,
      containerRef.current,
      markerElementsRef.current,
      svgPosMap,
      vw,
      vh
    );

  const activeStatusEffects = Object.values(unitQueue.activeByUnit).flat();

  // Compute Effects Debug counts synchronously (created / active / rendered)
  for (const fx of battle.fxEvents) seenCreatedIdsRef.current.add(`fx:${fx.id}`);
  for (const pop of battle.popups) seenCreatedIdsRef.current.add(`pop:${pop.id}`);
  for (const st of activeStatusEffects) seenCreatedIdsRef.current.add(`st:${st.id}`);
  for (const sl of rowSlides) seenCreatedIdsRef.current.add(`slide:${sl.id}`);

  const debugCreatedCount = seenCreatedIdsRef.current.size;
  const debugActiveCount =
    battle.fxEvents.length +
    battle.popups.length +
    activeStatusEffects.length +
    rowSlides.length;

  const renderedFxCount = fxRenderItems.filter(
    (item) =>
      item.snap &&
      item.targetIds.some((tid) => Boolean(item.snap?.targets[tid]))
  ).length;
  const renderedStatusCount = vfxConfig.showStatusEffects
    ? activeStatusEffects.filter((st) => Boolean(unitCenter(st.unitId))).length
    : 0;
  const renderedSlideCount =
    !vfxConfig.animationsSkipped && !vfxConfig.reducedMotion ? rowSlides.length : 0;
  const debugRenderedCount =
    renderedFxCount +
    renderedPopupCount +
    renderedStatusCount +
    renderedSlideCount;

  const containerRectNow = containerRef.current?.getBoundingClientRect() ?? null;
  const showDebugLine = effectsDebugEnabled || autoReducedNoticeVisible;

  return (
    <div
      data-testid="radar-vfx-overlay"
      data-effects-mode={vfxConfig.mode}
      data-reduced-motion={vfxConfig.reducedMotion ? 'true' : 'false'}
      data-particles-enabled={vfxConfig.showDecorativeParticles ? 'true' : 'false'}
      className="pointer-events-none absolute inset-0 overflow-hidden z-20"
    >
      {/* Shown when "Effects debug" is ON, or automatically for 3s at battle start when reduced motion resolves to true */}
      {showDebugLine && (
        <div
          data-testid="radar-effects-debug-counter"
          data-created={debugCreatedCount}
          data-active={debugActiveCount}
          data-rendered={debugRenderedCount}
          data-mode={vfxConfig.mode}
          data-reduced-resolved={vfxConfig.reducedMotion ? 'true' : 'false'}
          data-reduced-os={osReducedMotion ? 'true' : 'false'}
          data-speed={battleSpeed}
          data-auto-notice={autoReducedNoticeVisible ? 'true' : 'false'}
          className="pointer-events-none absolute top-1.5 left-1.5 z-30 max-w-[88%] rounded border border-amber-400/70 bg-[#050a12]/92 px-2 py-0.5 font-mono-nums text-[11px] font-semibold text-amber-200 shadow truncate"
        >
          FX {vfxConfig.mode} · RM:{vfxConfig.reducedMotion ? 'ON' : 'OFF'}(OS:
          {osReducedMotion ? 'reduce' : 'no'}) · {battleSpeed}x ·{' '}
          {debugCreatedCount}/{debugActiveCount}/{debugRenderedCount}
        </div>
      )}

      {/* Pure HTML Ambient Radar Sweep (transform rotate only; no SVG transform) */}
      {vfxConfig.showAmbientSweep && (
        <div
          data-testid="radar-sweep-layer"
          className="vfx-html-sweep pointer-events-none absolute left-1/2 top-1/2 w-[140%] aspect-square rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(56, 189, 248, 0.14) 0deg, rgba(56, 189, 248, 0.03) 34deg, transparent 58deg, transparent 360deg)',
          }}
        />
      )}

      {/* Manual-Only Thin Targeting Line (shown ONLY during Manual target selection, never in Auto or during combat resolution) */}
      {manualAimGeometry && (
        <div
          data-testid="radar-target-arrow"
          data-from={manualAimGeometry.fromId}
          data-to={manualAimGeometry.toId}
          style={{
            position: 'absolute',
            left: manualAimGeometry.leftCss,
            top: manualAimGeometry.topCss,
            width: `${manualAimGeometry.length.toFixed(1)}px`,
            height: '2px',
            transformOrigin: '0% 50%',
            transform: `translate3d(${manualAimGeometry.offsetX.toFixed(
              1
            )}px, ${manualAimGeometry.offsetY.toFixed(1)}px, 0) rotate(${manualAimGeometry.angleDeg.toFixed(
              2
            )}deg)`,
            background: manualAimGeometry.isAllySupport
              ? 'linear-gradient(90deg, rgba(52,211,153,0.18), rgba(52,211,153,0.78))'
              : 'linear-gradient(90deg, rgba(248,113,113,0.18), rgba(248,113,113,0.78))',
          }}
        >
          {/* Small directional tip */}
          <span
            style={{
              position: 'absolute',
              right: '-1px',
              top: '-3px',
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderLeft: `7px solid ${
                manualAimGeometry.isAllySupport ? '#34d399' : '#f87171'
              }`,
            }}
          />
        </div>
      )}

      {/* Short compositor-only slide animation when the engine moves a unit to another row (skipped in reduced motion) */}
      {!vfxConfig.animationsSkipped &&
        !vfxConfig.reducedMotion &&
        rowSlides.map((slide) => {
          const fromPt = resolveSvgPointInOverlay(
            slide.fromPos,
            containerRectNow,
            vw,
            vh
          );
          const toPt = resolveSvgPointInOverlay(
            slide.toPos,
            containerRectNow,
            vw,
            vh
          );
          if (!fromPt || !toPt) return null;
          const dx = toPt.x - fromPt.x;
          const dy = toPt.y - fromPt.y;
          const palette = getTeamPalette(slide.side);
          return (
            <div
              key={slide.id}
              data-testid={`vfx-row-slide-${slide.unitId}`}
              className="vfx-row-slide absolute rounded-full"
              style={
                {
                  left: fromPt.leftCss,
                  top: fromPt.topCss,
                  width: '32px',
                  height: '32px',
                  marginLeft: '-16px',
                  marginTop: '-16px',
                  border: `2px solid ${palette.primary}`,
                  backgroundColor: palette.glow,
                  '--dx': `${dx.toFixed(1)}px`,
                  '--dy': `${dy.toFixed(1)}px`,
                  '--vfx-dur': `${slide.durationMs}ms`,
                } as CSSProperties
              }
            />
          );
        })}

      {/* Weapon Attack Visual Effects (HTML translate3d + opacity only) */}
      {fxRenderItems.map(
        ({
          fx,
          targetIds,
          snap,
          weaponStyle,
          durationMs,
          vfxDurationMs,
          recentEvents,
        }) => {
          if (!snap) return null;
          const palette = getTeamPalette(fx.fromSide);
          const isAlly = fx.fromSide === 'ally';
          const isHealFx = fx.kind === 'heal';

          return (
            <div
              key={fx.id}
              data-testid={`radar-fx-${fx.id}`}
              data-fx-kind={fx.kind}
              data-weapon-vfx={isHealFx ? 'heal' : weaponStyle}
              data-fx-duration={durationMs}
              data-used-fallback={snap.usedFallback ? 'true' : 'false'}
              data-reduced-marker={vfxConfig.reducedMotion ? 'true' : 'false'}
              className="pointer-events-none absolute inset-0"
            >
              {targetIds.map((targetId, tIdx) => {
                const to = snap.targets[targetId];
                if (!to) return null;
                const from = snap.from;
                const targetUnit = battle.units.find((u) => u.id === targetId);
                const { outcome, isSplash } = resolveTargetAttackOutcome(
                  targetId,
                  recentEvents,
                  targetUnit
                );

                // Heal beam/ring FX
                if (isHealFx) {
                  return (
                    <div
                      key={targetId}
                      data-testid={`vfx-heal-ring-${targetId}`}
                      className="vfx-ring-expand absolute rounded-full"
                      style={
                        {
                          left: to.leftCss,
                          top: to.topCss,
                          width: '44px',
                          height: '44px',
                          marginLeft: '-22px',
                          marginTop: '-22px',
                          border: '2px solid #34d399',
                          boxShadow: '0 0 10px rgba(52, 211, 153, 0.45)',
                          '--vfx-dur': `${vfxDurationMs}ms`,
                        } as CSSProperties
                      }
                    />
                  );
                }

                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const dist = Math.max(12, Math.hypot(dx, dy));
                const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

                // Relative travel vector from `from` (overshoot slightly on dodge)
                const relEndX = outcome === 'dodge' ? dx * 1.18 : dx;
                const relEndY = outcome === 'dodge' ? dy * 1.18 : dy;

                // Curve control waypoints relative to `from` for missiles (pure translate3d, zero offset-path)
                const curveSign = isAlly ? -1 : 1;
                const nx = -dy / dist;
                const ny = dx / dist;
                const arcHeight = Math.min(46, Math.max(18, dist * 0.16)) * curveSign;
                const relMx1 = relEndX * 0.36 + nx * arcHeight;
                const relMy1 = relEndY * 0.36 + ny * arcHeight;
                const relMx2 = relEndX * 0.72 + nx * (arcHeight * 0.65);
                const relMy2 = relEndY * 0.72 + ny * (arcHeight * 0.65);
                const ang1 = (Math.atan2(relMy1, relMx1) * 180) / Math.PI;
                const ang2 =
                  (Math.atan2(relMy2 - relMy1, relMx2 - relMx1) * 180) / Math.PI;
                const ang3 =
                  (Math.atan2(relEndY - relMy2, relEndX - relMx2) * 180) / Math.PI;

                // Proportional smoke puff anchor positions
                const puff1LeftCss = from.usedFallback
                  ? `${(from.xPct + (to.xPct - from.xPct) * 0.36).toFixed(2)}%`
                  : `${(from.x + relMx1).toFixed(1)}px`;
                const puff1TopCss = from.usedFallback
                  ? `${(from.yPct + (to.yPct - from.yPct) * 0.36).toFixed(2)}%`
                  : `${(from.y + relMy1).toFixed(1)}px`;
                const puff2LeftCss = from.usedFallback
                  ? `${(from.xPct + (to.xPct - from.xPct) * 0.72).toFixed(2)}%`
                  : `${(from.x + relMx2).toFixed(1)}px`;
                const puff2TopCss = from.usedFallback
                  ? `${(from.yPct + (to.yPct - from.yPct) * 0.72).toFixed(2)}%`
                  : `${(from.y + relMy2).toFixed(1)}px`;

                const impactDelayMs = Math.round(vfxDurationMs * 0.48);
                const impactDurMs = Math.max(110, Math.round(vfxDurationMs * 0.68));
                const isSecondaryAreaHit =
                  weaponStyle === 'area' && (isSplash || tIdx > 0);

                return (
                  <div key={targetId} className="absolute inset-0">
                    {/* 1) PROJECTILE OR BEAM (fade-only static instant line/marker under reduced motion) */}
                    {vfxConfig.showProjectiles &&
                      !isSecondaryAreaHit &&
                      (vfxConfig.reducedMotion ? (
                        <div
                          data-testid={
                            weaponStyle === 'beam'
                              ? `vfx-beam-${fx.id}-${targetId}`
                              : weaponStyle === 'missile'
                              ? `vfx-missile-${fx.id}-${targetId}`
                              : `vfx-cannon-${fx.id}-${targetId}`
                          }
                          data-reduced-marker="true"
                          className="vfx-reduced-marker absolute"
                          style={
                            {
                              left: from.leftCss,
                              top: from.topCss,
                              width: `${dist.toFixed(1)}px`,
                              height: weaponStyle === 'beam' ? '5px' : '3px',
                              marginTop: weaponStyle === 'beam' ? '-2.5px' : '-1.5px',
                              transformOrigin: '0% 50%',
                              transform: `rotate(${angleDeg.toFixed(2)}deg)`,
                              borderRadius: '9999px',
                              background: `linear-gradient(90deg, transparent 0%, ${palette.primary} 45%, ${palette.core} 100%)`,
                              '--vfx-dur': `${Math.max(160, Math.round(vfxDurationMs * 0.65))}ms`,
                            } as CSSProperties
                          }
                        />
                      ) : (
                        <>
                          {weaponStyle === 'beam' && (
                            <div
                              data-testid={`vfx-beam-${fx.id}-${targetId}`}
                              className="vfx-beam-fire absolute"
                              style={
                                {
                                  left: from.leftCss,
                                  top: from.topCss,
                                  width: `${dist.toFixed(1)}px`,
                                  height: isAlly ? '6px' : '8px',
                                  marginTop: isAlly ? '-3px' : '-4px',
                                  transformOrigin: '0% 50%',
                                  borderRadius: isAlly ? '9999px' : '2px',
                                  background: isAlly
                                    ? `linear-gradient(180deg, transparent, ${palette.primary}, #ffffff, ${palette.primary}, transparent)`
                                    : `repeating-linear-gradient(90deg, ${palette.primary} 0px, ${palette.core} 8px, #ef4444 14px)`,
                                  boxShadow: `0 0 10px ${palette.glow}`,
                                  '--ang': `${angleDeg.toFixed(2)}deg`,
                                  '--vfx-dur': `${vfxDurationMs}ms`,
                                } as CSSProperties
                              }
                            />
                          )}

                          {weaponStyle === 'missile' && (
                            <>
                              <div
                                data-testid={`vfx-missile-${fx.id}-${targetId}`}
                                className="vfx-missile-arc absolute"
                                style={
                                  {
                                    left: from.leftCss,
                                    top: from.topCss,
                                    width: '18px',
                                    height: '8px',
                                    marginLeft: '-9px',
                                    marginTop: '-4px',
                                    // Distinct team shapes: ally pointed nose, enemy notched diamond
                                    clipPath: isAlly
                                      ? 'polygon(0% 15%, 72% 0%, 100% 50%, 72% 100%, 0% 85%, 18% 50%)'
                                      : 'polygon(0% 50%, 28% 0%, 100% 25%, 82% 50%, 100% 75%, 28% 100%)',
                                    background: `linear-gradient(90deg, ${palette.primary}, ${palette.core})`,
                                    boxShadow: `0 0 8px ${palette.glow}`,
                                    '--mx1': `${relMx1.toFixed(1)}px`,
                                    '--my1': `${relMy1.toFixed(1)}px`,
                                    '--mx2': `${relMx2.toFixed(1)}px`,
                                    '--my2': `${relMy2.toFixed(1)}px`,
                                    '--dx': `${relEndX.toFixed(1)}px`,
                                    '--dy': `${relEndY.toFixed(1)}px`,
                                    '--ang1': `${ang1.toFixed(2)}deg`,
                                    '--ang2': `${ang2.toFixed(2)}deg`,
                                    '--ang3': `${ang3.toFixed(2)}deg`,
                                    '--vfx-dur': `${vfxDurationMs}ms`,
                                  } as CSSProperties
                                }
                              />
                              {/* Decorative smoke trail puffs (Full mode at x1..x3 only) */}
                              {vfxConfig.showDecorativeParticles &&
                                [
                                  {
                                    leftCss: puff1LeftCss,
                                    topCss: puff1TopCss,
                                    delay: Math.round(vfxDurationMs * 0.24),
                                  },
                                  {
                                    leftCss: puff2LeftCss,
                                    topCss: puff2TopCss,
                                    delay: Math.round(vfxDurationMs * 0.48),
                                  },
                                ].map((puff, pIdx) => (
                                  <span
                                    key={pIdx}
                                    data-testid={`vfx-particle-smoke-${fx.id}-${pIdx}`}
                                    className="vfx-smoke-puff absolute rounded-full"
                                    style={
                                      {
                                        left: puff.leftCss,
                                        top: puff.topCss,
                                        width: '9px',
                                        height: '9px',
                                        marginLeft: '-4.5px',
                                        marginTop: '-4.5px',
                                        backgroundColor: 'rgba(203, 213, 225, 0.55)',
                                        animationDelay: `${puff.delay}ms`,
                                        '--vfx-dur': `${Math.max(120, Math.round(vfxDurationMs * 0.65))}ms`,
                                      } as CSSProperties
                                    }
                                  />
                                ))}
                            </>
                          )}

                          {(weaponStyle === 'cannon' || weaponStyle === 'area') && (
                            <div
                              data-testid={`vfx-cannon-${fx.id}-${targetId}`}
                              className="vfx-cannon-fly absolute"
                              style={
                                {
                                  left: from.leftCss,
                                  top: from.topCss,
                                  width: weaponStyle === 'area' ? '22px' : '20px',
                                  height: weaponStyle === 'area' ? '7px' : '5px',
                                  marginLeft: '-10px',
                                  marginTop: '-2.5px',
                                  // Distinct team shape: ally tapered lance, enemy blocky bolt
                                  borderRadius: isAlly ? '2px 9999px 9999px 2px' : '1px',
                                  background: `linear-gradient(90deg, transparent 0%, ${palette.primary} 42%, ${palette.core} 100%)`,
                                  boxShadow: `0 0 8px ${palette.glow}`,
                                  '--dx1': `${(relEndX * 0.14).toFixed(1)}px`,
                                  '--dy1': `${(relEndY * 0.14).toFixed(1)}px`,
                                  '--dx2': `${(relEndX * 0.86).toFixed(1)}px`,
                                  '--dy2': `${(relEndY * 0.86).toFixed(1)}px`,
                                  '--dx': `${relEndX.toFixed(1)}px`,
                                  '--dy': `${relEndY.toFixed(1)}px`,
                                  '--ang': `${angleDeg.toFixed(2)}deg`,
                                  '--vfx-dur': `${vfxDurationMs}ms`,
                                } as CSSProperties
                              }
                            />
                          )}
                        </>
                      ))}

                    {/* 2) TARGET IMPACT / OUTCOME EFFECT */}
                    {vfxConfig.showMainImpactOrHeal &&
                      outcome === 'dodge' &&
                      targetUnit?.alive !== false && (
                        <div
                          data-testid={`vfx-dodge-${fx.id}-${targetId}`}
                          className="vfx-dodge-slide absolute rounded-full"
                          style={
                            {
                              left: to.leftCss,
                              top: to.topCss,
                              width: '44px',
                              height: '44px',
                              marginLeft: '-22px',
                              marginTop: '-22px',
                              border: '2px dashed rgba(226, 232, 240, 0.72)',
                              animationDelay: `${Math.round(impactDelayMs * 0.6)}ms`,
                              '--dodge-dx': isAlly ? '12px' : '-12px',
                              '--vfx-dur': `${impactDurMs}ms`,
                            } as CSSProperties
                          }
                        />
                      )}

                    {vfxConfig.showMainImpactOrHeal &&
                      outcome === 'shield_absorbed' && (
                        <div
                          data-testid={`vfx-shield-ripple-${fx.id}-${targetId}`}
                          className="vfx-ring-expand absolute rounded-full flex items-center justify-center"
                          style={
                            {
                              left: to.leftCss,
                              top: to.topCss,
                              width: '50px',
                              height: '50px',
                              marginLeft: '-25px',
                              marginTop: '-25px',
                              border: '2.5px solid #38bdf8',
                              boxShadow:
                                'inset 0 0 8px rgba(56, 189, 248, 0.5), 0 0 12px rgba(56, 189, 248, 0.5)',
                              animationDelay: `${impactDelayMs}ms`,
                              '--vfx-dur': `${impactDurMs}ms`,
                            } as CSSProperties
                          }
                        />
                      )}

                    {vfxConfig.showMainImpactOrHeal && outcome === 'crit' && (
                      <>
                        <div
                          data-testid={`vfx-crit-flash-${fx.id}-${targetId}`}
                          className="vfx-crit-flash absolute"
                          style={
                            {
                              left: to.leftCss,
                              top: to.topCss,
                              width: '56px',
                              height: '56px',
                              marginLeft: '-28px',
                              marginTop: '-28px',
                              borderRadius: '4px',
                              border: '3px solid #fef08a',
                              background: 'rgba(254, 240, 138, 0.28)',
                              boxShadow: '0 0 16px rgba(250, 204, 21, 0.7)',
                              animationDelay: `${impactDelayMs}ms`,
                              '--vfx-dur': `${impactDurMs}ms`,
                            } as CSSProperties
                          }
                        />
                        <div
                          className="vfx-ring-expand absolute rounded-full"
                          style={
                            {
                              left: to.leftCss,
                              top: to.topCss,
                              width: '66px',
                              height: '66px',
                              marginLeft: '-33px',
                              marginTop: '-33px',
                              border: '3px double #facc15',
                              animationDelay: `${impactDelayMs}ms`,
                              '--vfx-dur': `${impactDurMs}ms`,
                            } as CSSProperties
                          }
                        />
                      </>
                    )}

                    {vfxConfig.showMainImpactOrHeal && outcome === 'normal' && (
                      <div
                        data-testid={`vfx-impact-${fx.id}-${targetId}`}
                        className="vfx-ring-expand absolute"
                        style={
                          {
                            left: to.leftCss,
                            top: to.topCss,
                            width:
                              weaponStyle === 'area'
                                ? isSecondaryAreaHit
                                  ? '42px'
                                  : '64px'
                                : weaponStyle === 'missile'
                                ? '54px'
                                : '38px',
                            height:
                              weaponStyle === 'area'
                                ? isSecondaryAreaHit
                                  ? '42px'
                                  : '64px'
                                : weaponStyle === 'missile'
                                ? '54px'
                                : '38px',
                            marginLeft:
                              weaponStyle === 'area'
                                ? isSecondaryAreaHit
                                  ? '-21px'
                                  : '-32px'
                                : weaponStyle === 'missile'
                                ? '-27px'
                                : '-19px',
                            marginTop:
                              weaponStyle === 'area'
                                ? isSecondaryAreaHit
                                  ? '-21px'
                                  : '-32px'
                                : weaponStyle === 'missile'
                                ? '-27px'
                                : '-19px',
                            // Distinct shapes: circle for ally/missile/area, sharp diamond border for enemy cannon
                            borderRadius:
                              !isAlly && weaponStyle === 'cannon' ? '4px' : '9999px',
                            border: `2.5px ${
                              weaponStyle === 'area' && isSecondaryAreaHit
                                ? 'dashed'
                                : 'solid'
                            } ${palette.primary}`,
                            background:
                              weaponStyle === 'missile' || weaponStyle === 'area'
                                ? palette.glow
                                : 'transparent',
                            animationDelay: `${impactDelayMs}ms`,
                            '--vfx-dur': `${impactDurMs}ms`,
                          } as CSSProperties
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
      )}

      {/* Brief HTML Hit Flash per unit (replaces SVG animated hit flash; skipped under reduced motion / Off) */}
      {vfxConfig.showMainImpactOrHeal &&
        Array.from(hitFlashUnitIds).map((unitId) => {
          const pt = unitCenter(unitId);
          if (!pt) return null;
          const unit = battle.units.find((u) => u.id === unitId);
          const isShielded = unit?.animState === 'shielded';
          return (
            <div
              key={`hit-${unitId}`}
              data-testid={`radar-hit-flash-${unitId}`}
              className="vfx-hit-flash-html absolute rounded-full"
              style={
                {
                  left: pt.leftCss,
                  top: pt.topCss,
                  width: '44px',
                  height: '44px',
                  marginLeft: '-22px',
                  marginTop: '-22px',
                  border: isShielded ? '2.5px solid #38bdf8' : '2.5px solid #fef08a',
                  backgroundColor: isShielded
                    ? 'rgba(56, 189, 248, 0.25)'
                    : 'rgba(255, 255, 255, 0.35)',
                  '--vfx-dur': `${hitFlashDurationMs}ms`,
                } as CSSProperties
              }
            />
          );
        })}

      {/* Defeat Fade-Out Overlay (pure HTML translate3d + opacity) */}
      {vfxConfig.showMainImpactOrHeal &&
        Array.from(defeatFadingUnitIds).map((unitId) => {
          const pt = unitCenter(unitId);
          if (!pt) return null;
          return (
            <div
              key={`defeat-${unitId}`}
              data-testid={`radar-defeat-fade-${unitId}`}
              className="vfx-defeat-html absolute rounded-full"
              style={
                {
                  left: pt.leftCss,
                  top: pt.topCss,
                  width: '48px',
                  height: '48px',
                  marginLeft: '-24px',
                  marginTop: '-24px',
                  border: '2px solid #f87171',
                  backgroundColor: 'rgba(239, 68, 68, 0.22)',
                  '--vfx-dur': `${defeatFadeDurationMs}ms`,
                } as CSSProperties
              }
            />
          );
        })}

      {/* Per-Unit Queued Status Effects (max 2 simultaneous per unit, ring/shard VFX only; zero overlapping text pills) */}
      {vfxConfig.showStatusEffects &&
        activeStatusEffects.map((fx) => {
          const unit = battle.units.find((u) => u.id === fx.unitId);
          if (!unit || !unit.alive) return null;
          const pt = unitCenter(fx.unitId);
          if (!pt) return null;
          const dur = `${fx.durationMs}ms`;

          if (fx.kind === 'hp_heal') {
            return (
              <div
                key={fx.id}
                data-testid={`vfx-status-${fx.unitId}`}
                data-vfx-kind="hp_heal"
                className="absolute inset-0"
              >
                <div
                  className="vfx-ring-expand absolute rounded-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '48px',
                      height: '48px',
                      marginLeft: '-24px',
                      marginTop: '-24px',
                      border: '2.5px solid #34d399',
                      boxShadow: '0 0 10px rgba(52, 211, 153, 0.45)',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
                {vfxConfig.showDecorativeParticles &&
                  [-14, 0, 14].map((dx, i) => (
                    <span
                      key={i}
                      data-testid={`vfx-particle-heal-${fx.id}-${i}`}
                      className="vfx-particle-rise absolute text-[12px] font-bold text-emerald-300"
                      style={
                        {
                          left: pt.leftCss,
                          top: pt.topCss,
                          marginLeft: `${dx - 4}px`,
                          marginTop: '-8px',
                          animationDelay: `${i * 70}ms`,
                          '--vfx-dur': dur,
                        } as CSSProperties
                      }
                    >
                      +
                    </span>
                  ))}
              </div>
            );
          }

          if (fx.kind === 'shield_heal') {
            return (
              <div
                key={fx.id}
                data-testid={`vfx-status-${fx.unitId}`}
                data-vfx-kind="shield_heal"
                className="absolute inset-0"
              >
                <div
                  className="vfx-ring-expand absolute rounded-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '50px',
                      height: '50px',
                      marginLeft: '-25px',
                      marginTop: '-25px',
                      border: '2.5px solid #38bdf8',
                      boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
              </div>
            );
          }

          if (fx.kind === 'sp_restore') {
            return (
              <div
                key={fx.id}
                data-testid={`vfx-status-${fx.unitId}`}
                data-vfx-kind="sp_restore"
                className="absolute inset-0"
              >
                <div
                  className="vfx-ring-expand absolute rounded-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '44px',
                      height: '44px',
                      marginLeft: '-22px',
                      marginTop: '-22px',
                      border: '2px solid #c084fc',
                      backgroundColor: 'rgba(192, 132, 252, 0.16)',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
              </div>
            );
          }

          if (fx.kind === 'buff') {
            return (
              <div
                key={fx.id}
                data-testid={`vfx-status-${fx.unitId}`}
                data-vfx-kind="buff"
                className="absolute inset-0"
              >
                <div
                  className="vfx-ring-expand absolute rounded-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '46px',
                      height: '46px',
                      marginLeft: '-23px',
                      marginTop: '-23px',
                      border: '2px solid #4ade80',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
              </div>
            );
          }

          if (fx.kind === 'debuff') {
            return (
              <div
                key={fx.id}
                data-testid={`vfx-status-${fx.unitId}`}
                data-vfx-kind="debuff"
                className="absolute inset-0"
              >
                {/* Red outline pulse with short shake */}
                <div
                  className="vfx-debuff-shake absolute rounded-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '46px',
                      height: '46px',
                      marginLeft: '-23px',
                      marginTop: '-23px',
                      border: '2px dashed #f87171',
                      boxShadow: '0 0 8px rgba(248, 113, 113, 0.45)',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
              </div>
            );
          }

          if (fx.kind === 'shield_break') {
            return (
              <div
                key={fx.id}
                data-testid={`vfx-status-${fx.unitId}`}
                data-vfx-kind="shield_break"
                className="absolute inset-0"
              >
                {/* Cracking & dissolving split shield arcs */}
                <div
                  className="vfx-shield-shard-left absolute rounded-l-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '22px',
                      height: '44px',
                      marginLeft: '-22px',
                      marginTop: '-22px',
                      borderLeft: '3px solid #38bdf8',
                      borderTop: '3px solid #38bdf8',
                      borderBottom: '3px solid #38bdf8',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
                <div
                  className="vfx-shield-shard-right absolute rounded-r-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '22px',
                      height: '44px',
                      marginLeft: '0px',
                      marginTop: '-22px',
                      borderRight: '3px solid #f87171',
                      borderTop: '3px solid #f87171',
                      borderBottom: '3px solid #f87171',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
              </div>
            );
          }

          if (fx.kind === 'stealth_enter') {
            return (
              <div
                key={fx.id}
                data-testid={`vfx-status-${fx.unitId}`}
                data-vfx-kind="stealth_enter"
                className="absolute inset-0"
              >
                <div
                  className="vfx-stealth-veil absolute rounded-full"
                  style={
                    {
                      left: pt.leftCss,
                      top: pt.topCss,
                      width: '46px',
                      height: '46px',
                      marginLeft: '-23px',
                      marginTop: '-23px',
                      border: '2px dashed #94a3b8',
                      backgroundColor: 'rgba(148, 163, 184, 0.18)',
                      '--vfx-dur': dur,
                    } as CSSProperties
                  }
                />
              </div>
            );
          }

          // stealth_reveal: single radar sweep ring
          return (
            <div
              key={fx.id}
              data-testid={`vfx-status-${fx.unitId}`}
              data-vfx-kind="stealth_reveal"
              className="absolute inset-0"
            >
              <div
                className="vfx-ring-expand absolute rounded-full"
                style={
                  {
                    left: pt.leftCss,
                    top: pt.topCss,
                    width: '56px',
                    height: '56px',
                    marginLeft: '-28px',
                    marginTop: '-28px',
                    border: '2px solid #facc15',
                    boxShadow: '0 0 12px rgba(250, 204, 21, 0.5)',
                    '--vfx-dur': dur,
                  } as CSSProperties
                }
              />
            </div>
          );
        })}
    </div>
  );
}
