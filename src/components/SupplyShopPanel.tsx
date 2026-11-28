import { RefreshCw, Ticket } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  getSupplyTemplateById,
  SUPPLY_TEMPLATE_FAMILIES,
} from '../data/consumables';
import { getCatalogRow } from '../data/iconCatalog';
import { SHOP_CONFIG } from '../data/items';
import { getVoucherById, getVoucherPriceWp } from '../data/vouchers';
import { computeSupplyPrice } from '../engine/itemPrice';
import {
  getSupplyWpPrice,
  sanitizeCrateShopConfig,
  sanitizeSupplyShopMaxRefreshes,
  sanitizeSupplyShopRefresh,
  sanitizeSupplyShopRefreshBaseCost,
} from '../engine/shop';
import { getSupplyStockCount, SUPPLY_STACK_CAP } from '../engine/supplies';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { isBattleActive, useGameStore } from '../store/useGameStore';
import type {
  CrateShopListing,
  SupplyFamily,
  SupplyShopListing,
  SupplyShopWpListing,
  SupplyTemplate,
  VoucherDef,
  VoucherShopListing,
} from '../types/game';
import { CatalogIcon } from './CatalogIcon';
import { ConsumableIcon } from './GameIcons';
import { formatSupplyEffectSummary, getSupplyName } from './SupplyLoadoutBar';
import {
  SupplyTradeConfirm,
  type SupplyTradeConfirmCrate,
  type SupplyTradeConfirmVoucher,
} from './SupplyTradeConfirm';

export interface SupplyShopPanelProps {
  onNotice?: (message: string) => void;
}

const BUY_QUANTITIES = [1, 5, 10] as const;
const VOUCHER_BUY_QUANTITIES = [1, 5] as const;
const SELL_QUANTITIES = [1, 5] as const;

interface ResolvedListingRow {
  rowKey: string;
  remaining: number;
  tpl: SupplyTemplate;
  owned: number;
  unitPrice: number;
  currency: 'CR' | 'WP';
  wpSlotId?: string;
}

interface OwnedSupplyRow {
  tpl: SupplyTemplate;
  owned: number;
  unitSellPrice: number;
}

interface VoucherListingRow {
  def: VoucherDef;
  name: string;
  desc: string;
  remaining: number;
  owned: number;
  unitPrice: number;
}

