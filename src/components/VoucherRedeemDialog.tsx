import { useMemo, useState } from 'react';
import { Minus, Plus, Ticket } from 'lucide-react';
import { getAllVouchers } from '../data/vouchers';
import {
  applyVoucherRefund,
  getBattleSummaryCharges,
  getVoucherSelectionFaceSum,
  pickDefaultVoucherSelection,
} from '../engine/battlePenalty';
import type { TranslationKey } from '../i18n/en';
import type {
  AdminConfig,
  BattleSummary,
  Language,
  VoucherDef,
  VoucherKind,
} from '../types/game';

export interface VoucherRedeemDialogProps {
  summary: BattleSummary;
  ownedVouchers?: Record<string, number> | null;
  currentCredits?: number;
  adminConfig?: AdminConfig | null;
  lang: Language;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onConfirm: (selection: {
    credit: Record<string, number>;
    exp: Record<string, number>;
  }) => void;
  onSkip: () => void;
}

export function hasUsableVoucherForSummary(
  summary: BattleSummary | null | undefined,
  ownedVouchers: Record<string, number> | null | undefined,
  adminConfig?: AdminConfig | null
): boolean {
  if (!summary) return false;
  if (summary.outcome !== 'defeat' && !summary.retreated) return false;
  if (summary.voucherRedeemed) return false;
  if (!ownedVouchers) return false;

  const { creditCharged, expCharged } = getBattleSummaryCharges(summary);
  if (creditCharged <= 0 && expCharged <= 0) return false;

  const all = getAllVouchers(adminConfig);
  for (const v of all) {
    const qty = Math.max(0, Math.floor(Number(ownedVouchers[v.id]) || 0));
    if (qty <= 0) continue;
    if (v.kind === 'credit' && creditCharged > 0) return true;
    if (v.kind === 'exp' && expCharged > 0) return true;
  }
  return false;
}

