'use client';

import { useEffect, useRef, useState } from 'react';
import {
  apiRobotCamera,
  apiScanCameras,
  apiStartCamera,
  cameraStream,
  type RobotCamera,
} from '@/lib/cameras';
import { useCameraService } from '@/hooks/useCameraService';
import CameraServiceControl from '@/components/cameras/CameraServiceControl';

export default function RobotCameraView({ robotId }: { robotId: number | null }) {
  const { running, supervisorDown } = useCameraService();
  const [info, setInfo] = useState<RobotCamera | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const autoTried = useRef('');

  useEffect(() => {
    setInfo(null);
    setError('');
    if (!robotId || !running) return;
    let alive = true;
    let scanned = false;

    const load = async () => {
      try {
        let next = await apiRobotCamera(robotId);

        if (next.assignment && !next.camera && !scanned) {
          scanned = true;
          await apiScanCameras().catch(() => undefined);
          next = await apiRobotCamera(robotId);
        }
        if (!alive) return;
        setInfo(next);
        setError('');

        const cam = next.camera;
        const key = `${robotId}:${cam?.serial}`;
        if (cam && cam.connected && !cam.capturing && autoTried.current !== key) {
          autoTried.current = key;
          await apiStartCamera(cam.serial).catch(() => undefined);
        }
      } catch {
        if (alive) setError('No se pudo consultar la cámara del robot');
      }
    };
    load();
    const timer = window.setInterval(load, 2000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [robotId, running]);

  async function startCapture(serial: string) {
    setStarting(true);
    try { await apiStartCamera(serial); } catch { setError('No se pudo iniciar la captura'); }
    setStarting(false);
  }

  const camera = info?.camera;

  let body: React.ReactNode;
  if (!robotId) {
    body = <Message>Selecciona un robot para ver su cámara</Message>;
  } else if (supervisorDown || !running) {
    body = <Message>El servicio de cámaras no está en ejecución</Message>;
  } else if (error) {
    body = <Message danger>{error}</Message>;
  } else if (!info) {
    body = <Message>Cargando…</Message>;
  } else if (!info.assignment) {
    body = <Message>Robot {robotId} no tiene cámara asignada (asígnala en la pestaña Cámaras)</Message>;
  } else if (!camera || !camera.connected) {
    body = <Message danger>La cámara asignada ({info.assignment.camera_serial}) no está conectada</Message>;
  } else if (!camera.capturing) {
    body = (
      <div className="flex flex-col items-center gap-2">
        <span className="text-text-secondary">Captura detenida</span>
        <button onClick={() => startCapture(camera.serial)} disabled={starting}
          className="px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-50">
          {starting ? 'Iniciando…' : '▶ Iniciar captura'}
        </button>
      </div>
    );
  } else {
    body = (
      
      <img key={camera.serial} src={cameraStream(camera.serial)} alt={`Cámara del Robot ${robotId}`}
        className="w-full h-full object-contain" />
    );
  }

  return (
    <div className="bg-bg-primary border border-border-secondary rounded-lg p-[12px_16px]">
      <div className="flex items-center justify-between mb-[10px] gap-2">
        <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em]">
          Cámara — {robotId ? `Robot ${robotId}` : '—'}
        </div>
        {camera?.capturing && (
          <div className="text-[10px] text-text-secondary">
            {camera.serial}{camera.fps ? ` · ${camera.fps.toFixed(1)} FPS` : ''}
          </div>
        )}
      </div>
      {(supervisorDown || !running) && robotId && (
        <div className="mb-2"><CameraServiceControl compact /></div>
      )}
      <div className="aspect-video max-h-[420px] w-full bg-bg-secondary rounded-md flex items-center justify-center overflow-hidden text-xs">
        {body}
      </div>
    </div>
  );
}

function Message({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return <span className={`px-4 text-center ${danger ? 'text-danger-text' : 'text-text-secondary'}`}>{children}</span>;
}
