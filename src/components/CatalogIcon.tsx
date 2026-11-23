import {
  Anchor,
  BatteryCharging,
  Castle,
  Shield,
  ShieldOff,
  Sparkles,
  Sun,
} from 'lucide-react';
import type {
  IconCatalogKind,
  IconCatalogRow,
  StatusBadgeLayout,
  StatusEffectType,
} from '../types/game';

import {
  STATUS_ARROW_BORDER_COLOR,
  STATUS_ARROW_BORDER_PX,
  STATUS_ICON_SIZE_SPECS,
  STATUS_TURNS_BADGE_BG,
  STATUS_TURNS_BADGE_BORDER_COLOR,
  STATUS_TURNS_BADGE_BORDER_PX,
  STATUS_TURNS_BADGE_COLOR,
  STATUS_TURNS_BADGE_HEIGHT_PX,
  type StatusChipSizeVariant,
} from '../utils/statusDisplayPrefs';

export type CatalogIconSize = StatusChipSizeVariant;

interface CatalogIconProps {
  row: IconCatalogRow | null;
  fallbackStatusType?: StatusEffectType;
  kindOverride?: IconCatalogKind;
  size?: CatalogIconSize;
  badgeLayout?: StatusBadgeLayout;
  turnsLeft?: number | null;
  stacks?: number;
  allowStack?: boolean;
  showBadges?: boolean;
  showArrowBadge?: boolean;
  className?: string;
}

const BUFF_GREEN = '#1D9E75';
const DEBUFF_RED = '#E24B4A';

function renderFallbackLucide(
  type: StatusEffectType | undefined,
  color: string,
  sizePx: number
) {
  const props = {
    style: { color, width: `${sizePx}px`, height: `${sizePx}px` },
    'aria-hidden': true as const,
  };
  switch (type) {
    case 'evade_all':
      return <Sparkles {...props} />;
    case 'invincible':
      return <Sun {...props} />;
    case 'siege_mode':
      return <Anchor {...props} />;
    case 'siege_defense':
      return <Castle {...props} />;
    case 'charging':
      return <BatteryCharging {...props} />;
    case 'shield_cracked':
      return <ShieldOff {...props} />;
    default:
      return <Shield {...props} />;
  }
}

