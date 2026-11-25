import { useMemo, useState } from 'react';
import {
  getSupplyTemplateById,
  SUPPLY_TEMPLATE_FAMILIES,
} from '../data/consumables';
import { getCatalogRow } from '../data/iconCatalog';
import { SHOP_CONFIG } from '../data/items';
import { computeSupplyPrice } from '../engine/itemPrice';
import { getSupplyStockCount, SUPPLY_STACK_CAP } from '../engine/supplies';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { isBattleActive, useGameStore } from '../store/useGameStore';
import type {
  SupplyFamily,
  SupplyShopListing,
  SupplyTemplate,
} from '../types/game';
import { CatalogIcon } from './CatalogIcon';
import { formatSupplyEffectSummary, getSupplyName } from './SupplyLoadoutBar';
import { SupplyTradeConfirm } from './SupplyTradeConfirm';

export interface SupplyShopPanelProps {
  onNotice?: (message: string) => void;
}

const BUY_QUANTITIES = [1, 5, 10] as const;
const SELL_QUANTITIES = [1, 5] as const;

interface ResolvedListingRow {
  listing: SupplyShopListing;
  tpl: SupplyTemplate;
  owned: number;
  unitPrice: number;
}

interface OwnedSupplyRow {
  tpl: SupplyTemplate;
  owned: number;
  unitSellPrice: number;
}

