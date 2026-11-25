import { RotateCcw } from 'lucide-react';
import {
  cloneSupplyEconomyConfig,
  DEFAULT_SUPPLY_ECONOMY_CONFIG,
  MAX_SUPPLY_LIMIT_MULT,
  MAX_SUPPLY_MAX_USES_PER_BATTLE,
  MAX_SUPPLY_SP_PRICE_MULT,
  MIN_SUPPLY_LIMIT_MULT,
  MIN_SUPPLY_MAX_USES_PER_BATTLE,
  MIN_SUPPLY_SP_PRICE_MULT,
  sanitizeSupplyEconomyConfig,
  sanitizeSupplyLimitMult,
} from '../../engine/supplies';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { SupplyLimitMultConfig } from '../../types/game';

const LIMIT_MULT_FIELDS = [
  { key: 'assaultAttacker', labelKey: 'admin.supplyLimitAssaultAttacker' },
  { key: 'assaultDefender', labelKey: 'admin.supplyLimitAssaultDefender' },
  { key: 'defendDefender', labelKey: 'admin.supplyLimitDefendDefender' },
  { key: 'defendAttacker', labelKey: 'admin.supplyLimitDefendAttacker' },
  { key: 'bossEscort', labelKey: 'admin.supplyLimitBossEscort' },
  { key: 'bossPlayers', labelKey: 'admin.supplyLimitBossPlayers' },
] as const satisfies readonly { key: keyof SupplyLimitMultConfig; labelKey: string }[];

export function SupplyEconomyAdminBlock() {
  const { t } = useI18n();
  const supplyEconomy = useGameStore((s) => s.adminConfig.supplyEconomy);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const cfg = sanitizeSupplyEconomyConfig(supplyEconomy);
  const limitMult = sanitizeSupplyLimitMult(cfg.limitMult);

  const updateCfg = (patch: Partial<typeof cfg>) => {
    adminUpdateConfig({
      supplyEconomy: sanitizeSupplyEconomyConfig({
        ...cfg,
        ...patch,
      }),
    });
  };

  const updateLimitMult = (patch: Partial<SupplyLimitMultConfig>) => {
    updateCfg({
      limitMult: sanitizeSupplyLimitMult({
        ...limitMult,
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
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-semibold text-emerald-300">
            {t('admin.supplyEconomyTitle')}
          </div>
          <div className="text-[11px] text-slate-400">
            {t('admin.supplyEconomyHint')}
          </div>
        </div>
        <button
          type="button"
          data-testid="admin-supply-economy-reset"
          onClick={() =>
            adminUpdateConfig({
              supplyEconomy: cloneSupplyEconomyConfig(
                DEFAULT_SUPPLY_ECONOMY_CONFIG
              ),
            })
          }
          className="h-8 px-2.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          <span>{t('admin.supplyLimitMultReset')}</span>
        </button>
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
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) updateCfg({ maxUsesPerBattle: v });
            }}
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
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) updateCfg({ spPriceMult: v });
            }}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>
      </div>

      <div className="pt-1 space-y-2">
        <div className="text-[11px] font-semibold text-slate-300">
          {t('admin.supplyLimitMultTitle')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LIMIT_MULT_FIELDS.map(({ key, labelKey }) => (
            <label key={key} className="space-y-1 block min-w-0">
              <span className="text-[11px] text-slate-400 block truncate">
                {t(labelKey)}
              </span>
              <input
                type="number"
                data-testid={`admin-supply-limit-mult-${key}`}
                min={MIN_SUPPLY_LIMIT_MULT}
                max={MAX_SUPPLY_LIMIT_MULT}
                step={1}
                value={limitMult[key]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) updateLimitMult({ [key]: v });
                }}
                className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