export function CatalogIcon({
  row,
  fallbackStatusType,
  kindOverride,
  size = 'sm',
  badgeLayout = 'B',
  turnsLeft = null,
  stacks = 1,
  allowStack = false,
  showBadges = true,
  showArrowBadge = true,
  className = '',
}: CatalogIconProps) {
  const spec = STATUS_ICON_SIZE_SPECS[size];
  const isMini = size === 'xs';
  const kind: IconCatalogKind = kindOverride ?? row?.kind ?? 'normal';
  const baseColor = row?.color ?? '#94A3B8';
  const iconColor = kind === 'buff' ? BUFF_GREEN : baseColor;

  const hasValidTurns =
    showBadges &&
    turnsLeft !== null &&
    turnsLeft !== undefined &&
    Number.isFinite(turnsLeft) &&
    turnsLeft > 0 &&
    turnsLeft < 50;

  const hasStackBadge =
    showBadges && allowStack && Number.isFinite(stacks) && stacks >= 2;

  const arrowCornerClass =
    badgeLayout === 'A' ? '-bottom-1 -right-1' : '-bottom-1 -left-1';

  const turnsCornerClass =
    badgeLayout === 'A' ? '-bottom-1.5 -left-1.5' : '-bottom-1.5 -right-1.5';

  const outset = spec.turnsOutsetPx;

  const arrowPositionStyle = isMini
    ? undefined
    : {
        bottom: `-${outset}px`,
        ...(badgeLayout === 'A'
          ? {
              right: `-${outset}px`,
              left: 'auto',
              transform: 'translate(50%, 50%)',
            }
          : {
              left: `-${outset}px`,
              right: 'auto',
              transform: 'translate(-50%, 50%)',
            }),
      };

  const turnsPositionStyle = isMini
    ? undefined
    : {
        bottom: `-${outset}px`,
        ...(badgeLayout === 'A'
          ? {
              left: `-${outset}px`,
              right: 'auto',
              transform: 'translate(-50%, 50%)',
            }
          : {
              right: `-${outset}px`,
              left: 'auto',
              transform: 'translate(50%, 50%)',
            }),
      };

  const stackPositionStyle = isMini
    ? undefined
    : {
        top: `-${outset}px`,
        right: `-${outset}px`,
        transform: 'translate(50%, -50%)',
      };

  const renderGlyph = () => {
    if (!row) {
      return renderFallbackLucide(fallbackStatusType, iconColor, spec.lucideSizePx);
    }
    if (Array.isArray(row.layers) && row.layers.length > 0) {
      return (
        <span
          className="relative inline-flex items-center justify-center"
          style={{ width: spec.iconFontPx, height: spec.iconFontPx }}
          aria-hidden="true"
        >
          {row.layers.map((layer, idx) => (
            <span
              key={`${row.id}-layer-${idx}`}
              className="material-symbols-outlined absolute inset-0 flex items-center justify-center leading-none select-none"
              style={{
                fontSize: `${spec.iconFontPx}px`,
                color: layer.color,
                opacity: layer.opacity ?? 1,
              }}
            >
              {layer.symbol}
            </span>
          ))}
        </span>
      );
    }
    return (
      <span
        className="material-symbols-outlined leading-none select-none"
        style={{
          fontSize: `${spec.iconFontPx}px`,
          color: iconColor,
        }}
        aria-hidden="true"
      >
        {row.symbol}
      </span>
    );
  };

  return (
    <span
      data-testid="catalog-icon-root"
      data-icon-kind={kind}
      data-icon-size={size}
      data-frame-px={spec.boxPx}
      data-glyph-px={spec.iconFontPx}
      data-badge-layout={badgeLayout}
      data-catalog-id={row?.id ?? 'unmapped'}
      style={{
        width: `${spec.boxPx}px`,
        height: `${spec.boxPx}px`,
      }}
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
    >
      {/* Shape frame by kind */}
      {kind === 'buff' ? (
        <span
          data-testid="status-icon-frame"
          data-frame-shape="round"
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{
            border: `1.5px solid ${BUFF_GREEN}`,
            backgroundColor: 'rgba(29, 158, 117, 0.16)',
          }}
        >
          {renderGlyph()}
        </span>
      ) : kind === 'debuff' ? (
        <span
          data-testid="status-icon-frame"
          data-frame-shape="hex"
          className="status-hex-frame w-full h-full flex items-center justify-center p-[1.5px]"
          style={{
            backgroundColor: DEBUFF_RED,
          }}
        >
          <span
            className="status-hex-frame w-full h-full flex items-center justify-center"
            style={{
              backgroundColor: '#251015',
            }}
          >
            {renderGlyph()}
          </span>
        </span>
      ) : (
        <span
          data-testid="status-icon-frame"
          data-frame-shape="rounded-square"
          className="w-full h-full rounded-[4px] flex items-center justify-center"
          style={{
            border: `1.5px solid ${baseColor}`,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
          }}
        >
          {renderGlyph()}
        </span>
      )}

      {/* Arrow Badge (buff = up, debuff = down, normal = none) */}
      {showArrowBadge && (kind === 'buff' || kind === 'debuff') && (
        <span
          data-testid="status-arrow-badge"
          data-arrow-dir={kind === 'buff' ? 'up' : 'down'}
          data-badge-corner={badgeLayout === 'A' ? 'bottom-right' : 'bottom-left'}
          style={{
            width: `${spec.arrowBoxPx}px`,
            height: `${spec.arrowBoxPx}px`,
            backgroundColor: kind === 'buff' ? BUFF_GREEN : DEBUFF_RED,
            borderWidth: `${STATUS_ARROW_BORDER_PX}px`,
            borderStyle: 'solid',
            borderColor: isMini ? '#070B12' : STATUS_ARROW_BORDER_COLOR,
            ...arrowPositionStyle,
          }}
          className={`pointer-events-none absolute ${arrowCornerClass} z-10 rounded-full flex items-center justify-center ${
            isMini ? 'border-[#070B12]' : 'border-[#0B1220]'
          } shadow-xs`}
          aria-hidden="true"
        >
          <span
            className={`material-symbols-outlined text-white leading-none select-none ${
              isMini ? '' : 'font-bold'
            }`}
            style={{
              fontSize: `${spec.arrowFontPx}px`,
              ...(isMini
                ? {}
                : {
                    fontWeight: 700,
                    fontVariationSettings: "'wght' 700",
                  }),
            }}
          >
            {kind === 'buff' ? 'arrow_upward' : 'arrow_downward'}
          </span>
        </span>
      )}

      {/* Turns Left Badge (clock + yellow #F5C542 bold 11px on #0B1220/85 pill centered on corner 4px outside) */}
      {hasValidTurns && (
        <span
          data-testid="status-turns-badge"
          data-badge-corner={badgeLayout === 'A' ? 'bottom-left' : 'bottom-right'}
          style={{
            fontSize: `${spec.turnsFontPx}px`,
            ...(isMini
              ? {}
              : {
                  height: `${STATUS_TURNS_BADGE_HEIGHT_PX}px`,
                  backgroundColor: STATUS_TURNS_BADGE_BG,
                  borderColor: STATUS_TURNS_BADGE_BORDER_COLOR,
                  borderWidth: `${STATUS_TURNS_BADGE_BORDER_PX}px`,
                  borderStyle: 'solid',
                }),
            ...turnsPositionStyle,
          }}
          className={`pointer-events-none absolute ${turnsCornerClass} z-20 inline-flex items-center gap-[1px] px-[3px] rounded-full font-mono-nums font-bold leading-none shadow-sm ${
            isMini
              ? 'py-[0.5px] bg-[#060A12] border border-slate-500/80 text-slate-100'
              : 'bg-[#0B1220]/85 text-[#F5C542]'
          }`}
        >
          <span
            className={`material-symbols-outlined leading-none select-none ${
              isMini ? 'text-slate-300' : 'text-[#F5C542]'
            }`}
            style={{
              fontSize: `${spec.turnsClockPx}px`,
              ...(isMini ? {} : { color: STATUS_TURNS_BADGE_COLOR }),
            }}
            aria-hidden="true"
          >
            schedule
          </span>
          <span
            data-testid="status-turns-number"
            className={isMini ? undefined : 'text-[#F5C542] font-bold'}
            style={isMini ? undefined : { color: STATUS_TURNS_BADGE_COLOR }}
          >
            {turnsLeft}
          </span>
        </span>
      )}

      {/* Stack Badge (yellow "x2", ONLY when allowStack=true and stacks >= 2) */}
      {hasStackBadge && (
        <span
          data-testid="status-stack-badge"
          style={{
            fontSize: `${spec.stackFontPx}px`,
            ...stackPositionStyle,
          }}
          className="pointer-events-none absolute -top-1.5 -right-1.5 z-20 px-[3px] py-[0.5px] rounded-full bg-amber-400 border border-[#060A12] text-slate-950 font-mono-nums font-extrabold leading-none shadow-sm"
        >
          x{Math.floor(stacks)}
        </span>
      )}
    </span>
  );
}
