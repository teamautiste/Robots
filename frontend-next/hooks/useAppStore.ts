'use client';

import { create } from 'zustand';
import type {
  ActiveTab,
  Feedback,
  GeneralParams,
  JogMode,
  JogStep,
  LogEntry,
  LogLevel,
  RecipeData,
  Robot,
  RobotPosition,
  SequenceProgress,
  UpsState,
} from '@/types';

interface AppStore {
  // ── Tab ────────────────────────────────────────────────────────────────
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // ── Robots ─────────────────────────────────────────────────────────────
  robots: Robot[];
  setRobots: (robots: Robot[]) => void;
  updateRobotStatus: (robotId: number, status: Robot['status'], error?: string) => void;
  updateSequenceProgress: (robotId: number, progress: SequenceProgress) => void;
  clearSequenceProgress: () => void;

  // ── Current robot (jogging) ────────────────────────────────────────────
  currentRobotId: number | null;
  setCurrentRobotId: (id: number | null) => void;

  // ── Jog controls ──────────────────────────────────────────────────────
  jogMode: JogMode;
  setJogMode: (mode: JogMode) => void;
  jogStep: JogStep;
  setJogStep: (step: JogStep) => void;
  jogSpeed: number;
  setJogSpeed: (speed: number) => void;

  // ── Run controls ───────────────────────────────────────────────────────
  runSpeed: number;
  setRunSpeed: (speed: number) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;

  // ── Recipe state ───────────────────────────────────────────────────────
  selectedRecipe: string;
  setSelectedRecipe: (name: string) => void;
  teachRecipe: string;
  setTeachRecipe: (name: string) => void;
  teachPoint: string;
  setTeachPoint: (point: string) => void;
  newTeachPointName: string;
  setNewTeachPointName: (name: string) => void;
  recipes: string[];
  setRecipes: (recipes: string[]) => void;
  currentRecipeData: RecipeData | null;
  setCurrentRecipeData: (data: RecipeData | null) => void;

  // ── Config tab ─────────────────────────────────────────────────────────
  selectedRobotTab: number;
  setSelectedRobotTab: (tab: number) => void;
  selectedPointRow: number;
  setSelectedPointRow: (row: number) => void;

  // ── Position ───────────────────────────────────────────────────────────
  currentPosition: RobotPosition | null;
  setCurrentPosition: (pos: RobotPosition | null) => void;

  // ── UPS ────────────────────────────────────────────────────────────────
  upsState: UpsState;
  setUpsState: (state: UpsState) => void;
  upsBannerDismissed: boolean;
  dismissUpsBanner: () => void;

  // ── Logs ───────────────────────────────────────────────────────────────
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string) => void;

  // ── Inline feedback ────────────────────────────────────────────────────
  feedback: Feedback | null;
  setFeedback: (fb: Feedback | null) => void;

  // ── General params (local only — TODO: wire to backend) ───────────────
  generalParams: GeneralParams;
  setGeneralParams: (params: Partial<GeneralParams>) => void;
}

let logCounter = 0;

export const useAppStore = create<AppStore>((set) => ({
  // ── Tab ────────────────────────────────────────────────────────────────
  activeTab: 'main',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Robots ─────────────────────────────────────────────────────────────
  robots: [],
  setRobots: (robots) => set({ robots }),
  updateRobotStatus: (robotId, status, error) =>
    set((state) => ({
      robots: state.robots.map((r) =>
        r.id === robotId
          ? { ...r, status, error: error ?? r.error, connected: status === 'connected' }
          : r
      ),
    })),
  updateSequenceProgress: (robotId, progress) =>
    set((state) => ({
      robots: state.robots.map((r) =>
        r.id === robotId ? { ...r, sequenceProgress: progress } : r
      ),
    })),
  clearSequenceProgress: () =>
    set((state) => ({
      robots: state.robots.map((r) => ({ ...r, sequenceProgress: undefined })),
    })),

  // ── Current robot ──────────────────────────────────────────────────────
  currentRobotId: null,
  setCurrentRobotId: (id) => set({ currentRobotId: id }),

  // ── Jog controls ──────────────────────────────────────────────────────
  jogMode: 'joint',
  setJogMode: (jogMode) => set({ jogMode }),
  jogStep: 1,
  setJogStep: (jogStep) => set({ jogStep }),
  jogSpeed: 10,
  setJogSpeed: (jogSpeed) => set({ jogSpeed }),

  // ── Run controls ───────────────────────────────────────────────────────
  runSpeed: 25,
  setRunSpeed: (runSpeed) => set({ runSpeed }),
  isRunning: false,
  setIsRunning: (isRunning) => set({ isRunning }),

  // ── Recipe state ───────────────────────────────────────────────────────
  selectedRecipe: '',
  setSelectedRecipe: (selectedRecipe) => set({ selectedRecipe }),
  teachRecipe: '',
  setTeachRecipe: (teachRecipe) => set({ teachRecipe }),
  teachPoint: '',
  setTeachPoint: (teachPoint) => set({ teachPoint }),
  newTeachPointName: '',
  setNewTeachPointName: (newTeachPointName) => set({ newTeachPointName }),
  recipes: [],
  setRecipes: (recipes) => set({ recipes }),
  currentRecipeData: null,
  setCurrentRecipeData: (currentRecipeData) => set({ currentRecipeData }),

  // ── Config tab ─────────────────────────────────────────────────────────
  selectedRobotTab: 1,
  setSelectedRobotTab: (selectedRobotTab) => set({ selectedRobotTab }),
  selectedPointRow: -1,
  setSelectedPointRow: (selectedPointRow) => set({ selectedPointRow }),

  // ── Position ───────────────────────────────────────────────────────────
  currentPosition: null,
  setCurrentPosition: (currentPosition) => set({ currentPosition }),

  // ── UPS ────────────────────────────────────────────────────────────────
  upsState: { status: 'ok' },
  setUpsState: (upsState) => set({ upsState, upsBannerDismissed: false }),
  upsBannerDismissed: false,
  dismissUpsBanner: () => set({ upsBannerDismissed: true }),

  // ── Logs ───────────────────────────────────────────────────────────────
  logs: [],
  addLog: (level, message) =>
    set((state) => {
      const entry: LogEntry = {
        id: String(++logCounter),
        level,
        message,
        ts: new Date().toLocaleTimeString('es-MX', { hour12: false }),
      };
      const logs = [...state.logs, entry];
      return { logs: logs.length > 100 ? logs.slice(logs.length - 100) : logs };
    }),

  // ── Inline feedback ────────────────────────────────────────────────────
  feedback: null,
  setFeedback: (feedback) => set({ feedback }),

  // ── General params (TODO: wire to backend when endpoint is available) ──
  generalParams: { maxSpeed: 100, acceleration: 200, timeout: 5, retries: 3, port: 9000 },
  setGeneralParams: (params) =>
    set((state) => ({ generalParams: { ...state.generalParams, ...params } })),
}));
