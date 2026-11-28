import { Ticket } from 'lucide-react';
import { getCatalogRow } from '../data/iconCatalog';
import { useI18n } from '../i18n';
import type {
  IconCatalogModRow,
  SupplyTemplate,
  VoucherDef,
} from '../types/game';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { ConsumableIcon } from './GameIcons';
import { formatSupplyEffectSummary, getSupplyName } from './SupplyLoadoutBar';

export interface SupplyTradeConfirmVoucher {
  def: VoucherDef;
  name: string;
  desc: string;
}

export interface SupplyTradeConfirmCrate {
  slotId: string;
  name: string;
  desc: string;
}

export interface SupplyTradeConfirmProps {
  mode: 'buy' | 'sell';
  currency?: 'CR' | 'WP';
  template?: SupplyTemplate | null;
  voucher?: SupplyTradeConfirmVoucher | null;
  crate?: SupplyTradeConfirmCrate | null;
  qty: number;
  unitPrice: number;
  credits: number;
  iconCatalogMods?: readonly IconCatalogModRow[] | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SupplyTradeConfirm({
  mode,
  currency = 'CR',
  template = null,
  voucher = null,
  crate = null,
  qty,
  unitPrice,
  credits,
  iconCatalogMods,
  onConfirm,
  onCancel,
}: SupplyTradeConfirmProps) {
  const { t } = useI18n();
  if (!template && !voucher && !crate) return null;

  const isBuy = mode === 'buy';
  const isWp = isBuy && currency === 'WP';
  const unitLabel = isWp ? 'WP' : 'CR';
  const total = Math.max(0, Math.round(unitPrice * qty));
  const afterBalance = isBuy ? credits - total : credits + total;
  const isInsufficient = isBuy && afterBalance < 0;
  const iconRow = template
    ? (getCatalogRow(template.iconId, iconCatalogMods) ?? null)
    : null;

  const footer = (
    <div className="space-y-2">
      {isInsufficient && (
        <p
          data-testid="supply-confirm-reason"
          className="text-xs font-medium text-rose-400"
        >
          {isWp
            ? t('shop.supplyConfirmInsufficientWp')
            : t('shop.supplyConfirmInsufficient')}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="supply-confirm-cancel"
          onClick={onCancel}
          className="min-h-[40px] px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
        >
          {t('shop.supplyConfirmCancel')}
        </button>
        <button
          type="button"
          data-testid="supply-confirm-ok"
          disabled={isInsufficient}
          onClick={onConfirm}
          className={`min-h-[40px] px-4 rounded-lg border text-sm font-semibold transition-colors cursor-pointer disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed ${
            isWp
              ? 'border-purple-500/60 bg-purple-500/20 hover:bg-purple-500/30 text-purple-100'
              : isBuy
                ? 'border-amber-500/60 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100'
                : 'border-emerald-500/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100'
          }`}
        >
          {isBuy
            ? t('shop.supplyConfirmBuyBtn')
            : t('shop.supplyConfirmSellBtn')}
        </button>
      </div>
    </div>
  );

  return (
    <BottomSheet
      open={Boolean(template || voucher || crate)}
      onClose={onCancel}
      size="default"
      testId="supply-confirm-dialog"
      title={
        crate
          ? t('shop.crateConfirmBuyTitle')
          : voucher
            ? t('shop.voucherConfirmBuyTitle')
            : isBuy
              ? t('shop.supplyConfirmBuyTitle')
              : t('shop.supplyConfirmSellTitle')
      }
      footer={footer}
    >
      <div className="space-y-3 min-w-0">
        {template ? (
          <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-[#080C15] p-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded border border-slate-700/80 bg-[#0B111C] flex items-center justify-center">
              <CatalogIcon
                row={iconRow}
                size="sm"
                showBadges={false}
                showArrowBadge={false}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-slate-100 truncate">
                  {getSupplyName(template.id, t)}
                </span>
                <span className="text-[10px] font-mono-nums px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                  T{template.tier}
                </span>
              </div>
              <p className="text-xs text-emerald-300">
                {formatSupplyEffectSummary(template, t)}
              </p>
            </div>
          </div>
        ) : voucher ? (
          <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-[#080C15] p-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded border border-purple-500/40 bg-[#0B111C] flex items-center justify-center text-purple-300">
              <Ticket className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-slate-100 truncate">
                  {voucher.name}
                </span>
                <span className="text-[10px] font-mono-nums px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-200 shrink-0">
                  {voucher.def.kind === 'credit'
                    ? t('shop.voucherKindCredit')
                    : t('shop.voucherKindExp')}
                </span>
              </div>
              <p className="text-xs text-slate-300">{voucher.desc}</p>
            </div>
          </div>
        ) : crate ? (
          <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-[#080C15] p-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded border border-amber-500/40 bg-[#0B111C] flex items-center justify-center">
              <ConsumableIcon kind="supply_crate" className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-slate-100 truncate">
                  {crate.name}
                </span>
              </div>
              <p className="text-xs text-slate-300">{crate.desc}</p>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-800/90 bg-[#080C15]/80 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">{t('shop.supplyConfirmQty')}</span>
            <span className="font-mono-nums text-slate-200">×{qty}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">
              {t('shop.supplyConfirmUnitPrice')}
            </span>
            <span className="font-mono-nums text-slate-200">
              {unitPrice.toLocaleString()} {unitLabel}
            </span>
          </div>
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-sm font-bold">
            <span className="text-slate-100">{t('shop.supplyConfirmTotal')}</span>
            <span
              data-testid="supply-confirm-total"
              className={`font-mono-nums ${
                isWp
                  ? 'text-purple-300'
                  : isBuy
                    ? 'text-amber-300'
                    : 'text-emerald-300'
              }`}
            >
              {total.toLocaleString()} {unitLabel}
            </span>
          </div>
          <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-400">
              {isWp
                ? t('shop.supplyConfirmWpCurrent')
                : t('shop.supplyConfirmCreditsCurrent')}{' '}
              → {t('shop.supplyConfirmCreditsAfter')}
            </span>
            <span className="font-mono-nums">
              <span className="text-slate-300">
                {credits.toLocaleString()} {unitLabel}
              </span>
              <span className="mx-1.5 text-slate-500">→</span>
              <span
                data-testid="supply-confirm-after-credits"
                className={
                  isInsufficient
                    ? 'text-rose-400 font-bold'
                    : 'text-slate-100 font-semibold'
                }
              >
                {afterBalance.toLocaleString()} {unitLabel}
              </span>
            </span>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
