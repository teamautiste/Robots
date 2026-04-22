'use client';

import React, { useState } from 'react';
import JogButton from '@/components/ui/JogButton';
import LogBox from '@/components/ui/LogBox';
import StatusDot from '@/components/ui/StatusDot';
import { useAppStore } from '@/hooks/useAppStore';
import { useRobotPosition } from '@/hooks/useRobotPosition';
import {
  apiJog, apiReleaseServos, apiFocusServos,
  apiGetRecipe, apiTeachPoint, apiGoToPoint,
} from '@/lib/api';
import type { JogStep } from '@/types';

const JOINT_AXES  = ['J1','J2','J3','J4','J5','J6'];
const CART_AXES   = ['X','Y','Z','Rx','Ry','Rz'];
const JOINT_UNITS = ['°','°','°','°','°','°'];
const CART_UNITS  = ['mm','mm','mm','°','°','°'];
const STEPS: JogStep[] = [1, 5, 10, 50];

export default function JoggingTab() {
  const robots          = useAppStore((s) => s.robots);
  const currentRobotId  = useAppStore((s) => s.currentRobotId);
  const setCurrentRobotId = useAppStore((s) => s.setCurrentRobotId);
  const jogMode         = useAppStore((s) => s.jogMode);
  const setJogMode      = useAppStore((s) => s.setJogMode);
  const jogStep         = useAppStore((s) => s.jogStep);
  const setJogStep      = useAppStore((s) => s.setJogStep);
  const jogSpeed        = useAppStore((s) => s.jogSpeed);
  const setJogSpeed     = useAppStore((s) => s.setJogSpeed);
  const teachRecipe     = useAppStore((s) => s.teachRecipe);
  const setTeachRecipe  = useAppStore((s) => s.setTeachRecipe);
  const recipes         = useAppStore((s) => s.recipes);
  const logs            = useAppStore((s) => s.logs);
  const currentPosition = useAppStore((s) => s.currentPosition);

  const [teachPoints, setTeachPoints] = useState<string[]>([]);
  const [selectedTeachPoint, setSelectedTeachPoint] = useState('__new__');
  const [newPointName, setNewPointName] = useState('');
  const [teachFeedback, setTeachFeedback] = useState<{msg:string;ok:boolean}|null>(null);
  const [servoError, setServoError] = useState('');

  useRobotPosition(currentRobotId);

  const connectedRobots = robots.filter((r) => r.connected);
  const currentRobot = robots.find((r) => r.id === currentRobotId);

  const axes  = jogMode === 'joint' ? JOINT_AXES  : CART_AXES;
  const units = jogMode === 'joint' ? JOINT_UNITS : CART_UNITS;
  const vals  = jogMode === 'joint'
    ? (currentPosition?.angles ?? new Array(6).fill(0))
    : (currentPosition?.coords ?? new Array(6).fill(0));

  async function handleRobotChange(val: string) {
    setCurrentRobotId(val ? Number(val) : null);
    setServoError('');
  }

  async function doJog(axis: string, direction: 1 | -1) {
    if (!currentRobotId) return;
    await apiJog(currentRobotId, { mode: jogMode, axis, direction, step: jogStep, speed: jogSpeed });
  }

  async function handleRelease() {
    if (!currentRobotId) { setServoError('Selecciona un robot primero'); return; }
    setServoError('');
    await apiReleaseServos(currentRobotId);
  }

  async function handleFocus() {
    if (!currentRobotId) { setServoError('Selecciona un robot primero'); return; }
    setServoError('');
    await apiFocusServos(currentRobotId);
  }

  async function handleTeachRecipeChange(name: string) {
    setTeachRecipe(name);
    setSelectedTeachPoint('__new__');
    setTeachPoints([]);
    if (!name || !currentRobotId) return;
    try {
      const recipe = await apiGetRecipe(name);
      const pts = (recipe[`Robot ${currentRobotId}`] ?? []).map((p) => p.name);
      setTeachPoints(pts);
    } catch { /* ignore */ }
  }

  async function handleTeach() {
    if (!currentRobotId) { setTeachFeedback({ msg: 'Selecciona un robot', ok: false }); return; }
    if (!teachRecipe)    { setTeachFeedback({ msg: 'Selecciona una receta', ok: false }); return; }

    let pointName = selectedTeachPoint;
    if (pointName === '__new__') {
      if (!newPointName.trim()) { setTeachFeedback({ msg: 'Ingresa el nombre del nuevo punto', ok: false }); return; }
      pointName = newPointName.trim();
    }

    try {
      const res = await apiTeachPoint(currentRobotId, teachRecipe, pointName);
      if (res.success) {
        setTeachFeedback({ msg: `✓ '${pointName}' guardado: [${(res.angles ?? []).map((v) => v.toFixed(1)).join(', ')}]`, ok: true });
        if (selectedTeachPoint === '__new__') {
          setTeachPoints((prev) => [...prev, pointName]);
          setSelectedTeachPoint(pointName);
          setNewPointName('');
        }
      } else {
        setTeachFeedback({ msg: `Error: ${res.error}`, ok: false });
      }
    } catch {
      setTeachFeedback({ msg: 'Error de conexión', ok: false });
    }
  }

  async function handleGoTo() {
    if (!currentRobotId) { setTeachFeedback({ msg: 'Selecciona un robot', ok: false }); return; }
    if (!teachRecipe)    { setTeachFeedback({ msg: 'Selecciona una receta', ok: false }); return; }
    if (selectedTeachPoint === '__new__') { setTeachFeedback({ msg: 'Selecciona un punto guardado', ok: false }); return; }
    try {
      const res = await apiGoToPoint(currentRobotId, teachRecipe, selectedTeachPoint, jogSpeed);
      if (res.success) setTeachFeedback({ msg: `→ Moviendo a '${selectedTeachPoint}'...`, ok: true });
      else setTeachFeedback({ msg: `Error: ${res.error}`, ok: false });
    } catch {
      setTeachFeedback({ msg: 'Error de conexión', ok: false });
    }
  }

  const dotStatus = currentRobot?.status ?? 'disconnected';

  return (
    <div className="p-5 h-full overflow-y-auto">
      {/* Controls row */}
      <div className="flex flex-wrap gap-[10px] items-end mb-4">
        {/* Jog mode pills */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Modo</label>
          <div className="flex gap-1">
            {(['joint','cartesian'] as const).map((m) => (
              <button key={m} onClick={() => setJogMode(m)}
                className={`px-[14px] py-1 rounded-full text-[11px] font-medium border transition-all ${
                  jogMode === m ? 'bg-accent border-accent text-white' : 'bg-transparent border-border-primary text-text-secondary hover:bg-bg-secondary'
                }`}>
                {m === 'joint' ? 'Joint' : 'Cartesiano'}
              </button>
            ))}
          </div>
        </div>

        {/* Robot select */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Robot</label>
          <select value={currentRobotId ?? ''} onChange={(e) => handleRobotChange(e.target.value)}
            className="h-8 px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[12px] outline-none focus:border-accent w-[130px]">
            <option value="">— Ninguno —</option>
            {connectedRobots.map((r) => <option key={r.id} value={r.id}>Robot {r.id}</option>)}
          </select>
        </div>

        {/* Step pills */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Paso (mm / °)</label>
          <div className="flex gap-1">
            {STEPS.map((s) => (
              <button key={s} onClick={() => setJogStep(s)}
                className={`px-[14px] py-1 rounded-full text-[11px] font-medium border transition-all ${
                  jogStep === s ? 'bg-accent border-accent text-white' : 'bg-transparent border-border-primary text-text-secondary hover:bg-bg-secondary'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Jog speed slider */}
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Velocidad jog</label>
          <div className="flex items-center gap-2">
            <input type="range" min={1} max={100} value={jogSpeed} onChange={(e) => setJogSpeed(Number(e.target.value))} className="flex-1" />
            <span className="text-[13px] font-semibold min-w-[36px] text-right">{jogSpeed}%</span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-[14px]">
        {/* Left: jog grid + servo controls */}
        <div>
          <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em] mb-[10px]">
            {jogMode === 'joint' ? 'Ejes de junta' : 'Ejes cartesianos'}
          </div>
          <div className="grid grid-cols-4 gap-[6px] mb-3">
            {axes.map((ax) => (
              <React.Fragment key={ax}>
                <JogButton axis={ax} direction={-1} disabled={!currentRobotId} onJog={() => doJog(ax, -1)} />
                <JogButton axis={ax} direction={1}  disabled={!currentRobotId} onJog={() => doJog(ax, 1)} />
              </React.Fragment>
            ))}
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={handleRelease}
              className="h-8 px-[14px] rounded-md bg-danger-light border border-danger text-danger-text text-[12px] font-medium hover:bg-[#f8d4d4] transition-colors">
              🔓 Liberar servos
            </button>
            <button onClick={handleFocus}
              className="h-8 px-[14px] rounded-md bg-bg-primary border border-border-primary text-text-primary text-[12px] font-medium hover:bg-bg-secondary transition-colors">
              🔒 Enfocar servos
            </button>
          </div>
          {servoError && <p className="text-[11px] text-danger-text mb-2">⚠ {servoError}</p>}

          <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-secondary rounded-md text-[11px] text-text-secondary">
            <StatusDot status={dotStatus} />
            <span>
              {currentRobot
                ? currentRobot.connected
                  ? `Listo — Robot ${currentRobotId} conectado`
                  : `Robot ${currentRobotId} no conectado`
                : 'Sin robot conectado'}
            </span>
          </div>
        </div>

        {/* Right: position table + log */}
        <div className="flex flex-col gap-3">
          {/* Position */}
          <div className="bg-bg-primary border border-border-secondary rounded-lg p-[12px_16px]">
            <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em] mb-[10px]">
              Posición actual — {currentRobotId ? `Robot ${currentRobotId}` : '—'}
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['Eje','Valor','Unidad'].map((h,i) => (
                    <th key={h} className={`bg-bg-secondary px-[10px] py-[6px] text-[10px] font-semibold text-text-secondary uppercase tracking-[.05em] border-b border-border-secondary ${i>0?'text-right':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {axes.map((ax, i) => (
                  <tr key={ax} className="border-b border-border-secondary last:border-b-0">
                    <td className="px-[10px] py-[7px]">{ax}</td>
                    <td className="px-[10px] py-[7px] font-semibold text-accent text-right tabular-nums">
                      {(vals[i] ?? 0).toFixed(2)}
                    </td>
                    <td className="px-[10px] py-[7px] text-text-secondary text-right">{units[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Log */}
          <div className="bg-bg-primary border border-border-secondary rounded-lg p-[12px_16px]">
            <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em] mb-[10px]">Registro de movimientos</div>
            <LogBox logs={logs} />
          </div>
        </div>
      </div>

      {/* Teach section */}
      <div className="mt-[14px] border border-border-secondary rounded-lg p-[14px_20px]">
        <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em] mb-[10px]">Teach & navegación de puntos</div>
        <div className="flex flex-wrap gap-2 items-end border-t border-border-secondary pt-[14px] mt-[14px]">
          {/* Recipe */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Receta</label>
            <select value={teachRecipe} onChange={(e) => handleTeachRecipeChange(e.target.value)}
              className="h-8 px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[12px] outline-none focus:border-accent w-[160px]">
              <option value="">— Ninguna —</option>
              {recipes.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Point */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Punto</label>
            <select value={selectedTeachPoint} onChange={(e) => setSelectedTeachPoint(e.target.value)}
              className="h-8 px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[12px] outline-none focus:border-accent w-[160px]">
              <option value="__new__">Punto nuevo</option>
              {teachPoints.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* New point inline input (replaces prompt()) */}
          {selectedTeachPoint === '__new__' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Nombre del nuevo punto</label>
              <input
                type="text"
                value={newPointName}
                onChange={(e) => setNewPointName(e.target.value)}
                placeholder="Ej. Home, Pick_1..."
                className="h-8 px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[12px] outline-none focus:border-accent w-[160px]"
              />
            </div>
          )}

          <button onClick={handleTeach}
            className="h-8 px-[14px] rounded-md bg-success-light border border-success text-success-text text-[12px] font-medium hover:bg-[#c2ead9] transition-colors">
            📌 Teach
          </button>
          <button onClick={handleGoTo}
            className="h-8 px-[14px] rounded-md bg-accent border border-accent text-white text-[12px] font-medium hover:bg-accent-hover transition-colors">
            Go To
          </button>
        </div>

        {teachFeedback && (
          <p className={`mt-2 text-[11px] ${teachFeedback.ok ? 'text-success-text' : 'text-danger-text'}`}>
            {teachFeedback.msg}
          </p>
        )}
      </div>
    </div>
  );
}
