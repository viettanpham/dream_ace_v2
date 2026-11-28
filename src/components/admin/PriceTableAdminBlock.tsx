import { useMemo, useState } from 'react';
import { RotateCcw, Search, Tag } from 'lucide-react';
import { BUFF_CARD_LIST, getBuffCardWpPrice } from '../../data/buffCards';
import { SUPPLY_TEMPLATES } from '../../data/consumables';
import { getCatalogRow } from '../../data/iconCatalog';
import { SHOP_CONFIG } from '../../data/items';
import {
  getOpeningCardsList,
  getSkillById,
  getSkillCardPrice,
} from '../../data/skills';
import { getAllVouchers, getVoucherPriceWp } from '../../data/vouchers';
import { sanitizeCardTiersConfig } from '../../engine/cardTiers';
import {
  computeSupplyPrice,
  sanitizePriceOverrides,
} from '../../engine/itemPrice';
import { sanitizeMedalsConfig } from '../../engine/medals';
import { sanitizeCrateShopConfig } from '../../engine/shop';
import {
  getClassName,
  getSkillCategoryLabel,
  getSkillName,
  useI18n,
} from '../../i18n';
import type { AdminConfig } from '../../types/game';
import { CatalogIcon } from '../CatalogIcon';
import { SkillIcon } from '../SkillIcon';
import { getSupplyName } from '../SupplyLoadoutBar';

export interface PriceTableAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
}

type PriceTableTab = 'supplies' | 'skillCards' | 'other';

function formatRange(min: number, max: number, locale: string, unit: string): string {
  const minStr = Math.round(min).toLocaleString(locale);
  const maxStr = Math.round(max).toLocaleString(locale);
  return min === max ? `${minStr} ${unit}` : `${minStr} – ${maxStr} ${unit}`;
}

