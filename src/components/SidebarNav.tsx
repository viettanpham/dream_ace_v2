import {
  Map,
  Rocket,
  ShoppingBag,
  Sparkles,
  Warehouse,
  Wrench,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type { BaseTab } from '../types/game';

const SIDEBAR_ITEMS: Array<{
  id: BaseTab;
  labelKey:
    | 'sidebar.gear'
    | 'sidebar.garage'
    | 'sidebar.skill'
    | 'sidebar.shop'
    | 'sidebar.map';
  icon: typeof Wrench;
}> = [
  { id: 'gear', labelKey: 'sidebar.gear', icon: Wrench },
  { id: 'garage', labelKey: 'sidebar.garage', icon: Warehouse },
  { id: 'skill', labelKey: 'sidebar.skill', icon: Sparkles },
  { id: 'shop', labelKey: 'sidebar.shop', icon: ShoppingBag },
  { id: 'map', labelKey: 'sidebar.map', icon: Map },
];

export function SidebarNav() {
  const { t } = useI18n();
  const activeTab = useGameStore((s) => s.activeTab);
  const pilot = useGameStore((s) => s.pilot);
  const setActiveTab = useGameStore((s) => s.setActiveTab);
  const startBattle = useGameStore((s) => s.startBattle);

  const activeGear = pilot.gears[pilot.activeGearId];
  const unspentPoints = activeGear.unspentPoints;

  return (
    <>
      {/* Desktop / Tablet Left Sidebar (>= 768px) */}
      <aside className="hidden md:flex shrink-0 border-r border-slate-800/90 bg-[#090D15]/95 w-44 flex-col justify-between gap-2 p-3">
        <nav className="flex flex-col gap-1.5" aria-label="Base navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-11 px-3 rounded border text-left text-sm font-medium transition-colors cursor-pointer flex items-center justify-between gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800/95 border-amber-400/75 text-slate-50 font-semibold'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-900/80 hover:text-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <span>{t(item.labelKey)}</span>
                </span>

                {item.id === 'garage' && unspentPoints > 0 && (
                  <span className="font-mono-nums text-[11px] font-bold text-emerald-400">
                    +{unspentPoints}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Sortie Launch CTA */}
        <div className="shrink-0 pt-3 border-t border-slate-800/80 flex items-center">
          <button
            type="button"
            onClick={() => startBattle()}
            className="h-11 w-full px-3.5 inline-flex items-center justify-center gap-2 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-xs tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            <Rocket className="w-4 h-4 shrink-0" />
            <span>{t('nav.deploy')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Fixed Bottom Tab Bar (< 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-800/95 bg-[#090E18]/98 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative min-w-0 min-h-[56px] py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-slate-400 active:bg-slate-800/70'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-2 h-0.5 bg-amber-400 rounded-b" />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.id === 'garage' && unspentPoints > 0 && (
                    <span className="absolute -top-1.5 -right-3 px-1 min-w-[16px] h-4 rounded-full bg-emerald-500 text-slate-950 font-mono-nums text-[10px] font-bold flex items-center justify-center">
                      {unspentPoints}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold leading-tight truncate max-w-full">
                  {t(item.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
