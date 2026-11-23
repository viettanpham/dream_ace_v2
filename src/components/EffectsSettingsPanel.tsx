import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Clapperboard, Grid, Info, Play, RotateCcw, Sparkles, Tag } from 'lucide-react';
import { useI18n } from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type { StatusBadgeLayout } from '../types/game';
import { useActionStageEnabled } from '../utils/actionStagePrefs';
import { usePrefersReducedMotion } from '../utils/battleDisplay';
import {
  resolveEffectiveVfxConfig,
  resolveReducedMotion,
  useFxSettings,
  type BattleEffectsMode,
  type ReducedMotionSetting,
} from '../utils/battleVfx';
import { useStatusDisplaySettings } from '../utils/statusDisplayPrefs';
import { StageProjectile, StageToken } from './ActionStage';
import { IconCatalogPreviewModal } from './IconCatalogPreviewModal';

interface EffectsSettingsPanelProps {
  /** Compact variant for embedding inside battle "..." sheet or TopHud settings */
  compact?: boolean;
}

/**
 * Shared Effects Settings panel (Full/Compact/Off, Reduced Motion 3-way override,
 * Show Status Labels, Effects Debug, and live "Test effects" preview box).
 * Stored in `dreamAce.fx.v2` and synchronized live across Hangar, TopHud, and BattleScreen.
 */