export function PriceTableAdminBlock({
  adminConfig,
  adminUpdateConfig,
}: PriceTableAdminBlockProps) {
  const { lang, t } = useI18n();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const [activeTab, setActiveTab] = useState<PriceTableTab>('supplies');
  const [search, setSearch] = useState('');
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const overrides = useMemo(
    () => sanitizePriceOverrides(adminConfig.priceOverrides),
    [adminConfig.priceOverrides]
  );

  const adminWithoutOverrides = useMemo<AdminConfig>(
    () => ({
      ...adminConfig,
      priceOverrides: {},
    }),
    [adminConfig]
  );

  const updateSingleOverride = (itemId: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    const next = { ...overrides };
    if (trimmed === '') {
      delete next[itemId];
      adminUpdateConfig({ priceOverrides: next });
      return;
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return;
    const intVal = Math.round(num);
    if (intVal < 1) return;
    next[itemId] = intVal;
    adminUpdateConfig({ priceOverrides: next });
  };

  const resetSingleOverride = (itemId: string) => {
    if (!(itemId in overrides)) return;
    const next = { ...overrides };
    delete next[itemId];
    adminUpdateConfig({ priceOverrides: next });
  };

  const handleConfirmResetAll = () => {
    adminUpdateConfig({ priceOverrides: {} });
    setConfirmResetAll(false);
  };

  const query = search.trim().toLowerCase();
  const sellPct = Math.round(SHOP_CONFIG.sellPriceRatio * 100);

  const supplyRows = useMemo(() => {
    return SUPPLY_TEMPLATES.map((tpl) => {
      const name = getSupplyName(tpl.id, t);
      const tierLabel = `T${tpl.tier}`;
      const defaultPrice = computeSupplyPrice(tpl, adminWithoutOverrides);
      const finalPrice = computeSupplyPrice(tpl, adminConfig);
      const override = overrides[tpl.id];
      return {
        tpl,
        name,
        tierLabel,
        defaultPrice,
        finalPrice,
        override,
        iconRow: getCatalogRow(tpl.iconId, adminConfig.iconCatalogMods) ?? null,
      };
    }).filter((row) => {
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.tpl.id.toLowerCase().includes(query) ||
        row.tierLabel.toLowerCase().includes(query)
      );
    });
  }, [adminConfig, adminWithoutOverrides, overrides, query, t]);

  const skillCardRows = useMemo(() => {
    return getOpeningCardsList(adminConfig)
      .map((card) => {
        const skill = getSkillById(card.skillId, adminConfig);
        if (!skill) return null;
        const name = getSkillName(lang, skill.id);
        const classLabel = getClassName(lang, card.classId);
        const tierLabel = getSkillCategoryLabel(lang, card.category);
        const defaultPrice = getSkillCardPrice(card, adminWithoutOverrides);
        const finalPrice = getSkillCardPrice(card, adminConfig);
        const override = overrides[card.id];
        return {
          card,
          skill,
          name,
          classLabel,
          tierLabel,
          defaultPrice,
          finalPrice,
          override,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => {
        if (!query) return true;
        return (
          row.name.toLowerCase().includes(query) ||
          row.card.id.toLowerCase().includes(query) ||
          row.classLabel.toLowerCase().includes(query) ||
          row.tierLabel.toLowerCase().includes(query)
        );
      });
  }, [adminConfig, adminWithoutOverrides, lang, overrides, query]);

  const otherRows = useMemo(() => {
    const buffPrices = BUFF_CARD_LIST.map((def) =>
      getBuffCardWpPrice(def.kind, def.tier, adminConfig)
    );
    const buffMin = Math.min(...buffPrices);
    const buffMax = Math.max(...buffPrices);

    const voucherPrices = getAllVouchers(adminConfig).map((v) =>
      getVoucherPriceWp(v, adminConfig)
    );
    const voucherMin = voucherPrices.length > 0 ? Math.min(...voucherPrices) : 0;
    const voucherMax = voucherPrices.length > 0 ? Math.max(...voucherPrices) : 0;

    const crateCfg = sanitizeCrateShopConfig(adminConfig.crateShop);
    const cardTiers = sanitizeCardTiersConfig(adminConfig.cardTiers);
    const expMin = Math.min(...cardTiers.exp.values);
    const expMax = Math.max(...cardTiers.exp.values);
    const crCardMin = Math.min(...cardTiers.credit.values);
    const crCardMax = Math.max(...cardTiers.credit.values);

    const medals = sanitizeMedalsConfig(adminConfig.medals);
    const medalWpMin = Math.min(...medals.wp);
    const medalWpMax = Math.max(...medals.wp);
    const medalCrMin = medalWpMin * medals.blackMarketCreditPerWp;
    const medalCrMax = medalWpMax * medals.blackMarketCreditPerWp;

    return [
      {
        key: 'buffCards',
        label: t('admin.priceTable.other.buffCards'),
        range: formatRange(buffMin, buffMax, locale, 'WP'),
        sectionName: t('admin.buffCards.title'),
      },
      {
        key: 'vouchers',
        label: t('admin.priceTable.other.vouchers'),
        range: formatRange(voucherMin, voucherMax, locale, 'WP'),
        sectionName: t('admin.voucher.sectionTitle'),
      },
      {
        key: 'crates',
        label: t('admin.priceTable.other.crates'),
        range: `${crateCfg.wp.price.toLocaleString(locale)} WP · ${crateCfg.credit.price.toLocaleString(locale)} CR`,
        sectionName: t('admin.battleSection.crateShop.title'),
      },
      {
        key: 'expCreditCards',
        label: t('admin.priceTable.other.expCreditCards'),
        range: `${formatRange(expMin, expMax, locale, 'EXP')} · ${formatRange(crCardMin, crCardMax, locale, 'CR')}`,
        sectionName: t('admin.cardTiersMedals.title'),
      },
      {
        key: 'medals',
        label: t('admin.priceTable.other.medals'),
        range: `${formatRange(medalWpMin, medalWpMax, locale, 'WP')} (${formatRange(medalCrMin, medalCrMax, locale, 'CR')})`,
        sectionName: t('admin.cardTiersMedals.title'),
      },
    ];
  }, [adminConfig, locale, t]);

  const overrideCount = Object.keys(overrides).length;

  return (
    <div data-testid="admin-price-table-block" className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 min-w-0">
          <Tag className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
          <span>
            {t('admin.priceTable.overrideCount', { count: overrideCount })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!confirmResetAll ? (
            <button
              type="button"
              data-testid="admin-price-table-reset-all"
              disabled={overrideCount === 0}
              onClick={() => setConfirmResetAll(true)}
              className="h-8 px-2.5 rounded border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold text-rose-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>{t('admin.priceTable.resetAll')}</span>
            </button>
          ) : (
            <div
              data-testid="admin-price-table-reset-all-confirm-box"
              className="flex flex-wrap items-center gap-1.5 rounded border border-rose-500/50 bg-rose-950/50 px-2 py-1"
            >
              <span className="text-[11px] text-rose-200">
                {t('admin.priceTable.resetAllConfirm')}
              </span>
              <button
                type="button"
                data-testid="admin-price-table-reset-all-confirm"
                onClick={handleConfirmResetAll}
                className="h-7 px-2 rounded bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white cursor-pointer"
              >
                {t('common.confirm')}
              </button>
              <button
                type="button"
                data-testid="admin-price-table-reset-all-cancel"
                onClick={() => setConfirmResetAll(false)}
                className="h-7 px-2 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
        {(
          [
            ['supplies', t('admin.priceTable.tab.supplies')],
            ['skillCards', t('admin.priceTable.tab.skillCards')],
            ['other', t('admin.priceTable.tab.other')],
          ] as const
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            data-testid={`admin-price-table-tab-${tabKey}`}
            onClick={() => setActiveTab(tabKey)}
            className={`h-8 px-3 rounded border text-xs font-semibold cursor-pointer ${
              activeTab === tabKey
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab !== 'other' && (
        <label className="relative block">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            data-testid="admin-price-table-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.priceTable.searchPlaceholder')}
            className="w-full h-9 pl-8 pr-3 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100 placeholder:text-slate-500"
          />
        </label>
      )}

      {activeTab === 'supplies' && (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {supplyRows.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">
              {t('admin.priceTable.empty')}
            </div>
          ) : (
            supplyRows.map((row) => {
              const resale = Math.max(
                1,
                Math.round(row.finalPrice * SHOP_CONFIG.sellPriceRatio)
              );
              const hasOverride = row.override !== undefined;
              return (
                <div
                  key={row.tpl.id}
                  data-testid={`admin-price-table-row-${row.tpl.id}`}
                  className="rounded border border-slate-800 bg-slate-950/50 p-2.5 space-y-1.5 min-w-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded border border-slate-700/80 bg-[#080B14] flex items-center justify-center shrink-0">
                        <CatalogIcon
                          row={row.iconRow}
                          size="xs"
                          showBadges={false}
                          showArrowBadge={false}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {row.name}
                        </div>
                        <div className="text-[11px] font-mono-nums text-slate-400">
                          {row.tierLabel} · CR ·{' '}
                          {t('admin.priceTable.defaultLabel')}:{' '}
                          {row.defaultPrice.toLocaleString(locale)} CR
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <span>{t('admin.priceTable.overrideInput')}</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          data-testid={`admin-price-table-input-${row.tpl.id}`}
                          value={hasOverride ? String(row.override) : ''}
                          placeholder={t('admin.priceTable.defaultPlaceholder')}
                          onChange={(e) =>
                            updateSingleOverride(row.tpl.id, e.target.value)
                          }
                          className="w-24 h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                        />
                      </label>
                      <span
                        data-testid={`admin-price-table-final-${row.tpl.id}`}
                        className={`text-xs font-mono-nums font-bold ${
                          hasOverride ? 'text-amber-300' : 'text-slate-200'
                        }`}
                      >
                        {t('admin.priceTable.finalLabel')}:{' '}
                        {row.finalPrice.toLocaleString(locale)} CR
                      </span>
                      <button
                        type="button"
                        data-testid={`admin-price-table-reset-${row.tpl.id}`}
                        disabled={!hasOverride}
                        onClick={() => resetSingleOverride(row.tpl.id)}
                        className="h-8 px-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] text-slate-300 cursor-pointer"
                      >
                        {t('admin.priceTable.resetRow')}
                      </button>
                    </div>
                  </div>
                  <div
                    data-testid={`admin-price-table-live-${row.tpl.id}`}
                    className="text-[11px] font-mono-nums text-emerald-300/90"
                  >
                    {t('admin.priceTable.liveResaleEx', {
                      pct: sellPct,
                      amount: resale.toLocaleString(locale),
                      unit: 'CR',
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'skillCards' && (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {skillCardRows.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">
              {t('admin.priceTable.empty')}
            </div>
          ) : (
            skillCardRows.map((row) => {
              const resale = Math.max(
                1,
                Math.round(row.finalPrice * SHOP_CONFIG.sellPriceRatio)
              );
              const hasOverride = row.override !== undefined;
              return (
                <div
                  key={row.card.id}
                  data-testid={`admin-price-table-row-${row.card.id}`}
                  className="rounded border border-slate-800 bg-slate-950/50 p-2.5 space-y-1.5 min-w-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded border border-purple-500/40 bg-purple-500/10 flex items-center justify-center text-purple-300 shrink-0">
                        <SkillIcon icon={row.skill.icon} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {row.name}
                        </div>
                        <div className="text-[11px] font-mono-nums text-slate-400">
                          {row.classLabel} · {row.tierLabel} · WP ·{' '}
                          {t('admin.priceTable.defaultLabel')}:{' '}
                          {row.defaultPrice.toLocaleString(locale)} WP
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <span>{t('admin.priceTable.overrideInput')}</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          data-testid={`admin-price-table-input-${row.card.id}`}
                          value={hasOverride ? String(row.override) : ''}
                          placeholder={t('admin.priceTable.defaultPlaceholder')}
                          onChange={(e) =>
                            updateSingleOverride(row.card.id, e.target.value)
                          }
                          className="w-24 h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                        />
                      </label>
                      <span
                        data-testid={`admin-price-table-final-${row.card.id}`}
                        className={`text-xs font-mono-nums font-bold ${
                          hasOverride ? 'text-amber-300' : 'text-purple-200'
                        }`}
                      >
                        {t('admin.priceTable.finalLabel')}:{' '}
                        {row.finalPrice.toLocaleString(locale)} WP
                      </span>
                      <button
                        type="button"
                        data-testid={`admin-price-table-reset-${row.card.id}`}
                        disabled={!hasOverride}
                        onClick={() => resetSingleOverride(row.card.id)}
                        className="h-8 px-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] text-slate-300 cursor-pointer"
                      >
                        {t('admin.priceTable.resetRow')}
                      </button>
                    </div>
                  </div>
                  <div
                    data-testid={`admin-price-table-live-${row.card.id}`}
                    className="text-[11px] font-mono-nums text-emerald-300/90"
                  >
                    {t('admin.priceTable.liveResaleEx', {
                      pct: sellPct,
                      amount: resale.toLocaleString(locale),
                      unit: 'WP',
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'other' && (
        <div
          data-testid="admin-price-table-other-list"
          className="divide-y divide-slate-800/80 rounded border border-slate-800 bg-slate-950/50"
        >
          {otherRows.map((row) => (
            <div
              key={row.key}
              data-testid={`admin-price-table-other-${row.key}`}
              className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div>
                <div className="font-semibold text-slate-100">{row.label}</div>
                <div className="text-[11px] text-slate-400">
                  {t('admin.priceTable.editedInSection', {
                    section: row.sectionName,
                  })}
                </div>
              </div>
              <div className="font-mono-nums font-semibold text-amber-200">
                {row.range}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
