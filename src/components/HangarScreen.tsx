import { useGameStore } from '../store/useGameStore';
import { GarageView } from './GarageView';
import { GearView } from './GearView';
import { MapView } from './MapView';
import { ShopScreen } from './ShopScreen';
import { SidebarNav } from './SidebarNav';
import { SkillView } from './SkillView';
import { WarehouseView } from './WarehouseView';

export function HangarScreen() {
  const activeTab = useGameStore((s) => s.activeTab);

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-tactical-grid overflow-hidden">
      <SidebarNav />
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden pb-[60px] md:pb-0">
        {activeTab === 'gear' && <GearView />}
        {activeTab === 'warehouse' && <WarehouseView />}
        {activeTab === 'garage' && <GarageView />}
        {activeTab === 'skill' && <SkillView />}
        {activeTab === 'shop' && <ShopScreen />}
        {activeTab === 'map' && <MapView />}
      </main>
    </div>
  );
}
