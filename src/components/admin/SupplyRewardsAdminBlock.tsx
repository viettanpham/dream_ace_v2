import { Gift, RotateCcw } from 'lucide-react';
import {
  cloneSupplyRewardsConfig,
  DEFAULT_SUPPLY_REWARDS_CONFIG,
  getEligibleSupplyTemplates,
  getPilotMaxGearLevel,
  sanitizeSupplyRewardsConfig,
  SUPPLY_REWARDS_MAX_CHANCE,
  SUPPLY_REWARDS_MAX_QTY,
  SUPPLY_REWARDS_MAX_TIER,
  SUPPLY_REWARDS_MAX_TYPES,
  SUPPLY_REWARDS_MIN_CHANCE,
  SUPPLY_REWARDS_MIN_QTY,
  SUPPLY_REWARDS_MIN_TIER,
  SUPPLY_REWARDS_MIN_TYPES,
  type SupplyRewardSource,
} from '../../engine/supplyRewards';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { AdminConfig, SupplyRewardsConfig } from '../../types/game';

interface SupplyRewardsAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
}

function fmtNum(n: number): string {
  return String(Number(n.toFixed(1)));
}

export function SupplyRewardsAdminBlock({
  adminConfig,
  adminUpdateConfig,
}: SupplyRewardsAdminBlockProps) {
  const { t } = useI18n();
  const maxGearLevel = useGameStore((s) => getPilotMaxGearLevel(s.pilot));
  const cfg = sanitizeSupplyRewardsConfig(adminConfig.supplyRewards);
  const eligibleCount = getEligibleSupplyTemplates(
    maxGearLevel,
    cfg.minTier,
    cfg.maxTier
  ).length;

  const commit = (next: SupplyRewardsConfig) => {
    adminUpdateConfig({
      supplyRewards: sanitizeSupplyRewardsConfig(next),
    });
  };

  const updateTier = (key: 'minTier' | 'maxTier', raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    commit({
      ...cfg,
      [key]: n,
    });
  };

  const updateSource = (
    source: SupplyRewardSource,
    field: 'chancePct' | 'qtyMin' | 'qtyMax',
    raw: string
  ) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    commit({
      ...cfg,
      [source]: {
        ...cfg[source],
        [field]: n,
      },
    });
  };

  const updateCrate = (
    field: 'typesMin' | 'typesMax' | 'qtyMin' | 'qtyMax',
    raw: string
  ) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    commit({
      ...cfg,
      crate: {
        ...cfg.crate,
        [field]: n,
      },
    });
  };

  const sources: Array<{
    key: SupplyRewardSource;
    label: string;
  }> = [
    { key: 'victory', label: t('admin.supplyRewards.srcVictory') },
    { key: 'mission', label: t('admin.supplyRewards.srcMission') },
    { key: 'event', label: t('admin.supplyRewards.srcEvent') },
  ];

  const tierExample = t('admin.supplyRewards.tierEx', {
    count: eligibleCount,
    min: cfg.minTier,
    max: cfg.maxTier,
  });

  return (
    <div
      data-testid="admin-supply-rewards-block"
      className="space-y-3 min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 min-w-0">
          <Gift className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('admin.supplyRewards.tiersGroup')}</span>
        </div>
        <button
          type="button"
          data-testid="admin-supply-rewards-reset"
          onClick={() =>
            adminUpdateConfig({
              supplyRewards: cloneSupplyRewardsConfig(
                DEFAULT_SUPPLY_REWARDS_CONFIG
              ),
            })
          }
          className="h-8 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          <span>{t('admin.supplyRewards.reset')}</span>
        </button>
      </div>

      {/* Tier Bounds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
        <label className="rounded border border-slate-800 bg-slate-950/60 p-2.5 space-y-1 block min-w-0">
          <span className="text-[11px] font-semibold text-slate-200 block">
            {t('admin.supplyRewards.minTier')}
          </span>
          <input
            type="number"
            data-testid="admin-supply-rewards-min-tier"
            min={SUPPLY_REWARDS_MIN_TIER}
            max={SUPPLY_REWARDS_MAX_TIER}
            value={cfg.minTier}
            onChange={(e) => updateTier('minTier', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-supply-rewards-ex-min-tier"
            className="block text-[11px] text-emerald-300/90 font-mono-nums leading-snug break-words"
          >
            {tierExample}
          </span>
        </label>

        <label className="rounded border border-slate-800 bg-slate-950/60 p-2.5 space-y-1 block min-w-0">
          <span className="text-[11px] font-semibold text-slate-200 block">
            {t('admin.supplyRewards.maxTier')}
          </span>
          <input
            type="number"
            data-testid="admin-supply-rewards-max-tier"
            min={SUPPLY_REWARDS_MIN_TIER}
            max={SUPPLY_REWARDS_MAX_TIER}
            value={cfg.maxTier}
            onChange={(e) => updateTier('maxTier', e.target.value)}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-supply-rewards-ex-max-tier"
            className="block text-[11px] text-emerald-300/90 font-mono-nums leading-snug break-words"
          >
            {tierExample}
          </span>
        </label>
      </div>

      {/* Victory / Mission / Event sources */}
      {sources.map(({ key, label }) => {
        const src = cfg[key];
        const chanceEx = t('admin.supplyRewards.exChance', {
          source: label,
          pct: src.chancePct,
          qMin: src.qtyMin,
          qMax: src.qtyMax,
          hits: src.chancePct,
        });
        const qtyEx = t('admin.supplyRewards.exQty', {
          qMin: src.qtyMin,
          qMax: src.qtyMax,
          avg: fmtNum((src.qtyMin + src.qtyMax) / 2),
        });
        return (
          <div
            key={key}
            className="rounded border border-slate-800 bg-slate-950/40 p-2.5 space-y-2 min-w-0"
          >
            <div className="text-xs font-bold text-sky-300">{label}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
              <label className="space-y-1 block min-w-0">
                <span className="text-[11px] text-slate-300 block">
                  {t('admin.supplyRewards.chancePct')}
                </span>
                <input
                  type="number"
                  data-testid={`admin-supply-rewards-${key}-chance`}
                  min={SUPPLY_REWARDS_MIN_CHANCE}
                  max={SUPPLY_REWARDS_MAX_CHANCE}
                  value={src.chancePct}
                  onChange={(e) => updateSource(key, 'chancePct', e.target.value)}
                  className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <span
                  data-testid={`admin-supply-rewards-${key}-chance-ex`}
                  className="block text-[11px] text-emerald-300/90 font-mono-nums leading-snug break-words"
                >
                  {chanceEx}
                </span>
              </label>

              <label className="space-y-1 block min-w-0">
                <span className="text-[11px] text-slate-300 block">
                  {t('admin.supplyRewards.qtyMin')}
                </span>
                <input
                  type="number"
                  data-testid={`admin-supply-rewards-${key}-qty-min`}
                  min={SUPPLY_REWARDS_MIN_QTY}
                  max={SUPPLY_REWARDS_MAX_QTY}
                  value={src.qtyMin}
                  onChange={(e) => updateSource(key, 'qtyMin', e.target.value)}
                  className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <span className="block text-[11px] text-emerald-300/90 font-mono-nums leading-snug break-words">
                  {qtyEx}
                </span>
              </label>

              <label className="space-y-1 block min-w-0">
                <span className="text-[11px] text-slate-300 block">
                  {t('admin.supplyRewards.qtyMax')}
                </span>
                <input
                  type="number"
                  data-testid={`admin-supply-rewards-${key}-qty-max`}
                  min={SUPPLY_REWARDS_MIN_QTY}
                  max={SUPPLY_REWARDS_MAX_QTY}
                  value={src.qtyMax}
                  onChange={(e) => updateSource(key, 'qtyMax', e.target.value)}
                  className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                />
                <span className="block text-[11px] text-emerald-300/90 font-mono-nums leading-snug break-words">
                  {qtyEx}
                </span>
              </label>
            </div>
          </div>
        );
      })}

      {/* Crate contents */}
      <div className="rounded border border-amber-500/30 bg-amber-950/15 p-2.5 space-y-2 min-w-0">
        <div className="text-xs font-bold text-amber-300">
          {t('admin.supplyRewards.crateGroup')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
          <label className="space-y-1 block min-w-0">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.supplyRewards.crateTypesMin')}
            </span>
            <input
              type="number"
              data-testid="admin-supply-rewards-crate-types-min"
              min={SUPPLY_REWARDS_MIN_TYPES}
              max={SUPPLY_REWARDS_MAX_TYPES}
              value={cfg.crate.typesMin}
              onChange={(e) => updateCrate('typesMin', e.target.value)}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="block text-[11px] text-amber-200/90 font-mono-nums leading-snug break-words">
              {t('admin.supplyRewards.exCrateTypes', {
                tMin: cfg.crate.typesMin,
                tMax: cfg.crate.typesMax,
                qMin: cfg.crate.qtyMin,
                qMax: cfg.crate.qtyMax,
              })}
            </span>
          </label>

          <label className="space-y-1 block min-w-0">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.supplyRewards.crateTypesMax')}
            </span>
            <input
              type="number"
              data-testid="admin-supply-rewards-crate-types-max"
              min={SUPPLY_REWARDS_MIN_TYPES}
              max={SUPPLY_REWARDS_MAX_TYPES}
              value={cfg.crate.typesMax}
              onChange={(e) => updateCrate('typesMax', e.target.value)}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="block text-[11px] text-amber-200/90 font-mono-nums leading-snug break-words">
              {t('admin.supplyRewards.exCrateTypes', {
                tMin: cfg.crate.typesMin,
                tMax: cfg.crate.typesMax,
                qMin: cfg.crate.qtyMin,
                qMax: cfg.crate.qtyMax,
              })}
            </span>
          </label>

          <label className="space-y-1 block min-w-0">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.supplyRewards.qtyMin')}
            </span>
            <input
              type="number"
              data-testid="admin-supply-rewards-crate-qty-min"
              min={SUPPLY_REWARDS_MIN_QTY}
              max={SUPPLY_REWARDS_MAX_QTY}
              value={cfg.crate.qtyMin}
              onChange={(e) => updateCrate('qtyMin', e.target.value)}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="block text-[11px] text-amber-200/90 font-mono-nums leading-snug break-words">
              {t('admin.supplyRewards.exCrateQty', {
                totalMin: cfg.crate.typesMin * cfg.crate.qtyMin,
                totalMax: cfg.crate.typesMax * cfg.crate.qtyMax,
              })}
            </span>
          </label>

          <label className="space-y-1 block min-w-0">
            <span className="text-[11px] text-slate-300 block">
              {t('admin.supplyRewards.qtyMax')}
            </span>
            <input
              type="number"
              data-testid="admin-supply-rewards-crate-qty-max"
              min={SUPPLY_REWARDS_MIN_QTY}
              max={SUPPLY_REWARDS_MAX_QTY}
              value={cfg.crate.qtyMax}
              onChange={(e) => updateCrate('qtyMax', e.target.value)}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <span className="block text-[11px] text-amber-200/90 font-mono-nums leading-snug break-words">
              {t('admin.supplyRewards.exCrateQty', {
                totalMin: cfg.crate.typesMin * cfg.crate.qtyMin,
                totalMax: cfg.crate.typesMax * cfg.crate.qtyMax,
              })}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
