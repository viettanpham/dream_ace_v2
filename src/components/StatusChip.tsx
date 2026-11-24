import {
  formatStatusChipShortValue,
  getCatalogRowForStatus,
  getFirstExpiringTurns,
  getStatusVisualKind,
} from '../data/statusIconMap';
import { formatStatusEffectDetail, getStatusDesc, translate } from '../i18n';
import type {
  ActiveStatusEffect,
  CombatUnit,
  IconCatalogModRow,
  Language,
  StatusBadgeLayout,
} from '../types/game';
import {
  STATUS_CHIP_PAD_LEFT_PX,
  STATUS_CHIP_PAD_RIGHT_PX,
  STATUS_CHIP_VALUE_FONT_PX,
  STATUS_CHIP_VALUE_GAP_PX,
  STATUS_ICON_SIZE_SPECS,
} from '../utils/statusDisplayPrefs';
import { CatalogIcon, type CatalogIconSize } from './CatalogIcon';

export interface StatusChipProps {
  status: ActiveStatusEffect;
  lang: Language;
  unit?: CombatUnit | null;
  badgeLayout?: StatusBadgeLayout;
  iconMods?: readonly IconCatalogModRow[] | null;
  size?: CatalogIconSize;
  showLabel?: boolean;
  /** Engine currently does not add additive stacks; pass true only when stacked data is supplied */
  allowStack?: boolean;
  stacks?: number;
  stackTurns?: readonly number[];
  testId?: string;
  labelTestId?: string;
  className?: string;
}

/**
 * Shared compact StatusChip:
 * - Renders catalog icon (or neutral Lucide fallback for allowlisted unmapped statuses)
 * - Shows short value text ONLY (e.g. "+30% ST", "+184 HP/lượt") — NO effect name, NO "(N lượt)"
 * - Respects badgeLayout (A/B) for arrow + turns corner placement
 * - Shows yellow "x2" stack badge ONLY when allowStack === true && stacks >= 2
 */
export function StatusChip({
  status,
  lang,
  unit = null,
  badgeLayout = 'B',
  iconMods,
  size = 'sm',
  showLabel = true,
  allowStack = false,
  stacks = 1,
  stackTurns,
  testId,
  labelTestId,
  className = '',
}: StatusChipProps) {
  const catalogRow = getCatalogRowForStatus(status.type, iconMods);
  const visualKind = getStatusVisualKind(status, catalogRow);
  const shortValue = formatStatusChipShortValue(
    lang,
    status,
    unit,
    stacks,
    allowStack
  );
  const turnsLeft = getFirstExpiringTurns(status, stackTurns, allowStack);
  const fullDetail = formatStatusEffectDetail(lang, status, unit);
  const effectiveStacks =
    allowStack && Number.isFinite(stacks) && stacks >= 2
      ? Math.floor(stacks)
      : 1;
  const turnsText =
    turnsLeft !== null
      ? translate(lang, 'statusUi.turnsLabel', { turns: turnsLeft })
      : translate(lang, 'statusUi.turnsInfinite');
  const stacksText = `${translate(lang, 'statusUi.stacksLabel')}: x${effectiveStacks}`;
  const nameAndValue = fullDetail.valueText
    ? `${fullDetail.label}: ${fullDetail.valueText}`
    : fullDetail.label;
  const extraDesc =
    status.type === 'shield_break' || status.type === 'shield_cracked'
      ? ` · ${getStatusDesc(lang, status.type, turnsLeft ?? 1)}`
      : '';
  const accessibleSummary = `${nameAndValue} · ${turnsText} · ${stacksText}${extraDesc}`;

  const isMini = size === 'xs';
  const framePx = STATUS_ICON_SIZE_SPECS[size].boxPx;

  const chipTintClass =
    visualKind === 'debuff'
      ? 'border-red-500/45 bg-red-950/35 text-red-100'
      : visualKind === 'buff'
      ? 'border-emerald-500/45 bg-emerald-950/35 text-emerald-100'
      : 'border-slate-600/60 bg-slate-900/75 text-slate-200';

  const chipStyle = isMini
    ? undefined
    : {
        paddingLeft: `${STATUS_CHIP_PAD_LEFT_PX}px`,
        paddingRight: `${STATUS_CHIP_PAD_RIGHT_PX}px`,
        paddingTop: 0,
        paddingBottom: 0,
        gap: `${STATUS_CHIP_VALUE_GAP_PX}px`,
        fontSize: `${STATUS_CHIP_VALUE_FONT_PX}px`,
      };

  return (
    <span
      data-testid={testId}
      data-status-type={status.type}
      data-status-kind={visualKind}
      data-badge-layout={badgeLayout}
      data-chip-size={size}
      data-chip-frame-px={framePx}
      title={accessibleSummary}
      aria-label={accessibleSummary}
      style={chipStyle}
      className={`inline-flex items-center rounded-md border font-mono-nums leading-none shrink-0 ${
        isMini
          ? 'gap-1.5 pl-0.5 pr-1.5 py-0.5 text-[10px] font-semibold'
          : 'font-bold'
      } ${chipTintClass} ${className}`}
    >
      <CatalogIcon
        row={catalogRow}
        fallbackStatusType={status.type}
        kindOverride={visualKind}
        size={size}
        badgeLayout={badgeLayout}
        turnsLeft={turnsLeft}
        stacks={stacks}
        allowStack={allowStack}
      />
      {showLabel && (
        <span
          data-testid={labelTestId}
          className="whitespace-nowrap leading-none"
        >
          {shortValue}
        </span>
      )}
    </span>
  );
}
