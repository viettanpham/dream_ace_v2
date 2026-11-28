import { Package, RotateCcw } from 'lucide-react';
import { SHOP_CONFIG } from '../../data/items';
import {
  cloneCrateShopConfig,
  CRATE_SHOP_CREDIT_MAX_PRICE,
  CRATE_SHOP_MAX_CHANCE,
  CRATE_SHOP_MAX_PER_SLOT,
  CRATE_SHOP_MAX_SLOTS,
  CRATE_SHOP_MIN_CHANCE,
  CRATE_SHOP_MIN_PER_SLOT,
  CRATE_SHOP_MIN_PRICE,
  CRATE_SHOP_MIN_SLOTS,
  CRATE_SHOP_WP_MAX_PRICE,
  DEFAULT_CRATE_SHOP_CONFIG,
  sanitizeCrateShopConfig,
} from '../../engine/shop';
import { estimateCrateValue } from '../../engine/supplyRewards';
import { useI18n } from '../../i18n';
import type {
  AdminConfig,
  CrateShopConfig,
  CrateShopSideConfig,
} from '../../types/game';

interface CrateShopAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
}

const VALUE_CHECK_LEVELS = [1, 20, 50] as const;

function fmtDecimal(n: number, lang: 'vi' | 'en'): string {
  const fixed = Number(n.toFixed(2));
  const raw = String(fixed);
  return lang === 'vi' ? raw.replace('.', ',') : raw;
}

