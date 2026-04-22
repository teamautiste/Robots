// ── ROBOT ─────────────────────────────────────────────────────────────────

export type RobotStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface SequenceProgress {
  step: number;
  total: number;
  status: string; // 'Running' | 'Done' | 'Error'
}

export interface Robot {
  id: number;
  ip: string;
  status: RobotStatus;
  error?: string;
  connected: boolean;
  sequenceProgress?: SequenceProgress;
}

// ── POSITION ─────────────────────────────────────────────────────────────

export interface RobotPosition {
  connected: boolean;
  angles: number[]; // J1–J6
  coords: number[]; // X,Y,Z,Rx,Ry,Rz
}

// ── RECIPE ───────────────────────────────────────────────────────────────

export interface Point {
  name: string;
  coords: number[]; // 6 joint values
}

export type RecipeData = Record<string, Point[]>; // key = "Robot N"

// ── CONFIG ───────────────────────────────────────────────────────────────

export type IpConfig = Record<string, string>; // "Robot_1" → "192.168.1.1"

export interface FullConfig {
  ips: IpConfig;
  general_params: GeneralParams;
}

// ── LOG ───────────────────────────────────────────────────────────────────

export type LogLevel = 'ok' | 'err' | 'warn' | 'info';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  ts: string;
}

// ── UPS ───────────────────────────────────────────────────────────────────

export interface UpsState {
  status: 'ok' | 'lost';
  battery?: number;
}

// ── APP STATE ─────────────────────────────────────────────────────────────

export type JogMode = 'joint' | 'cartesian';
export type JogStep = 1 | 5 | 10 | 50;
export type ActiveTab = 'main' | 'jogging' | 'config';

export interface Feedback {
  message: string;
  level: 'ok' | 'err' | 'info';
}

export interface GeneralParams {
  maxSpeed: number;
  acceleration: number;
  timeout: number;
  retries: number;
  port: number;
}

// ── SOCKET EVENTS ─────────────────────────────────────────────────────────

export interface RobotStatusEvent {
  robot_id: number;
  status: RobotStatus;
  ip: string;
  error?: string;
}

export interface SequenceProgressEvent {
  robot_id: number;
  step: number;
  total: number;
  status: string;
}

export interface SequenceDoneEvent {
  recipe: string;
}

export interface LogEvent {
  level: LogLevel;
  ts: string;
  message: string;
}

export interface UpsAlertEvent {
  type: 'lost' | 'ok';
  battery?: number;
}
