import { useMemo, useState } from 'react';
import { ChevronDown, Gift, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  BUFF_CARD_KINDS,
  BUFF_CARD_LIST,
  getBuffCardId,
  getBuffCardPercent,
  getBuffCardTiersRange,
  parseBuffCardId,
} from '../../data/buffCards';
import { getSupplyTemplateById, SUPPLY_TEMPLATES } from '../../data/consumables';
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
import {
  getBuffCardKindLabel,
  getBuffCardName,
  getClassName,
  useI18n,
} from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type {
  AdminConfig,
  BuffCardKind,
  MechClassId,
  StarterEventConfig,
  StarterEventEntry,
  StarterEventEntryType,
  StarterEventMode,
} from '../../types/game';
import { getSupplyName } from '../SupplyLoadoutBar';

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

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [menuBuffKind, setMenuBuffKind] = useState<BuffCardKind>('attack');
  const [menuBuffTier, setMenuBuffTier] = useState<number>(1);
  const [menuSupplyId, setMenuSupplyId] = useState<string>(
    SUPPLY_TEMPLATES[0]?.id ?? 'sup_hp_t1'
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
    let nextRefId: string | undefined = undefined;
    if (nextType === 'card_credit') {
      nextValue = clampCardValue('credit', cur.value);
    } else if (nextType === 'card_exp') {
      nextValue = clampCardValue('exp', cur.value);
    } else if (nextType === 'voucher_credit') {
      const exact = creditVouchers.find((v) => v.value === cur.value);
      nextValue =
        exact?.value ?? creditVouchers[creditVouchers.length - 1]?.value ?? 1000;
    } else if (nextType === 'voucher_exp') {
      const exact = expVouchers.find((v) => v.value === cur.value);
      nextValue =
        exact?.value ?? expVouchers[expVouchers.length - 1]?.value ?? 1000;
    } else if (nextType === 'buff_card') {
      nextRefId = BUFF_CARD_LIST[0]?.id ?? 'bcard_exp_t0';
      nextValue = 0;
    } else if (nextType === 'supply') {
      const tpl = SUPPLY_TEMPLATES[0];
      nextRefId = tpl?.id ?? 'sup_hp_t1';
      nextValue = tpl?.tier ?? 1;
    }

    next.entries[idx] = {
      type: nextType,
      value: nextValue,
      qty: cur.qty,
      ...(nextRefId ? { refId: nextRefId } : {}),
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
    } else if (cur.type === 'voucher_credit' || cur.type === 'voucher_exp') {
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

  const handleEntryRefChange = (idx: number, refId: string) => {
    const next = cloneStarterEventConfig(cfg);
    const cur = next.entries[idx];
    if (!cur) return;
    if (cur.type === 'buff_card') {
      const parsed = parseBuffCardId(refId);
      if (!parsed) return;
      next.entries[idx] = {
        ...cur,
        refId: getBuffCardId(parsed.kind, parsed.tier),
        value: parsed.tier,
      };
    } else if (cur.type === 'supply') {
      const tpl = getSupplyTemplateById(refId);
      if (!tpl) return;
      next.entries[idx] = {
        ...cur,
        refId: tpl.id,
        value: tpl.tier,
      };
    }
    commitConfig(next);
  };

  const handleEntryQtyChange = (idx: number, raw: number) => {
    const next = cloneStarterEventConfig(cfg);
    const cur = next.entries[idx];
    if (!cur) return;
    const cleanQty = Number.isFinite(raw)
      ? Math.max(0, Math.min(STARTER_EVENT_MAX_QTY, Math.round(raw)))
      : 0;
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

  const appendEntry = (entry: StarterEventEntry) => {
    if (cfg.entries.length >= STARTER_EVENT_MAX_ENTRIES) return;
    const next = cloneStarterEventConfig(cfg);
    next.entries.push(entry);
    commitConfig(next);
    setAddMenuOpen(false);
  };

  const formatEntryLiveLabel = (entry: StarterEventEntry): string => {
    if (entry.type === 'buff_card') {
      const parsed = parseBuffCardId(entry.refId);
      const name = parsed
        ? getBuffCardName(lang, parsed.kind, parsed.tier)
        : entry.refId ?? '';
      const pct = parsed
        ? getBuffCardPercent(parsed.kind, parsed.tier, adminConfig)
        : 0;
      return `${t('admin.starterEvent.rowItemExample', {
        name,
        qty: entry.qty,
      })} (+${pct}%)`;
    }
    if (entry.type === 'supply') {
      const tpl = entry.refId ? getSupplyTemplateById(entry.refId) : undefined;
      const name = tpl
        ? `${getSupplyName(tpl.id, t)} (T${tpl.tier})`
        : entry.refId ?? '';
      return t('admin.starterEvent.rowItemExample', {
        name,
        qty: entry.qty,
      });
    }
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

  const hasExtraSummary =
    summary.buffCardsCount > 0 || summary.suppliesCount > 0;
  const menuBuffTiers = getBuffCardTiersRange(menuBuffKind);
  const effectiveMenuBuffTier = menuBuffTiers.includes(menuBuffTier)
    ? menuBuffTier
    : menuBuffTiers[0] ?? 1;

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
            <span
              className={
                cfg.mode === 'oncePerSave' ? 'text-amber-300 font-medium' : ''
              }
            >
              oncePerSave: {t('admin.starterEvent.modeOnceDesc')}
            </span>
            {' · '}
            <span
              className={
                cfg.mode === 'perGear' ? 'text-amber-300 font-medium' : ''
              }
            >
              perGear: {t('admin.starterEvent.modePerGearDesc')}
            </span>
          </p>
        </div>
      </div>

      {/* Entries Header + Grouped "+ Thêm dòng" Menu */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-200">
            {t('admin.starterEvent.entriesTitle')} ({cfg.entries.length}/
            {STARTER_EVENT_MAX_ENTRIES})
          </span>
          <button
            type="button"
            data-testid="admin-starter-event-add-row"
            disabled={cfg.entries.length >= STARTER_EVENT_MAX_ENTRIES}
            onClick={() => setAddMenuOpen((v) => !v)}
            className="h-8 px-2.5 inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-200 text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('admin.starterEvent.addRowBtn')}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {addMenuOpen && (
          <div
            data-testid="admin-starter-event-add-menu"
            className="rounded-lg border border-emerald-500/40 bg-[#080C14] p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs"
          >
            {/* Group 1: Thẻ */}
            <div className="space-y-1.5 rounded border border-slate-800 bg-slate-950/70 p-2">
              <div className="text-[11px] font-bold text-amber-300">
                {t('admin.starterEvent.menuGroupCards')}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  data-testid="admin-starter-add-card-credit"
                  onClick={() =>
                    appendEntry({
                      type: 'card_credit',
                      value: 10000,
                      qty: 1,
                    })
                  }
                  className="h-8 px-2 text-left rounded border border-slate-700 bg-slate-900 hover:border-amber-400 text-slate-100 cursor-pointer"
                >
                  {t('admin.starterEvent.typeCardCredit')}
                </button>
                <button
                  type="button"
                  data-testid="admin-starter-add-card-exp"
                  onClick={() =>
                    appendEntry({
                      type: 'card_exp',
                      value: 5000,
                      qty: 1,
                    })
                  }
                  className="h-8 px-2 text-left rounded border border-slate-700 bg-slate-900 hover:border-amber-400 text-slate-100 cursor-pointer"
                >
                  {t('admin.starterEvent.typeCardExp')}
                </button>
              </div>
            </div>

            {/* Group 2: Voucher */}
            <div className="space-y-1.5 rounded border border-slate-800 bg-slate-950/70 p-2">
              <div className="text-[11px] font-bold text-purple-300">
                {t('admin.starterEvent.menuGroupVouchers')}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  data-testid="admin-starter-add-voucher-credit"
                  onClick={() =>
                    appendEntry({
                      type: 'voucher_credit',
                      value:
                        creditVouchers[creditVouchers.length - 1]?.value ??
                        100000,
                      qty: 1,
                    })
                  }
                  className="h-8 px-2 text-left rounded border border-slate-700 bg-slate-900 hover:border-purple-400 text-slate-100 cursor-pointer"
                >
                  {t('admin.starterEvent.typeVoucherCredit')}
                </button>
                <button
                  type="button"
                  data-testid="admin-starter-add-voucher-exp"
                  onClick={() =>
                    appendEntry({
                      type: 'voucher_exp',
                      value:
                        expVouchers[expVouchers.length - 1]?.value ?? 100000,
                      qty: 1,
                    })
                  }
                  className="h-8 px-2 text-left rounded border border-slate-700 bg-slate-900 hover:border-purple-400 text-slate-100 cursor-pointer"
                >
                  {t('admin.starterEvent.typeVoucherExp')}
                </button>
              </div>
            </div>

            {/* Group 3: Thẻ buff (7 kinds, pick tier) */}
            <div className="space-y-1.5 rounded border border-slate-800 bg-slate-950/70 p-2">
              <div className="text-[11px] font-bold text-emerald-300">
                {t('admin.starterEvent.menuGroupBuffCards')}
              </div>
              <select
                data-testid="admin-starter-add-buff-kind"
                value={menuBuffKind}
                onChange={(e) => {
                  const nextKind = e.target.value as BuffCardKind;
                  setMenuBuffKind(nextKind);
                  const validTiers = getBuffCardTiersRange(nextKind);
                  if (!validTiers.includes(menuBuffTier)) {
                    setMenuBuffTier(validTiers[0] ?? 1);
                  }
                }}
                className="w-full h-8 px-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
              >
                {BUFF_CARD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {getBuffCardKindLabel(lang, k)}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <select
                  data-testid="admin-starter-add-buff-tier"
                  value={effectiveMenuBuffTier}
                  onChange={(e) => setMenuBuffTier(Number(e.target.value))}
                  className="flex-1 h-8 px-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
                >
                  {menuBuffTiers.map((tier) => (
                    <option key={tier} value={tier}>
                      T{tier} (+
                      {getBuffCardPercent(menuBuffKind, tier, adminConfig)}%)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="admin-starter-add-buff-confirm"
                  onClick={() =>
                    appendEntry({
                      type: 'buff_card',
                      refId: getBuffCardId(menuBuffKind, effectiveMenuBuffTier),
                      value: effectiveMenuBuffTier,
                      qty: 1,
                    })
                  }
                  className="h-8 px-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Group 4: Vật tư */}
            <div className="space-y-1.5 rounded border border-slate-800 bg-slate-950/70 p-2">
              <div className="text-[11px] font-bold text-sky-300">
                {t('admin.starterEvent.menuGroupSupplies')}
              </div>
              <select
                data-testid="admin-starter-add-supply-select"
                value={menuSupplyId}
                onChange={(e) => setMenuSupplyId(e.target.value)}
                className="w-full h-8 px-1.5 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
              >
                {SUPPLY_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {getSupplyName(tpl.id, t)} (T{tpl.tier})
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="admin-starter-add-supply-confirm"
                onClick={() => {
                  const tpl = getSupplyTemplateById(menuSupplyId);
                  if (!tpl) return;
                  appendEntry({
                    type: 'supply',
                    refId: tpl.id,
                    value: tpl.tier,
                    qty: 1,
                  });
                }}
                className="w-full h-8 px-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                + {t('admin.starterEvent.typeSupply')}
              </button>
            </div>
          </div>
        )}
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
            const isVoucher =
              entry.type === 'voucher_credit' || entry.type === 'voucher_exp';
            const isBuffCard = entry.type === 'buff_card';
            const isSupply = entry.type === 'supply';
            const isZeroQty = entry.qty <= 0;
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
                className={`p-2.5 rounded border border-slate-800 bg-[#080C14] space-y-2 min-w-0 transition-opacity ${
                  isZeroQty ? 'opacity-50' : ''
                }`}
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
                      <option value="buff_card">
                        {t('admin.starterEvent.typeBuffCard')}
                      </option>
                      <option value="supply">
                        {t('admin.starterEvent.typeSupply')}
                      </option>
                    </select>
                  </label>

                  {/* Value / Target Picker */}
                  <label className="sm:col-span-4 space-y-1 block min-w-0">
                    <span className="text-[11px] text-slate-400 block">
                      {isBuffCard || isSupply
                        ? t('admin.starterEvent.pickItem')
                        : t('admin.starterEvent.valueLabel')}
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
                    ) : isVoucher ? (
                      <>
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
                        <span className="text-[11px] text-slate-400 block leading-snug break-words">
                          {rowExample}
                        </span>
                      </>
                    ) : isBuffCard ? (
                      <>
                        <select
                          data-testid={`admin-starter-event-ref-${idx}`}
                          value={entry.refId ?? 'bcard_exp_t0'}
                          onChange={(e) =>
                            handleEntryRefChange(idx, e.target.value)
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
                        >
                          {BUFF_CARD_LIST.map((def) => (
                            <option key={def.id} value={def.id}>
                              {getBuffCardName(lang, def.kind, def.tier)} (+
                              {getBuffCardPercent(def.kind, def.tier, adminConfig)}
                              %)
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-400 block leading-snug break-words">
                          {rowExample}
                        </span>
                      </>
                    ) : (
                      <>
                        <select
                          data-testid={`admin-starter-event-ref-${idx}`}
                          value={entry.refId ?? 'sup_hp_t1'}
                          onChange={(e) =>
                            handleEntryRefChange(idx, e.target.value)
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
                        >
                          {SUPPLY_TEMPLATES.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {getSupplyName(tpl.id, t)} (T{tpl.tier})
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-400 block leading-snug break-words">
                          {rowExample}
                        </span>
                      </>
                    )}
                  </label>

                  {/* Qty (min 0) */}
                  <label className="sm:col-span-3 space-y-1 block min-w-0">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.starterEvent.qtyLabel')} (0–{STARTER_EVENT_MAX_QTY})
                    </span>
                    <input
                      type="number"
                      data-testid={`admin-starter-event-qty-${idx}`}
                      min={0}
                      max={STARTER_EVENT_MAX_QTY}
                      value={entry.qty}
                      onChange={(e) =>
                        handleEntryQtyChange(
                          idx,
                          e.target.value === '' ? 0 : Number(e.target.value)
                        )
                      }
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                    />
                    <span
                      data-testid={`admin-starter-event-qty-ex-${idx}`}
                      className="text-[11px] text-amber-300/90 block leading-snug break-words"
                    >
                      {isZeroQty
                        ? t('admin.starterEvent.rowDisabledNote')
                        : rowExample}
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
        {hasExtraSummary
          ? t('admin.starterEvent.totalLineExtra', {
              credit: fmtLocale(summary.credit, lang),
              exp: fmtLocale(summary.exp, lang),
              lv: approxLevelFromExp,
              voucherCredit: fmtLocale(summary.voucherCredit, lang),
              voucherExp: fmtLocale(summary.voucherExp, lang),
              buffCards: fmtLocale(summary.buffCardsCount, lang),
              supplies: fmtLocale(summary.suppliesCount, lang),
            })
          : t('admin.starterEvent.totalLine', {
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
