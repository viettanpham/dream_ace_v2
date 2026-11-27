import { useState } from 'react';
import { Flame, RotateCcw } from 'lucide-react';
import { cloneEnrageConfig, DEFAULT_ENRAGE_CONFIG } from '../../data/balance';
import {
  clampEnrageEveryRounds,
  clampEnrageMaxStacks,
  clampEnrageStartRound,
  clampEnrageValue,
  formatEnrageAdminSummary,
  sanitizeEnrageConfig,
} from '../../engine/enrage';
import { useI18n } from '../../i18n';
import type { AdminConfig, EnrageConfig } from '../../types/game';

interface EnrageAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
}

function fmtNum(n: number): string {
  return String(Number(n.toFixed(2)));
}

export function EnrageAdminBlock({
  adminConfig,
  adminUpdateConfig,
}: EnrageAdminBlockProps) {
  const { lang, t } = useI18n();
  const [previewRound, setPreviewRound] = useState<number>(100);
  const enrage = sanitizeEnrageConfig(adminConfig.enrage);

  const updateEnrage = (next: EnrageConfig) => {
    adminUpdateConfig({ enrage: next });
  };

  const summaryText = formatEnrageAdminSummary(previewRound, adminConfig, lang);

  const rageAtMaxRound =
    enrage.rage.startRound + (enrage.rage.maxStacks - 1) * enrage.rage.everyRounds;
  const frenzyAtMaxRound =
    enrage.frenzy.startRound +
    (enrage.frenzy.maxStacks - 1) * enrage.frenzy.everyRounds;
  const berserkerAtMaxRound =
    enrage.berserker.startRound +
    (enrage.berserker.maxStacks - 1) * enrage.berserker.everyRounds;

  return (
    <div
      data-testid="admin-enrage-block"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3"
    >
      {/* Top Bar: Master Toggle + Preview Round Input + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            data-testid="admin-enrage-toggle"
            checked={Boolean(adminConfig.softEnrageEnabled)}
            onChange={(e) =>
              adminUpdateConfig({ softEnrageEnabled: e.target.checked })
            }
            className="w-4 h-4 accent-amber-400"
          />
          <div>
            <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
              {t('admin.softEnrage')}
            </span>
            <p className="text-[11px] text-slate-400">
              {t('admin.softEnrageDesc')}
            </p>
          </div>
        </label>

        <div className="flex items-end gap-2">
          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enragePreviewRound')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-enrage-preview-round"
              value={previewRound}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                setPreviewRound(clampEnrageStartRound(raw, 100));
              }}
              className="w-24 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              adminUpdateConfig({
                softEnrageEnabled: true,
                enrage: cloneEnrageConfig(DEFAULT_ENRAGE_CONFIG),
              })
            }
            className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            {t('admin.enrageReset')}
          </button>
        </div>
      </div>

      {/* Live Preview Summary Line */}
      <p
        data-testid="admin-enrage-summary"
        className="px-2.5 py-2 rounded border border-amber-500/30 bg-amber-950/20 text-[11px] font-mono-nums text-amber-200"
      >
        {summaryText}
      </p>

      {/* 3 Phase Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Phase 1: Rage */}
        <div
          data-testid="admin-enrage-card-rage"
          className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2.5"
        >
          <div className="text-xs font-bold text-orange-300">
            {t('admin.enragePhaseRage')}
          </div>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageStartRound')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-enrage-rage-start"
              value={enrage.rage.startRound}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  rage: {
                    ...enrage.rage,
                    startRound: clampEnrageStartRound(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.rage.startRound
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExStart', { start: enrage.rage.startRound })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageEveryRounds')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-enrage-rage-every"
              value={enrage.rage.everyRounds}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  rage: {
                    ...enrage.rage,
                    everyRounds: clampEnrageEveryRounds(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.rage.everyRounds
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExEvery', {
                every: enrage.rage.everyRounds,
                next: enrage.rage.startRound + enrage.rage.everyRounds,
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageRageValue')}
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              data-testid="admin-enrage-rage-value"
              value={enrage.rage.value}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  rage: {
                    ...enrage.rage,
                    value: clampEnrageValue(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.rage.value
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExRageVal', {
                at5: fmtNum(Math.min(100, 5 * enrage.rage.value)),
                atMax: fmtNum(
                  Math.min(100, enrage.rage.maxStacks * enrage.rage.value)
                ),
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageMaxStacks')}
            </span>
            <input
              type="number"
              min={1}
              max={1000}
              data-testid="admin-enrage-rage-max"
              value={enrage.rage.maxStacks}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  rage: {
                    ...enrage.rage,
                    maxStacks: clampEnrageMaxStacks(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.rage.maxStacks
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExMax', {
                max: enrage.rage.maxStacks,
                round: rageAtMaxRound,
              })}
            </p>
          </label>
        </div>

        {/* Phase 2: Frenzy */}
        <div
          data-testid="admin-enrage-card-frenzy"
          className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2.5"
        >
          <div className="text-xs font-bold text-amber-300">
            {t('admin.enragePhaseFrenzy')}
          </div>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageStartRound')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-enrage-frenzy-start"
              value={enrage.frenzy.startRound}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  frenzy: {
                    ...enrage.frenzy,
                    startRound: clampEnrageStartRound(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.frenzy.startRound
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExStart', { start: enrage.frenzy.startRound })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageEveryRounds')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-enrage-frenzy-every"
              value={enrage.frenzy.everyRounds}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  frenzy: {
                    ...enrage.frenzy,
                    everyRounds: clampEnrageEveryRounds(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.frenzy.everyRounds
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExEvery', {
                every: enrage.frenzy.everyRounds,
                next: enrage.frenzy.startRound + enrage.frenzy.everyRounds,
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageFrenzyValue')}
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              data-testid="admin-enrage-frenzy-value"
              value={enrage.frenzy.value}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  frenzy: {
                    ...enrage.frenzy,
                    value: clampEnrageValue(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.frenzy.value
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExFrenzyVal', {
                at5: fmtNum(5 * enrage.frenzy.value),
                atMax: fmtNum(enrage.frenzy.maxStacks * enrage.frenzy.value),
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageMaxStacks')}
            </span>
            <input
              type="number"
              min={1}
              max={1000}
              data-testid="admin-enrage-frenzy-max"
              value={enrage.frenzy.maxStacks}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  frenzy: {
                    ...enrage.frenzy,
                    maxStacks: clampEnrageMaxStacks(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.frenzy.maxStacks
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExMax', {
                max: enrage.frenzy.maxStacks,
                round: frenzyAtMaxRound,
              })}
            </p>
          </label>
        </div>

        {/* Phase 3: Berserker */}
        <div
          data-testid="admin-enrage-card-berserker"
          className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2.5"
        >
          <div className="text-xs font-bold text-rose-300">
            {t('admin.enragePhaseBerserker')}
          </div>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageStartRound')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-enrage-berserker-start"
              value={enrage.berserker.startRound}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  berserker: {
                    ...enrage.berserker,
                    startRound: clampEnrageStartRound(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.berserker.startRound
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExStart', {
                start: enrage.berserker.startRound,
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageEveryRounds')}
            </span>
            <input
              type="number"
              min={1}
              data-testid="admin-enrage-berserker-every"
              value={enrage.berserker.everyRounds}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  berserker: {
                    ...enrage.berserker,
                    everyRounds: clampEnrageEveryRounds(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.berserker.everyRounds
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExEvery', {
                every: enrage.berserker.everyRounds,
                next:
                  enrage.berserker.startRound + enrage.berserker.everyRounds,
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageBerserkerCritRate')}
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              data-testid="admin-enrage-berserker-crit-rate"
              value={enrage.berserker.critRatePct}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  berserker: {
                    ...enrage.berserker,
                    critRatePct: clampEnrageValue(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.berserker.critRatePct
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExCritRate', {
                at5: fmtNum(5 * enrage.berserker.critRatePct),
                atMax: fmtNum(
                  enrage.berserker.maxStacks * enrage.berserker.critRatePct
                ),
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageBerserkerCritDmg')}
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              data-testid="admin-enrage-berserker-crit-dmg"
              value={enrage.berserker.critDamagePct}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  berserker: {
                    ...enrage.berserker,
                    critDamagePct: clampEnrageValue(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.berserker.critDamagePct
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExCritDmg', {
                at5: fmtNum(5 * enrage.berserker.critDamagePct),
                atMax: fmtNum(
                  enrage.berserker.maxStacks * enrage.berserker.critDamagePct
                ),
              })}
            </p>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] text-slate-400 block">
              {t('admin.enrageMaxStacks')}
            </span>
            <input
              type="number"
              min={1}
              max={1000}
              data-testid="admin-enrage-berserker-max"
              value={enrage.berserker.maxStacks}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateEnrage({
                  ...enrage,
                  berserker: {
                    ...enrage.berserker,
                    maxStacks: clampEnrageMaxStacks(
                      raw,
                      DEFAULT_ENRAGE_CONFIG.berserker.maxStacks
                    ),
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
            />
            <p className="text-[11px] font-mono-nums text-sky-300/90">
              {t('admin.enrageExMax', {
                max: enrage.berserker.maxStacks,
                round: berserkerAtMaxRound,
              })}
            </p>
          </label>
        </div>
      </div>
    </div>
  );
}
