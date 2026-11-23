import {
  BarChart3,
  Flag,
  MessageSquare,
  Settings,
  Sliders,
  ZapOff,
} from 'lucide-react';
import type { TranslationKey } from '../i18n/en';
import { ENABLE_ADMIN_CP } from '../store/useGameStore';
import type { BattleSpeed } from '../types/game';
import { ALLOWED_BATTLE_SPEEDS } from '../utils/battleDisplay';
import { BottomSheet } from './BottomSheet';
import { EffectsSettingsPanel } from './EffectsSettingsPanel';

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

export interface BattleMoreActionsMenuConfig {
  open: boolean;
  sectorLabel: string;
  squadSize: number;
  hasSummary: boolean;
  battleSpeed: BattleSpeed;
  speechBubblesEnabled: boolean;
  skipAnimations: boolean;
  retreatConfirmOpen: boolean;
  t: TranslateFn;
  onClose: () => void;
  onSetBattleSpeed: (speed: BattleSpeed) => void;
  onOpenTactics: () => void;
  onToggleSpeechBubbles: () => void;
  onToggleSkipAnimations: () => void;
  onOpenStats: () => void;
  onSetRetreatConfirmOpen: (open: boolean) => void;
  onRetreatBattle: () => void;
  onToggleAdminPanel: () => void;
}

export interface BattleMoreActionsMenuProps {
  menu: BattleMoreActionsMenuConfig;
}

export function BattleMoreActionsMenu({ menu }: BattleMoreActionsMenuProps) {
  const {
    open,
    sectorLabel,
    squadSize,
    hasSummary,
    battleSpeed,
    speechBubblesEnabled,
    skipAnimations,
    retreatConfirmOpen,
    t,
    onClose,
    onSetBattleSpeed,
    onOpenTactics,
    onToggleSpeechBubbles,
    onToggleSkipAnimations,
    onOpenStats,
    onSetRetreatConfirmOpen,
    onRetreatBattle,
    onToggleAdminPanel,
  } = menu;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('battle.moreActions')}
      subtitle={`${sectorLabel} · ${squadSize}v${squadSize}`}
    >
      <div data-testid="battle-more-menu" className="space-y-4">
        {/* Full Speed Picker (1x - 30x) */}
        <div className="space-y-2">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            {t('battle.speedLabel')}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {ALLOWED_BATTLE_SPEEDS.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSetBattleSpeed(spd)}
                className={`min-h-[44px] rounded-lg border font-mono-nums text-[13px] font-bold cursor-pointer ${
                  battleSpeed === spd
                    ? 'border-sky-400 bg-sky-500 text-slate-950'
                    : 'border-slate-700 bg-slate-900 text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Visual Effects (Full/Compact/Off, Reduced Motion, Status Labels, Debug & Test Preview) */}
        <EffectsSettingsPanel compact />

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            data-testid="battle-more-tactics"
            onClick={() => {
              onClose();
              onOpenTactics();
            }}
            className="min-h-[44px] px-3.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-[13px] font-semibold flex items-center gap-2.5 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>{t('auto.tacticsBtn')}</span>
          </button>

          <button
            type="button"
            data-testid="battle-toggle-bubbles"
            onClick={onToggleSpeechBubbles}
            aria-pressed={speechBubblesEnabled}
            className={`min-h-[44px] px-3.5 rounded-lg border text-[13px] font-semibold flex items-center justify-between cursor-pointer ${
              speechBubblesEnabled
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              <span>{t('battle.speechBubbles')}</span>
            </span>
            <span className="font-mono-nums text-[12px]">
              {speechBubblesEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            data-testid="battle-toggle-skip-anim"
            onClick={onToggleSkipAnimations}
            aria-pressed={skipAnimations}
            className={`min-h-[44px] px-3.5 rounded-lg border text-[13px] font-semibold flex items-center justify-between cursor-pointer ${
              skipAnimations
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-slate-700 bg-slate-900 text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <ZapOff className="w-4 h-4 text-sky-400" />
              <span>{t('battle.skipAnim')}</span>
            </span>
            <span className="font-mono-nums text-[12px]">
              {skipAnimations ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            data-testid="battle-more-stats"
            onClick={() => {
              onClose();
              onOpenStats();
            }}
            className="min-h-[44px] px-3.5 rounded-lg border border-sky-500/45 bg-sky-500/12 text-sky-200 text-[13px] font-semibold flex items-center gap-2.5 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <span>
              {hasSummary ? t('stats.reportBtn') : t('stats.progressBtn')}
            </span>
          </button>

          {!hasSummary &&
            (retreatConfirmOpen ? (
              <div
                data-testid="battle-retreat-confirm-box"
                className="rounded-lg border border-red-500/60 bg-red-950/35 p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2 text-[13px] font-semibold text-red-100">
                  <Flag className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{t('battle.retreatConfirmTitle')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="battle-retreat-cancel"
                    onClick={() => onSetRetreatConfirmOpen(false)}
                    className="min-h-[40px] px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[13px] font-semibold cursor-pointer"
                  >
                    {t('battle.retreatCancelBtn')}
                  </button>
                  <button
                    type="button"
                    data-testid="battle-retreat-confirm"
                    onClick={() => {
                      onClose();
                      onRetreatBattle();
                    }}
                    className="min-h-[40px] px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold cursor-pointer"
                  >
                    {t('battle.retreatConfirmBtn')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-testid="battle-more-retreat"
                onClick={() => onSetRetreatConfirmOpen(true)}
                className="min-h-[44px] px-3.5 rounded-lg border border-red-500/45 bg-red-500/12 text-red-200 text-[13px] font-semibold flex items-center gap-2.5 cursor-pointer"
              >
                <Flag className="w-4 h-4 text-red-400" />
                <span>{t('battle.retreat')}</span>
              </button>
            ))}

          {ENABLE_ADMIN_CP && (
            <div className="pt-2 border-t border-slate-800/70">
              <button
                type="button"
                data-testid="battle-more-admin-btn"
                onClick={() => {
                  onClose();
                  onToggleAdminPanel();
                }}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-[12px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('statusUi.adminBtnMuted')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
