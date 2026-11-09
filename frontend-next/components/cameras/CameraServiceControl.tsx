'use client';

import { useEffect, useRef, useState } from 'react';
import { apiCameraServiceLogs } from '@/lib/cameras';
import { useCameraService } from '@/hooks/useCameraService';

const STATE_LABEL = {
  running: { text: 'En ejecución', dot: 'bg-success' },
  starting: { text: 'Iniciando… (puede tardar si está compilando)', dot: 'bg-warn animate-pulse' },
  stopping: { text: 'Deteniendo…', dot: 'bg-warn animate-pulse' },
  stopped: { text: 'Detenido', dot: 'bg-danger' },
  unresponsive: { text: 'No responde: detenlo y vuelve a iniciarlo', dot: 'bg-danger animate-pulse' },
} as const;

export default function CameraServiceControl({ compact = false }: { compact?: boolean }) {
  const { status, loading, supervisorDown, busy, actionError, start, stop } = useCameraService();
  const [showLogs, setShowLogs] = useState(false);

  const state = status?.state;
  const label = state ? STATE_LABEL[state] : null;
  const canStart = !!status && !busy && state === 'stopped';
  const canStop = !!status && !busy && (state === 'running' || state === 'starting' || state === 'unresponsive');

  return (
    <div className={`border border-border-secondary rounded-lg bg-bg-secondary ${compact ? 'p-2' : 'p-3'} text-xs`}>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${supervisorDown ? 'bg-danger' : label?.dot ?? 'bg-border-primary'}`} />
          <div className="min-w-0">
            <div className="font-semibold">Servicio de cámaras</div>
            <div className="text-text-secondary truncate">
              {loading && 'Consultando…'}
              {supervisorDown && 'Supervisor no disponible: ejecuta camera-service\\start-supervisor.bat en el servidor'}
              {label && label.text}
              {status?.state === 'running' && !status.managed && ' (iniciado fuera de la app)'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            id="btn-camera-service-start"
            onClick={start}
            disabled={!canStart}
            className="px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-50"
          >
            ▶ Iniciar servicio
          </button>
          <button
            id="btn-camera-service-stop"
            onClick={() => { if (confirm('¿Detener el servicio de cámaras? Se cortarán todas las transmisiones.')) stop(); }}
            disabled={!canStop}
            className="px-3 py-1.5 rounded-md border border-border-primary disabled:opacity-50"
          >
            ■ Detener servicio
          </button>
          {!compact && (
            <button
              onClick={() => setShowLogs((v) => !v)}
              disabled={supervisorDown}
              className="px-3 py-1.5 rounded-md border border-border-primary disabled:opacity-50"
            >
              {showLogs ? 'Ocultar log' : 'Ver log'}
            </button>
          )}
        </div>
      </div>
      {(actionError || (state === 'stopped' && status?.last_exit)) && (
        <p className={`mt-2 ${actionError ? 'text-danger-text' : 'text-text-secondary'}`}>
          {actionError || `Última salida: ${status?.last_exit}`}
        </p>
      )}
      {showLogs && !compact && <ServiceLogs />}
    </div>
  );
}

function ServiceLogs() {
  const [lines, setLines] = useState<string[]>([]);
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () => apiCameraServiceLogs()
      .then((res) => { if (alive) setLines(res.lines ?? []); })
      .catch(() => { /* ignore */ });
    load();
    const timer = window.setInterval(load, 2000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);

  return (
    <pre ref={box} className="mt-2 max-h-56 overflow-auto rounded-md bg-bg-primary border border-border-secondary p-2 text-[11px] leading-snug whitespace-pre-wrap">
      {lines.length ? lines.join('\n') : 'Sin salida todavía.'}
    </pre>
  );
}
