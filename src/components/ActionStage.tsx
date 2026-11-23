import type { CSSProperties } from 'react';
import { getTeamColorRole, getValidEnemyTargets } from '../engine/combat';
import { useI18n } from '../i18n';
import type {
  BattleSpeed,
  BattleState,
  BattleViewMode,
  CombatFxEvent,
  CombatSide,
  CombatUnit,
  FloatingPopup,
  TeamColorRole,
} from '../types/game';
import { formatShortUnitName } from '../utils/battleDisplay';
import type { EffectiveVfxConfig } from '../utils/battleVfx';
import { parseStructuredCombatLogRow } from '../utils/combatLogFormat';
import {
  resolveFxTone,
  resolveFxToneColor,
  STAGE_HIT_FLASH_COLORS,
  type ResolvedFxTone,
} from '../utils/fxTone';

export interface StageTokenProps {
  code: string;
  label: string;
  side: CombatSide | TeamColorRole;
  hpRatio?: number;
  hitFlashColor?: string | null;
  hitFlashReducedMotion?: boolean;
  hitFlashDelayMs?: number;
  hitFlashDurationMs?: number;
  compact?: boolean;
  stacked?: boolean;
  showLabel?: boolean;
  className?: string;
  testId?: string;
  hitTestId?: string;
}

export interface StageProjectileProps {
  reducedMotion: boolean;
  color?: string;
  coreColor?: string;
  durationMs?: number;
  left?: string;
  top?: string;
  reducedWidth?: string;
  travelPx?: number;
  testId?: string;
  fxTone?: ResolvedFxTone;
}

export interface ActionStageProps {
  battle: BattleState;
  activeUnit: CombatUnit | null;
  actingTargetName?: string | null;
  battleSpeed: BattleSpeed;
  vfxConfig: EffectiveVfxConfig;
  enabled: boolean;
  viewMode: BattleViewMode;
  variant: 'desktop' | 'phone';
}

function getTokenThemeClasses(side: CombatSide | TeamColorRole): {
  ring: string;
  label: string;
  hpColor: string;
} {
  switch (side) {
    case 'me':
      return {
        ring: 'border-emerald-400 bg-emerald-500/20 text-emerald-200',
        label: 'text-emerald-300/95',
        hpColor: '#10b981',
      };
    case 'ally':
      return {
        ring: 'border-sky-400 bg-sky-500/20 text-sky-200',
        label: 'text-sky-300/90',
        hpColor: '#38bdf8',
      };
    case 'boss':
      return {
        ring: 'border-orange-400 bg-orange-500/20 text-orange-200',
        label: 'text-orange-300/90',
        hpColor: '#f97316',
      };
    case 'enemy':
    default:
      return {
        ring: 'border-red-400 bg-red-500/20 text-red-200',
        label: 'text-red-300/90',
        hpColor: '#ef4444',
      };
  }
}

function getUnitShortCode(unit: CombatUnit): string {
  const src = (unit.callsign || unit.name || unit.classId).trim();
  if (!src) return '?';
  return src.slice(0, 2).toUpperCase();
}

function getPopupToneTextClass(tone: FloatingPopup['tone']): string {
  switch (tone) {
    case 'crit':
      return 'text-amber-300';
    case 'damage':
      return 'text-red-300';
    case 'heal':
      return 'text-emerald-300';
    case 'shield':
      return 'text-sky-300';
    case 'buff':
      return 'text-yellow-300';
    case 'evade':
      return 'text-slate-200';
    case 'status':
    default:
      return 'text-orange-300';
  }
}

export function resolveStageFxActorAndTargets(
  fx: CombatFxEvent,
  battle: BattleState
): { actor: CombatUnit | null; targets: CombatUnit[] } {
  const fromSideUnits = battle.units.filter((u) => u.side === fx.fromSide);
  const actor =
    (fx.fromUnitId
      ? battle.units.find((u) => u.id === fx.fromUnitId)
      : undefined) ??
    fromSideUnits[fx.fromSlotIndex] ??
    null;

  const toSideUnits = battle.units.filter((u) => u.side === fx.toSide);
  const targets: CombatUnit[] = [];
  const seenIds = new Set<string>();

  if (fx.toUnitIds && fx.toUnitIds.length > 0) {
    for (const id of fx.toUnitIds) {
      const u = battle.units.find((unit) => unit.id === id);
      if (u && !seenIds.has(u.id)) {
        seenIds.add(u.id);
        targets.push(u);
      }
    }
  } else {
    for (const slotIdx of fx.toSlotIndices) {
      const u = toSideUnits[slotIdx];
      if (u && !seenIds.has(u.id)) {
        seenIds.add(u.id);
        targets.push(u);
      }
    }
  }

  return { actor, targets };
}

