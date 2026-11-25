import { useEffect, useState } from 'react';
import { Skull, Trash2 } from 'lucide-react';
import {
  sanitizePirateIncidents,
  sanitizePiratesConfig,
} from '../../engine/pirates';
import { getSectorName, useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { PirateSizeWeights } from '../../types/game';

interface PirateAdminBlockProps {
  flash: (msg: string) => void;
}

export function PirateAdminBlock({ flash }: PirateAdminBlockProps) {
  const { t, lang } = useI18n();
  const adminConfig = useGameStore((s) => s.adminConfig);
  const pilot = useGameStore((s) => s.pilot);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);
  const adminSpawnPirateIncident = useGameStore(
    (s) => s.adminSpawnPirateIncident
  );
  const adminClearPirateIncidents = useGameStore(
    (s) => s.adminClearPirateIncidents
  );
  const adminRemovePirateIncident = useGameStore(
    (s) => s.adminRemovePirateIncident
  );

  const cfg = sanitizePiratesConfig(adminConfig.pirates);
  const activeIncidents = sanitizePirateIncidents(
    pilot.pirateIncidents,
    pilot.campaignMonth,
    cfg
  );

  const [weightDraft, setWeightDraft] = useState<{
    4: string;
    6: string;
    8: string;
  }>({
    4: String(cfg.sizeWeights[4]),
    6: String(cfg.sizeWeights[6]),
    8: String(cfg.sizeWeights[8]),
  });
  const [weightsError, setWeightsError] = useState(false);

  useEffect(() => {
    setWeightDraft({
      4: String(cfg.sizeWeights[4]),
      6: String(cfg.sizeWeights[6]),
      8: String(cfg.sizeWeights[8]),
    });
    setWeightsError(false);
  }, [cfg.sizeWeights[4], cfg.sizeWeights[6], cfg.sizeWeights[8]]);

  const updateCfg = (patch: Partial<typeof cfg>) => {
    adminUpdateConfig({
      pirates: sanitizePiratesConfig({
        ...cfg,
        ...patch,
      }),
    });
  };

  const handleWeightChange = (size: 4 | 6 | 8, rawVal: string) => {
    const nextDraft = { ...weightDraft, [size]: rawVal };
    setWeightDraft(nextDraft);

    const parsed: PirateSizeWeights = {
      4: Number(nextDraft[4]),
      6: Number(nextDraft[6]),
      8: Number(nextDraft[8]),
    };

    const allFiniteNonNeg =
      Number.isFinite(parsed[4]) &&
      parsed[4] >= 0 &&
      Number.isFinite(parsed[6]) &&
      parsed[6] >= 0 &&
      Number.isFinite(parsed[8]) &&
      parsed[8] >= 0;

    if (!allFiniteNonNeg || parsed[4] + parsed[6] + parsed[8] <= 0) {
      setWeightsError(true);
      return;
    }

    setWeightsError(false);
    updateCfg({ sizeWeights: parsed });
  };

  return (
    <div
      data-testid="admin-pirates-section"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3 min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Skull className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-xs font-bold text-rose-300 truncate">
            {t('admin.piratesTitle')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="admin-pirates-spawn-btn"
            onClick={() => {
              const ok = adminSpawnPirateIncident();
              flash(
                ok
                  ? t('admin.piratesSpawnedFlash')
                  : t('admin.piratesSpawnBlockedFlash')
              );
            }}
            className="h-8 px-2.5 rounded border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
          >
            {t('admin.piratesSpawnNow')}
          </button>
          <button
            type="button"
            data-testid="admin-pirates-clear-all-btn"
            onClick={() => {
              adminClearPirateIncidents();
              flash(t('admin.piratesClearedFlash'));
            }}
            className="h-8 px-2.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
          >
            {t('admin.piratesClearAll')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex items-center gap-2 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs cursor-pointer min-w-0">
          <input
            type="checkbox"
            data-testid="admin-pirates-enabled"
            checked={cfg.enabled}
            onChange={(e) => updateCfg({ enabled: e.target.checked })}
            className="accent-rose-400 shrink-0"
          />
          <span className="text-slate-200 truncate">
            {t('admin.piratesEnabled')}
          </span>
        </label>

        <label className="flex items-center gap-2 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs cursor-pointer min-w-0">
          <input
            type="checkbox"
            data-testid="admin-pirates-ensure-idle"
            checked={cfg.ensureOneWhenIdle}
            onChange={(e) =>
              updateCfg({ ensureOneWhenIdle: e.target.checked })
            }
            className="accent-rose-400 shrink-0"
          />
          <span className="text-slate-200 truncate">
            {t('admin.piratesEnsureIdle')}
          </span>
        </label>

        <label className="space-y-1 block min-w-0">
          <span className="text-[11px] text-slate-400 block truncate">
            {t('admin.piratesMaxActive')}
          </span>
          <input
            type="number"
            data-testid="admin-pirates-max-active"
            min={1}
            max={6}
            step={1}
            value={cfg.maxActive}
            onChange={(e) =>
              updateCfg({ maxActive: Number(e.target.value) })
            }
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>

        <label className="space-y-1 block min-w-0">
          <span className="text-[11px] text-slate-400 block truncate">
            {t('admin.piratesSpawnChance')}
          </span>
          <input
            type="number"
            data-testid="admin-pirates-spawn-chance"
            min={0}
            max={1}
            step={0.05}
            value={cfg.spawnChancePerMonth}
            onChange={(e) =>
              updateCfg({ spawnChancePerMonth: Number(e.target.value) })
            }
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>

        <label className="space-y-1 block min-w-0">
          <span className="text-[11px] text-slate-400 block truncate">
            {t('admin.piratesExpiryMonths')}
          </span>
          <input
            type="number"
            data-testid="admin-pirates-expiry-months"
            min={1}
            max={12}
            step={1}
            value={cfg.expiryMonths}
            onChange={(e) =>
              updateCfg({ expiryMonths: Number(e.target.value) })
            }
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>

        <label className="space-y-1 block min-w-0">
          <span className="text-[11px] text-slate-400 block truncate">
            {t('admin.piratesRewardMult')}
          </span>
          <input
            type="number"
            data-testid="admin-pirates-reward-mult"
            min={0.1}
            max={5}
            step={0.1}
            value={cfg.rewardMult}
            onChange={(e) =>
              updateCfg({ rewardMult: Number(e.target.value) })
            }
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>
      </div>

      {/* Size weights: 4v4 / 6v6 / 8v8 */}
      <div className="space-y-2 pt-1">
        <div className="text-[11px] font-semibold text-slate-300">
          {t('admin.piratesWeightsTitle')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([4, 6, 8] as const).map((sz) => (
            <label key={sz} className="space-y-1 block min-w-0">
              <span className="text-[11px] text-slate-400 block">
                {sz}v{sz}
              </span>
              <input
                type="number"
                data-testid={`admin-pirates-weight-${sz}`}
                min={0}
                step={1}
                value={weightDraft[sz]}
                onChange={(e) => handleWeightChange(sz, e.target.value)}
                className={`w-full h-9 px-2 rounded border bg-slate-900 text-xs font-mono-nums ${
                  weightsError
                    ? 'border-rose-500 text-rose-200'
                    : 'border-slate-700 text-slate-100'
                }`}
              />
            </label>
          ))}
        </div>
        {weightsError && (
          <div
            role="alert"
            data-testid="pirate-weights-error"
            className="text-[11px] text-rose-400 font-medium"
          >
            {t('admin.piratesWeightsInvalid')}
          </div>
        )}
      </div>

      {/* Active incidents list */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[11px] font-semibold text-slate-300">
          {t('admin.piratesActiveList', {
            count: activeIncidents.length,
            max: cfg.maxActive,
          })}
        </div>
        {activeIncidents.length === 0 ? (
          <div
            data-testid="admin-pirates-empty"
            className="text-[11px] text-slate-500 py-1"
          >
            {t('admin.piratesEmpty')}
          </div>
        ) : (
          <div
            data-testid="admin-pirates-incident-list"
            className="divide-y divide-slate-800/80 rounded border border-slate-800 bg-slate-950/60"
          >
            {activeIncidents.map((inc) => {
              const monthsLeft = Math.max(
                1,
                inc.expiresMonth - pilot.campaignMonth
              );
              return (
                <div
                  key={inc.id}
                  data-testid={`admin-pirates-incident-${inc.id}`}
                  className="px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-100">
                      {getSectorName(lang, inc.nodeId)}
                    </span>{' '}
                    <span className="font-mono-nums text-rose-300">
                      {inc.size}v{inc.size}
                    </span>{' '}
                    <span className="text-slate-400">
                      · {t('admin.piratesMonthsLeft', { months: monthsLeft })}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid={`admin-pirates-remove-${inc.id}`}
                    onClick={() => adminRemovePirateIncident(inc.id)}
                    className="h-7 px-2.5 rounded border border-slate-700 bg-slate-800 hover:bg-rose-900/50 hover:border-rose-500/60 text-slate-200 hover:text-rose-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span>{t('admin.piratesRemove')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p
        data-testid="admin-pirates-hint"
        className="text-[11px] text-slate-400 leading-relaxed"
      >
        {t('admin.piratesHint')}
      </p>
    </div>
  );
}
