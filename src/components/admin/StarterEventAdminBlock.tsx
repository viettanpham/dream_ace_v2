import { useMemo } from 'react';
import { Gift, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { getAllVouchers } from '../../data/vouchers';
import {
  CARD_CREDIT_MAX,
  CARD_CREDIT_MIN,
  CARD_EXP_MAX,
  CARD_EXP_MIN,
  clampCardValue,
  cloneStarterEventConfig,
  DEFAULT_STARTER_EVENT_CONFIG,
  estimateLevelFromExpFromLv1,
  getCardName,
  makeCardId,
  sanitizeStarterEventConfig,
  sanitizeStarterEventGranted,
  STARTER_EVENT_MAX_ENTRIES,
  STARTER_EVENT_MAX_QTY,
  summarizeStarterEvent,
} from '../../engine/starterEvent';
import { getClassName, useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type {
  AdminConfig,
  MechClassId,
  StarterEventConfig,
  StarterEventEntry,
  StarterEventEntryType,
  StarterEventMode,
} from '../../types/game';

interface StarterEventAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
  onFlash?: (msg: string) => void;
}

function fmtLocale(n: number, lang: 'vi' | 'en'): string {
  return Math.round(n).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
}

export function StarterEventAdminBlock({
  adminConfig,
  adminUpdateConfig,
  onFlash,
}: StarterEventAdminBlockProps) {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminGrantStarterEventNow = useGameStore(
    (s) => s.adminGrantStarterEventNow
  );
  const adminResetStarterEventGranted = useGameStore(
    (s) => s.adminResetStarterEventGranted
  );

  const cfg = sanitizeStarterEventConfig(
    adminConfig.starterEvent,
    adminConfig.vouchers
  );
  const allVouchers = useMemo(
    () => getAllVouchers(adminConfig.vouchers),
    [adminConfig.vouchers]
  );
  const creditVouchers = useMemo(
    () =>
      allVouchers
        .filter((v) => v.kind === 'credit')
        .sort((a, b) => a.value - b.value),
    [allVouchers]
  );
  const expVouchers = useMemo(
    () =>
      allVouchers
        .filter((v) => v.kind === 'exp')
        .sort((a, b) => a.value - b.value),
    [allVouchers]
  );

  const summary = useMemo(
    () => summarizeStarterEvent(cfg, adminConfig.vouchers),
    [cfg, adminConfig.vouchers]
  );
  const approxLevelFromExp = useMemo(
    () => estimateLevelFromExpFromLv1(summary.exp),
    [summary.exp]
  );
  const grantedIds = sanitizeStarterEventGranted(pilot.starterEventGranted);

  const commitConfig = (next: StarterEventConfig) => {
    adminUpdateConfig({
      starterEvent: sanitizeStarterEventConfig(next, adminConfig.vouchers),
    });
  };

  const handleEntryTypeChange = (
    idx: number,
    nextType: StarterEventEntryType
  ) => {
    const next = cloneStarterEventConfig(cfg);
    const cur = next.entries[idx];
    if (!cur) return;

    let nextValue = cur.value;
    if (nextType === 'card_credit') {
      nextValue = clampCardValue('credit', cur.value);
    } else if (nextType === 'card_exp') {
      nextValue = clampCardValue('exp', cur.value);
    } else if (nextType === 'voucher_credit') {
      const exact = creditVouchers.find((v) => v.value === cur.value);
      nextValue = exact?.value ?? creditVouchers[creditVouchers.length - 1]?.value ?? 1000;
    } else if (nextType === 'voucher_exp') {
      const exact = expVouchers.find((v) => v.value === cur.value);
      nextValue = exact?.value ?? expVouchers[expVouchers.length - 1]?.value ?? 1000;
    }

    next.entries[idx] = {
      type: nextType,
      value: nextValue,
      qty: cur.qty,
    };
    commitConfig(next);
  };

  const handleEntryValueChange = (idx: number, raw: number) => {
    const next = cloneStarterEventConfig(cfg);
    const cur = next.entries[idx];
    if (!cur) return;
    if (cur.type === 'card_credit') {
      next.entries[idx] = {
        ...cur,
        value: clampCardValue('credit', raw),
      };
    } else if (cur.type === 'card_exp') {
      next.entries[idx] = {
        ...cur,
        value: clampCardValue('exp', raw),
      };
    } else {
      const list = cur.type === 'voucher_credit' ? creditVouchers : expVouchers;
      const matched = list.find((v) => v.value === Math.round(raw));
      if (!matched) return;
      next.entries[idx] = {
        ...cur,
        value: matched.value,
      };
    }
    commitConfig(next);
  };

  const handleEntryQtyChange = (idx: number, raw: number) => {
    const next = cloneStarterEventConfig(cfg);
    const cur = next.entries[idx];
    if (!cur) return;
    const cleanQty = Number.isFinite(raw)
      ? Math.max(1, Math.min(STARTER_EVENT_MAX_QTY, Math.round(raw)))
      : 1;
    next.entries[idx] = {
      ...cur,
      qty: cleanQty,
    };
    commitConfig(next);
  };

  const handleDeleteEntry = (idx: number) => {
    const next = cloneStarterEventConfig(cfg);
    next.entries.splice(idx, 1);
    commitConfig(next);
  };

  const handleAddEntry = () => {
    if (cfg.entries.length >= STARTER_EVENT_MAX_ENTRIES) return;
    const next = cloneStarterEventConfig(cfg);
    const newEntry: StarterEventEntry = {
      type: 'card_credit',
      value: 10000,
      qty: 1,
    };
    next.entries.push(newEntry);
    commitConfig(next);
  };

  const formatEntryLiveLabel = (entry: StarterEventEntry): string => {
    const totalStr = fmtLocale(entry.value * entry.qty, lang);
    const valStr = fmtLocale(entry.value, lang);
    if (entry.type === 'card_credit') {
      const name = getCardName(makeCardId('credit', entry.value), lang);
      return t('admin.starterEvent.rowExample', {
        name,
        qty: entry.qty,
        total: totalStr,
        unit: 'credit',
      });
    }
    if (entry.type === 'card_exp') {
      const name = getCardName(makeCardId('exp', entry.value), lang);
      return t('admin.starterEvent.rowExample', {
        name,
        qty: entry.qty,
        total: totalStr,
        unit: 'EXP',
      });
    }
    if (entry.type === 'voucher_credit') {
      return t('admin.starterEvent.rowExample', {
        name: t('shop.voucherNameCredit', { value: valStr }),
        qty: entry.qty,
        total: totalStr,
        unit: lang === 'vi' ? 'voucher credit' : 'credit vouchers',
      });
    }
    return t('admin.starterEvent.rowExample', {
      name: t('shop.voucherNameExp', { value: valStr }),
      qty: entry.qty,
      total: totalStr,
      unit: lang === 'vi' ? 'voucher EXP' : 'EXP vouchers',
    });
  };

  return (
    <div className="space-y-3 min-w-0" data-testid="admin-starter-event-block">
      {/* Enable + Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <label className="p-2.5 rounded border border-slate-800/90 bg-[#080C14] flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-xs font-semibold text-slate-200">
            {t('admin.starterEvent.enabled')}
          </span>
          <input
            type="checkbox"
            data-testid="admin-starter-event-enabled"
            checked={cfg.enabled}
            onChange={(e) => {
              const next = cloneStarterEventConfig(cfg);
              next.enabled = e.target.checked;
              commitConfig(next);
            }}
            className="w-4 h-4 accent-amber-400"
          />
        </label>

        <div className="p-2.5 rounded border border-slate-800/90 bg-[#080C14] space-y-1.5 min-w-0">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.starterEvent.modeLabel')}
            </span>
            <select
              data-testid="admin-starter-event-mode"
              value={cfg.mode}
              onChange={(e) => {
                const nextMode: StarterEventMode =
                  e.target.value === 'perGear' ? 'perGear' : 'oncePerSave';
                const next = cloneStarterEventConfig(cfg);
                next.mode = nextMode;
                commitConfig(next);
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
            >
              <option value="oncePerSave">
                {t('admin.starterEvent.modeOnce')}
              </option>
              <option value="perGear">
                {t('admin.starterEvent.modePerGear')}
              </option>
            </select>
          </label>
          <p className="text-[11px] leading-snug text-slate-400">
            <span className={cfg.mode === 'oncePerSave' ? 'text-amber-300 font-medium' : ''}>
              oncePerSave: {t('admin.starterEvent.modeOnceDesc')}
            </span>
            {' · '}
            <span className={cfg.mode === 'perGear' ? 'text-amber-300 font-medium' : ''}>
              perGear: {t('admin.starterEvent.modePerGearDesc')}
            </span>
          </p>
        </div>
      </div>

      {/* Entries Header + Add Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-200">
          {t('admin.starterEvent.entriesTitle')} ({cfg.entries.length}/
          {STARTER_EVENT_MAX_ENTRIES})
        </span>
        <button
          type="button"
          data-testid="admin-starter-event-add-row"
          disabled={cfg.entries.length >= STARTER_EVENT_MAX_ENTRIES}
          onClick={handleAddEntry}
          className="h-8 px-2.5 inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-200 text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('admin.starterEvent.addRowBtn')}</span>
        </button>
      </div>

      {/* Entries Rows */}
      {cfg.entries.length === 0 ? (
        <div className="p-3 rounded border border-slate-800 bg-[#080C14] text-xs text-slate-400">
          {t('admin.starterEvent.emptyEntries')}
        </div>
      ) : (
        <div className="space-y-2 min-w-0">
          {cfg.entries.map((entry, idx) => {
            const isCard =
              entry.type === 'card_credit' || entry.type === 'card_exp';
            const voucherOptions =
              entry.type === 'voucher_credit' ? creditVouchers : expVouchers;
            const minCard =
              entry.type === 'card_credit' ? CARD_CREDIT_MIN : CARD_EXP_MIN;
            const maxCard =
              entry.type === 'card_credit' ? CARD_CREDIT_MAX : CARD_EXP_MAX;
            const rowExample = formatEntryLiveLabel(entry);

            return (
              <div
                key={`${entry.type}-${idx}`}
                data-testid={`admin-starter-event-row-${idx}`}
                className="p-2.5 rounded border border-slate-800 bg-[#080C14] space-y-2 min-w-0"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start min-w-0">
                  {/* Type */}
                  <label className="sm:col-span-4 space-y-1 block min-w-0">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.starterEvent.typeLabel')}
                    </span>
                    <select
                      data-testid={`admin-starter-event-type-${idx}`}
                      value={entry.type}
                      onChange={(e) =>
                        handleEntryTypeChange(
                          idx,
                          e.target.value as StarterEventEntryType
                        )
                      }
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
                    >
                      <option value="card_credit">
                        {t('admin.starterEvent.typeCardCredit')}
                      </option>
                      <option value="card_exp">
                        {t('admin.starterEvent.typeCardExp')}
                      </option>
                      <option value="voucher_credit">
                        {t('admin.starterEvent.typeVoucherCredit')}
                      </option>
                      <option value="voucher_exp">
                        {t('admin.starterEvent.typeVoucherExp')}
                      </option>
                    </select>
                  </label>

                  {/* Value */}
                  <label className="sm:col-span-4 space-y-1 block min-w-0">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.starterEvent.valueLabel')}
                    </span>
                    {isCard ? (
                      <>
                        <input
                          type="number"
                          data-testid={`admin-starter-event-value-${idx}`}
                          min={minCard}
                          max={maxCard}
                          step={100}
                          value={entry.value}
                          onChange={(e) =>
                            handleEntryValueChange(
                              idx,
                              Number(e.target.value) || minCard
                            )
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                        />
                        <span
                          data-testid={`admin-starter-event-value-ex-${idx}`}
                          className="text-[11px] text-slate-400 block leading-snug break-words"
                        >
                          {rowExample} ({t('admin.starterEvent.cardValueHint')})
                        </span>
                      </>
                    ) : (
                      <select
                        data-testid={`admin-starter-event-value-${idx}`}
                        value={entry.value}
                        onChange={(e) =>
                          handleEntryValueChange(idx, Number(e.target.value))
                        }
                        className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                      >
                        {voucherOptions.map((v) => (
                          <option key={v.id} value={v.value}>
                            {fmtLocale(v.value, lang)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>

                  {/* Qty */}
                  <label className="sm:col-span-3 space-y-1 block min-w-0">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.starterEvent.qtyLabel')} (1–{STARTER_EVENT_MAX_QTY})
                    </span>
                    <input
                      type="number"
                      data-testid={`admin-starter-event-qty-${idx}`}
                      min={1}
                      max={STARTER_EVENT_MAX_QTY}
                      value={entry.qty}
                      onChange={(e) =>
                        handleEntryQtyChange(idx, Number(e.target.value) || 1)
                      }
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                    />
                    <span
                      data-testid={`admin-starter-event-qty-ex-${idx}`}
                      className="text-[11px] text-amber-300/90 block leading-snug break-words"
                    >
                      {rowExample}
                    </span>
                  </label>

                  {/* Delete */}
                  <div className="sm:col-span-1 flex sm:justify-end sm:pt-5">
                    <button
                      type="button"
                      data-testid={`admin-starter-event-delete-${idx}`}
                      aria-label={t('admin.starterEvent.deleteRow')}
                      onClick={() => handleDeleteEntry(idx)}
                      className="h-9 px-2.5 inline-flex items-center justify-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="sm:hidden">
                        {t('admin.starterEvent.deleteRow')}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total Line */}
      <div
        data-testid="admin-starter-event-total"
        className="p-2.5 rounded border border-amber-500/35 bg-amber-950/20 text-xs font-semibold text-amber-200 break-words"
      >
        {t('admin.starterEvent.totalLine', {
          credit: fmtLocale(summary.credit, lang),
          exp: fmtLocale(summary.exp, lang),
          lv: approxLevelFromExp,
          voucherCredit: fmtLocale(summary.voucherCredit, lang),
          voucherExp: fmtLocale(summary.voucherExp, lang),
        })}
      </div>

      {/* Granted history + Action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-slate-400">
          {grantedIds.length > 0
            ? t('admin.starterEvent.grantedStatus', {
                list: grantedIds
                  .map((id) =>
                    id in pilot.gears
                      ? getClassName(lang, id as MechClassId)
                      : id
                  )
                  .join(', '),
              })
            : t('admin.starterEvent.grantedNone')}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="admin-starter-event-test-grant"
            onClick={() => {
              const count = adminGrantStarterEventNow();
              onFlash?.(t('admin.starterEvent.testGrantDone', { count }));
            }}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>{t('admin.starterEvent.testGrantBtn')}</span>
          </button>

          <button
            type="button"
            data-testid="admin-starter-event-allow-regrant"
            onClick={() => {
              adminResetStarterEventGranted();
              onFlash?.(t('admin.starterEvent.allowRegrantDone'));
            }}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold cursor-pointer"
          >
            <span>{t('admin.starterEvent.allowRegrantBtn')}</span>
          </button>

          <button
            type="button"
            data-testid="admin-starter-event-reset"
            onClick={() => {
              commitConfig(cloneStarterEventConfig(DEFAULT_STARTER_EVENT_CONFIG));
              onFlash?.(t('admin.starterEvent.resetDone'));
            }}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('admin.starterEvent.resetBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
