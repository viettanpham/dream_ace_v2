import { RotateCcw, Wrench } from 'lucide-react';
import {
  cloneBattlePenaltyConfig,
  DEFAULT_BATTLE_PENALTY_CONFIG,
  sanitizeBattlePenaltyConfig,
} from '../../data/balance';
import { useI18n } from '../../i18n';
import type {
  AdminConfig,
  BattlePenaltyConfig,
  RepairFeeTierConfig,
} from '../../types/game';

interface BattlePenaltyAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
}

function fmtLocale(n: number, lang: 'vi' | 'en'): string {
  return Math.round(n).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
}

type TopPenaltyKey =
  | 'retreatFreeLevel'
  | 'retreatExpPenaltyPct'
  | 'retreatShortfallExtraCreditPct'
  | 'retreatWpPenaltyPct';

type RepairTierFieldKey = keyof RepairFeeTierConfig;

export function BattlePenaltyAdminBlock({
  adminConfig,
  adminUpdateConfig,
}: BattlePenaltyAdminBlockProps) {
  const { lang, t } = useI18n();
  const cfg = sanitizeBattlePenaltyConfig(adminConfig.battlePenalty);

  const updatePenalty = (next: BattlePenaltyConfig) => {
    adminUpdateConfig({
      battlePenalty: sanitizeBattlePenaltyConfig(next),
    });
  };

  // Live example: Level 25, 9% EXP, getExpForNextLevel = 100.000
  const sampleLevel = 25;
  const sampleExpPct = 9;
  const sampleNeed = 100000;
  const sampleTriggersPenalty = sampleLevel > cfg.retreatFreeLevel;
  const sampleEnoughExp = sampleExpPct >= cfg.retreatExpPenaltyPct;
  const sampleCreditPen = !sampleTriggersPenalty
    ? 0
    : sampleEnoughExp
      ? Math.round(sampleNeed * (cfg.retreatExpPenaltyPct / 100))
      : Math.round(
          sampleNeed *
            ((cfg.retreatExpPenaltyPct + cfg.retreatShortfallExtraCreditPct) /
              100)
        );
  const sampleWpPen = !sampleTriggersPenalty
    ? 0
    : Math.round(sampleCreditPen * (cfg.retreatWpPenaltyPct / 100));

  // Defeat live example: Lv30, max EXP 100.000
  const defeatSampleLevel = 30;
  const defeatSampleNeed = 100000;
  const defeatSampleFree =
    defeatSampleLevel <= cfg.defeatFreeLevel || cfg.defeatExpPenaltyFactor <= 0;
  const defeatSampleExpPen = defeatSampleFree
    ? 0
    : Math.round(
        defeatSampleNeed *
          (cfg.retreatExpPenaltyPct / 100) *
          cfg.defeatExpPenaltyFactor
      );
  const defeatFactorOnlyExpPen =
    cfg.defeatExpPenaltyFactor <= 0
      ? 0
      : Math.round(
          defeatSampleNeed *
            (cfg.retreatExpPenaltyPct / 100) *
            cfg.defeatExpPenaltyFactor
        );

  const topFields: Array<{
    key: TopPenaltyKey;
    titleKey:
      | 'admin.battlePenalty.retreatFreeLevel.title'
      | 'admin.battlePenalty.retreatExpPenaltyPct.title'
      | 'admin.battlePenalty.retreatShortfallExtraCreditPct.title'
      | 'admin.battlePenalty.retreatWpPenaltyPct.title';
    descKey:
      | 'admin.battlePenalty.retreatFreeLevel.desc'
      | 'admin.battlePenalty.retreatExpPenaltyPct.desc'
      | 'admin.battlePenalty.retreatShortfallExtraCreditPct.desc'
      | 'admin.battlePenalty.retreatWpPenaltyPct.desc';
  }> = [
    {
      key: 'retreatFreeLevel',
      titleKey: 'admin.battlePenalty.retreatFreeLevel.title',
      descKey: 'admin.battlePenalty.retreatFreeLevel.desc',
    },
    {
      key: 'retreatExpPenaltyPct',
      titleKey: 'admin.battlePenalty.retreatExpPenaltyPct.title',
      descKey: 'admin.battlePenalty.retreatExpPenaltyPct.desc',
    },
    {
      key: 'retreatShortfallExtraCreditPct',
      titleKey: 'admin.battlePenalty.retreatShortfallExtraCreditPct.title',
      descKey: 'admin.battlePenalty.retreatShortfallExtraCreditPct.desc',
    },
    {
      key: 'retreatWpPenaltyPct',
      titleKey: 'admin.battlePenalty.retreatWpPenaltyPct.title',
      descKey: 'admin.battlePenalty.retreatWpPenaltyPct.desc',
    },
  ];

  const tierFields: Array<{
    key: RepairTierFieldKey;
    titleKey:
      | 'admin.battlePenalty.repair.subsidyLevel.title'
      | 'admin.battlePenalty.repair.subsidyMax.title'
      | 'admin.battlePenalty.repair.hpCoef.title'
      | 'admin.battlePenalty.repair.shieldCoef.title';
    descKey:
      | 'admin.battlePenalty.repair.subsidyLevel.desc'
      | 'admin.battlePenalty.repair.subsidyMax.desc'
      | 'admin.battlePenalty.repair.hpCoef.desc'
      | 'admin.battlePenalty.repair.shieldCoef.desc';
    exKey:
      | 'admin.battlePenalty.repair.subsidyLevel.ex'
      | 'admin.battlePenalty.repair.subsidyMax.ex'
      | 'admin.battlePenalty.repair.hpCoef.ex'
      | 'admin.battlePenalty.repair.shieldCoef.ex';
  }> = [
    {
      key: 'subsidyLevel',
      titleKey: 'admin.battlePenalty.repair.subsidyLevel.title',
      descKey: 'admin.battlePenalty.repair.subsidyLevel.desc',
      exKey: 'admin.battlePenalty.repair.subsidyLevel.ex',
    },
    {
      key: 'subsidyMax',
      titleKey: 'admin.battlePenalty.repair.subsidyMax.title',
      descKey: 'admin.battlePenalty.repair.subsidyMax.desc',
      exKey: 'admin.battlePenalty.repair.subsidyMax.ex',
    },
    {
      key: 'hpCoef',
      titleKey: 'admin.battlePenalty.repair.hpCoef.title',
      descKey: 'admin.battlePenalty.repair.hpCoef.desc',
      exKey: 'admin.battlePenalty.repair.hpCoef.ex',
    },
    {
      key: 'shieldCoef',
      titleKey: 'admin.battlePenalty.repair.shieldCoef.title',
      descKey: 'admin.battlePenalty.repair.shieldCoef.desc',
      exKey: 'admin.battlePenalty.repair.shieldCoef.ex',
    },
  ];

  const renderTierFieldExample = (
    tier: RepairFeeTierConfig,
    field: (typeof tierFields)[number]
  ) => {
    const sampleHpFee = Math.round(12000 * tier.hpCoef);
    const sampleShFee = Math.round(4000 * tier.shieldCoef);
    const fee = sampleHpFee + sampleShFee;
    const subsidy = Math.min(fee, Math.max(0, Math.round(tier.subsidyMax)));
    const payable = Math.max(0, fee - subsidy);
    return t(field.exKey, {
      fee: fmtLocale(fee, lang),
      subsidy: fmtLocale(subsidy, lang),
      payable: fmtLocale(payable, lang),
      lv: tier.subsidyLevel,
      aboveLv: tier.subsidyLevel + 1,
      coef: Number(tier[field.key].toFixed(2)),
      hpFee: fmtLocale(sampleHpFee, lang),
      shFee: fmtLocale(sampleShFee, lang),
    });
  };

  return (
    <div
      data-testid="admin-battle-penalty-block"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Wrench className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
          <span>{t('admin.battlePenalty.headerNote')}</span>
        </div>
        <button
          type="button"
          data-testid="admin-battle-penalty-reset"
          onClick={() =>
            adminUpdateConfig({
              battlePenalty: cloneBattlePenaltyConfig(
                DEFAULT_BATTLE_PENALTY_CONFIG
              ),
            })
          }
          className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 inline-flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          {t('admin.battlePenalty.reset')}
        </button>
      </div>

      {/* Live example */}
      <div
        data-testid="admin-battle-penalty-examples"
        className="px-3 py-2 rounded border border-rose-500/30 bg-rose-950/20 text-[11px] font-mono-nums text-rose-200 space-y-1"
      >
        <p data-testid="admin-battle-penalty-example-retreat">
          {t('admin.battlePenalty.exRetreat', {
            level: sampleLevel,
            expPct: sampleExpPct,
            need: fmtLocale(sampleNeed, lang),
            creditPen: fmtLocale(sampleCreditPen, lang),
            wpPen: fmtLocale(sampleWpPen, lang),
          })}
        </p>
        <p data-testid="admin-battle-penalty-example-defeat">
          {t('admin.battlePenalty.exDefeat', {
            level: defeatSampleLevel,
            need: fmtLocale(defeatSampleNeed, lang),
            factor: Number(cfg.defeatExpPenaltyFactor.toFixed(2)),
            expPen: fmtLocale(defeatSampleExpPen, lang),
          })}
        </p>
        <p data-testid="admin-battle-penalty-example-repair">
          {t('admin.battlePenalty.exRepairSummary', {
            defeatLv: cfg.repairDefeat.subsidyLevel,
            defeatMax: fmtLocale(cfg.repairDefeat.subsidyMax, lang),
            retreatLv: cfg.repairRetreat.subsidyLevel,
            retreatMax: fmtLocale(cfg.repairRetreat.subsidyMax, lang),
          })}
        </p>
      </div>

      {/* Retreat penalty fields */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-rose-300">
          {t('admin.battlePenalty.retreatGroupTitle')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topFields.map((field) => (
            <label
              key={field.key}
              className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block"
            >
              <span className="text-xs font-semibold text-slate-200 block">
                {t(field.titleKey)}
              </span>
              <span className="text-[11px] text-slate-400 leading-snug block">
                {t(field.descKey)}
              </span>
              <input
                type="number"
                min={0}
                data-testid={`admin-battle-penalty-${field.key}`}
                value={cfg[field.key]}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  if (!Number.isFinite(raw)) return;
                  updatePenalty({ ...cfg, [field.key]: raw });
                }}
                className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Defeat EXP penalty fields */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-rose-300">
          {t('admin.battlePenalty.defeatGroupTitle')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.battlePenalty.defeatFreeLevel.title')}
            </span>
            <span className="text-[11px] text-slate-400 leading-snug block">
              {t('admin.battlePenalty.defeatFreeLevel.desc')}
            </span>
            <input
              type="number"
              min={0}
              data-testid="admin-battle-penalty-defeatFreeLevel"
              value={cfg.defeatFreeLevel}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updatePenalty({ ...cfg, defeatFreeLevel: raw });
              }}
              className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span
              data-testid="admin-battle-penalty-example-defeatFreeLevel"
              className="text-[11px] font-mono-nums text-rose-200/90 leading-snug block pt-0.5"
            >
              {t('admin.battlePenalty.defeatFreeLevel.ex', {
                freeLv: cfg.defeatFreeLevel,
                aboveLv: cfg.defeatFreeLevel + 1,
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.battlePenalty.defeatExpPenaltyFactor.title')}
            </span>
            <span className="text-[11px] text-slate-400 leading-snug block">
              {t('admin.battlePenalty.defeatExpPenaltyFactor.desc')}
            </span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              data-testid="admin-battle-penalty-defeatExpPenaltyFactor"
              value={cfg.defeatExpPenaltyFactor}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updatePenalty({ ...cfg, defeatExpPenaltyFactor: raw });
              }}
              className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span
              data-testid="admin-battle-penalty-example-defeatExpPenaltyFactor"
              className="text-[11px] font-mono-nums text-rose-200/90 leading-snug block pt-0.5"
            >
              {t('admin.battlePenalty.defeatExpPenaltyFactor.ex', {
                level: defeatSampleLevel,
                need: fmtLocale(defeatSampleNeed, lang),
                factor: Number(cfg.defeatExpPenaltyFactor.toFixed(2)),
                expPen: fmtLocale(defeatFactorOnlyExpPen, lang),
              })}
            </span>
          </label>
        </div>
      </div>

      {/* Repair fee tiers: Defeat vs Retreat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(
          [
            ['repairDefeat', 'admin.battlePenalty.repairDefeatGroupTitle'],
            ['repairRetreat', 'admin.battlePenalty.repairRetreatGroupTitle'],
          ] as const
        ).map(([tierKey, groupTitleKey]) => {
          const tier = cfg[tierKey];
          return (
            <div
              key={tierKey}
              className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-2.5"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-300">
                  {t(groupTitleKey)}
                </div>
                <p
                  data-testid={`admin-battle-penalty-${tierKey}-desc`}
                  className="text-[11px] text-slate-400 leading-snug"
                >
                  {t('admin.battlePenalty.repairTierDesc', {
                    subsidyMax: fmtLocale(tier.subsidyMax, lang),
                  })}
                </p>
              </div>
              {tierFields.map((field) => (
                <label key={field.key} className="space-y-1 block">
                  <span className="text-xs font-semibold text-slate-200 block">
                    {t(field.titleKey)}
                  </span>
                  <span className="text-[11px] text-slate-400 leading-snug block">
                    {t(field.descKey)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    data-testid={`admin-battle-penalty-${tierKey}-${field.key}`}
                    value={tier[field.key]}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (!Number.isFinite(raw)) return;
                      updatePenalty({
                        ...cfg,
                        [tierKey]: {
                          ...tier,
                          [field.key]: raw,
                        },
                      });
                    }}
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                  />
                  <span
                    data-testid={`admin-battle-penalty-${tierKey}-${field.key}-example`}
                    className="text-[11px] font-mono-nums text-amber-200/90 leading-snug block pt-0.5"
                  >
                    {renderTierFieldExample(tier, field)}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
