import {
  MAX_SUPPLY_MAX_USES_PER_BATTLE,
  MAX_SUPPLY_SP_PRICE_MULT,
  MIN_SUPPLY_MAX_USES_PER_BATTLE,
  MIN_SUPPLY_SP_PRICE_MULT,
  sanitizeSupplyEconomyConfig,
} from '../../engine/supplies';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';

export function SupplyEconomyAdminBlock() {
  const { t } = useI18n();
  const supplyEconomy = useGameStore((s) => s.adminConfig.supplyEconomy);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const cfg = sanitizeSupplyEconomyConfig(supplyEconomy);
  const updateCfg = (patch: Partial<typeof cfg>) => {
    adminUpdateConfig({
      supplyEconomy: sanitizeSupplyEconomyConfig({
        ...cfg,
        ...patch,
      }),
    });
  };

  return (
    <div
      data-testid="admin-supply-economy-section"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-emerald-300">
          {t('admin.supplyEconomyTitle')}
        </span>
        <span className="text-[11px] text-slate-400">
          {t('admin.supplyEconomyHint')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span className="text-[11px] text-slate-400 block">
            {t('admin.supplyEconomyMaxUses')}
          </span>
          <input
            type="number"
            data-testid="admin-supply-max-uses"
            min={MIN_SUPPLY_MAX_USES_PER_BATTLE}
            max={MAX_SUPPLY_MAX_USES_PER_BATTLE}
            step={1}
            value={cfg.maxUsesPerBattle}
            onChange={(e) =>
              updateCfg({ maxUsesPerBattle: Number(e.target.value) })
            }
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[11px] text-slate-400 block">
            {t('admin.supplyEconomySpPriceMult')}
          </span>
          <input
            type="number"
            data-testid="admin-supply-sp-price-mult"
            min={MIN_SUPPLY_SP_PRICE_MULT}
            max={MAX_SUPPLY_SP_PRICE_MULT}
            step={1}
            value={cfg.spPriceMult}
            onChange={(e) =>
              updateCfg({ spPriceMult: Number(e.target.value) })
            }
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>
      </div>
    </div>
  );
}
