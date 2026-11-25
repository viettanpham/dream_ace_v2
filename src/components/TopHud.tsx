import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Radar,
  Rocket,
  Settings,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { isAnyCheatActive } from '../engine/inventory';
import { getExpForNextLevel } from '../engine/stats';
import { getClassName, useI18n } from '../i18n';
import { ENABLE_ADMIN_CP, useGameStore } from '../store/useGameStore';
import {
  formatShortUnitName,
  useBattleLayoutMode,
} from '../utils/battleDisplay';
import { BottomSheet } from './BottomSheet';
import { CloudSaveSection } from './CloudSaveSection';
import { EffectsSettingsPanel } from './EffectsSettingsPanel';
import { LanguageToggle } from './LanguageToggle';
import { SaveTransferSection } from './SaveTransferSection';
import { StatBar } from './StatBar';

type LeaveDestination = 'TITLE' | 'HANGAR';

export function TopHud() {
  const { lang, t } = useI18n();
  const screen = useGameStore((s) => s.screen);
  const battle = useGameStore((s) => s.battle);
  const pilot = useGameStore((s) => s.pilot);
  const muted = useGameStore((s) => s.muted);
  const battleViewMode = useGameStore((s) => s.battleViewMode);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const setScreen = useGameStore((s) => s.setScreen);
  const returnToHangar = useGameStore((s) => s.returnToHangar);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const startBattle = useGameStore((s) => s.startBattle);
  const setBattleViewMode = useGameStore((s) => s.setBattleViewMode);
  const toggleAdminPanel = useGameStore((s) => s.toggleAdminPanel);

  const layoutMode = useBattleLayoutMode();
  const isPhoneBattle = screen === 'BATTLE' && layoutMode === 'phone-portrait';
  const isBattleActive = screen === 'BATTLE' && Boolean(battle && !battle.summary);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveConfirmDest, setLeaveConfirmDest] =
    useState<LeaveDestination | null>(null);

  // Dismiss leave-battle dialog on Escape
  useEffect(() => {
    if (!leaveConfirmDest) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLeaveConfirmDest(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [leaveConfirmDest]);

  const requestExitBattle = (dest: LeaveDestination) => {
    if (isBattleActive) {
      setLeaveConfirmDest(dest);
      return;
    }
    if (dest === 'HANGAR') {
      returnToHangar();
    } else {
      setScreen('TITLE');
    }
  };

  const confirmExitBattle = () => {
    const dest = leaveConfirmDest;
    setLeaveConfirmDest(null);
    if (!dest) return;
    returnToHangar();
    if (dest === 'TITLE') {
      setScreen('TITLE');
    }
  };

  const handleBrandTap = () => {
    // During an active battle, tapping the logo MUST ALWAYS show confirm dialog and never exit immediately.
    if (isBattleActive) {
      setLeaveConfirmDest('HANGAR');
      return;
    }

    setScreen('TITLE');
  };

  const activeGear = pilot.gears[pilot.activeGearId];
  const expNeeded = getExpForNextLevel(activeGear.level);
  const cheatsActive = isAnyCheatActive(adminConfig);
  const showAdminBtn = ENABLE_ADMIN_CP;
  const effectiveDefaultMode =
    battleViewMode ?? (layoutMode === 'phone-portrait' ? 'radar' : 'card');

  return (
    <>
      {isPhoneBattle ? (
        /* SLIM PHONE BATTLE TOP BAR (max 48px, zero overlap, >=44px tap targets) */
        <header
          data-testid="tophud-phone-battle"
          className="h-12 max-h-[48px] shrink-0 border-b border-slate-800/90 bg-[#0A0F18]/95 px-2 flex items-center justify-between gap-2"
        >
          {/* Left: Compact Logo Mark (confirms before leaving battle) */}
          <button
            type="button"
            data-testid="tophud-brand-logo"
            onClick={handleBrandTap}
            aria-label={t('battle.leaveTitle')}
            title={t('battle.leaveTitle')}
            className="min-w-[44px] min-h-[44px] px-2 inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 hover:border-amber-400/60 text-amber-400 font-display text-[15px] font-bold tracking-wider shrink-0 cursor-pointer select-none"
          >
            DA
          </button>

          {/* Middle: Pilot Name + Active Gear */}
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2 text-[13px] leading-none">
            <span className="font-semibold text-slate-100 truncate">
              {formatShortUnitName(pilot.name || 'Vance', 10)}
            </span>
            <span className="text-slate-600 shrink-0">·</span>
            <span className="font-mono-nums font-bold text-amber-400 whitespace-nowrap shrink-0">
              {getClassName(lang, activeGear.classId)} {t('common.levelShort')}
              {activeGear.level}
            </span>
          </div>

          {/* Right: Menu Button */}
          <button
            type="button"
            data-testid="tophud-menu-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label={t('battle.menuTitle')}
            title={t('battle.menuTitle')}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-slate-200 shrink-0 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>
      ) : (
        /* STANDARD TOP BAR (Hangar / Shop / Tablet & PC Battle) */
        <header
          data-testid="tophud-standard"
          className={`${
            screen === 'BATTLE' ? 'h-12 max-h-[48px]' : 'min-h-[52px] md:h-14'
          } pt-safe shrink-0 border-b border-slate-800/90 bg-[#0A0F18]/95 px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-4`}
        >
          {/* Left: Brand Wordmark + Mobile Pilot+Gear */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              data-testid="tophud-brand-logo"
              onClick={handleBrandTap}
              className="inline-flex items-center min-h-[40px] md:min-h-0 font-display text-sm sm:text-lg md:text-xl font-bold tracking-[0.08em] md:tracking-[0.12em] text-slate-50 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
            >
              {t('app.title')}
            </button>

            {/* Compact Pilot + Gear Lv on narrow non-battle screens */}
            <div className="flex md:hidden items-center gap-1 min-w-0 text-left">
              <span className="font-semibold text-[13px] text-slate-200 truncate max-w-[72px]">
                {pilot.name || 'Vance'}
              </span>
              <span className="font-mono-nums text-[12px] font-bold text-amber-400 whitespace-nowrap">
                {getClassName(lang, activeGear.classId).slice(0, 3).toUpperCase()}{' '}
                {t('common.levelShort')}
                {activeGear.level}
              </span>
            </div>
          </div>

          {/* Center: Desktop full info / Credits & WP */}
          <div className="flex items-center gap-2.5 sm:gap-5 text-[13px] text-slate-300 min-w-0">
            <div className="hidden md:flex items-center gap-2 whitespace-nowrap min-w-0">
              <span className="text-slate-400">{t('common.pilot')}:</span>
              <span className="font-semibold text-slate-100">
                {pilot.name || 'Vance'}
              </span>
              <span className="font-mono-nums font-semibold text-amber-400">
                [{getClassName(lang, activeGear.classId)} {t('common.levelShort')}
                {activeGear.level}]
              </span>
              {screen !== 'BATTLE' && (
                <div className="hidden lg:block w-16">
                  <StatBar
                    value={activeGear.exp}
                    max={expNeeded}
                    valueText=""
                    fillClassName="bg-amber-400"
                    trackClassName="bg-slate-800"
                    heightClassName="h-1.5"
                    showTrail={false}
                    title={`${activeGear.exp} / ${expNeeded} EXP`}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="hidden md:inline text-slate-400">
                {t('common.credits')}
              </span>
              <span className="font-mono-nums text-[13px] font-semibold text-amber-300">
                {pilot.credits.toLocaleString()}
              </span>
              <span className="text-[12px] text-slate-400">CR</span>
            </div>

            <div
              className="hidden sm:flex items-center gap-1 whitespace-nowrap"
              title={t('common.warPoints')}
            >
              <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="font-mono-nums font-semibold text-purple-300">
                {(pilot.warPoints ?? 0).toLocaleString()}
              </span>
              <span className="text-[12px] text-purple-400/80">
                {t('common.wpShort')}
              </span>
            </div>
          </div>

          {/* Right: Return (when in Battle), Admin, VI | EN Toggle, Audio & Settings Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {screen === 'BATTLE' && (
              <button
                type="button"
                data-testid="tophud-return-hangar"
                onClick={() => requestExitBattle('HANGAR')}
                className="min-h-[40px] md:min-h-0 md:h-9 px-2.5 sm:px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-medium text-[13px] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('nav.returnHangar')}
              </button>
            )}

            {showAdminBtn && (
              <button
                type="button"
                data-testid="tophud-admin-btn"
                onClick={toggleAdminPanel}
                aria-label={t('admin.title')}
                title={t('admin.title')}
                className="hidden md:flex md:h-9 md:w-9 items-center justify-center rounded border border-amber-500/60 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 cursor-pointer shrink-0 transition-colors"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t('common.unmuteTitle') : t('common.muteTitle')}
              title={muted ? t('common.unmuteTitle') : t('common.muteTitle')}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              data-testid="tophud-settings-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('mobile.settings')}
              title={t('mobile.settingsTitle')}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:h-9 md:px-2.5 flex items-center justify-center gap-1.5 rounded-lg md:rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden lg:inline text-[12px] font-semibold">
                {t('fx.sectionTitle')}
              </span>
            </button>
          </div>
        </header>
      )}

      {/* Leave Battle Confirmation Dialog */}
      {leaveConfirmDest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-battle-dialog-title"
          data-testid="leave-battle-dialog"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-[#0D1420] p-4 space-y-4 shadow-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h2
                  id="leave-battle-dialog-title"
                  className="font-display text-[20px] font-bold text-slate-50 leading-tight"
                >
                  {t('battle.leaveTitle')}
                </h2>
              </div>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                {t('battle.leaveMessage')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="leave-battle-cancel"
                onClick={() => setLeaveConfirmDest(null)}
                className="min-h-[44px] px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-[13px] cursor-pointer"
              >
                {t('battle.leaveCancel')}
              </button>
              <button
                type="button"
                data-testid="leave-battle-confirm"
                onClick={confirmExitBattle}
                className="min-h-[44px] px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-[13px] cursor-pointer"
              >
                {t('battle.leaveConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Settings & Quick Actions Bottom Sheet */}
      <BottomSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        size="large"
        title={screen === 'BATTLE' ? t('battle.menuTitle') : t('mobile.settingsTitle')}
        subtitle={`${pilot.name || 'Vance'} · ${getClassName(
          lang,
          activeGear.classId
        )} ${t('common.levelShort')}${activeGear.level}`}
      >
        <div className="space-y-4">
          {/* Quick Resource Readout */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/70">
              <div className="text-[12px] text-slate-400">{t('common.credits')}</div>
              <div className="font-mono-nums text-[15px] font-bold text-amber-300 mt-0.5">
                {pilot.credits.toLocaleString()} CR
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/70">
              <div className="text-[12px] text-slate-400">
                {t('common.warPoints')}
              </div>
              <div className="font-mono-nums text-[15px] font-bold text-purple-300 mt-0.5 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-purple-400" />
                {(pilot.warPoints ?? 0).toLocaleString()} {t('common.wpShort')}
              </div>
            </div>
          </div>

          {/* Language Toggle Row */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/50">
            <span className="text-[13px] font-medium text-slate-300">
              Language / Ngôn ngữ
            </span>
            <LanguageToggle />
          </div>

          {/* Primary Sortie Action when in Base */}
          {screen !== 'BATTLE' && (
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                startBattle();
              }}
              className="w-full min-h-[48px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-[15px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Rocket className="w-4 h-4" />
              <span>{t('nav.deploy')}</span>
            </button>
          )}

          {/* Combat View Preference */}
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              {t('battle.viewModeLabel')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBattleViewMode('radar')}
                className={`min-h-[44px] px-3 rounded-lg border text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  effectiveDefaultMode === 'radar'
                    ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                <Radar className="w-4 h-4" />
                <span>{t('battle.viewRadar')}</span>
              </button>
              <button
                type="button"
                onClick={() => setBattleViewMode('card')}
                className={`min-h-[44px] px-3 rounded-lg border text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  effectiveDefaultMode === 'card'
                    ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>{t('battle.viewCard')}</span>
              </button>
            </div>
          </div>

          {/* Effects Settings (Full/Compact/Off, Reduced Motion, Status Labels, Debug & Test Preview) */}
          <EffectsSettingsPanel />

          {/* Cloud Save (PIN-encrypted cross-device sync) */}
          <CloudSaveSection />

          {/* Portable Save Export / Import with Optional PIN */}
          <SaveTransferSection />

          {/* Utility Buttons */}
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="min-h-[44px] px-3.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[13px] font-medium flex items-center justify-between cursor-pointer"
            >
              <span className="inline-flex items-center gap-2.5">
                {muted ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>
                  {muted ? t('common.audioMuted') : t('common.audioOn')}
                </span>
              </span>
            </button>

            {screen === 'BATTLE' && (
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  requestExitBattle('HANGAR');
                }}
                className="min-h-[44px] px-3.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-200 text-[13px] font-semibold flex items-center gap-2.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>{t('nav.returnHangar')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                requestExitBattle('TITLE');
              }}
              className="min-h-[44px] px-3.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[13px] font-medium flex items-center gap-2.5 cursor-pointer"
            >
              <Home className="w-4 h-4 text-slate-400" />
              <span>{t('app.title')}</span>
            </button>

            {ENABLE_ADMIN_CP && (
              <div className="pt-2 border-t border-slate-800/70">
                <button
                  type="button"
                  data-testid="tophud-settings-admin-btn"
                  onClick={() => {
                    setSettingsOpen(false);
                    toggleAdminPanel();
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
    </>
  );
}
