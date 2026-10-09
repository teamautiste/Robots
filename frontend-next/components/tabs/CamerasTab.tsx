'use client';

import { useEffect, useState } from 'react';
import type { Camera, CameraAssignment } from '@/types';
import { apiAssignments, apiAssignCamera, apiGetCameras, apiRemoveCamera, apiScanCameras, apiStartAllCameras, apiStartCamera, apiStopAllCameras, apiStopCamera, cameraStream } from '@/lib/cameras';
import { useAppStore } from '@/hooks/useAppStore';

export default function CamerasTab() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [assignments, setAssignments] = useState<CameraAssignment[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const robots = useAppStore((state) => state.robots);
  const load = async () => { try { const [nextCameras, nextAssignments] = await Promise.all([apiGetCameras(), apiAssignments()]); setCameras(nextCameras); setAssignments(nextAssignments); setError(''); } catch { setError('Servicio de cámaras no disponible'); } };
  useEffect(() => { load(); const timer = window.setInterval(load, 3000); return () => window.clearInterval(timer); }, []);
  const run = async (key: string, action: () => Promise<void>) => { setBusy(key); try { await action(); await load(); } catch { setError('No se pudo completar la operación'); } finally { setBusy(''); } };
  const robotFor = (serial: string) => assignments.find((item) => item.camera_serial === serial)?.robot_ip;
  const robotIdFor = (ip: string) => robots.find((robot) => robot.ip === ip)?.id;
  return <div className="h-full overflow-y-auto p-5">
    <div className="flex flex-wrap gap-3 items-center justify-between mb-4"><div><h2 className="text-lg font-semibold">Cámaras industriales</h2><p className="text-xs text-text-secondary">{cameras.filter((item) => item.connected).length} detectadas · {cameras.filter((item) => item.capturing).length} capturando</p></div><div className="flex gap-2"><button onClick={() => run('scan', async () => { await apiScanCameras(); })} disabled={!!busy} className="px-3 py-2 text-xs border rounded-md">Actualizar</button><button onClick={() => run('all-start', apiStartAllCameras)} disabled={!!busy} className="px-3 py-2 text-xs rounded-md bg-accent text-white">Iniciar todas</button><button onClick={() => run('all-stop', apiStopAllCameras)} disabled={!!busy} className="px-3 py-2 text-xs border rounded-md">Detener todas</button></div></div>
    {error && <p className="mb-3 text-xs text-danger-text">{error}</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, index) => { const camera = cameras[index]; if (!camera) return <div key={index} className="min-h-52 rounded-lg border border-dashed border-border-secondary p-4 text-xs text-text-secondary">Espacio de cámara disponible</div>; const robot = robotFor(camera.serial); const robotId = robot ? robotIdFor(robot) : undefined; return <article key={camera.serial} className="rounded-lg border border-border-secondary overflow-hidden"><div className="aspect-video bg-bg-secondary flex items-center justify-center">{camera.capturing ? <img className="w-full h-full object-contain" src={cameraStream(camera.serial)} alt={`Cámara ${camera.serial}`} /> : <span className="text-xs text-text-secondary">{camera.connected ? 'Captura detenida' : 'Cámara desconectada'}</span>}</div><div className="p-3 text-xs space-y-2"><div><strong>{camera.name || camera.model || 'iRAYPLE'}</strong><p className="text-text-secondary">{camera.serial}</p></div><p>{camera.connected ? 'Conectada' : 'Desconectada'} · {camera.capturing ? 'Capturando' : 'Sin captura'}{camera.fps ? ` · ${camera.fps.toFixed(1)} FPS` : ''}</p>{robot && <p className="text-accent">Asignada a {robot}</p>}{camera.last_error && <p className="text-danger-text">{camera.last_error}</p>}<div className="flex gap-2"><button disabled={!!busy || !camera.connected} onClick={() => run(`start-${camera.serial}`, () => apiStartCamera(camera.serial))} className="border rounded px-2 py-1">Iniciar</button><button disabled={!!busy} onClick={() => run(`stop-${camera.serial}`, () => apiStopCamera(camera.serial))} className="border rounded px-2 py-1">Detener</button></div>{robotId ? <button disabled={!!busy} onClick={() => run(`remove-${camera.serial}`, () => apiRemoveCamera(`Robot_${robotId}`))} className="text-danger-text">Quitar asignación</button> : robot ? <p className="text-danger-text">Robot no vigente</p> : <Assign serial={camera.serial} run={run} />}</div></article>; })}</div>
  </div>;
}

function Assign({ serial, run }: { serial: string; run: (key: string, action: () => Promise<void>) => Promise<void> }) { const [robot, setRobot] = useState(''); return <div className="flex gap-1"><input value={robot} onChange={(event) => setRobot(event.target.value)} placeholder="Robot_1" className="w-full border rounded px-2 py-1" /><button disabled={!robot} onClick={() => run(`assign-${serial}`, () => apiAssignCamera(robot, serial))} className="border rounded px-2 py-1">Asignar</button></div>; }
