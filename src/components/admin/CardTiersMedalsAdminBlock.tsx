import { RotateCcw } from 'lucide-react';
import { getMapNodes } from '../../data/maps';
import {
  cloneCardTiersConfig,
  DEFAULT_CARD_TIERS_CONFIG,
  sanitizeCardTiersConfig,
} from '../../engine/cardTiers';
import {
  cloneMedalsConfig,
  DEFAULT_MEDALS_CONFIG,
  sanitizeMedalsConfig,
} from '../../engine/medals';
import {
  cloneMonthlyEconomyConfig,
  computeMonthlySalary,
  DEFAULT_MONTHLY_ECONOMY_CONFIG,
  estimateMonthlyEconomyAtPct,
  sanitizeMonthlyEconomyConfig,
} from '../../engine/monthlyEconomy';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type {
  CardTiersConfig,
  MedalsConfig,
  MonthlyEconomyConfig,
} from '../../types/game';

interface CardTiersMedalsAdminBlockProps {
  onFlash?: (msg: string) => void;
}

const TIERS = [1, 2, 3, 4, 5] as const;

export function CardTiersMedalsAdminBlock({
  onFlash,
}: CardTiersMedalsAdminBlockProps) {
  const { t } = useI18n();
  const adminConfig = useGameStore((s) => s.adminConfig);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const cardCfg = sanitizeCardTiersConfig(adminConfig.cardTiers);
  const medalCfg = sanitizeMedalsConfig(adminConfig.medals);
  const ecoCfg = sanitizeMonthlyEconomyConfig(adminConfig.monthlyEconomy);
  const showMonthReport = adminConfig.showMonthReport ?? true;

  const commitCardTiers = (next: CardTiersConfig) => {
    adminUpdateConfig({ cardTiers: sanitizeCardTiersConfig(next) });
  };

  const commitMedals = (next: MedalsConfig) => {
    adminUpdateConfig({ medals: sanitizeMedalsConfig(next) });
  };

  const commitEconomy = (next: MonthlyEconomyConfig) => {
    adminUpdateConfig({ monthlyEconomy: sanitizeMonthlyEconomyConfig(next) });
  };

  const handleCardExpValueChange = (idx: number, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneCardTiersConfig(cardCfg);
    next.exp.values[idx] = parsed;
    commitCardTiers(next);
  };

  const handleCardExpMaxLvlChange = (idx: number, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneCardTiersConfig(cardCfg);
    next.exp.maxLevels[idx] = parsed;
    commitCardTiers(next);
  };

  const handleCardCreditValueChange = (idx: number, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneCardTiersConfig(cardCfg);
    next.credit.values[idx] = parsed;
    commitCardTiers(next);
  };

  const handleWastePctChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneCardTiersConfig(cardCfg);
    next.previewWastePct = parsed;
    commitCardTiers(next);
  };

  const handleMedalWpChange = (idx: number, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneMedalsConfig(medalCfg);
    next.wp[idx] = parsed;
    commitMedals(next);
  };

  const handleMedalBmWeightChange = (idx: number, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneMedalsConfig(medalCfg);
    next.blackMarketWeights[idx] = parsed;
    commitMedals(next);
  };

  const handleMedalScalarChange = (
    field: 'blackMarketRatePct' | 'blackMarketCreditPerWp',
    raw: string
  ) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneMedalsConfig(medalCfg);
    next[field] = parsed;
    commitMedals(next);
  };

  const handleEconomyFieldChange = (
    field: keyof MonthlyEconomyConfig,
    raw: string
  ) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = cloneMonthlyEconomyConfig(ecoCfg);
    next[field] = parsed;
    commitEconomy(next);
  };

  const handleReset = () => {
    adminUpdateConfig({
      cardTiers: cloneCardTiersConfig(DEFAULT_CARD_TIERS_CONFIG),
      medals: cloneMedalsConfig(DEFAULT_MEDALS_CONFIG),
      monthlyEconomy: cloneMonthlyEconomyConfig(DEFAULT_MONTHLY_ECONOMY_CONFIG),
      showMonthReport: true,
    });
    onFlash?.(t('admin.cardTiersMedals.resetDone'));
  };

  const totalBmWeights = medalCfg.blackMarketWeights.reduce(
    (sum, w) => sum + Math.max(0, w),
    0
  );
  const t1BmPrice = Math.max(
    1,
    Math.round(medalCfg.wp[0] * medalCfg.blackMarketCreditPerWp)
  );

  const salaryEx620 = computeMonthlySalary({
    capturedSubBases: 6,
    totalSubBases: 20,
    hasCapital: true,
    economyCfg: ecoCfg,
  });
  const salaryExText = t('admin.cardTiersMedals.salary620Ex', {
    base: ecoCfg.salaryBaseWp.toLocaleString(),
    sub: (ecoCfg.salaryPerBaseWp * 6).toLocaleString(),
    coef: salaryEx620.coef,
    total: salaryEx620.salaryWp.toLocaleString(),
  });

  const activeMapSubBases = Math.max(
    1,
    getMapNodes().filter((n) => n.initialFaction !== 'allied').length
  );
  const est20 = estimateMonthlyEconomyAtPct({
    capturedPct: 20,
    totalSubBases: activeMapSubBases,
    economyCfg: ecoCfg,
    medalsCfg: medalCfg,
  });
  const est60 = estimateMonthlyEconomyAtPct({
    capturedPct: 60,
    totalSubBases: activeMapSubBases,
    economyCfg: ecoCfg,
    medalsCfg: medalCfg,
  });
  const medalMonthlyExText = t('admin.cardTiersMedals.medalMonthlyEx', {
    m20: est20.expectedMedals,
    m60: est60.expectedMedals,
  });

  return (
    <div
      data-testid="admin-card-tiers-medals-block"
      className="space-y-3 text-xs text-slate-200 min-w-0"
    >
      {/* Card Tiers Table + Preview Waste + Show Month Report */}
      <div className="rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5 space-y-2.5">
        <div className="text-xs font-bold text-amber-300">
          {t('admin.cardTiersMedals.cardTiersTitle')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {TIERS.map((tier, idx) => {
            const expVal = cardCfg.exp.values[idx];
            const expMaxLvl = cardCfg.exp.maxLevels[idx];
            const crVal = cardCfg.credit.values[idx];
            return (
              <div
                key={tier}
                className="rounded border border-slate-800 bg-slate-950/70 p-2 space-y-1.5"
              >
                <div className="text-[11px] font-bold text-slate-200">
                  {t('admin.cardTiersMedals.tierCol')} T{tier}
                </div>
                <label className="block space-y-0.5">
                  <span className="text-[10px] text-sky-300 block">
                    {t('admin.cardTiersMedals.expValCol')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    data-testid={`admin-cardtier-exp-val-${tier}`}
                    value={expVal}
                    onChange={(e) =>
                      handleCardExpValueChange(idx, e.target.value)
                    }
                    className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-[11px] font-mono-nums"
                  />
                  <span className="text-[10px] text-emerald-300/90 block leading-tight">
                    {t('admin.cardTiersMedals.expTierEx', {
                      tier,
                      exp: expVal.toLocaleString(),
                      lvl: expMaxLvl,
                    })}
                  </span>
                </label>

                <label className="block space-y-0.5">
                  <span className="text-[10px] text-sky-300 block">
                    {t('admin.cardTiersMedals.expMaxLvlCol')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    data-testid={`admin-cardtier-exp-lvl-${tier}`}
                    value={expMaxLvl}
                    onChange={(e) =>
                      handleCardExpMaxLvlChange(idx, e.target.value)
                    }
                    className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-[11px] font-mono-nums"
                  />
                  <span className="text-[10px] text-emerald-300/90 block leading-tight">
                    {t('admin.cardTiersMedals.expTierEx', {
                      tier,
                      exp: expVal.toLocaleString(),
                      lvl: expMaxLvl,
                    })}
                  </span>
                </label>

                <label className="block space-y-0.5">
                  <span className="text-[10px] text-amber-300 block">
                    {t('admin.cardTiersMedals.creditValCol')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10000000}
                    data-testid={`admin-cardtier-credit-val-${tier}`}
                    value={crVal}
                    onChange={(e) =>
                      handleCardCreditValueChange(idx, e.target.value)
                    }
                    className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-[11px] font-mono-nums"
                  />
                  <span className="text-[10px] text-amber-300/90 block leading-tight">
                    {t('admin.cardTiersMedals.creditTierEx', {
                      tier,
                      cr: crVal.toLocaleString(),
                    })}
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-amber-300 block">
              {t('admin.cardTiersMedals.previewWastePct')}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              data-testid="admin-cardtier-waste-pct"
              value={cardCfg.previewWastePct}
              onChange={(e) => handleWastePctChange(e.target.value)}
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[11px] text-emerald-300 block leading-snug">
              {t('admin.cardTiersMedals.previewWastePctEx', {
                pct: cardCfg.previewWastePct,
              })}
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded border border-slate-800 bg-slate-950/70 p-2 cursor-pointer">
            <input
              type="checkbox"
              data-testid="admin-show-month-report"
              checked={showMonthReport}
              onChange={(e) =>
                adminUpdateConfig({ showMonthReport: e.target.checked })
              }
              className="mt-0.5 rounded border-slate-600 bg-slate-900 text-sky-500"
            />
            <span className="space-y-0.5">
              <span className="text-[11px] font-semibold text-sky-300 block">
                {t('admin.cardTiersMedals.showMonthReport')}
              </span>
              <span className="text-[11px] text-emerald-300 block leading-snug">
                {t('admin.cardTiersMedals.showMonthReportEx', {
                  state: showMonthReport
                    ? t('admin.cardTiersMedals.stateOn')
                    : t('admin.cardTiersMedals.stateOff'),
                })}
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Medals & Black Market */}
      <div className="rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5 space-y-2.5">
        <div className="text-xs font-bold text-purple-300">
          {t('admin.cardTiersMedals.medalsTitle')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {TIERS.map((tier, idx) => {
            const wpVal = medalCfg.wp[idx];
            const weightVal = medalCfg.blackMarketWeights[idx];
            const sharePct =
              totalBmWeights > 0
                ? Math.round((Math.max(0, weightVal) / totalBmWeights) * 100)
                : 0;
            return (
              <div
                key={tier}
                className="rounded border border-slate-800 bg-slate-950/70 p-2 space-y-1.5"
              >
                <div className="text-[11px] font-bold text-slate-200">
                  T{tier}
                </div>
                <label className="block space-y-0.5">
                  <span className="text-[10px] text-purple-300 block">
                    {t('admin.cardTiersMedals.medalWpCol')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10000000}
                    data-testid={`admin-medal-wp-${tier}`}
                    value={wpVal}
                    onChange={(e) => handleMedalWpChange(idx, e.target.value)}
                    className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-[11px] font-mono-nums"
                  />
                  <span className="text-[10px] text-purple-300/90 block leading-tight">
                    {t('admin.cardTiersMedals.medalWpEx', {
                      tier,
                      wp: wpVal.toLocaleString(),
                    })}
                  </span>
                </label>

                <label className="block space-y-0.5">
                  <span className="text-[10px] text-rose-300 block">
                    {t('admin.cardTiersMedals.bmWeightCol')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    data-testid={`admin-medal-bm-weight-${tier}`}
                    value={weightVal}
                    onChange={(e) =>
                      handleMedalBmWeightChange(idx, e.target.value)
                    }
                    className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-[11px] font-mono-nums"
                  />
                  <span className="text-[10px] text-rose-300/90 block leading-tight">
                    {t('admin.cardTiersMedals.bmWeightEx', {
                      tier,
                      pct: sharePct,
                    })}
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-rose-300 block">
              {t('admin.cardTiersMedals.bmRatePct')}
            </span>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              data-testid="admin-medal-bm-rate"
              value={medalCfg.blackMarketRatePct}
              onChange={(e) =>
                handleMedalScalarChange('blackMarketRatePct', e.target.value)
              }
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[11px] text-emerald-300 block leading-snug">
              {t('admin.cardTiersMedals.bmRatePctEx', {
                pct: medalCfg.blackMarketRatePct,
              })}
            </span>
          </label>

          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-rose-300 block">
              {t('admin.cardTiersMedals.bmCreditPerWp')}
            </span>
            <input
              type="number"
              min={1}
              max={1000000}
              data-testid="admin-medal-bm-price"
              value={medalCfg.blackMarketCreditPerWp}
              onChange={(e) =>
                handleMedalScalarChange(
                  'blackMarketCreditPerWp',
                  e.target.value
                )
              }
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[11px] text-emerald-300 block leading-snug">
              {t('admin.cardTiersMedals.bmCreditPerWpEx', {
                price: t1BmPrice.toLocaleString(),
              })}
            </span>
          </label>
        </div>
      </div>

      {/* Monthly Salary */}
      <div className="rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5 space-y-2.5">
        <div className="text-xs font-bold text-sky-300">
          {t('admin.cardTiersMedals.salaryTitle')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {(
            [
              {
                key: 'salaryBaseWp',
                label: t('admin.cardTiersMedals.salaryBaseWp'),
                min: 0,
                max: 1000000,
                step: 1,
              },
              {
                key: 'salaryPerBaseWp',
                label: t('admin.cardTiersMedals.salaryPerBaseWp'),
                min: 0,
                max: 100000,
                step: 1,
              },
              {
                key: 'coefBase',
                label: t('admin.cardTiersMedals.coefBase'),
                min: 0,
                max: 20,
                step: 0.1,
              },
              {
                key: 'coefStepPct',
                label: t('admin.cardTiersMedals.coefStepPct'),
                min: 0,
                max: 500,
                step: 1,
              },
              {
                key: 'coefEveryPct',
                label: t('admin.cardTiersMedals.coefEveryPct'),
                min: 1,
                max: 100,
                step: 1,
              },
            ] as const
          ).map((f) => (
            <label
              key={f.key}
              className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2"
            >
              <span className="text-[11px] font-semibold text-sky-300 block">
                {f.label}
              </span>
              <input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                data-testid={`admin-eco-${f.key}`}
                value={ecoCfg[f.key]}
                onChange={(e) =>
                  handleEconomyFieldChange(f.key, e.target.value)
                }
                className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
              />
              <span className="text-[10px] text-emerald-300/90 block leading-snug">
                {salaryExText}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Monthly Medal Drops & Tier Unlocks */}
      <div className="rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5 space-y-2.5">
        <div className="text-xs font-bold text-emerald-300">
          {t('admin.cardTiersMedals.medalDropsTitle')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-emerald-300 block">
              {t('admin.cardTiersMedals.homeMedalMin')}
            </span>
            <input
              type="number"
              min={0}
              max={50}
              data-testid="admin-eco-homeMedalMin"
              value={ecoCfg.homeMedalMin}
              onChange={(e) =>
                handleEconomyFieldChange('homeMedalMin', e.target.value)
              }
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[10px] text-emerald-300/90 block leading-snug">
              {t('admin.cardTiersMedals.homeMedalEx', {
                min: ecoCfg.homeMedalMin,
                max: ecoCfg.homeMedalMax,
              })}
            </span>
          </label>

          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-emerald-300 block">
              {t('admin.cardTiersMedals.homeMedalMax')}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              data-testid="admin-eco-homeMedalMax"
              value={ecoCfg.homeMedalMax}
              onChange={(e) =>
                handleEconomyFieldChange('homeMedalMax', e.target.value)
              }
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[10px] text-emerald-300/90 block leading-snug">
              {t('admin.cardTiersMedals.homeMedalEx', {
                min: ecoCfg.homeMedalMin,
                max: ecoCfg.homeMedalMax,
              })}
            </span>
          </label>

          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-emerald-300 block">
              {t('admin.cardTiersMedals.subBaseMedalMin')}
            </span>
            <input
              type="number"
              min={0}
              max={50}
              data-testid="admin-eco-subBaseMedalMin"
              value={ecoCfg.subBaseMedalMin}
              onChange={(e) =>
                handleEconomyFieldChange('subBaseMedalMin', e.target.value)
              }
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[10px] text-emerald-300/90 block leading-snug">
              {medalMonthlyExText}
            </span>
          </label>

          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-emerald-300 block">
              {t('admin.cardTiersMedals.subBaseMedalBaseMax')}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              data-testid="admin-eco-subBaseMedalBaseMax"
              value={ecoCfg.subBaseMedalBaseMax}
              onChange={(e) =>
                handleEconomyFieldChange('subBaseMedalBaseMax', e.target.value)
              }
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[10px] text-emerald-300/90 block leading-snug">
              {medalMonthlyExText}
            </span>
          </label>

          <label className="block space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
            <span className="text-[11px] font-semibold text-emerald-300 block">
              {t('admin.cardTiersMedals.subBaseMedalStep')}
            </span>
            <input
              type="number"
              min={0}
              max={20}
              data-testid="admin-eco-subBaseMedalStepPerDecile"
              value={ecoCfg.subBaseMedalStepPerDecile}
              onChange={(e) =>
                handleEconomyFieldChange(
                  'subBaseMedalStepPerDecile',
                  e.target.value
                )
              }
              className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="text-[10px] text-emerald-300/90 block leading-snug">
              {medalMonthlyExText}
            </span>
          </label>
        </div>

        {/* Tier 3/4/5 Unlock Thresholds */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {(
            [
              { tier: 3, pctKey: 'tier3Pct', countKey: 'tier3Count' },
              { tier: 4, pctKey: 'tier4Pct', countKey: 'tier4Count' },
              { tier: 5, pctKey: 'tier5Pct', countKey: 'tier5Count' },
            ] as const
          ).map(({ tier, pctKey, countKey }) => (
            <div
              key={tier}
              className="rounded border border-slate-800 bg-slate-950/70 p-2 space-y-1"
            >
              <div className="text-[11px] font-semibold text-purple-300">
                {t('admin.cardTiersMedals.tierUnlockLabel', { tier })}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  data-testid={`admin-eco-${pctKey}`}
                  value={ecoCfg[pctKey]}
                  onChange={(e) =>
                    handleEconomyFieldChange(pctKey, e.target.value)
                  }
                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  data-testid={`admin-eco-${countKey}`}
                  value={ecoCfg[countKey]}
                  onChange={(e) =>
                    handleEconomyFieldChange(countKey, e.target.value)
                  }
                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
              </div>
              <span className="text-[10px] text-emerald-300/90 block leading-snug">
                {t('admin.cardTiersMedals.tierUnlockEx', {
                  tier,
                  pct: ecoCfg[pctKey],
                  count: ecoCfg[countKey],
                })}
              </span>
            </div>
          ))}
        </div>

        {/* Live Monthly WP Estimate Line (20% & 60%) + Reset Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-800/80">
          <div
            data-testid="admin-monthly-wp-estimate"
            className="text-xs font-mono-nums font-semibold text-amber-300"
          >
            {t('admin.cardTiersMedals.wpEstimateLine', {
              wp20: est20.expectedTotalWp.toLocaleString(),
              s20: est20.salaryWp.toLocaleString(),
              medWp20: est20.expectedMedalWp.toLocaleString(),
              wp60: est60.expectedTotalWp.toLocaleString(),
              s60: est60.salaryWp.toLocaleString(),
              medWp60: est60.expectedMedalWp.toLocaleString(),
            })}
          </div>

          <button
            type="button"
            data-testid="admin-card-tiers-medals-reset"
            onClick={handleReset}
            className="h-9 px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('admin.cardTiersMedals.resetBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
