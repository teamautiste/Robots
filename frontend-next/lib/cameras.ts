import type { Camera, CameraAssignment } from '@/types';

const base = process.env.NEXT_PUBLIC_CAMERA_SERVICE_BASE ?? '/camera-service';

// Límite de tiempo: si el servicio se cuelga, la petición falla y los botones
// se vuelven a habilitar en lugar de quedarse bloqueados.
function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 10000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: withTimeout(timeoutMs) });
  } catch {
    throw new Error('El servicio de cámaras no respondió a tiempo');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Servicio de cámaras: ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const cameraStream = (serial: string) => `${base}/api/cameras/${encodeURIComponent(serial)}/stream`;
export const apiGetCameras = () => request<Camera[]>('GET', '/api/cameras');
export const apiScanCameras = () => request<Camera[]>('POST', '/api/cameras', undefined, 30000);
export const apiStartCamera = (serial: string) => request<void>('POST', `/api/cameras/${encodeURIComponent(serial)}/start`);
export const apiStopCamera = (serial: string) => request<void>('POST', `/api/cameras/${encodeURIComponent(serial)}/stop`);
export const apiStartAllCameras = () => request<void>('POST', '/api/cameras/start-all');
export const apiStopAllCameras = () => request<void>('POST', '/api/cameras/stop-all');
export const apiAssignments = () => request<CameraAssignment[]>('GET', '/api/assignments');
export const apiAssignCamera = (robotId: string, cameraSerial: string) => request<void>('PUT', `/api/robots/${encodeURIComponent(robotId)}/camera`, { camera_serial: cameraSerial });
export const apiRemoveCamera = (robotId: string) => request<void>('DELETE', `/api/robots/${encodeURIComponent(robotId)}/camera`);

export interface RobotCamera { assignment: CameraAssignment | null; camera: Camera | null }
export const apiRobotCamera = (robotId: number) => request<RobotCamera>('GET', `/api/robots/Robot_${robotId}/camera`);

export type CameraServiceState = 'stopped' | 'starting' | 'running' | 'stopping' | 'unresponsive';
export interface CameraServiceStatus {
  state: CameraServiceState;
  healthy: boolean;
  managed: boolean;
  pid: number | null;
  started_at: string | null;
  last_exit: string | null;
}

const supervisorBase = process.env.NEXT_PUBLIC_CAMERA_SUPERVISOR_BASE ?? '/camera-supervisor';

async function supervisor<T>(method: string, path: string, timeoutMs = 8000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(supervisorBase + path, { method, cache: 'no-store', signal: withTimeout(timeoutMs) });
  } catch {
    throw new Error('El supervisor no respondió a tiempo');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message ?? `Supervisor de cámaras: ${response.status}`);
  }
  return data as T;
}

export const apiCameraServiceStatus = () => supervisor<CameraServiceStatus>('GET', '/status');
export const apiCameraServiceLogs = () => supervisor<{ lines: string[] }>('GET', '/logs');
export const apiCameraServiceStart = () => supervisor<unknown>('POST', '/start');
export const apiCameraServiceStop = () => supervisor<unknown>('POST', '/stop', 30000);
