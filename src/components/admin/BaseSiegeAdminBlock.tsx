import { useState } from 'react';
import { RotateCcw, Shield } from 'lucide-react';
import {
  cloneBaseSiegeConfig,
  computeBaseRepairAmount,
  computeBaseRepairCost,
  computeWinsToCapture,
  DEFAULT_BASE_SIEGE_CONFIG,
  getPilotHighestGearLevel,
  sanitizeBaseSiegeConfig,
} from '../../engine/baseSiege';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { AdminConfig, BaseSiegeConfig, BaseType } from '../../types/game';

interface BaseSiegeAdminBlockProps {
  adminConfig: AdminConfig;
  adminUpdateConfig: (patch: Partial<AdminConfig>) => void;
  onFlash?: (msg: string) => void;
}

const BASE_TYPE_ORDER: readonly BaseType[] = [
  'outpost',
  'colony',
  'relay',
  'fortress',
  'shipyard',
  'capital',
];

function fmtLocale(n: number, lang: 'vi' | 'en'): string {
  return Math.round(n).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
}

export function BaseSiegeAdminBlock({
  adminConfig,
  adminUpdateConfig,
  onFlash,
}: BaseSiegeAdminBlockProps) {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminResetAllBaseSiege = useGameStore((s) => s.adminResetAllBaseSiege);
  const [confirmResetPools, setConfirmResetPools] = useState(false);

  const cfg = sanitizeBaseSiegeConfig(adminConfig.baseSiege);
  const highestGearLv = getPilotHighestGearLevel(pilot);

  const updateCfg = (next: BaseSiegeConfig) => {
    adminUpdateConfig({
      baseSiege: sanitizeBaseSiegeConfig(next),
    });
  };

  const outpostMax = cfg.byType.outpost;
  const fortressMax = cfg.byType.fortress;
  const capitalMax = cfg.byType.capital;
  const outpostShieldWins = Math.ceil(outpostMax.maxShield / cfg.shieldDamagePerWin);
  const outpostHpWins = Math.ceil(outpostMax.maxHp / cfg.hpDamagePerWin);
  const outpostTotalWins = computeWinsToCapture('outpost', cfg);
  const capitalShieldWins = Math.ceil(capitalMax.maxShield / cfg.shieldDamagePerWin);

  const repairHpAmount = computeBaseRepairAmount('hp', 'outpost', cfg);
  const repairHpCost = computeBaseRepairCost('hp', highestGearLv, cfg);
  const repairShieldAmount = computeBaseRepairAmount('shield', 'outpost', cfg);
  const repairShieldCost = computeBaseRepairCost('shield', highestGearLv, cfg);

  return (
    <div data-testid="admin-base-siege-block" className="space-y-4">
      {/* Toolbar: Reset config defaults + Reset all base pools */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span>{t('admin.campaignSection.baseSiege.desc')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="admin-base-siege-reset-defaults"
            onClick={() =>
              adminUpdateConfig({
                baseSiege: cloneBaseSiegeConfig(DEFAULT_BASE_SIEGE_CONFIG),
              })
            }
            className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            {t('admin.baseSiege.resetDefaults')}
          </button>

          {!confirmResetPools ? (
            <button
              type="button"
              data-testid="admin-base-siege-reset-all-pools"
              onClick={() => setConfirmResetPools(true)}
              className="h-9 px-3 rounded border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-[11px] font-semibold cursor-pointer"
            >
              {t('admin.baseSiege.resetAllPoolsBtn')}
            </button>
          ) : (
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1">
              <span className="text-[11px] text-amber-200">
                {t('admin.baseSiege.resetAllPoolsConfirm')}
              </span>
              <button
                type="button"
                data-testid="admin-base-siege-reset-all-confirm"
                onClick={() => {
                  adminResetAllBaseSiege();
                  setConfirmResetPools(false);
                  onFlash?.(t('admin.baseSiege.resetAllPoolsDone'));
                }}
                className="h-7 px-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer"
              >
                {t('admin.baseSiege.confirmYes')}
              </button>
              <button
                type="button"
                data-testid="admin-base-siege-reset-all-cancel"
                onClick={() => setConfirmResetPools(false)}
                className="h-7 px-2 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] cursor-pointer"
              >
                {t('admin.baseSiege.confirmCancel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. 6 per-type max rows */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-sky-300">
          {t('admin.baseSiege.byTypeGroup')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {BASE_TYPE_ORDER.map((bt) => {
            const row = cfg.byType[bt];
            const sWins = Math.ceil(row.maxShield / cfg.shieldDamagePerWin);
            const hWins = Math.ceil(row.maxHp / cfg.hpDamagePerWin);
            const totalWins = computeWinsToCapture(bt, cfg);
            const typeLabel = t(`admin.baseSiege.type.${bt}`);
            return (
              <div
                key={bt}
                data-testid={`admin-base-siege-type-${bt}`}
                className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-2"
              >
                <div className="text-xs font-semibold text-slate-100">
                  {typeLabel}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-300 block">
                      {t('admin.baseSiege.maxShield')}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      data-testid={`admin-base-siege-${bt}-maxShield`}
                      value={row.maxShield}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        updateCfg({
                          ...cfg,
                          byType: {
                            ...cfg.byType,
                            [bt]: { ...row, maxShield: raw },
                          },
                        });
                      }}
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                    />
                    <span className="text-[11px] font-mono-nums text-sky-200/85 block leading-snug">
                      {t('admin.baseSiege.maxShieldEx', {
                        sWins,
                        dmg: fmtLocale(cfg.shieldDamagePerWin, lang),
                      })}
                    </span>
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-300 block">
                      {t('admin.baseSiege.maxHp')}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      data-testid={`admin-base-siege-${bt}-maxHp`}
                      value={row.maxHp}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        updateCfg({
                          ...cfg,
                          byType: {
                            ...cfg.byType,
                            [bt]: { ...row, maxHp: raw },
                          },
                        });
                      }}
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
                    />
                    <span className="text-[11px] font-mono-nums text-sky-200/85 block leading-snug">
                      {t('admin.baseSiege.maxHpEx', {
                        hWins,
                        total: totalWins,
                      })}
                    </span>
                  </label>
                </div>
                <div
                  data-testid={`admin-base-siege-${bt}-example`}
                  className="text-[11px] font-mono-nums text-amber-200/90 pt-0.5"
                >
                  {t('admin.baseSiege.typeRowEx', {
                    name: typeLabel,
                    shield: fmtLocale(row.maxShield, lang),
                    hp: fmtLocale(row.maxHp, lang),
                    sWins,
                    hWins,
                    total: totalWins,
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Per-win damage */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-amber-300">
          {t('admin.baseSiege.winDamageGroup')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.shieldDamagePerWin')}
            </span>
            <input
              type="number"
              min={1}
              max={100000}
              data-testid="admin-base-siege-shieldDamagePerWin"
              value={cfg.shieldDamagePerWin}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({ ...cfg, shieldDamagePerWin: raw });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-amber-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.shieldDamagePerWinEx', {
                sMax: fmtLocale(outpostMax.maxShield, lang),
                sWins: outpostShieldWins,
                cMax: fmtLocale(capitalMax.maxShield, lang),
                cWins: capitalShieldWins,
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.hpDamagePerWin')}
            </span>
            <input
              type="number"
              min={1}
              max={100000}
              data-testid="admin-base-siege-hpDamagePerWin"
              value={cfg.hpDamagePerWin}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({ ...cfg, hpDamagePerWin: raw });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-amber-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.hpDamagePerWinEx', {
                sMax: fmtLocale(outpostMax.maxShield, lang),
                hMax: fmtLocale(outpostMax.maxHp, lang),
                sWins: outpostShieldWins,
                hWins: outpostHpWins,
                total: outpostTotalWins,
              })}
            </span>
          </label>
        </div>
      </div>

      {/* 3. Regen */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-emerald-300">
          {t('admin.baseSiege.regenGroup')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.regenIdleMonths')}
            </span>
            <input
              type="number"
              min={0}
              max={12}
              data-testid="admin-base-siege-regen-idleMonths"
              value={cfg.regen.idleMonths}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  regen: { ...cfg.regen, idleMonths: raw },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-emerald-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.regenIdleMonthsEx', {
                months: cfg.regen.idleMonths,
                sPct: cfg.regen.shieldPct,
                hPct: cfg.regen.hpPct,
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.regenShieldPct')}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              data-testid="admin-base-siege-regen-shieldPct"
              value={cfg.regen.shieldPct}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  regen: { ...cfg.regen, shieldPct: raw },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-emerald-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.regenShieldPctEx', {
                outpostGain: fmtLocale(
                  Math.round((outpostMax.maxShield * cfg.regen.shieldPct) / 100),
                  lang
                ),
                fortressGain: fmtLocale(
                  Math.round((fortressMax.maxShield * cfg.regen.shieldPct) / 100),
                  lang
                ),
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.regenHpPct')}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              data-testid="admin-base-siege-regen-hpPct"
              value={cfg.regen.hpPct}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  regen: { ...cfg.regen, hpPct: raw },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-emerald-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.regenHpPctEx', {
                outpostGain: fmtLocale(
                  Math.round((outpostMax.maxHp * cfg.regen.hpPct) / 100),
                  lang
                ),
                fortressGain: fmtLocale(
                  Math.round((fortressMax.maxHp * cfg.regen.hpPct) / 100),
                  lang
                ),
              })}
            </span>
          </label>
        </div>
      </div>

      {/* 4. Repair */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-cyan-300">
          {t('admin.baseSiege.repairGroup')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block md:col-span-3">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.repairCooldown')}
            </span>
            <input
              type="number"
              min={0}
              max={12}
              data-testid="admin-base-siege-repair-cooldownMonths"
              value={cfg.repair.cooldownMonths}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  repair: { ...cfg.repair, cooldownMonths: raw },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-cyan-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.repairCooldownEx', {
                nextMonth: 1 + cfg.repair.cooldownMonths,
              })}
            </span>
          </label>

          {/* Repair HP */}
          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.repairHpPct')}
            </span>
            <input
              type="number"
              min={1}
              max={100}
              data-testid="admin-base-siege-repair-hp-amountPct"
              value={cfg.repair.hp.amountPct}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  repair: {
                    ...cfg.repair,
                    hp: { ...cfg.repair.hp, amountPct: raw },
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-cyan-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.repairHpPctEx', {
                pct: cfg.repair.hp.amountPct,
                amount: fmtLocale(repairHpAmount, lang),
                base: fmtLocale(cfg.repair.hp.costBase, lang),
                perLv: fmtLocale(cfg.repair.hp.costPerGearLevel, lang),
                cost: fmtLocale(repairHpCost, lang),
                lv: highestGearLv,
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.repairHpCostBase')}
            </span>
            <input
              type="number"
              min={0}
              data-testid="admin-base-siege-repair-hp-costBase"
              value={cfg.repair.hp.costBase}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  repair: {
                    ...cfg.repair,
                    hp: { ...cfg.repair.hp, costBase: raw },
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-cyan-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.repairHpCostBaseEx', {
                lv: highestGearLv,
                base: fmtLocale(cfg.repair.hp.costBase, lang),
                perLv: fmtLocale(cfg.repair.hp.costPerGearLevel, lang),
                cost: fmtLocale(repairHpCost, lang),
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.repairHpCostPerLv')}
            </span>
            <input
              type="number"
              min={0}
              data-testid="admin-base-siege-repair-hp-costPerGearLevel"
              value={cfg.repair.hp.costPerGearLevel}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  repair: {
                    ...cfg.repair,
                    hp: { ...cfg.repair.hp, costPerGearLevel: raw },
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-cyan-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.repairHpCostPerLvEx', {
                c1: fmtLocale(computeBaseRepairCost('hp', 1, cfg), lang),
                c10: fmtLocale(computeBaseRepairCost('hp', 10, cfg), lang),
              })}
            </span>
          </label>

          {/* Repair Shield */}
          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.repairShieldPct')}
            </span>
            <input
              type="number"
              min={1}
              max={100}
              data-testid="admin-base-siege-repair-shield-amountPct"
              value={cfg.repair.shield.amountPct}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  repair: {
                    ...cfg.repair,
                    shield: { ...cfg.repair.shield, amountPct: raw },
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-cyan-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.repairShieldPctEx', {
                pct: cfg.repair.shield.amountPct,
                amount: fmtLocale(repairShieldAmount, lang),
                base: fmtLocale(cfg.repair.shield.costBase, lang),
                perLv: fmtLocale(cfg.repair.shield.costPerGearLevel, lang),
                cost: fmtLocale(repairShieldCost, lang),
                lv: highestGearLv,
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.repairShieldCostBase')}
            </span>
            <input
              type="number"
              min={0}
              data-testid="admin-base-siege-repair-shield-costBase"
              value={cfg.repair.shield.costBase}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  repair: {
                    ...cfg.repair,
                    shield: { ...cfg.repair.shield, costBase: raw },
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-cyan-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.repairShieldCostBaseEx', {
                lv: highestGearLv,
                base: fmtLocale(cfg.repair.shield.costBase, lang),
                perLv: fmtLocale(cfg.repair.shield.costPerGearLevel, lang),
                cost: fmtLocale(repairShieldCost, lang),
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.repairShieldCostPerLv')}
            </span>
            <input
              type="number"
              min={0}
              data-testid="admin-base-siege-repair-shield-costPerGearLevel"
              value={cfg.repair.shield.costPerGearLevel}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  repair: {
                    ...cfg.repair,
                    shield: { ...cfg.repair.shield, costPerGearLevel: raw },
                  },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-cyan-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.repairShieldCostPerLvEx', {
                c1: fmtLocale(computeBaseRepairCost('shield', 1, cfg), lang),
                c10: fmtLocale(computeBaseRepairCost('shield', 10, cfg), lang),
              })}
            </span>
          </label>
        </div>
      </div>

      {/* 5. Raid */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-rose-300">
          {t('admin.baseSiege.raidGroup')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.raidShieldDamage')}
            </span>
            <input
              type="number"
              min={0}
              max={100000}
              data-testid="admin-base-siege-raid-shieldDamage"
              value={cfg.raid.shieldDamage}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  raid: { ...cfg.raid, shieldDamage: raw },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-rose-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.raidShieldDamageEx', {
                max: fmtLocale(outpostMax.maxShield, lang),
                after: fmtLocale(
                  Math.max(0, outpostMax.maxShield - cfg.raid.shieldDamage),
                  lang
                ),
              })}
            </span>
          </label>

          <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block">
            <span className="text-xs font-semibold text-slate-200 block">
              {t('admin.baseSiege.raidHpDamage')}
            </span>
            <input
              type="number"
              min={0}
              max={100000}
              data-testid="admin-base-siege-raid-hpDamage"
              value={cfg.raid.hpDamage}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                updateCfg({
                  ...cfg,
                  raid: { ...cfg.raid, hpDamage: raw },
                });
              }}
              className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
            />
            <span className="text-[11px] font-mono-nums text-rose-200/90 block leading-snug pt-0.5">
              {t('admin.baseSiege.raidHpDamageEx', {
                max: fmtLocale(outpostMax.maxHp, lang),
                after: fmtLocale(
                  Math.max(0, outpostMax.maxHp - cfg.raid.hpDamage),
                  lang
                ),
                hits:
                  cfg.raid.hpDamage > 0
                    ? Math.ceil(outpostMax.maxHp / cfg.raid.hpDamage)
                    : '∞',
              })}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
