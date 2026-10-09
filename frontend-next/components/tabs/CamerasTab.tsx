'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Camera, CameraAssignment, Robot } from '@/types';
import {
  apiAssignments,
  apiAssignCamera,
  apiGetCameras,
  apiRemoveCamera,
  apiScanCameras,
  apiStartAllCameras,
  apiStartCamera,
  apiStopAllCameras,
  apiStopCamera,
  cameraStream,
} from '@/lib/cameras';
import { useAppStore } from '@/hooks/useAppStore';

export default function CamerasTab() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [assignments, setAssignments] = useState<CameraAssignment[]>([]);
  const [busy, setBusy] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const robots = useAppStore((state) => state.robots);

  const load = useCallback(async () => {
    try {
      const [nextCameras, nextAssignments] = await Promise.all([
        apiGetCameras(),
        apiAssignments(),
      ]);
      setCameras(nextCameras);
      setAssignments(nextAssignments);
      setError('');
    } catch {
      setError('Servicio de cámaras no disponible');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setScanning(true);
      try {
        await apiScanCameras();
      } catch { /* el servicio puede no tener cámaras aún */ }
      setScanning(false);
      await load();
    })();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      await load();
    } catch {
      setError('No se pudo completar la operación');
    } finally {
      setBusy('');
    }
  };

  const scan = async () => {
    setScanning(true);
    setError('');
    try {
      await apiScanCameras();
      await load();
    } catch {
      setError('No se pudo escanear las cámaras');
    } finally {
      setScanning(false);
    }
  };

  const robotFor = (serial: string) => assignments.find((a) => a.camera_serial === serial)?.robot_ip;
  const robotIdFor = (ip: string) => robots.find((r) => r.ip === ip)?.id;

  const connected = cameras.filter((c) => c.connected).length;
  const capturing = cameras.filter((c) => c.capturing).length;

  return (
    <div className="h-full overflow-y-auto p-5">

      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Cámaras industriales</h2>
          <p className="text-xs text-text-secondary">
            {connected} detectadas · {capturing} capturando
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            id="btn-scan-cameras"
            onClick={scan}
            disabled={scanning || !!busy}
            className="px-3 py-2 text-xs border rounded-md disabled:opacity-50 flex items-center gap-1"
          >
            {scanning ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                Escaneando…
              </>
            ) : (
              '🔍 Escanear'
            )}
          </button>
          <button
            id="btn-start-all-cameras"
            onClick={() => run('all-start', apiStartAllCameras)}
            disabled={!!busy || scanning}
            className="px-3 py-2 text-xs rounded-md bg-accent text-white disabled:opacity-50"
          >
            ▶ Iniciar todas
          </button>
          <button
            id="btn-stop-all-cameras"
            onClick={() => run('all-stop', apiStopAllCameras)}
            disabled={!!busy || scanning}
            className="px-3 py-2 text-xs border rounded-md disabled:opacity-50"
          >
            ■ Detener todas
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-xs text-danger-text">{error}</p>}

      {/* Grid de 8 slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, index) => {
          const camera = cameras[index];

          // Slot vacío
          if (!camera) {
            return (
              <div
                key={index}
                className="min-h-52 rounded-lg border border-dashed border-border-secondary p-4 flex items-center justify-center text-xs text-text-secondary"
              >
                {scanning ? 'Buscando cámara…' : 'Espacio de cámara disponible'}
              </div>
            );
          }

          const robot = robotFor(camera.serial);
          const robotId = robot ? robotIdFor(robot) : undefined;

          return (
            <article key={camera.serial} className="rounded-lg border border-border-secondary overflow-hidden">
              {/* Preview de video */}
              <div className="aspect-video bg-bg-secondary flex items-center justify-center">
                {camera.capturing ? (
                  <img
                    className="w-full h-full object-contain"
                    src={cameraStream(camera.serial)}
                    alt={`Cámara ${camera.serial}`}
                  />
                ) : (
                  <span className="text-xs text-text-secondary">
                    {camera.connected ? 'Captura detenida' : 'Cámara desconectada'}
                  </span>
                )}
              </div>

              {/* Info y controles */}
              <div className="p-3 text-xs space-y-2">
                <div>
                  <strong>{camera.name || camera.model || 'iRAYPLE'}</strong>
                  <p className="text-text-secondary">{camera.serial}</p>
                </div>

                <p>
                  {camera.connected ? '🟢 Conectada' : '🔴 Desconectada'}
                  {' · '}
                  {camera.capturing ? 'Capturando' : 'Sin captura'}
                  {camera.fps ? ` · ${camera.fps.toFixed(1)} FPS` : ''}
                  {camera.width ? ` · ${camera.width}×${camera.height}` : ''}
                </p>

                {robot && <p className="text-accent">Asignada a {robotIdFor(robot) ?? robot}</p>}
                {camera.last_error && <p className="text-danger-text">{camera.last_error}</p>}

                {/* Botones iniciar / detener */}
                <div className="flex gap-2">
                  <button
                    id={`btn-start-camera-${camera.serial}`}
                    disabled={!!busy || !camera.connected || camera.capturing}
                    onClick={() => run(`start-${camera.serial}`, () => apiStartCamera(camera.serial))}
                    className="border rounded px-2 py-1 disabled:opacity-50"
                  >
                    ▶ Iniciar
                  </button>
                  <button
                    id={`btn-stop-camera-${camera.serial}`}
                    disabled={!!busy || !camera.capturing}
                    onClick={() => run(`stop-${camera.serial}`, () => apiStopCamera(camera.serial))}
                    className="border rounded px-2 py-1 disabled:opacity-50"
                  >
                    ■ Detener
                  </button>
                </div>

                {/* Asignación a robot */}
                {robotId ? (
                  <button
                    id={`btn-remove-assign-${camera.serial}`}
                    disabled={!!busy}
                    onClick={() => run(`remove-${camera.serial}`, () => apiRemoveCamera(`Robot_${robotId}`))}
                    className="text-danger-text disabled:opacity-50"
                  >
                    Quitar asignación
                  </button>
                ) : robot ? (
                  <p className="text-danger-text">Robot no vigente</p>
                ) : (
                  <Assign serial={camera.serial} run={run} robots={robots} />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Assign({
  serial,
  run,
  robots,
}: {
  serial: string;
  run: (key: string, action: () => Promise<void>) => Promise<void>;
  robots: Robot[];
}) {
  const [robot, setRobot] = useState('');

  return (
    <div className="flex gap-1">
      {robots.length > 0 ? (
        <select
          id={`select-robot-${serial}`}
          value={robot}
          onChange={(e) => setRobot(e.target.value)}
          className="w-full border rounded px-2 py-1 bg-bg-primary text-xs"
        >
          <option value="">— Asignar robot —</option>
          {robots.map((r) => (
            <option key={r.id} value={`Robot_${r.id}`}>Robot_{r.id} ({r.ip})</option>
          ))}
        </select>
      ) : (
        <input
          id={`input-robot-${serial}`}
          value={robot}
          onChange={(e) => setRobot(e.target.value)}
          placeholder="Robot_1"
          className="w-full border rounded px-2 py-1"
        />
      )}
      <button
        id={`btn-assign-${serial}`}
        disabled={!robot}
        onClick={() => run(`assign-${serial}`, () => apiAssignCamera(robot, serial))}
        className="border rounded px-2 py-1 disabled:opacity-50 whitespace-nowrap"
      >
        Asignar
      </button>
    </div>
  );
}
