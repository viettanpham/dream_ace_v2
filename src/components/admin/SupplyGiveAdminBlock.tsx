import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { SUPPLY_TEMPLATES } from '../../data/consumables';
import { getSupplyStockCount, SUPPLY_STACK_CAP } from '../../engine/supplies';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import { getSupplyName } from '../SupplyLoadoutBar';

export function SupplyGiveAdminBlock() {
  const { t } = useI18n();
  const consumables = useGameStore((s) => s.pilot.consumables ?? []);
  const adminGiveSupply = useGameStore((s) => s.adminGiveSupply);

  const [target, setTarget] = useState<string>('supply_crate');
  const [qtyDraft, setQtyDraft] = useState<string>('1');
  const [feedback, setFeedback] = useState<string | null>(null);

  const parsedNum = Number(qtyDraft);
  const clampedQty = Number.isFinite(parsedNum)
    ? Math.max(1, Math.min(SUPPLY_STACK_CAP, Math.round(parsedNum)))
    : 1;

  const ownedCount =
    target === 'supply_crate'
      ? consumables
          .filter((c) => c.kind === 'supply_crate')
          .reduce((acc, c) => acc + c.quantity, 0)
      : target === 'random_supply'
      ? consumables
          .filter((c) => c.kind === 'battle_supply')
          .reduce((acc, c) => acc + c.quantity, 0)
      : getSupplyStockCount(consumables, target);

  const handleGive = () => {
    const res = adminGiveSupply(target, clampedQty);
    if (!res.ok) {
      setFeedback(t('admin.supplyGive.failed'));
      return;
    }
    const name =
      res.kind === 'supply_crate'
        ? t('consumable.supply_crate.name')
        : getSupplyName(res.templateId ?? '', t);
    const base = t('admin.supplyGive.confirm', {
      name,
      qty: res.added,
    });
    const overflow =
      res.lost > 0
        ? t('admin.supplyGive.confirmOverflow', { lost: res.lost })
        : '';
    setFeedback(`${base}${overflow}`);
  };

  return (
    <div
      data-testid="admin-supply-give-block"
      className="space-y-2.5 min-w-0"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_140px_auto] gap-2.5 items-start min-w-0">
        <label className="space-y-1 block min-w-0">
          <span className="text-[11px] text-slate-300 block">
            {t('admin.supplyGive.itemLabel')}
          </span>
          <select
            data-testid="admin-supply-give-select"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
          >
            <option value="supply_crate">
              {t('consumable.supply_crate.name')}
            </option>
            <option value="random_supply">
              {t('admin.supplyGive.randomOne')}
            </option>
            {SUPPLY_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {getSupplyName(tpl.id, t)} (T{tpl.tier})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 block min-w-0">
          <span className="text-[11px] text-slate-300 block">
            {t('admin.supplyGive.qtyLabel')}
          </span>
          <input
            type="number"
            data-testid="admin-supply-give-qty"
            min={1}
            max={SUPPLY_STACK_CAP}
            value={qtyDraft}
            onChange={(e) => setQtyDraft(e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-supply-give-qty-ex"
            className="block text-[11px] text-emerald-300/90 font-mono-nums leading-snug break-words"
          >
            {t('admin.supplyGive.qtyEx', {
              qty: clampedQty,
              owned: ownedCount,
            })}
          </span>
        </label>

        <div className="sm:pt-[19px]">
          <button
            type="button"
            data-testid="admin-supply-give-btn"
            onClick={handleGive}
            className="w-full sm:w-auto min-h-[36px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('admin.supplyGive.giveBtn')}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          data-testid="admin-supply-give-feedback"
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-200 break-words"
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
