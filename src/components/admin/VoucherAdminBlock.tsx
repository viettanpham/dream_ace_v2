import { RotateCcw, Ticket, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  cloneVoucherConfig,
  DEFAULT_VOUCHER_CONFIG,
  getAllVouchers,
  getNextCustomVoucherId,
  getVoucherMaxStock,
  getVoucherPriceWp,
  getVoucherWeights,
  sanitizeVoucherConfig,
} from '../../data/vouchers';
import { useI18n } from '../../i18n';
import type {
  AdminConfig,
  VoucherConfig,
  VoucherDef,
  VoucherKind,
  VoucherWeightMode,
} from '../../types/game';

export interface VoucherAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
}

function fmtNum(n: number): string {
  return String(Number(n.toFixed(2)));
}

export function VoucherAdminBlock({
  adminConfig,
  adminUpdateConfig,
}: VoucherAdminBlockProps) {
  const { lang, t } = useI18n();
  const numberLocale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const cfg = sanitizeVoucherConfig(adminConfig.vouchers);
  const allVouchers = getAllVouchers(cfg);
  const weights = getVoucherWeights(cfg);

  const totalWeight = allVouchers.reduce(
    (sum, v) => sum + Math.max(0, weights[v.id] ?? 0),
    0
  );
  const eligibleCount = allVouchers.filter(
    (v) => Math.max(0, weights[v.id] ?? 0) > 0
  ).length;

  const [newKind, setNewKind] = useState<VoucherKind>('credit');
  const [newValue, setNewValue] = useState<number>(25000);
  const [newWeight, setNewWeight] = useState<number>(50);
  const [newMaxStock, setNewMaxStock] = useState<number>(3);

  const updateCfg = (patch: Partial<VoucherConfig>) => {
    adminUpdateConfig({
      vouchers: sanitizeVoucherConfig({
        ...cfg,
        ...patch,
      }),
    });
  };

  const handleOverrideWeight = (voucher: VoucherDef, rawWeight: number) => {
    const cleanWeight = Math.max(0, rawWeight);
    const nextOverrides = {
      ...cfg.overrides,
      [voucher.id]: {
        ...cfg.overrides[voucher.id],
        weight: cleanWeight,
      },
    };
    const nextCustom =
      voucher.system === false
        ? cfg.custom.map((c) =>
            c.id === voucher.id ? { ...c, weight: cleanWeight } : c
          )
        : cfg.custom;
    updateCfg({ overrides: nextOverrides, custom: nextCustom });
  };

  const handleOverrideMaxStock = (voucher: VoucherDef, rawMaxStock: number) => {
    const cleanMax = Math.max(1, Math.round(rawMaxStock));
    const nextOverrides = {
      ...cfg.overrides,
      [voucher.id]: {
        ...cfg.overrides[voucher.id],
        maxStock: cleanMax,
      },
    };
    const nextCustom =
      voucher.system === false
        ? cfg.custom.map((c) =>
            c.id === voucher.id ? { ...c, maxStock: cleanMax } : c
          )
        : cfg.custom;
    updateCfg({ overrides: nextOverrides, custom: nextCustom });
  };

  const handleCreateCustom = () => {
    const cleanValue = Math.max(1, Math.round(newValue || 1));
    const cleanWeight = Math.max(0, Number.isFinite(newWeight) ? newWeight : 0);
    const cleanMaxStock = Math.max(1, Math.round(newMaxStock || 1));
    const created: VoucherDef = {
      id: getNextCustomVoucherId(cfg.custom),
      kind: newKind,
      value: cleanValue,
      system: false,
      weight: cleanWeight,
      maxStock: cleanMaxStock,
    };
    updateCfg({ custom: [...cfg.custom, created] });
  };

  const handleDeleteCustom = (id: string) => {
    const nextOverrides = { ...cfg.overrides };
    delete nextOverrides[id];
    updateCfg({
      custom: cfg.custom.filter((c) => c.id !== id),
      overrides: nextOverrides,
    });
  };

  const exCreditWp = Math.max(1, Math.round(10000 / Math.max(1, cfg.creditPerWp)));
  const exExpWp = Math.max(1, Math.round(10000 / Math.max(1, cfg.expPerWp)));
  const decayMult = Math.max(0, 1 - cfg.tierDecayPct / 100);
  const exRank0 = cfg.baseWeight;
  const exRank1 = cfg.baseWeight * decayMult;
  const exRank2 = cfg.baseWeight * decayMult * decayMult;
  const exPicked = Math.min(cfg.typesPerRoll, eligibleCount);

  const previewNewPriceWp = getVoucherPriceWp(
    { kind: newKind, value: Math.max(1, Math.round(newValue || 1)) },
    cfg
  );
  const previewNewChancePct =
    totalWeight + Math.max(0, newWeight) > 0
      ? (Math.max(0, newWeight) / (totalWeight + Math.max(0, newWeight))) * 100
      : 0;

  return (
    <div
      data-testid="admin-voucher-block"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-4 min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Ticket
            className="w-3.5 h-3.5 text-purple-400 shrink-0"
            aria-hidden="true"
          />
          <span>{t('admin.voucher.headerNote')}</span>
        </div>
        <button
          type="button"
          data-testid="admin-voucher-reset"
          onClick={() =>
            adminUpdateConfig({
              vouchers: cloneVoucherConfig(DEFAULT_VOUCHER_CONFIG),
            })
          }
          className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 inline-flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          <span>{t('admin.voucher.reset')}</span>
        </button>
      </div>

      {/* Pricing ratios & mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.voucher.creditPerWp.title')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.voucher.creditPerWp.desc')}
          </span>
          <input
            type="number"
            min={1}
            data-testid="admin-voucher-creditPerWp"
            value={cfg.creditPerWp}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              updateCfg({ creditPerWp: Math.max(1, Math.round(raw)) });
            }}
            className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
          />
          <p
            data-testid="admin-voucher-creditPerWp-example"
            className="text-[11px] font-mono-nums text-emerald-300 pt-0.5"
          >
            {t('admin.voucher.creditPerWp.example', { wp: exCreditWp })}
          </p>
        </label>

        <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.voucher.expPerWp.title')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.voucher.expPerWp.desc')}
          </span>
          <input
            type="number"
            min={1}
            data-testid="admin-voucher-expPerWp"
            value={cfg.expPerWp}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              updateCfg({ expPerWp: Math.max(1, Math.round(raw)) });
            }}
            className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
          />
          <p
            data-testid="admin-voucher-expPerWp-example"
            className="text-[11px] font-mono-nums text-emerald-300 pt-0.5"
          >
            {t('admin.voucher.expPerWp.example', { wp: exExpWp })}
          </p>
        </label>
      </div>

      {/* Mode + Roll settings */}
      <div className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-2">
        <label className="space-y-1 block">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.voucher.mode.title')}
          </span>
          <select
            data-testid="admin-voucher-mode"
            value={cfg.mode}
            onChange={(e) =>
              updateCfg({ mode: e.target.value as VoucherWeightMode })
            }
            className="w-full sm:w-64 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
          >
            <option value="tierDecay">
              {t('admin.voucher.mode.tierDecay')}
            </option>
            <option value="perType">{t('admin.voucher.mode.perType')}</option>
          </select>
        </label>
        <div className="text-[11px] text-slate-400 space-y-0.5 leading-snug">
          <p className={cfg.mode === 'tierDecay' ? 'text-purple-200' : ''}>
            {t('admin.voucher.modeTierDecayDesc')}
          </p>
          <p className={cfg.mode === 'perType' ? 'text-purple-200' : ''}>
            {t('admin.voucher.modePerTypeDesc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.voucher.baseWeight.title')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.voucher.baseWeight.desc')}
          </span>
          <input
            type="number"
            min={0}
            data-testid="admin-voucher-baseWeight"
            value={cfg.baseWeight}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              updateCfg({ baseWeight: Math.max(0, raw) });
            }}
            className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
          />
          <p
            data-testid="admin-voucher-baseWeight-example"
            className="text-[11px] font-mono-nums text-emerald-300 pt-0.5"
          >
            {t('admin.voucher.baseWeight.example', {
              r0: fmtNum(exRank0),
              r1: fmtNum(exRank1),
              r2: fmtNum(exRank2),
            })}
          </p>
        </label>

        <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.voucher.tierDecayPct.title')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.voucher.tierDecayPct.desc')}
          </span>
          <input
            type="number"
            min={0}
            max={100}
            data-testid="admin-voucher-tierDecayPct"
            value={cfg.tierDecayPct}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              updateCfg({ tierDecayPct: Math.max(0, Math.min(100, raw)) });
            }}
            className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
          />
          <p
            data-testid="admin-voucher-tierDecayPct-example"
            className="text-[11px] font-mono-nums text-emerald-300 pt-0.5"
          >
            {t('admin.voucher.tierDecayPct.example', {
              decay: fmtNum(cfg.tierDecayPct),
              r0: fmtNum(exRank0),
              r1: fmtNum(exRank1),
            })}
          </p>
        </label>

        <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.voucher.typesPerRoll.title')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.voucher.typesPerRoll.desc')}
          </span>
          <input
            type="number"
            min={0}
            data-testid="admin-voucher-typesPerRoll"
            value={cfg.typesPerRoll}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              updateCfg({ typesPerRoll: Math.max(0, Math.round(raw)) });
            }}
            className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
          />
          <p
            data-testid="admin-voucher-typesPerRoll-example"
            className="text-[11px] font-mono-nums text-emerald-300 pt-0.5"
          >
            {t('admin.voucher.typesPerRoll.example', {
              picked: exPicked,
              eligible: eligibleCount,
              total: allVouchers.length,
            })}
          </p>
        </label>
      </div>

      {/* Create custom voucher */}
      <div
        data-testid="admin-voucher-create-form"
        className="p-3 rounded border border-slate-800 bg-slate-950/60 space-y-2.5"
      >
        <div className="text-xs font-semibold text-purple-300">
          {t('admin.voucher.createTitle')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.voucher.createKind')}
            </span>
            <select
              data-testid="admin-voucher-new-kind"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as VoucherKind)}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
            >
              <option value="credit">{t('shop.voucherKindCredit')}</option>
              <option value="exp">{t('shop.voucherKindExp')}</option>
            </select>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.voucher.createValue')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-voucher-new-value"
              value={newValue}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                setNewValue(Math.max(1, Math.round(raw)));
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <p className="text-[11px] font-mono-nums text-emerald-300">
              {t('admin.voucher.createValueExample', { wp: previewNewPriceWp })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.voucher.createWeight')}
            </span>
            <input
              type="number"
              min={0}
              data-testid="admin-voucher-new-weight"
              value={newWeight}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                setNewWeight(Math.max(0, raw));
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <p className="text-[11px] font-mono-nums text-emerald-300">
              {t('admin.voucher.createWeightExample', {
                pct: previewNewChancePct.toFixed(1),
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.voucher.createMaxStock')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-voucher-new-maxStock"
              value={newMaxStock}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                setNewMaxStock(Math.max(1, Math.round(raw)));
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <p className="text-[11px] font-mono-nums text-emerald-300">
              {t('admin.voucher.createMaxStockExample', {
                max: Math.max(1, Math.round(newMaxStock || 1)),
              })}
            </p>
          </label>
        </div>

        <button
          type="button"
          data-testid="admin-voucher-create-submit"
          onClick={handleCreateCustom}
          className="min-h-[36px] px-3.5 rounded bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('admin.voucher.createSubmit')}</span>
        </button>
      </div>

      {/* Table of all vouchers */}
      <div className="space-y-2 min-w-0">
        <div className="text-xs font-semibold text-slate-200">
          {t('admin.voucher.tableTitle', { count: allVouchers.length })}
        </div>
        <div className="overflow-x-auto rounded border border-slate-800 bg-slate-950/60">
          <table
            data-testid="admin-voucher-table"
            className="w-full text-left border-collapse text-xs"
          >
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-900/70">
                <th className="py-2 px-2.5 font-semibold">
                  {t('admin.voucher.colKind')}
                </th>
                <th className="py-2 px-2.5 font-semibold">
                  {t('admin.voucher.colValue')}
                </th>
                <th className="py-2 px-2.5 font-semibold">
                  {t('admin.voucher.colPriceWp')}
                </th>
                <th className="py-2 px-2.5 font-semibold">
                  {t('admin.voucher.colWeight')}
                </th>
                <th className="py-2 px-2.5 font-semibold">
                  {t('admin.voucher.colMaxStock')}
                </th>
                <th className="py-2 px-2.5 font-semibold">
                  {t('admin.voucher.colChance')}
                </th>
                <th className="py-2 px-2.5 font-semibold text-right">
                  {t('admin.voucher.colAction')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {allVouchers.map((v) => {
                const weightVal = Math.max(0, weights[v.id] ?? 0);
                const maxStockVal = getVoucherMaxStock(v, cfg);
                const priceWp = getVoucherPriceWp(v, cfg);
                const chancePct =
                  totalWeight > 0 ? (weightVal / totalWeight) * 100 : 0;
                const isCustom = v.system === false;
                return (
                  <tr
                    key={v.id}
                    data-testid={`admin-voucher-row-${v.id}`}
                    className="hover:bg-slate-900/40"
                  >
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono-nums px-1.5 py-0.5 rounded border ${
                            v.kind === 'credit'
                              ? 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                              : 'border-sky-500/40 bg-sky-950/40 text-sky-200'
                          }`}
                        >
                          {v.kind === 'credit'
                            ? t('shop.voucherKindCredit')
                            : t('shop.voucherKindExp')}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {isCustom
                            ? t('admin.voucher.customTag')
                            : t('admin.voucher.systemTag')}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2.5 font-mono-nums text-slate-200 whitespace-nowrap">
                      {v.value.toLocaleString(numberLocale)}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono-nums text-purple-300 whitespace-nowrap">
                      {priceWp.toLocaleString()} WP
                    </td>
                    <td className="py-1.5 px-2.5">
                      <input
                        type="number"
                        min={0}
                        data-testid={`admin-voucher-weight-${v.id}`}
                        value={Number(weightVal.toFixed(2))}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) return;
                          handleOverrideWeight(v, raw);
                        }}
                        className="w-20 h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                      />
                    </td>
                    <td className="py-1.5 px-2.5">
                      <input
                        type="number"
                        min={1}
                        data-testid={`admin-voucher-maxStock-${v.id}`}
                        value={maxStockVal}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) return;
                          handleOverrideMaxStock(v, raw);
                        }}
                        className="w-16 h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                      />
                    </td>
                    <td
                      data-testid={`admin-voucher-chance-${v.id}`}
                      className="py-1.5 px-2.5 font-mono-nums text-emerald-300 whitespace-nowrap"
                    >
                      {chancePct.toFixed(2)}%
                    </td>
                    <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      {isCustom ? (
                        <button
                          type="button"
                          data-testid={`admin-voucher-delete-${v.id}`}
                          onClick={() => handleDeleteCustom(v.id)}
                          aria-label={t('admin.voucher.deleteCustom')}
                          className="h-8 px-2 rounded border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>{t('admin.voucher.deleteCustom')}</span>
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