export function SupplyShopPanel({ onNotice }: SupplyShopPanelProps) {
  const { t } = useI18n();
  const credits = useGameStore((s) => s.pilot.credits);
  const consumables = useGameStore((s) => s.pilot.consumables);
  const supplyShopStock = useGameStore((s) => s.supplyShopStock);
  const iconCatalogMods = useGameStore((s) => s.adminConfig.iconCatalogMods);
  const screen = useGameStore((s) => s.screen);
  const battle = useGameStore((s) => s.battle);
  const autoRepeatActive = useGameStore((s) =>
    Boolean(s.autoRepeatSession?.active)
  );
  const buySupply = useGameStore((s) => s.buySupply);
  const sellSupply = useGameStore((s) => s.sellSupply);

  const isLocked = isBattleActive({ screen, battle }) || autoRepeatActive;
  const [pendingTrade, setPendingTrade] = useState<{
    mode: 'buy' | 'sell';
    template: SupplyTemplate;
    qty: number;
    unitPrice: number;
  } | null>(null);

  const groupedFamilies = useMemo(() => {
    const byFamily = new Map<SupplyFamily, ResolvedListingRow[]>();
    for (const family of SUPPLY_TEMPLATE_FAMILIES) {
      byFamily.set(family, []);
    }
    for (const listing of supplyShopStock) {
      const tpl = getSupplyTemplateById(listing.templateId);
      if (!tpl) continue;
      const bucket = byFamily.get(tpl.family);
      if (!bucket) continue;
      bucket.push({
        listing,
        tpl,
        owned: getSupplyStockCount(consumables, tpl.id),
        unitPrice: computeSupplyPrice(tpl),
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
  }, [supplyShopStock, consumables]);

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
          computeSupplyPrice(tpl) * SHOP_CONFIG.sellPriceRatio
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
  }, [consumables]);

  const getBuyDisabledReason = (
    row: ResolvedListingRow,
    qty: number
  ): string | null => {
    if (row.listing.remaining <= 0) return t('shop.supplySoldOut');
    if (isLocked) return t('supply.lockedHint');
    if (row.owned + qty > SUPPLY_STACK_CAP) {
      return t('shop.supplyOverCap', { cap: SUPPLY_STACK_CAP });
    }
    if (qty > row.listing.remaining) {
      return t('shop.supplyOverRemaining', { count: row.listing.remaining });
    }
    if (row.unitPrice * qty > credits) {
      return t('shop.supplyShortCredits');
    }
    return null;
  };

  const formatRowReasonSummary = (row: ResolvedListingRow): string | null => {
    if (row.listing.remaining <= 0) {
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

  const handleBuy = (tpl: SupplyTemplate, qty: number, unitPrice: number) => {
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

  const handleConfirmTrade = () => {
    if (!pendingTrade) return;
    const trade = pendingTrade;
    setPendingTrade(null);
    if (trade.mode === 'buy') {
      handleBuy(trade.template, trade.qty, trade.unitPrice);
    } else {
      handleSell(trade.template, trade.qty);
    }
  };

  if (groupedFamilies.length === 0 && ownedRows.length === 0) {
    return (
      <p
        data-testid="supply-shop-empty"
        className="text-sm text-slate-400 py-3 px-1"
      >
        {t('shop.supplyEmpty')}
      </p>
    );
  }

  return (
    <div data-testid="supply-shop-panel" className="space-y-4">
      {groupedFamilies.length === 0 ? (
        <p
          data-testid="supply-shop-empty"
          className="text-sm text-slate-400 py-2 px-1"
        >
          {t('shop.supplyEmpty')}
        </p>
      ) : (
        <div className="space-y-3">
          {groupedFamilies.map(({ family, rows }) => (
            <section
              key={family}
              data-testid={`supply-family-${family}`}
              className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 p-3 space-y-2"
            >
              <h2 className="text-xs font-display font-bold uppercase tracking-wider text-amber-300">
                {t(`shop.supplyFamily.${family}` as TranslationKey)}
              </h2>

              <div className="divide-y divide-slate-800/80">
                {rows.map((row) => {
                  const { listing, tpl, owned, unitPrice } = row;
                  const isSoldOut = listing.remaining <= 0;
                  const iconRow =
                    getCatalogRow(tpl.iconId, iconCatalogMods) ?? null;
                  const effectText = formatSupplyEffectSummary(tpl, t);
                  const reasonSummary = formatRowReasonSummary(row);

                  return (
                    <div
                      key={tpl.id}
                      data-testid={`supply-buy-row-${tpl.id}`}
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
                            <span className="text-amber-300 font-semibold">
                              {unitPrice.toLocaleString()} CR
                            </span>
                            <span
                              data-testid={`supply-remaining-${tpl.id}`}
                              className={
                                isSoldOut ? 'text-rose-300' : 'text-sky-300'
                              }
                            >
                              {t('shop.supplyRemaining', {
                                count: listing.remaining,
                              })}
                            </span>
                            <span
                              data-testid={`supply-owned-${tpl.id}`}
                              className="text-slate-400"
                            >
                              {t('shop.supplyOwned', { count: owned })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1 shrink-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {BUY_QUANTITIES.map((qty) => {
                            const reason = getBuyDisabledReason(row, qty);
                            const totalPrice = unitPrice * qty;
                            return (
                              <button
                                key={qty}
                                type="button"
                                data-testid={`supply-buy-${tpl.id}-${qty}`}
                                disabled={Boolean(reason)}
                                title={reason ?? undefined}
                                onClick={() =>
                                  setPendingTrade({
                                    mode: 'buy',
                                    template: tpl,
                                    qty,
                                    unitPrice,
                                  })
                                }
                                className="min-h-[38px] md:min-h-[32px] px-2.5 py-1 rounded border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed text-amber-200 text-xs font-mono-nums font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center leading-tight"
                              >
                                <span>x{qty}</span>
                                <span className="text-[10px] font-normal opacity-85">
                                  {totalPrice.toLocaleString()} CR
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {reasonSummary && (
                          <span
                            data-testid={`supply-reason-${tpl.id}`}
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
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {ownedRows.length > 0 && (
        <section
          data-testid="supply-sell-section"
          className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 p-3 space-y-2"
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
        template={pendingTrade?.template ?? null}
        qty={pendingTrade?.qty ?? 1}
        unitPrice={pendingTrade?.unitPrice ?? 0}
        credits={credits}
        iconCatalogMods={iconCatalogMods}
        onConfirm={handleConfirmTrade}
        onCancel={() => setPendingTrade(null)}
      />
    </div>
  );
}