/**
 * Shared token visual used by both the EffectsSettingsPanel preview box and ActionStage.
 */
export function StageToken({
  code,
  label,
  side,
  hpRatio,
  hitFlashColor = null,
  hitFlashReducedMotion = false,
  hitFlashDelayMs = 0,
  hitFlashDurationMs = 320,
  compact = false,
  stacked = false,
  showLabel = true,
  className = '',
  testId,
  hitTestId,
}: StageTokenProps) {
  const theme = getTokenThemeClasses(side);
  const circleSize = compact ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]';
  const clampedHp =
    hpRatio !== undefined ? Math.max(0, Math.min(1, hpRatio)) : undefined;

  return (
    <div
      data-testid={testId}
      className={`flex flex-col items-center ${
        compact ? 'gap-0.5' : 'gap-0.5'
      } ${stacked ? '-ml-2 first:ml-0' : ''} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <div
          className={`${circleSize} rounded-full border-2 ${theme.ring} flex items-center justify-center font-bold shrink-0`}
        >
          {code}
        </div>
        {hitFlashColor && (
          <div
            data-testid={hitTestId}
            data-flash-color={hitFlashColor}
            className={`${
              hitFlashReducedMotion ? 'vfx-reduced-marker' : 'vfx-hit-flash-html'
            } pointer-events-none absolute -inset-1 rounded-full`}
            style={
              {
                border: `2px solid ${hitFlashColor}`,
                backgroundColor: `${hitFlashColor}38`,
                boxShadow: `0 0 10px ${hitFlashColor}`,
                animationDelay: `${hitFlashDelayMs}ms`,
                '--vfx-dur': `${hitFlashDurationMs}ms`,
              } as CSSProperties
            }
          />
        )}
      </div>

      {clampedHp !== undefined && (
        <div className="w-9 h-1 rounded-full bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${Math.round(clampedHp * 100)}%`,
              backgroundColor: theme.hpColor,
            }}
          />
        </div>
      )}

      {showLabel && (
        <span
          className={`${
            compact ? 'text-[9px] max-w-[54px]' : 'text-[10px] max-w-[68px]'
          } font-mono-nums leading-none truncate ${theme.label}`}
          title={label}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Shared projectile visual used by both EffectsSettingsPanel preview box and ActionStage.
 */
export function StageProjectile({
  reducedMotion,
  color = '#38bdf8',
  coreColor = '#e0f2fe',
  durationMs,
  left,
  top = '50%',
  reducedWidth = '52%',
  travelPx = 170,
  testId = 'preview-fx-projectile',
  fxTone,
}: StageProjectileProps) {
  if (reducedMotion) {
    return (
      <div
        data-testid={testId}
        data-reduced-marker="true"
        data-fx-tone={fxTone}
        data-fx-color={color}
        className="vfx-reduced-marker absolute"
        style={
          {
            left: left ?? '24%',
            top,
            width: reducedWidth,
            height: '3px',
            marginTop: '-1.5px',
            background: `linear-gradient(90deg, ${color}40, ${color}, ${coreColor})`,
            '--vfx-dur': `${durationMs ?? 340}ms`,
          } as CSSProperties
        }
      />
    );
  }

  return (
    <div
      data-testid={testId}
      data-reduced-marker="false"
      data-fx-tone={fxTone}
      data-fx-color={color}
      className="vfx-cannon-fly absolute"
      style={
        {
          left: left ?? '22%',
          top,
          width: '22px',
          height: '5px',
          marginLeft: '-11px',
          marginTop: '-2.5px',
          borderRadius: '2px 9999px 9999px 2px',
          background: `linear-gradient(90deg, transparent 0%, ${color} 45%, ${coreColor} 100%)`,
          boxShadow: `0 0 8px ${color}`,
          '--dx1': `${Math.round(travelPx * 0.14)}px`,
          '--dy1': '0px',
          '--dx2': `${Math.round(travelPx * 0.82)}px`,
          '--dy2': '0px',
          '--dx': `${travelPx}px`,
          '--dy': '0px',
          '--ang': '0deg',
          '--vfx-dur': `${durationMs ?? 460}ms`,
        } as CSSProperties
      }
    />
  );
}

/**
 * Compact card-mode "Action Stage" (desktop 84px sidebar panel / phone 56px strip).
 * Renders nothing (0px) when off, in radar mode, or after battle summary.
 */
export function ActionStage({
  battle,
  activeUnit,
  actingTargetName,
  battleSpeed,
  vfxConfig,
  enabled,
  viewMode,
  variant,
}: ActionStageProps) {
  const { lang, t } = useI18n();

  if (!enabled || viewMode !== 'card' || Boolean(battle.summary)) {
    return null;
  }

  const latestFx =
    battle.fxEvents.length > 0
      ? battle.fxEvents[battle.fxEvents.length - 1]
      : null;

  const isPhone = variant === 'phone';
  const fallbackActor =
    activeUnit ?? battle.units.find((u) => u.alive) ?? null;

  if (!latestFx && !fallbackActor) {
    return null;
  }

  if (!latestFx && fallbackActor) {
    const idleActorRole = getTeamColorRole(fallbackActor);
    const preferredOpponentSide: CombatSide =
      fallbackActor.side === 'ally' ? 'enemy' : 'ally';
    const idleTargetUnit =
      (actingTargetName
        ? battle.units.find(
            (u) =>
              u.alive &&
              u.side === preferredOpponentSide &&
              u.name === actingTargetName
          ) ??
          battle.units.find((u) => u.alive && u.name === actingTargetName)
        : undefined) ??
      getValidEnemyTargets(battle.units, fallbackActor, 'attack')[0] ??
      null;
    const idleTargetRole = idleTargetUnit
      ? getTeamColorRole(idleTargetUnit)
      : 'enemy';
    const idleTargetDisplayName =
      actingTargetName ?? idleTargetUnit?.name ?? null;
    const idleCaption = idleTargetDisplayName
      ? `${fallbackActor.name} > ${idleTargetDisplayName}`
      : fallbackActor.name;

    if (isPhone) {
      return (
        <div
          data-testid="action-stage"
          data-stage-variant="phone"
          data-stage-state="idle"
          className="h-[56px] min-h-[56px] max-h-[56px] shrink-0 mx-2 mt-1 rounded-lg border border-slate-800 bg-[#080E1A] px-2.5 py-1 flex items-center justify-between gap-2 overflow-hidden"
        >
          <StageToken
            testId="action-stage-attacker"
            code={getUnitShortCode(fallbackActor)}
            label={formatShortUnitName(fallbackActor.name, 8)}
            side={idleActorRole}
            hpRatio={
              fallbackActor.hp / Math.max(1, fallbackActor.derived.maxHp)
            }
            compact
          />
          <div className="flex-1 min-w-0 flex items-center justify-center text-slate-500 text-[12px] font-bold">
            &gt;
          </div>
          {idleTargetUnit ? (
            <StageToken
              testId="action-stage-target"
              code={getUnitShortCode(idleTargetUnit)}
              label={formatShortUnitName(idleTargetUnit.name, 8)}
              side={idleTargetRole}
              hpRatio={
                idleTargetUnit.hp / Math.max(1, idleTargetUnit.derived.maxHp)
              }
              compact
            />
          ) : (
            <span className="text-[11px] text-slate-400 truncate max-w-[90px]">
              {idleTargetDisplayName ?? '—'}
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        data-testid="action-stage"
        data-stage-variant="desktop"
        data-stage-state="idle"
        className="h-[84px] min-h-[84px] max-h-[84px] shrink-0 rounded-lg border border-slate-800 bg-[#080E1A] px-2.5 py-1.5 flex flex-col justify-between overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <StageToken
            testId="action-stage-attacker"
            code={getUnitShortCode(fallbackActor)}
            label={formatShortUnitName(fallbackActor.name, 9)}
            side={idleActorRole}
            hpRatio={
              fallbackActor.hp / Math.max(1, fallbackActor.derived.maxHp)
            }
          />
          <div className="flex-1 flex items-center justify-center text-slate-500 text-[13px] font-bold">
            &gt;
          </div>
          {idleTargetUnit ? (
            <StageToken
              testId="action-stage-target"
              code={getUnitShortCode(idleTargetUnit)}
              label={formatShortUnitName(idleTargetUnit.name, 9)}
              side={idleTargetRole}
              hpRatio={
                idleTargetUnit.hp / Math.max(1, idleTargetUnit.derived.maxHp)
              }
            />
          ) : (
            <span className="text-[11px] text-slate-400 truncate max-w-[90px]">
              {idleTargetDisplayName ?? '—'}
            </span>
          )}
        </div>
        <div
          data-testid="action-stage-caption"
          title={idleCaption}
          className="text-[11px] text-slate-400 font-medium leading-tight truncate"
        >
          {idleCaption}
        </div>
      </div>
    );
  }

  // Active latest FX state (keyed by latestFx.id so any new fx immediately replaces the running one)
  const fx = latestFx!;
  const fxTone = resolveFxTone(fx);
  const projectileColor = resolveFxToneColor(fx);
  const hitFlashColor = STAGE_HIT_FLASH_COLORS[fxTone];
  const { actor, targets } = resolveStageFxActorAndTargets(fx, battle);
  const resolvedActor = actor ?? fallbackActor;
  if (!resolvedActor) return null;

  const actorRole = getTeamColorRole(resolvedActor);
  const visibleTargets = targets.slice(0, 3);
  const overflowCount = Math.max(0, targets.length - 3);
  const targetIdSet = new Set(targets.map((u) => u.id));

  const newestPopup =
    (targets[0]
      ? [...battle.popups].reverse().find((p) => p.unitId === targets[0].id)
      : undefined) ??
    [...battle.popups].reverse().find((p) => targetIdSet.has(p.unitId)) ??
    null;

  const actorLogEntry = [...battle.log]
    .reverse()
    .find(
      (entry) =>
        entry.actorName === resolvedActor.name ||
        entry.params?.actor === resolvedActor.name
    );
  const parsedLogRow = actorLogEntry
    ? parseStructuredCombatLogRow(lang, actorLogEntry, battle.units)
    : null;
  const actionCaption = t('actionStage.usedAction', {
    actor: resolvedActor.name,
    action: parsedLogRow?.actionLabel || t('log.primaryWeapons'),
  });

  const isStaticOff =
    vfxConfig.mode === 'off' || vfxConfig.animationsSkipped;
  const showProjectile =
    !isStaticOff &&
    vfxConfig.showProjectiles &&
    battleSpeed < 5 &&
    visibleTargets.length > 0;
  const showHitFlash =
    !isStaticOff &&
    vfxConfig.showMainImpactOrHeal &&
    visibleTargets.length > 0;

  const safeSpeed = Math.max(1, battleSpeed);
  const projDurMs = Math.max(
    90,
    Math.round((vfxConfig.reducedMotion ? 280 : 380) / safeSpeed)
  );
  const flashDurMs = Math.max(90, Math.round(300 / safeSpeed));
  const flashDelayMs =
    showProjectile && !vfxConfig.reducedMotion
      ? Math.round(projDurMs * 0.45)
      : 0;

  if (isPhone) {
    return (
      <div
        data-testid="action-stage"
        data-stage-variant="phone"
        data-stage-state="active"
        data-fx-id={fx.id}
        data-fx-tone={fxTone}
        className="h-[56px] min-h-[56px] max-h-[56px] shrink-0 mx-2 mt-1 rounded-lg border border-slate-800 bg-[#080E1A] px-2.5 py-1 flex items-center justify-between gap-2 overflow-hidden"
      >
        <StageToken
          testId="action-stage-attacker"
          code={getUnitShortCode(resolvedActor)}
          label={formatShortUnitName(resolvedActor.name, 8)}
          side={actorRole}
          hpRatio={resolvedActor.hp / Math.max(1, resolvedActor.derived.maxHp)}
          compact
        />

        <div
          key={fx.id}
          data-testid="action-stage-fx-lane"
          className="relative flex-1 min-w-[48px] h-10 flex items-center justify-center overflow-hidden"
        >
          {showProjectile ? (
            <StageProjectile
              testId="action-stage-projectile"
              reducedMotion={vfxConfig.reducedMotion}
              color={projectileColor}
              durationMs={projDurMs}
              left={vfxConfig.reducedMotion ? '12%' : '8%'}
              reducedWidth="76%"
              travelPx={96}
              fxTone={fxTone}
            />
          ) : (
            <span className="text-slate-500 text-[11px] font-bold">&gt;</span>
          )}
        </div>

        <div className="relative flex items-center gap-1 shrink-0">
          {newestPopup && (
            <span
              data-testid="action-stage-result"
              className={`max-w-[78px] truncate font-display text-[11px] font-bold leading-none ${getPopupToneTextClass(
                newestPopup.tone
              )}`}
            >
              {newestPopup.text}
            </span>
          )}
          <div className="flex items-center">
            {visibleTargets.map((tgt, idx) => (
              <StageToken
                key={tgt.id}
                testId="action-stage-target"
                code={getUnitShortCode(tgt)}
                label={formatShortUnitName(tgt.name, 7)}
                side={getTeamColorRole(tgt)}
                hpRatio={tgt.hp / Math.max(1, tgt.derived.maxHp)}
                hitFlashColor={showHitFlash && idx === 0 ? hitFlashColor : null}
                hitFlashReducedMotion={vfxConfig.reducedMotion}
                hitFlashDelayMs={flashDelayMs}
                hitFlashDurationMs={flashDurMs}
                hitTestId={idx === 0 ? 'action-stage-hit-flash' : undefined}
                compact
                stacked={idx > 0}
                showLabel={visibleTargets.length === 1}
              />
            ))}
          </div>
          {overflowCount > 0 && (
            <span
              data-testid="action-stage-target-overflow"
              className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono-nums font-bold text-amber-300 shrink-0"
            >
              +{overflowCount}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="action-stage"
      data-stage-variant="desktop"
      data-stage-state="active"
      data-fx-id={fx.id}
      data-fx-tone={fxTone}
      className="h-[84px] min-h-[84px] max-h-[84px] shrink-0 rounded-lg border border-slate-800 bg-[#080E1A] px-2.5 py-1.5 flex flex-col justify-between overflow-hidden"
    >
      <div
        key={fx.id}
        data-testid="action-stage-fx-lane"
        className="flex items-center justify-between gap-2 min-w-0"
      >
        <StageToken
          testId="action-stage-attacker"
          code={getUnitShortCode(resolvedActor)}
          label={formatShortUnitName(resolvedActor.name, 9)}
          side={actorRole}
          hpRatio={resolvedActor.hp / Math.max(1, resolvedActor.derived.maxHp)}
        />

        <div className="relative flex-1 min-w-[44px] h-10 flex items-center justify-center overflow-hidden">
          {showProjectile ? (
            <StageProjectile
              testId="action-stage-projectile"
              reducedMotion={vfxConfig.reducedMotion}
              color={projectileColor}
              durationMs={projDurMs}
              left={vfxConfig.reducedMotion ? '10%' : '8%'}
              reducedWidth="80%"
              travelPx={108}
              fxTone={fxTone}
            />
          ) : (
            <span className="text-slate-500 text-[12px] font-bold">&gt;</span>
          )}
        </div>

        <div className="relative flex flex-col items-end shrink-0">
          {newestPopup && (
            <span
              data-testid="action-stage-result"
              className={`max-w-[110px] truncate font-display text-[11px] font-bold leading-none mb-0.5 ${getPopupToneTextClass(
                newestPopup.tone
              )}`}
            >
              {newestPopup.text}
            </span>
          )}
          <div className="flex items-center gap-1">
            <div className="flex items-center">
              {visibleTargets.map((tgt, idx) => (
                <StageToken
                  key={tgt.id}
                  testId="action-stage-target"
                  code={getUnitShortCode(tgt)}
                  label={formatShortUnitName(tgt.name, 8)}
                  side={getTeamColorRole(tgt)}
                  hpRatio={tgt.hp / Math.max(1, tgt.derived.maxHp)}
                  hitFlashColor={showHitFlash ? hitFlashColor : null}
                  hitFlashReducedMotion={vfxConfig.reducedMotion}
                  hitFlashDelayMs={flashDelayMs}
                  hitFlashDurationMs={flashDurMs}
                  hitTestId={idx === 0 ? 'action-stage-hit-flash' : undefined}
                  stacked={idx > 0}
                  showLabel={visibleTargets.length === 1}
                />
              ))}
            </div>
            {overflowCount > 0 && (
              <span
                data-testid="action-stage-target-overflow"
                className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono-nums font-bold text-amber-300 shrink-0"
              >
                +{overflowCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        data-testid="action-stage-caption"
        title={actionCaption}
        className="text-[11px] text-slate-300 font-medium leading-tight truncate"
      >
        {actionCaption}
      </div>
    </div>
  );
}
