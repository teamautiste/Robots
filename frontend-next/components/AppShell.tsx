'use client';

import AppHeader from '@/components/AppHeader';
import UpsBanner from '@/components/UpsBanner';
import MainTab from '@/components/tabs/MainTab';
import JoggingTab from '@/components/tabs/JoggingTab';
import ConfigTab from '@/components/tabs/ConfigTab';
import { useAppStore } from '@/hooks/useAppStore';
import { useSocket } from '@/hooks/useSocket';
import { useRobots } from '@/hooks/useRobots';

const TABS = [
  { id: 'main',     label: '▶ Main' },
  { id: 'jogging',  label: '🕹 Jogging' },
  { id: 'config',   label: '⚙ Configuración' },
] as const;

export default function AppShell() {
  useSocket();   // establishes WebSocket connection and dispatches to store
  useRobots();   // starts 1500ms SWR poll for robot list

  const activeTab  = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <>
      <UpsBanner />
      <div className="flex flex-col h-screen max-w-[1200px] mx-auto p-3 gap-3">

        {/* Header */}
        <AppHeader />

        {/* Tab bar + content */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Tab bar */}
          <div className="flex gap-[2px] px-4 bg-bg-primary border-x border-t border-border-secondary rounded-t-lg shadow-sm">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                id={`tab-btn-${id}`}
                onClick={() => setActiveTab(id)}
                className={`px-[18px] py-[10px] text-[12px] font-medium border-b-2 transition-all duration-150 whitespace-nowrap ${
                  activeTab === id
                    ? 'text-accent border-accent'
                    : 'text-text-secondary border-transparent hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 bg-bg-primary border border-border-secondary border-t-0 rounded-b-lg shadow-sm overflow-hidden">
            {activeTab === 'main'    && <MainTab />}
            {activeTab === 'jogging' && <JoggingTab />}
            {activeTab === 'config'  && <ConfigTab />}
          </div>
        </div>

      </div>
    </>
  );
}
