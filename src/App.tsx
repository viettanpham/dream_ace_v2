import { useEffect } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AutoTacticsModal } from './components/AutoTacticsModal';
import { BattleScreen } from './components/BattleScreen';
import {
  CloudConflictDialog,
  UnlockCloudPinDialog,
} from './components/CloudSaveDialogs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HangarScreen } from './components/HangarScreen';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import { attachCloudAutosaveListeners } from './store/useCloudSaveStore';
import { ENABLE_ADMIN_CP, useGameStore } from './store/useGameStore';
import { useBattleLayoutMode } from './utils/battleDisplay';
import { installGlobalErrorCapture } from './utils/errorLog';

function AppShell() {
  const screen = useGameStore((s) => s.screen);
  const adminPanelOpen = useGameStore((s) => s.adminPanelOpen);
  const tacticsModalOpen = useGameStore((s) => s.tacticsModalOpen);
  const toggleAdminPanel = useGameStore((s) => s.toggleAdminPanel);
  const unlockAdminMode = useGameStore((s) => s.unlockAdminMode);
  const setAdminPanelOpen = useGameStore((s) => s.setAdminPanelOpen);
  const setTacticsModalOpen = useGameStore((s) => s.setTacticsModalOpen);
  const reloadBattle = useGameStore((s) => s.reloadBattle);
  const battleSectorId = useGameStore((s) => s.battle?.sectorId);
  const layoutMode = useBattleLayoutMode();
  const isPhoneBattle = screen === 'BATTLE' && layoutMode === 'phone-portrait';

  // Global error ring buffer + Admin CP activation: Ctrl+Shift+A or ?admin=1 (persisted)
  useEffect(() => {
    installGlobalErrorCapture();

    if (ENABLE_ADMIN_CP) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === '1') {
        unlockAdminMode(true);
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ENABLE_ADMIN_CP &&
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 'a'
      ) {
        e.preventDefault();
        toggleAdminPanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [unlockAdminMode, toggleAdminPanel]);

  // Cloud save autosave (after every battle + when repeat loop ends, max 1/30s, auto-retry on online)
  useEffect(() => {
    return attachCloudAutosaveListeners();
  }, []);

  if (screen === 'TITLE') {
    return (
      <div className="h-[100dvh] w-full overflow-hidden">
        <TitleScreen />
        <ErrorBoundary
          variant="panel"
          title="Admin Panel"
          resetKey={adminPanelOpen}
          onClose={() => setAdminPanelOpen(false)}
        >
          <AdminPanel />
        </ErrorBoundary>
        <CloudConflictDialog />
        <UnlockCloudPinDialog />
      </div>
    );
  }

  return (
    <div
      className={
        isPhoneBattle
          ? 'min-h-[100dvh] w-full flex flex-col bg-[#080C12] text-slate-100'
          : 'h-[100dvh] w-full overflow-hidden flex flex-col bg-[#080C12] text-slate-100'
      }
    >
      <TopHud />
      {(screen === 'HANGAR' || screen === 'SHOP') && <HangarScreen />}
      {screen === 'BATTLE' && (
        <ErrorBoundary
          variant="global"
          onReloadBattle={() => reloadBattle(battleSectorId)}
        >
          <BattleScreen />
        </ErrorBoundary>
      )}

      <ErrorBoundary
        variant="panel"
        title="Auto Tactics"
        resetKey={tacticsModalOpen}
        onClose={() => setTacticsModalOpen(false)}
        onReloadBattle={
          screen === 'BATTLE' ? () => reloadBattle(battleSectorId) : undefined
        }
      >
        <AutoTacticsModal />
      </ErrorBoundary>

      <ErrorBoundary
        variant="panel"
        title="Admin Panel"
        resetKey={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
        onReloadBattle={
          screen === 'BATTLE' ? () => reloadBattle(battleSectorId) : undefined
        }
      >
        <AdminPanel />
      </ErrorBoundary>

      <CloudConflictDialog />
      <UnlockCloudPinDialog />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary variant="global">
      <AppShell />
    </ErrorBoundary>
  );
}
