import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  cloneModuleDropConfig,
  DEFAULT_MODULE_DROP_CONFIG,
  MAX_MODULE_DROP_SHOP_COUNT,
  MAX_MODULE_DROP_WEIGHT,
  MIN_MODULE_DROP_SHOP_COUNT,
  MIN_MODULE_DROP_WEIGHT,
  MODULE_DROP_EFFECT_KEYS,
  MODULE_DROP_STAT_KEYS,
  MODULE_DROP_TRAIT_KEYS,
  sanitizeModuleDropConfig,
} from '../engine/moduleDrop';
import { useI18n } from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type { ModuleDropConfig, ModuleDropEffectKey } from '../types/game';

function toFactorPctString(factor: number): string {
  return String(Math.round(factor * 10000) / 100);
}

function toDraftWeights(
  weights: Record<ModuleDropEffectKey, number>
): Record<ModuleDropEffectKey, string> {
  const out = {} as Record<ModuleDropEffectKey, string>;
  for (const key of MODULE_DROP_EFFECT_KEYS) {
    out[key] = String(weights[key]);
  }
  return out;
}

function parseFiniteInRange(raw: string, min: number, max: number, integerOnly = false): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (integerOnly && !Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

export function ModuleDropAdminBlock() {
  const { t } = useI18n();
  const storedRaw = useGameStore((s) => s.adminConfig.moduleDrop);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const stored = sanitizeModuleDropConfig(storedRaw);

  const [factorPctDraft, setFactorPctDraft] = useState<string>(() =>
    toFactorPctString(stored.factor)
  );
  const [shopCountDraft, setShopCountDraft] = useState<string>(() =>
    String(stored.shopCount)
  );
  const [weightDrafts, setWeightDrafts] = useState<
    Record<ModuleDropEffectKey, string>
  >(() => toDraftWeights(stored.effectWeights));

  useEffect(() => {
    const clean = sanitizeModuleDropConfig(storedRaw);
    setFactorPctDraft(toFactorPctString(clean.factor));
    setShopCountDraft(String(clean.shopCount));
    setWeightDrafts(toDraftWeights(clean.effectWeights));
  }, [storedRaw]);

  const parsedFactorPct = parseFiniteInRange(factorPctDraft, 0, 100);
  const parsedShopCount = parseFiniteInRange(
    shopCountDraft,
    MIN_MODULE_DROP_SHOP_COUNT,
    MAX_MODULE_DROP_SHOP_COUNT,
    true
  );

  const parsedWeights = {} as Record<ModuleDropEffectKey, number | null>;
  let allWeightsValid = true;
  for (const key of MODULE_DROP_EFFECT_KEYS) {
    const val = parseFiniteInRange(
      weightDrafts[key],
      MIN_MODULE_DROP_WEIGHT,
      MAX_MODULE_DROP_WEIGHT
    );
    parsedWeights[key] = val;
    if (val === null) allWeightsValid = false;
  }

  const isFactorValid = parsedFactorPct !== null;
  const isShopCountValid = parsedShopCount !== null;
  const isAllValid = isFactorValid && isShopCountValid && allWeightsValid;

  const isDirty = (() => {
    if (!isAllValid) return false;
    const candidateFactor = Math.round((parsedFactorPct! / 100) * 10000) / 10000;
    if (candidateFactor !== stored.factor) return true;
    if (parsedShopCount !== stored.shopCount) return true;
    for (const key of MODULE_DROP_EFFECT_KEYS) {
      if (parsedWeights[key] !== stored.effectWeights[key]) return true;
    }
    return false;
  })();

  const handleApply = () => {
    if (!isAllValid || !isDirty) return;
    const nextWeights = {} as Record<ModuleDropEffectKey, number>;
    for (const key of MODULE_DROP_EFFECT_KEYS) {
      nextWeights[key] = parsedWeights[key]!;
    }
    const sanitized = sanitizeModuleDropConfig({
      factor: parsedFactorPct! / 100,
      shopCount: parsedShopCount!,
      effectWeights: nextWeights,
    } satisfies ModuleDropConfig);
    adminUpdateConfig({ moduleDrop: sanitized });
    setFactorPctDraft(toFactorPctString(sanitized.factor));
    setShopCountDraft(String(sanitized.shopCount));
    setWeightDrafts(toDraftWeights(sanitized.effectWeights));
  };

  const handleReset = () => {
    const def = cloneModuleDropConfig(DEFAULT_MODULE_DROP_CONFIG);
    adminUpdateConfig({ moduleDrop: def });
    setFactorPctDraft(toFactorPctString(def.factor));
    setShopCountDraft(String(def.shopCount));
    setWeightDrafts(toDraftWeights(def.effectWeights));
  };

  const onEnterApply = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <div
      data-testid="admin-module-drop-section"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-bold text-amber-300">
            {t('admin.moduleDropTitle')}
          </div>
          <div className="text-[11px] text-slate-400">
            {t('admin.moduleDropHint')}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="admin-module-drop-apply"
            disabled={!isAllValid || !isDirty}
            onClick={handleApply}
            className="h-8 px-3 rounded border border-amber-500/50 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 text-[11px] font-semibold cursor-pointer"
          >
            {t('admin.moduleDropApply')}
          </button>
          <button
            type="button"
            data-testid="admin-module-drop-reset"
            onClick={handleReset}
            className="h-8 px-2.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span>{t('admin.moduleDropReset')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span
            className={`text-[11px] block ${
              isFactorValid ? 'text-slate-400' : 'text-rose-400 font-medium'
            }`}
          >
            {t('admin.moduleDropFactorPct')} (0–100%)
          </span>
          <input
            type="number"
            step="any"
            data-testid="admin-module-drop-factor"
            value={factorPctDraft}
            onChange={(e) => setFactorPctDraft(e.target.value)}
            onKeyDown={onEnterApply}
            className={`w-full h-9 px-2.5 rounded border bg-slate-900 text-xs font-mono-nums ${
              isFactorValid
                ? 'border-slate-700 text-slate-100'
                : 'border-rose-500 text-rose-300'
            }`}
          />
        </label>

        <label className="space-y-1 block">
          <span
            className={`text-[11px] block ${
              isShopCountValid ? 'text-slate-400' : 'text-rose-400 font-medium'
            }`}
          >
            {t('admin.moduleDropShopCount')} (0–3)
          </span>
          <input
            type="number"
            step={1}
            data-testid="admin-module-drop-shop-count"
            value={shopCountDraft}
            onChange={(e) => setShopCountDraft(e.target.value)}
            onKeyDown={onEnterApply}
            className={`w-full h-9 px-2.5 rounded border bg-slate-900 text-xs font-mono-nums ${
              isShopCountValid
                ? 'border-slate-700 text-slate-100'
                : 'border-rose-500 text-rose-300'
            }`}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-300">
          {t('admin.moduleDropStatGroup')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {MODULE_DROP_STAT_KEYS.map((key) => {
            const valid = parsedWeights[key] !== null;
            return (
              <label key={key} className="space-y-1 block">
                <span
                  className={`text-[10px] block truncate ${
                    valid ? 'text-slate-400' : 'text-rose-400 font-medium'
                  }`}
                >
                  {t(`stat.${key}.label`)}
                </span>
                <input
                  type="number"
                  data-testid={`admin-module-drop-weight-${key}`}
                  value={weightDrafts[key]}
                  onChange={(e) =>
                    setWeightDrafts((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                  onKeyDown={onEnterApply}
                  className={`w-full h-8 px-2 rounded border bg-slate-900 text-xs font-mono-nums ${
                    valid
                      ? 'border-slate-700 text-slate-100'
                      : 'border-rose-500 text-rose-300'
                  }`}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-300">
          {t('admin.moduleDropTraitGroup')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODULE_DROP_TRAIT_KEYS.map((key) => {
            const valid = parsedWeights[key] !== null;
            return (
              <label key={key} className="space-y-1 block">
                <span
                  className={`text-[10px] block truncate ${
                    valid ? 'text-slate-400' : 'text-rose-400 font-medium'
                  }`}
                >
                  {t(`admin.moduleDropTrait.${key}`)}
                </span>
                <input
                  type="number"
                  data-testid={`admin-module-drop-weight-${key}`}
                  value={weightDrafts[key]}
                  onChange={(e) =>
                    setWeightDrafts((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                  onKeyDown={onEnterApply}
                  className={`w-full h-8 px-2 rounded border bg-slate-900 text-xs font-mono-nums ${
                    valid
                      ? 'border-slate-700 text-slate-100'
                      : 'border-rose-500 text-rose-300'
                  }`}
                />
              </label>
            );
          })}
        </div>
      </div>

      {!isAllValid && (
        <div
          data-testid="admin-module-drop-error"
          className="text-[11px] text-rose-400 font-medium"
        >
          {t('admin.moduleDropInvalidRange')}
        </div>
      )}
    </div>
  );
}
