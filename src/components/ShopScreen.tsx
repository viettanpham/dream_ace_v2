import { type ReactNode, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Award,
  Check,
  ChevronRight,
  Clock,
  Coins,
  KeyRound,
  Lock,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { MECH_CLASS_LIST, STAT_KEYS } from '../data/classes';
import { ITEM_SLOTS, RARITY_META, SHOP_CONFIG } from '../data/items';
import { getBoxCapacity } from '../engine/migration';
import { SHOP_STOCK_CONFIG } from '../data/shopConfig';
import { getSkillById, OPENING_CARDS_LIST } from '../data/skills';
import {
  getEffectiveItemStats,
  getGearEquippedInstances,
  getItemEquippedByGear,
  getSellPrice,
  validateEquipOnGear,
} from '../engine/equipment';
import { hasOperationalShipyard } from '../engine/shop';
import {
  formatEquipValidationReason,
  formatItemTraitsList,
  getClassName,
  getItemInstanceDesc,
  getItemInstanceName,
  getRarityLabel,
  getSkillCategoryLabel,
  getSkillDesc,
  getSkillName,
  getSlotLabel,
  getSlotShort,
  getStatShort,
  useI18n,
} from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { useGameStore } from '../store/useGameStore';
import type {
  EquipmentSlot,
  ItemInstance,
  Language,
  MechClassId,
  ShopItemListing,
  WpMarketOffer,
} from '../types/game';
import { BottomSheet } from './BottomSheet';
import {
  ClassIcon,
  ConsumableIcon,
  getSlotAccentClass,
  SlotIcon,
} from './GameIcons';
import { SkillIcon } from './SkillIcon';
import { SupplyShopPanel } from './SupplyShopPanel';

type ClassFilter = 'all' | 'usable' | 'universal' | MechClassId;

type NoticeAction = 'gear' | 'skill' | 'consumables' | 'none';

type MobileShopSheetState =
  | { kind: 'buy'; itemId: string }
  | { kind: 'sell'; itemId: string }
  | { kind: 'wp'; cardId: string }
  | { kind: 'wpOffer'; offerId: string }
  | null;

function getWpOfferText(
  lang: Language,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  offer: WpMarketOffer
): { name: string; desc: string } {
  const rarityLabel = offer.minRarity
    ? getRarityLabel(lang, offer.minRarity)
    : '';
  const slotLabel = offer.slot ? getSlotLabel(lang, offer.slot) : '';
  const pct =
    offer.bonusPct ?? SHOP_STOCK_CONFIG.wpOffers.enchantStone.bonusPct;
  const battles =
    offer.battlesCount ?? SHOP_STOCK_CONFIG.wpOffers.expBoost.battlesCount;
  return {
    name: t(`consumable.${offer.kind}.name` as TranslationKey, {
      rarity: rarityLabel,
      slot: slotLabel,
      pct,
      battles,
    }),
    desc: t(`consumable.${offer.kind}.desc` as TranslationKey, {
      rarity: rarityLabel,
      slot: slotLabel,
      pct,
      battles,
    }),
  };
}

export function ShopScreen() {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminBoxCapacity = useGameStore((s) => s.adminConfig.boxCapacity);
  const shopStock = useGameStore((s) => s.shopStock);
  const wpMarketOffers = useGameStore((s) => s.wpMarketOffers);
  const battlesUntilRestock = useGameStore((s) => s.battlesUntilRestock);
  const shopSubTab = useGameStore((s) => s.shopSubTab);
  const setShopSubTab = useGameStore((s) => s.setShopSubTab);
  const buyShopItem = useGameStore((s) => s.buyShopItem);
  const refreshShopStock = useGameStore((s) => s.refreshShopStock);
  const buyWpMarketOffer = useGameStore((s) => s.buyWpMarketOffer);
  const refreshWpMarket = useGameStore((s) => s.refreshWpMarket);
  const sellItem = useGameStore((s) => s.sellItem);
  const unequipInstanceEverywhere = useGameStore(
    (s) => s.unequipInstanceEverywhere
  );
  const toggleItemLock = useGameStore((s) => s.toggleItemLock);
  const buyOpeningCardAction = useGameStore((s) => s.buyOpeningCardAction);
  const setActiveTab = useGameStore((s) => s.setActiveTab);
  const setInventoryFilterState = useGameStore(
    (s) => s.setInventoryFilterState
  );

  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | 'all'>('all');
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [wpClassFilter, setWpClassFilter] = useState<'all' | MechClassId>('all');
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [noticeAction, setNoticeAction] = useState<NoticeAction>('gear');
  const [mobileSheet, setMobileSheet] = useState<MobileShopSheetState>(null);

  const activeGear = pilot.gears[pilot.activeGearId];
  const equippedOnActive = useMemo(
    () => getGearEquippedInstances(activeGear, pilot.inventory),
    [activeGear, pilot.inventory]
  );

  const shipyardActive = useMemo(() => hasOperationalShipyard(pilot), [pilot]);
  const boxCap = getBoxCapacity({ boxCapacity: adminBoxCapacity });
  const isInventoryFull = pilot.inventory.length >= boxCap;

  const availableShopCount = useMemo(
    () => shopStock.filter((item) => !item.soldOut).length,
    [shopStock]
  );

  const slotStockCounts = useMemo(() => {
    const counts = {} as Record<EquipmentSlot, { avail: number; total: number }>;
    for (const slot of ITEM_SLOTS) {
      counts[slot] = { avail: 0, total: 0 };
    }
    for (const item of shopStock) {
      const bucket = counts[item.slot];
      if (!bucket) continue;
      bucket.total += 1;
      if (!item.soldOut) {
        bucket.avail += 1;
      }
    }
    return counts;
  }, [shopStock]);

  const availableWpOffersCount = useMemo(
    () => wpMarketOffers.filter((offer) => !offer.soldOut).length,
    [wpMarketOffers]
  );

  const filteredStock = useMemo(() => {
    return shopStock.filter((item) => {
      if (slotFilter !== 'all' && item.slot !== slotFilter) return false;
      if (classFilter === 'universal' && item.classRestriction !== null) {
        return false;
      }
      if (classFilter === 'usable') {
        const val = validateEquipOnGear(item, activeGear, pilot.gears);
        if (!val.canEquip) return false;
      } else if (
        classFilter !== 'all' &&
        classFilter !== 'universal' &&
        item.classRestriction !== classFilter
      ) {
        return false;
      }
      return true;
    });
  }, [shopStock, slotFilter, classFilter, activeGear, pilot.gears]);

  const sellableInventoryCount = useMemo(
    () =>
      pilot.inventory.filter(
        (inst) =>
          !inst.locked &&
          getItemEquippedByGear(pilot.gears, inst.instanceId) === null
      ).length,
    [pilot.inventory, pilot.gears]
  );

  const sellSlotCounts = useMemo(() => {
    const counts = {} as Record<EquipmentSlot, number>;
    for (const slot of ITEM_SLOTS) {
      counts[slot] = 0;
    }
    for (const inst of pilot.inventory) {
      counts[inst.slot] = (counts[inst.slot] ?? 0) + 1;
    }
    return counts;
  }, [pilot.inventory]);

  const filteredSellInventory = useMemo(() => {
    return pilot.inventory.filter((inst) => {
      if (slotFilter !== 'all' && inst.slot !== slotFilter) return false;
      return true;
    });
  }, [pilot.inventory, slotFilter]);

  const filteredOpeningCards = useMemo(() => {
    return OPENING_CARDS_LIST.filter((card) => {
      if (wpClassFilter !== 'all' && card.classId !== wpClassFilter) {
        return false;
      }
      return true;
    });
  }, [wpClassFilter]);

  const handleBuy = (item: ShopItemListing) => {
    if (item.soldOut || isInventoryFull || pilot.credits < item.price) return;
    const res = buyShopItem(item.instanceId);
    if (res.ok) {
      setNoticeAction('gear');
      setNoticeText(
        t('shop.boughtMsg', {
          item: getItemInstanceName(lang, item),
          price: item.price.toLocaleString(),
        })
      );
      setMobileSheet(null);
    }
  };

  const handleRefresh = () => {
    const res = refreshShopStock();
    if (res.ok) {
      setNoticeAction('none');
      setNoticeText(t('shop.refreshedMsg'));
    }
  };

  const handleSell = (inst: ItemInstance) => {
    const name = getItemInstanceName(lang, inst, true);
    const res = sellItem(inst.instanceId);
    if (res.ok) {
      setNoticeAction('gear');
      setNoticeText(
        t('shop.soldMsg', {
          item: name,
          price: res.creditsEarned.toLocaleString(),
        })
      );
      setMobileSheet(null);
    }
  };

  const handleBuyOpeningCard = (cardId: string, skillId: string) => {
    const res = buyOpeningCardAction(cardId);
    if (res.ok) {
      setNoticeAction('skill');
      setNoticeText(
        t('shop.cardBoughtMsg', {
          skill: getSkillName(lang, skillId),
          cost: res.cost,
        })
      );
      setMobileSheet(null);
    }
  };

  const handleBuyWpOffer = (offer: WpMarketOffer) => {
    if (offer.soldOut || (pilot.warPoints ?? 0) < offer.wpCost) return;
    const res = buyWpMarketOffer(offer.id);
    if (res.ok) {
      const { name } = getWpOfferText(lang, t, offer);
      setNoticeAction('consumables');
      setNoticeText(t('shop.wpBoughtOfferFeedback', { name }));
      setMobileSheet(null);
    }
  };

  const handleRefreshWp = () => {
    const res = refreshWpMarket();
    if (res.ok) {
      setNoticeAction('none');
      setNoticeText(t('shop.wpRefreshedMsg'));
    }
  };

  const refreshCostCredits = SHOP_STOCK_CONFIG.refreshCostCredits;
  const wpRefreshCostWp = SHOP_STOCK_CONFIG.wpRefreshCostWp;
  const canRefresh = pilot.credits >= refreshCostCredits;
  const canRefreshWp = (pilot.warPoints ?? 0) >= wpRefreshCostWp;
  const ownedCardsCount = pilot.ownedOpeningCards.length;

  const activeSlotAvail =
    slotFilter === 'all' ? availableShopCount : slotStockCounts[slotFilter].avail;
  const activeSlotTotal =
    slotFilter === 'all' ? shopStock.length : slotStockCounts[slotFilter].total;

  const activeBuyItem =
    mobileSheet?.kind === 'buy'
      ? shopStock.find((it) => it.instanceId === mobileSheet.itemId) ?? null
      : null;

  const activeSellItem =
    mobileSheet?.kind === 'sell'
      ? pilot.inventory.find((it) => it.instanceId === mobileSheet.itemId) ?? null
      : null;

  const activeWpCard =
    mobileSheet?.kind === 'wp'
      ? OPENING_CARDS_LIST.find((c) => c.id === mobileSheet.cardId) ?? null
      : null;

  const activeWpOffer =
    mobileSheet?.kind === 'wpOffer'
      ? wpMarketOffers.find((o) => o.id === mobileSheet.offerId) ?? null
      : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] p-3 sm:p-5 space-y-3.5 sm:space-y-4">
        {/* Header Bar */}
        <div className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100">
                {t('shop.title')}
              </h1>
              <p className="text-sm md:text-xs text-slate-400">
                {t('shop.subtitle', {
                  refreshCost: refreshCostCredits,
                  ratio: Math.round(SHOP_CONFIG.sellPriceRatio * 100),
                })}
              </p>
            </div>

            {/* Restock Countdown, Shipyard Bonus & Cargo Status Tags */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                data-testid="shop-restock-countdown"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-700/80 bg-slate-900/90 text-slate-300"
              >
                <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                <span>
                  {t('shop.restockCountdown', { n: battlesUntilRestock })}
                </span>
              </span>

              {shipyardActive && (
                <span
                  data-testid="shop-shipyard-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-semibold"
                >
                  <Anchor className="w-3 h-3 shrink-0" />
                  <span>
                    {t('shop.shipyardBonusBadge', {
                      n: SHOP_STOCK_CONFIG.shipyardStockBonus,
                    })}
                  </span>
                </span>
              )}

              {shopSubTab === 'buy' && (
                <span
                  data-testid={
                    isInventoryFull ? 'shop-cargo-full-tag' : 'shop-cargo-tag'
                  }
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono-nums ${
                    isInventoryFull
                      ? 'border-rose-500/60 bg-rose-500/15 text-rose-200 font-semibold'
                      : 'border-slate-700/80 bg-slate-900/90 text-slate-400'
                  }`}
                >
                  <Package className="w-3 h-3 shrink-0" />
                  <span>
                    {isInventoryFull
                      ? t('shop.cargoFullTag', {
                          count: pilot.inventory.length,
                          max: boxCap,
                        })
                      : t('shop.cargoCount', {
                          count: pilot.inventory.length,
                          max: boxCap,
                        })}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {shopSubTab === 'buy' && (
              <button
                type="button"
                data-testid="shop-refresh-btn"
                disabled={!canRefresh}
                onClick={handleRefresh}
                className="min-h-[44px] md:min-h-0 md:h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg md:rounded border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-sky-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {t('shop.refreshStock', { cost: refreshCostCredits })}
                </span>
              </button>
            )}

            <div className="w-full md:w-auto grid grid-cols-4 md:flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
              <button
                type="button"
                data-testid="shop-tab-buy"
                onClick={() => {
                  setShopSubTab('buy');
                  setNoticeText(null);
                }}
                className={`min-h-[44px] md:min-h-0 md:h-9 px-2.5 md:px-3 inline-flex items-center justify-center gap-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  shopSubTab === 'buy'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {t('shop.tabBuy', { count: availableShopCount })}
                </span>
              </button>

              <button
                type="button"
                data-testid="shop-tab-sell"
                onClick={() => {
                  setShopSubTab('sell');
                  setNoticeText(null);
                }}
                className={`min-h-[44px] md:min-h-0 md:h-9 px-2.5 md:px-3 inline-flex items-center justify-center gap-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  shopSubTab === 'sell'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {t('shop.tabSell', { count: sellableInventoryCount })}
                </span>
              </button>

              <button
                type="button"
                data-testid="shop-tab-wp"
                onClick={() => {
                  setShopSubTab('warpoints');
                  setNoticeText(null);
                }}
                className={`min-h-[44px] md:min-h-0 md:h-9 px-2.5 md:px-3 inline-flex items-center justify-center gap-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  shopSubTab === 'warpoints'
                    ? 'bg-purple-500 text-white'
                    : 'text-purple-300 hover:text-purple-100'
                }`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {t('shop.tabWpShort', { count: availableWpOffersCount })}
                </span>
              </button>

              <button
                type="button"
                data-testid="shop-tab-supply"
                onClick={() => { setShopSubTab('supply'); setNoticeText(null); }}
                className={`min-h-[44px] md:min-h-0 md:h-9 px-1.5 md:px-3 inline-flex items-center justify-center gap-1 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  shopSubTab === 'supply' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-300 hover:text-emerald-100'
                }`}
              >
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('shop.tabSupply')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Inline Feedback */}
        {noticeText && (
          <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm md:text-xs text-emerald-200">
            <span>{noticeText}</span>
            {noticeAction !== 'none' && (
              <button
                type="button"
                onClick={() => {
                  if (noticeAction === 'consumables') {
                    setInventoryFilterState({ slot: 'consumables' });
                    setActiveTab('gear');
                  } else {
                    setActiveTab(noticeAction === 'skill' ? 'skill' : 'gear');
                  }
                }}
                className="min-h-[36px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer whitespace-nowrap"
              >
                {noticeAction === 'skill'
                  ? t('shop.goToSkillTab')
                  : noticeAction === 'consumables'
                  ? t('shop.goToConsumables')
                  : t('shop.equipInHangar')}
              </button>
            )}
          </div>
        )}

        {/* Non-blocking Full Inventory Banner in Buy tab */}
        {shopSubTab === 'buy' && isInventoryFull && (
          <div
            data-testid="shop-cargo-full-banner"
            className="rounded border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {t('shop.cargoFullHint', {
                  count: pilot.inventory.length,
                  max: boxCap,
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShopSubTab('sell')}
              className="font-semibold text-amber-300 hover:text-amber-200 cursor-pointer whitespace-nowrap"
            >
              {t('shop.tabSell', { count: sellableInventoryCount })} →
            </button>
          </div>
        )}

        {/* Filters for Buy / Sell (Wrapped chips with shared SlotIcon & ClassIcon) */}
        {(shopSubTab === 'buy' || shopSubTab === 'sell') && (
          <div className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 p-3 sm:p-4 space-y-2.5">
            <div
              data-testid="shop-slot-tabs"
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
            >
              <button
                type="button"
                data-testid="shop-slot-tab-all"
                onClick={() => setSlotFilter('all')}
                className={`min-h-[44px] md:min-h-0 md:h-9 px-3 rounded-lg md:rounded border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                  slotFilter === 'all'
                    ? 'bg-slate-800 border-amber-400/80 text-slate-50'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <SlotIcon slot="all" className="w-3.5 h-3.5 shrink-0" />
                <span>{t('shop.allSlots')}</span>
                <span className="font-mono-nums text-[11px] opacity-80">
                  {shopSubTab === 'buy'
                    ? `(${availableShopCount}/${shopStock.length})`
                    : `(${pilot.inventory.length})`}
                </span>
              </button>

              {ITEM_SLOTS.map((slot) => {
                const counts = slotStockCounts[slot];
                return (
                  <button
                    key={slot}
                    type="button"
                    data-testid={`shop-slot-tab-${slot}`}
                    onClick={() => setSlotFilter(slot)}
                    className={`min-h-[44px] md:min-h-0 md:h-9 px-3 rounded-lg md:rounded border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                      slotFilter === slot
                        ? 'bg-slate-800 border-amber-400/80 text-slate-50'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <SlotIcon slot={slot} className="w-3.5 h-3.5 shrink-0" />
                    <span className="md:hidden">{getSlotShort(lang, slot)}</span>
                    <span className="hidden md:inline">
                      {getSlotLabel(lang, slot)}
                    </span>
                    <span className="font-mono-nums text-[11px] opacity-80">
                      {shopSubTab === 'buy'
                        ? `(${counts.avail}/${counts.total})`
                        : `(${sellSlotCounts[slot]})`}
                    </span>
                  </button>
                );
              })}
            </div>

            {shopSubTab === 'buy' && (
              <div
                data-testid="shop-class-tabs"
                className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80"
              >
                <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                  {(
                    [
                      {
                        id: 'all',
                        label: t('common.allClasses'),
                        icon: (
                          <ClassIcon
                            classId="all"
                            className="w-3.5 h-3.5 shrink-0"
                          />
                        ),
                      },
                      {
                        id: 'usable',
                        label: t('shop.usableNow', {
                          className: getClassName(lang, activeGear.classId),
                          level: activeGear.level,
                        }),
                        icon: (
                          <ClassIcon
                            classId={activeGear.classId}
                            className="w-3.5 h-3.5 shrink-0"
                          />
                        ),
                      },
                      {
                        id: 'universal',
                        label: t('shop.universal'),
                        icon: (
                          <ClassIcon
                            classId="general"
                            className="w-3.5 h-3.5 shrink-0"
                          />
                        ),
                      },
                      ...MECH_CLASS_LIST.map((c) => ({
                        id: c.id as ClassFilter,
                        label: t('shop.classLockedFilter', {
                          className: getClassName(lang, c.id),
                        }),
                        icon: (
                          <ClassIcon
                            classId={c.id}
                            className="w-3.5 h-3.5 shrink-0"
                          />
                        ),
                      })),
                    ] as Array<{
                      id: ClassFilter;
                      label: string;
                      icon: ReactNode;
                    }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`shop-class-tab-${opt.id}`}
                      onClick={() => setClassFilter(opt.id)}
                      className={`min-h-[44px] md:min-h-0 md:h-9 px-3 rounded-lg md:rounded border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                        classFilter === opt.id
                          ? 'bg-slate-800 border-sky-400/80 text-slate-50'
                          : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                <span
                  data-testid="shop-active-slot-stock"
                  className="text-[11px] font-mono-nums text-slate-400"
                >
                  {t('shop.stockAvailable', {
                    avail: activeSlotAvail,
                    total: activeSlotTotal,
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {shopSubTab === 'supply' && (
          <SupplyShopPanel onNotice={(msg) => { setNoticeAction('none'); setNoticeText(msg); }} />
        )}

        {/* WAR POINT SHOP: ROTATING RANDOM OFFERS + OPENING CARDS */}
        {shopSubTab === 'warpoints' && (
          <div className="space-y-4">
            {/* WP Header Summary */}
            <div className="rounded-lg border border-purple-500/40 bg-[#100D1E]/95 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2 text-purple-300 font-display text-lg font-bold">
                  <KeyRound className="w-5 h-5" />
                  <span>
                    {t('shop.tabWarPoints', {
                      owned: ownedCardsCount,
                      total: OPENING_CARDS_LIST.length,
                    })}
                  </span>
                </div>
                <p className="text-sm md:text-xs text-slate-300 leading-relaxed">
                  {t('shop.wpIntro')}
                </p>
              </div>

              <div className="rounded-md border border-purple-500/40 bg-[#080B14] px-3.5 py-2 text-right font-mono-nums">
                <div className="text-[11px] text-slate-400">
                  {t('shop.availableWp')}
                </div>
                <div className="text-lg sm:text-xl font-bold text-purple-300 flex items-center gap-1.5">
                  <Award className="w-5 h-5 text-purple-400" />
                  <span>{(pilot.warPoints ?? 0).toLocaleString()} WP</span>
                </div>
              </div>
            </div>

            {/* Section A: Rotating War Point Offers */}
            <section
              data-testid="shop-wp-rotating-section"
              className="rounded-lg border border-purple-500/35 bg-[#0D131D]/95 p-3.5 sm:p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                    <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
                      {t('shop.wpRotatingTitle')}
                    </h2>
                    <span
                      data-testid="shop-wp-stock-badge"
                      className="px-2 py-0.5 rounded border border-purple-500/40 bg-purple-500/15 text-purple-200 font-mono-nums text-[11px] font-semibold"
                    >
                      {t('shop.stockAvailable', {
                        avail: availableWpOffersCount,
                        total: wpMarketOffers.length,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {t('shop.wpRotatingDesc')}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="shop-wp-refresh-btn"
                  disabled={!canRefreshWp}
                  onClick={handleRefreshWp}
                  className="min-h-[44px] md:min-h-0 md:h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg md:rounded border border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-purple-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {t('shop.wpRefreshBtn', { cost: wpRefreshCostWp })}
                  </span>
                </button>
              </div>

              {wpMarketOffers.length === 0 ? (
                <div className="rounded border border-slate-800 bg-[#080C14] p-6 text-center text-xs text-slate-400">
                  {t('shop.wpNoOffers')}
                </div>
              ) : (
                <>
                  {/* Mobile Rotating WP List (< md) */}
                  <div className="md:hidden divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-[#080C14] overflow-hidden">
                    {wpMarketOffers.map((offer) => {
                      const { name } = getWpOfferText(lang, t, offer);
                      const isSoldOut = Boolean(offer.soldOut);
                      const canAffordWp = (pilot.warPoints ?? 0) >= offer.wpCost;
                      return (
                        <button
                          key={offer.id}
                          type="button"
                          onClick={() =>
                            setMobileSheet({ kind: 'wpOffer', offerId: offer.id })
                          }
                          className={`w-full min-h-[64px] px-3.5 py-3 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 cursor-pointer ${
                            isSoldOut ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                                offer.kind === 'equipment_crate' && offer.minRarity
                                  ? `${RARITY_META[offer.minRarity].borderClass} ${RARITY_META[offer.minRarity].bgTintClass} ${RARITY_META[offer.minRarity].textClass}`
                                  : 'border-purple-400/50 bg-purple-500/15 text-purple-300'
                              }`}
                            >
                              <ConsumableIcon
                                kind={offer.kind}
                                className="w-5 h-5"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-100 truncate">
                                {name}
                              </div>
                              <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                                {offer.slot && (
                                  <SlotIcon
                                    slot={offer.slot}
                                    className="w-3 h-3 shrink-0"
                                  />
                                )}
                                <span>
                                  {offer.slot
                                    ? getSlotLabel(lang, offer.slot)
                                    : t('inv.tabConsumables')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSoldOut ? (
                              <span
                                data-testid="shop-sold-out-badge"
                                className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-[10px] font-bold text-slate-300"
                              >
                                {t('shop.soldOut')}
                              </span>
                            ) : (
                              <span
                                className={`font-mono-nums text-sm font-bold ${
                                  canAffordWp ? 'text-purple-300' : 'text-red-400'
                                }`}
                              >
                                {offer.wpCost} WP
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop Rotating WP Grid (>= md) */}
                  <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-3">
                    {wpMarketOffers.map((offer) => {
                      const { name, desc } = getWpOfferText(lang, t, offer);
                      const isSoldOut = Boolean(offer.soldOut);
                      const canAffordWp = (pilot.warPoints ?? 0) >= offer.wpCost;
                      const rarityStyle =
                        offer.kind === 'equipment_crate' && offer.minRarity
                          ? RARITY_META[offer.minRarity]
                          : null;

                      return (
                        <div
                          key={offer.id}
                          data-testid={`wp-offer-card-${offer.id}`}
                          className={`rounded-lg border p-3.5 flex flex-col justify-between gap-3 bg-[#080C14] ${
                            isSoldOut
                              ? 'border-slate-800 opacity-60'
                              : rarityStyle
                              ? rarityStyle.borderClass
                              : 'border-purple-500/40'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div
                                  className={`w-10 h-10 rounded-md border flex items-center justify-center shrink-0 ${
                                    rarityStyle
                                      ? `${rarityStyle.borderClass} ${rarityStyle.bgTintClass} ${rarityStyle.textClass}`
                                      : 'border-purple-400/50 bg-purple-500/15 text-purple-300'
                                  }`}
                                >
                                  <ConsumableIcon
                                    kind={offer.kind}
                                    className="w-5 h-5"
                                  />
                                </div>

                                <div className="min-w-0">
                                  <h3
                                    className={`font-display text-base font-bold leading-tight ${
                                      rarityStyle
                                        ? rarityStyle.textClass
                                        : 'text-slate-100'
                                    }`}
                                  >
                                    {name}
                                  </h3>
                                  {offer.slot && (
                                    <div className="inline-flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                      <SlotIcon
                                        slot={offer.slot}
                                        className={`w-3 h-3 shrink-0 ${getSlotAccentClass(
                                          offer.slot
                                        )}`}
                                      />
                                      <span>{getSlotLabel(lang, offer.slot)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isSoldOut && (
                                <span
                                  data-testid="shop-sold-out-badge"
                                  className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-[10px] font-bold text-slate-300 shrink-0"
                                >
                                  {t('shop.soldOut')}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 leading-relaxed">
                              {desc}
                            </p>
                          </div>

                          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3">
                            <div className="font-mono-nums text-sm font-bold text-purple-300 flex items-center gap-1">
                              <Award className="w-4 h-4 text-purple-400" />
                              <span>{offer.wpCost} WP</span>
                            </div>

                            <button
                              type="button"
                              disabled={isSoldOut || !canAffordWp}
                              onClick={() => handleBuyWpOffer(offer)}
                              className="h-9 px-3.5 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {isSoldOut
                                ? t('shop.soldOut')
                                : canAffordWp
                                ? t('shop.buyOfferBtn', { cost: offer.wpCost })
                                : t('shop.insufficientWp', {
                                    cost: offer.wpCost,
                                  })}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* Section B: Class Skill Opening Cards */}
            <section
              data-testid="shop-wp-cards-section"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
                    {t('shop.wpOpeningCardsTitle')}
                  </h2>
                  <span className="font-mono-nums text-xs text-slate-400">
                    ({ownedCardsCount}/{OPENING_CARDS_LIST.length})
                  </span>
                </div>
              </div>

              {/* WP Class Filter Tabs (Wrapped with shared ClassIcon) */}
              <div
                data-testid="shop-wp-class-tabs"
                className="flex flex-wrap items-center gap-1.5"
                role="tablist"
              >
                <button
                  type="button"
                  data-testid="shop-wp-class-tab-all"
                  onClick={() => setWpClassFilter('all')}
                  className={`min-h-[44px] md:min-h-0 md:h-9 px-3 rounded-lg md:rounded border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                    wpClassFilter === 'all'
                      ? 'bg-slate-800 border-purple-400/80 text-slate-50'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClassIcon classId="all" className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('common.allClasses')}</span>
                </button>
                {MECH_CLASS_LIST.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    data-testid={`shop-wp-class-tab-${cls.id}`}
                    onClick={() => setWpClassFilter(cls.id)}
                    className={`min-h-[44px] md:min-h-0 md:h-9 px-3 rounded-lg md:rounded border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                      wpClassFilter === cls.id
                        ? 'bg-slate-800 border-purple-400/80 text-slate-50'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ClassIcon
                      classId={cls.id}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                    <span>{getClassName(lang, cls.id)}</span>
                  </button>
                ))}
              </div>

              {/* Mobile Opening Cards List (< md) */}
              <div className="md:hidden divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-[#0D131D]/95 overflow-hidden">
                {filteredOpeningCards.map((card) => {
                  const skill = getSkillById(card.skillId);
                  if (!skill) return null;
                  const isOwned = pilot.ownedOpeningCards.includes(card.id);
                  const isElite = card.category === 'elite';
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() =>
                        setMobileSheet({ kind: 'wp', cardId: card.id })
                      }
                      className="w-full min-h-[64px] px-3.5 py-3 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                            isElite
                              ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
                              : 'border-purple-400/60 bg-purple-500/15 text-purple-300'
                          }`}
                        >
                          <SkillIcon icon={skill.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-100 truncate">
                            {getSkillName(lang, skill.id)}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {getClassName(lang, card.classId)} ·{' '}
                            {getSkillCategoryLabel(lang, card.category)} · Lv.
                            {skill.unlockLevel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOwned ? (
                          <span className="text-xs font-bold text-emerald-400">
                            {t('common.owned')}
                          </span>
                        ) : (
                          <span className="font-mono-nums text-sm font-bold text-purple-300">
                            {card.warPointCost} WP
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop Opening Cards Grid (>= md) */}
              <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredOpeningCards.map((card) => {
                  const skill = getSkillById(card.skillId);
                  if (!skill) return null;
                  const isOwned = pilot.ownedOpeningCards.includes(card.id);
                  const canAfford = (pilot.warPoints ?? 0) >= card.warPointCost;
                  const isElite = card.category === 'elite';

                  return (
                    <div
                      key={card.id}
                      className={`rounded-lg border p-4 flex flex-col justify-between gap-3 bg-[#0D131D]/95 ${
                        isOwned
                          ? 'border-emerald-500/50'
                          : isElite
                          ? 'border-amber-400/70'
                          : 'border-purple-400/60'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-md border flex items-center justify-center shrink-0 ${
                                isElite
                                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
                                  : 'border-purple-400/60 bg-purple-500/15 text-purple-300'
                              }`}
                            >
                              <SkillIcon icon={skill.icon} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold border ${
                                    isElite
                                      ? 'border-amber-400/70 bg-amber-500/15 text-amber-300'
                                      : 'border-purple-400/70 bg-purple-500/15 text-purple-300'
                                  }`}
                                >
                                  {getSkillCategoryLabel(lang, card.category)}
                                </span>
                                <span className="text-slate-400 inline-flex items-center gap-1">
                                  <ClassIcon
                                    classId={card.classId}
                                    className="w-3 h-3 shrink-0"
                                  />
                                  {getClassName(lang, card.classId)} ·{' '}
                                  {t('common.reqLevel', {
                                    level: skill.unlockLevel,
                                  })}
                                </span>
                              </div>
                              <h3 className="font-display text-lg font-bold text-slate-100 leading-tight mt-0.5">
                                {t('shop.openingCardTitle', {
                                  skill: getSkillName(lang, skill.id),
                                })}
                              </h3>
                            </div>
                          </div>

                          <span className="font-mono-nums text-xs font-bold text-amber-400 shrink-0">
                            {skill.spCost} SP
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {getSkillDesc(lang, skill.id)}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3">
                        <div className="font-mono-nums text-sm font-bold text-purple-300 flex items-center gap-1">
                          <Award className="w-4 h-4 text-purple-400" />
                          <span>{card.warPointCost} WP</span>
                        </div>

                        {isOwned ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab('skill')}
                            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t('shop.cardOwnedBadge')}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() =>
                              handleBuyOpeningCard(card.id, skill.id)
                            }
                            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>
                              {canAfford
                                ? t('shop.buyCardBtn', {
                                    cost: card.warPointCost,
                                  })
                                : t('shop.insufficientWp', {
                                    cost: card.warPointCost,
                                  })}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* BUY RANDOMIZED STOCK */}
        {shopSubTab === 'buy' && (
          <>
            {filteredStock.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-[#0D131D]/90 p-10 text-center text-sm text-slate-400">
                {t('shop.noMatch')}
              </div>
            ) : (
              <>
                {/* Mobile Compact List Rows (< md) -> Buy in BottomSheet */}
                <div className="md:hidden divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-[#0D131D]/95 overflow-hidden">
                  {filteredStock.map((item) => {
                    const isSoldOut = Boolean(item.soldOut);
                    const validation = validateEquipOnGear(
                      item,
                      activeGear,
                      pilot.gears
                    );
                    const itemStats = getEffectiveItemStats(item);
                    const statPreview = STAT_KEYS.filter((k) => itemStats[k] > 0)
                      .slice(0, 3)
                      .map((k) => `+${itemStats[k]} ${getStatShort(lang, k)}`)
                      .join(' · ');

                    return (
                      <button
                        key={item.instanceId}
                        type="button"
                        onClick={() =>
                          setMobileSheet({ kind: 'buy', itemId: item.instanceId })
                        }
                        className={`w-full min-h-[68px] px-3.5 py-3 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 cursor-pointer ${
                          isSoldOut ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <SlotIcon
                              slot={item.slot}
                              className={`w-3.5 h-3.5 shrink-0 ${getSlotAccentClass(
                                item.slot
                              )}`}
                            />
                            <span
                              className={`text-sm font-bold truncate ${
                                RARITY_META[item.rarity].textClass
                              }`}
                            >
                              {getItemInstanceName(lang, item)}
                            </span>
                            {!validation.canEquip &&
                              formatEquipValidationReason(lang, validation) &&
                              !isSoldOut && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {getSlotShort(lang, item.slot)} · T{item.tier} · Lv.
                            {item.requiredLevel} · {item.rollQuality}%
                          </div>
                          {statPreview && (
                            <div className="text-xs font-mono-nums text-emerald-400 truncate">
                              {statPreview}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSoldOut ? (
                            <span
                              data-testid="shop-sold-out-badge"
                              className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-[10px] font-bold text-slate-300"
                            >
                              {t('shop.soldOut')}
                            </span>
                          ) : (
                            <div className="text-right font-mono-nums">
                              <div
                                className={`text-sm font-bold ${
                                  pilot.credits >= item.price
                                    ? 'text-amber-300'
                                    : 'text-red-400'
                                }`}
                              >
                                {item.price.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                CR
                              </div>
                            </div>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Desktop Multi-Column Card Grid (>= md) */}
                <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredStock.map((item) => {
                    const isSoldOut = Boolean(item.soldOut);
                    const validation = validateEquipOnGear(
                      item,
                      activeGear,
                      pilot.gears
                    );
                    const reasonText = formatEquipValidationReason(
                      lang,
                      validation
                    );
                    const canAfford = pilot.credits >= item.price;
                    const canBuy = !isSoldOut && canAfford && !isInventoryFull;
                    const itemStats = getEffectiveItemStats(item);
                    const currentInSlot =
                      item.slot !== 'module'
                        ? equippedOnActive[item.slot]
                        : null;
                    const curSlotStats = currentInSlot
                      ? getEffectiveItemStats(currentInSlot)
                      : null;
                    const traits = formatItemTraitsList(lang, item);

                    return (
                      <div
                        key={item.instanceId}
                        data-testid={`shop-item-card-${item.instanceId}`}
                        className={`rounded-lg border bg-[#0D131D]/95 p-4 flex flex-col justify-between gap-3 ${
                          isSoldOut
                            ? 'border-slate-800 opacity-60'
                            : RARITY_META[item.rarity].borderClass
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <SlotIcon
                                  slot={item.slot}
                                  className={`w-4 h-4 shrink-0 ${getSlotAccentClass(
                                    item.slot
                                  )}`}
                                />
                                <h2
                                  className={`font-display text-xl font-bold leading-tight truncate ${
                                    RARITY_META[item.rarity].textClass
                                  }`}
                                >
                                  {getItemInstanceName(lang, item)}
                                </h2>
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {getSlotLabel(lang, item.slot)} ·{' '}
                                {getRarityLabel(lang, item.rarity)} ·{' '}
                                {t('common.tier', { tier: item.tier })} ·{' '}
                                {t('common.levelShort')}
                                {item.requiredLevel}
                                {' · '}
                                {item.classRestriction
                                  ? t('common.classOnly', {
                                      className: getClassName(
                                        lang,
                                        item.classRestriction
                                      ),
                                    })
                                  : t('common.allClasses')}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {isSoldOut && (
                                <span
                                  data-testid="shop-sold-out-badge"
                                  className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-[10px] font-bold text-slate-300"
                                >
                                  {t('shop.soldOut')}
                                </span>
                              )}
                              <span
                                className={`font-mono-nums text-xs font-bold ${
                                  item.rollQuality >= 80
                                    ? 'text-amber-400'
                                    : item.rollQuality >= 50
                                    ? 'text-emerald-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {item.rollQuality}%
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed">
                            {getItemInstanceDesc(lang, item)}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-nums text-emerald-400 font-semibold">
                            {STAT_KEYS.filter((k) => itemStats[k] > 0).map(
                              (key) => (
                                <span key={key}>
                                  +{itemStats[key]} {getStatShort(lang, key)}
                                </span>
                              )
                            )}
                          </div>

                          {traits.length > 0 && (
                            <div className="flex flex-wrap gap-x-2.5 text-[11px] text-amber-300">
                              {traits.map((tr, i) => (
                                <span key={i}>{tr}</span>
                              ))}
                            </div>
                          )}

                          <div className="rounded border border-slate-800/90 bg-[#080C14] px-2.5 py-1.5 text-[11px] space-y-0.5">
                            <div className="text-slate-400">
                              {t('shop.compareVs', {
                                gear: getClassName(lang, activeGear.classId),
                              })}
                            </div>
                            {!curSlotStats ? (
                              <div className="text-emerald-400 font-medium">
                                {t('shop.emptySlotGain')}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-x-2.5 font-mono-nums">
                                {STAT_KEYS.map((k) => {
                                  const diff = itemStats[k] - curSlotStats[k];
                                  if (diff === 0) return null;
                                  return (
                                    <span
                                      key={k}
                                      className={
                                        diff > 0
                                          ? 'text-emerald-400 font-semibold'
                                          : 'text-red-400 font-semibold'
                                      }
                                    >
                                      {getStatShort(lang, k)}{' '}
                                      {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {!validation.canEquip && reasonText && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2.5 py-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {t('shop.cannotEquipNow', {
                                  reason: reasonText,
                                })}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-slate-800/90 flex items-center justify-between gap-3">
                          <div className="font-mono-nums text-base font-bold text-slate-100">
                            {item.price.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-slate-400">
                              CR
                            </span>
                          </div>

                          <button
                            type="button"
                            data-testid={`shop-buy-btn-${item.instanceId}`}
                            disabled={!canBuy}
                            onClick={() => handleBuy(item)}
                            className="h-10 px-4 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {isSoldOut
                              ? t('shop.soldOut')
                              : isInventoryFull
                              ? t('shop.cargoFullBtn')
                              : canAfford
                              ? t('shop.buyBtn')
                              : t('shop.insufficientCr')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* SELL CARGO (including equipped & locked protection labels + shortcuts) */}
        {shopSubTab === 'sell' && (
          <div className="rounded-lg border border-slate-800/90 bg-[#0D131D]/95 overflow-hidden md:p-4">
            {filteredSellInventory.length === 0 ? (
              <div className="py-10 px-4 text-center text-sm text-slate-400">
                {pilot.inventory.length === 0
                  ? t('shop.sellEmpty')
                  : t('shop.sellEmptyFilter')}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredSellInventory.map((inst) => {
                  const sellPrice = getSellPrice(inst);
                  const effStats = getEffectiveItemStats(inst);
                  const equippedByGear = getItemEquippedByGear(
                    pilot.gears,
                    inst.instanceId
                  );
                  const isLocked = Boolean(inst.locked);
                  const canSell = equippedByGear === null && !isLocked;

                  return (
                    <div
                      key={inst.instanceId}
                      data-testid={`shop-sell-row-${inst.instanceId}`}
                      className="px-3.5 py-3 md:px-0 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <button
                          type="button"
                          onClick={() =>
                            setMobileSheet({
                              kind: 'sell',
                              itemId: inst.instanceId,
                            })
                          }
                          className="w-full min-w-0 space-y-1 text-left cursor-pointer md:cursor-default"
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span
                              className={`font-semibold text-sm ${
                                RARITY_META[inst.rarity].textClass
                              }`}
                            >
                              {getItemInstanceName(lang, inst, true)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {getSlotShort(lang, inst.slot)} · T{inst.tier} ·{' '}
                              {inst.rollQuality}%
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 text-xs font-mono-nums text-slate-300">
                            {STAT_KEYS.filter((k) => effStats[k] > 0).map(
                              (k) => (
                                <span key={k}>
                                  +{effStats[k]} {getStatShort(lang, k)}
                                </span>
                              )
                            )}
                          </div>
                        </button>

                        {(equippedByGear !== null || isLocked) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {equippedByGear !== null && (
                              <span
                                data-testid={`shop-sell-equipped-badge-${inst.instanceId}`}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-sky-500/50 bg-sky-500/12 text-[11px] font-semibold text-sky-200"
                              >
                                <ClassIcon
                                  classId={equippedByGear}
                                  colored={false}
                                  className="w-3 h-3 shrink-0"
                                />
                                <span>
                                  {t('shop.equippedOnGear', {
                                    gear: getClassName(lang, equippedByGear),
                                  })}
                                </span>
                                <button
                                  type="button"
                                  data-testid={`shop-sell-unequip-${inst.instanceId}`}
                                  onClick={() =>
                                    unequipInstanceEverywhere(inst.instanceId)
                                  }
                                  className="ml-0.5 px-1.5 py-0.5 rounded bg-sky-500/25 hover:bg-sky-500/40 text-sky-100 font-bold cursor-pointer"
                                >
                                  {t('shop.unequipShortcut')}
                                </button>
                              </span>
                            )}
                            {isLocked && (
                              <span
                                data-testid={`shop-sell-locked-badge-${inst.instanceId}`}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-500/50 bg-amber-500/12 text-[11px] font-semibold text-amber-200"
                              >
                                <Lock className="w-3 h-3 shrink-0" />
                                <span>{t('shop.lockedProtectBadge')}</span>
                                <button
                                  type="button"
                                  data-testid={`shop-sell-unlock-${inst.instanceId}`}
                                  onClick={() => toggleItemLock(inst.instanceId)}
                                  className="ml-0.5 px-1.5 py-0.5 rounded bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 font-bold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Unlock className="w-3 h-3" />
                                  <span>{t('shop.unlockShortcut')}</span>
                                </button>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                        <div className="text-right font-mono-nums">
                          <div className="text-sm font-bold text-amber-400">
                            +{sellPrice.toLocaleString()} CR
                          </div>
                          <div className="hidden sm:block text-[11px] text-slate-500">
                            {t('shop.sellRatioNote', {
                              price: inst.price.toLocaleString(),
                            })}
                          </div>
                        </div>

                        <button
                          type="button"
                          data-testid={`shop-sell-btn-${inst.instanceId}`}
                          disabled={!canSell}
                          title={
                            equippedByGear !== null
                              ? t('inv.sellDisabledEquipped')
                              : isLocked
                              ? t('inv.sellDisabledLocked')
                              : undefined
                          }
                          onClick={() => handleSell(inst)}
                          className="min-h-[44px] md:min-h-0 md:h-10 px-4 rounded-lg md:rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-100 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {t('shop.sellBtn')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Bottom Sheet for Shop Buy / Sell / WP Card / WP Offer */}
      <div className="md:hidden">
        <BottomSheet
          open={
            Boolean(mobileSheet) &&
            (mobileSheet?.kind !== 'sell' || Boolean(activeSellItem))
          }
          onClose={() => setMobileSheet(null)}
          title={
            mobileSheet?.kind === 'buy' && activeBuyItem
              ? getItemInstanceName(lang, activeBuyItem, true)
              : mobileSheet?.kind === 'sell' && activeSellItem
              ? getItemInstanceName(lang, activeSellItem, true)
              : activeWpOffer
              ? getWpOfferText(lang, t, activeWpOffer).name
              : activeWpCard
              ? getSkillName(lang, activeWpCard.skillId)
              : ''
          }
          subtitle={
            mobileSheet?.kind === 'buy' && activeBuyItem
              ? `${getSlotLabel(lang, activeBuyItem.slot)} · ${getRarityLabel(
                  lang,
                  activeBuyItem.rarity
                )} · ${t('common.tier', { tier: activeBuyItem.tier })}`
              : mobileSheet?.kind === 'sell' && activeSellItem
              ? `${getSlotLabel(lang, activeSellItem.slot)} · ${getRarityLabel(
                  lang,
                  activeSellItem.rarity
                )} · ${t('common.tier', { tier: activeSellItem.tier })}`
              : activeWpOffer
              ? activeWpOffer.slot
                ? getSlotLabel(lang, activeWpOffer.slot)
                : t('inv.tabConsumables')
              : activeWpCard
              ? `${getClassName(lang, activeWpCard.classId)} · ${getSkillCategoryLabel(
                  lang,
                  activeWpCard.category
                )}`
              : undefined
          }
        >
          {mobileSheet?.kind === 'buy' &&
            activeBuyItem &&
            (() => {
              const item = activeBuyItem;
              const isSoldOut = Boolean(item.soldOut);
              const validation = validateEquipOnGear(
                item,
                activeGear,
                pilot.gears
              );
              const reasonText = formatEquipValidationReason(lang, validation);
              const canAfford = pilot.credits >= item.price;
              const canBuy = !isSoldOut && canAfford && !isInventoryFull;
              const itemStats = getEffectiveItemStats(item);
              const currentInSlot =
                item.slot !== 'module' ? equippedOnActive[item.slot] : null;
              const curSlotStats = currentInSlot
                ? getEffectiveItemStats(currentInSlot)
                : null;
              const traits = formatItemTraitsList(lang, item);

              return (
                <div className="space-y-3.5">
                  {isSoldOut && (
                    <div className="inline-flex px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300">
                      {t('shop.soldOut')}
                    </div>
                  )}

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {getItemInstanceDesc(lang, item)}
                  </p>

                  <div className="rounded-lg border border-slate-800 bg-[#080C14] p-3 space-y-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-mono-nums text-emerald-400 font-semibold">
                      {STAT_KEYS.filter((k) => itemStats[k] > 0).map((key) => (
                        <span key={key}>
                          +{itemStats[key]} {getStatShort(lang, key)}
                        </span>
                      ))}
                    </div>
                    {traits.length > 0 && (
                      <div className="flex flex-wrap gap-x-2.5 text-xs text-amber-300 pt-1.5 border-t border-slate-800">
                        {traits.map((tr, i) => (
                          <span key={i}>{tr}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#080C14] p-3 text-xs space-y-1">
                    <div className="text-slate-400">
                      {t('shop.compareVs', {
                        gear: getClassName(lang, activeGear.classId),
                      })}
                    </div>
                    {!curSlotStats ? (
                      <div className="text-emerald-400 font-medium">
                        {t('shop.emptySlotGain')}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-x-3 font-mono-nums text-sm">
                        {STAT_KEYS.map((k) => {
                          const diff = itemStats[k] - curSlotStats[k];
                          if (diff === 0) return null;
                          return (
                            <span
                              key={k}
                              className={
                                diff > 0
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-red-400 font-semibold'
                              }
                            >
                              {getStatShort(lang, k)}{' '}
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!validation.canEquip && reasonText && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {t('shop.cannotEquipNow', { reason: reasonText })}
                      </span>
                    </div>
                  )}

                  {isInventoryFull && !isSoldOut && (
                    <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {t('shop.cargoFullTag', {
                          count: pilot.inventory.length,
                          max: boxCap,
                        })}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => handleBuy(item)}
                    className="w-full min-h-[48px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    {isSoldOut
                      ? t('shop.soldOut')
                      : isInventoryFull
                      ? t('shop.cargoFullBtn')
                      : canAfford
                      ? `${t('shop.buyBtn')} (${item.price.toLocaleString()} CR)`
                      : `${t('shop.insufficientCr')} (${item.price.toLocaleString()} CR)`}
                  </button>
                </div>
              );
            })()}

          {mobileSheet?.kind === 'sell' &&
            activeSellItem &&
            (() => {
              const inst = activeSellItem;
              const sellPrice = getSellPrice(inst);
              const effStats = getEffectiveItemStats(inst);
              const equippedByGear = getItemEquippedByGear(
                pilot.gears,
                inst.instanceId
              );
              const isLocked = Boolean(inst.locked);
              const canSell = equippedByGear === null && !isLocked;

              return (
                <div className="space-y-4">
                  <p className="text-sm text-slate-300">
                    {getItemInstanceDesc(lang, inst)}
                  </p>
                  <div className="rounded-lg border border-slate-800 bg-[#080C14] p-3 flex flex-wrap gap-x-3 gap-y-1 text-sm font-mono-nums text-slate-100">
                    {STAT_KEYS.filter((k) => effStats[k] > 0).map((k) => (
                      <span key={k}>
                        +{effStats[k]} {getStatShort(lang, k)}
                      </span>
                    ))}
                  </div>
                  {(equippedByGear !== null || isLocked) && (
                    <div className="space-y-2">
                      {equippedByGear !== null && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                          <span className="font-semibold">
                            {t('shop.equippedOnGear', {
                              gear: getClassName(lang, equippedByGear),
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              unequipInstanceEverywhere(inst.instanceId)
                            }
                            className="min-h-[36px] px-3 rounded bg-sky-500/25 hover:bg-sky-500/40 text-sky-100 font-bold cursor-pointer"
                          >
                            {t('shop.unequipShortcut')}
                          </button>
                        </div>
                      )}
                      {isLocked && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          <span className="font-semibold inline-flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            {t('shop.lockedProtectBadge')}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleItemLock(inst.instanceId)}
                            className="min-h-[36px] px-3 rounded bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 font-bold cursor-pointer"
                          >
                            {t('shop.unlockShortcut')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!canSell}
                    onClick={() => handleSell(inst)}
                    className="w-full min-h-[48px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    {equippedByGear !== null
                      ? t('inv.sellDisabledEquipped')
                      : isLocked
                      ? t('inv.sellDisabledLocked')
                      : `${t('shop.sellBtn')} (+${sellPrice.toLocaleString()} CR)`}
                  </button>
                </div>
              );
            })()}

          {mobileSheet?.kind === 'wpOffer' &&
            activeWpOffer &&
            (() => {
              const offer = activeWpOffer;
              const { desc } = getWpOfferText(lang, t, offer);
              const isSoldOut = Boolean(offer.soldOut);
              const canAffordWp = (pilot.warPoints ?? 0) >= offer.wpCost;
              return (
                <div className="space-y-4">
                  {isSoldOut && (
                    <div className="inline-flex px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300">
                      {t('shop.soldOut')}
                    </div>
                  )}
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {desc}
                  </p>
                  <button
                    type="button"
                    disabled={isSoldOut || !canAffordWp}
                    onClick={() => handleBuyWpOffer(offer)}
                    className="w-full min-h-[48px] px-4 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-sm cursor-pointer"
                  >
                    {isSoldOut
                      ? t('shop.soldOut')
                      : canAffordWp
                      ? t('shop.buyOfferBtn', { cost: offer.wpCost })
                      : t('shop.insufficientWp', { cost: offer.wpCost })}
                  </button>
                </div>
              );
            })()}

          {mobileSheet?.kind === 'wp' &&
            activeWpCard &&
            (() => {
              const skill = getSkillById(activeWpCard.skillId);
              if (!skill) return null;
              const isOwned = pilot.ownedOpeningCards.includes(activeWpCard.id);
              const canAfford =
                (pilot.warPoints ?? 0) >= activeWpCard.warPointCost;
              return (
                <div className="space-y-4">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {getSkillDesc(lang, skill.id)}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono-nums">
                    <span>
                      {t('common.reqLevel', { level: skill.unlockLevel })}
                    </span>
                    <span className="text-amber-400 font-bold">
                      {skill.spCost} SP
                    </span>
                  </div>
                  {isOwned ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSheet(null);
                        setActiveTab('skill');
                      }}
                      className="w-full min-h-[48px] px-4 rounded-lg border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-bold text-sm cursor-pointer"
                    >
                      {t('shop.goToSkillTab')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() =>
                        handleBuyOpeningCard(activeWpCard.id, skill.id)
                      }
                      className="w-full min-h-[48px] px-4 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-sm cursor-pointer"
                    >
                      {canAfford
                        ? t('shop.buyCardBtn', {
                            cost: activeWpCard.warPointCost,
                          })
                        : t('shop.insufficientWp', {
                            cost: activeWpCard.warPointCost,
                          })}
                    </button>
                  )}
                </div>
              );
            })()}
        </BottomSheet>
      </div>
    </div>
  );
}
