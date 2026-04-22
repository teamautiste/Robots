'use client';

import StatusDot from '@/components/ui/StatusDot';
import { useAppStore } from '@/hooks/useAppStore';

export default function AppHeader() {
  const robots        = useAppStore((s) => s.robots);
  const currentRobotId = useAppStore((s) => s.currentRobotId);
  const upsState      = useAppStore((s) => s.upsState);

  const currentRobot = robots.find((r) => r.id === currentRobotId);

  const headerStatus = currentRobot
    ? `Robot ${currentRobot.id} — ${
        currentRobot.status === 'connected'  ? 'Conectado'    :
        currentRobot.status === 'error'      ? 'Error'        :
        currentRobot.status === 'connecting' ? 'Conectando...' :
        'Desconectado'
      }`
    : 'Sin robot seleccionado';

  const headerDotStatus = currentRobot
    ? currentRobot.status
    : 'disconnected';

  const upsLost = upsState.status === 'lost';

  return (
    <header className="flex items-center justify-between px-4 py-[10px] bg-bg-primary border border-border-secondary rounded-lg shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-[10px]">
        <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center text-white text-base">
          ⚙
        </div>
        <div>
          <div className="text-[14px] font-semibold text-text-primary tracking-[-0.02em]">
            Robot Control
          </div>
          <div className="text-[11px] text-text-secondary">
            Elephant Robotics — Cobot 320
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* UPS indicator */}
        <div
          className={`flex items-center gap-[6px] px-[10px] py-1 rounded-full text-[11px] font-medium
                      border transition-all duration-200
                      ${upsLost
                        ? 'bg-danger-light text-danger-text border-danger animate-pulse-danger'
                        : 'bg-bg-secondary text-text-secondary border-border-secondary'
                      }`}
          aria-label="Estado UPS"
        >
          <span>⚡</span>
          <span>{upsLost ? `Batería ${upsState.battery ?? '?'}%` : 'UPS OK'}</span>
        </div>

        {/* Current robot status */}
        <div className="flex items-center gap-2 px-3 py-[6px] bg-bg-secondary border border-border-secondary rounded-md text-[11px] text-text-secondary">
          <StatusDot status={headerDotStatus} />
          <span>{headerStatus}</span>
        </div>
      </div>
    </header>
  );
}