export function EffectsSettingsPanel({ compact = false }: EffectsSettingsPanelProps) {
  const { t } = useI18n();
  const [fxSettings, updateFxSettings] = useFxSettings();
  const [actionStageEnabled, setActionStageEnabled] = useActionStageEnabled();
  const adminStatusDefaults = useGameStore(
    (s) => s.adminConfig.statusDisplayDefaults
  );
  const {
    settings: statusSettings,
    hasOverride: hasStatusOverride,
    isPhoneWidth,
    updateOverride: updateStatusOverride,
    resetToDefaults: resetStatusDefaults,
  } = useStatusDisplaySettings(adminStatusDefaults);
  const [iconCatalogOpen, setIconCatalogOpen] = useState(false);

  const osReducedMotion = usePrefersReducedMotion();
  const resolvedReducedMotion = resolveReducedMotion(
    fxSettings.reducedMotionMode,
    osReducedMotion
  );
  const previewConfig = resolveEffectiveVfxConfig(
    fxSettings.effectsMode,
    1,
    resolvedReducedMotion,
    false
  );

  const [previewRunId, setPreviewRunId] = useState(0);
  const [previewActive, setPreviewActive] = useState(false);
  const previewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  const handleTestEffects = () => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
    }
    setPreviewRunId((n) => n + 1);
    setPreviewActive(true);
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = null;
      setPreviewActive(false);
    }, 1450);
  };

  const modeOptions: ReadonlyArray<{ id: BattleEffectsMode; label: string }> = [
    { id: 'full', label: t('battle.effectsFull') },
    { id: 'compact', label: t('battle.effectsCompact') },
    { id: 'off', label: t('battle.effectsOff') },
  ];

  const reducedMotionOptions: ReadonlyArray<{
    id: ReducedMotionSetting;
    label: string;
  }> = [
    { id: 'system', label: t('fx.reducedMotionSystem') },
    { id: 'off', label: t('fx.reducedMotionOff') },
    { id: 'on', label: t('fx.reducedMotionOn') },
  ];

  return (
    <div
      data-testid="battle-effects-setting"
      className={
        compact
          ? 'space-y-3'
          : 'p-3 rounded-lg border border-slate-800 bg-slate-900/50 space-y-3'
      }
    >
      {/* 1. Effects Mode (Full / Compact / Off) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('battle.effectsLabel')}</span>
          </span>
          <span className="text-[11px] font-mono-nums text-slate-400">
            {osReducedMotion ? t('fx.osFlagReduce') : t('fx.osFlagNormal')}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {modeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-testid={`battle-effects-${opt.id}`}
              aria-pressed={fxSettings.effectsMode === opt.id}
              onClick={() => updateFxSettings({ effectsMode: opt.id })}
              className={`min-h-[42px] rounded-lg border text-[13px] font-bold cursor-pointer transition-colors ${
                fxSettings.effectsMode === opt.id
                  ? 'border-sky-400 bg-sky-500 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Reduced Motion 3-way setting (Follow system / Off (Full FX) / On) */}
      <div className="space-y-1.5" data-testid="effects-reduced-motion-setting">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
          {t('fx.reducedMotionLabel')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {reducedMotionOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-testid={`effects-reduced-motion-${opt.id}`}
              aria-pressed={fxSettings.reducedMotionMode === opt.id}
              onClick={() => updateFxSettings({ reducedMotionMode: opt.id })}
              className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold leading-tight cursor-pointer transition-colors ${
                fxSettings.reducedMotionMode === opt.id
                  ? 'border-sky-400 bg-sky-500/25 text-sky-100'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Show Status Labels + Effects Debug toggles */}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          data-testid="battle-toggle-status-labels"
          onClick={() =>
            updateFxSettings({ showStatusLabels: !fxSettings.showStatusLabels })
          }
          aria-pressed={fxSettings.showStatusLabels}
          className={`w-full min-h-[42px] px-3.5 rounded-lg border text-[13px] font-semibold flex items-center justify-between cursor-pointer ${
            fxSettings.showStatusLabels
              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
              : 'border-slate-700 bg-slate-900 text-slate-300'
          }`}
        >
          <span className="inline-flex items-center gap-2.5">
            <Tag className="w-4 h-4 text-sky-400" />
            <span>{t('battle.showStatusLabels')}</span>
          </span>
          <span className="font-mono-nums text-[12px]">
            {fxSettings.showStatusLabels ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          data-testid="battle-toggle-effects-debug"
          onClick={() =>
            updateFxSettings({ effectsDebug: !fxSettings.effectsDebug })
          }
          aria-pressed={fxSettings.effectsDebug}
          className={`w-full min-h-[42px] px-3.5 rounded-lg border text-[13px] font-semibold flex items-center justify-between cursor-pointer ${
            fxSettings.effectsDebug
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-slate-700 bg-slate-900 text-slate-300'
          }`}
        >
          <span className="inline-flex items-center gap-2.5">
            <Info className="w-4 h-4 text-amber-400" />
            <span>{t('battle.effectsDebug')}</span>
          </span>
          <span className="font-mono-nums text-[12px]">
            {fxSettings.effectsDebug ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          data-testid="battle-toggle-action-stage"
          onClick={() => setActionStageEnabled(!actionStageEnabled)}
          aria-pressed={actionStageEnabled}
          className={`w-full min-h-[42px] px-3.5 rounded-lg border text-[13px] font-semibold flex items-center justify-between cursor-pointer ${
            actionStageEnabled
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
              : 'border-slate-700 bg-slate-900 text-slate-300'
          }`}
        >
          <span className="inline-flex items-center gap-2.5">
            <Clapperboard className="w-4 h-4 text-emerald-400" />
            <span>{t('fx.actionStageLabel')}</span>
          </span>
          <span className="font-mono-nums text-[12px]">
            {actionStageEnabled ? t('fx.actionStageOn') : t('fx.actionStageOff')}
          </span>
        </button>
      </div>

      {/* 3B. Status Display Settings (Badge Layout A/B, Unit Rows 1..5, Player Rows 1..2, Reset, Bảng icon) */}
      <div
        data-testid="status-display-settings"
        className="pt-2 border-t border-slate-800/90 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            {t('statusUi.sectionTitle')}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="status-reset-defaults-btn"
              onClick={resetStatusDefaults}
              disabled={!hasStatusOverride}
              className="h-7 px-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-[11px] font-semibold text-slate-200 inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('statusUi.resetDefaultsBtn')}</span>
            </button>
            <button
              type="button"
              data-testid="open-icon-catalog-btn"
              onClick={() => setIconCatalogOpen(true)}
              className="h-7 px-2.5 rounded border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-[11px] font-bold text-sky-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <Grid className="w-3 h-3" />
              <span>{t('statusUi.openIconCatalogBtn')}</span>
            </button>
          </div>
        </div>

        {/* Badge Layout A | B */}
        <div className="space-y-1.5">
          <div className="text-[12px] font-semibold text-slate-300">
            {t('statusUi.badgeLayoutLabel')}
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {(['B', 'A'] as StatusBadgeLayout[]).map((layoutOpt) => {
              const selected = statusSettings.badgeLayout === layoutOpt;
              return (
                <button
                  key={layoutOpt}
                  type="button"
                  data-testid={`status-badge-layout-${layoutOpt}`}
                  aria-pressed={selected}
                  onClick={() => updateStatusOverride({ badgeLayout: layoutOpt })}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-left text-[12px] font-semibold cursor-pointer transition-colors ${
                    selected
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {layoutOpt === 'A'
                    ? t('statusUi.badgeLayoutA')
                    : t('statusUi.badgeLayoutB')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Unit Status Area Rows (1..5), phone & desktop remembered separately */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-slate-300">
              {t('statusUi.unitRowsLabel')}
            </span>
            <span className="text-[11px] font-mono-nums text-slate-400">
              {isPhoneWidth
                ? t('statusUi.devicePhone')
                : t('statusUi.deviceDesktop')}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const activeVal = isPhoneWidth
                ? statusSettings.phoneRows
                : statusSettings.desktopRows;
              const selected = activeVal === n;
              return (
                <button
                  key={n}
                  type="button"
                  data-testid={`status-unit-rows-${n}`}
                  aria-pressed={selected}
                  onClick={() =>
                    updateStatusOverride(
                      isPhoneWidth ? { phoneRows: n } : { desktopRows: n }
                    )
                  }
                  className={`min-h-[36px] rounded-lg border font-mono-nums text-[12px] font-bold cursor-pointer ${
                    selected
                      ? 'border-sky-400 bg-sky-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            {t('statusUi.phoneRowsNote')}
          </p>
        </div>

        {/* Player Status Bar Rows (1..2), phone & desktop remembered separately */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-slate-300">
              {t('statusUi.playerRowsLabel')}
            </span>
            <span className="text-[11px] font-mono-nums text-slate-400">
              {isPhoneWidth
                ? t('statusUi.devicePhone')
                : t('statusUi.deviceDesktop')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[1, 2].map((n) => {
              const activeVal = isPhoneWidth
                ? statusSettings.playerPhoneRows
                : statusSettings.playerDesktopRows;
              const selected = activeVal === n;
              return (
                <button
                  key={n}
                  type="button"
                  data-testid={`status-player-rows-${n}`}
                  aria-pressed={selected}
                  onClick={() =>
                    updateStatusOverride(
                      isPhoneWidth
                        ? { playerPhoneRows: n }
                        : { playerDesktopRows: n }
                    )
                  }
                  className={`min-h-[36px] rounded-lg border font-mono-nums text-[12px] font-bold cursor-pointer ${
                    selected
                      ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. "Test effects" button & compact live preview box */}
      <div className="space-y-2 pt-0.5">
        <button
          type="button"
          data-testid="effects-test-btn"
          onClick={handleTestEffects}
          className="w-full min-h-[42px] px-3.5 rounded-lg border border-emerald-400/60 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-[13px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Play className="w-4 h-4 text-emerald-300" />
          <span>{t('fx.testBtn')}</span>
        </button>

        <div
          data-testid="effects-preview-box"
          data-reduced-motion={resolvedReducedMotion ? 'true' : 'false'}
          data-effects-mode={fxSettings.effectsMode}
          className="relative h-[86px] rounded-lg border border-slate-700/90 bg-[#050912] overflow-hidden select-none"
        >
          {/* Left Ally preview token (shared StageToken) */}
          <StageToken
            code="A1"
            label={t('fx.previewAlly')}
            side="ally"
            className="absolute left-[18%] top-1/2 -translate-x-1/2 -translate-y-1/2"
          />

          {/* Right Enemy preview token (shared StageToken) */}
          <StageToken
            code="E1"
            label={t('fx.previewEnemy')}
            side="enemy"
            className="absolute left-[82%] top-1/2 -translate-x-1/2 -translate-y-1/2"
          />

          {!previewActive && (
            <div className="absolute inset-x-3 bottom-1 text-center text-[11px] text-slate-500 truncate pointer-events-none">
              {t('fx.previewHint')}
            </div>
          )}

          {/* Active sample effects (uses shared StageProjectile & the same CSS animation classes as BattleRadarView/BattleVfxOverlay) */}
          {previewActive && (
            <div
              key={previewRunId}
              data-testid="effects-preview-stage"
              className="pointer-events-none absolute inset-0"
            >
              {/* Sample Projectile (travel bolt or short fade marker when reducedMotion=true) */}
              {previewConfig.showProjectiles && (
                <StageProjectile
                  testId="preview-fx-projectile"
                  reducedMotion={previewConfig.reducedMotion}
                  color="#38bdf8"
                  coreColor="#e0f2fe"
                  durationMs={previewConfig.reducedMotion ? 340 : 460}
                  left={previewConfig.reducedMotion ? '24%' : '22%'}
                  reducedWidth="52%"
                  travelPx={170}
                />
              )}

              {/* Sample Hit Flash on Enemy */}
              {previewConfig.showMainImpactOrHeal && (
                <div
                  data-testid="preview-fx-hit"
                  className="vfx-hit-flash-html absolute rounded-full"
                  style={
                    {
                      left: '82%',
                      top: '50%',
                      width: '38px',
                      height: '38px',
                      marginLeft: '-19px',
                      marginTop: '-19px',
                      border: '2.5px solid #fef08a',
                      backgroundColor: 'rgba(254, 240, 138, 0.28)',
                      animationDelay: previewConfig.reducedMotion ? '0ms' : '200ms',
                      '--vfx-dur': '320ms',
                    } as CSSProperties
                  }
                />
              )}

              {/* Sample Damage Number on Enemy */}
              {previewConfig.showFloatingNumbers && (
                <div
                  data-testid="preview-fx-damage"
                  className="anim-popup absolute font-display font-bold text-[15px] text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap"
                  style={{
                    left: '82%',
                    top: '22%',
                    animationDelay: previewConfig.reducedMotion ? '0ms' : '160ms',
                    animationDuration: '1100ms',
                  }}
                >
                  -245 CRIT
                </div>
              )}

              {/* Sample Heal Popup on Ally */}
              {previewConfig.showFloatingNumbers && (
                <div
                  data-testid="preview-fx-heal"
                  className="anim-popup absolute font-display font-bold text-[14px] text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap"
                  style={{
                    left: '18%',
                    top: '22%',
                    animationDelay: '60ms',
                    animationDuration: '1100ms',
                  }}
                >
                  +180 HP
                </div>
              )}

              {/* Sample Buff Popup on Ally */}
              {previewConfig.showFloatingNumbers && (
                <div
                  data-testid="preview-fx-buff"
                  className="anim-popup-tight absolute font-display font-bold text-[12px] px-1.5 rounded bg-[#050a12]/85 border border-emerald-400/70 text-emerald-200 whitespace-nowrap"
                  style={{
                    left: '48%',
                    top: '22%',
                    animationDelay: '120ms',
                    animationDuration: '1100ms',
                  }}
                >
                  ▲ +ATK 30%
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <IconCatalogPreviewModal
        open={iconCatalogOpen}
        onClose={() => setIconCatalogOpen(false)}
        badgeLayout={statusSettings.badgeLayout}
      />
    </div>
  );
}
