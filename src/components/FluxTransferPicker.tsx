import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  BALANCE_CONFIG,
  getFluxMinPerAlly,
  getFluxTransferRule,
} from '../data/balance';
import {
  getMaxAffordableFluxCount,
  resolveSpTransfer,
} from '../engine/combat';
import type { TranslationKey } from '../i18n/en';
import type {
  CombatUnit,
  FluxTransferConfig,
  FluxTransferLevelRule,
} from '../types/game';

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

export interface FluxTransferPreview {
  skillLevel: number;
  rule: FluxTransferLevelRule;
  minPerAlly: number;
  nonFullAllyCount: number;
  maxCount: number;
  count: number;
  cost: number;
  leftSp: number;
  totalMoved: number;
  hasAllyNeedingSp: boolean;
  canAfford: boolean;
}

export function previewFluxTransfer(
  units: CombatUnit[],
  actorId: string,
  cfg?: FluxTransferConfig | null,
  requestedCount?: number
): FluxTransferPreview {
  const actor = units.find((u) => u.id === actorId);
  const skillLevel = actor
    ? actor.skillLevels['sup_flux_transfer'] ?? actor.skillLevel ?? 1
    : 1;
  const rule = getFluxTransferRule(
    skillLevel,
    cfg,
    BALANCE_CONFIG.skillMaxLevel
  );
  const minPerAlly = getFluxMinPerAlly(
    skillLevel,
    cfg,
    BALANCE_CONFIG.skillMaxLevel
  );
  const maxAffordable = getMaxAffordableFluxCount(units, actorId, skillLevel, cfg);
  const maxCount = Math.min(
    Math.max(1, Math.floor(rule.targets)),
    Math.max(0, maxAffordable)
  );
  const canAfford = maxCount >= 1;
  const nonFullAllyCount = actor
    ? units.filter(
        (u) =>
          u.side === actor.side &&
          u.alive &&
          u.id !== actor.id &&
          u.derived.maxSp > 0 &&
          u.sp < u.derived.maxSp
      ).length
    : 0;
  const hasAllyNeedingSp = nonFullAllyCount > 0;
  const count = !canAfford
    ? 0
    : Math.max(
        1,
        Math.min(
          maxCount,
          Math.floor(
            (requestedCount === undefined
              ? Math.max(1, Math.min(maxCount, nonFullAllyCount))
              : requestedCount) || 1
          )
        )
      );

  const sim = resolveSpTransfer(units, actorId, skillLevel, cfg, count);
  const actorAfter = sim.updatedUnits.find((u) => u.id === actorId);
  const leftSp = actorAfter ? actorAfter.sp : actor ? actor.sp : 0;

  return {
    skillLevel,
    rule,
    minPerAlly,
    nonFullAllyCount,
    maxCount,
    count,
    cost: sim.cost,
    leftSp,
    totalMoved: sim.totalMoved,
    hasAllyNeedingSp,
    canAfford,
  };
}

export interface FluxTransferPickerProps {
  open: boolean;
  units: CombatUnit[];
  actorId: string;
  fluxConfig?: FluxTransferConfig | null;
  isPhone: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
  t: TranslateFn;
  onCancel: () => void;
  onConfirm: (transferCount: number) => void;
}

