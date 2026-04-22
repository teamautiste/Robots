'use client';

import { useAppStore } from '@/hooks/useAppStore';

export default function UpsBanner() {
  const upsState = useAppStore((s) => s.upsState);
  const dismissed = useAppStore((s) => s.upsBannerDismissed);
  const dismiss   = useAppStore((s) => s.dismissUpsBanner);

  if (upsState.status !== 'lost' || dismissed) return null;

  return (
    <div
      className="fixed top-4 left-1/2 z-50 flex items-center gap-3 px-5 py-[10px]
                 bg-danger-light border border-danger rounded-lg shadow-md
                 text-danger-text font-semibold text-[13px] animate-slide-down"
      role="alert"
    >
      <span>⚡</span>
      <span>
        ¡Corte de energía! Batería al{' '}
        {upsState.battery != null ? `${upsState.battery}%` : '—'}. Secuencias detenidas.
      </span>
      <button
        onClick={dismiss}
        className="ml-2 px-3 h-[26px] rounded-md bg-danger-light border border-danger
                   text-danger-text text-[11px] font-medium hover:bg-[#f8d4d4] transition-colors"
      >
        Cerrar
      </button>
    </div>
  );
}
