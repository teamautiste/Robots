import type { FullConfig, IpConfig, RecipeData, Robot, RobotPosition } from '@/types';

const BASE = '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${method} ${path}] ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── ROBOTS ────────────────────────────────────────────────────────────────

export const apiGetRobots = () =>
  request<Robot[]>('GET', '/api/robots');

export const apiGetPosition = (id: number) =>
  request<RobotPosition>('GET', `/api/robots/${id}/position`);

export const apiConnectRobot = (id: number) =>
  request<{ success: boolean }>('POST', `/api/robots/${id}/connect`);

export const apiJog = (
  id: number,
  payload: { mode: string; axis: string; direction: number; step: number; speed: number }
) => request<{ success: boolean }>('POST', `/api/robots/${id}/jog`, payload);

export const apiReleaseServos = (id: number) =>
  request<{ success: boolean }>('POST', `/api/robots/${id}/release`);

export const apiFocusServos = (id: number) =>
  request<{ success: boolean }>('POST', `/api/robots/${id}/focus`);

export const apiTeachPoint = (id: number, recipe: string, point: string) =>
  request<{ success: boolean; angles?: number[]; error?: string }>(
    'POST', `/api/robots/${id}/teach`, { recipe, point }
  );

export const apiGoToPoint = (id: number, recipe: string, point: string, speed: number) =>
  request<{ success: boolean; error?: string }>(
    'POST', `/api/robots/${id}/goto`, { recipe, point, speed }
  );

// ── RECIPES ───────────────────────────────────────────────────────────────

export const apiListRecipes = () =>
  request<string[]>('GET', '/api/recipes');

export const apiGetRecipe = (name: string) =>
  request<RecipeData>('GET', `/api/recipes/${encodeURIComponent(name)}`);

export const apiCreateRecipe = (name: string) =>
  request<{ success: boolean; error?: string }>('POST', '/api/recipes', { name });

export const apiSaveRecipe = (name: string, data: RecipeData) =>
  request<{ success: boolean }>('PUT', `/api/recipes/${encodeURIComponent(name)}`, data);

export const apiDeleteRecipe = (name: string) =>
  request<{ success: boolean }>('DELETE', `/api/recipes/${encodeURIComponent(name)}`);

// ── SEQUENCE ─────────────────────────────────────────────────────────────

export const apiStartSequence = (recipe: string, speed: number) =>
  request<{ success: boolean; error?: string }>('POST', '/api/sequence/start', { recipe, speed });

export const apiStopSequence = () =>
  request<{ success: boolean }>('POST', '/api/sequence/stop');

// ── CONFIG ────────────────────────────────────────────────────────────────

export const apiGetConfig = () =>
  request<FullConfig>('GET', '/api/config');

export const apiSaveConfig = (data: FullConfig) =>
  request<{ success: boolean }>('POST', '/api/config', data);

// ── SWR FETCHER ───────────────────────────────────────────────────────────

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}