export function SupplyShopPanel({ onNotice }: SupplyShopPanelProps) {
  const { lang, t } = useI18n();
  const credits = useGameStore((s) => s.pilot.credits);
  const warPoints = useGameStore((s) => s.pilot.warPoints ?? 0);
  const consumables = useGameStore((s) => s.pilot.consumables);
  const ownedVouchers = useGameStore((s) => s.pilot.vouchers);
  const supplyShopStock = useGameStore((s) => s.supplyShopStock);
  const supplyShopStockWp = useGameStore((s) => s.supplyShopStockWp);
  const voucherShopStockWp = useGameStore((s) => s.voucherShopStockWp);
  const crateShopStockWp = useGameStore((s) => s.crateShopStockWp);
  const crateShopStockCredit = useGameStore((s) => s.crateShopStockCredit);
  const supplyShopRefresh = useGameStore((s) => s.supplyShopRefresh);
  const battlesUntilRestock = useGameStore((s) => s.battlesUntilRestock);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const iconCatalogMods = useGameStore((s) => s.adminConfig.iconCatalogMods);
  const screen = useGameStore((s) => s.screen);
  const battle = useGameStore((s) => s.battle);
  const autoRepeatActive = useGameStore((s) =>
    Boolean(s.autoRepeatSession?.active)
  );
  const buySupply = useGameStore((s) => s.buySupply);
  const buySupplyWp = useGameStore((s) => s.buySupplyWp);
  const buyVoucher = useGameStore((s) => s.buyVoucher);
  const buyCrateWp = useGameStore((s) => s.buyCrateWp);
  const buyCrateCredit = useGameStore((s) => s.buyCrateCredit);
  const refreshSupplyShop = useGameStore((s) => s.refreshSupplyShop);
  const sellSupply = useGameStore((s) => s.sellSupply);

  const isLocked = isBattleActive({ screen, battle }) || autoRepeatActive;
  const [crateQtyBySlot, setCrateQtyBySlot] = useState<Record<string, number>>(
    {}
  );
  const [pendingTrade, setPendingTrade] = useState<{
    mode: 'buy' | 'sell';
    currency: 'CR' | 'WP';
    template?: SupplyTemplate;
    voucher?: SupplyTradeConfirmVoucher;
    crate?: SupplyTradeConfirmCrate;
    qty: number;
    unitPrice: number;
    wpSlotId?: string;
  } | null>(null);

  const groupedFamilies = useMemo(() => {
    const byFamily = new Map<SupplyFamily, ResolvedListingRow[]>();
    for (const family of SUPPLY_TEMPLATE_FAMILIES) {
      byFamily.set(family, []);
    }
    for (const listing of supplyShopStock as SupplyShopListing[]) {
      const tpl = getSupplyTemplateById(listing.templateId);
      if (!tpl) continue;
      const bucket = byFamily.get(tpl.family);
      if (!bucket) continue;
      bucket.push({
        rowKey: tpl.id,
        remaining: listing.remaining,
        tpl,
        owned: getSupplyStockCount(consumables, tpl.id),
        unitPrice: computeSupplyPrice(tpl, adminConfig),
        currency: 'CR',
      });
    }
    const result: Array<{ family: SupplyFamily; rows: ResolvedListingRow[] }> =
      [];
    for (const family of SUPPLY_TEMPLATE_FAMILIES) {
      const rows = byFamily.get(family) ?? [];
      if (rows.length === 0) continue;
      rows.sort(
        (a, b) => a.tpl.tier - b.tpl.tier || a.tpl.id.localeCompare(b.tpl.id)
      );
      result.push({ family, rows });
    }
    return result;
  }, [supplyShopStock, consumables, adminConfig]);

  const wpRows = useMemo<ResolvedListingRow[]>(() => {
    const rows: ResolvedListingRow[] = [];
    for (const listing of supplyShopStockWp as SupplyShopWpListing[]) {
      const tpl = getSupplyTemplateById(listing.templateId);
      if (!tpl) continue;
      rows.push({
        rowKey: listing.slotId,
        remaining: listing.remaining,
        tpl,
        owned: getSupplyStockCount(consumables, tpl.id),
        unitPrice: getSupplyWpPrice(tpl, adminConfig),
        currency: 'WP',
        wpSlotId: listing.slotId,
      });
    }
    return rows;
  }, [supplyShopStockWp, consumables, adminConfig]);

  const voucherRows = useMemo<VoucherListingRow[]>(() => {
    const numberLocale = lang === 'vi' ? 'vi-VN' : 'en-US';
    const rows: VoucherListingRow[] = [];
    for (const listing of (voucherShopStockWp ?? []) as VoucherShopListing[]) {
      const def = getVoucherById(listing.voucherId, adminConfig);
      if (!def) continue;
      const valueFormatted = def.value.toLocaleString(numberLocale);
      const name =
        def.kind === 'credit'
          ? t('shop.voucherNameCredit', { value: valueFormatted })
          : t('shop.voucherNameExp', { value: valueFormatted });
      const desc =
        def.kind === 'credit'
          ? t('shop.voucherCreditDesc')
          : t('shop.voucherExpDesc');
      rows.push({
        def,
        name,
        desc,
        remaining: Math.max(0, Math.floor(listing.remaining)),
        owned: Math.max(0, Math.floor(ownedVouchers?.[def.id] ?? 0)),
        unitPrice: getVoucherPriceWp(def, adminConfig),
      });
    }
    return rows;
  }, [voucherShopStockWp, ownedVouchers, adminConfig, lang, t]);

  const crateCfg = useMemo(
    () => sanitizeCrateShopConfig(adminConfig?.crateShop),
    [adminConfig]
  );

  const crateOwned = useMemo(
    () =>
      (consumables ?? []).reduce(
        (sum, c) =>
          c.kind === 'supply_crate'
            ? sum + Math.max(0, Math.floor(c.quantity))
            : sum,
        0
      ),
    [consumables]
  );

  const crateCreditRows = useMemo<CrateShopListing[]>(
    () => (crateShopStockCredit ?? []) as CrateShopListing[],
    [crateShopStockCredit]
  );

  const crateWpRows = useMemo<CrateShopListing[]>(
    () => (crateShopStockWp ?? []) as CrateShopListing[],
    [crateShopStockWp]
  );

  const creditCount = useMemo(
    () =>
      crateCreditRows.length +
      groupedFamilies.reduce((sum, g) => sum + g.rows.length, 0),
    [crateCreditRows.length, groupedFamilies]
  );

  const ownedRows = useMemo<OwnedSupplyRow[]>(() => {
    const seen = new Set<string>();
    const rows: OwnedSupplyRow[] = [];
    for (const item of consumables ?? []) {
      if (item.kind !== 'battle_supply' || item.quantity <= 0) continue;
      const tplId = item.templateId ?? item.id;
      if (seen.has(tplId)) continue;
      const tpl = getSupplyTemplateById(tplId);
      if (!tpl) continue;
      seen.add(tplId);
      const owned = getSupplyStockCount(consumables, tpl.id);
      if (owned <= 0) continue;
      rows.push({
        tpl,
        owned,
        unitSellPrice: Math.round(
          computeSupplyPrice(tpl, adminConfig) * SHOP_CONFIG.sellPriceRatio
        ),
      });
    }
    const familyOrder = new Map<SupplyFamily, number>(
      SUPPLY_TEMPLATE_FAMILIES.map((f, idx) => [f, idx])
    );
    rows.sort(
      (a, b) =>
        (familyOrder.get(a.tpl.family) ?? 99) -
          (familyOrder.get(b.tpl.family) ?? 99) ||
        a.tpl.tier - b.tpl.tier ||
        a.tpl.id.localeCompare(b.tpl.id)
    );
    return rows;
  }, [consumables, adminConfig]);

  const getBuyDisabledReason = (
    row: ResolvedListingRow,
    qty: number
  ): string | null => {
    if (row.remaining <= 0) return t('shop.supplySoldOut');
    if (isLocked) return t('supply.lockedHint');
    if (row.owned + qty > SUPPLY_STACK_CAP) {
      return t('shop.supplyOverCap', { cap: SUPPLY_STACK_CAP });
    }
    if (qty > row.remaining) {
      return t('shop.supplyOverRemaining', { count: row.remaining });
    }
    const balance = row.currency === 'WP' ? warPoints : credits;
    if (row.unitPrice * qty > balance) {
      return row.currency === 'WP'
        ? t('shop.supplyShortWp')
        : t('shop.supplyShortCredits');
    }
    return null;
  };

  const getMaxBuyQty = (row: ResolvedListingRow): number => {
    const balance = row.currency === 'WP' ? warPoints : credits;
    const capRoom = Math.max(0, SUPPLY_STACK_CAP - row.owned);
    const affordable =
      row.unitPrice > 0
        ? Math.floor(Math.max(0, balance) / row.unitPrice)
        : row.remaining;
    return Math.max(0, Math.min(row.remaining, affordable, capRoom));
  };

  const getMaxDisabledReason = (
    row: ResolvedListingRow,
    maxQty: number
  ): string | null => {
    if (isLocked) return t('supply.lockedHint');
    if (maxQty > 0) return null;
    if (row.remaining <= 0) return t('shop.supplySoldOut');
    if (SUPPLY_STACK_CAP - row.owned <= 0) {
      return t('shop.supplyOverCap', { cap: SUPPLY_STACK_CAP });
    }
    return row.currency === 'WP'
      ? t('shop.supplyShortWp')
      : t('shop.supplyShortCredits');
  };

  const formatRowReasonSummary = (row: ResolvedListingRow): string | null => {
    if (row.remaining <= 0) {
      return t('shop.supplySoldOut');
    }
    const byReason = new Map<string, number[]>();
    for (const qty of BUY_QUANTITIES) {
      const reason = getBuyDisabledReason(row, qty);
      if (!reason) continue;
      const list = byReason.get(reason) ?? [];
      list.push(qty);
      byReason.set(reason, list);
    }
    if (byReason.size === 0) return null;
    if (byReason.size === 1) {
      const [onlyReason, qtys] = Array.from(byReason.entries())[0];
      if (qtys.length === BUY_QUANTITIES.length) {
        return onlyReason;
      }
    }
    return Array.from(byReason.entries())
      .map(([reason, qtys]) => `${qtys.map((q) => `x${q}`).join('/')}: ${reason}`)
      .join(' · ');
  };

  const refreshUsed = sanitizeSupplyShopRefresh(supplyShopRefresh).used;
  const maxRefreshes = sanitizeSupplyShopMaxRefreshes(
    adminConfig?.supplyShopMaxRefreshes
  );
  const refreshBaseCost = sanitizeSupplyShopRefreshBaseCost(
    adminConfig?.supplyShopRefreshBaseCost
  );
  const refreshAtLimit = refreshUsed >= maxRefreshes;
  const refreshStepDisplay = refreshAtLimit ? maxRefreshes : refreshUsed + 1;
  const refreshCost = refreshUsed * refreshBaseCost;
  const refreshCostLabel = `${refreshCost.toLocaleString('en-US')} CR`;
  const refreshBattlesLeft = Math.max(0, battlesUntilRestock);
  const refreshDisabledReason = isLocked
    ? t('supply.lockedHint')
    : refreshAtLimit
      ? t('shop.supplyRefreshLimitHint', { count: refreshBattlesLeft })
      : credits < refreshCost
        ? t('shop.supplyShortCredits')
        : null;

  const handleRefreshSupply = () => {
    const res = refreshSupplyShop();
    if (!res.ok) {
      if (res.reason === 'locked') {
        onNotice?.(t('supply.lockedHint'));
      } else if (res.reason === 'limit') {
        onNotice?.(
          t('shop.supplyRefreshLimitHint', {
            count: res.battlesLeft ?? refreshBattlesLeft,
          })
        );
      } else if (res.reason === 'credits') {
        onNotice?.(t('shop.supplyShortCredits'));
      }
      return;
    }
    onNotice?.(
      t('shop.supplyRefreshSuccess', {
        cost: `${(res.cost ?? 0).toLocaleString('en-US')} CR`,
      })
    );
  };

  const handleBuy = (
    tpl: SupplyTemplate,
    qty: number,
    unitPrice: number,
    currency: 'CR' | 'WP',
    wpSlotId?: string
  ) => {
    if (currency === 'WP' && wpSlotId) {
      const res = buySupplyWp(wpSlotId, qty);
      if (res.ok && res.bought > 0) {
        onNotice?.(
          t('shop.supplyBuyWpNotice', {
            qty: res.bought,
            name: getSupplyName(tpl.id, t),
            cost: (res.bought * unitPrice).toLocaleString(),
          })
        );
      } else {
        onNotice?.(t('shop.supplyBuyFailed'));
      }
      return;
    }

    const res = buySupply(tpl.id, qty);
    if (res.ok && res.bought > 0) {
      onNotice?.(
        t('shop.supplyBuyNotice', {
          qty: res.bought,
          name: getSupplyName(tpl.id, t),
          cost: (res.bought * unitPrice).toLocaleString(),
        })
      );
    } else {
      onNotice?.(t('shop.supplyBuyFailed'));
    }
  };

  const handleSell = (tpl: SupplyTemplate, qty: number) => {
    const res = sellSupply(tpl.id, qty);
    if (res.ok && res.sold > 0) {
      onNotice?.(
        t('shop.supplySellNotice', {
          qty: res.sold,
          name: getSupplyName(tpl.id, t),
          credits: res.creditsEarned.toLocaleString(),
        })
      );
    } else {
      onNotice?.(t('shop.supplySellFailed'));
    }
  };

  const handleBuyVoucher = (
    voucher: SupplyTradeConfirmVoucher,
    qty: number,
    unitPrice: number
  ) => {
    const res = buyVoucher(voucher.def.id, qty);
    if (res.ok && res.bought > 0) {
      onNotice?.(
        t('shop.voucherBuyNotice', {
          qty: res.bought,
          name: voucher.name,
          cost: (res.bought * unitPrice).toLocaleString(),
        })
      );
    } else {
      onNotice?.(t('shop.voucherBuyFailed'));
    }
  };

  const handleBuyCrate = (
    crate: SupplyTradeConfirmCrate,
    qty: number,
    currency: 'CR' | 'WP'
  ) => {
    const res =
      currency === 'WP'
        ? buyCrateWp(crate.slotId, qty)
        : buyCrateCredit(crate.slotId, qty);
    if (res.ok && res.bought > 0) {
      if (res.cappedByStack) {
        onNotice?.(
          t('shop.crateBuyPartialCapNotice', {
            qty: res.bought,
            name: crate.name,
            cap: SUPPLY_STACK_CAP,
            cost: res.cost.toLocaleString(),
            currency,
          })
        );
      } else {
        onNotice?.(
          t('shop.crateBuyNotice', {
            qty: res.bought,
            name: crate.name,
            cost: res.cost.toLocaleString(),
            currency,
          })
        );
      }
      return;
    }
    if (res.reason === 'full') {
      onNotice?.(t('shop.crateFullCap', { cap: SUPPLY_STACK_CAP }));
    } else if (res.reason === 'no_funds') {
      onNotice?.(
        currency === 'WP'
          ? t('shop.supplyShortWp')
          : t('shop.supplyShortCredits')
      );
    } else {
      onNotice?.(t('shop.crateBuyFailed'));
    }
  };

  const handleConfirmTrade = () => {
    if (!pendingTrade) return;
    const trade = pendingTrade;
    setPendingTrade(null);
    if (trade.crate) {
      handleBuyCrate(trade.crate, trade.qty, trade.currency);
      return;
    }
    if (trade.voucher) {
      handleBuyVoucher(trade.voucher, trade.qty, trade.unitPrice);
      return;
    }
    if (!trade.template) return;
    if (trade.mode === 'buy') {
      handleBuy(
        trade.template,
        trade.qty,
        trade.unitPrice,
        trade.currency,
        trade.wpSlotId
      );
    } else {
      handleSell(trade.template, trade.qty);
    }
  };

  const getCrateQty = (slotId: string, remaining: number): number => {
    const maxAllowed = Math.max(1, remaining);
    const stored = crateQtyBySlot[slotId] ?? 1;
    return Math.max(1, Math.min(maxAllowed, stored));
  };

  const stepCrateQty = (slotId: string, delta: number, remaining: number) => {
    const maxAllowed = Math.max(1, remaining);
    setCrateQtyBySlot((prev) => {
      const current = prev[slotId] ?? 1;
      const next = Math.max(1, Math.min(maxAllowed, current + delta));
      return { ...prev, [slotId]: next };
    });
  };

  const renderCrateRow = (
    listing: CrateShopListing,
    currency: 'CR' | 'WP',
    testIdPrefix: string
  ) => {
    const isWp = currency === 'WP';
    const remaining = Math.max(0, Math.floor(listing.remaining));
    const isSoldOut = remaining <= 0;
    const unitPrice = isWp ? crateCfg.wp.price : crateCfg.credit.price;
    const qty = getCrateQty(listing.slotId, remaining);
    const room = Math.max(0, SUPPLY_STACK_CAP - crateOwned);
    const effectiveQty = room > 0 ? Math.min(qty, room) : qty;
    const balance = isWp ? warPoints : credits;
    const disabledReason = isSoldOut
      ? t('shop.supplySoldOut')
      : isLocked
        ? t('supply.lockedHint')
        : room <= 0
          ? t('shop.crateFullCap', { cap: SUPPLY_STACK_CAP })
          : unitPrice * effectiveQty > balance
            ? isWp
              ? t('shop.supplyShortWp')
              : t('shop.supplyShortCredits')
            : null;
    const totalPrice = unitPrice * qty;
    const crateName = t('consumable.supply_crate.name');
    const crateDesc = t('shop.crateShopDesc');
    const btnToneClass = isWp
      ? 'border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200'
      : 'border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200';

    return (
      <div
        key={listing.slotId}
        data-testid={`${testIdPrefix}-row-${listing.slotId}`}
        data-sold-out={isSoldOut ? 'true' : 'false'}
        className={`py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0 ${
          isSoldOut ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded border border-amber-500/40 bg-[#080B14] flex items-center justify-center">
            <ConsumableIcon kind="supply_crate" className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-sm md:text-xs font-semibold text-slate-100 truncate">
                {crateName}
              </span>
              <span className="text-[11px] text-slate-300 truncate">
                {crateDesc}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-nums">
              <span
                className={`font-semibold ${
                  isWp ? 'text-purple-300' : 'text-amber-300'
                }`}
              >
                {unitPrice.toLocaleString()} {currency}
              </span>
              <span
                data-testid={`${testIdPrefix}-remaining-${listing.slotId}`}
                className={isSoldOut ? 'text-rose-300' : 'text-sky-300'}
              >
                {t('shop.supplyRemaining', { count: remaining })}
              </span>
              <span
                data-testid={`${testIdPrefix}-owned-${listing.slotId}`}
                className="text-slate-400"
              >
                {t('shop.supplyOwned', { count: crateOwned })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1 min-w-0 max-w-full shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <div className="inline-flex items-center rounded border border-slate-700 bg-slate-900 overflow-hidden">
              <button
                type="button"
                data-testid={`${testIdPrefix}-dec-${listing.slotId}`}
                disabled={isSoldOut || isLocked || qty <= 1}
                onClick={() => stepCrateQty(listing.slotId, -1, remaining)}
                className="min-h-[38px] md:min-h-[32px] px-2 text-xs font-mono-nums text-slate-200 hover:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer"
                aria-label="-"
              >
                -
              </button>
              <span
                data-testid={`${testIdPrefix}-qty-${listing.slotId}`}
                className="px-2 text-xs font-mono-nums font-semibold text-slate-100"
              >
                {qty}
              </span>
              <button
                type="button"
                data-testid={`${testIdPrefix}-inc-${listing.slotId}`}
                disabled={isSoldOut || isLocked || qty >= remaining}
                onClick={() => stepCrateQty(listing.slotId, 1, remaining)}
                className="min-h-[38px] md:min-h-[32px] px-2 text-xs font-mono-nums text-slate-200 hover:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer"
                aria-label="+"
              >
                +
              </button>
            </div>
            <button
              type="button"
              data-testid={`${testIdPrefix}-buy-${listing.slotId}`}
              disabled={Boolean(disabledReason)}
              title={disabledReason ?? undefined}
              onClick={() =>
                setPendingTrade({
                  mode: 'buy',
                  currency,
                  crate: {
                    slotId: listing.slotId,
                    name: crateName,
                    desc: crateDesc,
                  },
                  qty,
                  unitPrice,
                })
              }
              className={`min-h-[38px] md:min-h-[32px] px-3 py-1 rounded border disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-mono-nums font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight ${btnToneClass}`}
            >
              <span>{t('shop.crateBuyBtn')}</span>
              <span className="text-[10px] font-normal opacity-85">
                {totalPrice.toLocaleString()} {currency}
              </span>
            </button>
          </div>
          {disabledReason && (
            <span
              data-testid={`${testIdPrefix}-reason-${listing.slotId}`}
              className={`text-[11px] ${
                isSoldOut ? 'text-rose-300' : 'text-slate-400'
              }`}
            >
              {disabledReason}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderBuyRow = (row: ResolvedListingRow, testIdPrefix: string) => {
    const { rowKey, remaining, tpl, owned, unitPrice, currency, wpSlotId } = row;
    const isWp = currency === 'WP';
    const isSoldOut = remaining <= 0;
    const iconRow = getCatalogRow(tpl.iconId, iconCatalogMods) ?? null;
    const effectText = formatSupplyEffectSummary(tpl, t);
    const reasonSummary = formatRowReasonSummary(row);
    const maxQty = getMaxBuyQty(row);
    const maxDisabledReason = getMaxDisabledReason(row, maxQty);
    const maxTotal = maxQty * unitPrice;

    const btnToneClass = isWp
      ? 'border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200'
      : 'border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200';

    return (
      <div
        key={rowKey}
        data-testid={
          testIdPrefix === 'supply'
            ? `supply-buy-row-${rowKey}`
            : `${testIdPrefix}-row-${rowKey}`
        }
        data-sold-out={isSoldOut ? 'true' : 'false'}
        className={`py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0 ${
          isSoldOut ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded border border-slate-700/80 bg-[#080B14] flex items-center justify-center">
            <CatalogIcon
              row={iconRow}
              size="sm"
              showBadges={false}
              showArrowBadge={false}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-sm md:text-xs font-semibold text-slate-100 truncate">
                {getSupplyName(tpl.id, t)}
              </span>
              <span className="text-[10px] font-mono-nums px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                T{tpl.tier}
              </span>
              <span className="text-[11px] text-emerald-300 shrink-0">
                {effectText}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-nums">
              <span
                className={`font-semibold ${
                  isWp ? 'text-purple-300' : 'text-amber-300'
                }`}
              >
                {unitPrice.toLocaleString()} {currency}
              </span>
              <span
                data-testid={`${testIdPrefix}-remaining-${rowKey}`}
                className={isSoldOut ? 'text-rose-300' : 'text-sky-300'}
              >
                {t('shop.supplyRemaining', { count: remaining })}
              </span>
              <span
                data-testid={`${testIdPrefix}-owned-${rowKey}`}
                className="text-slate-400"
              >
                {t('shop.supplyOwned', { count: owned })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1 min-w-0 max-w-full shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {BUY_QUANTITIES.map((qty) => {
              const reason = getBuyDisabledReason(row, qty);
              const totalPrice = unitPrice * qty;
              return (
                <button
                  key={qty}
                  type="button"
                  data-testid={`${testIdPrefix}-buy-${rowKey}-${qty}`}
                  disabled={Boolean(reason)}
                  title={reason ?? undefined}
                  onClick={() =>
                    setPendingTrade({
                      mode: 'buy',
                      currency,
                      template: tpl,
                      qty,
                      unitPrice,
                      wpSlotId,
                    })
                  }
                  className={`min-h-[38px] md:min-h-[32px] px-2.5 py-1 rounded border disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-mono-nums font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight ${btnToneClass}`}
                >
                  <span>x{qty}</span>
                  <span className="text-[10px] font-normal opacity-85">
                    {totalPrice.toLocaleString()} {currency}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              data-testid={`${testIdPrefix}-buy-${rowKey}-max`}
              disabled={Boolean(maxDisabledReason)}
              title={maxDisabledReason ?? undefined}
              onClick={() =>
                setPendingTrade({
                  mode: 'buy',
                  currency,
                  template: tpl,
                  qty: maxQty,
                  unitPrice,
                  wpSlotId,
                })
              }
              className={`min-h-[38px] md:min-h-[32px] px-2.5 py-1 rounded border disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-mono-nums font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight ${btnToneClass}`}
            >
              <span>{t('shop.supplyMaxBtn', { qty: maxQty })}</span>
              <span className="text-[10px] font-normal opacity-85">
                {maxTotal.toLocaleString()} {currency}
              </span>
            </button>
          </div>
          {reasonSummary && (
            <span
              data-testid={`${testIdPrefix}-reason-${rowKey}`}
              className={`text-[11px] ${
                isSoldOut ? 'text-rose-300' : 'text-slate-400'
              }`}
            >
              {reasonSummary}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div data-testid="supply-shop-panel" className="space-y-4 min-w-0">
      {/* Top refresh bar */}
      <div
        data-testid="supply-refresh-bar"
        className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 p-3 space-y-1.5 min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <span
            data-testid="supply-refresh-counter"
            className="text-xs font-mono-nums font-semibold text-slate-200"
          >
            {t('shop.supplyRefreshCounter', {
              current: refreshStepDisplay,
              max: maxRefreshes,
            })}
          </span>
          <button
            type="button"
            data-testid="supply-refresh-btn"
            disabled={Boolean(refreshDisabledReason)}
            title={refreshDisabledReason ?? undefined}
            onClick={handleRefreshSupply}
            className="min-h-[38px] md:min-h-[32px] px-3 py-1 rounded border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-amber-200 text-xs font-mono-nums font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>{t('shop.supplyRefreshBtn', { cost: refreshCostLabel })}</span>
          </button>
        </div>
        {refreshAtLimit && (
          <p
            data-testid="supply-refresh-wait"
            className="text-xs text-amber-300/90"
          >
            {t('shop.supplyRefreshLimitHint', { count: refreshBattlesLeft })}
          </p>
        )}
      </div>

      {/* CREDIT Area */}
      <section
        data-testid="supply-credit-section"
        className="space-y-2.5 min-w-0"
      >
        <h2 className="text-xs font-display font-bold uppercase tracking-wider text-amber-300">
          {t('shop.supplyAreaCredit', { count: creditCount })}
        </h2>

        {crateCreditRows.length === 0 && groupedFamilies.length === 0 ? (
          <p
            data-testid="supply-shop-empty"
            className="text-sm text-slate-400 py-2 px-1"
          >
            {t('shop.supplyEmpty')}
          </p>
        ) : (
          <div className="space-y-3">
            {crateCreditRows.length > 0 && (
              <section
                data-testid="supply-crate-credit-section"
                className="rounded-lg border border-amber-500/35 bg-[#0D131D]/95 p-3 space-y-2 min-w-0"
              >
                <h3 className="text-xs font-display font-bold uppercase tracking-wider text-amber-300">
                  {t('shop.crateShopGroup')}
                </h3>
                <div className="divide-y divide-slate-800/80">
                  {crateCreditRows.map((listing) =>
                    renderCrateRow(listing, 'CR', 'crate-credit')
                  )}
                </div>
              </section>
            )}
            {groupedFamilies.map(({ family, rows }) => (
              <section
                key={family}
                data-testid={`supply-family-${family}`}
                className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 p-3 space-y-2 min-w-0"
              >
                <h3 className="text-xs font-display font-bold uppercase tracking-wider text-amber-300">
                  {t(`shop.supplyFamily.${family}` as TranslationKey)}
                </h3>

                <div className="divide-y divide-slate-800/80">
                  {rows.map((row) => renderBuyRow(row, 'supply'))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {/* WP Area */}
      <section
        data-testid="supply-wp-section"
        className="rounded-lg border border-purple-500/35 bg-[#0D131D]/95 p-3 space-y-2 min-w-0"
      >
        <h2 className="text-xs font-display font-bold uppercase tracking-wider text-purple-300">
          {t('shop.supplyAreaWp', {
            count: crateWpRows.length + wpRows.length,
          })}
        </h2>

        {crateWpRows.length === 0 && wpRows.length === 0 ? (
          <p
            data-testid="supply-wp-empty"
            className="text-sm text-slate-400 py-1 px-0.5"
          >
            {t('shop.supplyWpEmpty')}
          </p>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {crateWpRows.map((listing) =>
              renderCrateRow(listing, 'WP', 'crate-wp')
            )}
            {wpRows.map((row) => renderBuyRow(row, 'supply-wp'))}
          </div>
        )}
      </section>

      {/* Voucher WP Area */}
      <section
        data-testid="voucher-wp-section"
        className="rounded-lg border border-purple-500/35 bg-[#0D131D]/95 p-3 space-y-2 min-w-0"
      >
        <h2 className="text-xs font-display font-bold uppercase tracking-wider text-purple-300">
          {t('shop.voucherSection', { count: voucherRows.length })}
        </h2>

        {voucherRows.length === 0 ? (
          <p
            data-testid="voucher-wp-empty"
            className="text-sm text-slate-400 py-1 px-0.5"
          >
            {t('shop.voucherEmpty')}
          </p>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {voucherRows.map((row) => {
              const { def, name, desc, remaining, owned, unitPrice } = row;
              const isSoldOut = remaining <= 0;
              const maxQty = Math.max(
                0,
                Math.min(
                  remaining,
                  unitPrice > 0
                    ? Math.floor(Math.max(0, warPoints) / unitPrice)
                    : remaining
                )
              );
              const maxDisabledReason = isLocked
                ? t('supply.lockedHint')
                : maxQty > 0
                  ? null
                  : isSoldOut
                    ? t('shop.supplySoldOut')
                    : t('shop.supplyShortWp');
              const rowReason = isSoldOut
                ? t('shop.supplySoldOut')
                : isLocked
                  ? t('supply.lockedHint')
                  : warPoints < unitPrice
                    ? t('shop.supplyShortWp')
                    : null;

              return (
                <div
                  key={def.id}
                  data-testid={`voucher-wp-row-${def.id}`}
                  data-sold-out={isSoldOut ? 'true' : 'false'}
                  className={`py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0 ${
                    isSoldOut ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="shrink-0 w-9 h-9 rounded border border-purple-500/40 bg-[#080B14] flex items-center justify-center text-purple-300">
                      <Ticket className="w-4 h-4" aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="text-sm md:text-xs font-semibold text-slate-100 truncate">
                          {name}
                        </span>
                        <span className="text-[10px] font-mono-nums px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-200 shrink-0">
                          {def.kind === 'credit'
                            ? t('shop.voucherKindCredit')
                            : t('shop.voucherKindExp')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-nums">
                        <span className="font-semibold text-purple-300">
                          {unitPrice.toLocaleString()} WP
                        </span>
                        <span
                          data-testid={`voucher-wp-remaining-${def.id}`}
                          className={
                            isSoldOut ? 'text-rose-300' : 'text-sky-300'
                          }
                        >
                          {t('shop.supplyRemaining', { count: remaining })}
                        </span>
                        <span
                          data-testid={`voucher-wp-owned-${def.id}`}
                          className="text-slate-400"
                        >
                          {t('shop.supplyOwned', { count: owned })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1 min-w-0 max-w-full shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {VOUCHER_BUY_QUANTITIES.map((qty) => {
                        const disabledReason = isSoldOut
                          ? t('shop.supplySoldOut')
                          : isLocked
                            ? t('supply.lockedHint')
                            : qty > remaining
                              ? t('shop.supplyOverRemaining', {
                                  count: remaining,
                                })
                              : unitPrice * qty > warPoints
                                ? t('shop.supplyShortWp')
                                : null;
                        const totalPrice = unitPrice * qty;
                        return (
                          <button
                            key={qty}
                            type="button"
                            data-testid={`voucher-wp-buy-${def.id}-${qty}`}
                            disabled={Boolean(disabledReason)}
                            title={disabledReason ?? undefined}
                            onClick={() =>
                              setPendingTrade({
                                mode: 'buy',
                                currency: 'WP',
                                voucher: { def, name, desc },
                                qty,
                                unitPrice,
                              })
                            }
                            className="min-h-[38px] md:min-h-[32px] px-2.5 py-1 rounded border border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-mono-nums font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight"
                          >
                            <span>x{qty}</span>
                            <span className="text-[10px] font-normal opacity-85">
                              {totalPrice.toLocaleString()} WP
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        data-testid={`voucher-wp-buy-${def.id}-max`}
                        disabled={Boolean(maxDisabledReason)}
                        title={maxDisabledReason ?? undefined}
                        onClick={() =>
                          setPendingTrade({
                            mode: 'buy',
                            currency: 'WP',
                            voucher: { def, name, desc },
                            qty: maxQty,
                            unitPrice,
                          })
                        }
                        className="min-h-[38px] md:min-h-[32px] px-2.5 py-1 rounded border border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-mono-nums font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight"
                      >
                        <span>{t('shop.supplyMaxBtn', { qty: maxQty })}</span>
                        <span className="text-[10px] font-normal opacity-85">
                          {(maxQty * unitPrice).toLocaleString()} WP
                        </span>
                      </button>
                    </div>
                    {rowReason && (
                      <span
                        data-testid={`voucher-wp-reason-${def.id}`}
                        className={`text-[11px] ${
                          isSoldOut ? 'text-rose-300' : 'text-slate-400'
                        }`}
                      >
                        {rowReason}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sell Back */}
      {ownedRows.length > 0 && (
        <section
          data-testid="supply-sell-section"
          className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 p-3 space-y-2 min-w-0"
        >
          <h2 className="text-xs font-display font-bold uppercase tracking-wider text-slate-200">
            {t('shop.supplySellSection')}
          </h2>

          <div className="divide-y divide-slate-800/80">
            {ownedRows.map(({ tpl, owned, unitSellPrice }) => (
              <div
                key={tpl.id}
                data-testid={`supply-sell-row-${tpl.id}`}
                className="py-2 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm md:text-xs font-semibold text-slate-100 truncate">
                    {getSupplyName(tpl.id, t)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-nums">
                    <span className="text-slate-300">
                      {t('shop.supplyOwned', { count: owned })}
                    </span>
                    <span className="text-emerald-300 font-semibold">
                      {t('shop.supplySellUnit', {
                        price: unitSellPrice.toLocaleString(),
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {SELL_QUANTITIES.map((qty) => {
                    const disabled = isLocked || owned < qty;
                    const totalEarned = unitSellPrice * qty;
                    return (
                      <button
                        key={qty}
                        type="button"
                        data-testid={`supply-sell-${tpl.id}-${qty}`}
                        disabled={disabled}
                        onClick={() =>
                          setPendingTrade({
                            mode: 'sell',
                            currency: 'CR',
                            template: tpl,
                            qty,
                            unitPrice: unitSellPrice,
                          })
                        }
                        className="min-h-[38px] md:min-h-[32px] px-2.5 py-1 rounded border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-emerald-200 text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight"
                      >
                        <span>{t('shop.supplySellBtn', { qty })}</span>
                        <span className="text-[10px] font-mono-nums font-normal opacity-85">
                          +{totalEarned.toLocaleString()} CR
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <SupplyTradeConfirm
        mode={pendingTrade?.mode ?? 'buy'}
        currency={pendingTrade?.currency ?? 'CR'}
        template={pendingTrade?.template ?? null}
        voucher={pendingTrade?.voucher ?? null}
        crate={pendingTrade?.crate ?? null}
        qty={pendingTrade?.qty ?? 1}
        unitPrice={pendingTrade?.unitPrice ?? 0}
        credits={pendingTrade?.currency === 'WP' ? warPoints : credits}
        iconCatalogMods={iconCatalogMods}
        onConfirm={handleConfirmTrade}
        onCancel={() => setPendingTrade(null)}
      />
    </div>
  );
}
