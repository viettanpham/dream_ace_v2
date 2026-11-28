import { useState } from 'react';
import { Gift, RotateCcw } from 'lucide-react';
import {
  BUFF_CARD_KINDS,
  BUFF_CARD_LIST,
  cloneBuffCardsConfig,
  DEFAULT_BUFF_CARDS_CONFIG,
  getBuffCardId,
  getBuffCardPercent,
  getBuffCardRatePct,
  getBuffCardTierIndex,
  getBuffCardTiersRange,
  getBuffCardWpPrice,
  parseBuffCardId,
  sanitizeBuffCardsConfig,
} from '../../data/buffCards';
import {
  getBuffCardKindLabel,
  getBuffCardName,
  useI18n,
} from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { BuffCardKind, BuffCardsConfig } from '../../types/game';

interface BuffCardsAdminBlockProps {
  onFlash?: (msg: string) => void;
}

export function BuffCardsAdminBlock({ onFlash }: BuffCardsAdminBlockProps) {
  const { lang, t } = useI18n();
  const adminConfig = useGameStore((s) => s.adminConfig);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);
  const adminGiveBuffCard = useGameStore((s) => s.adminGiveBuffCard);

  const cfg = sanitizeBuffCardsConfig(adminConfig.buffCards);

  const [giftCardId, setGiftCardId] = useState<string>(
    BUFF_CARD_LIST[0]?.id ?? 'bcard_exp_t0'
  );
  const [giftQty, setGiftQty] = useState<number>(1);

  const commit = (next: BuffCardsConfig) => {
    adminUpdateConfig({
      buffCards: sanitizeBuffCardsConfig(next),
    });
  };

  const handleScalarChange = (
    field: 'battlesPerCard' | 'maxStackBattles' | 'priceMult',
    rawVal: string
  ) => {
    const parsed = Number(rawVal);
    if (!Number.isFinite(parsed)) return;
    const next = cloneBuffCardsConfig(cfg);
    next[field] = parsed;
    commit(next);
  };

  const handleShopChange = (
    field: 'baseRatePct' | 'decayPctPerTier' | 'minRatePct',
    rawVal: string
  ) => {
    const parsed = Number(rawVal);
    if (!Number.isFinite(parsed)) return;
    const next = cloneBuffCardsConfig(cfg);
    next.shop[field] = parsed;
    commit(next);
  };

  const handleCellChange = (
    kind: BuffCardKind,
    tier: number,
    table: 'tiers' | 'wpPrice',
    rawVal: string
  ) => {
    const parsed = Number(rawVal);
    if (!Number.isFinite(parsed)) return;
    const next = cloneBuffCardsConfig(cfg);
    const idx = getBuffCardTierIndex(kind, tier);
    if (idx < 0 || idx >= next[table][kind].length) return;
    next[table][kind][idx] = parsed;
    commit(next);
  };

  const atkT3Pct = getBuffCardPercent('attack', 3, cfg);
  const atkT3BaseWp =
    cfg.wpPrice.attack[getBuffCardTierIndex('attack', 3)] ?? 300;
  const atkT3FinalWp = getBuffCardWpPrice('attack', 3, cfg);
  const maxStackCards = Math.floor(
    cfg.maxStackBattles / Math.max(1, cfg.battlesPerCard)
  );
  const shopRateExText = t('admin.buffCards.shopRateEx', {
    r1: getBuffCardRatePct(1, cfg.shop),
    r5: getBuffCardRatePct(5, cfg.shop),
    min: cfg.shop.minRatePct,
  });

  const handleReset = () => {
    commit(cloneBuffCardsConfig(DEFAULT_BUFF_CARDS_CONFIG));
    onFlash?.(t('admin.buffCards.resetDone'));
  };

  const handleGift = () => {
    const res = adminGiveBuffCard(giftCardId, giftQty);
    if (!res.ok) return;
    const parsed = parseBuffCardId(giftCardId);
    const cardName = parsed
      ? getBuffCardName(lang, parsed.kind, parsed.tier)
      : giftCardId;
    onFlash?.(
      t('admin.buffCards.giftDone', {
        qty: res.qty ?? giftQty,
        name: cardName,
      })
    );
  };

  return (
    <div
      data-testid="admin-buff-cards-block"
      className="space-y-3 text-xs text-slate-200 min-w-0"
    >
      {/* Top 3 numeric controls + live examples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-amber-300 block">
            {t('admin.buffCards.battlesPerCard')}
          </span>
          <input
            type="number"
            min={1}
            max={20}
            data-testid="admin-buff-battles-per-card"
            value={cfg.battlesPerCard}
            onChange={(e) => handleScalarChange('battlesPerCard', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-buff-battles-per-card-ex"
            className="text-[11px] text-emerald-300 block leading-snug"
          >
            {t('admin.buffCards.battlesPerCardEx', {
              name: getBuffCardName(lang, 'attack', 3),
              pct: atkT3Pct,
              battles: cfg.battlesPerCard,
            })}
          </span>
        </label>

        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-sky-300 block">
            {t('admin.buffCards.maxStackBattles')}
          </span>
          <input
            type="number"
            min={1}
            max={200}
            data-testid="admin-buff-max-stack-battles"
            value={cfg.maxStackBattles}
            onChange={(e) => handleScalarChange('maxStackBattles', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-buff-max-stack-ex"
            className="text-[11px] text-emerald-300 block leading-snug"
          >
            {t('admin.buffCards.maxStackBattlesEx', {
              max: cfg.maxStackBattles,
              cards: maxStackCards,
            })}
          </span>
        </label>

        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-purple-300 block">
            {t('admin.buffCards.priceMult')}
          </span>
          <input
            type="number"
            min={0.1}
            max={20}
            step={0.1}
            data-testid="admin-buff-price-mult"
            value={cfg.priceMult}
            onChange={(e) => handleScalarChange('priceMult', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-buff-price-mult-ex"
            className="text-[11px] text-emerald-300 block leading-snug"
          >
            {t('admin.buffCards.priceMultEx', {
              base: atkT3BaseWp,
              price: atkT3FinalWp,
            })}
          </span>
        </label>
      </div>

      {/* Shop rate fields — each numeric input gets its own live example */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-emerald-300 block">
            {t('admin.buffCards.shopBaseRate')}
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            data-testid="admin-buff-shop-base"
            value={cfg.shop.baseRatePct}
            onChange={(e) => handleShopChange('baseRatePct', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span className="text-[11px] text-emerald-300 block leading-snug">
            {shopRateExText}
          </span>
        </label>

        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-emerald-300 block">
            {t('admin.buffCards.shopDecay')}
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            data-testid="admin-buff-shop-decay"
            value={cfg.shop.decayPctPerTier}
            onChange={(e) => handleShopChange('decayPctPerTier', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span className="text-[11px] text-emerald-300 block leading-snug">
            {shopRateExText}
          </span>
        </label>

        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-emerald-300 block">
            {t('admin.buffCards.shopMinRate')}
          </span>
          <input
            type="number"
            min={0}
            max={cfg.shop.baseRatePct}
            step={0.1}
            data-testid="admin-buff-shop-min"
            value={cfg.shop.minRatePct}
            onChange={(e) => handleShopChange('minRatePct', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-buff-shop-rate-ex"
            className="text-[11px] text-emerald-300 block leading-snug"
          >
            {shopRateExText}
          </span>
        </label>
      </div>

      {/* Table kind x tier of percent and WP price */}
      <div className="rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5 space-y-2.5">
        <div className="text-xs font-bold text-slate-200">
          {t('admin.buffCards.tableTitle')}
        </div>

        <div className="space-y-2.5">
          {BUFF_CARD_KINDS.map((kind) => {
            const tiersRange = getBuffCardTiersRange(kind);
            const kindLabel = getBuffCardKindLabel(lang, kind);
            const maxPct = kind === 'dodge' ? 45 : 500;
            return (
              <div
                key={kind}
                data-testid={`admin-buff-kind-${kind}`}
                className="rounded border border-slate-800/90 bg-slate-950/60 p-2 space-y-1.5"
              >
                <div className="text-xs font-bold text-amber-300">
                  {kindLabel}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {tiersRange.map((tier) => {
                    const idx = getBuffCardTierIndex(kind, tier);
                    const pctVal = cfg.tiers[kind][idx] ?? 0;
                    const wpVal = cfg.wpPrice[kind][idx] ?? 100;
                    const finalWp = getBuffCardWpPrice(kind, tier, cfg);
                    const liveEx = t('admin.buffCards.tableExample', {
                      tier,
                      kind: kindLabel,
                      pct: pctVal,
                      wp: finalWp,
                    });
                    return (
                      <div
                        key={getBuffCardId(kind, tier)}
                        className="rounded border border-slate-800 bg-[#080C14] p-1.5 space-y-1"
                      >
                        <div className="text-[11px] font-bold text-slate-300">
                          T{tier}
                        </div>
                        <label className="block space-y-0.5">
                          <span className="text-[10px] text-slate-400 block">
                            {t('admin.buffCards.tablePercent')}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={maxPct}
                            data-testid={`admin-buff-pct-${kind}-${tier}`}
                            value={pctVal}
                            onChange={(e) =>
                              handleCellChange(kind, tier, 'tiers', e.target.value)
                            }
                            className="w-full h-7 px-1.5 rounded border border-slate-700 bg-slate-900 text-[11px] font-mono-nums"
                          />
                          <span className="text-[10px] text-emerald-300/90 block leading-tight">
                            +{pctVal}% ({kindLabel})
                          </span>
                        </label>
                        <label className="block space-y-0.5">
                          <span className="text-[10px] text-purple-300 block">
                            {t('admin.buffCards.tableWp')}
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={999999}
                            data-testid={`admin-buff-wp-${kind}-${tier}`}
                            value={wpVal}
                            onChange={(e) =>
                              handleCellChange(
                                kind,
                                tier,
                                'wpPrice',
                                e.target.value
                              )
                            }
                            className="w-full h-7 px-1.5 rounded border border-slate-700 bg-slate-900 text-[11px] font-mono-nums"
                          />
                          <span className="text-[10px] text-purple-300/90 block leading-tight">
                            {liveEx}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tester Gift Row + Reset */}
      <div className="flex flex-wrap items-end justify-between gap-2.5 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
        <div className="flex flex-wrap items-end gap-2 min-w-0 flex-1">
          <label className="space-y-1 min-w-[200px] flex-1 max-w-xs">
            <span className="text-[11px] font-semibold text-emerald-300 block">
              {t('admin.buffCards.giftTitle')}
            </span>
            <select
              data-testid="admin-buff-gift-select"
              value={giftCardId}
              onChange={(e) => setGiftCardId(e.target.value)}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
            >
              {BUFF_CARD_LIST.map((def) => (
                <option key={def.id} value={def.id}>
                  {getBuffCardName(lang, def.kind, def.tier)} (+
                  {getBuffCardPercent(def.kind, def.tier, cfg)}%)
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 w-24">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.starterEvent.qtyLabel')}
            </span>
            <input
              type="number"
              min={1}
              max={999}
              data-testid="admin-buff-gift-qty"
              value={giftQty}
              onChange={(e) =>
                setGiftQty(
                  Math.max(1, Math.min(999, Math.round(Number(e.target.value) || 1)))
                )
              }
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[10px] text-emerald-300/90 block leading-tight">
              ×{giftQty}
            </span>
          </label>

          <button
            type="button"
            data-testid="admin-buff-gift-btn"
            onClick={handleGift}
            className="h-9 px-3 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>{t('admin.buffCards.giftBtn')}</span>
          </button>
        </div>

        <button
          type="button"
          data-testid="admin-buff-cards-reset"
          onClick={handleReset}
          className="h-9 px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('admin.buffCards.resetBtn')}</span>
        </button>
      </div>
    </div>
  );
}
