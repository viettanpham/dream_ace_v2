import { Award, RotateCcw } from 'lucide-react';
import {
  cloneBattleRewardsConfig,
  DEFAULT_BATTLE_REWARDS_CONFIG,
  sanitizeBattleRewardsConfig,
} from '../../data/balance';
import { useI18n } from '../../i18n';
import type { AdminConfig, BattleRewardsConfig } from '../../types/game';

interface BattleRewardsAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
}

function fmtNum(n: number): string {
  return String(Number(n.toFixed(2)));
}

interface RewardFieldMeta {
  key: keyof BattleRewardsConfig;
  min: number;
  max: number;
  titleKey:
    | 'admin.battleRewards.supportMaxLevel.title'
    | 'admin.battleRewards.supportExpPerLevelPct.title'
    | 'admin.battleRewards.supportCreditWpPerLevelPct.title'
    | 'admin.battleRewards.defeatExpPct.title'
    | 'admin.battleRewards.defeatCreditPct.title'
    | 'admin.battleRewards.defeatWpPct.title'
    | 'admin.battleRewards.defeatMaxPctOfVictory.title'
    | 'admin.battleRewards.retreatRewardPct.title';
  descKey:
    | 'admin.battleRewards.supportMaxLevel.desc'
    | 'admin.battleRewards.supportExpPerLevelPct.desc'
    | 'admin.battleRewards.supportCreditWpPerLevelPct.desc'
    | 'admin.battleRewards.defeatExpPct.desc'
    | 'admin.battleRewards.defeatCreditPct.desc'
    | 'admin.battleRewards.defeatWpPct.desc'
    | 'admin.battleRewards.defeatMaxPctOfVictory.desc'
    | 'admin.battleRewards.retreatRewardPct.desc';
}

const BATTLE_REWARD_FIELDS: readonly RewardFieldMeta[] = [
  {
    key: 'supportMaxLevel',
    min: 0,
    max: 100,
    titleKey: 'admin.battleRewards.supportMaxLevel.title',
    descKey: 'admin.battleRewards.supportMaxLevel.desc',
  },
  {
    key: 'supportExpPerLevelPct',
    min: 0,
    max: 500,
    titleKey: 'admin.battleRewards.supportExpPerLevelPct.title',
    descKey: 'admin.battleRewards.supportExpPerLevelPct.desc',
  },
  {
    key: 'supportCreditWpPerLevelPct',
    min: 0,
    max: 500,
    titleKey: 'admin.battleRewards.supportCreditWpPerLevelPct.title',
    descKey: 'admin.battleRewards.supportCreditWpPerLevelPct.desc',
  },
  {
    key: 'defeatExpPct',
    min: 0,
    max: 100,
    titleKey: 'admin.battleRewards.defeatExpPct.title',
    descKey: 'admin.battleRewards.defeatExpPct.desc',
  },
  {
    key: 'defeatCreditPct',
    min: 0,
    max: 100,
    titleKey: 'admin.battleRewards.defeatCreditPct.title',
    descKey: 'admin.battleRewards.defeatCreditPct.desc',
  },
  {
    key: 'defeatWpPct',
    min: 0,
    max: 100,
    titleKey: 'admin.battleRewards.defeatWpPct.title',
    descKey: 'admin.battleRewards.defeatWpPct.desc',
  },
  {
    key: 'defeatMaxPctOfVictory',
    min: 0,
    max: 100,
    titleKey: 'admin.battleRewards.defeatMaxPctOfVictory.title',
    descKey: 'admin.battleRewards.defeatMaxPctOfVictory.desc',
  },
  {
    key: 'retreatRewardPct',
    min: 0,
    max: 100,
    titleKey: 'admin.battleRewards.retreatRewardPct.title',
    descKey: 'admin.battleRewards.retreatRewardPct.desc',
  },
];

export function BattleRewardsAdminBlock({
  adminConfig,
  adminUpdateConfig,
}: BattleRewardsAdminBlockProps) {
  const { t } = useI18n();
  const cfg = sanitizeBattleRewardsConfig(adminConfig.battleRewards);

  const lv1Steps = Math.max(0, cfg.supportMaxLevel + 1 - 1);
  const lv1ExpPct = 100 + lv1Steps * cfg.supportExpPerLevelPct;
  const lv1CreditWpPct = 100 + lv1Steps * cfg.supportCreditWpPerLevelPct;

  const updateField = (key: keyof BattleRewardsConfig, raw: number) => {
    adminUpdateConfig({
      battleRewards: sanitizeBattleRewardsConfig({
        ...cfg,
        [key]: raw,
      }),
    });
  };

  return (
    <div
      data-testid="admin-battle-rewards-block"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{t('admin.battleRewards.headerNote')}</span>
        </div>
        <button
          type="button"
          data-testid="admin-battle-rewards-reset"
          onClick={() =>
            adminUpdateConfig({
              battleRewards: cloneBattleRewardsConfig(
                DEFAULT_BATTLE_REWARDS_CONFIG
              ),
            })
          }
          className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 inline-flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          {t('admin.battleRewards.reset')}
        </button>
      </div>

      {/* Live examples */}
      <div
        data-testid="admin-battle-rewards-examples"
        className="px-3 py-2 rounded border border-emerald-500/30 bg-emerald-950/20 text-[11px] font-mono-nums text-emerald-200 space-y-1"
      >
        <p data-testid="admin-battle-rewards-example-win">
          {t('admin.battleRewards.exWinLv1', {
            expPct: fmtNum(lv1ExpPct),
            creditWpPct: fmtNum(lv1CreditWpPct),
          })}
        </p>
        <p data-testid="admin-battle-rewards-example-defeat">
          {t('admin.battleRewards.exDefeatCap', {
            capPct: fmtNum(cfg.defeatMaxPctOfVictory),
          })}
        </p>
      </div>

      {/* 8 fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BATTLE_REWARD_FIELDS.map((field) => (
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
              min={field.min}
              max={field.max}
              data-testid={`admin-battle-rewards-${field.key}`}
              value={cfg[field.key]}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateField(field.key, raw);
              }}
              className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
