import type { Camera, CameraAssignment } from '@/types';

const base = process.env.NEXT_PUBLIC_CAMERA_SERVICE_BASE ?? '/camera-service';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(`Servicio de cámaras: ${response.status}`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const cameraStream = (serial: string) => `${base}/api/cameras/${encodeURIComponent(serial)}/stream`;
export const apiGetCameras = () => request<Camera[]>('GET', '/api/cameras');
export const apiScanCameras = () => request<Camera[]>('POST', '/api/cameras');
export const apiStartCamera = (serial: string) => request<void>('POST', `/api/cameras/${encodeURIComponent(serial)}/start`);
export const apiStopCamera = (serial: string) => request<void>('POST', `/api/cameras/${encodeURIComponent(serial)}/stop`);
export const apiStartAllCameras = () => request<void>('POST', '/api/cameras/start-all');
export const apiStopAllCameras = () => request<void>('POST', '/api/cameras/stop-all');
export const apiAssignments = () => request<CameraAssignment[]>('GET', '/api/assignments');
export const apiAssignCamera = (robotId: string, cameraSerial: string) => request<void>('PUT', `/api/robots/${encodeURIComponent(robotId)}/camera`, { camera_serial: cameraSerial });
export const apiRemoveCamera = (robotId: string) => request<void>('DELETE', `/api/robots/${encodeURIComponent(robotId)}/camera`);