export function VoucherRedeemDialog({
  summary,
  ownedVouchers,
  currentCredits = 0,
  adminConfig,
  lang,
  t,
  onConfirm,
  onSkip,
}: VoucherRedeemDialogProps) {
  const numberLocale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const { creditCharged, expCharged } = getBattleSummaryCharges(summary);

  const ownedByKind = useMemo(() => {
    const all = getAllVouchers(adminConfig);
    const credit: Array<{ def: VoucherDef; owned: number }> = [];
    const exp: Array<{ def: VoucherDef; owned: number }> = [];
    for (const def of all) {
      const qty = Math.max(
        0,
        Math.floor(Number(ownedVouchers?.[def.id]) || 0)
      );
      if (qty <= 0) continue;
      if (def.kind === 'credit') credit.push({ def, owned: qty });
      else exp.push({ def, owned: qty });
    }
    credit.sort((a, b) => a.def.value - b.def.value);
    exp.sort((a, b) => a.def.value - b.def.value);
    return { credit, exp };
  }, [ownedVouchers, adminConfig]);

  const [creditSel, setCreditSel] = useState<Record<string, number>>(() =>
    creditCharged > 0
      ? pickDefaultVoucherSelection(
          ownedVouchers,
          'credit',
          creditCharged,
          adminConfig
        )
      : {}
  );
  const [expSel, setExpSel] = useState<Record<string, number>>(() =>
    expCharged > 0
      ? pickDefaultVoucherSelection(
          ownedVouchers,
          'exp',
          expCharged,
          adminConfig
        )
      : {}
  );

  const showCredit = creditCharged > 0 && ownedByKind.credit.length > 0;
  const showExp = expCharged > 0 && ownedByKind.exp.length > 0;

  const creditRefund = showCredit
    ? applyVoucherRefund(creditSel, 'credit', creditCharged, adminConfig).refund
    : 0;
  const expRefund = showExp
    ? applyVoucherRefund(expSel, 'exp', expCharged, adminConfig).refund
    : 0;

  const totalSelected =
    (showCredit
      ? Object.values(creditSel).reduce((s, q) => s + Math.max(0, q), 0)
      : 0) +
    (showExp
      ? Object.values(expSel).reduce((s, q) => s + Math.max(0, q), 0)
      : 0);

  const updateStep = (
    kind: VoucherKind,
    id: string,
    maxOwned: number,
    delta: number
  ) => {
    const setter = kind === 'credit' ? setCreditSel : setExpSel;
    setter((prev) => {
      const cur = Math.max(0, prev[id] ?? 0);
      const next = Math.max(0, Math.min(maxOwned, cur + delta));
      const copy = { ...prev };
      if (next > 0) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  };

  const renderKindSection = (
    kind: VoucherKind,
    charged: number,
    refund: number,
    rows: Array<{ def: VoucherDef; owned: number }>,
    selection: Record<string, number>
  ) => {
    const remaining = Math.max(0, charged - refund);
    const unit = kind === 'credit' ? 'CR' : 'EXP';
    const formatAmt = (n: number) => Math.round(n).toLocaleString(numberLocale);
    const selectedFaceSum = getVoucherSelectionFaceSum(
      selection,
      kind,
      adminConfig
    );
    const wastedFace = Math.max(0, selectedFaceSum - charged);
    const safeCredits = Math.max(0, Math.round(currentCredits));
    const creditsAfterVoucher = safeCredits + Math.round(refund);

    return (
      <section
        key={kind}
        data-testid={`voucher-redeem-section-${kind}`}
        className="rounded-lg border border-slate-800 bg-[#090D14] p-3 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-purple-300">
            {kind === 'credit'
              ? t('voucher.sectionCredit')
              : t('voucher.sectionExp')}
          </h3>
        </div>

        <div
          data-testid={`voucher-redeem-summary-${kind}`}
          className="rounded border border-slate-800/90 bg-slate-950/70 px-2.5 py-2 space-y-1 text-xs font-mono-nums"
        >
          <div
            data-testid={`voucher-redeem-charged-${kind}`}
            className="text-rose-300"
          >
            {t('voucher.totalCharged', { amount: formatAmt(charged), unit })}
          </div>
          <div
            data-testid={`voucher-redeem-refund-${kind}`}
            className="text-emerald-300"
          >
            {t('voucher.refundAmount', { amount: formatAmt(refund), unit })}
          </div>
          <div
            data-testid={`voucher-redeem-remaining-${kind}`}
            className="text-slate-200 font-semibold"
          >
            {t('voucher.remainingAmount', {
              amount: formatAmt(remaining),
              unit,
            })}
          </div>
          {kind === 'credit' && (
            <>
              <div
                data-testid="voucher-redeem-credits-after"
                className="text-emerald-300 pt-0.5 border-t border-slate-800/70"
              >
                {t('voucher.creditsAfterUse', {
                  amount: formatAmt(creditsAfterVoucher),
                })}
              </div>
              <div
                data-testid="voucher-redeem-credits-skip"
                className="text-slate-400"
              >
                {t('voucher.creditsIfSkip', {
                  amount: formatAmt(safeCredits),
                })}
              </div>
              {wastedFace > 0 && (
                <div
                  data-testid="voucher-redeem-waste-credit"
                  className="text-amber-300 font-semibold"
                >
                  {t('voucher.wasteCreditWarn', {
                    amount: formatAmt(wastedFace),
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="divide-y divide-slate-800/80">
          {rows.map(({ def, owned }) => {
            const qty = Math.max(0, Math.min(owned, selection[def.id] ?? 0));
            const valFmt = def.value.toLocaleString(numberLocale);
            const label =
              def.kind === 'credit'
                ? t('shop.voucherNameCredit', { value: valFmt })
                : t('shop.voucherNameExp', { value: valFmt });

            return (
              <div
                key={def.id}
                data-testid={`voucher-redeem-row-${def.id}`}
                className="py-2 first:pt-1 last:pb-1 flex items-center justify-between gap-2 min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {label}
                  </div>
                  <div className="text-[11px] font-mono-nums text-slate-400">
                    {t('voucher.ownedLabel', { qty: owned })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid={`voucher-redeem-dec-${def.id}`}
                    disabled={qty <= 0}
                    onClick={() => updateStep(kind, def.id, owned, -1)}
                    aria-label="-"
                    className="w-8 h-8 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 inline-flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <span
                    data-testid={`voucher-redeem-qty-${def.id}`}
                    className="w-7 text-center text-xs font-mono-nums font-bold text-purple-200"
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    data-testid={`voucher-redeem-inc-${def.id}`}
                    disabled={qty >= owned}
                    onClick={() => updateStep(kind, def.id, owned, 1)}
                    aria-label="+"
                    className="w-8 h-8 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 inline-flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-x-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-redeem-title"
    >
      <div
        data-testid="voucher-redeem-dialog"
        className="w-full sm:w-[min(520px,92vw)] max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-lg border border-purple-500/40 bg-[#0E1521] shadow-2xl overflow-hidden"
      >
        <div className="px-4 pt-4 pb-3 sm:px-5 sm:pt-5 border-b border-slate-800/80 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded border border-purple-500/40 bg-purple-500/10 flex items-center justify-center text-purple-300 shrink-0">
            <Ticket className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="voucher-redeem-title"
              className="font-display text-base sm:text-lg font-bold text-slate-50"
            >
              {t('voucher.redeemTitle')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('voucher.redeemSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll px-4 py-3 sm:px-5 space-y-3">
          {showCredit &&
            renderKindSection(
              'credit',
              creditCharged,
              creditRefund,
              ownedByKind.credit,
              creditSel
            )}
          {showExp &&
            renderKindSection(
              'exp',
              expCharged,
              expRefund,
              ownedByKind.exp,
              expSel
            )}
        </div>

        <div className="px-4 py-3 sm:px-5 border-t border-slate-800/80 bg-[#0B111C] flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="voucher-redeem-skip"
            onClick={onSkip}
            className="min-h-[40px] px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
          >
            {t('voucher.skipBtn')}
          </button>
          <button
            type="button"
            data-testid="voucher-redeem-confirm"
            disabled={totalSelected <= 0}
            onClick={() =>
              onConfirm({
                credit: showCredit ? creditSel : {},
                exp: showExp ? expSel : {},
              })
            }
            className="min-h-[40px] px-4 rounded-lg border border-purple-500/60 bg-purple-500/20 hover:bg-purple-500/30 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-purple-100 text-sm font-semibold transition-colors cursor-pointer"
          >
            {t('voucher.confirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
