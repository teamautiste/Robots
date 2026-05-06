'use client';

import AppHeader from '@/components/AppHeader';
import UpsBanner from '@/components/UpsBanner';
import MainTab from '@/components/tabs/MainTab';
import JoggingTab from '@/components/tabs/JoggingTab';
import ConfigTab from '@/components/tabs/ConfigTab';
import RecipeTab from '@/components/tabs/RecipeTab';
import { useAppStore } from '@/hooks/useAppStore';
import { useSocket } from '@/hooks/useSocket';
import { useRobots } from '@/hooks/useRobots';

const TABS = [
  { id: 'main', label: 'Main', icon: '▶' },
  { id: 'jogging', label: 'Jogging', icon: '🕹' },
  { id: 'config', label: 'Configuración', icon: '⚙' },
  { id: 'recipes', label: 'Recetas', icon: '📋' },
] as const;

export default function AppShell() {
  useSocket();   // establishes WebSocket connection and dispatches to store
  useRobots();   // starts 1500ms SWR poll for robot list

  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <>
      <UpsBanner />
      <div className="flex flex-col h-screen max-w-[1200px] mx-auto p-3 gap-3">

        {/* Header */}
        <AppHeader />

        {/* Sidebar + content */}
        <div className="flex flex-row flex-1 min-h-0 gap-0">

          {/* Tab sidebar */}
          <div className="flex flex-col bg-bg-secondary border border-border-secondary rounded-l-lg shadow-sm w-[100px] py-2 gap-[5px]">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                id={`tab-btn-${id}`}
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center gap-2 px-2 py-3 text-[11px] font-medium border-r-[6px] transition-all duration-150 text-left w-full ${activeTab === id
                  ? 'text-accent border-accent bg-bg-primary'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-primary'
                  }`}
              >
                <span className="text-[25px] leading-none">{icon}</span>
                <span className="leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 bg-bg-primary border border-border-secondary border-l-0 rounded-r-lg shadow-sm overflow-hidden">
            {activeTab === 'main' && <MainTab />}
            {activeTab === 'jogging' && <JoggingTab />}
            {activeTab === 'config' && <ConfigTab />}
            {activeTab === 'recipes' && <RecipeTab />}
          </div>

        </div>
      </div>
    </>
  );
}