export function FluxTransferPicker({
  open,
  units,
  actorId,
  fluxConfig,
  isPhone,
  anchorRef,
  t,
  onCancel,
  onConfirm,
}: FluxTransferPickerProps) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const basePreview = previewFluxTransfer(units, actorId, fluxConfig);
  const defaultCount = basePreview.count;
  const [selectedCount, setSelectedCount] = useState<number>(defaultCount);
  const [desktopPos, setDesktopPos] = useState<{ left: number; bottom: number }>({
    left: 8,
    bottom: 64,
  });

  useEffect(() => {
    if (!open) return;
    setSelectedCount(defaultCount);
  }, [open, actorId, defaultCount]);

  useLayoutEffect(() => {
    if (!open || isPhone || typeof window === 'undefined') return;
    const updatePosition = () => {
      const vw = window.innerWidth || 1440;
      const vh = window.innerHeight || 900;
      const rect = anchorRef?.current?.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        const rawLeft = rect.left + rect.width / 2 - 130;
        const left = Math.max(8, Math.min(vw - 268, Math.round(rawLeft)));
        const bottom = Math.max(8, Math.round(vh - rect.top + 6));
        setDesktopPos({ left, bottom });
      } else {
        setDesktopPos({ left: 8, bottom: 64 });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, isPhone, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (pickerRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, anchorRef, onCancel]);

  if (!open) return null;

  const preview = previewFluxTransfer(units, actorId, fluxConfig, selectedCount);
  const clampedCount = preview.count;
  const maxCount = preview.maxCount;

  const posStyle = isPhone
    ? {
        position: 'fixed' as const,
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '260px',
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: '110px',
        zIndex: 70,
      }
    : {
        position: 'fixed' as const,
        left: `${desktopPos.left}px`,
        bottom: `${desktopPos.bottom}px`,
        width: '260px',
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: '110px',
        zIndex: 70,
      };

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label={t('battle.fluxPickerTitle', { lv: preview.skillLevel })}
      data-testid="flux-transfer-picker"
      data-placement={isPhone ? 'phone-bottom' : 'desktop-popover'}
      style={posStyle}
      className="rounded-lg border border-sky-500/60 bg-[#0B111D]/98 text-slate-100 shadow-2xl px-2.5 py-1.5 flex flex-col justify-between gap-0.5 overflow-hidden"
    >
      <div className="text-[11px] font-bold leading-[14px] text-sky-300 truncate">
        {t('battle.fluxPickerTitle', { lv: preview.skillLevel })}
      </div>

      <div className="flex items-center justify-between gap-1 text-[11px] leading-[18px] min-w-0">
        <span className="text-slate-200 truncate">
          {t('battle.fluxPickerCountLabel')}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="flux-picker-dec"
            aria-label={t('battle.fluxPickerDec')}
            disabled={clampedCount <= 1 || maxCount <= 0}
            onClick={() => setSelectedCount(Math.max(1, clampedCount - 1))}
            className="w-[18px] h-[18px] rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-100 font-mono-nums font-bold text-[11px] leading-none inline-flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            −
          </button>
          <span
            data-testid="flux-picker-count"
            className="min-w-[14px] text-center font-mono-nums font-bold text-slate-100"
          >
            {clampedCount}
          </span>
          <button
            type="button"
            data-testid="flux-picker-inc"
            aria-label={t('battle.fluxPickerInc')}
            disabled={clampedCount >= maxCount}
            onClick={() =>
              setSelectedCount(Math.min(maxCount, clampedCount + 1))
            }
            className="w-[18px] h-[18px] rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-100 font-mono-nums font-bold text-[11px] leading-none inline-flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            +
          </button>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {t('battle.fluxPickerMax', { max: maxCount })}
          </span>
        </div>
      </div>

      <div className="text-[10px] leading-[13px] text-slate-300 font-mono-nums truncate">
        {t('battle.fluxPickerRate', {
          pct: preview.rule.pct,
          min: preview.minPerAlly,
          fee: preview.rule.fee,
        })}
      </div>

      <div
        data-testid="flux-picker-estimate"
        className={`text-[10px] leading-[13px] font-mono-nums truncate ${
          preview.hasAllyNeedingSp ? 'text-sky-200' : 'text-amber-300'
        }`}
      >
        {preview.hasAllyNeedingSp
          ? t('battle.fluxPickerEstimate', {
              cost: preview.cost,
              left: preview.leftSp,
            })
          : t('battle.fluxPickerNoAlly')}
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-0.5 shrink-0">
        <button
          type="button"
          data-testid="flux-picker-cancel"
          onClick={onCancel}
          className="h-6 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold leading-none cursor-pointer"
        >
          {t('battle.fluxPickerCancel')}
        </button>
        <button
          type="button"
          data-testid="flux-picker-confirm"
          disabled={!preview.hasAllyNeedingSp || !preview.canAfford}
          onClick={() => {
            if (preview.hasAllyNeedingSp && preview.canAfford) {
              onConfirm(clampedCount);
            }
          }}
          className="h-6 px-2.5 rounded bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-[11px] font-bold leading-none cursor-pointer disabled:cursor-not-allowed"
        >
          {t('battle.fluxPickerConfirm')}
        </button>
      </div>
    </div>
  );
}