export function CrateShopAdminBlock({
  adminConfig,
  adminUpdateConfig,
}: CrateShopAdminBlockProps) {
  const { lang, t } = useI18n();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const cfg = sanitizeCrateShopConfig(adminConfig.crateShop);

  const commit = (next: CrateShopConfig) => {
    adminUpdateConfig({
      crateShop: sanitizeCrateShopConfig(next),
    });
  };

  const updateSideField = (
    side: 'wp' | 'credit',
    field: keyof CrateShopSideConfig,
    raw: string
  ) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    commit({
      ...cfg,
      [side]: {
        ...cfg[side],
        [field]: n,
      },
    });
  };

  const sides: Array<{
    key: 'wp' | 'credit';
    title: string;
    priceLabel: string;
    maxPrice: number;
    toneClass: string;
    exToneClass: string;
  }> = [
    {
      key: 'wp',
      title: t('admin.crateShop.wpGroup'),
      priceLabel: t('admin.crateShop.priceWp'),
      maxPrice: CRATE_SHOP_WP_MAX_PRICE,
      toneClass: 'text-purple-300',
      exToneClass: 'text-purple-200/90',
    },
    {
      key: 'credit',
      title: t('admin.crateShop.creditGroup'),
      priceLabel: t('admin.crateShop.priceCredit'),
      maxPrice: CRATE_SHOP_CREDIT_MAX_PRICE,
      toneClass: 'text-amber-300',
      exToneClass: 'text-amber-200/90',
    },
  ];

  return (
    <div
      data-testid="admin-crate-shop-block"
      className="space-y-3 min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 min-w-0">
          <Package className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('admin.battleSection.crateShop.title')}</span>
        </div>
        <button
          type="button"
          data-testid="admin-crate-shop-reset"
          onClick={() =>
            adminUpdateConfig({
              crateShop: cloneCrateShopConfig(DEFAULT_CRATE_SHOP_CONFIG),
            })
          }
          className="h-8 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          <span>{t('admin.crateShop.reset')}</span>
        </button>
      </div>

      {sides.map(({ key, title, priceLabel, maxPrice, toneClass, exToneClass }) => {
        const side = cfg[key];
        const avgHitSlots = (side.chancePct / 100) * side.maxSlots;
        const avgPerHit = (1 + side.maxPerSlot) / 2;
        const avgCratesPerRoll = avgHitSlots * avgPerHit;
        const priceExample =
          key === 'wp'
            ? t('admin.crateShop.exPriceWp', {
                price: side.price.toLocaleString(locale),
              })
            : t('admin.crateShop.exPriceCredit', {
                price: side.price.toLocaleString(locale),
              });

        return (
          <div
            key={key}
            className="rounded border border-slate-800 bg-slate-950/40 p-2.5 space-y-2 min-w-0"
          >
            <div className={`text-xs font-bold ${toneClass}`}>{title}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 min-w-0">
              <label className="space-y-1 block min-w-0">
                <span className="text-[11px] text-slate-300 block">
                  {t('admin.crateShop.chancePct')}
                </span>
                <input
                  type="number"
                  data-testid={`admin-crate-shop-${key}-chance`}
                  min={CRATE_SHOP_MIN_CHANCE}
                  max={CRATE_SHOP_MAX_CHANCE}
                  value={side.chancePct}
                  onChange={(e) =>
                    updateSideField(key, 'chancePct', e.target.value)
                  }
                  className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <span
                  data-testid={`admin-crate-shop-${key}-chance-ex`}
                  className={`block text-[11px] font-mono-nums leading-snug break-words ${exToneClass}`}
                >
                  {t('admin.crateShop.exChance', {
                    pct: side.chancePct,
                    avg: fmtDecimal(avgHitSlots, lang),
                    slots: side.maxSlots,
                    perSlot: side.maxPerSlot,
                  })}
                </span>
              </label>

              <label className="space-y-1 block min-w-0">
                <span className="text-[11px] text-slate-300 block">
                  {t('admin.crateShop.maxSlots')}
                </span>
                <input
                  type="number"
                  data-testid={`admin-crate-shop-${key}-max-slots`}
                  min={CRATE_SHOP_MIN_SLOTS}
                  max={CRATE_SHOP_MAX_SLOTS}
                  value={side.maxSlots}
                  onChange={(e) =>
                    updateSideField(key, 'maxSlots', e.target.value)
                  }
                  className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <span
                  data-testid={`admin-crate-shop-${key}-max-slots-ex`}
                  className={`block text-[11px] font-mono-nums leading-snug break-words ${exToneClass}`}
                >
                  {t('admin.crateShop.exSlots', {
                    slots: side.maxSlots,
                    avgCrates: fmtDecimal(avgCratesPerRoll, lang),
                  })}
                </span>
              </label>

              <label className="space-y-1 block min-w-0">
                <span className="text-[11px] text-slate-300 block">
                  {t('admin.crateShop.maxPerSlot')}
                </span>
                <input
                  type="number"
                  data-testid={`admin-crate-shop-${key}-max-per-slot`}
                  min={CRATE_SHOP_MIN_PER_SLOT}
                  max={CRATE_SHOP_MAX_PER_SLOT}
                  value={side.maxPerSlot}
                  onChange={(e) =>
                    updateSideField(key, 'maxPerSlot', e.target.value)
                  }
                  className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <span
                  data-testid={`admin-crate-shop-${key}-max-per-slot-ex`}
                  className={`block text-[11px] font-mono-nums leading-snug break-words ${exToneClass}`}
                >
                  {t('admin.crateShop.exPerSlot', {
                    max: side.maxPerSlot,
                    avg: fmtDecimal(avgPerHit, lang),
                  })}
                </span>
              </label>

              <label className="space-y-1 block min-w-0">
                <span className="text-[11px] text-slate-300 block">
                  {priceLabel}
                </span>
                <input
                  type="number"
                  data-testid={`admin-crate-shop-${key}-price`}
                  min={CRATE_SHOP_MIN_PRICE}
                  max={maxPrice}
                  value={side.price}
                  onChange={(e) => updateSideField(key, 'price', e.target.value)}
                  className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <span
                  data-testid={`admin-crate-shop-${key}-price-ex`}
                  className={`block text-[11px] font-mono-nums leading-snug break-words ${exToneClass}`}
                >
                  {priceExample}
                </span>
              </label>
            </div>
          </div>
        );
      })}

      {/* Expected Value Check (Lv 1 / 20 / 50) */}
      <div
        data-testid="admin-crate-shop-value-check"
        className="rounded border border-emerald-500/30 bg-emerald-950/15 p-2.5 space-y-1 min-w-0"
      >
        <div className="text-xs font-bold text-emerald-300">
          {t('admin.crateShop.valueHeading')}
        </div>
        {VALUE_CHECK_LEVELS.map((level) => {
          const val = estimateCrateValue(adminConfig, level);
          const sellValue = Math.round(val * SHOP_CONFIG.sellPriceRatio);
          return (
            <p
              key={level}
              data-testid={`admin-crate-shop-value-lv${level}`}
              className="text-[11px] font-mono-nums text-emerald-200/90 leading-snug break-words"
            >
              {t('admin.crateShop.valueLine', {
                level,
                value: val.toLocaleString(locale),
                sellValue: sellValue.toLocaleString(locale),
                wpPrice: cfg.wp.price.toLocaleString(locale),
                creditPrice: cfg.credit.price.toLocaleString(locale),
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
}
