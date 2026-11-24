import { useEffect, useRef, useState } from 'react';
import { CloudDownload, HardDrive, Sliders, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { MECH_CLASS_LIST } from '../data/classes';
import {
  getClassCode,
  getClassDesc,
  getClassName,
  getClassRole,
  useI18n,
} from '../i18n';
import { useCloudSaveStore } from '../store/useCloudSaveStore';
import { ENABLE_ADMIN_CP, useGameStore } from '../store/useGameStore';
import type { MechClassId } from '../types/game';
import { getNextPerfMode, usePerfMode, type PerfMode } from '../utils/perfPrefs';
import { BottomSheet } from './BottomSheet';
import { OpenRemoteSaveDialog } from './CloudSaveDialogs';
import { CloudSaveSection } from './CloudSaveSection';
import { FighterSvg } from './FighterSvg';
import { LanguageToggle } from './LanguageToggle';
import { SaveTransferSection } from './SaveTransferSection';

function getPerfModeLabelKey(mode: PerfMode) {
  if (mode === 'low') return 'perf.modeLow' as const;
  if (mode === 'full') return 'perf.modeFull' as const;
  return 'perf.modeAuto' as const;
}

export function TitleScreen() {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const hasSaveData = useGameStore((s) => s.hasSaveData);
  const muted = useGameStore((s) => s.muted);
  const adminUnlocked = useGameStore((s) => s.adminUnlocked);
  const startCampaign = useGameStore((s) => s.startCampaign);
  const continueCampaign = useGameStore((s) => s.continueCampaign);
  const resetCampaign = useGameStore((s) => s.resetCampaign);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const unlockAdminMode = useGameStore((s) => s.unlockAdminMode);
  const toggleAdminPanel = useGameStore((s) => s.toggleAdminPanel);

  const [confirmReset, setConfirmReset] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [openRemoteModalOpen, setOpenRemoteModalOpen] = useState(false);
  const [perfMode, setPerfMode] = usePerfMode();
  const perfModeLabel = t(getPerfModeLabelKey(perfMode));
  const cloudConfigured = useCloudSaveStore((s) => s.isConfigured)();
  const [newPilotName, setNewPilotName] = useState(pilot.name || 'Kira');
  const [starterClass, setStarterClass] = useState<MechClassId>(
    pilot.activeGearId || 'striker'
  );
  const logoTapsRef = useRef(0);
  const lastLogoTapRef = useRef(0);

  const handleTitleTap = () => {
    if (!ENABLE_ADMIN_CP) return;
    const now = Date.now();
    if (now - lastLogoTapRef.current > 2500) {
      logoTapsRef.current = 0;
    }
    lastLogoTapRef.current = now;
    logoTapsRef.current += 1;
    if (logoTapsRef.current >= 7) {
      logoTapsRef.current = 0;
      unlockAdminMode(true);
    }
  };

  const activeGear = pilot.gears[pilot.activeGearId];
  const ownedCount = MECH_CLASS_LIST.filter((c) => pilot.gears[c.id].owned).length;
  const totalWins = MECH_CLASS_LIST.reduce(
    (sum, c) => sum + pilot.gears[c.id].battlesWon,
    0
  );
  const heroClassId = hasSaveData ? pilot.activeGearId : starterClass;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'm') {
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleMute]);

  return (
    <div className="relative h-full w-full overflow-y-auto bg-tactical-grid flex flex-col justify-between">
      {/* Deep-Space Orbital Radar Static SVG Backdrop */}
      <svg
        viewBox="0 0 1200 720"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-35"
        aria-hidden="true"
      >
        <g transform="translate(860, 360)">
          <circle r="130" stroke="#334155" strokeWidth="1" fill="none" />
          <circle
            r="230"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="6 6"
            fill="none"
          />
          <circle r="335" stroke="#1E293B" strokeWidth="1" fill="none" />
          <line x1="-380" y1="0" x2="380" y2="0" stroke="#1E293B" strokeWidth="1" />
          <line x1="0" y1="-380" x2="0" y2="380" stroke="#1E293B" strokeWidth="1" />
        </g>
      </svg>

      {/* CSS-only Orbital Radar Sweep (compositor layer, no SVG transform) */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden opacity-35"
        aria-hidden="true"
      >
        <div
          className="absolute left-[71.67%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(56vw,93dvh)] aspect-square rounded-full anim-radar"
          style={{
            willChange: 'transform',
            background:
              'conic-gradient(from 60deg, transparent 0deg, transparent 330deg, rgba(56, 189, 248, 0.18) 360deg)',
          }}
        />
      </div>

      {/* Top Controls */}
      <div className="relative z-10 flex items-center justify-end gap-2 px-4 sm:px-6 pt-4 pt-safe">
        {ENABLE_ADMIN_CP && adminUnlocked && (
          <button
            type="button"
            onClick={toggleAdminPanel}
            className="min-h-[44px] sm:min-h-0 sm:h-9 px-3 inline-flex items-center gap-1.5 rounded-lg sm:rounded border border-amber-500/60 bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-300 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('admin.btnLabel')}</span>
          </button>
        )}
        <button
          type="button"
          data-testid="title-save-transfer-btn"
          onClick={() => setSaveSheetOpen(true)}
          className="min-h-[44px] sm:min-h-0 sm:h-9 px-3 inline-flex items-center gap-2 rounded-lg sm:rounded border border-slate-800 bg-[#0E1520]/90 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
        >
          <HardDrive className="w-4 h-4 text-sky-400" />
          <span>{t('save.titleManageBtn')}</span>
        </button>
        <LanguageToggle />
        <button
          type="button"
          data-testid="title-perf-mode-btn"
          onClick={() => setPerfMode(getNextPerfMode(perfMode))}
          title={t('perf.toggleTitle', { mode: perfModeLabel })}
          aria-label={t('perf.toggleTitle', { mode: perfModeLabel })}
          className="min-h-[44px] sm:min-h-0 sm:h-9 px-3 inline-flex items-center gap-1.5 rounded-lg sm:rounded border border-slate-800 bg-[#0E1520]/90 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>
            {t('perf.label')}: <strong className="text-slate-100">{perfModeLabel}</strong>
          </span>
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? t('common.unmuteTitle') : t('common.muteTitle')}
          className="min-h-[44px] sm:min-h-0 sm:h-9 px-3.5 inline-flex items-center gap-2 rounded-lg sm:rounded border border-slate-800 bg-[#0E1520]/90 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
        >
          {muted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {muted ? t('common.audioMuted') : t('common.audioOn')}
          </span>
        </button>
      </div>

      <BottomSheet
        open={saveSheetOpen}
        onClose={() => setSaveSheetOpen(false)}
        title={t('save.sectionTitle')}
        subtitle={t('app.saveHint')}
      >
        <div className="space-y-4">
          <CloudSaveSection />
          <SaveTransferSection />
        </div>
      </BottomSheet>

      <OpenRemoteSaveDialog
        open={openRemoteModalOpen}
        onClose={() => setOpenRemoteModalOpen(false)}
      />

      {/* Center Composition */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-10 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left: Title & Pilot Creation / Continue */}
        <div className="lg:col-span-7 space-y-5">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-xs font-medium tracking-[0.18em] text-amber-400 uppercase">
              <span>{t('app.subtitle')}</span>
            </div>
            <h1
              onClick={handleTitleTap}
              className="font-display text-5xl sm:text-7xl font-bold tracking-tight text-slate-50 leading-[0.94] select-none cursor-pointer"
            >
              {t('app.title')}
            </h1>
            <p className="max-w-xl text-sm sm:text-base text-slate-300 leading-relaxed">
              {t('app.tagline')}
            </p>
          </div>

          {hasSaveData ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-300 pt-1">
                <span className="text-slate-400">{t('title.savedPilot')}</span>
                <span className="font-semibold text-slate-100">
                  {pilot.name || 'Vance'}
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono-nums text-amber-400">
                  {getClassName(lang, activeGear.classId)}{' '}
                  {t('common.levelShort')}
                  {activeGear.level}
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono-nums">{ownedCount}/4 Gears</span>
                <span className="text-slate-600">·</span>
                <span className="font-mono-nums">
                  {pilot.credits.toLocaleString()} CR
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono-nums">
                  {t('title.winsCount', { count: totalWins })}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={continueCampaign}
                  className="h-12 px-8 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-sm tracking-wide rounded transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('title.continue')}
                </button>

                <button
                  type="button"
                  data-testid="title-open-remote-save-btn"
                  disabled={!cloudConfigured}
                  onClick={() => setOpenRemoteModalOpen(true)}
                  title={
                    cloudConfigured
                      ? t('cloud.openRemoteBtn')
                      : t('cloud.notConfigured')
                  }
                  className="h-12 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-sky-500/45 disabled:border-slate-800 text-sky-200 disabled:text-slate-500 font-medium text-sm rounded transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <CloudDownload className="w-4 h-4 shrink-0" />
                  <span>{t('cloud.openRemoteBtn')}</span>
                </button>

                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="h-12 px-5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 font-medium text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t('title.newCampaign')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-900 border border-red-500/40 rounded px-3 py-1.5">
                    <span className="text-xs text-red-300">
                      {t('title.erasePrompt')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        resetCampaign();
                      }}
                      className="h-8 px-3 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
                    >
                      {t('title.confirmReset')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="h-8 px-2.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Pilot Creation: Name + Choose 1 Starter Gear */
            <div className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-4 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-100">
                  {t('title.createHeading')}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('title.starterHint')}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="starter-pilot-name"
                  className="block text-xs text-slate-400"
                >
                  {t('hangar.callsign')}
                </label>
                <input
                  id="starter-pilot-name"
                  type="text"
                  maxLength={18}
                  value={newPilotName}
                  onChange={(e) => setNewPilotName(e.target.value)}
                  placeholder={t('hangar.callsignPlaceholder')}
                  className="w-full sm:max-w-xs min-h-[44px] px-3 rounded border border-slate-700 bg-[#080C14] text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MECH_CLASS_LIST.map((cls) => {
                  const selected = starterClass === cls.id;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setStarterClass(cls.id)}
                      className={`min-h-[56px] p-2.5 rounded-lg border text-left transition-colors cursor-pointer space-y-1 ${
                        selected
                          ? 'border-amber-400 bg-amber-500/15'
                          : 'border-slate-800 bg-[#080C14] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display text-sm font-bold text-slate-100">
                          {getClassName(lang, cls.id)}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cls.accentHex }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {getClassRole(lang, cls.id)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-sm sm:text-xs text-slate-400">
                {getClassDesc(lang, starterClass)}
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => startCampaign(newPilotName, starterClass)}
                  className="w-full sm:w-auto min-h-[48px] px-8 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm tracking-wide rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('title.start')}
                </button>

                <button
                  type="button"
                  data-testid="title-open-remote-save-btn"
                  disabled={!cloudConfigured}
                  onClick={() => setOpenRemoteModalOpen(true)}
                  title={
                    cloudConfigured
                      ? t('cloud.openRemoteBtn')
                      : t('cloud.notConfigured')
                  }
                  className="w-full sm:w-auto min-h-[48px] px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-sky-500/45 disabled:border-slate-800 text-sky-200 disabled:text-slate-500 font-semibold text-sm rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <CloudDownload className="w-4 h-4 shrink-0" />
                  <span>{t('cloud.openRemoteBtn')}</span>
                </button>
              </div>
              {!cloudConfigured && (
                <p
                  data-testid="title-cloud-not-configured"
                  className="text-[11px] text-slate-500"
                >
                  {t('cloud.notConfigured')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Hovering Hero Fighter */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative flex flex-col items-center justify-center p-6">
            <div
              className="absolute inset-4 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0.05) 48%, transparent 74%)',
              }}
            />
            <FighterSvg
              classId={heroClassId}
              side="ally"
              facing="right"
              size="lg"
              heroHover
            />
            <div className="mt-3 text-center space-y-1">
              <div className="font-display text-xl font-semibold tracking-wide text-slate-100">
                {getClassCode(lang, heroClassId)}
              </div>
              <div className="text-xs text-slate-400">
                {t('title.classLine', {
                  className: getClassName(lang, heroClassId),
                  role: getClassRole(lang, heroClassId),
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Controls Hint */}
      <footer className="relative z-10 px-4 sm:px-6 pb-5 pb-safe flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span className="hidden sm:inline">{t('app.controlsHint')}</span>
        <span className="text-slate-500">{t('app.saveHint')}</span>
      </footer>
    </div>
  );
}
