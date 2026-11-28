import { RefreshCw, RotateCcw } from 'lucide-react';
import {
  cloneCardShopConfig,
  DEFAULT_CARD_SHOP_CONFIG,
  getCardAppearRate,
  getExpectedCardShopStats,
  resolveCardShopConfig,
  sanitizeCardShopConfig,
} from '../../engine/cardShop';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { CardShopKindConfig } from '../../types/game';

interface CardShopAdminBlockProps {
  onFlash?: (msg: string) => void;
}

const KINDS: readonly ('active' | 'passive')[] = ['active', 'passive'];

export function CardShopAdminBlock({ onFlash }: CardShopAdminBlockProps) {
  const { t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const cardShopStockWp = useGameStore((s) => s.cardShopStockWp);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);
  const adminRerollCardShopNow = useGameStore((s) => s.adminRerollCardShopNow);

  const cfg = resolveCardShopConfig(adminConfig);
  const stats = getExpectedCardShopStats(adminConfig, pilot.ownedOpeningCards);
  const currentInStockCount = cfg.enabled
    ? (cardShopStockWp ?? []).filter(
        (id) => !pilot.ownedOpeningCards.includes(id)
      ).length
    : stats.eligibleCards;

  const updateKindField = (
    kind: 'active' | 'passive',
    field: keyof CardShopKindConfig,
    rawVal: string
  ) => {
    const parsed = Number(rawVal);
    if (!Number.isFinite(parsed)) return;
    const next = cloneCardShopConfig(cfg);
    next[kind][field] = parsed;
    adminUpdateConfig({
      cardShop: sanitizeCardShopConfig(next),
    });
  };

  const handleRerollNow = () => {
    const next = adminRerollCardShopNow();
    onFlash?.(t('admin.cardShop.rerollDone', { count: next.length }));
  };

  const handleReset = () => {
    adminUpdateConfig({
      cardShop: cloneCardShopConfig(DEFAULT_CARD_SHOP_CONFIG),
    });
    onFlash?.(t('admin.cardShop.resetDone'));
  };

  return (
    <div
      data-testid="admin-card-shop-block"
      className="space-y-3 text-xs text-slate-200"
    >
      <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#080C14]/80 px-3 py-2 cursor-pointer">
        <input
          type="checkbox"
          data-testid="admin-card-shop-enabled"
          checked={cfg.enabled}
          onChange={(e) =>
            adminUpdateConfig({
              cardShop: sanitizeCardShopConfig({
                ...cfg,
                enabled: e.target.checked,
              }),
            })
          }
          className="rounded border-slate-700 bg-slate-900 accent-purple-500"
        />
        <span className="font-semibold text-slate-100">
          {t('admin.cardShop.enabled')}
        </span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {KINDS.map((kind) => {
          const kindCfg = cfg[kind];
          const baseRate = getCardAppearRate({ unlockLevel: 1 }, kindCfg);
          const lv30Steps = Math.floor(30 / kindCfg.stepLevels);
          const lv30Rate = getCardAppearRate({ unlockLevel: 30 }, kindCfg);
          const twoStepLv = kindCfg.stepLevels * 2;
          const twoStepRate = getCardAppearRate(
            { unlockLevel: twoStepLv },
            kindCfg
          );
          const lv100Rate = getCardAppearRate({ unlockLevel: 100 }, kindCfg);

          return (
            <div
              key={kind}
              data-testid={`admin-card-shop-kind-${kind}`}
              className="rounded-lg border border-slate-800 bg-[#080C14]/80 p-3 space-y-2.5"
            >
              <div className="text-xs font-bold text-purple-300">
                {kind === 'active'
                  ? t('admin.cardShop.activeTitle')
                  : t('admin.cardShop.passiveTitle')}
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  {t('admin.cardShop.baseRatePct')}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  data-testid={`admin-card-shop-${kind}-baseRatePct`}
                  value={kindCfg.baseRatePct}
                  onChange={(e) =>
                    updateKindField(kind, 'baseRatePct', e.target.value)
                  }
                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <p
                  data-testid={`admin-card-shop-${kind}-ex-base`}
                  className="text-[11px] font-mono-nums text-emerald-300"
                >
                  {t('admin.cardShop.exBase', { rate: baseRate })}
                </p>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  {t('admin.cardShop.stepPct')}
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  data-testid={`admin-card-shop-${kind}-stepPct`}
                  value={kindCfg.stepPct}
                  onChange={(e) =>
                    updateKindField(kind, 'stepPct', e.target.value)
                  }
                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <p
                  data-testid={`admin-card-shop-${kind}-ex-step`}
                  className="text-[11px] font-mono-nums text-emerald-300"
                >
                  {t('admin.cardShop.exStep', {
                    base: kindCfg.baseRatePct,
                    step: kindCfg.stepPct,
                    steps: lv30Steps,
                    rate: lv30Rate,
                  })}
                </p>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  {t('admin.cardShop.stepLevels')}
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  data-testid={`admin-card-shop-${kind}-stepLevels`}
                  value={kindCfg.stepLevels}
                  onChange={(e) =>
                    updateKindField(kind, 'stepLevels', e.target.value)
                  }
                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <p
                  data-testid={`admin-card-shop-${kind}-ex-stepLevels`}
                  className="text-[11px] font-mono-nums text-emerald-300"
                >
                  {t('admin.cardShop.exStepLevels', {
                    lv: twoStepLv,
                    rate: twoStepRate,
                  })}
                </p>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  {t('admin.cardShop.minRatePct')}
                </span>
                <input
                  type="number"
                  min={0}
                  max={kindCfg.baseRatePct}
                  step={0.5}
                  data-testid={`admin-card-shop-${kind}-minRatePct`}
                  value={kindCfg.minRatePct}
                  onChange={(e) =>
                    updateKindField(kind, 'minRatePct', e.target.value)
                  }
                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <p
                  data-testid={`admin-card-shop-${kind}-ex-min`}
                  className="text-[11px] font-mono-nums text-emerald-300"
                >
                  {t('admin.cardShop.exMin', {
                    rate: lv100Rate,
                    min: kindCfg.minRatePct,
                  })}
                </p>
              </label>
            </div>
          );
        })}
      </div>

      <div
        data-testid="admin-card-shop-expected"
        className="rounded border border-slate-800 bg-[#080C14]/70 px-2.5 py-1.5 text-[11px] font-mono-nums text-sky-300"
      >
        {t('admin.cardShop.expectedSummary', {
          expected: stats.expectedCards,
          current: currentInStockCount,
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          data-testid="admin-card-shop-reroll"
          onClick={handleRerollNow}
          className="h-8 px-3 rounded border border-purple-500/60 bg-purple-600/20 hover:bg-purple-600/35 text-purple-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('admin.cardShop.rerollBtn')}</span>
        </button>
        <button
          type="button"
          data-testid="admin-card-shop-reset"
          onClick={handleReset}
          className="h-8 px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('admin.cardShop.resetBtn')}</span>
        </button>
      </div>
    </div>
  );
}
